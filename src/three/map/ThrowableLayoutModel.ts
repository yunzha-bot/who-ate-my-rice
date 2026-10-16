import type { ThrowableSpawn } from '../../systems/ThrowableSystem.ts';
import { CollisionWorld, orientedObstacleFromRect } from '../CollisionWorld.ts';
import { MAP_WIDTH, MAP_DEPTH } from './apartmentMap.ts';
import type { MapSource } from './MapEditModel.ts';

export const THROWABLE_LAYOUT_URL = '/__dev/throwable-layout';
export const throwableLayoutSignature = (layout: readonly ThrowableSpawn[]) => JSON.stringify(
  [...layout].sort((a,b)=>a.id.localeCompare(b.id)).map(p=>[p.id,p.kind,p.roomId,p.x,p.z]));

/** Shared by DEV authoring and the save endpoint: stable identity, finite legal positions. */
export function validateThrowableLayout(value: unknown, reference: readonly ThrowableSpawn[],
  source: MapSource): string | null {
  if(!Array.isArray(value)||value.length!==reference.length)return '投掷物数量不能改变';
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,[],
    [...source.walls,...source.furniture].map(orientedObstacleFromRect));
  const ids=new Set<string>();
  for(const p of value){
    if(!p||typeof p!=='object'||typeof p.id!=='string'||ids.has(p.id))return '投掷物ID无效或重复';
    ids.add(p.id);
    const original=reference.find(item=>item.id===p.id);
    if(!original||original.kind!==p.kind||!['VASE','BOX','BASIN'].includes(p.kind)||
      Object.keys(p).sort().join(',')!=='id,kind,roomId,x,z')
      return '只能调整投掷物位置，不能修改类型或稳定ID';
    if(!Number.isFinite(p.x)||!Number.isFinite(p.z))return `${p.id}：坐标必须为有限数值`;
    const room=source.rooms.find(r=>r.id===p.roomId);
    if(!room||p.x<room.minX+.3||p.x>room.maxX-.3||p.z<room.minZ+.3||p.z>room.maxZ-.3)
      return `${p.id}：需放在可玩房间内并留出边距`;
    if(!world.canOccupyStaticXZ(p.x,p.z,.38,1))return `${p.id}：与墙或家具碰撞，无法拾取`;
    if(source.doors.some(d=>Math.hypot(p.x-d.x,p.z-d.z)<d.width/2+.4))
      return `${p.id}：距离门口太近`;
    if([...source.hideSpots,...source.riceCandidates].some(q=>Math.hypot(p.x-q.x,p.z-q.z)<.45))
      return `${p.id}：与躲藏锚点或米点重叠`;
  }
  for(let i=0;i<value.length;i++)for(let j=i+1;j<value.length;j++)
    if(Math.hypot(value[i].x-value[j].x,value[i].z-value[j].z)<.55)return '投掷物之间需留出间距';
  return null;
}

/** Separate authored file, separate applied/draft/saved states; never a gameplay save. */
export class ThrowableLayoutModel {
  draft: ThrowableSpawn[];
  committed: ThrowableSpawn[];
  private saved: string;
  private revision: string | null=null;
  private validation: {error:string|null} | null=null;
  saving=false;
  message='投掷物位置单独保存到 throwableLayout.json；不改家具布局。';
  private readonly initial: readonly ThrowableSpawn[];
  private readonly source: ()=>MapSource;
  private readonly onApply:(layout:readonly ThrowableSpawn[])=>void;
  constructor(initial:readonly ThrowableSpawn[],source:()=>MapSource,
    onApply:(layout:readonly ThrowableSpawn[])=>void){
    this.initial=initial.map(p=>({...p}));this.source=source;this.onApply=onApply;
    this.committed=initial.map(p=>({...p}));this.draft=initial.map(p=>({...p}));
    this.saved=throwableLayoutSignature(initial);
  }
  get dirty():boolean{return throwableLayoutSignature(this.draft)!==throwableLayoutSignature(this.committed);}
  get pending():boolean{return throwableLayoutSignature(this.committed)!==this.saved;}
  has(id:string):boolean{return this.draft.some(p=>p.id===id);}
  move(id:string,x:number,z:number):void{
    const p=this.draft.find(p=>p.id===id);if(!p)return;
    p.x=x;p.z=z;
    this.invalidateValidation();
    const room=this.source().rooms.find(r=>x>=r.minX&&x<=r.maxX&&z>=r.minZ&&z<=r.maxZ);
    if(room)p.roomId=room.id;
    this.message='位置已写入草稿；应用后生效，保存后才能跨刷新保留。';
  }
  invalidateValidation():void{this.validation=null;}
  validate():string|null{
    this.validation??={error:validateThrowableLayout(this.draft,this.initial,this.source())};
    return this.validation.error;
  }
  validateAgainst(source:MapSource):string|null{return validateThrowableLayout(this.draft,this.initial,source);}
  apply():boolean{
    this.invalidateValidation();
    const error=this.validate();if(error){this.message=`应用被拒绝：${error}`;return false;}
    this.committed=this.draft.map(p=>({...p}));this.onApply(this.committed);
    this.message='投掷物位置已应用，尚需保存到项目。';return true;
  }
  discard():void{this.draft=this.committed.map(p=>({...p}));this.invalidateValidation();
    this.message='已放弃未应用的投掷物草稿。';}
  async loadRevision():Promise<void>{
    try{const response=await fetch(THROWABLE_LAYOUT_URL);if(!response.ok)throw Error(`HTTP ${response.status}`);
      const data=await response.json();
      if(typeof data.revision!=='string'||!Array.isArray(data.layout))throw Error('接口响应无效');
      if(throwableLayoutSignature(data.layout)!==this.saved)throw Error('项目投掷物已更新，请刷新后重新编辑');
      this.revision=data.revision;
    }catch(error){this.message=`读取投掷物版本失败：${String(error)}`;}
  }
  async prepareSave():Promise<{revision:string;layout:ThrowableSpawn[]}|null>{
    if(this.dirty){this.message='保存被拒绝：请先应用投掷物位置。';return null;}
    const error=validateThrowableLayout(this.committed,this.initial,this.source());
    if(error){this.message=`保存被拒绝：${error}`;return null;}
    if(!this.revision)await this.loadRevision();if(!this.revision)return null;
    return {revision:this.revision,layout:this.committed.map(p=>({...p}))};
  }
  markSaved(revision:string,layout:readonly ThrowableSpawn[]):void{
    this.revision=revision;this.saved=throwableLayoutSignature(layout);
    this.message='道具已保存；开发版刷新生效，4173正式预览需重新构建。';
  }
  async save():Promise<boolean>{
    if(this.saving)return false;
    const payload=await this.prepareSave();if(!payload)return false;
    this.saving=true;
    try{const response=await fetch(THROWABLE_LAYOUT_URL,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)});
      const data=await response.json();if(!response.ok)throw Error(data.error??`HTTP ${response.status}`);
      if(typeof data.revision!=='string')throw Error('保存响应缺少版本');
      this.markSaved(data.revision,payload.layout);return true;
    }catch(error){this.message=`投掷物保存失败，未确认保存：${String(error)}`;return false;}
    finally{this.saving=false;}
  }
}
