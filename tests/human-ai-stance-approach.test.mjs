import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';
import { planHideSearchStance } from '../src/systems/HumanHideSearchStance.ts';
import { STANCE_MAX_STALE_CANCELS } from '../src/systems/HumanSearchTuning.ts';
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck }
  from '../src/systems/HumanHideSearchResolution.ts';
import { buildDevBObservation } from '../src/systems/DevBObserver.ts';
import { createWalker } from './human-ai-walk.mjs';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, ROOMS, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 二：Human AI「导航终点 → 最终接近原始 stancePoint → 站位成立才 DWELL →
// 只发一次正式 REQUEST → 正式解析 → 搜中 / 合法搜空」的**真实执行链**。
//
// 为什么必须真实走：最新 v1.4 真实日志里三次怀疑次卧床、三次进入 DWELL、三次发出
// REQUEST，却三次都得到 STANCE_LOST。根因是「A* 吸附网格点」与「正式判定用的原始
// stancePoint」是两个不同的中心：控制器按吸附点判到站，权威层按原始点判站位。
// 因此本文件的角色位移**全部经过真实 `CollisionWorld`**（`createWalker`），
// 不靠瞬移到精确目标位置来「证明」真实导航行为。

const trace = (id, x, z, createdAt, dx = 1, dz = 0.2) => ({ id, position: { x, z },
  heading: Math.atan2(dx, dz), createdAt,
  lifetimeMs: GAME_CONFIG.perception.traceLifetimeMs, strength: 1 });
// 客厅纸箱附近 / 次卧床附近的连续米痕（都由真实候选排序指向对应家具）。
const CARTON_1 = trace('carton-1', 6.5, 3.5, 100, 1, 0.2);
const CARTON_2 = trace('carton-2', 7.0, 3.6, 200, 1, 0.2);
const BED_1 = trace('bed-1', -12.0, 10.4, 100, -1.2, -0.6);
const BED_2 = trace('bed-2', -13.2, 9.8, 200, -1.2, -0.6);
// 全部是真实地图上「可站立」的起点（碰撞体内部的坐标不能用来走图）。
const LIVING_ORIGIN = { x: 2, z: 3 };
const BED_ORIGIN = { x: -11, z: 11 };

function harness(origin) {
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
      : walkerRef ? walkerRef.point() : { ...origin };
    if (walkerRef) walkerRef.set(human);
    return { deltaMs: 50, visibleTarget: null, lastSeen: null, heard: null,
      heardDanger: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true, nowMs: clock, visibleTraces: [], ...overrides, human };
  };
  const lineBlocked = (a, b) => perception.inspectVision(a, b, Number.POSITIVE_INFINITY)
    .status !== 'VISIBLE';
  const stanceWorld = {
    standable: point => collision.canOccupyStaticXZ(point.x, point.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight),
    navigationCell: point => navigation.nearestFree(point, doors.doors),
    pathNodes: point => navigation.findPath(origin, point, doors.doors)?.length ?? null,
    lineBlocked,
  };
  const env = { ai, collision, navigation, doors, perception, map, input, lineBlocked,
    stanceWorld };
  let walkerRef = createWalker(env, origin);
  env.walker = walkerRef;
  env.walk = (overrides = {}, deltaMs = 50) => {
    if (overrides.nowMs === undefined) clock += deltaMs;
    return walkerRef.walk(overrides, deltaMs);
  };
  return env;
}

/** 真实走到规划站位并走满 900 ms 停留；返回正式搜查请求的藏身点。 */
function walkToCheck(env, frames = 400) {
  for (let frame = 0; frame < frames; frame++) {
    const command = env.walk({ visibleTraces: [] });
    if (command.checkHideSpotId) return command.checkHideSpotId;
  }
  return null;
}

/**
 * 与 ThreeGame.runHumanAiHideCheck() 逐项对应的判定接缝：
 * 公开几何先判 → 未完成就取消（不退配额）→ 完成才登记正式检查并回执给 AI。
 */
function runFormalCheck(env, occupied) {
  const stance = env.ai.checkHideStance;
  const spotId = env.ai.checkHideSpotId;
  const resolution = resolveHumanAiHideCheck({
    spotId,
    stance: { stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
      headingRad: stance.headingRad },
    humanPosition: env.walker.point(),
    // ThreeGame 用的是 AI 逐帧写入的真实朝向；AI 在停留期间显式命令该朝向。
    humanHeadingRad: stance.headingRad,
    waypointTolerance: GAME_CONFIG.humanAI.waypointTolerance,
    contactEpsilon: GAME_CONFIG.collision.contactEpsilon,
    furniture: FURNITURE, hideSpots: HIDE_SPOTS,
    readOccupancy: () => ({ concealedSpotId: occupied }),
    lineBlocked: env.lineBlocked,
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
  });
  if (!resolution.executable) {
    if (resolution.cancelKind === 'PLAN_STALE') env.ai.cancelStaleCheckHide(resolution.detail);
    else env.ai.cancelIncompleteCheckHide(resolution.code, resolution.detail);
    return resolution;
  }
  env.ai.noteCheckHideResolution({
    spotId, result: resolution.hit ? 'HIT' : 'MISS', detail: resolution.detail,
    plannedSurfacePoint: resolution.plannedSurfacePoint,
    finalAimPoint: resolution.finalAimPoint, aimPointDelta: resolution.aimPointDelta,
    distance: resolution.distance, angleDeltaDeg: resolution.angleDeltaDeg,
    blocked: resolution.blocked, countsAsFormalCheck: resolution.countsAsFormalCheck,
  });
  env.ai.onCheckHideResult(spotId, resolution.hit);
  return resolution;
}

test('reaching the navigation cell alone is not a legal stance (the real 0.313 u gap)', () => {
  const env = harness(LIVING_ORIGIN);
  // 真实规划器给出的主卧床站位：它的**导航吸附点**与站位本身相差 0.313 世界单位，
  // 明显大于 waypointTolerance（0.25）。这正是真实日志里 STANCE_LOST 的几何来源。
  const mainBed = FURNITURE.find(rect => rect.id === 'main_bed');
  const plan = planHideSearchStance('hide_main_bed', mainBed, LIVING_ORIGIN,
    env.stanceWorld);
  assert.equal(plan.code, 'READY');
  const snapGap = Math.hypot(plan.stance.navigationCell.x - plan.stance.stancePoint.x,
    plan.stance.navigationCell.z - plan.stance.stancePoint.z);
  assert.ok(snapGap > GAME_CONFIG.humanAI.waypointTolerance + 1e-9,
    `构造样本必须真的错位：吸附点偏差 ${snapGap}`);
  assert.ok(Math.abs(snapGap - 0.313) < 0.01, `真实测量值应当稳定：${snapGap}`);

  // 让 AI 真实进入 CHECK_HIDE（次卧床的坐标在这条测试里无所谓，站位的来源才是关键）。
  env.walk({ visibleTraces: [CARTON_1, CARTON_2] });
  assert.equal(env.ai.state, 'CHECK_HIDE');
  // 场景布置：把「真实规划出来的 main_bed 站位」交给控制器，并把角色放在吸附点上。
  env.ai.checkHideStance = plan.stance;
  env.ai.checkHideSpotId = 'hide_main_bed';
  env.ai.checkHidePhase = 'TRAVEL';
  env.ai.target = { ...plan.stance.stancePoint };
  env.walker.set(plan.stance.navigationCell);

  const command = env.walk({ visibleTraces: [] });
  assert.notEqual(env.ai.checkHidePhase, 'DWELL',
    '只走到导航吸附点绝不能算合法站位（这正是被修掉的故障）');
  assert.equal(env.ai.checkHideApproachSteps, 1, '必须进入最终接近阶段');
  assert.ok(Math.hypot(command.direction.x, command.direction.z) > 0,
    '最终接近必须真的给出移动方向');
  // 方向必须指向**原始 stancePoint**（而不是回到吸附点）。
  const toStance = { x: plan.stance.stancePoint.x - plan.stance.navigationCell.x,
    z: plan.stance.stancePoint.z - plan.stance.navigationCell.z };
  const toStanceLength = Math.hypot(toStance.x, toStance.z);
  const dot = (command.direction.x * toStance.x + command.direction.z * toStance.z) /
    toStanceLength;
  assert.ok(dot > 0.999, `最终接近方向必须指向原始站位：dot=${dot}`);
  // 继续走：必须真的走到规划站位，然后才开始 900 ms 停留。
  const request = walkToCheck(env);
  assert.equal(request, 'hide_main_bed');
  assert.ok(env.ai.checkHideApproachSteps >= 1, '必须真的走过一段最终接近');
  assert.ok(env.ai.checkHideStanceDistance <=
    GAME_CONFIG.humanAI.waypointTolerance + GAME_CONFIG.collision.contactEpsilon,
    `最终必须满足正式站位条件：${env.ai.checkHideStanceDistance}`);
  assert.equal(env.ai.checkHideRequestCount, 1);
});

test('a concealed second bed is flushed through the real walk and the formal seam', () => {
  const env = harness(BED_ORIGIN);
  env.walk({ visibleTraces: [BED_1, BED_2] });
  assert.equal(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideSpotId, 'hide_second_bed');
  assert.equal(env.ai.checkHidePhase, 'TRAVEL');
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  assert.equal(env.ai.checkHideRoundChecks, 0);

  const request = walkToCheck(env);
  assert.equal(request, 'hide_second_bed');
  assert.equal(env.ai.checkHidePhase, 'DONE');
  assert.equal(env.ai.checkHideRequestCount, 1, '一个动作只允许发一次正式请求');
  // 请求之后不会重复请求。
  for (let frame = 0; frame < 5; frame++) {
    assert.equal(env.walk({ visibleTraces: [] }).checkHideSpotId, null);
  }
  assert.equal(env.ai.checkHideRequestCount, 1);
  // REQUEST 本身不计入「真正完成的正式检查」。
  assert.equal(env.ai.checkHideRoundChecks, 0);
  assert.equal(env.ai.checkHideInvestigationChecks, 0);

  const resolution = runFormalCheck(env, 'hide_second_bed');
  assert.equal(resolution.code, 'HIT_CONCEALED');
  assert.equal(resolution.hit, true);
  assert.equal(resolution.countsAsFormalCheck, true);
  assert.equal(env.ai.checkHideLastResult, 'HIT');
  assert.equal(env.ai.checkHideHitCount, 1);
  assert.equal(env.ai.checkHideMissCount, 0);
  assert.equal(env.ai.state, 'CAPTURE', '搜中必须进入既有抓捕状态');
  assert.equal(env.ai.checkHideRoundChecks, 1);
  assert.equal(env.ai.checkHideInvestigationChecks, 1);
  assert.deepEqual(env.ai.checkHideCooldowns(), [], '搜中不产生家具失败冷却');
  const events = env.ai.drainHumanSearchEvents();
  const resolve = events.find(event => event.type === 'HUMAN_HIDE_SEARCH_RESOLVE');
  assert.ok(resolve, '正式判定必须留下公开事件');
  assert.equal(resolve.data.countsAsFormalCheck, true);
  assert.ok(typeof resolve.data.stanceDistance === 'number');
  assert.ok(resolve.data.requestPosition, '必须记录 REQUEST 时的实际位置');
  assert.ok(resolve.data.navGoal, '必须记录导航终点');
  assert.equal(resolve.data.requestCount, 1);
});

test('a legally-checked empty bed records a miss and starts the 6 s furniture cooldown', () => {
  const env = harness(BED_ORIGIN);
  env.walk({ visibleTraces: [BED_1, BED_2] });
  assert.equal(walkToCheck(env), 'hide_second_bed');
  const resolution = runFormalCheck(env, null);
  assert.equal(resolution.code, 'MISS_EMPTY');
  assert.equal(resolution.executable, true);
  assert.equal(resolution.countsAsFormalCheck, true);
  assert.equal(env.ai.checkHideLastResult, 'MISS');
  assert.equal(env.ai.checkHideMissCount, 1);
  assert.equal(env.ai.state, 'PATROL');
  assert.deepEqual(env.ai.checkHideCooldowns(),
    [{ spotId: 'hide_second_bed',
      remainingMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs }]);
  assert.deepEqual(env.ai.checkHideCheckedSpotIds, ['hide_second_bed']);
  assert.equal(env.ai.checkHideRoundChecks, 1);
  assert.equal(env.ai.checkHideInvestigationChecks, 1);
  // 冷却按正式玩法时间递减。
  env.ai.update(env.input({ deltaMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs }));
  assert.deepEqual(env.ai.checkHideCooldowns(), []);
});

test('during the dwell the AI does not drift and keeps facing the planned surface', () => {
  const env = harness(LIVING_ORIGIN);
  env.walk({ visibleTraces: [CARTON_1, CARTON_2] });
  // 走到 DWELL 开始的那一帧。
  let guard = 0;
  while (env.ai.checkHidePhase !== 'DWELL' && guard++ < 400) env.walk({ visibleTraces: [] });
  assert.equal(env.ai.checkHidePhase, 'DWELL');
  const stance = env.ai.checkHideStance;
  const hover = env.walker.point();
  const distanceToStance = Math.hypot(hover.x - stance.stancePoint.x,
    hover.z - stance.stancePoint.z);
  assert.ok(distanceToStance <= GAME_CONFIG.humanAI.waypointTolerance +
    GAME_CONFIG.collision.contactEpsilon, 'DWELL 只能在站位成立后开始');
  // 停留期间：命令方向恒为零、角色位置一帧都不移动、朝向保持规划朝向。
  for (let frame = 0; frame < 10; frame++) {
    const command = env.walk({ visibleTraces: [] });
    if (command.checkHideSpotId) break;
    assert.equal(command.direction.x, 0, '停留期间不得主动移动');
    assert.equal(command.direction.z, 0);
    assert.equal(command.faceHeadingRad, stance.headingRad, '必须保持规划朝向');
    const now = env.walker.point();
    assert.equal(now.x, hover.x);
    assert.equal(now.z, hover.z);
  }
});

test('an incomplete formal check cancels without a miss, a cooldown or a refunded attempt', () => {
  const env = harness(BED_ORIGIN);
  env.walk({ visibleTraces: [BED_1, BED_2] });
  assert.equal(walkToCheck(env), 'hide_second_bed');
  // 场景布置：REQUEST 时角色没站到正式站位上（偏 0.9 u，超过容差）。
  const stance = env.ai.checkHideStance;
  const original = env.walker.point();
  env.walker.set({ x: stance.stancePoint.x + 0.9, z: stance.stancePoint.z });
  const resolution = runFormalCheck(env, 'hide_second_bed');
  assert.equal(resolution.code, 'STANCE_LOST');
  assert.equal(resolution.executable, false);
  assert.equal(resolution.cancelKind, 'INCOMPLETE');
  // 未完成合法检查：不记搜空、不进 6 秒冷却、不计入正式检查。
  assert.equal(env.ai.checkHideMissCount, 0);
  assert.deepEqual(env.ai.checkHideCooldowns(), []);
  assert.deepEqual(env.ai.checkHideCheckedSpotIds, []);
  assert.equal(env.ai.checkHideRoundChecks, 0);
  assert.equal(env.ai.checkHideInvestigationChecks, 0);
  assert.equal(env.ai.checkHideLastResult, 'NONE');
  assert.equal(env.ai.state, 'PATROL');
  assert.equal(env.ai.checkHideInvestigationEndReason, 'STANCE_LOST_CANCELLED');
  // 尝试配额**不退还**：不可能靠反复取消绕过「每轮最多 1 件家具」。
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  // 同一批线索不得因此重新发起一次搜查（不会形成无限重规划）。
  for (let frame = 0; frame < 20; frame++) {
    env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 3_000 + frame * 50 }));
  }
  assert.equal(env.ai.checkHideStartCount, 1);
  const cancel = env.ai.drainHumanSearchEvents()
    .find(event => event.type === 'HUMAN_HIDE_SEARCH_CANCEL');
  assert.ok(cancel, '取消必须留下公开事件');
  assert.equal(cancel.data.incompleteCode, 'STANCE_LOST');
  // 角色位置没有被偷偷改写（测试自己摆放的位置就是真实位置）。
  assert.deepEqual(env.walker.point(), { x: stance.stancePoint.x + 0.9,
    z: stance.stancePoint.z });
  assert.notDeepEqual(env.walker.point(), original);
});

test('the plan-stale refund is bounded so cancellation can never loop forever', () => {
  const env = harness(BED_ORIGIN);
  env.walk({ visibleTraces: [BED_1, BED_2] });
  assert.equal(walkToCheck(env), 'hide_second_bed');
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  // 前 STANCE_MAX_STALE_CANCELS 次「计划失效」：退还本轮配额，允许按当前地图重规划。
  for (let index = 0; index < STANCE_MAX_STALE_CANCELS; index++) {
    env.ai.checkHideRoundAttempts = 1;
    env.ai.checkHideRoundChecks = 1;
    env.ai.cancelStaleCheckHide('家具被移动 / 旋转');
    assert.equal(env.ai.checkHideRoundAttempts, 0, '地图变化允许退还配额');
    assert.equal(env.ai.checkHideRoundChecks, 0);
    assert.equal(env.ai.checkHideStaleCancels, index + 1);
  }
  assert.equal(env.ai.checkHideInvestigationEndReason, 'PLAN_STALE_CANCELLED');
  // 超过上限之后同样消耗配额：不能靠「取消 → 重规划 → 再取消」无限退款。
  env.ai.checkHideRoundAttempts = 1;
  env.ai.checkHideRoundChecks = 1;
  env.ai.cancelStaleCheckHide('家具第三次被移动');
  assert.equal(env.ai.checkHideRoundAttempts, 1, '超过上限后不再退还');
  assert.equal(env.ai.checkHideRoundChecks, 1);
  assert.equal(env.ai.checkHideStaleCancels, STANCE_MAX_STALE_CANCELS);
  assert.equal(env.ai.checkHideInvestigationEndReason, 'PLAN_STALE_CANCEL_LIMIT');
  const cancels = env.ai.drainHumanSearchEvents()
    .filter(event => event.type === 'HUMAN_HIDE_SEARCH_CANCEL');
  assert.equal(cancels[cancels.length - 1].data.staleCancelRefunded, false);
});

test('the DEV-B observation exposes the three stance centres and the formal-check flag', () => {
  const env = harness(BED_ORIGIN);
  env.walk({ visibleTraces: [BED_1, BED_2] });
  assert.equal(walkToCheck(env), 'hide_second_bed');
  const stance = { ...env.ai.checkHideStance };
  const requestPosition = { ...env.walker.point() };
  const resolution = runFormalCheck(env, 'hide_second_bed');
  assert.equal(resolution.code, 'HIT_CONCEALED');
  // DEV-B 观察条目由 hideSearch 数据直接生成；这里用控制器真实产出的值构造同一份数据
  // （字段与 ThreeGame.humanAiHideSearchObservation() 一一对应）。
  const sections = buildDevBObservation({
    phase: 'PLAYING', playerFaction: 'DEEPSEEK', controlledFaction: 'DEEPSEEK',
    temporaryTarget: null, humanAiRunning: true, deepseekAiRunning: false,
    human: requestPosition, deepseek: { x: 6.2, z: 9.7 },
    vision: { status: 'VISIBLE', blocker: 'NONE', visible: false, lastSeen: null },
    capture: { radius: 0.7, distance: 0, insideRadius: false, blocked: false,
      eligible: false, progressMs: 0, holdMs: 350 },
    hearing: { heard: false, type: 'NONE', audibleStrength: 0, distanceFactor: 0,
      occlusionMultiplier: 0, occlusion: '无遮挡', direction: '无', remainingMs: 0 },
    sounds: [], paths: { human: [{ x: requestPosition.x, z: requestPosition.z }],
      deepseek: [] },
    sprint: { state: 'NORMAL', sprintRemainingMs: 0, stunRemainingMs: 0,
      cooldownRemainingMs: 0, riskMode: 'SAFE' },
    rice: { completedCount: 0, total: 5, ratio: 0, targetId: null },
    movement: { playerSpeed: 230, humanSpeed: 248.4, humanAiSpeed: 228.528 },
    humanAi: { state: env.ai.state, target: null, targetRoomId: null,
      navigationReason: 'NONE', transitionReason: 'CHECK_HIDE_HIT',
      lockDecision: 'NONE', targetDoorId: null, decisionReason: 'NONE',
      unlockProgressMs: 0, searchTargetRoomId: null, pathIndex: null, pathTotal: null,
      pathWaypoint: null,
      hideSearch: {
        clueCount: env.ai.clueMemory.count(), expiredClueCount: 0,
        latestCluePosition: null, latestClueAgeMs: null,
        inferenceCode: env.ai.traceInference.code,
        inferenceConfidence: env.ai.traceInference.confidence,
        inferenceHeadingDeg: null, inferenceAnchor: null, inferenceBasis: '',
        candidateRanking: env.ai.candidateRanking,
        suspectedSpotId: env.ai.suspectedSpotIds[0] ?? null,
        suspectedBasis: env.ai.candidateBasis.join('；'), candidateSkipped: '无',
        pendingClueCount: 0, pendingClueRemainingMs: 0, pendingClueDeferReason: 'NONE',
        pendingClueDeferCount: 0, pendingClueReevalCount: 0,
        lastSeenPresent: false, lastSeenValid: false, lastSeenPosition: null,
        lastSeenRoomId: null, lastSeenAgeMs: null,
        lastSeenRoomGateCode: 'NONE', lastSeenRoomGateDetail: '',
        roundAttempts: env.ai.checkHideRoundAttempts,
        attemptedSpotId: env.ai.checkHideAttemptedSpotId,
        investigationEndReason: env.ai.checkHideInvestigationEndReason,
        interruptSoundType: null, interruptSoundStrength: null,
        interruptSoundRemainingMs: null, interruptSoundIsNew: false,
        checkResult: env.ai.checkHideLastResult,
        checkDetailText: env.ai.lastCheckDetail.detail,
        plannedSurfacePoint: env.ai.lastCheckDetail.plannedSurfacePoint,
        finalAimPoint: env.ai.lastCheckDetail.finalAimPoint,
        aimPointDelta: env.ai.lastCheckDetail.aimPointDelta,
        aimAngleDeltaDeg: env.ai.lastCheckDetail.angleDeltaDeg,
        aimBlocked: env.ai.lastCheckDetail.blocked,
        authoritativeCode: resolution.code, authoritativeDetail: resolution.detail,
        phase: env.ai.checkHidePhase, source: env.ai.checkHideSource,
        spotId: null, stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
        navGoal: env.ai.checkHideNavGoal, stanceDistance: env.ai.checkHideStanceDistance,
        requestPosition: env.ai.checkHideRequestPosition,
        approachSteps: env.ai.checkHideApproachSteps,
        requestCount: env.ai.checkHideRequestCount,
        staleCancels: env.ai.checkHideStaleCancels,
        countsAsFormalCheck: resolution.countsAsFormalCheck,
        dwellRemainingMs: env.ai.checkHideDwellRemainingMs, dwellMs: env.ai.checkHideDwellMs,
        roundChecks: env.ai.checkHideRoundChecks, roundBudget: env.ai.checkHideRoundBudget,
        investigationChecks: env.ai.checkHideInvestigationChecks,
        checkedSpotIds: [...env.ai.checkHideCheckedSpotIds],
        cooldowns: env.ai.checkHideCooldowns(),
        lastResult: env.ai.checkHideLastResult,
        lastResultSpotId: env.ai.checkHideLastResultSpotId,
        giveUpCode: env.ai.checkHideGiveUpCode, giveUpDetail: env.ai.checkHideGiveUpDetail,
        startCount: env.ai.checkHideStartCount, hitCount: env.ai.checkHideHitCount,
        missCount: env.ai.checkHideMissCount,
        interruptCount: env.ai.checkHideInterruptCount,
      } },
    deepseekAi: null,
  });
  const humanAiSection = sections.find(section => section.id === 'human-ai');
  const text = humanAiSection.entries.map(entry => `${entry.label}｜${entry.value}`)
    .join('\n');
  // 三处中心 + 请求次数 + 「是否计入正式检查」都必须出现在只读观察里。
  assert.match(text, /导航终点 \/ 正式站位 \/ 实际偏差/);
  assert.match(text, /最终接近 \/ 正式请求次数 \/ 计划失效退还配额/);
  assert.match(text, /最近一次判定是否计入正式检查/);
  assert.match(text, /计入（合法搜空 \/ 搜中）/);
  // 观察里必须能看到真实测量到的偏差与导航终点，而不是只有「未知」。
  assert.match(text, new RegExp(`导航吸附点 \\(${env.ai.checkHideNavGoal.x.toFixed(1)}`));
  assert.match(text, /正式请求 1 次/);
});
