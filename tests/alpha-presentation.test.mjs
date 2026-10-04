import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GentleCameraFollow, HomeAvatar, dressFurniture, cooldownFraction, HOME_COMPOSITION, homeFrustum, shortestTurn }
  from '../src/three/AlphaPresentation.ts';
import { DoorView } from '../src/three/DoorView.ts';
import { DOOR_NODES, FURNITURE, ROOMS, WALLS } from '../src/three/map/apartmentMap.ts';
import { buildApartment } from '../src/three/map/MapBuilder.ts';
import { GAME_CONFIG as C } from '../src/config/gameConfig.ts';
import { cameraRelativeDirection, positionCameraOnTarget } from '../src/three/CameraRelativeMovement.ts';

test('presentation camera follows continuously, snaps lifecycle transitions, preserves input axes', () => {
  const follow = new GentleCameraFollow();
  const target = new THREE.Vector3(1, .5, 2);
  follow.update(target);
  const before = follow.focus.clone();
  target.x += 1;
  follow.update(target, 16);
  assert.ok(follow.focus.x > before.x && follow.focus.x < target.x);
  const camera = new THREE.OrthographicCamera();
  const offset = new THREE.Vector3(12, 14, 12);
  positionCameraOnTarget(camera, before, offset);
  const direction = cameraRelativeDirection(camera, { x: 1, y: -1 });
  positionCameraOnTarget(camera, follow.focus, offset);
  const after = cameraRelativeDirection(camera, { x: 1, y: -1 });
  assert.ok(Math.hypot(after.x - direction.x, after.y - direction.y) < 1e-12);
  follow.update(target, 0);
  assert.deepEqual(follow.focus.toArray(), target.toArray());
  target.x = 90;
  follow.update(target, 16);
  assert.equal(follow.focus.x, 90);
});

test('camera smoothing is frame-rate independent for a stationary target', () => {
  const a = new GentleCameraFollow(), b = new GentleCameraFollow();
  a.update(new THREE.Vector3()); b.update(new THREE.Vector3());
  const target = new THREE.Vector3(1, 0, 0);
  a.update(target, 32); b.update(target, 16); b.update(target, 16);
  assert.ok(a.focus.distanceTo(b.focus) < 1e-12);
});

test('avatar animation never changes actor position, scale or rotation; resources are reused', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.5, 1, .5), new THREE.MeshStandardMaterial());
  actor.position.set(3, .5, 4);
  const avatar = new HomeAvatar(actor, true);
  const parts = [];
  avatar.root.traverse(o => { if (o instanceof THREE.Mesh) parts.push(o); });
  const geo = parts.map(p => p.geometry);
  avatar.update('IDLE', 100);
  const y = avatar.root.position.y;
  avatar.update('IDLE', 100);
  assert.notEqual(avatar.root.position.y, y);
  const held = avatar.root.position.y;
  avatar.update('IDLE', 0);
  assert.equal(avatar.root.position.y, held);
  avatar.update('RUN', 100);
  assert.ok(avatar.root.rotation.x > 0);
  assert.deepEqual(actor.position.toArray(), [3, .5, 4]);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  assert.equal(actor.rotation.z, 0);
  const after = [];
  avatar.root.traverse(o => { if (o instanceof THREE.Mesh) after.push(o.geometry); });
  assert.deepEqual(after, geo);
  let disposed = 0;
  geo.forEach(g => g.addEventListener('dispose', () => disposed++));
  avatar.reset();
  const height = actor.geometry.boundingBox.max.y - actor.geometry.boundingBox.min.y;
  assert.equal(avatar.root.position.y, height * (HOME_COMPOSITION.avatarHeight - 1) / 2);
  avatar.dispose();
  assert.equal(disposed, parts.length);
  assert.equal(actor.children.length, 0);
});

test('furniture dressings preserve root geometry, editor transforms and authored data', () => {
  const snapshot = JSON.stringify(FURNITURE);
  for (const rect of FURNITURE) {
    const geometry = new THREE.BoxGeometry(rect.width, rect.height, rect.depth);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    mesh.position.set(rect.x, rect.height / 2, rect.z);
    mesh.rotation.y = .7;
    dressFurniture(mesh, rect);
    assert.equal(mesh.geometry, geometry);
    assert.equal(mesh.rotation.y, .7);
    assert.deepEqual(mesh.position.toArray(), [rect.x, rect.height / 2, rect.z]);
    mesh.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  assert.equal(JSON.stringify(FURNITURE), snapshot);
});

test('cooldown ring is clamped and uses supplied authority, not an independent timer', () => {
  assert.equal(cooldownFraction(12000, 12000), 0);
  assert.equal(cooldownFraction(6000, 12000), .5);
  assert.equal(cooldownFraction(0, 12000), 1);
  assert.equal(cooldownFraction(-100, 12000), 1);
  assert.equal(cooldownFraction(15000, 12000), 0);
});

test('door polish keeps authoritative collision and open angle immediate', () => {
  const definition = DOOR_NODES[0];
  const view = new DoorView(definition, 0, false);
  const box = view.closedCollisionBox().clone();
  view.sync({ state: 'OPEN', locked: false, lockCoreState: 'AVAILABLE' });
  assert.equal(view.object.rotation.y, definition.rotation + C.door.openAngle);
  assert.deepEqual(view.closedCollisionBox(), box);
  view.sync({ state: 'LOCKED', locked: true, lockCoreState: 'AVAILABLE' });
  assert.equal(view.object.rotation.y, definition.rotation);
  assert.equal(view.lockCore.visible, true);
  view.dispose();
});

test('map polish computes colliders before visual details; sound view stays disabled', () => {
  const map = readFileSync(new URL('../src/three/map/MapBuilder.ts', import.meta.url), 'utf8');
  assert.ok(map.indexOf('obstacles.push(new THREE.Box3().setFromObject(mesh))') < map.indexOf('dressFurniture(mesh, rect)'));
  const game = readFileSync(new URL('../src/three/ThreeGame.ts', import.meta.url), 'utf8');
  assert.match(game, /PLAYER_SOUND_VISUAL_ENABLED(?:: boolean)? = false/);
  assert.match(game, /showMapDebug = import.meta.env.DEV/);
});

test('composition widens world view without changing camera rotation or gameplay config', () => {
  const snapshot = JSON.stringify(C);
  const wide = homeFrustum(16 / 9, false, 14, 30);
  assert.ok(Math.abs(wide.top - wide.bottom - 18.2) < 1e-8);
  assert.ok(Math.abs(-wide.left / (wide.right - wide.left) - .55) < 1e-8);
  const menu = homeFrustum(16 / 9, true, 14, 30);
  assert.equal(menu.top - menu.bottom, 40);
  // 2026-10-03 东翼扩建：等距镜头的水平轴是 u = (x − z)/√2，决定整张平面图能否
  // 进画的是地图的**对角跨度**而不是宽度。传入 MAP_WIDTH 后菜单必须覆盖它，
  // 否则 16:9 / 4:3 的 faction-select 会切掉新东翼（浏览器标记探针实测复现）。
  const framed = homeFrustum(16 / 9, true, 14, 38, 56);
  const reach = (56 + 38) / (2 * Math.SQRT2);
  assert.ok(framed.right >= reach - 1e-8, `menu right ${framed.right} < map reach ${reach}`);
  assert.ok(-framed.left >= reach - 1e-8, `menu left ${framed.left} misses map reach ${reach}`);
  // 四参数调用保持旧行为，避免影响其它调用点。
  assert.equal(homeFrustum(16 / 9, true, 14, 30).top - homeFrustum(16 / 9, true, 14, 30).bottom, 40);
  const narrow = homeFrustum(.7, true, 14, 30);
  assert.ok(narrow.right - narrow.left >= 52);
  assert.equal(JSON.stringify(C), snapshot);
});

test('enlarged character stays on an unchanged actor and keeps visual scale through reset', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.6, 1, .6), new THREE.MeshStandardMaterial());
  const geometry = actor.geometry;
  const avatar = new HomeAvatar(actor, false);
  avatar.update('WALK', 16);
  assert.equal(actor.geometry, geometry);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  assert.equal(avatar.root.scale.x, 1.35);
  assert.equal(avatar.root.scale.y, 1.65);
  avatar.reset();
  assert.equal(avatar.root.scale.y, 1.65);
  assert.ok(Math.abs(avatar.root.position.y - .325) < 1e-10);
  avatar.dispose();
});

test('cutaway walls retain full authoritative collision dimensions and map data', () => {
  const before = JSON.stringify({ WALLS, FURNITURE });
  const scene = new THREE.Scene();
  const apartment = buildApartment(scene, { debug: false });
  const axisAligned = [...WALLS, ...FURNITURE].filter(rect => !(rect.rotation ?? 0));
  assert.equal(apartment.obstacles.length, axisAligned.length);
  for (const rect of axisAligned) {
    const collider = apartment.obstacles.find(box => Math.abs(box.min.x - (rect.x - rect.width / 2)) < 1e-5 &&
      Math.abs(box.min.z - (rect.z - rect.depth / 2)) < 1e-5);
    assert.ok(collider, rect.id);
    assert.ok(Math.abs(collider.max.y - rect.height) < 1e-5, rect.id);
  }
  const wall = apartment.root.children.find(mesh => mesh.userData.objectId === WALLS[0].id);
  assert.equal(wall.scale.y, HOME_COMPOSITION.wallHeightScale);
  assert.equal(JSON.stringify({ WALLS, FURNITURE }), before);
  apartment.dispose();
});

test('chibi anatomy increases head and limb volume without enlarging the actor footprint', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.533, 1, .533), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  const body = avatar.root.getObjectByName('body');
  const head = avatar.root.getObjectByName('head');
  const arm = avatar.root.getObjectByName('leftArm');
  assert.ok(head.children[0].geometry.parameters.width > body.children[0].geometry.parameters.width);
  assert.ok(head.children[0].geometry.parameters.height >= .5);
  assert.ok(arm.children[0].geometry.parameters.width > .533 * .3);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  assert.equal(actor.geometry.parameters.width, .533);
  avatar.dispose();
});

test('walk drives opposite leg swings and counter-swinging arms then settles to idle', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.533, 1, .533), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  const leftLeg = avatar.root.getObjectByName('leftLeg');
  const rightLeg = avatar.root.getObjectByName('rightLeg');
  const leftArm = avatar.root.getObjectByName('leftArm');
  const head = avatar.root.getObjectByName('head');
  const samples = [];
  for (let i = 0; i < 18; i++) {
    actor.position.z += .035;
    avatar.update('WALK', 16);
    samples.push(leftLeg.rotation.x);
    assert.ok(Math.abs(leftLeg.rotation.x + rightLeg.rotation.x) < 1e-12);
    assert.ok(Math.abs(leftLeg.rotation.x + leftArm.rotation.x / (.44 / .52)) < 1e-12);
    assert.ok(Math.abs(head.rotation.z) < .04);
  }
  assert.ok(Math.max(...samples) - Math.min(...samples) > .3);
  for (let i = 0; i < 45; i++) avatar.update('IDLE', 16);
  assert.ok(Math.abs(leftLeg.rotation.x) < .01);
  assert.ok(Math.abs(leftArm.rotation.x) < .01);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  avatar.dispose();
});

test('turning uses a shortest, time-based arc for 90 and 180 degrees and holds facing at rest', () => {
  assert.ok(shortestTurn(Math.PI - .05, -Math.PI + .05) > 0);
  assert.ok(shortestTurn(-Math.PI + .05, Math.PI - .05) < 0);
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.533, 1, .533), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, false);
  actor.position.x = .06;
  avatar.update('WALK', 16);
  const eastFirst = avatar.root.rotation.y;
  assert.ok(eastFirst > 0 && eastFirst < Math.PI / 2);
  for (let i = 0; i < 25; i++) avatar.update('IDLE', 16);
  assert.ok(Math.abs(shortestTurn(avatar.root.rotation.y, Math.PI / 2)) < .1);
  actor.position.z = .06;
  avatar.update('WALK', 16);
  const northFirst = avatar.root.rotation.y;
  assert.ok(northFirst > 0 && northFirst < Math.PI / 2);
  actor.position.z = -.06;
  avatar.update('WALK', 16);
  assert.ok(Math.abs(shortestTurn(northFirst, avatar.root.rotation.y)) <= .128001);
  for (let i = 0; i < 50; i++) avatar.update('IDLE', 16);
  assert.ok(Math.abs(shortestTurn(avatar.root.rotation.y, Math.PI)) < .1);
  const stopped = avatar.root.rotation.y;
  avatar.update('IDLE', 16);
  assert.ok(Math.abs(shortestTurn(stopped, avatar.root.rotation.y)) < .02);
  avatar.reset();
  assert.equal(avatar.root.rotation.y, 0);
  avatar.dispose();
});

test('rapid WASD changes remain bounded and never rotate the gameplay actor', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.533, 1, .533), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  for (const [dx, dz] of [[0, -.06], [.06, 0], [0, .06], [-.06, 0],
    [0, -.06], [.06, 0], [0, .06], [-.06, 0]]) {
    const before = avatar.root.rotation.y;
    actor.position.x += dx;
    actor.position.z += dz;
    avatar.update('WALK', 16);
    assert.ok(Math.abs(shortestTurn(before, avatar.root.rotation.y)) <= .128001);
    assert.equal(actor.rotation.y, 0);
  }
  assert.ok(Number.isFinite(avatar.root.rotation.y));
  avatar.dispose();
});

test('sprint increases limb swing while the actor transform remains authoritative', () => {
  const actor = new THREE.Mesh(new THREE.BoxGeometry(.533, 1, .533), new THREE.MeshStandardMaterial());
  const avatar = new HomeAvatar(actor, true);
  const leftLeg = avatar.root.getObjectByName('leftLeg');
  let walkPeak = 0, runPeak = 0;
  for (let i = 0; i < 50; i++) {
    actor.position.x += .025;
    avatar.update('WALK', 16);
    walkPeak = Math.max(walkPeak, Math.abs(leftLeg.rotation.x));
  }
  for (let i = 0; i < 50; i++) {
    actor.position.x += .06;
    avatar.update('RUN', 16);
    runPeak = Math.max(runPeak, Math.abs(leftLeg.rotation.x));
  }
  assert.ok(runPeak > walkPeak);
  assert.ok(avatar.root.rotation.x > 0);
  assert.equal(actor.rotation.y, 0);
  assert.deepEqual(actor.scale.toArray(), [1, 1, 1]);
  avatar.dispose();
});

test('exterior is cosmetic, disposable and absent from collision and furniture indexes', () => {
  const scene = new THREE.Scene();
  const apartment = buildApartment(scene, { debug: false });
  const exterior = apartment.root.getObjectByName('residential-exterior-visual-only');
  assert.ok(exterior && exterior.children.length > 50);
  assert.equal(apartment.furnitureMeshes.size, FURNITURE.length);
  let disposed = 0;
  let count = 0;
  exterior.traverse(o => {
    if (o instanceof THREE.Mesh) {
      count++;
      assert.equal(o.userData.objectId, undefined);
      const hits = [];
      o.raycast(new THREE.Raycaster(), hits);
      assert.equal(hits.length, 0);
      o.geometry.addEventListener('dispose', () => disposed++);
    }
  });
  apartment.dispose();
  assert.equal(disposed, count);
  assert.equal(scene.children.length, 0);
});

test('the exterior reads as an asymmetric street block, not four roads around a house', () => {
  const scene = new THREE.Scene();
  const apartment = buildApartment(scene, { debug: false });
  const exterior = apartment.root.getObjectByName('residential-exterior-visual-only');
  const bounds = {
    left: Math.min(...ROOMS.map(room => room.minX)),
    right: Math.max(...ROOMS.map(room => room.maxX)),
    back: Math.min(...ROOMS.map(room => room.minZ)),
    front: Math.max(...ROOMS.map(room => room.maxZ)),
  };
  const main = exterior.getObjectByName('road-main-west');
  const side = exterior.getObjectByName('road-side');
  const service = exterior.getObjectByName('road-service');
  assert.ok(main instanceof THREE.Mesh && main.position.z > bounds.front + 4);
  assert.ok(side instanceof THREE.Mesh && side.position.x > bounds.right + 4);
  assert.ok(service instanceof THREE.Mesh && service.position.z < bounds.back - 4);
  assert.equal(exterior.getObjectByName('road-left'), undefined);
  for (const name of ['neighbor-apartment-body', 'neighbor-townhouse-body', 'corner-shop-body', 'east-neighbor-body',
    'parked-car-body', 'parking-shelter-roof', 'district-ground']) {
    const mesh = exterior.getObjectByName(name);
    assert.ok(mesh instanceof THREE.Mesh, `missing ${name}`);
    const hits = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    assert.equal(hits.length, 0);
  }
  for (const name of ['neighbor-apartment-body', 'neighbor-townhouse-body', 'corner-shop-body', 'east-neighbor-body']) {
    const envelope = new THREE.Box3().setFromObject(exterior.getObjectByName(name));
    assert.ok(envelope.max.x < bounds.left || envelope.min.x > bounds.right ||
      envelope.max.z < bounds.back || envelope.min.z > bounds.front, `${name} stays outside the playable home`);
  }
  apartment.dispose();
});
