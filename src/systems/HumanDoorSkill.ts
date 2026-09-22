import { DoorSystem, type DoorActor, type DoorActionResult } from './DoorSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';

export type HumanDoorSkillResult = DoorActionResult | 'COOLDOWN';

export class HumanDoorSkill {
  cooldownRemainingMs = 0;
  private readonly doors: DoorSystem;
  readonly cooldownMs: number;

  constructor(doors: DoorSystem, cooldownMs: number) {
    this.doors = doors;
    this.cooldownMs = cooldownMs;
  }

  use(doorId: string, actor: DoorActor, phase: GamePhase): HumanDoorSkillResult {
    if (phase !== 'PLAYING' || actor !== 'HUMAN') return 'NOT_ALLOWED';
    const door = this.doors.get(doorId);
    if (!door) return 'NOT_FOUND';
    if (door.state === 'CLOSED') return this.doors.toggle(doorId, actor);
    if (door.state !== 'LOCKED') return 'INVALID_STATE';
    if (this.cooldownRemainingMs > 0) return 'COOLDOWN';
    const result = this.doors.forceOpen(doorId, actor);
    if (result === 'FORCE_OPENED') this.cooldownRemainingMs = this.cooldownMs;
    return result;
  }

  advance(deltaMs: number, phase: GamePhase): void {
    if (phase === 'PLAYING') {
      this.cooldownRemainingMs = Math.max(0, this.cooldownRemainingMs - Math.max(0, deltaMs));
    }
  }

  reset(): void { this.cooldownRemainingMs = 0; }
}
