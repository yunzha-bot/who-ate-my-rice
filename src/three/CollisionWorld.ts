import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { nearestPointOnDoorSegment } from '../systems/DoorSystem.ts';
import type { DoorNode } from './map/apartmentMap.ts';

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
  private readonly dynamicObstacles = new Map<string, Box3>();

  constructor(halfWidth: number, halfDepth: number, obstacles: Box3[]) {
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;
    this.obstacles = obstacles;
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
    return !this.obstacles.some(obstacle =>
      obstacle.max.y > 0 && obstacle.min.y < height &&
      circleIntersectsAabbXZ(x, z, radius, obstacle, GAME_CONFIG.collision.contactEpsilon));
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
    return obstacles.some(obstacle => this.segmentIntersectsRectXZ(
      start.x, start.z, end.x, end.z,
      obstacle.min.x, obstacle.max.x, obstacle.min.z, obstacle.max.z,
    ));
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
    let bestX = 0;
    let bestZ = 0;
    let bestScore = 0;
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
      const currentNormalX = position.x - cornerX;
      const currentNormalZ = position.z - cornerZ;
      const currentDistance = Math.hypot(currentNormalX, currentNormalZ);
      if (currentDistance <= epsilon) continue;
      const nx = currentNormalX / currentDistance;
      const nz = currentNormalZ / currentDistance;
      const inward = stepX * nx + stepZ * nz;
      if (inward >= 0) continue;
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
        const score = progress + Math.hypot(candidateX, candidateZ) * 0.01;
        if (score > bestScore) {
          bestX = candidateX;
          bestZ = candidateZ;
          bestScore = score;
        }
        break;
      }
    }
    position.x += bestX;
    position.z += bestZ;
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
