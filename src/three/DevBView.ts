import * as THREE from 'three';
import type { Point } from './map/apartmentMap';

// DEV-B scene visualization.
//
// Every object here is created once and only re-scaled / re-filled afterwards:
// no per-frame geometry churn. The rings and paths draw the values the gameplay
// systems really use (effective capture radius, effective vision range, the real
// A* paths and the real sound events), so the picture cannot disagree with the
// judgement it documents.

export interface DevBViewOptions {
  captureRing: boolean;
  visionCircle: boolean;
  lineOfSight: boolean;
  paths: boolean;
  sounds: boolean;
  /** S7C-2：Human AI 的公开线索 / 推断 / 怀疑家具标记。 */
  clues: boolean;
}

export const DEV_B_DEFAULT_OPTIONS: DevBViewOptions = {
  captureRing: true, visionCircle: false, lineOfSight: true, paths: true, sounds: true,
  clues: true,
};

export const DEV_B_COLORS = {
  capture: 0xff4545,
  vision: 0x54aaff,
  visible: 0x9dff7a,
  blocked: 0xff8a5c,
  outOfRange: 0x8fa4b3,
  humanPath: 0x7ad7ff,
  deepseekPath: 0xffd45f,
  humanTarget: 0xffffff,
  deepseekTarget: 0xff8bf3,
  sound: 0xffa3d1,
  soundHeard: 0xffe066,
  // S7C-2：绿 = AI 已知（它亲自看到的米痕线索）；青 = AI 推断（方向与锚点）；
  // 洋红 = AI 推断出的怀疑家具。三者都不是隐藏者的真实位置。
  clue: 0x7dff8f,
  inference: 0x4ff0e0,
  suspect: 0xff5fd0,
} as const;

export interface DevBSoundVisual {
  type: string;
  x: number;
  z: number;
  range: number;
  heard: boolean;
}

export interface DevBViewFrame {
  captureRadius: number;
  visionRange: number;
  human: Point;
  deepseek: Point;
  vision: { status: string; visible: boolean };
  humanTarget: Point | null;
  deepseekTarget: Point | null;
  humanPath: readonly Point[];
  deepseekPath: readonly Point[];
  sounds: readonly DevBSoundVisual[];
  /** S7C-2：AI 已知的米痕线索点（公开）。 */
  clues: readonly Point[];
  /** S7C-2：AI 推断的调查锚点与方向（公开推断）。 */
  inferenceAnchor: Point | null;
  inferenceDirection: Point | null;
  /** S7C-2：AI 推断出的怀疑家具中心（公开排序结果）。 */
  suspects: readonly Point[];
}

export const DEV_B_MAX_PATH_POINTS = 256;
export const DEV_B_MAX_SOUND_MARKERS = 24;
export const DEV_B_MAX_CLUE_MARKERS = 24;
export const DEV_B_MAX_SUSPECT_MARKERS = 8;
export const DEV_B_RING_SEGMENTS = 64;

/** Unit-circle outline used by every ring; scaling a shared shape is enough. */
export function devBRingGeometry(segments: number = DEV_B_RING_SEGMENTS): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index++) {
    const angle = index / segments * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function devBPathPoints(path: readonly Point[], y = 0.12): THREE.Vector3[] {
  return path.slice(0, DEV_B_MAX_PATH_POINTS).map(point => new THREE.Vector3(point.x, y, point.z));
}

export class DevBView {
  readonly group = new THREE.Group();
  options: DevBViewOptions = { ...DEV_B_DEFAULT_OPTIONS };
  private readonly ringGeometry = devBRingGeometry();
  private readonly captureMesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly visionRing: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly sightLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly paths: Record<'human' | 'deepseek',
    THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>>;
  private readonly targets: Record<'human' | 'deepseek',
    THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>>;
  private readonly soundMarkers: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  private readonly clueMarkers: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  private readonly suspectMarkers: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>[] = [];
  private readonly inferenceLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly inferenceAnchorMarker: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;

  constructor(scene: THREE.Object3D) {
    this.group.name = 'dev-b-visualization';
    this.captureMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.93, 1, DEV_B_RING_SEGMENTS),
      new THREE.MeshBasicMaterial({ color: DEV_B_COLORS.capture, transparent: true,
        opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    this.captureMesh.rotation.x = -Math.PI / 2;
    this.captureMesh.position.y = 0.02;
    this.captureMesh.raycast = () => {};

    this.visionRing = this.outline(DEV_B_COLORS.vision, 0.9);
    this.sightLine = this.segment(DEV_B_COLORS.visible);
    this.paths = { human: this.polyline(DEV_B_COLORS.humanPath),
      deepseek: this.polyline(DEV_B_COLORS.deepseekPath) };
    this.targets = { human: this.outline(DEV_B_COLORS.humanTarget, 0.9),
      deepseek: this.outline(DEV_B_COLORS.deepseekTarget, 0.9) };
    // S7C-2 的标记必须排在声音标记之前：既有测试用「最后 N 个子对象」定位声音标记。
    for (let index = 0; index < DEV_B_MAX_CLUE_MARKERS; index++)
      this.clueMarkers.push(this.outline(DEV_B_COLORS.clue, 0.7));
    for (let index = 0; index < DEV_B_MAX_SUSPECT_MARKERS; index++)
      this.suspectMarkers.push(this.outline(DEV_B_COLORS.suspect, 0.95));
    this.inferenceLine = this.segment(DEV_B_COLORS.inference);
    this.inferenceAnchorMarker = this.outline(DEV_B_COLORS.inference, 0.95);
    for (let index = 0; index < DEV_B_MAX_SOUND_MARKERS; index++)
      this.soundMarkers.push(this.outline(DEV_B_COLORS.sound, 0.85));
    this.group.add(this.captureMesh, this.visionRing, this.sightLine,
      this.paths.human, this.paths.deepseek, this.targets.human, this.targets.deepseek,
      ...this.clueMarkers, ...this.suspectMarkers, this.inferenceLine,
      this.inferenceAnchorMarker, ...this.soundMarkers);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Number of persistent draw objects; used by tests to prove reuse. */
  get objectCount(): number { return this.group.children.length; }

  setOptions(options: Partial<DevBViewOptions>): void {
    this.options = { ...this.options, ...options };
  }

  update(frame: DevBViewFrame): void {
    this.captureMesh.visible = this.options.captureRing;
    if (this.options.captureRing) {
      this.captureMesh.scale.set(frame.captureRadius, 1, frame.captureRadius);
      this.captureMesh.position.set(frame.human.x, 0.02, frame.human.z);
    }
    this.visionRing.visible = this.options.visionCircle;
    if (this.options.visionCircle) {
      this.visionRing.scale.set(frame.visionRange, 1, frame.visionRange);
      this.visionRing.position.set(frame.deepseek.x, 0.03, frame.deepseek.z);
    }
    this.sightLine.visible = this.options.lineOfSight;
    if (this.options.lineOfSight) {
      const color = frame.vision.status === 'VISIBLE' ? DEV_B_COLORS.visible
        : frame.vision.status === 'BLOCKED' ? DEV_B_COLORS.blocked : DEV_B_COLORS.outOfRange;
      this.sightLine.material.color.setHex(color);
      const attribute = this.sightLine.geometry.getAttribute('position') as THREE.BufferAttribute;
      attribute.setXYZ(0, frame.human.x, 0.06, frame.human.z);
      attribute.setXYZ(1, frame.deepseek.x, 0.06, frame.deepseek.z);
      attribute.needsUpdate = true;
      this.sightLine.geometry.computeBoundingSphere();
    }
    this.updatePath('human', frame.humanPath, frame.humanTarget, this.options.paths);
    this.updatePath('deepseek', frame.deepseekPath, frame.deepseekTarget, this.options.paths);
    const markers = this.options.sounds ? frame.sounds.slice(0, DEV_B_MAX_SOUND_MARKERS) : [];
    this.soundMarkers.forEach((marker, index) => {
      const sound = markers[index];
      marker.visible = !!sound;
      if (!sound) return;
      marker.material.color.setHex(sound.heard ? DEV_B_COLORS.soundHeard : DEV_B_COLORS.sound);
      marker.scale.set(sound.range, 1, sound.range);
      marker.position.set(sound.x, 0.05, sound.z);
    });
    // S7C-2：AI 已知线索（绿）与 AI 推断（青 / 洋红）。三者都只画公开信息。
    const clues = this.options.clues ? frame.clues.slice(0, DEV_B_MAX_CLUE_MARKERS) : [];
    this.clueMarkers.forEach((marker, index) => {
      const clue = clues[index];
      marker.visible = !!clue;
      if (!clue) return;
      marker.scale.set(0.14, 1, 0.14);
      marker.position.set(clue.x, 0.045, clue.z);
    });
    const suspects = this.options.clues
      ? frame.suspects.slice(0, DEV_B_MAX_SUSPECT_MARKERS) : [];
    this.suspectMarkers.forEach((marker, index) => {
      const suspect = suspects[index];
      marker.visible = !!suspect;
      if (!suspect) return;
      marker.scale.set(index === 0 ? 0.75 : 0.55, 1, index === 0 ? 0.75 : 0.55);
      marker.position.set(suspect.x, 0.07, suspect.z);
    });
    const anchor = this.options.clues ? frame.inferenceAnchor : null;
    this.inferenceAnchorMarker.visible = !!anchor;
    if (anchor) {
      this.inferenceAnchorMarker.scale.set(0.3, 1, 0.3);
      this.inferenceAnchorMarker.position.set(anchor.x, 0.075, anchor.z);
    }
    const direction = frame.inferenceDirection;
    const drawArrow = this.options.clues && !!anchor && !!direction;
    this.inferenceLine.visible = drawArrow;
    if (drawArrow && anchor && direction) {
      const length = 2;
      const attribute = this.inferenceLine.geometry
        .getAttribute('position') as THREE.BufferAttribute;
      attribute.setXYZ(0, anchor.x, 0.075, anchor.z);
      attribute.setXYZ(1, anchor.x + direction.x * length, 0.075,
        anchor.z + direction.z * length);
      attribute.needsUpdate = true;
      this.inferenceLine.geometry.computeBoundingSphere();
    }
    this.group.visible = this.options.captureRing || this.options.visionCircle ||
      this.options.lineOfSight || this.options.paths || this.options.sounds ||
      this.options.clues;
  }

  private updatePath(which: 'human' | 'deepseek', path: readonly Point[],
    target: Point | null, visible: boolean): void {
    const line = this.paths[which];
    line.visible = visible;
    if (visible) {
      const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const points = devBPathPoints(path);
      attribute.setXYZ(0, 0, 0, 0);
      attribute.setXYZ(1, 0, 0, 0);
      for (let index = 0; index < points.length; index++)
        attribute.setXYZ(index, points[index].x, points[index].y, points[index].z);
      attribute.needsUpdate = true;
      line.geometry.setDrawRange(0, points.length < 2 ? 0 : points.length);
      line.geometry.computeBoundingSphere();
    } else {
      line.geometry.setDrawRange(0, 0);
    }
    const marker = this.targets[which];
    marker.visible = visible && !!target;
    if (target) {
      marker.scale.set(0.22, 1, 0.22);
      marker.position.set(target.x, 0.08, target.z);
    }
  }

  private outline(color: number, opacity: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const line = new THREE.Line(this.ringGeometry, new THREE.LineBasicMaterial({
      color, transparent: true, opacity, depthTest: false }));
    line.renderOrder = 30;
    line.raycast = () => {};
    return line;
  }

  private segment(color: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    geometry.setDrawRange(0, 2);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.9, depthTest: false }));
    line.renderOrder = 30;
    line.raycast = () => {};
    return line;
  }

  private polyline(color: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(DEV_B_MAX_PATH_POINTS * 3), 3));
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.85, depthTest: false }));
    line.renderOrder = 30;
    line.raycast = () => {};
    return line;
  }

  dispose(): void {
    this.group.traverse(object => {
      const drawable = object as Partial<THREE.Mesh & THREE.Line>;
      if (drawable.geometry && drawable.geometry !== this.ringGeometry)
        drawable.geometry.dispose();
      const material = drawable.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach(entry => entry.dispose());
      else material?.dispose();
    });
    this.ringGeometry.dispose();
    this.captureMesh.geometry.dispose();
    this.group.removeFromParent();
    this.group.clear();
  }
}
