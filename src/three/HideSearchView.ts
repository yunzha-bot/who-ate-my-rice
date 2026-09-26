import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { headingRadToMeshRotationY } from '../systems/HumanSearchSkill.ts';
import type { Point } from './map/apartmentMap.ts';

/**
 * S7C-1B：Human Q 扇形搜查的**纯表现**层。
 *
 * 它不参与任何判定：真实命中在 `HumanSearchSkill.ts` 里按释放瞬间的快照算一次，
 * 这里只负责「扇形快速淡入、再快速淡出」和命中家具的简易反馈。几何体在构造时
 * 创建一次并长期复用，`advance()` 只改透明度与可见性，所以每帧不会销毁/重建
 * 几何体（也不影响 DEV-A 拖动与 DEV-B 观察的性能）。
 *
 * 颜色刻意避开 DEV 调试可视化的红/黄/青/紫，便于区分「技能特效」与「调试叠加」。
 */
// 视觉实现常量（不是玩法数值，因此留在表现层，不进 GAME_CONFIG）。
export const HIDE_SEARCH_FADE_IN_MS = 120;
export const HIDE_SEARCH_HOLD_MS = 140;
export const HIDE_SEARCH_FADE_OUT_MS = 260;
export const HIDE_FEEDBACK_MS = 520;
export const HIDE_SEARCH_COLOR = 0x7ef0c0;
export const HIDE_FEEDBACK_COLOR = 0xffe08a;

export interface HideSearchViewTuning {
  range: number;
  halfAngleDeg: number;
}

export class HideSearchView {
  private readonly root = new THREE.Group();
  private readonly fan: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly feedback: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly totalMs = HIDE_SEARCH_FADE_IN_MS + HIDE_SEARCH_HOLD_MS +
    HIDE_SEARCH_FADE_OUT_MS;
  private remainingMs = 0;
  private feedbackRemainingMs = 0;
  /** DEV / 测试用的计数：有效释放次数与家具反馈次数。 */
  releaseCount = 0;
  feedbackCount = 0;

  constructor(scene: THREE.Scene, tuning: HideSearchViewTuning = {
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
  }) {
    const halfAngleRad = tuning.halfAngleDeg * Math.PI / 180;
    this.fan = new THREE.Mesh(
      new THREE.CircleGeometry(tuning.range, 48, -halfAngleRad, halfAngleRad * 2),
      new THREE.MeshBasicMaterial({ color: HIDE_SEARCH_COLOR, transparent: true,
        opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.fan.rotation.x = -Math.PI / 2;
    this.fan.position.y = 0.035;
    this.fan.renderOrder = 3;
    this.fan.raycast = () => {};
    this.fan.visible = false;

    this.feedback = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: HIDE_FEEDBACK_COLOR, transparent: true,
        opacity: 0, wireframe: true, depthWrite: false }));
    this.feedback.renderOrder = 3;
    this.feedback.raycast = () => {};
    this.feedback.visible = false;

    this.root.add(this.fan, this.feedback);
    scene.add(this.root);
  }

  /** 释放瞬间的扇形：位置与朝向都取自快照，之后不再改变。 */
  show(origin: Point, headingRad: number): void {
    this.root.position.set(origin.x, 0, origin.z);
    this.root.rotation.y = headingRadToMeshRotationY(headingRad);
    this.remainingMs = this.totalMs;
    this.fan.visible = true;
    this.fan.material.opacity = 0;
    this.releaseCount++;
  }

  /** 命中家具时的简易反馈（不改变家具碰撞、不改地图布局）。 */
  showHitFeedback(centre: Point, size: { width: number; depth: number; height: number },
    rotationRad = 0): void {
    this.feedback.scale.set(Math.max(0.05, size.width + 0.06), Math.max(0.05, size.height),
      Math.max(0.05, size.depth + 0.06));
    this.feedback.position.set(centre.x, size.height / 2, centre.z);
    this.feedback.rotation.y = rotationRad;
    this.feedbackRemainingMs = HIDE_FEEDBACK_MS;
    this.feedback.visible = true;
    this.feedback.material.opacity = 0.95;
    this.feedbackCount++;
  }

  get active(): boolean { return this.remainingMs > 0 || this.feedbackRemainingMs > 0; }

  advance(deltaMs: number): void {
    const elapsed = Math.max(0, deltaMs);
    if (this.remainingMs > 0) {
      this.remainingMs = Math.max(0, this.remainingMs - elapsed);
      this.fan.material.opacity = this.fanOpacity();
      if (this.remainingMs === 0) {
        this.fan.visible = false;
        this.fan.material.opacity = 0;
      }
    }
    if (this.feedbackRemainingMs > 0) {
      this.feedbackRemainingMs = Math.max(0, this.feedbackRemainingMs - elapsed);
      this.feedback.material.opacity = 0.95 * (this.feedbackRemainingMs / HIDE_FEEDBACK_MS);
      if (this.feedbackRemainingMs === 0) {
        this.feedback.visible = false;
        this.feedback.material.opacity = 0;
      }
    }
  }

  /** 暂停、结算、切换阵营、重开与地图应用：立即清掉特效，不留下残留状态。 */
  reset(): void {
    this.remainingMs = 0;
    this.feedbackRemainingMs = 0;
    this.fan.visible = false;
    this.fan.material.opacity = 0;
    this.feedback.visible = false;
    this.feedback.material.opacity = 0;
  }

  dispose(): void {
    this.reset();
    this.root.removeFromParent();
    this.fan.geometry.dispose();
    this.fan.material.dispose();
    this.feedback.geometry.dispose();
    this.feedback.material.dispose();
  }

  private fanOpacity(): number {
    const elapsed = this.totalMs - this.remainingMs;
    if (elapsed < HIDE_SEARCH_FADE_IN_MS) {
      return 0.42 * (elapsed / HIDE_SEARCH_FADE_IN_MS);
    }
    const afterFadeIn = elapsed - HIDE_SEARCH_FADE_IN_MS;
    if (afterFadeIn < HIDE_SEARCH_HOLD_MS) return 0.42;
    const fadeProgress = Math.min(1, (afterFadeIn - HIDE_SEARCH_HOLD_MS) / HIDE_SEARCH_FADE_OUT_MS);
    return 0.42 * (1 - fadeProgress);
  }
}
