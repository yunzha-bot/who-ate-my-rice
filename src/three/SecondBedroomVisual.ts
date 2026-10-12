import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 次卧专属视觉；零件交给原有批处理，坐标、碰撞和藏身点不变。 */
export function dressSecondBedroom(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h, id } = rect;
  const box = (a: number, b: number, c: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.BoxGeometry(a, b, c), color, x, y, z);
  const round = (top: number, bottom: number, height: number, color: number,
    x: number, y: number, z: number) =>
    emit(new THREE.CylinderGeometry(top, bottom, height, 12), color, x, y, z);
  const oak = 0xc6aa82, pale = 0xdec8a6, seam = 0x81725f, ivory = 0xeee7d8;
  if (id === 'second_wardrobe') {
    const height = h * 1.35;
    box(w * .88, .1, d * .92, seam, 0, .05);
    box(.05, height - .1, d, oak, -w / 2 + .025, height / 2 + .05);
    for (const side of [-1, 1]) {
      box(w, height - .1, .055, oak, 0, height / 2 + .05, side * (d / 2 - .0275));
      // 双门朝室内 +X；门板内嵌、门缝和把手都具有厚度。
      box(.045, height - .22, d * .46, pale, w / 2 - .055, height / 2, side * d * .24);
      box(.018, height - .34, d * .39, oak, w / 2 - .023, height / 2, side * d * .24);
      box(.025, .19, .026, seam, w / 2 - .0125, height * .51, side * d * .05);
    }
    box(w, .075, d, pale, 0, height - .0375);
  } else if (id === 'second_desk') {
    box(w, .075, d, pale, 0, h - .0375);
    for (const x of [-w * .43, w * .43]) for (const z of [-d * .38, d * .38])
      box(.055, h - .075, .055, oak, x, (h - .075) / 2, z);
    box(w * .31, h * .35, d * .83, oak, w * .3, h * .69);
    for (const y of [h * .63, h * .77]) {
      box(w * .27, h * .11, .02, pale, w * .3, y, -d * .43);
      box(w * .09, .018, .025, seam, w * .3, y, -d * .46);
    }
    // 纸页、封面、文件盒和灯具均为实体几何；不添加点光源。
    box(w * .32, .012, d * .45, ivory, -w * .08, h + .007, -d * .1);
    for (let i = 0; i < 2; i++) {
      box(w * .2, .045, d * .37, i ? 0x84968c : 0x71838b, w * .23, h + .025 + i * .05, d * .1);
      box(w * .18, .028, d * .35, ivory, w * .23, h + .025 + i * .05, d * .09);
    }
    box(w * .08, .19, d * .32, 0x9b9f8d, w * .42, h + .095, d * .23);
    box(.04, .06, .008, ivory, w * .42, h + .13, d * .062);
    round(.09, .1, .025, 0x778c8a, -w * .34, h + .013, d * .17);
    round(.012, .012, .25, seam, -w * .34, h + .15, d * .17);
    round(.075, .12, .13, ivory, -w * .34, h + .3, d * .17);
  }
}
