import { GAME_CONFIG as C } from '../config/gameConfig.ts';
import { ROOMS, WALLS, OPEN_ROOM_CONNECTIONS, type Room, type Point } from '../three/map/apartmentMap.ts';
import type { Faction } from '../three/LocalControl.ts';

export interface RoomLightSwitch extends Point {
  roomId: string;
  height?: number;
  normal: Point;
  approach: Point;
}

/** Derive wall mounts from the authoritative map, never copy furniture/room coordinates. */
export function createRoomLightSwitches(canStand: (p: Point) => boolean,
  overrides: readonly RoomLightSwitch[] = []): RoomLightSwitch[] {
  return ROOMS.map(room => {
    const authored = overrides.find(p => p.roomId === room.id);
    if (authored) return structuredClone(authored);
    const sides = [
      { axis: 'z', edge: room.minZ, min: room.minX, max: room.maxX, normal: { x: 0, z: 1 } },
      { axis: 'x', edge: room.minX, min: room.minZ, max: room.maxZ, normal: { x: 1, z: 0 } },
      { axis: 'z', edge: room.maxZ, min: room.minX, max: room.maxX, normal: { x: 0, z: -1 } },
      { axis: 'x', edge: room.maxX, min: room.minZ, max: room.maxZ, normal: { x: -1, z: 0 } },
    ] as const;
    for (const side of sides) for (const wall of WALLS) {
      const horizontal = side.axis === 'z';
      const across = horizontal ? wall.z : wall.x;
      const thickness = horizontal ? wall.depth : wall.width;
      if (Math.abs(across - side.edge) > thickness / 2 + .01) continue;
      const along = horizontal ? wall.x : wall.z;
      const span = horizontal ? wall.width : wall.depth;
      const min = Math.max(side.min + .45, along - span / 2 + .3);
      const max = Math.min(side.max - .45, along + span / 2 - .3);
      if (max < min) continue;
      for (const fraction of [.3, .7, .5, 0, 1]) {
        const t = min + (max - min) * fraction;
        const face = across + (horizontal ? side.normal.z : side.normal.x) * (thickness / 2 + .06);
        const point = horizontal ? { x: t, z: face } : { x: face, z: t };
        const approach = { x: point.x + side.normal.x * .8, z: point.z + side.normal.z * .8 };
        if (canStand(approach)) return { roomId: room.id, ...point, normal: side.normal, approach };
      }
    }
    throw new Error(`区域没有可达的墙壁开关位置：${room.id}`);
  });
}

/** Match-local light state; owns only light cooldowns, never actor or AI state. */
export class RoomLightSystem {
  switches: readonly RoomLightSwitch[];
  private readonly rooms: readonly Room[];
  private readonly lit = new Set<string>();
  private readonly cooldowns = new Map<string, number>();

  constructor(switches: readonly RoomLightSwitch[], rooms: readonly Room[] = ROOMS) {
    this.switches = switches; this.rooms = rooms;
  }

  roomId(point: Point): string | null {
    const inside=this.rooms.find(r => point.x > r.minX && point.x < r.maxX &&
      point.z > r.minZ && point.z < r.maxZ);
    if(inside)return inside.id;
    // Only the internal open seam belongs to the shared area; outer/walled edges stay excluded.
    const touching=this.rooms.filter(r=>point.x>=r.minX&&point.x<=r.maxX&&point.z>=r.minZ&&point.z<=r.maxZ);
    const internal=touching.every(r=>point.x>r.minX&&point.x<r.maxX)||touching.every(r=>point.z>r.minZ&&point.z<r.maxZ);
    return internal&&touching.length>1&&touching.every(r=>this.sameArea(r.id,touching[0].id))?touching[0].id:null;
  }

  private circuit(id:string):string {
    // ponytail: the map has one open pair; use connected components if open chains are added.
    const connection=OPEN_ROOM_CONNECTIONS.find(c=>c.connectedRoomA===id||c.connectedRoomB===id);
    return connection?.connectedRoomA??id;
  }
  sameArea(a:string|null,b:string|null):boolean{return a!==null&&b!==null&&this.circuit(a)===this.circuit(b);}
  areaName(id:string):string {
    const name=this.rooms.find(r=>r.id===id)?.name??id;
    return OPEN_ROOM_CONNECTIONS.some(c=>c.connectedRoomA===id||c.connectedRoomB===id)?name.split('·')[0]:name;
  }
  private localSwitches(actor:Point):RoomLightSwitch[]{
    const room=this.roomId(actor);
    return this.switches.filter(s=>this.sameArea(s.roomId,room)).sort((a,b)=>
      Math.hypot(a.x-actor.x,a.z-actor.z)-Math.hypot(b.x-actor.x,b.z-actor.z));
  }
  isOn(id: string): boolean { return this.lit.has(this.circuit(id)); }
  cooldown(id: string): number { return this.cooldowns.get(this.circuit(id)) ?? 0; }
  rangeFor(target: Point, darkRange: number): number {
    const id = this.roomId(target);
    return id !== null && this.isOn(id) ? Number.POSITIVE_INFINITY : darkRange;
  }

  nearby(actor: Point, blocked: (a: Point, b: Point) => boolean): RoomLightSwitch | null {
    return this.localSwitches(actor).find(item=>
      Math.hypot(actor.x-item.x,actor.z-item.z)<=C.roomLights.interactionRange&&!blocked(actor,item.approach))??null;
  }

  toggle(id: string, actor: Point, canAct: boolean, blocked: (a: Point, b: Point) => boolean): boolean {
    if (!canAct || this.cooldown(id) > 0 || this.nearby(actor, blocked)?.roomId !== id) return false;
    const circuit=this.circuit(id);
    if (this.lit.has(circuit)) this.lit.delete(circuit); else this.lit.add(circuit);
    this.cooldowns.set(circuit, C.roomLights.toggleCooldownMs);
    return true;
  }

  /** Uses only local switch state and an actually visible opponent. */
  aiCandidate(faction: Faction, actor: Point, visibleOpponent: Point | null): RoomLightSwitch | null {
    const item = this.localSwitches(actor)[0];
    if (!item || this.cooldown(item.roomId) > 0 || this.isOn(item.roomId) === (faction === 'HUMAN')) return null;
    if (faction === 'DEEPSEEK' && !visibleOpponent) return null;
    return item;
  }

  advance(deltaMs: number): void {
    for (const [id, ms] of this.cooldowns) this.cooldowns.set(id, Math.max(0, ms - Math.max(0, deltaMs)));
  }
  reset(): void { this.lit.clear(); this.cooldowns.clear(); }
}
