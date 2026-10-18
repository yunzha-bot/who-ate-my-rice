/**
 * 独立操作说明层（最小教学）。
 *
 * 纪律（本轮用户批准范围）：
 *  - 只解释真实按键与玩家规则，不展示内部倍率、世界单位或 AI 隐藏信息。
 *  - 不出现 AI 决策词汇或隐藏信息（不含 DETOUR / sprintDecision / 藏身占用等）。
 *  - 纯 DOM 表现层：计时门禁由 ThreeGame 持有，本层不修改玩法状态。
 *  - 可关闭；关闭后从暂停菜单的「操作说明」重看。
 *
 * 为了在没有 DOM 库的测试环境里也能核对文案，这里把行数据与 markup 生成导出为纯函数。
 */
export type ControlsHelpFaction = 'HUMAN' | 'DEEPSEEK';

export interface ControlsHelpRow {
  keys: string[];
  text: string;
}

export const CONTROLS_HELP_ROWS: Record<ControlsHelpFaction, readonly ControlsHelpRow[]> = {
  HUMAN: [
    { keys: ['W', 'A', 'S', 'D'], text: '移动（方向键同样可用）' },
    { keys: ['Space'], text: '强行破门：普通门直接打开；对锁着的门强行破锁（有冷却）' },
    { keys: ['E'], text: '优先开关门或拧锁芯解锁；没有门时搜查面前合法家具，没有家具不释放。家具搜查与 V 共用冷却' },
    { keys: ['V'], text: '扇形抓捕：只抓前方未藏身角色，不搜查家具；空挥也消耗冷却，与 E 家具搜查共用冷却' },
    { keys: ['Q'], text: '布设捕捉网：鼠标选近处空地，左键确认；布置时不能移动，右键或 Esc 取消。圆标显示剩余名额，网不会自动消失；困住她后靠近才能抓捕' },
    { keys: ['F'], text: '拾取地上的道具' },
    { keys: ['按住左键'], text: '瞄准；松开就把道具扔出去' },
    { keys: ['右键'], text: '取消瞄准' },
    { keys: ['贴住她'], text: '碰到 DeepSeek 娘并黏住一小会儿就能抓住' },
    { keys: ['Esc'], text: '暂停 / 关闭菜单' },
  ],
  DEEPSEEK: [
    { keys: ['W', 'A', 'S', 'D'], text: '移动（方向键同样可用）' },
    { keys: ['E'], text: '停下按住吃米；靠近家具藏身；开关门' },
    { keys: ['Space'], text: '冲刺（有冷却；结束时若已吃掉三成米会摔倒）' },
    { keys: ['Q'], text: '给关着的门上锁（有冷却）' },
    { keys: ['F'], text: '拾取地上的道具' },
    { keys: ['按住左键'], text: '瞄准；松开就把道具扔出去' },
    { keys: ['右键'], text: '取消瞄准' },
    { keys: ['Esc'], text: '暂停 / 关闭菜单' },
  ],
};

export const CONTROLS_HELP_TITLES: Record<ControlsHelpFaction, string> = {
  HUMAN: 'Human · 屋主人',
  DEEPSEEK: 'DeepSeek 娘 · 干饭人',
};

function rowsMarkup(items: readonly ControlsHelpRow[]): string {
  return items.map(item => `<div class="controls-help-row"><dt>${
    item.keys.map(key => key.length === 1
      ? `<kbd>${key}</kbd>` : `<kbd class="wide">${key}</kbd>`).join('')}</dt><dd>${
    item.text}</dd></div>`).join('');
}

/** 说明层的完整 markup。纯函数：不读玩法状态，也不依赖 DOM。 */
export function controlsHelpMarkup(): string {
  const side = (faction: ControlsHelpFaction): string =>
    `<section class="controls-help-side" data-side="${faction}">` +
    `<h3>${CONTROLS_HELP_TITLES[faction]}</h3><dl>${rowsMarkup(CONTROLS_HELP_ROWS[faction])}</dl>` +
    `<p class="controls-help-touch">左侧摇杆移动。${faction === 'HUMAN' ? '交互按钮开关门、解锁或搜查家具；抓捕按钮抓前方目标，破门按钮强行开门。点布网后触摸空地拖动预览，绿色可放，松手布网。' : '交互按钮开关门、藏身；在米旁停下并按住交互吃米。冲刺按钮加速逃跑，锁门按钮给关着的门上锁。'}拾取后按住“瞄准投掷”拖向目标，松手投出；点取消可以退出瞄准或布网。右上角可暂停，靠近夜间开关会出现开灯或关灯按钮。</p></section>`;
  return `<div class="controls-help-panel" role="dialog" aria-modal="true"
        aria-labelledby="controls-help-title">
      <header class="controls-help-head">
        <div><span class="overlay-kicker">CONTROLS / 操作说明</span><h2 id="controls-help-title">怎么操作</h2></div>
        <button type="button" class="controls-help-close">知道了</button>
      </header>
      <div class="controls-help-grid">${side('HUMAN')}${side('DEEPSEEK')}</div>
      <p class="controls-help-foot">投掷命中会使对方眩晕 3 秒。不锈钢盆最多投掷三次，耐久耗尽后损坏；尚有耐久时落地后可再次拾取，其他道具投出后不可再次拾取。</p>
      <p class="controls-help-foot">捕捉网对 DeepSeek 娘不可见，冲刺也会中网；投掷物命中可以拆网。中网后暂时无法移动，身上会显示网的效果；Human 仍需靠近才能抓捕。</p>
      <p class="controls-help-foot">阅读期间对局不会推进。按 Esc 暂停后，可以从「操作说明」再打开这一页。</p>
      <p class="controls-help-foot">困难夜间：靠近墙壁开关按 L 开灯或关灯。亮灯区域的对手不受距离限制，但墙门和真正藏身仍会遮挡；开关有短暂冷却，双方都能使用。</p>
    </div>`;
}

export class ControlsHelpView {
  readonly root = document.createElement('section');
  private readonly closeButton: HTMLButtonElement;
  private readonly humanSection: HTMLElement;
  private readonly deepseekSection: HTMLElement;

  constructor(parent: HTMLElement, onClose: () => void) {
    this.root.className = 'controls-help';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', '操作说明');
    this.root.innerHTML = controlsHelpMarkup();
    this.closeButton = this.root.querySelector<HTMLButtonElement>('.controls-help-close')!;
    this.humanSection = this.root.querySelector<HTMLElement>('[data-side="HUMAN"]')!;
    this.deepseekSection = this.root.querySelector<HTMLElement>('[data-side="DEEPSEEK"]')!;
    // 点空白处也能关掉，避免它看起来像卡住。
    this.root.addEventListener('click', event => {
      if (event.target === this.root) onClose();
    });
    this.closeButton.addEventListener('click', onClose);
    parent.append(this.root);
  }

  get visible(): boolean { return !this.root.hidden; }

  /** `faction` 只把当前阵营排到左侧并加标记；内容、玩法状态都不变。 */
  show(faction: ControlsHelpFaction | null = null): void {
    const first = faction === 'DEEPSEEK' ? this.deepseekSection : this.humanSection;
    const last = faction === 'DEEPSEEK' ? this.humanSection : this.deepseekSection;
    const grid = this.root.querySelector<HTMLElement>('.controls-help-grid')!;
    grid.append(first, last);
    this.humanSection.dataset.current = String(faction === 'HUMAN');
    this.deepseekSection.dataset.current = String(faction === 'DEEPSEEK');
    this.root.hidden = false;
    this.closeButton.focus({ preventScroll: true });
  }

  hide(): void { this.root.hidden = true; }

  dispose(): void { this.root.remove(); }
}
