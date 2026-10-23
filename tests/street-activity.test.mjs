import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildApartment } from '../src/three/map/MapBuilder.ts';
import { ROOMS, FURNITURE } from '../src/three/map/apartmentMap.ts';
import { describeResidentialLayout } from '../src/three/ResidentialExterior.ts';
import { STREET_ACTIVITY } from '../src/three/StreetActivityView.ts';

const make = () => buildApartment(new THREE.Scene(), {debug: false});
const snapshot = view => {
  const values = [];
  view.root.traverse(o => values.push(...o.position.toArray(), ...o.rotation.toArray().slice(0,3)));
  return values;
};

test('ambient actors move on pavement/road only, clear static scenery, and never enter gameplay', () => {
  const map = make(), view = map.streetActivity, layout = describeResidentialLayout(ROOMS);
  try {
    assert.equal(view.root.children.length, 6);
    assert(view.root.userData.visualOnly);
    assert.equal(map.furnitureMeshes.size, FURNITURE.length);
    const exterior = view.root.parent, staticBounds = [];
    exterior.traverse(o => {
      if (!o.isMesh || view.root.getObjectById(o.id) || o.name.includes('ground') || o.name.includes('parcel')) return;
      if (o.isInstancedMesh) {
        o.geometry.computeBoundingBox();
        for(let i=0;i<o.count;i++) {
          const m=new THREE.Matrix4();o.getMatrixAt(i,m);
          staticBounds.push(o.geometry.boundingBox.clone().applyMatrix4(m));
        }
      } else staticBounds.push(new THREE.Box3().setFromObject(o));
    });
    const obstacles = staticBounds.filter(b => b.max.y > .3);
    const box = new THREE.Box3();
    for (let frame=0;frame<2400;frame++) {
      view.update(80);
      if (frame%10) continue;
      for (const actor of view.root.children) {
        box.setFromObject(actor);
        assert(box.min.z > layout.house.maxZ || box.max.x < layout.house.minX, actor.name);
        assert(actor.position.y < 0, `${actor.name} rests on outside paving`);
        if (actor.name.includes('pedestrian')) {
          assert(box.min.y >= actor.position.y - 1e-6, 'feet must not sink below paving');
          assert(!obstacles.some(o=>o.intersectsBox(box)), `walk through static scenery: ${actor.name}`);
        } else {
          assert(box.min.z > layout.front+4 && box.max.z < layout.front+12, 'car stays in its road lane');
        }
      }
    }
    view.root.traverse(o => {
      if (!o.isMesh) return;
      assert.equal(o.userData.objectId, undefined);
      const hits=[];o.raycast(new THREE.Raycaster(),hits);assert.equal(hits.length,0);
    });
  } finally {map.dispose();}
});

test('ambient time is frame-rate independent and stops for pause, switches, reduced motion and disposal', () => {
  const a = make(), b = make();
  try {
    for(let i=0;i<60;i++)a.streetActivity.update(1000/60);
    for(let i=0;i<30;i++)b.streetActivity.update(1000/30);
    snapshot(a.streetActivity).forEach((n,i)=>assert(Math.abs(n-snapshot(b.streetActivity)[i])<1e-9));
    const before=snapshot(a.streetActivity);
    a.streetActivity.update(1000,false);a.streetActivity.update(NaN);a.streetActivity.update(-1);
    STREET_ACTIVITY.enabled=false;a.streetActivity.update(16);STREET_ACTIVITY.enabled=true;
    assert.deepEqual(snapshot(a.streetActivity),before);
    const reduced={matches:true};a.streetActivity.reduced=reduced;a.streetActivity.update(16);
    assert.deepEqual(snapshot(a.streetActivity),before);
    reduced.matches=false;a.streetActivity.update(16);assert.notDeepEqual(snapshot(a.streetActivity),before);
    const old=snapshot(a.streetActivity);a.dispose();a.streetActivity.update(50);
    assert.deepEqual(snapshot(a.streetActivity),old);
  } finally {STREET_ACTIVITY.enabled=true;b.dispose();}
});

test('disabled groups keep valid initial placements, independent toggles freeze only their own actors', () => {
  STREET_ACTIVITY.pedestrians=false;STREET_ACTIVITY.cars=false;
  const map=make(),view=map.streetActivity;
  try {
    assert(view.root.children.every(o=>o.position.z>19));
    const before=view.root.children.map(o=>o.position.clone());
    view.update(50);assert(view.root.children.every((o,i)=>o.position.equals(before[i])));
    STREET_ACTIVITY.cars=true;view.update(50);
    assert(view.root.children.slice(0,4).every((o,i)=>o.position.equals(before[i])));
    assert(view.root.children.slice(4).every((o,i)=>!o.position.equals(before[i+4])));
    STREET_ACTIVITY.pedestrians=true;STREET_ACTIVITY.cars=false;
    const cars=view.root.children.slice(4).map(o=>o.position.clone());view.update(50);
    assert(view.root.children.slice(4).every((o,i)=>o.position.equals(cars[i])));
    for(let i=0;i<500;i++)view.update(50);
    STREET_ACTIVITY.cars=true;view.update(50);
    assert(view.root.children.slice(4).every((o,i)=>o.position.distanceTo(cars[i])<.13),
      're-enabling cars advances one frame, not the disabled wall time');
  } finally {STREET_ACTIVITY.pedestrians=true;STREET_ACTIVITY.cars=true;map.dispose();}
});

test('long gaps are bounded, object counts stay fixed, and rebuilding disposes shared resources once', () => {
  const a=make(),b=make();
  try {
    a.streetActivity.update(60000);b.streetActivity.update(STREET_ACTIVITY.maxDeltaMs);
    assert.deepEqual(snapshot(a.streetActivity),snapshot(b.streetActivity));
    const objects=[];a.streetActivity.root.traverse(o=>objects.push(o));
    for(let i=0;i<10000;i++)a.streetActivity.update(16);
    const after=[];a.streetActivity.root.traverse(o=>after.push(o));assert.deepEqual(after,objects);
    const resources=new Map();
    objects.filter(o=>o.isMesh).forEach(o=>[o.geometry,o.material].forEach(r=>resources.set(r,0)));
    resources.forEach((_,r)=>r.addEventListener('dispose',()=>resources.set(r,resources.get(r)+1)));
    a.dispose();assert([...resources.values()].every(n=>n===1));
  } finally {b.dispose();}
});
