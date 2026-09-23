import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { NavigationSystem, NavStep } from './NavigationSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';
import type { DoorNode, Point } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';

export type DeepSeekAIState = 'SEEK_RICE' | 'MOVE_TO_RICE' | 'EAT' | 'RESELECT';

export interface DeepSeekAIRice extends Point {
  id: string;
  progressMs: number;
  maxProgressMs: number;
  completed: boolean;
}

export interface DeepSeekAIInput {
  deltaMs: number;
  deepseek: Point;
  rice: readonly DeepSeekAIRice[];
  doors: readonly DoorState[];
  canOpenDoor: (id: string) => boolean;
}

export interface DeepSeekAICommand {
  direction: Point;
  openDoorId: string | null;
  eatRiceId: string | null;
}

export interface DeepSeekAIPathProgress {
  waypoint: NavStep;
  index: number;
  total: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);
const moveSpeed = (): number =>
  GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit;

export function shouldRunDeepSeekAI(phase: GamePhase, selectedFaction: Faction | null,
  temporaryInputTarget: Faction | null, debugDirection: { x: number; y: number },
  developerControlsEnabled: boolean): boolean {
  return phase === 'PLAYING' && selectedFaction === 'HUMAN' &&
    temporaryInputTarget !== 'DEEPSEEK' &&
    !(developerControlsEnabled && (debugDirection.x !== 0 || debugDirection.y !== 0));
}

/** Chooses goals and submits actions; RiceField and CollisionWorld own the rules. */
export class DeepSeekAIController {
  state: DeepSeekAIState = 'SEEK_RICE';
  targetRiceId: string | null = null;
  targetScoreMs: number | null = null;
  lastSelectionReason = 'ROUND_START';
  lastNavigationReason = 'NONE';

  private readonly navigation: NavigationSystem;
  private readonly doorNodes: Map<string, DoorNode>;
  private path: NavStep[] = [];
  private pathIndex = 0;
  private doorSignature = '';
  private retryRemainingMs = 0;
  private readonly avoidedRiceMs = new Map<string, number>();
  private avoidedWaypoint: Point | null = null;
  private stalledMs = 0;
  private stalledRepaths = 0;
  private progressWaypointKey = '';
  private progressAnchorDistance = Infinity;
  private lastCommandedMovement = false;

  constructor(navigation: NavigationSystem, doors: readonly DoorNode[]) {
    this.navigation = navigation;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
  }

  reset(): void {
    this.state = 'SEEK_RICE';
    this.targetRiceId = null;
    this.targetScoreMs = null;
    this.lastSelectionReason = 'ROUND_START';
    this.lastNavigationReason = 'NONE';
    this.path = [];
    this.pathIndex = 0;
    this.doorSignature = '';
    this.retryRemainingMs = 0;
    this.avoidedRiceMs.clear();
    this.avoidedWaypoint = null;
    this.resetPathProgress();
    this.stalledRepaths = 0;
  }

  resumeAfterManualControl(): void {
    this.path = [];
    this.pathIndex = 0;
    this.doorSignature = '';
    this.retryRemainingMs = 0;
    this.avoidedWaypoint = null;
    this.resetPathProgress();
    this.lastNavigationReason = 'MANUAL_CONTROL_RELEASED';
  }

  getPathProgress(): DeepSeekAIPathProgress | null {
    const waypoint = this.path[this.pathIndex];
    return !waypoint ? null :
      { waypoint: { ...waypoint }, index: this.pathIndex + 1, total: this.path.length };
  }

  update(input: DeepSeekAIInput): DeepSeekAICommand {
    const cfg = GAME_CONFIG.deepseekAI;
    const deltaMs = Math.max(0, input.deltaMs);
    for (const [id, remaining] of this.avoidedRiceMs) {
      if (remaining <= deltaMs) this.avoidedRiceMs.delete(id);
      else this.avoidedRiceMs.set(id, remaining - deltaMs);
    }
    this.retryRemainingMs = Math.max(0, this.retryRemainingMs - deltaMs);
    this.trackPathProgress(input.deepseek, deltaMs);

    const signature = input.doors.map(door =>
      `${door.id}:${door.state}:${door.lockCoreState}`).join('|');
    if (signature !== this.doorSignature) {
      this.doorSignature = signature;
      this.path = [];
      this.pathIndex = 0;
      this.retryRemainingMs = 0;
      this.lastNavigationReason = 'DOOR_STATE_CHANGED';
    }

    const current = input.rice.find(rice => rice.id === this.targetRiceId);
    if (this.targetRiceId && (!current || current.completed))
      this.clearTarget('TARGET_COMPLETED_OR_MISSING');

    if (!this.targetRiceId) {
      if (this.state === 'RESELECT' && this.retryRemainingMs > 0)
        return this.command();
      if (!this.selectRice(input)) return this.command();
    }

    const target = input.rice.find(rice => rice.id === this.targetRiceId);
    if (!target) return this.command();
    if (distance(input.deepseek, target) <=
        GAME_CONFIG.rice.interactionRange / GAME_CONFIG.three.pixelsPerUnit) {
      this.state = 'EAT';
      return this.command(0, 0, null, target.id);
    }
    this.state = 'MOVE_TO_RICE';
    if (!this.path.length) {
      this.path = this.navigation.findPath(input.deepseek, target, input.doors,
        this.avoidedWaypoint ?? undefined) ?? [];
      if (!this.path.length && this.avoidedWaypoint)
        this.path = this.navigation.findPath(input.deepseek, target, input.doors) ?? [];
      this.avoidedWaypoint = null;
      this.pathIndex = 0;
      if (!this.path.length) {
        this.avoidedRiceMs.set(target.id, cfg.retryMs);
        this.clearTarget('NO_ROUTE_TO_RICE');
        return this.command();
      }
      this.targetScoreMs = this.score(input.deepseek, target, this.path);
    }
    while (this.pathIndex < this.path.length &&
        distance(input.deepseek, this.path[this.pathIndex]) <= cfg.waypointTolerance)
      this.pathIndex++;

    for (let index = this.pathIndex; index < this.path.length; index++) {
      const id = this.path[index].doorId;
      const door = input.doors.find(candidate => candidate.id === id);
      if (!id || !door || door.state === 'OPEN') continue;
      const node = this.doorNodes.get(id);
      if (door.state === 'LOCKED' || !node) {
        this.path = [];
        this.lastNavigationReason = 'LOCKED_DOOR_REPATH';
        return this.command();
      }
      if (distanceToDoorSegment(input.deepseek.x, input.deepseek.z, node) <=
          GAME_CONFIG.door.interactionRange && input.canOpenDoor(id))
        return this.command(0, 0, id);
      break;
    }
    const waypoint = this.path[this.pathIndex] ?? target;
    const dx = waypoint.x - input.deepseek.x, dz = waypoint.z - input.deepseek.z;
    const length = Math.hypot(dx, dz);
    return length > 0 ? this.command(dx / length, dz / length) : this.command();
  }

  private selectRice(input: DeepSeekAIInput): boolean {
    const candidates = input.rice
      .filter(rice => !rice.completed && !this.avoidedRiceMs.has(rice.id))
      .map(rice => {
        const path = this.navigation.findPath(input.deepseek, rice, input.doors);
        return path?.length ? { rice, path, score: this.score(input.deepseek, rice, path) } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id));
    const selected = candidates[0];
    if (!selected) {
      this.state = 'RESELECT';
      this.retryRemainingMs = GAME_CONFIG.deepseekAI.retryMs;
      this.lastSelectionReason = input.rice.every(rice => rice.completed)
        ? 'ALL_RICE_COMPLETE' : 'NO_REACHABLE_RICE';
      return false;
    }
    this.targetRiceId = selected.rice.id;
    this.targetScoreMs = selected.score;
    this.path = selected.path;
    this.pathIndex = 0;
    this.stalledRepaths = 0;
    this.resetPathProgress();
    this.state = 'MOVE_TO_RICE';
    this.lastSelectionReason = this.lastSelectionReason === 'ROUND_START'
      ? 'LOWEST_ESTIMATED_COMPLETION_TIME'
      : this.lastSelectionReason + ' -> LOWEST_ESTIMATED_COMPLETION_TIME';
    return true;
  }

  private score(start: Point, rice: DeepSeekAIRice, path: readonly NavStep[]): number {
    let length = distance(start, path[0]);
    for (let index = 1; index < path.length; index++)
      length += distance(path[index - 1], path[index]);
    length += distance(path[path.length - 1], rice);
    return length / moveSpeed() * 1000 +
      Math.max(0, rice.maxProgressMs - rice.progressMs) + GAME_CONFIG.rice.prepareMs;
  }

  private trackPathProgress(position: Point, deltaMs: number): void {
    const waypoint = this.path[this.pathIndex];
    if (!this.lastCommandedMovement || !waypoint) {
      this.stalledMs = 0;
      return;
    }
    const key = `${waypoint.x},${waypoint.z}`;
    const remaining = distance(position, waypoint);
    if (key !== this.progressWaypointKey) {
      this.progressWaypointKey = key;
      this.progressAnchorDistance = remaining;
      this.stalledMs = 0;
    } else if (this.progressAnchorDistance - remaining >=
        GAME_CONFIG.deepseekAI.stuckProgressEpsilon) {
      this.progressAnchorDistance = remaining;
      this.stalledMs = 0;
      this.stalledRepaths = 0;
    } else if ((this.stalledMs += deltaMs) >= GAME_CONFIG.deepseekAI.stuckRepathMs) {
      this.stalledRepaths++;
      if (this.stalledRepaths >= GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget &&
          this.targetRiceId) {
        this.avoidedRiceMs.set(this.targetRiceId, GAME_CONFIG.deepseekAI.retryMs);
        this.clearTarget('PATH_STALLED_RESELECT');
      } else {
        this.avoidedWaypoint = { x: waypoint.x, z: waypoint.z };
        this.path = [];
        this.pathIndex = 0;
        this.lastNavigationReason = 'PATH_STALLED_REPATH';
        this.resetPathProgress();
      }
    }
  }

  private clearTarget(reason: string): void {
    this.targetRiceId = null;
    this.targetScoreMs = null;
    this.path = [];
    this.pathIndex = 0;
    this.avoidedWaypoint = null;
    this.resetPathProgress();
    this.state = 'RESELECT';
    this.lastSelectionReason = reason;
  }

  private resetPathProgress(): void {
    this.lastCommandedMovement = false;
    this.stalledMs = 0;
    this.progressWaypointKey = '';
    this.progressAnchorDistance = Infinity;
  }

  private command(x = 0, z = 0, openDoorId: string | null = null,
    eatRiceId: string | null = null): DeepSeekAICommand {
    this.lastCommandedMovement = x !== 0 || z !== 0;
    return { direction: { x, z }, openDoorId, eatRiceId };
  }
}
