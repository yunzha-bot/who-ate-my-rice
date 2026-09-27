import type { Point } from '../three/map/apartmentMap.ts';
import type { TraceClue } from './RiceTraceClues.ts';
import { TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH, TRACE_CHAIN_MAX_CLUES,
  TRACE_DIRECTION_CONTRADICTION_DEG, TRACE_LINK_DISTANCE }
  from './HumanSearchTuning.ts';

/**
 * S7C-2：规则型米痕循迹与方向推断 —— 纯逻辑，可解释、可测试。
 *
 * 这里完全不用机器学习，也不做复杂预测：只用**真实生成时间**定新旧、用**真实
 * 空间连续性**连接相邻脚印、再用脚印自带的朝向字段修正方向估计。规则是固定的，
 * 同样输入必然得到同样输出，而且每一步都能用中文说清依据。
 *
 * 只用「线索记忆」（图层 C）作为输入。它既不含 DeepSeek 的实时坐标，也不含任何
 * 藏身点占用信息，因此这里的结论天然是公开推断。
 *
 * 线索过期、跳跃过远、方向矛盾时都会**降低可信程度**，由调用方决定改去最新有效
 * 线索还是退回既有有限 SEARCH / PATROL。
 */
export type TraceInferenceCode =
  | 'NO_CLUE'
  | 'SINGLE_TRACE'
  | 'CHAIN'
  | 'TRACE_JUMP'
  | 'CHAIN_CONTRADICTORY';

export type TraceConfidence = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface TraceInference {
  code: TraceInferenceCode;
  confidence: TraceConfidence;
  /** 推断的调查锚点：最新一段连续痕迹的末端（没有线索时为 null）。 */
  anchor: Point | null;
  /** 估计的逃跑方向（单位向量），无法估计时为 null。 */
  direction: Point | null;
  directionHeadingRad: number | null;
  /** 参与推断的线索 ID，旧 → 新。 */
  chain: readonly string[];
  newestTraceId: string | null;
  /** 因为距离过远而被跳过的线索数量。 */
  gaps: number;
  /** 公开依据（中文）；DEV 面板与 AI JSON 直接展示，不含任何隐藏信息。 */
  basis: string[];
}

const NONE: TraceInference = { code: 'NO_CLUE', confidence: 'NONE', anchor: null,
  direction: null, directionHeadingRad: null, chain: [], newestTraceId: null, gaps: 0,
  basis: [] };

export function wrapToPi(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function headingToVector(headingRad: number): Point {
  return { x: Math.cos(headingRad), z: Math.sin(headingRad) };
}

/**
 * 米痕实体的 `heading` 字段与「世界朝向角」是**两个不同的约定**，必须显式换算：
 *   - `RiceTraceSystem` 用的是 `atan2(dx, dz)`（从 +Z 轴量起）；
 *   - 本模块与搜查扇形用的是 `atan2(dz, dx)`（从 +X 轴量起）。
 * 两者相差 π/2 的符号：`θ = π/2 - heading`。沿 +X 直线移动时实体 heading 是 π/2，
 * 而世界朝向角必须是 0——不换算就会把一条直线路径误判成「方向矛盾」。
 */
export function traceHeadingToDirectionRad(headingRad: number): number {
  return wrapToPi(Math.PI / 2 - headingRad);
}

/** 世界坐标系下的八方位中文名（+X 东、+Z 南）。 */
export function compassText(headingRad: number): string {
  const names = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
  const sector = Math.round(headingRad / (Math.PI / 4));
  return names[((sector % 8) + 8) % 8];
}

export const TRACE_INFERENCE_CODE_TEXT: Record<TraceInferenceCode, string> = {
  NO_CLUE: '还没有亲自看到任何米痕',
  SINGLE_TRACE: '只有一粒米：只能调查附近，不能锁定家具',
  CHAIN: '连续米痕构成一条路径',
  TRACE_JUMP: '更早的米痕跳跃过远，只使用了连续的一段',
  CHAIN_CONTRADICTORY: '脚印朝向与路径方向相互矛盾，可信度已降低',
};

export const TRACE_CONFIDENCE_TEXT: Record<TraceConfidence, string> = {
  NONE: '无线索', LOW: '低', MEDIUM: '中', HIGH: '高',
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * 从线索记忆推断方向。传入的线索必须已经按生成时间旧→新排序
 * （`RiceTraceClueMemory.clues()` 已保证）。
 */
export function inferTraceDirection(clues: readonly TraceClue[]): TraceInference {
  if (clues.length === 0) return { ...NONE };

  const recent = clues.slice(-TRACE_CHAIN_MAX_CLUES);
  const newest = recent[recent.length - 1];
  const chain: TraceClue[] = [newest];
  let gaps = 0;
  for (let index = recent.length - 2; index >= 0; index--) {
    const previous = recent[index];
    if (distance(previous.position, chain[0].position) <= TRACE_LINK_DISTANCE) {
      chain.unshift(previous);
      continue;
    }
    // 链在这里中断：更早的脚印离得太远，无法判断是不是同一次逃跑。
    gaps++;
    break;
  }
  const chainIds = chain.map(clue => clue.traceId);

  if (chain.length === 1) {
    const headingRad = traceHeadingToDirectionRad(newest.heading);
    return {
      code: 'SINGLE_TRACE', confidence: 'LOW',
      anchor: { x: newest.position.x, z: newest.position.z },
      direction: headingToVector(headingRad), directionHeadingRad: headingRad,
      chain: chainIds, newestTraceId: newest.traceId, gaps,
      basis: [`只看见 1 粒米（${newest.traceId}），位于 ` +
        `(${newest.position.x.toFixed(1)}, ${newest.position.z.toFixed(1)})`,
      '一粒米不足以锁定藏身家具，只能调查它附近',
      `参考该粒米自带的方向字段：${compassText(headingRad)}`],
    };
  }

  const first = chain[0];
  const span = distance(first.position, newest.position);
  const newestHeadingRad = traceHeadingToDirectionRad(newest.heading);
  if (span <= 1e-6) {
    return {
      code: 'TRACE_JUMP', confidence: 'LOW',
      anchor: { x: newest.position.x, z: newest.position.z },
      direction: headingToVector(newestHeadingRad),
      directionHeadingRad: newestHeadingRad,
      chain: chainIds, newestTraceId: newest.traceId, gaps,
      basis: ['连续米痕几乎重合，无法判断方向', '只保留最新一粒米作为调查锚点'],
    };
  }

  const chainHeading = Math.atan2(newest.position.z - first.position.z,
    newest.position.x - first.position.x);
  const contradiction = Math.abs(wrapToPi(chainHeading - newestHeadingRad)) * 180 / Math.PI;
  const contradictory = contradiction > TRACE_DIRECTION_CONTRADICTION_DEG;
  const code: TraceInferenceCode = contradictory ? 'CHAIN_CONTRADICTORY'
    : gaps > 0 ? 'TRACE_JUMP' : 'CHAIN';
  const confidence: TraceConfidence = contradictory ? 'LOW'
    : chain.length >= TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH && gaps === 0 ? 'HIGH'
      : 'MEDIUM';
  const basis = [
    `连续 ${chain.length} 粒米构成一条路径（${chainIds[0]} → ${chainIds[chainIds.length - 1]}）`,
    `路径跨度 ${span.toFixed(2)} 世界单位`,
    `估计逃跑方向：${compassText(chainHeading)}（${(chainHeading * 180 / Math.PI).toFixed(0)}°）`,
    `最新一粒米自带朝向：${compassText(newestHeadingRad)}，` +
      `与路径相差 ${contradiction.toFixed(0)}°`,
  ];
  if (gaps > 0) basis.push('更早的米痕跳跃过远，只采信这段连续痕迹');
  if (contradictory) basis.push('朝向与路径矛盾，可信度降为「低」');
  return {
    code, confidence,
    anchor: { x: newest.position.x, z: newest.position.z },
    direction: { x: (newest.position.x - first.position.x) / span,
      z: (newest.position.z - first.position.z) / span },
    directionHeadingRad: chainHeading,
    chain: chainIds, newestTraceId: newest.traceId, gaps, basis,
  };
}
