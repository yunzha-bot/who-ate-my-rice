import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

/** 卫浴附属件随原家具移动，保留原碰撞/拾取代理，不新增布局坐标。 */
export function dressBathroomFurniture(mesh: THREE.Mesh, rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const { id, width: w, depth: d, height: h } = rect;
  const cream = 0xeeeae0, oak = 0xbfa98b, grey = 0x81918c, green = 0xa7bcb2;
  const box = (a: number, b: number, c: number, color: number, x: number, y: number, z = 0) =>
    emit(new THREE.BoxGeometry(a, b, c), color, x, y, z);
  const round = (r: number, height: number, color: number, x: number, y: number, z: number) =>
    emit(new THREE.CylinderGeometry(r, r, height, 12), color, x, y, z);
  const bottle = (x: number, y: number, z: number, color: number) => {
    round(.043, .14, color, x, y + .07, z);
    round(.023, .035, cream, x, y + .157, z);
  };
  if (id === 'bath_sink') {
    // 洗手台朝本地+X：柜门、凹盆及镜柜都以同一朝向组装。
    box(w * .9, h * .8, d * .94, oak, 0, h * .46);
    box(w * .78, .08, d * .83, grey, 0, .04);
    for (const side of [-1, 1]) {
      box(.026, h * .65, d * .44, cream, w * .465, h * .46, side * d * .24);
      box(.035, .025, .12, grey, w * .487, h * .65, side * d * .24);
    }
    box(w * .7, .035, d * .65, 0xb6cac7, 0, h * .87);
    for (const side of [-1, 1]) {
      box(.055, .085, d, cream, side * (w / 2 - .0275), h * .96);
      box(w, .085, .07, cream, 0, h * .96, side * (d / 2 - .035));
    }
    round(.018, .22, grey, -w * .3, h + .06, 0);
    box(.19, .03, .03, grey, -w * .19, h + .16);
    round(.018, .05, grey, -w * .08, h + .14, 0);
    box(.08, .65, d * .92, oak, -w * .44, h + .56);
    box(.016, .57, d * .81, 0xb8cdce, -w * .385, h + .56);
    box(.13, .035, d * .9, cream, -w * .43, h + .21);
    bottle(-w * .25, h + .01, d * .38, green);
    box(.08, .018, .025, grey, -w * .2, h + .19, d * .38);
    round(.048, .12, cream, -w * .23, h + .07, -d * .37);
    for (const z of [-d * .4, -d * .34]) {
      box(.012, .14, .012, grey, -w * .23, h + .16, z);
      box(.017, .05, .016, green, -w * .23, h + .23, z);
    }
    // 薄防滑垫只属地面装饰，不扩张柜体碰撞。
    box(.55, .009, d * .83, 0xaebeb7, w / 2 + .32, .01);
    for (let z = -d * .3; z <= d * .3; z += .12)
      box(.45, .003, .012, 0xcbd6cb, w / 2 + .32, .016, z);
  } else if (id === 'bath_tub') {
    box(w, .1, d, cream, 0, .05);
    box(w * .86, .025, d * .73, 0xbbd2cd, 0, .13);
    for (const side of [-1, 1]) {
      box(w, .32, .065, cream, 0, .25, side * (d / 2 - .0325));
      box(.07, .32, d, cream, side * (w / 2 - .035), .25);
    }
    // 四条唇边围成开口，保持可见盆腔。
    for (const side of [-1, 1]) {
      box(w, .045, .075, cream, 0, .43, side * (d / 2 - .0375));
      box(.08, .045, d, cream, side * (w / 2 - .04), .43);
    }
    box(.035, 1.25, .035, grey, -w * .3, 1.02, -d * .43);
    box(.035, .035, .25, grey, -w * .3, 1.64, -d * .26);
    round(.1, .025, grey, -w * .3, 1.61, -d * .08);
    box(.24, .035, .12, oak, w * .28, 1.03, -d * .37);
    bottle(w * .24, 1.05, -d * .35, green);
    bottle(w * .34, 1.05, -d * .35, 0xb9cad5);
    // 固定半幅玻璃屏，薄厚真实、无碰撞、不截获编辑器射线。
    const screen = new THREE.Mesh(new THREE.BoxGeometry(w * .48, .95, .012),
      new THREE.MeshStandardMaterial({ color: 0xc2dedb, transparent: true, opacity: .2, depthWrite: false, roughness: .2 }));
    screen.name = 'bath-screen'; screen.position.set(-w * .22, .94 - h / 2, d * .44);
    screen.raycast = () => {}; mesh.add(screen);
    for (const x of [-w * .46, w * .02]) box(.018, .98, .022, grey, x, .94, d * .44);
    box(w * .5, .018, .022, grey, -w * .22, 1.43, d * .44);
    box(.03, .03, .13, grey, w * .28, .73, d * .35);
    box(.03, .03, .13, grey, w * .45, .73, d * .35);
    box(w * .17, .025, .025, grey, w * .365, .73, d * .44);
    box(w * .13, .25, .02, green, w * .365, .61, d * .44);
    // 靠洗浴区的细地漏，附属地面视觉。
    box(.24, .008, .16, grey, w * .15, .009, d / 2 + .22);
    for (let x = -.08; x <= .08; x += .04)
      box(.014, .003, .12, 0x586c68, w * .15 + x, .014, d / 2 + .22);
  } else if (id === 'bath_toilet') {
    round(w * .23, h * .43, cream, 0, h * .24, .03);
    emit(new THREE.CylinderGeometry(w * .4, w * .32, h * .23, 12).scale(1, 1, 1.12), cream, 0, h * .55, .035);
    emit(new THREE.TorusGeometry(w * .29, .035, 5, 16).rotateX(Math.PI / 2).scale(1, 1, 1.12), cream, 0, h * .69, .035);
    round(w * .23, .012, 0xbacbc4, 0, h * .65, .04);
    box(w * .72, h * .67, d * .25, cream, 0, h * .64, -d * .32);
    box(.09, .018, .04, grey, 0, h * .99, -d * .32);
    box(.025, .13, .025, grey, w * .44, .58, -d * .3);
    emit(new THREE.CylinderGeometry(.055, .055, .12, 12).rotateZ(Math.PI / 2), cream, w * .34, .59, -d * .3);
    round(.055, .14, green, -w * .38, .07, -d * .27);
    round(.01, .2, grey, -w * .38, .21, -d * .27);
  } else if (id === 'bath_towel_cabinet') {
    box(w * .94, h * .55, d * .95, oak, 0, h * .325);
    box(.035, h * .34, d * .95, oak, w * .45, h * .78);
    for (const side of [-1, 1]) box(w * .94, h * .34, .035, oak, 0, h * .78, side * d * .46);
    box(w, .045, d, cream, 0, h - .0225);
    box(.026, h * .48, d * .89, cream, -w * .45, h * .32);
    box(.025, .025, d * .2, grey, -w * .475, h * .51);
    // 开放上格：暗背板、层板、真实折叠毛巾。
    box(w * .8, .025, d * .9, cream, -w * .08, h * .61);
    for (let i = 0; i < 3; i++) box(w * .7, .045, d * .35, i === 1 ? green : cream, -w * .08, h * .65 + .047 * i, d * .2);
    bottle(-w * .2, h + .01, -d * .25, green);
  } else {
    round(w * .4, h * .8, oak, 0, h * .42, 0);
    emit(new THREE.TorusGeometry(w * .4, .02, 5, 16).rotateX(Math.PI / 2), cream, 0, h * .83, 0);
    round(w * .35, .018, grey, 0, h * .8, 0);
    for (let i = 0; i < 2; i++) box(w * .6, .035, d * .5, i ? cream : green, .02, h * .85 + i * .04);
  }
}
