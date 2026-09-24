import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const rice = { id: 'rice_06', x: 10, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const human = { x: 9, z: 1 };
const doors = [{ id: 'kitchen_entry', nodeId: 'kitchen_entry', state: 'OPEN',
  locked: false, lockCoreState: 'ACTIVE' }];
const step = (point, doorId = null) => ({ x: point.x, z: point.z, doorId });
const nav = {
  nearestFree: point => ({ x: point.x, z: point.z }),
  findPath: (from, to, _doors, _avoid, _cost, _blocked, avoidCircle) => {
    if (avoidCircle && Math.hypot(to.x - avoidCircle.center.x,
      to.z - avoidCircle.center.z) < avoidCircle.radius) return null;
    return to.x === rice.x ? [step(from), step({ x: 8, z: 0 }, 'kitchen_entry'), step(to)] :
      [step(from), step(to)];
  },
};
const ai = () => new DeepSeekAIController(nav, [], [{ id: 'safe', x: -5, z: 0 }], () => 0);
const input = (deepseek, extra = {}) => ({ deltaMs: 50, deepseek, rice: [rice],
  doors, canOpenDoor: () => true, sprintState: 'NORMAL', captureProgressMs: 0,
  ...extra });

function failAtSameEntrance(controller, extra = {}) {
  controller.update(input({ x: 8, z: 0 }, { ...extra, visibleHuman: human }));
  assert.equal(controller.state, 'EVADE');
  controller.update(input({ x: -5, z: 0 }, { ...extra, deltaMs: 2_000 }));
}

test('repeated danger at the same rice entrance stops the three-second reselection loop', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  assert.equal(controller.targetRiceId, rice.id);
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  assert.equal(controller.safeWaitRiceId, rice.id);
  assert.equal(controller.safeWaitEntryId, 'kitchen_entry');
  assert.equal(controller.safeWaitFailureCount, C.deepseekAI.safeWaitFailureThreshold);
  for (let elapsed = 0; elapsed < C.deepseekAI.dangerRiceAvoidMs * 4;
    elapsed += C.deepseekAI.safeWaitRecheckMs) {
    controller.update(input({ x: -5, z: 0 },
      { deltaMs: C.deepseekAI.safeWaitRecheckMs }));
    assert.equal(controller.state, 'SAFE_WAIT');
    assert.equal(controller.targetRiceId, null);
  }
});

test('trusted Human departure and new stillness event release SAFE_WAIT for a retry', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }, { visibleHuman: human,
    humanStillMs: 0, humanStillEventId: 1 }));
  failAtSameEntrance(controller);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  controller.update(input({ x: -5, z: 0 }, { visibleHuman: { x: -1, z: 8 },
    humanStillMs: 0, humanStillEventId: 2 }));
  assert.notEqual(controller.state, 'SAFE_WAIT');
  assert.equal(controller.safeWaitFailureCount, 0);
});

test('restart and completed or actively eaten rice clear dangerous-entry memory', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  assert.equal(controller.safeWaitFailureCount, 1);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: 2_000 }));
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  controller.update(input({ x: rice.x, z: rice.z }));
  assert.equal(controller.state, 'EAT');
  assert.equal(controller.safeWaitFailureCount, 0);
  controller.reset();
  assert.equal(controller.safeWaitFailureCount, 0);
});

test('a door change retries a previously failed safe passage without another chance draw', () => {
  let chanceDraws = 0;
  const route = { ...nav, findPath(from, to, states, avoid, cost, blocked, circle) {
    if (!circle) return nav.findPath(from, to, states, avoid, cost, blocked);
    if (states[0]?.state !== 'OPEN') return null;
    return [step(from), step({ x: 0, z: -3 }), step({ x: 7, z: -3 }), step(to)];
  } };
  const controller = new DeepSeekAIController(route, [],
    [{ id: 'safe', x: -5, z: 0 }], () => { chanceDraws++; return 0; });
  const closed = [{ ...doors[0], state: 'CLOSED' }];
  const seen = { visibleHuman: human, humanStillMs: 8_000, humanStillEventId: 1 };
  controller.update(input({ x: 0, z: 0 }, { doors: closed, ...seen }));
  assert.equal(controller.passageRollResult, 'NO_SAFE_ROUTE');
  controller.update(input({ x: 8, z: 0 }, { doors: closed, ...seen }));
  controller.update(input({ x: -5, z: 0 }, { doors: closed, deltaMs: 2_000 }));
  controller.update(input({ x: -5, z: 0 }, { doors: closed,
    deltaMs: C.deepseekAI.dangerRiceAvoidMs + C.deepseekAI.retryMs +
      C.deepseekAI.recoverMs }));
  controller.update(input({ x: 8, z: 0 }, { doors: closed, ...seen }));
  controller.update(input({ x: -5, z: 0 }, { doors: closed, deltaMs: 2_000 }));
  assert.equal(controller.state, 'SAFE_WAIT');
  const before = chanceDraws;
  controller.update(input({ x: -5, z: 0 }, { doors, ...seen }));
  assert.equal(controller.state, 'CURIOUS_APPROACH');
  assert.equal(controller.passageActive, true);
  assert.equal(chanceDraws, before, 'the same stillness event must not reroll');
});

test('completed last rice clears SAFE_WAIT and a later match starts clean', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  controller.update(input({ x: -5, z: 0 },
    { rice: [{ ...rice, completed: true, progressMs: rice.maxProgressMs }] }));
  assert.equal(controller.state, 'RESELECT');
  assert.equal(controller.safeWaitRiceId, null);
  assert.equal(controller.safeWaitFailureCount, 0);
  controller.reset();
  assert.equal(controller.state, 'SEEK_RICE');
  assert.equal(controller.safeWaitRiceId, null);
});

test('a trusted visible Human relocation releases SAFE_WAIT once the rice route is clear', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  controller.update(input({ x: -5, z: 0 }, {
    visibleHuman: { x: 20, z: 10 },
    deltaMs: C.deepseekAI.safeWaitRecheckMs,
  }));
  assert.equal(controller.state, 'MOVE_TO_RICE');
  assert.equal(controller.targetRiceId, rice.id);
  assert.equal(controller.safeWaitFailureCount, 0);
});

test('SAFE_WAIT on one rice still selects another newly reachable safe rice', () => {
  const alternate = { ...rice, id: 'other', x: -10, z: 0 };
  const portions = [rice, alternate];
  let alternateReachable = false;
  const navigation = { ...nav, findPath(from, to, ...rest) {
    return to.id === alternate.id && !alternateReachable ? null :
      nav.findPath(from, to, ...rest);
  } };
  const controller = new DeepSeekAIController(navigation, [],
    [{ id: 'safe', x: -5, z: 0 }], () => 0);
  controller.update(input({ x: 0, z: 0 }, { rice: portions }));
  failAtSameEntrance(controller, { rice: portions });
  controller.update(input({ x: -5, z: 0 }, { rice: portions,
    deltaMs: C.deepseekAI.dangerRiceAvoidMs + C.deepseekAI.retryMs +
      C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller, { rice: portions });
  assert.equal(controller.state, 'SAFE_WAIT');
  alternateReachable = true;
  controller.update(input({ x: -5, z: 0 }, { rice: portions,
    deltaMs: C.deepseekAI.safeWaitRecheckMs }));
  assert.equal(controller.state, 'MOVE_TO_RICE');
  assert.equal(controller.targetRiceId, alternate.id);
  assert.equal(controller.safeWaitRiceId, rice.id);
});

test('dangerous-entry failures are counted separately for different doors', () => {
  let entrance = 'entry_a';
  const navigation = { ...nav, findPath(from, to, ...rest) {
    const path = nav.findPath(from, to, ...rest);
    if (path && to.id === rice.id) path[1].doorId = entrance;
    return path;
  } };
  const controller = new DeepSeekAIController(navigation, [],
    [{ id: 'safe', x: -5, z: 0 }], () => 0);
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  entrance = 'entry_b';
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.safeWaitRiceId, null);
  assert.equal(controller.safeWaitFailureCount, 1);
  entrance = 'entry_a';
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  assert.equal(controller.safeWaitEntryId, 'entry_a');
});

test('SAFE_WAIT never moves while the existing sprint system reports stun', () => {
  const controller = ai();
  controller.update(input({ x: 0, z: 0 }));
  failAtSameEntrance(controller);
  controller.update(input({ x: -5, z: 0 }, { deltaMs: C.deepseekAI.dangerRiceAvoidMs +
    C.deepseekAI.retryMs + C.deepseekAI.recoverMs }));
  failAtSameEntrance(controller);
  assert.equal(controller.state, 'SAFE_WAIT');
  const command = controller.update(input({ x: -5, z: 0 }, {
    sprintState: 'STUNNED', deltaMs: C.deepseekAI.safeWaitRecheckMs }));
  assert.equal(controller.state, 'SAFE_WAIT');
  assert.deepEqual(command.direction, { x: 0, z: 0 });
  assert.equal(controller.noMovementReason, 'STUNNED');
});
