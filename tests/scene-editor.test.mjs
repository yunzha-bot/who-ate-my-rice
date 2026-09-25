import assert from 'node:assert/strict';
import test from 'node:test';
import { EDIT_LIMITS, MapEditSession, MAP_EXPORT_FORMAT, MAP_EXPORT_VERSION,
  furnitureRect, rectBox, sceneEditorEnabled, validateEditedMap } from '../src/three/map/MapEditModel.ts';
import { sceneEditorRefusalNotice } from '../src/three/SceneEditor.ts';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, SPAWNS, WALLS }
  from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

const clone = value => JSON.parse(JSON.stringify(value));
const authoredFurniture = clone(FURNITURE);
const radius = GAME_CONFIG.collision.playerRadius;
const actorHeight = GAME_CONFIG.three.actorHeight;

// Rebuilds the same static world ThreeGame rebuilds after an applied edit.
function buildWorld(furnitureDrafts) {
  const rects = furnitureDrafts.map(furnitureRect);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2,
    [...WALLS, ...rects].map(rect => rectBox(rect)));
  return { world, rects, navigation: new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES) };
}

function worldOf(session) {
  return buildWorld(session.furnitureList());
}

test('the editor lists every authored furniture piece and hide spot with read-only identity', () => {
  const session = new MapEditSession();
  assert.equal(session.furnitureList().length, 20);
  assert.equal(session.hideSpotList().length, 8);
  assert.deepEqual(new Set(session.furnitureList().map(item => item.id)),
    new Set(FURNITURE.map(item => item.id)));
  assert.deepEqual(new Set(session.hideSpotList().map(item => item.id)),
    new Set(HIDE_SPOTS.map(item => item.id)));
  for (const spot of session.hideSpotList()) {
    assert.ok(spot.kind && spot.roomId && spot.furnitureId && spot.label, spot.id);
  }
  assert.equal(session.list().length, 28);
  for (const field of ['id', 'kind', 'roomId', 'furnitureId', 'label']) {
    const target = field === 'kind' || field === 'roomId' ? 'living_sofa' : 'hide_main_bed';
    const rejection = session.setField(target, field, 1);
    assert.equal(rejection?.code, 'READ_ONLY_FIELD', `${target}.${field}`);
  }
  assert.equal(session.get('hide_main_bed').furnitureId, 'main_bed');
  assert.equal(session.get('living_sofa').roomId, 'living');
  assert.equal(session.get('nope'), null);
  assert.equal(session.setField('nope', 'x', 1)?.code, 'NOT_FOUND');
});

test('the authored map already satisfies every editor rule', () => {
  const session = new MapEditSession();
  assert.equal(session.isDirty, false);
  assert.equal(session.draftStatus, 'UNCHANGED');
  assert.deepEqual(session.validateDraft(), []);
  const applied = session.apply();
  assert.equal(applied.ok, true);
  assert.equal(session.appliedEditCount, 1);
  assert.equal(session.cloneCommitted().furniture.length, 20);
  assert.equal(session.cloneCommitted().hideSpots.length, 8);
});

test('a legal move is applied and both real collision and navigation follow it', () => {
  const session = new MapEditSession();
  const before = worldOf(session);
  assert.equal(before.world.canOccupyStaticXZ(13.4, 3.6, radius, actorHeight), true);
  const beforeCell = before.navigation.nearestFree({ x: 13.4, z: 3.6 }, []);
  assert.ok(beforeCell);
  assert.ok(Math.hypot(beforeCell.x - 13.4, beforeCell.z - 3.6) < 0.001);

  assert.equal(session.moveTarget('dining_table', 13.2, 3.5), null);
  assert.equal(session.draftStatus, 'VALID');
  assert.deepEqual(session.diff('dining_table').map(entry => entry.field).sort(), ['x', 'z']);
  assert.equal(session.apply().ok, true);

  const after = worldOf(session);
  assert.equal(after.world.canOccupyStaticXZ(13.4, 3.6, radius, actorHeight), false);
  const afterCell = after.navigation.nearestFree({ x: 13.4, z: 3.6 }, []);
  assert.ok(afterCell);
  assert.ok(Math.hypot(afterCell.x - 13.4, afterCell.z - 3.6) > 0.01,
    'navigation must not keep offering the cell the rebuilt collision blocks');
  assert.equal(session.appliedEditCount, 1);
});

test('a legal resize is applied and the freed space becomes walkable again', () => {
  const session = new MapEditSession();
  assert.equal(worldOf(session).world.canOccupyStaticXZ(1.0, -3, radius, actorHeight), false);
  assert.equal(session.setField('living_sofa', 'width', 1.4), null);
  assert.equal(session.apply().ok, true);
  assert.equal(worldOf(session).world.canOccupyStaticXZ(1.0, -3, radius, actorHeight), true);
});

test('a rotated piece keeps an axis-aligned collision box and records its degree', () => {
  const session = new MapEditSession();
  assert.equal(session.setField('living_coffee_table', 'rotationQuarter', 1), null);
  const draft = session.get('living_coffee_table');
  const rect = furnitureRect(draft);
  assert.equal(rect.width, draft.depth);
  assert.equal(rect.depth, draft.width);
  assert.equal(session.draftStatus, 'VALID');
  assert.equal(session.apply().ok, true);
  const exported = session.exportJson().furniture.find(item => item.id === 'living_coffee_table');
  assert.equal(exported.rotationDeg, 90);
  assert.deepEqual(exported.collisionAabb, { width: 1.0, depth: 1.2 });
});

test('field-level guards reject illegal values without touching the draft', () => {
  const cases = [
    ['living_sofa', 'x', 8.5, 'ROOM_BOUNDARY', true],
    ['living_sofa', 'rotationQuarter', 1.5, 'NOT_QUARTER_TURN', false],
    ['living_sofa', 'width', 4.5, 'SIZE_OUT_OF_RANGE', false],
    ['living_sofa', 'height', 0.02, 'SIZE_OUT_OF_RANGE', false],
    ['living_sofa', 'x', Number.NaN, 'INVALID_VALUE', false],
  ];
  for (const [id, field, value, code, changesDraft] of cases) {
    if (field === 'x' && value === 8.5) {
      const session = new MapEditSession();
      assert.equal(session.setField(id, field, value), null);
      const rejections = session.validateDraft();
      assert.equal(rejections[0].code, code);
      const blocked = session.apply();
      assert.equal(blocked.ok, false);
      assert.equal(session.get(id).x, 0);
      assert.equal(session.lastRejection.code, code);
      assert.deepEqual(session.diff(id), []);
      assert.equal(session.cloneCommitted().furniture.find(item => item.id === id).x, 0);
      continue;
    }
    const session = new MapEditSession();
    const rejection = session.setField(id, field, value);
    assert.equal(rejection?.code, code, `${id}.${field}=${value}`);
    assert.equal(session.isDirty, changesDraft);
  }
});

test('a rejected draft rolls the whole session back to the last legal map', () => {
  const session = new MapEditSession();
  session.moveTarget('dining_table', 13.2, 3.5);
  assert.equal(session.apply().ok, true);
  session.moveTarget('living_carton', 0, -6);
  assert.equal(session.isDirty, true);
  const rejected = session.apply();
  assert.equal(rejected.ok, false);
  assert.ok(rejected.rejections.some(item => item.code === 'COVERS_RICE'));
  assert.equal(session.isDirty, false);
  assert.equal(session.get('living_carton').x, 7.9);
  assert.equal(session.get('dining_table').x, 13.2, 'the last legal state must survive a later rejection');
  assert.equal(session.events.at(-1).type, 'SCENE_OBJECT_EDIT_REJECT');
  assert.equal(session.events.filter(event => event.type === 'SCENE_OBJECT_EDIT_APPLY').length, 1);
});

test('door, rice, spawn and connectivity rules each reject their own violation', () => {
  const doorSession = new MapEditSession();
  doorSession.moveTarget('living_coffee_table', 8.3, 1.5);
  const doorRejections = doorSession.validateDraft();
  assert.ok(doorRejections.length > 0);
  assert.ok(doorRejections.every(item => item.code === 'BLOCKS_DOOR'),
    JSON.stringify(doorRejections.map(item => `${item.code}@${item.targetId}`)));
  assert.ok(doorRejections.some(item => item.targetId === 'door_living_dining'));

  const riceSession = new MapEditSession();
  riceSession.moveTarget('living_carton', 0, -6);
  assert.ok(riceSession.validateDraft().some(item => item.code === 'COVERS_RICE'));

  const spawnSession = new MapEditSession();
  spawnSession.moveTarget('kitchen_island', SPAWNS.human.x, SPAWNS.human.z);
  assert.ok(spawnSession.validateDraft().some(item => item.code === 'SPAWN_BLOCKED'));

  const sealSession = new MapEditSession();
  sealSession.moveTarget('storage_shelf', 15.5, -7);
  sealSession.moveTarget('storage_carton', 15.5, -1);
  const sealRejections = sealSession.validateDraft();
  assert.ok(sealRejections.some(item => item.code === 'ROOM_UNREACHABLE'),
    JSON.stringify(sealRejections.map(item => `${item.code}@${item.targetId}`)));
  assert.equal(sealSession.apply().ok, false);
  assert.equal(sealSession.cloneCommitted().furniture.find(item => item.id === 'storage_shelf').x, 17.35);
});

test('overlapping furniture is rejected', () => {
  const session = new MapEditSession();
  session.moveTarget('living_carton', 0, -3);
  assert.ok(session.validateDraft().some(item => item.code === 'OVERLAPS_FURNITURE'));
  assert.equal(session.apply().ok, false);
});

test('hide spot anchors must stay standing, clear, inside their room and attached to their furniture', () => {
  const insideSession = new MapEditSession();
  insideSession.moveTarget('hide_study_bookshelf', -0.1, 12.1);
  assert.ok(insideSession.validateDraft().some(item => item.code === 'ANCHOR_INSIDE_OBSTACLE'));

  const detachedSession = new MapEditSession();
  detachedSession.moveTarget('hide_main_bed', -10, -3);
  assert.ok(detachedSession.validateDraft().some(item => item.code === 'ANCHOR_DETACHED'));

  const roomSession = new MapEditSession();
  roomSession.moveTarget('hide_closet', 0, 0);
  assert.ok(roomSession.validateDraft().some(item =>
    item.code === 'ROOM_BOUNDARY' && item.targetId === 'hide_closet'));

  const facingSession = new MapEditSession();
  assert.equal(facingSession.setField('hide_living_carton', 'facing', 1.25), null);
  assert.deepEqual(facingSession.validateDraft(), []);
  assert.equal(facingSession.apply().ok, true);
  assert.equal(facingSession.exportJson().hideSpots
    .find(item => item.id === 'hide_living_carton').facing, 1.25);

  const furnitureSession = new MapEditSession();
  furnitureSession.moveTarget('living_carton', 4, 3.6);
  assert.ok(furnitureSession.validateDraft().some(item =>
    item.code === 'ANCHOR_DETACHED' && item.targetId === 'hide_living_carton'));
});

test('resetTarget restores authored values and resetAll drops a whole draft', () => {
  const session = new MapEditSession();
  session.moveTarget('living_carton', 7.9, 3.4);
  assert.equal(session.diff('living_carton').length, 1);
  assert.equal(session.resetTarget('living_carton'), true);
  assert.deepEqual(session.diff('living_carton'), []);
  assert.equal(session.isDirty, false);

  session.moveTarget('dining_table', 13.2, 3.5);
  session.moveTarget('living_carton', 7.9, 3.4);
  assert.equal(session.isDirty, true);
  session.resetAll();
  assert.equal(session.isDirty, false);
  assert.equal(session.draftStatus, 'UNCHANGED');
  assert.equal(session.resetTarget('nope'), false);
  assert.equal(session.resetTarget('hide_main_bed'), true);
});

test('export carries the documented fields, only applied data, and never mutates the source map', () => {
  const session = new MapEditSession();
  const document = session.exportJson();
  assert.equal(document.format, MAP_EXPORT_FORMAT);
  assert.equal(document.formatVersion, MAP_EXPORT_VERSION);
  assert.equal(document.units.length, 'world-unit');
  assert.equal(document.units.angle, 'radian');
  assert.equal(document.units.rotation, 'degree');
  assert.equal(document.units.groundPlane, 'XZ');
  assert.equal(document.units.up, 'Y');
  assert.deepEqual(document.map, { width: MAP_WIDTH, depth: MAP_DEPTH });
  assert.equal(document.furniture.length, 20);
  assert.equal(document.hideSpots.length, 8);
  assert.equal(document.rooms.length, 12);
  assert.equal(document.doors.length, 18);
  assert.equal(document.spawns.length, 2);
  assert.equal(document.riceCandidates.length, 14);

  session.moveTarget('dining_table', 13.2, 3.5);
  session.apply();
  session.moveTarget('dining_table', 13.2, 4.6);
  const rejected = session.apply();
  assert.equal(rejected.ok, false);
  const table = session.exportJson().furniture.find(item => item.id === 'dining_table');
  assert.deepEqual(table.position, { x: 13.2, z: 3.5 });
  assert.equal(table.roomId, 'dining');
  assert.equal(table.kind, 'furniture');
  assert.equal(table.rotationDeg, 0);
  assert.deepEqual(table.size, { width: 1.8, depth: 1.4, height: 0.55 });
  assert.deepEqual(table.collisionAabb, { width: 1.8, depth: 1.4 });
  const spot = session.exportJson().hideSpots.find(item => item.id === 'hide_main_bed');
  assert.equal(spot.kind, 'BED');
  assert.equal(spot.furnitureId, 'main_bed');
  assert.deepEqual(spot.anchor, { x: -14.4, z: -6.15 });
  assert.ok(Number.isFinite(spot.facingDeg));

  assert.deepEqual(clone(FURNITURE), authoredFurniture);
  assert.equal(FURNITURE.length, 20);
  assert.equal(HIDE_SPOTS.length, 8);
  assert.ok(FURNITURE.some(item => item.id === 'living_carton'));
  assert.ok(FURNITURE.some(item => item.id === 'storage_carton'));
  assert.ok(session.hideSpotList().every(item => item.id.startsWith('hide_')));
});

test('the scene editor switch is DEV-only and its limits stay out of GAME_CONFIG', () => {
  assert.equal(sceneEditorEnabled(false, true), false);
  assert.equal(sceneEditorEnabled(true, false), false);
  assert.equal(sceneEditorEnabled(true, true), true);
  assert.equal(EDIT_LIMITS.gridStep, 0.3);
  assert.equal(Object.keys(GAME_CONFIG).includes('sceneEditor'), false);
  assert.equal(Object.keys(GAME_CONFIG).includes('hide'), false);
});

test('validateEditedMap is a pure function of the draft', () => {
  const session = new MapEditSession();
  session.setField('living_sofa', 'x', 8.5);
  const first = session.validateDraft();
  const second = session.validateDraft();
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0].code, 'ROOM_BOUNDARY');
  assert.deepEqual(validateEditedMap(session.furnitureList(), session.hideSpotList()), first);
});

// Regression (browser acceptance FAIL, 2026-09-25): clicking the launcher before
// the match reached PLAYING only wrote a message into the closed panel, so the
// button looked dead. Every refusal now produces text the launcher can show.
test('a refused scene editor open always produces a visible reason', () => {
  for (const phase of ['FACTION_SELECT', 'READY', 'PAUSED', 'FINISHED']) {
    const notice = sceneEditorRefusalNotice(phase, 'NOT_PLAYING：场景编辑仅在 PLAYING 可用');
    assert.match(notice, /场景编辑/);
    assert.ok(notice.includes(phase), phase);
  }
  const busy = sceneEditorRefusalNotice('PLAYING', 'ALREADY_OPEN：场景编辑器已经打开');
  assert.equal(busy, '场景编辑未打开：ALREADY_OPEN：场景编辑器已经打开');
});
