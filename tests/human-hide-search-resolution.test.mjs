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
import { createHumanAiMapSnapshot, resolveHumanAiHideCheck,
  HUMAN_HIDE_CHECK_INCOMPLETE_CODES, HUMAN_HIDE_CHECK_CODE_TEXT }
  from '../src/systems/HumanHideSearchResolution.ts';
import { createWalker } from './human-ai-walk.mjs';
import { pointOnRectSurface, rectCorners, rectSurfacePoint }
  from '../src/three/map/RotatedRect.ts';
import { evaluateHumanSearchGeometry } from '../src/systems/HumanSearchSkill.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, ROOMS, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 四 / 九 + 第二轮修复：正式搜查的**分层接缝**与**公开世界快照**必须能
// 独立验证。
//
// 这两段代码过去直接写在 ThreeGame 里，于是「构造函数只挑了 furniture/hideSpots、
// 丢掉三条几何回调」这种故障在 npm test 与 tsc 里全绿，只在真实运行时表现为
// 「AI 永远看不见米痕」。现在它们可以被同一段真实源码驱动：
// 真实地图 + 真实 CollisionWorld + 真实 PerceptionGeometry + 真实 HideSystem。
//
// 第二轮修复又加了两条必须被断言的顺序约束：
//   ① 公开几何（站位 / 朝向 / 半径 / 扇形 / 墙门）不通过时，**权威占用读取次数为 0**；
//   ② STANCE_LOST / HEADING_LOST / OUT_OF_RANGE / OUTSIDE_FAN / BLOCKED 都**不是搜空**，
//      不能记公开失败记忆、不能进 6 秒冷却、也不能计入「真正完成的正式检查」。

const trace = (id, x, z, createdAt, dx = 1, dz = 0.2) => ({ id, position: { x, z },
  heading: Math.atan2(dx, dz), createdAt,
  lifetimeMs: GAME_CONFIG.perception.traceLifetimeMs, strength: 1 });
// 次卧床附近的一段连续米痕：链尾落在 hide_second_bed 的公开交互区域内。
const BED_1 = trace('bed-1', -12.0, 10.4, 100, -1.2, -0.6);
const BED_2 = trace('bed-2', -13.2, 9.8, 200, -1.2, -0.6);
// 次卧里**真实可站立**的起点（碰撞体内部的坐标不能用来走图）。
const BED_ORIGIN = { x: -11, z: 11 };

function harness() {
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
      : walkerRef ? walkerRef.point() : { ...BED_ORIGIN };
    if (walkerRef) walkerRef.set(human);
    return { deltaMs: 50, visibleTarget: null, lastSeen: null,
      heard: null, heardDanger: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true, nowMs: clock, visibleTraces: [], ...overrides, human };
  };
  const lineBlocked = (a, b) => perception.inspectVision(a, b, Number.POSITIVE_INFINITY)
    .status !== 'VISIBLE';
  const env = { ai, collision, navigation, doors, perception, map, input, lineBlocked,
    hide: new HideSystem() };
  let walkerRef = createWalker(env, BED_ORIGIN);
  env.walker = walkerRef;
  env.walk = (overrides = {}, deltaMs = 50) => {
    if (overrides.nowMs === undefined) clock += deltaMs;
    return walkerRef.walk(overrides, deltaMs);
  };
  return env;
}

/** 真实走完「规划站位 → 到达 → 900 ms 停留」，返回 AI 发出的正式搜查请求。 */
function walkAndDwell(env, batches = [[BED_1, BED_2]], deltaMs = 50, frames = 200) {
  env.walk({ visibleTraces: batches[0] ?? [], deltaMs });
  for (let frame = 0; frame < frames; frame++) {
    const command = env.walk({ visibleTraces: [], deltaMs });
    if (command.checkHideSpotId) return command.checkHideSpotId;
  }
  return null;
}

/**
 * 走与 ThreeGame 相同的判定接缝。`occupied` 是**权威层**的真实藏身点；
 * 返回值额外带上 `occupancyReads`，用来断言「公开几何失败时权威读取次数为 0」。
 */
function resolve(env, overrides = {}) {
  const { occupied = null, ...rest } = overrides;
  const stance = env.ai.checkHideStance;
  let occupancyReads = 0;
  const result = resolveHumanAiHideCheck({
    spotId: env.ai.checkHideSpotId,
    stance: stance ? { stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
      headingRad: stance.headingRad } : null,
    humanPosition: stance ? stance.stancePoint : BED_ORIGIN,
    humanHeadingRad: stance ? stance.headingRad : 0,
    waypointTolerance: GAME_CONFIG.humanAI.waypointTolerance,
    contactEpsilon: GAME_CONFIG.collision.contactEpsilon,
    furniture: FURNITURE,
    hideSpots: HIDE_SPOTS,
    readOccupancy: () => { occupancyReads++; return { concealedSpotId: occupied }; },
    lineBlocked: env.lineBlocked,
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
    ...rest,
  });
  return { ...result, occupancyReads };
}

test('the public map snapshot really wires all three geometry seams', () => {
  const env = harness();
  // ① 可视性接缝：客厅 → 玄关 隔着一堵墙（不是门洞）必须看不见。
  assert.equal(env.map.canSee({ x: 2, z: 3 }, { x: 2, z: 7 }, 11), false,
    '隔着墙必须看不见');
  // 门洞位置：门初始 CLOSED 时同样挡住视线，OPEN 之后才通。
  assert.equal(env.map.canSee({ x: 5, z: 3 }, { x: 5, z: 7 }, 11), false,
    'CLOSED 门必须挡住视线');
  const opened = env.doors.toggle('door_living_entry', 'HUMAN');
  assert.equal(opened, 'OPENED');
  assert.equal(env.map.canSee({ x: 5, z: 3 }, { x: 5, z: 7 }, 11), true,
    'OPEN 门洞必须通视');
  // ② 可站立接缝：家具足迹内不能站人。
  assert.equal(env.map.standable({ x: 7.9, z: 3.9 }), false, '家具内部不能站');
  assert.equal(env.map.standable({ x: -10.5, z: 9 }), true, '次卧空地上必须能站');
  // ③ 遮挡接缝：与非 OPEN 门叶一致。
  assert.equal(env.map.lineBlocked({ x: 2, z: 3 }, { x: 2, z: 7 }), true);
  assert.equal(env.map.lineBlocked({ x: 5, z: 3 }, { x: 5, z: 7 }), false,
    '开门之后同一条视线不再被判定为遮挡');
  // 三条接缝都必须存在：缺省值等于「失败即拒绝」，漏接线会让 AI 静默失效。
  for (const key of ['canSee', 'standable', 'lineBlocked'])
    assert.equal(typeof env.map[key], 'function', `${key} 必须接线`);
});

test('the controller keeps the whole snapshot instead of dropping the seams', () => {
  const env = harness();
  const source = readFileSync(new URL('../src/systems/HumanAIController.ts',
    import.meta.url), 'utf8');
  // 构造函数与 rebindMap 都必须整份展开快照；只挑 furniture/hideSpots 会让
  // canSee/standable/lineBlocked 落回失败即拒绝的缺省值。
  const spreads = source.match(/this\.map = \{ \.\.\.map \}/g) ?? [];
  assert.equal(spreads.length, 2, '构造函数与 rebindMap 都必须整份保留快照');
  // 端到端信号：真实地图上亲眼看到的米痕必须真的进入线索记忆。
  env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 1_000 }));
  assert.equal(env.ai.clueMemory.count(), 2, '接线正确时线索数必须大于 0');
  assert.equal(env.ai.state, 'CHECK_HIDE');
});

test('the formal search uses the planned surface point, never a recomputed one', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 1_000 }));
  const stance = env.ai.checkHideStance;
  const request = walkAndDwell(env);
  assert.equal(request, 'hide_second_bed');
  const hit = resolve(env, { occupied: 'hide_second_bed' });
  assert.equal(hit.executable, true);
  assert.equal(hit.hit, true);
  assert.equal(hit.code, 'HIT_CONCEALED');
  // 计划瞄点与最终判定点是同一个点，并且它确实落在目标家具的表面上。
  assert.deepEqual(hit.plannedSurfacePoint, stance.surfacePoint);
  assert.deepEqual(hit.finalAimPoint, stance.surfacePoint);
  assert.equal(pointOnRectSurface(stance.surfacePoint,
    FURNITURE.find(rect => rect.id === 'second_bed')), true);
  assert.ok(hit.distance <= GAME_CONFIG.humanSearch.range);
  assert.ok(Math.abs(hit.angleDeltaDeg) <= GAME_CONFIG.humanSearch.halfAngleDeg);
  assert.equal(hit.blocked, false);
  assert.equal(hit.readAuthoritativeSpot, true);
  // 构造一个「计划瞄点 ≠ 最近表面点」的合法站位：计划瞄在次卧床 +X 边的中点，
  // 站位从该点向外 0.3 之后再沿边偏移 0.6；此时「离站位最近的表面点」会落在
  // 同一个边的另一处，与计划点相差 0.6。正式判定必须用**计划那一个**。
  const bed = FURNITURE.find(rect => rect.id === 'second_bed');
  const plannedPoint = { x: bed.x + bed.width / 2, z: bed.z + 0.4 };
  const cornerStance = { spotId: 'hide_second_bed',
    stancePoint: { x: plannedPoint.x + 0.3, z: plannedPoint.z + 0.6 },
    surfacePoint: { ...plannedPoint },
    headingRad: Math.atan2(plannedPoint.z - (plannedPoint.z + 0.6),
      plannedPoint.x - (plannedPoint.x + 0.3)) };
  const cornerResult = resolve(env, { occupied: 'hide_second_bed',
    stance: cornerStance, humanPosition: cornerStance.stancePoint,
    humanHeadingRad: cornerStance.headingRad });
  assert.equal(cornerResult.code, 'HIT_CONCEALED');
  assert.deepEqual(cornerResult.plannedSurfacePoint, cornerStance.surfacePoint);
  assert.deepEqual(cornerResult.finalAimPoint, cornerStance.surfacePoint,
    '正式判定必须瞄计划保存的那个表面点');
  assert.ok(cornerResult.aimPointDelta > 0.05,
    `构造样本必须让最近表面点与计划点不同：${cornerResult.aimPointDelta}`);
  assert.equal(cornerResult.aimPointMatchesNearest, false);
  assert.deepEqual(cornerResult.nearestSurfacePoint,
    rectSurfacePoint(bed, cornerStance.stancePoint));
});

test('the occupancy read happens only after every public geometry check passes', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 1_000 }));
  const empty = resolve(env);
  assert.equal(empty.code, 'MISS_EMPTY');
  assert.equal(empty.hit, false);
  assert.equal(empty.executable, true);
  assert.equal(empty.countsAsFormalCheck, true, '合法搜空才是真正完成的正式检查');
  assert.equal(empty.occupancyReads, 1, '公开几何成立后正好读一次权威占用');
  assert.equal(empty.readAuthoritativeSpot, true);
  // 对方藏在**别的**家具里：检查这件家具同样只读出「搜空」，不泄露别处占用。
  const elsewhere = resolve(env, { occupied: 'hide_study_bookshelf' });
  assert.equal(elsewhere.code, 'MISS_EMPTY');
  assert.equal(elsewhere.hit, false);
  assert.equal(elsewhere.occupancyReads, 1);
  // 公开几何不成立时：一次都不许读。
  const blocked = resolve(env, { occupied: 'hide_second_bed', lineBlocked: () => true });
  assert.equal(blocked.code, 'BLOCKED');
  assert.equal(blocked.occupancyReads, 0, '公开几何失败时权威占用查询次数必须为零');
  const stance = env.ai.checkHideStance;
  const offStance = resolve(env, { occupied: 'hide_second_bed',
    humanPosition: { x: stance.stancePoint.x + 0.9, z: stance.stancePoint.z } });
  assert.equal(offStance.code, 'STANCE_LOST');
  assert.equal(offStance.occupancyReads, 0);
  const offAxis = resolve(env, { occupied: 'hide_second_bed',
    humanHeadingRad: stance.headingRad + 1.2,
    stance: { stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
      headingRad: stance.headingRad + 1.2 } });
  assert.equal(offAxis.code, 'OUTSIDE_FAN');
  assert.equal(offAxis.occupancyReads, 0);
});

test('doors and walls still block the formal search, out of range and fan do too', () => {
  const env = harness();
  env.ai.update(env.input({ visibleTraces: [BED_1, BED_2], nowMs: 1_000 }));
  const blocked = resolve(env, { occupied: 'hide_second_bed', lineBlocked: () => true });
  assert.equal(blocked.code, 'BLOCKED');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.hit, false);
  // 修复轮 二：几何失败是**未完成合法检查**，不是搜空。
  assert.equal(blocked.executable, false);
  assert.equal(blocked.cancelKind, 'INCOMPLETE');
  assert.equal(blocked.countsAsFormalCheck, false);
  // 站位失守：位置偏 0.9 世界单位（超过导航容差）→ 同样是未完成的检查。
  const stance = env.ai.checkHideStance;
  const lost = resolve(env, { occupied: 'hide_second_bed',
    humanPosition: { x: stance.stancePoint.x + 0.9, z: stance.stancePoint.z } });
  assert.equal(lost.code, 'STANCE_LOST');
  assert.equal(lost.executable, false, 'STANCE_LOST 绝不能被记成普通搜空');
  assert.equal(lost.cancelKind, 'INCOMPLETE');
  assert.equal(lost.countsAsFormalCheck, false);
  assert.equal(lost.stanceHeld, false);
  assert.equal(lost.hit, false);
  assert.ok(lost.stanceDistance > GAME_CONFIG.humanAI.waypointTolerance);
  // 朝向被反转：单独的类型化结果 HEADING_LOST，并同样不记搜空。
  const backwards = resolve(env, { occupied: 'hide_second_bed',
    humanHeadingRad: stance.headingRad + Math.PI });
  assert.equal(backwards.code, 'HEADING_LOST');
  assert.equal(backwards.headingHeld, false);
  assert.equal(backwards.executable, false);
  assert.equal(backwards.hit, false);
  // 站位与朝向都成立、但瞄点落在同一件家具的远端角上（距离超过 1.5 世界单位）：
  // 几何判定必须判 OUT_OF_RANGE，而绝不能为了不 MISS 而放宽半径。
  const bed = FURNITURE.find(rect => rect.id === 'second_bed');
  const farCorner = rectCorners(bed).sort((a, b) =>
    Math.hypot(b.x - stance.stancePoint.x, b.z - stance.stancePoint.z) -
    Math.hypot(a.x - stance.stancePoint.x, a.z - stance.stancePoint.z))[0];
  const farDistance = Math.hypot(farCorner.x - stance.stancePoint.x,
    farCorner.z - stance.stancePoint.z);
  assert.ok(farDistance > GAME_CONFIG.humanSearch.range,
    `构造样本必须真的超出搜查半径：${farDistance}`);
  const far = resolve(env, { occupied: 'hide_second_bed',
    humanHeadingRad: Math.atan2(farCorner.z - stance.stancePoint.z,
      farCorner.x - stance.stancePoint.x),
    stance: { stancePoint: stance.stancePoint, surfacePoint: farCorner,
      headingRad: Math.atan2(farCorner.z - stance.stancePoint.z,
        farCorner.x - stance.stancePoint.x) } });
  assert.equal(far.code, 'OUT_OF_RANGE');
  assert.equal(far.hit, false);
  assert.equal(far.executable, false);
  assert.equal(far.distance > GAME_CONFIG.humanSearch.range, true);
  // 张角：瞄点仍在表面上、距离也够近，但计划朝向偏了 68.7°（超过 60° 半角）
  // → OUTSIDE_FAN。这证明正式判定真的在算 120° 扇形，而不是只看距离。
  const offAxis = resolve(env, { occupied: 'hide_second_bed',
    humanHeadingRad: stance.headingRad + 1.2,
    stance: { stancePoint: stance.stancePoint, surfacePoint: stance.surfacePoint,
      headingRad: stance.headingRad + 1.2 } });
  assert.equal(offAxis.code, 'OUTSIDE_FAN');
  assert.equal(offAxis.hit, false);
  assert.equal(offAxis.executable, false);
  assert.ok(Math.abs(offAxis.angleDeltaDeg) > GAME_CONFIG.humanSearch.halfAngleDeg);
  // 命中/未命中必须与抽出到 HumanSearchSkill 的公共几何核心完全一致。
  const geometry = evaluateHumanSearchGeometry({ origin: stance.stancePoint,
    headingRad: stance.headingRad, aimPoint: stance.surfacePoint,
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg, lineBlocked: env.lineBlocked });
  assert.equal(geometry.code, 'IN_RANGE');
  assert.equal(resolve(env, { occupied: 'hide_second_bed' }).code, 'HIT_CONCEALED');
  // 「未完成」的结果码集合必须与源码里的定义一致，避免以后有人把某个码改成搜空。
  for (const code of ['STANCE_LOST', 'HEADING_LOST', 'PLAN_STALE', 'OUT_OF_RANGE',
    'OUTSIDE_FAN', 'BLOCKED'])
    assert.ok(HUMAN_HIDE_CHECK_INCOMPLETE_CODES.includes(code), `必须算未完成：${code}`);
  for (const code of ['MISS_EMPTY', 'HIT_CONCEALED'])
    assert.equal(HUMAN_HIDE_CHECK_INCOMPLETE_CODES.includes(code), false,
      `真正完成的检查不得算未完成：${code}`);
});

test('a stale plan (moved or rotated furniture) cancels instead of scoring a miss', () => {
  const env = harness();
  // 书房书柜 0.6 × 2.1：旋转 90° 会真正改变轮廓，是「计划失效」的合适样本。
  const seenAt = { x: -3.5, z: 11 };
  env.ai.update(env.input({ human: seenAt, visibleTarget: { ...seenAt }, nowMs: 1_000 }));
  const lastSeen = { position: { ...seenAt }, timeMs: 1_100 };
  const seenPoint = env.navigation.nearestFree(seenAt, env.doors.doors) ?? seenAt;
  env.ai.update(env.input({ human: seenPoint, lastSeen, nowMs: 1_100 }));
  env.ai.update(env.input({ human: seenPoint, lastSeen,
    deltaMs: GAME_CONFIG.humanAI.investigationDwellMs, nowMs: 1_200 }));
  assert.equal(env.ai.checkHideSpotId, 'hide_study_bookshelf');
  const stance = env.ai.checkHideStance;
  const planned = resolve(env, { occupied: 'hide_study_bookshelf' });
  assert.equal(planned.code, 'HIT_CONCEALED');
  assert.equal(planned.finalAimPoint.x, stance.surfacePoint.x);
  assert.equal(planned.finalAimPoint.z, stance.surfacePoint.z);
  // 地图里的书柜被旋转 90°：计划瞄点已经不在新轮廓表面上 → 取消，不记搜空。
  const rotated = FURNITURE.map(rect => rect.id === 'study_bookshelf'
    ? { ...rect, rotation: Math.PI / 2 } : rect);
  const stale = resolve(env, { furniture: rotated, occupied: 'hide_study_bookshelf' });
  assert.equal(stale.code, 'PLAN_STALE');
  assert.equal(stale.executable, false, '计划失效必须取消而不是判一次 MISS');
  assert.equal(stale.cancelKind, 'PLAN_STALE');
  assert.equal(stale.hit, false);
  assert.equal(stale.readAuthoritativeSpot, false);
  assert.equal(stale.occupancyReads, 0, '计划失效时绝不读权威占用');
  // 家具整个消失：同样取消。
  const removed = FURNITURE.filter(rect => rect.id !== 'study_bookshelf');
  const gone = resolve(env, { furniture: removed, occupied: 'hide_study_bookshelf' });
  assert.equal(gone.code, 'PLAN_STALE');
  assert.equal(gone.executable, false);
  assert.equal(gone.occupancyReads, 0);
  // 藏身点整个消失：同样取消。
  const noSpot = resolve(env, { hideSpots: HIDE_SPOTS.filter(spot =>
    spot.id !== 'hide_study_bookshelf'), occupied: 'hide_study_bookshelf' });
  assert.equal(noSpot.code, 'PLAN_STALE');
  assert.equal(noSpot.executable, false);
  assert.equal(noSpot.occupancyReads, 0);
});

test('a rotated footprint still accepts a surface point that really is on it', () => {
  // 家具旋转后的真实轮廓用 `pointOnRectSurface` 复核：旋转 90° 后，原本在长边上的
  // 点会落到短边之外，而新的表面点仍然合法。
  const bookshelf = FURNITURE.find(rect => rect.id === 'study_bookshelf');
  const rotated = { ...bookshelf, rotation: Math.PI / 2 };
  const before = rectSurfacePoint(bookshelf, { x: -3.0, z: 12.1 });
  assert.equal(pointOnRectSurface(before, bookshelf), true);
  assert.equal(pointOnRectSurface(before, rotated), false,
    '旋转之后旧瞄点必须被判为不属于该家具');
  const after = rectSurfacePoint(rotated, { x: -3.0, z: 12.1 });
  assert.equal(pointOnRectSurface(after, rotated), true);
  assert.equal(pointOnRectSurface(after, bookshelf), false);
  // 家具中心不是表面点。
  assert.equal(pointOnRectSurface({ x: bookshelf.x, z: bookshelf.z }, bookshelf), false);
});

test('the resolution never reads HideSystem, and the code table stays complete', () => {
  const source = readFileSync(new URL('../src/systems/HumanHideSearchResolution.ts',
    import.meta.url), 'utf8');
  assert.doesNotMatch(source, /occupancyOf|HideSystem|entryPosition|player\.position/,
    '权威判定层只接收调用方显式传入的权威事实，不自己去找真实藏身点');
  for (const code of ['STANCE_LOST', 'HEADING_LOST', 'PLAN_STALE', 'MISS_EMPTY',
    'HIT_CONCEALED', 'OUT_OF_RANGE', 'OUTSIDE_FAN', 'BLOCKED'])
    assert.ok(HUMAN_HIDE_CHECK_CODE_TEXT[code]?.length > 0, `缺中文说明：${code}`);
});
