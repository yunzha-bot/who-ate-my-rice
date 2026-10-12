/**
 * Cross-door penalty applied when a Human player defeats a lock placed by the
 * DeepSeek AI. This is separate from the AI's existing per-door escape delay.
 */
export class DeepSeekDoorLockPenalty {
  private readonly durationMs: number;
  private readonly aiLockedDoors = new Set<string>();
  private _remainingMs = 0;

  constructor(durationMs: number) {
    this.durationMs = Math.max(0, durationMs);
  }

  get remainingMs(): number { return this._remainingMs; }
  get ready(): boolean { return this._remainingMs <= 0; }

  onDeepSeekLockResult(doorId: string, result: string): void {
    if (result === 'LOCKED') this.aiLockedDoors.add(doorId);
  }

  /** Add time only for a successful Human player action against a tracked AI lock. */
  onHumanPlayerUnlock(doorId: string, result: string): boolean {
    if (!this.aiLockedDoors.has(doorId) ||
        (result !== 'UNLOCKED' && result !== 'FORCE_OPENED')) return false;
    this.aiLockedDoors.delete(doorId);
    this._remainingMs += this.durationMs;
    return true;
  }

  advance(deltaMs: number): void {
    this._remainingMs = Math.max(0, this._remainingMs - Math.max(0, deltaMs));
  }

  reset(): void {
    this._remainingMs = 0;
    this.aiLockedDoors.clear();
  }
}
