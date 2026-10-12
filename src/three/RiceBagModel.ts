import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const RICE_BAG_MODEL_URL = '/assets/props/rice-bag/rice-bag.glb';
let template: Promise<THREE.Group> | null = null;

/** 五个米点共用一次下载与贴图；实例拥有自己的几何和材质。 */
export function loadRiceBagModel(): Promise<THREE.Group> {
  template ??= new GLTFLoader().loadAsync(RICE_BAG_MODEL_URL).then(gltf => gltf.scene)
    .catch(error => { template = null; throw error; });
  return template.then(source => {
    const model = source.clone(true);
    model.name = 'RiceBagGLB';
    model.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry = child.geometry.clone();
      child.material = Array.isArray(child.material)
        ? child.material.map(material => material.clone()) : child.material.clone();
      child.castShadow = child.receiveShadow = true;
    });
    return model;
  });
}

export function disposeRiceBagModel(model: THREE.Group): void {
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose();
  });
  // 贴图属于缓存模板，单个米点销毁不能清掉其他米点的贴图。
  model.removeFromParent();
}
