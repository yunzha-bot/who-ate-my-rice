import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';
import { CLOSED_EXTERIOR_DOORS } from './map/ClosedExteriorDoors.ts';

/** 入户生活家具，仅输出本地几何体，碰撞和持久化仍走原系统。 */
export function dressEntryFurniture(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h, id } = rect;
  const sideways = w < d, span = sideways ? d : w, depth = sideways ? w : d;
  const oak = 0xc2a47d, pale = 0xdec8a7, cream = 0xeee7d9, dark = 0x7c705d;
  const place = (geometry: THREE.BufferGeometry, color: number, u: number, y: number, v: number) => {
    const inward = id === 'entry_shoe_rack' ? -1 : 1;
    if (sideways) geometry.rotateY(inward * Math.PI / 2);
    emit(geometry, color, sideways ? v * inward : u, y, sideways ? -u * inward : v);
  };
  const box = (a: number, b: number, c: number, color: number, u: number, y: number, v = 0) =>
    place(new THREE.BoxGeometry(a, b, c), color, u, y, v);
  const shoe = (u: number, floor: number, v: number, color: number) => {
    box(.105, .025, .23, dark, u, floor + .013, v);
    box(.1, .065, .19, color, u, floor + .055, v + .015);
    box(.07, .025, .08, cream, u, floor + .092, v - .035);
  };
  if (id.endsWith('shoe_cabinet') || id === 'entry_shoe_rack') {
    for (const u of [-span * .43, span * .43]) for (const v of [-depth * .34, depth * .34])
      box(.05, .12, .05, dark, u, .06, v);
    box(span, .055, depth, pale, 0, h - .0275);
    box(span * .98, h * .79, .035, oak, 0, h * .51, -depth * .46);
    for (const u of [-span * .48, 0, span * .48]) box(.04, h * .79, depth * .95, oak, u, h * .51);
    for (const y of [.15, .57]) box(span, .04, depth, pale, 0, h * y);
    for (const side of [-1, 1]) {
      box(span * .45, h * .34, .035, cream, side * span * .24, h * .77, depth * .46);
      box(.12, .022, .025, dark, side * span * .24, h * .77, depth / 2 - .0125);
      for (const offset of [-.065, .065]) shoe(side * span * .25 + offset, h * .17, depth * .05, side < 0 ? 0x899b8a : 0xbba58c);
    }
    // 台面钥匙托盘和钥匙：独立厚度，不使用平面贴片。
    box(.24, .025, .16, dark, span * .27, h + .013);
    box(.2, .012, .12, pale, span * .27, h + .03);
    box(.09, .016, .018, 0xa6a294, span * .27, h + .045);
    if (id.endsWith('shoe_cabinet')) {
      box(span * .76, .09, .035, pale, 0, h + .6, -depth * .44);
      for (const u of [-span * .25, 0, span * .25]) {
        box(.024, .025, .09, dark, u, h + .6, -depth * .35);
        box(.024, .05, .022, dark, u, h + .62, -depth * .28);
      }
    }
  } else if (id.endsWith('changing_bench') || id === 'entry_bench') {
    for (const u of [-span * .4, span * .4]) for (const v of [-depth * .36, depth * .36])
      box(.05, h * .8, .05, oak, u, h * .4, v);
    box(span, .055, depth, pale, 0, h * .78);
    box(span, h * .16, depth * .97, 0xb7bfac, 0, h * .91);
    for (const v of [-depth * .3, 0, depth * .3]) box(span * .88, .025, .035, oak, 0, h * .22, v);
    for (const u of [-.07, .07]) shoe(u, h * .25, 0, 0x9b998a);
  } else if (id.endsWith('full_mirror')) {
    box(w * .84, .06, d, dark, 0, .03);
    box(w, h * .9, .055, oak, 0, h * .54, -d * .27);
    box(w * .84, h * .8, .012, 0xb1c1bd, 0, h * .54, -d * .27 + .034);
    box(w * .74, .02, .014, 0xd7e1d8, 0, h * .87, -d * .27 + .043);
  }
}

/** 由既有入户门推导地垫；无碰撞/射线拾取，不改变门的开闭规则。 */
export function addEntryDoorMat(root: THREE.Object3D): void {
  const door = CLOSED_EXTERIOR_DOORS.find(d => d.id === 'entry_front_door')!;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(door.width * .95, .012, .85),
    new THREE.MeshStandardMaterial({ color: 0xbab7a6, roughness: 1 }));
  mat.name = 'entry-door-mat'; mat.position.set(door.x, .008, door.z - .9);
  mat.raycast = () => {}; root.add(mat);
}
