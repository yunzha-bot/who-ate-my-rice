import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatchSim, DELTA_MS } from './s7d-match-sim.mjs';

// S7D：**整局**回归。每个用例都从随机出生点 / 随机门初态 / 随机米位开始，跑完整的
// 「READY → 对局 → 结算」，断言两种阵营都能推进到正确的胜负结算。
//
// 这是逻辑层整局仿真（无渲染、无 DOM、固定 50 ms 帧步长），复用生产系统与两套 AI
// 的同一批源码；它不是浏览器实机，也不是真人试玩。
//
// 帧数上限 = 150 秒游戏时间（3000 帧），远超实测所需的 40～75 秒。

const CAP_FRAMES = 3000;

function play(seed, playerFaction, policy) {
  const sim = createMatchSim({ seed, playerFaction, policy });
  return sim.run(CAP_FRAMES);
}

test('玩家选 Human 时 DeepSeek AI 能独立吃完 5/5 米并结算', () => {
  for (const seed of [20268846, 20276765, 20284684]) {
    const result = play(seed, 'HUMAN', 'idle');
    assert.equal(result.timedOut, false, `seed ${seed} 未在时限内结算`);
    assert.equal(result.phase, 'FINISHED');
    assert.equal(result.winner, 'DEEPSEEK');
    assert.equal(result.reason, 'RICE_COMPLETED');
    assert.equal(result.riceCompleted, 5);
  }
});

test('SAFE_WAIT 不会在最后一堆米前无限等待（S7D 修复的整局阻断）', () => {
  // 该种子是修复前的复现：Human 站在最后一堆米 4.03 u 外静止，路线最近只到 1.60 u，
  // 落在「SAFE_WAIT 危险半径 3.0」与「静止通行阻挡半径 1.5」之间的死区里，
  // AI 曾在这里原地等待 560 秒且整局无法结算。
  const result = play(20292603, 'HUMAN', 'idle');
  assert.equal(result.timedOut, false);
  assert.equal(result.winner, 'DEEPSEEK');
  assert.equal(result.riceCompleted, 5);
  // 修复后的实测约为 74 秒；这里给出宽松上界，防止退回「一直等到结束」。
  assert.ok(result.elapsedMs < 120_000, `整局耗时 ${result.elapsedMs} ms`);
});

test('玩家选 DeepSeek 娘时 Human AI 能自己完成巡逻、追逐与抓捕结算', () => {
  for (const seed of [20260927, 20268846, 20292603]) {
    const result = play(seed, 'DEEPSEEK', 'idle');
    assert.equal(result.timedOut, false, `seed ${seed} 未在时限内结算`);
    assert.equal(result.phase, 'FINISHED');
    assert.equal(result.winner, 'HUMAN');
    assert.equal(result.reason, 'CAPTURED');
  }
});

test('玩家藏进家具后 Human AI 能靠公开线索把它搜出来并结算', () => {
  const result = play(20276765, 'DEEPSEEK', 'hideEat');
  assert.equal(result.timedOut, false);
  assert.equal(result.winner, 'HUMAN');
  assert.equal(result.reason, 'CAPTURED');
  assert.ok(result.telemetry.hideEntered >= 1, '玩家本局没有真的藏身');
  assert.ok(result.telemetry.humanCheckStarted >= 1, 'Human AI 没有发起正式家具搜查');
  assert.ok(result.telemetry.humanCheckHit >= 1, 'Human AI 没有搜中藏身的玩家');
});

test('整局里不应出现长时间「有移动指令但零位移」的卡墙', () => {
  for (const [seed, playerFaction, policy] of [
    [20260927, 'HUMAN', 'pursue'], [20268846, 'HUMAN', 'pressure'],
    [20276765, 'DEEPSEEK', 'evadeEat']]) {
    const result = play(seed, playerFaction, policy);
    assert.ok(result.telemetry.deepseekStuckFrames < 40,
      `seed ${seed} DeepSeek 卡墙帧数 ${result.telemetry.deepseekStuckFrames}`);
    assert.ok(result.telemetry.humanStuckFrames < 40,
      `seed ${seed} Human 卡墙帧数 ${result.telemetry.humanStuckFrames}`);
  }
});

test('同一随机种子与同一策略复现出同一整局结果', () => {
  const first = play(20260927, 'HUMAN', 'idle');
  const second = play(20260927, 'HUMAN', 'idle');
  assert.equal(first.winner, second.winner);
  assert.equal(first.reason, second.reason);
  assert.equal(first.frames, second.frames);
  assert.equal(first.riceCompleted, second.riceCompleted);
  assert.equal(DELTA_MS, 50);
});

test('结算用的整局遥测口径与 AI JSON 摘要一致', () => {
  const result = play(20276765, 'DEEPSEEK', 'hideEat');
  const summary = result.log.matchSummary;
  assert.equal(summary.winner, result.winner);
  assert.equal(summary.reason, result.reason);
  assert.equal(summary.riceCompleted, result.riceCompleted);
  assert.equal(summary.riceTotal, result.riceTotal);
  assert.equal(summary.matchSeed, result.seed);
  assert.equal(summary.playerFaction, 'DEEPSEEK');
  assert.equal(summary.counts.hideEntered, result.telemetry.hideEntered);
  assert.equal(summary.counts.humanCheckStarted, result.telemetry.humanCheckStarted);
});
