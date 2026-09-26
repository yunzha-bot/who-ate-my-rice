export type GamePhase = 'FACTION_SELECT' | 'READY' | 'PLAYING' | 'PAUSED' | 'FINISHED';
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

  constructor(readyMs: number, captureMs: number, initialPhase: GamePhase = 'READY') {
    this.readyMs = readyMs;
    this.captureMs = captureMs;
    this.readyRemainingMs = readyMs;
    this.phase = initialPhase;
  }

  beginFromFactionSelect(): boolean {
    if (this.phase !== 'FACTION_SELECT') return false;
    this.reset();
    return true;
  }

  returnToFactionSelect(): boolean {
    if (this.phase === 'FACTION_SELECT') return false;
    this.reset();
    this.phase = 'FACTION_SELECT';
    return true;
  }

  advanceReady(deltaMs: number): void {
    if (this.phase !== 'READY') return;
    this.readyRemainingMs = Math.max(0, this.readyRemainingMs - Math.max(0, deltaMs));
    if (this.readyRemainingMs === 0) this.phase = 'PLAYING';
  }

  advancePlaying(deltaMs: number, captureEligible: boolean, riceCompleted: boolean): void {
    if (this.phase !== 'PLAYING') return;
    this.elapsedMs += Math.max(0, deltaMs);

    // The caller supplies true only when all active rice portions are complete.
    // A same-frame tie still favors the rice objective.
    if (riceCompleted) {
      this.finish('DEEPSEEK', 'RICE_COMPLETED');
      return;
    }

    this.captureProgressMs = captureEligible
      ? Math.min(this.captureMs, this.captureProgressMs + Math.max(0, deltaMs))
      : 0;
    if (this.captureProgressMs >= this.captureMs) {
      this.finish('HUMAN', 'CAPTURED');
    }
  }

  /**
   * S7C-1B：一次合法的 Q 搜查命中＝立即抓捕成功（不需要等待常规累计时间）。
   * 它复用同一条结算路径 `finish('HUMAN', 'CAPTURED')`，不新开第二套胜负系统。
   */
  forceCapture(): boolean {
    if (this.phase !== 'PLAYING') return false;
    this.captureProgressMs = this.captureMs;
    this.finish('HUMAN', 'CAPTURED');
    return true;
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
