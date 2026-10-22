# 开屏静态版：证据与素材说明

归档说明：本文件保留 B 历史时点。仓库保留 reference.png；最终全景见 [D 报告](../opening-final-2026-10-22/README.md)。下方其余过程截图/日志仅本地保留，不代表均可从 GitHub 下载。

2026-10-22，阶段B验收候选。预览 `http://127.0.0.1:5173/`；全部截图为本轮独立Chrome/Edge真实页面渲染，非参考图伪装或历史截图。

## 证据

- `reference.png`：用户原参考，1768×890。
- `before-1920.png`：改造前真实1920×1080；`iteration-1-1920.png`：首轮静态实现。
- `static-1920x1080.png`、`static-1768x890.png`：Chrome静态候选；其余static尺寸是响应式检查。
- `msedge-static-*.png`：Edge同尺寸检查。
- `comparison-1768.png`：左参考、右真实实现，两边均1768×890、无非等比缩放；`comparison-title/cards/settings/start.png`是相同区域裁切的局部对照。
- `browser-results.json` / `msedge-browser-results.json`：六尺寸实际矩形、图片加载、等比显示、设置和双阵营开局检查。
- 自动化脚本 `scripts/verify-opening-static.mjs`：默认真实页面截图；交互检查单独在浏览器响应中注入只读观察句柄，不往生产源码添加window.game。未就绪门禁用测试页临时替换成新的StartupReadiness验证，随后恢复；READY正常计时至PLAYING，没有强制跳过。
- `scripts/verify-mobile-controls.mjs`：同步两步开局与新CSS。此次运行Chrome两手机横屏×两阵营的布局回归和桌面键盘，共5项；不是手机完整玩法重验，也不代表真机性能验收。

运行时通过 `PLAYWRIGHT_MODULE` 指向宿主已有Playwright，不安装项目依赖；浏览器使用软件WebGL，不能据此声称硬件帧率达标。主验收密度deviceScaleFactor=1、浏览器默认100%。

## 原人物保护

与Git基线原文件逐字节比较相同；CSS object-fit:contain，未裁切/拉伸人物。结算共用立绘及结算DOM保持。

| 原图 | SHA-256 |
| --- | --- |
| public/assets/ui/portraits/deepseek-normal.png | f54bf1c405355b974406048eed9cb21c1a3b5297160db8816c9edca058a0332b |
| public/assets/ui/portraits/human-guardian-v1.webp | 25aee062a7404ff40b83ce3bccb42682de6f0eba77f930e1d531c25a594ba23b |

## 非人物素材与最终提示词集

使用内置ImageGen，不使用CLI/API密钥。参考只作为视觉/构图来源，不是人物编辑目标。以下为生成提示词的归一化整理；原始生成文件保留，由sharp进行透明留白裁整、等比缩小和WebP编码；贴纸表仅按透明间隙拆分。无新增运行时依赖。

最终资产均在 `public/assets/ui/menu/`：

| 文件 | 提示词核心约束 |
| --- | --- |
| logo.webp | 透明手绘贴纸LOGO，按参考重建深墨“谁吃了我的米？”、放大金黄色“米”、THE LITTLE RICE CHASE、副文案“偷吃一口而已，至于追这么久吗？”，米白纸边/米粒/米桶；不含人物、整屏背景、卡片 |
| card-blue.webp | 独立空白蓝色水彩纸片，微倾斜、双白纸边及少量静态米粒；不含文字、人物、背景 |
| card-yellow.webp | 独立暖黄色水彩纸片，纸张叠层、下方纸箱与侧边盾徽；不含Human、文字或场景 |
| start.webp | 黄色手绘笔刷按钮底，米白不规则边、小白色装饰；无文字无箭头，文字和点击仍是HTML |
| foliage.webp | 透明16:9前景覆盖，仅极左/极右/四角的虚焦橄榄绿树叶及暖光；中央75%留空；无建筑、人物、UI；只静止叠放 |
| rice-tub.webp | 参考蓝卡下沿木米桶，堆满白米、少许溢出，米白贴纸边、温暖水彩风；独立透明，无主角、文字或场景 |
| rice-cat.webp | 参考蓝卡白色米团小猫，蓝描边、粉腮、小爱心、贴纸边；独立透明，仅小装饰，不替换角色 |

装饰不是原参考的无损提取，笔迹、纸纹、米粒与枝叶形状存在差异，不宣称像素相同。没有使用带角色的整卡或整屏截图当页面。

## 主要源码及验证改动清单

- `src/three/GameUiLayout.ts`：仅阵营页标记/待选/开始、菜单原生键盘保护。
- `src/three/ThreeGame.ts`：保存菜单reset回调，返回菜单清空选择；原chooseFaction未改。
- `src/opening-menu.css`：唯一活动阵营页样式；旧 `src/faction-menu.css` 保留不改。
- `src/main.ts`：切换菜单CSS导入；`src/mobile-ui.css`：仅菜单短横屏旧规则适配新布局。
- `tests/faction-card-ui.test.mjs`、`tests/menu-responsive.test.mjs`、`tests/pages-deployment.test.mjs`、`tests/helpers/faction-menu.mjs`：两步开局、重置、原图、键盘隔离、单一样式、响应式和子路径回归。
- `scripts/verify-opening-static.mjs` 新增浏览器检查；`scripts/verify-mobile-controls.mjs` 更新现有入口。
- `docs/OPENING_UI_RECONSTRUCTION_PLAN.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`、根目录 `design-qa.md` 及本证据目录：计划、交接、追加日志与验收证据。`AGENTS.md`未改。

## 版本与恢复边界

分支 `codex/opening-static-reference`；无暂存、commit、push、Tag、Release或部署。main与远端原检查点不动。旧CSS、旧资源、用户原未跟踪文件保留。

首次构建前原dist已复制到 `C:/Users/bilibili/AppData/Local/Temp/rice-before-opening-670e1665c2a54f8a8b329fb4fdf3d05b/dist`，未删除备份。根目录dist是本地检查生成的新静态候选，不是已部署版本。

阶段C未开始。新增表现参数仅在opening-menu.css中：标题/卡片/按钮定位与尺寸、背景filter、静态装饰位置；没有视差、树冠摆动、飘米或新增Hover动画的参数。
