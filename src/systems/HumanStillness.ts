import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { Point } from '../three/map/apartmentMap.ts';

/** Match-level Human movement history. Visibility never advances or resets it. */
export class HumanStillness {
  stillMs = 0;
  eventId = 0;
  private anchor: Point;

  constructor(position: Point) {
    this.anchor = { x: position.x, z: position.z };
  }

  update(position: Point, deltaMs: number): void {
    if (Math.hypot(position.x - this.anchor.x, position.z - this.anchor.z) >
        GAME_CONFIG.deepseekAI.curiosityMovementEpsilon) {
      this.anchor = { x: position.x, z: position.z };
      this.stillMs = 0;
      this.eventId++;
      return;
    }
    this.stillMs += Math.max(0, deltaMs);
  }

  reset(position: Point): void {
    this.anchor = { x: position.x, z: position.z };
    this.stillMs = 0;
    this.eventId = 0;
  }
}
