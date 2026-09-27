import type { InteractionIntent } from './HideInteractionArbitration.ts';
import { pointsAtFurniture } from './HideTargetResolution.ts';
import type { Point, Rect } from '../three/map/apartmentMap.ts';
import { wrapToPi } from '../three/map/HideInteractionRegion.ts';

// 纯视觉容差；不参与 E 藏身、吃米距离或进食进度的判定。
export const DEEPSEEK_RICE_VISUAL_HALF_ANGLE_DEG = 45;

export type DeepSeekVisualTarget =
  | { kind: 'NONE' }
  | { kind: 'FURNITURE'; spotId: string; furnitureId: string }
  | { kind: 'RICE'; riceId: string };

/** 停住时保持最后朝向；碰撞导致没有实际位移时也不凭输入方向猜测。 */
export function nextDeepSeekVisualHeading(previous: number | null, before: Point,
  after: Point): number | null {
  const dx = after.x - before.x;
  const dz = after.z - before.z;
  return Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dz, dx) : previous;
}

export interface DeepSeekVisualTargetInput {
  playable: boolean;
  position: Point;
  /** 最后一次人工有效移动的世界 XZ 朝向；从未移动时不猜测白模正面。 */
  headingRad: number | null;
  /** 与正式 E 输入同一仲裁函数的结果，视觉不得反向修改它。 */
  intent: InteractionIntent;
  hide: { spotId: string; furnitureId: string; legal: boolean } | null;
  furniture: Rect | null;
  rice: { id: string; position: Point; range: number } | null;
  riceInteractionRange: number;
  canHide: boolean;
  canEat: boolean;
  furnitureHalfAngleDeg: number;
}

/** 只读、唯一的玩家指向目标。候选先由 E 仲裁决定，再做视觉朝向筛选。 */
export function resolveDeepSeekVisualTarget(input: DeepSeekVisualTargetInput):
DeepSeekVisualTarget {
  if (!input.playable || input.headingRad === null) return { kind: 'NONE' };
  if (input.intent === 'HIDE_ENTER' && input.canHide && input.hide?.legal && input.furniture &&
      input.furniture.id === input.hide.furnitureId &&
      pointsAtFurniture(input.position, {
        headingRad: input.headingRad,
        halfAngleDeg: input.furnitureHalfAngleDeg,
      }, input.furniture).pointed) {
    return { kind: 'FURNITURE', spotId: input.hide.spotId,
      furnitureId: input.hide.furnitureId };
  }
  if (input.intent === 'RICE' && input.canEat && input.rice &&
      input.rice.range <= input.riceInteractionRange) {
    const dx = input.rice.position.x - input.position.x;
    const dz = input.rice.position.z - input.position.z;
    const deltaDeg = Math.abs(wrapToPi(Math.atan2(dz, dx) - input.headingRad)) *
      180 / Math.PI;
    if (deltaDeg <= DEEPSEEK_RICE_VISUAL_HALF_ANGLE_DEG + 1e-9)
      return { kind: 'RICE', riceId: input.rice.id };
  }
  return { kind: 'NONE' };
}
