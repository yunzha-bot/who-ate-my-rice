import { GAME_CONFIG } from '../config/gameConfig.ts';

export type ThrowFaction = 'DEEPSEEK' | 'HUMAN';
export type ThrowableKind = 'VASE' | 'BOX' | 'BASIN';
export interface ThrowPoint { x: number; z: number }
export interface ThrowableSpawn extends ThrowPoint { id: string; roomId: string; kind: ThrowableKind }
export interface ThrowActor extends ThrowPoint { faction: ThrowFaction; hidden: boolean; canAct: boolean }
export interface ThrowableHit extends ThrowPoint { victim: ThrowFaction; kind: ThrowableKind }
export type ThrowTrace = (from: ThrowPoint, to: ThrowPoint, radius: number) => number | null;
export interface ThrowableItem extends ThrowableSpawn {
  state: 'GROUND' | 'HELD' | 'FLIGHT' | 'USED';
  holder: ThrowFaction | null;
  height: number;
  readyAt: number;
  flight: { from: ThrowPoint; to: ThrowPoint; owner: ThrowFaction; elapsed: number } | null;
}

/** First contact on a segment, not a point/click hit test. */
export function segmentCircleEntry(from: ThrowPoint, to: ThrowPoint, center: ThrowPoint,
  radius: number): number | null {
  const x = from.x - center.x, z = from.z - center.z;
  const dx = to.x - from.x, dz = to.z - from.z;
  const c = x * x + z * z - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz, b = 2 * (x * dx + z * dz);
  const discriminant = b * b - 4 * a * c;
  if (a < 1e-12 || discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}

export function flightPosition(from: ThrowPoint, to: ThrowPoint, t: number,
  arcHeight: number): ThrowPoint & { height: number } {
  return { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t,
    height: .75 * (1 - t) + 4 * arcHeight * t * (1 - t) };
}

/** One authority for ownership, flight, reuse, cooldown and projectile stun. */
export class ThrowableSystem {
  readonly items: ThrowableItem[] = [];
  readonly stunRemaining: Record<ThrowFaction, number> = { DEEPSEEK: 0, HUMAN: 0 };
  private readonly readyAt: Record<ThrowFaction, number> = { DEEPSEEK: 0, HUMAN: 0 };
  private readonly previous = new Map<ThrowFaction, ThrowPoint>();
  nowMs = 0;
  private spawns: readonly ThrowableSpawn[];
  readonly config: typeof GAME_CONFIG.throwables;
  constructor(spawns: readonly ThrowableSpawn[], config = GAME_CONFIG.throwables) {
    this.spawns = spawns; this.config = config; this.reset();
  }

  isStunned(faction: ThrowFaction): boolean { return this.stunRemaining[faction] > 0; }
  /** DEV authoring changes initial layout, never revives used/held/flying props. */
  applyLayout(spawns: readonly ThrowableSpawn[]): void {
    this.spawns = spawns.map(p => ({...p}));
    for(const spawn of this.spawns){const item=this.items.find(p=>p.id===spawn.id);
      if(item?.state==='GROUND'){item.x=spawn.x;item.z=spawn.z;item.roomId=spawn.roomId;}}
  }
  held(faction: ThrowFaction): ThrowableItem | undefined {
    return this.items.find(item => item.state === 'HELD' && item.holder === faction);
  }
  nearest(actor: ThrowActor, trace: ThrowTrace): ThrowableItem | undefined {
    if (!this.config.enabled || !actor.canAct || actor.hidden || this.isStunned(actor.faction)) return;
    return this.items.filter(item => item.state === 'GROUND' && item.readyAt <= this.nowMs &&
      Math.hypot(item.x - actor.x, item.z - actor.z) <= this.config.pickupRange &&
      trace(actor, item, 0) === null).sort((a, b) =>
      Math.hypot(a.x - actor.x, a.z - actor.z) - Math.hypot(b.x - actor.x, b.z - actor.z))[0];
  }
  pickup(actor: ThrowActor, trace: ThrowTrace): boolean {
    if (this.held(actor.faction)) return false;
    const item = this.nearest(actor, trace);
    if (!item) return false;
    item.state = 'HELD'; item.holder = actor.faction;
    return true;
  }
  aim(actor: ThrowPoint, requested: ThrowPoint, trace: ThrowTrace) {
    const dx = requested.x - actor.x, dz = requested.z - actor.z, length = Math.hypot(dx, dz);
    const scale = length > this.config.maxThrowDistance ? this.config.maxThrowDistance / length : 1;
    const target = { x: actor.x + dx * scale, z: actor.z + dz * scale };
    const hit = trace(actor, target, this.config.projectileRadius);
    const t = hit === null ? 1 : Math.max(0, hit - .01 / Math.max(.01, length * scale));
    return { point: { x: actor.x + (target.x - actor.x) * t,
      z: actor.z + (target.z - actor.z) * t }, blocked: hit !== null,
      rangeLimited: scale < 1 };
  }
  throw(actor: ThrowActor, requested: ThrowPoint, trace: ThrowTrace): boolean {
    const item = this.held(actor.faction);
    if (!this.config.enabled || !item || !actor.canAct || actor.hidden ||
        this.isStunned(actor.faction) || this.readyAt[actor.faction] > this.nowMs) return false;
    const target = this.aim(actor, requested, trace).point;
    if (Math.hypot(target.x - actor.x, target.z - actor.z) < .05) return false;
    item.state = 'FLIGHT'; item.holder = null; item.x = actor.x; item.z = actor.z;
    item.flight = { from: { x: actor.x, z: actor.z }, to: target, owner: actor.faction, elapsed: 0 };
    item.height = .75;
    this.readyAt[actor.faction] = this.nowMs + this.config.throwCooldownMs;
    return true;
  }
  advance(deltaMs: number, actors: readonly ThrowActor[], trace: ThrowTrace,
    playing = true): ThrowFaction[] {
    if (!playing) return [];
    this.advanceTime(deltaMs);
    return this.advanceFlights(deltaMs, actors, trace);
  }
  /** Host ages control gates first; projectile resolution follows resolved movement. */
  advanceTime(deltaMs: number): void {
    const dt = Math.max(0, deltaMs);
    this.nowMs += dt;
    for (const faction of ['DEEPSEEK', 'HUMAN'] as const)
      this.stunRemaining[faction] = Math.max(0, this.stunRemaining[faction] - dt);
  }
  advanceFlights(deltaMs: number, actors: readonly ThrowActor[], trace: ThrowTrace,
    onHit?: (hit: ThrowableHit) => void): ThrowFaction[] {
    const dt = Math.max(0, deltaMs), hits: ThrowFaction[] = [];
    for (const item of this.items) {
      if (!item.flight || item.state !== 'FLIGHT') continue;
      const flight = item.flight, start = { x: item.x, z: item.z };
      flight.elapsed += dt;
      const progress = Math.min(1, flight.elapsed / this.config.flightDurationMs);
      const end = flightPosition(flight.from, flight.to, progress, this.config.arcHeight);
      const wall = trace(start, end, this.config.projectileRadius);
      let contact = wall ?? 1, victim: ThrowFaction | null = null;
      for (const actor of actors) {
        if (actor.faction === flight.owner || actor.hidden) continue;
        const previous = this.previous.get(actor.faction) ?? actor;
        const t = segmentCircleEntry({ x: start.x - previous.x, z: start.z - previous.z },
          { x: end.x - actor.x, z: end.z - actor.z }, { x: 0, z: 0 },
          GAME_CONFIG.collision.playerRadius + this.config.projectileRadius);
        if (t !== null && t < contact && (wall === null || t < wall)) {
          contact = t; victim = actor.faction;
        }
      }
      item.x = start.x + (end.x - start.x) * contact;
      item.z = start.z + (end.z - start.z) * contact;
      item.height = end.height;
      if (victim || wall !== null || progress >= 1) {
        item.flight = null; item.height = 0;
        item.state = item.kind === 'BASIN' ? 'GROUND' : 'USED';
        item.readyAt = this.nowMs + this.config.pickupDelayAfterLandingMs;
        if (victim) { this.stunRemaining[victim] = this.config.stunDurationMs; hits.push(victim);
          onHit?.({ victim, kind: item.kind, x: item.x, z: item.z }); }
      }
    }
    for (const actor of actors) this.previous.set(actor.faction, { x: actor.x, z: actor.z });
    return hits;
  }
  reset(): void {
    this.items.splice(0, this.items.length, ...this.spawns.map(spawn => ({ ...spawn,
      state: 'GROUND' as const, holder: null, height: 0, readyAt: 0, flight: null })));
    this.nowMs = 0; this.previous.clear();
    for (const faction of ['DEEPSEEK', 'HUMAN'] as const) {
      this.stunRemaining[faction] = 0; this.readyAt[faction] = 0;
    }
  }
}
