import test from 'node:test';
import assert from 'node:assert/strict';
import { interactionPrompt } from '../src/three/InteractionPrompt.ts';
import { resolveInteractionIntent } from '../src/systems/HideInteractionArbitration.ts';

const base = { playable: true, faction: 'DEEPSEEK', pulseLockOpen: false,
  concealed: false, door: null, rice: null, hide: null, doorState: null,
  activeLockCore: false, canClose: true, canHide: true, canEat: true,
  exitBlocked: false, riceInRange: false, moving: false };

test('E hint respects real door/hide/rice arbitration rather than visual facing', () => {
  const overlap = { ...base, door: { distance: .3 }, doorState: 'CLOSED',
    rice: { distance: .7 }, riceInRange: true, hide: { spotId: 'bed' } };
  assert.equal(resolveInteractionIntent(overlap), 'DOOR');
  assert.equal(interactionPrompt(overlap).label, '开门');
  const furniture = { ...overlap, door: null };
  assert.equal(interactionPrompt(furniture).label, '躲藏');
  assert.equal(interactionPrompt({ ...furniture, hide: null }).label, '吃米');
  assert.equal(interactionPrompt({ ...furniture, canHide: false }), null);
});

test('E hints respect range, sprint, stationary eating and exclusive hidden exit', () => {
  const rice = { ...base, rice: { distance: .8 }, riceInRange: true };
  assert.deepEqual(interactionPrompt(rice), { label: '吃米', detail: '按住', blocked: false });
  assert.equal(interactionPrompt({ ...rice, moving: true }).detail, '停下后按住');
  assert.equal(interactionPrompt({ ...rice, riceInRange: false }), null);
  assert.equal(interactionPrompt({ ...rice, canEat: false }), null);
  const concealed = { ...rice, concealed: true, hide: { spotId: 'bed' }, door: { distance: 0 } };
  assert.equal(interactionPrompt(concealed).label, '离开');
  assert.equal(interactionPrompt({ ...concealed, exitBlocked: true }).blocked, true);
});

test('door hints retain locked/blocked feedback and Human core override', () => {
  const door = { ...base, door: { distance: .2 }, doorState: 'OPEN' };
  assert.equal(interactionPrompt(door).label, '关门');
  assert.equal(interactionPrompt({ ...door, canClose: false }).blocked, true);
  assert.equal(interactionPrompt({ ...door, doorState: 'LOCKED' }).blocked, true);
  assert.equal(interactionPrompt({ ...door, faction: 'HUMAN', doorState: 'LOCKED',
    activeLockCore: true }).label, '解锁');
});

test('prompt is read-only and hidden outside gameplay or under minesweeper', () => {
  const state = Object.freeze({ ...base, hide: { spotId: 'bed' } });
  const before = JSON.stringify(state);
  interactionPrompt(state);
  assert.equal(JSON.stringify(state), before);
  assert.equal(interactionPrompt({ ...state, playable: false }), null);
  assert.equal(interactionPrompt({ ...state, pulseLockOpen: true }), null);
  assert.equal(interactionPrompt(base), null);
});
