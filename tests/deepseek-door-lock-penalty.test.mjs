import assert from 'node:assert/strict';
import test from 'node:test';
import { DeepSeekDoorLockPenalty } from '../src/systems/DeepSeekDoorLockPenalty.ts';

test('Human player adds 10 seconds to the global penalty after unlocking an AI-locked door', () => {
  const penalty = new DeepSeekDoorLockPenalty(10_000);
  penalty.onDeepSeekLockResult('door_a', 'LOCKED');

  assert.equal(penalty.onHumanPlayerUnlock('door_a', 'UNLOCKED'), true);
  assert.equal(penalty.remainingMs, 10_000);
  assert.equal(penalty.ready, false, 'the penalty applies across different doors');

  penalty.advance(9_999);
  assert.equal(penalty.ready, false);
  penalty.advance(1);
  assert.equal(penalty.ready, true);
});

test('only a successful Human player break of a DeepSeek AI-locked door arms the penalty', () => {
  const penalty = new DeepSeekDoorLockPenalty(10_000);

  penalty.onDeepSeekLockResult('failed_lock', 'OUT_OF_RANGE');
  assert.equal(penalty.onHumanPlayerUnlock('failed_lock', 'FORCE_OPENED'), false);
  assert.equal(penalty.onHumanPlayerUnlock('manual_lock', 'UNLOCKED'), false,
    'player-created locks are not marked as AI locks');
  assert.equal(penalty.remainingMs, 0);

  penalty.onDeepSeekLockResult('door_a', 'LOCKED');
  assert.equal(penalty.onHumanPlayerUnlock('door_a', 'INVALID_STATE'), false);
  assert.equal(penalty.onHumanPlayerUnlock('door_a', 'FORCE_OPENED'), true);
  assert.equal(penalty.remainingMs, 10_000);
  assert.equal(penalty.onHumanPlayerUnlock('door_a', 'UNLOCKED'), false,
    'a door can trigger the penalty only once');
});

test('each unlocked AI lock adds 10 seconds to the remaining global cooldown', () => {
  const penalty = new DeepSeekDoorLockPenalty(10_000);
  for (const id of ['door_a', 'door_b', 'door_c'])
    penalty.onDeepSeekLockResult(id, 'LOCKED');

  penalty.onHumanPlayerUnlock('door_a', 'UNLOCKED');
  penalty.advance(5_000);
  assert.equal(penalty.remainingMs, 5_000);

  penalty.onHumanPlayerUnlock('door_b', 'FORCE_OPENED');
  assert.equal(penalty.remainingMs, 15_000);
  penalty.onHumanPlayerUnlock('door_c', 'UNLOCKED');
  assert.equal(penalty.remainingMs, 25_000,
    '15 seconds remaining plus another 10-second penalty becomes 25 seconds');
});

test('penalty reset clears both the timer and AI lock attribution', () => {
  const penalty = new DeepSeekDoorLockPenalty(10_000);
  penalty.onDeepSeekLockResult('door_a', 'LOCKED');
  penalty.onHumanPlayerUnlock('door_a', 'UNLOCKED');
  penalty.reset();

  assert.equal(penalty.ready, true);
  assert.equal(penalty.remainingMs, 0);
  assert.equal(penalty.onHumanPlayerUnlock('door_a', 'UNLOCKED'), false);
});
