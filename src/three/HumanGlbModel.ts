import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const base = typeof import.meta.env === 'undefined' ? '/' : import.meta.env.BASE_URL;
export const HUMAN_GLB_URL = `${base}assets/characters/human/human_v2.glb`;
let template: Promise<THREE.Group> | null = null;

/** One cached download; each avatar owns independent geometry and shared-within-instance materials. */
export async function loadHumanModel(): Promise<THREE.Group> {
  template ??= new GLTFLoader().loadAsync(HUMAN_GLB_URL).then(gltf => gltf.scene)
    .catch(error => { template = null; throw error; });
  const model = (await template).clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  model.name = 'HumanGLB';
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    const copy = (source: THREE.Material) => {
      if (!materials.has(source)) materials.set(source, source.clone());
      return materials.get(source)!;
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
    object.castShadow = object.receiveShadow = true;
  });
  return model;
}

export function disposeHumanModel(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  model.removeFromParent();
}

/** Rigid-part posing, not a skeleton: consume the existing gait, never drive gameplay. */
export class HumanModelPose {
  private readonly rig: THREE.Object3D;
  private readonly arms: THREE.Group[] = [];
  private readonly legs: THREE.Group[] = [];
  private readonly soles: THREE.Box3[] = [];
  private readonly floorBox = new THREE.Box3();
  constructor(model: THREE.Group) {
    const part = (name: string): THREE.Object3D => {
      const object = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(`HU2_r03_${name}`));
      if (!object) throw new Error(`Human GLB missing ${name}`);
      return object;
    };
    this.rig = part('Human_FootOrigin');
    // Validate every required part before changing the hierarchy.
    for (const name of ['Head', 'Eyes', 'Hair', 'Torso', 'Hood', 'Pelvis',
      'Arm.L', 'Arm.R', 'Leg.L', 'Leg.R', 'Shoe.L', 'Shoe.R']) part(name);
    model.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      for (const kind of ['Arm', 'Leg']) {
        const object = part(`${kind}.${side}`), bounds = new THREE.Box3().setFromObject(object);
        const pivot = new THREE.Group(); pivot.name = `Human${kind}Pivot.${side}`;
        pivot.position.copy(bounds.getCenter(new THREE.Vector3()));
        pivot.position.y = bounds.max.y - (kind === 'Arm' ? .035 : .015);
        this.rig.add(pivot); pivot.updateMatrixWorld(true); pivot.attach(object);
        if (kind === 'Leg') {
          const shoe = part(`Shoe.${side}`);
          this.soles.push(new THREE.Box3().setFromObject(shoe).translate(pivot.position.clone().negate()));
          pivot.attach(shoe); this.legs.push(pivot);
        } else this.arms.push(pivot);
      }
    }
  }

  update(legAngle: number, armAngle: number, action: string): void {
    this.arms[0].rotation.x = -armAngle;
    this.arms[1].rotation.x = armAngle;
    if (action === 'CAPTURE' || action === 'INTERACT') {
      this.arms[0].rotation.x = -.65; this.arms[1].rotation.x = -.65;
    }
    let floor = 0;
    for (let i = 0; i < 2; i++) {
      const leg = this.legs[i]; leg.rotation.x = i === 0 ? legAngle : -legAngle;
      leg.updateMatrix();
      floor = Math.min(floor, this.floorBox.copy(this.soles[i]).applyMatrix4(leg.matrix).min.y);
    }
    // Lift only the visual rig when a rotated sole would otherwise cut through the floor.
    this.rig.position.y = -floor;
  }

  reset(): void { this.update(0, 0, 'IDLE'); }
}
