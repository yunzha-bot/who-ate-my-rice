import * as THREE from 'three';

// Pure scenery dimensions. They never participate in playable map data or collision.
export const COMMUNITY_COURT = {
  width: 24, depth: 13, baseHeight: .16, lineWidth: .085,
  fenceHeight: 1.65, hoopHeight: 2.65,
} as const;

/** A small full court with two hoops, connected to the existing north sidewalk. */
export function buildCommunityCourt(parent: THREE.Group, site: {
  left: number; back: number; groundTop: number; sidewalkZ: number;
}): THREE.Group {
  const root = new THREE.Group();
  root.name = 'community-court-visual-only';
  root.position.set(site.left - 19, site.groundTop, site.back + 10);
  parent.add(root);
  const C = COMMUNITY_COURT;
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number) => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    return materials.get(color)!;
  };
  const mesh = (name: string, geometry: THREE.BufferGeometry, color: number,
    x: number, y: number, z: number) => {
    const object = new THREE.Mesh(geometry, material(color));
    object.name = `court-${name}`;
    object.position.set(x, y, z);
    object.raycast = () => {};
    object.receiveShadow = true;
    root.add(object);
    return object;
  };
  const box = (name: string, x: number, y: number, z: number,
    w: number, h: number, d: number, color: number) =>
    mesh(name, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  const top = C.baseHeight;
  const paint = top + .014;
  const chalk = 0xe2deca, steel = 0x697973;
  box('paving', 0, .04, 1, 31, .08, 25, 0xbfb9a5);
  // This path physically meets both the court apron and the authored sidewalk.
  const north = site.sidewalkZ - root.position.z;
  const apronNorth = -11.5;
  box('entrance-path', 11.7, .07, (north + apronNorth) / 2,
    2.3, .14, apronNorth - north, 0xc9c1ad);
  box('surface', 0, top / 2, 0, C.width + 3, top, C.depth + 3, 0x8d9b89);
  box('playing-field', 0, top + .003, 0, C.width, .006, C.depth, 0x82938a);
  for (const sign of [-1, 1])
    box(`key-${sign}`, sign * 9.7, top + .008, 0, 4.6, .008, 4.6, 0xae9382);
  const stroke = (name: string, x: number, z: number, w: number, d: number) =>
    box(name, x, paint, z, w, .008, d, chalk);
  const arc = (name: string, x: number, z: number, radius: number,
    start = 0, length = Math.PI * 2) => {
    const geometry = new THREE.RingGeometry(radius - C.lineWidth / 2,
      radius + C.lineWidth / 2, 64, 1, start, length);
    geometry.rotateX(-Math.PI / 2);
    mesh(name, geometry, chalk, x, paint + .007, z);
  };
  for (const sign of [-1, 1]) {
    stroke(`sideline-${sign}`, 0, sign * C.depth / 2, C.width, C.lineWidth);
    stroke(`baseline-${sign}`, sign * C.width / 2, 0, C.lineWidth, C.depth);
    stroke(`free-throw-${sign}`, sign * 7.4, 0, C.lineWidth, 4.6);
    for (const side of [-1, 1]) {
      stroke(`key-side-${sign}-${side}`, sign * 9.7, side * 2.3, 4.6, C.lineWidth);
      stroke(`three-side-${sign}-${side}`, sign * 11.4, side * 5.5, 1.2, C.lineWidth);
    }
    arc(`free-circle-${sign}`, sign * 7.4, 0, 1.55);
    arc(`three-arc-${sign}`, sign * 10.8, 0, 5.5,
      sign < 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
  }
  stroke('halfway-line', 0, 0, C.lineWidth, C.depth);
  arc('center-circle', 0, 0, 1.65);

  // Baked line geometry keeps the fence light and avoids hundreds of tiny meshes.
  const fencePoints: THREE.Vector3[] = [];
  const fencePosts = new Set<string>();
  const wire = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    fencePoints.push(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const fence = (name: string, x0: number, z0: number, x1: number, z1: number) => {
    const length = Math.hypot(x1 - x0, z1 - z0);
    const h = C.fenceHeight, base = .08;
    const alongX = x0 !== x1;
    box(`fence-${name}-rail`, (x0 + x1) / 2, base + h, (z0 + z1) / 2,
      alongX ? length : .07, .07, alongX ? .07 : length, steel);
    const posts = Math.ceil(length / 3);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const key = `${x.toFixed(6)}:${z.toFixed(6)}`;
      if (fencePosts.has(key)) continue;
      fencePosts.add(key);
      box(`fence-${name}-post-${i}`, x, base + h / 2, z, .10, h, .10, steel);
    }
    for (let y = base + .35; y < base + h; y += .35) wire(x0, y, z0, x1, y, z1);
    const count = Math.ceil(length / .5);
    for (let i = 1; i < count; i++) {
      const t = i / count, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      wire(x, base + .08, z, x, base + h, z);
    }
  };
  fence('north', -13.8, -8.5, 13.8, -8.5);
  fence('west', -13.8, -8.5, -13.8, 8.5);
  fence('east', 13.8, -8.5, 13.8, 8.5);
  // Two deliberate openings on the seating side, rather than a closed cage.
  fence('south-middle', -9.5, 8.5, 9.5, 8.5);
  const fenceLines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fencePoints),
    new THREE.LineBasicMaterial({ color: 0x819087 }));
  fenceLines.name = 'court-fence-mesh'; fenceLines.raycast = () => {}; root.add(fenceLines);

  for (const sign of [-1, 1]) {
    const x = sign * 12.65;
    box(`hoop-${sign}-foot`, x, .19, 0, .85, .22, .85, 0xa8a599);
    box(`hoop-${sign}-post`, x, 1.61, 0, .18, 2.62, .18, steel);
    box(`hoop-${sign}-arm`, sign * 11.95, 2.89, 0, 1.58, .16, .16, steel);
    box(`hoop-${sign}-backboard`, sign * 11.15, 3.12, 0, .10, .98, 1.65, 0xd5d5c5);
    // Front-facing target square is entirely on the board's inside face.
    for (const side of [-1, 1]) {
      box(`hoop-${sign}-target-h-${side}`, sign * 11.09, 2.98 + side * .22, 0, .018, .045, .69, 0xab8d78);
      box(`hoop-${sign}-target-v-${side}`, sign * 11.09, 2.98, side * .345, .018, .44, .045, 0xab8d78);
    }
    const ring = new THREE.TorusGeometry(.32, .035, 6, 20);
    ring.rotateX(-Math.PI / 2);
    mesh(`hoop-${sign}-rim`, ring, 0xb37e61, sign * 10.78, C.hoopHeight, 0);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(.30, .19, .42, 8, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xd4d1be, roughness: 1, wireframe: true }));
    net.name = `court-hoop-${sign}-net`;
    net.position.set(sign * 10.78, C.hoopHeight - .22, 0); net.raycast = () => {}; root.add(net);
  }
  for (const x of [-6, 5]) {
    box(`bench-${x}-seat`, x, .62, 10.7, 3.4, .14, .72, 0x9c876e);
    box(`bench-${x}-back`, x, 1.04, 11.04, 3.4, .72, .10, 0xa18e75);
    for (const side of [-1, 1]) box(`bench-${x}-leg-${side}`, x + side * 1.3, .33, 10.7, .16, .50, .62, steel);
  }
  for (const [i, x, z] of [[0, -14.7, -9.7], [1, 14.7, 10.7]]) {
    box(`lamp-${i}-base`, x, .15, z, .42, .14, .42, 0xa8a599);
    box(`lamp-${i}-pole`, x, 2, z, .13, 3.70, .13, steel);
    box(`lamp-${i}-shade`, x, 3.9, z, .85, .16, .60, 0xc6bca6);
    box(`lamp-${i}-light`, x, 3.80, z, .65, .04, .42, 0xe4d7b5);
  }
  // Low planting sits at the apron corners; the court remains legible from above.
  for (const [i, x, z] of [[0, -12, 11.7], [1, 13, 4], [2, -9, -10.4]]) {
    box(`planter-${i}`, x, .26, z, i === 1 ? .85 : 2.3, .36, i === 1 ? 3 : .85, 0xaa9f89);
    box(`plant-${i}`, x, .63, z, i === 1 ? .7 : 2.1, .40, i === 1 ? 2.8 : .7, 0x84987b);
  }
  return root;
}
