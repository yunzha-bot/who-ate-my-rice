import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {populateFactionMenu} from '../src/three/GameUiLayout.ts';
import {factionMenuFixture} from './helpers/faction-menu.mjs';
const css=readFileSync(new URL('../src/opening-menu.css',import.meta.url),'utf8');

test('six independent transparent paper skins are small real WebP assets, never baked labels',()=>{
  for(const name of ['name-deepseek','name-human','role-deepseek','role-human','slogan-deepseek','slogan-human']){
    const bytes=readFileSync(new URL(`../public/assets/ui/menu/labels/${name}.webp`,import.meta.url));
    assert.equal(bytes.toString('ascii',0,4),'RIFF'); assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.equal(bytes.toString('ascii',12,16),'VP8X'); assert.ok(bytes[20]&0x10,'paper edges must retain alpha');
    assert.ok(bytes.length<150000); assert.ok(css.includes(`/assets/ui/menu/labels/${name}.webp`));
  }
});

test('name, identity and slogan text stays in DOM; paper is a separate non-intercepting layer',()=>{
  const menu=factionMenuFixture(); populateFactionMenu(menu,()=>{});
  for(const text of ['DeepSeek 娘','Human','干饭人','屋主人','就吃亿口！','大米保卫战！']) assert.ok(menu.innerHTML.includes(text));
  for(const [,body]of css.matchAll(/\.faction-(?:copy\s+(?:strong|small)|description\s+b)\s*\{([^}]+)\}/g))
    assert.doesNotMatch(body,/background(?:-color)?:\s*#/,'plain rectangular label fill must not return');
  assert.match(css,/background: var\(--label-paper\) center \/ 100% 100% no-repeat/);
  assert.match(css,/inset: var\(--label-paper-inset/);
  assert.match(css,/var\(--label-paper-x/); assert.match(css,/var\(--label-paper-angle/);
  const paper=css.slice(css.indexOf('.faction-copy strong::before'),css.indexOf('.faction-copy strong { --label-paper'));
  assert.match(paper,/pointer-events: none/); assert.match(paper,/z-index: -1/);
});

test('caption paper sits behind the unchanged character layer, preserving reference overlap',()=>{
  assert.match(css,/\.faction-caption \{ position: absolute; z-index: 0;/);
  assert.match(css,/\.faction-portrait \{[^}]*z-index: 1;/);
  assert.match(css,/\.faction-copy small \{[^}]*color: #fff8e9/);
  assert.match(css,/HUMAN'\] \.faction-copy small \{[^}]*color: #24343b/);
});
