import { resolveInteractionIntent } from '../systems/HideInteractionArbitration.ts';
import type { InteractionArbitrationInput } from '../systems/HideInteractionArbitration.ts';

export interface PromptInput extends InteractionArbitrationInput {
  playable: boolean;
  faction: 'HUMAN' | 'DEEPSEEK';
  doorState: string | null;
  activeLockCore: boolean;
  canClose: boolean;
  canHide: boolean;
  canEat: boolean;
  exitBlocked: boolean;
  riceInRange: boolean;
  moving: boolean;
}
export interface InteractionPrompt { key?: 'E' | 'V'; label: string; detail: string; blocked: boolean }

/** Presentation only: reuse E arbitration, never authorize or execute an action. */
export function interactionPrompt(input: PromptInput): InteractionPrompt | null {
  if (!input.playable || input.pulseLockOpen) return null;
  const intent = resolveInteractionIntent(input);
  const prompt = (label: string, detail = '', blocked = false) => ({ label, detail, blocked });
  if (intent === 'HIDE_EXIT') return prompt('离开', input.exitBlocked ? '出口被挡住' : '', input.exitBlocked);
  // Same Human lock-core override as handleDoorInteractions().
  if (intent === 'DOOR' || (input.faction === 'HUMAN' && input.activeLockCore)) {
    if (input.doorState === 'LOCKED') return input.faction === 'HUMAN'
      ? prompt('解锁') : prompt('开门', '门已锁定', true);
    if (input.doorState === 'OPEN') return prompt('关门', input.canClose ? '' : '门口有阻挡', !input.canClose);
    return prompt('开门');
  }
  if (intent === 'HIDE_ENTER') return input.canHide ? prompt('躲藏') : null;
  if (intent === 'RICE' && input.riceInRange && input.canEat)
    return prompt('吃米', input.moving ? '停下后按住' : '按住');
  return null;
}
