import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HomeAvatar } from '../src/three/AlphaPresentation.ts';
import { deepseekResultPortrait } from '../src/three/GameUiLayout.ts';

test('maid uses volumetric geometry on existing joints and leaves actor physics untouched', () => {
  const geometry = new THREE.BoxGeometry(.5, 1, .5);
  const actor = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  for (const name of ['maid-skirt', 'white-apron', 'apron-whale', 'whale-tail-flukes',
    'layered-bang', 'maid-headband-ruffle', 'ahoge', 'blue-hair-bow']) {
    const part = avatar.root.getObjectByName(name);
    assert.ok(part?.isMesh, name);
    part.geometry.computeBoundingBox();
    const size = part.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x > 0 && size.y > 0 && size.z > 0, `${name} has thickness`);
  }
  const head = avatar.root.getObjectByName('head');
  for (const action of ['WALK', 'RUN', 'EAT', 'INTERACT', 'FALL', 'IDLE']) {
    actor.position.x += .03;
    avatar.update(action, 16);
    assert.ok(Number.isFinite(head.position.y));
    assert.equal(actor.geometry, geometry);
    assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  }
  avatar.dispose();
});

test('Human appearance does not acquire maid parts', () => {
  const avatar = new HomeAvatar(new THREE.Mesh(new THREE.BoxGeometry(.5, 1, .5),
    new THREE.MeshStandardMaterial()), false);
  assert.equal(avatar.root.getObjectByName('maid-skirt'), undefined);
  avatar.dispose();
});

test('GLB visual keeps source proportions and lands on the original actor footprint', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .5),
    new THREE.MeshStandardMaterial());
  actor.position.y = .35;
  const avatar = new HomeAvatar(actor, true);
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(.8, 1, .6),
    new THREE.MeshStandardMaterial()));
  model.children[0].position.y = .5;
  avatar.useExternalVisual(model);
  actor.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  assert.ok(Math.abs(bounds.max.y - .7 * 1.65 * 1.35 * 1.2) < 1e-6);
  const size = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x / size.y - .8) < 1e-6);
  assert.ok(Math.abs(size.z / size.y - .6) < 1e-6);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  assert.equal(avatar.root.getObjectByName('maid-skirt').parent.visible, false);
  avatar.dispose();
});

test('DeepSeek portrait emotion depends on actual winner, not player faction', () => {
  assert.match(deepseekResultPortrait('DEEPSEEK'), /deepseek-win\.png$/);
  assert.match(deepseekResultPortrait('HUMAN'), /deepseek-lose\.png$/);
});
