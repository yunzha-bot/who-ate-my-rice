import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';

// Execute the real integration callback; no duplicated focus-policy implementation.
const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const body = source.match(/private onAudioFocus = \(\): void => \{([\s\S]*?)\};/);
assert.ok(body, 'focus callback must be found in actual source');
const onFocus = new Function(body[1]);

test('focus loss pauses a real match once and focus return never resumes it automatically', t => {
  const old = globalThis.document;
  const document = globalThis.document = { hidden: false, hasFocus: () => false };
  t.after(() => { globalThis.document = old; });
  const match = new GameStateSystem(0, 350); match.advanceReady(0);
  let pauses = 0, audioSyncs = 0;
  const game = { match, devFreeze: { isFrozen: false },
    togglePause() { pauses++; match.pause(); }, syncAudio() { audioSyncs++; } };
  onFocus.call(game);
  assert.equal(match.phase, 'PAUSED'); assert.equal(pauses, 1);
  onFocus.call(game); document.hasFocus = () => true; onFocus.call(game);
  assert.equal(match.phase, 'PAUSED'); assert.equal(pauses, 1); assert.equal(audioSyncs, 3);
});

test('focus handling preserves menu, READY, results and DEV editor/freeze sessions', t => {
  const old = globalThis.document;
  globalThis.document = { hidden: true, hasFocus: () => false };
  t.after(() => { globalThis.document = old; });
  for (const phase of ['FACTION_SELECT', 'READY', 'FINISHED']) {
    const match = new GameStateSystem(3000, 350, phase);
    onFocus.call({ match, devFreeze: { isFrozen: false },
      togglePause() { assert.fail('must not change this phase'); }, syncAudio() {} });
    assert.equal(match.phase, phase);
  }
  for (const state of [{ sceneEditor: { isOpen: true }, devFreeze: { isFrozen: false } },
    { sceneEditor: null, devFreeze: { isFrozen: true } }]) {
    const match = new GameStateSystem(0, 350); match.advanceReady(0);
    onFocus.call({ match, ...state, togglePause() { assert.fail('DEV session is already frozen'); }, syncAudio() {} });
    assert.equal(match.phase, 'PLAYING');
  }
});
