import { GAME_CONFIG } from '../config/gameConfig.ts';
import { segmentCircleEntry, type ThrowPoint, type ThrowTrace } from './ThrowableSystem.ts';

export type NetPlacementCheck = (point: ThrowPoint) => boolean;
export interface CaptureNet extends ThrowPoint { ageMs: number }

/** AI policy receives only an already-visible target and its own route direction. */
export function humanNetPlacement(human: ThrowPoint, visibleTarget: ThrowPoint | null,
  direction: ThrowPoint): ThrowPoint | null {
  const c = GAME_CONFIG.captureNet, length = Math.hypot(direction.x, direction.z);
  if (!visibleTarget || length <= 0 ||
      Math.hypot(visibleTarget.x - human.x, visibleTarget.z - human.z) > c.aiThreatRange) return null;
  return { x: human.x + direction.x / length * c.aiPlaceDistance,
    z: human.z + direction.z / length * c.aiPlaceDistance };
}

/** Shared net capacity and one control clock. No DOM, navigation or hidden AI data. */
export class CaptureNetSystem {
  readonly config = GAME_CONFIG.captureNet;
  mode: 'NONE' | 'AIMING' | 'PLACING' = 'NONE';
  pending: ThrowPoint | null = null;
  placementMs = 0;
  cooldownMs = 0;
  readonly nets: CaptureNet[] = [];
  rootMs = 0;
  immunityMs = 0;
  private controlSession = false;
  get remainingSlots(): number { return Math.max(0, this.config.maxActiveNets - this.nets.length); }
  get ready(): boolean { return this.remainingSlots > 0 && this.cooldownMs <= 0; }
  get placing(): boolean { return this.mode === 'PLACING'; }

  beginAim(): boolean {
    if (!this.ready || this.mode !== 'NONE') return false;
    this.mode = 'AIMING'; return true;
  }
  valid(from: ThrowPoint, point: ThrowPoint, trace: ThrowTrace, check: NetPlacementCheck): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.z) &&
      Math.hypot(point.x - from.x, point.z - from.z) <= this.config.placeRange &&
      this.nets.every(net => Math.hypot(point.x - net.x, point.z - net.z) >= this.config.radius * 2) &&
      trace(from, point, this.config.radius) === null && check(point);
  }
  place(from: ThrowPoint, point: ThrowPoint, trace: ThrowTrace, check: NetPlacementCheck): boolean {
    if (!this.ready || this.placing || !this.valid(from, point, trace, check)) return false;
    this.pending = { ...point }; this.placementMs = 0; this.mode = 'PLACING'; return true;
  }
  cancel(): void { this.mode = 'NONE'; this.pending = null; this.placementMs = 0; }

  /** Call only with the host's gameplay delta; pause/help/DEV freeze do not age clocks. */
  advance(deltaMs: number, from: ThrowPoint, canPlace: boolean, trace: ThrowTrace,
    check: NetPlacementCheck, externalControlMs = 0): void {
    const dt = Math.max(0, deltaMs);
    this.cooldownMs = Math.max(0, this.cooldownMs - dt);
    this.rootMs = Math.max(0, this.rootMs - dt);
    this.immunityMs = Math.max(0, this.immunityMs - dt);
    if (this.controlSession && this.rootMs <= 0 && externalControlMs <= 0) {
      this.controlSession = false; this.immunityMs = this.config.immunityMs;
    }
    for (const net of this.nets) net.ageMs += dt;
    if (!this.placing) return;
    if (!canPlace || this.remainingSlots <= 0 || !this.pending || !this.valid(from, this.pending, trace, check)) {
      this.cancel(); return;
    }
    this.placementMs += dt;
    if (this.placementMs >= this.config.placeMs) {
      this.nets.push({ ...this.pending, ageMs: 0 });
      this.cooldownMs = this.config.cooldownMs;
      this.cancel();
    }
  }
  /** Continuous sweep also catches sprinting across the net between frames. */
  trigger(from: ThrowPoint, to: ThrowPoint, hidden: boolean, trace: ThrowTrace): number | null {
    if (this.rootMs > 0 || this.immunityMs > 0 || hidden) return null;
    let first: CaptureNet | null = null, contactTime = Infinity;
    for (const net of this.nets) {
      if (net.ageMs < this.config.armMs) continue;
      const t = segmentCircleEntry(from, to, net, this.config.radius + GAME_CONFIG.collision.playerRadius);
      if (t === null || t >= contactTime) continue;
      const contact = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
      if (trace(from, contact, 0) !== null) continue;
      first = net; contactTime = t;
    }
    if (!first) return null;
    this.destroy(first); this.rootMs = this.config.rootMs; this.controlSession = true;
    return contactTime;
  }
  destroy(net?: CaptureNet): void {
    if (!net) { this.nets.length = 0; return; }
    const index = this.nets.indexOf(net);
    if (index >= 0) this.nets.splice(index, 1);
  }
  reset(): void {
    this.cancel(); this.destroy(); this.rootMs = this.immunityMs = this.cooldownMs = 0;
    this.controlSession = false;
  }
}
