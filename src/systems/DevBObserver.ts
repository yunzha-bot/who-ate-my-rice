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
        { label: '藏身检查（CHECK_HIDE）', value: '预留状态，未实现（S7C-1B 未授权）' },
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
