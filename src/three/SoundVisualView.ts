import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { HeardSound } from '../systems/PerceptionSystem.ts';
import type { Point } from './map/apartmentMap.ts';

export type SoundDistanceBand = 'FAR' | 'MID' | 'NEAR';

const COLORS: Record<SoundDistanceBand, number> = {
  FAR: 0x54aaff,
  MID: 0xffd45f,
  NEAR: 0xff635b,
};

export function soundDistanceBand(distance: number,
  previous: SoundDistanceBand | null = null): SoundDistanceBand {
  const { nearMax, midMax, bandHysteresis } = GAME_CONFIG.perception.soundVisual;
  if (previous === 'NEAR' && distance <= nearMax + bandHysteresis) return 'NEAR';
  if (previous === 'FAR' && distance >= midMax - bandHysteresis) return 'FAR';
  if (previous === 'MID' && distance >= nearMax - bandHysteresis &&
      distance <= midMax + bandHysteresis) return 'MID';
  return distance <= nearMax ? 'NEAR' : distance <= midMax ? 'MID' : 'FAR';
}

// A local +X arc is rotated onto the XZ bearing from listener to sound source.
export function soundWorldAngle(listener: Point, source: Point): number {
  return -Math.atan2(source.z - listener.z, source.x - listener.x);
}

export class SoundVisualView {
  readonly object = new THREE.Group();
  readonly waveGroup = new THREE.Group();
  readonly rangeRing: THREE.Mesh;
  readonly waveMaterials: THREE.MeshBasicMaterial[] = [];
  currentBand: SoundDistanceBand | null = null;
  private readonly surfaces: THREE.Mesh[] = [];
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const { radius, nearMax, midMax } = GAME_CONFIG.perception.soundVisual;
    const surface = (inner: number, outer: number, opacity: number, y: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 72),
        new THREE.MeshBasicMaterial({ color: 0xb5d8e5, transparent: true,
          opacity, depthWrite: false, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y;
      this.object.add(mesh);
      this.surfaces.push(mesh);
      return mesh;
    };
    surface(0, radius, 0.055, 0.018);
    surface(nearMax - 0.075, nearMax, 0.58, 0.04);
    surface(midMax - 0.07, midMax, 0.36, 0.045);
    this.rangeRing = surface(radius - 0.16, radius, 0.75, 0.05);

    this.waveGroup.position.y = 0.12;
    for (let index = 0; index < 3; index++) {
      const material = new THREE.MeshBasicMaterial({ color: COLORS.FAR,
        transparent: true, opacity: 0, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide });
      const inner = 0.85 + index * 0.35;
      const arc = new THREE.Mesh(new THREE.RingGeometry(inner, inner + 0.16, 28, 1,
        -Math.PI / 5, Math.PI * 2 / 5), material);
      arc.rotation.x = -Math.PI / 2;
      arc.position.y = index * 0.012;
      arc.renderOrder = 10;
      this.waveGroup.add(arc);
      this.waveMaterials.push(material);
      this.surfaces.push(arc);
    }
    this.object.add(this.waveGroup);
    this.object.visible = false;
    this.scene.add(this.object);
  }

  update(listener: Point | null, heard: HeardSound | null, active: boolean,
    nowMs: number): void {
    this.object.visible = active && listener !== null;
    if (!this.object.visible || !listener) {
      this.waveGroup.visible = false;
      this.currentBand = null;
      return;
    }
    this.object.position.set(listener.x, 0, listener.z);
    this.waveGroup.visible = heard !== null;
    if (!heard) {
      this.currentBand = null;
      return;
    }
    const source = heard.event.position;
    const distance = Math.hypot(source.x - listener.x, source.z - listener.z);
    this.currentBand = soundDistanceBand(distance, this.currentBand);
    this.waveGroup.rotation.y = soundWorldAngle(listener, source);
    this.waveGroup.scale.setScalar(1 + Math.sin(nowMs * 0.014) * 0.045);
    const intensity = Math.min(1, heard.audibleStrength / 0.45);
    const fade = Math.min(1, heard.remainingMs / 420);
    this.waveMaterials.forEach((material, index) => {
      material.color.setHex(COLORS[this.currentBand!]);
      material.opacity = (0.9 - index * 0.12) * (0.42 + intensity * 0.58) * fade;
    });
  }

  dispose(): void {
    this.scene.remove(this.object);
    for (const mesh of this.surfaces) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
}
