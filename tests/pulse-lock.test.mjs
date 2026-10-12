import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';
import { PulseLockSystem } from '../src/systems/PulseLockSystem.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';

function setup() {
  const doors = new DoorSystem(DOOR_NODES.slice(0, 2), C.door.maxActiveLocks);
  const pulse = new PulseLockSystem(doors, C.pulseLock.timing);
  const id = doors.doors[0].id;
  assert.equal(doors.lock(id, 'DEEPSEEK'), 'LOCKED');
  return { doors, pulse, id };
}

function enterWindow(pulse, index) {
  pulse.advance(C.pulseLock.timing.targetCenters[index] * C.pulseLock.timing.travelMs, 'PLAYING');
}

test('only Human in PLAYING can start the active locked door; E is one timing decision', () => {
  const { doors, pulse, id } = setup();
  assert.equal(pulse.open(id, 'DEEPSEEK', 'PLAYING'), false);
  assert.equal(pulse.open(id, 'HUMAN', 'PAUSED'), false);
  assert.equal(pulse.open(id, 'HUMAN', 'PLAYING'), true);
  assert.equal(pulse.open(id, 'HUMAN', 'PLAYING'), false);
  assert.equal(pulse.movementLocked, true);
  assert.equal(pulse.humanExposed, true);
  assert.equal(doors.get(id).state, 'LOCKED');
  assert.equal(pulse.press('PAUSED'), 'IGNORED');
  assert.equal(pulse.get(id).completed, 0);
});

test('miss restarts only current pulse; previous cores survive Escape and re-entry', () => {
  const { doors, pulse, id } = setup();
  pulse.open(id, 'HUMAN', 'PLAYING');
  enterWindow(pulse, 0);
  assert.equal(pulse.press('PLAYING'), 'CORE_COMPLETE');
  assert.equal(pulse.get(id).completed, 1);
  assert.equal(pulse.press('PLAYING'), 'MISS');
  assert.equal(pulse.get(id).completed, 1);
  assert.equal(pulse.get(id).position, 0);
  pulse.close();
  assert.equal(doors.get(id).state, 'LOCKED');
  assert.equal(pulse.open(id, 'HUMAN', 'PLAYING'), true);
  assert.equal(pulse.get(id).completed, 1);
  enterWindow(pulse, 1);
  assert.equal(pulse.press('PLAYING'), 'CORE_COMPLETE');
});

test('3/3 requests the one authoritative unlock, leaving the door CLOSED and core DISABLED', () => {
  const { doors, pulse, id } = setup();
  pulse.open(id, 'HUMAN', 'PLAYING');
  for (let index = 0; index < pulse.coreCount; index += 1) {
    enterWindow(pulse, index);
    assert.equal(pulse.press('PLAYING'), index === 2 ? 'COMPLETE' : 'CORE_COMPLETE');
  }
  assert.equal(doors.get(id).state, 'LOCKED', 'timing state does not mutate door state');
  assert.equal(doors.disableLock(id, 'HUMAN'), 'UNLOCKED');
  pulse.close();
  assert.equal(doors.get(id).state, 'CLOSED');
  assert.equal(doors.get(id).lockCoreState, 'DISABLED');
  assert.equal(doors.toggle(id, 'HUMAN'), 'OPENED');
  assert.equal(pulse.open(id, 'HUMAN', 'PLAYING'), false);
  assert.equal(doors.lock(id, 'DEEPSEEK'), 'LOCK_CORE_DISABLED');
});

test('world clock and capture continue while player timing panel is open', () => {
  const { pulse, id } = setup();
  const match = new GameStateSystem(C.match.readyMs, C.match.captureMs, 'PLAYING');
  pulse.open(id, 'HUMAN', match.phase);
  match.advancePlaying(150, true, false);
  pulse.advance(150, match.phase);
  assert.equal(match.elapsedMs, 150);
  assert.equal(match.captureProgressMs, 150);
  assert.ok(pulse.get(id).position > 0);
  match.pause();
  pulse.advance(500, match.phase);
  assert.equal(pulse.get(id).position, 150 / C.pulseLock.timing.travelMs);
});

test('external force break closes timing state; normal door and Human AI unlock stay independent', () => {
  const { doors, pulse, id } = setup();
  pulse.open(id, 'HUMAN', 'PLAYING');
  assert.equal(doors.forceOpen(id, 'HUMAN'), 'FORCE_OPENED');
  pulse.advance(16, 'PLAYING');
  assert.equal(pulse.isOpen, false);
  const other = doors.doors[1].id;
  assert.equal(doors.toggle(other, 'HUMAN'), 'OPENED');
  assert.equal(doors.toggle(other, 'HUMAN'), 'CLOSED');
  const skill = new HumanDoorSkill(doors, C.door.humanForceBreakCooldownMs);
  assert.equal(doors.lock(other, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.disableLock(other, 'HUMAN'), 'UNLOCKED');
  assert.equal(skill.cooldownRemainingMs, 0);
  pulse.reset();
  assert.equal(pulse.get(id).completed, 0);
});
