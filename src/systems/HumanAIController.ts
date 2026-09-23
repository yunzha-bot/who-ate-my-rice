import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { HeardSound, LastSeen } from './PerceptionSystem.ts';
import { NavigationSystem, type NavStep } from './NavigationSystem.ts';
import type { DoorNode, Point, Room } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';
import type { GamePhase } from './GameStateSystem.ts';

export type HumanAIState = 'PATROL' | 'INVESTIGATE' | 'CHASE' | 'CAPTURE' |
  'SEARCH' | 'CHECK_HIDE'; // CHECK_HIDE stays reserved until S7C.
export type HumanAILockDecision = 'NONE' | 'DETOUR' | 'UNLOCK' | 'FORCE_BREAK';
export interface HumanAIInput {
  deltaMs: number;
  human: Point;
  visibleTarget: Point | null;
  lastSeen: LastSeen | null;
  heard: HeardSound | null;
  captureEligible: boolean;
  doors: readonly DoorState[];
  canOpenDoor: (id: string) => boolean;
  forceBreakCooldownMs?: number;
}
export interface HumanAICommand {
  direction: Point;
  openDoorId: string | null;
  unlockDoorId: string | null;
  forceBreakDoorId: string | null;
}
export interface HumanAIPathProgress {
  waypoint: NavStep;
  index: number;
  total: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

export function humanAiMovementSpeed(baseHumanSpeed: number): number {
  return baseHumanSpeed * GAME_CONFIG.humanAI.movementSpeedMultiplier;
}

export function shouldRunHumanAI(phase: GamePhase, selectedFaction: Faction | null,
  temporaryInputTarget: Faction | null, debugDirection: { x: number; y: number },
  developerControlsEnabled: boolean): boolean {
  return phase === 'PLAYING' && selectedFaction === 'DEEPSEEK' &&
    temporaryInputTarget !== 'HUMAN' &&
    !(developerControlsEnabled && (debugDirection.x !== 0 || debugDirection.y !== 0));
}

export class HumanAIController {
  state: HumanAIState = 'PATROL';
  target: Point | null = null;
  targetRoomId: string | null = null;
  lastTransitionReason = 'ROUND_START';
  lastNavigationReason = 'NONE';
  lockDecision: HumanAILockDecision = 'NONE';
  targetDoorId: string | null = null;
  decisionReason = 'NO_LOCK_ROUTE';
  unlockProgressMs = 0;
  searchTargetRoomId: string | null = null;
  private readonly visitedPatrolRooms = new Set<string>();
  private investigationSource: 'SOUND' | 'LAST_SEEN' | null = null;
  private dwellRemainingMs = 0;
  private handledSound: HeardSound['event'] | null = null;
  private handledLastSeenTime = -1;
  private path: NavStep[] = [];
  private pathIndex = 0;
  private repathRemainingMs = 0;
  private pathDoorSignature = '';
  private lastCommandedMovement = false;
  private stuckMs = 0;
  private progressWaypointKey = '';
  private progressAnchorDistance = Infinity;
  private avoidedWaypoint: Point | null = null;
  private unlockingDoorId: string | null = null;
  private readonly unlockFailures = new Map<string, number>();
  private readonly failedDoorAvoidMs = new Map<string, number>();
  private searchAnchor: Point | null = null;
  private searchTargets: Room[] = [];
  private searchIndex = 0;
  private searchElapsedMs = 0;
  private searchDwellRemainingMs = 0;
  private forceBreakCooldownMs = 0;
  private readonly doorNodes: Map<string, DoorNode>;
  private readonly patrolRooms: Room[];
  private readonly navigation: NavigationSystem;
  private readonly rooms: readonly Room[];
  private readonly random: () => number;

  constructor(navigation: NavigationSystem, rooms: readonly Room[],
    doors: readonly DoorNode[], random: () => number = Math.random) {
    this.navigation = navigation;
    this.rooms = rooms;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
    this.patrolRooms = rooms.filter(room => room.major);
    this.random = random;
  }

  reset(): void {
    this.state = 'PATROL';
    this.target = null;
    this.targetRoomId = null;
    this.lastTransitionReason = 'ROUND_START';
    this.lastNavigationReason = 'NONE';
    this.lockDecision = 'NONE';
    this.targetDoorId = null;
    this.decisionReason = 'NO_LOCK_ROUTE';
    this.unlockProgressMs = 0;
    this.unlockingDoorId = null;
    this.unlockFailures.clear();
    this.failedDoorAvoidMs.clear();
    this.searchAnchor = null;
    this.searchTargets = [];
    this.searchIndex = 0;
    this.searchElapsedMs = 0;
    this.searchDwellRemainingMs = 0;
    this.searchTargetRoomId = null;
    this.forceBreakCooldownMs = 0;
    this.visitedPatrolRooms.clear();
    this.investigationSource = null;
    this.dwellRemainingMs = 0;
    this.handledSound = null;
    this.handledLastSeenTime = -1;
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.pathDoorSignature = '';
    this.lastCommandedMovement = false;
    this.stuckMs = 0;
    this.progressWaypointKey = '';
    this.progressAnchorDistance = Infinity;
    this.avoidedWaypoint = null;
  }

  resumeAfterManualControl(): void {
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.progressWaypointKey = '';
    this.progressAnchorDistance = Infinity;
    this.stuckMs = 0;
    this.avoidedWaypoint = null;
    this.lastCommandedMovement = false;
    this.unlockingDoorId = null;
    this.unlockProgressMs = 0;
  }

  getPathProgress(): HumanAIPathProgress | null {
    const waypoint = this.path[this.pathIndex];
    return this.state === 'CAPTURE' || !waypoint ? null
      : { waypoint: { ...waypoint }, index: this.pathIndex + 1, total: this.path.length };
  }

  update(input: HumanAIInput): HumanAICommand {
    const cfg = GAME_CONFIG.humanAI;
    const deltaMs = Math.max(0, input.deltaMs);
    this.forceBreakCooldownMs = input.forceBreakCooldownMs ?? 0;
    for (const [id, remaining] of this.failedDoorAvoidMs) {
      if (remaining <= deltaMs) this.failedDoorAvoidMs.delete(id);
      else this.failedDoorAvoidMs.set(id, remaining - deltaMs);
    }
    this.repathRemainingMs = Math.max(0, this.repathRemainingMs - deltaMs);
    this.trackPathProgress(input.human, deltaMs);

    if (input.visibleTarget) {
      this.investigationSource = null;
      this.searchTargets = [];
      this.searchTargetRoomId = null;
      this.setState(input.captureEligible ? 'CAPTURE' : 'CHASE',
        input.captureEligible ? 'CAPTURE_RANGE' : 'VISION_TARGET');
      this.setTarget(input.visibleTarget, null);
    } else if ((this.state === 'CHASE' || this.state === 'CAPTURE') &&
        input.lastSeen && input.lastSeen.timeMs !== this.handledLastSeenTime) {
      this.handledLastSeenTime = input.lastSeen.timeMs;
      this.setState('INVESTIGATE', 'LOST_SIGHT');
      this.investigationSource = 'LAST_SEEN';
      this.searchAnchor = { ...input.lastSeen.position };
      this.setTarget(input.lastSeen.position, this.roomFor(input.lastSeen.position)?.id ?? null);
      this.dwellRemainingMs = cfg.investigationDwellMs;
    } else if (this.investigationSource !== 'LAST_SEEN' && this.state !== 'SEARCH' &&
        input.heard && input.heard.event !== this.handledSound) {
      this.handledSound = input.heard.event;
      const room = this.roomFor(input.heard.event.position);
      if (room && !(this.state === 'INVESTIGATE' &&
          this.investigationSource === 'SOUND' && this.targetRoomId === room.id)) {
        this.setState('INVESTIGATE', 'SOUND_HEARD');
        this.investigationSource = 'SOUND';
        this.setTarget({ x: room.x, z: room.z }, room.id);
        this.dwellRemainingMs = cfg.investigationDwellMs;
      }
    } else if (this.state === 'CHASE' || this.state === 'CAPTURE') {
      this.setState('PATROL', 'TARGET_LOST');
      this.target = null;
    }

    if (this.state === 'CAPTURE') return this.command(0, 0, null);
    if (this.state === 'SEARCH') {
      this.searchElapsedMs += deltaMs;
      if (this.searchElapsedMs >= cfg.searchMaxMs) this.finishSearch(input);
    }
    if (this.state === 'PATROL' && !this.target) this.choosePatrol(input.human, input.doors);
    if (!this.target) return this.command(0, 0, null);
    const goal = this.navigation.nearestFree(this.target, input.doors);
    if (!goal) return this.unreachable(input);
    if (distance(input.human, goal) <= cfg.waypointTolerance) {
      if (this.state === 'PATROL') {
        if (this.targetRoomId) this.visitedPatrolRooms.add(this.targetRoomId);
        this.choosePatrol(input.human, input.doors);
      } else if (this.state === 'INVESTIGATE') {
        this.dwellRemainingMs -= deltaMs;
        if (this.dwellRemainingMs <= 0) {
          if (this.investigationSource === 'LAST_SEEN') this.beginSearch(input);
          else {
            this.setState('PATROL', 'AREA_SEARCH_COMPLETE');
            this.investigationSource = null;
            this.choosePatrol(input.human, input.doors);
          }
        } else return this.command(0, 0, null);
      } else if (this.state === 'SEARCH') {
        this.searchDwellRemainingMs -= deltaMs;
        if (this.searchDwellRemainingMs <= 0) this.advanceSearch(input);
        else return this.command(0, 0, null);
      }
    }
    if (!this.target) return this.command(0, 0, null);
    const signature = input.doors.map(door =>
      `${door.id}:${door.state}:${door.lockCoreState}`).join('|') +
      `:${(input.forceBreakCooldownMs ?? 0) > 0}:${[...this.failedDoorAvoidMs.keys()].join(',')}`;
    if (!this.path.length || this.repathRemainingMs === 0 ||
        signature !== this.pathDoorSignature) {
      if (signature !== this.pathDoorSignature && this.pathDoorSignature)
        this.lastNavigationReason = 'DOOR_OR_SKILL_STATE_CHANGED';
      this.path = this.chooseRoute(input, this.target, this.avoidedWaypoint ?? undefined);
      if (!this.path.length && this.avoidedWaypoint)
        this.path = this.chooseRoute(input, this.target);
      this.avoidedWaypoint = null;
      this.pathIndex = 0;
      this.pathDoorSignature = signature;
      this.repathRemainingMs = cfg.repathIntervalMs;
      if (!this.path.length) return this.unreachable(input);
    }
    while (this.pathIndex < this.path.length &&
        distance(input.human, this.path[this.pathIndex]) <= cfg.waypointTolerance) {
      this.pathIndex++;
    }
    // Act only on the first door on the route; the physical collider always stays authoritative.
    for (let index = this.pathIndex; index < this.path.length; index++) {
      const id = this.path[index].doorId;
      const door = input.doors.find(candidate => candidate.id === id);
      if (!id || !door || door.state === 'OPEN') continue;
      const node = this.doorNodes.get(id)!;
      if (distanceToDoorSegment(input.human.x, input.human.z, node) <=
          GAME_CONFIG.door.interactionRange && input.canOpenDoor(id)) {
        if (door.state === 'CLOSED') return this.command(0, 0, id);
        if (this.lockDecision === 'FORCE_BREAK' &&
            (input.forceBreakCooldownMs ?? 0) <= 0) return this.command(0, 0, null, null, id);
        if (this.lockDecision === 'UNLOCK') return this.updateUnlock(id, deltaMs, input);
        this.repathRemainingMs = 0;
        return this.command(0, 0, null);
      }
      break;
    }
    const waypoint = this.path[this.pathIndex] ?? goal;
    const dx = waypoint.x - input.human.x;
    const dz = waypoint.z - input.human.z;
    const length = Math.hypot(dx, dz);
    return length > 0 ? this.command(dx / length, dz / length, null)
      : this.command(0, 0, null);
  }

  private roomFor(point: Point): Room | null {
    return this.rooms.find(room => point.x >= room.minX && point.x <= room.maxX &&
      point.z >= room.minZ && point.z <= room.maxZ) ?? null;
  }

  private choosePatrol(human: Point, doors: readonly DoorState[]): void {
    if (!this.patrolRooms.length) return;
    if (this.visitedPatrolRooms.size === this.patrolRooms.length)
      this.visitedPatrolRooms.clear();
    const blocked = new Set([...this.failedDoorAvoidMs.keys()]);
    if (this.forceBreakCooldownMs > 0) {
      for (const door of doors) {
        if (door.state === 'LOCKED' &&
            (this.unlockFailures.get(door.id) ?? 0) >=
              GAME_CONFIG.humanAI.aiUnlockMaxAttempts) blocked.add(door.id);
      }
    }
    const reachable = (unvisitedOnly: boolean): { room: Room; path: NavStep[] | null }[] =>
      this.patrolRooms
        .filter(room => !unvisitedOnly || !this.visitedPatrolRooms.has(room.id))
        .map(room => ({ room, path: this.navigation.findPath(human, room, doors) ??
          this.navigation.findPath(human, room, doors, undefined, 0, blocked) }))
        .filter(candidate => candidate.path !== null)
        .sort((a, b) => a.path!.length - b.path!.length ||
          distance(human, a.room) - distance(human, b.room));
    let candidates = reachable(true);
    // Locked doors can isolate some rooms. Keep visiting reachable rooms until
    // their routes become available, instead of stopping at the end of a cycle.
    if (!candidates.length) {
      this.visitedPatrolRooms.clear();
      candidates = reachable(false);
    }
    if (candidates.length) {
      const room = candidates[0].room;
      this.setTarget({ x: room.x, z: room.z }, room.id);
      return;
    }
    this.target = null;
    this.lastTransitionReason = 'NO_PATROL_ROUTE';
  }

  private unreachable(input: HumanAIInput): HumanAICommand {
    if (this.state === 'SEARCH') {
      this.advanceSearch(input);
      return this.command(0, 0, null);
    }
    if (this.state !== 'PATROL') this.setState('PATROL', 'NO_ROUTE');
    this.lastNavigationReason = 'NO_ROUTE_FALLBACK_PATROL';
    this.target = null;
    this.choosePatrol(input.human, input.doors);
    return this.command(0, 0, null);
  }

  private chooseRoute(input: HumanAIInput, goal: Point, avoid?: Point): NavStep[] {
    const cfg = GAME_CONFIG.humanAI;
    const detour = this.navigation.findPath(input.human, goal, input.doors, avoid);
    if (!input.doors.some(door => door.state === 'LOCKED')) {
      this.unlockingDoorId = null;
      this.unlockProgressMs = 0;
      this.lockDecision = 'NONE';
      this.targetDoorId = null;
      this.decisionReason = 'NO_ACTIVE_LOCK';
      return detour ?? [];
    }
    const blocked = new Set([...this.failedDoorAvoidMs.keys()]);
    for (const door of input.doors) {
      if (door.state === 'LOCKED' &&
          this.unlockFailures.get(door.id)! >= cfg.aiUnlockMaxAttempts &&
          (input.forceBreakCooldownMs ?? 0) > 0) blocked.add(door.id);
    }
    // Planning may cross a lock; actual movement still uses CollisionWorld.
    const throughLock = this.navigation.findPath(input.human, goal, input.doors,
      avoid, 0, blocked);
    const lockedIds = [...new Set(throughLock?.map(step => step.doorId)
      .filter((id): id is string => !!id &&
        input.doors.some(door => door.id === id && door.state === 'LOCKED')) ?? [])];
    const baseHumanSpeed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
      GAME_CONFIG.human.speedMultiplier;
    const speed = humanAiMovementSpeed(baseHumanSpeed);
    const travelMs = (path: NavStep[] | null): number => {
      if (!path) return Infinity;
      let length = distance(input.human, path[0]);
      for (let index = 1; index < path.length; index++)
        length += distance(path[index - 1], path[index]);
      return length / speed * 1000;
    };
    const forceReady = (input.forceBreakCooldownMs ?? 0) <= 0;
    const canUnlock = lockedIds.every(id =>
      (this.unlockFailures.get(id) ?? 0) < cfg.aiUnlockMaxAttempts);
    const actionMs = lockedIds.length * (forceReady
      ? cfg.forceBreakReserveMs
      : canUnlock ? cfg.aiUnlockDurationMs / cfg.aiUnlockSuccessChance : Infinity);
    const lockMs = travelMs(throughLock) + actionMs +
      lockedIds.length * cfg.lockedDoorPathCost * cfg.navCellSize / speed * 1000;
    if (!lockedIds.length || !throughLock ||
        (detour && travelMs(detour) <= lockMs + cfg.detourSlackMs)) {
      this.unlockingDoorId = null;
      this.unlockProgressMs = 0;
      this.lockDecision = detour && lockedIds.length ? 'DETOUR' : 'NONE';
      this.targetDoorId = null;
      this.decisionReason = lockedIds.length ? 'DETOUR_FASTER_OR_SIMILAR' : 'NO_LOCK_ON_ROUTE';
      return detour ?? [];
    }
    if (!Number.isFinite(lockMs)) {
      this.unlockingDoorId = null;
      this.unlockProgressMs = 0;
      this.lockDecision = 'NONE';
      this.targetDoorId = null;
      this.decisionReason = 'LOCK_UNAVAILABLE';
      return detour ?? [];
    }
    const decision = forceReady ? 'FORCE_BREAK' : 'UNLOCK';
    if (this.unlockingDoorId && this.unlockingDoorId !== lockedIds[0])
      this.unlockProgressMs = 0;
    this.unlockingDoorId = lockedIds[0];
    this.lockDecision = decision;
    this.targetDoorId = lockedIds[0];
    this.decisionReason = detour ? 'LOCK_ROUTE_FASTER' : 'ONLY_LOCK_ROUTE';
    return throughLock;
  }

  private updateUnlock(id: string, deltaMs: number,
    input: HumanAIInput): HumanAICommand {
    const cfg = GAME_CONFIG.humanAI;
    if (this.unlockingDoorId !== id) this.unlockProgressMs = 0;
    this.unlockingDoorId = id;
    this.unlockProgressMs = Math.min(cfg.aiUnlockDurationMs,
      this.unlockProgressMs + deltaMs);
    if (this.unlockProgressMs < cfg.aiUnlockDurationMs)
      return this.command(0, 0, null);
    this.unlockProgressMs = 0;
    this.unlockingDoorId = null;
    if (this.random() < cfg.aiUnlockSuccessChance) {
      this.lastNavigationReason = 'AI_UNLOCK_SUCCEEDED';
      this.repathRemainingMs = 0;
      return this.command(0, 0, null, id);
    }
    const attempts = (this.unlockFailures.get(id) ?? 0) + 1;
    this.unlockFailures.set(id, attempts);
    this.failedDoorAvoidMs.set(id, cfg.aiUnlockFailureAvoidMs);
    this.lastNavigationReason = `AI_UNLOCK_FAILED_${attempts}`;
    this.decisionReason = 'UNLOCK_FAILED_REPLAN';
    this.path = [];
    this.repathRemainingMs = 0;
    // A failed attempt never opens the door or changes the match.
    return this.command(0, 0, null);
  }

  private beginSearch(input: HumanAIInput): void {
    const anchor = this.searchAnchor;
    if (!anchor) { this.finishSearch(input); return; }
    const origin = this.roomFor(anchor);
    const neighbors = new Set<string>();
    for (const door of this.doorNodes.values()) {
      if (door.connectedRoomA === origin?.id) neighbors.add(door.connectedRoomB);
      if (door.connectedRoomB === origin?.id) neighbors.add(door.connectedRoomA);
    }
    this.searchTargets = this.rooms
      .filter(room => room.id !== origin?.id &&
        distance(anchor, room) <= GAME_CONFIG.humanAI.searchRadius &&
        (neighbors.has(room.id) || !neighbors.size) &&
        this.navigation.findPath(input.human, room, input.doors) !== null)
      .sort((a, b) => distance(anchor, a) - distance(anchor, b))
      .slice(0, GAME_CONFIG.humanAI.searchRoomCount);
    this.searchIndex = 0;
    this.searchElapsedMs = 0;
    if (!this.searchTargets.length) { this.finishSearch(input); return; }
    this.setState('SEARCH', 'LAST_SEEN_AREA_REACHED');
    this.setSearchTarget();
  }

  private setSearchTarget(): void {
    const room = this.searchTargets[this.searchIndex];
    if (!room) return;
    this.searchTargetRoomId = room.id;
    this.setTarget({ x: room.x, z: room.z }, room.id);
    this.searchDwellRemainingMs = GAME_CONFIG.humanAI.searchDwellMs;
  }

  private advanceSearch(input: HumanAIInput): void {
    this.searchIndex++;
    if (this.searchIndex >= this.searchTargets.length) this.finishSearch(input);
    else this.setSearchTarget();
  }

  private finishSearch(input: HumanAIInput): void {
    this.searchTargets = [];
    this.searchTargetRoomId = null;
    this.investigationSource = null;
    this.setState('PATROL', 'FINITE_SEARCH_COMPLETE');
    this.target = null;
    this.choosePatrol(input.human, input.doors);
  }

  private setTarget(target: Point, roomId: string | null): void {
    if (!this.target || distance(this.target, target) > GAME_CONFIG.humanAI.navCellSize ||
        this.targetRoomId !== roomId) {
      this.repathRemainingMs = 0;
      this.unlockingDoorId = null;
      this.unlockProgressMs = 0;
    }
    this.target = { x: target.x, z: target.z };
    this.targetRoomId = roomId;
  }

  private setState(state: HumanAIState, reason: string): void {
    if (this.state !== state) { this.state = state; this.lastTransitionReason = reason; }
  }

  private command(x: number, z: number, openDoorId: string | null,
    unlockDoorId: string | null = null,
    forceBreakDoorId: string | null = null): HumanAICommand {
    this.lastCommandedMovement = x !== 0 || z !== 0;
    return { direction: { x, z }, openDoorId, unlockDoorId, forceBreakDoorId };
  }

  private trackPathProgress(human: Point, deltaMs: number): void {
    const waypoint = this.path[this.pathIndex];
    if (!this.lastCommandedMovement || !waypoint) {
      this.stuckMs = 0;
      return;
    }
    const key = `${waypoint.x},${waypoint.z}`;
    const remaining = distance(human, waypoint);
    if (key !== this.progressWaypointKey) {
      this.progressWaypointKey = key;
      this.progressAnchorDistance = remaining;
      this.stuckMs = 0;
    } else if (this.progressAnchorDistance - remaining >=
        GAME_CONFIG.humanAI.stuckProgressEpsilon) {
      this.progressAnchorDistance = remaining;
      this.stuckMs = 0;
    } else {
      this.stuckMs += deltaMs;
      if (this.stuckMs >= GAME_CONFIG.humanAI.stuckRepathMs) {
        this.avoidedWaypoint = { x: waypoint.x, z: waypoint.z };
        this.repathRemainingMs = 0;
        this.stuckMs = 0;
        this.lastNavigationReason = 'PATH_STALLED_REPATH';
      }
    }
  }
}
