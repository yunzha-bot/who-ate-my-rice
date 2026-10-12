import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE, WALLS, ROOMS, DOOR_NODES, MAP_WIDTH, MAP_DEPTH } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('six persisted balcony additions stay in the balcony and batch inside their footprints', () => {
  const room = ROOMS.find(r => r.id === 'balcony');
  const additions = FURNITURE.filter(r => r.id.startsWith('balcony_life_'));
  assert.equal(additions.length, 6);
  for (const r of additions) {
    assert.ok(r.x - r.width / 2 > room.minX && r.x + r.width / 2 < room.maxX);
    assert.ok(r.z - r.depth / 2 > room.minZ && r.z + r.depth / 2 < room.maxZ);
    const root = new THREE.Mesh(new THREE.BoxGeometry(r.width, r.height, r.depth), new THREE.MeshStandardMaterial());
    const proxy = root.geometry;
    dressFurniture(root, r);
    assert.equal(root.geometry, proxy); assert.equal(root.material.opacity, 0);
    assert.equal(root.children.length, 1);
    const detail = root.children[0]; detail.geometry.computeBoundingBox();
    const b = detail.geometry.boundingBox;
    assert.ok(b.min.x >= -r.width / 2 - 1e-5 && b.max.x <= r.width / 2 + 1e-5, r.id);
    assert.ok(b.min.z >= -r.depth / 2 - 1e-5 && b.max.z <= r.depth / 2 + 1e-5, r.id);
    assert.ok([...detail.geometry.attributes.position.array].every(Number.isFinite));
    proxy.dispose(); root.material.dispose(); detail.geometry.dispose(); detail.material.dispose();
  }
});

test('balcony chase aisle, rice_01 and all three doors remain navigable', () => {
  const c = rectColliders([...WALLS, ...FURNITURE]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, c.boxes, c.oriented);
  const clear = p => world.canOccupyStaticXZ(p.x, p.z, GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
  for (let x = -6.5; x <= 7.3; x += .2) assert.ok(clear({x,z:-16.2}), `main aisle ${x}`);
  const targets = [{x:4.5,z:-17}, {x:0,z:-14.3}, {x:7.2,z:-14.5}, {x:7.2,z:-17.25}];
  const nav = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  for (const p of targets) {
    assert.ok(clear(p), JSON.stringify(p));
    assert.ok(nav.findPath({x:-6,z:-16.2},p,doors.doors).length > 0, `NPC path ${JSON.stringify(p)}`);
  }
});
