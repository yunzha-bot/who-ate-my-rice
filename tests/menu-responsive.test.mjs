import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { populateFactionMenu } from '../src/three/GameUiLayout.ts';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('faction cards reserve separate flow regions for identity, portrait and caption', () => {
  const menu = { innerHTML: '', querySelectorAll: () => [] };
  populateFactionMenu(menu, () => {});
  assert.match(menu.innerHTML, /<header class="menu-topbar">/);
  assert.match(menu.innerHTML, /class="menu-audio-slot menu-setting-panel"/);
  assert.match(menu.innerHTML, /<aside class="menu-settings"/);
  assert.match(menu.innerHTML, /class="menu-difficulty-slot menu-setting-panel"/);
  for (const region of ['faction-main', 'faction-identity', 'faction-description', 'faction-caption']) {
    assert.equal(menu.innerHTML.split(`class="${region}"`).length - 1, 2);
  }
  assert.ok(menu.innerHTML.indexOf('menu-topbar') < menu.innerHTML.indexOf('faction-dock'));
});

test('menu layout has a single stylesheet owner, rather than four competing cascades', () => {
  for (const path of ['src/style.css', 'src/industrial-ui.css', 'src/s13-ui.css', 'src/game-ui.css']) {
    const rules = read(path).replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(rules, /\.(?:faction-menu|faction-dock|faction-card|difficulty-select|difficulty-card|menu-credits)(?![\w-])/);
  }
  const main = read('src/main.ts');
  assert.ok(main.indexOf("import './faction-menu.css'") > main.indexOf("import './game-ui.css'"));
});

test('short and narrow menus scroll and reflow instead of positioning primary controls', () => {
  const css = read('src/faction-menu.css');
  assert.match(css, /overflow-y: auto; overflow-x: hidden/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.difficulty-select \{ grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(css, /!important|\b(?:vh|dvh)\b[^;]*min-height|transform:\s*scale/);
  for (const region of ['menu-topbar', 'faction-dock', 'difficulty-select', 'menu-credits', 'faction-caption']) {
    const declarations = [...css.matchAll(new RegExp(`\\.${region}\\s*\\{([^}]+)\\}`, 'g'))];
    assert.ok(declarations.length > 0);
    for (const [, body] of declarations) assert.doesNotMatch(body, /position:\s*(absolute|fixed)|transform:/);
  }
});

test('one shared audio settings view stays in the home setting slot or existing pause overlay', () => {
  const source = read('src/three/ThreeGame.ts');
  assert.match(source, /phase === 'PAUSED' \? this\.overlay : this\.menu\.querySelector\('\.menu-audio-slot'\)!/);
  assert.equal((source.match(/new AudioSettingsView\(/g) ?? []).length, 1);
});

test('home setting panels bound their height and scroll on short windows', () => {
  const source = read('src/faction-menu.css');
  assert.match(source, /max-height: min\(520px, 65dvh\)/);
  assert.match(source, /overflow-y: auto; overscroll-behavior: contain/);
});
