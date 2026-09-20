export type RiceInteractionState =
  | 'IDLE'
  | 'PREPARING'
  | 'EATING'
  | 'INTERRUPTED'
  | 'COMPLETED';

export interface RiceState {
  id: string;
  progressMs: number;
  maxProgressMs: number;
  completed: boolean;
  interactionState: RiceInteractionState;
}

export class RiceSystem {
  readonly rice: RiceState;
  private preparationMs = 0;
  private readonly prepareMs: number;

  constructor(id: string, maxProgressMs: number, prepareMs: number) {
    this.prepareMs = prepareMs;
    this.rice = {
      id,
      progressMs: 0,
      maxProgressMs,
      completed: false,
      interactionState: 'IDLE',
    };
  }

  update(deltaMs: number, canEat: boolean): void {
    if (this.rice.completed) return;
    if (!canEat) {
      this.interrupt();
      return;
    }

    let remainingMs = Math.max(0, deltaMs);
    if (this.preparationMs < this.prepareMs) {
      const preparationStep = Math.min(remainingMs, this.prepareMs - this.preparationMs);
      this.preparationMs += preparationStep;
      remainingMs -= preparationStep;
      if (this.preparationMs < this.prepareMs) {
        this.rice.interactionState = 'PREPARING';
        return;
      }
    }

    this.rice.interactionState = 'EATING';
    this.rice.progressMs = Math.min(
      this.rice.maxProgressMs,
      this.rice.progressMs + remainingMs,
    );
    if (this.rice.progressMs >= this.rice.maxProgressMs) {
      this.rice.completed = true;
      this.rice.interactionState = 'COMPLETED';
    }
  }

  interrupt(): void {
    if (this.rice.completed) return;
    if (this.rice.interactionState === 'PREPARING' || this.rice.interactionState === 'EATING') {
      this.rice.interactionState = 'INTERRUPTED';
    }
    this.preparationMs = 0;
  }

  reset(): void {
    this.preparationMs = 0;
    this.rice.progressMs = 0;
    this.rice.completed = false;
    this.rice.interactionState = 'IDLE';
  }
}
