import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { createDeepSeekHideMapSnapshot, selectHideSpot }
  from '../src/systems/DeepSeekHideCandidates.ts';
import { pointInHideRegion, hideRegionSetup }
  from '../src/three/map/HideInteractionRegion.ts';
import { HIDE_SPOTS, FURNITURE } from '../src/three/map/apartmentMap.ts';
import { createDeepSeekHideEnv } from './deepseek-ai-walk.mjs';

// S7C-2b H1：公开候选层的纯逻辑与真实几何。全部用真实地图、真实 CollisionWorld、
// 真实 NavigationSystem、真实视觉几何，不新建任何第二套判定。

const spotOf = id => HIDE_SPOTS.find(spot => spot.id === id);

function singleSpotMap(id, revision = 1) {
  return createDeepSeekHideMapSnapshot({ hideSpots: [spotOf(id)],
    furniture: FURNITURE, revision });
}

function candidateInput(env, map, position, threat, extra = {}) {
  return { map, position, doors: env.doors.doors, threat, world: env.world,
    nowMs: 0, ...extra };
}

test('公开快照只绑定当前地图上真实存在的家具，未知家具的藏身点被排除', () => {
  const snapshot = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
    furniture: FURNITURE, revision: 7 });
  assert.equal(snapshot.revision, 7);
  assert.equal(snapshot.spots.length, HIDE_SPOTS.length);
  for (const entry of snapshot.spots) {
    assert.equal(entry.furniture.id, entry.spot.furnitureId);
    assert.equal(snapshot.furniture.includes(entry.furniture), true);
  }
  const orphan = { ...spotOf('hide_main_bed'), id: 'hide_orphan',
    furnitureId: 'not_in_map' };
  const pruned = createDeepSeekHideMapSnapshot({ hideSpots: [orphan],
    furniture: FURNITURE, revision: 8 });
  assert.deepEqual(pruned.spots, []);
});

test('缺少地图或缺少已知威胁时明确回落，不做任何猜测', () => {
  const env = createDeepSeekHideEnv();
  const map = singleSpotMap('hide_living_carton');
  assert.equal(selectHideSpot(candidateInput(env, null, { x: 1, z: 1 },
    { x: 2, z: 1 })).code, 'NO_MAP');
  assert.equal(selectHideSpot(candidateInput(env, map, { x: 1, z: 1 }, null)).code,
    'NO_THREAT');
});

test('真实地图上 8 个藏身点各自都存在合法候选，且站位是真实导航格心', () => {
  const env = createDeepSeekHideEnv();
  for (const spot of HIDE_SPOTS) {
    const map = singleSpotMap(spot.id);
    const result = selectHideSpot(candidateInput(env, map, { x: spot.x, z: spot.z },
      { x: spot.x - 1, z: spot.z }));
    assert.equal(result.ok, true, `${spot.id} 没有合法候选：${result.reason}`);
    assert.equal(result.candidate.spotId, spot.id);
    const stance = result.candidate.stancePoint;
    const setup = hideRegionSetup(spot, FURNITURE);
    assert.equal(pointInHideRegion(setup.geometry, stance), true,
      `${spot.id} 的候选站位必须落在精确交互区域内`);
    assert.equal(env.collision.canOccupyStaticXZ(stance.x, stance.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight), true,
      `${spot.id} 的候选站位必须真实可站立（不得落在家具内部）`);
    const cell = env.navigation.nearestFree(stance, env.doors.doors);
    assert.equal(Math.hypot(cell.x - stance.x, cell.z - stance.z) < 1e-9, true,
      `${spot.id} 的候选站位必须本身就是导航格心（A* 终点即可行走点）`);
  }
});

test('候选排序是确定的：同一输入两次得到同一个点、同一个站位与同一个评分', () => {
  const env = createDeepSeekHideEnv();
  const map = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
    furniture: FURNITURE, revision: 3 });
  const input = candidateInput(env, map, { x: 7.4, z: 3.6 }, { x: 6.2, z: 3.6 });
  const first = selectHideSpot(input);
  const second = selectHideSpot(input);
  assert.equal(first.ok, true);
  assert.equal(first.candidate.spotId, second.candidate.spotId);
  assert.deepEqual(first.candidate.stancePoint, second.candidate.stancePoint);
  assert.equal(first.candidate.score, second.candidate.score);
  // 评估明细的次序也必须稳定（DEV 面板与日志都按这个次序读）。
  assert.deepEqual(first.evaluations.map(entry => entry.spotId),
    second.evaluations.map(entry => entry.spotId));
});

test('全部候选都在冷却时明确给出 ALL_COOLED，而不是硬选一个点', () => {
  const env = createDeepSeekHideEnv();
  const map = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
    furniture: FURNITURE, revision: 4 });
  const cooldowns = HIDE_SPOTS.map(spot => ({ spotId: spot.id, remainingMs: 5_000 }));
  const result = selectHideSpot(candidateInput(env, map, { x: 7.4, z: 3.6 },
    { x: 6.2, z: 3.6 }, { cooldowns }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ALL_COOLED');
  assert.equal(result.candidate, null);
  assert.equal(result.evaluations.every(entry => entry.code === 'REJECTED_COOLDOWN'), true);
});

test('区域里没有可用格心时回落 NO_LEGAL_STANCE（不伪造一个候选）', () => {
  const env = createDeepSeekHideEnv();
  const map = createDeepSeekHideMapSnapshot({ hideSpots: [], furniture: FURNITURE,
    revision: 5 });
  const result = selectHideSpot(candidateInput(env, map, { x: 7.4, z: 3.6 },
    { x: 6.2, z: 3.6 }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'NO_LEGAL_STANCE');
  assert.equal(result.legalStanceCount, 0);
});

test('近期藏身点惩罚让刚藏过的点失去优先权，并且不改变公开数据', () => {
  const env = createDeepSeekHideEnv();
  const map = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
    furniture: FURNITURE, revision: 6 });
  const position = { x: 7.4, z: 3.6 };
  const threat = { x: 6.2, z: 3.6 };
  const plain = selectHideSpot(candidateInput(env, map, position, threat));
  const penalized = selectHideSpot(candidateInput(env, map, position, threat,
    { recentSpots: HIDE_SPOTS.map(spot => ({ spotId: spot.id, atMs: 0 })) }));
  const entryOf = (result, id) => result.evaluations.find(item => item.spotId === id);
  const before = entryOf(plain, 'hide_living_carton');
  const after = entryOf(penalized, 'hide_living_carton');
  assert.equal(after.score < before.score, true,
    '近期藏身惩罚必须真实降低该点的公开评分');
  assert.equal(after.recentPenalty > 0, true);
});

test('公开候选层源码里不出现任何占用或对手真值入口', () => {
  const source = readFileSync(new URL('../src/systems/DeepSeekHideCandidates.ts',
    import.meta.url), 'utf8');
  assert.doesNotMatch(source, /occupancy|isConcealed|readOccupancy|humanPosition/i);
  assert.doesNotMatch(source, /DeepSeekVisualTarget|HideSearchView|resolvePlayerQPlan/,
    '玩家专用提示层与按键仲裁不得进入 NPC 决策');
});

test('freeCellsWithin 只返回半径内的真实空闲格心，并排除被锁住的门口格', () => {
  const env = createDeepSeekHideEnv();
  const centre = { x: 0, z: 0 };
  const cells = env.navigation.freeCellsWithin(centre, 1.0, env.doors.doors);
  assert.equal(cells.length > 0, true);
  for (const cell of cells) {
    assert.equal(Math.hypot(cell.x - centre.x, cell.z - centre.z) <= 1.0, true);
    assert.equal(env.collision.canOccupyStaticXZ(cell.x, cell.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight), true);
  }
  const door = env.doors.definition('door_living_entry');
  assert.equal(env.doors.get('door_living_entry').state, 'CLOSED');
  assert.equal(env.doors.lock('door_living_entry', 'DEEPSEEK'), 'LOCKED');
  const afterLock = env.navigation.freeCellsWithin({ x: door.x, z: door.z }, 0.6,
    env.doors.doors);
  assert.equal(afterLock.every(cell =>
    Math.hypot(cell.x - door.x, cell.z - door.z) > 0), true,
  '被锁住的门口格不得成为藏身候选站位');
});
