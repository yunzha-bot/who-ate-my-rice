import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {HomeAvatar} from '../src/three/AlphaPresentation.ts';
import {CharacterActionView} from '../src/three/CharacterActionView.ts';
import {loadHumanModel,disposeHumanModel,HUMAN_GLB_URL} from '../src/three/HumanGlbModel.ts';

const bytes=readFileSync(new URL('../public/assets/characters/human/human_v2.glb',import.meta.url));
const source=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const actor=()=>{const a=new T.Mesh(new T.BoxGeometry(.5333333333333333,.7,.5333333333333333),new T.MeshStandardMaterial());a.position.y=.35;return a;};
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('runtime asset is byte-identical to the accepted candidate, self-contained and correctly grounded',()=>{
 assert(bytes.equals(readFileSync(new URL('../incoming-assets/human-v2/r03/human_static.glb',import.meta.url))));
 const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 assert.equal(json.scenes.length,1);assert.equal(json.meshes.length,12);assert.equal(json.materials.length,14);
 assert(!json.images&&!json.skins&&!json.animations&&!json.cameras);
 const b=new T.Box3().setFromObject(source.scene);assert.equal(b.min.y,0);assert(Math.abs(b.max.y-1.507275)<1e-6);
});

test('cached Human loader clones independent resources and disposal releases each shared material once',async t=>{
 let requests=0;t.mock.method(GLTFLoader.prototype,'loadAsync',async url=>{assert.equal(url,HUMAN_GLB_URL);requests++;return source;});
 const [a,b]=await Promise.all([loadHumanModel(),loadHumanModel()]);assert.equal(requests,1);
 const am=a.getObjectByProperty('isMesh',true),bm=b.getObjectByProperty('isMesh',true);
 assert.notEqual(am.geometry,bm.geometry);assert.notEqual(am.material,bm.material);
 const mats=new Set(),geos=new Set();a.traverse(o=>{if(o.isMesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});
 assert.equal(mats.size,14);let md=0,gd=0;mats.forEach(m=>m.addEventListener('dispose',()=>md++));geos.forEach(g=>g.addEventListener('dispose',()=>gd++));
 disposeHumanModel(a);assert.equal(md,mats.size);assert.equal(gd,geos.size);assert.equal(bm.geometry.attributes.position.count>0,true);disposeHumanModel(b);
});

test('Human visual is 35% larger with unchanged proportions, feet and gameplay root; walk/run and reset animate rigid limbs',async()=>{
 const a=actor(),view=new HomeAvatar(a,false),oldHeight=new T.Box3().setFromObject(view.root).getSize(new T.Vector3()).y;
 const model=await loadHumanModel();view.useExternalVisual(model);
 a.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(model);assert(Math.abs(bounds.getSize(new T.Vector3()).y-oldHeight*1.35)<1e-6,'Human must be 35% larger in the presentation layer only');assert(Math.abs(bounds.min.y)<1e-6);
 const dimensions=bounds.getSize(new T.Vector3()),original=new T.Box3().setFromObject(source.scene).getSize(new T.Vector3());
 assert(Math.abs(dimensions.x/dimensions.y-original.x/original.y)<1e-6);
 const left=model.getObjectByName('HumanLegPivot.L'),right=model.getObjectByName('HumanLegPivot.R');
 let walk=0,run=0;
 for(const action of ['WALK','RUN'])for(let i=0;i<90;i++){
  a.position.z+=action==='RUN'?.06:.025;view.update(action,16);
  a.updateMatrixWorld(true);
  if(action==='WALK')walk=Math.max(walk,Math.abs(left.rotation.x));else run=Math.max(run,Math.abs(left.rotation.x));
  assert(Math.abs(left.rotation.x+right.rotation.x)<1e-9);
  for(const side of ['L','R'])assert(new T.Box3().setFromObject(model.getObjectByName(`HU2_r03_Shoe${side}`)).min.y>=-1e-6,'animated shoes stay above ground');
 }
 assert(run>walk&&walk>.2);view.update('INTERACT',16);assert.equal(model.getObjectByName('HumanArmPivot.L').rotation.x,-.65);
 for(const action of ['FALL','STUN','IDLE']){
  view.update(action,100);a.updateMatrixWorld(true);
  assert(Math.abs(new T.Box3().setFromObject(model).min.y)<1e-6,`${action} remains grounded`);
 }
 view.reset();a.updateMatrixWorld(true);assert(Math.abs(left.rotation.x)<1e-12);assert(Math.abs(right.rotation.x)<1e-12);assert(Math.abs(new T.Box3().setFromObject(model).min.y)<1e-6);
 assert(Math.abs(new T.Box3().setFromObject(model).getSize(new T.Vector3()).y-oldHeight*1.35)<1e-6,'reset retains the enlarged visual size');
 assert.deepEqual(a.scale.toArray(),[1,1,1]);assert.equal(a.geometry.parameters.height,.7);assert.equal(a.rotation.z,0);
 assert.equal(view.root.getObjectByName('leftLeg').visible,false);
 view.clearExternalVisual();assert.equal(model.parent,null);assert.equal(view.root.getObjectByName('leftLeg').visible,true);view.dispose();
});

test('Human player/AI share the action bridge, and disposal/simplification reject late attachment',async t=>{
 const previous=globalThis.window;globalThis.window={};t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
 for(const cancel of ['none','dispose','simplify']){
  const a=actor(),view=new CharacterActionView(a,'HUMAN');
  if(cancel==='dispose')view.dispose();if(cancel==='simplify')view.useSimplifiedVisual();await settle();
  assert.equal(!!a.getObjectByName('HumanGLB'),cancel==='none');
  if(cancel==='none'){view.update('RUN',16);assert.equal(view.action,'RUN');view.reset();assert.equal(view.action,'IDLE');view.dispose();}
  if(cancel==='simplify')view.dispose();
 }
});

test('failed Human request can retry and malformed geometry is rejected without replacing the old avatar',async t=>{
 let code=readFileSync(new URL('../src/three/HumanGlbModel.ts',import.meta.url),'utf8');
 code=code.replace(/from '([^']+)'/g,(_,specifier)=>`from '${import.meta.resolve(specifier)}'`);
 const module=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString('base64')}`);
 let count=0;t.mock.method(GLTFLoader.prototype,'loadAsync',async()=>{if(++count===1)throw Error('offline');return source;});
 await assert.rejects(module.loadHumanModel(),/offline/);disposeHumanModel(await module.loadHumanModel());assert.equal(count,2);
 const a=actor(),view=new HomeAvatar(a,false),bad=new T.Group();bad.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));
 assert.throws(()=>view.useExternalVisual(bad),/missing/);assert.equal(view.root.getObjectByName('head').visible,true);view.dispose();disposeHumanModel(bad);
});
