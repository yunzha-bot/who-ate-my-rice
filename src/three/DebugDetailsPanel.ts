export type DebugStatusTone = 'normal' | 'danger' | 'warning' | 'curious' | 'success';

export interface DebugProperty {
  key: string;
  label: string;
  value: string;
  tone?: DebugStatusTone;
  children?: DebugProperty[];
}

export interface DebugCategory {
  id: string;
  title: string;
  properties: DebugProperty[];
}

export interface EscapeCandidateDebugValue {
  roomId: string;
  score: number;
  routeLength: number;
  exits: number;
  covered: boolean;
  blockedExit: boolean;
  alternateRoute: boolean;
  recentVisitPenalty: number;
}

export const DEFAULT_EXPANDED_DEBUG_CATEGORIES = [
  'deepseek-ai', 'safe-wait', 'curiosity-passage',
] as const;

export function escapeCandidateProperties(candidates: readonly EscapeCandidateDebugValue[])
  : DebugProperty[] {
  return candidates.map(candidate => ({
    key: candidate.roomId,
    label: candidate.roomId,
    value: `评分 ${candidate.score.toFixed(1)}`,
    children: [
      { key: 'score', label: '综合评分', value: candidate.score.toFixed(1) },
      { key: 'route-length', label: '路线长度', value: candidate.routeLength.toFixed(1) },
      { key: 'exits', label: '出口数', value: String(candidate.exits) },
      { key: 'covered', label: '有遮挡', value: candidate.covered ? '是' : '否' },
      { key: 'blocked-exit', label: '出口受阻', value: candidate.blockedExit ? '是' : '否' },
      { key: 'alternate-route', label: '替代路线', value: candidate.alternateRoute ? '是' : '否' },
      { key: 'recent-visit-penalty', label: '近期访问惩罚',
        value: candidate.recentVisitPenalty.toFixed(1) },
    ],
  }));
}

export function filterDebugProperties(properties: readonly DebugProperty[], query: string)
  : DebugProperty[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...properties];

  const filter = (property: DebugProperty): DebugProperty | null => {
    const selfMatches = `${property.label} ${property.value}`
      .toLocaleLowerCase().includes(normalized);
    if (selfMatches) return property;
    const children = property.children?.map(filter)
      .filter((child): child is DebugProperty => child !== null);
    return children?.length ? { ...property, children } : null;
  };

  return properties.map(filter).filter((property): property is DebugProperty => property !== null);
}

export function filterDebugCategories(categories: readonly DebugCategory[], query: string)
  : DebugCategory[] {
  return categories.map(category => ({
    ...category,
    properties: filterDebugProperties(category.properties, query),
  })).filter(category => category.properties.length > 0);
}

interface DebugDetailsPanelOptions {
  onSafetyPaths?: (enabled: boolean) => void;
  onTemporaryControl: (faction: 'HUMAN' | 'DEEPSEEK') => void;
  onExportLog: () => void;
  onExpanded: () => void;
  developerMode: boolean;
}

interface RowView {
  element: HTMLElement;
  label: HTMLElement;
  value: HTMLElement;
  children: HTMLElement;
  lastLabel: string;
  lastValue: string;
  lastTone: DebugStatusTone;
}

interface CategoryView {
  element: HTMLElement;
  toggle: HTMLButtonElement;
  body: HTMLElement;
}

export const DEBUG_CATEGORY_DEFINITIONS = [
  { id: 'human-ai', title: 'Human AI' },
  { id: 'deepseek-ai', title: 'DeepSeek AI' },
  { id: 'threat-escape', title: 'Threat / Escape' },
  { id: 'door-escape', title: 'Door Escape / 关门逃脱' },
  { id: 'safe-wait', title: 'SAFE_WAIT' },
  { id: 'curiosity-passage', title: 'Curiosity / Passage' },
  { id: 'animation', title: 'Animation' },
  { id: 'other', title: 'Other' },
] as const;

export class DebugDetailsPanel {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly context: HTMLElement;
  private readonly live: HTMLElement;
  private readonly search: HTMLInputElement;
  private readonly controls: HTMLElement;
  private readonly controlButtons = new Map<'HUMAN' | 'DEEPSEEK', HTMLButtonElement>();
  private readonly exportButton: HTMLButtonElement;
  private readonly categories = new Map<string, CategoryView>();
  private readonly rows = new Map<string, RowView>();
  private readonly expanded = new Map<string, boolean>();
  private readonly searchOverrides = new Map<string, boolean>();
  private searchRestore: Map<string, boolean> | null = null;
  private query = '';
  private latestCategories: readonly DebugCategory[] = [];

  constructor(parent: HTMLElement, options: DebugDetailsPanelOptions) {
    this.root = document.createElement('aside');
    this.root.className = 'debug-panel';
    this.root.setAttribute('aria-label', 'DEV 调试面板');

    this.toggle = document.createElement('button');
    this.toggle.type = 'button';
    this.toggle.className = 'debug-toggle';
    this.toggle.textContent = 'DEV ▾';
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.addEventListener('click', () => {
      this.body.hidden = !this.body.hidden;
      this.toggle.textContent = this.body.hidden ? 'DEV ▾' : 'DEV ▴';
      this.toggle.setAttribute('aria-expanded', String(!this.body.hidden));
      if (!this.body.hidden) {
        options.onExpanded();
      }
    });
    this.root.append(this.toggle);

    this.body = document.createElement('div');
    this.body.className = 'debug-content';
    this.body.hidden = true;
    this.root.append(this.body);

    const header = document.createElement('div');
    header.className = 'details-header';
    const heading = document.createElement('strong');
    heading.textContent = 'Details';
    this.context = document.createElement('span');
    this.context.className = 'details-context';
    this.live = document.createElement('span');
    this.live.className = 'details-live';
    this.live.textContent = 'LIVE';
    header.append(heading, this.context, this.live);
    this.body.append(header);

    const toolbar = document.createElement('div');
    toolbar.className = 'details-toolbar';
    this.controls = document.createElement('div');
    this.controls.className = 'details-control-buttons';
    for (const [faction, label] of [['HUMAN', 'Human'], ['DEEPSEEK', 'DeepSeek 娘']] as const) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'details-tool-button';
      button.textContent = `临时控制 ${label}`;
      button.addEventListener('click', () => options.onTemporaryControl(faction));
      this.controls.append(button);
      this.controlButtons.set(faction, button);
    }
    this.controls.hidden = !options.developerMode;

    this.search = document.createElement('input');
    this.search.type = 'search';
    this.search.className = 'details-search';
    this.search.placeholder = '搜索属性';
    this.search.setAttribute('aria-label', '搜索调试属性');
    this.search.addEventListener('input', () => this.onSearchChanged());

    this.exportButton = document.createElement('button');
    this.exportButton.type = 'button';
    this.exportButton.className = 'details-tool-button details-export';
    this.exportButton.textContent = '导出本局 AI 日志';
    this.exportButton.hidden = !options.developerMode;
    this.exportButton.addEventListener('click', options.onExportLog);
    toolbar.append(this.controls, this.search, this.exportButton);
    if (options.developerMode && options.onSafetyPaths) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'details-tool-button';
      toggle.textContent = 'AI 安全路径可视化';
      toggle.setAttribute('aria-pressed', 'false');
      toggle.addEventListener('click', () => {
        const enabled = toggle.getAttribute('aria-pressed') !== 'true';
        toggle.setAttribute('aria-pressed', String(enabled));
        options.onSafetyPaths?.(enabled);
      });
      toolbar.append(toggle);
    }
    this.body.append(toolbar);

    const list = document.createElement('div');
    list.className = 'details-categories';
    this.body.append(list);
    for (const definition of DEBUG_CATEGORY_DEFINITIONS) {
      const section = document.createElement('section');
      section.className = 'details-category';
      section.dataset.category = definition.id;
      const categoryToggle = document.createElement('button');
      categoryToggle.type = 'button';
      categoryToggle.className = 'details-category-toggle';
      categoryToggle.setAttribute('aria-controls', `details-${definition.id}`);
      categoryToggle.textContent = `▸ ${definition.title}`;
      const categoryBody = document.createElement('div');
      categoryBody.id = `details-${definition.id}`;
      categoryBody.className = 'details-category-body';
      categoryToggle.addEventListener('click', () => {
        const isExpanded = this.isCategoryExpanded(definition.id);
        if (this.query) this.searchOverrides.set(definition.id, !isExpanded);
        else this.expanded.set(definition.id, !isExpanded);
        this.applyCategoryStates();
      });
      section.append(categoryToggle, categoryBody);
      list.append(section);
      this.categories.set(definition.id, { element: section, toggle: categoryToggle,
        body: categoryBody });
      this.expanded.set(definition.id,
        (DEFAULT_EXPANDED_DEBUG_CATEGORIES as readonly string[]).includes(definition.id));
    }
    parent.append(this.root);
  }

  get isExpanded(): boolean {
    return !this.body.hidden;
  }

  setVisible(visible: boolean): void {
    this.root.hidden = !visible;
  }

  setControlContext(visible: boolean, controlledFaction: 'HUMAN' | 'DEEPSEEK' | null): void {
    if (this.controls.hidden === visible) this.controls.hidden = !visible;
    for (const [faction, button] of this.controlButtons) {
      const pressed = String(controlledFaction === faction);
      if (button.getAttribute('aria-pressed') !== pressed)
        button.setAttribute('aria-pressed', pressed);
    }
  }

  update(context: string, categories: readonly DebugCategory[]): void {
    if (!this.isExpanded || this.root.hidden) return;
    if (this.context.textContent !== context) this.context.textContent = context;
    this.latestCategories = categories;
    for (const category of categories) {
      const view = this.categories.get(category.id);
      if (view) this.syncProperties(view.body, category.properties, category.id);
    }
    this.applyFilter();
  }

  private syncProperties(host: HTMLElement, properties: readonly DebugProperty[], prefix: string): void {
    const elements: HTMLElement[] = [];
    for (const property of properties) {
      const key = `${prefix}/${property.key}`;
      const row = this.ensureRow(key);
      if (row.lastLabel !== property.label) {
        row.label.textContent = property.label;
        row.lastLabel = property.label;
      }
      if (row.lastValue !== property.value) {
        row.value.textContent = property.value;
        row.value.title = property.value;
        row.lastValue = property.value;
      }
      const tone = property.tone ?? 'normal';
      if (row.lastTone !== tone) {
        row.value.dataset.tone = tone;
        row.lastTone = tone;
      }
      this.syncProperties(row.children, property.children ?? [], key);
      const childrenHidden = !property.children?.length;
      if (row.children.hidden !== childrenHidden) row.children.hidden = childrenHidden;
      elements.push(row.element);
    }
    const wanted = new Set(elements);
    for (const child of Array.from(host.children)) {
      if (!wanted.has(child as HTMLElement)) host.removeChild(child);
    }
    elements.forEach((element, index) => {
      if (host.children[index] !== element)
        host.insertBefore(element, host.children[index] ?? null);
    });
  }

  private ensureRow(key: string): RowView {
    const existing = this.rows.get(key);
    if (existing) return existing;
    const element = document.createElement('div');
    element.className = 'details-property';
    element.dataset.property = key;
    const label = document.createElement('span');
    label.className = 'details-property-name';
    const value = document.createElement('span');
    value.className = 'details-property-value';
    const children = document.createElement('div');
    children.className = 'details-property-children';
    element.append(label, value, children);
    const row: RowView = { element, label, value, children,
      lastLabel: '', lastValue: '', lastTone: 'normal' };
    this.rows.set(key, row);
    return row;
  }

  private onSearchChanged(): void {
    const nextQuery = this.search.value.trim();
    if (!this.query && nextQuery) {
      this.searchRestore = new Map(this.expanded);
      this.searchOverrides.clear();
    } else if (this.query && !nextQuery) {
      if (this.searchRestore) this.expanded.clear();
      this.searchRestore?.forEach((value, key) => this.expanded.set(key, value));
      this.searchRestore = null;
      this.searchOverrides.clear();
    }
    this.query = nextQuery;
    this.applyFilter();
  }

  private applyFilter(): void {
    const filtered = filterDebugCategories(this.latestCategories, this.query);
    const visibleIds = new Set(filtered.map(category => category.id));
    const visibleRows = new Set<string>();
    for (const category of filtered)
      this.collectVisibleRows(category.properties, category.id, visibleRows);
    for (const [key, row] of this.rows) {
      const hidden = !visibleRows.has(key);
      if (row.element.hidden !== hidden) row.element.hidden = hidden;
    }
    for (const [id, view] of this.categories) {
      const hidden = !visibleIds.has(id);
      if (view.element.hidden !== hidden) view.element.hidden = hidden;
    }
    this.applyCategoryStates();
  }

  private collectVisibleRows(properties: readonly DebugProperty[], prefix: string,
    result: Set<string>): void {
    for (const property of properties) {
      const key = `${prefix}/${property.key}`;
      result.add(key);
      this.collectVisibleRows(property.children ?? [], key, result);
    }
  }

  private isCategoryExpanded(id: string): boolean {
    if (this.query && this.searchOverrides.has(id)) return this.searchOverrides.get(id)!;
    if (this.query && this.categories.get(id)?.element.hidden === false) return true;
    return this.expanded.get(id) ?? false;
  }

  private applyCategoryStates(): void {
    for (const [id, view] of this.categories) {
      const expanded = this.isCategoryExpanded(id);
      if (view.body.hidden === expanded) view.body.hidden = !expanded;
      const expandedValue = String(expanded);
      if (view.toggle.getAttribute('aria-expanded') !== expandedValue)
        view.toggle.setAttribute('aria-expanded', expandedValue);
      const title = DEBUG_CATEGORY_DEFINITIONS.find(category => category.id === id)?.title ?? id;
      const toggleText = `${expanded ? '▾' : '▸'} ${title}`;
      if (view.toggle.textContent !== toggleText) view.toggle.textContent = toggleText;
    }
  }
}
