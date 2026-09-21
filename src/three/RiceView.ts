import * as THREE from 'three';
import type { RiceState } from '../systems/RiceSystem';

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
  private readonly baseWidth: number;
  private readonly config: RiceVisualConfig;

  constructor(baseWidth: number, color: number, config: RiceVisualConfig) {
    this.baseWidth = baseWidth;
    this.config = config;

    this.body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    );
    this.bulge = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(1.06), roughness: 1 }),
    );
    this.body.castShadow = this.body.receiveShadow = true;
    this.bulge.castShadow = this.bulge.receiveShadow = true;
    this.object.add(this.body, this.bulge);
  }

  get position(): THREE.Vector3 {
    return this.object.position;
  }

  sync(state: RiceState): RiceVisualMetrics {
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
    return metrics;
  }

  dispose(): void {
    for (const child of [this.body, this.bulge]) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
}
