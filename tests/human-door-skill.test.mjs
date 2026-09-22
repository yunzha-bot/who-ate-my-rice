import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { HumanDoorSkill } from '../src/systems/HumanDoorSkill.ts';
import { MinesweeperLockSystem } from '../src/systems/MinesweeperLockSystem.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { CollisionWorld, canInteractWithDoorXZ } from '../src/three/CollisionWorld.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { InputManager } from '../src/three/InputManager.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';

const nodes = DOOR_NODES.slice(0, 4);
function setup() {
  const doors = new DoorSystem(nodes, C.door.maxActiveLocks);
  const skill = new HumanDoorSkill(doors, C.door.humanForceBreakCooldownMs);
  return { doors, skill };
}

test('door frame side gains a wider E/Space interaction range and nearest valid door wins', () => {
  const { doors } = setup();
  const door = nodes[0];
  const actor = door.rotation === 0
    ? new Vector3(door.x + door.width / 2 - 0.12, 0.35, door.z + 1.1)
    : new Vector3(door.x + 1.1, 0.35, door.z + door.width / 2 - 0.12);
  const world = new CollisionWorld(30, 30, []);
  const view = new DoorView(door, 0, false);
  world.setDynamicObstacle(door.id, view.closedCollisionBox());
  assert.equal(doors.nearest(actor.x, actor.z, 0.85), null);
  assert.equal(canInteractWithDoorXZ(world, actor, door), true);
  assert.equal(doors.nearest(actor.x, actor.z, C.door.interactionRange,
    (_state, definition) => canInteractWithDoorXZ(world, actor, definition))?.door.id, door.id);
  view.dispose();
});

test('wall blocks door interaction even in radius; another visible door can be selected', () => {
  const first = { id: 'near', x: 0, z: 0, rotation: 0, width: 1.5, initialState: 'CLOSED' };
  const second = { id: 'far', x: 2, z: 0, rotation: 0, width: 1.5, initialState: 'CLOSED' };
  const doors = new DoorSystem([first, second], 3);
  const actor = new Vector3(0.45, 0.35, 0.8);
  const wall = new Box3(new Vector3(-0.2, 0, 0.35), new Vector3(0.6, 1, 0.65));
  const world = new CollisionWorld(30, 30, [wall]);
  assert.equal(canInteractWithDoorXZ(world, actor, first), false);
  assert.equal(canInteractWithDoorXZ(world, actor, second), true);
  assert.equal(doors.nearest(actor.x, actor.z, C.door.interactionRange,
    (_state, definition) => canInteractWithDoorXZ(world, actor, definition))?.door.id, second.id);
});

test('Space opens ordinary CLOSED doors repeatedly without cooldown, including during force CD', () => {
  const { doors, skill } = setup();
  assert.equal(skill.use(nodes[0].id, 'HUMAN', 'PLAYING'), 'OPENED');
  assert.equal(skill.use(nodes[1].id, 'HUMAN', 'PLAYING'), 'OPENED');
  assert.equal(skill.cooldownRemainingMs, 0);
  assert.equal(doors.lock(nodes[2].id, 'DEEPSEEK'), 'LOCKED');
  assert.equal(skill.use(nodes[2].id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  assert.equal(doors.get(nodes[2].id).state, 'OPEN');
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
  assert.equal(skill.use(nodes[3].id, 'HUMAN', 'PLAYING'), 'OPENED');
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
});

test('force break disables locked core, opens door, releases slot and prevents relock', () => {
  const { doors, skill } = setup();
  for (const node of nodes.slice(0, 3)) doors.lock(node.id, 'DEEPSEEK');
  assert.equal(doors.activeLockedDoorCount, 3);
  assert.equal(skill.use(nodes[0].id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  assert.equal(doors.get(nodes[0].id).state, 'OPEN');
  assert.equal(doors.get(nodes[0].id).lockCoreState, 'DISABLED');
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.toggle(nodes[0].id, 'HUMAN'), 'CLOSED');
  assert.equal(doors.lock(nodes[0].id, 'DEEPSEEK'), 'LOCK_CORE_DISABLED');
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.lock(nodes[3].id, 'DEEPSEEK'), 'LOCKED');
});

test('cooldown blocks only locked-door Space, freezes on pause/finish, resets next match', () => {
  const { doors, skill } = setup();
  doors.lock(nodes[0].id, 'DEEPSEEK');
  doors.lock(nodes[1].id, 'DEEPSEEK');
  skill.use(nodes[0].id, 'HUMAN', 'PLAYING');
  assert.equal(skill.use(nodes[1].id, 'HUMAN', 'PLAYING'), 'COOLDOWN');
  assert.equal(doors.get(nodes[1].id).state, 'LOCKED');
  skill.advance(9999, 'PAUSED');
  skill.advance(9999, 'FINISHED');
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
  assert.equal(skill.use(nodes[2].id, 'HUMAN', 'PAUSED'), 'NOT_ALLOWED');
  assert.equal(skill.use(nodes[1].id, 'HUMAN', 'FINISHED'), 'NOT_ALLOWED');
  skill.advance(C.door.humanForceBreakCooldownMs, 'PLAYING');
  assert.equal(skill.use(nodes[1].id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  doors.reset();
  skill.reset();
  assert.equal(skill.cooldownRemainingMs, 0);
  assert.ok(doors.doors.every(door => door.lockCoreState === 'ACTIVE'));
});

test('E minesweeper remains available during force cooldown and success does not start it', () => {
  const { doors, skill } = setup();
  const mines = new MinesweeperLockSystem(doors, C.pulseLock.rows, C.pulseLock.cols,
    C.pulseLock.mines, () => 0);
  doors.lock(nodes[0].id, 'DEEPSEEK');
  doors.lock(nodes[1].id, 'DEEPSEEK');
  skill.use(nodes[0].id, 'HUMAN', 'PLAYING');
  assert.equal(mines.open(nodes[1].id, 'HUMAN', 'PLAYING'), true);
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
  assert.equal(mines.reveal(0, 0, 'PLAYING'), 'REVEALED');
  const board = mines.get(nodes[1].id).board;
  for (let index = 0; index < board.cells.length; index++) {
    if (!board.cells[index].mine && !board.cells[index].revealed) {
      mines.reveal(Math.floor(index / 4), index % 4, 'PLAYING');
    }
  }
  assert.equal(doors.get(nodes[1].id).state, 'CLOSED');
  assert.equal(doors.get(nodes[1].id).lockCoreState, 'DISABLED');
  assert.equal(skill.cooldownRemainingMs, C.door.humanForceBreakCooldownMs);
});

test('Space press edge and cooldown prevent held or spammed force breaks', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const { doors, skill } = setup();
    doors.lock(nodes[0].id, 'DEEPSEEK');
    doors.lock(nodes[1].id, 'DEEPSEEK');
    const input = new InputManager();
    const event = repeat => ({ code: 'Space', repeat, preventDefault() {} });
    input.onKeyDown(event(false));
    assert.equal(input.consumePress('Space'), true);
    assert.equal(skill.use(nodes[0].id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
    for (let count = 0; count < 50; count++) {
      input.onKeyDown(event(true));
      assert.equal(input.consumePress('Space'), false);
    }
    input.onKeyUp({ code: 'Space' });
    input.onKeyDown(event(false));
    assert.equal(input.consumePress('Space'), true);
    assert.equal(skill.use(nodes[1].id, 'HUMAN', 'PLAYING'), 'COOLDOWN');
    assert.equal(doors.get(nodes[1].id).state, 'LOCKED');
    input.dispose();
  } finally { globalThis.window = previousWindow; }
});

test('DeepSeek Space sprint remains independent of Human door skill', () => {
  const { skill } = setup();
  const sprint = new SprintSystem(C.sprint.durationMs, C.sprint.riskThreshold, C.sprint.stunMs);
  assert.equal(skill.use(nodes[0].id, 'DEEPSEEK', 'PLAYING'), 'NOT_ALLOWED');
  assert.equal(sprint.tryStart({ x: 1, y: 0 }, 0), true);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
});

test('force-open removes door collision and capture blocking immediately', () => {
  const { doors, skill } = setup();
  const node = nodes[0];
  const view = new DoorView(node, 0, false);
  const world = new CollisionWorld(30, 30, []);
  const side = node.rotation === 0
    ? new Vector3(node.x, 0.35, node.z - 0.4)
    : new Vector3(node.x - 0.4, 0.35, node.z);
  const other = node.rotation === 0
    ? new Vector3(node.x, 0.35, node.z + 0.4)
    : new Vector3(node.x + 0.4, 0.35, node.z);
  doors.lock(node.id, 'DEEPSEEK');
  world.setDynamicObstacle(node.id, view.closedCollisionBox());
  assert.equal(world.isLineBlockedXZ(side, other), true);
  assert.equal(skill.use(node.id, 'HUMAN', 'PLAYING'), 'FORCE_OPENED');
  view.sync(doors.get(node.id));
  world.setDynamicObstacle(node.id, doors.get(node.id).state === 'OPEN'
    ? null : view.closedCollisionBox());
  assert.equal(world.isLineBlockedXZ(side, other), false);
  assert.equal(world.dynamicObstacleCount(), 0);
  view.dispose();
});
