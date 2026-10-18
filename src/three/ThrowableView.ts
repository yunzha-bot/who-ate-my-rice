import * as THREE from 'three';
import { flightPosition, type ThrowActor, type ThrowFaction, type ThrowPoint,
  type ThrowTrace, type ThrowableKind, ThrowableSystem } from '../systems/ThrowableSystem.ts';

export const THROWABLE_NAMES = { VASE: '花瓶', BOX: '小盒子', BASIN: '不锈钢盆' } as const;

/** Original low-poly household props; no external textures or model assets. */
export function makeThrowableModel(kind: ThrowableKind): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: kind === 'VASE' ? 0xa0b7ac :
    kind === 'BOX' ? 0xbe9b71 : 0xb7c2c5, roughness: kind === 'BASIN' ? .38 : .85,
    metalness: kind === 'BASIN' ? .7 : 0, side: THREE.DoubleSide });
  const mesh = (geometry: THREE.BufferGeometry, y = 0, material = body) => {
    const object = new THREE.Mesh(geometry, material); object.position.y = y;
    object.castShadow = true; object.receiveShadow = true; group.add(object); return object;
  };
  if (kind === 'BOX') {
    mesh(new THREE.BoxGeometry(.34, .24, .29), .12);
    mesh(new THREE.BoxGeometry(.36, .035, .31), .255);
    const tape = new THREE.MeshStandardMaterial({ color: 0xe1cfaa, roughness: 1 });
    mesh(new THREE.BoxGeometry(.055, .006, .315), .276, tape);
  } else if (kind === 'VASE') {
    mesh(new THREE.LatheGeometry([[0,0],[.12,0],[.19,.12],[.17,.27],[.075,.36],
      [.085,.43],[.06,.43],[.055,.36],[.12,.26],[0,.06]].map(([x,y])=>new THREE.Vector2(x,y)),10));
  } else {
    mesh(new THREE.LatheGeometry([[0,.02],[.14,.02],[.27,.17],[.27,.20],
      [.245,.20],[.23,.17],[.12,.055],[0,.055]].map(([x,y])=>new THREE.Vector2(x,y)),12));
    const rim = mesh(new THREE.TorusGeometry(.258,.014,5,12),.2); rim.rotation.x = Math.PI/2;
  }
  return group;
}

interface ViewActor extends ThrowActor { heading: number; renderVisible?: boolean }

/** Pointer input and presentation only. Every pickup/throw is adjudicated by the system. */
export class ThrowableView {
  readonly root = new THREE.Group();
  readonly models = new Map<string, THREE.Group>();
  readonly status = document.createElement('div');
  private readonly ray = new THREE.Raycaster();
  private readonly ground = new THREE.Plane(new THREE.Vector3(0,1,0),0);
  private readonly mouse = new THREE.Vector2();
  private readonly hit = new THREE.Vector3();
  private readonly markers = new THREE.Group();
  private readonly range: THREE.LineLoop;
  private readonly landing: THREE.Mesh;
  private readonly path: THREE.Line;
  private readonly pathPoints = new Float32Array(25*3);
  private pointer: { x: number; y: number } | null = null;
  private aiming: ThrowFaction | null = null;
  private suppressClick = false;
  private disposed = false;
  private editorLayout: readonly import('../systems/ThrowableSystem.ts').ThrowableSpawn[] | null = null;
  private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  private readonly canvas: HTMLCanvasElement;
  private readonly camera: THREE.Camera;
  private readonly system: ThrowableSystem;
  private readonly actors: () => readonly ViewActor[];
  private readonly selected: () => ThrowFaction | null;
  private readonly trace: ThrowTrace;
  private readonly onThrow: (faction: ThrowFaction, heading: number) => void;

  constructor(canvas: HTMLCanvasElement, parent: THREE.Scene,
    camera: THREE.Camera, system: ThrowableSystem, actors: () => readonly ViewActor[],
    selected: () => ThrowFaction | null, trace: ThrowTrace,
    onThrow: (faction: ThrowFaction, heading: number) => void) {
    this.canvas=canvas;this.camera=camera;this.system=system;this.actors=actors;
    this.selected=selected;this.trace=trace;this.onThrow=onThrow;
    this.root.name = 'household-throwables'; parent.add(this.root);
    for (const item of system.items) { const model=makeThrowableModel(item.kind);
      model.name=item.id; this.models.set(item.id,model); this.root.add(model); }
    this.status.className='throwable-status'; this.status.setAttribute('role','status');
    this.status.style.cssText='position:fixed;left:50%;bottom:86px;transform:translateX(-50%);padding:7px 14px;border-radius:12px;background:#f9f5ebeb;color:#30464a;font-size:12px;pointer-events:none;z-index:5;max-width:70vw;text-align:center';
    canvas.parentElement?.append(this.status);
    const geometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:64},(_,i)=>
      new THREE.Vector3(Math.sin(i*Math.PI/32)*system.config.maxThrowDistance,.055,
        Math.cos(i*Math.PI/32)*system.config.maxThrowDistance)));
    this.range=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:0x669b9c,transparent:true,opacity:.45}));
    this.landing=new THREE.Mesh(new THREE.RingGeometry(.17,.24,24),new THREE.MeshBasicMaterial({color:0x669b9c,side:THREE.DoubleSide,depthWrite:false}));
    this.landing.rotation.x=-Math.PI/2;
    this.path=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',
      new THREE.BufferAttribute(this.pathPoints,3)),new THREE.LineDashedMaterial({color:0xf4eedb,dashSize:.16,gapSize:.10}));
    this.markers.add(this.range,this.landing,this.path); this.root.add(this.markers);
    canvas.addEventListener('pointerdown',this.down);
    window.addEventListener('pointermove',this.move);
    window.addEventListener('pointerup',this.up);
    window.addEventListener('pointercancel',this.cancel);
    window.addEventListener('blur',this.cancel);
    canvas.addEventListener('contextmenu',this.context);
    canvas.addEventListener('click',this.click,true);
    this.markers.visible=false; this.status.hidden=true;
  }
  private active(): ViewActor | undefined {
    if(!this.system.config.enabled)return;
    const actor=this.actors().find(a=>a.faction===this.selected());
    return actor?.canAct&&!actor.hidden&&!this.system.isStunned(actor.faction)?actor:undefined;
  }
  private target(actor: ViewActor): ThrowPoint | null {
    if(!this.pointer)return null;
    const rect=this.canvas.getBoundingClientRect(),p=this.pointer;
    if(rect.width<=0||rect.height<=0||p.x<rect.left||p.x>rect.right||p.y<rect.top||p.y>rect.bottom)return null;
    this.mouse.set((p.x-rect.left)/rect.width*2-1,-(p.y-rect.top)/rect.height*2+1);
    this.camera.updateMatrixWorld(true); this.ray.setFromCamera(this.mouse,this.camera);
    return this.ray.ray.intersectPlane(this.ground,this.hit)?{x:this.hit.x,z:this.hit.z}:null;
  }
  heading(faction: ThrowFaction): number | undefined {
    const actor=this.active(); if(!actor||this.aiming!==faction||actor.faction!==faction)return;
    const requested=this.target(actor); if(!requested)return;
    const target=this.system.aim(actor,requested,this.trace).point;
    return Math.atan2(target.x-actor.x,target.z-actor.z);
  }
  cancel = (): void => { this.aiming=null; this.markers.visible=false; };
  setEditorLayout(layout: typeof this.editorLayout): void { this.editorLayout=layout;this.cancel(); }
  private down = (e: PointerEvent): void => {
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.button===2){if(this.system.held(this.selected()??'DEEPSEEK'))e.preventDefault();this.cancel();return;}
    const actor=this.active(); if(e.button!==0||!actor||!this.system.held(actor.faction))return;
    this.pointer={x:e.clientX,y:e.clientY};this.aiming=actor.faction;this.suppressClick=true;e.preventDefault();
  };
  private move = (e: PointerEvent): void => {
    if(e.target===this.canvas||this.aiming)this.pointer={x:e.clientX,y:e.clientY};
  };
  private up = (e: PointerEvent): void => {
    if(e.button!==0)return;
    const actor=this.active(),aiming=this.aiming;this.pointer={x:e.clientX,y:e.clientY};
    if(actor&&aiming===actor.faction&&e.target===this.canvas){const target=this.target(actor);
      const heading=this.heading(actor.faction);
      if(target&&heading!==undefined&&this.system.throw(actor,target,this.trace))this.onThrow(actor.faction,heading);}
    this.cancel();
    if(e.target!==this.canvas)this.suppressClick=false;
  };
  private context = (e: MouseEvent): void => { if(this.aiming||this.system.held(this.selected()??'DEEPSEEK'))e.preventDefault();this.cancel(); };
  private click = (e: MouseEvent): void => { if(this.suppressClick){e.stopImmediatePropagation();e.preventDefault();this.suppressClick=false;} };
  sync(): void {
    const actors=this.actors(),active=this.active();
    this.markers.visible=false;
    if(this.editorLayout){
      this.status.hidden=true;
      for(const spawn of this.editorLayout){const model=this.models.get(spawn.id)!;
        model.visible=true;model.position.set(spawn.x,.025,spawn.z);model.rotation.z=0;}
      return;
    }
    if(!active||this.aiming!==active.faction){this.cancel();if(!active)this.suppressClick=false;}
    for(const item of this.system.items){const model=this.models.get(item.id)!;
      model.visible=item.state!=='USED'&&this.system.config.enabled;
      if(item.state==='HELD'){const actor=actors.find(a=>a.faction===item.holder)!;
        const heading=this.heading(actor.faction)??actor.heading;
        model.visible=!actor.hidden&&actor.renderVisible!==false&&this.system.config.enabled;model.position.set(actor.x+Math.sin(heading)*.60,.55,actor.z+Math.cos(heading)*.60);
      }else model.position.set(item.x,item.height+.025,item.z);
      model.rotation.z=item.state==='FLIGHT'&&!this.reducedMotion?Math.sin(this.system.nowMs*.015)*.35:0;
    }
    const held=active&&this.system.held(active.faction),near=active&&!held?this.system.nearest(active,this.trace):undefined;
    const item=held||near;
    const durability=item?.kind==='BASIN'?` · 剩余 ${item.remainingThrows} 次投掷`:'';
    this.status.hidden=!active||(!held&&!near);
    this.status.textContent=held?`${THROWABLE_NAMES[held.kind]}${durability} · 按住左键瞄准，松开投掷 · 右键取消`:
      near?`F 拾取${THROWABLE_NAMES[near.kind]}${durability}`:'';
    if(!active||!held||!this.aiming)return;
    const requested=this.target(active);if(!requested)return;
    const aim=this.system.aim(active,requested,this.trace);
    this.markers.visible=true;this.range.position.set(active.x,0,active.z);
    this.landing.position.set(aim.point.x,.055,aim.point.z);
    (this.landing.material as THREE.MeshBasicMaterial).color.setHex(aim.blocked?0xb9866d:0x669b9c);
    for(let i=0;i<25;i++){const p=flightPosition(active,aim.point,i/24,this.system.config.arcHeight);
      this.pathPoints.set([p.x,p.height+.05,p.z],i*3);}
    this.path.geometry.attributes.position.needsUpdate=true;this.path.geometry.computeBoundingSphere();
    this.path.computeLineDistances();
  }
  dispose(): void {
    if(this.disposed)return;this.disposed=true;
    this.canvas.removeEventListener('pointerdown',this.down);window.removeEventListener('pointermove',this.move);
    window.removeEventListener('pointerup',this.up);window.removeEventListener('pointercancel',this.cancel);
    window.removeEventListener('blur',this.cancel);this.canvas.removeEventListener('contextmenu',this.context);
    this.canvas.removeEventListener('click',this.click,true);this.status.remove();this.root.removeFromParent();
    const materials=new Set<THREE.Material>();this.root.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.Line){
      object.geometry.dispose();for(const m of Array.isArray(object.material)?object.material:[object.material])materials.add(m);}});
    for(const material of materials)material.dispose();this.models.clear();
  }
}
