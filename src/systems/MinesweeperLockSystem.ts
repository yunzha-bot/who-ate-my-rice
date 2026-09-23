import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { DoorActor } from './DoorSystem.ts';
import { DoorSystem } from './DoorSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';

export interface MineCell {
  mine: boolean;
  adjacentMineCount: number;
  revealed: boolean;
  flagged: boolean;
}

export interface MineBoard {
  cells: MineCell[];
  generated: boolean;
  revealedSafeCells: number;
}

export type MineInteractionState = 'IDLE' | 'OPEN' | 'FAILED' | 'DISABLED';
export interface MineEntry {
  doorId: string;
  board: MineBoard | null;
  state: MineInteractionState;
}

export type MineActionResult = 'IGNORED' | 'REVEALED' | 'FLAGGED' | 'UNFLAGGED' |
  'FAILED' | 'UNLOCKED';

export class MinesweeperLockSystem {
  readonly entries: MineEntry[];
  readonly rows: number;
  readonly cols: number;
  readonly mines: number;
  openDoorId: string | null = null;
  private readonly doors: DoorSystem;
  private readonly random: () => number;

  constructor(doors: DoorSystem, rows: number, cols: number,
    mines: number, random: () => number = Math.random) {
    if (rows < 1 || cols < 1 || mines < 1 || mines >= rows * cols) {
      throw new Error('Invalid minesweeper board dimensions');
    }
    this.rows = rows;
    this.cols = cols;
    this.mines = mines;
    this.doors = doors;
    this.random = random;
    this.entries = doors.doors.map(door => this.freshEntry(door.id));
  }

  get(doorId: string): MineEntry | undefined {
    return this.entries.find(entry => entry.doorId === doorId);
  }

  get isOpen(): boolean { return this.openDoorId !== null; }
  get humanExposed(): boolean { return this.isOpen; }
  get movementLocked(): boolean { return this.isOpen; }

  open(doorId: string, actor: DoorActor, phase: GamePhase): boolean {
    if (this.isOpen || phase !== 'PLAYING' || actor !== 'HUMAN') return false;
    const door = this.doors.get(doorId);
    const entry = this.get(doorId);
    if (!entry || !door || door.state !== 'LOCKED' || !door.locked ||
        door.lockCoreState !== 'ACTIVE') return false;
    if (!entry.board || entry.state === 'FAILED') entry.board = this.emptyBoard();
    entry.state = 'OPEN';
    this.openDoorId = doorId;
    return true;
  }

  close(): void {
    if (!this.openDoorId) return;
    const entry = this.get(this.openDoorId);
    if (entry && entry.state === 'OPEN') entry.state = 'IDLE';
    this.openDoorId = null;
  }

  reveal(row: number, col: number, phase: GamePhase): MineActionResult {
    const entry = this.activeEntry(phase);
    if (!entry?.board || !this.inBounds(row, col)) return 'IGNORED';
    const board = entry.board;
    const index = row * this.cols + col;
    if (board.cells[index].flagged || board.cells[index].revealed) return 'IGNORED';
    if (!board.generated) this.placeMines(board, index);
    if (board.cells[index].mine) {
      board.cells[index].revealed = true;
      entry.state = 'FAILED';
      this.openDoorId = null;
      return 'FAILED';
    }
    this.revealSafe(board, index);
    if (board.revealedSafeCells === this.rows * this.cols - this.mines &&
        this.doors.disableLock(entry.doorId, 'HUMAN') === 'UNLOCKED') {
      entry.state = 'DISABLED';
      this.openDoorId = null;
      return 'UNLOCKED';
    }
    return 'REVEALED';
  }

  toggleFlag(row: number, col: number, phase: GamePhase): MineActionResult {
    const entry = this.activeEntry(phase);
    if (!entry?.board || !this.inBounds(row, col)) return 'IGNORED';
    const cell = entry.board.cells[row * this.cols + col];
    if (cell.revealed) return 'IGNORED';
    cell.flagged = !cell.flagged;
    return cell.flagged ? 'FLAGGED' : 'UNFLAGGED';
  }

  reset(): void {
    this.openDoorId = null;
    for (let index = 0; index < this.entries.length; index += 1) {
      this.entries[index] = this.freshEntry(this.entries[index].doorId);
    }
  }

  private activeEntry(phase: GamePhase): MineEntry | null {
    if (phase !== 'PLAYING' || !this.openDoorId) return null;
    const entry = this.get(this.openDoorId);
    const door = this.doors.get(this.openDoorId);
    return entry?.state === 'OPEN' && door?.state === 'LOCKED' && door.locked &&
      door.lockCoreState === 'ACTIVE' ? entry : null;
  }

  private freshEntry(doorId: string): MineEntry {
    return { doorId, board: null, state: 'IDLE' };
  }

  private emptyBoard(): MineBoard {
    return { generated: false, revealedSafeCells: 0,
      cells: Array.from({ length: this.rows * this.cols }, () => ({
        mine: false, adjacentMineCount: 0, revealed: false, flagged: false,
      })) };
  }

  private placeMines(board: MineBoard, safeIndex: number): void {
    const available = board.cells.map((_, index) => index)
      .filter(index => !GAME_CONFIG.pulseLock.firstRevealSafe || index !== safeIndex);
    for (let count = 0; count < this.mines; count += 1) {
      const pick = Math.min(available.length - 1,
        Math.max(0, Math.floor(this.random() * available.length)));
      board.cells[available.splice(pick, 1)[0]].mine = true;
    }
    for (let index = 0; index < board.cells.length; index += 1) {
      if (board.cells[index].mine) continue;
      board.cells[index].adjacentMineCount = this.neighbors(index)
        .filter(neighbor => board.cells[neighbor].mine).length;
    }
    board.generated = true;
  }

  private revealSafe(board: MineBoard, startIndex: number): void {
    const pending = [startIndex];
    while (pending.length) {
      const index = pending.pop()!;
      const cell = board.cells[index];
      if (cell.revealed || cell.flagged || cell.mine) continue;
      cell.revealed = true;
      board.revealedSafeCells += 1;
      if (cell.adjacentMineCount === 0) pending.push(...this.neighbors(index));
    }
  }

  private neighbors(index: number): number[] {
    const row = Math.floor(index / this.cols), col = index % this.cols;
    const result: number[] = [];
    for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      if (this.inBounds(row + dr, col + dc)) result.push((row + dr) * this.cols + col + dc);
    }
    return result;
  }

  private inBounds(row: number, col: number): boolean {
    return Number.isInteger(row) && Number.isInteger(col) &&
      row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }
}
