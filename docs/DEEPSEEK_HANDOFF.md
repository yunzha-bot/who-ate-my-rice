# DeepSeek Harness 项目交接

本文件是**当前开发状态与交接信息的唯一主要入口**：当前阶段、待办事项、授权状态、当前测试基线、近期问题与下一步计划都在这里。长期规则在 `AGENTS.md`；按时间追加的历史开发日志（每轮完成情况、测试结果、用户验收、BUG 记录、Git 归档信息）在 `docs/AGENT_LOG.md`（**历史细节以日志为准，本文件只保留当前状态摘要**）；数值索引在 `docs/GAME_BALANCE_CONFIG.md`；阶段专有参数、技术决策与验收要求见对应阶段设计文档。不要将本快照当作替代这些资料的唯一来源。

## 1. 项目概况

《谁吃了我的米》是双阵营单机追逐游戏：DeepSeek 娘尝试吃完每局随机激活的 5 份米；Human 通过抓捕赢得对局。玩家可选择任一阵营。现有玩法包括门、冲刺、米堆、抓捕、双向感知及两套按阵营启用的 AI。

- 主工程：Web / Three.js 3D 灰盒 Alpha，面向桌面 Chrome / Edge。
- 技术：Vite、TypeScript、Three.js、原生 HTML / CSS；Phaser 不属于运行时技术栈。
- 启动：`npm install`（仅新环境需要），`npm run dev`——根目录 `vite.config.ts` 固定 `host 127.0.0.1` / `port 5173` / `strictPort: true`，端口被占用时直接报错退出而不是静默换端口；网址固定 `http://127.0.0.1:5173/`（用 IP，不要用 `localhost`）。
- 检查：`npm test`、`npm run build`、`git diff --check`；`npm run build` 执行 `tsc --noEmit && vite build`。本轮实测主 JS 为 838.33 kB（gzip 223.33 kB）；大于 500 kB 的 Vite 提示非阻断。
- 正式设计的大米时长为 60 秒；当前开发配置从 `GAME_CONFIG` 的开发/正式模式选择，当前开发测试值为 5 秒。发布前须切回正式值并重新验收。

根目录的主要结构：

| 路径 | 职责 |
|---|---|
| `src/main.ts` | 查找 `#app`，载入 CSS 并创建 `ThreeGame`。 |
| `src/three/` | 场景、主循环、相机、输入接线、碰撞、Door/Rice/View、DEV 面板。 |
| `src/three/map/` | 公寓地图数据和场景构建。 |
| `src/systems/` | AI 控制器及 Rice、Door、Navigation、Perception、Sprint、Match 等玩法系统。 |
| `src/config/gameConfig.ts` | 唯一游戏可调数值来源 `GAME_CONFIG`。 |
| `tests/` | Node 内建测试运行器的逻辑、集成及回归测试。 |
| `docs/` | 阶段历史、地图和数值规格、AI 状态树、交接材料。 |
| `public/` | 浏览器静态资源。 |

## 2. Git 与资料边界

本次归档快照的 Git 边界：当前目录是指定 Web 主仓库，分支 `main`，远端为 `origin`。HEAD、远端同步状态及最近提交均以 `git status`、`git log -1`、`git rev-list --left-right --count origin/main...HEAD` 查询，不在此写当前 SHA。DEV-B 已完成批准范围并通过 6 项浏览器人工验收；本轮归档提交标题为 `feat: complete dev-b runtime ai debugging tools`。阶段历史与旧检查点见 `docs/AGENT_LOG.md`。`.trae/` 与 `.dsh-meow/` 是用户资料，必须保留，不得读取、暂存或提交。

本文件更新于 2026-09-26 的纯文档同步轮；该轮已作为检查点 `e1829c92ef3c3f428c0ab52592a7e6a9093d413f`（`docs: sync stage gates and long-term preconditions to checkpoint 3191bec`，5 个文档文件）提交并推送 `origin/main`。如需确认最新状态，仍以 `git log` / `git status` 为准。另有始终未跟踪的 `.trae/` 与 `.dsh-meow/` 用户资料，**必须保留，不得提交、不得读取、不得暂存**。

`dist/` 是可再生成的构建产物，`node_modules/` 是安装目录；二者不提交。不要把导出的临时 AI JSON 日志、密钥、个人配置或本机专属配置加入仓库。不要手工改写 `.git/` 历史。并行的 UE 工程不属于此 Web 仓库任务，不得由本次交接触碰。

**全项目通用开发规则与执行规范**（`AGENTS.md` 的长期规则章节，含 Git 基线与工作区保护、开发阶段授权、测试与人工验收、开发环境、已验收功能保护、Git 归档与提交报告、文档维护，以及「阶段专属开工要求不保存在 `AGENTS.md`；开始任一阶段前须先读该阶段设计文档并逐项确认其中的待批准项」这一规定）已整节收录在 `AGENTS.md`，**本文件不重复复制整套规则**，只在此引用；两者冲突时以 `AGENTS.md` 为准。

当前授权状态：DEV-B 已完成批准范围、人工验收通过并归档；其任何后续扩展仍需单独授权。S7C-1B、S7C-2、S7C-2b、S7C-3 尚未授权；S7B 与 S7C 整体均未完成。DEV-A 的未实施范围仅包括刻意未做的 JSON 导入器与尚未决定的进入/退出锚点拆分。

## 3. 实际运行架构

1. `src/main.ts` 创建 `ThreeGame`。`src/three/ThreeGame.ts` 初始化 Three.js Scene / Renderer / OrthographicCamera、白模地图、角色、门和米视图，负责每帧调度及 HTML HUD。
2. `ThreeGame` 将玩家正式阵营、临时输入目标、AI 输入、碰撞移动和状态结果接到各系统。AI 仅在相应正式玩家阵营时运行；暂停、结算、另一角色的开发临时接管期间不夺取控制。
3. `src/systems/HumanAIController.ts` 实现 Human 的巡逻、调查、追逐、抓捕、搜索及门决策；`CHECK_HIDE` 是为后续藏身检查保留的状态，正式藏身玩法尚未实现。
4. `src/systems/DeepSeekAIController.ts` 实现 DeepSeek 找米、进食意图、威胁回避、好奇和安全通行、SAFE_WAIT 及本次条件关门。它只接收当前系统提供的视觉、声音、Last Seen 和独立 Human 静止信息，不应增加隔墙读取 Human 实时位置的逻辑。
5. `src/systems/NavigationSystem.ts` 提供共用 XZ 网格 A*，查询 `DoorState`、静态碰撞和可选避让区。最终角色移动仍走 `CollisionWorld`，禁止由 AI 瞬移或绕过实体碰撞。
6. `src/systems/DoorSystem.ts` 是门状态唯一来源，支持真实 `OPEN / CLOSED / LOCKED` 状态、toggle、DeepSeek 锁门、Human 解锁/强破与 reset。`ThreeGame.applyDoorResult()` 将门状态同步至 `DoorView`、动态碰撞及门声音。
7. `src/systems/PerceptionSystem.ts` 提供 SoundEvent、距离/墙门遮挡听觉、Vision/LOS、Last Seen、RiceTrace。`HumanStillness.ts` 单独按 Human 实际移动维护静止时长与事件 ID，遮挡不会停止其计时。
8. `src/systems/RiceField.ts` 与 `RiceSystem.ts` 持有大米进度、准备和进食规则；两个阵营的 AI 都不能私建第二套进食计时或直接判胜。`GameStateSystem.ts` 按既有 5/5 米完成及 Human 连续有效抓捕规则裁决胜负；`SprintSystem.ts` 持有冲刺、摔倒和眩晕规则。
9. `src/config/gameConfig.ts` 导出 `GAME_CONFIG`；所有可调玩法参数由此定义，改动时同步 `docs/GAME_BALANCE_CONFIG.md`。地图坐标和状态枚举仍属于相应地图/系统。
10. `src/three/DebugDetailsPanel.ts` 和 `ThreeGame.ts` 展示可收纳 UE Details 风格 DEV 面板。`src/systems/AILogCollector.ts` 以状态快照差异和显式事件记录 AI JSON；面板提供当前局导出。
11. **DEV-B 实时 AI 调试工具**（开发环境专用，接入 DEV 面板，不替换场景编辑器）：`src/systems/RuntimeDebugOverrides.ts`（仅内存的参数覆盖层，38 项白名单）、`src/systems/DevBRuntimeBinding.ts`（半径变化清空抓捕进度、新局清覆盖、有效速度）、`src/systems/DevBObserver.ts`（只读状态整理）、`src/three/DevBView.ts`（抓捕圈 / 视觉距离圆 / 真实视线 / AI 路径 / 声音事件）、`src/three/DevBPanel.ts` + `src/three/DevBDebug.ts`（面板与编排）。感知与两套 AI 通过可选 `SoundTuning` / `OcclusionTuning` / `VisionTuning` / `setRuntimeTuning()` 读取有效值；正式 `GAME_CONFIG` 始终只读。

## 4. 阶段进度

| 阶段 | 当前记录 |
|---|---|
| S0 | `AGENTS.md` / 历史日志没有独立 S0 Gate 记录；不推断其验收。 |
| S1 / S2 / S3 / S4 / S4.5 / S5 | 均已完成：S1 最小运行工程 `v0.0.1`、S2 一房一米 `v0.0.2`、S3 最小完整对局 `v0.0.3`（Gate = PASS）、S4 追逐原型 `v0.0.4`（Gate = PASS）、S4.5 Three.js 3D 技术迁移 `v0.0.5-tech3d`（Gate = PASS）、S5 完整 3D 灰盒地图 `v0.1.0-alpha`（Gate = PASS）；细节见 `docs/AGENT_LOG.md` 与 `docs/MAP_SPEC.md`。 |
| S6A–S6D / S6 Alpha | 已完成并封版（S6 里程碑 `v0.2.0-alpha` 以实际推送结果为准）；S6D 声音、Vision、Last Seen、米痕和控制观察者切换经过验收。 |
| S7A | Human AI、共享角色动作接口、高级决策和可收纳 DEV 面板已通过 Gate。**Human AI 移动倍率 0.92 与自动解锁耗时 8,750 ms 暂按用户决定接受**，自动解锁速度留到 S16 平衡阶段复评。 |
| S7B-1 | DeepSeek 自主选米、寻路、开普通门、吃完五份米；用户确认人工验收 PASS。 |
| S7B-2 | 威胁感知、逃跑、脱险恢复及静止 Human 好奇/安全通行专项通过用户人工验收。偶发原地停留仍是优化待办。 |
| S7B-3A | 主动关门（条件式逃脱关门）：用户 5/5 浏览器人工验收 PASS。 |
| S7B-3B | 主动锁门与逃脱策略：3B-0b 接口、3B-1 决策核心（含「关门遮挡视线」冲突修复 = 关门侧向证据）、Sprint 30 秒冷却与冲刺期间门交互协调、3B-2 防振荡（用户 5/5 人工验收 PASS）、3B-3 定向回归、3B-4 DEV / 日志 / 文档收尾——**全部完成并已并入检查点 `6a92c5d`**。 |
| S7B overall | 进行中，未完成（S7B-1 ～ 3B-4 均已通过人工验收）。 |
| S7C-1A | 藏身点白模与地图配置：8 条 `HideSpot` 数据 + 2 个纸箱 `FURNITURE`，**未接入任何玩法**。**用户浏览器人工验收 PASS（2026-09-26）、阶段 Gate = PASS**，已并入稳定检查点 `3191bec` 并推送 `origin/main`。 |
| DEV 场景热编辑器 V1 + 双阵营调试冻结 | 独立 DEV 工具轮（不计入 S7C）：`DevFreezeSystem`、`MapEditModel`、`SceneEditorView / SceneEditorPanel / SceneEditor`。**用户浏览器人工验收 PASS（2026-09-26，五项）、阶段 Gate = PASS**，已并入稳定检查点 `3191bec` 并推送 `origin/main`。 |
| DEV-A 第一轮 | 藏身交互区域的数据与几何基础：8 条 `HideSpot.interactionRegion`（床与纸箱圆形 2.0 / 1.2，衣柜与柜架扇形 1.6·55°）、圆形／扇形精确几何、合法位置检查（真实 `CollisionWorld` + 真实 `NavigationSystem` + 瞄准家具可接近表面）、离散采样预览接口、`SceneEditor` 字段透传、13 项新测试、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。**用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，随检查点 `d4462e9` 建立（实际 SHA 以 `git log -1` 查询）。 |
| DEV-A 第二轮 + DEV-A-FIX-1 | 区域编辑器：可编辑区域半径／扇形半角（`REGION_AUTHORING_LIMITS` 半径 0.5–3、半角 10–150°）、家具移动或旋转时锚点跟随、区域类校验拒绝码、JSON 导出升为 **V2**、DEV 面板「交互区域预览」开关 + 按 `code` 着色的离散采样点与图例（精确轮廓与离散采样分开呈现）；以及**流畅拖动**（延迟校验窗口 `beginDeferredValidation` + 释放时校验一次、预览对象长期复用）。**用户浏览器人工验收：第二轮区域编辑／预览／校验／JSON V2 及旧功能回归全部通过；FIX-1 流畅拖动 5/5 PASS；阶段 Gate = PASS**，随本轮提交建立检查点。**阶段 Gate = PASS**，随本轮提交建立检查点。 |
| DEV-A-FIX-2 | 家具任意角度旋转与 JSON **V3** 导出：`Rect.rotation` + `RotatedRect.ts` 统一旋转几何（约定同 `THREE.Object3D.rotation.y`）、`CollisionWorld` 的 `OrientedObstacle` 真实旋转碰撞（包围 AABB 仅粗筛、轴对齐路径数学逐字未改）、`rotationQuarter`→`rotationDeg`（0°–359.9°）与可关闭的 15° 吸附（默认关闭、不进 JSON）、房间边界改为四角点均在房间内、家具重叠改为真实 SAT、门洞改为与膨胀门叶真实重叠、关联锚点与 `facing` 同步旋转、编辑器/导航/遮挡全部改用真实旋转轮廓。**用户浏览器人工验收 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，随本轮提交建立检查点。**DEV-A 已批准范围至此全部完成**；未完成的 DEV-A 相关项只有 JSON 导入器（刻意未开发）与进入/退出锚点拆分（未决定）。 |
| DEV-B（实时 AI 调试工具） | 已完成批准范围并经用户浏览器人工验收 6/6 通过。最终验证：`npm test` 472/472、`npx tsc --noEmit` 通过、`npm run build` 通过、`git diff --check` 通过。38 项临时参数仅在内存中生效，正式 `GAME_CONFIG` 不变；完整功能、限制与测试清单见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`，历史见 `docs/AGENT_LOG.md`。|
| 下一项 | S7C-1B（玩家基础藏身交互）尚未授权、未开始；开工前须逐条确认 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 的待批准参数。S7C-2 / 2b / 3 同样未授权；DEV-B 后续扩展需单独授权。|
| S7C 后续 | S7C-1B / 2 / 2b / 3 尚未授权；Human `CHECK_HIDE` 仍只是保留接口。 |

历史细节与测试结果以 `docs/AGENT_LOG.md` 为准；不要把单项 PASS 扩大解释为 S7B Gate PASS。

## 5. DeepSeek AI 当前行为

### 状态及优先级

实际状态来自 `DeepSeekAIState`：

`SEEK_RICE / MOVE_TO_RICE / EAT / RESELECT / EVADE / RECOVER / SAFE_WAIT / CURIOUS_APPROACH / CURIOUS_OBSERVE / CURIOUS_PASSAGE`。

状态机每帧先吸收 Human 静止变化、门状态和感知；真实移动、追捕型危险声音、眩晕、已有抓捕进度或安全距离被突破可打断好奇/通行。获准且仍安全的静止试探会将普通视觉/非追捕声音降为 caution，避免旧逃跑优先级无条件抢占。明确高威胁会进入 `EVADE`；`SAFE_WAIT` 有独立重查及紧急危险退出；逃跑满足安全距离和观察条件后进入可移动的 `RECOVER`，继而回到找米。其余时候选米、移动、调用既有进食更新。

### 找米、进食和威胁

- 玩家正式控制 Human 时 DeepSeek AI 才运行；玩家正式控制 DeepSeek、DEV 临时控制 DeepSeek 或调试移动接管时不抢输入。
- 对未完成 Active Rice 按共享 A* 路程换算移动时间，再加剩余进度及 0.4 秒准备时间评分；目标不可达或卡路时重选。普通 CLOSED 门可使用已有交互开启，LOCKED 门阻挡路径。
- EAT 仅提交现有米系统意图，进度持久保留、中断、米痕声音和胜负仍由对应系统决定。五份 Active Rice 完成才触发 DeepSeek 胜利。
- 直接目视 Human 时用当前坐标及既定视距评估威胁；听声按现有距离、事件强度和遮挡，普通门操作声不等同追捕型声音；Last Seen 只在配置有效窗口内作为记忆。声音方向只投影到八方向，不以声事件坐标当隐藏实时目标。
- Human 静止由 `HumanStillness` 维护，不依赖 DeepSeek 持续视线。合格静止事件的好奇判定只抽一次；好奇接近、观察及通行路线必须满足抓捕圈外半径。真实移动、逼近、冲刺、抓捕危险可立即取消。
- `SAFE_WAIT` 对重复危险米堆入口实施有限等待和路线复查；不得回到周期性无条件冲门。静止 Human 附近有可行安全路线时，复用观察及避让规划；没有安全路就继续等待。

### S7B-3A 条件关门

关门只在 `EVADE` 的逃跑决策中检查，不返回远门。控制器跟踪 DeepSeek 穿过 OPEN 门叶的实际侧向变化，并只在 1,800 ms 窗口内评估近门。需要：当前目视确认 Human 位于门另一侧；Human 距离不少于 1.5 世界单位；门可交互且未被角色占据；门后 A* 路线存在且屏蔽该门；Human 到逃跑目标的当前路径确实使用该门。通过检查后发出一次关闭命令，ThreeGame 重新检查距离、交互和门叶占用，再调用 `DoorSystem.toggle(id, 'DEEPSEEK')` 并同步视图、碰撞和声音。关闭结果和失败均触发每门 5,000 ms 冷却，Human 重开后 AI 不会马上原地振荡。没有可信当前视线时 Human 方位显示未知并跳过。该功能没有新增主动锁门。

实际可调参数在 `GAME_CONFIG.deepseekAI`：

| 变量 | 当前值 | 单位 | 用途 |
|---|---:|---|---|
| `doorEscapeMinHumanDistance` | 1.5 | 世界单位 | 关门时与可见 Human 的最低距离。 |
| `doorEscapeCrossingWindowMs` | 1,800 | 毫秒 | 实际通过门后可评估的期限。 |
| `doorEscapeCooldownMs` | 5,000 | 毫秒 | 关门成功或失败后，同门重试冷却。 |

DEV 分类显示候选门、距离、通过标记、Human 是否在另一侧（未知时不透视）、关后逃生路线、决策/收益依据、最近结果、跳过原因和冷却。AI JSON 事件为 `DOOR_ESCAPE_EVALUATE`、`DOOR_ESCAPE_CLOSE`、`DOOR_ESCAPE_SKIP`、`DOOR_ESCAPE_FAILED`；相同理由不逐帧重复加入事件。

用户提供的人工验收 5/5：正常追逐穿门关门后继续逃跑；Human 同侧跳过；Human 过近跳过；关门会封唯一退路时放弃；Human 重新开门后不原地振荡。它是本次交接采用的已确认历史结果，不是本次代理重新执行的浏览器交互结果。

## 6. S7B-3B 主动锁门与逃脱策略（已完成）

用户验收与归档记录见 §4 和 `docs/AGENT_LOG.md`。锁门、侧向证据、冲刺协调、防振荡及测试细节见 `docs/S7B3B_DOOR_LOCK_DESIGN.md`；后续修改须保留 §7 的回归边界。

## 7. 必须避免的回归

- 静止 Human 附近的米堆不能恢复成“只因看见就逃跑”；已符合安全条件的好奇/安全通行不能被普通视觉警戒无故覆盖。
- SAFE_WAIT 不能每隔约 3 秒重复冲门；不安全的目标和路线须等待或换可行米堆。
- 所有获准的安全观察与通行路径需保持在真实抓捕半径和余量之外；AI 不获得抓捕免疫。
- EVADE 关门不得在危险距离停下、封死自己唯一退路、跑回远门或对同门反复开关。
- 声音和 Last Seen 只能提供已有系统授予的信息；墙后不能读取 Human 实时位置。
- 玩家主控、临时控制、暂停和重开不能被 AI 抢占或遗留冷却/路径状态。
- 动画表现单向读取玩法结果；不能反向改变速度、碰撞、进食、抓捕或 AI 决策。
- 保留手动调过的 `GAME_CONFIG` 参数；不要为了新功能改已验收的 Rice、Sprint、Capture、S6 或 S7A 数值。

## 8. 开发及验收流程

1. 先读 `AGENTS.md`、`docs/AGENT_LOG.md` 最近相关记录、`docs/GAME_BALANCE_CONFIG.md` 及当前系统接口。检查分支、status、已有提交；保留用户未提交资料。
2. 运行开发预览：`npm run dev`（根目录 `vite.config.ts` 固定 `http://127.0.0.1:5173/`，端口被占用时直接报错而不是换端口），人工测试后导出 DEV 面板工具栏中的本局 AI JSON。导出文件是诊断产物，默认不入库。
3. S7B 控制器与相关回归重点：`tests/deepseek-ai.test.mjs`、`tests/deepseek-evade.test.mjs`、`tests/deepseek-curiosity.test.mjs`、`tests/deepseek-curiosity-priority.test.mjs`、`tests/deepseek-passage.test.mjs`、`tests/deepseek-safe-wait.test.mjs`、`tests/deepseek-safety-regression.test.mjs`、`tests/deepseek-door-escape.test.mjs`、`tests/door-system.test.mjs`、`tests/navigation.test.mjs`、`tests/capture-zone.test.mjs`、`tests/ai-log-collector.test.mjs`。
4. 游戏代码改动运行 `npm test`、`npm run build`、`git diff --check`。构建遵守 `AGENTS.md` 的 Vite/EPERM 规则；不以提高警告阈值掩盖失败，不提交 `dist/`。
5. 自动测试不替代人工 Gate。人工通过后按用户指令更新阶段；通常只暂存任务范围内文件，提交前复核 staged 清单，不强推、不重写历史、不删除 `.trae/`。

## 9. 已知事项与未完成问题

- S7B-2 偶发原地停留保留为后续 AI 优化项，不阻断其已通过 Gate。
- 正式 GLB 角色及 IDLE 特殊待机片段未导入；无动画片段时白模保持普通 IDLE，动画视觉验收后续处理。
- Human AI 自动解锁耗时 8,750 ms 按用户决定留作 S16 平衡复评。
- **S7B-3B 的实机日志缺口**：用户验收已通过，但缺少侧向证据修复后的完整 AI JSON；锁门频率等仍应由新日志复核。
- 最近一次已记录的 DEV-B 验证：`npm test` 472/472、`npx tsc --noEmit`、`npm run build`、`git diff --check` 均通过。此为历史基线，不代表本轮重跑。
- 各阶段的测试增量、构建体积和文档变更历史见 `docs/AGENT_LOG.md`。
- 当前状态：S7B 整体仍未完成；S7C 整体仍未完成。S7C-1B 未授权，Human `CHECK_HIDE` 仍为预留接口。DEV-A 已完成批准范围；DEV-B 已通过 6/6 浏览器人工验收并随本轮归档。各阶段细节与旧测试结果见 `docs/AGENT_LOG.md`。

## 10. DEV 场景热编辑器 V1 与双阵营调试冻结（已验收并归档）

独立 DEV 工具，不接入藏身玩法；验收与检查点见 docs/DEV_SCENE_EDITOR_DESIGN.md 和 docs/AGENT_LOG.md。长期保护点：READY 计时与 PLAYING 冻结时间分离；手动冻结与场景编辑冻结可叠加；编辑仅在应用时重建碰撞、导航和门状态；拒绝操作须有可见反馈，DEV 入口不得被覆盖。

## 11. S7C-1A 藏身点地图数据（已验收并归档）

地图含 8 个 HideSpot 和 2 个纸箱，每个藏身点仍只有一个 HideSpot.x/z 锚点，家具通过稳定 ID 关联。DEV-A 区域属于地图创作数据，不接入玩法。正式 HideSystem、按键藏身、Human CHECK_HIDE 与地图随机化均未实现；S7C-1B 及后续阶段尚未授权。地图和阶段方案见 docs/MAP_SPEC.md、docs/S7C_HIDE_RANDOMIZATION_DESIGN.md；区域与编辑器细节见 docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md。

## 12. 待批准提案与专属开工要求（S7C-1B / 2 / 2b / 3 尚未授权；DEV-A、DEV-B 已完成各自批准范围）

> 本节列出尚待批准的阶段开工要求；文档存在不代表获得授权。DEV-A 与 DEV-B 已完成各自批准范围，任何后续扩展仍需单独授权。
>
> DEV-A 与 DEV-B 的**先后顺序属于当前规划，不是不可改变的强制技术依赖**。
>
> **待单独批准（尚未授权）**：S7C-1B → S7C-2 → S7C-2b → S7C-3，以及 DEV-A / DEV-B 的任何后续扩展。

### DEV-A：藏身交互区域与编辑器（已完成批准范围）

- 已完成：交互区域数据与几何、编辑器区域调整和校验、流畅家具拖动、任意角度旋转碰撞及 JSON V3；未接入正式藏身玩法。
- 未完成/未授权：JSON 导入器刻意未开发；是否拆分进入/退出锚点尚未决定；`HideSystem`、按键藏身、Human `CHECK_HIDE` 与地图随机化属于 S7C 后续工作。
- 实现、参数与验收历史见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md` 和 `docs/AGENT_LOG.md`。

### DEV-B：运行时 AI 调试工具（已完成并通过用户人工验收）

- 功能：只读状态观察、38 项白名单临时参数、场景可视化、中文说明与紧凑面板；临时值只存于内存，不写正式 `GAME_CONFIG` 或地图 JSON V3，重开清除，并支持两种恢复。
- 人工验收：6/6 通过。归档验证：`npm test` 472/472、`npx tsc --noEmit` 通过、`npm run build` 通过、`git diff --check` 通过。
- 参数、生效时机、已知限制、测试和人工验收细节见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`；历史步骤见 `docs/AGENT_LOG.md`。正式视觉/听觉仍不使用家具遮挡，视觉规则没有视锥角。

**其他阶段的专属开工要求位置**：S7C-1B / S7C-2 / S7C-2b / S7C-3 → `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（§3.5 前置、§4 S7C-2、§5 S7C-3、§6 第 3–14 项与第 15–18 项待批准参数）；DEV 场景热编辑器（已完成 V1，后续扩展）→ `docs/DEV_SCENE_EDITOR_DESIGN.md`。

## 13. 当前受保护功能清单（已通过 Gate，改动时不得破坏）

> 承接原 `AGENTS.md` 前置条件 9 的具体清单；通用要求见 `AGENTS.md`「全项目通用开发规则与执行规范」的前置条件 9。凡涉及地图、导航、AI 或 DEV 工具的改动都必须保护下列功能；该清单随每个通过 Gate 的阶段扩展。

- S7B-3B 主动锁门和冲刺逻辑（门锁链路、Sprint 30 秒冷却与冲刺期间门交互）；
- S7C-1A 八个藏身点和两个纸箱（**现状不变：单一 anchor**）；
- DEV 场景编辑器 V1（**已验收，不得修改其行为**）；
- `MANUAL_DEV_FREEZE` 和 `SCENE_EDITOR` 双冻结原因；
- READY 阶段独立计时；
- 现有 DEV 调控台及其全部按钮；
- 场景编辑后的碰撞及导航重建流程（`dispose → buildApartment → 新 CollisionWorld + NavigationSystem → rebindNavigation → syncAllDoors`）；
- **DEV-A 第一轮**的区域数据与几何/合法性接口（`HideSpot.interactionRegion` 的已批准参数 2.0 / 1.6·55° / 1.2、`HideInteractionRegion.ts` 的精确几何、瞄准家具可接近表面、离散采样语义——不得擅自改动参数，也不得把离散采样呈现为精确面积）；
- **DEV-A 第二轮 + DEV-A-FIX-1**：区域半径／半角编辑与 `REGION_AUTHORING_LIMITS` 边界、家具移动或旋转时的锚点跟随、JSON **V2** 导出格式、精确轮廓与离散采样分离的 DEV 呈现，以及**拖动延迟校验窗口**（`beginDeferredValidation` / `endDeferredValidation`——不得改回「每帧全量校验」，也不得让任何位置绕过 `apply()` 的正式校验）。
- **DEV-A-FIX-2**：`RotatedRect.ts` 的统一旋转几何与旋转约定（同 `THREE.Object3D.rotation.y`）、`CollisionWorld` 的 `OrientedObstacle` 真实旋转碰撞（**包围 AABB 只能作粗筛，不得当作碰撞形状**）、`rotationDeg` 任意角度与可关闭的 15° 吸附（默认关闭、不进 JSON）、四角点房间边界校验、关联锚点与 `facing` 同步旋转、JSON **V3** 导出格式（`rotationDeg`/`rotationRad`/`collisionShape`/`boundingAabb`/`boundingAabbRole`）。**注意：`MAP_EXPORT_VERSION` 现为 3，V2 的 `collisionAabb` 与 `rotationQuarter` 已作废**——不要在阅读旧文档或旧日志后按 V2 字段名理解当前格式。

两条长期禁令：**新增按钮不得覆盖原 DEV 入口**（入口必须作为 `DebugDetailsPanel.topRow` 的 flex 项，禁止再引入绝对定位覆盖层）；**不得将 READY 计时误接到 PLAYING 冻结时间源**（`readyDelta` 与 `gameplayDelta` 是两个不同的时间缝）。

## 14. 当前灰盒与玩法状态（摘要）

> 承接原 `AGENTS.md` 的同名小节。房间尺寸、门洞、三条环路、家具与出生点坐标见 `docs/MAP_SPEC.md`。

- 住宅 / 公寓式 3D 灰盒地图已完成；旧九宫格布局已废弃。地图包含 10 个主要空间与阳台、衣帽间两个附属空间，并保留三条追逐环路。
- 14 个 `RiceCandidate` 每局无重复随机激活 5 个 Active Rice；每份大米拥有独立持久进度，完成 5 / 5 后 DeepSeek 娘获胜。
- 18 个 `DoorNode` 已升级为正式 Door System；8 个 `HideSpot` 已登记为地图数据（含 2 个新增纸箱 `living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`），`DEBUG_MAP` 下可查看标记；**正式藏身玩法仍未实现**（S7C-1B 未授权）。
- DEV 工具（仅开发环境显示入口）：场景热编辑器 V1 + 双阵营调试冻结（`MANUAL_DEV_FREEZE` / `SCENE_EDITOR`）；生产构建不出现入口与编辑器数据。
- 角色移动保留 Camera-Relative Movement、玩家相机跟随、XZ Circle Footprint、分轴碰撞与 Wall Sliding。
- 单份大米正式设计时长 60 秒；当前开发测试值 5 秒（发布前必须切回 60 秒并重新验收）。

## 15. 当前核心玩法规则索引

交接时遵守的核心边界：AI 只使用系统授予的感知信息，不读取被遮挡对手的实时位置；AI、玩家与动画表现共用既有系统，不绕过碰撞、进食、抓捕或胜负判定。正式玩法数值以 src/config/gameConfig.ts 为唯一来源，参数索引见 docs/GAME_BALANCE_CONFIG.md。

Human/DeepSeek 控制、门锁、声音与视野、米痕、好奇安全通行等详细规则见 AGENTS.md 和对应状态树/阶段设计文档；本交接文件只维护当前状态、授权、已知待办和回归边界。
