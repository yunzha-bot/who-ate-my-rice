import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { HideSystem } from '../src/systems/HideSystem.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';
import { createWalker } from './human-ai-walk.mjs';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, ROOMS, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2：Human AI「公开线索 → 家具怀疑 → 导航 → 站位 → 900 ms 停留 → 正式搜查」
// 的完整执行链，以及优先级 / 抢占 / 计数上限 / 生命周期 / 反作弊边界。
// 用真实地图、真实碰撞与真实导航。
//
// 修复轮 二：站位判定以规划保存的原始 `stancePoint` 为准（导航网格点只是寻路节点），
// 因此「走完一次搜查」必须像 ThreeGame 一样真实推进角色（`createWalker`），
// 不能再靠把角色瞬移到吸附点。

const traceHeading = (dx, dz) => Math.atan2(dx, dz);
const trace = (id, x, z, createdAt) => ({ id, position: { x, z },
  heading: traceHeading(1, 0.2), createdAt, lifetimeMs: GAME_CONFIG.perception.traceLifetimeMs,
  strength: 1 });

// 客厅里的一小段连续米痕，链尾正好落在客厅纸箱的公开交互区域内。
const TRACE_A = trace('trace-a', 6.5, 3.5, 100);
const TRACE_B = trace('trace-b', 7.0, 3.6, 200);
const LIVING_ORIGIN = { x: 2, z: 3 };

function harness() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const ai = new HumanAIController(navigation, ROOMS, DOOR_NODES, () => 0.5, {
    furniture: FURNITURE,
    hideSpots: HIDE_SPOTS,
    canSee: (from, to, maxRange) => perception.inspectVision(from, to, maxRange)
      .status === 'VISIBLE',
    standable: point => collision.canOccupyStaticXZ(point.x, point.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight),
    lineBlocked: (a, b) => perception.inspectVision(a, b, Number.POSITIVE_INFINITY)
      .status !== 'VISIBLE',
  });
  // 正式玩法时钟：显式传入 nowMs 就跳到那个时间，否则按 deltaMs 自动前进
  // （以前每个辅助函数各自手写 nowMs，走动与停留会互相盖掉对方的时间）。
  let clock = 1_000;
  const input = (overrides = {}) => {
    if (overrides.nowMs !== undefined) clock = overrides.nowMs;
    // 角色位置只有一个所有者（walker）；显式传入 human 就是「摆放角色」。
    const human = overrides.human
      ? { x: overrides.human.x, z: overrides.human.z }
      : walkerRef ? walkerRef.point() : { ...LIVING_ORIGIN };
    if (walkerRef) walkerRef.set(human);
    return {
      deltaMs: 50, visibleTarget: null, lastSeen: null,
      heard: null, heardDanger: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true, nowMs: clock, visibleTraces: [], ...overrides, human,
    };
  };
  const snap = point => navigation.nearestFree(point, doors.doors) ?? point;
  const sound = (position, type = 'FOOTSTEP') => ({ event: { type, position,
    sourceFaction: 'DEEPSEEK', timestamp: 0, strength: 0.35, lifetimeMs: 1_400 } });
  const env = { ai, collision, navigation, doors, perception, input, snap, sound,
    hide: new HideSystem() };
  let walkerRef = createWalker(env, LIVING_ORIGIN);
  env.walker = walkerRef;
  env.walk = (overrides = {}, deltaMs = 50) => {
    if (overrides.nowMs === undefined) clock += deltaMs;
    return walkerRef.walk({ ...overrides, visibleTraces: overrides.visibleTraces ?? [] },
      deltaMs);
  };
  return env;
}

/** 让 AI 发现一段连续米痕并进入 CHECK_HIDE；返回它选中的藏身点与站位。 */
function startCheckHide(env, traces = [TRACE_A, TRACE_B], nowMs = 1_000) {
  env.ai.update(env.input({ visibleTraces: traces, nowMs }));
  return { spotId: env.ai.checkHideSpotId, stance: env.ai.checkHideStance };
}

/** 真实走到 AI 自己的搜查站位并走满 900 ms 停留，返回每帧的正式搜查请求。 */
function dwell(env, frames, deltaMs = 50) {
  const requests = [];
  for (let index = 0; index < frames; index++)
    requests.push(env.walk({ visibleTraces: [] }, deltaMs).checkHideSpotId);
  return requests;
}

/** 真实走到站位并走满 900 ms 停留，返回正式搜查请求的藏身点（没有则 null）。 */
function reachStanceAndDwell(env, frames = 200) {
  for (let frame = 0; frame < frames; frame++) {
    const command = env.walk({ visibleTraces: [] });
    if (command.checkHideSpotId) return command.checkHideSpotId;
  }
  return null;
}

/**
 * 把角色直接放到**规划保存的原始站位**上，再走满 900 ms 停留。
 * 只用于「与走图无关」的计数 / 配额 / 生命周期测试；跨房间的真实移动由
 * `tests/human-ai-stance-approach.test.mjs` 与 `tests/human-hide-search-resolution.test.mjs`
 * 覆盖（那里会真的从远处走过去）。
 */
function dwellInPlace(env, frames = 40) {
  env.walker.set(env.ai.checkHideStance.stancePoint);
  for (let frame = 0; frame < frames; frame++) {
    const command = env.walk({ visibleTraces: [] });
    if (command.checkHideSpotId) return command.checkHideSpotId;
  }
  return null;
}

test('two linked traces produce a public suspicion and start CHECK_HIDE', () => {
  const env = harness();
  const { spotId, stance } = startCheckHide(env);
  assert.equal(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideSource, 'TRACE');
  assert.equal(spotId, 'hide_living_carton', '链尾落点最近的公开家具必须被选中');
  assert.ok(stance, '必须算出合法站位');
  assert.equal(env.ai.suspectedSpotIds[0], 'hide_living_carton');
  assert.equal(env.ai.checkHidePhase, 'TRAVEL');
  assert.equal(env.ai.checkHideStartCount, 1);
  assert.ok(env.ai.candidateRanking.includes('hide_living_carton'));
  // 修复轮 三：开始前往只消耗「尝试配额」；「本轮已正式执行」要等真正发出
  // 正式判定请求（满 900 ms 停留）时才会被消耗。
  assert.equal(env.ai.checkHideRoundAttempts, 1);
  assert.equal(env.ai.checkHideRoundChecks, 0);
  assert.equal(env.ai.checkHideRoundBudget, 1);
  assert.equal(env.ai.checkHideAttemptedSpotId, 'hide_living_carton');
  assert.equal(env.ai.lastTransitionReason, 'TRACE_HIDE_SUSPECT');
  // 事件时间线里有「怀疑家具」与「前往搜查点」，且不含任何隐藏坐标。
  const events = env.ai.drainHumanSearchEvents();
  assert.ok(events.some(event => event.type === 'HUMAN_HIDE_SUSPECT'));
  assert.ok(events.some(event => event.type === 'HUMAN_HIDE_SEARCH_TRAVEL'));
  assert.ok(events.every(event => typeof event.reason === 'string'));
});

test('a single grain only investigates nearby and never locks onto furniture', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [TRACE_B] }));
  assert.notEqual(env.ai.state, 'CHECK_HIDE',
    '一粒米不能直接锁定藏身家具');
  assert.equal(env.ai.state, 'INVESTIGATE');
  assert.equal(env.ai.lastTransitionReason, 'TRACE_FOUND');
  assert.equal(env.ai.checkHideStartCount, 0);
  assert.equal(env.ai.checkHideGiveUpCode, 'CLUE_TOO_WEAK');
  assert.deepEqual(env.ai.target, { x: TRACE_B.position.x, z: TRACE_B.position.z });
  // 到达痕迹附近并停留后，回到既有的有限房间搜索，而不是搜查家具。
  env.ai.update(env.input({ human: env.snap(env.ai.target),
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs, visibleTraces: [] }));
  assert.equal(env.ai.state, 'SEARCH');
  assert.equal(env.ai.checkHideStartCount, 0);
});

test('the formal check only happens after a legal stance and the full 900 ms dwell', () => {
  const env = harness();
  startCheckHide(env);
  // 真实走过去（不是瞬移到吸附点）：到站的那一帧也算进入停留时间。
  let arrival = -1;
  for (let frame = 0; frame < 200; frame++) {
    env.walk({ visibleTraces: [] });
    if (env.ai.checkHidePhase === 'DWELL') { arrival = frame; break; }
  }
  assert.ok(arrival > 0, '必须真的从远处走到站位，而不是一步到位');
  assert.equal(env.ai.checkHideDwellRemainingMs, 850);
  assert.equal(env.ai.checkHideSpotId, 'hide_living_carton');
  // 到站之后站到的必须是**规划保存的原始站位**（而不是导航吸附点）。
  assert.ok(env.ai.checkHideStanceDistance <=
    GAME_CONFIG.humanAI.waypointTolerance + GAME_CONFIG.collision.contactEpsilon,
    `到站时的偏差必须真的满足正式站位条件：${env.ai.checkHideStanceDistance}`);
  // 累计 850 ms（16 帧）时仍未满足停留，不能提前判定。
  assert.deepEqual(dwell(env, 16, 50), new Array(16).fill(null));
  assert.equal(env.ai.checkHidePhase, 'DWELL');
  assert.equal(env.ai.checkHideDwellRemainingMs, 50);
  // 第 17 帧累计满 900 ms 才请求一次正式判定。
  assert.deepEqual(dwell(env, 1, 50), ['hide_living_carton']);
  assert.equal(env.ai.checkHidePhase, 'DONE');
  assert.equal(env.ai.checkHideDwellMs, GAME_CONFIG.humanAI.searchDwellMs);
  assert.equal(env.ai.checkHideRequestCount, 1);
  // 请求之后不会重复请求：一直等到调用方给出正式结果为止。
  assert.deepEqual(dwell(env, 3, 50), [null, null, null]);
  assert.equal(env.ai.checkHideRequestCount, 1);
});

test('a miss records public failure memory and a 6 s cooldown for that furniture', () => {
  const env = harness();
  startCheckHide(env);
  assert.equal(reachStanceAndDwell(env), 'hide_living_carton');
  env.ai.onCheckHideResult('hide_living_carton', false);
  assert.equal(env.ai.checkHideLastResult, 'MISS');
  assert.equal(env.ai.checkHideLastResultSpotId, 'hide_living_carton');
  assert.equal(env.ai.checkHideMissCount, 1);
  assert.equal(env.ai.checkHidePhase, 'NONE');
  assert.equal(env.ai.state, 'PATROL');
  assert.deepEqual(env.ai.checkHideCooldowns(),
    [{ spotId: 'hide_living_carton',
      remainingMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs }]);
  assert.deepEqual(env.ai.checkHideCheckedSpotIds, ['hide_living_carton']);
  // 冷却按正式玩法时间递减，到点后才归零。
  env.ai.update(env.input({ deltaMs: GAME_CONFIG.humanAI.hideCheckFailureCooldownMs - 1 }));
  assert.equal(env.ai.checkHideCooldowns()[0].remainingMs, 1);
  env.ai.update(env.input({ deltaMs: 1 }));
  assert.deepEqual(env.ai.checkHideCooldowns(), []);
});

test('the same clue batch can never restart the round, a new batch can', () => {
  const env = harness();
  startCheckHide(env);
  assert.equal(reachStanceAndDwell(env), 'hide_living_carton');
  env.ai.onCheckHideResult('hide_living_carton', false);
  assert.equal(env.ai.checkHideStartCount, 1);
  // 同一批米痕（没有新发现的痕迹）不得再次触发同一个调查任务。
  for (let index = 0; index < 20; index++)
    env.ai.update(env.input({ visibleTraces: [TRACE_A, TRACE_B], nowMs: 3_000 + index * 50 }));
  assert.equal(env.ai.checkHideStartCount, 1, '同一批线索不得反复启动搜查');
  // 新出现的一粒米构成新的一批线索 → 允许进入下一轮，并换一件家具。
  const extra = trace('trace-c', 7.4, 3.7, 2_500);
  env.ai.update(env.input({ visibleTraces: [TRACE_A, TRACE_B, extra], nowMs: 3_100 }));
  assert.equal(env.ai.checkHideStartCount, 2);
  assert.notEqual(env.ai.checkHideSpotId, 'hide_living_carton',
    '刚搜空并进入冷却的家具不得在同一调查里被再次选中');
  assert.equal(env.ai.checkHideRoundAttempts, 1, '新的一轮仍然最多开始 1 件家具的搜查');
  assert.equal(env.ai.checkHideRoundChecks, 0, '新的这一轮还没有正式执行过搜查');
});

test('one investigation checks at most searchRoomCount furniture pieces', () => {
  const env = harness();
  let checked = 0;
  for (let round = 0; round < 6; round++) {
    // 场景布置：让 AI 回到客厅（否则它站在上一件的储物间家具旁，看不见这串米痕，
    // 也就不会发现「新的公开线索」）。本测试检验的是配额，不是走图。
    env.walker.set(LIVING_ORIGIN);
    const extra = trace(`round-${round}`, 6.9 + round * 0.1, 3.6, 300 + round);
    env.ai.update(env.input({ visibleTraces: [TRACE_A, TRACE_B, extra],
      nowMs: 1_000 + round * 100 }));
    if (env.ai.state !== 'CHECK_HIDE') break;
    assert.equal(env.ai.checkHideRoundAttempts, 1,
      '每一轮最多开始 1 件家具的搜查（不得连查第二件）');
    assert.equal(env.ai.checkHideRoundChecks, 0, '还没有发出正式判定请求');
    const request = dwellInPlace(env);
    assert.ok(request, `第 ${round + 1} 轮必须走到正式判定`);
    checked++;
    env.ai.noteCheckHideResolution({ spotId: request, result: 'MISS', detail: '搜空',
      plannedSurfacePoint: null, finalAimPoint: null, aimPointDelta: null,
      distance: null, angleDeltaDeg: null, blocked: null, countsAsFormalCheck: true });
    env.ai.onCheckHideResult(request, false);
  }
  assert.equal(checked, GAME_CONFIG.humanAI.searchRoomCount,
    '同一次调查最多正式检查 searchRoomCount 件家具');
  assert.equal(env.ai.checkHideStartCount, GAME_CONFIG.humanAI.searchRoomCount);
  assert.equal(env.ai.checkHideInvestigationChecks, GAME_CONFIG.humanAI.searchRoomCount);
  assert.equal(env.ai.checkHideGiveUpCode, 'ROUND_BUDGET_USED');
  assert.equal(env.ai.checkHideMissCount, GAME_CONFIG.humanAI.searchRoomCount);
});

test('a visible target immediately aborts the search', () => {
  const env = harness();
  startCheckHide(env);
  env.ai.update(env.input({ visibleTarget: { x: 1, z: 1 }, captureEligible: false }));
  assert.equal(env.ai.state, 'CHASE');
  assert.equal(env.ai.checkHidePhase, 'NONE');
  assert.equal(env.ai.checkHideSpotId, null);
  assert.equal(env.ai.checkHideInterruptCount, 1);
  assert.equal(env.ai.checkHideGiveUpCode, 'TARGET_VISIBLE');
  assert.ok(env.ai.drainHumanSearchEvents()
    .some(event => event.type === 'HUMAN_HIDE_SEARCH_INTERRUPT'));
});

test('a new strong danger sound aborts the search, an ordinary sound does not', () => {
  const danger = harness();
  startCheckHide(danger);
  danger.ai.update(danger.input({ heardDanger: danger.sound({ x: 6, z: 3 }) }));
  assert.equal(danger.ai.state, 'INVESTIGATE');
  assert.equal(danger.ai.lastTransitionReason, 'DANGER_SOUND_HEARD');
  assert.equal(danger.ai.checkHideInterruptCount, 1);
  assert.equal(danger.ai.checkHideGiveUpCode, 'DANGER_SOUND');

  const ordinary = harness();
  startCheckHide(ordinary);
  const before = ordinary.ai.checkHideSpotId;
  ordinary.ai.update(ordinary.input({ heard: ordinary.sound({ x: 6, z: 3 }) }));
  assert.equal(ordinary.ai.state, 'CHECK_HIDE', '普通声音不得打断正在执行的搜查');
  assert.equal(ordinary.ai.checkHideSpotId, before);
  assert.equal(ordinary.ai.checkHideInterruptCount, 0);
  assert.equal(ordinary.ai.checkHideGiveUpCode, 'NONE');
});

test('a new trace during a search is only recorded and evaluated afterwards', () => {
  const env = harness();
  startCheckHide(env);
  const clueCountBefore = env.ai.clueMemory.count();
  const spotBefore = env.ai.checkHideSpotId;
  const extra = trace('late', 7.2, 3.65, 900);
  env.ai.update(env.input({ visibleTraces: [TRACE_A, TRACE_B, extra] }));
  assert.equal(env.ai.clueMemory.count(), clueCountBefore + 1, '新米痕必须先写进线索记忆');
  assert.equal(env.ai.checkHideSpotId, spotBefore, '不得因为新米痕立即重新规划');
  assert.equal(env.ai.checkHideStartCount, 1);
  assert.equal(env.ai.state, 'CHECK_HIDE');
});

test('the last-seen room is considered first, adjacent rooms still work as fallback', () => {
  const env = harness();
  // 修复轮 二：次卧里失视。以前有限搜索刻意排除最后目击房间，只会去邻接的书房；
  // 现在必须先考虑次卧自己的公开藏身家具（hide_second_bed）。
  env.ai.update(env.input({ human: { x: -12.5, z: 10 }, visibleTarget: { x: -12.5, z: 10 },
    lastSeen: { position: { x: -12.5, z: 10 }, timeMs: 100 } }));
  assert.equal(env.ai.state, 'CHASE');
  const lastSeen = { position: { x: -12.5, z: 10 }, timeMs: 100 };
  const seenPoint = env.snap(lastSeen.position);
  env.ai.update(env.input({ human: seenPoint, lastSeen }));
  assert.equal(env.ai.state, 'INVESTIGATE');
  env.ai.update(env.input({ human: seenPoint, lastSeen,
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs }));
  assert.equal(env.ai.state, 'CHECK_HIDE', '最后目击房间的候选必须优先于相邻房间');
  assert.equal(env.ai.checkHideSource, 'LAST_SEEN_ROOM');
  assert.equal(env.ai.checkHideSpotId, 'hide_second_bed');
  assert.equal(env.ai.lastSeenRoomGateCode, 'OK');
  assert.equal(env.ai.lastSeenRoomId, 'second_bedroom');
  assert.equal(env.ai.lastTransitionReason, 'LAST_SEEN_ROOM_HIDE_SUSPECT');
  // 搜空之后回到既有的相邻房间有限搜索；本轮家具配额已经用完，因此不会连查第二件。
  const request = reachStanceAndDwell(env);
  assert.equal(request, 'hide_second_bed');
  env.ai.onCheckHideResult(request, false);
  assert.equal(env.ai.checkHideMissCount, 1);
  env.ai.update(env.input({ human: env.snap(lastSeen.position), lastSeen }));
  assert.equal(env.ai.state, 'SEARCH', '同房间搜空后必须继续相邻房间的有限搜索');
  let secondCheck = false;
  for (let step = 0; step < 6 && env.ai.state === 'SEARCH'; step++) {
    const roomId = env.ai.searchTargetRoomId;
    const centre = ROOMS.find(room => room.id === roomId);
    if (!centre) break;
    env.ai.update(env.input({ human: env.snap({ x: centre.x, z: centre.z }), lastSeen }));
    env.ai.update(env.input({ human: env.snap({ x: centre.x, z: centre.z }), lastSeen,
      deltaMs: GAME_CONFIG.humanAI.searchDwellMs }));
    if (env.ai.state === 'CHECK_HIDE') secondCheck = true;
  }
  assert.equal(secondCheck, false,
    '同房间 + 相邻房间两条分支不得绕过「每轮最多 1 件家具」');
  assert.equal(env.ai.checkHideStartCount, 1);
  // 搜空的失败记忆与冷却跨过「调查结束」仍然保留（下一次调查不会立刻重搜它）。
  assert.deepEqual(env.ai.checkHideCooldowns().map(entry => entry.spotId),
    ['hide_second_bed']);
});

test('a last-seen room without public hide spots falls back to the adjacent search', () => {
  const env = harness();
  // 主走廊里失视：这个房间没有公开藏身点，因此同房间门槛必须拒绝，并回到
  // 既有的相邻房间有限搜索（这与修复前的行为一致，不能被新分支破坏）。
  const seenAt = { x: -5.5, z: 2 };
  env.ai.update(env.input({ human: seenAt, visibleTarget: { ...seenAt },
    lastSeen: { position: { ...seenAt }, timeMs: 100 } }));
  const lastSeen = { position: { ...seenAt }, timeMs: 100 };
  const seenPoint = env.snap(lastSeen.position);
  env.ai.update(env.input({ human: seenPoint, lastSeen }));
  env.ai.update(env.input({ human: seenPoint, lastSeen,
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs }));
  assert.equal(env.ai.state, 'SEARCH');
  assert.equal(env.ai.lastSeenRoomGateCode, 'NO_PUBLIC_SPOT');
  assert.equal(env.ai.checkHideGiveUpCode, 'NO_SAME_ROOM_CANDIDATE');
  assert.ok(env.ai.searchTargetRoomId, '仍然必须挑出一个相邻搜索房间');
  let started = false;
  for (let step = 0; step < 5 && !started; step++) {
    const roomId = env.ai.searchTargetRoomId;
    const centre = ROOMS.find(room => room.id === roomId);
    assert.ok(centre, `搜索房间 ${roomId} 必须存在`);
    env.ai.update(env.input({ human: env.snap({ x: centre.x, z: centre.z }), lastSeen }));
    if (env.ai.state === 'CHECK_HIDE') started = true;
    else env.ai.update(env.input({ human: env.snap({ x: centre.x, z: centre.z }), lastSeen,
      deltaMs: GAME_CONFIG.humanAI.searchDwellMs }));
  }
  assert.ok(started, '到达含公开藏身点的相邻搜索房间时必须转入家具检查');
  assert.equal(env.ai.checkHideSource, 'SEARCH');
  assert.ok(['hide_study_bookshelf', 'hide_living_carton', 'hide_main_bed', 'hide_closet']
    .includes(env.ai.checkHideSpotId), `意外的候选家具：${env.ai.checkHideSpotId}`);
  // 搜空后回到同一次有限搜索的剩余房间，且这一轮已经用掉的家具配额不会重置，
  // 因此不可能在同一轮里连查第二件家具。
  const request = reachStanceAndDwell(env);
  assert.equal(request, env.ai.checkHideSpotId);
  const spotId = env.ai.checkHideLastResultSpotId ?? env.ai.checkHideSpotId;
  env.ai.onCheckHideResult(request, false);
  env.ai.update(env.input({ human: env.snap(lastSeen.position), lastSeen }));
  assert.notEqual(env.ai.state, 'CHECK_HIDE');
  assert.equal(env.ai.checkHideStartCount, 1);
  if (env.ai.state === 'SEARCH') {
    assert.equal(env.ai.checkHideRoundAttempts, 1, '同一轮不得连查第二件家具');
  } else {
    assert.equal(env.ai.state, 'PATROL', '搜索结束必须回到巡逻');
  }
  // 继续推进也不会在这一次调查里悄悄再查一件。
  for (let frame = 0; frame < 6; frame++)
    env.ai.update(env.input({ human: env.snap(lastSeen.position), lastSeen }));
  assert.equal(env.ai.checkHideStartCount, 1);
  assert.deepEqual(env.ai.checkHideCooldowns().map(entry => entry.spotId), [spotId]);
});

test('manual control, map rebuild and reset all clear the search state', () => {
  const env = harness();
  startCheckHide(env);
  env.ai.resumeAfterManualControl();
  assert.equal(env.ai.checkHidePhase, 'NONE');
  assert.equal(env.ai.checkHideGiveUpCode, 'MANUAL_CONTROL');
  assert.equal(env.ai.checkHideInterruptCount, 1);

  const second = harness();
  startCheckHide(second);
  second.ai.rebindMap({ furniture: FURNITURE, hideSpots: HIDE_SPOTS }, true);
  assert.equal(second.ai.checkHidePhase, 'NONE');
  assert.equal(second.ai.checkHideGiveUpCode, 'MAP_REBUILT');
  assert.equal(second.ai.clueMemory.count(), 0, '换图必须清空与旧家具几何绑定的线索');
  assert.deepEqual(second.ai.suspectedSpotIds, []);
  assert.deepEqual(second.ai.checkHideCooldowns(), []);

  const third = harness();
  startCheckHide(third);
  third.ai.reset();
  assert.equal(third.ai.state, 'PATROL');
  assert.equal(third.ai.checkHidePhase, 'NONE');
  assert.equal(third.ai.clueMemory.count(), 0);
  assert.deepEqual(third.ai.checkHideCooldowns(), []);
  assert.equal(third.ai.checkHideStartCount, 0);
  assert.equal(third.ai.checkHideGiveUpCode, 'NONE');
  assert.equal(third.ai.clueSignature, 'NO_CLUE');
});

test('a frozen frame advances nothing and produces no search result', () => {
  const env = harness();
  startCheckHide(env);
  // 直接站到规划站位上（本测试只关心「冻结帧不推进」），然后一律用 deltaMs 0 推进。
  env.walker.set(env.ai.checkHideStance.stancePoint);
  env.walk({ visibleTraces: [] }, 0);
  assert.equal(env.ai.checkHidePhase, 'DWELL');
  const remaining = env.ai.checkHideDwellRemainingMs;
  for (let index = 0; index < 10; index++) {
    const command = env.walk({ visibleTraces: [] }, 0);
    assert.equal(command.checkHideSpotId, null, '冻结帧不得推进停留或执行搜查');
  }
  assert.equal(env.ai.checkHideDwellRemainingMs, remaining);
  assert.equal(env.ai.checkHideLastResult, 'NONE');
  // AI 控制器里不能有第二条时钟：既没有内部计时器，也不读浏览器时间。
  const source = readFileSync(new URL('../src/systems/HumanAIController.ts', import.meta.url),
    'utf8');
  assert.doesNotMatch(source, /setInterval|setTimeout|performance\.now|Date\.now/,
    'Human AI 必须完全由正式的 deltaMs 驱动');
});

test('the candidate order never depends on who is actually hidden where', () => {
  const withOccupant = harness();
  const empty = harness();
  // 让「真正被占用」的正是公开排序第一的那件家具——排序结果必须完全一样。
  const entered = withOccupant.hide.enter({ phase: 'PLAYING', faction: 'DEEPSEEK',
    playerControlled: true, position: { x: 7.0, z: 3.6 }, spotId: 'hide_living_carton',
    spotCode: 'LEGAL', spotLegal: true, captureProgressMs: 0, sprintState: 'NORMAL' });
  assert.equal(entered.ok, true);
  const first = startCheckHide(withOccupant);
  const second = startCheckHide(empty);
  assert.equal(first.spotId, second.spotId);
  assert.equal(withOccupant.ai.checkHideSpotId, empty.ai.checkHideSpotId);
  assert.equal(withOccupant.ai.candidateRanking, empty.ai.candidateRanking);
  assert.deepEqual(withOccupant.ai.suspectedSpotIds, empty.ai.suspectedSpotIds);
  assert.deepEqual(withOccupant.ai.checkHideStance.stancePoint,
    empty.ai.checkHideStance.stancePoint);
  // 结构上 AI 也无法收到位置：结果回执只有一个布尔值。
  assert.equal(HumanAIController.prototype.onCheckHideResult.length, 2);
});

test('the AI-side result of a formal search is only hit or miss', () => {
  const env = harness();
  startCheckHide(env);
  assert.equal(reachStanceAndDwell(env), 'hide_living_carton');
  env.ai.onCheckHideResult('hide_living_carton', true);
  assert.equal(env.ai.checkHideLastResult, 'HIT');
  assert.equal(env.ai.checkHideHitCount, 1);
  assert.equal(env.ai.state, 'CAPTURE');
  assert.equal(env.ai.checkHideLastResultSpotId, 'hide_living_carton');
  // 控制器公开字段里不得出现真实隐藏位置；命中回执只带公开藏身点 ID。
  const source = readFileSync(new URL('../src/systems/HumanAIController.ts', import.meta.url),
    'utf8');
  assert.doesNotMatch(source, /occupancyOf|isConcealed|entryPosition/,
    'Human AI 不得读取占用状态或真实进入位置');
});
