import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, Scene, Vector3 } from 'three';
import { HideSearchView, HIDE_PLAYER_TARGET_COLOR, HIDE_PLAYER_TARGET_BREATH_MS,
  HIDE_PLAYER_TARGET_MARGIN, HIDE_PLAYER_TARGET_OPACITY_MAX, HIDE_PLAYER_TARGET_OPACITY_MIN,
  HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY, HIDE_AI_INSPECT_COLOR }
  from '../src/three/HideSearchView.ts';
import { headingRadToMeshRotationY } from '../src/systems/HumanSearchSkill.ts';

// S7C-2 修复轮 二 / 四：Human **玩家** Q 的唯一家具白色呼吸高亮（纯表现层）。
//
// 四条硬约束：
//   ① 高亮只表示「这件家具现在可以交互」，不表示里面有人（本测试只验证表现层；
//      占用在读法上根本进不来，见 hide-target-resolution / human-furniture-search）；
//   ② Q 冷却中必须一眼可见地「不可用」：描边压暗且不再呼吸，绝不误导玩家；
//   ③ 与 Human AI 的暖橙搜查反馈是两套独立对象与独立状态，绝不互相覆盖；
//   ④ 修复轮 四：高亮必须是**落在真实家具世界坐标上的家具棱线轮廓**，且不能被
//      普通扇形释放时的位移污染（旧缺陷见下面那条回归测试的注释）。

const SIZE = { width: 2.1, depth: 2.2, height: 0.45 };
const CENTRE = { x: -13, z: 10 };
const SPOT = 'hide_second_bed';

function parts(scene) {
  const root = scene.children.find(child => child.type === 'Group');
  assert.ok(root, '表现层根节点必须挂到场景上');
  return root.children;
}

test('the player furniture highlight breathes in white and never claims occupancy', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const meshes = parts(scene);
  const playerTarget = meshes[meshes.length - 1];
  assert.equal(playerTarget.visible, false);
  assert.equal(view.playerTargetPresent, false);
  assert.equal(view.active, false);

  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  assert.equal(playerTarget.visible, true);
  assert.equal(playerTarget.material.color.getHex(), HIDE_PLAYER_TARGET_COLOR);
  assert.equal(view.playerTargetPresent, true);
  assert.equal(view.playerTargetAvailable, true);
  assert.equal(view.playerTargetSpotId, SPOT);
  assert.equal(view.playerTargetSetCount, 1);
  assert.equal(view.active, true);
  // 位置 / 尺寸来自公开家具数据（高亮描边略大于家具本体，便于看清）。
  assert.equal(playerTarget.position.x, CENTRE.x);
  assert.equal(playerTarget.position.z, CENTRE.z);
  assert.equal(playerTarget.position.y, SIZE.height / 2);
  assert.equal(playerTarget.scale.x, SIZE.width + HIDE_PLAYER_TARGET_MARGIN);
  assert.equal(playerTarget.scale.z, SIZE.depth + HIDE_PLAYER_TARGET_MARGIN);

  // 呼吸：同一个周期内取多个采样点，透明度必须真的在上下变化，且永不超过上限。
  const samples = [];
  for (let step = 0; step < 8; step++) {
    view.advance(HIDE_PLAYER_TARGET_BREATH_MS / 8);
    samples.push(playerTarget.material.opacity);
  }
  const unique = new Set(samples.map(value => value.toFixed(4)));
  assert.ok(unique.size > 3, `呼吸必须产生多个透明度档位：${[...unique].join(',')}`);
  assert.ok(Math.max(...samples) <= HIDE_PLAYER_TARGET_OPACITY_MAX + 1e-9);
  assert.ok(Math.min(...samples) >= HIDE_PLAYER_TARGET_OPACITY_MIN - 1e-9);
  assert.ok(Math.max(...samples) - Math.min(...samples) > 0.2, '明暗差必须肉眼可见');

  // 每帧重复调用不会重复计数「建立高亮」，也不会抖动掉高亮。
  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  assert.equal(view.playerTargetSetCount, 1);
  assert.equal(playerTarget.visible, true);

  // 离开区域 / 切阵营 / 暂停 / 地图应用 / 重开：立即清除，不留残留。
  view.clearPlayerTarget();
  assert.equal(playerTarget.visible, false);
  assert.equal(playerTarget.material.opacity, 0);
  assert.equal(view.playerTargetPresent, false);
  assert.equal(view.playerTargetSpotId, null);
  assert.equal(view.playerTargetClearCount, 1);
  assert.equal(view.active, false);
});

test('while Q is on cooldown the highlight is visibly unavailable and never breathes', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const meshes = parts(scene);
  const playerTarget = meshes[meshes.length - 1];

  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, false);
  assert.equal(playerTarget.visible, true, '冷却中仍然显示家具，但必须明显不可用');
  assert.equal(view.playerTargetAvailable, false);
  assert.equal(playerTarget.material.opacity, HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY);
  // 连续推进：不可用状态是**恒定暗色**，不呼吸（玩家不会以为是「可以按」）。
  for (let step = 0; step < 6; step++) {
    view.advance(HIDE_PLAYER_TARGET_BREATH_MS / 6);
    assert.equal(playerTarget.material.opacity, HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY);
  }
  // 冷却结束后同一件家具立刻恢复呼吸。
  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  view.advance(HIDE_PLAYER_TARGET_BREATH_MS / 4);
  assert.ok(playerTarget.material.opacity > HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY);
});

test('the player highlight and the Human AI inspection feedback never share state', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const meshes = parts(scene);
  const [playerFan, hitFeedback, aiFan, aiOutline, playerTarget] = meshes;
  assert.equal(aiFan.material.color.getHex(), HIDE_AI_INSPECT_COLOR);
  assert.equal(aiOutline.material.color.getHex(), HIDE_AI_INSPECT_COLOR);

  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  view.showAiInspection({ x: -11.3, z: 10.8 }, 0.3, { x: 7.9, z: 3.9 }, SIZE, 0);
  assert.equal(playerTarget.visible, true);
  assert.equal(aiFan.visible, true);
  assert.equal(aiOutline.visible, true);
  // 收起 AI 反馈不影响玩家高亮；清除玩家高亮也不影响 AI 反馈。
  view.hideAiInspection();
  assert.equal(aiFan.visible, false);
  assert.equal(playerTarget.visible, true);
  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  assert.equal(aiOutline.visible, false, '收起 AI 反馈后轮廓不能再亮');
  assert.equal(playerFan.visible, false);
  assert.equal(hitFeedback.visible, false);
  // 重置会同时清掉两者（暂停 / 结算 / 重开 / 地图应用都走这里）。
  view.reset();
  assert.equal(playerTarget.visible, false);
  assert.equal(aiFan.visible, false);
  assert.equal(aiOutline.visible, false);
  assert.equal(view.playerTargetPresent, false);
  assert.equal(view.active, false);
});

// 修复轮 四的根因回归：白色高亮必须落在**真实家具的世界坐标**上。
//
// 修复前的真实缺陷：表现层根节点被 `show()`（普通扇形释放）搬到玩家释放点并带上
// 朝向，而所有「世界坐标」对象都挂在这个根节点下 → 只要本局按过一次 Q，高亮就被
// 二次平移。实测（`hide_main_bed` 中心 (-13,10)、玩家在 (-11.4,-5) 按过一次 Q）：
// 白色轮廓的世界坐标是 (-25.43, 0.23, -13.49)，已经在公寓之外，屏幕上什么都没有。
test('the furniture highlight stays in world space after a Q release', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const [playerFan, hitFeedback, aiFan, aiOutline, playerTarget] = parts(scene);

  // 先释放一次普通扇形：旧实现会在这里把根节点搬到 (-11.4,-5) 并带上朝向。
  view.show({ x: -11.4, z: -5 }, 1.2);
  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0 }, true);
  view.showAiInspection({ x: -11.3, z: 10.8 }, 0.3, { x: 7.9, z: 3.9 }, SIZE, 0);
  scene.updateMatrixWorld(true);

  assert.equal(Math.hypot(...rootOffset(scene)), 0, '根节点不得被释放点搬走');
  const world = object => object.getWorldPosition(new Vector3()).toArray();
  assert.deepEqual(world(playerTarget), [CENTRE.x, SIZE.height / 2, CENTRE.z]);
  assert.deepEqual(world(aiOutline), [7.9, SIZE.height / 2, 3.9]);
  assert.deepEqual(world(aiFan), [-11.3, 0.03, 10.8]);
  assert.deepEqual(world(playerFan), [-11.4, 0.035, -5]);
  assert.equal(hitFeedback.visible, false);

  // 扇形自身的朝向仍等于旧的 Ry(朝向)·Rx(-90°)：只是不再污染同级对象。
  const heading = headingRadToMeshRotationY(1.2);
  const expected = new Matrix4().makeRotationY(heading)
    .multiply(new Matrix4().makeRotationX(-Math.PI / 2));
  for (const index of [0, 1, 2, 4, 5, 6, 8, 9, 10])
    assert.ok(Math.abs(expected.elements[index] - playerFan.matrixWorld.elements[index]) < 1e-9,
      `扇形朝向必须与旧实现逐值相同（元素 ${index}）`);
});

function rootOffset(scene) {
  const root = scene.children.find(child => child.type === 'Group');
  return [root.position.x, root.position.y, root.position.z, root.rotation.y];
}

test('the highlight is a real furniture edge outline that reuses its geometry', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const meshes = parts(scene);
  const playerTarget = meshes[meshes.length - 1];

  // 轮廓 = 单位立方体的 12 条棱（24 个顶点），不是线框三角形网格，
  // 也不是家具中心悬浮的白色圆圈。
  assert.equal(playerTarget.isLineSegments, true);
  assert.equal(playerTarget.type, 'LineSegments');
  assert.equal(playerTarget.geometry.getAttribute('position').count, 24);
  assert.equal(playerTarget.material.wireframe, undefined);

  view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0.5 }, true);
  const geometryId = playerTarget.geometry.uuid;
  const materialId = playerTarget.material.uuid;
  // 三轴都外扩：与家具表面共面会被深度冲突吃掉（旧实现的顶面就正好重合）。
  assert.equal(playerTarget.scale.x, SIZE.width + HIDE_PLAYER_TARGET_MARGIN);
  assert.equal(playerTarget.scale.y, SIZE.height + HIDE_PLAYER_TARGET_MARGIN);
  assert.equal(playerTarget.scale.z, SIZE.depth + HIDE_PLAYER_TARGET_MARGIN);
  assert.equal(playerTarget.rotation.y, 0.5);
  assert.ok(playerTarget.renderOrder > 0);

  // 每帧同步 + 呼吸不得新建几何体或材质（无每帧对象创建 / 无材质泄漏）。
  for (let step = 0; step < 120; step++) {
    view.advance(16);
    view.setPlayerTarget(SPOT, { centre: CENTRE, size: SIZE, rotationRad: 0.5 }, true);
  }
  assert.equal(playerTarget.geometry.uuid, geometryId);
  assert.equal(playerTarget.material.uuid, materialId);

  // 家具切换：场景里始终只有一个白色高亮对象，不累积旧描边。
  view.setPlayerTarget('hide_main_bed',
    { centre: { x: 7.9, z: 3.9 }, size: SIZE, rotationRad: 0 }, true);
  const whiteSurfaces = [];
  scene.traverse(object => {
    if (object.material && object.material.color &&
        object.material.color.getHex() === HIDE_PLAYER_TARGET_COLOR) whiteSurfaces.push(object);
  });
  assert.deepEqual(whiteSurfaces, [playerTarget]);
  assert.equal(view.playerTargetSpotId, 'hide_main_bed');
  assert.deepEqual(playerTarget.position.toArray(), [7.9, SIZE.height / 2, 3.9]);

  // 清除（背对家具 / 走出区域 / 重开 / 换图）之后不再有任何呼吸残留。
  view.clearPlayerTarget();
  view.advance(400);
  assert.equal(playerTarget.visible, false);
  assert.equal(playerTarget.material.opacity, 0);
});
