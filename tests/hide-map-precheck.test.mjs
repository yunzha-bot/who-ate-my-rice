import assert from 'node:assert/strict';
import test from 'node:test';
import { FURNITURE, HIDE_SPOTS, SPAWNS } from '../src/three/map/apartmentMap.ts';
import { precheckMapApplication } from '../src/three/map/MapApplicationPrecheck.ts';

// S7C-1B：地图应用前的只读预检。失败时调用方（场景编辑器）直接拒绝应用，
// 旧地图、两个角色站位与旧藏身状态都必须原样保留。
const actors = [
  { id: 'DEEPSEEK', x: SPAWNS.deepseek.x, z: SPAWNS.deepseek.z },
  { id: 'HUMAN', x: SPAWNS.human.x, z: SPAWNS.human.z },
];
const base = (overrides = {}) => ({
  furniture: FURNITURE,
  hideSpots: HIDE_SPOTS,
  actors,
  concealed: null,
  ...overrides,
});
const blockerAt = ({ x, z, size = 3 }) => ({ id: 'test_blocker', kind: 'furniture',
  x, z, width: size, depth: size, height: 1 });

test('当前正式地图 + 两个出生点 + 藏身者站在锚点上：预检通过', () => {
  const result = precheckMapApplication(base({
    concealed: { spotId: 'hide_main_bed', x: -14.4, z: -6.15 },
  }));
  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.subjectId, null);
});

test('新地图让某个角色站在非法位置时拒绝，并指出是哪个角色', () => {
  const result = precheckMapApplication(base({
    furniture: [...FURNITURE, blockerAt(SPAWNS.deepseek)],
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACTOR_NOT_STANDABLE');
  assert.equal(result.subjectId, 'DEEPSEEK');
  assert.match(result.message, /DEEPSEEK/);
});

test('新地图缺少正在使用的藏身点时拒绝', () => {
  const result = precheckMapApplication(base({
    hideSpots: HIDE_SPOTS.filter(spot => spot.id !== 'hide_main_bed'),
    concealed: { spotId: 'hide_main_bed', x: -14.4, z: -6.15 },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HIDE_SPOT_MISSING');
  assert.equal(result.subjectId, 'hide_main_bed');
});

test('新地图让藏身出口无法站立时拒绝（不能先强行请出再发现地图不可用）', () => {
  const result = precheckMapApplication(base({
    furniture: [...FURNITURE, blockerAt({ x: -14.4, z: -6.15 })],
    concealed: { spotId: 'hide_main_bed', x: -14.4, z: -6.15 },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HIDE_POSITION_NOT_STANDABLE');
  assert.equal(result.subjectId, 'hide_main_bed');
});

test('预检是只读的：不修改地图数据，也不改写传入的藏身信息', () => {
  const furnitureSnapshot = JSON.parse(JSON.stringify(FURNITURE));
  const spotsSnapshot = JSON.parse(JSON.stringify(HIDE_SPOTS));
  const concealed = { spotId: 'hide_main_bed', x: -14.4, z: -6.15 };
  precheckMapApplication(base({
    furniture: [...FURNITURE, blockerAt({ x: -14.4, z: -6.15 })], concealed,
  }));
  assert.deepEqual(JSON.parse(JSON.stringify(FURNITURE)), furnitureSnapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(HIDE_SPOTS)), spotsSnapshot);
  assert.deepEqual(concealed, { spotId: 'hide_main_bed', x: -14.4, z: -6.15 });
});

test('没有藏身者时只检查两个角色的站位', () => {
  assert.equal(precheckMapApplication(base()).ok, true);
  const blocked = precheckMapApplication(base({
    furniture: [...FURNITURE, blockerAt(SPAWNS.human)],
  }));
  assert.equal(blocked.code, 'ACTOR_NOT_STANDABLE');
  assert.equal(blocked.subjectId, 'HUMAN');
});
