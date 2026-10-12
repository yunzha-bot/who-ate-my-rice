import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { HomeAvatar } from '../src/three/AlphaPresentation.ts';
import { DeepSeekAnimation, DEEPSEEK_CLIPS } from '../src/three/DeepSeekAnimation.ts';

function setup() {
  const model = new THREE.Group(), bone = new THREE.Bone(); bone.name = 'Hips'; model.add(bone);
  model.animations = DEEPSEEK_CLIPS.map(name => new THREE.AnimationClip(name, .5,
    [new THREE.NumberKeyframeTrack('Hips.position[y]', [0, .25, .5], [0, .01, 0])]));
  return { model, controller: new DeepSeekAnimation(model) };
}
const outside = { concealed: false, eating: false };
function frames(controller, action, state, count = 40) {
  for (let i = 0; i < count; i++) controller.update(action, .025, state);
}

test('DeepSeek locomotion loops and crossfades without moving the visual root', () => {
  const {model, controller:c} = setup();model.position.set(3,4,5);
  frames(c, 'WALK', outside);assert.equal(c.currentClip, 'Walk');
  c.update('RUN', .025, outside);assert.equal(c.currentClip, 'Run');
  frames(c, 'RUN', outside);assert.equal(c.currentClip, 'Run');
  frames(c, 'IDLE', outside);assert.equal(c.currentClip, 'Idle');
  assert.deepEqual(model.position.toArray(), [3,4,5]); c.dispose();
});
test('Eat needs actual eating, fires once per session, and can fire next session', () => {
  const {controller:c} = setup();
  c.update('EAT', .025, outside);assert.equal(c.currentClip,'Idle');
  c.update('EAT', .025, {...outside,eating:true});assert.equal(c.currentClip,'Eat');
  frames(c,'EAT',{...outside,eating:true});assert.equal(c.currentClip,'Idle');
  frames(c,'EAT',{...outside,eating:true});assert.equal(c.currentClip,'Idle');
  c.update('IDLE',.025,outside);c.update('EAT',.025,{...outside,eating:true});
  assert.equal(c.currentClip,'Eat');c.dispose();
});
test('HideEnter → HideIdle → HideExit → locomotion and interrupted reentry', () => {
  const {controller:c} = setup(), inside={concealed:true,eating:false};
  c.update('IDLE',.025,inside);assert.equal(c.currentClip,'HideEnter');
  frames(c,'IDLE',inside);assert.equal(c.currentClip,'HideIdle');
  c.update('WALK',.025,outside);assert.equal(c.currentClip,'HideExit');
  c.update('IDLE',.025,inside);assert.equal(c.currentClip,'HideEnter');
  frames(c,'IDLE',inside);c.update('WALK',.025,outside);frames(c,'WALK',outside);
  assert.equal(c.currentClip,'Walk');c.reset();assert.equal(c.currentClip,'Idle');c.dispose();
});
test('Independent character instances do not share bone poses or mixer state', () => {
  const a=setup(),b=setup();a.controller.update('WALK',.1,outside);
  assert.notEqual(a.model.children[0].position.y,b.model.children[0].position.y);
  assert.equal(b.controller.currentClip,'Idle');a.controller.dispose();b.controller.dispose();
});
test('Formal v6 GLB is self-contained with required animation and procedural fallback', () => {
  const glbUrl = new URL('../public/assets/characters/deepseek/deepseek_animated_v6_hair.glb', import.meta.url);
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.5, 1, .5), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  assert.equal(avatar.root.visible, true);
  assert.ok(avatar.root.getObjectByName('maid-skirt'));
  const characterView = fs.readFileSync(new URL('../src/three/CharacterActionView.ts', import.meta.url), 'utf8');
  assert.match(characterView, /this\.avatar\.clearExternalVisual\(\)/);
  assert.match(characterView, /if that is also absent, keep the procedural avatar/);
  assert.doesNotMatch(characterView, /if \(!staticOnly\) await this\.loadVisual\(true\)/);
  avatar.dispose();
  const b=fs.readFileSync(glbUrl);
  const end=20+b.readUInt32LE(12),j=JSON.parse(b.subarray(20,end).toString());
  assert.equal(j.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+j.accessors[p.indices].count/3,0),18500);
  assert.equal(j.skins[0].joints.length,26);assert.deepEqual(j.animations.map(a=>a.name).sort(),[...DEEPSEEK_CLIPS].sort());
  assert.equal(j.images.length,3);
  for (const resource of [...j.buffers, ...j.images]) assert.equal(resource.uri, undefined);
  assert.equal(j.nodes.find(node=>node.name==='DeepSeek_Armature').extras.deepseekHairVersion,2);
  const binaryStart=end+8;
  for(const a of j.animations)for(const c of a.channels){
    if(j.nodes[c.target.node].name!=='Root')continue;
    const acc=j.accessors[a.samplers[c.sampler].output],view=j.bufferViews[acc.bufferView];
    const width=acc.type==='VEC4'?4:3,offset=binaryStart+(view.byteOffset||0)+(acc.byteOffset||0);
    for(let n=1;n<acc.count;n++)for(let k=0;k<width;k++)assert.ok(Math.abs(b.readFloatLE(offset+(n*width+k)*4)-b.readFloatLE(offset+k*4))<1e-6);
  }
});
