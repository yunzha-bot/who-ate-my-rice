import assert from 'node:assert/strict';
import test from 'node:test';
import { Group } from 'three';
import { WALLS } from '../src/three/map/apartmentMap.ts';
import { CLOSED_EXTERIOR_DOORS, dressClosedExteriorWall } from '../src/three/map/ClosedExteriorDoors.ts';

test('fixed exterior doors replace exactly two wall visuals and retain continuous collision spans', () => {
  const root = new Group();
  const original = JSON.stringify(WALLS);
  const matched = WALLS.filter(wall => dressClosedExteriorWall(root, wall));
  assert.equal(matched.length, 2);
  assert.equal(JSON.stringify(WALLS), original);
  for (const door of CLOSED_EXTERIOR_DOORS) {
    assert.ok(root.getObjectByName(door.id));
    for (const offset of [-door.width / 2, 0, door.width / 2]) {
      assert.ok(matched.some(wall => Math.abs(wall.z - door.z) < .001 &&
        Math.abs(door.x + offset - wall.x) <= wall.width / 2));
    }
  }
});
