export const RICE_MAX_PROGRESS_MS = {
  production: 60_000, // 正式设计值：60 秒
  development: 5_000, // 仅供开发阶段频繁测试
} as const;

// Beta / Release Candidate 前改为 'production'，恢复正式 60 秒规则。
export const RICE_TIMING_MODE: keyof typeof RICE_MAX_PROGRESS_MS = 'development';

export const GAME_CONFIG = {
  width: 960,
  height: 600,
  backgroundColor: '#858b91',
  player: {
    x: 120,
    y: 120,
    size: 32,
    speed: 230,
    color: 0x3197ff,
  },
  human: {
    x: 760,
    y: 450,
    size: 32,
    speed: 230,
    color: 0xf28b45,
  },
  match: {
    readyMs: 3_000,
    captureRange: 42,
    captureMs: 350,
  },
  rice: {
    id: 'rice-1',
    x: 450,
    y: 420,
    size: 30,
    color: 0xf2e5bc,
    interactionRange: 60,
    prepareMs: 400,
    maxProgressMs: RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE],
  },
  wallColor: 0x4e5359,
  walls: [
    { x: 300, y: 220, width: 320, height: 32 },
    { x: 620, y: 390, width: 32, height: 290 },
    { x: 790, y: 165, width: 220, height: 32 },
  ],
} as const;
