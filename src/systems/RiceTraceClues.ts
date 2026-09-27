import type { Point } from '../three/map/apartmentMap.ts';
import type { RiceTrace } from './PerceptionSystem.ts';
import { CLUE_MEMORY_MAX } from './HumanSearchTuning.ts';

/**
 * S7C-2：米痕的「看见」适配 + Human AI 的有限线索记忆 —— 纯逻辑。
 *
 * 项目里米痕一共三层，必须严格分开：
 *
 *   A. 世界中实际存在的全部有效米痕（`RiceTraceSystem.traces`）。
 *   B. 当前 Human AI **真的能看见**的米痕：在现役视觉距离内、没有被墙体或
 *      非 OPEN 门叶挡住、仍在自己的有效期内。判定完全复用
 *      `PerceptionGeometry.inspectVision`，不新建第二套墙/门规则。
 *   C. Human AI 亲自发现并保存下来的**快照**。只有 C 可以进入循迹决策。
 *
 * 本模块只做 B 与 C：A 由调用方传入，且调用方**不得**把 A 直接喂给决策。禁止
 * 用 DeepSeek 的实时位置反推历史路径，也禁止因为某个脚印属于 DeepSeek 就直接
 * 知道它现在在哪——`RiceTrace` 本身没有阵营字段，这里也没有任何对手坐标输入。
 *
 * 家具目前不参与正式视觉遮挡，因此这里也**不**做家具遮挡：不能在本轮擅自声称
 * 已支持家具遮挡，也不因此修改全局视觉规则。
 */
export interface TraceClue {
  /** 原米痕实体的 ID。 */
  traceId: string;
  /** 发现时该脚印的真实位置（快照，不随后续移动变化）。 */
  position: Point;
  /** 原米痕实体的朝向字段（弧度，`atan2(dx, dz)`）。 */
  heading: number;
  /** 原米痕实体的真实生成时间。 */
  createdAt: number;
  /** 被 Human AI 亲自看到的时间。 */
  discoveredAt: number;
  /** 有效截止时间：等于原实体的过期时间，绝不延长。 */
  validUntil: number;
}

export interface TracePerceptionInput {
  /** Human 当前真实位置。 */
  observer: Point;
  /** 世界中全部有效米痕（图层 A）。 */
  traces: readonly RiceTrace[];
  /** 正式玩法时钟（与米痕系统同一个 `nowMs`）。 */
  nowMs: number;
  /** 当前有效视觉距离（DEV-B 覆盖后传有效值）。 */
  visionRange: number;
  /** 与视觉同源的遮挡判定；由调用方绑定真实几何。 */
  visible: (from: Point, to: Point, maxRange: number) => boolean;
}

/** 一个脚印是否还在自己的有效期内。 */
export function traceIsValid(trace: RiceTrace, nowMs: number): boolean {
  return nowMs - trace.createdAt < trace.lifetimeMs;
}

export function traceRemainingMs(trace: RiceTrace, nowMs: number): number {
  return Math.max(0, trace.lifetimeMs - (nowMs - trace.createdAt));
}

/**
 * 图层 A → 图层 B：逐条跑真实视觉检查，只返回当前真正看得见的那部分。
 * 顺序保持输入顺序，保证同一帧的结果是可复现的。
 */
export function selectVisibleTraces(input: TracePerceptionInput): RiceTrace[] {
  const visible: RiceTrace[] = [];
  for (const trace of input.traces) {
    if (!traceIsValid(trace, input.nowMs)) continue;
    if (input.visible(input.observer, trace.position, input.visionRange)) visible.push(trace);
  }
  return visible;
}

/**
 * 图层 C：有限线索记忆。
 *
 * 只保存「已发现痕迹的必要快照」（ID / 位置 / 方向 / 产生时间 / 发现时间 /
 * 有效截止时间），并按原实体的有效期过期——不允许无限保留，也不允许继续参与
 * 路径推断。
 */
export class RiceTraceClueMemory {
  private readonly cluesById = new Map<string, TraceClue>();
  discoveredCount = 0;
  expiredCount = 0;
  lastDiscoveredAt: number | null = null;
  lastExpiredAt: number | null = null;
  droppedCount = 0;

  /** 过期清理：`validUntil <= nowMs` 的线索必须立刻失效。 */
  advance(nowMs: number): void {
    for (const [id, clue] of [...this.cluesById]) {
      if (clue.validUntil > nowMs) continue;
      this.cluesById.delete(id);
      this.expiredCount++;
      this.lastExpiredAt = nowMs;
    }
  }

  /**
   * 把「本帧真正看见」的米痕写进记忆（只写没见过的），返回本次新增的线索。
   * 过期检查在写入之前跑，因此过期的脚印永远不会变成新线索。
   */
  discover(traces: readonly RiceTrace[], nowMs: number): TraceClue[] {
    this.advance(nowMs);
    const added: TraceClue[] = [];
    for (const trace of traces) {
      if (this.cluesById.has(trace.id)) continue;
      if (!traceIsValid(trace, nowMs)) continue;
      if (this.cluesById.size >= CLUE_MEMORY_MAX) {
        this.droppedCount++;
        continue;
      }
      const clue: TraceClue = {
        traceId: trace.id,
        position: { x: trace.position.x, z: trace.position.z },
        heading: trace.heading,
        createdAt: trace.createdAt,
        discoveredAt: nowMs,
        // 记忆寿命不得超过原实体：直接沿用实体自己的过期时刻。
        validUntil: trace.createdAt + trace.lifetimeMs,
      };
      this.cluesById.set(trace.id, clue);
      this.discoveredCount++;
      this.lastDiscoveredAt = nowMs;
      added.push(clue);
    }
    return added;
  }

  isKnown(traceId: string): boolean { return this.cluesById.has(traceId); }

  /** 全部有效线索，按生成时间旧→新排序（同一时间用 ID 兜底，保证确定性）。 */
  clues(): TraceClue[] {
    return [...this.cluesById.values()].sort((a, b) =>
      a.createdAt - b.createdAt || (a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0));
  }

  latest(): TraceClue | null {
    const all = this.clues();
    return all.length ? all[all.length - 1] : null;
  }

  count(): number { return this.cluesById.size; }

  /** 同一批线索的稳定签名：用于「同一批米痕不得反复触发同一个调查任务」。 */
  signature(): string {
    const latestClue = this.latest();
    return latestClue ? `${latestClue.traceId}@${latestClue.createdAt}` : 'NO_CLUE';
  }

  reset(): void {
    this.cluesById.clear();
    this.discoveredCount = 0;
    this.expiredCount = 0;
    this.lastDiscoveredAt = null;
    this.lastExpiredAt = null;
    this.droppedCount = 0;
  }
}
