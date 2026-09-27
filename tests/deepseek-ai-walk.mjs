import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { effectiveSpeeds } from '../src/systems/DevBRuntimeBinding.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { HideSystem } from '../src/systems/HideSystem.ts';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { createDeepSeekHideMapSnapshot }
  from '../src/systems/DeepSeekHideCandidates.ts';
import { resolveDeepSeekAiHideEntry, humanBlocksHideExit }
  from '../src/systems/DeepSeekHideResolution.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, RICE_CANDIDATES,
  ROOMS, SPAWNS, WALLS } from '../src/three/map/apartmentMap.ts';

// S7C-2b：DeepSeek 娘 AI 自主藏身的**真实走图驱动器**。
//
// 与 `human-ai-walk.mjs` 同一个理由：藏身链路的每一步（走位 → 权威几何复核 → 一次性
// 令牌 → 藏身状态机 → 出口物理判据）都必须像 `ThreeGame.updatePlaying()` 一样推进，
// 不能靠「把角色瞬移到目标点然后断言」——那正是 S7C-2 修复轮踩过的坑。
//
// 这里刻意复用**生产代码里的同一段权威判定**（`resolveDeepSeekAiHideEntry` 与
// `humanBlocksHideExit`），因此测试与运行时不会各写一套判据后静默分叉。

export const DEEPSEEK_AI_WORLD_SPEED = effectiveSpeeds({
  playerSpeedPx: GAME_CONFIG.player.speed,
  humanSpeedMultiplier: GAME_CONFIG.human.speedMultiplier,
  humanAIMovementMultiplier: GAME_CONFIG.humanAI.movementSpeedMultiplier,
}).player / GAME_CONFIG.three.pixelsPerUnit;

/** 真实米点坐标整表，默认全部未完成（藏身「还有事可做」的公开输入）。 */
export function activeRice(completed = []) {
  return RICE_CANDIDATES.map(candidate => ({ id: candidate.id, x: candidate.x,
    z: candidate.z, progressMs: 0, maxProgressMs: GAME_CONFIG.rice.maxProgressMs,
    completed: completed.includes(candidate.id) }));
}

export function createDeepSeekHideEnv(options = {}) {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);
  const doors = new DoorSystem(DOOR_NODES, GAME_CONFIG.door.maxActiveLocks);
  const perception = new PerceptionGeometry(WALLS, DOOR_NODES, () => doors.doors);
  const hide = new HideSystem();
  const ai = new DeepSeekAIController(navigation, DOOR_NODES, ROOMS,
    options.random ?? (() => 0.5));
  const hideMap = createDeepSeekHideMapSnapshot({ hideSpots: HIDE_SPOTS,
    furniture: FURNITURE, revision: options.revision ?? 1 });
  ai.rebindMap(hideMap, false);
  const world = { collision, navigation,
    visionStatus: (from, to, maxRange) => perception.inspectVision(from, to, maxRange).status };
  let clock = 1_000;
  let token = 0;
  const position = new Vector3((options.start ?? SPAWNS.deepseek).x, 0,
    (options.start ?? SPAWNS.deepseek).z);
  // Human 的**真实**位置只用于游戏层那条出口物理判据；AI 侧只能通过
  // `visibleHuman` / `lastSeenHuman` / 声音看到它，两者在这里刻意分开。
  const humanPosition = new Vector3((options.human ?? SPAWNS.human).x, 0,
    (options.human ?? SPAWNS.human).z);
  const env = { ai, collision, navigation, doors, perception, hide, hideMap, world,
    setRuntimeTuning: tuning => ai.setRuntimeTuning(tuning), now: () => clock,
    setNow: value => { clock = value; }, position, humanPosition };
  const input = (overrides = {}) => {
    if (overrides.nowMs !== undefined) clock = overrides.nowMs;
    return { deltaMs: 50, deepseek: { x: position.x, z: position.z },
      rice: activeRice(), doors: doors.doors, canOpenDoor: () => true,
      canCloseDoor: () => true, canLockDoor: () => true,
      activeLockSlots: GAME_CONFIG.door.maxActiveLocks, sprintState: 'NORMAL',
      captureProgressMs: 0, perceptionNowMs: clock,
      hideMap, hideWorld: world, hideRequestToken: token,
      hideSelf: { hiding: hide.isConcealed('DEEPSEEK'), spotId: hide.spotId },
      ...overrides };
  };
  env.input = input;
  env.setPosition = point => position.set(point.x, 0, point.z);
  env.setHuman = point => humanPosition.set(point.x, 0, point.z);
  env.point = () => ({ x: position.x, z: position.z });
  /**
   * 推进一帧，顺序与 `ThreeGame.updatePlaying()` 的 DeepSeek 半边一致：
   * 签发一次性令牌 → AI 决策 → 处理藏身 / 门命令 → 真实位移（藏身中位移为 0）。
   */
  env.walk = (overrides = {}, deltaMs = 50) => {
    if (overrides.nowMs === undefined) clock += deltaMs;
    token++;
    hide.issueAiEntryToken(token);
    const command = ai.update({ ...input({ ...overrides, deltaMs }), hideRequestToken: token });
    if (command.hideExitRequest && hide.spotId) {
      const blocked = humanBlocksHideExit({ x: position.x, z: position.z },
        { x: humanPosition.x, z: humanPosition.z }, GAME_CONFIG.collision.playerRadius);
      const spotId = hide.spotId;
      const result = hide.exit('AI_EXIT', { humanOverlap: blocked });
      ai.onHideResult(spotId ?? '', result.ok ? 'EXITED' : result.code);
    }
    if (command.hideSpotId) {
      const entry = resolveDeepSeekAiHideEntry({ spotId: command.hideSpotId,
        position: { x: position.x, z: position.z },
        plannedStancePoint: ai.hideStancePoint, map: hideMap, doors: doors.doors,
        // 允许测试临时换掉几何接缝（例如注入一个「处处站不住」的世界），
        // 用来真实触发权威层的拒绝路径，而不是伪造一个拒绝码。
        world: overrides.hideWorld ?? world,
        waypointTolerance: GAME_CONFIG.deepseekAI.waypointTolerance,
        contactEpsilon: GAME_CONFIG.collision.contactEpsilon });
      if (!entry.ok) {
        env.lastEntry = entry;
        ai.onHideResult(command.hideSpotId, entry.code);
      } else {
        const result = hide.enterAsAI({ phase: 'PLAYING',
          position: { x: position.x, z: position.z }, spotId: command.hideSpotId,
          spotCode: entry.positionCode, spotLegal: true,
          captureProgressMs: 0, sprintState: 'NORMAL',
          requestToken: command.hideRequestToken ?? Number.NaN });
        env.lastEntry = { ...entry, systemCode: result.code, systemOk: result.ok };
        ai.onHideResult(command.hideSpotId, result.ok ? 'ENTERED' : result.code);
      }
    }
    if (command.openDoorId) doors.toggle(command.openDoorId, 'DEEPSEEK');
    const hidden = hide.isConcealed('DEEPSEEK');
    if (!hidden && (command.direction.x !== 0 || command.direction.z !== 0)) {
      const next = collision.move(position,
        command.direction.x * DEEPSEEK_AI_WORLD_SPEED * deltaMs / 1000,
        command.direction.z * DEEPSEEK_AI_WORLD_SPEED * deltaMs / 1000,
        GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
      position.set(next.x, 0, next.z);
    }
    return command;
  };
  return env;
}

/** 逼近一次：把 Human 放在 DS 前方一小段距离，直到 AI 真的开始藏身走位。 */
export { HIDE_SPOTS, FURNITURE, SPAWNS, RICE_CANDIDATES };
