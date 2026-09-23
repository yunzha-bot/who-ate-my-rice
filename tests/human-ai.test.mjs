import test from 'node:test';
import assert from 'node:assert/strict';
import { HumanAIController, shouldRunHumanAI } from '../src/systems/HumanAIController.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { OrthographicCamera } from 'three';
import { PerceptionGeometry, SoundEventSystem } from '../src/systems/PerceptionSystem.ts';

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

test('lost sight leads to last seen investigation, dwell, and patrol', () => {
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
  assert.equal(ai.state, 'PATROL');
  ai.reset();
  assert.equal(ai.state, 'PATROL');
  assert.equal(ai.target, null);
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
