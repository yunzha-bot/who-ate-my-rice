# 《谁吃了我的米》项目级 Codex 协作规则

本文件是长期固定规则，适用于以后在本项目工作的 Codex 会话。`docs/AGENT_LOG.md` 是按时间追加的工作记录，不用于覆盖或替代本文件。执行具体任务时，以用户当次明确要求为范围；若与现有代码状态或本文件冲突，先说明并确认，不自行改设计。

## 项目与阶段

- 中文名：《谁吃了我的米》；工程名：`who-ate-my-rice`；目标平台：Chrome / Edge 电脑浏览器。
- 当前主版本为 Web / Three.js 3D Alpha。Phaser 已从当前主运行技术栈移除。
- 先用灰盒验证核心玩法，再投入正式美术；核心玩法未验证前，不大规模扩展功能。
- 采用阶段 Gate：实现 → 测试 → 验收 → 更新日志 → 提交 Git → 进入下一阶段。当前阶段未通过验收，不提前进入后续阶段。

## 当前主技术栈

- Web 主版本使用 Vite、TypeScript、Three.js、HTML、CSS；Phaser 已从依赖和运行源码中移除。
- Three.js 负责 3D Scene、WebGLRenderer、OrthographicCamera、角色/房间/墙体/大米占位体、3D 世界坐标、XZ 地面移动、相机跟随、Camera-Relative Movement 和 3D 碰撞；后续如有明确任务，可加载 glTF 模型。
- HTML / CSS 负责 HUD、菜单、阵营选择、结算和调试 UI。

## ChatGPT 与 Codex 的分工

ChatGPT 通常负责拆解开发阶段、编写 Codex 执行指令、限定任务范围与验收标准、辅助判断是否进入下一阶段，并防止过度设计。用户粘贴来自 ChatGPT 的任务指令时，优先按该任务范围执行；不擅自扩大范围，也不提前实现“未来可能需要”的功能。若任务目标与当前代码状态冲突，先报告冲突，不自行改变玩法或设计。

## 每次任务的执行顺序与精简执行模式

1. 开始前：阅读本文件、`docs/AGENT_LOG.md` 最近相关记录及与任务直接相关的规范文档；检查 `git status` 和当前分支；明确本次目标与验收标准。复用仓库已有的规则、状态和历史，不要求用户重复提供完整背景。
2. 开发中：只完成明确要求；不擅加玩法、依赖、框架、重构或阶段外优化；不为未来扩展过度抽象；保持实现简单、可运行、可验证。发现现有实现与任务目标冲突，先说明原因。
3. 验证：游戏代码任务默认运行 `npm test`、`npm run build`、`git diff --check`；回归重点覆盖受影响系统及直接依赖，而非每次完整人工重测。Door 修改查 Door + Capture + Collision；Rice 修改查 Rice + Sprint 30%；Input 修改查 Input + Pause + Faction。`npm run build` 已包含 `tsc --noEmit` 时不必重复运行。纯文档或纯 Git 任务按适用性检查并说明未运行游戏测试的原因；未测试内容不得称为已验证。
4. 日志：`docs/AGENT_LOG.md` 主要用于正式阶段收尾和重要事件；普通小型临时修复无需每次追加，除非用户明确要求。需要记录时只在文件末尾追加，不覆盖历史，只写实际完成内容。
5. Git：普通任务默认停在“代码完成 + 自动测试通过 + 等待人工验收”；未经人工确认，不自动 commit、push、tag 或进入下一阶段。用户明确允许且验收通过后，先检查 `git status`，仅暂存本次应提交文件，创建清晰 commit 并按授权 push；如有无关变更，先报告并避免误提交。用户明确要求不提交时不得提交。

后续普通 Bug 修复、小功能、参数、UI 和体验调整默认使用精简执行模式。任务提示只需写当前目标、允许/禁止修改范围、必须执行的测试、人工验收点，以及是否允许 commit / push / tag；能用约 20～40 行说清的任务，不生成数百行重复约束。已写入本文件的长期规则只引用，不在提示词里重复全文；已记入日志的历史实现仅在本次要修改该系统时回看，不重复总结。只列当前相关系统，不每次展开全部 Rice、Sprint、Capture、Door、Camera、Faction、Git、UE5 规则。

新大阶段、核心玩法架构或状态机重构、输入/地图结构重构、跨系统高耦合修改、高风险 Git/发布操作，或连续多次实现错误的功能，才使用详细执行模式。`AGENTS.md` 只在长期规则或正式阶段状态变化时更新。已知 Vite bundle 超过 500 kB 是非阻断提示；除非体积异常增长或出现实际性能问题，不反复长篇说明，也不因此阻断普通任务。

## 统一数值管理规则

- 新增或调整的可调玩法参数统一定义在 `src/config/gameConfig.ts` 的 `GAME_CONFIG` 中；角色速度、冲刺、进食、抓捕、技能冷却、门锁、扫雷、声音、视野、米痕与对局时间均遵循此规则。各系统读取配置，不新增重复配置或散落的可调参数。
- 每个新增参数应有简短注释，写明单位、用途和默认值。已有开发/正式模式差异应在配置中明确区分并保留切换方式。
- 新增或调整参数后，同步维护 `docs/GAME_BALANCE_CONFIG.md`，核对真实变量名、默认值、单位、作用和修改注意事项与源码一致。
- 只集中管理可调玩法参数。地图坐标、状态枚举、数学常量，以及无需调节的算法和视觉实现常量可留在对应模块；若某实现常量变成设计调节项，再迁入 `GAME_CONFIG`。

## 视觉表现与玩法逻辑分离

- 玩家和 AI 共用 `IDLE / WALK / RUN / EAT / STARTLED / FALL / STUN / INTERACT / CAPTURE` 角色动作接口；动作由既有玩法状态单向驱动，经独立 `CharacterActionView` 表现。正式 Q 版角色与动作资源尚未导入；后续通过独立表现层和预留的 GLB / AnimationMixer 接口替换白模表现，不让动画反向改写速度、碰撞、进食或抓捕规则。

- 声音感知计算由 `PerceptionSystem` 负责；声音场景效果由 `SoundVisualView` 负责，HUD 由 `ThreeGame` / CSS 显示。
- 后续替换声音提示美术时，优先调整 `SoundVisualView` 的几何体、材质、纹理，以及 HUD 图标与 CSS；声音距离、遮挡、方向等玩法计算保持在感知系统，不随美术替换改动。
- 正式声音 UI 资源建议放在 `public/assets/ui/sound/`，场景声音 VFX 建议放在 `public/assets/vfx/sound/`。这些是未来建议目录，本规则不要求现在创建。
- 新增同类视觉效果时，尽量通过独立 View / UI 模块接入；美术资源路径不要写进 `PerceptionSystem`。

## 日志字段

每条新日志至少记录：日期时间、任务名称、当前开发阶段、本次目标、实际完成内容、新增文件、修改文件、删除文件、依赖变化、测试结果、已知问题、下一步建议、Git commit 信息（如已提交）。任务失败时还要记录失败步骤、错误摘要、已尝试方法，以及当前项目是否仍可运行。若推送失败，在日志中如实记录，不将其写成已成功。

## Git 与安全边界

- 推送遇到认证、权限、冲突或被拒绝：立即停止，不使用密码，不自行创建 Token，不强推，不删除历史，并向用户提供完整错误。
- 不删除用户现有文件，除非任务明确要求；不重写 Git 历史；不使用 force push。
- 不擅自更换技术栈、删除依赖或修改玩法规则；不修改 `docs/AGENT_LOG.md` 的历史内容。

## 当前项目状态

项目：`who-ate-my-rice`；中文名：《谁吃了我的米》。

当前主版本：Web / Three.js 3D Alpha。

已完成阶段：

- S1 最小运行工程 —— `v0.0.1`。
- S2 一房一米 —— `v0.0.2`。
- S3 最小完整对局 —— `v0.0.3`，Gate = PASS。
- S4 追逐原型 —— `v0.0.4`，Gate = PASS。
- S4.5 Three.js 3D 技术迁移 —— `v0.0.5-tech3d`，Gate = PASS。
- S5 完整 3D 灰盒地图 —— `v0.1.0-alpha`，Gate = PASS。
- S6A 正式大米循环 —— Gate = PASS。
- S6B 门系统 —— Gate = PASS。
- S6C Human 反制 / Minesweeper Lock Counterplay —— Gate = PASS。
- S6D 双向信息系统 —— Gate = PASS；声音、米痕、视野及调试主控切换已通过人工验收。
- S6 游戏玩法 Alpha —— Gate = PASS；里程碑 `v0.2.0-alpha` 以实际推送结果为准。
- S7A Human AI —— S7A-0 动作接口、S7A-1 基础行为、S7A-2 高级决策及可收纳调试面板人工验收 PASS；Gate = PASS。

当前下一阶段：S7B —— DeepSeek AI。Human AI 移动倍率 0.92 与自动解锁耗时 8,750 毫秒暂按用户决定接受；自动解锁速度留到 S16 平衡阶段继续调整。Web 主版本继续按阶段 Gate 推进，不因 UE5.3 预留而跳过或停止 Web 开发。

单份大米正式设计时长为 60 秒。当前开发测试配置临时使用 5 秒，仅为提高频繁测试效率；Beta / Release Candidate 前必须切回 60 秒并重新测试。

当前灰盒与玩法状态：

- 住宅 / 公寓式 3D 灰盒地图已完成；旧九宫格布局已废弃。
- 地图包含 10 个主要空间与阳台、衣帽间两个附属空间，并保留三条追逐环路。
- 14 个 RiceCandidate 每局无重复随机激活 5 个 Active Rice；每份大米拥有独立持久进度，完成 5 / 5 后 DeepSeek 娘获胜。
- 18 个 DoorNode 已升级为正式 Door System；5 个 HideSpot 仍为占位，尚未实现正式藏身玩法。
- 保留 Camera-Relative Movement、玩家相机跟随、Circle Footprint、分轴碰撞与 Wall Sliding。

## 当前核心玩法规则摘要

- 可选择 DeepSeek 娘或人类阵营。WASD / 方向键采用 Camera-Relative Movement，所控角色保持在屏幕中央附近；IJKL 暂作另一角色的开发调试控制。
- DeepSeek 娘冲刺不是能量条：有效移动时点击一次技能键，进入固定时长冲刺；开始后不能停下规避风险。全局大米进度低于 30% 时结束安全，达到或超过 30% 时结束必摔，并眩晕约 1 秒。
- 人类抓捕需要 DeepSeek 娘在 Capture Zone 内连续约 0.35 秒，墙体、家具以及 CLOSED / LOCKED Door 会阻断有效抓捕。
- Door 状态为 `OPEN / CLOSED / LOCKED`。Human 与 DeepSeek 都能开关普通未锁门；DeepSeek 只能锁住 CLOSED Door，不能直接锁 OPEN Door。最多同时存在 3 个 Active Lock；Lock Core 在逻辑和表现上独立于 Door Leaf。
- Human 在可达的 LOCKED Door 旁按 E 打开 4×4 / 3 雷扫雷盘；长按或连点 E 不推进解锁。× / Esc 可退出，同一 Lock Core 的盘面在本局保留；面板开启时世界继续运行，Human 不能移动，Capture Zone 仍有效。扫雷成功使 Core `ACTIVE → DISABLED`、Door `LOCKED → CLOSED` 并释放 Active Lock Slot；Human 需再次 E 开门。失败时门保持 LOCKED、对局继续；扫雷不消耗强破冷却。
- Human 按 Space 可免费快速打开普通 CLOSED Door，即使强破正在冷却也有效；对 LOCKED Door 则立即强破 Core 并 OPEN，触发 30 秒冷却。冷却中不能再强破锁门，但仍可 E 扫雷。DISABLED Core 本局不可重新上锁；Restart 或新 Match 恢复 Core、扫雷盘与技能。门交互采用较宽容的最近有效门判定，不可隔墙操作。
- 角色视觉 Mesh 与 Gameplay Collider 必须解耦。当前角色使用 XZ Circle Footprint，环境使用 AABB，并以 Circle-vs-AABB、Axis-Separated Movement 和 Wall Sliding 解析碰撞；Sprint 使用同一规则。不要轻易恢复 Player Box / AABB Footprint，因为方形碰撞体在门框和墙角斜向移动时容易卡脚。
- 双向信息系统按声音事件的距离和墙/门遮挡计算可听强度，场景中以声源方向显示远蓝、中黄、近红的声波；Vision 区分当前可见、被墙或关门阻挡、超出范围，Last Seen 独立短暂保留。DeepSeek 实际进食增长后开启或刷新 5 秒米痕生成窗口，窗口内移动按步距留下脚印；每个脚印独立保留 15 秒后淡出。暂停冻结相关计时，新局清空米痕。

## 输入与暂停长期规则

- Esc 是统一 Pause Menu 入口；菜单提供 Continue、Restart、Return to Faction Select，开发模式可提供“切换主控阵营”。
- `selectedFaction` 是正式主控及声音、Vision、Last Seen、Rice Trace 的信息观察者，相机始终跟随它。开发模式鼠标点角色只改变临时 WASD 输入目标；Esc 菜单切换正式主控时同步切换镜头、信息观察者及默认输入目标，不重开或重置对局。
- `development.directHotkeysEnabled` 默认保持 `false`；正常正式对局中不启用裸 R / M / Tab，避免误触。需要调试切换时从暂停菜单进入。

## Build Environment

- `npm run build` 保持 `tsc --noEmit && vite build`，构建失败必须返回非零。`dist/` 是被 Git 忽略的可重建产物；不要在 `public/assets/` 放置仅用于保留空目录的 `.gitkeep`，Vite 会将其复制到 `dist/assets/`。
- 遇到 `dist` 的 `EPERM` 时，先核对仓库是否处于当前 Codex 可写工作区。已验证：本仓库位于可写根目录外时，受限执行会在 `dist/assets/.gitkeep` 报 EPERM；同一原始构建命令获得项目目录写入权限后连续三次成功。这是执行环境的写入边界，不能据该报错直接认定 Windows 文件占用；文件系统授权不等于 Windows 管理员提权。
- 再检查是否有能明确归属本项目的 Vite dev / preview 进程；需要停止时优先正常中断，不结束身份不明的进程。开发服务器与生产输出已验证可同时运行，无需仅因浏览器预览打开就停止服务。若获得项目写入权限后仍报 EPERM，再检查文件属性、具体路径和进程占用，并报告；不修改 Windows ACL、不使用 `takeown`、`icacls`、管理员提权或强杀不明进程。

## 阶段状态维护规则

只有正式开发阶段满足 Gate 通过、Git commit 完成并成功推送到 GitHub，才允许更新本文件中的项目进度；若该阶段明确要求创建 Tag，还必须完成 Tag 创建和推送。明确规定“不创建 Tag”的阶段不以 Tag 作为完成条件。更新时只将刚完成的阶段加入“已完成”，并将下一阶段设为“当前下一阶段”；不得改写其他长期规则、删除历史阶段信息、跳过阶段或将未通过 Gate 的阶段提前写成已完成。普通小任务和 Bug 修复不触发本文件的阶段状态更新。

## UE5.3 平行版本预留

- `who-ate-my-rice-ue5` 是独立平行仓库，当前状态为 Reserved / Planning；Web / Three.js 仍是主线。
- 未来允许基于同一游戏设计开发独立的 Unreal Engine 5.3 版本。它与当前 Web / Three.js 主版本是平行实现，不直接替换 Web 版本；本节不是当前开发任务。
- 两版可共享游戏核心设计、玩法与数值规则、角色设定、地图结构、UI 流程、美术与音频规范、测试用例及设计文档，但不直接共享运行时代码。不得将 Three.js Runtime Code 硬塞入 UE 工程，也不得使 Web Runtime 依赖 UE Blueprint / C++；共享设计层 ≠ 共享运行时代码。
- 预留“跨版本玩法协议 / Cross-Version Gameplay Spec”概念，供未来两版对齐胜负、大米、冲刺、30% 风险阈值、抓捕、门、AI、数值参数含义与 GameState 定义。它不是网络接口、服务器 API 或联机接口；未来可另建 `docs/SHARED_GAMEPLAY_SPEC.md`，本次不创建。
- 当前 `who-ate-my-rice` 仓库继续作为 Web 主工程。未来 UE5.3 工程推荐独立仓库（如 `who-ate-my-rice-web` 与 `who-ate-my-rice-ue5`）或同一父目录下的独立文件夹（`who-ate-my-rice/` 与 `who-ate-my-rice-ue5/`）；不要塞入当前 `src/`，也不要现在移动仓库。
- 只有用户明确说“开始 UE5.3 版本开发”后，才可创建 UE 工程、Blueprint、Unreal C++、地图、导入资产或建立 UE Input、Character、GameMode / GameState。预留内容不授权自动创建 UE 文件或变更当前 Web 技术栈。
- 概念映射：Three.js Scene → Unreal Level / World；OrthographicCamera / Camera → CameraActor / CameraComponent；Mesh → StaticMesh / SkeletalMesh；Game Loop → Tick / Actor Component / Subsystem；GameState → Unreal GameState / 自定义状态系统；Input Manager → Enhanced Input；Collision → Unreal Collision / Capsule / Box；HTML/CSS HUD → UMG；Three.js Character → Character / Pawn；glTF 模型 → UE Import Asset；Sprint / Rice / Capture 纯逻辑 → Blueprint / C++ Gameplay Logic。这仅供未来规划，不是立即迁移任务。
- Web 与 UE 版本未来独立管理版本号。Web 可继续使用 `v0.x.x`、`v1.0.0`；UE 未来可用 `ue-v0.1.0` 等前缀或独立仓库版本。本次不创建 UE Tag。

## 每次任务的最终汇报

按顺序报告：本次完成内容、测试结果、修改文件、`docs/AGENT_LOG.md` 是否更新、commit 信息、push 是否成功、已知问题、下一步建议。区分已验证事实、未执行检查和待处理事项。
