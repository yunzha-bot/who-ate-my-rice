import { GameAudio, type AudioBus } from './GameAudio';

const LABELS: Record<AudioBus, string> = {
  master: '主音量 Master', bgm: '背景音乐 BGM', sfx: '游戏音效 SFX', ui: '界面音效 UI', ambience: '环境音 Ambience',
};

export class AudioSettingsView {
  readonly root = document.createElement('details');

  constructor(parent: HTMLElement, audio: GameAudio, onBack?: () => void) {
    this.root.className = 'audio-settings';
    this.root.addEventListener('keydown', event => {
      if (event.target instanceof HTMLInputElement &&
          (event.code.startsWith('Arrow') || ['Home', 'End', 'Space'].includes(event.code))) {
        // Keep native slider/checkbox keyboard behavior out of gameplay input.
        event.stopPropagation();
        void audio.unlock();
      }
    });
    const summary = document.createElement('summary');
    summary.textContent = '声音设置';
    this.root.append(summary);
    const refresh: Array<() => void> = [];
    for (const bus of Object.keys(LABELS) as AudioBus[]) {
      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = LABELS[bus];
      const range = document.createElement('input');
      range.type = 'range'; range.min = '0'; range.max = '100';
      range.step = '1';
      range.value = String(Math.round(audio.settings[bus] * 100));
      range.setAttribute('aria-label', LABELS[bus]);
      const value = document.createElement('output');
      const sync = () => { range.value = String(Math.round(audio.settings[bus] * 100)); value.textContent = `${range.value}%`; };
      refresh.push(sync); sync();
      range.addEventListener('input', () => { audio.setVolume(bus, Number(range.value) / 100); sync(); });
      label.append(name, range, value);
      this.root.append(label);
    }
    const mute = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = audio.settings.muted;
    box.setAttribute('aria-label', '总静音');
    refresh.push(() => { box.checked = audio.settings.muted; });
    box.addEventListener('change', () => audio.setMuted(box.checked));
    mute.append('总静音', box);
    this.root.append(mute);
    const reset = document.createElement('button');
    reset.type = 'button'; reset.textContent = '恢复默认音量';
    reset.addEventListener('click', () => { audio.resetSettings(); refresh.forEach(sync => sync()); });
    const back = document.createElement('button');
    back.type = 'button'; back.textContent = '返回暂停菜单'; back.className = 'audio-settings-back';
    back.addEventListener('click', () => onBack?.());
    this.root.append(reset, back);
    parent.append(this.root);
  }

  dispose(): void { this.root.remove(); }
}
