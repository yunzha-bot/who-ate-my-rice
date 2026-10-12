import * as THREE from 'three';
import type { CharacterAction } from '../systems/CharacterAction.ts';

export const DEEPSEEK_CLIPS = ['Idle', 'Walk', 'Run', 'Eat', 'HideEnter', 'HideIdle', 'HideExit'] as const;
export type DeepSeekClip = typeof DEEPSEEK_CLIPS[number];
export interface DeepSeekVisualState { concealed: boolean; eating: boolean }
export const DEEPSEEK_WALK_TIME_SCALE = 1.5;
export const DEEPSEEK_RUN_TIME_SCALE = 1.8;

/** Observes gameplay only. Bone animation never translates the actor or decides concealment. */
export class DeepSeekAnimation {
  readonly mixer: THREE.AnimationMixer;
  currentClip: DeepSeekClip = 'Idle';
  private readonly actions = new Map<DeepSeekClip, THREE.AnimationAction>();
  private concealed = false;
  private eating = false;
  private movement: DeepSeekClip = 'Idle';
  private finished = false;
  private readonly model: THREE.Group;
  private readonly fadeSeconds: number;
  private readonly onFinished = (event: { action: THREE.AnimationAction }): void => {
    if (event.action === this.actions.get(this.currentClip)) this.finished = true;
  };

  constructor(model: THREE.Group, fadeSeconds = .12) {
    this.model = model;
    this.fadeSeconds = fadeSeconds;
    for (const name of DEEPSEEK_CLIPS) {
      if (!model.animations.some(clip => clip.name === name && clip.duration > 0)) {
        throw new Error(`Missing DeepSeek animation: ${name}`);
      }
    }
    this.mixer = new THREE.AnimationMixer(model);
    for (const name of DEEPSEEK_CLIPS) {
      const action = this.mixer.clipAction(model.animations.find(clip => clip.name === name)!);
      const once = name === 'Eat' || name === 'HideEnter' || name === 'HideExit';
      action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      action.clampWhenFinished = once;
      this.actions.set(name, action);
    }
    this.mixer.addEventListener('finished', this.onFinished);
    this.actions.get('Idle')!.play();
  }

  update(action: CharacterAction, deltaSeconds: number, state: DeepSeekVisualState): void {
    this.movement = action === 'RUN' ? 'Run' : action === 'WALK' ? 'Walk' : 'Idle';
    if (state.concealed !== this.concealed) this.play(state.concealed ? 'HideEnter' : 'HideExit');
    else if (!state.concealed && this.currentClip !== 'HideExit') {
      if (state.eating && !this.eating) this.play('Eat');
      else if (this.currentClip !== 'Eat' || !state.eating) this.play(this.movement);
    }
    this.concealed = state.concealed;
    this.eating = state.eating;
    this.mixer.update(Math.min(Math.max(0, deltaSeconds), .1));
    if (this.finished) {
      this.finished = false;
      this.play(this.concealed ? 'HideIdle' : this.movement);
    }
  }

  reset(): void {
    this.mixer.stopAllAction();
    this.concealed = this.eating = this.finished = false;
    this.movement = this.currentClip = 'Idle';
    this.actions.get('Idle')!.reset().setEffectiveWeight(1).play();
    this.mixer.update(0);
  }

  dispose(): void {
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }

  private play(name: DeepSeekClip): void {
    if (name === this.currentClip) return;
    const previous = this.actions.get(this.currentClip)!;
    const next = this.actions.get(name)!;
    const timeScale = name === 'Walk' ? DEEPSEEK_WALK_TIME_SCALE
      : name === 'Run' ? DEEPSEEK_RUN_TIME_SCALE : 1;
    next.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).play();
    next.crossFadeFrom(previous, this.fadeSeconds, false);
    this.currentClip = name;
    this.finished = false;
  }
}
