# 《谁吃了我的米》数值配置索引

当前 Web / Three.js 灰盒版本的可调玩法数值统一放在 [`src/config/gameConfig.ts`](../src/config/gameConfig.ts)。下表里的 `C` 均表示 `GAME_CONFIG`。时间变量以 `Ms` 结尾时单位为毫秒，1 秒 = 1,000 毫秒；世界单位指 3D 场景的 XZ 地面坐标。改完配置后运行 `npm test`、`npm run build`，再对受影响玩法做人工验收。

## 开发与正式进食时间

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `RICE_MAX_PROGRESS_MS.production` | 60,000 | 毫秒；每份米正式进食时间 | 正式规则为 60 秒，发布前复测。 |
| `RICE_MAX_PROGRESS_MS.development` | 5,000 | 毫秒；开发测试时间 | 仅为频繁测试提速。 |
| `RICE_TIMING_MODE` | `development` | 模式；决定 `C.rice.maxProgressMs` | Beta / Release Candidate 前切换为 `production`。 |
| `C.rice.maxProgressMs` | 5,000 | 毫秒；运行时每份米最大进度 | 从上述模式自动得出，不要另设第二个进食时长。 |

当前没有对局倒计时或“开发/正式不同对局时限”的运行规则；`GameStateSystem.elapsedMs` 只累计已进行时间。不能只填写一个配置值就得到限时胜负，需要另行设计与实现该玩法。

## 角色、冲刺与抓捕

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.player.size` / `C.human.size` | 32 / 32 | 像素；占位体尺寸 | 改动视觉体型时检查逻辑碰撞圆，不要假设两者自动相等。 |
| `C.player.speed` | 230 | 像素/秒；DeepSeek 基础移动速度 | 运行时除以 `C.three.pixelsPerUnit`。 |
| `C.three.pixelsPerUnit` | 60 | 像素/世界单位；角色速度、米袋尺寸与进食距离的换算基准 | 地图坐标仍按世界单位绘制，修改会同时改变多套尺寸关系，需全面验收。 |
| `C.human.speedMultiplier` | 1.08 | 倍率；Human（包括玩家手动控制）的基础速度 | 改动后重新测试追逐与抓捕胜率。 |
| `C.collision.playerRadius` | 0.23 | 世界单位；两个角色的逻辑碰撞圆半径 | 会影响墙角、门框通行；不能直接当作抓捕圈半径。 |
| `C.collision.contactEpsilon` / `maxMovementSubstep` | 0.0001 / 0.12 | 世界单位；接触容差与单次移动分步上限 | 属碰撞稳定性参数，修改需回归 Wall Sliding 和防穿墙。 |
| `C.sprint.speedMultiplier` | 1.6 | 倍率；冲刺相对基础速度 | 追逐与墙角碰撞均受影响。 |
| `C.sprint.durationMs` | 2,500 | 毫秒；一次冲刺持续时间 | 冲刺开始后不能靠松开方向键取消。 |
| `C.sprint.riskThreshold` | 0.30 | 进度比例；开始冲刺时全局进度达到该值，结束必摔 | 此数值是已验收的 30% 玩法阈值。 |
| `C.sprint.stunMs` | 1,000 | 毫秒；摔倒眩晕 | 目前摔倒本身没有独立的持续计时参数。 |
| `C.match.captureRadius` | 0.70 | 世界单位；Human 抓捕圈半径 | 抓捕还须满足无遮挡和持续接触。 |
| `C.match.captureMs` | 350 | 毫秒；连续有效接触时间 | 离开圈或被墙/关门阻挡时进度清零。 |
| `C.match.readyMs` | 3,000 | 毫秒；开局准备时间 | 与正式对局已进行时间分开。 |
| `C.match.maxFrameDeltaMs` | 50 | 毫秒；单帧规则推进上限 | 为浏览器切换/卡帧稳定性服务，修改会影响所有逐帧计时。 |

## Human AI（S7A 开发参数）

AI 只在玩家正式选择 DeepSeek 时接管 Human。声音调查只使用声源所在区域，目视追逐才使用目标实时位置；抓捕仍由原有 `C.match` 规则裁决。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.humanAI.movementSpeedMultiplier` | 0.92 | 倍率；AI Human 在 Human 基础速度上的独立倍率，约降低 8% | 不影响玩家手动控制；巡逻、调查、追逐共用。 |
| `C.humanAI.aiUnlockDurationMs` | 8,750 | 毫秒；AI 单次模拟破解锁芯的耗时（原 5,000 毫秒的 1.75 倍） | 只影响 AI，不影响玩家扫雷或强破冷却。 |
| `C.humanAI.navCellSize` | 0.4 | 世界单位；XZ 寻路网格边长 | 改大可能漏掉门洞；改小会增加 A* 开销，须复测全图可达。 |
| `C.humanAI.repathIntervalMs` | 500 | 毫秒；追逐时最长路径刷新间隔 | 太大可能跟丢移动目标。 |
| `C.humanAI.waypointTolerance` | 0.25 | 世界单位；路径点到达容差 | 应与网格间距和角色步长一起调整，避免原地抖动。 |
| `C.humanAI.investigationDwellMs` | 3,000 | 毫秒；到达声音/最后目击区域后等待时间 | 调整搜索节奏，不改变感知范围。 |
| `C.humanAI.stuckRepathMs` | 800 | 毫秒；受阻后强制重新寻路阈值 | 太短可能频繁重算。 |
| `C.humanAI.stuckProgressEpsilon` | 0.05 | 世界单位；受阻检测窗口内至少应缩短的路径节点距离 | 太大可能将正常绕行误判为卡路；太小可能漏掉原地抖动。 |
| `C.humanAI.closedDoorPathCost` | 3 | 无量纲；路径经过普通关门格的额外成本 | 普通关门由 AI 通过现有 DoorSystem 打开。 |
| `C.humanAI.lockedDoorPathCost` | 12 | 网格代价；仅在比较可破解锁门路线与绕行路线时使用 | 仅允许规划经过锁门；实体锁门始终阻挡，AI 须先解锁或强破。 |
| `C.humanAI.aiUnlockSuccessChance` | 0.7 | 概率；AI 单次模拟解锁成功率 | 失败后的尝试上限与暂避机制保持原值。 |
| `C.humanAI.aiUnlockMaxAttempts` / `aiUnlockFailureAvoidMs` | 2 / 6,000 | 次 / 毫秒；同锁芯尝试上限及失败后暂避时间 | 两次失败后只能绕行或等待强破冷却。 |
| `C.humanAI.forceBreakReserveMs` / `detourSlackMs` | 1,800 / 600 | 毫秒；路线比较时的技能机会成本与绕行容差 | 仅影响 AI 决策；实际强破冷却仍取 `C.door.humanForceBreakCooldownMs`。 |
| `C.humanAI.searchRadius` / `searchRoomCount` | 12 / 3 | 世界单位 / 间；追丢后的邻近搜索范围和上限 | 不提供目标实时位置，目标来自 Last Seen。 |
| `C.humanAI.searchDwellMs` / `searchMaxMs` | 900 / 15,000 | 毫秒；搜索点停留和一次搜索时限 | 超时恢复巡逻，避免反复搜索同处。 |

## DeepSeek AI（S7B 开发参数）

仅在玩家正式选择 Human 且没有开发调试接管 DeepSeek 时运行。选米评分为导航路径长度按 DeepSeek 基础速度换算的行走毫秒数，加该米剩余进食毫秒数和既有准备时间；导航网格与关门路径代价复用现有 NavigationSystem，不复制配置。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.deepseekAI.waypointTolerance` | 0.25 | 世界单位；路径节点到达容差 | 需与共用网格及碰撞圆一同检查，避免拐角抖动。 |
| `C.deepseekAI.stuckRepathMs` | 800 | 毫秒；节点持续无进展后的重寻路阈值 | 调小会增加寻路次数。 |
| `C.deepseekAI.stuckProgressEpsilon` | 0.05 | 世界单位；卡路窗口内至少应靠近节点的距离 | 不改变玩家移动速度或碰撞体。 |
| `C.deepseekAI.maxStuckRepathsPerTarget` | 2 | 次；同一米堆连续卡路后暂避并换目标 | 有进展时重新计数。 |
| `C.deepseekAI.retryMs` | 1,500 | 毫秒；不可达米堆暂避及无目标重试间隔 | 门状态改变会立即触发重新规划。 |
| `C.deepseekAI.visionEvadeDistance` | 7 | 世界单位；目视 Human 的逃跑距离 | 过大容易频繁中断进食。 |
| `C.deepseekAI.soundEvadeStrength` | 0.09 | 最终可听强度；声音触发逃跑阈值 | 仍须通过现有听觉距离与遮挡判定。 |
| `C.deepseekAI.soundThreatProjection` | 4 | 世界单位；沿可听声音八方向估计威胁 | 不是隐藏 Human 的真实位置。 |
| `C.deepseekAI.lastSeenAlertMs` | 2,500 | 毫秒；最后目击点的短期警戒 | 已拉开安全距离时，不把旧目击信息当成强制静止。 |
| `C.deepseekAI.alertHoldMs` | 1,800 | 毫秒；最后一次高威胁后的警戒记忆 | 安全路线已成立时可转入移动恢复，防止进食与逃跑逐帧抖动。 |
| `C.deepseekAI.minimumEvadeMs` | 900 | 毫秒；单次逃跑最短时长 | 与警戒时长共同决定恢复时机。 |
| `C.deepseekAI.recoverMs` | 1,200 | 毫秒；脱险后沿安全米点路线移动的警戒上限 | 不强制原地等待；结束后恢复进食，保留既有大米进度。 |
| `C.deepseekAI.escapeReplanMs` | 700 | 毫秒；逃跑选路最短重算间隔 | 过短会增加网格寻路开销。 |
| `C.deepseekAI.escapeMinSeparation` | 3 | 世界单位；优先逃跑目标与估计威胁的间距 | 不可达时允许退回其他候选。 |
| `C.deepseekAI.escapeMinTravel` | 2 | 世界单位；避免原地选点的最短路程 | 地图空间受限时须留可达候选。 |
| `C.deepseekAI.escapeGoalTolerance` | 0.8 | 世界单位；逃跑目标到达容差 | 太小可能导致到点抖动。 |
| `C.deepseekAI.escapeCoverBonus` | 4 | 评分；有墙或关门遮挡的奖励 | 仅在路线可达时加分。 |
| `C.deepseekAI.escapeDeadEndPenalty` | 6 | 评分；少于两个可用门出口的惩罚 | 避免优先逃入死胡同。 |
| `C.deepseekAI.escapeTravelPenalty` | 0.7 | 每世界单位路线的评分惩罚 | 与安全间距及遮挡奖励共同评估。 |
| `C.deepseekAI.escapeTowardThreatPenalty` | 3 | 评分；起步接近估计威胁的惩罚 | 绕路必要时仍允许选取。 |
| `C.deepseekAI.escapeGoalHoldMs` | 2,500 | 毫秒；常规逃跑目标最短保持时长 | 断路或目标明显不安全可提前换路。 |
| `C.deepseekAI.escapeSwitchScoreMargin` | 2.5 | 评分；新目标超过旧目标才切换的差值 | 提高可减少相邻目标来回切换。 |
| `C.deepseekAI.escapeVisitMemoryMs` | 12,000 | 毫秒；近期房间访问记忆窗口 | 到期后访问惩罚自然消失，暂停期间 AI 时间冻结。 |
| `C.deepseekAI.escapeRecentVisitCount` | 4 | 房间/区域记录条数 | 只保留最近的实际经过区域。 |
| `C.deepseekAI.escapeRecentVisitPenalty` | 5 | 评分；刚访问房间每次的最大扣分 | 按访问年龄线性衰减；唯一可达房间仍可选择。 |
| `C.deepseekAI.escapeLoopMinDistanceGain` | 1 | 世界单位；重访区域应取得的最小安全距离增益 | 未达到时触发一次跨区域重新决策。 |
| `C.deepseekAI.escapeNearScoreBand` | 0.8 | 评分；允许随机挑选的近最高分区间 | 明显低分或危险候选不参与随机选择。 |
| `C.deepseekAI.safeObservationMs` | 2,500 | 毫秒；缺少可用威胁方位时的持续观察时间 | 已知威胁方位且拉开距离时，可提前进入移动恢复。 |
| `C.deepseekAI.soundCautionStrength` | 0.045 | 最终可听强度；弱声音仍阻止脱险的阈值 | 低于此值的远处声音不阻止恢复。 |
| `C.deepseekAI.dangerRiceAvoidMs` | 8,000 | 毫秒；暂避已知威胁附近米堆或其路径 | 不清除已有进食进度；仅逃跑后生效。 |
| `C.deepseekAI.dangerRouteRadius` | 3 | 世界单位；米堆或路径靠近最后威胁点的判定半径 | 过大可能使多个米堆暂不可选。 |
| `C.deepseekAI.escapeExtraExitBonus` | 1.2 | 评分；每个额外可用房间出口的奖励 | LOCKED 门不算可用出口。 |
| `C.deepseekAI.escapeAlternateRouteBonus` | 2 | 评分；被堵出口可绕路时的奖励 | 替代路线仍需通过原有导航。 |
| `C.deepseekAI.escapeBlockedExitPenalty` | 9 | 评分；Human 靠近首个出口且不可绕时的惩罚 | 不允许把锁门当可通行捷径。 |
| `C.deepseekAI.escapeRouteThreatPenalty` | 3 | 每世界单位评分；路径节点靠近已知威胁的惩罚 | 计算基于导航节点，而非仅目标直线距离。 |
| `C.deepseekAI.exitBlockRadius` | 2.5 | 世界单位；认为 Human 正接近路径出口的半径 | 仅使用目视或最后已知方位，不读取隐藏实时坐标。 |
| `C.deepseekAI.alternateRouteMaxRatio` | 2 | 倍率；绕开被堵出口允许的最长路程比 | 避免为绕门选择过长路线。 |
| `C.deepseekAI.approachSprintDistance` | 6 | 世界单位；Human 明显逼近时可提前冲刺的距离 | 仍受原有 30% 摔倒规则约束。 |
| `C.deepseekAI.approachSpeedThreshold` | 0.35 | 世界单位/秒；相邻目视距离缩短达到此值视为逼近 | 不增加 AI 移动速度。 |
| `C.deepseekAI.blockedExitSprintDistance` | 3.5 | 世界单位；Human 逼近路径出口时的紧急冲刺距离 | 冲刺仍使用现有持续时间与眩晕。 |
| `C.deepseekAI.safeSprintDistance` | 5 | 世界单位；低进食风险时的目视冲刺阈值 | 使用原 SprintSystem 时长与能量规则。 |
| `C.deepseekAI.riskySprintDistance` | 2.2 | 世界单位；高进食风险时的紧急目视冲刺阈值 | 达到既有 30% 风险后冲刺结束会摔倒。 |
| `C.deepseekAI.sprintSoundStrength` | 0.22 | 最终可听强度；未目视且低风险时冲刺阈值 | 不能绕过声音遮挡。 |

## 角色动作表现（S7A 占位接口）

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.characterAnimation.fallPoseMs` | 220 | 毫秒；FALL 白模姿态持续时间 | 只影响画面，不改变 `C.sprint.stunMs`。 |
| `C.characterAnimation.transitionMs` | 120 | 毫秒；未来 AnimationMixer 片段切换淡入 | 当前无正式动画片段，不影响玩法。 |
| `C.characterAnimation.specialIdleTriggerMs` | 5,000 | 毫秒；连续普通 IDLE 后开始播放特殊待机的门槛 | 仅动画表现；没有已接入片段时维持白模 IDLE。 |
| `C.characterAnimation.specialIdleRepeatIntervalMs` | 15,000 | 毫秒；特殊待机两次开始之间的最短间隔 | 只影响播放频率；移动或更高优先级动作会中断待机。 |
| `C.characterAnimation.specialIdleSlots` | `IDLE_01`～`IDLE_05` | 片段插槽名单 | 只从此名单中已经由 AnimationMixer 接入的片段抽选，缺失资源忽略。 |
| `C.characterAnimation.stunColor` | `0xff7777` | 颜色；白模 FALL/STUN 反馈 | 纯视觉，角色基础色仍取 `C.player.color` / `C.human.color`。 |

## Rice 与米痕

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.rice.candidateCount` | 14 | 处；地图中参与随机抽选的前 N 个候选米点 | 坐标仍在 `src/three/map/apartmentMap.ts`；超过已绘制的 14 处会报错，新增坐标不能只改配置。 |
| `C.rice.activeCount` | 5 | 份；每局从候选池中无重复激活的米数 | 必须在 1 到候选池大小之间；全部吃完即胜利。 |
| `C.rice.prepareMs` | 400 | 毫秒；开始/恢复进食的准备阶段 | 准备阶段不计入正式进食进度。 |
| `C.rice.interactionRange` | 60 | 像素；靠近米的交互范围 | 运行时除以 `C.three.pixelsPerUnit`，目前等于 1 世界单位。 |
| `C.rice.size` / `color` | 30 / `0xf2e5bc` | 像素 / 颜色；米袋占位体 | 只影响显示尺寸和颜色。 |
| `C.rice.visual.fullHeight` / `emptyHeight` | 0.62 / 0.08 | 世界单位；饱满和空袋高度 | 与实际进食进度联动。 |
| `C.rice.visual.fullBulgeHeight` / `emptyWidthScale` | 0.22 / 0.92 | 世界单位 / 比例；袋顶鼓起与空袋宽度 | 属米袋视觉形变。 |
| `C.perception.traceGenerationMs` | 5,000 | 毫秒；实际进食增长后可生成脚印的窗口 | 继续进食会刷新窗口，静止不会生成脚印。 |
| `C.perception.traceStepDistance` | 0.65 | 世界单位；生成相邻脚印的移动步距 | 调小会增多脚印与 Mesh 数量。 |
| `C.perception.traceLifetimeMs` | 15,000 | 毫秒；每个脚印从生成起独立计时的寿命 | 生成窗口结束不删除已有脚印。 |
| `C.perception.traceFadeMs` | 3,000 | 毫秒；脚印寿命末段的平滑淡出 | 应大于 0，且不应超过单个脚印寿命。 |
| `C.perception.traceVisual.color` / `opacity` | `0x9aa4aa` / 0.88 | 颜色 / 不透明度；脚印材质 | Human 正式信息观察者可见。 |
| `C.perception.traceVisual.footprintRadius` / `widthScale` / `lengthScale` | 0.18 / 0.7 / 1.45 | 世界单位 / 倍率；单个脚印形状 | 调尺寸后检查脚印与米袋、地面遮挡。 |
| `C.perception.traceVisual.sideOffset` / `forwardOffset` / `groundOffset` | 0.14 / 0.07 / 0.075 | 世界单位；左右脚错位及离地高度 | 离地高度过低可能与地面闪烁。 |

## Door、Human Force Break 与扫雷

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.door.interactionRange` / `interactionEndInset` | 1.3 / 0.08 | 世界单位；可操作门距离和门段端点内缩 | 门交互仍要求可达、不可隔墙；修改需检查门框侧边。 |
| `C.door.maxActiveLocks` | 3 | 把；同时有效的锁 | 破解/强破后释放一格，失效锁芯本局不能重锁。 |
| `C.door.humanFreeOpenClosedDoor` | `true` | 开关；Human Space 免费快速打开普通 CLOSED 门 | 设为 `false` 会禁用该 Space 行为；E 普通开门不受影响。 |
| `C.door.humanForceBreakCooldownMs` | 30,000 | 毫秒；Space 强破 LOCKED 门的冷却 | 不限制普通门快速开，也不限制 E 扫雷。 |
| `C.door.leafHeight` / `leafThickness` / `openAngle` | 1.2 / 0.16 / `Math.PI / 2` | 世界单位 / 世界单位 / 弧度；门叶几何 | 门厚会影响碰撞、视线和声音的门遮挡判定。 |
| `C.door.colors.open` / `closed` / `locked` / `lockCore` / `lockCoreDisabled` | `0x6d8f73` / `0x8a644b` / `0xa0443f` / `0xffc247` / `0x565d63` | 颜色；灰盒门叶与锁芯状态 | 只改变显示，保持不同状态容易辨认。 |
| `C.pulseLock.rows` / `cols` / `mines` | 4 / 4 / 3 | 行 / 列 / 颗；扫雷棋盘 | 雷数必须至少 1 且小于格数；修改后测试首次点击和胜利判定。 |
| `C.pulseLock.firstRevealSafe` | `true` | 开关；首次揭格不放雷 | 改为 `false` 将允许首击踩雷，会改变当前已验收规则。 |
| `C.pulseLock.failureFeedbackMs` | 1,500 | 毫秒；踩雷后的状态反馈时间 | 不影响门是否仍 LOCKED。 |

## Sound 与声音可视化

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.perception.footstepIntervalMs` / `sprintStepIntervalMs` / `riceSoundIntervalMs` | 650 / 330 / 1,200 | 毫秒；相应声音事件最小间隔 | 越短事件越密集。 |
| `C.perception.minimumMovementSoundDistance` | 0.002 | 世界单位/帧；低于该实际位移不发脚步声 | 防止角色抖动产生脚步事件。 |
| `C.perception.distanceFalloffPower` | 1 | 指数；声音按 `(1 - 距离 / range) ^ 指数` 衰减 | 1 保留当前线性衰减；越大远距离越弱。 |
| `C.perception.wallSoundFactor` / `openDoorSoundFactor` / `closedDoorSoundFactor` / `lockedDoorSoundFactor` | 0.28 / 1 / 0.45 / 0.35 | 每穿过一处障碍的强度倍率 | Open 门默认不额外削弱；多处遮挡的倍率相乘。 |
| `C.perception.minimumAudibleStrength` | 0.015 | 最终强度阈值；低于它不算听到 | 开发调试探针仍可显示不可听事件。 |
| `C.perception.soundVisual.radius` / `nearMax` / `midMax` / `bandHysteresis` | 18 / 2.5 / 6.5 / 0.3 | 世界单位；显示圈及近/中/远颜色阈值、切换缓冲 | 显示半径不是所有事件的统一听觉范围；事件以各自 `range` 为准。 |
| `C.perception.soundVisual.colors.far` / `mid` / `near` | `0x54aaff` / `0xffd45f` / `0xff635b` | 颜色；蓝/黄/红波纹 | 只影响场景提示。 |
| `C.perception.soundVisual.waveFullStrength` / `waveFadeMs` | 0.45 / 420 | 最终强度 / 毫秒；波纹亮度归一化与临近过期淡出 | 不改变 SoundEvent 的真实可听强度。 |
| `C.perception.soundVisual.hudMidStrength` / `hudHighStrength` | 0.25 / 0.55 | 最终强度；HUD 文字颜色分界 | 仅显示反馈，需保持前者小于后者。 |

每类 `C.perception.sounds.<类型>` 都有 `range`（世界单位）、`strength`（原始强度）和 `lifetimeMs`（毫秒）。`range` 之外不可感知，`strength × 距离系数 × 遮挡倍率` 得到最终可听强度。

| 类型 | range | strength | lifetimeMs |
|---|---:|---:|---:|
| `FOOTSTEP` | 17 | 0.35 | 1,400 |
| `RICE_EAT` | 7 | 0.7 | 1,200 |
| `SPRINT` | 18 | 0.8 | 1,200 |
| `FALL` | 10 | 1 | 1,500 |
| `DOOR_OPEN` | 6 | 0.6 | 1,000 |
| `DOOR_CLOSE` | 6 | 0.65 | 1,000 |
| `DOOR_LOCK` | 5 | 0.65 | 1,000 |
| `FORCE_BREAK` | 10 | 1 | 1,500 |
| `LOCK_BREAK` | 7 | 0.8 | 1,200 |

## Vision

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.perception.visionRange` | 11 | 世界单位；双方距离超过它时 OUT_OF_RANGE | 墙及 CLOSED/LOCKED 门仍会阻挡范围内视线；OPEN 门不阻挡。 |
| `C.perception.lastSeenMs` | 8,000 | 毫秒；失去视线后 Last Seen 保留时间 | Last Seen 与当前 VISIBLE/BLOCKED 状态分开。 |

## 留在源码内的常量

地图米点、门、房间、墙和家具的具体坐标属于关卡内容，保留在 `src/three/map/apartmentMap.ts`。角色状态枚举、扫雷相邻格遍历、距离与角度计算、视觉 Mesh 分段和波纹动画形状属于规则或内部实现；它们不适合作为日常平衡数值。当前配置中心可调参与抽选的候选数量，**不能仅通过改配置增加第 15 个米点坐标**。

当前默认参数保持 S6D 已有玩法手感；改变已人工验收的规则（例如 30% 冲刺风险、0.35 秒抓捕、首击安全或开发/正式进食时间）后，应重新进行相应 Gate 验收。
