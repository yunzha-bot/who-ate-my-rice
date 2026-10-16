type MenuPanel = 'audio' | 'difficulty';

/** Home-only presentation: existing audio controls and difficulty radios own their data. */
export class MenuSettingsView {
  private readonly menu: HTMLElement;
  private readonly root: HTMLElement;
  private readonly audioRoot: HTMLDetailsElement;
  private current: MenuPanel | null = null;

  constructor(menu: HTMLElement, audioRoot: HTMLDetailsElement) {
    this.menu = menu;
    this.root = menu.querySelector('.menu-settings')!;
    this.audioRoot = audioRoot;
    this.updateDifficultyLabel();
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('change', this.onChange);
    document.addEventListener('pointerdown', this.onOutside);
    document.addEventListener('keydown', this.onKeyDown);
  }

  private button(panel: MenuPanel): HTMLButtonElement {
    return this.root.querySelector(`[data-menu-panel="${panel}"]`)!;
  }

  private show(panel: MenuPanel): void {
    if (this.current === panel) { this.close(); return; }
    this.close();
    this.current = panel;
    this.root.querySelector<HTMLElement>(`.menu-${panel}-slot`)!.hidden = false;
    this.button(panel).setAttribute('aria-expanded', 'true');
    if (panel === 'audio') this.audioRoot.open = true;
  }

  close(restoreFocus = false): void {
    if (!this.current) return;
    const panel = this.current;
    this.current = null;
    this.root.querySelector<HTMLElement>(`.menu-${panel}-slot`)!.hidden = true;
    this.button(panel).setAttribute('aria-expanded', 'false');
    if (panel === 'audio') this.audioRoot.open = false;
    if (restoreFocus) this.button(panel).focus({ preventScroll: true });
  }

  private updateDifficultyLabel(): void {
    const selected = this.root.querySelector<HTMLInputElement>('.difficulty-select input:checked');
    const label = selected?.closest('label')?.querySelector('strong')?.textContent ?? '';
    this.button('difficulty').querySelector('[data-difficulty-label]')!.textContent = label;
    this.button('difficulty').setAttribute('aria-label', `游戏难度：${label}`);
  }

  private onClick = (event: MouseEvent): void => {
    const button = (event.target as Element)?.closest<HTMLButtonElement>('[data-menu-panel]');
    if (button && this.root.contains(button)) this.show(button.dataset.menuPanel as MenuPanel);
    // Selecting the already-checked radio has no change event, but still dismisses the panel.
    else if (this.current === 'difficulty' &&
        (event.target as Element)?.closest<HTMLInputElement>('input[name="difficulty"]')?.checked) {
      this.close(true);
    }
  };
  private onChange = (event: Event): void => {
    if ((event.target as Element)?.closest('.difficulty-select')) {
      this.updateDifficultyLabel();
      this.close(true);
    }
  };
  private onOutside = (event: PointerEvent): void => {
    if (this.current && !this.root.contains(event.target as Node)) this.close();
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.current && !this.menu.hidden && event.code === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.close(true);
    }
  };

  dispose(): void {
    this.close();
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('change', this.onChange);
    document.removeEventListener('pointerdown', this.onOutside);
    document.removeEventListener('keydown', this.onKeyDown);
  }
}
