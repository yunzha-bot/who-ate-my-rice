import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { DoorState } from './DoorSystem.ts';
import type { NavStep, NavigationSystem } from './NavigationSystem.ts';
import type { CollisionWorld } from '../three/CollisionWorld.ts';
import { checkHideRegionPosition, hideRegionSetup, pointInHideRegion,
  type HideRegionWorld } from '../three/map/HideInteractionRegion.ts';
import type { DoorNode, HideSpot, Point, Rect } from '../three/map/apartmentMap.ts';

/**
 * S7C-2b：DeepSeek 娘 AI 自主藏身的**公开候选层**（纯逻辑，可在 Node 里直测）。
 *
 * 三层刻意分开，与 Human AI 的 `HideSearchCandidates` + 权威层写法对称：
 *
 *   1. `createDeepSeekHideMapSnapshot()` —— 游戏层交给 AI 的**公开藏身点快照**的
 *      唯一构造点。快照里只有公开地图数据（藏身点、绑定家具、完整公开家具表）与
 *      一个「地图代次」；它**不**包含任何占用状态、隐藏者坐标或开发者真值。
 *   2. `selectHideSpot()` —— 候选筛选与评分。只读公开几何 + AI 自身状态 + 公开威胁
 *      估计；没有任何字段能表达「这个点里有没有人」。
 *   3. 进入是否真的发生，由 `DeepSeekHideResolution.ts` 的权威层与 `HideSystem`
 *      一起决定，这里只负责「AI 认为它想去的那个点」。
 *
 * 站位语义（本阶段的关键设计决定）：AI **只在真实导航格心上藏身**。藏身点锚点本身
 * 不保证落在导航格上，而「朝家具中心的几何接近点」会直接落进家具碰撞盒里；因此这里
 * 先用 `navigation.freeCellsWithin()` 枚举区域内的真实空闲格心，再用既有
 * `checkHideRegionPosition()` 逐条复核（区域成员 + 真实可站立 + 家具表面无遮挡 +
 * 导航格吸附），最后取**离该藏身点唯一锚点最近**的合法格心作为 AI 站位。
 * 这样 A* 终点本身就是可行走点，不需要 S7C-2 那种 `finalApproach()` 容差走位。
 */

/** 公开藏身点快照：藏身点本体 + 它绑定的那件家具（找不到绑定的点会被排除）。 */
export interface DeepSeekHideSpotSnapshot {
  readonly spot: HideSpot;
  readonly furniture: Rect;
}

/**
 * 当前已应用地图的公开藏身数据。`revision` 是地图代次：重建地图时递增，AI 一见变化
 * 就作废手头的藏身计划，绝不抱着旧家具位置继续走。
 */
export interface DeepSeekHideMapSnapshot {
  readonly revision: number;
  readonly spots: readonly DeepSeekHideSpotSnapshot[];
  /** 完整公开家具表，供「家具表面是否被别的家具挡住」这条公开判定复用。 */
  readonly furniture: readonly Rect[];
}

/** 唯一构造点：只有它把真实地图数据整理成 AI 可见的公开快照。 */
export function createDeepSeekHideMapSnapshot(input: {
  hideSpots: readonly HideSpot[];
  furniture: readonly Rect[];
  revision: number;
}): DeepSeekHideMapSnapshot {
  const spots: DeepSeekHideSpotSnapshot[] = [];
  for (const spot of input.hideSpots) {
    const furniture = input.furniture.find(rect => rect.id === spot.furnitureId);
    if (furniture) spots.push({ spot, furniture });
  }
  return { revision: input.revision, spots, furniture: input.furniture };
}

/**
 * 真实几何接缝。全部是公开或自身信息：碰撞可站立、导航可达、墙体/门叶遮挡与正式
 * 视觉同源。这里不出现任何 Human 决策状态、占用查询或玩家提示系统。
 */
export interface DeepSeekHideWorld {
  readonly collision: CollisionWorld;
  readonly navigation: NavigationSystem;
  readonly doorNodes?: readonly DoorNode[];
  readonly walls?: readonly Rect[];
  /** 正式视觉几何（距离 + 墙 + 非 OPEN 门叶）；用于公开「有没有遮挡」评分。 */
  readonly visionStatus?: (from: Point, to: Point, maxRange: number) => string;
}

export interface DeepSeekHideCooldown {
  readonly spotId: string;
  readonly remainingMs: number;
}

export interface DeepSeekHideRecentSpot {
  readonly spotId: string;
  readonly atMs: number;
}

export interface DeepSeekHideCandidateInput {
  readonly map: DeepSeekHideMapSnapshot | null;
  /** AI 本帧真实位置（自身信息）。 */
  readonly position: Point;
  /** 本帧真实门状态；同时用于寻路与几何判定，避免两处门态不一致。 */
  readonly doors: readonly DoorState[];
  /** 已知威胁点（真实目视 / 有效 Last Seen / 声音八方向投影），没有则为 null。 */
  readonly threat: Point | null;
  readonly world: DeepSeekHideWorld;
  /** 每点的冷却（走位失败 / 进入被拒 / 同点再进）。 */
  readonly cooldowns?: readonly DeepSeekHideCooldown[];
  /** 最近真的藏过的点，用于「两点之间来回」的惩罚。 */
  readonly recentSpots?: readonly DeepSeekHideRecentSpot[];
  readonly nowMs?: number;
  /** 当前已经选中的点：评分接近时保持原目标，避免抖动。 */
  readonly preferredSpotId?: string | null;
}

export type DeepSeekHideCandidateCode = 'SELECTED' | 'NO_MAP' | 'NO_THREAT'
  | 'ALL_COOLED' | 'NO_LEGAL_STANCE' | 'NO_REACHABLE_ROUTE';

export interface DeepSeekHideCandidate {
  readonly spotId: string;
  readonly roomId: string;
  readonly furnitureId: string;
  /** AI 真正要走的终点：真实导航格心，且落在该藏身点的精确交互区域内。 */
  readonly stancePoint: Point;
  readonly path: readonly NavStep[];
  readonly travelLength: number;
  readonly separation: number | null;
  readonly covered: boolean;
  readonly recentPenalty: number;
  readonly score: number;
}

/** 单点评估码：DEV 面板与日志用，全部是公开几何结论。 */
export type DeepSeekHideSpotEvalCode = 'CANDIDATE' | 'REJECTED_COOLDOWN'
  | 'REJECTED_NO_REGION' | 'REJECTED_OUTSIDE_REGION' | 'REJECTED_NOT_STANDABLE'
  | 'REJECTED_SURFACE_BLOCKED' | 'REJECTED_NOT_NAVIGABLE' | 'REJECTED_UNREACHABLE';

export interface DeepSeekHideSpotEvaluation {
  readonly spotId: string;
  readonly code: DeepSeekHideSpotEvalCode;
  readonly stancePoint: Point | null;
  readonly travelLength: number | null;
  readonly score: number | null;
  readonly cooldownMs: number;
  readonly recentPenalty: number;
  readonly detail: string;
}

export interface DeepSeekHideCandidateResult {
  readonly ok: boolean;
  readonly code: DeepSeekHideCandidateCode;
  readonly reason: string;
  readonly candidate: DeepSeekHideCandidate | null;
  readonly evaluations: readonly DeepSeekHideSpotEvaluation[];
  readonly legalStanceCount: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

function pathLength(start: Point, path: readonly NavStep[], goal: Point): number {
  if (!path.length) return distance(start, goal);
  let length = distance(start, path[0]);
  for (let index = 1; index < path.length; index++)
    length += distance(path[index - 1], path[index]);
  return length + distance(path[path.length - 1], goal);
}

function routeThreatRisk(path: readonly NavStep[], goal: Point, threat: Point,
  radius: number): number {
  let nearest = distance(goal, threat);
  for (const step of path) nearest = Math.min(nearest, distance(step, threat));
  return Math.max(0, radius - nearest);
}

/** 时间衰减的近期惩罚；与逃跑房间用的是同一个语义与同一个数值。 */
function recentSpotPenalty(recentSpots: readonly DeepSeekHideRecentSpot[],
  spotId: string, nowMs: number, memoryMs: number, penalty: number): number {
  if (memoryMs <= 0) return 0;
  return recentSpots.filter(entry => entry.spotId === spotId)
    .reduce((sum, entry) => sum + penalty *
      Math.max(0, 1 - (nowMs - entry.atMs) / memoryMs), 0);
}

/**
 * 候选选择。返回一个「AI 想去哪个点、从哪条路去、为什么」的公开结论。
 *
 * 评分刻意与逃跑房间**同一货币**（分离度 − 路程惩罚 + 遮挡奖励 − 路线威胁 − 近期惩罚），
 * 这样「藏身 vs 空手逃跑」可以在同一把尺子上比较，而不是新造一套只有藏身才懂的分数。
 */
export function selectHideSpot(input: DeepSeekHideCandidateInput):
DeepSeekHideCandidateResult {
  const cfg = GAME_CONFIG.deepseekAI;
  const nowMs = input.nowMs ?? 0;
  const evaluations: DeepSeekHideSpotEvaluation[] = [];
  const fail = (code: DeepSeekHideCandidateCode, reason: string):
  DeepSeekHideCandidateResult => ({ ok: false, code, reason, candidate: null,
    evaluations, legalStanceCount: evaluations.filter(entry =>
      entry.code === 'CANDIDATE').length });
  if (!input.map) return fail('NO_MAP', '还没有当前地图的公开藏身点数据');
  if (!input.threat) return fail('NO_THREAT', '没有已知威胁点，不做藏身评估');
  const threat = input.threat;
  const cooldowns = new Map((input.cooldowns ?? [])
    .map(entry => [entry.spotId, entry.remainingMs]));
  const regionWorld: HideRegionWorld = { collision: input.world.collision,
    navigation: input.world.navigation, doorStates: input.doors,
    doorNodes: input.world.doorNodes, walls: input.world.walls };
  const candidates: DeepSeekHideCandidate[] = [];
  let cooledCount = 0;

  for (const snapshot of input.map.spots) {
    const spotId = snapshot.spot.id;
    const cooldownMs = cooldowns.get(spotId) ?? 0;
    const recentPenalty = recentSpotPenalty(input.recentSpots ?? [], spotId, nowMs,
      cfg.escapeVisitMemoryMs, cfg.hideRecentSpotPenalty);
    const reject = (code: DeepSeekHideSpotEvalCode, detail: string,
      stancePoint: Point | null = null): void => {
      evaluations.push({ spotId, code, stancePoint, travelLength: null, score: null,
        cooldownMs, recentPenalty, detail });
    };
    if (cooldownMs > 0) {
      cooledCount++;
      reject('REJECTED_COOLDOWN', `该点仍在失败 / 再进冷却 ${Math.round(cooldownMs)} ms`);
      continue;
    }
    const setup = hideRegionSetup(snapshot.spot, input.map.furniture);
    if (!setup) {
      reject('REJECTED_NO_REGION', `${spotId} 的绑定家具不在当前地图里`);
      continue;
    }
    // 只枚举区域内（半径内）的真实空闲格心；SECTOR 再由 pointInHideRegion 剪掉楔形外。
    const cells = input.world.navigation.freeCellsWithin(setup.geometry.centre,
      setup.geometry.radius, input.doors);
    const inside = cells.filter(cell => pointInHideRegion(setup.geometry, cell));
    if (!inside.length) {
      reject('REJECTED_OUTSIDE_REGION',
        `区域内没有任何真实空闲导航格心（半径 ${setup.geometry.radius}，` +
        `格心候选 ${cells.length}）`);
      continue;
    }
    // 区域内离唯一锚点最近的合法格心 = AI 的正式站位。
    inside.sort((a, b) => distance(a, setup.geometry.anchor) -
      distance(b, setup.geometry.anchor) || a.x - b.x || a.z - b.z);
    let chosen: Point | null = null;
    let lastCode: DeepSeekHideSpotEvalCode = 'REJECTED_OUTSIDE_REGION';
    let lastDetail = '';
    for (const cell of inside) {
      const check = checkHideRegionPosition(setup, cell, regionWorld);
      if (check.legal) { chosen = cell; break; }
      lastCode = check.code === 'NOT_STANDABLE' ? 'REJECTED_NOT_STANDABLE'
        : check.code === 'SURFACE_BLOCKED' ? 'REJECTED_SURFACE_BLOCKED'
          : check.code === 'NOT_NAVIGABLE' ? 'REJECTED_NOT_NAVIGABLE'
            : 'REJECTED_OUTSIDE_REGION';
      lastDetail = `${cell.x.toFixed(2)},${cell.z.toFixed(2)} 不合法（${check.code}）`;
    }
    if (!chosen) {
      reject(lastCode, lastDetail || '区域内所有格心都不合法');
      continue;
    }
    const path = input.world.navigation.findPath(input.position, chosen, input.doors);
    if (!path?.length) {
      reject('REJECTED_UNREACHABLE',
        `${chosen.x.toFixed(2)},${chosen.z.toFixed(2)} 从当前位置 A* 不可达`, chosen);
      continue;
    }
    const travelLength = pathLength(input.position, path, chosen);
    const separation = distance(chosen, threat);
    const covered = input.world.visionStatus
      ? input.world.visionStatus(threat, chosen, Number.POSITIVE_INFINITY) !== 'VISIBLE'
      : false;
    const routeRisk = routeThreatRisk(path, chosen, threat, cfg.dangerRouteRadius);
    const first = path[1] ? { x: path[1].x, z: path[1].z } : chosen;
    const towardThreat = distance(first, threat) < distance(input.position, threat);
    // 藏身的价值来自「尽快躲进去」，而不是「离威胁更远」——那是逃跑房间的货币。
    // 因此候选分以「到达时间」为主：路程越长、路线越贴威胁、越朝威胁跑、越近期藏过，
    // 分数越低；有遮挡（藏进去确实断开视线）加分。可调权重全部复用既有逃跑参数。
    const score = -travelLength
      + (covered ? cfg.escapeCoverBonus : 0)
      - routeRisk * cfg.escapeRouteThreatPenalty
      - (towardThreat ? cfg.escapeTowardThreatPenalty : 0)
      - recentPenalty;
    evaluations.push({ spotId, code: 'CANDIDATE', stancePoint: { ...chosen },
      travelLength, score, cooldownMs, recentPenalty,
      detail: `路线 ${travelLength.toFixed(2)}｜距已知威胁 ${separation.toFixed(2)}｜` +
        `${covered ? '有遮挡' : '无遮挡'}｜` +
        `${towardThreat ? '朝威胁跑' : '远离威胁'}｜近期惩罚 ${recentPenalty.toFixed(2)}` });
    candidates.push({ spotId, roomId: snapshot.spot.roomId,
      furnitureId: snapshot.spot.furnitureId, stancePoint: { ...chosen },
      path, travelLength, separation, covered, recentPenalty, score });
  }

  if (!candidates.length) {
    if (cooledCount === input.map.spots.length && cooledCount > 0)
      return fail('ALL_COOLED', '所有藏身点都还在冷却中，回落空手逃跑');
    const reachable = evaluations.some(entry => entry.code === 'REJECTED_UNREACHABLE');
    return fail(reachable ? 'NO_REACHABLE_ROUTE' : 'NO_LEGAL_STANCE',
      reachable ? '有合法站位但当前不可达，回落空手逃跑'
        : '没有任何合法藏身站位，回落空手逃跑');
  }
  candidates.sort((a, b) => b.score - a.score ||
    a.travelLength - b.travelLength || a.spotId.localeCompare(b.spotId));
  let selected = candidates[0];
  // 目标保持：已有目标仍在候选里且新最优没有明显更好时，不换点（沿用逃跑房间的纪律）。
  const preferred = input.preferredSpotId
    ? candidates.find(entry => entry.spotId === input.preferredSpotId) : undefined;
  if (preferred && selected.spotId !== preferred.spotId &&
      selected.score < preferred.score + cfg.escapeSwitchScoreMargin)
    selected = preferred;
  const result: DeepSeekHideCandidateResult = { ok: true, code: 'SELECTED',
    reason: `${selected.spotId}｜路线 ${selected.travelLength.toFixed(2)}｜` +
      `评分 ${selected.score.toFixed(2)}（候选 ${candidates.length}）`,
    candidate: selected, evaluations, legalStanceCount: candidates.length };
  return result;
}
