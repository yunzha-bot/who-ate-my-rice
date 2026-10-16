import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuSettingsView } from '../src/three/MenuSettingsView.ts';

function fixture(t) {
  class Element {
    parent = null; nodes = new Map(); listeners = new Map(); dataset = {}; attributes = new Map(); hidden = false;
    addEventListener(type, callback) { const set = this.listeners.get(type) ?? new Set(); set.add(callback); this.listeners.set(type, set); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    emit(type, event) { for (const callback of this.listeners.get(type) ?? []) callback(event); }
    querySelector(selector) { return this.nodes.get(selector) ?? null; }
    closest(selector) {
      if (selector === '[data-menu-panel]' && this.dataset.menuPanel) return this;
      if (selector === 'label' && this.isLabel) return this;
      if (selector === '.difficulty-select' && this.isDifficulty) return this;
      if (selector === 'input[name="difficulty"]' && this.isRadio) return this;
      return this.parent?.closest(selector) ?? null;
    }
    contains(node) { for (let current = node; current; current = current.parent) if (current === this) return true; return false; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    focus() { document.activeElement = this; }
  }
  const previous = globalThis.document, doc = new Element(); globalThis.document = doc;
  const menu = new Element(), root = new Element(), audioRoot = new Element(), radio = new Element(), label = new Element(), field = new Element(), title = new Element(), current = new Element();
  menu.nodes.set('.menu-settings', root); root.parent = menu; field.parent = root; field.isDifficulty = true;
  radio.parent = label; radio.isRadio = true; radio.checked = true;
  label.parent = field; label.isLabel = true; label.nodes.set('strong', title); title.textContent = '简单';
  root.nodes.set('.difficulty-select input:checked', radio);
  const buttons = {}, panels = {};
  for (const panel of ['audio', 'difficulty']) {
    const button = new Element(), content = new Element(); button.parent = root; button.dataset.menuPanel = panel;
    content.parent = root; content.hidden = true; root.nodes.set(`[data-menu-panel="${panel}"]`, button); root.nodes.set(`.menu-${panel}-slot`, content);
    buttons[panel] = button; panels[panel] = content;
  }
  buttons.difficulty.nodes.set('[data-difficulty-label]', current);
  const view = new MenuSettingsView(menu, audioRoot);
  t.after(() => { view.dispose(); globalThis.document = previous; });
  const click = panel => root.emit('click', { target: buttons[panel] });
  return { view, menu, root, audioRoot, radio, title, current, buttons, panels, doc, Element, click };
}

test('home buttons reuse audio controls and toggle mutually exclusive panels', t => {
  const f = fixture(t); f.click('audio');
  assert.equal(f.audioRoot.open, true); assert.equal(f.panels.audio.hidden, false);
  f.click('difficulty'); assert.equal(f.audioRoot.open, false); assert.equal(f.panels.audio.hidden, true); assert.equal(f.panels.difficulty.hidden, false);
  f.click('difficulty'); assert.equal(f.panels.difficulty.hidden, true); assert.equal(f.buttons.difficulty.attributes.get('aria-expanded'), 'false');
});

test('outside clicks close the panel but movement or interaction within it does not', t => {
  const f = fixture(t); f.click('audio');
  const child = new f.Element(); child.parent = f.panels.audio;
  f.doc.emit('pointerdown', { target: child }); assert.equal(f.panels.audio.hidden, false);
  f.doc.emit('pointerdown', { target: new f.Element() }); assert.equal(f.panels.audio.hidden, true);
});

test('Escape closes only an open home panel and restores its trigger focus', t => {
  const f = fixture(t); f.click('difficulty'); let prevented = 0, stopped = 0;
  const event = { code: 'Escape', preventDefault() { prevented++; }, stopPropagation() { stopped++; } };
  f.doc.emit('keydown', event); assert.equal(prevented, 1); assert.equal(stopped, 1); assert.equal(f.doc.activeElement, f.buttons.difficulty);
  f.doc.emit('keydown', event); assert.equal(stopped, 1);
  f.click('audio'); f.menu.hidden = true; f.doc.emit('keydown', event); assert.equal(stopped, 1);
});

test('existing difficulty radio changes update the display and close the panel', t => {
  const f = fixture(t); assert.equal(f.current.textContent, '简单');
  for (const label of ['普通', '困难', '简单']) {
    f.click('difficulty'); f.title.textContent = label; f.root.emit('change', { target: f.radio });
    assert.equal(f.current.textContent, label); assert.equal(f.buttons.difficulty.attributes.get('aria-label'), `游戏难度：${label}`); assert.equal(f.panels.difficulty.hidden, true);
  }
});

test('dispose removes every owned listener, including after repeated open and close', t => {
  const f = fixture(t); for (let i = 0; i < 10; i++) { f.click('audio'); f.click('difficulty'); }
  assert.equal(f.root.listeners.get('click').size, 1); assert.equal(f.doc.listeners.get('keydown').size, 1);
  f.view.dispose(); f.view.dispose();
  assert.ok([...f.root.listeners.values(), ...f.doc.listeners.values()].every(set => set.size === 0));
});

test('clicking the already-selected difficulty closes without requiring a change event', t => {
  const f = fixture(t); f.click('difficulty');
  f.root.emit('click', { target: f.radio });
  assert.equal(f.panels.difficulty.hidden, true);
  assert.equal(f.current.textContent, '简单');
  assert.equal(f.doc.activeElement, f.buttons.difficulty);
});
