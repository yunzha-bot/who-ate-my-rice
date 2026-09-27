// S7D 稳健性：同一布局种子在**多条不同 AI 随机流**下重复整局，统计结算率。
// 正式游戏的 AI 掷骰是 Math.random，因此同一 matchSeed 只固定布局；这里用派生流模拟
// 「同一布局、不同 AI 掷骰」的重复对局，用来估计修复后的整局稳定性。
//
// 用法：node --experimental-strip-types docs/verification/S7D/robustness-sweep.mjs [streams] [seed]
import { seededRandom } from '../../../src/systems/MatchRandom.ts';
import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const STREAMS = Number(process.argv[2] ?? 24);
const SEED = Number(process.argv[3] ?? 20292603);
const rows = [];
for (let stream = 1; stream <= STREAMS; stream++) {
  const random = seededRandom((stream * 0x9e3779b1) >>> 0);
  const sim = createMatchSim({ seed: SEED, playerFaction: 'HUMAN', policy: 'idle', random });
  const result = sim.run(12000);
  const anomalies = result.log.matchSummary.anomalies.map(entry => entry.kind);
  rows.push({ stream, timedOut: result.timedOut, winner: result.winner,
    reason: result.reason, elapsedMs: result.elapsedMs,
    rice: result.riceCompleted, anomalies, setup: result.setup.attempts });
  console.log(`stream=${String(stream).padStart(2)} ` +
    `${result.timedOut ? '未结算' : `${result.winner}/${result.reason}`} ` +
    `elapsed=${(result.elapsedMs / 1000).toFixed(1)}s rice=${result.riceCompleted}/5 ` +
    `anomalies=${anomalies.join(',') || '无'}`);
}
const timedOut = rows.filter(row => row.timedOut).length;
const elapsed = rows.filter(row => !row.timedOut).map(row => row.elapsedMs).sort((a, b) => a - b);
console.log(`\n种子 ${SEED}：${STREAMS - timedOut}/${STREAMS} 结算；` +
  `未结算 ${timedOut}；结算耗时 中位 ${(elapsed[Math.floor(elapsed.length / 2)] / 1000).toFixed(1)}s ` +
  `最长 ${(elapsed[elapsed.length - 1] / 1000).toFixed(1)}s`);
const kinds = {};
for (const row of rows) for (const kind of row.anomalies) kinds[kind] = (kinds[kind] ?? 0) + 1;
console.log(`异常种类统计：${JSON.stringify(kinds)}`);
