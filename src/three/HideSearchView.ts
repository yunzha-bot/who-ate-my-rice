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
// S7C-2 修复轮 五：Human AI 正式搜查的可见反馈。暖橙色与玩家 Q 的薄荷色扇形、
// 命中反馈的琥珀色都不同；DEV-B 的三层线索可视化（绿 / 青 / 洋红）本身是独立开关
// 的调试图层，这里也不与它们撞色。
export const HIDE_AI_INSPECT_COLOR = 0xffab5c;
export const HIDE_AI_INSPECT_OPACITY = 0.3;
export const HIDE_AI_INSPECT_OUTLINE_OPACITY = 0.35;
export const HIDE_AI_DONE_MS = 460;
export const HIDE_AI_DONE_OPACITY = 0.9;
// S7C-2 修复轮 二 / 四：Human **玩家** Q 的唯一家具交互高亮。白色、呼吸式，
// 与玩家扇形（薄荷）、命中反馈（琥珀）、Human AI 搜查（暖橙）都不同色。
//
// 修复轮 四把「三角形线框盒」换成**真实家具轮廓**：沿家具主体 12 条棱画线，
// 与家具网格共用同一组中心 / 尺寸 / 朝向，只往外扩 `HIDE_PLAYER_TARGET_MARGIN`
// 的一半，避免与家具表面共面导致的深度冲突，同时不遮挡、不涂白家具本体。
export const HIDE_PLAYER_TARGET_COLOR = 0xffffff;
export const HIDE_PLAYER_TARGET_BREATH_MS = 1_400;
export const HIDE_PLAYER_TARGET_OPACITY_MIN = 0.35;
export const HIDE_PLAYER_TARGET_OPACITY_MAX = 1;
// 轮廓相对家具本体每边的外扩量（世界单位）；见上，纯表现常量。
export const HIDE_PLAYER_TARGET_MARGIN = 0.08;
// Q 冷却中：保留描边但压到很暗，明确表示「看得见但不能按」。
export const HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY = 0.14;

export interface HideSearchViewTuning {
  range: number;
  halfAngleDeg: number;
}

/** 玩家当前唯一白色轮廓的公开几何（家具或米堆；不含隐藏占用）。 */
export interface HidePlayerTargetShape {
  centre: Point;
  size: { width: number; depth: number; height: number };
  rotationRad: number;
}

export class HideSearchView {
  private readonly root = new THREE.Group();
  private readonly fan: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly feedback: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  // S7C-2 修复轮 五：AI 正式搜查的专属表现层（独立网格，绝不与玩家 Q 共用）。
  private readonly aiFan: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly aiOutline: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  // Human Q 家具与人工 DP 家具／米堆共用唯一白色轮廓；与 AI 反馈独立。
  // 修复轮 四起它是**家具棱线轮廓**（LineSegments + 12 条边），不再是线框盒网格。
  private readonly playerTarget:
    THREE.LineSegments<THREE.EdgesGeometry, THREE.LineBasicMaterial>;
  // 扇形朝向用的预分配对象：`show()` 每次释放只算一次，不每帧新建。
  private readonly fanTilt = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  private readonly fanYaw = new THREE.Quaternion();
  private readonly yAxis = new THREE.Vector3(0, 1, 0);
  private readonly totalMs = HIDE_SEARCH_FADE_IN_MS + HIDE_SEARCH_HOLD_MS +
    HIDE_SEARCH_FADE_OUT_MS;
  private remainingMs = 0;
  private feedbackRemainingMs = 0;
  private aiDoneRemainingMs = 0;
  private aiInspecting = false;
  private playerTargetBreathMs = 0;
  /** DEV / 测试：当前是否有唯一白色目标及对应操作是否可用。 */
  playerTargetPresent = false;
  playerTargetAvailable = false;
  playerTargetSpotId: string | null = null;
  playerTargetRiceId: string | null = null;
  playerTargetKind: 'NONE' | 'FURNITURE' | 'RICE' = 'NONE';
  /** DEV / 测试用的计数：有效释放次数与家具反馈次数。 */
  releaseCount = 0;
  feedbackCount = 0;
  /** DEV / 测试用的计数：AI 正式搜查的可见反馈次数（开始 / 收尾）。 */
  aiInspectCount = 0;
  aiDoneCount = 0;
  /** DEV / 测试用的计数：玩家白色目标的建立 / 清除次数。 */
  playerTargetSetCount = 0;
  playerTargetClearCount = 0;

  constructor(scene: THREE.Scene, tuning: HideSearchViewTuning = {
    range: GAME_CONFIG.humanSearch.range,
    halfAngleDeg: GAME_CONFIG.humanSearch.halfAngleDeg,
  }) {
    const halfAngleRad = tuning.halfAngleDeg * Math.PI / 180;
    this.fan = new THREE.Mesh(
      new THREE.CircleGeometry(tuning.range, 48, -halfAngleRad, halfAngleRad * 2),
      new THREE.MeshBasicMaterial({ color: HIDE_SEARCH_COLOR, transparent: true,
        opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.fan.quaternion.copy(this.fanTilt);
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

    this.aiFan = new THREE.Mesh(
      new THREE.CircleGeometry(tuning.range, 48, -halfAngleRad, halfAngleRad * 2),
      new THREE.MeshBasicMaterial({ color: HIDE_AI_INSPECT_COLOR, transparent: true,
        opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.aiFan.rotation.x = -Math.PI / 2;
    this.aiFan.position.y = 0.03;
    this.aiFan.renderOrder = 3;
    this.aiFan.raycast = () => {};
    this.aiFan.visible = false;

    this.aiOutline = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: HIDE_AI_INSPECT_COLOR, transparent: true,
        opacity: 0, wireframe: true, depthWrite: false }));
    this.aiOutline.renderOrder = 3;
    this.aiOutline.raycast = () => {};
    this.aiOutline.visible = false;

    // 单位立方体的 12 条棱：与家具网格同构，用真实的中心 / 尺寸 / 朝向缩放即可贴合，
    // 而且只画棱、不涂面，因此保留家具原有材质与贴图（不把整件家具涂白）。
    const unit = new THREE.BoxGeometry(1, 1, 1);
    this.playerTarget = new THREE.LineSegments(new THREE.EdgesGeometry(unit),
      new THREE.LineBasicMaterial({ color: HIDE_PLAYER_TARGET_COLOR, transparent: true,
        opacity: 0, depthWrite: false }));
    unit.dispose();
    this.playerTarget.renderOrder = 4;
    this.playerTarget.raycast = () => {};
    this.playerTarget.visible = false;

    // 修复轮 四：根节点**永远是单位变换**。位移与朝向交给各自的对象自己带，
    // 因为命中反馈 / AI 扇形 / AI 轮廓 / 玩家高亮传进来的都是**世界坐标**；
    // 旧实现把根节点搬到玩家释放点，这些世界坐标被二次平移，白色高亮会整体
    // 偏到地图外（表现就是「DEV 说选中了家具，但屏幕上什么都没有」）。
    this.root.add(this.fan, this.feedback, this.aiFan, this.aiOutline, this.playerTarget);
    scene.add(this.root);
  }

  /** 释放瞬间的扇形：位置与朝向都取自快照，之后不再改变。 */
  show(origin: Point, headingRad: number): void {
    // 世界矩阵 = Ry(朝向) · Rx(-90°)：与旧实现（根节点带 rotation.y、子网格带
    // rotation.x）逐值相同，但只作用在扇形自己身上，不污染同级的其他对象。
    this.fan.position.set(origin.x, 0.035, origin.z);
    this.fanYaw.setFromAxisAngle(this.yAxis, headingRadToMeshRotationY(headingRad));
    this.fan.quaternion.copy(this.fanYaw).multiply(this.fanTilt);
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

  /**
   * S7C-2 修复轮 五：Human AI **正式搜查**期间的持续可见反馈。
   *
   * 玩家需要能一眼看出「Human AI 正在检查这件家具」，而不是只看到它停住并转向。
   * 这里画的是 AI 自己的站位 + 朝向扇形 + 被检查家具的高亮轮廓；它**纯表现**：
   *   - 不参与任何命中判定（判定只在 `HumanHideSearchResolution` 里做）；
   *   - 不触发 Human 玩家 Q 的 12 秒冷却（本方法不碰冷却系统）；
   *   - 也不会泄露远处隐藏者的真实位置或占用状态——AI 每检查任何一件家具都会亮，
   *     亮的永远只是它自己公开的目标家具。
   */
  showAiInspection(origin: Point, headingRad: number,
    centre: Point, size: { width: number; depth: number; height: number },
    rotationRad = 0): void {
    this.aiInspecting = true;
    this.aiFan.visible = true;
    this.aiFan.position.set(origin.x, 0.03, origin.z);
    this.aiFan.rotation.y = headingRadToMeshRotationY(headingRad);
    this.aiFan.material.opacity = HIDE_AI_INSPECT_OPACITY;
    this.aiOutline.visible = true;
    this.aiOutline.scale.set(Math.max(0.05, size.width + 0.06),
      Math.max(0.05, size.height), Math.max(0.05, size.depth + 0.06));
    this.aiOutline.position.set(centre.x, size.height / 2, centre.z);
    this.aiOutline.rotation.y = rotationRad;
    if (this.aiDoneRemainingMs <= 0)
      this.aiOutline.material.opacity = HIDE_AI_INSPECT_OUTLINE_OPACITY;
    this.aiInspectCount++;
  }

  /** 不在正式搜查期间：收起 AI 搜查反馈（不影响玩家 Q 的扇形）。 */
  hideAiInspection(): void {
    if (this.aiInspecting) this.aiInspecting = false;
    this.aiFan.visible = false;
    this.aiFan.material.opacity = 0;
    if (this.aiDoneRemainingMs <= 0) {
      this.aiOutline.visible = false;
      this.aiOutline.material.opacity = 0;
    }
  }

  /** S7C-2 修复轮 五：搜空（或被取消）之后的中性收尾反馈，同样不泄露占用状态。 */
  showAiInspectionDone(centre: Point, size: { width: number; depth: number; height: number },
    rotationRad = 0): void {
    this.aiOutline.scale.set(Math.max(0.05, size.width + 0.06),
      Math.max(0.05, size.height), Math.max(0.05, size.depth + 0.06));
    this.aiOutline.position.set(centre.x, size.height / 2, centre.z);
    this.aiOutline.rotation.y = rotationRad;
    this.aiDoneRemainingMs = HIDE_AI_DONE_MS;
    this.aiOutline.visible = true;
    this.aiOutline.material.opacity = HIDE_AI_DONE_OPACITY;
    this.aiDoneCount++;
  }

  /**
   * Human Q 与人工 DP E 共用的唯一家具交互高亮。
   *
   * 游戏层只在合法家具区域传入公开目标：Human Q 采用搜查目标，人工 DP E
   * 采用 E 仲裁后的视觉指向目标；本表现层不自行选择目标。
   *
   * 三条约束：
   *   - 纯表现，不参与任何命中判定，也不读、不推断、不暴露真实占用；
   *   - `available=false`（例如 Q 在 12 秒冷却中）时描边压到很暗，明确表示「看得见
   *     但不能按」，绝不给玩家「Q 可用」的误导；
   *   - 与 Human AI 的暖橙搜查反馈是两套独立网格与独立控制状态，不会互相覆盖。
   */
  setPlayerTarget(spotId: string, shape: HidePlayerTargetShape, available: boolean): void {
    if (!this.playerTargetPresent) this.playerTargetSetCount++;
    this.playerTargetPresent = true;
    this.playerTargetAvailable = available;
    this.playerTargetSpotId = spotId;
    this.playerTargetRiceId = null;
    this.playerTargetKind = 'FURNITURE';
    // 与家具网格同中心、同朝向、尺寸只外扩 `HIDE_PLAYER_TARGET_MARGIN`：
    // 轮廓贴在家具外缘，而不是家具中心悬浮一个白色圆圈。
    this.playerTarget.scale.set(Math.max(0.05, shape.size.width + HIDE_PLAYER_TARGET_MARGIN),
      Math.max(0.05, shape.size.height + HIDE_PLAYER_TARGET_MARGIN),
      Math.max(0.05, shape.size.depth + HIDE_PLAYER_TARGET_MARGIN));
    this.playerTarget.position.set(shape.centre.x, shape.size.height / 2, shape.centre.z);
    this.playerTarget.rotation.y = shape.rotationRad;
    this.playerTarget.visible = true;
    this.playerTarget.material.opacity = available
      ? this.playerTargetBreathOpacity() : HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY;
  }

  /** DP 娘进食目标：共用唯一白色棱线和呼吸时钟，尺寸随 RiceView 当前主体变化。 */
  setRiceTarget(riceId: string, shape: HidePlayerTargetShape): void {
    if (!this.playerTargetPresent) this.playerTargetSetCount++;
    this.playerTargetPresent = true;
    this.playerTargetAvailable = true;
    this.playerTargetSpotId = null;
    this.playerTargetRiceId = riceId;
    this.playerTargetKind = 'RICE';
    // 米堆远小于家具，按当前宽度相对外扩，避免固定 0.08 把残余米画成大盒子。
    const margin = Math.min(0.04, Math.min(shape.size.width, shape.size.depth) * 0.08);
    this.playerTarget.scale.set(Math.max(0.05, shape.size.width + margin),
      Math.max(0.05, shape.size.height + margin),
      Math.max(0.05, shape.size.depth + margin));
    this.playerTarget.position.set(shape.centre.x, shape.size.height / 2, shape.centre.z);
    this.playerTarget.rotation.y = 0;
    this.playerTarget.visible = true;
    this.playerTarget.material.opacity = this.playerTargetBreathOpacity();
  }

  /** 离开交互区域、切阵营、暂停、地图应用、重开与局终：立即收起玩家高亮。 */
  clearPlayerTarget(): void {
    if (this.playerTargetPresent) this.playerTargetClearCount++;
    this.playerTargetPresent = false;
    this.playerTargetAvailable = false;
    this.playerTargetSpotId = null;
    this.playerTargetRiceId = null;
    this.playerTargetKind = 'NONE';
    this.playerTargetBreathMs = 0;
    this.playerTarget.visible = false;
    this.playerTarget.material.opacity = 0;
  }

  /** 白色呼吸透明度：只用表现层自己的时钟，与任何玩法时间无关。 */
  private playerTargetBreathOpacity(): number {
    const phase = (this.playerTargetBreathMs % HIDE_PLAYER_TARGET_BREATH_MS) /
      HIDE_PLAYER_TARGET_BREATH_MS;
    const wave = (1 - Math.cos(phase * Math.PI * 2)) / 2;
    return HIDE_PLAYER_TARGET_OPACITY_MIN +
      (HIDE_PLAYER_TARGET_OPACITY_MAX - HIDE_PLAYER_TARGET_OPACITY_MIN) * wave;
  }

  get active(): boolean {
    return this.remainingMs > 0 || this.feedbackRemainingMs > 0 ||
      this.aiDoneRemainingMs > 0 || this.aiInspecting || this.playerTargetPresent;
  }

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
    // AI 搜查反馈：持续高亮不是计时器驱动（由每帧的正式搜查状态驱动），只有
    // 「收尾脉冲」是定时的。
    if (this.aiDoneRemainingMs > 0) {
      this.aiDoneRemainingMs = Math.max(0, this.aiDoneRemainingMs - elapsed);
      this.aiOutline.material.opacity = this.aiInspecting
        ? HIDE_AI_INSPECT_OUTLINE_OPACITY
        : HIDE_AI_DONE_OPACITY * (this.aiDoneRemainingMs / HIDE_AI_DONE_MS);
      if (this.aiDoneRemainingMs === 0 && !this.aiInspecting) {
        this.aiOutline.visible = false;
        this.aiOutline.material.opacity = 0;
      }
    }
    // 玩家唯一白色目标：呼吸只由表现层时钟驱动。Human Q 冷却中保持暗色不呼吸，
    // 让「可交互」与「冷却中」一眼可分。
    if (this.playerTargetPresent) {
      this.playerTargetBreathMs += elapsed;
      this.playerTarget.material.opacity = this.playerTargetAvailable
        ? this.playerTargetBreathOpacity() : HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY;
    }
  }

  /** 暂停、结算、切换阵营、重开与地图应用：立即清掉特效，不留下残留状态。 */
  reset(): void {
    this.remainingMs = 0;
    this.feedbackRemainingMs = 0;
    this.aiDoneRemainingMs = 0;
    this.aiInspecting = false;
    this.fan.visible = false;
    this.fan.material.opacity = 0;
    this.feedback.visible = false;
    this.feedback.material.opacity = 0;
    this.aiFan.visible = false;
    this.aiFan.material.opacity = 0;
    this.aiOutline.visible = false;
    this.aiOutline.material.opacity = 0;
    this.playerTargetBreathMs = 0;
    this.playerTargetPresent = false;
    this.playerTargetAvailable = false;
    this.playerTargetSpotId = null;
    this.playerTargetRiceId = null;
    this.playerTargetKind = 'NONE';
    this.playerTarget.visible = false;
    this.playerTarget.material.opacity = 0;
  }

  dispose(): void {
    this.reset();
    this.root.removeFromParent();
    this.fan.geometry.dispose();
    this.fan.material.dispose();
    this.feedback.geometry.dispose();
    this.feedback.material.dispose();
    this.aiFan.geometry.dispose();
    this.aiFan.material.dispose();
    this.aiOutline.geometry.dispose();
    this.aiOutline.material.dispose();
    this.playerTarget.geometry.dispose();
    this.playerTarget.material.dispose();
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
