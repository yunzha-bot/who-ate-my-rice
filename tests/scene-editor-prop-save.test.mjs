import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SceneEditor,committedMap} from '../src/three/SceneEditor.ts';
import {MapEditSession,authoredMapSource} from '../src/three/map/MapEditModel.ts';
import {layoutSignature} from '../src/three/map/MapLayoutStore.ts';
import {ThrowableLayoutModel} from '../src/three/map/ThrowableLayoutModel.ts';
import {ThrowableSystem} from '../src/systems/ThrowableSystem.ts';
const initial=JSON.parse(readFileSync(new URL('../src/three/map/throwableLayout.json',import.meta.url)));
function editor(){
 const e=Object.create(SceneEditor.prototype);e.session=new MapEditSession(authoredMapSource());
 e.hooks={};e.panel={showNotice(){}};e.view={};e.message='';e.lastLayoutError=null;e.projectRevision='map-rev';
 e.savedLayoutSignature=layoutSignature(e.session.exportJson());e.endDragWindow=()=>{};e.rebuildFromCommitted=()=>{};
 e.refreshRegionPreview=()=>{};
 e.throwEditor={model:new ThrowableLayoutModel(initial,()=>({...e.session.sourceMap,...committedMap(e.session)}),()=>{}),render(){}};
 return e;
}
test('general Apply commits throwable edits before a later refresh can discard them',()=>{
 const e=editor(),model=e.throwEditor.model,p=model.draft[0],x=p.x+.01;
 model.move(p.id,x,p.z);assert.equal(e.applyEdits(),true);
 assert.equal(model.committed[0].x,x);assert.equal(model.dirty,false);assert.equal(model.pending,true);
});
test('general layout status and discard include throwable drafts',()=>{
 const e=editor(),model=e.throwEditor.model,p=model.draft[0];model.move(p.id,p.x+.01,p.z);
 assert.equal(e.layoutStatus().pending,true);assert.equal(e.layoutStatus().saved,false);
 e.discardDraft();assert.equal(model.dirty,false);assert.equal(e.layoutStatus().pending,false);
});
test('general Save transmits applied prop data and revision; reload restores it, failure stays unsaved',async()=>{
 const e=editor(),model=e.throwEditor.model,p=model.draft[0],x=p.x+.01;model.move(p.id,x,p.z);model.apply();
 const oldFetch=globalThis.fetch;let sent;let reject=false;
 globalThis.fetch=async(url,options)=>{
  if(!options)return {ok:true,json:async()=>({revision:'prop-rev',layout:initial})};
  sent=JSON.parse(options.body);
  return {ok:!reject,json:async()=>reject?{error:'版本冲突'}:{revision:'map-next',throwableRevision:'prop-next',savedAt:'test'}};
 };
 try{
  assert.equal(await e.saveLayout(),true);
  assert.equal(sent.throwables.revision,'prop-rev');assert.equal(sent.throwables.layout[0].x,x);
  assert.equal(new ThrowableSystem(sent.throwables.layout).items[0].x,x);
  assert.equal(model.pending,false);
  model.move(p.id,x+.01,p.z);model.apply();reject=true;assert.equal(await e.saveLayout(),false);
  assert.equal(model.pending,true);assert.match(e.message,/冲突/);
 }finally{globalThis.fetch=oldFetch;}
});
test('general Save refuses an unapplied throwable draft without a request',async()=>{
 const e=editor(),model=e.throwEditor.model,p=model.draft[0];model.move(p.id,p.x+.01,p.z);
 const oldFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('unexpected request');};
 try{assert.equal(await e.saveLayout(),false);assert.equal(requests,0);assert.match(e.message,/应用/);}
 finally{globalThis.fetch=oldFetch;}
});
