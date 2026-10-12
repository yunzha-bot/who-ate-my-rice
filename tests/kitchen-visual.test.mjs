import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE, WALLS, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('kitchen counter and old island form a continuous wall run, not an island', () => {
  const sink = FURNITURE.find(r => r.id === 'kitchen_counter');
  const hob = FURNITURE.find(r => r.id === 'kitchen_island');
  assert.equal(sink.x, hob.x); assert.equal(sink.width, hob.width);
  assert.equal(sink.height, hob.height);
  assert.ok(sink.x - sink.width / 2 > 8 && sink.x + sink.width / 2 < 9.1);
  assert.ok(Math.abs(sink.z + sink.depth / 2 - (hob.z - hob.depth / 2)) < 1e-8);
  assert.equal(HIDE_SPOTS.filter(s => s.roomId === 'kitchen').length, 0);
});

test('kitchen solid details preserve editor proxies and batch within saved footprints', () => {
  const authored = JSON.stringify(FURNITURE);
  for (const id of ['kitchen_counter', 'kitchen_island', 'kitchen_fridge']) {
    const r = FURNITURE.find(r => r.id === id);
    const root = new THREE.Mesh(new THREE.BoxGeometry(r.width, r.height, r.depth), new THREE.MeshStandardMaterial());
    root.position.set(r.x, r.height / 2, r.z); root.rotation.y = r.rotation;
    root.updateMatrix(); const m = root.matrix.clone(), proxy = root.geometry;
    dressFurniture(root, r); root.updateMatrix();
    assert.equal(root.geometry, proxy); assert.deepEqual(root.matrix.elements, m.elements);
    assert.equal(root.material.opacity, 0); assert.equal(root.children.length, 1);
    const detail = root.children[0]; detail.geometry.computeBoundingBox();
    const b = detail.geometry.boundingBox;
    assert.ok(b.min.x >= -r.width / 2 - 1e-5 && b.max.x <= r.width / 2 + 1e-5, id);
    assert.ok(b.min.z >= -r.depth / 2 - 1e-5 && b.max.z <= r.depth / 2 + 1e-5, id);
    assert.ok([...detail.geometry.attributes.position.array].every(Number.isFinite));
    detail.geometry.dispose(); detail.material.dispose(); root.geometry.dispose(); root.material.dispose();
  }
  assert.equal(JSON.stringify(FURNITURE), authored);
});

test('kitchen central routes, rice and all five doorway approaches stay clear', () => {
  const c = rectColliders([...WALLS, ...FURNITURE]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, c.boxes, c.oriented);
  const clear = (x, z) => world.canOccupyStaticXZ(x, z, GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
  assert.ok(clear(11, -5.5), 'rice_06');
  for (let z = -14.8; z <= -2.6; z += .2) assert.ok(clear(12, z), `main aisle ${z}`);
  for (const door of DOOR_NODES.filter(d => d.connectedRoomA === 'kitchen' || d.connectedRoomB === 'kitchen')) {
    const x = door.rotation ? door.x + (door.x === 8 ? .8 : -.8) : door.x;
    const z = door.rotation ? door.z : door.z + (door.z < -10 ? .8 : -.8);
    assert.ok(clear(x, z), door.id);
  }
});
