import { GAME_CONFIG } from '../config/gameConfig.ts';

/**
 * AI 诊断日志采集器 —— 纯逻辑，无浏览器 API。
 *
 * 通过 diff 驱动采集 DeepSeekAIController 的 public 字段变化，
 * 不修改 AI 决策逻辑。每帧由 ThreeGame 构造快照并调用 diffSnapshot，
 * 采集器对比前后快照差异，仅对变化字段产生事件。
 */

export interface AILogSnapshot {
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
];

export class AILogCollector {
  private events: AILogEvent[] = [];
  private nowMs = 0;
  private matchStartMs = 0;
  private truncated = false;
  private previous: AILogSnapshot | null = null;
  private readonly maxEvents = 2000;

  startMatch(): void {
    this.events = [];
    this.nowMs = 0;
    this.matchStartMs = 0;
    this.truncated = false;
    this.previous = null;
  }

  advance(deltaMs: number, running: boolean): void {
    if (running) this.nowMs += Math.max(0, deltaMs);
  }

  diffSnapshot(snapshot: AILogSnapshot): void {
    if (this.truncated) return;
    const t = this.nowMs - this.matchStartMs;

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
      formatVersion: '1.1',
      exportedAt: new Date().toISOString(),
      matchDurationMs: this.nowMs - this.matchStartMs,
      config: { deepseekAI: GAME_CONFIG.deepseekAI },
      events: this.events,
      eventCount: this.events.length,
      truncated: this.truncated,
    };
  }
}
