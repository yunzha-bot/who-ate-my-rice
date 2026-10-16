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
}): HTMLButtonElement {
  const button = (text: string, onClick: () => void): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = text;
    element.addEventListener('click', onClick);
    return element;
  };
  const settings = button('设置', handlers.settings);
  pause.append(button('继续游戏', handlers.resume), settings,
    button('重新开始', handlers.restart), button('返回主菜单', handlers.menu));
  if (handlers.developerMode) pause.append(button('开发调试：切换主控阵营', handlers.switchFaction));
  result.append(button('再来一局', handlers.restart), button('返回阵营选择', handlers.menu));
  return settings;
}

export const UI_PORTRAITS = {
  DEEPSEEK: '/assets/ui/portraits/deepseek-normal.png',
  DEEPSEEK_WIN: '/assets/ui/portraits/deepseek-win.png',
  DEEPSEEK_LOSE: '/assets/ui/portraits/deepseek-lose.png',
  HUMAN: '/assets/ui/portraits/human-guardian-v1.webp',
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
  <img class="report-portrait portrait-human" src="${UI_PORTRAITS.HUMAN}" alt="" width="768" height="1152" decoding="async">
  </div><span class="overlay-kicker">THE LITTLE RICE CHASE / REPORT</span>` +
  '<h1></h1><p></p><div class="overlay-stats"></div>';

/** Menu presentation only. Native buttons preserve keyboard activation. */
export function populateFactionMenu(menu: HTMLElement, choose: (faction: Faction) => void): void {
  menu.innerHTML = `
    <header class="menu-topbar"><section class="menu-story">
      <span class="menu-eyebrow">HOME / PEOPLE / RICE / CHASE</span>
      <h1>谁吃了<br><em>我的米？</em></h1>
      <p class="menu-english">THE LITTLE RICE CHASE</p>
      <p class="menu-intro">偷吃一口而已，至于追这么久吗？</p>
      <span class="menu-index" aria-hidden="true">HOME / CHASE / ESCAPE</span>
    </section></header>
    <div class="menu-content">
    <fieldset class="faction-dock">
      <legend><span>选择你的阵营</span><small>CHOOSE YOUR SIDE / 点击出发</small></legend>
      <button type="button" class="faction-card" data-faction="DEEPSEEK">
        <span class="faction-main"><span class="faction-identity"><span class="faction-number">01</span>
        <span class="faction-copy"><small>干饭人</small><strong>DeepSeek 娘</strong></span></span>
        <img class="faction-portrait" src="${UI_PORTRAITS.DEEPSEEK}" alt="" width="768" height="1152" decoding="async" draggable="false"></span>
        <span class="faction-caption"><span class="faction-description"><b>就吃亿口！</b>一点饭而已，应该不会被发现吧？<em>偷偷开饭 / SNEAK & EAT</em></span>
        <span class="faction-arrow" aria-hidden="true">↗</span></span>
      </button>
      <button type="button" class="faction-card" data-faction="HUMAN">
        <span class="faction-main"><span class="faction-identity"><span class="faction-number">02</span>
        <span class="faction-copy"><small>屋主人</small><strong>Human</strong></span></span>
        <img class="faction-portrait" src="${UI_PORTRAITS.HUMAN}" alt="" width="768" height="1152" decoding="async" draggable="false"></span>
        <span class="faction-caption"><span class="faction-description"><b>大米保卫战</b>我的米饭！家里怎么还进小贼了？<em>守住晚饭 / SEEK & CATCH</em></span>
        <span class="faction-arrow" aria-hidden="true">↗</span></span>
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
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16M4 12h16M4 19h16M8 2v6M16 9v6M10 16v6"/></svg>
          <span>游戏难度</span><small data-difficulty-label></small>
        </button>
        <div class="menu-difficulty-slot menu-setting-panel" id="menu-difficulty-panel" hidden></div>
      </section>
    </aside></div>`;
  menu.querySelectorAll<HTMLButtonElement>('.faction-card').forEach(card => {
    card.addEventListener('click', () => choose(card.dataset.faction as Faction));
  });
}
