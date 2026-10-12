import * as THREE from 'three';
import type { Rect } from './apartmentMap.ts';

// Fixed closed exterior leaves occupy the original wall collision. They do not
// create navigable exits or participate in the interactive interior door system.
export const CLOSED_EXTERIOR_DOORS = [
  { id: 'garage_shutter', x: 22.6, z: 19, width: 3.3, shutter: true },
  { id: 'entry_front_door', x: 4.5, z: 17, width: 1.9, shutter: false },
] as const;

export function dressClosedExteriorWall(parent: THREE.Object3D, rect: Rect): boolean {
  const door = CLOSED_EXTERIOR_DOORS.find(item => Math.abs(rect.z - item.z) < .001 &&
    rect.width > rect.depth && rect.x - rect.width / 2 <= item.x - item.width / 2 &&
    rect.x + rect.width / 2 >= item.x + item.width / 2);
  if (!door) return false;
  const group = new THREE.Group();
  group.name = door.id;
  parent.add(group);
  const add = (w: number, h: number, d: number, color: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: .9 }));
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  const low = rect.x - rect.width / 2, high = rect.x + rect.width / 2;
  const left = door.x - door.width / 2, right = door.x + door.width / 2;
  for (const [a, b] of [[low, left], [right, high]]) if (b > a) {
    add(b - a, 1.95, .324, 0xf1eadd, (a + b) / 2, .975, rect.z);
    add(b - a, .12, .36, 0xcbbb9c, (a + b) / 2, 2.01, rect.z);
  }
  add(door.width, 1.85, .18, door.shutter ? 0xb4b4a7 : 0x967959,
    door.x, .925, rect.z);
  for (const x of [left, right]) add(.13, 2.04, .37, 0x84735f, x, 1.02, rect.z);
  add(door.width + .13, .2, .37, 0x84735f, door.x, 1.95, rect.z);
  if (door.shutter) {
    for (let y = .15; y < 1.85; y += .16)
      for (const side of [-1, 1]) add(door.width - .12, .025, .025,
        0x8a9189, door.x, y, rect.z + side * .103);
    add(.38, .06, .07, 0x626c65, door.x, .35, rect.z - .14);
  } else {
    for (const side of [-1, 1]) {
      add(door.width * .68, 1.15, .035, 0xaf9672, door.x, 1.0, rect.z + side * .11);
      add(.07, .25, .08, 0x554f43, door.x + .62, .87, rect.z + side * .15);
      add(.05, .05, .04, 0x544c40, door.x, 1.5, rect.z + side * .14);
    }
  }
  return true;
}
