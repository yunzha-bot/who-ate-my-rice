import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { DoorNode } from '../three/map/apartmentMap.ts';

export type DoorStateName = 'OPEN' | 'CLOSED' | 'LOCKED';
export type LockCoreState = 'ACTIVE' | 'DISABLED';
export type DoorActor = 'DEEPSEEK' | 'HUMAN';
export type DoorActionResult =
  | 'OPENED' | 'CLOSED' | 'LOCKED' | 'UNLOCKED' | 'FORCE_OPENED'
  | 'BLOCKED_BY_ACTOR' | 'LOCK_LIMIT_REACHED'
  | 'LOCK_CORE_DISABLED' | 'INVALID_STATE' | 'NOT_ALLOWED' | 'NOT_FOUND';

export interface DoorState {
  id: string;
  nodeId: string;
  state: DoorStateName;
  locked: boolean;
  lockCoreState: LockCoreState;
}

export interface NearbyDoor {
  door: DoorState;
  definition: DoorNode;
  distance: number;
}

export class DoorSystem {
  readonly doors: DoorState[];
  readonly maxActiveLocks: number;
  private readonly definitions = new Map<string, DoorNode>();

  constructor(nodes: readonly DoorNode[], maxActiveLocks: number) {
    this.maxActiveLocks = maxActiveLocks;
    for (const node of nodes) this.definitions.set(node.id, node);
    this.doors = nodes.map(node => ({
      id: node.id,
      nodeId: node.id,
      state: node.initialState,
      locked: false,
      lockCoreState: 'ACTIVE',
    }));
  }

  get activeLockedDoorCount(): number {
    return this.doors.filter(door => door.state === 'LOCKED' && door.locked).length;
  }

  get(id: string): DoorState | undefined {
    return this.doors.find(door => door.id === id);
  }

  definition(id: string): DoorNode | undefined {
    return this.definitions.get(id);
  }

  nearest(x: number, z: number, maxDistance: number,
    accessible: (door: DoorState, definition: DoorNode) => boolean = () => true): NearbyDoor | null {
    let nearest: NearbyDoor | null = null;
    for (const door of this.doors) {
      const definition = this.definitions.get(door.id)!;
      const distance = distanceToDoorSegment(x, z, definition);
      if (distance <= maxDistance && accessible(door, definition) &&
          (!nearest || distance < nearest.distance)) {
        nearest = { door, definition, distance };
      }
    }
    return nearest;
  }

  toggle(id: string, _actor: DoorActor, canClose = true): DoorActionResult {
    const door = this.get(id);
    if (!door) return 'NOT_FOUND';
    if (door.state === 'LOCKED') return 'INVALID_STATE';
    if (door.state === 'CLOSED') {
      door.state = 'OPEN';
      return 'OPENED';
    }
    if (!canClose) return 'BLOCKED_BY_ACTOR';
    door.state = 'CLOSED';
    return 'CLOSED';
  }

  lock(id: string, actor: DoorActor): DoorActionResult {
    const door = this.get(id);
    if (!door) return 'NOT_FOUND';
    if (actor !== 'DEEPSEEK') return 'NOT_ALLOWED';
    if (door.lockCoreState === 'DISABLED') return 'LOCK_CORE_DISABLED';
    if (door.state !== 'CLOSED' || door.locked) return 'INVALID_STATE';
    if (this.activeLockedDoorCount >= this.maxActiveLocks) return 'LOCK_LIMIT_REACHED';
    door.state = 'LOCKED';
    door.locked = true;
    return 'LOCKED';
  }

  disableLock(id: string, actor: DoorActor): DoorActionResult {
    const door = this.get(id);
    if (!door) return 'NOT_FOUND';
    if (actor !== 'HUMAN') return 'NOT_ALLOWED';
    if (door.lockCoreState === 'DISABLED') return 'LOCK_CORE_DISABLED';
    if (door.state !== 'LOCKED' || !door.locked) return 'INVALID_STATE';
    door.lockCoreState = 'DISABLED';
    door.state = 'CLOSED';
    door.locked = false;
    return 'UNLOCKED';
  }

  forceOpen(id: string, actor: DoorActor): DoorActionResult {
    const door = this.get(id);
    if (!door) return 'NOT_FOUND';
    if (actor !== 'HUMAN') return 'NOT_ALLOWED';
    if (door.lockCoreState === 'DISABLED') return 'LOCK_CORE_DISABLED';
    if (door.state !== 'LOCKED' || !door.locked) return 'INVALID_STATE';
    door.lockCoreState = 'DISABLED';
    door.locked = false;
    door.state = 'OPEN';
    return 'FORCE_OPENED';
  }

  reset(): void {
    for (const door of this.doors) {
      const definition = this.definitions.get(door.id)!;
      door.state = definition.initialState;
      door.locked = false;
      door.lockCoreState = 'ACTIVE';
    }
  }
}

export function distanceToDoorSegment(x: number, z: number, door: DoorNode): number {
  const point = nearestPointOnDoorSegment(x, z, door);
  return Math.hypot(x - point.x, z - point.z);
}

export function nearestPointOnDoorSegment(x: number, z: number, door: DoorNode): {
  x: number; z: number;
} {
  const half = door.width / 2;
  const inset = GAME_CONFIG.door.interactionEndInset;
  const nearestX = door.rotation === 0
    ? Math.max(door.x - half + inset, Math.min(x, door.x + half - inset)) : door.x;
  const nearestZ = door.rotation === 0
    ? door.z : Math.max(door.z - half + inset, Math.min(z, door.z + half - inset));
  return { x: nearestX, z: nearestZ };
}

export function doorIntersectsActor(door: DoorNode, actorX: number, actorZ: number,
  actorRadius: number, thickness: number): boolean {
  const halfWidth = door.rotation === 0 ? door.width / 2 : thickness / 2;
  const halfDepth = door.rotation === 0 ? thickness / 2 : door.width / 2;
  const nearestX = Math.max(door.x - halfWidth, Math.min(actorX, door.x + halfWidth));
  const nearestZ = Math.max(door.z - halfDepth, Math.min(actorZ, door.z + halfDepth));
  return Math.hypot(actorX - nearestX, actorZ - nearestZ) < actorRadius;
}
