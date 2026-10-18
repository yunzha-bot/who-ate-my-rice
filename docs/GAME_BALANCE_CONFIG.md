# 《谁吃了我的米》数值配置索引

当前 Web / Three.js 灰盒版本的可调玩法数值统一放在 [`src/config/gameConfig.ts`](../src/config/gameConfig.ts)。下表里的 `C` 均表示 `GAME_CONFIG`。时间变量以 `Ms` 结尾时单位为毫秒，1 秒 = 1,000 毫秒；世界单位指 3D 场景的 XZ 地面坐标。改完配置后运行 `npm test`、`npm run build`，再对受影响玩法做人工验收。

当前规则：本表的 AI 列记录 `GAME_CONFIG` 基础值；各档仅按玩家阵营覆盖对手的批准字段，完整档位表与接入说明见 [难度配置](DIFFICULTY_DESIGN.md)。2026-10-17用户批准本地正式配置试调为20秒/份（原30秒），仍5份；DEV-B保存预设保留但不再在刷新／新局自动应用，只能手动加载。有效值优先级为本局显式DEV覆盖＞本局难度＞GAME_CONFIG基础值，不能只看本表默认值。

2026-10-18困难区域灯光新增`C.roomLights`：`interactionRange=1.5`世界单位（默认1.5，玩家/AI近距操作）、`toggleCooldownMs=3000`毫秒（默认3000，同一照明区域双方及多开关共享冷却，暂停冻结）、`aiDetourRange=4`世界单位（默认4，仅本照明区就近绕行）、`aiSafeDistance=2.5`世界单位（默认2.5，DP不能为关灯更靠近可见Human或进入安全距离）。用户后续批准无墙连通的两个健身分区共用照明及冷却，复用地图开放连接，不改变这些数值。调大交互距离更易操作，缩短切换间隔更易争抢；调大绕行距离/缩小安全距离可能影响AI任务压力，均需两方试玩。默认全关；亮区目标取消玩家/AI距离限制，墙门/真正藏身门禁仍在；关灯回到5单位和原1秒显示保留，不改变AI目击丢失时机。简单/普通不使用这套规则，详见[区域灯光设计](ROOM_LIGHTS_DESIGN.md)。

2026-10-18显示延迟补充：`C.difficulty.hardNightHideDelayMs=1000`（毫秒，默认1000）。仅困难两种主控阵营：已看见对手超距/墙门遮挡后，模型、手持物、阴影和身体网保留1秒；重新看见重置，真正藏身立即清零隐藏，从未看见不显示。该值只影响表现，不延长下述AI视觉/Last Seen；增大保留更久，0恢复即时隐藏。使用既有游戏时间，暂停/说明层/DEV冻结不扣时，换局/观察者清空；不是渐隐或固定位置残影。

2026-10-18用户批准仅困难夜间模式，最新将两方AI和画面上限一起由10试调为5单位：`C.difficulty.hardNightVisionRange=5`（世界单位，默认5），限制两阵营AI的Vision，实际距离取原运行时视距与该上限的min；DEV加大基础视距不能越过上限，不修改/保存运行时预设。选DP时Human AI及选Human时DP AI均读取此上限。画面`C.difficulty.hardNightRenderRange=5`（世界单位，默认5），恰好5单位可显示，超距/墙门遮挡/真正藏身时隐藏；Last Seen不参与显形。两个参数独立、须为正数，当前默认一致；不调整速度、反应、逃跑阈值或记忆时长。简单/普通不设这些上限，保留原11单位默认视距和白天/角色显示。该夜间AI规则是上文DEV覆盖优先级的明确例外，其他规则不变，详见[夜间设计](HARD_NIGHT_MODE_DESIGN.md)。

2026-10-17锁门收益本地调整：新增 `C.humanAI.aiForceBreakWindupMs = 1000`（毫秒，默认1000，三档共用）。只约束AI执行强破请求，连续合法准备满1秒才调用既有HumanDoorSkill.use；玩家手动强破仍即时，普通解锁/PulseLock/30秒强破冷却不改。准备取消、换门、失去交互条件、眩晕或人工接管不消耗冷却并清零，暂停冻结；增大值增加锁门争取时间，减小则缩短。Human可见或玩家近处能交互该门时显示破锁提示，不公开远处AI位置。效果待真人试玩。

2026-10-17速度分档更新：用户确认简单0.90手感可以，并授权按此调整普通/困难。当前Human主控时对手DP AI倍率为EASY 0.90、NORMAL 0.95、HARD 1.00；普通值统一定义在 `C.difficulty.normalDeepseekMovementMultiplier = 0.95`，默认0.95，仅AI步行和冲刺读取。默认步行约3.45/3.6417/3.8333、冲刺5.52/5.8267/6.1333世界单位/秒。困难原1.00保持，不额外加速；普通/困难手感尚待试玩。其他角色速度、时长、冷却与风险规则不变。下文简单试调段落描述其实施时范围，普通当前值以本段为准。

2026-10-17追加用户授权的简单DP AI降速试验：`C.deepseekAI.movementSpeedMultiplier = 1`为基础倍率；`C.difficulty.easyDeepseekSprint.movementSpeedMultiplier = 0.9`仅覆盖Human主控/EASY对手AI。ThreeGame和无头仿真在同一实际位移速度处应用，步行3.8333→3.45、冲刺6.1333→5.52世界单位/秒（未手动DEV调速时）。手动控制含DEV接管不乘AI倍率；普通/困难为1，Human速度不变，冲刺时长/冷却/风险不变。增大倍率加快AI，减小则减慢；保持上一轮approachSprintDistance=4.5，待真人验收，不据自动测试宣称追捕平衡完成。

2026-10-17简单Human追捕体验本地试调：新增 `GAME_CONFIG.difficulty.easyDeepseekSprint.approachSprintDistance = 4.5`（世界单位，原对手有效值6）。仅在玩家选Human且EASY时覆盖DP AI面对明显逼近的提前冲刺距离；普通/困难、玩家DP及AI基础速度、冷却与持续时间不变。减小值推迟该入口，增大则提前。近距阈值5、声音冲刺、出口受阻的紧急入口均保留，因此部分距离仍会触发其他入口，不宣称抓捕平衡已完成。曾试验近距阈值3.5但触发固定种子整局回归，已撤回；实际效果待真人试玩。

2026-10-15追捕手感调整：`DIFFICULTY_OVERRIDES.NORMAL.humanAI.movementSpeedMultiplier` 为0.64（原0.78），`HARD`同字段为0.76（原0.95）；EASY基础0.52不变。只影响DeepSeek主控时对手Human AI的巡逻/追逐移动及行程估计，不改玩家速度、破解/搜查、DeepSeek AI、进食或技能。暂停界面只显示难度名称，有效值仍可在DEV-B中核查。数值是待试玩的新基线，不宣称胜率已平衡。

此前 [结构审计与平衡准备](CODEBASE_BALANCE_AUDIT.md) 的226项读取目录、38项DEV覆盖及填写表是调整前快照，不代表本轮的进食模式或自动恢复行为；其他未授权数值保持不变。

听觉生效时机待决策：9项声音 `range` 实际在每次分析时读取，因此改变范围会影响存量事件（现有测试同样要求）；DEV元数据和旧设计写“仅新事件”，与运行矛盾。`strength`／`lifetimeMs` 则确实按生成快照。本轮只记录，未修源码／测试或选择新语义，详见审计A15。

## Human 捕捉网（2026-10-17本地实现，待人工验收）

三档共用，玩家与AI复用同一个CaptureNetSystem；不改E搜查、Space强破、移动速度或其他技能数值。完整状态/限制见 [捕捉网设计与验收](CAPTURE_NET_DESIGN.md)。

| 参数路径 `C.captureNet.*` | 默认值 | 单位 / 作用 |
|---|---:|---|
| `maxActiveNets` | 4 | 张；场上同时存在上限，待启动网也占名额 |
| `placeRange` | 3 | 世界单位；鼠标放置范围，必须无遮挡 |
| `radius` | 0.55 | 世界单位；网本体半径，触发扫掠加角色原有碰撞半径 |
| `placeMs` | 600 | 毫秒；原地布置，成功后才开始冷却 |
| `armMs` | 1000 | 毫秒；放置成功至启动 |
| `rootMs` | 5000 | 毫秒；定身，不倒地，不自动判胜 |
| `cooldownMs` | 20000 | 毫秒；成功放置起算，CD结束且有剩余名额才可再放 |
| `immunityMs` | 2000 | 毫秒；网定身及重叠的既有控制均结束后仅免疫网 |
| `protectedClearance` | 0.9 | 世界单位；米点、实际出生、藏身锚点/当前出口的附加禁放距离 |
| `aiThreatRange` | 6 | 世界单位；AI只对当前可见且此范围内的目标考虑布网 |
| `aiPlaceDistance` | 1.4 | 世界单位；沿AI当前行进方向布网距离 |

捕捉网永久留场，不再有lifetimeMs或自动到期计时；触发后消耗对应一张并释放名额，重开/应用地图清空。Q右上角圆标显示剩余名额4→0；DP锁门圆标显示原3扇上限的剩余名额3→0，破锁/解锁后恢复名额。上述共享参数须保持正值；placeRange应能容纳网与角色的无重叠位置。增大容量/半径/定身或缩短启动/冷却会增强Human；玩家/AI共用技能物理数值，AI主动布网预算与反应节奏另按下表分档。藏身区域还按现有interactionRegion半径的包围圆保守禁放，避免任意合法进入/退出位置被网覆盖，不修改区域数据。

### Human AI布网与中网追捕节奏

| 参数路径 `C.captureNetAI.<难度>.*` | EASY | NORMAL | HARD | 单位 / 作用 |
|---|---:|---:|---:|---|
| `maxActiveNets` | 1 | 2 | 4 | 张；Human AI主动布网预算，玩家仍4张 |
| `attemptIntervalMs` | 5000 | 1500 | 500 | 毫秒；两次布网提案的最短间隔，替代旧captureNet.aiCheckMs |
| `approachDelayMs` | 1200 | 500 | 0 | 毫秒；真正看见DP中网后额外等待再靠近，允许0 |

AI仍遵守20秒技能CD和完整物理禁放校验，不会预先知道隐藏的DP位置。等待期间停止Human AI动作和移动，不延迟玩家操作；丢失可见中网状态/禁锢结束不继续等待。原抓捕圈/350ms连续抓捕规则不变，已处在抓捕圈内时仍可能按原规则抓住。中网反应和提案节奏使用原throwables.nowMs，暂停冻结，重开清空。难度切换后已存在超出新AI预算的网保留，只限制继续布置，不删除网或缩小玩家上限。

## 三档双阵营AI投掷（2026-10-17本地实现，待试玩）

Human/DP两方AI均启用，简单较差、普通居中、困难较准；参数唯一来源C.throwableAI，与玩家投掷数值分开。顺路调用原1.2单位拾取入口，不新增捡道具寻路；原ThrowableSystem冷却仍裁决出手，AI间隔仅限制决策频率。

| 参数路径 `C.throwableAI.*` | 默认值 | 单位 / 作用 |
|---|---:|---|
| `pickupScanMs` | 300 | 毫秒；AI尝试拾取身边道具的间隔 |
| `minTargetDistance` | 1.5 | 世界单位；贴脸不投掷 |
| `maxTargetDistance` | 5.5 | 世界单位；只向此范围内无遮挡且可见目标投掷 |
| `HARD.maxTargetDistance` | 6 | 世界单位；困难目标距离上限，物理射程仍受throwables.maxThrowDistance=6约束 |
| `EASY.windupMs` / `NORMAL.windupMs` / `HARD.windupMs` | 1300 / 900 / 650 | 毫秒；固定落点后的准备时间，期间不追踪 |
| `EASY.intervalMs` / `NORMAL.intervalMs` / `HARD.intervalMs` | 9000 / 6500 / 5000 | 毫秒；上次成功投掷后至少等待，再开始下一次瞄准 |
| `EASY.aimErrorRadius` / `NORMAL.aimErrorRadius` / `HARD.aimErrorRadius` | 1.8 / 1.25 / 0.25 | 世界单位；落点均匀圆盘随机偏差半径，不是命中率 |
| `HARD.leadTimeMs` | 600 | 毫秒；仅困难的可见移动预判时长上限，实际不超过弹体飞行时间 |
| `HARD.maxLeadDistance` | 2.4 | 世界单位；预测位移分量的最大幅度，另叠加原随机误差 |

目标必须当前真实视觉可见且未藏身/禁锢/眩晕；不使用声音/Last Seen推算位置。前摇保持原快照，出手时按当前仍可见目标位置重新计算一次落点，并保留起手时同一份随机误差，避免AI追赶过程中跑到旧落点旁边只扔到脚下。简单/普通不预判；用户追加明确批准困难使用前摇期间连续可见的位置变化估计平均速度，在出手时预测最多600ms/2.4单位，仍经原6单位物理射程和墙体裁剪。弹体一旦出手三档均不追踪，变向可使预测失效。所有时间读取ThrowableSystem.nowMs，暂停冻结；手动接管、门/藏身/进食/布网等动作互斥，丢失目标取消瞄准及本次运动估计，重新看到后重新前摇。冷却期间可顺路拾取但不出手。真实弹道/墙/移动角色决定命中，沿用3秒眩晕和盆3次耐久；不据偏差参数承诺实际命中率或胜率。

## 生活投掷物（2026-10-15初始值，待试玩）

本组为新增玩法，只影响生活物件，不改变既有玩家、AI、技能和难度数值。三档与两阵营使用同一组配置，完整规则和验证见 [投掷物报告](verification/THROWABLES_REPORT.md)。

| 参数路径 | 当前值 | 单位 / 作用 |
|---|---:|---|
| `C.throwables.enabled` | true | 功能开关 |
| `C.throwables.pickupRange` | 1.2 | 世界单位；近距离且无遮挡拾取 |
| `C.throwables.maxThrowDistance` | 6 | 世界单位；鼠标落点距离上限 |
| `C.throwables.flightDurationMs` | 600 | 毫秒；完整飞行时间，须大于0 |
| `C.throwables.arcHeight` | 0.75 | 世界单位；附加视觉弧高，碰撞仍沿XZ保守处理 |
| `C.throwables.projectileRadius` | 0.12 | 世界单位；物件扫掠半径，角色判定还加自身逻辑半径 |
| `C.throwables.throwCooldownMs` | 800 | 毫秒；每个角色出手间隔 |
| `C.throwables.pickupDelayAfterLandingMs` | 500 | 毫秒；盆落地禁拾 |
| `C.throwables.basinMaxThrows` | 3 | 次；每个盆的成功投掷次数，第三次落地后损坏，不能再拾取 |
| `C.throwables.stunDurationMs` | 3000 | 毫秒；命中倒地眩晕，重复命中刷新而不累加 |

每区域2件属于关卡内容，在 `src/three/map/throwableLayout.json` 持久化；花瓶/盒子实际投出后一次性消耗，盆前两次落地可回收，第三次正常命中/拆网/落地后进入USED损坏，不再拾取或显示。每个盆独立累计，两阵营交换拾取不重置；取消瞄准、出手失败不扣次数，投空/撞墙/拆网也算成功投出一次。提示显示盆剩余次数；重开恢复，编辑布局不修复耐久。眩晕期间阻止位移/交互/进食/抓捕，暂停冻结计时。参数尚未经过统计平衡测试。

2026-10-15用户追加批准：眩晕由2000ms改为3000ms；DEV场景编辑器新增道具拖动、X/Z输入、独立应用及保存，详见 [投掷物编辑验收](verification/THROWABLE_EDITOR_REPORT.md)。其他8项投掷数值及所有既有平衡参数不变。

## 开发与正式进食时间

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `RICE_MAX_PROGRESS_MS.production` | 20,000 | 毫秒；每份米正式进食进度 | 所有难度一致，不含开始／恢复时400ms准备；2026-10-17用户批准试调。 |
| `RICE_MAX_PROGRESS_MS.development` | 5,000 | 毫秒；开发测试时间 | 仅为频繁测试提速。 |
| `RICE_TIMING_MODE` | `production` | 模式；决定 `C.rice.maxProgressMs` | 不随Vite dev/build自动变化；仅显式开发测试才能选择5秒。 |
| `C.rice.maxProgressMs` | 20,000 | 毫秒；运行时每份米最大进度 | 从上述模式自动得出，RiceField、HUD比例和AI估时读取同一进度。 |

当前没有对局倒计时或“开发/正式不同对局时限”的运行规则；`GameStateSystem.elapsedMs` 只累计已进行时间。不能只填写一个配置值就得到限时胜负，需要另行设计与实现该玩法。

## 角色、冲刺与抓捕

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.player.size` / `C.human.size` | 32 / 32 | 像素；占位体尺寸 | 当前两角色的代理宽度共用 `player.size`；`human.size` 未见运行读取。正式 GLB 显示尺寸独立，不能据此推断模型或逻辑碰撞圆同比变化。 |
| `C.player.speed` | 230 | 像素/秒；DeepSeek 基础移动速度 | 运行时除以 `C.three.pixelsPerUnit`。 |
| `C.three.pixelsPerUnit` | 60 | 像素/世界单位；角色速度、米袋尺寸与进食距离的换算基准 | 地图坐标仍按世界单位绘制，修改会同时改变多套尺寸关系，需全面验收。 |
| `C.human.speedMultiplier` | 1.08 | 倍率；Human（包括玩家手动控制）的基础速度 | 改动后重新测试追逐与抓捕胜率。 |
| `C.collision.playerRadius` | 0.23 | 世界单位；两个角色的逻辑碰撞圆半径 | 会影响墙角、门框通行；不能直接当作抓捕圈半径。 |
| `C.collision.contactEpsilon` / `maxMovementSubstep` | 0.0001 / 0.12 | 世界单位；接触容差与单次移动分步上限 | 属碰撞稳定性参数，修改需回归 Wall Sliding 和防穿墙。 |
| `C.sprint.speedMultiplier` | 1.6 | 倍率；冲刺相对基础速度 | 追逐与墙角碰撞均受影响。 |
| `C.sprint.durationMs` | 2,500 | 毫秒；一次冲刺持续时间 | 冲刺开始后不能靠松开方向键取消。 |
| `C.sprint.riskThreshold` | 0.30 | 进度比例；开始冲刺时全局进度达到该值，结束必摔 | 此数值是已验收的 30% 玩法阈值。 |
| `C.sprint.stunMs` | 1,000 | 毫秒；摔倒眩晕 | 目前摔倒本身没有独立的持续计时参数。 |
| `C.sprint.cooldownMs` | 30,000 | 毫秒；冲刺技能冷却 | 冲刺**一开始**即进入冷却并持续计时；冲刺进行中不能刷新冷却，提前结束也不会缩短冷却；暂停冻结、重开清零。DEV「Sprint / 冲刺」分类显示 READY / ACTIVE / COOLDOWN 与剩余时间。 |
| `C.match.captureRadius` | 0.70 | 世界单位；Human 抓捕圈半径 | 抓捕还须满足无遮挡和持续接触。 |
| `C.match.captureMs` | 350 | 毫秒；连续有效接触时间 | 离开圈或被墙/关门阻挡时进度清零。 |
| `C.match.readyMs` | 3,000 | 毫秒；开局准备时间 | 与正式对局已进行时间分开。 |
| `C.match.maxFrameDeltaMs` | 50 | 毫秒；单帧规则推进上限 | 为浏览器切换/卡帧稳定性服务，修改会影响所有逐帧计时。 |

## S7C-3 本局布局随机化

| 变量 | 默认值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.matchRandom.minSpawnDistance` | 10 | XZ 世界单位；双方出生的最小直线间距 | 还要求不同房间、碰撞合法与真实导航可达。 |
| `C.matchRandom.doorOpenChance` | 0.5 | 概率；**31 扇门**（2026-10-03 东翼扩建前为 18 扇）各自初始为 `OPEN` 的概率，否则为 `CLOSED` | 不产生初始 `LOCKED`；玩家与 AI 均可按原规则打开普通关门。**门数变化会改变 `createMatchSetup()` 的随机数消耗顺序，因此同一 `matchSeed` 不再复现扩建前的布局。** 2026-10-04 区域级放大没有改门数（仍 31），但世界盒 `48×30 → 56×38`、导航格随之变化，`MatchRandom.spawnCandidates()` 的候选列表因此改变，同一 `matchSeed` 同样不再复现上一轮的出生与门初态（固定种子仍可复现本轮之后的布局）。 |
| `C.matchRandom.maxAttempts` | 20 | 次；非法布局的有界重新抽取上限 | 耗尽后校验全关门的安全回退布局；回退也不允许绕开校验。 |

出生候选从当前已应用地图的房间与真实导航空闲格生成（扩建后的 6 个新空间只要有空闲导航格就自动进入候选池，不需要另写第二套出生列表）；米堆仍从现有 14 个候选中抽 5 个，并共用本局随机种子。正常新局与重开生成新种子；开发模式可在 DEV 面板设置固定种子或使用 URL `?matchSeed=<0..4294967295>`，使重开复现同一布局。种子、出生、米堆和 **31 扇门**的本局初态同时写入 AI JSON 导出。随机化不改变 `DoorNode.initialState`、地图几何或正式门锁玩法。

## Human AI（S7A 开发参数）

AI 只在玩家正式选择 DeepSeek 时接管 Human。声音调查只使用声源所在区域，目视追逐才使用目标实时位置；抓捕仍由原有 `C.match` 规则裁决。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.humanAI.movementSpeedMultiplier` | 0.52 | 倍率；AI Human 在 Human 基础速度上的独立倍率，降低 48% | 2026-10-12 用户确认保留现值；不影响玩家手动控制；巡逻、调查、追逐共用。 |
| `C.humanAI.aiUnlockDurationMs` | 8,750 | 毫秒；AI 单次模拟破解锁芯的耗时（原 5,000 毫秒的 1.75 倍） | 只影响 AI，不影响玩家 PulseLock 或强破冷却。 |
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
| `C.humanAI.searchRadius` / `searchRoomCount` | 12 / 3 | 世界单位 / 间；追丢后的邻近搜索范围和上限 | 不提供目标实时位置，目标来自 Last Seen。S7C-2 也复用 3 作为「同一次调查最多正式检查的家具数」。 |
| `C.humanAI.searchDwellMs` / `searchMaxMs` | 900 / 15,000 | 毫秒；搜索点停留和一次搜索时限 | 超时恢复巡逻，避免反复搜索同处。S7C-2 的家具搜查停留复用 `searchDwellMs`，一次调查的搜查动作共享 `searchMaxMs`。 |
| `C.humanAI.hideCheckFailureCooldownMs` | 6,000 | 毫秒；S7C-2 同一件家具搜空后再次检查的冷却 | 只影响 Human AI 的家具搜查；冷却只随 PLAYING 的玩法时间推进。调小＝AI 更快重搜同一件家具，藏身明显变难。 |
| `C.humanAI.hideCheckMaxPerRound` | 1 | 件；S7C-2 每轮最多正式检查的家具数 | 与「同一次调查最多 `searchRoomCount` 件」「共享 `searchMaxMs` 预算」「同家具 6 秒冷却」共同构成搜查强度上限；调大会同时改变藏身玩法难度，须重新验收。**语义（S7C-2 两轮修复轮）：本轮「已开始的搜查尝试」与「已正式执行的搜查」分开计数（`checkHideRoundAttempts` / `checkHideRoundChecks`）；开始过但被抢占的尝试同样占用本轮配额，以免中断后反复重跑 A\*。第二轮修复轮进一步明确：`checkHideRoundChecks` / `checkHideInvestigationChecks` **不再在发出 REQUEST 时提前消耗**，改由游戏层的正式判定回执在 `MISS_EMPTY` / `HIT_CONCEALED` 时消耗——`PLAN_STALE / STANCE_LOST / HEADING_LOST / OUT_OF_RANGE / OUTSIDE_FAN / BLOCKED` 都是「未完成合法检查」，既不记搜空、也不进家具失败冷却，更不计入正式检查数量。** |

## DeepSeek AI（S7B 开发参数）

仅在玩家正式选择 Human 且没有开发调试接管 DeepSeek 时运行。选米评分为导航路径长度按 DeepSeek 基础速度换算的行走毫秒数，加该米剩余进食毫秒数和既有准备时间；导航网格与关门路径代价复用现有 NavigationSystem，不复制配置。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.deepseekAI.waypointTolerance` | 0.25 | 世界单位；路径节点到达容差 | 需与共用网格及碰撞圆一同检查，避免拐角抖动。 |
| `C.deepseekAI.stuckRepathMs` | 800 | 毫秒；节点持续无进展后的重寻路阈值 | 调小会增加寻路次数。 |
| `C.deepseekAI.stuckProgressEpsilon` | 0.05 | 世界单位；卡路窗口内至少应靠近节点的距离 | 不改变玩家移动速度或碰撞体。 |
| `C.deepseekAI.maxStuckRepathsPerTarget` | 2 | 次；同一米堆连续卡路后暂避并换目标 | 有进展时重新计数。 |
| `C.deepseekAI.retryMs` | 1,500 | 毫秒；不可达米堆暂避及无目标重试间隔 | 门状态改变会立即触发重新规划。 |
| `C.deepseekAI.visionEvadeDistance` | 5 | 世界单位；目视 Human 的逃跑距离 | 过大容易频繁中断进食。 |
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
| `C.deepseekAI.escapeGoalHoldMs` | 1,500 | 毫秒；常规逃跑目标最短保持时长 | 断路或目标明显不安全可提前换路。 |
| `C.deepseekAI.escapeSwitchScoreMargin` | 2.5 | 评分；新目标超过旧目标才切换的差值 | 提高可减少相邻目标来回切换。 |
| `C.deepseekAI.escapeVisitMemoryMs` | 12,000 | 毫秒；近期房间访问记忆窗口 | 到期后访问惩罚自然消失，暂停期间 AI 时间冻结。 |
| `C.deepseekAI.escapeRecentVisitCount` | 4 | 房间/区域记录条数 | 只保留最近的实际经过区域。 |
| `C.deepseekAI.escapeRecentVisitPenalty` | 5 | 评分；刚访问房间每次的最大扣分 | 按访问年龄线性衰减；唯一可达房间仍可选择。 |
| `C.deepseekAI.escapeLoopMinDistanceGain` | 1 | 世界单位；重访区域应取得的最小安全距离增益 | 未达到时触发一次跨区域重新决策。 |
| `C.deepseekAI.escapeNearScoreBand` | 0.8 | 评分；允许随机挑选的近最高分区间 | 明显低分或危险候选不参与随机选择。 |
| `C.deepseekAI.safeObservationMs` | 2,500 | 毫秒；缺少可用威胁方位时的持续观察时间 | 已知威胁方位且拉开距离时，可提前进入移动恢复。 |
| `C.deepseekAI.soundCautionStrength` | 0.045 | 保留字段；**当前未见运行读取** | `assessThreat` 对弱声音实际使用 `perception.minimumAudibleStrength`，高威胁使用 `soundEvadeStrength`；修改此保留字段不能据此声称改变恢复行为，不擅自接回 AI。 |
| `C.deepseekAI.dangerRiceAvoidMs` | 3,000 | 毫秒；暂避已知威胁附近米堆或其路径 | 不清除已有进食进度；仅逃跑后生效。 |
| `C.deepseekAI.dangerRouteRadius` | 3 | 世界单位；米堆或路径靠近最后威胁点的判定半径 | 过大可能使多个米堆暂不可选。 |
| `C.deepseekAI.safeWaitFailureThreshold` | 2 | 次；同一米堆与入口重复遭遇目视危险后的安全等待门槛 | 只阻止无条件重闯；Human 变化或出现安全路线时重新评估。 |
| `C.deepseekAI.safeWaitRecheckMs` | 2,500 | 毫秒；SAFE_WAIT 重新评估安全路线的间隔 | 门状态变化会提前评估；未确认安全时继续等待。 |
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
| `C.deepseekAI.curiosityStillMs` / `curiosityChance` | 5,000 / 0.10 | 毫秒 / 概率；Human 实际连续静止达到门槛后，目视时每次静止事件只判定一次 | 静止计时不受遮挡影响；当前没有正式动画资源。 |
| `C.deepseekAI.curiosityMovementEpsilon` | 0.05 | 世界单位；Human 相对静止锚点的实际位移容差 | 超过即重置静止事件；遮挡不会清零，微小抖动不会误触发。 |
| `C.deepseekAI.curiositySafeDistance` | 2 | 世界单位；试探点及绕行路径距当前可见 Human 的下限 | 应明显大于 `C.match.captureRadius`，不能为追逐提供额外免疫。 |
| `C.deepseekAI.curiosityObserveMs` / `curiosityCooldownMs` | 1,800 / 12,000 | 毫秒；安全点观察时长及一次试探结束后的冷却 | 冷却不影响正常找米、逃跑或玩家控制。 |
| `C.deepseekAI.curiosityApproachTolerance` | 0.5 | 世界单位；观察点到达容差及额外站距 | 调整时检查导航网格、碰撞与安全距离。 |
| `C.deepseekAI.stationaryPassageChance` | 1.00 | 概率；可见 Human 静止满 5 秒并挡住当前米路线时，每次静止事件触发一次安全通行尝试 | 100% 只保证开始尝试；无安全路径时仍会拒绝通行；与普通 10% 好奇观察分开。 |
| `C.deepseekAI.stationaryPassageSafetyMargin` | 0.20 | 世界单位；加在 `C.match.captureRadius` 外的动态通行避让余量 | 当前动态半径为 0.90 世界单位；必须保持正余量，不能允许进入有效抓捕圈。 |
| `C.deepseekAI.stationaryPassageBlockRadius` | 1.5 | 世界单位；默认路线靠近静止 Human 的判定半径 | 同时检查 Human 到目标米堆是否落在 `dangerRouteRadius` 内。 |
| `C.deepseekAI.stationaryPassageObserveDistance` | 2.0 | 世界单位；安全通行观察点距 Human 的期望距离 | 只是候选评分，实际路线仍须满足抓捕圈外避让。 |
| `C.deepseekAI.stationaryPassageCheckIntervalMs` | 500 | 毫秒；静止挡路条件的重查间隔 | 避免每帧运行多次 A*；数值越大，许可响应可能越慢。 |
| `C.deepseekAI.doorEscapeMinHumanDistance` | 1.5 | 世界单位；EVADE 关门时与当前可见 Human 的最低间距 | 必须大于实际抓捕圈；太大会减少可用关门机会。 |
| `C.deepseekAI.doorEscapeCrossingWindowMs` | 1,800 | 毫秒；实际通过门后可考虑关门的窗口 | 过长可能让 AI 返回已远离的门。 |
| `C.deepseekAI.doorEscapeCooldownMs` | 20,000 | 毫秒；同门再次考虑关门的冷却 | Human 重新开门后 AI 不原地重复关门；暂停时冻结。 |
| `C.deepseekAI.humanPlayerUnlockPenaltyMs` | 10,000 | 毫秒；Human 玩家成功解除一把 DeepSeek AI 的锁后，追加到 AI 全局锁门冷却的时长 | 可叠加：剩余 15 秒时再解除一把，变为 25 秒；暂停时冻结，AI 自主解锁不触发。 |

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
| `C.rice.activeCount` | 5 | 份；每局从候选池中无重复激活的米数 | 必须在 1 到候选池大小之间；全部吃完即胜利。HUD 与结算仍有固定“五份米”文案，若批准改份数须同步文案和回归；本轮保持5。 |
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

## Door、Human Force Break 与 PulseLock

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.door.interactionRange` / `interactionEndInset` | 1.3 / 0.08 | 世界单位；可操作门距离和门段端点内缩 | 门交互仍要求可达、不可隔墙；修改需检查门框侧边。 |
| `C.door.maxActiveLocks` | 3 | 把；**同时**有效的锁上限 | **不限制整局总次数**；破解/强破后释放一格，失效锁芯本局不能重锁。 |
| `C.door.humanFreeOpenClosedDoor` | `true` | 开关；Human Space 免费快速打开普通 CLOSED 门 | 设为 `false` 会禁用该 Space 行为；E 普通开门不受影响。 |
| `C.door.humanForceBreakCooldownMs` | 30,000 | 毫秒；Space 强破 LOCKED 门的冷却 | 不限制普通门快速开，也不限制 E PulseLock。 |
| `C.door.playerLockCooldownMs` | 20,000 | 毫秒；**DeepSeek 玩家**按 Q 主动锁门的冷却（S7C-1B） | 只有 `lock()` 真的返回 `LOCKED`（即门为 CLOSED、锁芯 ACTIVE、锁位未满）才开始计时；状态不允许、超距、锁位已满、锁芯失效都不消耗冷却。AI 的锁门走 `lockDoorFromCommand`，**不读**这个冷却。 |
| `C.door.leafHeight` / `leafThickness` / `openAngle` | 1.2 / 0.16 / `Math.PI / 2` | 世界单位 / 世界单位 / 弧度；逻辑碰撞高度／门厚／OPEN显示转角 | `leafHeight` 用于闭门碰撞盒，可见高度来自 `HOME_COMPOSITION.doorVisualHeight`；门厚影响碰撞、视线与声音遮挡。OPEN门逻辑不随转角新增半开碰撞。 |
| `C.door.colors.open` / `closed` / `locked` / `lockCore` / `lockCoreDisabled` | `0x6d8f73` / `0x8a644b` / `0xa0443f` / `0xffc247` / `0x565d63` | 颜色；旧门叶与当前锁芯显示 | `open` / `locked` 未见运行读取；`closed` 仅构造初始化，正常 `sync` 后门叶使用住宅木色常量；两种锁芯色仍实际读取。 |
| `C.pulseLock.rows` / `cols` / `mines` | 4 / 4 / 3 | 旧扫雷棋盘参数，当前正式玩家解锁不再读取 | 保留历史数值，不作为 PulseLock 时机判定。 |
| `C.pulseLock.firstRevealSafe` / `failureFeedbackMs` | `true` / 1,500 | 旧扫雷首次安全与失败反馈参数，当前正式玩家解锁不再读取 | 保留历史数值，不影响门状态。 |
| `C.pulseLock.timing.coreCount` | 3 | 每扇锁门依次完成的锁芯数；当前结构固定3 | 构造校验明确拒绝非3值，并要求 `targetCenters.length` 相等；不能只填新芯数就认为可正常启动。 |
| `C.pulseLock.timing.travelMs` | 1,400 | 毫秒；脉冲从轨道一端到另一端 | 只改变玩家 E 破解时机，不改变 Human AI 解锁耗时。 |
| `C.pulseLock.timing.targetWidth` / `targetCenters` | 0.20 / `[0.48, 0.56, 0.43]` | 轨道归一化位置与宽度 | 所有门使用相同目标区域，不影响门锁、导航或 AI。 |
| `C.pulseLock.timing.feedbackMs` | 240 | 毫秒；成功 / 失手的纯视觉反馈 | 不改变 DoorSystem 状态。 |

## S7C-1B 藏身与阵营技能（Human E 家具搜查 / V 扇形抓捕，DeepSeek Q 锁门）

2026-10-17用户批准Human搜查由Q迁至E：PulseLock已打开时E只操作锁芯；附近有合法可交互门时E只操作门（包括关门受阻，不回落搜查）；无门才执行原扇形/家具搜查。后续同日授权的捕捉网已接Human Q（见上表），选点/布置时E交互暂不可用；DP按键不变。以下历史“Q搜查”指原搜查判定，不代表当前输入键；内部日志字段和resolvePlayerQPlan命名为兼容保留。

藏身（E）本身**没有新增可调数值**：进入是点按即切换，没有进入耗时、也没有独立的 Human 距离门槛；「精确交互区域」复用 DEV-A 已批准的地图创作数据（`HideSpot.interactionRegion`，床与纸箱圆形 2.0 / 1.2，衣柜与柜架扇形 1.6·55°），因此不在本表重复。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.humanSearch.range` | 1.5 | 世界单位；Human V 扇形抓捕半径 | 与 `C.match.captureRadius`（0.70）、`C.door.interactionRange`（1.3）不同，不要混用；家具E不使用此距离。 |
| `C.humanSearch.halfAngleDeg` | 60 | 度（每侧）；扇形半角，整体张角 = 2 × 60 = 120° | 只影响 Human 玩家搜查；判定与扇形特效共用 `GAME_CONFIG.humanSearch`，两者不会不一致。 |
| `C.humanSearch.cooldownMs` | 12,000 | 毫秒；E 家具搜查与 V 扇形抓捕共用冷却 | E搜中/合法搜空、V命中/空挥消耗；E无合法家具或执行拒绝不消耗。仅PLAYING推进，暂停/DEV冻结不推进；重开清零。 |

玩家V只对未藏身角色调用 `evaluateHumanSearch()`，保留距离/角度/墙门遮挡；不会搜索隐藏家具。E家具沿用 `resolveHumanFurnitureSearch()` 的合法指向/区域/遮挡与惰性权威占用读取，搜中立即走原 `GameStateSystem.forceCapture()`；无效目标不回退扇形。两者共用同一 `SkillCooldown`，未新增计时。AI仍走既有搜查路径，不受本轮按键拆分影响。扇形特效时长是表现层常量，不是玩法数值。

**2026-10-17用户授权拆分后的玩家输入**：E先处理PulseLock/门，无门才尝试合法且被指向家具；无目标不释放、不耗冷却，永不扇形空挥。V只做前方未藏身角色的扇形抓捕，不选家具，空挥也耗原冷却。E/V同时按且家具成功执行时，先E后V，由同一冷却阻止第二次释放。Q捕捉网、Space强破不变。原S7C-2 §4.7的自动“暴露目标优先→家具→空挥”是历史方案，不再是当前玩家分流；兼容计划函数保留，由调用方传互斥目标。家具指向仍复用 `halfAngleDeg`（±60°），本轮没有调整或新增任何 `GAME_CONFIG` 数值。

## S7C-2 Human AI 米痕循迹与家具搜查

Human AI 的搜查**复用**上表的 `humanSearch.range` / `halfAngleDeg`（1.5 / 120°）、`humanAI.searchDwellMs`（900 ms 停留）与 `perception.lastSeenMs`（8 秒 Last Seen）与 `perception.traceLifetimeMs`（15 秒米痕寿命），因此只新增下面两个已批准的正式值。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.humanAI.hideCheckFailureCooldownMs` | 6,000 | 毫秒；同一件家具搜空后的再次检查冷却（见上表） | 只影响 Human AI；不继承玩家 Q 的 12 秒冷却。 |
| `C.humanAI.hideCheckMaxPerRound` | 1 | 件；每轮最多正式检查的家具数（见上表） | 与「同一次调查最多 3 件」「共享 15 秒搜查预算」叠加。 |

**不在 `GAME_CONFIG` 里的 S7C-2 内部技术阈值**（它们是实现细节，不是玩法平衡杠杆，集中在 `src/systems/HumanSearchTuning.ts`，并由 `tests/human-search-tuning.test.mjs` 核对推导）：米痕链连接距离 `TRACE_LINK_DISTANCE = traceStepDistance × 6 = 3.9 u`、`TRACE_CHAIN_MAX_CLUES = 8`、`TRACE_DIRECTION_CONTRADICTION_DEG = 90`、`TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH = 3`、`CLUE_MEMORY_MAX = 160`、站位采样步长 `STANCE_SURFACE_STEP = navCellSize = 0.4 u`、站位间距 `STANCE_STAND_OFF = 0.3 u`、`STANCE_MAX_PATH_PROBES = 8`（**现行源码为 8；早期草稿写的 4 已在 2026-09-26 修复轮按源码更正**）、候选尝试数 `CANDIDATE_TRY_LIMIT = searchRoomCount = 3`、计划失效时的退还有界常量 `STANCE_MAX_STALE_CANCELS = 2`（一次调查内最多退还几次本轮家具配额，防止「取消 → 重规划 → 再取消」的无限循环），以及 6 个公开评分权重（自身距离 1 / 锚点距离 2 / 终止加分 6 / 方向对齐 4 / Last Seen 3 / 声音 2）。**这些都不是正式平衡值，不得当作可调玩法参数对外承诺。**

隐藏者在藏身期间的普通视觉为 `CONCEALED`、常规抓捕不累计；正式搜查命中后走 `releaseHide('SEARCHED')` + `GameStateSystem.forceCapture()`，与玩家 Q 命中完全同一条结算。

## S7C-2b DeepSeek AI 自主藏身（用户 2026-09-27 批准值）

DeepSeek 娘 AI 在 `EVADE` 中把「藏身」作为与逃跑并列的一个选项。合法性、进入与退出**全部复用**已有系统：藏身几何用 DEV-A 的 `interactionRegion` + `checkHideRegionPosition`（1.6·55° / 2.0 / 1.2 一个字未改），占用真相仍只在 `HideSystem`，最终位移仍走 `CollisionWorld`，视觉/声音仍走 `PerceptionSystem`。因此只新增下面这一组正式值。

| 变量 | 当前值 | 单位 / 作用 | 修改注意 |
|---|---:|---|---|
| `C.deepseekAI.hideThreatDistance` | 3.5 | 世界单位；已知威胁点到 AI 的距离小于此值时才评估藏身 | 必须小于 `visionEvadeDistance`(5)，否则「看见就跑」的门槛失效；它**只**管威胁距离，不额外限制藏身路线长度（那条判据是「藏身路线必须短于当前逃跑路线」）。 |
| `C.deepseekAI.hideMinConcealMs` | 2,500 | 毫秒；最短藏身时间，防止「一进就出」 | 调小会让 AI 更容易被引出来回抖动；调大会延长 Human 的等待。 |
| `C.deepseekAI.hideRecheckMs` | 500 | 毫秒；藏身中重新评估退出条件的间隔 | 同时也是退出被 `HUMAN_BLOCKING` 拒绝后的重试间隔；过小会造成多余的 A* 查询。 |
| `C.deepseekAI.hideReenterCooldownMs` | 8,000 | 毫秒；退出后**同一点**再次进入的冷却 | 防原地反复进出；与 `hideMaxConsecutive` 叠加而不是互相替代。 |
| `C.deepseekAI.hideCandidateFailCooldownMs` | 6,000 | 毫秒；走位失败或被权威层拒绝后该点的冷却 | 与 Human AI 的 `hideCheckFailureCooldownMs`(6,000) 数值一致，便于对称复核，但两者互不影响。 |
| `C.deepseekAI.hideRecentSpotCount` | 3 | 个；近期藏身点记忆条数 | 防两个点之间来回横跳；调大只会让惩罚覆盖更多历史。 |
| `C.deepseekAI.hideRecentSpotPenalty` | 5 | 无量纲；每个近期藏身点扣除的候选分（按 `escapeVisitMemoryMs` 12 秒线性衰减） | 与逃跑房间的 `escapeRecentVisitPenalty` 同值但**独立列出**，便于单独调节。 |
| `C.deepseekAI.hideMaxConsecutive` | 2 | 次；连续藏身次数上限（有一次真实米进度增长即重置） | 这是「不会无限藏下去」的主要手段；设为 0 会让藏身完全不可用。 |
| `C.deepseekAI.hideMaxConcealMs` | 0 | 毫秒；可选最大藏身时长，**0 = 不限制** | 只是兜底，且仍须同时满足「出口安全」与「还有可达米堆」；真正防拖死的是「无可达米堆不进入」+ `hideMaxConsecutive`。 |

**复用、不新增同义参数**：退出安全间距复用 `C.deepseekAI.escapeMinSeparation`(3)；退出前的「米堆路线不穿过已知威胁」复用有效抓捕半径（`C.match.captureRadius`，DEV-B 覆盖同样生效）；两处振荡抑制复用 `escapeSwitchScoreMargin` / `visitMemoryMs` / `stuckRepathMs` / `maxStuckRepathsPerTarget` / `escapeCoverBonus` / `escapeRouteThreatPenalty` / `escapeTowardThreatPenalty`。

**一个字都没有改**：DEV-A 的 `interactionRegion`（床/纸箱圆形 2.0 / 1.2，衣柜与柜架扇形 1.6·55°）、`C.humanSearch`(1.5 / 120° / 12,000)、`C.humanAI.hideCheckFailureCooldownMs`(6,000) / `hideCheckMaxPerRound`(1)、`C.perception.lastSeenMs`(8,000) / `traceLifetimeMs`(15,000)。

**AI 藏身的公开评分（不是新参数，系数全部取自上表）**：候选分 = −路线长度 + 遮挡奖励(`escapeCoverBonus`) − 路线威胁风险×`escapeRouteThreatPenalty` − 朝威胁跑惩罚(`escapeTowardThreatPenalty`) − 近期藏身惩罚。刻意**不以「离威胁多远」为主项**——那是逃跑房间的货币；藏身的价值来自尽快躲进去，而「值不值得藏」由 `hideThreatDistance` 与「藏身路线必须短于当前逃跑路线」两条判据在控制器里决定。

**阶段状态（2026-09-27）**：S7C-2b 已通过用户集中浏览器人工验收 **8/8 PASS** 并归档。上表九个数值是用户批准的正式值，实现轮与归档轮**均未做任何调整**（核对方式：`git diff src/config/gameConfig.ts` 只新增这 9 行）；用户人工验收结果与 DPH 的浏览器自测分开记录，见 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §4.10.14 与 `docs/DEEPSEEK_HANDOFF.md` §16。

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

**当前状态（2026-09-27）**：`C.perception.soundVisual` 整组数值**只服务于已停用的玩家声音探测表现层**（声音范围圈 + 彩色动态声纹）。数值本身**一个都没有改动**，停用方式是在 `ThreeGame.ts` 里做表现层接线隔离（`PLAYER_SOUND_VISUAL_ENABLED = false`）；停用前快照、接线记录与恢复步骤见 `archive/features/player-sound-visual/README.md`。恢复该表现层之前，这些数值在正式对局与 DEV 对局中都不再产生可见效果。另外 `hudMidStrength` / `hudHighStrength` 在停用前就已经没有任何模块读取（仅 `gameConfig.ts` 自身定义），属于悬空配置。

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

## S7C-2 玩家交互轮廓（表现常量，不属于玩法平衡值）

下列值仅控制白色呼吸轮廓的提示外观，定义在 `src/systems/DeepSeekVisualTarget.ts` 与 `src/three/HideSearchView.ts`，不在 `GAME_CONFIG` 中。它们不改变藏身、搜查、米堆交互或进食判定。

| 源码变量 | 默认值 | 单位 / 作用 |
|---|---:|---|
| `DEEPSEEK_RICE_VISUAL_HALF_ANGLE_DEG` | 45 | 度；DP 娘米堆轮廓的视觉指向半角。 |
| `HIDE_PLAYER_TARGET_BREATH_MS` | 1,400 | 毫秒；唯一白色轮廓的呼吸周期。 |
| `HIDE_PLAYER_TARGET_OPACITY_MIN` / `HIDE_PLAYER_TARGET_OPACITY_MAX` | 0.35 / 1 | 透明度比例；可用轮廓呼吸的最低 / 最高不透明度。 |
| `HIDE_PLAYER_TARGET_MARGIN` | 0.08 | 世界单位；家具描边几何的每个尺寸轴总扩大量，即每侧约外扩 0.04。 |
| `HIDE_PLAYER_TARGET_UNAVAILABLE_OPACITY` | 0.14 | 透明度比例；Human Q 有家具目标但处于冷却或暴露目标优先时的压暗值。 |
| Rice 描边尺寸 | 现有 RiceView 主体与鼓包实际表现尺寸；每个尺寸轴总共增加 `min(0.04, min(width, depth) × 0.08)` | 世界单位；随米堆进食缩小；实际每侧外扩该值的一半，不改变米堆判定。该计算目前是 `HideSearchView` 内部实现，不是独立配置项。 |

## 留在源码内的常量

地图米点、门、房间、墙和家具的具体坐标属于关卡内容，保留在 `src/three/map/apartmentMap.ts`。角色状态枚举、距离与角度计算、视觉 Mesh 分段和波纹动画形状属于规则或内部实现；它们不适合作为日常平衡数值。当前配置中心可调参与抽选的候选数量，**不能仅通过改配置增加第 15 个米点坐标**。

当前默认参数保持 S6D 已有玩法手感；改变已人工验收的规则（例如 30% 冲刺风险、0.35 秒抓捕、首击安全或开发/正式进食时间）后，应重新进行相应 Gate 验收。
