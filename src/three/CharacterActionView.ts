import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig.ts';
import type { CharacterAction } from '../systems/CharacterAction.ts';
import type { Faction } from './LocalControl.ts';

/** Visual-only bridge. A future GLB loader may supply its mixer and named clips. */
export class CharacterActionView {
  action: CharacterAction = 'IDLE';
  lastTransitionReason = 'ROUND_START';
  private mixer: THREE.AnimationMixer | null = null;
  private clips: Partial<Record<CharacterAction, THREE.AnimationClip>> = {};
  private idleClips: Partial<Record<SpecialIdleSlot, THREE.AnimationClip>> = {};
  private availableIdleSlots: SpecialIdleSlot[] = [];
  private activeClip: THREE.AnimationAction | null = null;
  private specialIdleAction: THREE.AnimationAction | null = null;
  private idleElapsedMs = 0;
  private hasPlayedSpecialIdle = false;
  private previousSpecialIdleSlot: SpecialIdleSlot | null = null;
  currentIdleSlot: SpecialIdleSlot | null = null;
  private fallRemainingMs = 0;
  private readonly mesh: THREE.Mesh;
  private readonly faction: Faction;
  private readonly random: () => number;
  private readonly onMixerFinished = (event: { action: THREE.AnimationAction }): void => {
    if (event.action !== this.specialIdleAction) return;
    this.currentIdleSlot = null;
    this.specialIdleAction = null;
    this.activeClip = null;
    this.lastTransitionReason = '特殊待机结束，恢复普通 IDLE';
    this.playClip();
  };

  constructor(mesh: THREE.Mesh, faction: Faction, random: () => number = Math.random) {
    this.mesh = mesh;
    this.faction = faction;
    this.random = random;
    this.paint();
  }

  attachMixer(mixer: THREE.AnimationMixer,
    clips: Partial<Record<CharacterAction, THREE.AnimationClip>>,
    idleClips: Partial<Record<SpecialIdleSlot, THREE.AnimationClip>> = {}): void {
    this.mixer?.removeEventListener('finished', this.onMixerFinished);
    this.activeClip?.stop();
    this.mixer = mixer;
    this.clips = clips;
    this.idleClips = idleClips;
    this.availableIdleSlots = C.characterAnimation.specialIdleSlots
      .filter((slot): slot is SpecialIdleSlot => !!idleClips[slot]);
    this.specialIdleAction = null;
    this.currentIdleSlot = null;
    this.idleElapsedMs = 0;
    this.hasPlayedSpecialIdle = false;
    this.activeClip = null;
    this.mixer.addEventListener('finished', this.onMixerFinished);
    this.playClip();
  }

  /** Called only in PLAYING; pause and menus freeze both clip time and fall pose time. */
  update(requested: CharacterAction, deltaMs: number): void {
    const elapsed = Math.max(0, deltaMs);
    if (requested === 'FALL') this.fallRemainingMs = C.characterAnimation.fallPoseMs;
    else this.fallRemainingMs = Math.max(0, this.fallRemainingMs - elapsed);
    const next = requested === 'STUN' && this.fallRemainingMs > 0 ? 'FALL' : requested;
    if (next === 'IDLE') this.idleElapsedMs += elapsed;
    else {
      this.idleElapsedMs = 0;
      if (this.specialIdleAction) this.stopSpecialIdle();
    }
    if (next !== this.action) {
      this.action = next;
      this.lastTransitionReason = this.describeTransition(next, requested);
      this.paint();
      this.playClip();
    }
    this.mixer?.update(elapsed / 1000);
    this.tryPlaySpecialIdle();
  }

  reset(): void {
    this.fallRemainingMs = 0;
    this.action = 'IDLE';
    this.idleElapsedMs = 0;
    this.hasPlayedSpecialIdle = false;
    this.previousSpecialIdleSlot = null;
    this.currentIdleSlot = null;
    this.lastTransitionReason = 'ROUND_RESET';
    this.mixer?.removeEventListener('finished', this.onMixerFinished);
    this.activeClip?.stop();
    this.specialIdleAction = null;
    this.activeClip = null;
    this.paint();
    this.mixer?.addEventListener('finished', this.onMixerFinished);
    this.playClip();
  }

  get idleSeconds(): number {
    return this.idleElapsedMs / 1000;
  }

  private paint(): void {
    const base = this.faction === 'DEEPSEEK' ? C.player.color : C.human.color;
    const material = this.mesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(this.action === 'STUN' || this.action === 'FALL'
      ? C.characterAnimation.stunColor : base);
    // Do not move/scale actor roots: they also anchor collisions and Capture Zone.
    if (this.faction === 'DEEPSEEK') {
      this.mesh.rotation.z = this.action === 'FALL' || this.action === 'STUN' ? Math.PI / 2 : 0;
    }
  }

  private describeTransition(action: CharacterAction, requested: CharacterAction): string {
    if (action === 'FALL' && requested === 'STUN') return '摔倒占位姿态尚未结束';
    if (action === 'IDLE') return '本帧无移动或交互';
    if (action === 'WALK') return '本帧产生实际位移';
    if (action === 'RUN') return this.faction === 'DEEPSEEK'
      ? '冲刺中产生实际位移' : 'Human AI 追逐中产生实际位移';
    if (action === 'EAT') return '大米处于准备或进食状态';
    if (action === 'STARTLED') return '抓捕连续进度正在增长';
    if (action === 'FALL') return '风险冲刺结束，进入摔倒';
    if (action === 'STUN') return '摔倒姿态结束，仍在眩晕';
    if (action === 'INTERACT') return this.faction === 'DEEPSEEK'
      ? '靠门按住 E 或 Q' : '扫雷面板打开或靠门按住 E';
    return '有效抓捕圈内';
  }

  private playClip(): void {
    if (!this.mixer) return;
    const clip = this.clips[this.action];
    if (!clip) return; // White-box fallback until GLB clips exist.
    const next = this.mixer.clipAction(clip);
    if (next === this.activeClip) return;
    next.reset().play();
    if (this.activeClip) next.crossFadeFrom(this.activeClip,
      C.characterAnimation.transitionMs / 1000, false);
    this.activeClip = next;
  }

  private tryPlaySpecialIdle(): void {
    if (this.action !== 'IDLE' || this.specialIdleAction || !this.mixer ||
        !this.availableIdleSlots.length) return;
    const threshold = this.hasPlayedSpecialIdle
      ? C.characterAnimation.specialIdleRepeatIntervalMs
      : C.characterAnimation.specialIdleTriggerMs;
    if (this.idleElapsedMs < threshold) return;
    const choices = this.availableIdleSlots.length > 1 && this.previousSpecialIdleSlot
      ? this.availableIdleSlots.filter(slot => slot !== this.previousSpecialIdleSlot)
      : this.availableIdleSlots;
    const slot = choices[Math.min(choices.length - 1,
      Math.floor(this.random() * choices.length))];
    const clip = this.idleClips[slot];
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.play();
    if (this.activeClip) next.crossFadeFrom(this.activeClip,
      C.characterAnimation.transitionMs / 1000, false);
    this.activeClip = next;
    this.specialIdleAction = next;
    this.currentIdleSlot = slot;
    this.previousSpecialIdleSlot = slot;
    this.hasPlayedSpecialIdle = true;
    this.idleElapsedMs = 0;
    this.lastTransitionReason = `连续静止，播放特殊待机 ${slot}`;
  }

  private stopSpecialIdle(): void {
    this.specialIdleAction?.stop();
    this.specialIdleAction = null;
    this.currentIdleSlot = null;
  }
}

export type SpecialIdleSlot = 'IDLE_01' | 'IDLE_02' | 'IDLE_03' | 'IDLE_04' | 'IDLE_05';
