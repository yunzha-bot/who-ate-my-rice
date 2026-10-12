import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FURNITURE, WALLS, DOOR_NODES, MAP_WIDTH, MAP_DEPTH, HIDE_SPOTS } from '../src/three/map/apartmentMap.ts';
import { dressFurniture } from '../src/three/AlphaPresentation.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('north balcony cabinet and three additions retain proxies and one batched visual each', () => {
  const additions=FURNITURE.filter(r=>r.id.startsWith('north_balcony_life_'));
  assert.equal(additions.length,3);
  const cabinet=FURNITURE.find(r=>r.id==='north_balcony_rack');
  assert.deepEqual([cabinet.x,cabinet.z,cabinet.width,cabinet.depth,cabinet.height,cabinet.rotation],[15.5,-18.3,1.6,.5,1.1,0]);
  for (const r of [cabinet,...additions]) {
    const root=new THREE.Mesh(new THREE.BoxGeometry(r.width,r.height,r.depth),new THREE.MeshStandardMaterial());
    const proxy=root.geometry;dressFurniture(root,r);
    assert.equal(root.geometry,proxy);assert.equal(root.material.opacity,0);assert.equal(root.children.length,1);
    const visual=root.children[0];visual.geometry.computeBoundingBox();const b=visual.geometry.boundingBox;
    assert.ok(b.min.x>=-r.width/2-1e-5&&b.max.x<=r.width/2+1e-5,r.id);
    assert.ok(b.min.z>=-r.depth/2-1e-5&&b.max.z<=r.depth/2+1e-5,r.id);
    assert.ok([...visual.geometry.attributes.position.array].every(Number.isFinite));
    proxy.dispose();root.material.dispose();visual.geometry.dispose();visual.material.dispose();
  }
});

test('north balcony aisle, carton anchor and all four door approaches remain navigable', () => {
  const c=rectColliders([...WALLS,...FURNITURE]);
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,c.boxes,c.oriented);
  const clear=p=>world.canOccupyStaticXZ(p.x,p.z,GAME_CONFIG.collision.playerRadius,GAME_CONFIG.three.actorHeight);
  for(let x=8.8;x<=19.2;x+=.1) assert.ok(clear({x,z:-17.25}),`aisle ${x}`);
  const spot=HIDE_SPOTS.find(s=>s.id==='hide_north_balcony_carton');
  const targets=[spot,{x:8.8,z:-17.25},{x:12,z:-16.3},{x:18,z:-16.3},{x:19.2,z:-17.25}];
  const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES);
  const doors=new DoorSystem(DOOR_NODES,3);
  for(const p of targets) {
    assert.ok(clear(p),JSON.stringify(p));
    assert.ok(nav.findPath({x:14,z:-17.25},p,doors.doors).length>0,JSON.stringify(p));
  }
});
