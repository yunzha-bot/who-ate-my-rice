/**
 * 正式玩法时间驱动的技能冷却 —— 纯逻辑。
 *
 * 只有 `arm()` 会开始冷却，所以「失败不消耗冷却」这类规则由调用方决定何时
 * arm；`advance()` 必须由 PLAYING 的 gameplayDelta 驱动，因此暂停与 DEV 冻结
 * 期间冷却自然不推进（与 SprintSystem 的 30 秒冷却同一口径）。
 */
export type SkillCooldownState = 'READY' | 'COOLDOWN';

export class SkillCooldown {
  readonly cooldownMs: number;
  remainingMs = 0;
  armCount = 0;

  constructor(cooldownMs: number) {
    this.cooldownMs = Math.max(0, cooldownMs);
  }

  get ready(): boolean { return this.remainingMs <= 0; }

  get state(): SkillCooldownState { return this.ready ? 'READY' : 'COOLDOWN'; }

  get remainingSeconds(): number { return this.remainingMs / 1000; }

  arm(): void {
    this.remainingMs = this.cooldownMs;
    this.armCount++;
  }

  advance(deltaMs: number): void {
    if (this.remainingMs <= 0) return;
    this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, deltaMs));
  }

  reset(): void {
    this.remainingMs = 0;
    this.armCount = 0;
  }
}
