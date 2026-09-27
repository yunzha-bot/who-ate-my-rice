import { GAME_CONFIG } from '../config/gameConfig.ts';

/**
 * S7C-2：Human AI 循迹与藏身搜查用到的**全部内部技术阈值**集中定义处。
 *
 * 这里刻意**只放内部技术阈值**，不放正式玩法平衡值：
 *   - 玩法数值（搜查半径 1.5、张角 120°、停留 900 ms、同家具失败冷却 6 s、
 *     每轮最多 1 件家具）由用户在本轮批准，按项目「统一数值管理规则」写在
 *     `GAME_CONFIG`（`humanSearch` / `humanAI`）里，本文件只**引用**它们。
 *   - 下面这些数字不是新的平衡杠杆，而是「用什么步长采样、多远的米痕还算连续、
 *     最多记多少条线索、一次搜查最多探测几个站位」这类实现细节。它们全部由
 *     现有源码里的真实数值推导而来，每一条都在注释里写明推导依据，并由
 *     `tests/human-search-tuning.test.mjs` 做边界测试。
 *   - 任何一条都不得暗中放大搜查能力、延长米痕寿命或增加 AI 搜查次数。
 */

/** 米痕的相邻判定步数：允许一条线索链跨过的脚印生成步数。 */
export const TRACE_LINK_STEPS = 6;

/**
 * 相邻米痕的连接距离：`traceStepDistance (0.65 u)` × 6 = 3.9 u。
 *
 * 推导：0.65 u 是米痕唯一的实际生成间距；生成窗口只有 5,000 ms，而单个脚印
 * 存活 15,000 ms，所以玩家中途停下再跑时链上必然出现空档，必须允许跨过若干步。
 * 6 步 ≈ 3.9 u 有两条硬上限支撑：① 小于既有 `searchRadius (12 u)` 的三分之一，
 * 因此一条链永远不可能一步跨过整个搜索区；② 等于 `navCellSize (0.4)` 的约 10 格，
 * 与既有寻路的粗粒度一致。
 */
export const TRACE_LINK_DISTANCE =
  GAME_CONFIG.perception.traceStepDistance * TRACE_LINK_STEPS;

/**
 * 推断只使用最近的 N 条线索。
 *
 * 推导：米痕存活 15,000 ms，冲刺极速 6.13 u/s ÷ 0.65 u ≈ 9.4 步/秒，理论上一屏
 * 最多 142 个脚印。推断只需要最近的一小段方向，8 条（≈0.85 秒的连续移动）足以
 * 判断朝向，同时让推断成本与线索总量无关。
 */
export const TRACE_CHAIN_MAX_CLUES = 8;

/** 方向矛盾的判定角：链方向与最新脚印朝向相差超过 90° 即认为相互矛盾。 */
export const TRACE_DIRECTION_CONTRADICTION_DEG = 90;

/** 达到「高」置信度所需的链长度（含最新一条）。 */
export const TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH = 3;

/**
 * 线索记忆容量：最多保存多少条**亲自看到**的米痕线索。
 *
 * 推导：单个脚印存活 15,000 ms；冲刺极速下的最大生成速率约 9.4 步/秒 ⇒ 一条
 * 15 秒的完整痕迹最多约 142 个脚印。取 160 略高于该上界，因此「AI 真的看见过
 * 的痕迹」不会因为容量而被丢弃，同时内存仍有确定上限。
 */
export const CLUE_MEMORY_MAX = 160;

/**
 * 站位采样步长：沿家具可搜查表面的周长采样站位候选。
 *
 * 推导：直接复用 `navCellSize (0.4 u)`——相邻候选因此有机会落在不同导航格上，
 * 又不会让候选数量随家具尺寸爆涨（最大的货架 0.5×2.5 也只有约 15 个候选）。
 */
export const STANCE_SURFACE_STEP = GAME_CONFIG.humanAI.navCellSize;

/**
 * 站位与家具可搜查表面之间保持的间距。
 *
 * 推导：角色碰撞圆半径 0.23 u，`contactEpsilon` 只有 0.0001，所以贴着表面站位
 * 会反复触发接触边界；再留约 0.07 u 余量后取整为 0.30 u。该值必须同时满足两个
 * 既有约束才算合法：① 小于搜查半径 1.5 u（否则永远判 OUT_OF_RANGE）；
 * ② 小于 DEV-A 交互区域的**最小**批准半径 1.2 u，因此「AI 站得住的位置」一定
 * 落在该家具公开的交互区域附近。
 */
export const STANCE_STAND_OFF = 0.3;

/**
 * 一次搜查最多对几个站位候选跑 A*。
 *
 * 推导：与既有 `searchRoomCount (3)` 同量级再放宽到 8，保证家具四周被墙或家具
 * 挡住时必须换边的场景仍有解，同时把一次搜查的寻路调用次数固定在 8 以内。
 */
export const STANCE_MAX_PATH_PROBES = 8;

/** 一次搜查最多依次尝试几个公开候选家具（推导：复用 `searchRoomCount = 3`）。 */
export const CANDIDATE_TRY_LIMIT = GAME_CONFIG.humanAI.searchRoomCount;

/**
 * 同一次调查里最多允许几次「计划失效 → 退还本轮家具配额」。
 *
 * 推导：`PLAN_STALE` 只可能由**外部合法事件**引起（DEV 场景编辑器改变家具、地图应用、
 * 家具被移动 / 旋转 / 删除）。这些事件在一次追丢调查（`searchMaxMs` 15 秒）里通常
 * 发生 0～1 次，给到 2 次足以让 AI 用当前地图合法重规划，同时封死「取消 → 重规划 →
 * 再取消」的无限退款循环：超过上限后本次调查不再退还配额。
 * 该值只限制重规划次数，不放宽任何搜查几何，也不改变「每轮最多正式检查 1 件家具」。
 */
export const STANCE_MAX_STALE_CANCELS = 2;

/** 评分权重：候选家具到 AI 当前位置的距离（每世界单位扣分）。 */
export const CANDIDATE_DISTANCE_WEIGHT = 1;
/** 评分权重：候选家具到「推断调查锚点」的距离（每世界单位扣分，比自身距离更重要）。 */
export const CANDIDATE_ANCHOR_WEIGHT = 2;
/** 线索链在家具公开交互区域内终止时的加分。 */
export const CANDIDATE_TERMINATION_BONUS = 6;
/** 推断方向指向该家具时的加分。 */
export const CANDIDATE_ALIGNMENT_BONUS = 4;
/** Last Seen 落在该家具交互区域内时的加分。 */
export const CANDIDATE_LAST_SEEN_BONUS = 3;
/** 有效声音位置落在该家具交互区域内时的加分。 */
export const CANDIDATE_SOUND_BONUS = 2;

/** 报告 / DEV 用：本轮新增的全部内部技术阈值一览（不参与判定）。 */
export const S7C2_INTERNAL_THRESHOLDS: readonly { id: string; value: number;
  unit: string; derivation: string }[] = [
  { id: 'TRACE_LINK_STEPS', value: TRACE_LINK_STEPS, unit: '步',
    derivation: 'traceStepDistance 的整数倍，覆盖生成窗口空档' },
  { id: 'TRACE_LINK_DISTANCE', value: TRACE_LINK_DISTANCE, unit: '世界单位',
    derivation: 'traceStepDistance 0.65 × 6，小于 searchRadius 的三分之一' },
  { id: 'TRACE_CHAIN_MAX_CLUES', value: TRACE_CHAIN_MAX_CLUES, unit: '条',
    derivation: '约 0.85 秒连续移动的脚印数，足够定方向且成本与总量无关' },
  { id: 'TRACE_DIRECTION_CONTRADICTION_DEG', value: TRACE_DIRECTION_CONTRADICTION_DEG,
    unit: '度', derivation: '超过直角的朝向差即判为相互矛盾' },
  { id: 'TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH', value: TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH,
    unit: '条', derivation: '至少 3 个连续脚印才给「高」置信度' },
  { id: 'CLUE_MEMORY_MAX', value: CLUE_MEMORY_MAX, unit: '条',
    derivation: 'traceLifetimeMs 内极速移动的理论最大脚印数（约 142）向上取整' },
  { id: 'STANCE_SURFACE_STEP', value: STANCE_SURFACE_STEP, unit: '世界单位',
    derivation: '复用 navCellSize，保证相邻候选能落在不同导航格' },
  { id: 'STANCE_STAND_OFF', value: STANCE_STAND_OFF, unit: '世界单位',
    derivation: 'playerRadius 0.23 + 余量，且小于搜查半径 1.5 与最小交互区域半径 1.2' },
  { id: 'STANCE_MAX_PATH_PROBES', value: STANCE_MAX_PATH_PROBES, unit: '个',
    derivation: '一次搜查内 A* 调用次数上限' },
  { id: 'CANDIDATE_TRY_LIMIT', value: CANDIDATE_TRY_LIMIT, unit: '个',
    derivation: '复用 searchRoomCount（3）' },
  { id: 'STANCE_MAX_STALE_CANCELS', value: STANCE_MAX_STALE_CANCELS, unit: '次',
    derivation: '一次调查内允许的「计划失效退还配额」次数上限，防无限退款重规划' },
  { id: 'CANDIDATE_DISTANCE_WEIGHT', value: CANDIDATE_DISTANCE_WEIGHT, unit: '分/世界单位',
    derivation: '候选排序的公开权重' },
  { id: 'CANDIDATE_ANCHOR_WEIGHT', value: CANDIDATE_ANCHOR_WEIGHT, unit: '分/世界单位',
    derivation: '线索锚点比 AI 自身距离更重要' },
  { id: 'CANDIDATE_TERMINATION_BONUS', value: CANDIDATE_TERMINATION_BONUS, unit: '分',
    derivation: '痕迹链在家具交互区域内终止的公开加分' },
  { id: 'CANDIDATE_ALIGNMENT_BONUS', value: CANDIDATE_ALIGNMENT_BONUS, unit: '分',
    derivation: '推断方向指向该家具的公开加分' },
  { id: 'CANDIDATE_LAST_SEEN_BONUS', value: CANDIDATE_LAST_SEEN_BONUS, unit: '分',
    derivation: 'Last Seen 落在交互区域内的公开加分' },
  { id: 'CANDIDATE_SOUND_BONUS', value: CANDIDATE_SOUND_BONUS, unit: '分',
    derivation: '有效声音落在交互区域内的公开加分' },
];
