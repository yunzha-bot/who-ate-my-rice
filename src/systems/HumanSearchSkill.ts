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

/**
 * S7C-2：把「公开几何判定」单独抽出来，供 Human AI 复用。
 *
 * 只回答纯几何问题：离瞄点多远、在不在前方张角内、中间有没有被墙或非 OPEN 门
 * 挡住。它**不接触**任何目标身份、藏身状态或占用信息，所以 AI 可以在排序、站位
 * 规划阶段安全地反复调用它，而不会提前知道谁藏在哪。
 *
 * `evaluateHumanSearch()` 自己也走这条路径，保证玩家 Q 与 AI 搜查用的是同一套
 * 距离/张角/遮挡规则（只是各自的站位与触发条件不同）。
 */
export type HumanSearchGeometryCode = 'IN_RANGE' | 'OUT_OF_RANGE' | 'OUTSIDE_FAN' | 'BLOCKED';

export interface HumanSearchGeometryInput {
  origin: Point;
  headingRad: number;
  aimPoint: Point;
  range: number;
  halfAngleDeg: number;
  lineBlocked: (a: Point, b: Point) => boolean;
}

export interface HumanSearchGeometryResult {
  code: HumanSearchGeometryCode;
  ok: boolean;
  distance: number;
  angleDeltaDeg: number;
  blocked: boolean;
}

export function evaluateHumanSearchGeometry(input: HumanSearchGeometryInput):
HumanSearchGeometryResult {
  const halfAngleRad = input.halfAngleDeg * Math.PI / 180;
  const deltaX = input.aimPoint.x - input.origin.x;
  const deltaZ = input.aimPoint.z - input.origin.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const angleDeltaDeg = wrapToPi(Math.atan2(deltaZ, deltaX) - input.headingRad) * 180 / Math.PI;
  if (distance > input.range + HUMAN_SEARCH_BOUNDARY_EPSILON) {
    return { code: 'OUT_OF_RANGE', ok: false, distance, angleDeltaDeg, blocked: false };
  }
  if (Math.abs(angleDeltaDeg) * Math.PI / 180 > halfAngleRad + HUMAN_SEARCH_BOUNDARY_EPSILON) {
    return { code: 'OUTSIDE_FAN', ok: false, distance, angleDeltaDeg, blocked: false };
  }
  if (input.lineBlocked(input.origin, input.aimPoint)) {
    return { code: 'BLOCKED', ok: false, distance, angleDeltaDeg, blocked: true };
  }
  return { code: 'IN_RANGE', ok: true, distance, angleDeltaDeg, blocked: false };
}

export const HUMAN_SEARCH_GEOMETRY_CODE_TEXT: Record<HumanSearchGeometryCode, string> = {
  IN_RANGE: '在扇形内且无遮挡',
  OUT_OF_RANGE: '超出扇形半径',
  OUTSIDE_FAN: '不在扇形张角内',
  BLOCKED: '被墙或关闭的门挡住',
};

export function evaluateHumanSearch(input: HumanSearchInput,
  tuning: HumanSearchTuning = DEFAULT_HUMAN_SEARCH_TUNING): HumanSearchResult {
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

  // 距离、张角与遮挡三项全部走 S7C-2 抽出的公开几何核心：玩家 Q 与 AI 搜查
  // 因此共用同一套规则，不存在两份可能走偏的实现。
  const geometry = evaluateHumanSearchGeometry({ origin: input.origin,
    headingRad: input.headingRad, aimPoint, range: tuning.range,
    halfAngleDeg: tuning.halfAngleDeg, lineBlocked: input.lineBlocked });
  if (!geometry.ok) {
    return miss(geometry.code as HumanSearchCode, aimPoint, geometry.distance,
      geometry.angleDeltaDeg, geometry.blocked, target.concealed, spotId);
  }
  return {
    outcome: target.concealed ? 'FLUSH_CONCEALED' : 'CAPTURE_VISIBLE',
    code: target.concealed ? 'HIT_CONCEALED' : 'HIT_VISIBLE',
    aimPoint, distance: geometry.distance, angleDeltaDeg: geometry.angleDeltaDeg,
    blocked: false, concealed: target.concealed, spotId,
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

// ---------------------------------------------------------------------------
// S7C-2 修复轮 三：Human 玩家 Q 的**无副作用**「暴露目标」预检测
// ---------------------------------------------------------------------------

/**
 * 普通扇形 Q 在**当前这一帧**会不会真正抓到一个**未藏身**的目标。
 *
 * 修复轮 三给玩家 Q 加了分支优先级（暴露目标 > 指向家具 > 扇形空挥），因此按键当帧
 * 必须先知道「有没有合法暴露目标」，再决定这次 Q 是抓人还是搜家具。这个函数就是那个
 * 判断，而且它必须**绝对无副作用**：
 *
 *   - 它直接调用**正式的** `evaluateHumanSearch()`，不复制第二套距离 / 张角 / 遮挡
 *     规则——预检测说能抓到的样本，正式执行时必然也抓到（同一帧、同一输入）；
 *   - 它不显示扇形特效、不消耗冷却、不写日志、不释放藏身、不产生抓捕事件，
 *     这些全部留在调用方（`ThreeGame.performHumanSearch()`）里；
 *   - 藏身目标即使几何上命中也不算「暴露目标」（`available` 为 false）：对普通扇形
 *     而言它只是「被搜出」的对象，不能用来抢占家具搜查分支。
 */
export interface ExposedFanProbe {
  /** true = 存在合法暴露目标，普通扇形这一次会真的抓人。 */
  available: boolean;
  /** 与正式执行同源的判定结果码（藏身目标会是 HIT_CONCEALED，但 available 仍为 false）。 */
  code: HumanSearchCode;
  distance: number;
  angleDeltaDeg: number;
  blocked: boolean;
}

export function probeExposedFanTarget(input: HumanSearchInput,
  tuning: HumanSearchTuning = DEFAULT_HUMAN_SEARCH_TUNING): ExposedFanProbe {
  const result = evaluateHumanSearch(input, tuning);
  return {
    available: result.outcome === 'CAPTURE_VISIBLE',
    code: result.code,
    distance: result.distance,
    angleDeltaDeg: result.angleDeltaDeg,
    blocked: result.blocked,
  };
}
