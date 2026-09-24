import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const human = { x: 2, z: 0 };
const start = { x: 0, z: 0 };
const rice = { id: 'rice-a', x: 4, z: 0, progressMs: 0,
  maxProgressMs: C.rice.maxProgressMs, completed: false };
const step = point => ({ ...point, doorId: null });
const navigation = (safeRoute) => ({
  nearestFree: point => ({ ...point }),
  findPath: (from, to, _doors, _avoid, _cost, _blocked, avoidCircle) =>
    avoidCircle ? safeRoute ? [step(from), step({ x: 0, z: 2 }),
      step({ x: 4, z: 2 }), step(to)] : null : [step(from), step(to)],
});
const input = (position, visible, nowMs, extra = {}) => ({
  deltaMs: 50, deepseek: position, rice: [rice], doors: [],
  canOpenDoor: () => true, sprintState: 'NORMAL', captureProgressMs: 0,
  visibleHuman: visible ? human : null,
  humanStillMs: visible ? 8_000 : undefined,
  humanStillEventId: visible ? 1 : undefined,
  lastSeenHuman: nowMs === 0 ? null : { position: human, timeMs: 100 },
  perceptionNowMs: nowMs,
  ...extra,
});
const snapshot = (ai, label) => ({ label, state: ai.state,
  active: ai.passageActive, roll: ai.passageRollResult,
  cancel: ai.passageCancelReason, threat: ai.threatLevel,
  transition: ai.lastTransitionReason, navigation: ai.lastNavigationReason });

test('stationary Human sight begins and keeps a safe approach through temporary cover', () => {
  const ai = new DeepSeekAIController(navigation(true), [], [], () => 0.99);
  const trace = [];
  ai.update(input(start, false, 0));
  trace.push(snapshot(ai, 'hidden'));
  ai.update(input(start, true, 100));
  trace.push(snapshot(ai, 'first sight'));
  assert.equal(ai.state, 'CURIOUS_APPROACH', JSON.stringify(trace));
  ai.update(input(start, false, 150));
  trace.push(snapshot(ai, 'temporary cover'));
  assert.equal(ai.passageActive, true, JSON.stringify(trace));
  assert.equal(ai.state, 'CURIOUS_APPROACH', JSON.stringify(trace));
  const observation = { ...ai.curiosityTarget };
  ai.update(input(observation, false, 200));
  trace.push(snapshot(ai, 'observation point'));
  assert.equal(ai.state, 'CURIOUS_OBSERVE', JSON.stringify(trace));
  for (let elapsed = 0; elapsed < C.deepseekAI.curiosityObserveMs; elapsed += 50)
    ai.update(input(observation, false, 250 + elapsed));
  trace.push(snapshot(ai, 'observation completed'));
  assert.equal(ai.state, 'CURIOUS_PASSAGE', JSON.stringify(trace));
  ai.update(input(rice, false, 2_100));
  trace.push(snapshot(ai, 'rice reached'));
  assert.equal(ai.state, 'EAT', JSON.stringify(trace));
});

test('stationary Human cannot authorize a passage without a capture-circle-safe route', () => {
  const ai = new DeepSeekAIController(navigation(false), [], [], () => 0.99);
  ai.update(input(start, false, 0));
  ai.update(input(start, true, 100));
  const trace = snapshot(ai, 'no safe bypass');
  assert.equal(ai.passageRollResult, 'NO_SAFE_ROUTE', JSON.stringify(trace));
  assert.equal(ai.passageActive, false, JSON.stringify(trace));
  assert.equal(ai.passageCancelReason,
    'NO_REACHABLE_ROUTE_OUTSIDE_CAPTURE_ZONE', JSON.stringify(trace));
  ai.update(input(start, true, 150));
  assert.equal(ai.passageGateReason, 'TRIGGERED_NO_SAFE_ROUTE');
});

test('Human near target rice can trigger a safe passage even when the default route is clear', () => {
  const nearRiceHuman = { x: rice.x, z: rice.z + 2 };
  const safeNavigation = {
    nearestFree: point => ({ ...point }),
    findPath: (from, to, _doors, _avoid, _cost, _blocked, avoidCircle) =>
      avoidCircle ? [step(from), step({ x: 2, z: 0 }), step(to)] :
        [step(from), step(to)],
  };
  const ai = new DeepSeekAIController(safeNavigation, [], [], () => 0.5);
  ai.update(input(start, true, 100, { visibleHuman: nearRiceHuman }));
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  assert.equal(ai.passageActive, true);
  assert.equal(ai.targetRiceId, rice.id);
});

test('rice proximity never authorizes an unsafe route or a distant unrelated Human', () => {
  const nearRiceHuman = { x: rice.x, z: rice.z + 2 };
  const noBypassNavigation = {
    nearestFree: point => ({ ...point }),
    findPath: (from, to, _doors, _avoid, _cost, _blocked, avoidCircle) =>
      avoidCircle ? null : [step(from), step(to)],
  };
  const blocked = new DeepSeekAIController(noBypassNavigation, [], [], () => 0.5);
  blocked.update(input(start, true, 100, { visibleHuman: nearRiceHuman }));
  assert.equal(blocked.passageRollResult, 'NO_SAFE_ROUTE');
  assert.equal(blocked.passageActive, false);
  assert.equal(blocked.passageCancelReason, 'NO_REACHABLE_ROUTE_OUTSIDE_CAPTURE_ZONE');

  const farHuman = { x: rice.x, z: rice.z + C.deepseekAI.dangerRouteRadius + 1 };
  const unrelated = new DeepSeekAIController(noBypassNavigation, [], [], () => 0.5);
  unrelated.update(input(start, true, 100, { visibleHuman: farHuman }));
  assert.equal(unrelated.passageGateReason, 'HUMAN_NOT_ON_RICE_ROUTE');
  assert.equal(unrelated.passageRolledForStillEvent, false);
});

test('fresh danger sound cancels an authorized passage even behind cover', () => {
  const ai = new DeepSeekAIController(navigation(true), [], [], () => 0.99);
  ai.update(input(start, true, 100));
  assert.equal(ai.state, 'CURIOUS_APPROACH');
  const heardHuman = { event: { sourceFaction: 'HUMAN', type: 'SPRINT',
    position: human, strength: 1, timestamp: 150 },
    audibleStrength: C.deepseekAI.soundEvadeStrength + 1, remainingMs: 500 };
  ai.update(input(start, false, 150, { heardHuman }));
  assert.equal(ai.passageActive, false);
  assert.equal(ai.passageCancelReason, 'DANGER_SOUND');
  assert.equal(ai.passageGateReason, 'INTERRUPTED_DANGER_SOUND');
  assert.equal(ai.state, 'EVADE');
});

test('stationary Human door operation does not interrupt safe observation or cover', () => {
  for (const type of ['DOOR_OPEN', 'DOOR_CLOSE', 'LOCK_BREAK']) {
    const ai = new DeepSeekAIController(navigation(true), [], [], () => 0.99);
    ai.update(input(start, true, 100));
    assert.equal(ai.state, 'CURIOUS_APPROACH');
    const observation = { ...ai.curiosityTarget };
    ai.update(input(observation, true, 150));
    assert.equal(ai.state, 'CURIOUS_OBSERVE');
    const heardHuman = { event: { sourceFaction: 'HUMAN', type,
      position: human, strength: 0.65, timestamp: 200 },
      audibleStrength: C.deepseekAI.soundEvadeStrength + 0.15,
      remainingMs: 800 };
    ai.update(input(observation, true, 200, { heardHuman }));
    assert.equal(ai.state, 'CURIOUS_OBSERVE', type);
    assert.equal(ai.passageActive, true, type);
    assert.equal(ai.threatLevel, 'CAUTION', type);
    ai.update(input(observation, false, 250, { heardHuman }));
    assert.equal(ai.state, 'CURIOUS_OBSERVE', type);
    assert.equal(ai.threatLevel, 'CAUTION', type);
    assert.equal(ai.passageCancelReason, 'NONE', type);
    for (let elapsed = 0; elapsed < C.deepseekAI.curiosityObserveMs; elapsed += 50)
      ai.update(input(observation, false, 300 + elapsed));
    assert.equal(ai.state, 'CURIOUS_PASSAGE', type);
  }
});

test('actual Human movement interrupts observation despite ordinary door sound', () => {
  const ai = new DeepSeekAIController(navigation(true), [], [], () => 0.99);
  ai.update(input(start, true, 100));
  const observation = { ...ai.curiosityTarget };
  ai.update(input(observation, true, 150));
  ai.update(input(observation, true, 200, {
    humanStillMs: 0, humanStillEventId: 2,
    visibleHuman: { x: human.x + 0.2, z: human.z },
    heardHuman: { event: { sourceFaction: 'HUMAN', type: 'DOOR_CLOSE',
      position: human }, audibleStrength: 1, remainingMs: 800 },
  }));
  assert.equal(ai.passageActive, false);
  assert.equal(ai.passageCancelReason, 'HUMAN_MOVED');
  assert.equal(ai.state, 'EVADE');
});

test('a weaker audible footstep still interrupts when a door sound is strongest', () => {
  const ai = new DeepSeekAIController(navigation(true), [], [], () => 0.99);
  ai.update(input(start, true, 100));
  const observation = { ...ai.curiosityTarget };
  ai.update(input(observation, true, 150));
  const heardHuman = { event: { sourceFaction: 'HUMAN', type: 'DOOR_CLOSE',
    position: human }, audibleStrength: 0.5, remainingMs: 800 };
  const heardHumanDanger = { event: { sourceFaction: 'HUMAN', type: 'FOOTSTEP',
    position: human }, audibleStrength: C.deepseekAI.soundEvadeStrength + 0.01,
    remainingMs: 800 };
  ai.update(input(observation, false, 200, { heardHuman, heardHumanDanger }));
  assert.equal(ai.state, 'EVADE');
  assert.equal(ai.passageCancelReason, 'DANGER_SOUND');
});
