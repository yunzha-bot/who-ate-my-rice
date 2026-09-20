import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';

test('3D actor remains inside the room bounds', () => {
  const world = new CollisionWorld(5, 4, []);
  const start = new Vector3(4.5, 0.35, 0);
  assert.equal(world.move(start, 1, 0, 1, 0.7).x, 4.5);
  assert.equal(world.move(start, 0, 1, 1, 0.7).z, 1);
});

test('Box3 wall blocks crossing and allows sliding along its edge', () => {
  const wall = new Box3(new Vector3(-0.5, 0, -2), new Vector3(0.5, 1, 2));
  const world = new CollisionWorld(5, 4, [wall]);
  const start = new Vector3(-1, 0.35, 0);
  const next = world.move(start, 0.8, 0.5, 0.6, 0.7);
  assert.equal(next.x, -1);
  assert.equal(next.z, 0.5);
});
