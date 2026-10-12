import { Camera, OrthographicCamera, Vector3 } from 'three';
import type { Direction } from '../systems/SprintSystem';

const worldUp = new Vector3(0, 1, 0);

export function positionCameraOnTarget(
  camera: OrthographicCamera, target: Vector3, offset: Vector3,
): void {
  camera.position.copy(target).add(offset);
  camera.lookAt(target);
}

// Input is in screen coordinates: +x right, +y down.
// SprintSystem's Direction.y carries world Z after this conversion.
export function cameraRelativeDirection(camera: Camera, screen: Direction): Direction {
  const forward = new Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  if (forward.lengthSq() === 0) return { x: 0, y: 0 };
  forward.normalize();
  const right = forward.clone().cross(worldUp).normalize();
  const movement = right.multiplyScalar(screen.x).addScaledVector(forward, -screen.y);
  if (movement.lengthSq() === 0) return { x: 0, y: 0 };
  movement.normalize();
  return { x: movement.x, y: movement.z };
}

/** Visual-only quarter turns; the offset is shared by gameplay and editor cameras. */
export class IsometricCameraOrbit {
  private readonly offset: Vector3;
  private readonly radius: number;
  private readonly height: number;
  private readonly baseAngle: number;
  private angle: number;
  private from: number;
  private target: number;
  private elapsedMs = 400;

  constructor(offset: Vector3) {
    this.offset = offset;
    this.radius = Math.hypot(offset.x, offset.z);
    this.height = offset.y;
    this.baseAngle = Math.atan2(offset.x, offset.z);
    this.angle = this.from = this.target = this.baseAngle;
  }

  turn(quarters: number): void {
    this.from = this.angle;
    this.target += quarters * Math.PI / 2;
    this.elapsedMs = 0;
  }

  restore(): void {
    this.from = this.angle;
    this.target = this.baseAngle + Math.round((this.angle - this.baseAngle) /
      (Math.PI * 2)) * Math.PI * 2;
    this.elapsedMs = 0;
  }

  update(deltaMs: number): void {
    this.elapsedMs = Math.min(400, this.elapsedMs + Math.max(0, deltaMs));
    const t = this.elapsedMs / 400;
    const eased = t * t * (3 - 2 * t);
    this.angle = this.from + (this.target - this.from) * eased;
    this.offset.set(Math.sin(this.angle) * this.radius, this.height,
      Math.cos(this.angle) * this.radius);
  }

  snapDefault(): void {
    this.angle = this.from = this.target = this.baseAngle;
    this.elapsedMs = 400;
    this.update(0);
  }
}
