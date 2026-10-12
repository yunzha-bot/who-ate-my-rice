import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { populateFactionMenu, UI_PORTRAITS, REPORT_MARKUP } from '../src/three/GameUiLayout.ts';

test('native faction buttons dispatch only their own faction, once per activation', () => {
  const callbacks = [];
  const buttons = ['DEEPSEEK', 'HUMAN'].map(faction => ({
    dataset: { faction }, listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
  }));
  const menu = { innerHTML: '', querySelectorAll: () => buttons };
  populateFactionMenu(menu, faction => callbacks.push(faction));
  assert.equal((menu.innerHTML.match(/type="button"/g) ?? []).length, 2);
  assert.doesNotMatch(menu.innerHTML, /type="radio"|确认阵营/);
  buttons[0].listeners.click();
  buttons[1].listeners.click();
  assert.deepEqual(callbacks, ['DEEPSEEK', 'HUMAN']);
});

test('formal UI loads the industrial system and retains keyboard/reduced-motion access', () => {
  const css = readFileSync(new URL('../src/industrial-ui.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(main, /import '.\/industrial-ui.css'/);
  assert.doesNotMatch(main, /import '.\/rain-ui.css'/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /\.world-interaction\[data-visible="false"\]/);
});

test('returning from a match restores the button-based faction menu without removed radios', () => {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  const start = source.indexOf('private returnToFactionSelect(): void');
  const end = source.indexOf('private resetRound(): void', start);
  const method = source.slice(start, end);
  assert.match(method, /this\.menu\.hidden = false/);
  assert.doesNotMatch(method, /input\[value=/);
});

test('standalone PNG/WebP portraits are bounded assets, not baked UI screens', () => {
  const menu = { innerHTML: '', querySelectorAll: () => [] };
  populateFactionMenu(menu, () => {});
  for (const path of Object.values(UI_PORTRAITS)) {
    const bytes = readFileSync(new URL(`../public${path}`, import.meta.url));
    if (path.endsWith('.png')) {
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes[25], 6, 'portrait PNG must retain RGBA');
      assert.ok(bytes.length < 3_000_000, 'full-body RGBA portrait exceeds asset budget');
    } else {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
      assert.ok(bytes.length < 300_000, 'individual WebP portrait exceeds asset budget');
    }
    if (path === UI_PORTRAITS.DEEPSEEK || path === UI_PORTRAITS.HUMAN) {
      assert.ok(menu.innerHTML.includes(path));
      assert.ok(REPORT_MARKUP.includes(path));
    }
  }
  assert.equal((menu.innerHTML.match(/class="faction-portrait"/g) ?? []).length, 2);
  assert.match(REPORT_MARKUP, /<h1><\/h1><p><\/p><div class="overlay-stats"><\/div>/);
  assert.doesNotMatch(menu.innerHTML, /data:image|<canvas/);
  const hud = readFileSync(new URL('../src/three/AlphaHudView.ts', import.meta.url), 'utf8');
  const pulse = readFileSync(new URL('../src/three/PulseLockView.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(hud + pulse, /<img|UI_PORTRAITS/);
  assert.match(pulse, /dot.style.left =/);
});
