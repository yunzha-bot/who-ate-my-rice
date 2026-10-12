import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { STORAGE_VISUAL_ROLES } from '../src/three/StorageFurnitureVisual.ts';

test('all shelf models are covered, stay in authored footprints and batch as one mesh', () => {
  const before = JSON.stringify(FURNITURE);
  for (const rect of FURNITURE.filter(r => /shelf|bookcase/.test(r.id)))
    assert.ok(STORAGE_VISUAL_ROLES[rect.id], rect.id);
  const targets = FURNITURE.filter(r => STORAGE_VISUAL_ROLES[r.id]);
  assert.equal(targets.length, 16);
  assert.equal(STORAGE_VISUAL_ROLES.storage_rack, STORAGE_VISUAL_ROLES.storage_shelf);
  for (const rect of targets) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(rect.width, rect.height, rect.depth),
      new THREE.MeshStandardMaterial());
    const geometry = base.geometry;
    dressFurniture(base, rect);
    assert.equal(base.geometry, geometry, 'editor/collision proxy preserved');
    assert.equal(base.material.opacity, 0);
    assert.equal(base.castShadow, false, 'solid proxy must not shadow open shelves');
    assert.equal(base.children.length, 1, 'one merged detail draw');
    const detail = base.children[0];
    detail.geometry.computeBoundingBox();
    const b = detail.geometry.boundingBox;
    assert.ok(b.min.x >= -rect.width / 2 - 1e-5 && b.max.x <= rect.width / 2 + 1e-5, rect.id);
    assert.ok(b.min.z >= -rect.depth / 2 - 1e-5 && b.max.z <= rect.depth / 2 + 1e-5, rect.id);
    assert.ok(b.min.y >= -rect.height / 2 - 1e-5, rect.id);
    assert.ok([...detail.geometry.attributes.position.array].every(Number.isFinite));
    base.geometry.dispose(); base.material.dispose();
    detail.geometry.dispose(); detail.material.dispose();
  }
  assert.equal(JSON.stringify(FURNITURE), before);
});

test('laundry fixtures retain the saved footprint, transforms and one visual batch', () => {
  for (const id of ['utility_counter', 'utility_laundry_basket']) {
    const rect = FURNITURE.find(r => r.id === id);
    const base = new THREE.Mesh(new THREE.BoxGeometry(rect.width, rect.height, rect.depth),
      new THREE.MeshStandardMaterial());
    base.position.set(rect.x, rect.height / 2, rect.z);
    base.rotation.y = rect.rotation;
    base.updateMatrix(); const authored = base.matrix.clone();
    dressFurniture(base, rect); base.updateMatrix();
    assert.deepEqual(base.matrix.elements, authored.elements);
    assert.equal(base.children.length, 1);
    const mesh = base.children[0]; mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    assert.ok(b.min.x >= -rect.width / 2 - 1e-5 && b.max.x <= rect.width / 2 + 1e-5, id);
    assert.ok(b.min.z >= -rect.depth / 2 - 1e-5 && b.max.z <= rect.depth / 2 + 1e-5, id);
    assert.ok(b.min.y >= -rect.height / 2 - 1e-5, id);
    base.geometry.dispose(); base.material.dispose();
    mesh.geometry.dispose(); mesh.material.dispose();
  }
});
