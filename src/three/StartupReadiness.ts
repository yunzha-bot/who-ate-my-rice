/** Startup-only authority shared by the loading screen and faction entry. */
export type ModelLoadPhase = 'downloading' | 'parsing' | 'initializing' | 'ready' | 'failed' | 'simplified';

export class StartupReadiness {
  model: ModelLoadPhase = 'downloading';
  assets: 'pending' | 'ready' | 'failed' | 'simplified' = 'pending';
  private admitted = false;
  private readonly listeners = new Set<() => void>();

  get canStart(): boolean {
    return this.admitted || ((this.model === 'ready' || this.model === 'simplified') &&
      (this.assets === 'ready' || this.assets === 'simplified'));
  }

  setModel(phase: ModelLoadPhase): void { this.model = phase; this.notify(); }
  setAssets(state: StartupReadiness['assets']): void { this.assets = state; this.notify(); }
  admit(): boolean { if (!this.canStart) return false; this.admitted = true; return true; }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(): void { for (const listener of this.listeners) listener(); }
}
