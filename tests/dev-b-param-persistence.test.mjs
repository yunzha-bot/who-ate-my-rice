import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RuntimeDebugOverrides, RUNTIME_PARAM_SPECS }
  from '../src/systems/RuntimeDebugOverrides.ts';
import { DevBRuntimeBinding } from '../src/systems/DevBRuntimeBinding.ts';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { DevBParamPersistence } from '../src/systems/DevBParamPersistence.ts';
import {
  DEV_B_STATE_TEXT, DEV_B_STORAGE_FORMAT, DEV_B_STORAGE_KEY, DEV_B_STORAGE_VERSION,
  browserDevBStorage, devBParamStorageState, devBPersistenceStorage, devBPresetText,
  formatDevBSavedAt, parseDevBPreset, readDevBPreset, removeDevBPreset, sameDevBParams,
  writeDevBPreset,
} from '../src/systems/DevBParamStore.ts';

// DEV-B 运行时调试参数持久化（用户 2026-09-27 一次性授权）。
//
// 覆盖：保存与恢复、刷新与重开、正式值回退（不删预设）、无效/损坏/版本不兼容的
// 存档安全回落、保存失败不虚报、生产环境隔离、38 项白名单合法性与抓捕半径副作用。
// 这些用例直接驱动真实 RuntimeDebugOverrides + 真实 DevBRuntimeBinding，
// 浏览器侧的人工验收步骤见 docs/DEV_B_RUNTIME_DEBUG_DESIGN.md。

const SAVED_AT = '2026-09-27T12:10:50.123Z';

/** 最小 localStorage 替身：只实现本模块用到的三个方法。 */
function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
  };
}

function persistenceWith(storage, runtime = new RuntimeDebugOverrides()) {
  return {
    runtime,
    persistence: new DevBParamPersistence({
      runtime, storage, now: () => new Date(SAVED_AT),
    }),
  };
}

function bindingFor(runtime, radiusCalls) {
  const match = new GameStateSystem(GAME_CONFIG.match.readyMs, GAME_CONFIG.match.captureMs,
    'PLAYING');
  const binding = new DevBRuntimeBinding(runtime, {
    gameState: match,
    onCaptureRadius: radius => radiusCalls.push(radius),
  });
  binding.start();
  return { binding, match };
}

test('DEV-B 白名单仍是 38 项（持久化不得改变可调参数集合）', () => {
  assert.equal(RUNTIME_PARAM_SPECS.length, 38);
  assert.equal(new Set(RUNTIME_PARAM_SPECS.map(spec => spec.id)).size, 38);
});

test('保存后本地预设写入独立键，并可直接读回', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('hearing.range.FOOTSTEP', 13);
  runtime.set('capture.radius', 1.5);

  const saved = persistence.save();
  assert.equal(saved.ok, true);
  assert.match(saved.message, /已保存 2 项/);
  assert.equal(storage.map.size, 1);
  assert.ok(storage.map.has(DEV_B_STORAGE_KEY));

  const raw = JSON.parse(storage.getItem(DEV_B_STORAGE_KEY));
  assert.equal(raw.format, DEV_B_STORAGE_FORMAT);
  assert.equal(raw.version, DEV_B_STORAGE_VERSION);
  assert.equal(raw.savedAt, SAVED_AT);
  assert.equal(raw.params['hearing.range.FOOTSTEP'], 13);
  assert.deepEqual(raw.params, { 'hearing.range.FOOTSTEP': 13, 'capture.radius': 1.5 });

  const again = persistenceWith(storage);
  const read = again.persistence.read();
  assert.equal(read.ok, true);
  assert.deepEqual(read.preset.params, { 'hearing.range.FOOTSTEP': 13, 'capture.radius': 1.5 });
  assert.equal(again.persistence.hasPreset, true);
  // 新一页的覆盖层还是空的，应用之后状态才是「已保存」。
  assert.equal(again.persistence.applySaved('刷新页面后恢复').ok, true);
  assert.equal(again.persistence.status().state, 'SAVED');
  assert.equal(persistence.status().state, 'SAVED');
});

test('刷新页面后按保存的预设恢复（同一 storage，新一页的内存覆盖层）', () => {
  const storage = memoryStorage();
  const first = persistenceWith(storage);
  first.runtime.set('hearing.range.FOOTSTEP', 13);
  assert.equal(first.persistence.save().ok, true);

  // 模拟刷新：新的覆盖层 + 新的持久化对象，只有 storage 跨页留存。
  const second = persistenceWith(storage);
  assert.equal(second.runtime.get('hearing.range.FOOTSTEP'),
    GAME_CONFIG.perception.sounds.FOOTSTEP.range);

  const applied = second.persistence.applySaved('刷新页面后恢复');
  assert.equal(applied.ok, true);
  assert.equal(applied.applied, 1);
  assert.equal(second.runtime.get('hearing.range.FOOTSTEP'), 13);
  assert.match(applied.message, /已恢复本地预设的 1 项覆盖/);
});

test('重开对局：先清掉本局临时覆盖，再恢复已保存预设', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  const { binding } = bindingFor(runtime, []);
  runtime.set('vision.range', 25);
  assert.equal(persistence.save().ok, true);
  // 本局又临时改了别的值：这些临时改动不写进预设。
  runtime.set('movement.playerSpeed', 600);

  assert.equal(binding.resetForNewRound(), 2);
  assert.equal(runtime.overrideCount, 0);
  assert.equal(runtime.visionRange, GAME_CONFIG.perception.visionRange);

  const applied = persistence.applySaved('新局开始');
  assert.equal(applied.ok, true);
  assert.equal(runtime.visionRange, 25);
  assert.equal(runtime.get('movement.playerSpeed'), GAME_CONFIG.player.speed);
  assert.equal(runtime.overrideCount, 1);
});

test('恢复正式默认值不删除已保存预设，可再次加载', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('hearing.range.FOOTSTEP', 13);
  assert.equal(persistence.save().ok, true);
  assert.equal(persistence.status().state, 'SAVED');

  assert.equal(runtime.clearAll(), 1);
  const base = persistence.status();
  assert.equal(base.state, 'BASE');
  assert.equal(base.text, '正式默认值');
  assert.equal(persistence.hasPreset, true, '恢复正式值不得悄悄删掉本地预设');
  assert.ok(storage.map.has(DEV_B_STORAGE_KEY));

  assert.equal(persistence.applySaved('手动加载').ok, true);
  assert.equal(runtime.get('hearing.range.FOOTSTEP'), 13);
  assert.equal(persistence.status().state, 'SAVED');
});

test('三态文案：正式默认值 / 已保存 / 未保存修改', () => {
  const runtime = new RuntimeDebugOverrides();
  const preset = {
    format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION, savedAt: SAVED_AT,
    params: { 'vision.range': 20 },
  };
  const empty = devBParamStorageState({ current: {}, preset: null });
  assert.equal(empty.state, 'BASE');
  assert.equal(empty.text, '正式默认值');

  const matching = devBParamStorageState({ current: { 'vision.range': 20 }, preset });
  assert.equal(matching.state, 'SAVED');
  assert.equal(matching.text, '已保存');

  const different = devBParamStorageState({ current: { 'vision.range': 21 }, preset });
  assert.equal(different.state, 'UNSAVED');
  assert.equal(different.text, '未保存修改');

  const noPreset = devBParamStorageState({ current: { 'vision.range': 21 }, preset: null });
  assert.equal(noPreset.state, 'UNSAVED');
  assert.deepEqual(Object.values(DEV_B_STATE_TEXT).sort(),
    ['已保存', '正式默认值', '未保存修改'].sort());
});

test('临时改动后状态变为未保存修改', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('vision.range', 20);
  assert.equal(persistence.save().ok, true);

  runtime.set('vision.range', 24);
  const status = persistence.status();
  assert.equal(status.state, 'UNSAVED');
  assert.equal(status.currentCount, 1);
  assert.equal(status.savedCount, 1);
  assert.match(status.detail, /与本地预设（1 项）不同/);
});

test('损坏 / 结构非法的存档一律被拒，且运行时保持正式默认值', () => {
  const cases = [
    ['NOT_JSON', '{ this is not json'],
    ['BAD_ENVELOPE', '[]'],
    ['BAD_FORMAT', JSON.stringify({ format: 'other/format', version: 1, params: {} })],
    ['VERSION_MISMATCH',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: 99, params: { 'vision.range': 12 } })],
    ['BAD_STRUCTURE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION })],
    ['BAD_STRUCTURE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION, params: [] })],
    ['NO_PARAMS',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION, params: {} })],
    ['UNKNOWN_PARAM',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION,
        params: { 'capture.nope': 1 } })],
    ['NOT_FINITE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION,
        params: { 'vision.range': null } })],
    ['NOT_FINITE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION,
        params: { 'vision.range': '12' } })],
    ['OUT_OF_RANGE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION,
        params: { 'vision.range': 999 } })],
    ['OUT_OF_RANGE',
      JSON.stringify({ format: DEV_B_STORAGE_FORMAT, version: DEV_B_STORAGE_VERSION,
        params: { 'capture.radius': 0 } })],
  ];
  for (const [code, raw] of cases) {
    const parsed = parseDevBPreset(raw, RUNTIME_PARAM_SPECS);
    assert.equal(parsed.ok, false, `应拒绝：${raw}`);
    assert.equal(parsed.code, code, `原因码不符：${raw}`);
    assert.ok(parsed.message.length > 0);
  }
  // JSON 里不可能出现 Infinity（JSON.stringify 会写成 null），因此这里直接
  // 覆盖「可被 JSON.parse 解出的非数字」这一类。
  assert.equal(parseDevBPreset(JSON.stringify({ format: DEV_B_STORAGE_FORMAT,
    version: DEV_B_STORAGE_VERSION, params: { 'vision.range': true } }),
  RUNTIME_PARAM_SPECS).code, 'NOT_FINITE');
  assert.equal(parseDevBPreset('', RUNTIME_PARAM_SPECS).code, 'EMPTY');
  assert.equal(parseDevBPreset(null, RUNTIME_PARAM_SPECS).code, 'EMPTY');
});

test('损坏存档安全回落：报原因、不白屏、不改运行时', () => {
  const storage = memoryStorage({ [DEV_B_STORAGE_KEY]: '{ broken' });
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('vision.range', 12);

  const applied = persistence.applySaved('刷新页面后恢复');
  assert.equal(applied.ok, false);
  assert.match(applied.message, /已回退正式默认值/);
  assert.match(applied.message, /NOT_JSON/);
  // 已经存在的临时覆盖不被破坏（这里保持用户当前值，回退只针对「恢复」本身）。
  assert.equal(runtime.visionRange, 12);
  assert.equal(persistence.error?.includes('NOT_JSON'), true);
  const status = persistence.status();
  assert.equal(status.error?.includes('NOT_JSON'), true);
  assert.equal(persistence.hasPreset, false);
});

test('保存失败不得虚报成功（写入抛错 / 回读不一致）', () => {
  const throwing = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: () => {},
  };
  const { runtime, persistence } = persistenceWith(throwing);
  runtime.set('vision.range', 15);
  const failed = persistence.save();
  assert.equal(failed.ok, false);
  assert.match(failed.message, /保存失败/);
  assert.match(failed.message, /STORAGE_WRITE_FAILED/);
  assert.equal(persistence.hasPreset, false);
  assert.equal(persistence.status().state, 'UNSAVED');

  const verified = memoryStorage();
  const silent = {
    getItem: () => null,
    setItem: (key, value) => { verified.setItem(key, value); },
    removeItem: () => {},
  };
  const second = persistenceWith(silent);
  second.runtime.set('vision.range', 15);
  const mismatch = second.persistence.save();
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.message, /STORAGE_VERIFY_FAILED/);
});

test('删除预设：成功即键消失；失败如实报错', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('vision.range', 20);
  assert.equal(persistence.save().ok, true);

  const removed = persistence.remove();
  assert.equal(removed.ok, true);
  assert.equal(storage.map.has(DEV_B_STORAGE_KEY), false);
  assert.equal(persistence.hasPreset, false);
  // 删除只删预设，不动当前内存中的覆盖值。
  assert.equal(runtime.visionRange, 20);

  const stubborn = {
    getItem: () => 'still-here',
    setItem: () => {},
    removeItem: () => {},
  };
  const second = persistenceWith(stubborn);
  const failed = second.persistence.remove();
  assert.equal(failed.ok, false);
  assert.match(failed.message, /STORAGE_REMOVE_FAILED/);
});

test('空覆盖值不生成预设', () => {
  const storage = memoryStorage();
  const { persistence } = persistenceWith(storage);
  const result = persistence.save();
  assert.equal(result.ok, false);
  assert.match(result.message, /NO_PARAMS/);
  assert.equal(storage.map.size, 0);
});

test('恢复预设时抓捕半径走既有绑定：清空旧进度并同步抓捕圈', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('capture.radius', 1.8);
  assert.equal(persistence.save().ok, true);

  // 新一页：进度在旧半径下累计，随后恢复预设。
  const radiusCalls = [];
  const second = persistenceWith(storage);
  const { match } = bindingFor(second.runtime, radiusCalls);
  match.captureProgressMs = 400;

  assert.equal(second.persistence.applySaved('刷新页面后恢复').ok, true);
  assert.equal(second.runtime.captureRadius, 1.8);
  assert.equal(match.captureProgressMs, 0, '改半径必须清空旧抓捕进度');
  assert.deepEqual(radiusCalls, [1.8], '抓捕圈视图必须同步到有效半径');
});

test('38 项白名单参数全部可保存并原样恢复', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  // 每项都取一个落在合法范围内的、与正式基准不同的值。
  const expected = new Map();
  for (const spec of RUNTIME_PARAM_SPECS) {
    const value = spec.base + spec.step > spec.max ? spec.base - spec.step : spec.base + spec.step;
    assert.ok(value >= spec.min && value <= spec.max, `${spec.id} 的测试值越界`);
    runtime.set(spec.id, value);
    expected.set(spec.id, value);
  }
  assert.equal(runtime.overrideCount, 38);
  assert.equal(persistence.save().ok, true);

  const second = persistenceWith(storage);
  assert.equal(second.persistence.applySaved('刷新页面后恢复').ok, true);
  assert.equal(second.runtime.overrideCount, 38);
  for (const [id, value] of expected) {
    assert.equal(second.runtime.get(id), value, `${id} 未按预设恢复`);
    assert.equal(second.runtime.isOverridden(id), true);
  }
});

test('生产环境隔离：拿不到 storage 时既不读取也不应用', () => {
  assert.equal(devBPersistenceStorage(false), null);
  const previous = globalThis.localStorage;
  try {
    // 即使浏览器里真的存在 localStorage，生产构建也必须拿到 null。
    globalThis.localStorage = memoryStorage({ [DEV_B_STORAGE_KEY]: devBPresetText(
      { 'vision.range': 20 }, SAVED_AT) });
    assert.equal(devBPersistenceStorage(false), null);
    assert.equal(devBPersistenceStorage(true), globalThis.localStorage);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }

  // 存储为 null 时所有入口都安全失败，且运行时保持正式默认值。
  const { runtime, persistence } = persistenceWith(null);
  assert.equal(persistence.enabled, false);
  assert.equal(persistence.applySaved('刷新页面后恢复').ok, false);
  assert.equal(persistence.save().ok, false);
  assert.equal(persistence.remove().ok, false);
  assert.equal(persistence.status().state, 'BASE');
  assert.equal(runtime.overrideCount, 0);

  // 覆盖层本身没有被写进任何地方：恢复正式值等于「本来就没有覆盖」。
  assert.equal(runtime.clearAll(), 0);
  assert.deepEqual(runtime.snapshot(), {});

  const disabled = new DevBParamPersistence({ runtime, storage: null });
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.read().ok, false);
  assert.equal(disabled.read().code, 'STORAGE_UNAVAILABLE');
});

test('DEV-B 预设与场景编辑器 V2 的地图存档互不干扰', () => {
  const storage = memoryStorage();
  const { runtime, persistence } = persistenceWith(storage);
  runtime.set('vision.range', 20);
  assert.equal(persistence.save().ok, true);
  assert.notEqual(DEV_B_STORAGE_KEY, 'who-ate-my-rice/scene-editor-layout');
  assert.equal(DEV_B_STORAGE_KEY, 'who-ate-my-rice/dev-b-runtime-params');
  assert.deepEqual([...storage.map.keys()], [DEV_B_STORAGE_KEY]);
});

test('无 localStorage 时 browserDevBStorage 返回 null', () => {
  const previous = globalThis.localStorage;
  try {
    delete globalThis.localStorage;
    assert.equal(browserDevBStorage(), null);
    assert.equal(readDevBPreset(null, RUNTIME_PARAM_SPECS).code, 'STORAGE_UNAVAILABLE');
    assert.equal(writeDevBPreset(null, { 'vision.range': 20 }, SAVED_AT).code,
      'STORAGE_UNAVAILABLE');
    assert.equal(removeDevBPreset(null).code, 'STORAGE_UNAVAILABLE');
  } finally {
    if (previous !== undefined) globalThis.localStorage = previous;
  }
});

test('辅助函数：一致性比较与存档时间显示', () => {
  assert.equal(sameDevBParams({ a: 1 }, { a: 1 }), true);
  assert.equal(sameDevBParams({ a: 1 }, { a: 1.0000000001 }), true);
  assert.equal(sameDevBParams({ a: 1 }, { a: 1.5 }), false);
  assert.equal(sameDevBParams({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(formatDevBSavedAt(SAVED_AT), '2026-09-27 12:10:50');
  assert.equal(formatDevBSavedAt('not-a-date'), 'not-a-date');
});

test('源码不变量：ThreeGame 只在 DEV 构建接入，并在新局恢复预设', () => {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  assert.ok(source.includes('devBPersistenceStorage(import.meta.env.DEV)'),
    'storage 必须由 import.meta.env.DEV 决定（生产构建拿不到）');
  assert.equal(source.includes('devBPersistenceStorage(true)'), false);
  assert.equal(source.includes('browserDevBStorage'), false,
    'ThreeGame 不得绕过 devBPersistenceStorage 直接取 localStorage');

  const resetStart = source.indexOf('private resetRound(): void {');
  assert.ok(resetStart > 0);
  const reset = source.slice(resetStart, source.indexOf('private updateHud(', resetStart));
  assert.ok(reset.includes('this.devBBinding.resetForNewRound()'));
  assert.ok(reset.includes("this.devBPersistence.applySaved('新局开始')"));
  assert.ok(reset.indexOf('resetForNewRound()') < reset.indexOf('applySaved('),
    '必须先清掉本局临时覆盖，再恢复预设');

  const debug = readFileSync(new URL('../src/three/DevBDebug.ts', import.meta.url), 'utf8');
  assert.ok(debug.includes('persistence?: DevBParamPersistence | null'));
  assert.ok(debug.includes('this.options.persistence'));
  assert.ok(debug.includes('DEV_B_DELETE_CONFIRM'));
  assert.ok(debug.includes('defaultDevBConfirm'));
  const panel = readFileSync(new URL('../src/three/DevBPanel.ts', import.meta.url), 'utf8');
  for (const label of ['保存调试参数', '加载已保存预设', '删除本地预设（需确认）']) {
    assert.ok(panel.includes(label), `面板缺少按钮：${label}`);
  }
  assert.ok(panel.includes('dataset.storageState'));
  // 删除必须先确认：没有 confirm 实现时默认拒绝，绝不静默删除。
  assert.ok(debug.includes('if (!ask(DEV_B_DELETE_CONFIRM))'));
  assert.ok(!/confirm\(/.test(panel), '确认逻辑只能放在编排层，不在面板里直接弹窗');
});
