import type * as THREE from 'three';
import type { RuntimeDebugOverrides, RuntimeParamResult } from '../systems/RuntimeDebugOverrides';
import type { DevBParamPersistence } from '../systems/DevBParamPersistence';
import { buildDevBObservation, type DevBObservationInput } from '../systems/DevBObserver.ts';
import { DevBPanel, type DevBVisualKey } from './DevBPanel.ts';
import { DevBView, DEV_B_DEFAULT_OPTIONS, type DevBViewFrame } from './DevBView.ts';

// DEV-B orchestrator: one runtime override layer, one read-only observer and one
// scene visualization, all three fed by the same values.

export interface DevBDebugOptions {
  container: HTMLElement;
  topRow: HTMLElement;
  scene: THREE.Object3D;
  runtime: RuntimeDebugOverrides;
  developerMode: boolean;
  collectObservation: () => DevBObservationInput;
  collectFrame: () => DevBViewFrame;
  /** DEV 本地预设（仅开发环境提供；缺省＝不启用持久化）。 */
  persistence?: DevBParamPersistence | null;
  /** 删除本地预设前的确认；缺省用浏览器 confirm，测试可注入。 */
  confirm?: (message: string) => boolean;
}

/** 删除本地预设前必须确认：只删预设，不动当前页面内存里的覆盖值。 */
export const DEV_B_DELETE_CONFIRM =
  '删除本地保存的 DEV-B 调试预设？当前页面内存里的覆盖值不会被清除；若要回到正式值，请点「恢复正式默认值」。';

// The observer refreshes inside the requested 5-10 Hz window; the scene view is
// cheap and follows the same tick.
export const DEV_B_REFRESH_MS = 120;

export class DevBDebug {
  readonly runtime: RuntimeDebugOverrides;
  readonly view: DevBView;
  private readonly panel: DevBPanel;
  private readonly options: DevBDebugOptions;
  private openSnapshot: ReturnType<RuntimeDebugOverrides['snapshot']> = {};
  private elapsedMs = 0;

  constructor(options: DevBDebugOptions) {
    this.options = options;
    this.runtime = options.runtime;
    this.view = new DevBView(options.scene);
    this.view.setOptions(DEV_B_DEFAULT_OPTIONS);
    this.panel = new DevBPanel({
      container: options.container,
      topRow: options.topRow,
      developerMode: options.developerMode,
      storageEnabled: this.persistence?.enabled ?? false,
      onOpen: () => this.handleOpen(),
      onClose: () => this.handleClose(),
      onParamChange: (id, value) => this.handleParamChange(id, value),
      onRestoreOpenSnapshot: () => this.handleRestoreOpenSnapshot(),
      onRestoreDefaults: () => this.handleRestoreDefaults(),
      onVisualOption: (key, enabled) => this.handleVisualOption(key, enabled),
      onSaveParams: () => this.handleSaveParams(),
      onLoadSavedParams: () => this.handleLoadSavedParams(),
      onDeleteSavedParams: () => this.handleDeleteSavedParams(),
    });
    this.panel.setVisualOptions(DEV_B_DEFAULT_OPTIONS);
  }

  get isOpen(): boolean { return this.panel.isOpen; }

  private get persistence(): DevBParamPersistence | null {
    return this.options.persistence ?? null;
  }
  get visualizationEnabled(): boolean {
    const state = this.view.options;
    return state.captureRing || state.visionCircle || state.lineOfSight || state.paths ||
      state.sounds || state.clues;
  }

  toggle(): void { this.panel.toggle(); }

  onFrame(deltaMs: number): void {
    this.elapsedMs += Math.max(0, deltaMs);
    if (this.elapsedMs < DEV_B_REFRESH_MS) return;
    this.elapsedMs = 0;
    if (this.panel.isOpen) {
      this.renderPanel();
    }
    if (this.visualizationEnabled) this.view.update(this.options.collectFrame());
  }

  private handleOpen(): void {
    this.openSnapshot = this.runtime.snapshot();
    this.renderPanel();
    if (this.visualizationEnabled) this.view.update(this.options.collectFrame());
  }

  private handleClose(): void {
    // Temporary parameters stay in memory and keep being used by the game.
  }

  private handleParamChange(id: string, value: number): RuntimeParamResult {
    const result = this.runtime.set(id, value);
    this.renderPanel();
    return result;
  }

  private handleRestoreOpenSnapshot(): string {
    const count = Object.keys(this.openSnapshot).length;
    this.runtime.restore(this.openSnapshot);
    this.renderPanel();
    return count > 0
      ? `已恢复到打开 DEV-B 时的 ${count} 项临时参数`
      : '打开 DEV-B 时没有临时参数，当前仍为正式基准值';
  }

  private handleRestoreDefaults(): string {
    const cleared = this.runtime.clearAll();
    this.renderPanel();
    // 恢复正式值**不删除**已保存的本地预设（需求明确要求二者分开）。
    const kept = this.persistence?.hasPreset ? '；本地预设保留，可点「加载已保存预设」恢复' : '';
    return cleared > 0
      ? `已清除 ${cleared} 项临时覆盖，回到正式 GAME_CONFIG 值${kept}`
      : `当前没有临时覆盖，已是正式 GAME_CONFIG 值${kept}`;
  }

  private handleSaveParams(): string {
    const persistence = this.persistence;
    if (!persistence) return '当前构建不启用 DEV-B 本地预设（仅开发环境可用）';
    const result = persistence.save();
    this.renderPanel();
    return result.message;
  }

  private handleLoadSavedParams(): string {
    const persistence = this.persistence;
    if (!persistence) return '当前构建不启用 DEV-B 本地预设（仅开发环境可用）';
    const result = persistence.applySaved('手动加载');
    this.renderPanel();
    return result.message;
  }

  private handleDeleteSavedParams(): string {
    const persistence = this.persistence;
    if (!persistence) return '当前构建不启用 DEV-B 本地预设（仅开发环境可用）';
    const ask = this.options.confirm ?? defaultDevBConfirm;
    if (!ask(DEV_B_DELETE_CONFIRM)) return '已取消删除本地预设';
    const result = persistence.remove();
    this.renderPanel();
    return result.message;
  }

  private handleVisualOption(key: DevBVisualKey, enabled: boolean): void {
    this.view.setOptions({ [key]: enabled } as Partial<typeof DEV_B_DEFAULT_OPTIONS>);
    if (!this.visualizationEnabled) {
      this.view.update(this.options.collectFrame());
      return;
    }
    this.view.update(this.options.collectFrame());
  }

  private renderPanel(): void {
    this.panel.renderParams(this.runtime.list(), id => this.runtime.get(id),
      id => this.runtime.isOverridden(id), this.runtime.overrideCount,
      this.persistence?.status());
    this.panel.renderObservation(buildDevBObservation(this.options.collectObservation()));
    this.panel.setContext(this.runtime.overrideCount > 0
      ? `IN-MEMORY · 覆盖 ${this.runtime.overrideCount} 项` : 'IN-MEMORY · 正式基准');
  }

  dispose(): void {
    this.panel.dispose();
    this.view.dispose();
  }
}

/**
 * 默认确认实现。拿不到真实的 `confirm`（例如无 DOM 的测试环境）时返回 false：
 * 宁可拒绝删除，也不静默删掉用户保存的预设。
 */
function defaultDevBConfirm(message: string): boolean {
  const ask = (globalThis as { confirm?: (text: string) => boolean }).confirm;
  return typeof ask === 'function' ? ask.call(globalThis, message) : false;
}
