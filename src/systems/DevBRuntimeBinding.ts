import type { RuntimeDebugOverrides } from './RuntimeDebugOverrides.ts';
import { humanAiMovementSpeed } from './HumanAIController.ts';
import { GAME_CONFIG } from '../config/gameConfig.ts';

// DEV-B binding between the in-memory override layer and the systems that must
// react to a change. Keeping it here (instead of inside ThreeGame) means the
// reaction can be tested against the real RuntimeDebugOverrides and the real
// GameStateSystem without a browser.

export interface DevBCaptureProgressHolder {
  captureProgressMs: number;
}

export interface DevBRuntimeBindingHooks {
  /** The live match state whose accumulated progress a new radius invalidates. */
  gameState: DevBCaptureProgressHolder;
  /** Called with the new effective radius so views can follow it. */
  onCaptureRadius: (radius: number) => void;
}

export class DevBRuntimeBinding {
  private readonly runtime: RuntimeDebugOverrides;
  private readonly hooks: DevBRuntimeBindingHooks;
  private unsubscribe: (() => void) | null = null;

  constructor(runtime: RuntimeDebugOverrides, hooks: DevBRuntimeBindingHooks) {
    this.runtime = runtime;
    this.hooks = hooks;
  }

  start(): () => void {
    this.stop();
    this.unsubscribe = this.runtime.subscribe(change => {
      if (!change.ids.includes('capture.radius')) return;
      // Progress accumulated inside the old circle must not leak into the new
      // one: the capture timer restarts from zero.
      this.hooks.gameState.captureProgressMs = 0;
      this.hooks.onCaptureRadius(this.runtime.captureRadius);
    });
    return () => this.stop();
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** A new round / restart drops every temporary override. */
  resetForNewRound(): number {
    return this.runtime.clearAll();
  }
}

/** Effective movement speeds in the pixel units the renderer moves actors in. */
export function effectiveSpeeds(runtime: {
  playerSpeedPx: number; humanSpeedMultiplier: number; humanAIMovementMultiplier: number;
}): { player: number; human: number; humanAi: number } {
  const player = runtime.playerSpeedPx;
  const human = player * runtime.humanSpeedMultiplier;
  return { player, human, humanAi: humanAiMovementSpeed(human, runtime.humanAIMovementMultiplier) };
}

/** Base values DEV-B must never write to. */
export function readOnlyBalanceSnapshot(): Record<string, number> {
  return {
    captureRadius: GAME_CONFIG.match.captureRadius,
    captureMs: GAME_CONFIG.match.captureMs,
    readyMs: GAME_CONFIG.match.readyMs,
    visionRange: GAME_CONFIG.perception.visionRange,
    playerSpeed: GAME_CONFIG.player.speed,
    humanSpeedMultiplier: GAME_CONFIG.human.speedMultiplier,
    humanAiMultiplier: GAME_CONFIG.humanAI.movementSpeedMultiplier,
    sprintDurationMs: GAME_CONFIG.sprint.durationMs,
    sprintCooldownMs: GAME_CONFIG.sprint.cooldownMs,
    playerRadius: GAME_CONFIG.collision.playerRadius,
  };
}
