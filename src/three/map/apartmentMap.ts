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
  // DEV-A-FIX-2: rotation of the footprint around its centre, in radians with Y
  // up (same sign as THREE.Object3D.rotation.y). Missing means 0, so walls and
  // every authored furniture entry keep their exact axis-aligned meaning. See
  // `RotatedRect.ts` for the shared geometry.
  rotation?: number;
}
export interface DoorNode extends Point {
  id: string; rotation: number; width: number;
  initialState: 'OPEN' | 'CLOSED';
  connectedRoomA: string; connectedRoomB: string;
}
export interface MapPoint extends Point { id: string; roomId: string }

// 2026-10-04 区域级放大（第二轮地图扩建）：**没有新增房间**（仍是 18 个），
// 而是把上一轮（东翼扩建）之后的合理拓扑整张平面**按区域放大**。
//
// 做法：把旧网格线（由 ROOMS 的 min/max 唯一化得到）逐条映射到一组新的、
// 等比拉开约 1.33 倍的网格线上。每个房间仍然由**同一组网格线下标区间**定义，
// 所以 18 个房间的类型、邻接关系、门配对、环路、东翼结构**逐条保持不变**，
// 变的只是每段区间有多长。
//
// 这不是 uniform scale：走廊（旧 3 宽）放大到 4、储物间 3→4、北阳台 3→4，
// 而客厅 12×15 → 16×20.5、主卧 9×10 → 12×14。家具**不跟着放大**，仍是同一
// 套人物比例的尺寸，因此放大的面积全部变成可活动空间。
//
// 旧图 X `-18…24` 的中心是 `+3`，世界盒却被逼成 `-24…24`，于是西侧多出
// `x ∈ [-24,-18]` 一段被外墙封死的不可达余量。本轮把平面**重新以原点为中心**
// （X `-28…28`、Z `-20…20`），这段浪费被收回。
//
// 世界盒必须保持原点对称：`CollisionWorld` / `NavigationSystem` 只接受
// halfWidth / halfDepth，没有中心偏移参数。所以 `MAP_WIDTH = 56` 就是 X ±28、
// `MAP_DEPTH = 38` 就是 Z ±19，住宅外接框正好贴住盒边（与上一轮同样的口径）。
//
// 为什么深度是 38 而不是 40：只读顾问 Codex 审查后指出，各区域倍率若一律
// ≈1.33 就退化成「机械统一缩放」，而且总面积倍率 1.78 已是固定移动 / 视野 /
// 感知数值下的上沿。于是把两端**只服务附属空间与走廊端点**的两段各收 0.5：
// 北端 `t0`(阳台/北阳台进深) 4→3.5、`t1`(阳台-厨房带) 2.5→2.0；南端
// `t8`(卧室横排进深) 10.5→10、`t9`(玄关与卧室排的差) 2.5→2.0。
// 结果是中间的房间几乎不动，而阳台、北阳台、次卧、书房、南走廊、东走廊、
// 玄关、车库明显少放大——倍率区间从 1.71–1.87 拉成 1.47–1.87，总面积倍率
// 降到 1.71。主客厅 / 主卧 / 厨房 / 储物间仍保持上档。
export const MAP_WIDTH = 56;
export const MAP_DEPTH = 38;
export const DEBUG_MAP = true;
export const ACTIVE_RICE_COUNT = GAME_CONFIG.rice.activeCount;
export const PLAYER_DIAMETER = GAME_CONFIG.player.size / GAME_CONFIG.three.pixelsPerUnit;
export const MIN_DOOR_WIDTH = PLAYER_DIAMETER * 2;
// S6B residential single-leaf opening. It remains over two actor widths while
// presenting a distinctly narrow, domestic door silhouette.
// 房间放大后门**没有跟着放大**：1.2 现在相对房间更小，所以同一面墙上两扇门
// 自然拉开得更远，门也不再紧贴墙角。
export const SINGLE_DOOR_WIDTH = 1.2;

const room = (id: string, name: string, minX: number, maxX: number,
  minZ: number, maxZ: number, color: number, major = true): Room => ({
  id, name, minX, maxX, minZ, maxZ, color, major,
  x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
  width: maxX - minX, depth: maxZ - minZ,
});

// Based on the left-hand apartment plan in 场景图.png. Balcony, closet and north
// balcony remain distinct auxiliary spaces, alongside fifteen main spaces. All
// dimensions are widened for pursuit; these are not real-world measurements.
//
// 2026-10-04 区域级放大。新 X 网格线：-28 / -26.5 / -14.5 / -8 / -2.5 / 8 / 12 /
// 16 / 20 / 28；新 Z 网格线：-19 / -15.5 / -13.5 / -5 / -3.5 / -2 / 0.5 / 4.5 /
// 7 / 17 / 19。旧→新下标一一对应，所以下表里每个房间的「邻居」与上一轮完全一致。
//
// 面积（世界单位²）：1143 → 1950（×1.71）；住宅外接框 42×30 → 56×38。
export const ROOMS: readonly Room[] = [
  room('balcony', '阳台', -8, 8, -19, -13.5, 0xa8bfc1, false),
  room('main_bedroom', '主卧', -26.5, -14.5, -13.5, 0.5, 0xb4b9ab),
  room('closet', '衣帽间', -14.5, -8, -13.5, -3.5, 0xb8abc0, false),
  room('living', '客厅', -8, 8, -13.5, 7, 0xc5b9a8),
  room('kitchen', '厨房', 8, 16, -15.5, -2, 0xaabfca),
  room('storage', '储物间', 16, 20, -15.5, 0.5, 0xbbb4aa),
  room('dining', '餐厅', 8, 16, -2, 7, 0xc2b8aa),
  room('bathroom', '卫生间', -28, -14.5, 0.5, 7, 0xaac4c9),
  room('hall', '主走廊', -14.5, -8, -3.5, 7, 0xc0b8ad),
  room('second_bedroom', '次卧', -26.5, -14.5, 7, 19, 0xc4b1b8),
  room('study', '书房', -14.5, -2.5, 7, 19, 0xb8adc0),
  room('entry', '玄关', -2.5, 12, 7, 17, 0xbab4a7),
  room('north_balcony', '北阳台', 8, 20, -19, -15.5, 0xa8bfc1, false),
  room('south_hall', '南走廊', 12, 16, 7, 19, 0xc0b8ad),
  room('east_hall', '东走廊', 16, 20, 0.5, 19, 0xc0b8ad),
  room('guest_room', '客房', 20, 28, -19, -5, 0xc4b1b8),
  room('utility', '家政间', 20, 28, -5, 4.5, 0xaabfca),
  room('garage', '车库', 20, 28, 4.5, 19, 0xb9b3a6),
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

// 31 扇门，配对与上一轮**逐条相同**（因此邻接图、环路与环边连通度不变）。
// 门中心仍然由 `makeDoor` 取共享边中点，所以房间一放大，门与门的距离就自然拉开；
// 最窄的共享边是 balcony↔kitchen 与 storage↔dining 的 2.5（旧图是 1.6/2.5），
// 门叶两侧都还剩 0.65 的墙垛，不会贴墙角。
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
  // 东翼（上一轮建立）的 13 扇门，拓扑完全保留。
  makeDoor('door_balcony_north_balcony', 'balcony', 'north_balcony'),
  makeDoor('door_north_balcony_kitchen', 'north_balcony', 'kitchen'),
  makeDoor('door_north_balcony_storage', 'north_balcony', 'storage'),
  makeDoor('door_north_balcony_guest_room', 'north_balcony', 'guest_room'),
  makeDoor('door_entry_south_hall', 'entry', 'south_hall'),
  makeDoor('door_south_hall_east_hall', 'south_hall', 'east_hall'),
  makeDoor('door_dining_south_hall', 'dining', 'south_hall'),
  makeDoor('door_dining_east_hall', 'dining', 'east_hall'),
  makeDoor('door_storage_east_hall', 'storage', 'east_hall'),
  makeDoor('door_guest_room_utility', 'guest_room', 'utility'),
  makeDoor('door_utility_east_hall', 'utility', 'east_hall'),
  makeDoor('door_utility_garage', 'utility', 'garage'),
  makeDoor('door_garage_east_hall', 'garage', 'east_hall'),
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
  // Walls are generated band by band, so one straight run of wall arrives as
  // several touching pieces. `MapBuilder` renders a wall by scaling its SHORT
  // axis (`HOME_COMPOSITION.wallThicknessScale`), so a piece shorter than the
  // wall thickness would be widened along its length instead — that spills up to
  // 0.06 into the neighbouring doorway and makes the door frame clip the wall.
  // Merging every touching run on the same centreline removes those degenerate
  // stubs (and any duplicate) without changing where any wall actually is.
  const lines = new Map<string, { vertical: boolean; coord: number; from: number; to: number }[]>();
  const add = (vertical: boolean, coordinate: number, from: number, to: number) => {
    if (to - from < 0.01) return;
    const key = `${vertical ? 'v' : 'h'}:${coordinate}`;
    const list = lines.get(key) ?? [];
    if (!lines.has(key)) lines.set(key, list);
    list.push({ vertical, coord: coordinate, from, to });
  };
  const result: Rect[] = [];
  const flush = () => {
    for (const list of lines.values()) {
      list.sort((a, b) => a.from - b.from);
      let start = list[0].from, end = list[0].to;
      const emit = () => {
        result.push({ id: `wall_${String(result.length + 1).padStart(3, '0')}`,
          x: list[0].vertical ? list[0].coord : (start + end) / 2,
          z: list[0].vertical ? (start + end) / 2 : list[0].coord,
          width: list[0].vertical ? WALL_THICKNESS : end - start,
          depth: list[0].vertical ? end - start : WALL_THICKNESS,
          height: WALL_HEIGHT, kind: 'wall' });
      };
      for (const piece of list.slice(1)) {
        if (piece.from <= end + 1e-9) { end = Math.max(end, piece.to); continue; }
        emit(); start = piece.from; end = piece.to;
      }
      emit();
    }
    lines.clear();
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
      (from, to) => add(true, x, from, to));
  }
  for (const z of zs) for (let index = 0; index < xs.length - 1; index++) {
    const start = xs[index], end = xs[index + 1], x = (start + end) / 2;
    const top = roomAt(x, z - 0.001), bottom = roomAt(x, z + 0.001);
    if (top?.id === bottom?.id) continue;
    const door = relevantDoor(top, bottom, z, false);
    wallPieces(start, end, door, false,
      (from, to) => add(false, z, from, to));
  }
  flush();
  return result;
}

export const WALLS: readonly Rect[] = buildWalls();

const furnishing = (id: string, x: number, z: number, width: number,
  depth: number, height = 0.65): Rect =>
  ({ id, x, z, width, depth, height, kind: 'furniture' });

// 家具**尺寸一个都没有放大**（仍是同一套人物比例的白模）。房间扩大后，同一件
// 家具相对房间更小，家具间距、留白与动线随之变大；只有极少数位置为了让大房间
// 不至于空荡补了几件普通家具（`_nightstand` / `_dresser` / `_shelf` / `_rack` /
// `_toilet` / `_desk` / `_shoe_rack` / `_desk(guest)`），它们都不绑定藏身点。
// 所有家具仍留在白模合法范围内（宽/深 0.2–4、高 0.1–1.6），也都不压门洞与门的
// 接近点。
export const FURNITURE: readonly Rect[] = [
  furnishing('living_sofa', 1.2, -2.6, 2.2, 1.1),
  furnishing('living_coffee_table', 4.3, -2.6, 1.2, 1.0, 0.4),
  furnishing('living_tv_cabinet', 7.5, -2.6, 0.6, 1.5),
  furnishing('dining_table', 12, 2, 1.8, 1.4, 0.55),
  furnishing('kitchen_counter', 15.55, -13, 0.7, 3.0, 0.8),
  furnishing('kitchen_island', 11.5, -11.5, 1.1, 1.6, 0.75),
  furnishing('kitchen_fridge', 15.5, -6, 0.8, 0.8, 1.2),
  furnishing('storage_shelf', 19.5, -6, 0.5, 2.5, 1.0),
  furnishing('main_bed', -21.5, -6.5, 2.1, 2.3, 0.45),
  furnishing('main_wardrobe', -26, -10, 0.6, 2.1, 1.15),
  furnishing('closet_wardrobe', -8.6, -9.5, 0.55, 2.4, 1.1),
  furnishing('bath_sink', -27.4, 2.5, 0.8, 1.0, 0.7),
  furnishing('bath_tub', -22, 6.2, 1.7, 0.7, 0.5),
  furnishing('second_bed', -21.5, 12.5, 2.1, 2.2, 0.45),
  furnishing('second_cabinet', -25.9, 9.5, 0.6, 1.4, 1.0),
  furnishing('study_desk', -3.8, 9.5, 1.7, 1.0, 0.65),
  furnishing('study_bookshelf', -8, 18.4, 2.1, 0.6, 1.1),
  furnishing('entry_bench', 7.5, 16.4, 1.4, 0.6, 0.45),
  // S7C-1A hiding cartons: plain white-box furniture, no formal art. A single
  // row is enough because MapBuilder.addObstacle draws the box, registers the
  // static collider and outlines it under DEBUG_MAP from this data.
  furnishing('living_carton', -5.4, -9.6, 0.9, 0.9, 0.75),
  furnishing('storage_carton', 16.7, -12.5, 0.9, 0.9, 0.75),
  // 东翼家具（上一轮新增，本轮只搬到放大后的坐标；尺寸未变）。
  furnishing('north_balcony_washer', 10.5, -18.2, 0.8, 0.8, 0.85),
  furnishing('north_balcony_rack', 15.5, -18.3, 1.6, 0.5, 1.1),
  furnishing('south_hall_console', 12.55, 17, 0.5, 1.2, 0.8),
  furnishing('east_hall_console', 16.55, 17.5, 0.5, 1.2, 0.8),
  furnishing('guest_bed', 22, -12.5, 2.1, 2.3, 0.45),
  furnishing('guest_wardrobe', 27.3, -17, 0.6, 2.4, 1.1),
  furnishing('utility_counter', 27.3, -1, 0.7, 3, 0.8),
  furnishing('utility_shelf', 21, 3.9, 1.2, 0.5, 1.0),
  furnishing('utility_washer', 20.8, -4.2, 0.8, 0.8, 0.85),
  // A single parked car is the one large free-standing obstacle of the east wing:
  // it splits the garage into a west lane and an east aisle for pursuit.
  // 深度必须留在场景编辑器的白模合法范围内（宽/深 0.2–4、高 0.1–1.6），
  // 否则 `validateEditedMap()` 会否决整张授权地图，所有编辑/存档链路一起失败。
  furnishing('garage_car', 22.6, 12, 1.9, 3.8, 1.1),
  furnishing('garage_workbench', 27.3, 6.5, 0.7, 2.6, 0.9),
  furnishing('garage_shelf', 27.4, 17, 0.5, 2.6, 1.0),
  // 2026-10-04 区域级放大时补的普通家具：让放大后的卧室 / 衣帽间 / 储物间 /
  // 卫生间 / 玄关 / 客房不至于空荡，同时给追逐提供更多可绕行的家具岛。
  // 全部不绑定藏身点，也全部避开门的接近点。
  furnishing('main_nightstand', -23.1, -6.5, 0.6, 0.6, 0.5),
  furnishing('main_dresser', -25.9, -5, 0.5, 1.0, 0.95),
  furnishing('closet_shelf', -13.9, -6.5, 0.5, 2.0, 1.0),
  furnishing('storage_rack', 19.5, -13.5, 0.5, 2.0, 1.0),
  furnishing('bath_toilet', -25, 6.2, 0.6, 0.7, 0.6),
  furnishing('second_desk', -19, 18.4, 1.4, 0.6, 0.65),
  furnishing('entry_shoe_rack', 11.3, 15.5, 0.5, 1.2, 0.9),
  furnishing('guest_desk', 20.7, -7.5, 0.6, 1.2, 0.65),
];

export const RICE_CANDIDATES: readonly MapPoint[] = [
  { id: 'rice_01', roomId: 'balcony', x: 4.5, z: -17 },
  { id: 'rice_02', roomId: 'living', x: 3.4, z: 4.4 },
  { id: 'rice_03', roomId: 'guest_room', x: 24.5, z: -8 },
  { id: 'rice_04', roomId: 'dining', x: 10.2, z: 4.2 },
  { id: 'rice_05', roomId: 'utility', x: 24.3, z: 0.6 },
  { id: 'rice_06', roomId: 'kitchen', x: 11, z: -5.5 },
  { id: 'rice_07', roomId: 'garage', x: 21.5, z: 7 },
  { id: 'rice_08', roomId: 'storage', x: 17.4, z: -2.6 },
  { id: 'rice_09', roomId: 'main_bedroom', x: -18.5, z: -11 },
  { id: 'rice_10', roomId: 'closet', x: -12.6, z: -6 },
  { id: 'rice_11', roomId: 'bathroom', x: -17.5, z: 3.6 },
  { id: 'rice_12', roomId: 'second_bedroom', x: -18, z: 16 },
  { id: 'rice_13', roomId: 'study', x: -6, z: 12 },
  { id: 'rice_14', roomId: 'hall', x: -11.25, z: 1 },
];

export const SPAWNS = {
  deepseek: { id: 'deepseek_spawn', roomId: 'entry', x: 7, z: 11 },
  // 2026-10-04：默认出生点跟着放大后的厨房南移。放大后 entry↔kitchen 的默认
  // 间距从 14.7 涨到 18.3，已经超过 `perception.sounds.FOOTSTEP.range`(17)——
  // 默认这一对出生点会互相听不到脚步声。移到厨房南端后间距 15.5，仍在
  // `matchRandom.minSpawnDistance`(10) 之上，也仍在脚步声可听范围内。
  human: { id: 'human_spawn', roomId: 'kitchen', x: 12.5, z: -3.5 },
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

// 2026-10-04：藏身点仍是用户批准过的 **8 个**，ID、kind、绑定家具、DEV-A 交互
// 区域参数（圆形 2.0 / 1.2、扇形 1.6·55°）一个都没改。房间放大后，锚点跟着
// 各自绑定的家具搬到新位置，`facing` 按同一公式重算。新翼仍然**没有**藏身点：
// 藏身点数量直接决定 DeepSeek 娘的候选强度与 Human 搜查负担，属于平衡决策，
// 留给用户单独拍板。
export const HIDE_SPOTS: readonly HideSpot[] = [
  { id: 'hide_main_bed', roomId: 'main_bedroom', x: -22.9, z: -7.65, kind: 'BED',
    furnitureId: 'main_bed', facing: 0.68767, label: '主卧床',
    interactionRegion: { shape: 'CIRCLE', radius: 2 } },
  { id: 'hide_second_bed', roomId: 'second_bedroom', x: -22.9, z: 11.4, kind: 'BED',
    furnitureId: 'second_bed', facing: 0.66597, label: '次卧床',
    interactionRegion: { shape: 'CIRCLE', radius: 2 } },
  { id: 'hide_main_wardrobe', roomId: 'main_bedroom', x: -25.15, z: -9.5,
    kind: 'WARDROBE', furnitureId: 'main_wardrobe', facing: -2.60987, label: '主卧衣柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_closet', roomId: 'closet', x: -9.2, z: -10.7, kind: 'WARDROBE',
    furnitureId: 'closet_wardrobe', facing: 1.10715, label: '衣帽间衣柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_study_bookshelf', roomId: 'study', x: -8.7, z: 17.35, kind: 'SHELF',
    furnitureId: 'study_bookshelf', facing: 0.98279, label: '书房书柜',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_storage_shelf', roomId: 'storage', x: 18.6, z: -5, kind: 'SHELF',
    furnitureId: 'storage_shelf', facing: -0.83794, label: '储物间货架',
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 } },
  { id: 'hide_living_carton', roomId: 'living', x: -5.4, z: -8.6, kind: 'CARTON',
    furnitureId: 'living_carton', facing: -1.5708, label: '客厅纸箱',
    interactionRegion: { shape: 'CIRCLE', radius: 1.2 } },
  { id: 'hide_storage_carton', roomId: 'storage', x: 17.75, z: -12.5, kind: 'CARTON',
    furnitureId: 'storage_carton', facing: 3.14159, label: '储物间纸箱',
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

// 环路声明与上一轮完全相同（6 条）：房间放大不改变任何一条边的存在性。
export const ROUTE_LOOPS: readonly (readonly string[])[] = [
  ['living', 'dining', 'kitchen', 'living'],
  ['hall', 'main_bedroom', 'closet', 'hall'],
  ['hall', 'bathroom', 'second_bedroom', 'study', 'hall'],
  ['entry', 'south_hall', 'east_hall', 'dining', 'entry'],
  ['east_hall', 'utility', 'guest_room', 'north_balcony', 'storage', 'east_hall'],
  ['living', 'kitchen', 'north_balcony', 'balcony', 'living'],
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
