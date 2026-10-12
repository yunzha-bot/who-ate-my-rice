import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE,WALLS,DOOR_NODES,MAP_WIDTH,MAP_DEPTH,OPEN_ROOM_CONNECTIONS,ROOMS } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { rectColliders,MapEditSession,validateEditedMap } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('only the south/east shared wall and D24 are opened; stable regions and nearby doors remain',()=>{
 assert.equal(DOOR_NODES.length,30);assert.ok(!DOOR_NODES.some(d=>d.id==='door_south_hall_east_hall'));
 assert.deepEqual(OPEN_ROOM_CONNECTIONS,[{connectedRoomA:'south_hall',connectedRoomB:'east_hall'}]);
 assert.equal(ROOMS.length,18);
 assert.ok(!WALLS.some(w=>Math.abs(w.x-16)<.01&&w.depth>w.width&&w.z+w.depth/2>7.001&&w.z-w.depth/2<19));
 assert.ok(WALLS.some(w=>w.x===16&&w.depth>w.width&&w.z<7),'dining boundary retained');
 for(const [n,id,x,z] of [[23,'door_entry_south_hall',12,12],[25,'door_dining_south_hall',14,7],[26,'door_dining_east_hall',16,3.75],[31,'door_garage_east_hall',20,11.75]]){
  const d=DOOR_NODES.find(d=>d.id===id);assert.deepEqual([d.debugNumber,d.x,d.z],[n,x,z]);
 }
});

test('home equipment batches real solids while retaining proxies and editable transforms',()=>{
 const gym=FURNITURE.filter(f=>f.id.startsWith('gym_'));assert.equal(gym.length,7);
 for(const r of gym){
  const m=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,r.depth),new THREE.MeshStandardMaterial());
  m.position.set(r.x,r.height/2,r.z);m.rotation.y=r.rotation;m.updateMatrix();const g=m.geometry,matrix=m.matrix.clone();
  dressFurniture(m,r);m.updateMatrix();assert.equal(m.geometry,g);assert.deepEqual(m.matrix.elements,matrix.elements);
  assert.equal(m.children.length,1);assert.equal(m.material.opacity,0);
  const detail=m.children[0];assert.ok([...detail.geometry.attributes.position.array].every(Number.isFinite));
  assert.ok(detail.geometry.attributes.position.count>60);
  m.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
});

test('open seam, retained doors and equipment bypasses work through real navigation and collision',()=>{
 const s=new MapEditSession();assert.deepEqual(validateEditedMap(s.furnitureList(),s.hideSpotList()),[]);
 const c=rectColliders([...WALLS,...FURNITURE]),world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,c.boxes,c.oriented);
 const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES),doors=new DoorSystem(DOOR_NODES,3);
 for(let z=7.5;z<18.6;z+=.2)assert.ok(world.canOccupyStaticXZ(16,z,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight),`seam ${z}`);
 const routes=[[[14.8,9.8],[18,9.8]],[[14.8,14.4],[18,14.4]],[[13.05,8.1],[13.05,11.4]],[[13.05,13],[13.05,15.6]],[[18.65,14],[18.65,17.4]],[[14,12],[18,12]],[[18,2],[18,17]]];
 for(const [a,b] of routes){
  const from={x:a[0],z:a[1]},to={x:b[0],z:b[1]},p=nav.findPath(from,to,doors.doors);assert.ok(p?.length,JSON.stringify([a,b]));
  assert.ok(p.every(step=>!step.doorId),'no phantom D24 required');
  let actor=new THREE.Vector3(from.x,GAME_CONFIG.three.actorHeight/2,from.z);
  for(const target of [...p,to]){
   let count=0;while(Math.hypot(target.x-actor.x,target.z-actor.z)>.025&&count++<1000){
    const dx=target.x-actor.x,dz=target.z-actor.z,len=Math.hypot(dx,dz),step=Math.min(.025,len);
    actor=world.move(actor,dx/len*step,dz/len*step,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight);
   }
   assert.ok(count<1000,`collision movement ${JSON.stringify({a,b,target,actor:actor.toArray()})}`);
  }
  assert.ok(Math.hypot(actor.x-to.x,actor.z-to.z)<.05);
 }
});
