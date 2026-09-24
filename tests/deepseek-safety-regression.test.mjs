import test from 'node:test';
import assert from 'node:assert/strict';
import { DeepSeekAIController } from '../src/systems/DeepSeekAIController.ts';
import { NavigationSystem, distanceToXZSegment } from '../src/systems/NavigationSystem.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { Box3, Vector3 } from 'three';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { DOOR_NODES, WALLS, FURNITURE, MAP_WIDTH, MAP_DEPTH, ROOMS } from '../src/three/map/apartmentMap.ts';
const step = p => ({ ...p, doorId: null });
const human = { x: 2, z: 0 };
const rice = { id: 'last', x: 4, z: 0, progressMs: 0, maxProgressMs: 5000, completed: false };
const nav = { nearestFree: p => p, findPath: (a,b,d,v,c,k,avoid) => avoid
  ? [step(a), step({x:0,z:2}), step({x:b.x,z:2}), step(b)] : [step(a),step(b)] };
const input = extra => ({ deltaMs:50, deepseek:{x:0,z:0}, visibleHuman:human,
  humanStillMs:15000, humanStillEventId:2, rice:[rice], doors:[],
  canOpenDoor:()=>true, sprintState:'NORMAL', captureProgressMs:0, ...extra });

test('reacquired newer event already still for 15s is not movement in this frame', () => {
  const ai = new DeepSeekAIController(nav, [], [], ()=>0);
  ai.update(input({humanStillEventId:1, humanStillMs:0}));
  ai.update(input({visibleHuman:null, humanStillMs:undefined, humanStillEventId:undefined}));
  ai.update(input());
  assert.equal(ai.passageActive,true);
  assert.equal(ai.state,'CURIOUS_APPROACH');
  assert.notEqual(ai.passageCancelReason,'HUMAN_MOVED');
});

test('SAFE_WAIT timer cannot report an active passage without an actual permit', () => {
  const ai = new DeepSeekAIController(nav, [], [], ()=>0);
  ai.safeWaitRiceId=rice.id;
  ai.state='SAFE_WAIT';
  ai.safeWaitRemainingMs=2000;
  ai.update(input({visibleHuman:null}));
  assert.equal(ai.passageActive,false);
  assert.notEqual(ai.passageGateReason,'ACTIVE_SAFE_PASSAGE');
});

test('unsafe rice center has a reachable safe eating position and completes observation/passage/eating', () => {
  const navigation = new NavigationSystem({canOccupyStaticXZ:()=>true}, 10, 10, []);
  const ai = new DeepSeekAIController(navigation, [], [], ()=>0.99);
  const target = {...rice,x:0.3,z:0};
  const seen = {x:0,z:0};
  let position={x:-3,z:0};
  const states=[];
  for(let t=0;t<20000;t+=50) {
    const command=ai.update(input({deepseek:position,visibleHuman:seen,rice:[target]}));
    if(states.at(-1)!==ai.state)states.push(ai.state);
    if(command.eatRiceId)break;
    position={x:position.x+command.direction.x*C.player.speed/C.three.pixelsPerUnit*0.05,
      z:position.z+command.direction.z*C.player.speed/C.three.pixelsPerUnit*0.05};
    assert.ok(Math.hypot(position.x,position.z)>C.match.captureRadius,JSON.stringify({states,position}));
  }
  assert.deepEqual(states,['CURIOUS_APPROACH','CURIOUS_OBSERVE','CURIOUS_PASSAGE','EAT']);
  assert.ok(Math.hypot(position.x-target.x,position.z-target.z)<=1);
  assert.ok(Math.hypot(ai.safetyDebug.eat.x,ai.safetyDebug.eat.z)>=ai.passageAvoidRadius);
  for(let i=1;i<ai.safetyDebug.safePath.length;i++)
    assert.ok(distanceToXZSegment(seen,ai.safetyDebug.safePath[i-1],ai.safetyDebug.safePath[i])>=ai.passageAvoidRadius);
  console.log('safe-eat trace',states,'actual eat',position,'planned',ai.safetyDebug.eat);
});

test('default unsafe route uses safe grid detour; blocked corridor waits until a real route exists', () => {
  const seen={x:0,z:0}, target={...rice,x:3,z:0};
  let blocked=true,draws=0;
  const openNav=new NavigationSystem({canOccupyStaticXZ:()=>true},10,10,[]);
  const narrowNav=new NavigationSystem({canOccupyStaticXZ:(_x,z)=>Math.abs(z)<0.5},10,10,[]);
  const router={nearestFree:(...args)=>openNav.nearestFree(...args),
    findPath:(...args)=>(blocked?narrowNav:openNav).findPath(...args)};
  const ai=new DeepSeekAIController(router,[],[],()=>{draws++;return 0.99;});
  ai.state='SAFE_WAIT';ai.safeWaitRiceId=target.id;ai.safeWaitRemainingMs=0;
  const frame=()=>input({deepseek:{x:-3,z:0},visibleHuman:seen,rice:[target],deltaMs:2500});
  for(let i=0;i<12;i++) {
    const command=ai.update(frame());
    assert.equal(ai.state,'SAFE_WAIT');
    assert.deepEqual(command.direction,{x:0,z:0});
    assert.equal(ai.passageActive,false);
  }
  assert.equal(draws,1);
  blocked=false;
  ai.update(frame());
  assert.equal(ai.passageActive,true);
  assert.equal(draws,1);
  assert.ok(ai.safetyDebug.defaultPath.some((p,i,a)=>i>0&&distanceToXZSegment(seen,a[i-1],p)<ai.passageAvoidRadius));
  assert.ok(ai.safetyDebug.safePath.every((p,i,a)=>i===0||distanceToXZSegment(seen,a[i-1],p)>=ai.passageAvoidRadius));
});

test('real kitchen rice_06: center unsafe but actual collision-valid eating position is safe', () => {
  const boxes=[...WALLS,...FURNITURE].map(r=>new Box3(
    new Vector3(r.x-r.width/2,0,r.z-r.depth/2),
    new Vector3(r.x+r.width/2,r.height,r.z+r.depth/2)));
  const world=new CollisionWorld(MAP_WIDTH/2,MAP_DEPTH/2,boxes);
  const navigation=new NavigationSystem(world,MAP_WIDTH,MAP_DEPTH,DOOR_NODES);
  const doors=new DoorSystem(DOOR_NODES,3);
  const ai=new DeepSeekAIController(navigation,DOOR_NODES,ROOMS,()=>0.99);
  const seen={x:10.3,z:-10.4},target={...rice,id:'rice_06',x:10.5,z:-10.4};
  let position=new Vector3(10,C.three.actorHeight/2,-8.5);
  const states=[];
  for(let t=0;t<20000;t+=50) {
    const command=ai.update(input({deepseek:position,visibleHuman:seen,rice:[target],doors:doors.doors}));
    if(states.at(-1)!==ai.state)states.push(ai.state);
    if(command.eatRiceId)break;
    position = world.move(position,command.direction.x*C.player.speed/C.three.pixelsPerUnit*0.05,
      command.direction.z*C.player.speed/C.three.pixelsPerUnit*0.05,
      C.collision.playerRadius,C.three.actorHeight);
    assert.ok(Math.hypot(position.x-seen.x,position.z-seen.z)>=ai.passageAvoidRadius-1e-6);
  }
  assert.deepEqual(states,['CURIOUS_APPROACH','CURIOUS_OBSERVE','CURIOUS_PASSAGE','EAT']);
  console.log('real kitchen trajectory',states,'eat',position.x,position.z);
});

test('SAFE_WAIT approaches only a verified observation prefix, then requires fresh sight for permission', () => {
  const navigation=new NavigationSystem({canOccupyStaticXZ:()=>true},10,10,[]);
  const ai=new DeepSeekAIController(navigation,[],[],()=>0.99);
  const seen={x:0,z:0},target={...rice,x:3,z:0};
  ai.state='SAFE_WAIT';ai.safeWaitRiceId=target.id;ai.safeWaitRemainingMs=0;
  ai.threatEstimate=seen;
  const command=ai.update(input({deepseek:{x:-3,z:0},visibleHuman:null,
    humanStillMs:undefined,humanStillEventId:undefined,rice:[target],
    geometry:{visible:p=>p.x>-1.5}}));
  assert.equal(ai.state,'SAFE_WAIT');
  assert.equal(ai.passageActive,false);
  assert.equal(ai.safeWaitReason,'SAFE_OBSERVATION_RECHECK');
  assert.notDeepEqual(command.direction,{x:0,z:0});
  const point={...ai.safetyDebug.observation};
  ai.update(input({deepseek:point,visibleHuman:seen,rice:[target]}));
  assert.equal(ai.passageActive,true);
  assert.equal(ai.state,'CURIOUS_APPROACH');
});
