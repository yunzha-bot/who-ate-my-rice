import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildApartment } from '../src/three/map/MapBuilder.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { DOOR_NODES } from '../src/three/map/apartmentMap.ts';
import { GAME_CONFIG } from '../src/config/gameConfig.ts';

function footprint(mesh) {
  mesh.geometry.computeBoundingBox();
  const { min, max } = mesh.geometry.boundingBox;
  return [[min.x, min.z], [max.x, min.z], [max.x, max.z], [min.x, max.z]]
    .map(([x, z]) => new THREE.Vector3(x, 0, z).applyMatrix4(mesh.matrixWorld));
}

function overlapXZ(a, b) {
  const pointsA = footprint(a), pointsB = footprint(b);
  let minimum = Infinity;
  for (const points of [pointsA, pointsB]) for (let index = 0; index < 4; index++) {
    const p = points[index], q = points[(index + 1) % 4];
    const axisX = q.z - p.z, axisZ = p.x - q.x;
    const aa = pointsA.map(point => point.x * axisX + point.z * axisZ);
    const bb = pointsB.map(point => point.x * axisX + point.z * axisZ);
    const overlap = Math.min(Math.max(...aa), Math.max(...bb)) -
      Math.max(Math.min(...aa), Math.min(...bb));
    if (overlap <= 0) return 0;
    minimum = Math.min(minimum, overlap / Math.hypot(axisX, axisZ));
  }
  return minimum;
}

test('every visual door clears its adjacent wall and stationary casing through its swing', () => {
  const scene = new THREE.Scene();
  const apartment = buildApartment(scene, { debug: false });
  const walls = [];
  apartment.root.traverse(object => {
    if (object instanceof THREE.Mesh && (object.userData.objectKind === 'WALL' ||
      object.name === 'visual-wall-cap')) walls.push(object);
  });
  for (const [index, definition] of DOOR_NODES.entries()) {
    const door = new DoorView(definition, index, false);
    scene.add(door.object);
    const closedCollider = door.closedCollisionBox().clone();
    for (let cycle = 0; cycle < 3; cycle++) {
      door.sync({ state: 'OPEN', locked: false, lockCoreState: 'AVAILABLE' });
      assert.ok(Math.abs(door.object.rotation.y -
        (definition.rotation + GAME_CONFIG.door.openAngle)) < 1e-10);
      door.sync({ state: 'CLOSED', locked: false, lockCoreState: 'AVAILABLE' });
      assert.equal(door.object.rotation.y, definition.rotation);
      assert.deepEqual(door.closedCollisionBox(), closedCollider);
    }
    const frame = apartment.root.getObjectByName(`visual-frame-${definition.id}`);
    const nearby = walls.filter(mesh =>
      Math.hypot(mesh.position.x - definition.x, mesh.position.z - definition.z) < definition.width + 4);
    scene.updateMatrixWorld(true);
    for (const post of frame.children) for (const wall of nearby) {
      const postBox = new THREE.Box3().setFromObject(post);
      const wallBox = new THREE.Box3().setFromObject(wall);
      const yOverlap = Math.min(postBox.max.y, wallBox.max.y) -
        Math.max(postBox.min.y, wallBox.min.y);
      if (yOverlap > .001) assert.ok(overlapXZ(post, wall) <= .001,
        `${definition.id} frame ${post.name} overlaps ${wall.name || wall.userData.objectId}`);
    }
    for (let step = 0; step <= 18; step++) {
      const fraction = step / 18;
      door.object.rotation.y = definition.rotation + GAME_CONFIG.door.openAngle * fraction;
      scene.updateMatrixWorld(true);
      for (const moving of door.object.children.filter(child => child instanceof THREE.Mesh))
        for (const solid of [...frame.children, ...nearby]) {
          if (!(solid instanceof THREE.Mesh)) continue;
          const movingBox = new THREE.Box3().setFromObject(moving);
          const solidBox = new THREE.Box3().setFromObject(solid);
          const yOverlap = Math.min(movingBox.max.y, solidBox.max.y) -
            Math.max(movingBox.min.y, solidBox.min.y);
          if (yOverlap <= .001) continue;
          assert.ok(overlapXZ(moving, solid) <= .001,
            `${definition.id} at ${Math.round(fraction * 90)}° overlaps ${solid.name || solid.userData.objectId}`);
        }
    }
    door.dispose();
    door.object.removeFromParent();
  }
  apartment.dispose();
});
