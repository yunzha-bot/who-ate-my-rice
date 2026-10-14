/** 仅挂在阵营页；原生dialog负责焦点约束、ESC与背景不可操作。 */
export function mountMenuCredits(menu: HTMLElement, version: string): void {
  const footer = document.createElement('footer');
  footer.className = 'menu-credits';
  footer.innerHTML = `<p>《谁吃了我的米》为个人独立开发的非官方游戏作品，仅供学习、交流与娱乐体验。<br>
    游戏中出现的相关名称、形象及标识，其权利归各自合法权利人所有。本作品不代表任何相关企业、品牌或官方立场。</p>
    <span class="menu-version" aria-label="游戏版本"></span>
    <button type="button" class="menu-credits-open">制作信息 / 免责声明 <span aria-hidden="true">↗</span></button>`;
  footer.querySelector('.menu-version')!.textContent = `v${version}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'menu-credits-dialog';
  dialog.setAttribute('aria-labelledby', 'menu-credits-title');
  dialog.innerHTML = `<button type="button" class="menu-credits-close" aria-label="关闭制作信息">关闭 ×</button>
    <span class="menu-credits-kicker">ABOUT / THE LITTLE RICE CHASE</span>
    <h2 id="menu-credits-title">制作信息与免责声明</h2>
    <dl><dt>游戏名称</dt><dd>《谁吃了我的米》</dd>
    <dt>开发性质</dt><dd>个人独立开发项目</dd><dt>开发者</dt><dd>云扎</dd>
    <dt>作品用途</dt><dd>学习、交流与娱乐</dd></dl>
    <h3>非官方声明</h3><p>本项目不隶属于、不代表任何相关品牌或企业。</p>
    <h3>知识产权说明</h3><p>第三方名称、商标及其他受保护素材的权利归相应权利人所有；本项目原创内容的权利由其合法权利人保留。</p>
    <a href="https://github.com/yunzha-bot/who-ate-my-rice" target="_blank" rel="noopener noreferrer">GitHub 项目地址 ↗</a>`;
  const opener = footer.querySelector<HTMLButtonElement>('button')!;
  opener.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('button')!.addEventListener('click', () => dialog.close());
  // 不让弹窗按键进入全局游戏输入；保留浏览器原生ESC取消和Tab循环。
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('keyup', event => event.stopPropagation());
  dialog.addEventListener('close', () => opener.focus({ preventScroll: true }));
  menu.append(footer, dialog);
}
