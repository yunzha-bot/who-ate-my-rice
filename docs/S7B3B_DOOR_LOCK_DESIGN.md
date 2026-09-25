# S7B-3B 主动锁门与逃脱策略 —— 设计文档（v1 规则固化）

> 本文档固化 S7B-3B 已批准的 v1 规则，梳理关门→锁门的连续动作状态机与冷却结算冲突，盘点需复用的接口，并制定自动化测试与人工验收条件。
>
> 状态：**S7B-3B 代码与人工验收全部完成**（3B-0b 接口 / 3B-1 决策核心 / 关门侧向证据修复 / Sprint 30 秒冷却与门协调 / 3B-2 防振荡 / 3B-3 定向回归 / 3B-4 DEV·日志·文档收尾），并已并入 Git 检查点 `6a92c5d`（已推送）。S7B 整体仍未完成。
>
> 基准提交：`ca18f61b7e7bad35070a3f16188d10f9c8ba426d`。本文档不把 S7B 标记为完成。
>
> 行号说明：正文与表格中的行号按 3B-0 基线记录；3B-0b 落地后 `DeepSeekAIController.ts`、`DoorSystem.ts`、`ThreeGame.ts` 均有位移。当前锚点：`assessThreat` L1102、`enterEvade` L1136、EVADE 入口 L442、`evaluateEscapeDoor` L1323、关门调用 L1251、关门冷却判定 L1348、`drainDoorEscapeEvents` L1319、`onDoorEscapeResult` L1377；`DoorSystem`：`activeLockedDoorCount` L44、`get` L48、`definition` L52、`toggle` L70、`lock` L83、`lockDoorFromCommand` L160；`ThreeGame`：关门落地 L433、锁门落地 L447、`canCloseDoor` L761、`applyDoorResult` L771、`syncDoor` L800。

---

## 1. 已批准的 v1 规则（固化）

### 规则 ①（A1）：锁门安全距离复用 `doorEscapeMinHumanDistance = 1.5`

- 锁门最低 Human 安全距离暂时复用 `GAME_CONFIG.deepseekAI.doorEscapeMinHumanDistance = 1.5`（`src/config/gameConfig.ts:106`）。
- **必须在实际执行锁门的那一帧重新检查安全条件**：关门时安全不代表下一帧锁门时仍然安全。
- 若 Human 已逼近（距离 < 1.5）、进入同侧、或触发**真实危险信号**，立即放弃锁门并继续逃跑。
  - 真实危险信号 = `captureProgressMs > 0`（真实抓捕进度）、`sprintState === 'STUNNED'`、或目视距离正以 ≥ `approachSpeedThreshold`(0.35 u/s) 缩短且已 ≤ `riskySprintDistance`(2.2)。
  - **禁止用 `threat.level === 'HIGH'` 作为取消依据**；原因见第 2.1 节源码分析。

### 规则 ②（B1）：关门与锁门共用现有 5000 ms 同门冷却，且带连续动作例外

- 复用 `GAME_CONFIG.deepseekAI.doorEscapeCooldownMs = 5000`（`gameConfig.ts:108`），不新增冷却时长。
- **冲突点**：S7B-3A 的 `onDoorEscapeResult()` 会在关门成功后写入冷却（`DeepSeekAIController.ts:1367-1368`），该冷却不得阻断同一次合法跨帧锁门。
- **例外机制（已选定）**：冷却在关门那一刻结算（保持 `onDoorEscapeResult` 现状不变）；锁门评估走独立路径，**不查冷却**，因为它是同一次连续动作。连续动作结束后，关门时已结算的冷却继续约束新的关门决策，从而不开放任意时刻重复锁门。
- 关门成功但锁门失败：锁门失败只结束连续动作并清空 pending，**不重写冷却**（冷却已在关门时结算），不得留下悬挂状态。
- Human 重新开门后，同一扇门不得诱发关门/锁门振荡（由关门冷却 + pending 清除共同保证）。

### 规则 ③（C3）：锁门前做导航可达性校验，不新增人为锁位配额

- 保留全局最多 3 把 Active Lock（`GAME_CONFIG.door.maxActiveLocks = 3`，`DoorSystem.ts:43-45/88`）。
- 锁门后 DeepSeek 自身的逃生路线必须仍然可达（复用 S7B-3A 的 `blockedDoors` 校验）。
- **新增**：锁门还需考虑剩余米堆可达性，避免 DeepSeek 把自己的全部后续目标封死。
- 若无满足要求的路线，放弃锁门并继续原有逃脱策略。
- **不得借此读取现有感知系统之外的 Human 实时位置**：米堆可达性只使用 `input.rice`（位置 + `completed`）与门状态，不读 Human 坐标。

### 规则 ④（D1）：关门成功后，在后续帧判断是否锁门

- 第一版复用现有 `doorEscapeCrossingWindowMs = 1800`（`gameConfig.ts:107`）作为连续动作窗口，**不新增独立锁门窗口**。
- 锁门仅在以下条件**同时满足**时允许：
  1. 本次关门确实由 DeepSeek 主动发起；
  2. 门已成功进入 `CLOSED`；
  3. 仍处于合法连续动作窗口（距实际过门 ≤ 1800 ms）；
  4. Human 仍位于门另一侧且当前感知足以确认；
  5. Human 距离仍 ≥ 1.5；
  6. DeepSeek 仍有安全逃生路线（锁门后不封退路）；
  7. 锁位仍有余量；
  8. 当前门满足 `DoorSystem.lock()` 的真实前置条件（`state === 'CLOSED'`、`locked === false`、`lockCoreState === 'ACTIVE'`、`activeLockedDoorCount < maxActiveLocks`）。
- 锁门失败不得循环重试。
- 门重新打开、窗口超时、或出现真实危险，立即取消待执行的锁门动作。

---

## 2. 关门 → 锁门 连续动作状态机

> 现有字段位置：`doorNodes`(L158)、`lastDoorSide`(L191)、`recentDoorCrossing`(L192)、`closedDoorAt`(L193)、`doorEscapeCooldownRemainingMs`(L155)。`trackDoorCrossings`(L1277-1293) 记录实际过门时间戳。

```
                 ┌──────────────────────────────────────────────┐
                 │  EVADE（updateSafety，L1148）                │
                 └──────────────────────────────────────────────┘
                                   │
          evaluateEscapeDoor(L1310) 返回门 D（OPEN、已过门、目视对侧、距离安全、
                                  退路可达、有延迟收益）── 无 → 正常逃跑
                                   │ 有
                                   ▼
                   发出 closeDoorId（L1238-1243）
                                   │
               ThreeGame 落地（L428-439）→ doorSystem.toggle → CLOSED
                                   │
           onDoorEscapeResult(id,'CLOSED')（L1364-1371）
              ├─ 写冷却：closedDoorAt[id]=now，cooldownRemaining=5000  ← 冷却在此结算
              └─ 【3B-0b 新增】doorLockPendingId = id                    ← 进入 LOCK_PENDING
                                   │
                    ┌──────────────▼────────────────┐
                    │  LOCK_PENDING（后续帧，仍在 EVADE）│
                    │  evaluateEscapeLock(input)     │
                    └──────────────┬────────────────┘
       满足全部 8 条件          任一条件失败/门重开/窗口超时/真实危险
              │                          │
              ▼                          ▼
   发出 lockDoorId            取消：doorLockPendingId = null
              │                （继续原逃跑，门保持 CLOSED 已是既有收益）
              ▼
   ThreeGame 落地 → doorSystem.lock(id,'DEEPSEEK')
              │
   onDoorLockResult(id, result)
      ├─ 'LOCKED'          → 成功；清 pending；冷却保持关门时结算值
      └─ 其它失败结果       → 清 pending；不重试；不重写冷却
```

**连续动作结束条件**（任一触发即清 `doorLockPendingId`，绝不循环）：

1. 锁门成功（`LOCKED`）；
2. 锁门失败（`LOCK_LIMIT_REACHED` / `LOCK_CORE_DISABLED` / `INVALID_STATE` / `NOT_FOUND` / `NOT_ALLOWED` / `BLOCKED_BY_ACTOR`）；
3. 门重新打开（`state !== 'CLOSED'`，例如 Human 打开）；
4. 过门窗口超时（`elapsedMs - recentDoorCrossing[id] > 1800`）；
5. 真实危险信号（`captureProgressMs > 0`、`sprintState === 'STUNNED'`、或目视距离以 ≥ 0.35 u/s 缩短且 ≤ 2.2 u）——**不含 `threat.level === 'HIGH'`**；
6. 感知不足以确认 Human 仍在另一侧（无目视 / 同侧 / 距离 < 1.5）。

### 2.1 为什么 `threat.level === 'HIGH'` 不能作为取消依据（3B-0b 源码分析）

`assessThreat`（`DeepSeekAIController.ts:1102-1134`）的判定是：

| 输入 | 结果 |
|---|---|
| 当前目视 Human 且距离 ≤ `visionEvadeDistance`(5) | **HIGH** |
| 当前目视 Human 且距离 > 5 | CAUTION |
| 未目视但听到 Human 声音且最终强度 ≥ `soundEvadeStrength`(0.09) | **HIGH** |
| 未目视且声音更弱 | CAUTION |
| 2500 ms 内的 Last Seen | CAUTION |
| 其它 | NONE |

`enterEvade` 也只在 `threat.level === 'HIGH'` 时进入（同文件 L442，`enterEvade` 本体 L1136）。而锁门的合法窗口是 **1.5 ≤ 目视距离 ≤ 5**（下限来自 `doorEscapeMinHumanDistance`，上限来自 `visionEvadeDistance`）——**整个合法窗口都落在 HIGH 区间内**。

因此：若锁门以 `threat.level === 'HIGH'` 为取消条件，**每一次合法锁门都会被当帧取消，功能永远不会触发**。

正确做法（3B-1 采用）：像 S7B-3A 的 `evaluateEscapeDoor` 一样**按具体条件而非威胁等级判断**——它只检查 `visibleHuman`、门侧、距离、逃生路线与 `sprintState !== 'SPRINT_RUNNING'`，从不看 `threat.level`。锁门评估必须沿用同样的纪律，取消只由第 2 节列出的真实信号触发。

### 2.2 已确认的执行链阻断：关门遮挡视线，使「Human 另一侧」前提永不成立（实机日志）

真机日志（`who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`，364.7 秒 / 1666 事件 / 未截断）：`DOOR_ESCAPE_CLOSE = 8`、`DOOR_LOCK_SKIP = 4`、`DOOR_LOCK_EVALUATE = 0`、`DOOR_LOCK_APPLY = 0`、`DOOR_LOCK_FAILED = 0`。

- 8 次成功关门的**下一帧**都出现 `THREAT_SOURCE_CHANGE :: LAST_SEEN|SOUND` 与 `PASSAGE_GATE :: NO_VISIBLE_HUMAN`，即 Human 在关门后立即不可见。
- 已记录的 4 次拒绝全部为 `HUMAN_SIDE_UNKNOWN`；其余 4 次同门同因的拒绝被 `doorLockDecision` 的相邻去重吞掉（见本节末）。

源码链路：

| 环节 | 位置 | 行为 |
|---|---|---|
| 关门要求当前目视 | `DeepSeekAIController.ts` `evaluateEscapeDoor` | `if (!input.visibleHuman) return reject('HUMAN_SIDE_UNKNOWN')` |
| 关门后视线被门挡住 | `src/systems/PerceptionSystem.ts:83-91` `inspectVision` | 非 `OPEN` 门与视线矩形相交即 `BLOCKED` |
| `visibleHuman` 取决于该视线 | `src/three/ThreeGame.ts:396` | `visibleHuman: sight.visible ? this.human.position : null` |
| 锁门再次要求当前目视 | `DeepSeekAIController.ts` `evaluateEscapeLock` | `if (!input.visibleHuman) return reject('HUMAN_SIDE_UNKNOWN')` |

**结论**：关门这个动作本身摧毁了锁门的前提「Human 当前可见」。两者在同一连续动作内互斥，正常追逐下锁门**不可能成立**。

**状态**：用户已批准修复，本轮**已实施**（见 §2.3）。

**日志质量缺陷（已修复）**：`doorLockDecision` 只与「上一条决策签名」比较，导致同门连续同因拒绝被吞（8 次仅记 4 次）。修复：建立新 pending 时清空 `lastDoorLockDecision`；并新增 `DOOR_LOCK_PENDING` / `DOOR_LOCK_CANCEL` 事件，使「未建立 pending / 建立后提前取消 / 评估后拒绝 / 发出命令但执行失败 / 锁门成功」五种结局可区分。

### 2.3 已实施的修复：关门侧向证据（2026-09-24）

- **记录**：`evaluateEscapeDoor` 在决策关门的成功路径上记录 `doorLockEvidence = { doorId, deepseekSide }`——只保存已由**真实目视**确认的「Human 在门另一侧」这一侧向事实，并绑定门 ID。
- **建立 pending 的前提**：`onDoorEscapeResult` 仅在「本次关门成功 + 仍在 1800 ms 窗口 + 该门确有本次确认的侧向证据」时建立 `doorLockPendingId`；否则记 `DOOR_LOCK_SKIP:NO_CLOSE_SIDE_EVIDENCE`，不建立 pending。
- **评估（`evaluateEscapeLock`）**：
  - **重新看见 Human** → 一律以最新目视信息为准：同侧 / 距离 < 1.5 / 逼近（`approachSpeedThreshold` + `riskySprintDistance`）→ 取消。
  - **当前失视**（因为这扇门刚被关闭）→ 只复用同门、同一次连续动作的侧向证据，并重新核验当前事实：门仍 `CLOSED`、DeepSeek 侧别未变（`DEEPSEEK_SIDE_CHANGED`）、交互距离与不可隔墙（`canLockDoor`）、锁位余量、锁芯可用、逃生路线、至少一处未完成米堆可达。
  - 该证据**不得**当作 Human 实时位置，也**不作为「距离仍然安全」的证明**；失视时不做任何基于旧距离的安全断言，安全依据是「门保持 CLOSED ⇒ 对侧 Human 物理上无法越过」这一结构化事实，外加 `captureProgressMs` 等当前危险信号。
- **证据失效（任一命中即清除）**：pending 被消费或取消、门重新打开、超过 1800 ms 过门窗口、发现 Human 已同侧、出现实际抓捕进度或紧急危险、交互条件不成立（`clearPendingLockState` / `cancelPendingLock`）。
- **未改动**：`doorEscapeMinHumanDistance` 1.5、`doorEscapeCrossingWindowMs` 1800、`doorEscapeCooldownMs` 5000、全局最多 3 把锁、`DoorSystem` 唯一门状态源、锁门帧的执行端交互与墙体复检；未新增独立锁门窗口。

### 2.4 Sprint 与门动作的协调 + 冲刺 30 秒冷却（2026-09-24）

- **实测结论**：冲刺会吃掉门机会。`C.sprint.durationMs` 2,500 ms **大于** `doorEscapeCrossingWindowMs` 1,800 ms，且冲刺会把 DeepSeek 带出 `door.interactionRange` 1.3；实机日志 35 次 `SPRINT_IN_PROGRESS` 中 **29 次**该门在之后 1800 ms 内再无任何门事件。
- **修复选择：不停止冲刺**。停止冲刺虽能让门动作完成，但会让 AI 躲过 30% 必摔，违反既有「冲刺开始后不能停下规避风险」并构成平衡漏洞。因此改为：`evaluateEscapeDoor` / `evaluateEscapeLock` 不再因 `SPRINT_RUNNING` 拒绝；门动作是一次性交互，`SprintSystem.movementDirection` 在冲刺中恒返回 `lastDirection`，所以关门/锁门**不打断冲刺**，冲刺计时与 30% 摔落判定完整保留。
- **冲刺技能冷却**：新增 `C.sprint.cooldownMs = 30_000`（毫秒），冲刺一开始即进入冷却并持续计时，期间不能再次冲刺；`STUNNED` 与抓捕进度仍是取消条件。该冷却从结构上降低冲刺占空比，使门机会不再被长期占用。
- **不变**：除 `SPRINT_RUNNING` 一项外，2.3 节列出的全部保护条件继续生效。

### 2.5 防振荡与重复锁门保护（3B-2，2026-09-24）

**已存在、经审计确认充分的保护（未重复实现）**：

- **5000 ms 同门冷却**：`evaluateEscapeDoor` 以 `closedDoorAt`（绝对时间）判门，`onDoorEscapeResult` 在每次关门尝试（成功或失败）时写入，**按门 ID 独立**，`reset()` 清除。
- **一次关门最多一次锁门尝试**：关门后门变 `CLOSED` 即退出 OPEN 候选集；pending 只在 `onDoorEscapeResult` 建立一次；`evaluateEscapeLock` 成功即发命令并在同一帧由 `onDoorLockResult` 清 pending，失败/取消即清。
- **pending 与侧向证据清理**：`clearPendingLockState()`（成功、失败、任一检查不通过）＋ `cancelPendingLock(reason)`（进入 EVADE、转入 RECOVER、STUNNED）＋ `reset()`。
- **Human 解锁/强破后无法立即重锁**：冷却未过 → `DOOR_COOLDOWN`；冷却过后仍需**新的真实过门**，否则 `DOOR_NOT_RECENTLY_PASSED`；且解锁/强破把 Lock Core 置 `DISABLED` → `LOCK_CORE_UNAVAILABLE`（本局该门不可再锁）。
- **再次合法关锁的条件**：冷却结束 ＋ 重新真实过门 ＋ 当前目视（或本次关门的侧向证据）＋ 安全距离 ＋ 交互范围 ＋ 逃生路线 ＋ 米堆可达 ＋ 1800 ms 内 —— 全部沿用既有条件，无新参数。

**本轮修复的真实漏洞（有实机证据）**：`followPath` 会打开逃生路径上的非 OPEN 门，而关门后的逃生重规划**未排除刚被自己关上的门**（`findPath` 把 `CLOSED` 门当作可通行、代价 +3），因此 DeepSeek 可能**立刻把自己刚关的门重新打开**，抵消关门战术。

- 证据（`who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`）：t=187551 `DOOR_ESCAPE_CLOSE door_living_entry:CLOSED` → t=187556 `NO_MOVEMENT: OPENING_DOOR`（+5 ms）→ t=187568 视线由 `LAST_SEEN` 恢复为 `VISION`（说明门被重新打开）→ t=187568 `DOOR_ESCAPE_SKIP door_living_entry:DOOR_COOLDOWN`（证明该门当时已回到 `OPEN`）。8 次关门中出现 1 次。
- 修复：新增 `recentlySelfClosedDoors()`（本门冷却内的自关门集合），`selectEscapeGoal` 的寻路传入该屏蔽集，`followPath` 遇到自关门则清路径重规划（`SELF_CLOSED_DOOR_REPATH`）；若屏蔽后**没有任何**可达房间，回退一次允许使用该门（`*_SELF_CLOSED_FALLBACK`），避免原地卡死。全部复用既有 `doorEscapeCooldownMs`，**无新参数**。

**重复尝试守卫**：`doorLockAttemptedId` 记录已发起过尝试的 pending；若同一 pending 残留则拒绝第二次尝试并计入 `doorLockRepeatBlockedCount`（正常流程不可达，属显式不变量；`pending` 与 `lockDoorCommand` 计数 1:1 亦可佐证）。

**诊断**：`door-escape` 分类新增「自我重开门被抑制次数」；`door-lock` 计数行扩为 6 项（末位「重复尝试被拒」）。可区分：合法再次锁门（`PENDING → EVALUATE → APPLY`）、重复尝试（计数）、冷却阻止重关门（`DOOR_ESCAPE_SKIP:DOOR_COOLDOWN`）、Human 重开门导致取消（`DOOR_LOCK_SKIP:DOOR_REOPENED`）。

### 2.6 定向回归与长局不变量（3B-3，2026-09-24）

- **覆盖审计**：10 个重点领域在 3B-0b 至 3B-2 的测试中均已覆盖（关门→pending→锁门含失视证据、各类取消条件、窗口/交互/重开门、3 把锁与锁芯失效、同门与跨门冷却、自关门重开与兜底、一次动作一次尝试、逃生路线与米堆可达、冲刺冷却与不逃避摔倒、SAFE_WAIT/好奇/通行/Human AI/导航/门系统回归）。**唯一缺口是「长时间多帧连续对局下的跨系统不变量」**，故本阶段只补这一块，不重复既有用例。
- 新增 `tests/deepseek-door-lock-longrun.test.mjs`（7 项，确定性模拟）：同门 5s 内不二次关闭、不遗留 pending、单动作至多一次锁门命令、五类取消条件循环后不遗留 pending、被锁门不封死全部米堆路线、日志事件有界且**事件数与计数逐一相等**、门状态与动态碰撞多轮同步无残留、逃生目标不在相邻帧跳变。
- **结论：游戏代码无缺陷**；本阶段未改动任何 `src/` 生产代码或 `GAME_CONFIG` 数值。
- **测试编写教训（重要）**：驱动控制器时必须走**真实入口 `ai.update()`**。若直接调用内部的 `updateSafety()`，会跳过 `update()` 中的 `threatEstimate` 赋值，导致 `selectEscapeGoal` 提前返回、`evaluateEscapeDoor` 从不执行——表现为「测试里一次关门都没有」，极易被误判为游戏缺陷。另：不同连续动作发出相同 `DOOR_LOCK_PENDING` 签名是**正确**行为（每条动作都要留痕），不可当作重复事件断言。
- **长局口径**：本轮为确定性模拟长局，**不是实机长局验收**，不能替代浏览器实测。

### 2.7 DEV / AI 日志 / 文档收尾（3B-4，2026-09-25）

- **DEV 面板**（只修正确实不准的显示，未重构面板）：`Door Escape` 的评估类字段统一加「最近评估」前缀（它们只在 EVADE 的关门评估帧更新，否则会被读成实时值）；`放弃关门原因` → `最近放弃关门原因`；`Door Lock` 的 `最近锁门评估结果` → `最近锁门决策原因（执行成功时显示结果）`（`doorLockReason` 会被执行结果覆盖，原文案不准确）。`Sprint / 冲刺` 分类的字段与 `SprintSystem` 现状一致（状态 / 就绪度、冷却剩余、本次剩余、风险模式、最近开始原因）。
- **AI JSON 日志核对**：`DOOR_ESCAPE_CLOSE / SKIP`、`DOOR_LOCK_PENDING / CANCEL / SKIP / EVALUATE / APPLY / FAILED`、`SPRINT_DECISION` 的命名、去重（相同签名不逐帧重复）、时间戳、门 ID 与原因码均已一致。补充两处**确实缺失**的信号：
  - `DOOR_ESCAPE_SELF_CLOSED`（格式 `门ID:REPATH_AVOID_SELF_CLOSED`）——此前自关门抑制只能在 `NAVIGATION_RESULT` 看到原因码，**看不到是哪一扇门**；
  - `SPRINT_READINESS`（`READY / ACTIVE / COOLDOWN / STUNNED`）——使 30 秒冲刺冷却的生命周期可在日志中追溯；每次冲刺至多 3 条事件，不会刷屏。
- **文档同步**：`docs/AI_DEEPSEEK_STATE_TREE.md`（删除已与源码漂移的重复数值表，新增「主动关门与主动锁门」章节）、`docs/GAME_BALANCE_CONFIG.md`（`maxActiveLocks` 明确「同时上限、不限整局总次数」）、`docs/DEEPSEEK_HANDOFF.md`（阶段表与已知问题）、本文件与 `docs/AGENT_LOG.md`。
- **明确不做**：不新增玩法、不调整任何平衡数值；不改 `AGENTS.md` 的阶段状态——该文件要求「Gate 通过且 commit + push 成功」后才更新，本轮未提交。

---

## 3. 冷却结算设计（规则 ② 的冲突与例外）

**现状（S7B-3A）**：

- `evaluateEscapeDoor` 冷却判定（`DeepSeekAIController.ts:1335-1336`）：`elapsedMs - closedDoorAt[id] < doorEscapeCooldownMs` 则 `DOOR_COOLDOWN` 跳过。
- `onDoorEscapeResult`（L1364-1371）：无论关门成败都写 `closedDoorAt[id] = now` 并置 `doorEscapeCooldownRemainingMs = 5000`。

**冲突**：关门成功后 `closedDoorAt[id]` 立即生效，若锁门评估复用同一冷却判定，会被错误阻断，导致「永远关不上锁」。

**选定的例外机制（不修改 `onDoorEscapeResult` 的冷却写入）**：

| 动作 | 冷却行为 |
|---|---|
| 关门尝试（成功或失败） | 结算冷却（现状不变，L1367-1368） |
| 锁门评估（`evaluateEscapeLock`） | **不查冷却**（同一连续动作，靠 pending 标记限定） |
| 锁门落地（成功或失败） | 不重写冷却，只清 pending |

**安全性论证**：

- 「不得任意时刻重复锁门」：锁门只能由 `evaluateEscapeLock` 发起，而它只在 `doorLockPendingId !== null` 时运行；pending 只能由「刚成功关门」置位，且必须通过关门决策的全部 S7B-3A 条件。因此锁门天然被限定在合法连续动作内。
- 「Human 重开门不振荡」：Human 重开 → 门 `state !== 'CLOSED'` → pending 清除；且 `closedDoorAt` 冷却（自关门时刻起 5000 ms）仍生效，`evaluateEscapeDoor` 的 `DOOR_COOLDOWN` 会拒绝再次关门。
- 「关门成功但锁门失败」：锁门失败只清 pending，冷却已在关门时结算，状态不悬挂。

---

## 4. 待复用接口盘点（无新增，全部沿用现有源码）

### 4.1 DoorSystem（`src/systems/DoorSystem.ts`，唯一门状态源，无需改动）

| 接口 | 位置 | 用途 |
|---|---|---|
| `toggle(id, actor, canClose)` | L69-80 | S7B-3A 关门（现状不变） |
| `lock(id, 'DEEPSEEK')` | L82-92 | **锁门动作**（已完整实现，返回 `LOCKED` / `LOCK_LIMIT_REACHED` / `LOCK_CORE_DISABLED` / `INVALID_STATE` / `NOT_FOUND` / `NOT_ALLOWED`） |
| `get(id): DoorState` | L47-49 | 读 `state` / `locked` / `lockCoreState` 判前置条件 |
| `activeLockedDoorCount`（getter） | L43-45 | 锁位余量判断 |
| `definition(id): DoorNode` | L51-53 | 门侧向/距离几何（与 S7B-3A 共用） |

> **3B-0b 最小扩展**：`DoorSystem.ts` 新增导出函数 `lockDoorFromCommand(doors, id, actor, canInteract, interactionRange)` 与结果值 `OUT_OF_RANGE`，作为锁门命令的**执行端守卫**（复检交互距离与不可隔墙，其余状态/锁芯/锁位规则全部交给 `lock()`）。这不是重写锁门逻辑，只是把 ThreeGame 原本内联的二次校验提取为可单测的纯函数。

ThreeGame 侧（`src/three/ThreeGame.ts`，无需改动核心）：

| 接口 | 位置 | 用途 |
|---|---|---|
| `applyDoorResult(id, result)` | L755-769 | 视图/动态碰撞/声音同步，已处理 `LOCKED` → `DOOR_LOCK` |
| `canCloseDoor(id)` | L745-753 | 门叶占用检查（锁门落地可复用其可达性语义） |
| `canInteractWithDoorXZ` | L21 导入，L416/421/434 使用 | 不可隔墙操作（锁门落地复用） |
| `syncDoor(id)` | L783-789 | 门状态 → DoorView + 动态碰撞（`OPEN` 清障，其余用 `closedCollisionBox`） |

### 4.2 NavigationSystem（`src/systems/NavigationSystem.ts`，无需改动）

| 接口 | 位置 | 用途 |
|---|---|---|
| `findPath(start, goal, doors, avoid?, lockedDoorCost, blockedDoors?, avoidCircle?)` | L48-149 | 逃生路线与米堆可达性校验；`blockedDoors: ReadonlySet<string>`（L62-63、L133-136）已支持「屏蔽某门」语义 |

**结论**：规则 ③（C3）所需的两项可达性校验（逃生路线、剩余米堆）都能用现有 `findPath` + `blockedDoors` 完成，无需新增导航接口。

---

## 5. 安全可达性校验（规则 ③ 的实现方案）

设待锁门为 D（当前 `CLOSED`），`blocked = new Set([D])`：

1. **逃生路线校验**（沿用 S7B-3A L1351-1355）：
   `navigation.findPath(deepseek, escapeTarget, input.doors, undefined, null, blocked)` 非空 → 锁门后仍有不经 D 的逃生路线。
2. **剩余米堆可达性校验**（新增）：
   对每个 `!completed` 且不在 `avoidedRiceMs` 中的米堆，计算
   `navigation.findPath(deepseek, rice, input.doors, undefined, null, blocked)`；
   **任一可达即通过**（早退：命中第一个可达米即停止）；全部不可达 → 放弃锁门。

- 成本：Active Rice 最多 5 个，A* 网格小，且锁门评估已被「1800 ms 过门窗口 + 5000 ms 冷却」双重限频，开销可控。
- **感知公平性**：两项校验只用门状态、`escapeTarget`、米堆位置与 `completed` 标志，**不读 Human 位置**。Human 的侧向/距离仍只来自 `input.visibleHuman`（当前目视）。

---

## 6. 待实现接口与改动清单（3B-0b 落地，本轮不写码）

### 6.1 `src/systems/DeepSeekAIController.ts`

- `DeepSeekAICommand`（L50-56）新增 `lockDoorId: string | null`。
- `DeepSeekAIInput`（L28-48）新增 `canLockDoor?: (id: string) => boolean`、`activeLockSlots?: number`。
- 新增字段（供 DEV 面板与日志）：
  `doorLockPendingId: string | null`、`doorLockReason`、`doorLockSkipReason`、`doorLockLastResult`，以及 `doorLockEvents: { type; reason }[]`。
- `reset()`（L296-319 区间）清空上述字段。
- 新增方法：
  - `evaluateEscapeLock(input): string | null` —— 检查第 1 节规则 ④ 的 8 项条件，满足返回门 id，否则记录 `DOOR_LOCK_SKIP` 并清 pending；
  - `onDoorLockResult(id, result)` —— 结束连续动作、清 pending、记录 `DOOR_LOCK_APPLY` / `DOOR_LOCK_FAILED`；
  - `drainDoorLockEvents()` —— 与 `drainDoorEscapeEvents()`（L1306-1308）同模式。
- 修改 `onDoorEscapeResult`（L1364-1371）：`result === 'CLOSED'` 时置 `doorLockPendingId = id`，其余结果清空 pending；冷却写入保持现状。
- 修改 `updateSafety`（L1238 附近）：在 `evaluateEscapeDoor` **之前**先 `evaluateEscapeLock`（pending 门优先锁），命中则返回 `{ ...this.command(), lockDoorId }`。

### 6.2 `src/three/ThreeGame.ts`

- 组装 `DeepSeekAIInput`（L413-423 附近）注入：
  - `canLockDoor: id => !!node && canInteractWithDoorXZ(collision, player.position, node)`；
  - `activeLockSlots: C.door.maxActiveLocks - doorSystem.activeLockedDoorCount`。
- 新增落地分支（`closeDoorId` 之后，与它对称）：调用 `lockDoorFromCommand(...)`（内部复检 `interactionRange` 与 `canInteractWithDoorXZ`，再委托 `doorSystem.lock(id, 'DEEPSEEK')`）→ `applyDoorResult(id, result, 'DEEPSEEK')` → `deepseekAI.onDoorLockResult(id, result)`。

### 6.3 `src/config/gameConfig.ts`

- 本轮 **不新增任何参数**（规则 ①②③④ 全部复用现有键）。若后续人工验收暴露问题再按「统一数值管理规则」新增并同步 `docs/GAME_BALANCE_CONFIG.md`。

---

## 7. 自动化测试计划（3B-1+ 落地时实现）

参照 `tests/deepseek-door-escape.test.mjs` 的 harness 模式（构造 `nav`、`DoorSystem`、`makeInput`）。

1. **锁门通道**：发送 `lockDoorId` → `DoorSystem.lock` → `LOCKED`，`applyDoorResult` 触发 `DOOR_LOCK`。
2. **`lock()` 前置条件**：`OPEN` → `INVALID_STATE`；`DISABLED` Core → `LOCK_CORE_DISABLED`；3 把满 → `LOCK_LIMIT_REACHED`（不替换）。
3. **连续动作**：关门成功 → pending 置位 → 下一帧满足 8 条件 → 发出 `lockDoorId`。
4. **冷却例外**：pending 门的锁门评估不被关门冷却阻断；连续动作结束后，同门重新关门仍被 5000 ms 冷却拒绝。
5. **取消条件**：门重开 / 窗口超时 / Human 同侧 / 距离过近 / 无目视 / 真实危险（STUNNED、抓捕进度）/ 逃生路线不可达 / 剩余米堆全不可达 —— 均清 pending 且不锁。
6. **锁门失败不重试**：`LOCK_LIMIT_REACHED` → 清 pending，不循环。
7. **防振荡**：Human 重开门后 AI 不在冷却内再次关门/锁门。
8. **回归**：`deepseek-door-escape` / `deepseek-safe-wait` / `deepseek-curiosity` / `deepseek-curiosity-priority` / `deepseek-passage` / `deepseek-safety-regression` / `deepseek-evade` / `deepseek-ai` / `door-system` / `navigation` / `human-ai` / `human-door-skill` / `ai-log-collector` 全绿，且 `npm test` 总数 ≥ 270。

---

## 8. 浏览器人工验收计划

1. 正常追逐：穿门 → 关门 → 锁门成功，Human 被挡。
2. Human 贴脸/同侧：不锁，继续逃跑。
3. 锁位已满（3 把）：放弃锁门，继续逃跑。
4. 锁门会封死全部剩余米堆：放弃锁门。
5. Human 重开锁门：AI 不原地反复关门/锁门。
6. SAFE_WAIT / 静止 Human 好奇试探 / 安全通行仍正常，无周期性冲门。

---

## 9. 下一步与阶段边界

- **3B-0 已完成**：设计固化（本文档）——四项规则、连续动作状态机、冷却例外机制、接口盘点、测试/验收计划。
- **3B-0b 已完成**：接口落地（`lockDoorId` / `canLockDoor` / `activeLockSlots` / `lockDoorFromCommand` 执行端守卫 / `onDoorLockResult` / `drainDoorLockEvents` + `tests/deepseek-door-lock.test.mjs`）。
- **3B-1 已完成**：锁门决策核心——`onDoorEscapeResult` 在 EVADE 中成功主动关门且仍在 1800ms 过门窗口内时建立 `doorLockPendingId`；`updateSafety` 在逃跑目标选择后、`evaluateEscapeDoor` 之前调用 `evaluateEscapeLock`（带 `approachSpeed`），命中即发 `lockDoorId`。取消/失败一律清 pending（`evaluateEscapeLock` 任何 reject、`onDoorLockResult`、`enterEvade`、`beginRecovery`、STUNNED 早退）。新增 `tests/deepseek-door-lock-decision.test.mjs`（11 项）。
  - 实现与设计的两处最小差异（已按规则执行）：①`evaluateEscapeLock` 放在「无路线返回」与「到点 HOLD」**之前**，保证持点期间仍优先评估 pending 锁；②「A* 只算一次」通过「任何失败即清 pending」达成——成功路径在首个满足帧即发锁并随后清 pending，失败路径立即清，故每 pending 至多一次 A* 评估。
- **下一步（3B-2）**：防振荡（Human 重开门后冷却抑制、失败/取消后的收敛验证；机制上已由关门冷却 + pending 清除覆盖，3B-2 做定向回归与必要收紧）。
- 后续：3B-3 定向回归 → 3B-4 DEV/日志/文档归档。
- 不 commit / push / tag；不把 S7B 标记完成。
