export const RICE_MAX_PROGRESS_MS = {
  production: 60_000, // 正式设计值：60 秒
  development: 5_000, // 仅供开发阶段频繁测试
} as const;

// Beta / Release Candidate 前改为 'production'，恢复正式 60 秒规则。
export const RICE_TIMING_MODE: keyof typeof RICE_MAX_PROGRESS_MS = 'development';

export const GAME_CONFIG = {
  backgroundColor: '#858b91',
  development: {
    // Development-only control handoff. Disable for production builds.
    factionSwitchEnabled: true,
  },
  player: {
    size: 32,
    speed: 230,
    color: 0x3197ff,
  },
  human: {
    size: 32,
    speedMultiplier: 1.08,
    color: 0xf28b45,
  },
  sprint: {
    speedMultiplier: 1.6,
    durationMs: 2_500,
    riskThreshold: 0.30,
    stunMs: 1_000,
  },
  three: {
    pixelsPerUnit: 60,
    viewHeight: 14,
    actorHeight: 0.7,
    wallHeight: 1.1,
    boundaryHeight: 0.5,
  },
  collision: {
    // Keep the actor's full visual half-width as a circular XZ footprint.
    radiusScale: 1,
    contactEpsilon: 0.0001,
    maxMovementSubstep: 0.12,
  },
  match: {
    readyMs: 3_000,
    // XZ world-space radius around Human; deliberately independent of actor mesh size.
    captureRadius: 0.70,
    captureMs: 350,
  },
  rice: {
    size: 30,
    color: 0xf2e5bc,
    interactionRange: 60,
    prepareMs: 400,
    maxProgressMs: RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE],
    visual: {
      fullHeight: 0.62,
      emptyHeight: 0.08,
      fullBulgeHeight: 0.22,
      emptyWidthScale: 0.92,
    },
  },
} as const;
