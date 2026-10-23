# Esc设置中的键盘自定义 — 2026-10-22

## 使用方式

游戏中按Esc → 设置 → 按键设置。点击某一操作右侧的按键按钮，再按新键；更改立即生效并保存到当前浏览器。已占用的按键提示冲突，不自动覆盖其他操作。等待按键时Esc只取消本次修改，再按Esc返回暂停菜单。可恢复全部默认按键。

用户补充强调原本键位不改：默认仍是WASD/方向键移动、E交互、Q锁门/布网、V抓捕、Space冲刺/强破、F拾取、L开关灯，Esc固定暂停；没有预设G/H/Shift等新默认。这些替代键仅用于独立测试上下文，不写入用户日常浏览器。

可修改四个移动方向、交互/进食/家具搜查、冲刺/强破、锁门/布网、Human扇形抓捕、拾取、开关灯；两阵营复用同一套设置。支持字母、数字、小键盘数字、Space、Enter、左右Shift及常用符号。Esc固定暂停，方向键固定辅助移动；Tab、Ctrl/Alt/系统组合键与功能键保留。鼠标投掷/布网确认以及手机触屏按钮不改。

## 实现边界

- `KeyBindings.ts`：默认映射、键名显示、冲突/存储校验，保存键`who-ate-my-rice/key-bindings-v1`。损坏、缺项、重复或不支持的存储值回退默认；无法写入时当局仍可使用，并在设置中明确提醒下次不会保留。
- `InputManager.ts`：只将真实键盘位置映射为既有逻辑操作码。触屏仍使用原逻辑码，不受改键影响；同操作的键盘/方向键同时按住时独立释放，变更/暂停清空缓存。浏览器组合键及输入框编辑不被玩法键截走。
- `KeyboardSettingsView.ts`：暂停期间捕获新键、重复键/输入法保护、冲突提示/取消、恢复默认、持久化反馈；窗口失焦或离开页面取消捕获，dispose清理监听器。
- `ThreeGame.ts`：复用原Esc设置与声音设置，增加两项设置分类；游戏状态仍由原match负责，不改READY、冷却、速度、碰撞或阵营规则。
- `AlphaHudView.ts`、`ControlsHelpView.ts`、`RoomLightView.ts`、`PulseLockView.ts`和正式提示文案显示当前真实按键。旧默认键在改绑后不再触发该操作；手机文案保持原操作名称。
- `game-ui.css`：新增面板内列表/分类按钮样式，复用原纸张配色与暂停面板，列表可滚动、可键盘聚焦。未改开屏与HUD主题。

键盘偏好属于输入配置，不是玩法数值，不写入GAME_CONFIG。不新增依赖。

## 本轮验证

新增`tests/key-bindings.test.mjs`六项：默认/保留键/冲突、旧键失效及腾出键复用、存储回读与异常回退、存储不可用、提示替换、真实InputManager键盘/触屏/方向键/释放/清空/组合键和输入框行为。相关输入/操作说明/门/灯定向57项通过；最终全量结果以本轮AGENT_LOG为准。

`scripts/verify-keybindings.mjs`在Chrome/Edge独立临时浏览器上下文验证：Esc真实入口、冲突不覆盖、取消/保留键、七项改绑、保存/刷新回读、恢复默认、两阵营自定义HUD和操作说明、旧E不生效/新G按住、T方向、B真实扇形释放、H真实布网、Shift真实DP冲刺。没有读写用户日常浏览器配置。[结果](results.json)

- [Chrome按键设置](chrome-settings.png) / [Edge按键设置](msedge-settings.png)
- [Human自定义技能栏](chrome-human-custom-hud.png)
- [DeepSeek自定义技能栏](chrome-deepseek-custom-hud.png)

既有`verify-mobile-controls.mjs`回归：Chrome/Edge两种横屏尺寸×双阵营共8项触屏流程，加2项桌面默认E/鼠标投掷流程，共10/10通过；[记录](mobile-regression/results.json)。这些是桌面浏览器触屏模拟，不冒充手机真机。

独立tsc与生产构建通过，保留既有chunk>500kB警告。没有提交、推送或部署；默认dist已更新，dist-tencent未重建。

最终完整npm test：1108/1108，失败/跳过/取消0；独立tsc/build/diff通过。默认键位截图：[Chrome](chrome-default-settings.png)、[Edge](msedge-default-settings.png)。

复验：设置本机PLAYWRIGHT_MODULE，运行`node scripts/verify-keybindings.mjs`；KEY_BINDINGS_ARTIFACT_DIR可指定新目录避免覆盖证据。
