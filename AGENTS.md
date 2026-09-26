# 《谁吃了我的米》项目级 Codex 协作规则

本文件只保存**长期稳定、适用于项目后续开发的 AI 协作规则**。会随开发推进变化的内容一律不在本文件维护，按职责放在别处：

- **当前开发状态与交接信息**（当前阶段、待办事项、授权状态、当前测试基线、近期问题、下一步计划）→ `docs/DEEPSEEK_HANDOFF.md`（唯一主要入口）。
- **按时间追加的历史开发日志**（每轮完成情况、测试结果、用户验收、BUG 记录、Git 归档信息）→ `docs/AGENT_LOG.md`（只追加，不回改）。
- **阶段专有的参数、技术决策、设计方案、约束、测试与验收要求** → 对应的阶段设计文档（`docs/`，索引见 `docs/DEEPSEEK_HANDOFF.md`）。

执行具体任务时，以用户当次明确要求为范围；若与现有代码状态或本文件冲突，先说明并确认，不自行改设计。

## 项目与阶段

- 中文名：《谁吃了我的米》；工程名：`who-ate-my-rice`；目标平台：Chrome / Edge 电脑浏览器。
- 当前主版本为 Web / Three.js 3D Alpha。Phaser 已从当前主运行技术栈移除。
- 先用灰盒验证核心玩法，再投入正式美术；核心玩法未验证前，不大规模扩展功能。
- 采用阶段 Gate：实现 → 测试 → 验收 → 更新日志 → 提交 Git → 进入下一阶段。当前阶段未通过验收，不提前进入后续阶段。

## 当前主技术栈

- Web 主版本使用 Vite、TypeScript、Three.js、HTML、CSS；Phaser 已从依赖和运行源码中移除。
- Three.js 负责 3D Scene、WebGLRenderer、OrthographicCamera、角色/房间/墙体/大米占位体、3D 世界坐标、XZ 地面移动、相机跟随、Camera-Relative Movement 和 3D 碰撞；后续如有明确任务，可加载 glTF 模型。
- HTML / CSS 负责 HUD、菜单、阵营选择、结算和调试 UI。

## 用户指令与冲突处理

所有编程代理均以用户当次明确任务为执行范围，并遵守本文件中的长期安全约束。不得擅自扩大范围或提前实现未来功能；若任务要求与当前代码状态或长期规则冲突，先报告具体冲突，不自行改变设计。

## 每次任务的执行顺序与精简执行模式

每轮开始先读取本文件、交接文档中的当前状态、日志中的最近相关记录及直接相关的阶段规范，并检查 Git 基线与工作区。随后按用户限定范围实施；授权、测试、日志、构建和 Git 的详细要求统一遵守下方「全项目通用开发规则与执行规范」，本节不重复定义。

后续普通 Bug 修复、小功能、参数、UI 和体验调整默认使用精简执行模式。任务提示只需写当前目标、允许/禁止修改范围、必须执行的测试、人工验收点，以及是否允许 commit / push / tag；能用约 20～40 行说清的任务，不生成数百行重复约束。已写入本文件的长期规则只引用，不在提示词里重复全文；已记入日志的历史实现仅在本次要修改该系统时回看，不重复总结。只列当前相关系统，不每次展开全部 Rice、Sprint、Capture、Door、Camera、Faction、Git、UE5 规则。

新大阶段、核心玩法架构或状态机重构、输入/地图结构重构、跨系统高耦合修改、高风险 Git/发布操作，或连续多次实现错误的功能，才使用详细执行模式。`AGENTS.md` 只在长期规则变化时更新；阶段进度与当前状态不在本文件维护。

## 统一数值管理规则

- 新增或调整的可调玩法参数统一定义在 `src/config/gameConfig.ts` 的 `GAME_CONFIG` 中；角色速度、冲刺、进食、抓捕、技能冷却、门锁、扫雷、声音、视野、米痕与对局时间均遵循此规则。各系统读取配置，不新增重复配置或散落的可调参数。
- 每个新增参数应有简短注释，写明单位、用途和默认值。已有开发/正式模式差异应在配置中明确区分并保留切换方式。
- 新增或调整参数后，同步维护 `docs/GAME_BALANCE_CONFIG.md`，核对真实变量名、默认值、单位、作用和修改注意事项与源码一致。
- 只集中管理可调玩法参数。地图坐标、状态枚举、数学常量，以及无需调节的算法和视觉实现常量可留在对应模块；若某实现常量变成设计调节项，再迁入 `GAME_CONFIG`。
- **不得修改已验收的正式平衡值**（除非有用户明确批准的任务）；调试用的临时覆盖不得回写正式配置。

## 视觉表现与玩法逻辑分离

- 玩家和 AI 共用 `IDLE / WALK / RUN / EAT / STARTLED / FALL / STUN / INTERACT / CAPTURE` 角色动作接口；动作由既有玩法状态单向驱动，经独立 `CharacterActionView` 表现。正式 Q 版角色与动作资源尚未导入；后续通过独立表现层和预留的 GLB / AnimationMixer 接口替换白模表现，不让动画反向改写速度、碰撞、进食或抓捕规则。

- 声音感知计算由 `PerceptionSystem` 负责；声音场景效果由 `SoundVisualView` 负责，HUD 由 `ThreeGame` / CSS 显示。
- 后续替换声音提示美术时，优先调整 `SoundVisualView` 的几何体、材质、纹理，以及 HUD 图标与 CSS；声音距离、遮挡、方向等玩法计算保持在感知系统，不随美术替换改动。
- 正式声音 UI 资源建议放在 `public/assets/ui/sound/`，场景声音 VFX 建议放在 `public/assets/vfx/sound/`。这些是未来建议目录，本规则不要求现在创建。
- 新增同类视觉效果时，尽量通过独立 View / UI 模块接入；美术资源路径不要写进 `PerceptionSystem`。

## 通用代码架构约束

- **角色碰撞与移动**：角色使用 XZ Circle Footprint、环境使用 AABB，以 Circle-vs-AABB、Axis-Separated Movement 与 Wall Sliding 解析碰撞；Sprint 使用同一规则。**不要轻易恢复 Player Box / AABB Footprint**——方形碰撞体在门框与墙角斜向移动时容易卡脚。最终角色移动始终走 `CollisionWorld`，AI 不得瞬移或绕过实体碰撞。
- **单一权威来源**：同一份事实只保留一处权威定义——地图数据以 `src/three/map/apartmentMap.ts` 为准（不在别处复制坐标表）；检查点与版本一律用 `git log -1` / `git ls-remote` 查询（不写死「当前」SHA）；可调数值见「统一数值管理规则」。
- **系统职责边界**：门状态唯一来源是 `DoorSystem`；大米进度与进食规则由 `RiceField` / `RiceSystem` 持有；感知（声音、Vision / Last Seen、米痕）由 `PerceptionSystem` 负责；导航由 `NavigationSystem` 提供，但移动仍受 `CollisionWorld` 约束；两套 AI 不得私建第二套同类计时或直接判胜。

## 输入与暂停长期规则

- Esc 是统一 Pause Menu 入口；菜单提供 Continue、Restart、Return to Faction Select，开发模式可提供“切换主控阵营”。
- `selectedFaction` 是正式主控及声音、Vision、Last Seen、Rice Trace 的信息观察者，相机始终跟随它。开发模式鼠标点角色只改变临时 WASD 输入目标；Esc 菜单切换正式主控时同步切换镜头、信息观察者及默认输入目标，不重开或重置对局。
- `development.directHotkeysEnabled` 默认保持 `false`；正常正式对局中不启用裸 R / M / Tab，避免误触。需要调试切换时从暂停菜单进入。

## 日志字段

阶段收尾或重要事件日志记录日期、任务/阶段、实际完成内容、适用的测试与验收结果、已知问题及 Git 结果。新增/修改/删除文件、依赖变化、失败经过和下一步建议按任务适用性记录；推送失败必须如实说明。日志只记录实际发生的内容。

## Git 与安全边界

- 推送遇到认证、权限、冲突或被拒绝：立即停止，不使用密码，不自行创建 Token，不强推，不删除历史，并向用户提供完整错误。
- 不删除用户现有文件，除非任务明确要求；禁止重写 Git 历史与强制推送，完整的破坏性操作清单见前置条件 1。
- 不擅自更换技术栈、删除依赖或修改玩法规则；`docs/AGENT_LOG.md` 的追加与不可回改规则见前置条件 11。

## 全项目通用开发规则与执行规范

> 适用范围：本节的通用规则适用于本项目**所有开发阶段**（含未来尚未规划的新阶段、新子阶段、DEV 工具轮与专项任务），除用户当次明确豁免外长期有效。编号（前置条件 1、2、7–11）是**稳定 ID、不代表执行顺序**，保留原编号是为了不与既有文档引用脱节；原前置条件 3–6（DEV-A、DEV-B、S7C-1B、S7C-2 / 2b / 3 的专属要求）已迁出本文件，去向见下方「二」。
>
> 本文件**不维护阶段进度、待办清单与授权状态**：当前状态见 `docs/DEEPSEEK_HANDOFF.md`，历史见 `docs/AGENT_LOG.md`。

### 一、通用规则

#### 前置条件 1：Git 基线与工作区保护

- 每轮开始先检查：当前分支；`HEAD` 与 `origin/main`；`git status`；未提交文件及其归属；是否存在正在进行的合并或变基（`.git/MERGE_HEAD`、`REBASE_HEAD`、`CHERRY_PICK_HEAD`、`rebase-merge`、`rebase-apply`）。
- 当前稳定检查点**通过 `git log` 查询**（见 `docs/DEEPSEEK_HANDOFF.md` §2；本节不复制具体 SHA，避免两处维护同一份真相）。**不得为了开始新任务而重置、覆盖或清理用户文件**（禁止 `reset --hard`、`clean -fd`、`checkout .`、`restore .`、force push、删除或重写历史）。
- 永久排除（不得提交）：`.trae/`、`.dsh-meow/`、临时日志、`dist/`、本机个人配置。`.trae/` 与 `.dsh-meow/` 是用户资料，**不得提交，也不得读取、删除或暂存**。
- 未经用户明确批准，不得 commit、push、tag 或强制推送；先报告、后执行。**禁止改写任何已推送的 Git 历史**（含对已推送提交的 `--amend`、rebase、`reset --hard` 与强制推送）；**尚未推送的本地提交，只有经过用户明确批准，才允许用 `git commit --amend` 修正**。

#### 前置条件 2：开发阶段授权

- 任何阶段、子阶段、DEV 工具轮或专项任务，都**必须先获得用户明确批准**才能开始实施。
- **不得把设计文档里的建议值、候选清单、计划、或此前生成过的执行提示词当成已授权**；用户未点名批准的内容不构成授权。
- 没有用户明确批准，不得自动进入后续阶段，不得扩充本轮范围，也不得提前实现「未来可能需要」的功能。
- **未获授权的阶段不得在文档里被写成「进行中」「正在开发」或「已完成」**。
- 各阶段当前的授权状态见 `docs/DEEPSEEK_HANDOFF.md`；阶段专属的开工前置条件见本节「二、阶段专属开工要求」。

#### 前置条件 7：测试与人工验收

**游戏代码开发阶段必须执行** `npm test`、`npm run build`、`git diff --check`（`npm run build` 已含 `tsc --noEmit`，不必重复运行），并明确本轮范围、报告未验证的浏览器交互、由用户确认必要的人工验收、得到授权后才建立 Git 检查点。**纯文档或纯 Git 任务**（含仅有文档改动的轮次）按适用性执行检查，并说明未运行游戏测试的原因；**不得因此降低游戏代码开发的测试要求**。

- **自动化测试通过不等于浏览器人工验收通过**；**HTTP 200 不等于交互测试成功**。
- **阶段 Gate = PASS 的权威定义**（验收 + 日志 + commit + push 全部完成）与归档要求**见前置条件 10**，本节不重复。

#### 前置条件 8：开发环境

- 唯一默认开发入口：`http://127.0.0.1:5173/`。`vite.config.ts` 已固定 `host = 127.0.0.1`、`port = 5173`、`strictPort = true`，端口被占用时直接报错退出，**不静默切换到 5174 等端口**。
- 启动前先检查本项目服务器是否存在，已有则复用、不重复启动；**不得随意终止其他 Node.js 进程**。

#### 前置条件 9：已验收功能保护

**适用范围：任何涉及地图、导航、AI 或 DEV 工具的改动**（含未来尚未规划的阶段）。任何改动都不得破坏已通过 Gate 的功能；**通过 Gate 后即进入受保护状态，不得擅自修改其行为**。当前受保护清单与两条长期禁令（新增按钮不得覆盖原 DEV 入口；READY 计时不得接 PLAYING 冻结时间源）见 `docs/DEEPSEEK_HANDOFF.md`「当前受保护功能清单」；该清单随每个通过 Gate 的阶段扩展。

#### 前置条件 10：Git 归档与提交报告

- **阶段 Gate = PASS 的权威定义**：需要「验收通过 + 日志记录 + commit + push 成功」全部完成；明确规定不创建 Tag 的阶段不以 Tag 作为完成条件，**Tag 只在用户明确要求时创建**。其他章节只引用本条，不重复定义。
- 提交前先复核暂存清单（`git diff --cached --name-status` / `--stat`），**只暂存本阶段范围内的文件**；发现无关变更或远端出现新提交，立即停止并报告。
- 推送成功后报告**完整提交编号**，并确认 `HEAD` 与 `origin/main` 一致、工作区只剩预期内容（禁止 force push 与改写已推送历史的完整清单见前置条件 1）。
- 只有**尚未推送**的本地提交才允许在用户批准后用 `git commit --amend` 修正；已推送历史一律不动。
- 提交说明写清本轮范围与阶段；不使用「未提交 / 未推送」这类提交后会立刻变成假话的措辞。
- 提交与推送的授权要求见前置条件 1 与前置条件 2。

#### 前置条件 11：文档维护

- 每个正式开发阶段结束后，按需更新 `docs/DEEPSEEK_HANDOFF.md`，在 `docs/AGENT_LOG.md` 末尾追加实际结果，并同步本轮实际涉及的阶段设计文档。**只有长期开发规则、架构约束或 AI 协作规范发生实质变化时才更新 `AGENTS.md`**；普通阶段进度、测试数量、临时问题和待批准任务不得写入其中。只修正过期内容或新增必要小节，**不整篇重写**，也不把同一份内容复制到第二处。
- `docs/AGENT_LOG.md` 是**追加式历史日志**：只在文件末尾追加，**不删除、不改写旧记录**，且只写实际完成的内容（计划中或未授权的功能不得写成已完成）；旧条目与当前状态不一致时用新条目说明，不回改历史。
- **检查点与版本号一律通过 Git 查询获取**（`git log -1`、`git ls-remote origin refs/heads/main`），**不得在任何文档里写死「当前」SHA**——否则该文档会在被提交的那一刻自我过期。文档只记录不会随新提交变化的历史事实（如某阶段的 Gate 落点）。
- 文档与代码/进度冲突时，**先向用户报告具体冲突，再同步**；不自行替用户批准尚未确定的参数或设计。
- 纯文档轮的检查口径见「每次任务的执行顺序与精简执行模式」第 3 条（按适用性检查、只跑 `git diff --check` 并说明未跑测试与构建的原因）；**不因为文档同步擅自开发新功能或修改 `GAME_CONFIG`**。
- 交付文档成果时展示**文件清单、关键差异与检查结果**，经用户确认后再建立文档检查点。
- **文件职责**：本文件只放长期规则；当前状态与待办放 `docs/DEEPSEEK_HANDOFF.md`；历史只放 `docs/AGENT_LOG.md`（只追加）；阶段专有参数、决策与验收要求放对应阶段设计文档。不要在本文件维护第二份阶段进度表。

### 二、阶段专属开工要求

> 本节**不保存具体阶段的参数与清单**（避免与阶段设计文档产生第二份真相）。开始任一阶段前按下列通用做法执行。

- **通用做法**：先阅读该阶段的设计文档，**逐项确认其中所有「待批准」项目都已获得用户明确批准**，再开始实施；设计文档里的建议值、计划或候选清单**都不构成授权**（见前置条件 2）。
- 各阶段专属要求的位置：
  - **S7C-1B / S7C-2 / S7C-2b / S7C-3** → `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（§3.5 开工前置、§4 S7C-2、§5 S7C-3、§6 待逐项批准参数）。
  - **DEV 场景热编辑器 / 双阵营调试冻结**（V1 已完成；后续扩展）→ `docs/DEV_SCENE_EDITOR_DESIGN.md`。
  - **DEV-A / DEV-B** 是彼此独立的 DEV 工具线；DEV-A 设计见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`，DEV-B 设计见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`。任何后续扩展仍须按前置条件 2 单独获得用户授权，当前状态见 `docs/DEEPSEEK_HANDOFF.md`。
  - 其他已通过 Gate 的阶段 → 其阶段设计文档 + 前置条件 9 的受保护清单。
- 原前置条件 3–6 的迁移去向：3（DEV-A 设计确认）与 4（DEV-B 技术审计）→ `docs/DEEPSEEK_HANDOFF.md`「待批准提案与专属开工要求」；5（S7C-1B 参数批准）→ `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §3.5 / §6；6（地图数据与随机化）→ `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §5 / §6 第 15–18 项。

## Build Environment

- `npm run build` 保持 `tsc --noEmit && vite build`，构建失败必须返回非零。`dist/` 是被 Git 忽略的可重建产物；不要在 `public/assets/` 放置仅用于保留空目录的 `.gitkeep`，Vite 会将其复制到 `dist/assets/`。
- 遇到 `dist` 的 `EPERM` 时，先核对仓库是否处于当前 Codex 可写工作区。已验证：本仓库位于可写根目录外时，受限执行会在 `dist/assets/.gitkeep` 报 EPERM；同一原始构建命令获得项目目录写入权限后连续三次成功。这是执行环境的写入边界，不能据该报错直接认定 Windows 文件占用；文件系统授权不等于 Windows 管理员提权。
- 再检查是否有能明确归属本项目的 Vite dev / preview 进程；需要停止时优先正常中断，不结束身份不明的进程。开发服务器与生产输出已验证可同时运行，无需仅因浏览器预览打开就停止服务。若获得项目写入权限后仍报 EPERM，再检查文件属性、具体路径和进程占用，并报告；不修改 Windows ACL、不使用 `takeown`、`icacls`、管理员提权或强杀不明进程。
- 本地开发服务器固定使用 `npm run dev` 打开 `http://127.0.0.1:5173/`（用 IP，不用 `localhost`）。端口固定方式（根目录 `vite.config.ts`）、端口被占用时的行为、进程复用与保护规则见前置条件 8。

## 状态维护规则

- 项目进度与阶段状态**记录在 `docs/DEEPSEEK_HANDOFF.md`**（「阶段进度」与「当前状态」），**不在本文件维护**；按时间追加的历史在 `docs/AGENT_LOG.md`。
- 只有某阶段满足前置条件 10 的「阶段 Gate = PASS 权威定义」（含其中关于 Tag 的规定）之后，才允许把该阶段写进 `docs/DEEPSEEK_HANDOFF.md` 的阶段进度，并在 `docs/AGENT_LOG.md` 末尾追加记录。
- 更新时只把刚完成的阶段标为已完成、把下一阶段设为当前下一阶段；**不得改写其他规则、删除历史阶段信息、跳过阶段，或把未通过 Gate 的阶段提前写成已完成**。
- 普通小任务和 Bug 修复不触发阶段状态更新；`docs/AGENT_LOG.md` 的旧记录不得删除或改写。
- 文档的标题、章节分组与文件职责调整**都不改变实际项目进度**；项目进度的唯一依据是 `docs/DEEPSEEK_HANDOFF.md` 的阶段进度与 `docs/AGENT_LOG.md`。**已完成阶段与尚未授权阶段必须继续明确区分**：**尚未授权 ≠ 进行中**，候选计划与待批准提案都不得被写成正在开发或已完成。

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
