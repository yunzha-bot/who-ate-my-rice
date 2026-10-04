import { cooldownFraction } from './AlphaPresentation.ts';

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
  sprintState: string;
  concealed: boolean;
  captureRatio: number;
  riceRatio: number | null;
}

/** Read-only HUD. Values come from the same authority as gameplay; no timers here. */
export class AlphaHudView {
  readonly root = document.createElement('section');
  private readonly faction: HTMLElement;
  private readonly rice: HTMLElement;
  private readonly time: HTMLElement;
  private readonly goal: HTMLElement;
  private readonly q: HTMLElement;
  private readonly sprint: HTMLElement;
  private readonly ready: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly pips: HTMLElement[];
  private readonly objective: HTMLElement;
  private readonly interactionHint: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root.className = 'alpha-hud';
    this.root.setAttribute('aria-label', '对局信息');
    this.root.innerHTML = `<header class="home-masthead"><span>谁吃了我的米</span><small>一屋两人 · 一场追逐</small></header>
      <aside class="alpha-score"><span class="alpha-faction"></span><h2 class="alpha-objective"></h2>
        <div class="rice-inventory" aria-hidden="true">${'<i></i>'.repeat(5)}</div>
        <strong class="alpha-rice"></strong><p class="alpha-goal"></p>
        <div class="match-clock"><small>本局时间</small><time></time></div></aside>
      <div class="alpha-progress" role="status"></div>
      <footer class="movement-guide"><b>W A S D</b> 移动 <span>Esc 暂停</span></footer>
      <section class="alpha-skills" aria-label="当前技能">
        <span class="alpha-key"><b>E</b><span>交互<small>门 · 藏身 · 吃米</small></span></span>
        <span class="alpha-cooldown alpha-q"></span><span class="alpha-cooldown alpha-sprint"></span>
      </section><div class="alpha-ready" role="status"><small></small><strong></strong><span>准备出发</span></div>`;
    this.faction = this.root.querySelector('.alpha-faction')!;
    this.rice = this.root.querySelector('.alpha-rice')!;
    this.time = this.root.querySelector('time')!;
    this.goal = this.root.querySelector('.alpha-goal')!;
    this.q = this.root.querySelector('.alpha-q')!;
    this.sprint = this.root.querySelector('.alpha-sprint')!;
    this.ready = this.root.querySelector('.alpha-ready')!;
    this.progress = this.root.querySelector('.alpha-progress')!;
    this.objective = this.root.querySelector('.alpha-objective')!;
    this.interactionHint = this.root.querySelector('.alpha-key small')!;
    this.pips = Array.from(this.root.querySelectorAll('.rice-inventory i'));
    parent.append(this.root);
  }

  update(frame: AlphaHudFrame): void {
    this.root.hidden = !frame.faction || frame.phase === 'FINISHED' || frame.phase === 'PAUSED';
    if (this.root.hidden) return;
    const dp = frame.faction === 'DEEPSEEK';
    this.root.dataset.faction = frame.faction!;
    this.set(this.faction, dp ? '01 / DeepSeek 娘' : '02 / Human');
    this.set(this.objective, dp ? '今天，也要吃饱。' : '家里的米，得守好。');
    this.set(this.interactionHint, dp ? '门 · 藏身 · 吃米' : '开门 · 解锁');
    this.set(this.rice, dp ? `${frame.completed} / ${frame.total} 份已吃完` : `${frame.total - frame.completed} / ${frame.total} 份米还在`);
    this.pips.forEach((pip, index) => { pip.dataset.done = String(index < frame.completed); });
    this.set(this.time, frame.time);
    this.set(this.goal, dp ? '找米 → 停下按住 E\n用门与家具躲开追捕。' : '观察米痕，追上她。\nQ 抓捕，或面向家具搜查。');
    this.cooldown(this.q, dp ? 'Q 锁门' : 'Q 抓捕 / 搜查', frame.qRemainingMs, frame.qDurationMs);
    this.sprint.hidden = !dp;
    this.cooldown(this.sprint, 'Space 冲刺', frame.sprintRemainingMs, frame.sprintDurationMs);
    if (dp && frame.sprintState === 'STUNNED') this.set(this.sprint, '稍等 · 眩晕中');
    else if (dp && frame.sprintState === 'SPRINT_RUNNING') this.set(this.sprint, 'Space · 冲刺中');
    this.ready.hidden = frame.phase !== 'READY';
    this.set(this.root.querySelector('.alpha-ready small')!, dp ? '悄悄开饭' : '守米行动');
    this.set(this.root.querySelector('.alpha-ready strong')!, String(frame.readySeconds));
    this.progress.hidden = !frame.concealed && frame.captureRatio <= 0 && frame.riceRatio === null;
    const value = frame.captureRatio > 0 ? frame.captureRatio : frame.riceRatio ?? 0;
    this.progress.style.setProperty('--progress', `${Math.min(100, Math.max(0, value * 100))}%`);
    this.progress.dataset.danger = String(frame.captureRatio > 0);
    this.set(this.progress, frame.concealed ? '已藏好 · E 安全退出'
      : frame.captureRatio > 0 ? `抓捕 ${Math.round(value * 100)}%`
        : `这份米 ${Math.round(value * 100)}% · 停下按住 E`);
  }

  private cooldown(node: HTMLElement, label: string, remaining: number, duration: number): void {
    this.set(node, `${label} · ${remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : '就绪'}`);
    node.dataset.ready = String(remaining <= 0);
    node.style.setProperty('--cooldown', `${cooldownFraction(remaining, duration) * 360}deg`);
  }

  private set(node: HTMLElement, value: string): void {
    if (node.textContent !== value) node.textContent = value;
  }

  dispose(): void { this.root.remove(); }
}
