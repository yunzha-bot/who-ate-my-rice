import * as THREE from 'three';
import type { ApartmentBuild } from './map/MapBuilder.ts';

export interface SceneEditorViewOptions {
  camera: THREE.OrthographicCamera;
  dom: HTMLElement;
  onSelect: (id: string | null) => void;
  onPreview: (id: string, x: number, z: number) => void;
  onCommit: (id: string) => void;
  onZoom: (direction: number) => void;
  onPan: (deltaX: number, deltaY: number) => void;
}

export interface SceneEditorTargetPosition {
  x: number;
  y: number;
  z: number;
}

// Three.js side of the DEV scene editor: real scene objects, a real Raycaster,
// a drag preview that only writes into the draft, and DEV-only anchor gizmos
// (ground ring + centre dot + vertical post) so occluded anchors stay findable.
export class SceneEditorView {
  private readonly camera: THREE.OrthographicCamera;
  private readonly dom: HTMLElement;
  private readonly options: SceneEditorViewOptions;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly planeHit = new THREE.Vector3();
  private readonly normal = new THREE.Vector3(0, 1, 0);
  private build: ApartmentBuild | null = null;
  private highlight: THREE.BoxHelper | null = null;
  private selected: string | null = null;
  private active = false;
  private anchorsVisible = true;
  private dragging: { id: string; grabX: number; grabZ: number; pointerId: number } | null = null;
  private panning: { x: number; y: number } | null = null;
  private previewValid: boolean | null = null;

  constructor(options: SceneEditorViewOptions) {
    this.options = options;
    this.camera = options.camera;
    this.dom = options.dom;
    this.dom.addEventListener('pointerdown', this.onPointerDown);
    this.dom.addEventListener('pointermove', this.onPointerMove);
    this.dom.addEventListener('pointerup', this.onPointerUp);
    this.dom.addEventListener('pointercancel', this.onPointerUp);
    this.dom.addEventListener('wheel', this.onWheel, { passive: false });
    this.dom.addEventListener('contextmenu', this.onContextMenu);
  }

  get isActive(): boolean { return this.active; }

  setBuild(build: ApartmentBuild): void {
    this.clearHighlight();
    this.build = build;
    this.build.anchorGizmoRoot.visible = this.active && this.anchorsVisible;
    this.applySelectionView();
  }

  setActive(active: boolean): void {
    this.active = active;
    this.dragging = null;
    this.panning = null;
    this.dom.style.cursor = active ? 'crosshair' : '';
    if (this.build) this.build.anchorGizmoRoot.visible = active && this.anchorsVisible;
    this.applySelectionView();
    if (!active) this.clearHighlight();
  }

  setAnchorsVisible(visible: boolean): void {
    this.anchorsVisible = visible;
    if (this.build) this.build.anchorGizmoRoot.visible = this.active && visible;
  }

  get anchorsAreVisible(): boolean { return this.anchorsVisible; }

  select(id: string | null): void {
    this.selected = id;
    this.applySelectionView();
  }

  // DEV-only preview tint: yellow while the draft is still legal, red as soon
  // as it would be rejected. The preview is never treated as saved map data.
  setPreviewValidity(valid: boolean | null): void {
    this.previewValid = valid;
    if (this.highlight) {
      const color = valid === false ? 0xff6b6b : valid === true ? 0x8fe3a4 : 0xffe08a;
      this.highlight.material.color.setHex(color);
    }
    const group = this.selected ? this.build?.anchorGizmos.get(this.selected) : null;
    if (group) {
      const ring = group.userData.ring as THREE.Mesh | undefined;
      const material = ring?.material as THREE.MeshBasicMaterial | undefined;
      material?.color.setHex(valid === false ? 0xff6b6b : valid === true ? 0x8fe3a4 : 0xffd166);
    }
  }

  targetPosition(id: string): SceneEditorTargetPosition | null {
    const object = this.objectOf(id);
    if (!object) return null;
    return { x: object.position.x, y: object.position.y, z: object.position.z };
  }

  // Live draft preview while dragging: the committed map is untouched, only the
  // visual mesh and the draft values move.
  previewPosition(id: string, x: number, z: number): void {
    const object = this.objectOf(id);
    if (!object) return;
    object.position.x = x;
    object.position.z = z;
    this.refreshHighlight();
  }

  dispose(): void {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
    this.dom.removeEventListener('wheel', this.onWheel);
    this.dom.removeEventListener('contextmenu', this.onContextMenu);
    this.clearHighlight();
    this.build = null;
  }

  private objectOf(id: string): THREE.Object3D | null {
    if (!this.build) return null;
    return this.build.furnitureMeshes.get(id) ?? this.build.anchorGizmos.get(id) ?? null;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (!this.active || !this.build) return;
    if (event.button === 1 || event.button === 2) {
      this.panning = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.button !== 0) return;
    const id = this.hitTest(event);
    this.options.onSelect(id);
    if (!id) return;
    const object = this.objectOf(id);
    if (!object) return;
    const point = this.pointerOnPlane(event, object.position.y);
    if (!point) return;
    this.dragging = { id, grabX: point.x - object.position.x,
      grabZ: point.z - object.position.z, pointerId: event.pointerId };
    this.dom.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.active) return;
    if (this.panning) {
      this.options.onPan(event.clientX - this.panning.x, event.clientY - this.panning.y);
      this.panning = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!this.dragging) return;
    const object = this.objectOf(this.dragging.id);
    if (!object) return;
    const point = this.pointerOnPlane(event, object.position.y);
    if (!point) return;
    this.options.onPreview(this.dragging.id,
      point.x - this.dragging.grabX, point.z - this.dragging.grabZ);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.dragging) {
      const id = this.dragging.id;
      this.dragging = null;
      this.dom.releasePointerCapture?.(event.pointerId);
      this.setPreviewValidity(null);
      this.options.onCommit(id);
    }
    this.panning = null;
  };

  private onWheel = (event: WheelEvent): void => {
    if (!this.active) return;
    event.preventDefault();
    this.options.onZoom(event.deltaY > 0 ? 1 : -1);
  };

  private onContextMenu = (event: MouseEvent): void => {
    if (this.active) event.preventDefault();
  };

  private hitTest(event: PointerEvent): string | null {
    if (!this.build) return null;
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.anchorsVisible && this.build.anchorGizmoRoot.visible) {
      const anchors = [...this.build.anchorGizmos.values()];
      const anchorHit = this.raycaster.intersectObjects(anchors, true)[0];
      if (anchorHit) {
        const id = this.walkToObjectId(anchorHit.object);
        if (id) return id;
      }
    }
    const furniture = [...this.build.furnitureMeshes.values()];
    const furnitureHit = this.raycaster.intersectObjects(furniture, false)[0];
    return furnitureHit ? this.walkToObjectId(furnitureHit.object) : null;
  }

  private walkToObjectId(object: THREE.Object3D | null): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const id = current.userData?.objectId;
      if (typeof id === 'string') return id;
      current = current.parent;
    }
    return null;
  }

  private pointerOnPlane(event: PointerEvent, y: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
      -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.groundPlane.set(this.normal, -y);
    return this.raycaster.ray.intersectPlane(this.groundPlane, this.planeHit);
  }

  private applySelectionView(): void {
    if (!this.build) return;
    for (const [id, group] of this.build.anchorGizmos) {
      const isSelected = id === this.selected;
      const ring = group.userData.ring as THREE.Mesh | undefined;
      const post = group.userData.post as THREE.Mesh | undefined;
      if (ring) ring.scale.setScalar(isSelected ? 1.35 : 1);
      if (post) {
        post.scale.y = isSelected ? 1.25 : 1;
        post.position.y = isSelected ? 0.81 : 0.65;
      }
    }
    if (!this.selected) { this.clearHighlight(); return; }
    const mesh = this.build.furnitureMeshes.get(this.selected);
    if (!mesh) { this.clearHighlight(); return; }
    if (!this.highlight) {
      this.highlight = new THREE.BoxHelper(mesh, 0xffe08a);
      this.build.root.add(this.highlight);
    }
    this.highlight.setFromObject(mesh);
  }

  private refreshHighlight(): void {
    if (this.highlight && this.selected) {
      const mesh = this.build?.furnitureMeshes.get(this.selected);
      if (mesh) this.highlight.setFromObject(mesh);
    }
  }

  private clearHighlight(): void {
    if (!this.highlight) return;
    this.highlight.removeFromParent();
    this.highlight.geometry.dispose();
    (this.highlight.material as THREE.Material).dispose();
    this.highlight = null;
  }
}
