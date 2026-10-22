// Small native-button stand-in for the presentation-only menu tests; no DOM library needed.
export function factionMenuFixture() {
  const button = faction => ({
    dataset: { faction }, listeners: {}, attributes: {}, disabled: false,
    addEventListener(name, callback) { this.listeners[name] = callback; },
    setAttribute(name, value) { this.attributes[name] = value; },
  });
  const cards = ['DEEPSEEK', 'HUMAN'].map(button);
  const start = button(); start.disabled = true;
  const help = { textContent: '' };
  return { innerHTML: '', hidden: false, cards, start, help, listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    querySelectorAll: () => cards,
    querySelector: selector => selector === '.menu-start' ? start : help,
  };
}
