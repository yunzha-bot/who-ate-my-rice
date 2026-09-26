import * as THREE from 'three';
import { orientedObstacleFromRect, type OrientedObstacle } from '../CollisionWorld.ts';
import { rectCorners } from './RotatedRect.ts';
import { DEBUG_MAP, FURNITURE, hideSpotDebugMarkers, HIDE_SPOTS, RICE_CANDIDATES,
  ROOMS, SPAWNS, WALLS, type HideSpot, type Rect } from './apartmentMap';

const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 1 });

function box(parent: THREE.Object3D, width: number, height: number, depth: number,
  color: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material(color));
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function markerLines(parent: THREE.Object3D, lines: readonly string[], color: string,
  x: number, z: number, y: number, fontSize: number): void {
  const canvas = document.createElement('canvas');
  const lineHeight = fontSize + 12;
  canvas.width = 512;
  canvas.height = Math.max(96, lines.length * lineHeight + 20);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#253038dd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const first = canvas.height / 2 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, index) => ctx.fillText(line, canvas.width / 2,
    first + index * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.position.set(x, y, z);
  sprite.scale.set(2.6, 0.49, 1);
  sprite.renderOrder = 5;
  parent.add(sprite);
}

function marker(parent: THREE.Object3D, label: string, color: string, x: number, z: number,
  y = 0.9): void {
  markerLines(parent, [label], color, x, z, y, 34);
}

export interface ApartmentBuildOptions {
  // DEV scene editor overloads: the committed (validated) furniture and anchor
  // lists may differ from the authored module data after an applied edit.
  furniture?: readonly Rect[];
  hideSpots?: readonly HideSpot[];
  debug?: boolean;
  anchorGizmos?: boolean;
}

export interface ApartmentBuild {
  root: THREE.Group;
  // Exact axis-aligned colliders (walls and rotation-0 pieces).
  obstacles: THREE.Box3[];
  // Exact colliders for pieces rotated by an arbitrary angle. Their bounding
  // boxes are broad-phase data only and are deliberately not in `obstacles`.
  orientedObstacles: OrientedObstacle[];
  furnitureMeshes: Map<string, THREE.Mesh>;
  anchorGizmos: Map<string, THREE.Group>;
  anchorGizmoRoot: THREE.Group;
  dispose(): void;
}

// True footprint outline: for a rotated piece an axis-aligned BoxHelper would
// draw the wrong shape, so every piece is outlined from its real corners. With
// rotation 0 this is the same box wireframe the helper used to draw.
function addFurnitureOutline(parent: THREE.Object3D, rect: Rect): void {
  const corners = rectCorners(rect);
  const bottom = corners.map(point => new THREE.Vector3(point.x, 0.01, point.z));
  const top = corners.map(point => new THREE.Vector3(point.x, rect.height, point.z));
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;
    points.push(bottom[index], bottom[next]);
    points.push(top[index], top[next]);
    points.push(bottom[index], top[index]);
  }
  const outline = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x729aa6 }));
  parent.add(outline);
}

// Builds the whole apartment into one removable group so the DEV scene editor
// can rebuild it from validated data instead of moving meshes without their
// collision. Meshes carry their stable object id for picking and highlighting.
export function buildApartment(parent: THREE.Object3D,
  options: ApartmentBuildOptions = {}): ApartmentBuild {
  const debug = options.debug ?? DEBUG_MAP;
  const furniture = options.furniture ?? FURNITURE;
  const hideSpots = options.hideSpots ?? HIDE_SPOTS;
  const root = new THREE.Group();
  root.name = 'apartment';
  parent.add(root);
  const obstacles: THREE.Box3[] = [];
  const orientedObstacles: OrientedObstacle[] = [];
  const furnitureMeshes = new Map<string, THREE.Mesh>();
  const anchorGizmos = new Map<string, THREE.Group>();
  const anchorGizmoRoot = new THREE.Group();
  anchorGizmoRoot.name = 'hide-spot-anchors';
  anchorGizmoRoot.visible = options.anchorGizmos ?? false;
  root.add(anchorGizmoRoot);

  for (const room of ROOMS) {
    const floor = box(root, room.width - 0.04, 0.12, room.depth - 0.04,
      room.color, room.x, -0.06, room.z);
    floor.castShadow = false;
    if (debug) marker(root, room.name, '#ffffff', room.x, room.z, 0.18);
  }

  const addObstacle = (rect: Rect): void => {
    const isFurniture = rect.kind === 'furniture';
    const rotation = rect.rotation ?? 0;
    const color = isFurniture ? 0x746d67 : 0x59646d;
    const mesh = box(root, rect.width, rect.height, rect.depth, color,
      rect.x, rect.height / 2, rect.z);
    // The visual mesh follows the same angle as the collision footprint.
    mesh.rotation.y = rotation;
    mesh.updateMatrixWorld(true);
    mesh.userData.objectId = rect.id;
    mesh.userData.objectKind = isFurniture ? 'FURNITURE' : 'WALL';
    if (rotation === 0) {
      obstacles.push(new THREE.Box3().setFromObject(mesh));
    } else {
      // A rotated piece is collided as its true oriented footprint; its
      // axis-aligned bounds must never be registered as a solid box.
      orientedObstacles.push(orientedObstacleFromRect(rect));
    }
    if (isFurniture) furnitureMeshes.set(rect.id, mesh);
    if (debug && isFurniture) addFurnitureOutline(root, rect);
  };
  [...WALLS, ...furniture].forEach(addObstacle);

  for (const spot of hideSpots) {
    const group = new THREE.Group();
    group.name = `anchor-${spot.id}`;
    group.position.set(spot.x, 0, spot.z);
    group.userData.objectId = spot.id;
    group.userData.objectKind = 'HIDE_SPOT';
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.35, 28),
      new THREE.MeshBasicMaterial({ color: 0x7fd08a, side: THREE.DoubleSide,
        transparent: true, opacity: 0.95, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const center = new THREE.Mesh(new THREE.CircleGeometry(0.09, 18),
      new THREE.MeshBasicMaterial({ color: 0xe4ffdc, transparent: true,
        depthWrite: false }));
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.035;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.3, 0.03),
      new THREE.MeshBasicMaterial({ color: 0x9fe8a6, transparent: true, opacity: 0.85,
        depthWrite: false }));
    post.position.y = 0.65;
    // Invisible but raycastable hit volume: a thin ring is hard to click, and
    // occluded anchors must still be selectable in the editor.
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.4, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    hit.position.y = 0.7;
    hit.userData.objectId = spot.id;
    hit.userData.objectKind = 'HIDE_SPOT';
    group.add(ring, center, post, hit);
    group.userData.ring = ring;
    group.userData.centerDot = center;
    group.userData.post = post;
    anchorGizmos.set(spot.id, group);
    anchorGizmoRoot.add(group);
  }

  if (debug) {
    for (const candidate of RICE_CANDIDATES) {
      box(root, 0.3, 0.03, 0.3, 0x5889b0, candidate.x, 0.025, candidate.z);
      marker(root, candidate.id, '#9fd7ff', candidate.x, candidate.z, 0.45);
    }
    // S7C-1A: debug-only view of the hide spots (id, type and anchor
    // coordinates). Nothing is produced while the debug labels are off.
    for (const spot of hideSpotDebugMarkers(debug, hideSpots)) {
      box(root, 0.36, 0.03, 0.36, 0x7fd08a, spot.x, 0.025, spot.z);
      markerLines(root, spot.text, '#b7e0a2', spot.x, spot.z, 1.6, 26);
    }
    marker(root, 'DS SPAWN', '#91caff', SPAWNS.deepseek.x, SPAWNS.deepseek.z, 1.35);
    marker(root, 'HU SPAWN', '#ffc18e', SPAWNS.human.x, SPAWNS.human.z, 1.35);
  }

  return {
    root, obstacles, orientedObstacles, furnitureMeshes, anchorGizmos, anchorGizmoRoot,
    dispose(): void {
      root.traverse(object => {
        if (object instanceof THREE.Sprite) {
          const spriteMaterial = object.material;
          spriteMaterial.map?.dispose();
          spriteMaterial.dispose();
          return;
        }
        const drawable = object as unknown as THREE.Mesh;
        if (!drawable.geometry || !drawable.material) return;
        drawable.geometry.dispose();
        const list = Array.isArray(drawable.material) ? drawable.material : [drawable.material];
        for (const item of list) {
          const texture = (item as THREE.MeshBasicMaterial).map;
          texture?.dispose();
          item.dispose();
        }
      });
      root.removeFromParent();
    },
  };
}
