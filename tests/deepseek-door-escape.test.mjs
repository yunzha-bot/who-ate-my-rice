import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { AILogCollector } from '../src/systems/AILogCollector.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

const node = { id: 'D1', x: 0, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'OPEN', connectedRoomA: 'left', connectedRoomB: 'right' };
const ds = { x: 0.4, z: 0 };
const human = { x: -2, z: 0 };
const goal = { x: 3, z: 0 };

function setup({ routeSafe = true, pursuitUsesDoor = true } = {}) {
  const nav = { findPath(start, target, _doors, _avoid, _lockedCost, blocked) {
    if (blocked?.has('D1') && !routeSafe) return null;
    return [{ ...start, doorId: null },
      { ...target, doorId: start.x < 0 && pursuitUsesDoor ? 'D1' : null }];
  } };
  const ai = new DeepSeekAIController(nav, [node]);
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  const makeInput = (position = ds, visibleHuman = human) => ({
    deltaMs: 50, deepseek: position, rice: [], doors: doors.doors,
    canOpenDoor: () => true, canCloseDoor: () => true,
    visibleHuman, sprintState: 'NORMAL',
  });
  ai.trackDoorCrossings(makeInput({ x: -0.4, z: 0 }));
  ai.elapsedMs = 50;
  ai.trackDoorCrossings(makeInput());
  ai.state = 'EVADE';
  ai.escapeTarget = goal;
  ai.path = [{ ...ds, doorId: null }, { ...goal, doorId: null }];
  ai.escapeReplanRemainingMs = 1_000;
  ai.escapeGoalHoldRemainingMs = 1_000;
  ai.threatEstimate = human;
  return { ai, doors, makeInput };
}

test('crossed door with pursuer behind closes through DoorSystem, then continues escape', () => {
  const { ai, doors, makeInput } = setup();
  const command = ai.updateSafety(makeInput(), { source: 'VISION', level: 'HIGH',
    point: human, visibleDistance: 2.4, audibleStrength: 0 }, 50);
  assert.equal(command.closeDoorId, 'D1');
  assert.deepEqual(command.direction, { x: 0, z: 0 });
  const result = doors.toggle(command.closeDoorId, 'DEEPSEEK', true);
  ai.onDoorEscapeResult('D1', result);
  assert.equal(result, 'CLOSED');
  assert.equal(doors.get('D1').state, 'CLOSED');
  assert.deepEqual(ai.drainDoorEscapeEvents().map(event => event.type),
    ['DOOR_ESCAPE_EVALUATE', 'DOOR_ESCAPE_CLOSE']);
  assert.equal(ai.evaluateEscapeDoor(makeInput()), null);
  assert.equal(ai.doorEscapeReason, 'NO_NEARBY_OPEN_DOOR');
});

test('same-side Human, unsafe proximity, blocked escape, and unknown side skip closing', () => {
  const { ai, makeInput } = setup();
  assert.equal(ai.evaluateEscapeDoor(makeInput(ds, { x: 2, z: 0 })), null);
  assert.equal(ai.doorEscapeReason, 'HUMAN_ALREADY_SAME_SIDE');
  assert.equal(ai.evaluateEscapeDoor(makeInput(ds, { x: -0.3, z: 0 })), null);
  assert.equal(ai.doorEscapeReason, 'HUMAN_TOO_CLOSE');
  assert.equal(ai.evaluateEscapeDoor(makeInput(ds, null)), null);
  assert.equal(ai.doorEscapeReason, 'HUMAN_SIDE_UNKNOWN');
  const unsafe = setup({ routeSafe: false });
  assert.equal(unsafe.ai.evaluateEscapeDoor(unsafe.makeInput()), null);
  assert.equal(unsafe.ai.doorEscapeReason, 'ESCAPE_ROUTE_USES_DOOR');
});

test('no useful door preserves EVADE; no repeated close after Human reopens', () => {
  const { ai, doors, makeInput } = setup({ pursuitUsesDoor: false });
  assert.equal(ai.evaluateEscapeDoor(makeInput()), null);
  assert.equal(ai.doorEscapeReason, 'DOOR_DOES_NOT_DELAY_PURSUER');
  const useful = setup();
  useful.ai.onDoorEscapeResult('D1', 'CLOSED');
  assert.equal(useful.ai.evaluateEscapeDoor(useful.makeInput()), null);
  assert.equal(useful.ai.doorEscapeReason, 'DOOR_COOLDOWN');
  assert.equal(doors.get('D1').state, 'OPEN');
  assert.equal(useful.ai.evaluateEscapeDoor(useful.makeInput(ds, null)), null);
  assert.equal(useful.ai.state, 'EVADE');
});

test('unpassed or occupied door is skipped; restart clears cooldown and crossing memory', () => {
  const { ai, makeInput } = setup();
  const input = { ...makeInput(), canCloseDoor: () => false };
  assert.equal(ai.evaluateEscapeDoor(input), null);
  assert.equal(ai.doorEscapeReason, 'DOOR_OCCUPIED_OR_INACCESSIBLE');
  ai.onDoorEscapeResult('D1', 'BLOCKED_BY_ACTOR');
  ai.reset();
  assert.equal(ai.doorEscapeCooldownRemainingMs, 0);
  ai.escapeTarget = goal;
  assert.equal(ai.evaluateEscapeDoor(makeInput()), null);
  assert.equal(ai.doorEscapeReason, 'DOOR_NOT_RECENTLY_PASSED');
});

test('evaluation and close are separate bounded AI log events', () => {
  const { ai, makeInput } = setup();
  const logger = new AILogCollector();
  logger.startMatch();
  ai.evaluateEscapeDoor(makeInput());
  ai.onDoorEscapeResult('D1', 'CLOSED');
  const events = ai.drainDoorEscapeEvents();
  assert.deepEqual(events.map(event => event.type),
    ['DOOR_ESCAPE_EVALUATE', 'DOOR_ESCAPE_CLOSE']);
  logger.diffSnapshot({ state: 'EVADE', targetRiceId: null,
    lastTransitionReason: 'THREAT_VISION', roomId: 'right',
    doorEscapeEvents: events });
  assert.deepEqual(logger.export().events.slice(0, 2).map(event => event.type),
    ['DOOR_ESCAPE_EVALUATE', 'DOOR_ESCAPE_CLOSE']);
  ai.evaluateEscapeDoor(makeInput());
  assert.deepEqual(ai.drainDoorEscapeEvents().map(event => event.type),
    ['DOOR_ESCAPE_SKIP']);
  ai.evaluateEscapeDoor(makeInput());
  assert.equal(ai.drainDoorEscapeEvents().length, 0);
});
