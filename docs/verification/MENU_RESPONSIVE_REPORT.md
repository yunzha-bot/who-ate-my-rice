# 阵营选择页响应式布局修复 — 2026-10-14

## 用户最终验收与发布

用户已确认原生浏览器缩放人工验收通过，并授权本次公开归档。原90%～200%待人工项由用户本次确认解除；开发代理的CSS视口测试仍不冒充原生缩放实测。后续各节保留开发轮的方法、截图及当时限制，以本节为最新验收结论。

发布前重新执行878/878、独立TypeScript、build与diff检查，均通过，不修改菜单或玩法。原始盒数据／控制台JSON和临时探针本机保留，本次只公开报告与精选截图；相关文件记录为本机证据路径，不要求公开仓库存在这些诊断文件。完整范围见 [发布审查](S13_RELEASE_REVIEW.md)。favicon404、软件Edge着色器告警及硬件后端复测结果如实保留，不因此宣称潜在问题清零。

## 范围与验收口径

只整理阵营选择页面的结构、样式与现有声音设置节点的挂载位置。不调整三档难度、30秒进食、5份米、AI、地图、家具、角色素材、动画、音频或游戏内HUD／暂停／PulseLock设计。既有未提交工作保留，未暂存或执行Git归档。本轮使用diagnosing-bugs先复现失败盒断言，再按ponytail的最小改动约束集中样式归属，没有新增依赖或重写系统。

上轮原生浏览器控制宿主不能可靠核验URL，本轮没有重试该宿主。使用独立Playwright启动已安装的Chrome／Edge，每个新实例明确 `page.goto('http://127.0.0.1:5173/')`，核对实际URL、端口、标题《谁吃了我的米》及阵营页DOM后才交互。复用项目已有5173服务，没有启动不明端口或结束其他进程。

**本报告的不同尺寸是CSS视口验证，不是原生浏览器缩放验证。** 未使用CSS zoom、整页scale或JavaScript改变浏览器缩放。90%～200%的原生缩放仍须人工验收，不因视口测试通过而宣称完成。

## 根因与实际复现

实际样式加载次序为 `style.css → industrial-ui.css → sheet-ui.css → s13-ui.css → game-ui.css`。其中四份文件反复定义同一阵营页选择器，`sheet-ui.css`没有阵营页规则。

1. 标题、阵营fieldset、难度fieldset、免责声明底栏绝对定位，各自依据视口高度定位，不能根据上一块内容的真实高度自然避让。
2. 卡片高度同时受vh、固定最小高度及多个媒体查询控制；内部说明绝对定位，立绘超出卡片高度，短窗口时名字、立绘和说明互相挤占。
3. 根页面被限制为视口高度，主体脱离文档流，`overflow:auto`没有形成有效的内容滚动范围。底栏固定在屏幕内进一步挤压控件。
4. 通用label与后加载规则影响难度／声音设置；原首页声音设置直接挂在 `#app` 并固定定位，没有参与菜单布局。

修复前独立Chrome在960×450下真实复现：阵营卡底部377px，难度顶部291px，重叠86px；菜单 `scrollHeight = clientHeight = 450`。探针断言实际失败。截图与原始盒数据见 [修复前](menu-responsive/before-chrome-960x450.png)、`docs/verification/menu-responsive/before.json`（本机证据）。

## 修复方式

- 新增唯一阵营页样式入口 `src/faction-menu.css`，从原四份样式移走菜单规则。共享选择器仅移除阵营页成员，HUD、ESC、PulseLock成员保留，不追加!important补丁。
- 页面外层仅作为覆盖3D画布的容器；标题、两卡、难度、底栏全部在正常文档流内。Grid负责两卡／三档，Flex负责整体纵向关系及页脚换行。
- 卡片内分为身份、受约束的立绘、独立说明／箭头区域；保持原立绘、文案、配色、斜切卡片和材质资源，不再让立绘或说明跨区覆盖名称。
- ≤820px改为单列阵营卡和单列难度；≤540px标题与介绍换行；≤400px调整卡内列宽。没有按窗口高度隐藏难度说明。
- 菜单拥有真实纵向滚动，底栏随内容排列，剩余高度充足时推到页面底部。不以z-index掩盖区域相交。
- 只复用一个 `AudioSettingsView`，阵营页挂到标题栏槽位、展开时参与布局；暂停时仍挂回原overlay，原音量状态及持久化不变。

## 浏览器证据与交互

测试以1600×900为计算基准选取CSS视口。下表百分比仅说明视口空间如何选取，**不表示实际操作了浏览器缩放**。

| 空间参照 | 实际CSS视口 |
|---|---|
| 90% | 1778×1000 |
| 100% | 1600×900 |
| 110% | 1455×818 |
| 125% | 1280×720 |
| 150% | 1067×600 |
| 175% | 914×514 |
| 200% | 800×450 |
| 额外桌面／短窗口 | 1366×768、960×450、1280×400 |
| 额外窄窗口 | 640×480、480×640、320×480 |

每种尺寸检查：各主体区域盒不相交；无横向滚动；标题、说明、难度文字未裁切；名称与立绘／说明分区；横排双卡等高；必要时鼠标滚轮可滚到完整操作区；三档鼠标选择／方向键；制作信息按钮、ESC及关闭按钮；声音设置展开、原生滑块键盘操作、恢复默认及收起；两个阵营分别点击／Enter进入真实READY／PLAYING、ESC暂停和返回菜单。桌面尺寸补查HUD宽度310px及暂停声音设置仍在原面板；刷新检查独立浏览器的难度偏好恢复。

原始逐条件记录：`docs/verification/menu-responsive/matrix.json`（本机证据）。Chrome154.0.8037.100与Edge151.0.4129.86各13/13条件通过，共26组、52次双阵营进入／暂停／返回；页面未处理异常0。两个独立实例刷新后的难度偏好恢复均通过。桌面暂停声音设置截图见 `menu-responsive/*-pause-settings-*.png`；同机位短窗口对照为 [修复前](menu-responsive/before-chrome-960x450.png) 与 [修复后](menu-responsive/chrome-short-top.png)，短窗口全部内容通过滚动访问，不要求单张截图显示完整页面。

代表截图（短视口需向下滚动，分别展示顶部与底部）：

| CSS视口 | Chrome | Edge |
|---|---|---|
| 1455×818 | [顶部](menu-responsive/chrome-110-css-viewport-top.png) / [底部](menu-responsive/chrome-110-css-viewport-bottom.png) | [顶部](menu-responsive/edge-110-css-viewport-top.png) / [底部](menu-responsive/edge-110-css-viewport-bottom.png) |
| 1067×600 | [顶部](menu-responsive/chrome-150-css-viewport-top.png) / [底部](menu-responsive/chrome-150-css-viewport-bottom.png) | [顶部](menu-responsive/edge-150-css-viewport-top.png) / [底部](menu-responsive/edge-150-css-viewport-bottom.png) |
| 800×450 | [顶部](menu-responsive/chrome-200-css-viewport-top.png) / [底部](menu-responsive/chrome-200-css-viewport-bottom.png) | [顶部](menu-responsive/edge-200-css-viewport-top.png) / [底部](menu-responsive/edge-200-css-viewport-bottom.png) |

探针使用软件WebGL，自动化并行负载曾导致READY等待12秒超时；之后提高测试等待预算，未改游戏计时、数值或玩法。另修正探针对暂停时已隐藏HUD读取空盒的错误。装饰伪元素溢出与原生details收起内容不作为可见文字裁切判断；可见名称／立绘仍独立核对矩形。以上为探针修正，不掩盖游戏功能错误。软件GPU结果不用于硬件FPS结论。

### 额外控制台与恢复检查

- 新实例再次验证双阵营ESC→继续游戏→再次ESC→返回首页，两浏览器均通过，未处理JS异常0。原始控制台记录保留在 `docs/verification/menu-responsive/console.json`（本机证据），没有宣称控制台零错误。
- Chrome／Edge均记录到现有 `/favicon.ico` 404（各2条）。项目没有对应图标，本轮未修改 `index.html` 或新增图标资产；不影响菜单功能，未扩大范围处理。
- 强制SwiftShader的软件Edge额外记录2条 `MeshDepthMaterial / VALIDATE_STATUS false` 着色器错误。未屏蔽日志或更改渲染器／模型／阴影设置。
- 随后新建不强制SwiftShader的Edge，明确导航相同URL，实际renderer为RTX4060／Direct3D11，双阵营进入、暂停、返回复测通过，未再记录着色器错误，仅有favicon404。证据：`docs/verification/menu-responsive/edge-render-diagnostic.json`（本机证据）。这只是一次硬件后端复核，不代表软件后端问题已修复，也不是FPS测量。

## 自动化检查与保护

- `npm test`：878/878，失败0、取消0、跳过0（原874项＋4项菜单回归）。
- `npx tsc --noEmit`：独立执行通过。
- `npm run build`：通过，保留既有大于500kB的chunk建议告警。
- `git diff --check`：通过；CRLF转换提示不是空白错误。
- 相关菜单回归单独重跑：9/9，失败／跳过0。
- 对任务开始时226个源码、测试、脚本、配置及正式v6资源做SHA-256对照；仅本轮预期的7个既有源码／样式文件变化，没有额外玩法、地图、模型或依赖变化。新增样式和4项测试单列。日志历史前缀核对不变，见 `docs/verification/menu-responsive/protection.json`（本机证据）。

## 修改文件

- `src/faction-menu.css`：唯一菜单布局、卡内分区、响应式、声音槽位和制作信息样式。
- `src/style.css`、`src/industrial-ui.css`、`src/s13-ui.css`、`src/game-ui.css`：移除旧菜单覆盖，保留其他系统规则。
- `src/main.ts`：导入菜单样式。
- `src/three/GameUiLayout.ts`：标题栏及卡内正常流结构。
- `src/three/ThreeGame.ts`：仅更改首页声音设置父容器一处接线。
- `tests/menu-responsive.test.mjs`：4项结构／唯一样式归属／滚动重排／共享声音节点接线回归；真实布局由上面的浏览器检查补足。
- 本报告、`docs/verification/UI_REFRESH_REPORT.md`后续说明、`docs/DEEPSEEK_HANDOFF.md`当前摘要、`docs/AGENT_LOG.md`末尾追加；截图／盒数据在 `docs/verification/menu-responsive/`。

## 待人工验收与限制

- 在用户自己的Chrome与Edge执行原生90%、100%、110%、125%、150%、175%、200%缩放，核对系统字体、DPI和视觉偏好；本轮不宣称该项已通过。
- 最窄已自动检查320 CSS px；更窄或极矮窗口不保证一屏展示。竖向滚动是明确设计，不是要求把所有内容挤到一屏。
- 浏览器键鼠交互通过不代表真人整局、平衡或主观试听验收。其他系统既有待验收状态不变。
- 本轮未重做PulseLock玩法专项试玩；相关规则／接线未改，全量自动化回归保留。共享CSS拆分保留其选择器成员，没有以菜单规则覆盖它。
- favicon缺失与软件Edge的着色器日志仍如上记录；没有为菜单修复擅自调整3D渲染或新增资产。
- 未暂存、commit、push或Tag，未标记阶段Gate=PASS。
