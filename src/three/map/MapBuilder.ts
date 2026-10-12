import * as THREE from 'three';
import { addEntryDoorMat } from '../EntryFurnitureVisual.ts';
import { InteriorShadowView, applyInteriorSunShadow, isCoveredInterior,
  wallHasOutdoorSide } from '../InteriorShadowView.ts';
import { dressClosedExteriorWall } from './ClosedExteriorDoors.ts';
import { buildGarageFloor } from './GarageGround.ts';
import { buildResidentialExterior } from '../ResidentialExterior.ts';
import { doorVisualGeometry } from '../DoorVisualGeometry.ts';
import { dressFurniture, furnitureColor, HOME_PALETTE, HOME_COMPOSITION } from '../AlphaPresentation.ts';
import { GAME_CONFIG } from '../../config/gameConfig.ts';
import { orientedObstacleFromRect, type OrientedObstacle } from '../CollisionWorld.ts';
import { rectCorners } from './RotatedRect.ts';
import { DEBUG_MAP, FURNITURE, hideSpotDebugMarkers, HIDE_SPOTS, RICE_CANDIDATES,
  ROOMS, SPAWNS, WALLS, DOOR_NODES, type HideSpot, type Rect } from './apartmentMap.ts';

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
  debugRoot: THREE.Group;
  // Exact axis-aligned colliders (walls and rotation-0 pieces).
  obstacles: THREE.Box3[];
  // Exact colliders for pieces rotated by an arbitrary angle. Their bounding
  // boxes are broad-phase data only and are deliberately not in `obstacles`.
  orientedObstacles: OrientedObstacle[];
  furnitureMeshes: Map<string, THREE.Mesh>;
  anchorGizmos: Map<string, THREE.Group>;
  anchorGizmoRoot: THREE.Group;
  hideSpotIndicators: Map<string, THREE.Mesh>;
  hideSpotIndicatorRoot: THREE.Group;
  interiorShadows: InteriorShadowView;
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
  const interiorShadows = new InteriorShadowView();
  root.name = 'apartment';
  parent.add(root);
  const debugRoot = new THREE.Group();
  debugRoot.name = 'map-debug-labels';
  debugRoot.visible = false;
  root.add(debugRoot);
  const obstacles: THREE.Box3[] = [];
  const orientedObstacles: OrientedObstacle[] = [];
  const furnitureMeshes = new Map<string, THREE.Mesh>();
  const anchorGizmos = new Map<string, THREE.Group>();
  const anchorGizmoRoot = new THREE.Group();
  anchorGizmoRoot.name = 'hide-spot-anchors';
  anchorGizmoRoot.visible = options.anchorGizmos ?? false;
  root.add(anchorGizmoRoot);
  const hideSpotIndicators = new Map<string, THREE.Mesh>();
  const hideSpotIndicatorRoot = new THREE.Group();
  hideSpotIndicatorRoot.name = 'hide-spot-indicators';
  hideSpotIndicatorRoot.visible = false;
  root.add(hideSpotIndicatorRoot);
  buildResidentialExterior(root, ROOMS);

  for (const room of ROOMS) {
    if (room.id === 'garage') {
      const first = root.children.length;
      buildGarageFloor(root, room, furniture.find(item => item.id === 'garage_car'));
      root.children.slice(first).forEach(object => applyInteriorSunShadow(object, true));
      if (debug) marker(debugRoot, room.name, '#ffffff', room.x, room.z, 0.18);
      continue;
    }
    const floor = box(root, room.width - 0.04, 0.12, room.depth - 0.04,
      // `north_balcony` matches on "balcony"; `utility` is a tiled wet/laundry room.
      /bathroom|kitchen|balcony|utility/.test(room.id) ? HOME_PALETTE.tile : 0xbca17c,
      room.x, -0.06, room.z);
    // 共墙移除后两块地板接齐，避免原区域边界留下黑色缝隙。
    if (room.id === 'south_hall' || room.id === 'east_hall') {
      floor.scale.x = (room.width - .02) / (room.width - .04);
      floor.position.x += room.id === 'south_hall' ? .01 : -.01;
    }
    floor.castShadow = false;
    floor.receiveShadow = !isCoveredInterior(room.x, room.z);
    const points: THREE.Vector3[] = [];
    for (let z = room.minZ + .65; z < room.maxZ; z += .65)
      points.push(new THREE.Vector3(room.minX + .025, .008, z),
        new THREE.Vector3(room.maxX - .025, .008, z));
    // 卫生间补齐横纵瓷砖缝，其他房间保留原表现。
    if (room.id === 'bathroom')
      for (let x = room.minX + .65; x < room.maxX; x += .65)
        points.push(new THREE.Vector3(x, .008, room.minZ + .025),
          new THREE.Vector3(x, .008, room.maxZ - .025));
    const grain = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: room.id === 'bathroom' ? 0x8e9e98 : 0x917451, transparent: true, opacity: .16,
        depthWrite: false }));
    root.add(grain);
    if (debug) marker(debugRoot, room.name, '#ffffff', room.x, room.z, 0.18);
  }

  addEntryDoorMat(root);
  const addObstacle = (rect: Rect): void => {
    const isFurniture = rect.kind === 'furniture';
    const rotation = rect.rotation ?? 0;
    const color = isFurniture ? furnitureColor(rect.id) : HOME_PALETTE.wall;
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
    if (!isFurniture) {
      if (dressClosedExteriorWall(root, rect)) {
        // 此替代外墙位于室外边界，保留向室外投影；不接收室内日光硬影。
        root.children.at(-1)!.traverse(object => {
          if (object instanceof THREE.Mesh) object.receiveShadow = false;
        });
        mesh.visible = false; // Closed leaf replaces this visual segment; collider above stays solid.
        return;
      }
      // Cutaway wall presentation AFTER authoritative colliders are captured.
      // 有顶室内无日光硬影；外边界墙仍向露天区域投影。
      mesh.castShadow = wallHasOutdoorSide(rect);
      mesh.receiveShadow = false;
      mesh.scale.y = HOME_COMPOSITION.wallHeightScale;
      mesh.position.y = rect.height * HOME_COMPOSITION.wallHeightScale / 2;
      // Broaden only the short axis, never shorten a doorway along the wall.
      if (rect.width < rect.depth) mesh.scale.x = HOME_COMPOSITION.wallThicknessScale;
      else mesh.scale.z = HOME_COMPOSITION.wallThicknessScale;
      const cap = box(root, rect.width < rect.depth ? .36 : rect.width,
        .12, rect.width < rect.depth ? rect.depth : .36, 0xcbbb9c,
        rect.x, rect.height * HOME_COMPOSITION.wallHeightScale + .06, rect.z);
      cap.name = 'visual-wall-cap';
      cap.castShadow = mesh.castShadow;
      cap.receiveShadow = false;
    }
    if (isFurniture) {
      furnitureMeshes.set(rect.id, mesh);
      dressFurniture(mesh, rect);
      interiorShadows.add(mesh, rect);
    }
    if (debug && isFurniture) addFurnitureOutline(debugRoot, rect);
  };
  [...WALLS, ...furniture].forEach(addObstacle);
  // Stationary door casing: it must not rotate with the opening leaf.
  for (const door of DOOR_NODES) {
    const visual = doorVisualGeometry(door.width, GAME_CONFIG.door.leafThickness);
    const frame = new THREE.Group();
    frame.position.set(door.x, 0, door.z);
    frame.rotation.y = door.rotation;
    frame.name = `visual-frame-${door.id}`;
    root.add(frame);
    for (const side of [-1, 1]) {
      const post = box(frame, visual.jambWidth, visual.jambHeight, visual.frameDepth,
        0xab9473, side * (door.width / 2 - visual.jambWidth / 2), visual.jambHeight / 2, 0);
      post.name = `jamb-${side < 0 ? 'left' : 'right'}`;
    }
    const header = box(frame, door.width, visual.headerHeight, visual.frameDepth,
      0xab9473, 0, visual.headerY, 0);
    header.name = 'door-header';
    applyInteriorSunShadow(frame, isCoveredInterior(door.x, door.z));
  }

  for (const spot of hideSpots) {
    // Gameplay-independent marker at the authored, validated interaction anchor.
    const indicator = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 32),
      new THREE.MeshBasicMaterial({ color: 0x8bcfd8, transparent: true,
        opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    indicator.name = `hide-indicator-${spot.id}`;
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.set(spot.x, 0.09, spot.z);
    hideSpotIndicators.set(spot.id, indicator);
    hideSpotIndicatorRoot.add(indicator);
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
      box(debugRoot, 0.3, 0.03, 0.3, 0x5889b0, candidate.x, 0.025, candidate.z);
      marker(debugRoot, candidate.id, '#9fd7ff', candidate.x, candidate.z, 0.45);
    }
    // S7C-1A: debug-only view of the hide spots (id, type and anchor
    // coordinates). Nothing is produced while the debug labels are off.
    for (const spot of hideSpotDebugMarkers(debug, hideSpots)) {
      box(debugRoot, 0.36, 0.03, 0.36, 0x7fd08a, spot.x, 0.025, spot.z);
      markerLines(debugRoot, spot.text, '#b7e0a2', spot.x, spot.z, 1.6, 26);
    }
    // Authored reference points; the live per-round spawns are shown in DEV.
    marker(debugRoot, 'DS REF SPAWN', '#91caff', SPAWNS.deepseek.x, SPAWNS.deepseek.z, 1.35);
    marker(debugRoot, 'HU REF SPAWN', '#ffc18e', SPAWNS.human.x, SPAWNS.human.z, 1.35);
  }
  applyInteriorSunShadow(debugRoot, true); // 调试米点/锚点色块永远不投影。

  return {
    root, debugRoot, obstacles, orientedObstacles, furnitureMeshes, anchorGizmos, anchorGizmoRoot,
    hideSpotIndicators, hideSpotIndicatorRoot, interiorShadows,
    dispose(): void {
      interiorShadows.dispose();
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
