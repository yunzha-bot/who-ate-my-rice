import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE,WALLS,HIDE_SPOTS,DOOR_NODES,MAP_WIDTH,MAP_DEPTH } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('main bedroom visual details preserve transforms/proxies and batch once',()=>{
  const before=JSON.stringify([FURNITURE,HIDE_SPOTS]);
  assert.equal(FURNITURE.filter(r=>r.id.startsWith('main_life_')).length,3);
  for(const id of ['main_dresser','main_wardrobe','main_bed','main_nightstand','main_life_vanity','main_life_vanity_stool','main_life_end_bench']) {
    const r=FURNITURE.find(r=>r.id===id);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,r.depth),new THREE.MeshStandardMaterial());
    mesh.position.set(r.x,r.height/2,r.z);mesh.rotation.y=r.rotation;mesh.updateMatrix();
    const matrix=mesh.matrix.clone(),proxy=mesh.geometry;dressFurniture(mesh,r);mesh.updateMatrix();
    assert.equal(mesh.geometry,proxy);assert.deepEqual(mesh.matrix.elements,matrix.elements);assert.equal(mesh.children.length,1);
    const g=mesh.children[0].geometry;assert.ok([...g.attributes.position.array].every(Number.isFinite));g.computeBoundingBox();
    if(!['main_bed','main_nightstand'].includes(id)) {
      const b=g.boundingBox;
      assert.ok(b.min.x>=-r.width/2-1e-5&&b.max.x<=r.width/2+1e-5,id);
      assert.ok(b.min.z>=-r.depth/2-1e-5&&b.max.z<=r.depth/2+1e-5,id);
    }
    proxy.dispose();mesh.material.dispose();g.dispose();mesh.children[0].material.dispose();
  }
  assert.equal(JSON.stringify([FURNITURE,HIDE_SPOTS]),before);
});

test('main bedroom central route, rice and both hide/door approaches stay clear',()=>{
  const c=rectColliders([...WALLS,...FURNITURE]);
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,c.boxes,c.oriented);
  const clear=p=>world.canOccupyStaticXZ(p.x,p.z,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight);
  for(let z=-11;z<=-1.5;z+=.2)assert.ok(clear({x:-19,z}),`central route ${z}`);
  const targets=[{x:-18.5,z:-11},{x:-15.3,z:-1.5},{x:-15.3,z:-8.5},...HIDE_SPOTS.filter(s=>s.roomId==='main_bedroom')];
  const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES),doors=new DoorSystem(DOOR_NODES,3);
  for(const p of targets) {
    assert.ok(clear(p),JSON.stringify(p));
    assert.ok(nav.findPath({x:-19,z:-6},p,doors.doors).length>0,JSON.stringify(p));
  }
});
