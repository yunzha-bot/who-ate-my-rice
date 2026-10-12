import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 旧 kitchen_island ID 仅为编辑器兼容保留，实际视觉是靠墙灶台延伸段。 */
export function dressKitchenFurniture(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h, id } = rect;
  const stone = 0xeeeae0, oak = 0xc7b18e, ivory = 0xe1dfd2, metal = 0x87958e, dark = 0x435354;
  const box = (a: number, b: number, c: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.BoxGeometry(a, b, c), color, x, y, z);
  const round = (top: number, bottom: number, height: number, color: number,
    x: number, y: number, z: number) =>
    emit(new THREE.CylinderGeometry(top, bottom, height, 16), color, x, y, z);
  if (id === 'kitchen_fridge') {
    // 本地 -X 为冰箱门面；使用存档旋转后朝厨房内部。
    box(w * .94, h * 1.35, d * .94, ivory, 0, h * .69);
    for (const [y, height] of [[h * .99, h * .55], [h * .36, h * .67]]) {
      box(.035, height, d * .9, stone, -w * .475, y);
      box(.035, h * .2, .025, metal, -w * .478, y, d * .32);
    }
    box(w * .86, .06, d * .86, dark, 0, .03);
    return;
  }
  // 长边是操作面，门面朝本地 +X，后沿贴墙。
  box(w * .86, .09, d * .97, 0x8b8372, 0, .045);
  box(w * .94, h - .16, d * .98, oak, 0, h / 2);
  box(w, .065, d, stone, 0, h - .0325);
  box(.035, .12, d, stone, -w / 2 + .0175, h + .06);
  const sink = id === 'kitchen_counter';
  const count = sink ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const z = d * ((i + .5) / count - .5), span = d / count - .025;
    if (sink && i === 0) {
      for (let row = 0; row < 3; row++) {
        const y = .19 + row * .19;
        box(.025, .17, span, ivory, w / 2 - .019, y, z);
        box(.021, .024, span * .38, metal, w / 2 - .011, y + .03, z);
      }
    } else {
      box(.025, h - .19, span, ivory, w / 2 - .019, h / 2, z);
      box(.021, .024, span * .34, metal, w / 2 - .011, h * .76, z);
    }
  }
  if (sink) {
    // 下凹水槽：四周实体边沿包围较低的盆底，不使用平面蓝色贴片。
    const sw = w * .67, sd = d * .29;
    box(sw, .02, sd, metal, .02, h + .012);
    box(sw * .79, .012, sd * .84, 0x627c7b, .02, h + .025);
    for (const side of [-1, 1]) {
      box(.035, .065, sd, stone, .02 + side * sw / 2, h + .043);
      box(sw, .065, .035, stone, .02, h + .043, side * sd / 2);
    }
    round(.024, .024, .29, metal, -w * .32, h + .17, sd * .35);
    box(w * .3, .035, .035, metal, -w * .18, h + .31, sd * .35);
    round(.02, .02, .065, metal, -w * .04, h + .28, sd * .35);
    box(w * .69, .025, d * .2, 0xc1a27b, 0, h + .014, -d * .34);
    for (let i = 0; i < 2; i++) {
      round(.065, .048, .055, stone, .02, h + .053 + i * .045, -d * .34);
    }
    // 电饭煲、热水壶，各一件，保留操作面留白。
    round(.14, .12, .19, ivory, 0, h + .1, d * .32);
    round(.14, .14, .035, metal, 0, h + .207, d * .32);
    box(.055, .035, .09, dark, .13, h + .11, d * .32);
    round(.065, .09, .16, 0x9aaca5, 0, h + .09, d * .43);
    box(.04, .065, .055, metal, .08, h + .15, d * .43);
    // 两段浅吊柜，仍从同一家具根节点生成，编辑器移动/重建同步。
    for (const z of [-d * .29, d * .29]) {
      box(w * .44, .43, d * .31, oak, -w * .26, h + .91, z);
      box(.025, .38, d * .29, ivory, -w * .025, h + .91, z);
      box(.025, .02, d * .12, metal, -w * .008, h + .77, z);
    }
  } else {
    box(w * .76, .025, d * .74, dark, .025, h + .014);
    for (const z of [-d * .21, d * .21]) {
      round(.14, .14, .012, 0x74837e, .025, h + .034, z);
      round(.105, .105, .013, dark, .025, h + .04, z);
    }
    round(.12, .1, .09, metal, .025, h + .095, -d * .21);
    box(.035, .035, .22, dark, .025, h + .1, -d * .36);
    // 烟机罩、烟道、前沿控制条，没有新增灯光。
    box(w * .77, .11, d * .83, ivory, -w * .095, h + .81);
    box(.025, .04, d * .74, metal, w * .3, h + .79);
    box(w * .28, .42, d * .31, ivory, -w * .28, h + 1.075);
  }
}
