import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import {
  CANDIDATE_TRY_LIMIT, CLUE_MEMORY_MAX, S7C2_INTERNAL_THRESHOLDS,
  STANCE_MAX_PATH_PROBES, STANCE_STAND_OFF, STANCE_SURFACE_STEP,
  TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH, TRACE_CHAIN_MAX_CLUES,
  TRACE_DIRECTION_CONTRADICTION_DEG, TRACE_LINK_DISTANCE, TRACE_LINK_STEPS,
} from '../src/systems/HumanSearchTuning.ts';

// S7C-2 的全部内部技术阈值都必须由现有源码里的真实数值推导，集中定义，并且
// 绝不暗中替换已经批准的正式平衡值，也不放大搜查能力 / 延长米痕寿命 / 增加搜查次数。

const tuningSource = readFileSync(
  new URL('../src/systems/HumanSearchTuning.ts', import.meta.url), 'utf8');

test('the approved S7C-2 gameplay values live in GAME_CONFIG and are unchanged', () => {
  assert.equal(GAME_CONFIG.humanSearch.range, 1.5, '搜查半径 1.5 世界单位');
  assert.equal(GAME_CONFIG.humanSearch.halfAngleDeg, 60, '半角 60°＝张角 120°');
  assert.equal(GAME_CONFIG.humanSearch.cooldownMs, 12_000, 'Human 玩家 Q 仍是 12 秒冷却');
  assert.equal(GAME_CONFIG.humanAI.searchDwellMs, 900, '搜查停留仍复用 900 ms');
  assert.equal(GAME_CONFIG.humanAI.hideCheckFailureCooldownMs, 6_000, '同家具失败冷却 6 秒');
  assert.equal(GAME_CONFIG.humanAI.hideCheckMaxPerRound, 1, '每轮最多正式检查 1 件家具');
  assert.equal(GAME_CONFIG.door.playerLockCooldownMs, 20_000, 'DeepSeek 玩家 Q 锁门冷却不变');
  assert.equal(GAME_CONFIG.perception.lastSeenMs, 8_000, 'Last Seen 8 秒不变');
  assert.equal(GAME_CONFIG.perception.traceLifetimeMs, 15_000, '米痕寿命 15 秒不变');
  assert.equal(GAME_CONFIG.perception.traceStepDistance, 0.65, '米痕生成间距不变');
  assert.equal(GAME_CONFIG.match.captureRadius, 0.70, '抓捕半径没有被本轮改动');
  assert.equal(GAME_CONFIG.humanAI.searchRadius, 12, '既有 SEARCH 半径没有被改动');
  assert.equal(GAME_CONFIG.humanAI.searchRoomCount, 3, '既有相邻房间上限没有被改动');
});

test('every derived threshold is finite, positive and inside its derived bound', () => {
  const numbers = [TRACE_LINK_STEPS, TRACE_LINK_DISTANCE, TRACE_CHAIN_MAX_CLUES,
    TRACE_DIRECTION_CONTRADICTION_DEG, TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH,
    CLUE_MEMORY_MAX, STANCE_SURFACE_STEP, STANCE_STAND_OFF, STANCE_MAX_PATH_PROBES,
    CANDIDATE_TRY_LIMIT];
  for (const value of numbers) {
    assert.ok(Number.isFinite(value) && value > 0, `阈值必须是正数：${value}`);
  }
  // 连接距离 = 真实生成间距 × 步数，且小于既有 SEARCH 半径的三分之一。
  assert.equal(TRACE_LINK_DISTANCE,
    GAME_CONFIG.perception.traceStepDistance * TRACE_LINK_STEPS);
  assert.ok(TRACE_LINK_DISTANCE < GAME_CONFIG.humanAI.searchRadius / 3);
  // 线索容量必须覆盖「一个完整米痕寿命内极速移动产生的脚印数」。
  const sprintSpeed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
    GAME_CONFIG.sprint.speedMultiplier;
  const maxFootprints = Math.ceil(sprintSpeed /
    GAME_CONFIG.perception.traceStepDistance *
    (GAME_CONFIG.perception.traceLifetimeMs / 1000));
  assert.ok(CLUE_MEMORY_MAX >= maxFootprints,
    `线索容量 ${CLUE_MEMORY_MAX} 必须覆盖理论上界 ${maxFootprints}，否则会丢真实线索`);
  // 站位间距：大于角色半径、小于搜查半径与最小交互区域半径。
  assert.ok(STANCE_STAND_OFF > GAME_CONFIG.collision.playerRadius);
  assert.ok(STANCE_STAND_OFF < GAME_CONFIG.humanSearch.range);
  assert.ok(STANCE_STAND_OFF < 1.2, '必须小于 DEV-A 已批准的最小交互区域半径');
  // 采样步长直接复用寻路格边长，保证相邻候选能落在不同导航格上。
  assert.equal(STANCE_SURFACE_STEP, GAME_CONFIG.humanAI.navCellSize);
  // 候选尝试数量复用既有 searchRoomCount。
  assert.equal(CANDIDATE_TRY_LIMIT, GAME_CONFIG.humanAI.searchRoomCount);
});

test('the central threshold list documents every exported derived number', () => {
  const ids = S7C2_INTERNAL_THRESHOLDS.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, '阈值清单不得重复');
  for (const entry of S7C2_INTERNAL_THRESHOLDS) {
    assert.ok(entry.value > 0);
    assert.ok(entry.unit.length > 0);
    assert.ok(entry.derivation.length > 0, `${entry.id} 必须写明推导依据`);
  }
  for (const id of ['TRACE_LINK_STEPS', 'TRACE_LINK_DISTANCE', 'TRACE_CHAIN_MAX_CLUES',
    'CLUE_MEMORY_MAX', 'STANCE_STAND_OFF', 'STANCE_MAX_PATH_PROBES', 'CANDIDATE_TRY_LIMIT'])
    assert.ok(ids.includes(id), `阈值清单缺少 ${id}`);
});

test('the tuning module only reuses existing values and never redefines balance data', () => {
  // 本模块只允许「引用」GAME_CONFIG，不允许出现字面量玩法数值。
  assert.match(tuningSource, /GAME_CONFIG\.perception\.traceStepDistance/);
  assert.match(tuningSource, /GAME_CONFIG\.humanAI\.navCellSize/);
  assert.match(tuningSource, /GAME_CONFIG\.humanAI\.searchRoomCount/);
  assert.doesNotMatch(tuningSource, /humanSearch\.(range|halfAngleDeg)/,
    '搜查半径与张角是用户批准的玩法值，必须直接读 GAME_CONFIG，不在阈值表里复制');
  // 不得放宽米痕寿命、搜查次数或搜查半径。
  assert.doesNotMatch(tuningSource, /traceLifetimeMs\s*[:=]\s*\d/);
  assert.doesNotMatch(tuningSource, /searchMaxMs\s*[:=]\s*\d/);
});
