import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { DeepSeekAIController, shouldRunDeepSeekAI } from '../src/systems/DeepSeekAIController.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { CollisionWorld, canInteractWithDoorXZ } from '../src/three/CollisionWorld.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { DOOR_NODES, FURNITURE, MAP_DEPTH, MAP_WIDTH, RICE_CANDIDATES,
  SPAWNS, WALLS } from '../src/three/map/apartmentMap.ts';

const rice = (id, x, z, progressMs = 0, completed = false) =>
  ({ id, x, z, progressMs, maxProgressMs: C.rice.maxProgressMs, completed });
const input = (deepseek, portions, doors = []) => ({
  deltaMs: 50, deepseek, rice: portions, doors, canOpenDoor: () => true,
});

function apartment() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  for (const node of DOOR_NODES) {
    if (doors.get(node.id).state === 'OPEN') continue;
    const alongX = Math.abs(Math.sin(node.rotation)) < 0.5;
    const width = alongX ? node.width : C.door.leafThickness;
    const depth = alongX ? C.door.leafThickness : node.width;
    world.setDynamicObstacle(node.id, new Box3(
      new Vector3(node.x - width / 2, 0, node.z - depth / 2),
      new Vector3(node.x + width / 2, C.three.wallHeight, node.z + depth / 2)));
  }
  const nav = new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  return { world, doors, nav };
}

test('DeepSeek AI chooses shortest estimated completion, excluding completed rice', () => {
  const nav = { findPath(start, goal) {
    return [{ x: start.x, z: start.z, doorId: null },
      { x: goal.x, z: goal.z, doorId: null }];
  } };
  const ai = new DeepSeekAIController(nav, []);
  const portions = [rice('near', 2, 0), rice('partial', 5, 0, 4_000),
    rice('done', 0.5, 0, 5_000, true)];
  ai.update(input({ x: 0, z: 0 }, portions));
  assert.equal(ai.targetRiceId, 'partial');
  assert.ok(ai.targetScoreMs > 0);
  assert.ok(ai.targetScoreMs < 5_000);
  portions[1].completed = true;
  ai.update(input({ x: 0, z: 0 }, portions));
  assert.equal(ai.targetRiceId, 'near');
  assert.match(ai.lastSelectionReason, /TARGET_COMPLETED_OR_MISSING/);
});

test('DeepSeek AI waits when all goals are unreachable, then retries after door change', () => {
  let reachable = false;
  const nav = { findPath(start, goal) {
    return reachable ? [{ x: start.x, z: start.z, doorId: null },
      { x: goal.x, z: goal.z, doorId: null }] : null;
  } };
  const ai = new DeepSeekAIController(nav, []);
  const portions = [rice('one', 2, 0)];
  assert.equal(ai.update(input({ x: 0, z: 0 }, portions)).eatRiceId, null);
  assert.equal(ai.state, 'RESELECT');
  reachable = true;
  ai.update(input({ x: 0, z: 0 }, portions));
  assert.equal(ai.targetRiceId, null, 'retry interval prevents frame-by-frame pathfinding');
  ai.update({ ...input({ x: 0, z: 0 }, portions), deltaMs: C.deepseekAI.retryMs });
  assert.equal(ai.targetRiceId, 'one');
});

test('DeepSeek AI obeys phase, formal faction and temporary manual takeover', () => {
  const normal = ['PLAYING', 'HUMAN', 'HUMAN', { x: 0, y: 0 }, true];
  assert.equal(shouldRunDeepSeekAI(...normal), true);
  assert.equal(shouldRunDeepSeekAI('PAUSED', ...normal.slice(1)), false);
  assert.equal(shouldRunDeepSeekAI('FINISHED', ...normal.slice(1)), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'DEEPSEEK', 'DEEPSEEK',
    { x: 0, y: 0 }, true), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'HUMAN', 'DEEPSEEK',
    { x: 0, y: 0 }, true), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'HUMAN', 'HUMAN',
    { x: 1, y: 0 }, true), false);
  assert.equal(shouldRunDeepSeekAI('PLAYING', 'HUMAN', 'HUMAN',
    { x: 1, y: 0 }, false), true);
});

test('a stationary collision stall triggers repathing then selects another rice', () => {
  const nav = { findPath(start, goal) {
    return [{ x: start.x, z: start.z, doorId: null },
      { x: goal.x, z: goal.z, doorId: null }];
  } };
  const ai = new DeepSeekAIController(nav, []);
  const portions = [rice('blocked', 2, 0), rice('alternate', 8, 0)];
  const start = { x: 0, z: 0 };
  ai.update(input(start, portions));
  assert.equal(ai.targetRiceId, 'blocked');
  let choseAlternate = false;
  for (let frame = 0; frame < 50; frame++) {
    ai.update(input(start, portions));
    if (ai.targetRiceId === 'alternate') { choseAlternate = true; break; }
  }
  assert.equal(choseAlternate, true);
  assert.match(ai.lastSelectionReason, /PATH_STALLED_RESELECT/);
});

test('AI rice intent uses existing preparation, retained progress and reset rules', () => {
  const field = new RiceField(['one'], C.rice.maxProgressMs, C.rice.prepareMs);
  const ai = new DeepSeekAIController({ findPath: () =>
    [{ x: 0, z: 0, doorId: null }] }, []);
  const position = { x: 0, z: 0 };
  const portions = () => [rice('one', 0, 0, field.states[0].progressMs,
    field.states[0].completed)];
  const command = ai.update(input(position, portions()));
  assert.equal(command.eatRiceId, 'one');
  field.update(C.rice.prepareMs, command.eatRiceId, true);
  assert.equal(field.states[0].progressMs, 0);
  field.update(1_000, command.eatRiceId, true);
  assert.equal(field.states[0].progressMs, 1_000);
  field.interrupt();
  field.update(C.rice.prepareMs, command.eatRiceId, true);
  assert.equal(field.states[0].progressMs, 1_000);
  field.update(C.rice.maxProgressMs, command.eatRiceId, true);
  assert.equal(field.completed, true);
  ai.reset();
  field.reset();
  assert.equal(ai.state, 'SEEK_RICE');
  assert.equal(ai.targetRiceId, null);
  assert.equal(field.states[0].progressMs, 0);
});

test('DeepSeek AI navigates the apartment, opens ordinary doors, and wins on five rice', () => {
  const { world, doors, nav } = apartment();
  const ai = new DeepSeekAIController(nav, DOOR_NODES);
  const active = RICE_CANDIDATES.slice(0, 5);
  const field = new RiceField(active.map(point => point.id),
    C.rice.maxProgressMs, C.rice.prepareMs);
  const match = new GameStateSystem(0, C.match.captureMs);
  match.advanceReady(0);
  const actor = new Vector3(SPAWNS.deepseek.x, C.three.actorHeight / 2,
    SPAWNS.deepseek.z);
  const opened = [];
  for (let frame = 0; frame < 5_000 && !field.completed; frame++) {
    const portions = field.states.map(state => {
      const point = active.find(candidate => candidate.id === state.id);
      return rice(state.id, point.x, point.z, state.progressMs, state.completed);
    });
    const command = ai.update({
      deltaMs: 50, deepseek: actor, rice: portions, doors: doors.doors,
      canOpenDoor: id => canInteractWithDoorXZ(world, actor,
        doors.definition(id)),
    });
    if (command.openDoorId) {
      assert.equal(doors.toggle(command.openDoorId, 'DEEPSEEK'), 'OPENED');
      world.setDynamicObstacle(command.openDoorId, null);
      opened.push(command.openDoorId);
    }
    const speed = C.player.speed / C.three.pixelsPerUnit;
    actor.copy(world.move(actor, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    const target = active.find(point => point.id === command.eatRiceId);
    const inRange = !!target && Math.hypot(actor.x - target.x, actor.z - target.z) <=
      C.rice.interactionRange / C.three.pixelsPerUnit;
    field.update(50, inRange ? command.eatRiceId : null, inRange);
    match.advancePlaying(50, false, field.completed);
    assert.equal(world.canOccupyStaticXZ(actor.x, actor.z, C.collision.playerRadius,
      C.three.actorHeight), true);
  }
  assert.equal(field.completedCount, 5,
    'AI should reach and finish all five activated rice portions');
  assert.equal(match.result?.winner, 'DEEPSEEK');
  assert.ok(opened.length > 0, 'AI should open at least one ordinary closed door');
});

test('locked door remains blocked while DeepSeek routes through another door', () => {
  const { world, doors, nav } = apartment();
  assert.equal(doors.lock('door_living_kitchen', 'DEEPSEEK'), 'LOCKED');
  const target = RICE_CANDIDATES.find(point => point.id === 'rice_02');
  const ai = new DeepSeekAIController(nav, DOOR_NODES);
  const actor = new Vector3(SPAWNS.human.x, C.three.actorHeight / 2,
    SPAWNS.human.z);
  let arrived = false;
  for (let frame = 0; frame < 900; frame++) {
    const command = ai.update({
      deltaMs: 50, deepseek: actor, rice: [rice(target.id, target.x, target.z)],
      doors: doors.doors,
      canOpenDoor: id => canInteractWithDoorXZ(world, actor,
        doors.definition(id)),
    });
    assert.notEqual(command.openDoorId, 'door_living_kitchen');
    if (command.openDoorId) {
      assert.equal(doors.toggle(command.openDoorId, 'DEEPSEEK'), 'OPENED');
      world.setDynamicObstacle(command.openDoorId, null);
    }
    const speed = C.player.speed / C.three.pixelsPerUnit;
    actor.copy(world.move(actor, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, C.collision.playerRadius,
      C.three.actorHeight));
    if (command.eatRiceId === target.id) { arrived = true; break; }
  }
  assert.equal(arrived, true);
  assert.equal(doors.get('door_living_kitchen').state, 'LOCKED');
});
