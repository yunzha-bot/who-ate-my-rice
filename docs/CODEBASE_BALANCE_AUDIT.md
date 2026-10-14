# 全项目结构审计与数值平衡准备

审计日期：2026-10-14（Asia/Shanghai）。范围：当前磁盘工作树；本轮仅审计及文档维护，没有实施代码重构、格式化或调参。本报告是可填写的工作底稿，不是新参数的授权书，也不是胜率验收。

后续变更提示（2026-10-14）：用户已另行批准并实施三档难度与正式30秒进食，见 [当前规则](DIFFICULTY_DESIGN.md)。本报告正文保留调整前的审计证据；其中5秒运行时间、DEV-B刷新／新局自动恢复及仅有0.52运行倍率的描述不再代表新行为，其他审计建议不因此自动获准实施。

## 1. 核实结果与阅读入口

- 使用 `codebase-design` 检查模块接口、职责与依赖，使用 `ponytail-audit` 检查复杂度及复用候选。后者的发现不是功能 Bug 或性能测量结论。
- 审计开始时分支为 `main`；HEAD 与本地缓存 `origin/main` 相同，历史起点为已归档的 S13 前 v6 快照（提交信息 `feat: publish pre-S13 gameplay snapshot with v6 character`）。本轮没有 fetch 或核实远端实时 SHA，没有暂存、提交、推送或 Tag。
- 未发现合并、变基或 cherry-pick 标记。已有 8 个跟踪文件改动：`docs/AGENT_LOG.md`、`docs/ASSET_PROVENANCE.md`、`docs/DEEPSEEK_HANDOFF.md`、`src/main.ts`、`src/style.css`、`src/three/GameUiLayout.ts`、`src/three/ThreeGame.ts`、`tests/faction-card-ui.test.mjs`。S13 音频、样式、测试和大量验证材料另有未跟踪内容；本轮均保留，不据此清理或改忽略规则。
- `src/` 扫描 106 个代码／数据文件、29,721 行；其中 99 个 TypeScript、6 个 CSS、1 个权威 JSON。`tests/` 107 个 MJS、20,748 行（104 个 `*.test.mjs` 与 3 个辅助脚本）；`scripts/` 3 个脚本、350 行。另检查根目录 `package.json`、锁文件依赖入口、`tsconfig.json`、`vite.config.ts`、`AGENTS.md` 和相关设计文档。行数包含空行与注释，不把文件长度等同于缺陷。
- 扫描包含未跟踪的当前 S13 源码。布局 `.bak`、原始模型、截图、`node_modules`、`dist`、私有配置目录不属于代码审计输入，没有清理或读取私人配置。历史设计只在核对行为边界时引用，不重新审核素材许可。
- **实际重新运行：`npm test` 850/850 通过，失败／跳过 0；`npx tsc --noEmit` 退出 0。** 本轮纯文档审计未重新构建、启动浏览器、试听或做 FPS／胜率测量；既有构建结果不冒充本轮结果。最终 `git diff --check` 与保护文件哈希检查见日志。
- `GAME_CONFIG` 共 **226 个叶子字段**，数组按一个字段计；另有 3 个进食模式入口。附录 A 逐项说明，附录 B 仅为可填写的玩法／技术参数表。所有“拟调整值／调整目的／验收结果”为空。
- **Human AI 倍率保持 0.52。** 无 DEV 覆盖时：DeepSeek 步行 `230 / 60 = 3.833333 u/s`；Human 玩家 `230 × 1.08 / 60 = 4.14 u/s`；Human AI `4.14 × 0.52 = 2.1528 u/s`；DeepSeek 冲刺 `3.833333 × 1.6 = 6.133333 u/s`。这只能说明速度关系，不能推导双方胜率。

优先阅读：§3（填写前的陷阱）→ §4（整理候选）→ §7（验证编号）→ 附录 A（查参数）→ 附录 B（填数值）。

## 2. 结构与权威状态

```text
src/main.ts
  ├─ StartupView / MenuCreditsView / 五层已载入样式
  └─ ThreeGame：创建对象、连接输入、主循环、生命周期、UI 与 DEV 适配
       ├─ GameStateSystem：阶段／连续抓捕累计／唯一胜负结果
       ├─ RiceField → RiceSystem：米进度／准备／中断／完成
       ├─ SprintSystem / SkillCooldown：冲刺、风险、眩晕、技能冷却
       ├─ DoorSystem / HumanDoorSkill / PulseLockSystem：门态与两类破解
       ├─ HideSystem + 公开几何判定／搜查权威结算
       ├─ HumanAIController / DeepSeekAIController：仅产生既有指令
       │    └─ NavigationSystem + PerceptionSystem + 公开快照
       ├─ CollisionWorld：最终圆形角色位移与旋转家具碰撞
       ├─ MapBuilder → AlphaPresentation → 各房间家具视觉
       ├─ CharacterActionView → 正式 v6 / AnimationMixer / HairMotion
       ├─ GameAudio / GameFeedback / AlphaHudView / PulseLockView
       └─ SceneEditor、DEV-A、DEV-B、冻结与日志适配

地图：apartmentMap.ts（房间／墙／门／米点／出生）
      └─ sceneLayout.json（110 件家具／15 个 HideSpot）
参数：gameConfig.ts → 可选 DEV-B 有效值 → 真实系统
```

- 规则模块总体已有明确的权威来源。`ThreeGame` 是复杂接线入口；UI、AI 和音频维护的缓存／规划状态不能仅因数值相似就合并为同一个计时器。
- 相对导入图扫描覆盖静态 import、re-export 和字面量动态 import；没有发现源码中的运行时导入环。发现 1 个**含类型边的环**：`HumanAIController` → `HumanHideSearchResolution` → `HumanAIController`，返回边是 `import type { HumanAIMapSnapshot }`，不是运行时循环崩溃。
- `systems/` 并非完全独立于 Three.js：`PerceptionSystem` 使用 `Camera/Vector3`；多处规则依赖 `three/map/` 的纯几何和类型；`MatchRandom` 读取权威地图。类型依赖与实际 WebGL 依赖不同，不应为了目录外观复制第二套地图／几何。
- 目录中小型 `SkillCooldown`、`HumanStillness`、`DevBRuntimeBinding` 等有行为及回归价值；单个实现不自动构成过度设计。

### 2.1 较大的文件

| 文件 | 行数 | 主要职责／判断 |
|---|---:|---|
| `src/three/ThreeGame.ts` | 3546 | 接线、输入、玩法推进、UI、DEV 数据投影；值得按稳定接口逐步整理 |
| `src/systems/DeepSeekAIController.ts` | 2788 | 找米、逃跑、试探、绕行、门与藏身规划；状态耦合高，不能整类重写 |
| `src/systems/HumanAIController.ts` | 1833 | 巡逻、调查、追逐、解锁与家具搜查；先保留状态所有权 |
| `src/three/map/MapEditModel.ts` | 963 | 编辑数据验证、碰撞与可达性；风险较高 |
| `tests/s7d-match-sim.mjs` | 946 | 无头整局仿真辅助，不是浏览器或真人胜率测试 |
| `src/systems/AILogCollector.ts` | 679 | 事件、摘要和导出契约；没有因长度而删除的依据 |
| `src/three/AlphaPresentation.ts` | 575 | 美术分发及家具合批入口 |
| `src/three/SceneEditor.ts` | 570 | 草稿、应用、保存、恢复和输入接线 |
| `src/industrial-ui.css` | 562 | 仍加载，包含被后续样式覆盖的规则 |
| `src/three/map/sceneLayout.json` | 1325 | 人工关卡数据；不是待整理代码，不格式化或重排 |

## 3. 数值填写前必须弄清的事实

这里的“必须”指填写相关字段前必须处理的误读／约束，不表示目前已复现游戏故障。

1. **开发／正式进食不由 Vite 环境自动切换。** [gameConfig.ts:1](../src/config/gameConfig.ts#L1) 的 `RICE_TIMING_MODE = 'development'`，当前每份 5000 ms；production 常量为 60000 ms。仅运行生产 build 不会改成 60 秒。5 份连续吃米、每份只准备一次的理论最低时间分别是 27 秒和 302 秒，不含移动／中断；两种模式的试玩结论不能混用。本轮不切换。
2. **DEV-B 存档可以覆盖源码默认值。** [ThreeGame.ts:331](../src/three/ThreeGame.ts#L331) 刷新时应用保存预设，`:2464` 新局先清覆盖再恢复；白名单 38 项。恢复默认值不会删除预设，下一局可能再次恢复。调参记录须写明 BASE/SAVED/UNSAVED、有效值和是否有预设。本轮没有读取浏览器 localStorage，也没有改／删预设。
3. **14 项字段未发现运行源码读取（已检查别名、整组传递、动态访问与解构，不只依赖字符串直搜）。** `backgroundColor`、`human.size`、`deepseekAI.soundCautionStrength`、`three.wallHeight`、`three.boundaryHeight`、`door.colors.open`、`door.colors.locked`、5 个旧 `pulseLock` 扫雷字段、`soundVisual.hudMidStrength/hudHighStrength`。`wallHeight` 在测试与地图常量之间有一致性断言；“未读取”不是删除授权。详细状态逐行列在附录 A。
4. **PulseLock 锁芯数量被限定为 3。** [PulseLockSystem.ts:32](../src/systems/PulseLockSystem.ts#L32) 检查 `coreCount !== 3` 就拒绝构造；同时 `targetCenters.length` 必须匹配，成功窗口须留在 `[0,1]` 内。因此 `coreCount` 是当前结构约束，不是任意填数字即可生效的旋钮。宽度 0.20 × 单程 1400 ms 得到一次穿越窗口约 280 ms，不含输入延迟与反向边界条件。
5. **米份数仍有固定文案。** `rice.activeCount` 实际驱动米抽选及胜负；但 [AlphaHudView.ts:88](../src/three/AlphaHudView.ts#L88) 的“吃完五份米”和 [ThreeGame.ts:2596](../src/three/ThreeGame.ts#L2596) 的结算文字是写死的。若将来批准更改份数，需要同步这些文案和相关测试；当前 5 份没有冲突。
6. **目前不存在对局时间上限参数。** `match.readyMs` 是准备时间，`maxFrameDeltaMs` 是单帧推进截断，`elapsedMs` 是已进行时间；不能将其中某个值当作限时胜负。
7. **普通抓捕与 Q 命中不是同一耗时机制。** `captureMs=350` 管连续有效接触；搜查／扇形命中可调用 `forceCapture()` 立即结算。只改 350 不会让 Q 也等待 350 ms。
8. **AI 感知声音与实际音频独立。** 五个脚步／冲刺／开关门 Ogg 已删除，事件接口静音；AI 的 FOOTSTEP/SPRINT/DOOR_* 仍有效。`GameAudio.worldAudioGain` 的 11 u 是玩家听觉表现范围，不能把它当作 `perception.sounds.*.range` 的同义配置。
9. **声音 range 生效时机存在已复现的文档／代码冲突。** `RuntimeDebugOverrides.ts:63–66` 将9个范围字段标为仅新事件，但 `PerceptionSystem.ts:187` 在每次分析现有事件时读取有效 range，`dev-b-runtime-effect.test.mjs:111` 也要求同一事件立即响应范围变化。本轮只读探针：先产生一条16u外FOOTSTEP，17u范围可听；改5u后同一条未过期事件不可听（事件数仍为1）。强度与寿命在 `emit` 中取快照。应由用户决定保留实际即时行为并修正文案／元数据，还是另行恢复“仅新事件”的设计；本轮均不改。

## 4. 按优先级排列的整理清单

| ID／级别 | 位置与证据 | 影响 | 建议与预期修改范围 | 风险／验证 |
|---|---|---|---|---|
| A01／调参前必须核对 | `gameConfig.ts:1–7`；`ThreeGame.ts:331,2464–2465`；`RuntimeDebugOverrides.ts` | 源码值、模式与实际有效值可能不同 | 优先完善调参操作记录；不新增第二套参数状态。若以后实现显示增强，仅使用现有 DEV-B 入口 | 改覆盖生命周期风险高；V2、V3、V13；本轮只文档 |
| A02／调参前必须纠正文档 | `gameConfig.ts:82` 定义 `soundCautionStrength`；`DeepSeekAIController.ts:1393` 使用 `minimumAudibleStrength` 与 `soundEvadeStrength` | 文档承诺的弱声音旋钮实际不生效；还有 13 项无运行读取字段 | 数值索引明确“未读取／历史／视觉”；是否恢复使用或删除须另行设计授权 | 接回 AI 会改变逃跑行为，不能作为文档修复顺手实施；V5 |
| A03／特定调参前必须处理 | `PulseLockSystem.ts:32` 固定 3；`AlphaHudView.ts:45,88` 固定 5 个米图标／5份文案 | 改芯数可能启动报错；改米份数可能提示失真 | 本轮表格标约束；仅在批准调整这些参数时同步结构或文案 | V3、V4、V13；不是当前默认值 Bug |
| A04／值得整理 | `ThreeGame.ts:894–1363` 的 `updatePlaying`、`:2763–3257` 的调试详情，以及 S13 接线 | 一个文件同时承担规则编排与大量展示投影，改动面较大 | 第一候选：提取调试数据投影或暂停菜单适配之一，保持单向输入和既有状态持有者；不要同时拆两套 AI | `ThreeGame`、相关 UI/DEV 测试；高风险，V1/V2/V8/V13；不添加空壳转发层 |
| A05／值得整理，后做 | 两套 AI 控制器 2788／1833 行；已有候选评分、路线估时、退出判据 | 多个策略与状态转换集中，但当前能通过回归 | 只在函数可纯化、减少调用者理解成本时提取评分／路线估时；AI 状态与时钟仍由原控制器拥有 | 不能“统一”两阵营不同语义；V5/V6/V7/V12/V13；不同时调数值 |
| A06／值得整理 | `main.ts:2–6` 依次载入 style、industrial、sheet、s13、game；`s13-ui.css:41` 与 `game-ui.css:82` 均定义暂停／结算按钮 | 最终外观依赖导入顺序、选择器优先级与历史覆盖，容易复现此前 UI 崩坏 | 先按首页／HUD／暂停／PulseLock 分析最终 computed style，再逐区域合并；保留阵营卡与 DEV 的特殊样式 | 无运行截图不能认定规则冗余；V9/V10/V13；禁止全文件删除旧 CSS |
| A07／值得整理 | `DoorView.ts:89–99` 生成闭门碰撞盒，`ThreeGame.ts:2327` 将其交给 CollisionWorld；Perception／Navigation／MapEditModel 另有同类平面门叶计算 | 门的玩法几何部分经 View 供给，未来改美术容易误碰碰撞 | 可考虑一个纯函数表达**逻辑门叶**供碰撞／遮挡复用，保持独立的 `doorVisualGeometry` 与原厚度 | 不是复制新的 DoorSystem；V4/V8/V11；先证明厚度、朝向和边界一致 |
| A08／可选整理 | `HumanAIController.ts:18` 读取 `evaluateHideStance`；`HumanHideSearchResolution.ts:6` 类型回指控制器 | 类型耦合环，当前没有运行时循环 | 若 A04/A05 确实需要独立公开契约，再迁移 `HumanAIMapSnapshot` 到现有合适的契约位置；不为消环单独制造空层 | V7/V8、tsc；低至中风险 |
| A09／值得整理 | `alpha-presentation.test.mjs:138`、`skill-cooldown.test.mjs:30` 等读取源文件进行正则断言；部分测试使用内部接线对象 | 格式或函数搬移也可能使测试失败；部分断言确实保护“禁止重新启用”等契约 | 逐项区分行为契约和源码形状；保留禁令测试，仅将证实与实现耦合的部分迁到公共行为接口 | 不能删测试或放宽语义迎合重构；V1/V7/V9/V10 |
| A10／值得整理 | `HomeGymVisual.ts:10`、`prepare-rice-bag.mjs:7` 压缩式代码；`ThreeGame.ts:3410` 方法声明与首句同一行；导入扩展名写法不统一 | 阅读与小范围审查困难 | 选定既有主流单引号／两空格风格，先对下一批实际编辑文件整理；格式变更独立于玩法改动 | 尚无 Prettier/ESLint/Biome/.editorconfig；不必为一次审计新增工具；格式工具引入另行批准 |
| A11／可选工程检查 | `tsconfig.json` 只 include `src`；MJS 测试与 `vite.config.ts` 不在独立 tsc 检查范围 | tsc 通过不能证明构建配置或 JS 测试都经过静态类型检查 | 记录检查范围；若以后扩展检查，单独评估 Node 类型与测试环境配置 | V14；本轮没有新增依赖或配置 |
| A12／低风险文档候选 | `RuntimeDebugOverrides.ts:8–12` 只描述页内覆盖；真实 preset 行为在 `DevBParamPersistence` 与 DEV-B 设计 §12；`AGENTS.md:46` 仍称正式角色未导入 | 孤立阅读注释会误解当前状态 | 前者补充“覆盖层自身不持久化，编排层会恢复”；后者仅登记为过期文字，不借审计改长期规则 | 注释／交接修订；不改历史 AGENT_LOG；无玩法风险 |
| A13／可选简化 | `ThreeGame.ts:146,532,2454` 的 `lastChase` 仅声明、比较赋值及重置；全项目允许范围搜索无外部／动态读取 | 没有驱动音乐选择，音乐已经根据当帧 `chase` 调用具备去重的 `setMusic` | 可在后续批准的小清理中删除这 3 行字段维护 | V10；本轮未删；已证实的净减量 3 行 |
| A14／低收益，可保留 | 多个房间视觉重复 box／round 包装与 emit 签名，如 Balcony:6,10、Kitchen:6,10、MainBedroom:6,10 | 修改重复接口费力，但实现只有数行且分段数不同 | 先考虑共享 emit 类型；仅在统一确有收益时共享几何帮助函数，保留索引／分段／坐标差异 | V11、原房间视觉测试与四向截图；不引入通用家具框架 |
| A15／调试听觉前需决策 | `RuntimeDebugOverrides.ts:63–66` 及 DEV-B 设计§12声称range只影响新事件；`PerceptionSystem.ts:187` 和 `dev-b-runtime-effect.test.mjs:111–123` 实际即时作用于同一事件，读探针已复现 | 面板／设计说明与运行行为相反，听觉实验可能误判 | 先记录冲突；若选择当前行为，后续只修元数据／文案与相关说明；若恢复旧设计需事件范围快照及回归，属于行为变化 | V2、V5；本轮不替用户选择、不修源码；不是通过删改测试掩盖冲突 |

没有足够证据要求删除依赖。当前运行依赖仅 Three.js，开发依赖为类型包、TypeScript 与 Vite。未发现需要本轮擅自修复的已证实阻断性功能回归；自动化通过也不证明没有潜在 Bug。

### 4.1 ponytail-audit 简化候选（不实施）

按潜在减少的维护面优先排列，未实施的收益不虚报为实测删行：

1. `shrink:` 梳理暂停／结算同选择器的历史 CSS 覆盖，替换为经截图证实等价的区域规则；先看最终样式。[main.ts](../src/main.ts#L2)、[s13-ui.css](../src/s13-ui.css#L41)、[game-ui.css](../src/game-ui.css#L82)（A06）。
2. `reuse:` 调试详情与 DEV-B 帧中的同源数据投影优先共用已有计算结果；不共用拥有不同权限的公开信息与开发者真值。[ThreeGame.ts](../src/three/ThreeGame.ts#L2763)（A04）。
3. `reuse:` 多房间 emit 类型／同形 box 包装可择机共用；分段数与坐标处理各有差异，不能机械替换。[BalconyFurnitureVisual.ts](../src/three/BalconyFurnitureVisual.ts#L6)（A14）。
4. `delete:` `lastChase` 的声明、无效维护与重置，共 3 行；替代为空，音乐继续读取当帧 chase 并由 GameAudio 去重。[ThreeGame.ts](../src/three/ThreeGame.ts#L146)（A13）。

net: -3 lines, -0 deps possible. 仅计已逐行证实的候选；CSS／投影复用收益需实施试验后测量。本轮实际删除代码为 0 行。

## 5. 可以保留的结构与边界

- `RiceField/RiceSystem`、`DoorSystem/HumanDoorSkill/PulseLockSystem`、`GameStateSystem/SprintSystem/SkillCooldown` 已分开持有不同职责；不要为了减少文件数合并。
- `RuntimeDebugOverrides`、`DevBParamPersistence`、`DevBParamStore` 分别是有效值、编排、存储契约，38 项覆盖是授权的专门机制，不是重复 GAME_CONFIG。
- `SoundVisualView` 与归档快照、5 个禁用音频事件、程序化角色回退、旧版资源本机保留、DEV-A/B 和场景备份均不是本轮删除候选。`rain-ui.css` 已明确不载入且有历史保留记录，本轮不删。
- `ThreeGame.mapSignature` 与 `MapLayoutStore.layoutSignature` 覆盖字段与精度不同，前者比较已应用几何，后者比较可编辑文档（含朝向／交互区域）。不能因为都叫签名就直接共用；若后续调整其语义须单独验证地图重绑定与藏身生命周期。
- 纯几何小函数、状态枚举、数学容差、视觉尺寸／材质／合批常量不应全部塞入 GAME_CONFIG。地图坐标和 HideSpot 交互区域属于作者布局数据。
- `HumanSearchTuning.ts` 的线索链、站位采样、候选权重是已有设计明确保护的内部阈值；迁入平衡表会改变可调范围，需单独授权。
- 模型／头发／家具／阴影表现已有独立 View 或视觉函数，不按“只被一个调用者调用”判定无价值。

## 6. 建议分批实施顺序（均尚未授权实施）

| 批次 | 可选范围 | 修改性质 | 验证与验收 |
|---|---|---|---|
| B0 | 本报告、参数索引误读修正、覆盖／模式说明 | 文档 | diff 检查；用户确认认识与字段分类 |
| B1 | A13 三行冗余状态、A10 少量确需编辑文件格式 | 行为等价小清理 | 全量测试、tsc、build、diff；菜单／追逐音乐去重 |
| B2 | A06 仅一个界面区域的 CSS 整理 | 视觉等价整理 | 同分辨率前后截图、键鼠／焦点／小窗口；不得同时换设计 |
| B3 | A04 只提取一个深模块，按调用者需要设计接口 | 行为等价结构整理 | 公共行为回归、DEV/暂停/重开浏览器；保持同一时钟和状态所有权 |
| B4 | 如有实际维护收益，再做 A07/A08/A14 | 契约／复用整理 | 几何、搜查、地图存档、四向视觉逐项回归；地图哈希不变 |
| B5 | 用户填写附录 B 后，一次只改一个相关参数组 | **玩法变化** | 先固定模式和 DEV 状态；同种子配对试玩；分别记录双阵营真人与仿真数据；全量门禁 |

A15 的 range 时机先由用户选择目标行为；不与纯结构整理混改。现有强度／寿命的新事件生效语义不受该范围字段争议影响。

不要在 B1–B4 混入平衡改动。A05 的 AI 提取放到明确有维护需求后，不能以“整理全部代码”为理由一次性重写。新格式工具、目录搬移与模块接口草图均为建议，不是本轮已实施内容。

### 6.1 平衡实验记录要求

每次记录参数差异、模式、DEV 预设状态及有效值、种子、主控阵营、真人／仿真、胜负原因、耗时、吃米数、冲刺／摔倒次数、抓捕／搜查与开锁结果。建议对相同种子前后配对，而不是用不同随机局比较。双方对称胜率不是本轮预设目标，也没有实测依据承诺 50%。

先确认进食模式，再比较基础移动与接触机会，然后调整冲刺风险／冷却、吃米成本、门与技能，最后再看 AI 感知／搜查／逃跑策略。技术参数（碰撞细分、导航格、帧截断、重抽上限）应按正确性与稳定性验证，不以“更难／更易”为唯一标准。

## 7. 验证编号与读表约定

下面编号均指**已经存在的相关测试家族**和未来调参验证方法，不表示每个字段都有独立敏感性测试。直接出现参数路径的测试仅能证明有引用；根据配置计算预期的断言也不能独立证明设计值正确。

| 编号 | 相关现有测试／验证方法 |
|---|---|
| V1 | `game-state.test.mjs`、`sprint.test.mjs`、`skill-cooldown.test.mjs`：阶段、暂停、连续抓捕、冲刺风险／冷却 |
| V2 | `runtime-debug-overrides.test.mjs`、`dev-b-runtime-effect.test.mjs`、`dev-b-param-persistence.test.mjs`：38 项覆盖及保存／恢复 |
| V3 | `rice.test.mjs`、`rice-field.test.mjs`、`balance-config.test.mjs`：进食准备、中断、模式与候选抽选；份数变化另验 HUD |
| V4 | `door-system.test.mjs`、`human-door-skill.test.mjs`、`pulse-lock.test.mjs`：门态、锁位、免费开门、强破和时机窗口 |
| V5 | `perception.test.mjs`、`rice-trace-clues.test.mjs`、`human-trace-tracking.test.mjs`：真实听觉、视觉、米痕；不启用玩家声音圈 |
| V6 | `human-ai.test.mjs`、`navigation.test.mjs`、`human-ai-check-hide.test.mjs`、`human-ai-search-lifecycle.test.mjs`、`human-ai-stance-approach.test.mjs`：巡逻、追逐、解锁、搜查 |
| V7 | `deepseek-ai.test.mjs`、`deepseek-evade.test.mjs`、`deepseek-curiosity*.test.mjs`、`deepseek-passage.test.mjs`、`deepseek-safe-wait.test.mjs`、`deepseek-hide-*.test.mjs`、`deepseek-door-*.test.mjs`：逃跑、绕行、锁门、藏身与有界循环 |
| V8 | `hide-system.test.mjs`、`hide-target-resolution.test.mjs`、`human-search-skill.test.mjs`、`human-furniture-search.test.mjs`、`player-q-priority.test.mjs`：合法性／公开信息／Q 优先级 |
| V9 | `alpha-hud.test.mjs`、`faction-card-ui.test.mjs`、`menu-credits.test.mjs`、`camera-controls.test.mjs`；真实浏览器多分辨率／焦点／ESC |
| V10 | `game-audio.test.mjs`：音频禁用、设置、并发及生命周期；另需实际试听 |
| V11 | `collision-world.test.mjs`、`rotated-rect.test.mjs`、`door-visual-clearance.test.mjs`、各房间 visual 测试、`scene-editor*.test.mjs`、`cutaway-wall-shadow.test.mjs`；四向镜头／模型／地图哈希 |
| V12 | `match-random.test.mjs`、`s7d-full-match.test.mjs` 与 `s7d-match-sim.mjs`：固定种子布局与无头整局；不是当前真人胜率 |
| V13 | 人工双阵营进入／移动／追逐／门／吃米／躲藏／技能／暂停／重开／DEV 保存刷新；本轮未执行 |
| V14 | 独立 tsc、生产 build、git diff 检查；本轮 tsc 已执行，build 未重跑 |
| V15 | `character-action.test.mjs`、`deepseek-animation.test.mjs`、`deepseek-hair.test.mjs`、`rice-view.test.mjs`、`rice-bag-model.test.mjs`：纯表现回归，不据此调整动画资产 |

附录中的读取位置是当前文件行号；C 表示 GAME_CONFIG。配置通过整组对象传入的字段已补核对目标模块，不能把“直接搜索未命中”当作无人读取。DEV 标“否”指不在现有 38 项白名单，不表示生产值不可修改；所有正式值仍须用户批准。

## 8. 散落常量与文档核对

| 类型／位置 | 真实来源与处理意见 |
|---|---|
| 进食模式 | `RICE_MAX_PROGRESS_MS` 两值与 `RICE_TIMING_MODE` 同处 gameConfig.ts，是派生入口，不再创建第二套米时长 |
| 地图／布局 | apartmentMap.ts、sceneLayout.json；18 个区域、30 扇现有门、14 个米候选、110 件家具、15 个 HideSpot；不迁入参数表 |
| 碰撞／导航内部实现 | 符号容差、路径采样、旋转矩形算法留在原模块；真实可调基础已有 collision / humanAI.navCellSize |
| 搜查内部阈值 | `HumanSearchTuning.ts` 的 17 个有名称技术常量（不含汇总数组）；采样复用 navCellSize，链距复用 traceStepDistance；保留现有设计分类 |
| 美术／模型 | HOME_PALETTE、HOME_COMPOSITION、GLB 显示尺寸、头发摆动、相机平滑、家具局部尺寸均为表现常量，不能当作角色碰撞／速度值 |
| 音频 | `GameAudio.ts` 默认五路音量、并发／间隔、11 u 距离衰减与素材合成参数属于听觉表现；已有用户音量存档，不写回 GAME_CONFIG |
| UI | CSS 颜色、间距、响应式断点、交互提示屏幕偏移为表现；不迁入平衡配置。固定“五份”文案与可配置份数的关联见 A03 |
| 历史配置 | 旧扫雷、未用的 HUD 强度与已停用声音圈明确标记，不删除、不重新启用 |

`GAME_BALANCE_CONFIG.md` 的 0.52 与当前源码一致；进食模式和无对局上限说明也正确。已确认需要更正的索引说明：soundCautionStrength 未使用、Human size 未读取、PulseLock 芯数固定 3、门叶高度只作为逻辑碰撞高度、门色在 sync 被住宅美术常量覆盖、activeCount 关联固定 UI 文案。该索引只补这些证据充分的说明，不整篇改写历史设计。

## 附录 A. 完整数值目录

u = XZ 世界单位；ms = 毫秒。226 行对应 226 个叶子字段，以下是审计时快照；以后调参应同时维护源码与正式配置索引，不把本快照当作第二套配置。

### 关联编号

| 编号 | 关联与风险 |
|---|---|
| K1 | player.speed × human.speedMultiplier × humanAI.movementSpeedMultiplier ÷ three.pixelsPerUnit；米范围同除 pixelsPerUnit；actorHeight/playerRadius 影响可站立。外观缩放与碰撞独立。 |
| K2 | AI 解锁估时 = travel/speed + 锁数×(duration/chance 或 forceBreakReserve) + 锁格代价×navCellSize/speed；detourSlack 控制选绕行。searchDwell/searchMax/配额/失败冷却叠加；站位采样读 navCellSize，候选尝试数读 searchRoomCount。 |
| K3 | 冲刺起步用全局米进度与 riskThreshold 决定是否结束必摔；cooldown 起步即计时并覆盖冲刺阶段；duration、speed、stun 与逃跑触发阈值联合验收。 |
| K4 | DoorSystem 是门态权威；锁位／锁芯失效规则不由冷却取代；Human Space、玩家 Q、AI 门冷却／禁锁惩罚分别生效。leafThickness 关联碰撞／遮挡／导航，leafHeight 仅闭门逻辑盒。 |
| K5 | visionRange、visionEvadeDistance、soundEvadeStrength 与 minimumAudibleStrength 共同产生威胁；评分权重、最短逃跑、目标保持、迟滞、近期访问叠加，不可逐项承诺胜率单调。 |
| K6 | HumanStillness 的静止事件＋目视资格；概率按事件抽选；安全通行半径包含有效 captureRadius 和 safetyMargin，仍须真实可走路线。 |
| K7 | HideSpot 公开区域／朝向／站位来自地图；hideThreatDistance 应小于 visionEvadeDistance。退出复用 escapeMinSeparation 与有效 captureRadius；近期记忆复用 escapeVisitMemoryMs；玩家 Q 命中可立即结算。 |
| K8 | activeCount ≤ candidateCount ≤ 已绘制候选数14；activeCount 影响全局进度分母／必摔触发。prepareMs 每次恢复重付；maxProgressMs 由模式选择。份数关联固定五份 UI 文案。 |
| K9 | coreCount 必须3且 targetCenters 长度一致；0 < targetWidth < 1，各 center±width/2 留在[0,1]，travelMs > 0；feedback 为显示计时。 |
| K10 | 最终 AI 可听强度 = 事件 strength × (1−距离/range)^falloffPower × 各遮挡系数；超过范围或低于 minAudible 不可听；来源阵营过滤。Ogg 音量不是 AI 强度。 |
| K11 | traceGeneration 是生成资格窗口，traceLifetime 是每条寿命，traceFade≤lifetime；脚印间距决定数量并派生 TRACE_LINK_DISTANCE=step×6；视觉只影响显示。 |
| K12 | 历史扫雷、停用声音表现与悬空 HUD 配置保留，不能假称调了就影响当前对局。 |
| K13 | 出生间距、不同房间、真实碰撞／导航可达和所有米／HideSpot 可达共同验证；超过尝试上限使用验证过的回退。 |
| K14 | READY 和 PLAYING 时间源分开；暂停／DEV 冻结不推进玩法；maxFrameDelta 只截断单帧。captureMs 只管连续接触，Q forceCapture 立即结算；没有限时胜负参数。 |
| K15 | 正式 v6 动作和头发表现独立于规则；交叉淡入、特殊待机与 FALL 姿态不修改速度／stunMs。本轮不修改模型／动画。 |

### 旧背景（1 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.backgroundColor`](../src/config/gameConfig.ts#L10) | `"#858b91"` | RGB色值；旧背景颜色；当前场景使用 HOME_PALETTE.background。 | 无运行读取命中；已人工复核 | K1 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V11、V2、V9 | 否；未见运行读取（保留） |

### 开发输入（2 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.development.factionSwitchEnabled`](../src/config/gameConfig.ts#L13) | `true` | 开关；开发控制权交接开关；部分正式／DEV 输入接线共读。 | [ThreeGame:261](../src/three/ThreeGame.ts#L261) | K1 | 启用／关闭对应开发输入路径；不属于胜率平衡值。 | V9、V1 | 否；开发输入开关 |
| [`GAME_CONFIG.development.directHotkeysEnabled`](../src/config/gameConfig.ts#L15) | `false` | 开关；裸 R/M/Tab 调试快捷键开关，当前关闭。 | [ThreeGame:655](../src/three/ThreeGame.ts#L655) | K1 | 启用／关闭对应开发输入路径；不属于胜率平衡值。 | V9、V1 | 否；开发输入开关 |

### 角色基础（6 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.player.size`](../src/config/gameConfig.ts#L18) | `32` | px；占位角色边长：像素，运行时按 pixelsPerUnit 换算。 | [apartmentMap:59](../src/three/map/apartmentMap.ts#L59)；[ThreeGame:308](../src/three/ThreeGame.ts#L308) | K1 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V11、V2、V9 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.player.speed`](../src/config/gameConfig.ts#L19) | `230` | px/s；DeepSeek 基础速度：像素/秒。 | [DeepSeekAIController:316](../src/systems/DeepSeekAIController.ts#L316)；[DevBHelpText:94](../src/systems/DevBHelpText.ts#L94)；[DevBRuntimeBinding:70](../src/systems/DevBRuntimeBinding.ts#L70)；[HumanAIController:927](../src/systems/HumanAIController.ts#L927)；[RuntimeDebugOverrides:113](../src/systems/RuntimeDebugOverrides.ts#L113) | K1 | 增大提高 DeepSeek 步行，并同比提高 Human 基础／AI 和冲刺速度；减小反向。 | V11、V2、V9 | 是：`movement.playerSpeed`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.player.color`](../src/config/gameConfig.ts#L20) | `0x3197ff` | RGB色值；DeepSeek 基础占位／回退表现色，不是正式 GLB 贴图颜色。 | [CharacterActionView:160](../src/three/CharacterActionView.ts#L160)；[ThreeGame:309](../src/three/ThreeGame.ts#L309) | K1 | 改变对应表现颜色，色值大小不代表难度升降。 | V11、V2、V9 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.human.size`](../src/config/gameConfig.ts#L23) | `32` | px；历史 Human 占位边长；两角色当前共用 player.size 创建代理。 | 无运行读取命中；已人工复核 | K1 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V11、V2、V9 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.human.speedMultiplier`](../src/config/gameConfig.ts#L24) | `1.08` | 比例／倍率；相对 DeepSeek 基础速度的倍率。 | [DevBHelpText:100](../src/systems/DevBHelpText.ts#L100)；[DevBRuntimeBinding:71](../src/systems/DevBRuntimeBinding.ts#L71)；[HumanAIController:929](../src/systems/HumanAIController.ts#L929)；[RuntimeDebugOverrides:118](../src/systems/RuntimeDebugOverrides.ts#L118) | K1 | 增大只提高 Human 玩家与 AI 基础速度及路线估时；减小反向。 | V11、V2、V9 | 是：`movement.humanSpeedMultiplier`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.human.color`](../src/config/gameConfig.ts#L25) | `0xf28b45` | RGB色值；Human 基础表现色，不调整追逐规则。 | [CharacterActionView:160](../src/three/CharacterActionView.ts#L160)；[ThreeGame:311](../src/three/ThreeGame.ts#L311) | K1 | 改变对应表现颜色，色值大小不代表难度升降。 | V11、V2、V9 | 否；表现／非日常平衡 |

### Human AI（21 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.humanAI.movementSpeedMultiplier`](../src/config/gameConfig.ts#L28) | `0.52` | 比例／倍率；AI 移速倍率：在 Human 基础速度上降低 48%，不影响玩家手动控制；2026-10-12 用户确认保留。 | [DevBHelpText:106](../src/systems/DevBHelpText.ts#L106)；[DevBRuntimeBinding:72](../src/systems/DevBRuntimeBinding.ts#L72)；[HumanAIController:123](../src/systems/HumanAIController.ts#L123)；[RuntimeDebugOverrides:123](../src/systems/RuntimeDebugOverrides.ts#L123) | K2 | 增大提高 Human AI 速度并缩短路线估时，不改 Human 玩家；减小反向。 | V6、V2、V8 | 是：`movement.humanAiMultiplier`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.humanAI.navCellSize`](../src/config/gameConfig.ts#L29) | `0.4` | u；寻路网格边长：XZ 世界单位。 | [DeepSeekAIController:1214](../src/systems/DeepSeekAIController.ts#L1214)；[HumanAIController:945](../src/systems/HumanAIController.ts#L945)；[HumanSearchTuning:62](../src/systems/HumanSearchTuning.ts#L62)；[NavigationSystem:21](../src/systems/NavigationSystem.ts#L21) | K2 | 增大使网格与站位采样更粗；减小更细且查询成本更高，不保证路径更优。 | V6、V2、V8 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.humanAI.repathIntervalMs`](../src/config/gameConfig.ts#L30) | `500` | ms；目标移动后的最长重新寻路间隔：毫秒。 | [HumanAIController:809](../src/systems/HumanAIController.ts#L809) | K2 | 增大降低追踪重规划频率；减小提高频率与查询成本。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.waypointTolerance`](../src/config/gameConfig.ts#L31) | `0.25` | u；通过路径点的距离：世界单位。 | [HumanAIController:705](../src/systems/HumanAIController.ts#L705)；[ThreeGame:1961](../src/three/ThreeGame.ts#L1961) | K2 | 增大更早视为通过节点；减小要求更接近，可能抖动。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.investigationDwellMs`](../src/config/gameConfig.ts#L32) | `3000` | ms；到达声音/目击区域后观察时间：毫秒。 | [HumanAIController:623](../src/systems/HumanAIController.ts#L623) | K2 | 增大延长到达调查点后的观察；减小更快继续行动。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.stuckRepathMs`](../src/config/gameConfig.ts#L33) | `800` | ms；移动受阻后的重新寻路时间：毫秒。 | [HumanAIController:1743](../src/systems/HumanAIController.ts#L1743) | K2 | 增大更久才处理卡路；减小更早重规划。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.stuckProgressEpsilon`](../src/config/gameConfig.ts#L34) | `0.05` | u；卡路检测窗口内靠近路径节点的最小距离：世界单位。 | [HumanAIController:1738](../src/systems/HumanAIController.ts#L1738) | K2 | 增大要求更多靠近进展，较易判卡路；减小较宽松。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.closedDoorPathCost`](../src/config/gameConfig.ts#L35) | `3` | 代价/格；普通关门格的额外无量纲寻路代价。 | [NavigationSystem:138](../src/systems/NavigationSystem.ts#L138) | K2 | 增大更倾向绕开普通关门格；减小更愿通过；实际仍须开门。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.lockedDoorPathCost`](../src/config/gameConfig.ts#L36) | `12` | 代价/格；规划可破解锁门路线时，每个锁门格的额外网格代价。 | [HumanAIController:945](../src/systems/HumanAIController.ts#L945) | K2 | 增大抬高锁门路线的估时罚项；减小更愿处理锁门。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.aiUnlockDurationMs`](../src/config/gameConfig.ts#L37) | `8750` | ms；AI 模拟破解锁芯的一次尝试时长：毫秒（原 5 秒的 1.75 倍）。 | [HumanAIController:943](../src/systems/HumanAIController.ts#L943)；[ThreeGame:2834](../src/three/ThreeGame.ts#L2834) | K2 | 增大延长每次 AI 破解且抬高路线估时；减小反向。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.aiUnlockSuccessChance`](../src/config/gameConfig.ts#L38) | `0.7` | 概率[0,1]；AI 单次破解成功概率：0～1。 | [HumanAIController:943](../src/systems/HumanAIController.ts#L943) | K2 | 增大提高 AI 每次破解概率并降低估算破解成本；减小反向；不能为 0 后仍期望有限估时。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.aiUnlockMaxAttempts`](../src/config/gameConfig.ts#L39) | `2` | 次／个；同一锁芯本局最多尝试次数。 | [HumanAIController:855](../src/systems/HumanAIController.ts#L855) | K2 | 增大允许更多次尝试；减小更早放弃同一锁芯。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.aiUnlockFailureAvoidMs`](../src/config/gameConfig.ts#L40) | `6000` | ms；失败后暂避该锁门的时间：毫秒。 | [HumanAIController:991](../src/systems/HumanAIController.ts#L991) | K2 | 增大失败后避开该门更久；减小更早重试规划。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.forceBreakReserveMs`](../src/config/gameConfig.ts#L41) | `1800` | ms；路线比较时为长冷却技能保留的等效时间：毫秒。 | [HumanAIController:942](../src/systems/HumanAIController.ts#L942) | K2 | 增大提高强破的保留成本，较倾向绕行；减小较倾向强破。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.detourSlackMs`](../src/config/gameConfig.ts#L42) | `600` | ms；绕行路线可比锁门方案多耗费的容差：毫秒。 | [HumanAIController:947](../src/systems/HumanAIController.ts#L947) | K2 | 增大允许绕行比锁门方案更慢仍选绕行；减小反向。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.searchRadius`](../src/config/gameConfig.ts#L43) | `12` | u；Last Seen 周边有限搜索半径：世界单位。 | [HumanAIController:1011](../src/systems/HumanAIController.ts#L1011) | K2 | 增大扩大追丢后相邻房间候选范围；减小收窄。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.searchRoomCount`](../src/config/gameConfig.ts#L44) | `3` | 次／个；一次追丢最多搜索的相邻房间数。 | [HumanAIController:1015](../src/systems/HumanAIController.ts#L1015)；[HumanSearchTuning:84](../src/systems/HumanSearchTuning.ts#L84)；[ThreeGame:2891](../src/three/ThreeGame.ts#L2891) | K2 | 增大提高房间候选上限及家具候选尝试上限；减小反向。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.searchDwellMs`](../src/config/gameConfig.ts#L45) | `900` | ms；每个搜索点的观察停留：毫秒。 | [HumanAIController:184](../src/systems/HumanAIController.ts#L184) | K2 | 增大延长搜索点／家具搜查观察；减小更快结算观察。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.searchMaxMs`](../src/config/gameConfig.ts#L46) | `15000` | ms；一次追丢搜索总时限：毫秒。 | [HumanAIController:671](../src/systems/HumanAIController.ts#L671) | K2 | 增大延长共享追丢／家具搜索预算；减小更早回巡逻。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.hideCheckFailureCooldownMs`](../src/config/gameConfig.ts#L50) | `6000` | ms；同一件家具搜空后的再次检查冷却：毫秒。 | [HumanAIController:1575](../src/systems/HumanAIController.ts#L1575) | K2 | 增大延长同家具搜空冷却；减小更早可再查。 | V6、V2、V8 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanAI.hideCheckMaxPerRound`](../src/config/gameConfig.ts#L51) | `1` | 无量纲；每轮调查最多正式检查的家具数：件。 | [HumanAIController:197](../src/systems/HumanAIController.ts#L197) | K2 | 增大提高每轮正式查家具的配额；减小减少；不是玩家 Q 冷却。 | V6、V2、V8 | 否；有效玩法参数 |

### DeepSeek AI（70 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.deepseekAI.waypointTolerance`](../src/config/gameConfig.ts#L54) | `0.25` | u；路径节点到达容差：XZ 世界单位。 | [DeepSeekAIController:918](../src/systems/DeepSeekAIController.ts#L918)；[ThreeGame:2087](../src/three/ThreeGame.ts#L2087) | K5 | 增大较早通过节点；减小更精确但可能卡节点。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stuckRepathMs`](../src/config/gameConfig.ts#L55) | `800` | ms；持续未靠近节点后重新寻路的时间：毫秒。 | [DeepSeekAIController:2697](../src/systems/DeepSeekAIController.ts#L2697) | K5 | 增大延后卡路重规划；减小提前。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stuckProgressEpsilon`](../src/config/gameConfig.ts#L56) | `0.05` | u；上述时间内应缩短的最小节点距离：世界单位。 | [DeepSeekAIController:2693](../src/systems/DeepSeekAIController.ts#L2693) | K5 | 增大更易判进展不足；减小更宽松。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget`](../src/config/gameConfig.ts#L57) | `2` | 无量纲；同一米堆连续卡路后允许的重寻路次数。 | [DeepSeekAIController:2700](../src/systems/DeepSeekAIController.ts#L2700) | K5 | 增大对同目标容忍更多重规划；减小更早换目标／取消计划。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.retryMs`](../src/config/gameConfig.ts#L58) | `1500` | ms；米堆暂不可达或全无路线时的重选等待：毫秒。 | [DeepSeekAIController:775](../src/systems/DeepSeekAIController.ts#L775) | K5 | 增大不可达米点重试等待；减小更频繁选点。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.visionEvadeDistance`](../src/config/gameConfig.ts#L59) | `5` | u；看见 Human 且距离小于此值时逃跑：世界单位。 | [DeepSeekAIController:1072](../src/systems/DeepSeekAIController.ts#L1072) | K5 | 增大更早因目视距离进入高威胁逃跑；减小等更近。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.soundEvadeStrength`](../src/config/gameConfig.ts#L60) | `0.09` | 无量纲强度；听到 Human 的最终强度达到此值时逃跑。 | [DeepSeekAIController:820](../src/systems/DeepSeekAIController.ts#L820) | K5 | 增大需更强声音才高威胁逃跑；减小更敏感。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.soundThreatProjection`](../src/config/gameConfig.ts#L61) | `4` | u；未目视时只沿声音八方向投射粗略威胁点：世界单位。 | [DeepSeekAIController:1411](../src/systems/DeepSeekAIController.ts#L1411) | K5 | 增大把八方向粗略威胁点投得更远；减小更近；不会读取隐藏者精确位置。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.lastSeenAlertMs`](../src/config/gameConfig.ts#L62) | `2500` | ms；失去视线后参考最后目击点的短暂警戒：毫秒；已拉开安全距离时不额外强制原地等待。 | [DeepSeekAIController:729](../src/systems/DeepSeekAIController.ts#L729) | K5 | 增大保留最后目击的警戒参考更久；减小更快过期。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.alertHoldMs`](../src/config/gameConfig.ts#L63) | `1800` | ms；最后一次高威胁后的警戒记忆：毫秒；安全路线已成立时可转入移动恢复。 | [DeepSeekAIController:717](../src/systems/DeepSeekAIController.ts#L717) | K5 | 增大保留高威胁记忆更久；减小更快进入安全恢复条件。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.minimumEvadeMs`](../src/config/gameConfig.ts#L64) | `900` | ms；单次逃跑最短时间，避免吃米/逃跑来回抖动：毫秒。 | [DeepSeekAIController:1481](../src/systems/DeepSeekAIController.ts#L1481) | K5 | 增大一次逃跑最短停留；减小更快可结束但可能振荡。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.recoverMs`](../src/config/gameConfig.ts#L65) | `1200` | ms；威胁降低后沿安全米点路线移动的警戒上限：毫秒，不强制静止。 | [DeepSeekAIController:1727](../src/systems/DeepSeekAIController.ts#L1727) | K5 | 增大沿安全路线的恢复警戒上限；减小更快回普通找米。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeReplanMs`](../src/config/gameConfig.ts#L66) | `700` | ms；逃跑中允许重新选择路线的最短间隔：毫秒。 | [DeepSeekAIController:1520](../src/systems/DeepSeekAIController.ts#L1520) | K5 | 增大降低逃跑换路频率；减小更频繁评估。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeMinSeparation`](../src/config/gameConfig.ts#L67) | `3` | u；候选逃跑点与已知威胁点的优先安全间距：世界单位。 | [DeepSeekAIController:1479](../src/systems/DeepSeekAIController.ts#L1479) | K5 | 增大优先安全间距，也提高藏身退出安全要求；减小反向。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeMinTravel`](../src/config/gameConfig.ts#L68) | `2` | u；避免把当前位置选为逃跑目标：世界单位。 | [DeepSeekAIController:2535](../src/systems/DeepSeekAIController.ts#L2535) | K5 | 增大排除更多近处逃跑目的地；减小允许短距离转移。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeGoalTolerance`](../src/config/gameConfig.ts#L69) | `0.8` | u；到达逃跑房间中心的距离：世界单位。 | [DeepSeekAIController:1483](../src/systems/DeepSeekAIController.ts#L1483) | K5 | 增大更早视为到达逃跑目标；减小更接近中心。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeCoverBonus`](../src/config/gameConfig.ts#L70) | `4` | 分／权重；有墙或关门遮挡时的逃跑评分加分：无量纲。 | [DeepSeekAIController:2502](../src/systems/DeepSeekAIController.ts#L2502)；[DeepSeekHideCandidates:263](../src/systems/DeepSeekHideCandidates.ts#L263) | K5 | 增大更偏好有遮挡的候选；减小弱化遮挡奖励。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeDeadEndPenalty`](../src/config/gameConfig.ts#L71) | `6` | 分／权重；可用门出口不足两处时的评分扣分：无量纲。 | [DeepSeekAIController:2503](../src/systems/DeepSeekAIController.ts#L2503) | K5 | 增大更避开低出口数目的地；减小弱化惩罚。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeTravelPenalty`](../src/config/gameConfig.ts#L72) | `0.7` | 分/u；每世界单位路线长度的评分扣分。 | [DeepSeekAIController:2501](../src/systems/DeepSeekAIController.ts#L2501) | K5 | 增大更偏好短路线；减小允许更长路线。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeTowardThreatPenalty`](../src/config/gameConfig.ts#L73) | `3` | 分／权重；路径起步靠近威胁时的评分扣分：无量纲。 | [DeepSeekAIController:2504](../src/systems/DeepSeekAIController.ts#L2504)；[DeepSeekHideCandidates:265](../src/systems/DeepSeekHideCandidates.ts#L265) | K5 | 增大更排斥起步接近威胁的路线；减小弱化惩罚。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeGoalHoldMs`](../src/config/gameConfig.ts#L74) | `1500` | ms；通常至少保持当前逃跑目标的时间：毫秒；紧急危险或断路可提前切换。 | [DeepSeekAIController:2576](../src/systems/DeepSeekAIController.ts#L2576) | K5 | 增大更久保留当前逃跑目标；减小更容易换目标。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeSwitchScoreMargin`](../src/config/gameConfig.ts#L75) | `2.5` | 分／权重；新目的地评分需超过当前目标的最小差值，防止来回摆动。 | [DeepSeekAIController:2560](../src/systems/DeepSeekAIController.ts#L2560)；[DeepSeekHideCandidates:292](../src/systems/DeepSeekHideCandidates.ts#L292) | K5 | 增大需更明显评分优势才换目标；减小更易切换。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeVisitMemoryMs`](../src/config/gameConfig.ts#L76) | `12000` | ms；最近访问房间的记忆窗口：毫秒；超时后惩罚消失。 | [DeepSeekAIController:613](../src/systems/DeepSeekAIController.ts#L613)；[DeepSeekHideCandidates:200](../src/systems/DeepSeekHideCandidates.ts#L200) | K5 | 增大房间／藏身近期记忆衰减窗口；减小更快忘记。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeRecentVisitCount`](../src/config/gameConfig.ts#L77) | `4` | 次／个；最多保留的近期房间/区域记录数量。 | [DeepSeekAIController:2436](../src/systems/DeepSeekAIController.ts#L2436) | K5 | 增大保留更多近期房间记录；减小减少。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeRecentVisitPenalty`](../src/config/gameConfig.ts#L78) | `5` | 分／权重；刚访问过的房间每次最多扣除的逃跑评分，随时间衰减。 | [DeepSeekAIController:2448](../src/systems/DeepSeekAIController.ts#L2448) | K5 | 增大更排斥近期房间；减小更易重访。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeLoopMinDistanceGain`](../src/config/gameConfig.ts#L79) | `1` | u；重返近期区域时须增加的最小安全距离：世界单位。 | [DeepSeekAIController:2439](../src/systems/DeepSeekAIController.ts#L2439) | K5 | 增大要求重返近期区域有更多安全距离收益；减小宽松。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeNearScoreBand`](../src/config/gameConfig.ts#L80) | `0.8` | 分／权重；仅在最高分附近此范围内随机挑选候选房间。 | [DeepSeekAIController:2549](../src/systems/DeepSeekAIController.ts#L2549) | K5 | 增大随机候选评分带宽；减小更接近最高分选择。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.safeObservationMs`](../src/config/gameConfig.ts#L81) | `2500` | ms；缺少可用威胁方位时，结束逃跑前的连续观察时长：毫秒。 | [DeepSeekAIController:1481](../src/systems/DeepSeekAIController.ts#L1481) | K5 | 增大无方位时的连续安全观察要求；减小更快结束逃跑。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.soundCautionStrength`](../src/config/gameConfig.ts#L82) | `0.045` | 无量纲强度；高于此最终可听强度的弱声音仍阻止过早脱险。 | 无运行读取命中；已人工复核 | K5 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V7、V12 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.deepseekAI.dangerRiceAvoidMs`](../src/config/gameConfig.ts#L83) | `3000` | ms；逃跑后暂避位于危险路径上的原米堆：毫秒。 | [DeepSeekAIController:2398](../src/systems/DeepSeekAIController.ts#L2398) | K5 | 增大延长危险原米点暂避；减小更早返回。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.dangerRouteRadius`](../src/config/gameConfig.ts#L84) | `3` | u；最后已知 Human 位置附近的危险米堆/路径范围：世界单位。 | [DeepSeekAIController:851](../src/systems/DeepSeekAIController.ts#L851)；[DeepSeekHideCandidates:256](../src/systems/DeepSeekHideCandidates.ts#L256) | K5 | 增大排除更多靠近已知威胁的米点／路线；减小更冒险。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.safeWaitFailureThreshold`](../src/config/gameConfig.ts#L85) | `2` | 次／个；同一米堆与危险入口重复受阻后进入安全等待：次数。 | [DeepSeekAIController:861](../src/systems/DeepSeekAIController.ts#L861) | K5 | 增大容许更多重复受阻才安全等待；减小更早等待。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.safeWaitRecheckMs`](../src/config/gameConfig.ts#L86) | `2500` | ms；SAFE_WAIT 重新评估安全路线的间隔：毫秒。 | [DeepSeekAIController:887](../src/systems/DeepSeekAIController.ts#L887) | K5 | 增大等待中路线检查间隔；减小更快响应但查询更多。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeExtraExitBonus`](../src/config/gameConfig.ts#L87) | `1.2` | 分／权重；逃跑房间每个额外可用出口的评分奖励。 | [DeepSeekAIController:2507](../src/systems/DeepSeekAIController.ts#L2507) | K5 | 增大更偏好多出口候选；减小弱化出口奖励。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeAlternateRouteBonus`](../src/config/gameConfig.ts#L88) | `2` | 分／权重；被堵出口存在可行替代路线时的评分奖励。 | [DeepSeekAIController:2508](../src/systems/DeepSeekAIController.ts#L2508) | K5 | 增大更偏好具替代绕路的候选；减小弱化奖励。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeBlockedExitPenalty`](../src/config/gameConfig.ts#L89) | `9` | 分／权重；Human 接近首个路径出口且无替代路线时的评分扣分。 | [DeepSeekAIController:2506](../src/systems/DeepSeekAIController.ts#L2506) | K5 | 增大更排斥出口被堵且无替代的候选；减小反向。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.escapeRouteThreatPenalty`](../src/config/gameConfig.ts#L90) | `3` | 权重；路径节点靠近已知 Human 方位时每世界单位的评分扣分。 | [DeepSeekAIController:2505](../src/systems/DeepSeekAIController.ts#L2505)；[DeepSeekHideCandidates:264](../src/systems/DeepSeekHideCandidates.ts#L264) | K5 | 增大更排斥沿途靠近已知威胁的路线；减小允许靠近。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.exitBlockRadius`](../src/config/gameConfig.ts#L91) | `2.5` | u；估计 Human 占据路径出口的距离：世界单位。 | [DeepSeekAIController:2474](../src/systems/DeepSeekAIController.ts#L2474) | K5 | 增大更容易认为出口受威胁；减小需更靠近出口。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.alternateRouteMaxRatio`](../src/config/gameConfig.ts#L92) | `2` | 比例／倍率；绕开被堵出口的路线最多允许为原路线的倍数。 | [DeepSeekAIController:2481](../src/systems/DeepSeekAIController.ts#L2481) | K5 | 增大允许更长的安全替代绕行；减小更容易拒绝绕行。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.approachSprintDistance`](../src/config/gameConfig.ts#L93) | `6` | u；Human 明显逼近时允许提前冲刺的目视距离：世界单位。 | [DeepSeekAIController:1577](../src/systems/DeepSeekAIController.ts#L1577) | K5 | 增大可在更远距离逼近时冲刺；减小需更近。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.approachSpeedThreshold`](../src/config/gameConfig.ts#L94) | `0.35` | u/s；判定 Human 逼近的最小相对速度：世界单位/秒。 | [DeepSeekAIController:1576](../src/systems/DeepSeekAIController.ts#L1576) | K5 | 增大需更快的逼近才触发；减小更敏感。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.blockedExitSprintDistance`](../src/config/gameConfig.ts#L95) | `3.5` | u；已知 Human 靠近路径出口时的紧急冲刺距离：世界单位。 | [DeepSeekAIController:1580](../src/systems/DeepSeekAIController.ts#L1580) | K5 | 增大出口紧急冲刺触发距离；减小需更近。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.safeSprintDistance`](../src/config/gameConfig.ts#L96) | `5` | u；低于30%进度时，近距威胁触发冲刺：世界单位。 | [DeepSeekAIController:1582](../src/systems/DeepSeekAIController.ts#L1582) | K5 | 增大低风险时更早冲刺；减小更晚。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.riskySprintDistance`](../src/config/gameConfig.ts#L97) | `2.2` | u；达到30%进度后，仅极近目视威胁可冲刺：世界单位。 | [DeepSeekAIController:1535](../src/systems/DeepSeekAIController.ts#L1535) | K5 | 增大高进度时也更早冒摔倒风险冲刺；减小更保守。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.sprintSoundStrength`](../src/config/gameConfig.ts#L98) | `0.22` | 无量纲强度；未目视时触发安全冲刺的声音最终强度阈值。 | [DeepSeekAIController:1584](../src/systems/DeepSeekAIController.ts#L1584) | K5 | 增大需更强声音触发安全冲刺；减小更敏感。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityStillMs`](../src/config/gameConfig.ts#L99) | `5000` | ms；Human 实际连续静止后的一次试探判定：毫秒；触发时仍需目视。 | [DeepSeekAIController:803](../src/systems/DeepSeekAIController.ts#L803) | K6 | 增大需 Human 静止更久才试探；减小更快合格。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityChance`](../src/config/gameConfig.ts#L100) | `0.1` | 概率[0,1]；每次合格静止事件只抽一次的触发概率。 | [DeepSeekAIController:1268](../src/systems/DeepSeekAIController.ts#L1268) | K6 | 增大合格静止事件的试探概率；减小降低；每事件只抽一次。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityMovementEpsilon`](../src/config/gameConfig.ts#L101) | `0.05` | u；Human 相对静止锚点的实际位移容差：世界单位；与目视无关。 | [HumanStillness:16](../src/systems/HumanStillness.ts#L16) | K6 | 增大容许更多微动仍算静止；减小更严格。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiositySafeDistance`](../src/config/gameConfig.ts#L102) | `2` | u；试探与绕行路径距目视 Human 的最小安全间距：世界单位。 | [DeepSeekAIController:690](../src/systems/DeepSeekAIController.ts#L690)；[ThreeGame:3157](../src/three/ThreeGame.ts#L3157) | K6 | 增大试探／通行的安全间距要求；减小更靠近。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityObserveMs`](../src/config/gameConfig.ts#L103) | `1800` | ms；到达安全观察点后的观察时间：毫秒。 | [DeepSeekAIController:1153](../src/systems/DeepSeekAIController.ts#L1153)；[ThreeGame:1341](../src/three/ThreeGame.ts#L1341) | K6 | 增大到观察点后的停留；减小更快离开。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityCooldownMs`](../src/config/gameConfig.ts#L104) | `12000` | ms；一次试探结束或被打断后的冷却：毫秒。 | [DeepSeekAIController:1251](../src/systems/DeepSeekAIController.ts#L1251) | K6 | 增大结束／中断后的试探冷却；减小更频繁。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.curiosityApproachTolerance`](../src/config/gameConfig.ts#L105) | `0.5` | u；到达观察点的容差：世界单位。 | [DeepSeekAIController:1099](../src/systems/DeepSeekAIController.ts#L1099) | K6 | 增大更早视为到观察点；减小更精确。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stationaryPassageChance`](../src/config/gameConfig.ts#L106) | `1` | 概率[0,1]；可见 Human 静止并挡住米路线时，每次静止事件必触发一次安全通行尝试。 | [DeepSeekAIController:1080](../src/systems/DeepSeekAIController.ts#L1080) | K6 | 增大静止挡路事件的安全通行尝试概率；减小降低，当前已是 1。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stationaryPassageSafetyMargin`](../src/config/gameConfig.ts#L107) | `0.2` | u；抓捕圈外的动态绕行安全余量：世界单位。 | [DeepSeekAIController:830](../src/systems/DeepSeekAIController.ts#L830)；[AISafetyPathView:31](../src/three/AISafetyPathView.ts#L31) | K6 | 增大抓捕圈外的绕行余量；减小可更近但风险提高。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stationaryPassageBlockRadius`](../src/config/gameConfig.ts#L108) | `1.5` | u；判断静止 Human 是否挡住米路线的距离：世界单位。 | [DeepSeekAIController:1061](../src/systems/DeepSeekAIController.ts#L1061) | K6 | 增大更易识别静止 Human 挡路线；减小识别范围收窄。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stationaryPassageObserveDistance`](../src/config/gameConfig.ts#L109) | `2` | u；安全通行前选择观察点的期望距离：世界单位。 | [DeepSeekAIController:1101](../src/systems/DeepSeekAIController.ts#L1101) | K6 | 增大通行前观察点的期望间距；减小靠近，仍受安全几何约束。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.stationaryPassageCheckIntervalMs`](../src/config/gameConfig.ts#L110) | `500` | ms；静止挡路条件的再次检查间隔：毫秒，避免逐帧 A*。 | [DeepSeekAIController:1041](../src/systems/DeepSeekAIController.ts#L1041) | K6 | 增大挡路复查间隔；减小更频繁查询。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.doorEscapeMinHumanDistance`](../src/config/gameConfig.ts#L111) | `1.5` | u；EVADE 关门时与当前可见 Human 的最低距离：世界单位；大于实际抓捕圈。 | [DeepSeekAIController:2100](../src/systems/DeepSeekAIController.ts#L2100) | K4 | 增大考虑关门所需最低目视间距；减小允许更近关门。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.doorEscapeCrossingWindowMs`](../src/config/gameConfig.ts#L112) | `1800` | ms；实际穿过门后允许考虑关门的时间：毫秒；不返回远门。 | [DeepSeekAIController:606](../src/systems/DeepSeekAIController.ts#L606)；[ThreeGame:2988](../src/three/ThreeGame.ts#L2988) | K4 | 增大穿门后可考虑关门的窗口；减小更快失效。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.doorEscapeCooldownMs`](../src/config/gameConfig.ts#L113) | `20000` | ms；同一扇门再次考虑关门的冷却：毫秒；避免 Human 开门后原地振荡。 | [DeepSeekAIController:2089](../src/systems/DeepSeekAIController.ts#L2089) | K4 | 增大同门再次处理冷却；减小更频繁关门。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.humanPlayerUnlockPenaltyMs`](../src/config/gameConfig.ts#L114) | `10000` | ms；Human 玩家解除 DeepSeek AI 的锁后，DeepSeek AI 全局禁止再次锁门的惩罚冷却：毫秒。 | [ThreeGame:173](../src/three/ThreeGame.ts#L173) | K4 | 增大被 Human 玩家解锁后的全局禁锁期；减小更早可锁。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideThreatDistance`](../src/config/gameConfig.ts#L118) | `3.5` | u；已知威胁点距离小于此值时才考虑藏身：世界单位。 | [DeepSeekAIController:1787](../src/systems/DeepSeekAIController.ts#L1787) | K7 | 增大允许更远威胁时评估藏身；减小仅更近时评估，仍需路线与合法性。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideMinConcealMs`](../src/config/gameConfig.ts#L119) | `2500` | ms；最短藏身时长，防「一进就出」：毫秒。 | [DeepSeekAIController:1981](../src/systems/DeepSeekAIController.ts#L1981) | K7 | 增大最短藏身时间；减小更早可退出但可能振荡。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideRecheckMs`](../src/config/gameConfig.ts#L120) | `500` | ms；藏身中重新评估退出条件的间隔：毫秒；避免逐帧 A*。 | [DeepSeekAIController:370](../src/systems/DeepSeekAIController.ts#L370) | K7 | 增大藏身／出口被堵后复查间隔；减小更快响应。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideReenterCooldownMs`](../src/config/gameConfig.ts#L121) | `8000` | ms；同一点退出后再次进入的冷却：毫秒。 | [DeepSeekAIController:387](../src/systems/DeepSeekAIController.ts#L387) | K7 | 增大同点重进冷却；减小更早可重进。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideCandidateFailCooldownMs`](../src/config/gameConfig.ts#L122) | `6000` | ms；走位失败 / 进入被拒后该点的冷却：毫秒。 | [DeepSeekAIController:412](../src/systems/DeepSeekAIController.ts#L412) | K7 | 增大候选失败后冷却；减小更早重试。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideRecentSpotCount`](../src/config/gameConfig.ts#L123) | `3` | 次／个；近期藏身点记忆条数：个（防两点之间往返）。 | [DeepSeekAIController:1652](../src/systems/DeepSeekAIController.ts#L1652) | K7 | 增大记住更多近期藏身点；减小减少。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideRecentSpotPenalty`](../src/config/gameConfig.ts#L124) | `5` | 分／权重；每个近期藏身点扣减的候选评分：无量纲，随时间衰减。 | [DeepSeekHideCandidates:200](../src/systems/DeepSeekHideCandidates.ts#L200) | K7 | 增大更排斥近期藏身点；减小更易重复。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideMaxConsecutive`](../src/config/gameConfig.ts#L125) | `2` | 次／个；连续藏身次数上限：次；有一次真实米进度增长后重置。 | [DeepSeekAIController:1791](../src/systems/DeepSeekAIController.ts#L1791)；[ThreeGame:3081](../src/three/ThreeGame.ts#L3081) | K7 | 增大允许更多连续藏身；减小限制更多，0 会禁用该能力。 | V7、V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.deepseekAI.hideMaxConcealMs`](../src/config/gameConfig.ts#L126) | `0` | ms；可选最大藏身时长：毫秒；0 = 不限制（兜底是可藏的前提与连续上限）。 | [DeepSeekAIController:2011](../src/systems/DeepSeekAIController.ts#L2011) | K7 | 0 为不限；改为正数增加最长时长兜底，但仍要求安全出口和可达米点。 | V7、V12 | 否；有效玩法参数 |

### 动作纯表现（6 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.characterAnimation.fallPoseMs`](../src/config/gameConfig.ts#L129) | `220` | ms；毫秒；摔倒占位姿态显示时间，不改变眩晕时长。 | [CharacterActionView:94](../src/three/CharacterActionView.ts#L94) | K15 | 增大延长对应动画／反馈时间；减小缩短，不改玩法时钟。 | V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.characterAnimation.transitionMs`](../src/config/gameConfig.ts#L130) | `120` | ms；动作交叉淡入时间，现用于 CharacterActionView／Mixer。 | [CharacterActionView:59](../src/three/CharacterActionView.ts#L59) | K15 | 增大延长对应动画／反馈时间；减小缩短，不改玩法时钟。 | V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.characterAnimation.specialIdleTriggerMs`](../src/config/gameConfig.ts#L131) | `5000` | ms；连续普通 IDLE 后尝试播放特殊待机的时间：毫秒。 | [CharacterActionView:208](../src/three/CharacterActionView.ts#L208) | K15 | 增大延长对应动画／反馈时间；减小缩短，不改玩法时钟。 | V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.characterAnimation.specialIdleRepeatIntervalMs`](../src/config/gameConfig.ts#L132) | `15000` | ms；特殊待机两次开始之间的最短间隔：毫秒。 | [CharacterActionView:207](../src/three/CharacterActionView.ts#L207) | K15 | 增大延长对应动画／反馈时间；减小缩短，不改玩法时钟。 | V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.characterAnimation.specialIdleSlots`](../src/config/gameConfig.ts#L133) | `["IDLE_01","IDLE_02","IDLE_03","IDLE_04","IDLE_05"]` | 片段名数组；允许接入的特殊待机插槽；缺失片段会被忽略。 | [CharacterActionView:79](../src/three/CharacterActionView.ts#L79) | K15 | 只选择已存在的动作片段；更改名单不生成新动画。 | V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.characterAnimation.stunColor`](../src/config/gameConfig.ts#L134) | `0xff7777` | RGB色值；白模摔倒/眩晕颜色；仅视觉表现。 | [CharacterActionView:163](../src/three/CharacterActionView.ts#L163) | K15 | 改变对应表现颜色，色值大小不代表难度升降。 | V15 | 否；表现／非日常平衡 |

### 冲刺（5 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.sprint.speedMultiplier`](../src/config/gameConfig.ts#L137) | `1.6` | 比例／倍率；相对 DeepSeek 基础速度的倍率。 | [ThreeGame:1145](../src/three/ThreeGame.ts#L1145) | K3 | 增大提高 DeepSeek 冲刺速度；减小降低，关联分步碰撞。 | V1、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.sprint.durationMs`](../src/config/gameConfig.ts#L138) | `2500` | ms；冲刺持续时间：毫秒。 | [DevBRuntimeBinding:73](../src/systems/DevBRuntimeBinding.ts#L73)；[ThreeGame:121](../src/three/ThreeGame.ts#L121) | K3 | 增大冲刺走得更久、更远；减小缩短；高风险摔倒发生在结束时。 | V1、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.sprint.riskThreshold`](../src/config/gameConfig.ts#L139) | `0.3` | 进度比例[0,1]；全局大米进度比例，达到后冲刺结束必摔。 | [DeepSeekAIController:1574](../src/systems/DeepSeekAIController.ts#L1574)；[ThreeGame:121](../src/three/ThreeGame.ts#L121) | K3 | 增大推迟必摔进度门槛；减小提前，影响玩家及 AI 风险选择。 | V1、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.sprint.stunMs`](../src/config/gameConfig.ts#L140) | `1000` | ms；摔倒后的眩晕时间：毫秒。 | [ThreeGame:121](../src/three/ThreeGame.ts#L121) | K3 | 增大摔倒不能行动更久；减小更快恢复；不是 FALL 动画时长。 | V1、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.sprint.cooldownMs`](../src/config/gameConfig.ts#L141) | `30000` | ms；冲刺技能冷却：毫秒；冲刺一开始即进入冷却，期间不能再次冲刺。 | [DevBRuntimeBinding:74](../src/systems/DevBRuntimeBinding.ts#L74)；[ThreeGame:122](../src/three/ThreeGame.ts#L122) | K3 | 增大两次冲刺的最短间隔；减小更频繁；起步即计时。 | V1、V7 | 否；有效玩法参数 |

### 单位与场景（5 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.three.pixelsPerUnit`](../src/config/gameConfig.ts#L144) | `60` | px/u；像素速度／尺寸／米交互范围到 XZ 世界单位的换算。 | [DeepSeekAIController:317](../src/systems/DeepSeekAIController.ts#L317)；[HumanAIController:928](../src/systems/HumanAIController.ts#L928)；[MatchRandom:67](../src/systems/MatchRandom.ts#L67)；[apartmentMap:59](../src/three/map/apartmentMap.ts#L59)；[ThreeGame:92](../src/three/ThreeGame.ts#L92) | K1 | 增大使像素速度／尺寸／交互范围换算到世界后变小；减小反向；广泛耦合。 | V11、V2、V9 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.three.viewHeight`](../src/config/gameConfig.ts#L145) | `14` | u；等距相机基础视域高度，另乘 HOME_COMPOSITION.playViewScale／DEV zoom。 | [ThreeGame:623](../src/three/ThreeGame.ts#L623) | K1 | 增大相机覆盖范围、画面中物体更小；减小视野收窄、物体更大。 | V11、V2、V9 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.three.actorHeight`](../src/config/gameConfig.ts#L146) | `0.7` | u；代理高度与角色碰撞／站立判断高度。 | [MatchRandom:58](../src/systems/MatchRandom.ts#L58)；[NavigationSystem:43](../src/systems/NavigationSystem.ts#L43)；[HideInteractionRegion:170](../src/three/map/HideInteractionRegion.ts#L170)；[MapApplicationPrecheck:57](../src/three/map/MapApplicationPrecheck.ts#L57)；[MapEditModel:476](../src/three/map/MapEditModel.ts#L476)；[ThreeGame:308](../src/three/ThreeGame.ts#L308) | K1 | 增大影响角色碰撞高度、合法站立和占位高度；减小反向；不等于 v6 外观缩放。 | V11、V2、V9 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.three.wallHeight`](../src/config/gameConfig.ts#L147) | `1.5` | u；配置镜像；地图墙体实际取 apartmentMap.WALL_HEIGHT=1.5，测试核对相等。 | 无运行读取；apartment-map 等测试读取镜像值 | K1 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V11、V2、V9 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.three.boundaryHeight`](../src/config/gameConfig.ts#L148) | `0.5` | u；旧边界显示高度，未发现运行读取。 | 无运行读取命中；已人工复核 | K1 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V11、V2、V9 | 否；未见运行读取（保留） |

### 碰撞技术（3 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.collision.playerRadius`](../src/config/gameConfig.ts#L153) | `0.23` | u；角色逻辑碰撞圆半径：世界单位。 | [DevBRuntimeBinding:75](../src/systems/DevBRuntimeBinding.ts#L75)；[MatchRandom:57](../src/systems/MatchRandom.ts#L57)；[NavigationSystem:43](../src/systems/NavigationSystem.ts#L43)；[HideInteractionRegion:170](../src/three/map/HideInteractionRegion.ts#L170)；[MapApplicationPrecheck:56](../src/three/map/MapApplicationPrecheck.ts#L56)；[MapEditModel:476](../src/three/map/MapEditModel.ts#L476)；[ThreeGame:870](../src/three/ThreeGame.ts#L870) | K1 | 增大缩窄可通过门缝与路线；减小更易穿行；不是抓捕半径。 | V11、V2、V9 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.collision.contactEpsilon`](../src/config/gameConfig.ts#L154) | `0.0001` | u；角色接触数值容差，避免贴面抖动。 | [DeepSeekAIController:1222](../src/systems/DeepSeekAIController.ts#L1222)；[HumanAIController:706](../src/systems/HumanAIController.ts#L706)；[CollisionWorld:82](../src/three/CollisionWorld.ts#L82)；[ThreeGame:1330](../src/three/ThreeGame.ts#L1330) | K1 | 增大缩小有效接触半径／放宽数值边界；减小更严格；需碰撞验证。 | V11、V2、V9 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.collision.maxMovementSubstep`](../src/config/gameConfig.ts#L155) | `0.12` | u；角色单次移动检测的细分步长上限。 | [DeepSeekAIController:1314](../src/systems/DeepSeekAIController.ts#L1314)；[NavigationSystem:207](../src/systems/NavigationSystem.ts#L207)；[CollisionWorld:106](../src/three/CollisionWorld.ts#L106) | K1 | 增大减少细分，可能跳过窄障碍；减小增加检测；不直接加速角色。 | V11、V2、V9 | 否；技术／几何，谨慎调 |

### 阶段与抓捕（4 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.match.maxFrameDeltaMs`](../src/config/gameConfig.ts#L159) | `50` | ms；单帧规则推进上限，毫秒；避免切回标签页时计时跳跃。 | [ThreeGame:631](../src/three/ThreeGame.ts#L631) | K14 | 增大卡帧时一次可推进更多玩法时间；减小更易减慢低帧率下的逻辑时间。 | V1、V2 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.match.readyMs`](../src/config/gameConfig.ts#L160) | `3000` | ms；选阵营后的准备时间：毫秒。 | [DevBRuntimeBinding:68](../src/systems/DevBRuntimeBinding.ts#L68)；[ThreeGame:119](../src/three/ThreeGame.ts#L119) | K14 | 增大延长准备倒计时；减小更快开局。 | V1、V2 | 否；有效玩法参数 |
| [`GAME_CONFIG.match.captureRadius`](../src/config/gameConfig.ts#L162) | `0.7` | u；抓捕圈半径：XZ 世界单位，独立于角色视觉方块。 | [DeepSeekAIController:321](../src/systems/DeepSeekAIController.ts#L321)；[DevBHelpText:46](../src/systems/DevBHelpText.ts#L46)；[DevBRuntimeBinding:66](../src/systems/DevBRuntimeBinding.ts#L66)；[RuntimeDebugOverrides:53](../src/systems/RuntimeDebugOverrides.ts#L53)；[AISafetyPathView:15](../src/three/AISafetyPathView.ts#L15) | K14 | 增大增强普通抓捕与有关安全规划；减小需更近；DEV 改动清空旧累计。 | V1、V2 | 是：`capture.radius`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.match.captureMs`](../src/config/gameConfig.ts#L164) | `350` | ms；连续有效接触时间：毫秒。 | [DevBRuntimeBinding:67](../src/systems/DevBRuntimeBinding.ts#L67)；[ThreeGame:119](../src/three/ThreeGame.ts#L119) | K14 | 增大延长连续有效接触要求；减小更快普通抓捕；不改变 Q 立即命中。 | V1、V2 | 否；有效玩法参数 |

### 对局随机化（3 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.matchRandom.minSpawnDistance`](../src/config/gameConfig.ts#L167) | `10` | u；双方出生最小直线间距：XZ 世界单位。 | [MatchRandom:94](../src/systems/MatchRandom.ts#L94) | K13 | 增大要求出生更远，可能增加重抽；减小更近；还须不同区域与可达。 | V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.matchRandom.doorOpenChance`](../src/config/gameConfig.ts#L168) | `0.5` | 概率[0,1]；每扇门初始为 OPEN 的独立概率：0～1；其余为 CLOSED。 | [MatchRandom:135](../src/systems/MatchRandom.ts#L135) | K13 | 增大初始开门概率；减小增加关门；不改变门坐标。 | V12 | 否；有效玩法参数 |
| [`GAME_CONFIG.matchRandom.maxAttempts`](../src/config/gameConfig.ts#L169) | `20` | 次／个；无效布局的最多重抽次数；之后验证并使用安全回退。 | [MatchRandom:128](../src/systems/MatchRandom.ts#L128)；[ThreeGame:2471](../src/three/ThreeGame.ts#L2471) | K13 | 增大允许更多布局尝试；减小更早安全回退；是生成预算。 | V12 | 否；技术／几何，谨慎调 |

### Human Q 搜查（3 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.humanSearch.range`](../src/config/gameConfig.ts#L174) | `1.5` | u；扇形半径：世界单位。 | [HumanHideSearchStance:100](../src/systems/HumanHideSearchStance.ts#L100)；[HumanSearchSkill:64](../src/systems/HumanSearchSkill.ts#L64)；[HideSearchView:98](../src/three/HideSearchView.ts#L98)；[ThreeGame:1971](../src/three/ThreeGame.ts#L1971) | K7 | 增大扩展普通 Q／AI 公开搜查几何半径；减小收窄；家具唯一指向分支另走区域。 | V8、V6 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanSearch.halfAngleDeg`](../src/config/gameConfig.ts#L176) | `60` | °/侧；扇形半角：度（每侧）；整体张角 = 2 × 该值 = 120°。 | [HideSearchCandidates:242](../src/systems/HideSearchCandidates.ts#L242)；[HumanHideSearchStance:101](../src/systems/HumanHideSearchStance.ts#L101)；[HumanSearchSkill:65](../src/systems/HumanSearchSkill.ts#L65)；[HideSearchView:99](../src/three/HideSearchView.ts#L99)；[ThreeGame:1787](../src/three/ThreeGame.ts#L1787) | K7 | 增大扩展普通扇形与家具指向容差；减小更严格；整体张角为两倍。 | V8、V6 | 否；有效玩法参数 |
| [`GAME_CONFIG.humanSearch.cooldownMs`](../src/config/gameConfig.ts#L178) | `12000` | ms；每次有效释放后的冷却：毫秒；未命中也消耗。 | [ThreeGame:180](../src/three/ThreeGame.ts#L180) | K7 | 增大 Human 玩家 Q 冷却；减小更频繁；有效空挥也消耗。 | V8、V6 | 否；有效玩法参数 |

### 门与锁（14 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.door.interactionRange`](../src/config/gameConfig.ts#L182) | `1.3` | u；门交互距离及门段端点内缩量：XZ 世界单位。 | [DeepSeekAIController:2037](../src/systems/DeepSeekAIController.ts#L2037)；[HumanAIController:823](../src/systems/HumanAIController.ts#L823)；[ThreeGame:1022](../src/three/ThreeGame.ts#L1022) | K4 | 增大门操作及 AI 接近门阈值；减小需更近；仍受墙门几何限制。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.door.interactionEndInset`](../src/config/gameConfig.ts#L183) | `0.08` | u；门段两端操作测距的内缩量。 | [DoorSystem:153](../src/systems/DoorSystem.ts#L153) | K4 | 增大门段端点内缩，改变侧边操作测距；减小更接近端点，不宜超过半门宽。 | V4、V11 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.door.maxActiveLocks`](../src/config/gameConfig.ts#L184) | `3` | 个；同时有效锁位上限。 | [ThreeGame:132](../src/three/ThreeGame.ts#L132) | K4 | 增大同时有效锁位；减小收紧；不是整局锁门次数。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.door.humanFreeOpenClosedDoor`](../src/config/gameConfig.ts#L186) | `true` | 开关；Human 对普通 CLOSED 门按 Space 免费快速打开。 | [HumanDoorSkill:22](../src/systems/HumanDoorSkill.ts#L22) | K4 | true 开启 Human Space 免费开普通门；false 关闭该行为，E 不变。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.door.humanForceBreakCooldownMs`](../src/config/gameConfig.ts#L188) | `30000` | ms；仅强破 LOCKED 门触发的冷却：毫秒。 | [ThreeGame:134](../src/three/ThreeGame.ts#L134) | K4 | 增大 Human 强破锁门冷却；减小更频繁；普通快速开门不消耗。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.door.playerLockCooldownMs`](../src/config/gameConfig.ts#L191) | `20000` | ms；S7C-1B：DeepSeek 玩家 Q 主动锁门的冷却：毫秒；只有锁门成功才开始计时， 失败（状态不允许、超距、锁位已满、锁芯失效）不消耗冷却。 | [ThreeGame:181](../src/three/ThreeGame.ts#L181) | K4 | 增大 DeepSeek 玩家成功 Q 锁门后的冷却；减小更频繁；AI 另有禁锁期。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.door.leafHeight`](../src/config/gameConfig.ts#L192) | `1.2` | u；闭门逻辑碰撞盒高度；可见高度来自 HOME_COMPOSITION。 | [DoorView:97](../src/three/DoorView.ts#L97) | K4 | 增大闭门逻辑碰撞高度；减小可能低于角色；不改正式可见门叶高度。 | V4、V11 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.door.leafThickness`](../src/config/gameConfig.ts#L193) | `0.16` | u；逻辑门叶厚度，碰撞、导航、遮挡与视觉共读。 | [DeepSeekAIController:2032](../src/systems/DeepSeekAIController.ts#L2032)；[MatchRandom:65](../src/systems/MatchRandom.ts#L65)；[NavigationSystem:228](../src/systems/NavigationSystem.ts#L228)；[PerceptionSystem:87](../src/systems/PerceptionSystem.ts#L87)；[DoorView:20](../src/three/DoorView.ts#L20)；[MapBuilder:222](../src/three/map/MapBuilder.ts#L222)；[MapEditModel:246](../src/three/map/MapEditModel.ts#L246)；[ThreeGame:2271](../src/three/ThreeGame.ts#L2271) | K4 | 增大门逻辑碰撞／遮挡厚度，并间接改变视觉门厚；减小反向。 | V4、V11 | 否；技术／几何，谨慎调 |
| [`GAME_CONFIG.door.openAngle`](../src/config/gameConfig.ts#L194) | `Math.PI / 2` ≈ 1.570796 | rad；OPEN 门叶的可见旋转角，非半开门碰撞规则。 | [DoorView:63](../src/three/DoorView.ts#L63) | K4 | 增大／减小改变 OPEN 门叶显示转角；OPEN 逻辑仍按无闭门障碍处理，非自由平衡旋钮。 | V4、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.door.colors.open`](../src/config/gameConfig.ts#L196) | `0x6d8f73` | RGB色值；旧 OPEN 门色，住宅 sync 使用独立木色。 | 无运行读取命中；已人工复核 | K4 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.door.colors.closed`](../src/config/gameConfig.ts#L197) | `0x8a644b` | RGB色值；构造初始门色，后续 sync 被住宅木色覆盖。 | [DoorView:28](../src/three/DoorView.ts#L28) | K4 | 只改变构造初始色，正常 sync 后仍被住宅木色覆盖。 | V4、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.door.colors.locked`](../src/config/gameConfig.ts#L198) | `0xa0443f` | RGB色值；旧 LOCKED 门色，住宅 sync 使用独立木色。 | 无运行读取命中；已人工复核 | K4 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.door.colors.lockCore`](../src/config/gameConfig.ts#L199) | `0xffc247` | RGB色值；有效锁芯颜色／自发光色。 | [DoorView:43](../src/three/DoorView.ts#L43) | K4 | 改变对应表现颜色，色值大小不代表难度升降。 | V4、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.door.colors.lockCoreDisabled`](../src/config/gameConfig.ts#L200) | `0x565d63` | RGB色值；失效锁芯颜色。 | [DoorView:70](../src/three/DoorView.ts#L70) | K4 | 改变对应表现颜色，色值大小不代表难度升降。 | V4、V11 | 否；表现／非日常平衡 |

### 历史扫雷参数（5 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.pulseLock.rows`](../src/config/gameConfig.ts#L205) | `4` | 个；扫雷行数。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.pulseLock.cols`](../src/config/gameConfig.ts#L206) | `4` | 个；扫雷列数。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.pulseLock.mines`](../src/config/gameConfig.ts#L207) | `3` | 个；地雷数量，必须小于总格数。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.pulseLock.firstRevealSafe`](../src/config/gameConfig.ts#L209) | `true` | 开关；扫雷第一次揭格保证安全。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.pulseLock.failureFeedbackMs`](../src/config/gameConfig.ts#L210) | `1500` | ms；旧扫雷失败提示时长，当前时机玩法不使用。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | V4、V11 | 否；未见运行读取（保留） |

### PulseLock 时机玩法（5 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.pulseLock.timing.coreCount`](../src/config/gameConfig.ts#L213) | `3` | 次／个；每扇锁门依次完成的锁芯数量。 | [ThreeGame:135](../src/three/ThreeGame.ts#L135)；[PulseLockSystem:47](../src/systems/PulseLockSystem.ts#L47)；[PulseLockView:27](../src/three/PulseLockView.ts#L27) | K9 | 当前只允许 3；改为其他值会被构造校验拒绝。 | V4、V11 | 否；固定结构约束 |
| [`GAME_CONFIG.pulseLock.timing.travelMs`](../src/config/gameConfig.ts#L214) | `1400` | ms；脉冲从轨道一端走到另一端的毫秒数。 | [ThreeGame:135](../src/three/ThreeGame.ts#L135)；[PulseLockSystem:76](../src/systems/PulseLockSystem.ts#L76) | K9 | 增大光点移动更慢且成功窗口时间更长；减小更难抓时机。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.pulseLock.timing.targetWidth`](../src/config/gameConfig.ts#L215) | `0.2` | 归一化比例；成功区域占轨道长度的比例。 | [ThreeGame:135](../src/three/ThreeGame.ts#L135)；[PulseLockSystem:94](../src/systems/PulseLockSystem.ts#L94)；[PulseLockView:14](../src/three/PulseLockView.ts#L14) | K9 | 增大成功区域更宽；减小更窄；必须在 (0,1) 且不越轨道。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.pulseLock.timing.targetCenters`](../src/config/gameConfig.ts#L216) | `[0.48,0.56,0.43]` | [0,1]位置数组；三个锁芯成功区域的归一化中心。 | [ThreeGame:135](../src/three/ThreeGame.ts#L135)；[PulseLockSystem:93](../src/systems/PulseLockSystem.ts#L93)；[PulseLockView:13](../src/three/PulseLockView.ts#L13) | K9 | 改变各锁芯成功区域位置，不可用单一增减判断难度；长度必须为 3。 | V4、V11 | 否；有效玩法参数 |
| [`GAME_CONFIG.pulseLock.timing.feedbackMs`](../src/config/gameConfig.ts#L217) | `240` | ms；命中或失手反馈持续时间，毫秒。 | [ThreeGame:135](../src/three/ThreeGame.ts#L135)；[PulseLockSystem:98](../src/systems/PulseLockSystem.ts#L98) | K9 | 增大反馈停留更久；减小更短；只显示反馈，不作为 AI 解锁时长。 | V4、V11 | 否；表现／非日常平衡 |

### 已停用声音表现（11 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.perception.soundVisual.radius`](../src/config/gameConfig.ts#L223) | `18` | u；停用玩家声音圈的显示半径，不是 AI 听觉范围。 | [SoundVisualView:61](../src/three/SoundVisualView.ts#L61) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.nearMax`](../src/config/gameConfig.ts#L223) | `2.5` | u；停用声音波纹的近距分带阈值。 | [SoundVisualView:61](../src/three/SoundVisualView.ts#L61) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.midMax`](../src/config/gameConfig.ts#L223) | `6.5` | u；停用声音波纹的中距分带阈值。 | [SoundVisualView:61](../src/three/SoundVisualView.ts#L61) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.bandHysteresis`](../src/config/gameConfig.ts#L223) | `0.3` | u；停用声音分带切换的距离缓冲。 | [SoundVisualView:61](../src/three/SoundVisualView.ts#L61) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.colors.far`](../src/config/gameConfig.ts#L224) | `0x54aaff` | RGB色值；已停用声音表现的分带颜色。 | [SoundVisualView:9](../src/three/SoundVisualView.ts#L9) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.colors.mid`](../src/config/gameConfig.ts#L224) | `0xffd45f` | RGB色值；已停用声音表现的分带颜色。 | [SoundVisualView:10](../src/three/SoundVisualView.ts#L10) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.colors.near`](../src/config/gameConfig.ts#L224) | `0xff635b` | RGB色值；已停用声音表现的分带颜色。 | [SoundVisualView:11](../src/three/SoundVisualView.ts#L11) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.waveFullStrength`](../src/config/gameConfig.ts#L226) | `0.45` | 无量纲强度；停用波纹亮度达到满值的强度。 | [SoundVisualView:151](../src/three/SoundVisualView.ts#L151) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.waveFadeMs`](../src/config/gameConfig.ts#L227) | `420` | ms；停用波纹结束淡出时长。 | [SoundVisualView:149](../src/three/SoundVisualView.ts#L149) | K12 | 当前对局无显示变化；不得为调参恢复声音圈。 | sound-visual.test.mjs（停用契约）；V9 | 否；表现层已停用（保留） |
| [`GAME_CONFIG.perception.soundVisual.hudMidStrength`](../src/config/gameConfig.ts#L228) | `0.25` | 无量纲强度；未接线的旧 HUD 中强度颜色门槛。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | sound-visual.test.mjs（停用契约）；V9 | 否；未见运行读取（保留） |
| [`GAME_CONFIG.perception.soundVisual.hudHighStrength`](../src/config/gameConfig.ts#L229) | `0.55` | 无量纲强度；未接线的旧 HUD 高强度颜色门槛。 | 无运行读取命中；已人工复核 | K12 | 无已证实的运行效果；不按过时注释推断，也不接回／删除。 | sound-visual.test.mjs（停用契约）；V9 | 否；未见运行读取（保留） |

### 感知与发声（12 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.perception.visionRange`](../src/config/gameConfig.ts#L231) | `11` | u；无遮挡视觉检测最大距离。 | [DeepSeekAIController:325](../src/systems/DeepSeekAIController.ts#L325)；[DevBHelpText:52](../src/systems/DevBHelpText.ts#L52)；[DevBRuntimeBinding:69](../src/systems/DevBRuntimeBinding.ts#L69)；[HumanAIController:1098](../src/systems/HumanAIController.ts#L1098)；[PerceptionSystem:314](../src/systems/PerceptionSystem.ts#L314)；[RuntimeDebugOverrides:58](../src/systems/RuntimeDebugOverrides.ts#L58) | K10 | 增大无遮挡视觉检测范围；减小收窄；同时影响公开线索可见性。 | V5、V2、V7 | 是：`vision.range`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.lastSeenMs`](../src/config/gameConfig.ts#L232) | `8000` | ms；最后目击快照的寿命。 | [DeepSeekAIController:810](../src/systems/DeepSeekAIController.ts#L810)；[HumanAIController:530](../src/systems/HumanAIController.ts#L530)；[PerceptionSystem:332](../src/systems/PerceptionSystem.ts#L332)；[ThreeGame:3432](../src/three/ThreeGame.ts#L3432) | K10 | 增大最后目击记忆寿命；减小更快忘记；不提供实时隐藏位置。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.footstepIntervalMs`](../src/config/gameConfig.ts#L248) | `650` | ms；普通移动 AI 声音事件最小间隔。 | [ThreeGame:2700](../src/three/ThreeGame.ts#L2700) | K10 | 增大普通移动 AI 声音事件间隔；减小更密；不会恢复 Ogg 脚步声。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.sprintStepIntervalMs`](../src/config/gameConfig.ts#L249) | `330` | ms；冲刺移动 AI 声音事件最小间隔。 | [ThreeGame:2700](../src/three/ThreeGame.ts#L2700) | K10 | 增大冲刺 AI 声音事件间隔；减小更密；不会恢复 Ogg 冲刺声。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.riceSoundIntervalMs`](../src/config/gameConfig.ts#L250) | `1200` | ms；进食 AI 声音事件最小间隔。 | [ThreeGame:1271](../src/three/ThreeGame.ts#L1271) | K10 | 增大进食 AI 声音事件间隔；减小更密；不是咀嚼播放循环长度。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.minimumMovementSoundDistance`](../src/config/gameConfig.ts#L251) | `0.002` | u/帧；按帧实际位移发声的最小门槛。 | [ThreeGame:2699](../src/three/ThreeGame.ts#L2699) | K10 | 增大抑制更多微小位移声音事件；减小更易因微动发事件。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.distanceFalloffPower`](../src/config/gameConfig.ts#L253) | `1` | 无量纲；距离衰减：(1 - 距离 / 事件范围) 的指数；1 保持当前线性手感。 | [DevBHelpText:58](../src/systems/DevBHelpText.ts#L58)；[PerceptionSystem:192](../src/systems/PerceptionSystem.ts#L192)；[RuntimeDebugOverrides:83](../src/systems/RuntimeDebugOverrides.ts#L83) | K10 | 增大远距离声音衰减更快；减小更易被远处听到。 | V5、V2、V7 | 是：`hearing.falloffPower`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.wallSoundFactor`](../src/config/gameConfig.ts#L254) | `0.28` | 比例／倍率；声音每穿一处墙的剩余比例。 | [DevBHelpText:64](../src/systems/DevBHelpText.ts#L64)；[PerceptionSystem:124](../src/systems/PerceptionSystem.ts#L124)；[RuntimeDebugOverrides:88](../src/systems/RuntimeDebugOverrides.ts#L88) | K10 | 增大穿墙剩余强度；减小更弱，多处遮挡相乘。 | V5、V2、V7 | 是：`hearing.wallFactor`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.openDoorSoundFactor`](../src/config/gameConfig.ts#L255) | `1` | 比例／倍率；声音穿 OPEN 门的剩余比例。 | [DevBHelpText:70](../src/systems/DevBHelpText.ts#L70)；[PerceptionSystem:125](../src/systems/PerceptionSystem.ts#L125)；[RuntimeDebugOverrides:93](../src/systems/RuntimeDebugOverrides.ts#L93) | K10 | 增大穿 OPEN 门剩余强度；减小更弱。 | V5、V2、V7 | 是：`hearing.openDoorFactor`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.closedDoorSoundFactor`](../src/config/gameConfig.ts#L256) | `0.45` | 比例／倍率；声音穿 CLOSED 门的剩余比例。 | [DevBHelpText:76](../src/systems/DevBHelpText.ts#L76)；[PerceptionSystem:126](../src/systems/PerceptionSystem.ts#L126)；[RuntimeDebugOverrides:98](../src/systems/RuntimeDebugOverrides.ts#L98) | K10 | 增大穿 CLOSED 门剩余强度；减小更弱。 | V5、V2、V7 | 是：`hearing.closedDoorFactor`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.lockedDoorSoundFactor`](../src/config/gameConfig.ts#L257) | `0.35` | 比例／倍率；声音穿 LOCKED 门的剩余比例。 | [DevBHelpText:82](../src/systems/DevBHelpText.ts#L82)；[PerceptionSystem:127](../src/systems/PerceptionSystem.ts#L127)；[RuntimeDebugOverrides:103](../src/systems/RuntimeDebugOverrides.ts#L103) | K10 | 增大穿 LOCKED 门剩余强度；减小更弱。 | V5、V2、V7 | 是：`hearing.lockedDoorFactor`（下次判定／移动）；有效玩法参数 |
| [`GAME_CONFIG.perception.minimumAudibleStrength`](../src/config/gameConfig.ts#L258) | `0.015` | 无量纲强度；距离和遮挡后最终强度的可听门槛。 | [DeepSeekAIController:1404](../src/systems/DeepSeekAIController.ts#L1404)；[DevBHelpText:88](../src/systems/DevBHelpText.ts#L88)；[PerceptionSystem:178](../src/systems/PerceptionSystem.ts#L178)；[RuntimeDebugOverrides:108](../src/systems/RuntimeDebugOverrides.ts#L108) | K10 | 增大需更强信号才可听／被 DeepSeek 视为弱威胁；减小更敏感。 | V5、V2、V7 | 是：`hearing.minAudible`（下次判定／移动）；有效玩法参数 |

### 米痕生成与寿命（4 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.perception.traceGenerationMs`](../src/config/gameConfig.ts#L234) | `5000` | ms；实际进食增长后可继续生成移动米痕的窗口。 | [PerceptionSystem:231](../src/systems/PerceptionSystem.ts#L231) | K11 | 增大进食后能生成米痕的窗口；减小减少留痕机会。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.traceLifetimeMs`](../src/config/gameConfig.ts#L235) | `15000` | ms；单条米痕独立寿命。 | [PerceptionSystem:249](../src/systems/PerceptionSystem.ts#L249) | K11 | 增大每条米痕留存更久；减小更快消失；关联观察／记忆。 | V5、V2、V7 | 否；有效玩法参数 |
| [`GAME_CONFIG.perception.traceFadeMs`](../src/config/gameConfig.ts#L236) | `3000` | ms；米痕寿命末段的透明度淡出时长。 | [PerceptionSystem:269](../src/systems/PerceptionSystem.ts#L269) | K11 | 增大米痕末段淡出时长；减小更快淡出；应不大于寿命。 | V5、V2、V7 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceStepDistance`](../src/config/gameConfig.ts#L237) | `0.65` | u；实际移动生成相邻脚印的最小步距。 | [HumanSearchTuning:30](../src/systems/HumanSearchTuning.ts#L30)；[PerceptionSystem:243](../src/systems/PerceptionSystem.ts#L243) | K11 | 增大脚印更稀且链连接距同比增大；减小更密且更多 Mesh。 | V5、V2、V7 | 否；有效玩法参数 |

### 米痕纯视觉（8 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.perception.traceVisual.color`](../src/config/gameConfig.ts#L239) | `0x9aa4aa` | RGB色值；米痕显示颜色。 | [RiceTraceView:10](../src/three/RiceTraceView.ts#L10) | K11 | 改变对应表现颜色，色值大小不代表难度升降。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.footprintRadius`](../src/config/gameConfig.ts#L240) | `0.18` | u；单个米痕基准半径。 | [RiceTraceView:9](../src/three/RiceTraceView.ts#L9) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.widthScale`](../src/config/gameConfig.ts#L241) | `0.7` | 比例／倍率；米痕横向比例。 | [RiceTraceView:12](../src/three/RiceTraceView.ts#L12) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.lengthScale`](../src/config/gameConfig.ts#L242) | `1.45` | 比例／倍率；米痕纵向比例。 | [RiceTraceView:12](../src/three/RiceTraceView.ts#L12) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.sideOffset`](../src/config/gameConfig.ts#L243) | `0.14` | u；左右脚横向错开距离。 | [RiceTraceView:14](../src/three/RiceTraceView.ts#L14) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.forwardOffset`](../src/config/gameConfig.ts#L244) | `0.07` | u；两脚前后错开距离。 | [RiceTraceView:14](../src/three/RiceTraceView.ts#L14) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.groundOffset`](../src/config/gameConfig.ts#L245) | `0.075` | u；米痕离地高度。 | [RiceTraceView:18](../src/three/RiceTraceView.ts#L18) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.perception.traceVisual.opacity`](../src/config/gameConfig.ts#L246) | `0.88` | 比例／倍率；米痕初始不透明度。 | [RiceTraceView:11](../src/three/RiceTraceView.ts#L11) | K11 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V5、V11 | 否；表现／非日常平衡 |

### AI 声音事件（九类）（27 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.perception.sounds.FOOTSTEP.range`](../src/config/gameConfig.ts#L260) | `17` | u；FOOTSTEP：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.FOOTSTEP`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FOOTSTEP.strength`](../src/config/gameConfig.ts#L260) | `0.35` | 无量纲强度；FOOTSTEP：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.FOOTSTEP`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FOOTSTEP.lifetimeMs`](../src/config/gameConfig.ts#L260) | `1400` | ms；FOOTSTEP：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.FOOTSTEP`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.RICE_EAT.range`](../src/config/gameConfig.ts#L261) | `7` | u；RICE_EAT：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.RICE_EAT`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.RICE_EAT.strength`](../src/config/gameConfig.ts#L261) | `0.7` | 无量纲强度；RICE_EAT：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.RICE_EAT`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.RICE_EAT.lifetimeMs`](../src/config/gameConfig.ts#L261) | `1200` | ms；RICE_EAT：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.RICE_EAT`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.SPRINT.range`](../src/config/gameConfig.ts#L262) | `18` | u；SPRINT：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.SPRINT`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.SPRINT.strength`](../src/config/gameConfig.ts#L262) | `0.8` | 无量纲强度；SPRINT：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.SPRINT`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.SPRINT.lifetimeMs`](../src/config/gameConfig.ts#L262) | `1200` | ms；SPRINT：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.SPRINT`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FALL.range`](../src/config/gameConfig.ts#L263) | `10` | u；FALL：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.FALL`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FALL.strength`](../src/config/gameConfig.ts#L263) | `1` | 无量纲强度；FALL：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.FALL`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FALL.lifetimeMs`](../src/config/gameConfig.ts#L263) | `1500` | ms；FALL：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.FALL`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_OPEN.range`](../src/config/gameConfig.ts#L264) | `6` | u；DOOR_OPEN：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.DOOR_OPEN`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_OPEN.strength`](../src/config/gameConfig.ts#L264) | `0.6` | 无量纲强度；DOOR_OPEN：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.DOOR_OPEN`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_OPEN.lifetimeMs`](../src/config/gameConfig.ts#L264) | `1000` | ms；DOOR_OPEN：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.DOOR_OPEN`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_CLOSE.range`](../src/config/gameConfig.ts#L265) | `6` | u；DOOR_CLOSE：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.DOOR_CLOSE`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_CLOSE.strength`](../src/config/gameConfig.ts#L265) | `0.65` | 无量纲强度；DOOR_CLOSE：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.DOOR_CLOSE`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_CLOSE.lifetimeMs`](../src/config/gameConfig.ts#L265) | `1000` | ms；DOOR_CLOSE：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.DOOR_CLOSE`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_LOCK.range`](../src/config/gameConfig.ts#L266) | `5` | u；DOOR_LOCK：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.DOOR_LOCK`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_LOCK.strength`](../src/config/gameConfig.ts#L266) | `0.65` | 无量纲强度；DOOR_LOCK：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.DOOR_LOCK`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.DOOR_LOCK.lifetimeMs`](../src/config/gameConfig.ts#L266) | `1000` | ms；DOOR_LOCK：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.DOOR_LOCK`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FORCE_BREAK.range`](../src/config/gameConfig.ts#L267) | `10` | u；FORCE_BREAK：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.FORCE_BREAK`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FORCE_BREAK.strength`](../src/config/gameConfig.ts#L267) | `1` | 无量纲强度；FORCE_BREAK：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.FORCE_BREAK`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.FORCE_BREAK.lifetimeMs`](../src/config/gameConfig.ts#L267) | `1500` | ms；FORCE_BREAK：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.FORCE_BREAK`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.LOCK_BREAK.range`](../src/config/gameConfig.ts#L268) | `7` | u；LOCK_BREAK：AI 声音事件传播范围。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大范围更远且同距衰减更少；减小相反。 | V5、V2、V7 | 是：`hearing.range.LOCK_BREAK`（实际即时；元数据误标仅新事件，见A15）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.LOCK_BREAK.strength`](../src/config/gameConfig.ts#L268) | `0.8` | 无量纲强度；LOCK_BREAK：生成时原始强度。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大更容易听到并触发 AI 阈值；减小相反。 | V5、V2、V7 | 是：`hearing.strength.LOCK_BREAK`（仅新事件）；有效玩法参数 |
| [`GAME_CONFIG.perception.sounds.LOCK_BREAK.lifetimeMs`](../src/config/gameConfig.ts#L268) | `1200` | ms；LOCK_BREAK：生成时事件寿命。 | [PerceptionSystem:157](../src/systems/PerceptionSystem.ts#L157)；[RuntimeDebugOverrides:64](../src/systems/RuntimeDebugOverrides.ts#L64) | K10 | 增大事件存活更久；减小更快过期。 | V5、V2、V7 | 是：`hearing.lifetime.LOCK_BREAK`（仅新事件）；有效玩法参数 |

### 吃米与米袋（11 项）

| 参数完整路径／定义 | 当前值 | 单位与作用 | 运行读取系统 | 关联 | 调大／调小影响 | 相关测试 | DEV 覆盖／状态 |
|---|---|---|---|---|---|---|---|
| [`GAME_CONFIG.rice.candidateCount`](../src/config/gameConfig.ts#L273) | `14` | 次／个；地图中参与抽选的候选米点数和每局激活数量；坐标仍由地图文件定义。 | [apartmentMap:362](../src/three/map/apartmentMap.ts#L362) | K8 | 增大扩大前 N 个权威米点的候选池；减小缩小；不创造新坐标。 | V3、V15 | 否；有效玩法参数 |
| [`GAME_CONFIG.rice.activeCount`](../src/config/gameConfig.ts#L274) | `5` | 次／个；每局激活米份数，全部完成才能胜利。 | [apartmentMap:58](../src/three/map/apartmentMap.ts#L58) | K8 | 增大需要吃更多份，改变总进度分母；减小更少；固定五份文案须同步。 | V3、V15 | 否；有效玩法参数 |
| [`GAME_CONFIG.rice.size`](../src/config/gameConfig.ts#L275) | `30` | px；米袋基础显示尺寸，不自动改变进食交互距离。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598) | K8 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V3、V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.rice.color`](../src/config/gameConfig.ts#L276) | `0xf2e5bc` | RGB色值；米袋程序化回退材质颜色。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598) | K8 | 改变对应表现颜色，色值大小不代表难度升降。 | V3、V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.rice.interactionRange`](../src/config/gameConfig.ts#L277) | `60` | px；像素，运行时除以 pixelsPerUnit。 | [DeepSeekAIController:755](../src/systems/DeepSeekAIController.ts#L755)；[MatchRandom:67](../src/systems/MatchRandom.ts#L67)；[ThreeGame:1228](../src/three/ThreeGame.ts#L1228) | K8 | 增大可从更远进食；减小需更近；像素值须除 pixelsPerUnit。 | V3、V15 | 否；有效玩法参数 |
| [`GAME_CONFIG.rice.prepareMs`](../src/config/gameConfig.ts#L278) | `400` | ms；每次开始或恢复进食的准备时间：毫秒。 | [DeepSeekAIController:2677](../src/systems/DeepSeekAIController.ts#L2677)；[ThreeGame:120](../src/three/ThreeGame.ts#L120) | K8 | 增大每次开始／中断后恢复进食的准备成本；减小更快开始。 | V3、V15 | 否；有效玩法参数 |
| [`GAME_CONFIG.rice.maxProgressMs`](../src/config/gameConfig.ts#L279) | `5000` | ms；从当前进食模式选择的每份最大进度时长。 | [ThreeGame:120](../src/three/ThreeGame.ts#L120) | K8 | 派生值；应通过 RICE_MAX_PROGRESS_MS 与 RICE_TIMING_MODE 调整。 | V3、V15 | 否；模式派生值 |
| [`GAME_CONFIG.rice.visual.fullHeight`](../src/config/gameConfig.ts#L281) | `0.62` | u；饱满米袋的显示高度。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598)；[RiceView:32](../src/three/RiceView.ts#L32) | K8 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V3、V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.rice.visual.emptyHeight`](../src/config/gameConfig.ts#L282) | `0.08` | u；空袋显示高度。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598)；[RiceView:32](../src/three/RiceView.ts#L32) | K8 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V3、V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.rice.visual.fullBulgeHeight`](../src/config/gameConfig.ts#L283) | `0.22` | u；饱满袋顶部鼓起高度。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598)；[RiceView:34](../src/three/RiceView.ts#L34) | K8 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V3、V15 | 否；表现／非日常平衡 |
| [`GAME_CONFIG.rice.visual.emptyWidthScale`](../src/config/gameConfig.ts#L284) | `0.92` | 比例／倍率；空袋相对饱满袋的宽度系数。 | [ThreeGame:598](../src/three/ThreeGame.ts#L598)；[RiceView:35](../src/three/RiceView.ts#L35) | K8 | 增大／减小改变对应显示尺寸或比例，不改逻辑碰撞／胜负。 | V3、V15 | 否；表现／非日常平衡 |

### gameConfig.ts 中的进食模式入口（不计入226字段）

| 参数路径 | 当前值 | 单位／用途 | 读取／关联 | 增减或切换影响 | 相关测试／DEV |
|---|---|---|---|---|---|
| `RICE_MAX_PROGRESS_MS.production` | 60000 | ms/份；正式设计时长 | rice.maxProgressMs，K8；仅选中production时生效 | 增大延长正式进食；减小缩短 | V3、V1；否 |
| `RICE_MAX_PROGRESS_MS.development` | 5000 | ms/份；开发时长 | rice.maxProgressMs，K8；当前选中 | 增大延长开发进食；减小缩短 | V3、V1；否 |
| `RICE_TIMING_MODE` | development | 模式 | 选择上面两值，独立于Vite DEV | production为60秒/份；development为5秒/份 | V3、V1；否 |

## 附录 B. 可填写的玩法与技术调整表

共 170 个 GAME_CONFIG 字段＋3个模式入口；排除纯视觉、已停用、未读取、开发输入及派生时长。技术项与固定结构约束仍列出但标明限制，填值不自动授权实现。关联与增减说明在附录 A；三列空白保留给用户。

### 角色基础

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.player.speed` | `230` |  |  | K1；有效玩法参数；先核实DEV覆盖 | V11、V2、V9、V13 |  |
| `GAME_CONFIG.human.speedMultiplier` | `1.08` |  |  | K1；有效玩法参数；先核实DEV覆盖 | V11、V2、V9、V13 |  |

### Human AI

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.humanAI.movementSpeedMultiplier` | `0.52` |  |  | K2；有效玩法参数；先核实DEV覆盖 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.navCellSize` | `0.4` |  |  | K2；技术／几何，谨慎调 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.repathIntervalMs` | `500` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.waypointTolerance` | `0.25` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.investigationDwellMs` | `3000` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.stuckRepathMs` | `800` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.stuckProgressEpsilon` | `0.05` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.closedDoorPathCost` | `3` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.lockedDoorPathCost` | `12` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.aiUnlockDurationMs` | `8750` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.aiUnlockSuccessChance` | `0.7` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.aiUnlockMaxAttempts` | `2` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.aiUnlockFailureAvoidMs` | `6000` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.forceBreakReserveMs` | `1800` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.detourSlackMs` | `600` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.searchRadius` | `12` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.searchRoomCount` | `3` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.searchDwellMs` | `900` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.searchMaxMs` | `15000` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.hideCheckFailureCooldownMs` | `6000` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |
| `GAME_CONFIG.humanAI.hideCheckMaxPerRound` | `1` |  |  | K2；有效玩法参数 | V6、V2、V8、V13 |  |

### DeepSeek AI

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.deepseekAI.waypointTolerance` | `0.25` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stuckRepathMs` | `800` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stuckProgressEpsilon` | `0.05` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.maxStuckRepathsPerTarget` | `2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.retryMs` | `1500` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.visionEvadeDistance` | `5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.soundEvadeStrength` | `0.09` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.soundThreatProjection` | `4` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.lastSeenAlertMs` | `2500` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.alertHoldMs` | `1800` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.minimumEvadeMs` | `900` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.recoverMs` | `1200` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeReplanMs` | `700` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeMinSeparation` | `3` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeMinTravel` | `2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeGoalTolerance` | `0.8` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeCoverBonus` | `4` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeDeadEndPenalty` | `6` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeTravelPenalty` | `0.7` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeTowardThreatPenalty` | `3` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeGoalHoldMs` | `1500` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeSwitchScoreMargin` | `2.5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeVisitMemoryMs` | `12000` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeRecentVisitCount` | `4` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeRecentVisitPenalty` | `5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeLoopMinDistanceGain` | `1` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeNearScoreBand` | `0.8` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.safeObservationMs` | `2500` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.dangerRiceAvoidMs` | `3000` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.dangerRouteRadius` | `3` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.safeWaitFailureThreshold` | `2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.safeWaitRecheckMs` | `2500` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeExtraExitBonus` | `1.2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeAlternateRouteBonus` | `2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeBlockedExitPenalty` | `9` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.escapeRouteThreatPenalty` | `3` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.exitBlockRadius` | `2.5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.alternateRouteMaxRatio` | `2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.approachSprintDistance` | `6` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.approachSpeedThreshold` | `0.35` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.blockedExitSprintDistance` | `3.5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.safeSprintDistance` | `5` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.riskySprintDistance` | `2.2` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.sprintSoundStrength` | `0.22` |  |  | K5；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityStillMs` | `5000` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityChance` | `0.1` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityMovementEpsilon` | `0.05` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiositySafeDistance` | `2` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityObserveMs` | `1800` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityCooldownMs` | `12000` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.curiosityApproachTolerance` | `0.5` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stationaryPassageChance` | `1` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stationaryPassageSafetyMargin` | `0.2` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stationaryPassageBlockRadius` | `1.5` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stationaryPassageObserveDistance` | `2` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.stationaryPassageCheckIntervalMs` | `500` |  |  | K6；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.doorEscapeMinHumanDistance` | `1.5` |  |  | K4；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.doorEscapeCrossingWindowMs` | `1800` |  |  | K4；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.doorEscapeCooldownMs` | `20000` |  |  | K4；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.humanPlayerUnlockPenaltyMs` | `10000` |  |  | K4；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideThreatDistance` | `3.5` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideMinConcealMs` | `2500` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideRecheckMs` | `500` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideReenterCooldownMs` | `8000` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideCandidateFailCooldownMs` | `6000` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideRecentSpotCount` | `3` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideRecentSpotPenalty` | `5` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideMaxConsecutive` | `2` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |
| `GAME_CONFIG.deepseekAI.hideMaxConcealMs` | `0` |  |  | K7；有效玩法参数 | V7、V12、V13 |  |

### 冲刺

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.sprint.speedMultiplier` | `1.6` |  |  | K3；有效玩法参数 | V1、V7、V13 |  |
| `GAME_CONFIG.sprint.durationMs` | `2500` |  |  | K3；有效玩法参数 | V1、V7、V13 |  |
| `GAME_CONFIG.sprint.riskThreshold` | `0.3` |  |  | K3；有效玩法参数 | V1、V7、V13 |  |
| `GAME_CONFIG.sprint.stunMs` | `1000` |  |  | K3；有效玩法参数 | V1、V7、V13 |  |
| `GAME_CONFIG.sprint.cooldownMs` | `30000` |  |  | K3；有效玩法参数 | V1、V7、V13 |  |

### 单位与场景

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.three.pixelsPerUnit` | `60` |  |  | K1；技术／几何，谨慎调 | V11、V2、V9、V13 |  |
| `GAME_CONFIG.three.actorHeight` | `0.7` |  |  | K1；技术／几何，谨慎调 | V11、V2、V9、V13 |  |

### 碰撞技术

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.collision.playerRadius` | `0.23` |  |  | K1；技术／几何，谨慎调 | V11、V2、V9、V13 |  |
| `GAME_CONFIG.collision.contactEpsilon` | `0.0001` |  |  | K1；技术／几何，谨慎调 | V11、V2、V9、V13 |  |
| `GAME_CONFIG.collision.maxMovementSubstep` | `0.12` |  |  | K1；技术／几何，谨慎调 | V11、V2、V9、V13 |  |

### 阶段与抓捕

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.match.maxFrameDeltaMs` | `50` |  |  | K14；技术／几何，谨慎调 | V1、V2、V13 |  |
| `GAME_CONFIG.match.readyMs` | `3000` |  |  | K14；有效玩法参数 | V1、V2、V13 |  |
| `GAME_CONFIG.match.captureRadius` | `0.7` |  |  | K14；有效玩法参数；先核实DEV覆盖 | V1、V2、V13 |  |
| `GAME_CONFIG.match.captureMs` | `350` |  |  | K14；有效玩法参数 | V1、V2、V13 |  |

### 对局随机化

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.matchRandom.minSpawnDistance` | `10` |  |  | K13；有效玩法参数 | V12、V13 |  |
| `GAME_CONFIG.matchRandom.doorOpenChance` | `0.5` |  |  | K13；有效玩法参数 | V12、V13 |  |
| `GAME_CONFIG.matchRandom.maxAttempts` | `20` |  |  | K13；技术／几何，谨慎调 | V12、V13 |  |

### Human Q 搜查

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.humanSearch.range` | `1.5` |  |  | K7；有效玩法参数 | V8、V6、V13 |  |
| `GAME_CONFIG.humanSearch.halfAngleDeg` | `60` |  |  | K7；有效玩法参数 | V8、V6、V13 |  |
| `GAME_CONFIG.humanSearch.cooldownMs` | `12000` |  |  | K7；有效玩法参数 | V8、V6、V13 |  |

### 门与锁

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.door.interactionRange` | `1.3` |  |  | K4；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.door.interactionEndInset` | `0.08` |  |  | K4；技术／几何，谨慎调 | V4、V11、V13 |  |
| `GAME_CONFIG.door.maxActiveLocks` | `3` |  |  | K4；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.door.humanFreeOpenClosedDoor` | `true` |  |  | K4；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.door.humanForceBreakCooldownMs` | `30000` |  |  | K4；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.door.playerLockCooldownMs` | `20000` |  |  | K4；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.door.leafHeight` | `1.2` |  |  | K4；技术／几何，谨慎调 | V4、V11、V13 |  |
| `GAME_CONFIG.door.leafThickness` | `0.16` |  |  | K4；技术／几何，谨慎调 | V4、V11、V13 |  |

### PulseLock 时机玩法

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.pulseLock.timing.coreCount` | `3` |  |  | K9；固定结构约束 | V4、V11、V13 |  |
| `GAME_CONFIG.pulseLock.timing.travelMs` | `1400` |  |  | K9；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.pulseLock.timing.targetWidth` | `0.2` |  |  | K9；有效玩法参数 | V4、V11、V13 |  |
| `GAME_CONFIG.pulseLock.timing.targetCenters` | `[0.48,0.56,0.43]` |  |  | K9；有效玩法参数 | V4、V11、V13 |  |

### 感知与发声

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.perception.visionRange` | `11` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.lastSeenMs` | `8000` |  |  | K10；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.footstepIntervalMs` | `650` |  |  | K10；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sprintStepIntervalMs` | `330` |  |  | K10；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.riceSoundIntervalMs` | `1200` |  |  | K10；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.minimumMovementSoundDistance` | `0.002` |  |  | K10；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.distanceFalloffPower` | `1` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.wallSoundFactor` | `0.28` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.openDoorSoundFactor` | `1` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.closedDoorSoundFactor` | `0.45` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.lockedDoorSoundFactor` | `0.35` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.minimumAudibleStrength` | `0.015` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |

### 米痕生成与寿命

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.perception.traceGenerationMs` | `5000` |  |  | K11；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.traceLifetimeMs` | `15000` |  |  | K11；有效玩法参数 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.traceStepDistance` | `0.65` |  |  | K11；有效玩法参数 | V5、V2、V7、V13 |  |

### AI 声音事件（九类）

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.perception.sounds.FOOTSTEP.range` | `17` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FOOTSTEP.strength` | `0.35` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FOOTSTEP.lifetimeMs` | `1400` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.RICE_EAT.range` | `7` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.RICE_EAT.strength` | `0.7` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.RICE_EAT.lifetimeMs` | `1200` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.SPRINT.range` | `18` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.SPRINT.strength` | `0.8` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.SPRINT.lifetimeMs` | `1200` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FALL.range` | `10` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FALL.strength` | `1` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FALL.lifetimeMs` | `1500` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_OPEN.range` | `6` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_OPEN.strength` | `0.6` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_OPEN.lifetimeMs` | `1000` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_CLOSE.range` | `6` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_CLOSE.strength` | `0.65` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_CLOSE.lifetimeMs` | `1000` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_LOCK.range` | `5` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_LOCK.strength` | `0.65` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.DOOR_LOCK.lifetimeMs` | `1000` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FORCE_BREAK.range` | `10` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FORCE_BREAK.strength` | `1` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.FORCE_BREAK.lifetimeMs` | `1500` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.LOCK_BREAK.range` | `7` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.LOCK_BREAK.strength` | `0.8` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |
| `GAME_CONFIG.perception.sounds.LOCK_BREAK.lifetimeMs` | `1200` |  |  | K10；有效玩法参数；先核实DEV覆盖 | V5、V2、V7、V13 |  |

### 吃米与米袋

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `GAME_CONFIG.rice.candidateCount` | `14` |  |  | K8；有效玩法参数 | V3、V15、V13 |  |
| `GAME_CONFIG.rice.activeCount` | `5` |  |  | K8；有效玩法参数 | V3、V15、V13 |  |
| `GAME_CONFIG.rice.interactionRange` | `60` |  |  | K8；有效玩法参数 | V3、V15、V13 |  |
| `GAME_CONFIG.rice.prepareMs` | `400` |  |  | K8；有效玩法参数 | V3、V15、V13 |  |

### 进食模式入口

| 参数路径 | 当前值 | 拟调整值 | 调整目的 | 关联风险 | 验证方法 | 验收结果 |
|---|---|---|---|---|---|---|
| `RICE_MAX_PROGRESS_MS.production` | 60000 ms |  |  | K8；仅production生效 | V3、V1、V13 |  |
| `RICE_MAX_PROGRESS_MS.development` | 5000 ms |  |  | K8；当前模式 | V3、V1、V13 |  |
| `RICE_TIMING_MODE` | development |  |  | K8；build不自动切换 | V3、V13 |  |

**尚未决定的事项**：用户选择 B1–B4 哪些整理项；用户填写拟调整值与实验目标；哪些非生效字段将来需要恢复／删除；是否扩展固定 PulseLock 结构或米份数 UI。上述事项本轮均未实施。

## 附录 C. 本轮实施边界与复核

只新增本报告，修正数值索引中证据明确的字段说明，更新交接入口并追加开发日志。源码、测试、脚本、配置、权威地图与素材均不改；临时扫描工具位于系统 Temp，未加入项目。重构、格式工具引入、参数恢复／删除、平衡实验均留待用户选择。

最终机械复核：216个源码／数据／测试／脚本文件与审计开始时SHA-256完全一致，新增／删除0；226项参数目录无遗漏／重复／未知项，173行填写表的三列输入均为空，源码链接均存在且行号未越界。`git diff --check`通过；本轮正式自动化结果为850/850及独立tsc通过，未重跑build或浏览器验收。

静态扫描并非逐条行为证明：导入图不覆盖运行时计算出的路径；注释和测试引用不等同于运行消费；参数方向描述说明局部机制，不保证整局胜率单调。没有执行素材再分发审查、安全审计、性能基准或新的真人平衡测试。
