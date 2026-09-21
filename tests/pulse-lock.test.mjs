import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { PulseLockSystem } from '../src/systems/PulseLockSystem.ts';
import { isCaptureEligibleXZ } from '../src/three/CaptureZone.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';

const nodes = DOOR_NODES.slice(0, 4);

function setup() {
  const doors = new DoorSystem(nodes, GAME_CONFIG.door.maxActiveLocks);
  const pulse = new PulseLockSystem(
    doors, GAME_CONFIG.pulseLock.unlockDurationMs, GAME_CONFIG.pulseLock.retentionMs);
  return { doors, pulse };
}

test('only Human can hold-unlock an active locked core and movement is locked', () => {
  const { doors, pulse } = setup();
  const id = nodes[0].id;
  doors.lock(id, 'DEEPSEEK');

  const denied = pulse.advance(1200, 'PLAYING', 'DEEPSEEK', id, true);
  assert.equal(denied.movementLocked, false);
  assert.equal(pulse.get(id).unlockProgressMs, 0);
  assert.equal(pulse.humanExposed, false);

  const active = pulse.advance(1200, 'PLAYING', 'HUMAN', id, true);
  assert.equal(active.movementLocked, true);
  assert.equal(active.completedDoorId, null);
  assert.equal(pulse.get(id).interactionState, 'UNLOCKING');
  assert.equal(pulse.get(id).unlockProgressMs, 1200);
  assert.equal(pulse.humanExposed, true);
  assert.equal(doors.get(id).state, 'LOCKED');
});

test('three seconds disables the core, releases the slot, and leaves the door closed', () => {
  const { doors, pulse } = setup();
  const id = nodes[0].id;
  doors.lock(id, 'DEEPSEEK');
  assert.equal(doors.activeLockedDoorCount, 1);

  const almost = pulse.advance(2999, 'PLAYING', 'HUMAN', id, true);
  assert.equal(almost.completedDoorId, null);
  assert.equal(doors.get(id).state, 'LOCKED');
  const completed = pulse.advance(1, 'PLAYING', 'HUMAN', id, true);
  assert.equal(completed.completedDoorId, id);
  assert.equal(completed.movementLocked, true);
  assert.equal(pulse.humanExposed, false);
  assert.equal(pulse.get(id).interactionState, 'DISABLED');
  assert.equal(pulse.get(id).unlockProgressMs, 3000);
  assert.equal(doors.get(id).lockCoreState, 'DISABLED');
  assert.equal(doors.get(id).state, 'CLOSED');
  assert.equal(doors.get(id).locked, false);
  assert.equal(doors.activeLockedDoorCount, 0);

  assert.equal(doors.toggle(id, 'HUMAN'), 'OPENED');
  assert.equal(doors.get(id).state, 'OPEN');
});

test('retention resumes progress inside five seconds and expires independently', () => {
  const { doors, pulse } = setup();
  const first = nodes[0].id;
  const second = nodes[1].id;
  doors.lock(first, 'DEEPSEEK');
  doors.lock(second, 'DEEPSEEK');

  pulse.advance(1500, 'PLAYING', 'HUMAN', first, true);
  pulse.advance(0, 'PLAYING', 'HUMAN', null, false);
  assert.equal(pulse.get(first).interactionState, 'RETAINED');
  assert.equal(pulse.get(first).retentionRemainingMs, 5000);
  pulse.advance(4000, 'PLAYING', 'HUMAN', null, false);
  assert.equal(pulse.get(first).retentionRemainingMs, 1000);

  pulse.advance(500, 'PLAYING', 'HUMAN', first, true);
  assert.equal(pulse.get(first).unlockProgressMs, 2000);
  assert.equal(pulse.get(first).retentionRemainingMs, 5000);
  pulse.advance(400, 'PLAYING', 'HUMAN', second, true);
  assert.equal(pulse.get(first).unlockProgressMs, 2000);
  assert.equal(pulse.get(first).interactionState, 'RETAINED');
  assert.equal(pulse.get(second).unlockProgressMs, 400);

  pulse.interrupt();
  pulse.advance(5000, 'PLAYING', 'HUMAN', null, false);
  assert.equal(pulse.get(first).unlockProgressMs, 0);
  assert.equal(pulse.get(first).interactionState, 'IDLE');
  assert.equal(pulse.get(second).unlockProgressMs, 0);
  assert.equal(pulse.get(second).interactionState, 'IDLE');
});

test('pause and finished freeze progress and retention while clearing exposure', () => {
  const { doors, pulse } = setup();
  const id = nodes[0].id;
  doors.lock(id, 'DEEPSEEK');
  pulse.advance(1000, 'PLAYING', 'HUMAN', id, true);
  pulse.advance(9000, 'PAUSED', 'HUMAN', id, true);
  const paused = { ...pulse.get(id) };
  assert.equal(paused.unlockProgressMs, 1000);
  assert.equal(paused.retentionRemainingMs, 5000);
  assert.equal(paused.interactionState, 'RETAINED');
  assert.equal(pulse.humanExposed, false);

  pulse.advance(9000, 'PAUSED', 'HUMAN', id, true);
  assert.deepEqual(pulse.get(id), paused);
  pulse.advance(9000, 'FINISHED', 'HUMAN', id, true);
  assert.deepEqual(pulse.get(id), paused);
});

test('disabled core cannot be relocked, consumes no slot, and reset restores it', () => {
  const { doors, pulse } = setup();
  for (const node of nodes.slice(0, 3)) doors.lock(node.id, 'DEEPSEEK');
  const disabledId = nodes[0].id;
  pulse.advance(3000, 'PLAYING', 'HUMAN', disabledId, true);
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.lock(disabledId, 'DEEPSEEK'), 'LOCK_CORE_DISABLED');
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.lock(nodes[3].id, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.activeLockedDoorCount, 3);

  doors.reset();
  pulse.reset();
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.ok(doors.doors.every(door => door.lockCoreState === 'ACTIVE'));
  assert.ok(pulse.entries.every(entry => entry.interactionState === 'IDLE' &&
    entry.unlockProgressMs === 0 && entry.retentionRemainingMs === 0));
});

test('control handoff stops background unlock and retention continues only in PLAYING', () => {
  const { doors, pulse } = setup();
  const id = nodes[0].id;
  doors.lock(id, 'DEEPSEEK');
  pulse.advance(1500, 'PLAYING', 'HUMAN', id, true);
  pulse.interrupt();
  pulse.advance(3000, 'PAUSED', 'DEEPSEEK', null, false);
  assert.equal(pulse.get(id).retentionRemainingMs, 5000);
  pulse.advance(3000, 'PLAYING', 'DEEPSEEK', null, false);
  assert.equal(pulse.get(id).retentionRemainingMs, 2000);
  assert.equal(pulse.get(id).unlockProgressMs, 1500);
  pulse.advance(400, 'PLAYING', 'HUMAN', id, true);
  assert.equal(pulse.get(id).unlockProgressMs, 1900);
});

test('Human capture remains active while PulseLock reports exposure', () => {
  const { doors, pulse } = setup();
  const id = nodes[0].id;
  doors.lock(id, 'DEEPSEEK');
  pulse.advance(100, 'PLAYING', 'HUMAN', id, true);
  assert.equal(pulse.humanExposed, true);

  const match = new GameStateSystem(0, GAME_CONFIG.match.captureMs);
  match.advanceReady(0);
  const human = new Vector3(0, 0, 0);
  const deepseek = new Vector3(0.2, 0, 0.2);
  const eligible = isCaptureEligibleXZ(
    human, deepseek, GAME_CONFIG.match.captureRadius, false);
  match.advancePlaying(GAME_CONFIG.match.captureMs, eligible, false);
  assert.equal(match.result?.winner, 'HUMAN');
});
