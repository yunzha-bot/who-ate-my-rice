import type * as THREE from 'three';
import type { RuntimeDebugOverrides, RuntimeParamResult } from '../systems/RuntimeDebugOverrides';
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
}

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
      onOpen: () => this.handleOpen(),
      onClose: () => this.handleClose(),
      onParamChange: (id, value) => this.handleParamChange(id, value),
      onRestoreOpenSnapshot: () => this.handleRestoreOpenSnapshot(),
      onRestoreDefaults: () => this.handleRestoreDefaults(),
      onVisualOption: (key, enabled) => this.handleVisualOption(key, enabled),
    });
    this.panel.setVisualOptions(DEV_B_DEFAULT_OPTIONS);
  }

  get isOpen(): boolean { return this.panel.isOpen; }
  get visualizationEnabled(): boolean {
    const state = this.view.options;
    return state.captureRing || state.visionCircle || state.lineOfSight || state.paths ||
      state.sounds;
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
    return cleared > 0
      ? `已清除 ${cleared} 项临时覆盖，回到正式 GAME_CONFIG 值`
      : '当前没有临时覆盖，已是正式 GAME_CONFIG 值';
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
      id => this.runtime.isOverridden(id), this.runtime.overrideCount);
    this.panel.renderObservation(buildDevBObservation(this.options.collectObservation()));
    this.panel.setContext(this.runtime.overrideCount > 0
      ? `IN-MEMORY · 覆盖 ${this.runtime.overrideCount} 项` : 'IN-MEMORY · 正式基准');
  }

  dispose(): void {
    this.panel.dispose();
    this.view.dispose();
  }
}
