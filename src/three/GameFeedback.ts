import { Vector3, type Camera } from 'three';

/** Ephemeral presentation only; the element never intercepts controls. */
export class GameFeedback {
  readonly root = document.createElement('div');
  private readonly live = new Set<HTMLElement>();

  constructor(parent: HTMLElement, private readonly camera: Camera) {
    this.root.className = 'game-feedback';
    this.root.setAttribute('aria-hidden', 'true');
    parent.append(this.root);
  }

  show(text: string, tone: 'good' | 'bad' | 'soft' = 'soft', world?: Vector3,
    rice = false): void {
    const point = world?.clone().add(new Vector3(0, 1.5, 0)).project(this.camera);
    if (point && (Math.abs(point.x) > 1 || Math.abs(point.y) > 1 || Math.abs(point.z) > 1)) return;
    const x = point && Math.abs(point.x) <= 1 ? (point.x + 1) * 50 : 50;
    const y = point && Math.abs(point.y) <= 1 ? (1 - point.y) * 50 : 46;
    const item = document.createElement('span');
    item.className = `game-feedback-item ${tone}`;
    item.textContent = text;
    item.style.left = `${x}%`; item.style.top = `${y}%`;
    this.root.append(item); this.live.add(item);
    item.addEventListener('animationend', () => this.remove(item), { once: true });
    setTimeout(() => this.remove(item), 950);
    if (rice && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let n = 0; n < 3; n++) {
        const grain = document.createElement('i');
        grain.className = 'game-feedback-grain';
        grain.style.left = `${x + (n - 1) * 1.1}%`;
        grain.style.top = `${y + 2}%`;
        this.root.append(grain); this.live.add(grain);
        grain.addEventListener('animationend', () => this.remove(grain), { once: true });
        setTimeout(() => this.remove(grain), 750);
      }
    }
  }

  private remove(item: HTMLElement): void { item.remove(); this.live.delete(item); }
  clear(): void { for (const item of this.live) item.remove(); this.live.clear(); }
  dispose(): void { this.clear(); this.root.remove(); }
}
