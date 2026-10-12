import * as THREE from 'three';
import type { RiceState } from '../systems/RiceSystem';
import { disposeRiceBagModel, loadRiceBagModel } from './RiceBagModel.ts';
import { applyInteriorSunShadow, isCoveredInterior } from './InteriorShadowView.ts';

export interface RiceVisualMetrics {
  progressRatio: number;
  remainingRatio: number;
  bodyHeight: number;
  bulgeHeight: number;
  widthScale: number;
  stage: 0 | 1 | 2 | 3 | 4;
}

export interface RiceVisualConfig {
  fullHeight: number;
  emptyHeight: number;
  fullBulgeHeight: number;
  emptyWidthScale: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function riceVisualMetrics(
  progressMs: number,
  maxProgressMs: number,
  config: RiceVisualConfig,
): RiceVisualMetrics {
  const progressRatio = maxProgressMs <= 0 ? 0 : clamp01(progressMs / maxProgressMs);
  const remainingRatio = 1 - progressRatio;
  const collapse = Math.pow(remainingRatio, 0.82);
  const bodyHeight = config.emptyHeight +
    (config.fullHeight - config.emptyHeight) * collapse;
  const bulgeHeight = config.fullBulgeHeight * Math.pow(remainingRatio, 1.25);
  const widthScale = config.emptyWidthScale +
    (1 - config.emptyWidthScale) * remainingRatio;
  const stage = progressRatio >= 1 ? 4
    : progressRatio >= 0.75 ? 3
    : progressRatio >= 0.5 ? 2
    : progressRatio >= 0.25 ? 1 : 0;
  return { progressRatio, remainingRatio, bodyHeight, bulgeHeight, widthScale, stage };
}

export class RiceView {
  readonly object = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly bulge: THREE.Mesh;
  private readonly grains: THREE.InstancedMesh;
  private readonly clothTexture: THREE.DataTexture;
  private readonly grainTransform = new THREE.Object3D();
  private previousRemaining = -1;
  private model: THREE.Group | null = null;
  private readonly modelSize = new THREE.Vector3();
  private lastState: RiceState | null = null;
  private disposed = false;
  private readonly baseWidth: number;
  private readonly config: RiceVisualConfig;

  constructor(baseWidth: number, color: number, config: RiceVisualConfig) {
    this.baseWidth = baseWidth;
    this.config = config;

    // 小幅织纹由代码生成，不加载图片；开口袋体保留真实内壁和褶皱。
    const pixels = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const value = 224 + ((x % 4 < 2) !== (y % 4 < 2) ? 16 : 0)
        + Math.round(Math.sin(x * 17 + y * 31) * 5);
      const index = (y * 64 + x) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
      pixels[index + 3] = 255;
    }
    this.clothTexture = new THREE.DataTexture(pixels, 64, 64);
    this.clothTexture.wrapS = this.clothTexture.wrapT = THREE.RepeatWrapping;
    this.clothTexture.repeat.set(3, 2);
    this.clothTexture.needsUpdate = true;
    const cloth = new THREE.MeshStandardMaterial({ color: 0xc9ad7d,
      roughness: 1, map: this.clothTexture, side: THREE.DoubleSide });
    const sack = new THREE.CylinderGeometry(.45, .4, 1, 24, 12, true);
    const positions = sack.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i), t = y + .5;
      const angle = Math.atan2(positions.getZ(i), positions.getX(i));
      const radius = .4 + .09 * Math.sin(t * Math.PI) + .045 * t
        + (.012 + .012 * t) * Math.cos(angle * 7 + t * 2);
      positions.setXYZ(i, Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }
    sack.computeVertexNormals();
    this.body = new THREE.Mesh(sack, cloth);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(.45, .045, 6, 24).rotateX(Math.PI / 2), cloth);
    hem.position.y = .46;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .015, 24), cloth);
    bottom.position.y = -.4925;
    this.body.add(hem, bottom);
    this.bulge = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xfff9df), .7), roughness: .8 }),
    );
    this.grains = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xfff8e7, roughness: .92, flatShading: true }), 84);
    this.grains.name = 'rice-grains';
    this.grains.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 84; i++) this.grains.setColorAt(i,
      new THREE.Color(i % 3 === 0 ? 0xf4e8ce : i % 3 === 1 ? 0xfff9eb : 0xfff2d9));
    this.body.castShadow = this.body.receiveShadow = true;
    this.bulge.castShadow = this.bulge.receiveShadow = true;
    for (const mesh of [hem, bottom, this.grains]) mesh.castShadow = mesh.receiveShadow = true;
    this.object.add(this.body, this.bulge, this.grains);
    if (typeof window !== 'undefined') void loadRiceBagModel().then(model => this.useModel(model))
      .catch(error => { if (!this.disposed) console.warn('Rice bag GLB unavailable; retaining procedural bag', error); });
  }

  private useModel(model: THREE.Group): void {
    if (this.disposed) { disposeRiceBagModel(model); return; }
    this.model = model;
    new THREE.Box3().setFromObject(model).getSize(this.modelSize);
    applyInteriorSunShadow(model, isCoveredInterior(this.position.x, this.position.z));
    this.object.add(model);
    if (this.lastState) this.sync(this.lastState);
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  /** 只读表现尺寸，供白色轮廓贴合当前进食进度；不参与吃米判定。 */
  get outlineSize(): { width: number; depth: number; height: number } {
    if (this.model?.visible) return { width: this.modelSize.x * this.model.scale.x,
      depth: this.modelSize.z * this.model.scale.z, height: this.modelSize.y * this.model.scale.y };
    return { width: this.body.scale.x, depth: this.body.scale.z,
      height: this.body.scale.y + (this.bulge.visible ? this.bulge.scale.y / 2 : 0) };
  }

  sync(state: RiceState): RiceVisualMetrics {
    this.lastState = state;
    const metrics = riceVisualMetrics(state.progressMs, state.maxProgressMs, this.config);
    const width = this.baseWidth * metrics.widthScale;
    const depth = this.baseWidth * (0.94 + 0.06 * metrics.remainingRatio);

    // The interaction anchor stays fixed at object.position. Only the top descends;
    // the body's bottom remains at local Y=0 throughout the full-to-empty transition.
    this.body.scale.set(width, metrics.bodyHeight, depth);
    this.body.position.y = metrics.bodyHeight / 2;
    this.bulge.visible = metrics.bulgeHeight > 0.005;
    this.bulge.scale.set(width * 0.92, metrics.bulgeHeight, depth * 0.92);
    this.bulge.position.y = metrics.bodyHeight;
    // 米粒自身不随袋高压扁；只改变堆高/数量，复用一次实例绘制。
    this.grains.visible = this.bulge.visible;
    this.body.visible = true;
    if (this.model) {
      this.model.visible = metrics.remainingRatio > 0;
      if (this.model.visible) {
        // 满袋等比适配原占地；进食只让表现高度下降，锚点与判定不变。
        const scale = this.baseWidth / Math.max(this.modelSize.x, this.modelSize.z)* 1.5;
        const heightRatio = (metrics.bodyHeight + metrics.bulgeHeight / 2)
          / (this.config.fullHeight + this.config.fullBulgeHeight / 2);
        this.model.scale.set(scale * metrics.widthScale, scale * heightRatio,
          scale * (0.94 + 0.06 * metrics.remainingRatio));
        this.body.visible = this.bulge.visible = this.grains.visible = false;
      }
    }
    if (metrics.remainingRatio !== this.previousRemaining) {
      this.previousRemaining = metrics.remainingRatio;
      this.grains.count = Math.ceil(84 * metrics.remainingRatio);
      for (let i = 0; i < this.grains.count; i++) {
        const radial = Math.sqrt((i + .5) / this.grains.count) * .41;
        const angle = i * 2.399963;
        this.grainTransform.position.set(Math.cos(angle) * radial * width,
          metrics.bodyHeight + metrics.bulgeHeight * .5 * Math.sqrt(1 - (radial / .46) ** 2),
          Math.sin(angle) * radial * depth);
        this.grainTransform.rotation.set(Math.sin(i * 4) * .45, angle, Math.cos(i * 3) * .4);
        this.grainTransform.scale.set(width * .095, this.baseWidth * .025, depth * .035);
        this.grainTransform.updateMatrix();
        this.grains.setMatrixAt(i, this.grainTransform.matrix);
      }
      this.grains.instanceMatrix.needsUpdate = true;
      this.grains.computeBoundingSphere();
    }
    return metrics;
  }

  dispose(): void {
    this.disposed = true;
    if (this.model) { disposeRiceBagModel(this.model); this.model = null; }
    const materials = new Set<THREE.Material>();
    this.object.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      materials.add(child.material as THREE.Material);
    });
    this.grains.dispose();
    for (const material of materials) material.dispose();
    this.clothTexture.dispose();
  }
}
