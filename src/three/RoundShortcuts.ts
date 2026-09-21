import type { GamePhase } from '../systems/GameStateSystem.ts';

export type RoundShortcut = 'RESTART' | 'FACTION_SELECT' | null;

export function resolveRoundShortcut(phase: GamePhase,
  enabled: boolean, restartPressed: boolean, menuPressed: boolean): RoundShortcut {
  if (!enabled) return null;
  if (phase === 'FACTION_SELECT') return null;
  if (restartPressed) return 'RESTART';
  if (menuPressed) return 'FACTION_SELECT';
  return null;
}

export function resolveDirectControlSwitch(phase: GamePhase,
  enabled: boolean, pressed: boolean): boolean {
  return enabled && phase === 'PLAYING' && pressed;
}
