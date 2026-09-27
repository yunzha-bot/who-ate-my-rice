import { GAME_CONFIG } from '../config/gameConfig.ts';

/**
 * AI 诊断日志采集器 —— 纯逻辑，无浏览器 API。
 *
 * 通过 diff 驱动采集 DeepSeekAIController 的 public 字段变化，
 * 不修改 AI 决策逻辑。每帧由 ThreeGame 构造快照并调用 diffSnapshot，
 * 采集器对比前后快照差异，仅对变化字段产生事件。
 */

export interface AILogSnapshot {
  doorEscapeEvents?: readonly { type: string; reason: string }[];
  doorLockEvents?: readonly { type: string; reason: string }[];
  passageActive?: boolean;
  safetyGeometry?: { human: { x: number; z: number } | null;
    rice: { x: number; z: number } | null; eat: { x: number; z: number } | null;
    observation: { x: number; z: number } | null;
    defaultPath: { x: number; z: number }[]; safePath: { x: number; z: number }[]; reason: string };
  state: string;
  targetRiceId: string | null;
  threatLevel: string;
  threatSource: string;
  lastSelectionReason: string;
  lastNavigationReason: string;
  lastTransitionReason: string;
  lastEscapeSwitchReason: string;
  escapeRoomId: string | null;
  noMovementReason: string;
  localLoopTriggered: boolean;
  sprintDecision: string;
  /** READY / ACTIVE / COOLDOWN / STUNNED — makes the 30s skill cooldown traceable. */
  sprintReadiness: string;
  recoveryBlockReason: string;
  curiosityRollResult: string;
  curiosityInterruptReason: string;
  curiosityBypassActive: boolean;
  passageRollResult: string;
  passageGateReason: string;
  passageCancelReason: string;
  passageRouteSafe: boolean;
  safeWaitRiceId: string | null;
  safeWaitEntryId: string | null;
  safeWaitFailureCount: number;
  safeWaitReason: string;
  safeWaitRemainingMs: number;
  roomId: string | null;
  humanVisible: boolean;
  humanStillMs: number;
  stillnessEventId: number;
  lastSeenValid: boolean;
  // The exact sound used by this AI update, captured even when the
  // transition itself is the only logged event in this frame.
  heardSoundType: string | null;
  heardAudibleStrength: number | null;
  heardRemainingMs: number | null;
  heardSoundTimestampMs: number | null;
  heardDangerSoundType: string | null;
  heardDangerAudibleStrength: number | null;
  humanVisibleDistance: number | null;
}

export interface AILogEvent {
  t: number;
  type: string;
  state: string;
  prevState: string | null;
  reason: string;
  riceTargetId: string | null;
  roomId: string | null;
  count: number;
  firstT: number;
  lastT: number;
  context: AILogSnapshot;
}

export interface AILogExport {
  formatVersion: string;
  exportedAt: string;
  matchDurationMs: number;
  config: { deepseekAI: typeof GAME_CONFIG.deepseekAI };
  events: AILogEvent[];
  eventCount: number;
  truncated: boolean;
  /** S7C-1B：藏身进入 / 退出 / 拒绝（含中断）的独立时间线 —— 与 AI 状态无关，
   *  因此人工控制 DeepSeek 娘时也能导出。 */
  hideEvents: AILogHideEvent[];
  /** S7C-2：Human AI 的公开循迹 / 搜查时间线（发现米痕、推断方向、家具怀疑、
   *  前往搜查点、开始正式搜查、搜中 / 搜空、被抢占、放弃原因）。同样只记录
   *  AI 已知或推断的内容，不含占用状态与真实隐藏坐标。 */
  humanSearchEvents: AILogHumanSearchEvent[];
  /**
   * S7C-2 修复轮 二：Human **玩家** Q 的搜查时间线（家具交互搜查 / 普通扇形抓捕）。
   * v1.5 新增字段，v1.4 的全部字段保持原样，因此旧消费者不受影响。
   */
  playerSearchEvents: AILogPlayerSearchEvent[];
}

export interface AILogHideEvent {
  t: number;
  type: string;
  reason: string;
  spotId: string | null;
}

export interface AILogHumanSearchEvent {
  t: number;
  type: string;
  reason: string;
  spotId: string | null;
  /**
   * S7C-2 修复轮 六：结构化**公开**明细。真实日志原来只有一句中文原因，
   * 无法回答「AI 当时是什么状态、Last Seen 还有多久失效、有多少条线索被延后、
   * 候选为什么被排除、计划瞄点和最终判定点是否一致、打断搜查的是什么声音」。
   *
   * 这里只放 AI 自己知道或推断的内容：公开坐标、公开排序、公开计数与公开原因。
   * 真实藏身坐标、占用家具与开发者真值字段**不进入**本结构。
   */
  data?: AILogHumanSearchData;
}

/**
 * S7C-2 修复轮 二 / 三：Human **玩家** Q 的搜查事件（与 Human AI 的搜查时间线分开）。
 * 只记录公开内容：目标类型（家具 / 普通扇形）、唯一高亮家具的公开 ID 与合法性码、
 * 是否被玩家指向、当帧是否存在合法暴露目标、Q 冷却状态、是否真的读过权威占用。
 * 隐藏者的真实坐标、占用家具真值不进入本结构。
 */
export interface AILogPlayerSearchEvent {
  t: number;
  type: string;
  reason: string;
  spotId: string | null;
  data?: AILogPlayerSearchData;
}

export interface AILogPlayerSearchData {
  /** `FURNITURE` = 家具交互搜查；`FAN` = 普通扇形角色抓捕。 */
  targetKind?: string;
  /** 修复轮 三：这次 Q 走的分支原因（COOLDOWN / EXPOSED_TARGET / FURNITURE / NO_TARGET）。 */
  reason?: string;
  furnitureId?: string | null;
  /** 按键当帧重新解析出的公开合法性结论与原因码。 */
  legal?: boolean;
  legalCode?: string;
  legalText?: string;
  /** 家具是否被玩家指向（指向只是一条选择条件，不参与命中几何）。 */
  pointed?: boolean;
  pointingDeltaDeg?: number;
  candidatesInRegion?: number;
  /** 普通扇形分支：按键当帧的无副作用「暴露目标」预检测结果。 */
  exposedTargetAvailable?: boolean;
  exposedCode?: string;
  exposedDistance?: number;
  exposedAngleDeltaDeg?: number;
  exposedBlocked?: boolean;
  /** Q 冷却状态（按键当帧）。 */
  cooldownReady?: boolean;
  cooldownRemainingMs?: number;
  playerPosition?: { x: number; z: number } | null;
  aimPoint?: { x: number; z: number } | null;
  blocked?: boolean;
  hit?: boolean;
  /** 权威占用是否在公开几何通过之后被读取（几何失败时必须为 false）。 */
  authoritativeRead?: boolean;
  executed?: boolean;
}

export interface AILogHumanSearchData {
  /** AI 当前状态与前一状态。 */
  state?: string;
  prevState?: string | null;
  /** 本次调查的来源（SOUND / LAST_SEEN / TRACE）。 */
  investigationSource?: string | null;
  transitionReason?: string;
  /** Last Seen 的公开坐标、房间、年龄与是否仍有效。 */
  lastSeen?: {
    present: boolean;
    valid: boolean;
    x?: number;
    z?: number;
    roomId?: string | null;
    ageMs?: number;
    remainingMs?: number;
  } | null;
  /** 同房间分支的公开门槛结论。 */
  gateCode?: string;
  spotIds?: readonly string[];
  /** 已发现但待处理的米痕数量、有效截止与延后原因。 */
  pendingClues?: {
    count: number;
    validUntilMs: number;
    deferReason: string;
    deferCount?: number;
    reevalCount?: number;
  };
  clueIds?: readonly string[];
  /** 当前公开候选、排序与排除原因。 */
  candidates?: readonly string[];
  ranking?: string;
  candidateRanking?: string;
  candidateBasis?: readonly string[];
  candidateSkipped?: string;
  skipped?: string;
  basis?: readonly string[];
  source?: string | null;
  roomId?: string | null;
  /** 正式搜查的站位、计划表面点与计划朝向。 */
  stancePoint?: { x: number; z: number } | null;
  plannedSurfacePoint?: { x: number; z: number } | null;
  plannedHeadingDeg?: number | null;
  pathNodes?: number | null;
  surfaceDistance?: number | null;
  /** 正式判定的最终瞄点，以及它与「最近表面点」算法的差异。 */
  finalAimPoint?: { x: number; z: number } | null;
  aimPointDelta?: number | null;
  sameAimPoint?: boolean;
  distance?: number | null;
  angleDeltaDeg?: number | null;
  blocked?: boolean | null;
  /** 正式判定的公开结果（AI 只知道搜中 / 搜空）。 */
  result?: string;
  /** 打断搜查的真实声音明细（AI 亲耳听到的那一条）。 */
  interruptSoundType?: string | null;
  interruptSoundStrength?: number | null;
  interruptSoundRemainingMs?: number | null;
  interruptSoundIsNew?: boolean | null;
  /** 计数：本轮已开始 / 已正式执行 / 本次调查已执行。 */
  roundAttempts?: number;
  roundChecks?: number;
  investigationChecks?: number;
  /** 放弃原因码与说明。 */
  giveUpCode?: string;
  giveUpDetail?: string;
  nowMs?: number;
  validUntilMs?: number;
}

interface DiffRule {
  type: string;
  field: keyof AILogSnapshot;
}

// 优先级从高到低：状态切换最重要，其次目标/威胁/房间，再是决策细节。
const DIFF_RULES: readonly DiffRule[] = [
  { type: 'PASSAGE_ACTIVE', field: 'passageActive' },
  { type: 'STATE_TRANSITION', field: 'state' },
  { type: 'TARGET_CHANGE', field: 'targetRiceId' },
  { type: 'THREAT_CHANGE', field: 'threatLevel' },
  { type: 'THREAT_SOURCE_CHANGE', field: 'threatSource' },
  { type: 'ROOM_CHANGE', field: 'roomId' },
  { type: 'SELECTION_REASON', field: 'lastSelectionReason' },
  { type: 'NAVIGATION_RESULT', field: 'lastNavigationReason' },
  { type: 'TRANSITION_REASON', field: 'lastTransitionReason' },
  { type: 'ESCAPE_SWITCH', field: 'lastEscapeSwitchReason' },
  { type: 'ESCAPE_ROOM', field: 'escapeRoomId' },
  { type: 'CURIOSITY_RESULT', field: 'curiosityRollResult' },
  { type: 'PASSAGE_RESULT', field: 'passageRollResult' },
  { type: 'PASSAGE_GATE', field: 'passageGateReason' },
  { type: 'CURIOSITY_INTERRUPT', field: 'curiosityInterruptReason' },
  { type: 'PASSAGE_CANCEL', field: 'passageCancelReason' },
  { type: 'PASSAGE_ROUTE_SAFETY', field: 'passageRouteSafe' },
  { type: 'SAFE_WAIT_RICE', field: 'safeWaitRiceId' },
  { type: 'SAFE_WAIT_ENTRY', field: 'safeWaitEntryId' },
  { type: 'SAFE_WAIT_FAILURES', field: 'safeWaitFailureCount' },
  { type: 'SAFE_WAIT_REASON', field: 'safeWaitReason' },
  { type: 'CURIOSITY_BYPASS', field: 'curiosityBypassActive' },
  { type: 'RECOVERY_BLOCK', field: 'recoveryBlockReason' },
  { type: 'NO_MOVEMENT', field: 'noMovementReason' },
  { type: 'LOCAL_LOOP', field: 'localLoopTriggered' },
  { type: 'SPRINT_DECISION', field: 'sprintDecision' },
  { type: 'SPRINT_READINESS', field: 'sprintReadiness' },
];

export class AILogCollector {
  private events: AILogEvent[] = [];
  private nowMs = 0;
  private matchStartMs = 0;
  private truncated = false;
  private previous: AILogSnapshot | null = null;
  private readonly maxEvents = 2000;
  private hideTimeline: AILogHideEvent[] = [];
  private readonly maxHideEvents = 500;
  private humanSearchTimeline: AILogHumanSearchEvent[] = [];
  private readonly maxHumanSearchEvents = 500;
  private playerSearchTimeline: AILogPlayerSearchEvent[] = [];
  private readonly maxPlayerSearchEvents = 500;

  startMatch(): void {
    this.events = [];
    this.nowMs = 0;
    this.matchStartMs = 0;
    this.truncated = false;
    this.previous = null;
    this.hideTimeline = [];
    this.humanSearchTimeline = [];
    this.playerSearchTimeline = [];
  }

  /** 藏身事件由 ThreeGame 每帧投放；不依赖 DeepSeek AI 是否在运行。 */
  recordHideEvents(events: readonly { type: string; reason: string;
    spotId: string | null }[]): void {
    if (events.length === 0) return;
    const t = this.nowMs - this.matchStartMs;
    for (const event of events) {
      if (this.hideTimeline.length >= this.maxHideEvents) break;
      this.hideTimeline.push({ t, type: event.type, reason: event.reason,
        spotId: event.spotId });
    }
  }

  /** S7C-2：Human AI 的公开循迹 / 搜查事件；同样不依赖 DeepSeek AI 是否在运行。 */
  recordHumanSearchEvents(events: readonly { type: string; reason: string;
    spotId: string | null; data?: Record<string, unknown> }[]): void {
    if (events.length === 0) return;
    const t = this.nowMs - this.matchStartMs;
    for (const event of events) {
      if (this.humanSearchTimeline.length >= this.maxHumanSearchEvents) break;
      this.humanSearchTimeline.push({ t, type: event.type, reason: event.reason,
        spotId: event.spotId,
        ...(event.data ? { data: event.data as AILogHumanSearchData } : {}) });
    }
  }

  advance(deltaMs: number, running: boolean): void {
    if (running) this.nowMs += Math.max(0, deltaMs);
  }

  /**
   * S7C-2 修复轮 二：Human **玩家** Q 的搜查事件（家具交互搜查 / 普通扇形抓捕）。
   *
   * 与 `humanSearchEvents`（Human AI 的公开循迹与搜查）刻意分开：这条时间线记录的是
   * 玩家操作与公开目标解析结果，包含「当前目标类型是家具还是扇形、唯一高亮家具、
   * 交互区域合法性、Q 冷却状态、是否真的读过权威占用」。它同样**不含**任何隐藏者
   * 真实坐标：只有被搜查家具的公开 ID、公开合法性码与布尔命中结果。
   */
  recordPlayerSearchEvent(event: { type: string; reason: string;
    spotId: string | null; data?: AILogPlayerSearchData }): void {
    if (this.playerSearchTimeline.length >= this.maxPlayerSearchEvents) return;
    const t = this.nowMs - this.matchStartMs;
    this.playerSearchTimeline.push({ t, type: event.type, reason: event.reason,
      spotId: event.spotId,
      ...(event.data ? { data: event.data } : {}) });
  }

  diffSnapshot(snapshot: AILogSnapshot): void {
    if (this.truncated) return;
    const t = this.nowMs - this.matchStartMs;

    for (const event of snapshot.doorEscapeEvents ?? []) {
      this.pushEvent({ t, type: event.type, state: snapshot.state,
        prevState: null, reason: event.reason,
        riceTargetId: snapshot.targetRiceId, roomId: snapshot.roomId,
        count: 1, firstT: t, lastT: t, context: { ...snapshot } });
    }

    for (const event of snapshot.doorLockEvents ?? []) {
      this.pushEvent({ t, type: event.type, state: snapshot.state,
        prevState: null, reason: event.reason,
        riceTargetId: snapshot.targetRiceId, roomId: snapshot.roomId,
        count: 1, firstT: t, lastT: t, context: { ...snapshot } });
    }

    if (!this.previous) {
      this.pushEvent({
        t,
        type: 'MATCH_START',
        state: snapshot.state,
        prevState: null,
        reason: snapshot.lastTransitionReason,
        riceTargetId: snapshot.targetRiceId,
        roomId: snapshot.roomId,
        count: 1,
        firstT: t,
        lastT: t,
        context: { ...snapshot },
      });
      this.previous = { ...snapshot };
      return;
    }

    for (const rule of DIFF_RULES) {
      const oldValue = this.previous[rule.field];
      const newValue = snapshot[rule.field];
      if (oldValue === newValue) continue;
      this.pushEvent({
        t,
        type: rule.type,
        state: snapshot.state,
        prevState: rule.field === 'state' ? this.previous.state : null,
        reason: String(newValue),
        riceTargetId: snapshot.targetRiceId,
        roomId: snapshot.roomId,
        count: 1,
        firstT: t,
        lastT: t,
        context: { ...snapshot },
      });
    }

    this.previous = { ...snapshot };
  }

  private pushEvent(event: AILogEvent): void {
    if (this.truncated) return;
    if (this.events.length > 0) {
      const last = this.events[this.events.length - 1];
      if (last.type === event.type &&
          last.state === event.state &&
          last.reason === event.reason &&
          last.riceTargetId === event.riceTargetId &&
          last.roomId === event.roomId) {
        last.count++;
        last.lastT = event.lastT;
        last.context = event.context;
        return;
      }
    }
    if (this.events.length >= this.maxEvents) {
      this.truncated = true;
      return;
    }
    this.events.push(event);
  }

  export(): AILogExport {
    return {
      // S7C-2b：1.5 → 1.6，只在既有 `hideEvents` 时间线里新增 DeepSeek AI 自主藏身
      // 的事件种类（HIDE_AI_REQUEST / ENTERED / REJECTED / EXIT_REQUEST / EXITED /
      // ABORT / SPOT_BLOCKED）；既有 events / hideEvents / humanSearchEvents /
      // playerSearchEvents 的字段与语义完全不变。
      formatVersion: '1.6',
      exportedAt: new Date().toISOString(),
      matchDurationMs: this.nowMs - this.matchStartMs,
      config: { deepseekAI: GAME_CONFIG.deepseekAI },
      events: this.events,
      eventCount: this.events.length,
      truncated: this.truncated,
      hideEvents: this.hideTimeline,
      humanSearchEvents: this.humanSearchTimeline,
      playerSearchEvents: this.playerSearchTimeline,
    };
  }
}
