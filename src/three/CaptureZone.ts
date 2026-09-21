import * as THREE from 'three';

export const CAPTURE_ZONE_COLORS = {
  safe: 0x43bff5,
  warning: 0xf1cf4a,
  capture: 0xe9564a,
} as const;

export function isInsideCaptureZoneXZ(
  human: Pick<THREE.Vector3, 'x' | 'z'>,
  deepseek: Pick<THREE.Vector3, 'x' | 'z'>,
  radius: number,
): boolean {
  return Math.hypot(deepseek.x - human.x, deepseek.z - human.z) <= radius;
}

export function isCaptureEligibleXZ(
  human: Pick<THREE.Vector3, 'x' | 'z'>,
  deepseek: Pick<THREE.Vector3, 'x' | 'z'>,
  radius: number,
  blocked: boolean,
): boolean {
  return !blocked && isInsideCaptureZoneXZ(human, deepseek, radius);
}

export class CaptureZoneView {
  readonly mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly safeColor = new THREE.Color(CAPTURE_ZONE_COLORS.safe);
  private readonly warningColor = new THREE.Color(CAPTURE_ZONE_COLORS.warning);
  private readonly captureColor = new THREE.Color(CAPTURE_ZONE_COLORS.capture);
  private readonly workingColor = new THREE.Color();

  constructor(parent: THREE.Object3D, radius: number, actorHeight: number) {
    const thickness = Math.min(0.09, radius * 0.16);
    const geometry = new THREE.RingGeometry(Math.max(0.01, radius - thickness), radius, 64);
    const material = new THREE.MeshBasicMaterial({
      color: CAPTURE_ZONE_COLORS.safe,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = -actorHeight / 2 + 0.015;
    this.mesh.renderOrder = 2;
    this.mesh.raycast = () => {};
    parent.add(this.mesh);
  }

  setProgress(progressMs: number, holdMs: number, eligible: boolean): number {
    const ratio = eligible && holdMs > 0
      ? Math.min(1, Math.max(0, progressMs / holdMs)) : 0;
    if (ratio <= 0.5) {
      this.workingColor.lerpColors(this.safeColor, this.warningColor, ratio * 2);
    } else {
      this.workingColor.lerpColors(this.warningColor, this.captureColor, (ratio - 0.5) * 2);
    }
    this.mesh.material.color.copy(this.workingColor);
    this.mesh.material.opacity = 0.48 + ratio * 0.28;
    return ratio;
  }

  reset(): void {
    this.setProgress(0, 1, false);
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
