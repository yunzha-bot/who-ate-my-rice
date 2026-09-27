import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { PerceptionGeometry } from '../src/systems/PerceptionSystem.ts';
import { createMatchSetup, parseMatchSeed, spawnCandidates,
  validateMatchSetup } from '../src/systems/MatchRandom.ts';
import { mapPrecheckCollision } from '../src/three/map/MapApplicationPrecheck.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, ROOMS }
  from '../src/three/map/apartmentMap.ts';

const collision = mapPrecheckCollision(FURNITURE);
const navigation = new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES);

test('spawn candidates are real collision and navigation positions in authored rooms', () => {
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  const candidates = spawnCandidates(collision, navigation, doors.doors);
  assert.ok(candidates.length >= 8);
  assert.ok(ROOMS.every(room => candidates.some(candidate => candidate.roomId === room.id)));
  for (const point of candidates) {
    assert.ok(collision.canOccupyStaticXZ(point.x, point.z,
      C.collision.playerRadius, C.three.actorHeight));
  }
});

test('same seed reproduces spawns, rice and initial door states', () => {
  const first = createMatchSetup(123456, collision, navigation);
  const second = createMatchSetup(123456, collision, navigation);
  assert.deepEqual(first, second);
  assert.equal(first.validation, 'PASS');
  assert.ok(Object.values(first.doorStates).every(state =>
    state === 'OPEN' || state === 'CLOSED'));
  const another = createMatchSetup(789012, collision, navigation);
  assert.notDeepEqual([first.deepseek, first.human, first.rice, first.doorStates],
    [another.deepseek, another.human, another.rice, another.doorStates]);
});

test('200 seeds keep all initial layouts, rice, rooms and hide anchors reachable', () => {
  const layouts = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const setup = createMatchSetup(seed, collision, navigation);
    assert.equal(setup.validation, 'PASS', `seed ${seed}`);
    assert.equal(setup.fallback, false, `seed ${seed}`);
    assert.equal(setup.rice.length, C.rice.activeCount);
    assert.equal(new Set(setup.rice.map(rice => rice.id)).size, setup.rice.length);
    assert.notEqual(setup.deepseek.roomId, setup.human.roomId);
    assert.ok(Math.hypot(setup.deepseek.x - setup.human.x,
      setup.deepseek.z - setup.human.z) >= C.matchRandom.minSpawnDistance);
    layouts.add(`${setup.deepseek.id}|${setup.human.id}|${Object.values(setup.doorStates).join('')}`);
  }
  assert.ok(layouts.size > 100);
});

test('seed input rejects invalid values and accepts the entire uint32 range', () => {
  assert.equal(parseMatchSeed('0'), 0);
  assert.equal(parseMatchSeed('4294967295'), 4294967295);
  for (const value of [null, '', '-1', '1.5', '4294967296', 'NaN']) {
    assert.equal(parseMatchSeed(value), null);
  }
});

test('door reset returns to this match setup and preserves ordinary door rules', () => {
  const setup = createMatchSetup(42, collision, navigation);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  doors.applyInitialStates(setup.doorStates);
  const first = doors.doors[0];
  doors.toggle(first.id, 'HUMAN');
  doors.reset();
  assert.equal(first.state, setup.doorStates[first.id]);
  assert.equal(first.lockCoreState, 'ACTIVE');
  assert.equal(first.locked, false);
  assert.throws(() => doors.applyInitialStates({}), /Invalid initial state/);
});

test('the same initial states drive navigation, door interaction and perception', () => {
  const setup = createMatchSetup(98, collision, navigation);
  const doors = new DoorSystem(DOOR_NODES, C.door.maxActiveLocks);
  doors.applyInitialStates(setup.doorStates);
  const geometry = new PerceptionGeometry([], DOOR_NODES, () => doors.doors);
  for (const node of DOOR_NODES) {
    const offset = node.rotation === 0
      ? [{ x: node.x, z: node.z - 1 }, { x: node.x, z: node.z + 1 }]
      : [{ x: node.x - 1, z: node.z }, { x: node.x + 1, z: node.z }];
    const crossing = geometry.crossings(...offset);
    if (setup.doorStates[node.id] === 'OPEN') assert.ok(crossing.open >= 1);
    else assert.ok(crossing.closed >= 1);
  }
  const path = navigation.findPath(setup.deepseek, setup.human, doors.doors);
  assert.ok(path?.length);
  assert.ok(path.some(step => step.doorId));
  const closed = doors.doors.find(door => door.state === 'CLOSED');
  assert.ok(closed);
  assert.equal(doors.toggle(closed.id, 'DEEPSEEK'), 'OPENED');
  assert.equal(doors.get(closed.id).state, 'OPEN');
  doors.reset();
  assert.equal(doors.get(closed.id).state, 'CLOSED');
});

test('invalid proposals are rejected and a zero-attempt request uses verified fallback', () => {
  const setup = createMatchSetup(777, collision, navigation, 0);
  assert.equal(setup.fallback, true);
  assert.equal(setup.validation, 'PASS');
  const invalid = { ...setup, human: setup.deepseek };
  assert.equal(validateMatchSetup(invalid, collision, navigation), 'SPAWN_SEPARATION');
  const invalidDoor = { ...setup, doorStates: { ...setup.doorStates,
    [DOOR_NODES[0].id]: 'LOCKED' } };
  assert.equal(validateMatchSetup(invalidDoor, collision, navigation),
    'INVALID_DOOR_STATE');
});

test('a new round validates the applied hide anchors, not stale authored anchors', () => {
  const setup = createMatchSetup(248, collision, navigation);
  const editedSpots = HIDE_SPOTS.map((spot, index) => index === 0
    ? { ...spot, x: MAP_WIDTH + 10 } : spot);
  assert.equal(validateMatchSetup(setup, collision, navigation, editedSpots),
    `HIDE_UNREACHABLE:${HIDE_SPOTS[0].id}`);
  assert.throws(() => createMatchSetup(248, collision, navigation, 0, editedSpots),
    /Safe match fallback invalid/);
});
