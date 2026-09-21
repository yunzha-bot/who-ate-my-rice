import { Box3, Vector3 } from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';

export class CollisionWorld {
  private readonly halfWidth: number;
  private readonly halfDepth: number;
  private readonly obstacles: Box3[];

  constructor(halfWidth: number, halfDepth: number, obstacles: Box3[]) {
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;
    this.obstacles = obstacles;
  }

  move(position: Vector3, deltaX: number, deltaZ: number, actorWidth: number, actorHeight: number): Vector3 {
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
      if (this.canOccupy(next.x + stepX, next.z, actorWidth, actorHeight)) next.x += stepX;
      if (this.canOccupy(next.x, next.z + stepZ, actorWidth, actorHeight)) next.z += stepZ;
      const epsilon = GAME_CONFIG.collision.contactEpsilon;
      if (Math.hypot(next.x - startX, next.z - startZ) < epsilon &&
          Math.hypot(stepX, stepZ) > epsilon) {
        next.x = startX;
        next.z = startZ;
        this.tryCornerSlide(next, stepX, stepZ, actorWidth, actorHeight);
      }
    }
    return next;
  }

  private tryCornerSlide(position: Vector3, stepX: number, stepZ: number,
    width: number, height: number): void {
    const targetX = position.x + stepX;
    const targetZ = position.z + stepZ;
    const epsilon = GAME_CONFIG.collision.contactEpsilon;
    const radius = width * GAME_CONFIG.collision.radiusScale / 2 - epsilon;
    let bestX = 0;
    let bestZ = 0;
    let bestProgress = 0;
    for (const obstacle of this.obstacles) {
      if (obstacle.max.y <= 0 || obstacle.min.y >= height) continue;
      const cornerX = Math.max(obstacle.min.x, Math.min(targetX, obstacle.max.x));
      const cornerZ = Math.max(obstacle.min.z, Math.min(targetZ, obstacle.max.z));
      const normalX = targetX - cornerX;
      const normalZ = targetZ - cornerZ;
      const distanceSquared = normalX * normalX + normalZ * normalZ;
      // Only a convex corner can create a new tangent. Flat-wall contact and
      // a true two-wall dead end must keep the normal axis resolution above.
      if (Math.abs(normalX) <= epsilon || Math.abs(normalZ) <= epsilon ||
          distanceSquared >= radius * radius) continue;
      const distance = Math.sqrt(distanceSquared);
      const nx = normalX / distance;
      const nz = normalZ / distance;
      const inward = stepX * nx + stepZ * nz;
      if (inward >= 0) continue;
      const slideX = stepX - inward * nx;
      const slideZ = stepZ - inward * nz;
      const progress = slideX * stepX + slideZ * stepZ;
      if (progress > bestProgress &&
          this.canOccupy(position.x + slideX, position.z + slideZ, width, height)) {
        bestX = slideX;
        bestZ = slideZ;
        bestProgress = progress;
      }
    }
    position.x += bestX;
    position.z += bestZ;
  }

  private canOccupy(x: number, z: number, width: number, height: number): boolean {
    const radius = width * GAME_CONFIG.collision.radiusScale / 2;
    if (x - radius < -this.halfWidth || x + radius > this.halfWidth ||
        z - radius < -this.halfDepth || z + radius > this.halfDepth) return false;
    const contactRadius = Math.max(0, radius - GAME_CONFIG.collision.contactEpsilon);
    const contactRadiusSquared = contactRadius * contactRadius;
    return !this.obstacles.some((obstacle) => {
      if (obstacle.max.y <= 0 || obstacle.min.y >= height) return false;
      const nearestX = Math.max(obstacle.min.x, Math.min(x, obstacle.max.x));
      const nearestZ = Math.max(obstacle.min.z, Math.min(z, obstacle.max.z));
      const distanceX = x - nearestX;
      const distanceZ = z - nearestZ;
      return distanceX * distanceX + distanceZ * distanceZ < contactRadiusSquared;
    });
  }
}
