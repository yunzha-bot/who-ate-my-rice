import type { Faction } from './LocalControl.ts';

/** Shared display formatting; no clock or match state is owned here. */
export function formatMatchTime(elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Native action buttons only; their handlers and state still belong to ThreeGame. */
export function populateRoundActions(pause: HTMLElement, result: HTMLElement, handlers: {
  resume: () => void; settings: () => void; restart: () => void;
  menu: () => void; switchFaction: () => void; developerMode: boolean;
  /** Optional: pause-menu entry for the standalone controls help layer. */
  help?: () => void;
}): HTMLButtonElement {
  const button = (text: string, onClick: () => void): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = text;
    element.addEventListener('click', onClick);
    return element;
  };
  const settings = button('设置', handlers.settings);
  pause.append(button('继续游戏', handlers.resume));
  pause.append(settings);
  // 操作说明是从暂停菜单重看教学的入口；没有接线时不生成按钮，保持旧组合不变。
  if (handlers.help) pause.append(button('操作说明', handlers.help));
  pause.append(button('重新开始', handlers.restart), button('返回主菜单', handlers.menu));
  if (handlers.developerMode) pause.append(button('开发调试：切换主控阵营', handlers.switchFaction));
  result.append(button('再来一局', handlers.restart), button('返回阵营选择', handlers.menu));
  return settings;
}

const assetBase = typeof import.meta.env === 'undefined' ? '/' : import.meta.env.BASE_URL;
export const UI_PORTRAITS = {
  DEEPSEEK: `${assetBase}assets/ui/portraits/deepseek-normal.png`,
  DEEPSEEK_WIN: `${assetBase}assets/ui/portraits/deepseek-win.png`,
  DEEPSEEK_LOSE: `${assetBase}assets/ui/portraits/deepseek-lose.png`,
  HUMAN: `${assetBase}assets/ui/portraits/human-report-hoodie-v1.png`,
  HUMAN_MENU: `${assetBase}assets/ui/portraits/human-hoodie-v1.png`,
} as const;

/** Character emotion follows the winner, independently of the player's WIN/LOSE heading. */
export function deepseekResultPortrait(winner: Faction): string {
  return winner === 'DEEPSEEK' ? UI_PORTRAITS.DEEPSEEK_WIN : UI_PORTRAITS.DEEPSEEK_LOSE;
}

export function updateResultPortrait(overlay: HTMLElement, winner: Faction): void {
  const portrait = overlay.querySelector<HTMLImageElement>('.portrait-deepseek');
  const source = deepseekResultPortrait(winner);
  if (portrait && portrait.getAttribute('src') !== source) portrait.setAttribute('src', source);
}

// Artwork is decorative; all report values and controls remain live HTML.
export const REPORT_MARKUP = `<div class="report-art" aria-hidden="true">
  <img class="report-portrait portrait-deepseek" src="${UI_PORTRAITS.DEEPSEEK}" alt="" width="768" height="1152" decoding="async">
  <img class="report-portrait portrait-human" src="${UI_PORTRAITS.HUMAN}" alt="" width="1312" height="1199" decoding="async">
  </div><span class="overlay-kicker">THE LITTLE RICE CHASE / REPORT</span>` +
  '<h1></h1><p></p><div class="overlay-stats"></div>';

/** Menu presentation only. Native buttons preserve keyboard activation. */
export function populateFactionMenu(menu: HTMLElement, choose: (faction: Faction) => void): () => void {
  menu.innerHTML = `
    <img class="menu-foliage" src="${assetBase}assets/ui/menu/foliage.webp" alt="" aria-hidden="true" width="1600" height="900" draggable="false">
    <header class="menu-topbar"><section class="menu-story">
      <h1><img class="menu-logo" src="${assetBase}assets/ui/menu/logo.webp" alt="谁吃了我的米？" width="1500" height="605" draggable="false"></h1>
      <p class="menu-english menu-accessible">THE LITTLE RICE CHASE</p>
      <p class="menu-intro menu-accessible">偷吃一口而已，至于追这么久吗？</p>
    </section></header>
    <div class="menu-content">
    <fieldset class="faction-dock">
      <legend class="menu-accessible">选择你的阵营</legend>
      <button type="button" class="faction-card" data-faction="DEEPSEEK" aria-pressed="false" aria-label="选择 DeepSeek 娘，干饭人">
        <span class="faction-main"><span class="faction-identity"><span class="faction-number">01</span>
        <span class="faction-copy"><small>干饭人</small><strong>DeepSeek 娘</strong></span></span>
        <img class="faction-portrait" src="${UI_PORTRAITS.DEEPSEEK}" alt="" width="1024" height="1536" decoding="async" draggable="false"></span>
        <img class="faction-sticker faction-rice-cat" src="${assetBase}assets/ui/menu/rice-cat.webp" alt="" width="400" height="337" draggable="false">
        <img class="faction-sticker faction-rice-tub" src="${assetBase}assets/ui/menu/rice-tub.webp" alt="" width="400" height="289" draggable="false">
        <span class="faction-caption"><span class="faction-description"><b>就吃亿口！</b>一点饭而已，应该不会被发现吧？<em>偷偷开饭 / SNEAK & EAT</em></span>
        </span><span class="faction-selected" aria-hidden="true">已选择</span>
      </button>
      <button type="button" class="faction-card" data-faction="HUMAN" aria-pressed="false" aria-label="选择 Human，人类方">
        <span class="faction-main"><span class="faction-identity"><span class="faction-number">02</span>
        <span class="faction-copy"><small>人类方</small><strong>Human</strong></span></span>
        <img class="faction-portrait" src="${UI_PORTRAITS.HUMAN_MENU}" alt="" width="1024" height="1536" decoding="async" draggable="false"></span>
        <span class="faction-caption"><span class="faction-description"><b>我的大米！</b>我的米饭！家里怎么还进小贼了？<em>守住晚饭 / SEEK & CATCH</em></span>
        </span><span class="faction-selected" aria-hidden="true">已选择</span>
      </button>
    </fieldset>
    <aside class="menu-settings" aria-label="首页设置">
      <section class="menu-setting-section">
        <button type="button" class="menu-setting-button" data-menu-panel="audio" aria-expanded="false" aria-controls="menu-audio-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M11 4 5 9H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 4a11 11 0 0 1 0 16"/></svg>
          <span>声音设置</span>
        </button>
        <div class="menu-audio-slot menu-setting-panel" id="menu-audio-panel" aria-label="声音设置" hidden><h2>声音设置</h2></div>
      </section>
      <section class="menu-setting-section">
        <button type="button" class="menu-setting-button" data-menu-panel="difficulty" aria-expanded="false" aria-controls="menu-difficulty-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 5h10c2 0 3 2 4 6l1 5c.5 3-2 4-4 2l-3-3H9l-3 3c-2 2-4.5 1-4-2l1-5c1-4 2-6 4-6Z M7 8v5M4.5 10.5h5M16 9h.01M19 12h.01"/></svg>
          <span>游戏难度</span><small data-difficulty-label></small><span class="menu-chevron" aria-hidden="true">▾</span>
        </button>
        <div class="menu-difficulty-slot menu-setting-panel" id="menu-difficulty-panel" hidden></div>
      </section>
    </aside></div>`;
  const cards = menu.querySelectorAll<HTMLButtonElement>('.faction-card');
  // Keep native button/slider keys away from the window-level gameplay input.
  // Do not preventDefault: Space must still activate a focused native button.
  menu.addEventListener('keydown', event => {
    if (!menu.hidden && (event.code === 'Space' || event.code.startsWith('Arrow'))) event.stopPropagation();
  });
  const reset = () => {
    cards.forEach(card => card.setAttribute('aria-pressed', 'false'));
  };
  cards.forEach(card => {
    card.addEventListener('click', () => {
      if (menu.hidden) return;
      const faction = card.dataset.faction as Faction;
      cards.forEach(item => item.setAttribute('aria-pressed', String(item === card)));
      choose(faction);
    });
  });
  return reset;
}
