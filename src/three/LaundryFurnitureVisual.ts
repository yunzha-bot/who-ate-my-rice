import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** Laundry fixtures occupy the existing utility counter/basket footprints. */
export function dressLaundryFurniture(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h } = rect;
  const cream = 0xe5e2d8, trim = 0xb7bfba, dark = 0x536764;
  const box = (bw: number, bh: number, bd: number, color: number, x: number, y: number, z: number) =>
    emit(new THREE.BoxGeometry(bw, bh, bd), color, x, y, z);
  const round = (radius: number, height: number, color: number, x: number, y: number, z: number) =>
    emit(new THREE.CylinderGeometry(radius, radius, height, 16), color, x, y, z);
  if (rect.id === 'utility_counter') {
    // Front is local +X, facing into this room; long axis is the saved local Z axis.
    for (const z of [-d * .32, 0]) {
      box(w * .92, h * .94, d * .29, cream, 0, h * .49, z);
      box(w * .96, .045, d * .3, 0xf0eee5, 0, h - .0225, z);
      box(.025, .12, d * .25, trim, w * .47, h * .84, z);
      box(.03, .045, d * .085, dark, w * .47, h * .84, z - d * .055);
      emit(new THREE.CylinderGeometry(.025, .025, .03, 12).rotateZ(Math.PI / 2),
        cream, w * .47, h * .84, z + d * .075);
      // Ring, inset drum and handle all have thickness, with no image decals.
      emit(new THREE.TorusGeometry(h * .235, .035, 6, 20).rotateY(Math.PI / 2),
        trim, w * .44, h * .43, z);
      emit(new THREE.CylinderGeometry(h * .21, h * .21, .018, 20).rotateZ(Math.PI / 2),
        dark, w * .455, h * .43, z);
      emit(new THREE.CylinderGeometry(h * .155, h * .155, .022, 16).rotateZ(Math.PI / 2),
        z === 0 ? 0xa6b4ac : 0x829d9e, w * .47, h * .43, z);
      box(.045, .075, .025, cream, w * .46, h * .43, z + h * .19);
      box(.025, .045, d * .21, dark, w * .47, .045, z);
    }
    const z = d * .325, basinW = w * .88, basinD = d * .29;
    box(w * .89, h * .77, basinD * .95, 0xb9a489, 0, h * .385, z);
    box(.025, h * .63, basinD * .88, cream, w * .46, h * .39, z);
    box(.035, .025, basinD * .24, dark, w * .47, h * .64, z);
    // Recessed basin: four solid rim walls around a lower basin floor.
    box(basinW * .78, .025, basinD * .76, trim, 0, h * .82, z);
    for (const side of [-1, 1]) {
      box(.045, .12, basinD, cream, side * (basinW / 2 - .0225), h * .92, z);
      box(basinW, .12, .045, cream, 0, h * .92, z + side * (basinD / 2 - .0225));
    }
    round(.018, .23, dark, -w * .3, h + .075, z);
    box(.18, .035, .035, dark, -w * .18, h + .19, z);
    round(.018, .05, dark, -w * .06, h + .165, z);
    box(.11, .19, .095, 0x92aaa1, -w * .22, h + .095, z + basinD * .37);
    round(.023, .035, cream, -w * .22, h + .207, z + basinD * .37);
    // Folded towels atop dryer, leaving its control panel unobscured.
    for (let i = 0; i < 3; i++)
      box(w * .62, .035, d * .14, i === 1 ? 0x9cafaa : cream, -.03, h + .018 + i * .035, 0);
  } else {
    // Basket and wall-side cleaning tools stay inside the existing basket's collider.
    round(w * .3, h * .67, 0xbba990, .06, h * .35, .02);
    emit(new THREE.TorusGeometry(w * .3, .022, 5, 16).rotateX(Math.PI / 2),
      cream, .06, h * .7, .02);
    round(w * .26, .018, 0x897e6c, .06, h * .69, .02);
    for (let i = 0; i < 2; i++)
      box(w * .36, .04, d * .3, i ? cream : 0x9eafa4, .06, h * .72 + i * .04, .02);
    for (const z of [-d * .23, d * .23]) {
      round(.014, 1.05, 0xb59c78, -w * .39, .6, z);
      box(.065, .11, d * .27, z < 0 ? 0xbebba5 : 0x80968b, -w * .39, .15, z);
    }
    round(w * .14, .2, 0x95aaa0, w * .28, .1, -d * .26);
    emit(new THREE.TorusGeometry(w * .14, .014, 5, 12).rotateX(Math.PI / 2),
      cream, w * .28, .2, -d * .26);
  }
}
