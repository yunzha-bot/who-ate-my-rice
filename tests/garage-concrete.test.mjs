import assert from 'node:assert/strict';
import test from 'node:test';
import { Group, Box3, Vector3 } from 'three';
import { buildGarageFloor, buildGarageDriveway, garageDrivewayBounds } from '../src/three/map/GarageGround.ts';
import { buildResidentialExterior } from '../src/three/ResidentialExterior.ts';
import { ROOMS, FURNITURE, HIDE_SPOTS, WALLS, MAP_WIDTH, MAP_DEPTH, DOOR_NODES } from '../src/three/map/apartmentMap.ts';
import { MapEditSession, validateEditedMap, rectColliders } from '../src/three/map/MapEditModel.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

test('garage concrete meets the road with a local curb cut and a continuous ramp',()=>{
  const root=buildResidentialExterior(new Group(),ROOMS);
  const driveway=garageDrivewayBounds(ROOMS);
  const apron=root.getObjectByName('garage-driveway');
  assert.ok(apron);
  const bounds=new Box3().setFromObject(apron);
  assert.ok(Math.abs(bounds.min.z-driveway.minZ)<1e-5);
  assert.ok(Math.abs(bounds.max.z-driveway.maxZ)<1e-5);
  const road=new Box3().setFromObject(root.getObjectByName('road-main-west'));
  assert.ok(Math.abs(road.min.z-bounds.max.z)<1e-5);
  const pos=apron.geometry.attributes.position;
  for(let i=0;i<pos.count;i++) if(pos.getY(i)>-.4) {
    const t=(pos.getZ(i)+(driveway.maxZ-driveway.minZ)/2)/(driveway.maxZ-driveway.minZ);
    assert.ok(Math.abs(pos.getY(i)+t*.25)<1e-5);
  }
  for(const mesh of root.children.filter(m=>/^curb-home|^walk-home-front/.test(m.name))) {
    const b=new Box3().setFromObject(mesh);
    assert.ok(b.max.x<=driveway.minX+1e-5 || b.min.x>=driveway.maxX-1e-5,'pavement blocks driveway');
  }
  const floorRoot=new Group(),garage=ROOMS.find(r=>r.id==='garage');
  buildGarageFloor(floorRoot,garage,FURNITURE.find(f=>f.id==='garage_car'));
  const floor=floorRoot.getObjectByName('garage-concrete-floor');
  assert.equal(floor.material.color.getHex(),0xb8b8ae);
  assert.ok(Math.abs(new Box3().setFromObject(floor).max.y)<1e-5);
  const empty=new Group();buildGarageDriveway(empty,ROOMS.filter(r=>r.id!=='garage'));
  assert.equal(empty.children.length,0);
});

test('garage doors, rice, bay sides and preserved cabinet stay reachable with real collision',()=>{
  const session=new MapEditSession();
  assert.deepEqual(validateEditedMap(session.furnitureList(),session.hideSpotList()),[]);
  const colliders=rectColliders([...WALLS,...FURNITURE]);
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,colliders.boxes,colliders.oriented);
  const nav=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES);
  const radius=GAME_CONFIG.collision.playerRadius,height=GAME_CONFIG.three.actorHeight;
  const goals=[{x:21.5,z:7},{x:24,z:5.5},{x:20.8,z:11.75},{x:21.25,z:12},
    {x:24.7,z:12},{x:22.6,z:17.7},HIDE_SPOTS.find(s=>s.id==='hide_garage_cabinet')];
  for(const goal of goals) {
    assert.ok(world.canOccupyStaticXZ(goal.x,goal.z,radius,height));
    const path=nav.findPath({x:24.7,z:15.2},goal,[]);
    assert.ok(path?.length,JSON.stringify(goal));
    let p=new Vector3(24.7,height/2,15.2);
    for(const step of path) {
      const n=Math.max(1,Math.ceil(Math.hypot(step.x-p.x,step.z-p.z)/.05));
      const dx=(step.x-p.x)/n,dz=(step.z-p.z)/n;
      for(let i=0;i<n;i++)p=world.move(p,dx,dz,radius,height);
      assert.ok(Math.hypot(p.x-step.x,p.z-step.z)<.03,'route collides');
    }
  }
  // The exterior shutter is still closed, not a new traversable exit.
  assert.equal(world.canOccupyStaticXZ(22.6,19,radius,height),false);
});
