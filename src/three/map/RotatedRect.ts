import type { Point } from './apartmentMap.ts';

// DEV-A-FIX-2: one shared rotated-rectangle geometry for the whole map pipeline.
// Everything here works on the XZ ground plane with Y up, and a rotation of 0 is
// always identical to the axis-aligned maths used before this module existed, so
// the authored map and every previously accepted behaviour stay unchanged.
//
// Rotation convention (must match THREE.Object3D.rotation.y):
//   world.x = centre.x + local.x * cos + local.z * sin
//   world.z = centre.z - local.x * sin + local.z * cos
// At 90 degrees a width x depth rectangle therefore spans depth along world X and
// width along world Z, which is exactly the quarter-turn swap used previously.

export const TWO_PI = Math.PI * 2;

export interface RotatedRect {
  x: number;
  z: number;
  width: number;
  depth: number;
  // Radians. Missing/undefined means 0 (an axis-aligned rectangle).
  rotation?: number;
}

export interface LocalRect {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
}

export function normalizeRadians(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

// Authoring degrees live in [0, 360): negative and multiple-turn inputs are
// folded in rather than rejected, so 370 and -10 both mean 350.
export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

export function snapDegrees(degrees: number, stepDegrees: number): number {
  if (!Number.isFinite(stepDegrees) || stepDegrees <= 0) return normalizeDegrees(degrees);
  return normalizeDegrees(Math.round(degrees / stepDegrees) * stepDegrees);
}

export function rectRotation(rect: RotatedRect): number {
  return rect.rotation ?? 0;
}

export function rectLocal(rect: RotatedRect): LocalRect {
  return { x: rect.x, z: rect.z, halfWidth: rect.width / 2, halfDepth: rect.depth / 2 };
}

export function localToWorld(rect: RotatedRect, local: Point): Point {
  const rotation = rectRotation(rect);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: rect.x + local.x * cos + local.z * sin,
    z: rect.z - local.x * sin + local.z * cos };
}

export function worldToLocal(rect: RotatedRect, world: Point): Point {
  const rotation = rectRotation(rect);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = world.x - rect.x;
  const dz = world.z - rect.z;
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
}

// The rectangle's local +X and +Z axes expressed in world space.
export function rectAxes(rect: RotatedRect): { forward: Point; side: Point } {
  const rotation = rectRotation(rect);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { forward: { x: cos, z: -sin }, side: { x: sin, z: cos } };
}

// Four world-space corners, in local (-x,-z) -> (+x,-z) -> (+x,+z) -> (-x,+z)
// order (clockwise when viewed from above with Z pointing "down" the screen).
export function rectCorners(rect: RotatedRect): Point[] {
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  return [
    localToWorld(rect, { x: -halfWidth, z: -halfDepth }),
    localToWorld(rect, { x: halfWidth, z: -halfDepth }),
    localToWorld(rect, { x: halfWidth, z: halfDepth }),
    localToWorld(rect, { x: -halfWidth, z: halfDepth }),
  ];
}

// Axis-aligned bounding box of the (possibly rotated) rectangle. For rotation 0
// this is the rectangle itself; for the axis-aligned quarter turns it is the
// exact swapped box (no floating-point noise), and for any other angle it is
// broad-phase data only.
export function rectBoundingAabb(rect: RotatedRect): { x: number; z: number;
  width: number; depth: number } {
  const rotation = rectRotation(rect);
  if (rotation === 0) {
    return { x: rect.x, z: rect.z, width: rect.width, depth: rect.depth };
  }
  const quarter = rotation / (Math.PI / 2);
  if (Math.abs(quarter - Math.round(quarter)) < 1e-12) {
    const turns = ((Math.round(quarter) % 4) + 4) % 4;
    const swapped = turns % 2 !== 0;
    return { x: rect.x, z: rect.z,
      width: swapped ? rect.depth : rect.width,
      depth: swapped ? rect.width : rect.depth };
  }
  const corners = rectCorners(rect);
  const xs = corners.map(point => point.x);
  const zs = corners.map(point => point.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  return { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
    width: maxX - minX, depth: maxZ - minZ };
}

// Projection radius of an oriented rectangle onto a unit axis.
function projectionRadius(rect: RotatedRect, axis: Point): number {
  const { forward, side } = rectAxes(rect);
  return Math.abs((forward.x * axis.x + forward.z * axis.z)) * rect.width / 2 +
    Math.abs((side.x * axis.x + side.z * axis.z)) * rect.depth / 2;
}

// Separating-axis test for two oriented rectangles. `epsilon` shrinks both
// shapes so that rectangles which merely touch do not count as overlapping; with
// the default it reproduces the previous axis-aligned epsilon comparison.
export function rectsOverlap(a: RotatedRect, b: RotatedRect, epsilon = 0): boolean {
  const axesA = rectAxes(a);
  const axesB = rectAxes(b);
  const axes: Point[] = [
    axesA.forward, axesA.side, axesB.forward, axesB.side,
  ];
  const delta = { x: b.x - a.x, z: b.z - a.z };
  for (const axis of axes) {
    const distance = Math.abs(delta.x * axis.x + delta.z * axis.z);
    const sum = projectionRadius(a, axis) + projectionRadius(b, axis) - epsilon / 2;
    if (distance > sum) return false;
  }
  return true;
}

// Strict overlap between a circle and an oriented rectangle (touching is not an
// overlap), matching CollisionWorld.circleIntersectsAabbXZ.
export function circleIntersectsRect(x: number, z: number, radius: number,
  rect: RotatedRect, epsilon = 0): boolean {
  const local = worldToLocal(rect, { x, z });
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  const closestX = Math.max(-halfWidth, Math.min(local.x, halfWidth));
  const closestZ = Math.max(-halfDepth, Math.min(local.z, halfDepth));
  const deltaX = local.x - closestX;
  const deltaZ = local.z - closestZ;
  const contactRadius = Math.max(0, radius - epsilon);
  return deltaX * deltaX + deltaZ * deltaZ < contactRadius * contactRadius;
}

// Square (Chebyshev) inflation in the rectangle's own frame: a point counts as
// covered when it is within `radius` of the footprint along both local axes.
// This is the stricter map-authoring test (it is what tests/apartment-map.test.mjs
// mirrors for the authored, unrotated map) and is inclusive on the boundary.
export function pointInsideInflatedRect(x: number, z: number, radius: number,
  rect: RotatedRect): boolean {
  const local = worldToLocal(rect, { x, z });
  return Math.abs(local.x) <= rect.width / 2 + radius &&
    Math.abs(local.z) <= rect.depth / 2 + radius;
}

export function pointInRect(point: Point, rect: RotatedRect, margin = 0): boolean {
  const local = worldToLocal(rect, point);
  return Math.abs(local.x) <= rect.width / 2 + margin &&
    Math.abs(local.z) <= rect.depth / 2 + margin;
}

// Shortest XZ distance from a point to the rectangle (0 inside it).
export function distanceToRect(point: Point, rect: RotatedRect): number {
  const local = worldToLocal(rect, point);
  const dx = Math.max(0, Math.abs(local.x) - rect.width / 2);
  const dz = Math.max(0, Math.abs(local.z) - rect.depth / 2);
  return Math.hypot(dx, dz);
}

// 2D segment/oriented-rectangle test using the same slab clip as the previous
// axis-aligned helper, evaluated in the rectangle's local frame.
export function segmentIntersectsRect(a: Point, b: Point, rect: RotatedRect): boolean {
  const localA = worldToLocal(rect, a);
  const localB = worldToLocal(rect, b);
  const minX = -rect.width / 2, maxX = rect.width / 2;
  const minZ = -rect.depth / 2, maxZ = rect.depth / 2;
  let enter = 0;
  let exit = 1;
  const clip = (start: number, end: number, min: number, max: number): boolean => {
    const delta = end - start;
    if (Math.abs(delta) < 1e-9) return start >= min && start <= max;
    const one = (min - start) / delta;
    const two = (max - start) / delta;
    enter = Math.max(enter, Math.min(one, two));
    exit = Math.min(exit, Math.max(one, two));
    return enter <= exit;
  };
  return clip(localA.x, localB.x, minX, maxX) && clip(localA.z, localB.z, minZ, maxZ);
}

// The point on the rectangle's exposed surface that an interaction from `from`
// should aim at: the nearest footprint boundary point, never the centre. Aiming
// at the centre would make the piece block every position on its own near side.
// Deterministic for a point on or inside the footprint.
export function rectSurfacePoint(rect: RotatedRect, from: Point): Point {
  const halfWidth = rect.width / 2;
  const halfDepth = rect.depth / 2;
  const local = worldToLocal(rect, from);
  if (Math.abs(local.x) > halfWidth || Math.abs(local.z) > halfDepth) {
    return localToWorld(rect, {
      x: Math.max(-halfWidth, Math.min(local.x, halfWidth)),
      z: Math.max(-halfDepth, Math.min(local.z, halfDepth)) });
  }
  // Inside the footprint the nearest boundary lies on the dominant local axis.
  return Math.abs(local.x) / halfWidth >= Math.abs(local.z) / halfDepth
    ? localToWorld(rect, { x: local.x < 0 ? -halfWidth : halfWidth, z: local.z })
    : localToWorld(rect, { x: local.x, z: local.z < 0 ? -halfDepth : halfDepth });
}

// Rotates a point around a centre by `angle` radians, using the same sign
// convention as THREE.Object3D.rotation.y.
export function rotatePointAround(centre: Point, point: Point, angle: number): Point {
  const dx = point.x - centre.x;
  const dz = point.z - centre.z;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: centre.x + dx * cos + dz * sin, z: centre.z - dx * sin + dz * cos };
}
