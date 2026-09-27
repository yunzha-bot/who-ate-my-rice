// DEV 场景编辑器 V2：布局保存 / 恢复 / JSON 导入的纯逻辑层。
//
// 只保存与导入「地图创作数据」：家具（位置 / 旋转 / 白模尺寸）与藏身锚点
// （位置 / facing / 交互区域）。房间、门、出生点、米点一律取自当前授权的
// `apartmentMap.ts`；存档里即使带了这些字段也只用于「是否同一张地图」的
// 兼容性核对，绝不写回运行时。随机出生点、18 扇门的随机初态、角色位置、
// AI 路径、米进度、技能冷却与对局时间都不在存档结构里，因此 S7C-3 的每局
// 随机化继续以当前合法地图为基础、每局独立。
//
// 校验只有一条权威链路：结构 / 稳定 ID / 只读字段在这里核对，几何与玩法
// 合法性全部交给 `validateEditedMap()`（与「应用编辑」同一段代码），
// 因此导入不可能绕过编辑器已经通过的检查。
import { MAP_EXPORT_FORMAT, MAP_EXPORT_VERSION, authoredMapSource, furnitureRect,
  spotDraftToAnchor, validateEditedMap,
  type EditRejection, type FurnitureDraft, type HideSpotDraft, type MapExportDocument,
  type MapSource } from './MapEditModel.ts';
import { MAP_DEPTH, MAP_WIDTH, type Rect } from './apartmentMap.ts';

export const LAYOUT_STORAGE_KEY = 'who-ate-my-rice/scene-editor-layout';
export const LAYOUT_FORMAT = 'who-ate-my-rice/scene-layout';
export const LAYOUT_VERSION = 1;

/** The envelope written to local storage: identity + time + the exported document. */
export interface SavedLayout {
  format: string;
  layoutVersion: number;
  savedAt: string;
  document: MapExportDocument;
}

/** Minimal storage seam: the browser passes `window.localStorage`, tests a fake. */
export interface LayoutStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type LayoutFailureCode =
  | 'EMPTY'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_WRITE_FAILED'
  | 'NOT_JSON'
  | 'BAD_ENVELOPE'
  | 'BAD_FORMAT'
  | 'VERSION_MISMATCH'
  | 'BAD_STRUCTURE'
  | 'ID_MISMATCH'
  | 'READ_ONLY_MISMATCH'
  | 'LAYOUT_REJECTED';

export interface LayoutFailure {
  ok: false;
  code: LayoutFailureCode;
  message: string;
}

export type LayoutResult =
  | { ok: true; document: MapExportDocument; savedAt?: string }
  | LayoutFailure;

export type LayoutStateLabel =
  | 'DEFAULT' | 'CUSTOM' | 'SAVED' | 'UNSAVED' | 'IMPORT_FAILED';

/** State text shown in the editor panel and in the DEV readout. */
export const LAYOUT_STATE_TEXT: Record<LayoutStateLabel, string> = {
  DEFAULT: '默认布局',
  CUSTOM: '自定义布局（尚未保存）',
  SAVED: '已保存',
  UNSAVED: '未保存修改（与本地存档不同）',
  IMPORT_FAILED: '导入失败',
};

function fail(code: LayoutFailureCode, message: string): LayoutFailure {
  return { ok: false, code, message };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function sameNumber(actual: unknown, expected: number): boolean {
  return finite(actual) && Math.abs(actual - expected) < 1e-6;
}

function sameIds(actual: readonly { id: string }[], expected: readonly { id: string }[]): boolean {
  const wanted = new Set(expected.map(value => value.id));
  if (wanted.size !== expected.length) return false;
  const seen = new Set<string>();
  for (const entry of actual) {
    if (!wanted.has(entry.id) || seen.has(entry.id)) return false;
    seen.add(entry.id);
  }
  return seen.size === wanted.size;
}

// Deep, number-tolerant comparison used only for the read-only reference fields.
function sameReferenceValue(actual: unknown, expected: unknown): boolean {
  if (typeof expected === 'number') return sameNumber(actual, expected);
  if (typeof expected === 'string' || typeof expected === 'boolean') return actual === expected;
  if (expected === null || expected === undefined) return actual === expected;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length &&
      expected.every((value, index) => sameReferenceValue(actual[index], value));
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) return false;
    const keys = Object.keys(expected);
    return keys.length === Object.keys(actual).length &&
      keys.every(name => sameReferenceValue(actual[name], expected[name]));
  }
  return false;
}

function sameReference(actual: unknown, expected: readonly { id: string }[]): boolean {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const byId = new Map(expected.map(entry => [entry.id, entry]));
  for (const entry of actual) {
    const id = isRecord(entry) && typeof entry.id === 'string' ? entry.id : '';
    const reference = byId.get(id);
    if (!reference || !sameReferenceValue(entry, reference)) return false;
  }
  return true;
}

// Every corner of the (possibly rotated) footprint has to sit inside one room.
// Mirrors `roomOfRect()` in the edit model: the authored room of a piece is
// derived from its geometry, never stored twice.
function roomOfRect(rect: Rect, base: MapSource): string {
  const rotation = rect.rotation ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => {
    const localX = halfWidth * sx;
    const localZ = halfDepth * sz;
    return { x: rect.x + localX * cos + localZ * sin,
      z: rect.z - localX * sin + localZ * cos };
  });
  const room = base.rooms.find(value => corners.every(corner =>
    corner.x >= value.minX - 0.001 && corner.x <= value.maxX + 0.001 &&
    corner.z >= value.minZ - 0.001 && corner.z <= value.maxZ + 0.001));
  return room?.id ?? '';
}

/** The authored map projected into the V3 export shape, for status comparisons. */
export function authoredLayoutDocument(base: MapSource = authoredMapSource()): MapExportDocument {
  return {
    format: MAP_EXPORT_FORMAT,
    formatVersion: MAP_EXPORT_VERSION,
    units: { length: 'world-unit', angle: 'radian', rotation: 'degree',
      groundPlane: 'XZ', up: 'Y' },
    map: { width: MAP_WIDTH, depth: MAP_DEPTH },
    appliedEditCount: 0,
    rooms: base.rooms.map(room => ({ id: room.id, name: room.name,
      bounds: { minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ } })),
    doors: base.doors.map(door => ({ id: door.id, position: { x: door.x, z: door.z },
      width: door.width, rotationRad: door.rotation,
      connects: [door.connectedRoomA, door.connectedRoomB] })),
    spawns: [base.spawns.deepseek, base.spawns.human].map(spawn =>
      ({ id: spawn.id, roomId: spawn.roomId, x: spawn.x, z: spawn.z })),
    riceCandidates: base.riceCandidates.map(rice =>
      ({ id: rice.id, roomId: rice.roomId, x: rice.x, z: rice.z })),
    furniture: base.furniture.map(rect => ({
      id: rect.id, kind: 'furniture' as const, roomId: roomOfRect(rect, base),
      position: { x: rect.x, z: rect.z },
      rotationDeg: (rect.rotation ?? 0) * 180 / Math.PI,
      rotationRad: rect.rotation ?? 0,
      size: { width: rect.width, depth: rect.depth, height: rect.height },
      collisionShape: 'ROTATED_RECT' as const,
      boundingAabb: { width: rect.width, depth: rect.depth },
      boundingAabbRole: 'broad-phase-approximation' as const })),
    hideSpots: base.hideSpots.map(spot => ({ id: spot.id, kind: spot.kind,
      roomId: spot.roomId, furnitureId: spot.furnitureId, label: spot.label,
      anchor: { x: spot.x, z: spot.z }, facing: spot.facing,
      facingDeg: spot.facing * 180 / Math.PI,
      interactionRegion: { ...spot.interactionRegion,
        units: { radius: 'world-unit', halfAngle: 'degree' } } })),
  };
}

/** Structural / stable-ID / read-only-field checks; no geometry runs here. */
export function parseLayoutDocument(raw: unknown,
  base: MapSource = authoredMapSource()): LayoutResult {
  if (!isRecord(raw)) return fail('BAD_STRUCTURE', '布局文档不是一个 JSON 对象');
  if (raw.format !== MAP_EXPORT_FORMAT) {
    return fail('BAD_FORMAT',
      `布局文档 format 需为 ${MAP_EXPORT_FORMAT}，实际 ${String(raw.format)}`);
  }
  if (raw.formatVersion !== MAP_EXPORT_VERSION) {
    return fail('VERSION_MISMATCH',
      `布局文档 formatVersion 需为 ${MAP_EXPORT_VERSION}，实际 ${String(raw.formatVersion)}`);
  }
  for (const key of ['furniture', 'hideSpots', 'rooms', 'doors', 'spawns', 'riceCandidates']) {
    if (!Array.isArray(raw[key])) return fail('BAD_STRUCTURE', `布局文档缺少数组字段 ${key}`);
  }
  const furniture = raw.furniture as unknown[];
  const hideSpots = raw.hideSpots as unknown[];
  for (const entry of furniture) {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      return fail('BAD_STRUCTURE', '家具条目缺少稳定 ID');
    }
    const position = entry.position;
    const size = entry.size;
    if (!isRecord(position) || !isRecord(size) ||
        !finite(position.x) || !finite(position.z) || !finite(entry.rotationDeg) ||
        !finite(size.width) || !finite(size.depth) || !finite(size.height)) {
      return fail('BAD_STRUCTURE', `家具 ${entry.id} 的位置 / 旋转 / 尺寸不是有限数值`);
    }
  }
  for (const entry of hideSpots) {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      return fail('BAD_STRUCTURE', '藏身点条目缺少稳定 ID');
    }
    const anchor = entry.anchor;
    const region = entry.interactionRegion;
    if (!isRecord(anchor) || !finite(anchor.x) || !finite(anchor.z) || !finite(entry.facing)) {
      return fail('BAD_STRUCTURE', `藏身点 ${entry.id} 的锚点 / facing 不是有限数值`);
    }
    if (!isRecord(region) || (region.shape !== 'CIRCLE' && region.shape !== 'SECTOR') ||
        !finite(region.radius)) {
      return fail('BAD_STRUCTURE', `藏身点 ${entry.id} 的交互区域数据不合法`);
    }
    if (region.shape === 'SECTOR' && !finite(region.halfAngleDeg)) {
      return fail('BAD_STRUCTURE', `藏身点 ${entry.id} 是扇形但不是有限半角`);
    }
  }
  if (!sameIds(furniture as { id: string }[], base.furniture)) {
    return fail('ID_MISMATCH', '家具稳定 ID 与当前地图不一致（缺失、多余或重复）');
  }
  if (!sameIds(hideSpots as { id: string }[], base.hideSpots)) {
    return fail('ID_MISMATCH', '藏身点稳定 ID 与当前地图不一致（缺失、多余或重复）');
  }
  const authoredFurniture = new Map(base.furniture.map(rect => [rect.id, rect]));
  const authoredSpots = new Map(base.hideSpots.map(spot => [spot.id, spot]));
  for (const entry of furniture as MapExportDocument['furniture']) {
    const room = roomOfRect(authoredFurniture.get(entry.id)!, base);
    if (room && entry.roomId !== room) {
      return fail('READ_ONLY_MISMATCH', `家具 ${entry.id} 的 roomId 是只读字段`);
    }
  }
  for (const entry of hideSpots as MapExportDocument['hideSpots']) {
    const authored = authoredSpots.get(entry.id)!;
    if (entry.roomId !== authored.roomId || entry.kind !== authored.kind ||
        entry.label !== authored.label || entry.furnitureId !== authored.furnitureId) {
      return fail('READ_ONLY_MISMATCH',
        `藏身点 ${entry.id} 的房间 / 类型 / 名称 / 关联家具是只读字段`);
    }
  }
  const reference = authoredLayoutDocument(base);
  if (!sameReference(raw.rooms, reference.rooms) ||
      !sameReference(raw.doors, reference.doors) ||
      !sameReference(raw.spawns, reference.spawns) ||
      !sameReference(raw.riceCandidates, reference.riceCandidates)) {
    return fail('READ_ONLY_MISMATCH',
      '布局文档的房间 / 门 / 出生点 / 米点与当前地图不一致：可能来自另一张地图或另一个版本');
  }
  return { ok: true, document: raw as unknown as MapExportDocument };
}

/** The document's editable parts as editor drafts. */
export function draftsFromDocument(document: MapExportDocument): {
  furniture: FurnitureDraft[]; hideSpots: HideSpotDraft[] } {
  return {
    furniture: document.furniture.map(entry => ({
      editKind: 'FURNITURE' as const,
      id: entry.id,
      roomId: entry.roomId,
      x: entry.position.x,
      z: entry.position.z,
      rotationDeg: entry.rotationDeg,
      width: entry.size.width,
      depth: entry.size.depth,
      height: entry.size.height,
    })),
    hideSpots: document.hideSpots.map(entry => ({
      editKind: 'HIDE_SPOT' as const,
      id: entry.id,
      roomId: entry.roomId,
      kind: entry.kind,
      furnitureId: entry.furnitureId,
      label: entry.label,
      x: entry.anchor.x,
      z: entry.anchor.z,
      facing: entry.facing,
      interactionRegion: entry.interactionRegion.shape === 'SECTOR'
        ? { shape: 'SECTOR' as const, radius: entry.interactionRegion.radius,
          halfAngleDeg: entry.interactionRegion.halfAngleDeg }
        : { shape: 'CIRCLE' as const, radius: entry.interactionRegion.radius },
    })),
  };
}

/** A validated document as a full map source: the authored reference is kept. */
export function layoutSource(document: MapExportDocument,
  base: MapSource = authoredMapSource()): MapSource {
  const drafts = draftsFromDocument(document);
  return { ...base, furniture: drafts.furniture.map(furnitureRect),
    hideSpots: drafts.hideSpots.map(spotDraftToAnchor) };
}

/** The authoritative geometry / gameplay validation, shared with "apply edits". */
export function layoutRejections(document: MapExportDocument,
  base: MapSource = authoredMapSource()): EditRejection[] {
  const drafts = draftsFromDocument(document);
  return validateEditedMap(drafts.furniture, drafts.hideSpots, base);
}

export function rejectionText(rejections: readonly EditRejection[]): string {
  return rejections.map(item => `${item.code}：${item.message}`).join('；');
}

/** Import path: accepts a bare V3 document or our saved envelope. */
export function importLayoutText(text: string,
  base: MapSource = authoredMapSource()): LayoutResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail('NOT_JSON', `不是合法 JSON：${describe(error)}`);
  }
  let candidate = raw;
  if (isRecord(raw) && raw.document !== undefined) {
    if (raw.format !== LAYOUT_FORMAT) {
      return fail('BAD_FORMAT',
        `存档信封 format 需为 ${LAYOUT_FORMAT}，实际 ${String(raw.format)}`);
    }
    candidate = raw.document;
  }
  const parsed = parseLayoutDocument(candidate, base);
  if (!parsed.ok) return parsed;
  const rejections = layoutRejections(parsed.document, base);
  if (rejections.length) return fail('LAYOUT_REJECTED', rejectionText(rejections));
  return parsed;
}

export function readSavedLayout(storage: LayoutStorage | null,
  base: MapSource = authoredMapSource()): LayoutResult {
  if (!storage) {
    return fail('STORAGE_UNAVAILABLE', '浏览器没有可用的 localStorage，本地布局存档不可用');
  }
  let text: string | null;
  try {
    text = storage.getItem(LAYOUT_STORAGE_KEY);
  } catch (error) {
    return fail('STORAGE_UNAVAILABLE', `读取本地存档失败：${describe(error)}`);
  }
  if (text === null || text.trim() === '') return fail('EMPTY', '没有本地布局存档');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail('NOT_JSON', `本地存档不是合法 JSON：${describe(error)}`);
  }
  if (!isRecord(raw) || raw.document === undefined) {
    return fail('BAD_ENVELOPE', '本地存档缺少信封结构');
  }
  if (raw.format !== LAYOUT_FORMAT) {
    return fail('BAD_FORMAT', `本地存档 format 需为 ${LAYOUT_FORMAT}，实际 ${String(raw.format)}`);
  }
  if (raw.layoutVersion !== LAYOUT_VERSION) {
    return fail('VERSION_MISMATCH',
      `本地存档 layoutVersion 需为 ${LAYOUT_VERSION}，实际 ${String(raw.layoutVersion)}`);
  }
  const parsed = parseLayoutDocument(raw.document, base);
  if (!parsed.ok) return parsed;
  const rejections = layoutRejections(parsed.document, base);
  if (rejections.length) return fail('LAYOUT_REJECTED', rejectionText(rejections));
  return { ok: true, document: parsed.document,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : undefined };
}

/** Never reports success unless the write really happened. */
export function writeSavedLayout(storage: LayoutStorage | null, document: MapExportDocument,
  savedAt = new Date().toISOString()): { ok: true; envelope: SavedLayout } | LayoutFailure {
  if (!storage) {
    return fail('STORAGE_UNAVAILABLE', '浏览器没有可用的 localStorage，无法保存布局');
  }
  const parsed = parseLayoutDocument(document);
  if (!parsed.ok) return parsed;
  const envelope: SavedLayout = { format: LAYOUT_FORMAT, layoutVersion: LAYOUT_VERSION,
    savedAt, document: parsed.document };
  try {
    storage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(envelope, null, 2));
  } catch (error) {
    return fail('STORAGE_WRITE_FAILED', `写入本地存档失败：${describe(error)}`);
  }
  return { ok: true, envelope };
}

/** Stable comparison key over the editable parts only. */
export function layoutSignature(document: MapExportDocument): string {
  const number = (value: number): string => (Number.isFinite(value) ? value.toFixed(4) : 'NaN');
  const furniture = document.furniture.map(entry => [entry.id,
    number(entry.position.x), number(entry.position.z), number(entry.rotationDeg),
    number(entry.size.width), number(entry.size.depth), number(entry.size.height)]
    .join(':')).join('|');
  const spots = document.hideSpots.map(entry => [entry.id,
    number(entry.anchor.x), number(entry.anchor.z), number(entry.facing),
    entry.interactionRegion.shape, number(entry.interactionRegion.radius),
    number(entry.interactionRegion.halfAngleDeg ?? 0)].join(':')).join('|');
  return `${furniture}#${spots}`;
}

export function layoutStateLabel(input: { authored: boolean; saved: boolean;
  unsaved: boolean; lastError: string | null }): LayoutStateLabel {
  if (input.lastError) return 'IMPORT_FAILED';
  if (input.saved) return 'SAVED';
  if (input.unsaved) return 'UNSAVED';
  return input.authored ? 'DEFAULT' : 'CUSTOM';
}

export interface LayoutStatus {
  label: LayoutStateLabel;
  text: string;
  authored: boolean;
  saved: boolean;
  unsaved: boolean;
  /** 当前布局尚未写入本地存档（自定义未保存、或与存档不同）；默认布局为 false。 */
  pending: boolean;
}

// 五态语义（互斥且可判定）：
//   DEFAULT  当前布局＝授权地图，且没有本地存档
//   CUSTOM   当前布局是自定义的，且从未保存过
//   SAVED    当前布局与本地存档逐字段一致
//   UNSAVED  已存在本地存档，但当前布局与它不同（含"恢复默认后又改回去"）
//   IMPORT_FAILED  最近一次导入 / 恢复失败（地图保持原样）
export function layoutStatus(input: { appliedSignature: string;
  savedSignature: string | null; authoredSignature: string;
  lastError?: string | null }): LayoutStatus {
  const authored = input.appliedSignature === input.authoredSignature;
  const saved = input.savedSignature !== null && input.appliedSignature === input.savedSignature;
  const unsaved = input.savedSignature !== null && input.appliedSignature !== input.savedSignature;
  const label = layoutStateLabel({ authored, saved, unsaved,
    lastError: input.lastError ?? null });
  const pending = unsaved || (!authored && !saved);
  return { label, text: LAYOUT_STATE_TEXT[label], authored, saved, unsaved, pending };
}

/** The real browser storage, or null when it is unavailable/blocked. */
export function browserLayoutStorage(): LayoutStorage | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const probe = `${LAYOUT_STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}
