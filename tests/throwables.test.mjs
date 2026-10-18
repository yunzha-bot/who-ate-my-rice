import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { ThrowableSystem, segmentCircleEntry } from '../src/systems/ThrowableSystem.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { ThrowableView, makeThrowableModel } from '../src/three/ThrowableView.ts';
import { CharacterActionView } from '../src/three/CharacterActionView.ts';
import { ROOMS, WALLS, FURNITURE, DOOR_NODES, HIDE_SPOTS, RICE_CANDIDATES }
  from '../src/three/map/apartmentMap.ts';
import { authoredMapSource, rectColliders } from '../src/three/map/MapEditModel.ts';
import { validateThrowableLayout } from '../src/three/map/ThrowableLayoutModel.ts';
const layout=JSON.parse(readFileSync(new URL('../src/three/map/throwableLayout.json',import.meta.url),'utf8'));
const clear=()=>null;
const actor=(faction='DEEPSEEK',x=0,z=0,extra={})=>({faction,x,z,hidden:false,canAct:true,...extra});
const spawn=kind=>[{id:'one',roomId:'test',kind,x:.5,z:0}];
const system=kind=>new ThrowableSystem(spawn(kind));

test('integration ages stun before input, then sweeps current actor motion before rice/capture',()=>{
 const source=readFileSync(new URL('../src/three/ThreeGame.ts',import.meta.url),'utf8');
 const frame=source.slice(source.indexOf('private updatePlaying('),source.indexOf('private handleDoorInteractions('));
 const age=frame.indexOf('this.throwables.advanceTime(deltaMs)'),input=frame.indexOf('this.handleDoorInteractions()');
 const move=frame.indexOf('this.move(this.human,'),flight=frame.indexOf('this.throwables.advanceFlights('),rice=frame.indexOf('this.rice.update(');
 assert(age>=0&&age<input&&input<move&&move<flight&&flight<rice,
  'relative-motion sweep must receive this frame\'s resolved positions, not the previous frame');
});

test('all 18 areas retain two stable prop IDs and user-authored positions satisfy the save contract',()=>{
  const c=rectColliders([...WALLS,...FURNITURE]),w=new CollisionWorld(28,19,c.boxes,c.oriented);
  assert.equal(layout.length,36);assert.equal(new Set(layout.map(p=>p.id)).size,36);
  // User-authored positions follow the editor/save contract, not the initial
  // placement's optional 1.8-unit padding. Check the actual shared validator.
  assert.equal(validateThrowableLayout(layout,layout,authoredMapSource()),null);
  // Moving across rooms changes roomId, never the original stable ID.
  for(const room of ROOMS)for(const index of [1,2])
    assert(layout.some(p=>p.id===`throw_${room.id}_${index}`),`${room.id}/${index}`);
  for(const p of layout){const room=ROOMS.find(r=>r.id===p.roomId);assert(room,p.id);
      assert(['VASE','BOX','BASIN'].includes(p.kind));
      assert(p.x>room.minX&&p.x<room.maxX&&p.z>room.minZ&&p.z<room.maxZ);
      assert(w.canOccupyStaticXZ(p.x,p.z,.38,1),p.id);
      assert(DOOR_NODES.every(a=>Math.hypot(a.x-p.x,a.z-p.z)>=a.width/2+.4),p.id);
      assert([...HIDE_SPOTS,...RICE_CANDIDATES].every(a=>Math.hypot(a.x-p.x,a.z-p.z)>=.45),p.id);}
});

test('authoring clearance accepts its exact boundary but rejects overlap and door obstruction',()=>{
  const reference=[{id:'one',roomId:'room',kind:'BOX',x:-5,z:-5}];
  const source={...authoredMapSource(),walls:[],furniture:[],
    rooms:[{id:'room',minX:-10,maxX:10,minZ:-10,maxZ:10}],
    doors:[{id:'door',x:5,z:0,width:1.2}],
    riceCandidates:[{id:'rice',x:0,z:0}],hideSpots:[{id:'hide',x:0,z:5}]};
  const validate=(x,z)=>validateThrowableLayout([{...reference[0],x,z}],reference,source);
  assert.match(validate(.449,0),/米点重叠/);assert.equal(validate(.45,0),null);
  assert.match(validate(.449,5),/躲藏锚点/);assert.equal(validate(.45,5),null);
  assert.match(validate(4.001,0),/门口太近/);assert.equal(validate(4,0),null);
  assert.match(validate(-9.701,0),/边距/);assert.equal(validate(-9.7,0),null);
  const colliding={...source,furniture:[{id:'box',x:-5,z:-5,width:1,depth:1,height:1}]};
  assert.match(validateThrowableLayout(reference,reference,colliding),/碰撞/);
});

test('authored props reject pair overlap at the shared save clearance boundary',()=>{
  const reference=[{id:'one',roomId:'room',kind:'BOX',x:0,z:0},
    {id:'two',roomId:'room',kind:'BASIN',x:2,z:0}];
  const source={...authoredMapSource(),walls:[],furniture:[],doors:[],hideSpots:[],riceCandidates:[],
    rooms:[{id:'room',minX:-10,maxX:10,minZ:-10,maxZ:10}]};
  const candidate=structuredClone(reference);candidate[1].x=.549;
  assert.match(validateThrowableLayout(candidate,reference,source),/之间需留出间距/);
  candidate[1].x=.55;assert.equal(validateThrowableLayout(candidate,reference,source),null);
});

test('legal cross-room editing keeps the stable ID and requires the actual destination room',()=>{
  const reference=[{id:'throw_left_1',roomId:'left',kind:'BOX',x:-1,z:0}];
  const source={...authoredMapSource(),walls:[],furniture:[],doors:[],hideSpots:[],riceCandidates:[],
    rooms:[{id:'left',minX:-4,maxX:0,minZ:-4,maxZ:4},
      {id:'right',minX:0,maxX:4,minZ:-4,maxZ:4}]};
  const candidate=[{...reference[0],x:1,roomId:'right'}];
  assert.equal(validateThrowableLayout(candidate,reference,source),null);
  candidate[0].roomId='left';
  assert.match(validateThrowableLayout(candidate,reference,source),/房间内/);
  candidate[0].roomId='right';candidate[0].id='throw_right_1';
  assert.match(validateThrowableLayout(candidate,reference,source),/稳定ID/);
});

test('pickup adjudicates one owner, range, obstruction, hidden/stunned/disabled actors',()=>{
  const s=system('BOX'),dp=actor(),hu=actor('HUMAN');
  assert.equal(s.pickup({...dp,x:4},clear),false);assert.equal(s.pickup(dp,()=>0),false);
  assert.equal(s.pickup({...dp,hidden:true},clear),false);assert.equal(s.pickup({...dp,canAct:false},clear),false);
  assert(s.pickup(dp,clear));assert.equal(s.pickup(dp,clear),false);assert.equal(s.pickup(hu,clear),false);
  assert.equal(s.held('DEEPSEEK').id,'one');assert.equal(s.held('HUMAN'),undefined);
  const disabled=new ThrowableSystem(spawn('BOX'),{...C.throwables,enabled:false});
  assert.equal(disabled.pickup(dp,clear),false);
  s.reset();s.stunRemaining.DEEPSEEK=2000;assert.equal(s.pickup(dp,clear),false);
});

for(const faction of ['DEEPSEEK','HUMAN'])for(const kind of ['VASE','BOX','BASIN']){
 test(`${faction}/${kind}: missed throws obey disposal/reuse and landing delay, reset restores`,()=>{
  const s=system(kind),a=actor(faction);assert(s.pickup(a,clear));assert(s.throw(a,{x:4,z:0},clear));
  assert.equal(s.held(faction),undefined);assert.equal(s.pickup(a,clear),false);
  s.advance(600,[a],clear);const item=s.items[0],at=actor(faction,item.x,item.z);
  assert.equal(item.state,kind==='BASIN'?'GROUND':'USED');assert.equal(s.pickup(at,clear),false);
  s.advance(500,[at],clear);assert.equal(s.pickup(at,clear),kind==='BASIN');
  s.reset();assert.equal(s.items[0].state,'GROUND');assert.equal(s.items[0].x,.5);assert.equal(s.items[0].holder,null);
 });
}

test('sweep catches a fast projectile; both victims fall for exactly 3000ms and pause freezes',()=>{
 for(const faction of ['DEEPSEEK','HUMAN']){const s=system('BASIN'),a=actor(faction),
  victim=actor(faction==='DEEPSEEK'?'HUMAN':'DEEPSEEK',2);
  s.pickup(a,clear);s.throw(a,{x:4,z:0},clear);
  assert.deepEqual(s.advance(600,[a,victim],clear),[victim.faction]);assert.equal(s.stunRemaining[victim.faction],3000);
  const snapshot=JSON.stringify(s);s.advance(20000,[a,victim],clear,false);assert.equal(JSON.stringify(s),snapshot);
  s.advance(2999,[a,victim],clear);assert(s.isStunned(victim.faction));
  s.advance(1,[a,victim],clear);assert.equal(s.isStunned(victim.faction),false);
  assert.deepEqual(s.advance(600,[a,victim],clear),[],'no repeated hit from landed basin');}
});

test('each basin lasts three successful throws across both holders; final flight resolves before disposal',()=>{
 for(const mode of ['miss','wall','actor','net']){
  const s=system('BASIN');let at={x:0,z:0},hitCount=0,netCount=0;
  for(let used=1;used<=3;used++){
   const a=actor(used===2?'HUMAN':'DEEPSEEK',at.x,at.z);
   const victim=actor(a.faction==='HUMAN'?'DEEPSEEK':'HUMAN',a.x+2,a.z);
   s.advanceFlights(0,mode==='actor'?[a,victim]:[a],clear);
   assert(s.pickup(a,clear));assert.equal(s.held(a.faction).remainingThrows,4-used);
   assert(s.throw(a,{x:a.x+4,z:a.z},clear));
   const item=s.items[0];assert.equal(item.remainingThrows,3-used);assert.equal(item.state,'FLIGHT');
   s.advanceFlights(600,mode==='actor'?[a,victim]:[a],mode==='wall'?()=>.1:clear,
    ()=>hitCount++,()=>mode==='net'?[{x:a.x+2,z:a.z,radius:.55,destroy(){netCount++;}}]:[]);
   assert.equal(item.state,used<3?'GROUND':'USED');at={x:item.x,z:item.z};
   assert(!s.pickup(actor(a.faction,at.x,at.z),clear));
   s.advanceTime(3000);
  }
  assert.equal(hitCount,mode==='actor'?3:0,'last impact must still apply stun/callback');
  assert.equal(netCount,mode==='net'?2:0,'DP final throw still destroys its first-contact net');
  assert.equal(s.nearest(actor('DEEPSEEK',at.x,at.z),clear),undefined);
  assert(!s.pickup(actor('HUMAN',at.x,at.z),clear));
  s.applyLayout([{...spawn('BASIN')[0],x:2}]);assert.equal(s.items[0].state,'USED');
  assert.equal(s.items[0].remainingThrows,0,'editing position must not repair the basin');
  s.reset();assert.equal(s.items[0].state,'GROUND');assert.equal(s.items[0].remainingThrows,3);
 }
});

test('failed/cancelled basin throws do not spend durability, and distinct basins own separate counters',()=>{
 const s=new ThrowableSystem([...spawn('BASIN'),{...spawn('BASIN')[0],id:'two',x:10}],
  {...C.throwables,throwCooldownMs:2000});
 const a=actor();assert(s.pickup(a,clear));
 for(const blocked of [{...a,canAct:false},{...a,hidden:true}])
  assert(!s.throw(blocked,{x:4,z:0},clear));
 assert(!s.throw(a,a,clear));assert(!s.throw(a,{x:4,z:0},()=>0));
 assert.equal(s.items[0].remainingThrows,3);
 assert(s.throw(a,{x:4,z:0},clear));
 const snapshot=JSON.stringify(s);s.advance(20000,[a],clear,false);assert.equal(JSON.stringify(s),snapshot);
 s.advance(600,[a],clear);const at=actor('DEEPSEEK',s.items[0].x);
 s.advanceTime(500);assert(s.pickup(at,clear));
 s.applyLayout([{...spawn('BASIN')[0],x:2},{...spawn('BASIN')[0],id:'two',x:9}]);
 assert.equal(s.items[0].remainingThrows,2);assert.equal(s.items[1].remainingThrows,3);
 assert(!s.throw(at,{x:at.x+4,z:0},clear));
 assert.equal(s.items[0].remainingThrows,2);
});

test('moving actors can dodge or cross the real flight; concealed targets and owner never hit',()=>{
 for(const [start,end,expected]of[[actor('HUMAN',4),actor('HUMAN',4,4),false],
  [actor('HUMAN',2,2),actor('HUMAN',2,-2),true],
  [actor('HUMAN',2,0,{hidden:true}),actor('HUMAN',2,0,{hidden:true}),false]]){
  const s=system('BOX'),a=actor();s.advance(0,[a,start],clear);s.pickup(a,clear);s.throw(a,{x:4,z:0},clear);
  const hits=s.advance(600,[a,end],clear);assert.equal(hits.includes('HUMAN'),expected);assert(!s.isStunned('DEEPSEEK'));}
});

test('impact callback reports real kind and contact once, never for missed, blocked or hidden victims',()=>{
 for(const faction of ['DEEPSEEK','HUMAN'])for(const kind of ['VASE','BOX','BASIN']){
  const a=actor(faction),v=actor(faction==='DEEPSEEK'?'HUMAN':'DEEPSEEK',2),s=system(kind),hits=[];
  s.pickup(a,clear);s.throw(a,{x:4,z:0},clear);
  assert.deepEqual(s.advanceFlights(600,[a,v],clear,h=>hits.push(h)),[v.faction]);
  assert.equal(hits.length,1);assert.equal(hits[0].kind,kind);assert.equal(hits[0].victim,v.faction);
  assert(hits[0].x>0&&hits[0].x<2);assert.equal(hits[0].z,0);
  s.advanceFlights(100,[a,v],clear,h=>hits.push(h));assert.equal(hits.length,1);
 }
 for(const mode of ['miss','wall','hidden']){
  const s=system('BASIN'),a=actor(),v=actor('HUMAN',mode==='miss'?20:2,0,{hidden:mode==='hidden'}),hits=[];
  s.pickup(a,clear);s.throw(a,{x:4,z:0},clear);
  s.advanceFlights(600,[a,v],mode==='wall'?()=>.1:clear,h=>hits.push(h));assert.equal(hits.length,0);
 }
});

test('range and dynamic doors share the preview/flight sweep; walls win over actors behind them',()=>{
 const w=new CollisionWorld(20,20,[]),trace=(a,b,r)=>w.traceCircleXZ(a,b,r),a=actor(),s=system('BOX');
 assert.equal(s.aim(a,{x:20,z:0},trace).point.x,6);
 w.setDynamicObstacle('door',new THREE.Box3(new THREE.Vector3(2,-1,-2),new THREE.Vector3(2.02,2,2)));
 const preview=s.aim(a,{x:4,z:0},trace);assert(preview.blocked&&preview.point.x<2);
 w.setDynamicObstacle('door',null);s.pickup(a,trace);s.throw(a,{x:4,z:0},trace);
 w.setDynamicObstacle('door',new THREE.Box3(new THREE.Vector3(2,0,-2),new THREE.Vector3(2.02,2,2)));
 assert.deepEqual(s.advance(600,[a,actor('HUMAN',3)],trace),[]);assert(s.items[0].x<2);
 w.setDynamicObstacle('door',null);assert.equal(s.aim(a,{x:4,z:0},trace).blocked,false);
});

test('rotated furniture sweep uses local orientation, not its broad-phase bounding box',()=>{
 const r={x:0,z:0,width:2,depth:.2,rotation:Math.PI/4,minY:0,maxY:1};
 const w=new CollisionWorld(10,10,[],[r]);
 assert(w.traceCircleXZ({x:-2,z:0},{x:2,z:0},.12)!==null);
 assert.equal(w.traceCircleXZ({x:.65,z:.65},{x:.8,z:.8},.02),null);
 assert.equal(w.traceCircleXZ({x:9,z:0},{x:12,z:0},.12),(10-.12-9)/3);
 assert.equal(segmentCircleEntry({x:0,z:0},{x:10,z:0},{x:5,z:0},.5),.45);
});

test('repeated hits refresh rather than add stun, and throwing cooldown is enforced',()=>{
 const s=new ThrowableSystem([...spawn('BOX'),{...spawn('BOX')[0],id:'two',x:.7}]);
 const a=actor(),v=actor('HUMAN',1.5);s.pickup(a,clear);s.throw(a,{x:4,z:0},clear);s.advance(400,[a,v],clear);
 assert(s.pickup(a,clear));assert.equal(s.throw(a,{x:4,z:0},clear),false);
 s.advance(400,[a,v],clear);assert(s.throw(a,{x:4,z:0},clear));s.advance(400,[a,v],clear);
 assert.equal(s.stunRemaining.HUMAN,3000);assert.equal(s.items.filter(i=>i.state==='USED').length,2);
});

test('low-poly household models contain real geometry, inner vessel profiles and box lid/tape',()=>{
 for(const kind of ['VASE','BOX','BASIN']){const model=makeThrowableModel(kind);
  assert(model.children.length>0);assert.equal(model.children.length,kind==='BOX'?3:kind==='BASIN'?2:1);
  model.traverse(o=>{if(o.isMesh){assert(o.geometry.attributes.position.count>12);o.geometry.dispose();o.material.dispose();}});}
});

test('both character views face the aim even while moving; fall/stun recover without double tilt',()=>{
 for(const faction of ['DEEPSEEK','HUMAN']){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,.7,.4),new THREE.MeshStandardMaterial());
  const view=new CharacterActionView(mesh,faction);mesh.position.x=1;
  view.update('WALK',50,undefined,Math.PI/2);assert.equal(view.headingRad,Math.PI/2);assert.equal(mesh.position.x,1);
  view.update('FALL',50);view.update('STUN',50);assert.equal(view.action,'FALL');
  const avatar=mesh.children.find(c=>c.isGroup);assert(avatar);
  assert.equal(mesh.rotation.z,faction==='DEEPSEEK'?Math.PI/2:0);
  assert.equal(avatar.rotation.z,faction==='HUMAN'?Math.PI/2:0);
  view.update('IDLE',1000);assert.equal(mesh.rotation.z,0);assert.equal(avatar.rotation.z,0);
  view.dispose();mesh.geometry.dispose();mesh.material.dispose();}
});

test('pointer aiming uses the actual offset canvas and all four camera angles; cancel and cleanup work',t=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;globalThis.window=new EventTarget();
 globalThis.document={createElement:()=>({style:{},setAttribute(){},remove(){this.removed=true;}})};
 t.after(()=>{globalThis.window=oldWindow;globalThis.document=oldDocument;});
 const canvas=new EventTarget();canvas.parentElement={append(){}};
 canvas.getBoundingClientRect=()=>({left:100,top:50,right:900,bottom:650,width:800,height:600});
 const camera=new THREE.OrthographicCamera(-6,6,4.5,-4.5,.1,100),scene=new THREE.Scene(),s=system('BASIN');
 const a={...actor(),heading:0},throws=[];
 const view=new ThrowableView(canvas,scene,camera,s,()=>[a],()=>a.faction,clear,(...args)=>throws.push(args));
 const event=(type,button,x,y)=>Object.assign(new Event(type,{cancelable:true}),{button,clientX:x,clientY:y});
 for(let i=0;i<4;i++){s.reset();s.pickup(a,clear);camera.position.set(12,14,12).applyAxisAngle(new THREE.Vector3(0,1,0),i*Math.PI/2);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const p=new THREE.Vector3(2,0,2).project(camera),x=100+(p.x+1)*400,y=50+(1-p.y)*300;
  canvas.dispatchEvent(event('pointerdown',0,x,y));assert(Math.abs(view.heading('DEEPSEEK')-Math.PI/4)<1e-8);
  view.sync();assert.equal(view.root.getObjectByName('one').visible,true);
  assert.match(view.status.textContent,/剩余 3 次投掷/);
  canvas.dispatchEvent(event('pointerdown',2,x,y));window.dispatchEvent(event('pointerup',0,x,y));assert(s.held('DEEPSEEK'));
  assert.equal(s.held('DEEPSEEK').remainingThrows,3,'cancelled aiming spends no durability');
  canvas.dispatchEvent(event('pointerdown',0,x,y));canvas.dispatchEvent(event('pointerup',0,x,y));window.dispatchEvent(event('pointerup',0,x,y));
  // Window delivery target is deliberately outside the canvas: releases over UI cancel.
  assert(s.held('DEEPSEEK'));view.cancel();
  canvas.dispatchEvent(event('pointerdown',0,x,y));
  const release=event('pointerup',0,x,y);Object.defineProperty(release,'target',{value:canvas});
  window.dispatchEvent(release);assert.equal(s.items[0].state,'FLIGHT');
  assert.equal(s.items[0].remainingThrows,2);
  assert(Math.abs(throws.at(-1)[1]-Math.PI/4)<1e-8);}
 view.dispose();view.dispose();assert.equal(scene.children.length,0);assert.equal(view.models.size,0);
 assert.equal(view.status.removed,true);
});
