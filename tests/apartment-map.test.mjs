import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTIVE_RICE_COUNT, DOOR_NODES, FURNITURE, HIDE_SPOTS,
  MAP_WIDTH, MAP_DEPTH, MIN_DOOR_WIDTH, PLAYER_DIAMETER, RICE_CANDIDATES,
  ROOMS, ROUTE_LOOPS, SINGLE_DOOR_WIDTH, SPAWNS, WALL_HEIGHT, WALLS, selectRiceCandidates
} from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { RiceField } from '../src/systems/RiceField.ts';

const roomIds = new Set(ROOMS.map(room => room.id));
const byId = new Map(ROOMS.map(room => [room.id, room]));
const edgeId = (a, b) => [a, b].sort().join(':');
const edges = new Set(DOOR_NODES.map(door => edgeId(door.connectedRoomA, door.connectedRoomB)));

const free = (x, z) => {
  const radius = PLAYER_DIAMETER / 2;
  const inRoom = ROOMS.some(room => x > room.minX + radius && x < room.maxX - radius &&
    z > room.minZ + radius && z < room.maxZ - radius);
  const inDoor = DOOR_NODES.some(door => door.rotation === 0
    ? Math.abs(z - door.z) <= radius && Math.abs(x - door.x) < door.width / 2 - radius
    : Math.abs(x - door.x) <= radius && Math.abs(z - door.z) < door.width / 2 - radius);
  return (inRoom || inDoor) && ![...WALLS, ...FURNITURE].some(rect =>
    Math.abs(x - rect.x) <= rect.width / 2 + radius &&
    Math.abs(z - rect.z) <= rect.depth / 2 + radius);
};

test('reference floorplan keeps ten main spaces plus balcony and closet in their stated positions', () => {
  assert.equal(ROOMS.filter(room => room.major).length, 10);
  assert.equal(ROOMS.length, 12);
  assert.equal(roomIds.size, ROOMS.length);
  const at = id => byId.get(id);
  assert.ok(at('balcony').z < at('living').z);
  assert.ok(at('living').x > at('hall').x);
  assert.ok(at('dining').x > at('living').x && at('dining').z > at('living').z);
  assert.ok(at('kitchen').x > at('living').x && at('kitchen').z < at('dining').z);
  assert.ok(at('storage').x > at('kitchen').x);
  assert.ok(at('main_bedroom').x < at('living').x && at('main_bedroom').z < at('hall').z);
  assert.ok(at('closet').x > at('main_bedroom').x);
  assert.ok(at('bathroom').x < at('hall').x && at('bathroom').z > at('main_bedroom').z);
  assert.ok(at('second_bedroom').x < at('study').x && at('second_bedroom').z > at('bathroom').z);
  assert.ok(at('entry').x > at('study').x && at('entry').z > at('living').z);
  assert.ok(new Set(ROOMS.map(room => `${room.width}x${room.depth}`)).size >= 8);
  assert.ok(at('living').width * at('living').depth > at('dining').width * at('dining').depth);
  assert.equal(MAP_WIDTH, 36);
  assert.equal(MAP_DEPTH, 30);
});

test('fourteen candidate nodes sample five unique rice and both faction spawns are valid', () => {
  assert.equal(RICE_CANDIDATES.length, 14);
  assert.equal(new Set(RICE_CANDIDATES.map(point => point.id)).size, 14);
  for (const point of [...RICE_CANDIDATES, ...HIDE_SPOTS, ...Object.values(SPAWNS)]) {
    const room = atRoom(point.roomId);
    assert.ok(room, point.id);
    assert.ok(point.x > room.minX && point.x < room.maxX &&
      point.z > room.minZ && point.z < room.maxZ, point.id);
  }
  assert.notEqual(SPAWNS.deepseek.roomId, SPAWNS.human.roomId);
  for (let run = 0; run < 100; run++) {
    const selected = selectRiceCandidates();
    assert.equal(selected.length, ACTIVE_RICE_COUNT);
    assert.equal(new Set(selected.map(point => point.id)).size, ACTIVE_RICE_COUNT);
  }
});

function atRoom(id) { return byId.get(id); }

test('natural openings form three declared loops; no single doorway cuts the apartment in two', () => {
  assert.equal(new Set(DOOR_NODES.map(door => door.id)).size, DOOR_NODES.length);
  assert.ok(DOOR_NODES.length < ROOMS.length * 2);
  for (const door of DOOR_NODES) {
    assert.ok(door.id && roomIds.has(door.connectedRoomA) && roomIds.has(door.connectedRoomB));
    assert.ok(door.width >= MIN_DOOR_WIDTH, door.id);
  }
  assert.equal(edges.size, DOOR_NODES.length);
  const reachable = blocked => {
    const reached = new Set([SPAWNS.deepseek.roomId]);
    const queue = [SPAWNS.deepseek.roomId];
    for (const current of queue) for (const door of DOOR_NODES) {
      if (edgeId(door.connectedRoomA, door.connectedRoomB) === blocked) continue;
      const next = door.connectedRoomA === current ? door.connectedRoomB
        : door.connectedRoomB === current ? door.connectedRoomA : null;
      if (next && !reached.has(next)) { reached.add(next); queue.push(next); }
    }
    return reached;
  };
  assert.equal(reachable(null).size, ROOMS.length);
  for (const edge of edges) assert.equal(reachable(edge).size, ROOMS.length,
    `blocking ${edge} should leave another route`);
  assert.ok(ROUTE_LOOPS.length >= 3);
  for (const loop of ROUTE_LOOPS) {
    assert.equal(loop[0], loop.at(-1));
    assert.ok(new Set(loop.slice(0, -1)).size >= 3);
    for (let i = 0; i < loop.length - 1; i++) {
      assert.ok(edges.has(edgeId(loop[i], loop[i + 1])), `${loop[i]} → ${loop[i + 1]}`);
    }
  }
});

test('all openings use the shorter residential single-door width and walls close around them', () => {
  assert.ok(SINGLE_DOOR_WIDTH < 1.4);
  assert.ok(SINGLE_DOOR_WIDTH >= MIN_DOOR_WIDTH);
  assert.ok(SINGLE_DOOR_WIDTH - PLAYER_DIAMETER > PLAYER_DIAMETER,
    'single door retains more than one actor width of free alignment margin');
  for (const door of DOOR_NODES) {
    assert.equal(door.width, SINGLE_DOOR_WIDTH, door.id);
    const coordinate = door.rotation === 0 ? door.x : door.z;
    const parallelWalls = WALLS.filter(wall => door.rotation === 0
      ? Math.abs(wall.z - door.z) < 0.001
      : Math.abs(wall.x - door.x) < 0.001);
    const beforeEdges = parallelWalls.map(wall => door.rotation === 0
      ? wall.x + wall.width / 2 : wall.z + wall.depth / 2)
      .filter(edge => edge <= coordinate + 0.001);
    const afterEdges = parallelWalls.map(wall => door.rotation === 0
      ? wall.x - wall.width / 2 : wall.z - wall.depth / 2)
      .filter(edge => edge >= coordinate - 0.001);
    const openingStart = Math.max(...beforeEdges);
    const openingEnd = Math.min(...afterEdges);
    assert.ok(Number.isFinite(openingStart) && Number.isFinite(openingEnd), door.id);
    assert.ok(Math.abs((openingEnd - openingStart) - SINGLE_DOOR_WIDTH) < 0.001,
      `${door.id} wall opening must match its leaf width`);
  }
});

test('walls and doors use the taller narrow residential proportions', () => {
  assert.ok(WALL_HEIGHT > 1.1);
  assert.equal(GAME_CONFIG.three.wallHeight, WALL_HEIGHT);
  assert.ok(GAME_CONFIG.door.leafHeight > 0.9);
  assert.ok(GAME_CONFIG.door.leafHeight < WALL_HEIGHT);
  assert.ok(GAME_CONFIG.door.leafHeight / SINGLE_DOOR_WIDTH >= 1);
  assert.ok(GAME_CONFIG.door.leafHeight / WALL_HEIGHT >= 0.7);
  assert.ok(GAME_CONFIG.door.leafHeight / WALL_HEIGHT <= 0.85);
});

test('actor-sized space reaches every room, rice point and spawn through open doors', () => {
  assert.ok(byId.get('hall').width >= PLAYER_DIAMETER * 3);
  const step = 0.3;
  const nx = Math.round(MAP_WIDTH / step), nz = Math.round(MAP_DEPTH / step);
  const grid = (x, z) => ({ ix: Math.round((x + MAP_WIDTH / 2 - step / 2) / step),
    iz: Math.round((z + MAP_DEPTH / 2 - step / 2) / step) });
  const point = (ix, iz) => ({ x: -MAP_WIDTH / 2 + step / 2 + ix * step,
    z: -MAP_DEPTH / 2 + step / 2 + iz * step });
  const start = grid(SPAWNS.deepseek.x, SPAWNS.deepseek.z);
  const queue = [start];
  const seen = new Set([`${start.ix},${start.iz}`]);
  for (const current of queue) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ix = current.ix + dx, iz = current.iz + dz;
    const key = `${ix},${iz}`;
    if (ix < 0 || iz < 0 || ix >= nx || iz >= nz || seen.has(key)) continue;
    const location = point(ix, iz);
    if (!free(location.x, location.z)) continue;
    seen.add(key);
    queue.push({ ix, iz });
  }
  for (const room of ROOMS) {
    assert.ok(queue.some(cell => {
      const p = point(cell.ix, cell.iz);
      return p.x > room.minX + PLAYER_DIAMETER && p.x < room.maxX - PLAYER_DIAMETER &&
        p.z > room.minZ + PLAYER_DIAMETER && p.z < room.maxZ - PLAYER_DIAMETER;
    }), `${room.id} has no reachable interior`);
  }
  for (const target of [...RICE_CANDIDATES, ...Object.values(SPAWNS)]) {
    assert.ok(free(target.x, target.z), `${target.id} is blocked`);
    const cell = grid(target.x, target.z);
    assert.ok(seen.has(`${cell.ix},${cell.iz}`), `${target.id} is unreachable`);
  }
  for (const door of DOOR_NODES) {
    assert.ok(free(door.x, door.z), `${door.id} is blocked`);
    const stepAway = PLAYER_DIAMETER;
    const pair = door.rotation === 0
      ? [[door.x, door.z - stepAway], [door.x, door.z + stepAway]]
      : [[door.x - stepAway, door.z], [door.x + stepAway, door.z]];
    for (const [x, z] of pair) assert.ok(free(x, z), `${door.id} approach blocked`);
  }
});

test('five persistent rice portions keep the global 30% threshold and finish only together', () => {
  const ids = selectRiceCandidates(() => 0.2).map(point => point.id);
  const field = new RiceField(ids, 5000, 400);
  assert.equal(field.totalMaxProgressMs, 25_000);
  field.update(5400, ids[0], true);
  assert.equal(field.completedCount, 1);
  field.update(2900, ids[1], true);
  assert.equal(field.progressRatio, 0.3);
  field.interrupt();
  field.update(2900, ids[1], true);
  assert.equal(field.get(ids[1]).rice.progressMs, 5000);
  assert.equal(field.completed, false);
  for (const id of ids.slice(2)) field.update(5400, id, true);
  assert.equal(field.completedCount, 5);
  assert.equal(field.completed, true);
});
