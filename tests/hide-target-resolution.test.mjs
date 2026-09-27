import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { resolveHideInteractionTarget, resolvePlayerQPlan, HIDE_TARGET_CODE_TEXT }
  from '../src/systems/HideTargetResolution.ts';
import { furnitureApproachSurfacePoint }
  from '../src/three/map/HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, WALLS }
  from '../src/three/map/apartmentMap.ts';

// S7C-2 修复轮 二 / 三：**公开家具交互目标的唯一解析函数**。
//
// 这段逻辑以前只写在 ThreeGame 的 `nearestHideCandidate()` 里，服务 DeepSeek 玩家按
// E 藏身。现在 Human 玩家按 Q 搜查家具复用同一套公开解析，因此必须能独立验证：
//   ① 只看公开数据（家具 / 藏身点 / 真实碰撞 / 真实导航 / 真实门态），绝不读占用；
//   ② 确定性：同样的公开输入必然得到同样的唯一目标（不是数组顺序，也不是随机）；
//   ③ 区域内「最近」「合法」「合法且被指向」是三个不同的概念（Q 只认最后一个）；
//   ④ Q 的输入优先级（冷却 → 暴露目标 → 指向家具 → 普通扇形）是一条可枚举的纯规则。

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
  const standable = point => collision.canOccupyStaticXZ(point.x, point.z,
    GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
  return { collision, navigation, doors, world, resolve, standable };
}

test('the exact number of furniture interaction regions is entered and ranked by anchor distance', () => {
  const env = harness();
  // 次卧床的正锚点附近：区域内、合法。
  const inside = env.resolve({ x: -11.3, z: 10.8 });
  assert.equal(inside.code, 'LEGAL');
  assert.equal(inside.legal, true);
  assert.equal(inside.spotId, 'hide_second_bed');
  assert.equal(inside.furnitureId, 'second_bed');
  assert.equal(inside.candidatesInRegion, 1);
  assert.deepEqual(inside.legalTarget.spotId, 'hide_second_bed');
  // 未传 `pointing` 时不做任何朝向过滤（DeepSeek 玩家 E 藏身走的正是这条路径），
  // 因此「合法且被指向」与「合法」是同一个目标。
  assert.equal(inside.pointedLegalTarget.spotId, 'hide_second_bed');
  assert.equal(inside.pointedLegalTarget.pointed, true);
  assert.ok(Number.isNaN(inside.pointedLegalTarget.pointingDeltaDeg));
  // 完全不在任何区域内：没有目标，也没有「最近匹配」。
  const outside = env.resolve({ x: 2, z: 3 });
  assert.equal(outside.code, 'NONE');
  assert.equal(outside.spotId, null);
  assert.equal(outside.target, null);
  assert.equal(outside.legalTarget, null);
  assert.equal(outside.pointedLegalTarget, null);
  assert.equal(outside.candidatesInRegion, 0);
});

test('the real map has exactly the regions we think it has, and every non-legal code is reachable', () => {
  const env = harness();
  // 真实地图上「区域内但不合法」的样本（都不是编造的点，而是真实几何算出来的）：
  // ① 站在区域内、但与家具之间被墙 / 别的家具挡住 → SURFACE_BLOCKED。
  const blocked = env.resolve({ x: 14.5, z: -4.8 });
  assert.equal(blocked.spotId, 'hide_storage_carton');
  assert.equal(blocked.code, 'SURFACE_BLOCKED');
  assert.equal(blocked.legal, false);
  assert.equal(blocked.legalTarget, null);
  // ② 区域内但真实碰撞体站不住（撞在家具上）→ NOT_STANDABLE。
  const notStandable = env.resolve({ x: -14.2, z: -6.3 });
  assert.equal(notStandable.spotId, 'hide_main_bed');
  assert.equal(notStandable.code, 'NOT_STANDABLE');
  assert.equal(env.standable({ x: -14.2, z: -6.3 }), false);
  // ③ 区域内但没有可用导航格 → NOT_NAVIGABLE。
  const notNavigable = env.resolve({ x: 7.5, z: 4.6 });
  assert.equal(notNavigable.spotId, 'hide_living_carton');
  assert.equal(notNavigable.code, 'NOT_NAVIGABLE');
  // 四个中文说明必须齐备（DEV / HUD 直接显示）。
  for (const code of ['LEGAL', 'OUTSIDE_REGION', 'NOT_STANDABLE', 'SURFACE_BLOCKED',
    'NOT_NAVIGABLE', 'NOT_REACHABLE', 'NONE'])
    assert.ok(HIDE_TARGET_CODE_TEXT[code]?.length > 0, `缺中文说明：${code}`);
});

test('the resolution is deterministic and never depends on who is hidden where', () => {
  const env = harness();
  const point = { x: -11.3, z: 10.8 };
  const first = env.resolve(point);
  for (let index = 0; index < 5; index++) {
    const again = env.resolve(point);
    assert.equal(again.spotId, first.spotId, '同样的公开输入必须得到同样的目标');
    assert.equal(again.code, first.code);
    assert.equal(again.candidatesInRegion, first.candidatesInRegion);
  }
  // 结构上就不可能读占用：解析函数的输入里没有任何占用 / 隐藏状态字段，
  // 源码里也不得出现 HideSystem、占用查询或隐藏坐标。
  const source = readFileSync(new URL('../src/systems/HideTargetResolution.ts',
    import.meta.url), 'utf8');
  assert.doesNotMatch(source, /HideSystem|occupancyOf|isConcealed|entryPosition/,
    '公开目标解析绝不能读取占用状态或真实藏身位置');
  assert.doesNotMatch(source, /concealedSpotId|hideSpotId\s*:/,
    '公开目标解析里不得出现「谁藏在哪」的字段');
});

test('two overlapping regions still resolve to exactly one furniture', () => {
  const env = harness();
  // 真实地图上 8 个交互区域互不重叠（这是一个事实，不是假设）。为了验证「重叠时
  // 仍然只有一个目标」这条规则，这里把储物间纸箱搬到客厅纸箱旁边：几何仍然全部
  // 由真实的 `hideRegionSetup` / `pointInHideRegion` / `checkHideRegionPosition` 计算。
  const movedFurniture = FURNITURE.map(rect => rect.id === 'storage_carton'
    ? { ...rect, x: 9.6, z: 3.9 } : rect);
  const movedSpots = (anchorX) => HIDE_SPOTS.map(spot => spot.id === 'hide_storage_carton'
    ? { ...spot, x: anchorX, z: 3.9 } : spot);
  const overlapPoint = { x: 8.6, z: 4.4 };
  const both = env.resolve(overlapPoint, { spots: movedSpots(9.5),
    furniture: movedFurniture });
  // 这一点真的同时落在两个区域内。
  assert.equal(both.candidatesInRegion, 2, '构造样本必须真的落在两个交互区域里');
  // 「最近锚点」与「合法」是两个独立概念：最近的那件被挡住时，Q 只认合法的那件。
  assert.equal(both.spotId, 'hide_storage_carton', '最近锚点决定 target');
  assert.equal(both.code, 'SURFACE_BLOCKED');
  assert.equal(both.legalTarget.spotId, 'hide_living_carton', '合法目标必须是另一件');
  // 把储物间纸箱的锚点挪远一点，两者一致：目标与合法目标都是客厅纸箱。
  const consistent = env.resolve(overlapPoint, { spots: movedSpots(10.4),
    furniture: movedFurniture });
  assert.equal(consistent.candidatesInRegion, 2);
  assert.equal(consistent.spotId, 'hide_living_carton');
  assert.equal(consistent.code, 'LEGAL');
  assert.equal(consistent.legalTarget.spotId, 'hide_living_carton');
  // 修复轮 三：「被指向」是第三条判据。储物间纸箱在这个构造里被客厅纸箱挡住
  // （不合法），因此：指向客厅纸箱 → 目标就是它；指向那件**不合法**的储物间纸箱
  // （同时背对客厅纸箱）→ 这次没有任何可搜查家具（不能因为「区域里还有另一件合法的」
  // 就把玩家没在看的家具塞给他）。
  const headingTo = id => {
    const rect = movedFurniture.find(item => item.id === id);
    const aim = furnitureApproachSurfacePoint(rect, overlapPoint);
    return Math.atan2(aim.z - overlapPoint.z, aim.x - overlapPoint.x);
  };
  const pointing = headingRad => ({ headingRad,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg });
  const towardLiving = env.resolve(overlapPoint, { spots: movedSpots(10.4),
    furniture: movedFurniture, pointing: pointing(headingTo('living_carton')) });
  assert.equal(towardLiving.pointedLegalTarget.spotId, 'hide_living_carton');
  assert.equal(towardLiving.pointedLegalTarget.pointed, true);
  assert.ok(towardLiving.pointedLegalTarget.pointingDeltaDeg < 5);
  const towardBlocked = env.resolve(overlapPoint, { spots: movedSpots(10.4),
    furniture: movedFurniture, pointing: pointing(headingTo('storage_carton')) });
  assert.equal(towardBlocked.legalTarget.spotId, 'hide_living_carton');
  assert.equal(towardBlocked.pointedLegalTarget, null,
    '指向不合法的家具时不得改选另一件（那会违反「UI 与技能层同一目标」）');
  // 两件家具都合法且都被指向的场景由 `tests/player-q-priority.test.mjs` §四.4 覆盖。
  // 任何一次解析都只返回一个目标：没有数组、没有「同时高亮两件」的可能。
  for (const result of [both, consistent, towardLiving]) {
    assert.equal(Object.prototype.toString.call(result.target), '[object Object]');
    assert.equal(Object.prototype.toString.call(result.legalTarget), '[object Object]');
    assert.equal(Object.prototype.toString.call(result.pointedLegalTarget),
      '[object Object]');
    assert.equal(typeof result.spotId, 'string');
  }
  // 同一个公开输入重复解析仍然是同一个结果（确定性也覆盖重叠场景）。
  assert.equal(env.resolve(overlapPoint, { spots: movedSpots(9.5),
    furniture: movedFurniture }).spotId, both.spotId);
});

test('player Q priority: cooldown, then an exposed target, then the pointed furniture', () => {
  const env = harness();
  const furnitureTarget = env.resolve({ x: -11.3, z: 10.8 }).pointedLegalTarget;
  assert.ok(furnitureTarget);
  // ① 冷却中：直接拒绝，不产生任何新的冷却，也不给出「Q 可用」的提示。
  const cooling = resolvePlayerQPlan({ cooldownReady: false, remainingSeconds: 8.4,
    exposedTargetAvailable: true, furnitureTarget });
  assert.equal(cooling.kind, 'REJECT_COOLDOWN');
  assert.equal(cooling.reason, 'COOLDOWN');
  assert.equal(cooling.armsCooldown, false);
  assert.match(cooling.message, /冷却中：剩 8\.4 秒/);
  assert.equal(cooling.spotId, null);
  assert.equal(cooling.furnitureId, null);
  // ② 有合法暴露目标：即使有被指向的家具也必须抓人（用户本轮批准的第一优先级）。
  const exposed = resolvePlayerQPlan({ cooldownReady: true, remainingSeconds: 0,
    exposedTargetAvailable: true, furnitureTarget });
  assert.equal(exposed.kind, 'FAN');
  assert.equal(exposed.reason, 'EXPOSED_TARGET');
  assert.equal(exposed.spotId, null);
  assert.equal(exposed.armsCooldown, true);
  // ③ 没有暴露目标但有「合法 + 被指向」的家具：只搜查这件家具。
  const furniture = resolvePlayerQPlan({ cooldownReady: true, remainingSeconds: 0,
    exposedTargetAvailable: false, furnitureTarget });
  assert.equal(furniture.kind, 'FURNITURE');
  assert.equal(furniture.reason, 'FURNITURE');
  assert.equal(furniture.spotId, 'hide_second_bed');
  assert.equal(furniture.furnitureId, 'second_bed');
  assert.equal(furniture.armsCooldown, true, '搜中 / 搜空都消耗同一份冷却');
  assert.equal(furniture.message, null);
  // ④ 什么都没有：普通扇形空挥，同样消耗冷却。
  const fan = resolvePlayerQPlan({ cooldownReady: true, remainingSeconds: 0,
    exposedTargetAvailable: false, furnitureTarget: null });
  assert.equal(fan.kind, 'FAN');
  assert.equal(fan.reason, 'NO_TARGET');
  assert.equal(fan.spotId, null);
  assert.equal(fan.armsCooldown, true, '扇形未命中同样消耗冷却');
  // 四种结果是互斥的：任何时候只可能命中一个分支。
  assert.equal(new Set([cooling.reason, exposed.reason, furniture.reason,
    fan.reason]).size, 4);
  assert.equal(new Set([cooling.kind, exposed.kind, furniture.kind]).size, 3);
});
