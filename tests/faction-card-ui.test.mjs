import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { populateFactionMenu, UI_PORTRAITS, REPORT_MARKUP } from '../src/three/GameUiLayout.ts';
import { factionMenuFixture } from './helpers/faction-menu.mjs';

test('opening hoodie portrait is the unchanged supplied RGBA artwork; previous Human art stays available', () => {
  const portrait = readFileSync(new URL(`../public${UI_PORTRAITS.HUMAN_MENU}`, import.meta.url));
  assert.equal(createHash('sha256').update(portrait).digest('hex'),
    'b82ade694981139231ed879c251b18080788d359841328ca1f6705099606da5e');
  assert.equal(portrait.readUInt32BE(16), 1024);
  assert.equal(portrait.readUInt32BE(20), 1536);
  assert.equal(portrait[25], 6);
  assert.ok(readFileSync(new URL('../public/assets/ui/portraits/human-guardian-v1.webp', import.meta.url)).length > 0);
});

test('Human report uses the supplied duo artwork unchanged, independently of the opening portrait', () => {
  const portrait = readFileSync(new URL(`../public${UI_PORTRAITS.HUMAN}`, import.meta.url));
  assert.equal(createHash('sha256').update(portrait).digest('hex'),
    'e3cd1ff062348ca132c0da4d54bb0c0b2cb7e8c812ae7937d0b04b89372b5ad8');
  assert.equal(portrait.readUInt32BE(16), 1312);
  assert.equal(portrait.readUInt32BE(20), 1199);
  assert.equal(portrait[25], 6);
  assert.match(REPORT_MARKUP, /class="report-portrait portrait-human"[^>]*width="1312" height="1199"/);
  assert.doesNotMatch(REPORT_MARKUP, /human-guardian-v1/);
});

test('clicking either native faction card starts that faction immediately; reset clears selection', () => {
  const callbacks = [];
  const menu = factionMenuFixture(), buttons = menu.cards;
  const reset = populateFactionMenu(menu, faction => callbacks.push(faction));
  assert.equal((menu.innerHTML.match(/type="button" class="faction-card"/g) ?? []).length, 2);
  assert.doesNotMatch(menu.innerHTML, /menu-start|选择阵营/);
  assert.equal((menu.innerHTML.match(/type="button" class="menu-setting-button"/g) ?? []).length, 2);
  assert.doesNotMatch(menu.innerHTML, /type="radio"|确认阵营/);
  assert.doesNotMatch(menu.innerHTML, /menu-controls|CONTROL \//);
  buttons[0].listeners.click();
  assert.equal(buttons[0].attributes['aria-pressed'], 'true');
  assert.deepEqual(callbacks, ['DEEPSEEK']);
  menu.hidden = true;
  buttons[1].listeners.click();
  assert.deepEqual(callbacks, ['DEEPSEEK']);
  menu.hidden = false; reset();
  assert.ok(buttons.every(b => b.attributes['aria-pressed'] === 'false'));
  buttons[1].listeners.click();
  assert.deepEqual(callbacks, ['DEEPSEEK', 'HUMAN']);
});

test('menu native Space and arrows stop gameplay propagation without suppressing browser defaults', () => {
  const menu = factionMenuFixture(); populateFactionMenu(menu, () => {});
  const stopped = [];
  for (const code of ['Space', 'ArrowRight', 'Escape', 'Tab'])
    menu.listeners.keydown({code, stopPropagation:()=>stopped.push(code), preventDefault:()=>assert.fail('native behavior suppressed')});
  assert.deepEqual(stopped,['Space','ArrowRight']);
  menu.hidden=true; menu.listeners.keydown({code:'Space',stopPropagation:()=>assert.fail('hidden menu intercepted input')});
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
  assert.match(method, /this\.resetMenuSelection\(\)/);
  assert.doesNotMatch(method, /input\[value=/);
});

test('standalone PNG/WebP portraits are bounded assets, not baked UI screens', () => {
  const menu = factionMenuFixture();
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
    if (path === UI_PORTRAITS.DEEPSEEK) {
      assert.ok(menu.innerHTML.includes(path));
      assert.ok(REPORT_MARKUP.includes(path));
    }
  }
  assert.equal((menu.innerHTML.match(/class="faction-portrait"/g) ?? []).length, 2);
  assert.ok(menu.innerHTML.includes(UI_PORTRAITS.HUMAN_MENU));
  assert.ok(!menu.innerHTML.includes(UI_PORTRAITS.HUMAN));
  assert.ok(REPORT_MARKUP.includes(UI_PORTRAITS.HUMAN));
  assert.ok(!REPORT_MARKUP.includes(UI_PORTRAITS.HUMAN_MENU));
  assert.match(REPORT_MARKUP, /<h1><\/h1><p><\/p><div class="overlay-stats"><\/div>/);
  assert.doesNotMatch(menu.innerHTML, /data:image|<canvas/);
  const hud = readFileSync(new URL('../src/three/AlphaHudView.ts', import.meta.url), 'utf8');
  const pulse = readFileSync(new URL('../src/three/PulseLockView.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(hud + pulse, /<img|UI_PORTRAITS/);
  assert.match(pulse, /dot.style.left =/);
});
