import type { RuntimeOverrideSnapshot, RuntimeParamSpec } from './RuntimeDebugOverrides.ts';

// DEV-B 运行时调试参数的本地预设（browser localStorage）。
//
// 覆盖层仍然是**唯一有效值来源**：本模块只负责把一份白名单快照序列化进
// localStorage，并在读回时严格校验。它不写 `GAME_CONFIG`，不使用场景编辑器
// V2 的地图存档键（`MapLayoutStore.ts`），也不在生产构建中读或应用任何值。
//
// 存档形状（带版本，格式不符一律拒绝而不是猜着用）：
//   { format: 'who-ate-my-rice/dev-b-params', version: 1, savedAt, params: {...} }
//
// 恢复必须由 `DevBParamPersistence` 走 `RuntimeDebugOverrides.restore()`，
// 这样 `DevBRuntimeBinding` 的既有副作用（改抓捕半径立即清空抓捕进度、
// 同步抓捕圈视图）与手动调参完全一致。

export const DEV_B_STORAGE_KEY = 'who-ate-my-rice/dev-b-runtime-params';
export const DEV_B_STORAGE_FORMAT = 'who-ate-my-rice/dev-b-params';
export const DEV_B_STORAGE_VERSION = 1;

/** 本模块需要的 localStorage 表面（真实 Storage 的子集）。 */
export interface DevBStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DevBStoredPreset {
  format: string;
  version: number;
  savedAt: string;
  params: Record<string, number>;
}

export type DevBFailureCode =
  | 'EMPTY'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_WRITE_FAILED'
  | 'STORAGE_VERIFY_FAILED'
  | 'STORAGE_REMOVE_FAILED'
  | 'NOT_JSON'
  | 'BAD_ENVELOPE'
  | 'BAD_FORMAT'
  | 'VERSION_MISMATCH'
  | 'BAD_STRUCTURE'
  | 'NO_PARAMS'
  | 'UNKNOWN_PARAM'
  | 'NOT_FINITE'
  | 'OUT_OF_RANGE';

export interface DevBFailure {
  ok: false;
  code: DevBFailureCode;
  message: string;
}

export type DevBPresetResult = { ok: true; preset: DevBStoredPreset } | DevBFailure;
export type DevBSaveResult = { ok: true; savedAt: string } | DevBFailure;
export type DevBRemoveResult = { ok: true } | DevBFailure;

export function devBFailure(code: DevBFailureCode, message: string): DevBFailure {
  return { ok: false, code, message };
}

export function describeDevBError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 序列化一份预设（写入与回读校验共用同一段文本）。 */
export function devBPresetText(params: RuntimeOverrideSnapshot, savedAt: string): string {
  return JSON.stringify({
    format: DEV_B_STORAGE_FORMAT,
    version: DEV_B_STORAGE_VERSION,
    savedAt,
    params,
  });
}

/**
 * 严格校验一段预设文本：信封、版本、参数白名单、数据类型、有限性与范围。
 * 任何一层失败都只返回原因码与中文说明，调用方不得据此改动运行时。
 */
export function parseDevBPreset(
  raw: string | null | undefined,
  specs: readonly RuntimeParamSpec[],
): DevBPresetResult {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return devBFailure('EMPTY', '本地没有 DEV-B 预设');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return devBFailure('NOT_JSON', '本地预设不是合法 JSON');
  }
  if (!isPlainObject(parsed)) return devBFailure('BAD_ENVELOPE', '本地预设不是对象');
  if (parsed.format !== DEV_B_STORAGE_FORMAT) {
    return devBFailure('BAD_FORMAT', `本地预设 format 不是 ${DEV_B_STORAGE_FORMAT}`);
  }
  if (parsed.version !== DEV_B_STORAGE_VERSION) {
    return devBFailure('VERSION_MISMATCH',
      `本地预设版本 ${String(parsed.version)} 与当前版本 ${DEV_B_STORAGE_VERSION} 不兼容`);
  }
  if (!isPlainObject(parsed.params)) {
    return devBFailure('BAD_STRUCTURE', '本地预设缺少 params 对象');
  }
  const known = new Map(specs.map(spec => [spec.id, spec]));
  const params: Record<string, number> = {};
  for (const [id, value] of Object.entries(parsed.params)) {
    const spec = known.get(id);
    if (!spec) return devBFailure('UNKNOWN_PARAM', `本地预设含有白名单之外的参数：${id}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return devBFailure('NOT_FINITE', `${spec.label} 必须是有限数字`);
    }
    if (value < spec.min || value > spec.max) {
      return devBFailure('OUT_OF_RANGE',
        `${spec.label} 超出允许范围 ${spec.min}–${spec.max} ${spec.unit}`);
    }
    params[id] = value;
  }
  if (Object.keys(params).length === 0) {
    return devBFailure('NO_PARAMS', '本地预设没有任何参数');
  }
  return {
    ok: true,
    preset: {
      format: DEV_B_STORAGE_FORMAT,
      version: DEV_B_STORAGE_VERSION,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
      params,
    },
  };
}

export function readDevBPreset(
  storage: DevBStorage | null,
  specs: readonly RuntimeParamSpec[],
): DevBPresetResult {
  if (!storage) {
    return devBFailure('STORAGE_UNAVAILABLE', '当前环境没有可用的 localStorage，本地预设不可用');
  }
  let raw: string | null;
  try {
    raw = storage.getItem(DEV_B_STORAGE_KEY);
  } catch (error) {
    return devBFailure('STORAGE_UNAVAILABLE', `读取本地预设失败：${describeDevBError(error)}`);
  }
  return parseDevBPreset(raw, specs);
}

/**
 * 写入当前覆盖值。只有 `setItem` 真正成功**并且回读一致**才报成功，
 * 因此配额已满、隐私模式或存储被拒时不会虚报「已保存」。
 */
export function writeDevBPreset(
  storage: DevBStorage | null,
  params: RuntimeOverrideSnapshot,
  savedAt: string,
): DevBSaveResult {
  if (!storage) {
    return devBFailure('STORAGE_UNAVAILABLE', '当前环境没有可用的 localStorage，无法保存本地预设');
  }
  if (Object.keys(params).length === 0) {
    return devBFailure('NO_PARAMS', '当前没有临时覆盖值，没有需要保存的调试参数');
  }
  const text = devBPresetText(params, savedAt);
  try {
    storage.setItem(DEV_B_STORAGE_KEY, text);
  } catch (error) {
    return devBFailure('STORAGE_WRITE_FAILED', `写入本地预设失败：${describeDevBError(error)}`);
  }
  let readBack: string | null = null;
  try {
    readBack = storage.getItem(DEV_B_STORAGE_KEY);
  } catch {
    readBack = null;
  }
  if (readBack !== text) {
    return devBFailure('STORAGE_VERIFY_FAILED', '写入后回读校验不一致，本地预设未保存');
  }
  return { ok: true, savedAt };
}

export function removeDevBPreset(storage: DevBStorage | null): DevBRemoveResult {
  if (!storage) {
    return devBFailure('STORAGE_UNAVAILABLE', '当前环境没有可用的 localStorage，无法删除本地预设');
  }
  try {
    storage.removeItem(DEV_B_STORAGE_KEY);
  } catch (error) {
    return devBFailure('STORAGE_REMOVE_FAILED', `删除本地预设失败：${describeDevBError(error)}`);
  }
  let left: string | null = null;
  try {
    left = storage.getItem(DEV_B_STORAGE_KEY);
  } catch {
    left = null;
  }
  if (left !== null) {
    return devBFailure('STORAGE_REMOVE_FAILED', '删除后仍能读到本地预设，未真正删除');
  }
  return { ok: true };
}

/** 两份覆盖快照是否逐项一致（浮点尾差按 1e-9 归一）。 */
export function sameDevBParams(
  a: RuntimeOverrideSnapshot,
  b: RuntimeOverrideSnapshot,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every(key => b[key] !== undefined && Math.abs(a[key] - b[key]) < 1e-9);
}

export type DevBStorageState = 'BASE' | 'SAVED' | 'UNSAVED';

/** 需求里的三态文案：正式默认值 / 已保存 / 未保存修改。 */
export const DEV_B_STATE_TEXT: Record<DevBStorageState, string> = {
  BASE: '正式默认值',
  SAVED: '已保存',
  UNSAVED: '未保存修改',
};

export interface DevBStorageStatus {
  state: DevBStorageState;
  text: string;
  detail: string;
  currentCount: number;
  savedCount: number;
  savedAt: string | null;
}

/** `2026-09-27T12:10:50.123Z` → `2026-09-27 12:10:50`（不依赖本机时区/locale）。 */
export function formatDevBSavedAt(iso: string): string {
  if (Number.isNaN(new Date(iso).getTime())) return iso;
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`.trim();
}

/**
 * 三态判定：没有临时覆盖＝正式默认值；覆盖与本地预设逐项一致＝已保存；
 * 其余（含「有覆盖但没有预设」）=未保存修改。
 */
export function devBParamStorageState(input: {
  current: RuntimeOverrideSnapshot;
  preset: DevBStoredPreset | null;
}): DevBStorageStatus {
  const currentCount = Object.keys(input.current).length;
  const preset = input.preset;
  const savedCount = preset ? Object.keys(preset.params).length : 0;
  const savedAt = preset && preset.savedAt ? preset.savedAt : null;
  if (currentCount === 0) {
    return {
      state: 'BASE', text: DEV_B_STATE_TEXT.BASE,
      detail: preset
        ? `当前没有临时覆盖；本地仍有已保存预设 ${savedCount} 项，可点「加载已保存预设」恢复`
        : '当前没有临时覆盖，也没有已保存的本地预设',
      currentCount, savedCount, savedAt,
    };
  }
  if (preset && sameDevBParams(input.current, preset.params)) {
    return {
      state: 'SAVED', text: DEV_B_STATE_TEXT.SAVED,
      detail: `当前 ${currentCount} 项覆盖与本地预设一致` +
        (savedAt ? `（${formatDevBSavedAt(savedAt)}）` : ''),
      currentCount, savedCount, savedAt,
    };
  }
  return {
    state: 'UNSAVED', text: DEV_B_STATE_TEXT.UNSAVED,
    detail: preset
      ? `当前 ${currentCount} 项覆盖与本地预设（${savedCount} 项）不同`
      : `当前 ${currentCount} 项覆盖尚未保存到本地`,
    currentCount, savedCount, savedAt,
  };
}

/** 浏览器里可用的 localStorage；不可用时返回 null（面板如实报「不支持」）。 */
export function browserDevBStorage(): DevBStorage | null {
  try {
    const storage = (globalThis as { localStorage?: DevBStorage }).localStorage;
    if (!storage) return null;
    // 读一次以确认存储真的可用（隐私模式/被策略禁用会在这里抛错）。
    storage.getItem(DEV_B_STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

/**
 * 生产构建必须传 `false`：此时既没有存档入口，也不会读取或应用任何本地预设。
 * 单独抽成函数是为了让「生产隔离」可以被真正断言，而不是只靠代码审阅。
 */
export function devBPersistenceStorage(devEnvironment: boolean): DevBStorage | null {
  if (!devEnvironment) return null;
  return browserDevBStorage();
}
