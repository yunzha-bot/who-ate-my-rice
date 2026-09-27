import * as THREE from 'three';
import { MapEditSession, authoredMapSource, furnitureRect, sceneEditorEnabled,
  spotDraftToAnchor, type FurnitureDraft, type HideSpotDraft, type MapSource,
  type MapExportDocument } from './map/MapEditModel.ts';
import { authoredLayoutDocument, importLayoutText, layoutSignature, layoutSource,
  layoutStatus, writeSavedLayout, type LayoutStatus, type LayoutStorage }
  from './map/MapLayoutStore.ts';
import { degreesToRadians } from './map/RotatedRect.ts';
import { SceneEditorView } from './SceneEditorView.ts';
import { SceneEditorPanel } from './SceneEditorPanel.ts';
import type { ApartmentBuild } from './map/MapBuilder';
import type { DevFreezeSystem, DevRunState } from '../systems/DevFreezeSystem.ts';
import type { GamePhase } from '../systems/GameStateSystem.ts';
import type { HideSpot, Rect } from './map/apartmentMap.ts';

export interface CommittedMap {
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
}

export interface SceneEditorHooks {
  container: HTMLElement;
  topRow: HTMLElement;
  camera: THREE.OrthographicCamera;
  dom: HTMLElement;
  freeze: DevFreezeSystem;
  developerMode: boolean;
  factionSwitchEnabled: boolean;
  getPhase: () => GamePhase;
  // Game-side safe rebuild: the caller replaces the static collision world and
  // the navigation grid from the validated data, then returns the new build.
  onRebuild: (map: CommittedMap) => ApartmentBuild;
  // S7C-1B: a read-only precheck that runs BEFORE the draft is committed. It
  // returns a rejection message when the candidate map would leave an actor (or
  // a concealed player's exit position) standing somewhere illegal; the caller
  // then refuses the application and keeps the current map and hide state.
  onPrecheck?: (map: CommittedMap) => string | null;
  onFocus: (point: { x: number; z: number }) => void;
  onZoom: (direction: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
  // V2 布局持久化：编辑会话的起点（开机时可能已经是恢复出来的本地布局）、
  // 存档接口、当前存档签名，以及「恢复默认地图」的确认回调（测试可注入）。
  mapSource?: MapSource;
  layoutStorage?: LayoutStorage | null;
  savedLayoutSignature?: string | null;
  savedLayoutAt?: string | null;
  // 开机恢复失败的原因（没有存档时由调用方传 null）；只用于 DEV 读数与面板。
  savedLayoutError?: string | null;
  confirm?: (message: string) => boolean;
}

export interface SceneEditorStatusEntry {
  label: string;
  value: string;
  tone?: 'normal' | 'warning' | 'danger' | 'success' | 'curious';
}

export function draftFurnitureToRects(drafts: readonly FurnitureDraft[]): Rect[] {
  return drafts.map(furnitureRect);
}

export function draftSpotsToAnchors(drafts: readonly HideSpotDraft[]): HideSpot[] {
  return drafts.map(spotDraftToAnchor);
}

export function committedMap(session: MapEditSession): CommittedMap {
  const committed = session.cloneCommitted();
  return { furniture: draftFurnitureToRects(committed.furniture),
    hideSpots: draftSpotsToAnchors(committed.hideSpots) };
}

// A refused open request must be readable at the launcher itself. Before the
// match reaches PLAYING the only allowed reason is the phase gate, so that case
// gets a short player-facing sentence; anything else reports the rejection.
export function sceneEditorRefusalNotice(phase: GamePhase, rejection: string): string {
  return phase === 'PLAYING'
    ? `场景编辑未打开：${rejection}`
    : `场景编辑需要先进入对局（当前 ${phase}）`;
}

export const RESTORE_DEFAULT_CONFIRM =
  '恢复默认地图将丢弃当前已应用的编辑（浏览器本地存档与已导出的 JSON 不会被删除）。确认继续？';

// DEV scene-editor orchestration: draft model + Three.js picking/preview view +
// DOM panel. It never writes the authored map file and never mutates gameplay
// data directly; every applied change goes through the game-side rebuild hook.
export class SceneEditor {
  readonly session: MapEditSession;
  private readonly hooks: SceneEditorHooks;
  private readonly view: SceneEditorView;
  private readonly panel: SceneEditorPanel;
  private opened = false;
  private regionPreviewVisible = true;
  private draggingId: string | null = null;
  private build: ApartmentBuild | null = null;
  // V2：本地存档的签名与时间，以及最近一次导入 / 恢复的失败原因。存档签名只在
  // 「开机恢复」与「保存成功」时更新，因此「未保存修改」是应用数据与存档的真实差异。
  private savedLayoutSignature: string | null;
  private savedLayoutAt: string | null;
  private lastLayoutError: string | null = null;
  message = '';
  lastRejection = '无';

  constructor(hooks: SceneEditorHooks) {
    this.hooks = hooks;
    this.session = new MapEditSession(hooks.mapSource ?? authoredMapSource());
    this.savedLayoutSignature = hooks.savedLayoutSignature ?? null;
    this.savedLayoutAt = hooks.savedLayoutAt ?? null;
    this.lastLayoutError = hooks.savedLayoutError ?? null;
    const enabled = sceneEditorEnabled(hooks.developerMode, hooks.factionSwitchEnabled);
    this.view = new SceneEditorView({
      camera: hooks.camera,
      dom: hooks.dom,
      onSelect: id => this.select(id),
      onPreview: (id, x, z) => this.preview(id, x, z),
      onDragStart: id => this.beginDrag(id),
      onCommit: id => this.commitDrag(id),
      onZoom: hooks.onZoom,
      onPan: hooks.onPan,
    });
    this.panel = new SceneEditorPanel({
      container: hooks.container,
      topRow: hooks.topRow,
      enabled,
      onOpen: () => this.requestOpen(),
      onClose: () => this.close(),
      onSelect: id => this.select(id),
      onFocus: id => this.focus(id),
      onFieldChange: (id, field, value) => this.changeField(id, field, value),
      onApply: () => this.applyEdits(),
      onDiscard: () => this.discardDraft(),
      onResetTarget: id => this.resetTarget(id),
      onExport: () => this.exportMap(),
      onSave: () => this.saveLayout(),
      onImportFile: file => { void this.importLayoutFile(file); },
      onRestoreDefault: () => this.restoreDefaultLayout(),
      onAnchorsVisible: visible => this.view.setAnchorsVisible(visible),
      onRegionPreviewVisible: visible => {
        this.regionPreviewVisible = visible;
        this.refreshRegionPreview();
      },
      onRotationSnapChange: enabled => this.session.setRotationSnap(enabled),
    });
  }

  get isOpen(): boolean { return this.opened; }

  get selectedId(): string | null { return this.selection; }

  private selection: string | null = null;

  setBuild(build: ApartmentBuild): void {
    this.build = build;
    this.view.setBuild(build);
  }

  requestOpen(): boolean {
    if (this.opened) return true;
    const phase = this.hooks.getPhase();
    if (!this.hooks.freeze.openSceneEditor(phase)) {
      this.message = `无法进入场景编辑：${this.hooks.freeze.lastRejection}`;
      this.lastRejection = this.message;
      this.panel.showNotice(sceneEditorRefusalNotice(phase, this.hooks.freeze.lastRejection));
      return false;
    }
    this.opened = true;
    this.view.setActive(true);
    this.panel.setOpen(true);
    this.message = '已进入场景编辑：双阵营自动冻结。应用编辑后碰撞与导航会安全重建。';
    this.onFrame();
    return true;
  }

  close(): void {
    if (!this.opened) return;
    this.endDragWindow();
    // Unapplied drafts are never kept: closing clears the preview and restores
    // the last applied map. Applied edits stay in memory.
    this.session.resetAll();
    this.selection = null;
    this.hooks.freeze.closeSceneEditor();
    this.opened = false;
    this.view.select(null);
    this.view.setActive(false);
    this.panel.setOpen(false);
    this.rebuildFromCommitted();
    this.message = '已退出场景编辑；手动冻结（若之前已按下）仍然生效。';
  }

  select(id: string | null): void {
    // The dragged object stays selected until the release: switching selection
    // mid-drag would point the region preview at another object.
    if (this.draggingId && id !== this.draggingId) return;
    this.selection = id;
    this.view.select(id);
    if (id) this.view.setPreviewValidity(null);
    this.refreshRegionPreview();
  }

  focus(id: string): void {
    const target = this.session.get(id);
    if (!target) return;
    this.hooks.onFocus({ x: target.x, z: target.z });
  }

  applyEdits(): boolean {
    this.endDragWindow();
    // The precheck runs against the draft that WOULD be applied, before
    // `session.apply()` commits anything: a refused map application must leave
    // the old map and the old hide state completely untouched.
    const candidate: CommittedMap = {
      furniture: draftFurnitureToRects(this.session.furnitureList()),
      hideSpots: draftSpotsToAnchors(this.session.hideSpotList()),
    };
    const precheckRejection = this.hooks.onPrecheck?.(candidate) ?? null;
    if (precheckRejection) {
      this.lastRejection = precheckRejection;
      this.message = `已拒绝应用（地图预检失败）：${precheckRejection}`;
      this.panel.showNotice(this.message);
      return false;
    }
    const result = this.session.apply();
    this.rebuildFromCommitted();
    if (result.ok) {
      this.refreshRegionPreview();
      this.message = '已应用编辑：静态碰撞与导航网格已按校验后的数据重建。';
      this.lastRejection = '无';
      return true;
    }
    this.lastRejection = result.rejections[0]?.message ?? '未知拒绝原因';
    this.message = `已拒绝编辑（${result.rejections[0]?.code}）：${this.lastRejection}`;
    return false;
  }

  discardDraft(): void {
    this.endDragWindow();
    this.session.resetAll();
    this.rebuildFromCommitted();
    this.message = '已放弃未应用的草稿，场景恢复为已应用地图。';
  }

  resetTarget(id: string): void {
    if (!this.session.resetTarget(id)) return;
    this.syncMeshPreview(id);
    this.refreshRegionPreview();
    this.message = `${id} 已恢复为初始白模数值（仍需点「应用编辑」写入地图）。`;
  }

  exportMap(): void {
    const data = this.session.exportJson();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `who-ate-my-rice-map-${stamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    this.message = '已导出当前已应用地图 JSON（含藏身锚点与朝向）。';
  }

  // ---- V2：布局状态 / 保存 / 导入 / 恢复默认地图 ----------------------------

  // 布局状态只看「已应用数据」：草稿是否有未应用修改由 `draftStatus` 单独报告。
  layoutStatus(): LayoutStatus {
    return layoutStatus({
      appliedSignature: layoutSignature(this.session.exportJson()),
      savedSignature: this.savedLayoutSignature,
      authoredSignature: layoutSignature(authoredLayoutDocument()),
      lastError: this.lastLayoutError,
    });
  }

  get layoutSavedAt(): string | null { return this.savedLayoutAt; }

  get layoutError(): string | null { return this.lastLayoutError; }

  // 保存的是「已应用」布局：有未应用草稿时先拒绝，绝不把半成品写进本地存档；
  // `writeSavedLayout` 只在 setItem 真正成功后返回 ok，因此不会虚报保存成功。
  saveLayout(): boolean {
    if (this.session.isDirty) {
      this.message = '保存被拒绝：还有未应用的草稿，请先点「应用编辑」再保存布局。';
      this.panel.showNotice(this.message);
      return false;
    }
    const result = writeSavedLayout(this.hooks.layoutStorage ?? null, this.session.exportJson());
    if (!result.ok) {
      this.lastLayoutError = `${result.code}：${result.message}`;
      this.message = `保存布局失败（${result.code}）：${result.message}`;
      this.panel.showNotice(this.message);
      return false;
    }
    this.savedLayoutSignature = layoutSignature(result.envelope.document);
    this.savedLayoutAt = result.envelope.savedAt;
    this.lastLayoutError = null;
    this.message = `已保存布局到浏览器本地存档：${result.envelope.savedAt}。`;
    this.panel.showNotice(this.message);
    return true;
  }

  // 文件读取失败（包括用户选了非文本文件）也只报告，不改变当前地图。
  async importLayoutFile(file: File): Promise<boolean> {
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      this.lastLayoutError = `READ_FAILED：读取文件失败（${String(error)}）`;
      this.message = `导入失败：${this.lastLayoutError}`;
      this.panel.showNotice(this.message);
      return false;
    }
    return this.importLayout(text);
  }

  importLayout(text: string): boolean {
    const result = importLayoutText(text);
    if (!result.ok) {
      this.lastLayoutError = `${result.code}：${result.message}`;
      this.message = `导入失败（${result.code}）：${result.message}`;
      this.panel.showNotice(this.message);
      return false;
    }
    if (!this.commitLayoutSource(layoutSource(result.document), '导入')) return false;
    this.message = `已导入布局：家具 ${result.document.furniture.length} 件 / ` +
      `藏身点 ${result.document.hideSpots.length} 个；尚未写入本地存档。`;
    this.panel.showNotice(this.message);
    return true;
  }

  restoreDefaultLayout(): boolean {
    const confirm = this.hooks.confirm ?? (message => window.confirm(message));
    if (!confirm(RESTORE_DEFAULT_CONFIRM)) {
      this.message = '已取消恢复默认地图（本地存档与已导出的 JSON 备份都未改动）。';
      this.panel.showNotice(this.message);
      return false;
    }
    if (!this.commitLayoutSource(authoredMapSource(), '恢复默认地图')) return false;
    this.message = '已恢复默认地图；本地存档与已导出的 JSON 备份保留，可再次保存覆盖。';
    this.panel.showNotice(this.message);
    return true;
  }

  // 导入与恢复默认共用同一条安全链路：先跑 S7C-1B 地图预检，再换源，再走既有的
  // 碰撞 / 导航 / AI 重绑定重建。预检失败时旧地图、角色站位与藏身状态原样保留。
  private commitLayoutSource(source: MapSource, label: string): boolean {
    const candidate: CommittedMap = { furniture: source.furniture,
      hideSpots: source.hideSpots };
    const precheckRejection = this.hooks.onPrecheck?.(candidate) ?? null;
    if (precheckRejection) {
      this.lastLayoutError = precheckRejection;
      this.message = `${label}被拒绝（地图预检失败）：${precheckRejection}`;
      this.panel.showNotice(this.message);
      return false;
    }
    this.session.replaceSource(source);
    this.rebuildFromCommitted();
    this.lastLayoutError = null;
    return true;
  }

  onFrame(): void {
    if (!this.opened) return;
    this.panel.render(this.session, {
      open: true,
      freezeState: this.hooks.freeze.state,
      freezeReason: this.hooks.freeze.reasonLabel,
      selection: this.selection,
      draftStatus: this.session.draftStatus,
      lastRejection: this.lastRejection,
      appliedCount: this.session.appliedEditCount,
      anchorsVisible: this.view.anchorsAreVisible,
      rotationSnap: this.session.rotationSnapEnabled,
      events: this.eventList(),
      layout: this.layoutStatus(),
      layoutSavedAt: this.savedLayoutAt,
      layoutError: this.lastLayoutError,
      layoutStorageAvailable: !!this.hooks.layoutStorage,
    });
  }

  statusEntries(): SceneEditorStatusEntry[] {
    const freezeState: DevRunState = this.hooks.freeze.state;
    // One cached read for all three rows: the full map validation must not run
    // once per row per frame.
    const draftStatus = this.session.draftStatus;
    const layout = this.layoutStatus();
    return [
      { label: '双阵营状态', value: freezeState,
        tone: freezeState === 'FROZEN' ? 'warning' : 'success' },
      { label: '冻结原因', value: this.hooks.freeze.reasonLabel },
      { label: '进入冻结前的游戏状态',
        value: this.hooks.freeze.frozenFromPhase
          ? `${this.hooks.freeze.frozenFromPhase}${this.hooks.freeze.frozenFromSummary
            ? `｜${this.hooks.freeze.frozenFromSummary}` : ''}` : '无（未冻结）' },
      { label: '最近一次冻结操作被拒绝', value: this.hooks.freeze.lastRejection },
      { label: '场景编辑', value: this.opened ? '已开启' : '已关闭',
        tone: this.opened ? 'curious' : 'normal' },
      { label: '当前选中物体', value: this.selection ?? '无' },
      { label: '编辑草稿是否合法', value: draftStatus,
        tone: draftStatus === 'INVALID' ? 'danger'
          : draftStatus === 'VALID' ? 'warning' : 'normal' },
      { label: '最近拒绝编辑原因', value: this.lastRejection,
        tone: this.lastRejection === '无' ? 'normal' : 'danger' },
      { label: '已应用编辑次数', value: String(this.session.appliedEditCount) },
      { label: '布局状态', value: `${layout.label}｜${layout.text}`,
        tone: layout.label === 'IMPORT_FAILED' ? 'danger'
          : layout.label === 'UNSAVED' ? 'warning'
            : layout.label === 'SAVED' ? 'success' : 'normal' },
      { label: '本地布局存档', value: this.savedLayoutAt
        ? `已保存（${this.savedLayoutAt}）`
        : (this.hooks.layoutStorage ? '无（尚未保存过）' : 'localStorage 不可用') },
      { label: '未保存修改', value: layout.pending ? '是' : '否',
        tone: layout.pending ? 'warning' : 'success' },
      { label: '最近导入 / 恢复失败', value: this.lastLayoutError ?? '无',
        tone: this.lastLayoutError ? 'danger' : 'normal' },
      { label: '事件计数',
        value: `冻结 ON/OFF ${this.hooks.freeze.eventCounts.on}/${this.hooks.freeze.eventCounts.off}、` +
          `编辑器开/关 ${this.hooks.freeze.eventCounts.editorOpen}/${this.hooks.freeze.eventCounts.editorClose}、` +
          `编辑应用/拒绝 ${this.session.events.filter(event => event.type === 'SCENE_OBJECT_EDIT_APPLY').length}` +
          `/${this.session.events.filter(event => event.type === 'SCENE_OBJECT_EDIT_REJECT').length}` },
      { label: '最近 DEV 事件', value: this.eventTail() || '无' },
    ];
  }

  dispose(): void {
    this.endDragWindow();
    this.view.dispose();
    this.panel.dispose();
    this.build = null;
  }

  // A drag rewrites the draft on every pointermove, so the per-frame status read
  // must not run the full map validation (collision world + navigation grid +
  // flood fill + region sampling). The window is opened on pointerdown and the
  // release path validates exactly once. Illegal drafts still cannot reach the
  // map: applyEdits() revalidates the whole draft before committing anything.
  private beginDrag(id: string): void {
    this.draggingId = id;
    this.session.beginDeferredValidation();
  }

  private endDragWindow(): void {
    this.draggingId = null;
    this.session.endDeferredValidation();
  }

  private preview(id: string, x: number, z: number): void {
    // Lightweight per-move path only: draft values, the furniture mesh, its
    // linked anchors and the exact region outline. No map validation, no region
    // sampling and no geometry rebuild.
    this.session.moveTarget(id, x, z);
    this.syncMeshPreview(id);
    this.refreshRegionPreview(false);
    this.view.setPreviewValidity(null);
  }

  private commitDrag(id: string): void {
    this.endDragWindow();
    const linkedSpot = this.session.hideSpotForTarget(id);
    const rejections = this.session.validateDraft().filter(item =>
      item.targetId === id || item.targetId === linkedSpot);
    if (rejections.length) {
      this.session.revertToCommitted(id);
      this.rebuildFromCommitted();
      this.lastRejection = rejections[0].message;
      this.message = `拖动被拒绝（${rejections[0].code}）：${rejections[0].message}`;
      this.view.setPreviewValidity(false);
      this.refreshRegionPreview();
      return;
    }
    this.view.setPreviewValidity(true);
    this.refreshRegionPreview();
    this.message = '拖动已写入草稿；点「应用编辑」才会重建碰撞与导航。';
  }

  private changeField(id: string, field: string, value: number): void {
    const rejection = this.session.setField(id, field, value);
    if (rejection) {
      this.lastRejection = rejection.message;
      this.message = `已拒绝修改（${rejection.code}）：${rejection.message}`;
      this.syncMeshPreview(id);
      this.refreshRegionPreview();
      return;
    }
    this.syncMeshPreview(id);
    this.refreshRegionPreview();
    this.message = `${id}.${field} = ${value} 已写入草稿（未应用）。`;
  }

  private syncMeshPreview(id: string): void {
    const draft = this.session.get(id);
    if (!draft) return;
    if (draft.editKind === 'HIDE_SPOT') {
      this.view.previewPosition(id, draft.x, draft.z);
      return;
    }
    const authored = this.session.sourceMap.furniture.find(rect => rect.id === id);
    if (!authored || !this.build) return;
    const mesh = this.build.furnitureMeshes.get(id);
    if (!mesh) return;
    mesh.position.set(draft.x, draft.height / 2, draft.z);
    mesh.rotation.y = degreesToRadians(draft.rotationDeg);
    mesh.scale.set(draft.width / authored.width, draft.height / authored.height,
      draft.depth / authored.depth);
    for (const spot of this.session.hideSpotList()) {
      if (spot.furnitureId === id) this.view.previewPosition(spot.id, spot.x, spot.z);
    }
  }

  private refreshRegionPreview(includeSamples = true): void {
    if (!this.regionPreviewVisible || !this.opened || !this.selection) {
      this.view.setRegionPreview(null);
      return;
    }
    const preview = this.session.regionPreview(this.selection, includeSamples);
    this.view.setRegionPreview(preview ? {
      geometry: preview.geometry,
      samples: preview.sampling?.samples ?? null,
      sampleStep: preview.sampleStep,
    } : null);
  }

  private rebuildFromCommitted(): void {
    const build = this.hooks.onRebuild(committedMap(this.session));
    this.setBuild(build);
    this.view.select(this.selection);
    this.refreshRegionPreview();
  }

  private eventList(): string[] {
    const freezeEvents = this.hooks.freeze.events.slice(-3)
      .map(event => `${event.type}${event.reason ? `(${event.reason})` : ''}`);
    const editEvents = this.session.events.slice(-2).map(event => event.type);
    return [...freezeEvents, ...editEvents];
  }

  private eventTail(): string {
    return this.eventList().join(' → ');
  }
}
