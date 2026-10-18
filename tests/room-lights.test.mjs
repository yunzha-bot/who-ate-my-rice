import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as THREE from 'three';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { RoomLightSystem, createRoomLightSwitches } from '../src/systems/RoomLightSystem.ts';
import { PerceptionGeometry, VisionSystem, crossesRect } from '../src/systems/PerceptionSystem.ts';
import { CollisionWorld, orientedObstacleFromRect } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { RoomLightView } from '../src/three/RoomLightView.ts';
import { RoomDaylightView } from '../src/three/RoomDaylightView.ts';
import { InputManager } from '../src/three/InputManager.ts';
import { ROOMS, WALLS, FURNITURE, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, SPAWNS, OPEN_ROOM_CONNECTIONS } from '../src/three/map/apartmentMap.ts';

const clear = () => false;
const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const method = name => source.match(new RegExp(`  private ${name}\\([\\s\\S]*?\\n  }\\r?\\n`))[0];
function actualMap() {
  const boxes = WALLS.map(r => new THREE.Box3(new THREE.Vector3(r.x-r.width/2,0,r.z-r.depth/2),
    new THREE.Vector3(r.x+r.width/2,r.height,r.z+r.depth/2)));
  const world = new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,boxes,FURNITURE.map(orientedObstacleFromRect));
  const switches = createRoomLightSwitches(p=>world.canOccupyStaticXZ(p.x,p.z,C.collision.playerRadius,C.three.actorHeight));
  return { world, switches, system: new RoomLightSystem(switches) };
}

test('all 18 authoritative regions have mounted, standable and reachable switches without moving props', () => {
  const {world,switches,system} = actualMap();
  assert.equal(switches.length,18); assert.equal(new Set(switches.map(s=>s.roomId)).size,ROOMS.length);
  const nav = new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES);
  const doors=DOOR_NODES.map(d=>({id:d.id,state:'OPEN'}));
  for(const item of switches) {
    assert.equal(system.roomId(item.approach),item.roomId);
    assert.ok(world.canOccupyStaticXZ(item.approach.x,item.approach.z,C.collision.playerRadius,C.three.actorHeight));
    assert.ok(system.nearby(item.approach,clear));
    const behind={x:item.x-item.normal.x*.2,z:item.z-item.normal.z*.2};
    assert.ok(WALLS.some(w=>crossesRect(behind,item,w)),`${item.roomId} has a real wall behind its plate`);
    for (const spawn of [SPAWNS.human,SPAWNS.deepseek])
      assert.ok(nav.findPath(spawn,item.approach,doors),`${item.roomId} reachable from each spawn with doors open`);
  }
});

test('shared switches require proximity and clear access, freeze with zero game delta, reset off', () => {
  const {switches,system}=actualMap(), item=switches[0];
  assert.ok(switches.every(s=>!system.isOn(s.roomId)));
  assert.equal(system.toggle(item.roomId,{x:0,z:0},true,clear),false);
  assert.equal(system.toggle(item.roomId,item.approach,false,clear),false);
  assert.equal(system.toggle(item.roomId,item.approach,true,()=>true),false);
  assert.equal(system.toggle(item.roomId,item.approach,true,clear),true);
  assert.equal(system.isOn(item.roomId),true);
  system.advance(0); assert.equal(system.cooldown(item.roomId),3000);
  system.advance(2999); assert.equal(system.toggle(item.roomId,item.approach,true,clear),false);
  system.advance(1); assert.equal(system.toggle(item.roomId,item.approach,true,clear),true);
  assert.equal(system.isOn(item.roomId),false); system.reset();
  assert.equal(system.cooldown(item.roomId),0); assert.equal(system.isOn(item.roomId),false);
});

test('the open gym is one lighting area with linked switches, shared cooldown and no internal vision seam',()=>{
  const {system,switches}=actualMap(),a=switches.find(p=>p.roomId==='south_hall'),b=switches.find(p=>p.roomId==='east_hall');
  assert.ok(OPEN_ROOM_CONNECTIONS.some(c=>c.connectedRoomA===a.roomId&&c.connectedRoomB===b.roomId));
  assert.equal(WALLS.some(w=>crossesRect({x:15.9,z:12},{x:16.1,z:12},w)),false);
  assert.ok(system.toggle(a.roomId,a.approach,true,clear));
  assert.equal(system.isOn(b.roomId),true);
  assert.equal(system.cooldown(b.roomId),C.roomLights.toggleCooldownMs);
  assert.equal(system.toggle(b.roomId,b.approach,true,clear),false,'second switch cannot bypass shared cooldown');
  for(const x of [15.9,16,16.1])assert.equal(system.rangeFor({x,z:12},5),Infinity);
  assert.equal(system.rangeFor({x:16,z:19},5),5,'external edge is not the internal open seam');
  assert.equal(system.isOn('dining'),false);assert.equal(system.rangeFor({x:13,z:3},5),5,'no rectangular spill outside L-shaped gym');
  system.advance(3000);assert.ok(system.toggle(b.roomId,b.approach,true,clear));
  assert.equal(system.isOn(a.roomId),false);assert.equal(system.cooldown(a.roomId),3000);
  system.reset();assert.equal(system.cooldown(b.roomId),0);assert.equal(system.isOn(b.roomId),false);
});

test('gym lighting uniforms restore both contiguous areas from either switch but not neighboring rooms',()=>{
  const {system,switches}=actualMap(),scene=new THREE.Scene();
  const daylight=new RoomDaylightView(scene,new THREE.HemisphereLight(),new THREE.DirectionalLight());
  const m=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(m);
  const indices=['south_hall','east_hall'].map(id=>ROOMS.findIndex(r=>r.id===id));
  for(const id of ['south_hall','east_hall']){
    const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    system.reset();const p=switches.find(p=>p.roomId===id);system.toggle(id,p.approach,true,clear);
    daylight.sync(true,system);m.material.onBeforeCompile(shader,{});
    assert.deepEqual(indices.map(i=>shader.uniforms.riceRoomOn.value[i]),[1,1]);
    assert.equal(shader.uniforms.riceRoomOn.value.filter(Boolean).length,2);
  }
  daylight.dispose();m.geometry.dispose();m.material.dispose();
});

test('both factions see the lit open gym across the old seam, with normal concealment retained',()=>{
  const {system,switches}=actualMap(),a={x:13,z:12},b={x:19,z:12};
  const vision=new VisionSystem({visionRange:11},()=>5,target=>system.rangeFor(target,0)===Infinity);
  const geometry=new PerceptionGeometry(WALLS,DOOR_NODES,()=>DOOR_NODES.map(d=>({id:d.id,state:'OPEN'})));
  vision.update(0,a,b,geometry);assert.equal(vision.get('HUMAN').visible,false);assert.equal(vision.get('DEEPSEEK').visible,false);
  const s=switches.find(p=>p.roomId==='south_hall');system.toggle(s.roomId,s.approach,true,clear);
  vision.update(0,a,b,geometry);assert.equal(vision.get('HUMAN').visible,true);assert.equal(vision.get('DEEPSEEK').visible,true);
  vision.setConcealed('DEEPSEEK',true);vision.update(0,a,b,geometry);assert.equal(vision.get('HUMAN').status,'CONCEALED');
});

test('gym switches can be approached across the open seam by either AI, without remote toggle or wall bypass',()=>{
  const Harness=runInNewContext(stripTypeScriptTypes(`class Harness {${method('roomLightAiDirection')}};Harness`,{mode:'transform'}),{C});
  for(const faction of ['HUMAN','DEEPSEEK']){
    const {system:lights,world,switches}=actualMap(),s=switches.find(p=>p.roomId==='south_hall');
    if(faction==='DEEPSEEK'){lights.toggle(s.roomId,s.approach,true,clear);lights.advance(3000);}
    const actor=new THREE.Mesh();actor.position.set(16.2,0,7.95);
    assert.equal(lights.aiCandidate(faction,actor.position,faction==='DEEPSEEK'?{x:20,z:7.95}:null).roomId,'south_hall');
    const game=new Harness();Object.assign(game,{roomLights:lights,canUseRoomLight:()=>true,roomLightBlocked:clear,
      doorSystem:{doors:[]},navigation:{findPath:(a,b)=>a.x>16?[{...a},{x:16,z:a.z},{...b}]:[{...a},{...b}]}});
    const enemy=faction==='DEEPSEEK'?{x:20,z:7.95}:null,before=lights.isOn(s.roomId);
    assert.equal(lights.toggle(s.roomId,actor.position,true,clear),false);
    assert.ok(game.roomLightAiDirection(faction,actor,true,enemy),'old logical boundary no longer rejects the path');
    for(let i=0;i<100&&lights.isOn(s.roomId)===before;i++){
      const direction=game.roomLightAiDirection(faction,actor,true,enemy);
      if(direction)actor.position.copy(world.move(actor.position,direction.x*.1,direction.z*.1,C.collision.playerRadius,C.three.actorHeight));
    }
    assert.equal(lights.isOn('south_hall'),faction==='HUMAN');assert.equal(lights.isOn('east_hall'),faction==='HUMAN');
    assert.ok(Math.hypot(actor.position.x-s.x,actor.position.z-s.z)<=C.roomLights.interactionRange);
  }
  const mounted=new RoomLightSystem([{roomId:'south_hall',x:15.5,z:18.85,normal:{x:0,z:-1},approach:{x:15.5,z:18.05}}]);
  assert.equal(mounted.nearby({x:16.1,z:18.2},clear)?.roomId,'south_hall');
  assert.equal(mounted.nearby({x:16.1,z:18.2},()=>true),null,'same area never removes physical obstruction checks');
});

const rooms=[{id:'a',minX:-20,maxX:0,minZ:-5,maxZ:5},{id:'b',minX:0,maxX:20,minZ:-5,maxZ:5}];
const switches=[{roomId:'a',x:-2,z:0,normal:{x:1,z:0},approach:{x:-1.2,z:0}},
  {roomId:'b',x:2,z:0,normal:{x:1,z:0},approach:{x:2.8,z:0}}];

test('actual Vision initialization extends only the lit target region for both factions, not EASY/NORMAL', () => {
  const initializer=source.match(/private vision = ([\s\S]*?);\r?\n/)[1];
  const create=runInNewContext(`(function(){return ${initializer};})`,{VisionSystem,C});
  const lights=new RoomLightSystem(switches,rooms), empty=new PerceptionGeometry([],[],()=>[]);
  const human={x:-10,z:0}, dp={x:10,z:0};
  const game={difficulty:'HARD',runtime:{visionRange:11},roomLights:lights};
  const vision=create.call(game);
  vision.update(0,human,dp,empty); assert.equal(vision.get('HUMAN').visible,false);
  lights.toggle('b',switches[1].approach,true,clear); vision.update(0,human,dp,empty);
  assert.equal(vision.get('HUMAN').visible,true,'Human sees the lit DP at 20 units');
  assert.equal(vision.get('DEEPSEEK').visible,false,'Human remains in the dark region');
  lights.toggle('a',switches[0].approach,true,clear); vision.update(0,human,dp,empty);
  assert.equal(vision.get('DEEPSEEK').visible,true,'DP sees lit Human too');
  const wall=new PerceptionGeometry([{id:'wall',kind:'wall',x:0,z:0,width:.2,depth:5,height:2}],[],()=>[]);
  vision.update(0,human,dp,wall); assert.equal(vision.get('HUMAN').status,'BLOCKED');
  assert.equal(vision.get('DEEPSEEK').status,'BLOCKED');
  vision.setConcealed('DEEPSEEK',true); vision.update(0,human,dp,empty);
  assert.equal(vision.get('HUMAN').status,'CONCEALED'); assert.equal(vision.get('DEEPSEEK').visible,true);
  vision.setConcealed('DEEPSEEK',false);
  for(const level of ['EASY','NORMAL']) {
    game.difficulty=level; vision.update(0,human,dp,empty);
    assert.equal(vision.get('HUMAN').visible,false); assert.equal(vision.get('DEEPSEEK').visible,false);
  }
  game.difficulty='HARD'; lights.advance(3000); lights.toggle('b',switches[1].approach,true,clear);
  vision.update(0,human,dp,empty); assert.equal(vision.get('HUMAN').visible,false);
});

test('actual player render rule matches lit target visibility but still respects walls and concealment', () => {
  const getter=source.match(/  private get opponentVisible\([\s\S]*?\n  }\r?\n/)[0];
  const Harness=runInNewContext(stripTypeScriptTypes(`class Harness {${getter}};Harness`,{mode:'transform'}),{C});
  const lights=new RoomLightSystem(switches,rooms);
  lights.toggle('a',switches[0].approach,true,clear); lights.toggle('b',switches[1].approach,true,clear);
  const game=new Harness(); Object.assign(game,{roomLights:lights,control:{selectedFaction:'HUMAN'},
    human:{position:{x:-10,z:0}},player:{position:{x:10,z:0}},hide:{isConcealed:()=>false},
    perceptionGeometry:new PerceptionGeometry([],[],()=>[])});
  for(const observer of ['HUMAN','DEEPSEEK']) {game.control.selectedFaction=observer; assert.equal(game.opponentVisible,true);}
  game.perceptionGeometry=new PerceptionGeometry([{id:'w',kind:'wall',x:0,z:0,width:.2,depth:5,height:2}],[],()=>[]);
  assert.equal(game.opponentVisible,false);
  game.perceptionGeometry=new PerceptionGeometry([],[],()=>[]); game.control.selectedFaction='HUMAN';
  game.hide.isConcealed=()=>true; assert.equal(game.opponentVisible,false);
});

test('real AI light helper moves physically before toggling; no remote use or abandonment of a chase', () => {
  const Harness=runInNewContext(stripTypeScriptTypes(`class Harness {${method('roomLightAiDirection')}};Harness`,{mode:'transform'}),{C});
  for(const faction of ['HUMAN','DEEPSEEK']) {
    const lights=new RoomLightSystem([switches[1]],[rooms[1]]);
    if(faction==='DEEPSEEK') {lights.toggle('b',switches[1].approach,true,clear);lights.advance(3000);}
    const world=new CollisionWorld(30,10,[]), actor=new THREE.Mesh();actor.position.set(5,0,0);
    const game=new Harness();Object.assign(game,{roomLights:lights,canUseRoomLight:()=>true,roomLightBlocked:clear,
      doorSystem:{doors:[]},navigation:{findPath:(a,b)=>[{...a},{...b}]}});
    const enemy=faction==='DEEPSEEK'?{x:10,z:0}:null;
    const before=lights.isOn('b');
    assert.equal(game.roomLightAiDirection(faction,actor,false,enemy),null);
    assert.equal(lights.isOn('b'),before);
    for(let i=0;i<60&&lights.isOn('b')===before;i++) {
      const direction=game.roomLightAiDirection(faction,actor,true,enemy);
      if(direction)actor.position.copy(world.move(actor.position,direction.x*.1,direction.z*.1,C.collision.playerRadius,C.three.actorHeight));
    }
    assert.equal(lights.isOn('b'),faction==='HUMAN');
    assert.ok(Math.hypot(actor.position.x-2,actor.position.z)<=C.roomLights.interactionRange);
    if(faction==='DEEPSEEK') {
      lights.advance(3000); lights.toggle('b',switches[1].approach,true,clear);lights.advance(3000);
      actor.position.set(5,0,0);
      assert.equal(game.roomLightAiDirection(faction,actor,true,null),null,'no hidden-target knowledge');
      assert.equal(game.roomLightAiDirection(faction,actor,true,{x:1,z:0}),null,'do not detour toward the pursuer');
    }
    game.canUseRoomLight=()=>false;actor.position.set(2.8,0,0);
    assert.equal(game.roomLightAiDirection(faction,actor,true,enemy),null);
  }
});

test('household rocker switches and prompt follow HARD state without yellow point lights or floor overlays', t => {
  const old=globalThis.document; const appended=[];
  globalThis.document={createElement:()=>({hidden:false,setAttribute(){},remove(){this.removed=true;}})};
  t.after(()=>{globalThis.document=old;});
  const {system,switches}=actualMap(),scene=new THREE.Scene();
  const view=new RoomLightView(scene,{append:p=>appended.push(p)},system,
    new THREE.HemisphereLight(0xfff5e4,0x9c9988,2),new THREE.DirectionalLight(0xffefd8,2.4)),item=switches[0];
  assert.equal(view.root.children.filter(n=>n.name.startsWith('light-switch:')).length,18);
  const mount=view.root.getObjectByName(`light-switch:${item.roomId}`), rocker=mount.getObjectByName('rocker');
  assert.ok(mount.children.length>=5,'frame, recess, rocker and screw heads');
  assert.equal(rocker.material.isMeshStandardMaterial,true,'rocker is shaded white plastic, not an unlit yellow sign');
  const offAngle=rocker.rotation.x;
  view.sync(false,system,item.approach,clear,true);assert.equal(view.root.visible,false);assert.equal(appended[0].hidden,true);
  view.sync(true,system,item.approach,clear,true);assert.match(appended[0].textContent,/L 开灯/);
  system.toggle(item.roomId,item.approach,true,clear);view.sync(true,system,item.approach,clear,true);
  assert.match(appended[0].textContent,/L 关灯/);assert.notEqual(rocker.rotation.x,offAngle);
  assert.equal(view.root.children.some(n=>n.isPointLight||n.geometry?.type==='PlaneGeometry'),false);
  view.sync(false,system,item.approach,clear,true);assert.equal(view.root.visible,false);
  view.dispose();assert.equal(view.root.parent,null);assert.equal(appended[0].removed,true);
});

test('lit regions use exact original daylight colors/intensities without changing dark-region lights or textures', () => {
  const {system,switches}=actualMap(),scene=new THREE.Scene();
  const ambient=new THREE.HemisphereLight(0xfff5e4,0x9c9988,2),sun=new THREE.DirectionalLight(0xffefd8,2.4);
  const material=new THREE.MeshStandardMaterial({color:0xd2ae78}),mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);
  scene.add(mesh,ambient,sun);const originalCompile=material.onBeforeCompile,originalKey=material.customProgramCacheKey;
  const color=material.color.clone(),daylight=new RoomDaylightView(scene,ambient,sun);
  const expectedSky=ambient.color.clone().multiplyScalar(2),expectedGround=ambient.groundColor.clone().multiplyScalar(2);
  const expectedSun=sun.color.clone().multiplyScalar(2.4);
  ambient.color.setHex(0x9bb9ed);ambient.intensity=.9;sun.color.setHex(0x8eace0);sun.intensity=.65;
  daylight.sync(true,system);
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader,{});
  assert.ok(shader.uniforms.riceDaySky.value.equals(expectedSky));assert.ok(shader.uniforms.riceDayGround.value.equals(expectedGround));
  assert.ok(shader.uniforms.riceDaySun.value.equals(expectedSun));assert.ok(material.color.equals(color));
  assert.equal(ambient.intensity,.9);assert.equal(sun.intensity,.65,'dark rooms retain the original moonlight');
  assert.match(shader.vertexShader,/instanceMatrix \* riceWorld/);assert.match(shader.vertexShader,/modelMatrix \* riceWorld/);
  assert.match(shader.fragmentShader,/if \(riceDaylit\) directLight.color = riceDaySun/);
  assert.match(shader.fragmentShader,/riceHemi.skyColor = riceDaySky/);
  const item=switches[0], index=ROOMS.findIndex(r=>r.id===item.roomId);
  assert.ok(shader.uniforms.riceRoomOn.value.every(v=>v===0));
  system.toggle(item.roomId,item.approach,true,clear);daylight.sync(true,system);
  assert.equal(shader.uniforms.riceRoomOn.value[index],1);
  assert.equal(shader.uniforms.riceRoomOn.value.filter(v=>v===1).length,1,'no adjacent-room light spill');
  const late=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(late);daylight.sync(true,system);
  assert.match(late.material.customProgramCacheKey(),/rice-room-daylight/,'late GLB/editor materials are included');
  daylight.sync(false,system);assert.equal(shader.uniforms.riceRoomLighting.value,false);
  daylight.dispose();assert.equal(material.onBeforeCompile,originalCompile);assert.equal(material.customProgramCacheKey,originalKey);
  mesh.geometry.dispose();material.dispose();late.geometry.dispose();late.material.dispose();
});

test('L stays a debug movement key by default, but an owned light press excludes only L', t => {
  const old=globalThis.window;globalThis.window=new EventTarget();t.after(()=>{globalThis.window=old;});
  const input=new InputManager();const down=code=>Object.assign(new Event('keydown'),{code,repeat:false});
  window.dispatchEvent(down('KeyL'));assert.equal(input.debugDirection().x,1);assert.equal(input.debugDirection(true).x,0);
  window.dispatchEvent(down('KeyI'));assert.equal(input.debugDirection(true).y,-1); input.dispose();
});
