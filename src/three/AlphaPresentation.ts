import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeDeepSeekModel } from './DeepSeekGlbModel.ts';
import type { Rect } from './map/apartmentMap.ts';
import { buildDeepSeekMaid } from './DeepSeekMaidModel.ts';
import { dressStorageFurniture, STORAGE_VISUAL_ROLES } from './StorageFurnitureVisual.ts';
import { dressLaundryFurniture } from './LaundryFurnitureVisual.ts';
import { dressSecondBedroom } from './SecondBedroomVisual.ts';
import { dressKitchenFurniture } from './KitchenFurnitureVisual.ts';
import { dressBalconyFurniture } from './BalconyFurnitureVisual.ts';
import { dressMainBedroom } from './MainBedroomVisual.ts';
import { dressEntryFurniture } from './EntryFurnitureVisual.ts';
import { dressBathroomFurniture } from './BathroomFurnitureVisual.ts';
import { dressHomeGym } from './HomeGymVisual.ts';

/** Pure presentation constants. Never consumed by collision, AI or interaction. */
export const HOME_PALETTE = {
  background: 0xd1cec3, wall: 0xf1eadd, wood: 0x947757,
  fabric: 0x92a594, cream: 0xf4edda, tile: 0xb7c2ba,
} as const;

/** Presentation scale only: never used by movement, navigation or targeting. */
export const HOME_COMPOSITION = {
  playViewScale: 1.3, avatarWidth: 1.35, avatarHeight: 1.65,
  wallHeightScale: 1.3, doorVisualHeight: 1.85, wallThicknessScale: 1.8,
} as const;

/** Shared player/NPC visual size; the actor footprint and camera never use it. */
const DEEPSEEK_GLB_SIZE = 1.2;

export function homeFrustum(aspect: number, menu: boolean, baseHeight: number, mapDepth: number,
  mapWidth = 0) {
  // 等距镜头的水平轴是 u = (x − z)/√2，所以决定「整张平面图能不能进画」的是地图的
  // **对角跨度**而不是宽度：`52 / aspect` 只保证宽 ≥ 52 世界单位，而 48 × 30 的地图
  // 在 u 上要占 (48 + 30)/(2√2) ≈ 27.6（两侧各 27.6）。
  // `mapWidth` 缺省 0 = 保持旧行为，既有调用与 `tests/alpha-presentation.test.mjs`
  // 的四参数断言不受影响；`ThreeGame` 传入 `MAP_WIDTH` 后，菜单会额外保证整个
  // u 区间都在画内。2026-10-03 东翼扩建时由真实浏览器标记探针复现：16:9 的
  // faction-select 会把最东北角切掉约 0.55 视图单位（1920px 下约 15px）。
  const center = menu && aspect > 1.3 ? .62 : aspect > 1.3 ? .55 : .5;
  const diagonal = mapWidth > 0 ? (mapWidth + mapDepth) / (2 * Math.SQRT2) : 0;
  const narrowSide = Math.max(1e-6, Math.min(center, 1 - center));
  const height = menu
    ? Math.max(mapDepth + 10, diagonal / narrowSide / Math.max(aspect, 1e-6),
        52 / Math.max(aspect, .5))
    : baseHeight * HOME_COMPOSITION.playViewScale;
  const width = height * aspect;
  return { left: -width * center, right: width * (1 - center), top: height / 2, bottom: -height / 2 };
}

export function furnitureColor(id: string): number {
  if (id === 'garage_storage_cabinet') return 0x919b92;
  if (/carton|box_stack/.test(id)) return 0xbb9162;
  if (/sofa|bench|chair/.test(id)) return HOME_PALETTE.fabric;
  if (/plant/.test(id)) return 0x78916c;
  if (/lamp|bin|umbrella|laundry/.test(id)) return HOME_PALETTE.cream;
  if (/fridge|sink|tub|counter/.test(id)) return HOME_PALETTE.cream;
  return HOME_PALETTE.wood;
}

/** All decoration is attached in furniture-local coordinates, inside its footprint.
 * MapBuilder registers collision BEFORE adding this detail. Editor transforms and
 * disposal therefore remain owned by the existing apartment mesh lifecycle. */
export function dressFurniture(mesh: THREE.Mesh, rect: Rect): void {
  const { width: w, height: h, depth: d, id } = rect;
  const details: THREE.BufferGeometry[] = [];
  const detail = (geometry: THREE.BufferGeometry, color: number,
    x: number, y: number, z: number): void => {
    geometry.translate(x, y - h / 2, z);
    const rgb = new THREE.Color(color);
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = rgb.r; colors[i + 1] = rgb.g; colors[i + 2] = rgb.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    details.push(geometry);
  };
  const part = (width: number, height: number, depth: number, color: number,
    x: number, y: number, z: number) => {
    detail(new THREE.BoxGeometry(width, height, depth), color, x, y, z);
  };
  const round = (radiusTop: number, radiusBottom: number, height: number,
    color: number, x: number, y: number, z: number) => {
    detail(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 8), color, x, y, z);
  };
  const secondStructure = id === 'second_wardrobe' || id === 'second_desk';
  const mainStructure = id === 'main_dresser' || id === 'main_wardrobe' || id.startsWith('main_life_');
  const entryStructure = id.startsWith('entry_life_') || id === 'entry_shoe_rack' || id === 'entry_bench';
  const bathroomStructure = /^bath_(sink|tub|toilet|towel_cabinet|laundry_basket)$/.test(id);
  const gymStructure = id.startsWith('gym_');
  const kitchenStructure = id === 'kitchen_counter' || id === 'kitchen_island' || id === 'kitchen_fridge';
  const balconyStructure = id.startsWith('balcony_life_') || id.startsWith('north_balcony_life_') || id === 'north_balcony_rack';
  if (secondStructure || mainStructure || entryStructure || bathroomStructure || gymStructure || kitchenStructure || balconyStructure) {
    const base = mesh.material as THREE.MeshStandardMaterial;
    base.transparent = true; base.opacity = 0; base.depthWrite = false;
  }
  // Keep the authored solid box raycastable for the editor; decorative silhouettes
  // replace its visible surface without changing collision or navigation.
  if (id === 'utility_counter' || STORAGE_VISUAL_ROLES[id] || /tv_cabinet|standing_ac|water_dispenser|living_lounge_table|garage_workbench|garage_cleaning_station|garage_car|bath_sink|bath_tub|bath_toilet|floor_lamp|_plant|planter|_chair|_stool|coat_stand|trolley|_bin|box_stack|umbrella_stand|laundry_basket|tire_stack/.test(id)) {
    const base = mesh.material as THREE.MeshStandardMaterial;
    base.transparent = true;
    base.opacity = 0;
    base.depthWrite = false;
  }
  if (gymStructure) {
    mesh.castShadow = false;
    dressHomeGym(rect, detail);
  } else if (bathroomStructure) {
    mesh.castShadow = false;
    dressBathroomFurniture(mesh, rect, detail);
  } else if (entryStructure) {
    mesh.castShadow = false;
    dressEntryFurniture(rect, detail);
  } else if (mainStructure) {
    mesh.castShadow = false;
    dressMainBedroom(rect, detail);
  } else if (balconyStructure) {
    mesh.castShadow = false;
    dressBalconyFurniture(rect, detail);
  } else if (kitchenStructure) {
    mesh.castShadow = false;
    dressKitchenFurniture(rect, detail);
  } else if (secondStructure) {
    mesh.castShadow = false;
    dressSecondBedroom(rect, detail);
  } else if (id === 'utility_counter' || id === 'utility_laundry_basket') {
    mesh.castShadow = false;
    dressLaundryFurniture(rect, detail);
  } else if (STORAGE_VISUAL_ROLES[id]) {
    mesh.castShadow = false; // Only the open visual structure casts shadows, not its pick/collision box.
    dressStorageFurniture(rect, detail);
  } else if (id === 'living_tv_cabinet') {
    // Low oak media console; screen faces local +Z. All detail stays in its footprint.
    part(w * .96, h * .64, d * .92, 0xb99a73, 0, h * .48, 0);
    part(w, h * .12, d, 0xd1b792, 0, h * .86, 0);
    for (const side of [-1, 1]) {
      part(w * .06, h * .18, d * .64, 0x6e6556, side * w * .4, h * .09, 0);
      part(w * .29, h * .42, .025, 0xc9af89, side * w * .32, h * .48, d * .47);
      part(w * .11, .025, .025, 0x756953, side * w * .32, h * .65, d * .49);
    }
    part(w * .3, h * .34, .028, 0x514b41, 0, h * .49, d * .465);
    // Set-top box in the open central shelf.
    part(w * .21, h * .1, d * .34, 0x42494a, 0, h * .41, d * .25);
    const screenW = w * .8, screenH = screenW * 9 / 16;
    const screenY = h + .16 + screenH / 2;
    for (const side of [-1, 1]) {
      part(w * .12, .035, d * .56, 0x3d4645, side * w * .26, h * .95, 0);
      part(.045, .18, .06, 0x3d4645, side * w * .26, h + .06, -.02);
    }
    part(screenW, screenH, .085, 0x343f41, 0, screenY, -.02);
    part(screenW * .94, screenH * .88, .012, 0x66878b, 0, screenY, .029);
    // Restrained screen graphic, with no new texture or light.
    part(screenW * .94, screenH * .3, .014, 0x8da9a2, 0, screenY - screenH * .29, .03);
    part(screenW * .7, .016, .014, 0xb3c4b9, -screenW * .06, screenY + screenH * .24, .03);
    for (const y of [-.15, -.1, -.05])
      part(screenW * .55, .018, .012, 0x56615f, 0, screenY + y, -.067);
  } else if (id === 'living_standing_ac') {
    part(w * .84, h * .92, d * .88, 0xe6e5d9, 0, h * .5, 0);
    part(w * .94, h * .06, d * .96, 0x929b94, 0, h * .04, 0);
    part(w * .58, h * .48, .03, 0x687c77, 0, h * .62, d * .45);
    for (let i = 0; i < 8; i++)
      part(w * .57, .028, .035, 0xbfc9ba, 0, h * (.41 + i * .058), d * .47);
    part(w * .32, h * .065, .035, 0x536965, 0, h * .91, d * .45);
    part(w * .14, .015, .039, 0xb5cebc, 0, h * .91, d * .47);
  } else if (id === 'living_water_dispenser') {
    part(w * .86, h * .59, d * .86, 0xe6e2d4, 0, h * .32, 0);
    part(w * .59, h * .18, .035, 0x738680, 0, h * .47, d * .44);
    part(w * .66, .045, d * .27, 0x899c96, 0, h * .34, d * .32);
    for (const side of [-1, 1]) {
      part(.045, h * .075, .07, side < 0 ? 0xa06d60 : 0x668f9a,
        side * w * .16, h * .52, d * .44);
    }
    round(w * .24, w * .2, h * .29, 0xa4bdc2, 0, h * .8, 0);
    round(w * .21, w * .24, h * .07, 0x8faeb7, 0, h * .975, 0);
    round(w * .13, w * .15, h * .065, 0x6e919a, 0, h * .635, 0);
  } else if (id === 'living_lounge_table') {
    part(w, .09, d, 0xd0b58e, 0, h - .045, 0);
    for (const x of [-w * .37, w * .37]) for (const z of [-d * .3, d * .3])
      part(.055, h - .09, .055, 0x927a5c, x, (h - .09) / 2, z);
    part(w * .28, .025, d * .35, 0x899f94, -w * .21, h + .013, 0);
    round(.045, .04, .075, 0xeee7d5, w * .25, h + .038, 0);
  } else if (id === 'garage_workbench') {
    part(w, .11, d, 0xc3ad87, 0, h - .055, 0);
    for (const x of [-w * .38, w * .38]) for (const z of [-d * .43, d * .43])
      part(.07, h * .87, .07, 0x69766f, x, h * .435, z);
    part(w * .85, .065, d * .82, 0x7e8b81, 0, h * .19, 0);
    part(w * .7, h * .32, d * .34, 0x87978b, 0, h * .4, d * .21);
    for (const y of [h * .33, h * .48])
      part(.025, .025, d * .2, 0x505d58, -w * .37, y, d * .21);
    // Shallow tool board on the wall side, with a few recognisable tool silhouettes.
    part(.055, .52, d * .91, 0x9ca59a, w * .43, h + .28, 0);
    for (const z of [-d * .3, 0, d * .3]) {
      part(.065, .22, .035, 0x636d66, w * .38, h + .26, z);
      part(.07, .055, .12, 0x8b755a, w * .38, h + .38, z);
    }
    part(w * .55, .14, d * .24, 0x977c65, -.06, h + .07, -d * .22);
    part(.055, .08, d * .12, 0x56635d, -.06, h + .17, -d * .22);
  } else if (id === 'garage_tool_trolley') {
    part(w*.9,h*.68,d*.88,0x839589,0,h*.51,0);
    part(w,.055,d,0xbca788,0,h*.89,0);
    for(const z of [-d*.34,d*.34]) for(const x of [-w*.32,w*.32])
      detail(new THREE.CylinderGeometry(.075,.075,.05,8).rotateZ(Math.PI/2),0x4b5652,x,.08,z);
    for(const y of [.32,.52,.72])
      part(w*.55,.025,.027,0x505d58,0,h*y,d*.45);
    part(w*.6,.14,d*.42,0x9c826a,0,h*.99,0);
    part(w*.3,.035,.04,0x56635c,0,h*1.105,0);
  } else if (id === 'garage_cleaning_station') {
    round(w*.29,w*.23,h*.5,0x8fa299,-w*.12,h*.25,0);
    round(w*.3,w*.3,.035,0xcbd0bd,-w*.12,h*.51,0);
    round(w*.22,w*.22,.018,0x647d74,-w*.12,h*.525,0);
    part(.025,h*.8,.025,0xaa9676,-w*.12,h*.58,0);
    part(w*.34,.035,d*.16,0xd5d2bb,-w*.12,h*.18,0);
    part(w*.24,h*.42,d*.26,0xb9baa1,w*.32,h*.21,d*.12);
    round(.035,.035,.05,0x6d8278,w*.32,h*.45,d*.12);
  } else if (id === 'garage_car') {
    part(w * .88, h * .4, d * .88, 0xa2b0a6, 0, h * .4, 0);
    part(w * .72, h * .36, d * .42, 0x66818a, 0, h * .75, -.12);
    part(w * .78, .09, d * .44, 0xd2d4c5, 0, h * .97, -.12);
    for (const side of [-1, 1]) {
      for (const z of [-d * .29, d * .29]) {
        detail(new THREE.CylinderGeometry(.29, .29, .18, 12).rotateZ(Math.PI / 2),
          0x363a3b, side * w * .44, .3, z);
        detail(new THREE.CylinderGeometry(.13, .13, .19, 10).rotateZ(Math.PI / 2),
          0x969a94, side * w * .445, .3, z);
      }
      part(.06, h * .34, .075, 0xd2d4c5, side * w * .37, h * .77, -.1);
      part(w * .2, .11, .04, 0xf5e5b6, side * w * .27, h * .45, d * .445);
      part(w * .2, .1, .04, 0xab6b5b, side * w * .27, h * .45, -d * .445);
    }
    part(w * .8, .09, .08, 0x646b68, 0, .23, d * .44);
    part(w * .28, .09, .045, 0xf1ecdc, 0, .4, d * .45);
  } else if (/bed$/.test(id)) {
    if (id === 'second_bed') {
      // 随床移动的薄地毯，仅视觉，不新增碰撞或导航障碍。
      part(w * 1.55, .008, d * 1.18, 0xb4b5a1, 0, .009, d * .16);
      part(w * 1.48, .009, d * 1.1, 0xd5ceba, 0, .01, d * .16);
      for (const side of [-1, 1])
        part(.045, .01, d * 1.02, 0xb3b6a2, side * w * .69, .011, d * .16);
    }
    part(w * .94, h * .65, d * .91, HOME_PALETTE.cream, 0, h * 1.04, 0);
    part(w, h * 1.35, d * .10, HOME_PALETTE.wood, 0, h * .95, -d * .45);
    part(w * .95, .025, d * .58, id.startsWith('main') ? 0x97afa5 : 0xb6a4b9,
      0, h * 1.38, d * .17);
    for (const side of [-1, 1])
      part(w * .34, h * .25, d * .22, 0xfff4df, side * w * .23, h * 1.46, -d * .29);
  } else if (/sofa|bench/.test(id)) {
    for (const side of [-1, 1])
      part(w * .38, .18, d * .71, 0xc9cfb7, side * w * .21, h + .09, d * .07);
    part(w * .96, h * .7, d * .18, 0x87997c, 0, h * 1.25, -d * .40);
    for (const side of [-1, 1]) part(w * .12, h * .5, d, 0x87997c, side * w * .44, h * 1.05, 0);
    if (/sofa/.test(id)) for (const side of [-1, 1])
      part(w * .24, .07, d * .25, 0xe6d9c4, side * w * .26, h + .24, -d * .14);
  } else if (/_chair/.test(id)) {
    part(w * .92, .13, d * .86, 0xc8bca7, 0, h * .67, 0);
    part(w * .92, h * .7, .12, 0xa3aa98, 0, h * 1.24, -d * .39);
    for (const x of [-w * .34, w * .34]) for (const z of [-d * .3, d * .3])
      part(.075, h * .55, .075, 0x947757, x, h * .28, z);
  } else if (/_stool/.test(id)) {
    round(w * .46, w * .46, .12, 0xc9b998, 0, h * .9, 0);
    for (const x of [-w * .3, w * .3]) for (const z of [-d * .3, d * .3])
      part(.065, h * .8, .065, 0x927657, x, h * .4, z);
  } else if (/floor_lamp/.test(id)) {
    round(.19, .19, .06, 0x746a5a, 0, .04, 0);
    round(.025, .025, h * .78, 0x665f55, 0, h * .45, 0);
    round(.13, .21, .24, 0xf2dfb9, 0, h * .9, 0);
  } else if (/_plant|planter/.test(id)) {
    round(.14, .2, h * .34, 0xb39170, 0, h * .18, 0);
    round(.025, .025, h * .45, 0x6e8061, 0, h * .55, 0);
    for (const [x, z] of [[-.11, -.08], [.12, .04], [-.03, .12]])
      round(.12, .025, h * .32, 0x7e997b, x, h * .72, z);
  } else if (/coat_stand/.test(id)) {
    round(w * .35, w * .35, .055, 0x917a5d, 0, .05, 0);
    round(.038, .038, h * .88, 0x917a5d, 0, h * .5, 0);
    for (const [x, z] of [[-.17, 0], [.17, 0], [0, -.17], [0, .17]])
      part(Math.abs(x) + .04, .035, Math.abs(z) + .04, 0x695a46,
        x * .5, h * .88, z * .5);
    if (id === 'entry_coat_stand') {
      // 保留衣帽架结构，挂一件短外套和一个小背包。
      part(w * .48, h * .35, .065, 0x8e9c89, -.055, h * .65, .08);
      for (const x of [-.15, .04]) part(.06, h * .2, .07, 0x8e9c89, x, h * .7, .08);
      part(.12, .23, .085, 0xb09b7b, .08, h * .49, -.08);
      part(.09, .04, .012, 0x8d7d64, .08, h * .45, -.13);
    }
  } else if (/trolley/.test(id)) {
    for (const y of [h * .3, h * .78]) part(w * .9, .09, d * .86, 0xc5aa84, 0, y, 0);
    for (const x of [-w * .4, w * .4]) for (const z of [-d * .38, d * .38])
      part(.06, h * .82, .06, 0x706b61, x, h * .47, z);
    part(w * .55, .13, d * .32, 0xf0e5cb, 0, h * .91, 0);
  } else if (/_bin/.test(id)) {
    round(w * .35, w * .42, h * .82, 0x929a94, 0, h * .43, 0);
    round(w * .42, w * .42, .04, 0x626b68, 0, h * .86, 0);
  } else if (/box_stack/.test(id)) {
    part(w * .78, h * .48, d * .55, 0xb79870, -w * .1, h * .25, -d * .19);
    part(w * .62, h * .44, d * .45, 0xc3a27a, w * .14, h * .22, d * .23);
    part(w * .58, h * .4, d * .5, 0xb18a62, 0, h * .69, -d * .12);
  } else if (/umbrella_stand/.test(id)) {
    round(w * .34, w * .39, h * .62, 0x9b8971, 0, h * .32, 0);
    for (const x of [-.08, .07]) {
      round(.018, .018, h * .78, 0x696b67, x, h * .58, 0);
      round(.065, .02, .1, 0x768f8a, x, h * .91, 0);
    }
  } else if (/laundry_basket/.test(id)) {
    round(w * .42, w * .37, h * .75, 0xb9a58b, 0, h * .4, 0);
    round(w * .44, w * .44, .035, 0xeee4d2, 0, h * .79, 0);
  } else if (/tire_stack/.test(id)) {
    for (let row = 0; row < 3; row++) {
      round(w * .43, w * .43, h * .25, 0x464745, 0, h * (.15 + row * .27), 0);
      round(w * .19, w * .19, .015, 0x858783, 0, h * (.29 + row * .27), 0);
    }
  } else if (/carton/.test(id)) {
    part(w * .16, .012, d * .98, 0xe5c892, 0, h + .01, 0);
    part(w * .98, .013, d * .012, 0x806044, 0, h + .016, 0);
  } else if (/wardrobe|cabinet|fridge/.test(id)) {
    part(w, h * .32, d, furnitureColor(id), 0, h * 1.16, 0);
    part(w * 1.03, .08, d * 1.02, 0xc6b496, 0, h * 1.34, 0);
    for (const z of [-.07, .07])
      part(.032, h * .17, .025, 0x655744, -w / 2 - .016, h * .57, z * d);
    part(.012, h * .92, .013, 0x796c57, -w / 2 - .01, h / 2, 0);
  } else if (/table|desk|island/.test(id)) {
    part(w, .16, d, 0xcbb08a, 0, h + .08, 0);
    // A placemat, book and small plant: no new navigational objects.
    part(w * .5, .014, d * .45, 0xe2d6b6, 0, h + .012, 0);
    part(w * .22, .04, d * .24, 0x83968b, w * .16, h + .04, 0);
    part(.13, .13, .13, 0xc19979, -w * .28, h + .065, -d * .2);
    part(.19, .14, .17, 0x78916c, -w * .28, h + .19, -d * .2);
  } else if (/nightstand/.test(id)) {
    part(w * .96, .07, d * .96, 0xc9ae8a, 0, h + .03, 0);
    part(w * .75, h * .3, .025, 0xbca488, 0, h * .65, d * .49);
    part(.08, .025, .025, 0x695d4d, 0, h * .65, d * .52);
    if (id === 'second_nightstand' || id === 'main_nightstand') {
      round(.07, .08, .02, 0x8e9e96, 0, h + .08, 0);
      round(.012, .012, .16, 0x827563, 0, h + .17, 0);
      round(.075, .12, .13, 0xf0e6cf, 0, h + .3, 0);
      part(.16, .025, .21, 0x7a8e91, w * .26, h + .075, 0);
    }
  } else if (/console/.test(id)) {
    part(w * .96, .08, d * .96, 0xc9ae8a, 0, h + .04, 0);
    part(w * .65, .025, d * .42, 0xe9dfca, 0, h + .09, 0);
    part(w * .14, .05, d * .2, 0x728c83, w * .25, h + .12, 0);
  } else if (/sink|tub/.test(id)) {
    part(w * .73, .015, d * .7, 0xa8c8c3, 0, h + .01, 0);
  }
  if (id === 'main_bed') {
    // 薄地毯随原床实例持久化/编辑，不额外生成通道碰撞。
    part(w + 1.2, .012, d + .55, 0xc7c5b2, 0, .008, .12);
    for (const side of [-1, 1])
      part(.025, .014, d + .35, 0xa7b29f, side * (w / 2 + .5), .009, .12);
  }
  if (details.length) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
    const merged = mergeGeometries(details);
    if (merged) {
      details.forEach(item => item.dispose());
      const item = new THREE.Mesh(merged, material);
      item.castShadow = item.receiveShadow = true;
      mesh.add(item);
    } else {
      // Fallback keeps a decorative piece visible if a future geometry adds an
      // incompatible attribute. Each piece still remains under its editor mesh.
      details.forEach(geometry => mesh.add(new THREE.Mesh(geometry, material)));
    }
  }
}

/** Translation-only smoothing: camera rotation never changes, so screen-relative
 * WASD remains identical. Explicit snap for new rounds/editor/faction changes. */
export class GentleCameraFollow {
  readonly focus = new THREE.Vector3();
  private initialized = false;
  update(target: THREE.Vector3, deltaMs = 0): THREE.Vector3 {
    if (!this.initialized || deltaMs <= 0 || this.focus.distanceToSquared(target) > 36) {
      this.focus.copy(target);
      this.initialized = true;
    } else {
      this.focus.lerp(target, 1 - Math.exp(-Math.min(deltaMs, 100) / 75));
    }
    return this.focus;
  }
}

export function cooldownFraction(remainingMs: number, durationMs: number): number {
  return durationMs <= 0 ? 1 : THREE.MathUtils.clamp(1 - remainingMs / durationMs, 0, 1);
}

/** Signed shortest turn, including the seam between -π and +π. */
export function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/** A small procedural stand-in, not final character art. Physics stays on actor. */
export class HomeAvatar {
  readonly root = new THREE.Group();
  private readonly last = new THREE.Vector3();
  private time = 0;
  private stepPhase = 0;
  private stride = 0;
  private facing = 0;
  private targetFacing = 0;
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private readonly leftLeg = new THREE.Group();
  private readonly rightLeg = new THREE.Group();
  private readonly cloth: THREE.MeshStandardMaterial;
  private readonly actor: THREE.Mesh;
  private externalVisual: THREE.Group | null = null;
  constructor(actor: THREE.Mesh, deepseek: boolean) {
    this.actor = actor;
    actor.geometry.computeBoundingBox();
    const size = actor.geometry.boundingBox!.getSize(new THREE.Vector3());
    this.cloth = new THREE.MeshStandardMaterial({ color: deepseek ? 0x5b92b5 : 0xc08053, roughness: .9 });
    const make = (parent: THREE.Group, w: number, h: number, d: number,
      material: THREE.MeshStandardMaterial, x: number, y: number, z: number) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      part.position.set(x, y, z);
      part.castShadow = part.receiveShadow = true;
      parent.add(part);
    };
    const skin = new THREE.MeshStandardMaterial({ color: 0xf6d8b6, roughness: 1 });
    const hair = new THREE.MeshStandardMaterial({ color: deepseek ? 0x334d69 : 0x695447, roughness: 1 });
    const ink = new THREE.MeshStandardMaterial({ color: 0x343f43, roughness: 1 });
    const w = size.x, h = size.y;
    this.body.name = 'body';
    this.head.name = 'head';
    this.leftArm.name = 'leftArm';
    this.rightArm.name = 'rightArm';
    this.leftLeg.name = 'leftLeg';
    this.rightLeg.name = 'rightLeg';
    this.root.add(this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg);
    if (deepseek) {
      skin.dispose(); hair.dispose(); ink.dispose();
      buildDeepSeekMaid({ body: this.body, head: this.head, leftArm: this.leftArm,
        rightArm: this.rightArm, leftLeg: this.leftLeg, rightLeg: this.rightLeg }, w, h, this.cloth);
    } else {
    make(this.body, w * 1.08, h * .50, w * .94, this.cloth, 0, -h * .01, 0);
    make(this.body, w * .49, h * .25, .022,
      new THREE.MeshStandardMaterial({ color: 0xf7edda }), 0, -h * .04, w * .48);
    this.head.position.y = h * .46;
    make(this.head, w * 1.43, h * .51, w * 1.25, skin, 0, 0, 0);
    make(this.head, w * 1.51, h * .17, w * 1.34, hair, 0, h * .26, -.015);
    for (const sign of [-1, 1]) {
      const arm = sign < 0 ? this.leftArm : this.rightArm;
      const leg = sign < 0 ? this.leftLeg : this.rightLeg;
      arm.position.set(sign * w * .67, h * .15, 0); // shoulder pivot
      leg.position.set(sign * w * .28, -h * .25, .055); // hip pivot
      make(arm, w * .32, h * .36, w * .60, this.cloth, 0, -h * .17, 0);
      make(arm, w * .30, h * .13, w * .54, skin, 0, -h * .38, .025);
      make(leg, w * .43, h * .24, w * .82, ink, 0, -h * .12, 0);
      make(this.head, w * .12, h * .095, .025, ink,
        sign * w * .28, 0, w * .632);
    }
    }
    actor.add(this.root);
    this.root.scale.set(HOME_COMPOSITION.avatarWidth, HOME_COMPOSITION.avatarHeight,
      HOME_COMPOSITION.avatarWidth);
    // Lift enlarged child so its feet retain the original ground plane.
    this.root.position.y = h * (HOME_COMPOSITION.avatarHeight - 1) / 2;
    const material = actor.material as THREE.MeshStandardMaterial;
    material.transparent = true;
    material.opacity = 0; // Keep the original selectable root and footprint unchanged.
    material.depthWrite = false;
    actor.castShadow = false;
    this.last.copy(actor.position);
  }

  /** Swap presentation only. The actor, collider and movement remain untouched. */
  useExternalVisual(model: THREE.Group): void {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y <= 0) throw new Error('DeepSeek GLB has empty bounds');
    const height = this.actor.geometry.boundingBox!.getSize(new THREE.Vector3()).y;
    // Match the existing chibi height and cancel the avatar root's unequal X/Y scales.
    const worldScale = height * HOME_COMPOSITION.avatarHeight * 1.35 * DEEPSEEK_GLB_SIZE / size.y;
    const horizontalScale = worldScale / HOME_COMPOSITION.avatarWidth;
    const verticalScale = worldScale / HOME_COMPOSITION.avatarHeight;
    const center = bounds.getCenter(new THREE.Vector3());
    model.scale.set(horizontalScale, verticalScale, horizontalScale);
    model.position.set(-center.x * horizontalScale,
      -bounds.min.y * verticalScale - height / 2, -center.z * horizontalScale);
    if (this.externalVisual) disposeDeepSeekModel(this.externalVisual);
    this.externalVisual = model;
    this.root.add(model);
    for (const joint of [this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg]) joint.visible = false;
    this.reset();
  }

  clearExternalVisual(): void {
    if (this.externalVisual) disposeDeepSeekModel(this.externalVisual);
    this.externalVisual = null;
    for (const joint of [this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg]) joint.visible = true;
    this.reset();
  }

  update(action: string, deltaMs: number): void {
    const dt = Math.min(Math.max(0, deltaMs), 100) / 1000;
    if (dt === 0) return;
    this.time += dt;
    const dx = this.actor.position.x - this.last.x, dz = this.actor.position.z - this.last.z;
    const distance = Math.hypot(dx, dz);
    // Position is already resolved by gameplay. Only the child mesh follows it.
    if (distance > .0001) this.targetFacing = Math.atan2(dx, dz);
    const turn = shortestTurn(this.facing, this.targetFacing);
    const eased = Math.abs(turn) * (1 - Math.exp(-dt / .12));
    const step = Math.sign(turn) * Math.min(Math.abs(turn), eased, 8 * dt);
    this.facing = Math.atan2(Math.sin(this.facing + step), Math.cos(this.facing + step));
    this.root.rotation.y = this.facing;
    this.last.copy(this.actor.position);
    if (this.externalVisual) return; // External animation belongs to its mixer; heading stays here.
    const moving = action === 'WALK' || action === 'RUN';
    const height = this.actor.geometry.boundingBox!.max.y - this.actor.geometry.boundingBox!.min.y;
    const speed = distance / dt;
    const targetStride = moving ? Math.min(1, Math.max(.45, speed / 2.4)) : 0;
    this.stride += (targetStride - this.stride) * (1 - Math.exp(-dt / .085));
    if (moving) this.stepPhase += dt * (action === 'RUN' ? 17 : 10 + Math.min(speed, 3) * 1.3);
    const swing = Math.sin(this.stepPhase) * this.stride;
    const legAngle = (action === 'RUN' ? .72 : .52) * swing;
    const armAngle = (action === 'RUN' ? .60 : .44) * swing;
    this.leftLeg.rotation.x = legAngle;
    this.rightLeg.rotation.x = -legAngle;
    this.leftArm.rotation.x = -armAngle;
    this.rightArm.rotation.x = armAngle;
    // Swing is in the joints; only a restrained amount reaches the torso.
    this.body.rotation.x = action === 'RUN' ? .075 : 0;
    this.body.rotation.z = Math.sin(this.stepPhase) * this.stride * .045;
    const bob = Math.abs(Math.sin(this.stepPhase)) * this.stride * height * .018;
    this.body.position.y = bob;
    this.head.position.y = height * .46 - bob * .7;
    this.head.rotation.x = -this.body.rotation.x * .7;
    this.head.rotation.z = -this.body.rotation.z * .6;
    this.root.position.y = height * (HOME_COMPOSITION.avatarHeight - 1) / 2 +
      (moving ? bob * .35
      : action === 'EAT' ? Math.sin(this.time * 15) * .014 : Math.sin(this.time * 2.4) * .008);
    this.root.rotation.x = action === 'RUN' ? .12 : action === 'EAT' ? .09 : 0;
    this.root.scale.y = HOME_COMPOSITION.avatarHeight * (1 + (moving ? 0 : Math.sin(this.time * 2.4) * .008));
    this.cloth.emissive.setHex(action === 'STUN' || action === 'FALL' ? 0x392526 : 0);
  }

  reset(): void {
    this.time = 0;
    this.stepPhase = 0;
    this.stride = 0;
    this.facing = 0;
    this.targetFacing = 0;
    this.last.copy(this.actor.position);
    const height = this.actor.geometry.boundingBox!.max.y - this.actor.geometry.boundingBox!.min.y;
    this.root.position.set(0, height * (HOME_COMPOSITION.avatarHeight - 1) / 2, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.set(HOME_COMPOSITION.avatarWidth, HOME_COMPOSITION.avatarHeight, HOME_COMPOSITION.avatarWidth);
    for (const joint of [this.body, this.head, this.leftArm, this.rightArm,
      this.leftLeg, this.rightLeg]) {
      joint.rotation.set(0, 0, 0);
      joint.position.y = joint === this.head ? height * .46
        : joint === this.leftArm || joint === this.rightArm ? height * .15
          : joint === this.leftLeg || joint === this.rightLeg ? -height * .25 : 0;
    }
  }

  dispose(): void {
    if (this.externalVisual) disposeDeepSeekModel(this.externalVisual);
    this.externalVisual = null;
    const materials = new Set<THREE.Material>();
    this.root.traverse(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        materials.add(object.material as THREE.Material);
      }
    });
    materials.forEach(material => material.dispose());
    this.root.removeFromParent();
  }
}
