import type { HideSpot, Point, Rect } from '../three/map/apartmentMap.ts';
import { pointOnRectSurface, rectSurfacePoint } from '../three/map/RotatedRect.ts';
import { furnitureApproachSurfacePoint } from '../three/map/HideInteractionRegion.ts';
import { evaluateHumanSearchGeometry, wrapToPi }
  from './HumanSearchSkill.ts';
import type { HumanAIMapSnapshot } from './HumanAIController.ts';

/**
 * S7C-2 修复轮：正式搜查的**可测试接缝**与**权威判定层**。
 *
 * 1. `createHumanAiMapSnapshot()` —— 游戏层交给 Human AI 的公开世界快照的唯一构造点。
 *    以前这段接线直接写在 `ThreeGame` 里，于是「构造函数只挑了 furniture/hideSpots
 *    两个字段、丢掉三条几何回调」这种故障在单元测试与 `tsc` 里都是全绿的，只在
 *    真实运行时表现为「AI 永远看不见米痕」。抽到这里以后，测试可以用**同一段
 *    真实源码**（真实地图 + 真实 CollisionWorld + 真实 PerceptionGeometry）构造
 *    快照并直接断言三条接缝真的生效。
 *
 * 2. `evaluateHideStance()` —— 「是否真的站到规划保存的站位上」的**唯一谓词**。
 *    修复轮（第二轮）的核心故障是：AI 用 A* 网格点判断到站、权威层却用原始
 *    `stancePoint` 判断站位，两个中心不一致，于是每次都「DWELL 满 900 ms → REQUEST
 *    → STANCE_LOST」。现在导航点仍只作寻路节点，AI 必须在真实碰撞下继续接近原始
 *    `stancePoint`，并且**用与权威层逐字相同的公式**判断是否可以进入 DWELL。
 *
 * 3. `resolveHumanAiHideCheck()` —— Human AI 正式搜查的权威判定层。
 *    顺序被固定为「计划仍属于当前地图 → 公开几何（真实站位 / 朝向 / 1.5 u /
 *    120° / 墙门遮挡）→ 才读权威占用」：公开几何任何一条不成立时权威占用查询
 *    次数为零，而且不记搜空、不进 6 秒冷却、不写公开失败记忆。
 *
 * 4. `resolveHumanFurnitureSearch()` —— Human **玩家** Q 的家具搜查权威判定层。
 *    与 AI 共享「指定家具权威占用」这一个小接口，但上游几何是**另一套**：
 *    玩家只要站在合法交互区域内即可，不需要面向家具，也不做 1.5 u / 120° 判定。
 *
 * 本模块只处理「已经拿到公开几何与权威信息之后」的判定；它不做候选排序，也不做
 * 搜查决策，因此不构成第二套搜查系统。
 */

/** 游戏层交给 Human AI 的公开世界快照的构造输入（全部是公开数据 + 真实几何接缝）。 */
export interface HumanAiMapSnapshotWorld {
  /** 当前已应用地图的公开家具。 */
  furniture: readonly Rect[];
  /** 当前已应用地图的公开藏身点。 */
  hideSpots: readonly HideSpot[];
  /** 真实视觉状态（距离 + 墙体 + 非 OPEN 门叶），返回 `VisionStatus` 字符串。 */
  visionStatus: (from: Point, to: Point, maxRange: number) => string;
  /** Human 角色圆的真实可站立判定（复用 `CollisionWorld`）。 */
  canOccupyStaticXZ: (x: number, z: number, radius: number, height: number) => boolean;
  playerRadius: number;
  actorHeight: number;
}

/**
 * 唯一构造点：地图数据 + 三条真实几何接缝。
 * 三条接缝的语义固定为「失败即拒绝」（看不见 / 站不住 / 被挡住），
 * 因此这里必须真的接线，不允许留空。
 */
export function createHumanAiMapSnapshot(world: HumanAiMapSnapshotWorld):
HumanAIMapSnapshot {
  return {
    furniture: world.furniture,
    hideSpots: world.hideSpots,
    canSee: (from, to, maxRange) =>
      world.visionStatus(from, to, maxRange) === 'VISIBLE',
    standable: point => world.canOccupyStaticXZ(point.x, point.z,
      world.playerRadius, world.actorHeight),
    lineBlocked: (a, b) =>
      world.visionStatus(a, b, Number.POSITIVE_INFINITY) !== 'VISIBLE',
  };
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

// ---------------------------------------------------------------------------
// 「是否真的站到规划站位上」的唯一谓词
// ---------------------------------------------------------------------------

export interface HideStanceEvaluation {
  /** 实际角色位置是否落在规划站位容差内（与权威层公式逐字相同）。 */
  stanceHeld: boolean;
  /** 实际朝向是否等于规划朝向。 */
  headingHeld: boolean;
  /** 实际位置到规划站位的距离；没有规划站位时为 null。 */
  stanceDistance: number | null;
  /** 实际朝向与规划朝向之差（弧度，已归一到 (-π, π]）。 */
  headingDeltaRad: number | null;
}

export const EMPTY_HIDE_STANCE_EVALUATION: HideStanceEvaluation = { stanceHeld: false,
  headingHeld: false, stanceDistance: null, headingDeltaRad: null };

/**
 * 站位谓词。容差**复用**既有的 `humanAI.waypointTolerance` 与
 * `collision.contactEpsilon`，本轮不新增任何距离门槛，也不靠放宽容差掩盖
 * 「导航终点 ≠ 正式站位」的问题。
 */
export function evaluateHideStance(input: {
  stancePoint: Point | null;
  plannedHeadingRad: number | null;
  humanPosition: Point;
  humanHeadingRad: number;
  waypointTolerance: number;
  contactEpsilon: number;
}): HideStanceEvaluation {
  if (!input.stancePoint) return EMPTY_HIDE_STANCE_EVALUATION;
  const stanceDistance = distance(input.stancePoint, input.humanPosition);
  const stanceHeld = stanceDistance <= input.waypointTolerance + input.contactEpsilon;
  if (input.plannedHeadingRad === null) {
    return { stanceHeld, headingHeld: false, stanceDistance, headingDeltaRad: null };
  }
  const headingDeltaRad = wrapToPi(input.humanHeadingRad - input.plannedHeadingRad);
  return { stanceHeld, headingHeld: Math.abs(headingDeltaRad) <= 1e-3,
    stanceDistance, headingDeltaRad };
}

// ---------------------------------------------------------------------------
// Human AI 正式搜查的权威判定
// ---------------------------------------------------------------------------

export type HumanHideCheckCode = 'STANCE_LOST' | 'HEADING_LOST' | 'PLAN_STALE'
  | 'MISS_EMPTY' | 'HIT_CONCEALED' | 'OUT_OF_RANGE' | 'OUTSIDE_FAN' | 'BLOCKED';

/**
 * 未完成「合法检查」的全部结果码：它们**不是**搜空，不能进 6 秒家具失败冷却，
 * 也不能写进公开失败记忆。只有 `MISS_EMPTY` 与 `HIT_CONCEALED` 才算真正完成的
 * 正式检查（并据此消耗本轮 / 本次调查的正式检查计数）。
 */
export const HUMAN_HIDE_CHECK_INCOMPLETE_CODES: readonly HumanHideCheckCode[] = [
  'PLAN_STALE', 'STANCE_LOST', 'HEADING_LOST', 'OUT_OF_RANGE', 'OUTSIDE_FAN', 'BLOCKED',
];

export const HUMAN_HIDE_CHECK_CODE_TEXT: Record<HumanHideCheckCode, string> = {
  STANCE_LOST: '实际角色没有站到正式认可的站位上（未完成检查，不记搜空）',
  HEADING_LOST: '实际朝向不符合正式执行条件（未完成检查，不记搜空）',
  PLAN_STALE: '计划瞄点已不属于当前地图的目标家具（已取消，不记搜空）',
  MISS_EMPTY: '这件家具里没有人（搜空）',
  HIT_CONCEALED: '搜出藏身目标',
  OUT_OF_RANGE: '超出搜查半径（未完成检查，不记搜空）',
  OUTSIDE_FAN: '不在搜查张角内（未完成检查，不记搜空）',
  BLOCKED: '被墙或关闭的门挡住（未完成检查，不记搜空）',
};

export interface HumanHideCheckResolutionInput {
  /** AI 请求检查的公开藏身点 ID（来自 AI 自己的候选排序）。 */
  spotId: string;
  /** AI 规划时保存的合法站位与表面点；缺失说明计划已被打断。 */
  stance: { stancePoint: Point; surfacePoint: Point; headingRad: number } | null;
  /** Human AI 的真实位置与真实朝向。 */
  humanPosition: Point;
  humanHeadingRad: number;
  /** 既有导航到位容差与碰撞接触容差（不新增阈值）。 */
  waypointTolerance: number;
  contactEpsilon: number;
  /** 当前已应用地图的公开数据。 */
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
  /**
   * 惰性权威读取。**只有在公开几何全部通过之后**才会被调用一次，因此
   * 「公开几何失败时权威占用查询次数为零」是可断言的事实，而不是口头承诺。
   */
  readOccupancy: () => { concealedSpotId: string | null };
  /** 正式遮挡规则（墙体 + 非 OPEN 门叶），与视觉同源。 */
  lineBlocked: (a: Point, b: Point) => boolean;
  /** 正式搜查的半径与半角（= humanSearch.range / halfAngleDeg）。 */
  range: number;
  halfAngleDeg: number;
  /** 复核「计划瞄点仍在表面上」的容差，默认 0.05 世界单位。 */
  surfaceTolerance?: number;
}

export interface HumanHideCheckResolution {
  code: HumanHideCheckCode;
  hit: boolean;
  /** true = 真正完成了一次正式检查（只有搜空 / 搜中）。 */
  executable: boolean;
  /** 取消路径：`PLAN_STALE` = 地图/家具变了（可退还本轮配额）；`INCOMPLETE` = 未完成。 */
  cancelKind: 'NONE' | 'PLAN_STALE' | 'INCOMPLETE';
  stanceHeld: boolean;
  headingHeld: boolean;
  /** REQUEST 时实际角色位置到规划站位的距离。 */
  stanceDistance: number | null;
  headingDeltaRad: number | null;
  /** AI 规划时保存的表面点。 */
  plannedSurfacePoint: Point | null;
  /** 正式判定真正使用的瞄点（= 计划保存的表面点，绝不重新取「最近表面点」）。 */
  finalAimPoint: Point | null;
  /** 同一时刻「最近表面点」算法会选中的点，仅用于公开对比诊断。 */
  nearestSurfacePoint: Point | null;
  /** 计划瞄点与「最近表面点」的距离差（世界单位，仅诊断）。 */
  aimPointDelta: number | null;
  /** 诊断：计划瞄点是否恰好等于「最近表面点」算法会选的点（差 ≤ 容差）。 */
  aimPointMatchesNearest: boolean;
  distance: number | null;
  angleDeltaDeg: number | null;
  blocked: boolean;
  /** 权威层是否真的比较过真实藏身点（日志用；绝不回传给 AI 决策）。 */
  readAuthoritativeSpot: boolean;
  /** 该结果是否计入「真正完成的正式检查」计数（仅搜空 / 搜中为 true）。 */
  countsAsFormalCheck: boolean;
  detail: string;
}

/**
 * 正式搜查判定。调用顺序刻意如此：
 *   ① 计划是否还对得上当前地图（藏身点 / 家具 / 表面点）—— 对不上就取消，不记搜空；
 *   ② 站位与朝向（与 AI 侧进入 DWELL 用的是同一个谓词）；
 *   ③ 公开几何：1.5 u 半径、120° 扇形、墙门遮挡（瞄点用计划保存的那个）；
 *   ④ 只有 ①②③ 都成立，才读一次权威占用，并把结果压成一个布尔值给 AI。
 */
export function resolveHumanAiHideCheck(input: HumanHideCheckResolutionInput):
HumanHideCheckResolution {
  const base = {
    stanceHeld: false, headingHeld: false, stanceDistance: null as number | null,
    headingDeltaRad: null as number | null,
    plannedSurfacePoint: null as Point | null,
    finalAimPoint: null as Point | null, nearestSurfacePoint: null as Point | null,
    aimPointDelta: null as number | null, aimPointMatchesNearest: false,
    distance: null as number | null,
    angleDeltaDeg: null as number | null, blocked: false,
    readAuthoritativeSpot: false, countsAsFormalCheck: false,
  };
  const tolerance = input.surfaceTolerance ?? 0.05;
  const stale = (detail: string, extra: Partial<HumanHideCheckResolution> = {}):
  HumanHideCheckResolution => ({ ...base, ...extra, code: 'PLAN_STALE', hit: false,
    executable: false, cancelKind: 'PLAN_STALE', detail });
  const incomplete = (code: HumanHideCheckCode, detail: string,
    extra: Partial<HumanHideCheckResolution> = {}): HumanHideCheckResolution =>
    ({ ...base, ...extra, code, hit: false, executable: false, cancelKind: 'INCOMPLETE',
      detail });

  const checkSpot = input.hideSpots.find(spot => spot.id === input.spotId) ?? null;
  if (!checkSpot || !input.stance) {
    return stale(checkSpot ? '计划已被打断：没有保存的搜查站位' : '目标藏身点已不在当前地图');
  }
  const furniture = input.furniture.find(rect => rect.id === checkSpot.furnitureId) ?? null;
  if (!furniture) {
    return stale(`目标家具 ${checkSpot.furnitureId} 已不在当前地图`,
      { plannedSurfacePoint: { ...input.stance.surfacePoint } });
  }
  const plannedSurfacePoint = { ...input.stance.surfacePoint };
  if (!pointOnRectSurface(plannedSurfacePoint, furniture, tolerance)) {
    return stale('计划瞄点已不属于当前地图的目标家具（家具可能被移动或旋转）',
      { plannedSurfacePoint,
        nearestSurfacePoint: rectSurfacePoint(furniture, input.humanPosition) });
  }

  // ② 站位 / 朝向：与 AI 侧「能否进入 DWELL」用的是同一个谓词，因此不会再出现
  // 「AI 认为到站了、权威层却认为站位失效」的两个中心。
  const stance = evaluateHideStance({ stancePoint: input.stance.stancePoint,
    plannedHeadingRad: input.stance.headingRad,
    humanPosition: input.humanPosition, humanHeadingRad: input.humanHeadingRad,
    waypointTolerance: input.waypointTolerance, contactEpsilon: input.contactEpsilon });
  const nearestSurfacePoint = rectSurfacePoint(furniture, input.humanPosition);
  const aimPointDelta = distance(nearestSurfacePoint, plannedSurfacePoint);
  const shared = { ...base, stanceHeld: stance.stanceHeld, headingHeld: stance.headingHeld,
    stanceDistance: stance.stanceDistance, headingDeltaRad: stance.headingDeltaRad,
    plannedSurfacePoint, nearestSurfacePoint, aimPointDelta,
    aimPointMatchesNearest: aimPointDelta <= tolerance };
  if (!stance.stanceHeld) {
    return incomplete('STANCE_LOST',
      `实际站位距规划站位 ${stance.stanceDistance?.toFixed(3) ?? '—'} 世界单位`, shared);
  }
  if (!stance.headingHeld) {
    return incomplete('HEADING_LOST',
      `实际朝向与规划朝向相差 ${((stance.headingDeltaRad ?? 0) * 180 / Math.PI).toFixed(1)}°`,
      shared);
  }
  // ③ 公开几何：与玩家 Q 完全同一套核心（距离 / 张角 / 遮挡），瞄点用计划保存的那个。
  const geometry = evaluateHumanSearchGeometry({
    origin: input.humanPosition, headingRad: input.humanHeadingRad,
    aimPoint: plannedSurfacePoint, range: input.range,
    halfAngleDeg: input.halfAngleDeg, lineBlocked: input.lineBlocked });
  const geometryPart = { ...shared, finalAimPoint: { ...plannedSurfacePoint },
    distance: geometry.distance, angleDeltaDeg: geometry.angleDeltaDeg,
    blocked: geometry.blocked };
  if (!geometry.ok) {
    // 公开几何不通过：**不读**权威占用，也不记搜空，只取消这次未完成的检查。
    return incomplete(geometry.code as HumanHideCheckCode,
      HUMAN_HIDE_CHECK_CODE_TEXT[geometry.code as HumanHideCheckCode], geometryPart);
  }
  // ④ 公开几何全部通过，才允许读一次权威占用。
  const occupancy = input.readOccupancy();
  const concealedFurnitureId = occupancy.concealedSpotId
    ? input.hideSpots.find(spot => spot.id === occupancy.concealedSpotId)?.furnitureId ?? null
    : null;
  const sameFurniture = concealedFurnitureId !== null &&
    concealedFurnitureId === checkSpot.furnitureId;
  if (!sameFurniture) {
    return { ...geometryPart, code: 'MISS_EMPTY', hit: false, executable: true,
      cancelKind: 'NONE', readAuthoritativeSpot: true, countsAsFormalCheck: true,
      detail: `检查 ${input.spotId}：搜空` };
  }
  return { ...geometryPart, code: 'HIT_CONCEALED', hit: true, executable: true,
    cancelKind: 'NONE', readAuthoritativeSpot: true, countsAsFormalCheck: true,
    detail: HUMAN_HIDE_CHECK_CODE_TEXT.HIT_CONCEALED };
}

// ---------------------------------------------------------------------------
// Human 玩家 Q 的家具搜查权威判定
// ---------------------------------------------------------------------------

export type HumanFurnitureSearchCode = 'HIT_CONCEALED' | 'MISS_EMPTY' | 'NOT_LEGAL'
  | 'PLAN_STALE' | 'NO_TARGET';

export const HUMAN_FURNITURE_SEARCH_CODE_TEXT: Record<HumanFurnitureSearchCode, string> = {
  HIT_CONCEALED: '搜出藏身目标',
  MISS_EMPTY: '家具是空的（搜空）',
  NOT_LEGAL: '当前位置不是该家具的合法交互位置（未执行搜查）',
  PLAN_STALE: '目标家具已不在当前地图（未执行搜查）',
  NO_TARGET: '当前没有唯一高亮的可搜查家具',
};

export interface HumanFurnitureSearchInput {
  /** 按键当帧解析出的唯一高亮家具对应的公开藏身点；null = 没有家具目标。 */
  spotId: string | null;
  /** 按键当帧玩家真实位置。 */
  playerPosition: Point;
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
  /**
   * 按键当帧重新解析出的公开合法性（区域成员 + 可站立 + 家具表面无遮挡 + 导航格）。
   * 这里不接受「上一帧的高亮」，调用方必须传入当帧结果。
   */
  legal: boolean;
  /** 公开合法性的拒绝原因码（区域 / 站立 / 遮挡 / 导航格）。 */
  legalCode: string;
  /** 正式遮挡规则（墙体 + 非 OPEN 门叶），与视觉同源。 */
  lineBlocked: (a: Point, b: Point) => boolean;
  /** 惰性权威读取；公开检查全部通过后才调用一次。 */
  readOccupancy: () => { concealedSpotId: string | null };
}

export interface HumanFurnitureSearchResolution {
  code: HumanFurnitureSearchCode;
  hit: boolean;
  furnitureId: string | null;
  /** 家具的可接近表面点（公开数据，仅用于表现与日志，不参与命中几何）。 */
  aimPoint: Point | null;
  blocked: boolean;
  readAuthoritativeSpot: boolean;
  /** true = 真正完成一次家具搜查（搜中或合法搜空），据此消耗已有的 12 秒冷却。 */
  executable: boolean;
  detail: string;
}

/**
 * 玩家 Q 的家具搜查判定顺序（用户本轮批准）：
 *   ① 有唯一高亮家具（当帧解析结果）；
 *   ② 该藏身点与家具仍属于当前已应用地图；
 *   ③ 玩家确实位于合法交互区域内；
 *   ④ 与家具之间没有墙或非 OPEN 门叶（公开遮挡复核，绝不隔墙搜查）；
 *   ⑤ 全部通过才查询这件家具的权威占用。
 *
 * 玩家**不需要**面向家具，家具也不需要落在任何 120° 扇形内：这里刻意不调用普通
 * 扇形的那套距离 / 张角几何，1.5 u / 120° 是 AI 与普通扇形抓捕的规则。
 */
export function resolveHumanFurnitureSearch(input: HumanFurnitureSearchInput):
HumanFurnitureSearchResolution {
  const base = { hit: false, furnitureId: null as string | null,
    aimPoint: null as Point | null, blocked: false, readAuthoritativeSpot: false,
    executable: false };
  if (!input.spotId) {
    return { ...base, code: 'NO_TARGET',
      detail: HUMAN_FURNITURE_SEARCH_CODE_TEXT.NO_TARGET };
  }
  const spot = input.hideSpots.find(entry => entry.id === input.spotId) ?? null;
  if (!spot) {
    return { ...base, code: 'PLAN_STALE',
      detail: `${input.spotId} 已不在当前地图（未执行搜查）` };
  }
  const furniture = input.furniture.find(rect => rect.id === spot.furnitureId) ?? null;
  if (!furniture) {
    return { ...base, code: 'PLAN_STALE', furnitureId: spot.furnitureId,
      detail: `目标家具 ${spot.furnitureId} 已不在当前地图（未执行搜查）` };
  }
  const aimPoint = furnitureApproachSurfacePoint(furniture, input.playerPosition);
  const blocked = input.lineBlocked(input.playerPosition, aimPoint);
  if (!input.legal || blocked) {
    return { ...base, code: 'NOT_LEGAL', furnitureId: furniture.id, aimPoint, blocked,
      detail: blocked
        ? '玩家与该家具之间隔着墙或关闭的门（未执行搜查）'
        : `${input.legalCode}（未执行搜查）` };
  }
  const occupancy = input.readOccupancy();
  const concealedFurnitureId = occupancy.concealedSpotId
    ? input.hideSpots.find(entry => entry.id === occupancy.concealedSpotId)?.furnitureId ?? null
    : null;
  if (concealedFurnitureId === furniture.id) {
    return { ...base, code: 'HIT_CONCEALED', hit: true, furnitureId: furniture.id,
      aimPoint, readAuthoritativeSpot: true, executable: true,
      detail: HUMAN_FURNITURE_SEARCH_CODE_TEXT.HIT_CONCEALED };
  }
  return { ...base, code: 'MISS_EMPTY', furnitureId: furniture.id, aimPoint,
    readAuthoritativeSpot: true, executable: true,
    detail: HUMAN_FURNITURE_SEARCH_CODE_TEXT.MISS_EMPTY };
}
