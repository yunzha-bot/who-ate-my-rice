import { GAME_CONFIG } from '../config/gameConfig.ts';
import { rectSurfacePoint } from '../three/map/RotatedRect.ts';
import type { Point, Rect } from '../three/map/apartmentMap.ts';

/**
 * S7C-1B：Human 玩家 Q「扇形搜查与手动抓捕」的判定核心 —— 纯逻辑。
 *
 * 这里只回答「按下去的那一瞬间，扇形命中了什么」：
 *   - 距离与角度只用**释放瞬间**的快照，之后的淡入淡出不产生第二次命中；
 *   - 对未藏身目标：目标真实位置落在扇形内、且在正式遮挡规则下没有阻挡；
 *   - 对藏身目标：瞄的是它真正绑定家具的**可接近表面**（不是家具中心、也不是
 *     藏身者的实时坐标），因此家具中心在扇形内但隔着墙时不会命中；
 *   - 一次释放只评估这一个目标，不扫描扇形覆盖的其它空间，也不暴露占用状态。
 *
 * 按键、12 秒冷却与 Three.js 特效都在调用方，未来 S7C-2 的 Human AI 可以复用
 * 同一个函数（但本轮不实现 AI 的搜查决策）。
 */
export type HumanSearchCode = 'HIT_VISIBLE' | 'HIT_CONCEALED' | 'NO_TARGET' | 'NO_HIDE_SPOT'
  | 'EMPTY_HIDE_SPOT' | 'OUT_OF_RANGE' | 'OUTSIDE_FAN' | 'BLOCKED';

export type HumanSearchOutcome = 'CAPTURE_VISIBLE' | 'FLUSH_CONCEALED' | 'MISS';

export const HUMAN_SEARCH_BOUNDARY_EPSILON = 1e-9;

export interface HumanSearchTarget {
  /** 目标是否处于 CONCEALED（只有 HideSystem 说是，才可能是 true）。 */
  concealed: boolean;
  /** 目标的真实位置：只在未藏身时参与判定。 */
  position: Point;
  spotId: string | null;
  /** 藏身目标真正绑定的家具；缺失时不能命中。 */
  furniture: Rect | null;
}

export interface HumanSearchInput {
  /** 释放瞬间 Human 的真实位置。 */
  origin: Point;
  /** 释放瞬间的面朝方向（世界 XZ，弧度，atan2(dz, dx)）。 */
  headingRad: number;
  /** 本局的目标；无目标时为 null。 */
  target: HumanSearchTarget | null;
  /** 正式遮挡规则（墙体 + 非 OPEN 门叶），与视觉判定同源。 */
  lineBlocked: (a: Point, b: Point) => boolean;
}

export interface HumanSearchTuning {
  range: number;
  halfAngleDeg: number;
}

export interface HumanSearchResult {
  outcome: HumanSearchOutcome;
  code: HumanSearchCode;
  /** 实际被判定的点：未藏身＝目标位置；藏身＝家具可接近表面点。 */
  aimPoint: Point | null;
  distance: number;
  angleDeltaDeg: number;
  blocked: boolean;
  concealed: boolean;
  spotId: string | null;
}

export const DEFAULT_HUMAN_SEARCH_TUNING: HumanSearchTuning = {
  range: GAME_CONFIG.humanSearch.range,
  halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
};

export function wrapToPi(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function directionToHeadingRad(direction: { x: number; y: number }): number {
  return Math.atan2(direction.y, direction.x);
}

/** Three.js 里 `rotation.y = -heading` 才能把局部 +X 指到该朝向。 */
export function headingRadToMeshRotationY(headingRad: number): number {
  return -headingRad;
}

export function evaluateHumanSearch(input: HumanSearchInput,
  tuning: HumanSearchTuning = DEFAULT_HUMAN_SEARCH_TUNING): HumanSearchResult {
  const halfAngleRad = tuning.halfAngleDeg * Math.PI / 180;
  const miss = (code: HumanSearchCode, aimPoint: Point | null, distance: number,
    angleDeltaDeg: number, blocked = false, concealed = false,
    spotId: string | null = null): HumanSearchResult => ({
    outcome: 'MISS', code, aimPoint, distance, angleDeltaDeg, blocked, concealed, spotId,
  });

  const target = input.target;
  if (!target) return miss('NO_TARGET', null, Number.POSITIVE_INFINITY, Number.NaN);
  const spotId = target.spotId;

  let aimPoint: Point;
  if (target.concealed) {
    // 藏身目标只能通过它自己的家具命中：没有绑定家具就没有合法搜查目标。
    if (!spotId) return miss('NO_HIDE_SPOT', null, Number.POSITIVE_INFINITY, Number.NaN,
      false, true, null);
    if (!target.furniture) {
      return miss('EMPTY_HIDE_SPOT', null, Number.POSITIVE_INFINITY, Number.NaN,
        false, true, spotId);
    }
    aimPoint = rectSurfacePoint(target.furniture, input.origin);
  } else {
    aimPoint = { x: target.position.x, z: target.position.z };
  }

  const deltaX = aimPoint.x - input.origin.x;
  const deltaZ = aimPoint.z - input.origin.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const angleDelta = wrapToPi(Math.atan2(deltaZ, deltaX) - input.headingRad);
  const angleDeltaDeg = angleDelta * 180 / Math.PI;
  if (distance > tuning.range + HUMAN_SEARCH_BOUNDARY_EPSILON) {
    return miss('OUT_OF_RANGE', aimPoint, distance, angleDeltaDeg, false, target.concealed, spotId);
  }
  if (Math.abs(angleDelta) > halfAngleRad + HUMAN_SEARCH_BOUNDARY_EPSILON) {
    return miss('OUTSIDE_FAN', aimPoint, distance, angleDeltaDeg, false, target.concealed, spotId);
  }
  if (input.lineBlocked(input.origin, aimPoint)) {
    return miss('BLOCKED', aimPoint, distance, angleDeltaDeg, true, target.concealed, spotId);
  }
  return {
    outcome: target.concealed ? 'FLUSH_CONCEALED' : 'CAPTURE_VISIBLE',
    code: target.concealed ? 'HIT_CONCEALED' : 'HIT_VISIBLE',
    aimPoint, distance, angleDeltaDeg, blocked: false, concealed: target.concealed, spotId,
  };
}

/** DEV / HUD 用的通俗中文。 */
export const HUMAN_SEARCH_CODE_TEXT: Record<HumanSearchCode, string> = {
  HIT_VISIBLE: '命中未藏身目标',
  HIT_CONCEALED: '搜出藏身目标',
  NO_TARGET: '本局没有抓捕目标',
  NO_HIDE_SPOT: '目标没有绑定藏身点',
  EMPTY_HIDE_SPOT: '目标所在家具数据缺失',
  OUT_OF_RANGE: '目标不在扇形半径内',
  OUTSIDE_FAN: '目标不在扇形张角内',
  BLOCKED: '被墙或关闭的门挡住',
};
