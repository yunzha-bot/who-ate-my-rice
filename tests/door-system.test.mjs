import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { DoorSystem, distanceToDoorSegment, doorIntersectsActor }
  from '../src/systems/DoorSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { LocalControl } from '../src/three/LocalControl.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';

const nodes = DOOR_NODES.slice(0, 4);
const system = () => new DoorSystem(nodes, GAME_CONFIG.door.maxActiveLocks);

test('door state machine allows normal open/close for both factions', () => {
  const doors = system();
  const first = nodes[0].id;
  assert.equal(doors.get(first).state, 'CLOSED');
  assert.equal(doors.toggle(first, 'HUMAN'), 'OPENED');
  assert.equal(doors.get(first).state, 'OPEN');
  assert.equal(doors.toggle(first, 'DEEPSEEK'), 'CLOSED');
  assert.equal(doors.get(first).state, 'CLOSED');
});

test('only DeepSeek can lock a closed door and locked doors reject normal toggle', () => {
  const doors = system();
  const first = nodes[0].id;
  assert.equal(doors.lock(first, 'HUMAN'), 'NOT_ALLOWED');
  assert.equal(doors.toggle(first, 'HUMAN'), 'OPENED');
  assert.equal(doors.lock(first, 'DEEPSEEK'), 'INVALID_STATE');
  assert.equal(doors.toggle(first, 'DEEPSEEK'), 'CLOSED');
  assert.equal(doors.lock(first, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.get(first).state, 'LOCKED');
  assert.equal(doors.get(first).locked, true);
  assert.equal(doors.toggle(first, 'DEEPSEEK'), 'INVALID_STATE');
  assert.equal(doors.toggle(first, 'HUMAN'), 'INVALID_STATE');
});

test('three active locks are retained and a fourth lock is rejected without replacement', () => {
  const doors = system();
  for (const node of nodes.slice(0, 3)) assert.equal(doors.lock(node.id, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.activeLockedDoorCount, 3);
  assert.equal(doors.lock(nodes[3].id, 'DEEPSEEK'), 'LOCK_LIMIT_REACHED');
  assert.equal(doors.activeLockedDoorCount, 3);
  assert.deepEqual(doors.doors.slice(0, 3).map(door => door.state),
    ['LOCKED', 'LOCKED', 'LOCKED']);
  assert.equal(doors.get(nodes[3].id).state, 'CLOSED');
});

test('reset restores every initial state and all lock resources', () => {
  const doors = system();
  doors.lock(nodes[0].id, 'DEEPSEEK');
  doors.toggle(nodes[1].id, 'HUMAN');
  doors.reset();
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.deepEqual(doors.doors.map(door => door.state), nodes.map(door => door.initialState));
  assert.ok(doors.doors.every(door => !door.locked && door.lockCoreState === 'ACTIVE'));
});

test('nearest interaction uses the door segment rather than only its center', () => {
  const doors = system();
  const door = nodes[0];
  const x = door.rotation === 0 ? door.x + door.width / 2 : door.x + 0.2;
  const z = door.rotation === 0 ? door.z + 0.2 : door.z + door.width / 2;
  assert.ok(distanceToDoorSegment(x, z, door) < 0.3);
  assert.equal(doors.nearest(x, z, 0.4)?.door.id, door.id);
});

test('closing safety rejects a door leaf that would overlap either actor', () => {
  const doors = system();
  const door = nodes[0];
  doors.toggle(door.id, 'HUMAN');
  assert.equal(doorIntersectsActor(door, door.x, door.z, 0.27,
    GAME_CONFIG.door.leafThickness), true);
  assert.equal(doors.toggle(door.id, 'HUMAN', false), 'BLOCKED_BY_ACTOR');
  assert.equal(doors.get(door.id).state, 'OPEN');
  assert.equal(doors.toggle(door.id, 'HUMAN', true), 'CLOSED');
});

test('door view rotates around its hinge and keeps lock core separate from the leaf', () => {
  const doors = system();
  const door = nodes[0];
  const view = new DoorView(door, 0, false);
  const scene = new Scene();
  scene.add(view.object);
  const closedCenter = new Vector3();
  view.leaf.getWorldPosition(closedCenter);
  doors.toggle(door.id, 'DEEPSEEK');
  view.sync(doors.get(door.id));
  view.object.updateMatrixWorld(true);
  const openCenter = new Vector3();
  view.leaf.getWorldPosition(openCenter);
  assert.notDeepEqual(openCenter.toArray(), closedCenter.toArray());
  assert.equal(view.lockCore.visible, false);
  doors.toggle(door.id, 'DEEPSEEK');
  doors.lock(door.id, 'DEEPSEEK');
  view.sync(doors.get(door.id));
  assert.equal(view.lockCore.visible, true);
  assert.notEqual(view.lockCore, view.leaf);
  assert.ok(view.lockCoreWorldPosition().distanceTo(view.object.position) > 0);
  view.dispose();
});

test('disabled lock core stays visible and dim while the door remains closed', () => {
  const doors = system();
  const door = nodes[0];
  const view = new DoorView(door, 0, false);
  doors.lock(door.id, 'DEEPSEEK');
  assert.equal(doors.disableLock(door.id, 'HUMAN'), 'UNLOCKED');
  view.sync(doors.get(door.id));
  assert.equal(doors.get(door.id).state, 'CLOSED');
  assert.equal(doors.get(door.id).lockCoreState, 'DISABLED');
  assert.equal(view.lockCore.visible, true);
  assert.equal(view.lockCore.material.emissiveIntensity, 0);
  view.dispose();
});

test('open door is passable while closed and locked states share dynamic collision', () => {
  const doors = system();
  const door = nodes[0];
  const view = new DoorView(door, 0, false);
  const world = new CollisionWorld(30, 30, []);
  const actorRadius = GAME_CONFIG.collision.playerRadius;
  const start = door.rotation === 0
    ? new Vector3(door.x, 0.35, door.z - 0.7)
    : new Vector3(door.x - 0.7, 0.35, door.z);
  const delta = door.rotation === 0 ? [0, 1.4] : [1.4, 0];

  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  const closedMove = world.move(start, delta[0], delta[1], actorRadius, 0.7);
  assert.ok(closedMove.distanceTo(start) < 0.6);
  doors.toggle(door.id, 'HUMAN');
  world.setDynamicObstacle(door.id, null);
  const openMove = world.move(start, delta[0], delta[1], actorRadius, 0.7);
  assert.ok(openMove.distanceTo(start) > 1.2);
  doors.toggle(door.id, 'DEEPSEEK');
  doors.lock(door.id, 'DEEPSEEK');
  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  const lockedMove = world.move(start, delta[0], delta[1], actorRadius, 0.7);
  assert.ok(lockedMove.distanceTo(start) < 0.6);
  view.dispose();
});

test('closed and locked doors block capture lines while open doors do not', () => {
  const doors = system();
  const door = nodes[0];
  const view = new DoorView(door, 0, false);
  const world = new CollisionWorld(30, 30, []);
  const offset = 0.3;
  const first = door.rotation === 0
    ? new Vector3(door.x, 0.35, door.z - offset)
    : new Vector3(door.x - offset, 0.35, door.z);
  const second = door.rotation === 0
    ? new Vector3(door.x, 0.35, door.z + offset)
    : new Vector3(door.x + offset, 0.35, door.z);
  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  assert.equal(world.isLineBlockedXZ(first, second), true);
  doors.toggle(door.id, 'HUMAN');
  world.setDynamicObstacle(door.id, null);
  assert.equal(world.isLineBlockedXZ(first, second), false);
  doors.toggle(door.id, 'DEEPSEEK');
  doors.lock(door.id, 'DEEPSEEK');
  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  assert.equal(world.isLineBlockedXZ(first, second), true);
  view.dispose();
});

test('sprint collision cannot tunnel through a door or end committed sprint early', () => {
  const door = nodes[0];
  const view = new DoorView(door, 0, false);
  const world = new CollisionWorld(30, 30, []);
  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  const sprint = new SprintSystem(2500, 0.3, 1000);
  const direction = door.rotation === 0 ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const start = door.rotation === 0
    ? new Vector3(door.x, 0.35, door.z - 0.7)
    : new Vector3(door.x - 0.7, 0.35, door.z);
  assert.equal(sprint.tryStart(direction, 0.5), true);
  sprint.advance(300, direction);
  const moved = world.move(start, direction.x * 2, direction.y * 2,
    GAME_CONFIG.collision.playerRadius, 0.7);
  assert.ok(moved.distanceTo(start) < 0.6);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  assert.equal(sprint.sprintRemainingMs, 2200);
  view.dispose();
});

test('Tab-style controlled faction switch preserves door state and formal selection', () => {
  const doors = system();
  const control = new LocalControl();
  control.choose('DEEPSEEK');
  doors.lock(nodes[0].id, control.controlledFaction);
  control.toggleControlled();
  assert.equal(control.selectedFaction, 'DEEPSEEK');
  assert.equal(control.controlledFaction, 'HUMAN');
  assert.equal(doors.get(nodes[0].id).state, 'LOCKED');
  doors.reset();
  assert.equal(doors.activeLockedDoorCount, 0);
});
