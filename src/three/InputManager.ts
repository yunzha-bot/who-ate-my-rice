import type { Direction } from '../systems/SprintSystem';

export class InputManager {
  private readonly held = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly touchHeld = new Set<string>();
  private touchDirection: Direction = { x: 0, y: 0 };
  private tabCaptureEnabled = false;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clear);
  }

  localDirection(): Direction {
    const x = Number(this.held.has('KeyD') || this.held.has('ArrowRight')) -
      Number(this.held.has('KeyA') || this.held.has('ArrowLeft')) + this.touchDirection.x;
    const y = Number(this.held.has('KeyS') || this.held.has('ArrowDown')) -
      Number(this.held.has('KeyW') || this.held.has('ArrowUp')) + this.touchDirection.y;
    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  }

  debugDirection(ignoreL = false): Direction {
    return this.direction(
      this.held.has('KeyJ'), !ignoreL && this.held.has('KeyL'),
      this.held.has('KeyI'), this.held.has('KeyK'),
    );
  }

  isHeld(code: string): boolean { return this.held.has(code) || this.touchHeld.has(code); }

  setTouchDirection(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) { x = 0; y = 0; }
    const length = Math.hypot(x, y);
    this.touchDirection = length > 1 ? { x: x / length, y: y / length } : { x, y };
  }

  setTouchHeld(code: string, held: boolean): void {
    if (held) {
      if (!this.held.has(code) && !this.touchHeld.has(code)) this.pressed.add(code);
      this.touchHeld.add(code);
    } else this.touchHeld.delete(code);
  }

  setTabCaptureEnabled(enabled: boolean): void {
    this.tabCaptureEnabled = enabled;
  }

  consumePress(code: string): boolean {
    const wasPressed = this.pressed.has(code);
    this.pressed.delete(code);
    return wasPressed;
  }

  clear = (): void => {
    this.held.clear();
    this.touchHeld.clear();
    this.pressed.clear();
    this.setTouchDirection(0, 0);
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clear);
  }

  private direction(left: boolean, right: boolean, up: boolean, down: boolean): Direction {
    const x = Number(right) - Number(left);
    const y = Number(down) - Number(up);
    const length = Math.hypot(x, y);
    return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.code.startsWith('Arrow') || event.code === 'Space' ||
        (event.code === 'Tab' && this.tabCaptureEnabled)) event.preventDefault();
    if (!this.isHeld(event.code) && !event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };
}
