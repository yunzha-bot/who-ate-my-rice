import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** Pure presentation constants. Never consumed by collision, AI or interaction. */
export const HOME_PALETTE = {
  background: 0xd1cec3, wall: 0xf1eadd, wood: 0x947757,
  fabric: 0x92a594, cream: 0xf4edda, tile: 0xb7c2ba,
} as const;

/** Presentation scale only: never used by movement, navigation or targeting. */
export const HOME_COMPOSITION = {
  playViewScale: 1.3, avatarWidth: 1.35, avatarHeight: 1.65,
  wallHeightScale: 1.3, doorVisualHeight: 1.85, wallThicknessScale: 1.8,
} as const;

export function homeFrustum(aspect: number, menu: boolean, baseHeight: number, mapDepth: number,
  mapWidth = 0) {
  // 等距镜头的水平轴是 u = (x − z)/√2，所以决定「整张平面图能不能进画」的是地图的
  // **对角跨度**而不是宽度：`52 / aspect` 只保证宽 ≥ 52 世界单位，而 48 × 30 的地图
  // 在 u 上要占 (48 + 30)/(2√2) ≈ 27.6（两侧各 27.6）。
  // `mapWidth` 缺省 0 = 保持旧行为，既有调用与 `tests/alpha-presentation.test.mjs`
  // 的四参数断言不受影响；`ThreeGame` 传入 `MAP_WIDTH` 后，菜单会额外保证整个
  // u 区间都在画内。2026-10-03 东翼扩建时由真实浏览器标记探针复现：16:9 的
  // faction-select 会把最东北角切掉约 0.55 视图单位（1920px 下约 15px）。
  const center = menu && aspect > 1.3 ? .62 : aspect > 1.3 ? .55 : .5;
  const diagonal = mapWidth > 0 ? (mapWidth + mapDepth) / (2 * Math.SQRT2) : 0;
  const narrowSide = Math.max(1e-6, Math.min(center, 1 - center));
  const height = menu
    ? Math.max(mapDepth + 10, diagonal / narrowSide / Math.max(aspect, 1e-6),
        52 / Math.max(aspect, .5))
    : baseHeight * HOME_COMPOSITION.playViewScale;
  const width = height * aspect;
  return { left: -width * center, right: width * (1 - center), top: height / 2, bottom: -height / 2 };
}

export function furnitureColor(id: string): number {
  if (/carton/.test(id)) return 0xbb9162;
  if (/sofa|bench/.test(id)) return HOME_PALETTE.fabric;
  if (/fridge|sink|tub|counter/.test(id)) return HOME_PALETTE.cream;
  return HOME_PALETTE.wood;
}

/** All decoration is attached in furniture-local coordinates, inside its footprint.
 * MapBuilder registers collision BEFORE adding this detail. Editor transforms and
 * disposal therefore remain owned by the existing apartment mesh lifecycle. */
export function dressFurniture(mesh: THREE.Mesh, rect: Rect): void {
  const { width: w, height: h, depth: d, id } = rect;
  const part = (width: number, height: number, depth: number, color: number,
    x: number, y: number, z: number) => {
    const item = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
    item.position.set(x, y - h / 2, z);
    item.castShadow = item.receiveShadow = true;
    mesh.add(item);
    return item;
  };
  if (/bed$/.test(id)) {
    part(w * .94, h * .65, d * .91, HOME_PALETTE.cream, 0, h * 1.04, 0);
    part(w, h * 1.35, d * .10, HOME_PALETTE.wood, 0, h * .95, -d * .45);
    part(w * .95, .025, d * .58, id.startsWith('main') ? 0x97afa5 : 0xb6a4b9,
      0, h * 1.38, d * .17);
    for (const side of [-1, 1])
      part(w * .34, h * .25, d * .22, 0xfff4df, side * w * .23, h * 1.46, -d * .29);
  } else if (/sofa|bench/.test(id)) {
    for (const side of [-1, 1])
      part(w * .38, .18, d * .71, 0xc9cfb7, side * w * .21, h + .09, d * .07);
    part(w * .96, h * .7, d * .18, 0x87997c, 0, h * 1.25, -d * .40);
    for (const side of [-1, 1]) part(w * .12, h * .5, d, 0x87997c, side * w * .44, h * 1.05, 0);
  } else if (/carton/.test(id)) {
    part(w * .16, .012, d * .98, 0xe5c892, 0, h + .01, 0);
    part(w * .98, .013, d * .012, 0x806044, 0, h + .016, 0);
  } else if (/shelf/.test(id)) {
    part(w, h * .35, d, HOME_PALETTE.wood, 0, h * 1.175, 0);
    part(w * 1.06, .09, d * 1.02, 0xc6b496, 0, h * 1.35, 0);
    // Books on the broad face, rather than another obstructing object in the room.
    const colors = [0x7f9e91, 0xd0ae75, 0xb27d6e, 0xe6d8b6];
    for (let row = 0; row < 2; row++) for (let i = 0; i < 7; i++)
      part(.025, h * .24, d * .09, colors[i % colors.length],
        -w / 2 - .012, h * (.3 + row * .44), d * (-.39 + i * .13));
  } else if (/wardrobe|cabinet|fridge/.test(id)) {
    part(w, h * .32, d, furnitureColor(id), 0, h * 1.16, 0);
    part(w * 1.03, .08, d * 1.02, 0xc6b496, 0, h * 1.34, 0);
    for (const z of [-.07, .07])
      part(.032, h * .17, .025, 0x655744, -w / 2 - .016, h * .57, z * d);
    part(.012, h * .92, .013, 0x796c57, -w / 2 - .01, h / 2, 0);
  } else if (/table|desk|island/.test(id)) {
    part(w, .16, d, 0xcbb08a, 0, h + .08, 0);
    // A placemat, book and small plant: no new navigational objects.
    part(w * .5, .014, d * .45, 0xe2d6b6, 0, h + .012, 0);
    part(w * .22, .04, d * .24, 0x83968b, w * .16, h + .04, 0);
    part(.13, .13, .13, 0xc19979, -w * .28, h + .065, -d * .2);
    part(.19, .14, .17, 0x78916c, -w * .28, h + .19, -d * .2);
  } else if (/sink|tub/.test(id)) {
    part(w * .73, .015, d * .7, 0xa8c8c3, 0, h + .01, 0);
  }
}

/** Translation-only smoothing: camera rotation never changes, so screen-relative
 * WASD remains identical. Explicit snap for new rounds/editor/faction changes. */
export class GentleCameraFollow {
  readonly focus = new THREE.Vector3();
  private initialized = false;
  update(target: THREE.Vector3, deltaMs = 0): THREE.Vector3 {
    if (!this.initialized || deltaMs <= 0 || this.focus.distanceToSquared(target) > 36) {
      this.focus.copy(target);
      this.initialized = true;
    } else {
      this.focus.lerp(target, 1 - Math.exp(-Math.min(deltaMs, 100) / 75));
    }
    return this.focus;
  }
}

export function cooldownFraction(remainingMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : THREE.MathUtils.clamp(1 - remainingMs / durationMs, 0, 1);
}

/** Signed shortest turn, including the seam between -π and +π. */
export function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** A small procedural stand-in, not final character art. Physics stays on actor. */
export class HomeAvatar {
  readonly root = new THREE.Group();
  private readonly last = new THREE.Vector3();
  private time = 0;
  private stepPhase = 0;
  private stride = 0;
  private facing = 0;
  private targetFacing = 0;
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly cloth: THREE.MeshStandardMaterial;
  private readonly actor: THREE.Mesh;
  constructor(actor: THREE.Mesh, deepseek: boolean) {
    this.actor = actor;
    actor.geometry.computeBoundingBox();
    const size = actor.geometry.boundingBox!.getSize(new THREE.Vector3());
    this.cloth = new THREE.MeshStandardMaterial({ color: deepseek ? 0x5b92b5 : 0xc08053, roughness: .9 });
    const make = (parent: THREE.Group, w: number, h: number, d: number,
      material: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      part.position.set(x, y, z);
      part.castShadow = part.receiveShadow = true;
      parent.add(part);
    };
    const skin = new THREE.MeshStandardMaterial({ color: 0xf6d8b6, roughness: 1 });
    const hair = new THREE.MeshStandardMaterial({ color: deepseek ? 0x334d69 : 0x695447, roughness: 1 });
    const ink = new THREE.MeshStandardMaterial({ color: 0x343f43, roughness: 1 });
    const w = size.x, h = size.y;
    this.body.name = 'body';
    this.head.name = 'head';
    this.leftArm.name = 'leftArm';
    this.rightArm.name = 'rightArm';
    this.leftLeg.name = 'leftLeg';
    this.rightLeg.name = 'rightLeg';
    this.root.add(this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg);
    make(this.body, w * 1.08, h * .50, w * .94, this.cloth, 0, -h * .01, 0);
    make(this.body, w * .49, h * .25, .022,
      new THREE.MeshStandardMaterial({ color: 0xf7edda }), 0, -h * .04, w * .48);
    this.head.position.y = h * .46;
    make(this.head, w * 1.43, h * .51, w * 1.25, skin, 0, 0, 0);
    make(this.head, w * 1.51, h * .17, w * 1.34, hair, 0, h * .26, -.015);
    for (const sign of [-1, 1]) {
      const arm = sign < 0 ? this.leftArm : this.rightArm;
      const leg = sign < 0 ? this.leftLeg : this.rightLeg;
      arm.position.set(sign * w * .67, h * .15, 0); // shoulder pivot
      leg.position.set(sign * w * .28, -h * .25, .055); // hip pivot
      make(arm, w * .32, h * .36, w * .60, this.cloth, 0, -h * .17, 0);
      make(arm, w * .30, h * .13, w * .54, skin, 0, -h * .38, .025);
      make(leg, w * .43, h * .24, w * .82, ink, 0, -h * .12, 0);
      make(this.head, w * .12, h * .095, .025, ink,
        sign * w * .28, 0, w * .632);
    }
    actor.add(this.root);
    this.root.scale.set(HOME_COMPOSITION.avatarWidth, HOME_COMPOSITION.avatarHeight,
      HOME_COMPOSITION.avatarWidth);
    // Lift enlarged child so its feet retain the original ground plane.
    this.root.position.y = h * (HOME_COMPOSITION.avatarHeight - 1) / 2;
    const material = actor.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    material.opacity = 0; // Keep the original selectable root and footprint unchanged.
    material.depthWrite = false;
    actor.castShadow = false;
    this.last.copy(actor.position);
  }

  update(action: string, deltaMs: number): void {
    const dt = Math.min(Math.max(0, deltaMs), 100) / 1000;
    if (dt === 0) return;
    this.time += dt;
    const dx = this.actor.position.x - this.last.x, dz = this.actor.position.z - this.last.z;
    const distance = Math.hypot(dx, dz);
    // Position is already resolved by gameplay. Only the child mesh follows it.
    if (distance > .0001) this.targetFacing = Math.atan2(dx, dz);
    const turn = shortestTurn(this.facing, this.targetFacing);
    const eased = Math.abs(turn) * (1 - Math.exp(-dt / .12));
    const step = Math.sign(turn) * Math.min(Math.abs(turn), eased, 8 * dt);
    this.facing = Math.atan2(Math.sin(this.facing + step), Math.cos(this.facing + step));
    this.root.rotation.y = this.facing;
    this.last.copy(this.actor.position);
    const moving = action === 'WALK' || action === 'RUN';
    const height = this.actor.geometry.boundingBox!.max.y - this.actor.geometry.boundingBox!.min.y;
    const speed = distance / dt;
    const targetStride = moving ? Math.min(1, Math.max(.45, speed / 2.4)) : 0;
    this.stride += (targetStride - this.stride) * (1 - Math.exp(-dt / .085));
    if (moving) this.stepPhase += dt * (action === 'RUN' ? 17 : 10 + Math.min(speed, 3) * 1.3);
    const swing = Math.sin(this.stepPhase) * this.stride;
    const legAngle = (action === 'RUN' ? .72 : .52) * swing;
    const armAngle = (action === 'RUN' ? .60 : .44) * swing;
    this.leftLeg.rotation.x = legAngle;
    this.rightLeg.rotation.x = -legAngle;
    this.leftArm.rotation.x = -armAngle;
    this.rightArm.rotation.x = armAngle;
    // Swing is in the joints; only a restrained amount reaches the torso.
    this.body.rotation.x = action === 'RUN' ? .075 : 0;
    this.body.rotation.z = Math.sin(this.stepPhase) * this.stride * .045;
    const bob = Math.abs(Math.sin(this.stepPhase)) * this.stride * height * .018;
    this.body.position.y = bob;
    this.head.position.y = height * .46 - bob * .7;
    this.head.rotation.x = -this.body.rotation.x * .7;
    this.head.rotation.z = -this.body.rotation.z * .6;
    this.root.position.y = height * (HOME_COMPOSITION.avatarHeight - 1) / 2 +
      (moving ? bob * .35
      : action === 'EAT' ? Math.sin(this.time * 15) * .014 : Math.sin(this.time * 2.4) * .008);
    this.root.rotation.x = action === 'RUN' ? .12 : action === 'EAT' ? .09 : 0;
    this.root.scale.y = HOME_COMPOSITION.avatarHeight * (1 + (moving ? 0 : Math.sin(this.time * 2.4) * .008));
    this.cloth.emissive.setHex(action === 'STUN' || action === 'FALL' ? 0x392526 : 0);
  }

  reset(): void {
    this.time = 0;
    this.stepPhase = 0;
    this.stride = 0;
    this.facing = 0;
    this.targetFacing = 0;
    this.last.copy(this.actor.position);
    const height = this.actor.geometry.boundingBox!.max.y - this.actor.geometry.boundingBox!.min.y;
    this.root.position.set(0, height * (HOME_COMPOSITION.avatarHeight - 1) / 2, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(HOME_COMPOSITION.avatarWidth, HOME_COMPOSITION.avatarHeight, HOME_COMPOSITION.avatarWidth);
    for (const joint of [this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg]) {
      joint.rotation.set(0, 0, 0);
      joint.position.y = joint === this.head ? height * .46
        : joint === this.leftArm || joint === this.rightArm ? height * .15
          : joint === this.leftLeg || joint === this.rightLeg ? -height * .25 : 0;
    }
  }

  dispose(): void {
    const materials = new Set<THREE.Material>();
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        materials.add(object.material as THREE.Material);
      }
    });
    materials.forEach(material => material.dispose());
    this.root.removeFromParent();
  }
}
