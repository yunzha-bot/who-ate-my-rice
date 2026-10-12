import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 阳台新增生活家具，共用原有顶点色合批；不参与玩法判定。 */
export function dressBalconyFurniture(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { width: w, depth: d, height: h, id } = rect;
  const wood = 0xbba17d, cream = 0xe5ddca, metal = 0x84938b, green = 0x7d9474;
  const box = (a: number, b: number, c: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.BoxGeometry(a, b, c), color, x, y, z);
  const round = (top: number, bottom: number, height: number, color: number,
    x: number, y: number, z = 0) =>
    emit(new THREE.CylinderGeometry(top, bottom, height, 12), color, x, y, z);
  const foliage = (radius: number) => {
    const geometry = new THREE.IcosahedronGeometry(radius, 0);
    // 多面叶簇默认无索引，补顺序索引以兼容现有Box/Cylinder合批。
    geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    return geometry;
  };
  const rod = (from: THREE.Vector3, to: THREE.Vector3, radius: number, color: number) => {
    const delta = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 6);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    const mid = from.clone().add(to).multiplyScalar(.5);
    emit(geometry, color, mid.x, mid.y, mid.z);
  };
  const plant = (x: number, floor: number, z: number, radius: number, height: number) => {
    round(radius, radius * .75, height * .33, cream, x, floor + height * .165, z);
    round(radius * .88, radius * .88, .012, 0x80715b, x, floor + height * .335, z);
    round(.012, .012, height * .5, 0x637b5e, x, floor + height * .56, z);
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5;
      const leaf = foliage(radius * .75).scale(.65, 1.5, 1);
      leaf.rotateZ((i % 2 ? 1 : -1) * .45).rotateY(angle);
      emit(leaf, i % 2 ? green : 0x91a584,
        x + Math.cos(angle) * radius * .45, floor + height * (.64 + i % 2 * .1),
        z + Math.sin(angle) * radius * .45);
    }
  };
  if (id === 'north_balcony_rack') {
    // 防潮柜：离地底座、独立柜门与抽屉；沿用原占地和拾取代理。
    box(w * .88, h * .1, d * .8, metal, 0, h * .1);
    box(w * .96, h * .76, d * .88, 0xb8bfb2, 0, h * .55);
    box(w, h * .055, d, cream, 0, h * .96);
    for (const side of [-1, 1]) {
      box(w * .46, h * .54, .035, cream, side * w * .24, h * .45, d * .46);
      box(.024, h * .14, .026, metal, side * w * .055, h * .54, d * .495 - .013);
      box(w * .46, h * .16, .035, 0xd3d7ca, side * w * .24, h * .82, d * .46);
      box(w * .11, .022, .026, metal, side * w * .24, h * .82, d * .495 - .013);
    }
    for (const y of [.21, .69])
      box(w * .94, .025, d * .9, 0xa2ad9e, 0, h * y);
  } else if (id.endsWith('coffee_table')) {
    round(w * .48, w * .48, .055, wood, 0, h - .0275);
    for (let i = 0; i < 3; i++) {
      const angle = i * Math.PI * 2 / 3;
      round(.025, .035, h - .055, metal, Math.cos(angle) * w * .28,
        (h - .055) / 2, Math.sin(angle) * d * .28);
    }
    round(.047, .04, .07, cream, w * .15, h + .035, 0);
    box(w * .26, .024, d * .3, 0x8c9f96, -w * .18, h + .012, -.04);
  } else if (id.endsWith('lounge_chair')) {
    for (const x of [-w * .36, w * .36]) for (const z of [-d * .33, d * .33])
      box(.045, h * .57, .045, wood, x, h * .285, z);
    box(w * .94, .07, d * .88, wood, 0, h * .62);
    box(w * .8, .11, d * .74, cream, 0, h * .77, d * .03);
    box(w * .88, h * .65, .07, wood, 0, h * 1.13, -d * .4);
    box(w * .75, h * .45, .08, 0xb3bfac, 0, h * 1.15, -d * .33);
    for (const x of [-w * .44, w * .44]) {
      box(.04, h * .35, .04, wood, x, h * .86, d * .26);
      box(.06, .045, d * .8, wood, x, h * 1.03);
    }
  } else if (id.endsWith('flower_stand')) {
    for (const x of [-w * .43, w * .43]) for (const z of [-d * .4, d * .4])
      box(.035, h, .035, metal, x, h / 2, z);
    for (const y of [h * .16, h * .56]) box(w, .04, d, wood, 0, y);
    plant(-w * .24, h * .58, 0, .12, h * .43);
    plant(w * .25, h * .58, 0, .11, h * .32);
    if (id.startsWith('north_balcony_')) {
      // 下层洒水壶：有体积的壶身、弯柄与斜壶嘴，不增加独立碰撞。
      round(.07, .085, .14, 0x94aaa1, w * .18, h * .18 + .07, 0);
      const handle = new THREE.TorusGeometry(.065, .012, 6, 10);
      emit(handle, metal, w * .18 - .075, h * .18 + .13, 0);
      rod(new THREE.Vector3(w * .18 + .05, h * .18 + .05, 0),
        new THREE.Vector3(w * .18 + .19, h * .18 + .17, 0), .018, metal);
    } else plant(w * .2, h * .18, d * .1, .11, h * .31);
  } else if (id.endsWith('flower_trough')) {
    box(w * .96, h * .62, d * .94, cream, 0, h * .35);
    box(w * .9, .015, d * .82, 0x85745e, 0, h * .67);
    for (let i = 0; i < 5; i++) {
      const x = w * (-.36 + i * .18);
      emit(foliage(.14).scale(1, .9 + i % 2 * .5, .9),
        i % 2 ? green : 0x95a58b, x, h * .86, 0);
    }
  } else if (id.endsWith('drying_stand')) {
    // 两侧真实X形折叠支架，横杆与少量垂挂织物。
    for (const x of [-w * .44, w * .44]) for (const sign of [-1, 1])
      rod(new THREE.Vector3(x, .03, sign * d * .43), new THREE.Vector3(x, h * .91, -sign * d * .33), .018, metal);
    for (const z of [-d * .28, 0, d * .28]) box(w * .92, .026, .026, metal, 0, h * .91, z);
    for (const [x, color, length] of [[-w * .26, cream, h * .43], [w * .02, 0xa8b7ab, h * .34]]) {
      box(w * .2, length, .018, color, x, h * .91 - length / 2, -d * .28);
      box(w * .2, .025, .018, 0xc4cbbb, x, h * .91 - length + .025, -d * .29);
    }
    // 开口收纳篮及布料，附属同一家具，不另占中央通道。
    const bx = w * .27, bw = w * .23, bd = d * .58;
    box(bw, .025, bd, wood, bx, .025);
    for (const side of [-1, 1]) {
      box(.022, .23, bd, wood, bx + side * bw / 2, .135);
      box(bw, .23, .022, wood, bx, .135, side * bd / 2);
    }
    box(bw * .8, .08, bd * .75, cream, bx, .15);
  } else if (id.endsWith('tall_plant')) {
    plant(0, 0, 0, w * .31, h);
  }
}
