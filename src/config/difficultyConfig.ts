import { GAME_CONFIG } from './gameConfig.ts';

export const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD'] as const;
export type Difficulty = typeof DIFFICULTIES[number];
export type HumanAIConfig = { readonly [K in keyof typeof GAME_CONFIG.humanAI]: number };
export type DeepSeekAIConfig = { readonly [K in keyof typeof GAME_CONFIG.deepseekAI]: number };
type HumanOverrides = Pick<HumanAIConfig, 'movementSpeedMultiplier' | 'aiUnlockDurationMs' |
  'aiUnlockSuccessChance' | 'searchMaxMs' | 'searchRoomCount' | 'hideCheckMaxPerRound'>;
type DeepSeekOverrides = Pick<DeepSeekAIConfig, 'visionEvadeDistance' | 'soundEvadeStrength' |
  'escapeMinSeparation' | 'escapeReplanMs' | 'hideThreatDistance'>;

/** Only these approved opponent-AI fields vary. EASY always reads the base config. */
export const DIFFICULTY_OVERRIDES = {
  EASY: { humanAI: {}, deepseekAI: {} },
  NORMAL: {
    // 2026-10-15 feedback: reduce pursuit speed; keep unlock/search abilities.
    humanAI: { movementSpeedMultiplier: .64, aiUnlockDurationMs: 7500,
      aiUnlockSuccessChance: .8, searchMaxMs: 18000, searchRoomCount: 4, hideCheckMaxPerRound: 2 },
    deepseekAI: { visionEvadeDistance: 6, soundEvadeStrength: .075,
      escapeMinSeparation: 3.5, escapeReplanMs: 600, hideThreatDistance: 4 },
  },
  HARD: {
    humanAI: { movementSpeedMultiplier: .76, aiUnlockDurationMs: 6500,
      aiUnlockSuccessChance: .9, searchMaxMs: 22000, searchRoomCount: 5, hideCheckMaxPerRound: 3 },
    deepseekAI: { visionEvadeDistance: 7, soundEvadeStrength: .06,
      escapeMinSeparation: 4, escapeReplanMs: 500, hideThreatDistance: 4.5 },
  },
} as const satisfies Record<Difficulty, {
  humanAI: Partial<HumanOverrides>; deepseekAI: Partial<DeepSeekOverrides>;
}>;

export const DIFFICULTY_COPY = {
  EASY: { label: '简单', description: '适合初次游玩，轻松熟悉游戏规则。' },
  NORMAL: { label: '普通', description: '标准挑战，对手拥有更积极的追捕与逃跑行为。' },
  HARD: { label: '困难', description: '更高强度的AI对抗，考验路线规划和临场判断。' },
} as const;

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && DIFFICULTIES.includes(value as Difficulty);
}

/** Snapshot once at round start. No player, perception, map or rice overrides. */
export function resolveAiDifficulty(difficulty: Difficulty, playerFaction: 'DEEPSEEK' | 'HUMAN') {
  const preset = DIFFICULTY_OVERRIDES[difficulty];
  return Object.freeze({
    humanAI: Object.freeze({ ...GAME_CONFIG.humanAI,
      ...(playerFaction === 'DEEPSEEK' ? preset.humanAI : {}) }) as HumanAIConfig,
    deepseekAI: Object.freeze({ ...GAME_CONFIG.deepseekAI,
      ...(playerFaction === 'HUMAN' ? preset.deepseekAI : {}) }) as DeepSeekAIConfig,
  });
}

export const DIFFICULTY_STORAGE_KEY = 'who-ate-my-rice-difficulty-v1';
type DifficultyStorage = Pick<Storage, 'getItem' | 'setItem'> | null;
export function readDifficulty(storage: DifficultyStorage): Difficulty {
  try { const saved = storage?.getItem(DIFFICULTY_STORAGE_KEY);
    return isDifficulty(saved) ? saved : 'EASY';
  } catch { return 'EASY'; }
}
export function saveDifficulty(storage: DifficultyStorage, value: Difficulty): void {
  try { storage?.setItem(DIFFICULTY_STORAGE_KEY, value); } catch { /* optional preference */ }
}
