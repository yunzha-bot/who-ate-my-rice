/** Keyboard preferences only. Values are physical KeyboardEvent.code positions. */
export const DEFAULT_KEY_BINDINGS = {
  KeyW: 'KeyW', KeyS: 'KeyS', KeyA: 'KeyA', KeyD: 'KeyD',
  KeyE: 'KeyE', Space: 'Space', KeyQ: 'KeyQ', KeyV: 'KeyV', KeyF: 'KeyF', KeyL: 'KeyL',
} as const;
export type BindingAction = keyof typeof DEFAULT_KEY_BINDINGS;
export type KeyBindingMap = Record<BindingAction, string>;
export const KEY_BINDING_LABELS: Record<BindingAction, string> = {
  KeyW: '向前移动', KeyS: '向后移动', KeyA: '向左移动', KeyD: '向右移动',
  KeyE: '交互 / 进食 / 家具搜查', Space: '冲刺 / 强行破门', KeyQ: '锁门 / 布置捕捉网',
  KeyV: 'Human 扇形抓捕', KeyF: '拾取道具', KeyL: '开灯 / 关灯',
};
export const KEY_BINDINGS_STORAGE_KEY = 'who-ate-my-rice/key-bindings-v1';
const arrows: Record<string, BindingAction> = {
  ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD',
};
const special: Record<string, string> = {
  Space: 'Space', Enter: 'Enter', ShiftLeft: '左 Shift', ShiftRight: '右 Shift',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
  Backslash: '反斜杠', Semicolon: ';', Quote: '引号', Comma: ',', Period: '.', Slash: '/',
};
export function bindingKeyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return `小键盘 ${code.slice(6)}`;
  return special[code] ?? code;
}
export function allowedBindingCode(code: string): boolean {
  return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code) || Object.hasOwn(special, code);
}
export function formatBindingText(text: string, bindings: Readonly<KeyBindingMap> = DEFAULT_KEY_BINDINGS): string {
  return text.replace(/\b(WASD|Space|[WASDEQVFL])\b/g, token => {
    if (token === 'WASD') return ['KeyW','KeyA','KeyS','KeyD'].map(code => bindingKeyLabel(bindings[code as BindingAction])).join('');
    const action = (token === 'Space' ? 'Space' : `Key${token}`) as BindingAction;
    return bindingKeyLabel(bindings[action]);
  });
}

export class KeyBindings {
  private map: KeyBindingMap = { ...DEFAULT_KEY_BINDINGS };
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  constructor(storage?: Pick<Storage, 'getItem' | 'setItem'> | null) {
    try { this.storage = storage === undefined ? globalThis.localStorage ?? null : storage; }
    catch { this.storage = null; }
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY_BINDINGS_STORAGE_KEY) ?? 'null');
      if (saved?.version === 1 && saved.bindings && typeof saved.bindings === 'object') {
        const candidate = Object.fromEntries(Object.keys(DEFAULT_KEY_BINDINGS).map(k => [k, saved.bindings[k]])) as KeyBindingMap;
        if (Object.values(candidate).every(code => typeof code === 'string' && allowedBindingCode(code)) &&
            new Set(Object.values(candidate)).size === Object.keys(DEFAULT_KEY_BINDINGS).length) this.map = candidate;
      }
    } catch { /* Corrupt or unavailable preferences never block the game. */ }
  }
  get values(): Readonly<KeyBindingMap> { return this.map; }
  label(action: BindingAction): string { return bindingKeyLabel(this.map[action]); }
  text(text: string): string { return formatBindingText(text, this.map); }
  /** Translate keyboard only; touch commands already use the canonical action codes. */
  actionFor(code: string): string | null {
    if (Object.hasOwn(arrows, code)) return arrows[code];
    const action = (Object.keys(this.map) as BindingAction[]).find(action => this.map[action] === code);
    return action ?? (Object.hasOwn(DEFAULT_KEY_BINDINGS, code) ? null : code);
  }
  assign(action: BindingAction, code: string): string | null {
    if (!Object.hasOwn(DEFAULT_KEY_BINDINGS, action) || !allowedBindingCode(code))
      return '请选择字母、数字、空格、Enter、Shift 或常用符号；Esc、方向键和系统按键保留。';
    const conflict = (Object.keys(this.map) as BindingAction[]).find(key => key !== action && this.map[key] === code);
    if (conflict) return `这个按键已用于“${KEY_BINDING_LABELS[conflict]}”，请换一个。`;
    this.map = { ...this.map, [action]: code };
    return null;
  }
  reset(): void { this.map = { ...DEFAULT_KEY_BINDINGS }; }
  save(): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify({ version: 1, bindings: this.map }));
      return true;
    } catch { return false; }
  }
}
