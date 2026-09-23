import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { HeardSound, LastSeen } from './PerceptionSystem.ts';
import { NavigationSystem, type NavStep } from './NavigationSystem.ts';
import type { DoorNode, Point, Room } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';
import type { GamePhase } from './GameStateSystem.ts';

export type HumanAIState = 'PATROL' | 'INVESTIGATE' | 'CHASE' | 'CAPTURE';
export interface HumanAIInput {
  deltaMs: number;
  human: Point;
  visibleTarget: Point | null;
  lastSeen: LastSeen | null;
  heard: HeardSound | null;
  captureEligible: boolean;
  doors: readonly DoorState[];
  canOpenDoor: (id: string) => boolean;
}
export interface HumanAICommand {
  direction: Point;
  openDoorId: string | null;
}
export interface HumanAIPathProgress {
  waypoint: NavStep;
  index: number;
  total: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

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
  private readonly doorNodes: Map<string, DoorNode>;
  private readonly patrolRooms: Room[];
  private readonly navigation: NavigationSystem;
  private readonly rooms: readonly Room[];

  constructor(navigation: NavigationSystem, rooms: readonly Room[], doors: readonly DoorNode[]) {
    this.navigation = navigation;
    this.rooms = rooms;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
    this.patrolRooms = rooms.filter(room => room.major);
  }

  reset(): void {
    this.state = 'PATROL';
    this.target = null;
    this.targetRoomId = null;
    this.lastTransitionReason = 'ROUND_START';
    this.lastNavigationReason = 'NONE';
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
  }

  getPathProgress(): HumanAIPathProgress | null {
    const waypoint = this.path[this.pathIndex];
    return this.state === 'CAPTURE' || !waypoint ? null
      : { waypoint: { ...waypoint }, index: this.pathIndex + 1, total: this.path.length };
  }

  update(input: HumanAIInput): HumanAICommand {
    const cfg = GAME_CONFIG.humanAI;
    const deltaMs = Math.max(0, input.deltaMs);
    this.repathRemainingMs = Math.max(0, this.repathRemainingMs - deltaMs);
    this.trackPathProgress(input.human, deltaMs);

    if (input.visibleTarget) {
      this.investigationSource = null;
      this.setState(input.captureEligible ? 'CAPTURE' : 'CHASE',
        input.captureEligible ? 'CAPTURE_RANGE' : 'VISION_TARGET');
      this.setTarget(input.visibleTarget, null);
    } else if ((this.state === 'CHASE' || this.state === 'CAPTURE') &&
        input.lastSeen && input.lastSeen.timeMs !== this.handledLastSeenTime) {
      this.handledLastSeenTime = input.lastSeen.timeMs;
      this.setState('INVESTIGATE', 'LOST_SIGHT');
      this.investigationSource = 'LAST_SEEN';
      this.setTarget(input.lastSeen.position, this.roomFor(input.lastSeen.position)?.id ?? null);
      this.dwellRemainingMs = cfg.investigationDwellMs;
    } else if (this.investigationSource !== 'LAST_SEEN' &&
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
          this.setState('PATROL', 'AREA_SEARCH_COMPLETE');
          this.investigationSource = null;
          this.choosePatrol(input.human, input.doors);
        } else return this.command(0, 0, null);
      }
    }
    if (!this.target) return this.command(0, 0, null);
    const signature = input.doors.map(door => `${door.id}:${door.state}`).join('|');
    if (!this.path.length || this.repathRemainingMs === 0 ||
        signature !== this.pathDoorSignature) {
      this.path = this.navigation.findPath(input.human, this.target, input.doors,
        this.avoidedWaypoint ?? undefined) ?? [];
      if (!this.path.length && this.avoidedWaypoint)
        this.path = this.navigation.findPath(input.human, this.target, input.doors) ?? [];
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
    // Open only a door that lies on the chosen route and is reachable from this side.
    for (let index = this.pathIndex; index < this.path.length; index++) {
      const id = this.path[index].doorId;
      if (!id || input.doors.find(door => door.id === id)?.state !== 'CLOSED') continue;
      const node = this.doorNodes.get(id)!;
      if (distanceToDoorSegment(input.human.x, input.human.z, node) <=
          GAME_CONFIG.door.interactionRange && input.canOpenDoor(id)) {
        return this.command(0, 0, id);
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
    const reachable = (unvisitedOnly: boolean): { room: Room; path: NavStep[] | null }[] =>
      this.patrolRooms
        .filter(room => !unvisitedOnly || !this.visitedPatrolRooms.has(room.id))
        .map(room => ({ room, path: this.navigation.findPath(human, room, doors) }))
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
    if (this.state !== 'PATROL') this.setState('PATROL', 'NO_ROUTE');
    this.target = null;
    this.choosePatrol(input.human, input.doors);
    return this.command(0, 0, null);
  }

  private setTarget(target: Point, roomId: string | null): void {
    if (!this.target || distance(this.target, target) > GAME_CONFIG.humanAI.navCellSize ||
        this.targetRoomId !== roomId) this.repathRemainingMs = 0;
    this.target = { x: target.x, z: target.z };
    this.targetRoomId = roomId;
  }

  private setState(state: HumanAIState, reason: string): void {
    if (this.state !== state) { this.state = state; this.lastTransitionReason = reason; }
  }

  private command(x: number, z: number, openDoorId: string | null): HumanAICommand {
    this.lastCommandedMovement = x !== 0 || z !== 0;
    return { direction: { x, z }, openDoorId };
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
