# S7D：双阵营完整 Alpha 开发与整局验证

> 本文件是 S7D 阶段的**专项设计与验收文档**。当前状态、授权与阶段进度以
> `docs/DEEPSEEK_HANDOFF.md` 为准；历史追加记录在 `docs/AGENT_LOG.md`；可调数值索引在
> `docs/GAME_BALANCE_CONFIG.md`。本文件只保存 S7D 自己的目标、方法、发现、修复与验收要求。

## 1. 授权与范围（用户原话要点）

本次授权：**完整实施 S7D，单阶段交付、一次集中人工验收**；**不授权 commit、push 或 Tag**。
开发完成后停止，等待用户集中人工验收，**不自动进入 S8**。

核心目标：玩家选 Human 时由 DeepSeek AI 自主完成找米、进食、逃跑、冲刺、关门、锁门与藏身；
玩家选 DeepSeek 娘时由 Human AI 自主巡逻、调查、追逐、搜索、开门或解锁以及检查藏身家具；
两种阵营都必须能从阵营选择、READY、正常游玩推进到正确的胜负结算、重开及返回菜单。
**优先整合和修复已有机制，不新增未经授权的玩法。**

明确禁止：修改已验收的 `GAME_CONFIG` 平衡数值；用 AI 瞬移、读取隐藏实时坐标或取消实际碰撞
来掩盖问题；把自动化模拟写成真人试玩；把人工验收改写成代理自己完成的浏览器测试。

## 2. 开工前核实

### 2.1 Git 基线（实测）

| 项 | 实测值 |
|---|---|
| 分支 | `main`，远端 `origin` |
| HEAD | `b2df4e6ae6497c0d3cfb876e9a14ef253b4c9bc8`（`docs: finalize S7B overall gate`） |
| 远端 `refs/heads/main` | 与 HEAD 相同 |
| `git rev-list --left-right --count origin/main...HEAD` | `0	0` |
| 进行中的合并 / 变基 | 无（`.git/MERGE_HEAD`、`.git/REBASE_HEAD` 均不存在） |
| 已暂存 | 空 |
| 未提交修改 | 仅 `src/three/ThreeGame.ts`（1 行删除） |

与用户给出的开工信息一致：S7B overall Gate 已随 `b2df4e6` 归档，DEV-B 参数常驻随 `c65333c`
归档，玩家声音可视化停用随 `9aafd2e` 归档。**未发现与描述不同的差异。**

### 2.2 `src/three/ThreeGame.ts` 空行差异的真实来源（用户点名要求核实）

结论：**它是上一轮「玩家声音探测可视化停用与代码归档」里精确暂存时引入的，不是 DEV-B 参数
常驻轮或 S7B Gate 文档造成的，也不是本轮的改动。** 证据（全部可复现）：

| 事实 | 命令 / 结果 |
|---|---|
| 差异只有 1 个空行 | `git diff --ignore-blank-lines b2df4e6 -- src/three/ThreeGame.ts` 输出为空 |
| HEAD 有该空行 | `b2df4e6:src/three/ThreeGame.ts` 中第 87 行为空行，第 88 行起是 `PLAYER_SOUND_VISUAL_ENABLED` 的注释块 |
| 停用前没有该空行 | `893296a:src/three/ThreeGame.ts` 中同一位置没有空行 |
| 停用提交里的 blob | `9aafd2e:src/three/ThreeGame.ts` = `42f19eb97b09caf1e861752e90923ddd8023b5e9`，与该轮归档笔记里记录的暂存 blob 完全一致（**即该空行出现在这一版**） |
| 之后的两个提交沿用同一 blob | `c65333c` 与 `b2df4e6` 的该文件均为 `abd0ac9316e99ac481bfdba60c3557856f42ffda`（= `42f19eb9` + DEV-B 持久化接线） |
| 工作区版本 | `31d9404c4c2e2691818413923e381239e5cbbbfa`，字节数 173,795、LF 3,133，比 HEAD 少 1 行 |
| 行尾 | `core.autocrlf=true`、无 `.gitattributes`；HEAD blob 与工作区都是纯 LF，CR=0 |

也就是说：停用轮**为了只暂存本轮差异**，用 `git show HEAD:<path>` + 本轮替换构造了暂存内容，
而那段替换文本在注释块前带了一个分隔空行；工作区文件保持原样（没有该空行）。因此工作区比
HEAD 少一个空行，功能上零影响（注释区间的空白）。

**按用户要求：不重置、不删除、不混入本阶段。** 本轮结束时它仍然是一个未暂存的空白行差异。

### 2.3 阅读与确认

已阅读 `AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md` 近期记录、
`docs/GAME_BALANCE_CONFIG.md`、S7B-3B / S7C 阶段设计文档、`archive/features/player-sound-visual/README.md`，
以及 GameState、两套 AI、Navigation、MatchRandom、Perception、Hide、Sprint、Rice、
`AILogCollector` 与 DEV 工具源码。

## 3. 整局验证方法（两条独立证据腿）

S7D 的整局证据刻意分成两条腿，**任何一条都不许改写成另一条**：

### 3.1 自动化批量腿：无头逻辑仿真

`tests/s7d-match-sim.mjs` 把 `ThreeGame.updatePlaying()` 中与玩法 / AI 有关的通路，用**同一批
生产系统**在 Node 里重放：`CollisionWorld`、`NavigationSystem`、`DoorSystem`、`HumanDoorSkill`、
`PerceptionGeometry` / `SoundEventSystem` / `VisionSystem` / `RiceTraceSystem`、`HideSystem`、
`HumanStillness`、`SprintSystem`、`RiceField`、`GameStateSystem`、`AILogCollector`、两套 AI
控制器，以及**权威的藏身进入 / 退出与家具搜查判定函数**
（`resolveDeepSeekAiHideEntry`、`humanBlocksHideExit`、`createHumanAiMapSnapshot`、
`resolveHumanAiHideInteraction`）。

- 它是**逻辑仿真**：没有渲染、没有 DOM、没有真人输入，帧步长固定 50 ms。
  它只能证明「逻辑层整局能推进到结算」，**不能替代浏览器实机，更不是真人试玩**。
- 玩家一侧是脚本策略（`idle` / `pursue` / `pressure` / `wander` / `eat` / `evadeEat` / `hideEat`），
  只用玩家自己能看到的公开信息（自己的位置、公开米点、真实视觉与 Last Seen），
  不读对手的隐藏实时坐标。
- **确定性**：正式游戏里两套 AI 的随机抽签是 `Math.random`，`?matchSeed=` 只复现**布局**
  （出生点 / 18 扇门初态 / 米位）。仿真器为了能复现阻断，默认改成由种子派生的确定性流
  （与布局流不同源）；这是**仿真器行为**，不是产品行为，报告中必须注明。
- 批量脚本：`docs/verification/S7D/run-match-batch.mjs`（输出 `match-batch.json`）。

### 3.2 真实浏览器腿：真实游戏整局

`docs/verification/S7D/browser-check.mjs` 用本机 Chrome（`--headless=new` + CDP）打开
`http://127.0.0.1:5173/?matchSeed=<seed>`，走真实 DOM 交互（点选阵营 → 确认阵营 → 站桩对局 →
结算 → 再来一局 → Esc → 返回阵营选择），并从 DEV 面板真实导出本局 AI JSON 读取整局摘要。

- 真实渲染循环、真实系统、真实 UI，但**玩家一侧是脚本站桩**，不是真人试玩。
- `?matchSeed=` 只固定布局；由于 AI 掷骰是 `Math.random`，**浏览器里的整局轨迹与仿真同种子
  轨迹不会相同**。因此浏览器腿验证的是「真实游戏能不能正常走完整局」，不是复现仿真的轨迹。

### 3.3 「10～30 局」的口径

- 自动化批量：**30 局**（6 组 × 5 局，Human 阵营 15 局 / DeepSeek 阵营 15 局）。
- 稳健性扫描：**6 个种子 × 12 条 AI 随机流 = 72 局**（同一布局、不同 AI 掷骰）。
- 真实浏览器：4 局（Human 阵营 2 局 / DeepSeek 阵营 2 局），每局都做结算 → 重开 → 返回菜单。
- 三者（自动化仿真、浏览器脚本、用户人工验收）在报告中**分开记录**。

## 4. 审计发现与修复

审计口径：先跑整局，靠遥测与事件时间线定位「可复现的整局阻断」，再读源码定位根因。
修复只改**判据不一致**的地方，不改任何已验收数值，也不新增玩法。共定位并修复 **4 处**
整局阻断，全部属于同一类根因：**同一个「这个 Human 是不是威胁 / 是不是挡住了路」的问题，
控制器里不同位置用了互不一致的判据**。

### 4.0 问题台账（用户要求的逐项记录：种子 / 阵营 / 复现 / 状态 / 严重程度 / 修复与复测）

| # | 随机种子 | 玩家阵营 | 复现步骤 | 卡在哪（AI 状态） | 严重程度 | 修复 | 复测结果 |
|---|---|---|---|---|---|---|---|
| A | `20292603` | Human（站桩） | `analyze-match.mjs 20292603 HUMAN idle` | `SAFE_WAIT`（`RICE_OR_ROUTE_STILL_DANGEROUS`），`target=null`，停在 4/5 米 | **阻断**：600 秒不结算 | §4.1 统一 SAFE_WAIT / 静止通行的路线半径 | 74.3 秒结算、5/5 米、0 异常 |
| B | `20292603` / `20260927` | Human（站桩） | `analyze-match.mjs 20292603 HUMAN idle - 4` | `MOVE_TO_RICE → EVADE → RECOVER` 约 10 秒一循环（`escape=LOCAL_ROOM_LOOP`），米停 1/5 | **阻断**：24 条随机流里 5 条 600 秒不结算 | §4.2 「米堆落在 `visionEvadeDistance` 内」也算被挡住，交给静止安全通行 | 24/24 结算、中位 45.9 秒、0 异常 |
| C | `20300522` | Human（会追） | `diagnose-hide-lock.mjs` | `HIDE` / `CONCEALED`，闸门 `THREAT_STILL_VISIBLE`，Human 在 8.38 u 外（CAUTION） | **阻断**：570 秒保持藏身、整局不结算 | §4.3 可见 Human 只有在 `visionEvadeDistance` 内才拒绝退出 | 该局可正常退出并恢复找米；藏身计数维持 1 进 1 出 |
| D | `20260927` | Human（站桩，且出生点离藏身家具 3.03 u） | `robustness-sweep.mjs 12 20260927` | `HIDE` / `CONCEALED`，闸门 `THREAT_STILL_VISIBLE`，Human 静止 578 秒 | **阻断**：12 条随机流里 10 条 600 秒不结算 | §4.4 危险距离内若 Human 已公开地长时间静止（`curiosityStillMs`）则允许退出 | 12/12 结算、中位 56.1 秒、0 异常 |

### 4.1 阻断 A：SAFE_WAIT 在最后一堆米前无限等待（已修复）

**复现**：`node --experimental-strip-types docs/verification/S7D/analyze-match.mjs 20292603 HUMAN idle`
**数值证据**：`docs/verification/S7D/diagnose-safewait.mjs`

| | 修复前 | 修复后 |
|---|---|---|
| 结果 | 600 秒未结算（12,000 帧上限） | `DEEPSEEK / RICE_COMPLETED`，74.3 秒 |
| 完成大米 | 4/5 | 5/5 |
| 最长「没吃到米」 | **559,850 ms** | 32,100 ms（已验收的安全通行绕行） |

最后一堆米 `rice_13` 在 `(-6.2, 7.1)`，站桩的 Human 玩家在 `(-3.40, 10.00)`：
`distance(rice_13, human) = 4.03`，A* 路线最近接近距离 `1.60`。

- `updateSafeWait()` 用 `dangerRouteRadius(3.0)` 判「路线仍然危险」→ 一直等待；
- 静止安全通行的闸门 `tryStartPassage()` 对「路线是否被挡」用
  `stationaryPassageBlockRadius(1.5)` → 认为没人挡路，返回 `HUMAN_NOT_ON_RICE_ROUTE`；
- 只剩一堆米，「换一堆安全米」的分支也无路可走 ⇒ **两边结论相反，AI 永远不动**。

**修复**（`tryStartPassage()`）：AI 已处于 `SAFE_WAIT` 时，静止通行闸门的「路线是否被挡」
改用 SAFE_WAIT 自己用的 `dangerRouteRadius`；**非 SAFE_WAIT 的判定保持原值**。

### 4.2 阻断 B：MOVE_TO_RICE → EVADE → RECOVER 整局循环（已修复）

**复现**：`… analyze-match.mjs 20292603 HUMAN idle - 4`（第 4 条 AI 随机流）
**修复前实测**：种子 `20292603` 的 24 条 AI 随机流里 **5 条 600 秒不结算**（只吃到 1/5 米）

时间线显示：AI 反复从 `hall` 走进 `second_bedroom` 靠近 `rice_13` → 因为 Human 可见且
距离 < `visionEvadeDistance(5)` 被判成 HIGH 威胁 → `EVADE` → 拉开距离后 `RECOVER` →
`MOVE_TO_RICE` 再回去 → 约 10 秒一个循环，持续到帧上限（约 57 次）。

**根因**：`rice_13` 距离那个不动的 Human **4.03 u**。要吃到这堆米就必须站进 5 u 内，
于是每次靠近都必然被判成 HIGH 威胁 —— **AI 永远不可能吃掉这堆米**。而 S7B-2 设计里
专门处理「静止 Human 挡住米堆」的**静止安全通行**闸门却不肯出手：它判断「米堆是否靠近
Human」用的是 `dangerRouteRadius(3.0)`，`4.03 > 3.0` ⇒ 判定为「没挡住」。

**修复**（`tryStartPassage()` 的 `humanNearRice`）：米堆只要落在 AI 自己的
「看见 Human 就逃跑」距离 `visionEvadeDistance(5.0)` 以内，就判为「这个静止 Human 挡住了
这堆米」。两个都是既有数值，取其更大者，**没有新增或修改任何参数**。

**为什么这不是掩盖问题**：接管它的是 S7B-2 已验收的静止安全通行——它必须先在捕获圈
（`captureRadius + stationaryPassageSafetyMargin`）之外规划一条安全绕行路线、先到观察点停留、
再进食；**「没有抓捕圈外的安全路线就拒绝放行」的安全边界完全没有放宽**（同一条用例的上半段
仍然断言 `NO_SAFE_ROUTE` + `passageActive === false`）。AI 没有获得抓捕免疫，也没有瞬移或读隐藏坐标。

**修复效果**：

| 种子 | 修复前 | 修复后 |
|---|---|---|
| `20292603`（24 条 AI 随机流） | 19/24 结算；不结算的 5 条各 597 秒、米 1/5 | **24/24 结算，中位 45.9 秒，0 异常** |
| `20260927` | 2/12 结算 | 见 §4.4 |

### 4.3 阻断 C：藏身后因「看得见 Human」永不退出（已修复）

**复现**：`… diagnose-hide-lock.mjs`（种子 `20300522` + `pursue`：AI 藏进 `hide_study_bookshelf`，
Human 在 **8.38 u** 外、威胁只有 `CAUTION/VISION`，仍然连续 **570 秒**拒绝退出）

**机制**：藏身期间 **AI 自己的视觉不被遮蔽**（`VisionSystem` 只让藏身者对*对手*不可见），
所以 `input.visibleHuman` 一直非空；退出闸门第一条却是
`if (input.visibleHuman) return THREAT_STILL_VISIBLE`——**只要看得见，无论多远都不退出**。
这与控制器自己的危险判据不一致：`assessThreat()` 只在
`sightDistance <= visionEvadeDistance(5)` 时才把可见 Human 判为 `HIGH`，否则只是 `CAUTION`
（这种距离下 AI 平时是照常继续找米的）。

**修复**（`evaluateHideExit()`）：可见 Human 只有在**同时**落在 `visionEvadeDistance` 以内时
才继续拒绝退出；否则按原流程继续判「已知威胁点是否仍在 `escapeMinSeparation` 内」与
「是否还有可达米堆路线」。

### 4.4 阻断 D：藏身时 Human 长时间静止也永不退出（已修复）

**复现**：`… robustness-sweep.mjs 12 20260927` —— 修复 D 之前，**12 条 AI 随机流里有 10 条
600 秒不结算**（米停在 2/5），异常码全部是 `HIDE_LONG_CONCEALMENT`。

**机制**：种子 `20260927` 的布局里 Human 出生点距离 AI 会选的藏身家具只有 **3.03 u**。
AI 被逼近后藏进去，Human 全程不动（`stillMs` 一路涨到 578 秒），但因为它始终落在
`visionEvadeDistance(5)` 以内，§4.3 的判据仍让它一直藏着 —— **AI 不推进目标，整局无法结算**。

**修复**（`evaluateHideExit()`）：危险距离内再给一个**公开**出口——如果这个可见 Human 已经被
`HumanStillness` 公开地判定为长时间真的静止（门槛用既有的 `curiosityStillMs`，正是 S7B-2
用来授权「绕过静止 Human 去吃饭」的**同一条**门槛），那它此刻不是追捕者，允许退出。
**Human 一动、或只是短暂停下，仍然照原样继续藏着**（`humanStillMs` 会归零）。

**为什么不需要新增参数**：S7B-2 已经用 `curiosityStillMs` 授权 AI 在静止 Human 旁边绕行并进食；
既然允许它绕过静止 Human 去吃饭，就不该允许它因为同一个静止 Human 而被永久锁在柜子里。

**修复效果**：

| 种子 | 修复前 | 修复后 |
|---|---|---|
| `20260927`（12 条 AI 随机流） | 2/12 结算，10 条 597 秒 + `HIDE_LONG_CONCEALMENT` | **12/12 结算，中位 56.1 秒，0 异常** |
| `20292603` | — | 12/12 结算，0 异常 |

### 4.5 关于「藏身最长时长」的说明（**没有改数值**）

`GAME_CONFIG.deepseekAI.hideMaxConcealMs` 当前是 **0（不限制）**，是 S7C-2b 已验收的九个
`hide*` 参数之一。**本轮没有修改它**，而是按 §4.3 / §4.4 收窄了「什么才算仍然有威胁」的判据。
若用户希望额外加一道「藏太久就必须冒险出来」的硬兜底，那属于修改已验收数值，需要单独批准；
按目前证据（6 个种子 × 12 条随机流 = 72/72 结算）**不必要**，因此不作为本轮提议。

### 4.6 修复后的边界守门

| 守门项 | 结果 |
|---|---|
| 全部既有测试 | `npm test` **743/743** 通过 |
| 藏身生命周期 / 循环抑制 / 搜查 | `deepseek-hide-lifecycle`、`deepseek-hide-loop-guard`、`hide-integration` 等 **75/75** 通过 |
| SAFE_WAIT / 静止安全通行 / 好奇优先级 | `deepseek-safe-wait`、`deepseek-passage`、`deepseek-curiosity-priority` 全部通过 |
| 藏身进出抖动 | 30 局批里 `HUMAN/idle` 的 AI 藏身计数是 **1 进 1 出**（修复前是 1 进 0 出），**没有出现反复进出** |
| 未修改任何 `GAME_CONFIG` 数值 | `src/config/gameConfig.ts` 无改动 |
| 未放宽安全边界 | 「没有抓捕圈外的安全路线就拒绝放行」的用例保持通过；AI 没有抓捕免疫 |

**唯一被改写的既有测试**：`tests/deepseek-curiosity-priority.test.mjs` 的
「rice proximity never authorizes an unsafe route or a distant unrelated Human」——
它原先用 `dangerRouteRadius + 1`（4.0 u）代表「远处的、无关的 Human」，而 §4.2 的修复正是
让 3～5 u 这个区间也算「挡住了这堆米」。因此把该用例的「远处」改为
`visionEvadeDistance + 1`（6.0 u），并**保留**它真正要守的安全断言（无安全路线时拒绝放行）。
这是一次**有证据的语义修订**（同一个用例的上下两段现在仍然自洽），需要用户在验收时确认。


## 5. 整局遥测与 AI JSON（`formatVersion` 1.6 → **1.7**）

复用既有 `AILogCollector`，**不新增第二套时钟、不新增第二套事件来源**，只把整局需要的字段
补进导出：新增 `matchSummary`（v1.6 的全部字段与语义保持不变，因此旧消费者不受影响）。

| 字段 | 内容 |
|---|---|
| `matchSeed` / `playerFaction` | 本局随机种子与玩家阵营（开局登记） |
| `phase` / `winner` / `reason` | 当前阶段与结算结果（`RICE_COMPLETED` / `CAPTURED`） |
| `durationMs` / `riceCompleted` / `riceTotal` | 对局时长与完成的大米数量 |
| `counts` | 门开 / 关 / 锁 / 解锁 / 强破、冲刺、摔倒、藏身进入 / 退出 / 拒绝、Human AI 搜查开始 / 搜中 / 搜空、强制抓捕 —— 全部是 O(1) 计数 |
| `doorLockEvidence` / `doorEscapeEvidence` | S7B-3B 主动锁门与 S7B-3A 关门的**逐条实机事件**（各上限 50 条） |
| `anomalies` | AI 卡路 / 异常状态的可疑点：`LOCAL_LOOP`、`NO_ROUTE_TO_RICE`、`SAFE_WAIT_THREAT_PERSISTS`、`HIDE_LONG_CONCEALMENT`；同一现象折叠成一条「首次时间 + 持续时长」（上限 100 条） |

**有界性**：`counts` 是纯数字；三个证据 / 异常数组都有硬上限；异常按「种类持续」折叠，
不逐帧刷屏（这与既有 `events` 最多 2000 条、`hideEvents` / `humanSearchEvents` /
`playerSearchEvents` 各 500 条的上限一致）。日志不会因为整局变长而线性膨胀。

## 6. 结果

### 6.1 自动化批量（无头逻辑仿真，30 局）

命令行：`node --experimental-strip-types docs/verification/S7D/run-match-batch.mjs 5 20260927 <outDir> [core|baseline]`

**严格同组合 A/B**（同一批 30 局组合、同一批种子，只差本轮修复）：

| 指标 | 修复前（`baseline/`） | 修复后（同组合重跑） |
|---|---|---|
| 结算成功 | 28 / 30 | **30 / 30** |
| 600 秒仍未结算 | **2**（`HUMAN/idle` 种子 20260927、20292603） | **0** |
| 整局异常记录 | 2 条 | **0 条** |
| AI 藏身计数（`HUMAN/idle`） | 1 进 0 出（进去了出不来） | 1 进 1 出（正常一进一出） |

**修复后的 30 局组合分布**（Human 阵营 15 局 / DeepSeek 阵营 15 局，`after/`）：

| 组合 | 局数 | 结果 | 关键覆盖 |
|---|---:|---|---|
| Human 玩家 / `idle` | 5 | DeepSeek 5/5 米胜 ×5 | AI 独立找米 / 进食 / 关门 / 锁门 / 冲刺 / 摔倒 / 自主藏身并退出 |
| Human 玩家 / `pursue` | 5 | 两种胜负都有（3 胜 2 负） | AI 逃跑 / 冲刺 / 躲藏 |
| Human 玩家 / `pressure` | 5 | 两种胜负都有（4 胜 1 负） | 先贴身压后放弃 |
| DeepSeek 玩家 / `idle` | 5 | Human 抓捕胜 ×5 | Human AI 巡逻 → 追逐 → 抓捕 |
| DeepSeek 玩家 / `evadeEat` | 5 | Human 抓捕胜 ×5 | 玩家会跑会吃，Human AI 开门 / 调查 |
| DeepSeek 玩家 / `hideEat` | 5 | Human 抓捕胜 ×5（其中 1 局是**搜查命中**） | **Human AI 检查藏身家具 → 搜出 → 结算** |

### 6.2 稳健性扫描（同一布局 × 多条 AI 随机流）

正式游戏的 AI 掷骰是 `Math.random`，因此同一 `matchSeed` 只固定布局。为了估计「同一布局在
不同 AI 掷骰下会不会卡住」，用 `docs/verification/S7D/robustness-sweep.mjs` 对每个种子跑
**12 条不同的 AI 随机流**（`HUMAN/idle`，即最容易暴露问题的组合）：

| 种子 | 修复前 | 修复后 |
|---|---|---|
| `20260927` | **2/12 结算**（10 条 597 秒 + `HIDE_LONG_CONCEALMENT`）——这是修完 A/B/C 之后、修 D 之前的实测值 | **12/12 结算**，中位 56.1 秒，0 异常 |
| `20292603` | 24 条流里 **19/24 结算**（5 条 597 秒）——这是修完 A 之后、修 B 之前的实测值 | **12/12 结算**，中位 45.3 秒，0 异常 |
| `20268846` | — | 12/12 结算，中位 37.5 秒 |
| `20276765` | — | 12/12 结算，中位 38.5 秒 |
| `20284684` | — | 12/12 结算，中位 41.0 秒 |
| `20300522` | — | 12/12 结算，中位 44.5 秒 |
| **合计** | — | **72 / 72 结算，0 异常** |

### 6.3 真实浏览器（4 局，真实渲染 + 真实 DEV 面板导出）

| 局 | 玩家阵营 | 种子 | 结算结果 | 真实耗时 | 整局摘要里的异常 | 重开 | 返回菜单 |
|---|---|---|---|---:|---|---|---|
| 1 | Human | 20268846 | DeepSeek 娘获胜 / 5 份大米完成 | 37.8 s | 0 | ✓ | ✓ |
| 2 | Human | **20292603** | DeepSeek 娘获胜 / 5 份大米完成 | **46.0 s** | **0** | ✓ | ✓ |
| 3 | DeepSeek 娘 | 20260927 | 人类获胜 / 抓捕完成 | 7.1 s | 0 | ✓ | ✓ |
| 4 | DeepSeek 娘 | 20276765 | 人类获胜 / 抓捕完成 | 12.3 s | 0 | ✓ | ✓ |

- 4/4 都正确结算，且每局都从 DEV 面板**真实导出**了一份 AI JSON（`formatVersion 1.7`，
  含 `matchSummary`）：胜负 / 原因 / 完成米数 / 随机种子 / 玩家阵营全部与结算面板一致。
- 4/4 都验证了「再来一局 → 回到 READY → 再次进入正式对局」与
  「正式对局中 Esc → 暂停面板 → 返回阵营选择 → 阵营菜单可见」。
- 种子 `20292603` 在首次浏览器复跑时曾出现 **180 秒未结算**（当时 AI JSON 导出还没修好，
  抓不到摘要）；在完成 §4.2 / §4.4 两处修复并修好导出读取后，同一命令连续两次分别
  **72.6 秒**与 **46.0 秒**正常结算、异常记录为 0。
- 真实浏览器里 `?matchSeed=` 只固定布局，AI 掷骰仍是 `Math.random`；上述耗时与仿真同种子
  轨迹**不保证一致**（这也是为什么两条腿分开记录）。

### 6.4 S7B 遗留两项的处理结果

| 遗留项 | 处理 |
|---|---|
| 「S7B-2 偶发原地停留」 | 本轮把它定位成 4 个**可复现**的整局阻断（§4.1–§4.4）并全部修复；修复后 30 局批量 +
  72 条随机流 + 4 局浏览器**均未再出现**长时间原地停留。但「偶发」本身不能被证明清零，
  仍保留为后续优化项。 |
| 「S7B-3B 缺修复后的完整实机 AI JSON」 | 本轮把主动锁门的**逐条实机事件**（`doorLockEvidence`）与
  关门事件（`doorEscapeEvidence`）写进整局摘要，浏览器腿每局都真实导出一份 AI JSON。
  例：种子 20292603 那局记录了 `doorLocked: 1`、`doorClosed: 1`、`doorOpened: 5`。
  证据见 `docs/verification/S7D/browser/`。 |

## 7. 与既有阶段的边界（本轮必须保护的）

- **没有修改任何 `GAME_CONFIG` 数值**；`git diff` 里 `src/config/gameConfig.ts` 无改动。
- 玩家声音可视化停用保持停用：没有恢复 `PLAYER_SOUND_VISUAL_ENABLED`，没有把它当 Bug。
- DEV-B 38 项参数与本地预设、场景编辑器 V2 的布局存档 / JSON V3、S7C-3 的随机出生与门初态 /
  固定种子复现、双阵营调试冻结 / READY 独立计时 / 地图热应用与导航重建：**均未改动**。
- S7C-1B / S7C-2 / S7C-2b 的已验收判据、参数与接口未被改写；§4.2 唯一触及的
  「藏身退出闸门 ②」已按 §4.2 的方式收窄并附回归测试。

## 8. 集中人工验收清单

> 请用户按下列步骤在真实浏览器里集中验收。脚本能覆盖的部分已由 §6.2 记录，**人工验收的结果
> 与脚本结果必须分开记录，互不改写**。

1. 启动 `npm run dev`，打开 `http://127.0.0.1:5173/`（用 IP，不要用 localhost）。
2. **玩家选 Human**：选择「人类」→ 确认阵营 → READY → 什么都不按，等 DeepSeek 娘自己吃完
   5/5 米；确认结算面板写「DeepSeek 娘获胜 / 原因：5 份大米完成 / 大米：5/5」。
3. 在上一局里观察 DeepSeek 娘：找米、进食、（被靠近时）逃跑与冲刺、（必要时）关门 / 锁门、
   被逼近时自主藏身；确认它不会长时间呆站不动。
4. **玩家选 DeepSeek 娘**：返回阵营选择 → 选「DeepSeek 娘」→ 确认阵营 → 站着不动，等 Human AI
   自己巡逻过来抓捕；确认结算面板写「人类获胜 / 原因：抓捕完成」。
5. 在第 4 步里试着**藏进家具**（走近床 / 衣柜 / 纸箱按 E），再等 Human AI 过来：确认它会调查、
   走到家具旁停留并搜查，搜中时立即抓捕结算。
6. **重开**：在结算面板点「再来一局」，确认回到 READY → 对局中，大米与门态是本局新掷出的。
7. **返回菜单**：对局中按 Esc → 点「返回阵营选择」，确认回到阵营菜单且能重新开一局。
8. **典型随机种子**：用 `http://127.0.0.1:5173/?matchSeed=20260927`、`=20268846`、
   `=20292603`、`=20300522` 各开一局，确认两种阵营都能正常推进到结算（不会卡住不动）。
   注意：`?matchSeed=` 只固定布局，AI 掷骰仍是随机的，因此每局轨迹可以不同。
9. **本轮收窄过的两处 AI 判据（请特别确认这是期望行为）**：
   - 藏身期间，若唯一可见的 Human 确实长时间静止（`curiosityStillMs` 以上），DeepSeek 娘会
     主动退出藏身继续找米，而不再无限期藏在里面（§4.3 / §4.4）。请在「Human 站着不动守在
     家具旁」时观察：它应当会出来，而不是一直不出来。Human 若在移动，它仍然会继续藏着。
   - 静止 Human 站在米堆 3～5 u 内时，AI 会尝试既有的「安全绕行 + 观察后进食」，而不是
     反复接近又逃跑（§4.2）。
10. **回归**：DEV 面板（38 项参数、本地预设保存 / 加载 / 恢复默认）、场景编辑器 V2
   （保存布局 / 导入 JSON / 恢复默认）、双阵营调试冻结、DEV-B 声音事件可视化仍然正常；
   正式对局里**仍然不显示**玩家声音范围圈与彩色声纹（这是预期行为，不是 Bug）。

## 9. 已知限制与复现种子

| 项 | 复现 | 说明 |
|---|---|---|
| 浏览器同种子不复现仿真轨迹 | — | AI 掷骰是 `Math.random`；`?matchSeed=` 只固定布局 |
| S7B-2「偶发原地停留」 | — | 本轮修掉了 4 个**可复现**的整局版本（§4.1–§4.4），72 条随机流 + 30 局批量 + 4 局浏览器均未再复现，但不能证明清零 |
| 藏身退出闸门语义被收窄 | `analyze-match.mjs 20260927 HUMAN idle - 2` | §4.3 / §4.4 改了 S7C-2b 已验收的闸门 ②（可见 Human 的判据 + 静止 Human 例外）。请在验收时确认这一处是期望行为 |
| 静止通行触发边界被放宽 | `robustness-sweep.mjs` | §4.2 把「静止 Human 挡住米堆」的判据从 3.0 u 扩到 5.0 u（`visionEvadeDistance`）；安全边界未放宽，同一用例的安全断言保持通过 |
| 正式 GLB 角色与 IDLE 动画 | — | 未导入，仍是白模（S10 计划） |
| Human AI 自动解锁 8,750 ms | — | 按用户决定留到 S16 平衡阶段复评 |
| 未改动 `hideMaxConcealMs`（仍为 0） | — | §4.5：按现有证据（72/72 结算）不必要；若要硬兜底需另行批准数值改动 |

## 10. Git 工作区状态

**本轮不授权 commit / push / Tag**，因此结束时工作区保留本轮全部改动（源码、测试、文档、
验证脚本与证据），另有开工前就存在的 `src/three/ThreeGame.ts` 单空行差异（§2.2）。
`.trae/`、`.dsh-meow/`、`.codex/` 与既有未跟踪验证材料**未被读取、修改、暂存或删除**。

## 11. 最终集中人工验收与归档决定（2026-09-28）

用户已确认 S7D 六组集中验收均通过：静止通行修订、藏身退出修订、Human 阵营完整对局、DeepSeek 娘阵营完整对局、生命周期及复现、DEV 与声音显示回归。另由用户本人分别操控 Human 和 DeepSeek 娘各试玩 **30 局，共 60 局**，未发现阻断整局完成的问题。这是真人试玩反馈，不等同于 §6 的 30 局无头逻辑仿真、72 条随机流扫描或 4 局浏览器脚本站桩对局；后者均保留其原有证据口径。

用户补充的非阻断平衡观察：操控 DeepSeek 娘时，Human AI 的抓捕速度体感比自己操控 Human 更快。**原因尚未核实**，不得据此直接调整任何已验收数值；留待后续定向测量。S7B 遗留的偶发原地停留仍保留观察；四处已复现阻断的修复及 60 局验收均不构成「潜在 Bug 已全部清零」的证明。

本次用户授权 S7D 文档收尾、正式门禁、独立提交及正常推送；不创建 Tag，也不进入 S8。阶段 Gate 须以本次提交及 GitHub 远端核验实际成功为准。开工前已存在的 `src/three/ThreeGame.ts` 单空行差异不纳入 S7D 提交。
