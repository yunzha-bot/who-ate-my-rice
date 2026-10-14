import { DIFFICULTIES, DIFFICULTY_COPY, isDifficulty, readDifficulty, saveDifficulty,
  type Difficulty } from '../config/difficultyConfig.ts';

/** Menu-only native radio group: keyboard selection cannot change an active round. */
export class DifficultyView {
  readonly root = document.createElement('fieldset');
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  value: Difficulty;

  constructor(menu: HTMLElement) {
    let storage: Storage | null = null;
    try { storage = window.localStorage; } catch { /* blocked storage */ }
    this.storage = storage;
    this.value = readDifficulty(storage);
    this.root.className = 'difficulty-select';
    this.root.innerHTML = '<legend>选择难度 <small>只影响对手 AI</small></legend>' +
      DIFFICULTIES.map(id => `<label class="difficulty-card"><input type="radio" name="difficulty" value="${id}"${id === this.value ? ' checked' : ''}>` +
        `<span><strong>${DIFFICULTY_COPY[id].label}</strong><small>${DIFFICULTY_COPY[id].description}</small></span></label>`).join('');
    this.root.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (isDifficulty(input.value) && input.checked) {
        this.value = input.value;
        saveDifficulty(this.storage, this.value);
      }
    });
    this.root.addEventListener('keydown', event => {
      if (event.code.startsWith('Arrow') || event.code === 'Space') event.stopPropagation();
    });
    menu.append(this.root);
  }
}
