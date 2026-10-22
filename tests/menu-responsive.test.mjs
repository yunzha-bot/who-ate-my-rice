import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { populateFactionMenu } from '../src/three/GameUiLayout.ts';
import { factionMenuFixture } from './helpers/faction-menu.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('faction cards retain separate identity, original portrait and caption layers', () => {
  const menu = factionMenuFixture();
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
  assert.ok(main.indexOf("import './opening-menu.css'") > main.indexOf("import './game-ui.css'"));
  assert.doesNotMatch(main, /import '.\/faction-menu.css'/);
});

test('reference menu keeps its static layout; optional opening motion is scoped and accessible', () => {
  const css = read('src/opening-menu.css');
  assert.match(css, /overflow-y: auto; overflow-x: hidden/);
  assert.match(css, /grid-template-columns: minmax\(0, 1.1fr\) minmax\(0, 1fr\)/);
  assert.match(css, /object-fit: contain/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\); gap: 64px/);
  const interaction = css.slice(css.indexOf('/* Only opening interactions;'));
  assert.doesNotMatch(css.slice(0,css.indexOf('/* Only opening interactions;')), /animation:|transition:|@keyframes/);
  assert.match(interaction, /\.faction-menu\[data-menu-interaction\]/);
  assert.match(interaction, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(interaction, /animation: none; transition: none; translate: none; scale: none/);
  assert.doesNotMatch(css, /!important|\b(?:vh|dvh)\b[^;]*min-height|transform:\s*scale/);
  for (const region of ['menu-topbar', 'faction-dock', 'difficulty-select', 'menu-credits', 'menu-start-row']) {
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
  const source = read('src/opening-menu.css');
  assert.match(source, /max-height: min\(520px, 65dvh\)/);
  assert.match(source, /overflow-y: auto; overscroll-behavior: contain/);
});
