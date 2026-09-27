import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { createDeepSeekHideMapSnapshot, selectHideSpot }
  from '../src/systems/DeepSeekHideCandidates.ts';
import { resolveDeepSeekAiHideEntry, humanBlocksHideExit }
  from '../src/systems/DeepSeekHideResolution.ts';
import { pointInHideRegion, hideRegionSetup }
  from '../src/three/map/HideInteractionRegion.ts';
import { FURNITURE, HIDE_SPOTS, SPAWNS } from '../src/three/map/apartmentMap.ts';
import { createDeepSeekHideEnv } from './deepseek-ai-walk.mjs';

// S7C-2b H1/H3 的真实地图集成：8 个藏身点都要有真实合法候选，两个出生点都要能走到，
// 并且权威进入层必须真正拦住「位置不合法 / 没走到位 / 计划失效」三类请求。

const fullMap = () => createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
  furniture: FURNITURE, revision: 1 });

function spotMap(id) {
  return createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS.filter(spot => spot.id === id),
    furniture: FURNITURE, revision: 1 });
}

function select(env, map, position, threat, extra = {}) {
  return selectHideSpot({ map, position, doors: env.doors.doors, threat, world: env.world,
    nowMs: 0, ...extra });
}

test('每个藏身点从两个出生点都能选到「区域内 + 可站立 + 真实导航格」的候选', () => {
  for (const spawnName of ['deepseek', 'human']) {
    const spawn = SPAWNS[spawnName];
    const env = createDeepSeekHideEnv({ start: spawn });
    for (const spot of HIDE_SPOTS) {
      const result = select(env, spotMap(spot.id), { x: spawn.x, z: spawn.z },
        { x: spot.x - 1.5, z: spot.z });
      assert.equal(result.ok, true,
        `${spawnName} 出生点无法为 ${spot.id} 找到候选：${result.code}`);
      const stance = result.candidate.stancePoint;
      const setup = hideRegionSetup(spot, FURNITURE);
      assert.equal(pointInHideRegion(setup.geometry, stance), true, `${spot.id} 必须在区域内`);
      assert.equal(env.collision.canOccupyStaticXZ(stance.x, stance.z,
        GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight), true,
      `${spot.id} 的候选站位不得落在家具内部或墙里`);
      assert.equal(result.candidate.path.length > 0, true);
    }
  }
});

test('整张地图一起评估时也能选出确定的一个公开候选，并按位置真实可达', () => {
  const env = createDeepSeekHideEnv({ start: { x: 7.4, z: 3.6 } });
  const result = select(env, fullMap(), { x: 7.4, z: 3.6 }, { x: 6.0, z: 3.6 });
  assert.equal(result.ok, true);
  assert.equal(result.legalStanceCount >= 1, true);
  const stance = result.candidate.stancePoint;
  const path = env.navigation.findPath({ x: 7.4, z: 3.6 }, stance, env.doors.doors);
  assert.ok(path?.length, '被选中的候选必须从当前位置 A* 可达');
});

test('权威进入层逐条拒绝：点已失效 / 没有规划站位 / 没走到位 / 位置不合法', () => {
  const env = createDeepSeekHideEnv();
  const map = fullMap();
  const base = { map, doors: env.doors.doors, world: env.world,
    waypointTolerance: GAME_CONFIG.deepseekAI.waypointTolerance,
    contactEpsilon: GAME_CONFIG.collision.contactEpsilon };
  const bed = FURNITURE.find(rect => rect.id === 'main_bed');
  const stance = select(env, spotMap('hide_main_bed'), { x: bed.x + 2, z: bed.z },
    { x: bed.x + 3, z: bed.z }).candidate.stancePoint;

  assert.equal(resolveDeepSeekAiHideEntry({ ...base, spotId: 'hide_missing',
    position: stance, plannedStancePoint: stance }).code, 'NO_HIDE_SPOT');
  assert.equal(resolveDeepSeekAiHideEntry({ ...base, spotId: 'hide_main_bed',
    position: stance, plannedStancePoint: null }).code, 'NO_PLANNED_STANCE');
  assert.equal(resolveDeepSeekAiHideEntry({ ...base, spotId: 'hide_main_bed',
    position: { x: stance.x + 5, z: stance.z }, plannedStancePoint: stance }).code,
  'NOT_ARRIVED');
  // 家具正中：区域成员成立，但真实角色圆站不住 → 位置不合法。
  const inside = { x: bed.x, z: bed.z };
  const illegal = resolveDeepSeekAiHideEntry({ ...base, spotId: 'hide_main_bed',
    position: inside, plannedStancePoint: inside });
  assert.equal(illegal.code, 'POSITION_ILLEGAL');
  assert.equal(illegal.positionCode, 'NOT_STANDABLE');
  // 合法站位 + 真实到位 → 通过。
  const ok = resolveDeepSeekAiHideEntry({ ...base, spotId: 'hide_main_bed',
    position: stance, plannedStancePoint: stance });
  assert.equal(ok.ok, true);
  assert.equal(ok.code, 'ENTERED');
  assert.equal(ok.positionCode, 'LEGAL');
});

test('出口物理判据：Human 角色圆压住出口时为真，拉开后为假', () => {
  const radius = GAME_CONFIG.collision.playerRadius;
  assert.equal(humanBlocksHideExit({ x: 0, z: 0 }, { x: 0.1, z: 0 }, radius), true);
  assert.equal(humanBlocksHideExit({ x: 0, z: 0 }, { x: radius * 2 + 0.01, z: 0 },
    radius), false);
});
