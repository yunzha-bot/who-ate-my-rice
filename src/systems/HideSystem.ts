import type { Faction } from '../three/LocalControl.ts';
import type { Point } from '../three/map/apartmentMap.ts';
import type { GamePhase } from './GameStateSystem.ts';
import type { SprintState } from './SprintSystem.ts';

/**
 * S7C-1B 藏身状态机 —— 纯逻辑，无浏览器 API、无 Three.js、无地图依赖。
 *
 * 它只保存「谁藏在哪个藏身点、真实进入位置在哪、最近发生了什么」，所有几何
 * 合法性（交互区域、碰撞、导航、家具表面遮挡）都由调用方用既有接口算好后
 * 通过 `HideEnterContext` 传进来。这样做的原因有两个：
 *   1. 藏身判定必须复用 `checkHideRegionPosition`，不能在第二处重写；
 *   2. 纯逻辑可以在 Node 测试里把每条拒绝路径枚举完。
 *
 * 进入是「点按即切换」：没有 ENTERING 计时、没有独立的 Human 距离门槛。
 */
export type HideState = 'OUTSIDE' | 'CONCEALED';

/** 进入被拒绝的内部原因码；界面另有通俗中文（`message`）。 */
export type HideRejectCode = 'NOT_PLAYING' | 'WRONG_FACTION' | 'NOT_PLAYER_CONTROLLED'
  | 'ALREADY_CONCEALED' | 'STUNNED' | 'SPRINT_ACTIVE' | 'CAPTURE_IN_PROGRESS'
  | 'NO_HIDE_SPOT' | 'POSITION_ILLEGAL';

export type HideEnterCode = HideRejectCode | 'ENTERED';

/** 退出原因：玩家主动、被搜查、被抓捕、局终/重开、地图应用。 */
export type HideExitReason = 'PLAYER_E' | 'SEARCHED' | 'CAPTURED' | 'ROUND_RESET'
  | 'ROUND_FINISHED' | 'MAP_APPLIED';

export type HideExitCode = 'EXITED' | 'NOT_CONCEALED' | 'HUMAN_BLOCKING';

export interface HideEnterContext {
  phase: GamePhase;
  faction: Faction;
  /** 人工控制对象是否为该阵营（AI 不得自主藏身）。 */
  playerControlled: boolean;
  /** 真实站位；进入不传送，退出也用同一个点。 */
  position: Point;
  /** 调用方用 `checkHideRegionPosition` 选出的最近合法藏身点。 */
  spotId: string | null;
  spotCode: string;
  spotLegal: boolean;
  captureProgressMs: number;
  sprintState: SprintState;
}

export interface HideEnterResult {
  ok: boolean;
  code: HideEnterCode;
  message: string;
  spotId: string | null;
}

export interface HideExitOptions {
  /** Human 角色碰撞圆与藏身者真实站位重叠时，拒绝退出。 */
  humanOverlap?: boolean;
}

export interface HideExitResult {
  ok: boolean;
  code: HideExitCode;
  message: string;
  spotId: string | null;
}

export interface HideEvent {
  type: 'HIDE_ENTER' | 'HIDE_EXIT' | 'HIDE_REJECT';
  reason: string;
  spotId: string | null;
}

export const HIDE_ENTER_MESSAGES: Record<HideRejectCode, string> = {
  NOT_PLAYING: '只有对局中才能藏身',
  WRONG_FACTION: '只有 DeepSeek 娘可以藏身',
  NOT_PLAYER_CONTROLLED: '当前不是人工控制 DeepSeek 娘，不能藏身',
  ALREADY_CONCEALED: '已经在藏身中，按 E 退出',
  STUNNED: '眩晕中无法藏身',
  SPRINT_ACTIVE: '冲刺中无法藏身',
  CAPTURE_IN_PROGRESS: '正在被抓捕，无法藏身',
  NO_HIDE_SPOT: '附近没有可藏身的位置',
  POSITION_ILLEGAL: '当前站位不是合法的藏身位置',
};

export class HideSystem {
  state: HideState = 'OUTSIDE';
  spotId: string | null = null;
  concealedFaction: Faction | null = null;
  /** 真实进入位置 = 退出位置（不传送，所以两者相同）。 */
  entryPosition: Point | null = null;
  enterCount = 0;
  exitCount = 0;
  rejectCount = 0;
  lastRejectCode: HideRejectCode | '无' = '无';
  lastRejectReason = '无';
  lastExitReason: HideExitReason | '无' = '无';
  private events: HideEvent[] = [];

  isConcealed(faction: Faction): boolean {
    return this.state === 'CONCEALED' && this.concealedFaction === faction;
  }

  enter(context: HideEnterContext): HideEnterResult {
    const reject = (code: HideRejectCode, message = HIDE_ENTER_MESSAGES[code],
      spotId: string | null = context.spotId): HideEnterResult => {
      this.rejectCount++;
      this.lastRejectCode = code;
      this.lastRejectReason = `${code}：${message}`;
      this.events.push({ type: 'HIDE_REJECT', reason: code, spotId });
      return { ok: false, code, message, spotId };
    };

    if (context.phase !== 'PLAYING') return reject('NOT_PLAYING');
    if (context.faction !== 'DEEPSEEK') return reject('WRONG_FACTION');
    if (!context.playerControlled) return reject('NOT_PLAYER_CONTROLLED');
    if (this.state === 'CONCEALED') return reject('ALREADY_CONCEALED');
    if (context.sprintState === 'STUNNED') return reject('STUNNED');
    if (context.sprintState === 'SPRINT_RUNNING') return reject('SPRINT_ACTIVE');
    if (context.captureProgressMs > 0) return reject('CAPTURE_IN_PROGRESS');
    if (!context.spotId) return reject('NO_HIDE_SPOT', HIDE_ENTER_MESSAGES.NO_HIDE_SPOT, null);
    if (!context.spotLegal) {
      return reject('POSITION_ILLEGAL',
        `${HIDE_ENTER_MESSAGES.POSITION_ILLEGAL}（${context.spotCode}）`, context.spotId);
    }

    this.state = 'CONCEALED';
    this.spotId = context.spotId;
    this.concealedFaction = context.faction;
    this.entryPosition = { x: context.position.x, z: context.position.z };
    this.enterCount++;
    this.lastRejectCode = '无';
    this.lastRejectReason = '无';
    this.events.push({ type: 'HIDE_ENTER', reason: context.spotId, spotId: context.spotId });
    return { ok: true, code: 'ENTERED', message: `已藏身：${context.spotId}`, spotId: context.spotId };
  }

  exit(reason: HideExitReason, options: HideExitOptions = {}): HideExitResult {
    if (this.state !== 'CONCEALED') {
      return { ok: false, code: 'NOT_CONCEALED', message: '当前没有藏身', spotId: null };
    }
    if (options.humanOverlap) {
      return { ok: false, code: 'HUMAN_BLOCKING',
        message: 'Human 就在身边，无法退出藏身', spotId: this.spotId };
    }
    return this.clear(reason);
  }

  /** 局终、重开、地图应用与搜查命中：不检查 Human 重叠，直接清空。 */
  forcedExit(reason: HideExitReason): HideExitResult {
    if (this.state !== 'CONCEALED') {
      return { ok: false, code: 'NOT_CONCEALED', message: '当前没有藏身', spotId: null };
    }
    return this.clear(reason);
  }

  /** 只给 DEV 面板与测试：AI 输入结构里不得出现占用信息。 */
  occupancyOf(spotId: string): Faction | null {
    return this.state === 'CONCEALED' && this.spotId === spotId ? this.concealedFaction : null;
  }

  drainEvents(): HideEvent[] {
    return this.events.splice(0, this.events.length);
  }

  reset(): void {
    this.state = 'OUTSIDE';
    this.spotId = null;
    this.concealedFaction = null;
    this.entryPosition = null;
    this.enterCount = 0;
    this.exitCount = 0;
    this.rejectCount = 0;
    this.lastRejectCode = '无';
    this.lastRejectReason = '无';
    this.lastExitReason = '无';
    this.events.length = 0;
  }

  private clear(reason: HideExitReason): HideExitResult {
    const spotId = this.spotId;
    this.state = 'OUTSIDE';
    this.spotId = null;
    this.concealedFaction = null;
    this.entryPosition = null;
    this.exitCount++;
    this.lastExitReason = reason;
    this.events.push({ type: 'HIDE_EXIT', reason, spotId });
    return { ok: true, code: 'EXITED', message: `已退出藏身（${reason}）`, spotId };
  }
}
