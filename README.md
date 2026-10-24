# 谁吃了我的米

《谁吃了我的米》是一款使用 Three.js 制作的双阵营单机追逐游戏。DeepSeek 娘尝试吃完每局激活的 5 份米，Human 通过抓捕赢得对局。

当前版本号为 **v1.0.0-rc2**，属于 RC 测试版，不是 v1.0.0 正式发布。旧 v1.0.0-rc1 Tag/Release 是固定历史快照，保留不动；推送代码或Tag不自动更新网站。说明见 [rc2交付记录](docs/releases/v1.0.0-rc2.md)与[旧候选版记录](docs/releases/v1.0.0-rc1.md)。

技术栈：TypeScript、Three.js、Vite、原生 HTML/CSS。推荐 Node.js 24 LTS 与 npm（工作流使用 Node 24；Node 需支持项目测试使用的 TypeScript stripping），桌面目标为 Chrome/Edge；手机版横屏优先，Safari/微信等仍需真机验收。

文档入口：[开发日志与专项记录统一入口](docs/README.md)、[当前交接](docs/DEEPSEEK_HANDOFF.md)、[移动浏览器说明](docs/MOBILE_BROWSER_SUPPORT.md)。

## 本地运行

```sh
npm ci
npm run dev
```

开发服务器固定为 `http://127.0.0.1:5173/`，端口占用时不自动切换；已有本项目服务应复用。检查命令：`npm test`、`npx tsc --noEmit`、`npm run build`、`git diff --check`。

## 正式构建与预览

```sh
npm test
npx tsc --noEmit
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

预览地址为 `http://127.0.0.1:4173/`。正式站点只部署构建目录内部的文件：默认/Pages为 `dist/`，腾讯云独立包为 `dist-tencent/`。不部署整个工作目录，不使用 `npm run dev` 对外提供游戏。生产构建不会初始化场景编辑器、DEV/DEV-B面板、调试绘制、AI诊断日志或DEV预设读取；暂停菜单也不创建开发阵营切换按钮。本地开发功能和预设仍保留。

布局保存服务仅用于Vite开发环境，不属于正式游戏API。默认构建仍使用根路径；GitHub Pages 专用构建通过显式环境变量使用 `/who-ate-my-rice/`，模型、立绘、CSS 和音频遵循相同 base。

### 腾讯云根路径部署包

```sh
npm run build -- --base=/ --outDir dist-tencent
node scripts/verify-tencent-build.mjs
```

已有腾讯云包须先备份，再重新构建；本轮旧包与可上传ZIP放在本地忽略的 `dist-tencent-delivery/`。上传 `dist-tencent/` 内部全部内容，使网站根层直接包含 `index.html`、`assets/`、`maps/`、`ui/`；不要上传源码、依赖、候选素材、备份或工程配置。ZIP也必须以 `index.html` 为根层，不能套一层dist-tencent。当前开屏点击任一阵营卡片直接开局。

最新可上传目录、资源清单、真实截图及本轮测试见 [2026-10-24人类失败插画与腾讯云目录更新](docs/verification/human-defeat-2026-10-24/README.md)；此前持物与日志整理见[历史记录](docs/verification/logs-tencent-2026-10-24/README.md)。直接上传dist-tencent文件夹（或其内部内容），无需ZIP；若保留外层文件夹，网站文档根目录应指向该文件夹内部，使游戏仍从域名根路径访问。旧RC2 ZIP保留作历史包，不含最新持物和失败插画修正，不要当作最新版上传。

桌面菜单正常响应浏览器缩放，CSS视口不足1280px时上下排列，可纵向滚动选阵营。本次是RC2 Tag之后的main更新，版本标识仍为RC测试版，既有Tag不移动。腾讯云由所有者手动上传，Pages仍不自动部署。

### GitHub Pages RC构建与手动部署

GitHub Pages 使用下面的显式子路径构建，更新本机 `dist/`。腾讯云使用上一节的独立 `dist-tencent/` 根路径构建；两者不要混用。下列工作流保持手动审核部署，本次腾讯云准备不触发它。

```powershell
$ricePagesPrevious = $env:PAGES_DEPLOYMENT
try {
  $env:PAGES_DEPLOYMENT = 'true'
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Pages build failed' }
  node scripts/verify-pages-build.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Pages artifact audit failed' }
} finally { $env:PAGES_DEPLOYMENT = $ricePagesPrevious }
```

产物审查命令需在具备 Git 追踪清单的完整检出中运行（新资源须已审核并纳入 Git）；无 Git 元数据的隔离副本须显式提供经过审核的 public 清单。严格本地验证只挂载 `/who-ate-my-rice/`，不能用根 `/assets/` 或 HTML 回退掩盖缺失资源。

`.github/workflows/pages.yml` 只允许手动RC部署：限本仓库main、显式确认，并填写审核通过的40位`approved_sha`；触发提交必须与该SHA相同。生产构建和产物门禁后只上传 `./dist`，不随push/Tag/Release自动上线，也不自动启用Pages。`v1.0.0-rc1`里程碑保持固定，RC网页上线不等于正式v1.0.0或S20验收完成。实际准入与发布记录见 [S19-P报告](docs/verification/S19_P_RC_DEPLOYMENT_REPORT.md)，既有证据见 [Pages本地验收](docs/verification/GITHUB_PAGES_LOCAL_ACCEPTANCE_REPORT.md)，中国大陆访问见 [网络验收计划](docs/verification/GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md)。

后续由所有者打开 [Pages 工作流](https://github.com/yunzha-bot/who-ate-my-rice/actions/workflows/pages.yml)，选择 `main`，填写已审核且仍等于远端 main 的完整 SHA，并勾选确认。必须确认运行检出的 SHA 与 `approved_sha` 完全一致；若 main 已前移，先重审新提交，不填写旧 SHA 强行运行。[Pages 入口](https://yunzha-bot.github.io/who-ate-my-rice/) 与 GitHub 源码不是同一版本保证，最终以成功部署的提交为准。

## 操作与对局

以下为原有默认键位；未主动修改按键设置时保持原样。

- WASD / 方向键移动；E交互、开关门；DeepSeek娘停下并按住E进食。
- E 复用真实目标仲裁：开关门、藏身、按住吃米；Human 无门时搜查面前合法家具，家具搜查与 V 共用冷却。
- Q：DeepSeek 娘锁门，Human 布设捕捉网；V 为 Human 前方扇形抓捕。网最多4张，不自动到期，可被触发或投掷物拆除；锁门名额最多3扇。以当前 HUD 状态为准。
- Space：DeepSeek 娘冲刺 / Human 强行破门；困难夜间靠近开关用 L 开关区域灯光。仅开发版5173支持Z/C旋转视角、X恢复默认视角。
- F拾取附近生活物件；持有时按住鼠标左键瞄准、松开投掷，右键取消。命中对手眩晕3秒；花瓶/盒子一次性消耗，不锈钢盆最多投掷3次，尚有耐久时落地可回收。
- Esc打开暂停菜单，可继续、进入设置、重新开始或返回首页。设置 → 按键设置中可点击操作项后按新键，支持冲突提示、恢复默认和本机自动保存；Esc固定暂停、方向键保留辅助移动，鼠标与手机触屏操作不受改键影响。
- DeepSeek 娘每份米需累计20秒进食进度，每局目标5份，中断保留进度。三档难度区分对手 AI 速度、投掷/技能决策；困难还使用双方受限的夜间视野与区域开关灯。

### 手机横屏

- 在左侧空白移动区按住并拖动，浮动摇杆以首次触点起手，松手收起；可同时操作右侧技能。
- 右侧交互按钮复用门/米/家具等真实判定，可操作时有白色扩散描边；吃米需停下按住。触屏隐藏头顶 E，切回键盘输入可恢复。
- 点拾取后，按住投掷按钮拖向目标，松手投出；取消、系统中断或暂停不会投出。Human 点布网后触摸空地预览，松手确认；右上暂停与取消保留。
- 竖屏显示旋转提示；旋转/切后台会按原规则暂停，恢复横屏后需主动继续。真机浏览器底栏、系统手势、Safari/微信及持续发热尚未全部验收，详见 [手机操作报告](docs/verification/mobile-feel-2026-10-22/README.md)。

正常对局失焦或切到后台时自动暂停，返回后由玩家明确继续；开局倒计时失焦时停住。开发编辑器及已冻结调试会话保持原有冻结行为。刷新会开始新的会话，不保存进行中的对局；音量和难度偏好可保留。

投掷物初始布局独立保存在 `src/three/map/throwableLayout.json`；暂停不会推进射弹或眩晕，重开恢复初始物件。两方 AI 均已有拾取/投掷策略，准度随难度区分，困难包含有限可见走位预判；Human AI 也会布网。早期 [`投掷物报告`](docs/verification/THROWABLES_REPORT.md) 仅说明当时基线，当前实现与数值以源码及 [配置索引](docs/GAME_BALANCE_CONFIG.md) 为准，不将固定夹具当作真实胜率证据。

开发入口5173的场景编辑器可选择或拖动投掷物、输入X/Z，统一点上方“应用编辑 → 保存布局”会同时保存已修改的家具/藏身点和道具（仍写各自JSON）；下方专用道具按钮只处理道具。5173刷新会读取新位置，4173正式预览需重新构建同步。轨迹为米白虚线，当前命中眩晕3秒。详见 [道具编辑说明](docs/verification/THROWABLE_EDITOR_REPORT.md)。

## 候选发布版验证与限制

本轮兼容、性能与发布准备记录见 [`docs/verification/S17_S19_RC_REPORT.md`](docs/verification/S17_S19_RC_REPORT.md)。浏览器自动化、自然时长脚本对局与人工试玩分开记录，不以少量固定种子宣称胜率已平衡。教学、连续QA与统计平衡证据不足的部分保留为待确认，不补写阶段完成记录。

脚步、冲刺启动/脚步、开关门五项声音仍按用户决定停用；其他现有音频保留。这里不新增源码或素材的通用开源许可。

### AI生成素材说明

本项目仅供非商业学习、交流与娱乐。按开发者来源声明，部分米袋、立绘及UI素材由GPT生成或经后期加工；不锈钢盆命中音和DeepSeek娘被抓失败音由开发者在updream生成。其余37个Ogg由项目脚本合成，正式v6角色依开发者原创声明管理。具体来源、条款及限制见 [素材记录](docs/ASSET_PROVENANCE.md)。AI生成及非商业用途不代表第三方权利豁免；本说明不授予访客通用素材许可证。

## 公开版角色资源

正式角色为 `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`，包含骨骼动画及内嵌贴图；用户确认该模型为自制原创资产，并授权公开上传至本仓库。公开版与本机优先使用同一模型及头发动态，加载失败时使用程序化角色回退。旧版和测试模型不包含在公开快照中。

素材来源与发布范围见 [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md) 和 [`docs/PRE_S13_SNAPSHOT_REVIEW.md`](docs/PRE_S13_SNAPSHOT_REVIEW.md)。
