import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Scene } from 'three';
import { GameFeedback } from '../src/three/GameFeedback.ts';
import { AISafetyPathView } from '../src/three/AISafetyPathView.ts';

function feedbackFixture(t, reduced = false) {
  class Element {
    style = {}; children = []; listeners = new Map();
    setAttribute() {}
    append(child) { this.children.push(child); child.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
    finish() { this.listeners.get('animationend')?.(); }
  }
  const oldDocument = globalThis.document, oldMedia = globalThis.matchMedia;
  globalThis.document = { createElement: () => new Element() };
  globalThis.matchMedia = () => ({ matches: reduced });
  t.after(() => { globalThis.document = oldDocument; globalThis.matchMedia = oldMedia; });
  const pending = new Map(); let serial = 0;
  t.mock.method(globalThis, 'setTimeout', (fn, ms) => { pending.set(++serial, { fn, ms }); return serial; });
  t.mock.method(globalThis, 'clearTimeout', id => pending.delete(id));
  return { view: new GameFeedback(new Element(), new OrthographicCamera()), pending };
}

test('feedback clear/dispose cancels every fallback timer and animation listener', t => {
  const { view, pending } = feedbackFixture(t);
  view.show('我吃', 'good', undefined, true);
  assert.deepEqual([...pending.values()].map(x => x.ms), [950, 750, 750, 750]);
  const items = [...view.root.children];
  view.clear();
  assert.equal(pending.size, 0);
  assert.equal(view.root.children.length, 0);
  assert.ok(items.every(item => item.listeners.size === 0));
  view.dispose(); view.dispose();
  assert.equal(pending.size, 0);
});

test('animation completion cancels its fallback without removing other live feedback', t => {
  const { view, pending } = feedbackFixture(t);
  view.show('完成', 'good'); view.show('恢复', 'soft');
  view.root.children[0].finish();
  assert.equal(pending.size, 1);
  assert.equal(view.root.children[0].textContent, '恢复');
  view.clear(); assert.equal(pending.size, 0);
});

test('reduced motion still uses one 950ms feedback and no rice grains', t => {
  const { view, pending } = feedbackFixture(t, true);
  view.show('我吃', 'good', undefined, true);
  assert.equal(view.root.children.length, 1);
  assert.equal([...pending.values()][0].ms, 950);
  view.clear();
});

test('safety path disposal releases geometry/material once and detaches its group', () => {
  const scene = new Scene(), view = new AISafetyPathView(scene);
  view.enabled = true;
  view.update({ human: null, rice: null, eat: null, observation: null,
    defaultPath: [], safePath: [] }, { x: 1, z: 2 });
  assert.equal(view.group.children.length, 2);
  let geometries = 0, materials = 0;
  for (const line of view.group.children) {
    line.geometry.addEventListener('dispose', () => geometries++);
    line.material.addEventListener('dispose', () => materials++);
  }
  view.dispose(); view.dispose();
  assert.equal(geometries, 2); assert.equal(materials, 2);
  assert.equal(view.group.children.length, 0);
  assert.equal(view.group.parent, null);
});
