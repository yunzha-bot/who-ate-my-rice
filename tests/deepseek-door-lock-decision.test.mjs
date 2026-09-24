import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7B-3B / 3B-1: the pending-lock decision core. The lock channel from 3B-0b
// is reused; these tests drive evaluateEscapeLock through the real controller.

const node = { id: 'D1', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'CLOSED', connectedRoomA: 'left', connectedRoomB: 'right' };
const openNode = { ...node, initialState: 'OPEN' };
const ds = { x: 0.4, z: 0 };        // DeepSeek on the +x side of the door
const human = { x: -2, z: 0 };      // Human on the -x side (opposite, 2.4u away)
const goal = { x: 3, z: 0 };        // escape goal, reachable without D1
const rice1 = { id: 'rice_1', x: 3, z: 1, progressMs: 0, maxProgressMs: 5000, completed: false };
const rice2 = { id: 'rice_2', x: 3, z: -1, progressMs: 0, maxProgressMs: 5000, completed: false };

// findPath distinguishes the escape goal (plain Point) from rice (has id), and
// can independently make the escape route or every rice unreachable when D1 is blocked.
function makeNav({ escapeBlocked = false, riceBlocked = false } = {}) {
  return { findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
    const doorBlocked = blocked?.has('D1') ?? false;
    const isRice = typeof target.id === 'string';
    const unreachable = isRice ? (riceBlocked && doorBlocked) : (escapeBlocked && doorBlocked);
    return unreachable ? null : [{ ...start, doorId: null },
      { x: target.x, z: target.z, doorId: null }];
  } };
}

function makeInput(doors, overrides = {}) {
  return { deltaMs: 50, deepseek: ds, rice: [rice1, rice2], doors: doors.doors,
    canOpenDoor: () => true, canCloseDoor: () => true, canLockDoor: () => true,
    activeLockSlots: C.door.maxActiveLocks, visibleHuman: human, sprintState: 'NORMAL',
    ...overrides };
}

// A controller whose close already confirmed the far side by sight, holding a
// fresh pending lock on D1 inside its crossing window.
function readyController(nav = makeNav()) {
  const ai = new DeepSeekAIController(nav, [node]);
  ai.recentDoorCrossing.set('D1', 0);
  ai.elapsedMs = 100;
  ai.escapeTarget = goal;
  // evaluateEscapeDoor records this on the frame it chooses to close.
  ai.doorLockEvidence = { doorId: 'D1', deepseekSide: 1 };
  ai.doorLockEvidenceDoorId = 'D1';
  ai.doorLockPendingId = 'D1';
  return ai;
}

test('a safe close in EVADE continues into a legal lock on the next frame', () => {
  const ai = new DeepSeekAIController(makeNav(), [openNode]);
  const doors = new DoorSystem([openNode], C.door.maxActiveLocks);
  ai.recentDoorCrossing.set('D1', 0);
  ai.elapsedMs = 50;
  ai.escapeTarget = goal;
  assert.equal(doors.get('D1').state, 'OPEN');
  // evaluateEscapeDoor records the sight-confirmed far side on the close frame.
  ai.doorLockEvidence = { doorId: 'D1', deepseekSide: 1 };
  ai.doorLockEvidenceDoorId = 'D1';
  // Close (S7B-3A path), then the result establishes the pending lock.
  assert.equal(doors.toggle('D1', 'DEEPSEEK', true), 'CLOSED');
  ai.onDoorEscapeResult('D1', 'CLOSED');
  assert.equal(ai.doorLockPendingId, 'D1');
  // Next frame: the pending door is evaluated and locked.
  ai.elapsedMs = 100;
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), 'D1');
  assert.equal(doors.lock('D1', 'DEEPSEEK'), 'LOCKED');
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.equal(ai.doorLockPendingId, null);
  assert.equal(doors.get('D1').state, 'LOCKED');
});

test('the 5000ms close cooldown does not block the same pending lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.onDoorEscapeResult('D1', 'CLOSED');   // writes closedDoorAt + cooldown
  assert.ok(ai.doorEscapeCooldownRemainingMs > 0);
  assert.equal(ai.doorLockPendingId, 'D1');
  // The lock evaluation is the same continuous action and never consults the cooldown.
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), 'D1');
});

test('lock completion leaves the close cooldown intact for the same door', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.onDoorEscapeResult('D1', 'CLOSED');
  const closedAt = ai.closedDoorAt.get('D1');
  ai.evaluateEscapeLock(makeInput(doors), 0);
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.equal(ai.doorLockPendingId, null);
  // The lock never rewrites the cooldown settled at close time, so a re-close
  // of the same door remains gated for the rest of the 5000ms window.
  assert.equal(ai.closedDoorAt.get('D1'), closedAt);
  assert.ok(ai.doorEscapeCooldownRemainingMs > 0);
  assert.ok(ai.elapsedMs - closedAt < C.deepseekAI.doorEscapeCooldownMs);
});

test('ordinary HIGH visual pursuit does not by itself cancel a legal lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  // Human visible at 2.4u (<= visionEvadeDistance 5 => HIGH) but not approaching.
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), 'D1');
  assert.equal(ai.doorLockSkipReason, 'NONE');
});

test('approaching, same-side, too-close, or capture progress cancels the lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: 2, z: 0 } }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'HUMAN_ALREADY_SAME_SIDE');
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: -0.3, z: 0 } }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'HUMAN_TOO_CLOSE');
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: -1.5, z: 0 } }), 0.4), null);
  assert.equal(ai.doorLockSkipReason, 'HUMAN_APPROACHING');
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { captureProgressMs: 10 }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'CAPTURE_IN_PROGRESS');
});

test('a running sprint no longer voids a legal lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  // The lock is a one-shot door action that never interrupts the sprint, so the
  // sprint commitment (and its 30% risk outcome) survives while it runs.
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { sprintState: 'SPRINT_RUNNING' }), 0), 'D1');
  assert.equal(ai.doorLockDuringSprintCount, 1);
  assert.equal(ai.doorLockSkipReason, 'NONE');
});

test('STUNNED, a reopened door, or an expired window cancels the lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { sprintState: 'STUNNED' }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'STUNNED');
  // Human reopens the door.
  ai.doorLockPendingId = 'D1';
  doors.toggle('D1', 'DEEPSEEK');           // CLOSED -> OPEN
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.doorLockSkipReason, 'DOOR_REOPENED');
  // Window expired.
  doors.toggle('D1', 'DEEPSEEK');           // back to CLOSED
  ai.doorLockPendingId = 'D1';
  ai.elapsedMs = 5000;
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.doorLockSkipReason, 'CROSSING_WINDOW_EXPIRED');
});

test('full lock budget, disabled core, and execution refusal end the action', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { activeLockSlots: 0 }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'LOCK_LIMIT_REACHED');
  ai.doorLockPendingId = 'D1';
  doors.lock('D1', 'DEEPSEEK');              // LOCKED
  doors.disableLock('D1', 'HUMAN');          // CLOSED + DISABLED core
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.doorLockSkipReason, 'LOCK_CORE_UNAVAILABLE');
  // Execution-side refusal (lockDoorFromCommand -> OUT_OF_RANGE) also ends it.
  ai.doorLockPendingId = 'D1';
  ai.onDoorLockResult('D1', 'OUT_OF_RANGE');
  assert.equal(ai.doorLockPendingId, null);
  assert.equal(ai.doorLockLastResult, 'D1:OUT_OF_RANGE');
});

test('a lock that seals the only escape route is abandoned', () => {
  const ai = readyController(makeNav({ escapeBlocked: true }));
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.doorLockSkipReason, 'ESCAPE_ROUTE_USES_DOOR');
  assert.equal(ai.doorLockPendingId, null);
});

test('a lock that makes every uncompleted rice unreachable is abandoned', () => {
  const ai = readyController(makeNav({ riceBlocked: true }));
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.doorLockSkipReason, 'ALL_RICE_UNREACHABLE');
  assert.equal(ai.doorLockPendingId, null);
});

test('a blocked default exit is fine when an alternate escape route exists', () => {
  const nav = { findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
    // D1 is blocked, but a route through another door D2 remains available.
    return blocked?.has('D1')
      ? [{ ...start, doorId: null }, { x: target.x, z: target.z, doorId: 'D2' }]
      : [{ ...start, doorId: null }, { x: target.x, z: target.z, doorId: 'D1' }];
  } };
  const ai = readyController(nav);
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), 'D1');
});

test('evaluation, skip, apply and fail are distinct bounded events', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  // skip
  ai.doorLockPendingId = 'D1';
  ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: 2, z: 0 } }), 0);
  assert.deepEqual(ai.drainDoorLockEvents(),
    [{ type: 'DOOR_LOCK_SKIP', reason: 'D1:HUMAN_ALREADY_SAME_SIDE' }]);
  // evaluate + apply
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), 'D1');
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.deepEqual(ai.drainDoorLockEvents().map(event => event.type),
    ['DOOR_LOCK_EVALUATE', 'DOOR_LOCK_APPLY']);
  // a fresh pending is required; the old one is gone
  assert.equal(ai.doorLockPendingId, null);
  assert.equal(ai.evaluateEscapeLock(makeInput(doors), 0), null);
  assert.equal(ai.drainDoorLockEvents().length, 0);
});

test('a blind lock uses only the close-time side evidence and reports it', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  // No current sight: the door we just shut is what hides the Human.
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), 'D1');
  assert.equal(ai.doorLockUsedEvidence, true);
  assert.deepEqual(ai.drainDoorLockEvents(),
    [{ type: 'DOOR_LOCK_EVALUATE', reason: 'D1:LOCK_WITH_CLOSE_SIDE_EVIDENCE' }]);
});

test('fresh sight overrides the stored evidence and can cancel the lock', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: 2, z: 0 } }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'HUMAN_ALREADY_SAME_SIDE');
  assert.equal(ai.doorLockUsedEvidence, false);
  ai.doorLockEvidence = { doorId: 'D1', deepseekSide: 1 };
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: -0.3, z: 0 } }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'HUMAN_TOO_CLOSE');
});

test('close-time evidence never crosses doors, actions or the window', () => {
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  const otherDoor = readyController();
  otherDoor.doorLockEvidence = { doorId: 'D9', deepseekSide: 1 };
  assert.equal(otherDoor.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), null);
  assert.equal(otherDoor.doorLockSkipReason, 'NO_CLOSE_SIDE_EVIDENCE');

  const noEvidence = readyController();
  noEvidence.doorLockEvidence = null;
  assert.equal(noEvidence.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), null);
  assert.equal(noEvidence.doorLockSkipReason, 'NO_CLOSE_SIDE_EVIDENCE');

  const expired = readyController();
  expired.elapsedMs = 5000;
  assert.equal(expired.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), null);
  assert.equal(expired.doorLockSkipReason, 'CROSSING_WINDOW_EXPIRED');

  // DeepSeek itself ended up on the other side of the recorded evidence.
  const flipped = readyController();
  flipped.doorLockEvidence = { doorId: 'D1', deepseekSide: -1 };
  assert.equal(flipped.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), null);
  assert.equal(flipped.doorLockSkipReason, 'DEEPSEEK_SIDE_CHANGED');
});

test('a consumed or cancelled action cannot hand its evidence to the next one', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0);
  ai.onDoorLockResult('D1', 'LOCKED');
  assert.equal(ai.doorLockEvidenceDoorId, null);
  ai.doorLockPendingId = 'D1';
  assert.equal(ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: null }), 0), null);
  assert.equal(ai.doorLockSkipReason, 'NO_CLOSE_SIDE_EVIDENCE');
});

test('separate continuous actions keep their own key events', () => {
  const ai = readyController();
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: 2, z: 0 } }), 0);
  assert.deepEqual(ai.drainDoorLockEvents().map(event => event.type), ['DOOR_LOCK_SKIP']);
  // A second action on the same door with the same reason must still be recorded.
  ai.recentDoorCrossing.set('D1', ai.elapsedMs);
  ai.doorLockEvidence = { doorId: 'D1', deepseekSide: 1 };
  ai.onDoorEscapeResult('D1', 'CLOSED');
  ai.evaluateEscapeLock(makeInput(doors, { visibleHuman: { x: 2, z: 0 } }), 0);
  const events = ai.drainDoorLockEvents();
  assert.deepEqual(events.map(event => event.type), ['DOOR_LOCK_PENDING', 'DOOR_LOCK_SKIP']);
  assert.equal(events[1].reason, 'D1:HUMAN_ALREADY_SAME_SIDE');
});
