import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { AUDIO_CUES, DISABLED_AUDIO_CUES, sanitizeAudioSettings, worldAudioGain, GameAudio }
  from '../src/three/GameAudio.ts';

test('active S13 cues have Ogg assets; rejected cues have none', () => {
  assert.equal(new Set(AUDIO_CUES).size, AUDIO_CUES.length);
  assert.deepEqual(DISABLED_AUDIO_CUES, ['step', 'sprintStep', 'sprintStart', 'doorOpen', 'doorClose']);
  for (const cue of AUDIO_CUES) {
    const file = new URL(`../public/assets/audio/${cue}.ogg`, import.meta.url);
    if (DISABLED_AUDIO_CUES.includes(cue)) {
      assert.equal(existsSync(file), false, cue);
      continue;
    }
    assert.equal(readFileSync(file).subarray(0, 4).toString(), 'OggS', cue);
    assert.ok(statSync(file).size > 100, cue);
  }
});

test('settings clamp and persist without requiring the browser audio context', () => {
  const values = new Map([['who-ate-my-rice-audio-v1',
    JSON.stringify({ master: 2, bgm: -.5, muted: true })]]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const audio = new GameAudio(storage);
  assert.equal(audio.settings.master, 1);
  assert.equal(audio.settings.bgm, 0);
  assert.equal(audio.settings.muted, true);
  audio.setVolume('sfx', .32);
  assert.equal(JSON.parse(values.get('who-ate-my-rice-audio-v1')).sfx, .32);
  assert.equal(sanitizeAudioSettings({ ui: NaN }).ui, .6);
});

test('world sound is local and attenuated by existing occlusion', () => {
  assert.equal(worldAudioGain(12, 1), 0);
  assert.equal(worldAudioGain(0, 0), 0);
  assert.ok(worldAudioGain(2, .5) < worldAudioGain(2, 1));
  assert.ok(worldAudioGain(8, 1) < worldAudioGain(2, 1));
});

function audioFixture() {
  const sources = [];
  const param = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
  const context = {
    state: 'running', currentTime: 0,
    createGain: () => ({ gain: { ...param }, connect() { return this; }, disconnect() {} }),
    createBufferSource() {
      const source = { playbackRate: { value: 1 }, connect() { return this; },
        disconnect() {}, start() { this.started = true; },
        stop() { this.stopped = true; this.onended?.(); } };
      sources.push(source); return source;
    },
    async suspend() { this.state = 'suspended'; },
    async resume() { this.state = 'running'; },
  };
  const audio = new GameAudio();
  audio.context = context;
  for (const bus of ['master', 'bgm', 'sfx', 'ui', 'ambience']) audio.gains.set(bus, context.createGain());
  return { audio, sources };
}

test('rejected footsteps, sprint and door cues never load or play', async () => {
  const { audio, sources } = audioFixture();
  for (const cue of DISABLED_AUDIO_CUES) {
    audio.play(cue);
    audio.loop(cue, cue, 'sfx');
  }
  await Promise.resolve();
  assert.equal(sources.length, 0);
  assert.equal(audio.pending.size, 0);
  assert.equal(audio.wantedLoops.size, 0);
});

test('restore defaults updates all live gains and persisted settings', () => {
  const { audio } = audioFixture();
  audio.setMuted(true); audio.setVolume('bgm', 0); audio.resetSettings();
  assert.deepEqual(audio.settings, sanitizeAudioSettings(null));
  for (const bus of ['master', 'bgm', 'sfx', 'ui', 'ambience'])
    assert.equal(audio.gains.get(bus).gain.value, audio.settings[bus]);
});

test('rapid music changes cannot resurrect pending obsolete music or duplicate a loop', async () => {
  const { audio, sources } = audioFixture();
  let resolve;
  audio.pending.set('menu', new Promise(r => { resolve = r; }));
  audio.buffers.set('game', {});
  audio.setMusic('menu'); audio.setMusic('game'); audio.setMusic('menu');
  resolve({}); await Promise.resolve(); await Promise.resolve();
  assert.equal(sources.filter(source => source.started).length, 1);
  assert.equal(audio.loops.size, 1);
});

test('round reset stops one-shots and rejects late decoded sounds', async () => {
  const { audio, sources } = audioFixture();
  audio.buffers.set('victory', {});
  audio.play('victory'); await Promise.resolve();
  let resolve;
  audio.pending.set('defeat', new Promise(r => { resolve = r; }));
  audio.play('defeat'); audio.reset(); resolve({}); await Promise.resolve();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].stopped, true);
});

test('pause stops a short sound instead of replaying its tail on resume', async () => {
  const { audio, sources } = audioFixture();
  audio.buffers.set('doorLock', {});
  audio.play('doorLock'); await Promise.resolve();
  assert.equal(sources.length, 1);
  await audio.setSuspended(true);
  assert.equal(sources[0].stopped, true);
  assert.equal(audio.shots.size, 0);
  await audio.setSuspended(false);
  assert.equal(audio.voices.get('doorLock') ?? 0, 0);
});

test('loop decoded while suspended can be started after resume without getting stuck', async () => {
  const { audio, sources } = audioFixture();
  let resolve;
  audio.pending.set('room', new Promise(r => { resolve = r; }));
  audio.loop('room', 'room', 'ambience'); await audio.setSuspended(true);
  resolve({}); await Promise.resolve();
  audio.pending.delete('room'); audio.buffers.set('room', {});
  await audio.setSuspended(false); audio.loop('room', 'room', 'ambience');
  await Promise.resolve(); assert.equal(sources.length, 1);
});

test('pending repeated sounds still obey concurrency limit after decode', async () => {
  const { audio, sources } = audioFixture();
  let resolve;
  audio.pending.set('hover', new Promise(r => { resolve = r; }));
  audio.play('hover'); audio.lastPlayed.clear(); audio.play('hover');
  resolve({}); await Promise.resolve();
  assert.equal(sources.length, 1);
});
