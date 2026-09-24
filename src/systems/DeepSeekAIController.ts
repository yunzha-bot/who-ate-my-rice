import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { HeardSound, LastSeen, PerceptionGeometry } from './PerceptionSystem.ts';
import type { SprintState } from './SprintSystem.ts';
import type { NavigationSystem, NavStep } from './NavigationSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';
import type { DoorNode, Point, Room } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';

export type DeepSeekAIState = 'SEEK_RICE' | 'MOVE_TO_RICE' | 'EAT' | 'RESELECT' |
  'EVADE' | 'RECOVER';
export type DeepSeekThreatSource = 'NONE' | 'VISION' | 'SOUND' | 'LAST_SEEN' | 'MEMORY';

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
  visibleHuman?: Point | null;
  heardHuman?: HeardSound | null;
  lastSeenHuman?: LastSeen | null;
  perceptionNowMs?: number;
  geometry?: PerceptionGeometry;
  riceProgressRatio?: number;
  sprintState?: SprintState;
}

export interface DeepSeekAICommand {
  direction: Point;
  openDoorId: string | null;
  eatRiceId: string | null;
  startSprint: boolean;
}

export interface DeepSeekAIPathProgress {
  waypoint: NavStep;
  index: number;
  total: number;
}

export interface EscapeCandidateScore {
  roomId: string;
  score: number;
  routeLength: number;
  exits: number;
  covered: boolean;
  blockedExit: boolean;
  alternateRoute: boolean;
  recentVisitPenalty: number;
}

interface EscapeRoomVisit {
  roomId: string;
  atMs: number;
  separation: number;
}

interface ThreatAssessment {
  source: DeepSeekThreatSource;
  level: 'NONE' | 'CAUTION' | 'HIGH';
  point: Point | null;
  visibleDistance: number | null;
  audibleStrength: number;
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
  lastTransitionReason = 'ROUND_START';
  threatSource: DeepSeekThreatSource = 'NONE';
  threatLevel: 'NONE' | 'CAUTION' | 'HIGH' = 'NONE';
  escapeTarget: Point | null = null;
  escapeRoomId: string | null = null;
  escapeGoalScore: number | null = null;
  escapeCandidateScores: EscapeCandidateScore[] = [];
  lastEscapeSwitchReason = 'NONE';
  lastEscapeDecisionReason = 'NONE';
  noMovementReason = 'NONE';
  currentEscapeRoomId: string | null = null;
  localLoopTriggered = false;
  sprintDecision = 'READY';
  recoveryBlockReason = 'NONE';
  lastResumeTrigger = 'NONE';
  recoverRemainingMs = 0;

  private readonly navigation: NavigationSystem;
  private readonly doorNodes: Map<string, DoorNode>;
  private readonly rooms: readonly Room[];
  private readonly hasRoomGeometry: boolean;
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
  private threatEstimate: Point | null = null;
  private alertRemainingMs = 0;
  private evadeElapsedMs = 0;
  private escapeReplanRemainingMs = 0;
  private escapeGoalHoldRemainingMs = 0;
  private quietMs = 0;
  private previousVisibleDistance: number | null = null;
  private escapeExitThreatened = false;
  private avoidedEscapeRoomId: string | null = null;
  private previousEscapeRoomId: string | null = null;
  private elapsedMs = 0;
  private recentEscapeVisits: EscapeRoomVisit[] = [];
  private loopReplanPending = false;
  private readonly random: () => number;

  constructor(navigation: NavigationSystem, doors: readonly DoorNode[],
    rooms: readonly Room[] = [], random: () => number = Math.random) {
    this.navigation = navigation;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
    this.rooms = rooms;
    this.hasRoomGeometry = rooms.length > 0 && rooms.every(room =>
      Number.isFinite(room.minX) && Number.isFinite(room.maxX) &&
      Number.isFinite(room.minZ) && Number.isFinite(room.maxZ));
    this.random = random;
  }

  getRecentEscapeRooms(): readonly string[] {
    return this.recentEscapeVisits.map(visit => visit.roomId);
  }

  reset(): void {
    this.state = 'SEEK_RICE';
    this.targetRiceId = null;
    this.targetScoreMs = null;
    this.lastSelectionReason = 'ROUND_START';
    this.lastNavigationReason = 'NONE';
    this.lastTransitionReason = 'ROUND_START';
    this.threatSource = 'NONE';
    this.threatLevel = 'NONE';
    this.escapeTarget = null;
    this.escapeRoomId = null;
    this.escapeGoalScore = null;
    this.escapeCandidateScores = [];
    this.lastEscapeSwitchReason = 'NONE';
    this.lastEscapeDecisionReason = 'NONE';
    this.noMovementReason = 'NONE';
    this.currentEscapeRoomId = null;
    this.localLoopTriggered = false;
    this.sprintDecision = 'READY';
    this.recoveryBlockReason = 'NONE';
    this.lastResumeTrigger = 'NONE';
    this.threatEstimate = null;
    this.alertRemainingMs = 0;
    this.evadeElapsedMs = 0;
    this.recoverRemainingMs = 0;
    this.escapeReplanRemainingMs = 0;
    this.escapeGoalHoldRemainingMs = 0;
    this.quietMs = 0;
    this.previousVisibleDistance = null;
    this.escapeExitThreatened = false;
    this.avoidedEscapeRoomId = null;
    this.previousEscapeRoomId = null;
    this.elapsedMs = 0;
    this.recentEscapeVisits = [];
    this.loopReplanPending = false;
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
    this.escapeTarget = null;
    this.escapeRoomId = null;
    this.escapeGoalScore = null;
    this.escapeCandidateScores = [];
    this.escapeExitThreatened = false;
    this.avoidedEscapeRoomId = null;
    this.previousEscapeRoomId = null;
    this.escapeReplanRemainingMs = 0;
    this.escapeGoalHoldRemainingMs = 0;
    this.previousVisibleDistance = null;
    this.stalledRepaths = 0;
    this.resetPathProgress();
    this.lastNavigationReason = 'MANUAL_CONTROL_RELEASED';
  }

  getPathProgress(): DeepSeekAIPathProgress | null {
    const waypoint = this.path[this.pathIndex];
    return !waypoint ? null :
      { waypoint: { ...waypoint }, index: this.pathIndex + 1, total: this.path.length };
  }

  update(input: DeepSeekAIInput): DeepSeekAICommand {
    this.noMovementReason = 'NONE';
    const cfg = GAME_CONFIG.deepseekAI;
    const deltaMs = Math.max(0, input.deltaMs);
    this.elapsedMs += deltaMs;
    this.recentEscapeVisits = this.recentEscapeVisits.filter(visit =>
      this.elapsedMs - visit.atMs < cfg.escapeVisitMemoryMs);
    for (const [id, remaining] of this.avoidedRiceMs) {
      if (remaining <= deltaMs) this.avoidedRiceMs.delete(id);
      else this.avoidedRiceMs.set(id, remaining - deltaMs);
    }
    this.retryRemainingMs = Math.max(0, this.retryRemainingMs - deltaMs);
    this.alertRemainingMs = Math.max(0, this.alertRemainingMs - deltaMs);
    this.escapeReplanRemainingMs = Math.max(0, this.escapeReplanRemainingMs - deltaMs);
    this.escapeGoalHoldRemainingMs = Math.max(0, this.escapeGoalHoldRemainingMs - deltaMs);
    this.trackPathProgress(input.deepseek, deltaMs);

    const signature = input.doors.map(door =>
      `${door.id}:${door.state}:${door.lockCoreState}`).join('|');
    if (signature !== this.doorSignature) {
      this.doorSignature = signature;
      this.path = [];
      this.pathIndex = 0;
      this.retryRemainingMs = 0;
      this.escapeReplanRemainingMs = 0;
      this.lastNavigationReason = 'DOOR_STATE_CHANGED';
    }

    const threat = this.assessThreat(input);
    this.threatSource = threat.source;
    this.threatLevel = threat.level;
    if (threat.point && (threat.source !== 'SOUND' || threat.level === 'HIGH'))
      this.threatEstimate = threat.point;
    // Last Seen and weak sounds are caution, not a fresh sighting. They may
    // remain available while the escape route is already safe.
    this.quietMs = threat.level === 'HIGH' ? 0 : this.quietMs + deltaMs;
    if (threat.level === 'HIGH') {
      this.alertRemainingMs = cfg.alertHoldMs;
      if (this.state !== 'EVADE') this.enterEvade(threat.source);
    } else if (threat.source === 'LAST_SEEN' &&
        this.state === 'EVADE' &&
        input.lastSeenHuman && input.perceptionNowMs !== undefined) {
      const age = input.perceptionNowMs - input.lastSeenHuman.timeMs;
      this.alertRemainingMs = Math.max(this.alertRemainingMs,
        cfg.lastSeenAlertMs - age);
    }
    if (this.state === 'EVADE' || this.state === 'RECOVER')
      return this.updateSafety(input, threat, deltaMs);

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
    return this.followPath(input, target);
  }

  private assessThreat(input: DeepSeekAIInput): ThreatAssessment {
    const cfg = GAME_CONFIG.deepseekAI;
    if (input.visibleHuman) {
      const sightDistance = distance(input.deepseek, input.visibleHuman);
      return { source: 'VISION',
        level: sightDistance <= cfg.visionEvadeDistance ? 'HIGH' : 'CAUTION',
        point: { x: input.visibleHuman.x, z: input.visibleHuman.z },
        visibleDistance: sightDistance, audibleStrength: 0 };
    }
    const heard = input.heardHuman;
    if (heard?.event.sourceFaction === 'HUMAN' && heard.remainingMs > 0 &&
        heard.audibleStrength >= GAME_CONFIG.perception.minimumAudibleStrength) {
      const deltaX = heard.event.position.x - input.deepseek.x;
      const deltaZ = heard.event.position.z - input.deepseek.z;
      const sector = Math.round(Math.atan2(deltaZ, deltaX) / (Math.PI / 4));
      const angle = sector * Math.PI / 4;
      // Keep only the eight-way bearing. The hidden Human's exact sound
      // coordinate and distance never enter escape planning.
      const point = { x: input.deepseek.x + Math.cos(angle) * cfg.soundThreatProjection,
        z: input.deepseek.z + Math.sin(angle) * cfg.soundThreatProjection };
      return { source: 'SOUND',
        level: heard.audibleStrength >= cfg.soundEvadeStrength ? 'HIGH' : 'CAUTION',
        point, visibleDistance: null, audibleStrength: heard.audibleStrength };
    }
    if (input.lastSeenHuman && input.perceptionNowMs !== undefined &&
        input.perceptionNowMs - input.lastSeenHuman.timeMs < cfg.lastSeenAlertMs) {
      return { source: 'LAST_SEEN', level: 'CAUTION',
        point: { ...input.lastSeenHuman.position },
        visibleDistance: null, audibleStrength: 0 };
    }
    return { source: 'NONE', level: 'NONE', point: null,
      visibleDistance: null, audibleStrength: 0 };
  }

  private enterEvade(source: DeepSeekThreatSource): void {
    this.state = 'EVADE';
    this.localLoopTriggered = false;
    this.loopReplanPending = false;
    this.lastTransitionReason = 'THREAT_' + source;
    this.path = [];
    this.pathIndex = 0;
    this.escapeTarget = null;
    this.escapeRoomId = null;
    this.escapeGoalScore = null;
    this.escapeCandidateScores = [];
    this.escapeExitThreatened = false;
    this.escapeGoalHoldRemainingMs = 0;
    this.quietMs = 0;
    this.previousVisibleDistance = null;
    this.avoidedEscapeRoomId = null;
    this.previousEscapeRoomId = null;
    this.escapeReplanRemainingMs = 0;
    this.evadeElapsedMs = 0;
    this.recoverRemainingMs = 0;
    this.recoveryBlockReason = 'CURRENT_THREAT';
    this.stalledRepaths = 0;
    this.resetPathProgress();
  }

  private updateSafety(input: DeepSeekAIInput, threat: ThreatAssessment,
    deltaMs: number): DeepSeekAICommand {
    const cfg = GAME_CONFIG.deepseekAI;
    this.recordEscapeRoom(input.deepseek, threat.level === 'HIGH');
    const approachSpeed = threat.visibleDistance !== null &&
      this.previousVisibleDistance !== null && deltaMs > 0
      ? (this.previousVisibleDistance - threat.visibleDistance) * 1000 / deltaMs : 0;
    this.previousVisibleDistance = threat.visibleDistance;
    if (input.sprintState === 'STUNNED') {
      this.sprintDecision = 'STUNNED';
      this.noMovementReason = 'STUNNED';
      this.recoveryBlockReason = 'STUNNED';
      return this.command();
    }
    if (this.state === 'RECOVER') return this.updateRecovery(input, deltaMs);
    this.evadeElapsedMs += deltaMs;
    if (threat.source === 'NONE' && this.alertRemainingMs > 0)
      this.threatSource = 'MEMORY';
    const knownSeparation = this.threatEstimate
      ? distance(input.deepseek, this.threatEstimate) : Infinity;
    const separated = knownSeparation >= cfg.escapeMinSeparation;
    const observationMs = this.threatEstimate
      ? cfg.minimumEvadeMs : cfg.safeObservationMs;
    const reachedEscapeRoom = !!this.escapeTarget &&
      distance(input.deepseek, this.escapeTarget) <= cfg.escapeGoalTolerance;
    const crossingToEscapeRoom = this.hasRoomGeometry && !!this.escapeTarget &&
      !reachedEscapeRoom &&
      this.currentEscapeRoomId !== this.escapeRoomId;
    const readyToRecover = threat.level !== 'HIGH' && separated &&
        this.quietMs >= observationMs &&
        this.evadeElapsedMs >= cfg.minimumEvadeMs &&
        input.sprintState !== 'SPRINT_RUNNING';
    const checkingRiceReturn = this.hasRoomGeometry && readyToRecover &&
      !crossingToEscapeRoom && threat.source !== 'NONE' &&
      this.escapeReplanRemainingMs === 0;
    const unsafeRiceReturn = checkingRiceReturn &&
      !this.hasSafeRiceRoute(input);
    if (readyToRecover && !crossingToEscapeRoom &&
        (!this.hasRoomGeometry || threat.source === 'NONE' || checkingRiceReturn) &&
        !unsafeRiceReturn) {
      return this.beginRecovery(input);
    }
    this.recoveryBlockReason = crossingToEscapeRoom ? 'CROSS_ROOM_ESCAPE_IN_PROGRESS' :
      unsafeRiceReturn ? 'RICE_ROUTE_CROSSES_KNOWN_THREAT' :
      threat.level === 'HIGH' ? 'CURRENT_THREAT' :
      input.sprintState === 'SPRINT_RUNNING' ? 'SPRINT_RUNNING' :
        !separated ? 'LAST_KNOWN_THREAT_NEAR' :
          this.quietMs < observationMs ? 'OBSERVING' : 'MINIMUM_EVADE';
    if (this.escapeTarget && this.threatEstimate &&
        distance(this.escapeTarget, this.threatEstimate) < cfg.escapeMinSeparation &&
        this.escapeReplanRemainingMs === 0) {
      this.avoidedEscapeRoomId = this.escapeRoomId;
      this.escapeTarget = null;
      this.escapeGoalScore = null;
      this.path = [];
      this.pathIndex = 0;
      this.lastNavigationReason = 'ESCAPE_GOAL_UNSAFE';
    }
    const arrivedAtEscapeGoal = reachedEscapeRoom;
    if (arrivedAtEscapeGoal && threat.level === 'HIGH')
      this.escapeGoalHoldRemainingMs = Math.min(this.escapeGoalHoldRemainingMs,
        cfg.escapeReplanMs);
    if (unsafeRiceReturn && arrivedAtEscapeGoal &&
        this.escapeReplanRemainingMs === 0) {
      this.selectEscapeGoal(input, 'RICE_ROUTE_THREATENED', true, true, true);
    } else if (this.loopReplanPending && this.escapeReplanRemainingMs === 0) {
      this.loopReplanPending = false;
      this.selectEscapeGoal(input, 'LOCAL_ROOM_LOOP', true, false, true);
    } else if (arrivedAtEscapeGoal && threat.level === 'HIGH' &&
        this.escapeReplanRemainingMs === 0 && this.escapeGoalHoldRemainingMs === 0)
      this.selectEscapeGoal(input, 'VISIBLE_THREAT_AT_ESCAPE_GOAL', true, true);
    else if (this.escapeReplanRemainingMs === 0 && (!this.escapeTarget || !this.path.length))
      this.selectEscapeGoal(input, this.escapeTarget ? 'ROUTE_INVALID' :
        this.avoidedEscapeRoomId ? 'GOAL_UNSAFE_OR_STALLED' : 'THREAT_INITIAL', true);
    else if (this.escapeReplanRemainingMs === 0 && this.escapeGoalHoldRemainingMs === 0 &&
        threat.visibleDistance !== null &&
        threat.visibleDistance <= cfg.riskySprintDistance)
      this.selectEscapeGoal(input, 'HUMAN_CLOSE_REVIEW');
    if (!this.escapeTarget || !this.path.length) {
      this.sprintDecision = 'NO_SAFE_ROUTE';
      this.noMovementReason = 'NO_REACHABLE_ESCAPE_ROUTE';
      return this.command();
    }
    if (distance(input.deepseek, this.escapeTarget) <= cfg.escapeGoalTolerance) {
      this.sprintDecision = 'HOLD_SAFE_POINT';
      this.noMovementReason = this.escapeCandidateScores.some(candidate =>
        candidate.roomId !== this.escapeRoomId)
        ? 'SHORT_GOAL_HOLD_BEFORE_REPLAN' : 'NO_ALTERNATE_REACHABLE_ROUTE';
      return this.command();
    }
    const movement = this.followPath(input, this.escapeTarget);
    if (movement.openDoorId || (movement.direction.x === 0 && movement.direction.z === 0)) {
      this.sprintDecision = 'WAIT_FOR_ROUTE';
      this.noMovementReason = movement.openDoorId ? 'OPENING_DOOR' : 'PATH_BLOCKED';
      return movement;
    }
    if (input.sprintState === 'SPRINT_RUNNING') {
      this.sprintDecision = 'SPRINT_ACTIVE';
      return movement;
    }
    const risky = (input.riceProgressRatio ?? 0) >= GAME_CONFIG.sprint.riskThreshold;
    const approaching = threat.visibleDistance !== null &&
      approachSpeed >= cfg.approachSpeedThreshold &&
      threat.visibleDistance <= cfg.approachSprintDistance;
    const blockedExitEmergency = this.escapeExitThreatened &&
      threat.visibleDistance !== null &&
      threat.visibleDistance <= cfg.blockedExitSprintDistance;
    const visualEmergency = threat.visibleDistance !== null &&
      threat.visibleDistance <= (risky ? cfg.riskySprintDistance : cfg.safeSprintDistance);
    const soundEmergency = !risky && threat.source === 'SOUND' &&
      threat.audibleStrength >= cfg.sprintSoundStrength;
    if (input.sprintState === 'NORMAL' &&
        (visualEmergency || soundEmergency || approaching || blockedExitEmergency)) {
      movement.startSprint = true;
      this.sprintDecision = blockedExitEmergency ? 'BLOCKED_EXIT_SPRINT' :
        approaching ? 'PURSUER_CLOSING_SPRINT' :
          risky ? 'EMERGENCY_RISK_SPRINT' : 'SAFE_SPRINT';
    } else {
      this.sprintDecision = risky ? 'RISK_SPRINT_HELD' : 'MOVE_WITHOUT_SPRINT';
    }
    return movement;
  }

  private beginRecovery(input: DeepSeekAIInput): DeepSeekAICommand {
    this.state = 'RECOVER';
    this.loopReplanPending = false;
    this.recoverRemainingMs = GAME_CONFIG.deepseekAI.recoverMs;
    this.lastTransitionReason = 'SAFE_SEPARATION_RECOVER';
    this.recoveryBlockReason = 'NONE';
    this.avoidUnsafeRiceRoute(input);
    this.path = [];
    this.pathIndex = 0;
    this.resetPathProgress();
    // The caution interval runs while moving toward a safe rice target,
    // rather than adding a mandatory stationary wait at the escape goal.
    return this.updateRecovery(input, 0);
  }

  private updateRecovery(input: DeepSeekAIInput, deltaMs: number): DeepSeekAICommand {
    this.recoverRemainingMs = Math.max(0, this.recoverRemainingMs - deltaMs);
    const current = input.rice.find(rice => rice.id === this.targetRiceId);
    if (this.targetRiceId && (!current || current.completed ||
        this.avoidedRiceMs.has(this.targetRiceId))) {
      this.clearTarget('RECOVERY_TARGET_INVALID');
      this.state = 'RECOVER';
    }
    if (!this.targetRiceId && this.retryRemainingMs === 0) {
      this.selectRice(input);
      this.state = 'RECOVER';
    }
    const target = input.rice.find(rice => rice.id === this.targetRiceId);
    if (target && !this.path.length) {
      this.path = this.navigation.findPath(input.deepseek, target, input.doors) ?? [];
      this.pathIndex = 0;
      if (!this.path.length) {
        this.avoidedRiceMs.set(target.id, GAME_CONFIG.deepseekAI.retryMs);
        this.clearTarget('RECOVERY_ROUTE_INVALID');
        this.state = 'RECOVER';
      }
    }
    const safeTarget = input.rice.find(rice => rice.id === this.targetRiceId);
    const arrived = !!safeTarget &&
      distance(input.deepseek, safeTarget) <=
        GAME_CONFIG.rice.interactionRange / GAME_CONFIG.three.pixelsPerUnit;
    if (this.recoverRemainingMs === 0 || arrived) {
      this.state = this.targetRiceId ? 'MOVE_TO_RICE' : 'RESELECT';
      this.recoverRemainingMs = 0;
      this.lastTransitionReason = 'THREAT_CLEARED_RESUME_RICE';
      this.lastResumeTrigger = arrived ? 'SAFE_RICE_REACHED' :
        'SAFE_ROUTE_CAUTION_COMPLETE';
      this.recoveryBlockReason = 'NONE';
      this.escapeTarget = null;
      this.escapeRoomId = null;
      this.escapeGoalScore = null;
      this.escapeCandidateScores = [];
      this.escapeExitThreatened = false;
      this.sprintDecision = 'RESUME_RICE';
      return this.command();
    }
    if (safeTarget && this.path.length) {
      this.recoveryBlockReason = 'NONE';
      this.sprintDecision = 'RECOVER_MOVING_TO_RICE';
      return this.followPath(input, safeTarget);
    }
    this.recoveryBlockReason = 'NO_SAFE_RICE_ROUTE';
    this.sprintDecision = 'NO_SAFE_RICE_ROUTE';
    return this.command();
  }

  private avoidUnsafeRiceRoute(input: DeepSeekAIInput): void {
    if (!this.threatEstimate) return;
    for (const rice of input.rice) {
      if (rice.completed) continue;
      const path = this.navigation.findPath(input.deepseek, rice, input.doors);
      const dangerous = distance(rice, this.threatEstimate) <=
        GAME_CONFIG.deepseekAI.dangerRouteRadius ||
        !!path?.some(step => distance(step, this.threatEstimate!) <=
          GAME_CONFIG.deepseekAI.dangerRouteRadius);
      if (dangerous)
        this.avoidedRiceMs.set(rice.id, GAME_CONFIG.deepseekAI.dangerRiceAvoidMs);
    }
    if (this.targetRiceId && this.avoidedRiceMs.has(this.targetRiceId)) {
      this.clearTarget('THREAT_ON_RICE_ROUTE');
      this.retryRemainingMs = 0;
      this.lastTransitionReason = 'DANGEROUS_RICE_ROUTE_RESELECT';
    }
  }

  private hasSafeRiceRoute(input: DeepSeekAIInput): boolean {
    if (!this.threatEstimate) return true;
    const pending = input.rice.filter(rice => !rice.completed);
    if (!pending.length) return true;
    return pending.some(rice => {
      const path = this.navigation.findPath(input.deepseek, rice, input.doors);
      return !!path?.length && distance(rice, this.threatEstimate!) >=
        GAME_CONFIG.deepseekAI.visionEvadeDistance &&
        path.every(step => distance(step, this.threatEstimate!) >=
          GAME_CONFIG.deepseekAI.visionEvadeDistance);
    });
  }

  private recordEscapeRoom(position: Point, highThreat: boolean): void {
    const room = this.rooms.find(candidate =>
      position.x >= candidate.minX && position.x <= candidate.maxX &&
      position.z >= candidate.minZ && position.z <= candidate.maxZ) ??
      this.rooms.find(candidate => candidate.id === this.escapeRoomId &&
        this.escapeTarget && distance(position, this.escapeTarget) <=
          GAME_CONFIG.deepseekAI.escapeGoalTolerance);
    if (!room || room.id === this.currentEscapeRoomId) return;
    this.currentEscapeRoomId = room.id;
    if (!this.threatEstimate) return;
    const visit = { roomId: room.id, atMs: this.elapsedMs,
      separation: distance(position, this.threatEstimate) };
    const earlier = [...this.recentEscapeVisits].reverse()
      .find(item => item.roomId === room.id);
    this.recentEscapeVisits.push(visit);
    this.recentEscapeVisits = this.recentEscapeVisits.slice(
      -GAME_CONFIG.deepseekAI.escapeRecentVisitCount);
    if (highThreat && earlier && this.recentEscapeVisits.length >= 3 &&
        visit.separation < earlier.separation +
          GAME_CONFIG.deepseekAI.escapeLoopMinDistanceGain) {
      this.localLoopTriggered = true;
      this.loopReplanPending = true;
    }
  }

  private recentVisitPenalty(roomId: string): number {
    const cfg = GAME_CONFIG.deepseekAI;
    return this.recentEscapeVisits.filter(visit => visit.roomId === roomId)
      .reduce((sum, visit) => sum + cfg.escapeRecentVisitPenalty *
        (1 - (this.elapsedMs - visit.atMs) / cfg.escapeVisitMemoryMs), 0);
  }

  private selectEscapeGoal(input: DeepSeekAIInput, reason: string, force = false,
    avoidCurrentRoom = false, preferFresh = false): void {
    if (!this.threatEstimate) return;
    this.lastEscapeDecisionReason = reason;
    const cfg = GAME_CONFIG.deepseekAI;
    const candidates = this.rooms.map(room => {
        const goal = this.navigation.nearestFree(room, input.doors);
        if (!goal) return null;
        let path = this.navigation.findPath(input.deepseek, goal, input.doors,
          this.avoidedWaypoint ?? undefined);
        if (!path?.length) return null;
        const separation = distance(goal, this.threatEstimate!);
        const travel = distance(input.deepseek, goal);
        let length = this.pathLength(input.deepseek, path, goal);
        const firstDoorId = path.find(step => step.doorId)?.doorId;
        const firstDoor = firstDoorId ? this.doorNodes.get(firstDoorId) : null;
        let blockedExit = !!firstDoor &&
          distance(firstDoor, this.threatEstimate!) <= cfg.exitBlockRadius;
        let alternateRoute = false;
        if (blockedExit && firstDoorId) {
          const alternative = this.navigation.findPath(input.deepseek, goal,
            input.doors, undefined, null, new Set([firstDoorId]));
          if (alternative?.length && !alternative.some(step => step.doorId === firstDoorId)) {
            const alternateLength = this.pathLength(input.deepseek, alternative, goal);
            if (alternateLength <= length * cfg.alternateRouteMaxRatio) {
              path = alternative;
              length = alternateLength;
              blockedExit = false;
              alternateRoute = true;
            }
          }
        }
        const cover = input.geometry?.inspectVision(this.threatEstimate!, goal,
          GAME_CONFIG.perception.visionRange).status === 'BLOCKED';
        const exits = [...this.doorNodes.values()].filter(door =>
          (door.connectedRoomA === room.id || door.connectedRoomB === room.id) &&
          input.doors.find(state => state.id === door.id)?.state !== 'LOCKED').length;
        const first = path[1] ?? goal;
        const toward = distance(first, this.threatEstimate!) <
          distance(input.deepseek, this.threatEstimate!);
        const nearestThreatOnRoute = Math.min(...path.map(step =>
          distance(step, this.threatEstimate!)));
        const routeRisk = Math.max(0, cfg.dangerRouteRadius - nearestThreatOnRoute);
        const recentVisitPenalty = this.recentVisitPenalty(room.id);
        const score = separation - length * cfg.escapeTravelPenalty +
          (cover ? cfg.escapeCoverBonus : 0) -
          (exits < 2 ? cfg.escapeDeadEndPenalty : 0) -
          (toward ? cfg.escapeTowardThreatPenalty : 0) -
          routeRisk * cfg.escapeRouteThreatPenalty -
          (blockedExit ? cfg.escapeBlockedExitPenalty : 0) +
          Math.max(0, exits - 2) * cfg.escapeExtraExitBonus +
          (alternateRoute ? cfg.escapeAlternateRouteBonus : 0) -
          recentVisitPenalty;
        return { room, goal, path, score, separation, travel, length, exits,
          cover, blockedExit, alternateRoute, recentVisitPenalty };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    this.escapeCandidateScores = candidates.map(candidate => ({
      roomId: candidate.room.id, score: candidate.score,
      routeLength: candidate.length, exits: candidate.exits,
      covered: candidate.cover, blockedExit: candidate.blockedExit,
      alternateRoute: candidate.alternateRoute,
      recentVisitPenalty: candidate.recentVisitPenalty,
    })).sort((a, b) => b.score - a.score || a.roomId.localeCompare(b.roomId));
    const alternatives = candidates.filter(candidate =>
      candidate.room.id !== this.avoidedEscapeRoomId &&
      (!avoidCurrentRoom || candidate.room.id !== this.escapeRoomId));
    const nonBacktracking = avoidCurrentRoom ? alternatives.filter(candidate =>
      candidate.room.id !== this.previousEscapeRoomId) : [];
    const available = nonBacktracking.length ? nonBacktracking :
      alternatives.length ? alternatives : avoidCurrentRoom ? [] : candidates;
    const preferred = available.filter(candidate =>
      candidate.separation >= cfg.escapeMinSeparation &&
      candidate.travel >= cfg.escapeMinTravel);
    const traveling = available.filter(candidate =>
      candidate.travel >= cfg.escapeMinTravel);
    let pool = preferred.length ? preferred : traveling.length ? traveling : available;
    if (preferFresh) {
      const fresh = pool.filter(candidate =>
        candidate.recentVisitPenalty === 0 &&
        candidate.separation >= cfg.escapeMinSeparation &&
        !candidate.blockedExit);
      if (fresh.length) pool = fresh;
    }
    const ranked = [...pool].sort((a, b) => b.score - a.score ||
      a.room.id.localeCompare(b.room.id));
    const nearBest = ranked.length ? ranked.filter(candidate =>
      ranked[0].score - candidate.score <= cfg.escapeNearScoreBand) : [];
    let selected = nearBest[Math.floor(this.random() * nearBest.length)];
    this.escapeReplanRemainingMs = cfg.escapeReplanMs;
    this.avoidedWaypoint = null;
    if (!selected) {
      this.lastNavigationReason = avoidCurrentRoom
        ? 'NO_ALTERNATE_REACHABLE_ESCAPE_ROOM' : 'NO_REACHABLE_ESCAPE_ROOM';
      return;
    }
    const current = candidates.find(candidate => candidate.room.id === this.escapeRoomId);
    if (current && selected.room.id !== current.room.id && !force &&
        selected.score < current.score + cfg.escapeSwitchScoreMargin)
      selected = current;
    if (selected.room.id === this.escapeRoomId && this.path.length) {
      this.escapeGoalScore = selected.score;
      this.escapeExitThreatened = selected.blockedExit;
      this.lastNavigationReason = 'ESCAPE_GOAL_HELD';
      return;
    }
    if (this.escapeRoomId !== selected.room.id)
      this.previousEscapeRoomId = this.escapeRoomId;
    this.escapeTarget = selected.goal;
    this.escapeRoomId = selected.room.id;
    this.escapeGoalScore = selected.score;
    this.escapeExitThreatened = selected.blockedExit;
    this.path = selected.path;
    this.pathIndex = 0;
    this.escapeGoalHoldRemainingMs = cfg.escapeGoalHoldMs;
    this.lastEscapeSwitchReason = reason;
    this.avoidedEscapeRoomId = null;
    this.resetPathProgress();
    this.lastNavigationReason = 'ESCAPE_ROOM_' + selected.room.id;
  }

  private pathLength(start: Point, path: readonly NavStep[], goal: Point): number {
    let length = distance(start, path[0]);
    for (let index = 1; index < path.length; index++)
      length += distance(path[index - 1], path[index]);
    return length + distance(path[path.length - 1], goal);
  }

  private followPath(input: DeepSeekAIInput, goal: Point): DeepSeekAICommand {
    while (this.pathIndex < this.path.length &&
        distance(input.deepseek, this.path[this.pathIndex]) <=
        GAME_CONFIG.deepseekAI.waypointTolerance) this.pathIndex++;
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
    const waypoint = this.path[this.pathIndex] ?? goal;
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
      if (this.state === 'EVADE') {
        if (this.stalledRepaths >= GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget) {
          this.avoidedEscapeRoomId = this.escapeRoomId;
          this.escapeTarget = null;
          this.escapeRoomId = null;
          this.stalledRepaths = 0;
          this.lastNavigationReason = 'ESCAPE_PATH_STALLED_RESELECT';
        } else {
          this.avoidedWaypoint = { x: waypoint.x, z: waypoint.z };
          this.lastNavigationReason = 'ESCAPE_PATH_STALLED_REPATH';
        }
        this.path = [];
        this.pathIndex = 0;
        this.escapeReplanRemainingMs = 0;
        this.resetPathProgress();
        return;
      }
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
    return { direction: { x, z }, openDoorId, eatRiceId, startSprint: false };
  }
}
