import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_CONFIG, RICE_MAX_PROGRESS_MS, RICE_TIMING_MODE } from '../src/config/gameConfig.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { ACTIVE_RICE_COUNT, RICE_CANDIDATES, selectRiceCandidates } from '../src/three/map/apartmentMap.ts';

// Fixed five-portion fixture is independent of the configured active count.
const ids = RICE_CANDIDATES.slice(0, 5).map(point => point.id);
const makeField = () => new RiceField(ids, 5_000, 400);

test('fourteen stable candidates produce exactly five unique active IDs', () => {
  assert.equal(RICE_CANDIDATES.length, 14);
  assert.equal(new Set(RICE_CANDIDATES.map(point => point.id)).size, 14);
  for (let run = 0; run < 50; run++) {
    const active = selectRiceCandidates();
    assert.equal(active.length, ACTIVE_RICE_COUNT);
    assert.equal(new Set(active.map(point => point.id)).size, ACTIVE_RICE_COUNT);
    assert.ok(active.every(point => /^rice_\d{2}$/.test(point.id)));
  }
  assert.throws(() => new RiceField(['rice_01', 'rice_01'], 5_000, 400), /unique/);
});

test('each active rice keeps independent persistent progress through interruption', () => {
  const field = makeField();
  field.update(2_400, ids[0], true);
  assert.equal(field.get(ids[0]).rice.progressMs, 2_000);
  field.update(1_400, ids[1], true);
  assert.equal(field.get(ids[0]).rice.progressMs, 2_000);
  assert.equal(field.get(ids[1]).rice.progressMs, 1_000);
  field.interrupt();
  field.update(400, ids[0], true);
  assert.equal(field.get(ids[0]).rice.progressMs, 2_000);
  field.update(500, ids[0], true);
  assert.equal(field.get(ids[0]).rice.progressMs, 2_500);
  assert.equal(field.get(ids[1]).rice.progressMs, 1_000);
});

test('only completion of all five portions wins and every portion clamps', () => {
  const field = makeField();
  const match = new GameStateSystem(0, 350);
  match.advanceReady(0);
  for (const id of ids.slice(0, 4)) {
    field.update(5_500, id, true);
    match.advancePlaying(5_500, false, field.completed);
    assert.equal(match.phase, 'PLAYING');
  }
  assert.equal(field.completedCount, 4);
  assert.equal(field.completed, false);
  field.update(50_000, ids[4], true);
  assert.equal(field.get(ids[4]).rice.progressMs, 5_000);
  assert.equal(field.completedCount, 5);
  assert.equal(field.completed, true);
  match.advancePlaying(5_500, false, field.completed);
  assert.equal(match.result?.winner, 'DEEPSEEK');
});

test('global progress is the sum of all five portions and reaches risk at exactly 30%', () => {
  const field = makeField();
  field.update(5_400, ids[0], true);
  field.update(2_900, ids[1], true);
  assert.equal(field.totalProgressMs, 7_500);
  assert.equal(field.totalMaxProgressMs, 25_000);
  assert.equal(field.progressRatio, 0.3);
});

test('pause/finished inactivity and human input cannot advance rice', () => {
  const field = makeField();
  field.update(1_400, ids[0], true);
  const before = field.get(ids[0]).rice.progressMs;
  field.interrupt();
  field.update(10_000, ids[0], false);
  assert.equal(field.get(ids[0]).rice.progressMs, before);
  assert.equal(field.progressRatio, before / 25_000);
});

test('a paused preparation remains frozen and resumes without resetting', () => {
  const field = makeField();
  field.update(200, ids[0], true);
  assert.equal(field.get(ids[0]).rice.interactionState, 'PREPARING');
  assert.equal(field.get(ids[0]).rice.progressMs, 0);
  // A paused frame does not call RiceField.update; the pending 200 ms is retained.
  field.update(200, ids[0], true);
  assert.equal(field.get(ids[0]).rice.interactionState, 'EATING');
  assert.equal(field.get(ids[0]).rice.progressMs, 0);
  field.update(100, ids[0], true);
  assert.equal(field.get(ids[0]).rice.progressMs, 100);
});

test('a fresh round resets count, progress, completion and target state', () => {
  const field = makeField();
  field.update(5_400, ids[0], true);
  field.update(1_400, ids[1], true);
  field.reset();
  assert.equal(field.completedCount, 0);
  assert.equal(field.progressRatio, 0);
  assert.equal(field.activeId, null);
  assert.ok(field.states.every(state => state.progressMs === 0 && !state.completed));
});

test('development and production rice durations remain available through one mode switch', () => {
  assert.equal(RICE_MAX_PROGRESS_MS.development, 5_000);
  assert.equal(RICE_MAX_PROGRESS_MS.production, 60_000);
  assert.equal(GAME_CONFIG.rice.maxProgressMs, RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE]);
});
