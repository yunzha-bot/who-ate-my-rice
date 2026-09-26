import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RuntimeDebugOverrides, RUNTIME_PARAM_SPECS }
  from '../src/systems/RuntimeDebugOverrides.ts';
import { buildDevBObservation } from '../src/systems/DevBObserver.ts';
import { DevBDebug, DEV_B_REFRESH_MS } from '../src/three/DevBDebug.ts';

// Regression tests for the DEV-B panel DOM.
//
// The panel refreshes ~8 times per second, so every render must reuse the nodes
// it already created. A previous version rebuilt its group map on each call and
// appended a brand new "抓捕 / 视觉 / 听觉 / 移动" container each time, which
// filled the panel with repeated headings.
//
// The project ships no DOM library, so the real DevBPanel / DevBDebug classes run
// against a deliberately small DOM stand-in that implements only the surface the
// panel uses (createElement / createTextNode, append / remove, className, dataset,
// textContent, value, listeners and the three selector shapes it queries). It is
// intentionally not a general DOM; the same node counts are also checked in a
// real browser during the manual acceptance pass.

function createFakeDom() {
  class FakeNode {
    constructor() { this.parentElement = null; }
    remove() {
      const parent = this.parentElement;
      if (!parent) return;
      parent.childNodes = parent.childNodes.filter(node => node !== this);
      parent.children = parent.children.filter(node => node !== this);
      this.parentElement = null;
    }
  }

  class FakeText extends FakeNode {
    constructor(text) { super(); this.textContent = String(text); }
  }

  function descendants(root) {
    const found = [];
    for (const child of root.children) {
      found.push(child, ...descendants(child));
    }
    return found;
  }

  function matches(element, selector) {
    if (selector.startsWith('.'))
      return element.className.split(/\s+/).includes(selector.slice(1));
    const attribute = /^\[([\w-]+)="(.*)"\]$/.exec(selector);
    if (attribute) {
      const [, name, value] = attribute;
      if (!name.startsWith('data-')) return element.attributes.get(name) === value;
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return element.dataset[key] === value;
    }
    return element.tagName === selector.toUpperCase();
  }

  class FakeElement extends FakeNode {
    constructor(tagName) {
      super();
      this.tagName = String(tagName).toUpperCase();
      this.childNodes = [];
      this.children = [];
      this.dataset = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.className = '';
      this.value = '';
      this.checked = false;
      this.hidden = false;
      this.open = false;
      this.title = '';
      this.type = '';
      this.min = '';
      this.max = '';
      this.step = '';
      this.text = '';
    }
    get textContent() {
      return this.childNodes.reduce((text, node) => text + node.textContent, this.text);
    }
    set textContent(value) {
      this.text = String(value);
      for (const child of [...this.childNodes]) child.remove();
    }
    append(...nodes) {
      for (const node of nodes) {
        if (node.parentElement) node.remove();
        node.parentElement = this;
        this.childNodes.push(node);
        if (node instanceof FakeElement) this.children.push(node);
      }
      return this;
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'class') this.className = String(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, listener) {
      const list = this.listeners.get(type) ?? [];
      // Duplicates are kept on purpose: a repeated registration must be visible.
      list.push(listener);
      this.listeners.set(type, list);
    }
    removeEventListener(type, listener) {
      const list = this.listeners.get(type) ?? [];
      this.listeners.set(type, list.filter(entry => entry !== listener));
    }
    querySelector(selector) {
      return descendants(this).find(element => matches(element, selector)) ?? null;
    }
    querySelectorAll(selector) {
      return descendants(this).filter(element => matches(element, selector));
    }
  }

  const document = {
    activeElement: null,
    createElement: tagName => new FakeElement(tagName),
    createTextNode: text => new FakeText(text),
  };
  globalThis.document = document;
  // Node has no CSSOM; the panel only uses CSS.escape to build an attribute
  // selector from an entry key, and this stand-in matches attribute values
  // literally.
  globalThis.CSS = { escape: value => String(value) };
  return document;
}

function frame(overrides = {}) {
  return {
    captureRadius: 0.7,
    visionRange: 11,
    human: { x: 0, z: 0 },
    deepseek: { x: 2, z: 0 },
    vision: { status: 'VISIBLE', visible: true },
    humanTarget: { x: 1, z: 1 },
    deepseekTarget: { x: 3, z: 3 },
    humanPath: [{ x: 0, z: 0 }, { x: 1, z: 0 }],
    deepseekPath: [{ x: 2, z: 0 }],
    sounds: [],
    ...overrides,
  };
}

function observation(overrides = {}) {
  return {
    phase: 'PLAYING',
    playerFaction: 'DEEPSEEK',
    controlledFaction: 'DEEPSEEK',
    temporaryTarget: null,
    humanAiRunning: true,
    deepseekAiRunning: false,
    human: { x: 0, z: 0 },
    deepseek: { x: 1, z: 1 },
    vision: { status: 'VISIBLE', blocker: null, visible: true,
      lastSeen: { position: { x: 1, z: 1 }, ageMs: 200, remainingMs: 7_800 } },
    capture: { radius: 0.7, distance: 1.4, insideRadius: false, blocked: false,
      eligible: false, progressMs: 0, holdMs: 350 },
    hearing: null,
    sounds: [],
    paths: { human: [{ x: 0, z: 0 }], deepseek: [] },
    humanAi: {
      state: 'CHASE', target: { x: 1, z: 1 }, targetRoomId: 'living', lockDecision: 'NONE',
      targetDoorId: null, decisionReason: 'NO_LOCK_ROUTE', unlockProgressMs: 0,
      searchTargetRoomId: null, navigationReason: 'NONE', transitionReason: 'ROUND_START',
      pathIndex: 0, pathTotal: 3, pathWaypoint: { x: 0, z: 0 },
    },
    deepseekAi: {
      state: 'SEEK_RICE', targetRiceId: 'rice_01', selectionReason: 'SHORTEST',
      navigationReason: 'NONE', transitionReason: 'ROUND_START', threatSource: 'NONE',
      threatLevel: 'NONE', escapeTarget: null, escapeRoomId: null,
      noMovementReason: 'NONE', sprintDecision: 'READY', recoveryBlockReason: 'NONE',
      safeWaitReason: 'NONE', safeWaitRemainingMs: 0, curiosityRemainingMs: 0,
      passageActive: false, pathIndex: null, pathTotal: null, pathWaypoint: null,
    },
    sprint: { state: 'NORMAL', sprintRemainingMs: 0, stunRemainingMs: 0,
      cooldownRemainingMs: 0, riskMode: 'SAFE' },
    rice: { completedCount: 1, total: 5, ratio: 0.2, targetId: 'rice_01' },
    movement: { playerSpeed: 230, humanSpeed: 248.4, humanAiSpeed: 228.528 },
    ...overrides,
  };
}

function countElements(root) {
  return root.children.length +
    root.children.reduce((total, child) => total + countElements(child), 0);
}

function countListeners(root) {
  let total = 0;
  for (const list of root.listeners.values()) total += list.length;
  for (const child of root.children) total += countListeners(child);
  return total;
}

function paramRows(root) {
  return root.querySelectorAll('.dev-b-param');
}

function rowOf(root, id) {
  return paramRows(root).find(row => row.dataset.param === id) ?? null;
}

function entryOf(root, key) {
  return root.querySelectorAll('.dev-b-entry').find(row => row.dataset.entry === key) ?? null;
}

function setup() {
  const document = createFakeDom();
  const container = document.createElement('div');
  const topRow = document.createElement('div');
  const runtime = new RuntimeDebugOverrides();
  const scene = new THREE.Scene();
  let current = observation();
  const debug = new DevBDebug({
    container,
    topRow,
    scene,
    runtime,
    developerMode: true,
    collectObservation: () => current,
    collectFrame: () => frame({ captureRadius: runtime.captureRadius }),
  });
  return {
    container,
    topRow,
    runtime,
    scene,
    debug,
    setObservation: next => { current = next; },
    open() {
      debug.toggle();
      // One refresh right away: opening renders immediately.
      debug.onFrame(DEV_B_REFRESH_MS);
    },
    refresh(times = 1) {
      for (let index = 0; index < times; index++) debug.onFrame(DEV_B_REFRESH_MS);
    },
  };
}

const GROUP_LABELS = ['抓捕', '视觉', '听觉', '移动'];

function compactInputOf(container) {
  const label = container.querySelectorAll('.dev-b-compact')[0];
  return label ? label.children[0] : null;
}

test('every parameter row and group carries a Chinese explanation', () => {
  const fixture = setup();
  fixture.open();
  fixture.refresh(2);
  const { container } = fixture;
  const groups = container.querySelectorAll('.dev-b-group');
  assert.deepEqual(groups.map(group => group.querySelector('.dev-b-group-desc').textContent),
    ['｜贴到多近才算被抓住', '｜不看遮挡时能看多远', '｜声音传多远、多响、留多久', '｜角色实际的移动速度']);
  assert.ok(container.querySelectorAll('.dev-b-help-note').length === 1,
    '顶部有一条使用说明');

  const whats = container.querySelectorAll('.dev-b-param-what');
  const adjusts = container.querySelectorAll('.dev-b-param-adjust');
  const timings = container.querySelectorAll('.dev-b-param-effect');
  assert.equal(whats.length, RUNTIME_PARAM_SPECS.length);
  assert.equal(adjusts.length, RUNTIME_PARAM_SPECS.length);
  assert.equal(timings.length, RUNTIME_PARAM_SPECS.length);
  for (const what of whats) assert.match(what.textContent, /^它是什么：\S/);
  for (const adjust of adjusts)
    assert.match(adjust.textContent, /^调大：.+；调小：.+$/);
  for (let index = 0; index < timings.length; index++) {
    const spec = RUNTIME_PARAM_SPECS[index];
    assert.equal(timings[index].dataset.timing,
      spec.immediate ? 'immediate' : 'new-events', spec.id);
  }
  const soundTimings = timings.filter(row => row.dataset.timing === 'new-events');
  assert.equal(soundTimings.length, 27, '27 项声音参数属于只影响新事件的字段');
  assert.match(soundTimings[0].textContent, /只影响改动之后新产生的声音事件/);

  for (const spec of RUNTIME_PARAM_SPECS) {
    const input = rowOf(container, spec.id).querySelector('.dev-b-param-input');
    assert.match(input.title, /配置键 GAME_CONFIG/, `${spec.id} 的悬浮说明要给出配置键`);
    assert.match(input.title, /调大：/);
  }
  fixture.debug.dispose();
});

test('observation sections and fields carry Chinese explanations', () => {
  const fixture = setup();
  fixture.open();
  const { container } = fixture;
  const descs = container.querySelectorAll('.dev-b-observation-desc');
  assert.equal(descs.length, 5);
  for (const desc of descs) assert.match(desc.textContent, /^｜\S/);
  const labels = container.querySelectorAll('.dev-b-entry-label');
  assert.ok(labels.length >= 50, '观察字段数量与之前一致');
  for (const label of labels) {
    assert.ok(label.dataset.hint.length > 0, `${label.textContent} 缺少中文解释`);
    assert.match(label.title, /｜字段 .+｜.+/, `${label.textContent} 的悬浮说明要含内部字段名`);
  }
  fixture.debug.dispose();
});

test('the compact switch only hides the explanations and adds no nodes', () => {
  const fixture = setup();
  fixture.open();
  fixture.refresh(3);
  const { container } = fixture;
  const input = compactInputOf(container);
  assert.ok(input, '必须提供紧凑模式开关');
  assert.equal(input.listeners.get('change').length, 1);
  assert.equal(container.querySelectorAll('.dev-b-panel')[0].dataset.compact, 'false',
    '默认显示说明');
  const nodes = countElements(container) + countElements(fixture.topRow);
  const listeners = countListeners(container) + countListeners(fixture.topRow);
  for (let cycle = 0; cycle < 20; cycle++) {
    input.checked = !input.checked;
    for (const listener of input.listeners.get('change')) listener();
  }
  assert.equal(input.checked, false, '偶数次切换后回到默认');
  assert.equal(container.querySelectorAll('.dev-b-panel')[0].dataset.compact, 'false');
  assert.equal(container.querySelectorAll('.dev-b-param-what').length,
    RUNTIME_PARAM_SPECS.length, '紧凑模式只隐藏、不删除说明节点');
  assert.equal(countElements(container) + countElements(fixture.topRow), nodes);
  assert.equal(countListeners(container) + countListeners(fixture.topRow), listeners);
  // 打开之后仍然是同一批节点，说明刷新与紧凑切换都没有重建控件。
  fixture.refresh(50);
  assert.equal(countElements(container) + countElements(fixture.topRow), nodes);
  fixture.debug.dispose();
});

test('repeated refreshes never duplicate the parameter group headings', () => {
  const fixture = setup();
  fixture.open();
  fixture.refresh(400);
  const groups = fixture.container.querySelectorAll('.dev-b-group');
  assert.deepEqual(groups.map(group => group.children[0].textContent), GROUP_LABELS,
    '每个分组标题只能出现一次，且保持参数表顺序');
  assert.deepEqual(groups.map(group => group.querySelectorAll('.dev-b-param').length),
    [1, 1, 33, 3], '每个分组只包含自己的参数行');
  assert.equal(paramRows(fixture.container).length, RUNTIME_PARAM_SPECS.length);
  const ids = paramRows(fixture.container).map(row => row.dataset.param);
  assert.equal(new Set(ids).size, RUNTIME_PARAM_SPECS.length, '参数行不得重复');
  fixture.debug.dispose();
});

test('the node and listener counts stay flat across hundreds of refreshes', () => {
  const fixture = setup();
  fixture.open();
  const nodes = countElements(fixture.container) + countElements(fixture.topRow);
  const listeners = countListeners(fixture.container) + countListeners(fixture.topRow);
  const sections = fixture.container.querySelectorAll('.dev-b-observation-section').length;
  fixture.refresh(600);
  assert.equal(countElements(fixture.container) + countElements(fixture.topRow), nodes);
  assert.equal(countListeners(fixture.container) + countListeners(fixture.topRow), listeners);
  assert.equal(fixture.container.querySelectorAll('.dev-b-observation-section').length, sections);
  assert.equal(sections, 5);
  fixture.debug.dispose();
});

test('closing and reopening the panel neither re-adds nodes nor listeners', () => {
  const fixture = setup();
  fixture.open();
  const launchers = fixture.topRow.querySelectorAll('.dev-b-launcher').length;
  const panels = fixture.container.querySelectorAll('.dev-b-panel').length;
  const nodes = countElements(fixture.container) + countElements(fixture.topRow);
  const listeners = countListeners(fixture.container) + countListeners(fixture.topRow);
  assert.equal(launchers, 1);
  assert.equal(panels, 1);
  for (let cycle = 0; cycle < 40; cycle++) {
    fixture.debug.toggle();
    fixture.refresh(5);
    fixture.debug.toggle();
    fixture.refresh(5);
  }
  assert.equal(fixture.topRow.querySelectorAll('.dev-b-launcher').length, 1);
  assert.equal(fixture.container.querySelectorAll('.dev-b-panel').length, 1);
  assert.equal(countElements(fixture.container) + countElements(fixture.topRow), nodes);
  assert.equal(countListeners(fixture.container) + countListeners(fixture.topRow), listeners);
  const input = rowOf(fixture.container, 'capture.radius').querySelector('.dev-b-param-input');
  assert.equal(input.listeners.get('change').length, 1, '参数控件只注册一次 change 监听');
  assert.equal(fixture.topRow.querySelector('.dev-b-launcher').listeners.get('click').length, 1);
  fixture.debug.dispose();
});

test('a refresh updates the existing rows instead of appending new ones', () => {
  const fixture = setup();
  fixture.open();
  const row = rowOf(fixture.container, 'capture.radius');
  const status = row.querySelector('.dev-b-param-status');
  const input = row.querySelector('.dev-b-param-input');
  assert.match(status.textContent, /正式基准：0.7/);

  fixture.runtime.set('capture.radius', 1.5);
  fixture.refresh(3);
  assert.equal(rowOf(fixture.container, 'capture.radius'), row, '同一行对象被复用');
  assert.match(status.textContent, /已覆盖：1.5/);
  assert.equal(status.dataset.tone, 'warning');
  assert.equal(input.value, '1.5');
  assert.equal(paramRows(fixture.container).length, RUNTIME_PARAM_SPECS.length);

  fixture.runtime.clearAll();
  fixture.refresh(3);
  assert.match(status.textContent, /正式基准：0.7/);
  assert.equal(status.dataset.tone, 'normal');
  fixture.debug.dispose();
});

test('the observation sections and entries are reused while values change', () => {
  const fixture = setup();
  fixture.open();
  const sections = buildDevBObservation(observation());
  const capture = sections.find(section =>
    section.entries.some(entry => entry.label === '抓捕半径（有效值）'));
  const key = `${capture.id}/抓捕半径（有效值）`;
  const entry = entryOf(fixture.container, key);
  assert.ok(entry, '观察分区必须渲染出抓捕半径条目');
  assert.match(entry.children[1].textContent, /0.7/);

  // The observer reads the effective radius from the live game state, so the
  // fixture stands in for the next read.
  fixture.setObservation(observation({
    capture: { ...observation().capture, radius: 1.5 },
  }));
  fixture.refresh(3);
  const after = entryOf(fixture.container, key);
  assert.equal(after, entry, '同一条目对象被复用');
  assert.match(entry.children[1].textContent, /1.5/);
  assert.equal(fixture.container.querySelectorAll('.dev-b-observation-section').length, 5);
  fixture.debug.dispose();
});

test('an illegal entry is rejected without adding nodes', () => {
  const fixture = setup();
  fixture.open();
  const row = rowOf(fixture.container, 'capture.radius');
  const input = row.querySelector('.dev-b-param-input');
  const nodes = countElements(fixture.container);
  input.value = 'abc';
  for (const listener of input.listeners.get('change')) listener();
  const notice = fixture.container.querySelector('.dev-b-notice');
  assert.equal(notice.hidden, false, '非法输入必须有可见反馈');
  assert.equal(notice.dataset.tone, 'danger');
  assert.equal(input.value, '0.7', '非法输入回滚到当前有效值');
  assert.equal(countElements(fixture.container), nodes);
  assert.equal(fixture.runtime.overrideCount, 0);
  fixture.debug.dispose();
});

test('a focused input keeps the text the user is typing', () => {
  const fixture = setup();
  fixture.open();
  const input = rowOf(fixture.container, 'capture.radius').querySelector('.dev-b-param-input');
  globalThis.document.activeElement = input;
  input.value = '1.';
  fixture.refresh(20);
  assert.equal(input.value, '1.', '刷新不得覆盖正在输入的数值');
  globalThis.document.activeElement = null;
  fixture.refresh(1);
  assert.equal(input.value, '0.7', '失焦后回到当前有效值');
  fixture.debug.dispose();
});

test('disposing the panel removes its nodes and cached listeners', () => {
  const fixture = setup();
  fixture.open();
  fixture.refresh(10);
  fixture.debug.dispose();
  assert.equal(fixture.container.querySelectorAll('.dev-b-panel').length, 0);
  assert.equal(fixture.topRow.querySelectorAll('.dev-b-launcher').length, 0);
  assert.equal(fixture.scene.children.length, 0, '可视化绘制对象一并释放');
});
