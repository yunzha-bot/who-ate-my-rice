import test from 'node:test';
import assert from 'node:assert/strict';
import { AILogCollector } from '../src/systems/AILogCollector.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const baseSnapshot = () => ({
  state: 'SEEK_RICE',
  targetRiceId: null,
  threatLevel: 'NONE',
  threatSource: 'NONE',
  lastSelectionReason: 'ROUND_START',
  lastNavigationReason: 'NONE',
  lastTransitionReason: 'ROUND_START',
  lastEscapeSwitchReason: 'NONE',
  escapeRoomId: null,
  noMovementReason: 'NONE',
  localLoopTriggered: false,
  sprintDecision: 'READY',
  sprintReadiness: 'READY',
  recoveryBlockReason: 'NONE',
  curiosityRollResult: 'NOT_ELIGIBLE',
  curiosityInterruptReason: 'NONE',
  curiosityBypassActive: false,
  passageRollResult: 'NOT_ELIGIBLE',
  passageGateReason: 'NOT_EVALUATED',
  passageCancelReason: 'NONE',
  passageRouteSafe: false,
  safeWaitRiceId: null,
  safeWaitEntryId: null,
  safeWaitFailureCount: 0,
  safeWaitReason: 'NONE',
  safeWaitRemainingMs: 0,
  roomId: 'living',
  humanVisible: false,
  humanStillMs: 0,
  stillnessEventId: 0,
  lastSeenValid: false,
  heardSoundType: null,
  heardAudibleStrength: null,
  heardRemainingMs: null,
  heardSoundTimestampMs: null,
  heardDangerSoundType: null,
  heardDangerAudibleStrength: null,
  humanVisibleDistance: null,
});

test('startMatch clears events and resets clock', () => {
  const collector = new AILogCollector();
  collector.advance(100, true);
  collector.diffSnapshot(baseSnapshot());
  collector.advance(50, true);
  collector.diffSnapshot({ ...baseSnapshot(), state: 'MOVE_TO_RICE' });
  assert.equal(collector.export().eventCount, 2);

  collector.startMatch();
  const data = collector.export();
  assert.equal(data.eventCount, 0);
  assert.equal(data.matchDurationMs, 0);
  assert.equal(data.truncated, false);
});

test('advance respects running flag; paused frames do not advance clock', () => {
  const collector = new AILogCollector();
  collector.advance(100, true);
  assert.equal(collector.export().matchDurationMs, 100);
  collector.advance(200, false);
  assert.equal(collector.export().matchDurationMs, 100);
  collector.advance(50, true);
  assert.equal(collector.export().matchDurationMs, 150);
});

test('first diffSnapshot produces a MATCH_START event capturing initial state', () => {
  const collector = new AILogCollector();
  collector.advance(500, true);
  const snap = baseSnapshot();
  collector.diffSnapshot(snap);
  const data = collector.export();
  assert.equal(data.eventCount, 1);
  assert.equal(data.events[0].type, 'MATCH_START');
  assert.equal(data.events[0].state, 'SEEK_RICE');
  assert.equal(data.events[0].prevState, null);
  assert.equal(data.events[0].t, 500);
  assert.equal(data.events[0].count, 1);
  assert.equal(data.events[0].context.state, 'SEEK_RICE');
  assert.equal(data.events[0].context.roomId, 'living');
});

test('subsequent diffSnapshot only emits events for changed fields', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());
  // Change state and targetRiceId simultaneously
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'MOVE_TO_RICE',
    targetRiceId: 'rice-a',
    lastTransitionReason: 'TARGET_SELECTED',
  });
  const data = collector.export();
  // MATCH_START + STATE_TRANSITION + TARGET_CHANGE + TRANSITION_REASON = 4
  assert.equal(data.eventCount, 4);
  assert.equal(data.events[1].type, 'STATE_TRANSITION');
  assert.equal(data.events[1].state, 'MOVE_TO_RICE');
  assert.equal(data.events[1].prevState, 'SEEK_RICE');
  assert.equal(data.events[1].reason, 'MOVE_TO_RICE');
  assert.equal(data.events[2].type, 'TARGET_CHANGE');
  assert.equal(data.events[2].reason, 'rice-a');
  assert.equal(data.events[3].type, 'TRANSITION_REASON');
  assert.equal(data.events[3].reason, 'TARGET_SELECTED');
});

test('unchanged fields do not produce events across consecutive frames', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());
  collector.advance(100, true);
  // First navigation failure: NONE -> NO_PATH (change)
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'NO_PATH',
  });
  collector.advance(100, true);
  // Same value: NO_PATH -> NO_PATH (no change, no event)
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'NO_PATH',
  });
  collector.advance(100, true);
  // Still same: no event
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'NO_PATH',
  });
  const data = collector.export();
  // MATCH_START + one NAVIGATION_RESULT = 2
  assert.equal(data.eventCount, 2);
  assert.equal(data.events[1].type, 'NAVIGATION_RESULT');
  assert.equal(data.events[1].reason, 'NO_PATH');
  assert.equal(data.events[1].count, 1);
  assert.equal(data.events[1].firstT, 100);
  assert.equal(data.events[1].lastT, 100);
});

test('field change to a new value creates a new event', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'NO_PATH',
  });
  // Same value - no event
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'NO_PATH',
  });
  // Change reason - new event
  collector.diffSnapshot({
    ...baseSnapshot(),
    lastNavigationReason: 'STUCK_REPATH',
  });
  const data = collector.export();
  // MATCH_START + NO_PATH + STUCK_REPATH = 3
  assert.equal(data.eventCount, 3);
  assert.equal(data.events[1].reason, 'NO_PATH');
  assert.equal(data.events[1].count, 1);
  assert.equal(data.events[2].reason, 'STUCK_REPATH');
  assert.equal(data.events[2].count, 1);
});

test('merge: same event signature from oscillating field merges with count', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot({ ...baseSnapshot(), noMovementReason: 'INIT' });
  // Change to A
  collector.diffSnapshot({ ...baseSnapshot(), noMovementReason: 'A' });
  // Change to B (different reason, no merge)
  collector.diffSnapshot({ ...baseSnapshot(), noMovementReason: 'B' });
  // Change back to A — different from last (B), so new event, no merge
  collector.diffSnapshot({ ...baseSnapshot(), noMovementReason: 'A' });
  // Change back to B — same as the event two steps ago, but last event was A
  collector.diffSnapshot({ ...baseSnapshot(), noMovementReason: 'B' });
  const data = collector.export();
  const noMovEvents = data.events.filter(e => e.type === 'NO_MOVEMENT');
  // A, B, A, B — each is a separate event (no merge because they alternate)
  assert.equal(noMovEvents.length, 4);
  assert.equal(noMovEvents[0].reason, 'A');
  assert.equal(noMovEvents[1].reason, 'B');
  assert.equal(noMovEvents[2].reason, 'A');
  assert.equal(noMovEvents[3].reason, 'B');
});

test('truncation: exceeding maxEvents sets truncated=true and stops recording', () => {
  const collector = new AILogCollector();
  // maxEvents is 2000; generate 2001 unique events by alternating state
  collector.diffSnapshot(baseSnapshot());
  for (let i = 0; i < 2100; i++) {
    collector.diffSnapshot({
      ...baseSnapshot(),
      noMovementReason: `REASON_${i}`,
    });
  }
  const data = collector.export();
  assert.equal(data.truncated, true);
  assert.equal(data.eventCount, 2000);
});

test('export returns correct structure with config snapshot', () => {
  const collector = new AILogCollector();
  collector.advance(5000, true);
  collector.diffSnapshot(baseSnapshot());
  const data = collector.export();
  assert.equal(data.formatVersion, '1.1');
  assert.equal(typeof data.exportedAt, 'string');
  assert.equal(data.matchDurationMs, 5000);
  assert.deepEqual(data.config.deepseekAI, C.deepseekAI);
  assert.equal(Array.isArray(data.events), true);
  assert.equal(data.eventCount, data.events.length);
  assert.equal(data.truncated, false);
});

test('state transition keeps the exact heard event and Human observation context', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());
  collector.advance(40_684, true);
  collector.diffSnapshot({ ...baseSnapshot(), state: 'EVADE',
    passageCancelReason: 'DANGER_SOUND',
    humanVisible: true, humanStillMs: 15_180, stillnessEventId: 606,
    humanVisibleDistance: 2.8,
    heardSoundType: 'DOOR_CLOSE', heardAudibleStrength: 0.24,
    heardRemainingMs: 720, heardSoundTimestampMs: 40_404,
    heardDangerSoundType: 'FOOTSTEP', heardDangerAudibleStrength: 0.12 });
  const transition = collector.export().events.find(event =>
    event.type === 'STATE_TRANSITION' && event.state === 'EVADE');
  assert.ok(transition);
  assert.equal(transition.context.heardSoundType, 'DOOR_CLOSE');
  assert.equal(transition.context.heardAudibleStrength, 0.24);
  assert.equal(transition.context.heardRemainingMs, 720);
  assert.equal(transition.context.heardSoundTimestampMs, 40_404);
  assert.equal(transition.context.heardDangerSoundType, 'FOOTSTEP');
  assert.equal(transition.context.heardDangerAudibleStrength, 0.12);
  assert.equal(transition.context.humanStillMs, 15_180);
  assert.equal(transition.context.humanVisibleDistance, 2.8);
});

test('door-bounce reproduction: SEEK_RICE -> EVADE -> RECOVER -> SEEK_RICE with same target', () => {
  const collector = new AILogCollector();
  // Round start
  collector.diffSnapshot(baseSnapshot());
  // Select rice-a in kitchen
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'MOVE_TO_RICE',
    targetRiceId: 'rice-a',
    lastTransitionReason: 'TARGET_SELECTED',
    roomId: 'kitchen',
  });
  // Enter kitchen, see Human -> EVADE
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'EVADE',
    targetRiceId: 'rice-a',
    threatLevel: 'HIGH',
    threatSource: 'VISION',
    lastTransitionReason: 'HUMAN_VISIBLE',
    roomId: 'kitchen',
    humanVisible: true,
    humanStillMs: 6000,
    stillnessEventId: 1,
  });
  // Leave room, threat drops -> RECOVER
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'RECOVER',
    targetRiceId: 'rice-a',
    threatLevel: 'CAUTION',
    threatSource: 'MEMORY',
    lastTransitionReason: 'THREAT_LOWERED',
    roomId: 'living',
    humanVisible: false,
    recoveryBlockReason: 'AWAIT_SAFETY',
  });
  // Re-select same rice-a -> SEEK_RICE
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'SEEK_RICE',
    targetRiceId: 'rice-a',
    threatLevel: 'NONE',
    threatSource: 'NONE',
    lastTransitionReason: 'RECOVER_DONE',
    roomId: 'living',
    recoveryBlockReason: 'NONE',
  });
  const data = collector.export();
  // The sequence should be reconstructable from events
  const types = data.events.map(e => e.type);
  assert.ok(types.includes('MATCH_START'));
  assert.ok(types.includes('STATE_TRANSITION'));
  assert.ok(types.includes('TARGET_CHANGE'));
  assert.ok(types.includes('THREAT_CHANGE'));
  assert.ok(types.includes('ROOM_CHANGE'));

  // Verify the EVADE event captured curiosity/passage context
  const evadeEvent = data.events.find(e => e.type === 'STATE_TRANSITION' && e.state === 'EVADE');
  assert.ok(evadeEvent, 'EVADE transition should be logged');
  assert.equal(evadeEvent.prevState, 'MOVE_TO_RICE');
  assert.equal(evadeEvent.context.humanVisible, true);
  assert.equal(evadeEvent.context.humanStillMs, 6000);
  assert.equal(evadeEvent.context.curiosityRollResult, 'NOT_ELIGIBLE');
  assert.equal(evadeEvent.context.passageGateReason, 'NOT_EVALUATED');

  // Verify same target rice-a was re-selected (the bounce)
  const targetChanges = data.events.filter(e => e.type === 'TARGET_CHANGE');
  assert.equal(targetChanges.length, 1);
  assert.equal(targetChanges[0].reason, 'rice-a');
});

test('curiosity and passage decision events are captured distinctly', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());
  // Curiosity roll triggered
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'CURIOUS_APPROACH',
    curiosityRollResult: 'TRIGGERED',
    lastTransitionReason: 'CURIOSITY_TRIGGERED',
    humanVisible: true,
    humanStillMs: 5000,
    stillnessEventId: 1,
  });
  // Passage gate failure - no safe route
  collector.diffSnapshot({
    ...baseSnapshot(),
    state: 'CURIOUS_APPROACH',
    passageRollResult: 'ELIGIBLE',
    passageGateReason: 'NO_SAFE_ROUTE',
    curiosityBypassActive: false,
  });
  const data = collector.export();
  assert.ok(data.events.some(e => e.type === 'CURIOSITY_RESULT' && e.reason === 'TRIGGERED'));
  assert.ok(data.events.some(e => e.type === 'PASSAGE_RESULT' && e.reason === 'ELIGIBLE'));
  assert.ok(data.events.some(e => e.type === 'PASSAGE_GATE' && e.reason === 'NO_SAFE_ROUTE'));
});

test('the sprint 30s cooldown lifecycle is traceable through the AI log', () => {
  const collector = new AILogCollector();
  collector.diffSnapshot(baseSnapshot());                       // READY
  collector.advance(100, true);
  collector.diffSnapshot({ ...baseSnapshot(), sprintReadiness: 'ACTIVE' });   // sprint began
  collector.advance(C.sprint.durationMs, true);
  collector.diffSnapshot({ ...baseSnapshot(), sprintReadiness: 'COOLDOWN' }); // sprint over, CD runs
  collector.advance(C.sprint.cooldownMs, true);
  collector.diffSnapshot({ ...baseSnapshot(), sprintReadiness: 'READY' });    // CD expired
  const readiness = collector.export().events
    .filter(event => event.type === 'SPRINT_READINESS')
    .map(event => event.reason);
  assert.deepEqual(readiness, ['ACTIVE', 'COOLDOWN', 'READY']);
});
