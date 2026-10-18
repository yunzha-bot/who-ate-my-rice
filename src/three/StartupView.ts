import { DefaultLoadingManager } from 'three';
import { StartupReadiness } from './StartupReadiness.ts';

/** 展示真实加载阶段；音频准备不创建AudioContext，不等待自动播放许可。 */
export class StartupView {
  private readonly root = document.createElement('section');
  private readonly status: HTMLElement;
  private readonly details: HTMLElement;
  private readonly readyState: HTMLElement;
  private readonly simplify: HTMLButtonElement;
  private readonly retry: HTMLButtonElement;
  private readonly manager = DefaultLoadingManager;
  private readonly previous = { start: this.manager.onStart, progress: this.manager.onProgress, load: this.manager.onLoad,
    error: this.manager.onError };
  private pending = 0;
  private settled = false;
  private failed = false;
  private setupDone = false;
  private menuReady = false;
  private audioReady = false;
  private slow = false;
  private explicitlySimplified = false;
  private settleTimer = 0;
  private readonly timeout: number;
  private readonly unsubscribe: () => void;
  onSimplify: (() => void) | null = null;

  constructor(private readonly container: HTMLElement, readonly readiness = new StartupReadiness()) {
    this.root.className = 'startup-view';
    this.root.setAttribute('aria-label', '游戏资源加载');
    this.root.innerHTML = `<div class="startup-content"><span class="startup-brand">THE LITTLE RICE CHASE</span>
      <h1>谁吃了我的米？</h1><p class="startup-status" role="status">正在加载场景</p>
      <div class="startup-track" aria-hidden="true"><i></i></div>
      <p class="startup-detail">正在准备角色与场景资源</p>
      <p class="startup-ready">菜单图片准备中 · 音频准备中</p>
      <p class="startup-choice" hidden>继续等待可使用完整角色；简化模式使用程序化角色及已就绪资源，本次页面内不自动替换角色。</p>
      <div class="startup-actions"><button type="button" class="startup-wait" hidden>继续等待完整资源</button>
      <button type="button" class="startup-simplify" hidden>使用简化模式继续</button>
      <button type="button" class="startup-retry" hidden>重新加载并重试</button></div></div>`;
    this.status = this.root.querySelector('.startup-status')!;
    this.details = this.root.querySelector('.startup-detail')!;
    this.readyState = this.root.querySelector('.startup-ready')!;
    this.retry = this.root.querySelector<HTMLButtonElement>('.startup-retry')!;
    this.simplify = this.root.querySelector<HTMLButtonElement>('.startup-simplify')!;
    this.retry.addEventListener('click', () => location.reload());
    this.root.querySelector('.startup-wait')!.addEventListener('click', () => {
      this.details.textContent = '正在继续等待完整资源；下载不会因等待时间较长而被取消。';
    });
    this.simplify.addEventListener('click', () => {
      if (!this.onSimplify) return;
      this.explicitlySimplified = true;
      this.onSimplify();
      this.readiness.setAssets('simplified');
      this.tryFinish();
    });
    this.unsubscribe = readiness.subscribe(() => { this.syncReadyState(); this.tryFinish(); });
    container.inert = true;
    document.body.append(this.root);
    this.manager.onStart = (url, loaded, total) => {
      this.previous.start?.(url, loaded, total);
      this.pending = total - loaded;
    };
    this.manager.onProgress = (url, loaded, total) => {
      this.previous.progress?.(url, loaded, total);
      this.pending = total - loaded;
      this.syncReadyState();
      this.tryFinish();
    };
    this.manager.onLoad = () => { this.previous.load?.(); this.pending = 0; this.tryFinish(); };
    this.manager.onError = url => {
      this.previous.error?.(url); this.failed = true;
      this.syncReadyState();
    };
    this.timeout = window.setTimeout(() => {
      this.slow = true;
      this.syncReadyState();
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
    // Optional audio has its own budget; neither its failure nor its timeout releases images/model.
    void audio.finally(() => clearTimeout(timer));
    await Promise.allSettled(Array.from(this.container.querySelectorAll('img')).map(image => image.decode()))
      .then(results => {
        this.menuReady = results.every(result => result.status === 'fulfilled');
        this.failed ||= !this.menuReady;
        this.setupDone = true;
        this.syncReadyState();
        this.tryFinish();
      });
  }

  private syncReadyState(): void {
    if (this.settled) return;
    const labels = { downloading: '正在下载正式角色', parsing: '正在解析正式角色',
      initializing: '正在初始化角色动画', ready: '正式角色已就绪',
      failed: '正式角色加载失败', simplified: '已选择简化角色' };
    this.status.textContent = labels[this.readiness.model];
    const failure = this.failed || this.readiness.model === 'failed';
    this.details.textContent = failure ? '资源未能完整加载。可重试，或明确选择简化模式继续。'
      : this.slow ? '网络较慢，仍在加载，并未判定失败。可继续等待或主动选择简化模式。'
      : '正在准备开局必需资源，请稍候。';
    this.readyState.textContent = `菜单图片 ${this.menuReady ? '就绪' : '准备中'} · 场景待完成 ${this.pending} · 音频 ${this.audioReady ? '就绪' : '可稍后加载'}`;
    const offerChoice = this.slow || failure;
    this.simplify.hidden = !offerChoice;
    this.retry.hidden = !offerChoice;
    this.root.querySelector<HTMLElement>('.startup-choice')!.hidden = !offerChoice;
    this.root.querySelector<HTMLButtonElement>('.startup-wait')!.hidden = !this.slow || failure;
  }

  private tryFinish(): void {
    clearTimeout(this.settleTimer);
    if (this.settled) return;
    if (!this.explicitlySimplified && this.setupDone && this.pending === 0)
      this.readiness.assets = this.failed ? 'failed' : 'ready';
    // Request completion is not enough: actual animation initialization must also have succeeded.
    if (this.readiness.canStart)
      this.settleTimer = window.setTimeout(() => this.finish(), 250);
  }

  private finish(): void {
    if (this.settled || !this.readiness.admit()) return;
    this.settled = true;
    this.unsubscribe();
    clearTimeout(this.timeout); clearTimeout(this.settleTimer);
    this.manager.onProgress = this.previous.progress;
    this.manager.onStart = this.previous.start;
    this.manager.onLoad = this.previous.load;
    this.manager.onError = this.previous.error;
    this.container.inert = false;
    if (this.explicitlySimplified) {
      this.status.textContent = '简化模式已就绪';
      this.details.textContent = '按你的选择使用程序化角色，正在进入菜单';
    } else {
      this.status.textContent = '准备完成';
      this.details.textContent = '正在进入菜单';
    }
    window.setTimeout(() => {
      this.root.classList.add('startup-complete');
      window.setTimeout(() => this.root.remove(), 260);
    }, 220);
  }
}
