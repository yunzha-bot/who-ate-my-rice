import { cooldownFraction } from './AlphaPresentation.ts';
import type { InteractionPrompt } from './InteractionPrompt.ts';

/** Touch presentation/input tuning only; does not change world movement or skill values. */
export const MOBILE_CONTROLS = {
  zoneWidthRatio: .5, zoneTopRatio: .28,
  centerInsetPx: 64, edgeGapPx: 8, radiusRatio: .34, deadZoneRatio: .12, sensitivity: 1,
  rippleMs: 1050, rippleSpreadPx: 12,
};

export function floatingStickCenter(x: number, y: number,
  box: { left: number; top: number; width: number; height: number }, diameter: number) {
  const inset = Math.max(MOBILE_CONTROLS.centerInsetPx, diameter / 2 + MOBILE_CONTROLS.edgeGapPx);
  const clamp = (v: number, start: number, length: number) =>
    Math.max(start + Math.min(inset, length / 2), Math.min(start + length - Math.min(inset, length / 2), v));
  return { x: clamp(x, box.left, box.width), y: clamp(y, box.top, box.height) };
}

export interface MobileHudInput {
  direction(x: number, y: number): void;
  held(code: string, value: boolean): void;
  aimStart(pointerId: number, x: number, y: number): void;
  aimEnd(pointerId: number, x: number, y: number): void;
  aimCancel(): void;
  pause(): void;
  cancel(): void;
}

export interface AlphaHudFrame {
  phase: string;
  faction: 'HUMAN' | 'DEEPSEEK' | null;
  time: string;
  completed: number;
  total: number;
  readySeconds: number;
  qRemainingMs: number;
  qDurationMs: number;
  sprintRemainingMs: number;
  sprintDurationMs: number;
  forceBreakRemainingMs: number;
  forceBreakDurationMs: number;
  netRemainingMs: number;
  netDurationMs: number;
  netStatus: string | null;
  netSlots: number;
  lockSlots: number;
  sprintState: string;
  concealed: boolean;
  captureRatio: number;
  riceRatio: number | null;
  interaction?: (InteractionPrompt & { x: number; y: number; held: boolean }) | null;
  controlsEnabled?: boolean;
  lightLabel?: string | null;
  throwReady?: boolean;
  pickupReady?: boolean;
  interactionUnavailable?: boolean;
  netMode?: string;
  pulseLockOpen?: boolean;
}

/** HUD and touch commands. Gameplay values and clocks still come from the game. */
export class AlphaHudView {
  readonly root = document.createElement('section');
  private readonly faction: HTMLElement;
  private readonly rice: HTMLElement;
  private readonly time: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly q: HTMLElement;
  private readonly sprint: HTMLElement;
  private readonly net: HTMLElement;
  private readonly ready: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly pips: HTMLElement[];
  private readonly objective: HTMLElement;
  private readonly interactionHint: HTMLElement;
  private readonly prompt: HTMLElement;
  private wasReady = false;
  private readySeconds: number | null = null;
  private readyExitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly mobilePointers = new Map<number, string>();
  private stickPointer: number | null = null;
  private readonly stick: HTMLElement;
  private readonly stickZone: HTMLElement;
  private stickOrigin = { x: 0, y: 0 };
  private readonly stickThumb: HTMLElement;
  private readonly mobileInput: MobileHudInput;
  private readonly rotatePrompt: HTMLElement;
  private mobileEnabled = false;
  private readonly touchButtons = new Map<string, HTMLButtonElement>();

  constructor(parent: HTMLElement, mobileInput: MobileHudInput) {
    this.mobileInput = mobileInput;
    this.root.className = 'alpha-hud';
    this.root.setAttribute('aria-label', '对局信息');
    this.root.innerHTML = `<header class="home-masthead"><span>谁吃了我的米</span><small>一屋两人 · 一场追逐</small></header>
      <aside class="alpha-score"><span class="alpha-faction"></span><h2 class="alpha-objective"></h2>
        <div class="rice-inventory" aria-hidden="true">${'<i></i>'.repeat(5)}</div>
        <strong class="alpha-rice"></strong><p class="alpha-goal"></p>
        <div class="match-clock"><small>本局时间</small><time></time></div></aside>
      <div class="alpha-progress" role="status"></div>
      <footer class="movement-guide"><b>W A S D</b> 移动 <span>Esc 暂停</span></footer>
      <section class="mobile-controls" aria-label="触屏操作">
        <div class="mobile-move-zone" role="application" aria-label="浮动摇杆移动区域"><div class="mobile-stick" aria-hidden="true"><i></i></div></div>
        <div class="mobile-actions">
          <button type="button" data-touch-code="KeyE">交互</button>
          <button type="button" data-touch-code="KeyQ">锁门</button>
          <button type="button" data-touch-code="KeyV">抓捕</button>
          <button type="button" data-touch-code="Space">冲刺</button>
          <button type="button" data-touch-code="KeyF">拾取</button>
          <button type="button" class="mobile-throw">投掷<br><small>按住瞄准</small></button>
        </div>
        <nav class="mobile-toolbar" aria-label="对局操作">
          <button type="button" data-touch-code="KeyL" hidden>开灯</button>
          <button type="button" class="mobile-cancel" hidden>取消</button>
          <button type="button" class="mobile-pause">暂停</button>
        </nav>
      </section>
      <div class="mobile-rotate" role="status"><strong>请横屏游玩</strong><span>旋转手机，获得完整操作空间</span></div>
      <section class="alpha-skills" aria-label="当前技能">
        <span class="alpha-key"><b>E</b><span>交互<small>门 · 藏身 · 吃米</small></span></span>
        <span class="alpha-cooldown alpha-q"></span><span class="alpha-cooldown alpha-net"></span><span class="alpha-cooldown alpha-sprint"></span>
      </section><div class="world-interaction" aria-hidden="true"><kbd>E</kbd><span class="world-interaction-copy"><strong></strong><small></small></span></div>
      <div class="alpha-ready" role="status"><small></small><strong></strong><span>准备出发</span></div>`;
    this.faction = this.root.querySelector('.alpha-faction')!;
    this.rice = this.root.querySelector('.alpha-rice')!;
    this.time = this.root.querySelector('time')!;
    this.goal = this.root.querySelector('.alpha-goal')!;
    this.q = this.root.querySelector('.alpha-q')!;
    this.sprint = this.root.querySelector('.alpha-sprint')!;
    this.net = this.root.querySelector('.alpha-net')!;
    this.ready = this.root.querySelector('.alpha-ready')!;
    this.progress = this.root.querySelector('.alpha-progress')!;
    this.objective = this.root.querySelector('.alpha-objective')!;
    this.interactionHint = this.root.querySelector('.alpha-key small')!;
    this.prompt = this.root.querySelector('.world-interaction')!;
    this.stick = this.root.querySelector('.mobile-stick')!;
    this.stickZone = this.root.querySelector('.mobile-move-zone')!;
    this.stickThumb = this.stick.querySelector('i')!;
    this.rotatePrompt = this.root.querySelector('.mobile-rotate')!;
    this.stickZone.addEventListener('pointerdown', this.onStickDown);
    this.root.dataset.inputMode = globalThis.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'keyboard';
    this.root.style.setProperty('--mobile-zone-width', `${MOBILE_CONTROLS.zoneWidthRatio * 100}%`);
    this.root.style.setProperty('--mobile-zone-top', `${MOBILE_CONTROLS.zoneTopRatio * 100}%`);
    this.root.style.setProperty('--mobile-ripple-ms', `${MOBILE_CONTROLS.rippleMs}ms`);
    this.root.style.setProperty('--mobile-ripple-spread', `${MOBILE_CONTROLS.rippleSpreadPx}px`);
    globalThis.window?.addEventListener('pointerdown', this.onInputPointer, { passive: true });
    globalThis.window?.addEventListener('keydown', this.onInputKey);
    globalThis.window?.addEventListener('blur', this.releaseTouch);
    this.root.addEventListener('pointermove', this.onStickMove);
    this.root.addEventListener('pointerup', this.onPointerEnd);
    this.root.addEventListener('pointercancel', this.onPointerEnd);
    this.root.addEventListener('lostpointercapture', this.onPointerEnd);
    this.root.querySelectorAll<HTMLButtonElement>('[data-touch-code]').forEach(button => {
      this.touchButtons.set(button.dataset.touchCode!, button);
      button.addEventListener('pointerdown', event => {
        const pointer = event as PointerEvent;
        pointer.preventDefault();
        if (!this.mobileEnabled || button.disabled || this.mobilePointers.has(pointer.pointerId) || this.stickPointer === pointer.pointerId) return;
        const code = button.dataset.touchCode!;
        if ([...this.mobilePointers.values()].includes(code)) return;
        this.mobilePointers.set(pointer.pointerId, code);
        button.setPointerCapture?.(pointer.pointerId);
        this.mobileInput.held(code, true);
      });
    });
    const throwButton = this.root.querySelector<HTMLButtonElement>('.mobile-throw')!;
    throwButton.addEventListener('pointerdown', event => {
      const pointer = event as PointerEvent;
      pointer.preventDefault();
      if (!this.mobileEnabled || throwButton.disabled || this.mobilePointers.has(pointer.pointerId) ||
          this.stickPointer === pointer.pointerId || [...this.mobilePointers.values()].includes('THROW')) return;
      this.mobilePointers.set(pointer.pointerId, 'THROW');
      throwButton.setPointerCapture?.(pointer.pointerId);
      this.mobileInput.aimStart(pointer.pointerId, pointer.clientX, pointer.clientY);
    });
    for (const [selector, command] of [
      ['.mobile-pause', () => this.mobileInput.pause()],
      ['.mobile-cancel', () => { this.releaseTouch(); this.mobileInput.cancel(); }],
    ] as const) {
      const button = this.root.querySelector(selector)!;
      // Secondary touches do not reliably synthesize click. Keyboard/mouse still use click.
      button.addEventListener('pointerdown', event => {
        const pointer = event as PointerEvent;
        if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') return;
        pointer.preventDefault(); command();
      });
      button.addEventListener('click', event => {
        const pointer = event as PointerEvent;
        if (pointer.pointerType !== 'touch' && pointer.pointerType !== 'pen') command();
      });
    }
    this.pips = Array.from(this.root.querySelectorAll('.rice-inventory i'));
    parent.append(this.root, this.rotatePrompt);
  }

  private onStickDown = (event: PointerEvent): void => {
    event.preventDefault();
    if (!this.mobileEnabled || this.stickPointer !== null || this.mobilePointers.has(event.pointerId)) return;
    const zone = this.stickZone.getBoundingClientRect();
    const size = this.stick.offsetWidth || (globalThis.innerHeight <= 500 ? 106 : 128);
    const center = floatingStickCenter(event.clientX, event.clientY, zone, size);
    // Keep direction anchored to the actual first contact, even when the visible base is inset.
    this.stickOrigin = { x: event.clientX, y: event.clientY };
    this.stick.style.left = `${center.x - zone.left - size / 2}px`;
    this.stick.style.top = `${center.y - zone.top - size / 2}px`;
    this.stick.dataset.active = 'true';
    this.stickPointer = event.pointerId;
    this.stickZone.setPointerCapture?.(event.pointerId);
    this.updateStick(event.clientX, event.clientY);
  };

  private onInputPointer = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') this.root.dataset.inputMode = 'touch';
    else if (event.pointerType === 'mouse') this.root.dataset.inputMode = 'keyboard';
  };
  private onInputKey = (event: KeyboardEvent): void => {
    if (!['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) this.root.dataset.inputMode = 'keyboard';
  };

  private onStickMove = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointer) this.updateStick(event.clientX, event.clientY);
  };

  private updateStick(clientX: number, clientY: number): void {
    const rect = this.stick.getBoundingClientRect();
    const radius = rect.width * MOBILE_CONTROLS.radiusRatio;
    if (radius <= 0) return;
    const dx = (clientX - this.stickOrigin.x) * MOBILE_CONTROLS.sensitivity;
    const dy = (clientY - this.stickOrigin.y) * MOBILE_CONTROLS.sensitivity;
    const length = Math.hypot(dx, dy);
    if (length < radius * MOBILE_CONTROLS.deadZoneRatio) {
      this.stickThumb.style.transform = '';
      this.mobileInput.direction(0, 0);
      return;
    }
    const scale = length > radius ? radius / length : 1;
    const x = dx * scale, y = dy * scale;
    this.stickThumb.style.transform = `translate(${x}px, ${y}px)`;
    this.mobileInput.direction(x / radius, y / radius);
  }

  private onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.stick.dataset.active = 'false';
      this.stickThumb.style.transform = '';
      this.mobileInput.direction(0, 0);
    }
    const action = this.mobilePointers.get(event.pointerId);
    if (!action) return;
    this.mobilePointers.delete(event.pointerId);
    if (action === 'THROW') {
      if (event.type === 'pointerup') this.mobileInput.aimEnd(event.pointerId, event.clientX, event.clientY);
      else this.mobileInput.aimCancel();
    }
    else this.mobileInput.held(action, false);
  };

  releaseTouch = (): void => {
    const captures = [...this.mobilePointers].map(([id, code]) => ({ id,
      node: code === 'THROW' ? this.root.querySelector<HTMLElement>('.mobile-throw')! : this.touchButtons.get(code)! }));
    if (this.stickPointer !== null) captures.push({ id: this.stickPointer, node: this.stickZone });
    this.mobilePointers.forEach(code => {
      if (code === 'THROW') this.mobileInput.aimCancel();
      else this.mobileInput.held(code, false);
    });
    this.mobilePointers.clear();
    this.stickPointer = null;
    this.stick.dataset.active = 'false';
    this.stickThumb.style.transform = '';
    this.mobileInput.direction(0, 0);
    for (const { id, node } of captures) if (node?.hasPointerCapture?.(id)) node.releasePointerCapture(id);
  };

  update(frame: AlphaHudFrame): void {
    const hint = frame.phase === 'PLAYING' ? frame.interaction : null;
    this.prompt.dataset.visible = String(!!hint);
    this.prompt.setAttribute('aria-hidden', String(!hint));
    this.prompt.dataset.pressed = String(!!hint?.held && !hint.blocked);
    this.prompt.dataset.blocked = String(!!hint?.blocked);
    if (hint) {
      this.set(this.root.querySelector('.world-interaction kbd')!, hint.key ?? 'E');
      this.prompt.style.setProperty('left', `${hint.x}px`);
      this.prompt.style.setProperty('top', `${hint.y}px`);
      this.set(this.root.querySelector('.world-interaction strong')!, hint.label);
      this.set(this.root.querySelector('.world-interaction small')!, hint.detail);
    }
    this.root.hidden = !frame.faction || frame.phase === 'FINISHED' || frame.phase === 'PAUSED';
    const enabled = (frame.controlsEnabled ?? frame.phase === 'PLAYING') && !this.root.hidden;
    if (this.mobileEnabled && !enabled) this.releaseTouch();
    this.mobileEnabled = enabled;
    this.root.querySelector('.mobile-controls')!.setAttribute('data-enabled', String(enabled));
    this.root.querySelector<HTMLButtonElement>('.mobile-pause')!.disabled = frame.phase !== 'PLAYING';
    if (this.root.hidden) return;
    const dp = frame.faction === 'DEEPSEEK';
    // During net placement the canvas must own ground touches, including the left half.
    this.stickZone.dataset.suspended = String(!dp && !!frame.netMode && frame.netMode !== 'NONE');
    this.root.dataset.faction = frame.faction!;
    this.set(this.faction, dp ? '01 / DeepSeek 娘' : '02 / Human');
    this.set(this.objective, dp ? '吃完五份米' : '找到并抓住 DeepSeek 娘');
    this.set(this.interactionHint, dp ? '门 · 藏身 · 吃米' : '开门 · 搜查');
    this.set(this.rice, dp ? `${frame.completed} / ${frame.total} 份已吃完` : `${frame.total - frame.completed} / ${frame.total} 份米还在`);
    this.pips.forEach((pip, index) => { pip.dataset.done = String(index < frame.completed); });
    this.set(this.time, frame.time);
    this.set(this.goal, dp ? '找米 → 停下按住 E\n用门与家具躲开追捕。' : '观察米痕，追上她。\nE 操作门或搜查家具；V 前方扇形抓捕。');
    this.q.hidden = false;
    this.cooldown(this.q, dp ? 'Q 锁门' : 'V 抓捕', frame.qRemainingMs, frame.qDurationMs);
    if (dp) this.q.dataset.slots = String(frame.lockSlots);
    else delete this.q.dataset.slots;
    this.q.setAttribute('aria-label', dp ? `Q 锁门，剩余可锁 ${frame.lockSlots} 扇` : this.q.textContent!);
    this.q.setAttribute('title', dp ? `剩余可同时锁门名额：${frame.lockSlots}` : 'V 抓捕前方未藏身角色，与 E 家具搜查共用冷却');
    this.net.hidden = dp;
    if (!dp) {
      this.net.dataset.slots = String(frame.netSlots);
      this.net.setAttribute('aria-label', `Q 布网，剩余可布置 ${frame.netSlots} 张`);
      this.net.setAttribute('title', `布设捕捉网；剩余可布置名额：${frame.netSlots}`);
      this.cooldown(this.net, 'Q 布网', frame.netRemainingMs, frame.netDurationMs);
      if (frame.netStatus) {
        this.set(this.net, `Q 布网\n${frame.netStatus}`);
        this.net.dataset.ready = 'false';
      }
    }
    this.sprint.hidden = false;
    this.cooldown(this.sprint, dp ? 'Space 冲刺' : 'Space 破门',
      dp ? frame.sprintRemainingMs : frame.forceBreakRemainingMs,
      dp ? frame.sprintDurationMs : frame.forceBreakDurationMs);
    if (dp && frame.sprintState === 'STUNNED') this.set(this.sprint, '稍等 · 眩晕中');
    else if (dp && frame.sprintState === 'SPRINT_RUNNING') this.set(this.sprint, 'Space · 冲刺中');
    this.syncTouchButtons(frame);
    const readyNow = frame.phase === 'READY';
    const readyNumber = this.root.querySelector<HTMLElement>('.alpha-ready strong')!;
    if (readyNow) {
      if (this.readyExitTimer !== null) clearTimeout(this.readyExitTimer);
      this.readyExitTimer = null;
      this.ready.hidden = false;
      this.ready.dataset.finishing = 'false';
      this.set(this.root.querySelector('.alpha-ready small')!, dp ? '悄悄开饭' : '守米行动');
      this.set(readyNumber, String(frame.readySeconds));
      if ((!this.wasReady || this.readySeconds !== frame.readySeconds) &&
          !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        readyNumber.animate?.([
          { transform: 'scale(.84)', opacity: .65 },
          { transform: 'scale(1.06)', opacity: 1, offset: .65 },
          { transform: 'scale(1)', opacity: 1 },
        ], { duration: 300, easing: 'ease-out' });
      }
      this.readySeconds = frame.readySeconds;
    } else if (this.wasReady && frame.phase === 'PLAYING') {
      this.ready.hidden = false;
      this.ready.dataset.finishing = 'true';
      this.set(readyNumber, '开始！');
      this.readyExitTimer = setTimeout(() => {
        this.ready.hidden = true;
        this.readyExitTimer = null;
      }, 320);
    } else if (this.readyExitTimer === null) {
      this.ready.hidden = true;
    }
    this.wasReady = readyNow;
    this.progress.hidden = !frame.concealed && frame.captureRatio <= 0 && frame.riceRatio === null;
    const value = frame.captureRatio > 0 ? frame.captureRatio : frame.riceRatio ?? 0;
    this.progress.style.setProperty('--progress', `${Math.min(100, Math.max(0, value * 100))}%`);
    this.progress.dataset.danger = String(frame.captureRatio > 0);
    const touchCopy = this.root.dataset.inputMode === 'touch';
    this.set(this.progress, frame.concealed ? touchCopy ? '藏身中 · 点交互离开' : '藏身中 · 按 E 离开'
      : frame.captureRatio > 0 ? `抓捕 ${Math.round(value * 100)}%`
        : `这份米 ${Math.round(value * 100)}% · 停下按住${touchCopy ? '交互' : ' E'}`);
  }

  private cooldown(node: HTMLElement, label: string, remaining: number, duration: number, compact = false): void {
    const human = this.root.dataset.faction === 'HUMAN';
    const status = remaining > 0 ? compact ? `${Math.ceil(remaining / 1000)}秒` : human ? `冷却 ${Math.ceil(remaining / 1000)} 秒`
      : `${Math.ceil(remaining / 1000)}s` : '就绪';
    this.set(node, `${label}${human || compact ? '\n' : ' · '}${status}`);
    node.dataset.ready = String(remaining <= 0);
    node.style.setProperty('--cooldown', `${cooldownFraction(remaining, duration) * 360}deg`);
    node.style.setProperty('--cooldown-width', `${cooldownFraction(remaining, duration) * 100}%`);
  }

  private syncTouchButtons(frame: AlphaHudFrame): void {
    const dp = frame.faction === 'DEEPSEEK';
    const interact = this.touchButtons.get('KeyE');
    if (!interact) return;
    this.set(interact, frame.pulseLockOpen ? '点按解锁' : frame.interaction?.label ?? (dp ? '交互\n按住吃米' : '交互\n门·家具'));
    const hint = frame.phase === 'PLAYING' ? frame.interaction : null;
    const unavailable = !this.mobileEnabled || frame.interactionUnavailable;
    const state = unavailable || hint?.blocked ? 'BLOCKED' : frame.pulseLockOpen || hint?.held ? 'BUSY' : hint ? 'READY' : 'NONE';
    interact.dataset.interactionState = state;
    interact.disabled = !!unavailable || (!frame.pulseLockOpen && (!hint || hint.blocked));
    const v = this.touchButtons.get('KeyV')!;
    v.hidden = dp;
    this.cooldown(v, '抓捕', frame.qRemainingMs, frame.qDurationMs, true);
    const q = this.touchButtons.get('KeyQ')!;
    this.cooldown(q, dp ? '锁门' : '布网', dp ? frame.qRemainingMs : frame.netRemainingMs,
      dp ? frame.qDurationMs : frame.netDurationMs, true);
    q.dataset.slots = String(dp ? frame.lockSlots : frame.netSlots);
    if (!dp && frame.netStatus) this.set(q, `布网\n${frame.netStatus}`);
    const space = this.touchButtons.get('Space')!;
    this.cooldown(space, dp ? '冲刺' : '破门', dp ? frame.sprintRemainingMs : frame.forceBreakRemainingMs,
      dp ? frame.sprintDurationMs : frame.forceBreakDurationMs, true);
    if (dp && frame.sprintState !== 'NORMAL') this.set(space, frame.sprintState === 'STUNNED' ? '眩晕中' : '冲刺中');
    const light = this.touchButtons.get('KeyL')!;
    light.hidden = !frame.lightLabel;
    if (frame.lightLabel) this.set(light, frame.lightLabel);
    this.touchButtons.get('KeyF')!.disabled = frame.pickupReady === false;
    this.root.querySelector<HTMLButtonElement>('.mobile-throw')!.disabled = frame.throwReady === false;
    this.root.querySelector<HTMLElement>('.mobile-cancel')!.hidden = ![...this.mobilePointers.values()].includes('THROW') &&
      (dp || !frame.netMode || frame.netMode === 'NONE') && !frame.pulseLockOpen;
  }

  private set(node: HTMLElement, value: string): void {
    if (node.textContent !== value) node.textContent = value;
  }

  dispose(): void {
    if (this.readyExitTimer !== null) clearTimeout(this.readyExitTimer);
    this.root.removeEventListener('pointermove', this.onStickMove);
    this.root.removeEventListener('pointerup', this.onPointerEnd);
    this.root.removeEventListener('pointercancel', this.onPointerEnd);
    this.root.removeEventListener('lostpointercapture', this.onPointerEnd);
    this.stickZone.removeEventListener('pointerdown', this.onStickDown);
    globalThis.window?.removeEventListener('pointerdown', this.onInputPointer);
    globalThis.window?.removeEventListener('keydown', this.onInputKey);
    globalThis.window?.removeEventListener('blur', this.releaseTouch);
    this.releaseTouch();
    this.rotatePrompt.remove();
    this.root.remove();
  }
}
