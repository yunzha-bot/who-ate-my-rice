import type { RuntimeParamResult, RuntimeParamSpec } from '../systems/RuntimeDebugOverrides';
import type { DevBObservationSection } from '../systems/DevBObserver';
import { DEV_B_GROUP_HELP, DEV_B_SECTION_HELP, devBParamTimingText, devBParamTooltip,
  observationHelp, paramHelp } from '../systems/DevBHelpText.ts';

// DEV-B runtime debugging panel.
//
// The launcher is a flex item in `DebugDetailsPanel.topRow` (never an absolutely
// positioned overlay: that once covered the DEV toggle). Closing the panel keeps
// the current overrides — closing is not "restore defaults".
//
// 易用性：面板默认显示中文说明（它是什么 / 调大调小 / 何时生效），并保留
// 「紧凑模式」把说明收起来给熟练用户。说明文字只影响显示，不改任何判定。

export interface DevBPanelOptions {
  container: HTMLElement;
  topRow: HTMLElement;
  developerMode: boolean;
  onOpen: () => void;
  onClose: () => void;
  onParamChange: (id: string, value: number) => RuntimeParamResult;
  onRestoreOpenSnapshot: () => string;
  onRestoreDefaults: () => string;
  onVisualOption: (key: DevBVisualKey, enabled: boolean) => void;
}

export type DevBVisualKey = 'captureRing' | 'visionCircle' | 'lineOfSight' | 'paths' | 'sounds';

export const DEV_B_VISUAL_LABELS: readonly { key: DevBVisualKey; label: string }[] = [
  { key: 'captureRing', label: '抓捕圈（有效半径）' },
  { key: 'visionCircle', label: '视觉距离圆（无视锥角）' },
  { key: 'lineOfSight', label: '真实视线（复用 inspectVision）' },
  { key: 'paths', label: 'AI 路径与目标' },
  { key: 'sounds', label: '声音事件与传播范围' },
];

export const DEV_B_KNOWN_LIMITS: readonly string[] = [
  '视觉遮挡几何只有墙体与门：家具（含 DEV-A 旋转家具）不参与 PerceptionSystem 的视线判定，因此不绘制家具遮挡。',
  '现有视觉规则只有距离 + 遮挡，没有视锥角：只画圆，不提供也不显示 FOV。',
  'Human AI 的卡住计时（stuckMs）与部分内部计时没有对外暴露，面板标注为「面板暂时看不到」，不做推测。',
  'Human 的藏身检查（CHECK_HIDE）仍是预留状态，DEV-B 不实现、不模拟藏身检查。',
  '观察是只读的：不触发额外寻路、不改变 AI 目标，刷新频率约 5–10 Hz（真实 AI 更新频率不变）。',
  'AI 的「原因」类字段保留英文原代码，便于与 AI JSON 日志逐条对照；把鼠标停在字段名上可看到中文解释。',
];

/** 面板顶部的一行使用说明。 */
export const DEV_B_PANEL_HINT =
  '每一项参数下面都有中文说明；把鼠标停在参数名或状态字段上，可以看到它是什么、调大调小会怎样。';

const NOTICE_VISIBLE_MS = 8_000;

interface ParamRow {
  /** The row element, so a cached row can follow its group container. */
  root: HTMLElement;
  input: HTMLInputElement;
  status: HTMLElement;
  /** 何时生效（即时 / 只影响新声音事件）。 */
  timing: HTMLElement;
  /** 「它是什么」。 */
  what: HTMLElement;
  /** 「调大 / 调小之后会怎样」。 */
  adjust: HTMLElement;
  /** Last value the model reported, used to revert an illegal entry. */
  lastEffective: number;
}

export function devBParamStatusText(spec: RuntimeParamSpec, value: number,
  overridden: boolean): string {
  const effective = value.toFixed(Math.max(0, decimals(spec.step)));
  return overridden
    ? `已覆盖：${effective} ${spec.unit}（正式基准 ${spec.base}）`
    : `正式基准：${spec.base} ${spec.unit}`;
}

function decimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

export class DevBPanel {
  readonly root: HTMLElement;
  readonly launcher: HTMLButtonElement;
  private readonly context: HTMLElement;
  private readonly notice: HTMLElement;
  private readonly paramsHost: HTMLElement;
  private readonly observationHost: HTMLElement;
  private readonly overrideStatus: HTMLElement;
  private readonly visualInputs = new Map<DevBVisualKey, HTMLInputElement>();
  private readonly rows = new Map<string, ParamRow>();
  /** Group containers, created once per group label and reused on refresh. */
  private readonly groupHosts = new Map<string, HTMLElement>();
  private readonly options: DevBPanelOptions;
  private compactInput!: HTMLInputElement;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private open = false;
  private compact = false;

  constructor(options: DevBPanelOptions) {
    this.options = options;

    this.launcher = document.createElement('button');
    this.launcher.type = 'button';
    this.launcher.className = 'dev-b-launcher';
    this.launcher.textContent = 'DEV-B 调试';
    this.launcher.setAttribute('aria-pressed', 'false');
    this.launcher.hidden = !options.developerMode;
    this.launcher.addEventListener('click', () => this.toggle());
    options.topRow.append(this.launcher);

    this.root = document.createElement('aside');
    this.root.className = 'dev-b-panel';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'DEV-B 运行时调试面板');

    const header = document.createElement('div');
    header.className = 'dev-b-header';
    const title = document.createElement('strong');
    title.textContent = 'DEV-B 运行时调试';
    this.context = document.createElement('span');
    this.context.className = 'dev-b-context';
    this.context.textContent = 'JUST-IN-MEMORY';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dev-b-close';
    close.textContent = '关闭';
    close.addEventListener('click', () => this.close());
    header.append(title, this.context, close);
    this.root.append(header);

    this.notice = document.createElement('div');
    this.notice.className = 'dev-b-notice';
    this.notice.hidden = true;
    this.root.append(this.notice);

    const body = document.createElement('div');
    body.className = 'dev-b-body';

    const paramsSection = document.createElement('section');
    paramsSection.className = 'dev-b-section';
    const paramsTitle = document.createElement('h4');
    paramsTitle.textContent = '真实运行时参数（仅本页内存）';
    const paramsHelp = document.createElement('p');
    paramsHelp.className = 'dev-b-help-note';
    paramsHelp.textContent = DEV_B_PANEL_HINT;
    this.paramsHost = document.createElement('div');
    this.paramsHost.className = 'dev-b-params';
    paramsSection.append(paramsTitle, paramsHelp, this.paramsHost);

    const actions = document.createElement('div');
    actions.className = 'dev-b-actions';
    this.overrideStatus = document.createElement('span');
    this.overrideStatus.className = 'dev-b-override-status';
    this.overrideStatus.textContent = '当前无覆盖';
    const compactLabel = document.createElement('label');
    compactLabel.className = 'dev-b-compact';
    this.compactInput = document.createElement('input');
    this.compactInput.type = 'checkbox';
    this.compactInput.addEventListener('change',
      () => this.setCompact(this.compactInput.checked));
    compactLabel.append(this.compactInput, document.createTextNode('紧凑模式（隐藏说明）'));
    const restoreOpen = document.createElement('button');
    restoreOpen.type = 'button';
    restoreOpen.className = 'dev-b-button';
    restoreOpen.textContent = '恢复打开 DEV-B 时的参数';
    restoreOpen.addEventListener('click', () => this.showNotice(this.options.onRestoreOpenSnapshot()));
    const restoreBase = document.createElement('button');
    restoreBase.type = 'button';
    restoreBase.className = 'dev-b-button dev-b-restore-defaults';
    restoreBase.textContent = '恢复正式默认值（GAME_CONFIG）';
    restoreBase.addEventListener('click', () => this.showNotice(this.options.onRestoreDefaults()));
    actions.append(this.overrideStatus, compactLabel, restoreOpen, restoreBase);
    paramsSection.append(actions);
    body.append(paramsSection);

    const visualSection = document.createElement('section');
    visualSection.className = 'dev-b-section';
    const visualTitle = document.createElement('h4');
    visualTitle.textContent = '场景可视化';
    visualSection.append(visualTitle);
    for (const { key, label } of DEV_B_VISUAL_LABELS) {
      const wrapper = document.createElement('label');
      wrapper.className = 'dev-b-visual';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.addEventListener('change', () => this.options.onVisualOption(key, input.checked));
      wrapper.append(input, document.createTextNode(label));
      this.visualInputs.set(key, input);
      visualSection.append(wrapper);
    }
    body.append(visualSection);

    const observationSection = document.createElement('section');
    observationSection.className = 'dev-b-section';
    const observationTitle = document.createElement('h4');
    observationTitle.textContent = '只读运行状态（约 5–10 Hz）';
    this.observationHost = document.createElement('div');
    this.observationHost.className = 'dev-b-observation';
    observationSection.append(observationTitle, this.observationHost);
    body.append(observationSection);

    const limitsSection = document.createElement('section');
    limitsSection.className = 'dev-b-section';
    const limitsTitle = document.createElement('h4');
    limitsTitle.textContent = '已知限制与不可调项';
    const limitsList = document.createElement('ul');
    limitsList.className = 'dev-b-limits';
    for (const limit of DEV_B_KNOWN_LIMITS) {
      const item = document.createElement('li');
      item.textContent = limit;
      limitsList.append(item);
    }
    limitsSection.append(limitsTitle, limitsList);
    body.append(limitsSection);

    this.root.append(body);
    options.container.append(this.root);
    // 默认显示中文说明；紧凑模式由开关切换（只改 data-compact，不重建 DOM）。
    this.setCompact(false);
  }

  get isOpen(): boolean { return this.open; }

  get isCompact(): boolean { return this.compact; }

  /** 紧凑模式只切换 `data-compact`，由 CSS 收起说明——不新增、不删除任何节点。 */
  setCompact(compact: boolean): void {
    this.compact = compact;
    this.root.dataset.compact = compact ? 'true' : 'false';
    if (this.compactInput.checked !== compact) this.compactInput.checked = compact;
  }

  toggle(): void { if (this.open) this.close(); else this.openPanel(); }

  openPanel(): void {
    if (this.open) return;
    this.open = true;
    this.root.hidden = false;
    this.launcher.setAttribute('aria-pressed', 'true');
    this.options.onOpen();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.launcher.setAttribute('aria-pressed', 'false');
    // Closing keeps the temporary overrides: it is not "restore defaults".
    this.options.onClose();
  }

  renderParams(specs: readonly RuntimeParamSpec[], effective: (id: string) => number,
    overridden: (id: string) => boolean, overrideCount: number): void {
    // Group containers are created exactly once per group label and reused by
    // every later refresh. The panel refreshes ~8 times per second, so creating a
    // container per call would append a duplicate heading (with no rows inside)
    // on each refresh and fill the panel with repeated group titles.
    const wanted = new Set<string>();
    const ordered: HTMLElement[] = [];
    for (const spec of specs) {
      const host = this.ensureGroup(spec.groupLabel);
      if (!wanted.has(spec.groupLabel)) {
        wanted.add(spec.groupLabel);
        ordered.push(host);
      }
      const row = this.ensureRow(spec, host);
      const value = effective(spec.id);
      const isOverridden = overridden(spec.id);
      row.lastEffective = value;
      if (document.activeElement !== row.input) row.input.value = String(value);
      const tooltip = devBParamTooltip(spec);
      if (row.input.title !== tooltip) row.input.title = tooltip;
      const status = devBParamStatusText(spec, value, isOverridden);
      if (row.status.textContent !== status) row.status.textContent = status;
      row.status.dataset.tone = isOverridden ? 'warning' : 'normal';
      const help = paramHelp(spec.id);
      const what = help ? `它是什么：${help.what}` : '';
      if (row.what.textContent !== what) row.what.textContent = what;
      const adjust = help ? `调大：${help.increase}；调小：${help.decrease}` : '';
      if (row.adjust.textContent !== adjust) row.adjust.textContent = adjust;
      if (row.what.title !== tooltip) row.what.title = tooltip;
      if (row.adjust.title !== tooltip) row.adjust.title = tooltip;
      const timing = devBParamTimingText(spec);
      if (row.timing.textContent !== timing) row.timing.textContent = timing;
      row.timing.dataset.timing = spec.immediate ? 'immediate' : 'new-events';
    }
    // Drop containers whose group disappeared, then match the real spec order.
    // Nothing is re-inserted while the order is already correct: re-appending an
    // element that holds the focused input would blur it mid-typing.
    for (const [label, host] of [...this.groupHosts])
      if (!wanted.has(label)) {
        host.remove();
        this.groupHosts.delete(label);
      }
    const current = Array.from(this.paramsHost.children);
    const alreadyOrdered = current.length === ordered.length &&
      ordered.every((host, index) => current[index] === host);
    if (!alreadyOrdered) for (const host of ordered) this.paramsHost.append(host);
    this.overrideStatus.textContent = overrideCount > 0
      ? `当前覆盖 ${overrideCount} 项（仅在内存中）` : '当前无覆盖';
  }

  private ensureGroup(label: string): HTMLElement {
    const existing = this.groupHosts.get(label);
    if (existing) return existing;
    const host = document.createElement('div');
    host.className = 'dev-b-group';
    host.dataset.group = label;
    const heading = document.createElement('strong');
    heading.textContent = label;
    host.append(heading);
    const desc = DEV_B_GROUP_HELP[label];
    if (desc) {
      const note = document.createElement('span');
      note.className = 'dev-b-group-desc';
      note.textContent = `｜${desc}`;
      host.append(note);
    }
    this.groupHosts.set(label, host);
    this.paramsHost.append(host);
    return host;
  }

  renderObservation(sections: readonly DevBObservationSection[]): void {
    const existing = new Map<string, HTMLElement>();
    for (const child of Array.from(this.observationHost.children))
      existing.set((child as HTMLElement).dataset.section ?? '', child as HTMLElement);
    for (const section of sections) {
      let host = existing.get(section.id);
      if (!host) {
        const details = document.createElement('details');
        details.className = 'dev-b-observation-section';
        details.dataset.section = section.id;
        details.open = section.id === 'control' || section.id === 'human-ai' ||
          section.id === 'deepseek-ai';
        const summary = document.createElement('summary');
        summary.textContent = section.title;
        details.append(summary);
        const desc = DEV_B_SECTION_HELP[section.id];
        if (desc) {
          const note = document.createElement('span');
          note.className = 'dev-b-observation-desc';
          note.textContent = `｜${desc}`;
          details.append(note);
        }
        this.observationHost.append(details);
        host = details;
      }
      host.querySelector('summary')!.textContent = section.title;
      const wanted = new Map<string, HTMLElement>();
      for (const entry of section.entries) {
        const key = `${section.id}/${entry.label}`;
        let row = host.querySelector<HTMLElement>(`[data-entry="${CSS.escape(key)}"]`);
        if (!row) {
          row = document.createElement('div');
          row.className = 'dev-b-entry';
          row.dataset.entry = key;
          const label = document.createElement('span');
          label.className = 'dev-b-entry-label';
          const value = document.createElement('span');
          value.className = 'dev-b-entry-value';
          row.append(label, value);
        }
        const label = row.children[0] as HTMLElement;
        const value = row.children[1] as HTMLElement;
        if (label.textContent !== entry.label) label.textContent = entry.label;
        if (value.textContent !== entry.value) value.textContent = entry.value;
        value.dataset.tone = entry.tone ?? 'normal';
        // 字段解释挂在悬浮说明上：既解释「它是什么」，又保留内部字段名，
        // 且不会让 60 条状态行各占一行说明把面板撑长。
        const help = observationHelp(section.id, entry.label);
        const hint = help ? `${entry.label}｜字段 ${help.field}｜${help.what}` : entry.label;
        if (label.title !== hint) label.title = hint;
        label.dataset.hint = help ? help.what : '';
        wanted.set(key, row);
      }
      for (const row of Array.from(host.querySelectorAll<HTMLElement>('.dev-b-entry')))
        if (!wanted.has(row.dataset.entry ?? '')) row.remove();
      for (const [key, row] of wanted)
        if (!row.parentElement) host.append(row);
    }
    for (const [id, host] of existing)
      if (!sections.some(section => section.id === id)) host.remove();
  }

  setContext(text: string): void {
    if (this.context.textContent !== text) this.context.textContent = text;
  }

  setVisualOptions(state: Record<DevBVisualKey, boolean>): void {
    for (const [key, input] of this.visualInputs) {
      const value = state[key];
      if (input.checked !== value) input.checked = value;
    }
  }

  showNotice(message: string): void {
    if (!message) return;
    this.notice.textContent = message;
    this.notice.hidden = false;
    this.notice.dataset.tone = /失败|非法|不接受|需在|未知/.test(message) ? 'danger' : 'success';
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.notice.hidden = true;
      this.noticeTimer = null;
    }, NOTICE_VISIBLE_MS);
  }

  dispose(): void {
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.noticeTimer = null;
    this.root.remove();
    this.launcher.remove();
    // Release the cached nodes so a disposed panel never keeps a stale tree or
    // its listeners alive.
    this.rows.clear();
    this.groupHosts.clear();
    this.visualInputs.clear();
  }

  private ensureRow(spec: RuntimeParamSpec, host: HTMLElement): ParamRow {
    const existing = this.rows.get(spec.id);
    if (existing) {
      // A cached row follows its group container instead of staying behind.
      if (existing.root.parentElement !== host) host.append(existing.root);
      return existing;
    }
    const row = document.createElement('div');
    row.className = 'dev-b-param';
    row.dataset.param = spec.id;
    const label = document.createElement('span');
    label.className = 'dev-b-param-label';
    label.textContent = `${spec.label}（${spec.unit}）`;
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'dev-b-param-input';
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.setAttribute('aria-label', `${spec.label}（${spec.unit}）`);
    input.addEventListener('change', () => {
      const raw = Number(input.value.trim() === '' ? Number.NaN : input.value);
      const result = this.options.onParamChange(spec.id, raw);
      if (!result.ok) {
        this.showNotice(result.message);
        input.value = String(view.lastEffective);
      } else {
        this.showNotice(`${spec.label} → ${result.value} ${spec.unit}`);
      }
    });
    const status = document.createElement('span');
    status.className = 'dev-b-param-status';
    const what = document.createElement('span');
    what.className = 'dev-b-param-what';
    const adjust = document.createElement('span');
    adjust.className = 'dev-b-param-adjust';
    const timing = document.createElement('span');
    timing.className = 'dev-b-param-effect';
    row.append(label, input, status, what, adjust, timing);
    host.append(row);
    const view: ParamRow = { root: row, input, status, timing, what, adjust,
      lastEffective: Number.NaN };
    this.rows.set(spec.id, view);
    return view;
  }
}
