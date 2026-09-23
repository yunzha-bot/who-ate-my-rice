/** Presentation-only actions. Gameplay systems never read this value. */
export type CharacterAction =
  | 'IDLE' | 'WALK' | 'RUN' | 'EAT' | 'STARTLED'
  | 'FALL' | 'STUN' | 'INTERACT' | 'CAPTURE';

export interface CharacterActionInput {
  moving: boolean;
  running?: boolean;
  eating?: boolean;
  startled?: boolean;
  falling?: boolean;
  stunned?: boolean;
  interacting?: boolean;
  capturing?: boolean;
}

/** Selects a visual action from already-resolved gameplay state. */
export function resolveCharacterAction(input: CharacterActionInput): CharacterAction {
  if (input.falling) return 'FALL';
  if (input.stunned) return 'STUN';
  if (input.capturing) return 'CAPTURE';
  if (input.startled) return 'STARTLED';
  if (input.eating) return 'EAT';
  if (input.interacting) return 'INTERACT';
  if (input.running && input.moving) return 'RUN';
  return input.moving ? 'WALK' : 'IDLE';
}
