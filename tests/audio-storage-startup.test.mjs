import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { GameAudio } from '../src/three/GameAudio.ts';

// Exercise ThreeGame's actual field initializer without constructing WebGL/DOM.
const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
const initializer = source.match(/private readonly audio = ([\s\S]*?);\r?\n  private audioSettings/)[1];
const key = 'who-ate-my-rice-audio-v1';
const denied = () => { throw new DOMException('storage denied', 'SecurityError'); };
function create(descriptor) {
  const context = { GameAudio };
  context.globalThis = context;
  if (descriptor) Object.defineProperty(context, 'localStorage', descriptor);
  // A plain object scope preserves throwing getters; VM global typeof suppresses them.
  return runInNewContext(`with (environment) { ${initializer}; }`, { environment: context });
}

test('ThreeGame audio startup reads and persists normal project storage', () => {
  const values = new Map([[key, JSON.stringify({ master: .37, muted: true })]]);
  const audio = create({ value: { getItem: k => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v) } });
  assert.equal(audio.settings.master, .37);
  assert.equal(audio.settings.muted, true);
  audio.setVolume('master', .61);
  assert.equal(JSON.parse(values.get(key)).master, .61);
});

test('ThreeGame audio startup survives localStorage getter SecurityError', () => {
  const audio = create({ get: denied });
  assert.equal(audio.settings.master, .8);
  audio.setVolume('master', .42);
  assert.equal(audio.settings.master, .42);
});

test('ThreeGame audio startup tolerates rejected getItem without discarding in-memory settings', () => {
  const audio = create({ value: { getItem: denied, setItem() {} } });
  assert.equal(audio.settings.master, .8);
  audio.setVolume('master', .42);
  assert.equal(audio.settings.master, .42);
});

test('ThreeGame audio startup tolerates rejected setItem and preserves loaded settings', () => {
  const audio = create({ value: { getItem: () => JSON.stringify({ master: .37 }), setItem: denied } });
  assert.equal(audio.settings.master, .37);
  audio.setVolume('master', .42);
  assert.equal(audio.settings.master, .42);
});

test('ThreeGame audio startup works when localStorage is absent', () => {
  assert.equal(create().settings.master, .8);
});
