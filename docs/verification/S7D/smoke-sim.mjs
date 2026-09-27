import { createMatchSim } from '../../../tests/s7d-match-sim.mjs';

const results = [];
for (const [playerFaction, policy] of [['HUMAN', 'idle'], ['DEEPSEEK', 'idle']]) {
  for (const seed of [20260927, 7]) {
    const started = Date.now();
    const sim = createMatchSim({ seed, playerFaction, policy });
    const result = sim.run(8000);
    results.push({ playerFaction, policy, seed, wallMs: Date.now() - started,
      frames: result.frames, phase: result.phase, timedOut: result.timedOut,
      winner: result.winner, reason: result.reason,
      elapsedMs: result.elapsedMs, riceCompleted: result.riceCompleted,
      setup: `${result.setup.deepseek.roomId}->${result.setup.human.roomId} open=${result.setup.doorOpenCount} attempt=${result.setup.attempts}`,
      telemetry: result.telemetry, loop: result.loop });
  }
}
for (const row of results) {
  console.log(`[${row.playerFaction}/${row.policy} seed=${row.seed}] wall=${row.wallMs}ms ` +
    `frames=${row.frames} phase=${row.phase}${row.timedOut ? '(TIMEOUT)' : ''} ` +
    `${row.winner ?? '-'}/${row.reason ?? '-'} elapsed=${row.elapsedMs}ms ` +
    `rice=${row.riceCompleted}/5 setup=${row.setup}`);
  console.log(`    telemetry=${JSON.stringify(row.telemetry)}`);
  console.log(`    loop=${JSON.stringify(row.loop)}`);
}
