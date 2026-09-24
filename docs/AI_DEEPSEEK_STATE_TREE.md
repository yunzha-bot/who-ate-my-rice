# DeepSeek AI 状态树（当前工作区源码）

依据：src/systems/DeepSeekAIController.ts、NavigationSystem.ts、PerceptionSystem.ts、RiceField.ts、RiceSystem.ts、SprintSystem.ts、DoorSystem.ts、GameStateSystem.ts、src/three/ThreeGame.ts 及 src/config/gameConfig.ts。**SEEK_RICE～RECOVER 属于已接入的 S7B-1/2；CURIOUS_APPROACH、CURIOUS_OBSERVE 和 CURIOUS_PASSAGE 已写进当前未提交工作区，但好奇/安全通行分支尚未完成本轮自动和人工验收。**“已编码”不等于“已验证 PASS”。

## 状态树与正交标记

DeepSeekAIState 是扁平联合类型，下面的父节点只作阅读分组，不是代码里的层级状态机：

- 找米：SEEK_RICE、MOVE_TO_RICE、EAT、RESELECT（已实现）
- 生存：EVADE、RECOVER（已实现）
- 好奇：CURIOUS_APPROACH、CURIOUS_OBSERVE（当前工作区已编码，待验收）
- 静止 Human 安全通行：CURIOUS_PASSAGE（当前工作区已编码，待验收）

passageActive 可在 AI 的 EAT 状态中仍为 true；curiosityBypassActive 可在 MOVE_TO_RICE 中仍为 true，故二者是**并行许可标志**，不能只看 state 名称判断威胁折扣。ThreatSource NONE / VISION / SOUND / LAST_SEEN / MEMORY 与 threatLevel NONE / CAUTION / HIGH 是感知评估/记忆，不是 AI 状态。SprintState NORMAL / SPRINT_RUNNING / STUNNED 是独立 SprintSystem 状态；RiceInteractionState PREPARING / EATING / INTERRUPTED / COMPLETED 属于 RiceSystem，不是 AI 状态。

## 基础找米与生存转换

图中 “HIGH” 为本帧评估到的高威胁；安全通行/好奇许可的临时降级与取消见下一图。

```mermaid
stateDiagram-v2
    [*] --> SEEK_RICE: 创建或重开
    SEEK_RICE --> MOVE_TO_RICE: 找到成本最低的可达未完成米
    SEEK_RICE --> RESELECT: 全部米不可达或暂避中
    RESELECT --> MOVE_TO_RICE: 重试间隔到或门状态改变且有路线
    RESELECT --> RESELECT: 未到重试时间或仍无路
    MOVE_TO_RICE --> EAT: 到米交互范围内
    EAT --> MOVE_TO_RICE: 离开范围或尚有目标需接近
    EAT --> RESELECT: 米完成或目标失效
    MOVE_TO_RICE --> RESELECT: 目标失效或两次卡路或路线不可达
    SEEK_RICE --> EVADE: 当前威胁 HIGH
    MOVE_TO_RICE --> EVADE: 当前威胁 HIGH
    EAT --> EVADE: 当前威胁 HIGH 且进食被中断
    RESELECT --> EVADE: 当前威胁 HIGH
    EVADE --> EVADE: 威胁仍高或安全条件未齐或继续跨房间逃跑
    EVADE --> RECOVER: 非 HIGH 且安全距离及安静时长达标并有可行返回条件
    RECOVER --> EVADE: 再次出现 HIGH 威胁
    RECOVER --> MOVE_TO_RICE: 安全米路线到达或警戒时限结束且有目标
    RECOVER --> RESELECT: 警戒时限结束但无目标
```

EAT 是“AI 发出 eatRiceId”的意图状态，不代表已过准备阶段。ThreeGame 在静止、Sprint NORMAL 且仍在范围时才把此意图交给唯一 RiceField.update；RiceSystem 负责每次 400 ms 准备、进度保留、完成与 5/5 胜利。EVADE 或移动导致进食中断但不清既有进度。

## 好奇、安全通行及失败分支（已编码、待验收）

此图中的“普通状态”表示 SEEK_RICE / MOVE_TO_RICE / EAT / RESELECT；安全通行尝试在每帧普通威胁评估**之前**运行，故也可能在 EVADE/RECOVER 中抢占。图只标实际代码可走的边。

```mermaid
stateDiagram-v2
    state "普通找米状态" as NORMAL
    NORMAL --> CURIOUS_APPROACH: 目视 Human 静止满 5 秒且 CAUTION 并通过 10% 单次抽签且有安全观察路线
    CURIOUS_APPROACH --> CURIOUS_OBSERVE: 到达观察点
    CURIOUS_OBSERVE --> MOVE_TO_RICE: 观察 1.8 秒后有距 Human 至少 3u 的安全米路线
    CURIOUS_OBSERVE --> EVADE: 没有安全米路线
    CURIOUS_APPROACH --> EVADE: Human 移动或失视或危险声音或抓捕进度或安全距离破坏或路径失效
    CURIOUS_OBSERVE --> EVADE: Human 移动或失视或危险声音或抓捕进度或安全距离破坏
    MOVE_TO_RICE --> EVADE: 好奇绕行许可期间路线失效或危险条件出现
    NORMAL --> CURIOUS_PASSAGE: 目视 Human 静止满 5 秒且挡在米路上并通过 80% 单次抽签且有圈外路径
    EVADE --> CURIOUS_PASSAGE: 相同安全通行条件在威胁评估前成立
    RECOVER --> CURIOUS_PASSAGE: 相同安全通行条件在威胁评估前成立
    CURIOUS_PASSAGE --> EAT: 到达目标米交互范围且通行许可仍有效
    EAT --> CURIOUS_PASSAGE: 通行许可有效且仍需沿圈外路线前进
    CURIOUS_PASSAGE --> SEEK_RICE: 通行目标完成或失效并结束许可
    CURIOUS_PASSAGE --> EVADE: Human 移动或失视或危险声音或抓捕进度或小于避让半径或路线失效
    EAT --> EVADE: 通行许可有效但出现取消条件
```

如果 80% 抽签失败，标记该静止事件已抽过，不在同一事件逐帧重抽；仍按正常威胁/找米流程。抽中但无安全路线时记录 NO_SAFE_ROUTE，也不穿过抓捕圈。通行分支一旦抽过，同时抑制同一事件的 10% 好奇抽签。若普通好奇抽签失败、无安全观察点或中断，分别按代码保留当前流程或进入 EVADE，并在结束/中断后进入 12 秒好奇冷却。普通好奇观察后启用 curiosityBypassActive，允许继续已检查的米路线；如果失视但没有危险声音，撤销后续视线折扣而不强制重置当前米路线。安全通行没有独立“永久 Human 安全”状态，Human 移动、失视或有效危险应取消许可。

## 每个状态的条件

| 状态 | 进入 | 保持/实际行为 | 退出 |
|---|---|---|---|
| SEEK_RICE | 初始、重开、通行目标失效后 | 下一次有效 update 按成本寻找未完成米 | 有目标 → MOVE_TO_RICE；无目标 → RESELECT；HIGH → EVADE；符合好奇/通行条件 → 对应状态 |
| MOVE_TO_RICE | 选米、RECOVER 结束、好奇观察后的安全绕行 | 共享 A* 路径；普通关门可打开，锁门不可走；按路径点移动 | 到米附近 → EAT；无路/卡路/米失效 → RESELECT；HIGH → EVADE；可能被试探抢占 |
| EAT | 在交互范围内 | 发出 eatRiceId 并静止；实际准备/进度在 RiceField | 米完成/失效 → RESELECT；离开 → MOVE_TO_RICE；HIGH/通行取消 → EVADE |
| RESELECT | 米失效、无路或连续卡路 | 1,500 ms 后重试；门状态变化可提前重试，暂避不可达米 | 有可达目标 → MOVE_TO_RICE；HIGH → EVADE |
| EVADE | HIGH 威胁，或好奇/通行中断 | 选可达房间、沿路移动；可按条件请求现有冲刺。STUNNED 时外部规则禁动；真正无路返回零方向并给原因 | 非 HIGH、足够安静/拉开距离、最短逃跑时间与路线条件满足 → RECOVER；安全通行可在威胁评估前抢占 |
| RECOVER | EVADE 满足脱险条件 | 1,200 ms 内**沿安全米路线移动**，不是必须站立；危险米/路径暂避 | 再次 HIGH → EVADE；到安全米或计时结束 → MOVE_TO_RICE / RESELECT；安全通行可能抢占 |
| CURIOUS_APPROACH | 目视远距 CAUTION 的静止 Human、单次 10% 通过且往返路径安全 | 走向至少 3 u 外的观察点 | 到点 → CURIOUS_OBSERVE；危险/路径失效 → EVADE |
| CURIOUS_OBSERVE | 到安全观察点 | 原地观察 1,800 ms；可触发表现层好奇动作插槽，但无正式素材 | 有安全米路线 → MOVE_TO_RICE + 临时绕行许可；否则/危险 → EVADE |
| CURIOUS_PASSAGE | 静止 Human 挡住预计米路线，单次 80% 抽中，存在 1.35 u 圈外动态路径 | 在当前 Human 可见位置外规划安全路径；必要时换别的米；普通门仍可开 | 到米 → EAT（许可仍在）；目标完成/失效 → SEEK_RICE；危险/失视/路径不安全 → EVADE |

优先级不是简单固定列表：外部控制门控/比赛阶段先决定是否调用 AI；本帧先推进既有计时/卡路/门签名，再检查可见 Human 的静止事件及 80% 通行，之后取消不安全许可、评估威胁；HIGH 抢占普通找米与好奇，接着处理有效通行、EVADE/RECOVER、好奇、最后普通找米。STUNNED 在生存动作中禁动，最终 SprintSystem.movementDirection 也执行禁动。暂停由 ThreeGame 停止 PLAYING 更新，冻结 AI 计时。开发临时接管与正式控制 DeepSeek 时 AI 不调用，交还后重建路径；重开 reset。

## 感知公平性与目标/路径

| 信息 | 实际来源 | 精度/用途 |
|---|---|---|
| visibleHuman | VisionSystem 当前无遮挡且范围内才由 ThreeGame 传 Human 当帧位置 | 仅此时可用精确 Human 坐标、距离和静止计时；距离 ≤ 7 u 为 HIGH，较远为 CAUTION |
| heardHuman | SoundEventSystem.heardBy 的可听 Human 声音，已计算范围、距离与墙/门遮挡 | 隐身时只把声源方向量化为八方向，再投射 4 u 的**粗略威胁点**；不把声音事件的精确坐标直接用作逃跑目标 |
| lastSeenHuman | VisionSystem 在上次真看见 Human 时保存的历史点/时间 | AI 仅在失视后 2,500 ms 内作为 CAUTION；不是实时位置 |
| rice / rooms / doors | 游戏系统给的五份激活米真实状态、地图房间与当前门状态 | 找米和路线所需的对象信息，不属于对 Human 的透视感知 |
| captureProgressMs / sprintState | GameStateSystem、SprintSystem 的现有玩法状态 | 有实际抓捕进度时取消试探；冲刺/眩晕按原规则生效 |

选米：对未完成、未临时避让的米，用共享 NavigationSystem 的可达路径计算 **路径长度 ÷ DeepSeek 基础速度 + 剩余进食毫秒 + 400 ms 准备**；最小者优先，同分按米 ID。房间级逃跑：对实际可达房间中心评分，综合可信威胁点距离、路线长度和沿路风险、墙/门遮挡、可用出口、死路/堵出口/替代路线、近 4 次房间访问惩罚（12 秒衰减）；近分候选（0.8 分带内）随机选。目标通常保持 2,500 ms，危险增大、路径失效、局部循环或抵达后仍有 HIGH 才重评估。循环检测为重访房间且安全距离没有增加至少 1 u；真正没有可达房间时返回零移动并标原因。动态安全通行使用同一个 NavigationSystem 的临时 avoidCircle，不另建寻路器；最终移动仍经过 CollisionWorld，普通关门可开、锁门不能穿。

## 当前 GAME_CONFIG 数值索引

下表均为 src/config/gameConfig.ts 中真实变量；u 为 XZ 世界单位，ms 为毫秒，评分常数无量纲。本轮不改值。

| 变量（均以 GAME_CONFIG.deepseekAI. 为前缀，除注明外） | 当前值 | 单位/作用 |
|---|---:|---|
| waypointTolerance / stuckRepathMs / stuckProgressEpsilon / maxStuckRepathsPerTarget / retryMs | 0.25 / 800 / 0.05 / 2 / 1,500 | u / ms / u / 次 / ms；路径与换米 |
| visionEvadeDistance / soundEvadeStrength / soundThreatProjection / lastSeenAlertMs | 7 / 0.09 / 4 / 2,500 | u / 最终声音强度 / u / ms |
| alertHoldMs / minimumEvadeMs / recoverMs / safeObservationMs / soundCautionStrength | 1,800 / 900 / 1,200 / 2,500 / 0.045 | ms / ms / ms / ms / 强度；警戒恢复 |
| escapeReplanMs / escapeGoalHoldMs / escapeSwitchScoreMargin / escapeGoalTolerance | 700 / 2,500 / 2.5 / 0.8 | ms / ms / 分 / u；逃跑目标保持 |
| escapeMinSeparation / escapeMinTravel / escapeVisitMemoryMs / escapeRecentVisitCount / escapeRecentVisitPenalty / escapeLoopMinDistanceGain / escapeNearScoreBand | 3 / 2 / 12,000 / 4 / 5 / 1 / 0.8 | u / u / ms / 条 / 分 / u / 分 |
| escapeCoverBonus / escapeDeadEndPenalty / escapeTravelPenalty / escapeTowardThreatPenalty / escapeRouteThreatPenalty | 4 / 6 / 0.7 / 3 / 3 | 评分权重；遮挡/死路/路程/朝威胁/路线风险 |
| escapeExtraExitBonus / escapeAlternateRouteBonus / escapeBlockedExitPenalty / exitBlockRadius / alternateRouteMaxRatio | 1.2 / 2 / 9 / 2.5 / 2 | 分 / 分 / 分 / u / 倍；出口策略 |
| dangerRiceAvoidMs / dangerRouteRadius | 8,000 / 3 | ms / u；脱险后暂避危险米路线 |
| approachSprintDistance / approachSpeedThreshold / blockedExitSprintDistance | 6 / 0.35 / 3.5 | u / u每秒 / u；提前冲刺 |
| safeSprintDistance / riskySprintDistance / sprintSoundStrength | 5 / 2.2 / 0.22 | u / u / 声音强度；安全/风险冲刺 |
| curiosityStillMs / curiosityChance / curiosityMovementEpsilon | 5,000 / 0.10 / 0.05 | ms / 概率 / u；一次静止事件一次抽签 |
| curiositySafeDistance / curiosityObserveMs / curiosityCooldownMs / curiosityApproachTolerance | 3 / 1,800 / 12,000 / 0.5 | u / ms / ms / u |
| stationaryPassageChance / stationaryPassageSafetyMargin / stationaryPassageCheckIntervalMs | 0.80 / 0.65 / 500 | 概率 / u / ms；安全通行 |
| GAME_CONFIG.match.captureRadius | 0.70 | u；通行避让半径与抓捕圈，合计 1.35 u |
| GAME_CONFIG.rice.prepareMs / interactionRange / maxProgressMs | 400 / 60 / 5,000 | ms / 像素 / ms；当前开发模式每份 5 秒，正式值 60,000 ms |
| GAME_CONFIG.sprint.durationMs / speedMultiplier / riskThreshold / stunMs | 2,500 / 1.6 / 0.30 / 1,000 | ms / 倍 / 全局米进度比例 / ms |
| GAME_CONFIG.perception.visionRange / lastSeenMs / minimumAudibleStrength | 11 / 8,000 / 0.015 | u / ms / 强度；感知输入 |

声音各事件 range/strength/lifetime 与 wallSoundFactor 0.28、openDoorSoundFactor 1、closedDoorSoundFactor 0.45、lockedDoorSoundFactor 0.35 也由 GAME_CONFIG.perception 配置。好奇可视动作插槽是表现层预留，不改变上表玩法计算。

## 静态风险（不是本轮测试结论）

- 安全通行尝试在 assessThreat 前运行，且未排除 EVADE/RECOVER；静止且可见、挡路时可能先从逃跑/恢复转到通行。实际优先级取决于当前输入与取消条件，不能简单声称“紧急逃跑永远先于好奇”。
- 通行期间 state 可变成 EAT，但 passageActive 仍为 true；仅按 state 制作 HUD 或排查可能误判许可仍在。类似地，普通好奇完成后 MOVE_TO_RICE 可伴随 curiosityBypassActive。
- 可见 Human 的小位移 ≤ 0.05 u 会继续累计“静止”；边界处抖动可能使一次静止事件与视线丢失重置交替。80% 抽签先于 10%，挡路时会抑制好奇观察抽签。
- EVADE 到达房间中心且 HIGH 时会暂时零方向等待重评估；真正无路、开门等待、STUNNED、RECOVER 无安全米路线、RESELECT 重试间隔也会零方向。它们需要与拐角卡路区分。
- 非 HIGH 的可听声音仍为 CAUTION；RECOVER 的安全米路线检查和 Last Seen/安静计时可能延迟恢复，安全条件在边界波动时可能再转 EVADE。
- 门状态签名变化、路径点停滞、目标米失效会清路径或重新选目标；房间评分的近分随机与目标保持、回访惩罚同时存在，仍可能出现局部循环。当前未提交的通行分支**尚未执行本轮自动测试或人工验收**，以上为代码静态风险而非已复现故障。
- resumeAfterManualControl 现会显式撤销 passageActive，再清路径并结束普通好奇；临时接管后归还控制的定向测试已覆盖该状态清理。浏览器手感仍待人工验收。
