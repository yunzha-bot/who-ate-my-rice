import type { RuntimeParamSpec } from './RuntimeDebugOverrides.ts';
import { RUNTIME_SOUND_TYPES } from './RuntimeDebugOverrides.ts';

// DEV-B 面板的中文说明文案（2026-09-26 易用性优化轮）。
//
// 只放「显示用的中文」：程序内部字段名、ID、配置键、单位与判定逻辑一律不动。
// 这里的东西不参与任何游戏判定，只被 `DevBPanel` 用于显示、被 `DevBObserver`
// 用于把内部状态码写成「中文（原代码）」。
//
// 复用原则：能用项目里已有的中文措辞就直接用——例如对局阶段沿用
// `ThreeGame.updateHud` 的 选择阵营 / 准备中 / 对局中 / 已暂停 / 已结束。

export interface ParamHelp {
  /** 「它是什么」：一句话中文解释。 */
  what: string;
  /** 调大之后会发生什么。 */
  increase: string;
  /** 调小之后会发生什么。 */
  decrease: string;
  /** 专业英文名 / 配置键，作为悬浮说明保留，便于与 `GAME_CONFIG` 对照。 */
  english: string;
}

/** 9 类声音的中文名；键必须是 `GAME_CONFIG.perception.sounds` 的真实键。 */
export const SOUND_TYPE_NAMES: Record<string, string> = {
  FOOTSTEP: '脚步声',
  RICE_EAT: '吃米声',
  SPRINT: '冲刺声',
  FALL: '摔倒声',
  DOOR_OPEN: '开门声',
  DOOR_CLOSE: '关门声',
  DOOR_LOCK: '锁门声',
  FORCE_BREAK: '强行破门声',
  LOCK_BREAK: '破锁声',
};

export function soundTypeName(type: string): string {
  return SOUND_TYPE_NAMES[type] ?? type;
}

const PARAM_HELP: Record<string, ParamHelp> = {
  'capture.radius': {
    what: 'AI 要贴到多近才算抓到你',
    increase: '抓捕圈变大，更容易被抓到',
    decrease: '抓捕圈变小，必须贴得更近才会被抓',
    english: 'GAME_CONFIG.match.captureRadius',
  },
  'vision.range': {
    what: '没有遮挡时 AI 能看多远',
    increase: '更远就能看见你',
    decrease: '要走到更近处才会被发现',
    english: 'GAME_CONFIG.perception.visionRange',
  },
  'hearing.falloffPower': {
    what: '声音随距离变小的快慢（指数）',
    increase: '远处的声音衰减更快、更难听清',
    decrease: '远处的声音也还能听清一些',
    english: 'GAME_CONFIG.perception.distanceFalloffPower',
  },
  'hearing.wallFactor': {
    what: '声音穿墙后剩下的比例',
    increase: '隔着墙也更容易被听见',
    decrease: '隔着一面墙几乎就听不见了',
    english: 'GAME_CONFIG.perception.wallSoundFactor',
  },
  'hearing.openDoorFactor': {
    what: '开着的门会让声音衰减多少',
    increase: '门开着时声音几乎不衰减',
    decrease: '门开着也会明显削弱声音',
    english: 'GAME_CONFIG.perception.openDoorSoundFactor',
  },
  'hearing.closedDoorFactor': {
    what: '关着的门会让声音衰减多少',
    increase: '关门不太挡声音',
    decrease: '关门后声音基本传不过去',
    english: 'GAME_CONFIG.perception.closedDoorSoundFactor',
  },
  'hearing.lockedDoorFactor': {
    what: '锁上的门会让声音衰减多少',
    increase: '锁门几乎不隔音',
    decrease: '锁门后声音几乎传不过去',
    english: 'GAME_CONFIG.perception.lockedDoorSoundFactor',
  },
  'hearing.minAudible': {
    what: '小到什么程度的声音算听不见',
    increase: '只有更大的声音才会被注意到',
    decrease: '很轻微的声音也会被注意到',
    english: 'GAME_CONFIG.perception.minimumAudibleStrength',
  },
  'movement.playerSpeed': {
    what: 'DeepSeek 娘的移动速度',
    increase: 'DeepSeek 娘移动更快',
    decrease: 'DeepSeek 娘移动更慢',
    english: 'GAME_CONFIG.player.speed',
  },
  'movement.humanSpeedMultiplier': {
    what: '人类一方速度的整体倍率',
    increase: '人类整体更快（Human AI 一起变快）',
    decrease: '人类整体更慢（Human AI 一起变慢）',
    english: 'GAME_CONFIG.human.speedMultiplier',
  },
  'movement.humanAiMultiplier': {
    what: '只作用在 Human AI 身上的额外倍率',
    increase: 'Human AI 追得更快（不影响玩家手里的 Human）',
    decrease: 'Human AI 追得更慢（不影响玩家手里的 Human）',
    english: 'GAME_CONFIG.humanAI.movementSpeedMultiplier',
  },
};

// 声音参数：9 类 × 3 项，用模板生成，保证不遗漏、说法一致。
for (const type of RUNTIME_SOUND_TYPES) {
  const name = soundTypeName(type);
  PARAM_HELP[`hearing.range.${type}`] = {
    what: `${name}最远能传到哪里`,
    increase: `${name}传得更远，隔很远也能被听到`,
    decrease: `${name}只在附近才听得见`,
    english: `GAME_CONFIG.perception.sounds.${type}.range`,
  };
  PARAM_HELP[`hearing.strength.${type}`] = {
    what: `${name}本身有多响`,
    increase: `同样距离下${name}更容易被听到`,
    decrease: `同样距离下${name}更难被听到`,
    english: `GAME_CONFIG.perception.sounds.${type}.strength`,
  };
  PARAM_HELP[`hearing.lifetime.${type}`] = {
    what: `${name}一次会在场景里留多久`,
    increase: '留得更久，AI 有更长时间持续察觉',
    decrease: '消失得更快，只能被瞬间察觉',
    english: `GAME_CONFIG.perception.sounds.${type}.lifetimeMs`,
  };
}

export function paramHelp(id: string): ParamHelp | null {
  return PARAM_HELP[id] ?? null;
}

export const PARAM_HELP_IDS: readonly string[] = Object.keys(PARAM_HELP);

/** 「何时生效」——由参数自己的 `immediate` 决定，不由文案猜。 */
export function devBParamTimingText(spec: RuntimeParamSpec): string {
  return spec.immediate
    ? '何时生效：改完立刻生效，下一次判定/移动就用新值'
    : '何时生效：只影响改动之后新产生的声音事件 —— 已经在场的事件保留生成时的范围/强度/寿命';
}

/** 悬浮说明：中文解释 + 真实配置键 + 原始生效说明。 */
export function devBParamTooltip(spec: RuntimeParamSpec): string {
  const help = paramHelp(spec.id);
  const parts = [`${spec.label}（${spec.unit}）`];
  if (help) {
    parts.push(`配置键 ${help.english}`, help.what,
      `调大：${help.increase}`, `调小：${help.decrease}`);
  } else {
    parts.push('配置键 ' + spec.id);
  }
  parts.push(devBParamTimingText(spec), spec.effect);
  return parts.join('｜');
}

/** 参数分组标题旁的简短说明。 */
export const DEV_B_GROUP_HELP: Record<string, string> = {
  抓捕: '贴到多近才算被抓住',
  视觉: '不看遮挡时能看多远',
  听觉: '声音传多远、多响、留多久',
  移动: '角色实际的移动速度',
};

/** 观察分区标题旁的简短说明。 */
export const DEV_B_SECTION_HELP: Record<string, string> = {
  control: '现在谁在控制谁，以及对局进行到哪一步',
  'human-ai': '追你的那个人现在在想什么、目标在哪',
  'deepseek-ai': 'DeepSeek 娘的状态、目标米堆、逃跑与恢复',
  perception: '视线、声音与抓捕的真实判定值',
  movement: '真实移动速度、冲刺与大米进度',
};

export interface ObservationFieldHelp {
  /** 「它是什么」：一句话中文解释。 */
  what: string;
  /** 对应的内部字段，便于对照源码与日志。 */
  field: string;
}

// 键 = `${sectionId}/${标签}`。标签与 `DevBObserver` 保持一致，测试会逐条核对。
const OBSERVATION_HELP: Record<string, ObservationFieldHelp> = {
  'control/对局阶段': { what: '现在处于对局的哪一步', field: 'phase' },
  'control/正式主控阵营': { what: '你选定的正式阵营，决定视角与情报', field: 'playerFaction' },
  'control/当前输入控制': { what: '此刻键盘实际控制哪个角色', field: 'controlledFaction' },
  'control/临时输入目标': { what: 'DEV 临时接管时键盘控制的对象', field: 'temporaryTarget' },
  'control/Human 运行模式': { what: 'Human 由玩家、AI 还是 DEV 接管', field: 'humanAiRunning' },
  'control/DeepSeek 运行模式': { what: 'DeepSeek 由玩家、AI 还是 DEV 接管', field: 'deepseekAiRunning' },

  'human-ai/Human AI': { what: 'Human AI 没有运行时只显示这一条', field: 'humanAi = null' },
  'human-ai/AI 状态': { what: 'Human AI 当前的行为状态', field: 'humanAi.state' },
  'human-ai/当前目标点': { what: '它正在走向哪个坐标', field: 'humanAi.target' },
  'human-ai/目标距离': { what: '它离当前目标还有多远', field: 'humanAi.target' },
  'human-ai/目标房间': { what: '目标所在的房间 ID', field: 'humanAi.targetRoomId' },
  'human-ai/随机状态：搜索房间': { what: '追丢之后随机挑中的搜索房间', field: 'humanAi.searchTargetRoomId' },
  'human-ai/导航目标 / 路径': { what: '寻路结果：共几个节点、走到第几个', field: 'humanAi.pathIndex / pathTotal / pathWaypoint' },
  'human-ai/最近导航原因': { what: '上一次重新规划路线的原因代码', field: 'humanAi.navigationReason' },
  'human-ai/最近切换原因': { what: '上一次切换行为状态的原因代码', field: 'humanAi.transitionReason' },
  'human-ai/卡住检测计时': { what: '控制器内部的卡住计时，面板读不到', field: 'humanAi stuckMs' },
  'human-ai/锁门决策 / 目标门': { what: '它打算绕行、解锁还是强行破门，目标是哪扇门', field: 'humanAi.lockDecision / targetDoorId' },
  'human-ai/决策原因': { what: '上一次锁门或绕行决策的原因代码', field: 'humanAi.decisionReason' },
  'human-ai/AI 破解锁芯进度': { what: '它破解门锁已经花了多久', field: 'humanAi.unlockProgressMs' },
  'human-ai/藏身检查（CHECK_HIDE）': { what: '它是否正在搜查某件家具，以及线索来自哪里', field: 'humanAi.hideSearch.phase / source' },
  'human-ai/AI 已知：米痕线索': { what: '它亲自看见过多少米痕、最近一条多久以前', field: 'humanAi.hideSearch.clueCount / latestClue*' },
  'human-ai/AI 推断：方向 / 置信度': { what: '它用米痕推出的逃跑方向有多可信', field: 'humanAi.hideSearch.inferenceCode / inferenceConfidence' },
  'human-ai/AI 推断：调查锚点': { what: '它打算去调查的那个点', field: 'humanAi.hideSearch.inferenceAnchor' },
  'human-ai/AI 推断：公开依据': { what: '它为什么这样推断（只说公开线索）', field: 'humanAi.hideSearch.inferenceBasis' },
  'human-ai/AI 怀疑家具（公开排序第一）': { what: '它现在最怀疑哪件家具，公开排序如何', field: 'humanAi.hideSearch.suspectedSpotId / candidateRanking' },
  'human-ai/AI 怀疑依据（只用公开线索）': { what: '候选排序的公开得分依据', field: 'humanAi.hideSearch.suspectedBasis' },
  'human-ai/搜查目标家具 / 站位 / 表面': { what: '它要去哪件家具、站在哪、面向哪个表面', field: 'humanAi.hideSearch.spotId / stancePoint / surfacePoint' },
  'human-ai/搜查停留进度': { what: '它在搜查点已经停留了多久（要满 0.9 秒）', field: 'humanAi.hideSearch.dwellRemainingMs / dwellMs' },
  'human-ai/导航终点 / 正式站位 / 实际偏差': { what: '寻路终点（网格吸附点）与真正要站到的位置是否一致；不一致时角色会继续走过去', field: 'humanAi.hideSearch.navGoal / stancePoint / stanceDistance' },
  'human-ai/最终接近 / 正式请求次数 / 计划失效退还配额': { what: '到站后又走了几帧、发出过几次正式请求、地图变化退还过几次配额', field: 'humanAi.hideSearch.approachSteps / requestCount / staleCancels' },
  'human-ai/最近一次判定是否计入正式检查': { what: '只有站位、朝向和几何都成立（合法搜空或搜中）才计入正式检查次数', field: 'humanAi.hideSearch.countsAsFormalCheck' },
  'human-ai/计划瞄点与最终判定点': { what: '计划要瞄的表面点与真正判定用的点是否同一个', field: 'humanAi.lastCheckDetail.plannedSurfacePoint / finalAimPoint' },
  'human-ai/本轮已开始 / 已正式执行 / 本次调查已执行': { what: '本轮开始过几次、真正执行过几次、这次调查共几次', field: 'humanAi.hideSearch.roundAttempts / roundChecks / investigationChecks' },
  'human-ai/本次调查的收尾方式': { what: '上一次搜查是怎么收尾的（搜空 / 超时 / 无路可走等）', field: 'humanAi.hideSearch.investigationEndReason' },
  'human-ai/本次调查已检查家具（上限复用 searchRoomCount）': { what: '这次调查一共搜过哪些家具', field: 'humanAi.hideSearch.investigationChecks / checkedSpotIds' },
  'human-ai/搜查失败记忆与剩余冷却': { what: '搜空过的家具在冷却结束前不会被再搜', field: 'humanAi.hideSearch.cooldowns' },
  'human-ai/最近一次搜查结果': { what: '上一次家具搜查是搜中还是搜空', field: 'humanAi.hideSearch.lastResult / lastResultSpotId' },
  'human-ai/打断搜查的声音明细': { what: '抢占搜查的那条声音是什么类型、多响、还剩多久', field: 'humanAi.lastInterruptSoundType 等' },
  'human-ai/放弃搜查原因': { what: '它为什么放弃这次循迹或搜查', field: 'humanAi.hideSearch.giveUpCode / giveUpDetail' },
  'human-ai/搜查次数：开始 / 命中 / 搜空 / 被抢占': { what: '本轮循迹与搜查的次数统计', field: 'humanAi.hideSearch.startCount 等' },
  'human-ai/开发者真值：权威层判定码（不参与 AI 决策）': { what: '游戏层真正的判定结果，AI 只看得到搜中或搜空', field: 'HumanHideSearchResolution.code' },
  'human-ai/AI 待处理的公开线索（被延后 ≠ 丢弃）': { what: '被更高优先级状态压住的线索，之后还会重评', field: 'humanAi.hideSearch.pendingClue*' },
  'human-ai/Last Seen（公开坐标 / 房间 / 年龄 / 有效性）': { what: '最后一次看到对方的公开位置与是否还有效', field: 'humanAi.lastSeenPublic() / lastSeenRoomGate*' },
  'human-ai/公开候选被排除的原因': { what: '哪些家具因为冷却、已搜查或数据缺失被排除', field: 'humanAi.hideSearch.candidateSkipped' },
  'human-ai/信息归属说明': { what: '本分区里哪些是 AI 已知、哪些是 AI 推断', field: 'DevBHumanHideSearch' },
  'human-ai/DEV 标记图例（信息归属）': { what: '场景里各颜色标记分别代表谁的信息', field: 'DevBView clues 图层' },

  'deepseek-ai/DeepSeek AI': { what: 'DeepSeek AI 没有运行时只显示这一条', field: 'deepseekAi = null' },
  'deepseek-ai/AI 状态': { what: 'DeepSeek 娘当前的行为状态', field: 'deepseekAi.state' },
  'deepseek-ai/当前目标米堆': { what: '它选中的米堆 ID', field: 'deepseekAi.targetRiceId' },
  'deepseek-ai/已选米堆进度': { what: '当前正在吃的那份米', field: 'rice.targetId' },
  'deepseek-ai/选米原因': { what: '为什么选这份米（选择策略代码）', field: 'deepseekAi.selectionReason' },
  'deepseek-ai/导航目标 / 路径': { what: '寻路结果：共几个节点、走到第几个', field: 'deepseekAi.pathIndex / pathTotal / pathWaypoint' },
  'deepseek-ai/最近导航原因': { what: '上一次重新规划路线的原因代码', field: 'deepseekAi.navigationReason' },
  'deepseek-ai/最近切换原因': { what: '上一次切换行为状态的原因代码', field: 'deepseekAi.transitionReason' },
  'deepseek-ai/无移动原因': { what: '它停下来不动的原因代码', field: 'deepseekAi.noMovementReason' },
  'deepseek-ai/卡住检测计时': { what: '控制器内部的卡住计时，面板读不到', field: 'deepseekAi stuckMs' },
  'deepseek-ai/威胁来源 / 等级': { what: '它觉得危险来自哪里、有多危险', field: 'deepseekAi.threatSource / threatLevel' },
  'deepseek-ai/逃跑目标 / 房间': { what: '逃跑时想去的位置与房间', field: 'deepseekAi.escapeTarget / escapeRoomId' },
  'deepseek-ai/冲刺决策': { what: '它是否准备或正在冲刺逃跑', field: 'deepseekAi.sprintDecision' },
  'deepseek-ai/恢复受限原因': { what: '眩晕恢复期间受限的原因代码', field: 'deepseekAi.recoveryBlockReason' },
  'deepseek-ai/安全等待原因 / 剩余（SAFE_WAIT）': { what: '在危险入口前等待的原因与剩余时间', field: 'deepseekAi.safeWaitReason / safeWaitRemainingMs' },
  'deepseek-ai/好奇观察剩余': { what: '对一动不动的 Human 好奇观察的剩余时间', field: 'deepseekAi.curiosityRemainingMs' },
  'deepseek-ai/安全通行中': { what: '是否正在走一条被判定为安全的通道', field: 'deepseekAi.passageActive' },

  'perception/视线状态': { what: '距离与遮挡综合后的真实视线结果', field: 'vision.status / vision.blocker' },
  'perception/目标在真实视觉范围内': { what: '距离与遮挡都通过，才算真的看得见', field: 'vision.visible' },
  'perception/最后一次看到（Last Seen）': { what: '最后一次确认看到对方的位置与时间', field: 'vision.lastSeen' },
  'perception/视觉遮挡几何': { what: '视觉只被墙体与门挡住，家具不参与', field: 'PerceptionGeometry' },
  'perception/最近声音事件': { what: '最近一次被听见（或低于阈值）的声音', field: 'hearing.type / audibleStrength' },
  'perception/声音距离衰减 / 遮挡': { what: '声音走了多远、中间隔了什么（Wall ×1 = 隔 1 面墙）', field: 'hearing.distanceFactor / occlusionMultiplier' },
  'perception/声音方向 / 剩余': { what: '声音相对屏幕的方向，以及还会存在多久', field: 'hearing.direction / remainingMs' },
  'perception/场景内声音事件数': { what: '场上还没有消失的声音事件个数', field: 'sounds.length' },
  'perception/抓捕半径（有效值）': { what: 'DEV-B 覆盖后真正生效的抓捕圈半径', field: 'capture.radius' },
  'perception/实际距离 / 是否在圈内': { what: '两个角色现在的距离，以及是否已经进圈', field: 'capture.distance / insideRadius' },
  'perception/抓捕遮挡': { what: '墙、关着的门或家具挡住了抓捕', field: 'capture.blocked' },
  'perception/抓捕资格': { what: '所有条件都满足、正在累计抓捕进度', field: 'capture.eligible' },
  'perception/累计抓捕进度': { what: '还要贴住多久才算真正抓到', field: 'capture.progressMs / holdMs' },

  'movement/DeepSeek 有效速度': { what: 'DeepSeek 娘此刻真实使用的速度', field: 'movement.playerSpeed' },
  'movement/Human 玩家有效速度': { what: '玩家手里的 Human 此刻真实使用的速度', field: 'movement.humanSpeed' },
  'movement/Human AI 有效速度': { what: 'Human AI 此刻真实使用的速度', field: 'movement.humanAiSpeed' },
  'movement/DeepSeek 位置': { what: 'DeepSeek 娘当前坐标', field: 'deepseek' },
  'movement/Human 位置': { what: 'Human 当前坐标', field: 'human' },
  'movement/冲刺状态': { what: '正常、冲刺中还是摔倒眩晕中', field: 'sprint.state' },
  'movement/冲刺剩余 / 眩晕': { what: '本次冲刺还剩多久、眩晕还剩多久', field: 'sprint.sprintRemainingMs / stunRemainingMs' },
  'movement/冲刺冷却': { what: '距离下次可以冲刺还有多久', field: 'sprint.cooldownRemainingMs' },
  'movement/冲刺风险模式': { what: '这次冲刺会不会以摔倒收场', field: 'sprint.riskMode' },
  'movement/大米进度': { what: '已经吃完的米与总数', field: 'rice.completedCount / total' },
};

export function observationHelp(sectionId: string, label: string):
ObservationFieldHelp | null {
  return OBSERVATION_HELP[`${sectionId}/${label}`] ?? null;
}

export const OBSERVATION_HELP_KEYS: readonly string[] = Object.keys(OBSERVATION_HELP);

// ---------------------------------------------------------------------------
// 内部状态码 → 中文。只收录「类型定义就在源码里、可以逐值核实」的枚举，
// 不猜自由文本原因代码（那些仍原样显示，并在悬浮说明里解释字段含义）。
// ---------------------------------------------------------------------------

export const DEV_B_VALUE_GLOSS: Record<string, Record<string, string>> = {
  phase: {
    FACTION_SELECT: '选择阵营', READY: '准备中', PLAYING: '对局中',
    PAUSED: '已暂停', FINISHED: '已结束',
  },
  faction: { HUMAN: '人类', DEEPSEEK: 'DeepSeek 娘' },
  visionStatus: { VISIBLE: '看得见', BLOCKED: '被挡住', OUT_OF_RANGE: '在视觉距离外',
    CONCEALED: '已藏身（普通视觉看不见）' },
  sprintState: { NORMAL: '正常', SPRINT_RUNNING: '冲刺中', STUNNED: '眩晕中' },
  sprintRisk: { SAFE: '不会摔倒', FALL_ON_END: '冲刺结束会摔倒' },
  humanAiState: {
    PATROL: '巡逻', INVESTIGATE: '去查看声音', CHASE: '追逐',
    CAPTURE: '抓捕', SEARCH: '搜索追丢的目标', CHECK_HIDE: '检查藏身家具（S7C-2 起为真实运行状态）',
  },
  deepseekAiState: {
    SEEK_RICE: '正在找米堆', MOVE_TO_RICE: '走向米堆', EAT: '正在吃米',
    RESELECT: '重新选米堆', EVADE: '逃跑中', RECOVER: '摔倒后恢复',
    SAFE_WAIT: '在危险入口前等待', CURIOUS_APPROACH: '好奇地靠近',
    CURIOUS_OBSERVE: '好奇地观察', CURIOUS_PASSAGE: '好奇地穿过通道',
  },
  humanLockDecision: {
    NONE: '没有锁门计划', DETOUR: '绕路', UNLOCK: '破解锁芯', FORCE_BREAK: '强行破门',
  },
  // S7C-2：Human AI 循迹与藏身搜查的公开状态码。
  traceInference: {
    NO_CLUE: '还没有亲自看到任何米痕', SINGLE_TRACE: '只有一粒米，只能调查附近',
    CHAIN: '连续米痕构成一条路径', TRACE_JUMP: '更早的米痕跳跃过远',
    CHAIN_CONTRADICTORY: '脚印朝向与路径矛盾，可信度已降低',
  },
  traceConfidence: {
    NONE: '无线索', LOW: '低', MEDIUM: '中', HIGH: '高',
  },
  checkHidePhase: {
    NONE: '当前没有在执行搜查', TRAVEL: '正在前往搜查站位',
    DWELL: '正在搜查点停留', DONE: '停留已满，等待正式判定',
  },
  checkHideSource: {
    LAST_SEEN: '来自 Last Seen', SOUND: '来自声音', TRACE: '来自亲自发现的米痕',
    SEARCH: '来自有限搜索的房间',
    LAST_SEEN_ROOM: '来自 Last Seen 所在的同一个房间',
  },
  checkHideResult: { NONE: '还没有结果', HIT: '搜中（发现藏身者）', MISS: '搜空' },
  // S7C-2 修复轮：被延后的公开线索与「最后目击房间」门槛。
  clueDeferReason: {
    NONE: '没有被延后',
    CHECK_HIDE: '正在执行正式家具搜查，线索先记下',
    TARGET_VISIBLE: '当前真实目视目标优先',
    LAST_SEEN: 'Last Seen 证据优先（含正在进行的调查）',
    DANGER_SOUND: '新的强危险声音优先',
    TRACE_INVESTIGATION: '正在执行上一次米痕调查',
  },
  lastSeenRoomGate: {
    NONE: '还没有检查过', OK: '可以用最后目击房间里的公开藏身家具',
    NO_LAST_SEEN: '当前没有 Last Seen', EXPIRED_LAST_SEEN: 'Last Seen 已过期，不再作为证据',
    NO_ROOM: 'Last Seen 坐标不在任何房间内', NO_PUBLIC_SPOT: '最后目击房间里没有公开藏身点',
  },
  threatSource: {
    NONE: '没有察觉威胁', VISION: '看见对方', SOUND: '听见声音',
    LAST_SEEN: '记住的最后位置', MEMORY: '更早的记忆',
  },
  threatLevel: { NONE: '不觉得危险', CAUTION: '有点警觉', HIGH: '认为很危险' },
};

/** 空值/哨兵值统一写成通俗中文。 */
export const DEV_B_PLAIN_NONE = '无（没有特别原因）';

export function isNoneCode(code: string | null | undefined): boolean {
  return code === null || code === undefined || code === '' || code === 'NONE';
}

/**
 * 把内部状态码写成「中文（原代码）」；没有收录的码原样返回，并在悬浮说明里
 * 由字段解释兜底——宁可保留可对照的原代码，也不猜一个可能是错的中文。
 */
export function devBGlossValue(kind: string, code: string | null | undefined): string {
  if (code === null || code === undefined || code === '') return DEV_B_PLAIN_NONE;
  const gloss = DEV_B_VALUE_GLOSS[kind]?.[code];
  return gloss ? `${gloss}（${code}）` : code;
}

/** 原因类自由文本代码：只把哨兵值写成中文，其余保留原代码。 */
export function devBReasonText(kind: string | null, code: string | null | undefined): string {
  if (isNoneCode(code)) return '无（没有触发特殊原因）';
  return kind ? devBGlossValue(kind, code) : String(code);
}

/** 声音事件类型：中文（原代码）。 */
export function devBSoundTypeText(type: string): string {
  const name = SOUND_TYPE_NAMES[type];
  return name ? `${name}（${type}）` : type;
}

export function devBYesNo(value: boolean): string {
  return value ? '是' : '否';
}
