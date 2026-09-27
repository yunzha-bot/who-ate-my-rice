import { Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { effectiveSpeeds } from '../src/systems/DevBRuntimeBinding.ts';

// S7C-2 修复轮 二：测试用的**真实移动驱动器**。
//
// 为什么必须有它：Human AI 的「到站」判定现在以规划保存的**原始 stancePoint** 为准
// （导航网格点只是寻路节点），所以「把角色瞬移到吸附点然后等 18 帧」不再能走完一次
// 搜查——那正是真实日志里每次都 STANCE_LOST 的同一个中心错位。测试因此必须像
// `ThreeGame.updatePlaying()` 一样推进：
//
//   AI 决策 → 真实 `CollisionWorld.move()` 位移 → 门 / 解锁指令交给真实 `DoorSystem`
//
// 只保留一处刻意简化：`canOpenDoor` 由测试固定为 true（门交互范围由 door 自己的
// 测试覆盖），这样跨房间的搜查也能走到。移动速度与 ThreeGame 完全相同（DEV-B 的
// 运行时覆盖在本轮测试里保持默认值）。
export const HUMAN_AI_WORLD_SPEED = effectiveSpeeds({
  playerSpeedPx: GAME_CONFIG.player.speed,
  humanSpeedMultiplier: GAME_CONFIG.human.speedMultiplier,
  humanAIMovementMultiplier: GAME_CONFIG.humanAI.movementSpeedMultiplier,
}).humanAi / GAME_CONFIG.three.pixelsPerUnit;

export function createWalker(env, start) {
  const position = new Vector3(start.x, 0, start.z);
  return {
    /** 直接摆放角色（只用于布置测试场景，不用于「走完搜查」）。 */
    set(point) { position.set(point.x, 0, point.z); },
    point() { return { x: position.x, z: position.z }; },
    /** 推进一帧：AI 决策 + 真实位移；返回 AI 本帧发出的命令。 */
    walk(overrides = {}, deltaMs = 50) {
      if (overrides.human) position.set(overrides.human.x, 0, overrides.human.z);
      const command = env.ai.update(env.input({ ...overrides, deltaMs,
        human: { x: position.x, z: position.z } }));
      if (command.openDoorId) env.doors.toggle(command.openDoorId, 'HUMAN');
      if (command.unlockDoorId) env.doors.disableLock(command.unlockDoorId, 'HUMAN');
      const dx = command.direction.x * HUMAN_AI_WORLD_SPEED * deltaMs / 1000;
      // `HumanAICommand.direction` 与地图 `Point` 一样是 { x, z }（不是 { x, y }）。
      const dz = command.direction.z * HUMAN_AI_WORLD_SPEED * deltaMs / 1000;
      if (dx !== 0 || dz !== 0) {
        const next = env.collision.move(position, dx, dz,
          GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight);
        position.set(next.x, 0, next.z);
      }
      return command;
    },
  };
}
