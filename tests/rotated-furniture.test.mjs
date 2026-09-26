import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { CollisionWorld, orientedObstacleFromRect } from '../src/three/CollisionWorld.ts';
import { MapEditSession, MAP_EXPORT_VERSION, furnitureRect, rectColliders }
  from '../src/three/map/MapEditModel.ts';
import { degreesToRadians, pointInRect, rectBoundingAabb, rectsOverlap,
  rotatePointAround } from '../src/three/map/RotatedRect.ts';
import { furnitureApproachSurfacePoint, hideRegionSetup, hideRegionSurfaceClear }
  from '../src/three/map/HideInteractionRegion.ts';
import { isCaptureEligibleXZ } from '../src/three/CaptureZone.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, PLAYER_DIAMETER,
  ROOMS, SPAWNS, WALLS } from '../src/three/map/apartmentMap.ts';

// DEV-A-FIX-2: arbitrary-angle furniture rotation through the whole pipeline.
// These are the integration-level checks; the pure maths lives in
// tests/rotated-rect.test.mjs and the movement checks in tests/collision-world.

const radius = GAME_CONFIG.collision.playerRadius;
const actorHeight = GAME_CONFIG.three.actorHeight;
const point = (x, z) => new Vector3(x, 0.35, z);
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);

function worldOf(session) {
  const rects = session.furnitureList().map(furnitureRect);
  const colliders = rectColliders([...WALLS, ...rects]);
  const world = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, colliders.boxes,
    colliders.oriented);
  return { world, rects,
    nav: new NavigationSystem(world, MAP_WIDTH, MAP_DEPTH, DOOR_NODES),
    doors: new DoorSystem(DOOR_NODES, 3) };
}

test('the model stores a true angle and normalizes any numeric entry', () => {
  const session = new MapEditSession();
  assert.equal(session.get('living_sofa').rotationDeg, 0);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 37.5), null);
  assert.equal(session.get('living_sofa').rotationDeg, 37.5);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 370), null);
  assert.equal(session.get('living_sofa').rotationDeg, 10);
  assert.equal(session.setField('living_sofa', 'rotationDeg', -10), null);
  assert.equal(session.get('living_sofa').rotationDeg, 350);
  assert.equal(session.setField('living_sofa', 'rotationDeg', Number.NaN)?.code,
    'INVALID_VALUE');
  assert.equal(session.get('living_sofa').rotationDeg, 350, 'a rejected value must not stick');
  assert.equal(session.setField('living_sofa', 'rotationQuarter', 1)?.code,
    'READ_ONLY_FIELD', 'the old quarter field is gone');
});

test('the optional 15 degree snap is off by default and never changes the stored angle otherwise', () => {
  const session = new MapEditSession();
  assert.equal(session.rotationSnapEnabled, false);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 7), null);
  assert.equal(session.get('living_sofa').rotationDeg, 7, 'no snap unless enabled');
  session.setRotationSnap(true);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 8), null);
  assert.equal(session.get('living_sofa').rotationDeg, 15);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 353), null);
  assert.equal(session.get('living_sofa').rotationDeg, 0);
  session.setRotationSnap(false);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 7), null);
  assert.equal(session.get('living_sofa').rotationDeg, 7);
});

test('a rotated piece keeps every corner inside its own room or is rejected', () => {
  const session = new MapEditSession();
  // The storage shelf is wide enough that a quarter turn pushes it out of the
  // storage room even though the axis-aligned footprint fits.
  assert.equal(session.setField('storage_shelf', 'rotationDeg', 90), null);
  const rejections = session.validateDraft();
  assert.ok(rejections.some(item => item.targetId === 'storage_shelf' &&
    item.code === 'ROOM_BOUNDARY'), JSON.stringify(rejections.map(item => item.code)));
  assert.equal(session.apply().ok, false);
  assert.equal(session.get('storage_shelf').rotationDeg, 0, 'a rejected rotation rolls back');
});

test('furniture overlap is judged by the real rotated footprint, not the bounding box', () => {
  const session = new MapEditSession();
  assert.equal(session.setField('living_sofa', 'rotationDeg', 45), null);
  // The sofa is a 45-degree diamond; this table sits in the bounding-box corner
  // where the true diamond is absent.
  assert.equal(session.moveTarget('living_coffee_table', 1.15, -2.05), null);
  const sofa = furnitureRect(session.get('living_sofa'));
  const table = furnitureRect(session.get('living_coffee_table'));
  assert.equal(rectsOverlap(rectBoundingAabb(sofa), rectBoundingAabb(table)), true,
    'the axis-aligned bounds do overlap');
  assert.equal(rectsOverlap(sofa, table, 0.001), false, 'the true shapes do not');
  assert.equal(session.validateDraft().some(item =>
    item.code === 'OVERLAPS_FURNITURE' &&
    (item.targetId === 'living_sofa' || item.targetId === 'living_coffee_table')), false);
});

test('door blocking follows the rotated corner, not the unrotated box', () => {
  const straight = new MapEditSession();
  // door_living_dining sits on the living/dining wall at x = 9; its approach
  // points sit one actor diameter away on the living side.
  assert.equal(straight.moveTarget('living_coffee_table', 7.55, 1.5), null);
  assert.equal(straight.validateDraft().some(item => item.code === 'BLOCKS_DOOR'), false,
    'the unrotated table stays clear of the door and its approach');
  const rotated = new MapEditSession();
  assert.equal(rotated.setField('living_coffee_table', 'rotationDeg', 45), null);
  assert.equal(rotated.moveTarget('living_coffee_table', 7.55, 1.5), null);
  assert.ok(rotated.validateDraft().some(item => item.code === 'BLOCKS_DOOR'),
    'the rotated corner reaches into the door clearance');
});

test('a rotated piece blocks line of sight and therefore capture eligibility', () => {
  // A square turned 45 degrees has a bounding box that is wider than the piece,
  // so its corners are the classic "inside the AABB, outside the shape" region.
  const piece = { id: 'test_piece', kind: 'furniture', x: 0, z: 0, width: 1.2, depth: 1.2,
    height: 1, rotation: degreesToRadians(45) };
  const colliders = rectColliders([piece]);
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, colliders.boxes,
    colliders.oriented);
  const bounds = rectBoundingAabb(piece);
  assert.ok(bounds.width > piece.width, 'rotated bounds are wider than the piece');
  const human = point(-1.2, 0);
  const deepseek = point(1.2, 0);
  const blocked = collision.isLineBlockedXZ(human, deepseek);
  assert.equal(blocked, true, 'the sight line crosses the rotated piece');
  assert.equal(isCaptureEligibleXZ(human, deepseek, GAME_CONFIG.match.captureRadius, blocked),
    false);
  // A corner segment inside the bounding box but outside the true diamond.
  const corner = bounds.width / 2;
  assert.equal(collision.isLineBlockedXZ(point(corner - 0.05, corner - 0.05),
    point(corner - 0.01, corner - 0.01)), false);
});

test('navigation routes around rotated furniture using the real collision footprint', () => {
  const session = new MapEditSession();
  const before = worldOf(session);
  // Turn the big sofa across the living room and widen it slightly so the
  // detour is real but still passable.
  assert.equal(session.setField('living_sofa', 'rotationDeg', 135), null);
  assert.equal(session.apply().ok, true);
  const after = worldOf(session);
  const doors = after.doors.doors;
  for (const room of ROOMS) {
    const path = after.nav.findPath(SPAWNS.human, room, doors);
    assert.ok(path?.length, `${room.id} became unreachable`);
    for (const step of path) {
      assert.equal(after.world.canOccupyStaticXZ(step.x, step.z, radius, actorHeight), true,
        `${room.id}: step ${step.x}, ${step.z} is not standable`);
    }
  }
  // Every route still exists, and the rotated footprint really is respected:
  // no navigation cell centre may sit inside the rotated piece.
  const sofa = furnitureRect(session.get('living_sofa'));
  for (const room of ROOMS) {
    const path = after.nav.findPath(SPAWNS.human, room, doors) ?? [];
    for (const step of path) {
      assert.equal(pointInRect(step, sofa, -radius), false,
        `nav step ${step.x}, ${step.z} penetrates the rotated sofa`);
    }
  }
  assert.ok(before.nav.findPath(SPAWNS.human, ROOMS[0], before.doors.doors)?.length);
});

test('the hide interaction aims at the true rotated surface', () => {
  const bed = furnitureRect({ editKind: 'FURNITURE', id: 'main_bed', roomId: 'main_bedroom',
    x: -13, z: -5, rotationDeg: 90, width: 2.1, depth: 2.3, height: 0.45 });
  const target = furnitureApproachSurfacePoint(bed, { x: -13, z: -9 });
  assert.equal(pointInRect(target, bed, 1e-9), true);
  close(target.x, -13, 'aim x');
  close(target.z, -5 - 1.05, 'aim z on the rotated boundary');
  // The axis-aligned footprint would have aimed at z = -6.15 instead.
  assert.ok(Math.abs(target.z - (-6.15)) > 0.05);
});

test('a rotated piece blocks a hide route between the position and its surface', () => {
  const spot = HIDE_SPOTS.find(value => value.id === 'hide_living_carton');
  const near = FURNITURE.find(rect => rect.id === 'living_carton');
  const world = { walls: [], doorNodes: [], doorStates: [] };
  const probe = { x: spot.x, z: spot.z };
  const clearSetup = hideRegionSetup(spot, [near]);
  assert.ok(clearSetup);
  assert.equal(hideRegionSurfaceClear(clearSetup, probe, world), true,
    'the authored anchor has a clear route to its own carton');
  // A rotated piece crossing that short route has to block it.
  const blocker = { id: 'test_blocker', kind: 'furniture', x: 7.2, z: 3.6,
    width: 0.2, depth: 0.6, height: 1, rotation: degreesToRadians(90) };
  const blockedSetup = hideRegionSetup(spot, [near, blocker]);
  assert.ok(blockedSetup);
  assert.equal(hideRegionSurfaceClear(blockedSetup, probe, world), false,
    'the rotated blocker crosses the route to the carton surface');
  // The exact aim point is still on the true surface of the target piece.
  assert.equal(pointInRect(furnitureApproachSurfacePoint(near, probe), near, 1e-9), true);
});

test('editor transactions keep cancel, reset and rollback working with rotation', () => {
  const session = new MapEditSession();
  assert.equal(session.setField('main_bed', 'rotationDeg', 37), null);
  assert.equal(session.diff('main_bed').some(entry => entry.field === 'rotationDeg'), true);
  assert.equal(session.isDirty, true);
  assert.equal(session.resetTarget('main_bed'), true);
  assert.equal(session.get('main_bed').rotationDeg, 0);
  assert.equal(session.isDirty, false);

  // Rotating also turns the linked anchor and its facing, at any angle.
  const anchorBefore = session.get('hide_main_bed');
  const bedBefore = session.get('main_bed');
  assert.equal(session.setField('main_bed', 'rotationDeg', 37), null);
  const bedAfter = session.get('main_bed');
  const anchorAfter = session.get('hide_main_bed');
  const expected = rotatePointAround({ x: bedBefore.x, z: bedBefore.z },
    { x: anchorBefore.x, z: anchorBefore.z }, degreesToRadians(37));
  close(anchorAfter.x, expected.x, 'anchor x after rotation');
  close(anchorAfter.z, expected.z, 'anchor z after rotation');
  close(anchorAfter.facing - (anchorBefore.facing - degreesToRadians(37)), 0, 'facing');
  assert.equal(bedAfter.rotationDeg, 37);

  // A hard reset drops the whole rotation draft and clears the drag window.
  session.beginDeferredValidation();
  session.resetAll();
  assert.equal(session.validationDeferred, false);
  assert.equal(session.get('main_bed').rotationDeg, 0);
});

test('rotation edits still validate once per revision, not once per frame', () => {
  const session = new MapEditSession();
  const before = session.validationRuns;
  session.beginDeferredValidation();
  for (const degrees of [5, 15, 45, 90, 180]) {
    session.setField('living_sofa', 'rotationDeg', degrees);
    assert.equal(session.draftStatus, 'DRAGGING');
    session.regionPreview('living_sofa', false);
  }
  assert.equal(session.validationRuns, before, 'no full validation while editing');
  session.endDeferredValidation();
  assert.equal(session.draftStatus, 'VALID');
  assert.equal(session.validationRuns, before + 1, 'exactly one validation on release');
  assert.equal(session.draftStatus, 'VALID');
  assert.equal(session.validationRuns, before + 1);
});

test('JSON V3 records the centre, size and true angle and labels the AABB', () => {
  const session = new MapEditSession();
  assert.equal(MAP_EXPORT_VERSION, 3);
  assert.equal(session.setField('living_sofa', 'rotationDeg', 45), null);
  const pending = session.exportJson().furniture.find(item => item.id === 'living_sofa');
  assert.equal(pending.rotationDeg, 0, 'unapplied rotation is never exported');
  assert.equal(session.apply().ok, true);
  const piece = session.exportJson().furniture.find(item => item.id === 'living_sofa');
  assert.equal(piece.kind, 'furniture');
  assert.equal(piece.rotationDeg, 45);
  assert.ok(Math.abs(piece.rotationRad - degreesToRadians(45)) < 1e-12);
  assert.deepEqual(piece.position, { x: 0, z: -3 });
  assert.deepEqual(piece.size, { width: 2.2, depth: 1.1, height: 0.65 });
  assert.equal(piece.collisionShape, 'ROTATED_RECT');
  assert.equal(piece.boundingAabbRole, 'broad-phase-approximation');
  const bounds = rectBoundingAabb(furnitureRect(session.get('living_sofa')));
  assert.ok(Math.abs(piece.boundingAabb.width - bounds.width) < 1e-9);
  assert.ok(piece.boundingAabb.width > piece.size.width,
    'the broad-phase bounds are larger than the true piece');
  assert.equal('collisionAabb' in piece, false, 'the old AABB field must not masquerade');
  // Hide spots keep their V2 semantics.
  const spot = session.exportJson().hideSpots.find(item => item.id === 'hide_living_carton');
  assert.ok(spot.interactionRegion.units.radius === 'world-unit');
  assert.equal(typeof spot.anchor.x, 'number');
  assert.equal(typeof spot.facingDeg, 'number');
});
