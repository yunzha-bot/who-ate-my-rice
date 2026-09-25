import assert from 'node:assert/strict';
import test from 'node:test';
import { DevFreezeSystem } from '../src/systems/DevFreezeSystem.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

const PLAYING = 'PLAYING';

test('dev freeze starts RUNNING with no reason and no event', () => {
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.state, 'RUNNING');
  assert.equal(freeze.isFrozen, false);
  assert.deepEqual(freeze.reasonsList, []);
  assert.equal(freeze.reasonLabel, '无');
  assert.equal(freeze.manualLabel, '冻结双阵营');
  assert.equal(freeze.events.length, 0);
  assert.deepEqual(freeze.eventCounts, { on: 0, off: 0, editorOpen: 0, editorClose: 0 });
});

test('manual freeze is accepted only while the round is PLAYING', () => {
  for (const phase of ['FACTION_SELECT', 'READY', 'PAUSED', 'FINISHED']) {
    const freeze = new DevFreezeSystem();
    assert.equal(freeze.manualFreeze(phase), false, phase);
    assert.equal(freeze.state, 'RUNNING', phase);
    assert.match(freeze.lastRejection, /NOT_PLAYING/);
  }
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.manualFreeze(PLAYING, '对局中 00:12 / 米 2/5'), true);
  assert.equal(freeze.state, 'FROZEN');
  assert.deepEqual(freeze.reasonsList, ['MANUAL_DEV_FREEZE']);
  assert.equal(freeze.manualLabel, '恢复双阵营');
  assert.equal(freeze.frozenFromPhase, PLAYING);
  assert.equal(freeze.frozenFromSummary, '对局中 00:12 / 米 2/5');
  assert.deepEqual(freeze.events.map(event => event.type), ['DEV_FREEZE_ON']);
  assert.equal(freeze.eventCounts.on, 1);
});

test('freeze events never repeat while the frozen frame loop keeps running', () => {
  const freeze = new DevFreezeSystem();
  freeze.manualFreeze(PLAYING);
  for (let frame = 0; frame < 600; frame++) {
    freeze.gameplayDelta(PLAYING, 16.7);
    freeze.manualFreeze(PLAYING);
  }
  assert.equal(freeze.events.length, 1);
  assert.equal(freeze.eventCounts.on, 1);
  assert.match(freeze.lastRejection, /ALREADY_FROZEN/);
});

test('manual resume releases only the manual reason and reports one OFF event', () => {
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.manualResume(PLAYING), false);
  assert.match(freeze.lastRejection, /NOT_FROZEN/);
  freeze.manualFreeze(PLAYING);
  assert.equal(freeze.manualResume('PAUSED'), false);
  assert.equal(freeze.isFrozen, true);
  assert.equal(freeze.manualResume(PLAYING), true);
  assert.equal(freeze.state, 'RUNNING');
  assert.deepEqual(freeze.events.map(event => event.type), ['DEV_FREEZE_ON', 'DEV_FREEZE_OFF']);
  assert.equal(freeze.eventCounts.off, 1);
  assert.equal(freeze.frozenFromPhase, null);
});

test('the scene editor freezes the round and blocks the manual resume button', () => {
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.openSceneEditor('READY'), false);
  assert.equal(freeze.openSceneEditor(PLAYING), true);
  assert.equal(freeze.state, 'FROZEN');
  assert.deepEqual(freeze.reasonsList, ['SCENE_EDITOR']);
  assert.equal(freeze.manualResume(PLAYING), false);
  assert.match(freeze.lastRejection, /SCENE_EDITOR_ACTIVE/);
  assert.equal(freeze.isFrozen, true);
  assert.equal(freeze.isFrozenBy('SCENE_EDITOR'), true);
  assert.equal(freeze.openSceneEditor(PLAYING), false);
  assert.deepEqual(freeze.eventCounts, { on: 1, off: 0, editorOpen: 1, editorClose: 0 });
});

test('closing the scene editor keeps a pre-existing manual freeze', () => {
  const freeze = new DevFreezeSystem();
  freeze.manualFreeze(PLAYING);
  freeze.openSceneEditor(PLAYING);
  assert.deepEqual(freeze.reasonsList, ['MANUAL_DEV_FREEZE', 'SCENE_EDITOR']);
  assert.equal(freeze.closeSceneEditor(), true);
  assert.equal(freeze.state, 'FROZEN');
  assert.deepEqual(freeze.reasonsList, ['MANUAL_DEV_FREEZE']);
  assert.equal(freeze.eventCounts.off, 0);
  assert.equal(freeze.manualResume(PLAYING), true);
  assert.equal(freeze.state, 'RUNNING');
  assert.equal(freeze.eventCounts.off, 1);

  const plain = new DevFreezeSystem();
  plain.openSceneEditor(PLAYING);
  plain.closeSceneEditor();
  assert.equal(plain.state, 'RUNNING');
  assert.deepEqual(plain.events.map(event => event.type),
    ['SCENE_EDITOR_OPEN', 'DEV_FREEZE_ON', 'SCENE_EDITOR_CLOSE', 'DEV_FREEZE_OFF']);
  assert.equal(plain.closeSceneEditor(), false);
  assert.match(plain.lastRejection, /EDITOR_NOT_OPEN/);
});

test('a finished match is never revived by a freeze toggle and a restart clears freeze', () => {
  const freeze = new DevFreezeSystem();
  freeze.manualFreeze(PLAYING);
  assert.equal(freeze.manualResume('FINISHED'), false);
  assert.equal(freeze.state, 'FROZEN');
  assert.equal(freeze.manualFreeze('FINISHED'), false);
  freeze.reset();
  assert.equal(freeze.state, 'RUNNING');
  assert.deepEqual(freeze.reasonsList, []);
  assert.equal(freeze.events.length, 0);
  assert.deepEqual(freeze.eventCounts, { on: 0, off: 0, editorOpen: 0, editorClose: 0 });
  assert.equal(freeze.lastRejection, '无');
});

test('gameplayDelta is the single timing seam: zero while frozen or outside PLAYING', () => {
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.gameplayDelta(PLAYING, 33.3), 33.3);
  assert.equal(freeze.gameplayDelta('PAUSED', 33.3), 0);
  assert.equal(freeze.gameplayDelta('READY', 33.3), 0);
  assert.equal(freeze.gameplayDelta('FINISHED', 33.3), 0);
  freeze.manualFreeze(PLAYING);
  assert.equal(freeze.gameplayDelta(PLAYING, 33.3), 0);
  assert.equal(freeze.gameplayDelta(PLAYING, -5), 0);
});

// Regression (browser acceptance FAIL, 2026-09-25): the pre-round countdown was
// fed by gameplayDelta, which is 0 while the phase is not PLAYING. advanceReady
// therefore received 0 on every READY frame, the round never reached PLAYING,
// both factions stood still and the scene editor kept refusing with NOT_PLAYING.
test('the READY countdown is never gated by the freeze and always reaches PLAYING', () => {
  const freeze = new DevFreezeSystem();
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'FACTION_SELECT');
  assert.equal(match.beginFromFactionSelect(), true);
  assert.equal(match.phase, 'READY');

  for (let frameIndex = 0; frameIndex < 400 && match.phase === 'READY'; frameIndex++) {
    match.advanceReady(freeze.readyDelta(16.7));
  }
  assert.equal(match.phase, PLAYING);
  assert.equal(match.readyRemainingMs, 0);

  // The shipped wiring, kept as the counter-proof: the same loop driven by
  // gameplayDelta never leaves READY, so this test fails if the two deltas are
  // ever mixed up again.
  const stuck = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'FACTION_SELECT');
  stuck.beginFromFactionSelect();
  for (let frameIndex = 0; frameIndex < 400; frameIndex++) {
    stuck.advanceReady(freeze.gameplayDelta(stuck.phase, 16.7));
  }
  assert.equal(stuck.phase, 'READY');
  assert.equal(stuck.readyRemainingMs, GAME_CONFIG.match.readyMs);
});

test('readyDelta keeps the real frame time even while a manual freeze is active', () => {
  const freeze = new DevFreezeSystem();
  assert.equal(freeze.readyDelta(16.7), 16.7);
  freeze.manualFreeze(PLAYING);
  assert.equal(freeze.readyDelta(16.7), 16.7);
  assert.equal(freeze.gameplayDelta(PLAYING, 16.7), 0);
  assert.equal(freeze.readyDelta(-3), 0);
});

// Mirrors the ThreeGame frame gate (`gameplayMs = devFreeze.gameplayDelta(...)`;
// nothing advances while it is zero) against the real gameplay systems, so the
// test proves that the round's timers stop rather than only that a flag flipped.
function createGameplayHarness() {
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs, PLAYING);
  const sprint = new SprintSystem(2_500, 0.3, 1_000, 30_000);
  const rice = new RiceField(['rice_01'], GAME_CONFIG.rice.maxProgressMs, GAME_CONFIG.rice.prepareMs);
  const doors = new DoorSystem(DOOR_NODES, GAME_CONFIG.door.maxActiveLocks);
  const doorSkill = new HumanDoorSkill(doors, GAME_CONFIG.door.humanForceBreakCooldownMs);
  return { match, sprint, rice, doors, doorSkill, freeze: new DevFreezeSystem() };
}

const frame = (game, deltaMs, options = {}) => {
  const gameplayMs = game.freeze.gameplayDelta(game.match.phase, deltaMs);
  if (gameplayMs <= 0) return 0;
  game.sprint.advance(gameplayMs, { x: 1, y: 0 });
  game.rice.update(gameplayMs, 'rice_01', true);
  game.doorSkill.advance(gameplayMs, game.match.phase);
  game.match.advancePlaying(gameplayMs,
    options.captureEligible ?? false, options.riceCompleted ?? game.rice.completed);
  return gameplayMs;
};

test('a frozen round keeps every action timer, capture progress and result untouched', () => {
  const game = createGameplayHarness();
  game.doors.lock('door_living_dining', 'DEEPSEEK');
  assert.equal(game.doorSkill.use('door_living_dining', 'HUMAN', PLAYING), 'FORCE_OPENED');
  game.sprint.tryStart({ x: 1, y: 0 }, 0.5, 'TEST');
  frame(game, 100);
  const before = {
    elapsed: game.match.elapsedMs,
    capture: game.match.captureProgressMs,
    rice: game.rice.get('rice_01').rice.progressMs,
    sprintState: game.sprint.state,
    sprintCooldown: game.sprint.cooldownRemainingMs,
    sprintRemaining: game.sprint.sprintRemainingMs,
    doorSkill: game.doorSkill.cooldownRemainingMs,
    doors: JSON.stringify(game.doors.doors),
    result: game.match.result,
  };
  assert.equal(game.freeze.manualFreeze(PLAYING), true);
  for (let frameIndex = 0; frameIndex < 400; frameIndex++) {
    const advanced = frame(game, 50, { captureEligible: true });
    assert.equal(advanced, 0);
  }
  assert.equal(game.match.elapsedMs, before.elapsed);
  assert.equal(game.match.captureProgressMs, before.capture);
  assert.equal(game.rice.get('rice_01').rice.progressMs, before.rice);
  assert.equal(game.sprint.state, before.sprintState);
  assert.equal(game.sprint.cooldownRemainingMs, before.sprintCooldown);
  assert.equal(game.sprint.sprintRemainingMs, before.sprintRemaining);
  assert.equal(game.doorSkill.cooldownRemainingMs, before.doorSkill);
  assert.equal(JSON.stringify(game.doors.doors), before.doors);
  assert.equal(game.match.result, before.result);
  assert.equal(game.match.phase, PLAYING);
  assert.equal(game.match.captureProgressMs >= GAME_CONFIG.match.captureMs, false);
});

test('resuming after a freeze continues with a single frame and never jumps', () => {
  const game = createGameplayHarness();
  game.sprint.tryStart({ x: 1, y: 0 }, 0.5, 'TEST');
  game.freeze.manualFreeze(PLAYING);
  frame(game, 50);
  const frozenElapsed = game.match.elapsedMs;
  const frozenCooldown = game.sprint.cooldownRemainingMs;
  assert.equal(game.freeze.manualResume(PLAYING), true);
  const advanced = frame(game, 50, { captureEligible: true });
  assert.equal(advanced, 50);
  assert.equal(game.match.elapsedMs, frozenElapsed + 50);
  assert.equal(game.sprint.cooldownRemainingMs, frozenCooldown - 50);
  assert.equal(game.match.captureProgressMs, 50);
});

test('a frozen round cannot produce a new capture or rice result', () => {
  const game = createGameplayHarness();
  game.freeze.manualFreeze(PLAYING);
  for (let frameIndex = 0; frameIndex < 200; frameIndex++) {
    frame(game, 50, { captureEligible: true, riceCompleted: true });
  }
  assert.equal(game.match.result, null);
  assert.equal(game.match.phase, PLAYING);
  game.freeze.manualResume(PLAYING);
  frame(game, 50, { captureEligible: false, riceCompleted: true });
  assert.equal(game.match.result?.winner, 'DEEPSEEK');
  assert.equal(game.match.phase, 'FINISHED');
});
