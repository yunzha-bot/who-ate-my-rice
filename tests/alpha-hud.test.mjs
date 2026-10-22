import test from 'node:test';
import assert from 'node:assert/strict';
import { AlphaHudView, MOBILE_CONTROLS, floatingStickCenter } from '../src/three/AlphaHudView.ts';

// Deliberately small DOM stand-in. Rendering/layout is checked in the browser.
function harness(input = { direction() {}, held() {}, aimStart() {}, aimEnd() {}, aimCancel() {}, pause() {}, cancel() {} }) {
  const make = () => ({ textContent: '', hidden: false, dataset: {}, values: {}, listeners: {},
    style: { setProperty(key, value) { this[key] = value; } },
    setAttribute() {}, addEventListener(name, callback) { this.listeners[name] = callback; },
    removeEventListener() {}, querySelector() { return make(); },
    querySelectorAll() { return []; }, getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; },
    remove() { this.removed = true; } });
  const nodes = new Map();
  const root = make();
  let builds = 0;
  Object.defineProperty(root, 'innerHTML', { set(value) { root.markup = value; builds++; } });
  root.querySelector = selector => {
    if (!nodes.has(selector)) nodes.set(selector, make());
    return nodes.get(selector);
  };
  const pips = Array.from({ length: 5 }, make);
  const buttons = new Map(['KeyE', 'KeyQ', 'KeyV', 'Space', 'KeyF', 'KeyL'].map(code => {
    const button = make(); button.dataset.touchCode = code; return [code, button];
  }));
  root.querySelectorAll = selector => selector === '.rice-inventory i' ? pips : selector === '[data-touch-code]' ? [...buttons.values()] : [];
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => root };
  const view = new AlphaHudView({ append() {} }, input);
  globalThis.document = oldDocument;
  return { view, root, nodes, pips, buttons, builds: () => builds };
}

const frame = { phase: 'PLAYING', faction: 'DEEPSEEK', time: '00:12', completed: 2,
  total: 5, readySeconds: 0, qRemainingMs: 6000, qDurationMs: 12000,
  sprintRemainingMs: 0, sprintDurationMs: 30000, sprintState: 'NORMAL',
  forceBreakRemainingMs: 0, forceBreakDurationMs: 30000,
  netRemainingMs: 0, netDurationMs: 20000, netStatus: null, netSlots: 4, lockSlots: 3,
  concealed: false, captureRatio: 0, riceRatio: null };

test('touch HUD keeps faction skills, cooldown, capacity and light action in sync with authoritative values', () => {
  const h = harness();
  h.view.update({ ...frame, faction: 'HUMAN', netRemainingMs: 11000, pickupReady: false,
    throwReady: false, lightLabel: '开灯 2s' });
  assert.equal(h.buttons.get('KeyQ').textContent, '布网\n11秒');
  assert.equal(h.buttons.get('KeyQ').dataset.slots, '4');
  assert.equal(h.buttons.get('KeyV').hidden, false);
  assert.equal(h.buttons.get('KeyF').disabled, true);
  assert.equal(h.nodes.get('.mobile-throw').disabled, true);
  assert.equal(h.buttons.get('KeyL').textContent, '开灯 2s');
  h.view.update({ ...frame, lockSlots: 0, pulseLockOpen: true });
  assert.equal(h.buttons.get('KeyQ').dataset.slots, '0');
  assert.equal(h.buttons.get('KeyV').hidden, true);
  assert.equal(h.buttons.get('KeyL').hidden, true);
  assert.equal(h.buttons.get('KeyE').textContent, '点按解锁');
  h.view.update({ ...frame, netMode: 'PLACING', pulseLockOpen: false });
  assert.equal(h.nodes.get('.mobile-cancel').hidden, true, 'DP must not see Human AI placement state');
  h.view.update({ ...frame, faction: 'HUMAN', netMode: 'AIMING' });
  assert.equal(h.nodes.get('.mobile-cancel').hidden, false, 'Human may cancel their own placement');
  h.view.dispose();
});

test('independent touch owners preserve movement, cancel safely and release all held input when HUD locks', () => {
  const calls = [], h = harness(Object.fromEntries(['direction', 'held', 'aimStart', 'aimEnd', 'aimCancel', 'pause', 'cancel']
    .map(key => [key, (...args) => calls.push([key, ...args])])));
  const event = (type, pointerId, clientX = 95, clientY = 50) => ({ type, pointerId, clientX, clientY, preventDefault() {} });
  h.view.update({ ...frame, interaction: {label:'开门',detail:'',blocked:false} });
  h.nodes.get('.mobile-move-zone').listeners.pointerdown(event('pointerdown', 1));
  assert.equal(h.view.stickPointer, 1);
  h.buttons.get('KeyE').listeners.pointerdown(event('pointerdown', 2));
  h.root.listeners.pointerup(event('pointerup', 2));
  assert.equal(h.view.stickPointer, 1, 'releasing E must not release the movement finger');
  h.nodes.get('.mobile-move-zone').listeners.pointerdown(event('pointerdown', 3));
  assert.equal(h.view.stickPointer, 1, 'a second finger cannot steal the joystick');
  h.nodes.get('.mobile-throw').listeners.pointerdown(event('pointerdown', 4));
  h.root.listeners.pointercancel(event('pointercancel', 4));
  assert(calls.some(call => call[0] === 'aimCancel'));
  assert(!calls.some(call => call[0] === 'aimEnd'), 'pointercancel must never throw');
  h.buttons.get('KeyE').listeners.pointerdown(event('pointerdown', 5));
  h.view.update({ ...frame, controlsEnabled: false });
  assert.equal(h.view.stickPointer, null);
  assert.deepEqual(calls.at(-1), ['direction', 0, 0]);
  assert(calls.some(call => call[0] === 'held' && call[1] === 'KeyE' && call[2] === false));
  assert.equal(h.view.mobilePointers.size, 0);
  h.view.dispose();
});

test('floating base is safely inset while direction remains anchored to the true first contact', () => {
  for(const box of [{left:0,top:100,width:333,height:275},{left:30,top:70,width:422,height:300}]) {
    for(const [x,y] of [[0,0],[1000,1000],[180,200]]) {
      const c=floatingStickCenter(x,y,box,106);
      assert(c.x>=box.left+64&&c.x<=box.left+box.width-64);
      assert(c.y>=box.top+64&&c.y<=box.top+box.height-64);
    }
  }
  const calls=[],h=harness({direction:(...p)=>calls.push(p),held(){},aimStart(){},aimEnd(){},aimCancel(){},pause(){},cancel(){}});
  h.view.update(frame);
  const event=(type,x,y)=>({type,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
  h.view.onStickDown(event('pointerdown',2,99));assert.deepEqual(calls.at(-1),[0,0]);
  const left=h.nodes.get('.mobile-stick').style.left;
  h.view.onStickMove(event('pointermove',102,99));assert.deepEqual(calls.at(-1),[1,0]);
  assert.equal(h.nodes.get('.mobile-stick').style.left,left,'base must never chase the finger');
  h.view.onPointerEnd(event('pointerup',102,99));assert.deepEqual(calls.at(-1),[0,0]);
  assert.equal(h.nodes.get('.mobile-stick').dataset.active,'false');h.view.dispose();
});

test('interaction hint state comes only from the supplied arbitration and stops while busy or blocked', () => {
  const h=harness(),e=h.buttons.get('KeyE'),hint={label:'开门',detail:'',blocked:false};
  for(const [extra,state,disabled] of [[{},'NONE',true],[{interaction:hint},'READY',false],
    [{interaction:{...hint,held:true}},'BUSY',false],[{interaction:{...hint,blocked:true}},'BLOCKED',true],
    [{pulseLockOpen:true},'BUSY',false],[{interaction:hint,interactionUnavailable:true},'BLOCKED',true]]) {
    h.view.update({...frame,...extra});assert.equal(e.dataset.interactionState,state);assert.equal(e.disabled,disabled);
  }
  h.view.update({...frame,interaction:hint,controlsEnabled:false});assert.equal(e.dataset.interactionState,'BLOCKED');
  h.view.onInputPointer({pointerType:'touch'});assert.equal(h.root.dataset.inputMode,'touch');
  h.view.onInputKey({key:'e'});assert.equal(h.root.dataset.inputMode,'keyboard');
  h.view.onInputPointer({pointerType:'touch'});h.view.onInputPointer({pointerType:'mouse'});assert.equal(h.root.dataset.inputMode,'keyboard');
  h.view.dispose();
});

test('one throw owner cannot be stolen and a joystick pointer cannot also press an action',()=>{
  const calls=[],h=harness(Object.fromEntries(['direction','held','aimStart','aimEnd','aimCancel','pause','cancel'].map(k=>[k,(...a)=>calls.push([k,...a])])));
  h.view.update({...frame,interaction:{label:'开门',detail:'',blocked:false}});
  const event=id=>({type:'pointerdown',pointerId:id,clientX:40,clientY:50,preventDefault(){}});
  h.view.onStickDown(event(1));h.nodes.get('.mobile-throw').listeners.pointerdown(event(1));
  h.buttons.get('KeyE').listeners.pointerdown(event(1));assert(!calls.some(c=>c[0]==='aimStart'||c[0]==='held'));
  h.nodes.get('.mobile-throw').listeners.pointerdown(event(2));h.nodes.get('.mobile-throw').listeners.pointerdown(event(3));
  assert.equal(calls.filter(c=>c[0]==='aimStart').length,1);
  h.view.onPointerEnd({...event(3),type:'pointerup'});assert(h.view.mobilePointers.has(2));
  h.view.onPointerEnd({...event(2),type:'pointerup'});h.view.onPointerEnd({...event(2),type:'pointerup'});
  assert.equal(calls.filter(c=>c[0]==='aimEnd').length,1);assert.equal(h.view.stickPointer,1);
  h.view.releaseTouch();assert.equal(h.view.stickPointer,null);h.view.dispose();
});

test('secondary touch can pause/cancel without a synthesized click or a duplicate command',()=>{
  const calls=[],h=harness(Object.fromEntries(['direction','held','aimStart','aimEnd','aimCancel','pause','cancel'].map(k=>[k,(...a)=>calls.push([k,...a])])));
  h.view.update(frame);
  for(const [selector,command] of [['.mobile-pause','pause'],['.mobile-cancel','cancel']]) {
    const button=h.nodes.get(selector);
    button.listeners.pointerdown({pointerType:'touch',isPrimary:false,preventDefault(){}});
    button.listeners.click({pointerType:'touch'});
    assert.equal(calls.filter(c=>c[0]===command).length,1);
    button.listeners.click({pointerType:'mouse'});
    assert.equal(calls.filter(c=>c[0]===command).length,2);
  }
  h.view.dispose();
});

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

test('concealment progress uses one concise exit hint without duplicating the notice banner', () => {
  const h = harness();
  h.view.update({ ...frame, concealed: true });
  assert.equal(h.nodes.get('.alpha-progress').textContent, '藏身中 · 按 E 离开');
  h.view.update({ ...frame, concealed: false });
  assert.equal(h.nodes.get('.alpha-progress').hidden, true);
  h.view.onInputPointer({pointerType:'touch'});h.view.update({...frame,concealed:true});
  assert.equal(h.nodes.get('.alpha-progress').textContent,'藏身中 · 点交互离开');
  h.view.update({...frame,riceRatio:.3});assert.match(h.nodes.get('.alpha-progress').textContent,/停下按住交互/);
  h.view.onInputKey({key:'e'});h.view.update({...frame,concealed:true});
  assert.equal(h.nodes.get('.alpha-progress').textContent,'藏身中 · 按 E 离开');
  h.view.dispose();
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
  assert.equal(h.nodes.get('.alpha-progress').textContent, '藏身中 · 按 E 离开');
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
