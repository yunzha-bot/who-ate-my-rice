import type { DoorState } from './DoorSystem.ts';
import type { Point } from '../three/map/apartmentMap.ts';
import { checkHideRegionPosition, hideRegionSetup,
  type HideRegionPositionCode, type HideRegionWorld }
  from '../three/map/HideInteractionRegion.ts';
import type { DeepSeekHideMapSnapshot, DeepSeekHideWorld }
  from './DeepSeekHideCandidates.ts';

/**
 * S7C-2b：DeepSeek 娘 AI 自主藏身的**权威层**（游戏层接缝，可在 Node 里用真实地图、
 * 真实 `CollisionWorld`、真实 `NavigationSystem` 直测）。
 *
 * 分工与 Human AI 那套完全对称：
 *   - AI 控制器（`DeepSeekAIController`）只会说「我想去 spot X」，它会真的走到自己规划
 *     的格心站位上；
 *   - 这里用**本帧真实位置**复核「你是不是真的站在这个点的合法藏身位置上」，
 *     复用与玩家 E 完全相同的几何内核 `checkHideRegionPosition`；
 *   - `HideSystem.enterAsAI()` 再复核状态机条件与一次性令牌，并写占用真相。
 *
 * 因此 AI 不能自证藏身成功：位置不合法、没走到位、令牌不对，三种情况都在写占用之前
 * 被拒绝，并且 AI 只会拿到一个拒绝码，拿不到任何对手信息。
 *
 * 出口侧的物理判据（Human 角色圆是否压住出口）由 `humanBlocksHideExit()` 提供，
 * 玩家 E 与 AI 自主退出**共用同一条公式**，避免两处各写一遍导致静默分叉。
 */

export type DeepSeekHideEntryCode = 'ENTERED' | 'NO_HIDE_SPOT' | 'NO_REGION'
  | 'NO_PLANNED_STANCE' | 'NOT_ARRIVED' | 'POSITION_ILLEGAL';

export const DEEPSEEK_HIDE_ENTRY_CODE_TEXT: Record<DeepSeekHideEntryCode, string> = {
  ENTERED: '权威层确认位置合法，允许进入藏身',
  NO_HIDE_SPOT: '目标藏身点已不在当前已应用地图里',
  NO_REGION: '目标藏身点的绑定家具不在当前地图里',
  NO_PLANNED_STANCE: '没有规划站位，无法确认 AI 是否真的到位',
  NOT_ARRIVED: 'AI 的真实位置还没有到达规划站位',
  POSITION_ILLEGAL: 'AI 的真实位置不是该藏身点的合法藏身位置',
};

export interface DeepSeekHideEntryResolution {
  readonly ok: boolean;
  readonly code: DeepSeekHideEntryCode;
  readonly spotId: string;
  readonly furnitureId: string | null;
  /** 权威几何给出的位置码；没有绑定家具时为 `NO_REGION`。 */
  readonly positionCode: HideRegionPositionCode | 'NO_REGION';
  readonly stancePoint: Point | null;
  readonly stanceDistance: number | null;
  readonly detail: string;
}

export interface DeepSeekHideEntryInput {
  readonly spotId: string;
  /** AI 本帧真实位置（不传送，因此也是退出位置）。 */
  readonly position: Point;
  /** AI 规划时保存的站位；缺失即视为计划已被打断。 */
  readonly plannedStancePoint: Point | null;
  readonly map: DeepSeekHideMapSnapshot | null;
  readonly doors: readonly DoorState[];
  readonly world: DeepSeekHideWorld;
  /** 「算走到位」的容差：复用既有导航到位容差 + 碰撞接触容差。 */
  readonly waypointTolerance: number;
  readonly contactEpsilon: number;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * 权威进入判定。顺序刻意如此：
 *   ① 计划仍属于当前地图（藏身点 + 绑定家具）；
 *   ② AI 的真实位置确实落在规划站位容差内（不是「它自称到了」）；
 *   ③ 该真实位置通过既有几何内核的完整合法性（区域成员 + 真实可站立 +
 *      家具可接近表面无遮挡 + 落在真实导航格）。
 * 三条全过才回 `ENTERED`，之后再交给 `HideSystem.enterAsAI()` 复核状态与令牌。
 */
export function resolveDeepSeekAiHideEntry(input: DeepSeekHideEntryInput):
DeepSeekHideEntryResolution {
  const base = { spotId: input.spotId, furnitureId: null as string | null,
    positionCode: 'NO_REGION' as HideRegionPositionCode | 'NO_REGION',
    stancePoint: input.plannedStancePoint ? { ...input.plannedStancePoint } : null,
    stanceDistance: null as number | null };
  const reject = (code: DeepSeekHideEntryCode, detail: string):
  DeepSeekHideEntryResolution => ({ ...base, ok: false, code, detail });
  const snapshot = input.map?.spots.find(entry => entry.spot.id === input.spotId);
  if (!snapshot) return reject('NO_HIDE_SPOT', `${input.spotId} 已不在当前地图`);
  const furnitureId = snapshot.spot.furnitureId;
  const setup = hideRegionSetup(snapshot.spot, input.map!.furniture);
  if (!setup) {
    return { ...base, ok: false, code: 'NO_REGION',
      detail: `目标家具 ${furnitureId} 不在当前地图` };
  }
  const stancePoint = input.plannedStancePoint;
  if (!stancePoint) {
    return { ...base, ok: false, code: 'NO_PLANNED_STANCE', furnitureId,
      detail: 'AI 没有保存规划站位，计划已被打断' };
  }
  const stanceDistance = distance(stancePoint, input.position);
  const tolerance = input.waypointTolerance + input.contactEpsilon;
  if (stanceDistance > tolerance) {
    return { ...base, ok: false, code: 'NOT_ARRIVED', furnitureId,
      positionCode: 'LEGAL' as HideRegionPositionCode, stancePoint: { ...stancePoint },
      stanceDistance,
      detail: `真实位置距规划站位 ${stanceDistance.toFixed(3)} 世界单位` +
        `（容差 ${tolerance.toFixed(3)}）` };
  }
  const regionWorld: HideRegionWorld = { collision: input.world.collision,
    navigation: input.world.navigation, doorStates: input.doors,
    doorNodes: input.world.doorNodes, walls: input.world.walls };
  const check = checkHideRegionPosition(setup, input.position, regionWorld);
  if (!check.legal) {
    return { ...base, ok: false, code: 'POSITION_ILLEGAL', furnitureId,
      positionCode: check.code, stancePoint: { ...stancePoint }, stanceDistance,
      detail: `真实位置不满足合法藏身位置（${check.code}）` };
  }
  return { ...base, ok: true, code: 'ENTERED', furnitureId,
    positionCode: 'LEGAL', stancePoint: { ...stancePoint }, stanceDistance,
    detail: `真实位置通过完整合法性复核（${input.position.x.toFixed(2)},` +
      `${input.position.z.toFixed(2)}）` };
}

/**
 * 出口物理判据：Human 角色圆是否压住藏身者的真实站位。玩家 E 与 AI 自主退出共用。
 * 这是一条**游戏物理规则**，不是 AI 感知：AI 只会拿到布尔结果与拒绝码，拿不到 Human
 * 的实时坐标。
 */
export function humanBlocksHideExit(deepseek: Point, human: Point,
  playerRadius: number): boolean {
  return distance(deepseek, human) < playerRadius * 2;
}
