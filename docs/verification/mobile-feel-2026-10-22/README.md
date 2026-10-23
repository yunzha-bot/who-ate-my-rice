# 手机版操作手感优化：本地实现与验证

后续RC2归档说明：下文12px/2px波纹参数为最初实现的历史值；用户后续微调后，源码为5px外扩、.65px白色阴影线及.3～.65px柔化，周期1050ms。最终以AlphaHudView/MOBILE_CONTROLS和mobile-ui.css为准；本轮归档复验见[RC2报告](../rc2-tencent-2026-10-23/README.md)，历史测试不回改。

日期：2026-10-22。依据用户贴文及手机横屏截图（原件仅本地）：保留左上状态、右上暂停、右侧技能布局，只优化触控输入与交互提示。实现当轮未修改开屏、原立绘、场景、美术或正式玩法数值，也未提交或部署；后续归档见 [Git 报告](../git-preparation-2026-10-22/README.md)。

归档范围：明确链接的七张截图、final-chrome/results.json、final-edge/results.json、gates.json、protection.json 纳入仓库；通配符截图、原始日志及其他中间材料仅本地保留。本轮重新测试结果见 Git 报告，不替换下方历史记录。

## 实现与参数

### 浮动摇杆

复用 AlphaHudView → InputManager → 原相机相对移动/碰撞路径，没有创建第二套输入系统。仅左侧区域可起手，底座在首次触摸时定位，之后不追手指；松手/取消/失焦/暂停/旋转后隐藏并释放方向。

配置集中在 `src/three/AlphaHudView.ts` 顶部 `MOBILE_CONTROLS`：

| 参数 | 当前值 / 含义 |
| --- | --- |
| `zoneWidthRatio` | 0.5，左半屏，右侧按钮不变 |
| `zoneTopRatio` | 0.28，从视口高度28%以下开始，避开左上状态栏 |
| `centerInsetPx` | 64 CSS px，区域内底座中心安全边距；同时不小于底座半径+8px |
| `edgeGapPx` | 8 CSS px，底座外缘余量 |
| `radiusRatio` | 底座宽度×0.34；小横屏106px底座约36px行程，普通128px底座约44px |
| `deadZoneRatio` | 行程的12%，约4～5px中心死区 |
| `sensitivity` | 1，触摸位移倍率；不修改角色速度 |

安全区通过原生 `env(safe-area-inset-left/bottom)` 缩进控制区域，中心再在区域内限幅。视觉底座在边缘被内移时，方向仍以**真实首次触点**为零点，不会一按下就突然转向；超出半径后方向限幅。InputManager 保持原有非零方向归一化与速度规则，**不是新增模拟变速走路**。

Human 布网期间左侧区域让出给原画布选点，避免浮动控制区截获布网地面触摸；原布网规则、名额与耗时不变。

### 右侧交互提醒

复用 `currentInteractionPrompt()` 的门/家具/米/藏身仲裁，以及原冻结/眩晕、冷却/锁芯状态，不另建距离判断。

- `NONE`：无目标，按钮不可用，不播放波纹。
- `READY`：真实目标可用，按钮按原结果显示“开门/吃米/搜查家具”等，并播放白色扩散描边。
- `BUSY`：按住交互或正在锁芯操作，停止当前波纹；正常交互保持原执行方式。
- `BLOCKED`：提示被阻挡、眩晕或控制禁用，停止波纹并禁用。

原操作成功或正在按住后，当前波纹会停止；松手后若同处还有新的合法操作（例如开门变成关门），可再次提示，不强行隐藏仍可用的交互。

参数同在 `MOBILE_CONTROLS`：`rippleMs=1050`、`rippleSpreadPx=12`；CSS 伪元素白色2px描边，约78%时间扩大并淡出，余下短暂停顿，按钮本体不缩放。样式在 `src/mobile-ui.css`；支持 typed calc 的浏览器按12px计算扩散，较旧浏览器回退1.3倍描边扩散。`prefers-reduced-motion` 使用静态白色描边，无循环动画。

### 头顶 E 与输入模式

头顶提示原本是 `.world-interaction` DOM，不是3D Sprite。仅在 HUD 当前输入模式为 `touch` 时整块隐藏，不是缩小字体，也不改变其真实交互判定。触摸/笔输入切换触控文案，键盘或实际鼠标输入恢复键盘提示；粗指针设备默认触控。真实浏览器已测试触屏模拟环境中键盘输入恢复 E 提示，下一次触摸再隐藏。

手机藏身/吃米进度文案改为“点交互离开/停下按住交互”；键盘模式仍显示 E。右侧按钮始终是触屏入口，不要求点击角色头顶。

### 拖动瞄准与松手投掷

保留原有触摸瞄准适配层和 ThrowableSystem 的射程、遮挡、飞行、眩晕、耐久与冷却：

1. 按下投掷按钮由该 Pointer ID 独占瞄准并捕获指针，不立即投出。
2. 原相机投影与地面射线更新虚线和落点，角色使用原朝向/手持物表现；每次有效拖动即缓存世界落点，不依赖下一渲染帧。
3. 手指拖出按钮仍由 pointer capture 连续接收；经过别的按钮不触发它们。
4. 移出画布时保留最后有效世界落点，正常松手仍只投一次；取消、丢失捕获、失焦、暂停不投出。
5. `canThrow()` 提供只读可用性，共用原执行守卫，包括真实冷却、持有物、耐久、藏身/眩晕；按钮与触摸起手读取它，未改变任何规则数值。
6. 摇杆和每个按钮各有 Pointer ID；第二根投掷手指不能偷走第一根，抬起其他手指不会清除摇杆或瞄准。

补测修复：原暂停/取消按钮只监听 click，第二根手指可能不生成 click。现在触摸/笔按下即可执行，鼠标和键盘仍保留 click，并过滤触摸合成 click，避免重复命令。

**动作资源限制**：现有正式 DeepSeek GLB 只有 Idle/Walk/Run/Eat/Hide 系列，没有专门的投掷准备/抛出片段；本轮沿用原手持物、转向与轨迹预览，没有假称新增 Throw 动画，也没有重绘/改动角色资源。

## 实际浏览器与工程检查

| 项目 | 本轮实际结果 |
| --- | --- |
| 定向 Node 测试 | 67/67：HUD、Pointer所有权、浮动边界、按下零方向、忙碌/禁用、次指暂停取消、投掷越界/重复释放/冷却、原键鼠与教学 |
| 最终 `npm test` | 1097/1097，失败/取消/跳过0；完整输出 `tests.log` |
| `npx tsc --noEmit` | 退出0，`types.log` |
| `npm run build` | 退出0，138模块；原有 chunk >500kB 警告保留，`build.log` |
| `git diff --check` | 退出0；保留原LF→CRLF提示，文档追加后再检查 |
| Chrome触摸模拟 | 667×375、844×390 × 两阵营，共4/4操作流程通过，`final-chrome/results.json` |
| Edge触摸模拟 | 同上4/4，`final-edge/results.json` |
| 桌面Chrome/Edge | 两浏览器均实际验证触屏UI隐藏、D键按下/松开、E开门、F拾取、鼠标按下瞄准/松开只投一次，共2/2 |
| 多指/取消补测 | 左边缘按下零输入、底座不追手、同时移动/瞄准、拖过Q不误触、系统touchCancel、瞄准中次指暂停无投出、按住吃米/搜查/锁芯与布网等原路径通过 |
| 提示补测 | 门附近READY有1.05秒波纹；无目标NONE时停止，低动态不循环；键盘提示恢复/触摸再隐藏；门/米/家具仍走原仲裁 |
| 生命周期 | 暂停继续、旋转清输入与暂停、重开及返回菜单通过；无新增动画循环或依赖 |
| 保护检查 | `protection.json`：19项开屏/原图/配置摘要未变；ThreeGame相对D版本只有本轮HUD可用性接线变化 |

测试均在既有 `http://127.0.0.1:5173/` 上执行。浏览器使用安装版 Chrome/Edge、协议多点触摸、DPR3上下文，原移动渲染DPR上限1.35不变。场景夹具只在隔离测试页安排合法道具/门/家具位置，未给生产入口加入测试全局；不冒充真人自然整局。

最初旧固定摇杆测试需要更新触摸起点；扩展多指暂停测试曾超时，从而找到并修复 click-only 根因；未删失败断言或跳过测试。最终两个浏览器都通过扩展检查。

## 实际截图

以下是本轮真实浏览器截图，文件名中的667/844为CSS视口宽度；DPR3图像像素较大，不是手机浏览器工具栏截图。

| 文件 | 内容 |
| --- | --- |
| [final-chrome/chrome-667-HUMAN-floating-stick.png](final-chrome/chrome-667-HUMAN-floating-stick.png) | 小横屏Human浮动摇杆 |
| [final-chrome/chrome-844-DEEPSEEK-floating-stick.png](final-chrome/chrome-844-DEEPSEEK-floating-stick.png) | 横屏DP浮动摇杆 |
| [final-chrome/chrome-667-DEEPSEEK-interaction-ripple.png](final-chrome/chrome-667-DEEPSEEK-interaction-ripple.png) | 门附近白色波纹，无头顶E提示 |
| [final-chrome/chrome-844-DEEPSEEK-aim-multitouch.png](final-chrome/chrome-844-DEEPSEEK-aim-multitouch.png) | 同时移动与拖动瞄准、原轨迹预览 |
| [final-edge/msedge-667-HUMAN-aim-multitouch.png](final-edge/msedge-667-HUMAN-aim-multitouch.png) | Edge小横屏多指瞄准 |
| `final-edge/msedge-*-*-floating-stick.png`、`final-edge/msedge-*-*-interaction-ripple.png` | Edge对应两尺寸两阵营证据 |
| [final-chrome/chrome-desktop-keyboard-mouse.png](final-chrome/chrome-desktop-keyboard-mouse.png)、[final-edge/msedge-desktop-keyboard-mouse.png](final-edge/msedge-desktop-keyboard-mouse.png) | 桌面键鼠回归 |

本轮提供截图及浏览器断言，没有录屏；不以静态图片单独证明动态、无录像不冒充已有录像。波纹/多指等动态由真实协议手势和浏览器状态断言联合验证。

## 修改文件

- `src/three/AlphaHudView.ts`：浮动区域/定位、输入模式、真实交互状态、多指所有权、捕获释放、次指暂停/取消。
- `src/mobile-ui.css`：浮动底座、头顶提示按模式隐藏、白色波纹及低动态、安全区；原右侧网格尺寸不变。
- `src/three/ThrowableView.ts`：合法触摸起手、最后有效落点缓存、快速移动/越界处理、手机提示文案。
- `src/systems/ThrowableSystem.ts`：提取共用只读 `canThrow` 守卫，执行规则和数值不变。
- `src/three/ThreeGame.ts`：仅HUD的真实投掷/交互可用性接线。
- `src/three/ControlsHelpView.ts`：仅更新触屏操作说明文案。
- `tests/alpha-hud.test.mjs`、`tests/throwables.test.mjs`：更新浮动入口并增加边界/多指/可用性回归，不移除桌面保护。
- `scripts/verify-mobile-controls.mjs`：适配浮动摇杆、增加多指暂停/提示/桌面E与鼠标投掷取证，独立输出目录与JSON。
- `docs/MOBILE_BROWSER_SUPPORT.md`、`docs/DEEPSEEK_HANDOFF.md`：最新简要状态与报告入口；`docs/AGENT_LOG.md`只追加。本证据目录新增，不清理旧材料。

## 尚未验证与下一步

- 没有手机真机连接：Android Chrome、iPhone Safari、微信内置浏览器的原生手势拦截、真实刘海/底栏/系统中断、触感与发热仍需真机试玩。Chromium触摸模拟不能代替Safari或微信。
- 模型没有专用投掷准备/抛出动画，限制如上；如果后续需要新增动画，应另列资源任务，不在本轮暗改模型。
- 真实系统后台/锁屏没有在手机上验证；Pointer取消/blur分支与游戏暂停已测，不以模拟事件冒充系统操作。
- 当前仅本地候选；正式平衡、S20/S21状态、已验收开屏及Git历史不变。请在手机验收后再另行决定是否推送或部署RC，本轮不执行发布。

复验：设 `PLAYWRIGHT_MODULE` 为本机可用 Playwright，`MOBILE_USE_GPU=1`、`MOBILE_CHANNELS=chrome,msedge`、`MOBILE_ARTIFACT_DIR=<新的验证目录>`，运行 `node scripts/verify-mobile-controls.mjs`。未设置输出目录时仍使用系统临时目录，不覆盖已有证据。
