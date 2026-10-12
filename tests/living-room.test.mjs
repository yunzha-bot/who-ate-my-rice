import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Mesh, BoxGeometry, MeshStandardMaterial, Vector3 } from 'three';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { FURNITURE, HIDE_SPOTS, WALLS, MAP_WIDTH, MAP_DEPTH, DOOR_NODES } from '../src/three/map/apartmentMap.ts';
import { MapEditSession, validateEditedMap, rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('living appliances stay inside their collision footprint and merge to one detail draw', () => {
  for (const id of ['living_tv_cabinet', 'living_standing_ac', 'living_water_dispenser', 'living_lounge_table']) {
    const rect = FURNITURE.find(f => f.id === id);
    assert.ok(rect);
    const mesh = new Mesh(new BoxGeometry(rect.width, rect.height, rect.depth), new MeshStandardMaterial());
    dressFurniture(mesh, rect);
    assert.equal(mesh.children.length, 1, id);
    const bounds = new Box3().setFromObject(mesh.children[0]);
    assert.ok(bounds.min.x >= -rect.width / 2 - .01 && bounds.max.x <= rect.width / 2 + .01, id);
    assert.ok(bounds.min.z >= -rect.depth / 2 - .01 && bounds.max.z <= rect.depth / 2 + .01, id);
  }
});

test('living seating, appliances and preserved sofa hide point remain reachable with the actor collider', () => {
  const session = new MapEditSession();
  assert.deepEqual(validateEditedMap(session.furnitureList(), session.hideSpotList()), []);
  const colliders = rectColliders([...WALLS, ...FURNITURE]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, colliders.boxes, colliders.oriented);
  const nav = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const radius = GAME_CONFIG.collision.playerRadius, height = GAME_CONFIG.three.actorHeight;
  const goals = [{x:-1,z:-7.3}, {x:3.6,z:-7.3}, {x:3.6,z:-11.3}, {x:6.6,z:-9.3},
    HIDE_SPOTS.find(s => s.id === 'hide_living_sofa')];
  for (const goal of goals) {
    assert.ok(world.canOccupyStaticXZ(goal.x, goal.z, radius, height));
    const path = nav.findPath({x:0,z:0}, goal, []);
    assert.ok(path?.length, JSON.stringify(goal));
    let position = new Vector3(0, height / 2, 0);
    for (const step of path) {
      const distance = Math.hypot(step.x-position.x, step.z-position.z);
      const count = Math.max(1, Math.ceil(distance / .06));
      const dx = (step.x-position.x)/count, dz = (step.z-position.z)/count;
      for (let i=0;i<count;i++) position = world.move(position, dx, dz, radius, height);
      assert.ok(Math.hypot(position.x-step.x, position.z-step.z) < .03, 'path blocked by collision');
    }
  }
});
