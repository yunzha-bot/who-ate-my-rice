import test from 'node:test';
import assert from 'node:assert/strict';
import { AlphaHudView } from '../src/three/AlphaHudView.ts';

// Deliberately small DOM stand-in. Rendering/layout is checked in the browser.
function harness() {
  const make = () => ({ textContent: '', hidden: false, dataset: {}, values: {},
    style: { setProperty(key, value) { this[key] = value; } },
    setAttribute() {}, remove() { this.removed = true; } });
  const nodes = new Map();
  const root = make();
  let builds = 0;
  Object.defineProperty(root, 'innerHTML', { set(value) { root.markup = value; builds++; } });
  root.querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, make());
    return nodes.get(selector);
  };
  const pips = Array.from({ length: 5 }, make);
  root.querySelectorAll = () => pips;
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => root };
  const view = new AlphaHudView({ append() {} });
  globalThis.document = oldDocument;
  return { view, root, nodes, pips, builds: () => builds };
}

const frame = { phase: 'PLAYING', faction: 'DEEPSEEK', time: '00:12', completed: 2,
  total: 5, readySeconds: 0, qRemainingMs: 6000, qDurationMs: 12000,
  sprintRemainingMs: 0, sprintDurationMs: 30000, sprintState: 'NORMAL',
  concealed: false, captureRatio: 0, riceRatio: null };

test('HUD changes faction information structure without rebuilding DOM or mutating input', () => {
  const h = harness();
  const before = JSON.stringify(frame);
  h.view.update(frame);
  assert.equal(h.nodes.get('.alpha-rice').textContent, '2 / 5 份已吃完');
  assert.equal(h.nodes.get('.alpha-sprint').hidden, false);
  assert.equal(h.nodes.get('.alpha-q').style['--cooldown'], '180deg');
  assert.deepEqual(h.pips.map(p => p.dataset.done), ['true', 'true', 'false', 'false', 'false']);
  h.view.update({ ...frame, faction: 'HUMAN' });
  assert.equal(h.nodes.get('.alpha-rice').textContent, '3 / 5 份米还在');
  assert.equal(h.nodes.get('.alpha-sprint').hidden, true);
  assert.equal(h.nodes.get('.alpha-key small').textContent, '开门 · 解锁');
  assert.equal(h.builds(), 1);
  assert.equal(JSON.stringify(frame), before);
});

test('HUD isolates pause/results and reflects only supplied READY, hiding and capture state', () => {
  const h = harness();
  h.view.update({ ...frame, phase: 'READY', readySeconds: 3 });
  assert.equal(h.nodes.get('.alpha-ready strong').textContent, '3');
  assert.equal(h.nodes.get('.alpha-ready').hidden, false);
  h.view.update({ ...frame, concealed: true });
  assert.match(h.nodes.get('.alpha-progress').textContent, /已藏好/);
  h.view.update({ ...frame, captureRatio: .5 });
  assert.equal(h.nodes.get('.alpha-progress').dataset.danger, 'true');
  for (const phase of ['PAUSED', 'FINISHED']) {
    h.view.update({ ...frame, phase });
    assert.equal(h.root.hidden, true);
  }
  h.view.update(frame);
  assert.equal(h.root.hidden, false);
  h.view.dispose();
  assert.equal(h.root.removed, true);
});

test('READY presentation pulses only on a new number and briefly shows 开始！ without delaying PLAYING', async () => {
  const h = harness();
  const number = h.root.querySelector('.alpha-ready strong');
  let pulses = 0;
  number.animate = () => { pulses++; };
  h.view.update({ ...frame, phase: 'READY', readySeconds: 3 });
  h.view.update({ ...frame, phase: 'READY', readySeconds: 3 });
  assert.equal(pulses, 1);
  h.view.update({ ...frame, phase: 'READY', readySeconds: 2 });
  assert.equal(pulses, 2);
  h.view.update({ ...frame, phase: 'PLAYING', readySeconds: 0 });
  assert.equal(number.textContent, '开始！');
  assert.equal(h.nodes.get('.alpha-ready').dataset.finishing, 'true');
  await new Promise(resolve => setTimeout(resolve, 350));
  assert.equal(h.nodes.get('.alpha-ready').hidden, true);
  h.view.dispose();
});

test('actor hint reuses DOM, projects screen coordinates and clears on lifecycle transitions', () => {
  const h = harness();
  const hint = { label: '躲藏', detail: '', blocked: false, x: 300, y: 210, held: false };
  h.view.update({ ...frame, interaction: hint });
  const node = h.nodes.get('.world-interaction');
  assert.equal(node.dataset.visible, 'true');
  assert.equal(node.style.left, '300px');
  assert.equal(h.nodes.get('.world-interaction strong').textContent, '躲藏');
  h.view.update({ ...frame, interaction: { ...hint, label: '吃米', detail: '按住', held: true } });
  assert.equal(node.dataset.pressed, 'true');
  assert.equal(h.nodes.get('.world-interaction strong').textContent, '吃米');
  h.view.update({ ...frame, interaction: null });
  assert.equal(node.dataset.visible, 'false');
  assert.equal(node.dataset.pressed, 'false');
  for (const phase of ['READY', 'PAUSED', 'FINISHED', 'FACTION_SELECT']) {
    h.view.update({ ...frame, phase, interaction: hint });
    assert.equal(node.dataset.visible, 'false');
  }
  assert.equal(h.builds(), 1);
});
