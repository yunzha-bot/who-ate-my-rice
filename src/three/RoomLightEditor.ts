import { RoomLightLayoutModel, resolvedLights, mountLight, type LightPlacement } from './map/RoomLightLayout.ts';
import type { RoomLightSystem } from '../systems/RoomLightSystem.ts';
import type { RoomLightView } from './RoomLightView.ts';
import type { MapSource } from './map/MapEditModel.ts';
import { ROOMS } from './map/apartmentMap.ts';

/** An extension of the existing DEV panel, not a second editor or a gameplay control. */
export class RoomLightEditor {
  readonly element=document.createElement('details');
  readonly model:RoomLightLayoutModel;
  private readonly select=document.createElement('select');
  private readonly fields=new Map<'x'|'z'|'height',HTMLInputElement>();
  private readonly status=document.createElement('div');
  private selected:string|null=null;
  private active=false;
  private readonly view:RoomLightView;
  constructor(system:RoomLightSystem,view:RoomLightView,saved:readonly LightPlacement[],
    source:()=>MapSource,onSelect:(id:string|null)=>void,onFocus:(id:string)=>void){
    this.view=view;
    this.model=new RoomLightLayoutModel(system.switches,saved,source,layout=>{
      system.switches=resolvedLights(system.switches,layout);
    });
    this.element.className='room-light-editor scene-editor-section';
    this.element.style.cssText='flex-shrink:0;max-height:28vh;overflow:auto;padding:10px;border:1px solid #53676b';
    const title=document.createElement('summary');title.textContent='区域灯光 · 开关位置（展开调整）';
    const help=document.createElement('small');
    help.textContent='列表选择或点击开关拖动，自动吸附本区域墙面；支持换墙及调整高度。上方应用/保存包含灯位，下方按钮仅处理灯位，不改变亮灯范围。';
    this.select.setAttribute('aria-label','选择区域开关');
    this.select.style.cssText='width:100%;min-width:0';
    const none=document.createElement('option');none.value='';none.textContent='选择一个区域的开关';this.select.append(none);
    for(const p of system.switches){const option=document.createElement('option');
      option.value=`light-switch:${p.roomId}`;option.textContent=ROOMS.find(r=>r.id===p.roomId)!.name;this.select.append(option);}
    this.select.addEventListener('change',()=>onSelect(this.select.value||null));
    const fields=document.createElement('div');fields.className='scene-editor-form';
    for(const key of ['x','z','height'] as const){
      const label=document.createElement('label');label.className='scene-editor-field';
      label.append(document.createTextNode(key==='height'?'安装高度':`${key.toUpperCase()} 位置`));
      const input=document.createElement('input');input.type='number';input.step='.05';input.dataset.lightField=key;
      input.addEventListener('change',()=>{const p=this.model.draft.find(p=>`light-switch:${p.roomId}`===this.selected);
        if(!p)return;this.model.move(this.selected!,key==='x'?input.valueAsNumber:p.x,
          key==='z'?input.valueAsNumber:p.z,key==='height'?input.valueAsNumber:p.height);this.render();});
      label.append(input);fields.append(label);this.fields.set(key,input);
    }
    const actions=document.createElement('div');actions.className='scene-editor-actions';
    for(const [label,action] of [
      ['聚焦开关',()=>{if(this.selected)onFocus(this.selected);}],
      ['应用灯位',()=>{this.model.apply();this.render();}],
      ['放弃灯位草稿',()=>{this.model.discard();this.render();}],
      ['保存灯位',()=>{void this.model.save().then(()=>this.render());}],
    ] as const){const button=document.createElement('button');button.type='button';button.className='scene-editor-button';
      button.textContent=label;button.addEventListener('click',action);actions.append(button);}
    this.status.className='scene-editor-diff';this.status.setAttribute('role','status');
    this.element.append(title,help,this.select,fields,actions,this.status);
  }
  get targets(){return this.view.targets;}
  open():void{this.active=true;this.render();}
  selectTarget(id:string|null):void{this.selected=id&&this.model.has(id)?id:null;
    if(this.selected)this.element.open=true;if(this.active)this.render();}
  render():void{
    this.select.value=this.selected??'';
    const p=this.model.draft.find(p=>`light-switch:${p.roomId}`===this.selected);
    for(const [key,input]of this.fields){input.disabled=!p;
      if(document.activeElement!==input)input.value=p?String(p[key]):'';}
    this.status.textContent=`${this.model.message}\n草稿：${this.model.dirty?'未应用':'无'} · 项目：${this.model.pending?'未保存':'已保存'}`;
    if(this.active)this.view.setEditorLayout(this.model.draft.map(p=>mountLight(p)!));
  }
  close():void{this.active=false;this.model.discard();this.selected=null;this.view.setEditorLayout(null);}
  dispose():void{this.view.setEditorLayout(null);this.element.remove();}
}
