export type SprintState = 'NORMAL' | 'SPRINT_RUNNING' | 'STUNNED';
export type SprintRiskMode = 'SAFE' | 'FALL_ON_END' | null;
/** Skill readiness for DEV/HUD: running, cooling down, ready, or unable to act. */
export type SprintReadiness = 'READY' | 'ACTIVE' | 'COOLDOWN' | 'STUNNED';
export interface Direction { x: number; y: number }

const STOPPED: Direction = { x: 0, y: 0 };

function normalized(direction: Direction): Direction {
  const length = Math.hypot(direction.x, direction.y);
  return length > 0 ? { x: direction.x / length, y: direction.y / length } : STOPPED;
}

export class SprintSystem {
  private readonly durationMs: number;
  private readonly riskThreshold: number;
  private readonly stunMs: number;
  private readonly cooldownMs: number;
  state: SprintState = 'NORMAL';
  riskMode: SprintRiskMode = null;
  sprintRemainingMs = 0;
  stunRemainingMs = 0;
  cooldownRemainingMs = 0;
  lastStartReason = 'NONE';
  lastDirection: Direction = STOPPED;

  constructor(durationMs: number, riskThreshold: number, stunMs: number, cooldownMs = 0) {
    this.durationMs = durationMs;
    this.riskThreshold = riskThreshold;
    this.stunMs = stunMs;
    this.cooldownMs = cooldownMs;
  }

  get readiness(): SprintReadiness {
    if (this.state === 'SPRINT_RUNNING') return 'ACTIVE';
    if (this.state === 'STUNNED') return 'STUNNED';
    return this.cooldownRemainingMs > 0 ? 'COOLDOWN' : 'READY';
  }

  tryStart(inputDirection: Direction, globalRiceProgressRatio: number,
    reason = 'UNSPECIFIED'): boolean {
    if (this.state !== 'NORMAL') return false;
    if (this.cooldownRemainingMs > 0) return false;
    const direction = normalized(inputDirection);
    if (direction === STOPPED) return false;
    this.lastDirection = direction;
    this.lastStartReason = reason;
    this.riskMode = globalRiceProgressRatio >= this.riskThreshold ? 'FALL_ON_END' : 'SAFE';
    this.sprintRemainingMs = this.durationMs;
    this.state = 'SPRINT_RUNNING';
    // The cooldown starts the instant the sprint really begins and keeps ticking
    // through the sprint: the same sprint can never refresh it, and ending a
    // sprint early cannot shorten the wait.
    this.cooldownRemainingMs = this.cooldownMs;
    return true;
  }

  advance(deltaMs: number, inputDirection: Direction, active = true): void {
    if (!active) return;
    const elapsedMs = Math.max(0, deltaMs);
    this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - elapsedMs);

    if (this.state === 'SPRINT_RUNNING') {
      const direction = normalized(inputDirection);
      if (direction !== STOPPED) this.lastDirection = direction;
      this.sprintRemainingMs = Math.max(0, this.sprintRemainingMs - elapsedMs);
      if (this.sprintRemainingMs === 0) {
        if (this.riskMode === 'FALL_ON_END') {
          this.state = 'STUNNED';
          this.stunRemainingMs = this.stunMs;
        } else {
          this.state = 'NORMAL';
          this.riskMode = null;
        }
      }
    } else if (this.state === 'STUNNED') {
      this.stunRemainingMs = Math.max(0, this.stunRemainingMs - elapsedMs);
      if (this.stunRemainingMs === 0) {
        this.state = 'NORMAL';
        this.riskMode = null;
      }
    }
  }

  movementDirection(inputDirection: Direction): Direction {
    if (this.state === 'STUNNED') return STOPPED;
    if (this.state === 'SPRINT_RUNNING') return this.lastDirection;
    return normalized(inputDirection);
  }

  reset(): void {
    this.state = 'NORMAL';
    this.riskMode = null;
    this.sprintRemainingMs = 0;
    this.stunRemainingMs = 0;
    this.cooldownRemainingMs = 0;
    this.lastStartReason = 'NONE';
    this.lastDirection = STOPPED;
  }
}
