import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE,WALLS,DOOR_NODES,MAP_WIDTH,MAP_DEPTH,SPAWNS } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { addEntryDoorMat } from '../src/three/EntryFurnitureVisual.ts';
import { CLOSED_EXTERIOR_DOORS } from '../src/three/map/ClosedExteriorDoors.ts';
import { rectColliders, MapEditSession, validateEditedMap } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('entry furniture batches solid detail without changing authored transforms/proxies',()=>{
  const before=JSON.stringify(FURNITURE);
  assert.equal(FURNITURE.filter(r=>r.id.startsWith('entry_life_')).length,3);
  for(const id of ['entry_life_shoe_cabinet','entry_life_changing_bench','entry_life_full_mirror','entry_shoe_rack','entry_bench','entry_coat_stand']) {
    const r=FURNITURE.find(r=>r.id===id);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,r.depth),new THREE.MeshStandardMaterial());
    mesh.position.set(r.x,r.height/2,r.z);mesh.rotation.y=r.rotation;mesh.updateMatrix();
    const proxy=mesh.geometry,matrix=mesh.matrix.clone();dressFurniture(mesh,r);mesh.updateMatrix();
    assert.equal(mesh.geometry,proxy);assert.deepEqual(mesh.matrix.elements,matrix.elements);assert.equal(mesh.children.length,1);
    const g=mesh.children[0].geometry;assert.ok([...g.attributes.position.array].every(Number.isFinite));g.computeBoundingBox();
    const b=g.boundingBox;
    assert.ok(b.min.x>=-r.width/2-1e-5&&b.max.x<=r.width/2+1e-5,id);
    assert.ok(b.min.z>=-r.depth/2-1e-5&&b.max.z<=r.depth/2+1e-5,id);
    proxy.dispose();mesh.material.dispose();g.dispose();mesh.children[0].material.dispose();
  }
  assert.equal(JSON.stringify(FURNITURE),before);
  const root=new THREE.Group();addEntryDoorMat(root);const mat=root.children[0],door=CLOSED_EXTERIOR_DOORS.find(d=>d.id==='entry_front_door');
  assert.equal(mat.position.x,door.x);assert.equal(mat.position.z,door.z-.9);
  assert.equal(mat.geometry.parameters.width,door.width*.95);assert.equal(mat.castShadow,false);
  const hits=[];mat.raycast(new THREE.Raycaster(),hits);assert.deepEqual(hits,[]);
  mat.geometry.dispose();mat.material.dispose();
});

test('entry spawn, all door approaches and the mat remain clear and navigable',()=>{
  const session=new MapEditSession();
  assert.deepEqual(validateEditedMap(session.furnitureList(),session.hideSpotList()),[]);
  const c=rectColliders([...WALLS,...FURNITURE]);
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,c.boxes,c.oriented);
  const clear=p=>world.canOccupyStaticXZ(p.x,p.z,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight);
  const targets=[SPAWNS.deepseek,{x:-1.7,z:12},{x:2.75,z:7.8},{x:10,z:7.8},{x:11.2,z:12},{x:4.5,z:16.1}];
  for(let x=-1.5;x<=11.2;x+=.2)assert.ok(clear({x,z:12}),`cross-entry ${x}`);
  for(let z=11;z<=16.3;z+=.2)assert.ok(clear({x:4.5,z}),`front-door ${z}`);
  const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES),doors=new DoorSystem(DOOR_NODES,3);
  for(const p of targets) {
    assert.ok(clear(p),JSON.stringify(p));
    assert.ok(nav.findPath(SPAWNS.deepseek,p,doors.doors).length>0,JSON.stringify(p));
  }
});
