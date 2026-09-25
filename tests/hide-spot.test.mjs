import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem, distanceToDoorSegment } from '../src/systems/DoorSystem.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH,
  PLAYER_DIAMETER, RICE_CANDIDATES, ROOMS, SPAWNS, WALLS,
  hideSpotDebugMarkers } from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

// S7C-1A checks the authored hide spot data only. No hide gameplay exists yet:
// these tests must pass while every key, rule and number of S7B stays untouched.
const RADIUS = GAME_CONFIG.collision.playerRadius;
const HEIGHT = GAME_CONFIG.three.actorHeight;
const CELL = GAME_CONFIG.humanAI.navCellSize;
const STRICT_RADIUS = PLAYER_DIAMETER / 2;
const FURNITURE_KINDS = ['WARDROBE', 'BED', 'SHELF', 'CARTON'];
const CARTON_IDS = ['living_carton', 'storage_carton'];
const roomById = new Map(ROOMS.map(room => [room.id, room]));
const furnitureById = new Map(FURNITURE.map(rect => [rect.id, rect]));

function apartment(furniture = FURNITURE) {
  const boxes = [...WALLS, ...furniture].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  return { world, nav: new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES),
    doors: new DoorSystem(DOOR_NODES, 3) };
}

// Same convention as tests/apartment-map.test.mjs: the visual half-width is
// slightly wider than the gameplay radius, so this is the stricter standing test.
const free = (x, z, furniture = FURNITURE) => {
  const inRoom = ROOMS.some(room => x > room.minX + STRICT_RADIUS &&
    x < room.maxX - STRICT_RADIUS && z > room.minZ + STRICT_RADIUS &&
    z < room.maxZ - STRICT_RADIUS);
  const inDoor = DOOR_NODES.some(door => door.rotation === 0
    ? Math.abs(z - door.z) <= STRICT_RADIUS &&
      Math.abs(x - door.x) < door.width / 2 - STRICT_RADIUS
    : Math.abs(x - door.x) <= STRICT_RADIUS &&
      Math.abs(z - door.z) < door.width / 2 - STRICT_RADIUS);
  return (inRoom || inDoor) && ![...WALLS, ...furniture].some(rect =>
    Math.abs(x - rect.x) <= rect.width / 2 + STRICT_RADIUS &&
    Math.abs(z - rect.z) <= rect.depth / 2 + STRICT_RADIUS);
};

const gapToRect = (x, z, rect) => Math.hypot(
  Math.max(0, Math.abs(x - rect.x) - rect.width / 2),
  Math.max(0, Math.abs(z - rect.z) - rect.depth / 2));

const doorApproaches = door => door.rotation === 0
  ? [[door.x, door.z - PLAYER_DIAMETER], [door.x, door.z + PLAYER_DIAMETER]]
  : [[door.x - PLAYER_DIAMETER, door.z], [door.x + PLAYER_DIAMETER, door.z]];

const wrapAngle = value => Math.atan2(Math.sin(value), Math.cos(value));

test('eight hide spots carry a unique id, room, kind, furniture binding and facing', () => {
  assert.equal(HIDE_SPOTS.length, 8);
  assert.equal(new Set(HIDE_SPOTS.map(spot => spot.id)).size, 8);
  assert.equal(new Set(HIDE_SPOTS.map(spot => spot.furnitureId)).size, 8);
  assert.equal(new Set(HIDE_SPOTS.map(spot => spot.label)).size, 8);
  assert.equal(new Set(HIDE_SPOTS.map(spot => spot.kind)).size, 4);
  for (const spot of HIDE_SPOTS) {
    assert.ok(roomById.has(spot.roomId), spot.id);
    assert.ok(FURNITURE_KINDS.includes(spot.kind), spot.id);
    assert.ok(furnitureById.has(spot.furnitureId), spot.id);
    assert.ok(Number.isFinite(spot.facing), spot.id);
    assert.ok(spot.label.length > 0, spot.id);
    const family = spot.furnitureId.replace(/^.*_/, '');
    const expected = spot.kind === 'BED' ? ['bed']
      : spot.kind === 'WARDROBE' ? ['wardrobe']
      : spot.kind === 'SHELF' ? ['bookshelf', 'shelf'] : ['carton'];
    assert.ok(expected.includes(family), `${spot.id} -> ${spot.furnitureId}`);
  }
});

test('facing points from every anchor towards its bound furniture centre', () => {
  for (const spot of HIDE_SPOTS) {
    const furniture = furnitureById.get(spot.furnitureId);
    const expected = Math.atan2(furniture.z - spot.z, furniture.x - spot.x);
    assert.ok(Math.abs(wrapAngle(spot.facing - expected)) < 0.001, spot.id);
  }
});

test('every anchor sits inside its room and leaves the real actor circle standing room', () => {
  const { world } = apartment();
  for (const spot of HIDE_SPOTS) {
    const room = roomById.get(spot.roomId);
    assert.ok(spot.x > room.minX + 0.05 && spot.x < room.maxX - 0.05 &&
      spot.z > room.minZ + 0.05 && spot.z < room.maxZ - 0.05,
      `${spot.id} must sit inside ${spot.roomId}`);
    assert.equal(world.canOccupyStaticXZ(spot.x, spot.z, RADIUS, HEIGHT), true,
      `${spot.id} anchor must be standable`);
    // A hide spot never becomes a collider of its own: the anchor must stay
    // outside every authored wall and furniture box.
    for (const rect of [...WALLS, ...FURNITURE]) {
      assert.ok(gapToRect(spot.x, spot.z, rect) >= 0.05,
        `${spot.id} anchor overlaps ${rect.id}`);
    }
    assert.ok(gapToRect(spot.x, spot.z, furnitureById.get(spot.furnitureId)) >= 0.05,
      `${spot.id} anchor must clear its furniture`);
  }
});

test('no anchor competes with door interaction or rice eating', () => {
  for (const spot of HIDE_SPOTS) {
    const doorGap = Math.min(...DOOR_NODES.map(door =>
      distanceToDoorSegment(spot.x, spot.z, door)));
    assert.ok(doorGap >= 2, `${spot.id} is ${doorGap.toFixed(2)} from a door`);
    const riceGap = Math.min(...RICE_CANDIDATES.map(point =>
      Math.hypot(point.x - spot.x, point.z - spot.z)));
    assert.ok(riceGap >= 1.2, `${spot.id} is ${riceGap.toFixed(2)} from a rice point`);
    // E opens the minesweeper, then a door, then a hide spot, then eating; the
    // anchor must not sit inside the rice interaction range at all.
    assert.ok(riceGap > GAME_CONFIG.rice.interactionRange /
      GAME_CONFIG.three.pixelsPerUnit, spot.id);
  }
});

test('every anchor is reachable from both faction spawns through the shared navigation grid', () => {
  const { nav, doors } = apartment();
  for (const spot of HIDE_SPOTS) {
    const cell = nav.nearestFree(spot, doors.doors);
    assert.ok(cell, `${spot.id} has no usable navigation cell`);
    const cellGap = Math.hypot(cell.x - spot.x, cell.z - spot.z);
    assert.ok(cellGap <= 0.45, `${spot.id} snaps ${cellGap.toFixed(2)} to a cell`);
    for (const spawn of Object.values(SPAWNS)) {
      const path = nav.findPath(spawn, spot, doors.doors);
      assert.ok(path?.length, `${spot.id} is unreachable from ${spawn.id}`);
    }
  }
});

test('the two cartons are plain white-box furniture inside their own room', () => {
  assert.equal(FURNITURE.length, 20);
  assert.deepEqual(FURNITURE.filter(rect => rect.id.includes('carton'))
    .map(rect => rect.id), CARTON_IDS);
  for (const id of CARTON_IDS) {
    const carton = furnitureById.get(id);
    assert.ok(carton, id);
    assert.equal(carton.kind, 'furniture');
    assert.deepEqual([carton.width, carton.depth, carton.height], [0.9, 0.9, 0.75]);
    const spot = HIDE_SPOTS.find(value => value.furnitureId === id);
    const room = roomById.get(spot.roomId);
    assert.ok(carton.x - carton.width / 2 > room.minX &&
      carton.x + carton.width / 2 < room.maxX &&
      carton.z - carton.depth / 2 > room.minZ &&
      carton.z + carton.depth / 2 < room.maxZ, `${id} must stay inside ${room.id}`);
    for (const rect of [...WALLS, ...FURNITURE]) {
      if (rect.id === id) continue;
      const overlapX = Math.abs(carton.x - rect.x) < carton.width / 2 + rect.width / 2;
      const overlapZ = Math.abs(carton.z - rect.z) < carton.depth / 2 + rect.depth / 2;
      assert.ok(!(overlapX && overlapZ), `${id} overlaps ${rect.id}`);
    }
  }
});

test('the two cartons block no door, no door approach and no rice marker', () => {
  for (const id of CARTON_IDS) {
    const carton = furnitureById.get(id);
    const covers = (x, z) => Math.abs(x - carton.x) <= carton.width / 2 + STRICT_RADIUS &&
      Math.abs(z - carton.z) <= carton.depth / 2 + STRICT_RADIUS;
    for (const point of RICE_CANDIDATES) {
      assert.equal(covers(point.x, point.z), false, `${id} covers ${point.id}`);
    }
    for (const door of DOOR_NODES) {
      assert.equal(covers(door.x, door.z), false, `${id} covers ${door.id}`);
      for (const [x, z] of doorApproaches(door)) {
        assert.equal(covers(x, z), false, `${id} covers an approach of ${door.id}`);
      }
    }
  }
  for (const door of DOOR_NODES) {
    assert.ok(free(door.x, door.z), `${door.id} blocked`);
    for (const [x, z] of doorApproaches(door)) {
      assert.ok(free(x, z), `${door.id} approach blocked`);
    }
  }
});

// Nav grid cells reachable from the human spawn, with a mid-edge sample so a
// thin squeeze between two free centres cannot be counted as a passage.
function reachableCells(furniture) {
  const { world } = apartment(furniture);
  const columns = Math.ceil(MAP_WIDTH / CELL), rows = Math.ceil(MAP_DEPTH / CELL);
  const centre = (ix, iz) => ({ ix, iz,
    x: -MAP_WIDTH / 2 + (ix + 0.5) * CELL,
    z: -MAP_DEPTH / 2 + (iz + 0.5) * CELL });
  const key = cell => `${cell.ix},${cell.iz}`;
  const freeCells = new Set();
  for (let ix = 0; ix < columns; ix++) for (let iz = 0; iz < rows; iz++) {
    const cell = centre(ix, iz);
    if (world.canOccupyStaticXZ(cell.x, cell.z, RADIUS, HEIGHT)) freeCells.add(key(cell));
  }
  const start = centre(Math.round((SPAWNS.human.x + MAP_WIDTH / 2 - CELL / 2) / CELL),
    Math.round((SPAWNS.human.z + MAP_DEPTH / 2 - CELL / 2) / CELL));
  assert.ok(freeCells.has(key(start)), 'human spawn cell must be free');
  const reached = new Set([key(start)]);
  const queue = [start];
  for (const current of queue) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const next = centre(current.ix + dx, current.iz + dz);
    if (!freeCells.has(key(next)) || reached.has(key(next))) continue;
    if (!world.canOccupyStaticXZ((current.x + next.x) / 2, (current.z + next.z) / 2,
      RADIUS, HEIGHT)) continue;
    reached.add(key(next));
    queue.push(next);
  }
  return { freeCells, reached };
}

test('the two cartons never cut apart space that is still walkable without them', () => {
  const withCartons = reachableCells(FURNITURE);
  const withoutCartons = reachableCells(
    FURNITURE.filter(rect => !CARTON_IDS.includes(rect.id)));
  const orphaned = [...withoutCartons.reached].filter(key =>
    withCartons.freeCells.has(key) && !withCartons.reached.has(key));
  assert.deepEqual(orphaned, [], 'cartons must not isolate a still-free cell');
  assert.ok(withoutCartons.reached.size > withCartons.reached.size,
    'cartons must actually remove some standing space');
  for (const room of ROOMS) {
    const inside = [...withCartons.reached].filter(key => {
      const [ix, iz] = key.split(',').map(Number);
      const x = -MAP_WIDTH / 2 + (ix + 0.5) * CELL, z = -MAP_DEPTH / 2 + (iz + 0.5) * CELL;
      return x > room.minX + PLAYER_DIAMETER && x < room.maxX - PLAYER_DIAMETER &&
        z > room.minZ + PLAYER_DIAMETER && z < room.maxZ - PLAYER_DIAMETER;
    });
    assert.ok(inside.length, `${room.id} has no reachable interior`);
  }
  for (const point of RICE_CANDIDATES) {
    assert.ok(free(point.x, point.z), `${point.id} is blocked`);
  }
  const { nav, doors } = apartment();
  for (const point of RICE_CANDIDATES) {
    assert.ok(nav.findPath(SPAWNS.human, point, doors.doors), `${point.id} unreachable`);
  }
});

test('hide spot debug markers exist only while the debug labels are enabled', () => {
  assert.deepEqual(hideSpotDebugMarkers(false), []);
  const markers = hideSpotDebugMarkers(true);
  assert.equal(markers.length, HIDE_SPOTS.length);
  markers.forEach((marker, index) => {
    const spot = HIDE_SPOTS[index];
    assert.equal(marker.x, spot.x);
    assert.equal(marker.z, spot.z);
    assert.equal(marker.text.length, 2);
    assert.ok(marker.text[0].includes(spot.id), spot.id);
    assert.ok(marker.text[0].includes(spot.label), spot.id);
    assert.ok(marker.text[1].includes(spot.kind), spot.id);
    assert.ok(marker.text[1].includes(spot.x.toFixed(2)), spot.id);
    assert.ok(marker.text[1].includes(spot.z.toFixed(2)), spot.id);
  });
});
