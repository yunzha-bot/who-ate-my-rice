import { GAME_CONFIG as C } from '../config/gameConfig.ts';
import type { Difficulty } from '../config/difficultyConfig.ts';
import { ThrowableSystem, type ThrowActor, type ThrowPoint, type ThrowTrace } from './ThrowableSystem.ts';

/** Opportunistic throws only. Positions are supplied only after the host's real vision check.
 * Uses the throwable gameplay clock; does not own navigation, movement or hit adjudication. */
export class AIThrowableController {
  private readonly random: () => number;
  private nextPickupAt = 0;
  private nextThrowAt = 0;
  private aim: { point: ThrowPoint; target: ThrowPoint; error: ThrowPoint; startedAt: number; readyAt: number } | null = null;
  heading: number | undefined;

  constructor(random: () => number = Math.random) { this.random = random; }

  update(system: ThrowableSystem, actor: ThrowActor, visibleTarget: ThrowPoint | null,
    difficulty: Difficulty, trace: ThrowTrace): { started: boolean; thrown: boolean } | null {
    this.heading = undefined;
    if (!system.config.enabled || !actor.canAct || actor.hidden || system.isStunned(actor.faction)) {
      this.cancel(); return null;
    }
    const now = system.nowMs, config = C.throwableAI, profile = config[difficulty];
    const maxTargetDistance = difficulty === 'HARD' ? config.HARD.maxTargetDistance : config.maxTargetDistance;
    if (!system.held(actor.faction) && now >= this.nextPickupAt) {
      this.nextPickupAt = now + config.pickupScanMs;
      system.pickup(actor, trace);
    }
    const distance = visibleTarget ? Math.hypot(visibleTarget.x - actor.x, visibleTarget.z - actor.z) : Infinity;
    if (!system.held(actor.faction) || !visibleTarget || distance < config.minTargetDistance ||
        distance > maxTargetDistance || now < this.nextThrowAt ||
        trace(actor, visibleTarget, system.config.projectileRadius) !== null) {
      this.cancel(); return null;
    }
    const started = !this.aim;
    if (!this.aim) {
      const angle = this.random() * Math.PI * 2;
      const radius = Math.sqrt(this.random()) * profile.aimErrorRadius;
      const error = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
      this.aim = { point: { x: visibleTarget.x + error.x, z: visibleTarget.z + error.z },
        target: { x: visibleTarget.x, z: visibleTarget.z }, error, startedAt: now,
        readyAt: now + profile.windupMs };
    }
    // The actor also moves during windup. Refresh once at release so the old
    // ground point cannot end up at its feet; retain the same error, with no homing.
    const point = now < this.aim.readyAt ? this.aim.point : {
      x: visibleTarget.x + this.aim.error.x, z: visibleTarget.z + this.aim.error.z };
    if (difficulty === 'HARD' && now >= this.aim.readyAt && now > this.aim.startedAt) {
      const hard = config.HARD;
      const horizon = Math.min(hard.leadTimeMs, system.config.flightDurationMs);
      const factor = horizon / (now - this.aim.startedAt);
      const dx = (visibleTarget.x - this.aim.target.x) * factor;
      const dz = (visibleTarget.z - this.aim.target.z) * factor;
      const limit = Math.min(1, hard.maxLeadDistance / Math.max(1e-9, Math.hypot(dx, dz)));
      point.x += dx * limit; point.z += dz * limit;
    }
    this.heading = Math.atan2(point.x - actor.x, point.z - actor.z);
    if (now < this.aim.readyAt) return { started, thrown: false };
    const thrown = system.throw(actor, point, trace);
    this.aim = null;
    this.nextThrowAt = now + (thrown ? profile.intervalMs : config.pickupScanMs);
    return { started, thrown };
  }

  cancel(): void { this.aim = null; this.heading = undefined; }
  reset(): void { this.cancel(); this.nextPickupAt = this.nextThrowAt = 0; }
}
