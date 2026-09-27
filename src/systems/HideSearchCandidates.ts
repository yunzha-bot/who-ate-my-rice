import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { LastSeen } from './PerceptionSystem.ts';
import type { TraceClue } from './RiceTraceClues.ts';
import type { TraceInference } from './HumanTraceTracking.ts';
import { pointInHideRegion, hideRegionSetup } from '../three/map/HideInteractionRegion.ts';
import { rectSurfacePoint } from '../three/map/RotatedRect.ts';
import type { HideSpot, Point, Rect, Room } from '../three/map/apartmentMap.ts';
import { CANDIDATE_ALIGNMENT_BONUS, CANDIDATE_ANCHOR_WEIGHT,
  CANDIDATE_DISTANCE_WEIGHT, CANDIDATE_LAST_SEEN_BONUS, CANDIDATE_SOUND_BONUS,
  CANDIDATE_TERMINATION_BONUS } from './HumanSearchTuning.ts';

/**
 * S7C-2：公开家具候选的生成与排序 —— 纯逻辑。
 *
 * 反作弊边界（结构上保证，而不是靠调用方自觉）：本模块的输入里**没有**任何
 * `HideSystem.occupancyOf()`、真实藏身目标 ID、隐藏时 DeepSeek 实时坐标、占用
 * 状态或开发者专用真值字段。候选只来自：
 *   - 当前已应用地图的公开藏身点 ID 与其绑定家具（位置 / 朝向 / 尺寸）；
 *   - 已知 Last Seen；
 *   - Human AI 亲自发现的米痕线索；
 *   - Human AI 实际接收到的声音事件位置；
 *   - 自己已经搜查失败的历史。
 * 因为占用信息根本不在这条数据通路上，所以「某件家具真的有人」不可能提高它的
 * 排序——即使有人，排序也完全由公开线索决定。
 *
 * 排序规则统一、确定、可解释：分数相同就按距离、再按稳定 ID，绝不使用随机数。
 */
export interface HideSearchCandidate {
  spotId: string;
  furnitureId: string;
  label: string;
  roomId: string;
  /** AI 当前位置到该家具可接近表面的距离（世界单位）。 */
  distance: number;
  /** 推断锚点到该家具可接近表面的距离（没有锚点时为 null）。 */
  anchorDistance: number | null;
  score: number;
  /** 公开依据（中文），DEV 与 AI JSON 直接展示。 */
  basis: string[];
}

export type HideSearchSkipReason = 'COOLDOWN' | 'ALREADY_CHECKED' | 'NO_FURNITURE'
  | 'NO_REGION';

export interface HideSearchCandidateReport {
  candidates: HideSearchCandidate[];
  skipped: readonly { spotId: string; reason: HideSearchSkipReason }[];
  /** 公开排序依据的汇总（用于 DEV 展示）。 */
  rankingBasis: readonly string[];
}

export interface HideSearchCandidateInput {
  /** 当前已应用地图的公开藏身点。 */
  spots: readonly HideSpot[];
  /** 当前已应用地图的公开家具。 */
  furniture: readonly Rect[];
  /** Human AI 当前真实位置。 */
  origin: Point;
  /** Human AI 亲自发现的米痕线索（图层 C）。 */
  clues: readonly TraceClue[];
  /** 由公开线索算出的推断。 */
  inference: TraceInference;
  /** 已知 Last Seen（公开记忆）。 */
  lastSeen: LastSeen | null;
  /** 实际收到的声音事件位置（公开）。 */
  heard: { position: Point; type: string } | null;
  /** 该家具还剩多少搜查失败冷却；> 0 表示这轮不能选它。 */
  cooldownRemainingMs: (spotId: string) => number;
  /** 本次调查里已经正式搜查过的家具（含搜空的）。 */
  checked: ReadonlySet<string>;
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

function angleBetweenDeg(a: Point, b: Point): number {
  const lengthA = Math.hypot(a.x, a.z);
  const lengthB = Math.hypot(b.x, b.z);
  if (lengthA < 1e-9 || lengthB < 1e-9) return 0;
  const dot = (a.x * b.x + a.z * b.z) / (lengthA * lengthB);
  return Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
}

/**
 * 「线索够不够强，可以正式开始搜查某件家具」的公开门槛。
 *
 * 存在的理由（用户批准的规则）：「不能凭一粒米精确锁定藏身家具」。因此
 *   - 需要至少两粒**连续**米痕（`CHAIN` / `TRACE_JUMP`）才构成一张可搜查的路径；
 *   - 如果只有一粒米，必须再有一条**独立的公开线索**（Last Seen 或实际听到的
 *     声音）落在某件家具的公开交互区域内，否则只去痕迹附近调查，不锁定家具；
 *   - 朝向与路径相互矛盾的痕迹（`CHAIN_CONTRADICTORY`）不足以搜查家具。
 * 判定只用公开数据，且完全确定（同输入同输出）。
 */
export type SuspectGateCode = 'OK' | 'NO_CLUE' | 'SINGLE_TRACE_NO_EXTRA_CLUE'
  | 'CONTRADICTORY';

export interface SuspectGateInput {
  inference: TraceInference;
  lastSeen: LastSeen | null;
  heard: { position: Point; type: string } | null;
  spots: readonly HideSpot[];
  furniture: readonly Rect[];
}

export interface SuspectGateResult {
  ok: boolean;
  code: SuspectGateCode;
  detail: string;
  /** 有独立公开线索落进其交互区域的家具（公开 ID）。 */
  extraClueSpotIds: readonly string[];
}

export function gateHideSearchByClues(input: SuspectGateInput): SuspectGateResult {
  const extraClueSpotIds: string[] = [];
  for (const spot of input.spots) {
    const setup = hideRegionSetup(spot, input.furniture);
    if (!setup) continue;
    const seen = input.lastSeen && pointInHideRegion(setup.geometry, input.lastSeen.position);
    const heard = input.heard && pointInHideRegion(setup.geometry, input.heard.position);
    if (seen || heard) extraClueSpotIds.push(spot.id);
  }
  const inference = input.inference;
  if (inference.code === 'NO_CLUE' || !inference.anchor) {
    return { ok: false, code: 'NO_CLUE', detail: '没有任何米痕线索', extraClueSpotIds };
  }
  if (inference.code === 'CHAIN_CONTRADICTORY') {
    return { ok: false, code: 'CONTRADICTORY',
      detail: '脚印朝向与路径矛盾，不足以搜查家具', extraClueSpotIds };
  }
  if (inference.code === 'SINGLE_TRACE' && extraClueSpotIds.length === 0) {
    return { ok: false, code: 'SINGLE_TRACE_NO_EXTRA_CLUE',
      detail: '只有一粒米，不能凭它锁定藏身家具', extraClueSpotIds };
  }
  return { ok: true, code: 'OK',
    detail: inference.code === 'SINGLE_TRACE'
      ? `单一米痕 + 独立公开线索（${extraClueSpotIds.join('、')}）`
      : `连续米痕链（${inference.chain.length} 粒）`,
    extraClueSpotIds };
}

/**
 * S7C-2 修复轮：**「最后目击房间」里的公开藏身家具**能不能进入候选。
 *
 * 动机（真实日志暴露的覆盖缺口）：原来的有限 SEARCH 刻意排除了 Last Seen 所在
 * 房间，只搜「附近相连房间」，于是「刚在这个房间里失去视线」这一最强公开线索
 * 反而用不上。这里不新增玩法数值，只是把**同房间**这一条公开依据显式化：
 *   - Last Seen 必须仍然有效（沿用 `perception.lastSeenMs` 8 秒，不延长）；
 *   - 该坐标必须落在某个真实房间内（公开房间矩形）；
 *   - 该房间里必须真的有公开藏身点。
 * 三项都成立也只是「可以进入候选」，仍然要走候选排序、门槛、合法站位与可达性。
 */
export type LastSeenRoomGateCode = 'OK' | 'NO_LAST_SEEN' | 'EXPIRED_LAST_SEEN' | 'NO_ROOM'
  | 'NO_PUBLIC_SPOT';

export interface LastSeenRoomGateResult {
  ok: boolean;
  code: LastSeenRoomGateCode;
  /** Last Seen 所在的公开房间（公开地图数据）。 */
  roomId: string | null;
  /** 该房间里的公开藏身点 ID。 */
  spotIds: readonly string[];
  detail: string;
}

export function gateLastSeenRoomSearch(input: {
  lastSeen: LastSeen | null;
  /** 与 Last Seen 同一个正式玩法时钟的当前时刻。 */
  nowMs: number;
  lastSeenMs: number;
  /** Last Seen 坐标所属的公开房间（调用方用公开房间矩形求得）。 */
  room: Room | null;
  spots: readonly HideSpot[];
}): LastSeenRoomGateResult {
  if (!input.lastSeen) {
    return { ok: false, code: 'NO_LAST_SEEN', roomId: input.room?.id ?? null, spotIds: [],
      detail: '当前没有有效的 Last Seen' };
  }
  const ageMs = Math.max(0, input.nowMs - input.lastSeen.timeMs);
  if (ageMs >= input.lastSeenMs) {
    return { ok: false, code: 'EXPIRED_LAST_SEEN', roomId: input.room?.id ?? null, spotIds: [],
      detail: `Last Seen 已过去 ${(ageMs / 1000).toFixed(1)} 秒，超过 ` +
        `${(input.lastSeenMs / 1000).toFixed(0)} 秒，不再是有效证据` };
  }
  if (!input.room) {
    return { ok: false, code: 'NO_ROOM', roomId: null, spotIds: [],
      detail: 'Last Seen 坐标不在任何已知房间内' };
  }
  const spotIds = input.spots.filter(spot => spot.roomId === input.room!.id)
    .map(spot => spot.id);
  if (!spotIds.length) {
    return { ok: false, code: 'NO_PUBLIC_SPOT', roomId: input.room.id, spotIds: [],
      detail: `最后目击房间 ${input.room.id} 里没有公开藏身点` };
  }
  return { ok: true, code: 'OK', roomId: input.room.id, spotIds,
    detail: `最后目击房间 ${input.room.id} 里有公开藏身点：${spotIds.join('、')}` };
}

export function rankHideSearchCandidates(input: HideSearchCandidateInput):
HideSearchCandidateReport {
  const candidates: HideSearchCandidate[] = [];
  const skipped: { spotId: string; reason: HideSearchSkipReason }[] = [];
  const anchor = input.inference.anchor;
  const newestClue = input.clues.length ? input.clues[input.clues.length - 1] : null;
  const rankingBasis: string[] = [];

  for (const spot of input.spots) {
    if (input.checked.has(spot.id)) {
      skipped.push({ spotId: spot.id, reason: 'ALREADY_CHECKED' });
      continue;
    }
    if (input.cooldownRemainingMs(spot.id) > 0) {
      skipped.push({ spotId: spot.id, reason: 'COOLDOWN' });
      continue;
    }
    const setup = hideRegionSetup(spot, input.furniture);
    if (!setup) {
      skipped.push({ spotId: spot.id, reason: 'NO_FURNITURE' });
      continue;
    }
    const surface = rectSurfacePoint(setup.furniture, input.origin);
    const ownDistance = distance(input.origin, surface);
    const anchorDistance = anchor ? distance(anchor, surface) : null;
    const basis: string[] = [];
    let score = -CANDIDATE_DISTANCE_WEIGHT * ownDistance;
    basis.push(`距 AI ${ownDistance.toFixed(2)} 世界单位（扣 ${ownDistance.toFixed(2)} 分）`);
    if (anchorDistance !== null) {
      score -= CANDIDATE_ANCHOR_WEIGHT * anchorDistance;
      basis.push(`距线索锚点 ${anchorDistance.toFixed(2)} 世界单位` +
        `（扣 ${(CANDIDATE_ANCHOR_WEIGHT * anchorDistance).toFixed(2)} 分）`);
    }

    // 「痕迹在家具附近终止」：直接复用 DEV-A 已批准的公开交互区域几何判定，
    // 不新建第二套「附近」规则。
    const terminatedAt = newestClue && pointInHideRegion(setup.geometry, newestClue.position);
    if (terminatedAt) {
      score += CANDIDATE_TERMINATION_BONUS;
      basis.push(`最新米痕落在该家具的公开交互区域内（+${CANDIDATE_TERMINATION_BONUS} 分）`);
    }
    if (anchor && input.inference.direction) {
      const toFurniture = { x: setup.geometry.centre.x - anchor.x,
        z: setup.geometry.centre.z - anchor.z };
      const alignment = angleBetweenDeg(input.inference.direction, toFurniture);
      if (alignment <= GAME_CONFIG.humanSearch.halfAngleDeg) {
        score += CANDIDATE_ALIGNMENT_BONUS;
        basis.push(`推断方向指向该家具（偏差 ${alignment.toFixed(0)}°，` +
          `在搜查张角内，+${CANDIDATE_ALIGNMENT_BONUS} 分）`);
      }
    }
    if (input.lastSeen && pointInHideRegion(setup.geometry, input.lastSeen.position)) {
      score += CANDIDATE_LAST_SEEN_BONUS;
      basis.push(`Last Seen 落在该家具的公开交互区域内（+${CANDIDATE_LAST_SEEN_BONUS} 分）`);
    }
    if (input.heard && pointInHideRegion(setup.geometry, input.heard.position)) {
      score += CANDIDATE_SOUND_BONUS;
      basis.push(`有效声音落在该家具的公开交互区域内（+${CANDIDATE_SOUND_BONUS} 分）`);
    }
    candidates.push({ spotId: spot.id, furnitureId: spot.furnitureId, label: spot.label,
      roomId: spot.roomId, distance: ownDistance, anchorDistance, score, basis });
  }

  candidates.sort((a, b) => b.score - a.score || a.distance - b.distance ||
    (a.spotId < b.spotId ? -1 : a.spotId > b.spotId ? 1 : 0));
  if (anchor) {
    rankingBasis.push(`推断锚点 (${anchor.x.toFixed(2)}, ${anchor.z.toFixed(2)})，` +
      `置信度 ${input.inference.confidence}（${input.inference.code}）`);
  } else {
    rankingBasis.push('当前没有米痕锚点，仅按公开距离排序');
  }
  rankingBasis.push(`公开候选 ${candidates.length} 个，已排除 ${skipped.length} 个` +
    `（失败冷却 / 已搜查 / 家具缺失）`);
  if (candidates.length) {
    rankingBasis.push('排序：分数高→低，同分比距离，再比稳定 ID');
  }
  return { candidates, skipped, rankingBasis };
}
