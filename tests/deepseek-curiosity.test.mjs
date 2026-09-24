import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController, shouldRunDeepSeekAI } from '../src/systems/DeepSeekAIController.ts';
import { resolveCharacterAction } from '../src/systems/CharacterAction.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const human = { x: 8, z: 0 };
const rice = { id: 'rice-a', x: 0, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const nav = {
  nearestFree: goal => ({ ...goal }),
  findPath: (start, goal) => [
    { ...start, doorId: null }, { ...goal, doorId: null },
  ],
};
const input = (position = { x: 0, z: 0 }, visibleHuman = human,
  extra = {}) => ({ deltaMs: 50, deepseek: position, rice: [rice], doors: [],
  canOpenDoor: () => true, visibleHuman, sprintState: 'NORMAL',
  humanStillMs: C.deepseekAI.curiosityStillMs, humanStillEventId: 1, ...extra });
const waitStill = (ai, position = { x: 0, z: 0 }) => {
  ai.update(input(position));
};

test('visible stationary Human produces one 10% roll per stationary event', () => {
  let rolls = 0;
  const ai = new DeepSeekAIController(nav, [], [], () => { rolls++; return 0.9; });
  waitStill(ai);
  assert.equal(rolls, 1);
  assert.equal(ai.curiosityRollResult, 'ROLL_FAILED');
  for (let tick = 0; tick < 400; tick++) ai.update(input());
  assert.equal(rolls, 1);
  ai.update(input(undefined, { x: 8.2, z: 0 },
    { humanStillMs: 0, humanStillEventId: 2 }));
  for (let tick = 0; tick < 100; tick++)
    ai.update(input(undefined, { x: 8.2, z: 0 },
      { humanStillMs: C.deepseekAI.curiosityStillMs, humanStillEventId: 2 }));
  assert.equal(rolls, 2);
});

test('hidden Human cannot trigger; cooldown persists; stationary safe proximity may permit eating', () => {
  let rolls = 0;
  const ai = new DeepSeekAIController(nav, [], [], () => { rolls++; return 0; });
  for (let tick = 0; tick < 120; tick++) ai.update(input(undefined, null));
  assert.equal(rolls, 0);
  waitStill(ai);
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  ai.update(input(undefined, { x: 7.8, z: 0 },
    { humanStillMs: 0, humanStillEventId: 2 }));
  assert.ok(ai.curiosityCooldownRemainingMs > 0);
  ai.update(input(undefined, null));
  for (let tick = 0; tick < 100; tick++) ai.update(input());
  assert.equal(ai.curiosityRollResult, 'ROLL_PASSED');
  assert.notEqual(ai.state, 'CURIOUS_APPROACH');
  const near = new DeepSeekAIController(nav, [], [], () => 0);
  for (let tick = 0; tick < 120; tick++)
    near.update(input(undefined, { x: 2, z: 0 }));
  assert.equal(near.state, 'EAT');
  assert.equal(near.passageActive, true);
  assert.notEqual(near.curiosityRollResult, 'ROLL_PASSED');
  near.update(input(undefined, { x: 0.5, z: 0 },
    { humanStillMs: 0, humanStillEventId: 2 }));
  assert.equal(near.state, 'EVADE');
  assert.equal(near.passageActive, false);
});

test('curiosity approaches a safe point, observes, then uses only a safe rice bypass', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(ai);
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  assert.ok(ai.curiosityTarget);
  assert.ok(Math.hypot(ai.curiosityTarget.x - human.x,
    ai.curiosityTarget.z - human.z) >= C.deepseekAI.curiositySafeDistance);
  const observationPoint = { ...ai.curiosityTarget };
  ai.update(input(observationPoint));
  assert.equal(ai.state, 'CURIOUS_OBSERVE');
  for (let elapsed = 0; elapsed < C.deepseekAI.curiosityObserveMs; elapsed += 50)
    ai.update(input(observationPoint));
  assert.equal(ai.state, 'MOVE_TO_RICE');
  assert.equal(ai.targetRiceId, rice.id);
  assert.equal(ai.curiosityBypassActive, true);
  assert.ok(ai.curiosityCooldownRemainingMs > 0);
});

test('moving or noisy Human interrupts curiosity immediately without capture immunity', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(ai);
  ai.update(input(undefined, { x: 7.8, z: 0 },
    { humanStillMs: 0, humanStillEventId: 2 }));
  assert.equal(ai.state, 'EVADE');
  assert.equal(ai.curiosityInterruptReason, 'HUMAN_MOVED');
  const second = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(second);
  second.update(input(undefined, human, { heardHuman: {
    event: { sourceFaction: 'HUMAN', type: 'FORCE_BREAK', position: human },
    remainingMs: 500, audibleStrength: C.deepseekAI.soundEvadeStrength + 0.1,
  } }));
  assert.equal(second.state, 'EVADE');
  assert.equal(second.curiosityInterruptReason, 'DANGER_SOUND');
});

test('expired sight, real stun and unsafe rice routes never grant a free crossing', () => {
  const hidden = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(hidden);
  hidden.update(input(undefined, null));
  assert.equal(hidden.curiosityInterruptReason, 'LAST_SEEN_EXPIRED');
  assert.equal(hidden.curiosityBypassActive, false);
  assert.notEqual(hidden.state, 'CURIOUS_APPROACH');
  const stunned = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(stunned);
  const stopped = stunned.update(input(undefined, human, { sprintState: 'STUNNED' }));
  assert.equal(stunned.state, 'EVADE');
  assert.deepEqual(stopped.direction, { x: 0, z: 0 });
  const unsafe = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(unsafe);
  assert.equal(unsafe.state, 'CURIOUS_APPROACH');
  const observationPoint = { ...unsafe.curiosityTarget };
  unsafe.update(input(observationPoint, human, { rice: [{ ...rice, x: 8.1 }] }));
  for (let elapsed = 0; elapsed < C.deepseekAI.curiosityObserveMs; elapsed += 50)
    unsafe.update(input(observationPoint, human, { rice: [{ ...rice, x: 8.1 }] }));
  assert.equal(unsafe.state, 'EVADE');
  assert.equal(unsafe.curiosityInterruptReason, 'NO_SAFE_RICE_BYPASS');
});

test('safe rice bypass continues after reaching cover without reading hidden Human position', () => {
  const ai = new DeepSeekAIController(nav, [], [], () => 0);
  waitStill(ai);
  const observationPoint = { ...ai.curiosityTarget };
  ai.update(input(observationPoint));
  for (let elapsed = 0; elapsed < C.deepseekAI.curiosityObserveMs; elapsed += 50)
    ai.update(input(observationPoint));
  assert.equal(ai.curiosityBypassActive, true);
  const command = ai.update(input(observationPoint, null));
  assert.equal(ai.curiosityBypassActive, false);
  assert.equal(ai.curiosityInterruptReason, 'BYPASS_REACHED_COVER');
  assert.equal(ai.targetRiceId, rice.id);
  assert.notEqual(ai.state, 'EVADE');
  assert.ok(command.direction.x !== 0 || command.direction.z !== 0);
});

test('no safe route refuses curiosity; cooldown, pause and reset remain isolated', () => {
  const blockedNav = { ...nav, findPath: (start, goal) => goal.x > 4 ? null :
    nav.findPath(start, goal) };
  const ai = new DeepSeekAIController(blockedNav, [], [], () => 0);
  waitStill(ai);
  assert.equal(ai.curiosityRollResult, 'NO_SAFE_APPROACH');
  assert.notEqual(ai.state, 'CURIOUS_APPROACH');
  assert.ok(ai.curiosityCooldownRemainingMs > 0);
  const before = ai.curiosityCooldownRemainingMs;
  assert.equal(shouldRunDeepSeekAI('PAUSED', 'HUMAN', 'HUMAN', { x: 0, y: 0 }, true), false);
  assert.equal(ai.curiosityCooldownRemainingMs, before); // No AI update while paused.
  ai.reset();
  assert.equal(ai.curiosityCooldownRemainingMs, 0);
  assert.equal(ai.curiosityStillMs, 0);
  assert.equal(ai.curiosityRollResult, 'NOT_ELIGIBLE');
});

test('a route with safe endpoints but a segment crossing the capture area is rejected', () => {
  const crossingNav = { ...nav, nearestFree: () => ({ x: 12, z: 0 }) };
  const ai = new DeepSeekAIController(crossingNav, [], [], () => 0);
  waitStill(ai);
  assert.equal(ai.curiosityRollResult, 'NO_SAFE_APPROACH');
  assert.notEqual(ai.state, 'CURIOUS_APPROACH');
});

test('curiosity GLB slots are presentation only and preserve higher-priority actions', () => {
  assert.equal(resolveCharacterAction({ moving: false, curiosityPeek: true }), 'CURIOUS_PEEK');
  assert.equal(resolveCharacterAction({ moving: false, curiosityLook: true }), 'CURIOUS_LOOK');
  assert.equal(resolveCharacterAction({ moving: false, curiosityLook: true,
    stunned: true }), 'STUN');
  assert.equal(resolveCharacterAction({ moving: true }), 'WALK');
});
