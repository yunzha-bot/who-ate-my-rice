// S7D 诊断：藏身后无法退出（20260927 HUMAN/idle 与 20300522 HUMAN/pursue）。
// 用法：node --experimental-strip-types docs/verification/S7D/diagnose-hide-lock.mjs
import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

for (const [seed, policy] of [[20260927, 'idle'], [20300522, 'pursue']]) {
  const sim = createMatchSim({ seed, playerFaction: 'HUMAN', policy });
  const ai = sim.systems.deepseekAI;
  const hide = sim.systems.hide;
  const vision = sim.systems.vision;
  console.log(`\n########## seed=${seed} ${policy} ##########`);
  let lastLogged = -1;
  for (let frame = 0; frame < 12000 && sim.systems.match.phase !== 'FINISHED'; frame++) {
    sim.step();
    if (sim.systems.match.phase === 'READY') continue;
    const seconds = Math.floor(sim.systems.match.elapsedMs / 1000);
    const concealed = hide.isConcealed('DEEPSEEK');
    // 藏身后每 30 秒打印一次
    const shouldLog = concealed && (lastLogged < 0 || seconds - lastLogged >= 30);
    if (shouldLog) {
      lastLogged = seconds;
      const dp = sim.positions.deepseek, hu = sim.positions.human;
      const sight = vision.get('DEEPSEEK');
      console.log(`t=${seconds}s CONCEALED spot=${hide.spotId} ` +
        `phase=${ai.hidePhase} concealedMs=${(ai.hideConcealedMs / 1000).toFixed(1)}s ` +
        `exitGate=${ai.hideExitGate} reason=${ai.hideReason}`);
      console.log(`      AI=(${dp.x.toFixed(2)},${dp.z.toFixed(2)}) ` +
        `HUMAN=(${hu.x.toFixed(2)},${hu.z.toFixed(2)}) dist=${distance(dp, hu).toFixed(2)} ` +
        `visibleHuman=${sight.visible} threat=${ai.threatLevel}/${ai.threatSource} ` +
        `hideExitRequests=${ai.hideExitCount}`);
    }
  }
  const dp = sim.positions.deepseek, hu = sim.positions.human;
  console.log(`END: phase=${sim.systems.match.phase} winner=${sim.systems.match.result?.winner} ` +
    `reason=${sim.systems.match.result?.reason} rice=${sim.systems.rice.completedCount}/5 ` +
    `aiState=${ai.state} hidePhase=${ai.hidePhase} exitGate=${ai.hideExitGate} ` +
    `AI=(${dp.x.toFixed(2)},${dp.z.toFixed(2)}) HUMAN=(${hu.x.toFixed(2)},${hu.z.toFixed(2)}) ` +
    `dist=${distance(dp, hu).toFixed(2)} ` +
    `visible=${vision.get('DEEPSEEK').visible}`);
}
