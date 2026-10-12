import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { RiceView } from '../src/three/RiceView.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';

test('optimized supplied GLB is self-contained, bounded, textured and under 15000 triangles',()=>{
 const file=fs.readFileSync('public/assets/props/rice-bag/rice-bag.glb');
 assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(8),file.length);
 assert.ok(file.length<1024*1024);
 const json=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString());
 const primitive=json.meshes[0].primitives[0];assert.ok(json.accessors[primitive.indices].count/3<15000);
 assert.ok(json.images.every(image=>image.bufferView!==undefined&&!image.uri));
 const pos=json.accessors[primitive.attributes.POSITION];assert.ok(Math.abs(pos.min[1])<1e-6);
 assert.ok(pos.max[1]>.9&&pos.max[1]<1.1);assert.ok(pos.min[0]<0&&pos.max[0]>0);
 assert.equal(json.materials[0].pbrMetallicRoughness.metallicFactor,0);
});

test('loaded model replaces fallback, follows progress and resets without moving the anchor',()=>{
 const v=new RiceView(.5,GAME_CONFIG.rice.color,GAME_CONFIG.rice.visual),r=new RiceSystem('rice_test',5000,400);
 v.position.set(3,0,4);v.sync(r.rice);
 const model=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());
 mesh.geometry.translate(0,.5,0);mesh.castShadow=mesh.receiveShadow=true;model.add(mesh);
 v.useModel(model);assert.equal(v.object.children[0].visible,false);
 assert.equal(mesh.castShadow,false,'late loaded indoor geometry keeps covered shadow policy');
 const scale=model.scale.y;assert.equal(model.scale.x,model.scale.y,'full bag is proportional');
 r.update(2900,true);v.sync(r.rice);assert.ok(model.scale.y<scale);
 assert.deepEqual(v.position.toArray(),[3,0,4]);
 r.update(5000,true);v.sync(r.rice);assert.equal(model.visible,false);assert.equal(v.object.children[0].visible,true);
 r.reset();v.sync(r.rice);assert.equal(model.visible,true);assert.equal(model.scale.y,scale);
 let freed=false;mesh.geometry.addEventListener('dispose',()=>{freed=true;});v.dispose();assert.ok(freed);
 const late=new THREE.Group();v.useModel(late);assert.equal(late.parent,null);
});
