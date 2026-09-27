import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { PerceptionGeometry, SoundEventSystem } from '../src/systems/PerceptionSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { DOOR_NODES, SPAWNS, WALLS } from '../src/three/map/apartmentMap.ts';
import { SoundVisualView, soundDistanceBand,
  soundWaveBandRadii, soundWorldAngle, SOUND_WAVE_LAYOUT } from '../src/three/SoundVisualView.ts';

const heard = (x, z, remainingMs = 1_000, strength = 0.4) => ({
  event: { type: 'FOOTSTEP', position: { x, z }, sourceFaction: 'HUMAN',
    strength: 0.35, timestamp: 0, lifetimeMs: 1_400 },
  rawStrength: 0.35, distanceFactor: 0.5, occlusionMultiplier: 1,
  occlusion: '无遮挡', audibleStrength: strength, direction: '→', remainingMs,
});

test('sound distance bands use clear thresholds and resist boundary jitter', () => {
  const { nearMax, midMax, radius } = GAME_CONFIG.perception.soundVisual;
  assert.equal(soundDistanceBand(nearMax), 'NEAR');
  assert.equal(soundDistanceBand(nearMax + 0.2, 'NEAR'), 'NEAR');
  assert.equal(soundDistanceBand(nearMax + 0.4, 'NEAR'), 'MID');
  assert.equal(soundDistanceBand(midMax), 'MID');
  assert.equal(soundDistanceBand(midMax + 0.2, 'MID'), 'MID');
  assert.equal(soundDistanceBand(midMax + 0.4, 'MID'), 'FAR');
  assert.equal(soundDistanceBand(midMax - 0.2, 'FAR'), 'FAR');
  assert.ok(radius > GAME_CONFIG.perception.visionRange);
});

test('world bearing places arcs toward the actual XZ sound source', () => {
  const listener = { x: 1, z: 2 };
  for (const [x, z] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) {
    const source = { x: listener.x + x, z: listener.z + z };
    const rotated = new Vector3(1, 0, 0).applyAxisAngle(
      new Vector3(0, 1, 0), soundWorldAngle(listener, source));
    const length = Math.hypot(x, z);
    assert.ok(Math.abs(rotated.x - x / length) < 1e-10);
    assert.ok(Math.abs(rotated.z - z / length) < 1e-10);
  }
});

test('scene ring follows listener and colored waves fade and disappear', () => {
  const scene = new Scene();
  const view = new SoundVisualView(scene);
  assert.ok(scene.children.includes(view.object));
  view.update({ x: 3, z: -2 }, null, true, 0);
  assert.equal(view.object.visible, true);
  assert.deepEqual([view.object.position.x, view.object.position.z], [3, -2]);
  assert.equal(view.rangeRing.geometry.parameters.outerRadius,
    GAME_CONFIG.perception.soundVisual.radius);
  assert.equal(view.waveGroup.visible, false);

  view.update({ x: 3, z: -2 }, heard(5, -2), true, 100);
  assert.equal(view.currentBand, 'NEAR');
  assert.equal(view.waveGroup.visible, true);
  assert.equal(view.waveMaterials[0].color.getHex(), 0xff635b);
  assertWaveRingsWithinBand(view, 'NEAR');
  const strongOpacity = view.waveMaterials[0].opacity;
  view.update({ x: 3, z: -2 }, heard(11, -2, 100, 0.05), true, 200);
  assert.equal(view.currentBand, 'FAR');
  assert.equal(view.waveMaterials[0].color.getHex(), 0x54aaff);
  assertWaveRingsWithinBand(view, 'FAR');
  assert.ok(view.waveMaterials[0].opacity < strongOpacity);
  view.update({ x: 3, z: -2 }, heard(7, -2), true, 300);
  assert.equal(view.currentBand, 'MID');
  assert.equal(view.waveMaterials[0].color.getHex(), 0xffd45f);
  assertWaveRingsWithinBand(view, 'MID');
  view.update({ x: 3, z: -2 }, null, true, 400);
  assert.equal(view.waveGroup.visible, false);
  view.update(null, null, false, 500);
  assert.equal(view.object.visible, false);
  view.dispose();
  assert.ok(!scene.children.includes(view.object));
});

function assertWaveRingsWithinBand(view, band) {
  const totalRadius = GAME_CONFIG.perception.soundVisual.radius;
  const bandIndex = ({ NEAR: 0, MID: 1, FAR: 2 })[band];
  const bandStart = totalRadius * bandIndex / SOUND_WAVE_LAYOUT.bandCount;
  const bandEnd = totalRadius * (bandIndex + 1) / SOUND_WAVE_LAYOUT.bandCount;
  const padding = Math.min(SOUND_WAVE_LAYOUT.edgePadding,
    (bandEnd - bandStart - SOUND_WAVE_LAYOUT.ringThickness) / 2);

  for (const mesh of view.waveGroup.children) {
    const positions = mesh.geometry.getAttribute('position');
    const radii = Array.from({ length: positions.count }, (_, index) =>
      Math.hypot(positions.getX(index), positions.getY(index)));
    assert.ok(Math.min(...radii) >= bandStart + padding - 1e-5);
    assert.ok(Math.max(...radii) <= bandEnd - padding + 1e-5);
  }
}

test('animated sound waves remain in the selected concentric band after each update', () => {
  const scene = new Scene();
  const view = new SoundVisualView(scene);
  const listener = { x: -2, z: 4 };
  view.update(listener, heard(2, 4), true, 100);
  assert.equal(view.currentBand, 'MID');
  assertWaveRingsWithinBand(view, 'MID');

  // A following frame and listener move update animation/placement without
  // restoring the wave geometry to the old center radii.
  view.update({ x: -3, z: 4 }, heard(1, 4), true, 220);
  assert.equal(view.currentBand, 'MID');
  assert.deepEqual([view.object.position.x, view.object.position.z], [-3, 4]);
  assertWaveRingsWithinBand(view, 'MID');
  const radii = soundWaveBandRadii('FAR', GAME_CONFIG.perception.soundVisual.radius);
  assert.ok(radii.inner < radii.outer);
  view.dispose();
});

test('debug range rings are hidden by default and only enabled for DEV visualization', () => {
  const releaseScene = new Scene();
  const releaseView = new SoundVisualView(releaseScene);
  const releaseDebugRings = releaseView.object.children.filter(child =>
    child !== releaseView.waveGroup);
  assert.equal(releaseDebugRings.length, 4);
  assert.ok(releaseDebugRings.every(ring => !ring.visible));
  releaseView.update({ x: 0, z: 0 }, heard(7, 0), true, 200);
  assert.equal(releaseView.object.visible, true);
  assert.equal(releaseView.waveGroup.visible, true);
  assert.ok(releaseDebugRings.every(ring => !ring.visible));
  releaseView.dispose();

  const devScene = new Scene();
  const devView = new SoundVisualView(devScene, true);
  const devDebugRings = devView.object.children.filter(child =>
    child !== devView.waveGroup);
  assert.ok(devDebugRings.every(ring => ring.visible));
  devView.update({ x: 0, z: 0 }, heard(7, 0), true, 200);
  assert.ok(devDebugRings.every(ring => ring.visible));
  devView.dispose();
});

test('distant Human footsteps are heard by DeepSeek and reverse listening still works', () => {
  const sounds = new SoundEventSystem();
  const camera = new OrthographicCamera();
  camera.position.set(10, 12, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const geometry = new PerceptionGeometry([], [], () => []);
  sounds.emit('FOOTSTEP', { x: 8, z: 0 }, 'HUMAN');
  const deepseek = sounds.heardBy({ x: 0, z: 0 }, 'DEEPSEEK', camera, geometry);
  assert.ok(deepseek);
  assert.equal(soundDistanceBand(8), 'FAR');
  assert.equal(sounds.heardBy({ x: 0, z: 0 }, 'HUMAN', camera, geometry), null);
  sounds.emit('SPRINT', { x: 3, z: 0 }, 'DEEPSEEK');
  assert.ok(sounds.heardBy({ x: 0, z: 0 }, 'HUMAN', camera, geometry));
  sounds.advance(GAME_CONFIG.perception.sounds.FOOTSTEP.lifetimeMs);
  assert.equal(sounds.heardBy({ x: 0, z: 0 }, 'DEEPSEEK', camera, geometry), null);
});

test('development visual keeps a faint blue direction for Human at the distant spawn', () => {
  const doors = new DoorSystem(DOOR_NODES, 3);
  const geometry = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const sounds = new SoundEventSystem();
  const camera = new OrthographicCamera();
  camera.position.set(12, 14, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  sounds.emit('FOOTSTEP', SPAWNS.human, 'HUMAN');
  const probe = sounds.analyzeBy(SPAWNS.deepseek, 'DEEPSEEK', camera, geometry);
  assert.ok(probe);
  assert.ok(probe.occlusionMultiplier < 1);
  assert.equal(soundDistanceBand(Math.hypot(
    SPAWNS.human.x - SPAWNS.deepseek.x, SPAWNS.human.z - SPAWNS.deepseek.z)), 'FAR');
  const view = new SoundVisualView(new Scene());
  view.update(SPAWNS.deepseek, probe, true, 0);
  assert.equal(view.waveGroup.visible, true);
  assert.equal(view.waveMaterials[0].color.getHex(), 0x54aaff);
  view.dispose();
});
