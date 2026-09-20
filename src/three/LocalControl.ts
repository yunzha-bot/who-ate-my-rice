import type { Direction } from '../systems/SprintSystem';

export type Faction = 'DEEPSEEK' | 'HUMAN';

export class LocalControl {
  faction: Faction | null = null;

  choose(faction: Faction): void {
    this.faction = faction;
  }

  clear(): void {
    this.faction = null;
  }

  controlled<T>(deepseek: T, human: T): T | null {
    return this.faction === 'DEEPSEEK' ? deepseek
      : this.faction === 'HUMAN' ? human : null;
  }

  directions(local: Direction, debug: Direction): { deepseek: Direction; human: Direction } {
    return this.faction === 'HUMAN'
      ? { deepseek: debug, human: local }
      : { deepseek: local, human: debug };
  }
}
