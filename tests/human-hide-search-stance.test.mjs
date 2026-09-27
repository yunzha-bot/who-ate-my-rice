import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, WALLS }
  from '../src/three/map/apartmentMap.ts';
import { REGION_NAV_SNAP_LIMIT } from '../src/three/map/HideInteractionRegion.ts';
import { circleIntersectsRect, distanceToRect } from '../src/three/map/RotatedRect.ts';
import { evaluateHumanSearchGeometry } from '../src/systems/HumanSearchSkill.ts';
import { furnitureSurfaceSamples, planHideSearchStance }
  from '../src/systems/HumanHideSearchStance.ts';
import { STANCE_STAND_OFF } from '../src/systems/HumanSearchTuning.ts';

// S7C-2 Human AI 搜查站位：必须满足 Human 自己的真实要求（角色圆碰撞、真实导航格
// 与 A*、批准半径 1.5、前方 120° 扇形、墙与非 OPEN 门叶遮挡），且面向家具的
// 可搜查表面而不是家具中心。这里用真实地图与真实几何接口验证。

function apartment() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, 3);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  return { collision, navigation, doors, perception };
}

const world = apartment();
const furnitureById = new Map(FURNITURE.map(rect => [rect.id, rect]));

function stanceWorld(overrides = {}) {
  return {
    standable: point => world.collision.canOccupyStaticXZ(point.x, point.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight),
    navigationCell: point => world.navigation.nearestFree(point, world.doors.doors),
    pathNodes: point => world.navigation.findPath(
      { x: 6.2, z: 9.7 }, point, world.doors.doors)?.length ?? null,
    lineBlocked: (a, b) => world.perception
      .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
    ...overrides,
  };
}

test('every authored hide spot has a legal search stance on the real map', () => {
  for (const spot of HIDE_SPOTS) {
    const furniture = furnitureById.get(spot.furnitureId);
    assert.ok(furniture, `${spot.id} 必须能解析到家具`);
    const plan = planHideSearchStance(spot.id, furniture, { x: 6.2, z: 9.7 },
      stanceWorld());
    assert.equal(plan.code, 'READY', `${spot.id} 应当能找到合法搜查站位：${plan.reason}`);
    const stance = plan.stance;
    assert.ok(stance);
    // ① Human 角色圆碰撞合法。
    assert.ok(world.collision.canOccupyStaticXZ(stance.stancePoint.x, stance.stancePoint.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight));
    // ② 落在真实导航格上（吸附距离在既有上限内）。
    assert.ok(Math.hypot(stance.navigationCell.x - stance.stancePoint.x,
      stance.navigationCell.z - stance.stancePoint.z) <= REGION_NAV_SNAP_LIMIT);
    // ③ 与可搜查表面的距离在批准的 1.5 世界单位内。
    assert.ok(stance.surfaceDistance <= GAME_CONFIG.humanSearch.range,
      `${spot.id} 站位距离 ${stance.surfaceDistance} 必须在 1.5 内`);
    // ④ 朝向落在前方 120° 扇形内，且没有墙 / 非 OPEN 门遮挡。
    const geometry = evaluateHumanSearchGeometry({
      origin: stance.stancePoint, headingRad: stance.headingRad,
      aimPoint: stance.surfacePoint, range: GAME_CONFIG.humanSearch.range,
      halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
      lineBlocked: (a, b) => world.perception
        .inspectVision(a, b, Number.POSITIVE_INFINITY).status !== 'VISIBLE',
    });
    assert.equal(geometry.code, 'IN_RANGE', `${spot.id} 站位几何必须成立`);
    assert.ok(Math.abs(geometry.angleDeltaDeg) < 1e-6, '朝向必须正对可搜查表面');
    // ⑤ 站位在家具真实足迹之外，不能站进家具里。
    assert.equal(circleIntersectsRect(stance.stancePoint.x, stance.stancePoint.z,
      GAME_CONFIG.collision.playerRadius, furniture), false,
    `${spot.id} 站位不得与家具足迹重叠`);
    // ⑥ 表面点确实在家具足迹上（不是中心）。
    assert.ok(distanceToRect(stance.surfacePoint, furniture) < 1e-9,
      `${spot.id} 瞄点必须是家具表面点`);
    assert.ok(Math.hypot(stance.surfacePoint.x - furniture.x,
      stance.surfacePoint.z - furniture.z) > 1e-6);
  }
});

test('the stance stand-off is inside the range and outside the actor radius', () => {
  const spot = HIDE_SPOTS.find(entry => entry.id === 'hide_living_carton');
  const furniture = furnitureById.get(spot.furnitureId);
  const plan = planHideSearchStance(spot.id, furniture, { x: 2, z: 3 }, stanceWorld());
  const stance = plan.stance;
  assert.ok(stance);
  assert.ok(Math.abs(stance.surfaceDistance - STANCE_STAND_OFF) < 1e-9,
    '站位应当正好按 STANCE_STAND_OFF 贴在家具表面上');
  assert.ok(STANCE_STAND_OFF > GAME_CONFIG.collision.playerRadius,
    '间距必须大于角色碰撞圆半径，否则会一直触发接触边界');
  assert.ok(STANCE_STAND_OFF < GAME_CONFIG.humanSearch.range);
});

test('rotated furniture is searched on its true rotated outline', () => {
  const spot = HIDE_SPOTS.find(entry => entry.id === 'hide_storage_carton');
  const rotated = { ...furnitureById.get(spot.furnitureId), rotation: Math.PI / 4 };
  const samples = furnitureSurfaceSamples(rotated);
  assert.ok(samples.length > 0);
  for (const sample of samples)
    assert.ok(distanceToRect(sample, rotated) < 1e-9, '采样点必须落在真实旋转轮廓上');
  const plan = planHideSearchStance(spot.id, rotated, { x: 16.6, z: -4.8 }, stanceWorld());
  assert.equal(plan.code, 'READY', plan.reason);
  assert.equal(circleIntersectsRect(plan.stance.stancePoint.x, plan.stance.stancePoint.z,
    GAME_CONFIG.collision.playerRadius, rotated), false,
  '旋转家具的站位也必须落在真实旋转足迹之外');
});

test('furniture surface sampling is deterministic and spaced by nav cell size', () => {
  const rect = furnitureById.get('storage_shelf');
  const first = furnitureSurfaceSamples(rect);
  const second = furnitureSurfaceSamples(rect);
  assert.deepEqual(first, second);
  // 4 条边、步长 0.4 世界单位；每条边至少一个采样点。
  const expected = Math.ceil(rect.width / 0.4) + Math.ceil(rect.depth / 0.4) +
    Math.ceil(rect.width / 0.4) + Math.ceil(rect.depth / 0.4);
  assert.equal(first.length, expected);
});

test('an impossible world is reported as a refusal instead of a silent success', () => {
  const spot = HIDE_SPOTS.find(entry => entry.id === 'hide_living_carton');
  const furniture = furnitureById.get(spot.furnitureId);
  const notStandable = planHideSearchStance(spot.id, furniture, { x: 2, z: 3 },
    stanceWorld({ standable: () => false }));
  assert.equal(notStandable.code, 'NOT_STANDABLE');
  assert.equal(notStandable.stance, null);
  const blocked = planHideSearchStance(spot.id, furniture, { x: 2, z: 3 },
    stanceWorld({ lineBlocked: () => true }));
  assert.equal(blocked.code, 'SURFACE_BLOCKED');
  const unreachable = planHideSearchStance(spot.id, furniture, { x: 2, z: 3 },
    stanceWorld({ pathNodes: () => null }));
  assert.equal(unreachable.code, 'UNREACHABLE');
  const noCell = planHideSearchStance(spot.id, furniture, { x: 2, z: 3 },
    stanceWorld({ navigationCell: () => null }));
  assert.equal(noCell.code, 'NOT_NAVIGABLE');
  // 探测次数有确定上限，且报告里给出可读原因。
  assert.ok(unreachable.probes <= 8);
  assert.ok(unreachable.reason.length > 0);
});
