import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import {
  RuntimeDebugOverrides,
  RUNTIME_EXCLUDED_PARAMS,
  RUNTIME_PARAM_SPECS,
  RUNTIME_SOUND_TYPES,
} from '../src/systems/RuntimeDebugOverrides.ts';

const ids = RUNTIME_PARAM_SPECS.map(spec => spec.id);

test('the whitelist covers the four groups with unique ids and valid ranges', () => {
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...new Set(RUNTIME_PARAM_SPECS.map(spec => spec.group))].sort(),
    ['capture', 'hearing', 'movement', 'vision']);
  for (const spec of RUNTIME_PARAM_SPECS) {
    assert.ok(spec.min < spec.max, `${spec.id} 范围非法`);
    assert.ok(spec.base >= spec.min && spec.base <= spec.max, `${spec.id} 基准值越界`);
    assert.ok(spec.label.length > 0 && spec.unit.length > 0);
    assert.ok(spec.effect.length > 0, `${spec.id} 缺少生效时机说明`);
  }
  // Every real sound type is tunable, and nothing else is.
  const soundRanges = RUNTIME_PARAM_SPECS
    .filter(spec => spec.id.startsWith('hearing.range.')).map(spec => spec.id);
  assert.deepEqual(soundRanges.sort(),
    RUNTIME_SOUND_TYPES.map(type => `hearing.range.${type}`).sort());
});

test('a valid value becomes the effective value and is reported as overridden', () => {
  const runtime = new RuntimeDebugOverrides();
  assert.equal(runtime.captureRadius, GAME_CONFIG.match.captureRadius);
  assert.equal(runtime.isOverridden('capture.radius'), false);

  const result = runtime.set('capture.radius', 1.4);
  assert.deepEqual(result, { ok: true, value: 1.4 });
  assert.equal(runtime.captureRadius, 1.4);
  assert.equal(runtime.isOverridden('capture.radius'), true);
  assert.equal(runtime.overrideCount, 1);
  assert.equal(runtime.revision, 1);
});

test('NaN, Infinity, non-numbers and out-of-range entries are rejected', () => {
  const runtime = new RuntimeDebugOverrides();
  const cases = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '1.0', null,
    undefined, 0.1, 9];
  for (const value of cases) {
    const result = runtime.set('capture.radius', value);
    assert.equal(result.ok, false, `${String(value)} 不应被接受`);
    assert.ok(result.message.length > 0);
  }
  assert.equal(runtime.captureRadius, GAME_CONFIG.match.captureRadius);
  assert.equal(runtime.overrideCount, 0);
  assert.equal(runtime.revision, 0);
  const unknown = runtime.set('movement.captureMs', 1);
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /未知参数/);
});

test('clear returns one field to the GAME_CONFIG base', () => {
  const runtime = new RuntimeDebugOverrides();
  runtime.set('vision.range', 20);
  assert.equal(runtime.visionRange, 20);
  assert.equal(runtime.clear('vision.range'), true);
  assert.equal(runtime.clear('vision.range'), false);
  assert.equal(runtime.visionRange, GAME_CONFIG.perception.visionRange);
  assert.equal(runtime.overrideCount, 0);
});

test('clearAll drops every override and reports how many were removed', () => {
  const runtime = new RuntimeDebugOverrides();
  runtime.set('capture.radius', 1.2);
  runtime.set('movement.playerSpeed', 300);
  assert.equal(runtime.overrideCount, 2);
  assert.equal(runtime.clearAll(), 2);
  assert.equal(runtime.clearAll(), 0);
  assert.equal(runtime.captureRadius, GAME_CONFIG.match.captureRadius);
  assert.equal(runtime.playerSpeedPx, GAME_CONFIG.player.speed);
});

test('snapshot and restore reproduce the values that were effective', () => {
  const runtime = new RuntimeDebugOverrides();
  runtime.set('capture.radius', 1.1);
  const openedSnapshot = runtime.snapshot();
  assert.deepEqual(openedSnapshot, { 'capture.radius': 1.1 });

  runtime.set('capture.radius', 2.5);
  runtime.set('vision.range', 22);
  runtime.restore(openedSnapshot);
  assert.equal(runtime.captureRadius, 1.1);
  assert.equal(runtime.visionRange, GAME_CONFIG.perception.visionRange);
  assert.equal(runtime.overrideCount, 1);
});

test('restore clamps foreign values instead of trusting them', () => {
  const runtime = new RuntimeDebugOverrides();
  runtime.restore({ 'capture.radius': 99, 'vision.range': -5, 'nope': 1 });
  const spec = RUNTIME_PARAM_SPECS.find(value => value.id === 'capture.radius');
  assert.equal(runtime.captureRadius, spec.max);
  assert.equal(runtime.visionRange,
    RUNTIME_PARAM_SPECS.find(value => value.id === 'vision.range').min);
  assert.equal(runtime.isOverridden('nope'), false);
});

test('subscribers receive the changed ids and can unsubscribe', () => {
  const runtime = new RuntimeDebugOverrides();
  const changes = [];
  const stop = runtime.subscribe(change => changes.push(change));
  runtime.set('capture.radius', 1.3);
  runtime.clear('capture.radius');
  runtime.set('capture.radius', 1.3);
  runtime.set('vision.range', 13);
  assert.deepEqual(changes.map(change => change.kind), ['set', 'clear', 'set', 'set']);
  assert.deepEqual(changes[0].ids, ['capture.radius']);
  const cleared = runtime.clearAll();
  assert.equal(cleared, 2);
  assert.deepEqual(changes.at(-1).kind, 'clearAll');
  assert.deepEqual(changes.at(-1).ids.sort(), ['capture.radius', 'vision.range']);
  stop();
  runtime.set('capture.radius', 1.5);
  assert.equal(changes.length, 5);
});

test('setting overrides never writes to GAME_CONFIG', () => {
  const before = JSON.stringify(GAME_CONFIG);
  const runtime = new RuntimeDebugOverrides();
  for (const spec of RUNTIME_PARAM_SPECS) {
    runtime.set(spec.id, spec.min);
    runtime.set(spec.id, spec.max);
  }
  runtime.clearAll();
  runtime.restore({ 'capture.radius': 2 });
  runtime.clearAll();
  assert.equal(JSON.stringify(GAME_CONFIG), before);
});

test('typed getters and sound helpers follow their override ids', () => {
  const runtime = new RuntimeDebugOverrides();
  runtime.set('vision.range', 21);
  runtime.set('hearing.falloffPower', 2);
  runtime.set('hearing.wallFactor', 0.5);
  runtime.set('hearing.openDoorFactor', 0.9);
  runtime.set('hearing.closedDoorFactor', 0.8);
  runtime.set('hearing.lockedDoorFactor', 0.7);
  runtime.set('hearing.minAudible', 0.01);
  runtime.set('movement.playerSpeed', 300);
  runtime.set('movement.humanSpeedMultiplier', 1.5);
  runtime.set('movement.humanAiMultiplier', 0.5);
  runtime.set('hearing.range.FOOTSTEP', 9);
  runtime.set('hearing.strength.FOOTSTEP', 0.9);
  runtime.set('hearing.lifetime.FOOTSTEP', 900);

  assert.equal(runtime.visionRange, 21);
  assert.equal(runtime.distanceFalloffPower, 2);
  assert.equal(runtime.wallSoundFactor, 0.5);
  assert.equal(runtime.openDoorSoundFactor, 0.9);
  assert.equal(runtime.closedDoorSoundFactor, 0.8);
  assert.equal(runtime.lockedDoorSoundFactor, 0.7);
  assert.equal(runtime.minimumAudibleStrength, 0.01);
  assert.equal(runtime.playerSpeedPx, 300);
  assert.equal(runtime.humanSpeedMultiplier, 1.5);
  assert.equal(runtime.humanAIMovementMultiplier, 0.5);
  assert.equal(runtime.range('FOOTSTEP'), 9);
  assert.equal(runtime.strength('FOOTSTEP'), 0.9);
  assert.equal(runtime.lifetimeMs('FOOTSTEP'), 900);
  assert.equal(runtime.soundRange('SPRINT'), GAME_CONFIG.perception.sounds.SPRINT.range);
});

test('the refused fields are documented and stay outside the whitelist', () => {
  assert.ok(RUNTIME_EXCLUDED_PARAMS.length >= 5);
  for (const entry of RUNTIME_EXCLUDED_PARAMS) assert.ok(entry.reason.length > 0);
  assert.equal(ids.includes('match.captureMs'), false);
  assert.equal(ids.includes('match.readyMs'), false);
  assert.equal(ids.includes('sprint.durationMs'), false);
  assert.equal(ids.includes('collision.playerRadius'), false);
  assert.equal(ids.includes('humanAI.navCellSize'), false);
});
