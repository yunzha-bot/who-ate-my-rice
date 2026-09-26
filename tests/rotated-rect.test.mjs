import assert from 'node:assert/strict';
import test from 'node:test';
import {
  circleIntersectsRect, degreesToRadians, distanceToRect, localToWorld, normalizeDegrees,
  pointInRect, pointInsideInflatedRect, radiansToDegrees, rectAxes, rectBoundingAabb,
  rectCorners, rectRotation, rectSurfacePoint, rectsOverlap, rotatePointAround,
  segmentIntersectsRect, snapDegrees, worldToLocal,
} from '../src/three/map/RotatedRect.ts';

// DEV-A-FIX-2 geometry. The axis-aligned (rotation 0) expectations are copied
// from the previously accepted behaviour, because the whole point of this module
// is that 0/90/180/270 degrees behave exactly as before.

const rect = (x, z, width, depth, rotation = 0) => ({ x, z, width, depth, rotation });
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);
// Computed points can carry a negative zero; compare components, not identities.
const samePoint = (actual, expected, label) => {
  close(actual.x, expected.x, `${label}.x`);
  close(actual.z, expected.z, `${label}.z`);
};

test('an unrotated rectangle keeps the previous axis-aligned maths exactly', () => {
  const plain = rect(1, -2, 2, 1);
  assert.equal(rectRotation({ x: 0, z: 0, width: 1, depth: 1 }), 0);
  const corners = rectCorners(plain);
  samePoint(corners[0], { x: 0, z: -2.5 }, 'corner 0');
  samePoint(corners[1], { x: 2, z: -2.5 }, 'corner 1');
  samePoint(corners[2], { x: 2, z: -1.5 }, 'corner 2');
  samePoint(corners[3], { x: 0, z: -1.5 }, 'corner 3');
  const bounds = rectBoundingAabb(plain);
  samePoint(bounds, { x: 1, z: -2 }, 'bounding centre');
  close(bounds.width, 2, 'bounding width');
  close(bounds.depth, 1, 'bounding depth');
  samePoint(localToWorld(plain, { x: 0.5, z: -0.25 }), { x: 1.5, z: -2.25 }, 'localToWorld');
  samePoint(worldToLocal(plain, { x: 1.5, z: -2.25 }), { x: 0.5, z: -0.25 }, 'worldToLocal');
  const axes = rectAxes(plain);
  samePoint(axes.forward, { x: 1, z: 0 }, 'forward axis');
  samePoint(axes.side, { x: 0, z: 1 }, 'side axis');
  // Distance and inflation behave like the old rectDistanceXZ / pointInsideInflatedRect.
  close(distanceToRect({ x: 1, z: -2 }, plain), 0, 'inside');
  close(distanceToRect({ x: 3, z: -2 }, plain), 1, 'east');
  close(distanceToRect({ x: 3, z: -3.5 }, plain), Math.hypot(1, 1), 'corner');
  assert.equal(pointInsideInflatedRect(2.5, -2, 0.5, plain), true,
    'the inflated boundary is inclusive');
  assert.equal(pointInsideInflatedRect(2.5001, -2, 0.5, plain), false);
  assert.equal(pointInsideInflatedRect(2.45, -2.45, 0.5, plain), true);
  // Square (Chebyshev) inflation: this corner point is outside the rounded
  // 0.5 radius but still inside the old square test, which map authoring keeps.
  assert.equal(Math.hypot(0.45, 0.45) > 0.5, true);
  assert.equal(pointInsideInflatedRect(2.45, -2.95, 0.5, plain), true,
    'the authoring test stays square (Chebyshev), not rounded');
  assert.equal(pointInsideInflatedRect(2.51, -2.51, 0.5, plain), false);
  assert.equal(pointInRect({ x: 1.99, z: -2 }, plain), true);
  assert.equal(pointInRect({ x: 2.01, z: -2 }, plain), false);
});

test('a 90 degree rotation is exactly the previous width/depth swap', () => {
  const turned = rect(0, 0, 2, 1, Math.PI / 2);
  const corners = rectCorners(turned);
  samePoint(corners[0], { x: -0.5, z: 1 }, 'corner 0');
  samePoint(corners[1], { x: -0.5, z: -1 }, 'corner 1');
  samePoint(corners[2], { x: 0.5, z: -1 }, 'corner 2');
  samePoint(corners[3], { x: 0.5, z: 1 }, 'corner 3');
  const bounds = rectBoundingAabb(turned);
  close(bounds.width, 1, 'swapped width');
  close(bounds.depth, 2, 'swapped depth');
  // The previously accepted overlap rule for a quarter-turned piece.
  assert.equal(rectsOverlap(turned, rect(0.4, 0, 1, 1), 0.001), true);
  assert.equal(rectsOverlap(turned, rect(1.2, 0, 1, 1), 0.001), false);
});

test('rotation follows the THREE.Object3D.rotation.y convention at every quadrant', () => {
  const square = rect(0, 0, 2, 2, 0);
  const at = degrees => localToWorld({ ...square, rotation: degreesToRadians(degrees) },
    { x: 1, z: 0 });
  samePoint(at(0), { x: 1, z: 0 }, '0 degrees');
  samePoint(at(90), { x: 0, z: -1 }, '90 degrees');
  samePoint(at(180), { x: -1, z: 0 }, '180 degrees');
  samePoint(at(270), { x: 0, z: 1 }, '270 degrees');
  // worldToLocal is the exact inverse at an arbitrary angle.
  const tilted = rect(-3, 4, 1.3, 0.7, degreesToRadians(37));
  for (const point of [{ x: -2, z: 4.4 }, { x: -4.5, z: 3 }, { x: -3, z: 4 }]) {
    samePoint(localToWorld(tilted, worldToLocal(tilted, point)), point, 'round trip');
  }
});

test('circle, segment and rect overlap tests agree with their axis-aligned originals', () => {
  const wall = rect(0.5, 0, 1, 2);
  assert.equal(circleIntersectsRect(-0.31, 0, 0.3, wall), false);
  assert.equal(circleIntersectsRect(-0.3, 0, 0.3, wall), false);
  assert.equal(circleIntersectsRect(-0.29, 0, 0.3, wall), true);
  assert.equal(circleIntersectsRect(-0.2, -0.2, 0.3, rect(0.5, 0.5, 1, 1)), true);

  const box = rect(0, 0, 2, 2);
  assert.equal(segmentIntersectsRect({ x: -5, z: 0 }, { x: 5, z: 0 }, box), true);
  assert.equal(segmentIntersectsRect({ x: -5, z: 0.9 }, { x: 5, z: 0.9 }, box), true);
  assert.equal(segmentIntersectsRect({ x: -5, z: 1.5 }, { x: 5, z: 1.5 }, box), false);
  assert.equal(segmentIntersectsRect({ x: 3, z: 0 }, { x: 5, z: 0 }, box), false);

  assert.equal(rectsOverlap(rect(0, 0, 2, 2), rect(1.9, 0, 2, 2), 0.001), true);
  assert.equal(rectsOverlap(rect(0, 0, 2, 2), rect(2.0, 0, 2, 2), 0.001), false,
    'rectangles that only touch are not overlapping');
  // A 45-degree square reaches sqrt(2) along each world axis, so it still touches
  // a square at 1.7 but not one pushed out to 2.6.
  assert.equal(rectsOverlap(rect(0, 0, 2, 2, degreesToRadians(45)),
    rect(1.7, 0, 2, 2), 0.001), true);
  assert.equal(rectsOverlap(rect(0, 0, 2, 2, degreesToRadians(45)),
    rect(2.6, 0, 2, 2), 0.001), false);
});

test('rotated overlap and distance are real geometry, not the bounding AABB', () => {
  const diagonal = rect(0, 0, 2, 2, degreesToRadians(45));
  const bounds = rectBoundingAabb(diagonal);
  close(bounds.width, Math.hypot(2, 2), 'diagonal bounding width');
  // A point just inside the bounding AABB corner is still outside the true shape.
  const cornerProbe = { x: bounds.width / 2 - 0.05, z: bounds.depth / 2 - 0.05 };
  assert.equal(pointInRect(cornerProbe, diagonal), false);
  assert.equal(distanceToRect(cornerProbe, diagonal) > 0.2, true);
  // Another square placed in that AABB corner does not really overlap.
  const fake = rect(cornerProbe.x + 0.6, cornerProbe.z + 0.6, 1, 1);
  assert.equal(rectsOverlap(diagonal, fake, 0.001), false);
  assert.equal(rectsOverlap(diagonal, rect(0, 0, 2, 2), 0.001), true);
});

test('the surface aim point is on the true rotated boundary, never the centre', () => {
  // A 2 x 1 piece turned 90 degrees spans x in [-0.5, 0.5] and z in [-1, 1].
  const piece = rect(0, 0, 2, 1, degreesToRadians(90));
  const target = rectSurfacePoint(piece, { x: 0, z: 2 });
  samePoint(target, { x: 0, z: 1 }, 'aim point');
  assert.equal(pointInRect(target, piece, 1e-9), true);
  // Inside the footprint the choice is deterministic and lands on an edge.
  const inside = rectSurfacePoint(piece, { x: 0.05, z: 0.05 });
  const local = worldToLocal(piece, inside);
  assert.equal(Math.abs(Math.abs(local.x) - 1) < 1e-9 ||
    Math.abs(Math.abs(local.z) - 0.5) < 1e-9, true);
  // Axis-aligned behaviour is unchanged.
  const plain = rect(0, 0, 2, 1);
  samePoint(rectSurfacePoint(plain, { x: 4, z: 0 }), { x: 1, z: 0 }, 'east aim');
  samePoint(rectSurfacePoint(plain, { x: 0, z: -4 }), { x: 0, z: -0.5 }, 'south aim');
  samePoint(rectSurfacePoint(plain, { x: 0, z: 0 }), { x: 1, z: 0 }, 'centre aim');
});

test('degree helpers normalize, snap and round-trip', () => {
  assert.equal(normalizeDegrees(0), 0);
  assert.equal(normalizeDegrees(359.9), 359.9);
  assert.equal(normalizeDegrees(360), 0);
  assert.equal(normalizeDegrees(-10), 350);
  assert.equal(normalizeDegrees(725), 5);
  assert.equal(snapDegrees(7, 15), 0);
  assert.equal(snapDegrees(8, 15), 15);
  assert.equal(snapDegrees(352, 15), 345, '352 is 7 away from 345 and 8 away from 360');
  assert.equal(snapDegrees(353, 15), 0, '353 snaps up to 360 -> 0');
  assert.equal(snapDegrees(7, 0), 7, 'a disabled snap is a no-op');
  assert.equal(snapDegrees(-8, 15), 345);
  close(radiansToDegrees(degreesToRadians(37)), 37, 'degree round trip');
  close(degreesToRadians(90), Math.PI / 2, 'radians');
});

test('rotating a point around a centre matches the anchor-follow convention', () => {
  const centre = { x: 2, z: -3 };
  const point = { x: 3.2, z: -3.6 };
  const quarter = rotatePointAround(centre, point, Math.PI / 2);
  samePoint(quarter, { x: centre.x - 0.6, z: centre.z - 1.2 }, 'quarter turn');
  samePoint(rotatePointAround(centre, point, Math.PI * 2), point, 'full turn');
});
