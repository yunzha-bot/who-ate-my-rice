import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInteractionIntent } from '../src/systems/HideInteractionArbitration.ts';
import { nextDeepSeekVisualHeading, resolveDeepSeekVisualTarget }
  from '../src/systems/DeepSeekVisualTarget.ts';

const furniture = { id: 'bed', x: 1, z: 0, width: 0.6, depth: 0.8,
  height: 0.5, rotation: 0 };
const hide = { spotId: 'hide_bed', furnitureId: 'bed', legal: true };
const rice = { id: 'rice_01', position: { x: 0.8, z: 0 }, range: 0.8 };
const base = { playable: true, position: { x: 0, z: 0 }, headingRad: 0,
  intent: 'HIDE_ENTER', hide, furniture, rice, riceInteractionRange: 1,
  canHide: true, canEat: true, furnitureHalfAngleDeg: 60 };
const target = changes => resolveDeepSeekVisualTarget({ ...base, ...changes });

test('facing a legal furniture target highlights exactly the E-selected spot', () => {
  assert.deepEqual(target(), { kind: 'FURNITURE', spotId: 'hide_bed',
    furnitureId: 'bed' });
});

test('facing away hides the outline without changing formal E arbitration', () => {
  assert.deepEqual(target({ headingRad: Math.PI }), { kind: 'NONE' });
  assert.equal(resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: null, rice: { distance: 0.8 }, hide: { spotId: hide.spotId } }), 'HIDE_ENTER');
});

test('furniture pointing uses its public approach surface and the approved 60 degrees', () => {
  assert.equal(target({ headingRad: Math.PI / 3 }).kind, 'FURNITURE');
  assert.equal(target({ headingRad: Math.PI * 0.6 }).kind, 'NONE');
});

test('illegal nearest furniture cannot be outlined even if another candidate is legal', () => {
  assert.equal(target({ hide: { ...hide, legal: false } }).kind, 'NONE');
});

test('the nearest rice is outlined only inside the existing one-unit eating range', () => {
  assert.deepEqual(target({ intent: 'RICE', hide: null, furniture: null }),
    { kind: 'RICE', riceId: 'rice_01' });
  assert.equal(target({ intent: 'RICE', hide: null, furniture: null,
    rice: { ...rice, range: 1.01 } }).kind, 'NONE');
});

test('pointing toward a farther rice never substitutes it for the actual nearest rice', () => {
  assert.equal(target({ intent: 'RICE', hide: null, furniture: null,
    rice: { id: 'near', position: { x: -0.7, z: 0 }, range: 0.7 } }).kind, 'NONE');
});

test('rice has its visual-only 45-degree cone, with no effect on eating intent', () => {
  assert.equal(target({ intent: 'RICE', hide: null, furniture: null,
    headingRad: Math.PI / 4 }).kind, 'RICE');
  assert.equal(target({ intent: 'RICE', hide: null, furniture: null,
    headingRad: Math.PI / 3 }).kind, 'NONE');
  assert.equal(resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: null, rice: { distance: 0.8 }, hide: null }), 'RICE');
});

test('furniture wins over overlapping rice even if the player faces only the rice', () => {
  const intent = resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: null, rice: { distance: 0.8 }, hide: { spotId: hide.spotId } });
  assert.equal(intent, 'HIDE_ENTER');
  assert.equal(target({ intent, headingRad: Math.PI }).kind, 'NONE');
});

test('door priority suppresses both furniture and rice outlines', () => {
  const intent = resolveInteractionIntent({ minesweeperOpen: false, concealed: false,
    door: { distance: 0.5 }, rice: { distance: 0.8 }, hide: { spotId: hide.spotId } });
  assert.equal(intent, 'DOOR');
  assert.equal(target({ intent }).kind, 'NONE');
  assert.equal(target({ intent, hide: null, furniture: null }).kind, 'NONE');
});

test('concealed exit and open minesweeper suppress all usable outlines', () => {
  assert.equal(target({ intent: 'HIDE_EXIT' }).kind, 'NONE');
  assert.equal(target({ intent: 'MINESWEEPER' }).kind, 'NONE');
});

test('sprint, stun or active capture never advertises a usable furniture or rice target', () => {
  assert.equal(target({ canHide: false }).kind, 'NONE');
  assert.equal(target({ intent: 'RICE', canEat: false }).kind, 'NONE');
});

test('pausing, switching faction, or losing a valid heading clears the visual target', () => {
  assert.equal(target({ playable: false }).kind, 'NONE');
  assert.equal(target({ headingRad: null }).kind, 'NONE');
});

test('actual world displacement establishes heading and stopping retains it', () => {
  const east = nextDeepSeekVisualHeading(null, { x: 0, z: 0 }, { x: 0.2, z: 0 });
  assert.equal(east, 0);
  assert.equal(nextDeepSeekVisualHeading(east, { x: 0.2, z: 0 },
    { x: 0.2, z: 0 }), east);
  assert.equal(nextDeepSeekVisualHeading(east, { x: 0.2, z: 0 },
    { x: 0.2 + 1e-8, z: 0 }), east);
  assert.equal(nextDeepSeekVisualHeading(east, { x: 0, z: 0 },
    { x: 0, z: -0.3 }), -Math.PI / 2);
});
