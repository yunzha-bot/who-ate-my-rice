import assert from 'node:assert/strict';
import test from 'node:test';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';
import { GAME_CONFIG, RICE_MAX_PROGRESS_MS, RICE_TIMING_MODE } from '../src/config/gameConfig.ts';

const right = { x: 1, y: 0 };
const down = { x: 0, y: 1 };
const stopped = { x: 0, y: 0 };
const makeSprint = () => new SprintSystem(2_500, 0.30, 1_000);

test('standing Space does not start a sprint or a delayed fall', () => {
  const sprint = makeSprint();
  assert.equal(sprint.tryStart(stopped, 0.9), false);
  sprint.advance(4_000, stopped);
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.sprintRemainingMs, 0);
  assert.equal(sprint.stunRemainingMs, 0);
});

test('before 30%, sprint runs full duration then safely returns to NORMAL', () => {
  const sprint = makeSprint();
  assert.equal(sprint.tryStart(right, 0.299), true);
  assert.equal(sprint.riskMode, 'SAFE');
  sprint.advance(2_499, stopped);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  sprint.advance(1, stopped);
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.stunRemainingMs, 0);
});

test('at 30%, a full sprint always ends in one second of stun', () => {
  const sprint = makeSprint();
  assert.equal(sprint.tryStart(right, 0.30), true);
  assert.equal(sprint.riskMode, 'FALL_ON_END');
  sprint.advance(2_499, stopped);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  sprint.advance(1, stopped);
  assert.equal(sprint.state, 'STUNNED');
  assert.equal(sprint.stunRemainingMs, 1_000);
  assert.deepEqual(sprint.movementDirection(right), stopped);
  sprint.advance(999, right);
  assert.equal(sprint.state, 'STUNNED');
  sprint.advance(1, right);
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.riskMode, null);
});

test('releasing movement does not cancel sprint or prevent the risk fall', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0.5);
  sprint.advance(2_000, stopped);
  assert.deepEqual(sprint.movementDirection(stopped), right);
  assert.equal(sprint.sprintRemainingMs, 500);
  sprint.advance(500, stopped);
  assert.equal(sprint.state, 'STUNNED');
});

test('direction can change during sprint but cannot become stopped', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0);
  sprint.advance(200, down);
  assert.deepEqual(sprint.movementDirection(stopped), down);
  sprint.advance(200, stopped);
  assert.deepEqual(sprint.movementDirection(stopped), down);
});

test('another Space press cannot restart or refresh a running sprint', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0.5);
  sprint.advance(1_000, right);
  assert.equal(sprint.tryStart(down, 0), false);
  assert.equal(sprint.sprintRemainingMs, 1_500);
  assert.equal(sprint.riskMode, 'FALL_ON_END');
  assert.deepEqual(sprint.movementDirection(stopped), right);
});

test('STUNNED blocks sprint and movement', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 1);
  sprint.advance(2_500, right);
  assert.equal(sprint.tryStart(right, 1), false);
  assert.deepEqual(sprint.movementDirection(right), stopped);
});

test('pause and FINISHED freeze the sprint timer and forced run', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0.5);
  sprint.advance(500, right);
  sprint.advance(10_000, stopped, false);
  assert.equal(sprint.sprintRemainingMs, 2_000);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  sprint.advance(2_000, stopped);
  assert.equal(sprint.state, 'STUNNED');
});

test('pause freezes STUNNED countdown', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0.5);
  sprint.advance(2_500, right);
  sprint.advance(10_000, stopped, false);
  assert.equal(sprint.stunRemainingMs, 1_000);
  sprint.advance(1_000, stopped);
  assert.equal(sprint.state, 'NORMAL');
});

test('reset clears sprint, risk, stun, and last direction for the next round', () => {
  const sprint = makeSprint();
  sprint.tryStart(right, 0.5);
  sprint.advance(2_500, stopped);
  sprint.reset();
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.sprintRemainingMs, 0);
  assert.equal(sprint.stunRemainingMs, 0);
  assert.equal(sprint.riskMode, null);
  assert.deepEqual(sprint.lastDirection, stopped);
});

test('one configured rice reaches the sprint risk threshold at the same progress ratio', () => {
  assert.equal(RICE_MAX_PROGRESS_MS.production, 60_000);
  assert.equal(GAME_CONFIG.rice.maxProgressMs, RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE]);
  const rice = new RiceSystem('rice-1', GAME_CONFIG.rice.maxProgressMs, GAME_CONFIG.rice.prepareMs);
  const thresholdMs = GAME_CONFIG.rice.maxProgressMs * GAME_CONFIG.sprint.riskThreshold;
  rice.update(GAME_CONFIG.rice.prepareMs + thresholdMs - 1, true);
  const safe = makeSprint();
  safe.tryStart(right, rice.rice.progressMs / rice.rice.maxProgressMs);
  assert.equal(safe.riskMode, 'SAFE');
  rice.update(1, true);
  const risky = makeSprint();
  risky.tryStart(right, rice.rice.progressMs / rice.rice.maxProgressMs);
  assert.equal(risky.riskMode, 'FALL_ON_END');
});

test('chase multipliers preserve the 0.35 second capture rule', () => {
  assert.equal(GAME_CONFIG.human.speedMultiplier, 1.08);
  assert.equal(GAME_CONFIG.sprint.speedMultiplier, 1.6);
  assert.equal(GAME_CONFIG.match.captureMs, 350);
});
