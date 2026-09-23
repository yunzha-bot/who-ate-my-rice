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
    size: 32, // 占位角色边长：像素，运行时按 pixelsPerUnit 换算。
    speed: 230, // DeepSeek 基础速度：像素/秒。
    color: 0x3197ff,
  },
  human: {
    size: 32,
    speedMultiplier: 1.08, // 相对 DeepSeek 基础速度的倍率。
    color: 0xf28b45,
  },
  humanAI: {
    movementSpeedMultiplier: 0.92, // AI 移速倍率：在 Human 基础速度上降低约 8%，不影响玩家手动控制。
    navCellSize: 0.4, // 寻路网格边长：XZ 世界单位。
    repathIntervalMs: 500, // 目标移动后的最长重新寻路间隔：毫秒。
    waypointTolerance: 0.25, // 通过路径点的距离：世界单位。
    investigationDwellMs: 3_000, // 到达声音/目击区域后观察时间：毫秒。
    stuckRepathMs: 800, // 移动受阻后的重新寻路时间：毫秒。
    stuckProgressEpsilon: 0.05, // 卡路检测窗口内靠近路径节点的最小距离：世界单位。
    closedDoorPathCost: 3, // 普通关门格的额外无量纲寻路代价。
    lockedDoorPathCost: 12, // 规划可破解锁门路线时，每个锁门格的额外网格代价。
    aiUnlockDurationMs: 8_750, // AI 模拟破解锁芯的一次尝试时长：毫秒（原 5 秒的 1.75 倍）。
    aiUnlockSuccessChance: 0.7, // AI 单次破解成功概率：0～1。
    aiUnlockMaxAttempts: 2, // 同一锁芯本局最多尝试次数。
    aiUnlockFailureAvoidMs: 6_000, // 失败后暂避该锁门的时间：毫秒。
    forceBreakReserveMs: 1_800, // 路线比较时为长冷却技能保留的等效时间：毫秒。
    detourSlackMs: 600, // 绕行路线可比锁门方案多耗费的容差：毫秒。
    searchRadius: 12, // Last Seen 周边有限搜索半径：世界单位。
    searchRoomCount: 3, // 一次追丢最多搜索的相邻房间数。
    searchDwellMs: 900, // 每个搜索点的观察停留：毫秒。
    searchMaxMs: 15_000, // 一次追丢搜索总时限：毫秒。
  },
  characterAnimation: {
    fallPoseMs: 220, // 毫秒；摔倒占位姿态显示时间，不改变眩晕时长。
    transitionMs: 120, // 毫秒；未来 AnimationMixer 片段交叉淡入时间。
    stunColor: 0xff7777, // 白模摔倒/眩晕颜色；仅视觉表现。
  },
  sprint: {
    speedMultiplier: 1.6, // 相对 DeepSeek 基础速度的倍率。
    durationMs: 2_500, // 冲刺持续时间：毫秒。
    riskThreshold: 0.30, // 全局大米进度比例，达到后冲刺结束必摔。
    stunMs: 1_000, // 摔倒后的眩晕时间：毫秒。
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
    playerRadius: 0.23, // 角色逻辑碰撞圆半径：世界单位。
    contactEpsilon: 0.0001,
    maxMovementSubstep: 0.12,
  },
  match: {
    // 单帧规则推进上限，毫秒；避免切回标签页时计时跳跃。
    maxFrameDeltaMs: 50,
    readyMs: 3_000, // 选阵营后的准备时间：毫秒。
    // 抓捕圈半径：XZ 世界单位，独立于角色视觉方块。
    captureRadius: 0.70,
    // 连续有效接触时间：毫秒。
    captureMs: 350,
  },
  door: {
    // 门交互距离及门段端点内缩量：XZ 世界单位。
    interactionRange: 1.3,
    interactionEndInset: 0.08,
    maxActiveLocks: 3,
    // Human 对普通 CLOSED 门按 Space 免费快速打开。
    humanFreeOpenClosedDoor: true,
    // 仅强破 LOCKED 门触发的冷却：毫秒。
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
    rows: 4, // 扫雷行数。
    cols: 4, // 扫雷列数。
    mines: 3, // 地雷数量，必须小于总格数。
    // 扫雷第一次揭格保证安全。
    firstRevealSafe: true,
    failureFeedbackMs: 1_500,
  },
  perception: {
    // S6D debug hearing display: XZ world units, with stable near/mid/far bands.
    soundVisual: {
      radius: 18, nearMax: 2.5, midMax: 6.5, bandHysteresis: 0.3,
      colors: { far: 0x54aaff, mid: 0xffd45f, near: 0xff635b },
      // 声波亮度归一化强度及结束淡出时间：无量纲、毫秒。
      waveFullStrength: 0.45,
      waveFadeMs: 420,
      hudMidStrength: 0.25,
      hudHighStrength: 0.55,
    },
    visionRange: 11,
    lastSeenMs: 8_000,
    // 米痕：生成窗口与每个脚印寿命/淡出均为毫秒，步距为世界单位。
    traceGenerationMs: 5_000,
    traceLifetimeMs: 15_000,
    traceFadeMs: 3_000,
    traceStepDistance: 0.65,
    traceVisual: {
      color: 0x9aa4aa,
      footprintRadius: 0.18,
      widthScale: 0.7,
      lengthScale: 1.45,
      sideOffset: 0.14,
      forwardOffset: 0.07,
      groundOffset: 0.075,
      opacity: 0.88,
    },
    footstepIntervalMs: 650,
    sprintStepIntervalMs: 330,
    riceSoundIntervalMs: 1_200,
    minimumMovementSoundDistance: 0.002,
    // 距离衰减：(1 - 距离 / 事件范围) 的指数；1 保持当前线性手感。
    distanceFalloffPower: 1,
    wallSoundFactor: 0.28,
    openDoorSoundFactor: 1,
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
    // 地图中参与抽选的候选米点数和每局激活数量；坐标仍由地图文件定义。
    candidateCount: 14,
    activeCount: 5,
    size: 30,
    color: 0xf2e5bc,
    interactionRange: 60, // 像素，运行时除以 pixelsPerUnit。
    prepareMs: 400, // 每次开始或恢复进食的准备时间：毫秒。
    maxProgressMs: RICE_MAX_PROGRESS_MS[RICE_TIMING_MODE],
    visual: {
      fullHeight: 0.62,
      emptyHeight: 0.08,
      fullBulgeHeight: 0.22,
      emptyWidthScale: 0.92,
    },
  },
} as const;
