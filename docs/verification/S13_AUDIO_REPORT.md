# S13 音频与反馈验证记录

## 2026-10-16：DeepSeek娘被抓失败音效

- 用户提供 `NOPE.mp3`，原字节复制为 `public/assets/audio/deepseekCaughtDefeat.mp3`，17525字节，SHA-256 `3754fcec7a41785ad41d71decd84ce487257df18973f16e7ac2a13119b34c447`。当前44个事件ID，实际37个Ogg和2个MP3；此前盆命中音及五项停用状态保留，不改任何原音频。
- 在既有 `syncAudio` 的FINISHED阶段切换入口，只有主控DEEPSEEK、未获胜且原结算原因为CAPTURED时，使用新声音替换通用defeat，不叠加两段失败音。Human失败及双方胜利保持原声音，常规抓捕和Q搜查共用原结算原因；不改胜负逻辑。沿用UI音量、Master、静音、自动播放保护和重开清理，不新增AI听觉事件。
- 音频专项13/13，新回归2项验证四种结果选择、连续100次同步不重复、下一次结果可重播，以及静音/暂停/重置。全量943/945、失败2、跳过/取消0；仍为已有 `difficulty.test.mjs:263` NORMAL/20276765固定路线结算及 `throwables.test.mjs:35` throw_closet_1初始距离断言，未改玩法或用户点位迎合测试。独立TypeScript、生产build及diff检查通过，保留大chunk告警。
- Chrome/Edge全新受控实例明确goto4173并核对标题，各自检查双阵营×捕获/吃米结算4组合。结果来自真实GameStateSystem结算方法的内存夹具，不冒充自然整局；实际解码NOPE约1.056秒、双声道，48kHz上下文中非零波形，只有一枚对应AudioBufferSource启动，其他结果音效不变，返回菜单无旧结算短音残留，页面异常和新增资源失败0。原始素材峰值达到1，本轮不擅自处理响度，听感留给用户验收。
- 保护快照329个既有源码/测试/资产文件，仅 `GameAudio.ts`、`ThreeGame.ts`、`tests/game-audio.test.mjs` 获准变化，无文件丢失；原38个音频、地图/道具布局、GAME_CONFIG、难度、AI、模型和手持位置均不变。证据见 [验证摘要](deepseek-caught-audio/verification.json)、[浏览器结果](deepseek-caught-audio/browser.json)、[Chrome](deepseek-caught-audio/chrome-deepseek-caught.png)、[Edge](deepseek-caught-audio/edge-deepseek-caught.png)。
- 4173正式预览已重新构建，刷新可试听；用户输入文件未修改。来源仅确认用户提供，公开分发许可尚未核验，未暂存/commit/push/Tag，不推进Gate。

## 2026-10-15：不锈钢盆命中音效

- 用户提供“钢管 落地.MP3”，直接复制为 `public/assets/audio/basinHit.mp3`，26381字节，SHA-256 `b04405c3f3c9d4546a2d60003879c278d99ae48fcca8c4f2b93433112fdff79d`；原文件不改，未剪辑、重合成或替换其他声音。当前43个事件ID、37个原Ogg加1个新MP3；五项停用事件继续停用。
- `ThrowableSystem.advanceFlights`新增可选真实命中回调，保留原阵营返回值；仅 `kind === BASIN` 在命中当帧调用世界音 `basinHit`，一次飞行只结算一次。不在投出、落空、落地或墙体阻挡时播放该声音，盒子/花瓶命中不使用该文件。原通用倒地音保留。
- 复用GameAudio的SFX/Master/静音、缓存、并发、暂停及重开清理；声音位置取实际接触点，沿用距离/遮挡和信息权限，不产生AI听觉事件。命中文字原先仍写2秒，本轮改为读取现有3000ms配置显示3秒，不改实际眩晕或其他数值。用户自调手持前伸0.60/高度0.55原样保留。
- Chrome/Edge独立受控实例明确goto生产4173并核对标题；双阵营真实鼠标投掷命中、仅一枚实际MP3 AudioBufferSource启动、盒子/花瓶命中不播金属声、盆落空不播、静音阻止节点、暂停清空短音通过。实际解码约1.646秒/双声道，运行上下文48kHz重采样结果有非零波形（峰值约0.312、RMS约0.064），不是仅以HTTP200判断播放。合法位置/敌方场景使用明确夹具，不冒充自然对局或人工试听。
- 新增2项命中/声音回归均通过。相关29项28通过1失败；全量943项941通过2失败：既有 `difficulty.test.mjs:263` 固定路线结算失败，以及 `throwables.test.mjs:35` 当前用户布局中的 `throw_closet_1` 不满足旧初始1.8距离断言。旧几何断言、用户两个布局、AI均未改，不声称全量通过。独立TypeScript/build/diff通过；既有大chunk告警保留。
- 实现/测试文件：`ThrowableSystem.ts`、`GameAudio.ts`、`ThreeGame.ts`、`tests/throwables.test.mjs`、`tests/game-audio.test.mjs`；另新增MP3和必要来源/交接/追加日志及 `basin-hit/` 证据。原37个Ogg哈希均不变。用户提供不等于已核验公开再分发许可，公开上传/商业使用权限仍待确认；本轮仅本地接入，未暂存/commit/push/Tag。最终听感留给用户试听。

## 2026-10-14：用户最终验收与公开归档

用户确认S13主观试听、ESC声音设置与暂停交互验收通过，并授权本次普通commit及push。保留42个事件接口，实际公开37个原创合成Ogg（399664字节）；`step`、`sprintStep`、`sprintStart`、`doorOpen`、`doorClose`继续禁用且无对应文件，不为凑齐42个文件重新生成。下面各轮42文件表及待试听文字为历史状态，以本节为准。

本次发布前重新执行：`npm test`878/878（失败／跳过0）、独立TypeScript、生产build及diff检查均通过，保留既有大chunk建议告警。本轮没有修改游戏功能或音频本身；公开纳入生成脚本、37个Ogg、实现、测试、报告及精选截图，原始诊断JSON／探针留在本机，不作为本次公开资产。归档清单见 [发布审查](S13_RELEASE_REVIEW.md)，Git结果以该标题的正式提交和远端查询核对。

用户试听通过不等于新增硬件FPS统计或所有OS后台场景测量；开发验证方法与限制仍按各节保留，不补造证据。

## 2026-10-13：用户试听后撤回五项音效（当前状态）

用户认为新制作的普通脚步、冲刺脚步、冲刺启动、开门、关门声音均不合适，决定删除。对应五个 Ogg 已删除，`GameAudio` 和世界声音入口均阻止播放及请求；生成脚本不再生成。42 个事件 ID 保留以便将来替换，当前实际音频为 **37 个 Ogg**。其他音效、移动和门的玩法及 AI 感知未改。下方五项播放验证与 42 文件表是撤回前的历史记录，不代表当前状态。

## 2026-10-13：五项音效恢复（已撤回的历史验证）

`step`、`sprintStep`、`sprintStart`、`doorOpen`、`doorClose` 当时用原创合成 Ogg 重新制作并恢复播放。仅运行当时的 `scripts/generate-s13-audio.mjs --foley-only` 生成这五个文件；其余 37 个文件 SHA-256 逐项一致。此节仅记录撤回前的验证。

| 声音 | 新文件大小 | Chrome 实际游戏触发 |
|---|---:|---|
| 普通脚步 `step` | 4598 B | 两阵营 W 移动；玩家源电平 0.8，远处 NPC 源电平 0 时不播放 |
| 冲刺脚步 `sprintStep` | 4194 B | DeepSeek 玩家 W + Space |
| 冲刺启动 `sprintStart` | 4953 B | DeepSeek 玩家按 Space，成功进入冲刺 |
| 开门 `doorOpen` | 6147 B | 两阵营按 E，门 CLOSED → OPEN |
| 关门 `doorClose` | 5420 B | 两阵营按 E，门 OPEN → CLOSED |

受控 Chrome 明确导航 `http://127.0.0.1:5173/`，标题《谁吃了我的米》。两局均实际进入 PLAYING；五项解码后 RMS 大于 0，触发时创建真实 AudioBufferSourceNode。松开 W 后 450ms 内没有新的玩家脚步触发；暂停后 AudioContext 非活动且短音节点数为 0；重新开始后只有当前倒计时短音与一条音乐循环，没有旧脚步或门声残留；页面异常 0。为稳定验证开关门，测试页仅在内存中把主控角色移到远离另一角色的门旁，再用真实 E 键开关；未写入地图或场景存档。Human 阵营没有 DeepSeek 冲刺能力，因此只在 DeepSeek 局测冲刺。测试发现暂停时短音节点可能挂起并在恢复后续播，现已在暂停时停止短音；自动化节点检查不能替代人工听感，Edge 本轮未重测。

五个文件当时由项目脚本确定性合成，无第三方录音；网站与本机 Sonniss 文件仅作参考，素材来源见 `docs/ASSET_PROVENANCE.md`。撤回前 42 个 Ogg Vorbis 合计 **424976 字节**；现已删除其中五个。S13 尚未标记 Gate PASS。

最终自动检查：`npm test` **850/850**、`npx tsc --noEmit`、`npm run build`、`git diff --check` 均退出码 0；构建仍提示已有的 500 kB chunk 警告。Chrome 使用独立页面；本轮没有声称完成 Edge 或人耳试听。

## 最新补充：音效停播、ESC设置与加载界面（2026-10-12）

本节覆盖下方历史验证中脚步、冲刺启动、开关门及独立悬浮设置的旧行为。等待用户集中试玩/试听，不标记Gate PASS。

### 加载页极简化修正（2026-10-12）

- 初版加载页使用了大卡片、多段说明和“先进入菜单”按钮，与参考网页实际观察到的留白式纯色加载页差异明显。后续修正为无卡片的全屏深蓝底，只保留品牌、游戏名、当前阶段、细进度动效和紧凑的资源状态；不再提供正常加载时跳过入口。
- Chrome真实页面截图：[正常加载](s13/chrome-startup-normal.png)、[资源失败](s13/chrome-startup-broken.png)。实际地址 `http://127.0.0.1:5173/`，页面标题《谁吃了我的米》，控制台未见页面异常。正常场景截图显示Three资源处理数3/5、菜单图与音频就绪；加载仍受现有20秒上限保护，缺失资源显示降级状态与重试入口。
- 本次仅调整 `StartupView` 的DOM层级与启动页CSS；不改资源加载、超时、菜单或游戏逻辑。Chrome加载流程回归、故障回退、TypeScript、构建、测试及差异空白检查均通过；没有重复跑Edge，Edge仍以本节后文此前记录为准。
- 结算与暂停界面的九宫格边框、角落点纹、结算装饰条及按钮端片已关闭。首次移除时遗漏了Sheet自带的底色与边框留白，导致透明面板、内容贴边；随后显式恢复暖白底色、34px内容留白与按钮对比度。此前截图还未等待结算立绘解码，不能作为立绘正常的证据。修正后Chrome在实际项目URL以受控结算状态检查胜利、失败和暂停，并验证960/1366/1920px窗口的胜利画面：底色不透明、装饰伪元素为none、立绘已解码。截图：[胜利](s13/chrome-result-corrected-win-1366.png)、[失败](s13/chrome-result-no-sheet-decor.png)、[暂停](s13/chrome-pause-no-sheet-decor.png)。这不是自然整局玩法验收。全量测试848/848、独立TypeScript、生产构建及 `git diff --check` 通过；保留既存的大chunk警告。本次未重复Edge实测。

### 实际参考与采用范围

- Chrome已明确打开并核对[参考小游戏](https://www.bilibili.com/toy/ChtnnVPvxjymK5f9/index.html)，页面标题“企鹅物流-未登记访客”，内嵌游戏来自bilibilitoy.com。首次看到“正在加载场景 / 正在准备场景与角色资源”，没有看到百分比，不能据此声称对方使用真实百分比。
- 实际观察主菜单的场景背景、主操作优先级、中英双层按钮，以及“暂停和设置”打开的集中设置面板、弱化背景、音量滑块和返回入口。点击“了解了”返回菜单；点击“开始潜入”打开难度选择，而不是直接进入对局。
- 本项目借鉴真实加载阶段、集中设置、清晰主操作和轻量淡入。保留既有阵营卡、标题、暖白蓝青材质及Hover反馈，不复制对方资源、源码、品牌、难度玩法或布局。对方Hover的精确动画参数和完整入场/退出动画未测量；未独立观看演示视频，不声称这些细节已复刻。

### 实现与音频清单更正

- `step`、`sprintStep`、`sprintStart`、`doorOpen`、`doorClose`：**暂时停用，等待用户参考素材**。`ThreeGame.playWorld`与`GameAudio.play/loop`均拦截，玩家和NPC共用；保留事件、接口及5个Ogg文件。AI真实声音事件没有删除或修改。
- ESC暂停菜单：继续游戏、设置、重新开始、返回主菜单；设置子页再次ESC先返回暂停页，再次ESC恢复。复用唯一AudioSettingsView/GameAudio状态，五路0–100%原生滑块、百分比、总静音与恢复默认，使用原localStorage键。
- 暂停时仍挂起AudioContext，无声音预览；调整直接更新实际GainNode，恢复后立即按新设置播放。静音只将Master增益归零，不覆盖各路保存值。
- `StartupView`使用Three.js现有DefaultLoadingManager的真实处理项数及图片decode/首批6个Ogg请求状态。动态总项数不是字节百分比，进度条为不定进度装饰，不伪报100%。不创建或等待AudioContext；音频失败也能进入。8秒资源准备超时、20秒总等待上限及失败时重新加载入口；降级后继续使用已有模型加载/程序化回退。没有更换v6或新增模型请求链。
- 新样式仅覆盖暂停态、声音设置和启动层；结算、HUD、阵营卡布局不变；支持减少动态偏好。加载结束淡出250ms，异步资源完成防抖250ms，不强制播放额外启动动画。

### 真实浏览器验证

Chrome154.0.8037.100、Edge151.0.4129.86均独立启动，明确导航`http://127.0.0.1:5173/`，标题“谁吃了我的米”；复用监听12772的项目Vite服务。未使用其他游戏或隔离副本。

| 验证 | 两浏览器结果 |
|---|---|
| 双阵营ESC/子页返回/恢复 | 真实阵营按钮、倒计时、W移动、ESC及设置按钮通过；设置时仍PAUSED |
| 五路键盘调节 | Home后31次ArrowRight，各设置0.31，真实GainNode约0.310000002；未被游戏方向键阻断 |
| 鼠标点击与拖动 | Master点击50%，拖动79%；真实input事件更新设置 |
| 静音/取消 | Master增益0，取消后约0.79；其他各路值保留 |
| 刷新/恢复默认 | 刷新保留0.79/0.31组合；恢复默认0.8/0.45/0.8/0.6/0.25、静音false |
| 指定停用音 | 通过世界入口及管理器直接尝试5种短音与循环，未创建播放节点或循环；两阵营相同 |
| 保留音效 | doorLock、pulseCorrect、eatComplete、capture、click均创建真实播放节点，解码RMS非零；直接入口测试不替代自然整局试听 |
| 重开/返回 | 真实按钮重开并再次返回菜单；等待淡出后仅menu音乐循环，无room/eat残留 |
| 正常加载 | 真实三维资源处理数、图片和音频状态；完成解除inert，菜单可点击 |
| 资源故障 | 所有GLB404、Ogg返回200 HTML时，显示资源不可用与重试入口，安全进入对局；pageerror 0 |
| 慢资源 | v6请求延迟23秒，总等待上限解除加载层，菜单可点击、对局可进入；pageerror 0 |
| 适配 | 1366×768与960×640设置截图无控件遮挡；软件GPU截图不证明硬件FPS |

证据：`docs/verification/s13/chrome-supplement.json`（本机证据）、`docs/verification/s13/edge-supplement.json`（本机证据）、`docs/verification/s13/chrome-startup.json`（本机证据）、`docs/verification/s13/edge-startup.json`（本机证据）。截图`s13/*-supplement-*.png`及`*-startup-*.png`。节点与GainNode检查不是人耳试听；自然整局、真实OS焦点切换和主观混音仍由用户验收。

### 修改范围与门禁

- 源码：`src/main.ts`、`src/three/ThreeGame.ts`、`src/three/GameAudio.ts`、`src/three/AudioSettingsView.ts`；新增`src/three/StartupView.ts`、`src/s13-ui.css`。
- 回归：`tests/game-audio.test.mjs`新增停用入口和恢复默认的2项检查。全量848/848，失败0、跳过0；独立TypeScript、生产构建、diff检查通过；保留已有大chunk警告。
- 文档：本报告、交接与日志；浏览器证据见上。原音频资产未删除或重生成。config、systems、map及角色动画/头发文件无改动，人工排布未写回。
- 未暂存、commit、push或Tag。下一步统一人工验收，不自动进入其他阶段。

---

日期：2026-10-12。状态：自动化与受控浏览器验证完成，等待用户人工试听/试玩；不标记阶段 Gate PASS。无暂存、commit、push 或 Tag。

## 验证方法与证据边界

- 复用项目 Vite 服务 `http://127.0.0.1:5173/`，监听 `127.0.0.1:5173`，进程12772；页面标题《谁吃了我的米》。没有使用之前的无GLB副本或其它端口。
- Playwright Core 在系统临时目录安装，分别启动已安装的 Google Chrome **154.0.8037.100** 和 Microsoft Edge **151.0.4129.86**，使用独立临时浏览器上下文；均重新导航并核对 URL 与标题。
- 浏览器请求拦截仅在测试页面暴露现有 ThreeGame 实例、给解码缓冲区标注 cue；包装原生 `AudioBufferSourceNode.start/stop/ended`，声音仍通过真实 Web Audio 节点连接到输出。记录解码波形 RMS、播放节点、循环和停止，不以 HTTP 200 作为播放依据。
- N：真实按钮/键盘与真实游戏 tick；F：同一真实网页的受控场景夹具，临时移动角色、设置既有状态或推进既有计时，通过实际 ThreeGame / DoorSystem / HideSystem / PulseLockSystem 接线触发。F 不等于手工完整对局验收，不写入地图或配置。
- 软件 GPU 渲染截图后，场景间验证省略重复渲染，但保留游戏 tick、输入和音频。截图单独执行真实 Three.js render。**本轮不据此报告硬件帧率或性能验收通过。**
- 原始记录：`docs/verification/s13/chrome-results.json`（本机证据）、`docs/verification/s13/edge-results.json`（本机证据）；故障/权限/生命周期记录：`docs/verification/s13/chrome-extra.json`（本机证据）、`docs/verification/s13/edge-extra.json`（本机证据）。两浏览器正常场景均无 pageerror。
- 本报告只确认触发、解码、实际播放节点与状态。音色、刺耳程度、节奏、机械重复感、混音主观清晰度及扬声器实际听感由用户验收。

## 逐项事件验收表

以下两浏览器均记录到对应播放节点；例外单独注明。不同 cue 的首次解码完成顺序可能不同，记录顺序不等于同一帧业务调用顺序。

| 项目 | 触发条件 / 方法 | 结果、停止与权限 |
|---|---|---|
| UI Hover | N 首次激活后悬停阵营卡 | hover；90ms冷却、并发1，单元测试覆盖延迟解码时的并发 |
| UI 点击/确认/返回 | N 声音设置、阵营卡、继续、返回 | click / confirm / back；暂停恢复的 click 已复测 |
| 通用错误资源 | A 直接调用现有管理器 | error.ogg可解码/播放；当前业务拒绝使用专用doorFail、pulseWrong、skillUnavailable，通用error没有单独业务入口 |
| 开局 | N DeepSeek完整倒计时；Human F推进READY | countdown、countdownLast、start；补齐首次倒计时音，未改实际时长 |
| 走路/停止 | N DeepSeek W移动并松开；Human N键盘+F单步 | 坐标变化、step；脚步是短音，停止后不创建持续脚步循环 |
| 冲刺/结束 | N DeepSeek方向键+Space | sprintStart、sprintStep，冲刺结束恢复普通脚步；冷却拒绝使用skillUnavailable |
| 吃米开始/持续 | F 将角色放到实际激活米点并持有E、调用真实updatePlaying | eatStart / eatLoop；只在当前米未完成且可听时循环 |
| 吃米中断 | F 松开E、更新玩法 | eatInterrupt，eat循环键移除 |
| 吃完一份 | F 既有时长推进，完成数由0到1 | eatComplete，完成米不再维持eat循环；少量米粒反馈 |
| 开/关门 | F 实际DoorSystem.toggle并applyDoorResult | doorOpen / doorClose；不产生空白反馈气泡 |
| 锁门/操作失败 | F 关闭门、DeepSeek lock，再操作锁门 | doorLock / doorFail；失败仅当前操作者UI声 |
| 解锁成功 | F 完整PulseLock成功并disableLock | doorUnlock；权威门变CLOSED、锁芯DISABLED |
| 解锁失败 | F PulseLock游标未命中 | pulseWrong；门仍锁定，不播放解锁成功声 |
| PulseLock输入/正确/错误/完成 | F open、MISS、三个目标中心press | pulseInput / pulseCorrect / pulseWrong / pulseSuccess；完毕关闭界面，最终门状态正确。同一毫秒的批量fixture输入受25ms限频，未声称每个批量输入都独立播放 |
| 躲藏进入/退出 | F 搜索真实合法交互区域，调用enterHide/exitHide | hideEnter / hideExit；CONCEALED→OUTSIDE，Human阵营不会听到隐藏DeepSeek的行动声 |
| Human搜查落空 | F Human Q真实目标解析 | skill / search；MISS_EMPTY或OUT_OF_RANGE，未结算 |
| Human抓捕命中 | F 按真实朝向放置暴露目标并Q | HIT_VISIBLE，capture / caught，结果HUMAN/CAPTURED；victory为当前Human操作者 |
| 摔倒/眩晕/恢复 | F 既有风险冲刺状态推进至结束与恢复 | fall / stun / recover；未改阈值、时长或动作接口 |
| 技能拒绝/就绪 | F 真实Q冷却拒绝、既有冷却推进 | skillUnavailable / skillReady；只向当前操作者提示 |
| DeepSeek胜利 | F 既有match.advancePlaying完成条件 | victory；eat/room停止，音乐退出 |
| Human失败 | F 当前Human，米完成条件 | defeat；没有把阵营直接当作胜负 |
| 重新开局 | N真点击「再来一局」；F连续重开生命周期 | restart实际播放；旧短音、循环及延迟解码回调清理，重新倒计时 |
| 菜单/对局音乐 | N选阵营并启动 | menu→game；淡入0.55s、淡出0.45s，允许短暂交叉淡化 |
| 追逐音乐 | Chrome N实际可见追逐；两浏览器F可见/不可见状态 | 可见且既有抓捕/CHASE条件才chase；不可见时game，不推断墙后位置 |
| 室内环境 | N PLAYING | room循环；暂停挂起，结算/返回/重开停止，不参与AI听觉 |

## 设置、生命周期及情报边界

| 检查 | 实际结果 |
|---|---|
| 首次交互激活 | 两浏览器首个真实点击后AudioContext=running；未设置绕过手势的autoplay启动参数 |
| 音量与保存 | 五个真实滑块用Home/ArrowRight逐一调至31%，静音复选框实际点击；另测设置接口与刷新保存，实际GainNode约0.310000002，静音Master=0，取消恢复；刷新后五路值及muted=false保持 |
| 暂停/继续 | 真Esc暂停，context停止；真按钮继续，context恢复running，继续点击音实际启动。暂停期间所有音频（包括Hover）静音，为当前实现行为 |
| 系统失焦 | Headless切新页未让document.hasFocus变false，**真实OS失焦/切后台仍待人工**；注入hasFocus=false并派发blur，真实接线将context挂起；恢复focus后running |
| 连续四局 | F重复restart与既有READY推进；淡化结束仅room、game两个存活循环，未残留eat或重复BGM |
| 快速音乐切换 | menu→game→menu后淡化结束仅1个活音乐；另有延迟解码竞态回归测试 |
| 墙体/距离 | 实际墙两侧soundFactor=0.28，传入声级0.2416987769；30单位外level=0；closed/locked/open门复用原PerceptionGeometry，门衰减既有自动化测试通过 |
| 隐藏权限 | Human观察隐藏DeepSeek时新增播放调用0；墙后新增反馈元素0；soundVisual=null，未启用声音圈、方向提示或彩色声纹 |
| HTML假音频 | 将所有音频响应替换为200 HTML；decode失败安全缓存，9个不同请求后进入PLAYING，step重复尝试不产生重复网络请求，播放节点0、pageerror0 |
| 自动播放拒绝 | 注入resume拒绝NotAllowedError；两浏览器仍PLAYING，canvas存在、audio.active=false，无未处理异常；不代表浏览器厂商策略的所有组合已实测 |
| 输出链 | Chrome主总线经Analyser连接真实destination，测得非零RMS；Edge见补充JSON。仅为信号存在证明，不能替代试听 |
| 性能 | 42个小文件缓存，3粒米/次、短生命周期反馈；未完成硬件FPS对比，不宣称帧率验收通过 |

## 42 个事件与撤回前音频文件对应关系（历史清单）

撤回前 42 个文件均在 `public/assets/audio/`，Ogg Vorbis、单声道、源采样22050Hz；浏览器按AudioContext采样率重采样。撤回前总计 **424976字节（约415.02KiB）**；当前删除五个文件后剩 37 个、**399664 字节**。来源为项目原创确定性程序合成，无第三方采样、无模型平台音乐素材；FFmpeg仅用于生成时编码，运行时不需要。音乐与咀嚼等仍是简化合成版本，需用户决定是否未来替换。

| 文件 | 字节 | 默认总线 / 事件 |
|---|---:|---|
| hover.ogg | 3906 | UI 悬停 |
| click.ogg | 4230 | UI 点击 |
| back.ogg | 4372 | UI 返回 |
| confirm.ogg | 4742 | UI 阵营确认 |
| error.ogg | 4611 | UI 通用错误资源，当前无专属业务入口 |
| countdown.ogg | 4182 | UI 倒计时 |
| countdownLast.ogg | 4798 | UI 最后一秒 |
| start.ogg | 5577 | UI 开始 |
| step.ogg | 4598 | SFX 行走；2026-10-13 恢复 |
| sprintStep.ogg | 4194 | SFX 冲刺脚步；2026-10-13 恢复 |
| sprintStart.ogg | 4953 | SFX 冲刺启动；2026-10-13 恢复 |
| eatStart.ogg | 4720 | SFX 开始吃米 |
| eatLoop.ogg | 6474 | SFX 咀嚼循环 |
| eatInterrupt.ogg | 4477 | SFX 进食中断 |
| eatComplete.ogg | 5733 | SFX 一份完成 |
| doorOpen.ogg | 6147 | SFX 开门；2026-10-13 恢复 |
| doorClose.ogg | 5420 | SFX 关门；2026-10-13 恢复 |
| doorLock.ogg | 4445 | SFX 锁门 |
| doorUnlock.ogg | 4909 | SFX 解锁/强破 |
| doorFail.ogg | 4493 | UI 门操作失败 |
| pulseInput.ogg | 3936 | UI PulseLock输入 |
| pulseCorrect.ogg | 4300 | UI 锁芯命中 |
| pulseWrong.ogg | 4576 | UI 锁芯失误 |
| pulseSuccess.ogg | 5518 | UI 完全破解 |
| skill.ogg | 5274 | SFX 技能释放 |
| skillUnavailable.ogg | 4456 | UI 技能拒绝 |
| skillReady.ogg | 4589 | UI 技能/冲刺就绪 |
| hideEnter.ogg | 4891 | SFX 藏身进入 |
| hideExit.ogg | 4953 | SFX 藏身退出 |
| search.ogg | 5501 | SFX 搜查 |
| capture.ogg | 5198 | SFX 抓捕命中 |
| caught.ogg | 5721 | SFX 被抓 |
| fall.ogg | 5900 | SFX 跌倒 |
| stun.ogg | 5105 | SFX 眩晕 |
| recover.ogg | 4762 | SFX 恢复 |
| victory.ogg | 6836 | UI 胜利短音乐 |
| defeat.ogg | 6898 | UI 失败短音乐 |
| restart.ogg | 4834 | UI 重开按钮 |
| menu.ogg | 67497 | BGM 菜单16s循环 |
| game.ogg | 66253 | BGM 普通对局16s循环 |
| chase.ogg | 55990 | BGM 可见追逐12s循环 |
| room.ogg | 45007 | Ambience 室内8s循环 |

默认混音：Master0.8、BGM0.45、SFX0.8、UI0.6、Ambience0.25；音乐节点menu/game0.75、chase0.55；室内节点0.35；自己的世界声0.8，吃米循环0.6。其它角色世界声在11单位内按距离平方衰减并乘现有遮挡系数，无声像方向定位。设置键 `who-ate-my-rice-audio-v1`。未改变AI听觉范围。

## 本轮必要修复与文件

- `src/three/GameAudio.ts`：音乐请求序号防止旧解码复活/叠加；reset停止现有短音；解码后再次检查并发限制；暂停期间解码取消的循环允许恢复后重试；节点ended断开连接。
- `src/three/ThreeGame.ts`：首次倒计时音；继续点击手势内恢复音频后播放；完成米取消咀嚼；不显示NPC全局门反馈或空气泡；新增世界反馈通过现有视线/隐藏检查。
- `src/three/GameFeedback.ts`：离屏世界反馈直接丢弃，避免错误跳到屏幕中央。
- `src/three/AudioSettingsView.ts`：真实键盘验收发现全局方向键preventDefault使音量滑块不能调整；仅在声音设置input上隔离Arrow/Home/End/Space冒泡，保留浏览器原生滑块/复选框行为及Esc入口。
- `src/style.css`：减少动态偏好下新增反馈不再缩放/位移，保留短暂静态提示。
- `tests/game-audio.test.mjs`：新增4项生命周期/竞态回归。原有3项资源/设置/距离测试保留。
- 本报告、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`及`s13/`浏览器JSON/截图。初轮已有生成脚本和42个Ogg仍保留，本轮未重生成素材。

## 门禁与保护检查

| 命令/检查 | 结果 |
|---|---|
| npm test | **846/846**，失败0，跳过0；初轮842，新增4项回归 |
| npx tsc --noEmit | 退出0 |
| npm run build | 退出0；保留现有大于500kB的chunk警告，不据此改架构 |
| git diff --check | 退出0 |
| 玩法/地图/配置 | 对HEAD的config、map、systems、角色动作文件diff为空；110家具/15HideSpot及原人工排布未写回 |
| Git | main保持既有基线；索引为空，无提交、推送或Tag |

## 截图与剩余人工验收

截图为真实浏览器1366×768：[Chrome DeepSeek](s13/chrome-deepseek.png)、[Chrome Human](s13/chrome-human.png)、[Chrome结算](s13/chrome-victory.png)、[Edge DeepSeek](s13/edge-deepseek.png)、[Edge Human](s13/edge-human.png)、[Edge结算](s13/edge-victory.png)。截图证明页面与场景状态，声音证据以节点与波形记录为准。

请用户集中试听两阵营：咀嚼辨识度、门与PulseLock机械感、胜负区分、音乐衔接、重要声是否被盖住、快速UI操作是否刺耳；并手动切到其它应用/后台后恢复、连续自然游玩多局及硬件帧率对比。暂停时Hover静音是现有策略，通用error资源未有单独业务入口。未宣称这些人工项目已通过，也未完成S13归档Gate。
