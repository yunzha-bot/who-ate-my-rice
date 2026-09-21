import * as THREE from 'three';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { DoorState } from '../systems/DoorSystem.ts';
import type { DoorNode } from './map/apartmentMap.ts';

export class DoorView {
  readonly object = new THREE.Group();
  readonly leaf: THREE.Mesh;
  readonly lockCore: THREE.Mesh;
  readonly definition: DoorNode;
  private readonly label: THREE.Sprite | null;
  private readonly material: THREE.MeshStandardMaterial;

  constructor(definition: DoorNode, debugIndex: number, debug: boolean) {
    this.definition = definition;
    const config = GAME_CONFIG.door;
    this.object.name = definition.id;
    this.object.position.set(
      definition.x - Math.cos(definition.rotation) * definition.width / 2,
      0,
      definition.z + Math.sin(definition.rotation) * definition.width / 2,
    );
    this.object.rotation.y = definition.rotation;
    this.material = new THREE.MeshStandardMaterial({ color: config.colors.closed, roughness: 0.9 });
    this.leaf = new THREE.Mesh(
      new THREE.BoxGeometry(definition.width, config.leafHeight, config.leafThickness),
      this.material,
    );
    this.leaf.position.set(definition.width / 2, config.leafHeight / 2, 0);
    this.leaf.castShadow = this.leaf.receiveShadow = true;
    this.object.add(this.leaf);

    this.lockCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.22, 0.12),
      new THREE.MeshStandardMaterial({ color: config.colors.lockCore, emissive: config.colors.lockCore,
        emissiveIntensity: 0.45 }),
    );
    this.lockCore.position.set(definition.width - 0.18, config.leafHeight * 0.58, 0.12);
    this.object.add(this.lockCore);
    this.lockCore.visible = false;
    this.label = debug ? createLabel(`D${String(debugIndex + 1).padStart(2, '0')} CLOSED`) : null;
    if (this.label) {
      this.label.position.set(definition.width / 2, config.leafHeight + 0.45, 0);
      this.object.add(this.label);
    }
  }

  sync(state: DoorState): void {
    const config = GAME_CONFIG.door;
    this.object.rotation.y = this.definition.rotation +
      (state.state === 'OPEN' ? config.openAngle : 0);
    this.material.color.setHex(state.state === 'OPEN' ? config.colors.open
      : state.state === 'LOCKED' ? config.colors.locked : config.colors.closed);
    this.lockCore.visible = state.state === 'LOCKED' && state.locked;
    if (this.label) setLabel(this.label, `${shortId(this.label.name)} ${state.state}`,
      state.state === 'LOCKED' ? '#ffb48d' : state.state === 'OPEN' ? '#a9edb3' : '#f4ca7b');
  }

  closedCollisionBox(): THREE.Box3 {
    const config = GAME_CONFIG.door;
    const halfWidth = this.definition.rotation === 0
      ? this.definition.width / 2 : config.leafThickness / 2;
    const halfDepth = this.definition.rotation === 0
      ? config.leafThickness / 2 : this.definition.width / 2;
    return new THREE.Box3(
      new THREE.Vector3(this.definition.x - halfWidth, 0, this.definition.z - halfDepth),
      new THREE.Vector3(this.definition.x + halfWidth, config.leafHeight,
        this.definition.z + halfDepth),
    );
  }

  dispose(): void {
    this.leaf.geometry.dispose();
    this.material.dispose();
    this.lockCore.geometry.dispose();
    (this.lockCore.material as THREE.Material).dispose();
    if (this.label) {
      const material = this.label.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
    }
  }
}

function createLabel(text: string): THREE.Sprite {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
  sprite.name = text.split(' ')[0];
  sprite.scale.set(2.3, 0.43, 1);
  sprite.renderOrder = 6;
  setLabel(sprite, text, '#f4ca7b');
  return sprite;
}

function setLabel(sprite: THREE.Sprite, text: string, color: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#253038dd';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = color;
  context.font = 'bold 30px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 48);
  const material = sprite.material as THREE.SpriteMaterial;
  material.map?.dispose();
  material.map = new THREE.CanvasTexture(canvas);
  material.needsUpdate = true;
}

const shortId = (id: string): string => id;
