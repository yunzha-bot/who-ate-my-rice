import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem, lockDoorFromCommand } from '../src/systems/DoorSystem.ts';
import { AILogCollector } from '../src/systems/AILogCollector.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7B-3B / 3B-0b: the lock command channel is wired end to end, but nothing in
// the AI ever issues lockDoorId, so normal play keeps the verified S7B-3A close.

const closedNode = { id: 'D1', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'CLOSED', connectedRoomA: 'left', connectedRoomB: 'right' };
const openNode = { ...closedNode, id: 'D2', x: 6, initialState: 'OPEN' };
const near = { x: 0.4, z: 0 };

function setup(nodes = [closedNode]) {
  const nav = { findPath: (start, target) => [
    { ...start, doorId: null }, { ...target, doorId: null }] };
  const ai = new DeepSeekAIController(nav, nodes);
  const doors = new DoorSystem(nodes, C.door.maxActiveLocks);
  const lockCommand = id => ({ direction: { x: 0, z: 0 }, openDoorId: null,
    closeDoorId: null, lockDoorId: id, eatRiceId: null, startSprint: false });
  return { ai, doors, lockCommand };
}

function baseInput(doors, extra = {}) {
  return { deltaMs: 50, deepseek: { x: 0, z: 0 }, rice: [], doors: doors.doors,
    canOpenDoor: () => true, canCloseDoor: () => true, canLockDoor: () => true,
    activeLockSlots: C.door.maxActiveLocks, sprintState: 'NORMAL', ...extra };
}

test('lockDoorId defaults to null: the AI never locks on its own', () => {
  const { ai, doors } = setup();
  const input = baseInput(doors);
  for (let frame = 0; frame < 20; frame++) {
    const command = ai.update(input);
    assert.equal(command.lockDoorId, null, `frame ${frame}`);
  }
  assert.equal(ai.doorLockLastResult, 'NONE');
  assert.equal(ai.drainDoorLockEvents().length, 0);
});

test('no state emits lockDoorId, including EVADE with a visible close Human', () => {
  const { ai, doors } = setup();
  const states = ['SEEK_RICE', 'MOVE_TO_RICE', 'EAT', 'RESELECT', 'EVADE', 'RECOVER',
    'SAFE_WAIT', 'CURIOUS_APPROACH', 'CURIOUS_OBSERVE'];
  for (const state of states) {
    ai.reset();
    ai.state = state;
    const command = ai.update(baseInput(doors, { visibleHuman: { x: 3, z: 0 } }));
    assert.equal(command.lockDoorId, null, `state ${state} must not lock`);
  }
});

test('an injected lockDoorId completes CLOSED to LOCKED through DoorSystem', () => {
  const { doors, lockCommand } = setup();
  const command = lockCommand('D1');
  assert.equal(doors.get('D1').state, 'CLOSED');
  const result = lockDoorFromCommand(doors, command.lockDoorId, near,
    () => true, C.door.interactionRange);
  assert.equal(result, 'LOCKED');
  assert.equal(doors.get('D1').state, 'LOCKED');
  assert.equal(doors.get('D1').locked, true);
  assert.equal(doors.activeLockedDoorCount, 1);
});

test('an OPEN door cannot be locked', () => {
  const { doors } = setup([openNode]);
  assert.equal(doors.get('D2').state, 'OPEN');
  assert.equal(lockDoorFromCommand(doors, 'D2', { x: 6.4, z: 0 },
    () => true, C.door.interactionRange), 'INVALID_STATE');
  assert.equal(doors.get('D2').state, 'OPEN');
  assert.equal(doors.get('D2').locked, false);
});

test('a full lock budget reports LOCK_LIMIT_REACHED without replacing a lock', () => {
  const nodes = [0, 1, 2, 3].map(index => ({ ...closedNode,
    id: `L${index}`, x: index * 4 }));
  const doors = new DoorSystem(nodes, C.door.maxActiveLocks);
  for (let index = 0; index < C.door.maxActiveLocks; index++)
    assert.equal(doors.lock(`L${index}`, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.activeLockedDoorCount, C.door.maxActiveLocks);
  assert.equal(lockDoorFromCommand(doors, 'L3', { x: 12.4, z: 0 },
    () => true, C.door.interactionRange), 'LOCK_LIMIT_REACHED');
  assert.equal(doors.get('L3').state, 'CLOSED');
  assert.equal(doors.get('L3').locked, false);
});

test('a disabled lock core reports LOCK_CORE_DISABLED for the rest of the match', () => {
  const { doors } = setup();
  assert.equal(doors.lock('D1', 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.disableLock('D1', 'HUMAN'), 'UNLOCKED');
  assert.equal(doors.get('D1').state, 'CLOSED');
  assert.equal(doors.get('D1').lockCoreState, 'DISABLED');
  assert.equal(lockDoorFromCommand(doors, 'D1', near,
    () => true, C.door.interactionRange), 'LOCK_CORE_DISABLED');
});

test('the execution side refuses an out-of-range, wall-blocked or unknown door', () => {
  const { doors } = setup();
  assert.equal(lockDoorFromCommand(doors, 'D1', { x: 9, z: 9 },
    () => true, C.door.interactionRange), 'OUT_OF_RANGE');
  assert.equal(doors.get('D1').state, 'CLOSED');
  // canInteract false stands in for the existing no-through-wall rule.
  assert.equal(lockDoorFromCommand(doors, 'D1', near,
    () => false, C.door.interactionRange), 'OUT_OF_RANGE');
  assert.equal(doors.get('D1').state, 'CLOSED');
  assert.equal(lockDoorFromCommand(doors, 'MISSING', near,
    () => true, C.door.interactionRange), 'NOT_FOUND');
});

test('lock results reach the controller once, are deduplicated, and reset cleanly', () => {
  const { ai } = setup();
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.equal(ai.doorLockLastResult, 'D1:LOCKED');
  assert.equal(ai.doorLockReason, 'LOCKED');
  assert.deepEqual(ai.drainDoorLockEvents(),
    [{ type: 'DOOR_LOCK_APPLY', reason: 'D1:LOCKED' }]);
  // The same outcome must not repeat while it stays in place.
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.equal(ai.drainDoorLockEvents().length, 0);
  ai.onDoorLockResult('D1', 'LOCK_LIMIT_REACHED');
  assert.equal(ai.doorLockLastResult, 'D1:LOCK_LIMIT_REACHED');
  assert.deepEqual(ai.drainDoorLockEvents(),
    [{ type: 'DOOR_LOCK_FAILED', reason: 'D1:LOCK_LIMIT_REACHED' }]);
  ai.reset();
  assert.equal(ai.doorLockLastResult, 'NONE');
  assert.equal(ai.doorLockReason, 'NOT_EVALUATED');
  assert.equal(ai.drainDoorLockEvents().length, 0);
});

test('a locked door keeps its leaf, view, dynamic collision and lock sound contract', () => {
  const { doors } = setup();
  const view = new DoorView(closedNode, 0, false);
  assert.equal(view.lockCore.visible, false);
  assert.equal(doors.lock('D1', 'DEEPSEEK'), 'LOCKED');
  view.sync(doors.get('D1'));
  assert.equal(view.lockCore.visible, true);
  assert.notEqual(view.lockCore, view.leaf);

  // LOCKED and CLOSED share the same dynamic obstacle, so capture lines and
  // movement stay blocked; applyDoorResult emits DOOR_LOCK for this state.
  const world = new CollisionWorld(30, 30, []);
  const start = new Vector3(closedNode.x - 0.7, 0.35, closedNode.z);
  world.setDynamicObstacle('D1', view.closedCollisionBox());
  const blocked = world.move(start, 1.4, 0, C.collision.playerRadius, 0.7);
  assert.ok(blocked.distanceTo(start) < 0.6);
  assert.ok(C.perception.sounds.DOOR_LOCK.range > 0);
  view.dispose();
});

test('lock events are bounded AI log events, absent from normal play', () => {
  const { ai } = setup();
  const logger = new AILogCollector();
  logger.startMatch();
  const snapshot = { state: 'EVADE', targetRiceId: null, threatLevel: 'HIGH',
    threatSource: 'VISION', lastSelectionReason: 'X', lastNavigationReason: 'X',
    lastTransitionReason: 'THREAT_VISION', lastEscapeSwitchReason: 'NONE',
    escapeRoomId: 'right', noMovementReason: 'NONE', localLoopTriggered: false,
    sprintDecision: 'READY', recoveryBlockReason: 'NONE', curiosityRollResult: 'NONE',
    curiosityInterruptReason: 'NONE', curiosityBypassActive: false,
    passageRollResult: 'NONE', passageGateReason: 'NONE', passageCancelReason: 'NONE',
    passageRouteSafe: false, safeWaitRiceId: null, safeWaitEntryId: null,
    safeWaitFailureCount: 0, safeWaitReason: 'NONE', safeWaitRemainingMs: 0,
    roomId: 'right', humanVisible: true, humanStillMs: 0, stillnessEventId: 0,
    lastSeenValid: false, heardSoundType: null, heardAudibleStrength: null,
    heardRemainingMs: null, heardSoundTimestampMs: null, heardDangerSoundType: null,
    heardDangerAudibleStrength: null, humanVisibleDistance: 2 };

  // An empty queue contributes no events, so normal play never grows the log.
  logger.diffSnapshot({ ...snapshot, doorLockEvents: ai.drainDoorLockEvents() });
  assert.deepEqual(logger.export().events.map(event => event.type), ['MATCH_START']);

  ai.onDoorLockResult('D1', 'LOCKED');
  logger.diffSnapshot({ ...snapshot, doorLockEvents: ai.drainDoorLockEvents() });
  const events = logger.export().events;
  assert.deepEqual(events.map(event => event.type), ['MATCH_START', 'DOOR_LOCK_APPLY']);
  assert.equal(events[1].reason, 'D1:LOCKED');
});
