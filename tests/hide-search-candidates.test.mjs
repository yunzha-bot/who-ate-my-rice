import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { FURNITURE, HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { hideRegionSetup } from '../src/three/map/HideInteractionRegion.ts';
import { rectSurfacePoint } from '../src/three/map/RotatedRect.ts';
import { gateHideSearchByClues, rankHideSearchCandidates }
  from '../src/systems/HideSearchCandidates.ts';
import { CANDIDATE_ALIGNMENT_BONUS, CANDIDATE_ANCHOR_WEIGHT,
  CANDIDATE_DISTANCE_WEIGHT, CANDIDATE_LAST_SEEN_BONUS, CANDIDATE_SOUND_BONUS,
  CANDIDATE_TERMINATION_BONUS } from '../src/systems/HumanSearchTuning.ts';
import { inferTraceDirection } from '../src/systems/HumanTraceTracking.ts';

// S7C-2 公开家具候选与排序。反作弊边界：候选只用公开藏身点、公开家具、Last Seen、
// 自己发现的米痕、实际听到的声音与自己搜查失败的历史。占用信息根本不在这条
// 数据通路上，所以「某件家具真的有人」不可能提高它的排序。

const carton = HIDE_SPOTS.find(spot => spot.id === 'hide_living_carton');
const cartonSetup = hideRegionSetup(carton, FURNITURE);
// 2026-10-04 区域级放大：客厅纸箱搬到 (-5.4, -9.6)，它唯一的 enter = exit 锚点是
// (-5.4, -8.6)（在纸箱 +Z 一侧）。所以「沿着锚点走向纸箱」的那条连续米痕是沿 -Z
// 前进的两粒米：最新一粒正好落在锚点（在公开交互区域内），更早一粒在 +Z 0.5 处。
// 米痕实体的朝向字段用 atan2(dx, dz)，沿 -Z 前进即 π，换算成世界朝向 -π/2 与链
// 方向一致，因此不会构成「方向矛盾」。
const CLUE_1 = { x: carton.x, z: carton.z + 0.5 };
const CLUE_2 = { x: carton.x, z: carton.z };
const CLUE_HEADING = Math.atan2(0, -1);
const clue = (id, x, z, createdAt) => ({ traceId: id, position: { x, z },
  heading: CLUE_HEADING, createdAt, discoveredAt: createdAt,
  validUntil: createdAt + 15_000 });

const base = (overrides = {}) => ({
  spots: HIDE_SPOTS,
  furniture: FURNITURE,
  origin: { x: 2, z: 3 },
  clues: [],
  inference: inferTraceDirection([]),
  lastSeen: null,
  heard: null,
  cooldownRemainingMs: () => 0,
  checked: new Set(),
  ...overrides,
});

test('the ranking is deterministic and sorted by public score then distance', () => {
  const clue1 = clue('a', CLUE_1.x, CLUE_1.z, 100);
  const clue2 = clue('b', CLUE_2.x, CLUE_2.z, 200);
  const inference = inferTraceDirection([clue1, clue2]);
  const input = base({ clues: [clue1, clue2], inference });
  const first = rankHideSearchCandidates(input);
  const second = rankHideSearchCandidates(input);
  assert.deepEqual(first, second, '同输入必须同输出（排序里没有随机数）');
  assert.equal(first.candidates[0].spotId, 'hide_living_carton',
    '线索链终止处的家具必须排在第一位');
  for (let index = 1; index < first.candidates.length; index++) {
    const previous = first.candidates[index - 1];
    const current = first.candidates[index];
    assert.ok(previous.score > current.score ||
      (previous.score === current.score && previous.distance <= current.distance),
    '排序必须严格按分数、再按距离');
  }
  assert.ok(first.candidates.length > 1, '痕迹中断时应当形成多个公开候选');
  assert.ok(first.rankingBasis.some(text => text.includes('排序：分数高→低')));
  assert.ok(first.candidates.every(candidate => candidate.basis.length > 0));
});

test('failed-cooldown, already-checked and missing-furniture candidates are excluded', () => {
  const report = rankHideSearchCandidates(base({
    cooldownRemainingMs: spotId => spotId === 'hide_living_carton' ? 4_000 : 0,
    checked: new Set(['hide_storage_carton']),
    spots: [...HIDE_SPOTS, { id: 'hide_ghost', roomId: 'living', x: 1, z: 1,
      kind: 'CARTON', furnitureId: 'missing_thing', facing: 0, label: '幽灵',
      interactionRegion: { shape: 'CIRCLE', radius: 1 } }],
  }));
  assert.ok(!report.candidates.some(candidate => candidate.spotId === 'hide_living_carton'));
  assert.ok(!report.candidates.some(candidate => candidate.spotId === 'hide_storage_carton'));
  assert.deepEqual(report.skipped.find(entry => entry.spotId === 'hide_living_carton'),
    { spotId: 'hide_living_carton', reason: 'COOLDOWN' });
  assert.deepEqual(report.skipped.find(entry => entry.spotId === 'hide_storage_carton'),
    { spotId: 'hide_storage_carton', reason: 'ALREADY_CHECKED' });
  assert.deepEqual(report.skipped.find(entry => entry.spotId === 'hide_ghost'),
    { spotId: 'hide_ghost', reason: 'NO_FURNITURE' });
});

test('the public score is exactly the documented formula, including the termination bonus', () => {
  const inside = clue('a', CLUE_1.x, CLUE_1.z, 100);
  const newest = clue('b', CLUE_2.x, CLUE_2.z, 200);
  const inference = inferTraceDirection([inside, newest]);
  const origin = { x: 2, z: 3 };
  const scored = rankHideSearchCandidates(base({
    clues: [inside, newest], inference, origin,
  })).candidates.find(candidate => candidate.spotId === 'hide_living_carton');
  const furniture = FURNITURE.find(rect => rect.id === carton.furnitureId);
  const surface = rectSurfacePoint(furniture, origin);
  const ownDistance = Math.hypot(origin.x - surface.x, origin.z - surface.z);
  const anchorDistance = Math.hypot(newest.position.x - surface.x,
    newest.position.z - surface.z);
  const expected = -CANDIDATE_DISTANCE_WEIGHT * ownDistance -
    CANDIDATE_ANCHOR_WEIGHT * anchorDistance + CANDIDATE_TERMINATION_BONUS +
    CANDIDATE_ALIGNMENT_BONUS;
  assert.ok(Math.abs(scored.distance - ownDistance) < 1e-9);
  assert.ok(Math.abs(scored.anchorDistance - anchorDistance) < 1e-9);
  assert.ok(Math.abs(scored.score - expected) < 1e-9,
    `公开评分必须能被逐项复算：实际 ${scored.score}，期望 ${expected}`);
  assert.ok(scored.basis.some(text => text.includes('公开交互区域内')));

  // 最新米痕落在区域外时不存在终止加分项（这里把它挪到客厅里远离纸箱的位置）。
  const outsideNewest = { ...newest, position: { x: carton.x + 3.0, z: carton.z + 2.0 } };
  const outsideInference = inferTraceDirection([inside, outsideNewest]);
  const outsideScored = rankHideSearchCandidates(base({
    clues: [inside, outsideNewest], inference: outsideInference, origin,
  })).candidates.find(candidate => candidate.spotId === 'hide_living_carton');
  assert.ok(!outsideScored.basis.some(text => text.includes('公开交互区域内')));
  assert.ok(outsideScored.score < scored.score);
});

test('alignment, Last Seen and heard-sound bonuses only come from public clues', () => {
  const clueA = clue('a', CLUE_1.x, CLUE_1.z, 100);
  const clueB = clue('b', CLUE_2.x, CLUE_2.z, 200);
  const towards = inferTraceDirection([clueA, clueB]);
  const away = { ...towards, direction: { x: -1, z: 0 }, directionHeadingRad: Math.PI };
  const scoreOf = input => rankHideSearchCandidates(input)
    .candidates.find(candidate => candidate.spotId === 'hide_living_carton').score;
  const aligned = scoreOf(base({ clues: [clueA, clueB], inference: towards }));
  const misaligned = scoreOf(base({ clues: [clueA, clueB], inference: away }));
  assert.ok(aligned > misaligned, '推断方向指向家具时必须加分');
  assert.ok(aligned - misaligned === CANDIDATE_ALIGNMENT_BONUS);

  const withoutSeen = scoreOf(base({ clues: [clueA, clueB], inference: towards }));
  const withSeen = scoreOf(base({ clues: [clueA, clueB], inference: towards,
    lastSeen: { position: { x: carton.x, z: carton.z }, timeMs: 1 } }));
  assert.equal(withSeen - withoutSeen, CANDIDATE_LAST_SEEN_BONUS);
  const withSound = scoreOf(base({ clues: [clueA, clueB], inference: towards,
    heard: { position: { x: carton.x, z: carton.z }, type: 'FOOTSTEP' } }));
  assert.equal(withSound - withoutSeen, CANDIDATE_SOUND_BONUS);
});

test('a wide-open clue still produces several candidates without inventing one', () => {
  // 主卧（-26.5…-14.5 × -13.5…0.5）里的一个痕迹落点：主卧自己就有两件公开家具。
  const mainBedAnchor = HIDE_SPOTS.find(spot => spot.id === 'hide_main_bed');
  const between = clue('a', mainBedAnchor.x + 2.4, mainBedAnchor.z, 100);
  const inference = inferTraceDirection([between]);
  const report = rankHideSearchCandidates(base({ clues: [between], inference,
    origin: { x: mainBedAnchor.x + 4.4, z: mainBedAnchor.z } }));
  assert.ok(report.candidates.length >= 2,
    '主卧里有两件公开家具，痕迹落点应当同时给出多个候选');
  assert.ok(report.candidates.every(candidate =>
    candidate.spotId.startsWith('hide_')));
  assert.equal(report.candidates.length, HIDE_SPOTS.length);
});

test('the clue gate keeps a single grain from locking onto furniture', () => {
  const single = clue('a', CLUE_2.x, CLUE_2.z, 100);
  const singleInference = inferTraceDirection([single]);
  const noExtra = gateHideSearchByClues({ inference: singleInference, lastSeen: null,
    heard: null, spots: HIDE_SPOTS, furniture: FURNITURE });
  assert.equal(noExtra.ok, false);
  assert.equal(noExtra.code, 'SINGLE_TRACE_NO_EXTRA_CLUE');
  assert.deepEqual(noExtra.extraClueSpotIds, []);

  // 一粒米 + 一条独立公开线索（Last Seen 落在家具的公开交互区域内）才放行。
  const withSeen = gateHideSearchByClues({ inference: singleInference,
    lastSeen: { position: { x: carton.x, z: carton.z }, timeMs: 1 }, heard: null,
    spots: HIDE_SPOTS, furniture: FURNITURE });
  assert.equal(withSeen.ok, true);
  assert.deepEqual(withSeen.extraClueSpotIds, ['hide_living_carton']);

  // 两粒连续米痕本身就构成可搜查的路径。
  const chained = gateHideSearchByClues({ inference: inferTraceDirection([
    clue('a', CLUE_1.x, CLUE_1.z, 100), clue('b', CLUE_2.x, CLUE_2.z, 200)]),
  lastSeen: null, heard: null,
  spots: HIDE_SPOTS, furniture: FURNITURE });
  assert.equal(chained.ok, true);
  assert.equal(chained.code, 'OK');

  assert.equal(gateHideSearchByClues({ inference: inferTraceDirection([]),
    lastSeen: null, heard: null, spots: HIDE_SPOTS, furniture: FURNITURE }).code, 'NO_CLUE');
  assert.equal(gateHideSearchByClues({ inference: {
    code: 'CHAIN_CONTRADICTORY', confidence: 'LOW', anchor: { x: carton.x, z: carton.z },
    direction: null, directionHeadingRad: null, chain: ['a', 'b'], newestTraceId: 'b',
    gaps: 0, basis: [],
  }, lastSeen: null, heard: null, spots: HIDE_SPOTS, furniture: FURNITURE }).code,
  'CONTRADICTORY');
  void cartonSetup;
});

test('the candidate layer never reads occupancy or hidden positions', () => {
  const source = rankHideSearchCandidates.toString() + String(gateHideSearchByClues);
  assert.doesNotMatch(source, /occupan|concealed|isHidden/i);
  // 公开交互区域几何仍然是 DEV-A 的那一套，没有第二套「附近」规则。
  assert.ok(cartonSetup);
  assert.equal(cartonSetup.geometry.radius, 1.2);
  assert.equal(cartonSetup.region?.shape ?? carton.interactionRegion.shape, 'CIRCLE');
  assert.ok(GAME_CONFIG.humanSearch.halfAngleDeg === 60,
    '方向对齐容差直接复用搜查扇形半角，不新造数值');
});
