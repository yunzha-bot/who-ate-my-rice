import type { DoorActor } from './DoorSystem.ts';
import { DoorSystem } from './DoorSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';

export type PulseLockInteractionState = 'IDLE' | 'UNLOCKING' | 'RETAINED' | 'DISABLED';

export interface PulseLockEntry {
  doorId: string;
  unlockProgressMs: number;
  retentionRemainingMs: number;
  interactionState: PulseLockInteractionState;
}

export interface PulseLockFrameResult {
  completedDoorId: string | null;
  movementLocked: boolean;
}

export class PulseLockSystem {
  readonly entries: PulseLockEntry[];
  readonly unlockDurationMs: number;
  readonly retentionMs: number;
  humanExposed = false;
  activeDoorId: string | null = null;
  private readonly doors: DoorSystem;

  constructor(doors: DoorSystem, unlockDurationMs: number, retentionMs: number) {
    this.doors = doors;
    this.unlockDurationMs = unlockDurationMs;
    this.retentionMs = retentionMs;
    this.entries = doors.doors.map(door => this.freshEntry(door.id));
  }

  get(doorId: string): PulseLockEntry | undefined {
    return this.entries.find(entry => entry.doorId === doorId);
  }

  advance(deltaMs: number, phase: GamePhase, actor: DoorActor | null,
    targetDoorId: string | null, interactHeld: boolean): PulseLockFrameResult {
    if (phase !== 'PLAYING') {
      this.interrupt();
      return { completedDoorId: null, movementLocked: false };
    }
    const elapsed = Math.max(0, deltaMs);
    const requestedDoorId = actor === 'HUMAN' && interactHeld ? targetDoorId : null;
    let completedDoorId: string | null = null;
    let movementLocked = false;
    this.humanExposed = false;
    this.activeDoorId = null;

    for (const entry of this.entries) {
      const door = this.doors.get(entry.doorId);
      if (!door) continue;
      if (door.lockCoreState === 'DISABLED') {
        entry.unlockProgressMs = this.unlockDurationMs;
        entry.retentionRemainingMs = 0;
        entry.interactionState = 'DISABLED';
        continue;
      }

      const canUnlock = entry.doorId === requestedDoorId &&
        door.state === 'LOCKED' && door.locked;
      if (canUnlock) {
        entry.interactionState = 'UNLOCKING';
        entry.retentionRemainingMs = this.retentionMs;
        entry.unlockProgressMs = Math.min(
          this.unlockDurationMs, entry.unlockProgressMs + elapsed);
        movementLocked = true;
        this.humanExposed = true;
        this.activeDoorId = entry.doorId;
        if (entry.unlockProgressMs >= this.unlockDurationMs &&
            this.doors.disableLock(entry.doorId, 'HUMAN') === 'UNLOCKED') {
          entry.interactionState = 'DISABLED';
          entry.retentionRemainingMs = 0;
          completedDoorId = entry.doorId;
          this.humanExposed = false;
          this.activeDoorId = null;
        }
        continue;
      }

      if (entry.interactionState === 'UNLOCKING') {
        entry.interactionState = 'RETAINED';
        entry.retentionRemainingMs = this.retentionMs;
        continue;
      }
      if (entry.interactionState === 'RETAINED') {
        entry.retentionRemainingMs = Math.max(0, entry.retentionRemainingMs - elapsed);
        if (entry.retentionRemainingMs === 0) {
          entry.unlockProgressMs = 0;
          entry.interactionState = 'IDLE';
        }
      }
    }

    return { completedDoorId, movementLocked };
  }

  interrupt(): void {
    for (const entry of this.entries) {
      if (entry.interactionState !== 'UNLOCKING') continue;
      entry.interactionState = 'RETAINED';
      entry.retentionRemainingMs = this.retentionMs;
    }
    this.humanExposed = false;
    this.activeDoorId = null;
  }

  reset(): void {
    for (let index = 0; index < this.entries.length; index += 1) {
      this.entries[index] = this.freshEntry(this.entries[index].doorId);
    }
    this.humanExposed = false;
    this.activeDoorId = null;
  }

  private freshEntry(doorId: string): PulseLockEntry {
    return {
      doorId,
      unlockProgressMs: 0,
      retentionRemainingMs: 0,
      interactionState: 'IDLE',
    };
  }
}
