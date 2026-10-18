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
  forceBreakRemainingMs: 0, forceBreakDurationMs: 30000,
  netRemainingMs: 0, netDurationMs: 20000, netStatus: null, netSlots: 4, lockSlots: 3,
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
  assert.equal(h.nodes.get('.alpha-sprint').hidden, false);
  assert.equal(h.nodes.get('.alpha-sprint').textContent, 'Space 破门\n就绪');
  assert.equal(h.nodes.get('.alpha-key small').textContent, '开门 · 搜查');
  assert.equal(h.nodes.get('.alpha-q').hidden, false);
  assert.equal(h.nodes.get('.alpha-q').textContent, 'V 抓捕\n冷却 6 秒');
  h.view.update({ ...frame, faction: 'HUMAN', qRemainingMs: 0 });
  for (const [selector, label] of [['.alpha-q', 'V 抓捕'],
    ['.alpha-net', 'Q 布网'], ['.alpha-sprint', 'Space 破门']]) {
    assert.equal(h.nodes.get(selector).textContent, `${label}\n就绪`);
  }
  assert.equal(h.builds(), 1);
  assert.equal(JSON.stringify(frame), before);
});

test('Human Space card reflects actual force cooldown and does not inherit DP sprint states', () => {
  const h = harness();
  const human = { ...frame, faction: 'HUMAN', forceBreakRemainingMs: 15001,
    sprintRemainingMs: 0, sprintState: 'STUNNED' };
  h.view.update(human);
  const card = h.nodes.get('.alpha-sprint');
  assert.equal(card.hidden, false);
  assert.equal(card.textContent, 'Space 破门\n冷却 16 秒');
  assert.equal(card.dataset.ready, 'false');
  h.view.update({ ...human, forceBreakRemainingMs: 15000 });
  assert.equal(card.style['--cooldown'], '180deg');
  assert.equal(card.style['--cooldown-width'], '50%');
  h.view.update({ ...human, forceBreakRemainingMs: 0 });
  assert.equal(card.textContent, 'Space 破门\n就绪');
  assert.equal(card.dataset.ready, 'true');
  h.view.update({ ...frame, sprintRemainingMs: 5000 });
  assert.equal(card.textContent, 'Space 冲刺 · 5s');
  h.view.dispose();
});

test('Human Q net card has its own authoritative cooldown and placement status, independent of V search', () => {
  const h = harness(), human = { ...frame, faction: 'HUMAN', netRemainingMs: 19500 };
  h.view.update(human);
  assert.equal(h.nodes.get('.alpha-net').hidden, false);
  assert.equal(h.nodes.get('.alpha-net').textContent, 'Q 布网\n冷却 20 秒');
  assert.equal(h.nodes.get('.alpha-q').hidden, false);
  assert.equal(h.nodes.get('.alpha-key small').textContent, '开门 · 搜查');
  h.view.update({ ...human, netRemainingMs: 0, netStatus: '已布置' });
  assert.equal(h.nodes.get('.alpha-net').textContent, 'Q 布网\n已布置');
  assert.equal(h.nodes.get('.alpha-net').dataset.ready, 'false');
  h.view.update(frame); assert.equal(h.nodes.get('.alpha-net').hidden, true);
});

test('Human V search card shows authoritative cooldown without lock badge; switching back restores DP Q', () => {
  const h = harness();
  for (const qRemainingMs of [0, 12000, 5000, 0]) {
    h.view.update({ ...frame, faction: 'HUMAN', qRemainingMs });
    assert.equal(h.nodes.get('.alpha-q').hidden, false);
    assert.equal(h.nodes.get('.alpha-q').textContent,
      `V 抓捕\n${qRemainingMs ? `冷却 ${Math.ceil(qRemainingMs / 1000)} 秒` : '就绪'}`);
    assert.equal(h.nodes.get('.alpha-q').dataset.slots, undefined);
    assert.equal(h.nodes.get('.alpha-key small').textContent, '开门 · 搜查');
    assert.equal(h.nodes.get('.alpha-net').hidden, false);
    assert.equal(h.nodes.get('.alpha-sprint').hidden, false);
  }
  h.view.update(frame);
  assert.equal(h.nodes.get('.alpha-q').hidden, false);
  assert.equal(h.nodes.get('.alpha-q').textContent, 'Q 锁门 · 6s');
  assert.equal(h.nodes.get('.alpha-q').style['--cooldown'], '180deg');
  h.view.update({ ...frame, qRemainingMs: 0 });
  assert.equal(h.nodes.get('.alpha-q').textContent, 'Q 锁门 · 就绪');
  h.view.dispose();
});

test('Q corner badges show free net/lock slots through full capacity and slot recovery', () => {
  const h = harness();
  for (const slots of [4, 3, 2, 1, 0, 1, 4]) {
    h.view.update({ ...frame, faction: 'HUMAN', netSlots: slots,
      netStatus: slots === 0 ? '已放满' : null });
    assert.equal(h.nodes.get('.alpha-net').dataset.slots, String(slots));
    assert.equal(h.nodes.get('.alpha-net').hidden, false);
    if (slots === 0) assert.equal(h.nodes.get('.alpha-net').textContent, 'Q 布网\n已放满');
  }
  for (const slots of [3, 2, 1, 0, 1, 3]) {
    h.view.update({ ...frame, lockSlots: slots });
    assert.equal(h.nodes.get('.alpha-q').dataset.slots, String(slots));
    assert.equal(h.nodes.get('.alpha-q').textContent, 'Q 锁门 · 6s');
    assert.equal(h.nodes.get('.alpha-net').hidden, true);
  }
  assert.equal(h.builds(), 1); h.view.dispose();
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
  assert.equal(h.nodes.get('.world-interaction kbd').textContent, 'E');
  h.view.update({ ...frame, faction: 'HUMAN', interaction: { ...hint, key: 'V', label: '搜查' } });
  assert.equal(h.nodes.get('.world-interaction kbd').textContent, 'V');
  h.view.update({ ...frame, interaction: { ...hint, label: '吃米', detail: '按住', held: true } });
  assert.equal(h.nodes.get('.world-interaction kbd').textContent, 'E');
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
