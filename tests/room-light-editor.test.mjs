import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp,readFile,writeFile,rename,copyFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
import {runInNewContext} from 'node:vm';
import {createRoomLightSwitches,RoomLightSystem} from '../src/systems/RoomLightSystem.ts';
import {lightPlacements,lightSignature,mountLight,validateLightLayout,resolvedLights,RoomLightLayoutModel}
  from '../src/three/map/RoomLightLayout.ts';
import {authoredMapSource,MapEditSession} from '../src/three/map/MapEditModel.ts';
import {CollisionWorld,orientedObstacleFromRect} from '../src/three/CollisionWorld.ts';
import {GAME_CONFIG as C} from '../src/config/gameConfig.ts';
import {SceneEditor} from '../src/three/SceneEditor.ts';
import {layoutSignature,importLayoutText,layoutSource} from '../src/three/map/MapLayoutStore.ts';
import {ROOMS,MAP_WIDTH,MAP_DEPTH} from '../src/three/map/apartmentMap.ts';
import * as THREE from 'three';
import {RoomLightView} from '../src/three/RoomLightView.ts';

const source=authoredMapSource();
const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,[],[...source.walls,...source.furniture].map(orientedObstacleFromRect));
const initial=createRoomLightSwitches(p=>world.canOccupyStaticXZ(p.x,p.z,C.collision.playerRadius,C.three.actorHeight));
const placements=lightPlacements(initial);
const id=p=>`light-switch:${p.roomId}`;
function move(model){const p=model.draft[0];model.move(id(p),p.x,p.z,1.4);return p;}

test('all authored room switches render and reopen in the editor at installation height 0.7',t=>{
  const saved=JSON.parse(readFileSync(new URL('../src/three/map/roomLightLayout.json',import.meta.url),'utf8'));
  assert.equal(saved.length,ROOMS.length);
  assert.deepEqual(saved.map(p=>p.roomId).sort(),ROOMS.map(p=>p.id).sort());
  assert.ok(saved.every(p=>p.height===.7));
  assert.equal(validateLightLayout(saved,source),null);
  const switches=createRoomLightSwitches(()=>false,saved.map(mountLight)),system=new RoomLightSystem(switches);
  const model=new RoomLightLayoutModel(switches,saved,()=>source,()=>{});
  assert.ok(model.draft.every(p=>p.height===.7));
  const old=globalThis.document;
  globalThis.document={createElement:()=>({hidden:false,setAttribute(){},remove(){}})};
  t.after(()=>globalThis.document=old);
  const view=new RoomLightView(new THREE.Scene(),{append(){}},system,
    new THREE.HemisphereLight(),new THREE.DirectionalLight());
  for(const p of saved)assert.equal(view.targets.get(id(p)).position.y,.7);
  view.sync(true,system,null,()=>false,false);
  for(const p of saved)assert.equal(view.targets.get(id(p)).position.y,.7);
  view.dispose();
});

test('wall placement is anchored, same region, finite, standable and reachable; defaults stay unchanged',()=>{
  assert.equal(validateLightLayout([],source),null);
  assert.equal(validateLightLayout(placements,source),null);
  assert.deepEqual(resolvedLights(initial,[]),initial);
  for(const mutate of [p=>p.x=NaN,p=>p.z+=1,p=>p.height=0,p=>p.height=99,p=>p.roomId='unknown',p=>p.extra=true]){
    const p=structuredClone(placements[0]);mutate(p);assert.ok(validateLightLayout([p],source));
  }
  assert.ok(validateLightLayout([placements[0],placements[0]],source));
  const p=placements[0],m=mountLight({...p,x:p.x+.17,z:p.z+.17});
  assert.equal(m.roomId,p.roomId);assert.equal(validateLightLayout(lightPlacements([m]),source),null);
  const blocked={...source,furniture:[...source.furniture,{id:'test-block',x:m.approach.x,z:m.approach.z,
    width:1,depth:1,height:2,kind:'furniture',roomId:p.roomId}]};
  assert.match(validateLightLayout(lightPlacements([m]),blocked),/阻挡/);
  const room=ROOMS.find(r=>r.id===p.roomId);
  const other=mountLight({...p,x:room.maxX,z:(room.minZ+room.maxZ)/2});
  assert.equal(other.roomId,p.roomId);assert.notDeepEqual(other.normal,initial[0].normal);
});

test('draft preview never changes runtime; apply updates AI/interaction position, reset only clears light state',()=>{
  const system=new RoomLightSystem(initial);
  const m=new RoomLightLayoutModel(initial,[],()=>source,p=>system.switches=resolvedLights(initial,p));
  const before=structuredClone(system.switches),p=m.draft[0];
  m.move(id(p),p.x+.2,p.z,1.4);assert.ok(m.dirty);assert.deepEqual(system.switches,before);
  assert.ok(m.apply());assert.ok(m.pending);assert.equal(system.switches[0].height,1.4);
  assert.deepEqual(system.aiCandidate('HUMAN',system.switches[0].approach,null),system.switches[0]);
  assert.ok(system.toggle(p.roomId,system.switches[0].approach,true,()=>false));
  const cooldown=system.cooldown(p.roomId);move(m);m.apply();assert.equal(system.cooldown(p.roomId),cooldown);
  assert.equal(system.isOn(p.roomId),true);system.reset();assert.equal(system.isOn(p.roomId),false);
  assert.equal(system.switches[0].height,1.4);
  m.move(id(p),p.x,p.z,1.5);m.discard();assert.equal(m.draft[0].height,1.4);
  assert.deepEqual(initial,before,'original objects not mutated');
});

test('light persistence rejects drafts, stale reads, denied writes and missing acknowledgments',async()=>{
  const old=globalThis.fetch;let fail=false,body,calls=0;
  globalThis.fetch=async(_url,options)=>{calls++;if(options)body=JSON.parse(options.body);
    return {ok:!fail,json:async()=>fail?{error:'409版本冲突'}:options?{revision:'next'}:{revision:'original',layout:[]}};};
  try{
    const model=new RoomLightLayoutModel(initial,[],()=>source,()=>{});move(model);
    assert.equal(await model.save(),false);assert.equal(calls,0);
    assert.ok(model.apply());assert.ok(await model.save());assert.equal(model.pending,false);
    const reloaded=resolvedLights(initial,body.layout);assert.equal(reloaded[0].height,1.4);
    model.move(id(model.draft[0]),model.draft[0].x,model.draft[0].z,1.5);model.apply();fail=true;
    assert.equal(await model.save(),false);assert.ok(model.pending);assert.match(model.message,/冲突/);
    globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await model.save(),false);assert.ok(model.pending);
    globalThis.fetch=async()=>({ok:true,json:async()=>({})});assert.equal(await model.save(),false);assert.ok(model.pending);
    const stale=new RoomLightLayoutModel(initial,[],()=>source,()=>{});move(stale);stale.apply();
    globalThis.fetch=async()=>({ok:true,json:async()=>({revision:'changed',layout:placements})});
    assert.equal(await stale.save(),false);assert.match(stale.message,/刷新/);
  }finally{globalThis.fetch=old;}
});

function editor(){
  const e=Object.create(SceneEditor.prototype);e.session=new MapEditSession(source);
  e.hooks={};e.panel={showNotice(){}};e.view={};e.message='';e.projectRevision='map-rev';
  e.savedLayoutSignature=layoutSignature(e.session.exportJson());e.endDragWindow=()=>{};
  e.rebuildFromCommitted=()=>{};e.refreshRegionPreview=()=>{};
  e.lightEditor={model:new RoomLightLayoutModel(initial,[],()=>source,()=>{}),render(){}};return e;
}

test('existing general Apply/Discard/Save include lights and never save an unapplied draft',async()=>{
  const e=editor(),model=e.lightEditor.model;move(model);assert.ok(e.layoutStatus().pending);
  const old=globalThis.fetch;let sent,requests=0;
  globalThis.fetch=async(url,options)=>{requests++;if(options)sent=JSON.parse(options.body);
    return {ok:true,json:async()=>options?{revision:'map-next',lightRevision:'light-next',savedAt:'test'}:{revision:'light-old',layout:[]}};};
  try{
    assert.equal(await e.saveLayout(),false);assert.equal(requests,0);
    e.discardDraft();assert.equal(model.dirty,false);move(model);assert.ok(e.applyEdits());
    assert.ok(await e.saveLayout());assert.equal(sent.lights.layout[0].height,1.4);
    assert.equal(sent.lights.revision,'light-old');assert.equal(model.pending,false);
    assert.equal(e.layoutStatus().pending,false);
  }finally{globalThis.fetch=old;}
});

test('actual DEV endpoint validates, retains backups, rejects old versions/origins; disk data restores same mount',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'rice-light-save-'));
  const lightLayoutPath=join(folder,'lights.json'),layoutPath=join(folder,'scene.json');
  const revision=s=>createHash('sha256').update(s).digest('hex');
  try{
    await writeFile(lightLayoutPath,'[]\n');await writeFile(layoutPath,JSON.stringify({furniture:source.furniture,hideSpots:source.hideSpots}));
    const config=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8').replaceAll('\r\n','\n');
    const code=config.slice(config.indexOf('function roomLightLayoutSave()'),config.indexOf('/**\n * 本地开发固定'));
    const factory=runInNewContext(stripTypeScriptTypes(code+'\nroomLightLayoutSave'),{
      readFile,writeFile,rename,copyFile,revision,lightLayoutPath,layoutPath,authoredMapSource,
      validateLightLayout,layoutSaving:false,process:{pid:process.pid}});
    let handler;factory().configureServer({config:{server:{port:5173}},middlewares:{use(_url,callback){handler=callback;}}});
    async function request(method,payload,origin){
      const req={method,headers:{origin},async *[Symbol.asyncIterator](){yield JSON.stringify(payload);}};
      let data;const res={statusCode:200,setHeader(){},end(body){data=body?JSON.parse(body):null;}};
      await handler(req,res);return {status:res.statusCode,data};
    }
    const get=await request('GET');assert.equal(get.status,200);
    assert.equal((await request('POST',{revision:'stale',layout:placements})).status,409);
    assert.equal((await request('POST',{},'https://untrusted.example')).status,403);
    assert.equal((await request('POST',{revision:get.data.revision,layout:[{...placements[0],x:999}]})).status,400);
    assert.equal(await readFile(lightLayoutPath,'utf8'),'[]\n');
    const saved=structuredClone(placements);saved[0].height=1.4;
    const result=await request('POST',{revision:get.data.revision,layout:saved});assert.equal(result.status,200);
    const disk=JSON.parse(await readFile(lightLayoutPath,'utf8'));
    assert.equal(lightSignature(disk),lightSignature(saved));assert.equal(resolvedLights(initial,disk)[0].height,1.4);
    const backup=(await readdir(folder)).find(p=>p.endsWith('.bak'));assert.ok(backup);
    assert.equal(await readFile(join(folder,backup),'utf8'),'[]\n');
    assert.equal((await request('POST',{revision:get.data.revision,layout:[]})).status,409);
    assert.equal((await request('GET')).data.revision,result.data.revision);
    assert.deepEqual(JSON.parse(await readFile(layoutPath,'utf8')),{furniture:source.furniture,hideSpots:source.hideSpots});
    // Execute the existing general Save handler too: validate every revision before any write.
    const general=config.slice(config.indexOf('function sceneLayoutSave()'),config.indexOf('/** Independent prop layout'));
    const generalFactory=runInNewContext(stripTypeScriptTypes(general+'\nsceneLayoutSave'),{
      readFile,writeFile,rename,copyFile,revision,lightLayoutPath,layoutPath,
      throwableLayoutPath:join(folder,'unused-props.json'),authoredMapSource,importLayoutText,layoutSource,
      validateLightLayout,layoutSaving:false,process:{pid:process.pid}});
    generalFactory().configureServer({config:{server:{port:5173}},middlewares:{use(_url,callback){handler=callback;}}});
    const mapBefore=await readFile(layoutPath,'utf8'),lightBefore=await readFile(lightLayoutPath,'utf8');
    const document=new MapEditSession(source).exportJson();
    assert.equal((await request('POST',{revision:revision(mapBefore),document,
      lights:{revision:'stale',layout:saved}})).status,409);
    assert.equal(await readFile(layoutPath,'utf8'),mapBefore);assert.equal(await readFile(lightLayoutPath,'utf8'),lightBefore);
    const next=structuredClone(saved);next[0].height=1.45;
    const together=await request('POST',{revision:revision(mapBefore),document,
      lights:{revision:revision(lightBefore),layout:next}});
    assert.equal(together.status,200);assert.equal(together.data.lightRevision,revision(await readFile(lightLayoutPath,'utf8')));
    assert.equal(JSON.parse(await readFile(lightLayoutPath,'utf8'))[0].height,1.45);
  }finally{await rm(folder,{recursive:true,force:true});}
});
