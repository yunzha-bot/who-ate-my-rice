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
| `C.human.speedMultiplier` | 1.08 | 倍率；Human 相对基础速度 | 改动后重新测试追逐与抓捕胜率。 |
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
