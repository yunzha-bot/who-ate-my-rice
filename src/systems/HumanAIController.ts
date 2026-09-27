import { GAME_CONFIG } from '../config/gameConfig.ts';
import { distanceToDoorSegment, type DoorState } from './DoorSystem.ts';
import type { HeardSound, LastSeen, RiceTrace } from './PerceptionSystem.ts';
import { NavigationSystem, type NavStep } from './NavigationSystem.ts';
import type { DoorNode, HideSpot, Point, Rect, Room } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';
import type { GamePhase } from './GameStateSystem.ts';
import type { RuntimeTuning } from './RuntimeDebugOverrides.ts';
import { RiceTraceClueMemory, selectVisibleTraces, type TraceClue }
  from './RiceTraceClues.ts';
import { inferTraceDirection, TRACE_CONFIDENCE_TEXT, TRACE_INFERENCE_CODE_TEXT,
  type TraceInference } from './HumanTraceTracking.ts';
import { gateHideSearchByClues, gateLastSeenRoomSearch, rankHideSearchCandidates }
  from './HideSearchCandidates.ts';
import { planHideSearchStance, type HideSearchStance }
  from './HumanHideSearchStance.ts';
import { CANDIDATE_TRY_LIMIT, STANCE_MAX_STALE_CANCELS } from './HumanSearchTuning.ts';
import { evaluateHideStance } from './HumanHideSearchResolution.ts';

export type HumanAIState = 'PATROL' | 'INVESTIGATE' | 'CHASE' | 'CAPTURE' |
  'SEARCH' | 'CHECK_HIDE';
export type HumanAILockDecision = 'NONE' | 'DETOUR' | 'UNLOCK' | 'FORCE_BREAK';

/**
 * S7C-2：Human AI 拿到的**已应用公开世界快照** —— 地图数据 + 真实几何接缝。
 * 只有公开信息：藏身点 ID、家具位置/朝向/尺寸，以及「能不能站」「能不能看见」
 * 「有没有被墙或非 OPEN 门挡住」这三条真实几何判定。这里没有、也永远不会有
 * 占用状态、隐藏角色实时坐标或开发者专用真值字段。
 *
 * 三个几何回调的缺省值是**失败即拒绝**（看不见、站不住、被挡住），这样忘记接线
 * 时 AI 不会意外获得搜查能力。
 */
export interface HumanAIMapSnapshot {
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
  /** 真实可视性：距离 + 墙体 + 非 OPEN 门叶（与视觉同源）。 */
  canSee?: (from: Point, to: Point, maxRange: number) => boolean;
  /** Human 角色圆的真实可站立判定（复用 CollisionWorld）。 */
  standable?: (point: Point) => boolean;
  /** 真实遮挡判定：墙体 + 非 OPEN 门叶，用于搜查交互线。 */
  lineBlocked?: (a: Point, b: Point) => boolean;
}

/** S7C-2：CHECK_HIDE 的执行阶段。 */
export type HumanCheckHidePhase = 'NONE' | 'TRAVEL' | 'DWELL' | 'DONE';

/** S7C-2：正式搜查的公开结果（AI 只知道「搜中 / 搜空」，不含任何真实坐标）。 */
export type HumanCheckHideResult = 'NONE' | 'HIT' | 'MISS';

/** S7C-2：一次藏身搜查的来源（全部是公开依据）。 */
export type HumanCheckHideSource = 'LAST_SEEN' | 'SOUND' | 'TRACE' | 'SEARCH'
  | 'LAST_SEEN_ROOM';

/**
 * S7C-2 修复轮：公开米痕线索「被延后处理」的公开原因。
 *
 * 新增的原因码用于说明「这批线索不是被丢掉，而是被更高优先级状态暂时压住」，
 * 它们只由公开状态推导（真实目视 / 新 Last Seen / 强危险声 / 正在执行的正式搜查），
 * 不读取任何隐藏信息。
 */
export type HumanClueDeferReason = 'NONE' | 'CHECK_HIDE' | 'TARGET_VISIBLE' | 'LAST_SEEN'
  | 'DANGER_SOUND' | 'TRACE_INVESTIGATION';

export const HUMAN_CLUE_DEFER_TEXT: Record<HumanClueDeferReason, string> = {
  NONE: '没有被延后',
  CHECK_HIDE: '正在执行正式家具搜查',
  TARGET_VISIBLE: '当前真实目视目标优先',
  LAST_SEEN: 'Last Seen 证据优先（含正在进行的 Last Seen 调查）',
  DANGER_SOUND: '新的强危险声音优先',
  TRACE_INVESTIGATION: '正在执行上一次米痕调查',
};

/** S7C-2：放弃搜查 / 循迹的公开原因码。 */
export type HumanCheckGiveUpReason = 'NONE' | 'NO_CLUE' | 'NO_CANDIDATE'
  | 'ALL_CANDIDATES_COOLED' | 'NO_LEGAL_STANCE' | 'CANDIDATES_UNREACHABLE'
  | 'ROUND_BUDGET_USED' | 'SAME_CLUE_BATCH' | 'CLUE_EXPIRED' | 'CLUE_TOO_WEAK'
  | 'TARGET_VISIBLE' | 'DANGER_SOUND' | 'SEARCH_COMPLETE' | 'CHECK_TIMEOUT'
  | 'NO_ROUTE' | 'MANUAL_CONTROL' | 'MAP_REBUILT' | 'ROUND_RESET' | 'CHECK_DONE'
  | 'PLAN_STALE' | 'NO_SAME_ROOM_CANDIDATE'
  // S7C-2 修复轮 二：正式判定层给出的「未完成合法检查」（站位 / 朝向 / 超出半径 /
  // 不在扇形 / 被墙门挡住）。它不是搜空：不写公开失败记忆，也不进 6 秒家具冷却。
  | 'CHECK_INCOMPLETE';

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
  // S7C-2 公开线索输入（全部可选，缺省等于「没有这些信息」）。
  /** 与米痕系统同一个正式玩法时钟。 */
  nowMs?: number;
  /** 图层 B：当前真正看得见的米痕（调用方已用正式视觉几何过滤）。 */
  visibleTraces?: readonly RiceTrace[];
  /** 现有「追捕型危险声」分类的结果；用于抢占搜查。 */
  heardDanger?: HeardSound | null;
}

export interface HumanAICommand {
  direction: Point;
  openDoorId: string | null;
  unlockDoorId: string | null;
  forceBreakDoorId: string | null;
  /** S7C-2：AI 明确要求的面向朝向（弧度），null 表示不改变朝向。 */
  faceHeadingRad: number | null;
  /** S7C-2：AI 已完成合法站位与停留，请求执行一次正式搜查判定。 */
  checkHideSpotId: string | null;
}

export interface HumanAIPathProgress {
  waypoint: NavStep;
  index: number;
  total: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

export function humanAiMovementSpeed(baseHumanSpeed: number,
  multiplier: number = GAME_CONFIG.humanAI.movementSpeedMultiplier): number {
  return baseHumanSpeed * multiplier;
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
  /** S7C-2 修复轮：上一状态（DEV / AI JSON 需要「当前状态 + 前一状态」）。 */
  previousState: HumanAIState = 'PATROL';
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
  private investigationSource: 'SOUND' | 'LAST_SEEN' | 'TRACE' | null = null;
  private dwellRemainingMs = 0;
  private handledSound: HeardSound['event'] | null = null;
  private handledDangerSound: HeardSound['event'] | null = null;
  private handledLastSeenTime = -1;
  /** 公开记忆里最近一次 Last Seen（只用于 DEV / 日志展示有效性与房间）。 */
  private lastKnownLastSeen: LastSeen | null = null;
  // ---- S7C-2：公开线索记忆、公开推断、公开家具候选与 CHECK_HIDE ----
  /** 图层 C：Human AI 亲自看到并记住的米痕线索（有限、按原实体过期）。 */
  readonly clueMemory = new RiceTraceClueMemory();
  /** 由公开线索算出的方向推断（DEV / 日志可读，不含任何隐藏信息）。 */
  traceInference: TraceInference = inferTraceDirection([]);
  clueSignature = 'NO_CLUE';
  /** 当前公开候选排序结果（ID，高→低）。 */
  suspectedSpotIds: string[] = [];
  /** 当前怀疑家具的公开排序依据。 */
  candidateBasis: string[] = [];
  candidateRanking = '无';
  /** 候选排序里被排除的公开原因（DEV / 日志用）。 */
  candidateSkipped = '无';
  // ---- S7C-2 修复轮 一：被高优先级状态延后的公开线索批次 ----
  /** 已发现但还没有用于发起任务的公开线索数。 */
  pendingClueCount = 0;
  /** 这批线索中最晚的有效截止（来自原米痕实体，绝不续期）。 */
  pendingClueValidUntilMs = 0;
  /** 本帧这批线索被谁压住了（公开原因）。 */
  pendingClueDeferReason: HumanClueDeferReason = 'NONE';
  /** 延后事件发生次数（去重后）。 */
  pendingClueDeferCount = 0;
  /** 实际发生的「延后线索重评」次数。 */
  pendingClueReevalCount = 0;
  checkHidePhase: HumanCheckHidePhase = 'NONE';
  checkHideSpotId: string | null = null;
  checkHideStance: HideSearchStance | null = null;
  checkHideDwellRemainingMs = 0;
  readonly checkHideDwellMs = GAME_CONFIG.humanAI.searchDwellMs;
  checkHideSource: HumanCheckHideSource | null = null;
  /**
   * 本轮**已经正式开始**的搜查尝试数（配额守卫）。
   * 它与 `checkHideRoundChecks`（本轮已经**正式执行**的搜查数）必须分开：
   * 用户批准的规则是「每轮最多正式检查 1 件家具」，因此尝试配额仍是硬上限，
   * 但日志与 DEV 要能区分「开始过几次」与「真正执行过几次」。
   */
  checkHideRoundAttempts = 0;
  /** 本轮已经**正式执行**（发出正式判定请求）的搜查次数。 */
  checkHideRoundChecks = 0;
  /** 本轮开始过的家具（DEV 观察用）。 */
  checkHideAttemptedSpotId: string | null = null;
  readonly checkHideRoundBudget = GAME_CONFIG.humanAI.hideCheckMaxPerRound;
  checkHideCheckedSpotIds: string[] = [];
  /** 同一次调查里已经正式检查过的家具数（上限复用 searchRoomCount）。 */
  checkHideInvestigationChecks = 0;
  /** 同一次调查里 CHECK_HIDE 已经花掉的正式玩法时间（上限复用 searchMaxMs）。 */
  checkHideInvestigationMs = 0;
  /** 最近一次正式搜查结束时，本次动作是如何收尾的（DEV / 日志用）。 */
  checkHideInvestigationEndReason = 'NONE';
  checkHideGiveUpCode: HumanCheckGiveUpReason = 'NONE';
  checkHideGiveUpDetail = '';
  checkHideLastResult: HumanCheckHideResult = 'NONE';
  checkHideLastResultSpotId: string | null = null;
  checkHideStartCount = 0;
  checkHideHitCount = 0;
  checkHideMissCount = 0;
  checkHideInterruptCount = 0;
  // ---- S7C-2 修复轮 二：导航终点 / 正式站位 / 最终接近的公开诊断 ----
  /**
   * 正式判定所认可的站位 = 规划时保存的原始 `stancePoint`。导航网格点只是寻路节点，
   * 因此这里单独记录「AI 实际走到的位置与规划站位的偏差」，供 DEV 与 AI JSON 回答
   * 「为什么当时判成 STANCE_LOST」。
   */
  checkHideStanceDistance: number | null = null;
  /** REQUEST 那一帧的实际角色位置（三处中心必须能同时被看到）。 */
  checkHideRequestPosition: Point | null = null;
  /** 本次动作使用的导航网格终点（A* 吸附点，只作寻路节点）。 */
  checkHideNavGoal: Point | null = null;
  /** 最终接近（导航终点 → 原始 stancePoint）实际走了几帧。 */
  checkHideApproachSteps = 0;
  /** 真正发出正式判定请求的次数（只应有一次）。 */
  checkHideRequestCount = 0;
  /** 本次调查里「计划失效退还配额」已经用掉的次数（上限见 STANCE_MAX_STALE_CANCELS）。 */
  checkHideStaleCancels = 0;
  // ---- S7C-2 修复轮 二 / 六：Last Seen 同房间分支与打断声音的公开明细 ----
  /** Last Seen 所在的公开房间（DEV / 日志用）。 */
  lastSeenRoomId: string | null = null;
  /** 「先考虑最后目击房间」这一分支的公开门槛结论。 */
  lastSeenRoomGateCode = 'NONE';
  lastSeenRoomGateDetail = '';
  /** 最近一次打断搜查的真实（AI 亲耳听到的）声音明细。 */
  lastInterruptSoundType: string | null = null;
  lastInterruptSoundStrength: number | null = null;
  lastInterruptSoundRemainingMs: number | null = null;
  lastInterruptSoundIsNew = false;
  /** 最近一次正式搜查请求的**公开**明细（DEV / 日志用）。 */
  lastCheckDetail: {
    result: 'NONE' | 'HIT' | 'MISS';
    detail: string;
    plannedSurfacePoint: Point | null;
    finalAimPoint: Point | null;
    aimPointDelta: number | null;
    distance: number | null;
    angleDeltaDeg: number | null;
    blocked: boolean | null;
  } = { result: 'NONE', detail: '还没有执行过正式搜查', plannedSurfacePoint: null,
    finalAimPoint: null, aimPointDelta: null,
    distance: null, angleDeltaDeg: null, blocked: null };

  private readonly checkHideFailureMs = new Map<string, number>();
  private pendingCheckHideSpotId: string | null = null;
  private pendingSearchResume = false;
  /** 同房间候选没搜到之后，回到既有相邻房间有限搜索。 */
  private pendingLastSeenRoomSearch = false;
  /** 本次调查是否已经尝试过「最后目击房间」分支（避免同一调查反复进入）。 */
  private lastSeenRoomAttempted = false;
  private newCluesThisFrame = 0;
  /**
   * 已经用于发起过任务的公开线索 ID。用「集合替换」而不是累加，因此它的大小
   * 天然被 `CLUE_MEMORY_MAX` 约束；同一批线索不会被反复当成新线索。
   */
  private readonly actedTraceIds = new Set<string>();
  private humanSearchEvents: { type: string; reason: string; spotId: string | null;
    data?: Record<string, unknown> }[] = [];
  private lastInferenceEvent = '';
  private lastGiveUpEvent = '';
  private map: HumanAIMapSnapshot = { furniture: [], hideSpots: [] };
  private path: NavStep[] = [];
  private pathIndex = 0;
  private repathRemainingMs = 0;
  private pathDoorSignature = '';
  private lastCommandedMovement = false;
  private stuckMs = 0;
  private progressWaypointKey = '';
  private progressAnchorDistance = Infinity;
  /** 最终接近（导航终点 → 原始 stancePoint）的卡路检测，与既有卡路阈值同源。 */
  private approachStuckMs = 0;
  private approachAnchorDistance = Infinity;
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
  private navigation: NavigationSystem;
  private readonly rooms: readonly Room[];
  private readonly random: () => number;
  private tuning: RuntimeTuning | null = null;

  constructor(navigation: NavigationSystem, rooms: readonly Room[],
    doors: readonly DoorNode[], random: () => number = Math.random,
    map: HumanAIMapSnapshot = { furniture: [], hideSpots: [] }) {
    this.navigation = navigation;
    this.rooms = rooms;
    this.doorNodes = new Map(doors.map(door => [door.id, door]));
    this.patrolRooms = rooms.filter(room => room.major);
    this.random = random;
    // 整份快照都要留下（地图数据 + 三条真实几何接缝）；只挑两个字段会让 AI
    // 在缺省值下「看不见任何米痕、站不住任何位置」。
    this.map = { ...map };
  }

  // DEV-B runtime override layer (memory only). Pass null to fall back to the
  // read-only GAME_CONFIG values again.
  setRuntimeTuning(tuning: RuntimeTuning | null): void { this.tuning = tuning; }

  reset(): void {
    this.state = 'PATROL';
    this.previousState = 'PATROL';
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
    this.handledDangerSound = null;
    this.handledLastSeenTime = -1;
    // S7C-2：线索记忆、推断、候选、CHECK_HIDE 与失败冷却都属于「本局状态」，
    // 重开 / 返回阵营页必须全部清空。
    this.clueMemory.reset();
    this.traceInference = inferTraceDirection([]);
    this.clueSignature = 'NO_CLUE';
    this.actedTraceIds.clear();
    this.suspectedSpotIds = [];
    this.candidateBasis = [];
    this.candidateRanking = '无';
    this.candidateSkipped = '无';
    this.pendingClueCount = 0;
    this.pendingClueValidUntilMs = 0;
    this.pendingClueDeferReason = 'NONE';
    this.pendingClueDeferCount = 0;
    this.pendingClueReevalCount = 0;
    this.checkHidePhase = 'NONE';
    this.checkHideSpotId = null;
    this.checkHideStance = null;
    this.checkHideDwellRemainingMs = 0;
    this.checkHideSource = null;
    this.checkHideRoundAttempts = 0;
    this.checkHideRoundChecks = 0;
    this.checkHideAttemptedSpotId = null;
    this.checkHideCheckedSpotIds = [];
    this.checkHideInvestigationChecks = 0;
    this.checkHideInvestigationMs = 0;
    this.checkHideInvestigationEndReason = 'NONE';
    this.checkHideGiveUpCode = 'NONE';
    this.checkHideGiveUpDetail = '';
    this.checkHideLastResult = 'NONE';
    this.checkHideLastResultSpotId = null;
    this.checkHideStartCount = 0;
    this.checkHideHitCount = 0;
    this.checkHideMissCount = 0;
    this.checkHideInterruptCount = 0;
    this.checkHideNavGoal = null;
    this.checkHideStanceDistance = null;
    this.checkHideRequestPosition = null;
    this.checkHideApproachSteps = 0;
    this.checkHideRequestCount = 0;
    this.checkHideStaleCancels = 0;
    this.approachStuckMs = 0;
    this.approachAnchorDistance = Infinity;
    this.lastSeenRoomId = null;
    this.lastSeenRoomGateCode = 'NONE';
    this.lastSeenRoomGateDetail = '';
    this.lastInterruptSoundType = null;
    this.lastInterruptSoundStrength = null;
    this.lastInterruptSoundRemainingMs = null;
    this.lastInterruptSoundIsNew = false;
    this.lastCheckDetail = { result: 'NONE', detail: '还没有执行过正式搜查',
      plannedSurfacePoint: null, finalAimPoint: null,
      aimPointDelta: null, distance: null, angleDeltaDeg: null, blocked: null };
    this.checkHideFailureMs.clear();
    this.pendingCheckHideSpotId = null;
    this.pendingSearchResume = false;
    this.pendingLastSeenRoomSearch = false;
    this.lastSeenRoomAttempted = false;
    this.newCluesThisFrame = 0;
    this.humanSearchEvents = [];
    this.lastInferenceEvent = '';
    this.lastGiveUpEvent = '';
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

  // DEV map editor: after a validated map rebuild the shared navigation grid is
  // replaced and cached paths are dropped, so the AI never follows a stale route.
  rebindNavigation(navigation: NavigationSystem): void {
    this.navigation = navigation;
    this.path = [];
    this.pathIndex = 0;
    this.repathRemainingMs = 0;
    this.pathDoorSignature = '';
    this.progressWaypointKey = '';
    this.progressAnchorDistance = Infinity;
    this.stuckMs = 0;
    this.lastCommandedMovement = false;
    this.lastNavigationReason = 'MAP_REBUILT';
  }

  /**
   * S7C-2 地图应用：换成新的公开地图快照，并清空一切与旧家具几何绑定的状态。
   * 这样 AI 绝不会继续前往被删除或移动过的旧家具位置。`clearClues` 只在真正
   * 换图时为 true（沿用 S7C-1B 的「内容签名未变就不清理状态」约定）。
   */
  rebindMap(map: HumanAIMapSnapshot, clearClues = true): void {
    this.map = { ...map };
    this.abortCheckHide('MAP_REBUILT', '地图已重新应用，作废旧家具候选');
    this.suspectedSpotIds = [];
    this.candidateBasis = [];
    this.candidateRanking = '无';
    this.candidateSkipped = '无';
    this.checkHideFailureMs.clear();
    this.checkHideCheckedSpotIds = [];
    this.checkHideRoundAttempts = 0;
    this.checkHideRoundChecks = 0;
    this.checkHideAttemptedSpotId = null;
    this.checkHideInvestigationMs = 0;
    this.pendingLastSeenRoomSearch = false;
    this.lastSeenRoomAttempted = false;
    this.lastSeenRoomGateCode = 'NONE';
    this.lastSeenRoomGateDetail = '';
    // 修复轮 二：换图后「计划失效退还配额」次数也归零（新地图需要新的重规划空间）。
    this.checkHideStaleCancels = 0;
    this.checkHideNavGoal = null;
    this.checkHideStanceDistance = null;
    this.checkHideRequestPosition = null;
    this.checkHideApproachSteps = 0;
    this.checkHideRequestCount = 0;
    this.resetApproachTracking();
    if (clearClues) {
      this.clueMemory.reset();
      this.traceInference = inferTraceDirection([]);
      this.clueSignature = 'NO_CLUE';
      this.actedTraceIds.clear();
      this.pendingClueCount = 0;
      this.pendingClueValidUntilMs = 0;
      this.pendingClueDeferReason = 'NONE';
    }
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
    // 人工控制期间 AI 完全没有更新；归还控制时不许留下半途的搜查动作。
    this.abortCheckHide('MANUAL_CONTROL', '人工控制接管，取消未完成的搜查');
  }

  // ---- S7C-2：给 DEV / 测试读取的公开状态（全部是 AI 自己知道或推断的内容） ----

  /** 搜查失败冷却（公开：只是「这件家具我刚搜过」，不含占用信息）。 */
  checkHideCooldowns(): { spotId: string; remainingMs: number }[] {
    return [...this.checkHideFailureMs.entries()]
      .map(([spotId, remainingMs]) => ({ spotId, remainingMs }))
      .sort((a, b) => b.remainingMs - a.remainingMs || (a.spotId < b.spotId ? -1 : 1));
  }

  clueList(): readonly TraceClue[] { return this.clueMemory.clues(); }

  /**
   * S7C-2：给 AI JSON 的**公开**事件时间线（发现米痕 / 更新推断 / 产生家具怀疑 /
   * 前往搜查点 / 开始正式搜查 / 搜中或搜空 / 被更高优先级打断 / 放弃原因）。
   * 只包含 AI 自己知道或推断的内容，绝不包含占用状态与真实隐藏坐标。
   *
   * S7C-2 修复轮：每个事件可以带一份**结构化公开明细**（状态 / 前一状态 /
   * 调查来源 / Last Seen 公开信息 / 待处理线索 / 候选与排序 / 站位与瞄点 /
   * 打断声音明细），这样真实日志里能看出「AI 为什么没搜到」，而不必靠猜。
   */
  drainHumanSearchEvents(): { type: string; reason: string; spotId: string | null;
    data?: Record<string, unknown> }[] {
    return this.humanSearchEvents.splice(0, this.humanSearchEvents.length);
  }

  private pushHumanSearchEvent(type: string, reason: string, spotId: string | null = null,
    data?: Record<string, unknown>): void {
    const last = this.humanSearchEvents[this.humanSearchEvents.length - 1];
    // 同一事件连续重复只保留一条，绝不逐帧刷屏。
    if (last && last.type === type && last.reason === reason) return;
    this.humanSearchEvents.push({ type, reason, spotId, data });
  }

  /** S7C-2 修复轮：公开的「状态 / 前一状态 / 调查来源」快照，供日志与 DEV 使用。 */
  humanSearchContext(): Record<string, unknown> {
    return { state: this.state, prevState: this.previousState,
      investigationSource: this.investigationSource,
      transitionReason: this.lastTransitionReason };
  }

  /** S7C-2 修复轮：Last Seen 的公开坐标 / 房间 / 年龄 / 是否仍有效。 */
  lastSeenPublic(nowMs: number, lastSeenMs: number = GAME_CONFIG.perception.lastSeenMs):
  Record<string, unknown> {
    const seen = this.lastKnownLastSeen;
    if (!seen) return { present: false, valid: false };
    const ageMs = Math.max(0, nowMs - seen.timeMs);
    return { present: true, valid: ageMs < lastSeenMs, x: seen.position.x,
      z: seen.position.z, roomId: this.lastSeenRoomId, ageMs,
      remainingMs: Math.max(0, lastSeenMs - ageMs) };
  }

  /** S7C-2 修复轮：待处理公开线索的公开摘要。 */
  pendingCluesPublic(): Record<string, unknown> {
    return { count: this.pendingClueCount, validUntilMs: this.pendingClueValidUntilMs,
      deferReason: this.pendingClueDeferReason, deferCount: this.pendingClueDeferCount,
      reevalCount: this.pendingClueReevalCount };
  }

  traceInferenceText(): string {
    return `${TRACE_INFERENCE_CODE_TEXT[this.traceInference.code]}｜置信度 ` +
      `${TRACE_CONFIDENCE_TEXT[this.traceInference.confidence]}`;
  }

  // DEV-B observation: the cached route only. Reading it never triggers a new
  // search and never changes the current target.
  currentPath(): readonly Point[] { return this.path; }

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
    for (const [spotId, remaining] of this.checkHideFailureMs) {
      if (remaining <= deltaMs) this.checkHideFailureMs.delete(spotId);
      else this.checkHideFailureMs.set(spotId, remaining - deltaMs);
    }
    this.trackPathProgress(input.human, deltaMs);
    // S7C-2：先把本帧「亲自看到」的米痕写进有限线索记忆，再按公开优先级决策。
    this.observeTraces(input);
    // S7C-2 修复轮 一：本帧若注定被更高优先级状态占用，这批公开线索只是被**延后**，
    // 不是被丢弃——下面照样进队列，等 AI 能决策时再重评。
    const deferReason = this.clueDeferReason(input);
    if (input.lastSeen) {
      this.lastKnownLastSeen = { position: { ...input.lastSeen.position },
        timeMs: input.lastSeen.timeMs };
    }
    if (this.pendingSearchResume) {
      this.pendingSearchResume = false;
      if (this.state === 'PATROL' || this.state === 'CHECK_HIDE') {
        this.setState('SEARCH', 'SEARCH_RESUME_AFTER_HIDE_CHECK');
        this.advanceSearch(input);
      }
    }
    // S7C-2 修复轮 二：最后目击房间的家具搜空之后，回到既有的相邻房间有限搜索。
    if (this.pendingLastSeenRoomSearch) {
      this.pendingLastSeenRoomSearch = false;
      if (this.state === 'PATROL') {
        // 本轮家具配额已经被同房间那一次用掉，因此这里**不**重开新一轮，
        // 相邻房间分支不能靠换房间绕过「每轮最多 1 件家具」。
        this.beginSearch(input, this.lastSeenRoomAttempted);
      }
    }

    if (input.visibleTarget) {
      // 优先级 1：当前真实目视目标。藏身搜查立即中止，既有 CHASE/CAPTURE 不变。
      this.abortCheckHide('TARGET_VISIBLE', '重新看到目标，中止搜查');
      this.endInvestigation();
      this.searchTargets = [];
      this.searchTargetRoomId = null;
      this.pendingLastSeenRoomSearch = false;
      this.setState(input.captureEligible ? 'CAPTURE' : 'CHASE',
        input.captureEligible ? 'CAPTURE_RANGE' : 'VISION_TARGET');
      this.setTarget(input.visibleTarget, null);
    } else if ((this.state === 'CHASE' || this.state === 'CAPTURE') &&
        input.lastSeen && input.lastSeen.timeMs !== this.handledLastSeenTime) {
      // 优先级 2：新的 Last Seen（过期记录由 VisionSystem 自己清除）。
      this.handledLastSeenTime = input.lastSeen.timeMs;
      this.setState('INVESTIGATE', 'LOST_SIGHT');
      this.beginInvestigation('LAST_SEEN');
      this.searchAnchor = { ...input.lastSeen.position };
      // 修复轮 二 / 六：Last Seen 所在的公开房间要立刻记下来，DEV 与 AI JSON
      // 才能回答「它最后在哪间房看见对方」。
      this.lastSeenRoomId = this.roomFor(input.lastSeen.position)?.id ?? null;
      this.setTarget(input.lastSeen.position, this.roomFor(input.lastSeen.position)?.id ?? null);
      this.dwellRemainingMs = cfg.investigationDwellMs;
    } else if (this.state !== 'SEARCH' && input.heardDanger &&
        input.heardDanger.event !== this.handledDangerSound &&
        (this.investigationSource !== 'LAST_SEEN' || this.state === 'CHECK_HIDE')) {
      // 优先级 3：新的强危险声音（复用现有追捕型声音分类）。它可以立即中止搜查，
      // 但不会打断既有的 SEARCH 与 Last Seen 调查。
      this.handledDangerSound = input.heardDanger.event;
      // S7C-2 修复轮 六：把「真实听到的」声音明细记下来（类型 / 可听强度 / 剩余寿命），
      // 这样日志能回答「那次打断到底是什么声音」，而不是只写「危险声」。
      this.lastInterruptSoundType = input.heardDanger.event.type;
      this.lastInterruptSoundStrength = input.heardDanger.audibleStrength;
      this.lastInterruptSoundRemainingMs = input.heardDanger.remainingMs;
      this.lastInterruptSoundIsNew = true;
      const room = this.roomFor(input.heardDanger.event.position);
      if (room && !(this.state === 'INVESTIGATE' &&
          this.investigationSource === 'SOUND' && this.targetRoomId === room.id)) {
        this.abortCheckHide('DANGER_SOUND', '听到新的追捕型危险声，中止搜查');
        this.setState('INVESTIGATE', 'DANGER_SOUND_HEARD');
        this.beginInvestigation('SOUND');
        this.setTarget({ x: room.x, z: room.z }, room.id);
        this.dwellRemainingMs = cfg.investigationDwellMs;
      }
    } else if (this.considerPublicClues(input)) {
      // 优先级 4：公开米痕线索（含被延后、仍有效的同一批线索）→ 公开家具怀疑。
    } else if (this.investigationSource !== 'LAST_SEEN' && this.state !== 'SEARCH' &&
        this.state !== 'CHECK_HIDE' && input.heard &&
        input.heard.event !== this.handledSound) {
      // 优先级 5：普通声音与既有调查任务；不打断正在执行的搜查。
      this.handledSound = input.heard.event;
      const room = this.roomFor(input.heard.event.position);
      if (room && !(this.state === 'INVESTIGATE' &&
          this.investigationSource === 'SOUND' && this.targetRoomId === room.id)) {
        this.setState('INVESTIGATE', 'SOUND_HEARD');
        this.beginInvestigation('SOUND');
        this.setTarget({ x: room.x, z: room.z }, room.id);
        this.dwellRemainingMs = cfg.investigationDwellMs;
      }
    } else if (this.state === 'CHASE' || this.state === 'CAPTURE') {
      this.setState('PATROL', 'TARGET_LOST');
      this.target = null;
    }
    // S7C-2 修复轮 一：把「本帧没能处理的公开线索」登记为待处理批次，并保留
    // 有效期（来自原米痕实体）与延后原因；线索全部过期时给出明确原因。
    this.syncPendingClueBatch(input, deferReason);

    if (this.state === 'CAPTURE') return this.command(0, 0, null);
    if (this.state === 'SEARCH') {
      this.searchElapsedMs += deltaMs;
      if (this.searchElapsedMs >= cfg.searchMaxMs) this.finishSearch(input);
    }
    if (this.state === 'CHECK_HIDE') {
      // S7C-2：一次藏身搜查（走路 + 停留）共享既有「一次追丢搜索总时限」，
      // 用完之后本局这一段调查结束，绝不允许无限搜查。
      this.checkHideInvestigationMs += deltaMs;
      if (this.checkHideInvestigationMs >= cfg.searchMaxMs) {
        this.abortCheckHide('CHECK_TIMEOUT', '搜查总时限已到');
        this.setState('PATROL', 'CHECK_HIDE_TIMEOUT');
        this.endInvestigation();
        this.target = null;
        return this.command(0, 0, null);
      }
    }
    if (this.state === 'PATROL' && !this.target) this.choosePatrol(input.human, input.doors);
    if (!this.target) return this.command(0, 0, null);
    const goal = this.navigation.nearestFree(this.target, input.doors);
    if (!goal) return this.unreachable(input);
    // S7C-2 修复轮 二：CHECK_HIDE 的「到站」不再以导航网格点为准。
    //
    // 真实日志里的故障链是：规划给出原始 `stancePoint` → A* 吸附到导航格 →
    // 控制器用「到导航格」判断到站 → 权威判定层却用「到原始 stancePoint」判断站位。
    // 两个中心最多可以差一个吸附距离（`REGION_NAV_SNAP_LIMIT` 0.45 u），于是
    // 每次都「DWELL 满 900 ms → REQUEST → STANCE_LOST」。
    //
    // 现在：导航网格点仍只作寻路节点；到达导航终点后，AI 必须在真实碰撞下继续
    // **最终接近**原始 `stancePoint`，并且用与权威判定**逐字相同**的谓词判断
    // 「是否可以进入 DWELL」——不放宽 waypointTolerance，也不放宽判定距离。
    const checkHideStance = this.state === 'CHECK_HIDE' ? this.checkHideStance : null;
    if (checkHideStance) {
      this.checkHideNavGoal = { x: goal.x, z: goal.z };
      this.checkHideStanceDistance =
        evaluateHideStance({ stancePoint: checkHideStance.stancePoint,
          plannedHeadingRad: null, humanPosition: input.human, humanHeadingRad: 0,
          waypointTolerance: cfg.waypointTolerance,
          contactEpsilon: GAME_CONFIG.collision.contactEpsilon }).stanceDistance;
    }
    const stanceHeld = checkHideStance !== null && this.stanceHeld(input.human);
    if (distance(input.human, goal) <= cfg.waypointTolerance || stanceHeld) {
      if (this.state === 'PATROL') {
        if (this.targetRoomId) this.visitedPatrolRooms.add(this.targetRoomId);
        this.choosePatrol(input.human, input.doors);
      } else if (this.state === 'INVESTIGATE') {
        this.dwellRemainingMs -= deltaMs;
        if (this.dwellRemainingMs <= 0) {
          if (this.investigationSource === 'LAST_SEEN') {
            // S7C-2 修复轮 二：先考虑「最后目击房间」里的公开藏身家具；没有合理
            // 候选或没有合法站位时，才按原有规则继续有限的相邻房间搜索。
            if (!this.tryStartLastSeenRoomHideCheck(input))
              this.beginSearch(input, this.lastSeenRoomAttempted);
          } else if (this.investigationSource === 'TRACE') {
            this.beginSearch(input);
          } else {
            this.setState('PATROL', 'AREA_SEARCH_COMPLETE');
            this.endInvestigation();
            this.choosePatrol(input.human, input.doors);
          }
        } else return this.command(0, 0, null);
      } else if (this.state === 'SEARCH') {
        this.searchDwellRemainingMs -= deltaMs;
        if (this.searchDwellRemainingMs <= 0) this.advanceSearch(input);
        else {
          // 「有限搜索」：搜索房间里若有公开藏身点，这一轮最多转去检查 1 件家具。
          this.tryStartSearchRoomHideCheck(input);
          return this.command(0, 0, null);
        }
      } else if (this.state === 'CHECK_HIDE') {
        const heading = this.checkHideStance?.headingRad ?? null;
        // 已经请求过判定：只保持朝向等待调用方回执，绝不重复请求。
        if (this.checkHidePhase === 'DONE')
          return this.command(0, 0, null, null, null, heading);
        if (!checkHideStance) {
          // 状态机与动作状态不一致（例如站位计划已被清空）：按既有「路线不可达」
          // 安全收尾，绝不在此处继续走或发起判定。
          this.abortCheckHide('NO_ROUTE', '搜查站位计划已被清空');
          this.checkHideInvestigationEndReason = 'CHECK_HIDE_STANCE_MISSING';
          this.setState('PATROL', 'CHECK_HIDE_STANCE_MISSING');
          this.target = null;
          return this.command(0, 0, null);
        }
        if (!stanceHeld) {
          // 到了导航终点，但还没站到规划保存的原始站位上：进入**最终接近**阶段。
          // 这段移动仍然逐帧经过真实 CollisionWorld（由 ThreeGame 的 move() 完成），
          // 因此不会穿墙、穿家具或穿关闭的门；接近过程有界，见 finalApproach()。
          return this.finalApproach(input, deltaMs);
        }
        this.resetApproachTracking();
        this.checkHideDwellRemainingMs -= deltaMs;
        if (this.checkHideDwellRemainingMs > 0) {
          // 搜查期间 AI 不移动，只保持朝向（由 ThreeGame 落到 Human 的朝向上）。
          if (this.checkHidePhase !== 'DWELL') {
            this.checkHidePhase = 'DWELL';
            this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_START',
              `${this.checkHideSpotId ?? '未知'}｜停留 ` +
              `${(this.checkHideDwellMs / 1000).toFixed(1)} 秒`, this.checkHideSpotId);
            // 修复轮 五：到站并开始停留是一次**玩家可见**的动作，单独记一条事件，
            // 表现层据此播放「正在检查这件家具」的反馈（不参与命中判定）。
            this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_DWELL',
              `${this.checkHideSpotId ?? '未知'}｜到达规划站位（偏差 ` +
              `${(this.checkHideStanceDistance ?? 0).toFixed(3)}），开始 ` +
              `${this.checkHideDwellMs} ms 停留`, this.checkHideSpotId,
              this.checkHidePublicDetail());
          }
          return this.command(0, 0, null, null, null, heading);
        }
        // 合法站位 + 朝向 + 900 ms 停留全部满足：请求一次正式命中判定。
        // 判定本身由 ThreeGame 用 S7C-1B 的正式结算执行，AI 只拿到「搜中/搜空」。
        this.checkHidePhase = 'DONE';
        this.pendingCheckHideSpotId = this.checkHideSpotId;
        // S7C-2 修复轮 二：**REQUEST 不再提前消耗「正式检查」计数**。
        //
        // 以前在发出请求时就 `checkHideRoundChecks++`，于是 STANCE_LOST / PLAN_STALE /
        // OUT_OF_RANGE 这类「未完成合法检查」也被算成一次正式检查。现在只有游戏层
        // 回执 `MISS_EMPTY` / `HIT_CONCEALED` 时（见 `noteCheckHideResolution()`）才
        // 计入真正完成的正式检查数量。
        this.checkHideRequestCount++;
        this.checkHideRequestPosition = { x: input.human.x, z: input.human.z };
        this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_REQUEST',
          `${this.checkHideSpotId ?? '未知'}｜到站 + 朝向正确 + 满 ` +
          `${this.checkHideDwellMs} ms 停留，发出一次正式搜查请求（只发一次）`,
          this.checkHideSpotId, this.checkHidePublicDetail());
        return this.command(0, 0, null, null, null, heading);
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
    if (this.state === 'CHECK_HIDE') {
      // S7C-2：站位不可达也是「明确的任务结束并恢复巡逻」的一种。
      this.abortCheckHide('NO_ROUTE', '通往搜查站位的路线不可达');
      this.checkHideInvestigationEndReason = 'CHECK_HIDE_NO_ROUTE';
      this.setState('PATROL', 'CHECK_HIDE_NO_ROUTE');
      this.lastNavigationReason = 'CHECK_HIDE_NO_ROUTE';
      this.target = null;
      this.choosePatrol(input.human, input.doors);
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
    const baseHumanSpeed = (this.tuning?.playerSpeedPx ?? GAME_CONFIG.player.speed) /
      GAME_CONFIG.three.pixelsPerUnit *
      (this.tuning?.humanSpeedMultiplier ?? GAME_CONFIG.human.speedMultiplier);
    const speed = humanAiMovementSpeed(baseHumanSpeed, this.tuning?.humanAIMovementMultiplier);
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

  private beginSearch(input: HumanAIInput, continueRound = false): void {
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
    // S7C-2：新的 SEARCH 轮 = 新的「每轮最多 1 件家具」配额。
    // 修复轮 二：如果这一轮配额已经被「最后目击房间」那一次用掉，就不能重开，
    // 否则同房间 + 相邻房间两条分支会绕过次数上限。调查级预算始终保留。
    if (!continueRound) this.beginRound();
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
    this.endInvestigation();
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
    if (this.state !== state) {
      this.previousState = this.state;
      this.state = state;
      this.lastTransitionReason = reason;
      // 修复轮 六：Human AI 的状态变化进 AI JSON 公开时间线，带上前一状态与
      // 调查来源，这样真实日志能直接看出「AI 当时到底在做什么」。
      this.pushHumanSearchEvent('HUMAN_AI_STATE', `${this.previousState} → ${state}` +
        `（${reason}）｜来源 ${this.investigationSource ?? '无'}`,
        null, this.humanSearchContext());
    }
  }

  private command(x: number, z: number, openDoorId: string | null,
    unlockDoorId: string | null = null,
    forceBreakDoorId: string | null = null,
    faceHeadingRad: number | null = null): HumanAICommand {
    this.lastCommandedMovement = x !== 0 || z !== 0;
    // 一次性的正式搜查请求搭在当帧命令上，保证调用方不会漏读也不会重复读。
    const checkHideSpotId = this.pendingCheckHideSpotId;
    this.pendingCheckHideSpotId = null;
    return { direction: { x, z }, openDoorId, unlockDoorId, forceBreakDoorId,
      faceHeadingRad, checkHideSpotId };
  }

  // -------------------------------------------------------------------------
  // S7C-2：公开线索记忆、公开推断、公开家具候选与 CHECK_HIDE
  // -------------------------------------------------------------------------

  /** 本帧亲自看到的米痕 → 图层 C。除「看见」以外不使用任何信息。 */
  private observeTraces(input: HumanAIInput): void {
    const nowMs = input.nowMs ?? 0;
    this.clueMemory.advance(nowMs);
    const visible = selectVisibleTraces({
      observer: input.human,
      traces: input.visibleTraces ?? [],
      nowMs,
      visionRange: this.tuning?.visionRange ?? GAME_CONFIG.perception.visionRange,
      visible: this.map.canSee ?? (() => false),
    });
    const added = this.clueMemory.discover(visible, nowMs);
    this.newCluesThisFrame = added.length;
    this.clueSignature = this.clueMemory.signature();
    for (const clue of added) {
      this.pushHumanSearchEvent('HUMAN_TRACE_FOUND',
        `${clue.traceId}@(${clue.position.x.toFixed(2)}, ${clue.position.z.toFixed(2)})`);
    }
    if (added.length) {
      this.refreshTraceInference();
      const headingText = this.traceInference.directionHeadingRad === null ? '未知'
        : `${(this.traceInference.directionHeadingRad * 180 / Math.PI).toFixed(0)}°`;
      const signature = `${this.traceInference.code}:${this.traceInference.confidence}:` +
        headingText;
      if (signature !== this.lastInferenceEvent) {
        this.lastInferenceEvent = signature;
        this.pushHumanSearchEvent('HUMAN_TRACE_DIRECTION',
          `${this.traceInference.code} / ${this.traceInference.confidence} / 方向 ${headingText}`);
      }
    }
  }

  /** 由公开线索重算方向推断（纯函数，无副作用，可反复调用）。 */
  private refreshTraceInference(): void {
    this.traceInference = inferTraceDirection(this.clueMemory.clues());
    this.clueSignature = this.clueMemory.signature();
  }

  // ---- S7C-2 修复轮 一：延后线索的增量重评 ----

  /** 已知、但还没有用于发起过任务的公开线索（`clues()` 已按生成时间旧→新排序）。 */
  private unactedClues(): TraceClue[] {
    const clues = this.clueMemory.clues();
    if (!clues.length) return [];
    return clues.filter(clue => !this.actedTraceIds.has(clue.traceId));
  }

  /**
   * 这批线索已经用于发起任务。用「整集替换」而不是累加：集合大小因此天然被
   * `CLUE_MEMORY_MAX` 约束，过期线索也不会无限堆积。
   */
  private markCluesActed(): void {
    this.actedTraceIds.clear();
    for (const clue of this.clueMemory.clues()) this.actedTraceIds.add(clue.traceId);
  }

  private clearPendingClueBatch(): void {
    this.pendingClueCount = 0;
    this.pendingClueValidUntilMs = 0;
    this.pendingClueDeferReason = 'NONE';
  }

  /**
   * 本帧是否需要把公开线索「延后」：只由公开状态推导（真实目视 / 新 Last Seen /
   * 新的强危险声 / 正在执行的正式搜查 / 上一次米痕调查）。不读取任何隐藏信息。
   */
  private clueDeferReason(input: HumanAIInput): HumanClueDeferReason {
    if (this.state === 'CHECK_HIDE') return 'CHECK_HIDE';
    if (input.visibleTarget) return 'TARGET_VISIBLE';
    if (input.heardDanger && input.heardDanger.event !== this.handledDangerSound &&
        this.investigationSource !== 'LAST_SEEN') return 'DANGER_SOUND';
    if ((this.state === 'CHASE' || this.state === 'CAPTURE') && input.lastSeen &&
        input.lastSeen.timeMs !== this.handledLastSeenTime) return 'LAST_SEEN';
    if (this.investigationSource === 'LAST_SEEN' &&
        (this.state === 'INVESTIGATE' || this.state === 'SEARCH')) return 'LAST_SEEN';
    if (this.state === 'INVESTIGATE' && this.investigationSource === 'TRACE')
      return 'TRACE_INVESTIGATION';
    return 'NONE';
  }

  /**
   * 维护「待处理公开线索批次」的公开摘要：数量、有效截止（来自原米痕实体）与
   * 延后原因。它**不续期**：有效期永远等于原实体的 `createdAt + lifetimeMs`，
   * 线索一旦被 `RiceTraceClueMemory.advance()` 清掉，这里也就随之归零。
   */
  private syncPendingClueBatch(input: HumanAIInput, reason: HumanClueDeferReason): void {
    const unacted = this.unactedClues();
    const previous = this.pendingClueCount;
    this.pendingClueCount = unacted.length;
    this.pendingClueValidUntilMs = unacted.reduce((max, clue) =>
      Math.max(max, clue.validUntil), 0);
    if (!unacted.length) {
      if (previous > 0) {
        this.setGiveUp('CLUE_EXPIRED',
          `被延后的 ${previous} 条公开米痕线索已全部过期，不再作为证据`);
        this.pushHumanSearchEvent('HUMAN_CLUE_EXPIRED',
          `${previous} 条被延后的公开米痕线索已全部过期`);
      }
      this.pendingClueDeferReason = 'NONE';
      return;
    }
    if (reason === 'NONE' || this.pendingClueDeferReason === reason) return;
    this.pendingClueDeferReason = reason;
    this.pendingClueDeferCount++;
    const nowMs = input.nowMs ?? 0;
    this.pushHumanSearchEvent('HUMAN_CLUE_DEFERRED',
      `${HUMAN_CLUE_DEFER_TEXT[reason]}：${unacted.length} 条公开米痕线索延后处理｜` +
      `最后有效期还剩 ${((this.pendingClueValidUntilMs - nowMs) / 1000).toFixed(1)} 秒`,
      null, { ...this.pendingCluesPublic(), nowMs,
        validUntilMs: this.pendingClueValidUntilMs });
  }

  /**
   * 优先级 4：公开米痕线索 → 公开家具怀疑 → CHECK_HIDE。
   *
   * 既处理「本帧新发现的米痕」，也处理**此前被更高优先级状态延后、但仍然有效**
   * 的同一批公开线索。修复点就在这里：延后 ≠ 丢弃——目标不再可见、当前没有紧急
   * 危险、且 AI 不处于不可中断的正式搜查动作时，必须重评。
   *
   * 重评完全复用既有的 `gateHideSearchByClues()`、候选排序与合法站位规划，
   * 不新建第二套判断；已处理且没有新信息的同一批线索不会再触发一次任务。
   */
  private considerPublicClues(input: HumanAIInput): boolean {
    if (this.state === 'CHECK_HIDE') return false;
    if (this.state === 'INVESTIGATE' && this.investigationSource === 'TRACE') return false;
    // 已批准的公开优先级是「Last Seen 高于新米痕」：一次 Last Seen 调查（走向最后
    // 目击点 → 同房间候选 → 相邻房间有限搜索）在它结束前不会被**更早**的米痕批次
    // 抢占，否则真实日志里「刚在次卧失去视线」这条最强公开依据会被旧米痕链挤掉，
    // 同房间覆盖也就永远不会发生。调查结束后，这批线索若仍有效会立刻被重评。
    if (this.investigationSource === 'LAST_SEEN' &&
        (this.state === 'INVESTIGATE' || this.state === 'SEARCH')) return false;
    const unacted = this.unactedClues();
    if (!unacted.length) { this.clearPendingClueBatch(); return false; }
    if (this.newCluesThisFrame === 0) {
      // 增量重评：只有确实存在「延后且仍有效」的批次时才动手，避免每帧重排候选。
      if (this.pendingClueCount === 0) return false;
      this.pendingClueReevalCount++;
      this.pushHumanSearchEvent('HUMAN_CLUE_REEVALUATED',
        `延后原因 ${this.pendingClueDeferReason}｜重评 ${unacted.length} 条仍有效的公开米痕线索`,
        null, { ...this.pendingCluesPublic(),
          clueIds: unacted.map(clue => clue.traceId) });
    }
    const acted = this.actOnPublicClues(input);
    this.markCluesActed();
    this.clearPendingClueBatch();
    return acted;
  }

  /**
   * 用公开线索发起一次合法调查：先试「公开家具候选 → 合法站位 → CHECK_HIDE」，
   * 不成立时退回「去最新线索附近调查一次」，再走既有的有限房间搜索。
   */
  private actOnPublicClues(input: HumanAIInput): boolean {
    this.refreshTraceInference();
    this.beginInvestigation('TRACE');
    if (this.tryStartHideCheck(input, 'TRACE')) return true;
    const anchor = this.traceInference.anchor;
    if (!anchor) {
      this.setGiveUp('NO_CLUE', '推断没有得到可调查的锚点');
      this.endInvestigation();
      return false;
    }
    // 一粒米也可以调查附近：去最新线索处停留，再走既有的有限房间搜索。
    this.setState('INVESTIGATE', 'TRACE_FOUND');
    this.searchAnchor = { x: anchor.x, z: anchor.z };
    this.setTarget(anchor, this.roomFor(anchor)?.id ?? null);
    this.dwellRemainingMs = GAME_CONFIG.humanAI.investigationDwellMs;
    return true;
  }

  /** 修复轮 六：一次搜查动作的公开明细（站位 / 表面点 / 候选 / 计数）。 */
  private checkHidePublicDetail(): Record<string, unknown> {
    return {
      state: this.state, prevState: this.previousState,
      investigationSource: this.investigationSource,
      spotId: this.checkHideSpotId, source: this.checkHideSource,
      roomId: this.checkHideSpotId
        ? this.map.hideSpots.find(spot => spot.id === this.checkHideSpotId)?.roomId ?? null
        : null,
      stancePoint: this.checkHideStance?.stancePoint ?? null,
      plannedSurfacePoint: this.checkHideStance?.surfacePoint ?? null,
      plannedHeadingDeg: this.checkHideStance
        ? this.checkHideStance.headingRad * 180 / Math.PI : null,
      pathNodes: this.checkHideStance?.pathNodes ?? null,
      surfaceDistance: this.checkHideStance?.surfaceDistance ?? null,
      // S7C-2 修复轮 二：导航终点 / 正式站位 / 实际偏差三处中心同时可见，
      // 「为什么判成 STANCE_LOST」不再需要靠猜。
      navGoal: this.checkHideNavGoal,
      stanceDistance: this.checkHideStanceDistance,
      requestPosition: this.checkHideRequestPosition,
      approachSteps: this.checkHideApproachSteps,
      requestCount: this.checkHideRequestCount,
      staleCancels: this.checkHideStaleCancels,
      candidates: this.suspectedSpotIds, candidateRanking: this.candidateRanking,
      candidateBasis: this.candidateBasis, candidateSkipped: this.candidateSkipped,
      roundChecks: this.checkHideRoundChecks,
      roundAttempts: this.checkHideRoundAttempts,
      investigationChecks: this.checkHideInvestigationChecks,
      pendingClues: this.pendingCluesPublic(),
    };
  }

  /** CHECK_HIDE 必须拿到真实几何接缝；缺省值一律「失败即拒绝」，绝不放行。 */
  private stanceWorld(input: HumanAIInput): {
    standable: (point: Point) => boolean;
    navigationCell: (point: Point) => Point | null;
    pathNodes: (point: Point) => number | null;
    lineBlocked: (a: Point, b: Point) => boolean;
  } {
    return {
      standable: this.map.standable ?? (() => false),
      navigationCell: point => this.navigation.nearestFree(point, input.doors),
      pathNodes: point => this.navigation.findPath(input.human, point, input.doors)?.length ?? null,
      lineBlocked: this.map.lineBlocked ?? (() => true),
    };
  }

  /**
   * S7C-2 修复轮 二：**最后目击房间**里的公开藏身家具。
   *
   * 真实日志暴露的覆盖缺口：原来的有限 SEARCH 刻意排除 Last Seen 所在房间，
   * 只搜附近相连房间，于是「刚在次卧失去视线」这样最强的公开线索反而用不上，
   * 后面几次正式搜查全都落在书房书柜上。这里在相邻房间搜索**之前**先考虑同房间
   * 的公开藏身家具，但同房间 ≠ 必定搜查：仍要走公开门槛（Last Seen 有效 + 房间
   * 内确有公开藏身点）、候选排序、合法站位与可达性。
   *
   * 每轮仍然最多正式检查 1 件家具：这一次尝试与随后的相邻房间搜索共用同一轮配额
   * （`beginSearch(input, continueRound = true)`）。
   */
  private tryStartLastSeenRoomHideCheck(input: HumanAIInput): boolean {
    if (this.lastSeenRoomAttempted) return false;
    const lastSeen = input.lastSeen;
    const room = lastSeen ? this.roomFor(lastSeen.position) : null;
    const gate = gateLastSeenRoomSearch({
      lastSeen,
      nowMs: input.nowMs ?? 0,
      lastSeenMs: GAME_CONFIG.perception.lastSeenMs,
      room,
      spots: this.map.hideSpots,
    });
    this.lastSeenRoomId = gate.roomId;
    this.lastSeenRoomGateCode = gate.code;
    this.lastSeenRoomGateDetail = gate.detail;
    this.pushHumanSearchEvent('HUMAN_LAST_SEEN_ROOM',
      `${gate.code}：${gate.detail}`, null,
      { ...this.lastSeenPublic(input.nowMs ?? 0), gateCode: gate.code,
        spotIds: gate.spotIds });
    if (!gate.ok) {
      this.setGiveUp(gate.code === 'EXPIRED_LAST_SEEN' ? 'CLUE_EXPIRED'
        : 'NO_SAME_ROOM_CANDIDATE', gate.detail);
      return false;
    }
    this.lastSeenRoomAttempted = true;
    const inRoom = this.map.hideSpots.filter(spot => spot.roomId === room!.id);
    return this.tryStartHideCheck(input, 'LAST_SEEN_ROOM', inRoom);
  }

  /**
   * 公开家具候选 → 合法站位 → 进入 CHECK_HIDE。
   * 只使用公开线索排序，绝不读取占用状态；不能成立时给出明确放弃原因。
   */
  private tryStartHideCheck(input: HumanAIInput, source: HumanCheckHideSource,
    spots: readonly HideSpot[] = this.map.hideSpots): boolean {
    const cfg = GAME_CONFIG.humanAI;
    // 尝试配额与本轮执行配额都必须可用：用户批准的规则是「每轮最多正式检查
    // 1 件家具」，因此「已经走过去一次」同样算用掉了这一轮，避免中断后无谓重试
    // 同一件家具（也不会因此反复跑 A*）。
    if (this.checkHideRoundAttempts >= this.checkHideRoundBudget) {
      this.setGiveUp('ROUND_BUDGET_USED',
        `本轮已经用过 ${this.checkHideRoundAttempts} 次家具搜查配额`);
      return false;
    }
    if (this.checkHideRoundChecks >= this.checkHideRoundBudget) {
      this.setGiveUp('ROUND_BUDGET_USED',
        `本轮已经正式检查过 ${this.checkHideRoundChecks} 件家具`);
      return false;
    }
    if (this.checkHideInvestigationChecks >= cfg.searchRoomCount) {
      this.setGiveUp('ROUND_BUDGET_USED',
        `同一次调查最多正式检查 ${cfg.searchRoomCount} 件家具`);
      return false;
    }
    this.refreshTraceInference();
    const lastSeen = input.lastSeen;
    const heard = input.heard
      ? { position: input.heard.event.position, type: input.heard.event.type } : null;
    // 米痕来源的搜查必须先过「线索够不够强」这一关：一粒米不足以锁定家具，
    // 有限搜索 / 同房间来源则由「该房间里确实有公开藏身点」独立成立。
    if (source === 'TRACE') {
      const gate = gateHideSearchByClues({ inference: this.traceInference,
        lastSeen, heard, spots, furniture: this.map.furniture });
      if (!gate.ok) {
        this.setGiveUp('CLUE_TOO_WEAK', `${gate.code}：${gate.detail}`);
        return false;
      }
    }
    const report = rankHideSearchCandidates({
      spots,
      furniture: this.map.furniture,
      origin: input.human,
      clues: this.clueMemory.clues(),
      inference: this.traceInference,
      lastSeen,
      heard,
      cooldownRemainingMs: spotId => this.checkHideFailureMs.get(spotId) ?? 0,
      checked: new Set(this.checkHideCheckedSpotIds),
    });
    this.suspectedSpotIds = report.candidates.map(candidate => candidate.spotId);
    this.candidateBasis = [...report.rankingBasis];
    this.candidateRanking = report.candidates.length
      ? report.candidates.map(candidate =>
        `${candidate.spotId}(${candidate.score.toFixed(1)})`).join(' > ')
      : '无';
    // 修复轮 六：被排除的公开原因同样要进日志，否则看不出「为什么没有候选」。
    this.candidateSkipped = report.skipped.length
      ? report.skipped.map(entry => `${entry.spotId}=${entry.reason}`).join('、')
      : '无';
    if (report.candidates.length) {
      this.pushHumanSearchEvent('HUMAN_HIDE_SUSPECT',
        report.candidates.slice(0, 3).map(candidate => candidate.spotId).join(' > '),
        report.candidates[0].spotId,
        { candidates: this.suspectedSpotIds, ranking: this.candidateRanking,
          basis: this.candidateBasis, skipped: this.candidateSkipped, source });
    }
    if (!report.candidates.length) {
      const allCooling = report.skipped.length > 0 &&
        report.skipped.every(entry => entry.reason === 'COOLDOWN');
      this.setGiveUp(allCooling ? 'ALL_CANDIDATES_COOLED' : 'NO_CANDIDATE',
        report.skipped.length
          ? `公开候选全部被排除：${this.candidateSkipped}`
          : '当前没有任何公开藏身点数据');
      return false;
    }
    const tries = Math.min(CANDIDATE_TRY_LIMIT, report.candidates.length);
    let lastCode: HumanCheckGiveUpReason = 'NO_LEGAL_STANCE';
    let lastDetail = '候选家具都没有合法搜查站位';
    for (let index = 0; index < tries; index++) {
      const candidate = report.candidates[index];
      const spot = this.map.hideSpots.find(entry => entry.id === candidate.spotId);
      if (!spot) continue;
      const furniture = this.map.furniture.find(entry => entry.id === spot.furnitureId);
      if (!furniture) continue;
      const plan = planHideSearchStance(spot.id, furniture, input.human,
        this.stanceWorld(input));
      if (!plan.stance) {
        lastCode = plan.code === 'UNREACHABLE' ? 'CANDIDATES_UNREACHABLE' : 'NO_LEGAL_STANCE';
        lastDetail = `${spot.id}：${plan.reason}`;
        continue;
      }
      this.startCheckHide(spot.id, plan.stance, source);
      return true;
    }
    this.setGiveUp(lastCode, lastDetail);
    return false;
  }

  /** 「有限搜索」：搜索房间里有公开藏身点时的家具检查（每轮最多 1 件）。 */
  private tryStartSearchRoomHideCheck(input: HumanAIInput): boolean {
    if (this.checkHideRoundAttempts >= this.checkHideRoundBudget) return false;
    if (this.checkHideRoundChecks >= this.checkHideRoundBudget) return false;
    const roomId = this.searchTargetRoomId;
    if (!roomId) return false;
    const inRoom = this.map.hideSpots.filter(spot => spot.roomId === roomId);
    if (!inRoom.length) return false;
    return this.tryStartHideCheck(input, 'SEARCH', inRoom);
  }

  private startCheckHide(spotId: string, stance: HideSearchStance,
    source: HumanCheckHideSource): void {
    // 只消耗「尝试配额」：真正执行正式搜查时才在 DWELL 结束时消耗执行配额。
    this.checkHideRoundAttempts++;
    this.checkHideAttemptedSpotId = spotId;
    this.checkHidePhase = 'TRAVEL';
    this.checkHideSpotId = spotId;
    this.checkHideStance = stance;
    this.checkHideSource = source;
    this.checkHideDwellRemainingMs = this.checkHideDwellMs;
    this.checkHideStartCount++;
    this.checkHideLastResult = 'NONE';
    // 修复轮 二：每次新动作都把「导航终点 / 实际偏差 / 请求次数 / 接近步数」重置，
    // 免得 DEV 与日志里读到上一次搜查留下的数字。
    this.checkHideNavGoal = null;
    this.checkHideStanceDistance = null;
    this.checkHideRequestPosition = null;
    this.checkHideApproachSteps = 0;
    this.checkHideRequestCount = 0;
    this.resetApproachTracking();
    this.setGiveUp('NONE', '');
    this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_TRAVEL',
      `${spotId}（来源 ${source}）｜站位 ` +
      `${stance.stancePoint.x.toFixed(2)}, ${stance.stancePoint.z.toFixed(2)}｜` +
      `表面 ${stance.surfacePoint.x.toFixed(2)}, ${stance.surfacePoint.z.toFixed(2)}｜` +
      `路径 ${stance.pathNodes} 节点`, spotId, this.checkHidePublicDetail());
    this.setState('CHECK_HIDE', source === 'SEARCH'
      ? 'SEARCH_ROOM_HIDE_SUSPECT'
      : source === 'LAST_SEEN_ROOM' ? 'LAST_SEEN_ROOM_HIDE_SUSPECT'
        : 'TRACE_HIDE_SUSPECT');
    this.setTarget(stance.stancePoint, this.roomFor(stance.stancePoint)?.id ?? null);
  }

  /**
   * S7C-2 修复轮 四 / 六：游戏层把**正式判定接缝**的公开结论登记进来，供 DEV 与
   * AI JSON 使用（计划瞄点 vs 最终判定点、距离、张角偏差、命中与否）。
   *
   * 这是**单向登记**，并且刻意只收「公开安全」的字段：
   *   - `result` 就是 AI 唯一拿到的布尔结果的文字形式（HIT / MISS）；
   *   - `finalAimPoint` 永远是 AI 自己规划的那件家具表面上的公开点；
   *   - 权威层的细粒度原因（例如「这件家具里确实有人，但扇形被门挡住」）**不进入**
   *     这里的任何字段——那属于开发者真值，只出现在 ThreeGame 的 DEV 字段里。
   * 因此这段登记既不会污染 AI 决策，也不会让 AI 侧多知道一点占用信息。
   */
  noteCheckHideResolution(input: {
    spotId: string;
    result: 'HIT' | 'MISS';
    detail: string;
    plannedSurfacePoint: Point | null;
    finalAimPoint: Point | null;
    aimPointDelta: number | null;
    distance: number | null;
    angleDeltaDeg: number | null;
    blocked: boolean | null;
    /**
     * 修复轮 二：该结果是否是一次**真正完成**的合法正式检查。只有
     * `MISS_EMPTY` / `HIT_CONCEALED` 为 true；STANCE_LOST / PLAN_STALE /
     * OUT_OF_RANGE / OUTSIDE_FAN / BLOCKED 一律 false（老代码在这里之前就在
     * REQUEST 时把计数加掉了，等于把「未完成的检查」算成正式检查）。
     */
    countsAsFormalCheck: boolean;
  }): void {
    this.lastCheckDetail = { result: input.result, detail: input.detail,
      plannedSurfacePoint: input.plannedSurfacePoint,
      finalAimPoint: input.finalAimPoint,
      aimPointDelta: input.aimPointDelta,
      distance: input.distance, angleDeltaDeg: input.angleDeltaDeg,
      blocked: input.blocked };
    if (input.countsAsFormalCheck) {
      this.checkHideRoundChecks++;
      this.checkHideInvestigationChecks++;
    }
    this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_RESOLVE',
      `${input.result}：${input.detail}`, input.spotId,
      { ...this.checkHidePublicDetail(), result: input.result,
        countsAsFormalCheck: input.countsAsFormalCheck,
        stanceDistance: this.checkHideStanceDistance,
        requestPosition: this.checkHideRequestPosition,
        navGoal: this.checkHideNavGoal,
        approachSteps: this.checkHideApproachSteps,
        requestCount: this.checkHideRequestCount,
        plannedSurfacePoint: input.plannedSurfacePoint,
        finalAimPoint: input.finalAimPoint,
        aimPointDelta: input.aimPointDelta, distance: input.distance,
        angleDeltaDeg: input.angleDeltaDeg, blocked: input.blocked,
        sameAimPoint: input.plannedSurfacePoint !== null &&
          input.finalAimPoint !== null &&
          input.plannedSurfacePoint.x === input.finalAimPoint.x &&
          input.plannedSurfacePoint.z === input.finalAimPoint.z });
  }

  /**
   * 正式命中的**公开结果**回执：AI 只知道「搜中 / 搜空」。
   * 真实坐标、真正藏身点 ID、占用状态一律不进入这里的任何字段。
   */
  onCheckHideResult(spotId: string, hit: boolean): void {
    if (this.checkHideSpotId !== spotId) return;
    const source = this.checkHideSource;
    this.checkHideLastResult = hit ? 'HIT' : 'MISS';
    this.checkHideLastResultSpotId = spotId;
    this.checkHidePhase = 'NONE';
    this.checkHideSpotId = null;
    this.checkHideStance = null;
    this.checkHideDwellRemainingMs = 0;
    this.pendingCheckHideSpotId = null;
    this.checkHideAttemptedSpotId = null;
    if (hit) {
      this.checkHideHitCount++;
      this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_HIT', spotId, spotId,
        { ...this.checkHidePublicDetail(), result: 'HIT' });
      this.setState('CAPTURE', 'CHECK_HIDE_HIT');
      return;
    }
    // 搜空：记录公开的失败记忆与冷却，然后重新评估剩余公开线索。
    this.checkHideMissCount++;
    this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_MISS', spotId, spotId,
      { ...this.checkHidePublicDetail(), result: 'MISS' });
    this.checkHideFailureMs.set(spotId,
      GAME_CONFIG.humanAI.hideCheckFailureCooldownMs);
    if (!this.checkHideCheckedSpotIds.includes(spotId))
      this.checkHideCheckedSpotIds.push(spotId);
    this.checkHideGiveUpCode = 'CHECK_DONE';
    this.checkHideGiveUpDetail = `${spotId} 搜空，` +
      `${(GAME_CONFIG.humanAI.hideCheckFailureCooldownMs / 1000).toFixed(0)} 秒内不再检查它`;
    if (source === 'SEARCH') {
      // 回到同一次有限搜索的剩余房间；「本轮已检查家具数」保持为 1，不会连查第二件。
      this.pendingSearchResume = true;
      this.setState('PATROL', 'SEARCH_RESUME_PENDING');
      this.target = null;
      return;
    }
    if (source === 'LAST_SEEN_ROOM') {
      // 修复轮 二：同房间没搜到 → 回到既有的相邻房间有限搜索。本轮家具配额已经
      // 用完（`beginSearch(input, true)` 不重开新一轮），因此不会连查第二件。
      this.pendingLastSeenRoomSearch = true;
      this.finishCheckHideAction('LAST_SEEN_ROOM_MISS_SEARCH_RESUME');
      return;
    }
    // 修复轮 三：TRACE / SOUND 来源搜空后，收起这次动作留下的目标与计数，
    // 但**刻意保留本次调查**——真正调用 `endInvestigation()` 会把用户批准的
    // 「同一次调查最多 3 件家具」上限一起清零，等于用一串新米痕绕过次数上限。
    this.finishCheckHideAction('CHECK_HIDE_MISS');
  }

  /**
   * S7C-2 修复轮 三：一次正式搜查结束后，把**本次动作**留下的状态清干净：
   * 目标、站位、停留、有限搜索的房间队列、以及等待中的回执。
   *
   * 刻意**不动**两处计数，原因都写在代码里：
   *   - 本轮家具配额（`checkHideRoundAttempts` / `checkHideRoundChecks`）保持「已用」，
   *     这就是「每轮最多正式检查 1 件家具」的落实方式；无条件清零等于允许立刻重搜，
   *     正是本轮要修掉的绕过路径。真正的新公开线索会通过 `beginInvestigation()`
   *     正常开启新的一轮。
   *   - 调查级预算（`investigationSource` / 本次调查已检查件数 / 已花时间）保留，
   *     否则「同一次调查最多 3 件家具、最多 15 秒」的上限会被一串新米痕绕过。
   */
  private finishCheckHideAction(reason: string): void {
    this.checkHidePhase = 'NONE';
    this.checkHideSpotId = null;
    this.checkHideStance = null;
    this.checkHideDwellRemainingMs = 0;
    this.pendingCheckHideSpotId = null;
    this.checkHideAttemptedSpotId = null;
    this.resetApproachTracking();
    this.searchTargets = [];
    this.searchTargetRoomId = null;
    this.searchElapsedMs = 0;
    this.searchDwellRemainingMs = 0;
    this.checkHideInvestigationEndReason = reason;
    this.setState('PATROL', reason);
    this.target = null;
  }

  /**
   * S7C-2 修复轮 四：调用方在执行前发现**计划已失效**（目标家具被移动 / 旋转 /
   * 已不在当前地图，或计划瞄点已不再属于该家具）。
   *
   * 这不是「搜空」：不能污染公开失败记忆，也不能让这件家具进入 6 秒冷却；只作废
   * 这次动作、把本轮配额还回来，让 AI 用当前地图合法重规划。AI 侧看不到任何真实
   * 坐标或占用状态，只知道「这件家具的公开几何变了」。
   */
  cancelStaleCheckHide(detail: string): void {
    const refundable = this.checkHideStaleCancels < STANCE_MAX_STALE_CANCELS;
    this.clearCheckHideAction('PLAN_STALE', detail, false);
    this.checkHideAttemptedSpotId = null;
    if (refundable) {
      // 没有真正执行过正式判定：把本轮配额还回来，允许按当前地图重规划。
      // 但**有界**：一次调查最多退还 STANCE_MAX_STALE_CANCELS 次，超过之后这次
      // 取消同样消耗配额，避免「取消 → 重规划 → 再取消」形成无限退款循环。
      this.checkHideStaleCancels++;
      this.checkHideRoundAttempts = 0;
      this.checkHideRoundChecks = 0;
      if (this.checkHideInvestigationChecks > 0) this.checkHideInvestigationChecks--;
    }
    this.checkHideInvestigationEndReason = refundable ? 'PLAN_STALE_CANCELLED'
      : 'PLAN_STALE_CANCEL_LIMIT';
    this.setState('PATROL', 'CHECK_HIDE_PLAN_STALE');
    this.target = null;
    this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_CANCEL',
      `计划失效：${detail}｜退还本轮配额：${refundable ? '是' : '否（已达上限）'}`,
      null, { ...this.checkHidePublicDetail(), staleCancels: this.checkHideStaleCancels,
        staleCancelRefunded: refundable });
  }

  /**
   * S7C-2 修复轮 二：正式判定层给出的**未完成合法检查**（STANCE_LOST /
   * HEADING_LOST / OUT_OF_RANGE / OUTSIDE_FAN / BLOCKED）。
   *
   * 它们不是搜空：不写公开失败记忆、不触发 6 秒家具冷却、不计入「真正完成的正式
   * 检查」。同时**不退还**本轮家具配额——否则反复发出非法请求再取消就能绕过
   * 「每轮最多正式检查 1 件家具」。新的公开线索会通过 `beginInvestigation()`
   * 正常开启新的一轮，届时配额自然重置。
   */
  cancelIncompleteCheckHide(code: string, detail: string): void {
    this.clearCheckHideAction('CHECK_INCOMPLETE', detail, true);
    this.checkHideInvestigationEndReason = `${code}_CANCELLED`;
    this.setState('PATROL', 'CHECK_HIDE_INCOMPLETE');
    this.target = null;
    this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_CANCEL',
      `未完成合法检查（${code}）：${detail}`, null,
      { ...this.checkHidePublicDetail(), incompleteCode: code });
  }

  private abortCheckHide(code: HumanCheckGiveUpReason, detail: string): void {
    this.clearCheckHideAction(code, detail, true);
  }

  private clearCheckHideAction(code: HumanCheckGiveUpReason, detail: string,
    countInterrupt: boolean): void {
    if (countInterrupt &&
        (this.checkHidePhase === 'TRAVEL' || this.checkHidePhase === 'DWELL')) {
      this.checkHideInterruptCount++;
      this.pushHumanSearchEvent('HUMAN_HIDE_SEARCH_INTERRUPT',
        `${code}：${detail}`, this.checkHideSpotId,
        { ...this.checkHidePublicDetail(), interruptSoundType: this.lastInterruptSoundType,
          interruptSoundStrength: this.lastInterruptSoundStrength,
          interruptSoundRemainingMs: this.lastInterruptSoundRemainingMs,
          interruptSoundIsNew: this.lastInterruptSoundIsNew });
    }
    if (this.checkHidePhase !== 'NONE') this.setGiveUp(code, detail);
    this.checkHidePhase = 'NONE';
    this.checkHideSpotId = null;
    this.checkHideStance = null;
    this.checkHideDwellRemainingMs = 0;
    this.pendingCheckHideSpotId = null;
    this.checkHideAttemptedSpotId = null;
    this.resetApproachTracking();
  }

  /**
   * S7C-2 修复轮 二：AI 侧「是否真的站到规划保存的原始站位上」。
   *
   * 直接复用 `evaluateHideStance()`（权威判定层用的就是同一个函数），容差是既有的
   * `waypointTolerance + contactEpsilon`。这里只关心位置部分：朝向由 AI 每帧显式
   * 命令（`faceHeadingRad`），权威判定层会再核对真实朝向。
   */
  private stanceHeld(human: Point): boolean {
    const stance = this.checkHideStance;
    if (!stance) return false;
    return evaluateHideStance({ stancePoint: stance.stancePoint, plannedHeadingRad: null,
      humanPosition: human, humanHeadingRad: 0,
      waypointTolerance: GAME_CONFIG.humanAI.waypointTolerance,
      contactEpsilon: GAME_CONFIG.collision.contactEpsilon }).stanceHeld;
  }

  /**
   * 最终接近：从 A* 导航终点继续**合法**走到规划保存的原始 `stancePoint`。
   *
   * 修复轮 二的关键一步。三条约束：
   *   - 移动照旧由 `ThreeGame` 通过 `CollisionWorld` 执行，AI 只给方向，绝不瞬移；
   *   - 不重跑 A*（导航点仍是那个吸附点），所以不会引入无限寻路；
   *   - 有界：沿用既有 `stuckRepathMs` / `stuckProgressEpsilon` 做卡路检测，真实
   *     碰撞使其无法再靠近时按既有「路线不可达」收尾，且**不退还**本轮家具配额，
   *     因此不可能形成「反复取消 → 反复重试」的循环。
   */
  private finalApproach(input: HumanAIInput, deltaMs: number): HumanAICommand {
    const stance = this.checkHideStance;
    const heading = stance?.headingRad ?? null;
    if (!stance) return this.command(0, 0, null, null, null, heading);
    this.checkHideApproachSteps++;
    const remaining = distance(input.human, stance.stancePoint);
    if (this.approachAnchorDistance - remaining >= GAME_CONFIG.humanAI.stuckProgressEpsilon) {
      this.approachAnchorDistance = remaining;
      this.approachStuckMs = 0;
    } else {
      this.approachStuckMs += deltaMs;
      if (this.approachStuckMs >= GAME_CONFIG.humanAI.stuckRepathMs) {
        this.approachStuckMs = 0;
        this.abortCheckHide('NO_ROUTE', '最终接近受阻：真实碰撞下无法再靠近规划站位');
        this.checkHideInvestigationEndReason = 'CHECK_HIDE_STANCE_UNREACHABLE';
        this.setState('PATROL', 'CHECK_HIDE_STANCE_UNREACHABLE');
        this.target = null;
        return this.command(0, 0, null, null, null, heading);
      }
    }
    const dx = stance.stancePoint.x - input.human.x;
    const dz = stance.stancePoint.z - input.human.z;
    const length = Math.hypot(dx, dz);
    if (length <= GAME_CONFIG.collision.contactEpsilon) {
      return this.command(0, 0, null, null, null, heading);
    }
    return this.command(dx / length, dz / length, null, null, null, heading);
  }

  private resetApproachTracking(): void {
    this.approachStuckMs = 0;
    this.approachAnchorDistance = Infinity;
  }

  private setGiveUp(code: HumanCheckGiveUpReason, detail: string): void {
    this.checkHideGiveUpCode = code;
    this.checkHideGiveUpDetail = detail;
    if (code === 'NONE') { this.lastGiveUpEvent = ''; return; }
    const signature = `${code}：${detail}`;
    if (signature === this.lastGiveUpEvent) return;
    this.lastGiveUpEvent = signature;
    this.pushHumanSearchEvent('HUMAN_HIDE_GIVE_UP', signature, null,
      { ...this.checkHidePublicDetail(), giveUpCode: code });
  }

  private beginRound(): void {
    this.checkHideRoundAttempts = 0;
    this.checkHideRoundChecks = 0;
    this.checkHideAttemptedSpotId = null;
    this.checkHideCheckedSpotIds = [];
  }

  /** 新的调查开始；已经处在同一次调查里时只换来源，不重置本次调查的预算。 */
  private beginInvestigation(source: 'SOUND' | 'LAST_SEEN' | 'TRACE'): void {
    if (this.investigationSource === null) {
      this.checkHideInvestigationChecks = 0;
      this.checkHideInvestigationMs = 0;
      this.checkHideCheckedSpotIds = [];
      // 新的调查意味着新的公开线索入场：允许重新计「计划失效退还配额」次数。
      this.checkHideStaleCancels = 0;
    }
    this.investigationSource = source;
    if (source === 'LAST_SEEN') this.lastSeenRoomAttempted = false;
    this.beginRound();
  }

  private endInvestigation(): void {
    this.investigationSource = null;
    this.lastSeenRoomAttempted = false;
    this.pendingLastSeenRoomSearch = false;
    this.beginRound();
    this.checkHideInvestigationChecks = 0;
    this.checkHideInvestigationMs = 0;
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
