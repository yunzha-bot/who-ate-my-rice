import { Box3, Vector3 } from 'three';

export class CollisionWorld {
  private readonly halfWidth: number;
  private readonly halfDepth: number;
  private readonly obstacles: Box3[];
  private readonly actorBox = new Box3();
  private readonly actorSize = new Vector3();

  constructor(halfWidth: number, halfDepth: number, obstacles: Box3[]) {
    this.halfWidth = halfWidth;
    this.halfDepth = halfDepth;
    this.obstacles = obstacles;
  }

  move(position: Vector3, deltaX: number, deltaZ: number, actorWidth: number, actorHeight: number): Vector3 {
    const next = position.clone();
    if (this.canOccupy(next.x + deltaX, next.z, actorWidth, actorHeight)) next.x += deltaX;
    if (this.canOccupy(next.x, next.z + deltaZ, actorWidth, actorHeight)) next.z += deltaZ;
    return next;
  }

  private canOccupy(x: number, z: number, width: number, height: number): boolean {
    const radius = width / 2;
    if (x - radius < -this.halfWidth || x + radius > this.halfWidth ||
        z - radius < -this.halfDepth || z + radius > this.halfDepth) return false;
    this.actorSize.set(width, height, width);
    this.actorBox.setFromCenterAndSize(new Vector3(x, height / 2, z), this.actorSize);
    return !this.obstacles.some((obstacle) => this.actorBox.intersectsBox(obstacle));
  }
}
