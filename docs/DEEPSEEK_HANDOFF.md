# DeepSeek Harness 项目交接

本文件是**当前开发状态与交接信息的唯一主要入口**：当前阶段、待办事项、授权状态、当前测试基线、近期问题与下一步计划都在这里。长期规则在 `AGENTS.md`；按时间追加的历史开发日志（每轮完成情况、测试结果、用户验收、BUG 记录、Git 归档信息）在 `docs/AGENT_LOG.md`（**历史细节以日志为准，本文件只保留当前状态摘要**）；数值索引在 `docs/GAME_BALANCE_CONFIG.md`；阶段专有参数、技术决策与验收要求见对应阶段设计文档。不要将本快照当作替代这些资料的唯一来源。

## 1. 项目概况

《谁吃了我的米》是双阵营单机追逐游戏：DeepSeek 娘尝试吃完每局随机激活的 5 份米；Human 通过抓捕赢得对局。玩家可选择任一阵营。现有玩法包括门、冲刺、米堆、抓捕、双向感知及两套按阵营启用的 AI。

- 主工程：Web / Three.js 3D 灰盒 Alpha，面向桌面 Chrome / Edge。
- 技术：Vite、TypeScript、Three.js、原生 HTML / CSS；Phaser 不属于运行时技术栈。
- 启动：`npm install`（仅新环境需要），`npm run dev`——根目录 `vite.config.ts` 固定 `host 127.0.0.1` / `port 5173` / `strictPort: true`，端口被占用时直接报错退出而不是静默换端口；网址固定 `http://127.0.0.1:5173/`（用 IP，不要用 `localhost`）。
- 检查：`npm test`、`npm run build`、`git diff --check`。`build` 执行 `tsc --noEmit && vite build`。当前 >500 kB 的 Vite chunk 警告是已知非阻断事项。
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

本次归档快照的 Git 边界：当前目录是指定 Web 主仓库，分支 `main`，`origin` 为 `https://github.com/yunzha-bot/who-ate-my-rice.git`。**当前 HEAD 以 `main` 的最新提交为准（`git log -1` / `git ls-remote origin refs/heads/main`），本节刻意不写死自身 SHA**；`main` 与 `origin/main` 双向同步、`git rev-list --left-right --count origin/main...HEAD` = `0 0`。最近一次**含阶段内容**的检查点为本轮 **DEV-A 第一轮**提交（`feat: complete dev-a hide region geometry foundation`，8 个文件）——**DEV-A 第一轮（藏身交互区域的数据与几何基础）的阶段 Gate 由该提交承载，实际 SHA 以 `git log -1` 查询**；其下依次为 `3191bec843606ae4bab01d6932cff0ac87955101`（`feat: complete s7c-1a hide spots and dev scene editor v1`，24 个文件，+3976/−71，承载 S7C-1A 与 DEV 场景热编辑器 V1 的阶段 Gate）、`6a92c5d`（S7B-3B）、`ca18f61`；两者之间另有纯文档检查点 `e1829c92ef3c3f428c0ab52592a7e6a9093d413f`、`a889d3c`、`21e5d18`、`0ed2838` 与 `cc86af14ea0d6e062ff30d8a0b1ead113ca7ea6f`（文档职责重构）。`.git/` 下无 `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` 残留。

本文件更新于 2026-09-26 的纯文档同步轮；该轮已作为检查点 `e1829c92ef3c3f428c0ab52592a7e6a9093d413f`（`docs: sync stage gates and long-term preconditions to checkpoint 3191bec`，5 个文档文件）提交并推送 `origin/main`。如需确认最新状态，仍以 `git log` / `git status` 为准。另有始终未跟踪的 `.trae/` 与 `.dsh-meow/` 用户资料，**必须保留，不得提交、不得读取、不得暂存**。

`dist/` 是可再生成的构建产物，`node_modules/` 是安装目录；二者不提交。不要把导出的临时 AI JSON 日志、密钥、个人配置或本机专属配置加入仓库。不要手工改写 `.git/` 历史。并行的 UE 工程不属于此 Web 仓库任务，不得由本次交接触碰。

**全项目通用开发规则与执行规范**（`AGENTS.md` 的长期规则章节，含 Git 基线与工作区保护、开发阶段授权、测试与人工验收、开发环境、已验收功能保护、Git 归档与提交报告、文档维护，以及「阶段专属开工要求不保存在 `AGENTS.md`；开始任一阶段前须先读该阶段设计文档并逐项确认其中的待批准项」这一规定）已整节收录在 `AGENTS.md`，**本文件不重复复制整套规则**，只在此引用；两者冲突时以 `AGENTS.md` 为准。

当前授权状态：S7C-1B 尚未授权，S7C-2 / S7C-2b / S7C-3 同样未授权；**DEV-A 第一轮（藏身交互区域的数据与几何基础）已完成——用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS，并随本轮提交建立检查点（实际 SHA 以 `git log -1` 查询）**；**DEV-A 整体与 DEV-A 第二轮（编辑器编辑、校验、导出、可视化）、DEV-B 均未授权**。任何 WIP 都不代表阶段发布、S7B 整体完成、S7C 整体完成或 S7C-1B 已授权。

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
| DEV-A 第一轮 | 藏身交互区域的数据与几何基础：8 条 `HideSpot.interactionRegion`（床与纸箱圆形 2.0 / 1.2，衣柜与柜架扇形 1.6·55°）、圆形／扇形精确几何、合法位置检查（真实 `CollisionWorld` + 真实 `NavigationSystem` + 瞄准家具可接近表面）、离散采样预览接口、`SceneEditor` 字段透传、13 项新测试、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。**用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，随本轮提交建立检查点。**DEV-A 整体与 DEV-A 第二轮（编辑器编辑/校验/导出/可视化）未授权**；`HideSystem`、按键藏身、Human `CHECK_HIDE`、地图随机化仍未实现。 |
| 下一项 | S7C-1B（玩家基础藏身交互）**尚未授权、未开始**，开工前须逐条确认 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 第 6 节第 3–14 行参数（该设计文档 §3.5 即其开工前置条件）。**DEV-A 第一轮已完成（Gate = PASS）；DEV-A 整体与第二轮、DEV-B 仍未授权**；S7C-2 / 2b / 3 未授权。 |
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

## 6. S7B-3B 主动锁门与逃脱策略（**已完成**，保留开工前的原始约束记录）

> 本节是 3B 开工前写下的范围约束与风险清单。该任务已于 2026-09-24 完成、经用户浏览器人工验收 PASS，并并入检查点 `6a92c5d`；**当前下一项是 S7C-1B（玩家基础藏身交互），需用户单独授权**，且开工前须逐条确认 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 第 6 节第 3–14 行参数。

实现前先明确是否锁门确实能延迟 Human、DeepSeek 是否安全离开门口、锁门是否会封住自身后续路线，以及全局 Active Lock Slot 是否可用。应复用 `DoorSystem.lock(id, 'DEEPSEEK')`、Core 状态、最大锁数和现有门碰撞/导航/感知同步；锁门仍只能作用于允许的 CLOSED Door，LOCKED Door 必须继续阻断角色、抓捕和 LOS。状态变化后重算路径，不能让 AI 计划或通过已经锁住的门。

需特别避免与 S7B-3A 关门冷却、Human 同时开/关门、共享锁位、S6C 锁芯失效和 SAFE_WAIT 复查相互覆盖。不得先假定距离、收益阈值、冷却或锁门优先级的具体数值；如需新增可调值，先按统一数值规则增入 `GAME_CONFIG` 并写入配置表。禁止引入锁门陷阱、AI 透视、复杂团队策略或 S7C 藏身内容，除非后续任务另有明确授权。

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
- 构建的主 JavaScript chunk 约 762 kB，Vite >500 kB 警告非阻断。
- **S7B-3B 的实机验证口径**：3B-1 主动锁门与 3B-2 防振荡已由用户浏览器人工验收 PASS；但**修复后仍缺一份完整实机 AI JSON**（手上日志产生于侧向证据修复之前），锁门频率、`SPRINT_IN_PROGRESS` 是否归零等仍应以新日志复核。
- 自动化基线（DEV-A 第一轮归档后）：`npm test` **383/383 PASS**（DEV-A 第一轮新增 13 项；前一个含阶段内容的检查点 `3191bec` 时为 370/370）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0。
- 文档同步（历史）：`docs/AI_DEEPSEEK_STATE_TREE.md`（删除与源码漂移的重复数值表、补「主动关门与主动锁门」状态机章节）、`docs/GAME_BALANCE_CONFIG.md`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`。
- 当前状态：S7B-3B 已并入检查点 `6a92c5d`；**S7C-1A 与 DEV 场景热编辑器 V1 均已通过用户浏览器人工验收、阶段 Gate = PASS，并已并入含阶段内容的检查点 `3191bec`（24 个文件，已推送 `origin/main`）**。其后仅有纯文档检查点（最新提交始终以 `git log -1` 查询，逐轮归档记录见 `docs/AGENT_LOG.md`）。**DEV-A 第一轮（藏身交互区域的数据与几何基础）已通过用户浏览器人工回归（5/5 PASS，2026-09-26）、阶段 Gate = PASS，并随本轮提交建立检查点**（设计与接口见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`；`npm test` 383/383、`npm run build` 退出码 0、`git diff --check` 退出码 0）。S7C-1B 未授权，Human `CHECK_HIDE` 仍只是保留接口；DEV-A 整体与第二轮、DEV-B 为待批准提案；**S7B 整体与 S7C 整体均仍未完成**。

## 10. DEV 场景热编辑器 V1 与双阵营调试冻结（人工验收 PASS、阶段 Gate = PASS，2026-09-26）

独立 DEV 工具任务，**不接入任何藏身玩法**；入口只在开发环境显示（`sceneEditorEnabled(import.meta.env.DEV, factionSwitchEnabled)`），生产构建不出现。已并入稳定检查点 `3191bec` 并推送 `origin/main`（设计细节与回归复核清单见 `docs/DEV_SCENE_EDITOR_DESIGN.md`）。

- **两个时间缝必须分清**：`DevFreezeSystem.gameplayDelta(phase, dt)`（冻结期间或 `phase !== 'PLAYING'` 返回 0，门控 `updatePlaying`）与 `DevFreezeSystem.readyDelta(deltaMs)`（READY 阶段计时器，**永不被冻结门控**，喂 `advanceReady`）。误把 `gameplayDelta` 喂给 READY 会导致对局永远停在 READY（双方不动、编辑器又因 `NOT_PLAYING` 被拒）。`tick()` 只在 `gameplayMs > 0` 时调用 `updatePlaying`，冻结帧只 `input.clear()`，`clock.getDelta()` 仍每帧读取 → 恢复不跳时间。
- **冻结原因两个可叠加**：`MANUAL_DEV_FREEZE`（DEV「冻结双阵营」按钮）+ `SCENE_EDITOR`（打开编辑器自动冻结），全部解除才回到 `RUNNING`；关闭编辑器只移除 `SCENE_EDITOR`，手动冻结仍在。切换只在 `PLAYING` 允许；编辑期间点「恢复双阵营」被拒绝并给出 `SCENE_EDITOR_ACTIVE`。
- **文件**：`src/systems/DevFreezeSystem.ts`（纯逻辑）、`src/three/map/MapEditModel.ts`（原始 / 草稿 / 已应用三层数据 + 校验 + JSON 导出）、`src/three/SceneEditorView.ts`（Raycaster / 锚点 gizmo / 拖动预览）、`src/three/SceneEditorPanel.ts`（DOM）、`src/three/SceneEditor.ts`（编排）。
- **入口位置纪律**：`DEV ▾` 与「场景编辑」同处 `DebugDetailsPanel.topRow`（`.debug-top-row`）作为 flex 项——**禁止**再用绝对定位覆盖层（曾盖住 `DEV ▾`，使整个 DEV 面板不可达）。打开编辑器时 DEV 面板会整体左移让位，因此**任何缓存的控件坐标在开合前后都会失效**。
- **拒绝必须可见**：纯函数 `sceneEditorRefusalNotice(phase, rejection)` + `.scene-editor-notice`（8 秒自动隐藏）。被拒绝的操作必须有可见反馈；且「面板还在」不等于「点得到」，需用 `elementFromPoint` 证明未被遮挡。
- **热重建路径**：`ThreeGame.rebuildApartment()` = `ApartmentBuild.dispose()` → 用**已应用数据** `buildApartment` → 新 `CollisionWorld` + `NavigationSystem` → 两套 AI `rebindNavigation()` → `syncAllDoors()`。
- **刻意的边界**：家具朝向只支持 0/90/180/270°（AABB 碰撞模型的限制，自由旋转需 OBB 碰撞 + 导航重建）；无撤销 / 重做；已应用编辑只在内存，刷新即回到 `apartmentMap.ts`；`EDIT_LIMITS` 等校验常量**刻意不放进 `GAME_CONFIG`**（灰盒创作约束，不是玩法数值）。
- **DEV-A 第一轮带来的类型补全（编辑器行为不变）**：`HideSpot` 新增 `interactionRegion` 后，`draftSpotsToAnchors()` 改为通过稳定 ID 把该字段**原样透传**（区域数据不进可编辑草稿、不进导出 JSON、不进面板字段），否则场景重建路径拿不到完整 `HideSpot`。编辑器行为、拒绝码与可编辑字段均未改动，既有地图/编辑器测试与新增断言全部通过。
- 已知非阻断项：窗口高度很矮（实测 762×484）时编辑器对象列表与属性区互相挤压，需要内部滚动。

## 11. S7C-1A 藏身点地图数据（人工验收 PASS、阶段 Gate = PASS，2026-09-26）

`HIDE_SPOTS` 共 8 条；`HideSpot` = `MapPoint`（`x/z` 即唯一锚点 = 进入点 = 退出点）+ `kind`（`WARDROBE / BED / SHELF / CARTON`）+ `furnitureId` + `facing`（弧度）+ `label`，家具中心由 `furnitureId` 反查，**不存第二份坐标**。锚点：`hide_main_bed (-14.40,-6.15)`、`hide_second_bed (-14.40,8.90)`、`hide_main_wardrobe (-16.65,-6.60)`、`hide_closet (-3.57,-8.80)`（ID 未改名）、`hide_study_bookshelf (-0.80,11.05)`、`hide_storage_shelf (16.80,-8.75)`、`hide_living_carton (7.00,3.60)`、`hide_storage_carton (16.60,-4.80)`；前 6 条为用户批准的表 3.1 原值，一个坐标都没改。2 个新纸箱 `living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`（0.9×0.9×0.75）只加 `FURNITURE` 数据，复用 `MapBuilder.addObstacle` 建盒 + 静态碰撞 + `DEBUG_MAP` 轮廓。

**藏身玩法仍未实现**：没有 `HideSystem`、没有进入 / 退出藏身键、没有 `VisionSystem` 改动、没有 Human `CHECK_HIDE`、没有地图随机化；`DEBUG_MAP` 标记由纯函数 `hideSpotDebugMarkers(enabled)` 产出，关闭时返回空数组（有测试断言）。S7C-1B 的参数（进入 400 ms、与 Human ≥ 1.5、交互距离 1.0 或 1.3、表现 V1/V2/V3、`HIDE_*` 事件）**仍属建议值，不构成授权**，开工前须逐条批准设计文档第 6 节第 3–14 项。床底不做实心碰撞改动（真钻床底需「床框 + 空洞」专项设计单独批准）。

**DEV-A 与现有锚点数据的关系（2026-09-26 DEV-A 第一轮后更新）**：圆形／扇形藏身交互区域已在 DEV-A 第一轮按用户指定参数落地为**地图创作数据**（`HideSpot.interactionRegion`，见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`），**未接入任何玩法**；**现有单一 anchor 保持不变**——`HideSpot.x/z` 就是唯一的进入点与退出点，上列 8 条锚点数据继续有效、一个都没改。**是否把进入锚点与退出锚点拆成两个独立点，留到未来单独决定**（完整专属开工要求见下方「待批准提案与专属开工要求」节）。

## 12. 待批准提案与专属开工要求（DEV-A / DEV-B，尚未授权）

> 本节承接原 `AGENTS.md`「长期开发路线与全阶段开发前置条件」中属于**具体阶段**的内容（原前置条件 3、4）。**本节的存在不代表批准任何玩法**：S7C-1B、S7C-2、S7C-2b、S7C-3 仍未授权；**DEV-A 第一轮（数据与几何基础）已完成（Gate = PASS），DEV-A 整体与第二轮仍未授权**；DEV-B 未授权。
>
> DEV-A 与 DEV-B 的**先后顺序属于当前规划，不是不可改变的强制技术依赖**。
>
> **待单独批准（尚未授权）**：S7C-1B → S7C-2 → S7C-2b → S7C-3；DEV-A 第二轮 → DEV-B。**DEV-A 第一轮已完成并建立检查点。**

### DEV-A：圆形／扇形藏身交互区域配置、可视化与编辑（**第一轮已完成，Gate = PASS；整体与第二轮未授权**）

> **状态（2026-09-26）**：DEV-A **第一轮「藏身交互区域的数据与几何基础」已完成**——`HideSpot.interactionRegion`（8 条已批准参数）、新增 `src/three/map/HideInteractionRegion.ts`（精确几何 / 合法位置检查 / 离散采样预览 / 纯数据校验）、新增 `tests/hide-interaction-region.test.mjs`（13 项），`npm test` 383/383。**用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，并随本轮提交 `feat: complete dev-a hide region geometry foundation` 建立检查点（实际 SHA 以 `git log -1` 查询）；设计、参数表、接口与验证细节见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。
>
> **第一轮明确不含**：场景编辑器 UI、家具移动后的锚点自动同步、JSON 导出升级、`HideSystem`、按键藏身、Human `CHECK_HIDE`、地图随机化、任何 `GAME_CONFIG` 改动；现有单一 anchor（`HideSpot.x/z` 进入点 = 退出点）语义不变。**DEV-A 第二轮**（编辑器调整半径/角度/朝向、校验与导出、DEV 可视化）与 **DEV-B** 仍**未授权**。

正式开发前必须逐项明确：

1. 哪些家具使用圆形交互范围；
2. 哪些家具使用朝向入口的扇形范围；
3. 圆形及扇形的实际几何判定；
4. 家具旋转后区域如何跟随；
5. 实体碰撞、合法站立区域与交互范围的关系；
6. 进入和退出锚点的独立作用；
7. 场景编辑器如何调整半径、角度及朝向；
8. 改动如何校验和导出。

> **第一轮已回答第 1–6 问**（第 6 问结论：本轮继续保留单一 anchor，不拆分进入/退出点）；**第 7–8 问属第二轮**。逐条结论见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md` §1。

该阶段**只实现交互区域的数据、几何校验、编辑及 DEV 可视化**；没有额外授权，**不得提前实现 `HideSystem`、实际按键藏身或 Human `CHECK_HIDE`**。

**未决设计约束（2026-09-26 记录，同日 DEV-A 第一轮后更新）**：DEV-A 的**圆形／扇形交互区域已在第一轮按用户指定参数落地**（`HideSpot.interactionRegion`：纯数据 + 精确几何 + 合法位置检查接口，**未接入任何玩法**、没有任何系统用它做判定，目前只被 `HideInteractionRegion.ts` 与测试读取）；**现有单一 anchor 仍然不变**——`HideSpot.x/z` 就是唯一的进入点与退出点，8 条锚点数据一个都没改、语义不变。**是否把「进入锚点」与「退出锚点」拆成两个独立点，留到未来单独决定**，本阶段不做拆分、不预留两套字段。

### DEV-B：已有抓捕、视觉、听觉等参数的运行时热更新与实际范围可视化（待批准的独立提案）

- 先审计实际 `GAME_CONFIG` 及现有抓捕、视觉、听觉系统；**只能为真实存在且可安全热更新的参数建立调试控件**。
- 必须明确：原始配置；本局临时覆盖值；参数实际生效入口；重置默认值；导出调试预设；冻结期间的更新行为（与 `MANUAL_DEV_FREEZE` / `SCENE_EDITOR` 的交互）；可视化与实际判定是否一致。
- **不得凭空把复杂听觉传播简化成一个看起来有效但不参与真实判定的半径**；声音的距离、遮挡与方向仍由 `PerceptionSystem` 计算。
- **不得直接修改正式 `GAME_CONFIG` 平衡值**：运行时只做本局临时覆盖，且必须能一键恢复默认。
- **未决设计约束（2026-09-26 记录，只作约束、不开始实现）**：DEV-B 必须把 **`GAME_CONFIG` 原始值**、**本局 DEV 覆盖值**、**运行时实际生效值**三层显式分开——DEV 面板要能同时看出「原始值是什么」「本局覆盖成什么」「此刻实际生效的是哪一层」，任何时刻都能分辨当前生效值的来源。**不得把调试预设直接写回正式平衡配置**（不改 `src/config/gameConfig.ts` 的默认值、不改 `docs/GAME_BALANCE_CONFIG.md` 的记录值），也不得让调试预设成为下一局或刷新后的默认值；本局结束 / 重开 / 刷新后必须回到原始配置。

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
- **DEV-A 第一轮**的区域数据与几何/合法性接口（`HideSpot.interactionRegion` 的已批准参数 2.0 / 1.6·55° / 1.2、`HideInteractionRegion.ts` 的精确几何、瞄准家具可接近表面、离散采样语义——不得擅自改动参数，也不得把离散采样呈现为精确面积）。

两条长期禁令：**新增按钮不得覆盖原 DEV 入口**（入口必须作为 `DebugDetailsPanel.topRow` 的 flex 项，禁止再引入绝对定位覆盖层）；**不得将 READY 计时误接到 PLAYING 冻结时间源**（`readyDelta` 与 `gameplayDelta` 是两个不同的时间缝）。

## 14. 当前灰盒与玩法状态（摘要）

> 承接原 `AGENTS.md` 的同名小节。房间尺寸、门洞、三条环路、家具与出生点坐标见 `docs/MAP_SPEC.md`。

- 住宅 / 公寓式 3D 灰盒地图已完成；旧九宫格布局已废弃。地图包含 10 个主要空间与阳台、衣帽间两个附属空间，并保留三条追逐环路。
- 14 个 `RiceCandidate` 每局无重复随机激活 5 个 Active Rice；每份大米拥有独立持久进度，完成 5 / 5 后 DeepSeek 娘获胜。
- 18 个 `DoorNode` 已升级为正式 Door System；8 个 `HideSpot` 已登记为地图数据（含 2 个新增纸箱 `living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`），`DEBUG_MAP` 下可查看标记；**正式藏身玩法仍未实现**（S7C-1B 未授权）。
- DEV 工具（仅开发环境显示入口）：场景热编辑器 V1 + 双阵营调试冻结（`MANUAL_DEV_FREEZE` / `SCENE_EDITOR`）；生产构建不出现入口与编辑器数据。
- 角色移动保留 Camera-Relative Movement、玩家相机跟随、XZ Circle Footprint、分轴碰撞与 Wall Sliding。
- 单份大米正式设计时长 60 秒；当前开发测试值 5 秒（发布前必须切回 60 秒并重新验收）。

## 15. 当前核心玩法规则摘要（交接用）

> 承接原 `AGENTS.md` 的同名章节。详细数值与实现以 `src/config/gameConfig.ts`、`docs/GAME_BALANCE_CONFIG.md` 及各阶段设计文档为准。

- 可选择 DeepSeek 娘或人类阵营。WASD / 方向键采用 Camera-Relative Movement，所控角色保持在屏幕中央附近；IJKL 暂作另一角色的开发调试控制。
- DeepSeek 娘冲刺不是能量条：有效移动时点击一次技能键，进入固定时长冲刺；开始后不能停下规避风险。全局大米进度低于 30% 时结束安全，达到或超过 30% 时结束必摔，并眩晕约 1 秒。冲刺技能有 30 秒冷却（`GAME_CONFIG.sprint.cooldownMs`）：一旦真正开始冲刺即进入冷却，冲刺进行中不刷新、提前结束也不缩短，冷却期间不能再次冲刺；暂停冻结、重开清零。
- 人类抓捕需要 DeepSeek 娘在 Capture Zone 内连续约 0.35 秒，墙体、家具以及 CLOSED / LOCKED Door 会阻断有效抓捕。
- Door 状态为 `OPEN / CLOSED / LOCKED`。Human 与 DeepSeek 都能开关普通未锁门；DeepSeek 只能锁住 CLOSED Door，不能直接锁 OPEN Door。最多**同时**存在 3 个 Active Lock（不限制整局总次数）；Lock Core 在逻辑和表现上独立于 Door Leaf。
- Human 在可达的 LOCKED Door 旁按 E 打开 4×4 / 3 雷扫雷盘；长按或连点 E 不推进解锁。× / Esc 可退出，同一 Lock Core 的盘面在本局保留；面板开启时世界继续运行，Human 不能移动，Capture Zone 仍有效。扫雷成功使 Core `ACTIVE → DISABLED`、Door `LOCKED → CLOSED` 并释放 Active Lock Slot；Human 需再次 E 开门。失败时门保持 LOCKED、对局继续；扫雷不消耗强破冷却。
- Human 按 Space 可免费快速打开普通 CLOSED Door，即使强破正在冷却也有效；对 LOCKED Door 则立即强破 Core 并 OPEN，触发 30 秒冷却。冷却中不能再强破锁门，但仍可 E 扫雷。DISABLED Core 本局不可重新上锁；Restart 或新 Match 恢复 Core、扫雷盘与技能。门交互采用较宽容的最近有效门判定，不可隔墙操作。
- 角色碰撞与移动的实现约束（Circle Footprint、分轴碰撞、Wall Sliding、不得轻易恢复 Player Box Footprint）见 `AGENTS.md`「通用代码架构约束」。
- 双向信息系统按声音事件的距离和墙/门遮挡计算可听强度，场景中以声源方向显示远蓝、中黄、近红的声波；Vision 区分当前可见、被墙或关门阻挡、超出范围，Last Seen 独立短暂保留。DeepSeek 实际进食增长后开启或刷新 5 秒米痕生成窗口，窗口内移动按步距留下脚印；每个脚印独立保留 15 秒后淡出。暂停冻结相关计时，新局清空米痕。
- Human AI 仅在 DeepSeek 为正式玩家阵营时运行，复用声音、Vision / Last Seen、共享导航、DoorSystem、Capture 和 GameState；DeepSeek AI 仅在 Human 为正式玩家阵营时运行，复用 RiceField 唯一进食更新、共享导航、感知、冲刺和碰撞。AI 不读取被遮挡对手实时坐标；胜负仍由既有米堆及抓捕规则裁决。
- DeepSeek 的主动关门与主动锁门只在 EVADE 中评估，门动作是一次性交互、**不打断冲刺**，因此不会逃避 30% 摔倒惩罚。关门：该门为 OPEN、刚实际穿过（≤ 1800 ms 窗口）、同门 5000 ms 冷却已过、目视确认 Human 在另一侧且距离 ≥ 1.5、未占门叶、关门后仍有不经该门的逃生路线、且追者当前路线确实经过该门。关门会让门叶挡住视线，故在确认关门那一帧记录**侧向证据**；下一帧若重新看见 Human 一律以最新目视为准，若失视则只复用同门、同一次连续动作的证据并重新核验当前条件——该证据不得当作 Human 实时位置，也不作为距离仍然安全的证明。锁门：同一连续动作至多尝试一次，且要求逃生路线与至少一处未完成米堆仍可达、锁位与锁芯可用。逃生规划会排除「本门冷却内由自己关上的门」以防立刻重开，若排除后无任何可达房间则一次性回退允许使用该门，避免原地卡死。实现细节见 `docs/S7B3B_DOOR_LOCK_DESIGN.md`。
- 静止 Human 的好奇试探与 SAFE_WAIT 复查使用独立静止事件、可信感知和抓捕圈外路线。普通目视警戒不得无条件覆盖已获准且仍安全的试探；真实移动、逼近、冲刺或抓捕危险可以中断。SAFE_WAIT 不得循环冲门；不可见 Human 的位置不得用作实时路径或安全许可依据。
