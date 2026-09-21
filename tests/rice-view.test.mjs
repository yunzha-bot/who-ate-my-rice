import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';
import { RiceView, riceVisualMetrics } from '../src/three/RiceView.ts';

const visual = GAME_CONFIG.rice.visual;

test('rice visual continuously loses height instead of scaling equally on every axis', () => {
  const samples = [0, 1_250, 2_500, 3_750, 5_000]
    .map(progress => riceVisualMetrics(progress, 5_000, visual));
  for (let index = 1; index < samples.length; index++) {
    assert.ok(samples[index].bodyHeight < samples[index - 1].bodyHeight);
    assert.ok(samples[index].bulgeHeight <= samples[index - 1].bulgeHeight);
  }
  assert.deepEqual(samples.map(sample => sample.stage), [0, 1, 2, 3, 4]);
  const heightLoss = samples[0].bodyHeight - samples[4].bodyHeight;
  const widthLoss = samples[0].widthScale - samples[4].widthScale;
  assert.ok(heightLoss > widthLoss * 5, 'height should collapse far more than width');
});

test('completed rice remains a visible non-zero empty bag with no bulge', () => {
  const complete = riceVisualMetrics(10_000, 5_000, visual);
  assert.equal(complete.progressRatio, 1);
  assert.equal(complete.stage, 4);
  assert.equal(complete.bodyHeight, visual.emptyHeight);
  assert.ok(complete.bodyHeight > 0);
  assert.equal(complete.bulgeHeight, 0);
});

test('view deformation keeps its world interaction anchor and bottom on the ground', () => {
  const rice = new RiceSystem('rice_03', 5_000, 400);
  const view = new RiceView(0.5, GAME_CONFIG.rice.color, visual);
  view.position.set(4, 0, -3);
  const anchor = view.position.clone();
  const full = view.sync(rice.rice);
  rice.update(2_900, true);
  const half = view.sync(rice.rice);
  const body = view.object.children[0];
  assert.deepEqual(view.position.toArray(), anchor.toArray());
  assert.ok(half.bodyHeight < full.bodyHeight);
  assert.ok(Math.abs(body.position.y - body.scale.y / 2) < 1e-9);
  view.dispose();
});

test('each rice view follows only its own persistent state and reset restores fullness', () => {
  const a = new RiceSystem('rice_03', 5_000, 400);
  const b = new RiceSystem('rice_08', 5_000, 400);
  const viewA = new RiceView(0.5, GAME_CONFIG.rice.color, visual);
  const viewB = new RiceView(0.5, GAME_CONFIG.rice.color, visual);
  a.update(3_400, true);
  const aPartial = viewA.sync(a.rice);
  const bFull = viewB.sync(b.rice);
  assert.ok(aPartial.bodyHeight < bFull.bodyHeight);
  const pausedHeight = viewA.sync(a.rice).bodyHeight;
  assert.equal(viewA.sync(a.rice).bodyHeight, pausedHeight);
  a.reset();
  const aReset = viewA.sync(a.rice);
  assert.equal(aReset.bodyHeight, bFull.bodyHeight);
  viewA.dispose();
  viewB.dispose();
});
