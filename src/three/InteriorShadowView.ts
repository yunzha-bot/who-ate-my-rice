import * as THREE from 'three';
import { ROOMS, type Rect } from './map/apartmentMap.ts';

// 纯表现参数：接地影最大透明度、占地倍率与离地高度，不参与玩法。
export const CONTACT_SHADOW_OPACITY = 0.10;
export const FURNITURE_CONTACT_SCALE = 1.16;
export const ACTOR_CONTACT_SIZE = 0.85;
const CONTACT_Y = 0.018;
const outdoorRoom = (id: string) => id === 'balcony' || id === 'north_balcony';

export function isCoveredInterior(x: number, z: number): boolean {
  return ROOMS.some(room => !outdoorRoom(room.id) &&
    x >= room.minX - 1e-6 && x <= room.maxX + 1e-6 &&
    z >= room.minZ - 1e-6 && z <= room.maxZ + 1e-6);
}

/** 一条合并长墙可能跨越多个房间；按现有房间边界分段检查两侧。 */
export function wallHasOutdoorSide(rect: Rect): boolean {
  const vertical = rect.width < rect.depth;
  const center = vertical ? rect.z : rect.x;
  const length = vertical ? rect.depth : rect.width;
  const low = center - length / 2, high = center + length / 2;
  const cuts = [...new Set([low, high, ...ROOMS.flatMap(room => vertical
    ? [room.minZ, room.maxZ] : [room.minX, room.maxX])]
    .filter(value => value >= low && value <= high))].sort((a, b) => a - b);
  const across = (vertical ? rect.width : rect.depth) / 2 + .02;
  return cuts.slice(1).some((end, index) => {
    const along = (cuts[index] + end) / 2;
    return [-1, 1].some(side => !isCoveredInterior(
      vertical ? rect.x + side * across : along,
      vertical ? along : rect.z + side * across));
  });
}

const authoredShadows = new WeakMap<THREE.Mesh, { cast: boolean; receive: boolean }>();

/** 保存原始标记，进出室内时恢复原值，不把透明碰撞代理误变成投影物。 */
export function applyInteriorSunShadow(object: THREE.Object3D, covered: boolean): void {
  object.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    let original = authoredShadows.get(child);
    if (!original) {
      original = { cast: child.castShadow, receive: child.receiveShadow };
      authoredShadows.set(child, original);
    }
    child.castShadow = covered ? false : original.cast;
    child.receiveShadow = covered ? false : original.receive;
  });
}

/** 真Alpha渐变纹理；不依赖DOM、额外图片或后处理。 */
export function contactShadowTexture(round: boolean): THREE.DataTexture {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const nx = Math.abs((x + .5) / size * 2 - 1);
    const ny = Math.abs((y + .5) / size * 2 - 1);
    const radius = round ? Math.hypot(nx, ny) : (nx ** 4 + ny ** 4) ** .25;
    const t = THREE.MathUtils.clamp((radius - .45) / .55, 0, 1);
    const offset = (y * size + x) * 4;
    data[offset] = data[offset + 1] = data[offset + 2] = 255;
    data[offset + 3] = x === 0 || y === 0 || x === size - 1 || y === size - 1
      ? 0 : Math.round(255 * (1 - t * t * (3 - 2 * t)));
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export class InteriorShadowView {
  private readonly roundTexture = contactShadowTexture(true);
  private readonly furnitureTexture = contactShadowTexture(false);
  private readonly entries: { target: THREE.Object3D;
    shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; actor: boolean }[] = [];
  private readonly worldPosition = new THREE.Vector3();

  add(target: THREE.Object3D, rect?: Pick<Rect, 'width' | 'depth' | 'height'>): THREE.Mesh {
    const actor = !rect;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: 0x51483e, transparent: true,
        opacity: CONTACT_SHADOW_OPACITY, depthWrite: false, toneMapped: false,
        map: actor ? this.roundTexture : this.furnitureTexture }));
    shadow.name = 'contact-shadow';
    shadow.rotation.x = -Math.PI / 2;
    shadow.raycast = () => {}; // 不干扰角色点选或DEV家具拾取。
    shadow.scale.set(rect ? rect.width * FURNITURE_CONTACT_SCALE : ACTOR_CONTACT_SIZE,
      rect ? rect.depth * FURNITURE_CONTACT_SCALE : ACTOR_CONTACT_SIZE, 1);
    if (rect) {
      shadow.position.y = -rect.height / 2 + CONTACT_Y;
      target.add(shadow); // 编辑预览的移动、旋转、缩放自动跟随。
    } else {
      target.parent!.add(shadow); // 不继承角色动画的弹跳、倾斜与身体缩放。
    }
    this.entries.push({ target, shadow, actor });
    this.update();
    return shadow;
  }

  update(): void {
    for (const { target, shadow, actor } of this.entries) {
      target.getWorldPosition(this.worldPosition);
      const covered = isCoveredInterior(this.worldPosition.x, this.worldPosition.z);
      applyInteriorSunShadow(target, covered);
      shadow.visible = covered && target.visible;
      if (actor) shadow.position.set(this.worldPosition.x, CONTACT_Y, this.worldPosition.z);
    }
  }

  dispose(): void {
    for (const { shadow } of this.entries) {
      shadow.removeFromParent();
      shadow.geometry.dispose();
      shadow.material.dispose();
    }
    this.entries.length = 0;
    this.roundTexture.dispose();
    this.furnitureTexture.dispose();
  }
}
