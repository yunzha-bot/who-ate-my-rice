import assert from 'node:assert/strict';
import test from 'node:test';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';
import { GAME_CONFIG, RICE_MAX_PROGRESS_MS, RICE_TIMING_MODE } from '../src/config/gameConfig.ts';

const makeMatch = () => new GameStateSystem(3_000, 350);
const start = (match) => match.advanceReady(3_000);

test('READY transitions to PLAYING and only PLAYING advances match time', () => {
  const match = makeMatch();
  match.advanceReady(2_999);
  assert.equal(match.phase, 'READY');
  assert.equal(match.elapsedMs, 0);
  match.advanceReady(1);
  assert.equal(match.phase, 'PLAYING');
  match.advancePlaying(200, false, false);
  assert.equal(match.elapsedMs, 200);
  assert.equal(match.pause(), true);
  match.advancePlaying(5_000, true, true);
  assert.equal(match.elapsedMs, 200);
  assert.equal(match.captureProgressMs, 0);
  assert.equal(match.resume(), true);
});

test('capture-zone stay shorter than 350 ms does not win and leaving resets capture', () => {
  const match = makeMatch();
  start(match);
  match.advancePlaying(300, true, false);
  assert.equal(match.phase, 'PLAYING');
  assert.equal(match.captureProgressMs, 300);
  match.advancePlaying(1, false, false);
  assert.equal(match.captureProgressMs, 0);
  match.advancePlaying(349, true, false);
  assert.equal(match.phase, 'PLAYING');
  match.advancePlaying(1, true, false);
  assert.equal(match.phase, 'FINISHED');
  assert.deepEqual(match.result, { winner: 'HUMAN', reason: 'CAPTURED', elapsedMs: 651 });
});

test('rice completion wins once, same-frame tie favors rice, FINISHED cannot resume', () => {
  const match = makeMatch();
  start(match);
  match.advancePlaying(350, true, true);
  assert.equal(match.phase, 'FINISHED');
  assert.deepEqual(match.result, { winner: 'DEEPSEEK', reason: 'RICE_COMPLETED', elapsedMs: 350 });
  match.advancePlaying(1_000, true, false);
  assert.equal(match.elapsedMs, 350);
  assert.equal(match.result?.winner, 'DEEPSEEK');
  assert.equal(match.pause(), false);
  assert.equal(match.resume(), false);
});

test('pause freezes capture progress and reset clears all match state for a second round', () => {
  const match = makeMatch();
  start(match);
  match.advancePlaying(200, true, false);
  match.pause();
  match.advancePlaying(1_000, true, false);
  assert.equal(match.captureProgressMs, 200);
  match.resume();
  match.advancePlaying(150, true, false);
  assert.equal(match.phase, 'FINISHED');
  match.reset();
  assert.equal(match.phase, 'READY');
  assert.equal(match.readyRemainingMs, 3_000);
  assert.equal(match.elapsedMs, 0);
  assert.equal(match.captureProgressMs, 0);
  assert.equal(match.result, null);
  start(match);
  match.advancePlaying(1_000, false, true);
  assert.equal(match.result?.winner, 'DEEPSEEK');
});

test('rice progress survives interruption and two rounds can end with different winners', () => {
  const match = makeMatch();
  let rice = new RiceSystem('rice-1', 60_000, 400);
  start(match);
  rice.update(10_400, true);
  rice.interrupt();
  match.advancePlaying(10_400, false, rice.rice.completed);
  assert.equal(rice.rice.progressMs, 10_000);
  rice.update(50_400, true);
  match.advancePlaying(50_400, false, rice.rice.completed);
  assert.equal(rice.rice.progressMs, 60_000);
  assert.equal(match.result?.winner, 'DEEPSEEK');

  match.reset();
  rice = new RiceSystem('rice-1', 60_000, 400);
  start(match);
  match.advancePlaying(350, true, rice.rice.completed);
  assert.equal(match.result?.winner, 'HUMAN');
  assert.equal(rice.rice.progressMs, 0);
  assert.equal(rice.rice.completed, false);
});

test('development rice finishes at 5 seconds while production remains 60 seconds', () => {
  assert.equal(RICE_MAX_PROGRESS_MS.production, 60_000);
  assert.equal(RICE_MAX_PROGRESS_MS.development, 5_000);
  assert.equal(RICE_TIMING_MODE, 'development');
  assert.equal(GAME_CONFIG.rice.maxProgressMs, 5_000);

  const rice = new RiceSystem('rice-1', GAME_CONFIG.rice.maxProgressMs, GAME_CONFIG.rice.prepareMs);
  const match = makeMatch();
  start(match);
  rice.update(2_400, true);
  assert.equal(rice.rice.progressMs, 2_000);
  rice.interrupt();
  rice.update(3_400, true);
  assert.equal(rice.rice.progressMs, 5_000);
  assert.equal(rice.rice.completed, true);
  match.advancePlaying(5_800, false, rice.rice.completed);
  assert.equal(match.result?.winner, 'DEEPSEEK');
});
