import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { OrthographicCamera, Vector3 } from 'three';
import { MENU_MOTION, menuPointer, menuFollow, applyMenuCamera, menuLeafPose } from '../src/three/MenuAtmosphereView.ts';

test('menu pointer is centered, screen-aligned and radially bounded, including outside coordinates',()=>{
  assert.deepEqual(menuPointer(960,540,1920,1080),{x:0,y:0});
  for(const [x,y] of [[0,0],[1920,0],[0,1080],[1920,1080],[-20,2000]]) {
    const p=menuPointer(x,y,1920,1080); assert(Math.hypot(p.x,p.y)<=1+1e-12);
    assert.equal(Math.sign(p.x),Math.sign(x-960)); assert.equal(Math.sign(p.y),Math.sign(y-540));
  }
  assert(Number.isFinite(menuPointer(0,0,0,0).x));
});

test('one second of smoothing is equivalent at 30, 60 and 120 fps; monotone with no overshoot',()=>{
  const outcomes=[];
  for(const fps of [30,60,120]) {
    let x=0; for(let i=0;i<fps;i++) {const next=menuFollow(x,1,1000/fps);assert(next>=x&&next<=1);x=next;}
    outcomes.push(x);
  }
  assert(Math.max(...outcomes)-Math.min(...outcomes)<1e-12);
  assert(Math.abs(menuFollow(0,1,1000/60)-.06)<1e-12);
  assert.equal(menuFollow(.5,1,-1),.5);
});

test('camera projects in the pointer direction by at most twelve pixels without changing orientation or frustum',()=>{
  const camera=new OrthographicCamera(-32,32,18,-18,.1,300);
  camera.position.set(12,14,12); camera.lookAt(0,0,0); camera.updateMatrixWorld();
  const base=camera.position.clone(), q=camera.quaternion.clone(), projection=camera.projectionMatrix.clone();
  const screen=()=>{camera.updateMatrixWorld(); const p=new Vector3().project(camera);return {x:p.x*960,y:-p.y*540};};
  const before=screen(), pointer=menuPointer(1920,0,1920,1080);
  applyMenuCamera(camera,base,pointer.x,pointer.y,1920,1080);
  const after=screen();
  assert(Math.abs(after.x-before.x-pointer.x*12)<1e-9);
  assert(Math.abs(after.y-before.y-pointer.y*12)<1e-9);
  assert(camera.quaternion.equals(q)); assert(camera.projectionMatrix.equals(projection));
});

test('repeated camera application cannot accumulate drift, and zero exactly restores the baseline',()=>{
  const camera=new OrthographicCamera(-20,20,12,-12);camera.position.set(12,14,12);camera.lookAt(0,0,0);
  const base=camera.position.clone();applyMenuCamera(camera,base,.6,-.8,1920,1080);
  const first=camera.position.clone();for(let i=0;i<10000;i++)applyMenuCamera(camera,base,.6,-.8,1920,1080);
  assert(camera.position.equals(first));applyMenuCamera(camera,base,0,0,1920,1080);assert(camera.position.equals(base));
});

test('leaving the window settles exactly at the center without bouncing',()=>{
  let x=1;for(let i=0;i<240;i++){const next=menuFollow(x,0,1000/60);assert(next>=0&&next<=x);x=next;}
  assert.equal(x,0);
});

test('leaf groups start at rest, stay small, differ in phase, and move freely without pointer input',()=>{
  for(const side of [0,1]) {const pose=menuLeafPose(0,side);assert.equal(pose.angle,0);assert.equal(Math.abs(pose.x),0);}
  for(let t=0;t<60;t+=.1) for(const side of [0,1]) {
    const p=menuLeafPose(t,side);assert(Math.abs(p.angle)<=MENU_MOTION.foliage.angleDeg);
    assert(Math.abs(p.x)<=MENU_MOTION.foliage.driftPx);assert(Math.abs(p.y)<=MENU_MOTION.foliage.driftPx);
  }
  assert.notDeepEqual(menuLeafPose(2,0),menuLeafPose(2,1));assert.notEqual(menuLeafPose(2,0).angle,0);
});

test('opening effects reuse the game loop and fixed rice pool; original lifecycle and gate remain authoritative',()=>{
  const source=readFileSync(new URL('../src/three/MenuAtmosphereView.ts',import.meta.url),'utf8');
  const game=readFileSync(new URL('../src/three/ThreeGame.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/requestAnimationFrame\(/);
  assert.match(source,/Object\.assign\(rice, this\.newRice\(\)\)/);
  assert.match(source,/prefers-reduced-motion: reduce/);assert.match(source,/!document.hidden/);
  assert.match(source,/removeEventListener\('pointermove', this.onPointer\)/);
  assert.match(source,/removeEventListener\('visibilitychange', this.onAvailability\)/);
  const choose=game.slice(game.indexOf('private chooseFaction'),game.indexOf('useSimplifiedStartupVisual'));
  assert(choose.indexOf('if (!this.startupReadiness.canStart) return')<choose.indexOf('menuAtmosphere.setMenuVisible(false)'));
  assert(choose.indexOf('menuAtmosphere.setMenuVisible(false)')<choose.indexOf('this.followCamera()'));
  assert.match(game,/this\.menuAtmosphere\.update\(frameMs\)/);assert.match(game,/this\.menuAtmosphere\.dispose\(\)/);
  assert.equal(MENU_MOTION.rice.count,14);assert(MENU_MOTION.rice.count<=15);
});
