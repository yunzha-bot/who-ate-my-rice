import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera } from 'three';
import { GAME_CONFIG as C, RICE_MAX_PROGRESS_MS, RICE_TIMING_MODE } from '../src/config/gameConfig.ts';
import { DoorSystem, nearestPointOnDoorSegment } from '../src/systems/DoorSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';
import { MinesweeperLockSystem } from '../src/systems/MinesweeperLockSystem.ts';
import { PerceptionGeometry, RiceTraceSystem, SoundEventSystem } from '../src/systems/PerceptionSystem.ts';
import { createRiceTraceView } from '../src/three/RiceTraceView.ts';
import { ACTIVE_RICE_COUNT, RICE_CANDIDATES, selectRiceCandidates } from '../src/three/map/apartmentMap.ts';

test('rice timing mode and map selection read one balance source', () => {
  assert.equal(C.rice.maxProgressMs, RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE]);
  assert.equal(ACTIVE_RICE_COUNT, C.rice.activeCount);
  assert.ok(C.rice.activeCount <= C.rice.candidateCount);
  assert.ok(C.rice.candidateCount <= RICE_CANDIDATES.length);
  const selected = selectRiceCandidates(() => 0.4);
  assert.equal(selected.length, C.rice.activeCount);
  assert.equal(new Set(selected.map(point => point.id)).size, selected.length);
  const eligible = new Set(RICE_CANDIDATES.slice(0, C.rice.candidateCount).map(point => point.id));
  assert.ok(selected.every(point => eligible.has(point.id)));
});

test('candidate pool size is configurable within authored map positions', () => {
  const original = C.rice.candidateCount;
  try {
    C.rice.candidateCount = C.rice.activeCount + 2;
    const eligible = new Set(RICE_CANDIDATES.slice(0, C.rice.candidateCount).map(point => point.id));
    assert.ok(selectRiceCandidates(() => 0.3).every(point => eligible.has(point.id)));
    C.rice.candidateCount = C.rice.activeCount - 1;
    assert.throws(() => selectRiceCandidates(), /candidate\/active counts/);
  } finally {
    C.rice.candidateCount = original;
  }
});

test('door edge targeting and Human Space use configured geometry and cooldown', () => {
  const node = { id: 'door', x: 0, z: 0, rotation: 0, width: 1.2,
    initialState: 'CLOSED', connectedRoomA: 'a', connectedRoomB: 'b' };
  const edge = nearestPointOnDoorSegment(node.width / 2, 0, node);
  assert.ok(Math.abs(edge.x - (node.width / 2 - C.door.interactionEndInset)) < 1e-9);

  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  const skill = new HumanDoorSkill(doors, C.door.humanForceBreakCooldownMs);
  assert.equal(C.door.humanFreeOpenClosedDoor, true);
  assert.equal(skill.use(node.id, 'HUMAN', 'PLAYING'), 'OPENED');
  assert.equal(skill.cooldownRemainingMs, 0);
  assert.equal(doors.toggle(node.id, 'HUMAN'), 'CLOSED');
  assert.equal(doors.lock(node.id, 'DEEPSEEK'), 'LOCKED');
  assert.equal(skill.use(node.id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
});

test('free Human Space and first-reveal protection follow their config switches', () => {
  const node = { id: 'door', x: 0, z: 0, rotation: 0, width: 1.2,
    initialState: 'CLOSED', connectedRoomA: 'a', connectedRoomB: 'b' };
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  const skill = new HumanDoorSkill(doors, C.door.humanForceBreakCooldownMs);
  const originalQuickOpen = C.door.humanFreeOpenClosedDoor;
  const originalSafeReveal = C.pulseLock.firstRevealSafe;
  try {
    C.door.humanFreeOpenClosedDoor = false;
    assert.equal(skill.use(node.id, 'HUMAN', 'PLAYING'), 'INVALID_STATE');
    assert.equal(doors.get(node.id).state, 'CLOSED');
    doors.lock(node.id, 'DEEPSEEK');
    const mines = new MinesweeperLockSystem(
      doors, C.pulseLock.rows, C.pulseLock.cols, C.pulseLock.mines, () => 0);
    C.pulseLock.firstRevealSafe = false;
    assert.equal(mines.open(node.id, 'HUMAN', 'PLAYING'), true);
    assert.equal(mines.reveal(0, 0, 'PLAYING'), 'FAILED');
  } finally {
    C.door.humanFreeOpenClosedDoor = originalQuickOpen;
    C.pulseLock.firstRevealSafe = originalSafeReveal;
  }
});

test('sound falloff and door occlusion use configured factors', () => {
  const node = { id: 'door', x: 2, z: 0, rotation: 0, width: 1.2,
    initialState: 'CLOSED', connectedRoomA: 'a', connectedRoomB: 'b' };
  const doors = new DoorSystem([node], C.door.maxActiveLocks);
  const geometry = new PerceptionGeometry([], [node], () => doors.doors);
  const source = { x: 0, z: 0 };
  const listener = { x: 4, z: 0 };
  const sounds = new SoundEventSystem();
  sounds.emit('FOOTSTEP', source, 'DEEPSEEK');
  const camera = new OrthographicCamera();
  const behindClosed = sounds.analyzeBy(listener, 'HUMAN', camera, geometry);
  assert.ok(behindClosed);
  assert.equal(behindClosed.occlusionMultiplier, C.perception.closedDoorSoundFactor);
  assert.ok(Math.abs(behindClosed.distanceFactor -
    (1 - 4 / C.perception.sounds.FOOTSTEP.range) **
      C.perception.distanceFalloffPower) < 1e-9);
  doors.toggle(node.id, 'HUMAN');
  const throughOpen = sounds.analyzeBy(listener, 'HUMAN', camera, geometry);
  assert.equal(throughOpen.occlusionMultiplier, C.perception.openDoorSoundFactor);
  assert.ok(throughOpen.audibleStrength > behindClosed.audibleStrength);
});

test('rice footprint view uses configured appearance and independent trace timing', () => {
  const traces = new RiceTraceSystem();
  traces.recordProgress('rice', { x: 0, z: 0 }, 0, 10);
  traces.recordMovement({ x: C.perception.traceStepDistance, z: 0 });
  assert.equal(traces.generationRemainingMs, C.perception.traceGenerationMs);
  assert.equal(traces.traces[0].lifetimeMs, C.perception.traceLifetimeMs);
  const view = createRiceTraceView(traces.traces[0], true);
  assert.equal(view.position.y, C.perception.traceVisual.groundOffset);
  assert.equal(view.children[0].material.color.getHex(), C.perception.traceVisual.color);
  assert.equal(view.children[0].material.opacity, C.perception.traceVisual.opacity);
  view.traverse(child => {
    if (child.isMesh) {
      child.geometry.dispose();
      child.material.dispose();
    }
  });
});
