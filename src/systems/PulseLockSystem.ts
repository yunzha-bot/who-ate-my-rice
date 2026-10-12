import type { GamePhase } from './GameStateSystem.ts';
import type { DoorActor, DoorState } from './DoorSystem.ts';

export type PulseResult = 'IGNORED' | 'MISS' | 'CORE_COMPLETE' | 'COMPLETE';

export interface PulseLockSettings {
  coreCount: number;
  travelMs: number;
  targetWidth: number;
  targetCenters: readonly number[];
  feedbackMs: number;
}

export interface PulseLockEntry {
  doorId: string;
  completed: number;
  position: number;
  feedback: 'NONE' | 'MISS' | 'SUCCESS';
  feedbackRemainingMs: number;
}

/** Player timing state only. DoorSystem remains the authority for lock state. */
export class PulseLockSystem {
  readonly entries: PulseLockEntry[];
  openDoorId: string | null = null;
  private travelElapsedMs = 0;
  private readonly doors: { get(id: string): DoorState | undefined; doors: readonly DoorState[] };
  private readonly settings: PulseLockSettings;

  constructor(doors: { get(id: string): DoorState | undefined;
    doors: readonly DoorState[] }, settings: PulseLockSettings) {
    if (settings.coreCount !== 3 || settings.travelMs <= 0 ||
        settings.targetWidth <= 0 || settings.targetWidth >= 1 ||
        settings.targetCenters.length !== settings.coreCount ||
        settings.targetCenters.some(center => !Number.isFinite(center) ||
          center - settings.targetWidth / 2 < 0 || center + settings.targetWidth / 2 > 1)) {
      throw new Error('Invalid PulseLock settings');
    }
    this.doors = doors;
    this.settings = settings;
    this.entries = doors.doors.map(door => this.freshEntry(door.id));
  }

  get isOpen(): boolean { return this.openDoorId !== null; }
  get humanExposed(): boolean { return this.isOpen; }
  get movementLocked(): boolean { return this.isOpen; }
  get coreCount(): number { return this.settings.coreCount; }
  get targetWidth(): number { return this.settings.targetWidth; }
  get targetCenters(): readonly number[] { return this.settings.targetCenters; }

  get(doorId: string): PulseLockEntry | undefined {
    return this.entries.find(entry => entry.doorId === doorId);
  }

  open(doorId: string, actor: DoorActor, phase: GamePhase): boolean {
    const door = this.doors.get(doorId);
    if (this.isOpen || actor !== 'HUMAN' || phase !== 'PLAYING' ||
        door?.state !== 'LOCKED' || !door.locked || door.lockCoreState !== 'ACTIVE') return false;
    this.openDoorId = doorId;
    this.travelElapsedMs = 0;
    const entry = this.get(doorId)!;
    entry.position = 0;
    entry.feedback = 'NONE';
    entry.feedbackRemainingMs = 0;
    return true;
  }

  advance(deltaMs: number, phase: GamePhase): void {
    if (!this.openDoorId || phase !== 'PLAYING') return;
    const door = this.doors.get(this.openDoorId);
    if (door?.state !== 'LOCKED' || !door.locked || door.lockCoreState !== 'ACTIVE') {
      this.close();
      return;
    }
    const entry = this.get(this.openDoorId)!;
    const cycle = this.settings.travelMs * 2;
    this.travelElapsedMs = (this.travelElapsedMs + Math.max(0, deltaMs)) % cycle;
    entry.position = this.travelElapsedMs <= this.settings.travelMs
      ? this.travelElapsedMs / this.settings.travelMs
      : 2 - this.travelElapsedMs / this.settings.travelMs;
    entry.feedbackRemainingMs = Math.max(0, entry.feedbackRemainingMs - deltaMs);
    if (entry.feedbackRemainingMs === 0) entry.feedback = 'NONE';
  }

  press(phase: GamePhase): PulseResult {
    if (phase !== 'PLAYING' || !this.openDoorId) return 'IGNORED';
    const door = this.doors.get(this.openDoorId);
    if (door?.state !== 'LOCKED' || !door.locked || door.lockCoreState !== 'ACTIVE') {
      this.close();
      return 'IGNORED';
    }
    const entry = this.get(this.openDoorId)!;
    const center = this.settings.targetCenters[entry.completed];
    const hit = Math.abs(entry.position - center) <= this.settings.targetWidth / 2;
    this.travelElapsedMs = 0;
    entry.position = 0;
    entry.feedback = hit ? 'SUCCESS' : 'MISS';
    entry.feedbackRemainingMs = this.settings.feedbackMs;
    if (!hit) return 'MISS';
    entry.completed += 1;
    return entry.completed === this.settings.coreCount ? 'COMPLETE' : 'CORE_COMPLETE';
  }

  close(): void {
    this.openDoorId = null;
    this.travelElapsedMs = 0;
  }

  reset(): void {
    this.close();
    for (let i = 0; i < this.entries.length; i += 1) {
      this.entries[i] = this.freshEntry(this.entries[i].doorId);
    }
  }

  private freshEntry(doorId: string): PulseLockEntry {
    return { doorId, completed: 0, position: 0,
      feedback: 'NONE', feedbackRemainingMs: 0 };
  }
}
