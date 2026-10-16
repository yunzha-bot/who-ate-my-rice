import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { DEEPSEEK_CLIPS } from './DeepSeekAnimation.ts';

export const DEEPSEEK_GLB_URL = '/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb';
export const DEEPSEEK_ANIMATED_GLB_URL = '/assets/characters/deepseek/deepseek_animated_v6_hair.glb';
const DEEPSEEK_PREVIOUS_ANIMATED_GLB_URL = '/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb';

let modelPromise: Promise<THREE.Group> | null = null;
let staticPromise: Promise<THREE.Group> | null = null;

function loadStatic(): Promise<THREE.Group> {
  if (import.meta.env.PROD) return Promise.reject(new Error('Production uses the procedural fallback, not private GLBs'));
  staticPromise ??= new GLTFLoader().loadAsync(DEEPSEEK_GLB_URL).then(gltf => gltf.scene)
    .catch(error => { staticPromise = null; throw error; });
  return staticPromise;
}

export function disposeDeepSeekModel(model: THREE.Object3D): void {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach(material => material.dispose());
    if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose();
  });
  // Textures belong to the cached template, and are shared by every instance.
  model.removeFromParent();
}

/** One download for the player or NPC; callers receive independent render objects. */
export function loadDeepSeekModel(staticOnly = false): Promise<THREE.Group> {
  const loadAnimated = (url: string) => new GLTFLoader().loadAsync(url).then(gltf => {
    if (!gltf.scene.getObjectByProperty('isSkinnedMesh', true) ||
        !DEEPSEEK_CLIPS.every(name => gltf.animations.some(clip => clip.name === name && clip.duration > 0))) {
      throw new Error('DeepSeek GLB is missing its rig or required clips');
    }
    gltf.scene.animations = gltf.animations;
    return gltf.scene;
  });
  if (!staticOnly) modelPromise ??= loadAnimated(DEEPSEEK_ANIMATED_GLB_URL).catch(error => {
    if (import.meta.env.PROD) throw error;
    console.warn('DeepSeek v6 hair GLB unavailable; loading v5 animated GLB', error);
    return loadAnimated(DEEPSEEK_PREVIOUS_ANIMATED_GLB_URL).catch(error => {
      console.warn('DeepSeek animated GLB unavailable; loading stable static GLB', error);
      return loadStatic();
    });
  })
    .catch(error => {
      modelPromise = null; // A later match can retry after a transient failure.
      throw error;
    });
  return (staticOnly ? loadStatic() : modelPromise!).then(source => {
    const model = clone(source) as THREE.Group;
    model.name = 'DeepSeekGLB';
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map(material => material.clone()) : object.material.clone();
      object.castShadow = object.receiveShadow = true;
    });
    return model;
  });
}
