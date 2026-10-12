import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DeepSeekHairMotion } from '../src/three/DeepSeekHairMotion.ts';

function rig() {
  const actor = new THREE.Group(), model = new THREE.Group(), head = new THREE.Bone();
  actor.add(model); model.add(head); head.name = 'Head';
  for (const [upper, lower] of [['HairUpper.L','HairLower.L'],['HairUpper.R','HairLower.R'],['HairBack','HairBackTip']]) {
    const root = new THREE.Bone(), tip = new THREE.Bone();
    root.name = THREE.PropertyBinding.sanitizeNodeName(upper); tip.name = THREE.PropertyBinding.sanitizeNodeName(lower); head.add(root); root.add(tip); tip.position.y = -.2;
  }
  const hair = new DeepSeekHairMotion(model, actor);
  const step = (dt = 1/60, speed = 0) => {
    hair.restore(); actor.position.z += speed * dt; hair.update(dt);
  };
  return {actor,model,head,hair,step,tip:model.getObjectByName('HairLowerL')};
}
test('hair keeps the head/body fixed, moves tips, and retains inertia after stopping', () => {
  const r = rig(); r.step();
  for (let i=0;i<120;i++) r.step(1/60,5);
  const moving = r.tip.quaternion.clone(), body = r.head.quaternion.clone();
  r.step();
  assert.ok(r.tip.quaternion.angleTo(moving)<.1);
  assert.ok(r.tip.quaternion.angleTo(new THREE.Quaternion())>.04);
  for (let i=0;i<180;i++) r.step();
  assert.ok(r.tip.quaternion.angleTo(new THREE.Quaternion())<.06);
  assert.deepEqual(r.head.quaternion.toArray(),body.toArray());
});
test('turns and long frame gaps remain finite and bounded; reset clears offsets', () => {
  const r=rig(); r.step();
  for(let i=0;i<200;i++) {
    r.hair.restore(); r.model.rotation.y = Math.sin(i)*2; r.hair.update(i%5===0?.2:1/60);
    for(const bone of r.model.children[0].children) assert.ok(bone.quaternion.toArray().every(Number.isFinite));
    assert.ok(r.tip.quaternion.angleTo(new THREE.Quaternion())<.5);
  }
  r.hair.reset();
  assert.ok(r.tip.quaternion.angleTo(new THREE.Quaternion())<1e-6);
});
test('restoring the mixer base prevents cumulative rotation and old assets stay untouched', () => {
  const r=rig(); const authored=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.12);
  for(let i=0;i<600;i++){r.hair.restore();r.tip.quaternion.copy(authored);r.hair.update(1/60);}
  r.hair.restore(); assert.ok(r.tip.quaternion.angleTo(authored)<1e-6);
  const model=new THREE.Group(), bone=new THREE.Bone();bone.name='HairBack';model.add(bone);
  const fallback=new DeepSeekHairMotion(model,new THREE.Group());fallback.update(1);
  assert.deepEqual(bone.quaternion.toArray(),[0,0,0,1]);
});
