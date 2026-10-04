import * as THREE from 'three';

/** Fit depth only: keep the orthographic composition, zoom and viewing direction.
 * Bounds are cached at map build time; eight corners are cheap to check each frame.
 * Never change gameplay coordinates to accommodate decorative scenery.
 */
export function fitOrthographicSceneDepth(camera: THREE.OrthographicCamera, bounds: THREE.Box3): void {
  if (bounds.isEmpty()) return;
  camera.updateMatrixWorld(true);
  const view = camera.matrixWorldInverse.elements;
  let nearest = Infinity, furthest = -Infinity;
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
        nearest = Math.min(nearest, depth);
        furthest = Math.max(furthest, depth);
      }
  const margin = 2; // Visual clipping safety margin, not a gameplay distance.
  const retreat = Math.max(0, camera.near + margin - nearest);
  if (retreat > 0) {
    // Camera local +Z points backward. Do not call lookAt after this translation.
    const world = camera.matrixWorld.elements;
    camera.position.x += world[8] * retreat;
    camera.position.y += world[9] * retreat;
    camera.position.z += world[10] * retreat;
    camera.updateMatrixWorld(true);
  }
  const far = Math.max(camera.far, furthest + retreat + margin);
  if (far !== camera.far) {
    camera.far = far;
    camera.updateProjectionMatrix();
  }
}
