import { DefaultLoadingManager } from 'three';

/** 展示真实加载阶段；音频准备不创建AudioContext，不等待自动播放许可。 */
export class StartupView {
  private readonly root = document.createElement('section');
  private readonly status: HTMLElement;
  private readonly details: HTMLElement;
  private readonly readyState: HTMLElement;
  private readonly manager = DefaultLoadingManager;
  private readonly previous = { start: this.manager.onStart, progress: this.manager.onProgress, load: this.manager.onLoad,
    error: this.manager.onError };
  private pending = 0;
  private settled = false;
  private failed = false;
  private setupDone = false;
  private menuReady = false;
  private audioReady = false;
  private settleTimer = 0;
  private readonly timeout: number;

  constructor(private readonly container: HTMLElement) {
    this.root.className = 'startup-view';
    this.root.setAttribute('aria-label', '游戏资源加载');
    this.root.innerHTML = `<div class="startup-content"><span class="startup-brand">THE LITTLE RICE CHASE</span>
      <h1>谁吃了我的米？</h1><p class="startup-status" role="status">正在加载场景</p>
      <div class="startup-track" aria-hidden="true"><i></i></div>
      <p class="startup-detail">正在准备角色与场景资源</p>
      <p class="startup-ready">菜单图片准备中 · 音频准备中</p>
      <button type="button" class="startup-retry" hidden>重试</button></div>`;
    this.status = this.root.querySelector('.startup-status')!;
    this.details = this.root.querySelector('.startup-detail')!;
    this.readyState = this.root.querySelector('.startup-ready')!;
    this.root.querySelector('.startup-retry')!.addEventListener('click', () => location.reload());
    container.inert = true;
    document.body.append(this.root);
    this.manager.onStart = (url, loaded, total) => {
      this.previous.start?.(url, loaded, total);
      this.pending = total - loaded;
    };
    this.manager.onProgress = (url, loaded, total) => {
      this.previous.progress?.(url, loaded, total);
      this.pending = total - loaded;
      this.details.textContent = `场景资源 ${loaded} / ${total}`;
      this.tryFinish();
    };
    this.manager.onLoad = () => { this.previous.load?.(); this.pending = 0; this.tryFinish(); };
    this.manager.onError = url => {
      this.previous.error?.(url); this.failed = true;
      this.status.textContent = '部分资源未能加载';
      this.details.textContent = '正在使用可用资源继续';
      this.root.querySelector<HTMLButtonElement>('.startup-retry')!.hidden = false;
    };
    this.timeout = window.setTimeout(() => {
      this.status.textContent = '加载时间较长';
      this.details.textContent = '将使用已就绪资源进入菜单';
      this.failed = true;
      this.finish(true);
    }, 20_000);
  }

  async prepared(): Promise<void> {
    // 菜单真实图片与少量即将使用的音频；不提前加载全量42个音频。
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    const cues = ['click', 'countdown', 'start', 'menu', 'game', 'room'];
    const audio = Promise.allSettled(cues.map(async cue => {
      const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/${cue}.ogg`, { signal: controller.signal });
      if (!response.ok) throw new Error('音频不可用');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(0, 4)) !== 'OggS') throw new Error('音频格式不可用');
    })).then(results => {
      this.audioReady = results.every(result => result.status === 'fulfilled');
      this.syncReadyState();
      return results;
    });
    const images = Promise.allSettled(Array.from(this.container.querySelectorAll('img')).map(image => image.decode()))
      .then(results => {
        this.menuReady = results.every(result => result.status === 'fulfilled');
        this.syncReadyState();
        return results;
      });
    const results = await Promise.race([
      Promise.all([audio, images]),
      new Promise<null>(resolve => controller.signal.addEventListener('abort', () => resolve(null), { once: true })),
    ]);
    clearTimeout(timer);
    if (this.settled) return;
    this.failed ||= !results || results.some(group => group.some(result => result.status === 'rejected'));
    this.setupDone = true;
    this.tryFinish();
  }

  private syncReadyState(): void {
    this.readyState.textContent = `菜单图片 ${this.menuReady ? '就绪' : '准备中'} · 音频 ${this.audioReady ? '就绪' : '准备中'}`;
  }

  private tryFinish(): void {
    clearTimeout(this.settleTimer);
    // 留出异步回退请求注册的间隙；不是伪造进度或加载百分比。
    if (this.setupDone && this.pending === 0 && !this.settled)
      this.settleTimer = window.setTimeout(() => this.finish(this.failed), 250);
  }

  private finish(degraded: boolean): void {
    if (this.settled) return;
    this.settled = true;
    clearTimeout(this.timeout); clearTimeout(this.settleTimer);
    this.manager.onProgress = this.previous.progress;
    this.manager.onStart = this.previous.start;
    this.manager.onLoad = this.previous.load;
    this.manager.onError = this.previous.error;
    this.container.inert = false;
    if (degraded) {
      this.status.textContent = '部分资源不可用';
      this.details.textContent = '已启用安全回退，正在进入菜单';
      this.root.querySelector<HTMLButtonElement>('.startup-retry')!.hidden = false;
    } else {
      this.status.textContent = '准备完成';
      this.details.textContent = '正在进入菜单';
    }
    window.setTimeout(() => {
      this.root.classList.add('startup-complete');
      window.setTimeout(() => this.root.remove(), 260);
    }, degraded ? 1_600 : 220);
  }
}
