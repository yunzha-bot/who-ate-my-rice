import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { MinesweeperLockSystem } from '../src/systems/MinesweeperLockSystem.ts';
import { RiceField } from '../src/systems/RiceField.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { isCaptureEligibleXZ } from '../src/three/CaptureZone.ts';
import { InputManager } from '../src/three/InputManager.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';

const nodes = DOOR_NODES.slice(0, 4);

function setup(random = () => 0) {
  const doors = new DoorSystem(nodes, GAME_CONFIG.door.maxActiveLocks);
  const mines = new MinesweeperLockSystem(doors,
    GAME_CONFIG.pulseLock.rows, GAME_CONFIG.pulseLock.cols,
    GAME_CONFIG.pulseLock.mines, random);
  const id = nodes[0].id;
  assert.equal(doors.lock(id, 'DEEPSEEK'), 'LOCKED');
  return { doors, mines, id };
}

function reveal(mines, index) {
  return mines.reveal(Math.floor(index / mines.cols), index % mines.cols, 'PLAYING');
}

test('4x4 board has three mines and only Human can open an ACTIVE locked core', () => {
  const { doors, mines, id } = setup();
  assert.equal(mines.rows, 4);
  assert.equal(mines.cols, 4);
  assert.equal(mines.mines, 3);
  assert.equal(mines.open(id, 'DEEPSEEK', 'PLAYING'), false);
  assert.equal(mines.open(id, 'HUMAN', 'PAUSED'), false);
  assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), true);
  assert.equal(mines.get(id).board.cells.length, 16);
  assert.equal(mines.get(id).board.generated, false);
  assert.equal(mines.movementLocked, true);
  assert.equal(mines.humanExposed, true);
  assert.equal(doors.get(id).state, 'LOCKED');
});

test('one E-open, rapid repeated opens, and held E cannot reveal or unlock any cell', () => {
  const { doors, mines, id } = setup();
  assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), true);
  for (let count = 0; count < 100; count += 1) {
    assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), false);
  }
  assert.equal(mines.get(id).board.revealedSafeCells, 0);
  assert.equal(mines.get(id).board.generated, false);
  assert.equal(doors.get(id).state, 'LOCKED');
  assert.equal(doors.get(id).lockCoreState, 'ACTIVE');
  assert.equal(doors.activeLockedDoorCount, 1);
});

test('E key edge opens once; repeat, hold, and rapid presses never advance the board', () => {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const { doors, mines, id } = setup();
    const input = new InputManager();
    const keyDown = (repeat = false) => input.onKeyDown({ code: 'KeyE', repeat,
      preventDefault() {} });
    keyDown();
    if (input.consumePress('KeyE')) mines.open(id, 'HUMAN', 'PLAYING');
    for (let count = 0; count < 100; count += 1) {
      keyDown(true);
      if (input.consumePress('KeyE')) mines.open(id, 'HUMAN', 'PLAYING');
      input.onKeyUp({ code: 'KeyE' });
      keyDown();
      if (input.consumePress('KeyE')) mines.open(id, 'HUMAN', 'PLAYING');
    }
    assert.equal(mines.get(id).board.revealedSafeCells, 0);
    assert.equal(doors.get(id).lockCoreState, 'ACTIVE');
    assert.equal(doors.get(id).state, 'LOCKED');
    input.dispose();
  } finally {
    globalThis.window = previousWindow;
  }
});

test('first reveal is safe, places exactly three mines, and computes all neighbor counts', () => {
  const { mines, id } = setup();
  mines.open(id, 'HUMAN', 'PLAYING');
  assert.equal(reveal(mines, 0), 'REVEALED');
  const cells = mines.get(id).board.cells;
  assert.equal(cells[0].mine, false);
  assert.equal(cells[0].revealed, true);
  assert.equal(cells.filter(cell => cell.mine).length, 3);
  for (let index = 0; index < cells.length; index += 1) {
    if (cells[index].mine) continue;
    const row = Math.floor(index / 4), col = index % 4;
    const neighbors = cells.filter((cell, other) => cell.mine &&
      Math.abs(Math.floor(other / 4) - row) <= 1 && Math.abs(other % 4 - col) <= 1);
    assert.equal(cells[index].adjacentMineCount, neighbors.length);
  }
});

test('zero cells expand safely and never reveal a neighboring mine', () => {
  const { mines, id } = setup(() => 0.999);
  mines.open(id, 'HUMAN', 'PLAYING');
  const result = reveal(mines, 0);
  const board = mines.get(id).board;
  assert.ok(result === 'REVEALED' || result === 'UNLOCKED');
  assert.equal(board.cells[0].adjacentMineCount, 0);
  assert.ok(board.revealedSafeCells > 1);
  assert.ok(board.cells.every(cell => !cell.mine || !cell.revealed));
});

test('flagged cell cannot be revealed until unflagged; right-click state toggles', () => {
  const { mines, id } = setup();
  mines.open(id, 'HUMAN', 'PLAYING');
  assert.equal(mines.toggleFlag(0, 0, 'PLAYING'), 'FLAGGED');
  assert.equal(reveal(mines, 0), 'IGNORED');
  assert.equal(mines.get(id).board.generated, false);
  assert.equal(mines.toggleFlag(0, 0, 'PLAYING'), 'UNFLAGGED');
  assert.equal(reveal(mines, 0), 'REVEALED');
  assert.equal(mines.toggleFlag(0, 0, 'PLAYING'), 'IGNORED');
});

test('close by X or Escape preserves board, flags, layout, lock, and restores movement', () => {
  const { doors, mines, id } = setup();
  mines.open(id, 'HUMAN', 'PLAYING');
  reveal(mines, 0);
  mines.toggleFlag(3, 3, 'PLAYING');
  const board = mines.get(id).board;
  const layout = board.cells.map(cell => cell.mine);
  mines.close(); // Both UI close paths call this same operation.
  assert.equal(mines.isOpen, false);
  assert.equal(mines.movementLocked, false);
  assert.equal(mines.humanExposed, false);
  assert.equal(doors.get(id).state, 'LOCKED');
  assert.equal(doors.get(id).lockCoreState, 'ACTIVE');
  assert.equal(doors.activeLockedDoorCount, 1);
  assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), true);
  assert.equal(mines.get(id).board, board);
  assert.deepEqual(board.cells.map(cell => cell.mine), layout);
  assert.equal(board.cells[0].revealed, true);
  assert.equal(board.cells[15].flagged, true);
  mines.close();
  assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), true);
  assert.equal(mines.get(id).board, board);
});

test('boards of different lock cores are independent and cannot both be open', () => {
  const { doors, mines, id } = setup();
  const other = nodes[1].id;
  doors.lock(other, 'DEEPSEEK');
  mines.open(id, 'HUMAN', 'PLAYING');
  reveal(mines, 0);
  assert.equal(mines.open(other, 'HUMAN', 'PLAYING'), false);
  mines.close();
  assert.equal(mines.open(other, 'HUMAN', 'PLAYING'), true);
  assert.notEqual(mines.get(id).board, mines.get(other).board);
  assert.equal(mines.get(other).board.revealedSafeCells, 0);
  assert.equal(mines.get(other).board.generated, false);
});

test('mine hit fails only that board and next open creates a fresh board', () => {
  const { doors, mines, id } = setup();
  mines.open(id, 'HUMAN', 'PLAYING');
  reveal(mines, 0); // Deterministic mines are at 1, 2, 3.
  const oldBoard = mines.get(id).board;
  assert.equal(reveal(mines, 1), 'FAILED');
  assert.equal(oldBoard.cells[1].mine, true);
  assert.equal(oldBoard.cells[1].revealed, true);
  assert.equal(mines.isOpen, false);
  assert.equal(mines.get(id).state, 'FAILED');
  assert.equal(doors.get(id).state, 'LOCKED');
  assert.equal(doors.get(id).lockCoreState, 'ACTIVE');
  assert.equal(doors.activeLockedDoorCount, 1);
  assert.equal(mines.open(id, 'HUMAN', 'PLAYING'), true);
  assert.notEqual(mines.get(id).board, oldBoard);
  assert.equal(mines.get(id).board.generated, false);
});

test('all safe cells revealed succeeds without flags, leaves CLOSED door and releases slot', () => {
  const { doors, mines, id } = setup();
  for (const node of nodes.slice(1, 3)) doors.lock(node.id, 'DEEPSEEK');
  assert.equal(doors.activeLockedDoorCount, 3);
  mines.open(id, 'HUMAN', 'PLAYING');
  reveal(mines, 0);
  const board = mines.get(id).board;
  let finalResult = 'REVEALED';
  for (let index = 0; index < board.cells.length; index += 1) {
    if (!board.cells[index].mine && !board.cells[index].revealed) finalResult = reveal(mines, index);
  }
  assert.equal(finalResult, 'UNLOCKED');
  assert.equal(board.revealedSafeCells, 13);
  assert.equal(mines.isOpen, false);
  assert.equal(mines.movementLocked, false);
  assert.equal(doors.get(id).lockCoreState, 'DISABLED');
  assert.equal(doors.get(id).state, 'CLOSED');
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.lock(id, 'DEEPSEEK'), 'LOCK_CORE_DISABLED');
  assert.equal(doors.activeLockedDoorCount, 2);
  assert.equal(doors.lock(nodes[3].id, 'DEEPSEEK'), 'LOCKED');
  assert.equal(doors.toggle(id, 'HUMAN'), 'OPENED'); // Requires a separate interaction.
});

test('restart or new Match clears every board and restores all cores and slots', () => {
  const { doors, mines, id } = setup();
  doors.lock(nodes[1].id, 'DEEPSEEK');
  mines.open(id, 'HUMAN', 'PLAYING');
  reveal(mines, 0);
  mines.close();
  mines.open(nodes[1].id, 'HUMAN', 'PLAYING');
  mines.toggleFlag(2, 2, 'PLAYING');
  doors.reset();
  mines.reset();
  assert.equal(mines.openDoorId, null);
  assert.ok(mines.entries.every(entry => entry.state === 'IDLE' && entry.board === null));
  assert.ok(doors.doors.every(door => door.lockCoreState === 'ACTIVE'));
  assert.equal(doors.activeLockedDoorCount, 0);
});

test('open panel leaves game PLAYING: timer, rice, sprint and capture still advance', () => {
  const { doors, mines, id } = setup();
  const match = new GameStateSystem(0, GAME_CONFIG.match.captureMs);
  match.advanceReady(0);
  const rice = new RiceField(['rice'], GAME_CONFIG.rice.maxProgressMs, 0);
  const sprint = new SprintSystem(GAME_CONFIG.sprint.durationMs,
    GAME_CONFIG.sprint.riskThreshold, GAME_CONFIG.sprint.stunMs);
  sprint.tryStart({ x: 1, y: 0 }, 0);
  mines.open(id, 'HUMAN', match.phase);
  assert.equal(mines.movementLocked, true);
  assert.equal(match.phase, 'PLAYING');
  match.advancePlaying(100, false, false);
  rice.update(100, 'rice', true);
  sprint.advance(100, { x: 1, y: 0 });
  assert.equal(match.elapsedMs, 100);
  assert.equal(rice.get('rice').rice.progressMs, 100);
  assert.equal(sprint.sprintRemainingMs, GAME_CONFIG.sprint.durationMs - 100);
  assert.equal(doors.get(id).state, 'LOCKED');
  const human = new Vector3(0, 0, 0), deepseek = new Vector3(0.2, 0, 0.2);
  const eligible = isCaptureEligibleXZ(human, deepseek, GAME_CONFIG.match.captureRadius, false);
  match.advancePlaying(GAME_CONFIG.match.captureMs, eligible, false);
  assert.equal(match.result?.winner, 'HUMAN');
  mines.close(); // Runtime closes on FINISHED.
  assert.equal(mines.isOpen, false);
  assert.equal(mines.reveal(0, 0, 'FINISHED'), 'IGNORED');
});
