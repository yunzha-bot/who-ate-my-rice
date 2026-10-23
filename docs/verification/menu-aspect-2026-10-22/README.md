# 开屏桌面宽高比适配 — 2026-10-22

本轮只修复开屏在内置预览近方形窗口和其他桌面宽高比下的拉伸；保留既有手绘设计、立绘、文字、相机、动态参数和游戏流程。没有读取或改动私人配置，没有提交/推送/部署。

## 原因与修复

- 原布局卡宽按vw、高按vh独立变化，背景又用100%×100%铺满；文字按卡宽、人物contain等比，因此卡片变成长条而人物变小靠底。修复前同一真实浏览器七组检查得到20项卡片/人物框/按钮比例失真。
- 使用纯CSS的统一尺度 `--menu-vw: min(1vw, calc(100dvh / 56.25))`，以既有1920×1080画面为基准（1920/1080=16/9），不是锁定或强制设置浏览器125%缩放。布局宽高、间距、按钮和设置文字共享尺度，卡内文字继续使用cqw。
- `--menu-offset-x/y`计算剩余空间并居中完整UI；背景Three.js画布、前景树叶仍覆盖整个窗口，不随UI加边或整体缩放。没有JS resize适配器、额外rAF、依赖或transform缩放根节点，视觉位置和原生点击区域一致。
- 窄竖屏/触屏保留原重排和固定控件例外；本轮不是手机布局重做。菜单自身仍可在小窗口滚动，不通过隐藏操作入口来制造通过。
- 1920×1080的LOGO、两卡、两人物框、设置栏和开始按钮矩形与本轮修改前完全一致。1266×1195下蓝卡宽高比从0.7068恢复为基准1.1861，黄卡从0.6426恢复为1.0783；保持原图比例，并非新增美术设计。

## 实际证据

| 路径 | 内容 |
| --- | --- |
| [before/results.json](before/results.json) | 修改前七组真实Chrome检查，20项比例失真 |
| [final/results.json](final/results.json) | Chrome/Edge共14组窗口比例、图片contain、按钮可达、无横向溢出及设置/阵营操作 |
| [final/chrome-1266x1195-3.png](final/chrome-1266x1195-3.png) | Chrome接近用户内置预览截图的宽高，已选择阵营状态 |
| [final/msedge-1266x1195-10.png](final/msedge-1266x1195-10.png) | Edge相同近方形窗口 |
| [final/chrome-1920x1080-1.png](final/chrome-1920x1080-1.png) | Chrome默认未选择状态，原基准布局 |
| [final/chrome-1768x890-2.png](final/chrome-1768x890-2.png) | Chrome参考图宽高比；UI等比适应高度并水平居中 |
| `final/*1000x1000*.png`、`final/*2560x1080*.png` | 方形与超宽屏边界检查 |
| [zoom/results.json](zoom/results.json) | Chrome/Edge各25/100/125/150/200/250/300%，共14组等效CSS视口+DPR检查 |
| [flow-chrome/browser-results.json](flow-chrome/browser-results.json) | Chrome六尺寸及原完整开局/设置/返回流程 |
| [flow-edge/msedge-browser-results.json](flow-edge/msedge-browser-results.json) | Edge相同流程 |
| `flow-chrome/static-*.png`、`flow-edge/msedge-static-*.png` | 两浏览器六尺寸最终默认状态截图 |

全部是本轮真实本地浏览器截图，不是设计稿或旧证据。实际复用127.0.0.1:5173服务，无头Chrome/Edge使用独立上下文。内置标签页的连接工具不可用，1266×1195为按用户截图尺寸重现，不声称直接验收了该内置实例；也未操作真实浏览器工具栏缩放。

`first-fix/`和`diagnostic/`是失败中间态，不能作为最终效果；其中曾读到缺少新变量的旧转换CSS模块，已重新核对服务返回最新变量/布局并在最终浏览器重新加载通过。第一版探针有非唯一阵营选择器，已限定`.faction-card`，未放宽任何比例/可达性阈值。

## 本轮实际检查

| 检查 | 结果 |
| --- | --- |
| 菜单/纸张/动态定向 | 26/26 |
| npm test | 1125/1125，失败/取消/跳过0，约81.91秒 |
| npx tsc --noEmit | 通过，退出0 |
| npm run build | 通过，143模块；保留既有大于500kB chunk警告 |
| git diff --check | 通过，退出0；LF/CRLF提示保留 |
| 桌面宽高比 | 两浏览器各1920×1080、1768×890、1266×1195、1366×768、1000×1000、2560×1080，再回1920，共14组；比例误差阈值1%，全部通过 |
| 等效缩放 | 两浏览器14组通过，字号/纸底、按钮可达、DPR及原相机frustum、音量/难度/制作信息操作通过 |
| 正式流程 | 两浏览器各六尺寸1920、1768、1600、1366、960、390；双阵营原生键盘选中、Start、READY、首次教学、PLAYING、暂停返回；加载门禁拒绝提前开始、五音量/静音/三难度/ESC焦点/制作信息通过；pageerror/HTTP错误0 |

## 修改、调整与边界

- 运行时仅修改`src/opening-menu.css`：统一尺度与居中。没有修改ThreeGame、GameUiLayout、模型/图片、HUD、关卡或玩法。
- `tests/menu-responsive.test.mjs`新增统一尺度保护，原尺寸规则断言改为新公式，继续保护触屏例外/菜单交互/减少动态。
- 新增`scripts/verify-menu-aspect.mjs`实际宽高比检查；`scripts/verify-menu-zoom.mjs`口号识别同步已批准的“我的大米！”，原左距阈值不变。
- 新增本目录证据和报告；HANDOFF与阶段方案同步，AGENT_LOG只追加。保留所有旧资源/验证资料和已有未提交文件。
- 可调入口在opening-menu.css顶部：56.25是16:9画布高度/宽度×100；通常无需改。要整体变大应一起调整设计基准，而不是独立修改卡高或字号。窄触屏例外在同文件媒体规则和原mobile-ui.css中，本轮未修改后者。
- 无已知阻断问题，待用户在实际内置面板及外部浏览器确认。用户系统DPI/最小字号、原生工具栏缩放、手机真机与低端性能未重新验收；本轮无新动画性能声明。
- 默认dist已重建；dist-tencent仍为旧产物。没有暂存、提交、推送、Tag/Release或部署，不记阶段Gate PASS。下一步刷新预览确认，不自动归档或上线。
