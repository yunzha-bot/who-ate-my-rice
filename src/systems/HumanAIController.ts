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
  private patrolIndex = 0;
  private dwellRemainingMs = 0;
  private handledSound: HeardSound['event'] | null = null;
  private handledLastSeenTime = -1;
  private path: NavStep[] = [];
  private pathIndex = 0;
  private repathRemainingMs = 0;
  private pathDoorSignature = '';
  private lastPosition: Point | null = null;
  private lastCommandedMovement = false;
  private stuckMs = 0;
  private readonly doorNodes: Map<string, DoorNode>;
  private readonly patrolPoints: Point[];
  private readonly navigation: NavigationSystem;
  private readonly rooms: readonly Room[];

  constructor(navigation: NavigationSystem, rooms: readonly Room[], doors: readonly DoorNode[]) {
    this.navigation = navigation;
    this.rooms = rooms;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
    this.patrolPoints = rooms.filter(room => room.major).map(room => ({ x: room.x, z: room.z }));
  }

  reset(): void {
    this.state = 'PATROL';
    this.target = null;
    this.targetRoomId = null;
    this.lastTransitionReason = 'ROUND_START';
    this.patrolIndex = 0;
    this.dwellRemainingMs = 0;
    this.handledSound = null;
    this.handledLastSeenTime = -1;
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.pathDoorSignature = '';
    this.lastPosition = null;
    this.lastCommandedMovement = false;
    this.stuckMs = 0;
  }

  update(input: HumanAIInput): HumanAICommand {
    const cfg = GAME_CONFIG.humanAI;
    const deltaMs = Math.max(0, input.deltaMs);
    this.repathRemainingMs = Math.max(0, this.repathRemainingMs - deltaMs);
    if (this.lastPosition && this.lastCommandedMovement &&
        distance(input.human, this.lastPosition) < GAME_CONFIG.collision.contactEpsilon * 10) {
      this.stuckMs += deltaMs;
      if (this.stuckMs >= cfg.stuckRepathMs) {
        this.repathRemainingMs = 0;
        this.stuckMs = 0;
      }
    } else this.stuckMs = 0;
    this.lastPosition = { x: input.human.x, z: input.human.z };

    if (input.visibleTarget) {
      this.setState(input.captureEligible ? 'CAPTURE' : 'CHASE',
        input.captureEligible ? 'CAPTURE_RANGE' : 'VISION_TARGET');
      this.setTarget(input.visibleTarget, null);
    } else if (input.heard && input.heard.event !== this.handledSound) {
      this.handledSound = input.heard.event;
      const room = this.roomFor(input.heard.event.position);
      if (room) {
        this.setState('INVESTIGATE', 'SOUND_HEARD');
        this.setTarget({ x: room.x, z: room.z }, room.id);
        this.dwellRemainingMs = cfg.investigationDwellMs;
      }
    } else if (input.lastSeen && input.lastSeen.timeMs !== this.handledLastSeenTime) {
      this.handledLastSeenTime = input.lastSeen.timeMs;
      this.setState('INVESTIGATE', 'LOST_SIGHT');
      this.setTarget(input.lastSeen.position, this.roomFor(input.lastSeen.position)?.id ?? null);
      this.dwellRemainingMs = cfg.investigationDwellMs;
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
        this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
        this.choosePatrol(input.human, input.doors);
      } else if (this.state === 'INVESTIGATE') {
        this.dwellRemainingMs -= deltaMs;
        if (this.dwellRemainingMs <= 0) {
          this.setState('PATROL', 'AREA_SEARCH_COMPLETE');
          this.choosePatrol(input.human, input.doors);
        } else return this.command(0, 0, null);
      }
    }
    if (!this.target) return this.command(0, 0, null);
    const signature = input.doors.map(door => `${door.id}:${door.state}`).join('|');
    if (!this.path.length || this.repathRemainingMs === 0 ||
        signature !== this.pathDoorSignature) {
      this.path = this.navigation.findPath(input.human, this.target, input.doors) ?? [];
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
    if (!this.patrolPoints.length) return;
    for (let attempts = 0; attempts < this.patrolPoints.length; attempts++) {
      const point = this.patrolPoints[this.patrolIndex];
      if (this.navigation.findPath(human, point, doors)) {
        this.setTarget(point, this.roomFor(point)?.id ?? null);
        return;
      }
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPoints.length;
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
}
