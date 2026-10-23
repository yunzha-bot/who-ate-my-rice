import * as THREE from 'three';
import type { ResidentialLayout } from './ResidentialExterior.ts';

type Shape = 'box' | 'round' | 'cylinder';
/** Static exterior dressing, batched by shape/material. No collision, AI or gameplay registration. */
export function buildStreetLife(parent: THREE.Group, layout: ResidentialLayout,
  floorAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group(); root.name = 'street-life-visual-only';
  root.userData.visualOnly = true; root.raycast = () => {}; parent.add(root);
  const colors = { wood: 0xa58a6b, cream: 0xe0d3b9, glass: 0x889e99, green: 0x83956f,
    soil: 0x766754, steel: 0x67746d, tire: 0x505953, terracotta: 0xae8167, paper: 0xd9c4a2 };
  const batches = new Map<string, { shape: Shape; color: number; matrices: THREE.Matrix4[]; names: string[] }>();
  const pose = new THREE.Object3D();
  const piece = (shape: Shape, name: string, x: number, y: number, z: number,
    w: number, h: number, d: number, color: number, rx = 0) => {
    pose.position.set(x, y, z); pose.rotation.set(rx, 0, 0); pose.scale.set(w, h, d); pose.updateMatrix();
    const key = `${shape}-${color.toString(16)}`;
    let batch = batches.get(key);
    if (!batch) { batch = { shape, color, matrices: [], names: [] }; batches.set(key, batch); }
    batch.matrices.push(pose.matrix.clone()); batch.names.push(name);
  };
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, color: number) =>
    piece('box', name, x, y, z, w, h, d, color);
  const pot = (name: string, x: number, z: number) => {
    const y = floorAt(x, z);
    piece('cylinder', `${name}-pot`, x, y + .2, z, .29, .4, .29, colors.terracotta);
    piece('cylinder', `${name}-soil`, x, y + .41, z, .25, .025, .25, colors.soil);
    piece('round', `${name}-leaves`, x, y + .65, z, .36, .35, .32, colors.green);
  };
  const label = (name: string, text: string, x: number, y: number, z: number, w: number, h: number, facingNorth = true) => {
    // Node geometry checks can build the scene without a canvas implementation.
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#e7d9bd'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#a48f6d'; ctx.lineWidth = 5; ctx.strokeRect(7, 7, 498, 114);
    ctx.fillStyle = '#4c6459'; ctx.font = '600 64px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 66, 460);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: texture}));
    mesh.name = name; mesh.position.set(x, y, z); mesh.rotation.y = facingNorth ? Math.PI : 0;
    mesh.raycast = () => {}; root.add(mesh);
  };

  // Corner shop: a readable storefront and two small clusters, with the central doorway clear.
  const shop = layout.groups.find(g => g.id === 'corner-shop')!;
  const sx = (shop.body.minX + shop.body.maxX) / 2, sz = shop.body.minZ;
  for (const side of [-1, 1]) {
    box(`shop-window-${side}-frame`, sx + side * 3.1, 1.12, sz - .06, 3.0, 1.48, .09, colors.cream);
    box(`shop-window-${side}-glass`, sx + side * 3.1, 1.12, sz - .115, 2.76, 1.25, .025, colors.glass);
    for (const y of [.78, 1.22]) box(`shop-shelf-${side}-${y}`, sx + side * 3.1, y, sz - .14, 2.5, .055, .04, colors.cream);
  }
  box('shop-name-board', sx, 3.1, sz - .45, 4.4, .55, .06, colors.green);
  label('shop-name-sign', '米巷便利店', sx, 3.1, sz - .487, 4.25, .48);
  for (let i = 0; i < 12; i++) {
    const x = sx - 4.58 + i * .83, color = i % 2 ? colors.cream : colors.green;
    box(`shop-awning-stripe-${i}`, x, 2.442, sz - .61, .82, .018, 1.18, color);
    box(`shop-awning-valance-${i}`, x, 2.28, sz - 1.21, .82, .22, .05, color);
  }
  const produceZ = sz - 1.12, produceY = floorAt(sx - 3.7, produceZ);
  for (const [i, x] of [sx - 4.1, sx - 2.85].entries()) {
    box(`shop-crate-${i}`, x, produceY + .3, produceZ, 1.03, .6, .82, colors.wood);
    box(`shop-crate-${i}-inset`, x, produceY + .62, produceZ, .85, .035, .65, colors.soil);
    for (let fruit = 0; fruit < 6; fruit++) piece('round', `shop-produce-${i}-${fruit}`,
      x - .29 + fruit % 3 * .29, produceY + .74, produceZ - .17 + Math.floor(fruit / 3) * .34,
      .145, .13, .145, i ? 0xb6a366 : 0xa37b60);
  }
  const cartX = sx + 3.9, cartZ = sz - 1.22, cartY = floorAt(cartX, cartZ);
  box('delivery-cart-deck', cartX, cartY + .22, cartZ, 1.13, .11, .85, colors.steel);
  for (const x of [cartX - .44, cartX + .44]) {
    box(`delivery-cart-handle-${x}`, x, cartY + .63, cartZ + .32, .065, .82, .065, colors.steel);
    for (const z of [cartZ - .28, cartZ + .28])
      piece('cylinder', `delivery-cart-wheel-${x}-${z}`, x, cartY + .12, z, .12, .09, .12, colors.tire, Math.PI / 2);
  }
  box('delivery-cart-handle-bar', cartX, cartY + 1.02, cartZ + .32, .92, .065, .065, colors.steel);
  box('delivery-cart-package-lower', cartX, cartY + .49, cartZ, .84, .44, .63, colors.paper);
  box('delivery-cart-package-upper', cartX + .06, cartY + .87, cartZ, .65, .32, .52, colors.wood);
  box('delivery-cart-packing-tape', cartX + .06, cartY + 1.035, cartZ, .14, .012, .53, colors.cream);
  pot('shop-entry-planter', sx + 5.0, sz - 1.0);

  // A parallel parking pocket beyond the existing carport; keep the road and curb crossing clear.
  const parkingZ = layout.front - 1.45, parkingX = layout.right + 32;
  const parkingY = floorAt(parkingX, parkingZ);
  box('parking-pocket-paving', parkingX, parkingY + .012, parkingZ, 14.8, .024, 5.8, 0xa6aa9d);
  for (const x of [layout.right + 25, layout.right + 31, layout.right + 39])
    box(`parking-bay-mark-${x}`, x, parkingY + .03, parkingZ, .065, .015, 4.9, colors.cream);
  const car = (name: string, x: number, color: number) => {
    const z = parkingZ, y = parkingY + .025;
    box(`${name}-body`, x, y + .57, z, 3.75, .62, 1.65, color);
    box(`${name}-cabin`, x - .12, y + 1.08, z, 1.96, .54, 1.39, color);
    for (const side of [-1, 1]) {
      box(`${name}-window-${side}`, x - .12, y + 1.13, z + side * .706, 1.61, .34, .018, colors.glass);
      for (const axle of [-1, 1]) piece('cylinder', `${name}-wheel-${side}-${axle}`,
        x + axle * 1.16, y + .29, z + side * .81, .29, .17, .29, colors.tire, Math.PI / 2);
      box(`${name}-headlight-${side}`, x + 1.89, y + .58, z + side * .52, .035, .16, .33, colors.cream);
      box(`${name}-taillight-${side}`, x - 1.89, y + .58, z + side * .52, .035, .14, .31, colors.terracotta);
    }
    box(`${name}-windscreen`, x + .88, y + 1.1, z, .025, .37, 1.16, colors.glass);
  };
  car('street-parked-hatchback', layout.right + 28, 0x93a3a1);
  car('street-parked-sedan', layout.right + 35, 0xb18c79);
  const chargerX = layout.right + 38, chargerZ = layout.front - 3.68;
  box('parking-charger', chargerX, parkingY + .57, chargerZ, .42, 1.08, .38, colors.steel);
  box('parking-charger-display', chargerX, parkingY + .79, chargerZ - .2, .25, .21, .025, colors.glass);

  // Mailboxes and plant pots sit beside houses, not in gates, pavements or the playable house.
  let number = 1;
  for (const group of layout.groups.filter(g => g.kind === 'row')) for (const unit of group.units) {
    const x = (unit.body.minX + unit.body.maxX) / 2;
    const north = unit.face === 'north', direction = north ? -1 : 1;
    const facade = north ? unit.body.minZ : unit.body.maxZ;
    const z = facade + direction * 1.22, y = floorAt(x, z);
    const offset = (unit.body.maxX - unit.body.minX) * .34;
    const mailboxZ = facade + direction * .2;
    box(`${unit.id}-mailbox`, x - offset, 1.08, mailboxZ, .48, .35, .32, number % 2 ? colors.green : colors.wood);
    box(`${unit.id}-mail-slot`, x - offset, 1.14, mailboxZ + direction * .17, .3, .045, .025, colors.tire);
    box(`${unit.id}-doormat`, x, y + .012, z, 1.12, .025, .59, colors.wood);
    if (number % 3 !== 0) pot(`${unit.id}-planter`, x + offset, facade + direction * .4);
    label(`${unit.id}-address`, String(number++).padStart(2, '0'), x + 1.05, 1.65,
      facade + direction * .065, .62, .29, north);
  }

  // Everyday street infrastructure is grouped around an existing rest spot and intersection.
  const noticeX = layout.left - 5.3, noticeZ = layout.back - 5.25, noticeY = floorAt(noticeX, noticeZ);
  for (const x of [noticeX - .75, noticeX + .75]) box(`notice-post-${x}`, x, noticeY + .85, noticeZ, .09, 1.7, .09, colors.steel);
  box('neighborhood-notice-board', noticeX, noticeY + 1.45, noticeZ, 1.8, .95, .15, colors.wood);
  label('neighborhood-notice-label', '邻里公告', noticeX, noticeY + 1.45, noticeZ - .085, 1.58, .72);
  const signX = layout.right + 5.4, signZ = layout.front + 2.4, signY = floorAt(signX, signZ);
  box('street-direction-post', signX, signY + 1.1, signZ, .09, 2.2, .09, colors.steel);
  box('street-direction-board', signX, signY + 1.98, signZ, 1.5, .4, .1, colors.green);
  label('street-direction-label', '米巷 →', signX, signY + 1.98, signZ - .06, 1.4, .32);
  for (const [x,z] of [[layout.cx - 9,layout.front + 5.2],[layout.right + 6,layout.front + 10.4]]) {
    const y = floorAt(x,z);
    piece('cylinder', `street-manhole-${x}`, x, y + .018, z, .43, .025, .43, colors.steel);
    for (const dx of [-.16,0,.16]) box(`street-manhole-groove-${x}-${dx}`,x+dx,y+.033,z,.035,.006,.44,colors.tire);
  }

  // Rear service street is exposed between the opening logo and settings. Keep its road open;
  // one small sheltered waiting spot gives that frontage an everyday purpose, not a prop wall.
  const stopX = layout.cx - 18, stopZ = layout.back - 5.1, stopY = floorAt(stopX, stopZ);
  for (const side of [-1,1]) {
    box(`north-stop-post-${side}`,stopX+side*2.25,stopY+1.15,stopZ+.48,.1,2.3,.1,colors.steel);
    box(`north-stop-bench-leg-${side}`,stopX+side*1.45,stopY+.24,stopZ+.15,.1,.48,.44,colors.steel);
    const x=stopX+side*4.65,z=stopZ+.2,y=floorAt(x,z);
    box(`north-stop-planter-${side}`,x,y+.22,z,1.05,.44,1.05,colors.wood);
    box(`north-stop-planter-soil-${side}`,x,y+.45,z,.85,.025,.85,colors.soil);
    piece('round',`north-stop-planter-leaves-${side}`,x,y+.7,z,.49,.35,.43,colors.green);
  }
  box('north-stop-canopy',stopX,stopY+2.32,stopZ,5.25,.14,1.5,colors.green);
  box('north-stop-canopy-trim',stopX,stopY+2.25,stopZ+.77,5.25,.18,.06,colors.cream);
  box('north-stop-bench-seat',stopX,stopY+.52,stopZ+.15,3.6,.13,.52,colors.wood);
  box('north-stop-bench-back',stopX,stopY+.84,stopZ+.42,3.6,.44,.07,colors.wood);
  box('north-stop-route-board',stopX+2.2,stopY+1.45,stopZ+.48,.65,.95,.08,colors.cream);
  for(let row=0;row<3;row++)box(`north-stop-route-line-${row}`,stopX+2.2,stopY+1.7-row*.17,stopZ+.53,.4,.035,.015,colors.steel);
  label('north-stop-name','米巷站',stopX,stopY+2.3,stopZ+.807,2.8,.32,false);
  const poleX=stopX-3.15,poleZ=stopZ-.2;
  box('north-stop-sign-post',poleX,stopY+.94,poleZ,.075,1.88,.075,colors.steel);
  box('north-stop-sign',poleX,stopY+1.75,poleZ,.48,.55,.085,colors.green);
  box('north-stop-sign-inset',poleX,stopY+1.75,poleZ+.05,.3,.35,.02,colors.cream);
  const laneZ=layout.back-9;
  for(let x=layout.cx-48;x<layout.right-3;x+=5.5)
    box(`north-service-lane-${x}`,x,floorAt(x,laneZ)+.009,laneZ,2.2,.012,.085,colors.cream);
  const bayZ=layout.back-6.9;
  for(let i=0;i<5;i++)box(`north-service-stop-bay-${i}`,stopX-2.8+i*1.4,
    floorAt(stopX,bayZ)+.009,bayZ,.85,.012,.075,colors.paper);

  const geometries: Record<Shape, THREE.BufferGeometry> = { box: new THREE.BoxGeometry(1,1,1),
    round: new THREE.IcosahedronGeometry(1,0), cylinder: new THREE.CylinderGeometry(1,1,1,12) };
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  for (const [key, batch] of batches) {
    if (!materials.has(batch.color)) materials.set(batch.color,new THREE.MeshStandardMaterial({color:batch.color,roughness:1,flatShading:true}));
    const mesh = new THREE.InstancedMesh(geometries[batch.shape],materials.get(batch.color)!,batch.matrices.length);
    mesh.name = `street-life-${key}`; mesh.userData.parts = batch.names;
    batch.matrices.forEach((matrix,index)=>mesh.setMatrixAt(index,matrix));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
    mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};root.add(mesh);
  }
  return root;
}
