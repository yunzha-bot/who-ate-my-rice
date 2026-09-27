import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RiceSystem } from '../src/systems/RiceSystem.ts';
import { HideSearchView, HIDE_PLAYER_TARGET_BREATH_MS }
  from '../src/three/HideSearchView.ts';
import { RiceView } from '../src/three/RiceView.ts';

function outline(scene) {
  return scene.children.find(child => child.type === 'Group').children.at(-1);
}

test('rice reuses one white edge outline and shrinks with actual eating progress', () => {
  const scene = new Scene();
  const search = new HideSearchView(scene);
  const rice = new RiceSystem('rice_01', 5_000, 400);
  const view = new RiceView(0.5, GAME_CONFIG.rice.color, GAME_CONFIG.rice.visual);
  view.position.set(3, 0, -2);
  view.sync(rice.rice);
  search.setRiceTarget(rice.rice.id, {
    centre: { x: view.position.x, z: view.position.z },
    size: view.outlineSize, rotationRad: 0 });
  const edge = outline(scene);
  const geometry = edge.geometry.uuid;
  const material = edge.material.uuid;
  const full = edge.scale.clone();
  assert.equal(edge.isLineSegments, true);
  assert.equal(search.playerTargetKind, 'RICE');
  assert.equal(search.playerTargetRiceId, rice.rice.id);
  assert.equal(search.playerTargetSpotId, null);
  scene.updateMatrixWorld(true);
  assert.deepEqual(edge.getWorldPosition(new Vector3()).toArray(),
    [3, view.outlineSize.height / 2, -2]);
  rice.update(2_900, true);
  view.sync(rice.rice);
  search.setRiceTarget(rice.rice.id, {
    centre: { x: view.position.x, z: view.position.z },
    size: view.outlineSize, rotationRad: 0 });
  assert.ok(edge.scale.y < full.y);
  assert.ok(edge.scale.x < full.x);
  assert.equal(edge.geometry.uuid, geometry);
  assert.equal(edge.material.uuid, material);
  search.dispose();
  view.dispose();
  assert.equal(edge.geometry.getAttribute('position').count, 24);
});

test('one shared white outline switches furniture and rice without residual targets', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const edge = outline(scene);
  view.setPlayerTarget('hide_bed', { centre: { x: 1, z: 2 },
    size: { width: 2, depth: 2, height: 0.5 }, rotationRad: 0.3 }, true);
  const geometry = edge.geometry;
  const material = edge.material;
  view.setRiceTarget('rice_01', { centre: { x: 4, z: 5 },
    size: { width: 0.5, depth: 0.5, height: 0.4 }, rotationRad: 0 });
  assert.equal(view.playerTargetSpotId, null);
  assert.equal(view.playerTargetRiceId, 'rice_01');
  assert.deepEqual([edge.position.x, edge.position.z, edge.rotation.y], [4, 5, 0]);
  assert.equal(edge.geometry, geometry);
  assert.equal(edge.material, material);
  view.clearPlayerTarget();
  assert.equal(view.playerTargetKind, 'NONE');
  assert.equal(edge.visible, false);
  view.dispose();
});

test('rice outline really breathes, then clears on depletion, pause and reset', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const edge = outline(scene);
  view.setRiceTarget('rice_01', { centre: { x: 0, z: 0 },
    size: { width: 0.5, depth: 0.5, height: 0.5 }, rotationRad: 0 });
  const opacities = [];
  for (let i = 0; i < 8; i++) {
    view.advance(HIDE_PLAYER_TARGET_BREATH_MS / 8);
    opacities.push(edge.material.opacity);
  }
  assert.ok(Math.max(...opacities) - Math.min(...opacities) > 0.2);
  view.clearPlayerTarget(); // RiceField 完成时 ThreeGame 下一帧移除目标。
  assert.equal(edge.visible, false);
  view.setRiceTarget('rice_02', { centre: { x: 1, z: 0 },
    size: { width: 0.2, depth: 0.2, height: 0.1 }, rotationRad: 0 });
  view.reset(); // 暂停、重开与地图应用共享清理路径。
  assert.equal(edge.visible, false);
  assert.equal(view.playerTargetRiceId, null);
  assert.equal(view.active, false);
  view.dispose();
});

test('Human Q and Human AI feedback keep their existing independent objects', () => {
  const scene = new Scene();
  const view = new HideSearchView(scene);
  const root = scene.children.find(child => child.type === 'Group');
  const aiOutline = root.children[3];
  const white = outline(scene);
  view.showAiInspection({ x: -1, z: 0 }, 0,
    { x: 2, z: 0 }, { width: 1, depth: 1, height: 1 });
  view.setRiceTarget('rice_01', { centre: { x: 4, z: 0 },
    size: { width: 0.5, depth: 0.5, height: 0.5 }, rotationRad: 0 });
  assert.equal(aiOutline.visible, true);
  assert.equal(white.visible, true);
  view.clearPlayerTarget();
  assert.equal(aiOutline.visible, true);
  assert.equal(white.visible, false);
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  view.dispose();
});
