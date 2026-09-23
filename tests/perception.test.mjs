import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera } from 'three';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { cameraRelativeDirection } from '../src/three/CameraRelativeMovement.ts';
import { DOOR_NODES, WALLS } from '../src/three/map/apartmentMap.ts';
import { createRiceTraceView, syncRiceTraceView } from '../src/three/RiceTraceView.ts';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem,
  VisionSystem, screenSoundDirection } from '../src/systems/PerceptionSystem.ts';

const wall = { id: 'wall', kind: 'wall', x: 2, z: 0, width: 0.2, depth: 3, height: 2 };
const door = { id: 'door', x: 2, z: 0, width: 1.2, rotation: Math.PI / 2,
  initialState: 'CLOSED', connectedRoomA: 'a', connectedRoomB: 'b' };
const state = value => [{ id: 'door', state: value }];
const cam = new OrthographicCamera();
cam.position.set(10, 12, 10);
cam.lookAt(0, 0, 0);
cam.updateMatrixWorld();

test('sound events retain source and expire by per-type lifetime', () => {
  const system = new SoundEventSystem();
  const event = system.emit('FOOTSTEP', { x: 1, z: 2 }, 'DEEPSEEK');
  assert.equal(event.sourceFaction, 'DEEPSEEK');
  assert.deepEqual(event.position, { x: 1, z: 2 });
  system.advance(event.lifetimeMs - 1);
  assert.equal(system.events.length, 1);
  assert.ok(system.heardBy({ x: 1, z: 2 }, 'HUMAN', cam,
    new PerceptionGeometry([], [], () => [])));
  system.advance(1);
  assert.equal(system.events.length, 0);
  assert.equal(system.heardBy({ x: 1, z: 2 }, 'HUMAN', cam,
    new PerceptionGeometry([], [], () => [])), null);
  assert.equal(system.analyzeBy({ x: 1, z: 2 }, 'HUMAN', cam,
    new PerceptionGeometry([], [], () => [])), null);
});

test('XZ falloff, max range and source faction filter prevent global hearing', () => {
  const system = new SoundEventSystem();
  const geometry = new PerceptionGeometry([], [], () => []);
  system.emit('SPRINT', { x: 0, z: 0 }, 'DEEPSEEK');
  const near = system.heardBy({ x: 1, z: 0 }, 'HUMAN', cam, geometry);
  const far = system.heardBy({ x: 4, z: 0 }, 'HUMAN', cam, geometry);
  assert.ok(near.audibleStrength > far.audibleStrength);
  assert.equal(near.rawStrength, 0.8);
  assert.equal(near.occlusionMultiplier, 1);
  assert.ok(near.distanceFactor > far.distanceFactor);
  assert.equal(near.audibleStrength,
    near.rawStrength * near.distanceFactor * near.occlusionMultiplier);
  assert.equal(system.heardBy({ x: 18, z: 0 }, 'HUMAN', cam, geometry), null);
  assert.equal(system.heardBy({ x: 1, z: 0 }, 'DEEPSEEK', cam, geometry), null);
  assert.ok(GAME_CONFIG.perception.sounds.FOOTSTEP.range <
    GAME_CONFIG.perception.sounds.SPRINT.range);
});

test('wall and closed/locked doors attenuate sound, open door does not', () => {
  const a = { x: 0, z: 0 }, b = { x: 4, z: 0 };
  const clear = new PerceptionGeometry([], [], () => []);
  const throughWall = new PerceptionGeometry([wall], [], () => []);
  const closed = new PerceptionGeometry([], [door], () => state('CLOSED'));
  const locked = new PerceptionGeometry([], [door], () => state('LOCKED'));
  const open = new PerceptionGeometry([], [door], () => state('OPEN'));
  assert.ok(throughWall.soundFactor(a, b) < clear.soundFactor(a, b));
  assert.ok(closed.soundFactor(a, b) < clear.soundFactor(a, b));
  assert.ok(locked.soundFactor(a, b) <= closed.soundFactor(a, b));
  assert.equal(open.soundFactor(a, b), clear.soundFactor(a, b));
  const system = new SoundEventSystem();
  system.emit('FALL', b, 'DEEPSEEK');
  const openHeard = system.heardBy(a, 'HUMAN', cam, open);
  const closedProbe = system.analyzeBy(a, 'HUMAN', cam, closed);
  const wallProbe = system.analyzeBy(a, 'HUMAN', cam, throughWall);
  assert.equal(openHeard.occlusionMultiplier, 1);
  assert.match(openHeard.occlusion, /OPEN Door/);
  assert.match(closedProbe.occlusion, /CLOSED Door/);
  assert.ok(closedProbe.audibleStrength < openHeard.audibleStrength);
  assert.ok(wallProbe.audibleStrength < openHeard.audibleStrength);
});

test('sound arrow matches all eight camera-relative screen directions', () => {
  const listener = { x: 0, z: 0 };
  for (const [x, y, arrow] of [
    [1, 0, '→'], [-1, 0, '←'], [0, -1, '↑'], [0, 1, '↓'],
    [1, -1, '↗'], [-1, -1, '↖'], [1, 1, '↘'], [-1, 1, '↙'],
  ]) {
    const world = cameraRelativeDirection(cam, { x, y });
    assert.equal(screenSoundDirection(cam, listener, { x: world.x, z: world.y }), arrow);
  }
});

test('rice progress opens a five second window and only movement at step distance leaves footprints', () => {
  const traces = new RiceTraceSystem();
  const start = { x: 2, z: 3 };
  traces.recordProgress('A', start, 0, 0);
  assert.equal(traces.traces.length, 0);
  assert.equal(traces.generationRemainingMs, 0);
  traces.recordProgress('A', start, 0, 100);
  assert.equal(traces.generationRemainingMs, GAME_CONFIG.perception.traceGenerationMs);
  traces.recordMovement(start);
  traces.recordMovement({ x: 2.2, z: 3 });
  assert.equal(traces.traces.length, 0);
  traces.recordMovement({ x: 2.7, z: 3 });
  assert.equal(traces.traces.length, 1);
  assert.equal(traces.traces[0].strength, 1);
});

test('trace window expires, refreshes on later eating and pause freezes all timers', () => {
  const traces = new RiceTraceSystem();
  traces.recordProgress('A', { x: 0, z: 0 }, 0, 100);
  traces.advance(2_000);
  traces.advance(9_000, false);
  assert.equal(traces.generationRemainingMs, 3_000);
  assert.equal(traces.nowMs, 2_000);
  traces.advance(3_000);
  assert.equal(traces.generationRemainingMs, 0);
  traces.recordMovement({ x: 1, z: 0 });
  assert.equal(traces.traces.length, 0);
  traces.recordProgress('A', { x: 1, z: 0 }, 100, 200);
  assert.equal(traces.generationRemainingMs, 5_000);
  traces.recordMovement({ x: 1.7, z: 0 });
  assert.equal(traces.traces.length, 1);
});

test('each footprint owns an independent fifteen second lifetime and only fades at the end', () => {
  const traces = new RiceTraceSystem();
  traces.recordProgress('A', { x: 0, z: 0 }, 0, 100);
  traces.recordMovement({ x: 0.7, z: 0 });
  const firstId = traces.traces[0].id;
  traces.advance(4_000);
  traces.recordProgress('A', { x: 0.7, z: 0 }, 100, 200);
  traces.recordMovement({ x: 1.4, z: 0 });
  const secondId = traces.traces[1].id;
  traces.advance(8_000);
  assert.equal(traces.traces.find(trace => trace.id === firstId).strength, 1);
  assert.equal(traces.traces.find(trace => trace.id === secondId).strength, 1);
  traces.advance(1_500);
  assert.ok(traces.traces.find(trace => trace.id === firstId).strength < 1);
  assert.equal(traces.traces.find(trace => trace.id === secondId).strength, 1);
  traces.advance(1_500);
  assert.equal(traces.traces.some(trace => trace.id === firstId), false);
  assert.equal(traces.traces.some(trace => trace.id === secondId), true);
  traces.advance(2_500);
  assert.ok(traces.traces[0].strength < 1);
  traces.advance(1_500);
  assert.equal(traces.traces.length, 0);
});

test('rice footprint pair is gray, raised, Human-visible and follows freshness', () => {
  const traces = new RiceTraceSystem();
  traces.recordProgress('A', { x: 2, z: 3 }, 0, 100);
  traces.recordMovement({ x: 2.7, z: 3 });
  const view = createRiceTraceView(traces.traces[0], true);
  assert.equal(view.position.y, 0.075);
  assert.equal(view.children.length, 2);
  assert.ok(view.children.every(child => child.material.color.getHex() === 0x9aa4aa));
  assert.equal(view.visible, true);
  assert.ok(view.children.every(child => child.material.opacity > 0.8));
  traces.advance(GAME_CONFIG.perception.traceLifetimeMs - GAME_CONFIG.perception.traceFadeMs / 2);
  syncRiceTraceView(view, traces.traces[0], true);
  assert.ok(view.children.every(child => child.material.opacity > 0 && child.material.opacity < 0.88));
  syncRiceTraceView(view, traces.traces[0], false);
  assert.equal(view.visible, false);
  traces.advance(GAME_CONFIG.perception.traceFadeMs / 2);
  assert.equal(traces.traces.length, 0);
  view.traverse(child => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
});

test('rice trace reset clears footprints, generation window and timer', () => {
  const traces = new RiceTraceSystem();
  traces.recordProgress('A', { x: 0, z: 0 }, 0, 100);
  traces.recordMovement({ x: 0.7, z: 0 });
  traces.advance(1_000);
  traces.reset();
  assert.equal(traces.traces.length, 0);
  assert.equal(traces.generationRemainingMs, 0);
  assert.equal(traces.nowMs, 0);
});

test('vision blocks on walls and closed/locked doors, but crosses open doors', () => {
  const a = { x: 0, z: 0 }, b = { x: 4, z: 0 };
  assert.equal(new PerceptionGeometry([], [], () => []).visible(a, b, 5), true);
  assert.equal(new PerceptionGeometry([], [], () => []).visible(a, b, 3), false);
  assert.equal(new PerceptionGeometry([wall], [], () => []).visible(a, b, 5), false);
  for (const value of ['CLOSED', 'LOCKED']) {
    assert.equal(new PerceptionGeometry([], [door], () => state(value)).visible(a, b, 5), false);
  }
  assert.equal(new PerceptionGeometry([], [door], () => state('OPEN')).visible(a, b, 5), true);
});

test('both factions retain last seen position briefly, then forget it', () => {
  const vision = new VisionSystem();
  let blocked = false;
  const geometry = new PerceptionGeometry([], [door], () => state(blocked ? 'CLOSED' : 'OPEN'));
  const human = { x: 0, z: 0 }, deepseek = { x: 4, z: 0 };
  vision.update(100, human, deepseek, geometry);
  assert.deepEqual(vision.get('HUMAN').lastSeen.position, deepseek);
  assert.deepEqual(vision.get('DEEPSEEK').lastSeen.position, human);
  blocked = true;
  vision.update(GAME_CONFIG.perception.lastSeenMs - 1, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').visible, false);
  assert.equal(vision.get('HUMAN').status, 'BLOCKED');
  assert.equal(vision.get('HUMAN').blocker, door.id);
  assert.equal(vision.get('HUMAN').lastSeen.position.x, 4);
  vision.update(1, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').lastSeen, null);
});

test('real apartment door transitions update LOS immediately without erasing Last Seen', () => {
  const doors = new DoorSystem(DOOR_NODES, 3);
  const node = DOOR_NODES.find(value => value.id === 'door_living_dining');
  const human = { x: node.x - 1, z: node.z };
  const deepseek = { x: node.x + 1, z: node.z };
  const geometry = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const vision = new VisionSystem();
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'BLOCKED');
  assert.equal(vision.get('HUMAN').blocker, node.id);
  doors.toggle(node.id, 'HUMAN');
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'VISIBLE');
  doors.toggle(node.id, 'HUMAN');
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'BLOCKED');
  assert.deepEqual(vision.get('HUMAN').lastSeen.position, deepseek);
  assert.equal(doors.lock(node.id, 'DEEPSEEK'), 'LOCKED');
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'BLOCKED');
  assert.equal(vision.get('HUMAN').blocker, node.id);
  assert.equal(doors.forceOpen(node.id, 'HUMAN'), 'FORCE_OPENED');
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'VISIBLE');
  deepseek.x += GAME_CONFIG.perception.visionRange;
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'OUT_OF_RANGE');
  assert.ok(vision.get('HUMAN').lastSeen);
});

test('all apartment door centers block LOS when closed and pass it when open', () => {
  const doors = new DoorSystem(DOOR_NODES, 3);
  const geometry = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  for (const node of DOOR_NODES) {
    const vertical = node.rotation !== 0;
    const a = { x: node.x + (vertical ? -0.7 : 0),
      z: node.z + (vertical ? 0 : -0.7) };
    const b = { x: node.x + (vertical ? 0.7 : 0),
      z: node.z + (vertical ? 0 : 0.7) };
    assert.equal(geometry.inspectVision(a, b, 11).status, 'BLOCKED', node.id);
    doors.toggle(node.id, 'HUMAN');
    assert.equal(geometry.inspectVision(a, b, 11).status, 'VISIBLE', node.id);
    doors.toggle(node.id, 'HUMAN');
    assert.equal(geometry.inspectVision(a, b, 11).status, 'BLOCKED', node.id);
  }
});
