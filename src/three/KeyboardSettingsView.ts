import { KeyBindings, KEY_BINDING_LABELS, type BindingAction } from './KeyBindings.ts';

/** Pause-only key capture. Gameplay remains paused and input is cleared on every edit. */
export class KeyboardSettingsView {
  readonly root = document.createElement('section');
  private readonly status = document.createElement('p');
  private readonly buttons = new Map<BindingAction, HTMLButtonElement>();
  private waiting: BindingAction | null = null;
  private readonly bindings: KeyBindings;
  private readonly clearInput: () => void;
  constructor(parent: HTMLElement, bindings: KeyBindings,
    clearInput: () => void, onBack: () => void) {
    this.bindings = bindings; this.clearInput = clearInput;
    this.root.className = 'keyboard-settings'; this.root.hidden = true;
    this.root.setAttribute('aria-label', '按键设置');
    const help = document.createElement('p');
    help.textContent = '点击右侧按键，再按新键。Esc 取消修改；方向键始终可移动，Esc 始终暂停。';
    this.root.append(help);
    const list = document.createElement('div'); list.className = 'keyboard-settings-list';
    for (const action of Object.keys(KEY_BINDING_LABELS) as BindingAction[]) {
      const row = document.createElement('div'); row.className = 'keyboard-settings-row';
      const label = document.createElement('span'); label.textContent = KEY_BINDING_LABELS[action];
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.bindingAction = action;
      button.setAttribute('aria-label', `修改${KEY_BINDING_LABELS[action]}按键`);
      button.addEventListener('click', () => {
        this.clearInput(); this.waiting = action; this.refresh();
        this.status.textContent = `请按新键：${KEY_BINDING_LABELS[action]}（Esc 取消）`;
      });
      this.buttons.set(action, button); row.append(label, button); list.append(row);
    }
    this.status.className = 'keyboard-settings-status'; this.status.setAttribute('role', 'status');
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '恢复默认按键';
    reset.addEventListener('click', () => {
      this.waiting = null; this.clearInput(); this.bindings.reset(); this.refresh(); this.saved();
    });
    const back = document.createElement('button'); back.type = 'button'; back.textContent = '返回暂停菜单';
    back.addEventListener('click', onBack);
    const actions = document.createElement('div'); actions.className = 'keyboard-settings-actions'; actions.append(reset, back);
    this.root.append(list, this.status, actions); parent.append(this.root);
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('blur', this.cancelCapture);
    this.refresh();
  }
  private saved(): void {
    this.status.textContent = this.bindings.save() ? '按键已保存，下次打开仍会保留。'
      : '按键已生效；浏览器无法保存，下次打开需重新设置。';
  }
  private refresh(): void {
    for (const [action, button] of this.buttons) {
      button.textContent = this.waiting === action ? '请按新键…' : this.bindings.label(action);
      button.setAttribute('aria-pressed', String(this.waiting === action));
    }
  }
  private cancelCapture = (): void => {
    if (!this.waiting) return;
    this.waiting = null; this.clearInput(); this.refresh(); this.status.textContent = '已取消修改。';
  };
  private onKeyDown = (event: KeyboardEvent): void => {
    if (this.root.hidden || !this.waiting) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat || event.isComposing) return;
    if (event.code === 'Escape') { this.cancelCapture(); return; }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      this.status.textContent = '请按单个按键，不使用 Ctrl、Alt 或系统组合键。'; return;
    }
    const error = this.bindings.assign(this.waiting, event.code);
    if (error) { this.status.textContent = error; return; }
    this.waiting = null; this.clearInput(); this.refresh(); this.saved();
  };
  setVisible(visible: boolean): void {
    if (!visible) this.cancelCapture();
    if (this.root.hidden === !visible) return;
    this.root.hidden = !visible;
    if (visible) { this.status.textContent = ''; this.refresh(); }
  }
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('blur', this.cancelCapture); this.root.remove();
  }
}
