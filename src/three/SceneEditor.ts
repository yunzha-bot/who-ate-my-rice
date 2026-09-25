import * as THREE from 'three';
import { MapEditSession, furnitureRect, sceneEditorEnabled,
  type FurnitureDraft, type HideSpotDraft } from './map/MapEditModel.ts';
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
  onFocus: (point: { x: number; z: number }) => void;
  onZoom: (direction: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
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
  return drafts.map(draft => ({ id: draft.id, roomId: draft.roomId, kind: draft.kind,
    furnitureId: draft.furnitureId, label: draft.label, x: draft.x, z: draft.z,
    facing: draft.facing }));
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

// DEV scene-editor orchestration: draft model + Three.js picking/preview view +
// DOM panel. It never writes the authored map file and never mutates gameplay
// data directly; every applied change goes through the game-side rebuild hook.
export class SceneEditor {
  readonly session = new MapEditSession();
  private readonly hooks: SceneEditorHooks;
  private readonly view: SceneEditorView;
  private readonly panel: SceneEditorPanel;
  private opened = false;
  private build: ApartmentBuild | null = null;
  message = '';
  lastRejection = '无';

  constructor(hooks: SceneEditorHooks) {
    this.hooks = hooks;
    const enabled = sceneEditorEnabled(hooks.developerMode, hooks.factionSwitchEnabled);
    this.view = new SceneEditorView({
      camera: hooks.camera,
      dom: hooks.dom,
      onSelect: id => this.select(id),
      onPreview: (id, x, z) => this.preview(id, x, z),
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
      onAnchorsVisible: visible => this.view.setAnchorsVisible(visible),
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
    this.selection = id;
    this.view.select(id);
    if (id) this.view.setPreviewValidity(null);
  }

  focus(id: string): void {
    const target = this.session.get(id);
    if (!target) return;
    this.hooks.onFocus({ x: target.x, z: target.z });
  }

  applyEdits(): boolean {
    const result = this.session.apply();
    this.rebuildFromCommitted();
    if (result.ok) {
      this.message = '已应用编辑：静态碰撞与导航网格已按校验后的数据重建。';
      this.lastRejection = '无';
      return true;
    }
    this.lastRejection = result.rejections[0]?.message ?? '未知拒绝原因';
    this.message = `已拒绝编辑（${result.rejections[0]?.code}）：${this.lastRejection}`;
    return false;
  }

  discardDraft(): void {
    this.session.resetAll();
    this.rebuildFromCommitted();
    this.message = '已放弃未应用的草稿，场景恢复为已应用地图。';
  }

  resetTarget(id: string): void {
    if (!this.session.resetTarget(id)) return;
    this.syncMeshPreview(id);
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
      events: this.eventList(),
    });
  }

  statusEntries(): SceneEditorStatusEntry[] {
    const freezeState: DevRunState = this.hooks.freeze.state;
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
      { label: '编辑草稿是否合法', value: this.session.draftStatus,
        tone: this.session.draftStatus === 'INVALID' ? 'danger'
          : this.session.draftStatus === 'VALID' ? 'warning' : 'normal' },
      { label: '最近拒绝编辑原因', value: this.lastRejection,
        tone: this.lastRejection === '无' ? 'normal' : 'danger' },
      { label: '已应用编辑次数', value: String(this.session.appliedEditCount) },
      { label: '事件计数',
        value: `冻结 ON/OFF ${this.hooks.freeze.eventCounts.on}/${this.hooks.freeze.eventCounts.off}、` +
          `编辑器开/关 ${this.hooks.freeze.eventCounts.editorOpen}/${this.hooks.freeze.eventCounts.editorClose}、` +
          `编辑应用/拒绝 ${this.session.events.filter(event => event.type === 'SCENE_OBJECT_EDIT_APPLY').length}` +
          `/${this.session.events.filter(event => event.type === 'SCENE_OBJECT_EDIT_REJECT').length}` },
      { label: '最近 DEV 事件', value: this.eventTail() || '无' },
    ];
  }

  dispose(): void {
    this.view.dispose();
    this.panel.dispose();
    this.build = null;
  }

  private preview(id: string, x: number, z: number): void {
    this.session.moveTarget(id, x, z);
    this.view.previewPosition(id, x, z);
    this.view.setPreviewValidity(null);
  }

  private commitDrag(id: string): void {
    const rejections = this.session.validateDraft().filter(item => item.targetId === id);
    if (rejections.length) {
      this.session.revertToCommitted(id);
      this.rebuildFromCommitted();
      this.lastRejection = rejections[0].message;
      this.message = `拖动被拒绝（${rejections[0].code}）：${rejections[0].message}`;
      this.view.setPreviewValidity(false);
      return;
    }
    this.view.setPreviewValidity(true);
    this.message = '拖动已写入草稿；点「应用编辑」才会重建碰撞与导航。';
  }

  private changeField(id: string, field: string, value: number): void {
    const rejection = this.session.setField(id, field, value);
    if (rejection) {
      this.lastRejection = rejection.message;
      this.message = `已拒绝修改（${rejection.code}）：${rejection.message}`;
      this.syncMeshPreview(id);
      return;
    }
    this.syncMeshPreview(id);
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
    mesh.rotation.y = draft.rotationQuarter * Math.PI / 2;
    mesh.scale.set(draft.width / authored.width, draft.height / authored.height,
      draft.depth / authored.depth);
  }

  private rebuildFromCommitted(): void {
    const build = this.hooks.onRebuild(committedMap(this.session));
    this.setBuild(build);
    this.view.select(this.selection);
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
