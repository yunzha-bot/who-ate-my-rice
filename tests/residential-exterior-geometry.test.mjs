import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildResidentialExterior, describeResidentialLayout, MIN_BUILDING_GAP, PARCEL_SETBACK,
  ROOF_OVERHANG, ROW_BODY_GAP, footprintGap, footprintOverlap, RESERVED_SURFACE_PATTERN,
  GREENERY_PATTERN } from '../src/three/ResidentialExterior.ts';
import { ROOMS } from '../src/three/map/apartmentMap.ts';

const EPS = 1e-5;
const boundsOf = mesh => new THREE.Box3().setFromObject(mesh);
const make = () => {
  const root = buildResidentialExterior(new THREE.Group(), ROOMS);
  root.updateMatrixWorld(true);
  return root;
};
const surfaces = root => root.children.filter(mesh => /^(district-ground|.*parcel|road-|walk-)/.test(mesh.name));
const supportAt = (root, x, z) => Math.max(...surfaces(root).map(mesh => {
  const b = boundsOf(mesh);
  return x >= b.min.x - EPS && x <= b.max.x + EPS && z >= b.min.z - EPS && z <= b.max.z + EPS
    ? b.max.y : -Infinity;
}));

test('street blocks cover the review area without bare substrate gaps', () => {
  const root = make();
  const cover = surfaces(root).filter(m => m.name !== 'district-ground').map(boundsOf);
  const missing = [];
  for (let x = -60; x <= 65; x += 2) for (let z = -55; z <= 55; z += 2) {
    if (!cover.some(b => x >= b.min.x - EPS && x <= b.max.x + EPS && z >= b.min.z - EPS && z <= b.max.z + EPS))
      missing.push([x,z]);
  }
  assert.equal(missing.length, 0, `bare ground: ${JSON.stringify(missing.slice(0, 8))}; total ${missing.length}`);
});

test('boundary walls belong to a connected garden assembly rather than standalone strips', () => {
  const root = make();
  for (const wall of root.children.filter(m => /wall$/.test(m.name))) {
    const b = boundsOf(wall).expandByScalar(1.5);
    const neighbors = root.children.filter(m => m !== wall && /hedge|body$|wall$/.test(m.name));
    assert.ok(neighbors.some(m => b.intersectsBox(boundsOf(m))), `orphan ${wall.name}`);
  }
});

test('parcel and road rectangles exactly tile the district; roads are one connected network', () => {
  const root = make();
  const tiles = root.children.filter(m => /parcel$|^road-/.test(m.name)).map(boundsOf);
  const xs = [...new Set(tiles.flatMap(b => [b.min.x,b.max.x]))].sort((a,b)=>a-b);
  const zs = [...new Set(tiles.flatMap(b => [b.min.z,b.max.z]))].sort((a,b)=>a-b);
  // Exact axis-aligned cell decomposition, not a sparse sampling claim.
  for(let i=1;i<xs.length;i++) for(let j=1;j<zs.length;j++) {
    const x=(xs[i-1]+xs[i])/2,z=(zs[j-1]+zs[j])/2;
    assert.equal(tiles.filter(b=>x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z).length,1,`tile ${x},${z}`);
  }
  const roads=root.children.filter(m=>m.name.startsWith('road-')).map(boundsOf);
  const seen=new Set([0]); let changed=true;
  while(changed){ changed=false; for(let i=0;i<roads.length;i++) if(!seen.has(i))
    for(const j of seen) if(roads[i].clone().expandByScalar(EPS).intersectsBox(roads[j])){
      seen.add(i);changed=true;break;
    }
  }
  assert.equal(seen.size,roads.length);
});

test('integrity audit rejects duplicate meshes, invalid transforms and unexplained long strips', () => {
  const root=make(),signatures=new Set();
  for(const mesh of root.children.filter(m => m.isMesh)){
    const b=boundsOf(mesh),size=b.getSize(new THREE.Vector3());
    assert.ok([...mesh.position.toArray(),...mesh.scale.toArray(),mesh.rotation.x,mesh.rotation.y,mesh.rotation.z].every(Number.isFinite),mesh.name);
    assert.equal(mesh.rotation.x,0,mesh.name); assert.equal(mesh.rotation.y,0,mesh.name);assert.equal(mesh.rotation.z,0,mesh.name);
    assert.ok(Math.abs(mesh.position.x)<120&&Math.abs(mesh.position.z)<110&&Math.abs(mesh.position.y)<10,mesh.name);
    const signature=[...b.min.toArray(),...b.max.toArray()].map(n=>n.toFixed(6)).join(',');
    assert.ok(!signatures.has(signature),`duplicate ${mesh.name}`);signatures.add(signature);
    if(Math.max(size.x,size.z)/Math.min(size.x,size.z)>35) {
      if(/parapet$|balcony-rail$/.test(mesh.name)) {
        const support=root.getObjectByName(mesh.name.endsWith('parapet')?mesh.name.replace('parapet','roof'):'neighbor-balcony');
        assert.ok(support&&b.clone().expandByScalar(EPS).intersectsBox(boundsOf(support)),mesh.name);
      } else assert.match(mesh.name,/^(road-|walk-|curb-|main-lane-mark-|side-lane-mark-|east-garden-wall$)/,mesh.name);
    }
  }
});

test('exterior buffers have finite, positive transforms and outward triangle winding', () => {
  for (const mesh of make().children.filter(m => m.isMesh)) {
    assert.ok(mesh.scale.x > 0 && mesh.scale.y > 0 && mesh.scale.z > 0, mesh.name);
    const p = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
    const index = mesh.geometry.index;
    assert.ok([...p.array].every(Number.isFinite), mesh.name);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ia = index ? index.getX(i) : i;
      const ib = index ? index.getX(i + 1) : i + 1;
      const ic = index ? index.getX(i + 2) : i + 2;
      a.fromBufferAttribute(p, ia); b.fromBufferAttribute(p, ib); c.fromBufferAttribute(p, ic);
      const cross = b.sub(a).cross(c.sub(a));
      assert.ok(cross.lengthSq() > EPS * EPS, `degenerate ${mesh.name}`);
      assert.ok(cross.dot(new THREE.Vector3().fromBufferAttribute(normal, ia)) > 0, `winding ${mesh.name}`);
    }
  }
});

test('all road surfaces share one level, with no coplanar area overlaps', () => {
  const roads = make().children.filter(mesh => mesh.name.startsWith('road-'));
  const boxes = roads.map(boundsOf);
  for (let i = 0; i < roads.length; i++) {
    assert.ok(Math.abs(boxes[i].max.y - boxes[0].max.y) < EPS, `uneven road: ${roads[i].name}`);
    for (let j = i + 1; j < roads.length; j++) {
      const dx = Math.min(boxes[i].max.x, boxes[j].max.x) - Math.max(boxes[i].min.x, boxes[j].min.x);
      const dz = Math.min(boxes[i].max.z, boxes[j].max.z) - Math.max(boxes[i].min.z, boxes[j].min.z);
      assert.ok(dx < EPS || dz < EPS, `overlap: ${roads[i].name} / ${roads[j].name}`);
    }
  }
});

test('roadside sidewalks touch the street instead of leaving exposed slits', () => {
  const root = make();
  const frontWalk = boundsOf(root.getObjectByName('walk-across-road'));
  const main = boundsOf(root.getObjectByName('road-main-east'));
  const eastWalk = boundsOf(root.getObjectByName('walk-neighbors'));
  const side = boundsOf(root.getObjectByName('road-side'));
  assert.ok(Math.abs(frontWalk.min.z - main.max.z) < EPS, `front sidewalk gap ${frontWalk.min.z - main.max.z}`);
  assert.ok(Math.abs(eastWalk.min.x - side.max.x) < EPS, `east sidewalk gap ${eastWalk.min.x - side.max.x}`);
});

test('standing exterior pieces and building roofs physically meet their supports', () => {
  const root = make();
  const grounded = root.children.filter(mesh =>
    /wall$|hedge$|-trunk$|^shelter-post-|^car-wheel-|^bike-wheel-|^street-bin$|-pole$/.test(mesh.name));
  const failures = grounded.flatMap(mesh => {
    const bottom = boundsOf(mesh).min.y;
    const floor = supportAt(root, mesh.position.x, mesh.position.z);
    return bottom > floor + EPS ? [`${mesh.name}: gap ${(bottom - floor).toFixed(4)}`] : [];
  });
  for (const id of ['neighbor-apartment', 'neighbor-townhouse', 'corner-shop', 'east-neighbor']) {
    const body = boundsOf(root.getObjectByName(`${id}-body`));
    const roof = boundsOf(root.getObjectByName(`${id}-roof`));
    if (roof.min.y > body.max.y + EPS) failures.push(`${id}-roof: gap ${roof.min.y - body.max.y}`);
  }
  assert.deepEqual(failures, []);
});

test('existing building foundations do not occupy the connected roads', () => {
  const root=make(),roads=root.children.filter(m=>m.name.startsWith('road-')).map(boundsOf);
  for(const mesh of root.children.filter(m=>m.name.endsWith('-plinth'))){
    const b=boundsOf(mesh);
    for(const r of roads) assert.ok(Math.min(b.max.x,r.max.x)-Math.max(b.min.x,r.min.x)<EPS ||
      Math.min(b.max.z,r.max.z)-Math.max(b.min.z,r.min.z)<EPS,mesh.name);
  }
});

test('parking assembly stays on its parcel and ground supports all road extents', () => {
  const root = make(), parcel = boundsOf(root.getObjectByName('parking-parcel'));
  const ground = boundsOf(root.getObjectByName('district-ground'));
  for (const mesh of root.children) {
    const b = boundsOf(mesh);
    if (/^parking-shelter|^shelter-post|^parked-car|^car-wheel/.test(mesh.name)) {
      assert.ok(b.min.x >= parcel.min.x && b.max.x <= parcel.max.x, mesh.name);
      assert.ok(b.min.z >= parcel.min.z && b.max.z <= parcel.max.z, mesh.name);
    }
    if (/^road-|^walk-/.test(mesh.name)) {
      assert.ok(b.min.x >= ground.min.x && b.max.x <= ground.max.x, mesh.name);
      assert.ok(b.min.z >= ground.min.z && b.max.z <= ground.max.z, mesh.name);
      assert.ok(Math.abs(b.min.y - ground.max.y) < EPS, mesh.name);
    }
  }
});

// ---------------------------------------------------------------------------
// Parcel model, row-house structure and building-vs-building separation.
// These read the geometry that was actually drawn (every mesh box is compared
// against the declared rectangle it came from) and then apply the layout rules
// to those drawn boxes, so a declaration that quietly stops matching the meshes
// fails here instead of only in the renderer.
// ---------------------------------------------------------------------------

const layout = describeResidentialLayout(ROOMS);
const unionOf = rects => ({
  minX: Math.min(...rects.map(r => r.minX)), maxX: Math.max(...rects.map(r => r.maxX)),
  minZ: Math.min(...rects.map(r => r.minZ)), maxZ: Math.max(...rects.map(r => r.maxZ)),
});
const xzOf = box => ({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
const rectOf = value => value && typeof value.minX === 'number' ? value : xzOf(boundsOf(value));
/** XZ rectangle of a named mesh that must exist. */
const drawn = (root, name) => {
  const mesh = root.getObjectByName(name);
  assert.ok(mesh, `missing mesh ${name}`);
  return rectOf(mesh);
};
/** The drawn mesh must be exactly the declared rectangle it was generated from. */
const assertDrawn = (box, r, label) => {
  for (const [axis, value] of [['minX', r.minX], ['maxX', r.maxX], ['minZ', r.minZ], ['maxZ', r.maxZ]])
    assert.ok(Math.abs(box[axis] - value) < EPS,
      `${label} ${axis}: drawn ${box[axis]} != declared ${value}`);
};

/** Every drawn building footprint, with the group it belongs to. */
const collectBuildings = root => layout.groups.map(g => {
  const plinth = drawn(root, `${g.id}-plinth`);
  assertDrawn(plinth, g.plinth, `${g.id}-plinth`);
  const units = g.units.map(u => {
    const entry = {
      id: u.id, spec: u,
      body: drawn(root, `${u.id}-body`), roof: drawn(root, `${u.id}-roof`),
      parapet: drawn(root, `${u.id}-parapet`),
    };
    for (const kind of ['body', 'roof', 'parapet'])
      assertDrawn(entry[kind], u[kind], `${u.id}-${kind}`);
    return entry;
  });
  return { group: g, plinth, units };
});

test('every building body, roof and plinth is drawn inside its own parcel with a real setback', () => {
  const buildings = collectBuildings(make());
  assert.equal(buildings.length, 7, 'expected 3 terrace groups + 4 detached houses');
  assert.equal(buildings.reduce((sum, b) => sum + b.units.length, 0), 12, 'building count changed');
  assert.ok(PARCEL_SETBACK > 0);
  for (const { group, plinth, units } of buildings) {
    const parcel = group.parcel;
    assert.ok(parcel.maxX - parcel.minX > 0 && parcel.maxZ - parcel.minZ > 0, `${group.id} has an empty parcel`);
    const pieces = [[`${group.id}-plinth`, plinth],
      ...units.flatMap(u => [['body', u.body], ['roof', u.roof], ['parapet', u.parapet]]
        .map(([kind, box]) => [`${u.id}-${kind}`, box]))];
    for (const [name, box] of pieces) {
      const setbacks = {
        west: box.minX - parcel.minX, east: parcel.maxX - box.maxX,
        north: box.minZ - parcel.minZ, south: parcel.maxZ - box.maxZ,
      };
      for (const [side, setback] of Object.entries(setbacks))
        assert.ok(setback >= PARCEL_SETBACK - EPS,
          `${name} leaves only ${setback.toFixed(3)} on the ${side} of ${group.id}-parcel`);
    }
  }
});

test('background parcels never overlap each other', () => {
  const overlaps = [];
  for (let i = 0; i < layout.groups.length; i++) for (let j = i + 1; j < layout.groups.length; j++) {
    const a = layout.groups[i], b = layout.groups[j];
    const area = footprintOverlap(a.parcel, b.parcel);
    if (area > 0) overlaps.push(`${a.id}/${b.id} ${area.toFixed(3)}`);
  }
  assert.deepEqual(overlaps, []);
  // A parcel must also not swallow the neighbour's building.
  for (const { group, units } of collectBuildings(make()))
    for (const other of layout.groups) {
      if (other === group) continue;
      for (const u of units)
        assert.equal(footprintOverlap(u.body, other.parcel), 0,
          `${u.id}-body stands inside ${other.id}-parcel`);
    }
});

test('no building footprint touches a road, sidewalk, curb, parking lot, greenery or the playable house', () => {
  const root = make();
  const reserved = root.children.filter(m => RESERVED_SURFACE_PATTERN.test(m.name) || GREENERY_PATTERN.test(m.name));
  // The reserved vocabulary must stay meaningful: every class the spec names has
  // to be present, and a parking driveway would have to be listed here too.
  assert.ok(reserved.some(m => m.name.startsWith('road-')), 'no road surfaces reserved');
  assert.ok(reserved.some(m => m.name.startsWith('walk-')), 'no sidewalks reserved');
  assert.ok(reserved.some(m => m.name.startsWith('curb-')), 'no curbs reserved');
  assert.ok(reserved.some(m => m.name === 'parking-parcel'), 'parking lot not reserved');
  assert.ok(reserved.some(m => GREENERY_PATTERN.test(m.name) && !RESERVED_SURFACE_PATTERN.test(m.name)),
    'no greenery reserved');
  assert.deepEqual(root.children.filter(m => /driveway/.test(m.name)).map(m => m.name), [],
    'a parking driveway painting appeared; add it to RESERVED_SURFACE_PATTERN');

  const obstacles = [
    ...reserved.map(m => [m.name, rectOf(m)]),
    // Yard walls are not paving, but a house built through one still reads wrong.
    ...root.children.filter(m => /wall$/.test(m.name)).map(m => [m.name, rectOf(m)]),
    [layout.house.id, layout.house],
  ];
  const failures = [];
  for (const { group, plinth, units } of collectBuildings(root)) {
    const pieces = [[`${group.id}-plinth`, rectOf(plinth)],
      ...units.flatMap(u => [['body', u.body], ['roof', u.roof]]
        .map(([kind, box]) => [`${u.id}-${kind}`, rectOf(box)]))];
    for (const [name, box] of pieces) for (const [surfaceName, surface] of obstacles) {
      const area = footprintOverlap(box, surface);
      if (area > EPS) failures.push(`${name} stands on ${surfaceName} (${area.toFixed(3)})`);
    }
  }
  assert.deepEqual(failures, []);
});

test('row units have open side yards and every other building pair clears MIN_BUILDING_GAP', () => {
  const buildings = collectBuildings(make());
  assert.ok(MIN_BUILDING_GAP >= 3,
    `MIN_BUILDING_GAP ${MIN_BUILDING_GAP} is too tight to read as a residential setback`);
  assert.ok(MIN_BUILDING_GAP > 2 * ROOF_OVERHANG,
    'the gap rule must survive the eaves overhang on both sides');

  const failures = [];
  for (const { group, plinth, units } of buildings) {
    // Different roof heights must not share coincident vertical faces.
    for (let i = 0; i + 1 < units.length; i++) {
      const a = units[i], b = units[i + 1];
      for (const kind of ['body', 'roof', 'parapet']) {
        const gap = footprintGap(rectOf(a[kind]), rectOf(b[kind]));
        if (gap < ROW_BODY_GAP - 2 * ROOF_OVERHANG - EPS)
          failures.push(`${a.id}-${kind}/${b.id}-${kind}: side yard too narrow ${gap.toFixed(3)}`);
      }
      for (const ka of ['body', 'roof', 'parapet']) for (const kb of ['body', 'roof', 'parapet']) {
        const area = footprintOverlap(rectOf(a[ka]), rectOf(b[kb]));
        if (area > EPS) failures.push(`${a.id}-${ka} interpenetrates ${b.id}-${kb} (${area.toFixed(3)})`);
      }
    }
    // Non-adjacent units of one run still need a real yard between them.
    for (let i = 0; i < units.length; i++) for (let j = i + 2; j < units.length; j++)
      for (const kind of ['body', 'roof']) {
        const gap = footprintGap(rectOf(units[i][kind]), rectOf(units[j][kind]));
        if (gap < MIN_BUILDING_GAP - EPS)
          failures.push(`${units[i].id}-${kind}/${units[j].id}-${kind}: ${gap.toFixed(3)} < ${MIN_BUILDING_GAP}`);
      }
  }
  // Different buildings: body, roof and plinth envelopes all keep the gap.
  const envelopes = buildings.map(({ group, plinth, units }) => ({
    id: group.id, plinth: rectOf(plinth),
    bodyBox: unionOf(units.map(u => rectOf(u.body))), roofBox: unionOf(units.map(u => rectOf(u.roof))),
  }));
  for (let i = 0; i < envelopes.length; i++) for (let j = i + 1; j < envelopes.length; j++) {
    const a = envelopes[i], b = envelopes[j];
    const pairs = [
      ['body/body', a.bodyBox, b.bodyBox], ['roof/roof', a.roofBox, b.roofBox],
      ['plinth/plinth', a.plinth, b.plinth], ['body/plinth', a.bodyBox, b.plinth],
      ['plinth/body', a.plinth, b.bodyBox], ['roof/plinth', a.roofBox, b.plinth],
      ['plinth/roof', a.plinth, b.roofBox], ['roof/body', a.roofBox, b.bodyBox],
      ['body/roof', a.bodyBox, b.roofBox],
    ];
    for (const [label, first, second] of pairs) {
      const gap = footprintGap(first, second);
      if (gap < MIN_BUILDING_GAP - EPS)
        failures.push(`${a.id}-${label}/${b.id}: ${gap.toFixed(3)} < ${MIN_BUILDING_GAP}`);
    }
  }
  // Nothing may be built against the playable house either.
  for (const { group, plinth } of buildings) {
    const gap = footprintGap(rectOf(plinth), layout.house);
    if (gap < MIN_BUILDING_GAP - EPS)
      failures.push(`${group.id} is ${gap.toFixed(3)} from the playable house`);
  }
  assert.deepEqual(failures, []);
});

test('all actual unit meshes including facade details clear their neighboring houses', () => {
  const root = make();
  const units = layout.groups.flatMap(g => g.units);
  for (let i = 0; i < units.length; i++) for (let j = i + 1; j < units.length; j++) {
    const a = units[i], b = units[j];
    const first = root.children.filter(m => m.name.startsWith(a.id + '-'));
    const second = root.children.filter(m => m.name.startsWith(b.id + '-'));
    for (const ma of first) for (const mb of second) {
      const ba = boundsOf(ma), bb = boundsOf(mb);
      const overlap = ['x', 'y', 'z'].map(axis => Math.min(ba.max[axis], bb.max[axis]) - Math.max(ba.min[axis], bb.min[axis]));
      assert.ok(overlap.some(v => v <= EPS), `${ma.name} intersects ${mb.name}`);
    }
  }
});

test('community court joins the sidewalk, stays outside gameplay and clears buildings and streets', () => {
  const root = make(), court = root.getObjectByName('community-court-visual-only');
  assert.ok(court);
  const pad = boundsOf(court.getObjectByName('court-paving'));
  const path = boundsOf(court.getObjectByName('court-entrance-path'));
  const walk = boundsOf(root.getObjectByName('walk-north'));
  assert.ok(Math.abs(path.min.z - walk.max.z) < EPS);
  assert.ok(Math.abs(path.max.z - pad.min.z) < EPS);
  for (const reserved of [layout.house, ...layout.groups.map(g => g.plinth),
    ...root.children.filter(m => m.name.startsWith('road-')).map(m => xzOf(boundsOf(m)))]) {
    assert.equal(footprintOverlap(xzOf(pad), reserved), 0);
  }
  for (const sign of [-1, 1]) {
    assert.ok(court.getObjectByName(`court-hoop-${sign}-rim`));
    assert.ok(court.getObjectByName(`court-hoop-${sign}-backboard`));
  }
  court.traverse(object => {
    if (!object.isMesh && !object.isLineSegments) return;
    const b = boundsOf(object);
    assert.ok([...b.min.toArray(), ...b.max.toArray()].every(Number.isFinite), object.name);
    assert.ok(b.min.y >= pad.min.y - EPS, object.name);
    if (object.name !== 'court-entrance-path') {
      assert.ok(b.min.x >= pad.min.x - EPS && b.max.x <= pad.max.x + EPS, object.name);
      assert.ok(b.min.z >= pad.min.z - EPS && b.max.z <= pad.max.z + EPS, object.name);
    }
    assert.ok([...object.scale.toArray()].every(v => v > 0), object.name);
  });
});

test('the block reacts to the authored house box instead of hard-coded coordinates', () => {
  const scaledRooms = ROOMS.map(r => ({
    ...r, minX: r.minX * 1.5, maxX: r.maxX * 1.5, minZ: r.minZ * 1.5, maxZ: r.maxZ * 1.5,
  }));
  const grown = describeResidentialLayout(scaledRooms);
  assert.notDeepEqual(grown.groups.map(g => g.parcel), layout.groups.map(g => g.parcel));
  assert.deepEqual(grown.house, { id: 'house-footprint', minX: -42, maxX: 42, minZ: -28.5, maxZ: 28.5 });
  // Every rule re-runs inside the factory for the bigger house.
  for (const g of grown.groups) {
    for (const [what, piece] of [['body', g.body], ['roof', g.roof], ['plinth', g.plinth]]) {
      assert.ok(piece.minX >= g.parcel.minX + PARCEL_SETBACK - EPS, `${g.id}-${what} west setback`);
      assert.ok(piece.minZ >= g.parcel.minZ + PARCEL_SETBACK - EPS, `${g.id}-${what} north setback`);
    }
    assert.ok(footprintGap(g.plinth, grown.house) >= MIN_BUILDING_GAP - EPS, `${g.id} clears the bigger house`);
  }
  // The whole block still builds (and re-checks the reserved paving) for it.
  const bigRoot = buildResidentialExterior(new THREE.Group(), scaledRooms);
  bigRoot.updateMatrixWorld(true);
  const bounds = boundsOf(bigRoot);
  assert.ok(bounds.max.x - bounds.min.x > 0 && Number.isFinite(bounds.min.y));
});
