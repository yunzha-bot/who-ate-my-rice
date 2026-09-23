import test from 'node:test';
import assert from 'node:assert/strict';
import { HumanAIController, humanAiMovementSpeed, shouldRunHumanAI } from '../src/systems/HumanAIController.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { OrthographicCamera } from 'three';
import { PerceptionGeometry, SoundEventSystem } from '../src/systems/PerceptionSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';

const rooms = [
  { id: 'kitchen', x: 0, z: 0, minX: -2, maxX: 2, minZ: -2, maxZ: 2, major: true },
  { id: 'living', x: 8, z: 0, minX: 5, maxX: 11, minZ: -2, maxZ: 2, major: true },
];
const fakeNavigation = {
  nearestFree: goal => goal,
  findPath: (start, goal) => [{ ...start, doorId: null }, { ...goal, doorId: null }],
};
const input = overrides => ({ deltaMs: 50, human: { x: 0, z: 0 },
  visibleTarget: null, lastSeen: null, heard: null, captureEligible: false,
  doors: [], canOpenDoor: () => true, ...overrides });
const sound = (position, timestamp = 0) => ({ event: { type: 'FOOTSTEP', position,
  sourceFaction: 'DEEPSEEK', timestamp, strength: 0.35, lifetimeMs: 1400 } });

test('Human AI starts patrolling and investigates only the audible room', () => {
  const ai = new HumanAIController(fakeNavigation, rooms, []);
  ai.update(input());
  assert.equal(ai.state, 'PATROL');
  ai.update(input({ heard: sound({ x: 10, z: 1.4 }) }));
  assert.equal(ai.state, 'INVESTIGATE');
  assert.deepEqual(ai.target, { x: 8, z: 0 });
  assert.equal(ai.targetRoomId, 'living');
  assert.equal(ai.lastTransitionReason, 'SOUND_HEARD');
});

test('investigation uses the existing audible sound result, not an out-of-range event', () => {
  const ai = new HumanAIController(fakeNavigation, rooms, []);
  const events = new SoundEventSystem();
  const geometry = new PerceptionGeometry([], [], () => []);
  const camera = new OrthographicCamera();
  events.emit('FOOTSTEP', { x: 18, z: 0 }, 'DEEPSEEK');
  assert.equal(events.heardBy({ x: 0, z: 0 }, 'HUMAN', camera, geometry), null);
  ai.update(input({ heard: events.heardBy({ x: 0, z: 0 }, 'HUMAN', camera, geometry) }));
  assert.equal(ai.state, 'PATROL');
  events.emit('FOOTSTEP', { x: 8, z: 1 }, 'DEEPSEEK');
  const heard = events.heardBy({ x: 0, z: 0 }, 'HUMAN', camera, geometry);
  assert.ok(heard);
  ai.update(input({ heard }));
  assert.equal(ai.state, 'INVESTIGATE');
  assert.deepEqual(ai.target, { x: 8, z: 0 });
});

test('vision outranks sound; capture uses existing continuous match timer', () => {
  const ai = new HumanAIController(fakeNavigation, rooms, []);
  const lastSeen = { position: { x: 7, z: 1 }, timeMs: 50 };
  ai.update(input({ visibleTarget: { x: 7, z: 1 }, lastSeen,
    heard: sound({ x: 10, z: 1.4 }) }));
  assert.equal(ai.state, 'CHASE');
  assert.deepEqual(ai.target, { x: 7, z: 1 });
  ai.update(input({ visibleTarget: { x: 0.5, z: 0 }, lastSeen, captureEligible: true }));
  assert.equal(ai.state, 'CAPTURE');
  const match = new GameStateSystem(0, GAME_CONFIG.match.captureMs);
  match.advanceReady(0);
  match.advancePlaying(349, true, false);
  assert.equal(match.result, null);
  match.advancePlaying(1, true, false);
  assert.equal(match.result?.winner, 'HUMAN');
});

test('lost sight leads to last seen investigation, finite room search, and patrol', () => {
  const ai = new HumanAIController(fakeNavigation, rooms, []);
  const lastSeen = { position: { x: 8, z: 0 }, timeMs: 80 };
  ai.update(input({ visibleTarget: lastSeen.position, lastSeen }));
  ai.update(input({ lastSeen }));
  assert.equal(ai.state, 'INVESTIGATE');
  assert.equal(ai.lastTransitionReason, 'LOST_SIGHT');
  ai.update(input({ human: lastSeen.position, lastSeen, deltaMs: 1500 }));
  assert.equal(ai.state, 'INVESTIGATE');
  // A paused match does not call update, so its remaining investigation time freezes.
  ai.update(input({ human: lastSeen.position, lastSeen, deltaMs: 1499 }));
  assert.equal(ai.state, 'INVESTIGATE');
  ai.update(input({ human: lastSeen.position, lastSeen, deltaMs: 1 }));
  assert.equal(ai.state, 'SEARCH');
  assert.equal(ai.searchTargetRoomId, 'kitchen');
  ai.update(input({ human: { x: 0, z: 0 }, lastSeen,
    deltaMs: GAME_CONFIG.humanAI.searchDwellMs }));
  assert.equal(ai.state, 'PATROL');
  ai.reset();
  assert.equal(ai.state, 'PATROL');
  assert.equal(ai.target, null);
});

test('last seen search outranks sound and repeated footsteps cannot reset its dwell', () => {
  const ai = new HumanAIController(fakeNavigation, rooms, []);
  const lastSeen = { position: { x: 7, z: 1 }, timeMs: 80 };
  ai.update(input({ visibleTarget: lastSeen.position, lastSeen }));
  ai.update(input({ lastSeen, heard: sound({ x: 0, z: 0 }, 100) }));
  assert.equal(ai.state, 'INVESTIGATE');
  assert.deepEqual(ai.target, lastSeen.position);
  assert.equal(ai.lastTransitionReason, 'LOST_SIGHT');
  ai.update(input({ human: lastSeen.position, lastSeen, deltaMs: 2000,
    heard: sound({ x: 0, z: 0 }, 200) }));
  assert.equal(ai.state, 'INVESTIGATE');
  ai.update(input({ human: lastSeen.position, lastSeen, deltaMs: 1000 }));
  assert.equal(ai.state, 'SEARCH');
  ai.update(input({ human: { x: 0, z: 0 }, lastSeen,
    deltaMs: GAME_CONFIG.humanAI.searchDwellMs }));
  assert.equal(ai.state, 'PATROL');
});

test('AI compares a reachable detour with a locked route and avoids a similar-cost lock', () => {
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2,
    connectedRoomA: 'kitchen', connectedRoomB: 'living' };
  const nav = { nearestFree: goal => goal,
    findPath: (start, goal, doors, avoid, lockedCost = null) => lockedCost === null
      ? [{ ...start, doorId: null }, { x: 4, z: 0, doorId: null },
        { ...goal, doorId: null }]
      : [{ ...start, doorId: null }, { x: 0.6, z: 0, doorId: 'd' },
        { ...goal, doorId: null }] };
  const ai = new HumanAIController(nav, rooms, [node]);
  const door = { id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' };
  const command = ai.update(input({ doors: [door] }));
  assert.equal(ai.lockDecision, 'DETOUR');
  assert.equal(command.forceBreakDoorId, null);
  assert.equal(command.unlockDoorId, null);
});

test('AI uses real force break when a lock is the only route, then respects cooldown', () => {
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2,
    initialState: 'CLOSED', connectedRoomA: 'kitchen', connectedRoomB: 'living' };
  const nav = { nearestFree: goal => goal,
    findPath: (start, goal, doors, avoid, lockedCost = null, blocked) =>
      lockedCost === null || blocked?.has('d') ? null
        : [{ ...start, doorId: null }, { x: 0.6, z: 0, doorId: 'd' },
          { ...goal, doorId: null }] };
  const ai = new HumanAIController(nav, rooms, [node]);
  const door = { id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' };
  const force = ai.update(input({ doors: [door], forceBreakCooldownMs: 0 }));
  assert.equal(ai.lockDecision, 'FORCE_BREAK');
  assert.equal(force.forceBreakDoorId, 'd');
  const blocked = ai.update(input({ doors: [door], forceBreakCooldownMs: 30000 }));
  assert.equal(blocked.forceBreakDoorId, null);
  assert.equal(ai.lockDecision, 'UNLOCK');
});

test('AI unlock takes time, fails into a finite avoidance, and succeeds on a fresh try', () => {
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2,
    connectedRoomA: 'kitchen', connectedRoomB: 'living' };
  const nav = { nearestFree: goal => goal,
    findPath: (start, goal, doors, avoid, lockedCost = null, blocked) =>
      lockedCost === null || blocked?.has('d') ? null
        : [{ ...start, doorId: null }, { x: 0.6, z: 0, doorId: 'd' },
          { ...goal, doorId: null }] };
  let roll = 1;
  const ai = new HumanAIController(nav, rooms, [node], () => roll);
  const door = { id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' };
  const attempt = ms => ai.update(input({ doors: [door],
    forceBreakCooldownMs: 30000, deltaMs: ms }));
  assert.equal(attempt(GAME_CONFIG.humanAI.aiUnlockDurationMs - 1).unlockDoorId, null);
  assert.equal(ai.unlockProgressMs, GAME_CONFIG.humanAI.aiUnlockDurationMs - 1);
  const failure = attempt(1);
  assert.equal(failure.unlockDoorId, null);
  assert.equal(ai.unlockProgressMs, 0);
  assert.match(ai.lastNavigationReason, /AI_UNLOCK_FAILED/);
  assert.equal(attempt(100).unlockDoorId, null);
  roll = 0;
  attempt(GAME_CONFIG.humanAI.aiUnlockFailureAvoidMs);
  assert.equal(attempt(GAME_CONFIG.humanAI.aiUnlockDurationMs).unlockDoorId, 'd');
  ai.reset();
  assert.equal(ai.unlockProgressMs, 0);
  assert.equal(ai.targetDoorId, null);
});

test('AI movement uses a separate 0.92 multiplier; manual Human keeps its original speed', () => {
  const manualSpeed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
    GAME_CONFIG.human.speedMultiplier;
  assert.equal(GAME_CONFIG.humanAI.movementSpeedMultiplier, 0.92);
  assert.equal(humanAiMovementSpeed(manualSpeed),
    manualSpeed * GAME_CONFIG.humanAI.movementSpeedMultiplier);
  assert.ok(Math.abs(manualSpeed - 4.14) < 1e-9);
  assert.ok(Math.abs(humanAiMovementSpeed(manualSpeed) - 3.8088) < 1e-9);
  assert.equal(GAME_CONFIG.human.speedMultiplier, 1.08);
});

test('AI unlock tuning does not change force-break cooldown and reset clears AI state', () => {
  assert.equal(GAME_CONFIG.humanAI.aiUnlockDurationMs, 8_750);
  assert.equal(GAME_CONFIG.door.humanForceBreakCooldownMs, 30_000);
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2,
    connectedRoomA: 'kitchen', connectedRoomB: 'living' };
  const nav = { nearestFree: goal => goal,
    findPath: (start, goal, doors, avoid, lockedCost = null) => lockedCost === null
      ? null : [{ ...start, doorId: null }, { ...goal, doorId: 'd' }] };
  const ai = new HumanAIController(nav, rooms, [node], () => 0);
  ai.update(input({ doors: [{ id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' }],
    forceBreakCooldownMs: 30_000, deltaMs: 1_000 }));
  assert.equal(ai.unlockProgressMs, 1_000);
  assert.equal(shouldRunHumanAI('PAUSED', 'DEEPSEEK', 'DEEPSEEK',
    { x: 0, y: 0 }, true), false);
  // Paused frames do not call update(), so in-progress AI unlocking remains frozen.
  assert.equal(ai.unlockProgressMs, 1_000);
  ai.reset();
  assert.equal(ai.state, 'PATROL');
  assert.equal(ai.unlockProgressMs, 0);
});

test('AI force break uses Human skill cooldown and AI unlock leaves a closed door', () => {
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2,
    initialState: 'CLOSED', connectedRoomA: 'kitchen', connectedRoomB: 'living' };
  const nav = { nearestFree: goal => goal,
    findPath: (start, goal, doors, avoid, lockedCost = null) =>
      doors[0]?.state === 'LOCKED' && lockedCost === null ? null
        : [{ ...start, doorId: null }, { x: 0.6, z: 0, doorId: 'd' },
          { ...goal, doorId: null }] };
  const doors = new DoorSystem([node], 1);
  const skill = new HumanDoorSkill(doors, GAME_CONFIG.door.humanForceBreakCooldownMs);
  assert.equal(doors.lock('d', 'DEEPSEEK'), 'LOCKED');
  const ai = new HumanAIController(nav, rooms, [node], () => 0);
  const force = ai.update(input({ doors: doors.doors,
    forceBreakCooldownMs: skill.cooldownRemainingMs }));
  assert.equal(skill.use(force.forceBreakDoorId, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  assert.equal(doors.get('d').state, 'OPEN');
  assert.equal(doors.get('d').lockCoreState, 'DISABLED');
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.ok(skill.cooldownRemainingMs > 0);
  doors.reset();
  ai.reset();
  assert.equal(doors.lock('d', 'DEEPSEEK'), 'LOCKED');
  const unlock = ai.update(input({ doors: doors.doors,
    forceBreakCooldownMs: skill.cooldownRemainingMs,
    deltaMs: GAME_CONFIG.humanAI.aiUnlockDurationMs }));
  assert.equal(doors.disableLock(unlock.unlockDoorId, 'HUMAN'), 'UNLOCKED');
  assert.equal(doors.get('d').state, 'CLOSED');
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.equal(skill.cooldownRemainingMs, GAME_CONFIG.door.humanForceBreakCooldownMs);
  assert.equal(ai.update(input({ doors: doors.doors })).openDoorId, 'd');
});

test('patrol selects nearest unvisited reachable room and resumes after manual control', () => {
  const calls = [];
  const nav = { nearestFree: goal => goal, findPath: (start, goal, doors, avoid) => {
    calls.push(avoid);
    return [{ ...start, doorId: null }, { ...goal, doorId: null }];
  } };
  const ai = new HumanAIController(nav, rooms, []);
  ai.update(input());
  assert.equal(ai.targetRoomId, 'living'); // Kitchen was reached at the spawn.
  assert.ok(ai.getPathProgress());
  const target = { ...ai.target };
  ai.resumeAfterManualControl();
  assert.equal(ai.getPathProgress(), null);
  assert.deepEqual(ai.target, target);
  ai.update(input());
  assert.ok(ai.getPathProgress());
  ai.reset();
  assert.equal(ai.target, null);
  assert.equal(ai.getPathProgress(), null);
  assert.equal(calls.length > 0, true);
});

test('moving sideways without nearing the path node triggers an alternate replan', () => {
  const avoided = [];
  const nav = { nearestFree: goal => goal, findPath: (start, goal, doors, avoid) => {
    avoided.push(avoid);
    return [{ ...start, doorId: null }, { x: 2, z: 0, doorId: null },
      { ...goal, doorId: null }];
  } };
  const ai = new HumanAIController(nav, rooms, []);
  for (let frame = 0; frame < 20; frame++) {
    ai.update(input({ deltaMs: 100, human: { x: 0, z: frame % 2 ? 0.04 : 0 } }));
  }
  assert.ok(avoided.some(point => point && point.x === 2 && point.z === 0));
  assert.equal(ai.lastNavigationReason, 'PATH_STALLED_REPATH');
});

test('AI can request only an accessible ordinary door on its chosen path', () => {
  const node = { id: 'd', x: 0.6, z: 0, width: 1.2, rotation: Math.PI / 2 };
  const nav = { nearestFree: goal => goal, findPath: (start, goal) => [
    { ...start, doorId: null }, { x: 0.6, z: 0, doorId: 'd' },
    { ...goal, doorId: null }] };
  const ai = new HumanAIController(nav, rooms, [node]);
  const door = { id: 'd', state: 'CLOSED' };
  const command = ai.update(input({ human: { x: 0, z: 0 }, doors: [door] }));
  assert.equal(command.openDoorId, 'd');
  assert.deepEqual(command.direction, { x: 0, z: 0 });
  ai.reset();
  assert.equal(ai.update(input({ doors: [door], canOpenDoor: () => false })).openDoorId, null);
});

test('only DeepSeek primary control runs Human AI, with development manual override', () => {
  const idle = { x: 0, y: 0 }, manual = { x: 1, y: 0 };
  assert.equal(shouldRunHumanAI('PLAYING', 'DEEPSEEK', 'DEEPSEEK', idle, true), true);
  assert.equal(shouldRunHumanAI('PLAYING', 'DEEPSEEK', 'HUMAN', idle, true), false);
  assert.equal(shouldRunHumanAI('PLAYING', 'DEEPSEEK', 'DEEPSEEK', manual, true), false);
  assert.equal(shouldRunHumanAI('PLAYING', 'DEEPSEEK', 'DEEPSEEK', manual, false), true);
  assert.equal(shouldRunHumanAI('PLAYING', 'HUMAN', 'HUMAN', idle, true), false);
  for (const phase of ['READY', 'PAUSED', 'FINISHED', 'FACTION_SELECT']) {
    assert.equal(shouldRunHumanAI(phase, 'DEEPSEEK', 'DEEPSEEK', idle, true), false);
  }
});
