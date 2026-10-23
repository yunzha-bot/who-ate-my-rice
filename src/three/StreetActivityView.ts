import * as THREE from 'three';
import type { ResidentialLayout } from './ResidentialExterior.ts';

/** Visual-only speeds (world units/second). No gameplay or perception parameters. */
export const STREET_ACTIVITY = {
  enabled: true,
  pedestrians: true,
  cars: true,
  walkSpeed: .8,
  carSpeed: 2.4,
  turnSeconds: .9,
  maxDeltaMs: 80,
};

type Walker = { root: THREE.Group; body: THREE.Group; limbs: THREE.Group[];
  minX: number; maxX: number; z: number; floor: number; phase: number; speed: number };
type Car = { root: THREE.Group; wheels: THREE.Group[]; minX: number; maxX: number;
  z: number; floor: number; phase: number; direction: number; speed: number };

/** Six background actors, driven by the existing render loop. MapBuilder owns GPU disposal. */
export class StreetActivityView {
  readonly root = new THREE.Group();
  private readonly walkers: Walker[] = [];
  private readonly cars: Car[] = [];
  private readonly reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  private walkElapsed = 0;
  private carElapsed = 0;
  private disposed = false;

  constructor(parent: THREE.Group, layout: ResidentialLayout) {
    this.root.name = 'street-activity-visual-only';
    this.root.userData.visualOnly = true;
    parent.add(this.root);
    const cube = new THREE.BoxGeometry(1, 1, 1);
    const wheel = new THREE.CylinderGeometry(1, 1, 1, 12);
    const materials = new Map<number, THREE.MeshStandardMaterial>();
    const part = (parent: THREE.Object3D, name: string, color: number,
      x: number, y: number, z: number, w: number, h: number, d: number, round = false) => {
      if (!materials.has(color)) materials.set(color,
        new THREE.MeshStandardMaterial({color, roughness: 1, flatShading: true}));
      const mesh = new THREE.Mesh(round ? wheel : cube, materials.get(color)!);
      mesh.name = name; mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
      mesh.castShadow = mesh.receiveShadow = true; mesh.raycast = () => {}; parent.add(mesh);
      return mesh;
    };
    const surface = (prefix: string) => new THREE.Box3().setFromObject(
      parent.children.find(n => n.name.startsWith(prefix))!);
    const home = surface('walk-home-front'), across = surface('walk-across-road');
    const road = surface('road-main-west');

    // Short strolls on clear pavement strips. Turn around, never teleport through a facade.
    const walks = [
      [layout.left - 30, layout.left - 4, home.max.z - .35, home.max.y, .3, 0x92a18a],
      [layout.cx - 20, layout.cx + 15, home.max.z - .35, home.max.y, .7, 0xb6a078],
      [layout.left - 36, layout.left + 10, across.min.z + .35, across.max.y, .53, 0xa78e86],
      [layout.cx - 8, layout.right - 8, across.min.z + .35, across.max.y, .2, 0x8b9e9c],
    ];
    walks.forEach(([minX, maxX, z, floor, phase, color], index) => {
      const root = new THREE.Group(), body = new THREE.Group(), limbs: THREE.Group[] = [];
      root.name = `street-pedestrian-${index}`; root.add(body); this.root.add(root);
      part(body, 'coat', color, 0, .97, 0, .4, .62, .26);
      part(body, 'head', 0xc5a78a, 0, 1.47, 0, .34, .38, .32);
      part(body, 'hair', index % 2 ? 0x72695e : 0x5e655b, 0, 1.65, -.025, .36, .13, .34);
      part(body, 'face', 0xc5a78a, 0, 1.44, .172, .12, .14, .05);
      for (const side of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(side * .115, .66, 0); root.add(leg);
        part(leg, 'trousers', 0x70776e, 0, -.27, 0, .145, .54, .18);
        part(leg, 'shoe', 0x596059, 0, -.6, .045, .17, .12, .28);
        limbs.push(leg);
        const arm = new THREE.Group(); arm.position.set(side * .265, 1.17, 0); body.add(arm);
        part(arm, 'sleeve', color, 0, -.18, 0, .13, .36, .16);
        part(arm, 'hand', 0xc5a78a, 0, -.42, 0, .12, .14, .14);
        limbs.push(arm);
      }
      this.walkers.push({root, body, limbs, minX, maxX, z, floor, phase,
        speed: STREET_ACTIVITY.walkSpeed * (1 + (index - 1.5) * .06)});
    });

    // Opposing lanes on the continuous main road. Recycling occurs far beyond normal views.
    for (let index = 0; index < 2; index++) {
      const root = new THREE.Group(), wheels: THREE.Group[] = [];
      root.name = `street-moving-car-${index}`; this.root.add(root);
      const color = index ? 0xa28f78 : 0x8e9f9e;
      part(root, 'body', color, 0, .55, 0, 3.65, .59, 1.6);
      part(root, 'cabin', color, -.1, 1.05, 0, 1.9, .5, 1.34);
      part(root, 'windscreen', 0x81948e, .86, 1.09, 0, .035, .33, 1.12);
      for (const side of [-1, 1]) {
        part(root, 'side-window', 0x81948e, -.1, 1.09, side * .678, 1.57, .32, .018);
        part(root, 'headlight', 0xdacfb3, 1.84, .56, side * .49, .035, .15, .29);
        part(root, 'taillight', 0xac7867, -1.84, .56, side * .49, .035, .14, .29);
        for (const axle of [-1, 1]) {
          const pivot = new THREE.Group(); pivot.position.set(axle * 1.14, .28, side * .79); root.add(pivot);
          const tire = part(pivot, 'wheel', 0x505953, 0, 0, 0, .28, .16, .28, true);
          tire.rotation.x = Math.PI / 2; wheels.push(pivot);
        }
      }
      this.cars.push({root, wheels, minX: layout.cx - 140, maxX: layout.cx + 140,
        z: index ? road.max.z - 1.9 : road.min.z + 1.9, floor: road.max.y,
        phase: index ? .39 : .45, direction: index ? -1 : 1,
        speed: STREET_ACTIVITY.carSpeed * (index ? .92 : 1)});
    }
    this.pose(true);
  }

  update(deltaMs: number, active = true): void {
    if (this.disposed || !active || !STREET_ACTIVITY.enabled || this.reduced?.matches ||
        !Number.isFinite(deltaMs) || deltaMs <= 0) return;
    const seconds = Math.min(deltaMs, STREET_ACTIVITY.maxDeltaMs) / 1000;
    if (STREET_ACTIVITY.pedestrians) this.walkElapsed += seconds;
    if (STREET_ACTIVITY.cars) this.carElapsed += seconds;
    this.pose();
  }

  private pose(initial = false): void {
    for (const walker of this.walkers) {
      if (!initial && !STREET_ACTIVITY.pedestrians) continue;
      const length = walker.maxX - walker.minX, walk = length / walker.speed;
      const turn = STREET_ACTIVITY.turnSeconds, cycle = 2 * (walk + turn);
      const t = (this.walkElapsed + walker.phase * cycle) % cycle;
      let distance: number, yaw: number;
      if (t < walk) { distance = t * walker.speed; yaw = Math.PI / 2; }
      else if (t < walk + turn) {
        const a = (t - walk) / turn;
        distance = length; yaw = Math.PI / 2 + Math.PI * a * a * (3 - 2 * a);
      } else if (t < 2 * walk + turn) {
        distance = length - (t - walk - turn) * walker.speed; yaw = 3 * Math.PI / 2;
      } else {
        const a = (t - 2 * walk - turn) / turn;
        distance = 0; yaw = 3 * Math.PI / 2 + Math.PI * a * a * (3 - 2 * a);
      }
      const weight = Math.max(0, Math.min(1, distance / .45, (length - distance) / .45));
      const stride = Math.sin((this.walkElapsed + walker.phase * 10) * 6 * walker.speed) * weight;
      walker.root.position.set(walker.minX + distance, walker.floor, walker.z);
      walker.root.rotation.y = yaw;
      walker.body.position.y = Math.abs(stride) * .015;
      walker.limbs.forEach((limb, i) => {
        const angle = stride * (i < 2 ? 1 : -1) * (i % 2 ? -.22 : .32);
        limb.rotation.x = angle;
        // Lift the forward shoe corner instead of letting the rotating sole enter the pavement.
        if (i % 2 === 0) limb.position.y = .66 + Math.max(0,
          .66 * (Math.cos(angle) - 1) + .045 * Math.sin(angle) + .14 * Math.abs(Math.sin(angle)));
      });
    }
    for (const car of this.cars) {
      if (!initial && !STREET_ACTIVITY.cars) continue;
      const length = car.maxX - car.minX;
      const distance = (car.phase * length + this.carElapsed * car.speed) % length;
      car.root.position.set(car.direction > 0 ? car.minX + distance : car.maxX - distance, car.floor, car.z);
      car.root.rotation.y = car.direction > 0 ? 0 : Math.PI;
      car.wheels.forEach(wheel => { wheel.rotation.z = -this.carElapsed * car.speed / .28; });
    }
  }

  /** Stop updates before MapBuilder traverses this root to release shared GPU resources. */
  dispose(): void { this.disposed = true; this.walkers.length = 0; this.cars.length = 0; }
}
