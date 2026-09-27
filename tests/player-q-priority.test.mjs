import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { SkillCooldown } from '../src/systems/SkillCooldown.ts';
import { resolveHideInteractionTarget, resolvePlayerQPlan }
  from '../src/systems/HideTargetResolution.ts';
import { resolveHumanFurnitureSearch }
  from '../src/systems/HumanHideSearchResolution.ts';
import { evaluateHumanSearch, evaluateHumanSearchGeometry, probeExposedFanTarget }
  from '../src/systems/HumanSearchSkill.ts';
import { furnitureApproachSurfacePoint }
  from '../src/three/map/HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 三：Human 玩家 Q 的**目标优先级**（用户本轮批准的规则）。
//
//   ① 12 秒冷却中 → 什么都不做；
//   ② 当帧存在**合法暴露目标**（未藏身 + 1.5 u + 120° + 无墙门遮挡）→ 原有普通扇形抓捕，
//      即使玩家正站在家具合法交互区域内、并正对着它，也不得改为家具搜查；
//   ③ 否则当帧存在**合法 + 被指向**的家具 → 只搜查这一件家具（指向只用来选家具，
//      不做 1.5 u / 120° 判定；隐藏角色本人不再接受任何距离 / 扇形 / 视线二次判定）；
//   ④ 都没有 → 原有普通扇形空挥；四种有效释放都消耗同一份冷却。
//
// 全部用**真实地图 + 真实碰撞 / 导航 / 门态**驱动，位置与朝向由测试摆放；
// 只有在需要「两件家具区域重叠」时才有意移动一件家具（与既有测试相同的构造方式）。
// 位移本身由 CollisionWorld 的测试覆盖，纯表现在
// `tests/hide-search-view-player-target.test.mjs` 里验证。

function harness() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  return { collision, navigation, doors,
    world: { collision, navigation, doorStates: doors.doors } };
}

/** 真实几何：从该站位「指向」某件家具时的朝向（= 可接近表面点方向）。 */
function headingToward(position, furnitureId, furniture = FURNITURE) {
  const rect = furniture.find(item => item.id === furnitureId);
  const aim = furnitureApproachSurfacePoint(rect, position);
  return { headingRad: Math.atan2(aim.z - position.z, aim.x - position.x), aim };
}

// 次卧床：家具中心 (-13,10)、2.1×2.2；其合法交互位置（真实几何判定为 LEGAL）。
const BED_LEGAL = { x: -11.3, z: 10.8 };
// 客厅里一个不属于任何交互区域的位置。
const LIVING_FREE = { x: 2, z: 3 };

/** 复刻 `ThreeGame.useSkillQ()` 的按键当帧决策（顺序与源码一致），并统计占用读取。 */
function pressQ(env, position, options = {}) {
  const {
    headingRad = headingToward(position, 'second_bed',
      options.furniture ?? FURNITURE).headingRad,
    exposed = null,
    lineBlocked = () => false,
    cooldownReady = true,
    remainingSeconds = 0,
    occupied = null,
    spots = HIDE_SPOTS,
    furniture = FURNITURE,
  } = options;
  const resolution = resolveHideInteractionTarget({ position, spots, furniture,
    world: env.world,
    pointing: { headingRad, halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg } });
  // 无副作用的暴露目标预检测（生产代码里就是 `ThreeGame.probeExposedTarget()`）。
  const probe = probeExposedFanTarget({ origin: position, headingRad, target: exposed,
    lineBlocked });
  const plan = resolvePlayerQPlan({ cooldownReady, remainingSeconds,
    exposedTargetAvailable: probe.available,
    furnitureTarget: resolution.pointedLegalTarget });
  let occupancyReads = 0;
  let executed = 'REJECTED';
  if (plan.kind !== 'REJECT_COOLDOWN') {
    const target = plan.kind === 'FURNITURE' ? resolution.pointedLegalTarget : null;
    if (target) {
      executed = resolveHumanFurnitureSearch({
        spotId: target.spotId,
        playerPosition: position,
        furniture,
        hideSpots: spots,
        legal: target.legal,
        legalCode: target.code,
        lineBlocked,
        readOccupancy: () => { occupancyReads++; return { concealedSpotId: occupied }; },
      }).code;
    } else {
      executed = evaluateHumanSearch({ origin: position, headingRad, target: exposed,
        lineBlocked }).code;
    }
  }
  return { resolution, probe, plan, executed, occupancyReads };
}

/** 未藏身的对手样本（真实位置由测试摆放；扇形判定只认这一个坐标）。 */
function exposedAt(position) {
  return { concealed: false, position: { x: position.x, z: position.z },
    spotId: null, furniture: null };
}

test('§四.1 exposed target wins over the furniture the player is standing in and facing', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  // 样本必须真的同时满足两件事：站在床的合法交互区域里 **且** 正对着床。
  const result = pressQ(env, BED_LEGAL, { headingRad,
    exposed: exposedAt({ x: BED_LEGAL.x - 0.6, z: BED_LEGAL.z }) });
  assert.equal(result.resolution.code, 'LEGAL');
  assert.equal(result.resolution.pointedLegalTarget.spotId, 'hide_second_bed',
    '构造样本必须真的同时具备「合法 + 被指向」的家具目标');
  assert.equal(result.probe.available, true, '构造样本必须真的有合法暴露目标');
  assert.equal(result.probe.code, 'HIT_VISIBLE');
  assert.equal(result.plan.kind, 'FAN', '有暴露目标时 Q 必须抓人，不得转为家具搜查');
  assert.equal(result.plan.reason, 'EXPOSED_TARGET');
  assert.equal(result.plan.spotId, null);
  assert.equal(result.plan.furnitureId, null);
  assert.equal(result.plan.armsCooldown, true);
  assert.equal(result.executed, 'HIT_VISIBLE');
  assert.equal(result.occupancyReads, 0, '抓人分支不得读取任何家具占用');
});

test('§四.2 facing away from the bed with no exposed target does not search the bed', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  const away = pressQ(env, BED_LEGAL, { headingRad: headingRad + Math.PI });
  // 站位仍然合法，但玩家背对床：不允许把家具当作目标。
  assert.equal(away.resolution.code, 'LEGAL');
  assert.equal(away.resolution.legalTarget.spotId, 'hide_second_bed');
  assert.equal(away.resolution.pointedLegalTarget, null, '背对时不得有家具目标（高亮必须消失）');
  assert.equal(away.plan.kind, 'FAN');
  assert.equal(away.plan.reason, 'NO_TARGET');
  assert.equal(away.plan.spotId, null);
  assert.equal(away.executed, 'NO_TARGET');
  assert.equal(away.occupancyReads, 0);
  // 90° 侧对（在 ±60° 容差之外）也不算指向；正对与近似正对才算。
  const side = pressQ(env, BED_LEGAL, { headingRad: headingRad + Math.PI / 2 });
  assert.equal(side.resolution.pointedLegalTarget, null);
  const near = pressQ(env, BED_LEGAL, { headingRad: headingRad + Math.PI / 6 });
  assert.equal(near.resolution.pointedLegalTarget.spotId, 'hide_second_bed',
    '±60° 以内应当算指向（适合正常操作，不要求精确瞄准）');
  const outside = pressQ(env, BED_LEGAL);
  assert.equal(outside.resolution.pointedLegalTarget.spotId, 'hide_second_bed');
  assert.ok(outside.resolution.pointedLegalTarget.pointingDeltaDeg < 1);
});

test('§四.3 facing the bed with no exposed target searches exactly the bed', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  const result = pressQ(env, BED_LEGAL, { headingRad });
  assert.equal(result.probe.available, false);
  assert.equal(result.plan.kind, 'FURNITURE');
  assert.equal(result.plan.reason, 'FURNITURE');
  assert.equal(result.plan.spotId, 'hide_second_bed');
  assert.equal(result.plan.furnitureId, 'second_bed');
  assert.equal(result.executed, 'MISS_EMPTY');
  assert.equal(result.occupancyReads, 1, '公开几何通过后才读一次权威占用');
  // 高亮目标 = Q 提示目标 = 实际搜查目标：全部来自**同一次**解析结果。
  assert.equal(result.plan.spotId, result.resolution.pointedLegalTarget.spotId);
  assert.equal(result.plan.furnitureId, result.resolution.pointedLegalTarget.furnitureId);
  assert.equal(result.plan.armsCooldown, true);
  // 生产代码里两侧都必须读**同一个** `pointedLegalTarget`：高亮绝不能退回到
  // 「最近的合法家具」（那会在背对家具时给出错误的白色高亮），技能层也不能。
  const game = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  const highlight = game.slice(game.indexOf('private syncPlayerFurnitureTarget('),
    game.indexOf('private hideWorld('));
  assert.match(highlight, /resolution\.pointedLegalTarget/,
    '白色高亮必须使用「合法且被指向」的目标');
  assert.doesNotMatch(highlight, /resolution\.legalTarget/,
    '白色高亮不得退回到「最近的合法家具」');
  const skill = game.slice(game.indexOf('private useSkillQ('),
    game.indexOf('private performFurnitureSearch('));
  assert.match(skill, /pressResolution\.pointedLegalTarget/);
  assert.doesNotMatch(skill, /pressResolution\.legalTarget/,
    '技能层不得使用未经过指向筛选的目标');
});

test('§四.4 two overlapping legal regions: pointing decides the single furniture', () => {
  const env = harness();
  // 把储物间纸箱搬到客厅纸箱正西（两个圆形区域纵向对齐且重叠）；这一点同时落在
  // 两个区域里，而且**两件都合法**——因此这里的唯一性完全由「指向」决定。
  const furniture = FURNITURE.map(rect => rect.id === 'storage_carton'
    ? { ...rect, x: 5.7, z: 3.9 } : rect);
  const spots = HIDE_SPOTS.map(spot => spot.id === 'hide_storage_carton'
    ? { ...spot, x: 5.5, z: 3.9 } : spot);
  const position = { x: 6.8, z: 3.9 };
  const eastward = headingToward(position, 'living_carton', furniture);
  const westward = headingToward(position, 'storage_carton', furniture);
  const towardLiving = pressQ(env, position, { spots, furniture,
    headingRad: eastward.headingRad });
  const towardStorage = pressQ(env, position, { spots, furniture,
    headingRad: westward.headingRad });
  assert.equal(towardLiving.resolution.candidatesInRegion, 2,
    '构造样本必须真的落在两个交互区域里');
  // 两件都合法：无论指向哪一边，「最近的合法目标」都是同一件（锚点距离排序不变）。
  assert.equal(towardLiving.resolution.legalTarget.spotId, 'hide_living_carton');
  assert.equal(towardStorage.resolution.legalTarget.spotId, 'hide_living_carton');
  // 但「被指向的合法目标」按朝向切换，且任何时候只有一个。
  assert.equal(towardLiving.resolution.pointedLegalTarget.spotId, 'hide_living_carton');
  assert.equal(towardStorage.resolution.pointedLegalTarget.spotId, 'hide_storage_carton');
  assert.equal(towardStorage.plan.spotId, 'hide_storage_carton');
  assert.equal(towardStorage.plan.furnitureId, 'storage_carton');
  assert.equal(towardStorage.plan.spotId,
    towardStorage.resolution.pointedLegalTarget.spotId, '高亮与 Q 目标必须同一件');
  assert.equal(towardStorage.executed, 'MISS_EMPTY');
  assert.equal(towardStorage.occupancyReads, 1);
  // 同一个公开输入重复解析仍然是同一件家具（确定性）。
  assert.equal(pressQ(env, position, { spots, furniture, headingRad: westward.headingRad })
    .plan.spotId, 'hide_storage_carton');
});

test('§四.5 a pointed legal furniture flushes a concealed target regardless of its real position', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  // 隐藏者的**真实坐标**被放在很远的地方：家具搜查不得对隐藏角色本人做任何
  // 距离 / 扇形 / 视线二次判定（用户规则第 10 条）。
  const concealedFarAway = { concealed: true, position: { x: 40, z: 40 },
    spotId: 'hide_second_bed', furniture: FURNITURE.find(rect => rect.id === 'second_bed') };
  const fanOnTruth = evaluateHumanSearchGeometry({
    origin: BED_LEGAL, headingRad, aimPoint: concealedFarAway.position,
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg, lineBlocked: () => false });
  assert.equal(fanOnTruth.code, 'OUT_OF_RANGE', '真实坐标确实在普通扇形之外');
  const result = pressQ(env, BED_LEGAL, { headingRad, exposed: concealedFarAway,
    occupied: 'hide_second_bed' });
  assert.equal(result.probe.available, false, '藏身目标不算「暴露目标」，不能抢占分支');
  assert.equal(result.plan.kind, 'FURNITURE');
  assert.equal(result.executed, 'HIT_CONCEALED');
  assert.equal(result.occupancyReads, 1);
});

test('§四.6 fan hit, fan miss, furniture hit and empty search all cost the 12 s cooldown', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  const cases = {
    fanHit: pressQ(env, BED_LEGAL, { headingRad,
      exposed: exposedAt({ x: BED_LEGAL.x - 0.6, z: BED_LEGAL.z }) }),
    fanMiss: pressQ(env, LIVING_FREE, {}),
    furnitureHit: pressQ(env, BED_LEGAL, { headingRad, occupied: 'hide_second_bed' }),
    furnitureEmpty: pressQ(env, BED_LEGAL, { headingRad }),
  };
  assert.equal(cases.fanHit.executed, 'HIT_VISIBLE');
  assert.equal(cases.fanMiss.executed, 'NO_TARGET');
  assert.equal(cases.furnitureHit.executed, 'HIT_CONCEALED');
  assert.equal(cases.furnitureEmpty.executed, 'MISS_EMPTY');
  const cooldown = new SkillCooldown(GAME_CONFIG.humanSearch.cooldownMs);
  for (const [name, result] of Object.entries(cases)) {
    assert.equal(result.plan.armsCooldown, true, `${name} 必须消耗冷却`);
    cooldown.arm();
    assert.equal(cooldown.ready, false, `${name} 之后 Q 必须进入冷却`);
    assert.equal(cooldown.remainingSeconds, 12);
    cooldown.advance(GAME_CONFIG.humanSearch.cooldownMs);
    assert.equal(cooldown.ready, true, `${name} 的冷却按正式时间推进`);
  }
});

test('§四.7 during cooldown no branch runs and no "Q 搜查可用" hint is produced', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  const resolution = resolveHideInteractionTarget({ position: BED_LEGAL,
    spots: HIDE_SPOTS, furniture: FURNITURE, world: env.world,
    pointing: { headingRad, halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg } });
  // 冷却中即使「同时有暴露目标和被指向的家具」，Q 也必须什么都不做。
  const cooling = resolvePlayerQPlan({ cooldownReady: false, remainingSeconds: 8.4,
    exposedTargetAvailable: true, furnitureTarget: resolution.pointedLegalTarget });
  assert.equal(cooling.kind, 'REJECT_COOLDOWN');
  assert.equal(cooling.reason, 'COOLDOWN');
  assert.equal(cooling.armsCooldown, false, '冷却中不得产生新的冷却');
  assert.equal(cooling.spotId, null);
  assert.equal(cooling.furnitureId, null);
  assert.match(cooling.message, /冷却中：剩 8\.4 秒/);
  // 「Q 可用」提示只在冷却就绪、且没有暴露目标优先时出现（源码级的唯一判据）。
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  assert.match(source, /this\.humanSearchCooldown\.ready && !exposed\.available/,
    '白色高亮的「可用」必须同时要求冷却就绪且没有暴露目标优先');
  assert.match(source, /this\.hideTargetLegal && !this\.hideTargetExposedPriority/,
    'HUD 不得在暴露目标优先时继续提示「可以搜家具」');
});

test('§四.8 the ordinary fan keeps its 1.5 u / 120° / wall-door rules', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  const front = exposedAt({ x: BED_LEGAL.x - 0.6, z: BED_LEGAL.z });
  const tooFar = exposedAt({ x: BED_LEGAL.x - GAME_CONFIG.humanSearch.range - 0.1,
    z: BED_LEGAL.z });
  const behind = exposedAt({ x: BED_LEGAL.x + 0.6, z: BED_LEGAL.z });
  const probe = (target, lineBlocked = () => false) => probeExposedFanTarget({
    origin: BED_LEGAL, headingRad, target, lineBlocked });
  assert.equal(probe(front).available, true);
  assert.equal(probe(tooFar).code, 'OUT_OF_RANGE');
  assert.equal(probe(tooFar).available, false);
  assert.equal(probe(behind).code, 'OUTSIDE_FAN');
  assert.equal(probe(behind).available, false);
  const blocked = probe(front, () => true);
  assert.equal(blocked.code, 'BLOCKED');
  assert.equal(blocked.available, false, '被墙或关闭的门挡住时不算合法暴露目标');
  // 半径 / 张角仍然来自 GAME_CONFIG（本测试不假设任何新数值）。
  assert.equal(GAME_CONFIG.humanSearch.range, 1.5);
  assert.equal(GAME_CONFIG.humanSearch.halfAngleDeg * 2, 120);
  // 遮挡成立时若玩家正指向家具，则回落到家具搜查（而不是无视墙直接抓人）。
  const withFurniture = pressQ(env, BED_LEGAL, { headingRad, exposed: front,
    lineBlocked: () => true });
  assert.equal(withFurniture.probe.available, false);
  assert.equal(withFurniture.plan.kind, 'FURNITURE');
  assert.equal(withFurniture.executed, 'NOT_LEGAL', '家具搜查自己也要复核遮挡');
  // 站在没有家具的开放地面上：三种失败都直接落到普通扇形空挥。
  for (const target of [tooFar, behind]) {
    const result = pressQ(env, LIVING_FREE, { exposed: target });
    assert.equal(result.plan.kind, 'FAN');
    assert.equal(result.plan.reason, 'NO_TARGET');
    assert.equal(result.occupancyReads, 0);
  }
});

test('§四.9 the pointing / selection phase never queries furniture occupancy', () => {
  const env = harness();
  const { headingRad } = headingToward(BED_LEGAL, 'second_bed');
  // 行为证据：抓人分支与「没有目标」分支的家具占用读取次数都是 0。
  const captured = pressQ(env, BED_LEGAL, { headingRad,
    exposed: exposedAt({ x: BED_LEGAL.x - 0.6, z: BED_LEGAL.z }) });
  assert.equal(captured.occupancyReads, 0);
  const whiff = pressQ(env, LIVING_FREE, {});
  assert.equal(whiff.occupancyReads, 0);
  const awayFromBed = pressQ(env, BED_LEGAL, { headingRad: headingRad + Math.PI });
  assert.equal(awayFromBed.occupancyReads, 0);
  // 结构证据：解析 / 计划两个纯函数里根本没有占用字段或占用查询。
  const source = readFileSync(new URL('../src/systems/HideTargetResolution.ts',
    import.meta.url), 'utf8');
  assert.doesNotMatch(source, /HideSystem|occupancyOf|isConcealed|concealedSpotId/,
    '目标解析与 Q 计划不得读取占用状态');
  // 生产代码里家具搜查只在 `plan.kind === 'FURNITURE'` 分支里被调用一次。
  const game = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  const body = game.slice(game.indexOf('private useSkillQ('),
    game.indexOf('private performFurnitureSearch('));
  assert.ok(body.indexOf('resolvePlayerQPlan') > -1 &&
    body.indexOf('resolvePlayerQPlan') < body.indexOf('plan.kind === \'FURNITURE\''),
  '玩家 Q 必须先做一次统一决策');
  assert.match(body, /plan\.kind === 'FURNITURE'[\s\S]*performFurnitureSearch/,
    '家具搜查只能出现在 FURNITURE 分支里');
  assert.equal((body.match(/performFurnitureSearch\(/g) ?? []).length, 1);
});
