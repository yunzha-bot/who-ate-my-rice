# DeepSeek Harness 项目交接

本文件是按当前源码和本次 Git 检查整理的交接快照。长期规则在 `AGENTS.md`，按时间追加的实现记录在 `docs/AGENT_LOG.md`；数值索引在 `docs/GAME_BALANCE_CONFIG.md`。不要将本快照当作替代这些资料的唯一来源。

## 1. 项目概况

《谁吃了我的米》是双阵营单机追逐游戏：DeepSeek 娘尝试吃完每局随机激活的 5 份米；Human 通过抓捕赢得对局。玩家可选择任一阵营。现有玩法包括门、冲刺、米堆、抓捕、双向感知及两套按阵营启用的 AI。

- 主工程：Web / Three.js 3D 灰盒 Alpha，面向桌面 Chrome / Edge。
- 技术：Vite、TypeScript、Three.js、原生 HTML / CSS；Phaser 不属于运行时技术栈。
- 启动：`npm install`（仅新环境需要），`npm run dev -- --host 127.0.0.1 --port 5174`。
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

本次归档快照的 Git 边界：当前目录是指定 Web 主仓库，分支 `main`，`origin` 为 `https://github.com/yunzha-bot/who-ate-my-rice.git`。**交接时的提交检查点为 `ca18f61b7e7bad35070a3f16188d10f9c8ba426d`（`wip: archive s7b-3a and prepare deepseek handoff`，已推送，`main` 与 `origin/main` 同步）**。此后 S7B-3B 的全部工作（3B-0b 接口、3B-1 决策核心、关门侧向证据修复、Sprint 30 秒冷却与门协调、3B-2 防振荡、3B-3 定向回归、3B-4 收尾）**尚未提交**，仍留在工作区；另有未跟踪的 `.trae/` 与 `.dsh-meow/` 用户资料，必须保留且不得提交。

`dist/` 是可再生成的构建产物，`node_modules/` 是安装目录；二者不提交。不要把导出的临时 AI JSON 日志、密钥、个人配置或本机专属配置加入仓库。不要手工改写 `.git/` 历史。并行的 UE 工程不属于此 Web 仓库任务，不得由本次交接触碰。

本次授权的范围止于「完成 S7B-3B 并准备建立 Git 检查点」；是否 commit / push 由用户批准后决定。WIP 不代表阶段发布或整个 S7B 完成。

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
| S1–S5 | 按 `AGENTS.md` 和日志为已完成，含 Three.js 迁移与 3D 灰盒地图。 |
| S6A–S6D / S6 Alpha | 已完成并封版；S6D 声音、Vision、Last Seen、米痕和控制观察者切换经过验收。 |
| S7A | Human AI、共享角色动作接口、高级决策和可收纳 DEV 面板已通过 Gate。自动解锁耗时 8,750 ms 仍列为 S16 平衡复评。 |
| S7B-1 | DeepSeek 自主选米、寻路、开普通门、吃完五份米；用户确认人工验收 PASS。 |
| S7B-2 | 威胁感知、逃跑、脱险恢复及静止 Human 好奇/安全通行专项通过用户人工验收。偶发原地停留仍是优化待办。 |
| S7B-3A | 主动关门（条件式逃脱关门）：用户 5/5 浏览器人工验收 PASS。 |
| S7B-3B | 主动锁门与逃脱策略：3B-0b 接口、3B-1 决策核心（含「关门遮挡视线」冲突修复 = 关门侧向证据）、Sprint 30 秒冷却与冲刺期间门交互协调、3B-2 防振荡（用户 5/5 人工验收 PASS）、3B-3 定向回归（333/333）、3B-4 DEV / 日志 / 文档收尾——**全部完成**。代码与人工验收均已完成，但**尚未建立 Git 检查点**，故不并入 S7B Gate。 |
| S7B overall | 进行中，未完成（S7B-3A / 3B 已完成，S7C 尚未开始）。 |
| 下一项 | 由用户批准建立 Git 检查点；之后的新阶段（S7C 等）尚未授权。 |
| S7C 及以后 | 尚未开始；`CHECK_HIDE` 只是保留接口。 |

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

## 6. 下一项：S7B-3B 主动锁门与逃脱策略

这是唯一下一项主要任务，本次没有开始。实现前先明确是否锁门确实能延迟 Human、DeepSeek 是否安全离开门口、锁门是否会封住自身后续路线，以及全局 Active Lock Slot 是否可用。应复用 `DoorSystem.lock(id, 'DEEPSEEK')`、Core 状态、最大锁数和现有门碰撞/导航/感知同步；锁门仍只能作用于允许的 CLOSED Door，LOCKED Door 必须继续阻断角色、抓捕和 LOS。状态变化后重算路径，不能让 AI 计划或通过已经锁住的门。

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
2. 运行开发预览：`npm run dev -- --host 127.0.0.1 --port 5174`，人工测试后导出 DEV 面板工具栏中的本局 AI JSON。导出文件是诊断产物，默认不入库。
3. S7B 控制器与相关回归重点：`tests/deepseek-ai.test.mjs`、`tests/deepseek-evade.test.mjs`、`tests/deepseek-curiosity.test.mjs`、`tests/deepseek-curiosity-priority.test.mjs`、`tests/deepseek-passage.test.mjs`、`tests/deepseek-safe-wait.test.mjs`、`tests/deepseek-safety-regression.test.mjs`、`tests/deepseek-door-escape.test.mjs`、`tests/door-system.test.mjs`、`tests/navigation.test.mjs`、`tests/capture-zone.test.mjs`、`tests/ai-log-collector.test.mjs`。
4. 游戏代码改动运行 `npm test`、`npm run build`、`git diff --check`。构建遵守 `AGENTS.md` 的 Vite/EPERM 规则；不以提高警告阈值掩盖失败，不提交 `dist/`。
5. 自动测试不替代人工 Gate。人工通过后按用户指令更新阶段；通常只暂存任务范围内文件，提交前复核 staged 清单，不强推、不重写历史、不删除 `.trae/`。

## 9. 已知事项与未完成问题

- S7B-2 偶发原地停留保留为后续 AI 优化项，不阻断其已通过 Gate。
- 正式 GLB 角色及 IDLE 特殊待机片段未导入；无动画片段时白模保持普通 IDLE，动画视觉验收后续处理。
- Human AI 自动解锁耗时 8,750 ms 按用户决定留作 S16 平衡复评。
- 构建的主 JavaScript chunk 约 705 kB，Vite >500 kB 警告非阻断。
- **S7B-3B 的实机验证口径**：3B-1 主动锁门与 3B-2 防振荡已由用户浏览器人工验收 PASS；但**修复后仍缺一份完整实机 AI JSON**（手上日志产生于侧向证据修复之前），锁门频率、`SPRINT_IN_PROGRESS` 是否归零等仍应以新日志复核。
- 自动化基线：`npm test` 333/333 PASS；`npm run build`（含 `tsc --noEmit`）PASS；`git diff --check` PASS。
- 本轮同步文档：`docs/AI_DEEPSEEK_STATE_TREE.md`（删除已与源码漂移的重复数值表、补「主动关门与主动锁门」状态机章节）、`docs/GAME_BALANCE_CONFIG.md`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`。
- S7B-3B 代码与人工验收已完成；S7C 及之后内容尚未开始，`CHECK_HIDE` 仍只是保留接口。
