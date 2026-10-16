import type * as THREE from 'three';
import { ThrowableLayoutModel } from './map/ThrowableLayoutModel.ts';
import { THROWABLE_NAMES, type ThrowableView } from './ThrowableView.ts';
import type { ThrowableSystem } from '../systems/ThrowableSystem.ts';
import type { MapSource } from './map/MapEditModel.ts';
import type { ThrowableSpawn } from '../systems/ThrowableSystem.ts';

/** Small section inside the existing DEV editor; picking/dragging stays with SceneEditorView. */
export class ThrowableEditor {
  readonly element=document.createElement('section');
  readonly model:ThrowableLayoutModel;
  private readonly select=document.createElement('select');
  private readonly x=document.createElement('input');
  private readonly z=document.createElement('input');
  private readonly status=document.createElement('div');
  private selected:string|null=null;
  private readonly view:ThrowableView;
  constructor(initial:readonly ThrowableSpawn[],source:()=>MapSource,system:ThrowableSystem,
    view:ThrowableView,onSelect:(id:string|null)=>void,onFocus:(id:string)=>void){
    this.view=view;this.model=new ThrowableLayoutModel(initial,source,layout=>system.applyLayout(layout));
    this.element.className='throwable-editor scene-editor-section';
    const heading=document.createElement('strong');heading.textContent='可投掷道具 · 位置编辑';
    const help=document.createElement('small');
    help.textContent='上方「应用编辑 / 保存布局」包含道具；下方按钮只处理道具。正式4173需重新构建后更新。';
    this.select.setAttribute('aria-label','选择投掷物');
    const none=document.createElement('option');none.value='';none.textContent='选择道具，或直接点击场景里的道具';this.select.append(none);
    for(const p of initial){const option=document.createElement('option');option.value=p.id;
      option.textContent=`${THROWABLE_NAMES[p.kind]} · ${p.roomId} · ${p.id}`;this.select.append(option);
      view.models.get(p.id)!.userData.objectId=p.id;}
    this.select.addEventListener('change',()=>onSelect(this.select.value||null));
    const fields=document.createElement('div');fields.className='scene-editor-fields';
    for(const [axis,input]of [['x',this.x],['z',this.z]] as const){
      const label=document.createElement('label');label.className='scene-editor-field';
      label.append(document.createTextNode(`${axis.toUpperCase()} 位置`));
      input.type='number';input.step='.05';input.dataset.throwField=axis;
      input.addEventListener('change',()=>{if(!this.selected)return;
        const p=this.model.draft.find(p=>p.id===this.selected)!;
        this.model.move(p.id,axis==='x'?input.valueAsNumber:p.x,axis==='z'?input.valueAsNumber:p.z);
        this.render();});label.append(input);fields.append(label);
    }
    const actions=document.createElement('div');actions.className='scene-editor-actions';
    const button=(label:string,callback:()=>void)=>{const b=document.createElement('button');b.type='button';
      b.className='scene-editor-button';b.textContent=label;b.addEventListener('click',callback);return b;};
    actions.append(button('聚焦道具',()=>{if(this.selected)onFocus(this.selected);}),
      button('应用道具位置',()=>{this.model.apply();this.render();}),
      button('放弃道具草稿',()=>{this.model.discard();this.render();}),
      button('保存道具位置',()=>{void this.model.save().then(()=>this.render());}));
    this.status.className='scene-editor-diff';this.status.setAttribute('role','status');
    this.element.append(heading,help,this.select,fields,actions,this.status);
    this.element.style.cssText='display:grid;gap:7px;padding:10px;border:1px solid #53676b';
    this.select.style.cssText='width:100%;min-width:0';
  }
  get targets():Map<string,THREE.Object3D>{return new Map(this.view.models);}
  selectTarget(id:string|null):void{this.selected=id&&this.model.has(id)?id:null;this.render();}
  render():void{
    this.select.value=this.selected??'';
    const p=this.model.draft.find(p=>p.id===this.selected);
    for(const [key,input]of [['x',this.x],['z',this.z]] as const){input.disabled=!p;
      if(document.activeElement!==input)input.value=p?String(p[key]):'';}
    const error=this.model.validate();
    this.status.textContent=`${this.model.message}\n草稿：${this.model.dirty?'未应用':'无'} · 项目：${this.model.pending?'未保存':'已保存'}${p?` · 房间：${p.roomId}`:''}${error?`\n${error}`:''}`;
    this.status.dataset.tone=error?'danger':this.model.pending||this.model.dirty?'warning':'normal';
    this.view.setEditorLayout(this.model.draft);
  }
  close():void{this.model.discard();this.selected=null;this.view.setEditorLayout(null);}
  dispose():void{this.view.setEditorLayout(null);this.element.remove();}
}
