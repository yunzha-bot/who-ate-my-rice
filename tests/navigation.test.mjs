import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { HumanAIController } from '../src/systems/HumanAIController.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { DOOR_NODES, FURNITURE, MAP_DEPTH, MAP_WIDTH, ROOMS, SPAWNS,
  WALLS } from '../src/three/map/apartmentMap.ts';

function apartment() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  return { world, nav: new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES),
    doors: new DoorSystem(DOOR_NODES, 3) };
}

test('grid route reaches every authored room using the real actor circle footprint', () => {
  const { world, nav, doors } = apartment();
  for (const room of ROOMS) {
    const path = nav.findPath(SPAWNS.human, room, doors.doors);
    assert.ok(path?.length, room.id);
    for (const step of path) {
      assert.equal(world.canOccupyStaticXZ(step.x, step.z, 0.23, 0.7), true,
        `${room.id}: ${step.x}, ${step.z}`);
    }
  }
});

test('closed doors remain routeable, while locked doors force an alternate loop', () => {
  const { nav, doors } = apartment();
  const living = ROOMS.find(room => room.id === 'living');
  const normal = nav.findPath(SPAWNS.human, living, doors.doors);
  assert.ok(normal.some(step => step.doorId === 'door_living_kitchen'));
  assert.equal(doors.lock('door_living_kitchen', 'DEEPSEEK'), 'LOCKED');
  const alternate = nav.findPath(SPAWNS.human, living, doors.doors);
  assert.ok(alternate?.length);
  assert.ok(!alternate.some(step => step.doorId === 'door_living_kitchen'));
  const plannedUnlock = nav.findPath(SPAWNS.human, living, doors.doors,
    undefined, 0);
  assert.ok(plannedUnlock?.some(step => step.doorId === 'door_living_kitchen'));
  assert.equal(doors.get('door_living_kitchen').state, 'LOCKED');
});

test('navigation never cuts a blocked diagonal corner', () => {
  const world = { canOccupyStaticXZ(x, z) {
    return !((x > -0.5 && x < 0 && z > -0.5 && z < 0) ||
      (x > 0 && x < 0.5 && z > 0 && z < 0.5));
  } };
  const nav = new NavigationSystem(world, 2, 2, []);
  const path = nav.findPath({ x: -0.6, z: 0.2 }, { x: 0.6, z: -0.2 }, []);
  assert.ok(path?.length);
  for (let index = 1; index < path.length; index++) {
    const before = path[index - 1], after = path[index];
    const dx = after.x - before.x, dz = after.z - before.z;
    if (Math.abs(dx) > 0.1 && Math.abs(dz) > 0.1) {
      assert.equal(world.canOccupyStaticXZ(after.x, before.z), true);
      assert.equal(world.canOccupyStaticXZ(before.x, after.z), true);
    }
  }
});

test('navigation rejects an edge whose centers are free but actor circle clips a thin wall', () => {
  const world = { canOccupyStaticXZ(x) { return Math.abs(x) >= 0.05; } };
  const nav = new NavigationSystem(world, 2, 2, []);
  assert.equal(nav.findPath({ x: -0.6, z: 0 }, { x: 0.6, z: 0 }, []), null);
});

test('Human AI opens ordinary doors and walks across the real apartment', () => {
  const { world, nav, doors } = apartment();
  for (const node of DOOR_NODES) {
    const alongX = Math.abs(Math.sin(node.rotation)) < 0.5;
    const width = alongX ? node.width : 0.16;
    const depth = alongX ? 0.16 : node.width;
    world.setDynamicObstacle(node.id, new Box3(
      new Vector3(node.x - width / 2, 0, node.z - depth / 2),
      new Vector3(node.x + width / 2, 1.2, node.z + depth / 2)));
  }
  const ai = new HumanAIController(nav, ROOMS, DOOR_NODES);
  const human = new Vector3(SPAWNS.human.x, 0.35, SPAWNS.human.z);
  const opened = [];
  let leftKitchen = false;
  for (let frame = 0; frame < 300; frame++) {
    const command = ai.update({ deltaMs: 50, human, visibleTarget: null,
      lastSeen: null, heard: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true });
    if (command.openDoorId) {
      assert.equal(doors.toggle(command.openDoorId, 'HUMAN'), 'OPENED');
      world.setDynamicObstacle(command.openDoorId, null);
      opened.push(command.openDoorId);
    }
    human.copy(world.move(human, command.direction.x * 4.14 * 0.05,
      command.direction.z * 4.14 * 0.05, 0.23, 0.7));
    if (human.x < 9) leftKitchen = true;
    assert.equal(world.canOccupyStaticXZ(human.x, human.z, 0.23, 0.7), true);
  }
  assert.ok(opened.length > 0, 'Human should open a normal door on its selected route');
  assert.ok(leftKitchen, 'Human should leave the kitchen through normal door routing');
});

test('patrol physically enters all ten major apartment rooms', () => {
  const { world, nav, doors } = apartment();
  for (const node of DOOR_NODES) {
    const alongX = Math.abs(Math.sin(node.rotation)) < 0.5;
    const width = alongX ? node.width : GAME_CONFIG.door.leafThickness;
    const depth = alongX ? GAME_CONFIG.door.leafThickness : node.width;
    world.setDynamicObstacle(node.id, new Box3(
      new Vector3(node.x - width / 2, 0, node.z - depth / 2),
      new Vector3(node.x + width / 2, GAME_CONFIG.three.wallHeight,
        node.z + depth / 2)));
  }
  const ai = new HumanAIController(nav, ROOMS, DOOR_NODES);
  const human = new Vector3(SPAWNS.human.x, GAME_CONFIG.three.actorHeight / 2,
    SPAWNS.human.z);
  const visited = new Set();
  const major = ROOMS.filter(room => room.major);
  for (let frame = 0; frame < 3600 && visited.size < major.length; frame++) {
    for (const room of major) {
      if (human.x >= room.minX && human.x <= room.maxX &&
          human.z >= room.minZ && human.z <= room.maxZ) visited.add(room.id);
    }
    const command = ai.update({ deltaMs: 50, human, visibleTarget: null,
      lastSeen: null, heard: null, captureEligible: false, doors: doors.doors,
      canOpenDoor: () => true });
    if (command.openDoorId) {
      assert.equal(doors.toggle(command.openDoorId, 'HUMAN'), 'OPENED');
      world.setDynamicObstacle(command.openDoorId, null);
    }
    const speed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
      GAME_CONFIG.human.speedMultiplier * GAME_CONFIG.humanAI.movementSpeedMultiplier;
    human.copy(world.move(human, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, GAME_CONFIG.collision.playerRadius,
      GAME_CONFIG.three.actorHeight));
    assert.equal(world.canOccupyStaticXZ(human.x, human.z,
      GAME_CONFIG.collision.playerRadius, GAME_CONFIG.three.actorHeight), true);
  }
  assert.deepEqual([...visited].sort(), major.map(room => room.id).sort());
});

test('Human AI investigates through an alternate route instead of a locked door', () => {
  const { world, nav, doors } = apartment();
  for (const node of DOOR_NODES) {
    const alongX = Math.abs(Math.sin(node.rotation)) < 0.5;
    const width = alongX ? node.width : GAME_CONFIG.door.leafThickness;
    const depth = alongX ? GAME_CONFIG.door.leafThickness : node.width;
    world.setDynamicObstacle(node.id, new Box3(
      new Vector3(node.x - width / 2, 0, node.z - depth / 2),
      new Vector3(node.x + width / 2, GAME_CONFIG.three.wallHeight,
        node.z + depth / 2)));
  }
  assert.equal(doors.lock('door_living_kitchen', 'DEEPSEEK'), 'LOCKED');
  const living = ROOMS.find(room => room.id === 'living');
  const ai = new HumanAIController(nav, ROOMS, DOOR_NODES);
  const human = new Vector3(SPAWNS.human.x, GAME_CONFIG.three.actorHeight / 2,
    SPAWNS.human.z);
  const heard = { event: { type: 'FOOTSTEP', position: living,
    sourceFaction: 'DEEPSEEK', timestamp: 0, strength: 0.35, lifetimeMs: 1400 } };
  let reached = false;
  for (let frame = 0; frame < 700; frame++) {
    const command = ai.update({ deltaMs: 50, human, visibleTarget: null,
      lastSeen: null, heard: frame === 0 ? heard : null, captureEligible: false,
      doors: doors.doors, canOpenDoor: () => true });
    assert.notEqual(command.openDoorId, 'door_living_kitchen');
    if (command.openDoorId) {
      assert.equal(doors.toggle(command.openDoorId, 'HUMAN'), 'OPENED');
      world.setDynamicObstacle(command.openDoorId, null);
    }
    const speed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
      GAME_CONFIG.human.speedMultiplier * GAME_CONFIG.humanAI.movementSpeedMultiplier;
    human.copy(world.move(human, command.direction.x * speed * 0.05,
      command.direction.z * speed * 0.05, GAME_CONFIG.collision.playerRadius,
      GAME_CONFIG.three.actorHeight));
    if (human.x >= living.minX && human.x <= living.maxX &&
        human.z >= living.minZ && human.z <= living.maxZ) reached = true;
    if (reached) break;
  }
  assert.equal(reached, true);
  assert.equal(doors.get('door_living_kitchen').state, 'LOCKED');
});
