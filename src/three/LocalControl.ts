import type { Direction } from '../systems/SprintSystem';
import { Raycaster, Vector2, type Camera, type Object3D } from 'three';

export type Faction = 'DEEPSEEK' | 'HUMAN';

// Pointer coordinates are normalized to the renderer canvas, not the page.
export function pickActorFaction(camera: Camera, pointer: Vector2,
  deepseek: Object3D, human: Object3D): Faction | null {
  const raycaster = new Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([deepseek, human]);
  return hits[0]?.object === deepseek ? 'DEEPSEEK'
    : hits[0]?.object === human ? 'HUMAN' : null;
}

export class LocalControl {
  selectedFaction: Faction | null = null;
  controlledFaction: Faction | null = null;

  get temporaryInputTarget(): Faction | null { return this.controlledFaction; }
  get cameraTarget(): Faction | null { return this.selectedFaction; }
  get informationObserver(): Faction | null { return this.selectedFaction; }

  get faction(): Faction | null {
    return this.selectedFaction;
  }

  choose(faction: Faction): void {
    this.selectedFaction = faction;
    this.controlledFaction = faction;
  }

  toggleControlled(): boolean {
    if (this.controlledFaction === null) return false;
    this.controlledFaction = this.controlledFaction === 'DEEPSEEK' ? 'HUMAN' : 'DEEPSEEK';
    return true;
  }

  switchPrimaryFaction(): boolean {
    if (this.selectedFaction === null) return false;
    this.selectedFaction = this.selectedFaction === 'DEEPSEEK' ? 'HUMAN' : 'DEEPSEEK';
    this.controlledFaction = this.selectedFaction;
    return true;
  }

  resetControlled(): void {
    this.controlledFaction = this.selectedFaction;
  }

  setTemporaryInputTarget(faction: Faction): boolean {
    if (this.selectedFaction === null) return false;
    this.controlledFaction = faction;
    return true;
  }

  selected<T>(deepseek: T, human: T): T | null {
    return this.selectedFaction === 'DEEPSEEK' ? deepseek
      : this.selectedFaction === 'HUMAN' ? human : null;
  }

  isControlling(faction: Faction): boolean {
    return this.controlledFaction === faction;
  }

  clear(): void {
    this.selectedFaction = null;
    this.controlledFaction = null;
  }

  controlled<T>(deepseek: T, human: T): T | null {
    return this.controlledFaction === 'DEEPSEEK' ? deepseek
      : this.controlledFaction === 'HUMAN' ? human : null;
  }

  directions(local: Direction, debug: Direction): { deepseek: Direction; human: Direction } {
    return this.controlledFaction === 'HUMAN'
      ? { deepseek: debug, human: local }
      : { deepseek: local, human: debug };
  }
}
