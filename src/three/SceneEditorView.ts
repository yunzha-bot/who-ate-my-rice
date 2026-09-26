import * as THREE from 'three';
import type { ApartmentBuild } from './map/MapBuilder.ts';
import type { HideRegionGeometry, HideRegionPositionCode, HideRegionSample } from './map/HideInteractionRegion.ts';

export interface HideRegionViewPreview {
  geometry: HideRegionGeometry;
  samples: readonly HideRegionSample[] | null;
  sampleStep: number;
}

// Fixed vertex counts so the outline buffer can be rewritten in place while a
// drag is in progress. CIRCLE uses a closed loop; SECTOR is centre + arc + centre.
const REGION_BOUNDARY_SEGMENTS = { CIRCLE: 96, SECTOR: 48 } as const;

const REGION_BOUNDARY_Y = 0.035;

const REGION_SAMPLE_COLORS: Record<HideRegionPositionCode, number> = {
  LEGAL: 0x65d987,
  OUTSIDE_REGION: 0x777777,
  NOT_STANDABLE: 0xff595e,
  SURFACE_BLOCKED: 0xffa552,
  NOT_NAVIGABLE: 0xd879e8,
  NOT_REACHABLE: 0xf0d264,
};

export interface SceneEditorViewOptions {
  camera: THREE.OrthographicCamera;
  dom: HTMLElement;
  onSelect: (id: string | null) => void;
  onPreview: (id: string, x: number, z: number) => void;
  // Fired once when a real drag starts (pointerdown on an object). The editor
  // opens its deferred-validation window here and closes it in onCommit, so a
  // drag never runs the full map validation per frame.
  onDragStart: (id: string) => void;
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
  // Region preview objects are long-lived on purpose: a drag refreshes the
  // outline on every pointermove, so the boundary line and the sample instances
  // are updated in place instead of being disposed and rebuilt each time.
  private regionPreviewRoot: THREE.Group | null = null;
  private regionBoundary: THREE.Line | THREE.LineLoop | null = null;
  private regionBoundaryShape: HideRegionGeometry['region']['shape'] | null = null;
  private regionBoundaryPositions: Float32Array | null = null;
  private readonly regionSampleMeshes = new Map<HideRegionPositionCode, THREE.InstancedMesh>();
  private regionSamplesDrawn = false;

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
    this.clearRegionPreview();
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
    if (!active) {
      this.clearHighlight();
      this.clearRegionPreview();
    }
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

  // Called on every pointermove while dragging (with `samples: null`) and once
  // with the full sampling after release. The boundary line is rewritten in
  // place; sample instances are only rebuilt when their code or count changes.
  setRegionPreview(preview: HideRegionViewPreview | null): void {
    if (!preview || !this.active || !this.build) {
      this.clearRegionPreview();
      return;
    }
    const root = this.ensureRegionPreviewRoot();
    if (!root) return;
    root.name = `hide-region-preview:${preview.geometry.spotId}`;
    root.userData.sampleStep = preview.sampleStep;
    this.updateRegionBoundary(preview.geometry);
    if (preview.samples) this.updateRegionSamples(preview.samples);
    else this.hideRegionSamples();
  }

  private ensureRegionPreviewRoot(): THREE.Group | null {
    if (this.regionPreviewRoot) return this.regionPreviewRoot;
    if (!this.build) return null;
    const root = new THREE.Group();
    root.name = 'hide-region-preview';
    this.build.root.add(root);
    this.regionPreviewRoot = root;
    return root;
  }

  private updateRegionBoundary(geometry: HideRegionGeometry): void {
    const root = this.regionPreviewRoot;
    if (!root) return;
    const shape = geometry.region.shape;
    if (!this.regionBoundary || this.regionBoundaryShape !== shape ||
        !this.regionBoundaryPositions) {
      this.disposeRegionBoundary();
      const built = this.createRegionBoundary(shape);
      root.add(built.object);
      this.regionBoundary = built.object;
      this.regionBoundaryShape = shape;
      this.regionBoundaryPositions = built.positions;
    }
    const positions = this.regionBoundaryPositions;
    const boundary = this.regionBoundary;
    if (!positions || !boundary) return;
    const centre = geometry.centre;
    if (shape === 'CIRCLE') {
      const segments = REGION_BOUNDARY_SEGMENTS.CIRCLE;
      for (let index = 0; index < segments; index++) {
        const angle = Math.PI * 2 * index / segments;
        positions[index * 3] = centre.x + Math.cos(angle) * geometry.radius;
        positions[index * 3 + 1] = REGION_BOUNDARY_Y;
        positions[index * 3 + 2] = centre.z + Math.sin(angle) * geometry.radius;
      }
    } else {
      const segments = REGION_BOUNDARY_SEGMENTS.SECTOR;
      const start = geometry.axisAngle - geometry.halfAngleRad;
      const end = geometry.axisAngle + geometry.halfAngleRad;
      positions[0] = centre.x;
      positions[1] = REGION_BOUNDARY_Y;
      positions[2] = centre.z;
      for (let index = 0; index <= segments; index++) {
        const angle = start + (end - start) * index / segments;
        const offset = (index + 1) * 3;
        positions[offset] = centre.x + Math.cos(angle) * geometry.radius;
        positions[offset + 1] = REGION_BOUNDARY_Y;
        positions[offset + 2] = centre.z + Math.sin(angle) * geometry.radius;
      }
      const closing = (segments + 2) * 3;
      positions[closing] = centre.x;
      positions[closing + 1] = REGION_BOUNDARY_Y;
      positions[closing + 2] = centre.z;
    }
    const attribute = boundary.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.needsUpdate = true;
    // The centre moves during a drag, so the cached bounds have to follow it or
    // the outline can be frustum-culled.
    boundary.geometry.computeBoundingSphere();
  }

  private createRegionBoundary(shape: HideRegionGeometry['region']['shape']):
  { object: THREE.Line | THREE.LineLoop; positions: Float32Array } {
    const count = shape === 'CIRCLE'
      ? REGION_BOUNDARY_SEGMENTS.CIRCLE
      : REGION_BOUNDARY_SEGMENTS.SECTOR + 2;
    const positions = new Float32Array(count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({ color: 0x5cc8ff, transparent: true,
      opacity: 0.95, depthWrite: false });
    const object = shape === 'CIRCLE'
      ? new THREE.LineLoop(geometry, material)
      : new THREE.Line(geometry, material);
    // Kept from the original preview so the DEV legend's "blue line" still
    // identifies exactly the same object.
    object.name = 'continuous-boundary-approximation';
    return { object, positions };
  }

  private updateRegionSamples(samples: readonly HideRegionSample[]): void {
    const root = this.regionPreviewRoot;
    if (!root) return;
    const groups = new Map<HideRegionPositionCode, HideRegionSample[]>();
    for (const sample of samples) {
      const list = groups.get(sample.code) ?? [];
      list.push(sample);
      groups.set(sample.code, list);
    }
    for (const [code, mesh] of this.regionSampleMeshes) {
      if (!groups.has(code)) mesh.visible = false;
    }
    for (const [code, entries] of groups) {
      const existing = this.regionSampleMeshes.get(code) ?? null;
      if (existing && existing.count === entries.length) {
        this.writeSampleMatrices(existing, entries);
        existing.visible = true;
        continue;
      }
      if (existing) {
        existing.removeFromParent();
        existing.geometry.dispose();
        (existing.material as THREE.Material).dispose();
      }
      const mesh = this.createSampleMesh(code, entries);
      root.add(mesh);
      this.regionSampleMeshes.set(code, mesh);
    }
    this.regionSamplesDrawn = true;
  }

  private createSampleMesh(code: HideRegionPositionCode,
    entries: readonly HideRegionSample[]): THREE.InstancedMesh {
    const geometry = new THREE.CircleGeometry(0.045, 8);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: REGION_SAMPLE_COLORS[code],
      transparent: true, opacity: code === 'LEGAL' ? 0.8 : 0.62,
      depthWrite: false, side: THREE.DoubleSide });
    const instances = new THREE.InstancedMesh(geometry, material, entries.length);
    instances.name = `sample-status:${code}`;
    this.writeSampleMatrices(instances, entries);
    return instances;
  }

  private writeSampleMatrices(instances: THREE.InstancedMesh,
    entries: readonly HideRegionSample[]): void {
    const matrix = new THREE.Object3D();
    entries.forEach((sample, index) => {
      matrix.position.set(sample.x, 0.045, sample.z);
      matrix.updateMatrix();
      instances.setMatrixAt(index, matrix.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
  }

  // While a drag is in progress the sampling is deliberately not recomputed, so
  // the previous sample dots are hidden rather than rebuilt per pointermove.
  private hideRegionSamples(): void {
    if (!this.regionSamplesDrawn) return;
    for (const mesh of this.regionSampleMeshes.values()) mesh.visible = false;
    this.regionSamplesDrawn = false;
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
    this.clearRegionPreview();
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
    this.options.onDragStart(id);
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

  private disposeRegionBoundary(): void {
    if (!this.regionBoundary) return;
    this.regionBoundary.removeFromParent();
    this.regionBoundary.geometry.dispose();
    (this.regionBoundary.material as THREE.Material).dispose();
    this.regionBoundary = null;
    this.regionBoundaryShape = null;
    this.regionBoundaryPositions = null;
  }

  private clearRegionPreview(): void {
    if (this.regionPreviewRoot) {
      this.regionPreviewRoot.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = (object as THREE.Mesh).material;
        if (Array.isArray(material)) material.forEach(item => item.dispose());
        else material?.dispose();
      });
      this.regionPreviewRoot.removeFromParent();
      this.regionPreviewRoot = null;
    }
    this.regionBoundary = null;
    this.regionBoundaryShape = null;
    this.regionBoundaryPositions = null;
    this.regionSampleMeshes.clear();
    this.regionSamplesDrawn = false;
  }
}
