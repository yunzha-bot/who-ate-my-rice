import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

// Execute the real delegated handler without booting WebGL or duplicating it.
const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const handler = source.match(/  private onAudioHover =[\s\S]*?\n  };/)?.[0];
assert.ok(handler, 'ThreeGame must expose its existing hover handler');

class DomNode {
  constructor(parent = null, button = false) { this.parent = parent; this.button = button; }
  closest(selector) {
    assert.equal(selector, 'button');
    return this.button ? this : this.parent?.closest(selector) ?? null;
  }
  contains(node) {
    for (let current = node; current; current = current.parent) if (current === this) return true;
    return false;
  }
}

const Harness = runInNewContext(stripTypeScriptTypes(`class HoverHarness { ${handler} };
HoverHarness;`), { Node: DomNode });

function fixture() {
  const game = new Harness(), calls = [];
  game.audio = { play: (...args) => calls.push(args) };
  const outside = new DomNode(), deepseek = new DomNode(null, true), human = new DomNode(null, true);
  const parts = card => Array.from({ length: 6 }, () => new DomNode(card));
  return { game, calls, outside, deepseek, human, deepseekParts: parts(deepseek), humanParts: parts(human) };
}

test('one card entry plays once; child transitions never retrigger even without audio cooldown', () => {
  const { game, calls, outside, deepseek, deepseekParts: parts } = fixture();
  game.onAudioHover({ target: parts[0], relatedTarget: outside });
  // Number, portrait, title, description, arrow and the card surface are one boundary.
  let previous = parts[0];
  for (let i = 0; i < 100; i++) {
    const target = [...parts, deepseek][i % 7];
    game.onAudioHover({ target, relatedTarget: previous }); previous = target;
  }
  assert.deepEqual(calls, [['hover', 'ui', .45]]);
});

test('leaving and reentering either card permits one new hover; two cards are independent', () => {
  const { game, calls, outside, deepseekParts: d, humanParts: h } = fixture();
  for (const [target, relatedTarget] of [[d[0], outside], [d[5], d[0]], [h[0], d[5]],
    [h[5], h[0]], [d[0], h[5]], [outside, d[0]], [d[0], outside],
    [outside, d[0]], [h[0], outside]]) game.onAudioHover({ target, relatedTarget });
  assert.equal(calls.length, 5);
});

test('null or non-Node origins are valid entries, and non-button targets stay silent', () => {
  const { game, calls, outside, deepseek } = fixture();
  for (const relatedTarget of [null, {}]) game.onAudioHover({ target: deepseek, relatedTarget });
  game.onAudioHover({ target: outside, relatedTarget: deepseek });
  assert.equal(calls.length, 2);
});
