import { Vector3, type Camera } from 'three';

/** Ephemeral presentation only; the element never intercepts controls. */
export class GameFeedback {
  readonly root = document.createElement('div');
  private readonly live = new Map<HTMLElement, {
    timer: ReturnType<typeof setTimeout>; onEnd: () => void;
  }>();
  private readonly camera: Camera;

  constructor(parent: HTMLElement, camera: Camera) {
    this.camera = camera;
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
    this.track(item, 950);
    if (rice && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let n = 0; n < 3; n++) {
        const grain = document.createElement('i');
        grain.className = 'game-feedback-grain';
        grain.style.left = `${x + (n - 1) * 1.1}%`;
        grain.style.top = `${y + 2}%`;
        this.track(grain, 750);
      }
    }
  }

  private track(item: HTMLElement, lifetimeMs: number): void {
    const onEnd = () => this.remove(item);
    this.live.set(item, { timer: setTimeout(onEnd, lifetimeMs), onEnd });
    item.addEventListener('animationend', onEnd, { once: true });
    this.root.append(item);
  }

  private remove(item: HTMLElement): void {
    const lifetime = this.live.get(item);
    if (!lifetime) return;
    clearTimeout(lifetime.timer);
    item.removeEventListener('animationend', lifetime.onEnd);
    item.remove(); this.live.delete(item);
  }
  clear(): void { for (const item of this.live.keys()) this.remove(item); }
  dispose(): void { this.clear(); this.root.remove(); }
}
