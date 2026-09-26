import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../../config/gameConfig.ts';
import { CollisionWorld } from '../CollisionWorld.ts';
import { NavigationSystem } from '../../systems/NavigationSystem.ts';
import type { DoorState } from '../../systems/DoorSystem.ts';
import { checkHideRegionPosition, hideRegionGeometry, hideRegionSetup, sampleHideRegion,
  validateHideRegionData, REGION_AUTHORING_LIMITS, DEFAULT_REGION_SAMPLE_STEP,
  type HideRegionGeometry, type HideRegionPositionCode, type HideRegionSamplePreview }
  from './HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, PLAYER_DIAMETER,
  RICE_CANDIDATES, ROOMS, SPAWNS, WALLS,
  type DoorNode, type HideInteractionRegion, type HideSpot, type HideSpotKind,
  type MapPoint, type Rect, type Room,
} from './apartmentMap.ts';

export const MAP_EXPORT_FORMAT = 'who-ate-my-rice/apartment-map';
export const MAP_EXPORT_VERSION = 2;

// DEV scene-editor validation limits. These are authoring constraints for the
// grey-box map, not gameplay balance, so they deliberately stay out of
// GAME_CONFIG (see AGENTS.md: map coordinates and implementation constants do
// not belong to the tunable gameplay config).
export const EDIT_LIMITS = {
  minWidth: 0.2, maxWidth: 4,
  minDepth: 0.2, maxDepth: 4,
  minHeight: 0.1, maxHeight: 1.6,
  roomMargin: 0.01,
  minAnchorGapToBoxes: 0.05, // anchor must keep clear of every wall/furniture box
  minAnchorFurnitureGap: 0.05, // closer than this counts as being inside the furniture
  maxAnchorFurnitureGap: 0.9, // the anchor has to stay attached to its own furniture
  gridStep: 0.3, // connectivity sampling step, same grid the map tests use
} as const;

export type EditKind = 'FURNITURE' | 'HIDE_SPOT';

export interface FurnitureDraft {
  editKind: 'FURNITURE';
  id: string;
  roomId: string;
  x: number;
  z: number;
  rotationQuarter: number; // 0/90/180/270 degrees; AABB-safe quarter turns only
  width: number;
  depth: number;
  height: number;
}

export interface HideSpotDraft {
  editKind: 'HIDE_SPOT';
  id: string;
  roomId: string;
  kind: HideSpotKind;
  furnitureId: string;
  label: string;
  x: number;
  z: number;
  facing: number; // radians, presentation only
  interactionRegion: HideInteractionRegion;
}

export interface HideRegionEditorPreview {
  geometry: HideRegionGeometry;
  sampling: HideRegionSamplePreview | null;
  sampleStep: number;
}

// What the DEV panel shows as "草稿状态". DRAGGING is the lightweight state used
// while an object is being dragged: the draft changes on every pointermove, so a
// full map validation must not run per frame. The editor validates once on
// release instead.
export type DraftStatus = 'UNCHANGED' | 'DRAGGING' | 'VALID' | 'INVALID';

export type EditTarget = FurnitureDraft | HideSpotDraft;

export const EDITABLE_FURNITURE_FIELDS = ['x', 'z', 'rotationQuarter', 'width', 'depth', 'height'] as const;
export const EDITABLE_HIDE_SPOT_FIELDS = ['x', 'z', 'facing',
  'interactionRegion.radius', 'interactionRegion.halfAngleDeg'] as const;
export const READ_ONLY_FIELDS = ['id', 'editKind', 'kind', 'roomId', 'furnitureId', 'label'] as const;

export type FurnitureField = typeof EDITABLE_FURNITURE_FIELDS[number];
export type HideSpotField = typeof EDITABLE_HIDE_SPOT_FIELDS[number];
export type EditableField = FurnitureField | HideSpotField;

export type RejectionCode =
  | 'NOT_FOUND'
  | 'READ_ONLY_FIELD'
  | 'INVALID_VALUE'
  | 'SIZE_OUT_OF_RANGE'
  | 'NOT_QUARTER_TURN'
  | 'ROOM_BOUNDARY'
  | 'BLOCKS_DOOR'
  | 'COVERS_RICE'
  | 'SPAWN_BLOCKED'
  | 'ROOM_UNREACHABLE'
  | 'ANCHOR_INSIDE_OBSTACLE'
  | 'ANCHOR_DETACHED'
  | 'OVERLAPS_FURNITURE'
  | 'INVALID_REGION_RADIUS'
  | 'INVALID_REGION_ANGLE'
  | 'INVALID_REGION_DATA'
  | 'ANCHOR_OUTSIDE_REGION'
  | 'ANCHOR_REGION_ILLEGAL'
  | 'NO_LEGAL_REGION_SAMPLE';

export interface EditRejection {
  targetId: string;
  code: RejectionCode;
  message: string;
}

export interface MapSource {
  furniture: readonly Rect[];
  hideSpots: readonly HideSpot[];
  walls: readonly Rect[];
  doors: readonly DoorNode[];
  rooms: readonly Room[];
  riceCandidates: readonly MapPoint[];
  spawns: { deepseek: MapPoint; human: MapPoint };
}

export interface EditEvent {
  type: 'SCENE_OBJECT_EDIT_APPLY' | 'SCENE_OBJECT_EDIT_REJECT';
  targetId: string;
  detail: string;
}

export interface FurnitureExport {
  id: string;
  kind: 'furniture';
  roomId: string;
  position: { x: number; z: number };
  rotationDeg: number;
  size: { width: number; depth: number; height: number };
  collisionAabb: { width: number; depth: number };
}

export interface HideSpotExport {
  id: string;
  kind: HideSpotKind;
  roomId: string;
  furnitureId: string;
  label: string;
  anchor: { x: number; z: number };
  facing: number;
  facingDeg: number;
  interactionRegion: HideInteractionRegion & {
    units: { radius: 'world-unit'; halfAngle: 'degree' };
  };
}

export interface MapExportDocument {
  format: string;
  formatVersion: number;
  units: {
    length: string; angle: string; rotation: string; groundPlane: string; up: string;
  };
  map: { width: number; depth: number };
  appliedEditCount: number;
  rooms: { id: string; name: string; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } }[];
  doors: { id: string; position: { x: number; z: number }; width: number; rotationRad: number; connects: [string, string] }[];
  spawns: { id: string; roomId: string; x: number; z: number }[];
  riceCandidates: { id: string; roomId: string; x: number; z: number }[];
  furniture: FurnitureExport[];
  hideSpots: HideSpotExport[];
}

export function sceneEditorEnabled(developerMode: boolean, factionSwitchEnabled: boolean): boolean {
  return developerMode && factionSwitchEnabled;
}

export function authoredMapSource(): MapSource {
  return {
    furniture: FURNITURE,
    hideSpots: HIDE_SPOTS,
    walls: WALLS,
    doors: DOOR_NODES,
    rooms: ROOMS,
    riceCandidates: RICE_CANDIDATES,
    spawns: { deepseek: SPAWNS.deepseek, human: SPAWNS.human },
  };
}

export function rotationDegrees(quarter: number): number {
  return ((quarter % 4) + 4) % 4 * 90;
}

function authoredDoorStates(doors: readonly DoorNode[]): DoorState[] {
  return doors.map(door => ({ id: door.id, nodeId: door.id, state: door.initialState,
    locked: false, lockCoreState: 'ACTIVE' }));
}

// Quarter turns are the only rotations the AABB collision model can represent,
// so a rotated piece swaps its authored width/depth on the ground plane.
export function furnitureRect(draft: FurnitureDraft): Rect {
  const swapped = Math.round(draft.rotationQuarter) % 2 === 1;
  return { id: draft.id, kind: 'furniture', x: draft.x, z: draft.z,
    width: swapped ? draft.depth : draft.width,
    depth: swapped ? draft.width : draft.depth,
    height: draft.height };
}

export function rectBox(rect: Rect): Box3 {
  return new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2));
}

function rectsOverlapXZ(a: Rect, b: Rect, epsilon = 0.001): boolean {
  return Math.abs(a.x - b.x) * 2 < a.width + b.width - epsilon &&
    Math.abs(a.z - b.z) * 2 < a.depth + b.depth - epsilon;
}

function pointInsideInflatedRect(x: number, z: number, radius: number, rect: Rect): boolean {
  return Math.abs(x - rect.x) <= rect.width / 2 + radius &&
    Math.abs(z - rect.z) <= rect.depth / 2 + radius;
}

function rectDistanceXZ(x: number, z: number, rect: Rect): number {
  const dx = Math.max(0, Math.abs(x - rect.x) - rect.width / 2);
  const dz = Math.max(0, Math.abs(z - rect.z) - rect.depth / 2);
  return Math.hypot(dx, dz);
}

function segmentHitsRectXZ(rect: Rect, door: DoorNode, radius: number): boolean {
  const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
  const halfAlong = ((alongX ? door.width : GAME_CONFIG.door.leafThickness) / 2) + radius;
  const halfAcross = ((alongX ? GAME_CONFIG.door.leafThickness : door.width) / 2) + radius;
  const dx = Math.max(0, Math.abs(door.x - rect.x) - rect.width / 2);
  const dz = Math.max(0, Math.abs(door.z - rect.z) - rect.depth / 2);
  return dx < halfAlong && dz < halfAcross;
}

// Mirrors tests/apartment-map.test.mjs: a point is walkable only inside a room
// (or a door opening) and clear of every wall and furniture box.
export function gridFreeX(x: number, z: number, source: MapSource,
  rects: readonly Rect[], radius: number): boolean {
  const inRoom = source.rooms.some(room => x > room.minX + radius && x < room.maxX - radius &&
    z > room.minZ + radius && z < room.maxZ - radius);
  const inDoor = source.doors.some(door => door.rotation === 0
    ? Math.abs(z - door.z) <= radius && Math.abs(x - door.x) < door.width / 2 - radius
    : Math.abs(x - door.x) <= radius && Math.abs(z - door.z) < door.width / 2 - radius);
  return (inRoom || inDoor) &&
    ![...source.walls, ...rects].some(rect => pointInsideInflatedRect(x, z, radius, rect));
}

export interface Reachability {
  cells: Set<string>;
  grid: (x: number, z: number) => { ix: number; iz: number };
  point: (ix: number, iz: number) => { x: number; z: number };
  key: (x: number, z: number) => string;
  hasPoint: (x: number, z: number) => boolean;
  hasRoomInterior: (room: Room) => boolean;
}

// 4-way flood fill over the same sampling grid the map regression test uses.
export function reachableCells(source: MapSource, rects: readonly Rect[],
  radius = PLAYER_DIAMETER / 2, step = EDIT_LIMITS.gridStep): Reachability {
  const nx = Math.round(MAP_WIDTH / step);
  const nz = Math.round(MAP_DEPTH / step);
  const grid = (x: number, z: number) => ({
    ix: Math.round((x + MAP_WIDTH / 2 - step / 2) / step),
    iz: Math.round((z + MAP_DEPTH / 2 - step / 2) / step) });
  const point = (ix: number, iz: number) => ({
    x: -MAP_WIDTH / 2 + step / 2 + ix * step, z: -MAP_DEPTH / 2 + step / 2 + iz * step });
  const key = (x: number, z: number) => {
    const cell = grid(x, z);
    return `${cell.ix},${cell.iz}`;
  };
  const cells = new Set<string>();
  const start = grid(source.spawns.deepseek.x, source.spawns.deepseek.z);
  const queue: { ix: number; iz: number }[] = [];
  const startPoint = point(start.ix, start.iz);
  if (gridFreeX(startPoint.x, startPoint.z, source, rects, radius)) {
    queue.push(start);
    cells.add(`${start.ix},${start.iz}`);
  }
  for (const current of queue) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ix = current.ix + dx, iz = current.iz + dz;
      const cellKey = `${ix},${iz}`;
      if (ix < 0 || iz < 0 || ix >= nx || iz >= nz || cells.has(cellKey)) continue;
      const location = point(ix, iz);
      if (!gridFreeX(location.x, location.z, source, rects, radius)) continue;
      cells.add(cellKey);
      queue.push({ ix, iz });
    }
  }
  return {
    cells, grid, point, key,
    hasPoint: (x, z) => cells.has(key(x, z)),
    hasRoomInterior: (room: Room) => queue.some(cell => {
      const location = point(cell.ix, cell.iz);
      return location.x > room.minX + PLAYER_DIAMETER &&
        location.x < room.maxX - PLAYER_DIAMETER &&
        location.z > room.minZ + PLAYER_DIAMETER &&
        location.z < room.maxZ - PLAYER_DIAMETER;
    }),
  };
}

export function validateEditedMap(furniture: readonly FurnitureDraft[],
  hideSpots: readonly HideSpotDraft[], source: MapSource = authoredMapSource()): EditRejection[] {
  const rejections: EditRejection[] = [];
  const reject = (targetId: string, code: RejectionCode, message: string): void => {
    rejections.push({ targetId, code, message });
  };
  const rects = furniture.map(furnitureRect);
  const byId = new Map(rects.map(rect => [rect.id, rect]));
  const radius = PLAYER_DIAMETER / 2;

  for (const draft of furniture) {
    const rect = byId.get(draft.id)!;
    const room = source.rooms.find(value => value.id === draft.roomId);
    if (!Number.isFinite(draft.x) || !Number.isFinite(draft.z) ||
        !Number.isFinite(draft.width) || !Number.isFinite(draft.depth) ||
        !Number.isFinite(draft.height)) {
      reject(draft.id, 'INVALID_VALUE', `${draft.id} 含有非法数值`);
      continue;
    }
    if (draft.width < EDIT_LIMITS.minWidth || draft.width > EDIT_LIMITS.maxWidth ||
        draft.depth < EDIT_LIMITS.minDepth || draft.depth > EDIT_LIMITS.maxDepth ||
        draft.height < EDIT_LIMITS.minHeight || draft.height > EDIT_LIMITS.maxHeight) {
      reject(draft.id, 'SIZE_OUT_OF_RANGE',
        `${draft.id} 尺寸超出白模合法范围（宽/深 ${EDIT_LIMITS.minWidth}–${EDIT_LIMITS.maxWidth}，高 ${EDIT_LIMITS.minHeight}–${EDIT_LIMITS.maxHeight}）`);
      continue;
    }
    if (Math.abs(draft.rotationQuarter - Math.round(draft.rotationQuarter)) > 1e-9 ||
        Math.round(draft.rotationQuarter) % 1 !== 0) {
      reject(draft.id, 'NOT_QUARTER_TURN', `${draft.id} 只支持 0/90/180/270 度朝向`);
      continue;
    }
    if (!room) {
      reject(draft.id, 'ROOM_BOUNDARY', `${draft.id} 的房间 ${draft.roomId} 不存在`);
      continue;
    }
    const margin = EDIT_LIMITS.roomMargin;
    if (rect.x - rect.width / 2 < room.minX + margin || rect.x + rect.width / 2 > room.maxX - margin ||
        rect.z - rect.depth / 2 < room.minZ + margin || rect.z + rect.depth / 2 > room.maxZ - margin) {
      reject(draft.id, 'ROOM_BOUNDARY', `${draft.id} 越过 ${room.name}（${room.id}）房间边界`);
    }
  }

  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (!rectsOverlapXZ(rects[i], rects[j])) continue;
      reject(rects[i].id, 'OVERLAPS_FURNITURE', `${rects[i].id} 与 ${rects[j].id} 的碰撞盒重叠`);
    }
  }

  for (const door of source.doors) {
    const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
    const stepAway = PLAYER_DIAMETER;
    const approach = alongX
      ? [[door.x, door.z - stepAway], [door.x, door.z + stepAway]]
      : [[door.x - stepAway, door.z], [door.x + stepAway, door.z]];
    for (const rect of rects) {
      if (segmentHitsRectXZ(rect, door, radius)) {
        reject(rect.id, 'BLOCKS_DOOR', `${rect.id} 阻塞 ${door.id} 门洞`);
        continue;
      }
      if (approach.some(([x, z]) => pointInsideInflatedRect(x, z, radius, rect))) {
        reject(rect.id, 'BLOCKS_DOOR', `${rect.id} 堵住 ${door.id} 门前通道`);
      }
    }
  }

  for (const rect of rects) {
    for (const rice of source.riceCandidates) {
      if (pointInsideInflatedRect(rice.x, rice.z, radius, rect)) {
        reject(rect.id, 'COVERS_RICE', `${rect.id} 压住米点 ${rice.id}`);
      }
    }
    for (const spawn of [source.spawns.deepseek, source.spawns.human]) {
      if (pointInsideInflatedRect(spawn.x, spawn.z, radius, rect)) {
        reject(rect.id, 'SPAWN_BLOCKED', `${rect.id} 压住出生点 ${spawn.id}`);
      }
    }
  }

  const reach = reachableCells(source, rects, radius);
  if (reach.cells.size === 0) {
    reject('MAP', 'ROOM_UNREACHABLE', 'DeepSeek 出生点被堵死，角色无法开始寻路');
  } else {
    for (const room of source.rooms) {
      if (!reach.hasRoomInterior(room)) {
        reject('MAP', 'ROOM_UNREACHABLE', `${room.name}（${room.id}）没有角色可达的内部空间`);
      }
    }
    for (const target of [...source.riceCandidates, source.spawns.deepseek, source.spawns.human]) {
      if (!gridFreeX(target.x, target.z, source, rects, radius)) {
        reject(target.id, 'ROOM_UNREACHABLE', `${target.id} 被新家具占住，无法站立`);
      } else if (!reach.hasPoint(target.x, target.z)) {
        reject(target.id, 'ROOM_UNREACHABLE', `${target.id} 与出生点不再连通`);
      }
    }
    for (const door of source.doors) {
      const alongX = Math.abs(Math.sin(door.rotation)) < 0.5;
      const stepAway = PLAYER_DIAMETER;
      const points = [door, ...(alongX
        ? [{ x: door.x, z: door.z - stepAway }, { x: door.x, z: door.z + stepAway }]
        : [{ x: door.x - stepAway, z: door.z }, { x: door.x + stepAway, z: door.z }])];
      for (const point of points) {
        if (!gridFreeX(point.x, point.z, source, rects, radius)) {
          reject(door.id, 'BLOCKS_DOOR', `${door.id} 的门前点被堵住`);
        } else if (!reach.hasPoint(point.x, point.z)) {
          reject(door.id, 'ROOM_UNREACHABLE', `${door.id} 的门前点不再连通`);
        }
      }
    }
  }

  const boxes = [...source.walls, ...rects].map(rectBox);
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  const regionSpots: HideSpot[] = hideSpots.map(spot => ({ ...spot,
    interactionRegion: { ...spot.interactionRegion } }));
  const regionIssues = validateHideRegionData(regionSpots, rects);
  const issueCodes = new Map(regionIssues.map(issue => [issue.spotId, issue]));
  for (const issue of regionIssues) {
    const code: RejectionCode = issue.code === 'ANCHOR_OUTSIDE_REGION'
      ? 'ANCHOR_OUTSIDE_REGION'
      : issue.code === 'INVALID_RADIUS' || issue.code === 'RADIUS_OUT_OF_AUTHORING_RANGE'
        ? 'INVALID_REGION_RADIUS'
        : issue.code === 'INVALID_HALF_ANGLE' || issue.code === 'HALF_ANGLE_OUT_OF_AUTHORING_RANGE' ||
            issue.code === 'UNEXPECTED_HALF_ANGLE'
          ? 'INVALID_REGION_ANGLE' : 'INVALID_REGION_DATA';
    reject(issue.spotId, code, issue.message);
  }
  const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, source.doors);
  const doorStates = authoredDoorStates(source.doors);
  const regionWorld = { collision, navigation, doorStates,
    doorNodes: source.doors, walls: source.walls };
  for (const spot of hideSpots) {
    const room = source.rooms.find(value => value.id === spot.roomId);
    if (!Number.isFinite(spot.x) || !Number.isFinite(spot.z) || !Number.isFinite(spot.facing)) {
      reject(spot.id, 'INVALID_VALUE', `${spot.id} 含有非法数值`);
      continue;
    }
    if (room && (spot.x <= room.minX || spot.x >= room.maxX ||
        spot.z <= room.minZ || spot.z >= room.maxZ)) {
      reject(spot.id, 'ROOM_BOUNDARY', `${spot.id} 已离开 ${room.name}（${room.id}）`);
      continue;
    }
    if (!collision.canOccupyStaticXZ(spot.x, spot.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight)) {
      reject(spot.id, 'ANCHOR_INSIDE_OBSTACLE', `${spot.id} 落进墙或家具内部，角色无法站立`);
      continue;
    }
    const nearest = [...source.walls, ...rects]
      .reduce((best, rect) => Math.min(best, rectDistanceXZ(spot.x, spot.z, rect)), Infinity);
    if (nearest < EDIT_LIMITS.minAnchorGapToBoxes) {
      reject(spot.id, 'ANCHOR_INSIDE_OBSTACLE', `${spot.id} 距最近的墙 / 家具只剩 ${nearest.toFixed(3)}，太贴近`);
      continue;
    }
    const own = byId.get(spot.furnitureId);
    if (!own) {
      reject(spot.id, 'ANCHOR_DETACHED', `${spot.id} 找不到所属家具 ${spot.furnitureId}`);
      continue;
    }
    const gap = rectDistanceXZ(spot.x, spot.z, own);
    if (gap < EDIT_LIMITS.minAnchorFurnitureGap) {
      reject(spot.id, 'ANCHOR_INSIDE_OBSTACLE', `${spot.id} 落进所属家具 ${spot.furnitureId} 内部`);
    } else if (gap > EDIT_LIMITS.maxAnchorFurnitureGap) {
      reject(spot.id, 'ANCHOR_DETACHED',
        `${spot.id} 距所属家具 ${spot.furnitureId} ${gap.toFixed(3)}，已与家具脱离（上限 ${EDIT_LIMITS.maxAnchorFurnitureGap}）`);
    }
    if (issueCodes.has(spot.id)) continue;
    const setup = hideRegionSetup(regionSpots.find(value => value.id === spot.id)!, rects);
    if (!setup) continue;
    const anchorCheck = checkHideRegionPosition(setup, setup.geometry.anchor, regionWorld,
      { reachable: true });
    if (!anchorCheck.legal) {
      reject(spot.id, 'ANCHOR_REGION_ILLEGAL',
        `唯一锚点不是合法交互位置：${anchorCheck.code}`);
      continue;
    }
    // Sample legality is explicitly a lattice check, not a continuous-area proof.
    // Reuse the editor's already-computed reachable grid instead of running A* per sample.
    let preview = sampleHideRegion(setup, regionWorld,
      { step: 0.1, isReachable: point => reach.hasPoint(point.x, point.z) });
    if (preview.legalSamples === 0) {
      preview = sampleHideRegion(setup, regionWorld,
        { step: 0.05, isReachable: point => reach.hasPoint(point.x, point.z) });
    }
    if (preview.legalSamples === 0) {
      reject(spot.id, 'NO_LEGAL_REGION_SAMPLE',
        `${spot.id} 在 0.05 世界单位的加细采样下仍未检测到合法位置；这是采样结果，不是连续空间证明`);
    }
  }

  return rejections;
}

function cloneFurniture(draft: FurnitureDraft): FurnitureDraft { return { ...draft }; }

function cloneSpot(draft: HideSpotDraft): HideSpotDraft {
  return { ...draft, interactionRegion: { ...draft.interactionRegion } };
}

function sourceFurnitureDraft(rect: Rect): FurnitureDraft {
  const room = roomOfRect(rect);
  return { editKind: 'FURNITURE', id: rect.id, roomId: room,
    x: rect.x, z: rect.z, rotationQuarter: 0,
    width: rect.width, depth: rect.depth, height: rect.height };
}

function roomOfRect(rect: Rect): string {
  const room = ROOMS.find(value => rect.x - rect.width / 2 >= value.minX - 0.001 &&
    rect.x + rect.width / 2 <= value.maxX + 0.001 &&
    rect.z - rect.depth / 2 >= value.minZ - 0.001 &&
    rect.z + rect.depth / 2 <= value.maxZ + 0.001);
  return room?.id ?? '';
}

function sourceSpotDraft(spot: HideSpot): HideSpotDraft {
  return { editKind: 'HIDE_SPOT', id: spot.id, roomId: spot.roomId, kind: spot.kind,
    furnitureId: spot.furnitureId, label: spot.label, x: spot.x, z: spot.z,
    facing: spot.facing, interactionRegion: { ...spot.interactionRegion } };
}

function wrapAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function rotateAnchorAroundFurniture(spot: HideSpotDraft, oldFurniture: FurnitureDraft,
  newFurniture: FurnitureDraft): HideSpotDraft {
  const turns = ((newFurniture.rotationQuarter - oldFurniture.rotationQuarter) % 4 + 4) % 4;
  const theta = turns * Math.PI / 2;
  const dx = spot.x - oldFurniture.x, dz = spot.z - oldFurniture.z;
  // Match THREE.Object3D.rotation.y in the XZ ground plane.
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const rotated = turns === 0 ? { x: dx, z: dz }
    : { x: dx * cos + dz * sin, z: -dx * sin + dz * cos };
  return { ...spot, x: newFurniture.x + rotated.x,
    z: newFurniture.z + rotated.z,
    facing: wrapAngle(spot.facing - theta) };
}

export class MapEditSession {
  private readonly source: MapSource;
  private committedFurniture: FurnitureDraft[];
  private committedSpots: HideSpotDraft[];
  private draftFurniture: FurnitureDraft[];
  private draftSpots: HideSpotDraft[];
  private appliedCount = 0;
  private revision = 0;
  private validationCache: { revision: number; result: EditRejection[] } | null = null;
  private validationRunCount = 0;
  private validationWindowOpen = false;
  lastRejection: EditRejection | null = null;
  private readonly editEvents: EditEvent[] = [];

  constructor(source: MapSource = authoredMapSource()) {
    this.source = source;
    this.committedFurniture = source.furniture.map(sourceFurnitureDraft);
    this.committedSpots = source.hideSpots.map(sourceSpotDraft);
    this.draftFurniture = this.committedFurniture.map(cloneFurniture);
    this.draftSpots = this.committedSpots.map(cloneSpot);
  }

  get sourceMap(): MapSource { return this.source; }

  get appliedEditCount(): number { return this.appliedCount; }

  get events(): readonly EditEvent[] { return this.editEvents; }

  get isDirty(): boolean {
    return this.draftFurniture.some((draft, index) =>
      !sameFurniture(draft, this.committedFurniture[index])) ||
      this.draftSpots.some((draft, index) => !sameSpot(draft, this.committedSpots[index]));
  }

  get draftStatus(): DraftStatus {
    // A drag rewrites the draft on every pointermove. While the deferral window
    // is open this per-frame status read stays cheap and reports DRAGGING; the
    // editor runs the full validation once on release instead.
    if (this.validationWindowOpen) return 'DRAGGING';
    if (!this.isDirty) return 'UNCHANGED';
    return this.validateDraft().length ? 'INVALID' : 'VALID';
  }

  // How often the full map validation (collision world + navigation grid + flood
  // fill + region sampling) really ran. Cache hits do not count, so the drag
  // regression tests can prove a whole drag validates exactly once.
  get validationRuns(): number { return this.validationRunCount; }

  get validationDeferred(): boolean { return this.validationWindowOpen; }

  // Opened by the scene editor on pointerdown, closed on pointerup. While it is
  // open `validateDraft()` still works (the release path uses it); only the
  // per-frame `draftStatus` read is suppressed.
  beginDeferredValidation(): void { this.validationWindowOpen = true; }

  endDeferredValidation(): void { this.validationWindowOpen = false; }

  list(): EditTarget[] {
    return [...this.draftFurniture.map(cloneFurniture), ...this.draftSpots.map(cloneSpot)];
  }

  get(id: string): EditTarget | null {
    const furniture = this.draftFurniture.find(draft => draft.id === id);
    if (furniture) return cloneFurniture(furniture);
    const spot = this.draftSpots.find(draft => draft.id === id);
    return spot ? cloneSpot(spot) : null;
  }

  furnitureList(): FurnitureDraft[] { return this.draftFurniture.map(cloneFurniture); }

  hideSpotList(): HideSpotDraft[] { return this.draftSpots.map(cloneSpot); }

  hideSpotForTarget(targetId: string): string | null {
    const spot = this.draftSpots.find(value => value.id === targetId || value.furnitureId === targetId);
    return spot?.id ?? null;
  }

  regionPreview(targetId: string, includeSamples = true,
    step = DEFAULT_REGION_SAMPLE_STEP): HideRegionEditorPreview | null {
    const spotId = this.hideSpotForTarget(targetId);
    const spotDraft = this.draftSpots.find(value => value.id === spotId);
    if (!spotDraft) return null;
    const rects = this.draftFurniture.map(furnitureRect);
    const regionSpot: HideSpot = { ...spotDraft, interactionRegion: { ...spotDraft.interactionRegion } };
    const setup = hideRegionSetup(regionSpot, rects);
    const dataIssues = validateHideRegionData([regionSpot], rects);
    if (!setup || dataIssues.some(issue => issue.code !== 'ANCHOR_OUTSIDE_REGION')) return null;
    const geometry = hideRegionGeometry(regionSpot, setup.furniture);
    if (!includeSamples) return { geometry, sampling: null, sampleStep: step };
    const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2,
      [...this.source.walls, ...rects].map(rectBox));
    const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, this.source.doors);
    const reach = reachableCells(this.source, rects);
    const world = { collision, navigation,
      doorStates: authoredDoorStates(this.source.doors),
      doorNodes: this.source.doors, walls: this.source.walls };
    const sampling = sampleHideRegion(setup, world,
      { step, isReachable: point => reach.hasPoint(point.x, point.z) });
    return { geometry, sampling, sampleStep: step };
  }

  setField(id: string, field: string, value: number): EditRejection | null {
    if ((READ_ONLY_FIELDS as readonly string[]).includes(field)) {
      return this.reject(id, 'READ_ONLY_FIELD', `${field} 是只读字段（稳定 ID / 归属不可编辑）`);
    }
    const furniture = this.draftFurniture.find(draft => draft.id === id);
    if (furniture) {
      if (!(EDITABLE_FURNITURE_FIELDS as readonly string[]).includes(field)) {
        return this.reject(id, 'READ_ONLY_FIELD', `${field} 不是家具可编辑字段`);
      }
      if (!Number.isFinite(value)) return this.reject(id, 'INVALID_VALUE', `${field} 必须是数字`);
      if (field === 'rotationQuarter' && Math.abs(value - Math.round(value)) > 1e-9) {
        return this.reject(id, 'NOT_QUARTER_TURN', '朝向只支持 0 / 1 / 2 / 3（0/90/180/270 度）');
      }
      if (field === 'width' && (value < EDIT_LIMITS.minWidth || value > EDIT_LIMITS.maxWidth)) {
        return this.reject(id, 'SIZE_OUT_OF_RANGE', `宽度需在 ${EDIT_LIMITS.minWidth}–${EDIT_LIMITS.maxWidth} 之间`);
      }
      if (field === 'depth' && (value < EDIT_LIMITS.minDepth || value > EDIT_LIMITS.maxDepth)) {
        return this.reject(id, 'SIZE_OUT_OF_RANGE', `进深需在 ${EDIT_LIMITS.minDepth}–${EDIT_LIMITS.maxDepth} 之间`);
      }
      if (field === 'height' && (value < EDIT_LIMITS.minHeight || value > EDIT_LIMITS.maxHeight)) {
        return this.reject(id, 'SIZE_OUT_OF_RANGE', `高度需在 ${EDIT_LIMITS.minHeight}–${EDIT_LIMITS.maxHeight} 之间`);
      }
      const old = cloneFurniture(furniture);
      (furniture as unknown as Record<string, number>)[field] = value;
      if (field === 'x' || field === 'z' || field === 'rotationQuarter') {
        for (let index = 0; index < this.draftSpots.length; index++) {
          if (this.draftSpots[index].furnitureId === id) {
            this.draftSpots[index] = rotateAnchorAroundFurniture(this.draftSpots[index], old, furniture);
          }
        }
      }
      this.invalidateValidation();
      return null;
    }
    const spot = this.draftSpots.find(draft => draft.id === id);
    if (!spot) return this.reject(id, 'NOT_FOUND', `找不到可编辑对象 ${id}`);
    if (!(EDITABLE_HIDE_SPOT_FIELDS as readonly string[]).includes(field)) {
      return this.reject(id, 'READ_ONLY_FIELD', `${field} 不是藏身锚点可编辑字段`);
    }
    if (!Number.isFinite(value)) return this.reject(id, 'INVALID_VALUE', `${field} 必须是数字`);
    if (field === 'interactionRegion.radius') {
      if (value < REGION_AUTHORING_LIMITS.minRadius || value > REGION_AUTHORING_LIMITS.maxRadius) {
        return this.reject(id, 'INVALID_REGION_RADIUS',
          `区域半径需在 ${REGION_AUTHORING_LIMITS.minRadius}–${REGION_AUTHORING_LIMITS.maxRadius} 之间`);
      }
      spot.interactionRegion.radius = value;
    } else if (field === 'interactionRegion.halfAngleDeg') {
      if (spot.interactionRegion.shape !== 'SECTOR') {
        return this.reject(id, 'READ_ONLY_FIELD', '圆形区域没有扇形半角');
      }
      if (value < REGION_AUTHORING_LIMITS.minHalfAngleDeg ||
          value > REGION_AUTHORING_LIMITS.maxHalfAngleDeg) {
        return this.reject(id, 'INVALID_REGION_ANGLE',
          `扇形半角需在 ${REGION_AUTHORING_LIMITS.minHalfAngleDeg}–${REGION_AUTHORING_LIMITS.maxHalfAngleDeg} 度之间`);
      }
      spot.interactionRegion.halfAngleDeg = value;
    } else {
      (spot as unknown as Record<string, number>)[field] = value;
    }
    this.invalidateValidation();
    return null;
  }

  moveTarget(id: string, x: number, z: number): EditRejection | null {
    const first = this.setField(id, 'x', x);
    if (first) return first;
    return this.setField(id, 'z', z);
  }

  diff(id: string): { field: string; from: number | string; to: number | string }[] {
    const draft = this.get(id);
    if (!draft) return [];
    const committed = draft.editKind === 'FURNITURE'
      ? this.committedFurniture.find(value => value.id === id)!
      : this.committedSpots.find(value => value.id === id)!;
    const result: { field: string; from: number | string; to: number | string }[] = [];
    for (const field of Object.keys(draft)) {
      if (field === 'editKind' || field === 'id' || field === 'roomId' || field === 'kind' ||
          field === 'furnitureId' || field === 'label') continue;
      if (field === 'interactionRegion') {
        if (draft.editKind !== 'HIDE_SPOT') continue;
        const committedSpot = this.committedSpots.find(value => value.id === id);
        if (!committedSpot) continue;
        for (const regionField of ['shape', 'radius', 'halfAngleDeg'] as const) {
          const from = committedSpot.interactionRegion[regionField];
          const to = draft.interactionRegion[regionField];
          if (from !== to) result.push({ field: `interactionRegion.${regionField}`,
            from: from ?? '无', to: to ?? '无' });
        }
        continue;
      }
      const from = (committed as unknown as Record<string, number>)[field];
      const to = (draft as unknown as Record<string, number>)[field];
      if (from !== undefined && from !== to) result.push({ field, from, to });
    }
    return result;
  }

  resetTarget(id: string): boolean {
    const furnitureIndex = this.draftFurniture.findIndex(draft => draft.id === id);
    if (furnitureIndex >= 0) {
      const authored = this.source.furniture.find(rect => rect.id === id);
      if (!authored) return false;
      this.draftFurniture[furnitureIndex] = sourceFurnitureDraft(authored);
      for (let index = 0; index < this.draftSpots.length; index++) {
        const sourceSpot = this.source.hideSpots.find(spot => spot.id === this.draftSpots[index].id);
        if (sourceSpot?.furnitureId === id) this.draftSpots[index] = sourceSpotDraft(sourceSpot);
      }
      this.invalidateValidation();
      return true;
    }
    const spotIndex = this.draftSpots.findIndex(draft => draft.id === id);
    if (spotIndex >= 0) {
      const authored = this.source.hideSpots.find(spot => spot.id === id);
      if (!authored) return false;
      this.draftSpots[spotIndex] = sourceSpotDraft(authored);
      this.invalidateValidation();
      return true;
    }
    return false;
  }

  resetAll(): void {
    this.draftFurniture = this.committedFurniture.map(cloneFurniture);
    this.draftSpots = this.committedSpots.map(cloneSpot);
    this.lastRejection = null;
    // A whole-draft reset ends any drag window: there is nothing left to defer.
    this.validationWindowOpen = false;
    this.invalidateValidation();
  }

  // Rolls one target back to the last applied value (used when a drag or a
  // rejected edit has to disappear from the preview without touching the map).
  revertToCommitted(id: string): boolean {
    const furnitureIndex = this.draftFurniture.findIndex(draft => draft.id === id);
    if (furnitureIndex >= 0) {
      const committed = this.committedFurniture.find(draft => draft.id === id);
      if (!committed) return false;
      this.draftFurniture[furnitureIndex] = cloneFurniture(committed);
      for (let index = 0; index < this.draftSpots.length; index++) {
        if (this.draftSpots[index].furnitureId === id) {
          const committedSpot = this.committedSpots.find(spot => spot.id === this.draftSpots[index].id);
          if (committedSpot) this.draftSpots[index] = cloneSpot(committedSpot);
        }
      }
      this.invalidateValidation();
      return true;
    }
    const spotIndex = this.draftSpots.findIndex(draft => draft.id === id);
    if (spotIndex >= 0) {
      const committed = this.committedSpots.find(draft => draft.id === id);
      if (!committed) return false;
      this.draftSpots[spotIndex] = cloneSpot(committed);
      this.invalidateValidation();
      return true;
    }
    return false;
  }

  validateDraft(): EditRejection[] {
    if (this.validationCache?.revision === this.revision) return this.validationCache.result;
    const result = validateEditedMap(this.draftFurniture, this.draftSpots, this.source);
    this.validationRunCount++;
    this.validationCache = { revision: this.revision, result };
    return result;
  }

  private invalidateValidation(): void {
    this.revision++;
    this.validationCache = null;
  }

  // Rejected edits must never pollute the applied map: the draft rolls back to
  // the last legal committed state and the rejection is reported for the DEV UI.
  apply(): { ok: boolean; rejections: EditRejection[] } {
    const rejections = this.validateDraft();
    if (rejections.length) {
      this.resetAll();
      this.lastRejection = rejections[0];
      this.recordEvent('SCENE_OBJECT_EDIT_REJECT', rejections[0].targetId, rejections[0].message);
      return { ok: false, rejections };
    }
    this.committedFurniture = this.draftFurniture.map(cloneFurniture);
    this.committedSpots = this.draftSpots.map(cloneSpot);
    this.appliedCount++;
    this.invalidateValidation();
    this.lastRejection = null;
    this.recordEvent('SCENE_OBJECT_EDIT_APPLY', 'MAP',
      `应用编辑：家具 ${this.committedFurniture.length} 件 / 藏身点 ${this.committedSpots.length} 个`);
    return { ok: true, rejections: [] };
  }

  exportJson(): MapExportDocument {
    return {
      format: MAP_EXPORT_FORMAT,
      formatVersion: MAP_EXPORT_VERSION,
      units: { length: 'world-unit', angle: 'radian', rotation: 'degree',
        groundPlane: 'XZ', up: 'Y' },
      map: { width: MAP_WIDTH, depth: MAP_DEPTH },
      appliedEditCount: this.appliedCount,
      rooms: this.source.rooms.map(room => ({ id: room.id, name: room.name,
        bounds: { minX: room.minX, maxX: room.maxX, minZ: room.minZ, maxZ: room.maxZ } })),
      doors: this.source.doors.map(door => ({ id: door.id,
        position: { x: door.x, z: door.z }, width: door.width, rotationRad: door.rotation,
        connects: [door.connectedRoomA, door.connectedRoomB] })),
      spawns: [this.source.spawns.deepseek, this.source.spawns.human].map(spawn =>
        ({ id: spawn.id, roomId: spawn.roomId, x: spawn.x, z: spawn.z })),
      riceCandidates: this.source.riceCandidates.map(rice =>
        ({ id: rice.id, roomId: rice.roomId, x: rice.x, z: rice.z })),
      furniture: this.committedFurniture.map(draft => {
        const rect = furnitureRect(draft);
        return { id: draft.id, kind: 'furniture' as const, roomId: draft.roomId,
          position: { x: draft.x, z: draft.z },
          rotationDeg: rotationDegrees(draft.rotationQuarter),
          size: { width: draft.width, depth: draft.depth, height: draft.height },
          collisionAabb: { width: rect.width, depth: rect.depth } };
      }),
      hideSpots: this.committedSpots.map(draft => ({ id: draft.id, kind: draft.kind,
        roomId: draft.roomId, furnitureId: draft.furnitureId, label: draft.label,
        anchor: { x: draft.x, z: draft.z }, facing: draft.facing,
        facingDeg: draft.facing * 180 / Math.PI,
        interactionRegion: { ...draft.interactionRegion,
          units: { radius: 'world-unit', halfAngle: 'degree' } } })),
    };
  }

  cloneCommitted(): { furniture: FurnitureDraft[]; hideSpots: HideSpotDraft[] } {
    return { furniture: this.committedFurniture.map(cloneFurniture),
      hideSpots: this.committedSpots.map(cloneSpot) };
  }

  private reject(id: string, code: RejectionCode, message: string): EditRejection {
    const rejection = { targetId: id, code, message };
    this.lastRejection = rejection;
    return rejection;
  }

  private recordEvent(type: EditEvent['type'], targetId: string, detail: string): void {
    this.editEvents.push({ type, targetId, detail });
    if (this.editEvents.length > 40) this.editEvents.splice(0, this.editEvents.length - 40);
  }
}

function sameFurniture(a: FurnitureDraft, b: FurnitureDraft): boolean {
  return a.x === b.x && a.z === b.z && a.width === b.width && a.depth === b.depth &&
    a.height === b.height && a.rotationQuarter === b.rotationQuarter;
}

function sameSpot(a: HideSpotDraft, b: HideSpotDraft): boolean {
  return a.x === b.x && a.z === b.z && a.facing === b.facing &&
    a.interactionRegion.shape === b.interactionRegion.shape &&
    a.interactionRegion.radius === b.interactionRegion.radius &&
    a.interactionRegion.halfAngleDeg === b.interactionRegion.halfAngleDeg;
}
