import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveInteractionIntent } from '../src/systems/HideInteractionArbitration.ts';

// S7C-1B：E 键仲裁。整局只会得到「一个」意图，所以同一次按键不可能同时触发
// 退出、门、扫雷或进食。优先级：扫雷 > 门 > 藏身 > 进食；藏身中只用于退出。
const base = (overrides = {}) => ({
  minesweeperOpen: false,
  concealed: false,
  door: null,
  rice: null,
  hide: null,
  ...overrides,
});

test('扫雷面板打开时整局只归它，即使门前、藏身中或米堆旁', () => {
  assert.equal(resolveInteractionIntent(base({
    minesweeperOpen: true, concealed: true, door: { distance: 0.1 },
    rice: { distance: 0.1 }, hide: { spotId: 'hide_main_bed' },
  })), 'MINESWEEPER');
});

test('藏身中 E 专用于退出，不触发门、扫雷或进食', () => {
  assert.equal(resolveInteractionIntent(base({
    concealed: true, door: { distance: 0.2 }, rice: { distance: 0.2 },
    hide: { spotId: 'hide_main_bed' },
  })), 'HIDE_EXIT');
});

test('未藏身时门优先于藏身与进食（沿用既有的距离比较）', () => {
  assert.equal(resolveInteractionIntent(base({
    door: { distance: 0.5 }, rice: { distance: 1.2 }, hide: { spotId: 'hide_closet' },
  })), 'DOOR');
  // 距离相等时门仍然优先：与既有 `nearby.distance <= rice.range` 逐字一致。
  assert.equal(resolveInteractionIntent(base({
    door: { distance: 1.0 }, rice: { distance: 1.0 }, hide: { spotId: 'hide_closet' },
  })), 'DOOR');
});

test('门不优先（米堆更近）时藏身排在进食之前', () => {
  assert.equal(resolveInteractionIntent(base({
    door: { distance: 1.3 }, rice: { distance: 0.4 }, hide: { spotId: 'hide_closet' },
  })), 'HIDE_ENTER');
});

test('没有藏身候选时回到进食，最后是无操作', () => {
  assert.equal(resolveInteractionIntent(base({ rice: { distance: 0.4 } })), 'RICE');
  assert.equal(resolveInteractionIntent(base()), 'NONE');
});

test('同一输入永远得到唯一意图（不会一次按键触发多种行为）', () => {
  const intents = new Set(['MINESWEEPER', 'DOOR', 'HIDE_EXIT', 'HIDE_ENTER', 'RICE', 'NONE']);
  const values = [null, { distance: 0.3 }, { distance: 1.4 }];
  for (const door of values) {
    for (const rice of values) {
      for (const hide of [null, { spotId: 'hide_main_bed' }]) {
        for (const concealed of [false, true]) {
          for (const minesweeperOpen of [false, true]) {
            const input = base({ door, rice, hide, concealed, minesweeperOpen });
            const first = resolveInteractionIntent(input);
            const second = resolveInteractionIntent(input);
            assert.equal(typeof first, 'string');
            assert.ok(intents.has(first), `未知意图 ${first}`);
            assert.equal(first, second, '仲裁必须是确定性的');
          }
        }
      }
    }
  }
});
