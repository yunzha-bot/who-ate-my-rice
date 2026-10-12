import * as THREE from 'three';

/** Reference-board-inspired low-poly geometry. Coordinates belong to visual joints only. */
export function buildDeepSeekMaid(
  joints: { body: THREE.Group; head: THREE.Group; leftArm: THREE.Group;
    rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group },
  w: number, h: number, cloth: THREE.MeshStandardMaterial,
): void {
  const { body, head } = joints;
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .88 });
  const white = material(0xfff7ed), skin = material(0xffdcc6), navy = material(0x293557);
  const blue = material(0x70b8e1), ink = material(0x25304b), iris = material(0x4686c3);
  const hair = material(0xffffff);
  cloth.color.setHex(0x33436a);
  const mesh = (parent: THREE.Group, name: string, geometry: THREE.BufferGeometry,
    mat: THREE.Material, x: number, y: number, z: number) => {
    const part = new THREE.Mesh(geometry, mat);
    part.name = name;
    part.position.set(x * w, y * h, z * w);
    part.castShadow = part.receiveShadow = true;
    parent.add(part);
    return part;
  };
  const box = (parent: THREE.Group, name: string, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, mat: THREE.Material) =>
    mesh(parent, name, new THREE.BoxGeometry(sx * w, sy * h, sz * w), mat, x, y, z);
  const rounded = (parent: THREE.Group, name: string, x: number, y: number, z: number,
    rx: number, ry: number, rz: number, mat: THREE.Material, jaw = false) => {
    const geometry = new THREE.SphereGeometry(1, 16, 10);
    const vertices = geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) {
      const yy = vertices.getY(i);
      const cheek = jaw ? 1 + .08 * Math.exp(-(((yy + .3) / .24) ** 2))
        - .17 * Math.max(0, -yy - .4) : 1;
      vertices.setXYZ(i, vertices.getX(i) * rx * w * cheek,
        yy * ry * h, vertices.getZ(i) * rz * w);
    }
    geometry.computeVertexNormals();
    return mesh(parent, name, geometry, mat, x, y, z);
  };
  const shape = (parent: THREE.Group, name: string, points: number[][], depth: number,
    mat: THREE.Material, x = 0, y = 0, z = 0) => {
    const outline = new THREE.Shape(points.map(([px, py]) => new THREE.Vector2(px * w, py * h)));
    return mesh(parent, name, new THREE.ExtrudeGeometry(outline,
      { depth: depth * w, bevelEnabled: false }), mat, x, y, z);
  };
  const bow = (parent: THREE.Group, name: string, x: number, y: number, z: number,
    scale: number, mat: THREE.Material) => {
    const piece = shape(parent, name, [[-.22,.08],[-.04,.025],[.22,.08],[.19,-.07],
      [0,-.025],[-.19,-.07]], .08, mat, x, y, z);
    piece.scale.setScalar(scale);
    box(parent, `${name}-knot`, x, y, z + .025, .075 * scale, .065 * scale, .10 * scale, mat);
  };
  rounded(body, 'maid-bodice', 0, .075, 0, .49, .165, .42, cloth);
  box(body, 'white-bib', 0, .115, .405, .48, .22, .055, white);
  bow(body, 'collar-bow', 0, .215, .45, .55, navy);
  const skirt = new THREE.CylinderGeometry(.49 * w, .87 * w, .34 * h, 12);
  skirt.scale(1, 1, .83);
  mesh(body, 'maid-skirt', skirt, cloth, 0, -.17, 0);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2;
    const ruffle = box(body, 'hem-ruffle', Math.sin(a) * .81, -.337,
      Math.cos(a) * .68, .27, .075, .15, white);
    ruffle.rotation.y = a;
  }
  shape(body, 'white-apron', [[-.34,.04],[.34,.04],[.55,-.24],[.37,-.30],
    [0,-.33],[-.37,-.30],[-.55,-.24]], .045, white, 0, 0, .73);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++)
    box(body, 'apron-lace', s * (.34 + i * .055), -.045 - i * .06, .77,
      .095, .055, .055, white).rotation.z = s * .25;
  // Extruded whale emblem, so the apron does not depend on a flat character sprite.
  const whale = mesh(body, 'apron-whale', new THREE.SphereGeometry(1, 10, 6), iris, -.015, -.16, .80);
  whale.scale.set(w * .17, h * .065, w * .018);
  shape(body, 'whale-emblem-tail', [[0,0],[.10,.06],[.08,.09],[.14,.07],
    [.20,.10],[.19,.035],[.09,-.025]], .02, iris, .08, -.15, .795);
  box(body, 'whale-eye', -.085, -.148, .825, .018, .012, .012, white);
  bow(body, 'apron-back-bow', 0, .04, -.48, 1.35, blue);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -.16 * h, -.36 * w), new THREE.Vector3(.12 * w, -.27 * h, -.85 * w),
    new THREE.Vector3(.28 * w, -.05 * h, -1.04 * w)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 9, w * .075, 6, false), iris);
  tail.name = 'whale-tail-stem'; tail.castShadow = true; body.add(tail);
  shape(body, 'whale-tail-flukes', [[0,0],[-.30,.11],[-.40,.22],[-.15,.19],
    [0,.10],[.15,.19],[.40,.22],[.30,.11]], .09, iris, .28, -.06, -1.10);

  head.position.y = h * .46;
  rounded(head, 'face', 0, 0, .13, .73, .30, .54, skin, true);
  const rootBlue = material(0x3b568e);
  rounded(head, 'hair-cap-volume', 0, .09, -.10, .82, .36, .70, rootBlue);
  const faceSurface = (x: number, y: number) =>
    .13 + .54 * Math.sqrt(Math.max(.08, 1 - (x / .73) ** 2 - (y / .30) ** 2));
  const facialMark = (name: string, x: number, y: number, width: number,
    height: number, layer: number, mat: THREE.Material) => {
    const part = box(head, name, x, y, faceSurface(x, y) + layer,
      width, height, .025, mat);
    part.rotation.y = Math.asin(THREE.MathUtils.clamp(x / .73, -.95, .95));
    return part;
  };
  for (const s of [-1, 1]) {
    facialMark('eye-white', s * .275, -.055, .205, .09, .015, white);
    facialMark('eye-iris', s * .275, -.053, .125, .083, .032, iris);
    facialMark('eye-pupil', s * .275, -.047, .057, .065, .049, ink);
    facialMark('eye-highlight', s * .275 - .018, -.023, .035, .025, .063, white);
    facialMark('eyelash', s * .275, -.003, .21, .018, .043, ink);
    facialMark('blush', s * .45, -.12, .11, .024, .025, material(0xeeb1b0));
  }
  facialMark('nose', 0, -.115, .028, .022, .035, skin);
  facialMark('smile', 0, -.16, .095, .013, .039, material(0xb77b79));
  // Vertex colours grade the long hair from dark blue roots to pale blue tips.
  const hairLock = (name: string, x: number, y: number, z: number,
    width: number, length: number, tilt: number) => {
    const geo = new THREE.CylinderGeometry(width * w * .55, width * w * .06, length * h, 6, 6);
    const positions = geo.getAttribute('position');
    const colors: number[] = [];
    const dark = new THREE.Color(0x3c5793), light = new THREE.Color(0x91c9e9);
    for (let i = 0; i < positions.count; i++) {
      const t = THREE.MathUtils.clamp(.5 - positions.getY(i) / (length * h), 0, 1);
      positions.setX(i, positions.getX(i) + Math.sign(x || 1) * w * .12 * t * t);
      positions.setZ(i, positions.getZ(i) - w * .08 * t * t);
      const c = dark.clone().lerp(light, t * t);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    hair.vertexColors = true;
    const lock = mesh(head, name, geo, hair, x, y, z);
    lock.rotation.z = tilt;
    return lock;
  };
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - .5) * Math.PI * 1.05;
    hairLock('long-hair-layer', Math.sin(a) * .66, -.23,
      -Math.cos(a) * .64, .38, .93 - .09 * Math.abs(Math.sin(a)), Math.sin(a) * .13);
  }
  for (const s of [-1, 1]) {
    hairLock('side-lock', s * .64, -.16, .37, .30, .72, s * -.08);
    shape(head, 'whale-fin-ornament', [[0,0],[.39,-.05],[.52,-.12],[.24,-.14],[-.02,-.07]],
      .15, navy, s * .70, .02, -.025).scale.x = s;
    shape(head, 'fin-white-frill', [[0,0],[.32,-.04],[.40,-.075],[.24,-.105],[.15,-.065],[.04,-.09]],
      .10, white, s * .72, -.035, .04).scale.x = s;
    bow(head, 'blue-hair-bow', s * .73, .05, .56, .56, blue);
  }
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * .19;
    hairLock('layered-bang', x, .14 + .015 * (i % 2), .60, .25,
      .24 + .03 * (i % 2), (i - 3) * -.045);
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 10 - .5) * Math.PI;
    rounded(head, 'maid-headband-ruffle', Math.sin(a) * .72, .10 + Math.cos(a) * .29,
      .13, .105, .055, .13, white).rotation.z = -a;
  }
  const ahoge = new THREE.CatmullRomCurve3([new THREE.Vector3(0,h*.39,0),
    new THREE.Vector3(-w*.16,h*.53,0),new THREE.Vector3(-w*.37,h*.48,w*.06),
    new THREE.Vector3(-w*.40,h*.38,w*.11)]);
  mesh(head, 'ahoge', new THREE.TubeGeometry(ahoge, 10, w * .026, 5, false), navy, 0, 0, 0);
  for (const s of [-1, 1]) {
    const arm = s < 0 ? joints.leftArm : joints.rightArm;
    const leg = s < 0 ? joints.leftLeg : joints.rightLeg;
    arm.position.set(s * w * .67, h * .15, 0);
    leg.position.set(s * w * .28, -h * .25, .055);
    box(arm, 'puff-sleeve', 0, -.055, 0, .39, .18, .55, cloth);
    box(arm, 'sleeve', 0, -.19, .025, .28, .19, .42, cloth);
    box(arm, 'cuff', 0, -.285, .025, .35, .055, .47, white);
    box(arm, 'hand', 0, -.335, .025, .25, .085, .35, skin);
    box(leg, 'stocking', 0, -.10, 0, .31, .20, .44, white);
    box(leg, 'shoe', 0, -.215, .085, .39, .07, .67, navy);
    box(leg, 'shoe-strap', 0, -.174, .14, .40, .025, .12, blue);
  }
}
