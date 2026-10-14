/** S13 audible presentation. Never feeds back into AI perception or gameplay. */
export const AUDIO_CUES = [
  'hover', 'click', 'back', 'confirm', 'error', 'countdown', 'countdownLast', 'start',
  'step', 'sprintStep', 'sprintStart', 'eatStart', 'eatLoop', 'eatInterrupt', 'eatComplete',
  'doorOpen', 'doorClose', 'doorLock', 'doorUnlock', 'doorFail',
  'pulseInput', 'pulseCorrect', 'pulseWrong', 'pulseSuccess',
  'skill', 'skillUnavailable', 'skillReady', 'hideEnter', 'hideExit', 'search',
  'capture', 'caught', 'fall', 'stun', 'recover', 'victory', 'defeat', 'restart',
  'menu', 'game', 'chase', 'room',
] as const;
export type AudioCue = typeof AUDIO_CUES[number];
/** Kept as event IDs for future replacement, but no asset is requested or played. */
export const DISABLED_AUDIO_CUES: readonly AudioCue[] = [
  'step', 'sprintStep', 'sprintStart', 'doorOpen', 'doorClose',
];
export type AudioBus = 'master' | 'bgm' | 'sfx' | 'ui' | 'ambience';
export type MusicCue = 'menu' | 'game' | 'chase' | null;
export type AudioSettings = Record<AudioBus, number> & { muted: boolean };

const STORAGE_KEY = 'who-ate-my-rice-audio-v1';
const DEFAULTS: AudioSettings = { master: .8, bgm: .45, sfx: .8, ui: .6,
  ambience: .25, muted: false };
const BUSES: AudioBus[] = ['master', 'bgm', 'sfx', 'ui', 'ambience'];
const MIN_GAP_MS: Partial<Record<AudioCue, number>> = {
  hover: 90, step: 95, sprintStep: 75, eatLoop: 170, doorFail: 150,
  skillUnavailable: 170, error: 150,
};
const MAX_VOICES: Partial<Record<AudioCue, number>> = {
  hover: 1, step: 2, sprintStep: 2, eatLoop: 1,
};

export function sanitizeAudioSettings(value: unknown): AudioSettings {
  const data = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...DEFAULTS, muted: data.muted === true };
  for (const bus of BUSES) {
    const n = data[bus];
    if (typeof n === 'number' && Number.isFinite(n)) result[bus] = Math.max(0, Math.min(1, n));
  }
  return result;
}

/** Audiovisual range is deliberately short and independent of AI hearing range. */
export function worldAudioGain(distance: number, occlusion: number): number {
  if (!Number.isFinite(distance) || distance >= 11) return 0;
  return Math.max(0, (1 - distance / 11) ** 2 * Math.max(0, Math.min(1, occlusion)));
}

export class GameAudio {
  settings: AudioSettings;
  private context: AudioContext | null = null;
  private gains = new Map<AudioBus, GainNode>();
  private buffers = new Map<AudioCue, AudioBuffer>();
  private pending = new Map<AudioCue, Promise<AudioBuffer | null>>();
  private failed = new Set<AudioCue>();
  private lastPlayed = new Map<AudioCue, number>();
  private voices = new Map<AudioCue, number>();
  private shots = new Set<AudioBufferSourceNode>();
  private musicSerial = 0;
  private loops = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }>();
  private wantedLoops = new Set<string>();
  private loopSerial = new Map<string, number>();
  private generation = 0;
  private music: MusicCue = null;
  private suspended = false;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null = null) {
    this.storage = storage;
    let saved: unknown;
    try { saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'); } catch { saved = null; }
    this.settings = sanitizeAudioSettings(saved);
  }

  get active(): boolean { return this.context?.state === 'running' && !this.suspended; }
  get currentMusic(): MusicCue { return this.music; }

  async unlock(): Promise<void> {
    if (this.context) {
      try {
        if (!this.suspended) await this.context.resume();
        if (this.music && !this.loops.has('music')) {
          const desired = this.music;
          this.music = null; this.setMusic(desired);
        }
      } catch { /* autoplay blocked */ }
      return;
    }
    try {
      this.context = new AudioContext();
      const master = this.context.createGain();
      master.connect(this.context.destination);
      this.gains.set('master', master);
      for (const bus of BUSES.slice(1)) {
        const gain = this.context.createGain();
        gain.connect(master);
        this.gains.set(bus, gain);
      }
      this.applySettings();
      if (!this.suspended) await this.context.resume();
      const selectedMusic = this.music;
      this.music = null;
      this.setMusic(selectedMusic);
      // First gesture prepares only imminent UI/game cues; the rest load on demand.
      void Promise.all(['click', 'countdown', 'start', 'game', 'menu', 'room']
        .map(cue => this.load(cue as AudioCue)));
    } catch { this.context = null; this.gains.clear(); }
  }

  setVolume(bus: AudioBus, volume: number): void {
    this.settings[bus] = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
    this.save();
  }
  setMuted(muted: boolean): void { this.settings.muted = muted; this.save(); }
  resetSettings(): void { this.settings = { ...DEFAULTS }; this.save(); }
  private save(): void {
    this.applySettings();
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.settings)); } catch { /* private mode */ }
  }
  private applySettings(): void {
    for (const bus of BUSES) {
      const gain = this.gains.get(bus);
      if (gain) gain.gain.value = bus === 'master' && this.settings.muted
        ? 0 : this.settings[bus];
    }
  }

  private load(cue: AudioCue): Promise<AudioBuffer | null> {
    if (this.failed.has(cue)) return Promise.resolve(null);
    if (this.buffers.has(cue)) return Promise.resolve(this.buffers.get(cue)!);
    if (this.pending.has(cue)) return this.pending.get(cue)!;
    const task = fetch(`${import.meta.env.BASE_URL}assets/audio/${cue}.ogg`)
      .then(response => {
        if (!response.ok) throw new Error(`audio ${cue}: HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then(bytes => this.context?.decodeAudioData(bytes) ?? null)
      .then(buffer => { if (buffer) this.buffers.set(cue, buffer); return buffer; })
      .catch(() => { this.failed.add(cue); return null; })
      .finally(() => this.pending.delete(cue));
    this.pending.set(cue, task);
    return task;
  }

  play(cue: AudioCue, bus: Exclude<AudioBus, 'master'> = 'sfx', level = 1): void {
    if (DISABLED_AUDIO_CUES.includes(cue)) return;
    if (!this.active || !this.context || this.settings.muted || level <= 0) return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(cue) ?? -Infinity) < (MIN_GAP_MS[cue] ?? 25)) return;
    if ((this.voices.get(cue) ?? 0) >= (MAX_VOICES[cue] ?? 3)) return;
    this.lastPlayed.set(cue, now);
    const generation = this.generation;
    void this.load(cue).then(buffer => {
      if (!buffer || generation !== this.generation || !this.active || !this.context ||
          (this.voices.get(cue) ?? 0) >= (MAX_VOICES[cue] ?? 3)) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = .965 + Math.random() * .07;
      gain.gain.value = Math.max(0, Math.min(1, level)) * (.94 + Math.random() * .12);
      source.connect(gain).connect(this.gains.get(bus)!);
      this.voices.set(cue, (this.voices.get(cue) ?? 0) + 1);
      this.shots.add(source);
      source.onended = () => {
        this.shots.delete(source); source.disconnect(); gain.disconnect();
        this.voices.set(cue, Math.max(0, (this.voices.get(cue) ?? 1) - 1));
      };
      source.start();
    });
  }

  loop(key: string, cue: AudioCue, bus: Exclude<AudioBus, 'master'>, level = 1): void {
    if (DISABLED_AUDIO_CUES.includes(cue)) return;
    if (this.wantedLoops.has(key) || !this.active || !this.context) return;
    this.wantedLoops.add(key);
    const serial = (this.loopSerial.get(key) ?? 0) + 1;
    this.loopSerial.set(key, serial);
    const generation = this.generation;
    void this.load(cue).then(buffer => {
      if (!buffer || generation !== this.generation || !this.active || !this.context ||
          !this.wantedLoops.has(key) || this.loopSerial.get(key) !== serial) {
        if (this.loopSerial.get(key) === serial) this.wantedLoops.delete(key);
        return;
      }
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.value = Math.max(0, Math.min(1, level));
      source.connect(gain).connect(this.gains.get(bus)!);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      this.loops.set(key, { source, gain });
    });
  }

  setLoopLevel(key: string, level: number): void {
    const loop = this.loops.get(key);
    if (loop) loop.gain.gain.value = Math.max(0, Math.min(1, level));
  }

  stop(key: string, fade = .12): void {
    this.wantedLoops.delete(key);
    this.loopSerial.set(key, (this.loopSerial.get(key) ?? 0) + 1);
    const loop = this.loops.get(key);
    if (!loop || !this.context) return;
    this.loops.delete(key);
    const now = this.context.currentTime;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0, now + fade);
    try { loop.source.stop(now + fade + .02); } catch { /* already ended */ }
  }

  setMusic(next: MusicCue): void {
    if (next === this.music) return;
    if (this.music) this.stop('music', .45);
    this.music = next;
    const serial = ++this.musicSerial;
    if (!next || !this.active || !this.context) return;
    const cue = next;
    const generation = this.generation;
    void this.load(cue).then(buffer => {
      if (!buffer || generation !== this.generation || serial !== this.musicSerial || this.music !== cue ||
          !this.active || !this.context) return;
      const source = this.context.createBufferSource();
      const gain = this.context.createGain();
      source.buffer = buffer; source.loop = true;
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(cue === 'chase' ? .55 : .75,
        this.context.currentTime + .55);
      source.connect(gain).connect(this.gains.get('bgm')!);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
      this.loops.set('music', { source, gain });
    });
  }

  async setSuspended(value: boolean): Promise<void> {
    this.suspended = value;
    if (!this.context) return;
    try {
      if (value) {
        for (const source of this.shots) {
          try { source.stop(); } catch { /* already ended */ }
        }
        this.shots.clear();
        this.voices.clear();
        await this.context.suspend();
      }
      else {
        await this.context.resume();
        if (this.music && !this.loops.has('music')) {
          const desired = this.music;
          this.music = null;
          this.setMusic(desired);
        }
      }
    }
    catch { /* browser policy */ }
  }

  reset(): void {
    this.generation++;
    this.musicSerial++;
    for (const source of this.shots) {
      try { source.stop(); } catch { /* already ended */ }
    }
    this.wantedLoops.clear();
    for (const key of [...this.loops.keys()]) this.stop(key, .05);
    this.music = null;
    this.lastPlayed.clear();
  }

  dispose(): void {
    this.reset();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
