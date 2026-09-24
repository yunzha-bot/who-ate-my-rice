import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem, lockDoorFromCommand, distanceToDoorSegment }
  from '../src/systems/DoorSystem.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

// S7B-3B-3 targeted regression: long-run, cross-system invariants of the
// close -> pending -> lock pipeline. These deliberately run many simulated
// encounters instead of a single action, so they can catch drift that
// single-action unit tests cannot: stale pending, repeated closes of the same
// door, sealed rice routes, and log events being missed or emitted every frame.
//
// This is a deterministic simulation, NOT a real browser match; it must never be
// reported as 实机长局验收.

const doorA = { id: 'DA', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'left', connectedRoomB: 'mid' };
const doorB = { id: 'DB', x: 8, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'mid', connectedRoomB: 'right' };
const doorC = { id: 'DC', x: 16, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'right', connectedRoomB: 'far' };
const doors = [doorA, doorB, doorC];
const rooms = [
  { id: 'left', minX: -8, maxX: -2, minZ: -4, maxZ: 4 },
  { id: 'mid', minX: 2, maxX: 6, minZ: -4, maxZ: 4 },
  { id: 'right', minX: 10, maxX: 14, minZ: -4, maxZ: 4 },
  { id: 'far', minX: 18, maxX: 22, minZ: -4, maxZ: 4 },
];
const riceMid = { id: 'rice_mid', x: 3, z: 2, progressMs: 0, maxProgressMs: 5000, completed: false };
const riceLeft = { id: 'rice_left', x: -3, z: 2, progressMs: 0, maxProgressMs: 5000, completed: false };
const distanceOf = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Deterministic RNG so escape-goal selection cannot make a run flaky.
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function makeNav() {
  return {
    nearestFree: room => ({ x: (room.minX + room.maxX) / 2,
      z: (room.minZ + room.maxZ) / 2 }),
    findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
      const steps = [{ ...start, doorId: null }];
      for (const node of doors) {
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

function createRun() {
  const ai = new DeepSeekAIController(makeNav(), doors, rooms, seeded(20240924));
  const system = new DoorSystem(doors, C.door.maxActiveLocks);
  ai.state = 'EVADE';
  ai.threatEstimate = { x: -3, z: 0 };
  const log = [];
  const closeTimes = new Map(doors.map(door => [door.id, []]));
  const lockCommands = new Map();
  const violations = [];

  const inputAt = (position, opts = {}) => {
    const { visibleHuman = { x: -2.5, z: 0 }, sprintState = 'NORMAL',
      canLock, deltaMs = 100 } = opts;
    return { deltaMs, deepseek: position, rice: [riceMid, riceLeft], doors: system.doors,
      canOpenDoor: () => true, canCloseDoor: () => true,
      canLockDoor: canLock ?? (id => {
        const node = system.definition(id);
        return !!node && distanceToDoorSegment(position.x, position.z, node) <=
          C.door.interactionRange;
      }),
      activeLockSlots: C.door.maxActiveLocks - system.activeLockedDoorCount,
      visibleHuman, sprintState };
  };

  // Mirrors ThreeGame's per-frame order: ai.update() (crossings, door-signature
  // replan, threat assessment) -> execute close/lock commands -> feed receipts.
  const frame = (position, opts = {}) => {
    const input = inputAt(position, opts);
    const before = ai.elapsedMs;
    const command = ai.update(input);
    let closeResult = null;
    let lockResult = null;
    if (command.closeDoorId) {
      const id = command.closeDoorId;
      const node = system.definition(id);
      const valid = !!node && system.get(id)?.state === 'OPEN' &&
        distanceToDoorSegment(position.x, position.z, node) <= C.door.interactionRange;
      closeResult = valid ? system.toggle(id, 'DEEPSEEK', true) : 'BLOCKED_BY_ACTOR';
      closeTimes.get(id).push(before + input.deltaMs);
      ai.onDoorEscapeResult(id, closeResult);
    }
    if (command.lockDoorId) {
      const id = command.lockDoorId;
      lockCommands.set(id, (lockCommands.get(id) ?? 0) + 1);
      lockResult = lockDoorFromCommand(system, id, position,
        node => !!node, C.door.interactionRange);
      ai.onDoorLockResult(id, lockResult);
    }
    for (const event of ai.drainDoorLockEvents()) log.push({ t: ai.elapsedMs, ...event });
    // Invariants checked on every single frame.
    if (system.activeLockedDoorCount > C.door.maxActiveLocks)
      violations.push(`lock budget exceeded (${system.activeLockedDoorCount})`);
    if (ai.doorLockPendingId) {
      if (ai.state !== 'EVADE') violations.push(`pending while ${ai.state}`);
      const age = ai.elapsedMs - (ai.doorLockPendingSinceMs ?? ai.elapsedMs);
      if (age > C.deepseekAI.doorEscapeCrossingWindowMs + input.deltaMs)
        violations.push(`stale pending age=${age}`);
    }
    return { command, closeResult, lockResult };
  };

  // Scripted Human counterplay so the same door can be used again later.
  const humanCounterplay = id => {
    const door = system.get(id);
    if (!door) return;
    if (door.state === 'LOCKED') system.disableLock(id, 'HUMAN');
    if (system.get(id).state !== 'OPEN') system.toggle(id, 'HUMAN');
  };

  return { ai, system, frame, inputAt, closeTimes, lockCommands, violations,
    log, humanCounterplay };
}

// One scripted door encounter: approach, cross, then let the pipeline settle.
function encounter(run, { x0 = -0.4, x1 = 0.4, x2 = 1.4, human = -2.5,
  settle = 3 } = {}) {
  run.frame({ x: x0, z: 0 }, { visibleHuman: { x: human, z: 0 } });
  const closing = run.frame({ x: x1, z: 0 }, { visibleHuman: { x: human, z: 0 } });
  const results = [closing];
  for (let i = 0; i < settle; i++)
    results.push(run.frame({ x: x2, z: 0 }, { visibleHuman: { x: human, z: 0 } }));
  return results;
}

test('long run: the same door is never closed twice inside its 5s cooldown', () => {
  const run = createRun();
  for (let cycle = 0; cycle < 40; cycle++) {
    encounter(run);
    run.humanCounterplay('DA');
    encounter(run, { x0: -0.4, x1: 0.4 });     // try again while still cooling down
  }
  for (const [id, times] of run.closeTimes) {
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      assert.ok(gap >= C.deepseekAI.doorEscapeCooldownMs,
        `${id} closed again after only ${gap}ms`);
    }
  }
  assert.deepEqual(run.violations, []);
  assert.ok(run.ai.doorEscapeCloseCount >= 2, 'the run must actually close doors');
});

test('long run: no stale pending, at most one lock command per action', () => {
  const run = createRun();
  let lastPendingCount = 0;
  for (let cycle = 0; cycle < 30; cycle++) {
    encounter(run);
    if (run.ai.doorLockPendingCount > lastPendingCount) {
      lastPendingCount = run.ai.doorLockPendingCount;
      // A fresh action may issue at most one command during the following frames.
      const before = run.ai.doorLockCommandCount;
      encounter(run, { x0: 1.4, x1: 1.5, x2: 1.6, settle: 2 });
      assert.ok(run.ai.doorLockCommandCount - before <= 1,
        'a single continuous action issued more than one lock command');
    }
    run.humanCounterplay('DA');
  }
  assert.equal(run.ai.doorLockPendingId, null, 'run ended holding a pending lock');
  assert.equal(run.ai.doorLockPendingSinceMs, null);
  assert.equal(run.ai.doorLockEvidence, null);
  assert.deepEqual(run.violations, []);
});

test('long run: cancel conditions never leave a pending behind', () => {
  const run = createRun();
  const conditions = [
    { visibleHuman: { x: 2, z: 0 } },                    // same side
    { visibleHuman: { x: -0.3, z: 0 } },                 // too close
    { visibleHuman: { x: -1.5, z: 0 } },                 // approaching
    { visibleHuman: { x: -2.5, z: 0 }, captureProgressMs: 10 },
    { visibleHuman: null },                              // lost sight -> evidence path
  ];
  for (let cycle = 0; cycle < 25; cycle++) {
    const condition = conditions[cycle % conditions.length];
    run.frame({ x: -0.4, z: 0 }, { visibleHuman: { x: -2.5, z: 0 } });
    run.frame({ x: 0.4, z: 0 }, { visibleHuman: { x: -2.5, z: 0 } });   // close
    for (let i = 0; i < 3; i++) run.frame({ x: 1.2, z: 0 }, condition);
    assert.equal(run.ai.doorLockPendingId, null, `pending survived ${JSON.stringify(condition)}`);
    run.humanCounterplay('DA');
  }
  assert.deepEqual(run.violations, []);
});

test('long run: locked doors never seal every remaining rice route', () => {
  const run = createRun();
  for (let cycle = 0; cycle < 20; cycle++) {
    encounter(run);
    run.humanCounterplay('DA');
  }
  const locked = new Set(run.system.doors.filter(door => door.state === 'LOCKED')
    .map(door => door.id));
  const reachable = [riceMid, riceLeft].filter(rice =>
    !!run.ai.navigation.findPath({ x: 1.4, z: 0 }, rice, run.system.doors,
      undefined, null, locked));
  assert.ok(reachable.length >= 1, `all rice sealed behind ${[...locked].join(',')}`);
});

test('long run: lock log events are bounded and never repeat every frame', () => {
  const run = createRun();
  const perFrame = [];
  for (let cycle = 0; cycle < 30; cycle++) {
    const before = run.log.length;
    encounter(run);
    perFrame.push(run.log.length - before);
    run.humanCounterplay('DA');
  }
  assert.ok(Math.max(...perFrame, 0) <= 3, 'too many lock events in one frame');
  assert.ok(perFrame.filter(count => count > 0).length < perFrame.length / 2,
    'lock events were emitted on most frames (log spam)');
  for (let i = 1; i < run.log.length; i++) {
    if (run.log[i].t === run.log[i - 1].t) continue;
    assert.notEqual(`${run.log[i].type}:${run.log[i].reason}`,
      `${run.log[i - 1].type}:${run.log[i - 1].reason}`,
      'the same lock event repeated on consecutive frames');
  }
  // No key event may be dropped: every counter has its matching log record.
  assert.equal(run.log.filter(event => event.type === 'DOOR_LOCK_PENDING').length,
    run.ai.doorLockPendingCount);
  assert.equal(run.log.filter(event => event.type === 'DOOR_LOCK_EVALUATE').length,
    run.ai.doorLockCommandCount);
  assert.equal(run.log.filter(event => event.type === 'DOOR_LOCK_APPLY').length,
    run.ai.doorLockAppliedCount);
  assert.equal(run.log.filter(event => event.type === 'DOOR_LOCK_CANCEL').length,
    run.ai.doorLockCancelCount);
  assert.ok(run.ai.doorLockPendingCount >= run.ai.doorLockCommandCount);
  assert.ok(run.ai.doorLockCommandCount >= run.ai.doorLockAppliedCount);
});

test('long run: door state and dynamic collision stay in sync across many cycles', () => {
  const world = new CollisionWorld(40, 20, []);
  const view = new DoorView(doorA, 0, false);
  const radius = C.collision.playerRadius;
  const start = new Vector3(doorA.x - 0.7, 0.35, doorA.z);
  for (let cycle = 0; cycle < 12; cycle++) {
    world.setDynamicObstacle(doorA.id, null);                       // OPEN
    assert.ok(world.move(start, 1.4, 0, radius, 0.7).distanceTo(start) > 1.2,
      `cycle ${cycle}: an open door blocked movement`);
    world.setDynamicObstacle(doorA.id, view.closedCollisionBox());   // CLOSED/LOCKED
    assert.ok(world.move(start, 1.4, 0, radius, 0.7).distanceTo(start) < 0.6,
      `cycle ${cycle}: a closed door let the actor through`);
  }
  // Ending open must leave no stale obstacle behind from the earlier cycles.
  world.setDynamicObstacle(doorA.id, null);
  assert.ok(world.move(start, 1.4, 0, radius, 0.7).distanceTo(start) > 1.2,
    'a stale door obstacle survived after the door reopened');
  view.dispose();
});

test('long run: the escape target does not flip every frame', () => {
  const run = createRun();
  const changes = [];
  let previous = null;
  for (let frameIndex = 0; frameIndex < 600; frameIndex++) {
    // Real replanning: escapeReplanRemainingMs is left at 0 on purpose.
    run.frame({ x: 1.2, z: 0 }, { visibleHuman: { x: -2.5, z: 0 } });
    const current = run.ai.escapeTarget;
    if (previous && current && (previous.x !== current.x || previous.z !== current.z))
      changes.push(frameIndex);
    previous = current ? { ...current } : null;
  }
  assert.ok(run.ai.escapeTarget, 'a long escape must keep a goal');
  for (let i = 1; i < changes.length; i++)
    assert.ok(changes[i] - changes[i - 1] > 1,
      'escape target changed on consecutive frames');
  assert.ok(changes.length < 600 / 4,
    `escape target changed ${changes.length} times in 600 frames`);
  assert.deepEqual(run.violations, []);
});
