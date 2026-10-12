import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildApartment } from '../src/three/map/MapBuilder.ts';
import { WALLS, ROOMS } from '../src/three/map/apartmentMap.ts';
import { InteriorShadowView, isCoveredInterior, wallHasOutdoorSide,
  contactShadowTexture, applyInteriorSunShadow, CONTACT_SHADOW_OPACITY }
  from '../src/three/InteriorShadowView.ts';

test('covered rooms reject sunlight shadows while perimeter walls still cast outdoors', () => {
  const apartment = buildApartment(new THREE.Scene(), { debug: false });
  let walls = 0, caps = 0, outside = 0;
  apartment.root.traverse(object => {
    if (object.userData.objectKind === 'WALL' && object.visible) {
      walls++;
      const rect = WALLS.find(w => w.id === object.userData.objectId);
      assert.equal(object.castShadow, wallHasOutdoorSide(rect), rect.id);
      if (object.castShadow) outside++;
      assert.equal(object.receiveShadow, false);
      assert.equal(object.geometry.type, 'BoxGeometry');
      assert.equal(object.position.x, rect.x);
      assert.equal(object.position.z, rect.z);
    }
    if (object.name === 'visual-wall-cap') {
      caps++;
      const wall = apartment.root.children.find(w => w.userData.objectKind === 'WALL' &&
        w.position.x === object.position.x && w.position.z === object.position.z);
      assert.equal(object.castShadow, wall.castShadow);
      assert.equal(object.receiveShadow, false);
    }
    if (object.name === 'garage-concrete-floor') assert.equal(object.receiveShadow, false);
  });
  assert.ok(walls > 0);
  assert.equal(caps, walls);
  assert.ok(outside > 0 && outside < walls);
  for (const mesh of apartment.furnitureMeshes.values())
    if (isCoveredInterior(mesh.position.x, mesh.position.z)) mesh.traverse(o => {
      if (o.isMesh) { assert.equal(o.castShadow, false); assert.equal(o.receiveShadow, false); }
    });
  apartment.dispose();
});

test('room coverage includes garage but leaves both balconies and streets exposed', () => {
  for (const room of ROOMS)
    assert.equal(isCoveredInterior(room.x, room.z), !['balcony', 'north_balcony'].includes(room.id), room.id);
  assert.equal(isCoveredInterior(30, 0), false);
  assert.equal(isCoveredInterior(24, -5), true);
  assert.equal(wallHasOutdoorSide(WALLS.find(w => w.id === 'wall_029')), true);
  assert.equal(wallHasOutdoorSide(WALLS.find(w => w.id === 'wall_036')), false);
});

test('contact textures have transparent edges and a smooth symmetric alpha falloff', () => {
  for (const round of [false, true]) {
    const texture = contactShadowTexture(round), { data, width } = texture.image;
    const alpha = (x, y) => data[(y * width + x) * 4 + 3];
    assert.equal(alpha(0, 0), 0); assert.equal(alpha(0, 32), 0);
    assert.equal(alpha(32, 32), 255);
    assert.ok(alpha(45, 32) > alpha(55, 32) && alpha(55, 32) > 0);
    assert.equal(alpha(20, 32), alpha(43, 32));
    texture.dispose();
  }
});

test('contact follows editor transforms, restores original outdoor flags and disposes cleanly', () => {
  const scene = new THREE.Scene();
  const target = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  target.castShadow = target.receiveShadow = true; target.position.set(24, .5, 0); scene.add(target);
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ opacity: 0, transparent: true }));
  target.add(proxy);
  const view = new InteriorShadowView(), contact = view.add(target, { width: 1, depth: 1, height: 1 });
  assert.equal(contact.material.opacity, CONTACT_SHADOW_OPACITY);
  assert.equal(target.castShadow, false); assert.equal(contact.visible, true);
  const ray = new THREE.Raycaster(new THREE.Vector3(24, 2, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(contact).length, 0);
  target.position.set(25, .5, 1); target.rotation.y = Math.PI / 2; target.scale.set(1.2, 1, 1.4); view.update();
  const world = contact.getWorldPosition(new THREE.Vector3());
  assert.equal(world.x, 25); assert.equal(world.z, 1); assert.ok(Math.abs(world.y - .018) < 1e-9);
  target.position.set(0, .5, -16); view.update();
  assert.equal(contact.visible, false); assert.equal(target.castShadow, true); assert.equal(target.receiveShadow, true);
  assert.equal(proxy.castShadow, false);
  target.position.set(24, .5, 0); target.visible = false; view.update(); assert.equal(contact.visible, false);
  let disposed = 0; contact.material.map.addEventListener('dispose', () => disposed++);
  view.dispose(); assert.equal(contact.parent, null); assert.equal(disposed, 1);
  target.geometry.dispose(); target.material.dispose(); proxy.geometry.dispose(); proxy.material.dispose();
});

test('actor contact stays grounded and newly loaded meshes obey interior policy', () => {
  const scene = new THREE.Scene(), actor = new THREE.Group(); scene.add(actor); actor.position.set(24, .5, 0);
  const view = new InteriorShadowView(), contact = view.add(actor);
  actor.position.set(25, 1.8, 1); actor.rotation.z = .3; actor.scale.setScalar(1.3); view.update();
  assert.deepEqual(contact.position.toArray(), [25, .018, 1]); assert.equal(contact.rotation.x, -Math.PI / 2);
  const loaded = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  loaded.castShadow = loaded.receiveShadow = true; actor.add(loaded); view.update();
  assert.equal(loaded.castShadow, false); assert.equal(loaded.receiveShadow, false);
  actor.position.set(0, .5, -16); view.update(); assert.equal(loaded.castShadow, true); assert.equal(contact.visible, false);
  applyInteriorSunShadow(actor, true); assert.equal(loaded.castShadow, false);
  view.dispose(); loaded.geometry.dispose(); loaded.material.dispose();
});
