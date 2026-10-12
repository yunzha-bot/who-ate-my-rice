import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 主卧局部家具外观，沿用原有合批/拾取/碰撞生命周期。 */
export function dressMainBedroom(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h, id } = rect;
  const oak = 0xc3a57e, pale = 0xdec6a2, ivory = 0xeee7d8, seam = 0x81735e;
  const box = (a: number, b: number, c: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.BoxGeometry(a, b, c), color, x, y, z);
  const round = (a: number, b: number, height: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.CylinderGeometry(a, b, height, 12), color, x, y, z);
  if (id === 'main_dresser') {
    for (const x of [-w * .36, w * .36]) for (const z of [-d * .4, d * .4])
      box(.055, h * .14, .055, seam, x, h * .07, z);
    box(w * .92, h * .79, d * .96, oak, 0, h * .54);
    box(w, .055, d, pale, 0, h - .0275);
    // 原柜绕Y旋转180°，本地-X抽屉面朝房间内部+X。
    for (let i = 0; i < 4; i++) {
      const y = h * (.23 + i * .18);
      box(.03, h * .155, d * .91, pale, -w * .46, y);
      for (const z of [-d * .25, d * .25])
        box(.025, .022, .1, seam, -w / 2 + .0125, y, z);
    }
    box(w * .55, .025, d * .23, 0x99a795, 0, h + .013, d * .23);
  } else if (id === 'main_wardrobe') {
    box(w * .88, .08, d * .94, seam, 0, .04);
    box(w * .93, h - .12, d, oak, 0, h / 2);
    for (const side of [-1, 1]) {
      box(.028, h - .19, d * .46, pale, -w / 2 + .014, h / 2, side * d * .24);
      box(.015, h - .3, d * .39, oak, -w * .495 + .0075, h / 2, side * d * .24);
      box(.025, h * .16, .028, seam, -w / 2 + .0125, h * .52, side * d * .055);
    }
    box(w, .055, d, pale, 0, h - .0275);
  } else if (id.endsWith('vanity')) {
    box(w, .065, d, pale, 0, h - .0325);
    for (const x of [-w * .43, w * .43]) for (const z of [-d * .37, d * .37])
      box(.05, h - .065, .05, oak, x, (h - .065) / 2, z);
    box(w * .94, h * .19, d * .9, oak, 0, h * .8);
    for (const x of [-w * .25, w * .25]) {
      box(w * .45, h * .15, .025, ivory, x, h * .8, d * .46);
      box(.13, .02, .025, seam, x, h * .8, d * .49 - .0125);
    }
    // 镜框和镜片有厚度；柔和蓝灰镜面不引入实时反射或新灯光。
    box(w * .57, .72, .055, oak, 0, h + .43, -d * .35);
    box(w * .51, .63, .012, 0xaebfc0, 0, h + .43, -d * .35 + .034);
    box(w * .43, .022, .018, 0xcbd6d0, 0, h + .65, -d * .35 + .043);
    round(.065, .075, .035, ivory, -w * .35, h + .018, d * .05);
    round(.025, .025, .12, 0x8faaa1, -w * .35, h + .095, d * .05);
    box(.08, .09, .06, 0xd7bea4, w * .36, h + .045, d * .08);
    box(.045, .045, .045, seam, w * .36, h + .112, d * .08);
  } else if (id.endsWith('vanity_stool') || id.endsWith('end_bench')) {
    for (const x of [-w * .36, w * .36]) for (const z of [-d * .34, d * .34])
      box(.045, h * .75, .045, oak, x, h * .375, z);
    box(w * .96, .055, d * .96, pale, 0, h * .77);
    box(w, h * .2, d, 0xb2bda8, 0, h * .9);
    if (id.endsWith('end_bench')) box(.018, .012, d * .95, 0x9aa88f, 0, h + .005);
  }
}
