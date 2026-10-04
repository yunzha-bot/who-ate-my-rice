import * as THREE from 'three';
import type { Room } from './map/apartmentMap.ts';
import { buildCommunityCourt } from './CommunityCourtView.ts';

/** Non-interactive street-block scenery. Never registered with collision or navigation.
 * The playable house sits inside a continuous modern residential block. Every frontage
 * repeats the same grammar: road -> sidewalk -> parcel -> building -> front yard /
 * carport / parking bay -> next building. House rows have visible side-yard gaps along
 * the main street, the service lane and the side street, the block has a second rank
 * facing the service lane, and the outermost units are allowed to run past the camera
 * so the block keeps going beyond the map instead of ending at a few detached houses.
 * All of it is deliberately lower-detail, greyer and lower contrast than the playable
 * house, and stays visual-only: no collision, no navigation, no furniture index and no
 * map data. */
export function buildResidentialExterior(parent: THREE.Group, rooms: readonly Room[]): THREE.Group {
  const root = new THREE.Group();
  root.name = 'residential-exterior-visual-only';
  parent.add(root);
  const layout = describeResidentialLayout(rooms);
  const { left, right, back, front, cx, cz } = layout;
  const groupById = new Map(layout.groups.map(g => [g.id, g]));
  const group = (id: string): BuildingGroup => {
    const found = groupById.get(id);
    if (!found) throw new Error(`missing residential building group: ${id}`);
    return found;
  };
  const box = (name: string, x: number, y: number, z: number,
    width: number, height: number, depth: number, color: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = height > .5;
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    root.add(mesh);
    return mesh;
  };
  // Unlit base matches the scene backdrop at its far edge; parcels carry the local color.
  const groundTop = -.46, roadTop = -.25, walkTop = -.16;
  const streetLeft = cx - 150, streetRight = cx + 150;
  const sideLeft = right + 7.25, sideRight = right + 14.75;
  const streetBack = front - 150, streetFront = front + 12;
  const districtBack = streetBack - 4, districtFront = front + 114;
  const districtGround = new THREE.Mesh(new THREE.BoxGeometry(streetRight - streetLeft + 8, .18, districtFront - districtBack),
    new THREE.MeshBasicMaterial({ color: 0xd1cec3 }));
  districtGround.name = 'district-ground';
  districtGround.position.set(cx, groundTop - .09, (districtBack + districtFront) / 2);
  districtGround.raycast = () => {};
  root.add(districtGround);
  // Every paving slab has a real thickness down to the common substrate. Slabs whose
  // name is a reserved surface are recorded so the building layout can be checked
  // against the very same rectangles that were just drawn.
  const reservedSurfaces: FootprintRect[] = [];
  const slab = (name: string, minX: number, maxX: number, minZ: number, maxZ: number,
    top: number, color: number) => {
    if (RESERVED_SURFACE_PATTERN.test(name)) reservedSurfaces.push(rect(name, minX, maxX, minZ, maxZ));
    return box(name, (minX + maxX) / 2, (groundTop + top) / 2,
      (minZ + maxZ) / 2, maxX - minX, top - groundTop, maxZ - minZ, color);
  };
  // Street boundaries partition the ground into whole blocks, not isolated pads
  // sized around individual props. Main-house gameplay geometry stays untouched.
  const parcelTop = -.30;
  slab('home-parcel', streetLeft, sideLeft, back - 6.5, front + 4, parcelTop, 0xc7bda9);
  slab('north-parcel', streetLeft, sideLeft, streetBack, back - 11.5, parcelTop, 0xb4baa6);
  slab('east-parcel', sideRight, streetRight, streetBack, front - 5, parcelTop, 0xb3b8a6);
  slab('parking-parcel', sideRight, streetRight, front - 5, front + 4, parcelTop, 0xb3b8a6);
  slab('southwest-parcel', streetLeft, streetRight, streetFront, front + 110, parcelTop, 0xb7ae99);

  // A through street, offset side street and short service lane form a neighborhood.
  // None of the roads encloses all four sides of the playable house.
  // Rectangles meet at shared edges, including two explicit junction tiles.
  // They never overlap coplanar top faces or use custom polygon triangulation.
  slab('road-main-west', streetLeft, sideLeft, front + 4, streetFront, roadTop, 0x737b78);
  slab('road-main-junction', sideLeft, sideRight, front + 4, streetFront, roadTop, 0x737b78);
  slab('road-main-east', sideRight, streetRight, front + 4, streetFront, roadTop, 0x737b78);
  slab('road-side', sideLeft, sideRight, streetBack, back - 11.5, roadTop, 0x777e79);
  slab('road-side-junction', sideLeft, sideRight, back - 11.5, back - 6.5, roadTop, 0x777e79);
  slab('road-side-south', sideLeft, sideRight, back - 6.5, front + 4, roadTop, 0x777e79);
  slab('road-service', streetLeft, sideLeft, back - 11.5, back - 6.5, roadTop, 0x818780);
  slab('walk-home-front', streetLeft, sideLeft, front + .7, front + 4, walkTop, 0xd0c5ae);
  slab('walk-east', right + 2.85, sideLeft, back - 3, front + .7, walkTop, 0xc7bea9);
  slab('walk-north', streetLeft, sideLeft, back - 6.5, back - 3, walkTop, 0xc9c1ad);
  slab('walk-north-residential', streetLeft, sideLeft - 2.7, back - 14.3, back - 11.5, walkTop, 0xc9c1ad);
  slab('walk-side-north', sideLeft - 2.7, sideLeft, streetBack, back - 11.5, walkTop, 0xc9c1ad);
  slab('walk-across-road', streetLeft, streetRight, streetFront, streetFront + 2.8, walkTop, 0xc0b8a5);
  slab('walk-neighbors', sideRight, sideRight + 2.3, streetBack, front + 4, walkTop, 0xc0b8a5);
  slab('walk-parking-front', sideRight + 2.3, streetRight, front + 2, front + 4, walkTop, 0xc0b8a5);
  const curbTop = -.005, curbWidth = .22;
  slab('curb-home', streetLeft, sideLeft, front + 4 - curbWidth, front + 4, curbTop, 0xe1d5be);
  slab('curb-east', sideLeft - curbWidth, sideLeft, back - 6.5, front + 4 - curbWidth, curbTop, 0xded4bf);
  slab('curb-north', streetLeft, sideLeft - curbWidth, back - 6.5, back - 6.5 + curbWidth, curbTop, 0xded4bf);
  slab('curb-service-north', streetLeft, sideLeft - curbWidth, back - 11.5 - curbWidth, back - 11.5, curbTop, 0xded4bf);
  slab('curb-side-north', sideLeft - curbWidth, sideLeft, streetBack, back - 11.5, curbTop, 0xded4bf);
  slab('curb-neighbors', sideRight, sideRight + curbWidth, streetBack, front + 4 - curbWidth, curbTop, 0xded4bf);
  slab('curb-parking', sideRight, streetRight, front + 4 - curbWidth, front + 4, curbTop, 0xded4bf);
  slab('curb-across', streetLeft, streetRight, streetFront, streetFront + curbWidth, curbTop, 0xd8ccb6);
  // The paving that was just drawn is now authoritative: no background building may
  // stand on a road, a sidewalk, a curb or the parking lot.
  assertLayoutAgainstSurfaces(layout, reservedSurfaces, layout.house);
  const markingY = roadTop + .015 / 2 + .001;
  for (let x = cx - 105; x < cx + 110; x += 5.5) {
    if (x + 1.25 >= sideLeft && x - 1.25 <= sideRight) continue;
    box(`main-lane-mark-${x}`, x, markingY, front + 8, 2.5, .015, .12, 0xd8d5bd);
  }
  for (let z = front - 100; z < front + 4; z += 5)
    box(`side-lane-mark-${z}`, right + 11, markingY, z, .12, .015, 2, 0xcecfb9);
  for (let i = 0; i < 5; i++)
    box(`crosswalk-${i}`, right + 8 + i * 1.25, markingY, front + 8, .65, .015, 4.3, 0xdbd8c5);

  const supportBounds = root.children.filter(mesh => /^(district-ground|.*parcel|road-|walk-)/.test(mesh.name))
    .map(mesh => new THREE.Box3().setFromObject(mesh));
  const floorAt = (x: number, z: number) => Math.max(groundTop, ...supportBounds
    .filter(b => x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z).map(b => b.max.y));
  const standing = (name: string, x: number, z: number, w: number, h: number, d: number, color: number) =>
    box(name, x, floorAt(x, z) + h / 2, z, w, h, d, color);

  // ---------------------------------------------------------------------------
  // The background street block itself. Every unit is declared once in
  // `describeResidentialLayout` (parcel, run, roof clearance, shared base) and the
  // meshes below are drawn straight from that declaration, so the drawn geometry
  // and the asserted geometry cannot drift apart.
  // ---------------------------------------------------------------------------
  for (const g of layout.groups) {
    // One shared base for the whole run: overlapping per-unit plinths are
    // impossible by construction, not by tuning.
    box(`${g.id}-plinth`, midX(g.plinth), PLINTH_CENTER_Y, midZ(g.plinth),
      widthOf(g.plinth), PLINTH_HEIGHT, depthOf(g.plinth), 0xa49d8d);
    for (const unit of g.units) {
      const b = unit.body, w = widthOf(b), d = depthOf(b), x = midX(b), z = midZ(b), h = unit.height;
      const facing = unit.face;
      box(`${unit.id}-body`, x, h / 2, z, w, h, d, unit.wall);
      box(`${unit.id}-roof`, midX(unit.roof), h + .55 / 2, midZ(unit.roof),
        widthOf(unit.roof), .55, depthOf(unit.roof), unit.roofColor);
      box(`${unit.id}-parapet`, midX(unit.parapet), h + .63, midZ(unit.parapet),
        widthOf(unit.parapet), .30, depthOf(unit.parapet), unit.roofColor);
      // Doors and windows address their actual street rather than always facing +Z.
      const facadeWidth = facing === 'west' ? d : w;
      const facade = (name: string, along: number, y: number, offset: number,
        fw: number, fh: number, fd: number, color: number) => {
        if (facing === 'west') box(name, x - w / 2 - offset, y, z + along, fd, fh, fw, color);
        else box(name, x + along, y, z + (facing === 'north' ? -1 : 1) * (d / 2 + offset),
          fw, fh, fd, color);
      };
      for (const side of [-1, 1]) for (const floor of [0, 1]) {
        const wy = h * (.32 + floor * .34);
        facade(`${unit.id}-window-${side}-${floor}`, side * facadeWidth * .28, wy,
          .025, facadeWidth * .14, h * .13, .07, 0xa8b7b2);
        facade(`${unit.id}-sill-${side}-${floor}`, side * facadeWidth * .28, wy - h * .072,
          .11, facadeWidth * .17, .08, .25, 0xbdb5a3);
      }
      facade(`${unit.id}-door`, 0, 1.08, .035, 1.25, 2.1, .07, 0x897d6c);
    }
  }
  const cornerShop = group('corner-shop');
  box('corner-shop-awning', midX(cornerShop.body), 2.35, cornerShop.body.minZ - .6,
    widthOf(cornerShop.body) - 1, .16, 1.2, 0x9ba49a);
  const eastNeighbor = group('east-neighbor');
  const eastFrontX = eastNeighbor.plinth.minX;
  slab('east-entrance-path', eastFrontX - .7, eastFrontX, cz - 9.1, cz - 6.9, walkTop, 0xc8c0ad);
  box('east-porch', eastFrontX - 1.25 / 2, 2.5, cz - 8, 1.25, .18, 3.2, 0xa6a799);
  standing('east-garden-wall', eastNeighbor.plinth.maxX + 2.35, cz - 8, .32, .65, 21, 0xb0b1a2);
  standing('east-garden-hedge', eastNeighbor.plinth.maxX + 1.15, cz - 8, 1.1, .95, 20, 0x8e9d82);
  const neighborApartment = group('neighbor-apartment');
  const balconyZ = neighborApartment.body.maxZ + .6;
  box('neighbor-balcony', midX(neighborApartment.body), 2.7, balconyZ, 5, .13, 1.2, 0xbcb9a9);
  box('neighbor-balcony-rail', midX(neighborApartment.body), 3.05, balconyZ + .55, 5, .65, .10, 0x989b90);
  // Front-yard boundaries for every row: a low wall always carries a clipped hedge
  // just behind it on the yard side, and each row leaves a gate-sized gap on its
  // own front doors, so no wall is a standalone strip and no gate is blocked.
  for (const g of layout.groups) {
    if (g.kind !== 'row') continue;
    const southFacing = g.units[0].face !== 'north';
    const wallZ = southFacing ? g.parcel.maxZ : g.parcel.minZ;
    const inward = southFacing ? -1 : 1;
    const gates = g.units.map(u => midX(u.body)).sort((a, b) => a - b)
      .map(c => [c - 1.5, c + 1.5] as const);
    const spans: Array<readonly [number, number]> = [];
    let cursor = g.body.minX;
    for (const [gateMin, gateMax] of gates) {
      if (gateMin - cursor > 1) spans.push([cursor, gateMin]);
      cursor = Math.max(cursor, gateMax);
    }
    if (g.body.maxX - cursor > 1) spans.push([cursor, g.body.maxX]);
    // Longer inter-house gardens get their own pedestrian opening.
    const gardenSpans = spans.flatMap(([x0, x1]) => x1 - x0 > 10
      ? [[x0, (x0 + x1) / 2 - .75], [(x0 + x1) / 2 + .75, x1]] : [[x0, x1]]);
    gardenSpans.forEach(([x0, x1], i) => {
      standing(`${g.id}-front-${i}-wall`, (x0 + x1) / 2, wallZ, x1 - x0, .62, .34, 0xb3afa0);
      standing(`${g.id}-front-${i}-hedge`, (x0 + x1) / 2, wallZ + inward * .78, x1 - x0, .95, .9, 0x8d9c80);
    });
  }

  const tree = (name: string, x: number, z: number, tone = 0x78906c) => {
    standing(`${name}-trunk`, x, z, .22, 1.35, .22, 0x806e56);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 0),
      new THREE.MeshStandardMaterial({ color: tone, flatShading: true, roughness: 1 }));
    crown.name = `${name}-crown`;
    crown.position.set(x, floorAt(x, z) + 2.075, z);
    crown.scale.set(1, 1.1, 1);
    crown.castShadow = true;
    crown.raycast = () => {};
    root.add(crown);
  };
  // Street trees stand in the sidewalks and in the second rank's yards, never in a
  // road, a lot or a plinth.
  for (const [i, x, z] of [
    [0, left - 8, back - 12], [1, left - 11, back - 6],
    [2, right + 3, back - 6], [3, cx - 13, front + 13.6],
    [4, right + 23, front + 14], [5, right + 28, cz - 18],
    [6, left - 24, front + 2.3], [7, left - 13, front + 2.3],
    [8, cx + 8, front + 13.6], [9, cx + 21.5, front + 13.6],
  ] as const) tree(`street-tree-${i}`, x, z, i % 2 ? 0x849876 : 0x758b6a);
  for (const [i, x, z] of [[0, left - 4, back - 4.2], [1, right + 2, front + 2]] as const) {
    box(`planter-${i}`, x, .1, z, 3.4, .55, 1.15, 0xa89c88);
    box(`plant-${i}`, x, .53, z, 3.1, .45, .9, 0x869b72);
  }
  // Clustered street objects, not props repeated along every edge.
  const parkingZ = front - 1.5;
  box('parking-shelter-roof', right + 21, 2.65, parkingZ, 7, .28, 5.5, 0x918c82);
  for (const x of [right + 18, right + 24]) for (const z of [parkingZ - 2.3, parkingZ + 2.3])
    standing(`shelter-post-${x}-${z}`, x, z, .18, 2.65 - .28 / 2 - floorAt(x, z), .18, 0x858981);
  const carLift = floorAt(right + 20.3, parkingZ) + .125;
  box('parked-car-body', right + 20.3, .48 + carLift, parkingZ, 3.6, .75, 1.7, 0x9ca9a5);
  box('parked-car-cabin', right + 20.3, 1.02 + carLift, parkingZ, 2, .53, 1.35, 0xadbab6);
  for (const x of [right + 19, right + 21.6]) for (const z of [parkingZ - .85, parkingZ + .85])
    standing(`car-wheel-${x}-${z}`, x, z, .45, .35, .17, 0x585f5b);
  for (const x of [left - 9, left - 7.9]) {
    box(`bike-frame-${x}`, x, floorAt(x, front + 2) + .56, front + 2, .12, .7, .95, 0x667a74);
    for (const z of [front + 1.55, front + 2.45])
      standing(`bike-wheel-${x}-${z}`, x, z, .10, .42, .42, 0x59635e);
  }
  box('street-bench-seat', left - 9, .52, back - 5.2, 2.1, .17, .64, 0x987f62);
  box('street-bench-back', left - 9, .86, back - 5.5, 2.1, .65, .13, 0x987f62);
  for (const x of [left - 9.8, left - 8.2])
    standing(`street-bench-leg-${x}`, x, back - 5.2, .16, .52 - .17 / 2 - floorAt(x, back - 5.2), .58, 0x6e7972);
  standing('street-bin', left - 6.4, back - 5.3, .48, .83, .48, 0x77877c);
  // Removed the old north/west standalone decorative wall stubs: neither had
  // a courtyard, connecting segment or building owner. Do not regenerate them.
  // Street furniture spaced along the new frontages instead of repeated on every edge.
  for (const [name, x, z] of [
    ['front-lamp', left + 7, front + 2.5], ['junction-lamp', right + 4.7, front + 12.7],
    ['north-lamp', right - 12, back - 4.4],
    ['west-block-lamp', left - 18.5, front + 2.3], ['south-block-lamp', cx + 2.5, front + 13.6],
  ] as const) {
    standing(`${name}-pole`, x, z, .12, 2.9, .12, 0x6e7972);
    box(`${name}-shade`, x, floorAt(x, z) + 2.93, z, .65, .20, .65, 0xe6d9b6);
  }
  buildCommunityCourt(root, { left, back, groundTop: parcelTop, sidewalkZ: back - 3 });
  return root;
}

// ---------------------------------------------------------------------------
// Declared geometry. Everything below is pure data + arithmetic: no meshes, no
// THREE objects, so it can be asserted in production code and in the geometry
// guard without rendering anything.
// ---------------------------------------------------------------------------

/** Minimum XZ clearance demanded between the footprints of two different
 * buildings. 4 world units is about 3.3 door widths; on this map a 12–16 unit
 * bedroom reads as a ~4 m room, so ~4 units is roughly a 1.3 m side/back yard:
 * a genuine residential setback rather than a hairline that only avoids
 * touching. Roofs overhang their body by `ROOF_OVERHANG`, so the rule is applied
 * to body, roof and plinth rectangles alike. */
export const MIN_BUILDING_GAP = 4;
/** Distance between a building's outermost footprint (its plinth) and its parcel edge. */
export const PARCEL_SETBACK = 1.6;
/** The shared base slab extends this far past the building envelope on every side. */
export const PLINTH_MARGIN = .75;
/** Roof slab overhang beyond the body on every side (roof is w+0.8 x d+0.8). */
export const ROOF_OVERHANG = .4;
/** Visual side yard inside a row; eaves retain 1.6 units of clear sky. */
export const ROW_BODY_GAP = 2.4;
const PLINTH_HEIGHT = .4;
const PLINTH_CENTER_Y = -.14;
/** Paving no background building footprint may ever touch (plus `parking-parcel`,
 * the parking lot itself). Reads the drawn slab names, so it is one vocabulary. */
export const RESERVED_SURFACE_PATTERN = /^road-|^walk-|^curb-|^parking-parcel$|driveway/;
/** Soft landscaping no background building footprint may ever touch. */
export const GREENERY_PATTERN = /hedge|-crown$|-trunk$|^plant-|^planter-/;

export interface FootprintRect { id: string; minX: number; maxX: number; minZ: number; maxZ: number }
export interface BuildingUnit {
  id: string; face: 'south' | 'north' | 'west';
  height: number; wall: number; roofColor: number;
  body: FootprintRect;
  /** Roof slab. Overhangs the body by `ROOF_OVERHANG` on every free side, but is
   * flush at a party wall so it can never poke into the neighbouring unit. */
  roof: FootprintRect;
  /** Facade parapet strip, cut from the same footprint as the roof. */
  parapet: FootprintRect;
}
export interface BuildingGroup {
  id: string; kind: 'row' | 'detached';
  units: BuildingUnit[];
  /** Envelope of every unit body, roof slab and shared plinth, plus the parcel. */
  body: FootprintRect; roof: FootprintRect; plinth: FootprintRect; parcel: FootprintRect;
}
export interface ResidentialLayout {
  left: number; right: number; back: number; front: number; cx: number; cz: number;
  house: FootprintRect;
  groups: BuildingGroup[];
}

const rect = (id: string, minX: number, maxX: number, minZ: number, maxZ: number): FootprintRect =>
  ({ id, minX, maxX, minZ, maxZ });
export const widthOf = (r: FootprintRect) => r.maxX - r.minX;
export const depthOf = (r: FootprintRect) => r.maxZ - r.minZ;
export const midX = (r: FootprintRect) => (r.minX + r.maxX) / 2;
export const midZ = (r: FootprintRect) => (r.minZ + r.maxZ) / 2;
const grown = (r: FootprintRect, margin: number, id = r.id): FootprintRect =>
  rect(id, r.minX - margin, r.maxX + margin, r.minZ - margin, r.maxZ + margin);
/** XZ clearance between two footprints: 0 when they touch or interpenetrate. */
export const footprintGap = (a: FootprintRect, b: FootprintRect) => Math.hypot(
  Math.max(a.minX - b.maxX, b.minX - a.maxX, 0),
  Math.max(a.minZ - b.maxZ, b.minZ - a.maxZ, 0));
/** Area of positive XZ interpenetration; touching edges do not count as overlap. */
export const footprintOverlap = (a: FootprintRect, b: FootprintRect) => Math.max(
  Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX), 0) *
  Math.max(Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ), 0);
const containedWithSetback = (inner: FootprintRect, outer: FootprintRect, setback: number) =>
  inner.minX >= outer.minX + setback - 1e-9 && inner.maxX <= outer.maxX - setback + 1e-9 &&
  inner.minZ >= outer.minZ + setback - 1e-9 && inner.maxZ <= outer.maxZ - setback + 1e-9;

interface RowUnitSpec { id: string; width: number; depth: number; height: number; wall: number; roof: number }
interface RowSpec { id: string; startX: number; face: 'south' | 'north'; frontZ: number; units: readonly RowUnitSpec[] }
interface DetachedSpec {
  id: string; centerX: number; centerZ: number; width: number; depth: number;
  height: number; wall: number; roof: number; face: 'south' | 'north' | 'west';
}

const PARAPET_DEPTH = .32;

/** Roof slab and facade parapet for one unit. `free` says which sides of the
 * body are exposed (all four for a detached house, only the outer ends for the
 * two end units of a terrace, front and back for the middle units). */
const capUnit = (
  base: Omit<BuildingUnit, 'roof' | 'parapet'>,
  free: { minX: boolean; maxX: boolean; minZ: boolean; maxZ: boolean },
): BuildingUnit => {
  const b = base.body;
  const roof = rect(base.id + '-roof',
    b.minX - (free.minX ? ROOF_OVERHANG : 0), b.maxX + (free.maxX ? ROOF_OVERHANG : 0),
    b.minZ - (free.minZ ? ROOF_OVERHANG : 0), b.maxZ + (free.maxZ ? ROOF_OVERHANG : 0));
  const edgeZ = base.face === 'north' ? roof.minZ + PARAPET_DEPTH / 2 : roof.maxZ - PARAPET_DEPTH / 2;
  return { ...base, roof,
    parapet: rect(base.id + '-parapet', roof.minX, roof.maxX, edgeZ - PARAPET_DEPTH / 2, edgeZ + PARAPET_DEPTH / 2) };
};

/** A run of houses on one shared landscaped base, separated at every roof edge. */
const rowGroup = (spec: RowSpec): BuildingGroup => {
  let x = spec.startX;
  const units: BuildingUnit[] = spec.units.map(unit => {
    const minZ = spec.face === 'south' ? spec.frontZ - unit.depth : spec.frontZ;
    const body = rect(unit.id, x, x + unit.width, minZ, minZ + unit.depth);
    x += unit.width + ROW_BODY_GAP;
    return capUnit({ id: unit.id, face: spec.face, height: unit.height, wall: unit.wall, roofColor: unit.roof, body },
      { minX: true, maxX: true, minZ: true, maxZ: true });
  });
  return buildingGroup(spec.id, 'row', units);
};

const detachedGroup = (spec: DetachedSpec): BuildingGroup => buildingGroup(spec.id, 'detached', [capUnit({
  id: spec.id, face: spec.face, height: spec.height, wall: spec.wall, roofColor: spec.roof,
  body: rect(spec.id, spec.centerX - spec.width / 2, spec.centerX + spec.width / 2,
    spec.centerZ - spec.depth / 2, spec.centerZ + spec.depth / 2),
}, { minX: true, maxX: true, minZ: true, maxZ: true })]);

const buildingGroup = (id: string, kind: 'row' | 'detached', units: BuildingUnit[]): BuildingGroup => {
  const body = rect(`${id}-body-envelope`,
    Math.min(...units.map(u => u.body.minX)), Math.max(...units.map(u => u.body.maxX)),
    Math.min(...units.map(u => u.body.minZ)), Math.max(...units.map(u => u.body.maxZ)));
  const roof = rect(`${id}-roof-envelope`,
    Math.min(...units.map(u => u.roof.minX)), Math.max(...units.map(u => u.roof.maxX)),
    Math.min(...units.map(u => u.roof.minZ)), Math.max(...units.map(u => u.roof.maxZ)));
  const plinth = grown(body, PLINTH_MARGIN, `${id}-plinth`);
  return { id, kind, units, body, roof, plinth, parcel: grown(plinth, PARCEL_SETBACK, `${id}-parcel`) };
};

/** The whole background block, derived from the authored house bounding box so
 * that a bigger playable house moves the block instead of being overrun by it.
 * 12 buildings: 4 detached + 3 west row units + 3 south row units + 2 north row
 * units. Throws if any placement rule below is violated. */
export function describeResidentialLayout(rooms: readonly Room[]): ResidentialLayout {
  const left = Math.min(...rooms.map(r => r.minX)), right = Math.max(...rooms.map(r => r.maxX));
  const back = Math.min(...rooms.map(r => r.minZ)), front = Math.max(...rooms.map(r => r.maxZ));
  const cx = (left + right) / 2, cz = (back + front) / 2;
  // Main-street west frontage of the home parcel: a three-unit terrace facing the
  // main street (+Z), west of the playable house, its outer unit running past the
  // west end of the review area so the street does not stop at the map edge.
  const westRow: RowSpec = {
    id: 'row-west', startX: left - 31.8 - ROW_BODY_GAP * 2, face: 'south', frontZ: front - 2,
    units: [
      { id: 'row-west-1', width: 7.4, depth: 8, height: 3.3, wall: 0xaba79c, roof: 0x84817b },
      { id: 'row-west-2', width: 8.8, depth: 8, height: 4.3, wall: 0xb3ab9e, roof: 0x8b8177 },
      { id: 'row-west-3', width: 9.6, depth: 8, height: 3.6, wall: 0xa7a89e, roof: 0x807f79 },
    ],
  };
  // South side of the main street, facing the playable house (-Z): two terraced
  // houses and one longer low apartment with visible gaps between their roofs.
  const southRow: RowSpec = {
    id: 'row-south', startX: cx - 22 - ROW_BODY_GAP, face: 'north', frontZ: front + 18,
    units: [
      { id: 'row-south-1', width: 11, depth: 8, height: 3.4, wall: 0xaeaa9e, roof: 0x86837c },
      { id: 'row-south-2', width: 11.6, depth: 8, height: 4.2, wall: 0xb5ada0, roof: 0x8c8278 },
      { id: 'row-south-apartment', width: 16, depth: 8, height: 4.4, wall: 0xa8aa9f, roof: 0x817f79 },
    ],
  };
  // Second rank behind the service lane, filling the gap between the two
  // detached neighbours so that back row reads as unbroken too.
  const northRow: RowSpec = {
    id: 'row-north', startX: cx - 8.6, face: 'south', frontZ: back - 18.5,
    units: [
      { id: 'row-north-1', width: 8.4, depth: 7.6, height: 3.5, wall: 0xaeaba0, roof: 0x86837c },
      { id: 'row-north-2', width: 7.6, depth: 7.6, height: 4.3, wall: 0xb4ada1, roof: 0x8c8378 },
    ],
  };
  const detached: DetachedSpec[] = [
    { id: 'neighbor-apartment', centerX: left + 2, centerZ: back - 22, width: 14, depth: 8,
      height: 4.1, wall: 0xa8ada5, roof: 0x827f78, face: 'south' },
    { id: 'neighbor-townhouse', centerX: right - 1, centerZ: back - 20, width: 9.5, depth: 7.5,
      height: 3.1, wall: 0xb8ada0, roof: 0x8b8177, face: 'south' },
    { id: 'corner-shop', centerX: left - 21, centerZ: front + 20, width: 11, depth: 7,
      height: 2.5, wall: 0xaba99d, roof: 0x88877d, face: 'north' },
    { id: 'east-neighbor', centerX: right + 24, centerZ: cz - 8, width: 11, depth: 12,
      height: 3.1, wall: 0xb4b7ab, roof: 0x97988c, face: 'west' },
  ];
  const layout: ResidentialLayout = {
    left, right, back, front, cx, cz,
    house: rect('house-footprint', left, right, back, front),
    groups: [westRow, southRow, northRow].map(rowGroup).concat(detached.map(detachedGroup)),
  };
  assertResidentialLayout(layout);
  return layout;
}

/** Throws unless every declared building is fully inside its own parcel with the
 * full setback, parcels stay disjoint, row roofs remain separated, and every pair
 * of different buildings clears `MIN_BUILDING_GAP` on body, roof and plinth. */
export function assertResidentialLayout(layout: ResidentialLayout): void {
  const fail = (message: string): never => {
    throw new Error(`residential exterior layout invalid: ${message}`);
  };
  for (const g of layout.groups) {
    for (const [what, piece] of [['body', g.body], ['roof', g.roof], ['plinth', g.plinth]] as const)
      if (!containedWithSetback(piece, g.parcel, PARCEL_SETBACK))
        fail(`${g.id}-${what} is not inside ${g.id}-parcel with a ${PARCEL_SETBACK} setback`);
    for (const unit of g.units) {
      if (!containedWithSetback(unit.body, g.plinth, 0)) fail(`${unit.id}-body is not founded on the ${g.id} base`);
      if (!containedWithSetback(unit.roof, g.plinth, 0)) fail(`${unit.id}-roof overhangs past the ${g.id} base`);
      if (unit.body.minX < g.body.minX - 1e-9 || unit.body.maxX > g.body.maxX + 1e-9 ||
        unit.body.minZ < g.body.minZ - 1e-9 || unit.body.maxZ > g.body.maxZ + 1e-9)
        fail(`${unit.id}-body is outside the ${g.id} envelope`);
    }
    const pieces = (u: BuildingUnit) =>
      [['body', u.body], ['roof', u.roof], ['parapet', u.parapet]] as const;
    for (let i = 0; i < g.units.length; i++) for (let j = i + 1; j < g.units.length; j++) {
      const a = g.units[i], b = g.units[j], adjacent = j === i + 1;
      for (const [an, ar] of pieces(a)) for (const [bn, br] of pieces(b)) {
        // Nothing in a row may interpenetrate anything else in that row.
        if (footprintOverlap(ar, br) > 1e-9) fail(`${a.id}-${an} interpenetrates ${b.id}-${bn}`);
        if (!adjacent && footprintGap(ar, br) < MIN_BUILDING_GAP - 1e-9)
          fail(`${a.id}-${an} to ${b.id}-${bn} gap ${footprintGap(ar, br).toFixed(3)} < ${MIN_BUILDING_GAP}`);
        if (adjacent && footprintGap(ar, br) < ROW_BODY_GAP - 2 * ROOF_OVERHANG - 1e-6)
          fail(`${a.id}-${an} and ${b.id}-${bn} lose their visible side yard`);
      }
    }
  }
  for (let i = 0; i < layout.groups.length; i++) for (let j = i + 1; j < layout.groups.length; j++) {
    const a = layout.groups[i], b = layout.groups[j];
    if (footprintOverlap(a.parcel, b.parcel) > 1e-9) fail(`${a.id}-parcel overlaps ${b.id}-parcel`);
    for (const [an, ar] of [['body', a.body], ['roof', a.roof], ['plinth', a.plinth]] as const)
      for (const [bn, br] of [['body', b.body], ['roof', b.roof], ['plinth', b.plinth]] as const) {
        const gap = footprintGap(ar, br);
        if (gap < MIN_BUILDING_GAP - 1e-9)
          fail(`${a.id}-${an} to ${b.id}-${bn} gap ${gap.toFixed(3)} < ${MIN_BUILDING_GAP}`);
      }
  }
  for (const g of layout.groups) {
    const gap = footprintGap(g.plinth, layout.house);
    if (gap < MIN_BUILDING_GAP - 1e-9)
      fail(`${g.id} is only ${gap.toFixed(3)} from the playable house, needs ${MIN_BUILDING_GAP}`);
  }
}

/** Throws if any building footprint touches a reserved paving rectangle. */
export function assertLayoutAgainstSurfaces(layout: ResidentialLayout,
  surfaces: readonly FootprintRect[], house?: FootprintRect): void {
  const reserved = house ? [...surfaces, house] : surfaces;
  for (const g of layout.groups)
    for (const [what, piece] of [['body', g.body], ['roof', g.roof], ['plinth', g.plinth]] as const)
      for (const surface of reserved)
        if (footprintOverlap(piece, surface) > 1e-9)
          throw new Error(`residential exterior layout invalid: ${g.id}-${what} occupies reserved surface ${surface.id}`);
}
