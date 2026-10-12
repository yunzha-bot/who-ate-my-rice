import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { FURNITURE, WALLS, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, RICE_CANDIDATES } from '../src/three/map/apartmentMap.ts';
import { MapEditSession, validateEditedMap, rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('bathroom solid details batch and glass follows the existing editable proxy',()=>{
 const saved=JSON.stringify(FURNITURE);
 for(const r of FURNITURE.filter(r=>r.id.startsWith('bath_'))){
  const m=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,r.depth),new THREE.MeshStandardMaterial());
  m.position.set(r.x,r.height/2,r.z);m.rotation.y=r.rotation;m.updateMatrix();
  const geometry=m.geometry,matrix=m.matrix.clone();dressFurniture(m,r);m.updateMatrix();
  assert.equal(m.geometry,geometry);assert.deepEqual(m.matrix.elements,matrix.elements);
  assert.equal(m.material.opacity,0);assert.equal(m.children.length,r.id==='bath_tub'?2:1);
  for(const c of m.children)assert.ok([...c.geometry.attributes.position.array].every(Number.isFinite));
  if(r.id==='bath_tub'){
   const glass=m.getObjectByName('bath-screen');assert.ok(glass.material.transparent);assert.equal(glass.material.depthWrite,false);
   assert.ok(glass.material.opacity>0&&glass.material.opacity<.3);assert.equal(glass.castShadow,false);
   const hits=[];glass.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);
   const local=glass.position.clone();m.position.x+=.1;m.rotation.y=.25;m.updateMatrixWorld(true);
   assert.deepEqual(glass.position.toArray(),local.toArray());assert.equal(glass.parent,m);
  }
  m.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
 assert.equal(JSON.stringify(FURNITURE),saved);
});

test('bathroom D12/D13 approaches, central aisle and rice_11 retain collision/navigation access',()=>{
 const s=new MapEditSession();assert.deepEqual(validateEditedMap(s.furnitureList(),s.hideSpotList()),[]);
 const c=rectColliders([...WALLS,...FURNITURE]),world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,c.boxes,c.oriented);
 const clear=p=>world.canOccupyStaticXZ(p.x,p.z,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight);
 const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES),doors=new DoorSystem(DOOR_NODES,3);
 const from={x:-20,z:4};
 const targets=[RICE_CANDIDATES.find(r=>r.id==='rice_11'),...DOOR_NODES.filter(d=>['door_hall_bathroom','door_bathroom_bedroom2'].includes(d.id)).map(d=>({x:d.x+(d.rotation?-.8:0),z:d.z+(d.rotation?0:-.8)}))];
 for(let x=-26;x<=-16;x+=.2)assert.ok(clear({x,z:4}),`central aisle ${x}`);
 for(const p of targets){assert.ok(clear(p),JSON.stringify(p));assert.ok(nav.findPath(from,p,doors.doors).length>0,JSON.stringify(p));}
});
