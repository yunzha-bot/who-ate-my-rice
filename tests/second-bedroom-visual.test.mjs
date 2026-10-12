import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { FURNITURE, WALLS, MAP_WIDTH, MAP_DEPTH, HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { STORAGE_VISUAL_ROLES } from '../src/three/StorageFurnitureVisual.ts';
import { readFileSync } from 'node:fs';
import { distanceToRect } from '../src/three/map/RotatedRect.ts';

test('second bedroom details reuse one batch and preserve authored transforms/proxies', () => {
  const before = JSON.stringify([FURNITURE, HIDE_SPOTS]);
  for (const id of ['second_wardrobe', 'second_cabinet', 'second_desk', 'second_study_chair',
    'second_bed', 'second_nightstand']) {
    const r = FURNITURE.find(r => r.id === id);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(r.width, r.height, r.depth),
      new THREE.MeshStandardMaterial());
    mesh.position.set(r.x, r.height / 2, r.z); mesh.rotation.y = r.rotation;
    mesh.updateMatrix(); const matrix = mesh.matrix.clone(), proxy = mesh.geometry;
    dressFurniture(mesh, r); mesh.updateMatrix();
    assert.equal(mesh.geometry, proxy);
    assert.deepEqual(mesh.matrix.elements, matrix.elements);
    assert.equal(mesh.children.length, 1);
    const geometry = mesh.children[0].geometry;
    assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
    geometry.computeBoundingBox(); const b = geometry.boundingBox;
    // Only the thin non-colliding bedside rug intentionally extends beyond the bed.
    if (id !== 'second_bed' && id !== 'second_nightstand') {
      assert.ok(b.min.x >= -r.width / 2 - 1e-5 && b.max.x <= r.width / 2 + 1e-5, id);
      assert.ok(b.min.z >= -r.depth / 2 - 1e-5 && b.max.z <= r.depth / 2 + 1e-5, id);
    }
    geometry.dispose(); mesh.children[0].material.dispose(); proxy.dispose(); mesh.material.dispose();
  }
  assert.equal(STORAGE_VISUAL_ROLES.second_cabinet, 'books');
  assert.equal(JSON.stringify([FURNITURE, HIDE_SPOTS]), before);
});

test('new chair is persisted beside the existing desk, leaving rice, hide and main aisle clear', () => {
  const chair = FURNITURE.find(r => r.id === 'second_study_chair');
  const saved = JSON.parse(readFileSync(new URL('../src/three/map/sceneLayout.json', import.meta.url), 'utf8'));
  const savedChair = saved.furniture.find(r => r.id === chair.id);
  assert.deepEqual([chair.x, chair.z], [savedChair.x, savedChair.z]);
  assert.deepEqual([chair.width, chair.depth], [.6, .55]);
  const desk = FURNITURE.find(r => r.id === 'second_desk');
  assert.ok(distanceToRect(chair, desk) > 0, 'chair must not overlap desk');
  assert.ok(distanceToRect(chair, desk) < 1, 'chair must remain beside desk');
  const c = rectColliders([...WALLS, ...FURNITURE]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, c.boxes, c.oriented);
  const radius = GAME_CONFIG.collision.playerRadius;
  for (const p of [{x: -18, z: 16}, {x: -24.9, z: 16.3}, {x: -20, z: 15},
    {x: -19.8, z: 17.65}, {x: -18.2, z: 17.65}])
    assert.ok(world.canOccupyStaticXZ(p.x, p.z, radius, 1), JSON.stringify(p));
  // Unobstructed cross-room chase aisle, including the approach to the study door.
  for (let x = -24; x <= -15; x += .2)
    assert.ok(world.canOccupyStaticXZ(x, 15, radius, 1), `aisle ${x}`);
});
