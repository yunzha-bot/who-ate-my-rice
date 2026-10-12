import * as THREE from 'three';
import type { Rect } from './map/apartmentMap.ts';

// Explicit visual roles: changing a label or HideSpot never changes the furniture's purpose.
export const STORAGE_VISUAL_ROLES: Readonly<Record<string, string>> = {
  study_bookshelf: 'books', guest_bookshelf: 'books', main_bookshelf: 'books',
  storage_shelf: 'rack', storage_rack: 'rack', storage_tool_shelf: 'rack', garage_shelf: 'rack',
  utility_shelf: 'rack', closet_shelf: 'rack',
  dining_shelf: 'sideboard', living_bookcase: 'cabinet',
  second_cabinet: 'books', utility_cleaning_cabinet: 'cabinet',
  garage_storage_cabinet: 'cabinet', bath_towel_cabinet: 'cabinet',
  study_low_cabinet: 'cabinet',
};

/** Emits solid parts to the existing per-furniture vertex-colour batch.
 * u spans the broad face, v points out of it. No world transforms or map data change. */
export function dressStorageFurniture(rect: Rect,
  emit: (geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number) => void,
): void {
  const role = STORAGE_VISUAL_ROLES[rect.id];
  const sideways = rect.width < rect.depth;
  const width = Math.max(rect.width, rect.depth), depth = Math.min(rect.width, rect.depth);
  const height = rect.height * (rect.id === 'garage_shelf' ? 1.25 : 1.35);
  const wood = 0xb79c77, edge = 0xcab390, back = 0x998668;
  const ivory = 0xe1dccd, metal = 0x68766e, ink = 0x4c5953;
  const covers = [0x657d7a, 0xa59b83, 0x52685c, 0x87979b];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const place = (geometry: THREE.BufferGeometry, color: number, u: number, y: number, v: number) => {
    const inward = rect.id === 'second_cabinet' ? -1 : 1;
    if (sideways) geometry.rotateY(-Math.PI / 2 * inward);
    emit(geometry, color, sideways ? -v * inward : u, y, sideways ? u * inward : v);
  };
  const box = (w: number, h: number, d: number, color: number,
    u: number, y: number, v = 0) => place(unitBox.clone().scale(w, h, d), color, u, y, v);
  const cylinder = (r: number, h: number, color: number, u: number, y: number, v: number) =>
    place(new THREE.CylinderGeometry(r, r * .85, h, 10), color, u, y, v);
  const shelf = (y: number) => box(width, .055, depth, role === 'rack' ? metal : edge, 0, y);
  const book = (u: number, floor: number, index: number, flat = false) => {
    const bw = flat ? width * .18 : width * (.045 + index % 2 * .008);
    const bh = flat ? .045 : height * (.18 + index % 3 * .013);
    const bd = depth * (.6 + index % 2 * .05);
    // Page block is inset between covers; spine and cover edges have real depth.
    const y = floor + bh / 2, v = depth * (.04 + index % 3 * .025);
    const yaw = (index % 3 - 1) * .055;
    const piece = (w: number, h: number, d: number, color: number, x: number, z: number) => {
      const geometry = unitBox.clone().scale(w, h, d).translate(x, 0, z).rotateY(yaw);
      place(geometry, color, u, y, v);
    };
    piece(bw, bh, bd, covers[index % covers.length], 0, 0);
    piece(flat ? bw * .93 : bw * .68, flat ? bh * .58 : bh * .94,
      bd * .9, ivory, 0, -bd * .055);
  };
  if (role === 'rack') {
    for (const u of [-width / 2 + .025, width / 2 - .025])
      for (const v of [-depth / 2 + .025, depth / 2 - .025])
        box(.05, height, .05, metal, u, height / 2, v);
    // Open rear; two horizontal ties connect the frame without a fake solid cabinet.
    for (const y of [height * .15, height * .88])
      box(width - .06, .035, .025, metal, 0, y, -depth * .46);
    for (let row = 0; row < 3; row++) {
      const floor = height * (.065 + row * .32);
      shelf(floor);
      for (let col = 0; col < 2; col++) {
        const u = width * (col ? .23 : -.23), bh = height * (col ? .19 : .22);
        const bw = width * .34, bd = depth * .68, y = floor + .028 + bh / 2;
        const cardboard = (row + col) % 3 === 0;
        box(bw, bh, bd, cardboard ? 0xb6a080 : row === 1 ? 0x758982 : 0xaaa99a, u, y);
        if (cardboard) {
          box(bw * .1, .008, bd, 0xd8c6a4, u, y + bh / 2 + .004);
          box(bw * .1, bh * .35, .008, 0xd8c6a4, u, y + bh * .3, bd / 2 + .004);
        } else {
          box(bw * 1.035, .025, bd * 1.035, ivory, u, y + bh / 2);
          box(bw * .28, .026, .018, ink, u, y + bh * .12, bd / 2 + .009);
          if (row === 1) box(bw * .3, .035, .05, ink, u, y + bh / 2 + .03);
        }
      }
    }
  } else {
    box(width, height, .035, back, 0, height / 2, -depth / 2 + .0175);
    for (const u of [-width / 2 + .03, width / 2 - .03])
      box(.06, height, depth, wood, u, height / 2);
    shelf(.04);
    shelf(height - .028);
    if (role === 'books') {
      for (let row = 0; row < 3; row++) {
        const floor = .068 + row * height * .31;
        if (row) shelf(floor - .028);
        for (let i = 0; i < 5; i++) book(width * (-.36 + i * .067), floor, i + row);
        for (let i = 0; i < 3; i++) book(width * .17, floor + i * .045, i + row, true);
        // A file binder with a recessed label and small low-poly ceramic ornament.
        if (row < 2) {
          box(width * .065, height * .2, depth * .62, covers[2], width * .37,
            floor + height * .1, depth * .02);
          box(width * .038, .038, .01, ivory, width * .37, floor + height * .13, depth * .335);
        } else {
          cylinder(depth * .1, height * .13, ivory, width * .37,
            floor + height * .065, depth * .05);
        }
      }
    } else {
      const split = height * .61;
      shelf(split);
      // Two inset cabinet doors, visible separation and handles, all inside the footprint.
      for (const sign of [-1, 1]) {
        box(width * .46, split - .09, .045, role === 'sideboard' ? ivory : wood,
          sign * width * .24, split / 2 + .025, depth / 2 - .035);
        box(.024, height * .085, .025, ink, sign * width * .065,
          split * .76, depth / 2 - .008 - .0125);
      }
      if (role === 'sideboard') {
        // Drawer on the left, open crockery niche on the right.
        box(.04, height * .33, depth * .9, wood, 0, height * .79);
        box(width * .45, height * .27, .045, ivory, -width * .25, height * .79, depth / 2 - .035);
        box(width * .13, .026, .025, ink, -width * .25, height * .82, depth / 2 - .021);
        for (let i = 0; i < 3; i++)
          cylinder(depth * .19, .018, ivory, width * .25, split + .044 + i * .021, .015);
      } else {
        box(.04, height * .33, depth * .9, wood, -width * .13, height * .79);
        box(width * .29, height * .2, depth * .6, 0x89978b, -width * .3,
          split + height * .12, .02);
        box(width * .13, .025, .016, ink, -width * .3, split + height * .15, depth * .33);
        for (let i = 0; i < 2; i++) book(width * .19, split + .028 + i * .045, i, true);
      }
    }
  }
  unitBox.dispose();
}
