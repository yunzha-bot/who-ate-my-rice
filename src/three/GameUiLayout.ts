import type { Faction } from './LocalControl.ts';

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
    <header class="menu-story">
      <span class="menu-eyebrow">HOME / PEOPLE / RICE / CHASE</span>
      <h1>谁吃了<br><em>我的米？</em></h1>
      <p class="menu-english">THE LITTLE RICE CHASE</p>
      <p class="menu-intro">偷吃一口而已，至于追这么久吗？</p>
      <span class="menu-index" aria-hidden="true">HOME / CHASE / ESCAPE</span>
    </header>
    <fieldset class="faction-dock">
      <legend><span>选择你的阵营</span><small>CHOOSE YOUR SIDE / 点击出发</small></legend>
      <button type="button" class="faction-card" data-faction="DEEPSEEK">
        <img class="faction-portrait" src="${UI_PORTRAITS.DEEPSEEK}" alt="" width="768" height="1152" decoding="async" draggable="false">
        <span class="faction-number">01</span>
        <span class="faction-copy"><small>干饭人</small><strong>DeepSeek 娘</strong><span><b>就吃亿口！</b>一点饭而已，应该不会被发现吧？<em>偷偷开饭 / SNEAK & EAT</em></span></span>
        <span class="faction-arrow" aria-hidden="true">↗</span>
      </button>
      <button type="button" class="faction-card" data-faction="HUMAN">
        <img class="faction-portrait" src="${UI_PORTRAITS.HUMAN}" alt="" width="768" height="1152" decoding="async" draggable="false">
        <span class="faction-number">02</span>
        <span class="faction-copy"><small>屋主人</small><strong>Human</strong><span><b>大米保卫战</b>我的米饭！家里怎么还进小贼了？<em>守住晚饭 / SEEK & CATCH</em></span></span>
        <span class="faction-arrow" aria-hidden="true">↗</span>
      </button>
    </fieldset>
    <p class="menu-controls"><span>CONTROL /</span> WASD 移动　 E 交互　 Q 技能　 Esc 暂停</p>`;
  menu.querySelectorAll<HTMLButtonElement>('.faction-card').forEach(card => {
    card.addEventListener('click', () => choose(card.dataset.faction as Faction));
  });
}
