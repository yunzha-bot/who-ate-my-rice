import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ThrowableLayoutModel,validateThrowableLayout,throwableLayoutSignature} from '../src/three/map/ThrowableLayoutModel.ts';
import {authoredMapSource} from '../src/three/map/MapEditModel.ts';
import {ThrowableSystem} from '../src/systems/ThrowableSystem.ts';
const layout=JSON.parse(readFileSync(new URL('../src/three/map/throwableLayout.json',import.meta.url)));
const source=authoredMapSource();
const clone=()=>structuredClone(layout);

test('throwable layout validates authored data and rejects unstable identities or unsafe placements',()=>{
 assert.equal(validateThrowableLayout(layout,layout,source),null);
 for(const change of [p=>p.x=NaN,p=>p.x=999,p=>p.kind='BOX',p=>p.id='unknown',
  p=>p.extra='unexpected',p=>{p.x=source.furniture[0].x;p.z=source.furniture[0].z;p.roomId=source.furniture[0].roomId;}]){
   const candidate=clone();change(candidate[0]);assert(validateThrowableLayout(candidate,layout,source));}
 const duplicate=clone();duplicate[1]={...duplicate[0]};assert(validateThrowableLayout(duplicate,layout,source));
 const missing=clone();missing.pop();assert(validateThrowableLayout(missing,layout,source));
});

function legalMove(model){const p=model.draft[0];for(const dx of [.05,-.05,.1,-.1]){
 const next=clone();next[0].x+=dx;if(!validateThrowableLayout(next,layout,source)){model.move(p.id,next[0].x,next[0].z);return next[0];}}
 throw Error('no legal adjacent test position');}

test('draft, apply, discard and save are separate; conflicts retain unsaved edits',async()=>{
 const oldFetch=globalThis.fetch,requests=[];let conflict=false;
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return{ok:!conflict,json:async()=>
  conflict?{error:'项目版本冲突'}:options?{revision:'saved'}:{revision:'initial',layout}};};
 try{let applied;const model=new ThrowableLayoutModel(layout,()=>source,p=>applied=structuredClone(p));
  const original=throwableLayoutSignature(layout),p=legalMove(model);
  assert(model.dirty);assert.equal(await model.save(),false);assert.equal(requests.length,0);
  assert.equal(throwableLayoutSignature(model.committed),original);
  assert(model.apply());assert(!model.dirty&&model.pending);assert.equal(applied[0].x,p.x);
  assert.equal(throwableLayoutSignature(layout),original);
  assert(await model.save());assert(!model.pending);assert.equal(requests.length,2);
  model.move(p.id,p.x+.01,p.z);model.discard();assert.equal(model.draft[0].x,p.x);
  model.move(p.id,p.x+.01,p.z);assert(model.apply());conflict=true;
  assert.equal(await model.save(),false);assert(model.pending);assert.match(model.message,/冲突/);
 }finally{globalThis.fetch=oldFetch;}
});

test('stale project read and network failures cannot be reported as saved',async()=>{
 const oldFetch=globalThis.fetch;
 try{const changed=clone();changed[0].x+=.1;
  globalThis.fetch=async()=>({ok:true,json:async()=>({revision:'newer',layout:changed})});
  const model=new ThrowableLayoutModel(layout,()=>source,()=>{});legalMove(model);model.apply();
  assert.equal(await model.save(),false);assert(model.pending);assert.match(model.message,/刷新/);
  globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await model.save(),false);
  assert(model.pending);assert.match(model.message,/offline/);
 }finally{globalThis.fetch=oldFetch;}
});

test('applying a prop layout never revives consumed props or moves held and flying props',()=>{
 const s=new ThrowableSystem(layout),candidate=clone();
 s.items[0].state='USED';s.items[1].state='HELD';s.items[1].holder='HUMAN';
 s.items[2].state='FLIGHT';const old=s.items.slice(0,3).map(p=>({x:p.x,z:p.z,state:p.state}));
 for(const p of candidate)p.x+=.01;s.applyLayout(candidate);
 assert.deepEqual(s.items.slice(0,3).map(p=>({x:p.x,z:p.z,state:p.state})),old);
 assert.equal(s.items[3].x,candidate[3].x);
 s.reset();assert(s.items.every(p=>p.state==='GROUND'));assert.equal(s.items[0].x,candidate[0].x);
});

test('Human visual restores the exact pre-proposal builder and aim trajectory has real dash distances',()=>{
 const avatar=readFileSync(new URL('../src/three/AlphaPresentation.ts',import.meta.url),'utf8');
 assert(!avatar.includes('buildHumanHomeModel'));assert(avatar.includes('make(this.head, w * 1.43'));
 const view=readFileSync(new URL('../src/three/ThrowableView.ts',import.meta.url),'utf8');
 assert.match(view,/new THREE.LineDashedMaterial/);assert.match(view,/this\.path\.computeLineDistances\(\)/);
});
