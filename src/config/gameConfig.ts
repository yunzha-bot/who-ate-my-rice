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
    // Dangerous direct R/M/Tab shortcuts stay off by default. Use the pause menu instead.
    directHotkeysEnabled: false,
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
    wallHeight: 1.5,
    boundaryHeight: 0.5,
  },
  collision: {
    // Gameplay footprint is independent from the square placeholder mesh.
    // 0.23 is about 86% of the current visual half-width (0.267 world units).
    playerRadius: 0.23,
    contactEpsilon: 0.0001,
    maxMovementSubstep: 0.12,
  },
  match: {
    readyMs: 3_000,
    // XZ world-space radius around Human; deliberately independent of actor mesh size.
    captureRadius: 0.70,
    captureMs: 350,
  },
  door: {
    interactionRange: 1.3,
    maxActiveLocks: 3,
    humanForceBreakCooldownMs: 30_000,
    leafHeight: 1.2,
    leafThickness: 0.16,
    openAngle: Math.PI / 2,
    colors: {
      open: 0x6d8f73,
      closed: 0x8a644b,
      locked: 0xa0443f,
      lockCore: 0xffc247,
      lockCoreDisabled: 0x565d63,
    },
  },
  pulseLock: {
    rows: 4,
    cols: 4,
    mines: 3,
    failureFeedbackMs: 1_500,
  },
  perception: {
    // S6D debug hearing display: XZ world units, with stable near/mid/far bands.
    soundVisual: { radius: 18, nearMax: 2.5, midMax: 6.5, bandHysteresis: 0.3 },
    visionRange: 11,
    lastSeenMs: 8_000,
    traceLifetimeMs: 6_000,
    traceRefreshMs: 1_000,
    footstepIntervalMs: 650,
    sprintStepIntervalMs: 330,
    riceSoundIntervalMs: 1_200,
    wallSoundFactor: 0.28,
    closedDoorSoundFactor: 0.45,
    lockedDoorSoundFactor: 0.35,
    minimumAudibleStrength: 0.015,
    sounds: {
      FOOTSTEP: { range: 17, strength: 0.35, lifetimeMs: 1_400 },
      RICE_EAT: { range: 7, strength: 0.7, lifetimeMs: 1_200 },
      SPRINT: { range: 18, strength: 0.8, lifetimeMs: 1_200 },
      FALL: { range: 10, strength: 1, lifetimeMs: 1_500 },
      DOOR_OPEN: { range: 6, strength: 0.6, lifetimeMs: 1_000 },
      DOOR_CLOSE: { range: 6, strength: 0.65, lifetimeMs: 1_000 },
      DOOR_LOCK: { range: 5, strength: 0.65, lifetimeMs: 1_000 },
      FORCE_BREAK: { range: 10, strength: 1, lifetimeMs: 1_500 },
      LOCK_BREAK: { range: 7, strength: 0.8, lifetimeMs: 1_200 },
    },
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
