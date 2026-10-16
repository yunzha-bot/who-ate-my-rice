import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMatchTime, populateRoundActions } from '../src/three/GameUiLayout.ts';
import { observeHumanHideSearch } from '../src/three/DevBHumanHideObservation.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';

test('shared match clock retains millisecond truncation and unbounded minutes', () => {
  for (const [ms, text] of [[0,'00:00'], [999,'00:00'], [59999,'00:59'],
    [60000,'01:00'], [754321,'12:34'], [3661123,'61:01']]) {
    assert.equal(formatMatchTime(ms), text);
  }
});

test('round action composition preserves labels, order, single callbacks and DEV visibility', t => {
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ hidden: false, listeners: [],
    addEventListener(name, callback) { assert.equal(name, 'click'); this.listeners.push(callback); } }) };
  t.after(() => { globalThis.document = oldDocument; });
  for (const developerMode of [false, true]) {
    const calls = [], pause = { append(...nodes) { this.nodes = [...(this.nodes ?? []), ...nodes]; } },
      result = { append(...nodes) { this.nodes = [...(this.nodes ?? []), ...nodes]; } };
    const handlers = Object.fromEntries(['resume','settings','restart','menu','switchFaction'].map(key => [key, () => calls.push(key)]));
    const settings = populateRoundActions(pause, result, { ...handlers, developerMode });
    assert.deepEqual(pause.nodes.map(x => x.textContent), ['继续游戏','设置','重新开始','返回主菜单',
      ...(developerMode ? ['开发调试：切换主控阵营'] : [])]);
    assert.deepEqual(result.nodes.map(x => x.textContent), ['再来一局','返回阵营选择']);
    assert.equal(settings, pause.nodes[1]);
    assert.equal(pause.nodes.length, developerMode ? 5 : 4);
    for (const button of [...pause.nodes, ...result.nodes]) {
      assert.equal(button.type, 'button'); assert.equal(button.listeners.length, 1); button.listeners[0]();
    }
    assert.deepEqual(calls, ['resume','settings','restart','menu',
      ...(developerMode ? ['switchFaction'] : []),'restart','menu']);
  }
});

test('DEV hide projection reads real AI state without advancing or modifying it', () => {
  const ai = new HumanAIController({ nearestFree: p => p, findPath: () => null }, [], [], () => .5);
  ai.checkHideCheckedSpotIds.push('spot-a'); ai.checkHideRequestPosition = { x: 3, z: 4 };
  const before = JSON.stringify(ai);
  const result = observeHumanHideSearch(ai, 1234, {
    authoritativeCode: 'MISS_EMPTY', authoritativeDetail: '搜空', countsAsFormalCheck: true,
  });
  assert.equal(result.clueCount, 0); assert.equal(result.latestClueAgeMs, null);
  assert.equal(result.authoritativeCode, 'MISS_EMPTY'); assert.equal(result.authoritativeDetail, '搜空');
  assert.equal(result.countsAsFormalCheck, true); assert.equal(result.phase, ai.checkHidePhase);
  assert.equal(JSON.stringify(ai), before);
  result.checkedSpotIds.push('returned-only'); result.requestPosition.x = 99;
  assert.deepEqual(ai.checkHideCheckedSpotIds, ['spot-a']);
  assert.deepEqual(ai.checkHideRequestPosition, { x: 3, z: 4 });
});
