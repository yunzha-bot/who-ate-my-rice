import { GAME_CONFIG } from '../../config/gameConfig.ts';

export interface Point { x: number; z: number }
export interface Room extends Point {
  id: string; name: string; color: number; major: boolean;
  minX: number; maxX: number; minZ: number; maxZ: number;
  width: number; depth: number;
}
export interface Rect extends Point {
  id: string; width: number; depth: number; height: number;
  kind: 'wall' | 'furniture';
}
export interface DoorNode extends Point {
  id: string; rotation: number; width: number;
  initialState: 'OPEN' | 'CLOSED';
  connectedRoomA: string; connectedRoomB: string;
}
export interface MapPoint extends Point { id: string; roomId: string }

export const MAP_WIDTH = 36;
export const MAP_DEPTH = 30;
export const DEBUG_MAP = true;
export const ACTIVE_RICE_COUNT = GAME_CONFIG.rice.activeCount;
export const PLAYER_DIAMETER = GAME_CONFIG.player.size / GAME_CONFIG.three.pixelsPerUnit;
export const MIN_DOOR_WIDTH = PLAYER_DIAMETER * 2;
// S6B residential single-leaf opening. It remains over two actor widths while
// presenting a distinctly narrow, domestic door silhouette.
export const SINGLE_DOOR_WIDTH = 1.2;

const room = (id: string, name: string, minX: number, maxX: number,
  minZ: number, maxZ: number, color: number, major = true): Room => ({
  id, name, minX, maxX, minZ, maxZ, color, major,
  x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
  width: maxX - minX, depth: maxZ - minZ,
});

// Based on the left-hand apartment plan in 场景图.png. Balcony and closet
// remain distinct auxiliary spaces, alongside ten main spaces. All dimensions
// are widened for pursuit; these are not real-world apartment measurements.
export const ROOMS: readonly Room[] = [
  room('balcony', '阳台', -3, 9, -15, -10, 0xa8bfc1, false),
  room('main_bedroom', '主卧', -17, -8, -10, 0, 0xb4b9ab),
  room('closet', '衣帽间', -8, -3, -10, -3, 0xb8abc0, false),
  room('living', '客厅', -3, 9, -10, 5, 0xc5b9a8),
  room('kitchen', '厨房', 9, 15, -12, -2, 0xaabfca),
  room('storage', '储物间', 15, 18, -12, 0, 0xbbb4aa),
  room('dining', '餐厅', 9, 15, -2, 5, 0xc2b8aa),
  room('bathroom', '卫生间', -18, -8, 0, 5, 0xaac4c9),
  room('hall', '主走廊', -8, -3, -3, 5, 0xc0b8ad),
  room('second_bedroom', '次卧', -17, -8, 5, 15, 0xc4b1b8),
  room('study', '书房', -8, 1, 5, 15, 0xb8adc0),
  room('entry', '玄关', 1, 12, 5, 13, 0xbab4a7),
];

const byId = new Map(ROOMS.map(value => [value.id, value]));
const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  [Math.max(a0, b0), Math.min(a1, b1)] as const;

function makeDoor(id: string, aId: string, bId: string): DoorNode {
  const width = SINGLE_DOOR_WIDTH;
  const a = byId.get(aId)!;
  const b = byId.get(bId)!;
  if (a.maxX === b.minX || b.maxX === a.minX) {
    const [start, end] = overlap(a.minZ, a.maxZ, b.minZ, b.maxZ);
    if (end - start <= width) throw new Error(`Door ${id} has insufficient width`);
    return { id, x: a.maxX === b.minX ? a.maxX : b.maxX,
      z: (start + end) / 2, rotation: Math.PI / 2, width,
      initialState: 'CLOSED',
      connectedRoomA: aId, connectedRoomB: bId };
  }
  if (a.maxZ === b.minZ || b.maxZ === a.minZ) {
    const [start, end] = overlap(a.minX, a.maxX, b.minX, b.maxX);
    if (end - start <= width) throw new Error(`Door ${id} has insufficient width`);
    return { id, x: (start + end) / 2,
      z: a.maxZ === b.minZ ? a.maxZ : b.maxZ,
      initialState: 'CLOSED',
      rotation: 0, width, connectedRoomA: aId, connectedRoomB: bId };
  }
  throw new Error(`Door ${id} does not join adjacent rooms`);
}

export const DOOR_NODES: readonly DoorNode[] = [
  makeDoor('door_balcony_living', 'balcony', 'living'),
  makeDoor('door_balcony_kitchen', 'balcony', 'kitchen'),
  makeDoor('door_living_kitchen', 'living', 'kitchen'),
  makeDoor('door_kitchen_storage', 'kitchen', 'storage'),
  makeDoor('door_storage_dining', 'storage', 'dining'),
  makeDoor('door_kitchen_dining', 'kitchen', 'dining'),
  makeDoor('door_living_dining', 'living', 'dining'),
  makeDoor('door_hall_living', 'hall', 'living'),
  makeDoor('door_hall_master', 'hall', 'main_bedroom'),
  makeDoor('door_master_closet', 'main_bedroom', 'closet'),
  makeDoor('door_closet_hall', 'closet', 'hall'),
  makeDoor('door_hall_bathroom', 'hall', 'bathroom'),
  makeDoor('door_bathroom_bedroom2', 'bathroom', 'second_bedroom'),
  makeDoor('door_bedroom2_study', 'second_bedroom', 'study'),
  makeDoor('door_hall_study', 'hall', 'study'),
  makeDoor('door_study_entry', 'study', 'entry'),
  makeDoor('door_living_entry', 'living', 'entry'),
  makeDoor('door_dining_entry', 'dining', 'entry'),
];

const WALL_THICKNESS = 0.18;
export const WALL_HEIGHT = 1.5;
const xs = [...new Set(ROOMS.flatMap(value => [value.minX, value.maxX]))].sort((a, b) => a - b);
const zs = [...new Set(ROOMS.flatMap(value => [value.minZ, value.maxZ]))].sort((a, b) => a - b);
export const roomAt = (x: number, z: number) => ROOMS.find(value =>
  x > value.minX && x < value.maxX && z > value.minZ && z < value.maxZ);

function wallPieces(start: number, end: number, door: DoorNode | undefined,
  vertical: boolean, add: (from: number, to: number) => void): void {
  if (!door) { add(start, end); return; }
  const center = vertical ? door.z : door.x;
  const low = center - door.width / 2;
  const high = center + door.width / 2;
  if (low > start + 0.01) add(start, Math.min(end, low));
  if (high < end - 0.01) add(Math.max(start, high), end);
}

function buildWalls(): Rect[] {
  const result: Rect[] = [];
  const add = (x: number, z: number, width: number, depth: number) => {
    if (width < 0.01 || depth < 0.01) return;
    result.push({ id: `wall_${String(result.length + 1).padStart(3, '0')}`,
      x, z, width, depth, height: WALL_HEIGHT, kind: 'wall' });
  };
  const relevantDoor = (a: Room | undefined, b: Room | undefined,
    coordinate: number, vertical: boolean) => DOOR_NODES.find(door => a && b &&
      ((door.connectedRoomA === a.id && door.connectedRoomB === b.id) ||
       (door.connectedRoomA === b.id && door.connectedRoomB === a.id)) &&
      (vertical ? door.x === coordinate : door.z === coordinate));
  for (const x of xs) for (let index = 0; index < zs.length - 1; index++) {
    const start = zs[index], end = zs[index + 1], z = (start + end) / 2;
    const left = roomAt(x - 0.001, z), right = roomAt(x + 0.001, z);
    if (left?.id === right?.id) continue;
    const door = relevantDoor(left, right, x, true);
    wallPieces(start, end, door, true,
      (from, to) => add(x, (from + to) / 2, WALL_THICKNESS, to - from));
  }
  for (const z of zs) for (let index = 0; index < xs.length - 1; index++) {
    const start = xs[index], end = xs[index + 1], x = (start + end) / 2;
    const top = roomAt(x, z - 0.001), bottom = roomAt(x, z + 0.001);
    if (top?.id === bottom?.id) continue;
    const door = relevantDoor(top, bottom, z, false);
    wallPieces(start, end, door, false,
      (from, to) => add((from + to) / 2, z, to - from, WALL_THICKNESS));
  }
  return result;
}

export const WALLS: readonly Rect[] = buildWalls();

const furnishing = (id: string, x: number, z: number, width: number,
  depth: number, height = 0.65): Rect =>
  ({ id, x, z, width, depth, height, kind: 'furniture' });

export const FURNITURE: readonly Rect[] = [
  furnishing('living_sofa', 0, -3, 2.2, 1.1),
  furnishing('living_coffee_table', 3, -2, 1.2, 1.0, 0.4),
  furnishing('living_tv_cabinet', 6.8, -4.5, 1.5, 0.6),
  furnishing('dining_table', 12, 1.5, 1.8, 1.4, 0.55),
  furnishing('kitchen_counter', 13.7, -8.4, 0.7, 3.0, 0.8),
  furnishing('kitchen_island', 11, -6.3, 1.1, 1.6, 0.75),
  furnishing('kitchen_fridge', 14, -3.6, 0.8, 0.8, 1.2),
  furnishing('storage_shelf', 17.35, -7.5, 0.5, 2.5, 1.0),
  furnishing('main_bed', -13, -5, 2.1, 2.3, 0.45),
  furnishing('main_wardrobe', -16.1, -7.8, 0.6, 2.1, 1.15),
  furnishing('closet_wardrobe', -4.1, -7.6, 0.55, 2.4, 1.1),
  furnishing('bath_sink', -16.4, 2.7, 0.8, 1.0, 0.7),
  furnishing('bath_tub', -11.3, 3.8, 1.7, 0.7, 0.5),
  furnishing('second_bed', -13, 10, 2.1, 2.2, 0.45),
  furnishing('second_cabinet', -16.2, 6.7, 0.6, 1.4, 1.0),
  furnishing('study_desk', -3.1, 9.2, 1.7, 1.0, 0.65),
  furnishing('study_bookshelf', -0.1, 12.1, 0.6, 2.1, 1.1),
  furnishing('entry_bench', 7.1, 11.5, 1.4, 0.6, 0.45),
  // S7C-1A hiding cartons: plain white-box furniture, no formal art. A single
  // row is enough because MapBuilder.addObstacle draws the box, registers the
  // static collider and outlines it under DEBUG_MAP from this data.
  furnishing('living_carton', 7.9, 3.9, 0.9, 0.9, 0.75),
  // Kept on the storage west wall but moved off the authored z = -2.6, where the
  // carton covered the rice_08 marker at (16.1, -3.3) and broke the map test.
  furnishing('storage_carton', 15.7, -4.8, 0.9, 0.9, 0.75),
];

export const RICE_CANDIDATES: readonly MapPoint[] = [
  { id: 'rice_01', roomId: 'balcony', x: 6.8, z: -13.1 },
  { id: 'rice_02', roomId: 'living', x: 0, z: -6 },
  { id: 'rice_03', roomId: 'living', x: 6.2, z: 0.5 },
  { id: 'rice_04', roomId: 'dining', x: 10.5, z: 3.3 },
  { id: 'rice_05', roomId: 'dining', x: 14.1, z: 0.1 },
  { id: 'rice_06', roomId: 'kitchen', x: 10.5, z: -10.4 },
  { id: 'rice_07', roomId: 'kitchen', x: 12.5, z: -3.5 },
  { id: 'rice_08', roomId: 'storage', x: 16.1, z: -3.3 },
  { id: 'rice_09', roomId: 'main_bedroom', x: -15.1, z: -8.2 },
  { id: 'rice_10', roomId: 'closet', x: -6.5, z: -5.2 },
  { id: 'rice_11', roomId: 'bathroom', x: -15, z: 3.4 },
  { id: 'rice_12', roomId: 'second_bedroom', x: -15.1, z: 12.5 },
  { id: 'rice_13', roomId: 'study', x: -6.2, z: 7.1 },
  { id: 'rice_14', roomId: 'hall', x: -6.4, z: 2.9 },
];

export const SPAWNS = {
  deepseek: { id: 'deepseek_spawn', roomId: 'entry', x: 6.2, z: 9.7 },
  human: { id: 'human_spawn', roomId: 'kitchen', x: 10.3, z: -4.4 },
} as const;

export type HideSpotKind = 'WARDROBE' | 'BED' | 'SHELF' | 'CARTON';

export type HideInteractionShape = 'CIRCLE' | 'SECTOR';

// DEV-A round 1: the authored interaction area of one hide spot. This is
// grey-box map authoring data, not a gameplay balance value, so it deliberately
// stays out of GAME_CONFIG (same rule as EDIT_LIMITS in MapEditModel).
//
// - The region centre is always the centre of the bound furniture. It is not
//   stored here: it is looked up through `furnitureId`, so a moved furniture
//   piece moves its region without a second copy of the same coordinate.
// - CIRCLE: radius only.
// - SECTOR: radius plus `halfAngleDeg` at each side of the axis that runs from
//   the furniture centre towards the existing anchor (enter = exit).
// Geometry, legality checks and the discrete sampling preview live in
// `HideInteractionRegion.ts`; this interface only carries authored numbers.
export interface HideInteractionRegion {
  shape: HideInteractionShape;
  radius: number; // world units, measured from the bound furniture centre
  halfAngleDeg?: number; // SECTOR only: half opening angle in degrees (per side)
}

// S7C-1A map configuration only: hide spots are authored data, never a second
// collider or navigation obstacle. `MapPoint.x/z` is the one legal approach
// position (enter = exit) measured against the real actor circle; the furniture
// centre is derived from `furnitureId`, so it is deliberately not stored twice.
// Beds keep their solid 0.45-high collider: `main_bed` / `second_bed` use a
// bed-side anchor and stay presentation-only until a bed-frame collider is
// approved separately.
export interface HideSpot extends MapPoint {
  kind: HideSpotKind;
  furnitureId: string;
  // Radians: atan2(furniture.z - z, furniture.x - x) from the anchor towards
  // the furniture centre, for the presentation layer only.
  facing: number;
  label: string; // DEBUG_MAP marker text only
  // DEV-A round 1: authored interaction area around the bound furniture centre.
  interactionRegion: HideInteractionRegion;
}

export const HIDE_SPOTS: readonly HideSpot[] = [
  { id: 'hide_main_bed', roomId: 'main_bedroom', x: -14.4, z: -6.15, kind: 'BED',
    furnitureId: 'main_bed', facing: 0.6877, label: '主卧床',
    interactionRegion: { shape: 'CIRCLE', radius: 2 } },
  { id: 'hide_second_bed', roomId: 'second_bedroom', x: -14.4, z: 8.9, kind: 'BED',
    furnitureId: 'second_bed', facing: 0.666, label: '次卧床',
    interactionRegion: { shape: 'CIRCLE', radius: 2 } },
  { id: 'hide_main_wardrobe', roomId: 'main_bedroom', x: -16.65, z: -6.6,
    kind: 'WARDROBE', furnitureId: 'main_wardrobe', facing: -1.141, label: '主卧衣柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_closet', roomId: 'closet', x: -3.57, z: -8.8, kind: 'WARDROBE',
    furnitureId: 'closet_wardrobe', facing: 1.9867, label: '衣帽间衣柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_study_bookshelf', roomId: 'study', x: -0.8, z: 11.05, kind: 'SHELF',
    furnitureId: 'study_bookshelf', facing: 0.9828, label: '书房书柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_storage_shelf', roomId: 'storage', x: 16.8, z: -8.75, kind: 'SHELF',
    furnitureId: 'storage_shelf', facing: 1.1563, label: '储物间货架',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_living_carton', roomId: 'living', x: 7, z: 3.6, kind: 'CARTON',
    furnitureId: 'living_carton', facing: 0.3218, label: '客厅纸箱',
    interactionRegion: { shape: 'CIRCLE', radius: 1.2 } },
  { id: 'hide_storage_carton', roomId: 'storage', x: 16.6, z: -4.8, kind: 'CARTON',
    furnitureId: 'storage_carton', facing: 3.1416, label: '储物间纸箱',
    interactionRegion: { shape: 'CIRCLE', radius: 1.2 } },
];

// S7C-1A debug markers. A normal player view must never receive hide spot
// information, so nothing is produced while the debug map labels are disabled.
// `spots` defaults to the authored map so the DEV scene editor can render the
// same marker format for an edited (committed) anchor list.
export function hideSpotDebugMarkers(enabled: boolean,
  spots: readonly HideSpot[] = HIDE_SPOTS):
readonly { x: number; z: number; text: readonly string[] }[] {
  if (!enabled) return [];
  return spots.map(spot => ({ x: spot.x, z: spot.z,
    text: [`${spot.label} ${spot.id}`,
      `${spot.kind} (${spot.x.toFixed(2)}, ${spot.z.toFixed(2)})`] }));
}

export const ROUTE_LOOPS: readonly (readonly string[])[] = [
  ['living', 'dining', 'kitchen', 'living'],
  ['hall', 'main_bedroom', 'closet', 'hall'],
  ['hall', 'bathroom', 'second_bedroom', 'study', 'hall'],
];

export function selectRiceCandidates(random: () => number = Math.random): MapPoint[] {
  const pool = RICE_CANDIDATES.slice(0, GAME_CONFIG.rice.candidateCount);
  if (pool.length !== GAME_CONFIG.rice.candidateCount ||
      ACTIVE_RICE_COUNT < 1 || ACTIVE_RICE_COUNT > pool.length) {
    throw new Error('Rice candidate/active counts exceed the authored map positions');
  }
  for (let index = pool.length - 1; index > 0; index--) {
    const swap = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, ACTIVE_RICE_COUNT);
}
