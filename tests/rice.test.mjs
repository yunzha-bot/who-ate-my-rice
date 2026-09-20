import assert from 'node:assert/strict';
import test from 'node:test';
import { RiceSystem } from '../src/systems/RiceSystem.ts';

test('preparation does not count as eating and restarts after interruption', () => {
  const system = new RiceSystem('rice-1', 60_000, 400);
  system.update(200, true);
  assert.equal(system.rice.progressMs, 0);
  assert.equal(system.rice.interactionState, 'PREPARING');
  system.update(0, false);
  system.update(200, true);
  assert.equal(system.rice.progressMs, 0);
  system.update(300, true);
  assert.equal(system.rice.progressMs, 100);
});

test('progress survives release, movement, leaving range, and pause interruption', () => {
  const system = new RiceSystem('rice-1', 60_000, 400);
  system.update(10_400, true);
  assert.equal(system.rice.progressMs, 10_000);
  system.update(0, false);
  assert.equal(system.rice.progressMs, 10_000);
  system.update(500, true);
  assert.equal(system.rice.progressMs, 10_100);
  system.interrupt();
  system.update(5_000, false);
  assert.equal(system.rice.progressMs, 10_100);
  system.update(500, true);
  assert.equal(system.rice.progressMs, 10_200);
});

test('completion clamps progress and prevents further eating', () => {
  const system = new RiceSystem('rice-1', 60_000, 400);
  system.update(61_000, true);
  assert.equal(system.rice.progressMs, 60_000);
  assert.equal(system.rice.completed, true);
  assert.equal(system.rice.interactionState, 'COMPLETED');
  system.update(10_000, true);
  assert.equal(system.rice.progressMs, 60_000);
});
