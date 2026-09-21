import { RiceSystem } from './RiceSystem.ts';

// S5 spatial adapter: five independent, persistent S2 rice interactions.
export class RiceField {
  readonly portions: RiceSystem[];
  private currentId: string | null = null;

  constructor(ids: readonly string[], maxProgressMs: number, prepareMs: number) {
    this.portions = ids.map(id => new RiceSystem(id, maxProgressMs, prepareMs));
  }

  get totalProgressMs(): number {
    return this.portions.reduce((sum, portion) => sum + portion.rice.progressMs, 0);
  }

  get totalMaxProgressMs(): number {
    return this.portions.reduce((sum, portion) => sum + portion.rice.maxProgressMs, 0);
  }

  get completedCount(): number {
    return this.portions.filter(portion => portion.rice.completed).length;
  }

  get completed(): boolean {
    return this.portions.length > 0 && this.completedCount === this.portions.length;
  }

  get progressRatio(): number {
    return this.totalMaxProgressMs === 0 ? 0 : this.totalProgressMs / this.totalMaxProgressMs;
  }

  get activeId(): string | null { return this.currentId; }

  get(id: string): RiceSystem | undefined {
    return this.portions.find(portion => portion.rice.id === id);
  }

  update(deltaMs: number, targetId: string | null, canEat: boolean): void {
    if (this.currentId !== targetId) this.interrupt();
    this.currentId = canEat ? targetId : null;
    for (const portion of this.portions) {
      portion.update(deltaMs, canEat && portion.rice.id === targetId);
    }
  }

  interrupt(): void {
    for (const portion of this.portions) portion.interrupt();
    this.currentId = null;
  }
}
