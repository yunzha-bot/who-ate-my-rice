import type { PulseLockEntry, PulseLockSettings } from '../systems/PulseLockSystem.ts';

/** Stable DOM projection of the active timing lock; no gameplay decisions live here. */
export class PulseLockView {
  readonly root: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly rows: HTMLElement[] = [];
  private readonly dots: HTMLElement[] = [];
  private readonly centers: readonly number[];
  private readonly targetWidth: number;

  constructor(container: HTMLElement, settings: PulseLockSettings, onClose: () => void) {
    this.centers = settings.targetCenters;
    this.targetWidth = settings.targetWidth;
    const root = document.createElement('section');
    root.className = 'pulse-lock';
    root.setAttribute('aria-label', '门锁破解');
    root.hidden = true;
    root.innerHTML = '<header class="pulse-lock-header"><span>PULSE LOCK</span>' +
      '<button type="button" class="pulse-lock-close" aria-label="退出破解">×</button></header>' +
      '<div class="pulse-lock-progress"></div>' +
      '<div class="pulse-lock-rows"></div>' +
      '<p class="pulse-lock-help">光点进入框里时按 <kbd>E</kbd><span class="controls-help-touch">手机：点右侧“点按解锁”按钮</span></p>';
    root.querySelector('button')!.addEventListener('click', onClose);
    this.progress = root.querySelector('.pulse-lock-progress')!;
    const tracks = root.querySelector('.pulse-lock-rows')!;
    for (let index = 0; index < settings.coreCount; index += 1) {
      const row = document.createElement('div');
      row.className = 'pulse-lock-row';
      row.innerHTML = `<span class="pulse-lock-index">${String(index + 1).padStart(2, '0')}</span>` +
        '<div class="pulse-lock-track"><span class="pulse-lock-window"></span>' +
        '<span class="pulse-lock-dot"></span></div><span class="pulse-lock-done">✓</span>';
      const window = row.querySelector<HTMLElement>('.pulse-lock-window')!;
      window.style.left = `${(settings.targetCenters[index] - settings.targetWidth / 2) * 100}%`;
      window.style.width = `${settings.targetWidth * 100}%`;
      tracks.append(row);
      this.rows.push(row);
      this.dots.push(row.querySelector('.pulse-lock-dot')!);
    }
    container.append(root);
    this.root = root;
  }

  update(entry: PulseLockEntry | null, coreCount: number, doorId: string | null, interactKey = 'E'): void {
    this.root.hidden = !entry || !doorId;
    if (!entry || !doorId) return;
    this.root.querySelector('kbd')!.textContent = interactKey;
    this.progress.textContent = `门锁破解  ${Math.min(entry.completed + 1, coreCount)} / ${coreCount}`;
    for (let index = 0; index < this.rows.length; index += 1) {
      const state = index < entry.completed ? 'done'
        : index === entry.completed ? 'active' : 'pending';
      this.rows[index].dataset.state = state;
      this.rows[index].dataset.feedback = state === 'active' && entry.feedback === 'MISS'
        ? 'MISS' : index === entry.completed - 1 && entry.feedback === 'SUCCESS'
          ? 'SUCCESS' : 'NONE';
      const dot = this.dots[index];
      dot.style.left = `${entry.position * 100}%`;
      this.rows[index].dataset.inWindow = state === 'active' &&
        Math.abs(entry.position - this.centers[index]) <= this.targetWidth / 2
        ? 'true' : 'false';
    }
  }

  dispose(): void { this.root.remove(); }
}
