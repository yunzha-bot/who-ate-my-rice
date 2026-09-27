import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { HideSystem } from '../src/systems/HideSystem.ts';
import { SkillCooldown } from '../src/systems/SkillCooldown.ts';
import { resolveQSkill, humanSearchGate } from '../src/systems/SkillGates.ts';
import { resolveInteractionIntent } from '../src/systems/HideInteractionArbitration.ts';
import { resolveHideInteractionTarget, resolvePlayerQPlan }
  from '../src/systems/HideTargetResolution.ts';
import { resolveHumanFurnitureSearch }
  from '../src/systems/HumanHideSearchResolution.ts';
import { evaluateHumanSearch, evaluateHumanSearchGeometry }
  from '../src/systems/HumanSearchSkill.ts';
import { furnitureApproachSurfacePoint }
  from '../src/three/map/HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 二 / 三：Human **玩家** Q「指向家具 → 唯一家具白色呼吸高亮 →
// Q 搜查」的规则层。两种用途（家具搜查 / 普通扇形抓捕）完全互斥；家具分支
// **需要面向家具**（指向条件），但**不做** 1.5 u / 120° 判定；并且当帧存在合法暴露
// 目标时，普通扇形抓捕优先于家具搜查（细节见 `tests/player-q-priority.test.mjs`）。
//
// 这里用真实地图 + 真实碰撞 / 导航 / 门态驱动真实的公开解析与权威判定；
// 只有「玩家位置」由测试摆放（位移本身由 CollisionWorld 的测试覆盖）。
// 纯表现（白色呼吸高亮、HUD 文案）在
// `tests/hide-search-view-player-target.test.mjs` 里用真实 THREE 场景验证。

function harness() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  const world = { collision, navigation, doorStates: doors.doors };
  const resolve = (position, overrides = {}) => resolveHideInteractionTarget({
    position, spots: HIDE_SPOTS, furniture: FURNITURE, world, ...overrides });
  return { collision, navigation, doors, world, resolve };
}

/** 真实几何：从该站位「指向」某件家具时的朝向（= 可接近表面点方向）。 */
function headingToward(position, furnitureId, furniture = FURNITURE) {
  const rect = furniture.find(item => item.id === furnitureId);
  const aim = furnitureApproachSurfacePoint(rect, position);
  return Math.atan2(aim.z - position.z, aim.x - position.x);
}

// 次卧床的合法交互位置（真实几何判定为 LEGAL）。
const BED_LEGAL = { x: -11.3, z: 10.8 };
// 客厅里一个不属于任何交互区域的位置。
const LIVING_FREE = { x: 2, z: 3 };

/** 玩家在按键当帧的完整决策：公开目标解析（含指向）→ Q 输入优先级。 */
function pressQ(env, position, overrides = {}) {
  const { headingRad = headingToward(position, 'second_bed', overrides.furniture
    ? overrides.furniture : FURNITURE), exposedAvailable = false, ...rest } = overrides;
  const resolution = env.resolve(position, { pointing: { headingRad,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg }, ...rest });
  const plan = resolvePlayerQPlan({ cooldownReady: true, remainingSeconds: 0,
    exposedTargetAvailable: exposedAvailable,
    furnitureTarget: resolution.pointedLegalTarget });
  return { resolution, plan };
}

/** 权威家具搜查（与 ThreeGame.performFurnitureSearch 的输入逐项对应）。 */
function searchFurniture(env, position, target, overrides = {}) {
  const { occupied = null, ...rest } = overrides;
  let occupancyReads = 0;
  const result = resolveHumanFurnitureSearch({
    spotId: target ? target.spotId : null,
    playerPosition: position,
    furniture: FURNITURE,
    hideSpots: HIDE_SPOTS,
    legal: target ? target.legal : false,
    legalCode: target ? target.code : 'NONE',
    lineBlocked: () => false,
    readOccupancy: () => { occupancyReads++; return { concealedSpotId: occupied }; },
    ...rest,
  });
  return { ...result, occupancyReads };
}

test('facing a bed inside its region selects exactly one furniture and offers Q 搜查', () => {
  const env = harness();
  const { resolution, plan } = pressQ(env, BED_LEGAL);
  assert.equal(resolution.candidatesInRegion, 1);
  assert.equal(resolution.legalTarget.spotId, 'hide_second_bed');
  assert.equal(resolution.legalTarget.furnitureId, 'second_bed');
  assert.equal(resolution.pointedLegalTarget.spotId, 'hide_second_bed');
  assert.equal(resolution.pointedLegalTarget.pointed, true);
  assert.equal(plan.kind, 'FURNITURE');
  assert.equal(plan.spotId, 'hide_second_bed');
  assert.equal(plan.armsCooldown, true);
  // 高亮目标与搜查目标是**同一次**解析结果：这里显式复现「同一帧解析两次」。
  assert.equal(pressQ(env, BED_LEGAL).plan.spotId, plan.spotId);
  // 离开区域后立刻没有家具目标（高亮必须同时消失）。
  const away = pressQ(env, LIVING_FREE);
  assert.equal(away.resolution.legalTarget, null);
  assert.equal(away.plan.kind, 'FAN');
  assert.equal(away.plan.reason, 'NO_TARGET');
});

test('the furniture branch needs facing, but never the fan distance or half angle', () => {
  const env = harness();
  const { resolution, plan } = pressQ(env, BED_LEGAL);
  const target = resolution.pointedLegalTarget;
  assert.equal(plan.kind, 'FURNITURE');
  // ① 修复轮 三：背对家具时**没有**家具目标（指向条件是选择家具的一部分）。
  const backwards = pressQ(env, BED_LEGAL, {
    headingRad: headingToward(BED_LEGAL, 'second_bed') + Math.PI });
  assert.equal(backwards.resolution.code, 'LEGAL');
  assert.equal(backwards.resolution.legalTarget.spotId, 'hide_second_bed');
  assert.equal(backwards.resolution.pointedLegalTarget, null);
  assert.equal(backwards.plan.kind, 'FAN');
  // ② 但家具搜查本身仍然**不做**普通扇形的距离 / 张角判定：用家具**中心**构造一个
  // 完全在 1.5 u / 120° 之外的样本，面向家具时家具搜查照样执行。
  const bed = FURNITURE.find(rect => rect.id === 'second_bed');
  const centre = { x: bed.x, z: bed.z };
  const centreDistance = Math.hypot(BED_LEGAL.x - centre.x, BED_LEGAL.z - centre.z);
  assert.ok(centreDistance > GAME_CONFIG.humanSearch.range,
    `构造样本必须真的超出搜查半径：${centreDistance}`);
  const towardCentre = pressQ(env, BED_LEGAL, {
    headingRad: Math.atan2(centre.z - BED_LEGAL.z, centre.x - BED_LEGAL.x) });
  assert.equal(towardCentre.plan.kind, 'FURNITURE');
  const fan = evaluateHumanSearchGeometry({ origin: BED_LEGAL,
    headingRad: Math.atan2(centre.z - BED_LEGAL.z, centre.x - BED_LEGAL.x),
    aimPoint: centre, range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg, lineBlocked: () => false });
  assert.equal(fan.code, 'OUT_OF_RANGE', '构造样本必须让家具中心落在普通 Q 扇形之外');
  const hit = searchFurniture(env, BED_LEGAL, target, { occupied: 'hide_second_bed' });
  assert.equal(hit.code, 'HIT_CONCEALED');
  assert.equal(hit.hit, true);
  assert.equal(hit.executable, true);
  // 结构上也证明了这一点：权威判定的输入里根本没有朝向 / 距离 / 张角参数。
  const source = readFileSync(new URL('../src/systems/HumanHideSearchResolution.ts',
    import.meta.url), 'utf8');
  const furnitureSearch = source.slice(source.indexOf(
    'export interface HumanFurnitureSearchInput'));
  assert.doesNotMatch(furnitureSearch, /headingRad|angleDelta|halfAngle|range:/,
    '玩家家具搜查不得引入普通扇形的距离 / 张角 / 朝向判定');
  assert.doesNotMatch(furnitureSearch, /evaluateHumanSearchGeometry/,
    '玩家家具搜查不得调用普通扇形的几何核心');
});

test('a wall or a closed door between the player and the furniture forbids the search', () => {
  const env = harness();
  // 真实几何：这个点在自己的交互区域内，但与家具之间被挡住 → SURFACE_BLOCKED。
  const blocked = env.resolve({ x: 14.5, z: -4.8 });
  assert.equal(blocked.code, 'SURFACE_BLOCKED');
  assert.equal(blocked.legalTarget, null, '不合法时不允许高亮，也不允许按键');
  // 同一件家具，即使玩家位置在区域内，权威层也必须拒绝：不读占用、不搜查。
  const spot = HIDE_SPOTS.find(entry => entry.id === 'hide_storage_carton');
  const rejected = searchFurniture(env, { x: 14.5, z: -4.8 },
    { spotId: spot.id, furnitureId: spot.furnitureId, code: 'SURFACE_BLOCKED',
      legal: false, distance: 0 },
    { occupied: 'hide_storage_carton' });
  assert.equal(rejected.code, 'NOT_LEGAL');
  assert.equal(rejected.hit, false);
  assert.equal(rejected.executable, false);
  assert.equal(rejected.occupancyReads, 0, '公开几何失败时权威占用查询次数必须为零');
  // 遮挡判定同样在按键当帧复核：正式遮挡规则说被挡住，就绝不放行（不隔墙搜查）。
  const byLine = searchFurniture(env, BED_LEGAL, {
    spotId: 'hide_second_bed', furnitureId: 'second_bed', code: 'LEGAL', legal: true,
    distance: 0 }, { occupied: 'hide_second_bed', lineBlocked: () => true });
  assert.equal(byLine.code, 'NOT_LEGAL');
  assert.equal(byLine.blocked, true);
  assert.equal(byLine.occupancyReads, 0);
});

test('overlapping regions still give the player exactly one furniture target', () => {
  const env = harness();
  // 与 hide-target-resolution 测试相同：把储物间纸箱搬到客厅纸箱旁构造真实重叠。
  const movedFurniture = FURNITURE.map(rect => rect.id === 'storage_carton'
    ? { ...rect, x: 9.6, z: 3.9 } : rect);
  const movedSpots = HIDE_SPOTS.map(spot => spot.id === 'hide_storage_carton'
    ? { ...spot, x: 10.4, z: 3.9 } : spot);
  const position = { x: 8.6, z: 4.4 };
  const { resolution, plan } = pressQ(env, position, { spots: movedSpots,
    furniture: movedFurniture, headingRad: headingToward(position, 'living_carton',
      movedFurniture) });
  assert.equal(resolution.candidatesInRegion, 2, '构造样本必须真的落在两个区域内');
  assert.equal(plan.kind, 'FURNITURE');
  assert.equal(plan.spotId, 'hide_living_carton',
    '两件家具重叠时，Q 只搜查唯一合法且被指向的那一件，绝不一次搜两件');
  assert.equal(plan.furnitureId, 'living_carton');
  // 高亮与技能用的是同一个解析结果：重复解析得到同一件家具。
  assert.equal(pressQ(env, position, { spots: movedSpots, furniture: movedFurniture,
    headingRad: headingToward(position, 'living_carton', movedFurniture) })
    .plan.spotId, plan.spotId);
});

test('the highlight and selection path never reads furniture occupancy', () => {
  const env = harness();
  // 选目标 / 高亮只调用公开解析与纯规则函数：它们的输入里没有占用字段，
  // 因此「有没有人」在结构上不可能影响高亮。
  const { resolution } = pressQ(env, BED_LEGAL);
  assert.equal(Object.prototype.hasOwnProperty.call(resolution.legalTarget, 'concealed'),
    false);
  const source = readFileSync(new URL('../src/systems/HideTargetResolution.ts',
    import.meta.url), 'utf8');
  assert.doesNotMatch(source, /occupancyOf|HideSystem|isConcealed|concealedSpotId/,
    '高亮 / 目标解析阶段不得读取占用状态');
  // 权威层也一样：公开几何通过之前一次都不读（上一测试已断言 0 次）。
  const miss = searchFurniture(env, BED_LEGAL,
    env.resolve(BED_LEGAL).legalTarget);
  assert.equal(miss.code, 'MISS_EMPTY');
  assert.equal(miss.occupancyReads, 1, '只有公开几何全部通过后才读一次权威占用');
  assert.equal(miss.readAuthoritativeSpot, true);
});

test('a legal furniture search flushes a concealed target even when it is outside the fan', () => {
  const env = harness();
  const target = env.resolve(BED_LEGAL).legalTarget;
  const hit = searchFurniture(env, BED_LEGAL, target, { occupied: 'hide_second_bed' });
  assert.equal(hit.code, 'HIT_CONCEALED');
  assert.equal(hit.hit, true);
  assert.equal(hit.furnitureId, 'second_bed');
  assert.equal(hit.executable, true);
  assert.equal(hit.readAuthoritativeSpot, true);
  // 对方藏在**别的**家具里：这次搜查只回答「这件家具是空的」，不泄露别处。
  const elsewhere = searchFurniture(env, BED_LEGAL, target,
    { occupied: 'hide_living_carton' });
  assert.equal(elsewhere.code, 'MISS_EMPTY');
  assert.equal(elsewhere.hit, false);
});

test('an empty furniture consumes the shared 12 s cooldown and then Q is refused', () => {
  const env = harness();
  const cooldown = new SkillCooldown(GAME_CONFIG.humanSearch.cooldownMs);
  const plan = pressQ(env, BED_LEGAL).plan;
  assert.equal(plan.kind, 'FURNITURE');
  // 有效释放 → 先起冷却（与 ThreeGame.useSkillQ 的顺序一致）。
  if (plan.armsCooldown) cooldown.arm();
  assert.equal(cooldown.ready, false);
  assert.equal(cooldown.remainingMs, GAME_CONFIG.humanSearch.cooldownMs);
  assert.equal(cooldown.remainingSeconds, 12);
  // 冷却中的下一次 Q：直接拒绝，既不搜查也不产生新的冷却。
  const blockedPlan = resolvePlayerQPlan({ cooldownReady: cooldown.ready,
    remainingSeconds: cooldown.remainingSeconds, exposedTargetAvailable: false,
    furnitureTarget: env.resolve(BED_LEGAL, { pointing: {
      headingRad: headingToward(BED_LEGAL, 'second_bed'),
      halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg } }).pointedLegalTarget });
  assert.equal(blockedPlan.kind, 'REJECT_COOLDOWN');
  assert.equal(blockedPlan.armsCooldown, false);
  assert.match(blockedPlan.message, /冷却中/);
  assert.equal(humanSearchGate({ ready: cooldown.ready,
    remainingSeconds: cooldown.remainingSeconds }).ok, false);
  // 冷却按正式玩法时间推进：12 秒后恢复可用（暂停 / 冻结时不会推进）。
  cooldown.advance(GAME_CONFIG.humanSearch.cooldownMs - 1);
  assert.equal(cooldown.ready, false);
  cooldown.advance(1);
  assert.equal(cooldown.ready, true);
});

test('outside every region Q falls back to the ordinary fan capture, which also costs cooldown', () => {
  const env = harness();
  const { resolution, plan } = pressQ(env, LIVING_FREE);
  assert.equal(resolution.code, 'NONE');
  assert.equal(plan.kind, 'FAN');
  assert.equal(plan.armsCooldown, true, '扇形未命中同样消耗 12 秒冷却');
  assert.equal(plan.spotId, null);
  // 普通扇形：半径 1.5 / 张角 120° / 墙门遮挡仍然照旧生效。
  const visible = { concealed: false, position: { x: LIVING_FREE.x + 0.6, z: LIVING_FREE.z },
    spotId: null, furniture: null };
  const captured = evaluateHumanSearch({ origin: LIVING_FREE, headingRad: 0,
    target: visible, lineBlocked: () => false });
  assert.equal(captured.code, 'HIT_VISIBLE');
  assert.equal(captured.outcome, 'CAPTURE_VISIBLE');
  // 目标在扇形之外 → 未命中，但冷却照样已经消耗。
  const behind = evaluateHumanSearch({ origin: LIVING_FREE, headingRad: 0,
    target: { ...visible, position: { x: LIVING_FREE.x - 0.6, z: LIVING_FREE.z } },
    lineBlocked: () => false });
  assert.equal(behind.outcome, 'MISS');
  assert.equal(behind.code, 'OUTSIDE_FAN');
  // 藏身目标不会因为「真实坐标」被普通扇形抓到：藏身时瞄的是家具表面。
  const concealed = evaluateHumanSearch({ origin: LIVING_FREE, headingRad: 0,
    target: { concealed: true, position: { x: LIVING_FREE.x + 0.4, z: LIVING_FREE.z },
      spotId: 'hide_living_carton', furniture: null }, lineBlocked: () => false });
  assert.equal(concealed.outcome, 'MISS');
  assert.equal(concealed.code, 'EMPTY_HIDE_SPOT');
});

test('a furniture that moved or left the map is refused instead of searched', () => {
  const env = harness();
  const target = env.resolve(BED_LEGAL).legalTarget;
  // 家具已不在当前地图：拒绝执行，也不读占用。
  const gone = searchFurniture(env, BED_LEGAL, target, { occupancyReads: 0 });
  assert.equal(gone.code, 'MISS_EMPTY');
  const removed = searchFurniture(env, BED_LEGAL, target,
    { furniture: FURNITURE.filter(rect => rect.id !== 'second_bed'),
      occupied: 'hide_second_bed' });
  assert.equal(removed.code, 'PLAN_STALE');
  assert.equal(removed.executable, false);
  assert.equal(removed.occupancyReads, 0);
  // 藏身点也不在当前地图：同样拒绝。
  const noSpot = searchFurniture(env, BED_LEGAL, target,
    { hideSpots: HIDE_SPOTS.filter(spot => spot.id !== 'hide_second_bed'),
      occupied: 'hide_second_bed' });
  assert.equal(noSpot.code, 'PLAN_STALE');
  assert.equal(noSpot.occupancyReads, 0);
  // 没有目标（不在任何区域内）时不会有家具搜查。
  const none = searchFurniture(env, LIVING_FREE, null, { occupied: 'hide_second_bed' });
  assert.equal(none.code, 'NO_TARGET');
  assert.equal(none.occupancyReads, 0);
  // 家具被移动之后，同一个站位不再合法 → 高亮与目标立刻消失（公开解析重新算）。
  const movedAway = FURNITURE.map(rect => rect.id === 'second_bed'
    ? { ...rect, x: rect.x + 6 } : rect);
  const after = env.resolve(BED_LEGAL, { furniture: movedAway });
  assert.equal(after.legalTarget, null);
});

test('the two Q skills and the E interaction of DeepSeek do not regress', () => {
  // Q 仍然按阵营分流：DeepSeek 锁门、Human 扇形（家具搜查只是 Human 分支内部的一种用途）。
  assert.equal(resolveQSkill('DEEPSEEK'), 'LOCK_DOOR');
  assert.equal(resolveQSkill('HUMAN'), 'FAN_SEARCH');
  assert.equal(resolveQSkill(null), 'NONE');
  // DeepSeek 的 E 仍然先仲裁出门 / 藏身 / 进食，且藏身中 E 只用于退出。
  assert.equal(resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: { distance: 0.9 }, rice: { distance: 2 }, hide: { spotId: 'hide_second_bed' } }),
  'DOOR');
  assert.equal(resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: null, rice: null, hide: { spotId: 'hide_second_bed' } }), 'HIDE_ENTER');
  assert.equal(resolveInteractionIntent({ minesweeperOpen: false, concealed: true,
    door: { distance: 0.5 }, rice: { distance: 0.5 }, hide: null }), 'HIDE_EXIT');
  // 藏身状态机本身不变：进入需要 DEEPSEEK + 人工控制 + 合法位置，退出沿用同一位置。
  const hide = new HideSystem();
  const entered = hide.enter({ phase: 'PLAYING', faction: 'DEEPSEEK',
    playerControlled: true, position: BED_LEGAL, spotId: 'hide_second_bed',
    spotCode: 'LEGAL', spotLegal: true, captureProgressMs: 0, sprintState: 'NORMAL' });
  assert.equal(entered.ok, true);
  assert.equal(hide.isConcealed('DEEPSEEK'), true);
  assert.deepEqual(hide.entryPosition, BED_LEGAL);
  const wrongFaction = new HideSystem();
  assert.equal(wrongFaction.enter({ phase: 'PLAYING', faction: 'HUMAN',
    playerControlled: true, position: BED_LEGAL, spotId: 'hide_second_bed',
    spotCode: 'LEGAL', spotLegal: true, captureProgressMs: 0,
    sprintState: 'NORMAL' }).code, 'WRONG_FACTION');
  const exited = hide.exit('PLAYER_E');
  assert.equal(exited.ok, true);
  assert.equal(hide.state, 'OUTSIDE');
});
