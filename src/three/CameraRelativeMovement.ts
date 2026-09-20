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
