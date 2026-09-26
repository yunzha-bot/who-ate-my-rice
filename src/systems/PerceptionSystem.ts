import { Camera, Vector3 } from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { Faction } from '../three/LocalControl.ts';
import type { DoorState } from './DoorSystem.ts';
import type { DoorNode, Point, Rect } from '../three/map/apartmentMap.ts';

export type SoundType = keyof typeof GAME_CONFIG.perception.sounds;
export interface SoundEvent {
  type: SoundType;
  position: Point;
  sourceFaction: Faction;
  strength: number;
  timestamp: number;
  lifetimeMs: number;
}
export interface HeardSound {
  event: SoundEvent;
  rawStrength: number;
  distanceFactor: number;
  occlusionMultiplier: number;
  occlusion: string;
  audibleStrength: number;
  direction: string;
  remainingMs: number;
}

// DEV-B runtime tuning seams. Each interface is optional everywhere: without a
// tuning source the systems read GAME_CONFIG exactly as before.
export interface SoundTuning {
  range(type: SoundType): number;
  strength(type: SoundType): number;
  lifetimeMs(type: SoundType): number;
  readonly distanceFalloffPower: number;
  readonly minimumAudibleStrength: number;
}
export interface OcclusionTuning {
  readonly wallSoundFactor: number;
  readonly openDoorSoundFactor: number;
  readonly closedDoorSoundFactor: number;
  readonly lockedDoorSoundFactor: number;
}
export interface VisionTuning {
  readonly visionRange: number;
}

// 2D segment/AABB test; a zero-length or grazing ray is still deterministic.
export function crossesRect(a: Point, b: Point, rect: Pick<Rect, 'x' | 'z' | 'width' | 'depth'>): boolean {
  let enter = 0;
  let exit = 1;
  const clip = (start: number, end: number, min: number, max: number): boolean => {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) return start >= min && start <= max;
    const one = (min - start) / delta;
    const two = (max - start) / delta;
    enter = Math.max(enter, Math.min(one, two));
    exit = Math.min(exit, Math.max(one, two));
    return enter <= exit;
  };
  return clip(a.x, b.x, rect.x - rect.width / 2, rect.x + rect.width / 2) &&
    clip(a.z, b.z, rect.z - rect.depth / 2, rect.z + rect.depth / 2);
}

export class PerceptionGeometry {
  private readonly walls: readonly Rect[];
  private readonly doorNodes: readonly DoorNode[];
  private readonly doorStates: () => readonly DoorState[];
  private readonly tuning: OcclusionTuning | null;

  constructor(walls: readonly Rect[], doorNodes: readonly DoorNode[],
    doorStates: () => readonly DoorState[], tuning: OcclusionTuning | null = null) {
    this.walls = walls;
    this.doorNodes = doorNodes;
    this.doorStates = doorStates;
    this.tuning = tuning;
  }

  crossings(a: Point, b: Point): { walls: number; open: number; closed: number; locked: number } {
    const walls = this.walls.filter(wall => crossesRect(a, b, wall)).length;
    const states = new Map(this.doorStates().map(state => [state.id, state]));
    let open = 0;
    let closed = 0;
    let locked = 0;
    for (const door of this.doorNodes) {
      const state = states.get(door.id)?.state ?? door.initialState;
      const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
      const leaf = { x: door.x, z: door.z,
        width: alongX ? door.width : GAME_CONFIG.door.leafThickness,
        depth: alongX ? GAME_CONFIG.door.leafThickness : door.width };
      if (crossesRect(a, b, leaf)) {
        if (state === 'OPEN') open++;
        else if (state === 'LOCKED') locked++;
        else closed++;
      }
    }
    return { walls, open, closed, locked };
  }

  inspectVision(a: Point, b: Point, maxRange: number): VisionInspection {
    if (Math.hypot(a.x - b.x, a.z - b.z) > maxRange)
      return { status: 'OUT_OF_RANGE', blocker: null };
    if (this.walls.some(wall => crossesRect(a, b, wall)))
      return { status: 'BLOCKED', blocker: 'Wall' };
    const states = new Map(this.doorStates().map(state => [state.id, state.state]));
    for (const door of this.doorNodes) {
      if ((states.get(door.id) ?? door.initialState) === 'OPEN') continue;
      const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
      const leaf = { x: door.x, z: door.z,
        width: alongX ? door.width : GAME_CONFIG.door.leafThickness,
        depth: alongX ? GAME_CONFIG.door.leafThickness : door.width };
      if (crossesRect(a, b, leaf))
        return { status: 'BLOCKED', blocker: door.id };
    }
    return { status: 'VISIBLE', blocker: null };
  }

  visible(a: Point, b: Point, maxRange: number): boolean {
    return this.inspectVision(a, b, maxRange).status === 'VISIBLE';
  }

  soundFactor(a: Point, b: Point): number {
    const hits = this.crossings(a, b);
    const cfg = GAME_CONFIG.perception;
    const tuning = this.tuning;
    const wall = tuning?.wallSoundFactor ?? cfg.wallSoundFactor;
    const open = tuning?.openDoorSoundFactor ?? cfg.openDoorSoundFactor;
    const closed = tuning?.closedDoorSoundFactor ?? cfg.closedDoorSoundFactor;
    const locked = tuning?.lockedDoorSoundFactor ?? cfg.lockedDoorSoundFactor;
    return wall ** hits.walls * open ** hits.open *
      closed ** hits.closed * locked ** hits.locked;
  }
}

// Camera orientation is used only to translate a world-space bearing to the
// same screen axes as WASD. It does not expose exact source coordinates.
export function screenSoundDirection(camera: Camera, listener: Point, source: Point): string {
  const forward = new Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
  const delta = new Vector3(source.x - listener.x, 0, source.z - listener.z);
  if (delta.lengthSq() < 1e-8) return '●';
  const x = delta.dot(right);
  const y = -delta.dot(forward);
  const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][((sector % 8) + 8) % 8];
}

export class SoundEventSystem {
  readonly events: SoundEvent[] = [];
  nowMs = 0;
  private readonly tuning: SoundTuning | null;

  constructor(tuning: SoundTuning | null = null) { this.tuning = tuning; }

  emit(type: SoundType, position: Point, sourceFaction: Faction): SoundEvent {
    const config = GAME_CONFIG.perception.sounds[type];
    const event = { type, position: { x: position.x, z: position.z }, sourceFaction,
      strength: this.tuning?.strength(type) ?? config.strength,
      timestamp: this.nowMs,
      lifetimeMs: this.tuning?.lifetimeMs(type) ?? config.lifetimeMs };
    this.events.push(event);
    return event;
  }

  advance(deltaMs: number): void {
    this.nowMs += Math.max(0, deltaMs);
    for (let index = this.events.length - 1; index >= 0; index--) {
      const event = this.events[index];
      if (this.nowMs - event.timestamp >= event.lifetimeMs) this.events.splice(index, 1);
    }
  }

  heardBy(listener: Point, faction: Faction, camera: Camera,
    geometry: PerceptionGeometry, filter?: (event: SoundEvent) => boolean): HeardSound | null {
    const candidate = this.analyzeBy(listener, faction, camera, geometry, filter);
    const minimum = this.tuning?.minimumAudibleStrength ??
      GAME_CONFIG.perception.minimumAudibleStrength;
    return candidate && candidate.audibleStrength >= minimum ? candidate : null;
  }

  analyzeBy(listener: Point, faction: Faction, camera: Camera,
    geometry: PerceptionGeometry, filter?: (event: SoundEvent) => boolean): HeardSound | null {
    let strongest: HeardSound | null = null;
    for (const event of this.events) {
      if (event.sourceFaction === faction || (filter && !filter(event))) continue;
      const range = this.tuning?.range(event.type) ??
        GAME_CONFIG.perception.sounds[event.type].range;
      const distance = Math.hypot(listener.x - event.position.x, listener.z - event.position.z);
      if (distance >= range) continue;
      const distanceFactor = (1 - distance / range) **
        (this.tuning?.distanceFalloffPower ?? GAME_CONFIG.perception.distanceFalloffPower);
      const hits = geometry.crossings(listener, event.position);
      const occlusionMultiplier = geometry.soundFactor(listener, event.position);
      const audibleStrength = event.strength * distanceFactor * occlusionMultiplier;
      const occlusion = [hits.walls ? `Wall ×${hits.walls}` : '',
        hits.closed ? `CLOSED Door ×${hits.closed}` : '',
        hits.locked ? `LOCKED Door ×${hits.locked}` : '',
        hits.open ? `OPEN Door ×${hits.open}（无额外衰减）` : '']
        .filter(Boolean).join(' + ') || '无遮挡';
      const candidate = { event, rawStrength: event.strength, distanceFactor,
        occlusionMultiplier, occlusion, audibleStrength,
        direction: screenSoundDirection(camera, listener, event.position),
        remainingMs: event.lifetimeMs - (this.nowMs - event.timestamp) };
      if (!strongest || candidate.audibleStrength > strongest.audibleStrength) strongest = candidate;
    }
    return strongest;
  }

  reset(): void { this.events.length = 0; this.nowMs = 0; }
}

export interface RiceTrace {
  id: string;
  position: Point;
  heading: number;
  createdAt: number;
  lifetimeMs: number;
  strength: number;
}
export class RiceTraceSystem {
  readonly traces: RiceTrace[] = [];
  nowMs = 0;
  generationRemainingMs = 0;
  private lastFootprintPosition: Point | null = null;
  private nextId = 1;

  recordProgress(riceId: string, position: Point, previousMs: number, currentMs: number): void {
    if (currentMs <= previousMs) return;
    void riceId;
    this.generationRemainingMs = GAME_CONFIG.perception.traceGenerationMs;
    this.lastFootprintPosition = { x: position.x, z: position.z };
  }

  recordMovement(position: Point): RiceTrace | null {
    if (this.generationRemainingMs <= 0) return null;
    if (!this.lastFootprintPosition) {
      this.lastFootprintPosition = { x: position.x, z: position.z };
      return null;
    }
    const dx = position.x - this.lastFootprintPosition.x;
    const dz = position.z - this.lastFootprintPosition.z;
    if (Math.hypot(dx, dz) < GAME_CONFIG.perception.traceStepDistance) return null;
    const trace: RiceTrace = {
      id: `footprint-${this.nextId++}`,
      position: { x: position.x, z: position.z },
      heading: Math.atan2(dx, dz),
      createdAt: this.nowMs,
      lifetimeMs: GAME_CONFIG.perception.traceLifetimeMs,
      strength: 1,
    };
    this.traces.push(trace);
    this.lastFootprintPosition = { x: position.x, z: position.z };
    return trace;
  }

  advance(deltaMs: number, running = true): void {
    if (!running) return;
    const elapsed = Math.max(0, deltaMs);
    this.nowMs += elapsed;
    this.generationRemainingMs = Math.max(0, this.generationRemainingMs - elapsed);
    for (let index = this.traces.length - 1; index >= 0; index--) {
      const trace = this.traces[index];
      const age = this.nowMs - trace.createdAt;
      if (age >= trace.lifetimeMs) {
        this.traces.splice(index, 1);
        continue;
      }
      const fadeStart = trace.lifetimeMs - GAME_CONFIG.perception.traceFadeMs;
      if (age <= fadeStart) trace.strength = 1;
      else {
        const progress = Math.min(1, Math.max(0,
          (age - fadeStart) / GAME_CONFIG.perception.traceFadeMs));
        const smooth = progress * progress * (3 - 2 * progress);
        trace.strength = 1 - smooth;
      }
    }
  }

  reset(): void {
    this.traces.length = 0;
    this.nowMs = 0;
    this.generationRemainingMs = 0;
    this.lastFootprintPosition = null;
    this.nextId = 1;
  }
}

export interface LastSeen { position: Point; timeMs: number }
export type VisionStatus = 'VISIBLE' | 'BLOCKED' | 'OUT_OF_RANGE';
export interface VisionInspection { status: VisionStatus; blocker: string | null }
export interface VisionState extends VisionInspection { visible: boolean; lastSeen: LastSeen | null }
export class VisionSystem {
  nowMs = 0;
  private readonly tuning: VisionTuning | null;
  private readonly states: Record<Faction, VisionState> = {
    HUMAN: { visible: false, status: 'OUT_OF_RANGE', blocker: null, lastSeen: null },
    DEEPSEEK: { visible: false, status: 'OUT_OF_RANGE', blocker: null, lastSeen: null },
  };

  constructor(tuning: VisionTuning | null = null) { this.tuning = tuning; }

  update(deltaMs: number, human: Point, deepseek: Point, geometry: PerceptionGeometry): void {
    this.nowMs += Math.max(0, deltaMs);
    const range = this.tuning?.visionRange ?? GAME_CONFIG.perception.visionRange;
    const inspection = geometry.inspectVision(human, deepseek, range);
    const visible = inspection.status === 'VISIBLE';
    this.states.HUMAN.visible = visible;
    this.states.DEEPSEEK.visible = visible;
    for (const state of Object.values(this.states)) {
      state.status = inspection.status;
      state.blocker = inspection.blocker;
    }
    if (visible) {
      this.states.HUMAN.lastSeen = { position: { x: deepseek.x, z: deepseek.z }, timeMs: this.nowMs };
      this.states.DEEPSEEK.lastSeen = { position: { x: human.x, z: human.z }, timeMs: this.nowMs };
    } else {
      for (const state of Object.values(this.states)) {
        if (state.lastSeen && this.nowMs - state.lastSeen.timeMs >=
            GAME_CONFIG.perception.lastSeenMs) state.lastSeen = null;
      }
    }
  }

  get(faction: Faction): VisionState { return this.states[faction]; }
  reset(): void {
    this.nowMs = 0;
    for (const state of Object.values(this.states)) {
      state.visible = false;
      state.status = 'OUT_OF_RANGE';
      state.blocker = null;
      state.lastSeen = null;
    }
  }
}
