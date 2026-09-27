// S7D：对单局仿真做逐事件时间线分析（定位整局阻断）。
// 用法：node --experimental-strip-types docs/verification/S7D/analyze-match.mjs <seed> <HUMAN|DEEPSEEK> <policy> [filter] [stream]
//   stream：可选的 AI 随机流编号（同一种子布局 + 不同 AI 掷骰）；不传则用默认流。
import { seededRandom } from '../../../src/systems/MatchRandom.ts';
import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const seed = Number(process.argv[2]);
const playerFaction = process.argv[3] ?? 'HUMAN';
const policy = process.argv[4] ?? 'idle';
const filter = process.argv[5] && process.argv[5] !== '-' ? process.argv[5] : '';
const stream = process.argv[6] ? Number(process.argv[6]) : null;
const random = stream === null ? undefined
  : seededRandom((stream * 0x9e3779b1) >>> 0);
const sim = createMatchSim({ seed, playerFaction, policy, random });
const result = sim.run(12000);
console.log(`seed=${seed} ${playerFaction}/${policy} phase=${result.phase} ` +
  `${result.winner}/${result.reason} rice=${result.riceCompleted}/5 ` +
  `elapsed=${(result.elapsedMs / 1000).toFixed(1)}s frames=${result.frames} state=${sim.systems.deepseekAI.state}`);
console.log(`setup: dp=${result.setup.deepseek.id}(${result.setup.deepseek.roomId}) ` +
  `hu=${result.setup.human.id}(${result.setup.human.roomId}) rice=${result.setup.riceIds.join(',')} ` +
  `open=${result.setup.doorOpenCount}/18 attempts=${result.setup.attempts}`);
console.log('deepseek state timeline (compact):');
let lastState = null;
const transitions = [];
for (const event of result.log.events) {
  if (event.type === 'STATE_TRANSITION') {
    transitions.push(event);
  }
}
// 压缩成 run-length：状态 + 目标 + 威胁 + 房间变化时输出一行
for (const event of result.log.events) {
  if (!['STATE_TRANSITION', 'TARGET_CHANGE', 'THREAT_CHANGE', 'THREAT_SOURCE_CHANGE',
    'ROOM_CHANGE', 'TRANSITION_REASON', 'SAFE_WAIT_REASON', 'ESCAPE_SWITCH',
    'NO_MOVEMENT', 'LOCAL_LOOP', 'RECOVERY_BLOCK', 'NAVIGATION_RESULT',
    'SAFE_WAIT_FAILURES', 'DOOR_LOCK_APPLY', 'DOOR_ESCAPE_CLOSE', 'PASSAGE_GATE']
    .includes(event.type)) continue;
  if (filter && !event.type.includes(filter)) continue;
  const c = event.context;
  console.log(`${(event.t / 1000).toFixed(1)}s x${event.count} ${event.type} ` +
    `state=${event.state} reason=${event.reason} target=${c.targetRiceId} ` +
    `threat=${c.threatLevel}/${c.threatSource} room=${c.roomId} ` +
    `humanVisible=${c.humanVisible} still=${c.humanStillMs} safeWait=${c.safeWaitReason} ` +
    `noMove=${c.noMovementReason} escape=${c.lastEscapeSwitchReason}`);
}
console.log(`rice: ${JSON.stringify(result.telemetry.lastRiceProgressMs)}ms last progress`);
console.log(`telemetry=${JSON.stringify(result.telemetry)}`);
console.log(`top loops=${JSON.stringify(result.loop)}`);
