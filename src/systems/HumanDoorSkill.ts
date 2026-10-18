import { GAME_CONFIG } from '../config/gameConfig.ts';
import { DoorSystem, type DoorActor, type DoorActionResult } from './DoorSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';

export type HumanDoorSkillResult = DoorActionResult | 'COOLDOWN';

export class HumanDoorSkill {
  cooldownRemainingMs = 0;
  aiForceBreakProgressMs = 0;
  aiForceBreakDoorId: string | null = null;
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
    if (door.state === 'CLOSED') {
      return GAME_CONFIG.door.humanFreeOpenClosedDoor
        ? this.doors.toggle(doorId, actor) : 'INVALID_STATE';
    }
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

  /** Caller supplies only the AI's current legally interactable locked door. */
  tryAiForceBreak(doorId: string | null, deltaMs: number,
    phase: GamePhase): HumanDoorSkillResult | null {
    if (phase === 'PAUSED') return null;
    if (phase !== 'PLAYING' || !doorId ||
        this.doors.get(doorId)?.state !== 'LOCKED' || this.cooldownRemainingMs > 0) {
      this.cancelAiForceBreak();
      return null;
    }
    if (this.aiForceBreakDoorId !== doorId) {
      this.cancelAiForceBreak();
      this.aiForceBreakDoorId = doorId;
    }
    this.aiForceBreakProgressMs += Math.max(0, deltaMs);
    if (this.aiForceBreakProgressMs < GAME_CONFIG.humanAI.aiForceBreakWindupMs) return null;
    this.cancelAiForceBreak();
    return this.use(doorId, 'HUMAN', phase);
  }

  cancelAiForceBreak(): void {
    this.aiForceBreakDoorId = null;
    this.aiForceBreakProgressMs = 0;
  }

  reset(): void { this.cooldownRemainingMs = 0; this.cancelAiForceBreak(); }
}
