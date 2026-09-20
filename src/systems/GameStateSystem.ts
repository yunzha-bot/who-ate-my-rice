export type GamePhase = 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
export type MatchWinner = 'DEEPSEEK' | 'HUMAN';
export type MatchReason = 'RICE_COMPLETED' | 'CAPTURED';

export interface GameResult {
  winner: MatchWinner;
  reason: MatchReason;
  elapsedMs: number;
}

export class GameStateSystem {
  private readonly readyMs: number;
  private readonly captureMs: number;
  phase: GamePhase = 'READY';
  elapsedMs = 0;
  captureProgressMs = 0;
  result: GameResult | null = null;
  readyRemainingMs: number;

  constructor(readyMs: number, captureMs: number) {
    this.readyMs = readyMs;
    this.captureMs = captureMs;
    this.readyRemainingMs = readyMs;
  }

  advanceReady(deltaMs: number): void {
    if (this.phase !== 'READY') return;
    this.readyRemainingMs = Math.max(0, this.readyRemainingMs - Math.max(0, deltaMs));
    if (this.readyRemainingMs === 0) this.phase = 'PLAYING';
  }

  advancePlaying(deltaMs: number, inCaptureRange: boolean, riceCompleted: boolean): void {
    if (this.phase !== 'PLAYING') return;
    this.elapsedMs += Math.max(0, deltaMs);

    // S3 temporary rule: completing this one test rice wins. A same-frame tie favors rice.
    if (riceCompleted) {
      this.finish('DEEPSEEK', 'RICE_COMPLETED');
      return;
    }

    this.captureProgressMs = inCaptureRange
      ? Math.min(this.captureMs, this.captureProgressMs + Math.max(0, deltaMs))
      : 0;
    if (this.captureProgressMs >= this.captureMs) {
      this.finish('HUMAN', 'CAPTURED');
    }
  }

  pause(): boolean {
    if (this.phase !== 'PLAYING') return false;
    this.phase = 'PAUSED';
    return true;
  }

  resume(): boolean {
    if (this.phase !== 'PAUSED') return false;
    this.phase = 'PLAYING';
    return true;
  }

  reset(): void {
    this.phase = 'READY';
    this.readyRemainingMs = this.readyMs;
    this.elapsedMs = 0;
    this.captureProgressMs = 0;
    this.result = null;
  }

  private finish(winner: MatchWinner, reason: MatchReason): void {
    this.phase = 'FINISHED';
    this.result = { winner, reason, elapsedMs: this.elapsedMs };
  }
}
