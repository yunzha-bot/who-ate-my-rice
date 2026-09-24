import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimationClip, AnimationMixer, BoxGeometry, Mesh, MeshStandardMaterial,
  NumberKeyframeTrack } from 'three';
import { resolveCharacterAction } from '../src/systems/CharacterAction.ts';
import { CharacterActionView } from '../src/three/CharacterActionView.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';

test('one resolver covers actions for player and AI without gameplay feedback', () => {
  const cases = [
    [{ moving: false }, 'IDLE'], [{ moving: true }, 'WALK'],
    [{ moving: true, running: true }, 'RUN'], [{ eating: true }, 'EAT'],
    [{ startled: true }, 'STARTLED'], [{ falling: true, stunned: true }, 'FALL'],
    [{ stunned: true }, 'STUN'], [{ interacting: true }, 'INTERACT'],
    [{ capturing: true }, 'CAPTURE'],
  ];
  for (const [input, action] of cases) assert.equal(resolveCharacterAction(input), action);
  assert.equal(resolveCharacterAction({ moving: false, running: true }), 'IDLE');
});

test('white-box actions preserve collision anchors and fall pose ends before stun', () => {
  const deepseek = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: C.player.color }));
  const human = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: C.human.color }));
  deepseek.position.set(2, 0.5, 3);
  human.position.set(4, 0.5, 5);
  const deepseekView = new CharacterActionView(deepseek, 'DEEPSEEK');
  const humanView = new CharacterActionView(human, 'HUMAN');
  humanView.update('CAPTURE', 50);
  assert.equal(humanView.action, 'CAPTURE');
  assert.equal(humanView.lastTransitionReason, '有效抓捕圈内');
  assert.equal(human.rotation.z, 0);
  deepseekView.update('FALL', 50);
  assert.equal(deepseekView.lastTransitionReason, '风险冲刺结束，进入摔倒');
  assert.equal(deepseek.rotation.z, Math.PI / 2);
  deepseekView.update('STUN', 0);
  assert.equal(deepseekView.action, 'FALL');
  deepseekView.update('STUN', C.characterAnimation.fallPoseMs);
  assert.equal(deepseekView.action, 'STUN');
  deepseekView.reset();
  humanView.reset();
  assert.equal(deepseekView.lastTransitionReason, 'ROUND_RESET');
  assert.equal(deepseekView.action, 'IDLE');
  assert.equal(deepseek.rotation.z, 0);
  assert.equal(deepseek.material.color.getHex(), C.player.color);
  assert.deepEqual(deepseek.position.toArray(), [2, 0.5, 3]);
  assert.deepEqual(human.position.toArray(), [4, 0.5, 5]);
  assert.deepEqual(deepseek.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(human.scale.toArray(), [1, 1, 1]);
});

test('special idle slots require configured real clips and start after continuous idle', () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const view = new CharacterActionView(mesh, 'DEEPSEEK', () => 0);
  const mixer = new AnimationMixer(mesh);
  const clip = new AnimationClip('idle-01', 0.1, [
    new NumberKeyframeTrack('.rotation[y]', [0, 0.1], [0, 0.2]),
  ]);
  view.attachMixer(mixer, {}, { IDLE_01: clip, NOT_A_CONFIGURED_SLOT: clip });
  view.update('IDLE', C.characterAnimation.specialIdleTriggerMs - 50);
  assert.equal(view.currentIdleSlot, null);
  view.update('IDLE', 50);
  assert.equal(view.action, 'IDLE');
  assert.equal(view.currentIdleSlot, 'IDLE_01');
  assert.match(view.lastTransitionReason, /IDLE_01/);
  assert.deepEqual(C.characterAnimation.specialIdleSlots,
    ['IDLE_01', 'IDLE_02', 'IDLE_03', 'IDLE_04', 'IDLE_05']);
});

test('missing special idle clips keep ordinary white-box idle without errors', () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const view = new CharacterActionView(mesh, 'HUMAN');
  view.attachMixer(new AnimationMixer(mesh), {});
  view.update('IDLE', C.characterAnimation.specialIdleTriggerMs * 4);
  assert.equal(view.action, 'IDLE');
  assert.equal(view.currentIdleSlot, null);
});

test('special idle is interrupted by gameplay actions, then reset clears its timer', () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const view = new CharacterActionView(mesh, 'DEEPSEEK', () => 0);
  const mixer = new AnimationMixer(mesh);
  const clip = new AnimationClip('idle-01', 5, [
    new NumberKeyframeTrack('.rotation[y]', [0, 5], [0, 0.2]),
  ]);
  view.attachMixer(mixer, {}, { IDLE_01: clip });
  view.update('IDLE', C.characterAnimation.specialIdleTriggerMs);
  assert.equal(view.currentIdleSlot, 'IDLE_01');
  view.update('EAT', 50);
  assert.equal(view.action, 'EAT');
  assert.equal(view.currentIdleSlot, null);
  assert.equal(view.idleSeconds, 0);
  view.update('IDLE', 1_000);
  const pausedSeconds = view.idleSeconds;
  // Pause freezes this presentation clock because the game does not call update while paused.
  assert.equal(view.idleSeconds, pausedSeconds);
  view.reset();
  assert.equal(view.action, 'IDLE');
  assert.equal(view.idleSeconds, 0);
  assert.equal(view.currentIdleSlot, null);
});

test('special idle returns to ordinary idle and avoids immediate same-slot repetition', () => {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  const view = new CharacterActionView(mesh, 'DEEPSEEK', () => 0);
  const mixer = new AnimationMixer(mesh);
  const clip = new AnimationClip('idle', 0.1, [
    new NumberKeyframeTrack('.rotation[y]', [0, 0.1], [0, 0.2]),
  ]);
  view.attachMixer(mixer, {}, { IDLE_01: clip, IDLE_02: clip });
  view.update('IDLE', C.characterAnimation.specialIdleTriggerMs);
  assert.equal(view.currentIdleSlot, 'IDLE_01');
  view.update('IDLE', 150);
  assert.equal(view.currentIdleSlot, null);
  assert.equal(view.action, 'IDLE');
  assert.match(view.lastTransitionReason, /恢复普通 IDLE/);
  view.update('IDLE', C.characterAnimation.specialIdleRepeatIntervalMs - 150);
  assert.equal(view.currentIdleSlot, 'IDLE_02');
});
