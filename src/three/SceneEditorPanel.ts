import { EDIT_LIMITS, ROTATION_STEP_DEGREES, type EditTarget, type MapEditSession }
  from './map/MapEditModel.ts';
import { DEFAULT_REGION_SAMPLE_STEP, REGION_AUTHORING_LIMITS } from './map/HideInteractionRegion.ts';
import { ROTATION_SNAP_DEGREES } from './map/MapEditModel.ts';

export interface SceneEditorPanelOptions {
  container: HTMLElement;
  // The DEV panel's own top row. The launcher is inserted here as a flex item so
  // it can never cover the DEV toggle (an absolute overlay in the same corner
  // hid the whole DEV console).
  topRow: HTMLElement;
  enabled: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSelect: (id: string | null) => void;
  onFocus: (id: string) => void;
  onFieldChange: (id: string, field: string, value: number) => void;
  onApply: () => void;
  onDiscard: () => void;
  onResetTarget: (id: string) => void;
  onExport: () => void;
  onAnchorsVisible: (visible: boolean) => void;
  onRegionPreviewVisible: (visible: boolean) => void;
  onRotationSnapChange: (enabled: boolean) => void;
}

const NOTICE_VISIBLE_MS = 8_000;

export interface SceneEditorPanelState {
  open: boolean;
  freezeState: string;
  freezeReason: string;
  selection: string | null;
  draftStatus: string;
  lastRejection: string;
  appliedCount: number;
  anchorsVisible: boolean;
  rotationSnap: boolean;
  events: readonly string[];
}

const FURNITURE_NUMERIC_FIELDS: readonly { field: string; label: string; step: number }[] = [
  { field: 'x', label: 'X 位置', step: 0.05 },
  { field: 'z', label: 'Z 位置', step: 0.05 },
  { field: 'rotationDeg', label: '旋转角度（度）', step: ROTATION_STEP_DEGREES },
  { field: 'width', label: '宽度', step: 0.05 },
  { field: 'depth', label: '进深', step: 0.05 },
  { field: 'height', label: '高度', step: 0.05 },
];

const HIDE_SPOT_NUMERIC_FIELDS: readonly { field: string; label: string; step: number }[] = [
  { field: 'x', label: '锚点 X', step: 0.05 },
  { field: 'z', label: '锚点 Z', step: 0.05 },
  { field: 'facing', label: 'facing（弧度）', step: 0.05 },
  { field: 'interactionRegion.radius', label: '区域半径（世界单位）',
    step: REGION_AUTHORING_LIMITS.radiusStep },
  { field: 'interactionRegion.halfAngleDeg', label: '扇形半角（度）',
    step: REGION_AUTHORING_LIMITS.halfAngleStepDeg },
];

function targetNumber(target: EditTarget, field: string): number | undefined {
  if (field === 'interactionRegion.radius' && target.editKind === 'HIDE_SPOT') {
    return target.interactionRegion.radius;
  }
  if (field === 'interactionRegion.halfAngleDeg' && target.editKind === 'HIDE_SPOT') {
    return target.interactionRegion.halfAngleDeg;
  }
  const value = (target as unknown as Record<string, unknown>)[field];
  return typeof value === 'number' ? value : undefined;
}

function fieldBounds(field: string): { min?: number; max?: number } {
  // The rotation contract is 0–359.9 degrees; the model normalizes anything
  // else into [0, 360) so the input stays a friendly authoring aid.
  if (field === 'rotationDeg') return { min: 0, max: 359.9 };
  if (field === 'interactionRegion.radius') return {
    min: REGION_AUTHORING_LIMITS.minRadius, max: REGION_AUTHORING_LIMITS.maxRadius };
  if (field === 'interactionRegion.halfAngleDeg') return {
    min: REGION_AUTHORING_LIMITS.minHalfAngleDeg, max: REGION_AUTHORING_LIMITS.maxHalfAngleDeg };
  return {};
}

export class SceneEditorPanel {
  private readonly launch: HTMLButtonElement;
  private readonly notice: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly freezeLabel: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly anchorsToggle: HTMLInputElement;
  private readonly regionPreviewToggle: HTMLInputElement;
  private readonly rotationSnapToggle: HTMLInputElement;
  private readonly list: HTMLElement;
  private readonly detail: HTMLElement;
  private readonly status: HTMLElement;
  private readonly options: SceneEditorPanelOptions;
  private readonly inputs = new Map<string, HTMLInputElement>();
  private listSignature = '';
  private detailKey = '';
  private query = '';
  private selected: string | null = null;
  private noticeTimer = 0;

  constructor(options: SceneEditorPanelOptions) {
    this.options = options;
    this.launch = document.createElement('button');
    this.launch.type = 'button';
    this.launch.className = 'scene-editor-launch';
    this.launch.textContent = '场景编辑';
    this.launch.hidden = !options.enabled;
    this.launch.addEventListener('click', () => options.onOpen());
    // Refusing to open the editor must never look like a dead button, so the
    // reason is shown next to the launcher instead of only in the closed panel.
    this.notice = document.createElement('span');
    this.notice.className = 'scene-editor-notice';
    this.notice.hidden = true;
    options.topRow.prepend(this.launch);
    options.topRow.prepend(this.notice);

    this.panel = document.createElement('aside');
    this.panel.className = 'scene-editor-panel';
    this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'DEV 场景热编辑器');
    const header = document.createElement('header');
    const heading = document.createElement('strong');
    heading.textContent = '场景编辑（DEV）';
    this.freezeLabel = document.createElement('span');
    this.freezeLabel.className = 'scene-editor-freeze';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'scene-editor-close';
    close.textContent = '×';
    close.setAttribute('aria-label', '关闭场景编辑');
    close.addEventListener('click', () => options.onClose());
    header.append(heading, this.freezeLabel, close);
    this.panel.append(header);

    const toolbar = document.createElement('div');
    toolbar.className = 'scene-editor-toolbar';
    this.anchorsToggle = document.createElement('input');
    this.anchorsToggle.type = 'checkbox';
    this.anchorsToggle.checked = true;
    this.anchorsToggle.addEventListener('change', () =>
      options.onAnchorsVisible(this.anchorsToggle.checked));
    const anchorsLabel = document.createElement('label');
    anchorsLabel.className = 'scene-editor-anchors';
    anchorsLabel.append(this.anchorsToggle, document.createTextNode('锚点标记'));
    this.regionPreviewToggle = document.createElement('input');
    this.regionPreviewToggle.type = 'checkbox';
    this.regionPreviewToggle.checked = true;
    this.regionPreviewToggle.addEventListener('change', () =>
      options.onRegionPreviewVisible(this.regionPreviewToggle.checked));
    const regionPreviewLabel = document.createElement('label');
    regionPreviewLabel.className = 'scene-editor-anchors';
    regionPreviewLabel.append(this.regionPreviewToggle, document.createTextNode('交互区域预览'));
    this.rotationSnapToggle = document.createElement('input');
    this.rotationSnapToggle.type = 'checkbox';
    this.rotationSnapToggle.checked = false;
    this.rotationSnapToggle.addEventListener('change', () =>
      options.onRotationSnapChange(this.rotationSnapToggle.checked));
    const rotationSnapLabel = document.createElement('label');
    rotationSnapLabel.className = 'scene-editor-anchors';
    rotationSnapLabel.append(this.rotationSnapToggle,
      document.createTextNode(`旋转吸附 ${ROTATION_SNAP_DEGREES}°`));
    toolbar.append(anchorsLabel, regionPreviewLabel, rotationSnapLabel,
      this.button('应用编辑', () => options.onApply()),
      this.button('放弃草稿', () => options.onDiscard()),
      this.button('导出地图 JSON', () => options.onExport()));
    this.panel.append(toolbar);

    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'scene-editor-search';
    this.search.placeholder = '搜索对象 ID / 类型 / 房间';
    this.search.addEventListener('input', () => { this.query = this.search.value.trim(); });
    this.panel.append(this.search);

    this.list = document.createElement('div');
    this.list.className = 'scene-editor-list';
    this.panel.append(this.list);

    this.detail = document.createElement('div');
    this.detail.className = 'scene-editor-detail';
    this.panel.append(this.detail);

    this.status = document.createElement('div');
    this.status.className = 'scene-editor-status';
    this.panel.append(this.status);
    options.container.append(this.panel);
  }

  get isOpen(): boolean { return !this.panel.hidden; }

  setOpen(open: boolean): void {
    this.panel.hidden = !open;
    this.launch.setAttribute('aria-pressed', String(open));
    document.body.classList.toggle('scene-editor-open', open);
    if (open) this.hideNotice();
    if (!open) {
      this.selected = null;
      this.listSignature = '';
      this.detailKey = '';
      this.inputs.clear();
      this.detail.replaceChildren();
    }
  }

  // A refused open request (for example before the match reaches PLAYING) must
  // be visibly reported next to the launcher instead of leaving a button that
  // looks broken.
  showNotice(text: string): void {
    this.notice.textContent = text;
    this.notice.hidden = false;
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => this.hideNotice(), NOTICE_VISIBLE_MS);
  }

  render(session: MapEditSession, state: SceneEditorPanelState): void {
    if (this.panel.hidden) return;
    this.freezeLabel.textContent = `${state.freezeState}｜${state.freezeReason}`;
    const selected = state.selection;
    if (selected !== this.selected) {
      this.selected = selected;
      this.detailKey = '';
    }
    const signature = `${this.query}|${session.list().map(target => target.id).join(',')}`;
    if (signature !== this.listSignature) {
      this.listSignature = signature;
      this.renderList(session);
    }
    this.markSelection();
    this.renderDetail(session);
    this.renderStatus(session, state);
  }

  dispose(): void {
    this.hideNotice();
    this.launch.remove();
    this.notice.remove();
    this.panel.remove();
  }

  private hideNotice(): void {
    if (this.noticeTimer) {
      window.clearTimeout(this.noticeTimer);
      this.noticeTimer = 0;
    }
    this.notice.hidden = true;
  }

  private button(label: string, handler: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'scene-editor-button';
    element.textContent = label;
    element.addEventListener('click', handler);
    return element;
  }

  private matches(target: EditTarget): boolean {
    if (!this.query) return true;
    const haystack = `${target.id} ${target.editKind} ${target.roomId} ` +
      `${'kind' in target ? target.kind : ''} ` +
      `${'furnitureId' in target ? target.furnitureId : ''} ` +
      `${'label' in target ? target.label : ''}`.toLocaleLowerCase();
    return haystack.includes(this.query.toLocaleLowerCase());
  }

  private renderList(session: MapEditSession): void {
    const sections: HTMLElement[] = [];
    const furniture = session.furnitureList().filter(target => this.matches(target));
    const anchors = session.hideSpotList().filter(target => this.matches(target));
    sections.push(this.listSection('家具 / 纸箱', furniture.map(target => ({
      id: target.id, meta: `${target.roomId}｜${target.width}×${target.depth}×${target.height}`,
      kind: 'FURNITURE' as const }))));
    sections.push(this.listSection('藏身锚点', anchors.map(target => ({
      id: target.id, meta: `${target.label}｜${target.kind}｜${target.roomId}｜${target.furnitureId}`,
      kind: 'HIDE_SPOT' as const }))));
    this.list.replaceChildren(...sections);
  }

  private listSection(title: string, rows: { id: string; meta: string; kind: string }[]):
  HTMLElement {
    const section = document.createElement('section');
    section.className = 'scene-editor-section';
    const heading = document.createElement('div');
    heading.className = 'scene-editor-section-title';
    heading.textContent = `${title}（${rows.length}）`;
    section.append(heading);
    for (const row of rows) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scene-editor-row';
      button.dataset.objectId = row.id;
      button.dataset.objectKind = row.kind;
      const name = document.createElement('span');
      name.textContent = row.id;
      const meta = document.createElement('small');
      meta.textContent = row.meta;
      button.append(name, meta);
      button.addEventListener('click', () => this.options.onSelect(row.id));
      button.addEventListener('dblclick', () => this.options.onFocus(row.id));
      section.append(button);
    }
    return section;
  }

  private markSelection(): void {
    for (const row of this.list.querySelectorAll<HTMLButtonElement>('.scene-editor-row')) {
      row.setAttribute('aria-pressed', String(row.dataset.objectId === this.selected));
    }
  }

  private renderDetail(session: MapEditSession): void {
    const target = this.selected ? session.get(this.selected) : null;
    if (!target) {
      this.detailKey = '';
      this.detail.replaceChildren(this.hint('从上面的列表或场景里选择一个对象。'));
      this.inputs.clear();
      return;
    }
    const key = `${target.id}|${target.editKind}`;
    if (key !== this.detailKey) {
      this.detailKey = key;
      this.inputs.clear();
      this.detail.replaceChildren(this.buildDetail(target));
    }
    const fields = target.editKind === 'FURNITURE'
      ? FURNITURE_NUMERIC_FIELDS
      : HIDE_SPOT_NUMERIC_FIELDS.filter(field => field.field !== 'interactionRegion.halfAngleDeg' ||
        target.interactionRegion.shape === 'SECTOR');
    for (const { field } of fields) {
      const input = this.inputs.get(field);
      const value = targetNumber(target, field);
      if (input && value !== undefined && document.activeElement !== input && Number(input.value) !== value) {
        input.value = String(value);
      }
    }
    if (target.editKind === 'FURNITURE') {
      const input = this.inputs.get('rotationDeg');
      const rotation = targetNumber(target, 'rotationDeg');
      if (input && rotation !== undefined && document.activeElement !== input &&
          Number(input.value) !== rotation) {
        input.value = String(rotation);
      }
    }
    const diff = session.diff(target.id);
    const diffBox = this.detail.querySelector<HTMLElement>('.scene-editor-diff');
    if (diffBox) {
      diffBox.textContent = diff.length
        ? `未应用改动：${diff.map(entry => `${entry.field} ${entry.from} → ${entry.to}`).join('；')}`
        : '未应用改动：无（与已应用地图一致）';
      diffBox.dataset.tone = diff.length ? 'warning' : 'normal';
    }
    const rejectionBox = this.detail.querySelector<HTMLElement>('.scene-editor-rejection');
    if (rejectionBox) {
      const own = session.lastRejection?.targetId === target.id
        ? session.lastRejection.message : '';
      rejectionBox.textContent = own ? `最近拒绝：${own}` : '最近拒绝：无';
      rejectionBox.dataset.tone = own ? 'danger' : 'normal';
    }
  }

  private buildDetail(target: EditTarget): HTMLElement {
    const fragment = document.createElement('div');
    const identity = document.createElement('div');
    identity.className = 'scene-editor-identity';
    const rows: [string, string][] = [
      ['稳定 ID', target.id],
      ['编辑类型', target.editKind],
      ['房间', target.roomId],
    ];
    if (target.editKind === 'FURNITURE') {
      rows.push(['白模尺寸上限',
        `宽/深 ${EDIT_LIMITS.minWidth}–${EDIT_LIMITS.maxWidth}，高 ${EDIT_LIMITS.minHeight}–${EDIT_LIMITS.maxHeight}`]);
    } else {
      rows.push(['类型', target.kind], ['furnitureId', target.furnitureId], ['显示名', target.label]);
    }
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'scene-editor-readonly';
      const name = document.createElement('span');
      name.textContent = label;
      const text = document.createElement('span');
      text.textContent = value;
      row.append(name, text);
      identity.append(row);
    }
    fragment.append(identity);

    const form = document.createElement('div');
    form.className = 'scene-editor-form';
    const fields = target.editKind === 'FURNITURE'
      ? FURNITURE_NUMERIC_FIELDS
      : HIDE_SPOT_NUMERIC_FIELDS.filter(field => field.field !== 'interactionRegion.halfAngleDeg' ||
        target.interactionRegion.shape === 'SECTOR');
    for (const { field, label, step } of fields) {
      const wrapper = document.createElement('label');
      wrapper.className = 'scene-editor-field';
      wrapper.append(document.createTextNode(label));
      const input = document.createElement('input');
      input.type = 'number';
      input.step = String(step);
      const bounds = fieldBounds(field);
      if (bounds.min !== undefined) input.min = String(bounds.min);
      if (bounds.max !== undefined) input.max = String(bounds.max);
      input.value = String(targetNumber(target, field) ?? '');
      input.dataset.field = field;
      input.addEventListener('change', () => {
        this.options.onFieldChange(target.id, field, Number(input.value));
      });
      this.inputs.set(field, input);
      wrapper.append(input);
      form.append(wrapper);
    }
    fragment.append(form);

    const actions = document.createElement('div');
    actions.className = 'scene-editor-actions';
    actions.append(
      this.button('聚焦镜头', () => this.options.onFocus(target.id)),
      this.button('恢复初始值', () => this.options.onResetTarget(target.id)));
    fragment.append(actions);

    const diff = document.createElement('div');
    diff.className = 'scene-editor-diff';
    const rejection = document.createElement('div');
    rejection.className = 'scene-editor-rejection';
    fragment.append(diff, rejection);
    if (target.editKind === 'HIDE_SPOT') {
      const preview = document.createElement('div');
      preview.className = 'scene-editor-region-legend';
      preview.style.display = 'grid';
      preview.style.gap = '4px';
      preview.style.marginTop = '10px';
      preview.style.padding = '7px';
      preview.style.border = '1px solid #3f444a';
      preview.style.borderRadius = '3px';
      preview.style.color = '#b9c0c8';
      preview.style.background = '#1a1d21';
      preview.append(this.legendTitle('交互区域预览'),
        this.legendRow('蓝线：区域边界近似显示（底层按精确圆形 / 扇形计算）', '#5cc8ff', true),
        this.legendRow('绿色：LEGAL｜可用采样点', '#65d987'),
        this.legendRow('橙色：SURFACE_BLOCKED｜到家具表面被挡', '#ffa552'),
        this.legendRow('红色：NOT_STANDABLE｜角色站不下', '#ff595e'),
        this.legendRow('紫色：NOT_NAVIGABLE｜附近无导航点', '#d879e8'),
        this.legendRow('黄色：NOT_REACHABLE｜从锚点不可达', '#f0d264'),
        this.legendTitle(`采样间隔 ${DEFAULT_REGION_SAMPLE_STEP} 世界单位；采样点不代表整个连续区域。`));
      fragment.append(preview);
    }
    return fragment;
  }

  private renderStatus(session: MapEditSession, state: SceneEditorPanelState): void {
    const lines = [
      `双阵营：${state.freezeState}（${state.freezeReason}）`,
      `草稿状态：${state.draftStatus}｜已应用编辑：${state.appliedCount}`,
      `当前选中：${state.selection ?? '无'}`,
      `最近拒绝：${state.lastRejection}`,
      `事件：${state.events.join('；') || '无'}`,
    ];
    this.status.textContent = lines.join('\n');
    this.anchorsToggle.checked = state.anchorsVisible;
    this.rotationSnapToggle.checked = state.rotationSnap;
  }

  private hint(text: string): HTMLElement {
    const element = document.createElement('p');
    element.className = 'scene-editor-hint';
    element.textContent = text;
    return element;
  }

  private legendTitle(text: string): HTMLElement {
    const element = document.createElement('small');
    element.textContent = text;
    element.style.color = '#aeb4bc';
    return element;
  }

  private legendRow(text: string, color: string, line = false): HTMLElement {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '6px';
    const marker = document.createElement('i');
    marker.style.flex = '0 0 9px';
    marker.style.width = '9px';
    marker.style.height = '9px';
    marker.style.borderRadius = line ? '50%' : '50%';
    marker.style.background = line ? 'transparent' : color;
    marker.style.border = line ? `2px solid ${color}` : '0';
    row.append(marker, document.createTextNode(text));
    return row;
  }
}
