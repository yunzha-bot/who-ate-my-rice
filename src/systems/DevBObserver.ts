import type { Point } from '../three/map/apartmentMap.ts';
import { devBGlossValue, devBReasonText, devBSoundTypeText, devBYesNo }
  from './DevBHelpText.ts';

// DEV-B read-only observation layer.
//
// Everything here is a pure function of already-collected real state: it never
// reads hidden information, never advances a timer and never feeds anything back
// into an AI. Fields the project genuinely cannot observe today are reported as
// plain Chinese ("面板暂时看不到" / "当前没有…") instead of being invented, and
// internal state codes are shown as 中文（原代码） so the raw code stays available.
// The Chinese wording lives in `DevBHelpText.ts`; no judgement depends on it.

export interface DevBAiCommon {
  state: string;
  pathIndex: number | null;
  pathTotal: number | null;
  pathWaypoint: Point | null;
  navigationReason: string;
  transitionReason: string;
}

export interface DevBHumanAi extends DevBAiCommon {
  target: Point | null;
  targetRoomId: string | null;
  lockDecision: string;
  targetDoorId: string | null;
  decisionReason: string;
  unlockProgressMs: number;
  searchTargetRoomId: string | null;
  /** S7C-2：米痕循迹与家具搜查（区分「AI 已知」与「AI 推断」）。 */
  hideSearch?: DevBHumanHideSearch | null;
}

/**
 * S7C-2 观察数据。三段严格分开：
 *   - `clue*` = **AI 已知**：它亲自看见过的米痕线索；
 *   - `inference*` / `candidate*` = **AI 推断**：它由这些公开线索算出的结论；
 *   - 其余位置类字段是开发者真值（Human AI 自己的站位 / 目标家具的表面点）。
 * 这里没有、也不会有隐藏者的真实坐标或藏身点占用状态。
 */
export interface DevBHumanHideSearch {
  clueCount: number;
  expiredClueCount: number;
  latestCluePosition: Point | null;
  latestClueAgeMs: number | null;
  inferenceCode: string;
  inferenceConfidence: string;
  inferenceHeadingDeg: number | null;
  inferenceAnchor: Point | null;
  inferenceBasis: string;
  candidateRanking: string;
  suspectedSpotId: string | null;
  suspectedBasis: string;
  /** S7C-2 修复轮 六：被排除的公开原因（失败冷却 / 已搜查 / 家具缺失）。 */
  candidateSkipped: string;
  /** 修复轮 一：待处理的公开米痕线索数量、剩余有效期与延后原因。 */
  pendingClueCount: number;
  pendingClueRemainingMs: number;
  pendingClueDeferReason: string;
  pendingClueDeferCount: number;
  pendingClueReevalCount: number;
  /** 修复轮 二：Last Seen 的公开坐标 / 房间 / 年龄 / 是否有效 + 同房间门槛结论。 */
  lastSeenPresent: boolean;
  lastSeenValid: boolean;
  lastSeenPosition: Point | null;
  lastSeenRoomId: string | null;
  lastSeenAgeMs: number | null;
  lastSeenRoomGateCode: string;
  lastSeenRoomGateDetail: string;
  /** 修复轮 三：本轮已开始 / 已正式执行 / 本次调查已执行的搜查次数。 */
  roundAttempts: number;
  attemptedSpotId: string | null;
  investigationEndReason: string;
  /** 修复轮 六：打断搜查的真实声音明细（AI 亲耳听到的那一条）。 */
  interruptSoundType: string | null;
  interruptSoundStrength: number | null;
  interruptSoundRemainingMs: number | null;
  interruptSoundIsNew: boolean;
  /** 修复轮 四：最近一次正式判定的公开结果与瞄点一致性。 */
  checkResult: string;
  checkDetailText: string;
  plannedSurfacePoint: Point | null;
  finalAimPoint: Point | null;
  aimPointDelta: number | null;
  aimAngleDeltaDeg: number | null;
  aimBlocked: boolean | null;
  /** 开发者真值（不参与 AI 决策）：权威层的细粒度判定码。 */
  authoritativeCode: string;
  authoritativeDetail: string;
  phase: string;
  source: string | null;
  spotId: string | null;
  stancePoint: Point | null;
  surfacePoint: Point | null;
  /**
   * 修复轮 二：导航寻路终点（吸附网格点）与「正式站位」是**两个不同的中心**，
   * 这里把三处一起显示，才能一眼看出「为什么当时判成 STANCE_LOST」。
   */
  navGoal: Point | null;
  stanceDistance: number | null;
  requestPosition: Point | null;
  approachSteps: number;
  requestCount: number;
  staleCancels: number;
  /** 最近一次判定是否算「真正完成的正式检查」（只有搜空 / 搜中为 true）。 */
  countsAsFormalCheck: boolean;
  dwellRemainingMs: number;
  dwellMs: number;
  roundChecks: number;
  roundBudget: number;
  investigationChecks: number;
  checkedSpotIds: readonly string[];
  cooldowns: readonly { spotId: string; remainingMs: number }[];
  lastResult: string;
  lastResultSpotId: string | null;
  giveUpCode: string;
  giveUpDetail: string;
  startCount: number;
  hitCount: number;
  missCount: number;
  interruptCount: number;
}

export interface DevBDeepSeekAi extends DevBAiCommon {
  targetRiceId: string | null;
  selectionReason: string;
  threatSource: string;
  threatLevel: string;
  escapeTarget: Point | null;
  escapeRoomId: string | null;
  noMovementReason: string;
  sprintDecision: string;
  recoveryBlockReason: string;
  safeWaitReason: string;
  safeWaitRemainingMs: number;
  curiosityRemainingMs: number;
  passageActive: boolean;
}

export interface DevBHearing {
  heard: boolean;
  type: string;
  audibleStrength: number;
  distanceFactor: number;
  occlusionMultiplier: number;
  occlusion: string;
  direction: string;
  remainingMs: number;
}

export interface DevBSoundMarker {
  type: string;
  x: number;
  z: number;
  range: number;
  remainingMs: number;
  heard: boolean;
}

export interface DevBObservationInput {
  phase: string;
  playerFaction: string | null;
  controlledFaction: string | null;
  temporaryTarget: string | null;
  humanAiRunning: boolean;
  deepseekAiRunning: boolean;
  human: Point;
  deepseek: Point;
  vision: {
    status: string;
    blocker: string | null;
    visible: boolean;
    lastSeen: { position: Point; ageMs: number; remainingMs: number } | null;
  };
  capture: {
    radius: number;
    distance: number;
    insideRadius: boolean;
    blocked: boolean;
    eligible: boolean;
    progressMs: number;
    holdMs: number;
  };
  hearing: DevBHearing | null;
  sounds: readonly DevBSoundMarker[];
  paths: { human: readonly Point[]; deepseek: readonly Point[] };
  humanAi: DevBHumanAi | null;
  deepseekAi: DevBDeepSeekAi | null;
  sprint: {
    state: string;
    sprintRemainingMs: number;
    stunRemainingMs: number;
    cooldownRemainingMs: number;
    riskMode: string;
  };
  rice: { completedCount: number; total: number; ratio: number; targetId: string | null };
  movement: { playerSpeed: number; humanSpeed: number; humanAiSpeed: number };
}

export interface DevBObservationEntry {
  label: string;
  value: string;
  tone?: 'normal' | 'warning' | 'danger' | 'success' | 'curious';
}

export interface DevBObservationSection {
  id: string;
  title: string;
  entries: DevBObservationEntry[];
}

// 没有数据时一律写「当前没有…」这种通俗说法，不显示 NONE / 不适用 之类的内部代码。
const NO_HIDE_TIMER = '面板暂时看不到';
const NO_TARGET_POINT = '当前没有目标位置';
const NO_SOUND = '当前没有声音可以分析';

export function formatPoint(value: Point | null | undefined,
  fallback: string = NO_TARGET_POINT): string {
  return value ? `(${value.x.toFixed(2)}, ${value.z.toFixed(2)})` : fallback;
}

export function formatSeconds(ms: number | null | undefined,
  fallback: string = '当前没有计时'): string {
  return Number.isFinite(ms) ? `${(Math.max(0, ms as number) / 1000).toFixed(1)} 秒` : fallback;
}

export function devBPathSummary(path: readonly Point[], progress: {
  pathIndex: number | null; pathTotal: number | null; pathWaypoint: Point | null;
}): string {
  if (path.length === 0) return '当前没有路线';
  const index = progress.pathIndex === null ? '?' : String(progress.pathIndex + 1);
  const total = progress.pathTotal ?? path.length;
  return `${path.length} 个节点（进度 ${index}/${total}），下一个路径点 ${formatPoint(progress.pathWaypoint)}`;
}

/**
 * S7C-2 的观察条目。每条都写明它属于哪一类信息：
 * 「AI 已知」= 它亲自看到的公开线索；「AI 推断」= 它由线索算出的结论；
 * 其余为开发者真值（不参与 AI 决策）。
 */
function hideSearchEntries(hide: DevBHumanHideSearch):
{ label: string; value: string; tone?: 'normal' | 'warning' | 'danger' | 'success' | 'curious' }[] {
  const clueValue = hide.clueCount === 0
    ? 'AI 还没有亲自看到任何米痕'
    : `${hide.clueCount} 条（其中 ${hide.expiredClueCount} 条已过期）｜` +
      `最近一条 ${hide.latestClueAgeMs === null ? '时间未知'
        : `${formatSeconds(hide.latestClueAgeMs)}前`}于 ${formatPoint(hide.latestCluePosition)}`;
  const cooling = hide.cooldowns.length
    ? hide.cooldowns.map(entry => `${entry.spotId} 剩余 ${formatSeconds(entry.remainingMs)}`)
      .join('；')
    : '当前没有搜查失败记忆';
  const checked = hide.checkedSpotIds.length ? hide.checkedSpotIds.join('、') : '还没有检查过家具';
  const dwell = hide.phase === 'NONE'
    ? `当前没有在执行搜查（规定停留 ${formatSeconds(hide.dwellMs)}）`
    : `${formatSeconds(hide.dwellRemainingMs)}，规定停留 ${formatSeconds(hide.dwellMs)}`;
  const pending = hide.pendingClueCount === 0
    ? '当前没有被延后的公开线索'
    : `${hide.pendingClueCount} 条仍有效｜延后原因 ` +
      `${devBGlossValue('clueDeferReason', hide.pendingClueDeferReason)}｜` +
      `最后有效期还剩 ${formatSeconds(hide.pendingClueRemainingMs)}｜` +
      `延后 ${hide.pendingClueDeferCount} 次 / 重评 ${hide.pendingClueReevalCount} 次`;
  const lastSeen = hide.lastSeenPresent
    ? `${formatPoint(hide.lastSeenPosition)}｜房间 ${hide.lastSeenRoomId ?? '未知'}｜` +
      `已过去 ${formatSeconds(hide.lastSeenAgeMs ?? 0)}｜` +
      `${hide.lastSeenValid ? '仍然有效' : '已经过期，不再作为证据'}｜` +
      `同房间门槛 ${devBGlossValue('lastSeenRoomGate', hide.lastSeenRoomGateCode)}` +
      (hide.lastSeenRoomGateDetail ? `：${hide.lastSeenRoomGateDetail}` : '')
    : '当前没有 Last Seen 记录';
  const aim = hide.plannedSurfacePoint || hide.finalAimPoint
    ? `计划表面点 ${formatPoint(hide.plannedSurfacePoint)}｜最终判定点 ` +
      `${formatPoint(hide.finalAimPoint)}｜与最近表面点相差 ` +
      `${hide.aimPointDelta === null ? '—' : hide.aimPointDelta.toFixed(3)}｜` +
      `${hide.checkResult}：${hide.checkDetailText}`
    : '还没有执行过正式搜查';
  const interrupt = hide.interruptSoundType
    ? `${hide.interruptSoundType}｜可听强度 ` +
      `${(hide.interruptSoundStrength ?? 0).toFixed(2)}｜剩余寿命 ` +
      `${formatSeconds(hide.interruptSoundRemainingMs ?? 0)}｜` +
      `${hide.interruptSoundIsNew ? '新事件' : '旧事件'}`
    : '当前没有打断搜查的声音记录';
  return [
    { label: 'AI 已知：米痕线索', value: clueValue },
    { label: 'AI 推断：方向 / 置信度', value: hide.inferenceHeadingDeg === null
      ? `${devBGlossValue('traceInference', hide.inferenceCode)}｜置信度 ` +
        `${devBGlossValue('traceConfidence', hide.inferenceConfidence)}`
      : `方向 ${hide.inferenceHeadingDeg.toFixed(0)}°｜` +
        `${devBGlossValue('traceInference', hide.inferenceCode)}｜置信度 ` +
        `${devBGlossValue('traceConfidence', hide.inferenceConfidence)}`,
      tone: hide.inferenceConfidence === 'HIGH' ? 'curious' : 'normal' },
    { label: 'AI 推断：调查锚点', value: formatPoint(hide.inferenceAnchor,
      '当前没有推断锚点') },
    { label: 'AI 推断：公开依据', value: hide.inferenceBasis || '当前没有推断依据' },
    { label: 'AI 待处理的公开线索（被延后 ≠ 丢弃）', value: pending,
      tone: hide.pendingClueCount > 0 ? 'curious' : 'normal' },
    { label: 'Last Seen（公开坐标 / 房间 / 年龄 / 有效性）', value: lastSeen },
    { label: 'AI 怀疑家具（公开排序第一）', value: hide.suspectedSpotId
      ? `${hide.suspectedSpotId}｜排序 ${hide.candidateRanking}` : '当前没有可信的公开候选' },
    { label: 'AI 怀疑依据（只用公开线索）', value: hide.suspectedBasis || '当前没有候选排序依据' },
    { label: '公开候选被排除的原因', value: hide.candidateSkipped || '没有被排除的候选' },
    { label: '藏身检查（CHECK_HIDE）', value: `${devBGlossValue('checkHidePhase', hide.phase)}` +
      `｜来源 ${hide.source ? devBGlossValue('checkHideSource', hide.source) : '当前没有搜查任务'}`,
      tone: hide.phase === 'NONE' ? 'normal' : 'curious' },
    { label: '搜查目标家具 / 站位 / 表面', value: hide.spotId
      ? `${hide.spotId}｜站位 ${formatPoint(hide.stancePoint, '未知')}｜` +
        `可搜查表面 ${formatPoint(hide.surfacePoint, '未知')}`
      : '当前没有搜查目标' },
    { label: '搜查停留进度', value: dwell },
    { label: '导航终点 / 正式站位 / 实际偏差', value: hide.stancePoint
      ? `导航吸附点 ${formatPoint(hide.navGoal, '未知')}｜正式站位 ` +
        `${formatPoint(hide.stancePoint, '未知')}｜REQUEST 实际位置 ` +
        `${formatPoint(hide.requestPosition, '尚未发出请求')}｜偏差 ` +
        `${hide.stanceDistance === null ? '—' : hide.stanceDistance.toFixed(3)} 世界单位`
      : '当前没有站位计划' },
    { label: '最终接近 / 正式请求次数 / 计划失效退还配额',
      value: `最终接近 ${hide.approachSteps} 帧｜正式请求 ${hide.requestCount} 次` +
        `（每个动作只允许 1 次）｜退还配额 ${hide.staleCancels} 次`,
      tone: hide.requestCount > 1 ? 'warning' : 'normal' },
    { label: '最近一次判定是否计入正式检查', value: hide.countsAsFormalCheck
      ? '计入（合法搜空 / 搜中）'
      : '不计入（站位 / 朝向 / 几何未成立 → 取消，不记搜空、不进 6 秒冷却）',
      tone: hide.countsAsFormalCheck ? 'normal' : 'warning' },
    { label: '计划瞄点与最终判定点', value: aim,
      tone: hide.aimBlocked ? 'warning' : 'normal' },
    { label: '本轮已开始 / 已正式执行 / 本次调查已执行',
      value: `${hide.roundAttempts} / ${hide.roundChecks}（上限 ${hide.roundBudget}） / ` +
        `${hide.investigationChecks}｜本轮开始过的家具 ${hide.attemptedSpotId ?? '无'}`,
      tone: hide.roundChecks >= hide.roundBudget ? 'warning' : 'normal' },
    { label: '本次调查的收尾方式', value: hide.investigationEndReason },
    { label: '本次调查已检查家具（上限复用 searchRoomCount）',
      value: `${hide.investigationChecks} 件｜${checked}` },
    { label: '搜查失败记忆与剩余冷却', value: cooling },
    { label: '最近一次搜查结果', value: hide.lastResultSpotId
      ? `${devBGlossValue('checkHideResult', hide.lastResult)}（${hide.lastResultSpotId}）`
      : '还没有执行过正式搜查' },
    { label: '打断搜查的声音明细', value: interrupt },
    { label: '放弃搜查原因', value: hide.giveUpCode === 'NONE'
      ? '当前没有放弃记录' : `${hide.giveUpCode}：${hide.giveUpDetail}`,
      tone: hide.giveUpCode === 'NONE' ? 'normal' : 'warning' },
    { label: '搜查次数：开始 / 命中 / 搜空 / 被抢占',
      value: `${hide.startCount} / ${hide.hitCount} / ${hide.missCount} / ${hide.interruptCount}` },
    { label: '开发者真值：权威层判定码（不参与 AI 决策）',
      value: `${hide.authoritativeCode}｜${hide.authoritativeDetail}` },
    { label: '信息归属说明', value: '「AI 已知」= AI 真实收到的公开线索；' +
      '「AI 推断」= AI 由这些线索算出的结论；其余为开发者真值，不参与 AI 决策' },
    { label: 'DEV 标记图例（信息归属）', value: '绿=AI 已知米痕线索；青=AI 推断方向与调查锚点；' +
      '洋红=AI 推断的怀疑家具；抓捕圈/AI 真实路径/声音为开发者真值' },
  ];
}

export function buildDevBObservation(input: DevBObservationInput):
DevBObservationSection[] {
  const { vision, capture, movement } = input;
  const controlMode = (faction: 'HUMAN' | 'DEEPSEEK'): string => {
    if (input.controlledFaction === faction) return '玩家手动控制';
    if (input.temporaryTarget === faction) return 'DEV 临时输入接管';
    const running = faction === 'HUMAN' ? input.humanAiRunning : input.deepseekAiRunning;
    return running ? 'AI 自主运行' : '未运行';
  };
  const captureDistance = capture.distance;
  const targetDistance = input.humanAi?.target
    ? Math.hypot(input.humanAi.target.x - input.human.x, input.humanAi.target.z - input.human.z)
    : null;

  return [
    {
      id: 'control', title: '阵营与控制模式',
      entries: [
        { label: '对局阶段', value: devBGlossValue('phase', input.phase) },
        { label: '正式主控阵营', value: input.playerFaction
          ? devBGlossValue('faction', input.playerFaction) : '还没有选择阵营' },
        { label: '当前输入控制', value: input.controlledFaction
          ? devBGlossValue('faction', input.controlledFaction) : '当前没有键盘控制目标' },
        { label: '临时输入目标', value: input.temporaryTarget
          ? devBGlossValue('faction', input.temporaryTarget) : '没有临时接管' },
        { label: 'Human 运行模式', value: controlMode('HUMAN'),
          tone: input.humanAiRunning ? 'curious' : 'normal' },
        { label: 'DeepSeek 运行模式', value: controlMode('DEEPSEEK'),
          tone: input.deepseekAiRunning ? 'curious' : 'normal' },
      ],
    },
    {
      id: 'human-ai', title: 'Human AI 实时状态',
      entries: input.humanAi ? [
        { label: 'AI 状态', value: devBGlossValue('humanAiState', input.humanAi.state) },
        { label: '当前目标点', value: formatPoint(input.humanAi.target, '当前没有追逐目标') },
        { label: '目标距离', value: targetDistance === null
          ? '当前没有追逐目标' : `${targetDistance.toFixed(2)} 世界单位` },
        { label: '目标房间', value: input.humanAi.targetRoomId ?? '当前没有目标房间' },
        { label: '随机状态：搜索房间', value: input.humanAi.searchTargetRoomId ?? '当前没有要搜索的房间' },
        { label: '导航目标 / 路径', value: devBPathSummary(input.paths.human, input.humanAi) },
        { label: '最近导航原因', value: devBReasonText(null, input.humanAi.navigationReason) },
        { label: '最近切换原因', value: devBReasonText(null, input.humanAi.transitionReason) },
        { label: '卡住检测计时', value: `${NO_HIDE_TIMER}（控制器内部计时 stuckMs，未对外暴露）` },
        { label: '锁门决策 / 目标门', value: `${devBGlossValue('humanLockDecision',
          input.humanAi.lockDecision)} / ${input.humanAi.targetDoorId ?? '当前没有目标门'}` },
        { label: '决策原因', value: devBReasonText(null, input.humanAi.decisionReason) },
        { label: 'AI 破解锁芯进度', value: formatSeconds(input.humanAi.unlockProgressMs,
          '当前没有在破解门锁') },
        ...(input.humanAi.hideSearch
          ? hideSearchEntries(input.humanAi.hideSearch)
          : [{ label: '藏身检查（CHECK_HIDE）', value: '当前没有可观察的循迹数据' }]),
      ] : [{ label: 'Human AI', value: '当前未运行（Human 由玩家控制）' }],
    },
    {
      id: 'deepseek-ai', title: 'DeepSeek AI 实时状态',
      entries: input.deepseekAi ? [
        { label: 'AI 状态', value: devBGlossValue('deepseekAiState', input.deepseekAi.state) },
        { label: '当前目标米堆', value: input.deepseekAi.targetRiceId ?? '当前没有选中的米堆' },
        { label: '已选米堆进度', value: input.rice.targetId ?? '当前没有在吃的米堆' },
        { label: '选米原因', value: devBReasonText(null, input.deepseekAi.selectionReason) },
        { label: '导航目标 / 路径', value: devBPathSummary(input.paths.deepseek, input.deepseekAi) },
        { label: '最近导航原因', value: devBReasonText(null, input.deepseekAi.navigationReason) },
        { label: '最近切换原因', value: devBReasonText(null, input.deepseekAi.transitionReason) },
        { label: '无移动原因', value: devBReasonText(null, input.deepseekAi.noMovementReason) },
        { label: '卡住检测计时', value: `${NO_HIDE_TIMER}（控制器内部计时 stuckMs，未对外暴露）` },
        { label: '威胁来源 / 等级', value: `${devBGlossValue('threatSource',
          input.deepseekAi.threatSource)} / ${devBGlossValue('threatLevel', input.deepseekAi.threatLevel)}` },
        { label: '逃跑目标 / 房间', value: `${formatPoint(input.deepseekAi.escapeTarget,
          '当前不需要逃跑')} / ${input.deepseekAi.escapeRoomId ?? '当前不需要逃跑'}` },
        { label: '冲刺决策', value: devBReasonText(null, input.deepseekAi.sprintDecision) },
        { label: '恢复受限原因', value: devBReasonText(null, input.deepseekAi.recoveryBlockReason) },
        { label: '安全等待原因 / 剩余（SAFE_WAIT）', value: `${devBReasonText(null,
          input.deepseekAi.safeWaitReason)} / ${formatSeconds(input.deepseekAi.safeWaitRemainingMs,
          '当前不需要等待')}` },
        { label: '好奇观察剩余', value: formatSeconds(input.deepseekAi.curiosityRemainingMs,
          '当前没有在好奇观察') },
        { label: '安全通行中', value: devBYesNo(input.deepseekAi.passageActive) },
      ] : [{ label: 'DeepSeek AI', value: '当前未运行（DeepSeek 由玩家控制）' }],
    },
    {
      id: 'perception', title: '视觉 / 听觉 / 抓捕',
      entries: [
        { label: '视线状态', value: `${devBGlossValue('visionStatus', vision.status)}${
          vision.blocker ? `｜阻挡物：${vision.blocker}` : ''}`,
          tone: vision.status === 'VISIBLE' ? 'success'
            : vision.status === 'BLOCKED' ? 'warning' : 'normal' },
        { label: '目标在真实视觉范围内', value: devBYesNo(vision.visible) },
        { label: '最后一次看到（Last Seen）', value: vision.lastSeen
          ? `${formatPoint(vision.lastSeen.position)}，${formatSeconds(vision.lastSeen.ageMs)}前，剩余 ${formatSeconds(vision.lastSeen.remainingMs)}`
          : '还没有看到过对方' },
        { label: '视觉遮挡几何', value: '只被墙体与门挡住（家具不参与视觉遮挡，见已知限制）', tone: 'warning' },
        { label: '最近声音事件', value: input.hearing
          ? `${devBSoundTypeText(input.hearing.type)}${input.hearing.heard ? '，听得见' : '，低于可听阈值'}，强度 ${input.hearing.audibleStrength.toFixed(3)}`
          : '当前没有听到任何声音' },
        { label: '声音距离衰减 / 遮挡', value: input.hearing
          ? `${input.hearing.distanceFactor.toFixed(2)} / ${input.hearing.occlusionMultiplier.toFixed(2)}（${input.hearing.occlusion}）`
          : NO_SOUND },
        { label: '声音方向 / 剩余', value: input.hearing
          ? `${input.hearing.direction} / ${formatSeconds(input.hearing.remainingMs)}` : NO_SOUND },
        { label: '场景内声音事件数', value: String(input.sounds.length) },
        { label: '抓捕半径（有效值）', value: `${capture.radius.toFixed(2)} 世界单位` },
        { label: '实际距离 / 是否在圈内', value: `${captureDistance.toFixed(2)} / ${capture.insideRadius ? '圈内' : '圈外'}` },
        { label: '抓捕遮挡', value: capture.blocked ? '有阻挡（墙 / 关着的门 / 家具）' : '没有阻挡',
          tone: capture.blocked ? 'warning' : 'normal' },
        { label: '抓捕资格', value: capture.eligible ? '可以抓捕（正在累计）' : '还不能抓捕',
          tone: capture.eligible ? 'danger' : 'normal' },
        { label: '累计抓捕进度', value: `${formatSeconds(capture.progressMs)} / ${formatSeconds(capture.holdMs)}` },
      ],
    },
    {
      id: 'movement', title: '移动 / 冲刺 / 大米',
      entries: [
        { label: 'DeepSeek 有效速度', value: `${movement.playerSpeed.toFixed(1)} 像素/秒（${(movement.playerSpeed / 60).toFixed(2)} 世界单位/秒）` },
        { label: 'Human 玩家有效速度', value: `${movement.humanSpeed.toFixed(1)} 像素/秒（${(movement.humanSpeed / 60).toFixed(2)} 世界单位/秒）` },
        { label: 'Human AI 有效速度', value: `${movement.humanAiSpeed.toFixed(1)} 像素/秒（${(movement.humanAiSpeed / 60).toFixed(2)} 世界单位/秒）` },
        { label: 'DeepSeek 位置', value: formatPoint(input.deepseek) },
        { label: 'Human 位置', value: formatPoint(input.human) },
        { label: '冲刺状态', value: devBGlossValue('sprintState', input.sprint.state) },
        { label: '冲刺剩余 / 眩晕', value: `${formatSeconds(input.sprint.sprintRemainingMs)} / ${formatSeconds(input.sprint.stunRemainingMs)}` },
        { label: '冲刺冷却', value: formatSeconds(input.sprint.cooldownRemainingMs, '当前不需要冷却') },
        { label: '冲刺风险模式', value: input.sprint.riskMode
          ? devBGlossValue('sprintRisk', input.sprint.riskMode) : '当前没有正在进行的冲刺' },
        { label: '大米进度', value: `${input.rice.completedCount} / ${input.rice.total}（${Math.round(input.rice.ratio * 100)}%）` },
      ],
    },
  ];
}
