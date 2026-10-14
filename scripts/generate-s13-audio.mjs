// Original, deterministic S13 audio. Requires ffmpeg only when regenerating assets.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rate = 22050;
const output = new URL('../public/assets/audio/', import.meta.url);
const tmp = mkdtempSync(join(tmpdir(), 'rice-s13-audio-'));
const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
mkdirSync(output, { recursive: true });
let seed = 74131;
const rand = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const tone = (freq, t, kind = 'sine') => kind === 'triangle'
  ? 2 / Math.PI * Math.asin(Math.sin(2 * Math.PI * freq * t))
  : Math.sin(2 * Math.PI * freq * t);

function wav(samples) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return data;
}

function synth(duration, render) {
  const samples = new Float32Array(Math.ceil(duration * rate));
  for (let i = 0; i < samples.length; i++) samples[i] = render(i / rate, i) * .72;
  return samples;
}

const cues = {
  hover: [.085, 660, 760], click: [.14, 420, 680], back: [.18, 560, 350],
  confirm: [.28, 520, 800], error: [.24, 320, 205], countdown: [.2, 520, 520],
  countdownLast: [.32, 650, 850], start: [.48, 440, 900],
  eatStart: [.25, 350, 540], eatLoop: [.58, 250, 330], eatInterrupt: [.22, 390, 180],
  eatComplete: [.52, 430, 920],
  doorLock: [.22, 380, 160], doorUnlock: [.29, 220, 540], doorFail: [.23, 170, 95],
  pulseInput: [.11, 590, 590], pulseCorrect: [.18, 600, 790],
  pulseWrong: [.25, 310, 150], pulseSuccess: [.48, 540, 1060],
  skill: [.4, 380, 740], skillUnavailable: [.2, 250, 180], skillReady: [.25, 540, 710],
  hideEnter: [.32, 190, 115], hideExit: [.31, 160, 300], search: [.4, 260, 410],
  capture: [.42, 210, 95], caught: [.54, 360, 105],
  fall: [.46, 160, 55], stun: [.36, 190, 140], recover: [.26, 340, 660],
  victory: [.85, 440, 880], defeat: [.8, 390, 180], restart: [.28, 330, 590],
};

function cue(name, duration, from, to) {
  return synth(duration, t => {
    const p = t / duration;
    const envelope = Math.min(1, t * 95) * (1 - p) ** (name === 'eatLoop' ? 1 : 1.8);
    const f = from + (to - from) * p;
    const body = tone(f, t, 'triangle') * .45 + tone(f * 1.5, t) * .13;
    const rough = ['fall', 'eatLoop', 'search']
      .includes(name) ? rand() * .20 * (1 - p) : 0;
    const wobble = name === 'eatLoop' ? .68 + .32 * Math.sin(t * 28) ** 2 : 1;
    return (body + rough) * envelope * wobble;
  });
}

function music(kind, duration, bpm, notes) {
  const beat = 60 / bpm;
  return synth(duration, t => {
    const n = Math.floor(t / beat) % notes.length;
    const within = (t % beat) / beat;
    const base = 220 * 2 ** (notes[n] / 12);
    const pluck = Math.exp(-within * 6) * tone(base, t, 'triangle') * .18;
    const bass = tone(base / 4, t, 'triangle') * .09;
    const tick = kind === 'chase' ? rand() * Math.exp(-within * 18) * .075 : 0;
    return (pluck + bass + tick) * Math.min(1, t * 3) * Math.min(1, (duration - t) * 3);
  });
}

const files = new Map(Object.entries(cues).map(([name, [d, a, b]]) => [name, cue(name, d, a, b)]));
files.set('menu', music('menu', 16, 112, [0, 4, 7, 9, 7, 4, 2, 4]));
files.set('game', music('game', 16, 88, [0, 3, 7, 3, 2, 5, 7, 5]));
files.set('chase', music('chase', 12, 138, [0, 3, 5, 7, 5, 3, 2, 3]));
files.set('room', synth(8, t => rand() * .009 + tone(65, t) * .003));

try {
  for (const [name, samples] of files) {
    const input = join(tmp, `${name}.wav`);
    writeFileSync(input, wav(samples));
    const target = fileURLToPath(new URL(`${name}.ogg`, output));
    const result = spawnSync(ffmpeg, ['-loglevel', 'error', '-y', '-i', input,
      '-c:a', 'libvorbis', '-q:a', '3', target], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${name}: ${result.stderr || result.error}`);
    if (readFileSync(target).length < 100) throw new Error(`${name}: empty output`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`Generated ${files.size} original Ogg/Vorbis assets`);
