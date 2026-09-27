import type { RuntimeDebugOverrides, RuntimeOverrideSnapshot, RuntimeParamSpec }
  from './RuntimeDebugOverrides.ts';
import { RUNTIME_PARAM_SPECS } from './RuntimeDebugOverrides.ts';
import {
  DEV_B_STORAGE_FORMAT, DEV_B_STORAGE_VERSION, devBParamStorageState, formatDevBSavedAt,
  readDevBPreset, removeDevBPreset, writeDevBPreset, type DevBPresetResult,
  type DevBStorage, type DevBStorageStatus, type DevBStoredPreset,
} from './DevBParamStore.ts';

// DEV-B 参数持久化的编排层：把「本地预设」与「内存覆盖层」接起来。
//
// 关键约定（见 docs/DEV_B_RUNTIME_DEBUG_DESIGN.md §5）：
// - 应用预设**只**通过 `RuntimeDebugOverrides.restore()`，因此 DevBRuntimeBinding
//   的既有副作用（改抓捕半径立即清空抓捕进度、同步抓捕圈）照常触发；
// - 本类从不写 `GAME_CONFIG`，也不碰场景编辑器 V2 的地图存档；
// - `storage === null`（生产构建或浏览器禁用存储）时全部操作安全无副作用，
//   并如实返回失败原因，不虚报成功。

export interface DevBParamPersistenceOptions {
  runtime: RuntimeDebugOverrides;
  storage: DevBStorage | null;
  specs?: readonly RuntimeParamSpec[];
  /** 注入时钟，便于测试固定 `savedAt`。 */
  now?: () => Date;
}

export interface DevBApplyResult {
  ok: boolean;
  /** 真正应用（或试图应用）的覆盖项数。 */
  applied: number;
  message: string;
}

export interface DevBPersistenceStatus extends DevBStorageStatus {
  /** 最近一次读取/保存失败的中文原因；成功时为 null。 */
  error: string | null;
}

export class DevBParamPersistence {
  private readonly runtime: RuntimeDebugOverrides;
  private readonly storage: DevBStorage | null;
  private readonly specs: readonly RuntimeParamSpec[];
  private readonly now: () => Date;
  private preset: DevBStoredPreset | null = null;
  private lastError: string | null = null;

  constructor(options: DevBParamPersistenceOptions) {
    this.runtime = options.runtime;
    this.storage = options.storage;
    this.specs = options.specs ?? RUNTIME_PARAM_SPECS;
    this.now = options.now ?? (() => new Date());
  }

  /** 仅开发环境且存储可用时为 true；生产构建永远为 false。 */
  get enabled(): boolean { return this.storage !== null; }

  get error(): string | null { return this.lastError; }

  get hasPreset(): boolean { return this.preset !== null; }

  get savedAt(): string | null { return this.preset?.savedAt ?? null; }

  /** 读取并严格校验本地预设；失败时记录原因并保持「没有预设」。 */
  read(): DevBPresetResult {
    const result = readDevBPreset(this.storage, this.specs);
    if (result.ok) {
      this.preset = result.preset;
      this.lastError = null;
    } else {
      this.preset = null;
      // EMPTY 不是错误：本地本来就没有预设。
      this.lastError = result.code === 'EMPTY' ? null
        : `${result.code}：${result.message}`;
    }
    return result;
  }

  /**
   * 重新读取并应用本地预设（开机 / 新局 / 手动加载共用）。
   * 没有预设、读取失败或环境不支持时保持正式默认值，并给出原因。
   */
  applySaved(reason: string): DevBApplyResult {
    if (!this.enabled) {
      return { ok: false, applied: 0, message: '当前构建不启用 DEV-B 本地预设（仅开发环境可用）' };
    }
    const result = this.read();
    if (!result.ok) {
      if (result.code === 'EMPTY') {
        return { ok: true, applied: 0, message: `本地没有已保存的 DEV-B 预设，继续使用正式默认值（${reason}）` };
      }
      return { ok: false, applied: 0,
        message: `本地预设不可用，已回退正式默认值：${result.message}（${result.code}）` };
    }
    return this.applyPreset(result.preset, reason);
  }

  private applyPreset(preset: DevBStoredPreset, reason: string): DevBApplyResult {
    const applied = Object.keys(preset.params).length;
    // 只走覆盖层的正式入口：restore() 之后，DevBRuntimeBinding 会按需清空
    // 旧抓捕进度并把抓捕圈同步到新半径。
    this.runtime.restore(preset.params);
    const savedAt = preset.savedAt ? `，保存于 ${formatDevBSavedAt(preset.savedAt)}` : '';
    return { ok: true, applied,
      message: `已恢复本地预设的 ${applied} 项覆盖（${reason}${savedAt}）` };
  }

  /** 保存当前覆盖值；只在真正写入且回读一致后报成功。 */
  save(): DevBApplyResult {
    if (!this.enabled) {
      return { ok: false, applied: 0, message: '当前构建不启用 DEV-B 本地预设（仅开发环境可用）' };
    }
    const current = this.runtime.snapshot();
    const savedAt = this.now().toISOString();
    const result = writeDevBPreset(this.storage, current, savedAt);
    if (!result.ok) {
      this.lastError = `${result.code}：${result.message}`;
      return { ok: false, applied: 0, message: `保存失败：${result.message}（${result.code}）` };
    }
    this.lastError = null;
    this.preset = { format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION, savedAt,
      params: { ...current } };
    return { ok: true, applied: Object.keys(current).length,
      message: `已保存 ${Object.keys(current).length} 项调试参数到本地预设（${formatDevBSavedAt(savedAt)}）` };
  }

  /** 删除本地预设（调用方负责先确认）；当前页面内存中的覆盖值不受影响。 */
  remove(): DevBApplyResult {
    if (!this.enabled) {
      return { ok: false, applied: 0, message: '当前构建不启用 DEV-B 本地预设（仅开发环境可用）' };
    }
    const result = removeDevBPreset(this.storage);
    if (!result.ok) {
      this.lastError = `${result.code}：${result.message}`;
      return { ok: false, applied: 0, message: `删除失败：${result.message}（${result.code}）` };
    }
    this.preset = null;
    this.lastError = null;
    return { ok: true, applied: 0, message: '已删除本地保存的 DEV-B 调试预设（内存中的当前覆盖值保持不变）' };
  }

  /** 面板三态：正式默认值 / 已保存 / 未保存修改，外加最近一次失败原因。 */
  status(): DevBPersistenceStatus {
    const base = devBParamStorageState({ current: this.runtime.snapshot(), preset: this.preset });
    return { ...base, error: this.lastError };
  }

  /** 供面板使用的当前覆盖快照（只读）。 */
  current(): RuntimeOverrideSnapshot { return this.runtime.snapshot(); }
}
