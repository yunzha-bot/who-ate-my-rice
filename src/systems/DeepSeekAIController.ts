import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { HeardSound, LastSeen, PerceptionGeometry, SoundType } from './PerceptionSystem.ts';
import type { SprintState } from './SprintSystem.ts';
import { distanceToXZSegment, type NavigationSystem, type NavStep } from './NavigationSystem.ts';
import type { GamePhase } from './GameStateSystem.ts';
import type { DoorNode, Point, Room } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';
import type { RuntimeTuning } from './RuntimeDebugOverrides.ts';
import { selectHideSpot, type DeepSeekHideCandidate,
  type DeepSeekHideCandidateResult, type DeepSeekHideMapSnapshot,
  type DeepSeekHideWorld } from './DeepSeekHideCandidates.ts';

export type DeepSeekAIState = 'SEEK_RICE' | 'MOVE_TO_RICE' | 'EAT' | 'RESELECT' |
  'EVADE' | 'RECOVER' | 'SAFE_WAIT' | 'HIDE' |
  'CURIOUS_APPROACH' | 'CURIOUS_OBSERVE' | 'CURIOUS_PASSAGE';

/**
 * S7C-2b：自主藏身的相位。刻意照 Human AI `HumanCheckHidePhase`
 * （`NONE | TRAVEL | DWELL | DONE`）的同构写法：只有一个顶层状态 `HIDE`，
 * 走位 / 藏身 / 退出用相位区分，避免再拆三个顶层状态与新的一套日志。
 */
export type DeepSeekHidePhase = 'NONE' | 'TRAVEL' | 'CONCEALED' | 'EXIT';

export type DeepSeekThreatSource = 'NONE' | 'VISION' | 'SOUND' | 'LAST_SEEN' | 'MEMORY';

/** Only sounds implying motion or forced entry interrupt an authorized trial. */
export function isHumanPursuitSound(type: SoundType): boolean {
  return type === 'FOOTSTEP' || type === 'SPRINT' ||
    type === 'FALL' || type === 'FORCE_BREAK';
}

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
  canCloseDoor?: (id: string) => boolean;
  /** Read-only lock capability supplied by ThreeGame; never a perception source. */
  canLockDoor?: (id: string) => boolean;
  /** Remaining Active Lock slots before a lock command would be rejected. */
  activeLockSlots?: number;
  visibleHuman?: Point | null;
  /** Supplied only while Human is currently visible; never a hidden position. */
  humanStillMs?: number;
  humanStillEventId?: number;
  heardHuman?: HeardSound | null;
  /** Strongest audible pursuit event, even when an ordinary door sound is louder. */
  heardHumanDanger?: HeardSound | null;
  lastSeenHuman?: LastSeen | null;
  perceptionNowMs?: number;
  geometry?: PerceptionGeometry;
  riceProgressRatio?: number;
  sprintState?: SprintState;
  captureProgressMs?: number;
  /**
   * S7C-2b：当前已应用地图的**公开**藏身点快照（含地图代次）。它只有公开地图数据；
   * 任何「某个藏身点里有没有人」的信息都不在这里，AI 侧也读不到。
   */
  hideMap?: DeepSeekHideMapSnapshot | null;
  /** S7C-2b：真实几何接缝（碰撞可站立 / 导航 / 墙体与门叶遮挡）。 */
  hideWorld?: DeepSeekHideWorld | null;
  /** S7C-2b：游戏层本帧签发的**一次性** AI 进入令牌；不回传就不可能进入藏身。 */
  hideRequestToken?: number;
  /**
   * S7C-2b：游戏层给出的**自身**藏身事实（自己是否藏着、藏在哪个点）。这只是玩家
   * 自己也会看到的状态，绝不包含对手位置或任何藏身点的占用情况。
   */
  hideSelf?: { hiding: boolean; spotId: string | null } | null;
}

export interface DeepSeekAICommand {
  direction: Point;
  openDoorId: string | null;
  closeDoorId: string | null;
  lockDoorId: string | null;
  eatRiceId: string | null;
  startSprint: boolean;
  /** S7C-2b：请求进入藏身（游戏层权威复核 + 令牌校验后才能生效）。 */
  hideSpotId: string | null;
  /** S7C-2b：本帧令牌；只有与游戏层本帧签发的值一致才会被接受。 */
  hideRequestToken: number | null;
  /** S7C-2b：请求退出藏身（游戏层复核出口物理安全）。 */
  hideExitRequest: boolean;
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
  curiosityStillMs = 0;
  curiosityCooldownRemainingMs = 0;
  curiosityObserveRemainingMs = 0;
  curiosityRollResult = 'NOT_ELIGIBLE';
  curiosityInterruptReason = 'NONE';
  curiosityTarget: Point | null = null;
  curiosityBypassActive = false;
  passageActive = false;
  /** Read-only diagnostic geometry: only observed/remembered Human positions. */
  safetyDebug = { human: null as Point | null, rice: null as Point | null,
    eat: null as Point | null, observation: null as Point | null,
    defaultPath: [] as Point[], safePath: [] as Point[], reason: 'NOT_EVALUATED' };
  private passageEatPosition: Point | null = null;
  private safeWaitObservation: Point | null = null;
  passageRollResult = 'NOT_ELIGIBLE';
  passageGateReason = 'NOT_EVALUATED';
  passageCancelReason = 'NONE';
  passageRouteSafe = false;
  safeWaitRiceId: string | null = null;
  safeWaitEntryId: string | null = null;
  safeWaitFailureCount = 0;
  safeWaitRemainingMs = 0;
  safeWaitReason = 'NONE';
  doorEscapeCandidateId: string | null = null;
  doorEscapeDistance: number | null = null;
  doorEscapePassed = false;
  doorEscapeHumanOpposite: boolean | null = null;
  doorEscapeRouteSafe = false;
  doorEscapeReason = 'NOT_EVALUATED';
  doorEscapeSkipReason = 'NONE';
  doorEscapeLastResult = 'NONE';
  doorEscapeCooldownRemainingMs = 0;
  doorEscapeLastCrossedId: string | null = null;
  doorEscapeLastCrossedAgeMs: number | null = null;
  doorEscapeDuringSprintCount = 0;
  doorLockDuringSprintCount = 0;
  doorEscapeSelfReopenBlockedCount = 0;
  doorLockRepeatBlockedCount = 0;
  doorLockReason = 'NOT_EVALUATED';
  doorLockLastResult = 'NONE';
  doorLockPendingId: string | null = null;
  doorLockPendingSinceMs: number | null = null;
  doorLockSkipReason = 'NONE';
  doorLockLastCloseId: string | null = null;
  doorEscapeCloseCount = 0;
  doorLockPendingCount = 0;
  doorLockCommandCount = 0;
  doorLockAppliedCount = 0;
  doorLockCancelCount = 0;
  doorLockWindowRemainingMs = 0;
  doorLockUsedEvidence = false;
  doorLockEvidenceDoorId: string | null = null;
  // --- S7C-2b：AI 自主藏身（全部是纯诊断字段，DEV 面板与 AI JSON 用） ---
  hidePhase: DeepSeekHidePhase = 'NONE';
  hideSpotId: string | null = null;
  hideStancePoint: Point | null = null;
  /** 公开理由：为什么进入 / 为什么退回逃跑（不含任何对手真值）。 */
  hideReason = 'NONE';
  hideBlockedReason = 'NONE';
  hideRejectCode = 'NONE';
  hideLastExitReason = 'NONE';
  hideConcealedMs = 0;
  hideRequestCount = 0;
  hideEnterCount = 0;
  hideRejectCount = 0;
  hideExitCount = 0;
  hideAbortCount = 0;
  hideSpotBlockedCount = 0;
  hideConsecutiveCount = 0;
  hideCandidateCount = 0;
  hideCandidateSummary = 'NONE';
  hideCandidateScores: { spotId: string; code: string; score: number | null;
    travelLength: number | null; detail: string }[] = [];
  hideCooldownSummary = 'NONE';
  hideRecentSpotIds: string[] = [];
  hideExitGate = 'NOT_CONCEALED';
  hideTravelLength: number | null = null;

  private navigation: NavigationSystem;
  private readonly doorNodes: Map<string, DoorNode>;
  private readonly rooms: readonly Room[];
  private readonly hasRoomGeometry: boolean;
  private path: NavStep[] = [];
  private pathIndex = 0;
  private doorSignature = '';
  private retryRemainingMs = 0;
  private readonly avoidedRiceMs = new Map<string, number>();
  private readonly dangerousEntryFailures = new Map<string, number>();
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
  private observedHumanStillEventId: number | null = null;
  private curiosityRolledForStillEvent = false;
  private passageRolledForStillEvent = false;
  private passageCheckRemainingMs = 0;
  private readonly lastDoorSide = new Map<string, number>();
  private readonly recentDoorCrossing = new Map<string, number>();
  private readonly closedDoorAt = new Map<string, number>();
  private lastDoorDecision = '';
  private doorEscapeEvents: { type: string; reason: string }[] = [];
  private lastDoorLockDecision = '';
  private doorLockEvidence: { doorId: string; deepseekSide: number } | null = null;
  private doorLockAttemptedId: string | null = null;
  private doorLockEvents: { type: string; reason: string }[] = [];
  // --- S7C-2b 内部状态 ---
  private hideMap: DeepSeekHideMapSnapshot | null = null;
  private hideMapRevision: number | null = null;
  private hideEvaluateRemainingMs = 0;
  private hideRecheckRemainingMs = 0;
  private hideExitRetryRemainingMs = 0;
  private hideEnterPending = false;
  private hidePathStalls = 0;
  // 刻意不叫 hideCooldowns：公开只读方法 `hideCooldowns()` 会取这个名字，
  // 类字段初始化会覆盖同名原型方法，导致运行期「方法不是函数」。
  private readonly hideSpotCooldowns = new Map<string, number>();
  private hideRecentSpots: { spotId: string; atMs: number }[] = [];
  private lastHideProgressRatio = 0;
  private lastHideAbortReason = 'NONE';
  private hideEvents: { type: string; reason: string; spotId: string | null }[] = [];
  private tuning: RuntimeTuning | null = null;

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

  // DEV-B runtime override layer (memory only). Pass null to fall back to the
  // read-only GAME_CONFIG values again.
  setRuntimeTuning(tuning: RuntimeTuning | null): void { this.tuning = tuning; }

  // Effective values: the DEV-B override when present, otherwise GAME_CONFIG.
  private moveSpeed(): number {
    return (this.tuning?.playerSpeedPx ?? GAME_CONFIG.player.speed) /
      GAME_CONFIG.three.pixelsPerUnit;
  }

  private get effectiveCaptureRadius(): number {
    return this.tuning?.captureRadius ?? GAME_CONFIG.match.captureRadius;
  }

  private get effectiveVisionRange(): number {
    return this.tuning?.visionRange ?? GAME_CONFIG.perception.visionRange;
  }

  getRecentEscapeRooms(): readonly string[] {
    return this.recentEscapeVisits.map(visit => visit.roomId);
  }

  // DEV map editor: after a validated map rebuild the shared navigation grid is
  // replaced and cached paths are dropped, so the AI never follows a stale route.
  rebindNavigation(navigation: NavigationSystem): void {
    this.navigation = navigation;
    this.path = [];
    this.pathIndex = 0;
    this.doorSignature = '';
    this.retryRemainingMs = 0;
    this.avoidedWaypoint = null;
    this.stalledMs = 0;
    this.stalledRepaths = 0;
    this.progressWaypointKey = '';
    this.progressAnchorDistance = Infinity;
    this.lastCommandedMovement = false;
    this.lastNavigationReason = 'MAP_REBUILT';
  }

  /**
   * S7C-2b：地图重建后刷新公开藏身快照。`changed` 为真时连当前藏身计划一起作废，
   * 绝不允许 AI 抱着被移动或删除的旧家具位置继续走。
   */
  rebindMap(map: DeepSeekHideMapSnapshot | null, changed = true): void {
    this.hideMap = map;
    this.hideMapRevision = map?.revision ?? null;
    if (changed) this.abortHidePlan('MAP_REBOUND');
  }

  /**
   * S7C-2b：游戏层权威执行的**回执**。回执只给布尔级结果与拒绝码——AI 拿不到
   * 「谁在哪个家具里」这类真值，只能知道自己这次请求成没成。
   */
  onHideResult(spotId: string, result: string): void {
    const cfg = GAME_CONFIG.deepseekAI;
    this.hideEnterPending = false;
    if (result === 'ENTERED') {
      this.hidePhase = 'CONCEALED';
      this.hideSpotId = spotId;
      this.hideConcealedMs = 0;
      this.hideRecheckRemainingMs = cfg.hideRecheckMs;
      this.hideExitRetryRemainingMs = 0;
      this.hideEnterCount++;
      this.hideConsecutiveCount++;
      this.hideReason = 'ENTER_CONFIRMED';
      this.hideBlockedReason = 'NONE';
      this.path = [];
      this.pathIndex = 0;
      this.resetPathProgress();
      this.recordHideEvent('HIDE_AI_ENTERED', spotId, spotId);
      this.recordHideSpotVisit(spotId);
      return;
    }
    if (result === 'EXITED') {
      this.hideLastExitReason = this.hideReason;
      this.hideExitCount++;
      this.recordHideEvent('HIDE_AI_EXITED', this.hideReason, spotId);
      this.setHideCooldown(spotId, cfg.hideReenterCooldownMs, 'REENTER_COOLDOWN');
      this.hidePhase = 'NONE';
      this.hideSpotId = null;
      this.hideStancePoint = null;
      this.hideTravelLength = null;
      this.hideConcealedMs = 0;
      this.enterRecoveryAfterHide();
      return;
    }
    if (result === 'HUMAN_BLOCKING') {
      // 出口被 Human 角色圆压住：退回藏身，等下一次重查，绝不逐帧重发请求。
      this.hidePhase = 'CONCEALED';
      this.hideExitRetryRemainingMs = cfg.hideRecheckMs;
      this.hideRecheckRemainingMs = cfg.hideRecheckMs;
      this.hideReason = 'EXIT_BLOCKED_HUMAN_OVERLAP';
      this.hideRejectCode = 'HUMAN_BLOCKING';
      this.recordHideEvent('HIDE_AI_REJECTED', 'EXIT_HUMAN_BLOCKING', spotId);
      return;
    }
    // 其余全部是进入被拒：写公开失败记忆与冷却，并退回既有逃跑流程。
    this.hideRejectCount++;
    this.hideRejectCode = result;
    this.hideSpotBlockedCount++;
    this.recordHideEvent('HIDE_AI_REJECTED', result, spotId);
    this.recordHideEvent('HIDE_AI_SPOT_BLOCKED', result, spotId);
    this.setHideCooldown(spotId, cfg.hideCandidateFailCooldownMs, `ENTER_REJECTED:${result}`);
    this.abortHidePlan(`ENTER_REJECTED:${result}`);
  }

  /** 局终 / 重开 / 地图应用 / 被搜出时，游戏层强制清空藏身后的通知。 */
  onForcedHideExit(reason: string): void {
    const spotId = this.hideSpotId;
    if (this.hidePhase === 'CONCEALED' || this.hidePhase === 'EXIT') {
      this.hideExitCount++;
      this.hideLastExitReason = reason;
      this.recordHideEvent('HIDE_AI_EXITED', reason, spotId);
      if (spotId) this.setHideCooldown(spotId, GAME_CONFIG.deepseekAI.hideReenterCooldownMs,
        'REENTER_COOLDOWN');
    }
    this.hidePhase = 'NONE';
    this.hideSpotId = null;
    this.hideStancePoint = null;
    this.hideTravelLength = null;
    this.hideConcealedMs = 0;
    this.hideEnterPending = false;
    this.hideRecheckRemainingMs = 0;
    this.hideExitRetryRemainingMs = 0;
    this.path = [];
    this.pathIndex = 0;
    this.resetPathProgress();
    if (this.state === 'HIDE') this.state = 'RESELECT';
  }

  /** S7C-2b：AI 藏身事件（请求 / 进入 / 拒绝 / 退出 / 中止 / 点被封锁）。 */
  drainHideEvents(): { type: string; reason: string; spotId: string | null }[] {
    return this.hideEvents.splice(0, this.hideEvents.length);
  }

  /** 只给 DEV 面板与测试：AI 自己记的失败 / 再进冷却（公开信息，不含占用）。 */
  hideCooldowns(): readonly { spotId: string; remainingMs: number }[] {
    return this.hideCooldownSnapshot();
  }

  reset(): void {
    this.clearHideState();
    this.doorEscapeCandidateId = null;
    this.doorEscapeDistance = null;
    this.doorEscapePassed = false;
    this.doorEscapeHumanOpposite = null;
    this.doorEscapeRouteSafe = false;
    this.doorEscapeReason = 'NOT_EVALUATED';
    this.doorEscapeSkipReason = 'NONE';
    this.doorEscapeLastResult = 'NONE';
    this.doorEscapeCooldownRemainingMs = 0;
    this.doorEscapeLastCrossedId = null;
    this.doorEscapeLastCrossedAgeMs = null;
    this.doorEscapeDuringSprintCount = 0;
    this.doorLockDuringSprintCount = 0;
    this.doorEscapeSelfReopenBlockedCount = 0;
    this.doorLockRepeatBlockedCount = 0;
    this.doorLockAttemptedId = null;
    this.doorLockReason = 'NOT_EVALUATED';
    this.doorLockLastResult = 'NONE';
    this.doorLockPendingId = null;
    this.doorLockPendingSinceMs = null;
    this.doorLockSkipReason = 'NONE';
    this.doorLockLastCloseId = null;
    this.doorEscapeCloseCount = 0;
    this.doorLockPendingCount = 0;
    this.doorLockCommandCount = 0;
    this.doorLockAppliedCount = 0;
    this.doorLockCancelCount = 0;
    this.doorLockWindowRemainingMs = 0;
    this.doorLockUsedEvidence = false;
    this.doorLockEvidenceDoorId = null;
    this.doorLockEvidence = null;
    this.lastDoorSide.clear();
    this.recentDoorCrossing.clear();
    this.closedDoorAt.clear();
    this.lastDoorDecision = '';
    this.doorEscapeEvents = [];
    this.lastDoorLockDecision = '';
    this.doorLockEvents = [];
    this.safeWaitObservation = null;
    this.passageEatPosition = null;
    this.safetyDebug = { human: null, rice: null, eat: null, observation: null,
      defaultPath: [], safePath: [], reason: 'NOT_EVALUATED' };
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
    this.curiosityStillMs = 0;
    this.curiosityCooldownRemainingMs = 0;
    this.curiosityObserveRemainingMs = 0;
    this.curiosityRollResult = 'NOT_ELIGIBLE';
    this.curiosityInterruptReason = 'NONE';
    this.curiosityTarget = null;
    this.curiosityBypassActive = false;
    this.passageActive = false;
    this.passageRollResult = 'NOT_ELIGIBLE';
    this.passageGateReason = 'NOT_EVALUATED';
    this.passageCancelReason = 'NONE';
    this.passageRouteSafe = false;
    this.safeWaitRiceId = null;
    this.safeWaitEntryId = null;
    this.safeWaitFailureCount = 0;
    this.safeWaitRemainingMs = 0;
    this.safeWaitReason = 'NONE';
    this.observedHumanStillEventId = null;
    this.curiosityRolledForStillEvent = false;
    this.passageRolledForStillEvent = false;
    this.passageCheckRemainingMs = 0;
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
    this.dangerousEntryFailures.clear();
    this.avoidedWaypoint = null;
    this.resetPathProgress();
    this.stalledRepaths = 0;
  }

  resumeAfterManualControl(): void {
    this.finishPassage('MANUAL_CONTROL_RELEASED');
    // S7C-2b：人工接管期间角色可能被玩家自己藏起来或带走了，走位中的藏身计划一律
    // 作废；真正的藏身事实由游戏层通过 `hideSelf` 回灌（`syncSelfConcealment`）。
    this.abortHidePlan('MANUAL_CONTROL_RELEASED');
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
    this.finishCuriosity('MANUAL_CONTROL_RELEASED');
    this.curiosityStillMs = 0;
  }

  // DEV-B observation: the cached route only. Reading it never triggers a new
  // search and never changes the current target.
  currentPath(): readonly Point[] { return this.path; }

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
    this.trackDoorCrossings(input);
    this.doorEscapeCooldownRemainingMs = Math.max(0,
      this.doorEscapeCooldownRemainingMs - deltaMs);
    this.doorLockWindowRemainingMs = this.doorLockPendingSinceMs === null ? 0 :
      Math.max(0, GAME_CONFIG.deepseekAI.doorEscapeCrossingWindowMs -
        (this.elapsedMs - this.doorLockPendingSinceMs));
    const crossedAt = this.doorEscapeLastCrossedId === null ? undefined :
      this.recentDoorCrossing.get(this.doorEscapeLastCrossedId);
    this.doorEscapeLastCrossedAgeMs = crossedAt === undefined ? null :
      this.elapsedMs - crossedAt;
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
    this.curiosityCooldownRemainingMs = Math.max(0,
      this.curiosityCooldownRemainingMs - deltaMs);
    this.passageCheckRemainingMs = Math.max(0, this.passageCheckRemainingMs - deltaMs);
    this.safeWaitRemainingMs = Math.max(0, this.safeWaitRemainingMs - deltaMs);
    for (const rice of input.rice) if (rice.completed)
      this.clearDangerousEntryFailures(rice.id);
    this.trackPathProgress(input.deepseek, deltaMs);
    // S7C-2b：地图代次一变就作废旧藏身计划（游戏层同时会强制退出藏身）。
    if (input.hideMap && input.hideMap.revision !== this.hideMapRevision) {
      const firstMap = this.hideMapRevision === null;
      this.hideMap = input.hideMap;
      this.hideMapRevision = input.hideMap.revision;
      if (!firstMap) this.abortHidePlan('MAP_REVISION_CHANGED');
    } else if (input.hideMap) {
      this.hideMap = input.hideMap;
    }
    this.syncSelfConcealment(input);

    const signature = input.doors.map(door =>
      `${door.id}:${door.state}:${door.lockCoreState}`).join('|');
    if (signature !== this.doorSignature) {
      this.doorSignature = signature;
      this.path = [];
      this.pathIndex = 0;
      this.retryRemainingMs = 0;
      this.escapeReplanRemainingMs = 0;
      this.lastNavigationReason = 'DOOR_STATE_CHANGED';
      if (this.passageActive) this.passageRouteSafe = false;
      if (this.state === 'SAFE_WAIT') {
        this.safeWaitRemainingMs = 0;
        this.passageCheckRemainingMs = 0;
        this.safeWaitReason = 'DOOR_STATE_CHANGED_RECHECK';
      }
    }

    const movedHuman = this.observeHumanStillness(input);
    if (movedHuman && this.safeWaitRiceId) {
      const wasWaiting = this.state === 'SAFE_WAIT';
      this.clearDangerousEntryFailures(this.safeWaitRiceId);
      if (wasWaiting) {
        this.state = 'RESELECT';
        this.retryRemainingMs = 0;
        this.lastTransitionReason = 'HUMAN_STILL_EVENT_CHANGED_RETRY';
      }
    }
    const urgentHumanSound = this.isUrgentHumanSound(input);
    if (!this.passageActive &&
        (this.state !== 'SAFE_WAIT' || this.safeWaitRemainingMs === 0 ||
          (input.visibleHuman && !this.passageRolledForStillEvent)))
      this.tryStartPassage(input, urgentHumanSound);
    else this.passageGateReason = this.passageActive
      ? 'ACTIVE_SAFE_PASSAGE' : 'SAFE_WAIT_RECHECK_PENDING';
    if (this.curiosityBypassActive && !input.visibleHuman && !urgentHumanSound) {
      // Reaching cover is not a new threat: continue the already checked rice
      // route, but stop discounting any future sighting of the Human.
      this.curiosityBypassActive = false;
      this.curiosityTarget = null;
      this.curiosityInterruptReason = 'BYPASS_REACHED_COVER';
    }
    const curiosityActive = this.state === 'CURIOUS_APPROACH' ||
      this.state === 'CURIOUS_OBSERVE' || this.curiosityBypassActive ||
      this.passageActive;
    const knownHuman = this.knownHumanPosition(input);
    const urgentReason = movedHuman ? 'HUMAN_MOVED' :
      urgentHumanSound ? 'DANGER_SOUND' :
      input.sprintState === 'STUNNED' ? 'STUNNED' :
      (input.captureProgressMs ?? 0) > 0 ? 'CAPTURE_ATTEMPT' :
      input.visibleHuman && distance(input.deepseek, input.visibleHuman) <
        (this.passageActive ? this.passageAvoidRadius : cfg.curiositySafeDistance)
        ? 'SAFETY_DISTANCE_BREACHED' : null;
    if (curiosityActive && (urgentReason || !knownHuman)) {
      const reason = urgentReason ?? 'LAST_SEEN_EXPIRED';
      if (this.passageActive) this.finishPassage(reason);
      else this.finishCuriosity(reason);
      if (urgentReason) this.enterEvade(input.visibleHuman ? 'VISION' : 'LAST_SEEN');
    }
    const threat = this.assessThreat(input);
    // The discount belongs only to this one observed, stationary Human. It is
    // withdrawn on movement, a fresh danger or expiry of the last sighting.
    if ((this.state === 'CURIOUS_APPROACH' || this.state === 'CURIOUS_OBSERVE' ||
        this.curiosityBypassActive || this.passageActive) &&
        (threat.source === 'VISION' ||
          (threat.source === 'SOUND' && !urgentHumanSound)))
      threat.level = 'CAUTION';
    this.threatSource = threat.source;
    this.threatLevel = threat.level;
    if (threat.point && (threat.source !== 'SOUND' || threat.level === 'HIGH'))
      this.threatEstimate = threat.point;
    // Last Seen and weak sounds are caution, not a fresh sighting. They may
    // remain available while the escape route is already safe.
    this.quietMs = threat.level === 'HIGH' ? 0 : this.quietMs + deltaMs;
    if (this.passageActive) return this.updatePassage(input, deltaMs);
    if (this.state === 'SAFE_WAIT')
      return this.updateSafeWait(input, threat, urgentHumanSound);
    if (threat.level === 'HIGH') {
      this.alertRemainingMs = cfg.alertHoldMs;
      // S7C-2b：藏身计划（含走位中）拥有自己的有界中止条件，绝不让这里直接把它
      // 拆掉——否则 AI 一看见 Human 就永远进不了家具。
      if (this.state !== 'EVADE' && this.state !== 'HIDE') {
        this.recordDangerousEntry(input, threat);
        this.enterEvade(threat.source);
      }
    } else if (threat.source === 'LAST_SEEN' &&
        this.state === 'EVADE' &&
        input.lastSeenHuman && input.perceptionNowMs !== undefined) {
      const age = input.perceptionNowMs - input.lastSeenHuman.timeMs;
      this.alertRemainingMs = Math.max(this.alertRemainingMs,
        cfg.lastSeenAlertMs - age);
    }
    if (this.state === 'EVADE' || this.state === 'RECOVER' || this.state === 'HIDE')
      return this.updateSafety(input, threat, deltaMs);
    if (this.state === 'CURIOUS_APPROACH' || this.state === 'CURIOUS_OBSERVE')
      return this.updateCuriosity(input, deltaMs);
    if (this.tryStartCuriosity(input, threat)) return this.updateCuriosity(input, 0);

    const current = input.rice.find(rice => rice.id === this.targetRiceId);
    if (this.curiosityBypassActive && this.targetRiceId && (!current || current.completed)) {
      this.finishCuriosity('BYPASS_TARGET_COMPLETED');
      this.clearTarget('TARGET_COMPLETED_OR_MISSING');
      return this.command();
    }
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
      this.clearDangerousEntryFailures(target.id);
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
      if (this.curiosityBypassActive && input.visibleHuman &&
          (!this.path.length || !this.curiosityPathIsSafe(this.path, input.visibleHuman))) {
        this.finishCuriosity('BYPASS_ROUTE_INVALID');
        this.enterEvade('VISION');
        return this.updateSafety(input, this.assessThreat(input), deltaMs);
      }
      if (!this.path.length) {
        this.avoidedRiceMs.set(target.id, cfg.retryMs);
        this.clearTarget('NO_ROUTE_TO_RICE');
        return this.command();
      }
      this.targetScoreMs = this.score(input.deepseek, target, this.path);
    }
    return this.followPath(input, target);
  }

  private observeHumanStillness(input: DeepSeekAIInput): boolean {
    if (!input.visibleHuman || input.humanStillEventId === undefined ||
        input.humanStillMs === undefined) {
      this.curiosityStillMs = 0;
      return false;
    }
    const changed = this.observedHumanStillEventId !== null &&
      this.observedHumanStillEventId !== input.humanStillEventId;
    if (this.observedHumanStillEventId !== input.humanStillEventId) {
      this.observedHumanStillEventId = input.humanStillEventId;
      this.curiosityRolledForStillEvent = false;
      this.passageRolledForStillEvent = false;
      this.passageCheckRemainingMs = 0;
    }
    this.curiosityStillMs = input.humanStillMs;
    // A different event learned after occlusion is not necessarily movement
    // now. It still invalidates an OLD permit, never a newly eligible event.
    return changed && (this.passageActive || this.curiosityBypassActive ||
      this.state === 'CURIOUS_APPROACH' || this.state === 'CURIOUS_OBSERVE' ||
      input.humanStillMs < GAME_CONFIG.deepseekAI.curiosityStillMs);
  }

  private knownHumanPosition(input: DeepSeekAIInput): Point | null {
    if (input.visibleHuman) return input.visibleHuman;
    if (input.lastSeenHuman && input.perceptionNowMs !== undefined &&
        input.perceptionNowMs - input.lastSeenHuman.timeMs <
          GAME_CONFIG.perception.lastSeenMs)
      return input.lastSeenHuman.position;
    return null;
  }

  private isUrgentHumanSound(input: DeepSeekAIInput): boolean {
    const heard = input.heardHumanDanger === undefined
      ? input.heardHuman : input.heardHumanDanger;
    if (!heard || heard.event.sourceFaction !== 'HUMAN' ||
        heard.remainingMs <= 0 ||
        heard.audibleStrength < GAME_CONFIG.deepseekAI.soundEvadeStrength)
      return false;
    // A door being operated is audible information, not proof that a
    // stationary Human is pursuing. Door state/path safety is checked
    // separately. Movement and force-breaking remain immediate warnings.
    return isHumanPursuitSound(heard.event.type);
  }

  get passageAvoidRadius(): number {
    return this.effectiveCaptureRadius +
      GAME_CONFIG.deepseekAI.stationaryPassageSafetyMargin;
  }

  private pathClearOfHuman(path: readonly Point[], human: Point, radius: number): boolean {
    for (let index = 0; index < path.length; index++) {
      if (distance(path[index], human) < radius) return false;
      if (index > 0 && distanceToXZSegment(human, path[index - 1], path[index]) < radius)
        return false;
    }
    return true;
  }

  private recordDangerousEntry(input: DeepSeekAIInput, threat: ThreatAssessment): void {
    if (threat.source !== 'VISION' || !input.visibleHuman || !this.targetRiceId ||
        (this.state !== 'MOVE_TO_RICE' && this.state !== 'EAT' &&
          this.state !== 'CURIOUS_PASSAGE')) return;
    const rice = input.rice.find(candidate => candidate.id === this.targetRiceId);
    if (!rice || rice.completed) return;
    const path = this.path.length ? this.path :
      this.navigation.findPath(input.deepseek, rice, input.doors);
    if (!path?.length) return;
    const radius = GAME_CONFIG.deepseekAI.dangerRouteRadius;
    if (distance(rice, input.visibleHuman) > radius &&
        this.pathClearOfHuman([input.deepseek, ...path, rice], input.visibleHuman,
          radius)) return;
    // The last crossed door identifies the approach into this rice area.
    const entryId = [...path].reverse().find(step => step.doorId)?.doorId ?? 'IN_ROOM';
    const key = `${rice.id}|${entryId}`;
    const count = (this.dangerousEntryFailures.get(key) ?? 0) + 1;
    this.dangerousEntryFailures.set(key, count);
    this.safeWaitFailureCount = count;
    if (count >= GAME_CONFIG.deepseekAI.safeWaitFailureThreshold) {
      this.safeWaitRiceId = rice.id;
      this.safeWaitEntryId = entryId;
      this.safeWaitReason = 'REPEATED_DANGEROUS_ENTRY';
    }
  }

  private clearDangerousEntryFailures(riceId: string): void {
    for (const key of this.dangerousEntryFailures.keys())
      if (key.startsWith(`${riceId}|`)) this.dangerousEntryFailures.delete(key);
    if (this.safeWaitRiceId === riceId) {
      this.safeWaitRiceId = null;
      this.safeWaitEntryId = null;
      this.safeWaitRemainingMs = 0;
      this.safeWaitReason = 'NONE';
    }
    this.safeWaitFailureCount = Math.max(0, ...this.dangerousEntryFailures.values());
  }

  private enterSafeWait(riceId: string): void {
    this.state = 'SAFE_WAIT';
    this.targetRiceId = null;
    this.targetScoreMs = null;
    this.path = [];
    this.pathIndex = 0;
    this.retryRemainingMs = 0;
    this.safeWaitRemainingMs = GAME_CONFIG.deepseekAI.safeWaitRecheckMs;
    this.safeWaitReason = 'REPEATED_DANGEROUS_ENTRY';
    this.lastSelectionReason = `SAFE_WAIT_${riceId}`;
    this.lastTransitionReason = 'REPEATED_DANGEROUS_ENTRY_SAFE_WAIT';
    this.noMovementReason = 'SAFE_WAIT_RECHECK';
    this.resetPathProgress();
  }

  private updateSafeWait(input: DeepSeekAIInput, threat: ThreatAssessment,
    urgentHumanSound: boolean): DeepSeekAICommand {
    const rice = input.rice.find(candidate => candidate.id === this.safeWaitRiceId);
    if (!rice || rice.completed) {
      if (this.safeWaitRiceId) this.clearDangerousEntryFailures(this.safeWaitRiceId);
      this.state = 'RESELECT';
      this.lastTransitionReason = 'SAFE_WAIT_TARGET_COMPLETED_OR_MISSING';
      return this.command();
    }
    if (input.sprintState === 'STUNNED') {
      this.safeWaitReason = 'STUNNED';
      this.noMovementReason = 'STUNNED';
      return this.command();
    }
    if (urgentHumanSound || (input.captureProgressMs ?? 0) > 0 ||
        (input.visibleHuman && distance(input.deepseek, input.visibleHuman) <=
          this.passageAvoidRadius)) {
      this.safeWaitReason = 'IMMEDIATE_DANGER';
      this.enterEvade(input.visibleHuman ? 'VISION' : 'SOUND');
      return this.updateSafety(input, threat, input.deltaMs);
    }
    if (this.safeWaitRemainingMs > 0) {
      if (this.safeWaitObservation && this.path.length && !input.visibleHuman) {
        if (distance(input.deepseek, this.safeWaitObservation) > GAME_CONFIG.deepseekAI.waypointTolerance)
          return this.followPath(input, this.safeWaitObservation);
        this.safeWaitObservation = null;
        this.path = [];
        this.safeWaitReason = 'OBSERVATION_REACHED_NEED_FRESH_SIGHT';
      }
      this.noMovementReason = 'SAFE_WAIT_RECHECK';
      return this.command();
    }
    this.safeWaitRemainingMs = GAME_CONFIG.deepseekAI.safeWaitRecheckMs;
    const knownHuman = this.knownHumanPosition(input) ?? this.threatEstimate;
    // Recheck geometry against remembered information, not hidden live data.
    // Reach only a safe observation prefix; no eating permission until fresh sight.
    if (!input.visibleHuman && knownHuman && input.geometry) {
      const plan = this.planSafeEatingRoute(input, rice, knownHuman);
      const index = plan?.path.findIndex(point =>
        input.geometry!.visible(point, knownHuman, this.effectiveVisionRange)) ?? -1;
      if (plan && index >= 0 && distance(input.deepseek, plan.path[index]) >
          GAME_CONFIG.deepseekAI.waypointTolerance) {
        this.safeWaitObservation = { ...plan.path[index] };
        this.path = plan.path.slice(0, index + 1);
        this.pathIndex = 0;
        this.safeWaitReason = 'SAFE_OBSERVATION_RECHECK';
        this.safetyDebug = { human: { ...knownHuman }, rice: { ...rice }, eat: plan.goal,
          observation: this.safeWaitObservation, defaultPath: [],
          safePath: [input.deepseek, ...plan.path], reason: 'OBSERVATION_ONLY_NEED_FRESH_SIGHT' };
        this.resetPathProgress();
        return this.followPath(input, this.safeWaitObservation);
      }
    }
    // Waiting on one dangerous entrance must not suppress another safe rice.
    if (threat.level !== 'HIGH') {
      const alternatives = input.rice.filter(candidate => !candidate.completed &&
          candidate.id !== rice.id && !this.avoidedRiceMs.has(candidate.id))
        .map(candidate => {
          const path = this.navigation.findPath(input.deepseek, candidate, input.doors);
          return path?.length && (!knownHuman || this.pathClearOfHuman(
            [input.deepseek, ...path, candidate], knownHuman,
            GAME_CONFIG.deepseekAI.dangerRouteRadius))
            ? { rice: candidate, path,
              score: this.score(input.deepseek, candidate, path) } : null;
        }).filter((candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== null)
        .sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id));
      if (alternatives.length) {
        const selected = alternatives[0];
        this.targetRiceId = selected.rice.id;
        this.targetScoreMs = selected.score;
        this.path = selected.path;
        this.pathIndex = 0;
        this.state = 'MOVE_TO_RICE';
        this.lastSelectionReason = 'SAFE_WAIT_ALTERNATIVE_RICE';
        this.lastTransitionReason = 'SAFE_WAIT_ALTERNATIVE_ROUTE_FOUND';
        this.resetPathProgress();
        return this.followPath(input, selected.rice);
      }
    }
    const path = this.navigation.findPath(input.deepseek, rice, input.doors);
    if (!path?.length) {
      this.safeWaitReason = 'NO_REACHABLE_RICE_ROUTE';
      this.noMovementReason = 'SAFE_WAIT_NO_ROUTE';
      return this.command();
    }
    if (knownHuman && (distance(rice, knownHuman) <=
        GAME_CONFIG.deepseekAI.dangerRouteRadius ||
        !this.pathClearOfHuman([input.deepseek, ...path, rice], knownHuman,
          GAME_CONFIG.deepseekAI.dangerRouteRadius))) {
      this.safeWaitReason = 'RICE_OR_ROUTE_STILL_DANGEROUS';
      this.noMovementReason = 'SAFE_WAIT_THREAT_PERSISTS';
      return this.command();
    }
    if (threat.level === 'HIGH') {
      this.safeWaitReason = 'CURRENT_THREAT_PERSISTS';
      this.noMovementReason = 'SAFE_WAIT_THREAT_PERSISTS';
      return this.command();
    }
    this.clearDangerousEntryFailures(rice.id);
    this.targetRiceId = rice.id;
    this.targetScoreMs = this.score(input.deepseek, rice, path);
    this.path = path;
    this.pathIndex = 0;
    this.state = 'MOVE_TO_RICE';
    this.lastSelectionReason = 'SAFE_WAIT_ROUTE_RECHECK_PASSED';
    this.lastTransitionReason = 'SAFE_WAIT_SAFE_ROUTE_FOUND';
    this.resetPathProgress();
    return this.followPath(input, rice);
  }

  private tryStartPassage(input: DeepSeekAIInput, dangerousSound: boolean): void {
    const cfg = GAME_CONFIG.deepseekAI;
    const human = input.visibleHuman;
    if (!human) { this.passageGateReason = 'NO_VISIBLE_HUMAN'; return; }
    const retryingSafeWait = this.state === 'SAFE_WAIT' &&
      this.passageRolledForStillEvent &&
      (this.passageRollResult === 'NO_SAFE_ROUTE' ||
        (this.passageRollResult === 'ROLL_PASSED' &&
          this.curiosityCooldownRemainingMs === 0));
    if (this.passageRolledForStillEvent && !retryingSafeWait) {
      this.passageGateReason = this.passageRollResult === 'NO_SAFE_ROUTE'
        ? 'TRIGGERED_NO_SAFE_ROUTE'
        : this.passageCancelReason !== 'NONE'
          ? 'INTERRUPTED_' + this.passageCancelReason
          : 'ALREADY_TRIED_THIS_STILL_EVENT';
      return;
    }
    if (this.curiosityStillMs < cfg.curiosityStillMs) {
      this.passageGateReason = 'HUMAN_NOT_STILL_LONG_ENOUGH'; return;
    }
    if (this.curiosityCooldownRemainingMs > 0 && !retryingSafeWait) {
      this.passageGateReason = 'CURIOSITY_COOLDOWN'; return;
    }
    if (this.state === 'CURIOUS_APPROACH' || this.state === 'CURIOUS_OBSERVE' ||
        this.curiosityBypassActive) {
      this.passageGateReason = 'OTHER_CURIOSITY_ACTIVE'; return;
    }
    if (input.sprintState !== 'NORMAL' || dangerousSound ||
        (input.captureProgressMs ?? 0) > 0 ||
        distance(input.deepseek, human) <= this.passageAvoidRadius) {
      this.passageGateReason = 'REAL_DANGER_OR_TOO_CLOSE'; return;
    }
    if (this.passageCheckRemainingMs > 0) {
      this.passageGateReason = 'ROUTE_CHECK_INTERVAL'; return;
    }
    this.passageCheckRemainingMs = cfg.stationaryPassageCheckIntervalMs;
    const active = input.rice.filter(rice => !rice.completed);
    const planned = active.map(rice => {
      const path = this.navigation.findPath(input.deepseek, rice, input.doors);
      return path?.length ? { rice, path,
        score: this.score(input.deepseek, rice, path) } : null;
    }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null);
    const intended = planned.find(candidate => candidate.rice.id ===
      (this.state === 'SAFE_WAIT' ? this.safeWaitRiceId : this.targetRiceId)) ??
      planned.sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id))[0];
    if (!intended) { this.passageGateReason = 'NO_REACHABLE_RICE'; return; }
    const humanNearDefaultRoute = !this.pathClearOfHuman(
      [input.deepseek, ...intended.path, intended.rice], human,
      cfg.stationaryPassageBlockRadius);
    // A default A* route may skirt a stationary Human while its destination
    // rice is still inside the existing danger area. Check both independently.
    const humanNearRice = distance(intended.rice, human) <= cfg.dangerRouteRadius;
    if (!humanNearDefaultRoute && !humanNearRice) {
      this.passageGateReason = 'HUMAN_NOT_ON_RICE_ROUTE';
      return;
    }
    if (!retryingSafeWait) {
      this.passageRolledForStillEvent = true;
      this.curiosityRolledForStillEvent = true;
      if (this.random() >= cfg.stationaryPassageChance) {
        this.passageRollResult = 'ROLL_FAILED';
        this.passageGateReason = 'PROBABILITY_REJECTED';
        return;
      }
    }
    this.passageRollResult = 'ROLL_PASSED';
    const choices = [intended, ...planned.filter(candidate => candidate !== intended)
      .sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id))];
    for (const candidate of choices) {
      this.safetyDebug = { human: { ...human }, rice: { ...candidate.rice },
        eat: null, observation: null, defaultPath: [input.deepseek, ...candidate.path],
        safePath: [], reason: 'NO_SAFE_PASSAGE_ROUTE' };
      const plan = this.planSafeEatingRoute(input, candidate.rice, human);
      if (!plan) continue;
      const { path: safePath, goal } = plan;
      // Observe on the already validated bypass route, before continuing to rice.
      // Do not pick its final rice waypoint as the observation point.
      const observationIndex = safePath.slice(0, -1).reduce((best, step, index) => {
        if (distance(step, input.deepseek) <= cfg.curiosityApproachTolerance) return best;
        const error = Math.abs(distance(step, human) -
          cfg.stationaryPassageObserveDistance);
        return error < best.error ? { index, error } : best;
      }, { index: -1, error: Infinity }).index;
      // A short, already-safe route can be observed from its starting point.
      const observation = observationIndex < 0 ? input.deepseek : safePath[observationIndex];
      this.targetRiceId = candidate.rice.id;
      this.targetScoreMs = this.score(input.deepseek, candidate.rice, safePath);
      this.curiosityTarget = { x: observation.x, z: observation.z };
      this.passageEatPosition = goal;
      this.safetyDebug.eat = { ...goal };
      this.safetyDebug.observation = { ...this.curiosityTarget };
      this.safetyDebug.safePath = [input.deepseek, ...safePath];
      this.safetyDebug.reason = 'SAFE_ROUTE_VERIFIED';
      this.path = observationIndex < 0 ? [] : safePath.slice(0, observationIndex + 1);
      this.pathIndex = 0;
      this.passageActive = true;
      this.safeWaitObservation = null;
      this.passageRouteSafe = true;
      this.passageGateReason = 'ACTIVE_SAFE_APPROACH';
      this.state = 'CURIOUS_APPROACH';
      this.escapeTarget = null;
      this.escapeRoomId = null;
      this.passageCancelReason = 'NONE';
      this.lastTransitionReason = 'STATIONARY_HUMAN_SAFE_OBSERVATION';
      this.resetPathProgress();
      return;
    }
    this.passageRollResult = 'NO_SAFE_ROUTE';
    this.passageGateReason = 'TRIGGERED_NO_SAFE_ROUTE';
    this.passageCancelReason = 'NO_REACHABLE_ROUTE_OUTSIDE_CAPTURE_ZONE';
  }

  private updatePassage(input: DeepSeekAIInput, deltaMs: number): DeepSeekAICommand {
    const target = input.rice.find(rice => rice.id === this.targetRiceId);
    const human = this.knownHumanPosition(input);
    if (!target || target.completed || !human) {
      this.finishPassage(target?.completed ? 'TARGET_COMPLETED' :
        !human ? 'LAST_SEEN_EXPIRED' : 'TARGET_INVALID');
      if (target?.completed) this.clearTarget('TARGET_COMPLETED_OR_MISSING');
      return this.command();
    }
    const avoidCircle = { center: human, radius: this.passageAvoidRadius };
    this.safetyDebug.human = { ...human };
    if (this.state === 'CURIOUS_APPROACH') {
      if (!this.curiosityTarget) {
        this.finishPassage('OBSERVATION_TARGET_INVALID');
        this.enterEvade('VISION');
        return this.command();
      }
      if (distance(input.deepseek, this.curiosityTarget) <=
          GAME_CONFIG.deepseekAI.curiosityApproachTolerance) {
        this.state = 'CURIOUS_OBSERVE';
        this.curiosityObserveRemainingMs = GAME_CONFIG.deepseekAI.curiosityObserveMs;
        this.path = [];
        this.pathIndex = 0;
        this.lastTransitionReason = 'SAFE_OBSERVATION_POINT_REACHED';
        return this.command();
      }
      if (!this.path.length) {
        this.path = this.navigation.findPath(input.deepseek, this.curiosityTarget,
          input.doors, undefined, null, new Set(), avoidCircle) ?? [];
        this.pathIndex = 0;
        this.passageRouteSafe = !!this.path.length && this.pathClearOfHuman(
          [input.deepseek, ...this.path, this.curiosityTarget], human,
          this.passageAvoidRadius);
        if (!this.passageRouteSafe) {
          this.finishPassage('OBSERVATION_ROUTE_NO_LONGER_SAFE');
          this.enterEvade('VISION');
          return this.command();
        }
      }
      return this.followPath(input, this.curiosityTarget);
    }
    if (this.state === 'CURIOUS_OBSERVE') {
      this.curiosityObserveRemainingMs = Math.max(0,
        this.curiosityObserveRemainingMs - deltaMs);
      if (this.curiosityObserveRemainingMs > 0) return this.command();
      this.path = [];
      this.pathIndex = 0;
      this.curiosityTarget = null;
      this.state = 'CURIOUS_PASSAGE';
      this.lastTransitionReason = 'OBSERVED_STILL_HUMAN_SAFE_BYPASS';
    }
    if (distance(input.deepseek, target) <=
        GAME_CONFIG.rice.interactionRange / GAME_CONFIG.three.pixelsPerUnit) {
      this.clearDangerousEntryFailures(target.id);
      this.state = 'EAT';
      return this.command(0, 0, null, target.id);
    }
    this.state = 'CURIOUS_PASSAGE';
    if (!this.path.length) {
      const plan = this.planSafeEatingRoute(input, target, human);
      this.passageEatPosition = plan?.goal ?? null;
      this.path = plan?.path ?? [];
      this.pathIndex = 0;
      this.passageRouteSafe = !!this.path.length && this.pathClearOfHuman(
          [input.deepseek, ...this.path], human,
          this.passageAvoidRadius);
      if (!this.passageRouteSafe) {
        this.finishPassage('ROUTE_NO_LONGER_SAFE');
        this.enterEvade('VISION');
        return this.updateSafety(input, this.assessThreat(input), deltaMs);
      }
      this.lastNavigationReason = 'PASSAGE_ROUTE_REPLANNED';
      this.safetyDebug.eat = this.passageEatPosition;
      this.safetyDebug.safePath = [input.deepseek, ...this.path];
    }
    return this.followPath(input, this.passageEatPosition ?? target);
  }

  private planSafeEatingRoute(input: DeepSeekAIInput, rice: DeepSeekAIRice,
    human: Point): { goal: Point; path: NavStep[] } | null {
    const range = GAME_CONFIG.rice.interactionRange / GAME_CONFIG.three.pixelsPerUnit;
    const cell = GAME_CONFIG.humanAI.navCellSize;
    const circle = { center: human, radius: this.passageAvoidRadius };
    // Existing nav grid, not a second pathfinder. Only this authorized trial
    // considers alternate interaction positions; ordinary rice scoring is unchanged.
    const goals: Point[] = [rice];
    for (let x = -range; x <= range; x += cell)
      for (let z = -range; z <= range; z += cell) {
        const goal = this.navigation.nearestFree({ x: rice.x + x, z: rice.z + z }, input.doors);
        if (goal && distance(goal, rice) < range - GAME_CONFIG.collision.contactEpsilon &&
            !goals.some(p => distance(p, goal) < GAME_CONFIG.collision.contactEpsilon))
          goals.push(goal);
      }
    let best: { goal: Point; path: NavStep[]; length: number } | null = null;
    for (const goal of goals) {
      if (distance(goal, human) < circle.radius) continue;
      const path = this.navigation.findPath(input.deepseek, goal, input.doors,
        undefined, null, new Set(), circle);
      if (!path?.length || distance(path[path.length - 1], rice) > range ||
          !this.pathClearOfHuman([input.deepseek, ...path, goal], human, circle.radius)) continue;
      const length = this.pathLength(input.deepseek, path, goal);
      // Prefer the existing center path when safe, preserving its established behavior.
      if (goal === rice) return { goal, path };
      if (!best || length < best.length) best = { goal, path, length };
    }
    return best;
  }

  private finishPassage(reason: string): void {
    if (!this.passageActive) return;
    this.passageActive = false;
    this.passageEatPosition = null;
    this.safetyDebug.reason = reason;
    this.passageGateReason = 'INTERRUPTED_' + reason;
    this.passageCancelReason = reason;
    this.passageRouteSafe = false;
    this.curiosityTarget = null;
    this.curiosityObserveRemainingMs = 0;
    this.curiosityCooldownRemainingMs = GAME_CONFIG.deepseekAI.curiosityCooldownMs;
    this.path = [];
    this.pathIndex = 0;
    this.state = 'SEEK_RICE';
    this.resetPathProgress();
  }

  private tryStartCuriosity(input: DeepSeekAIInput, threat: ThreatAssessment): boolean {
    const cfg = GAME_CONFIG.deepseekAI;
    if (!input.visibleHuman || threat.level !== 'CAUTION' ||
        this.state === 'EVADE' || this.state === 'RECOVER' ||
        input.sprintState !== 'NORMAL' ||
        this.curiosityCooldownRemainingMs > 0 || this.curiosityRolledForStillEvent ||
        this.passageRolledForStillEvent ||
        this.curiosityStillMs < cfg.curiosityStillMs ||
        this.isUrgentHumanSound(input)) return false;
    this.curiosityRolledForStillEvent = true;
    if (this.random() >= cfg.curiosityChance) {
      this.curiosityRollResult = 'ROLL_FAILED';
      return false;
    }
    this.curiosityRollResult = 'ROLL_PASSED';
    const human = input.visibleHuman;
    const standOff = cfg.curiositySafeDistance + cfg.curiosityApproachTolerance;
    const toward = Math.atan2(input.deepseek.z - human.z, input.deepseek.x - human.x);
    const offsets = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2,
      -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
    const candidates = offsets.map(offset => {
      const desired = { x: human.x + Math.cos(toward + offset) * standOff,
        z: human.z + Math.sin(toward + offset) * standOff };
      const goal = this.navigation.nearestFree(desired, input.doors);
      if (!goal || distance(goal, human) < cfg.curiositySafeDistance) return null;
      const path = this.navigation.findPath(input.deepseek, goal, input.doors);
      if (!path?.length || !this.curiosityPathIsSafe(path, human)) return null;
      // The observation point must also have a traversable way back out.
      const exit = this.navigation.findPath(goal, input.deepseek, input.doors);
      if (!exit?.length || !this.curiosityPathIsSafe(exit, human)) return null;
      return { goal, path, length: this.pathLength(input.deepseek, path, goal) };
    }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => a.length - b.length);
    if (!candidates.length) {
      this.curiosityRollResult = 'NO_SAFE_APPROACH';
      this.curiosityCooldownRemainingMs = cfg.curiosityCooldownMs;
      return false;
    }
    this.state = 'CURIOUS_APPROACH';
    this.curiosityTarget = candidates[0].goal;
    this.path = candidates[0].path;
    this.pathIndex = 0;
    this.targetRiceId = null;
    this.targetScoreMs = null;
    this.resetPathProgress();
    this.lastTransitionReason = 'STATIONARY_HUMAN_CURIOSITY';
    return true;
  }

  private curiosityPathIsSafe(path: readonly NavStep[], human: Point): boolean {
    const cfg = GAME_CONFIG.deepseekAI;
    for (let index = 0; index < path.length; index++) {
      if (distance(path[index], human) < cfg.curiositySafeDistance) return false;
      if (index === 0) continue;
      const previous = path[index - 1], next = path[index];
      const samples = Math.ceil(distance(previous, next) /
        GAME_CONFIG.collision.maxMovementSubstep);
      for (let sample = 1; sample < samples; sample++) {
        const ratio = sample / samples;
        if (distance({ x: previous.x + (next.x - previous.x) * ratio,
          z: previous.z + (next.z - previous.z) * ratio }, human) <
            cfg.curiositySafeDistance) return false;
      }
    }
    return true;
  }

  private updateCuriosity(input: DeepSeekAIInput, deltaMs: number): DeepSeekAICommand {
    const human = this.knownHumanPosition(input);
    if (!human || !this.curiosityTarget) return this.command();
    const cfg = GAME_CONFIG.deepseekAI;
    if (this.state === 'CURIOUS_APPROACH') {
      if (distance(input.deepseek, this.curiosityTarget) <= cfg.curiosityApproachTolerance) {
        this.state = 'CURIOUS_OBSERVE';
        this.curiosityObserveRemainingMs = cfg.curiosityObserveMs;
        this.path = [];
        this.pathIndex = 0;
        this.lastTransitionReason = 'SAFE_OBSERVATION_POINT_REACHED';
        return this.command();
      }
      if (!this.path.length) {
        this.path = this.navigation.findPath(input.deepseek, this.curiosityTarget,
          input.doors) ?? [];
        this.pathIndex = 0;
        if (!this.path.length || !this.curiosityPathIsSafe(this.path, human)) {
          this.finishCuriosity('APPROACH_ROUTE_INVALID');
          this.enterEvade('VISION');
          return this.updateSafety(input, this.assessThreat(input), deltaMs);
        }
      }
      return this.followPath(input, this.curiosityTarget);
    }
    this.curiosityObserveRemainingMs = Math.max(0,
      this.curiosityObserveRemainingMs - deltaMs);
    if (this.curiosityObserveRemainingMs > 0) return this.command();
    const safeRice = input.rice.filter(rice => !rice.completed).map(rice => {
      if (distance(rice, human) < cfg.curiositySafeDistance) return null;
      const path = this.navigation.findPath(input.deepseek, rice, input.doors);
      return path?.length && this.curiosityPathIsSafe(path, human)
        ? { rice, path, score: this.score(input.deepseek, rice, path) } : null;
    }).filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id));
    if (!safeRice.length) {
      this.finishCuriosity('NO_SAFE_RICE_BYPASS');
      this.enterEvade('VISION');
      return this.updateSafety(input, this.assessThreat(input), deltaMs);
    }
    const chosen = safeRice[0];
    this.targetRiceId = chosen.rice.id;
    this.targetScoreMs = chosen.score;
    this.path = chosen.path;
    this.pathIndex = 0;
    this.state = 'MOVE_TO_RICE';
    this.curiosityBypassActive = true;
    this.curiosityCooldownRemainingMs = cfg.curiosityCooldownMs;
    this.curiosityRollResult = 'SAFE_BYPASS';
    this.lastTransitionReason = 'OBSERVED_STILL_HUMAN_SAFE_BYPASS';
    this.resetPathProgress();
    return this.followPath(input, chosen.rice);
  }

  private finishCuriosity(reason: string): void {
    if (this.state !== 'CURIOUS_APPROACH' && this.state !== 'CURIOUS_OBSERVE' &&
        !this.curiosityBypassActive) return;
    this.curiosityInterruptReason = reason;
    this.curiosityBypassActive = false;
    this.curiosityTarget = null;
    this.curiosityObserveRemainingMs = 0;
    this.curiosityCooldownRemainingMs = GAME_CONFIG.deepseekAI.curiosityCooldownMs;
    this.path = [];
    this.pathIndex = 0;
    if (this.state === 'CURIOUS_APPROACH' || this.state === 'CURIOUS_OBSERVE')
      this.state = 'SEEK_RICE';
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
    // S7C-2b：任何真实进入 EVADE 的路径都要先有界地结束走位中的藏身计划。
    this.abortHidePlan('ENTER_EVADE');
    this.state = 'EVADE';
    this.localLoopTriggered = false;
    this.loopReplanPending = false;
    this.cancelPendingLock('ENTER_EVADE');
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
    const approachSpeed = threat.visibleDistance !== null &&
      this.previousVisibleDistance !== null && deltaMs > 0
      ? (this.previousVisibleDistance - threat.visibleDistance) * 1000 / deltaMs : 0;
    this.previousVisibleDistance = threat.visibleDistance;
    if (input.sprintState === 'STUNNED') {
      this.sprintDecision = 'STUNNED';
      this.noMovementReason = 'STUNNED';
      this.recoveryBlockReason = 'STUNNED';
      this.cancelPendingLock('STUNNED');
      if (this.state === 'HIDE') this.abortHidePlan('STUNNED');
      return this.command();
    }
    if (this.state === 'RECOVER') return this.updateRecovery(input, deltaMs);
    // S7C-2b：藏身是一个与 EVADE / RECOVER 并列的安全分支，不重写逃跑评分。
    if (this.state === 'HIDE') return this.updateHide(input, threat, deltaMs);
    this.recordEscapeRoom(input.deepseek, threat.level === 'HIGH');
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
    // S7C-2b：逃跑目标已经选出，此时才有「藏身 vs 继续跑」的可比长度。
    const hideCommand = this.tryStartHide(input, threat, deltaMs);
    if (hideCommand) return hideCommand;
    const lockDoorId = this.evaluateEscapeLock(input, approachSpeed);
    if (lockDoorId) {
      this.sprintDecision = 'LOCKING_ESCAPE_DOOR';
      this.noMovementReason = 'LOCKING_ESCAPE_DOOR';
      return { ...this.command(), lockDoorId };
    }
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
    const closeDoorId = this.evaluateEscapeDoor(input);
    if (closeDoorId) {
      this.sprintDecision = 'CLOSING_ESCAPE_DOOR';
      this.noMovementReason = 'CLOSING_ESCAPE_DOOR';
      return { ...this.command(), closeDoorId };
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

  // -------------------------------------------------------------------------
  // S7C-2b：AI 自主藏身
  //
  // 设计纪律（与逃跑房间同一套）：
  //   · 只用公开信息：自己的位置、公开威胁估计（真实目视 / 有效 Last Seen / 声音八方向
  //     投影）、公开藏身点数据、门状态、米堆状态、自身藏身事实与冷却；
  //   · 不读取任何「藏身点里有没有人」的信息，不读取 Human 的实时坐标，不引用
  //     玩家专用的白色指向轮廓或按键仲裁；
  //   · 进入 / 退出的最终裁决权都在游戏层（权威几何层 + 藏身状态机），
  //     AI 只能发请求并收到一个拒绝码；
  //   · 每个相位都有有界的推进或放弃条件，绝不出现「原地不动且永远不结束」。
  // -------------------------------------------------------------------------

  /** 游戏层给出的自身藏身事实优先：绝不允许出现「实际藏着、AI 却不知道」。 */
  private syncSelfConcealment(input: DeepSeekAIInput): void {
    const self = input.hideSelf ?? null;
    if (self?.hiding) {
      if (self.spotId) this.hideSpotId = self.spotId;
      if (this.hidePhase !== 'CONCEALED' && this.hidePhase !== 'EXIT') {
        this.hidePhase = 'CONCEALED';
        this.hideConcealedMs = 0;
        this.hideRecheckRemainingMs = 0;
      }
      this.hideEnterPending = false;
      this.state = 'HIDE';
      return;
    }
    if (this.hidePhase === 'CONCEALED' || this.hidePhase === 'EXIT') {
      // 游戏层已经强制退出（搜查命中 / 局终 / 地图应用）而控制器还没收到回执。
      this.hidePhase = 'NONE';
      this.hideSpotId = null;
      this.hideStancePoint = null;
      this.hideConcealedMs = 0;
      if (this.state === 'HIDE') this.state = 'EVADE';
    }
  }

  private hideSpotSnapshot(map: DeepSeekHideMapSnapshot | null, spotId: string | null) {
    if (!map || !spotId) return null;
    return map.spots.find(entry => entry.spot.id === spotId) ?? null;
  }

  private hideCooldownSnapshot(): { spotId: string; remainingMs: number }[] {
    return [...this.hideSpotCooldowns.entries()].map(([spotId, remainingMs]) =>
      ({ spotId, remainingMs }));
  }

  private setHideCooldown(spotId: string, ms: number, reason: string): void {
    if (!spotId || ms <= 0) return;
    this.hideSpotCooldowns.set(spotId, ms);
    this.hideCooldownSummary = `${spotId}:${Math.round(ms)}(${reason})`;
  }

  private recordHideSpotVisit(spotId: string): void {
    this.hideRecentSpots.push({ spotId, atMs: this.elapsedMs });
    while (this.hideRecentSpots.length > GAME_CONFIG.deepseekAI.hideRecentSpotCount)
      this.hideRecentSpots.shift();
    this.hideRecentSpotIds = this.hideRecentSpots.map(entry => entry.spotId);
  }

  private recordHideEvent(type: string, reason: string, spotId: string | null): void {
    this.hideEvents.push({ type, reason, spotId });
  }

  /** 走位阶段的有界放弃：只有真实走位才允许中止，藏身中一律不在这里清状态。 */
  private abortHidePlan(reason: string): void {
    if (this.hidePhase === 'NONE' || this.hidePhase === 'CONCEALED' ||
        this.hidePhase === 'EXIT') return;
    const spotId = this.hideSpotId;
    this.hidePhase = 'NONE';
    this.hideSpotId = null;
    this.hideStancePoint = null;
    this.hideTravelLength = null;
    this.hideEnterPending = false;
    this.hidePathStalls = 0;
    this.hideReason = `ABORT:${reason}`;
    this.path = [];
    this.pathIndex = 0;
    this.resetPathProgress();
    this.hideAbortCount++;
    this.recordHideEvent('HIDE_AI_ABORT', reason, spotId);
    if (this.state === 'HIDE') {
      this.state = 'EVADE';
      this.recoveryBlockReason = 'CURRENT_THREAT';
      this.lastTransitionReason = `HIDE_ABORT_${reason}`;
    }
  }

  private clearHideState(): void {
    // 注意：`hideMap` / `hideMapRevision` 是**地图事实**而不是对局状态，重开一局
    // 不重建地图，因此这里刻意不清它们，只清与这一局有关的计数与计划。
    this.hidePhase = 'NONE';
    this.hideSpotId = null;
    this.hideStancePoint = null;
    this.hideReason = 'NONE';
    this.hideBlockedReason = 'NONE';
    this.hideRejectCode = 'NONE';
    this.hideLastExitReason = 'NONE';
    this.hideConcealedMs = 0;
    this.hideRequestCount = 0;
    this.hideEnterCount = 0;
    this.hideRejectCount = 0;
    this.hideExitCount = 0;
    this.hideAbortCount = 0;
    this.hideSpotBlockedCount = 0;
    this.hideConsecutiveCount = 0;
    this.hideCandidateCount = 0;
    this.hideCandidateSummary = 'NONE';
    this.hideCandidateScores = [];
    this.hideCooldownSummary = 'NONE';
    this.hideRecentSpotIds = [];
    this.hideExitGate = 'NOT_CONCEALED';
    this.hideTravelLength = null;
    this.hideEvaluateRemainingMs = 0;
    this.hideRecheckRemainingMs = 0;
    this.hideExitRetryRemainingMs = 0;
    this.hideEnterPending = false;
    this.hidePathStalls = 0;
    this.hideSpotCooldowns.clear();
    this.hideRecentSpots = [];
    this.lastHideProgressRatio = 0;
    this.lastHideAbortReason = 'NONE';
    this.hideEvents = [];
  }

  /** 退出藏身后回到既有 `RECOVER` 流程；不新增第二套「脱险后回米」逻辑。 */
  private enterRecoveryAfterHide(): void {
    this.state = 'RECOVER';
    this.lastTransitionReason = 'HIDE_EXITED_RESUME_RICE';
    this.recoveryBlockReason = 'NONE';
    this.recoverRemainingMs = GAME_CONFIG.deepseekAI.recoverMs;
    this.escapeTarget = null;
    this.escapeRoomId = null;
    this.escapeGoalScore = null;
    this.escapeCandidateScores = [];
    this.escapeExitThreatened = false;
    this.escapeReplanRemainingMs = 0;
    this.escapeGoalHoldRemainingMs = 0;
    this.previousVisibleDistance = null;
    this.stalledRepaths = 0;
    this.sprintDecision = 'RESUME_RICE';
    this.noMovementReason = 'HIDE_EXITED';
    this.path = [];
    this.pathIndex = 0;
    this.resetPathProgress();
  }

  /**
   * 是否「还有事可做」：至少一份未完成米堆从这里还能走到。
   * `threatFree` = 退出条件用的加强版：额外要求路线不穿过已知威胁的**抓捕半径**
   * （复用既有的有效抓捕半径，不新增第二个同义参数，也不用更宽的探索半径——
   * 藏身者本来就在最后一次目击点附近，用 3 u 会把所有路线一并否掉）。
   */
  private hasReachableRiceFrom(point: Point, input: DeepSeekAIInput,
    threatFree: boolean): boolean {
    const pending = input.rice.filter(rice => !rice.completed);
    if (!pending.length) return false;
    const threat = this.threatEstimate;
    if (!threatFree || !threat) return pending.some(rice =>
      !!this.navigation.findPath(point, rice, input.doors)?.length);
    const guard = this.effectiveCaptureRadius;
    return pending.some(rice => {
      const path = this.navigation.findPath(point, rice, input.doors);
      if (!path?.length) return false;
      return distance(rice, threat) >= guard &&
        path.every(step => distance(step, threat) >= guard);
    });
  }

  /**
   * 藏身的**值得性**判断（公开）：只有威胁已经贴近（`hideThreatDistance`）才考虑，
   * 并且藏身点必须是「更近的活路」——空手逃跑没有可行路线，或者藏身路线比逃跑路线更短。
   * 这样贴近时优先钻进家具，远离家具时继续按既有逃跑评分跑开，不会为了藏身横穿整层楼。
   */
  private tryStartHide(input: DeepSeekAIInput, threat: ThreatAssessment,
    deltaMs: number): DeepSeekAICommand | null {
    const cfg = GAME_CONFIG.deepseekAI;
    this.hideEvaluateRemainingMs = Math.max(0, this.hideEvaluateRemainingMs - deltaMs);
    const ratio = input.riceProgressRatio ?? 0;
    if (ratio > this.lastHideProgressRatio + 1e-6) {
      // 真实吃米进展 = 这一轮「连续藏身」的解除条件（不靠最大藏身时长兜底）。
      this.lastHideProgressRatio = ratio;
      this.hideConsecutiveCount = 0;
    }
    if (threat.level !== 'HIGH') {
      this.hideBlockedReason = 'THREAT_NOT_HIGH';
      return null;
    }
    const threatDistance = this.threatEstimate
      ? distance(input.deepseek, this.threatEstimate) : Infinity;
    if (threatDistance > cfg.hideThreatDistance) {
      this.hideBlockedReason = 'THREAT_TOO_FAR';
      return null;
    }
    if (this.hideConsecutiveCount >= cfg.hideMaxConsecutive) {
      this.hideBlockedReason = 'CONSECUTIVE_LIMIT';
      return null;
    }
    if (!input.hideMap || !input.hideWorld) {
      this.hideBlockedReason = 'NO_PUBLIC_HIDE_DATA';
      return null;
    }
    if (this.hideEvaluateRemainingMs > 0) return null;
    this.hideEvaluateRemainingMs = cfg.escapeReplanMs;
    const result = selectHideSpot({ map: input.hideMap, position: input.deepseek,
      doors: input.doors, threat: this.threatEstimate, world: input.hideWorld,
      cooldowns: this.hideCooldownSnapshot(), recentSpots: this.hideRecentSpots,
      nowMs: this.elapsedMs, preferredSpotId: this.hideSpotId });
    this.applyHideEvaluation(result);
    if (!result.ok || !result.candidate) {
      this.hideBlockedReason = result.code;
      this.noteHideAbort(result.code, null);
      return null;
    }
    const candidate = result.candidate;
    // 值得性判断刻意**只**用设计里已有的那一条：藏身路线必须比当前的逃跑路线更近
    // （或当前根本没有可行逃跑路线）。这里不额外引入「藏身点必须多近」的新门槛——
    // 真实公寓里两点之间的 A* 路线常常比直线长好几倍，任何绝对距离门槛都会让
    // 「被追进卧室后钻进床底」这种正常情形永远不触发。
    const escapeLength = this.escapeTarget && this.path.length
      ? this.pathLength(input.deepseek, this.path, this.escapeTarget) : null;
    if (escapeLength !== null && candidate.travelLength >= escapeLength) {
      this.hideBlockedReason = 'FLEEING_IS_CLOSER';
      return null;
    }
    if (!this.hasReachableRiceFrom(candidate.stancePoint, input, false)) {
      // 「没有可达米堆就不进入藏身」：这是防止藏到天荒地老的第一道兜底。
      this.hideBlockedReason = 'NO_REACHABLE_RICE';
      this.noteHideAbort('NO_REACHABLE_RICE', candidate.spotId);
      return null;
    }
    this.lastHideAbortReason = 'NONE';
    this.enterHideTravel(candidate);
    return this.updateHide(input, threat, deltaMs);
  }

  private applyHideEvaluation(result: DeepSeekHideCandidateResult): void {
    this.hideCandidateCount = result.legalStanceCount;
    this.hideCandidateSummary = result.reason;
    this.hideCandidateScores = result.evaluations.map(entry => ({ spotId: entry.spotId,
      code: entry.code, score: entry.score, travelLength: entry.travelLength,
      detail: entry.detail }));
  }

  /** 同一原因只记一次，避免每次重评估都刷屏。 */
  private noteHideAbort(code: string, spotId: string | null): void {
    if (this.lastHideAbortReason === code) return;
    this.lastHideAbortReason = code;
    this.recordHideEvent('HIDE_AI_ABORT', code, spotId);
  }

  private enterHideTravel(candidate: DeepSeekHideCandidate): void {
    this.state = 'HIDE';
    this.hidePhase = 'TRAVEL';
    this.hideSpotId = candidate.spotId;
    this.hideStancePoint = { ...candidate.stancePoint };
    this.hideTravelLength = candidate.travelLength;
    this.hideReason = 'THREAT_CLOSE_HIDE_CANDIDATE';
    this.hideBlockedReason = 'NONE';
    this.hidePathStalls = 0;
    this.hideEnterPending = false;
    this.hideExitGate = 'NOT_CONCEALED';
    this.path = [...candidate.path];
    this.pathIndex = 0;
    this.escapeTarget = null;
    this.escapeRoomId = null;
    this.escapeGoalScore = null;
    this.escapeCandidateScores = [];
    this.escapeExitThreatened = false;
    this.cancelPendingLock('ENTER_HIDE');
    this.resetPathProgress();
    this.lastTransitionReason = `THREAT_${this.threatSource}_HIDE`;
    this.sprintDecision = 'HIDE_TRAVEL';
  }

  private updateHide(input: DeepSeekAIInput, threat: ThreatAssessment,
    deltaMs: number): DeepSeekAICommand {
    for (const [id, remaining] of this.hideSpotCooldowns) {
      if (remaining <= deltaMs) this.hideSpotCooldowns.delete(id);
      else this.hideSpotCooldowns.set(id, remaining - deltaMs);
    }
    this.hideCooldownSummary = this.hideSpotCooldowns.size
      ? [...this.hideSpotCooldowns.entries()].map(([id, ms]) =>
        `${id}:${(ms / 1000).toFixed(1)}s`).join('｜') : '无';
    if (this.hidePhase === 'CONCEALED' || this.hidePhase === 'EXIT')
      return this.updateConcealed(input, threat, deltaMs);
    if (this.hidePhase === 'NONE') {
      this.state = 'EVADE';
      return this.command();
    }
    return this.updateHideTravel(input);
  }

  private updateHideTravel(input: DeepSeekAIInput): DeepSeekAICommand {
    const stance = this.hideStancePoint;
    const spotId = this.hideSpotId;
    if (!stance || !spotId || !this.hideSpotSnapshot(input.hideMap ?? null, spotId)) {
      this.abortHidePlan('PLAN_INVALID');
      return this.command();
    }
    // 真实危险：抓捕已经开始或自己已经摔倒，藏身也救不回来，立刻回到逃跑。
    if ((input.captureProgressMs ?? 0) > 0) {
      this.abortHidePlan('CAPTURE_ATTEMPT');
      return this.command();
    }
    if (input.sprintState === 'STUNNED') {
      this.abortHidePlan('STUNNED');
      return this.command();
    }
    const arrived = distance(input.deepseek, stance) <=
      GAME_CONFIG.deepseekAI.waypointTolerance + GAME_CONFIG.collision.contactEpsilon;
    if (arrived) {
      if (!this.hideEnterPending) {
        this.hideEnterPending = true;
        this.hideRequestCount++;
        this.hideReason = 'ARRIVED_REQUEST_ENTER';
        // 事件带公开理由；真正的裁决在游戏层，回执只给结果码。
        this.recordHideEvent('HIDE_AI_REQUEST', `ARRIVED:${spotId}`, spotId);
      }
      this.noMovementReason = 'HIDE_ENTER_REQUEST';
      this.sprintDecision = 'HIDE_ENTER_REQUEST';
      return { ...this.command(), hideSpotId: spotId,
        hideRequestToken: input.hideRequestToken ?? null };
    }
    if (!this.path.length) {
      const path = this.navigation.findPath(input.deepseek, stance, input.doors);
      if (!path?.length) {
        this.abortHidePlan('NO_ROUTE_TO_HIDE_SPOT');
        return this.command();
      }
      this.path = path;
      this.pathIndex = 0;
      this.resetPathProgress();
    }
    this.noMovementReason = 'HIDE_TRAVEL';
    this.sprintDecision = 'HIDE_TRAVEL';
    const movement = this.followPath(input, stance);
    if (movement.openDoorId) this.noMovementReason = 'OPENING_DOOR';
    else if (movement.direction.x === 0 && movement.direction.z === 0)
      this.noMovementReason = 'HIDE_PATH_BLOCKED';
    return movement;
  }

  private updateConcealed(input: DeepSeekAIInput, threat: ThreatAssessment,
    deltaMs: number): DeepSeekAICommand {
    const cfg = GAME_CONFIG.deepseekAI;
    this.hideConcealedMs += deltaMs;
    this.hideRecheckRemainingMs = Math.max(0, this.hideRecheckRemainingMs - deltaMs);
    this.hideExitRetryRemainingMs = Math.max(0, this.hideExitRetryRemainingMs - deltaMs);
    this.noMovementReason = 'HIDING_CONCEALED';
    this.sprintDecision = 'HIDDEN';
    if (this.hidePhase === 'EXIT') {
      // 回执在同一帧内到达；没有回执说明这一帧的请求没有被处理，退回藏身等下一次
      // 重查，绝不逐帧重复发请求。
      this.hidePhase = 'CONCEALED';
      this.hideRecheckRemainingMs = cfg.hideRecheckMs;
      this.noMovementReason = 'HIDE_EXIT_AWAITING_RECEIPT';
      return this.command();
    }
    if (this.hideRecheckRemainingMs > 0) return this.command();
    this.hideRecheckRemainingMs = cfg.hideRecheckMs;
    const gate = this.evaluateHideExit(input, threat);
    this.hideExitGate = gate.code;
    if (!gate.ok) {
      this.hideReason = `CONCEALED:${gate.code}`;
      return this.command();
    }
    this.hidePhase = 'EXIT';
    this.hideReason = gate.reason;
    this.recordHideEvent('HIDE_AI_EXIT_REQUEST', gate.reason, this.hideSpotId);
    return { ...this.command(), hideExitRequest: true };
  }

  /**
   * 退出条件（全部公开，任一条不成立就继续藏着并按 `hideRecheckMs` 重查）：
   *   ① 最短藏身时长已满（防「一进就出」）；
   *   ② 威胁已解除：当前看不见 Human，且新鲜的已知威胁点已经在安全间距之外；
   *   ③ 还有事可做：存在一条可达且不穿过已知威胁半径的未完成米堆路线；
   *   ④ 可选的 `hideMaxConcealMs`（默认 0 = 不限制）只是兜底，仍须过 ③。
   * 出口的**物理**安全（Human 角色圆是否压住出口）由游戏层裁决，AI 只收到结果码。
   */
  private evaluateHideExit(input: DeepSeekAIInput,
    threat: ThreatAssessment): { ok: boolean; code: string; reason: string } {
    const cfg = GAME_CONFIG.deepseekAI;
    if (this.hideConcealedMs < cfg.hideMinConcealMs) {
      return { ok: false, code: 'MIN_CONCEAL_MS', reason: '最短藏身时间未到' };
    }
    if (input.visibleHuman) {
      return { ok: false, code: 'THREAT_STILL_VISIBLE', reason: '仍能看见 Human' };
    }
    const fresh = threat.source === 'LAST_SEEN' || threat.source === 'SOUND';
    if (fresh && this.threatEstimate) {
      const separation = distance(input.deepseek, this.threatEstimate);
      if (separation < cfg.escapeMinSeparation) {
        return { ok: false, code: 'THREAT_STILL_NEAR',
          reason: `已知威胁仍在 ${separation.toFixed(2)} u 内` };
      }
    }
    if (cfg.hideMaxConcealMs > 0 && this.hideConcealedMs >= cfg.hideMaxConcealMs) {
      if (!this.hasReachableRiceFrom(input.deepseek, input, true)) {
        return { ok: false, code: 'MAX_CONCEAL_NO_ROUTE',
          reason: '已达可选最大藏身时长但没有安全的米堆路线' };
      }
      return { ok: true, code: 'MAX_CONCEAL_MS', reason: '达到可选最大藏身时长' };
    }
    if (!this.hasReachableRiceFrom(input.deepseek, input, true)) {
      return { ok: false, code: 'NO_SAFE_RICE_ROUTE',
        reason: '没有可达且不穿过已知威胁的米堆路线' };
    }
    return { ok: true, code: 'THREAT_CLEARED', reason: '威胁解除且仍有可达米堆' };
  }

  /** A crossing is physical movement through the open leaf, not merely proximity. */
  private trackDoorCrossings(input: DeepSeekAIInput): void {
    for (const door of input.doors) {
      const node = this.doorNodes.get(door.id);
      if (!node) continue;
      const signed = node.rotation === 0
        ? input.deepseek.z - node.z : input.deepseek.x - node.x;
      const side = Math.abs(signed) <= GAME_CONFIG.door.leafThickness / 2
        ? 0 : Math.sign(signed);
      const previous = this.lastDoorSide.get(door.id);
      if (side && previous && side !== previous && door.state === 'OPEN' &&
          distanceToDoorSegment(input.deepseek.x, input.deepseek.z, node) <=
            GAME_CONFIG.door.interactionRange) {
        this.recentDoorCrossing.set(door.id, this.elapsedMs);
        this.doorEscapeLastCrossedId = door.id;
      }
      if (side) this.lastDoorSide.set(door.id, side);
    }
  }

  private doorDecision(type: string, id: string | null, reason: string): void {
    const signature = `${type}:${id ?? 'NONE'}:${reason}`;
    if (signature === this.lastDoorDecision) return;
    this.lastDoorDecision = signature;
    this.doorEscapeReason = reason;
    const eventReason = `${id ?? 'NONE'}:${reason}`;
    if (type === 'DOOR_ESCAPE_SKIP') this.doorEscapeSkipReason = reason;
    else this.doorEscapeSkipReason = 'NONE';
    this.doorEscapeEvents.push({ type, reason: eventReason });
  }

  drainDoorEscapeEvents(): { type: string; reason: string }[] {
    return this.doorEscapeEvents.splice(0);
  }

  private evaluateEscapeDoor(input: DeepSeekAIInput): string | null {
    const cfg = GAME_CONFIG.deepseekAI;
    const candidates = input.doors.filter(door => door.state === 'OPEN')
      .map(door => ({ door, node: this.doorNodes.get(door.id) }))
      .filter((item): item is { door: DoorState; node: DoorNode } => !!item.node)
      .map(item => ({ ...item, distance: distanceToDoorSegment(
        input.deepseek.x, input.deepseek.z, item.node) }))
      .filter(item => item.distance <= GAME_CONFIG.door.interactionRange)
      .sort((a, b) => a.distance - b.distance);
    const candidate = candidates[0];
    this.doorEscapeCandidateId = candidate?.door.id ?? null;
    this.doorEscapeDistance = candidate?.distance ?? null;
    this.doorEscapePassed = !!candidate &&
      this.elapsedMs - (this.recentDoorCrossing.get(candidate.door.id) ?? -Infinity) <=
        cfg.doorEscapeCrossingWindowMs;
    this.doorEscapeHumanOpposite = null;
    this.doorEscapeRouteSafe = false;
    const reject = (reason: string): null => {
      this.doorDecision('DOOR_ESCAPE_SKIP', candidate?.door.id ?? null, reason);
      return null;
    };
    if (!candidate) return reject('NO_NEARBY_OPEN_DOOR');
    const { door, node } = candidate;
    if (!this.doorEscapePassed) return reject('DOOR_NOT_RECENTLY_PASSED');
    // A running sprint no longer voids a real door opportunity. The door action
    // is a separate one-shot interaction and does not stop the sprint
    // (SprintSystem.movementDirection keeps using lastDirection), so the sprint
    // commitment and its 30% risk outcome stay intact.
    if (this.elapsedMs - (this.closedDoorAt.get(door.id) ?? -Infinity) <
        cfg.doorEscapeCooldownMs) return reject('DOOR_COOLDOWN');
    // Only current sight gives a reliable side. Sound bearing and stale memory
    // cannot prove the pursuer is still behind this particular door.
    if (!input.visibleHuman) return reject('HUMAN_SIDE_UNKNOWN');
    const deepseekSide = node.rotation === 0
      ? input.deepseek.z - node.z : input.deepseek.x - node.x;
    const humanSide = node.rotation === 0
      ? input.visibleHuman.z - node.z : input.visibleHuman.x - node.x;
    this.doorEscapeHumanOpposite = deepseekSide * humanSide < 0;
    if (!this.doorEscapeHumanOpposite) return reject('HUMAN_ALREADY_SAME_SIDE');
    if (distance(input.deepseek, input.visibleHuman) <
        cfg.doorEscapeMinHumanDistance) return reject('HUMAN_TOO_CLOSE');
    if (input.canCloseDoor && !input.canCloseDoor(door.id))
      return reject('DOOR_OCCUPIED_OR_INACCESSIBLE');
    if (!this.escapeTarget) return reject('NO_ESCAPE_GOAL');
    const blocked = new Set([door.id]);
    const routeAfterClose = this.navigation.findPath(input.deepseek,
      this.escapeTarget, input.doors, undefined, null, blocked);
    this.doorEscapeRouteSafe = !!routeAfterClose?.length;
    if (!this.doorEscapeRouteSafe) return reject('ESCAPE_ROUTE_USES_DOOR');
    const pursuitRoute = this.navigation.findPath(input.visibleHuman,
      this.escapeTarget, input.doors);
    if (!pursuitRoute?.some(step => step.doorId === door.id))
      return reject('DOOR_DOES_NOT_DELAY_PURSUER');
    const duringSprint = input.sprintState === 'SPRINT_RUNNING';
    if (duringSprint) this.doorEscapeDuringSprintCount += 1;
    this.doorDecision('DOOR_ESCAPE_EVALUATE', door.id,
      duringSprint ? 'CLOSE_DURING_SPRINT' : 'CLOSE_HAS_PURSUIT_VALUE');
    // Approved fix: the close just confirmed BY SIGHT that the Human is on the
    // far side of this door. Remember only that confirmed side fact, bound to
    // this door and this continuous action, so the now-shut leaf blocking sight
    // cannot invalidate a lock that is still structurally safe.
    this.doorLockEvidence = { doorId: door.id, deepseekSide: Math.sign(deepseekSide) };
    this.doorLockEvidenceDoorId = door.id;
    return door.id;
  }

  onDoorEscapeResult(id: string, result: string): void {
    this.doorEscapeLastResult = `${id}:${result}`;
    // A failed close also waits briefly, rather than attempting every frame.
    this.closedDoorAt.set(id, this.elapsedMs);
    this.doorEscapeCooldownRemainingMs = GAME_CONFIG.deepseekAI.doorEscapeCooldownMs;
    this.doorDecision(result === 'CLOSED' ? 'DOOR_ESCAPE_CLOSE' :
      'DOOR_ESCAPE_FAILED', id, result);
    // 3B-1 fix: a successful self-initiated close inside its crossing window
    // continues into a pending lock ONLY when that same close also recorded the
    // sight-confirmed far-side evidence for this same door. Any other outcome
    // leaves nothing pending, and the log distinguishes the three cases:
    // no pending vs pending-without-evidence vs pending established.
    const crossing = this.recentDoorCrossing.get(id);
    const inWindow = crossing !== undefined &&
      this.elapsedMs - crossing <= GAME_CONFIG.deepseekAI.doorEscapeCrossingWindowMs;
    if (result === 'CLOSED') {
      this.doorEscapeCloseCount += 1;
      this.doorLockLastCloseId = id;
    }
    const evidence = this.doorLockEvidence;
    const evidenceMatches = !!evidence && evidence.doorId === id &&
      evidence.deepseekSide !== 0;
    if (result === 'CLOSED' && inWindow && evidenceMatches) {
      this.doorLockPendingId = id;
      this.doorLockPendingSinceMs = crossing ?? null;
      this.doorLockPendingCount += 1;
      // A fresh continuous action must be able to report its own outcome even
      // when it repeats the previous door/reason pair; otherwise the dedup in
      // doorLockDecision silently hides real rejections from the AI log.
      this.lastDoorLockDecision = '';
      this.doorLockDecision('DOOR_LOCK_PENDING', id, 'CLOSE_CONFIRMED_FAR_SIDE');
    } else {
      this.clearPendingLockState();
      if (result === 'CLOSED' && inWindow && !evidenceMatches) {
        this.lastDoorLockDecision = '';
        this.doorLockDecision('DOOR_LOCK_SKIP', id, 'NO_CLOSE_SIDE_EVIDENCE');
      }
    }
  }

  /** Drops the continuous action silently; the caller already logged the why. */
  private clearPendingLockState(): void {
    this.doorLockPendingId = null;
    this.doorLockPendingSinceMs = null;
    this.doorLockEvidence = null;
    this.doorLockEvidenceDoorId = null;
    this.doorLockAttemptedId = null;
  }

  /** Doors DeepSeek shut itself inside the same-door cooldown. Re-opening one
   *  right away would hand the pursuer the very opening we just took away, so
   *  escape planning avoids them (see selectEscapeGoal / followPath). */
  private recentlySelfClosedDoors(): Set<string> {
    const blocked = new Set<string>();
    for (const [id, at] of this.closedDoorAt)
      if (this.elapsedMs - at < GAME_CONFIG.deepseekAI.doorEscapeCooldownMs) blocked.add(id);
    return blocked;
  }

  private isRecentlySelfClosed(id: string): boolean {
    const at = this.closedDoorAt.get(id);
    return at !== undefined &&
      this.elapsedMs - at < GAME_CONFIG.deepseekAI.doorEscapeCooldownMs;
  }

  /** Drops the continuous action before evaluation and records the reason. */
  private cancelPendingLock(reason: string): void {
    const id = this.doorLockPendingId;
    this.clearPendingLockState();
    if (id) {
      this.doorLockCancelCount += 1;
      this.doorLockDecision('DOOR_LOCK_CANCEL', id, reason);
    }
  }

  /** Mirrors doorDecision: identical outcomes are recorded once, not per frame. */
  private doorLockDecision(type: string, id: string | null, reason: string): void {
    const signature = `${type}:${id ?? 'NONE'}:${reason}`;
    if (signature === this.lastDoorLockDecision) return;
    this.lastDoorLockDecision = signature;
    this.doorLockReason = reason;
    if (type === 'DOOR_LOCK_SKIP') this.doorLockSkipReason = reason;
    else this.doorLockSkipReason = 'NONE';
    this.doorLockEvents.push({ type, reason: `${id ?? 'NONE'}:${reason}` });
  }

  drainDoorLockEvents(): { type: string; reason: string }[] {
    return this.doorLockEvents.splice(0);
  }

  /**
   * 3B-0b channel only: records the outcome of a lock command that ThreeGame
   * executed. The pending-lock decision is 3B-1 work, so nothing calls this
   * while lockDoorId stays null.
   */
  onDoorLockResult(id: string, result: string): void {
    this.doorLockLastResult = `${id}:${result}`;
    if (result === 'LOCKED') this.doorLockAppliedCount += 1;
    this.doorLockDecision(result === 'LOCKED' ? 'DOOR_LOCK_APPLY' : 'DOOR_LOCK_FAILED',
      id, result);
    // Success or failure both end the continuous action; never retry in place.
    if (this.doorLockPendingId === id) this.clearPendingLockState();
  }

  /**
   * 3B-1: evaluates the pending lock created by a successful self-initiated
   * close. Cheap conditions come first; the two A* reachability checks (escape
   * route + remaining rice) run once here. The execution side
   * (lockDoorFromCommand) re-checks the lightweight interaction conditions.
   * Any failure clears the pending so the same continuous action never retries.
   */
  private evaluateEscapeLock(input: DeepSeekAIInput, approachSpeed: number): string | null {
    const cfg = GAME_CONFIG.deepseekAI;
    const pendingId = this.doorLockPendingId;
    if (!pendingId) return null;
    // One lock attempt per continuous action: if a pending somehow survives an
    // already-issued attempt, refuse to fire a second one for it.
    if (this.doorLockAttemptedId === pendingId) {
      this.doorLockRepeatBlockedCount += 1;
      return null;
    }
    // Sticky for the DEV panel: did the most recent evaluation rely on the
    // close-time side evidence (blind) or on fresh sight?
    this.doorLockUsedEvidence = false;
    const node = this.doorNodes.get(pendingId);
    const door = input.doors.find(candidate => candidate.id === pendingId);
    const reject = (reason: string): null => {
      this.clearPendingLockState();
      this.doorLockDecision('DOOR_LOCK_SKIP', pendingId, reason);
      return null;
    };
    if (!node || !door) return reject('DOOR_MISSING');
    if (door.state !== 'CLOSED') return reject('DOOR_REOPENED');
    const crossing = this.recentDoorCrossing.get(pendingId);
    if (crossing === undefined ||
        this.elapsedMs - crossing > cfg.doorEscapeCrossingWindowMs)
      return reject('CROSSING_WINDOW_EXPIRED');
    if ((input.captureProgressMs ?? 0) > 0) return reject('CAPTURE_IN_PROGRESS');
    if (input.sprintState === 'STUNNED') return reject('STUNNED');
    // A running sprint no longer voids the pending lock either. The lock is a
    // one-shot door action that never interrupts the sprint, so the sprint
    // commitment and its 30% risk outcome stay intact. STUNNED still blocks.
    if (input.sprintState === 'SPRINT_RUNNING') this.doorLockDuringSprintCount += 1;
    const deepseekSideNow = node.rotation === 0
      ? input.deepseek.z - node.z : input.deepseek.x - node.x;
    let usedCloseSideEvidence = false;
    if (input.visibleHuman) {
      // Fresh sight always wins: any change of side, distance or approach
      // invalidates the stored close-time observation.
      const humanSide = node.rotation === 0
        ? input.visibleHuman.z - node.z : input.visibleHuman.x - node.x;
      if (deepseekSideNow * humanSide >= 0) return reject('HUMAN_ALREADY_SAME_SIDE');
      const humanDistance = distance(input.deepseek, input.visibleHuman);
      if (humanDistance < cfg.doorEscapeMinHumanDistance) return reject('HUMAN_TOO_CLOSE');
      if (approachSpeed >= cfg.approachSpeedThreshold &&
          humanDistance <= cfg.riskySprintDistance) return reject('HUMAN_APPROACHING');
    } else {
      // Blind because this very door is now shut. Reuse ONLY the side that sight
      // confirmed at close time, bound to this door and this continuous action.
      // It is never treated as a live Human position, nor as proof that the old
      // distance is still safe: every current fact is re-verified instead.
      const evidence = this.doorLockEvidence;
      if (!evidence || evidence.doorId !== pendingId || evidence.deepseekSide === 0)
        return reject('NO_CLOSE_SIDE_EVIDENCE');
      if (Math.sign(deepseekSideNow) !== evidence.deepseekSide)
        return reject('DEEPSEEK_SIDE_CHANGED');
      usedCloseSideEvidence = true;
    }
    if (input.canLockDoor && !input.canLockDoor(pendingId))
      return reject('DOOR_OCCUPIED_OR_INACCESSIBLE');
    if ((input.activeLockSlots ?? 0) <= 0) return reject('LOCK_LIMIT_REACHED');
    if (door.lockCoreState !== 'ACTIVE' || door.locked) return reject('LOCK_CORE_UNAVAILABLE');
    if (!this.escapeTarget) return reject('NO_ESCAPE_GOAL');
    const blocked = new Set([pendingId]);
    const routeAfterLock = this.navigation.findPath(input.deepseek,
      this.escapeTarget, input.doors, undefined, null, blocked);
    if (!routeAfterLock?.length) return reject('ESCAPE_ROUTE_USES_DOOR');
    // Temporary avoidance is not completion: at least one uncompleted rice must
    // stay reachable, so the AI cannot seal off every future target.
    const riceReachable = input.rice.some(rice =>
      !rice.completed &&
      !!this.navigation.findPath(input.deepseek, rice, input.doors, undefined,
        null, blocked)?.length);
    if (!riceReachable) return reject('ALL_RICE_UNREACHABLE');
    this.doorLockUsedEvidence = usedCloseSideEvidence;
    this.doorLockDecision('DOOR_LOCK_EVALUATE', pendingId, usedCloseSideEvidence
      ? 'LOCK_WITH_CLOSE_SIDE_EVIDENCE' : 'LOCK_WITH_CURRENT_SIGHT');
    this.doorLockCommandCount += 1;
    this.doorLockAttemptedId = pendingId;
    return pendingId;
  }

  private beginRecovery(input: DeepSeekAIInput): DeepSeekAICommand {
    this.state = 'RECOVER';
    this.loopReplanPending = false;
    this.cancelPendingLock('RECOVERY_STARTED');
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
      if (this.state === 'SAFE_WAIT') return this.command();
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
    avoidCurrentRoom = false, preferFresh = false, allowRecentlyClosed = false): void {
    if (!this.threatEstimate) return;
    this.lastEscapeDecisionReason = reason;
    const cfg = GAME_CONFIG.deepseekAI;
    // Never plan an escape that immediately undoes a door we just shut. If that
    // leaves no route at all, fall back once to using it: re-opening a door is
    // still better than standing still in front of a pursuer.
    const blockedDoors = allowRecentlyClosed
      ? new Set<string>() : this.recentlySelfClosedDoors();
    const candidates = this.rooms.map(room => {
        const goal = this.navigation.nearestFree(room, input.doors);
        if (!goal) return null;
        let path = this.navigation.findPath(input.deepseek, goal, input.doors,
          this.avoidedWaypoint ?? undefined, null, blockedDoors);
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
            input.doors, undefined, null, new Set([firstDoorId, ...blockedDoors]));
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
          this.effectiveVisionRange).status === 'BLOCKED';
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
    if (!candidates.length && blockedDoors.size) {
      this.selectEscapeGoal(input, `${reason}_SELF_CLOSED_FALLBACK`, force,
        avoidCurrentRoom, preferFresh, true);
      return;
    }
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
    const passageHuman = this.passageActive ? this.knownHumanPosition(input) :
      this.safeWaitObservation ? this.threatEstimate : null;
    while (this.pathIndex < this.path.length &&
        distance(input.deepseek, this.path[this.pathIndex]) <=
        GAME_CONFIG.deepseekAI.waypointTolerance) {
      const next = this.path[this.pathIndex + 1] ?? goal;
      if (passageHuman && distanceToXZSegment(passageHuman, input.deepseek, next) <
          this.passageAvoidRadius) break;
      this.pathIndex++;
    }
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
      // Never immediately undo a door we shut ourselves while its cooldown runs.
      // selectEscapeGoal already excludes these, so this only catches a path
      // planned before the close; it repaths instead of re-opening.
      if (this.isRecentlySelfClosed(id)) {
        this.doorEscapeSelfReopenBlockedCount += 1;
        this.doorDecision('DOOR_ESCAPE_SELF_CLOSED', id, 'REPATH_AVOID_SELF_CLOSED');
        this.path = [];
        this.lastNavigationReason = 'SELF_CLOSED_DOOR_REPATH';
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
    // A trial must not cut a safe grid corner or overshoot its waypoint into
    // the avoided circle. This does not change ordinary navigation/player speed.
    const stride = passageHuman ? Math.max(length, this.moveSpeed() * input.deltaMs / 1000) : length;
    return length > 0 ? this.command(dx / stride, dz / stride) : this.command();
  }

  private selectRice(input: DeepSeekAIInput): boolean {
    const candidates = input.rice
      .filter(rice => !rice.completed && !this.avoidedRiceMs.has(rice.id) &&
        rice.id !== this.safeWaitRiceId)
      .map(rice => {
        const path = this.navigation.findPath(input.deepseek, rice, input.doors);
        return path?.length ? { rice, path, score: this.score(input.deepseek, rice, path) } : null;
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => a.score - b.score || a.rice.id.localeCompare(b.rice.id));
    const selected = candidates[0];
    if (!selected) {
      if (this.safeWaitRiceId && input.rice.some(rice =>
          rice.id === this.safeWaitRiceId && !rice.completed)) {
        this.enterSafeWait(this.safeWaitRiceId);
        return false;
      }
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
    return length / this.moveSpeed() * 1000 +
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
      if (this.passageActive) {
        if (this.stalledRepaths >= GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget) {
          this.finishPassage('PASSAGE_PATH_STALLED');
          this.enterEvade('VISION');
        } else {
          this.path = [];
          this.pathIndex = 0;
          this.passageRouteSafe = false;
          this.lastNavigationReason = 'PASSAGE_STALLED_REPATH';
          this.resetPathProgress();
        }
        return;
      }
      if (this.state === 'CURIOUS_APPROACH' || this.curiosityBypassActive) {
        this.finishCuriosity('CURIOSITY_PATH_STALLED');
        this.enterEvade('VISION');
        return;
      }
      if (this.state === 'HIDE') {
        // S7C-2b：走位到藏身点的卡路处理必须有界——允许换一条路，超过上限就
        // 放弃这个点并回到 EVADE，绝不无限重寻路。
        this.hidePathStalls++;
        if (this.hidePathStalls >= GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget) {
          this.abortHidePlan('TRAVEL_STALLED');
        } else {
          this.avoidedWaypoint = { x: waypoint.x, z: waypoint.z };
          this.path = [];
          this.pathIndex = 0;
          this.lastNavigationReason = 'HIDE_PATH_STALLED_REPATH';
          this.resetPathProgress();
        }
        return;
      }
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
    return { direction: { x, z }, openDoorId, closeDoorId: null, lockDoorId: null,
      eatRiceId, startSprint: false, hideSpotId: null, hideRequestToken: null,
      hideExitRequest: false };
  }
}
