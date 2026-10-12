/**
 * S7C-1B：E 键（交互）的唯一仲裁入口 —— 纯逻辑。
 *
 * 现有优先级的稳定顺序（用户批准）：
 *   PulseLock 面板 > 未藏身时的门 > 藏身交互 > 进食；藏身中 E 专用于退出。
 *
 * 把顺序抽成一个纯函数的目的：`ThreeGame` 只消费一次 `KeyE`，然后按这里给出的
 * **唯一** 意图执行，因此同一次按键不可能同时触发退出、门、破解或进食。
 */
export type InteractionIntent = 'PULSE_LOCK' | 'DOOR' | 'HIDE_EXIT' | 'HIDE_ENTER'
  | 'RICE' | 'NONE';

export interface InteractionArbitrationInput {
  /** PulseLock 面板开启时，E 仅用于当前锁芯的时机判定。 */
  pulseLockOpen: boolean;
  /** 当前控制对象是否处于 CONCEALED。 */
  concealed: boolean;
  /** 最近可交互门；`distance` 用于与进食竞争（沿用现有规则）。 */
  door: { distance: number } | null;
  /** 最近米堆；沿用现有规则，未在交互范围内也参与「门是否优先」的比较。 */
  rice: { distance: number } | null;
  /** 已通过几何合法性检查的最近藏身点。 */
  hide: { spotId: string } | null;
}

export const INTERACTION_INTENT_LABELS: Record<InteractionIntent, string> = {
  PULSE_LOCK: 'PulseLock 面板',
  DOOR: '门',
  HIDE_EXIT: '退出藏身',
  HIDE_ENTER: '进入藏身',
  RICE: '进食',
  NONE: '无',
};

export function resolveInteractionIntent(input: InteractionArbitrationInput): InteractionIntent {
  if (input.pulseLockOpen) return 'PULSE_LOCK';
  // 藏身中不允许开门/破解/进食：同一次 E 只用于退出。
  if (input.concealed) return 'HIDE_EXIT';
  const doorOwns = !!input.door && (!input.rice || input.door.distance <= input.rice.distance);
  if (doorOwns) return 'DOOR';
  if (input.hide) return 'HIDE_ENTER';
  if (input.rice) return 'RICE';
  return 'NONE';
}

export function interactionIntentLabel(intent: InteractionIntent): string {
  return INTERACTION_INTENT_LABELS[intent];
}
