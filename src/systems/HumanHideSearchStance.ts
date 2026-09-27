import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { Point, Rect } from '../three/map/apartmentMap.ts';
import { localToWorld, rectSurfacePoint } from '../three/map/RotatedRect.ts';
import { REGION_NAV_SNAP_LIMIT } from '../three/map/HideInteractionRegion.ts';
import { evaluateHumanSearchGeometry } from './HumanSearchSkill.ts';
import { STANCE_MAX_PATH_PROBES, STANCE_STAND_OFF, STANCE_SURFACE_STEP }
  from './HumanSearchTuning.ts';

/**
 * S7C-2：Human AI 的合法搜查站位规划 —— 纯逻辑。
 *
 * 目标家具的**可搜查表面**不是家具中心；站位必须满足 Human 自己的真实要求：
 *   ① Human 角色圆碰撞合法（真实 `CollisionWorld`）；
 *   ② 落在真实导航格上且 A* 可达（真实 `NavigationSystem`）；
 *   ③ 与家具可搜查表面的距离在批准的 1.5 世界单位内；
 *   ④ 由站位指向该表面时落在前方 120° 扇形内；
 *   ⑤ 墙与非 OPEN 门叶不遮挡这条交互线。
 *
 * 这里**复用** DEV-A 的旋转几何（`rectSurfacePoint` / `localToWorld`）与
 * `REGION_NAV_SNAP_LIMIT`，但判定是 Human 自己的一套：不做藏身者的区域成员判定，
 * 也不读任何占用信息。旋转家具使用真实旋转轮廓，不存在第二套朝向规则。
 */
export interface HideSearchStanceWorld {
  /** Human 角色圆 + 身高的真实可站立判定。 */
  standable: (point: Point) => boolean;
  /** 真实导航格中心；null 表示该点附近没有可用格。 */
  navigationCell: (point: Point) => Point | null;
  /** 真实 A* 路径节点数；不可达返回 null。 */
  pathNodes: (point: Point) => number | null;
  /** 与视觉同源的遮挡判定：墙体与非 OPEN 门叶。 */
  lineBlocked: (a: Point, b: Point) => boolean;
}

export type HideSearchStanceCode = 'READY' | 'NOT_STANDABLE' | 'NOT_NAVIGABLE'
  | 'SURFACE_BLOCKED' | 'OUT_OF_RANGE' | 'UNREACHABLE';

export interface HideSearchStance {
  spotId: string;
  /** AI 应站到的位置。 */
  stancePoint: Point;
  /** 该家具上要面向的可搜查表面点。 */
  surfacePoint: Point;
  /** 由站位指向表面点的朝向（弧度）。 */
  headingRad: number;
  /** 站位到表面的距离；必然 ≤ 批准的搜查半径。 */
  surfaceDistance: number;
  /** 从 AI 当前位置出发的真实 A* 节点数。 */
  pathNodes: number;
  /** 站位所吸附到的真实导航格中心。 */
  navigationCell: Point;
}

export interface HideSearchStancePlan {
  code: HideSearchStanceCode;
  stance: HideSearchStance | null;
  /** 生成的站位候选总数。 */
  candidates: number;
  /** 实际跑了 A* 的候选数（上限见 `STANCE_MAX_PATH_PROBES`）。 */
  probes: number;
  /** 中文说明，DEV 与日志用。 */
  reason: string;
}

const MAX_PROBE_BY_CODE: HideSearchStanceCode[] = ['NOT_STANDABLE', 'NOT_NAVIGABLE',
  'SURFACE_BLOCKED', 'OUT_OF_RANGE'];

/** 家具足迹上的表面采样点（世界坐标，含真实旋转）。 */
export function furnitureSurfaceSamples(rect: Rect,
  step: number = STANCE_SURFACE_STEP): Point[] {
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  if (halfWidth <= 0 || halfDepth <= 0) return [{ x: rect.x, z: rect.z }];
  const edges: { from: Point; to: Point }[] = [
    { from: { x: -halfWidth, z: -halfDepth }, to: { x: halfWidth, z: -halfDepth } },
    { from: { x: halfWidth, z: -halfDepth }, to: { x: halfWidth, z: halfDepth } },
    { from: { x: halfWidth, z: halfDepth }, to: { x: -halfWidth, z: halfDepth } },
    { from: { x: -halfWidth, z: halfDepth }, to: { x: -halfWidth, z: -halfDepth } },
  ];
  const samples: Point[] = [];
  for (const edge of edges) {
    const length = Math.hypot(edge.to.x - edge.from.x, edge.to.z - edge.from.z);
    const count = Math.max(1, Math.ceil(length / step));
    for (let index = 0; index < count; index++) {
      const fraction = index / count;
      samples.push(localToWorld(rect, {
        x: edge.from.x + (edge.to.x - edge.from.x) * fraction,
        z: edge.from.z + (edge.to.z - edge.from.z) * fraction,
      }));
    }
  }
  return samples;
}

/**
 * 为一个候选家具规划合法搜查站位。返回的 `stancePoint` 已经通过全部五项检查；
 * 调用方只需把 AI 导航到该点、朝向 `headingRad`、停留批准的 900 ms。
 */
export function planHideSearchStance(spotId: string, furniture: Rect, origin: Point,
  world: HideSearchStanceWorld): HideSearchStancePlan {
  const range = GAME_CONFIG.humanSearch.range;
  const halfAngleDeg = GAME_CONFIG.humanSearch.halfAngleDeg;
  const centre = { x: furniture.x, z: furniture.z };

  // 先试「离 AI 最近的表面点」，再补齐整圈周长采样：既能优先走最近的一侧，
  // 又保证贴墙/被别的家具挡住时能换到另一侧。
  const surfaces = [rectSurfacePoint(furniture, origin),
    ...furnitureSurfaceSamples(furniture)];
  const legal: { surfacePoint: Point; stancePoint: Point; headingRad: number;
    surfaceDistance: number; navigationCell: Point }[] = [];
  let firstFailure: HideSearchStanceCode | null = null;
  let firstFailureReason = '没有生成任何站位候选';

  for (const surfacePoint of surfaces) {
    const outwardX = surfacePoint.x - centre.x;
    const outwardZ = surfacePoint.z - centre.z;
    const length = Math.hypot(outwardX, outwardZ);
    if (length < 1e-9) continue;
    const stancePoint = { x: surfacePoint.x + outwardX / length * STANCE_STAND_OFF,
      z: surfacePoint.z + outwardZ / length * STANCE_STAND_OFF };
    const headingRad = Math.atan2(surfacePoint.z - stancePoint.z,
      surfacePoint.x - stancePoint.x);
    const geometry = evaluateHumanSearchGeometry({ origin: stancePoint, headingRad,
      aimPoint: surfacePoint, range, halfAngleDeg,
      lineBlocked: world.lineBlocked });
    let failure: HideSearchStanceCode | null = null;
    if (geometry.code === 'BLOCKED') failure = 'SURFACE_BLOCKED';
    else if (geometry.code === 'OUT_OF_RANGE') failure = 'OUT_OF_RANGE';
    else if (!world.standable(stancePoint)) failure = 'NOT_STANDABLE';
    else {
      const cell = world.navigationCell(stancePoint);
      if (!cell || Math.hypot(cell.x - stancePoint.x, cell.z - stancePoint.z) >
          REGION_NAV_SNAP_LIMIT) failure = 'NOT_NAVIGABLE';
      else {
        legal.push({ surfacePoint, stancePoint, headingRad,
          surfaceDistance: geometry.distance, navigationCell: cell });
      }
    }
    if (failure && !firstFailure) {
      firstFailure = failure;
      firstFailureReason = `站位候选被拒绝：${failure}`;
    }
  }

  // 按直线距离从近到远探测，最多跑 STANCE_MAX_PATH_PROBES 次 A*。
  legal.sort((a, b) =>
    Math.hypot(a.stancePoint.x - origin.x, a.stancePoint.z - origin.z) -
      Math.hypot(b.stancePoint.x - origin.x, b.stancePoint.z - origin.z) ||
    (a.stancePoint.x - b.stancePoint.x) || (a.stancePoint.z - b.stancePoint.z));
  let best: HideSearchStance | null = null;
  let probes = 0;
  for (const entry of legal.slice(0, STANCE_MAX_PATH_PROBES)) {
    probes++;
    const nodes = world.pathNodes(entry.stancePoint);
    if (nodes === null) continue;
    if (best && nodes >= best.pathNodes) continue;
    best = { spotId, stancePoint: entry.stancePoint, surfacePoint: entry.surfacePoint,
      headingRad: entry.headingRad, surfaceDistance: entry.surfaceDistance,
      pathNodes: nodes, navigationCell: entry.navigationCell };
  }
  if (!best) {
    const code: HideSearchStanceCode = legal.length ? 'UNREACHABLE'
      : firstFailure && MAX_PROBE_BY_CODE.includes(firstFailure) ? firstFailure
        : 'NOT_STANDABLE';
    return { code, stance: null, candidates: surfaces.length, probes,
      reason: legal.length ? '候选站位全部 A* 不可达'
        : firstFailureReason };
  }
  return { code: 'READY', stance: best, candidates: surfaces.length, probes,
    reason: `合法站位 ${best.stancePoint.x.toFixed(2)}, ${best.stancePoint.z.toFixed(2)}｜` +
      `表面 ${best.surfacePoint.x.toFixed(2)}, ${best.surfacePoint.z.toFixed(2)}｜` +
      `路径 ${best.pathNodes} 节点` };
}
