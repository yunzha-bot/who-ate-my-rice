export type SprintState = 'NORMAL' | 'SPRINT_RUNNING' | 'STUNNED';
export type SprintRiskMode = 'SAFE' | 'FALL_ON_END' | null;
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
  state: SprintState = 'NORMAL';
  riskMode: SprintRiskMode = null;
  sprintRemainingMs = 0;
  stunRemainingMs = 0;
  lastDirection: Direction = STOPPED;

  constructor(durationMs: number, riskThreshold: number, stunMs: number) {
    this.durationMs = durationMs;
    this.riskThreshold = riskThreshold;
    this.stunMs = stunMs;
  }

  tryStart(inputDirection: Direction, globalRiceProgressRatio: number): boolean {
    if (this.state !== 'NORMAL') return false;
    const direction = normalized(inputDirection);
    if (direction === STOPPED) return false;
    this.lastDirection = direction;
    this.riskMode = globalRiceProgressRatio >= this.riskThreshold ? 'FALL_ON_END' : 'SAFE';
    this.sprintRemainingMs = this.durationMs;
    this.state = 'SPRINT_RUNNING';
    return true;
  }

  advance(deltaMs: number, inputDirection: Direction, active = true): void {
    if (!active) return;
    const elapsedMs = Math.max(0, deltaMs);

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
    this.lastDirection = STOPPED;
  }
}
