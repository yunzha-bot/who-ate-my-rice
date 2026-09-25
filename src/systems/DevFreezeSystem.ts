import type { GamePhase } from './GameStateSystem.ts';

export type DevFreezeReason = 'MANUAL_DEV_FREEZE' | 'SCENE_EDITOR';
export type DevRunState = 'RUNNING' | 'FROZEN';
export type DevFreezeEventType = 'DEV_FREEZE_ON' | 'DEV_FREEZE_OFF'
  | 'SCENE_EDITOR_OPEN' | 'SCENE_EDITOR_CLOSE';

export interface DevFreezeEvent {
  type: DevFreezeEventType;
  reason: DevFreezeReason | null;
  detail: string;
}

export interface DevFreezeCounts {
  on: number;
  off: number;
  editorOpen: number;
  editorClose: number;
}

export const DEV_FREEZE_REASON_ORDER: readonly DevFreezeReason[] = [
  'MANUAL_DEV_FREEZE', 'SCENE_EDITOR'];

const EVENT_HISTORY_LIMIT = 40;

// DEV-only freeze gate. The freeze is a debugging instrument, never a gameplay
// rule: it only stops advancing the round. Every reason is tracked separately so
// the scene editor and the manual button can never overwrite each other's state,
// and the round only continues once every reason has been released.
export class DevFreezeSystem {
  private readonly reasons = new Set<DevFreezeReason>();
  private readonly history: DevFreezeEvent[] = [];
  private counts: DevFreezeCounts = { on: 0, off: 0, editorOpen: 0, editorClose: 0 };
  private fromPhase: GamePhase | null = null;
  private fromSummary = '';
  private frozen = false;
  lastRejection = '无';

  get state(): DevRunState { return this.frozen ? 'FROZEN' : 'RUNNING'; }

  get isFrozen(): boolean { return this.frozen; }

  get reasonsList(): DevFreezeReason[] {
    return DEV_FREEZE_REASON_ORDER.filter(reason => this.reasons.has(reason));
  }

  get reasonLabel(): string {
    return this.reasonsList.join(' + ') || '无';
  }

  get manualLabel(): string { return this.frozen ? '恢复双阵营' : '冻结双阵营'; }

  get frozenFromPhase(): GamePhase | null { return this.fromPhase; }

  get frozenFromSummary(): string { return this.fromSummary; }

  get events(): readonly DevFreezeEvent[] { return this.history; }

  get eventCounts(): DevFreezeCounts { return { ...this.counts }; }

  isFrozenBy(reason: DevFreezeReason): boolean { return this.reasons.has(reason); }

  // The single timing seam used by the frame loop: zero while frozen, so every
  // dt-driven system (rice, capture, sprint, doors, AI, perception) freezes with
  // no separate pause implementation and no wall-clock catch-up on resume.
  gameplayDelta(phase: GamePhase, deltaMs: number): number {
    if (this.frozen || phase !== 'PLAYING') return 0;
    return Math.max(0, deltaMs);
  }

  // The pre-round countdown is a phase timer, not gameplay simulation, so it is
  // deliberately NOT gated by the freeze. Feeding it `gameplayDelta` would make
  // `advanceReady` receive 0 every frame while the phase is still READY, so the
  // match could never reach PLAYING: both factions would stand still and the
  // scene editor would refuse to open with NOT_PLAYING forever. Kept as its own
  // seam so the frame loop cannot mix the two deltas up again.
  readyDelta(deltaMs: number): number {
    return Math.max(0, deltaMs);
  }

  manualFreeze(phase: GamePhase, summary = ''): boolean {
    if (phase !== 'PLAYING')
      return this.reject(`NOT_PLAYING：手动冻结仅在 PLAYING 可用（当前 ${phase}）`);
    if (this.reasons.has('MANUAL_DEV_FREEZE'))
      return this.reject('ALREADY_FROZEN：手动冻结已经生效');
    if (!this.frozen) { this.fromPhase = phase; this.fromSummary = summary; }
    this.reasons.add('MANUAL_DEV_FREEZE');
    this.afterReasonChange('MANUAL_DEV_FREEZE', '手动冻结双阵营');
    return true;
  }

  manualResume(phase: GamePhase): boolean {
    if (phase !== 'PLAYING')
      return this.reject(`NOT_PLAYING：恢复双阵营仅在 PLAYING 可用（当前 ${phase}）`);
    if (this.reasons.has('SCENE_EDITOR'))
      return this.reject('SCENE_EDITOR_ACTIVE：场景编辑器开着，先关闭场景编辑再恢复双阵营');
    if (!this.reasons.has('MANUAL_DEV_FREEZE'))
      return this.reject('NOT_FROZEN：当前没有手动冻结');
    this.reasons.delete('MANUAL_DEV_FREEZE');
    this.afterReasonChange(null, '手动恢复双阵营');
    return true;
  }

  openSceneEditor(phase: GamePhase): boolean {
    if (phase !== 'PLAYING')
      return this.reject(`NOT_PLAYING：场景编辑仅在 PLAYING 可用（当前 ${phase}）`);
    if (this.reasons.has('SCENE_EDITOR'))
      return this.reject('ALREADY_OPEN：场景编辑器已经打开');
    if (!this.frozen) { this.fromPhase = phase; this.fromSummary = ''; }
    this.reasons.add('SCENE_EDITOR');
    const wasFrozen = this.frozen;
    this.refreshState();
    this.counts = { ...this.counts, editorOpen: this.counts.editorOpen + 1 };
    this.emit('SCENE_EDITOR_OPEN', 'SCENE_EDITOR', '打开场景编辑：自动冻结双阵营');
    if (!wasFrozen) this.counts = { ...this.counts, on: this.counts.on + 1 };
    if (!wasFrozen) this.emit('DEV_FREEZE_ON', 'SCENE_EDITOR', '进入冻结（场景编辑）');
    return true;
  }

  closeSceneEditor(): boolean {
    if (!this.reasons.has('SCENE_EDITOR'))
      return this.reject('EDITOR_NOT_OPEN：场景编辑器没有打开');
    this.reasons.delete('SCENE_EDITOR');
    const wasFrozen = this.frozen;
    this.refreshState();
    this.counts = { ...this.counts, editorClose: this.counts.editorClose + 1 };
    this.emit('SCENE_EDITOR_CLOSE', 'SCENE_EDITOR',
      '关闭场景编辑；手动冻结仍生效，保持冻结');
    if (wasFrozen && !this.frozen) this.emit('DEV_FREEZE_OFF', null, '所有冻结原因解除，恢复双阵营');
    return true;
  }

  // A new round starts clean: no freeze reason may survive a restart.
  reset(): void {
    this.reasons.clear();
    this.refreshState();
    this.fromPhase = null;
    this.fromSummary = '';
    this.lastRejection = '无';
    this.history.length = 0;
    this.counts = { on: 0, off: 0, editorOpen: 0, editorClose: 0 };
  }

  private afterReasonChange(reason: DevFreezeReason | null, detail: string): void {
    const wasFrozen = this.frozen;
    this.refreshState();
    if (!wasFrozen && this.frozen) {
      this.counts = { ...this.counts, on: this.counts.on + 1 };
      this.emit('DEV_FREEZE_ON', reason, detail);
    } else if (wasFrozen && !this.frozen) {
      this.counts = { ...this.counts, off: this.counts.off + 1 };
      this.emit('DEV_FREEZE_OFF', reason, detail);
    }
  }

  private refreshState(): void {
    this.frozen = this.reasons.size > 0;
    if (!this.frozen) { this.fromPhase = null; this.fromSummary = ''; }
  }

  private reject(message: string): boolean {
    this.lastRejection = message;
    return false;
  }

  private emit(type: DevFreezeEventType, reason: DevFreezeReason | null, detail: string): void {
    this.history.push({ type, reason, detail });
    if (this.history.length > EVENT_HISTORY_LIMIT)
      this.history.splice(0, this.history.length - EVENT_HISTORY_LIMIT);
  }
}
