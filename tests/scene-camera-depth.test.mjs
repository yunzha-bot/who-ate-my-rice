import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { fitOrthographicSceneDepth } from '../src/three/SceneCameraDepth.ts';
import { buildResidentialExterior } from '../src/three/ResidentialExterior.ts';
import { ROOMS } from '../src/three/map/apartmentMap.ts';

const exterior = buildResidentialExterior(new THREE.Group(), ROOMS);
const bounds = new THREE.Box3().setFromObject(exterior);
const cameraAt = (x, z) => {
  const camera = new THREE.OrthographicCamera(-55, 55, 35, -35, .1, 100);
  camera.position.set(x + 12, 14, z + 12);
  camera.lookAt(x, 0, z); camera.updateMatrixWorld(true);
  return camera;
};
test('production camera offset reproduces exterior near-plane cuts before fitting', () => {
  const camera = cameraAt(0, 0);
  const east = exterior.getObjectByName('east-neighbor-body');
  const b = new THREE.Box3().setFromObject(east);
  const nearVertex = new THREE.Vector3(b.max.x, b.max.y, b.max.z).applyMatrix4(camera.matrixWorldInverse);
  assert.ok(-nearVertex.z < camera.near);
});
test('depth fitting contains all exterior vertices from menu, follow and editor views', () => {
  for (const [x, z] of [[0, 0], [-18, -15], [18, 15], [18, -15], [-18, 15], [42, -8], [-30, 27]]) {
    const camera = cameraAt(x, z);
    fitOrthographicSceneDepth(camera, bounds);
    exterior.traverse(mesh => {
      if (!mesh.geometry) return;
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        assert.ok(-v.z > camera.near && -v.z < camera.far, `${mesh.name} clipped at ${x},${z}`);
      }
    });
  }
});
test('depth correction preserves screen composition, movement basis and does not accumulate drift', () => {
  const camera = cameraAt(0, 0);
  const points = [new THREE.Vector3(-18, 0, -15), new THREE.Vector3(18, 2, 15)];
  const before = points.map(p => p.clone().project(camera));
  const direction = camera.getWorldDirection(new THREE.Vector3());
  fitOrthographicSceneDepth(camera, bounds);
  points.forEach((p, i) => {
    const after = p.clone().project(camera);
    assert.ok(Math.abs(after.x - before[i].x) < 1e-12);
    assert.ok(Math.abs(after.y - before[i].y) < 1e-12);
  });
  assert.ok(camera.getWorldDirection(new THREE.Vector3()).distanceTo(direction) < 1e-12);
  const position = camera.position.clone();
  for (let i = 0; i < 100; i++) fitOrthographicSceneDepth(camera, bounds);
  assert.ok(camera.position.distanceTo(position) < 1e-10);
});
test('game refreshes visual bounds on construction and map rebuild and fits before render', () => {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  assert.equal(source.match(/this.sceneVisualBounds.setFromObject\(this.apartment.root\)/g)?.length, 2);
  assert.match(source, /fitOrthographicSceneDepth\(this.camera, this.sceneVisualBounds\);\s*this.renderer.render/);
});
