import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RuntimeDebugOverrides } from '../src/systems/RuntimeDebugOverrides.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import {
  PerceptionGeometry,
  SoundEventSystem,
  VisionSystem,
} from '../src/systems/PerceptionSystem.ts';
import {
  DevBRuntimeBinding,
  effectiveSpeeds,
  readOnlyBalanceSnapshot,
} from '../src/systems/DevBRuntimeBinding.ts';
import { isCaptureEligibleXZ, isInsideCaptureZoneXZ } from '../src/three/CaptureZone.ts';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { humanAiMovementSpeed } from '../src/systems/HumanAIController.ts';

const camera = new THREE.PerspectiveCamera();
const emptyGeometry = () => new PerceptionGeometry([], [], () => []);

test('the capture circle and the capture check share the effective radius', () => {
  const runtime = new RuntimeDebugOverrides();
  const human = { x: 0, z: 0 };
  const deepseek = { x: 1, z: 0 };

  assert.equal(isInsideCaptureZoneXZ(human, deepseek, runtime.captureRadius), false);
  assert.equal(isCaptureEligibleXZ(human, deepseek, runtime.captureRadius, false), false);

  runtime.set('capture.radius', 1.5);
  assert.equal(runtime.captureRadius, 1.5);
  assert.equal(isInsideCaptureZoneXZ(human, deepseek, runtime.captureRadius), true);
  assert.equal(isCaptureEligibleXZ(human, deepseek, runtime.captureRadius, false), true);
  // A blocked line of sight still wins over the larger circle.
  assert.equal(isCaptureEligibleXZ(human, deepseek, runtime.captureRadius, true), false);
});

test('a new capture radius clears progress accumulated under the old radius', () => {
  const runtime = new RuntimeDebugOverrides();
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'PLAYING');
  match.advancePlaying(200, true, false);
  assert.equal(match.captureProgressMs, 200);

  const radii = [];
  const binding = new DevBRuntimeBinding(runtime, {
    gameState: match,
    onCaptureRadius: radius => radii.push(radius),
  });
  binding.start();

  runtime.set('capture.radius', 1.5);
  assert.equal(match.captureProgressMs, 0, '半径变化必须清空抓捕累计进度');
  assert.deepEqual(radii, [1.5], '抓捕圈视图必须同步到新半径');

  binding.stop();
  runtime.set('capture.radius', 2);
  assert.deepEqual(radii, [1.5], '解绑后不再收到半径回调');
});

test('an unrelated parameter leaves the capture progress untouched', () => {
  const runtime = new RuntimeDebugOverrides();
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'PLAYING');
  match.advancePlaying(120, true, false);
  const binding = new DevBRuntimeBinding(runtime, {
    gameState: match, onCaptureRadius: () => {},
  });
  binding.start();
  runtime.set('vision.range', 18);
  runtime.set('movement.playerSpeed', 260);
  assert.equal(match.captureProgressMs, 120);
  binding.stop();
});

test('the effective vision range drives the real vision system', () => {
  const runtime = new RuntimeDebugOverrides();
  const vision = new VisionSystem(runtime);
  const geometry = emptyGeometry();
  const human = { x: 0, z: 0 };
  const deepseek = { x: 0, z: 15 };

  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'OUT_OF_RANGE');
  assert.equal(vision.get('HUMAN').visible, false);

  runtime.set('vision.range', 20);
  vision.update(16, human, deepseek, geometry);
  assert.equal(vision.get('HUMAN').status, 'VISIBLE');
  assert.equal(vision.get('HUMAN').visible, true);
  assert.deepEqual(vision.get('HUMAN').lastSeen.position, { x: 0, z: 15 });
});

test('music of walls and doors uses the effective occlusion factors', () => {
  const runtime = new RuntimeDebugOverrides();
  const wall = { id: 'w', kind: 'wall', x: 4, z: 0, width: 0.4, depth: 30, height: 1.5 };
  const geometry = new PerceptionGeometry([wall], [], () => [], runtime);
  const listener = { x: 0, z: 0 };
  const source = { x: 10, z: 0 };
  const base = geometry.soundFactor(listener, source);
  assert.ok(Math.abs(base - GAME_CONFIG.perception.wallSoundFactor) < 1e-9);

  runtime.set('hearing.wallFactor', 0.9);
  assert.ok(geometry.soundFactor(listener, source) > base);
  runtime.set('hearing.wallFactor', 0.05);
  assert.ok(geometry.soundFactor(listener, source) < base);
});

test('sound range, falloff and audibility follow the override layer', () => {
  const runtime = new RuntimeDebugOverrides();
  const sound = new SoundEventSystem(runtime);
  const geometry = emptyGeometry();
  const listener = { x: 0, z: 0 };
  sound.emit('FOOTSTEP', { x: 0, z: 16 }, 'HUMAN');

  const heard = sound.heardBy(listener, 'DEEPSEEK', camera, geometry);
  assert.ok(heard, '基准范围 17 内应可听');

  runtime.set('hearing.range.FOOTSTEP', 5);
  assert.equal(sound.heardBy(listener, 'DEEPSEEK', camera, geometry), null,
    '缩小传播范围后同一事件不再可听');

  runtime.clear('hearing.range.FOOTSTEP');
  runtime.set('hearing.falloffPower', 3);
  const steep = sound.analyzeBy(listener, 'DEEPSEEK', camera, geometry);
  assert.ok(steep.audibleStrength < heard.audibleStrength);
  assert.ok(steep.distanceFactor < heard.distanceFactor);

  runtime.set('hearing.minAudible', 0.9);
  assert.equal(sound.heardBy(listener, 'DEEPSEEK', camera, geometry), null);
  assert.ok(sound.analyzeBy(listener, 'DEEPSEEK', camera, geometry),
    '低于可听阈值的探针仍然给出分析结果');
});

test('strength and lifetime changes only apply to newly created events', () => {
  const runtime = new RuntimeDebugOverrides();
  const sound = new SoundEventSystem(runtime);
  const existing = sound.emit('FOOTSTEP', { x: 0, z: 1 }, 'HUMAN');
  assert.equal(existing.strength, GAME_CONFIG.perception.sounds.FOOTSTEP.strength);
  assert.equal(existing.lifetimeMs, GAME_CONFIG.perception.sounds.FOOTSTEP.lifetimeMs);

  runtime.set('hearing.strength.FOOTSTEP', 0.05);
  runtime.set('hearing.lifetime.FOOTSTEP', 200);
  assert.equal(existing.strength, GAME_CONFIG.perception.sounds.FOOTSTEP.strength,
    '已在场事件保留生成时的强度');
  assert.equal(existing.lifetimeMs, GAME_CONFIG.perception.sounds.FOOTSTEP.lifetimeMs);

  const fresh = sound.emit('FOOTSTEP', { x: 0, z: 1 }, 'HUMAN');
  assert.equal(fresh.strength, 0.05);
  assert.equal(fresh.lifetimeMs, 200);

  sound.advance(300);
  assert.deepEqual(sound.events.map(event => event.lifetimeMs), [1_400],
    '新寿命只作用于新事件');
});

test('player and AI movement speeds follow the override layer', () => {
  const runtime = new RuntimeDebugOverrides();
  const base = effectiveSpeeds(runtime);
  assert.equal(base.player, GAME_CONFIG.player.speed);
  assert.equal(base.human, GAME_CONFIG.player.speed * GAME_CONFIG.human.speedMultiplier);
  assert.equal(base.humanAi, humanAiMovementSpeed(base.human));

  runtime.set('movement.playerSpeed', 300);
  runtime.set('movement.humanSpeedMultiplier', 1.5);
  runtime.set('movement.humanAiMultiplier', 0.5);
  const tuned = effectiveSpeeds(runtime);
  assert.deepEqual(tuned, { player: 300, human: 450, humanAi: 225 });
  assert.equal(humanAiMovementSpeed(100, 0.5), 50);
  assert.equal(humanAiMovementSpeed(100),
    100 * GAME_CONFIG.humanAI.movementSpeedMultiplier);
});

test('the DeepSeek safety radius follows the effective capture radius', () => {
  const runtime = new RuntimeDebugOverrides();
  const controller = new DeepSeekAIController(null, [], []);
  const margin = GAME_CONFIG.deepseekAI.stationaryPassageSafetyMargin;
  assert.equal(controller.passageAvoidRadius, GAME_CONFIG.match.captureRadius + margin);

  controller.setRuntimeTuning(runtime);
  runtime.set('capture.radius', 1.5);
  assert.equal(controller.passageAvoidRadius, 1.5 + margin);

  controller.setRuntimeTuning(null);
  assert.equal(controller.passageAvoidRadius, GAME_CONFIG.match.captureRadius + margin);
});

test('a new round clears every temporary override', () => {
  const runtime = new RuntimeDebugOverrides();
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs);
  const binding = new DevBRuntimeBinding(runtime, {
    gameState: match, onCaptureRadius: () => {},
  });
  binding.start();
  runtime.set('capture.radius', 1.8);
  runtime.set('vision.range', 25);
  assert.equal(runtime.overrideCount, 2);

  assert.equal(binding.resetForNewRound(), 2);
  assert.equal(runtime.overrideCount, 0);
  assert.equal(runtime.captureRadius, GAME_CONFIG.match.captureRadius);
  assert.equal(runtime.visionRange, GAME_CONFIG.perception.visionRange);
});

test('the read-only balance snapshot never moves during a tuning session', () => {
  const before = readOnlyBalanceSnapshot();
  const runtime = new RuntimeDebugOverrides();
  const sound = new SoundEventSystem(runtime);
  const vision = new VisionSystem(runtime);
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'PLAYING');
  const binding = new DevBRuntimeBinding(runtime, {
    gameState: match, onCaptureRadius: () => {},
  });
  binding.start();
  runtime.set('capture.radius', 2.4);
  runtime.set('vision.range', 3);
  runtime.set('movement.playerSpeed', 550);
  runtime.set('movement.humanSpeedMultiplier', 2.9);
  runtime.set('movement.humanAiMultiplier', 1.9);
  runtime.set('hearing.wallFactor', 0);
  sound.emit('DOOR_LOCK', { x: 1, z: 1 }, 'DEEPSEEK');
  vision.update(16, { x: 0, z: 0 }, { x: 5, z: 0 }, emptyGeometry());
  assert.deepEqual(readOnlyBalanceSnapshot(), before);
  assert.equal(GAME_CONFIG.match.captureRadius, before.captureRadius);
  assert.equal(GAME_CONFIG.match.captureMs, before.captureMs);
  assert.equal(GAME_CONFIG.sprint.cooldownMs, before.sprintCooldownMs);
  binding.stop();
});
