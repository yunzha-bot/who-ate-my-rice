import type { Faction } from '../three/LocalControl.ts';

/**
 * S7C-1B：两个 Q 技能的门禁与归属 —— 纯逻辑。
 *
 * 把「同一个按键在不同阵营下只映射到一个技能」和「什么情况下拒绝、拒绝时说什么」
 * 抽出来，`ThreeGame` 只负责按结果调用既有系统。这样测试可以逐条枚举门禁，
 * 也保证了 Human 的扇形搜查与 DeepSeek 的锁门不会互相覆盖。
 */
export type QSkill = 'LOCK_DOOR' | 'FAN_SEARCH' | 'NONE';

export function resolveQSkill(faction: Faction | null): QSkill {
  return faction === 'DEEPSEEK' ? 'LOCK_DOOR'
    : faction === 'HUMAN' ? 'FAN_SEARCH' : 'NONE';
}

export interface SkillGateResult {
  ok: boolean;
  /** 被拒绝时的通俗中文；通过时为 null。 */
  message: string | null;
}

export function deepseekLockGate(input: {
  concealed: boolean;
  ready: boolean;
  remainingSeconds: number;
}): SkillGateResult {
  if (input.concealed) return { ok: false, message: '藏身中不能锁门；按 E 退出藏身' };
  if (!input.ready) {
    return { ok: false, message: `锁门冷却中：剩 ${input.remainingSeconds.toFixed(1)} 秒` };
  }
  return { ok: true, message: null };
}

export function humanSearchGate(input: {
  ready: boolean;
  remainingSeconds: number;
}): SkillGateResult {
  if (!input.ready) {
    return { ok: false, message: `搜查冷却中：剩 ${input.remainingSeconds.toFixed(1)} 秒` };
  }
  return { ok: true, message: null };
}

/**
 * 只有真的锁上才开始冷却：状态不允许、超距、锁位已满、锁芯失效都不消耗冷却。
 * 返回值直接决定调用方是否 `arm()`。
 */
export function lockArmsPlayerCooldown(result: string): boolean {
  return result === 'LOCKED';
}
