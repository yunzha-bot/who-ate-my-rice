import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem, lockDoorFromCommand, distanceToDoorSegment }
  from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7B-3B-1 integration: drives the real per-frame order that ThreeGame uses —
// trackDoorCrossings -> updateSafety -> execute close -> onDoorEscapeResult ->
// rebuild input next frame -> evaluateEscapeLock -> lockDoorFromCommand ->
// DoorSystem.lock -> onDoorLockResult. The Human's visibility is supplied the
// way ThreeGame.ts:396 supplies it, so the closed-door sight loss is reproduced.

const doorNode = { id: 'D1', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'left', connectedRoomB: 'right' };
const human = { x: -2, z: 0 };
const goal = { x: 3, z: 0 };
const rice1 = { id: 'rice_1', x: 3, z: 1, progressMs: 0, maxProgressMs: 5000, completed: false };
const rice2 = { id: 'rice_2', x: 3, z: -1, progressMs: 0, maxProgressMs: 5000, completed: false };

function makeNav({ escapeBlocked = false, riceBlocked = false } = {}) {
  return { findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
    const doorBlocked = blocked?.has('D1') ?? false;
    const isRice = typeof target.id === 'string';
    if (isRice ? (riceBlocked && doorBlocked) : (escapeBlocked && doorBlocked)) return null;
    const steps = [{ ...start, doorId: null }];
    // A pursuer starting beyond the door must pass through it.
    if (start.x < 0) steps.push({ x: 0, z: 0, doorId: 'D1' });
    steps.push({ x: target.x, z: target.z, doorId: null });
    return steps;
  } };
}

const distanceOf = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function createHarness({ escapeBlocked = false, riceBlocked = false } = {}) {
  const ai = new DeepSeekAIController(makeNav({ escapeBlocked, riceBlocked }), [doorNode]);
  const doors = new DoorSystem([doorNode], C.door.maxActiveLocks);
  // EVADE context that the real close established.
  ai.state = 'EVADE';
  ai.escapeTarget = goal;
  ai.path = [{ ...goal, doorId: null }];
  ai.pathIndex = 0;
  ai.escapeReplanRemainingMs = 1000;
  ai.escapeGoalHoldRemainingMs = 1000;
  ai.threatEstimate = human;

  const frame = ({ position, visibleHuman, sprintState = 'NORMAL', deltaMs = 16,
    captureProgressMs = 0, canLockOverride }) => {
    const input = {
      deltaMs, deepseek: position, rice: [rice1, rice2], doors: doors.doors,
      canOpenDoor: () => true, canCloseDoor: () => true,
      canLockDoor: canLockOverride ?? (id => {
        const node = doors.definition(id);
        return !!node &&
          distanceToDoorSegment(position.x, position.z, node) <= C.door.interactionRange;
      }),
      activeLockSlots: C.door.maxActiveLocks - doors.activeLockedDoorCount,
      visibleHuman, sprintState, captureProgressMs,
    };
    // update() performs these two steps before dispatching into updateSafety.
    ai.elapsedMs += deltaMs;
    ai.trackDoorCrossings(input);
    const threat = visibleHuman
      ? { source: 'VISION', point: { ...visibleHuman },
          level: distanceOf(position, visibleHuman) <= C.deepseekAI.visionEvadeDistance
            ? 'HIGH' : 'CAUTION',
          visibleDistance: distanceOf(position, visibleHuman), audibleStrength: 0 }
      : { source: 'LAST_SEEN', level: 'CAUTION', point: { ...human },
          visibleDistance: null, audibleStrength: 0 };
    const command = ai.updateSafety(input, threat, deltaMs);
    // ThreeGame command execution, mirroring ThreeGame.ts close/lock branches.
    let closeResult = null;
    let lockResult = null;
    if (command.closeDoorId) {
      const node = doors.definition(command.closeDoorId);
      const valid = !!node && doors.get(command.closeDoorId)?.state === 'OPEN' &&
        distanceToDoorSegment(position.x, position.z, node) <= C.door.interactionRange;
      closeResult = valid
        ? doors.toggle(command.closeDoorId, 'DEEPSEEK', true) : 'BLOCKED_BY_ACTOR';
      ai.onDoorEscapeResult(command.closeDoorId, closeResult);
    }
    if (command.lockDoorId) {
      lockResult = lockDoorFromCommand(doors, command.lockDoorId, position,
        node => !!node, C.door.interactionRange);
      ai.onDoorLockResult(command.lockDoorId, lockResult);
    }
    return { command, closeResult, lockResult };
  };
  return { ai, doors, frame };
}


// Frames 1-2 are shared: approach from the far side, then cross the OPEN door.
function crossAndClose(harness, humanAt = human) {
  harness.frame({ position: { x: -0.4, z: 0 }, visibleHuman: humanAt });
  return harness.frame({ position: { x: 0.4, z: 0 }, visibleHuman: humanAt });
}

test('integration: the close-time side evidence carries the blind lock through', () => {
  const harness = createHarness();
  const closing = crossAndClose(harness);
  assert.equal(closing.command.closeDoorId, 'D1');
  assert.equal(closing.closeResult, 'CLOSED');
  assert.equal(harness.doors.get('D1').state, 'CLOSED');
  assert.equal(harness.ai.doorLockPendingId, 'D1');
  assert.equal(harness.ai.doorLockEvidenceDoorId, 'D1');
  // The closed leaf now blocks line of sight (PerceptionSystem.inspectVision
  // L83-91), so ThreeGame.ts:396 supplies visibleHuman = null.
  const after = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: null });
  assert.equal(after.command.lockDoorId, 'D1');
  assert.equal(after.lockResult, 'LOCKED');
  assert.equal(harness.doors.get('D1').state, 'LOCKED');
  assert.equal(harness.ai.doorLockUsedEvidence, true);
  assert.equal(harness.ai.doorLockPendingId, null);
  const events = harness.ai.drainDoorLockEvents();
  assert.deepEqual(events.map(event => event.type),
    ['DOOR_LOCK_PENDING', 'DOOR_LOCK_EVALUATE', 'DOOR_LOCK_APPLY']);
  assert.equal(events[1].reason, 'D1:LOCK_WITH_CLOSE_SIDE_EVIDENCE');
  assert.equal(harness.ai.doorEscapeCloseCount, 1);
  assert.equal(harness.ai.doorLockPendingCount, 1);
  assert.equal(harness.ai.doorLockCommandCount, 1);
  assert.equal(harness.ai.doorLockAppliedCount, 1);
});

test('integration: when sight survives the close the same chain reaches LOCKED', () => {
  const harness = createHarness();
  const closing = crossAndClose(harness);
  assert.equal(closing.closeResult, 'CLOSED');
  assert.equal(harness.ai.doorLockPendingId, 'D1');
  const locking = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: human });
  assert.equal(locking.command.lockDoorId, 'D1');
  assert.equal(locking.lockResult, 'LOCKED');
  assert.equal(harness.doors.get('D1').state, 'LOCKED');
  assert.equal(harness.ai.doorLockPendingId, null);
  assert.equal(harness.ai.doorLockCommandCount, 1);
  assert.equal(harness.ai.doorLockAppliedCount, 1);
  assert.equal(harness.ai.doorLockUsedEvidence, false);
  assert.deepEqual(harness.ai.drainDoorLockEvents().map(event => event.type),
    ['DOOR_LOCK_PENDING', 'DOOR_LOCK_EVALUATE', 'DOOR_LOCK_APPLY']);
});

test('integration: a Human closing in cancels the pending lock', () => {
  const harness = createHarness();
  crossAndClose(harness);
  const after = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: { x: -1, z: 0 } });
  assert.equal(after.command.lockDoorId, null);
  assert.equal(harness.ai.doorLockSkipReason, 'HUMAN_APPROACHING');
});

test('integration: a running sprint no longer voids the door action', () => {
  const harness = createHarness();
  harness.frame({ position: { x: -0.4, z: 0 }, visibleHuman: human });
  // Cross the door while already sprinting: the close must still be issued.
  const closing = harness.frame({ position: { x: 0.4, z: 0 }, visibleHuman: human,
    sprintState: 'SPRINT_RUNNING' });
  assert.equal(closing.command.closeDoorId, 'D1');
  assert.equal(closing.closeResult, 'CLOSED');
  assert.equal(harness.ai.doorEscapeDuringSprintCount, 1);
  assert.equal(harness.ai.doorLockPendingId, 'D1');
  // The lock follows even though the sprint is still running.
  const locking = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: human,
    sprintState: 'SPRINT_RUNNING' });
  assert.equal(locking.command.lockDoorId, 'D1');
  assert.equal(locking.lockResult, 'LOCKED');
  assert.equal(harness.ai.doorLockDuringSprintCount, 1);
  assert.equal(harness.ai.doorLockAppliedCount, 1);
});

test('integration: the execution guard refuses an out-of-range lock and reports it', () => {
  const harness = createHarness();
  crossAndClose(harness);
  // The AI believes it can reach the door; the execution side re-checks.
  const after = harness.frame({ position: { x: 2.6, z: 0 }, visibleHuman: human,
    canLockOverride: () => true });
  assert.equal(after.command.lockDoorId, 'D1');
  assert.equal(after.lockResult, 'OUT_OF_RANGE');
  assert.equal(harness.doors.get('D1').state, 'CLOSED');
  assert.equal(harness.ai.doorLockPendingId, null);
  assert.equal(harness.ai.doorLockCommandCount, 1);
  assert.equal(harness.ai.doorLockAppliedCount, 0);
  assert.equal(harness.ai.doorLockLastResult, 'D1:OUT_OF_RANGE');
});

test('integration: a Human reopening the door clears pending without a retry', () => {
  const harness = createHarness();
  crossAndClose(harness);
  assert.equal(harness.ai.doorLockPendingId, 'D1');
  harness.doors.toggle('D1', 'HUMAN');            // Human reopens
  const after = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: human });
  assert.equal(after.command.lockDoorId, null);
  assert.equal(harness.ai.doorLockSkipReason, 'DOOR_REOPENED');
  assert.equal(harness.ai.doorLockPendingId, null);
  // No retry, and the close cooldown still prevents re-closing the same door.
  const later = harness.frame({ position: { x: 1.2, z: 0 }, visibleHuman: human });
  assert.equal(later.command.lockDoorId, null);
  assert.equal(harness.ai.doorLockPendingId, null);
  assert.equal(harness.ai.doorLockPendingCount, 1);
});

test('integration: reachability still gates the lock after a real close', () => {
  // The rice check is lock-only: the close itself never consults remaining rice.
  const sealedRice = createHarness({ riceBlocked: true });
  const closing = crossAndClose(sealedRice);
  assert.equal(closing.closeResult, 'CLOSED');
  const riceBlocked = sealedRice.frame({ position: { x: 1.0, z: 0 }, visibleHuman: human });
  assert.equal(riceBlocked.command.lockDoorId, null);
  assert.equal(sealedRice.ai.doorLockSkipReason, 'ALL_RICE_UNREACHABLE');

  // A sealed own escape route is already refused by the close, so no pending
  // lock is ever created in that case.
  const sealedRoute = createHarness({ escapeBlocked: true });
  const refused = crossAndClose(sealedRoute);
  assert.equal(refused.command.closeDoorId, null);
  assert.equal(sealedRoute.ai.doorEscapeSkipReason, 'ESCAPE_ROUTE_USES_DOOR');
  assert.equal(sealedRoute.ai.doorLockPendingCount, 0);
});

test('integration: a close that never saw the Human creates no pending lock', () => {
  const harness = createHarness();
  harness.ai.recentDoorCrossing.set('D1', 0);
  harness.ai.elapsedMs = 50;
  harness.doors.toggle('D1', 'DEEPSEEK', true);      // OPEN -> CLOSED, no sight used
  harness.ai.onDoorEscapeResult('D1', 'CLOSED');
  assert.equal(harness.ai.doorLockPendingId, null);
  assert.equal(harness.ai.doorLockPendingCount, 0);
  assert.equal(harness.ai.doorEscapeCloseCount, 1);
  assert.equal(harness.ai.doorLockSkipReason, 'NO_CLOSE_SIDE_EVIDENCE');
  const after = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: null });
  assert.equal(after.command.lockDoorId, null);
});

test('integration: re-sighting the Human overrides the evidence and cancels', () => {
  const harness = createHarness();
  crossAndClose(harness);
  const sameSide = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: { x: 2, z: 0 } });
  assert.equal(sameSide.command.lockDoorId, null);
  assert.equal(harness.ai.doorLockSkipReason, 'HUMAN_ALREADY_SAME_SIDE');

  const tooClose = createHarness();
  crossAndClose(tooClose);
  const close = tooClose.frame({ position: { x: 1.0, z: 0 }, visibleHuman: { x: -0.3, z: 0 } });
  assert.equal(close.command.lockDoorId, null);
  assert.equal(tooClose.ai.doorLockSkipReason, 'HUMAN_TOO_CLOSE');
});

test('integration: a cancelled action cannot hand its evidence to the next frame', () => {
  const harness = createHarness();
  crossAndClose(harness);
  harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: { x: 2, z: 0 } });  // cancels
  assert.equal(harness.ai.doorLockPendingId, null);
  assert.equal(harness.ai.doorLockEvidenceDoorId, null);
  // Force a pending without a new sight-confirmed close: it must not lock.
  harness.ai.doorLockPendingId = 'D1';
  harness.ai.doorLockPendingSinceMs = 0;
  const after = harness.frame({ position: { x: 1.0, z: 0 }, visibleHuman: null });
  assert.equal(after.command.lockDoorId, null);
  assert.equal(harness.ai.doorLockSkipReason, 'NO_CLOSE_SIDE_EVIDENCE');
});
