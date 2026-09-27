import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck }
  from '../src/systems/HumanHideSearchResolution.ts';
import { createWalker } from './human-ai-walk.mjs';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, ROOMS, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 一 / 二 / 三 / 七：真实日志暴露的三类问题的端到端回归。
//
//   §1 被高优先级状态延后的公开米痕线索必须**保留有效期**并在能决策时重评；
//   §2 「最后目击房间」的公开藏身家具必须先于相邻房间进入候选；
//   §3 TRACE 搜空后调查状态 / 目标 / 计数必须正确收尾，且不得绕过每轮 1 件家具。
//
// 全部使用真实地图、真实碰撞、真实导航与真实视觉几何。修复轮 二之后，「走完一次
// 搜查」必须像 ThreeGame 一样真实推进角色（`createWalker`）：站位判定以规划保存的
// 原始 `stancePoint` 为准，导航网格点只是寻路节点。

const trace = (id, x, z, createdAt, dx = 1, dz = 0.2) => ({ id, position: { x, z },
  heading: Math.atan2(dx, dz), createdAt,
  lifetimeMs: GAME_CONFIG.perception.traceLifetimeMs, strength: 1 });
// 客厅里的一段连续米痕，链尾落在客厅纸箱的公开交互区域内。
const CARTON_1 = trace('carton-1', 6.5, 3.5, 100, 1, 0.2);
const CARTON_2 = trace('carton-2', 7.0, 3.6, 200, 1, 0.2);
// 次卧床附近的一段连续米痕，链尾落在次卧床的公开交互区域内。
const BED_1 = trace('bed-1', -12.0, 10.4, 100, -1.2, -0.6);
const BED_2 = trace('bed-2', -13.2, 9.8, 200, -1.2, -0.6);
const LIVING = { x: 2, z: 3 };
const BED_ORIGIN = { x: -12.5, z: 10 };

function harness(origin = LIVING) {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const map = createHumanAiMapSnapshot({
    furniture: FURNITURE, hideSpots: HIDE_SPOTS,
    visionStatus: (from, to, maxRange) => perception.inspectVision(from, to, maxRange).status,
    canOccupyStaticXZ: (x, z, radius, height) =>
      collision.canOccupyStaticXZ(x, z, radius, height),
    playerRadius: GAME_CONFIG.collision.playerRadius,
    actorHeight: GAME_CONFIG.three.actorHeight,
  });
  const ai = new HumanAIController(navigation, ROOMS, DOOR_NODES, () => 0.5, map);
  let clock = 1_000;
  const input = (overrides = {}) => {
    if (overrides.nowMs !== undefined) clock = overrides.nowMs;
    const human = overrides.human
      ? { x: overrides.human.x, z: overrides.human.z }
      : walkerRef ? walkerRef.point() : { x: origin.x, z: origin.z };
    if (walkerRef) walkerRef.set(human);
    return {
      deltaMs: 50, visibleTarget: null, lastSeen: null,
      heard: null, heardDanger: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true, nowMs: clock, visibleTraces: [], ...overrides, human,
    };
  };
  const snap = point => navigation.nearestFree(point, doors.doors) ?? point;
  const sound = (position, type = 'FOOTSTEP') => ({ event: { type, position,
    sourceFaction: 'DEEPSEEK', timestamp: 0, strength: 0.35, lifetimeMs: 1_400 },
    rawStrength: 0.35, distanceFactor: 1, occlusionMultiplier: 1, occlusion: '无遮挡',
    audibleStrength: 0.28, direction: '左前方', remainingMs: 1_150 });
  const env = { ai, collision, navigation, doors, perception, map, input, snap, sound };
  let walkerRef = createWalker(env, origin);
  env.walker = walkerRef;
  env.walk = (overrides = {}, deltaMs = 50) => {
    if (overrides.nowMs === undefined) clock += deltaMs;
    return walkerRef.walk(overrides, deltaMs);
  };
  return env;
}

/** 真实走到 AI 自己的搜查站位并走满 900 ms 停留，返回正式搜查请求。 */
function walkAndDwell(env, overrides = {}, frames = 200) {
  for (let frame = 0; frame < frames; frame++) {
    const command = env.walk({ ...overrides, visibleTraces: overrides.visibleTraces ?? [] });
    if (command.checkHideSpotId) return command.checkHideSpotId;
  }
  return null;
}

/**
 * 走与 ThreeGame.runHumanAiHideCheck() 完全相同的判定接缝：权威判定 → 登记回执。
 * 这一步现在才会计入「真正完成的正式检查」次数。
 */
function resolveAndReport(env, overrides = {}) {
  const stance = env.ai.checkHideStance;
  const resolution = resolveHumanAiHideCheck({
    spotId: env.ai.checkHideSpotId,
    stance: { stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
      headingRad: stance.headingRad },
    humanPosition: env.walker.point(),
    humanHeadingRad: stance.headingRad,
    waypointTolerance: GAME_CONFIG.humanAI.waypointTolerance,
    contactEpsilon: GAME_CONFIG.collision.contactEpsilon,
    furniture: FURNITURE, hideSpots: HIDE_SPOTS,
    readOccupancy: () => ({ concealedSpotId: null }),
    lineBlocked: (a, b) => env.perception.inspectVision(a, b, Number.POSITIVE_INFINITY)
      .status !== 'VISIBLE',
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
    ...overrides,
  });
  if (resolution.executable) {
    env.ai.noteCheckHideResolution({
      spotId: env.ai.checkHideSpotId, result: resolution.hit ? 'HIT' : 'MISS',
      detail: resolution.detail,
      plannedSurfacePoint: resolution.plannedSurfacePoint,
      finalAimPoint: resolution.finalAimPoint,
      aimPointDelta: resolution.aimPointDelta,
      distance: resolution.distance, angleDeltaDeg: resolution.angleDeltaDeg,
      blocked: resolution.blocked,
      countsAsFormalCheck: resolution.countsAsFormalCheck,
    });
  } else if (resolution.cancelKind === 'PLAN_STALE') {
    env.ai.cancelStaleCheckHide(resolution.detail);
  } else {
    env.ai.cancelIncompleteCheckHide(resolution.code, resolution.detail);
  }
  return resolution;
}

test('a public trace chain near the second bed points at hide_second_bed', () => {
  const env = harness(BED_ORIGIN);
  env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 1_000 }));
  assert.equal(env.ai.traceInference.code, 'CHAIN');
  assert.equal(env.ai.traceInference.confidence, 'MEDIUM');
  assert.equal(env.ai.suspectedSpotIds[0], 'hide_second_bed');
  assert.equal(env.ai.checkHideSpotId, 'hide_second_bed');
  assert.equal(env.ai.checkHideSource, 'TRACE');
  // 依据必须说明「最新米痕落在该家具的公开交互区域内」。
  assert.ok(env.ai.candidateRanking.includes('hide_second_bed'));
  const events = env.ai.drainHumanSearchEvents();
  assert.ok(events.some(event => event.type === 'HUMAN_HIDE_SUSPECT'
    && event.data?.candidates?.[0] === 'hide_second_bed'));
});

test('a deferred trace batch keeps its own expiry and is re-evaluated later', () => {
  const env = harness();
  // ① 亲眼看到米痕，但这一帧被真实目视目标占满 → 线索只是被延后。
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2],
    visibleTarget: { x: 4, z: 3 }, nowMs: 1_000 }));
  assert.equal(env.ai.state, 'CHASE');
  assert.equal(env.ai.clueMemory.count(), 2);
  assert.equal(env.ai.pendingClueCount, 2);
  assert.equal(env.ai.pendingClueDeferReason, 'TARGET_VISIBLE');
  assert.equal(env.ai.pendingClueDeferCount, 1);
  assert.equal(env.ai.checkHideStartCount, 0, '被延后时绝不启动搜查');
  // 有效期来自原米痕实体本身：createdAt 200 + 15,000 ms。
  assert.equal(env.ai.pendingClueValidUntilMs, CARTON_2.createdAt +
    GAME_CONFIG.perception.traceLifetimeMs);
  const deferred = env.ai.drainHumanSearchEvents()
    .find(event => event.type === 'HUMAN_CLUE_DEFERRED');
  assert.ok(deferred, '延后必须留下公开事件');
  assert.equal(deferred.data.count, 2);
  assert.equal(deferred.data.deferReason, 'TARGET_VISIBLE');
  // ② 目标持续可见：批次只能等待，绝不每帧重复触发。
  for (let frame = 0; frame < 6; frame++)
    env.ai.update(env.input({ visibleTraces: [], visibleTarget: { x: 4, z: 3 },
      nowMs: 1_050 + frame * 50 }));
  assert.equal(env.ai.checkHideStartCount, 0);
  assert.equal(env.ai.pendingClueDeferCount, 1, '同一个延后原因不得刷屏');
  assert.equal(env.ai.pendingClueReevalCount, 0);
  // ③ 目标不再可见、且没有任何新脚印 → 重评仍然有效的那一批公开线索。
  env.ai.update(env.input({ visibleTraces: [], nowMs: 1_400 }));
  assert.equal(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideSource, 'TRACE');
  assert.equal(env.ai.checkHideSpotId, 'hide_living_carton');
  assert.equal(env.ai.pendingClueReevalCount, 1);
  assert.equal(env.ai.pendingClueCount, 0, '重评之后批次必须出队');
  const reeval = env.ai.drainHumanSearchEvents()
    .find(event => event.type === 'HUMAN_CLUE_REEVALUATED');
  assert.ok(reeval, '重评必须留下公开事件');
  assert.equal(reeval.data.reevalCount, 1);
  // ④ 没有新信息时不得反复重评或反复重规划。
  for (let frame = 0; frame < 10; frame++)
    env.ai.update(env.input({ visibleTraces: [], nowMs: 1_500 + frame * 50 }));
  assert.equal(env.ai.pendingClueReevalCount, 1);
  assert.equal(env.ai.checkHideStartCount, 1);
});

test('a deferred batch is not dropped when the AI sees the target again and loses it', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2], nowMs: 1_000 }));
  assert.equal(env.ai.state, 'CHECK_HIDE', '无人可见时会立刻按线索搜查');
  assert.equal(env.ai.checkHideSpotId, 'hide_living_carton');
  // 重新看到目标 → 中止搜查、正常进入追逐；线索记忆必须保留。
  env.ai.update(env.input({ visibleTarget: { x: 4, z: 3 }, nowMs: 1_100 }));
  assert.equal(env.ai.state, 'CHASE');
  assert.equal(env.ai.checkHidePhase, 'NONE');
  assert.equal(env.ai.checkHideInterruptCount, 1);
  assert.equal(env.ai.clueMemory.count(), 2);
  // 再次失去视线 → 产生新的有效 Last Seen → 进入调查，而不是立刻重搜家具。
  const seen = { position: { x: 4, z: 3 }, timeMs: 1_200 };
  env.ai.update(env.input({ human: { x: 4, z: 3 }, lastSeen: seen, nowMs: 1_200 }));
  assert.equal(env.ai.state, 'INVESTIGATE');
  assert.equal(env.ai.lastTransitionReason, 'LOST_SIGHT');
  assert.equal(env.ai.lastSeenRoomId, 'living');
});

test('a last-seen investigation is never preempted by an older trace batch', () => {
  const env = harness();
  // 先看见客厅米痕但被目视目标占用 → 延后；随后在次卧失去视线。
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2],
    visibleTarget: { x: 4, z: 3 }, nowMs: 1_000 }));
  const seen = { position: { x: -12.5, z: 10 }, timeMs: 1_100 };
  env.ai.update(env.input({ human: seen.position, visibleTarget: { x: 4, z: 3 },
    nowMs: 1_050 }));
  env.ai.update(env.input({ human: seen.position, lastSeen: seen, nowMs: 1_100 }));
  assert.equal(env.ai.state, 'INVESTIGATE');
  assert.equal(env.ai.pendingClueDeferReason,
    'LAST_SEEN', 'Last Seen 证据优先于更早的米痕批次');
  // 走向最后目击点：目标不可见、也没有紧急危险，但 Last Seen 调查优先级更高，
  // 因此米痕批次必须继续等待，同房间覆盖才有机会发生。
  const seenPoint = env.snap(seen.position);
  for (let frame = 0; frame < 3; frame++)
    env.ai.update(env.input({ human: seenPoint, lastSeen: seen, nowMs: 1_200 + frame * 50 }));
  assert.equal(env.ai.state, 'INVESTIGATE');
  assert.equal(env.ai.checkHideStartCount, 0, '不得被旧的米痕批次抢占');
  // 停留结束 → 同房间（次卧）优先，命中 hide_second_bed。
  env.ai.update(env.input({ human: seenPoint, lastSeen: seen,
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs, nowMs: 1_400 }));
  assert.equal(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideSource, 'LAST_SEEN_ROOM');
  assert.equal(env.ai.checkHideSpotId, 'hide_second_bed');
  assert.equal(env.ai.lastSeenRoomGateCode, 'OK');
  assert.equal(env.ai.suspectedSpotIds[0], 'hide_second_bed');
});

test('an expired last seen and expired traces never form an old suspicion', () => {
  const env = harness();
  // ① 米痕过期：被延后的批次过期后只能给出「线索已过期」，绝不启动搜查。
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2],
    visibleTarget: { x: 4, z: 3 }, nowMs: 1_000 }));
  assert.equal(env.ai.pendingClueCount, 2);
  env.ai.update(env.input({ visibleTraces: [], visibleTarget: { x: 4, z: 3 },
    nowMs: 15_300 }));
  assert.equal(env.ai.clueMemory.count(), 0, '米痕到期必须从线索记忆里消失');
  assert.equal(env.ai.pendingClueCount, 0);
  assert.equal(env.ai.checkHideGiveUpCode, 'CLUE_EXPIRED');
  env.ai.update(env.input({ visibleTraces: [], nowMs: 15_400 }));
  assert.equal(env.ai.checkHideStartCount, 0);
  assert.equal(env.ai.state, 'PATROL');
  // ② Last Seen 过期：同房间门槛必须拒绝，不得形成旧怀疑。
  const stale = { position: { x: -12.5, z: 10 }, timeMs: 100 };
  const env2 = harness();
  env2.ai.update(env2.input({ human: stale.position,
    visibleTarget: { x: -12.5, z: 10 }, nowMs: 100 }));
  env2.ai.update(env2.input({ human: env2.snap(stale.position), lastSeen: stale,
    nowMs: 100 }));
  assert.equal(env2.ai.state, 'INVESTIGATE');
  // 8 秒之后同一份 Last Seen 记录不能再作为证据（真实运行时由 VisionSystem 清除，
  // AI 侧必须独立复核，不能依赖「调用方一定传 null」）。
  env2.ai.update(env2.input({ human: env2.snap(stale.position), lastSeen: stale,
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs, nowMs: 8_500 }));
  assert.equal(env2.ai.lastSeenRoomGateCode, 'EXPIRED_LAST_SEEN');
  assert.equal(env2.ai.checkHideGiveUpCode, 'CLUE_EXPIRED');
  assert.equal(env2.ai.checkHideStartCount, 0, '过期的 Last Seen 不得形成旧怀疑');
  assert.notEqual(env2.ai.state, 'CHECK_HIDE');
});

test('a danger sound interrupts a search and records the real sound details', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2], nowMs: 1_000 }));
  assert.equal(env.ai.state, 'CHECK_HIDE');
  // 普通声音只记录，不打断。
  env.ai.update(env.input({ heard: env.sound({ x: 6.5, z: 3.5 }), nowMs: 1_050 }));
  assert.equal(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideInterruptCount, 0);
  // 新的强危险声（沿用现有追捕型声音分类）可以立即打断。
  const danger = env.sound({ x: 6.5, z: 3.5 }, 'SPRINT');
  env.ai.update(env.input({ heardDanger: danger, nowMs: 1_100 }));
  assert.equal(env.ai.state, 'INVESTIGATE');
  assert.equal(env.ai.checkHideInterruptCount, 1);
  assert.equal(env.ai.checkHideGiveUpCode, 'DANGER_SOUND');
  assert.equal(env.ai.lastInterruptSoundType, 'SPRINT');
  assert.equal(env.ai.lastInterruptSoundStrength, danger.audibleStrength);
  assert.equal(env.ai.lastInterruptSoundRemainingMs, danger.remainingMs);
  assert.equal(env.ai.lastInterruptSoundIsNew, true);
  const interrupt = env.ai.drainHumanSearchEvents()
    .find(event => event.type === 'HUMAN_HIDE_SEARCH_INTERRUPT');
  assert.equal(interrupt.data.interruptSoundType, 'SPRINT');
  assert.equal(interrupt.data.interruptSoundStrength, danger.audibleStrength);
  assert.equal(interrupt.data.interruptSoundRemainingMs, danger.remainingMs);
  assert.equal(interrupt.data.interruptSoundIsNew, true);
  assert.equal(interrupt.data.state, 'CHECK_HIDE');
  assert.equal(interrupt.data.investigationSource, 'TRACE');
});

test('a trace miss finishes the action but keeps the approved investigation budget', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2], nowMs: 1_000 }));
  const request = walkAndDwell(env);
  assert.equal(request, 'hide_living_carton');
  // 修复轮 二：REQUEST 本身**不再**提前消耗「真正完成的正式检查」计数；
  // 只有游戏层回执 MISS_EMPTY / HIT_CONCEALED 时才计入。
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  assert.equal(env.ai.checkHideRoundChecks, 0);
  assert.equal(env.ai.checkHideInvestigationChecks, 0);
  assert.equal(env.ai.checkHidePhase, 'DONE');
  // 走与 ThreeGame 相同的接缝：合法搜空才登记成一次正式检查。
  const resolution = resolveAndReport(env);
  assert.equal(resolution.code, 'MISS_EMPTY');
  assert.equal(resolution.executable, true);
  assert.equal(env.ai.checkHideRoundChecks, 1);
  assert.equal(env.ai.checkHideInvestigationChecks, 1);
  env.ai.onCheckHideResult('hide_living_carton', false);
  assert.equal(env.ai.checkHideLastResult, 'MISS');
  assert.equal(env.ai.checkHideMissCount, 1);
  assert.equal(env.ai.state, 'PATROL');
  assert.equal(env.ai.checkHidePhase, 'NONE');
  assert.equal(env.ai.checkHideSpotId, null);
  assert.equal(env.ai.checkHideStance, null);
  assert.equal(env.ai.checkHideInvestigationEndReason, 'CHECK_HIDE_MISS');
  // 搜空：同家具进入 6 秒公开失败冷却，并且本轮配额保持「已用」。
  assert.deepEqual(env.ai.checkHideCooldowns(),
    [{ spotId: 'hide_living_carton',
      remainingMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs }]);
  assert.deepEqual(env.ai.checkHideCheckedSpotIds, ['hide_living_carton']);
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  // 调查级预算保留：这样「同一次调查最多 3 件家具 / 最多 15 秒」仍然成立。
  assert.equal(env.ai.checkHideInvestigationChecks, 1);
  // 同一批线索绝不重开；新的公开线索可以开始新的一轮，但不会重搜冷却中的家具。
  for (let frame = 0; frame < 10; frame++)
    env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2],
      nowMs: 2_000 + frame * 50 }));
  assert.equal(env.ai.checkHideStartCount, 1);
  const extra = trace('carton-3', 7.4, 3.7, 2_600, 1, 0.2);
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2, extra], nowMs: 2_700 }));
  assert.equal(env.ai.checkHideStartCount, 2);
  assert.notEqual(env.ai.checkHideSpotId, 'hide_living_carton');
  assert.ok(env.ai.candidateSkipped.includes('hide_living_carton=COOLDOWN'));
  // 冷却结束后同一件家具可以合法地被重新考虑。
  env.ai.update(env.input({ deltaMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs,
    nowMs: 9_000 }));
  assert.deepEqual(env.ai.checkHideCooldowns(), []);
});

test('a search hit reaches capture through the formal receipt only', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2], nowMs: 1_000 }));
  const request = walkAndDwell(env);
  assert.equal(request, 'hide_living_carton');
  env.ai.onCheckHideResult(request, true);
  assert.equal(env.ai.checkHideLastResult, 'HIT');
  assert.equal(env.ai.checkHideHitCount, 1);
  assert.equal(env.ai.state, 'CAPTURE');
  assert.equal(env.ai.checkHideMissCount, 0);
  assert.deepEqual(env.ai.checkHideCooldowns(), [], '搜中不产生失败冷却');
  // AI 侧结果回执仍然只有一个布尔值：无法从中读出坐标或占用状态。
  assert.equal(HumanAIController.prototype.onCheckHideResult.length, 2);
});

test('interruptions and re-evaluations never loop into duplicate searches or events', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [CARTON_1, CARTON_2], nowMs: 1_000 }));
  let starts = env.ai.checkHideStartCount;
  let events = 0;
  // 反复「看见 → 看不见」：每次看见都中止搜查，但不得产生第二次正式搜查。
  for (let round = 0; round < 8; round++) {
    env.ai.update(env.input({ visibleTarget: { x: 4, z: 3 }, nowMs: 2_000 + round * 200 }));
    env.ai.update(env.input({ visibleTraces: [], nowMs: 2_100 + round * 200 }));
    events += env.ai.drainHumanSearchEvents().length;
    starts = Math.max(starts, env.ai.checkHideStartCount);
  }
  assert.equal(starts, 1, '同一批线索只允许发起一次搜查');
  assert.equal(env.ai.pendingClueReevalCount, 0, '同一批线索已被处理，不得反复重评');
  // 长时间空转也不产生任何事件或重规划。
  let idleEvents = 0;
  for (let frame = 0; frame < 60; frame++) {
    env.ai.update(env.input({ visibleTraces: [], nowMs: 4_000 + frame * 50 }));
    idleEvents += env.ai.drainHumanSearchEvents().length;
  }
  assert.equal(idleEvents, 0, '没有新信息时不得产生任何循迹 / 搜查事件');
  assert.ok(events > 0);
});

test('the delayed-clue mechanism only uses public clue state', () => {
  const source = readFileSync(new URL('../src/systems/HumanAIController.ts',
    import.meta.url), 'utf8');
  // 反作弊红线：决策侧不得出现占用查询 / 真实隐藏状态 / 真实进入位置。
  assert.doesNotMatch(source, /occupancyOf|isConcealed|entryPosition/);
  // 延后与重评机制只使用公开线索记忆与公开有效截止时间。
  assert.match(source, /this\.actedTraceIds/);
  assert.match(source, /clue\.validUntil/);
  // 本轮不新增独立永久脚印系统：没有第二个米痕容器。
  assert.doesNotMatch(source, /new .*Trace(System|Store|Memory)\(/);
});
