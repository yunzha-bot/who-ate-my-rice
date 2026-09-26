import { GAME_CONFIG } from '../../config/gameConfig.ts';
import { CollisionWorld } from '../CollisionWorld.ts';
import { rectColliders } from './MapEditModel.ts';
import { MAP_DEPTH, MAP_WIDTH, WALLS,
  type HideSpot, type Point, type Rect } from './apartmentMap.ts';

/**
 * S7C-1B：地图应用前的预检 —— 纯逻辑。
 *
 * 「应用编辑」会原子替换静态碰撞与导航网格；如果新地图让正在藏身的角色站到了
 * 非法位置，就会出现「先被强行请出柜子、再发现地图根本无法应用」。所以在真正
 * 重建之前先用**候选地图数据**建一个临时碰撞世界，逐一验证：
 *   1. 当前两个角色真实站位仍然可站立；
 *   2. 若正在藏身，实际进入/退出位置在新地图上仍然可站立，且该藏身点仍存在。
 *
 * 预检只读：它不修改任何现有碰撞世界、藏身状态或编辑器草稿。预检失败时调用方
 * 直接拒绝应用，旧地图与旧藏身状态原样保留。
 */
export type MapPrecheckCode = 'OK' | 'ACTOR_NOT_STANDABLE' | 'HIDE_SPOT_MISSING'
  | 'HIDE_POSITION_NOT_STANDABLE';

export interface MapPrecheckActor {
  id: string;
  x: number;
  z: number;
}

export interface MapPrecheckConcealed {
  spotId: string;
  x: number;
  z: number;
}

export interface MapPrecheckInput {
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
  actors: readonly MapPrecheckActor[];
  concealed?: MapPrecheckConcealed | null;
}

export interface MapPrecheckResult {
  ok: boolean;
  code: MapPrecheckCode;
  message: string;
  /** 失败时命中的对象 id，便于 DEV 面板给出可读原因。 */
  subjectId: string | null;
}

export function mapPrecheckCollision(furniture: readonly Rect[]): CollisionWorld {
  const colliders = rectColliders([...WALLS, ...furniture]);
  return new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, colliders.boxes, colliders.oriented);
}

export function precheckMapApplication(input: MapPrecheckInput): MapPrecheckResult {
  const collision = mapPrecheckCollision(input.furniture);
  const radius = GAME_CONFIG.collision.playerRadius;
  const height = GAME_CONFIG.three.actorHeight;
  const standable = (point: Point): boolean =>
    collision.canOccupyStaticXZ(point.x, point.z, radius, height);

  for (const actor of input.actors) {
    if (!standable(actor)) {
      return { ok: false, code: 'ACTOR_NOT_STANDABLE', subjectId: actor.id,
        message: `新地图会让 ${actor.id} 站在非法位置（${actor.x.toFixed(2)}, ` +
          `${actor.z.toFixed(2)}），已保留原地图` };
    }
  }

  const concealed = input.concealed;
  if (concealed) {
    if (!input.hideSpots.some(spot => spot.id === concealed.spotId)) {
      return { ok: false, code: 'HIDE_SPOT_MISSING', subjectId: concealed.spotId,
        message: `新地图缺少正在使用的藏身点 ${concealed.spotId}，已保留原地图与藏身状态` };
    }
    if (!standable(concealed)) {
      return { ok: false, code: 'HIDE_POSITION_NOT_STANDABLE', subjectId: concealed.spotId,
        message: `新地图会让藏身出口（${concealed.x.toFixed(2)}, ${concealed.z.toFixed(2)}）` +
          '无法站立，已保留原地图与藏身状态' };
    }
  }

  return { ok: true, code: 'OK', subjectId: null, message: '地图预检通过' };
}
