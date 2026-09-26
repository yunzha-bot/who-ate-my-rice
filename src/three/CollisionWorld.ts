import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { nearestPointOnDoorSegment } from '../systems/DoorSystem.ts';
import { circleIntersectsRect, localToWorld, pointInRect, rectBoundingAabb,
  segmentIntersectsRect, worldToLocal } from './map/RotatedRect.ts';
import type { DoorNode, Rect } from './map/apartmentMap.ts';

// DEV-A-FIX-2: a furniture piece rotated by an arbitrary angle can no longer be
// described by an axis-aligned Box3. Rotated pieces are registered here as their
// true oriented footprint; the axis-aligned bounding box is kept only as a cheap
// broad-phase pre-filter, never as the collision shape itself.
export interface OrientedObstacle {
  id?: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  minY: number;
  maxY: number;
  // Radians around +Y, same convention as THREE.Object3D.rotation.y.
  rotation: number;
}

// Collision representation of one map rectangle: exact for 0/90/180/270 degrees,
// oriented for any other angle.
export function orientedObstacleFromRect(rect: Rect): OrientedObstacle {
  return { id: rect.id, x: rect.x, z: rect.z, width: rect.width, depth: rect.depth,
    minY: 0, maxY: rect.height, rotation: rect.rotation ?? 0 };
}

export function circleIntersectsAabbXZ(x: number, z: number, radius: number,
  obstacle: Box3, epsilon = 0): boolean {
  const closestX = Math.max(obstacle.min.x, Math.min(x, obstacle.max.x));
  const closestZ = Math.max(obstacle.min.z, Math.min(z, obstacle.max.z));
  const deltaX = x - closestX;
  const deltaZ = z - closestZ;
  const contactRadius = Math.max(0, radius - epsilon);
  return deltaX * deltaX + deltaZ * deltaZ < contactRadius * contactRadius;
}

export function canInteractWithDoorXZ(world: CollisionWorld, actor: Vector3,
  door: DoorNode): boolean {
  const point = nearestPointOnDoorSegment(actor.x, actor.z, door);
  const target = new Vector3(point.x, actor.y, point.z);
  return !world.isLineBlockedXZ(actor, target, door.id);
}

export class CollisionWorld {
  private readonly halfWidth: number;
  private readonly halfDepth: number;
  private readonly obstacles: Box3[];
  private readonly oriented: OrientedObstacle[];
  private readonly dynamicObstacles = new Map<string, Box3>();

  constructor(halfWidth: number, halfDepth: number, obstacles: Box3[],
    oriented: OrientedObstacle[] = []) {
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;
    this.obstacles = obstacles;
    this.oriented = oriented;
  }

  setDynamicObstacle(id: string, obstacle: Box3 | null): void {
    if (obstacle) this.dynamicObstacles.set(id, obstacle.clone());
    else this.dynamicObstacles.delete(id);
  }

  clearDynamicObstacles(): void {
    this.dynamicObstacles.clear();
  }

  dynamicObstacleCount(): number {
    return this.dynamicObstacles.size;
  }

  // Navigation samples the movement footprint, but plans through openable doors.
  canOccupyStaticXZ(x: number, z: number, radius: number, height: number): boolean {
    if (x - radius < -this.halfWidth || x + radius > this.halfWidth ||
        z - radius < -this.halfDepth || z + radius > this.halfDepth) return false;
    if (this.obstacles.some(obstacle =>
      obstacle.max.y > 0 && obstacle.min.y < height &&
      circleIntersectsAabbXZ(x, z, radius, obstacle, GAME_CONFIG.collision.contactEpsilon))) {
      return false;
    }
    return !this.oriented.some(obstacle => this.orientedBlocksCircle(x, z, radius, height,
      obstacle));
  }

  // Rotated pieces are tested exactly, but only after the axis-aligned bounding
  // box has already shown that a contact is possible.
  private orientedBlocksCircle(x: number, z: number, radius: number, height: number,
    obstacle: OrientedObstacle): boolean {
    if (obstacle.maxY <= 0 || obstacle.minY >= height) return false;
    const bounds = rectBoundingAabb(obstacle);
    const closestX = Math.max(bounds.x - bounds.width / 2, Math.min(x, bounds.x + bounds.width / 2));
    const closestZ = Math.max(bounds.z - bounds.depth / 2, Math.min(z, bounds.z + bounds.depth / 2));
    const broadRadius = Math.max(0, radius - GAME_CONFIG.collision.contactEpsilon);
    if ((x - closestX) ** 2 + (z - closestZ) ** 2 >= broadRadius * broadRadius) return false;
    return circleIntersectsRect(x, z, radius, obstacle, GAME_CONFIG.collision.contactEpsilon);
  }

  move(position: Vector3, deltaX: number, deltaZ: number,
    radius: number, actorHeight: number): Vector3 {
    const next = position.clone();
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaZ)) /
      GAME_CONFIG.collision.maxMovementSubstep));
    const stepX = deltaX / steps;
    const stepZ = deltaZ / steps;
    for (let step = 0; step < steps; step++) {
      const startX = next.x;
      const startZ = next.z;
      // Resolve each world axis independently. A blocked component must not
      // discard the other one; both walking and sprinting use this path.
      if (this.canOccupy(next.x + stepX, next.z, radius, actorHeight)) next.x += stepX;
      if (this.canOccupy(next.x, next.z + stepZ, radius, actorHeight)) next.z += stepZ;
      const epsilon = GAME_CONFIG.collision.contactEpsilon;
      if (Math.hypot(next.x - startX, next.z - startZ) < epsilon &&
          Math.hypot(stepX, stepZ) > epsilon) {
        next.x = startX;
        next.z = startZ;
        this.tryCornerSlide(next, stepX, stepZ, radius, actorHeight);
      }
    }
    return next;
  }

  isLineBlockedXZ(start: Vector3, end: Vector3, ignoredDynamicId?: string): boolean {
    const obstacles = ignoredDynamicId
      ? [...this.obstacles, ...[...this.dynamicObstacles.entries()]
        .filter(([id]) => id !== ignoredDynamicId).map(([, box]) => box)]
      : this.allObstacles();
    if (obstacles.some(obstacle => this.segmentIntersectsRectXZ(
      start.x, start.z, end.x, end.z,
      obstacle.min.x, obstacle.max.x, obstacle.min.z, obstacle.max.z,
    ))) return true;
    return this.oriented.some(obstacle => {
      const bounds = rectBoundingAabb(obstacle);
      if (!this.segmentIntersectsRectXZ(start.x, start.z, end.x, end.z,
        bounds.x - bounds.width / 2, bounds.x + bounds.width / 2,
        bounds.z - bounds.depth / 2, bounds.z + bounds.depth / 2)) return false;
      return segmentIntersectsRect(start, end, obstacle);
    });
  }

  private segmentIntersectsRectXZ(startX: number, startZ: number, endX: number, endZ: number,
    minX: number, maxX: number, minZ: number, maxZ: number): boolean {
    let enter = 0;
    let exit = 1;
    const clipAxis = (start: number, delta: number, min: number, max: number): boolean => {
      if (Math.abs(delta) <= GAME_CONFIG.collision.contactEpsilon) {
        return start >= min && start <= max;
      }
      const first = (min - start) / delta;
      const second = (max - start) / delta;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      return enter <= exit;
    };
    return clipAxis(startX, endX - startX, minX, maxX) &&
      clipAxis(startZ, endZ - startZ, minZ, maxZ) && enter <= 1 && exit >= 0;
  }

  private tryCornerSlide(position: Vector3, stepX: number, stepZ: number,
    radius: number, height: number): void {
    const targetX = position.x + stepX;
    const targetZ = position.z + stepZ;
    const epsilon = GAME_CONFIG.collision.contactEpsilon;
    const choice: { best: { x: number; z: number; score: number } | null } = { best: null };
    const consider = (cornerX: number, cornerZ: number): void => {
      const candidate = this.slideFrom(position, cornerX, cornerZ, stepX, stepZ,
        radius, height, epsilon);
      if (candidate && (!choice.best || candidate.score > choice.best.score)) {
        choice.best = candidate;
      }
    };
    // Axis-aligned obstacles keep their original world-space corner maths.
    for (const obstacle of this.allObstacles()) {
      if (obstacle.max.y <= 0 || obstacle.min.y >= height) continue;
      const cornerX = Math.max(obstacle.min.x, Math.min(targetX, obstacle.max.x));
      const cornerZ = Math.max(obstacle.min.z, Math.min(targetZ, obstacle.max.z));
      const targetNormalX = targetX - cornerX;
      const targetNormalZ = targetZ - cornerZ;
      const targetDistanceSquared =
        targetNormalX * targetNormalX + targetNormalZ * targetNormalZ;
      // Only a convex corner can create a new tangent. Flat-wall contact and
      // a true two-wall dead end must keep the normal axis resolution above.
      if (Math.abs(targetNormalX) <= epsilon || Math.abs(targetNormalZ) <= epsilon ||
          targetDistanceSquared >= radius * radius) continue;
      consider(cornerX, cornerZ);
    }
    // Rotated obstacles run the same maths, but the face-versus-corner decision
    // has to happen in the piece's own frame so an angled face is not mistaken
    // for a convex corner.
    for (const obstacle of this.oriented) {
      if (obstacle.maxY <= 0 || obstacle.minY >= height) continue;
      const local = worldToLocal(obstacle, { x: targetX, z: targetZ });
      const halfWidth = obstacle.width / 2;
      const halfDepth = obstacle.depth / 2;
      const clamped = { x: Math.max(-halfWidth, Math.min(local.x, halfWidth)),
        z: Math.max(-halfDepth, Math.min(local.z, halfDepth)) };
      const normalX = local.x - clamped.x;
      const normalZ = local.z - clamped.z;
      if (Math.abs(normalX) <= epsilon || Math.abs(normalZ) <= epsilon ||
          normalX * normalX + normalZ * normalZ >= radius * radius) continue;
      const corner = localToWorld(obstacle, clamped);
      consider(corner.x, corner.z);
    }
    if (choice.best) {
      position.x += choice.best.x;
      position.z += choice.best.z;
    }
  }

  // The shared tangent search for one contact point.
  private slideFrom(position: Vector3, cornerX: number, cornerZ: number,
    stepX: number, stepZ: number, radius: number, height: number, epsilon: number):
  { x: number; z: number; score: number } | null {
    const currentNormalX = position.x - cornerX;
    const currentNormalZ = position.z - cornerZ;
    const currentDistance = Math.hypot(currentNormalX, currentNormalZ);
    if (currentDistance <= epsilon) return null;
    const nx = currentNormalX / currentDistance;
    const nz = currentNormalZ / currentDistance;
    const inward = stepX * nx + stepZ * nz;
    if (inward >= 0) return null;
    let slideX = stepX - inward * nx;
    let slideZ = stepZ - inward * nz;
    if (Math.hypot(slideX, slideZ) <= epsilon) {
      // A perfectly centered hit on a convex point has no mathematical
      // tangent preference. Pick a stable side so it cannot glue the actor.
      const direction = stepX * -nz + stepZ * nx >= 0 ? 1 : -1;
      const length = Math.hypot(stepX, stepZ);
      slideX = -nz * length * direction;
      slideZ = nx * length * direction;
    }
    for (const scale of [1, 0.75, 0.5, 0.25]) {
      const candidateX = slideX * scale;
      const candidateZ = slideZ * scale;
      if (!this.canOccupy(position.x + candidateX, position.z + candidateZ, radius, height)) {
        continue;
      }
      const progress = candidateX * stepX + candidateZ * stepZ;
      return { x: candidateX, z: candidateZ,
        score: progress + Math.hypot(candidateX, candidateZ) * 0.01 };
    }
    return null;
  }

  private canOccupy(x: number, z: number, radius: number, height: number): boolean {
    return this.canOccupyStaticXZ(x, z, radius, height) &&
      ![...this.dynamicObstacles.values()].some(obstacle =>
        obstacle.max.y > 0 && obstacle.min.y < height &&
        circleIntersectsAabbXZ(x, z, radius, obstacle,
          GAME_CONFIG.collision.contactEpsilon));
  }

  private allObstacles(): Box3[] {
    return [...this.obstacles, ...this.dynamicObstacles.values()];
  }
}
