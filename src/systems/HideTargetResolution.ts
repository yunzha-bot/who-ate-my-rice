import type { HideSpot, Point, Rect } from '../three/map/apartmentMap.ts';
import { checkHideRegionPosition, furnitureApproachSurfacePoint, hideRegionSetup,
  pointInHideRegion, wrapToPi, REGION_EPSILON,
  type HideRegionPositionCheck, type HideRegionPositionCode, type HideRegionWorld,
} from '../three/map/HideInteractionRegion.ts';
import { humanSearchGate } from './SkillGates.ts';

/**
 * S7C-2 修复轮 二 / 三：**公开家具交互目标的唯一解析函数**。
 *
 * 以前「离我最近的可交互藏身家具是哪一个」这段逻辑写在 `ThreeGame` 的
 * `nearestHideCandidate()` 里，只服务 DeepSeek 玩家按 E 藏身。S7C-2 修复轮 二把
 * Human 玩家按 Q 搜查家具接进同一套「公开目标解析」；修复轮 三再按用户批准的新
 * 规则给 Human 侧加上**指向条件**（把「玩家朝向」并入同一条解析流程，而不是另写
 * 一份选择逻辑）：
 *
 *   - DeepSeek 玩家 E：拿到 `target`（可能因为站位不合法而进入藏身状态机的
 *     `POSITION_ILLEGAL` 拒绝路径，行为与以前逐字相同；**不带 pointing 时不做任何
 *     朝向过滤**，所以 E 的藏身选择仍然不需要面向家具）；
 *   - Human 玩家 Q：只接受 `pointedLegalTarget`（区域成员 + 真实碰撞可站立 + 家具表面
 *     无墙门遮挡 + 落在真实导航格 + 玩家朝向大致对着该家具）。
 *
 * 四条刻意保持的语义：
 *   1. **只看公开数据**：家具、藏身点、真实碰撞 / 导航 / 墙门几何。绝不读藏身占用，
 *      因此白色高亮、Q 提示与实际搜查目标都能用同一次解析结果，且不会泄露谁藏在哪。
 *   2. **确定性**：按藏身点数组顺序遍历，取到锚点距离最小者；距离相同时保留先出现
 *      的那一条（严格 `<` 比较）。同样的公开输入必然得到同样的选中结果，
 *      不会出现「UI 高亮 A 家具、技能层搜查 B 家具」。
 *   3. **不排序占用**：候选之间不按「里面有没有人」排序——这个信息这里根本读不到。
 *   4. **指向只是一条选择条件**：它只比较角度（玩家朝向 vs 家具可接近表面方向），
 *      不做距离判定、不做遮挡判定、不参与命中几何；家具搜查本身仍然不做普通扇形的
 *      1.5 u / 120° 判定（见 `resolveHumanFurnitureSearch()`）。
 */
export type HideTargetCode = HideRegionPositionCode | 'NONE';

/** 玩家「指向家具」的选择条件（只在 Human 玩家 Q 侧传入）。 */
export interface HideTargetPointing {
  /** 按键当帧玩家的真实朝向（世界 XZ，弧度，`atan2(dz, dx)`）。 */
  headingRad: number;
  /** 指向容差（半角，度）；见 `PLAYER_Q_POINTING_HALF_ANGLE_DEG`。 */
  halfAngleDeg: number;
}

export interface HideTargetCandidate {
  spotId: string;
  furnitureId: string;
  /** 到该藏身点唯一锚点的距离（进入＝退出用的是同一个点）。 */
  distance: number;
  code: HideRegionPositionCode;
  legal: boolean;
  /** 玩家朝向是否对着该家具；未传 `pointing` 时恒为 true（不做朝向过滤）。 */
  pointed: boolean;
  /** 指向偏差（度）；未传 `pointing` 时为 NaN。 */
  pointingDeltaDeg: number;
}

export interface HideTargetResolutionInput {
  position: Point;
  spots: readonly HideSpot[];
  furniture: readonly Rect[];
  /** 真实碰撞 + 真实导航 + 真实门态；缺省门态等于「全部还是初始 CLOSED」。 */
  world: HideRegionWorld;
  /** 只考虑这些藏身点（AI 侧的房间过滤用；缺省表示全部）。 */
  restrictToSpotIds?: readonly string[];
  /** Human 玩家 Q 的指向条件；缺省 = 不做朝向过滤（DeepSeek 玩家 E 走的路径）。 */
  pointing?: HideTargetPointing;
}

export interface HideTargetResolution {
  /** 区域内最近的候选（可能不合法）。 */
  target: HideTargetCandidate | null;
  /** 区域内最近的**合法**候选（公开几何层面的合法性，不含朝向）。 */
  legalTarget: HideTargetCandidate | null;
  /** 区域内最近的同时**合法且被指向**的候选；Human 玩家 Q 只认这一个。 */
  pointedLegalTarget: HideTargetCandidate | null;
  /** 与旧的 `hideCandidateCode` 完全同义：有候选时取候选的码，否则 `NONE`。 */
  code: HideTargetCode;
  spotId: string | null;
  furnitureId: string | null;
  legal: boolean;
  /** 区域内候选数量（DEV / 日志用，不参与判定）。 */
  candidatesInRegion: number;
}

const NONE: HideTargetResolution = { target: null, legalTarget: null,
  pointedLegalTarget: null, code: 'NONE', spotId: null, furnitureId: null,
  legal: false, candidatesInRegion: 0 };

/**
 * 玩家朝向是否大致对着这件家具。
 *
 * 瞄点是家具的**可接近表面点**（`furnitureApproachSurfacePoint`，与 AI 站位规划、
 * 家具搜查用的是同一个公开几何助手），不是家具中心：长条家具（柜台 / 书架）从端头
 * 指向时，表面点方向比中心方向更贴近玩家的真实直觉，因此不需要「精确瞄准一个极小点」。
 */
export function pointsAtFurniture(position: Point, pointing: HideTargetPointing,
  furniture: Rect): { pointed: boolean; deltaDeg: number } {
  const aim = furnitureApproachSurfacePoint(furniture, position);
  const deltaX = aim.x - position.x;
  const deltaZ = aim.z - position.z;
  const distance = Math.hypot(deltaX, deltaZ);
  // 与家具可接近表面重合（真实碰撞下站不进家具内部，这里只是退化保护）。
  if (distance <= REGION_EPSILON) return { pointed: true, deltaDeg: 0 };
  const deltaDeg = Math.abs(wrapToPi(Math.atan2(deltaZ, deltaX) - pointing.headingRad)) *
    180 / Math.PI;
  return { pointed: deltaDeg <= pointing.halfAngleDeg + 1e-9, deltaDeg };
}

export function resolveHideInteractionTarget(input: HideTargetResolutionInput):
HideTargetResolution {
  const allowed = input.restrictToSpotIds
    ? new Set(input.restrictToSpotIds) : null;
  let target: HideTargetCandidate | null = null;
  let legalTarget: HideTargetCandidate | null = null;
  let pointedLegalTarget: HideTargetCandidate | null = null;
  let candidatesInRegion = 0;
  for (const spot of input.spots) {
    if (allowed && !allowed.has(spot.id)) continue;
    const setup = hideRegionSetup(spot, input.furniture);
    if (!setup) continue;
    // 先用便宜的区域成员判定筛掉绝大多数点，再跑昂贵的碰撞 / 导航 / 遮挡检查。
    if (!pointInHideRegion(setup.geometry, input.position)) continue;
    const check: HideRegionPositionCheck = checkHideRegionPosition(setup,
      input.position, input.world);
    // 指向条件并入同一条解析流程：只比角度，不做第二次几何扫描。
    const pointing = input.pointing
      ? pointsAtFurniture(input.position, input.pointing, setup.furniture)
      : { pointed: true, deltaDeg: Number.NaN };
    const candidate: HideTargetCandidate = { spotId: spot.id,
      furnitureId: spot.furnitureId,
      distance: Math.hypot(input.position.x - spot.x, input.position.z - spot.z),
      code: check.code, legal: check.legal, pointed: pointing.pointed,
      pointingDeltaDeg: pointing.deltaDeg };
    candidatesInRegion++;
    if (!target || candidate.distance < target.distance) target = candidate;
    if (candidate.legal && (!legalTarget || candidate.distance < legalTarget.distance)) {
      legalTarget = candidate;
    }
    if (candidate.legal && candidate.pointed &&
        (!pointedLegalTarget || candidate.distance < pointedLegalTarget.distance)) {
      pointedLegalTarget = candidate;
    }
  }
  if (!target) return { ...NONE, candidatesInRegion };
  return { target, legalTarget, pointedLegalTarget, code: target.code,
    spotId: target.spotId, furnitureId: target.furnitureId, legal: target.legal,
    candidatesInRegion };
}

/** DEV / HUD 用的通俗中文。 */
export const HIDE_TARGET_CODE_TEXT: Record<string, string> = {
  LEGAL: '合法交互位置',
  OUTSIDE_REGION: '不在家具交互区域内',
  NOT_STANDABLE: '当前位置站不住（撞到家具或墙）',
  SURFACE_BLOCKED: '与家具之间隔着墙、关闭的门或别的家具',
  NOT_NAVIGABLE: '附近没有可用导航格',
  NOT_REACHABLE: '从藏身锚点走不到这里',
  NONE: '不在任何家具交互区域内',
};

// ---------------------------------------------------------------------------
// Human 玩家 Q 的输入优先级（按键当帧唯一决策）
// ---------------------------------------------------------------------------

export type PlayerQPlanKind = 'REJECT_COOLDOWN' | 'FAN' | 'FURNITURE';

/** 这次 Q 为什么走了这个分支（DEV / 日志用，不参与判定）。 */
export type PlayerQPlanReason = 'COOLDOWN' | 'EXPOSED_TARGET' | 'FURNITURE' | 'NO_TARGET';

export interface PlayerQPlanInput {
  /** 按键当帧的 Q 冷却状态（与 `SkillCooldown` 同源）。 */
  cooldownReady: boolean;
  remainingSeconds: number;
  /**
   * 按键当帧是否存在**合法暴露目标**：未藏身的对手位于 1.5 世界单位、120° 扇形内，
   * 且没有墙 / 非 OPEN 门叶遮挡。由无副作用的 `probeExposedFanTarget()` 给出。
   */
  exposedTargetAvailable: boolean;
  /** 按键当帧**重新解析**出的「合法 + 被指向」家具候选；没有则不搜查家具。 */
  furnitureTarget: HideTargetCandidate | null;
}

export interface PlayerQPlan {
  kind: PlayerQPlanKind;
  reason: PlayerQPlanReason;
  spotId: string | null;
  furnitureId: string | null;
  /** 这次 Q 是否消耗既有的 12 秒冷却（冷却中直接拒绝、绝不产生新冷却）。 */
  armsCooldown: boolean;
  /** 被拒绝时的玩家可见中文提示；通过时为 null。 */
  message: string | null;
}

/**
 * S7C-2 修复轮 三：Human 玩家 Q 的**唯一输入优先级**（用户本轮批准的顺序）：
 *
 *   ① Q 在 12 秒冷却中 → 直接拒绝：不搜查、不抓捕、也不产生新的冷却；
 *   ② Q 可用且当帧存在**合法暴露目标** → 执行原有普通扇形角色抓捕
 *      （即使玩家正站在某件家具的合法交互区域内、并正对着它，也绝不改为家具搜查：
 *      追逐暴露的 DeepSeek 娘时不能因为路过家具而丢掉这次抓捕）；
 *   ③ 否则若当帧存在**合法且被指向**的家具 → 本次 Q 只搜查这一件家具
 *      （不需要落在 120° 扇形内，也不做 1.5 u 判定；但必须面向家具）；
 *   ④ 否则 → 原有普通扇形（空挥），同样消耗冷却。
 *
 * 三种用途完全互斥，且目标来自**按键当帧**重新解析的结果——上一帧的高亮永远不会
 * 被当成有效目标。成功激活一次 Q 之后（扇形命中 / 家具搜中 / 合法搜空 / 空挥）都
 * 消耗同一份冷却，所以 `armsCooldown` 只在①里为 false。
 */
export function resolvePlayerQPlan(input: PlayerQPlanInput): PlayerQPlan {
  const gate = humanSearchGate({ ready: input.cooldownReady,
    remainingSeconds: input.remainingSeconds });
  const base = { spotId: null as string | null, furnitureId: null as string | null };
  if (!gate.ok) {
    return { ...base, kind: 'REJECT_COOLDOWN', reason: 'COOLDOWN', armsCooldown: false,
      message: gate.message };
  }
  if (input.exposedTargetAvailable) {
    return { ...base, kind: 'FAN', reason: 'EXPOSED_TARGET', armsCooldown: true,
      message: null };
  }
  if (input.furnitureTarget) {
    return { kind: 'FURNITURE', reason: 'FURNITURE', spotId: input.furnitureTarget.spotId,
      furnitureId: input.furnitureTarget.furnitureId, armsCooldown: true, message: null };
  }
  return { ...base, kind: 'FAN', reason: 'NO_TARGET', armsCooldown: true, message: null };
}
