import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem, lockDoorFromCommand, distanceToDoorSegment }
  from '../src/systems/DoorSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7B-3B-2: anti-oscillation + repeat-lock protection. Covers the per-door 5s
// close cooldown, one lock attempt per continuous action, the pending/evidence
// lifecycle, per-door independence and the self-closed-door re-open guard.

const doorA = { id: 'DA', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'left', connectedRoomB: 'right' };
const doorB = { id: 'DB', x: 6, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'right', connectedRoomB: 'far' };
const human = { x: -2, z: 0 };
const goal = { x: 3, z: 0 };
const rice1 = { id: 'rice_1', x: 3, z: 1, progressMs: 0, maxProgressMs: 5000, completed: false };
const rooms = [
  { id: 'left', minX: -6, maxX: -2, minZ: -3, maxZ: 3 },
  { id: 'right', minX: 2, maxX: 6, minZ: -3, maxZ: 3 },
];
const distanceOf = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// A route crosses a door line only when start and goal sit on opposite sides, so
// blocking that door makes the route unreachable — like the real grid A*.
function makeNav() {
  const nodes = [doorA, doorB];
  return {
    nearestFree: room => ({ x: (room.minX + room.maxX) / 2,
      z: (room.minZ + room.maxZ) / 2 }),
    findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
      const steps = [{ ...start, doorId: null }];
      for (const node of nodes) {
        const axis = node.rotation === 0 ? 'z' : 'x';
        if ((start[axis] - node[axis]) * (target[axis] - node[axis]) >= 0) continue;
        if (blocked?.has(node.id)) return null;
        steps.push({ x: node.x, z: node.z, doorId: node.id });
      }
      steps.push({ x: target.x, z: target.z, doorId: null });
      return steps;
    },
  };
}

function createHarness({ roomList = rooms } = {}) {
  const ai = new DeepSeekAIController(makeNav(), [doorA, doorB], roomList);
  const doors = new DoorSystem([doorA, doorB], C.door.maxActiveLocks);
  ai.state = 'EVADE';
  ai.escapeTarget = goal;
  ai.path = [{ ...goal, doorId: null }];
  ai.pathIndex = 0;
  ai.escapeReplanRemainingMs = 1000;
  ai.escapeGoalHoldRemainingMs = 1000;
  ai.threatEstimate = human;

  const inputAt = (position, opts = {}) => {
    const { visibleHuman = human, sprintState = 'NORMAL', canLock } = opts;
    return { deltaMs: 16, deepseek: position, rice: [rice1], doors: doors.doors,
      canOpenDoor: () => true, canCloseDoor: () => true,
      canLockDoor: canLock ?? (id => {
        const node = doors.definition(id);
        return !!node && distanceToDoorSegment(position.x, position.z, node) <=
          C.door.interactionRange;
      }),
      activeLockSlots: C.door.maxActiveLocks - doors.activeLockedDoorCount,
      visibleHuman, sprintState };
  };
  const threatFor = (position, visibleHuman) => visibleHuman
    ? { source: 'VISION', point: { ...visibleHuman },
        level: distanceOf(position, visibleHuman) <= C.deepseekAI.visionEvadeDistance
          ? 'HIGH' : 'CAUTION',
        visibleDistance: distanceOf(position, visibleHuman), audibleStrength: 0 }
    : { source: 'LAST_SEEN', level: 'CAUTION', point: { ...human },
        visibleDistance: null, audibleStrength: 0 };
  const frame = (position, opts = {}) => {
    const input = inputAt(position, opts);
    ai.elapsedMs += input.deltaMs;
    ai.trackDoorCrossings(input);
    const command = ai.updateSafety(input, threatFor(position, input.visibleHuman),
      input.deltaMs);
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
  return { ai, doors, inputAt, frame };
}

function crossAndClose(harness) {
  harness.frame({ x: -0.4, z: 0 });
  return harness.frame({ x: 0.4, z: 0 });
}

test('one successful close yields exactly one lock attempt', () => {
  const h = createHarness();
  const closing = crossAndClose(h);
  assert.equal(closing.closeResult, 'CLOSED');
  assert.equal(h.ai.doorLockPendingCount, 1);
  const locking = h.frame({ x: 1.0, z: 0 });
  assert.equal(locking.lockResult, 'LOCKED');
  assert.equal(h.ai.doorLockCommandCount, 1);
  assert.equal(h.ai.doorLockAttemptedId, null);
  assert.equal(h.ai.doorLockRepeatBlockedCount, 0);
});

test('a lingering pending can never fire a second attempt for the same action', () => {
  const h = createHarness();
  crossAndClose(h);
  h.frame({ x: 1.0, z: 0 });                    // attempt consumed
  // Simulate a pending that survived an already-issued attempt.
  h.ai.doorLockPendingId = 'DA';
  h.ai.doorLockAttemptedId = 'DA';
  assert.equal(h.ai.evaluateEscapeLock(h.inputAt({ x: 1.0, z: 0 }), 0), null);
  assert.equal(h.ai.doorLockRepeatBlockedCount, 1);
  assert.equal(h.ai.doorLockCommandCount, 1);
});

test('a successful lock clears pending, the close-time evidence and the attempt', () => {
  const h = createHarness();
  crossAndClose(h);
  assert.equal(h.ai.doorLockEvidenceDoorId, 'DA');
  h.frame({ x: 1.0, z: 0 });
  assert.equal(h.ai.doorLockPendingId, null);
  assert.equal(h.ai.doorLockPendingSinceMs, null);
  assert.equal(h.ai.doorLockEvidence, null);
  assert.equal(h.ai.doorLockEvidenceDoorId, null);
  assert.equal(h.ai.doorLockAttemptedId, null);
});

test('a refused lock never repeats on the following frames', () => {
  const h = createHarness();
  crossAndClose(h);
  // The AI believes it can lock far away; the execution side refuses.
  const refused = h.frame({ x: 2.6, z: 0 }, { canLock: () => true });
  assert.equal(refused.lockResult, 'OUT_OF_RANGE');
  assert.equal(h.ai.doorLockCommandCount, 1);
  assert.equal(h.ai.doorLockPendingId, null);
  const next = h.frame({ x: 2.8, z: 0 }, { canLock: () => true });
  assert.equal(next.command.lockDoorId, null);
  assert.equal(h.ai.doorLockCommandCount, 1);
});

test('lock budget and a dead lock core refuse without ever retrying', () => {
  const full = createHarness();
  crossAndClose(full);
  full.frame({ x: 1.0, z: 0 }, { canLock: () => true });
  full.ai.doorLockPendingId = 'DA';
  const blocked = full.ai.evaluateEscapeLock(full.inputAt({ x: 1.0, z: 0 },
    { canLock: () => true }), 0);
  assert.equal(blocked, null);

  const dead = createHarness();
  crossAndClose(dead);
  dead.doors.lock('DA', 'DEEPSEEK');
  dead.doors.disableLock('DA', 'HUMAN');        // core dead, door CLOSED again
  assert.equal(dead.ai.doorLockPendingId, 'DA');
  assert.equal(dead.ai.evaluateEscapeLock(dead.inputAt({ x: 1.0, z: 0 }), 0), null);
  assert.equal(dead.ai.doorLockSkipReason, 'LOCK_CORE_UNAVAILABLE');
  assert.equal(dead.ai.doorLockPendingId, null);
});

test('a Human reopening the door inside 5s blocks an immediate re-close', () => {
  const h = createHarness();
  crossAndClose(h);
  h.doors.toggle('DA', 'HUMAN');                 // Human reopens
  const after = h.frame({ x: 0.5, z: 0 });
  assert.equal(after.command.closeDoorId, null);
  assert.equal(h.ai.doorEscapeSkipReason, 'DOOR_COOLDOWN');
  assert.equal(h.ai.doorEscapeCloseCount, 1);
});

test('after the cooldown the same door still needs a fresh real crossing', () => {
  const h = createHarness();
  crossAndClose(h);
  h.doors.toggle('DA', 'HUMAN');
  h.ai.elapsedMs += C.deepseekAI.doorEscapeCooldownMs + 100;
  // Cooldown over, but DeepSeek has not crossed again.
  h.ai.evaluateEscapeDoor(h.inputAt({ x: 0.5, z: 0 }));
  assert.equal(h.ai.doorEscapeSkipReason, 'DOOR_NOT_RECENTLY_PASSED');
  // A genuine new crossing re-enables the option (the cooldown no longer blocks).
  h.ai.trackDoorCrossings(h.inputAt({ x: -0.5, z: 0 }));
  h.ai.trackDoorCrossings(h.inputAt({ x: 0.5, z: 0 }));
  h.ai.evaluateEscapeDoor(h.inputAt({ x: 0.5, z: 0 }));
  assert.notEqual(h.ai.doorEscapeSkipReason, 'DOOR_NOT_RECENTLY_PASSED');
  assert.notEqual(h.ai.doorEscapeSkipReason, 'DOOR_COOLDOWN');
});

test('the 5s cooldown is per door and never blocks a different door', () => {
  const h = createHarness();
  h.ai.closedDoorAt.set('DA', h.ai.elapsedMs);          // DA is cooling down
  h.ai.recentDoorCrossing.set('DA', h.ai.elapsedMs);    // ...and was just crossed
  h.ai.recentDoorCrossing.set('DB', h.ai.elapsedMs);    // DB just crossed
  h.ai.elapsedMs += 10;
  h.ai.evaluateEscapeDoor(h.inputAt({ x: 6.4, z: 0 }));
  assert.notEqual(h.ai.doorEscapeSkipReason, 'DOOR_COOLDOWN');
  h.ai.elapsedMs += 10;
  h.ai.evaluateEscapeDoor(h.inputAt({ x: 0.4, z: 0 }));
  assert.equal(h.ai.doorEscapeSkipReason, 'DOOR_COOLDOWN');
});

test('escape planning never routes straight back through our own shut door', () => {
  const h = createHarness();
  h.ai.closedDoorAt.set('DA', h.ai.elapsedMs);
  h.ai.threatEstimate = { x: 1, z: 0 };         // pursuer close, so fleeing wants the far side
  h.ai.selectEscapeGoal(h.inputAt({ x: 1.0, z: 0 }), 'TEST', true);
  assert.ok(h.ai.path.length > 0, 'a route must still be found');
  assert.equal(h.ai.path.some(step => step.doorId === 'DA'), false);
  assert.equal(h.ai.lastEscapeDecisionReason.includes('SELF_CLOSED_FALLBACK'), false);
});

test('planning falls back instead of deadlocking when only that door leads anywhere', () => {
  const h = createHarness({ roomList: [rooms[0]] });   // only the far side is reachable
  h.ai.closedDoorAt.set('DA', h.ai.elapsedMs);
  h.ai.threatEstimate = { x: 1, z: 0 };
  h.ai.selectEscapeGoal(h.inputAt({ x: 1.0, z: 0 }), 'TEST', true);
  assert.equal(h.ai.lastEscapeDecisionReason, 'TEST_SELF_CLOSED_FALLBACK');
  assert.ok(h.ai.path.some(step => step.doorId === 'DA'));
});

test('followPath refuses to re-open our own freshly shut door and repaths', () => {
  const h = createHarness();
  h.doors.toggle('DA', 'DEEPSEEK');             // we shut it a moment ago
  h.ai.closedDoorAt.set('DA', h.ai.elapsedMs);
  h.ai.path = [{ x: 0, z: 0, doorId: 'DA' }, { x: 3, z: 0, doorId: null }];
  h.ai.pathIndex = 0;
  const command = h.ai.followPath(h.inputAt({ x: 0.4, z: 0 }), { x: 3, z: 0 });
  assert.equal(command.openDoorId, null);
  assert.equal(h.ai.lastNavigationReason, 'SELF_CLOSED_DOOR_REPATH');
  assert.equal(h.ai.path.length, 0);
  assert.equal(h.ai.doorEscapeSelfReopenBlockedCount, 1);
  // The log carries the door id, not just the navigation reason code.
  assert.deepEqual(h.ai.drainDoorEscapeEvents(),
    [{ type: 'DOOR_ESCAPE_SELF_CLOSED', reason: 'DA:REPATH_AVOID_SELF_CLOSED' }]);
});

test('a normal door that was not self-closed is still opened by followPath', () => {
  const h = createHarness();
  h.doors.toggle('DA', 'DEEPSEEK');             // CLOSED by someone else / long ago
  h.ai.path = [{ x: 0, z: 0, doorId: 'DA' }, { x: 3, z: 0, doorId: null }];
  h.ai.pathIndex = 0;
  const command = h.ai.followPath(h.inputAt({ x: 0.4, z: 0 }), { x: 3, z: 0 });
  assert.equal(command.openDoorId, 'DA');
});

test('a door interaction during a sprint keeps the committed 30% fall', () => {
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold,
    C.sprint.stunMs, C.sprint.cooldownMs);
  const h = createHarness();
  assert.equal(sprint.tryStart({ x: 1, y: 0 }, 0.5, 'AI_SAFE_SPRINT'), true);
  assert.equal(sprint.riskMode, 'FALL_ON_END');
  sprint.advance(100, { x: 1, y: 0 });
  const closing = h.frame({ x: -0.4, z: 0 }, { sprintState: 'SPRINT_RUNNING' });
  assert.equal(closing.closeResult, null);      // not crossed yet
  const crossing = h.frame({ x: 0.4, z: 0 }, { sprintState: 'SPRINT_RUNNING' });
  assert.equal(crossing.closeResult, 'CLOSED');
  const locking = h.frame({ x: 1.0, z: 0 }, { sprintState: 'SPRINT_RUNNING' });
  assert.equal(locking.lockResult, 'LOCKED');
  // The door actions never touched the sprint: it still runs its full duration
  // and still ends in the committed fall.
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  assert.equal(sprint.riskMode, 'FALL_ON_END');
  sprint.advance(C.sprint.durationMs, { x: 1, y: 0 });
  assert.equal(sprint.state, 'STUNNED');
  assert.equal(sprint.stunRemainingMs, C.sprint.stunMs);
});
