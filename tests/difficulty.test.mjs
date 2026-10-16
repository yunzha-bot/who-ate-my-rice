import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG as C, RICE_TIMING_MODE, RICE_MAX_PROGRESS_MS } from '../src/config/gameConfig.ts';
import { DIFFICULTIES, resolveAiDifficulty, readDifficulty, saveDifficulty,
  DIFFICULTY_STORAGE_KEY, DIFFICULTY_COPY } from '../src/config/difficultyConfig.ts';
import { RuntimeDebugOverrides } from '../src/systems/RuntimeDebugOverrides.ts';
import { HumanAIController, humanAiMovementSpeed } from '../src/systems/HumanAIController.ts';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { createMatchSim } from './s7d-match-sim.mjs';
import { RICE_CANDIDATES, roomAt } from '../src/three/map/apartmentMap.ts';

const humanKeys = ['movementSpeedMultiplier', 'aiUnlockDurationMs', 'aiUnlockSuccessChance',
  'searchMaxMs', 'searchRoomCount', 'hideCheckMaxPerRound'];
const deepseekKeys = ['visionEvadeDistance', 'soundEvadeStrength', 'escapeMinSeparation',
  'escapeReplanMs', 'hideThreatDistance'];
const expectedHuman = [[.52, 8750, .7, 15000, 3, 1], [.64, 7500, .8, 18000, 4, 2],
  [.76, 6500, .9, 22000, 5, 3]];
const expectedDeepseek = [[5, .09, 3, 700, 3.5], [6, .075, 3.5, 600, 4], [7, .06, 4, 500, 4.5]];
const rooms = [{ id: 'a', x: 0, z: 0, minX: -2, maxX: 2, minZ: -2, maxZ: 2, major: true },
  { id: 'b', x: 8, z: 0, minX: 5, maxX: 11, minZ: -2, maxZ: 2, major: true },
  { id: 'c', x: -8, z: 0, minX: -11, maxX: -5, minZ: -2, maxZ: 2, major: true }];
const nav = { nearestFree: p => p, findPath: (a, b) => [
  { ...a, doorId: null }, { ...b, doorId: null }] };

test('pause difficulty text shows only the selected label for both factions, even with DEV overrides', () => {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  const assignment = source.match(/this\.difficultyStatus\.textContent = ([\s\S]*?);/);
  assert.ok(assignment, 'test the real pause display expression');
  const render = new Function('DIFFICULTY_COPY', `return ${assignment[1]};`);
  for (const difficulty of DIFFICULTIES) for (const selectedFaction of ['DEEPSEEK', 'HUMAN']) {
    for (const overrideCount of [0, 2]) {
      const context = { difficulty, control: { selectedFaction },
        runtime: { humanAIMovementMultiplier: .3, overrideCount } };
      assert.equal(render.call(context, DIFFICULTY_COPY), `当前难度：${DIFFICULTY_COPY[difficulty].label}`);
    }
  }
});

test('six profiles change ONLY the approved opponent AI fields, never base/player rules', () => {
  const before = JSON.stringify(C);
  DIFFICULTIES.forEach((difficulty, i) => {
    const dp = resolveAiDifficulty(difficulty, 'DEEPSEEK');
    const human = resolveAiDifficulty(difficulty, 'HUMAN');
    assert.deepEqual(humanKeys.map(k => dp.humanAI[k]), expectedHuman[i]);
    assert.deepEqual(deepseekKeys.map(k => human.deepseekAI[k]), expectedDeepseek[i]);
    assert.deepEqual(dp.deepseekAI, C.deepseekAI);
    assert.deepEqual(human.humanAI, C.humanAI);
    for (const k of Object.keys(C.humanAI).filter(k => !humanKeys.includes(k)))
      assert.equal(dp.humanAI[k], C.humanAI[k]);
    for (const k of Object.keys(C.deepseekAI).filter(k => !deepseekKeys.includes(k)))
      assert.equal(human.deepseekAI[k], C.deepseekAI[k]);
    assert.ok(human.deepseekAI.hideThreatDistance < human.deepseekAI.visionEvadeDistance);
    assert.ok(Object.isFrozen(dp) && Object.isFrozen(dp.humanAI));
  });
  assert.equal(JSON.stringify(C), before);
});

test('preference defaults to EASY; corrupt/unavailable storage never blocks a new game', () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
  assert.equal(readDifficulty(storage), 'EASY');
  saveDifficulty(storage, 'HARD');
  assert.equal(readDifficulty(storage), 'HARD');
  for (const bad of ['{"value":"HARD"}', 'UNKNOWN', '', 'null']) {
    data.set(DIFFICULTY_STORAGE_KEY, bad);
    assert.equal(readDifficulty(storage), 'EASY');
  }
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(readDifficulty(blocked), 'EASY');
  assert.doesNotThrow(() => saveDifficulty(blocked, 'NORMAL'));
});

test('round baseline is actual AI speed; explicit DEV override is visible and resettable', () => {
  const runtime = new RuntimeDebugOverrides();
  for (const [i, difficulty] of DIFFICULTIES.entries()) {
    const cfg = resolveAiDifficulty(difficulty, 'DEEPSEEK').humanAI;
    runtime.clearAll();
    runtime.setBaseValue('movement.humanAiMultiplier', cfg.movementSpeedMultiplier);
    assert.equal(runtime.overrideCount, 0);
    assert.equal(runtime.humanAIMovementMultiplier, expectedHuman[i][0]);
    assert.equal(humanAiMovementSpeed(4, runtime.humanAIMovementMultiplier), 4 * expectedHuman[i][0]);
    runtime.set('movement.humanAiMultiplier', .3);
    assert.equal(runtime.overrideCount, 1);
    assert.equal(runtime.humanAIMovementMultiplier, .3);
    runtime.clearAll();
    assert.equal(runtime.humanAIMovementMultiplier, cfg.movementSpeedMultiplier);
  }
  assert.equal(C.humanAI.movementSpeedMultiplier, .52);
});

for (const [i, difficulty] of DIFFICULTIES.entries()) {
  test(`${difficulty}: real Human unlock duration/probability and furniture search quota`, () => {
    const node = { id: 'd', x: .6, z: 0, width: 1.2, rotation: Math.PI / 2,
      connectedRoomA: 'a', connectedRoomB: 'b' };
    const lockedNav = { ...nav, findPath: (a, b, doors, avoid, cost = null, blocked) =>
      cost === null || blocked?.has('d') ? null : [{ ...a, doorId: null },
        { x: .6, z: 0, doorId: 'd' }, { ...b, doorId: null }] };
    const cfg = resolveAiDifficulty(difficulty, 'DEEPSEEK').humanAI;
    const input = deltaMs => ({ deltaMs, human: { x: 0, z: 0 }, visibleTarget: null,
      lastSeen: null, heard: null, captureEligible: false, forceBreakCooldownMs: 30000,
      doors: [{ id: 'd', state: 'LOCKED', lockCoreState: 'ACTIVE' }], canOpenDoor: () => true });
    for (const [draw, succeeds] of [[cfg.aiUnlockSuccessChance - .001, true],
      [cfg.aiUnlockSuccessChance + .001, false]]) {
      const ai = new HumanAIController(lockedNav, rooms.slice(0, 2), [node], () => draw);
      ai.setDifficultyConfig(cfg);
      assert.equal(ai.checkHideRoundBudget, expectedHuman[i][5]);
      assert.equal(ai.update(input(cfg.aiUnlockDurationMs - 1)).unlockDoorId, null);
      assert.equal(ai.unlockProgressMs, cfg.aiUnlockDurationMs - 1);
      assert.equal(ai.update(input(1)).unlockDoorId, succeeds ? 'd' : null);
      assert.equal(ai.lastNavigationReason, succeeds ? 'AI_UNLOCK_SUCCEEDED' : 'AI_UNLOCK_FAILED_1');
    }
  });

  test(`${difficulty}: DeepSeek threat response uses only supplied sight/sound at selected thresholds`, () => {
    const cfg = resolveAiDifficulty(difficulty, 'HUMAN').deepseekAI;
    const input = { deltaMs: 50, deepseek: { x: 0, z: 0 },
      rice: [{ id: 'r', x: 0, z: 0, maxProgressMs: C.rice.maxProgressMs, progressMs: 0, completed: false }],
      doors: [], canOpenDoor: () => true, perceptionNowMs: 1000,
      riceProgressRatio: 0, sprintState: 'NORMAL' };
    const make = () => { const ai = new DeepSeekAIController(nav, [], rooms); ai.setDifficultyConfig(cfg); return ai; };
    const unseen = make();
    assert.equal(unseen.update(input).eatRiceId, 'r');
    assert.equal(unseen.state, 'EAT');
    const visible = make();
    visible.update({ ...input, visibleHuman: { x: cfg.visionEvadeDistance - .01, z: 0 } });
    assert.equal(visible.state, 'EVADE');
    const outside = make();
    outside.update({ ...input, visibleHuman: { x: cfg.visionEvadeDistance + .01, z: 0 } });
    assert.notEqual(outside.state, 'EVADE');
    const audible = make();
    audible.update({ ...input, heardHuman: { event: { sourceFaction: 'HUMAN',
      type: 'FOOTSTEP', position: { x: 2, z: 0 } },
      audibleStrength: cfg.soundEvadeStrength + .001, remainingMs: 500 } });
    assert.equal(audible.state, 'EVADE');
    const weak = make();
    weak.update({ ...input, heardHuman: { event: { sourceFaction: 'HUMAN',
      type: 'FOOTSTEP', position: { x: 2, z: 0 } },
      audibleStrength: cfg.soundEvadeStrength - .001, remainingMs: 500 } });
    assert.notEqual(weak.state, 'EVADE');
    for (const [distance, reason] of [[cfg.hideThreatDistance + .01, 'THREAT_TOO_FAR'],
      [cfg.hideThreatDistance - .01, 'NO_PUBLIC_HIDE_DATA']]) {
      const ai = make();
      ai.update({ ...input, visibleHuman: { x: distance, z: 0 } });
      assert.equal(ai.hideBlockedReason, reason);
      assert.equal(ai.escapeReplanRemainingMs, cfg.escapeReplanMs);
      ai.update({ ...input, deltaMs: 1, visibleHuman: { x: distance, z: 0 } });
      assert.equal(ai.escapeReplanRemainingMs, cfg.escapeReplanMs - 1);
    }
  });

  test(`${difficulty}: actual last-seen search visits the selected room quota and expires at its own budget`, () => {
    const cfg = resolveAiDifficulty(difficulty, 'DEEPSEEK').humanAI;
    const searchRooms = Array.from({length:7}, (_, n) => ({id:`room${n}`,x:n*1.5,z:0,
      minX:n*1.5-.5,maxX:n*1.5+.5,minZ:-.5,maxZ:.5,major:true}));
    const ai = new HumanAIController(nav, searchRooms, []);
    ai.setDifficultyConfig(cfg);
    const lastSeen = {position:{x:0,z:0},timeMs:80};
    const input = {deltaMs:50,human:{x:0,z:0},visibleTarget:null,lastSeen,
      heard:null,captureEligible:false,doors:[],canOpenDoor:()=>true};
    ai.update({...input,visibleTarget:lastSeen.position});
    ai.update(input);
    ai.update({...input,deltaMs:C.humanAI.investigationDwellMs});
    assert.equal(ai.state,'SEARCH');
    assert.equal(ai.searchTargets.length,cfg.searchRoomCount);
    ai.update({...input,deltaMs:cfg.searchMaxMs-1});
    assert.equal(ai.state,'SEARCH');
    ai.update({...input,deltaMs:1});
    assert.equal(ai.state,'PATROL');
  });
}

for (const faction of ['DEEPSEEK', 'HUMAN']) for (const difficulty of DIFFICULTIES) {
  test(`${faction}/${difficulty}: 30 seconds progress, 400ms prep, interruption/resume and 5/5 victory`, () => {
    assert.equal(RICE_TIMING_MODE, 'production');
    assert.equal(C.rice.maxProgressMs, 30000);
    assert.equal(RICE_MAX_PROGRESS_MS.development, 5000);
    assert.equal(C.rice.prepareMs, 400);
    const field = new RiceField(['a', 'b', 'c', 'd', 'e'], C.rice.maxProgressMs, C.rice.prepareMs);
    const match = new GameStateSystem(0, C.match.captureMs);
    match.advanceReady(0);
    for (const id of field.states.map(s => s.id)) {
      field.update(399, id, true);
      assert.equal(field.get(id).rice.progressMs, 0);
      field.update(1, id, true);
      field.update(5000, id, true);
      assert.equal(field.get(id).rice.completed, false);
      assert.equal(field.get(id).progressRatio, 1 / 6);
      field.interrupt();
      field.update(20000, id, false);
      assert.equal(field.get(id).rice.progressMs, 5000);
      field.update(400, id, true);
      assert.equal(field.get(id).rice.progressMs, 5000);
      field.update(24999, id, true);
      assert.equal(field.get(id).rice.completed, false);
      match.advancePlaying(1, false, field.completed);
      assert.equal(match.phase, 'PLAYING');
      field.update(1, id, true);
      assert.equal(field.get(id).progressRatio, 1);
      match.advancePlaying(1, false, field.completed);
    }
    assert.equal(field.totalProgressMs, 150000);
    assert.equal(match.phase, 'FINISHED');
    assert.equal(match.result.reason, 'RICE_COMPLETED');
  });
}

test('paired fixed seed: six real-system matches use production timing and finish without penetration', () => {
  const rows = [];
  for (const faction of ['DEEPSEEK', 'HUMAN']) for (const difficulty of DIFFICULTIES) {
    const sim = createMatchSim({ seed: 20268846, playerFaction: faction, policy: 'idle', difficulty });
    assert.ok(sim.systems.rice.states.every(r => r.maxProgressMs === 30000));
    const result = sim.run(12000);
    assert.equal(result.timedOut, false, `${faction}/${difficulty}: ${result.elapsedMs}`);
    assert.equal(result.phase, 'FINISHED');
    assert.equal(result.winner, faction === 'HUMAN' ? 'DEEPSEEK' : 'HUMAN');
    assert.equal(result.telemetry.humanStuckFrames, 0);
    assert.equal(result.telemetry.deepseekStuckFrames, 0);
    if (faction === 'HUMAN') { assert.equal(result.riceCompleted, 5); assert.ok(result.elapsedMs >= 152000); }
    rows.push({ faction, difficulty, elapsedMs: result.elapsedMs, winner: result.winner,
      telemetry: result.telemetry, setup: result.setup });
  }
  assert.deepEqual(rows[0].setup, rows[1].setup);
  assert.deepEqual(rows[1].setup, rows[2].setup);
  console.log('paired production matches', rows.map(({ faction, difficulty, elapsedMs, winner }) =>
    ({ faction, difficulty, elapsedMs, winner })));
});

test('bathroom two-door reproduction: all three difficulties can finish every rice under fixed-seed pursuit', () => {
  for (const difficulty of DIFFICULTIES) {
    const sim = createMatchSim({seed:20260927,playerFaction:'HUMAN',policy:'pursue',difficulty});
    const result = sim.run(12000);
    assert.equal(result.timedOut,false,`${difficulty}: ${sim.systems.deepseekAI.lastSelectionReason}`);
    assert.equal(result.winner,'DEEPSEEK');
    assert.equal(result.riceCompleted,5);
    assert.equal(result.reason,'RICE_COMPLETED');
  }
});

test('real apartment lock invariant under pursuit then legal retreat: every unfinished rice stays reachable and the match finishes', () => {
  const points = new Map(RICE_CANDIDATES.map(r => [r.id,r]));
  let checked = 0;
  const lockRooms = new Set();
  for (const difficulty of DIFFICULTIES) for (const seed of [20260927,20276765,20284684]) {
    const sim = createMatchSim({seed,playerFaction:'HUMAN',policy:'pursue',difficulty});
    // A pursuer camping beside the remaining rice can legitimately keep the
    // opponent evading: this game has no match time limit. Pressure for 180s,
    // then walk the scripted Human away using the same navigation/collision.
    // Keep the original 12000-frame budget and every lock-reachability assertion.
    const retreat = sim.systems.navigation.nearestFree({x:22,z:12}, sim.systems.doorSystem.doors);
    assert.ok(retreat, 'retreat fixture needs a legal navigation cell');
    assert.ok(sim.systems.collision.canOccupyStaticXZ(retreat.x,retreat.z,
      C.collision.playerRadius,C.three.actorHeight));
    const follow = sim.view.follow.bind(sim.view);
    sim.view.follow = (target,repathMs) => follow(
      sim.systems.match.elapsedMs >= 180000 ? retreat : target,repathMs);
    let previous = new Set();
    while (sim.systems.match.phase !== 'FINISHED' && sim.frame() < 12000) {
      sim.step();
      const {doorSystem,navigation,rice} = sim.systems;
      const locked = new Set(doorSystem.doors.filter(d => d.state === 'LOCKED').map(d => d.id));
      if ([...locked].some(id => !previous.has(id))) {
        checked++;
        lockRooms.add(roomAt(sim.positions.deepseek.x,sim.positions.deepseek.z)?.id);
        for (const r of rice.states.filter(r => !r.completed)) {
          const route = navigation.findPath(sim.positions.deepseek,points.get(r.id),doorSystem.doors);
          assert.ok(route?.length,`${difficulty}/${seed}: locked ${[...locked]} seals ${r.id}`);
        }
      }
      previous = locked;
    }
    assert.equal(sim.systems.match.phase,'FINISHED',`${difficulty}/${seed}: ${sim.systems.deepseekAI.state}`);
    if (sim.systems.match.result.winner === 'DEEPSEEK') {
      assert.equal(sim.systems.rice.completedCount,5,`${difficulty}/${seed}: every portion must finish`);
      assert.equal(sim.systems.match.result.reason,'RICE_COMPLETED');
    }
  }
  assert.ok(checked>0,'合理自动锁门仍须真实发生，不得禁用来满足不变量');
  console.log('real lock invariant', {checked,rooms:[...lockRooms]});
});

test('HARD Human uses existing collision/navigation through doors and furniture across fixed seeds', () => {
  for (const seed of [20260927, 20260411, 20276765, 20284684]) {
    const sim = createMatchSim({seed,playerFaction:'DEEPSEEK',policy:'idle',difficulty:'HARD'});
    const result = sim.run(12000);
    assert.equal(result.timedOut,false,`seed ${seed}: ${result.elapsedMs}`);
    assert.equal(result.telemetry.humanStuckFrames,0,`seed ${seed}`);
    assert.ok(result.telemetry.doorOpened>0);
    console.log('HARD collision route',seed,result.elapsedMs,result.telemetry.doorOpened);
  }
});
