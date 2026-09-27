import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Scene } from 'three';
import { HideSearchView, HIDE_AI_DONE_MS, HIDE_AI_DONE_OPACITY,
  HIDE_AI_INSPECT_COLOR, HIDE_AI_INSPECT_OPACITY,
  HIDE_FEEDBACK_COLOR, HIDE_SEARCH_COLOR } from '../src/three/HideSearchView.ts';
import { resolveCharacterAction } from '../src/systems/CharacterAction.ts';

// S7C-2 修复轮 五：Human AI 正式搜查的**可见反馈**。
//
// 玩家以前只能看到 AI 停住并转向，分不清「在附近调查」与「真的在检查某件家具」。
// 这里用真实 THREE 场景验证这套表现层的三条硬约束：
//   ① 只在正式搜查停留期间点亮，离开时收起并给一次中性收尾；
//   ② 与玩家 Q 的扇形完全独立（不共用网格、不触碰任何冷却）；
//   ③ 重置 / 重建时不留残留。

const SIZE = { width: 0.9, depth: 0.9, height: 0.75 };
const CENTRE = { x: 7.9, z: 3.9 };

function meshes(view, scene) {
  const root = scene.children.find(child => child.type === 'Group');
  assert.ok(root, '表现层根节点必须挂到场景上');
  return root.children;
}

test('the AI inspection feedback lights up only while the formal dwell runs', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const parts = meshes(view, scene);
  assert.equal(parts.length, 5,
    '玩家扇形 / 命中反馈 / AI 扇形 / AI 家具轮廓 / 玩家 Q 家具高亮');
  const [playerFan, hitFeedback, aiFan, aiOutline] = parts;
  assert.equal(aiFan.visible, false);
  assert.equal(aiOutline.visible, false);
  assert.equal(view.active, false);

  view.showAiInspection({ x: 7.2, z: 3.6 }, 0.32, CENTRE, SIZE, 0);
  assert.equal(aiFan.visible, true);
  assert.equal(aiFan.material.opacity, HIDE_AI_INSPECT_OPACITY);
  assert.equal(aiOutline.visible, true);
  assert.equal(view.aiInspectCount, 1);
  assert.equal(view.active, true);
  // 玩家 Q 的扇形与命中反馈完全不受影响，也没有被「顺手放一次」。
  assert.equal(playerFan.visible, false);
  assert.equal(hitFeedback.visible, false);
  assert.equal(view.releaseCount, 0);
  assert.equal(view.feedbackCount, 0);
  // 持续高亮不是计时器驱动：advance 不会把它淡掉（正式搜查停留由 AI 状态驱动）。
  view.advance(1500);
  assert.equal(aiFan.visible, true);
  assert.equal(aiFan.material.opacity, HIDE_AI_INSPECT_OPACITY);

  // 收尾：搜空时给一次会衰减的中性脉冲，之后彻底消失。
  view.hideAiInspection();
  view.showAiInspectionDone(CENTRE, SIZE, 0);
  assert.equal(view.aiDoneCount, 1);
  assert.equal(aiOutline.material.opacity, HIDE_AI_DONE_OPACITY);
  view.advance(HIDE_AI_DONE_MS / 2);
  assert.ok(aiOutline.material.opacity > 0 && aiOutline.material.opacity < HIDE_AI_DONE_OPACITY);
  view.advance(HIDE_AI_DONE_MS);
  assert.equal(aiOutline.visible, false);
  assert.equal(view.active, false);
});

test('the AI feedback and the player Q fan are independent', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const [playerFan, , aiFan] = meshes(view, scene);
  // 两者可以同时存在，互不覆盖对方的网格。
  view.show({ x: 0, z: 0 }, 0);
  view.showAiInspection({ x: 7.2, z: 3.6 }, 0.32, CENTRE, SIZE, 0);
  assert.equal(view.releaseCount, 1);
  assert.equal(view.aiInspectCount, 1);
  assert.notEqual(playerFan, aiFan);
  assert.notEqual(playerFan.material.color.getHex(), aiFan.material.color.getHex());
  assert.equal(aiFan.material.color.getHex(), HIDE_AI_INSPECT_COLOR);
  assert.notEqual(HIDE_AI_INSPECT_COLOR, HIDE_SEARCH_COLOR);
  assert.notEqual(HIDE_AI_INSPECT_COLOR, HIDE_FEEDBACK_COLOR);
  // DEV-B 三层线索可视化用的是另外三个颜色，表现层不与之撞色。
  for (const devColor of [0x7dff8f, 0x4ff0e0, 0xff5fd0])
    assert.notEqual(HIDE_AI_INSPECT_COLOR, devColor);
  // 重置（暂停 / 结算 / 重开 / 换图）必须清掉 AI 反馈，不留残留。
  view.reset();
  assert.equal(aiFan.visible, false);
  assert.equal(view.active, false);
  assert.equal(playerFan.visible, false);
});

test('the formal dwell drives the existing INTERACT action without touching gameplay', () => {
  // 表现层只读玩法状态：正式搜查停留期间走既有 INTERACT 动作（不新增动作类型），
  // 且动作解析不接触任何玩法数值。
  assert.equal(resolveCharacterAction({ moving: false, interacting: true }), 'INTERACT');
  const source = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url),
    'utf8');
  assert.match(source, /checkHidePhase === 'DWELL'/);
  // 反馈同步不得触碰玩家 Q 的冷却，也不得参与正式判定。
  const feedback = source.slice(source.indexOf('private syncHumanAiSearchFeedback'),
    source.indexOf('private nearestHideCandidate'));
  assert.doesNotMatch(feedback, /humanSearchCooldown|performHumanAiHideCheck|forceCapture/,
    '表现层不得触发冷却或抓捕结算');
  assert.doesNotMatch(feedback, /evaluateHumanSearch|resolveHumanAiHideCheck/,
    '表现层不得参与命中判定');
});

test('the AI outline also lands on the real furniture in world space', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const [, , aiFan, aiOutline] = meshes(view, scene);
  // 先释放一次玩家普通扇形：旧实现会在这里把表现层根节点搬到玩家位置，
  // 于是 AI 的暖橙扇形 / 轮廓也被整体平移（与玩家白高亮同一个根因）。
  view.show({ x: -11.4, z: -5 }, 1.2);
  view.showAiInspection({ x: 7.2, z: 3.6 }, 0.32, CENTRE, SIZE, 0);
  scene.updateMatrixWorld(true);
  const world = object => [object.matrixWorld.elements[12],
    object.matrixWorld.elements[13], object.matrixWorld.elements[14]];
  assert.deepEqual(world(aiOutline), [CENTRE.x, SIZE.height / 2, CENTRE.z]);
  assert.deepEqual(world(aiFan), [7.2, 0.03, 3.6]);
});
