import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { MAP_EXPORT_FORMAT, MAP_EXPORT_VERSION, MapEditSession, authoredMapSource,
  furnitureRect, validateEditedMap } from '../src/three/map/MapEditModel.ts';
import { LAYOUT_FORMAT, LAYOUT_STORAGE_KEY, LAYOUT_VERSION, authoredLayoutDocument,
  browserLayoutStorage, draftsFromDocument, importLayoutText, layoutRejections,
  layoutSignature, layoutSource, layoutStateLabel, layoutStatus, parseLayoutDocument,
  readSavedLayout, writeSavedLayout } from '../src/three/map/MapLayoutStore.ts';
import { REGION_AUTHORING_LIMITS } from '../src/three/map/HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, RICE_CANDIDATES, ROOMS,
  SPAWNS, WALLS } from '../src/three/map/apartmentMap.ts';
import { createMatchSetup } from '../src/systems/MatchRandom.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { rectColliders } from '../src/three/map/MapEditModel.ts';

const clone = value => JSON.parse(JSON.stringify(value));
const authoredFurniture = clone(FURNITURE);
const authoredSpots = clone(HIDE_SPOTS);

// A legal applied layout: the same width edit the existing scene-editor suite uses.
function appliedDocument() {
  const session = new MapEditSession();
  assert.equal(session.setField('living_sofa', 'width', 1.4), null);
  assert.equal(session.apply().ok, true);
  return session.exportJson();
}

function memoryStorage(initial = null) {
  const entries = new Map();
  if (initial !== null) entries.set(LAYOUT_STORAGE_KEY, initial);
  return {
    getItem: key => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: key => { entries.delete(key); },
    raw: () => entries.get(LAYOUT_STORAGE_KEY) ?? null,
  };
}

function failingStorage() {
  return {
    getItem: () => { throw new Error('storage blocked'); },
    setItem: () => { throw new Error('quota exceeded'); },
  };
}

function worldFrom(document) {
  const rects = document.furniture.map(entry => furnitureRect(draftsFromDocument(document)
    .furniture.find(draft => draft.id === entry.id)));
  const colliders = rectColliders([...WALLS, ...rects]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, colliders.boxes,
    colliders.oriented);
  return { world, navigation: new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES) };
}

test('保存→读取往返：文档、签名与存档时间都一致', () => {
  const document = appliedDocument();
  const storage = memoryStorage();
  const saved = writeSavedLayout(storage, document, '2026-09-27T00:00:00.000Z');
  assert.equal(saved.ok, true);
  assert.equal(saved.envelope.layoutVersion, LAYOUT_VERSION);
  const read = readSavedLayout(storage);
  assert.equal(read.ok, true);
  assert.equal(layoutSignature(read.document), layoutSignature(document));
  assert.equal(read.savedAt, '2026-09-27T00:00:00.000Z');
  const envelope = JSON.parse(storage.raw());
  assert.equal(envelope.format, LAYOUT_FORMAT);
  assert.equal(envelope.document.formatVersion, MAP_EXPORT_VERSION);
});

test('导出文档本身就是合法的导入输入（导入/导出往返一致）', () => {
  const document = appliedDocument();
  const imported = importLayoutText(JSON.stringify(document));
  assert.equal(imported.ok, true);
  assert.equal(layoutSignature(imported.document), layoutSignature(document));
  const session = new MapEditSession();
  session.replaceSource(layoutSource(imported.document));
  assert.equal(layoutSignature(session.exportJson()), layoutSignature(document));
  assert.equal(session.isDirty, false);
});

test('存档信封本身也能被导入（玩家可能保存的是完整存档文件）', () => {
  const document = appliedDocument();
  const storage = memoryStorage();
  assert.equal(writeSavedLayout(storage, document).ok, true);
  const imported = importLayoutText(storage.raw());
  assert.equal(imported.ok, true);
  assert.equal(layoutSignature(imported.document), layoutSignature(document));
});

test('localStorage 不可用时不报成功、也不崩', () => {
  const document = appliedDocument();
  for (const storage of [null, failingStorage()]) {
    const written = writeSavedLayout(storage, document);
    assert.equal(written.ok, false);
    assert.ok(['STORAGE_UNAVAILABLE', 'STORAGE_WRITE_FAILED'].includes(written.code));
    const read = readSavedLayout(storage);
    assert.equal(read.ok, false);
    assert.ok(['EMPTY', 'STORAGE_UNAVAILABLE'].includes(read.code));
  }
});

test('写入被拒时绝不虚报保存成功', () => {
  const document = appliedDocument();
  const entries = new Map();
  const storage = {
    getItem: key => (entries.has(key) ? entries.get(key) : null),
    setItem: () => { throw new Error('quota exceeded'); },
  };
  const written = writeSavedLayout(storage, document);
  assert.equal(written.ok, false);
  assert.equal(written.code, 'STORAGE_WRITE_FAILED');
  assert.equal(storage.getItem(LAYOUT_STORAGE_KEY), null);
});

test('损坏的本地存档：非 JSON / 缺信封 / 版本不符都被拒绝', () => {
  assert.equal(readSavedLayout(memoryStorage('{ not json')).code, 'NOT_JSON');
  assert.equal(readSavedLayout(memoryStorage(JSON.stringify({ hello: 1 }))).code, 'BAD_ENVELOPE');
  assert.equal(readSavedLayout(memoryStorage(JSON.stringify({
    format: LAYOUT_FORMAT, layoutVersion: 99, document: appliedDocument() }))).code,
    'VERSION_MISMATCH');
  assert.equal(readSavedLayout(memoryStorage(JSON.stringify({
    format: 'other/format', layoutVersion: LAYOUT_VERSION,
    document: appliedDocument() }))).code, 'BAD_FORMAT');
  assert.equal(readSavedLayout(memoryStorage('   ')).code, 'EMPTY');
});

test('结构非法：缺数组字段 / 非有限数值 / 格式或版本不符', () => {
  const document = appliedDocument();
  const missing = clone(document);
  delete missing.hideSpots;
  assert.equal(importLayoutText(JSON.stringify(missing)).code, 'BAD_STRUCTURE');
  const nan = clone(document);
  nan.furniture[0].position.x = null;
  assert.equal(importLayoutText(JSON.stringify(nan)).code, 'BAD_STRUCTURE');
  const badFormat = clone(document);
  badFormat.format = 'who-ate-my-rice/other';
  assert.equal(importLayoutText(JSON.stringify(badFormat)).code, 'BAD_FORMAT');
  const badVersion = clone(document);
  badVersion.formatVersion = 2;
  assert.equal(importLayoutText(JSON.stringify(badVersion)).code, 'VERSION_MISMATCH');
  const badRegion = clone(document);
  badRegion.hideSpots.find(spot => spot.id === 'hide_main_wardrobe').interactionRegion.halfAngleDeg
    = 'wide';
  assert.equal(importLayoutText(JSON.stringify(badRegion)).code, 'BAD_STRUCTURE');
});

test('稳定 ID 必须与当前地图完全一致', () => {
  const document = appliedDocument();
  const dropped = clone(document);
  dropped.furniture.pop();
  assert.equal(importLayoutText(JSON.stringify(dropped)).code, 'ID_MISMATCH');
  const duplicated = clone(document);
  duplicated.furniture.push(clone(duplicated.furniture[0]));
  assert.equal(importLayoutText(JSON.stringify(duplicated)).code, 'ID_MISMATCH');
  const extra = clone(document);
  extra.hideSpots.push({ ...clone(extra.hideSpots[0]), id: 'hide_made_up' });
  assert.equal(importLayoutText(JSON.stringify(extra)).code, 'ID_MISMATCH');
});

test('藏身点的只读字段（房间 / 类型 / 名称 / 关联家具）不得被导入改写', () => {
  const document = appliedDocument();
  for (const [field, value] of [['roomId', 'kitchen'], ['kind', 'SHELF'],
    ['label', '假的'], ['furnitureId', 'main_bed']]) {
    const tampered = clone(document);
    const spot = tampered.hideSpots.find(entry => entry.id === 'hide_living_carton');
    if (spot[field] === value) continue;
    spot[field] = value;
    const result = importLayoutText(JSON.stringify(tampered));
    assert.equal(result.ok, false, `${field} 应被拒绝`);
    assert.equal(result.code, 'READ_ONLY_MISMATCH');
  }
  const movedRoom = clone(document);
  const furniture = movedRoom.furniture.find(entry => entry.id === 'living_sofa');
  furniture.roomId = furniture.roomId === 'living' ? 'kitchen' : 'living';
  assert.equal(importLayoutText(JSON.stringify(movedRoom)).code, 'READ_ONLY_MISMATCH');
});

test('来自另一张地图的文档被拒绝（房间边界 / 门 / 出生点 / 米点只读）', () => {
  const document = appliedDocument();
  const cases = [
    draft => { draft.rooms[0].bounds.minX += 1; },
    draft => { draft.doors[0].position.x += 1; },
    draft => { draft.spawns[0].x += 1; },
    draft => { draft.riceCandidates[0].z += 1; },
    draft => { draft.riceCandidates.pop(); },
  ];
  for (const mutate of cases) {
    const tampered = clone(document);
    mutate(tampered);
    const result = importLayoutText(JSON.stringify(tampered));
    assert.equal(result.ok, false);
    assert.equal(result.code, 'READ_ONLY_MISMATCH');
  }
});

test('几何与玩法合法性复用 validateEditedMap（单一权威链路）', () => {
  const document = appliedDocument();
  const outside = clone(document);
  const sofa = outside.furniture.find(entry => entry.id === 'living_sofa');
  sofa.position.x += 12;
  const rejected = importLayoutText(JSON.stringify(outside));
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, 'LAYOUT_REJECTED');
  assert.match(rejected.message, /ROOM_BOUNDARY/);
  // The store's verdict must be exactly the editor's own validator verdict.
  const drafts = draftsFromDocument(outside);
  const expected = validateEditedMap(drafts.furniture, drafts.hideSpots, authoredMapSource());
  assert.deepEqual(layoutRejections(outside), expected);
  assert.ok(expected.length > 0);
  const overlapping = clone(document);
  const bed = overlapping.furniture.find(entry => entry.id === 'main_bed');
  const wardrobe = overlapping.furniture.find(entry => entry.id === 'main_wardrobe');
  bed.position.x = wardrobe.position.x;
  bed.position.z = wardrobe.position.z;
  assert.equal(importLayoutText(JSON.stringify(overlapping)).code, 'LAYOUT_REJECTED');
});

test('藏身交互区域越界同样被拒绝（区域校验没有被绕过）', () => {
  const document = appliedDocument();
  const tooBig = clone(document);
  tooBig.hideSpots.find(entry => entry.id === 'hide_main_bed').interactionRegion.radius =
    REGION_AUTHORING_LIMITS.maxRadius + 1;
  const result = importLayoutText(JSON.stringify(tooBig));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LAYOUT_REJECTED');
  assert.match(result.message, /INVALID_REGION_RADIUS/);
});

test('导入后的地图源保留授权参考，只替换家具与藏身锚点', () => {
  const document = appliedDocument();
  const source = layoutSource(document);
  const base = authoredMapSource();
  assert.deepEqual(source.walls, base.walls);
  assert.deepEqual(source.doors, base.doors);
  assert.deepEqual(source.rooms, base.rooms);
  assert.deepEqual(source.rooms.length, ROOMS.length);
  assert.deepEqual(source.riceCandidates, base.riceCandidates);
  assert.deepEqual(source.spawns, base.spawns);
  assert.equal(source.furniture.length, document.furniture.length);
  assert.equal(source.hideSpots.length, document.hideSpots.length);
  const sofa = source.furniture.find(rect => rect.id === 'living_sofa');
  const exportSofa = document.furniture.find(entry => entry.id === 'living_sofa');
  assert.equal(sofa.width, exportSofa.size.width);
  const carton = source.hideSpots.find(spot => spot.id === 'hide_living_carton');
  const exportCarton = document.hideSpots.find(entry => entry.id === 'hide_living_carton');
  assert.equal(carton.x, exportCarton.anchor.x);
  assert.deepEqual(carton.interactionRegion, {
    shape: exportCarton.interactionRegion.shape,
    radius: exportCarton.interactionRegion.radius });
});

test('S7C-3 随机化仍以当前合法地图为基础、每局独立', () => {
  const document = appliedDocument();
  const source = layoutSource(document);
  const { world, navigation } = worldFrom(document);
  const first = createMatchSetup(11, world, navigation, 40, source.hideSpots);
  const second = createMatchSetup(22, world, navigation, 40, source.hideSpots);
  assert.equal(first.validation, 'PASS');
  assert.equal(second.validation, 'PASS');
  assert.notDeepEqual(first.doorStates, second.doorStates);
  assert.notDeepEqual([first.deepseek.x, first.deepseek.z],
    [second.deepseek.x, second.deepseek.z]);
  const again = createMatchSetup(11, world, navigation, 40, source.hideSpots);
  assert.deepEqual(again.doorStates, first.doorStates);
  assert.deepEqual([again.deepseek.x, again.deepseek.z], [first.deepseek.x, first.deepseek.z]);
  // The layout source carries no per-match state at all.
  assert.equal(JSON.stringify(source).includes('doorStates'), false);
  assert.equal(JSON.stringify(document).includes('doorStates'), false);
  assert.equal(JSON.stringify(document).includes('seed'), false);
});

// Brace-matched extraction so a neighbouring method can never leak into the body.
function methodBody(source, signature) {
  const start = source.indexOf(signature);
  assert.ok(start > 0, `缺少方法：${signature}`);
  const from = source.indexOf('{', start);
  let depth = 0;
  for (let index = from; index < source.length; index++) {
    if (source[index] === '{') depth++;
    else if (source[index] === '}') {
      depth--;
      if (depth === 0) return source.slice(from, index + 1);
    }
  }
  throw new Error(`方法未闭合：${signature}`);
}

test('地图应用后重开 / 返回阵营不会重建地图（源码不变量）', () => {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  // One declaration default + one assignment inside rebuildApartment.
  assert.equal((source.match(/this\.mapFurniture\s*=/g) ?? []).length, 2);
  assert.equal((source.match(/this\.hideSpots\s*=/g) ?? []).length, 2);
  assert.equal((source.match(/this\.mapFurniture = map\.furniture;/g) ?? []).length, 1);
  const reset = methodBody(source, 'private resetRound(): void {');
  // 重开 / 返回阵营只重掷对局，不重建公寓、也不把地图重置回源码常量。
  assert.equal(reset.includes('buildApartment('), false);
  assert.equal(reset.includes('this.mapFurniture ='), false);
  assert.equal(reset.includes('this.hideSpots ='), false);
  // 随机化读的是当前已应用地图的藏身点。
  assert.ok(reset.includes('this.hideSpots'));
  // 关闭编辑器只回到「已应用」地图，绝不悄悄恢复授权默认地图。
  const editor = readFileSync(new URL('../src/three/SceneEditor.ts', import.meta.url), 'utf8');
  const close = methodBody(editor, '  close(): void {');
  assert.equal(close.includes('authoredMapSource()'), false);
  assert.ok(close.includes('rebuildFromCommitted()'));
});

test('编辑器确实接上了保存 / 导入 / 恢复默认三条入口（源码级守卫）', () => {
  const editor = readFileSync(new URL('../src/three/SceneEditor.ts', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/three/SceneEditorPanel.ts', import.meta.url), 'utf8');
  for (const label of ['保存布局', '导入 JSON', '恢复默认地图']) {
    assert.ok(panel.includes(label), `面板缺少按钮：${label}`);
  }
  assert.ok(panel.includes('scene-editor-layout'));
  assert.ok(panel.includes('dataset.layoutState'));
  for (const call of ['writeSavedLayout(', 'importLayoutText(', 'replaceSource(',
    'authoredMapSource()']) {
    assert.ok(editor.includes(call), `编辑器缺少：${call}`);
  }
  assert.ok(editor.includes('RESTORE_DEFAULT_CONFIRM'));
  const game = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  assert.ok(game.includes('readSavedLayout('));
  assert.ok(game.includes('layoutStorage: this.layoutStorage'));
});

test('会话换源：草稿与已应用数据一起跟随，且不残留旧草稿', () => {
  const document = appliedDocument();
  const session = new MapEditSession();
  session.setField('living_sofa', 'width', 1.9);
  assert.equal(session.isDirty, true);
  session.replaceSource(layoutSource(document));
  assert.equal(session.isDirty, false);
  assert.equal(session.furnitureList().find(item => item.id === 'living_sofa').width, 1.4);
  assert.equal(layoutSignature(session.exportJson()), layoutSignature(document));
});

test('布局状态五态与「未保存修改」判定', () => {
  const authored = layoutSignature(authoredLayoutDocument());
  const custom = layoutSignature(appliedDocument());
  assert.notEqual(authored, custom);
  const status = (applied, saved, lastError = null) => layoutStatus({
    appliedSignature: applied, savedSignature: saved, authoredSignature: authored, lastError });
  // 没有本地存档：默认布局 / 自定义（尚未保存）
  assert.equal(status(authored, null).label, 'DEFAULT');
  assert.equal(status(authored, null).pending, false);
  assert.equal(status(custom, null).label, 'CUSTOM');
  assert.equal(status(custom, null).pending, true);
  // 有本地存档：一致＝已保存，不同＝未保存修改
  assert.equal(status(custom, custom).label, 'SAVED');
  assert.equal(status(custom, custom).pending, false);
  assert.equal(status(authored, custom).label, 'UNSAVED');
  assert.equal(status(authored, custom).pending, true);
  // 「导入失败」优先显示；判定用的签名不变
  const failed = status(custom, custom, 'VERSION_MISMATCH：x');
  assert.equal(failed.label, 'IMPORT_FAILED');
  assert.equal(failed.saved, true);
  assert.equal(layoutStateLabel({ authored: true, saved: false, unsaved: false,
    lastError: null }), 'DEFAULT');
  assert.equal(layoutStateLabel({ authored: true, saved: false, unsaved: false,
    lastError: 'BAD_STRUCTURE：x' }), 'IMPORT_FAILED');
});

test('layoutSignature 覆盖家具与藏身点的每个可编辑字段', () => {
  const document = appliedDocument();
  const base = layoutSignature(document);
  assert.equal(layoutSignature(clone(document)), base);
  const mutations = [
    draft => { draft.furniture[0].position.x += 0.05; },
    draft => { draft.furniture[0].position.z += 0.05; },
    draft => { draft.furniture[0].rotationDeg += 1; },
    draft => { draft.furniture[0].size.width += 0.05; },
    draft => { draft.furniture[0].size.depth += 0.05; },
    draft => { draft.furniture[0].size.height += 0.05; },
    draft => { draft.hideSpots[0].anchor.x += 0.05; },
    draft => { draft.hideSpots[0].anchor.z += 0.05; },
    draft => { draft.hideSpots[0].facing += 0.05; },
    draft => { draft.hideSpots[0].interactionRegion.radius += 0.05; },
  ];
  for (const mutate of mutations) {
    const tampered = clone(document);
    mutate(tampered);
    assert.notEqual(layoutSignature(tampered), base);
  }
});

test('parseLayoutDocument 不修改传入对象，授权地图数据始终原样', () => {
  const document = appliedDocument();
  const snapshot = JSON.stringify(document);
  const parsed = parseLayoutDocument(document);
  assert.equal(parsed.ok, true);
  assert.equal(JSON.stringify(document), snapshot);
  assert.deepEqual(FURNITURE, authoredFurniture);
  assert.deepEqual(HIDE_SPOTS, authoredSpots);
  // And a full save/read/restore cycle still leaves the authored module data alone.
  const storage = memoryStorage();
  assert.equal(writeSavedLayout(storage, document).ok, true);
  const restored = readSavedLayout(storage);
  assert.equal(restored.ok, true);
  new MapEditSession(layoutSource(restored.document));
  assert.deepEqual(FURNITURE, authoredFurniture);
  assert.deepEqual(HIDE_SPOTS, authoredSpots);
  assert.deepEqual(SPAWNS, authoredMapSource().spawns);
  assert.deepEqual(RICE_CANDIDATES, authoredMapSource().riceCandidates);
});

test('browserLayoutStorage 在没有 localStorage 的环境里返回 null', () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined,
      configurable: true, writable: true });
    assert.equal(browserLayoutStorage(), null);
    const fake = memoryStorage();
    Object.defineProperty(globalThis, 'localStorage', { value: fake,
      configurable: true, writable: true });
    assert.equal(browserLayoutStorage(), fake);
    assert.equal(fake.getItem(`${LAYOUT_STORAGE_KEY}:probe`), null);
  } finally {
    if (before) Object.defineProperty(globalThis, 'localStorage', before);
    else delete globalThis.localStorage;
  }
});
