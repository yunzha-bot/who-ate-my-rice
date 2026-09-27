import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { HeardSound } from '../systems/PerceptionSystem.ts';
import type { Point } from './map/apartmentMap.ts';

export type SoundDistanceBand = 'FAR' | 'MID' | 'NEAR';

const COLORS: Record<SoundDistanceBand, number> = {
  FAR: GAME_CONFIG.perception.soundVisual.colors.far,
  MID: GAME_CONFIG.perception.soundVisual.colors.mid,
  NEAR: GAME_CONFIG.perception.soundVisual.colors.near,
};

/** Purely visual layout: near/mid/far waves occupy inner/middle/outer thirds. */
export const SOUND_WAVE_LAYOUT = {
  bandCount: 3,
  edgePadding: 0.2,
  ringThickness: 0.16,
  travelDurationMs: 760,
  segments: 28,
  angleStart: -Math.PI / 5,
  angleLength: Math.PI * 2 / 5,
} as const;

const SOUND_BAND_ORDER: readonly SoundDistanceBand[] = ['NEAR', 'MID', 'FAR'];

export function soundWaveBandRadii(band: SoundDistanceBand, totalRadius: number): {
  inner: number;
  outer: number;
} {
  const bandIndex = SOUND_BAND_ORDER.indexOf(band);
  const bandStart = totalRadius * bandIndex / SOUND_WAVE_LAYOUT.bandCount;
  const bandEnd = totalRadius * (bandIndex + 1) / SOUND_WAVE_LAYOUT.bandCount;
  const halfThickness = SOUND_WAVE_LAYOUT.ringThickness / 2;
  const padding = Math.min(SOUND_WAVE_LAYOUT.edgePadding,
    Math.max(0, (bandEnd - bandStart - SOUND_WAVE_LAYOUT.ringThickness) / 2));
  return {
    inner: bandStart + padding + halfThickness,
    outer: bandEnd - padding - halfThickness,
  };
}

function updateWaveRingRadius(geometry: THREE.BufferGeometry, centerRadius: number): void {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const halfThickness = SOUND_WAVE_LAYOUT.ringThickness / 2;
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const angle = Math.atan2(y, x);
    // RingGeometry stores the complete inner-radius row before the outer row.
    const isInnerEdge = index < SOUND_WAVE_LAYOUT.segments + 1;
    const radius = centerRadius + (isInnerEdge ? -halfThickness : halfThickness);
    positions.setXY(index, Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  positions.needsUpdate = true;
  geometry.computeBoundingSphere();
}

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
  private readonly waveMeshes: THREE.Mesh[] = [];
  private readonly visualRadius: number;
  private readonly showDebugRings: boolean;
  currentBand: SoundDistanceBand | null = null;
  private readonly surfaces: THREE.Mesh[] = [];
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene, showDebugRings = false) {
    this.scene = scene;
    this.showDebugRings = showDebugRings;
    const { radius, nearMax, midMax } = GAME_CONFIG.perception.soundVisual;
    this.visualRadius = radius;
    const surface = (inner: number, outer: number, opacity: number, y: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 72),
        new THREE.MeshBasicMaterial({ color: 0xb5d8e5, transparent: true,
          opacity, depthWrite: false, side: THREE.DoubleSide }));
      mesh.visible = this.showDebugRings;
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
    for (let index = 0; index < SOUND_WAVE_LAYOUT.bandCount; index++) {
      const material = new THREE.MeshBasicMaterial({ color: COLORS.FAR,
        transparent: true, opacity: 0, depthWrite: false, depthTest: false,
        side: THREE.DoubleSide });
      const geometry = new THREE.RingGeometry(0.85, 1, SOUND_WAVE_LAYOUT.segments, 1,
        SOUND_WAVE_LAYOUT.angleStart, SOUND_WAVE_LAYOUT.angleLength);
      const arc = new THREE.Mesh(geometry, material);
      arc.rotation.x = -Math.PI / 2;
      arc.position.y = index * 0.012;
      arc.renderOrder = 20 + index;
      this.waveGroup.add(arc);
      this.waveMeshes.push(arc);
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
    const bandRadii = soundWaveBandRadii(this.currentBand, this.visualRadius);
    const elapsedMs = Math.max(0, nowMs - heard.event.timestamp);
    const fade = Math.min(1,
      heard.remainingMs / GAME_CONFIG.perception.soundVisual.waveFadeMs);
    const intensity = Math.min(1,
      heard.audibleStrength / GAME_CONFIG.perception.soundVisual.waveFullStrength);
    this.waveMeshes.forEach((mesh, index) => {
      const progress = ((elapsedMs / SOUND_WAVE_LAYOUT.travelDurationMs +
        index / this.waveMeshes.length) % 1);
      const centerRadius = bandRadii.inner +
        (bandRadii.outer - bandRadii.inner) * progress;
      updateWaveRingRadius(mesh.geometry, centerRadius);
      const material = this.waveMaterials[index];
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
