import assert from 'node:assert/strict';
import test from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { cameraRelativeDirection, positionCameraOnTarget } from '../src/three/CameraRelativeMovement.ts';
import { LocalControl } from '../src/three/LocalControl.ts';
import { InputManager } from '../src/three/InputManager.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { resolveDirectControlSwitch, resolveRoundShortcut } from '../src/three/RoundShortcuts.ts';
import { DOOR_NODES, selectRiceCandidates } from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

const camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
camera.position.set(12, 14, 12);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();

function projectedDirection(direction) {
  const point = new Vector3(direction.x, 0, direction.y).project(camera);
  const origin = new Vector3(0, 0, 0).project(camera);
  return { x: point.x - origin.x, y: point.y - origin.y };
}

test('W/S/A/D move in the corresponding visible screen directions', () => {
  const w = cameraRelativeDirection(camera, { x: 0, y: -1 });
  const s = cameraRelativeDirection(camera, { x: 0, y: 1 });
  const a = cameraRelativeDirection(camera, { x: -1, y: 0 });
  const d = cameraRelativeDirection(camera, { x: 1, y: 0 });
  assert.ok(projectedDirection(w).y > 0);
  assert.ok(projectedDirection(s).y < 0);
  assert.ok(projectedDirection(a).x < 0);
  assert.ok(projectedDirection(d).x > 0);
  assert.ok(Math.abs(projectedDirection(w).x) < 1e-10);
  assert.ok(Math.abs(projectedDirection(d).y) < 1e-10);
  assert.ok(Math.abs(w.x + s.x) < 1e-10 && Math.abs(w.y + s.y) < 1e-10);
});

test('all four diagonal inputs keep unit speed and their screen quadrants', () => {
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      const diagonal = cameraRelativeDirection(camera, { x, y });
      const projected = projectedDirection(diagonal);
      assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-10);
      assert.ok(projected.x * x > 0 && projected.y * y < 0);
    }
  }
});

test('following a moving target keeps it centered without changing camera angle', () => {
  const following = new OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  const offset = new Vector3(12, 14, 12);
  const first = new Vector3(0, 0.35, 0);
  positionCameraOnTarget(following, first, offset);
  following.updateMatrixWorld();
  const facing = following.getWorldDirection(new Vector3());
  const second = new Vector3(3, 0.35, -2);
  positionCameraOnTarget(following, second, offset);
  following.updateMatrixWorld();
  const center = second.clone().project(following);
  assert.ok(Math.abs(center.x) < 1e-10 && Math.abs(center.y) < 1e-10);
  assert.ok(facing.distanceTo(following.getWorldDirection(new Vector3())) < 1e-10);
});

test('local controls follow the selected faction while IJKL controls the other one', () => {
  const controls = new LocalControl();
  const local = { x: 1, y: 0 };
  const debug = { x: 0, y: -1 };
  controls.choose('DEEPSEEK');
  assert.deepEqual(controls.directions(local, debug), { deepseek: local, human: debug });
  assert.equal(controls.controlled('blue', 'orange'), 'blue');
  controls.choose('HUMAN');
  assert.deepEqual(controls.directions(local, debug), { deepseek: debug, human: local });
  assert.equal(controls.controlled('blue', 'orange'), 'orange');
});

test('Tab-style control switching changes only controlled faction and keeps IJKL on the other role', () => {
  const controls = new LocalControl();
  const local = { x: 1, y: 0 };
  const debug = { x: 0, y: -1 };
  controls.choose('DEEPSEEK');
  assert.equal(controls.selectedFaction, 'DEEPSEEK');
  assert.equal(controls.controlledFaction, 'DEEPSEEK');
  assert.equal(controls.toggleControlled(), true);
  assert.equal(controls.selectedFaction, 'DEEPSEEK');
  assert.equal(controls.controlledFaction, 'HUMAN');
  assert.deepEqual(controls.directions(local, debug), { deepseek: debug, human: local });
  assert.equal(controls.toggleControlled(), true);
  assert.equal(controls.controlledFaction, 'DEEPSEEK');
  assert.deepEqual(controls.directions(local, debug), { deepseek: local, human: debug });
});

test('Tab key uses a press edge and prevents browser focus only while gameplay capture is enabled', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const input = new InputManager();
    let prevented = 0;
    const event = (repeat = false) => ({ code: 'Tab', repeat,
      preventDefault: () => { prevented += 1; } });
    input.setTabCaptureEnabled(false);
    input.onKeyDown(event());
    assert.equal(prevented, 0);
    assert.equal(input.consumePress('Tab'), true);
    input.onKeyUp({ code: 'Tab' });

    input.setTabCaptureEnabled(true);
    input.onKeyDown(event());
    assert.equal(prevented, 1);
    assert.equal(input.consumePress('Tab'), true);
    input.onKeyDown(event(true));
    assert.equal(input.consumePress('Tab'), false);
    input.onKeyUp({ code: 'Tab' });
    input.onKeyDown(event());
    assert.equal(input.consumePress('Tab'), true);
    input.dispose();
  } finally {
    globalThis.window = previousWindow;
  }
});

test('control switching preserves match, rice, capture, sprint and stun state', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(0, 350);
  const rice = new RiceSystem('rice-1', 5000, 400);
  const sprint = new SprintSystem(2500, 0.3, 1000);
  controls.choose('DEEPSEEK');
  match.advanceReady(0);
  rice.update(1400, true);
  match.advancePlaying(200, true, false);
  sprint.tryStart({ x: 1, y: 0 }, 0.3);
  const before = {
    elapsed: match.elapsedMs,
    capture: match.captureProgressMs,
    rice: rice.rice.progressMs,
    sprint: sprint.state,
    sprintRemaining: sprint.sprintRemainingMs,
  };
  controls.toggleControlled();
  assert.deepEqual({
    elapsed: match.elapsedMs,
    capture: match.captureProgressMs,
    rice: rice.rice.progressMs,
    sprint: sprint.state,
    sprintRemaining: sprint.sprintRemainingMs,
  }, before);
  assert.equal(controls.isControlling('HUMAN'), true);

  sprint.advance(2500, { x: 0, y: 0 });
  assert.equal(sprint.state, 'STUNNED');
  controls.toggleControlled();
  assert.equal(sprint.state, 'STUNNED');
  assert.equal(controls.isControlling('DEEPSEEK'), true);
});

test('restart restores controlled faction to selection and menu clear removes both', () => {
  const controls = new LocalControl();
  controls.choose('DEEPSEEK');
  controls.toggleControlled();
  assert.equal(controls.controlledFaction, 'HUMAN');
  controls.resetControlled();
  assert.equal(controls.selectedFaction, 'DEEPSEEK');
  assert.equal(controls.controlledFaction, 'DEEPSEEK');
  controls.clear();
  assert.equal(controls.selectedFaction, null);
  assert.equal(controls.controlledFaction, null);
});

test('match restart does not erase the selected faction', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(3000, 350);
  controls.choose('HUMAN');
  match.advanceReady(3000);
  match.advancePlaying(350, true, false);
  assert.equal(match.phase, 'FINISHED');
  match.reset();
  controls.resetControlled();
  assert.equal(match.phase, 'READY');
  assert.equal(match.result, null);
  assert.equal(controls.faction, 'HUMAN');
  assert.equal(controls.controlledFaction, 'HUMAN');
  assert.equal(controls.controlled('blue', 'orange'), 'orange');
});

test('new Three.js match starts in faction selection and M works during an active match', () => {
  const match = new GameStateSystem(3000, 350, 'FACTION_SELECT');
  assert.equal(match.phase, 'FACTION_SELECT');
  assert.equal(match.beginFromFactionSelect(), true);
  assert.equal(match.phase, 'READY');
  match.advanceReady(3000);
  assert.equal(match.returnToFactionSelect(), true);
  assert.equal(match.phase, 'FACTION_SELECT');
  assert.equal(match.result, null);
  assert.equal(match.elapsedMs, 0);
  assert.equal(match.captureProgressMs, 0);
  assert.equal(match.readyRemainingMs, 3000);
});

test('direct R, M and Tab controls are edge-triggered but disabled by default', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const input = new InputManager();
    const event = (code, repeat = false) => ({ code, repeat, preventDefault() {} });
    input.onKeyDown(event('KeyR'));
    assert.equal(input.consumePress('KeyR'), true);
    input.onKeyDown(event('KeyR', true));
    assert.equal(input.consumePress('KeyR'), false);
    input.onKeyUp({ code: 'KeyR' });
    input.onKeyDown(event('KeyM'));
    assert.equal(input.consumePress('KeyM'), true);
    input.onKeyDown(event('KeyM', true));
    assert.equal(input.consumePress('KeyM'), false);
    assert.equal(GAME_CONFIG.development.directHotkeysEnabled, false);
    assert.equal(resolveRoundShortcut('PLAYING', false, true, false), null);
    assert.equal(resolveRoundShortcut('PAUSED', false, false, true), null);
    assert.equal(resolveRoundShortcut('FINISHED', false, true, false), null);
    assert.equal(resolveRoundShortcut('PLAYING', true, true, false), 'RESTART');
    assert.equal(resolveRoundShortcut('PAUSED', true, false, true), 'FACTION_SELECT');
    assert.equal(resolveRoundShortcut('FACTION_SELECT', true, true, true), null);
    assert.equal(resolveDirectControlSwitch('PLAYING', false, true), false);
    assert.equal(resolveDirectControlSwitch('PAUSED', true, true), false);
    assert.equal(resolveDirectControlSwitch('PLAYING', true, true), true);
    input.dispose();
  } finally {
    globalThis.window = previousWindow;
  }
});

test('pause menu continue and debug switch preserve all gameplay state', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(0, 350);
  const rice = new RiceField(selectRiceCandidates(() => 0.2).map(point => point.id), 5000, 400);
  const sprint = new SprintSystem(2500, 0.3, 1000);
  const doors = new DoorSystem(DOOR_NODES, 3);
  controls.choose('DEEPSEEK');
  match.advanceReady(0);
  rice.update(1400, rice.states[0].id, true);
  match.advancePlaying(120, true, false);
  sprint.tryStart({ x: 1, y: 0 }, 0.3);
  doors.lock(DOOR_NODES[0].id, 'DEEPSEEK');
  const before = {
    elapsed: match.elapsedMs,
    capture: match.captureProgressMs,
    rice: rice.progressMs,
    sprint: sprint.sprintRemainingMs,
    locks: doors.activeLockedDoorCount,
  };

  assert.equal(match.pause(), true);
  assert.equal(match.phase, 'PAUSED');
  controls.toggleControlled();
  assert.equal(controls.selectedFaction, 'DEEPSEEK');
  assert.equal(controls.controlledFaction, 'HUMAN');
  assert.equal(match.phase, 'PAUSED');
  assert.deepEqual({
    elapsed: match.elapsedMs,
    capture: match.captureProgressMs,
    rice: rice.progressMs,
    sprint: sprint.sprintRemainingMs,
    locks: doors.activeLockedDoorCount,
  }, before);

  assert.equal(match.resume(), true);
  assert.equal(match.phase, 'PLAYING');
  assert.equal(match.pause(), true);
  assert.equal(match.returnToFactionSelect(), true);
  assert.equal(match.phase, 'FACTION_SELECT');
});

test('quick restart after Tab restores the selected faction and every round subsystem', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(0, 350);
  let rice = new RiceField(selectRiceCandidates(() => 0.1).map(point => point.id), 5000, 400);
  const sprint = new SprintSystem(2500, 0.3, 1000);
  const doors = new DoorSystem(DOOR_NODES, 3);
  controls.choose('DEEPSEEK');
  match.advanceReady(0);
  rice.update(1900, rice.states[0].id, true);
  match.advancePlaying(200, true, false);
  sprint.tryStart({ x: 1, y: 0 }, 0.3);
  sprint.advance(2500, { x: 0, y: 0 });
  doors.lock(DOOR_NODES[0].id, 'DEEPSEEK');
  doors.lock(DOOR_NODES[1].id, 'DEEPSEEK');
  controls.toggleControlled();
  assert.equal(controls.controlledFaction, 'HUMAN');
  assert.equal(resolveRoundShortcut(match.phase, true, true, false), 'RESTART');

  match.reset();
  controls.resetControlled();
  doors.reset();
  sprint.reset();
  rice = new RiceField(selectRiceCandidates(() => 0.9).map(point => point.id), 5000, 400);
  assert.equal(match.phase, 'READY');
  assert.equal(match.elapsedMs, 0);
  assert.equal(match.captureProgressMs, 0);
  assert.equal(controls.selectedFaction, 'DEEPSEEK');
  assert.equal(controls.controlledFaction, 'DEEPSEEK');
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.ok(doors.doors.every((door, index) => door.state === DOOR_NODES[index].initialState));
  assert.equal(rice.states.length, 5);
  assert.ok(rice.states.every(state => state.progressMs === 0 && !state.completed));
  assert.equal(rice.progressRatio, 0);
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.stunRemainingMs, 0);
});

test('M after Tab clears control and allows a completely fresh faction selection', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(0, 350, 'FACTION_SELECT');
  const sprint = new SprintSystem(2500, 0.3, 1000);
  const doors = new DoorSystem(DOOR_NODES, 3);
  let rice = new RiceField(selectRiceCandidates(() => 0.2).map(point => point.id), 5000, 400);
  controls.choose('DEEPSEEK');
  match.beginFromFactionSelect();
  match.advanceReady(0);
  rice.update(1400, rice.states[0].id, true);
  match.advancePlaying(120, true, false);
  sprint.tryStart({ x: 1, y: 0 }, 0.3);
  doors.lock(DOOR_NODES[0].id, 'DEEPSEEK');
  controls.toggleControlled();
  assert.equal(resolveRoundShortcut(match.phase, true, false, true), 'FACTION_SELECT');

  assert.equal(match.returnToFactionSelect(), true);
  doors.reset();
  sprint.reset();
  rice.reset();
  controls.clear();
  assert.equal(match.phase, 'FACTION_SELECT');
  assert.equal(match.captureProgressMs, 0);
  assert.equal(controls.selectedFaction, null);
  assert.equal(controls.controlledFaction, null);
  assert.equal(doors.activeLockedDoorCount, 0);
  assert.equal(rice.progressRatio, 0);
  assert.equal(sprint.state, 'NORMAL');

  controls.choose('HUMAN');
  assert.equal(match.beginFromFactionSelect(), true);
  rice = new RiceField(selectRiceCandidates(() => 0.7).map(point => point.id), 5000, 400);
  assert.equal(match.phase, 'READY');
  assert.equal(controls.selectedFaction, 'HUMAN');
  assert.equal(controls.controlledFaction, 'HUMAN');
  assert.equal(rice.states.length, 5);
  assert.ok(rice.states.every(state => state.progressMs === 0));
});

test('HUMAN to menu to DEEPSEEK clears round state and rebinds controls and camera target', () => {
  const controls = new LocalControl();
  const match = new GameStateSystem(3000, 350, 'FACTION_SELECT');
  const rice = new RiceSystem('rice-1', 5000, 400);
  const sprint = new SprintSystem(2500, 0.3, 1000);
  controls.choose('HUMAN');
  match.beginFromFactionSelect();
  match.advanceReady(3000);
  rice.update(2000, true);
  assert.ok(rice.rice.progressMs > 1500);
  sprint.tryStart({ x: 1, y: 0 }, rice.rice.progressMs / rice.rice.maxProgressMs);
  sprint.advance(2500, { x: 0, y: 0 });
  assert.equal(sprint.state, 'STUNNED');
  match.advancePlaying(350, true, false);
  assert.equal(match.result?.winner, 'HUMAN');

  assert.equal(match.returnToFactionSelect(), true);
  rice.reset();
  sprint.reset();
  controls.clear();
  assert.equal(controls.faction, null);
  assert.equal(controls.controlledFaction, null);
  assert.equal(controls.controlled('blue', 'orange'), null);
  assert.equal(match.phase, 'FACTION_SELECT');
  assert.equal(match.result, null);
  assert.equal(match.captureProgressMs, 0);
  assert.equal(rice.rice.progressMs, 0);
  assert.equal(rice.rice.completed, false);
  assert.equal(rice.rice.interactionState, 'IDLE');
  assert.equal(sprint.state, 'NORMAL');
  assert.equal(sprint.sprintRemainingMs, 0);
  assert.equal(sprint.stunRemainingMs, 0);
  assert.equal(sprint.riskMode, null);

  controls.choose('DEEPSEEK');
  match.beginFromFactionSelect();
  assert.equal(match.phase, 'READY');
  assert.equal(controls.controlled('blue', 'orange'), 'blue');
  assert.deepEqual(controls.directions({ x: 1, y: 0 }, { x: 0, y: 1 }),
    { deepseek: { x: 1, y: 0 }, human: { x: 0, y: 1 } });
});
