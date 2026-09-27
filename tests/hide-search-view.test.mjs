import assert from 'node:assert/strict';
import test from 'node:test';
import { Quaternion, Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { HIDE_FEEDBACK_MS, HIDE_SEARCH_FADE_IN_MS, HIDE_SEARCH_FADE_OUT_MS,
  HIDE_SEARCH_HOLD_MS, HideSearchView } from '../src/three/HideSearchView.ts';

// S7C-1B：扇形特效是纯表现层。几何体只创建一次，`advance()` 只改透明度与可见性；
// 判定在 HumanSearchSkill 里完成，所以特效本身不可能产生第二次命中。
const view = () => {
  const scene = new Scene();
  return { scene, search: new HideSearchView(scene) };
};

test('扇形形状与已批准数值一致：半径 1.5、张角 120°', () => {
  const { search } = view();
  const parameters = search.fan.geometry.parameters;
  assert.equal(parameters.radius, GAME_CONFIG.humanSearch.range);
  assert.ok(Math.abs(parameters.thetaStart + GAME_CONFIG.humanSearch.halfAngleDeg * Math.PI / 180)
    < 1e-9);
  assert.ok(Math.abs(parameters.thetaLength - GAME_CONFIG.humanSearch.halfAngleDeg * 2 * Math.PI / 180)
    < 1e-9);
});

test('释放只放置一次扇形：位置与朝向取自快照，rotation.y = -heading', () => {
  const { search } = view();
  search.show({ x: 3, z: -4 }, Math.PI / 2);
  search.fan.updateMatrixWorld(true);
  // 修复轮 四：位移与朝向改由扇形自己承载（世界矩阵 = Ry(朝向)·Rx(-90°)，
  // 与旧实现逐值相同），表现层根节点从此恒为单位变换——否则挂在它下面的
  // 世界坐标对象（命中反馈 / AI 反馈 / 玩家白色高亮）会被释放点二次平移。
  assert.equal(search.root.position.x, 0);
  assert.equal(search.root.position.z, 0);
  assert.equal(search.root.rotation.y, 0);
  assert.equal(search.fan.position.x, 3);
  assert.equal(search.fan.position.z, -4);
  assert.equal(search.fan.position.y, 0.035);
  // 与判定同源：该世界朝向让局部 +X 指向 heading。
  const forward = new Vector3(1, 0, 0).applyQuaternion(
    search.fan.getWorldQuaternion(new Quaternion()));
  assert.ok(Math.abs(forward.x - Math.cos(Math.PI / 2)) < 1e-9);
  assert.ok(Math.abs(forward.z - Math.sin(Math.PI / 2)) < 1e-9);
  assert.equal(search.releaseCount, 1);
});

test('快速淡入、短暂停留、快速淡出，结束后完全隐藏', () => {
  const { search } = view();
  search.show({ x: 0, z: 0 }, 0);
  assert.equal(search.active, true);
  assert.equal(search.fan.visible, true);
  assert.equal(search.fan.material.opacity, 0);
  search.advance(HIDE_SEARCH_FADE_IN_MS / 2);
  assert.ok(search.fan.material.opacity > 0 && search.fan.material.opacity < 0.42);
  search.advance(HIDE_SEARCH_FADE_IN_MS / 2);
  assert.ok(Math.abs(search.fan.material.opacity - 0.42) < 1e-9, '淡入结束应达到全强度');
  search.advance(HIDE_SEARCH_HOLD_MS);
  assert.ok(Math.abs(search.fan.material.opacity - 0.42) < 1e-9, '停留期间保持不变');
  search.advance(HIDE_SEARCH_FADE_OUT_MS);
  assert.equal(search.active, false);
  assert.equal(search.fan.visible, false);
  assert.equal(search.fan.material.opacity, 0);
});

test('淡入淡出不产生第二次命中，也不销毁/重建几何体', () => {
  const { scene, search } = view();
  const geometry = search.fan.geometry;
  const material = search.fan.material;
  const feedbackGeometry = search.feedback.geometry;
  const children = scene.children.length;
  for (let index = 0; index < 25; index++) {
    search.show({ x: index, z: 0 }, index * 0.1);
    search.advance(HIDE_SEARCH_FADE_IN_MS);
    search.advance(HIDE_SEARCH_HOLD_MS);
    search.advance(HIDE_SEARCH_FADE_OUT_MS);
    // 每一帧都只改透明度与可见性：命中判定不在这一层。
    assert.equal(search.releaseCount, index + 1);
  }
  assert.equal(search.fan.geometry, geometry);
  assert.equal(search.fan.material, material);
  assert.equal(search.feedback.geometry, feedbackGeometry);
  assert.equal(scene.children.length, children, '连续 25 次释放不得新增场景对象');
});

test('命中家具的简易反馈会自行消失，且不改变几何数量', () => {
  const { scene, search } = view();
  const children = scene.children.length;
  search.showHitFeedback({ x: 1, z: 2 }, { width: 1, depth: 2, height: 1.15 });
  assert.equal(search.feedback.visible, true);
  assert.equal(search.feedbackCount, 1);
  assert.equal(search.feedback.position.x, 1);
  assert.equal(search.feedback.position.z, 2);
  assert.ok(Math.abs(search.feedback.scale.y - 1.15) < 1e-9);
  search.advance(HIDE_FEEDBACK_MS);
  assert.equal(search.feedback.visible, false);
  assert.equal(scene.children.length, children);
});

test('暂停、切换阵营、重开与地图应用都能安全清理，dispose 幂等', () => {
  const { scene, search } = view();
  search.show({ x: 0, z: 0 }, 1);
  search.showHitFeedback({ x: 0, z: 0 }, { width: 1, depth: 1, height: 1 });
  search.reset();
  assert.equal(search.active, false);
  assert.equal(search.fan.visible, false);
  assert.equal(search.feedback.visible, false);
  assert.equal(search.fan.material.opacity, 0);
  assert.equal(search.feedback.material.opacity, 0);
  // reset 之后仍可再次释放（重开一局不需要重建对象）。
  search.show({ x: 0, z: 0 }, 0);
  assert.equal(search.active, true);

  search.dispose();
  assert.equal(scene.children.length, 0);
  search.dispose();
  assert.equal(scene.children.length, 0, 'dispose 必须幂等');
});
