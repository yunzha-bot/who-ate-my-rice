# 三档难度与正式30秒进食验收记录

## 2026-10-15：暂停说明精简与追捕速度回调（待用户试玩）

用户反馈普通更像困难、困难移动过快，授权降低普通/困难压力。本轮只调整DeepSeek主控时对手Human AI的移动倍率，保留其他AI能力和玩家数值；Human主控时DeepSeek AI的三档配置不改。

| Human AI移动倍率 | 原值 | 本轮值 | 实际步行速度（世界单位/秒） |
|---|---:|---:|---:|
| EASY | 0.52 | 0.52 | 2.1528 |
| NORMAL | 0.78 | 0.64 | 2.6496 |
| HARD | 0.95 | 0.76 | 3.1464 |

- 相对原档位普通降低约17.95%、困难降低20%；玩家DeepSeek基础步行仍约3.8333、玩家Human仍4.14。高档位保留较强破解和搜查，不意味着保证玩家胜利，也不声称已完成统计平衡。
- 暂停菜单两阵营统一只显示“当前难度：简单／普通／困难”；移除倍率、对手AI及DEV-B预设/覆盖说明。DEV-B原工具仍可核查有效配置，不改变调试覆盖优先级或保存行为。
- 改动实现仅 `src/config/difficultyConfig.ts`、`src/three/ThreeGame.ts`，测试仅 `tests/difficulty.test.mjs`。补充真实暂停赋值表达式回归，并只更新获授权的两项倍率预期；新预期在修复前确实失败。`GAME_CONFIG`包含用户自调镜头8的现有修改原样保留，地图、模型、音频和两套AI源码不变。
- 全量 **915/915**，失败/取消/跳过0，约70.26秒；独立 `npx tsc --noEmit`、生产构建及diff通过，原大chunk提示保留。94项开工保护哈希中92项不变，仅两项获准实现改变；原日志前缀保留。不运行Git暂存/提交/推送。
- 浏览器复验使用独立受控Chrome154、Edge151明确打开生产 `http://127.0.0.1:4173/` 并核对标题，覆盖两阵营三档共12组合：实际配置、Human AI位移速度上界、暂停短文本、重开保持档位、返回菜单及刷新难度偏好。证据及截图保存在 `difficulty-retune-20261015/`；主观手感由用户继续试玩，短测不替代自然整局和胜率统计。

以下章节保留2026-10-14的历史档位和验收事实，原0.78/0.95不再代表当前Human AI普通/困难速度。当前参数入口见 [难度设计](../DIFFICULTY_DESIGN.md)，本轮不补写阶段Gate。

## 2026-10-14：用户最终验收

用户确认简单／普通／困难真人平衡体验通过，并批准正式公开归档。30秒/份、5份米目标、EASY Human倍率0.52及已验收的锁门可达性修复原样保留；本轮不调值、不改AI。主观体验验收不代表已测得统计胜率或穷尽所有随机局面。

本次发布门禁重新运行878/878、独立TypeScript、build和diff检查，均通过。以下“等待集中试玩／本轮未归档”等文字记录原实现轮，以本节和 [发布审查](S13_RELEASE_REVIEW.md)为最新入口；原始回放JSON／探针本机保留，公开版只纳入报告及精选截图。

日期：2026-10-14。项目默认入口 `http://127.0.0.1:5173/`，复用已有Vite进程（PID9828，监听127.0.0.1:5173），没有启动第二个开发服务器。当前工作树基于已归档的S13前v6快照，存在本轮之前的S13／UI／文档未提交工作；这些内容均保留。

## 当前结论与验收边界

三档配置、双阵营接线、30秒正式进食、菜单与暂停显示已实现。额外追逐压力回归发现的普通DeepSeek AI浴室自锁问题，已在用户明确追加授权后，仅加强自动锁门前的全剩余米点可达性检查；原种子三档现均完成5/5，合理锁门仍保留，详见§5。等待集中真人试玩与平衡验收，不声称胜率已平衡。本轮没有暂存、commit、push或Tag，未标记阶段Gate=PASS。

## 1. 实际生效参数

完整表、单位及修改入口见 [难度设计](../DIFFICULTY_DESIGN.md)。EASY继承 `GAME_CONFIG`，NORMAL／HARD仅覆盖对手AI的指定字段；两个玩家自身速度、冲刺、技能、抓捕范围、门锁及PulseLock数值不随难度变化。

| 对手 | 字段 | EASY | NORMAL | HARD |
|---|---|---:|---:|---:|
| Human AI | movementSpeedMultiplier | .52 | .78 | .95 |
| Human AI | aiUnlockDurationMs | 8750 | 7500 | 6500 |
| Human AI | aiUnlockSuccessChance | .70 | .80 | .90 |
| Human AI | searchMaxMs | 15000 | 18000 | 22000 |
| Human AI | searchRoomCount | 3 | 4 | 5 |
| Human AI | hideCheckMaxPerRound | 1 | 2 | 3 |
| DeepSeek AI | visionEvadeDistance | 5 | 6 | 7 |
| DeepSeek AI | soundEvadeStrength | .09 | .075 | .06 |
| DeepSeek AI | escapeMinSeparation | 3 | 3.5 | 4 |
| DeepSeek AI | escapeReplanMs | 700 | 600 | 500 |
| DeepSeek AI | hideThreatDistance | 3.5 | 4 | 4.5 |

Human AI在玩家选DeepSeek时调整；DeepSeek AI在玩家选Human时调整。没有改视野遮挡、AI听觉事件、记忆／公开线索入口、地图随机化或给AI隐藏真值。

## 2. 正式进食：不是只改UI文字

- `RICE_MAX_PROGRESS_MS.production = 30000`，默认 `RICE_TIMING_MODE = 'production'`；development5000保留，只有显式测试选择才使用。
- 六组合的实际 `ThreeGame.rice.states` 均为5份、每份 `maxProgressMs=30000`；AI估时继续读取米点实际剩余进度。
- 回归逐项验证399ms未开始、400ms准备完成后计进度、5秒不完成、中断保留、恢复再准备400ms、29999ms不完成／30000ms完成、5份总进度150000ms才触发米胜利。
- Chrome真实RAF＋原生按住E：在实际 `rice_12` 附近建立合法测试站位并朝向米点，不加速帧、不修改米进度。6000ms时HUD20%，15000ms时HUD50%，松E保持进度，恢复后累计30000ms才完成一份；此时仍PLAYING、完成数1。证据 `docs/verification/difficulty/live-rice-results.json`（本机证据） 与 [50%截图](difficulty/chrome-live-rice-half.png)。
- 初次探针将人物放在米点正中心且未建立朝向，旧视觉朝向筛选使进度条隐藏；数值仍正确累计。随后朝向米点的探针验证实际HUD50%，没有为此改变既有朝向／交互规则。完成后进度条隐藏是原行为。

## 3. 浏览器验收

独立Playwright受控本机Chrome与Edge，分别明确导航上述URL，核对 `page.url()` 与页面标题《谁吃了我的米》。测试探针只在被拦截的Vite响应中暴露真实ThreeGame实例，没有往项目加入调试入口或写地图。软件WebGL用于可重复测试，不代表用户硬件FPS。

| 浏览器 | 实际版本 | 原生操作与生命周期 | 六组合加速整局 | 未处理页面异常 |
|---|---|---|---|---:|
| Chrome | 154.0.8037.100 | 通过 | 6/6结算 | 0 |
| Edge | 151.0.4129.86 | 通过 | 6/6结算 | 0 |

原生键鼠检查：难度radio方向键、鼠标选择、两阵营W移动、Esc暂停与时间冻结、当前难度只读显示、重新开始沿用难度、返回阵营重新选择、刷新保留、坏偏好回落EASY。没有把HTTP200当成互动成功。

DEV-B：隔离浏览器存入Human倍率.30预设，刷新／新局仍使用.52／.78／.95而非.30，预设文本不变；显式加载后本局.30且显示“DEV-B调试覆盖1项”，重开清覆盖并恢复难度基准，预设仍保留。真实用户浏览器预设未访问或改写。

三种桌面尺寸1920×1080、1366×768、960×640，浏览器矩形边界断言阵营卡底部＜难度组顶部、难度组底部＜免责声明顶部，页面无额外滚动。初轮发现旧通用label样式覆盖新难度样式，已限定选择器后复验通过；未重做阵营卡内部美术。

最终截图人工复核另发现过低的卡片高度使底部说明叠到阵营名称；只修正可用高度后，在Chrome／Edge补验卡内“名称底部≤说明顶部”断言，三种尺寸均通过。最新布局数据见 `docs/verification/difficulty/layout-results.json`（本机证据）；同名首页截图已更新，卡内设计保持不变。此次CSS修正后再次运行全量874/874、独立TypeScript、build及diff检查。

整局验证方法：先真实键盘移动／暂停／重开，再在真实ThreeGame中按50ms调用既有 `updatePlaying` 加速推进；不直接注入胜利或改米进度。它验证运行系统、状态与结果页面，**不是真人自然时长整局试玩**。两浏览器均得到下面相同结果（种子20268846，重开后玩家静止）：

| 玩家阵营 | 难度 | 对手结果 | 玩法时间ms | 结果 |
|---|---|---|---:|---|
| DeepSeek | EASY | Human抓捕 | 70100 | FINISHED |
| DeepSeek | NORMAL | Human抓捕 | 47050 | FINISHED |
| DeepSeek | HARD | Human抓捕 | 38850 | FINISHED |
| Human | EASY | DeepSeek吃完5份 | 177750 | FINISHED |
| Human | NORMAL | DeepSeek吃完5份 | 177750 | FINISHED |
| Human | HARD | DeepSeek吃完5份 | 177750 | FINISHED |

原始证据 `docs/verification/difficulty/browser-results.json`（本机证据）。无威胁的Human站桩夹具三档耗时相同是合理现象，不能据此宣称逃跑压力已平衡。

截图：

- 首页：[1920](difficulty/chrome-menu-1920.png)／[1366](difficulty/chrome-menu-1366.png)／[960](difficulty/chrome-menu-960.png)；[Edge1366](difficulty/edge-menu-1366.png)。
- 当前难度：[DeepSeek困难暂停](difficulty/chrome-deepseek-hard-pause.png)／[Human困难暂停](difficulty/edge-human-hard-pause.png)。
- 结算：[DeepSeek对局](difficulty/chrome-deepseek-hard-result.png)／[Human对局](difficulty/edge-human-hard-result.png)。

## 4. 自动化及固定种子

| 检查 | 本轮实际结果 |
|---|---|
| 调整前审计基线 | 850/850（不是早期839项） |
| 首轮接入后npm test | 849/850；唯一旧60000ms断言失败，按批准规则更新 |
| 难度初轮完整门禁 | 870/870；此后额外压力诊断暴露自锁，并追加授权修复 |
| 最终 `npm test` | 874/874，失败0，取消0，跳过0（包含自锁回归） |
| `npx tsc --noEmit` | 退出0，独立执行 |
| `npm run build` | 退出0；Vite既有大于500kB分包建议仍存在，不伪装为错误或消除 |
| `git diff --check` | 通过；CRLF规范化提示不是空白错误 |
| 额外追逐诊断 | 修复前NORMAL种子20260927未结算，探针及3项新回归失败；授权修复后原种子三档正常5/5，另9局锁门不变量通过，见§5 |

新增24项回归（难度文件22项＋自动锁门单测2项）包括完整11字段档位／仅对手覆盖、不可变基础配置、坏存档、安全DEV优先级、AI真实破解时长与概率边界、搜查房间数及超时、视听威胁阈值、藏身距离闸门、逃跑重算间隔、6组合进食／胜利、生产模式整局、4个额外困难Human路线及浴室／多房间锁门可达性。

困难Human固定种子20260927／20260411／20276765／20284684分别36.05／7.15／26.95／40.80秒抓捕，开门4／1／5／3次；未记录到有AI移动指令但位移小于阈值的卡住帧。有限种子不能保证所有路线无抖动，也没有测真人胜率或低配硬件帧率。

原S7D整局轨迹测试显式使用development5秒夹具保留原时间预算及断言；新增难度整局默认30秒，未通过延长游戏时限或放宽核心断言制造通过。

## 5. 已修复的压力回归问题：DeepSeek AI自锁

修复前：固定种子20260927，玩家Human采用仅公开视觉／记忆的pursue脚本。三档相同布局与AI随机流，真实导航、门、藏身与碰撞系统：

| 难度 | 结果 | 藏身进入／退出 | 观察 |
|---|---|---|---|
| EASY | 193100ms、5/5结算 | 1／1 | 有逃跑后恢复 |
| NORMAL | 597000ms仍PLAYING、2/5 | 2／2 | 自锁浴室后NO_REACHABLE_RICE，连续490500ms无进食增长 |
| HARD | 206550ms、5/5结算 | 2／2 | 有两次逃跑与恢复 |

这里597秒是**测试帧数预算**，不是新增游戏对局时限。原失败记录保留在下述诊断JSON；`docs/verification/difficulty/paired-matches.json`（本机证据）现记录修复后的配对结果。

隔离定位：两把锁为 `door_hall_bathroom`（D12）与 `door_bathroom_bedroom2`（D13）。仅通过现有DoorSystem解除这两把锁，不改难度／AI／速度／米进度，AI即恢复并于703300ms完成5/5。证据 `docs/verification/difficulty/lock-stall-diagnosis.json`（本机证据）。

代码证据：`DeepSeekAIController.evaluateEscapeLock` 的既有安全检查使用 `input.rice.some(...)`，只要求锁后至少一份未完成米仍可达；它允许把自己和一份室内米锁在同一房间。吃完室内米后，其余米在两把锁外，DeepSeek不能自行解锁，因此卡在RESELECT。不是NORMAL配置未生效、HUD假报或传入隐藏Human真值。

用户随后明确授权最小修复。只修改 `evaluateEscapeLock` 的剩余米点可达性检查：从 `some` 改为收集所有未完成米点的真实路径结果；全无路径沿用原拒绝码，存在部分不可达则新增拒绝码 `REMAINING_RICE_UNREACHABLE`。输入继续包含当前全部门锁状态，拟锁的门通过原blocked集合模拟；不改任何实际门，拒绝时清pending、不重试。本次检查最多5条路径，只在一次锁门决策中执行，不逐帧额外寻路。

修复前先新增3项回归并实际运行，3/3失败（错误锁门与NORMAL整局不结算）；修复后通过。合理锁门、关闭／pending／应用链、锁门并发数、Human解锁、强破、PulseLock与旧长跑回归保留，没有删除断言；旧“至少一份可达”长跑断言加强为“两份均可达”。

| 原种子修复后 | 5/5完成时间 | 自动锁门次数 | 藏身进入／退出 |
|---|---:|---:|---:|
| EASY | 193100ms | 0 | 1／1 |
| NORMAL | 225400ms | 1 | 2／2 |
| HARD | 206550ms | 0 | 2／2 |

NORMAL仍会合理锁一次门，不是通过禁用锁门修复；没有解锁探针、传送、跳米或忽略碰撞参与最终回归。

额外3档×3种子（20260927／20276765／20284684）共9次真实地图路径回归，全部结算；逐次自动锁门后用现有实际导航核验所有剩余米点可达，共核查8次锁门，地点覆盖玄关、主卧、浴室、餐厅、客厅。有限种子不等同于穷尽全部局面，但该安全检查对每次自动锁门都执行。

## 6. 修改文件与保护

本轮源码新增：`src/config/difficultyConfig.ts`、`src/three/DifficultyView.ts`。

源码修改：`src/config/gameConfig.ts`（仅批准的正式时间／模式）、`src/systems/HumanAIController.ts`、`src/systems/DeepSeekAIController.ts`（快照读取＋追加授权的自动锁门安全检查）、`src/systems/RuntimeDebugOverrides.ts`（本局基准）、`src/systems/AILogCollector.ts`（可选实际配置记录）、`src/three/ThreeGame.ts`（生命周期、难度状态与实际值展示）、`src/game-ui.css`（难度区及必要空间）。

测试新增：`tests/difficulty.test.mjs`。测试修改：`tests/deepseek-ai.test.mjs`、`tests/dev-b-param-persistence.test.mjs`、`tests/game-state.test.mjs`、`tests/rice-field.test.mjs`、`tests/s7d-full-match.test.mjs`、`tests/s7d-match-sim.mjs`、`tests/sprint.test.mjs`、`tests/deepseek-door-lock-decision.test.mjs`、`tests/deepseek-door-lock-longrun.test.mjs`。

文档：`docs/GAME_BALANCE_CONFIG.md`、`docs/DIFFICULTY_DESIGN.md`、`docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`、`docs/CODEBASE_BALANCE_AUDIT.md`（仅追加后续变更提示）、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`（只追加）、本报告及difficulty证据目录。

与本轮前216个源码／测试／脚本哈希对照，仅16个已存在的相关文件变化，新增3个实现／测试文件。权威 `sceneLayout.json`、`apartmentMap.ts`不变；家具110件、HideSpot15个的既有数据与测试保留，模型／动画／音频／依赖锁文件没有本轮修改。正式v6模型Git对象哈希与HEAD一致：`919c0609341e56ac308444448aff41c4cde7bd79`。没有清理未知验证材料或场景备份，没有访问私人配置。

## 下一步人工验收

请真人试玩两阵营三档的追捕、逃跑、藏身压力、30秒累计进食和小窗口菜单；特别检查浴室／其他房间锁门后AI能正常离开。原种子已在逻辑回归中修复，但本轮没有测双方胜率，不宣布已平衡。S13既有主观试听等待验收事项不因此自动完成。
