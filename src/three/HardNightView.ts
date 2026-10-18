import * as THREE from 'three';
import type { Faction } from './LocalControl.ts';
import { GAME_CONFIG as C } from '../config/gameConfig.ts';

/** Render-only night palette and opponent suppression; never changes gameplay entities. */
export class HardNightView {
  private readonly scene: THREE.Scene;
  private readonly ambient: THREE.HemisphereLight;
  private readonly directional: THREE.DirectionalLight;
  private active = false;
  private observer: Faction | null = null;
  private visibleRemainingMs = 0;
  opponentVisible = false;
  private readonly dayBackground: THREE.Scene['background'];
  private readonly daySky: THREE.Color;
  private readonly dayGround: THREE.Color;
  private readonly dayMoon: THREE.Color;
  private readonly dayAmbient: number;
  private readonly dayDirectional: number;
  private readonly nightBackground = new THREE.Color(0x101a30);

  constructor(scene: THREE.Scene, ambient: THREE.HemisphereLight, directional: THREE.DirectionalLight) {
    this.scene = scene; this.ambient = ambient; this.directional = directional;
    this.dayBackground = scene.background;
    this.daySky = ambient.color.clone(); this.dayGround = ambient.groundColor.clone();
    this.dayMoon = directional.color.clone();
    this.dayAmbient = ambient.intensity; this.dayDirectional = directional.intensity;
  }

  resetVisibility(): void {
    this.observer = null;
    this.visibleRemainingMs = 0;
    this.opponentVisible = false;
  }

  sync(enabled: boolean, observer: Faction | null, concealedDeepseek: boolean,
    deepseek: THREE.Object3D, human: THREE.Object3D, inSight = false, deltaMs = 0): void {
    const night = enabled && observer !== null;
    if (!night || observer !== this.observer) this.resetVisibility();
    this.observer = night ? observer : null;
    const concealedOpponent = observer === 'HUMAN' && concealedDeepseek;
    if (!night || concealedOpponent) this.visibleRemainingMs = 0;
    else if (inSight) this.visibleRemainingMs = C.difficulty.hardNightHideDelayMs;
    else this.visibleRemainingMs = Math.max(0, this.visibleRemainingMs - Math.max(0, deltaMs));
    this.opponentVisible = night && !concealedOpponent && (inSight || this.visibleRemainingMs > 0);
    if (night !== this.active) {
      this.active = night;
      this.scene.background = night ? this.nightBackground : this.dayBackground;
      if (night) {
        // Readable moonlight, not a black overlay; existing room/prop materials stay intact.
        this.ambient.color.setHex(0x9bb9ed); this.ambient.groundColor.setHex(0x283651);
        this.ambient.intensity = .9;
        this.directional.color.setHex(0x8eace0); this.directional.intensity = .65;
      } else {
        this.ambient.color.copy(this.daySky); this.ambient.groundColor.copy(this.dayGround);
        this.ambient.intensity = this.dayAmbient;
        this.directional.color.copy(this.dayMoon); this.directional.intensity = this.dayDirectional;
      }
    }
    deepseek.visible = !concealedDeepseek && (!night || observer === 'DEEPSEEK' || this.opponentVisible);
    human.visible = !night || observer === 'HUMAN' || this.opponentVisible;
  }
}
