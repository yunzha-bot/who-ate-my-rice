import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, Vector3 } from 'three';
import { CollisionWorld } from '../src/three/CollisionWorld.ts';
import { NavigationSystem } from '../src/systems/NavigationSystem.ts';
import { DoorSystem } from '../src/systems/DoorSystem.ts';
import { crossesRect } from '../src/systems/PerceptionSystem.ts';
import { draftSpotsToAnchors } from '../src/three/SceneEditor.ts';
import { MapEditSession, furnitureRect } from '../src/three/map/MapEditModel.ts';
import {
  DEFAULT_REGION_SAMPLE_STEP, checkHideRegionPosition, hideRegionAxisAngle,
  hideRegionGeometry, hideRegionSetup, hideRegionSurfaceClear, pointInHideRegion,
  sampleHideRegion, sectorHalfAngleRadians, validateHideRegionData, wrapToPi,
} from '../src/three/map/HideInteractionRegion.ts';
import { DOOR_NODES, FURNITURE, HIDE_SPOTS, MAP_DEPTH, MAP_WIDTH, WALLS, roomAt }
  from '../src/three/map/apartmentMap.ts';

// DEV-A round 1 covers authored region data and pure geometry only. It has to
// hold while no hide gameplay exists: no HideSystem, no hide key, no CHECK_HIDE.
const furnitureById = new Map(FURNITURE.map(rect => [rect.id, rect]));
const spotsById = new Map(HIDE_SPOTS.map(spot => [spot.id, spot]));

// The parameters approved for DEV-A round 1, pinned independently of the source
// file so an accidental edit of the authored data fails here.
const APPROVED_REGIONS = {
  hide_main_bed: { shape: 'CIRCLE', radius: 2 },
  hide_second_bed: { shape: 'CIRCLE', radius: 2 },
  hide_main_wardrobe: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 },
  hide_closet: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 },
  hide_study_bookshelf: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 },
  hide_storage_shelf: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 55 },
  hide_living_carton: { shape: 'CIRCLE', radius: 1.2 },
  hide_storage_carton: { shape: 'CIRCLE', radius: 1.2 },
};

function apartment() {
  const boxes = [...WALLS, ...FURNITURE].map(rect => new Box3(
    new Vector3(rect.x - rect.width / 2, 0, rect.z - rect.depth / 2),
    new Vector3(rect.x + rect.width / 2, rect.height, rect.z + rect.depth / 2)));
  const collision = new CollisionWorld(MAP_WIDTH / 2, MAP_DEPTH / 2, boxes);
  return { collision,
    navigation: new NavigationSystem(collision, MAP_WIDTH, MAP_DEPTH, DOOR_NODES),
    doors: new DoorSystem(DOOR_NODES, 3) };
}

const world = apartment();

function setupOf(id) {
  const setup = hideRegionSetup(spotsById.get(id), FURNITURE);
  assert.ok(setup, `${id} must resolve its furniture`);
  return setup;
}

// The wardrobe spot with its anchor moved straight to -X of the furniture
// centre, so the sector axis sits exactly on the +/-pi seam.
function seamSetup() {
  const spot = spotsById.get('hide_main_wardrobe');
  const own = furnitureById.get(spot.furnitureId);
  return hideRegionSetup({ ...spot, x: own.x - 1, z: own.z }, FURNITURE);
}

test('every hide spot carries exactly the approved DEV-A interaction region', () => {
  assert.equal(HIDE_SPOTS.length, 8);
  assert.deepEqual(Object.keys(APPROVED_REGIONS).sort(),
    HIDE_SPOTS.map(spot => spot.id).sort());
  for (const spot of HIDE_SPOTS) {
    assert.deepEqual({ ...spot.interactionRegion }, APPROVED_REGIONS[spot.id], spot.id);
  }
  // Beds and cartons are circles, wardrobes and shelves are 55-degree sectors.
  for (const spot of HIDE_SPOTS) {
    const expected = spot.kind === 'BED' || spot.kind === 'CARTON' ? 'CIRCLE' : 'SECTOR';
    assert.equal(spot.interactionRegion.shape, expected, spot.id);
  }
  assert.deepEqual(validateHideRegionData(), []);
});

test('the region centre follows the bound furniture and never a stored coordinate', () => {
  for (const spot of HIDE_SPOTS) {
    const own = furnitureById.get(spot.furnitureId);
    const geometry = hideRegionGeometry(spot, own);
    assert.deepEqual(geometry.centre, { x: own.x, z: own.z }, spot.id);
    assert.deepEqual(geometry.anchor, { x: spot.x, z: spot.z }, spot.id);
    assert.equal(geometry.radius, spot.interactionRegion.radius);
    // The authored `facing` points anchor -> centre; the sector axis is the
    // opposite direction, so the two facts cannot drift apart silently. The
    // authored value is rounded to four decimals, hence the 1e-4 tolerance.
    assert.ok(Math.abs(wrapToPi(geometry.axisAngle - (spot.facing + Math.PI))) < 1e-4, spot.id);
    assert.equal(geometry.halfAngleRad,
      spot.interactionRegion.shape === 'SECTOR' ? 55 * Math.PI / 180 : 0, spot.id);
  }
  assert.equal(hideRegionSetup({ ...HIDE_SPOTS[0], furnitureId: 'nope' }, FURNITURE), null);
});

test('the single enter = exit anchor of every spot is inside its own region', () => {
  for (const spot of HIDE_SPOTS) {
    const setup = setupOf(spot.id);
    assert.equal(pointInHideRegion(setup.geometry, setup.geometry.anchor), true, spot.id);
    const distance = Math.hypot(spot.x - setup.furniture.x, spot.z - setup.furniture.z);
    assert.ok(distance <= spot.interactionRegion.radius, spot.id);
  }
});

test('circle membership is exact and inclusive at the radius boundary', () => {
  const setup = setupOf('hide_living_carton');
  const { centre, radius } = setup.geometry;
  assert.equal(pointInHideRegion(setup.geometry, centre), true);
  assert.equal(pointInHideRegion(setup.geometry, { x: centre.x + radius, z: centre.z }), true);
  assert.equal(pointInHideRegion(setup.geometry, { x: centre.x, z: centre.z - radius }), true);
  assert.equal(pointInHideRegion(setup.geometry,
    { x: centre.x + radius + 1e-6, z: centre.z }), false);
  assert.equal(pointInHideRegion(setup.geometry,
    { x: centre.x + radius * 0.7072, z: centre.z + radius * 0.7072 }), false);
});

test('sector membership covers both half-angle edges and the +/-pi seam', () => {
  const setup = setupOf('hide_main_wardrobe');
  const { centre, radius, halfAngleRad, axisAngle } = setup.geometry;
  assert.ok(Math.abs(halfAngleRad - 55 * Math.PI / 180) < 1e-12);
  const at = angle => ({ x: centre.x + Math.cos(angle) * radius * 0.9,
    z: centre.z + Math.sin(angle) * radius * 0.9 });
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle)), true);
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle + halfAngleRad)), true);
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle - halfAngleRad)), true);
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle + halfAngleRad + 1e-3)), false);
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle - halfAngleRad - 1e-3)), false);
  assert.equal(pointInHideRegion(setup.geometry, at(axisAngle + Math.PI)), false);
  assert.equal(pointInHideRegion(setup.geometry,
    { x: centre.x + radius * 1.001, z: centre.z }), false);

  const seam = seamSetup();
  assert.ok(Math.abs(Math.abs(seam.geometry.axisAngle) - Math.PI) < 1e-12);
  const axis = seam.geometry.axisAngle;
  const leftOfSeam = { x: seam.geometry.centre.x - 1, z: seam.geometry.centre.z - 0.2 };
  const rightOfSeam = { x: seam.geometry.centre.x - 1, z: seam.geometry.centre.z + 0.2 };
  // The raw angle difference leaves (-pi, pi], so membership is only correct if
  // that difference is wrapped back into the interval before the comparison.
  const rawDifference = Math.atan2(leftOfSeam.z - seam.geometry.centre.z,
    leftOfSeam.x - seam.geometry.centre.x) - axis;
  assert.ok(Math.abs(rawDifference) > Math.PI);
  assert.ok(Math.abs(wrapToPi(rawDifference)) <= seam.geometry.halfAngleRad);
  assert.equal(pointInHideRegion(seam.geometry, leftOfSeam), true);
  assert.equal(pointInHideRegion(seam.geometry, rightOfSeam), true);
  assert.equal(pointInHideRegion(seam.geometry,
    { x: seam.geometry.centre.x + 1, z: seam.geometry.centre.z }), false);
});

test('furniture rotation keeps the region, a moved anchor turns the sector axis', () => {
  const spot = spotsById.get('hide_main_wardrobe');
  const authored = furnitureById.get(spot.furnitureId);
  const before = hideRegionGeometry(spot, authored);
  // A quarter turn only swaps the AABB extents; the centre cannot move.
  const turned = furnitureRect({ editKind: 'FURNITURE', id: authored.id,
    roomId: spot.roomId, x: authored.x, z: authored.z, rotationQuarter: 1,
    width: authored.width, depth: authored.depth, height: authored.height });
  assert.deepEqual([turned.x, turned.z], [authored.x, authored.z]);
  assert.deepEqual([turned.width, turned.depth], [authored.depth, authored.width]);
  const after = hideRegionGeometry(spot, turned);
  assert.deepEqual(after.centre, before.centre);
  assert.equal(after.axisAngle, before.axisAngle);
  for (const point of [{ x: -17.2, z: -6.6 }, { x: -15.8, z: -6.6 },
    { x: -16.1, z: -9.3 }]) {
    assert.equal(pointInHideRegion(after, point), pointInHideRegion(before, point));
  }
  // Moving the furniture moves the region; moving the anchor turns its axis.
  assert.notDeepEqual(hideRegionGeometry(spot, { ...authored, x: authored.x + 0.4 }).centre,
    before.centre);
  [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([dx, dz]) => {
    const anchor = { x: authored.x + dx, z: authored.z + dz };
    assert.ok(Math.abs(wrapToPi(hideRegionAxisAngle(authored, anchor)
      - Math.atan2(dz, dx))) < 1e-12, `${dx},${dz}`);
    const geometry = hideRegionGeometry({ ...spot, x: anchor.x, z: anchor.z }, authored);
    assert.equal(pointInHideRegion(geometry,
      { x: authored.x + dx * 1.5, z: authored.z + dz * 1.5 }), true, `${dx},${dz}`);
    assert.equal(pointInHideRegion(geometry,
      { x: authored.x - dx * 1.5, z: authored.z - dz * 1.5 }), false, `${dx},${dz}`);
  });
});

test('the interaction aims at the exposed furniture surface, not the centre', () => {
  for (const spot of HIDE_SPOTS) {
    const setup = setupOf(spot.id);
    const anchor = setup.geometry.anchor;
    // Aiming at the centre would be blocked by the furniture itself from every
    // one of the eight anchors, which is exactly what the surface aim avoids.
    assert.equal(crossesRect(anchor, { x: setup.furniture.x, z: setup.furniture.z },
      setup.furniture), true, spot.id);
    assert.equal(hideRegionSurfaceClear(setup, anchor, world), true, spot.id);
    const check = checkHideRegionPosition(setup, anchor, world);
    assert.equal(check.code, 'LEGAL', `${spot.id}: ${check.code}`);
    assert.equal(check.insideRegion && check.standable && check.surfaceClear &&
      check.navigable, true, spot.id);
    assert.equal(check.legal, true, spot.id);
  }
});

test('a standable position behind a wall is rejected by the surface route', () => {
  const setup = setupOf('hide_storage_carton');
  const behindWall = { x: 14.6, z: -4.8 };
  // Really the other side of the storage/kitchen wall, and really standable.
  assert.equal(roomAt(behindWall.x, behindWall.z).id, 'kitchen');
  assert.equal(roomAt(setup.geometry.anchor.x, setup.geometry.anchor.z).id, 'storage');
  const check = checkHideRegionPosition(setup, behindWall, world);
  assert.equal(check.insideRegion, true);
  assert.equal(check.standable, true);
  assert.equal(check.navigable, true);
  assert.equal(check.surfaceClear, false);
  assert.equal(check.legal, false);
  assert.equal(check.code, 'SURFACE_BLOCKED');

  // The larger living-carton circle reaches across a wall too, but the actor
  // circle cannot stand there, so it creates no legal position either.
  const living = setupOf('hide_living_carton');
  const intoDining = { x: 9.05, z: 4.2 };
  assert.equal(roomAt(intoDining.x, intoDining.z).id, 'dining');
  const diningCheck = checkHideRegionPosition(living, intoDining, world);
  assert.equal(diningCheck.insideRegion, true);
  assert.equal(diningCheck.standable, false);
  assert.equal(diningCheck.legal, false);
  assert.equal(diningCheck.code, 'NOT_STANDABLE');
});

test('legal positions exist, stay in their own room and reach the anchor', () => {
  for (const spot of HIDE_SPOTS) {
    const setup = setupOf(spot.id);
    const preview = sampleHideRegion(setup, world, { step: 0.1 });
    assert.ok(preview.legalSamples > 0, `${spot.id} needs at least one legal position`);
    const legal = preview.samples.filter(sample => sample.legal);
    for (const sample of legal.slice(0, 3)) {
      assert.ok(world.navigation.findPath(setup.geometry.anchor, sample,
        world.doors.doors)?.length, `${spot.id} ${sample.x},${sample.z} unreachable`);
    }
    for (const sample of legal) {
      const room = roomAt(sample.x, sample.z);
      assert.ok(!room || room.id === spot.roomId,
        `${spot.id} legal sample (${sample.x},${sample.z}) sits in ${room?.id}`);
    }
  }
});

test('the sampled preview is explicitly discrete, consistent and step dependent', () => {
  const setup = setupOf('hide_main_bed');
  const coarse = sampleHideRegion(setup, world);
  const fine = sampleHideRegion(setup, world, { step: 0.15 });
  assert.equal(coarse.discrete, true);
  assert.equal(coarse.method, 'LATTICE');
  assert.equal(coarse.step, DEFAULT_REGION_SAMPLE_STEP);
  assert.equal(coarse.reachabilityEvaluated, false);
  assert.equal(coarse.spotId, 'hide_main_bed');
  assert.deepEqual(coarse.geometry.centre, setup.geometry.centre);
  assert.equal(fine.discrete, true);
  assert.equal(fine.reachabilityEvaluated, false);
  // A discrete sampling is step dependent by definition: its counts must never
  // be read as the exact continuous area of the region.
  assert.notEqual(coarse.samples.length, fine.samples.length);
  assert.ok(fine.samples.length > coarse.samples.length);
  for (const preview of [coarse, fine]) {
    assert.equal(preview.legalSamples,
      preview.samples.filter(sample => sample.legal).length);
    for (const sample of preview.samples) {
      assert.equal(pointInHideRegion(setup.geometry, sample), true);
      assert.equal(sample.legal,
        sample.standable && sample.surfaceClear && sample.navigable,
        `${sample.x},${sample.z}`);
      if (!sample.legal) assert.notEqual(sample.code, 'LEGAL');
    }
  }
  assert.throws(() => sampleHideRegion(setup, world, { step: 0 }), /正的栅格步长/);
  assert.throws(() => sampleHideRegion(setup, world, { step: Number.NaN }), /正的栅格步长/);
});

test('omitting door states is the same as every door at its authored state', () => {
  const setup = setupOf('hide_main_bed');
  const withStates = checkHideRegionPosition(setup, setup.geometry.anchor,
    { ...world, doorStates: world.doors.doors });
  const withoutStates = checkHideRegionPosition(setup, setup.geometry.anchor, world);
  assert.deepEqual(withStates, withoutStates);
  assert.deepEqual(world.doors.doors.map(door => door.state),
    DOOR_NODES.map(door => door.initialState));
});

test('region data validation reports every malformed case', () => {
  const base = spotsById.get('hide_main_wardrobe');
  const codes = spots => validateHideRegionData(spots, FURNITURE).map(issue => issue.code);
  assert.deepEqual(codes([{ ...base, interactionRegion: undefined }]), ['MISSING_REGION']);
  assert.deepEqual(codes([{ ...base, furnitureId: 'nope' }]), ['UNKNOWN_FURNITURE']);
  assert.deepEqual(codes([{ ...base, interactionRegion: { shape: 'CIRCLE', radius: 0 } }]),
    ['INVALID_RADIUS']);
  assert.deepEqual(codes([{ ...base, interactionRegion: { shape: 'CIRCLE', radius: -1 } }]),
    ['INVALID_RADIUS']);
  assert.deepEqual(codes([{ ...base,
    interactionRegion: { shape: 'SECTOR', radius: 1.6, halfAngleDeg: 200 } }]),
  ['INVALID_HALF_ANGLE']);
  assert.deepEqual(codes([{ ...base,
    interactionRegion: { shape: 'SECTOR', radius: 1.6 } }]), ['INVALID_HALF_ANGLE']);
  assert.deepEqual(codes([{ ...base,
    interactionRegion: { shape: 'CIRCLE', radius: 1.6, halfAngleDeg: 55 } }]),
  ['UNEXPECTED_HALF_ANGLE']);
  assert.deepEqual(codes([{ ...base, x: -14, z: -5 }]), ['ANCHOR_OUTSIDE_REGION']);
  assert.equal(sectorHalfAngleRadians({ shape: 'CIRCLE', radius: 1 }), 0);
  assert.ok(Math.abs(sectorHalfAngleRadians({ shape: 'SECTOR', radius: 1, halfAngleDeg: 90 })
    - Math.PI / 2) < 1e-12);
});

test('the DEV scene editor still round-trips anchors and gains no region editing', () => {
  const session = new MapEditSession();
  const anchors = draftSpotsToAnchors(session.hideSpotList());
  assert.equal(anchors.length, 8);
  for (const anchor of anchors) {
    const authored = spotsById.get(anchor.id);
    assert.equal(anchor.x, authored.x);
    assert.equal(anchor.z, authored.z);
    assert.equal(anchor.facing, authored.facing);
    assert.equal(anchor.kind, authored.kind);
    assert.equal(anchor.label, authored.label);
    // The authored region is carried through unchanged and is not editable yet.
    assert.deepEqual(anchor.interactionRegion, authored.interactionRegion);
    assert.equal(session.setField(anchor.id, 'interactionRegion', 1)?.code,
      'READ_ONLY_FIELD');
  }
  const moved = new MapEditSession();
  assert.equal(moved.setField('hide_living_carton', 'x', 6.6), null);
  const movedAnchor = draftSpotsToAnchors(moved.hideSpotList())
    .find(anchor => anchor.id === 'hide_living_carton');
  assert.equal(movedAnchor.x, 6.6);
  assert.deepEqual(movedAnchor.interactionRegion,
    spotsById.get('hide_living_carton').interactionRegion);
});
