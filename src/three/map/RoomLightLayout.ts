import { ROOMS, WALLS, MAP_WIDTH, MAP_DEPTH, DOOR_NODES, SPAWNS, type Point } from './apartmentMap.ts';
import { CollisionWorld, orientedObstacleFromRect } from '../CollisionWorld.ts';
import { NavigationSystem } from '../../systems/NavigationSystem.ts';
import { GAME_CONFIG as C } from '../../config/gameConfig.ts';
import type { MapSource } from './MapEditModel.ts';
import type { RoomLightSwitch } from '../../systems/RoomLightSystem.ts';

export interface LightPlacement extends Point { roomId: string; height: number }
export const LIGHT_LAYOUT_URL = '/__dev/room-light-layout';
export const lightSignature = (items: readonly LightPlacement[]) => JSON.stringify(
  [...items].sort((a,b)=>a.roomId.localeCompare(b.roomId)).map(p=>[p.roomId,p.x,p.z,p.height]));
export const lightPlacements = (items: readonly RoomLightSwitch[]): LightPlacement[] =>
  items.map(p=>({roomId:p.roomId,x:p.x,z:p.z,height:p.height??1.3}));

/** Authoring only: snap to a real wall face in the original region, never into a doorway. */
export function mountLight(p: LightPlacement): RoomLightSwitch | null {
  const room=ROOMS.find(r=>r.id===p.roomId);
  if(!room||![p.x,p.z,p.height].every(Number.isFinite))return null;
  let best:RoomLightSwitch|null=null, distance=Infinity;
  for(const side of [
    {horizontal:true,edge:room.minZ,min:room.minX,max:room.maxX,normal:{x:0,z:1}},
    {horizontal:false,edge:room.minX,min:room.minZ,max:room.maxZ,normal:{x:1,z:0}},
    {horizontal:true,edge:room.maxZ,min:room.minX,max:room.maxX,normal:{x:0,z:-1}},
    {horizontal:false,edge:room.maxX,min:room.minZ,max:room.maxZ,normal:{x:-1,z:0}},
  ])for(const wall of WALLS){
    const across=side.horizontal?wall.z:wall.x, thickness=side.horizontal?wall.depth:wall.width;
    if(Math.abs(across-side.edge)>thickness/2+.01||p.height<.4||p.height>wall.height)continue;
    const along=side.horizontal?wall.x:wall.z, span=side.horizontal?wall.width:wall.depth;
    const min=Math.max(side.min+.45,along-span/2+.3),max=Math.min(side.max-.45,along+span/2-.3);
    if(min>max)continue;
    const t=Math.max(min,Math.min(max,side.horizontal?p.x:p.z));
    const face=across+(side.horizontal?side.normal.z:side.normal.x)*(thickness/2+.06);
    const x=side.horizontal?t:face,z=side.horizontal?face:t,d=Math.hypot(x-p.x,z-p.z);
    if(d<distance){distance=d;best={roomId:p.roomId,x,z,height:p.height,normal:{...side.normal},
      approach:{x:x+side.normal.x*.8,z:z+side.normal.z*.8}};}
  }
  return best;
}

/** Same validation in editor and DEV endpoint; [] means keep all derived defaults. */
export function validateLightLayout(value: unknown, source: MapSource): string|null {
  if(!Array.isArray(value))return '灯位必须为数组';
  const ids=new Set<string>();
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,[],
    [...source.walls,...source.furniture].map(orientedObstacleFromRect));
  let nav:NavigationSystem|undefined;
  for(const p of value){
    if(!p||typeof p!=='object'||Object.keys(p).sort().join(',')!=='height,roomId,x,z'||
      typeof p.roomId!=='string'||ids.has(p.roomId))return '灯位字段或区域ID无效/重复';
    ids.add(p.roomId);
    const mount=mountLight(p);
    if(!mount||Math.hypot(mount.x-p.x,mount.z-p.z)>1e-6)return `${p.roomId}：需贴在本区域真实墙面，且高度合法`;
    const r=ROOMS.find(r=>r.id===p.roomId)!,a=mount.approach;
    if(a.x<=r.minX||a.x>=r.maxX||a.z<=r.minZ||a.z>=r.maxZ||
      !world.canOccupyStaticXZ(a.x,a.z,C.collision.playerRadius,C.three.actorHeight))
      return `${p.roomId}：开关前被家具或墙体阻挡，不能操作`;
    nav??=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES);
    const doors=DOOR_NODES.map(d=>({id:d.id,nodeId:d.id,state:'OPEN' as const,locked:false,lockCoreState:'ACTIVE' as const}));
    if(![SPAWNS.human,SPAWNS.deepseek].every(spawn=>nav!.findPath(spawn,a,doors)))
      return `${p.roomId}：开关接近点不可达`;
  }
  return null;
}

export function resolvedLights(defaults:readonly RoomLightSwitch[], layout:readonly LightPlacement[]):RoomLightSwitch[]{
  return defaults.map(p=>{const override=layout.find(q=>q.roomId===p.roomId);
    if(!override)return p;
    const mounted=mountLight(override);
    if(!mounted)throw Error(`无效灯位：${p.roomId}`);
    return mounted;
  });
}

export class RoomLightLayoutModel {
  draft:LightPlacement[];
  committed:LightPlacement[];
  private saved:string;
  private revision:string|null=null;
  private initialSaved:readonly LightPlacement[];
  private validation:{error:string|null}|null=null;
  saving=false;
  private readonly source:()=>MapSource;
  private readonly onApply:(layout:readonly LightPlacement[])=>void;
  message='拖动吸附本区域墙面；高度单独调整。应用后生效，保存后跨刷新保留。';
  constructor(initial:readonly RoomLightSwitch[], saved:readonly LightPlacement[],
    source:()=>MapSource, onApply:(layout:readonly LightPlacement[])=>void){
    this.source=source;this.onApply=onApply;
    this.draft=lightPlacements(initial);this.committed=structuredClone(this.draft);
    this.saved=lightSignature(this.committed);this.initialSaved=structuredClone(saved);
  }
  get dirty():boolean{return lightSignature(this.draft)!==lightSignature(this.committed);}
  get pending():boolean{return lightSignature(this.committed)!==this.saved;}
  has(id:string):boolean{return this.draft.some(p=>`light-switch:${p.roomId}`===id);}
  move(id:string,x:number,z:number,height?:number):void{
    const p=this.draft.find(p=>`light-switch:${p.roomId}`===id);if(!p)return;
    const mounted=mountLight({...p,x,z,height:height??p.height});
    if(!mounted){this.message='位置修改被拒绝：坐标或高度不合法';return;}
    Object.assign(p,{x:mounted.x,z:mounted.z,height:mounted.height});
    this.invalidateValidation();
    this.message='灯位草稿已更新，请应用并保存。';
  }
  invalidateValidation():void{this.validation=null;}
  validate(source?:MapSource):string|null{
    if(source)return validateLightLayout(this.draft,source);
    this.validation??={error:validateLightLayout(this.draft,this.source())};return this.validation.error;
  }
  apply():boolean{
    this.invalidateValidation();
    const error=this.validate();if(error){this.message=`应用被拒绝：${error}`;return false;}
    this.committed=structuredClone(this.draft);this.onApply(this.committed);
    this.message='灯位已应用，尚需保存。';return true;
  }
  discard():void{this.draft=structuredClone(this.committed);this.invalidateValidation();this.message='灯位草稿已放弃。';}
  async loadRevision():Promise<void>{
    try{const response=await fetch(LIGHT_LAYOUT_URL);if(!response.ok)throw Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(typeof data.revision!=='string'||!Array.isArray(data.layout))throw Error('接口响应无效');
      if(lightSignature(data.layout)!==lightSignature(this.initialSaved))throw Error('灯位文件已更新，请刷新后编辑');
      this.revision=data.revision;
    }catch(error){this.message=`读取灯位版本失败：${String(error)}`;}
  }
  async prepareSave():Promise<{revision:string;layout:LightPlacement[]}|null>{
    if(this.dirty){this.message='请先应用灯位草稿再保存';return null;}
    const error=this.validate();if(error){this.message=`保存被拒绝：${error}`;return null;}
    if(!this.revision)await this.loadRevision();if(!this.revision)return null;
    return {revision:this.revision,layout:structuredClone(this.committed)};
  }
  markSaved(revision:string,layout:readonly LightPlacement[]):void{
    this.revision=revision;this.saved=lightSignature(layout);this.initialSaved=structuredClone(layout);
    this.message='灯位已保存到项目；4173和线上版本需另行构建/授权发布。';
  }
  async save():Promise<boolean>{
    if(this.saving)return false;
    this.saving=true;
    try{const payload=await this.prepareSave();if(!payload)return false;
      const response=await fetch(LIGHT_LAYOUT_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw Error(data.error??`HTTP ${response.status}`);
      if(typeof data.revision!=='string')throw Error('未确认保存版本');
      this.markSaved(data.revision,payload.layout);return true;
    }catch(error){this.message=`灯位保存失败：${String(error)}`;return false;}
    finally{this.saving=false;}
  }
}
