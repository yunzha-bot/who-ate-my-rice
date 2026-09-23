import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
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
