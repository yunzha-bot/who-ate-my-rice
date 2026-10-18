import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLS_HELP_ROWS, controlsHelpMarkup, CONTROLS_HELP_TITLES }
  from '../src/three/ControlsHelpView.ts';
import { populateRoundActions } from '../src/three/GameUiLayout.ts';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { GameStateSystem } from '../src/systems/GameStateSystem.ts';
import { CaptureNetSystem } from '../src/systems/CaptureNetSystem.ts';

// Execute the actual frame's phase dispatch, without constructing WebGL/AI.
function helpFrameFixture(phase = 'READY') {
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  const start = source.indexOf('    const gameplayMs = this.devFreeze.gameplayDelta');
  const end = source.indexOf('    const editorOpen =', start);
  assert.ok(start > 0 && end > start);
  const orientation = { portrait: false };
  const orientationStart = source.indexOf('    const portrait = globalThis.matchMedia');
  const orientationEnd = source.indexOf('    const cameraEnabled', orientationStart);
  assert.ok(orientationStart > 0 && orientationEnd > orientationStart);
  const frame = runInNewContext(`(function(deltaMs) { ${source.slice(orientationStart, orientationEnd)} ${source.slice(start, end)
    .replaceAll('import.meta.env.DEV', 'false')} })`, {
    C: { development: { directHotkeysEnabled: false } },
    resolveRoundShortcut: () => null,
    document: { hidden: false, hasFocus: () => true },
    matchMedia: () => ({ matches: orientation.portrait }),
  });
  const game = {
    match: new GameStateSystem(3000, 350, phase),
    controlsHelp: { visible: true },
    captureNet: new CaptureNetSystem(), captureNetView: { cancel() {} },
    control: { isControlling: side => side === 'HUMAN' },
    devFreeze: { isFrozen: false, gameplayDelta: (_phase, ms) => ms, readyDelta: ms => ms },
    input: { escape: false, clears: 0, setTabCaptureEnabled() {},
      consumePress(key) { return key === 'Escape' && this.escape; },
      clear() { this.clears++; this.escape = false; } },
    debugPossessionEnabled: false, pulseLock: { isOpen: false },
    lastReadySeconds: 3, audio: { play() {} }, pauseSettingsOpen: false,
    closeControlsHelp() { this.controlsHelp.visible = false; this.input.clear(); },
    togglePause() { if (!this.match.pause()) this.match.resume(); },
    updatePlaying(ms) { this.match.advancePlaying(ms, false, false); },
  };
  return { game, orientation, step: ms => frame.call(game, ms) };
}

test('mobile portrait preserves READY time and pauses PLAYING until explicitly continued in landscape', () => {
  const ready = helpFrameFixture(); ready.game.closeControlsHelp(); ready.orientation.portrait = true;
  ready.step(1000); assert.equal(ready.game.match.readyRemainingMs, 3000);
  ready.orientation.portrait = false; ready.step(50); assert.equal(ready.game.match.readyRemainingMs, 2950);
  const active = helpFrameFixture('PLAYING'); active.game.closeControlsHelp(); active.orientation.portrait = true;
  active.step(1000); assert.equal(active.game.match.phase, 'PAUSED'); assert.equal(active.game.match.elapsedMs, 0);
  active.orientation.portrait = false; active.step(1000); assert.equal(active.game.match.phase, 'PAUSED');
});

test('首次说明停留期间 READY 保持完整，关闭后才开始倒计时', () => {
  const { game, step } = helpFrameFixture();
  for (let i = 0; i < 400; i++) step(50);
  assert.equal(game.match.phase, 'READY');
  assert.equal(game.match.readyRemainingMs, 3000);
  assert.equal(game.match.elapsedMs, 0);
  game.closeControlsHelp();
  step(50);
  assert.equal(game.match.readyRemainingMs, 2950);
  for (let i = 0; i < 59; i++) step(50);
  assert.equal(game.match.phase, 'PLAYING');
});

test('Esc只关闭说明，不切换暂停或推进关闭当帧，且清空缓存输入', () => {
  const { game, step } = helpFrameFixture();
  game.input.escape = true;
  step(50);
  assert.equal(game.controlsHelp.visible, false);
  assert.equal(game.match.phase, 'READY');
  assert.equal(game.match.readyRemainingMs, 3000);
  assert.ok(game.input.clears > 0);
});

test('暂停中重看说明及Esc关闭后仍暂停，显示说明时不推进PLAYING', () => {
  const paused = helpFrameFixture('PAUSED');
  paused.step(50);
  paused.game.input.escape = true;
  paused.step(50);
  assert.equal(paused.game.match.phase, 'PAUSED');
  assert.equal(paused.game.match.elapsedMs, 0);
  const playing = helpFrameFixture('PLAYING');
  playing.step(50);
  assert.equal(playing.game.match.elapsedMs, 0);
});

test('Esc cancels net preparation without spending cooldown; next Esc pauses and freezes net clocks', () => {
  const { game, step } = helpFrameFixture('PLAYING'); game.controlsHelp.visible = false;
  game.captureNet.place({ x: 0, z: 0 }, { x: 1.4, z: 0 }, () => null, () => true);
  game.input.escape = true; step(50);
  assert.equal(game.captureNet.mode, 'NONE'); assert.equal(game.captureNet.cooldownMs, 0);
  assert.equal(game.match.phase, 'PLAYING');
  game.captureNet.net = { x: 1.4, z: 0, ageMs: 1000 }; game.captureNet.cooldownMs = 19000;
  step(50); assert.equal(game.match.phase, 'PAUSED');
  game.input.escape = false; const before = JSON.stringify(game.captureNet);
  for (let i = 0; i < 100; i++) step(50);
  assert.equal(JSON.stringify(game.captureNet), before);
});

// 最小操作教学（独立说明层）的验收口径：
//   ① 只写**已核对过源码的真实按键**；
//   ② 不出现内部倍率、世界单位；允许眩晕时长等玩家规则；
//   ③ 不出现 AI 决策词汇或隐藏信息；
//   ④ 阵营分工与真实输入一致（Human 没有吃米/冲刺，DeepSeek 没有强破/搜查）；
//   ⑤ 暂停菜单提供「操作说明」入口，且不改变其它按钮的顺序。

const VERIFIED_KEYS = new Set(['W', 'A', 'S', 'D', 'Space', 'E', 'Q', 'F', 'V',
  '按住左键', '右键', 'Esc', '贴住她']);

const FORBIDDEN_IN_HELP = ['倍率', '世界单位', 'u/s', '秒）', 'DETOUR', 'FORCE_BREAK',
  'sprintDecision', 'lockDecision', '隐藏位置', '藏身点', '坐标', 'AI'];

test('说明层只使用已核对的真实按键', () => {
  for (const faction of ['HUMAN', 'DEEPSEEK']) {
    for (const row of CONTROLS_HELP_ROWS[faction]) {
      assert.ok(row.keys.length > 0, `${faction} 有一行没有按键`);
      for (const key of row.keys) {
        assert.ok(VERIFIED_KEYS.has(key), `${faction} 出现了未核对的按键「${key}」`);
      }
      assert.ok(row.text.trim().length > 0);
    }
  }
});

test('说明层解释眩晕和回收规则，但不暴露内部数值与 AI 决策词汇', () => {
  const markup = controlsHelpMarkup();
  // 只看玩家真正读到的文字（去掉标签名，例如 h2 / h3 里的数字）。
  const text = markup.replace(/<[^>]*>/g, ' ');
  assert.match(text, /眩晕 3 秒/);
  assert.match(text, /不锈钢盆最多投掷三次/);
  assert.match(text, /尚有耐久时落地后可再次拾取/);
  assert.match(text, /其他道具投出后不可再次拾取/);
  for (const word of FORBIDDEN_IN_HELP) {
    assert.equal(text.includes(word), false, `文字不应出现「${word}」`);
  }
});

test('两个阵营的说明与真实输入分工一致', () => {
  const human = CONTROLS_HELP_ROWS.HUMAN.map(row => `${row.keys.join('')} ${row.text}`).join(' | ');
  const deepseek = CONTROLS_HELP_ROWS.DEEPSEEK.map(row => `${row.keys.join('')} ${row.text}`).join(' | ');
  // Human：Space 强破 / E 门和家具 / V 扇形抓捕 / Q捕捉网。
  assert.match(human, /Space .*强行破锁/);
  assert.match(CONTROLS_HELP_ROWS.HUMAN.find(row => row.keys.includes('V')).text, /扇形抓捕.*不搜查家具/);
  assert.match(CONTROLS_HELP_ROWS.HUMAN.find(row => row.keys.includes('E')).text, /搜查面前合法家具.*共用冷却/);
  assert.match(human, /Q .*捕捉网/);
  assert.match(human, /E .*解锁/);
  assert.equal(human.includes('吃米'), false);
  assert.equal(human.includes('冲刺'), false);
  // DeepSeek：E 吃米 / Space 冲刺 / Q 上锁；没有强破与搜查。
  assert.match(deepseek, /E .*吃米/);
  assert.match(deepseek, /Space .*冲刺/);
  assert.match(deepseek, /Q .*上锁/);
  assert.equal(deepseek.includes('强破'), false);
  assert.equal(deepseek.includes('搜查'), false);
});

test('说明层 markup 含两个阵营分区、关闭按钮与重看说明', () => {
  const markup = controlsHelpMarkup();
  assert.match(markup, /data-side="HUMAN"/);
  assert.match(markup, /data-side="DEEPSEEK"/);
  assert.match(markup, /class="controls-help-close"/);
  assert.match(markup, /暂停后，可以从「操作说明」再打开/);
  assert.match(markup, new RegExp(CONTROLS_HELP_TITLES.HUMAN));
  assert.match(markup, new RegExp(CONTROLS_HELP_TITLES.DEEPSEEK));
  assert.equal(markup.includes('role="dialog"'), true);
});

test('暂停菜单提供操作说明入口，但不改变其它按钮的顺序', t => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ hidden: false, listeners: [],
    addEventListener(name, callback) { assert.equal(name, 'click'); this.listeners.push(callback); } }) };
  t.after(() => { globalThis.document = oldDocument; });
  const calls = [];
  const pause = { append(...nodes) { this.nodes = [...(this.nodes ?? []), ...nodes]; } };
  const result = { append(...nodes) { this.nodes = [...(this.nodes ?? []), ...nodes]; } };
  const handlers = Object.fromEntries(['resume', 'settings', 'restart', 'menu', 'help']
    .map(key => [key, () => calls.push(key)]));
  const settings = populateRoundActions(pause, result, { ...handlers, developerMode: false });
  assert.deepEqual(pause.nodes.map(node => node.textContent),
    ['继续游戏', '设置', '操作说明', '重新开始', '返回主菜单']);
  assert.equal(settings, pause.nodes[1]);
  pause.nodes[2].listeners[0]();
  assert.deepEqual(calls, ['help']);
  // 没有接线时不生成该按钮，旧组合保持不变。
  const plainPause = { append(...nodes) { this.nodes = [...(this.nodes ?? []), ...nodes]; } };
  populateRoundActions(plainPause, result, {
    resume: () => {}, settings: () => {}, restart: () => {}, menu: () => {},
    switchFaction: () => {}, developerMode: false });
  assert.deepEqual(plainPause.nodes.map(node => node.textContent),
    ['继续游戏', '设置', '重新开始', '返回主菜单']);
});
