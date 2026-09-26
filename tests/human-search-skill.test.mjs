import assert from 'node:assert/strict';
import test from 'node:test';
import { Object3D, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { evaluateHumanSearch, headingRadToMeshRotationY,
  DEFAULT_HUMAN_SEARCH_TUNING } from '../src/systems/HumanSearchSkill.ts';

// S7C-1B：Human Q 的扇形判定。释放瞬间只有一次判定；对藏身目标瞄的是**家具可接近
// 表面**，对未藏身目标才是真实位置。
const WARDROBE = { id: 'main_wardrobe', kind: 'furniture', x: 0, z: 0,
  width: 1, depth: 2, height: 1.15 };
const NORTH = { x: 0, z: -2 };          // 站在衣柜的 -Z 侧
const FACING_WARDROBE = Math.PI / 2;    // 朝 +Z
const noBlock = () => false;
const blocked = () => true;
const search = (overrides = {}) => evaluateHumanSearch({
  origin: NORTH,
  headingRad: FACING_WARDROBE,
  target: { concealed: true, position: { x: 99, z: 99 },
    spotId: 'hide_main_wardrobe', furniture: WARDROBE },
  lineBlocked: noBlock,
  ...overrides,
});

test('已批准数值来自 GAME_CONFIG：半径 1.5、张角 120°（半角 60°）', () => {
  assert.equal(GAME_CONFIG.humanSearch.range, 1.5);
  assert.equal(GAME_CONFIG.humanSearch.halfAngleDeg, 60);
  assert.equal(GAME_CONFIG.humanSearch.cooldownMs, 12_000);
  assert.equal(DEFAULT_HUMAN_SEARCH_TUNING.range, 1.5);
  assert.equal(DEFAULT_HUMAN_SEARCH_TUNING.halfAngleDeg * 2, 120);
});

test('藏身目标命中家具暴露表面，而不是家具中心或藏身者实时坐标', () => {
  const result = search();
  assert.equal(result.outcome, 'FLUSH_CONCEALED');
  assert.equal(result.code, 'HIT_CONCEALED');
  assert.deepEqual(result.aimPoint, { x: 0, z: -1 });
  assert.equal(result.concealed, true);
  assert.equal(result.spotId, 'hide_main_wardrobe');
  assert.ok(Math.abs(result.distance - 1) < 1e-9);
  // 藏身者的真实位置被完全忽略：换成任意坐标都不会改变结果。
  const moved = search({ target: { concealed: true, position: { x: -40, z: 40 },
    spotId: 'hide_main_wardrobe', furniture: WARDROBE } });
  assert.deepEqual(moved, result);
});

test('家具中心落在扇形内也不能隔墙命中', () => {
  // 站得很近：到家具中心 1.2 < 1.5，中心确实落在扇形与半径内。
  const near = { x: 0, z: -1.2 };
  const open = evaluateHumanSearch({ origin: near, headingRad: FACING_WARDROBE,
    target: { concealed: true, position: { x: 99, z: 99 },
      spotId: 'hide_main_wardrobe', furniture: WARDROBE },
    lineBlocked: noBlock });
  assert.equal(open.outcome, 'FLUSH_CONCEALED');
  const walled = evaluateHumanSearch({ origin: near, headingRad: FACING_WARDROBE,
    target: { concealed: true, position: { x: 99, z: 99 },
      spotId: 'hide_main_wardrobe', furniture: WARDROBE },
    lineBlocked: blocked });
  assert.equal(walled.outcome, 'MISS');
  assert.equal(walled.code, 'BLOCKED');
  assert.equal(walled.blocked, true);
});

test('未藏身目标用真实位置判定，命中即立即抓捕', () => {
  const result = evaluateHumanSearch({
    origin: { x: 0, z: 0 }, headingRad: 0,
    target: { concealed: false, position: { x: 1, z: 0 }, spotId: null, furniture: null },
    lineBlocked: noBlock,
  });
  assert.equal(result.outcome, 'CAPTURE_VISIBLE');
  assert.equal(result.code, 'HIT_VISIBLE');
  assert.deepEqual(result.aimPoint, { x: 1, z: 0 });
  assert.equal(result.concealed, false);
});

test('半径边界含入：恰好 1.5 命中，超出即未命中', () => {
  const atEdge = evaluateHumanSearch({
    origin: { x: 0, z: -2.5 }, headingRad: FACING_WARDROBE,
    target: { concealed: true, position: { x: 99, z: 99 },
      spotId: 'hide_main_wardrobe', furniture: WARDROBE },
    lineBlocked: noBlock,
  });
  assert.equal(atEdge.code, 'HIT_CONCEALED');
  assert.ok(Math.abs(atEdge.distance - 1.5) < 1e-9);
  const beyond = evaluateHumanSearch({
    origin: { x: 0, z: -2.5001 }, headingRad: FACING_WARDROBE,
    target: { concealed: true, position: { x: 99, z: 99 },
      spotId: 'hide_main_wardrobe', furniture: WARDROBE },
    lineBlocked: noBlock,
  });
  assert.equal(beyond.outcome, 'MISS');
  assert.equal(beyond.code, 'OUT_OF_RANGE');
});

test('张角边界含入：±60° 命中，±61° 未命中（两侧对称）', () => {
  const at = degrees => evaluateHumanSearch({
    origin: { x: 0, z: 0 }, headingRad: 0,
    target: { concealed: false,
      position: { x: Math.cos(degrees * Math.PI / 180), z: Math.sin(degrees * Math.PI / 180) },
      spotId: null, furniture: null },
    lineBlocked: noBlock,
  });
  for (const degrees of [60, -60, 0, 59.9, -59.9]) {
    assert.equal(at(degrees).code, 'HIT_VISIBLE', `${degrees}° 应命中`);
  }
  for (const degrees of [61, -61, 180, -120]) {
    assert.equal(at(degrees).code, 'OUTSIDE_FAN', `${degrees}° 不应命中`);
  }
});

test('缺失目标、缺失藏身点或家具数据时不允许命中', () => {
  assert.equal(search({ target: null }).code, 'NO_TARGET');
  assert.equal(search({ target: { concealed: true, position: { x: 0, z: 0 },
    spotId: null, furniture: WARDROBE } }).code, 'NO_HIDE_SPOT');
  assert.equal(search({ target: { concealed: true, position: { x: 0, z: 0 },
    spotId: 'hide_main_wardrobe', furniture: null } }).code, 'EMPTY_HIDE_SPOT');
});

test('表现层朝向与判定角度使用同一个约定（rotation.y = -heading）', () => {
  assert.equal(headingRadToMeshRotationY(Math.PI / 2), -Math.PI / 2);
  for (const heading of [0, 0.5, Math.PI / 2, -2.1, Math.PI]) {
    const object = new Object3D();
    object.rotation.y = headingRadToMeshRotationY(heading);
    object.updateMatrixWorld(true);
    const forward = new Vector3(1, 0, 0).applyMatrix4(object.matrixWorld);
    assert.ok(Math.abs(forward.x - Math.cos(heading)) < 1e-9, `heading ${heading} 的 X 分量`);
    assert.ok(Math.abs(forward.z - Math.sin(heading)) < 1e-9, `heading ${heading} 的 Z 分量`);
  }
});
