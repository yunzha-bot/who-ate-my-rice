// S7D：双阵营**整局批量仿真**（自动化批量验证腿）。
//
// 用法（在仓库根目录）：node --experimental-strip-types docs/verification/S7D/run-match-batch.mjs [perCombo] [seedBase] [outDir]
//
// 说明（报告中必须保留）：本脚本跑的是 `tests/s7d-match-sim.mjs` 的**无头逻辑仿真**，
// 不是真实游戏、不是浏览器实机、更不是真人试玩。它复用生产系统与两套 AI 的同一批
// 源码，用来大批量跑整局、采集遥测并定位整局阻断问题。
//
// 组合（每条 ≥ perCombo 局）：
//   HUMAN + idle   玩家站桩，DeepSeek AI 必须独立吃完 5/5 米 → DEEPSEEK/RICE_COMPLETED
//   HUMAN + pursue 玩家追逐，DeepSeek AI 必须逃跑 / 冲刺 / 关门 / 锁门 / 藏身
//   DEEPSEEK + idle   玩家站桩，Human AI 必须巡逻 → 追逐 → 抓捕 → HUMAN/CAPTURED
//   DEEPSEEK + eat    玩家自己吃米，Human AI 必须巡逻 / 开门 / 调查 / 搜查家具
import { mkdirSync, writeFileSync } from 'node:fs';
import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const PER_COMBO = Number(process.argv[2] ?? 6);
const SEED_BASE = Number(process.argv[3] ?? 20260927);
const OUT = process.argv[4] ?? 'docs/verification/S7D';
const SET = process.argv[5] ?? 'core';
// 两套组合。「baseline」是修复前基线用的同一批组合，用来做严格同组合的 A/B；
// 「core」是修复后把 `wander` 换成更强的 `pressure`、并加入 `hideEat` 的默认批次。
const COMBO_SETS = {
  baseline: [
    { playerFaction: 'HUMAN', policy: 'idle' },
    { playerFaction: 'HUMAN', policy: 'pursue' },
    { playerFaction: 'HUMAN', policy: 'wander' },
    { playerFaction: 'DEEPSEEK', policy: 'idle' },
    { playerFaction: 'DEEPSEEK', policy: 'eat' },
    { playerFaction: 'DEEPSEEK', policy: 'evadeEat' },
  ],
  core: [
    { playerFaction: 'HUMAN', policy: 'idle' },
    { playerFaction: 'HUMAN', policy: 'pursue' },
    { playerFaction: 'HUMAN', policy: 'pressure' },
    { playerFaction: 'DEEPSEEK', policy: 'idle' },
    { playerFaction: 'DEEPSEEK', policy: 'evadeEat' },
    { playerFaction: 'DEEPSEEK', policy: 'hideEat' },
  ],
};
const COMBOS = COMBO_SETS[SET];
if (!COMBOS) throw new Error(`未知组合集：${SET}`);
const MAX_FRAMES = 12000;               // 10 分钟游戏时间上限
const STUCK_FRAMES_LIMIT = 100;         // 连续 5 秒「有移动指令但零位移」
const NO_PROGRESS_LIMIT_MS = 60_000;    // DeepSeek AI 连续 60 秒没吃到米（含已验收的安全通行绕行）
const LOOP_LIMIT = 20;                  // 同一段 6 连状态循环重复次数上限

function summarizeEvents(log) {
  const counts = {};
  for (const event of log.events) {
    counts[event.type] = (counts[event.type] ?? 0) + event.count;
  }
  const hideCounts = {};
  for (const event of log.hideEvents) {
    hideCounts[event.type] = (hideCounts[event.type] ?? 0) + 1;
  }
  const searchCounts = {};
  for (const event of log.humanSearchEvents) {
    searchCounts[event.type] = (searchCounts[event.type] ?? 0) + 1;
  }
  return { counts, hideCounts, searchCounts, truncated: log.truncated,
    eventCount: log.eventCount, hideEventCount: log.hideEvents.length,
    humanSearchEventCount: log.humanSearchEvents.length };
}

function anomalyReasons(result) {
  const reasons = [];
  const t = result.telemetry;
  if (result.timedOut) reasons.push(`TIMEOUT_AT_${result.frames}_FRAMES`);
  if (t.deepseekStuckFrames > STUCK_FRAMES_LIMIT) {
    reasons.push(`DEEPSEEK_STUCK_FRAMES_${t.deepseekStuckFrames}`);
  }
  if (t.humanStuckFrames > STUCK_FRAMES_LIMIT) {
    reasons.push(`HUMAN_STUCK_FRAMES_${t.humanStuckFrames}`);
  }
  if (result.playerFaction === 'HUMAN' && t.longestNoRiceProgressMs > NO_PROGRESS_LIMIT_MS) {
    reasons.push(`DEEPSEEK_NO_RICE_PROGRESS_${t.longestNoRiceProgressMs}MS`);
  }
  for (const entry of result.loop) {
    if (entry.count >= LOOP_LIMIT) reasons.push(`LOOP_${entry.pattern}_x${entry.count}`);
  }
  if (t.unreachableCount > 20) reasons.push(`UNREACHABLE_${t.unreachableCount}`);
  return reasons;
}

mkdirSync(OUT, { recursive: true });
const matches = [];
const startedAll = Date.now();
for (const combo of COMBOS) {
  for (let index = 0; index < PER_COMBO; index++) {
    const seed = (SEED_BASE + index * 7919) % 0xffffffff;
    const started = Date.now();
    const sim = createMatchSim({ seed, ...combo });
    const result = sim.run(MAX_FRAMES);
    const anomalies = anomalyReasons(result);
    matches.push({
      seed, ...combo, wallMs: Date.now() - started,
      frames: result.frames, simMs: result.simMs, timedOut: result.timedOut,
      phase: result.phase, winner: result.winner, reason: result.reason,
      elapsedMs: result.elapsedMs, riceCompleted: result.riceCompleted,
      riceTotal: result.riceTotal, setup: result.setup,
      telemetry: result.telemetry, loop: result.loop,
      events: summarizeEvents(result.log), anomalies,
    });
    const row = matches[matches.length - 1];
    console.log(`[${combo.playerFaction}/${combo.policy} seed=${seed}] ` +
      `${row.phase} ${row.winner ?? '-'}/${row.reason ?? '-'} ` +
      `elapsed=${(row.elapsedMs / 1000).toFixed(1)}s rice=${row.riceCompleted}/5 ` +
      `wall=${row.wallMs}ms stuck=${row.telemetry.deepseekStuckFrames}/` +
      `${row.telemetry.humanStuckFrames} gap=${row.telemetry.longestNoRiceProgressMs}ms ` +
      `hide=${row.telemetry.hideEntered}/${row.telemetry.hideExited} ` +
      `check=${row.telemetry.humanCheckStarted}(H${row.telemetry.humanCheckHit}` +
      `/M${row.telemetry.humanCheckMiss}/I${row.telemetry.humanCheckIncomplete}) ` +
      `${row.anomalies.length ? 'ANOMALY: ' + row.anomalies.join(',') : 'ok'}`);
  }
}

const totals = {};
for (const match of matches) {
  const key = `${match.playerFaction}/${match.policy}`;
  const bucket = totals[key] ??= { matches: 0, wins: {}, timedOut: 0, anomalies: 0,
    hideEntered: 0, hideExited: 0, doorLocked: 0, doorClosed: 0, sprintStarted: 0,
    falls: 0, humanCheckStarted: 0, humanCheckHit: 0, humanCheckMiss: 0,
    humanCheckIncomplete: 0, eventTypes: {} };
  bucket.matches++;
  const outcome = `${match.winner ?? 'NONE'}/${match.reason ?? 'NONE'}`;
  bucket.wins[outcome] = (bucket.wins[outcome] ?? 0) + 1;
  if (match.timedOut) bucket.timedOut++;
  bucket.anomalies += match.anomalies.length;
  for (const key2 of ['hideEntered', 'hideExited', 'doorLocked', 'doorClosed',
    'sprintStarted', 'falls', 'humanCheckStarted', 'humanCheckHit', 'humanCheckMiss',
    'humanCheckIncomplete']) {
    bucket[key2] += match.telemetry[key2];
  }
  for (const [type, count] of Object.entries(match.events.counts)) {
    bucket.eventTypes[type] = (bucket.eventTypes[type] ?? 0) + count;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  kind: 'headless-logic-simulation',
  caveat: '无头逻辑仿真（非浏览器实机、非真人试玩）；复用生产系统与两套 AI 的同一批源码。',
  perCombo: PER_COMBO, seedBase: SEED_BASE, maxFrames: MAX_FRAMES, comboSet: SET,
  wallMs: Date.now() - startedAll,
  matchCount: matches.length,
  thresholds: { STUCK_FRAMES_LIMIT, NO_PROGRESS_LIMIT_MS, LOOP_LIMIT },
  totals, anomalies: matches.filter(match => match.anomalies.length > 0)
    .map(match => ({ seed: match.seed, playerFaction: match.playerFaction,
      policy: match.policy, anomalies: match.anomalies })),
  matches,
};
writeFileSync(`${OUT}/match-batch.json`, JSON.stringify(report, null, 2));
console.log(`\n共 ${matches.length} 局，用时 ${((Date.now() - startedAll) / 1000).toFixed(1)}s；` +
  `异常 ${report.anomalies.length} 局。详见 ${OUT}/match-batch.json`);
console.log(JSON.stringify(totals, null, 2));
