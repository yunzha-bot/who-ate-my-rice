import assert from 'node:assert/strict';
import test from 'node:test';
import { Box3, OrthographicCamera, Vector3 } from 'three';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';
import { SprintSystem } from '../src/systems/SprintSystem.ts';
import { cameraRelativeDirection } from '../src/three/CameraRelativeMovement.ts';
import { CollisionWorld, circleIntersectsAabbXZ } from '../src/three/CollisionWorld.ts';
import { circleIntersectsRect, degreesToRadians } from '../src/three/map/RotatedRect.ts';

const box = (minX, maxX, minZ, maxZ) =>
  new Box3(new Vector3(minX, 0, minZ), new Vector3(maxX, 1, maxZ));
const point = (x, z) => new Vector3(x, 0.35, z);
const world = (...obstacles) => new CollisionWorld(5, 5, obstacles);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `expected ${actual} to equal ${expected}`);
const radius = 0.3;

test('configured player circle is independent from visual width and capture radius', () => {
  const visualHalfWidth =
    GAME_CONFIG.player.size / GAME_CONFIG.three.pixelsPerUnit / 2;
  assert.ok(GAME_CONFIG.collision.playerRadius < visualHalfWidth);
  assert.notEqual(GAME_CONFIG.collision.playerRadius, GAME_CONFIG.match.captureRadius);
});

test('circle outside, touching and overlapping a wall AABB are distinguished', () => {
  const wall = box(0, 1, -1, 1);
  assert.equal(circleIntersectsAabbXZ(-0.31, 0, radius, wall), false);
  assert.equal(circleIntersectsAabbXZ(-0.3, 0, radius, wall), false);
  assert.equal(circleIntersectsAabbXZ(-0.29, 0, radius, wall), true);
});

test('circle detects an AABB corner by closest-point distance', () => {
  const obstacle = box(0, 1, 0, 1);
  assert.equal(circleIntersectsAabbXZ(-0.22, -0.22, radius, obstacle), false);
  assert.equal(circleIntersectsAabbXZ(-0.2, -0.2, radius, obstacle), true);
});

test('3D actor remains inside the room bounds', () => {
  const collision = new CollisionWorld(5, 4, []);
  const start = point(4.5, 0);
  close(collision.move(start, 1, 0, 0.5, 0.7).x, 4.5);
  close(collision.move(start, 0, 1, 0.5, 0.7).z, 1);
});

test('X blocked by a wall still preserves Z sliding', () => {
  const collision = world(box(0, 0.2, -2, 2));
  const next = collision.move(point(-0.3, 0), 0.4, 0.4, radius, 0.7);
  close(next.x, -0.3);
  close(next.z, 0.4);
});

test('Z blocked by a wall still preserves X sliding', () => {
  const collision = world(box(-2, 2, 0, 0.2));
  const next = collision.move(point(0, -0.3), 0.4, 0.4, radius, 0.7);
  close(next.x, 0.4);
  close(next.z, -0.3);
});

test('unobstructed diagonal move preserves both components', () => {
  const next = world().move(point(-1, -1), 0.4, 0.4, radius, 0.7);
  close(next.x, -0.6);
  close(next.z, -0.6);
});

test('a genuine inner corner blocks both axes without jitter or penetration', () => {
  const collision = world(box(0, 0.2, -2, 2), box(-2, 2, 0, 0.2));
  let position = point(-0.3, -0.3);
  for (let frame = 0; frame < 20; frame++) {
    position = collision.move(position, 0.1, 0.1, radius, 0.7);
    close(position.x, -0.3);
    close(position.z, -0.3);
  }
});

test('rounded actor footprint passes an outer wall corner without a square-box snag', () => {
  const next = world(box(0, 1, 0, 1)).move(
    point(-0.4, -0.4), 0.15, 0.15, radius, 0.7);
  close(next.x, -0.25);
  close(next.z, -0.25);
});

test('a centered hit on one convex corner chooses a stable tangent instead of sticking', () => {
  const collision = world(box(0, 1, 0, 1));
  let position = point(-0.25, -0.25);
  for (let frame = 0; frame < 20; frame++) {
    position = collision.move(position, 0.05, 0.05,
      GAME_CONFIG.collision.playerRadius, 0.7);
  }
  assert.ok(position.x > 0.5 || position.z > 0.5,
    `centered convex-corner movement stuck at ${position.x}, ${position.z}`);
  assert.ok(position.x < -GAME_CONFIG.collision.playerRadius ||
    position.z < -GAME_CONFIG.collision.playerRadius,
  'the chosen tangent must remain outside the obstacle');
});

test('all four held screen diagonals slide around a convex corner without penetration', () => {
  const camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 100);
  camera.position.set(12, 14, 12);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const cases = [
    { keys: 'W+D', screen: { x: 1, y: -1 }, start: point(-0.2, 0.5), obstacle: box(0, 1, -1, 0) },
    { keys: 'A+S', screen: { x: -1, y: 1 }, start: point(-0.2, -0.5), obstacle: box(0, 1, 0, 1) },
    { keys: 'W+A', screen: { x: -1, y: -1 }, start: point(0.5, -0.2), obstacle: box(-1, 0, 0, 1) },
    { keys: 'S+D', screen: { x: 1, y: 1 }, start: point(-0.5, -0.2), obstacle: box(0, 1, 0, 1) },
  ];
  for (const { keys, screen, start, obstacle } of cases) {
    const direction = cameraRelativeDirection(camera, screen);
    assert.ok(Math.min(Math.abs(direction.x), Math.abs(direction.y)) < 1e-10,
      `${keys} should map close to one world axis at this camera angle`);
    const collision = world(obstacle);
    let position = start;
    for (let frame = 0; frame < 20; frame++) {
      position = collision.move(
        position, direction.x * 0.05, direction.y * 0.05, radius, 0.7);
      const nearestX = Math.max(obstacle.min.x, Math.min(position.x, obstacle.max.x));
      const nearestZ = Math.max(obstacle.min.z, Math.min(position.z, obstacle.max.z));
      assert.ok(Math.hypot(position.x - nearestX, position.z - nearestZ) >=
        0.3 - GAME_CONFIG.collision.contactEpsilon - 1e-9, `${keys} penetrated the corner`);
    }
    const forward = (position.x - start.x) * direction.x +
      (position.z - start.z) * direction.y;
    const sideways = Math.abs((position.x - start.x) * -direction.y +
      (position.z - start.z) * direction.x);
    assert.ok(forward > 0.35, `${keys} stalled at the corner: ${forward}`);
    assert.ok(sideways > 0.05, `${keys} did not slide along the corner: ${sideways}`);
  }
});

test('two connected wall segments form an L-shaped outer corner that can be skirted', () => {
  const upright = box(0, 0.18, 0, 2);
  const crossbar = box(0, 2, 0, 0.18);
  const collision = world(upright, crossbar);
  let position = point(-0.5, -0.2);
  for (let frame = 0; frame < 20; frame++) {
    position = collision.move(position, 0.05, 0, radius, 0.7);
  }
  assert.ok(position.x > 0.2, `held movement stopped at L junction: ${position.x}`);
  assert.ok(position.z < -0.25, `did not slide beneath the L junction: ${position.z}`);
});

test('furniture uses the same rounded contact and axis-separated sliding as walls', () => {
  const sofa = box(0, 1, -1, 1);
  const next = world(sofa).move(point(-0.3, 0), 0.4, 0.4, radius, 0.7);
  close(next.x, -0.3);
  close(next.z, 0.4);
});

test('diagonal entry through a door gap remains passable without crossing its jambs', () => {
  const collision = world(box(-2, -0.7, -0.1, 0.1), box(0.7, 2, -0.1, 0.1));
  const next = collision.move(point(0.3, -0.8), 0.1, 1.6, radius, 0.7);
  assert.ok(next.z > 0.5);
  assert.ok(next.x < 0.7);
});

test('substeps prevent a large frame or sprint from tunneling through a thin wall', () => {
  const collision = world(box(0, 0.05, -2, 2));
  const next = collision.move(point(-1, 0), 2, 0.4, radius, 0.7);
  assert.ok(next.x < 0);
  assert.ok(next.z > 0);
});

test('sprint preserves free-axis motion and its normal timer when one axis hits a wall', () => {
  const collision = world(box(0, 0.2, -2, 2));
  const sprint = new SprintSystem(GAME_CONFIG.sprint.durationMs,
    GAME_CONFIG.sprint.riskThreshold, GAME_CONFIG.sprint.stunMs);
  const direction = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  assert.equal(sprint.tryStart(direction, 0), true);
  sprint.advance(50, direction);
  const movement = sprint.movementDirection(direction);
  const speed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
    GAME_CONFIG.sprint.speedMultiplier;
  const next = collision.move(point(-0.3, 0), movement.x * speed * 0.05,
    movement.y * speed * 0.05, radius, 0.7);
  close(next.x, -0.3);
  assert.ok(next.z > 0);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  assert.equal(sprint.sprintRemainingMs, GAME_CONFIG.sprint.durationMs - 50);
});

test('sprint into two real blockers stops position but not timer or 30% fall rule', () => {
  const collision = world(box(0, 0.2, -2, 2), box(-2, 2, 0, 0.2));
  const sprint = new SprintSystem(GAME_CONFIG.sprint.durationMs,
    GAME_CONFIG.sprint.riskThreshold, GAME_CONFIG.sprint.stunMs);
  const direction = { x: 1, y: 1 };
  assert.equal(sprint.tryStart(direction, GAME_CONFIG.sprint.riskThreshold), true);
  let position = point(-0.3, -0.3);
  for (let frame = 0; frame < 50; frame++) {
    sprint.advance(50, direction);
    const movement = sprint.movementDirection(direction);
    position = collision.move(position, movement.x * 0.3, movement.y * 0.3, radius, 0.7);
  }
  close(position.x, -0.3);
  close(position.z, -0.3);
  assert.equal(sprint.state, 'STUNNED');
  assert.equal(sprint.stunRemainingMs, GAME_CONFIG.sprint.stunMs);
});

test('sprint on a screen diagonal uses the same convex-corner slide without ending early', () => {
  const collision = world(box(0, 1, -1, 0));
  const sprint = new SprintSystem(GAME_CONFIG.sprint.durationMs,
    GAME_CONFIG.sprint.riskThreshold, GAME_CONFIG.sprint.stunMs);
  const direction = { x: 0, y: -1 };
  assert.equal(sprint.tryStart(direction, 0), true);
  let position = point(-0.2, 0.5);
  const speed = GAME_CONFIG.player.speed / GAME_CONFIG.three.pixelsPerUnit *
    GAME_CONFIG.sprint.speedMultiplier;
  for (let frame = 0; frame < 5; frame++) {
    sprint.advance(50, direction);
    const movement = sprint.movementDirection(direction);
    position = collision.move(position, movement.x * speed * 0.05,
      movement.y * speed * 0.05, radius, 0.7);
  }
  assert.ok(position.z < 0.1, `sprint stalled at the corner: ${position.z}`);
  assert.ok(position.x < -0.25, `sprint did not slide sideways: ${position.x}`);
  assert.equal(sprint.state, 'SPRINT_RUNNING');
  assert.equal(sprint.sprintRemainingMs, GAME_CONFIG.sprint.durationMs - 250);
});

test('restart has no collision state to carry into a new round', () => {
  const collision = world(box(0, 0.2, -2, 2));
  collision.move(point(-0.3, 0), 0.4, 0, radius, 0.7);
  const next = collision.move(point(-1, 2.5), 0.4, 0, radius, 0.7);
  close(next.x, -0.6);
});

// --- DEV-A-FIX-2: rotated furniture collides as its true footprint ------------
// A rotated piece is registered as an oriented obstacle; the axis-aligned Box3
// list is only ever a broad-phase pre-filter, never the collision shape.

const oriented = (x, z, width, depth, rotationDeg, height = 1) =>
  ({ x, z, width, depth, minY: 0, maxY: height, rotation: degreesToRadians(rotationDeg) });
const rotatedWorld = (...pieces) => new CollisionWorld(5, 5, [], pieces);
const epsilon = GAME_CONFIG.collision.contactEpsilon;

test('a 90 degree piece blocks exactly like the swapped axis-aligned box', () => {
  // A 2 x 1 piece turned 90 degrees spans x in [-0.5, 0.5] and z in [-1, 1].
  const piece = oriented(0, 0, 2, 1, 90);
  const turned = rotatedWorld(piece);
  const straight = world(box(-0.5, 0.5, -1, 1));
  for (const [x, z] of [[0.7, 0], [0.6, 0.5], [-0.7, -0.8], [0, 1.2], [0, -1.2], [0, 0]]) {
    assert.equal(turned.canOccupyStaticXZ(x, z, radius, 0.7),
      straight.canOccupyStaticXZ(x, z, radius, 0.7), `${x},${z}`);
  }
  assert.equal(turned.canOccupyStaticXZ(0.9, 0, radius, 0.7), true);
  assert.equal(turned.canOccupyStaticXZ(0.4, 0, radius, 0.7), false);
});

test('the collision shape is the rotated rectangle, not its bounding box', () => {
  const piece = oriented(0, 0, 2, 2, 45);
  const collision = rotatedWorld(piece);
  // Inside the bounding AABB corner but outside the true diamond.
  assert.equal(collision.canOccupyStaticXZ(1.15, 1.15, radius, 0.7), true);
  // On the true diagonal edge.
  assert.equal(collision.canOccupyStaticXZ(0.6, 0.6, radius, 0.7), false);
  // Same story for line of sight.
  assert.equal(collision.isLineBlockedXZ(point(1.2, 1.2), point(1.35, 1.35)), false);
  assert.equal(collision.isLineBlockedXZ(point(-1.3, 0), point(1.3, 0)), true);
});

test('a thin rotated piece cannot be crossed by a large step', () => {
  const collision = rotatedWorld(oriented(0, 0, 3, 0.2, 30));
  const next = collision.move(point(-3, 0), 6, 0, radius, 0.7);
  assert.ok(next.x < 0, `tunnelled through the rotated piece to ${next.x}`);
});

test('an actor slides around a rotated corner without penetrating it', () => {
  const piece = oriented(0, 0, 2, 2, 45);
  const collision = rotatedWorld(piece);
  let position = point(-1.8, -1.8);
  for (let frame = 0; frame < 40; frame++) {
    position = collision.move(position, 0.05, 0.05, radius, 0.7);
    assert.equal(circleIntersectsRect(position.x, position.z, radius, piece, epsilon), false,
      `penetrated the rotated piece at ${position.x}, ${position.z}`);
  }
  assert.ok(position.x > -1.5 || position.z > -1.5,
    `held movement stalled at ${position.x}, ${position.z}`);
});

test('a rotated piece is still bypassed by the axis-separated sliding', () => {
  // Same shape and start as the axis-aligned furniture test, turned 90 degrees,
  // so the expected slide is identical.
  const collision = rotatedWorld(oriented(0.5, 0, 2, 1, 90));
  const next = collision.move(point(-0.3, 0), 0.4, 0.4, radius, 0.7);
  close(next.x, -0.3);
  close(next.z, 0.4);
});
