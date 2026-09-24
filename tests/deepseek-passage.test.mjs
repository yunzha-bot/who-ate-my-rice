import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController, shouldRunDeepSeekAI } from '../src/systems/DeepSeekAIController.ts';
import { NavigationSystem, distanceToXZSegment } from '../src/systems/NavigationSystem.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const human = { x: 2, z: 0 };
const rice = { id: 'rice-a', x: 4, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const start = { x: 0, z: 0 };
const direct = (from, to) => [{ ...from, doorId: null }, { ...to, doorId: null }];
const detour = (from, to) => [{ ...from, doorId: null },
  { x: 0, z: 2, doorId: null }, { x: 4, z: 2, doorId: null },
  { ...to, doorId: null }];
const nav = {
  nearestFree: point => ({ ...point }),
  findPath: (from, to, _doors, _avoid, _cost, _blocked, avoidCircle) =>
    avoidCircle ? detour(from, to) : direct(from, to),
};
const input = (deepseek = start, visibleHuman = human, extra = {}) => ({
  deltaMs: 50, deepseek, visibleHuman, rice: [rice], doors: [],
  canOpenDoor: () => true, sprintState: 'NORMAL', captureProgressMs: 0,
  humanStillMs: C.deepseekAI.curiosityStillMs, humanStillEventId: 1,
  ...extra,
});
const waitUntilEligible = (ai, makeInput = () => input()) => {
  ai.update(makeInput());
};

test('a visible stationary Human blocking the rice route always gets one safe detour attempt', () => {
  let rolls = 0;
  const ai = new DeepSeekAIController(nav, [], [], () => { rolls++; return 0.79; });
  waitUntilEligible(ai);
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
  assert.equal(ai.passageActive, true);
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  assert.equal(ai.targetRiceId, rice.id);
  assert.equal(ai.passageAvoidRadius,
    C.match.captureRadius + C.deepseekAI.stationaryPassageSafetyMargin);
  assert.notDeepEqual(ai.update(input()).direction, { x: 0, z: 0 });
  const rollsAfterPassage = rolls;
  for (let tick = 0; tick < 10; tick++) ai.update(input());
  assert.equal(rolls, rollsAfterPassage);
  assert.equal(ai.state, 'CURIOUS_APPROACH');
});

test('eight seconds of hidden stillness triggers the safe passage attempt on the first visible frame', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0.99);
  ai.update(input(start, null, { humanStillMs: undefined, humanStillEventId: undefined }));
  ai.update(input(start, human, { humanStillMs: 8_000, humanStillEventId: 4 }));
  assert.equal(ai.curiosityStillMs, 8_000);
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
  assert.equal(ai.passageActive, true);
  assert.equal(ai.state, 'CURIOUS_APPROACH');
});


test('a successful 100% trigger cannot repeat within the same stationary event', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0.80);
  waitUntilEligible(ai);
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
  assert.equal(ai.passageActive, true);
  assert.equal(ai.passageRolledForStillEvent, true);
  for (let tick = 0; tick < 100; tick++) ai.update(input());
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
});

test('occlusion and manual takeover cannot reroll the same stationary Human event', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0.80);
  ai.update(input());
  assert.equal(ai.passageRolledForStillEvent, true);
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
  for (let tick = 0; tick < 5; tick++) {
    ai.update(input(start, null, { humanStillMs: undefined,
      humanStillEventId: undefined }));
    ai.update(input());
    assert.equal(ai.passageRolledForStillEvent, true);
  }
  ai.resumeAfterManualControl();
  ai.update(input());
  assert.equal(ai.passageRolledForStillEvent, true);
  assert.equal(ai.passageRollResult, 'ROLL_PASSED');
});

test('a route with no safe bypass is refused without moving through the capture area', () => {
  const noBypass = { ...nav, findPath: (from, to, doors, avoid, cost, blocked, circle) =>
    circle ? null : direct(from, to) };
  const ai = new DeepSeekAIController(noBypass, [], [], () => 0);
  waitUntilEligible(ai);
  assert.equal(ai.passageRollResult, 'NO_SAFE_ROUTE');
  assert.equal(ai.passageActive, false);
  assert.equal(ai.passageCancelReason, 'NO_REACHABLE_ROUTE_OUTSIDE_CAPTURE_ZONE');
  assert.equal(ai.state, 'EVADE');
});

test('a held passage reaches rice without oscillating into EVADE or entering the capture circle', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0);
  waitUntilEligible(ai);
  let position = { ...start };
  let beganEating = false;
  for (let tick = 0; tick < 150; tick++) {
    const command = ai.update(input(position));
    assert.notEqual(ai.state, 'EVADE');
    assert.equal(ai.passageActive, true);
    assert.ok(Math.hypot(position.x - human.x, position.z - human.z) >=
      ai.passageAvoidRadius);
    if (command.eatRiceId === rice.id) {
      beganEating = true;
      break;
    }
    const step = C.player.speed / C.three.pixelsPerUnit * 0.05;
    position = { x: position.x + command.direction.x * step,
      z: position.z + command.direction.z * step };
  }
  assert.equal(beganEating, true);
  assert.equal(ai.state, 'EAT');
});

test('actual approach or capture progress cancels a passage immediately', () => {
  const moved = new DeepSeekAIController(nav, [], [], () => 0);
  waitUntilEligible(moved);
  moved.update(input(start, { x: 2.2, z: 0 },
    { humanStillMs: 0, humanStillEventId: 2 }));
  assert.equal(moved.passageActive, false);
  assert.equal(moved.passageCancelReason, 'HUMAN_MOVED');
  assert.equal(moved.state, 'EVADE');

  const catching = new DeepSeekAIController(nav, [], [], () => 0);
  waitUntilEligible(catching);
  catching.update(input(start, human, { captureProgressMs: 50 }));
  assert.equal(catching.passageActive, false);
  assert.equal(catching.passageCancelReason, 'CAPTURE_ATTEMPT');
  assert.equal(catching.state, 'EVADE');
});

test('pause freezes stillness; manual takeover revokes permission; restart clears it', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0);
  ai.update(input());
  const before = ai.curiosityStillMs;
  assert.equal(shouldRunDeepSeekAI('PAUSED', 'HUMAN', 'HUMAN',
    { x: 0, y: 0 }, true), false);
  assert.equal(ai.curiosityStillMs, before);
  waitUntilEligible(ai);
  assert.equal(ai.passageActive, true);
  ai.resumeAfterManualControl();
  assert.equal(ai.passageActive, false);
  assert.equal(ai.passageCancelReason, 'MANUAL_CONTROL_RELEASED');
  ai.reset();
  assert.equal(ai.curiosityStillMs, 0);
  assert.equal(ai.passageRollResult, 'NOT_ELIGIBLE');
  assert.equal(ai.passageActive, false);
});

test('navigation keeps every step outside the moving capture avoidance circle', () => {
  const world = { canOccupyStaticXZ: () => true };
  const navigation = new NavigationSystem(world, 8, 8, []);
  const from = { x: -3, z: 0 }, to = { x: 3, z: 0 };
  const circle = { center: { x: 0, z: 0 }, radius: 1.35 };
  const path = navigation.findPath(from, to, [], undefined, null, new Set(), circle);
  assert.ok(path?.length);
  for (let index = 1; index < path.length; index++)
    assert.ok(distanceToXZSegment(circle.center, path[index - 1], path[index]) >=
      circle.radius - 1e-9);
  assert.ok(distanceToXZSegment(circle.center, from, path[0]) >= circle.radius);
  assert.ok(distanceToXZSegment(circle.center, path.at(-1), to) >= circle.radius);
});

test('a narrow corridor has no safe route around the capture circle', () => {
  const corridor = { canOccupyStaticXZ: (_x, z) => Math.abs(z) < 0.5 };
  const navigation = new NavigationSystem(corridor, 8, 8, []);
  const path = navigation.findPath({ x: -3, z: 0 }, { x: 3, z: 0 }, [],
    undefined, null, new Set(), { center: { x: 0, z: 0 }, radius: 1.35 });
  assert.equal(path, null);
});
