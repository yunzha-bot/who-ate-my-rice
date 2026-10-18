import * as THREE from 'three';
import type { RoomLightSystem, RoomLightSwitch } from '../systems/RoomLightSystem.ts';
import type { Point } from './map/apartmentMap.ts';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomDaylightView } from './RoomDaylightView.ts';

/** Physical household rocker switches and bounded original daylight. No gameplay authority. */
export class RoomLightView {
  readonly root = new THREE.Group();
  private readonly prompt: HTMLDivElement;
  private readonly items = new Map<string, { led: THREE.MeshBasicMaterial; rocker: THREE.Mesh }>();
  private readonly daylight: RoomDaylightView;
  readonly targets = new Map<string, THREE.Object3D>();
  private editorLayout: readonly RoomLightSwitch[] | null = null;

  setEditorLayout(layout: readonly RoomLightSwitch[] | null): void { this.editorLayout = layout; }

  constructor(scene: THREE.Scene, parent: HTMLElement, system: RoomLightSystem,
    ambient: THREE.HemisphereLight, sun: THREE.DirectionalLight) {
    this.daylight = new RoomDaylightView(scene, ambient, sun);
    this.root.name = 'hard-room-lights'; this.root.visible = false; scene.add(this.root);
    this.prompt = document.createElement('div'); this.prompt.className = 'room-light-prompt';
    this.prompt.hidden = true; this.prompt.setAttribute('aria-live', 'polite'); parent.append(this.prompt);
    for (const item of system.switches) {
      const mount = new THREE.Group(); mount.name = `light-switch:${item.roomId}`;
      mount.userData.objectId = mount.name; this.targets.set(mount.name, mount);
      mount.position.set(item.x, item.height ?? 1.3, item.z);
      mount.rotation.y = Math.atan2(item.normal.x, item.normal.z);
      const plate = new THREE.Mesh(new RoundedBoxGeometry(.46, .6, .07, 2, .025),
        new THREE.MeshStandardMaterial({ color: 0xd4d2c9, roughness: .8 }));
      const recess = new THREE.Mesh(new RoundedBoxGeometry(.33, .43, .04, 2, .015),
        new THREE.MeshStandardMaterial({ color: 0x6c6b65, roughness: 1 })); recess.position.z = .05;
      const rocker = new THREE.Mesh(new RoundedBoxGeometry(.28, .36, .07, 2, .018),
        new THREE.MeshStandardMaterial({ color: 0xf1f0e7, roughness: .65 }));
      rocker.name = 'rocker'; rocker.position.z = .085; rocker.rotation.x = -.12;
      const led = new THREE.MeshBasicMaterial({ color: 0x50666b });
      const indicator = new THREE.Mesh(new THREE.BoxGeometry(.065, .018, .008), led);
      indicator.position.set(0, -.09, .04); rocker.add(indicator);
      mount.add(plate, recess, rocker);
      for (const y of [-.247, .247]) {
        const screw = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .006, 8),
          new THREE.MeshStandardMaterial({ color: 0x9a9b96, metalness: .5, roughness: .5 }));
        screw.rotation.x = Math.PI / 2; screw.position.set(0, y, .04); mount.add(screw);
      }
      this.root.add(mount); this.items.set(item.roomId, { led, rocker });
    }
  }

  sync(enabled: boolean, system: RoomLightSystem, actor: Point | null,
    blocked: (a: Point, b: Point) => boolean, canAct: boolean): void {
    this.root.visible = enabled || this.editorLayout !== null;
    this.daylight.sync(enabled, system);
    for (const p of this.editorLayout ?? system.switches) {
      const mount = this.targets.get(`light-switch:${p.roomId}`)!;
      mount.position.set(p.x, p.height ?? 1.3, p.z);
      mount.rotation.y = Math.atan2(p.normal.x, p.normal.z);
    }
    for (const [id, item] of this.items) {
      const on = enabled && system.isOn(id);
      item.led.color.setHex(on ? 0x84b6a3 : 0x50666b);
      item.rocker.rotation.x = on ? .12 : -.12;
    }
    const nearby = enabled && actor && canAct ? system.nearby(actor, blocked) : null;
    this.prompt.hidden = !nearby;
    if (nearby) {
      const name = system.areaName(nearby.roomId);
      const cd = system.cooldown(nearby.roomId);
      this.prompt.textContent = `L ${system.isOn(nearby.roomId) ? '关灯' : '开灯'} · ${name}${cd > 0 ? ` · 等待 ${Math.ceil(cd / 1000)} 秒` : ''}`;
    }
  }

  dispose(): void {
    this.daylight.dispose();
    this.root.traverse(node => {
      if (node instanceof THREE.Mesh) { node.geometry.dispose(); (node.material as THREE.Material).dispose(); }
    });
    this.root.removeFromParent(); this.prompt.remove(); this.items.clear(); this.targets.clear();
  }
}
