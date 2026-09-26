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
  deepseekAI: {
    waypointTolerance: 0.25, // 路径节点到达容差：XZ 世界单位。
    stuckRepathMs: 800, // 持续未靠近节点后重新寻路的时间：毫秒。
    stuckProgressEpsilon: 0.05, // 上述时间内应缩短的最小节点距离：世界单位。
    maxStuckRepathsPerTarget: 2, // 同一米堆连续卡路后允许的重寻路次数。
    retryMs: 1_500, // 米堆暂不可达或全无路线时的重选等待：毫秒。
    visionEvadeDistance: 5, // 看见 Human 且距离小于此值时逃跑：世界单位。
    soundEvadeStrength: 0.09, // 听到 Human 的最终强度达到此值时逃跑。
    soundThreatProjection: 4, // 未目视时只沿声音八方向投射粗略威胁点：世界单位。
    lastSeenAlertMs: 2_500, // 失去视线后参考最后目击点的短暂警戒：毫秒；已拉开安全距离时不额外强制原地等待。
    alertHoldMs: 1_800, // 最后一次高威胁后的警戒记忆：毫秒；安全路线已成立时可转入移动恢复。
    minimumEvadeMs: 900, // 单次逃跑最短时间，避免吃米/逃跑来回抖动：毫秒。
    recoverMs: 1_200, // 威胁降低后沿安全米点路线移动的警戒上限：毫秒，不强制静止。
    escapeReplanMs: 700, // 逃跑中允许重新选择路线的最短间隔：毫秒。
    escapeMinSeparation: 3, // 候选逃跑点与已知威胁点的优先安全间距：世界单位。
    escapeMinTravel: 2, // 避免把当前位置选为逃跑目标：世界单位。
    escapeGoalTolerance: 0.8, // 到达逃跑房间中心的距离：世界单位。
    escapeCoverBonus: 4, // 有墙或关门遮挡时的逃跑评分加分：无量纲。
    escapeDeadEndPenalty: 6, // 可用门出口不足两处时的评分扣分：无量纲。
    escapeTravelPenalty: 0.7, // 每世界单位路线长度的评分扣分。
    escapeTowardThreatPenalty: 3, // 路径起步靠近威胁时的评分扣分：无量纲。
    escapeGoalHoldMs: 1_500, // 通常至少保持当前逃跑目标的时间：毫秒；紧急危险或断路可提前切换。
    escapeSwitchScoreMargin: 2.5, // 新目的地评分需超过当前目标的最小差值，防止来回摆动。
    escapeVisitMemoryMs: 12_000, // 最近访问房间的记忆窗口：毫秒；超时后惩罚消失。
    escapeRecentVisitCount: 4, // 最多保留的近期房间/区域记录数量。
    escapeRecentVisitPenalty: 5, // 刚访问过的房间每次最多扣除的逃跑评分，随时间衰减。
    escapeLoopMinDistanceGain: 1, // 重返近期区域时须增加的最小安全距离：世界单位。
    escapeNearScoreBand: 0.8, // 仅在最高分附近此范围内随机挑选候选房间。
    safeObservationMs: 2_500, // 缺少可用威胁方位时，结束逃跑前的连续观察时长：毫秒。
    soundCautionStrength: 0.045, // 高于此最终可听强度的弱声音仍阻止过早脱险。
    dangerRiceAvoidMs: 3_000, // 逃跑后暂避位于危险路径上的原米堆：毫秒。
    dangerRouteRadius: 3, // 最后已知 Human 位置附近的危险米堆/路径范围：世界单位。
    safeWaitFailureThreshold: 2, // 同一米堆与危险入口重复受阻后进入安全等待：次数。
    safeWaitRecheckMs: 2_500, // SAFE_WAIT 重新评估安全路线的间隔：毫秒。
    escapeExtraExitBonus: 1.2, // 逃跑房间每个额外可用出口的评分奖励。
    escapeAlternateRouteBonus: 2, // 被堵出口存在可行替代路线时的评分奖励。
    escapeBlockedExitPenalty: 9, // Human 接近首个路径出口且无替代路线时的评分扣分。
    escapeRouteThreatPenalty: 3, // 路径节点靠近已知 Human 方位时每世界单位的评分扣分。
    exitBlockRadius: 2.5, // 估计 Human 占据路径出口的距离：世界单位。
    alternateRouteMaxRatio: 2, // 绕开被堵出口的路线最多允许为原路线的倍数。
    approachSprintDistance: 6, // Human 明显逼近时允许提前冲刺的目视距离：世界单位。
    approachSpeedThreshold: 0.35, // 判定 Human 逼近的最小相对速度：世界单位/秒。
    blockedExitSprintDistance: 3.5, // 已知 Human 靠近路径出口时的紧急冲刺距离：世界单位。
    safeSprintDistance: 5, // 低于30%进度时，近距威胁触发冲刺：世界单位。
    riskySprintDistance: 2.2, // 达到30%进度后，仅极近目视威胁可冲刺：世界单位。
    sprintSoundStrength: 0.22, // 未目视时触发安全冲刺的声音最终强度阈值。
    curiosityStillMs: 5_000, // Human 实际连续静止后的一次试探判定：毫秒；触发时仍需目视。
    curiosityChance: 0.10, // 每次合格静止事件只抽一次的触发概率。
    curiosityMovementEpsilon: 0.05, // Human 相对静止锚点的实际位移容差：世界单位；与目视无关。
    curiositySafeDistance: 2.0, // 试探与绕行路径距目视 Human 的最小安全间距：世界单位。
    curiosityObserveMs: 1_800, // 到达安全观察点后的观察时间：毫秒。
    curiosityCooldownMs: 12_000, // 一次试探结束或被打断后的冷却：毫秒。
    curiosityApproachTolerance: 0.5, // 到达观察点的容差：世界单位。
    stationaryPassageChance: 1.00, // 可见 Human 静止并挡住米路线时，每次静止事件必触发一次安全通行尝试。
    stationaryPassageSafetyMargin: 0.20, // 抓捕圈外的动态绕行安全余量：世界单位。
    stationaryPassageBlockRadius: 1.5, // 判断静止 Human 是否挡住米路线的距离：世界单位。
    stationaryPassageObserveDistance: 2.0, // 安全通行前选择观察点的期望距离：世界单位。
    stationaryPassageCheckIntervalMs: 500, // 静止挡路条件的再次检查间隔：毫秒，避免逐帧 A*。
    doorEscapeMinHumanDistance: 1.5, // EVADE 关门时与当前可见 Human 的最低距离：世界单位；大于实际抓捕圈。
    doorEscapeCrossingWindowMs: 1_800, // 实际穿过门后允许考虑关门的时间：毫秒；不返回远门。
    doorEscapeCooldownMs: 5_000, // 同一扇门再次考虑关门的冷却：毫秒；避免 Human 开门后原地振荡。
  },
  characterAnimation: {
    fallPoseMs: 220, // 毫秒；摔倒占位姿态显示时间，不改变眩晕时长。
    transitionMs: 120, // 毫秒；未来 AnimationMixer 片段交叉淡入时间。
    specialIdleTriggerMs: 5_000, // 连续普通 IDLE 后尝试播放特殊待机的时间：毫秒。
    specialIdleRepeatIntervalMs: 15_000, // 特殊待机两次开始之间的最短间隔：毫秒。
    specialIdleSlots: ['IDLE_01', 'IDLE_02', 'IDLE_03', 'IDLE_04', 'IDLE_05'], // 允许接入的特殊待机插槽；缺失片段会被忽略。
    stunColor: 0xff7777, // 白模摔倒/眩晕颜色；仅视觉表现。
  },
  sprint: {
    speedMultiplier: 1.6, // 相对 DeepSeek 基础速度的倍率。
    durationMs: 2_500, // 冲刺持续时间：毫秒。
    riskThreshold: 0.30, // 全局大米进度比例，达到后冲刺结束必摔。
    stunMs: 1_000, // 摔倒后的眩晕时间：毫秒。
    cooldownMs: 30_000, // 冲刺技能冷却：毫秒；冲刺一开始即进入冷却，期间不能再次冲刺。
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
  // S7C-1B：Human 玩家 Q「扇形搜查与手动抓捕」。已批准数值，不随 DEV 调试改写。
  humanSearch: {
    // 扇形半径：世界单位。
    range: 1.5,
    // 扇形半角：度（每侧）；整体张角 = 2 × 该值 = 120°。
    halfAngleDeg: 60,
    // 每次有效释放后的冷却：毫秒；未命中也消耗。
    cooldownMs: 12_000,
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
    // S7C-1B：DeepSeek 玩家 Q 主动锁门的冷却：毫秒；只有锁门成功才开始计时，
    // 失败（状态不允许、超距、锁位已满、锁芯失效）不消耗冷却。
    playerLockCooldownMs: 20_000,
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
