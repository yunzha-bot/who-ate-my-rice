import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildResidentialExterior,describeResidentialLayout} from '../src/three/ResidentialExterior.ts';
import {ROOMS} from '../src/three/map/apartmentMap.ts';

function scene(){
 const exterior=buildResidentialExterior(new THREE.Group(),ROOMS);exterior.updateMatrixWorld(true);
 const root=exterior.getObjectByName('street-life-visual-only');
 const pieces=[];
 root.traverse(mesh=>{
  if(!mesh.isInstancedMesh)return;
  for(let i=0;i<mesh.count;i++){
   const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);matrix.premultiply(mesh.matrixWorld);
   mesh.geometry.computeBoundingBox();
   pieces.push({name:mesh.userData.parts[i],bounds:mesh.geometry.boundingBox.clone().applyMatrix4(matrix),matrix});
  }
 });
 return {exterior,root,pieces,layout:describeResidentialLayout(ROOMS)};
}

test('street dressing stays visual-only, batches repeated parts and never enters the playable house',()=>{
 const {root,pieces,layout}=scene();assert(root.userData.visualOnly);assert(pieces.length>100);
 const batches=root.children.filter(n=>n.isInstancedMesh);assert(batches.length<=36);
 assert(root.children.every(n=>!n.isLight));
 for(const {name,bounds:b,matrix} of pieces){
  assert(matrix.elements.every(Number.isFinite),name);
  const h=layout.house;
  assert(Math.min(b.max.x,h.maxX)-Math.max(b.min.x,h.minX)<=0 ||
   Math.min(b.max.z,h.maxZ)-Math.max(b.min.z,h.minZ)<=0,`piece in house: ${name}`);
 }
});

test('shop entrance remains clear and parked cars stay within the dedicated parking parcel',()=>{
 const {exterior,pieces,layout}=scene(),shop=layout.groups.find(g=>g.id==='corner-shop');
 const x=(shop.body.minX+shop.body.maxX)/2,z=shop.body.minZ;
 const entrance=new THREE.Box3(new THREE.Vector3(x-.8,-.4,z-1.5),new THREE.Vector3(x+.8,1.7,z-.08));
 const parking=new THREE.Box3().setFromObject(exterior.getObjectByName('parking-parcel'));
 for(const {name,bounds:b}of pieces){
  if(name.startsWith('shop-')||name.startsWith('delivery-'))assert(!entrance.intersectsBox(b),name);
  if(name.startsWith('street-parked-')){
   assert(b.min.x>=parking.min.x&&b.max.x<=parking.max.x&&b.min.z>=parking.min.z&&b.max.z<=parking.max.z,name);
  }
 }
});

test('plant pots rest on actual paving/foundations and do not disappear into the garden hedges',()=>{
 const {exterior,pieces}=scene();
 const supports=exterior.children.filter(m=>/^(district-ground|.*parcel|road-|walk-)|-plinth$/.test(m.name))
  .map(n=>new THREE.Box3().setFromObject(n));
 const hedges=exterior.children.filter(m=>m.name.includes('hedge')).map(n=>new THREE.Box3().setFromObject(n));
 for(const {name,bounds:b}of pieces.filter(p=>p.name.endsWith('-pot'))){
  const c=b.getCenter(new THREE.Vector3());
  const support=Math.max(...supports.filter(s=>c.x>=s.min.x&&c.x<=s.max.x&&c.z>=s.min.z&&c.z<=s.max.z).map(s=>s.max.y));
  assert(Math.abs(b.min.y-support)<1e-5,name);
  assert(!hedges.some(h=>h.intersectsBox(b)),`pot inside hedge: ${name}`);
 }
});

test('rear waiting spot stays on the existing sidewalk and its road markings never occupy the curb',()=>{
 const {exterior,pieces}=scene();
 const walk=new THREE.Box3().setFromObject(exterior.getObjectByName('walk-north'));
 const road=new THREE.Box3().setFromObject(exterior.getObjectByName('road-service'));
 const stop=pieces.filter(p=>p.name.startsWith('north-stop-'));
 assert(stop.length>20,'shelter, bench, planters and signs must exist');
 for(const {name,bounds:b}of stop){
  assert(b.min.x>=walk.min.x&&b.max.x<=walk.max.x&&b.min.z>=walk.min.z&&b.max.z<=walk.max.z,name);
  assert(b.min.y>=walk.max.y-1e-6,`no buried street fixtures: ${name}`);
  if(name.startsWith('north-stop-planter-')&&!name.includes('soil')&&!name.includes('leaves'))
   assert(Math.abs(b.min.y-walk.max.y)<1e-6,name);
 }
 for(const {name,bounds:b}of pieces.filter(p=>p.name.startsWith('north-service-'))){
  assert(b.min.x>road.min.x&&b.max.x<road.max.x&&b.min.z>road.min.z&&b.max.z<road.max.z,name);
  assert(b.min.y>road.max.y&&b.max.y-road.max.y<.02,`road paint must sit just above the road: ${name}`);
 }
});
