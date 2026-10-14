import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMenuCredits } from '../src/three/MenuCreditsView.ts';

test('menu credits uses supplied version and native modal without altering faction controls', () => {
  const previous = globalThis.document;
  const created = [];
  function element(tag) {
    const e = { tag, innerHTML: '', listeners: {}, attributes: {}, children: [],
      addEventListener(name, fn) { this.listeners[name] = fn; },
      setAttribute(name, value) { this.attributes[name] = value; },
      querySelector(selector) { return this.children[selector] ??= element(selector); },
      showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); },
      focus() { this.focused = true; },
    };
    return e;
  }
  globalThis.document = { createElement(tag) { const e = element(tag); created.push(e); return e; } };
  try {
    const appended = [];
    mountMenuCredits({ append(...nodes) { appended.push(...nodes); } }, '0.1.0');
    const [footer, dialog] = appended;
    assert.equal(footer.querySelector('.menu-version').textContent, 'v0.1.0');
    assert.match(footer.innerHTML, /个人独立开发的非官方游戏作品/);
    assert.match(dialog.innerHTML, /云扎/);
    assert.match(dialog.innerHTML, /https:\/\/github.com\/yunzha-bot\/who-ate-my-rice/);
    assert.doesNotMatch(dialog.innerHTML, /@|checkbox|ARKNIGHTS/);
    assert.equal(dialog.attributes['aria-labelledby'], 'menu-credits-title');
    footer.querySelector('button').listeners.click();
    assert.equal(dialog.open, true);
    let stopped = 0;
    dialog.listeners.keydown({ stopPropagation() { stopped++; } });
    dialog.listeners.keyup({ stopPropagation() { stopped++; } });
    assert.equal(stopped, 2);
    dialog.querySelector('button').listeners.click();
    assert.equal(dialog.open, false);
    assert.equal(footer.querySelector('button').focused, true);
    assert.equal(created.length, 2);
  } finally { globalThis.document = previous; }
});
