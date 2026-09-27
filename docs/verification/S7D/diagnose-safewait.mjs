// S7D 诊断：SAFE_WAIT 永久等待（seed 20292603 HUMAN/idle）的数值证据。
// 用法：node --experimental-strip-types docs/verification/S7D/diagnose-safewait.mjs
import { GAME_CONFIG as C } from '../../../src/config/gameConfig.ts';
import { RICE_CANDIDATES } from '../../../src/three/map/apartmentMap.ts';
import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const sim = createMatchSim({ seed: 20292603, playerFaction: 'HUMAN', policy: 'idle' });
const ai = sim.systems.deepseekAI;
const navigation = sim.systems.navigation;
const doors = sim.systems.doorSystem.doors;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const RICE = Object.fromEntries(RICE_CANDIDATES.map(rice => [rice.id, rice]));
void distance;

for (const t of [30_000, 60_000, 120_000, 300_000, 590_000]) {
  while (sim.systems.match.phase === 'READY' ||
      (sim.systems.match.phase === 'PLAYING' && sim.systems.match.elapsedMs < t)) {
    sim.step();
  }
  const dp = sim.positions.deepseek, hu = sim.positions.human;
  console.log(`\n===== t=${(sim.systems.match.elapsedMs / 1000).toFixed(1)}s =====`);
  console.log(`AI state=${ai.state} target=${ai.targetRiceId} safeWaitRice=${ai.safeWaitRiceId} ` +
    `entry=${ai.safeWaitEntryId} reason=${ai.safeWaitReason} failures=${ai.safeWaitFailureCount} ` +
    `passageGate=${ai.passageGateReason} passageActive=${ai.passageActive} ` +
    `roll=${ai.passageRollResult} rolledForStill=${ai.passageRolledForStillEvent} ` +
    `cooldown=${((ai.curiosityCooldownRemainingMs ?? 0) / 1000).toFixed(1)}s`);
  console.log(`AI=(${dp.x.toFixed(2)},${dp.z.toFixed(2)}) HUMAN=(${hu.x.toFixed(2)},${hu.z.toFixed(2)}) ` +
    `dist=${distance(dp, hu).toFixed(2)} dangerRouteRadius=${C.deepseekAI.dangerRouteRadius} ` +
    `blockRadius=${C.deepseekAI.stationaryPassageBlockRadius} ` +
    `captureRadius=${C.match.captureRadius} avoidRadius=${ai.passageAvoidRadius.toFixed(2)}`);
  for (const state of sim.systems.rice.states) {
    const point = { x: RICE[state.id]?.x, z: RICE[state.id]?.z };
    console.log(`  ${state.id} progress=${(state.progressMs / 1000).toFixed(1)}s ` +
      `completed=${state.completed} pos=(${point.x},${point.z}) ` +
      `distToHuman=${distance(point, hu).toFixed(2)}`);
  }
  const open = sim.systems.rice.states.filter(state => !state.completed);
  for (const state of open) {
    const point = { x: RICE[state.id]?.x, z: RICE[state.id]?.z };
    const path = navigation.findPath(dp, point, doors);
    console.log(`  -> path to ${state.id}: nodes=${path ? path.length : 'null'} ` +
      `humanDistToRice=${distance(point, hu).toFixed(2)}`);
    if (path && path.length) {
      let nearest = Infinity;
      for (let i = 0; i < path.length; i++) {
        nearest = Math.min(nearest, distance(path[i], hu));
        if (i > 0) {
          // 点到线段距离
          const a = path[i - 1], b = path[i];
          const vx = b.x - a.x, vz = b.z - a.z;
          const lengthSq = vx * vx + vz * vz;
          const t2 = lengthSq === 0 ? 0 : Math.max(0, Math.min(1,
            ((hu.x - a.x) * vx + (hu.z - a.z) * vz) / lengthSq));
          nearest = Math.min(nearest, Math.hypot(hu.x - (a.x + t2 * vx),
            hu.z - (a.z + t2 * vz)));
        }
      }
      console.log(`     nearest approach of path to HUMAN = ${nearest.toFixed(2)} ` +
        `(SAFE_WAIT needs > ${C.deepseekAI.dangerRouteRadius}, ` +
        `passage gate treats <= ${C.deepseekAI.stationaryPassageBlockRadius} as blocking)`);
    }
  }
}
