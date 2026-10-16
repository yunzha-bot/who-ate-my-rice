import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DEEPSEEK_CLIPS } from '../src/three/DeepSeekAnimation.ts';

let serial = 0;
function injectedFailure(message) {
  const error = new Error(message); error.stack = message; return error;
}
async function modelModule(production) {
  // Execute the actual loader with only Vite's build-time environment substituted.
  let source = readFileSync(new URL('../src/three/DeepSeekGlbModel.ts', import.meta.url), 'utf8');
  source = source.replaceAll('import.meta.env.PROD', String(production));
  source = source.replace(/from '([^']+)'/g, (_, specifier) =>
    `from '${specifier.startsWith('.') ? new URL(`../src/three/${specifier}`, import.meta.url).href : import.meta.resolve(specifier)}'`);
  return import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}#${serial++}`);
}

function rigged() {
  const scene = new THREE.Group(), bone = new THREE.Bone();
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  mesh.add(bone); mesh.bind(new THREE.Skeleton([bone])); scene.add(mesh);
  return { scene, animations: DEEPSEEK_CLIPS.map(name => new THREE.AnimationClip(name, 1, [])) };
}

test('production loads and clones the formal v6 rig and all required animation clips', async t => {
  const requests = [], original = rigged();
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => { requests.push(url); return original; });
  const module = await modelModule(true), model = await module.loadDeepSeekModel();
  assert.deepEqual(requests, [module.DEEPSEEK_ANIMATED_GLB_URL]);
  assert.notEqual(model, original.scene); assert.deepEqual(model.animations.map(a => a.name), DEEPSEEK_CLIPS);
  module.disposeDeepSeekModel(model);
});

test('production v6 failure reaches the existing caller fallback without requesting private models', async t => {
  const requests = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => { requests.push(url); throw injectedFailure('model unavailable'); });
  const module = await modelModule(true);
  await assert.rejects(module.loadDeepSeekModel());
  assert.deepEqual(requests, [module.DEEPSEEK_ANIMATED_GLB_URL]);
});

test('production animation-error staticOnly path never requests standalone GLB', async t => {
  const requests = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => { requests.push(url); return rigged(); });
  const module = await modelModule(true);
  await assert.rejects(module.loadDeepSeekModel(true));
  assert.deepEqual(requests, []);
});

test('development retains v6 to v5 animated fallback', async t => {
  const requests = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    requests.push(url); if (url.endsWith('v6_hair.glb')) throw injectedFailure('v6 unavailable'); return rigged();
  });
  const module = await modelModule(false), model = await module.loadDeepSeekModel();
  assert.equal(requests.length, 2); assert.ok(requests[1].endsWith('v5_hair_ready.glb'));
  assert.deepEqual(model.animations.map(a => a.name), DEEPSEEK_CLIPS); module.disposeDeepSeekModel(model);
});

test('development retains standalone fallback and direct staticOnly loads', async t => {
  const requests = [];
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async url => {
    requests.push(url); if (!url.endsWith('standalone.glb')) throw injectedFailure('animated models unavailable');
    const scene = new THREE.Group(); scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())); return { scene };
  });
  const module = await modelModule(false), model = await module.loadDeepSeekModel(), second = await module.loadDeepSeekModel(true);
  assert.equal(requests.length, 3); assert.ok(requests[2].endsWith('standalone.glb'));
  module.disposeDeepSeekModel(model); module.disposeDeepSeekModel(second);
});
