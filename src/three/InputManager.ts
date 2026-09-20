import type { Direction } from '../systems/SprintSystem';

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  localDirection(): Direction {
    return this.direction(
      this.held.has('KeyA') || this.held.has('ArrowLeft'),
      this.held.has('KeyD') || this.held.has('ArrowRight'),
      this.held.has('KeyW') || this.held.has('ArrowUp'),
      this.held.has('KeyS') || this.held.has('ArrowDown'),
    );
  }

  debugDirection(): Direction {
    return this.direction(
      this.held.has('KeyJ'), this.held.has('KeyL'),
      this.held.has('KeyI'), this.held.has('KeyK'),
    );
  }

  isHeld(code: string): boolean { return this.held.has(code); }

  consumePress(code: string): boolean {
    const wasPressed = this.pressed.has(code);
    this.pressed.delete(code);
    return wasPressed;
  }

  clear = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private direction(left: boolean, right: boolean, up: boolean, down: boolean): Direction {
    // Screen-space input: +x right, +y down; the camera converts this to world XZ.
    const x = Number(right) - Number(left);
    const z = Number(down) - Number(up);
    const length = Math.hypot(x, z);
    return length > 0 ? { x: x / length, y: z / length } : { x: 0, y: 0 };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (!this.held.has(event.code) && !event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };
}
