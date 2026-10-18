import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { StartupReadiness } from '../src/three/StartupReadiness.ts';

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function fixture({ blockedAudio = false } = {}) {
  let now = 0, serial = 0;
  const timers = new Map(), elements = new Map();
  const element = () => ({ hidden: false, textContent: '', removed: false, handlers: {},
    classList: { add() {} }, setAttribute() {}, addEventListener(name, fn) { this.handlers[name] = fn; },
    remove() { this.removed = true; }, querySelector(selector) { if (!elements.has(selector)) elements.set(selector, element()); return elements.get(selector); } });
  const manager = {}, root = element(), image = deferred();
  const container = { inert: false, querySelectorAll: () => [{ decode: () => image.promise }] };
  const window = { setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; } };
  const clearTimeout = id => timers.delete(id);
  const source = readFileSync(new URL('../src/three/StartupView.ts', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace('export class', 'class')
    .replaceAll('import.meta.env.BASE_URL', "'/'");
  const View = runInNewContext(`${stripTypeScriptTypes(source, { mode: 'transform' })}; StartupView`, {
    StartupReadiness, DefaultLoadingManager: manager, document: { createElement: () => root, body: { append() {} } },
    window, clearTimeout, AbortController, location: { reload() {} },
    fetch: async (_url, options) => blockedAudio
      ? new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('audio timeout'))))
      : { ok: true, arrayBuffer: async () => new Uint8Array([79, 103, 103, 83]).buffer },
  });
  const view = new View(container);
  const advance = async ms => {
    const end = now + ms;
    for (;;) {
      await Promise.resolve(); await Promise.resolve();
      const next = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end; await Promise.resolve(); await Promise.resolve();
  };
  return { view, manager, root, container, image, advance, elements };
}

test('20-second slow notification must not unlock entry while v6 is still downloading', async () => {
  const f = fixture();
  f.manager.onStart('v6.glb', 0, 1);
  f.image.resolve(); void f.view.prepared();
  await f.advance(25_000);
  assert.equal(f.container.inert, true, 'pending formal model must still block entry');
  assert.equal(f.root.removed, false);
});

test('8-second audio budget cannot bypass a pending first-screen image', async () => {
  const f = fixture();
  void f.view.prepared();
  await f.advance(12_000);
  assert.equal(f.container.inert, true, 'image preparation is independent of optional audio timeout');
  assert.equal(f.root.removed, false);
});

test('model download/parse/animation initialization block both the screen and actual faction entry', async () => {
  const gameSource = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const method = gameSource.match(/  private chooseFaction\([\s\S]*?\n  }\n/)[0];
  const Harness = runInNewContext(`${stripTypeScriptTypes(`class Harness { ${method} }; Harness;`)}`);
  const f = fixture(), game = new Harness();
  let entries = 0;
  game.startupReadiness = f.view.readiness;
  game.match = { beginFromFactionSelect() { entries++; return false; } };
  f.image.resolve(); await f.view.prepared();
  for (const phase of ['downloading', 'parsing', 'initializing', 'failed']) {
    f.view.readiness.setModel(phase);
    await f.advance(30_000);
    game.chooseFaction('DEEPSEEK'); game.chooseFaction('HUMAN');
    assert.equal(entries, 0, phase);
    assert.equal(f.container.inert, true, phase);
  }
  f.view.readiness.setModel('ready'); await f.advance(1000);
  assert.equal(f.container.inert, false);
  assert.equal(f.root.removed, true);
  game.chooseFaction('DEEPSEEK'); game.chooseFaction('HUMAN');
  assert.equal(entries, 2);
});

test('real failure offers retry and explicit simplified choice, never silent admission', async () => {
  const f = fixture();
  f.image.resolve(); await f.view.prepared();
  f.view.readiness.setModel('failed'); await f.advance(1000);
  assert.equal(f.container.inert, true);
  assert.equal(f.elements.get('.startup-retry').hidden, false);
  assert.equal(f.elements.get('.startup-simplify').hidden, false);
  f.view.onSimplify = () => f.view.readiness.setModel('simplified');
  f.elements.get('.startup-simplify').handlers.click();
  await f.advance(1000);
  assert.equal(f.view.readiness.canStart, true);
  assert.equal(f.container.inert, false);
  assert.equal(f.view.readiness.model, 'simplified');
});

test('slow choice can explicitly bypass pending assets and pending model without waiting for optional audio', async () => {
  const f = fixture();
  f.manager.onStart('v6.glb', 0, 1);
  void f.view.prepared();
  await f.advance(21_000);
  assert.equal(f.view.readiness.model, 'downloading', 'time alone is not a failure');
  assert.equal(f.elements.get('.startup-wait').hidden, false);
  f.elements.get('.startup-wait').handlers.click();
  await f.advance(1000);
  assert.equal(f.container.inert, true);
  f.view.onSimplify = () => f.view.readiness.setModel('simplified');
  f.elements.get('.startup-simplify').handlers.click();
  await f.advance(1000);
  assert.equal(f.container.inert, false);
  assert.equal(f.view.readiness.assets, 'simplified');
  f.image.resolve(); await f.advance(1000);
  assert.equal(f.view.readiness.model, 'simplified');
});

test('missing first-screen image does not permit normal start, but explicit degradation remains available', async () => {
  const f = fixture();
  f.image.reject(Error('image failure')); await f.view.prepared();
  f.view.readiness.setModel('ready'); await f.advance(1000);
  assert.equal(f.view.readiness.assets, 'failed');
  assert.equal(f.container.inert, true);
  assert.equal(f.elements.get('.startup-simplify').hidden, false);
});

test('pending optional audio does not delay an otherwise ready formal start', async () => {
  const f = fixture({ blockedAudio: true });
  f.view.readiness.setModel('ready');
  f.image.resolve(); await f.view.prepared(); await f.advance(1000);
  assert.equal(f.container.inert, false, 'formal entry must not wait for the 8s optional audio budget');
  await f.advance(9000);
  assert.equal(f.view.readiness.model, 'ready');
});
