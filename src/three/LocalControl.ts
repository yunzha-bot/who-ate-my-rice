import type { Direction } from '../systems/SprintSystem';

export type Faction = 'DEEPSEEK' | 'HUMAN';

export class LocalControl {
  selectedFaction: Faction | null = null;
  controlledFaction: Faction | null = null;

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

  resetControlled(): void {
    this.controlledFaction = this.selectedFaction;
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
