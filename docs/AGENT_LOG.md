# 《谁吃了我的米》Agent 工作日志

> 本文件记录实际完成并验证的工作，不是 `AGENTS.md` 指令文件。后续按日期追加；计划中的功能不写成已完成。

## 项目状态

- 目录：项目根目录 `.`
- 阶段：项目初始化与第一个最小运行工程已完成
- 技术栈：TypeScript、Vite、Phaser；Tiled 暂未接入
- Git：`main`；最新提交 `8a49428ba8dc6843c6dc04fe1384d2ae7e9d2fc1 feat: create first playable prototype`

## 2026-09-19｜最小运行工程

- 在项目根目录建立 Vite + TypeScript + Phaser 工程和规划目录；目前只实现 `GameScene.ts`、`gameConfig.ts`、`main.ts`。
- 页面显示灰色背景、蓝色方块和三面灰墙；WASD/方向键移动，不能穿墙，Esc 暂停与继续，刷新后重置。
- `npm run build` 通过。浏览器实测移动、碰撞、暂停、恢复、刷新均通过，无页面运行时错误。
- 构建有 Phaser 包体积超过 Vite 默认提示阈值的非阻断警告。
- 安装时默认 npm 缓存写入受限，改用项目内 `.npm-cache/` 并将其忽略；测试中修正了碰撞体尺寸和 Esc 监听。

## 2026-09-19｜Git 记录

- 初始化本地仓库与 `main` 分支；`.gitignore` 忽略 `node_modules/`、`dist/`、环境文件、日志及常见临时文件。
- 用户确认后将首次提交说明改为 `feat: create first playable prototype`；改写前后文件树相同，未跟踪 `node_modules/` 或 `dist/`。
- 没有创建远程仓库，也没有 push。

## 尚未实现

大米、人类角色、AI、门、冲刺、音频、正式美术、Tiled 地图和脉冲锁尚未开始。当前版本仅是最小运行工程。

## 启动与后续记录

在项目目录运行 `npm run dev`；使用 `npm run build` 检查编译和构建。后续每阶段追加“日期｜阶段”，记录完成内容、验证结果、问题处理、提交和未完成事项。

## 2026-09-19 23:37 +08:00｜建立项目级 Codex 协作规则

- 任务名称：建立并完善项目级 `AGENTS.md`。
- 当前开发阶段：最小运行工程已完成；下一阶段为“一房一米 / 单份大米持久进度”内部切片，本次未进入该阶段。
- 本次目标：建立长期固定协作规则，只修改协作文档，不修改游戏功能代码。
- 实际完成：新增项目级 `AGENTS.md`，写入项目基线、ChatGPT 与 Codex 分工、任务前检查、范围控制、适用测试、日志只追加、Git 提交与推送、安全边界、阶段 Gate 和最终汇报格式；本条记录仅追加在历史日志末尾。
- 新增文件：`AGENTS.md`。
- 修改文件：`docs/AGENT_LOG.md`（仅末尾追加）。
- 删除文件：无。
- 依赖变化：无。
- 测试结果：`npm run build` 通过（其中包含 `tsc --noEmit`）；`git diff --check` 通过；核对差异仅涉及本次两个文档。纯文档任务未重复运行游戏交互测试。
- 已知问题：构建仍有 Phaser 产物超过 Vite 500 kB 提示阈值的非阻断警告；无游戏功能变更。
- 下一步建议：本次文档验收后，再由用户单独下达“一房一米 / 单份大米持久进度”切片任务。
- Git commit 信息：`docs: establish project Codex collaboration rules`（本条记录随该提交纳入版本控制）；推送结果以本次最终汇报为准。

## 2026-09-20 15:20 +08:00｜S2 一房一米待人工验收

- 任务名称：S2 一房一米。
- 当前开发阶段：S2 实现与测试；Gate 尚未全部通过，不进入 S3。
- 本次目标：一份大米、0.4 秒准备、60 秒独立进度，以及中断后返回续吃。
- 实际完成内容：在现有灰盒场景中加入一份大米及调试文字；实现进食准备、进度累计、中断保留、完成封顶；保留 S1 移动、碰撞和 Esc 暂停。
- 新增文件：`src/systems/RiceSystem.ts`、`tests/rice.test.mjs`。
- 修改文件：`src/config/gameConfig.ts`、`src/scenes/GameScene.ts`、`package.json`、`docs/AGENT_LOG.md`（仅追加本条）。
- 删除文件：无。
- 依赖变化：无；使用现有 Node 的测试功能。
- 测试结果：S1 基线构建通过；S2 `npm test` 三项通过，`npm run build` 通过（含 TypeScript 检查）；浏览器可加载灰盒、大米及调试文字，Esc 暂停和恢复可见。核心“持续吃约 10 秒→离开→返回续吃”、完整 60 秒与持续移动碰撞尚未完成浏览器人工实测。构建仍有既有的大包体积非阻断提示。
- Gate 验收结果：未全部通过；等待核心人工验收，因此未提交、未推送、未创建 `v0.0.2` Tag。
- 失败步骤：浏览器控制工具只能发送短按键，不能可靠保持 E 与移动键，无法完成持续进食及返回的人工验收。
- 错误摘要：不是游戏运行错误；自动化输入能力不足。首次基线构建曾因项目目录写权限而无法清理 `dist`，获准写入后同一构建通过。
- 已尝试方法：浏览器短按键、连续短按键、画面检查及 Node 单元测试；短按键不能替代持续按键的人工验收。
- 当前项目是否仍可运行：可以；开发服务器和生产构建均已成功启动/生成。
- 已知问题：完整 S2 Gate 尚待人工确认；未发现已证实的游戏逻辑错误。
- 下一步建议：在浏览器手动完成 10 秒离开返回、准备取消、移动中断、暂停冻结和 60 秒封顶验收；全部通过后再提交、推送并创建里程碑 Tag。
- Git commit 信息：本次未提交。

## 2026-09-20 15:27 +08:00｜S2 一房一米人工验收通过

- 任务名称：S2 一房一米收尾。
- 当前开发阶段：S2 Gate 验收完成；不进入 S3。
- 本次目标：记录人工验收结果，完成 S2 阶段收尾。
- 实际完成内容：用户已在浏览器中完成 S2 人工验收；单份大米持久进食进度正常。10 秒中断 → 离开 → 返回 → 从原进度继续：通过；移动打断：通过；暂停冻结：通过；60 秒完成、状态显示“已完成”且进度不超过 60 秒：通过。原有移动、碰撞、暂停未发现异常。
- 新增文件：无（S2 实现文件已记录于上一条日志）。
- 修改文件：`docs/AGENT_LOG.md`（仅在末尾追加本条；游戏功能代码未改）。
- 删除文件：无。
- 依赖变化：无。
- 测试结果：`npm test` 重新运行，3 项通过；`npm run build` 重新运行，通过（包含 TypeScript 检查）。浏览器人工测试由用户完成并确认通过。
- Gate 验收结果：S2 最终状态：通过；全部 Gate 通过。
- 已知问题：无已证实的 S2 功能 BUG；构建仍有 Phaser 产物超过 Vite 500 kB 的非阻断警告。
- 下一步建议：仅完成本阶段提交、推送与 `v0.0.2` 里程碑；S3 等待单独指令。
- Git commit 信息：计划 `feat: add persistent rice progress`；提交与推送结果以本次最终汇报为准。

## 2026-09-20 15:55 +08:00｜S3 最小完整对局待人工验收

- 任务名称：S3 最小完整对局。
- 当前开发阶段：S3 实现与自动化检查完成；Gate 尚未全部通过，不进入 S4。
- 本次目标：在 S2 基础上完成双方可获胜、结算和重开的最小对局闭环。
- 实际完成内容：增加橙色人类测试方块与 IJKL 控制；增加 READY / PLAYING / PAUSED / FINISHED 状态、3 秒准备、对局计时、0.35 秒持续接触抓捕、单份测试大米完成胜利、同帧固定大米优先、调试结算和 R 重开。FINISHED 后场景更新直接返回，双方速度归零；Esc 不能恢复 FINISHED。未加入 AI 或后续玩法。
- 新增文件：`src/systems/GameStateSystem.ts`、`tests/game-state.test.mjs`。
- 修改文件：`src/config/gameConfig.ts`、`src/scenes/GameScene.ts`、`package.json`、`docs/AGENT_LOG.md`（仅追加本条）。
- 删除文件：无。
- 依赖变化：无。
- 测试结果：S2 基线 `npm test` 与 `npm run build` 均通过；S3 修改后 `npm test` 8 项通过、`npm run build` 通过（含 TypeScript 检查），`git diff --check` 通过。浏览器画面确认人类方块、READY→PLAYING、计时、Esc 暂停冻结和恢复；浏览器控制工具不能可靠持续按键，尚未完成双方各赢一局与 R 重开的实际操作验收。构建有既有的包体积非阻断警告。
- S2 回归测试结果：原有 3 项 RiceSystem 测试全部通过；新增联动测试验证约 10 秒中断后续吃及 60 秒完成。真实浏览器中的 S2 持久进度本次尚未重新人工验证。
- S3 Gate 验收结果：待人工验收，尚未判定是否通过；核心“双方各赢一局、结算后重开再打一局”尚待确认。因此未提交、未推送、未创建 `v0.0.3`。
- 已知问题：无已证实的 S3 功能 BUG；人工 Gate 待确认。`AGENTS.md` 的“当前下一开发阶段”仍写 S2，属于历史状态描述，本次按要求不修改。
- 下一步建议：人工完成短暂接触、持续抓捕、吃满 60 秒、结束后冻结、R 重开与连续两局；全部通过后再提交、推送并创建阶段 Tag。不要进入 S4。
- Git commit 信息：本次未提交。

## 2026-09-20 16:03 +08:00｜S3 人工验收通过与开发测试时长调整

- 任务名称：S3 最小完整对局收尾；开发测试参数调整。
- 当前开发阶段：S3 Gate 已由用户人工验收通过；不进入 S4。
- 本次目标：保留正式单份大米 60 秒设计值，当前开发阶段改用可切换的 5 秒测试值，复验后完成 S3 收尾。
- 实际完成内容：用户报告 S3 人工验收全部通过、无异常；在现有 `src/config/gameConfig.ts` 中明确保留 `production = 60_000 ms` 与 `development = 5_000 ms`，当前 `RICE_TIMING_MODE = 'development'`，RiceSystem 内未写死 5 秒。切换该模式为 `production` 即恢复正式 60 秒。浏览器调试画面已确认显示大米上限 `5.0` 秒。
- 新增文件：无（S3 新增文件见上一条日志）。
- 修改文件：`src/config/gameConfig.ts`、`tests/game-state.test.mjs`、`docs/AGENT_LOG.md`（仅末尾追加本条）。
- 删除文件：无。
- 依赖变化：无。
- 测试结果：`npm test` 9 项通过；新增测试确认正式 60 秒值保留、开发 5 秒完成且中断进度保留并触发 DeepSeek 娘胜利；原有 RiceSystem 测试及 S3 抓捕、暂停、胜负、重置、两局测试均通过。`npm run build` 通过（含 TypeScript 检查）；浏览器已确认显示 `0.0 / 5.0 秒`。本次 5 秒调整后的浏览器持续按 E 实测未由代理完成，原因是浏览器工具不能可靠长按；5 秒完成由自动化逻辑测试确认。构建仍有既有的包体积非阻断警告。
- S2 回归测试结果：3 项 RiceSystem 测试全部通过，0.4 秒准备、中断续吃及完成封顶逻辑未改。
- S3 Gate 验收结果：通过；用户已人工验收原 60 秒 S3 闭环全部通过，本次仅通过配置调整开发测试时长，自动化回归通过。
- 已知问题：无已证实的功能 BUG。发布前必须将 `RICE_TIMING_MODE` 改为 `production`，恢复正式 60 秒，并重新测试。`AGENTS.md` 当前阶段描述仍停留在 S2，本次按要求不修改。
- 下一步建议：完成 S3 commit、push 与 `v0.0.3` Tag 后停止；S4 等待单独指令。
- Git commit 信息：计划 `feat: add minimal complete match flow`；提交与推送结果以最终汇报为准。

## 2026-09-20 16:12 +08:00｜更新 AGENTS.md 项目阶段状态

- 任务名称：更新 AGENTS.md 项目阶段状态。
- 当前开发阶段：S3 已完成、Gate = PASS；S4 追逐原型待开始。
- 本次目标：修正长期项目进度记录，并建立正式阶段完成后的状态维护规则。
- 实际完成内容：将 `AGENTS.md` 原有 S2 待开发描述更新为 S1、S2、S3 已完成及 S4 待开始；记录 `v0.0.1`、`v0.0.2`、`v0.0.3`，正式大米时长 60 秒与当前开发测试 5 秒，并注明发布前恢复正式值。新增“阶段状态维护规则”：仅在 Gate、commit、GitHub push、阶段 Tag 创建和推送均完成后更新阶段状态；不因普通小任务或 Bug 修复频繁改动。
- 新增文件：无。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`（仅末尾追加本条）。
- 删除文件：无。
- 依赖变化：无。
- 游戏功能代码修改：无。
- 测试结果：纯文档维护，无需游戏功能测试；核对 Git 差异仅涉及预期文档，并执行 `git diff --check`。未运行 `npm test` 或 `npm run build`。
- 已知问题：无本次文档维护阻断问题。
- 下一步建议：等待用户单独下达 S4 追逐原型任务；本次不开始 S4。
- Git commit 信息：计划 `docs: update project stage status`；提交与推送结果以最终汇报为准。

## 2026-09-20 16:41 +08:00｜S4 追逐原型人工验收通过

- 任务名称：S4 追逐原型。
- 当前开发阶段：S4 体验 Gate = PASS；不进入 S5。
- 本次目标：验证人类追逐与 DeepSeek 娘阶段式冲刺能否形成基本追逃和风险反转。
- 实际完成内容：实现 Space 单次触发、固定 2.5 秒冲刺；仅有有效方向输入时启动，开始后即使松开方向键仍沿最近有效方向持续奔跑，期间可改变方向，重复按 Space 不刷新时长。冲刺开始时依据单份测试大米累计进度锁定风险：低于 30% 为 SAFE，结束后正常恢复；达到或超过 30% 为 FALL_ON_END，结束必摔并眩晕约 1 秒。眩晕期间不能移动、冲刺或吃米。人类基础速度设为 DeepSeek 娘普通速度的 1.08 倍，冲刺速度为普通速度的 1.6 倍；S3 的 0.35 秒抓捕不变。增加旋转、变色和开发调试 HUD；未加入能量系统、AI、门等后续功能。
- 新增文件：`src/systems/SprintSystem.ts`、`tests/sprint.test.mjs`。
- 修改文件：`src/config/gameConfig.ts`、`src/scenes/GameScene.ts`、`package.json`、`docs/AGENT_LOG.md`（仅末尾追加本条）。
- 删除文件：无。
- 依赖变化：无。
- 测试结果：`npm test` 21 项全部通过（含 S2/S3 回归及 S4 冲刺、阈值、强制奔跑、暂停、眩晕、重置测试）；`npm run build` 通过（含 TypeScript 检查），`git diff --check` 通过。用户已在浏览器人工确认前期安全、后期必摔、松键仍奔跑、转向、原地与重复按键保护、眩晕恢复、人类速度差、抓捕、暂停、重开及 S2/S3 回归均正常。
- 阈值与正式规则：当前开发测试单份大米为 5 秒，30% 阈值为累计进食 1.5 秒；正式设计仍为每份 60 秒，Beta / Release Candidate 前必须切回并复测。
- Gate 验收结果：S4 体验 Gate = PASS，由用户明确确认；未发现本阶段阻断问题。
- 已知问题：无已证实的功能 BUG；Vite 对 Phaser 大包仍有非阻断警告；正式发布前须恢复 60 秒大米时间。
- 下一步建议：完成本阶段 commit、push 与 `v0.0.4` Tag 后停止；是否进入 S5 完整灰盒地图由用户另行决定。
- Git commit 信息：计划 `feat: add staged sprint chase prototype`；提交与推送结果以最终汇报为准。

## 2026-09-20 20:49 +08:00｜S4.5 Three.js 技术迁移人工验收通过

- 任务名称：S4.5 Phaser → Three.js 3D 技术迁移验证与阶段收尾。
- 当前开发阶段：S4.5 Gate = PASS；不开始 S5。
- 本次目标：在保留 S1–S4 玩法逻辑的前提下验证真实 3D 网页技术路线。插入 S4.5 的原因是先确认 3D 场景、等距相机、碰撞与既有追逃对局可以完整运行，再决定是否投入 S5 完整 3D 地图。
- 实际完成内容：Three.js 0.186.0 成为主渲染层，接管 Scene、WebGLRenderer、OrthographicCamera、浏览器输入、requestAnimationFrame 循环和游戏运行。世界采用 Y 高度、XZ 地面坐标；建立一间灰盒 3D 房间、墙体、两名方块角色与一份大米，用 Box3 和边界约束实现 3D 碰撞。相机保持固定等距/斜俯视角并精确跟随当前玩家，使其基本位于屏幕中心；Camera-Relative Movement 将 WASD/方向键及 IJKL 调试方向转换到 XZ，支持对角归一化及冲刺方向延续。
- 阵营与对局流程：新增 DeepSeek 娘/人类阵营选择和 FACTION_SELECT 状态；ControlledCharacter 与 CameraTarget 随阵营切换。R 在 FINISHED 后快速重开并保留阵营；M 或结算按钮返回阵营选择，清空上一局状态后无需刷新即可改选另一阵营。正常 PLAYING 时 M 不退出。
- 保留的逻辑：GameState 的 READY/PLAYING/PAUSED/FINISHED、0.35 秒持续抓捕和胜负结算；RiceSystem 的 0.4 秒准备、持久进度和中断恢复；SprintSystem 的 2.5 秒阶段式冲刺、30% 风险阈值、强制持续奔跑、摔倒与 1 秒眩晕；暂停冻结与重开。当前开发测试单份大米为 5 秒，正式设计仍为 60 秒，发布前必须切回并复测。
- Phaser 状态：旧 GameScene 不再被运行入口引用；人工 Gate 通过后删除该闲置场景并卸载 Phaser。现有运行源码和依赖树均无 Phaser 引用。
- 新增文件：`src/style.css`、`src/three/ThreeGame.ts`、`src/three/InputManager.ts`、`src/three/CollisionWorld.ts`、`src/three/CameraRelativeMovement.ts`、`src/three/LocalControl.ts`、`tests/collision-world.test.mjs`、`tests/camera-controls.test.mjs`。
- 修改文件：`index.html`、`package.json`、`package-lock.json`、`src/config/gameConfig.ts`、`src/main.ts`、`src/systems/GameStateSystem.ts`、`src/systems/RiceSystem.ts`、`docs/AGENT_LOG.md`（仅追加本条）。
- 删除文件：`src/scenes/GameScene.ts`（已闲置的 Phaser 场景）。
- 依赖变化：新增 `three@0.186.0` 与 `@types/three@0.186.0`；移除 `phaser`，未引入物理引擎。
- 测试结果：`npm test` 30 项全部通过，含原有 Rice/GameState/Sprint 回归及 3D 碰撞、屏幕方向、阵营切换、相机目标、FACTION_SELECT、R/M 重开与状态清理测试。`npm run build` 通过，包含 TypeScript 检查；移除 Phaser 后重新运行两项检查仍通过。用户人工确认 3D 场景、相机与屏幕方向、双阵营控制、碰撞、进食、冲刺风险、抓捕、暂停、双向胜负、R/M 重开及连续第二局全部正常；S4.5 人工验收 通过。
- 已知问题：Vite 仍提示主构建产物约 535 kB，超过 500 kB 提示线；不阻断运行。正式发布前仍需恢复 60 秒大米设计时长并复测。
- 下一步建议：完成本次 commit、push 和 `v0.0.5-tech3d` Tag 后，可由用户另行决定进入 S5 完整 3D 灰盒地图；`AGENTS.md` 留待用户单独任务更新。
- Git commit 信息：本条追加时尚未提交；计划 `refactor: migrate gameplay prototype to threejs`，实际提交和推送结果以最终汇报为准。

## 2026-09-20 21:04 +08:00｜更新 Three.js 主技术栈与 UE5.3 平行版本预留

- 任务名称：维护 AGENTS.md 的当前技术栈、项目阶段和未来 UE5.3 边界。
- 当前开发阶段：S4.5 Gate、commit、push 和 `v0.0.5-tech3d` Tag 均已完成；S5 完整 3D 灰盒地图待用户明确启动。
- 本次目标：仅更新 `AGENTS.md` 和追加本日志，不修改游戏功能代码，不开始 S5 或 UE5.3 开发。
- 实际完成内容：将 Web 主技术栈更新为 Vite + TypeScript + Three.js + HTML/CSS，记录 Phaser 已从当前运行源码及依赖移除；将 S1、S2、S3、S4、S4.5 列为已完成，下一阶段写为 S5。补充现行大米 60 秒正式值/5 秒开发测试值、阶段式冲刺、30% 阈值、抓捕、相机相对移动和阵营重开摘要。新增 UE5.3 平行版本预留：Web 继续为主版本，两版可共享设计规范但不共享运行时代码，预留 Cross-Version Gameplay Spec 概念、独立工程建议、概念映射及独立版本号规则；明确只有用户另行授权才可创建 UE 工程。
- 新增文件：无。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`（仅在末尾追加本条）。
- 删除文件：无。
- 依赖变化：无；Phaser 移除是上一项 S4.5 工作，本次只更新其文档状态。
- 测试结果：纯文档任务，不运行游戏功能测试；已读取当前 `package.json`、检查运行源码与阶段 Tag，核对差异仅涉及两份预期文档并执行 `git diff --check`。
- 已知问题：本次无功能改动；Web 构建超过 500 kB 的既有提示仍由 S4.5 记录。UE5.3 仅为未来预留，尚无工程。
- 下一步建议：等待用户明确下达 Web 版 S5 完整 3D 灰盒地图任务；不要因 UE5.3 预留跳过 Web 阶段。
- Git commit 信息：本条追加时尚未提交；计划 `docs: update threejs stack and reserve ue5 version`，实际提交和推送结果以最终汇报为准。

## 2026-09-21 10:19 +08:00｜S5 完整 3D 灰盒地图完成

- 任务名称：S5 完整 3D 灰盒地图正式收尾。
- 当前开发阶段：S5 Gate = PASS；本次不进入 S6A。
- 本次目标：完成住宅式 3D 灰盒地图、碰撞手感的人工 Gate 收尾，并记录可复现的最终地图规范。
- 实际完成内容：废弃旧等大房间九宫格布局，完成以住宅平面图为基准、游戏化放大的不规则公寓灰盒。地图包围盒约 `36 × 30` 世界单位，包含 10 个主要空间（客厅、厨房、储物间、餐厅、主卧、卫生间、主走廊、次卧、书房、玄关）及阳台、衣帽间两个附属空间。主走廊宽 5，典型门洞宽 2.0–2.6，最窄门洞宽 1.5，角色直径约 0.533；家具和门前后均按追逐通行尺度留出空间。
- 追逐环路：公共区“客厅 → 餐厅 → 厨房 → 客厅”；主卧区“主走廊 → 主卧 → 衣帽间 → 主走廊”；卧室区“主走廊 → 卫生间 → 次卧 → 书房 → 主走廊”。全图可遍历，关键区域有备用路径。
- 节点：14 个 RiceCandidate，每局无重复随机激活 5 个 Active Rice；18 个 DoorNode；DeepSeek 出生于玄关、Human 出生于厨房；5 个 HideSpot Placeholder（主卧衣柜、次卧床底、书房书柜、储物柜、衣帽间衣柜）。门与藏身的正式玩法仍未在 S5 实现。
- 系统适配：多份米的 `globalRiceProgressRatio` 用于 30% Sprint 风险判断；保留持久进食、0.4 秒准备、0.35 秒 Capture、Faction Select、Camera-Relative Movement、OrthographicCamera 跟随、R 快速重开、M 返回阵营选择与 Esc 暂停。当前开发单份大米为 5 秒；正式设计值为 60 秒，Beta / Release Candidate 前必须切回并重新测试。
- 碰撞：墙体、家具和门洞使用统一轻量碰撞；保留分轴碰撞，在外凸角接触时增加 Wall Sliding 切线响应，修复斜向持续输入在两段墙 L 型外凸角的卡脚。两轴均被真实阻挡时保持停止；移动分段防止 Sprint 高速穿透，Sprint 碰撞不提前结束持续时间或改变 30% 摔倒规则。
- 新增文件：`docs/MAP_SPEC.md`、`src/systems/RiceField.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`、`tests/apartment-map.test.mjs`。
- 修改文件：`package.json`、`tsconfig.json`、`src/config/gameConfig.ts`、`src/style.css`、`src/three/ThreeGame.ts`、`src/three/CollisionWorld.ts`、`tests/collision-world.test.mjs`、`docs/MAP_SPEC.md`、`docs/AGENT_LOG.md`。
- 删除文件：无。
- 依赖变化：无；未加入物理引擎或其他运行时依赖。
- 测试结果：`npm test` 48 项全部通过，覆盖地图布局/连通、14/5 米点、DoorNode、出生点、HideSpot、全局 30% 进度、相机相对移动、碰撞分轴滑动、四组斜向角点、家具、门洞、Sprint 防穿透与既有玩法回归。`npm run build` 通过，包含 TypeScript 检查。
- 人工验收结果：用户确认住宅布局、三条环路、节点、家具、全图可遍历、墙体与家具碰撞、外凸墙角滑动、门洞、Sprint、相机、Rice、30% 风险、Capture、Faction Select、R/M/Esc 与双方胜负均通过；S5 Gate = PASS。
- 已知问题：无已证实的功能、地图或碰撞阻断问题。Vite 仍提示主构建 bundle 约 556 kB，超过 500 kB 提示线，属于非阻断性能/构建提示；正式发布前仍需恢复 60 秒正式大米时长并重新测试。
- 下一步建议：可在用户单独授权后进入 S6A —— 正式大米循环；本次不得自行开始。
- Git commit 信息：计划 `feat: complete residential 3d greybox map`；提交、推送和 `v0.1.0-alpha` Tag 结果以本次最终汇报为准。

## 2026-09-21 10:26 +08:00｜更新 S5 完成后的项目状态

- 任务名称：更新 S5 完成后的 AGENTS.md 项目状态。
- 当前开发阶段：S5 已完成；S6A —— 正式大米循环待开始。
- 本次目标：在 S5 Gate、commit、push 和 Tag 完成后维护长期项目状态；不修改游戏功能代码，不开始 S6A。
- 实际完成内容：核对本地与 `origin` 的 `v0.1.0-alpha` 均存在，且均指向 S5 完成提交 `c197ef43c6d4708a11867429f2246eef754c0bff`。将当前主版本更新为 Web / Three.js 3D Alpha；将 S5 写入已完成阶段并将 S6A 设为当前下一阶段。记录住宅式 S5 灰盒、旧九宫格废弃、14/5 大米节点、DoorNode、出生点、HideSpot Placeholder、家具碰撞和 Wall Sliding 状态；明确 S6A 只是待授权的后续阶段。保留 UE5.3 `who-ate-my-rice-ue5` 的 Reserved / Planning 说明。
- 新增文件：无。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`（仅在末尾追加本条）。
- 删除文件：无。
- 依赖变化：无。
- 游戏功能代码修改：无；未开始 S6A，未修改 Web 运行代码或 UE5.3 平行仓库。
- 测试结果：纯文档维护任务；已核对当前分支、工作区、S5 提交以及本地/远程 `v0.1.0-alpha` 指向。未运行 `npm test` 或 `npm run build`，原因是未修改游戏代码。
- 已知问题：S5 已记录的 Vite 主构建 bundle 超过 500 kB 提示仍为非阻断问题。
- 下一步建议：等待用户单独授权后进入 S6A —— 正式大米循环；正式发布前仍须切回 60 秒大米设计时长并重新测试。
- Git commit 信息：本条追加时尚未提交；计划 `docs: update project status after s5`，实际提交和推送结果以最终汇报为准。

## 2026-09-21 15:51 +08:00｜S6A 正式大米循环人工验收通过

- 任务名称：S6A —— 正式大米循环正式收尾。
- 当前开发阶段：S6A Gate = PASS；本次不进入 S6B。
- 本次目标：记录正式大米循环、大米视觉、人类抓捕区域与开发调试控制的实现及人工验收结果，完成测试、提交和推送收尾。
- Gate：通过；用户已完成浏览器人工验收并确认通过。
- Rice：保留 14 个稳定 `RiceCandidate`，每局无重复随机激活 5 个 `Active Rice`；每份米拥有独立 `RiceState` 与持久进度；0.4 秒准备阶段不计入正式进度；中断后保留进度；完成值封顶；前 4 份不会提前胜利，完成 5 / 5 后触发 DeepSeek 娘胜利。当前开发测试时长为每份 5 秒，正式设计时长仍为每份 60 秒，发布前必须切回正式值并复测。
- Visual：每袋米只读取自身 `RiceState`，随进度连续降低高度与顶部鼓起程度；底部固定贴地，交互锚点不随形变漂移；完成后保留可见的扁平空袋；Restart 后全部恢复饱满状态。
- Global Progress：`globalRiceProgressRatio` 基于 5 份米总进度计算；既有 30% Sprint 风险阈值保持不变。
- Human Capture：Human 脚下使用基于 XZ 距离、半径 0.70 世界单位的 Capture Zone；DeepSeek 娘需连续约 0.35 秒处于有效范围内才完成抓捕；离开范围立即清零；墙体或有效家具阻挡时不累计；表现颜色根据实际进度连续由蓝到黄再到红；达到阈值触发 Human Win。
- 开发调试：开发模式可用 Tab 即时切换 `controlledFaction`；正式 `selectedFaction` 与调试控制目标分离；Camera 跟随当前 `controlledFaction`；切换不会重置比赛计时、Rice、Sprint、STUNNED 或 Capture 状态；Restart 后 `controlledFaction` 恢复为 `selectedFaction`。
- 回归：Sprint、STUNNED、Capture、Wall Sliding、Camera-Relative Movement、Faction Select、R 快速重开、M 返回阵营选择与 Esc Pause 均经自动测试及用户人工验收确认无明显回归。
- 新增文件：`src/three/CaptureZone.ts`、`src/three/RiceView.ts`、`tests/capture-zone.test.mjs`、`tests/rice-field.test.mjs`、`tests/rice-view.test.mjs`。
- 修改文件：`package.json`、`src/config/gameConfig.ts`、`src/systems/GameStateSystem.ts`、`src/systems/RiceField.ts`、`src/systems/RiceSystem.ts`、`src/three/CollisionWorld.ts`、`src/three/InputManager.ts`、`src/three/LocalControl.ts`、`src/three/ThreeGame.ts`、`tests/camera-controls.test.mjs`、`tests/game-state.test.mjs`、`docs/AGENT_LOG.md`（仅在末尾追加本条）。
- 删除文件：无。
- 依赖变化：无新增运行时或开发依赖；仅扩展现有测试脚本覆盖范围。
- 测试结果：`npm test` 72 项全部通过；`npm run build` 通过并包含 `tsc --noEmit`；`git diff --check` 通过，无空白错误。用户人工确认随机 5 份米、独立持久进度、视觉形变、5 / 5 胜利、全局进度、抓捕区域及渐变、阻挡、Tab 调试控制、相机、重开和 S5 回归均正常。
- 已知问题：未发现已证实的 S6A 功能、视觉或体验阻断问题。Vite 仍提示主构建产物约 562.81 kB，超过 500 kB 提示线，属于非阻断构建提示；正式发布前仍须恢复每份米 60 秒并重新测试。
- 下一步建议：S6A 收尾完成后，可等待用户单独授权进入 S6B —— 门系统；本次不得自行开始。
- Git commit 信息：计划 `feat: add full rice gameplay loop`；实际提交和推送结果以本次最终汇报为准。本阶段按要求不创建新 Tag，当前正式 Tag 仍为 `v0.1.0-alpha`。

## 2026-09-22 00:38 +08:00｜S6B 门系统正式完成

- 任务名称：S6B —— 门系统正式收尾。
- 当前开发阶段：S6B Gate = PASS，人工验收 = 通过；本次不进入 S6C。
- 本次目标：完成 Door System、锁门玩法、门碰撞与抓捕阻挡、暂停输入安全和角色圆形碰撞的阶段收尾，并记录构建环境事件。
- Door System：将 18 个 `DoorNode` 正式升级为 Door System，支持 `OPEN / CLOSED / LOCKED`。Human 与 DeepSeek 都能正常开关未锁门；Door Leaf 围绕 Door Hinge 转动；OPEN Door 可通行，CLOSED / LOCKED Door 产生动态碰撞并阻断 Capture 判定。
- 门比例调整：门改为更短的住宅单扇门，门洞同步收窄，左右墙体同步收口；门与墙体高度均增加，门墙比例调整为更接近住宅灰盒尺度。
- Lock：DeepSeek 可锁住 CLOSED Door，OPEN Door 不可直接 Lock；Human 当前不能通过普通 Door Interaction 打开 LOCKED Door，反制留到 S6C。Lock Core 与 Door Leaf 分离。`MAX_ACTIVE_LOCKS = 3`，第 4 个 Active Lock 会被拒绝，不替换已有锁。
- Pause / Input：Esc 统一进入 Pause Menu，提供 Continue、Restart、Return to Faction Select 和开发调试用 Switch Controlled Faction。`selectedFaction` 与 `controlledFaction` 保持分离；裸 R / M / Tab 由 `development.directHotkeysEnabled = false` 默认关闭，避免正常对局误触。
- Player Collision：原角色逻辑碰撞为 Box / AABB footprint，在 W+A、W+D、A+S、S+D 斜向移动经过墙角、门框和家具边角时，会因轻微角点接触出现卡脚或粘住。最终改为角色 XZ Circle Footprint，环境 Wall / Furniture / Door 保持 AABB，组合使用 Circle-vs-AABB、Axis-Separated Collision Resolution 与 Wall Sliding；Sprint 同样使用 Circle Collider。用户人工确认卡脚问题明显改善并通过验收。
- 回归结果：Door 开关与锁定、门碰撞、门阻断抓捕、锁数量限制、门口角色防夹、Sprint 防穿门、暂停菜单、阵营切换、Rice、Capture、Sprint、重开与地图连通均通过自动测试和人工验收。
- Build Environment Incident：S6B 正式收尾时，`npm test` 93 / 93 通过，`git diff --check` 通过；第一次 `npm run build` 因 `EPERM: operation not permitted` 失败，涉及路径 `dist/`。确认 `dist/` 是 Vite 纯构建产物、未被 Git 跟踪且已由 `.gitignore` 忽略；删除后仍曾无法重新创建。排查期间未修改游戏源码或 Windows ACL，未使用管理员提权、`takeown`、`icacls` 或 `taskkill /F`。
- 构建环境处理：发现明确指向本项目的 Vite 开发服务器：`node.exe`，PID 24900，端口 5173；以非强制方式正常停止。随后项目根目录临时目录创建成功、删除成功，确认当前执行环境具备项目根目录写入权限；再次执行 `npm run build` 通过。
- 构建事件结论：无法 100% 证明本次 EPERM 一定由 Vite dev server 文件占用直接导致，但停止当前项目 Vite 开发服务器后，项目根目录写入测试与 Vite production build 均恢复正常。后续正式 build / 阶段收尾前，应优先确认当前项目 dev / preview server 已正常停止。
- 新增文件：`src/systems/DoorSystem.ts`、`src/three/DoorView.ts`、`src/three/RoundShortcuts.ts`、`tests/door-system.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`package.json`、`src/config/gameConfig.ts`、`src/style.css`、`src/systems/GameStateSystem.ts`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`、`tests/apartment-map.test.mjs`、`tests/camera-controls.test.mjs`、`tests/collision-world.test.mjs`。
- 删除文件：无。
- 依赖变化：无新增或删除依赖；仅扩展现有测试脚本。
- 测试结果：最终 `npm test` 93 项全部通过；`npm run build` 通过并包含 TypeScript 检查；`git diff --check` 通过。用户人工确认 S6B Gate 与体验 Gate 均已通过。
- 已知问题 / Build Notes：Vite production build 的主 JS chunk 约 570.87 kB，仍高于 500 kB 提示线；这是已知非阻断构建提示，本阶段不调整 `chunkSizeWarningLimit`，留待后续浏览器兼容 / 性能优化阶段处理。当前开发大米仍为 5 秒，正式设计值为 60 秒，发布前必须恢复并复测。
- 下一步建议：完成本次 commit 和 push 后，可以等待用户单独授权进入 S6C —— Human 反制 / PulseLock；本次不开始 S6C，也不创建新 Tag，当前 milestone 仍为 `v0.1.0-alpha`。
- Git commit 信息：计划 `feat: add door locking gameplay`；实际提交与推送结果以最终汇报为准。

## 2026-09-22 01:28 +08:00｜S6C Human 反制 / PulseLock 正式完成

- 任务名称：S6C —— Human 反制 / PulseLock 正式收尾。
- 当前开发阶段：S6C Gate = PASS，人工验收 = 通过；本次不进入 S6D。
- 本次目标：在 S6B Door System 上完成 Human 破解锁芯的最小闭环，并在自动测试与人工验收通过后完成阶段文档、提交和推送收尾。
- PulseLock：Human 可在 ACTIVE Lock Core 的实际世界坐标交互范围内按住 E 破解 LOCKED Door，DeepSeek 不可破解。破解需连续累计 3 秒，期间 Human 移动被锁定，但 Camera、世界更新和 Capture Zone 继续正常工作。
- Progress Retention：松开 E、离开范围或切走 Human 控制会立即中断破解；各门独立保存破解进度，并从中断时起保留 5 秒。保留期内重新按住 E 可从原进度继续，超时后仅对应门的进度归零。Pause、READY、FACTION_SELECT 与 FINISHED 不推进破解或保留倒计时。
- Lock Core：状态统一为 `ACTIVE / DISABLED`，不再以重复布尔状态作为另一套真相。破解成功后 Core 在本局永久 DISABLED，DeepSeek 无法再次给该门上锁且不会消耗 Active Lock Slot；Restart 或开始新 Match 时全部 Core 恢复 ACTIVE，破解进度、保留时间、暴露状态与当前目标全部清空。
- Door / Lock Resource：破解完成后原子执行 `LOCKED → CLOSED`，不会自动 OPEN；Human 必须松开并再次按 E 才能正常开门。成功破解会释放一个 Active Lock Slot，例如 3 / 3 降为 2 / 3，并允许 DeepSeek 锁另一扇仍有效的门。
- Exposure：仅 Human 正在 UNLOCKING 时设置 `humanExposed = true`，中断、暂停、完成或控制切换后关闭。当前 Exposure 只作为玩法状态与开发 HUD 反馈，尚未接入 S6D 的声音、视野或双向信息系统。
- HUD / Visual：开发 HUD 增加十格 PulseLock 进度、当前进度 / 3.0 秒、暴露状态、进度保留倒计时与锁芯失效提示；ACTIVE 且 LOCKED 的锁芯保持明亮发光，DISABLED 锁芯保留为灰暗无发光状态。当前为 Hold E 可玩原型，未来如需 Timing Window / Skill Check 将另行设计，不在 S6C 范围内。
- 控制与回归：Human 正在破解时无法移动，DeepSeek、门碰撞和抓捕仍继续；暂停与开发控制切换不会产生后台破解。Rice、Sprint、Capture、Door Collision、Circle Collider、Esc Pause Menu、Camera、Restart 与 Faction Select 回归均未发现阻断问题。
- 新增文件：`src/systems/PulseLockSystem.ts`、`tests/pulse-lock.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`package.json`、`src/config/gameConfig.ts`、`src/systems/DoorSystem.ts`、`src/three/DoorView.ts`、`src/three/ThreeGame.ts`、`tests/door-system.test.mjs`。
- 删除文件：无。
- 依赖变化：无新增或删除依赖；仅扩展现有测试脚本。
- 测试结果：最终 `npm test` 101 项全部通过；停止本项目 Vite 开发服务器后，`npm run build` 通过并包含 `tsc --noEmit`；`git diff --check` 通过。用户已人工确认完整破解、移动锁定、Capture 继续、5 秒保留与超时、双门独立、锁芯失效、二次 E 开门、Slot 释放、Pause / Switch、Restart / 新 Match 恢复及既有玩法回归均正常。
- 共享规范：仓库当前不存在 `docs/SHARED_GAMEPLAY_SPEC.md`，按本次要求未新建；S6C 长期规则已记录在 `AGENTS.md`。
- 已知问题：未发现已证实的 S6C 功能或体验阻断问题。Vite production build 主 JS chunk 为 575.97 kB，仍高于 500 kB 提示线，属于非阻断性能 / 构建提示，本阶段不调整阈值。当前开发大米仍为 5 秒，正式设计值为 60 秒，发布前必须恢复并复测。
- 下一步建议：完成本次 commit 和 push 后，可等待用户单独授权进入 S6D —— 双向信息系统；本次不开始 S6D，也不创建新 Tag，当前 milestone 仍为 `v0.1.0-alpha`。
- Git commit 信息：计划 `feat: add human lock counterplay`；实际提交与推送结果以最终汇报为准。

## 2026-09-22 12:20 +08:00｜S6C Minesweeper Lock Counterplay 正式收尾

- 任务名称：S6C —— Human 反制 / Minesweeper Lock Counterplay。当前阶段 S6C Gate = PASS，用户人工验收 = 通过；下一阶段为 S6D —— 双向信息系统，尚未开始。
- 本次目标：以最终扫雷反制规则取代前述 Hold E PulseLock 原型，完成验收后的文档、自动验证和 Git 收尾；历史日志保留，旧原型规则不再适用于当前版本。
- 实际完成内容：Human 对 LOCKED Door 按 E 打开 4×4、3 雷扫雷；长按或连点 E 不再推进解锁。× / Esc 退出后，同一 Lock Core 的盘面本局保留；扫雷期间世界继续运行，Human 不能移动，Capture Zone 仍可工作。扫雷成功使 Core `ACTIVE → DISABLED`、Door `LOCKED → CLOSED` 并释放 Lock Slot；Human 需再次 E 开门。踩雷失败时门仍 LOCKED，对局不结束。
- Human Space：普通 CLOSED Door 立即 OPEN，不触发或受强破 CD 限制；LOCKED Door 则立即强破 Core 并 OPEN，进入 30 秒 Force Break CD。CD 内锁门不能再强破，但仍可 E 扫雷，普通门仍可 Space 免费打开；扫雷成功不触发强破 CD。DISABLED Core 本局不能再次 Lock。门交互范围扩大至 1.3 世界单位，并选最近的可达门，不可隔墙操作。
- 回归与验收：DeepSeek Space Sprint、Capture、Door Collision、Circle Collider、Esc Pause Menu 均无阻断回归；用户确认 S6C 人工 Gate 通过。正式大米仍设计为 60 秒，当前开发测试值仍为 5 秒，发布前需恢复并复测。
- 新增文件：`src/systems/HumanDoorSkill.ts`、`src/systems/MinesweeperLockSystem.ts`、`tests/human-door-skill.test.mjs`、`tests/minesweeper-lock.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`package.json`、`src/config/gameConfig.ts`、`src/style.css`、`src/systems/DoorSystem.ts`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`。
- 删除文件：已由最终扫雷实现替代的 `src/systems/PulseLockSystem.ts`、`tests/pulse-lock.test.mjs`。
- 依赖变化：无新增依赖；测试脚本改为运行扫雷和 Human 门技能测试。
- 测试结果：`npm run build` 通过（含 TypeScript 检查）；`npm test` 115 / 115 通过；`git diff --check` 通过。首次构建因清理 `dist/assets/.gitkeep` 遇到 EPERM；确认 `dist/` 是被 Git 忽略且未跟踪的纯构建产物，无明确属于本项目的 Vite/npm 进程，安全清理后让 Vite 重建，构建通过。未修改 ACL、源码或 Vite 配置来绕过该问题。
- 已知问题：主 JS bundle 约 581.22 kB 的 Vite >500 kB 提示仍为非阻断警告；无法确定此前 EPERM 的唯一成因。仓库不存在 `docs/SHARED_GAMEPLAY_SPEC.md`，按要求未新建。
- 下一步建议：完成本次 commit / push 后等待用户另行授权 S6D，不创建 Tag、不提前开始下一阶段。
- Git commit 信息：计划 `feat: complete human lock counterplay`；实际提交及推送结果以最终汇报为准。

## 2026-09-23 11:26 +08:00｜S6D / S6 游戏玩法 Alpha 正式封版

- 任务名称：S6D 双向信息系统及 S6 游戏玩法 Alpha 收尾；当前开发阶段：S6D Gate = PASS，S6A～S6D 人工 Gate 均已通过，下一阶段为 S7A Human AI（本次不开始）。
- 本次目标：核对已实现规则、统一数值配置和六项浏览器人工验收结果，通过自动验证后完成文档与 Git 里程碑收尾。
- 实际完成内容：S6D 已接入双向 SoundEvent、距离衰减与墙/门遮挡、相机相对声音方向和远蓝/中黄/近红场景声波；Vision 区分 VISIBLE、BLOCKED 与 OUT_OF_RANGE，Last Seen 与当前可见状态独立。鼠标点角色仅改变开发临时 WASD 输入目标；Esc 开发菜单切换正式主控，并同步镜头与信息观察者，不重开对局。
- 米痕最终规则：DeepSeek 实际进食进度增长后开启或刷新 5 秒脚印生成窗口；窗口内移动按步距生成脚印，静止不生成。每个脚印从生成起独立保留 15 秒，末段平滑淡出；窗口结束不删除既有脚印。Human 正式观察者可见，暂停冻结计时，Restart / 新局清空。
- 人工验收：用户于本次任务明确确认 S6D 六项浏览器人工验收全部通过：声音可视化、声音遮挡、鼠标临时控制、Esc 正式主控切换、米痕脚印、Vision / Last Seen。S6D Gate = PASS；S6A、S6B、S6C 的人工验收结果已在前述日志记录。
- 数值配置：现有可调玩法值集中在 `src/config/gameConfig.ts`，运行系统经 `GAME_CONFIG` 读取；`docs/GAME_BALANCE_CONFIG.md` 记录实际值、单位与影响。正式每份米 60 秒，开发测试仍为 5 秒，发布前须恢复并复测。目前未实现对局倒计时，不将其记作已完成。
- 新增文件：`docs/GAME_BALANCE_CONFIG.md`、`tests/balance-config.test.mjs`（相对上次 WIP 检查点）。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md` 及当前 S6D／数值配置相关源码与测试；删除文件：无；依赖变化：无。
- 测试结果：本次 `npm test` 141/141 项通过，`npm run build` 通过（含 TypeScript 检查），`git diff --check` 通过。构建前未发现明确属于本项目的 Vite/npm 进程；未修改 ACL、Vite 配置或游戏平衡。
- 已知非阻断问题：Vite 主 JS chunk 约 599.97 kB，超过 500 kB 提示线；开发米仍为 5 秒，正式发布前需切回 60 秒。没有对局倒计时功能。未发现本次封版自动检查阻断问题。
- Git：已有 S6D WIP 安全检查点 `3a29926`（`wip: preserve s6d information systems`）；本次正式封版 commit、main 推送及 `v0.2.0-alpha` Tag 结果以实际执行和最终汇报为准，不预填尚未产生的 hash。

## 2026-09-23 15:14 +08:00｜S7A WIP 安全检查点

- 任务名称：保存 S7A Human AI 与角色动作接口工作进度。
- 当前开发阶段：S7A 开发中；角色动作接口专项人工验收 通过，整个 S7A 尚未正式验收或标记完成。
- 本次目标：通过自动验证后，将当前 S7A 相关代码、配置、测试及文档保存为 WIP 检查点。
- 实际完成内容：保留 Human AI 巡逻、调查、追逐、导航和门处理实现；保留独立角色动作接口、DEV 双角色动作状态与切换原因显示，以及动作参数说明。用户确认角色动作接口专项人工验收 通过；该结果不代表整个 S7A Gate 通过。
- 新增文件：`src/systems/CharacterAction.ts`、`src/systems/HumanAIController.ts`、`src/systems/NavigationSystem.ts`、`src/three/CharacterActionView.ts`、`tests/character-action.test.mjs`、`tests/human-ai.test.mjs`、`tests/navigation.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/GAME_BALANCE_CONFIG.md`、`src/config/gameConfig.ts`、`src/style.css`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`；本条为追加日志。
- 删除文件：无。依赖变化：无。密钥、`dist/`、`node_modules/` 和 `.env` 未加入版本控制。
- 测试结果：`npm test` 153/153 项通过；`npm run build` 通过；`git diff --check` 通过。构建有已知 Vite 612.95 kB（超过 500 kB）非阻断提示。
- 已知问题：整个 S7A 尚未完成正式人工验收；Human AI 完整体验仍待验收。
- 下一步建议：等待 S7A 后续人工验收与阶段 Gate；本检查点不代表阶段封版。
- Git commit 信息：`wip: preserve s7a human ai and action interface`；hash 与推送结果以本次执行汇报为准。

## 2026-09-23 15:33 +08:00｜S6～S7A 文档状态同步

- 任务名称：同步 S6 与 S7A 项目进度、动作接口长期规则和参数索引。
- 当前阶段：S7A Human AI 进行中。角色动作接口专项人工验收 通过；整个 S7A 尚未正式验收或完成。
- 本次目标：核对正式 Tag、最近 WIP 检查点、Human AI 实际实现与统一数值文档，并同步项目长期状态。
- S6 状态：S6A～S6D 及 S6 已完成。仓库 Tag 查询确认 `v0.2.0-alpha` 存在；本次只读远程 Tag 查询返回对象 `fff6f8a29223bce3c5b780a9a39738fa54ca1ca2`。未发现 `docs/SHARED_GAMEPLAY_SPEC.md`，未新建该文件。
- S7A 实现进度：Human AI 已有 `PATROL / INVESTIGATE / CHASE / CAPTURE` 状态；读取现有声音、Vision / Last Seen，使用房间级声音调查和 XZ A* 导航，普通 CLOSED Door 可沿路径开启，锁门不可通行；抓捕由既有 Capture / Match 规则结算。已接入暂停/准备阶段停更、开发控制接管和重开重置。Human AI 完整浏览器行为尚待人工验收，S7A 不记为完成。
- 动作接口：用户确认专项人工验收 通过。玩家与 AI 共用 `IDLE / WALK / RUN / EAT / STARTLED / FALL / STUN / INTERACT / CAPTURE` 接口；DEV HUD 可观察双方动作与切换原因。正式角色及动作资源尚未导入；GLB / AnimationMixer 仅有预留接口，尚无正式动画片段。
- 配置核对：`docs/GAME_BALANCE_CONFIG.md` 中 Human AI 参数及 `C.characterAnimation.fallPoseMs = 220 ms`、`transitionMs = 120 ms`、`stunColor = 0xff7777` 与 `src/config/gameConfig.ts` 一致；未发现需要改数值表的差异。
- WIP 检查点：`2205b32de17385edb684fa24928d5d976b6dd42f`（`wip: preserve s7a human ai and action interface`），此前执行结果为 push 成功；提交时自动测试 153/153 项通过、build 通过、`git diff --check` 通过。本次远程 Tag 查询成功，但远程 `main` 实时查询因无法连接 GitHub 失败；本地 `main` 与 `origin/main` 跟踪指针均指向该提交。
- 本次文档修改：更新 `AGENTS.md` 的阶段状态和角色动作长期规则；本条追加于日志末尾。未修改游戏代码、参数或共享规范。
- 测试：本次仅文档维护，未重跑游戏自动测试；`git diff --check` 通过。
- 下一步：进行 Human AI 基础行为人工验收；之后再按 Gate 结果决定 S7A 状态。
- Git：不 commit、不 push、不创建 Tag。

## 2026-09-23 16:24 +08:00｜S7A-1 Human AI 基础行为验收

- 任务名称：S7A-1 Human AI 基础行为收尾。
- 当前阶段：S7A-0 角色动作接口专项与 S7A-1 Human AI 基础行为均通过；整个 S7A 尚未完成，CURRENT = S7A-2 Human AI 高级决策。
- 本次目标：记录用户确认的 S7A-1 浏览器人工验收并保存实际自动验证结果。
- 人工 Gate：用户确认巡逻、循声调查、视觉追逐、追丢后搜索、普通门与拐角寻路正常；玩家控制 Human 时 AI 不抢控制，S7A-1 = 通过。此前 S7A-0 动作接口专项人工验收通过，详见前序记录。
- 实际完成内容：巡逻覆盖所有主要房间；最后目击调查优先于声音调查；网格路径增加沿边圆形碰撞采样，防止窄墙角斜穿；路径节点长时间没有接近进度时避开该节点重新寻路。普通关门使用既有开门接口，锁门绕行；DEV HUD 显示路径节点、状态切换原因及路径事件。
- 配置：新增 `C.humanAI.stuckProgressEpsilon = 0.05` 世界单位，并已同步 `docs/GAME_BALANCE_CONFIG.md`；未调整既有玩法平衡值。
- 测试结果：`npm test` 159/159 项通过；`npm run build` 通过（含 TypeScript 检查）；`git diff --check` 通过。构建前已正常停止本项目 Vite 预览。Vite 615.80 kB 主包超过 500 kB 的提示为已知非阻断警告。
- 新增文件：无。修改文件：Human AI、寻路、ThreeGame DEV HUD、Human AI / Navigation 测试、`src/config/gameConfig.ts`、`docs/GAME_BALANCE_CONFIG.md`、`AGENTS.md` 与本日志。删除文件：无。依赖变化：无。
- 已有检查点：本工作基于 `2205b32`（`wip: preserve s7a human ai and action interface`）；本次阶段提交 hash 与 push 结果以 Git 实际执行为准。
- 下一步：进入 S7A-2 Human AI 高级决策的计划与开发；本次不开始 S7A-2。

## 2026-09-23 17:40 +08:00｜S7A-2 开发调试面板专项验收

- 任务名称：记录可收纳调试面板专项人工验收。
- 当前阶段：S7A Human AI 进行中；本次仅调试面板专项 通过，整个 S7A 尚未完成。
- 本次目标：记录用户确认的调试面板验收，并核对 Human AI 平衡参数的复验状态。
- 实际完成内容：用户确认原左上、左下、右上调试窗口已整合为默认收起、可展开/收纳的统一面板；原有实时调试信息与游戏操作均保留。验收状态同步记录于 `AGENTS.md`，此处保留本次专项的具体结果。
- 平衡参数核对：`GAME_CONFIG.humanAI.movementSpeedMultiplier = 0.92`（AI 专用倍率，约比 Human 基础速度低 8%）；`aiUnlockDurationMs = 8,750 ms`（原 5,000 ms 的 1.75 倍）。用户尚未确认这两项调整的最终手感复验，故仍为待验收，未将整个 S7A 标记完成。
- 游戏功能代码及数值：本次未修改。新增文件：无；修改文件：`AGENTS.md`、本日志。删除文件：无。依赖变化：无。
- 测试结果：本次为文档维护，未运行游戏测试；`git diff --check` 待本次收尾检查。
- 已知问题：Human AI 移速与自动解锁耗时需等待最终手感复验。
- 下一步建议：等待用户复验上述两项平衡调整；在整个 S7A Gate 通过前不进入 S7B。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24｜S7B-3A DeepSeek 逃脱关门归档与 Harness 交接

- 任务名称：归档 S7B-3A 条件式逃脱关门、同步长期规则并创建 DeepSeek Harness 交接快照。分支 `main`；开始时 HEAD / `origin/main` 均为 `9da38c0256f3e65cded4e19d6aa315f3c264a781`，工作区已有 S7B-3A 修改及用户未跟踪 `.trae/` 资料。
- 阶段状态：S7B-3A 已通过用户确认的 5/5 浏览器人工验收；S7B 整体仍未完成；下一项唯一主要任务为 S7B-3B 主动锁门与逃脱策略。本记录不将 S7B 标为完成。
- S7B-3A 规则：仅 EVADE 时考虑刚实际通过、仍在近距离的 OPEN Door。须当前目视确认 Human 位于另一侧、两角色不占用门叶、Human 距离至少 1.5 世界单位、门在 1,800 毫秒通过窗口内，并验证 DeepSeek 关门后仍能沿不经过该门的路径逃离，同时 Human 的当前可达追击路线会使用该门。条件不成立即继续原逃跑；成功通过 `DoorSystem.toggle` 改变真实门状态并同步碰撞、视线与声音。每门 5,000 毫秒重试冷却避免开关振荡。没有新增 AI 锁门行为。
- 用户确认的人工结果：正常追逐时安全穿门关门并继续逃跑、Human 已同侧、Human 距离过近、关门会封堵唯一退路、Human 重新开门后 AI 不原地振荡，以上 5 项均 通过。该结果为用户提供的人工验收，不是本次重新执行的浏览器验收。
- 调试与日志：DEV Details 新增 `Door Escape / 关门逃脱`，显示候选门/距离、是否通过、Human 另一侧是否可确认、关门后路线、收益依据、最近结果、跳过原因与冷却。AI JSON 日志记录 `DOOR_ESCAPE_EVALUATE`、`DOOR_ESCAPE_CLOSE`、`DOOR_ESCAPE_SKIP`、`DOOR_ESCAPE_FAILED`；相同决策不逐帧重复记录。
- 配置：`GAME_CONFIG.deepseekAI.doorEscapeMinHumanDistance = 1.5` 世界单位，`doorEscapeCrossingWindowMs = 1,800` 毫秒，`doorEscapeCooldownMs = 5,000` 毫秒；均已同步 `docs/GAME_BALANCE_CONFIG.md`。保留用户其他手动配置数值。
- 本次自动验证：`npm test` 270/270 项通过；`npm run build` 通过（含 `tsc --noEmit`）；`git diff --check` 通过。Vite 主 JS bundle 约 704.03 kB，>500 kB 为已知非阻断提示。浏览器地址返回 HTTP 200；本次未重做完整手动交互验收。
- 文件：新增 `docs/DEEPSEEK_HANDOFF.md`、`tests/deepseek-door-escape.test.mjs`；更新 `AGENTS.md`、本日志、`docs/GAME_BALANCE_CONFIG.md`、DeepSeek 控制器、ThreeGame、AILogCollector、DEV Details 类别与既有面板测试。无依赖变更；未纳入 `.trae/`、`dist/`、`node_modules/` 或临时日志。
- 既有待办：S7B-2 偶发原地停留作为后续 AI 优化；正式 GLB 待机资源与视觉验收留待 S10；Human AI 自动解锁时间留待 S16 平衡评估。S7B-3B 尚未开始。
- Git：本日志与交接快照纳入本轮 WIP 检查点；实际提交和推送结果由最终 Git 操作报告确认。不创建 Tag。

## 2026-09-24｜S7B 静止 Human 好奇安全通行定向修复验收

- 任务名称：修复静止 Human 遮挡重见、末份米堆安全进食路线及 SAFE_WAIT 复查问题。当前阶段仍为 S7B；本轮专项人工验收 通过，不代表 S7B 整体完成。
- 实际修复：按声音事件类别区分追捕危险与普通门操作声；独立静止事件在遮挡期间继续计时，重新目视时不把旧事件 ID 误作当帧 Human 移动；普通可见警戒不会无条件覆盖已获准的静止安全试探，真实移动、逼近、冲刺及抓捕危险仍可中断。
- 米堆路线：分别验证默认 A* 路线、抓捕圈外进食点和安全绕行路径。安全试探可选择合法进食范围内、位于抓捕半径与余量之外的实际位置；默认路线受威胁时可使用现有导航绕行。通道确实被抓捕避让区封死时拒绝通过，不穿墙、不穿锁门。
- SAFE_WAIT：保留同一米堆/入口失败计数和单次抽签；按现有间隔重查路线。存在安全观察路径时只走到观察位置并等待新的有效视野，不使用墙后 Human 实时位置授权通行；路线仍危险时继续等待。修正未激活安全通行却报告 `ACTIVE_SAFE_PASSAGE` 的状态诊断。
- 定向回归：覆盖静止超过 5 秒后重见、事件 ID 变化、无效通行状态、危险默认路线与安全绕行、不可通过的窄通道等待、路线恢复后复查、SAFE_WAIT 安全观察，以及真实公寓 kitchen 的 rice_06 碰撞移动路径。地图模拟轨迹为 `CURIOUS_APPROACH → CURIOUS_OBSERVE → CURIOUS_PASSAGE → EAT`；实际进食位置与 Human 保持在 0.9 世界单位安全边界外。不可通行窄通道连续模拟 30 秒未冲门，安全路线恢复后沿用原静止事件，不重新抽签。
- 人工验收：用户确认本轮 S7B 专项修复 通过。人工验收状态不自动将整个 S7B 标记为完成。
- 配置与调试：保留用户手动调整的 `GAME_CONFIG` 数值；配置说明与本轮变量一致。保留 UE Details 风格 DEV 面板、AI 安全路径可视化开关和 AI JSON 日志导出。日志诊断包含通行实际激活状态及安全路径数据。
- 测试结果：`npm test` 265/265 项通过；`npm run build` 通过（含 TypeScript 检查）；`git diff --check` 通过。Vite 主 bundle 超过 500 kB 的提示仍为非阻断项。
- 新增文件：`src/three/AISafetyPathView.ts`、`tests/deepseek-safety-regression.test.mjs`。修改文件包括 S7B 控制器、日志采集、DEV 面板及 `ThreeGame`、相关既有 S7B 测试、`GAME_CONFIG` 与配置说明、AI 状态树文档和本文件。依赖变化：无。未纳入日志导出的用户资料 `.trae/`，无 dist、node_modules 或导出的 AI 日志 JSON 纳入版本控制。
- 下一步：按既定 Gate 继续 S7B；本次不创建 Tag，不开始新的阶段。
- Git commit 信息：等待本次 WIP 提交结果。

## 2026-09-24 10:55 +08:00｜S7B-2 最终人工验收补记

- 用户最终确认：S7B-2 逃跑与脱险恢复人工验收 通过，包含跨房间逃跑、移动警戒恢复与静止对峙处理；IDLE_01～IDLE_05 多待机动作接口专项五项人工验收 通过。此结果更新前面“等待验收”的当时状态，不改写旧记录。S7B-2 = 通过，NEXT = S7B-3 DeepSeek 主动关门与锁门决策；整个 S7B 尚未完成。
- 剩余待办：偶发原地停留作为后续 AI 优化；正式 GLB 待机片段接入及视觉验收延至 S10；Human AI 自动解锁速度留待 S16 平衡复评。
- 本次检查：`npm test` 204/204 项通过；`npm run build` 通过（含 TypeScript 检查，Vite 654.54 kB bundle 提示非阻断）；`git diff --check` 通过。`GAME_CONFIG` 与 `docs/GAME_BALANCE_CONFIG.md` 的新增待机参数一致。
- Git：本次保存为 `wip: preserve s7b2 escape ai and idle slots`；基础检查点为 `7061b33ae111bd2ea68e324895cf81f1715be63a`。提交 hash 和 push 结果待 Git 操作后报告；不创建 Tag，不开始 S7B-3。

## 2026-09-24 10:54 +08:00｜S7B-2 最终验收与 WIP 安全检查点

- 任务名称：记录 S7B-2 最终人工验收并保存逃跑 AI / 特殊待机接口 WIP。当前阶段：S7B-2 = 通过；NEXT = S7B-3 DeepSeek 主动关门与锁门决策；整个 S7B 尚未完成。
- 人工 Gate：用户确认 S7B-2 逃跑与脱险恢复验收 通过，涵盖跨房间逃跑、移动警戒恢复及静止对峙路线处理；确认 IDLE_01～IDLE_05 多待机动作接口专项五项人工验收 通过。偶发原地停留是后续 AI 优化项，不阻塞 S7B-2。
- 本轮核实的待机表现接口：沿用玩家与 AI 共用的 `CharacterActionView` / `AnimationMixer`；连续普通 IDLE 5 秒后从实际已接入的配置片段中抽选，完成后回到普通 IDLE，更高优先级动作打断，暂停冻结计时、重开清零。当前没有正式 GLB 待机动画资源，动画视觉验收延后至 S10；缺资源时白模保持普通 IDLE。
- 配置：`GAME_CONFIG.characterAnimation.specialIdleTriggerMs = 5,000 ms`、`specialIdleRepeatIntervalMs = 15,000 ms`、`specialIdleSlots = IDLE_01..IDLE_05` 已与 `docs/GAME_BALANCE_CONFIG.md` 对齐。未调整玩法平衡值。
- 保留待办：偶发原地停留的后续 AI 优化；S10 正式 GLB 待机动画接入与视觉验收；Human AI 自动解锁速度按既有决定留待 S16 平衡复评。
- 验证：`npm test` 204/204 项通过；`npm run build` 通过（含 TypeScript 检查），Vite 主 bundle 654.54 kB 的 >500 kB 提示为非阻断；`git diff --check` 通过。构建使用项目目录授权执行，未改 ACL 或绕过构建错误。
- 新增文件：`tests/deepseek-evade.test.mjs`（S7B-2 回归测试）。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`docs/GAME_BALANCE_CONFIG.md`、`src/config/gameConfig.ts`、`src/systems/DeepSeekAIController.ts`、`src/three/CharacterActionView.ts`、`src/three/ThreeGame.ts`、`tests/character-action.test.mjs`。删除文件：无。依赖变化：无。
- Git 检查点：基于已存在且 `main` / `origin/main` 同步的 S7B-1 检查点 `7061b33ae111bd2ea68e324895cf81f1715be63a`；本次计划创建 `wip: preserve s7b2 escape ai and idle slots`。本日志随该 WIP 提交保存；实际提交 hash 与推送结果以 Git 回报为准。不创建 Tag，不开始 S7B-3。

## 2026-09-23 18:00 +08:00｜S7A Human AI 正式封版

- 任务名称：修复构建环境阻断并完成 S7A 阶段收尾。当前开发阶段：S7A Gate = PASS；下一阶段 S7B DeepSeek AI，本次不开始。
- 本次目标：确认 S7A 人工验收、构建与数值文档一致性，再提交现有 S7A 工作。
- 人工验收：用户最终确认 S7A-0 角色动作接口、S7A-1 基础 Human AI、S7A-2 高级决策及可收纳调试面板均 通过。先前“平衡待最终手感复验”记录保留为当时状态；现接受 AI 移动倍率 0.92 与单次自动解锁 8,750 毫秒。解锁速度留到 S16 平衡阶段继续调整，不阻断本次 Gate。
- 实际完成内容：保留已有 Human AI 巡逻、循声调查、视觉追逐、有限搜索、锁门绕行/模拟破解/强破、暂停及开发控制接管、调试 HUD 与动作接口；本次未修改玩法或平衡值。`src/config/gameConfig.ts` 与 `docs/GAME_BALANCE_CONFIG.md` 的 AI 参数已核对一致。
- 构建问题：`public/assets/.gitkeep` 是被 Git 跟踪的零字节占位文件，Vite 会把它复制到 `dist/assets/.gitkeep`；没有源码或运行依赖，现已移除。先前该路径 EPERM 的已验证原因是当前 Codex 受限执行对仓库路径没有写入权限：原始 `npm run build` 在具备该目录写入权限的执行环境下成功。未发现只读属性，也未确认有项目进程占用；不据此认定一般 Windows 文件锁已被完全排除。保留原始 TypeScript + Vite 构建命令，未改 Vite 输出目录、npm 脚本或系统 ACL。
- 验证：移除占位文件后连续 3 次 `npm run build` 通过（均执行 TypeScript 检查与生产构建）；`npm test` 165/165 项通过；开发服务 `127.0.0.1:5174` 在构建后仍返回 HTTP 200；`dist/assets/.gitkeep` 未再生成。故意设置不存在的 Node 预加载模块时，`npm run build` 返回退出码 1，确认失败不会被伪报成功。`git diff --check` 以本次最终检查结果为准。
- 新增文件：无。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`，并纳入此前未提交的 S7A 配置文档、Human AI、寻路、调试面板及测试修改。删除文件：无用途的 `public/assets/.gitkeep`。依赖变化：无。
- 已知非阻断问题：Vite 主 JS chunk 约 624.28 kB，高于 500 kB 提示线；当前 Codex 若再次以无仓库写入权限的受限执行构建，仍可能在其他 `dist` 文件遇到 EPERM，需按项目写入边界处理；一般 Windows 文件占用风险未被证明为零。S16 待办：复评 Human AI 自动解锁速度。
- Git commit 信息：计划 `feat: complete s7a human ai`，实际 hash 与推送结果以本次 Git 执行和最终汇报为准；本阶段不创建 Tag。

## 2026-09-23 18:41 +08:00｜S7B-1 DeepSeek AI 人工验收与 WIP 检查点

- 任务名称：记录 S7B-1 自主找米与进食验收并建立 Git WIP 安全检查点。当前阶段：S7B-1 通过；整个 S7B 未完成，CURRENT = S7B-2 威胁感知与逃跑。
- 本次目标：保存用户确认的六项浏览器验收及本次验证通过的 S7B-1 实现。
- 人工 Gate：用户确认自主找米、连续吃完五份米、普通门开启与锁门绕行、目标及路径显示、暂停与重开、临时接管与玩家控制均 通过。
- 实际实现：独立 DeepSeek AI 状态机按路径行走时间 + 剩余进食时间 + 既有准备时间选取预计完成总时间最短的未完成米堆；复用共享 NavigationSystem、Circle Collision、DoorSystem 和唯一 RiceField 进食更新，使用原有准备、中断保留、声音/米痕/动作和 5/5 胜利规则。普通 CLOSED Door 可开，LOCKED Door 不穿越；不可达及卡路会重试或换目标。只在 Human 正式主控时运行，暂停、DeepSeek 正式主控及开发临时接管时不抢输入；重开重置 AI。
- 配置：新增 GAME_CONFIG.deepseekAI 五项卡路/重试参数（路径容差 0.25 世界单位、卡路重算 800 ms、最小进度 0.05 世界单位、同目标最多 2 次、重试 1,500 ms），已同步 docs/GAME_BALANCE_CONFIG.md；未调整既有玩法数值。
- 新增文件：src/systems/DeepSeekAIController.ts、tests/deepseek-ai.test.mjs。修改文件：src/three/ThreeGame.ts、src/config/gameConfig.ts、docs/GAME_BALANCE_CONFIG.md、AGENTS.md；本条为末尾追加。删除文件：无。依赖变化：无。
- 测试结果：本次 npm test 172/172 项通过；npm run build 通过（含 tsc --noEmit）；git diff --check 通过。构建有已知 Vite 主包超过 500 kB 的非阻断提示。
- 已知问题：S7B-1 是本阶段通过，不代表整个 S7B 完成；本次不创建 Tag。新 WIP 提交 hash 与 push 结果以 Git 实际执行及最终汇报为准。
- 下一步建议：进入 S7B-2 威胁感知与逃跑前，由用户另行安排；本次不开始下一轮。
- Git commit 信息：wip: preserve s7b1 rice seeking ai（本次执行）。

## 2026-09-24 10:36 +08:00｜S7B-2 验收记录与特殊待机插槽

- 任务名称：记录 S7B-2 人工验收，并为玩家与 AI 共用动作表现层增加 DeepSeek 特殊待机插槽。
- 当前阶段：用户确认 S7B-2 = 通过；NEXT = S7B-3 主动锁门。整个 S7B 尚未完成。偶发原地停留为后续 AI 优化项。本轮特殊待机插槽功能等待人工验收，不表示 S7B-3 已开始。
- 实际完成内容：在既有 `CharacterActionView` / `AnimationMixer` 接口增加 `IDLE_01`～`IDLE_05` 插槽；只从配置名单中已实际接入的片段抽选。连续普通 IDLE 达到 5 秒后可播放，后续播放间隔至少 15 秒；多片段时避免连续重复同一插槽。片段结束恢复普通 IDLE，移动、进食及其他非 IDLE 玩法动作立即中断。动作计时在暂停时随游戏更新冻结，重开清零，不参与 AI 决策、移动或玩法判定。
- 资源状态：正式 GLB / 特殊待机动画目前尚未导入。无可用片段时维持普通白模 IDLE，且不在每帧重试查找缺失资源；此时等待人工验收的是白模回退、DEV 计时及优先级行为，特殊动画视觉需待资源接入后验收。
- 配置：新增 `characterAnimation.specialIdleTriggerMs = 5,000` 毫秒、`specialIdleRepeatIntervalMs = 15,000` 毫秒及 `specialIdleSlots`；已同步 `docs/GAME_BALANCE_CONFIG.md`。均为表现参数，不改变玩法数值。
- 新增文件：无。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`src/config/gameConfig.ts`、`src/three/CharacterActionView.ts`、`src/three/ThreeGame.ts`、`docs/GAME_BALANCE_CONFIG.md`、`tests/character-action.test.mjs`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 200/200 项通过；`npm run build` 通过（含 TypeScript 检查）；`git diff --check` 通过。构建仍有 Vite 主 bundle 大于 500 kB 的非阻断提示。
- 已知问题：无正式特殊待机片段可供当前版本播放。S7B-2 偶发原地停留不再阻断 Gate，保留为后续 AI 优化事项。
- 下一步建议：人工检查 DEV 面板静止计时、无资源白模回退、动作打断、暂停冻结与重开清零；之后由用户安排 S7B-3。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 21:57 +08:00｜S7B-3B-0b 主动锁门接口落地（不启用自动锁门）

- 任务名称：按已批准的 v1 规则（A1/B1/C3/D1）落地 S7B-3B 的锁门命令通道与接口。当前阶段：S7B-3B 进行中；本轮只完成 3B-0b，未实现锁门决策，S7B 整体仍未完成。
- 本次目标：让控制器与 ThreeGame 之间具备完整的锁门命令通道与结果回调，但**正式对局中 `lockDoorId` 恒为 null**，DeepSeek 仍只执行已验收的 S7B-3A 条件关门。
- 实际完成内容：
  - `DeepSeekAICommand` 新增 `lockDoorId: string | null`；`command()` 工厂恒返回 `lockDoorId: null`。
  - `DeepSeekAIInput` 新增只读能力 `canLockDoor?: (id) => boolean` 与 `activeLockSlots?: number`（均不构成新的感知来源）。
  - `DoorSystem.ts` 新增导出守卫 `lockDoorFromCommand(doors, id, actor, canInteract, interactionRange)` 与结果值 `OUT_OF_RANGE`：复检交互距离与不可隔墙后，把状态/锁芯/锁位规则**全部委托给既有 `DoorSystem.lock()`**，未重写锁门逻辑。
  - `ThreeGame` 组装输入时注入 `canLockDoor`（复用 `canInteractWithDoorXZ`）与 `activeLockSlots = maxActiveLocks - activeLockedDoorCount`；新增 `lockDoorId` 落地分支，成功后经 `applyDoorResult` 同步门状态、`DoorView`、动态碰撞与 `DOOR_LOCK` 声音。
  - 控制器新增 `onDoorLockResult(id, result)`、`drainDoorLockEvents()` 与去重的 `doorLockDecision()`；`reset()` 清理锁门状态。日志快照新增 `doorLockEvents` 排水（空队列不产生任何事件，故不新增逐帧日志；亦无队列滞留）。
  - **未实现**：`evaluateEscapeLock`、`doorLockPendingId` 的设置/消费、EVADE 锁门优先级、SAFE_WAIT/好奇状态锁门、任何硬编码捷径。
- 源码分析结论（HIGH 威胁冲突，写入设计文档第 2.1 节）：`assessThreat` 中「目视 Human 且距离 ≤ `visionEvadeDistance`(5)」与「可听 Human 声 ≥ `soundEvadeStrength`(0.09)」都判定为 HIGH，而锁门合法窗口 1.5–5 u **完全落在 HIGH 区间**。因此 `threat.level === 'HIGH'` **不能**作为取消待锁门的依据，否则锁门永不触发。已把设计文档中「真实危险 = 威胁 HIGH」改为具体信号：`captureProgressMs > 0`、`sprintState === 'STUNNED'`、或目视距离以 ≥ 0.35 u/s 缩短且 ≤ 2.2 u；3B-1 须沿用 `evaluateEscapeDoor` 那种按条件而非按威胁等级判断的纪律。
- 新增文件：`tests/deepseek-door-lock.test.mjs`。修改文件：`src/systems/DeepSeekAIController.ts`、`src/systems/DoorSystem.ts`、`src/three/ThreeGame.ts`、`src/systems/AILogCollector.ts`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`（最小同步）、`docs/AGENT_LOG.md`。删除文件：无。依赖变化：无。`GAME_CONFIG` 未新增或修改任何数值。
- 测试结果：`npm test` 280/280 项通过（原 270 + 新增 10）；`npm run build` 通过（`tsc --noEmit` + Vite 构建，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle 约 705 kB，>500 kB 提示仍为非阻断。
- 已知问题：`threat.level === 'HIGH'` 与锁门窗口重叠的冲突已记录，需在 3B-1 落实修正；锁门通道尚未经浏览器人工验收（本步骤按定义不产生可见行为）。
- 下一步建议：进入 3B-1 实现 `doorLockPendingId` 连续动作与 `evaluateEscapeLock` 决策，并采用上述真实危险信号；之后 3B-2 防振荡、3B-3 定向回归、3B-4 DEV/日志归档。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 22:18 +08:00｜S7B-3B-1 主动锁门决策核心

- 任务名称：实现 DeepSeek 主动锁门决策核心。当前阶段：S7B-3B 进行中；本轮只完成 3B-1，未做 3B-2 防振荡专项，S7B 整体仍未完成。
- 本次目标：在已验收的 S7B-3A 主动关门成功后，于同一连续动作内按已批准的六项规则（真实危险信号、SPRINT 放弃、单次 A*、保留 OUT_OF_RANGE 守卫、DEV 留 3B-4、事件驱动日志）发起主动锁门。
- 实际完成内容：
  - `DeepSeekAIController` 新增 `doorLockPendingId` 与 `doorLockSkipReason`；`onDoorEscapeResult` 在「EVADE 中成功主动关门且仍在 `doorEscapeCrossingWindowMs` 窗口内」时建立 pending，其余结果清空。
  - 新增 `evaluateEscapeLock(input, approachSpeed)`：依次校验门存在且 CLOSED、过门窗口、`captureProgressMs`、`STUNNED`、`SPRINT_RUNNING`、当前目视 Human 在另一侧、距离 ≥ 1.5、逼近速度（`approachSpeedThreshold` + `riskySprintDistance`）、`canLockDoor`、`activeLockSlots`、锁芯可用、逃生路线（`blockedDoors` A*）、至少一处未完成米堆可达（**临时避让不算完成**，遍历所有未完成米堆）。任一失败 `DOOR_LOCK_SKIP` 并清 pending；通过则 `DOOR_LOCK_EVALUATE` 并返回门 id。
  - `updateSafety` 在逃跑目标选择后、`evaluateEscapeDoor` 之前调用 `evaluateEscapeLock`，命中即以 `lockDoorId` 命令返回（`LOCKING_ESCAPE_DOOR`）；`onDoorLockResult` 成功/失败均清 pending。
  - 取消路径全覆盖：`evaluateEscapeLock` 任一 reject、`onDoorLockResult`、`enterEvade`、`beginRecovery`、`updateSafety` 的 STUNNED 早退。
  - 冷却规则：`onDoorEscapeResult` 的关门冷却结算保持不变；`evaluateEscapeLock` 不查冷却（同一次连续动作例外），锁门失败/取消不重写冷却；Human 重开门后同门冷却仍生效。
  - 未实现：3B-2 额外防振荡、DEV Door Lock 分类、任何 GAME_CONFIG 新增/调整。`threat.level === 'HIGH'` 未作为取消条件（遵守 3B-0b 源码分析结论）。
- 新增文件：`tests/deepseek-door-lock-decision.test.mjs`。修改文件：`src/systems/DeepSeekAIController.ts`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`（最小同步：状态与实现要点）、`docs/AGENT_LOG.md`。删除文件：无。依赖变化：无。`GAME_CONFIG` 无任何改动。
- 测试结果：`npm test` 291/291 项通过（原 280 + 新增 11）；`npm run build` 通过（`tsc --noEmit` + Vite，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：锁门决策尚需浏览器人工验收；防振荡专项（3B-2）与 DEV 面板（3B-4）未做。
- 下一步建议：浏览器人工验收「正常追逐穿门→关门→锁门、贴脸/同侧/逼近不锁、锁位满/封退路/封米堆放弃、Human 重开不振荡、SAFE_WAIT/好奇/安全通行不受影响」；通过后再进入 3B-2。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 22:37 +08:00｜S7B-3B-1 人工验收问题排查（锁门从未触发）

- 任务名称：排查「长期追逐始终未观察到主动锁门」。当前阶段：S7B-3B-1 人工验收问题排查；未开始 3B-2；S7B 整体未完成。
- 用户人工验收输入：7 项 通过（过近/同侧、逼近、锁位满/锁芯失效、自身路线安全、Human 重开门、原有 AI 回归）；第 1 项「正常关门后锁门」**未观察到成功案例**，不等于实现失败。
- 实机日志分析（`who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`，364.7 s / 1666 事件 / 未截断）：`DOOR_ESCAPE_CLOSE=8`、`DOOR_LOCK_SKIP=4`、`DOOR_LOCK_EVALUATE=0`、`DOOR_LOCK_APPLY=0`、`DOOR_LOCK_FAILED=0`。
- 根因（源码 + 日志双证）：**关门遮挡视线，使锁门的「Human 当前可见」前提永不成立**。
  - 8 次成功关门的下一帧全部出现 `THREAT_SOURCE_CHANGE :: LAST_SEEN|SOUND` 与 `PASSAGE_GATE :: NO_VISIBLE_HUMAN`。
  - `PerceptionSystem.inspectVision`（L83-91）对任何非 `OPEN` 门与视线矩形相交即返回 `BLOCKED`；`ThreeGame.ts:396` 据此把 `visibleHuman` 置 null；`evaluateEscapeLock` 随即 `HUMAN_SIDE_UNKNOWN`。
  - `evaluateEscapeDoor` 关门时同样要求 `visibleHuman`，故二者在同一连续动作内互斥。
- 诊断缺陷（已修复）：`doorLockDecision` 只与「上一条决策签名」比较，导致同门连续同因拒绝被吞——8 次拒绝仅记录 4 次。修复方式：建立新 pending 时清空 `lastDoorLockDecision`，使每次连续动作至少记录一次结果；仍保持事件驱动、不逐帧刷屏。
- 本轮实际改动（不触碰任何安全阈值）：
  - `DeepSeekAIController`：新增 `clearPendingLock()`；`onDoorEscapeResult` 记录 `doorLockLastCloseId` / `doorEscapeCloseCount` / `doorLockPendingCount` 与 `doorLockPendingSinceMs`；`onDoorLockResult` 统计 `doorLockAppliedCount`；`evaluateEscapeLock` 统计 `doorLockCommandCount`；新增 `doorLockWindowRemainingMs` 每帧刷新；`reset()` 全部清零。
  - `DebugDetailsPanel` + `ThreeGame`：新增 `Door Lock / 主动锁门` DEV 分类（最近成功关闭的门、doorLockPendingId、pending 建立时间与剩余窗口、最近评估结果、最近拒绝原因、最近执行结果、关门成功/pending/锁门命令/锁门成功四项计数）。
  - **未修改**：1.5 安全距离、1800 ms 窗口、逃生路线与米堆可达性检查、`DoorSystem` 锁门逻辑、任何 `GAME_CONFIG` 数值。**未做规则层面的修复**，等用户批准。
- 新增文件：`tests/deepseek-door-lock-integration.test.mjs`（7 项，按真实每帧顺序：过门 → updateSafety → 执行关门 → onDoorEscapeResult → 下一帧重建输入 → evaluateEscapeLock → lockDoorFromCommand → DoorSystem.lock → onDoorLockResult）。修改文件：`src/systems/DeepSeekAIController.ts`、`src/three/DebugDetailsPanel.ts`、`src/three/ThreeGame.ts`、`tests/debug-details-panel.test.mjs`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`（新增第 2.2 节）、`docs/AGENT_LOG.md`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 298/298 项通过（原 291 + 新增 7）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：锁门在正常追逐下仍不会触发——需用户批准规则冲突的最小改动后才能修复；第 1 项人工验收继续挂起。
- 下一步建议：批准候选最小改动（用关门时已确认的「Human 在门另一侧」证据，在门保持 `CLOSED` 期间替代新的目视确认），或指定其他方案；之后重新做第 1 项浏览器验收。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 22:49 +08:00｜S7B-3B-1 修复：关门侧向证据打通主动锁门

- 任务名称：按用户批准的方案修复「关门遮挡视线导致锁门永不成立」的规则冲突，并修复日志去重问题。当前阶段：S7B-3B-1 人工验收修复；未开始 3B-2；S7B 整体未完成。
- 批准依据与实现：
  - `evaluateEscapeDoor` 在关门成功路径记录 `doorLockEvidence = { doorId, deepseekSide }`——仅保存**真实目视**确认过的「Human 在门另一侧」侧向事实，并绑定门 ID。
  - `onDoorEscapeResult` 仅在「关门成功 + 1800 ms 窗口内 + 该门确有本次确认的侧向证据」时建立 pending；否则记 `DOOR_LOCK_SKIP:NO_CLOSE_SIDE_EVIDENCE`，不建立 pending。
  - `evaluateEscapeLock`：**重新看见 Human** 时一律以最新目视信息为准（同侧 / 距离 < 1.5 / 逼近 → 取消）；**当前失视**时只复用同门、同一次连续动作的侧向证据，并重新核验门仍 `CLOSED`、DeepSeek 侧别未变（`DEEPSEEK_SIDE_CHANGED`）、`canLockDoor`、锁位、锁芯、逃生路线、米堆可达性。证据不得当作 Human 实时位置，也不作为「距离仍然安全」的证明。
  - 证据失效：pending 被消费/取消、门重新打开、过门窗口超时、发现 Human 同侧、出现抓捕进度或紧急危险、交互条件不成立。
  - 未改动：1.5 / 1800 / 5000 三个阈值、抓捕半径与其它手调 `GAME_CONFIG`、全局最多 3 把锁、`DoorSystem` 唯一状态源、锁门帧的执行端交互与墙体复检、SAFE_WAIT / 好奇观察 / 安全通行行为；未新增独立锁门窗口。
- 日志修复：新增 `DOOR_LOCK_PENDING` 与 `DOOR_LOCK_CANCEL` 事件，配合「建立 pending 时清空 `lastDoorLockDecision`」，使「未建立 pending / 建立后提前取消 / 评估后拒绝 / 发出命令但执行端失败 / 锁门成功」五种结局均可区分，且不逐帧重复输出；新增计数 `doorEscapeCloseCount` / `doorLockPendingCount` / `doorLockCancelCount` / `doorLockCommandCount` / `doorLockAppliedCount` 与 `doorLockEvidenceDoorId` / `doorLockUsedEvidence`。
- DEV：`Door Lock / 主动锁门` 分类新增「关门前侧向证据 / 最近一次是否使用」（失视复用时标为 warning），计数扩为五项；`clearPendingLock()` 拆为 `clearPendingLockState()`（静默）与 `cancelPendingLock(reason)`（记 `DOOR_LOCK_CANCEL`）。
- 新增/调整测试：`tests/deepseek-door-lock-decision.test.mjs` 增至 16 项（失视复用证据并上报、最新目视覆盖证据、证据不得跨门/跨动作/过期复用、被消费后不可复用、多次连续动作关键事件不被去重合并）；`tests/deepseek-door-lock-integration.test.mjs` 增至 10 项（原「下一帧跳过」改为「关门侧向证据把失视锁门走通」，并新增无目视证据不建立 pending、重新目视同侧/过近取消、取消后证据不可跨帧复用）。
- 修改文件：`src/systems/DeepSeekAIController.ts`、`src/three/ThreeGame.ts`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`（新增 §2.3 已实施修复）、`docs/AGENT_LOG.md`；测试文件 `tests/deepseek-door-lock-decision.test.mjs`、`tests/deepseek-door-lock-integration.test.mjs`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 306/306 项通过（上一轮 298 + 8）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：修复后的真实锁门行为尚待浏览器人工验收；第 1 项验收此前未通过，本轮**不预判通过**。
- 下一步建议：浏览器验收第 1 项，重点观察 DEV `Door Lock` 分类中「最近一次是否使用 = 使用中（关门后失视）」与五项计数 1 / 1 / 0 / 1 / 1，以及 Human 重新开门后不重复锁门。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 23:13 +08:00｜Sprint 30 秒冷却 + Sprint⟷门动作冲突排查与协调

- 任务名称：新增 DeepSeek 冲刺 30 秒技能冷却；排查并最小协调 Sprint 与 S7B-3A 关门 / 3B-1 锁门链路的冲突。当前阶段：S7B-3B-1 人工验收修复；未开始 3B-2；S7B 整体未完成。
- 日志结论（`who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`，364.7 s / 1666 事件）：**该日志早于本轮侧向证据修复**（不含 `DOOR_LOCK_PENDING`，该事件在本轮修复时才引入），因此其中的锁门失败仍是视线冲突所致，**不是 Sprint**。
  - `DOOR_ESCAPE_EVALUATE=8`、`DOOR_ESCAPE_CLOSE=8`、`DOOR_ESCAPE_FAILED=0` → **主动关门成功 8 次，不是 0**。`DOOR_ESCAPE_APPLY` 这个事件名在代码中不存在，关门回执用 `DOOR_ESCAPE_CLOSE` / `DOOR_ESCAPE_FAILED`。
  - `DOOR_LOCK_SKIP=4`、`DOOR_LOCK_EVALUATE=0`、`DOOR_LOCK_APPLY=0`。
  - `DOOR_ESCAPE_SKIP` 原因分布：`NO_NEARBY_OPEN_DOOR=70`、`DOOR_NOT_RECENTLY_PASSED=67`、`SPRINT_IN_PROGRESS=35`、`HUMAN_SIDE_UNKNOWN=23`、`DOOR_OCCUPIED_OR_INACCESSIBLE=7`、`DOOR_DOES_NOT_DELAY_PURSUER=1`、`HUMAN_ALREADY_SAME_SIDE=1`、`DOOR_COOLDOWN=1`。
  - **Sprint 确实吃掉门机会**：35 次 `SPRINT_IN_PROGRESS` 中 **29 次**在随后 1800 ms 内该门再无任何门事件（机会丢失），仅 6 次被后续评估救回。结构性原因：`C.sprint.durationMs` 2,500 ms **大于** `doorEscapeCrossingWindowMs` 1,800 ms，且冲刺会把 DeepSeek 带出 `interactionRange` 1.3——日志中 skip 后约 200–800 ms 该门即退出候选集（`NO_NEARBY_OPEN_DOOR`）。
  - 时间线案例：①t=5785 冲刺开始 → 6000 `SPRINT_IN_PROGRESS`（door_bedroom2_study）→ 6201 `NO_NEARBY_OPEN_DOOR`，窗口内再无机会；②t=10410 冲刺开始 → 10625 `SPRINT_IN_PROGRESS`（door_closet_hall）→ 10826 `NO_NEARBY_OPEN_DOOR`，丢失；③t=28257 `SPRINT_IN_PROGRESS`（door_bedroom2_study）→ 28403 冲刺自然结束且窗口仍有效 → `DOOR_ESCAPE_EVALUATE` + `DOOR_ESCAPE_CLOSE` 成功（+146 ms），属 6 次被救回的案例。
- A. 冲刺 30 秒冷却：`GAME_CONFIG.sprint.cooldownMs = 30_000`；`SprintSystem` 构造函数新增第 4 参（默认 0，兼容既有只测时长/风险/眩晕的测试），新增 `cooldownRemainingMs` / `lastStartReason` / `readiness`（READY / ACTIVE / COOLDOWN / STUNNED）；`tryStart` 在冷却未清或非 NORMAL 时拒绝，成功即置 `cooldownRemainingMs = cooldownMs`；`advance` 每帧扣减（暂停冻结）；`reset` 清零。`ThreeGame` 传入 `C.sprint.cooldownMs` 并记录开始原因（`AI_<sprintDecision>` / `PLAYER_SPACE`）。未改动冲刺速度、持续时间、触发距离与风险阈值。
- B. Sprint⟷门协调（最小修复）：比较 A/B 后**未采用「停止 Sprint」**——提前结束冲刺会让 AI 躲过 30% 必摔，违反既有「冲刺开始后不能停下规避风险」并构成平衡漏洞。改为：`evaluateEscapeDoor` 与 `evaluateEscapeLock` 不再因 `SPRINT_RUNNING` 拒绝；门动作是一次性交互，`SprintSystem.movementDirection` 在冲刺中恒返回 `lastDirection`，故关门/锁门**不打断冲刺**，冲刺计时与 30% 摔落判定完整保留。其余 S7B-3A / 3B-1 条件（1.5 / 1800 / 5000 / 对侧目视或侧向证据 / 退路 / 米堆可达 / 锁位 / 锁芯 / 不可隔墙 / 交互距离 / STUNNED / 抓捕进度）全部不变。
- 可观察性：DEV 新增 `Sprint / 冲刺` 分类（状态+就绪度、冷却剩余、本次剩余、风险模式、最近开始原因）；`Door Escape` 分类新增「最近经过的门 / 距过门时间」与「冲刺中关门次数 / 冲刺中锁门次数」；`Door Lock` 保持 PENDING / CANCEL / EVALUATE / APPLY / FAILED 谱系。控制器新增 `doorEscapeLastCrossedId` / `doorEscapeLastCrossedAgeMs` / `doorEscapeDuringSprintCount` / `doorLockDuringSprintCount`（reset 全部清零）。未新增逐帧日志。
- 新增/调整测试：`tests/sprint.test.mjs` 新增 5 项冷却测试；`tests/deepseek-door-lock-decision.test.mjs` 把「冲刺取消锁门」改为「冲刺不再取消合法锁门」（保留 STUNNED / 门重开 / 窗口超时取消）；`tests/deepseek-door-lock-integration.test.mjs` 把「冲刺后取消」改为「冲刺中仍完成关门→锁门」；`tests/debug-details-panel.test.mjs` 同步新增 `sprint` 分类。
- 修改文件：`src/config/gameConfig.ts`、`src/systems/SprintSystem.ts`、`src/systems/DeepSeekAIController.ts`、`src/three/ThreeGame.ts`、`src/three/DebugDetailsPanel.ts`、`docs/GAME_BALANCE_CONFIG.md`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`、`docs/AGENT_LOG.md`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 312/312 项通过（上一轮 306 + 6 项：冲刺冷却 5 + 锁门冲刺行为 1）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：**手上没有修复后的实机日志**——现有唯一日志产生于侧向证据修复之前，无法据此判断修复后锁门是否成功。需导出一份**修复后**的对局 AI JSON 再判定。
- 下一步建议：按汇报第 8 节做浏览器验收；确认后再进入 3B-2。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 23:49 +08:00｜S7B-3B-2 防振荡与重复锁门保护

- 任务名称：审计现有防振荡机制并只修复已确认的漏洞。当前阶段：S7B-3B-2 完成、待人工验收；未开始 3B-3 / 3B-4；S7B 整体未完成。
- 审计结论（读源码逐条核实，未重复实现已生效机制）：
  - **5000 ms 同门冷却有效**：`evaluateEscapeDoor` 以 `closedDoorAt`（绝对时间）判定，`onDoorEscapeResult` 在每次关门尝试（成功或失败）时写入，**按门 ID 独立**，`reset()` 清除。
  - **一次关门最多一次锁门尝试**：关门后门变 `CLOSED` 即退出 OPEN 候选集；pending 只在 `onDoorEscapeResult` 建立一次；`evaluateEscapeLock` 成功即发命令、同帧由 `onDoorLockResult` 清 pending，失败/取消即清。
  - **pending 与侧向证据清理完整**：`clearPendingLockState()`（成功/失败/任一检查不通过）＋ `cancelPendingLock(reason)`（进入 EVADE、转入 RECOVER、STUNNED）＋ `reset()`。
  - **Human 解锁/强破后不能立即重锁**：冷却未过 → `DOOR_COOLDOWN`；冷却过后仍需新的真实过门 → 否则 `DOOR_NOT_RECENTLY_PASSED`；解锁/强破另将 Lock Core 置 `DISABLED` → `LOCK_CORE_UNAVAILABLE`（本局该门不可再锁）。
  - **冲刺门交互保留摔倒惩罚**：门动作不触碰 `SprintSystem`，`riskMode` / `sprintRemainingMs` 照常，30% 必摔与眩晕完整。
- **发现的真实漏洞（有实机证据）**：`followPath` 会打开逃生路径上的非 OPEN 门，而关门后的逃生重规划**未排除刚被自己关上的门**（`NavigationSystem.findPath` 把 `CLOSED` 门视为可通行、代价 +3），于是 DeepSeek 可能**立刻把自己刚关的门重新打开**，抵消关门战术并造成 close↔open 往复。
  - 证据（`who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`）：t=187551 `DOOR_ESCAPE_CLOSE door_living_entry:CLOSED` → t=187556 `NO_MOVEMENT: OPENING_DOOR`（+5 ms）→ t=187568 视线由 `LAST_SEEN` 恢复为 `VISION`（门被重新打开）→ t=187568 `DOOR_ESCAPE_SKIP door_living_entry:DOOR_COOLDOWN`（证明该门当时已回到 `OPEN`）。8 次关门中出现 1 次。
- 实施的最小修改（全部复用既有 `doorEscapeCooldownMs`，**无新增数值**）：
  - 新增 `recentlySelfClosedDoors()` / `isRecentlySelfClosed(id)`：本门冷却内的自关门集合。
  - `selectEscapeGoal` 新增可选参数 `allowRecentlyClosed`，寻路时传入屏蔽集（含「被堵出口改用替代路线」的第二次寻路）；若屏蔽后候选为空则**回退一次**允许使用该门（`*_SELF_CLOSED_FALLBACK`），避免原地卡死。
  - `followPath` 遇到自关门则清路径并设 `SELF_CLOSED_DOOR_REPATH`（与既有 `LOCKED_DOOR_REPATH` 同构），并计入 `doorEscapeSelfReopenBlockedCount`。
  - 重复尝试守卫：`doorLockAttemptedId` 记录已发起尝试的 pending，残留则拒绝第二次并计入 `doorLockRepeatBlockedCount`（正常流程不可达，属显式不变量）。
- 可观察性（未重做 DEV 面板）：`door-escape` 分类新增「自我重开门被抑制次数」；`door-lock` 计数行扩为 6 项（末位「重复尝试被拒」）。四种情形可区分：合法再次锁门（PENDING→EVALUATE→APPLY）、重复尝试（计数）、冷却阻止重关门（`DOOR_ESCAPE_SKIP:DOOR_COOLDOWN`）、Human 重开门取消（`DOOR_LOCK_SKIP:DOOR_REOPENED`）。
- 新增文件：`tests/deepseek-door-lock-oscillation.test.mjs`（13 项）。修改文件：`src/systems/DeepSeekAIController.ts`、`src/three/ThreeGame.ts`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`（新增 §2.5）、`docs/AGENT_LOG.md`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 325/325 项通过（上一轮 312 + 13）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：本次修复尚未经浏览器人工验收；手上仍无「修复后」的最新实机日志（唯一日志产生于侧向证据修复之前）。
- 下一步建议：浏览器验收（见汇报 F 节）；确认后再进入 3B-3。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-25 00:02 +08:00｜S7B-3B-3 定向回归测试

- 任务名称：S7B-3B 定向回归与长局不变量检查。当前阶段：3B-3 完成、待用户确认；未开始 3B-4；S7B 整体未完成。
- 覆盖审计（复用既有测试，未重复已覆盖用例）：用户列出的 10 个重点领域在 3B-0b～3B-2 的测试中均已覆盖——①关门→pending→锁门（含关门后失视的侧向证据）由 `deepseek-door-lock-integration` 覆盖；②同侧/过近/逼近/抓捕进度取消、③窗口超时/交互距离失效/门重开由 `deepseek-door-lock-decision` 覆盖；④3 把锁上限与锁芯失效由 `deepseek-door-lock` / `door-system` / `minesweeper-lock` / `human-door-skill` 覆盖；⑤同门与跨门冷却、⑥自关门重开与兜底、⑦一次动作一次尝试与 pending 清理由 `deepseek-door-lock-oscillation` 覆盖；⑧逃生路线与米堆可达由 `-decision` / `-integration` 覆盖；⑨冲刺冷却与不逃避摔倒由 `sprint` / `-oscillation` 覆盖；⑩SAFE_WAIT / 好奇 / 安全通行 / Human AI / 导航 / 门系统由各自套件覆盖。**唯一缺口是「长时间多帧连续对局下的跨系统不变量」**。
- 新增文件：`tests/deepseek-door-lock-longrun.test.mjs`（7 项，确定性模拟）：
  1. 同一扇门在 5000 ms 冷却内不会被二次关闭（40 个循环、逐门校验关闭间隔）；
  2. 不遗留 pending，且单个连续动作至多发出一次锁门命令；
  3. 同侧 / 过近 / 逼近 / 抓捕进度 / 失视 五类取消条件循环 25 次后均不遗留 pending；
  4. 被锁门不会封死全部剩余米堆路线；
  5. 锁门日志事件有界、不在相邻帧重复，且 `PENDING` / `EVALUATE` / `APPLY` / `CANCEL` 事件数与同名计数**逐一相等**（验证关键事件不漏记）；
  6. 门状态与动态碰撞在 12 次开关循环后仍同步，重开门后不残留障碍；
  7. 600 帧真实重规划中逃生目标不在相邻帧跳变（防房间间反复折返）。
- 发现的问题：**游戏代码无缺陷**。本轮 3 次测试失败全部来自新测试自身：(a) 最初绕过 `ai.update()` 直接调用内部 `updateSafety()`，导致 `threatEstimate` 未被赋值 → `selectEscapeGoal` 提前返回 → 关门评估从未执行（表现为「一次关门都没有」，属测试 harness 缺陷）；(b) 一度把「不同连续动作发出相同 `DOOR_LOCK_PENDING` 签名」误判为重复事件，实际这是每条动作必须留痕的正确行为。定位手段：写临时探针打印 `threatEstimate` / `lastEscapeDecisionReason` / `doorEscapeSkipReason`，确认 `skip=NONE` 即评估未执行；探针文件在系统临时目录，已删除。
- 实际修复：仅修改新测试文件（改用真实入口 `ai.update()`；删除自相矛盾的重复事件断言；补齐被误删的测试开头）。**未改动任何 `src/` 生产代码，未改动任何 `GAME_CONFIG` 数值。**
- 测试结果：`npm test` 332/332 项通过（上一轮 325 + 7）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。
- 长局口径：本轮为**确定性模拟长局**（约 40 个门遭遇循环 / 600 帧重规划），**不是实机长局验收**，不能替代浏览器实测。
- 已知问题：仍缺一份「修复后」的实机 AI JSON；3B-2 / 3B-3 的浏览器验收由用户完成。
- 下一步建议：确认后可进入 3B-4（DEV / 日志 / 文档收尾）。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-25 00:18 +08:00｜S7B-3B-4 DEV / AI 日志 / 文档收尾

- 任务名称：S7B-3B 收尾（DEV 面板、AI JSON 日志、文档同步）。当前阶段：**S7B-3B 代码与人工验收全部完成**；**未建立 Git 检查点**；未开始 S7C；S7B 整体未完成。
- 前提：用户确认 3B-2 浏览器人工验收 5/5 项通过、3B-3 定向回归 332/332（本轮收尾后 333/333）。
- DEV 面板审计（三个分类，只修正确实不准的显示，未重构面板）：
  - `Door Escape / 关门逃脱`：字段与源码一致；评估类字段（候选门、距离、已通过门、Human 在另一侧、关闭后路线、评估依据）只在 EVADE 的关门评估帧更新，故统一加「最近评估」前缀，避免被读成实时值；`放弃关门原因` → `最近放弃关门原因`。
  - `Door Lock / 主动锁门`：字段与源码一致；`最近锁门评估结果` 绑定 `doorLockReason`，而该字段在成功/失败回执时会被执行结果覆盖，故改名为 `最近锁门决策原因（执行成功时显示结果）`。确认没有过期或永不触发的原因码被静态展示（原因码均为实时值）。
  - `Sprint / 冲刺`：状态 / 就绪度、冷却剩余、本次剩余、风险模式、最近开始原因，均与含 30 秒冷却与 `readiness` 的 `SprintSystem` 一致。
- AI JSON 日志审计：`DOOR_ESCAPE_CLOSE / SKIP`、`DOOR_LOCK_PENDING / CANCEL / SKIP / EVALUATE / APPLY / FAILED`、`SPRINT_DECISION` 的命名、去重、时间戳、门 ID 与原因码一致；`doorDecision` 与 `doorLockDecision` 均按签名去重，不逐帧重复。发现并补两处**确实缺失**的信号（见文件改动）。
- 实机日志口径：**本轮用户未提供新的实机 JSON**；工作区与附件目录中唯一日志仍是 `who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`（产生于侧向证据修复之前），因此**未用它冒充新版本数据**；锁门频率、`SPRINT_IN_PROGRESS` 是否归零等仍需新日志复核。
- 修改文件：`src/systems/AILogCollector.ts`（新增 `sprintReadiness` 快照字段 + `SPRINT_READINESS` diff 规则）、`src/systems/DeepSeekAIController.ts`（自关门抑制新增带门 ID 的 `DOOR_ESCAPE_SELF_CLOSED` 事件）、`src/three/ThreeGame.ts`（DEV 标签修正 + 传递 `sprintReadiness`）、`tests/ai-log-collector.test.mjs`（+1 项冷却生命周期日志测试）、`tests/deepseek-door-lock-oscillation.test.mjs`（补自关门事件断言）、`docs/AI_DEEPSEEK_STATE_TREE.md`、`docs/GAME_BALANCE_CONFIG.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`、`docs/AGENT_LOG.md`。新增文件：无。删除文件：无。依赖变化：无。**未改动任何 `GAME_CONFIG` 数值**（`src/config/gameConfig.ts` 的改动仍来自 Sprint 冷却那一轮的 `cooldownMs`）。
- 文档收尾要点：`docs/AI_DEEPSEEK_STATE_TREE.md` 此前**严重滞后**——仍写「好奇/安全通行待验收」，且其重复数值表中 `visionEvadeDistance` 7、`escapeGoalHoldMs` 2,500、`dangerRiceAvoidMs` 8,000、`curiositySafeDistance` 3、`stationaryPassageChance` 0.80、`stationaryPassageSafetyMargin` 0.65、抓捕圈余量「合计 1.35 u」均与源码不符。本轮删除该重复表改为指向 `docs/GAME_BALANCE_CONFIG.md`，并新增「主动关门与主动锁门」章节（关门→pending→锁门状态机、侧向证据与关门后失视处理、自关门防折返、冲刺与门、3 把锁同时上限且不限整局次数）。`AGENTS.md` 的阶段状态**未改**——该文件要求 Gate 通过且 commit + push 成功后才更新，本轮未提交。
- 测试结果：`npm test` 333/333 项通过（3B-3 的 332 + 1）；`npm run build` 通过（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` 通过。
- 已知问题：仍缺一份「修复后」的实机 AI JSON；Git 检查点待用户批准。
- 下一步建议：由用户批准建立 Git 检查点（是否 commit / push 由用户决定）。
- Git commit 信息：本阶段归档为 S7B-3B 稳定检查点 `feat: complete s7b-3b proactive door locking`；实际 commit hash 与 push 结果以本次 Git 执行和最终汇报为准。不创建 Tag。

## 2026-09-25 21:53 +08:00｜S7C-0 阶段衔接审计与藏身系统设计

- 任务名称：S7C-0 阶段衔接审计与藏身系统设计。当前阶段：S7B 已全部通过人工验收（S7B-3B 稳定检查点 `6a92c5d`），**S7C 尚未开发**；本轮**只出设计与审计**，未写任何藏身玩法代码。
- 授权边界（严格执行）：只允许新增本阶段设计文档、必要时追加本日志；**不改生产代码、不改 `GAME_CONFIG`、不 commit / push / tag、不删除或暂存 `.trae/` 与 `.dsh-meow/`、不提前声称 S7C 完成**。
- 工程验证：`git status -sb` 仅 `?? .dsh-meow/`、`?? .trae/`；`git rev-parse HEAD` = `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`；`git log --oneline -5` 与 `ca18f61` 衔接正常；`.git/MERGE_HEAD`、`REBASE_HEAD`、`CHERRY_PICK_HEAD`、`rebase-merge`、`rebase-apply` 全部不存在。本次重跑 `npm test` 333/333 项通过（0 失败 / 0 已跳过，退出码 0）、`npx tsc --noEmit` 退出码 0。**未跑 `npm run build`**（无构建产物需求，且其会重写可重建的 `dist/`）。
- S7B 衔接判定：S7B **没有**未闭合 Gate、**没有**阻断 Bug。逐项分类——①已验收完成：S1–S6、S7A、S7B-1、S7B-2（含好奇/安全通行专项）、S7B-3A、S7B-3B（3B-0b～3B-4）；②不影响进入 S7C 的后续优化：S7B-2 偶发原地停留（`AGENTS.md`、`DEEPSEEK_HANDOFF.md:129`、`AI_STATE_OVERVIEW.md:62` 三处均记为「不阻断、留作后续 AI 优化项」）、正式 GLB 待机资源（S10）、Human AI 自动解锁 8,750 ms（S16）、缺一份「修复后」实机 AI JSON（只影响 3B 实机复核口径）；③必须先解决的阻断问题：**未发现**。本轮**未**把 S7B 标记完成。
- 藏身能力审计（全部以当前源码为准，不采信旧设计文档）：
  - 地图：`HIDE_SPOTS` 仅 5 个占位 `MapPoint`（`src/three/map/apartmentMap.ts:200-206`），坐标**恰好等于**对应 `FURNITURE` 家具碰撞矩形中心（`main_wardrobe` / `closet_wardrobe` / `storage_shelf` / `second_bed` / `study_bookshelf`）；仅 `DEBUG_MAP` 下画 `H0X` 调试精灵（`src/three/map/MapBuilder.ts:63-64`）。
  - **实测结论**：5 个点**都不可站立**（家具 AABB 中心），最近的合法站位在 0.50–1.30 世界单位外；`hide_main_wardrobe` 最近的「-X 侧」空隙是导航网格进不去的窄缝（两出生点 A* 均为 `null`），可用锚点在 +X 侧。实测候选锚点：`-15.55,-7.80` / `-14.30,10.00` / `-0.65,12.10` / `16.85,-7.50` / `-3.55,-7.60`（均对两个出生点可达）。→ S7C-1 必须先补「锚点/类型/家具关联」数据。
  - 角色与表现：`CharacterAction` 无藏身动作（`src/systems/CharacterAction.ts:2-5`）；`CharacterActionView.paint()` 明确**不移动/不缩放角色根节点**，因为根节点同时锚定碰撞与 Capture Zone（`src/three/CharacterActionView.ts:101-110`），`CaptureZoneView` 还是 Human 根节点的子对象（`ThreeGame.ts:134`）。
  - 交互可复用：`ThreeGame.handleDoorInteractions()`（`669-711`）+`nearestInteractableDoor()`（`759-762`）+ 进食范围 `rice.interactionRange / U = 1.0`（`597-612`）已构成 `E` 键统一仲裁链，藏身应并入而不是新开一套交互。
  - 感知：`PerceptionGeometry.inspectVision`（`src/systems/PerceptionSystem.ts:77-93`）只认墙体与非 OPEN 门叶；`VisionSystem`（`269-290`）只做一次 human↔deepseek 全局 LOS。**系统内没有任何「角色被隐藏」概念**，因此「藏身不可见」必须在感知层/输入层表达。
  - `CHECK_HIDE`：全项目仅出现于 `HumanAIState` 类型联合（`src/systems/HumanAIController.ts:10`，注释「stays reserved until S7C」），**无赋值、无转移、无输入字段**；`docs/AI_HUMAN_STATE_TREE.md:11,52`、`docs/AI_STATE_OVERVIEW.md:9` 一致承认为空接口。
  - 交互影响面：抓捕按 `captureRadius 0.70` + 视线未阻挡判定（`CaptureZone.ts:17-24`、`ThreeGame.ts:627-632`），而**藏身锚点在开阔地面**上 → 若不显式门控，藏身者会被照常抓捕；冲刺 `tryStart` 仅 `NORMAL` 且冷却为 0（`SprintSystem.ts:40-56`）；进食需 `NORMAL` + 零位移（`ThreeGame.ts:605-612`）。
  - 随机化影响面：门初始状态来自 `DoorNode.initialState` 常量（`apartmentMap.ts:68,76`，恒 `CLOSED`），被 `DoorSystem` 构造/`reset()`（`38,122`）与 `PerceptionSystem` 回退分支（`63,84`）使用 → **不能改常量**，须给 `DoorSystem` 运行时初始状态入口；米堆已支持注入随机源（`selectRiceCandidates(random)`），但 `ThreeGame.ts:281` 目前用默认 `Math.random`。
- 新增文件：`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（S7C 设计与实施计划：现状审计、数据/系统分层、S7C-1/2/3 拆解、待确认参数表、推荐最小闭环、审计命令与结果）。修改文件：`docs/AGENT_LOG.md`（本条）。删除文件：无。依赖变化：无。**未改任何生产代码、未改 `GAME_CONFIG`**。
- 设计要点（供后续阶段引用）：新增数据字段 `HideSpot.anchor / kind / furnitureId / facing`；新增纯逻辑 `src/systems/HideSystem.ts`（占用、进入前置条件、退出原因、事件，AI 输入不得含占用或对手实时位置）；交互并入 `E` 仲裁并按「扫雷 > 门 > 藏身 > 进食」排序；隐藏期间禁止移动/冲刺/进食/留米痕/发脚步声，且**不计入 Capture 判定**；感知抑制走 `VisionSystem` 单一真源；表现与判定分离（根节点不动）。红线：不传送、不删碰撞、不透视、不新增第二套交互/感知/导航系统、不凭空定数值。
- 需用户拍板的 18 项已列成表（关键 3 项）：①**DeepSeek AI 主动藏身是否纳入 S7C**（不纳入则玩家选 Human 时藏身玩法不可见、S7C-2 的「玩家检查」没有对象；建议纳入并作为 S7C-2b）；②进入安全条件与距离参数（建议复用 `1.5` 与 `captureProgressMs === 0`，交互距离 1.0 或 1.3）；③表现方案 V1（视觉进柜、根节点不动）/ V2（最保守）/ V3（隐藏根节点，仅 HUD）。
- 顺序结论：**没有发现必须打乱用户给定顺序 1→2→3 的证据**；建议保持，并在 S7C-3 的校验器里补「藏身锚点可达」一条。若纳入 AI 藏身，建议插为 S7C-2b。
- 诊断方法留痕：藏身锚点可达性用一次性 Node 脚本（`--experimental-strip-types` + 真实 `CollisionWorld`/`NavigationSystem`）在 `%TEMP%` 计算，**脚本已删除**，仓库内不残留临时文件。
- 测试结果：`npm test` 333/333 项通过；`npx tsc --noEmit` 通过；本轮无生产代码改动，故基线不变。`git diff --check` 以本次最终检查为准。
- 已知问题：S7C-1 的锚点数据、18 项参数与表现方案均**待用户确认**；藏身玩法一旦引入，「Human 玩家检查」在玩家选 DeepSeek 时缺少对象（第 1 项待决）；`hide_second_bed` 的「床底」语义需用侧面锚点表现（无法真正钻床）。
- 下一步建议：等用户批准 S7C-1 正式开发（并按第 6 节表拍板参数与表现方案）；**在用户批准前不写藏身玩法代码、不改 `GAME_CONFIG`**。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-25 22:03 +08:00｜S7C-0 补充轮：真实家具清单、藏身点清单与 1A/1B 拆分

- 任务名称：按用户补充要求重做「真实地图与家具数据」审计，提交藏身点清单、布局建议与最小实施计划。当前阶段：仍为 S7C-0（设计/审计轮）；**未写任何藏身玩法代码**。
- 用户补充边界（原话要点）：保持现有地图总体结构和已验收的 AI 行为不变；暂不制作正式家具美术；**不开发 Human AI 检查或随机布局**；不调整 `GAME_CONFIG`；**先提交清单与计划，等待确认后再改生产代码**。
- 家具实测（真实 `FURNITURE`，18 件，全部 `fullyInRoom` 且全部构成静态碰撞）：床 2 件（`main_bed` 主卧 2.1×2.3×0.45〔**无藏身标记**〕、`second_bed` 次卧 2.1×2.2×0.45）；衣柜/柜架 7 件（`main_wardrobe` 0.6×2.1×1.15、`closet_wardrobe` 0.55×2.4×1.1、`study_bookshelf` 0.6×2.1×1.1、`storage_shelf` 0.5×2.5×1.0、`second_cabinet` 0.6×1.4×1.0、`living_tv_cabinet` 1.5×0.6×0.65、`kitchen_fridge` 0.8×0.8×1.2）；其余 9 件为桌台/卫浴/坐具（沙发、茶几、餐桌、操作台、岛台、洗手台、浴缸、书桌、玄关长凳）。**结论：地图中没有任何纸箱/箱体**；已有藏身标记 5 个，但**没有任何交互接口**（只有 `MapBuilder.ts:63-64` 在 `DEBUG_MAP` 下画精灵）。
- 藏身点清单（6 个复用现有家具的锚点 + 1 个备选，全部满足「可站立、距家具 AABB ≥ 0.05、距最近门段 ≥ 2.0、距最近米点 ≥ 1.2、距可用导航格心 ≤ 0.45、两出生点 A* 可达」）：
  - 优先复用床：`main_bed` 主卧 (-14.40, -6.15)；`second_bed` 次卧 (-14.40, 8.90)。
  - 衣柜/柜架：`main_wardrobe` 主卧 (-16.65, -6.60)；`closet_wardrobe` 衣帽间 (-3.57, -8.80)；`study_bookshelf` 书房 (-0.80, 11.05)；`storage_shelf` 储物间 (16.80, -8.75)。
  - 备选：`second_cabinet` 次卧 (-15.60, 6.00)。
- 被排除的方案（有实测依据）：`HIDE_SPOTS` 现有主卧衣柜占位点与其正前方旧锚点距米点 `rice_09` 仅 **0.60 u**（落在 1.0 u 进食范围内，会与按住 `E` 进食抢键），故改用衣柜北侧 (-16.65, -6.60)（距最近米 2.23 u）；衣柜西侧贴墙的约 0.05 u 窄缝**导航网格进不去**，一律排除；`storage_shelf` 东侧无合法站位（距东墙 0.5 u）；`living_tv_cabinet`（高 0.65、贴墙）与 `kitchen_fridge`（贴墙、厨房通道紧）不适合。
- 「床底」物理限制（实测）：床碰撞体是 0.45 高的实心 AABB，角色高 0.7、半径 0.23 → **既不能站进床内也不能真正钻床下**；默认方案为「床边锚点 + 仅表现层画到床沿」，真正钻床需把床碰撞改成「床框 + 空洞」（属地图/碰撞改动，已列为待批选项）。
- 缺箱体的最简白模方案：**不需要为衣柜做新白模**（衣柜/书柜/货架已有），只缺纸箱；最简实现是**零新代码**，只往 `FURNITURE` 加一行 `furnishing('living_carton', 7.9, 3.9, 0.9, 0.9, 0.75)`，`MapBuilder.addObstacle`（`MapBuilder.ts:46-56`）会自动建 `BoxGeometry`、加入静态碰撞并在 `DEBUG_MAP` 下勾轮廓，再补一条 `HIDE_SPOTS`。已在真实 `CollisionWorld` + `NavigationSystem` 上离线模拟加入纸箱并重算既有地图不变量：`living_carton`(7.9,3.9)、`storage_carton`(15.7,-2.6)、`entry_carton`(3.0,11.6)、`study_carton`(-6.8,13.6) **四个位置全部保持不变量**（房间可达、14 米点可站立且可达、两出生点可站立、18 门及门前后 1 个角色直径处可站立、Human 出生点到所有房间 A* 可达），无纸箱基线自检同样通过。建议只加 `living_carton` + `storage_carton`。
- 交互冲突审计（新增校验项）：所有采纳锚点距最近门段 ≥ 2.0 u、距最近米点 ≥ 1.2 u，不会与 `E` 开门/锁门、按住 `E` 进食抢占同一位置。`E` 键优先级建议：扫雷面板 > 门 > 藏身点 > 进食。
- S7C-1 已按用户要求拆为 **S7C-1A 藏身点白模及地图配置**（`HideSpot` 扩展 + 表 3.1 数据 + 可选纸箱 + 锚点/不变量校验测试，**不接入玩法**）与 **S7C-1B 玩家基础藏身交互**（`HideSystem` + `E` 仲裁 + 移动/冲刺/进食/抓捕门控 + `VisionSystem` 隐藏入口 + `HideSpotView` + DEV `Hide` 分类）；S7C-2 / 2b / 3 本轮明确不做。
- 新增文件：无（本轮只更新已有设计文档与日志）。修改文件：`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（新增 §1.10 家具清单、重写 §3 为 1A/1B 并加入表 3.1 藏身点清单/白模方案/逐点规格、补充 §6 第 19–21 条、更新 §7/§8/文件头）、`docs/AGENT_LOG.md`（本条）。删除文件：无。依赖变化：无。**未改任何生产代码、未改 `GAME_CONFIG`**。
- 测试结果：`npm test` 333/333 项通过；`npx tsc --noEmit` 退出码 0（本轮无代码改动，基线不变）；`git diff --check` 以本次最终检查为准。
- 已知问题：6 个锚点坐标与纸箱数量**待用户确认**；「钻床底」需碰撞改动；玩家选 Human 时「检查藏身点」仍缺对象（取决于是否纳入 DeepSeek AI 藏身）。
- 下一步建议：批准 S7C-1A 后先落地地图数据与校验（零玩法风险），再单独批准 S7C-1B。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-25 22:19 +08:00｜S7C-1A 藏身点白模与地图配置

- 任务名称：S7C-1A 藏身点白模与地图配置（用户已正式批准）。当前阶段：S7B 已全部人工验收，S7C-1A 落地完成，**等待浏览器人工验收**；S7C-1B 仍未授权。
- 用户批准的布局（原话要点）：使用审计表 3.1 已验证的六个锚点（`main_bed`/主卧、`second_bed`/次卧、`main_wardrobe`/主卧、`closet_wardrobe`/衣帽间、`study_bookshelf`/书房、`storage_shelf`/储物间）；新增两个纸箱白模 `living_carton (7.9, 3.9)` 与 `storage_carton (15.7, -2.6)`，且**这两个位置必须再次通过真实地图导航和碰撞检查**；暂不添加 `second_cabinet`、玄关纸箱、书房纸箱；合计 **8 个藏身点**。床只登记两张床及其床边锚点，**不改床的实心碰撞**。
- 本轮明确不做（逐条遵守）：`HideSystem`、进入/退出/隐身按键、`Vision`/`Perception` 判定、Human `CHECK_HIDE`、Sprint/抓捕/进食规则、地图随机化、`GAME_CONFIG` 调整、提前开发 S7C-1B。
- 实现内容：
  1. `HideSpot` 数据结构 + **8 条数据**（`src/three/map/apartmentMap.ts`）：`kind`（`WARDROBE / BED / SHELF / CARTON`）、`furnitureId`、`facing`（锚点→家具中心的 XZ 方位角，弧度）、`label`（调试显示名）；**`MapPoint.x/z` 就是唯一合法锚点（进入 = 退出）**，不再单列 `anchor`，家具中心由 `furnitureId` 反查而**不存第二份坐标**（原 S7C-0 草案的 `anchor: Point` 已在设计文档 §2.2 记录为落地修正）。
  2. 8 个锚点：`hide_main_bed (-14.40,-6.15)`、`hide_second_bed (-14.40,8.90)`、`hide_main_wardrobe (-16.65,-6.60)`、`hide_closet (-3.57,-8.80)`、`hide_study_bookshelf (-0.80,11.05)`、`hide_storage_shelf (16.80,-8.75)`（六个均为用户批准的表 3.1 原值，**一个坐标都没改**）、`hide_living_carton (7.00,3.60)`、`hide_storage_carton (16.60,-4.80)`。五个原有占位 ID 保持不变（`hide_closet` 未更名，避免动已批准的 ID）。
  3. 2 个纸箱白模：`FURNITURE` 追加 `living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`，均 0.9×0.9×0.75；**零 Three.js 新代码**，复用 `MapBuilder.addObstacle`（BoxGeometry + 静态碰撞 + `DEBUG_MAP` 轮廓）。
  4. `DEBUG_MAP` 调试标记：`hideSpotDebugMarkers(enabled)` 只在调试开启时返回 8 条标记数据；`MapBuilder` 用新增的 `markerLines` 画两行精灵（「中文名 + 藏身点 ID」/「类型 (锚点 x, z)」）并在地面画锚点小方块。非 DEBUG 时函数返回空数组，普通玩家视图不包含任何藏身点信息。原有房名/米点/出生点标记保持单行、参数不变（`marker()` 现在只是 `markerLines(..., 34)` 的包装）。
  5. 新增 `tests/hide-spot.test.mjs`（9 项）：ID/房间/类型/家具绑定/朝向唯一且完整；`facing` 与反算一致；锚点在房间内且 `canOccupyStaticXZ` 可站立、距所属家具 AABB ≥ 0.05、不落在任何墙/家具盒内；距最近门段 ≥ 2.0；距最近米点 ≥ 1.2（且大于 `rice.interactionRange/U`）；距可用导航格心 ≤ 0.45；从两个出生点 A* 可达；`FURNITURE` 恰好 20 条且只新增这两个纸箱、不与其他盒子重叠、不压门/门前后点/米点；**加纸箱前后「仍可站立格」的连通性对比无孤立格**；非 DEBUG 不产生藏身点标记。
- 关键实测与修正（用户指定坐标复核）：**用户指定的 `storage_carton (15.7, -2.6)` 未通过真实地图检查**——它距米点 `rice_08 (16.1, -3.3)` 中心 0.81、纸箱 AABB 到米点仅 0.250，而 `tests/apartment-map.test.mjs` 的 `free()` 以 `PLAYER_DIAMETER/2 = 0.2667` 判定，实测报 `rice blocked rice_08`。按「必须通过真实检查」的要求，保留用户指定的 x=15.7（仍贴储物间西墙）而把 z 北移到 **-4.8**：距 `rice_08` 中心 1.55、不压任何门/门前后点/米点，且储物间的可通行性与连通性经对比测试证明未被切断。修正过程与证据写入 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §3.2/§8.1 与 `docs/MAP_SPEC.md`。
- 锚点余量实测（角色圆半径 0.23）：6 个家具锚点为 0.070–0.220，`hide_main_wardrobe (-16.65,-6.60)` 与 `hide_closet (-3.57,-8.80)` 只剩 **0.030 / 0.025**（来自已批准的表 3.1 原值，本轮未擅自改）。因 1B 的交互按「到锚点距离」判定，玩家不必站到点上，可用性不受影响；更宽松的替代坐标（`(-16.60,-6.40)` / `(-3.40,-8.80)`）与 `living_carton` 距东/南墙各 0.56、东/南两侧各剩约 0.10 宽圆心通道的观察已记入文档，供验收时决定。
- 修改文件：`src/three/map/apartmentMap.ts`、`src/three/map/MapBuilder.ts`、`docs/MAP_SPEC.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/AGENT_LOG.md`（本条）。新增文件：`tests/hide-spot.test.mjs`。删除文件：无。依赖变化：无。**未改 `GAME_CONFIG`、未改门/锁/冲刺/米堆/抓捕/感知规则、未接入任何藏身玩法**。
- 测试结果：`npm test` **342/342 项通过**（基线 333 + 新增 9，失败 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0（`cmd /c` 复核；Vite >500 kB 仍为非阻断提示）；`git diff --check` 退出码 0。临时复核脚本 `verify-hide.tmp.mjs` 在仓库根目录运行后**已删除，未入库**。
- 已知问题：S7C-1B 仍未授权；`hide_main_wardrobe`/`hide_closet` 锚点余量极小（0.025–0.030）、`living_carton` 两侧通道窄（约 0.10）——两者都不阻断，等浏览器验收决定是否微调；「钻床底」仍需床框+空洞碰撞的专项设计。
- 下一步建议：请用户按浏览器验收步骤在 `DEBUG_MAP` 下跑图确认 8 个锚点与 2 个纸箱的位置手感；验收通过后再单独批准 S7C-1B（届时才写 `GAME_CONFIG.hide` 与 `HideSystem`）。
- Git commit 信息：未提交；未 push；未创建 Tag。不将 S7C 整体标记完成，`AGENTS.md` 阶段状态未改（其规则要求 Gate 通过且提交推送成功后才更新）。

## 2026-09-25 22:43 +08:00｜S7C-1A 决策定案（用户确认 ①–④）

- 任务名称：S7C-1A 纯文档决策定案轮（用户已批准）。当前阶段：S7C-1A 已落地、**仍等待浏览器人工验收**；S7C-1B 未授权。本轮**只改文档，不改任何生产代码、测试或 `GAME_CONFIG`**。
- 用户批准与固定下来的四项决定（原话要点）：
  1. **接受** `storage_carton` 的 z 由 -2.6 改到 -4.8（原位置会压到 `rice_08`，修正是有明确测试依据的，而且不影响通路）。
  2. **两个衣柜锚点先不改**：「虽然余量偏小，但 1B 是『靠近锚点即可交互』，并不是要求角色圆心必须精确踩在点上。先浏览器走一遍，真觉得别扭再微调，避免为了理论余量来回改坐标。」
  3. **`living_carton` 先保持现在的位置**：「它虽然靠角落比较紧，但当前测试显示不挡门、不挡米、不破坏连通性。先看实机视觉效果再决定要不要贴到更里面。」
  4. **`hide_closet` 暂时不要改名**：「这个 ID 已经存在过，稳定 ID 比命名整齐更重要。」
- 本轮边界（用户原话要点）：只修改指定的三份 docs 文档；保留当前尚未提交的 S7C-1A 全部成果与 `.trae/`、`.dsh-meow/`；**不得将 S7C-1A 标记为人工验收通过**，不开始 S7C-1B、不 commit / push / tag；1B 参数集中列为待单独确认，**不得因已有建议值或之前生成过开发提示词就视为已经实施或验收**。
- 实际完成内容：
  1. `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`：§3.4 末条由「遗留观察（供 1B / 验收决定）」改写为「遗留观察与用户决定（2026-09-25 决策定案）」，保留全部实测数字（锚点余量 0.030 / 0.025、`living_carton` 墙距 0.56、两侧约 0.10 宽圆心通道），记录 ①–④ 四项决定与用户理由原话，原两条「若要更宽松 / 更干净可平移」改标为**未采纳备选值（仅备查）**，并注明任何坐标改动都必须重跑 `tests/hide-spot.test.mjs`、`tests/apartment-map.test.mjs` 与全量 `npm test`；§3.5 开头新增「前置（尚未满足）」块，写明 1B 未授权、需逐条确认第 6 节第 3–14 行参数、**存在建议值不等于已实施或已验收**；第 6 节标题下新增状态声明（第 2 行已由 1A 落地、第 19–21 行已定案、第 3–14 行属 1B 待单独确认、第 1 行与第 15–18 行未授权）；§8.2 新增本轮命令与结果表。
  2. `docs/MAP_SPEC.md`：S7C-1A 一节「遗留观察」改为「遗留观察与用户决定」，写明两项**按现行值保留**（先浏览器实机走一遍、真别扭再微调；稳定 ID 优先于命名整齐），理由 / 备选值以指针形式指向设计文档 §3.4（**不复制第二份真相**）；补一行「S7C-1B 未授权，本节只有地图数据与调试标记」。
  3. `docs/AGENT_LOG.md`：本条。
- 关键前提保留（未变）：四项决定只固定「不改坐标 / 不改名 / 接受 z 修正」，**不包含任何 1B 参数批准**；`hide_main_wardrobe` / `hide_closet` 锚点余量仍为 0.030 / 0.025，`living_carton` 两侧通道仍约 0.10 宽，均不阻断。
- 修改文件：`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/MAP_SPEC.md`、`docs/AGENT_LOG.md`（本条）。新增文件：无。删除文件：无。依赖变化：无。
- 测试结果：`npm test` **342 / 342 通过**（失败 0 / 已跳过 0，退出码 0）；`git diff --check` 退出码 0（仅 LF→CRLF 提示）；**本轮未跑 `npm run build`**（纯文档轮，且 `vite build` 会重写被忽略的 `dist/`；源码未变，上一轮构建结果仍然有效）。文档措辞自检：「若要更宽松」「若要更干净」「等浏览器验收时决定」在规范性正文中 **0 命中**（命中只出现在本条记录与设计文档 §8.2 引用这三个字符串说明「做过该自检」时，不计入）。
- 工作区核对：`git status --short` 与 S7C-1A 落地轮结束时完全一致（4 个 ` M` + 4 个未跟踪条目），**本轮未新增任何源码 / 测试改动**；`HEAD = 6a92c5d`，`origin/main...HEAD = 0 0`。设计文档仍是未跟踪文件，是否入库由后续授权轮决定。
- 已知问题：浏览器人工验收尚未执行（用户侧）；S7C-1B 未授权；「钻床底」仍需床框 + 空洞碰撞的专项设计单独批准。
- 下一步建议：用户按上一轮报告的浏览器验收步骤在 `DEBUG_MAP` 下跑一遍（8 个锚点 + 2 个纸箱）；验收通过后再单独批准 S7C-1B，并先逐条确认第 6 节第 3–14 行的参数。
- Git commit 信息：未提交；未 push；未创建 Tag。不将 S7C 整体标记完成，`AGENTS.md` 阶段状态未改（其规则要求 Gate 通过且提交推送成功后才更新）。

## 2026-09-25 23:16 +08:00｜DEV 场景热编辑器 V1 + 双阵营调试冻结

- 任务名称：《谁吃了我的米》独立 DEV 工具任务：场景热编辑器 V1 + 双阵营调试冻结。当前阶段：S7C-1A 已落地并等待浏览器人工验收，S7C-1B 仍未开发；本轮为独立 DEV 工具任务，**不提前开发藏身玩法**。
- 本轮边界（用户要求，逐条遵守）：不调整现有 `GAME_CONFIG` 游戏平衡参数；不开始 S7C-1B / 2 / 3；不 commit、push、tag；保留 `.trae/` 与 `.dsh-meow/`；不把 S7C 整体标记完成；完成后暂停等待人工验收。先检查 `git status` 并保留全部未提交的 S7C-1A 改动（未重置、未覆盖）。
- 架构审计结论（决定实现方式）：
  1. **所有玩法时间都来自 `dt`**：全项目仅两处墙钟（`AILogCollector` 导出时间戳、日志文件名），与冻结无关。因此冻结只需一个时间缝，不需要第二套暂停系统。
  2. `GameStateSystem` / `RiceField` / `SprintSystem` / `HumanDoorSkill` / 两套 AI / 感知 / 米痕全部由 `updatePlaying(deltaMs)` 推进；`PAUSED` 的实现方式正是「不调用 `updatePlaying`」。
  3. `CollisionWorld` 的静态盒是构造期 `Box3[]`，`NavigationSystem` 按 `CollisionWorld` + 门预计算格子；两者都**不支持安全增量更新**，因此按用户允许的方案采用「拖动预览 → 校验 → 提交时安全重建」。
  4. `buildApartment` 原先直接往 scene 建对象并只返回 `Box3[]`，无法按 ID 拾取也无法整体重建 → 重构为返回 `{ root, obstacles, furnitureMeshes, anchorGizmos, dispose() }`（`src/three/ThreeGame.ts` 是唯一调用方）。
- 实现内容：
  1. `src/systems/DevFreezeSystem.ts`（纯逻辑）：`MANUAL_DEV_FREEZE` / `SCENE_EDITOR` 两个独立原因可叠加，只有全部解除才回到 `RUNNING`；`manualFreeze` / `manualResume` / `openSceneEditor` / `closeSceneEditor` 只在 `PLAYING` 可用（FINISHED 不被复活）；编辑期间「恢复双阵营」被拒绝并给出 `SCENE_EDITOR_ACTIVE` 原因；`gameplayDelta(phase, dt)` 是唯一时间缝；事件 `DEV_FREEZE_ON / OFF`、`SCENE_EDITOR_OPEN / CLOSE` 只在状态真正变化时写入（不刷屏）；`reset()` 清空原因 / 事件 / 计数。
  2. `ThreeGame` 接入：`tick()` 改为 `const gameplayMs = devFreeze.gameplayDelta(...)`，仅 `gameplayMs > 0` 才 `updatePlaying`，冻结帧只 `input.clear()`（丢弃按键缓冲，防止恢复后重放）；`clock.getDelta()` 仍每帧读取，恢复不跳时间。DEV 面板新增「冻结双阵营 / 恢复双阵营」按钮 + `RUNNING/FROZEN｜原因` 状态文字；新增 DEV 分类 `dev-freeze`（双阵营状态、冻结原因、进入冻结前的游戏状态快照、最近被拒绝的冻结操作、场景编辑开关、当前选中、草稿合法性、最近拒绝编辑原因、已应用次数、事件计数）。冻结期间不执行 `updatePlaying`，因此 AI JSON 不会出现由冻结造成的卡路 / 追逐失败 / 计时异常。
  3. `src/three/map/MapEditModel.ts`（纯逻辑，可在 Node 中直接测真碰撞 / 真导航）：三层数据（原始 / 草稿 / 已应用）、28 个可编辑对象（20 家具 + 8 锚点）、只读字段保护、`EDIT_LIMITS`（宽深 0.2–4、高 0.1–1.6、锚点余量 0.05、锚点–家具上限 0.9、0.3 网格）、拒绝码 `ROOM_BOUNDARY / SIZE_OUT_OF_RANGE / NOT_QUARTER_TURN / BLOCKS_DOOR / COVERS_RICE / SPAWN_BLOCKED / ROOM_UNREACHABLE / ANCHOR_INSIDE_OBSTACLE / ANCHOR_DETACHED / OVERLAPS_FURNITURE / INVALID_VALUE / READ_ONLY_FIELD / NOT_FOUND`、拒绝即回滚、`diff()`、`resetTarget()`、`exportJson()`。连通性校验复用 `tests/apartment-map.test.mjs` 同款 `free()` 判据与 0.3 网格洪水填充；锚点用真实 `CollisionWorld.canOccupyStaticXZ` 校验。**原始地图数据从未被修改**（有测试断言）。
  4. `src/three/SceneEditorView.ts`（Three）：真实 `Raycaster` 拾取家具 mesh 与锚点 gizmo（锚点另有 `opacity: 0` 的可拾取圆柱命中体，被墙 / 家具 / 标签遮挡也能从列表选中）；地面圆环 + 中心点 + 竖直定位线的锚点定位标记与显隐开关；`BoxHelper` 选中高亮；拖动按对象中心水平面求交（不跳点），拖动只写草稿；预览着色（合法绿 / 非法红）。
  5. `src/three/SceneEditorPanel.ts`（DOM）：右上角「场景编辑」入口（`sceneEditorEnabled(import.meta.env.DEV, factionSwitchEnabled)`，生产不显示）、右侧编辑器面板（可搜索对象列表 = 家具 20 + 锚点 8、只读身份信息、数值输入 + 0/90/180/270 朝向、差异预览、最近拒绝原因、草稿状态、应用 / 放弃 / 恢复初始值 / 聚焦镜头 / 导出 JSON）。
  6. `src/three/SceneEditor.ts`（编排）：打开时 `openSceneEditor()` 自动冻结；关闭时丢弃未应用草稿并重建（「不保留非法编辑预览」，已应用编辑保留）、只解除 `SCENE_EDITOR`（手动冻结仍在）；应用编辑 → `apply()` → `rebuildApartment()`；拖动 / 输入被拒绝时回滚并提示；镜头聚焦 / 缩放（0.45–2.5，退出编辑器复位）/ 平移；`statusEntries()` 供 DEV 面板。
  7. 热编辑同步（`ThreeGame.rebuildApartment`）：`ApartmentBuild.dispose()` → 用**已应用数据**重建整棵公寓（`DEBUG_MAP` 藏身标记与锚点 gizmo 一并跟随）→ 新建 `CollisionWorld` + `NavigationSystem` → `humanAI.rebindNavigation()` / `deepseekAI.rebindNavigation()`（换网格、清缓存路径、`lastNavigationReason = 'MAP_REBUILT'`，不重置其他 AI 状态）→ `syncAllDoors()` 重新登记门的动态碰撞盒。
  8. 测试：新增 `tests/dev-freeze.test.mjs`（11 项：原因叠加、只 PLAYING 可切换、编辑期间拒绝恢复、重开清空、FINISHED 不复活、`gameplayDelta` 表格、**真实系统帧循环 harness** 证明冻结期间对局时间 / 抓捕进度 / 米进度 / 冲刺与冷却 / 破锁冷却 / 门状态 / 结算全部不变且恢复只前进一个 `dt`）与 `tests/scene-editor.test.mjs`（14 项：28 对象与只读字段、原始地图零拒绝、合法移动 / 缩放后真实碰撞与导航同步、90° 旋转 AABB 互换、字段级保护、拒绝回滚、门 / 米 / 出生点 / 连通性 / 锚点各自触发、重叠拒绝、恢复初始值、导出字段与只应用数据、原始模块数据未变、DEV 开关）。更新 `tests/debug-details-panel.test.mjs` 期望（新增 `dev-freeze` 分类）。
- 新增文件：`src/systems/DevFreezeSystem.ts`、`src/three/map/MapEditModel.ts`、`src/three/SceneEditorView.ts`、`src/three/SceneEditorPanel.ts`、`src/three/SceneEditor.ts`、`tests/dev-freeze.test.mjs`、`tests/scene-editor.test.mjs`、`docs/DEV_SCENE_EDITOR_DESIGN.md`。修改文件：`src/three/ThreeGame.ts`、`src/three/DebugDetailsPanel.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`、`src/systems/HumanAIController.ts`、`src/systems/DeepSeekAIController.ts`、`src/style.css`、`tests/debug-details-panel.test.mjs`、`docs/MAP_SPEC.md`、`docs/AGENT_LOG.md`（本条）。删除文件：`verify-edit.tmp.mjs`（本轮临时校验脚本，用完即删、未入库）。依赖变化：无（未新增依赖）。**未改 `GAME_CONFIG`、未改 `docs/GAME_BALANCE_CONFIG.md`、未接入任何藏身玩法、未改门 / 锁 / 冲刺 / 米堆 / 抓捕 / 感知规则。**
- 测试结果：`npm test` **367 / 367 通过**（基线 342 + 新增 25，失败 0 / 已跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 `tsc --noEmit` + vite build）退出码 0（`cmd /c` 复核 `$LASTEXITCODE`；Vite >500 kB 仍为非阻断提示）；`git diff --check` 退出码 0（仅 LF→CRLF 提示；本轮修复了 `src/style.css` 的 EOF 空行）。
- 开发服务器冒烟（非单元测试）：`npm run dev -- --host 127.0.0.1 --port 5174` 启动成功，`/`、`/src/main.ts`、`/src/systems/DevFreezeSystem.ts`、`/src/three/map/MapEditModel.ts`、`/src/three/SceneEditorView.ts`、`/src/three/SceneEditorPanel.ts`、`/src/three/SceneEditor.ts`、`/src/three/ThreeGame.ts`、`/src/three/DebugDetailsPanel.ts`、`/src/three/map/MapBuilder.ts`、`/src/style.css` 全部 HTTP 200 且无 esbuild 转换错误，说明新增模块在真实开发图里能解析。
- 已知问题 / 未验证：**浏览器交互（面板 DOM、Raycaster 拾取、拖动预览、镜头聚焦、冻结按钮点击）本轮未由我实机验证**——尝试用 Tabbit Browser 自动冒烟时其 stable launcher 返回 `exit 69`（路由不可用 / 不可达），且当时 Tabbit Browser 进程未运行；按该工具链约定不自行启动或改写其运行时，因此这部分留给浏览器人工验收。家具朝向只支持 90° 整数倍（自由旋转需要 OBB 碰撞，属架构级改动）；拖动不做逐帧校验；无撤销 / 重做；已应用编辑只在内存，刷新即回到 `apartmentMap.ts`。
- 下一步建议：按 `docs/DEV_SCENE_EDITOR_DESIGN.md` §9 做浏览器人工验收（冻结 / 恢复、编辑期间拒绝恢复、拖动与数值编辑、非法编辑拒绝、锚点显隐与聚焦、JSON 导出、关闭后恢复、重开清理）；验收通过后再单独批准 S7C-1B 并先确认其参数。

## 2026-09-25 23:39 +08:00｜DEV 编辑器轮 FAIL 阻断修复（DEV 调控台被盖住 / 场景编辑无响应 / 双方不能行动）

- 任务名称：修复用户浏览器人工验收 失败 的三个阻断问题。当前阶段：S7C-1A 仍等待浏览器验收、S7C-1B 未授权；本轮**只修复阻断问题，不新增场景编辑功能、不改 `GAME_CONFIG`、不开始 S7C-1B / 2 / 3**。
- 用户报告的实际故障：①原有 DEV 调控台及其交互按钮消失；②右上角只剩「场景编辑」；③点击「场景编辑」没有反应；④找不到「冻结双阵营」；⑤玩家与 AI 都不能正常行动。
- 根因 A（DEV 调控台「消失」，与被修代码无关的功能其实都在）：上一轮把入口写成绝对定位的 `.dev-launcher { position: absolute; top: 10px; right: 10px; z-index: 6 }`，与 `.debug-panel`（`top: 10px; right: 10px; z-index: 4`）的 `DEV ▾` 展开开关**完全重叠**。实测：`DEV ▾` 宽 62px（x 690–752），新按钮宽 68px（x 684–752），`document.elementFromPoint(DEV ▾ 中心)` 返回 `scene-editor-launch` → 原 DEV 面板唯一的展开开关被不透明按钮盖住且点不到，面板本体（连同其中的「冻结双阵营」按钮）因此表现为「消失」。展开面板后实测原有 5 个控件（临时控制 Human / 临时控制 DeepSeek 娘 / 导出本局 AI 日志 / 冻结双阵营 / AI 安全路径可视化）与 11 个分类全在，没有任何原有 DOM 被删除或改写。
- 根因 B/C（③ 点击无响应 + ⑤ 双方不能行动，同一个根因）：`ThreeGame.tick()` 的 READY 分支被误喂 `gameplayDelta`，而 `gameplayDelta` 在 `phase !== 'PLAYING'` 时恒返回 0 → `match.advanceReady(0)` 永不推进 → 对局**永远停在 READY**：`updatePlaying` 从不执行（玩家与两套 AI 全部静止），而 `openSceneEditor` 因 `NOT_PLAYING` 一直被拒绝，拒绝原因只写进未打开的编辑器面板（`SceneEditor.message`）→ 按钮看起来彻底无响应。实测证据：选择阵营后 2.4 秒内 DEV 面板「对局状态 / 时间」恒为「准备：3 秒 / 00:00」，间隔 1.4 秒的两帧截图逐字节相同。
- 修复内容：
  1. `DevFreezeSystem.readyDelta(deltaMs)`：把「READY 是阶段计时器、不属于玩法模拟、不得被冻结门控」固化为显式接口，`tick()` 的 READY 分支改用 `readyDelta(deltaMs)`，PLAYING 分支仍用 `gameplayDelta`。
  2. `DebugDetailsPanel` 新增 `readonly topRow`（`.debug-top-row`）并把 `DEV ▾` 放进该行；`SceneEditorPanel` 把「场景编辑」按钮 `prepend` 进同一行（flex 项，不再是绝对定位覆盖层），删除 `.dev-launcher` CSS 规则 → 两个按钮在任何视口宽度下都不可能再重叠。
  3. 拒绝必须可见：新增 `.scene-editor-notice`（同一行内提示，8 秒后自动隐藏、打开编辑器时清除）与 `SceneEditorPanel.showNotice()`；`SceneEditor.requestOpen()` 失败时调用新增的纯函数 `sceneEditorRefusalNotice(phase, rejection)`，PLAYING 之外显示「场景编辑需要先进入对局（当前 READY）」，不再静默。
  4. DEV 工具栏把「冻结双阵营」按钮与状态文字包进 `.details-freeze-row`（同一行，避免工具栏再长两行）；工具栏状态里的拒绝原因补上「最近拒绝：」前缀（符合本项目调试标签纪律）。
  5. 短窗口可用性：`.scene-editor-detail { flex: 1 1 auto; min-height: 0 }`、`.scene-editor-list { flex: 0 1 auto; min-height: 72px }` → 窗口很矮时对象/属性区内部滚动，而不是被 `overflow: hidden` 裁掉、连输入框都够不到。
  6. `SceneEditor.ts` / `SceneEditorView.ts` / `SceneEditorPanel.ts` 的 import 补 `.ts` 扩展名（与 `src/systems/*` 既有写法及 `allowImportingTsExtensions` 一致，同时让这些模块能被 Node 测试导入）。
  7. 顺带修正 `src/style.css` 中上一轮写入的两行二次编码中文注释（改为 ASCII 注释，`style.css` 现无非 ASCII 行）。
- 新增测试：`tests/dev-freeze.test.mjs` +2——`readyDelta` 在手动冻结下仍返回真实帧时间；**READY→PLAYING 回归**（用真实 `GameStateSystem` + `DevFreezeSystem` 正向跑到 `PLAYING`，并用同一循环改喂 `gameplayDelta` 作反例，断言仍卡在 `READY`，即本轮事故的复现式反证）。`tests/scene-editor.test.mjs` +1——拒绝必须产出含当前 phase 的可见原因文字。
- 真实浏览器验证（本机 Chrome 153 `--headless=new` + CDP `Runtime.evaluate` / `Input.dispatchMouseEvent` / `elementFromPoint` / `Page.captureScreenshot`；**不是 Tabbit Browser**：其 stable launcher 仍返回 `exit 69` 且运行时未运行，按该工具链约定未自行启动）：①`elementFromPoint(DEV ▾ 中心) = debug-toggle`、`场景编辑` 在 x 616–684 / `DEV ▾` 在 x 690–752（不再重叠），面板可展开、11 个分类与 5 个原有控件齐全；②READY 期间点「场景编辑」→ 提示「场景编辑需要先进入对局（当前 READY）」，面板保持关闭、双阵营仍 `RUNNING`；③倒计时正常走完（准备 3 → 2 → 1 秒 → 对局中），对局时间 00:00 → 00:02、两帧截图不同（AI 正常行动）；④DEV「冻结双阵营」→ `FROZEN｜MANUAL_DEV_FREEZE`、对局时间停住、冻结期间两帧截图逐字节相同；⑤手动冻结下打开编辑器 → `FROZEN｜MANUAL_DEV_FREEZE + SCENE_EDITOR`（原因叠加）、列表 28 行（家具 20 + 藏身锚点 8）；⑥真实鼠标点选对象 → `当前选中：living_sofa`，改 `height 0.65 → 0.75` → 草稿差异行正确、输入区 6 个控件可交互；⑦点「应用编辑」→ `已应用编辑：1`、差异复位为「与已应用地图一致」、事件 `SCENE_OBJECT_EDIT_APPLY`，**真实重建（dispose → buildApartment → 新 CollisionWorld + NavigationSystem → rebindNavigation → syncAllDoors）无任何控制台报错**；⑧编辑期间点「恢复双阵营」→ 被拒绝并显示 `SCENE_EDITOR_ACTIVE`，仍 `FROZEN`；⑨关闭编辑器 → `body` 类移除、编辑器面板 `hidden`、只剩入口按钮可见、画布上 `elementFromPoint` 命中 `CANVAS`（无透明遮挡层）、手动冻结仍生效；⑩手动恢复 → 时间重新走动；⑪Esc → 暂停菜单 → 重新开始 → `RUNNING｜无`、回到「准备：3 秒」并能再次进入 `对局中`（重开不残留冻结）；⑫1440×900 桌面视口下对象列表 / 数值输入 / 朝向下拉 / 应用按钮 / 搜索框 / 锚点开关 / 状态块全部可命中；⑬全程控制台错误 0。
- 修改文件：`src/systems/DevFreezeSystem.ts`、`src/three/ThreeGame.ts`、`src/three/DebugDetailsPanel.ts`、`src/three/SceneEditor.ts`、`src/three/SceneEditorPanel.ts`、`src/three/SceneEditorView.ts`、`src/style.css`、`tests/dev-freeze.test.mjs`、`tests/scene-editor.test.mjs`、`docs/DEV_SCENE_EDITOR_DESIGN.md`、`docs/AGENT_LOG.md`（本条）。新增 / 删除文件：无。依赖变化：无。**未改 `GAME_CONFIG`、未改任何玩法规则、未接入藏身玩法、未开始 S7C-1B。**
- 测试结果：`npm test` **370 / 370 通过**（基线 367 + 新增 3，失败 0 / 已跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build` 退出码 0（Vite >500 kB 仍为非阻断提示）；`git diff --check` 退出码 0（仅 LF→CRLF 提示）。`HEAD` 仍 `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`，`origin/main...HEAD = 0 0`，未 commit / push / tag。
- 已知问题 / 未验证：①Tabbit Browser 层未验证（其运行时未运行、launcher exit 69），上述浏览器结论来自本机 Chrome headless；②窗口高度很矮（实测 762×484，面板可用高 428）时编辑器对象列表与属性区会互相挤压，属性区只剩约 58px 并需要内部滚动才能点到输入框——桌面常规高度（1440×900）完全正常，属后续可优化的布局密度问题；③`vite` 开发服务器在本轮多次因 `edit` 工具的原子上写入触发 `EBUSY` 文件监听崩溃（`node:internal/fs/watchers`），已在每次改文件前主动停服、改完重启，未产生仓库内残留文件；④家具朝向仍只支持 90° 整数倍、无撤销 / 重做、已应用编辑只在内存（刷新回到 `apartmentMap.ts`）——均为上一轮记录的既有设计边界。
- 下一步建议：请用户在浏览器中重新验收（先确认右上角 `DEV ▾` 可展开、`场景编辑` 在其左侧、DEV 面板内可见「冻结双阵营」；再确认进入对局后双方能正常行动）；修复后仍需按 `docs/DEV_SCENE_EDITOR_DESIGN.md` §9 复核冻结 / 恢复 / 编辑 / 导出等条目；验收通过后再单独批准 S7C-1B 并先确认其参数。
- Git commit 信息：未提交；未 push；未创建 Tag。不将 S7C 整体标记完成，`AGENTS.md` 阶段状态未改（其规则要求 Gate 通过且提交推送成功后才更新）。
- Git commit 信息：未提交；未 push；未创建 Tag。不将 S7C 整体标记完成，`AGENTS.md` 阶段状态未改（其规则要求 Gate 通过且提交推送成功后才更新）。
- （本条为上一轮追加时产生的重复行，按「不修改 `AGENT_LOG.md` 历史内容」规则保留未删。）

## 2026-09-26 00:22 +08:00｜S7C-1A 与 DEV 场景热编辑器 V1 人工验收通过（收尾与检查点审计轮）

- 任务名称：S7C-1A（藏身点白模与地图配置）与 DEV 场景热编辑器 V1 + 双阵营调试冻结的验收收尾、成果完整性核对与 Git 检查点文件审计。当前阶段：两项均由用户确认**浏览器人工验收 通过**，并在同一轮内获准建立 Git 检查点（见文末 Git 条目）；S7C-1B 未授权、未开始。本轮**只改文档，不改任何生产代码、测试或 `GAME_CONFIG`**，不开发任何新功能。
- 用户确认的五项浏览器人工验收（原文记录）：
  1. DEV ▾ 和场景编辑入口均可正常点击：通过
  2. READY 倒计时、玩家与 AI 行动：通过
  3. 手动冻结、恢复及编辑器自动冻结：通过
  4. 八个藏身点的列表选择和遮挡点聚焦：通过
  5. 两个纸箱通行、家具编辑后的碰撞同步：通过
- 本轮实际完成内容（仅文档）：
  1. `AGENTS.md`：S7B-3B 补记稳定检查点 `6a92c5d`；新增「已完成人工验收、尚未建立 Git 检查点（不计入阶段 Gate）」小节，登记 S7C-1A 与 DEV 场景热编辑器 V1 两项人工验收 通过；「当前下一阶段」更正为 S7C-1A 已验收、S7C-1B 未授权且开工前须逐条确认设计文档第 6 节第 3–14 行参数；自动化基线 333 → **370**；地图状态由「5 个 HideSpot 仍为占位」更正为 8 条 HideSpot 数据 + 2 个纸箱、正式藏身玩法未实现；Build Environment 补记 `npm run dev` 固定 `http://127.0.0.1:5173/`。
  2. `docs/DEEPSEEK_HANDOFF.md`：Git 边界更新为当前 HEAD `6a92c5d`（3B 已并入）且 S7C-1A / DEV 编辑器轮未提交；启动命令由 `--port 5174` 更正为裸 `npm run dev`（`vite.config.ts` 固定 5173 + `strictPort`）；阶段表补 S7C-1A 与 DEV 编辑器 V1 两行人工验收 通过 并更正 S7B-3B 行（已并入检查点）；§6 由「下一项：S7B-3B」更正为「已完成，保留原始约束记录」；§8 开发预览命令同步；§9 自动化基线 333 → 370、chunk 大小更新、补两项验收态；新增 §10 记录 DEV 场景热编辑器 V1 与双阵营调试冻结（含冻结两原因、`gameplayDelta` / `readyDelta` 双时间缝、编辑器校验与边界）。
  3. `docs/DEV_SCENE_EDITOR_DESIGN.md`：状态行由「等待浏览器人工验收」改为「用户浏览器人工验收 通过（2026-09-26），尚未建立 Git 检查点」；§9 步骤 1 的启动命令改为 `npm run dev` + `http://127.0.0.1:5173/`。
  4. `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`：§3.4 标题与浏览器验收行由「等待浏览器人工验收」改为 通过，并记录用户五项结果中的第 4、5 项。
- 未提交差异审计（`git status --porcelain` + `git diff --stat`，最终态）：已跟踪文件 **13 个被修改**——其中 3 个是本轮收尾新增的文档改动（`AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`，以及 `docs/S7B3B_DOOR_LOCK_DESIGN.md` 的状态行更正为「已并入检查点 `6a92c5d`」），其余 10 个为此前各轮累计（`docs/AGENT_LOG.md`、`docs/MAP_SPEC.md`、`src/style.css`、`src/systems/DeepSeekAIController.ts`、`src/systems/HumanAIController.ts`、`src/three/DebugDetailsPanel.ts`、`src/three/ThreeGame.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`、`tests/debug-details-panel.test.mjs`）；新文件 **11 个**（`src/systems/DevFreezeSystem.ts`、`src/three/map/MapEditModel.ts`、`src/three/SceneEditorView.ts`、`src/three/SceneEditorPanel.ts`、`src/three/SceneEditor.ts`、`tests/hide-spot.test.mjs`、`tests/dev-freeze.test.mjs`、`tests/scene-editor.test.mjs`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md`、`vite.config.ts`）。合计 **24 个文件**（13 改 + 11 新），即本轮建议的 Git 检查点文件清单。
- 完整性核对（逐项通过）：①S7B-3B 锁门链路未被触碰——`DeepSeekAIController.ts` / `HumanAIController.ts` 的全部差异**只有**新增 `rebindNavigation()` 与其 `navigation` 字段由 `readonly` 改为可变；②8 个藏身点 ID / 坐标与 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 完全一致（`hide_main_bed (-14.40,-6.15)`、`hide_second_bed (-14.40,8.90)`、`hide_main_wardrobe (-16.65,-6.60)`、`hide_closet (-3.57,-8.80)`、`hide_study_bookshelf (-0.80,11.05)`、`hide_storage_shelf (16.80,-8.75)`、`hide_living_carton (7.00,3.60)`、`hide_storage_carton (16.60,-4.80)`）；③2 个纸箱 `living_carton (7.9,3.9)` / `storage_carton (15.7,-4.8)` 与 0.9×0.9×0.75 尺寸在 `FURNITURE` 中在位；④`DevFreezeSystem` 的 `MANUAL_DEV_FREEZE` + `SCENE_EDITOR` 双原因叠加与 `gameplayDelta` / `readyDelta` 双时间缝均在；⑤根目录 `vite.config.ts`（`host 127.0.0.1` / `port 5173` / `strictPort: true`）存在且已实测生效（占用 5173 时裸跑 `npm run dev` 直接 `Error: Port 5173 is already in use`、退出码 1，5174 / 5175 无监听）；⑥`src/config/gameConfig.ts` 与 `docs/GAME_BALANCE_CONFIG.md` **未出现在差异清单中**，全库无 `console.log` / `debugger` / `TODO` 新增残留；⑦仓库内无临时脚本、无 `dist/`、无日志文件残留。
- 排除项确认：`.trae/`（1 个文件）与 `.dsh-meow/`（4 个文件，含 `memory.db`）保持未跟踪、不被暂存；`dist/` 仍在 `.gitignore` 内；无临时 AI JSON 日志或个人配置。
- 测试结果：`npm test` **370 / 370 通过**（失败 0 / 已跳过 0 / 已取消 0，退出码 0）；`npm run build`（含 `tsc --noEmit` + `vite build`）退出码 0（`cmd /c` 复核 `$LASTEXITCODE`；Vite >500 kB 仍为非阻断提示）；`git diff --check` 退出码 0（仅 LF→CRLF 提示）。
- 工作区核对（**提交前快照**）：`HEAD = 6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`，`origin/main...HEAD = 0 0`，`git status --porcelain` 共 26 条（13 ` M` + 13 `??`，其中 2 条 `??` 为 `.trae/`、`.dsh-meow/`），与「24 个文件 + 2 个用户资料目录」一致。
- 已知问题：①`AGENT_LOG.md` 上一轮追加留下一条完全重复的「Git commit 信息」行，按既有规则本轮未删（本轮只在其后补一行说明）；②S7B-3B 修复后仍缺一份完整实机 AI JSON；③窗口高度很矮（实测 762×484）时场景编辑器属性区布局偏紧；④Tabbit Browser 仍不可用（stable launcher `exit 69`），浏览器验证改用本机 Chrome headless + CDP，替用户打开页面用系统 Chrome（以到 5173 的 ESTABLISHED 连接为证据）。
- 下一步建议：用户已确认 24 个文件清单与建议提交说明后，随即执行 commit / push（不使用 `--force`、不创建 Tag）；之后 S7C-1B 需用户单独授权，并在开工前逐条确认设计文档第 6 节第 3–14 行参数。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：计划提交标题 `feat: complete s7c-1a hide spots and dev scene editor v1`，检查点含 24 个文件且不创建 Tag；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。不将 S7C 整体标记完成；`AGENTS.md` 的更新按用户本轮明确指示执行，并以「不计入阶段 Gate」措辞记录。

## 2026-09-26 +08:00｜AGENTS.md 长期开发规则批准 + 三份文档状态同步（纯文档轮）

- 任务名称：《谁吃了我的米》纯文档同步轮——保留并核对 `AGENTS.md` 上一轮的长期前置条件与阶段状态修正，把已确认过期的 Git 检查点 / 阶段 Gate / 当前开发状态同步到 `docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md`，并记录两项未决设计约束。当前阶段：当前稳定检查点 `3191bec`（S7C-1A 与 DEV 场景热编辑器 V1 均已通过 Gate），S7C-1B 未授权。
- 本轮边界（用户要求，逐条遵守）：**不开发任何游戏功能**；仅允许修改 `AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md`、`docs/AGENT_LOG.md`（仅追加）；不 commit / push / tag；保留 `.trae/` 与 `.dsh-meow/`（不读取、不删除、不暂存）；不新开开发服务器；**保留历史日志原文，不回改旧记录**；纯文档修改不要求重跑 `npm test` 与 `npm run build`，但发现意外源码变更必须立即停止。
- 开始前核对（只读）：`main` 分支；`HEAD` = `origin/main` = `3191bec843606ae4bab01d6932cff0ac87955101`；`git rev-list --left-right --count origin/main...HEAD` = `0 0`；`git status --porcelain` 仅 ` M AGENTS.md` 与未跟踪 `.dsh-meow/`、`.trae/`；`.git/MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` 全部不存在；`git tag` 仍为历史 7 个。
- 实际完成内容：
  1. `AGENTS.md`（保留上一轮全部长期前置条件与阶段状态修正，逐条核对无误：S7C-1A 与 DEV 场景编辑器 V1 已通过 Gate；S7B 与 S7C 整体仍未完成；DEV-A / DEV-B 是待批准提案；S7C-1B / 2 / 2b / 3 均未授权）：在「前置条件 3：DEV-A 设计确认」末尾新增**未决设计约束**——DEV-A 的圆形／扇形藏身交互区域尚未批准，因此暂时保留现有单一 anchor（`HideSpot.x/z` 即唯一进入点 = 退出点），现有 8 条锚点数据继续有效、语义不变；是否把进入锚点与退出锚点拆成两个独立点留到未来单独决定，本阶段不拆分、不预留两套字段。在「前置条件 4：DEV-B 技术审计」末尾新增**未决设计约束**——必须把 `GAME_CONFIG` 原始值、本局 DEV 覆盖值、运行时实际生效值三层显式分开（DEV 面板任何时刻可分辨当前生效值来源）；不得把调试预设直接写回正式平衡配置（不改 `src/config/gameConfig.ts` 默认值与 `docs/GAME_BALANCE_CONFIG.md` 记录值），也不得让它成为下一局或刷新后的默认值。
  2. `docs/DEEPSEEK_HANDOFF.md`：§2 Git 边界由 `6a92c5d`（S7C-1A / DEV 编辑器轮「产物未提交」）更正为**稳定检查点 `3191bec`（24 个文件、+3976/−71、已推送、`0 0`）**，并补合并变基残留检查、`.trae/` / `.dsh-meow/` 不得读取或暂存的措辞，以及**指向 `AGENTS.md`「长期开发路线与下一阶段开发前置条件」整节的引用（不复制整套规则）**与当前授权状态（S7C-1B / 2 / 2b / 3 未授权、DEV-A / DEV-B 待批准）；§4 阶段表把 S7C-1A、DEV 场景热编辑器 V1 两行的「尚未建立 Git 检查点」改为「人工验收 通过、阶段 Gate = PASS、已并入 `3191bec`」，「下一项」行改为 S7C-1B 需单独授权 + 逐条批准第 6 节第 3–14 行 + DEV-A / DEV-B 未排入开发；§9 自动化基线补「截至 `3191bec`」并把「当前状态」改为两项已 Gate 通过 并已并入检查点，明确 S7B / S7C 整体均未完成；§10 标题补「阶段 Gate = PASS」并注明已并入 `3191bec`、详见设计文档；§11 标题补 Gate 状态，并新增「DEV-A 与现有锚点数据的关系（未决设计约束）」段落。
  3. `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`：§3.4 标题与验收行由「尚未建立 Git 检查点」更正为「**阶段 Gate = PASS，已并入稳定检查点 `3191bec` 并推送 `origin/main`**」；§3.5 前置补记 DEV-A 圆形／扇形区域未批准、暂时保留单一 anchor、进入／退出锚点是否拆分留待未来决定（指向 `AGENTS.md` 前置条件 3）；§6 状态说明由「2026-09-25 决策定案轮」更新为「2026-09-26 文档同步轮」，明确第 3–14 行仍待逐项批准（S7C-1B 未授权）、第 6 行「按到 anchor 的距离判定」与现有单一 anchor 继续有效、不因 DEV-A 提案改变；新增 §8.3「文档同步轮（2026-09-26）」记录本轮 Git 核对、`git diff --check` 结果、未跑测试与构建的原因，以及五条本轮结论（含 DEV-B 的三层数值约束）。
  4. `docs/DEV_SCENE_EDITOR_DESIGN.md`：顶部状态行由「用户浏览器人工验收 通过、尚未建立 Git 检查点、未 commit / push / tag」更正为「**人工验收 通过 + 阶段 Gate = PASS，已并入 `3191bec`（24 个文件、+3976/−71）并推送 `origin/main`，未创建 Tag**」；§9 验收步骤前新增说明——该节步骤已于 2026-09-26 由用户全部验收 通过，此后作为**回归复核清单**（后续触及 DEV 面板 / 冻结 / 编辑器 / 地图热重建的改动应重走关键条目 0、3、4、9、10）。
- 新增文件：无。修改文件：`AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md`、`docs/AGENT_LOG.md`（本条）。删除文件：无。依赖变化：无。**未改任何生产代码 / 测试 / `vite.config.ts` / `GAME_CONFIG` / `docs/GAME_BALANCE_CONFIG.md`；未接入藏身玩法；未开始 S7C-1B、DEV-A 或 DEV-B。**
- 测试结果：`git diff --check` 退出码 0。**`npm test` 与 `npm run build` 本轮未跑**：纯文档轮、源码零改动，按 `AGENTS.md`「纯文档或纯 Git 任务按适用性检查并说明未运行游戏测试的原因」执行；上一轮源码基线仍是 `npm test` 370/370 项通过、`npm run build`（含 `tsc --noEmit`）退出码 0。核对方式为「只改文档」+ 逐文件差异确认（`git status --porcelain` 与 `git diff --stat` 中不出现任何 `src/`、`tests/`、`vite.config.ts`）。
- 已知问题：①本轮未做浏览器验证（无游戏代码改动，无需浏览器验收）；②S7B-3B 修复后仍缺一份完整实机 AI JSON；③窗口高度很矮（实测 762×484）时场景编辑器属性区布局偏紧；④`AGENT_LOG.md` 更早一轮留下的一条完全重复的「Git commit 信息」行，按「不修改历史内容」规则继续保留；⑤`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §1 的源码行号仍是 S7C-0 审计时快照，本轮未回改（历史记录）。
- 下一步建议：请用户确认本轮文件清单与关键差异后，再建立文档检查点（commit / push 需用户明确授权）；之后若要推进，先由用户逐条批准设计文档第 6 节第 3–14 项参数（S7C-1B），或另行批准 DEV-A / DEV-B 提案。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：本轮**未 commit、未 push、未创建 Tag**。计划提交标题（供用户确认后使用）：`docs: sync stage gates and long-term preconditions to checkpoint 3191bec`；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。不将 S7C 整体标记完成。

## 2026-09-26 +08:00｜AGENTS.md 长期规则拆分（全阶段通用 + 已规划阶段专属）

- 任务名称：《谁吃了我的米》`AGENTS.md` 长期开发规则结构重构。当前开发阶段：`HEAD` = `a889d3c`，S7C-1A 与 DEV 场景热编辑器 V1 均已 Gate = PASS。本轮**只改文档**，不改任何生产代码 / 测试 / `GAME_CONFIG`，不开发 DEV-A / DEV-B / S7C-1B，不启动开发服务器。
- 本次目标（用户要求）：把章节「长期开发路线与下一阶段开发前置条件」更名为「**长期开发路线与全阶段开发前置条件**」，并检查章节内各条的适用范围，避免未来尚未规划的阶段错误继承当前阶段的具体要求。
- 实际完成内容：
  1. **`AGENTS.md` 拆分为两部分**：「**一、全阶段通用前置条件**」（Git 基线与工作区保护、开发阶段授权、测试与人工验收、开发环境、现有功能保护）适用于本项目**所有**开发阶段，包括未来尚未规划的新阶段、新子阶段、DEV 工具轮与专项任务；「**二、当前已规划阶段的专属前置条件**」（DEV-A、DEV-B、S7C-1B、S7C-2 / 2b / 3）只适用于其中点名的阶段，**未来其他阶段不自动继承**。条目编号 1–9 **保持不变**（只调整归属与标题），以免破坏其他文档中「见 `AGENTS.md` 前置条件 3 / 4 / 5」的既有引用；节首注明「编号是稳定 ID、不代表执行顺序或分组」。
  2. **新增长期 Git 归档与文档维护要求**：新增前置条件 10「Git 归档与提交报告」（Gate = PASS 需验收 + 日志 + commit + push 全部完成；Tag 只在用户明确要求时创建；提交前复核暂存清单、只暂存本阶段文件；推送后报告完整提交编号并确认 `HEAD == origin/main`；只有**未推送**的本地提交才可经用户批准 `--amend`；禁用「未提交 / 未推送」这类提交后即失真的措辞）与前置条件 11「文档维护」（每阶段结束同步 `docs/AGENT_LOG.md` / `AGENTS.md` / `docs/DEEPSEEK_HANDOFF.md` 及本轮实际改动的设计文档；`docs/AGENT_LOG.md` 只追加、不删除不改写旧记录；**检查点与版本号一律用 `git log -1` / `git ls-remote origin refs/heads/main` 查询，不得写死「当前」SHA**；冲突先报告；纯文档轮只跑 `git diff --check`）。
  3. **现有阶段状态及授权边界不变**：「当前项目状态」节一字未改；「长期开发路线」补记「**尚未授权 ≠ 进行中**」，并明确调整本节标题、分组或顺序都不改变实际项目进度。S7C-1B / S7C-2 / 2b / 3 与 DEV-A / DEV-B 仍**未授权**，S7B 与 S7C 整体仍**未完成**。已确认的设计边界全部保留（现有单一 anchor、圆形／扇形未批准、不提前实现 `HideSystem` 与按键藏身与 Human `CHECK_HIDE`、不覆盖正式 `GAME_CONFIG` 与平衡配置、不建立第二套地图数据真相、新增按钮不得覆盖 DEV 入口、READY 计时不得接 PLAYING 冻结源）。
  4. **`docs/DEEPSEEK_HANDOFF.md` 已同步章节引用**：§2 的旧章节标题引用改为新标题并写明新的两部分结构；其余引用（`HANDOFF` §4、§11 与 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 的「前置条件 3 / 4 / 5」）因编号保持稳定而无需改动。`docs/AGENT_LOG.md` 中含旧标题字样的历史条目按「历史日志只追加」规则刻意未回改。
- 新增文件：无。删除文件：无。修改文件：`AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`（本条）。依赖变化：无。
- 测试结果：`git diff --check` 退出码 0。**`npm test` 与 `npm run build` 本轮未跑**：纯文档轮、源码零改动（`git status --porcelain` 中不出现 `src/`、`tests/`、`vite.config.ts`、`docs/GAME_BALANCE_CONFIG.md`）。编码核对：`AGENTS.md` 266 行 / `docs/DEEPSEEK_HANDOFF.md` 165 行，均 U+FFFD 0、无 BOM、纯 LF。
- 已知问题：本轮未做浏览器验证（无游戏代码改动，无需人工验收）；S7B-3B 修复后仍缺一份完整实机 AI JSON（既有待办）。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：计划提交标题 `docs: establish project-wide development prerequisites`，仅含上述 3 个文件、不创建 Tag；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。

## 2026-09-26 +08:00｜AGENTS.md 长期规则去重整理与两处歧义表述修正

- 任务名称：`AGENTS.md` 小范围去重整理。当前开发阶段：`HEAD` = `21e5d18`，S7C-1A 与 DEV 场景热编辑器 V1 均已 Gate = PASS。本轮**只改文档**，不改任何生产代码 / 测试 / `GAME_CONFIG`，不开发 DEV-A / DEV-B / S7C-1B。
- 本次目标（用户 9 条原则）：「每次任务的执行顺序」只保留每轮操作流程与精简 / 详细两种执行模式；「长期开发路线与全阶段开发前置条件」负责保存长期约束，**每条重要规则尽量只有一处完整定义、其他章节使用准确引用**；「最终汇报」只保留报告格式；同时检查「Git 与安全边界」「日志字段」「Build Environment」「阶段状态维护规则」的直接重复，但不整篇重写；**Gate 完成条件只保留一处权威定义**；保留前置条件 1–11 的稳定编号；不改变项目进度、功能设计、阶段授权、Git 安全规则与验收标准（尤其**不得降低测试要求、擅自允许提交或放宽用户文件保护**）；不为了缩短文件而删除重要约束；对确实存在的歧义或冲突**只报告、不自行改变实际要求**。
- 实际完成内容：
  1. 把 7 组重复内容改为「单一权威定义 + 准确引用」：「每次任务的执行顺序」第 1 / 3 / 4 / 5 条、「Git 与安全边界」第 2 / 3 条、「Build Environment」末条、前置条件 7 的 Gate 条、前置条件 10 的 force push 条、前置条件 11 的纯文档轮条、「阶段状态维护规则」首句。
  2. **Gate = PASS 的唯一权威定义落在前置条件 10**；前置条件 7 与「阶段状态维护规则」改为引用，不再各自重复定义。
  3. 核对中**发现并补回两处被引用吞掉的显式条款**：`端口被占用时直接报错退出、不静默切换到 5174` 补进前置条件 8（引用化后曾全库 0 命中）；`日志只写实际完成的内容` 补进前置条件 11。
  4. 按用户指定修正两处易歧义表述：**前置条件 1** 明确「禁止改写任何已推送的 Git 历史（含对已推送提交的 `--amend`、rebase、`reset --hard` 与强制推送）；尚未推送的本地提交，只有经过用户明确批准，才允许用 `git commit --amend` 修正」；**前置条件 7** 明确「游戏代码开发阶段必须执行 `npm test`、`npm run build`、`git diff --check`；纯文档或纯 Git 任务按适用性执行检查并说明未运行游戏测试的原因；不得因此降低游戏代码开发的测试要求」。
  5. 结果：`AGENTS.md` 行数 **266 → 266**，改动为 **14 insertions / 14 deletions**（全部同位置改写、无净删除行）；前置条件编号 1–11、阶段状态与授权范围未变。
- 新增文件：无。删除文件：无。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`（本条）。依赖变化：无。
- 测试结果：`git diff --check` 退出码 0。**`npm test` 与 `npm run build` 本轮未跑**：纯文档轮、源码零改动（`git status --porcelain` 中不出现 `src/`、`tests/`、`vite.config.ts`、`docs/GAME_BALANCE_CONFIG.md`）。
- 已知问题：本轮未做浏览器验证（无游戏代码改动，无需人工验收）；`docs/AGENT_LOG.md` 更早一轮留下的一条重复「Git commit 信息」行继续按规则保留。
- 下一步建议：如需继续推进，先由用户逐条批准设计文档第 6 节第 3–14 项参数（S7C-1B），或另行批准 DEV-A / DEV-B 提案。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：计划提交标题 `docs: deduplicate project development rules`，仅含上述 2 个文件、不创建 Tag；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。

## 2026-09-26 +08:00｜文档职责重构：长期规则与动态开发记录分离

- 任务名称：《谁吃了我的米》文档职责重构（纯文档整理）。当前开发阶段：`HEAD` = `0ed2838`；S7C-1A 与 DEV 场景热编辑器 V1 均已 Gate = PASS。本轮**只改文档**，不改 `src/`、`tests/`、`vite.config.ts`、`GAME_CONFIG`；不运行游戏、不启动开发服务器、不开始新功能、不 commit / push / tag。
- 本次目标（用户要求）：把长期规则与动态开发记录彻底分离——`AGENTS.md` 只保存长期稳定、适用于项目后续开发的 AI 协作规则；`docs/DEEPSEEK_HANDOFF.md` 作为当前开发状态与交接信息的唯一主要入口（当前阶段、待办、授权状态、测试基线、近期问题、下一步计划）；`docs/AGENT_LOG.md` 作为追加式历史开发日志；具体阶段设计文档保存该阶段专有的参数、技术决策、设计方案、约束与验收要求。
- 实际完成内容：
  1. **`AGENTS.md` 精简与改名**：长期规则章节「长期开发路线与全阶段开发前置条件」更名为「**全项目通用开发规则与执行规范**」；删除「当前项目状态」节（S1–当前阶段完成清单、当前检查点、自动化基线、当前下一阶段、当前灰盒与玩法状态）与「当前核心玩法规则摘要」节；移除前置条件 3–6（DEV-A / DEV-B / S7C-1B / S7C-2·2b·3 的专属要求），改由「二、阶段专属开工要求」给出通用做法与位置指针；前置条件 1、2、7、8、9、10、11 作为通用规则保留（编号不变，前置条件 9 改为通用「已验收功能保护」并指向 `docs/DEEPSEEK_HANDOFF.md` 的受保护清单）；「阶段状态维护规则」改为「**状态维护规则**」（项目进度记录在 `docs/DEEPSEEK_HANDOFF.md`，不在 `AGENTS.md`）；新增「**通用代码架构约束**」一节（角色碰撞与移动、单一权威来源、系统职责边界）；文件开头新增三处职责说明。
  2. **`docs/DEEPSEEK_HANDOFF.md` 承接动态信息**：新增 §12「待批准提案与专属开工要求」（DEV-A 8 项问题与未决约束、DEV-B 技术审计与三层数值约束）、§13「当前受保护功能清单」（原前置条件 9 清单 + 两条长期禁令）、§14「当前灰盒与玩法状态（摘要）」、§15「当前核心玩法规则摘要」；§4 阶段进度把 S1–S5 展开为带版本号的明确记录（`v0.0.1` / `v0.0.2` / `v0.0.3` / `v0.0.4` / `v0.0.5-tech3d` / `v0.1.0-alpha`），S7A 行补记「Human AI 移动倍率 0.92 与自动解锁 8,750 ms 暂按用户决定接受」；「下一项」行去掉对 `AGENTS.md` 前置条件 5 的引用；§9 当前状态改为「其后仅有纯文档检查点，最新提交以 `git log -1` 查询，逐轮归档见本日志」；文件开头改写为「唯一主要入口」的职责说明。
  3. **引用修正**：`docs/DEEPSEEK_HANDOFF.md` §2 指向的章节名改为「全项目通用开发规则与执行规范」；`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §3.5、§6、§8.3 中「见 `AGENTS.md` 前置条件 3 / 4 / 5」的引用分别改为指向 `docs/DEEPSEEK_HANDOFF.md`「待批准提案与专属开工要求」或该设计文档自身 §3.5。`docs/AGENT_LOG.md` 及既有设计文档中的**历史**引用按「历史只追加、不回改」保留。
  4. **未新建文档**：DEV-A / DEV-B 暂无独立设计文档，其专属开工要求暂由 `docs/DEEPSEEK_HANDOFF.md` §12 承载；待用户正式批准后再按需建立各自的设计文档，避免为本次迁移新建大量文件。
  5. 行数变化：`AGENTS.md` 266 → 176 行；`docs/DEEPSEEK_HANDOFF.md` 165 → 237 行；`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 448 行（仅 4 处引用修正）。
- 保留的安全边界（**本轮只是文档职责调整，不代表批准任何玩法**）：S7C-1A 与 DEV 场景编辑器 V1 已完成，功能检查点仍为 `3191bec`；DEV-A、DEV-B、S7C-1B、S7C-2、S7C-2b、S7C-3 **仍未授权**；现有单一 anchor 现状不变；不得提前实施 `HideSystem`；不得修改 `GAME_CONFIG` 的正式平衡值；不得修改已验收的地图与 DEV 编辑器。
- 新增文件：无。删除文件：无。修改文件：`AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/AGENT_LOG.md`（本条）。依赖变化：无。
- 测试结果：`git diff --check` 退出码 0；**未运行 `npm test` / `npm run build`**（纯文档轮、源码零改动）。编码核对：三个改动文件均 U+FFFD 0、无 BOM、纯 LF。
- 已知问题：`docs/AGENT_LOG.md` 与本轮之前的设计文档中仍存在对 `AGENTS.md` 历史章节名与编号的历史陈述（例如 S7B3B 设计文档中「不改 `AGENTS.md` 的阶段状态」），按「历史只追加、不回改」保留，不改写历史记录。
- 下一步建议：请用户审核本轮迁移结果；确认后再决定是否建立文档检查点。之后若要推进，先由用户逐条批准 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 第 6 节第 3–14 项参数（S7C-1B），或另行批准 DEV-A / DEV-B 提案。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：本轮**未 commit、未 push、未创建 Tag**；计划提交标题待用户确认后确定；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。

## 2026-09-26 +08:00｜DEV-A 第一轮：藏身交互区域的数据与几何基础（实现轮）

- 轮次性质：**实现轮**（用户本轮授权范围＝《谁吃了我的米》DEV-A 第一轮）。开始前已读 `AGENTS.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md` 与实际源码，并核对 Git 状态：分支 `main`、`HEAD == origin/main == cc86af14ea0d6e062ff30d8a0b1ead113ca7ea6f`（`docs: separate permanent rules and streamline agent instructions`）、工作区仅未跟踪 `.dsh-meow/` 与 `.trae/`、无 `.git/MERGE_HEAD` / `REBASE_HEAD` 残留。
- 本次目标（用户要求）：只执行 DEV-A 第一轮——圆形／扇形藏身交互区域的数据与纯几何基础，**不提前完成第二轮的场景编辑器 UI**。
- 实际完成内容：
  1. **数据**：`src/three/map/apartmentMap.ts` 新增 `HideInteractionShape` / `HideInteractionRegion` 类型与 `HideSpot.interactionRegion`；8 条藏身点写入用户指定参数（床与纸箱＝圆形 2.0 / 1.2，衣柜与柜架＝扇形 1.6 / 55°）。**8 个锚点坐标一个都没改**，稳定 ID、`furnitureId`、`facing`、`label`、`kind` 全部保持原值。区域中心不单独存储（由 `furnitureId` 反查家具中心），扇形轴由「家具中心 → 现有锚点」推导，因此编辑器四分之一转（只交换 AABB 宽深）不改变区域中心与轴。
  2. **几何与合法位置基础接口**：新增 `src/three/map/HideInteractionRegion.ts`，明确分三层——①精确连续成员判定（边界含入、角度环绕到 `(-π, π]`）；②合法位置检查（复用真实 `CollisionWorld.canOccupyStaticXZ` 与真实 `NavigationSystem.nearestFree` / `findPath`；遮挡瞄准家具**可接近表面**而不是家具中心，绑定家具不参与自身遮挡集合）；③**明确离散**的采样预览（结果带 `discrete: true` / `method: 'LATTICE'` / `step`，步长依赖由测试固定）。另有 `validateHideRegionData()` 纯数据校验。
  3. **第一项检查结论（用户要求：先报告、不得直接替换校验）**：既有「锚点 ↔ 家具」校验用的是**家具表面距离**——`tests/hide-spot.test.mjs:48-50` 的 `gapToRect` 与 `:98-102` 的 ≥ 0.05 断言，以及 `src/three/map/MapEditModel.ts:183-187` 的 `rectDistanceXZ` 配合 `:21-23` 的 `EDIT_LIMITS.minAnchorFurnitureGap` / `maxAnchorFurnitureGap`（0.05 / 0.9，使用点在 `:395-412`）。实测 8 个锚点：表面距离 0.255–0.450（全部落在 [0.05, 0.9] 内，`validateEditedMap()` 对原始地图仍为 0 个拒绝）、中心距离 0.900–1.812。本轮新增的区域半径 1.2–2.0 是**中心距离**度量，与表面距离并存、**未替换任何既有校验**；8/8 锚点落在自己的区域内（锚点到区域边界余量 0.188–0.338）。记录一条未来注意点：不得把 `maxAnchorFurnitureGap`（表面）当作半径（中心）的合法上限复用。
  4. **类型补全（编辑器行为不变）**：`src/three/SceneEditor.ts` 的 `draftSpotsToAnchors()` 改为通过稳定 ID 把 `interactionRegion` 原样透传（否则场景重建路径拿不到完整 `HideSpot`）；区域数据不进可编辑草稿、不进导出 JSON、不进面板字段，编辑器行为与拒绝码零改动。
  5. **测试**：新增 `tests/hide-interaction-region.test.mjs`（13 项），覆盖批准参数逐条对齐与 kind→形状映射、区域中心/轴与既有 `facing` 的一致性、8 个锚点都在自己区域内、圆形边界精确含入、扇形两侧半角与 ±π 接缝（含「未环绕时必然失败」的断言）、四分之一转不变与锚点四象限轴推导、8 个锚点逐个验证「瞄准中心会被家具自身挡住、瞄准表面可通过且 `LEGAL`」、隔墙误判拒绝（储物间纸箱厨房侧 `(14.6, -4.8)`：在区域内、可站立、有导航格，仅因 `wall_038` 挡住「位置 → 家具表面」的路线而判 `SURFACE_BLOCKED`）、8 个区域各自存在合法位置、合法位置都在本房间内且可从锚点 A* 到达、采样预览的离散标记/内部一致性/步长依赖/非法步长抛错、缺省门状态等价于各门 `initialState`、数据校验的 7 种非法输入、编辑器透传与 `interactionRegion` 只读性。
  6. **文档**：新增 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`（已批准参数表、三层接口、与既有校验的度量关系、验证结果、第二轮要接的接口与未实现清单）；`docs/DEEPSEEK_HANDOFF.md` 同步授权状态、阶段进度「下一项」行、自动化基线（383/383）、§10 编辑器类型补全说明、§12 DEV-A 状态与 8 问回答映射。
- 保留的安全边界：**DEV-A 只有第一轮获得过授权**；DEV-A 第二轮（编辑器编辑半径/角度/朝向、校验与导出、DEV 可视化）与 DEV-B、S7C-1B、S7C-2 / 2b / 3 仍未授权；未实现 `HideSystem`、按键藏身、Human `CHECK_HIDE`、地图随机化；未改 `GAME_CONFIG` 与任何已验收数值；未改已验收的编辑器行为、`MapEditModel` 可编辑字段与拒绝码、`MapBuilder` DEBUG 标记；8 条锚点数据与「单一 anchor（进入点 = 退出点）」语义不变。
- 新增文件：`src/three/map/HideInteractionRegion.ts`、`tests/hide-interaction-region.test.mjs`、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。修改文件：`src/three/map/apartmentMap.ts`、`src/three/SceneEditor.ts`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`（本条）。删除文件：无。依赖变化：无。
- 测试结果：`npm test` **383/383 项通过**（基线 370 + 本轮新增 13，失败 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0。未启动开发服务器（本轮是数据与纯逻辑层，浏览器人工验收步骤由用户在其环境中执行）。
- 已知问题：`hide_main_wardrobe` 的扇形区域半径 1.6 会在几何上伸进主卧西墙（区域是创作数据、不是碰撞体），其越界格点被 `NOT_STANDABLE` 正确拒绝；`hide_living_carton` 的圆形区域几何上越过客厅/餐厅墙，但越界点到不了角色圆半径，因此不产生任何新的合法位置。两者都不影响 8 个锚点本身仍是合法位置（已逐个断言）。
- 下一步建议：请用户人工审核本轮数据与接口（第一轮没有 UI，验收以数据、接口与测试为准）；确认后再决定是否建立检查点，以及是否批准第二轮（场景编辑器接入半径/角度/朝向编辑、校验导出与 DEV 可视化）。
- Git commit 信息（按本项目惯例写成提交前后都成立的措辞）：本轮**未 commit、未 push、未创建 Tag**；计划提交标题待用户确认后确定；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准。

## 2026-09-26 +08:00｜DEV-A 第一轮：Git 归档（用户浏览器人工回归 PASS）

- 任务名称：DEV-A 第一轮 Git 归档（用户授权本轮归档）。**用户已确认本轮浏览器人工回归 5/5 项通过**；归档前的自动化报告为 `npm test` 383/383 项通过、`npm run build` 通过、`git diff --check` 通过。
- 本轮只归档已完成的 DEV-A 第一轮：8 个 `HideSpot` 的 `interactionRegion` 地图数据；圆形、扇形几何判定；碰撞、家具表面遮挡和导航合法性检查；离散采样辅助接口；`SceneEditor` 必要的新增字段透传；本轮测试及对应开发文档。
- 归档前核查（`main` / `HEAD` / `origin/main` / `git status` / 合并变基残留 / `git fetch origin`）：分支 `main`；核查时 `HEAD == origin/main` = `cc86af14ea0d6e062ff30d8a0b1ead113ca7ea6f`（`docs: separate permanent rules and streamline agent instructions`）；`.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` 全部不存在；`git fetch origin` 成功且 `git rev-list --left-right --count origin/main...HEAD` = `0 0`（远端无新增提交）；实际差异与授权清单完全一致，无额外文件、无未解释差异、无远端变化。
- 归档文件（5 个修改 + 3 个新增）：`src/three/map/HideInteractionRegion.ts`（新增）、`src/three/map/apartmentMap.ts`、`src/three/SceneEditor.ts`、`tests/hide-interaction-region.test.mjs`（新增）、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`（新增）、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/AGENT_LOG.md`（本条）。
- 人工验收与范围：**用户确认浏览器人工回归 5/5 项通过（2026-09-26）**；DEV-A 第一轮状态由「已实现、待人工审核」更新为「**已完成、阶段 Gate = PASS**」，并随本轮提交建立检查点。**只有 DEV-A 第一轮标记完成**；DEV-A 整体、DEV-A 第二轮、DEV-B、S7C-1B 均**未完成、未授权**。`AGENTS.md` 长期规则没有变化，本轮未修改。
- 最终检查：`npm test` **383/383 项通过**（失败 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0；暂存后 `git diff --cached --check` 退出码 0，`git diff --cached --name-status` 与上述清单一致（仅这 8 个文件）。
- 已知问题（沿用第一轮记录，均不阻断）：`hide_main_wardrobe` 的扇形区域在几何上伸进主卧西墙、`hide_living_carton` 的圆形区域几何上越过客厅/餐厅墙，越界格点都被 `NOT_STANDABLE` / `SURFACE_BLOCKED` 正确拒绝，8 个锚点本身仍是合法位置。
- 下一步建议：**不得自动进入 DEV-A 第二轮**；DEV-A 第二轮（场景编辑器编辑半径/角度/朝向、校验与导出、DEV 可视化）与 DEV-B、S7C-1B 仍需用户分别授权。
- Git 归档信息（按本项目惯例写成提交前后都成立的措辞）：提交标题 `feat: complete dev-a hide region geometry foundation`，**不创建 Tag**；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准（不写死自身 SHA）。

## 2026-09-26 +08:00｜DEV-A 第二轮与 DEV-A-FIX-1：Git 归档（人工验收 PASS）

- 任务名称：DEV-A 第二轮（藏身交互区域的编辑器编辑、校验、JSON V2 导出与 DEV 可视化）+ DEV-A-FIX-1（场景编辑器拖动流畅度）合并归档（用户授权）。`AGENTS.md` 长期规则无变化，本轮未修改。
- 人工验收（用户确认）：**DEV-A 第二轮的区域编辑、区域预览、校验、JSON V2 导出及旧功能回归全部通过**；**DEV-A-FIX-1 流畅拖动专项 5/5 浏览器人工验收全部通过**。归档前自动化报告：`npm test` 395/395 项通过（第二轮基线 389 + FIX-1 新增 6）、`npm run build` 通过、`git diff --check` 通过。
- 归档前核查：分支 `main`；核查时 `HEAD == origin/main == d4462e9cdeb383963eb4f333613664c35f9d8203`；`git fetch origin` 成功、`git rev-list --left-right --count origin/main...HEAD` = `0 0`（远端无新增提交）；`.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` 全部不存在；逐个复核 7 个未提交文件的实际差异，确认**只含 DEV-A 第二轮与 FIX-1 的成果**，无额外文件、无未解释差异、无调试残留（差异中无 `console.log` / `debugger` / `TODO` / 临时路径）。
- 归档文件（7 个修改，+867/−50）：`src/style.css`、`src/three/SceneEditor.ts`、`src/three/SceneEditorPanel.ts`、`src/three/SceneEditorView.ts`、`src/three/map/HideInteractionRegion.ts`、`src/three/map/MapEditModel.ts`、`tests/scene-editor.test.mjs`；另有本轮实际更新的文档 `docs/AGENT_LOG.md`（本条）、`docs/DEEPSEEK_HANDOFF.md`、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。
- DEV-A 第二轮实际内容：`HideSpotDraft` 携带 `interactionRegion`；编辑器可编辑区域半径与扇形半角（`REGION_AUTHORING_LIMITS`：半径 0.5–3、步长 0.05；半角 10–150°、步长 1°；拒绝码 `INVALID_REGION_RADIUS` / `INVALID_REGION_ANGLE` / `RADIUS_OUT_OF_AUTHORING_RANGE` / `HALF_ANGLE_OUT_OF_AUTHORING_RANGE`）；家具移动或旋转时关联锚点跟随（`rotateAnchorAroundFurniture`）；`MapEditSession.regionPreview(targetId, includeSamples, step)` 与 `hideSpotForTarget`；`validateEditedMap` 增加区域类拒绝码（`ANCHOR_OUTSIDE_REGION` / `ANCHOR_REGION_ILLEGAL` / `NO_LEGAL_REGION_SAMPLE`）；JSON 导出升为 **`MAP_EXPORT_VERSION = 2`**（`interactionRegion` 带 `units`）；DEV 面板增加「交互区域预览」开关、区域半径/半角输入、按 `code` 着色的离散采样点与图例（精确轮廓与离散采样在 UI 上分开呈现）；`checkHideRegionPosition` / `sampleHideRegion` 增加 `isReachable` 快速路径（复用连通性洪水填充结果，避免每个采样点各跑一次 A\*）。
- DEV-A-FIX-1 根因与修复：`SceneEditor.onFrame()` 每帧读取 `session.draftStatus`，而该 getter 会跑整张地图的完整校验（新建 `CollisionWorld` + `NavigationSystem` + 3 格连通性洪水填充 + 区域采样），拖动时草稿每帧变化使缓存必然失效 → 每帧一次完整校验（**实测 236–435 ms/次**，卡顿主因）；次因是 `SceneEditorView.setRegionPreview()` 每次调用都销毁并重建轮廓线与采样实例。修复：`MapEditSession` 增加**延迟校验窗口**（`beginDeferredValidation` / `endDeferredValidation` / `validationDeferred`；窗口内 `draftStatus` 返回 `DRAGGING` 且为 O(1)），编辑器在 `pointerdown`（view 新增 `onDragStart` 钩子）开窗、`pointerup` / `commitDrag` 关窗并**在释放时校验一次**；预览对象改为长期存活（轮廓线原地改写 position 缓冲 + 重算包围球，采样实例按 `code` 复用、拖动期间仅隐藏）；`statusEntries()` 改为只读一次状态；`close` / `discardDraft` / `applyEdits` / `dispose` / `resetAll` 兜底关窗。**未通过隐藏 UI 掩盖卡顿**（轮廓仍随每次 pointermove 跟随，采样点在释放时立即重绘）、**未让非法位置绕过正式校验**（`apply()` 仍全量复验、`commitDrag()` 仍释放时校验并回滚）、**未改变编辑器数据语义**。
- DEV-A-FIX-1 实测数据（Node，模型/视图层毫秒，**不是浏览器 FPS**）：120 次 pointermove 触发的完整校验 **119 次 → 1 次**；每次拖动移动的编辑器开销中位 **0.011 ms**（max 0.24 ms）；释放时区域重采样约 **19 ms**（每次释放 1 次）；轮廓更新 A/B（真实 `three` API + 真实 `SceneEditorView` 实例，400 次/组）**0.0177 ms → 0.0111 ms**（中位）。
- 新增测试：`tests/scene-editor.test.mjs` 追加 6 项拖动回归——拖动期间逐帧读取不触发完整校验（`validationRuns` 零增长）、释放时恰好校验一次且随后命中缓存、非法拖动释放时仍被拒绝并可回滚、拖动中家具/关联锚点/区域中心同步且拖动期无离散采样、`resetAll()` 关窗且不触发校验、延迟拖动后 V2 导出仍只含已应用数据；第二轮的区域编辑/校验/JSON V2 测试同步保留。
- 最终检查：`npm test` **395/395 项通过**（失败 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0；暂存后 `git diff --cached --check` 退出码 0，`git diff --cached --name-status` 与本轮确认清单一致。
- 保留的边界：**DEV-A 整体仍未完成**；**DEV-A-FIX-2 仍为待实施任务**（范围以用户后续说明为准）；不实现自由旋转；不开发 DEV-B；`HideSystem`、按键藏身、Human `CHECK_HIDE`、地图随机化仍未实现；`GAME_CONFIG` 与已验收数值未改；既有 V1 编辑器功能、双阵营冻结与 READY 独立计时无回归。
- 下一步建议：请用户说明 DEV-A-FIX-2 的范围后再开工；DEV-B 与 S7C-1B / 2 / 2b / 3 仍需单独授权（S7C-1B 开工前须逐项批准其设计文档第 6 节第 3–14 行参数）。
- Git 归档信息（按本项目惯例写成提交前后都成立的措辞）：提交标题 `feat: complete dev-a region editor and smooth dragging`，**不创建 Tag**、不使用 force push；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准（不写死自身 SHA）。

## 2026-09-26 +08:00｜DEV-A-FIX-2：Git 归档（家具任意角度旋转 + JSON V3，人工验收 PASS）

- 任务名称：DEV-A-FIX-2（家具 0°–359.9° 任意角度旋转、可关闭的 15° 吸附默认关闭、JSON 导出升级 V3）归档（用户授权本轮归档）。`AGENTS.md` 长期规则无变化，本轮未修改。
- 人工验收（用户确认，**5/5 项通过**）：①任意角度输入及 15° 吸附；②旋转后的真实碰撞与 AI 导航；③关联锚点与藏身区域同步、非法旋转拒绝；④取消、应用与 JSON V3 导出；⑤原有流畅拖动等功能回归。
- 归档前核查：分支 `main`；核查时 `HEAD == origin/main == ed3fd015ee199275e483ef8635e18e232ad70429`（DEV-A 第二轮 + DEV-A-FIX-1 的 Gate）；`git fetch origin` 成功且 `git rev-list --left-right --count origin/main...HEAD` = `0 0`（远端无新增提交）；`.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` 全部不存在；逐个复核 13 个修改文件的实际差异与 3 个新增文件，确认只含 FIX-2 成果（`src/config/gameConfig.ts`、`docs/GAME_BALANCE_CONFIG.md` 无差异），无额外文件、无未解释差异、无调试残留。
- 归档文件（13 个修改 + 3 个新增）：`src/three/CollisionWorld.ts`、`src/three/SceneEditor.ts`、`src/three/SceneEditorPanel.ts`、`src/three/ThreeGame.ts`、`src/three/map/HideInteractionRegion.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/MapEditModel.ts`、`src/three/map/apartmentMap.ts`、`tests/collision-world.test.mjs`、`tests/hide-interaction-region.test.mjs`、`tests/scene-editor.test.mjs`、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`、`docs/DEEPSEEK_HANDOFF.md`；新增 `src/three/map/RotatedRect.ts`、`tests/rotated-rect.test.mjs`、`tests/rotated-furniture.test.mjs`；另有本轮文档 `docs/AGENT_LOG.md`（本条）。
- 实现要点：①新增 `src/three/map/RotatedRect.ts` 作为**唯一旋转几何来源**（局部/世界换算、四角点、包围 AABB、圆/线段×旋转矩形、SAT 真实重叠、点到矩形距离、Chebyshev 膨胀、表面瞄准点、绕点旋转、角度助手），旋转约定 = `THREE.Object3D.rotation.y`，四分之一转取精确值；②`Rect` 增加可选 `rotation`（弧度，缺省 0），`CollisionWorld` 增加第二种碰撞体 `OrientedObstacle` 承载真实旋转足迹（包围 AABB 仅作粗筛），`canOccupyStaticXZ` / `isLineBlockedXZ` / 分轴滑动与角落切线全部支持，**轴对齐路径数学逐字未改**；③`MapBuilder` 按角度旋转网格并用真实角点 `LineSegments` 画调试轮廓（替换会画成包围盒的 `BoxHelper`），`ThreeGame` 初始构建与热重建都把 `orientedObstacles` 交给 `CollisionWorld`，`NavigationSystem` 仍只复用 `canOccupyStaticXZ`；④`MapEditModel` 家具字段 `rotationQuarter` → **`rotationDeg`**（任意角度，输入即归一化到 [0,360)，`ROTATION_STEP_DEGREES = 1`，拒绝码 `NOT_QUARTER_TURN` → `INVALID_ROTATION`），新增 `ROTATION_SNAP_DEGREES = 15` 与 `MapEditSession.setRotationSnap()`（默认关闭、只影响输入值、不进 JSON），房间边界改为四角点均在房间内、家具重叠改为真实 SAT、门洞改为与膨胀门叶真实重叠、锚点距离改用点到旋转矩形距离，`rectColliders()` 自动分流 Box3 / `OrientedObstacle`；⑤`HideInteractionRegion` 的表面瞄准与遮挡改用旋转几何，编辑器工具栏新增「旋转吸附 15°」复选项。
- JSON V3 决策：`MAP_EXPORT_VERSION = 3`；每件家具导出 `position`（足迹中心）、`size`（创作尺寸）、`rotationDeg` / `rotationRad`（真实角度）、`collisionShape: 'ROTATED_RECT'`，并把轴对齐边界改名为 `boundingAabb` 且附 `boundingAabbRole: 'broad-phase-approximation'`——**V2 的 `collisionAabb` 字段被移除**（该改动已在实现轮向用户报备，本轮归档按用户授权范围执行）；只导出已应用数据，**未开发 JSON 导入器**；藏身点导出保持 V2 语义。
- 新增测试：`tests/rotated-rect.test.mjs`（8 项纯几何：轴对齐归约、90° 等于旧的宽深交换、`rotation.y` 约定、圆/线段/重叠与轴对齐原实现一致、表面瞄准点、角度助手、绕点旋转）；`tests/rotated-furniture.test.mjs`（12 项：真实重叠、房间边界、门洞、LOS/抓捕资格、导航绕行、藏身区域与遮挡、编辑器事务与吸附、`validationRuns` 单次校验、V3 导出）；`tests/collision-world.test.mjs` 追加 5 项旋转碰撞；`tests/scene-editor.test.mjs`、`tests/hide-interaction-region.test.mjs` 迁移到新字段与新导出格式。
- 最终检查：`npm test` **420/420 项通过**（失败 0 / 已取消 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0（仅既有 >500 kB chunk 体积警告）；`git diff --check` 退出码 0；暂存后 `git diff --cached --check` 退出码 0，`git diff --cached --name-status` 与本轮确认清单一致。
- 范围声明：**DEV-A 已批准范围（第一轮、第二轮、DEV-A-FIX-1、DEV-A-FIX-2）至此全部实现并通过用户人工验收**；仍未完成的 DEV-A 相关项：**JSON 导入器刻意未开发**（不属本轮批准范围），**进入/退出锚点是否拆分为两个独立点仍未决定**（沿用单一 anchor）。`HideSystem`、按键藏身、Human `CHECK_HIDE`、出生点随机化等属 S7C-1B 及后续阶段，**仍未实现、未授权**；DEV-B 未授权；`GAME_CONFIG` 与所有已验收数值未改。
- 下一步建议：**不得自动进入下一阶段**；DEV-B 与 S7C-1B / 2 / 2b / 3 仍需用户分别授权（S7C-1B 开工前须逐项批准其设计文档第 6 节第 3–14 行参数）。
- Git 归档信息（按本项目惯例写成提交前后都成立的措辞）：提交标题 `feat: complete dev-a arbitrary furniture rotation`，**不创建 Tag**、不使用 force push；实际 commit SHA 与 push 结果以本次 Git 执行和最终汇报为准（不写死自身 SHA）。

## 2026-09-26 +08:00｜DEV-B 实时 AI 调试工具（一次性完整实施轮，待用户浏览器人工验收）

- 任务名称：DEV-B（实时状态观察 / 真实运行时参数调节 / 场景可视化 / 仅内存覆盖层 / 两种恢复 / 自动化测试与验收说明）。本轮为**一次性完整实施**，不分阶段请示；**未 commit、未 push、未创建 Tag**，等待用户一次完整的浏览器人工验收。
- 总体架构（用户批准）：三层职责严格分离——**A 只读运行状态采集**（`src/systems/DevBObserver.ts`，纯函数）、**B 运行时参数覆盖**（`src/systems/RuntimeDebugOverrides.ts` + `src/systems/DevBRuntimeBinding.ts`）、**C Three.js 调试可视化**（`src/three/DevBView.ts`）；界面控件、运行时系统与场景可视化共用同一份有效参数，杜绝「面板数字变了但游戏仍读旧参数」的假调节。
- 新增文件：`src/systems/RuntimeDebugOverrides.ts`（38 项白名单 + 元数据 + 校验 + snapshot/restore/clearAll + 订阅 + typed getter）、`src/systems/DevBRuntimeBinding.ts`（抓捕半径变化 → 立即清空抓捕进度 + 同步抓捕圈；新局清覆盖；`effectiveSpeeds()`；只读基准快照）、`src/systems/DevBObserver.ts`（5 个只读观察分区）、`src/three/DevBView.ts`（持久化绘制对象，5 类可视化）、`src/three/DevBPanel.ts`（DOM 面板，入口为 `DebugDetailsPanel.topRow` 的 flex 项）、`src/three/DevBDebug.ts`（编排，约 120 ms 节流刷新）、`docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`（阶段设计文档）。
- 修改文件：`src/systems/PerceptionSystem.ts`（新增可选 `SoundTuning` / `OcclusionTuning` / `VisionTuning` 缝：有效范围、衰减指数、四个削弱系数、最小可听强度、有效视距；`emit` 的强度/寿命只影响新事件）、`src/systems/HumanAIController.ts`（`setRuntimeTuning`、`humanAiMovementSpeed(base, multiplier)`、路程估算用有效速度、`currentPath()` 只读访问器）、`src/systems/DeepSeekAIController.ts`（`setRuntimeTuning`、`moveSpeed()` 方法化、`effectiveCaptureRadius`（`passageAvoidRadius`）、`effectiveVisionRange`、`currentPath()`）、`src/three/CaptureZone.ts`（`setRadius()` 就地质重建环几何）、`src/three/AISafetyPathView.ts`（按有效抓捕半径绘制）、`src/three/ThreeGame.ts`（创建覆盖层与 DEV-B、注入各系统、抓捕/移动读取有效值、`resetRound()` 清覆盖、`dispose()` 释放 DEV-B）、`src/style.css`（DEV-B 面板样式）。
- 可调参数（38 项，正式基准只读、范围与生效时机见设计文档 §4）：抓捕圈半径 0.7；基础视觉距离 11；9 类声音各自的传播范围 / 强度 / 寿命；距离衰减指数 1；墙体 0.28、OPEN 1、CLOSED 0.45、LOCKED 0.35 削弱系数；最小可听强度 0.015；DeepSeek 基础速度 230、Human 速度倍率 1.08、Human AI 移速倍率 0.92。NaN / Infinity / 非数字 / 越界 / 未知 id 一律拒绝并给出中文提示，输入框回滚到当前有效值。**`captureMs`、READY 时间、冲刺时长/眩晕/冷却、碰撞半径、导航网格、地图几何与门锁规则、AI 状态机与藏身玩法明确排除**（面板列出原因）。
- 生命周期：覆盖项只存在当前页面内存（不写 `gameConfig.ts` / `GAME_BALANCE_CONFIG.md` / 地图 JSON / `localStorage`）；打开面板时记录「打开时快照」，提供「恢复打开 DEV-B 时的参数」与「恢复正式默认值」；关闭/收起面板保留临时参数（关闭 ≠ 恢复默认）；新局或重开清除覆盖；`dispose()` 释放 DOM、定时器与绘制对象。
- 已知限制（面板如实标注）：`PerceptionGeometry` 只用墙体与门做遮挡，**家具不参与视觉遮挡**（即使 DEV-A 已实现旋转家具碰撞也不画家具遮挡）；现有视觉无视锥角，只画圆；Human AI/DeepSeek AI 的 `stuckMs` 等内部计时未暴露，标注「暂不可观测」；`CHECK_HIDE` 仍是预留状态；观察刷新约 8 Hz 且不触发额外寻路或决策。
- 新增测试 33 项（420 → **453**）：`tests/runtime-debug-overrides.test.mjs`（11：白名单与元数据、有效值、非法输入拒绝、clear/clearAll、snapshot/restore 与越界钳制、订阅退订、**全程不写 `GAME_CONFIG`**、typed getter、排除项）、`tests/dev-b-runtime-effect.test.mjs`（11：抓捕圈与判定同半径、**半径变化立即清空抓捕进度**、无关参数不动进度、视觉距离影响真实检测、墙/门系数影响真实声音分析、范围/衰减/可听阈值、**强度与寿命只影响新事件**、有效移动速度、DeepSeek 安全半径、新局清覆盖、只读基准快照不变）、`tests/dev-b-visualization.test.mjs`（11：绘制对象复用、圆环跟随有效半径、单开关只影响本层、路径节点数与视线状态、声音标记与过期隐藏、`dispose` 不留对象、观察字段完整与「暂不可观测」标注、缺失数据不虚构、**观察不修改输入状态**、四种控制组合、面板文案与已知限制）。
- 最终检查：`npm test` **453/453 项通过**（失败 0 / 已取消 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0（仅既有 >500 kB chunk 体积警告，本次 JS 约 822 kB / gzip 约 218 kB）；`git diff --check` 退出码 0。
- 真实浏览器冒烟（本机 Chrome `--headless=new` + CDP，复用已在运行的 5173 dev server；脚本写在 `%TEMP%`、用完删除，不进仓库）：控制台 **0 错误**；「DEV-B 调试」入口与 `DEV ▾` 均 `elementFromPoint` 命中自身（无遮挡）；面板打开后渲染 **38** 个参数行与 5 个观察分区；非法输入（`abc`）触发红色提示并回滚到 0.70；设为 1.5 后显示「已覆盖：1.50（正式基准 0.7）」与「当前覆盖 1 项」；关闭面板再打开仍保留覆盖；「恢复正式默认值」清空为 0 项并回到 0.70；冻结后连续三帧截图**逐字节相同**（环境噪声 0 字节），开启全部 DEV-B 可视化后同一帧差异达 183,552 字节 → 可视化确实写入场景且不残留。
- 保留的边界：**不改 `GAME_CONFIG` 正式平衡值**；不修改正式游戏机制、不新增 AI 状态；不开发藏身玩法 / `CHECK_HIDE` / 出生点随机化 / DEV-A JSON 导入器；不新增自动冻结状态；DEV-A、READY 独立计时、双阵营冻结、JSON V3 与既有 AI 行为均无回归（453 项测试全绿）。
- 下一步建议：等待用户一次完整的浏览器人工验收（清单见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §10）；验收通过并经**单独授权**后再建立 Git 检查点。

## 2026-09-26 +08:00｜DEV-B UI 修复轮：面板刷新重复追加分组标题（待用户复测）

- 任务名称：修复 DEV-B 面板在实时刷新时反复排列「抓捕 / 视觉 / 听觉 / 移动」分组标题、占满面板的 UI 异常。仅修此一项，**未 commit、未 push、未创建 Tag**（DEV-B 仍未归档）；`GAME_CONFIG` 正式平衡值、正式游戏机制与已验收功能均未改动。
- 根因（按真实源码定位，未凭截图重写面板）：`src/three/DevBPanel.ts` 的 `renderParams()` 把分组容器建在一个**每次调用都新建的局部 `Map`** 里，并在该分支内执行 `this.paramsHost.append(host)`；而 `DevBDebug.onFrame()` 在面板打开时约每 120 ms 调一次 `renderPanel()`，于是**每次刷新都新增 4 个只含标题、不含参数的空分组容器**（参数行因缓存在 `this.rows` 中并未重复）。次要成因逐项排除：`DevBDebug` 只在 `ThreeGame` 构造函数中创建一次、`onFrame()` 每帧只调用一次、面板 DOM 与监听器都在构造函数中创建一次、`DevBRuntimeBinding.start()` 先 `stop()` 不会重复订阅；观察分区与条目本身已按 `data-section` / `data-entry` 正确复用。
- 修复（`src/three/DevBPanel.ts`）：新增 `groupHosts` 字段缓存分组容器（`ensureGroup(label)` 只创建一次并在刷新时复用）；渲染末尾清理已不在参数表中的分组容器；只有**顺序确实不一致时**才按参数表顺序重排（顺序一致时不做任何 DOM 移动，避免把正在输入的控件重新插入导致失焦）；`ensureRow()` 复用的行通过新增的 `ParamRow.root` 跟随其分组容器；`dispose()` 清理 `rows` / `groupHosts` / `visualInputs` 缓存。另把 `src/three/DevBDebug.ts` 的三个值导入补成显式 `.ts` 后缀（与 `RuntimeDebugOverrides.ts` 的写法一致），使 Node `--experimental-strip-types` 能直接导入该编排器做 DOM 回归测试；对 Vite 与 `tsc` 无影响（`allowImportingTsExtensions: true`）。
- 新增测试 8 项（453 → **461**）：`tests/dev-b-panel-dom.test.mjs` 用只实现面板实际使用接口的**最小 DOM 替身**驱动真实的 `DevBDebug` / `DevBPanel`（项目无 jsdom；该替身不是通用 DOM，真实节点数另用浏览器复核）——400 次刷新后分组标题恰好 4 个且顺序为 抓捕/视觉/听觉/移动、各组参数行 1/1/33/3、38 项参数不重复；600 次刷新后 DOM 节点数与监听器数**零增长**；连续 40 次开合后入口与面板仍各 1 个、节点与监听器零增长、参数输入框只注册 1 个 `change` 监听；刷新复用同一行对象且只更新状态文案与色调；观察分区/条目对象复用而值更新；非法输入有可见红色反馈、回滚到当前有效值且不新增节点；聚焦中的输入不被刷新覆盖；`dispose()` 移除节点与绘制对象。**变异验证**：临时把修复点改回「每次新建容器」后该测试 4 项失败（分组标题数量随刷新增长、节点与监听器计数不再恒定），确认测试确实能抓住该缺陷，随后已复原并复跑全绿。
- 最终检查：`npm test` **461/461 项通过**（失败 0 / 已取消 0 / 已跳过 0，退出码 0）；`npm run build`（含 `tsc --noEmit`）退出码 0（仅既有 >500 kB chunk 警告，本次 JS 约 822.80 kB / gzip 约 217.96 kB）；`git diff --check` 退出码 0；`src/config/gameConfig.ts` 与 `docs/GAME_BALANCE_CONFIG.md` 无差异。
- 真实浏览器复核（本机 Chrome `--headless=new` + CDP，复用已在运行的 5173 dev server；脚本写在 `%TEMP%`、用完删除，不进仓库）：DEV 面板在 `FACTION_SELECT` 阶段整体隐藏，故先进入对局，再用**真实鼠标事件**点击入口并确认 `elementFromPoint` 命中自身；面板打开后分组标题 **4** 个（抓捕/视觉/听觉/移动）、参数行 38 项（1/1/33/3）、观察分区 5 个、面板 DOM **418** 节点；持续实时刷新 9 秒（约 75 次）后仍为 4 / 38 / 5 / **418**；连续 10 次「关闭 → 打开」每次都以状态确认 `closed: true` / `reopened: true`，计数仍为 **418**；5 个可视化开关全部 `elementFromPoint` 命中自身，真实点击第一个开关只改变它自己（`true → false`，再点恢复 `true`）；观察分区 summary 真实点击可展开/收起；面板打开时 `DEV ▾` 仍命中自身（前置条件 9「新增按钮不得覆盖原 DEV 入口」无回归）；视口 420×560 与 900×480 下均满足：面板完整位于视口内、`dev-b-body` 可滚动、能滚到底且最后一条限制可命中、入口命中自身、分组 4 / 参数 38；非法 `abc` → 红色提示并回滚 `0.7`，设 `1.5` → 「已覆盖：1.50 世界单位（正式基准 0.7）」＋「当前覆盖 1 项（仅在内存中）」；控制台 **0 错误**（仅既知 `/favicon.ico` 404）。**浏览器侧只报告 DOM 计数、命中测试与滚动结果，未编造 FPS 或耗时。**
- 保留的边界：只修此次 UI 异常、未开发新功能；不改 `GAME_CONFIG`；不改正式游戏机制、不新增 AI 状态；38 项参数、仅内存覆盖层、两种恢复与场景可视化全部保留；DEV-A、双阵营冻结、READY 独立计时、JSON V3、抓捕与两套 AI 行为均无回归。
- 下一步建议：请用户按 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §10 复测（本轮新增第 12 项即本次修复的验收点）；复测通过并经**单独授权**后再建立 Git 检查点。

## 2026-09-26 +08:00｜DEV-B 易用性优化轮：中文说明与紧凑模式（待用户统一验收）

- 任务名称：按用户反馈「DEV-B 调试面板专业术语较多，普通使用者难以理解」做一次**小范围易用性优化**。只改显示层，不重构观察、调参、可视化与运行时覆盖层；**未 commit、未 push、未创建 Tag**（DEV-B 仍未归档）。
- 先检查再动手：审计现有 UI 已有的中文——`RuntimeDebugOverrides` 的 38 项参数本来就有中文 `label` / `unit` / `effect` 与 `immediate`，面板已显示「正式基准 / 已覆盖」与「即时生效 / 新事件生效」；`ThreeGame.updateHud` 已有对局阶段的中文措辞（选择阵营 / 准备 / 对局中 / 已暂停 / 已结束）。因此**复用而非重复添加**：阶段中文直接沿用这套措辞，参数原有的 `effect` 文案作为悬浮说明里的细节保留，不推翻。
- 新增 `src/systems/DevBHelpText.ts`（唯一的新文案来源，不参与任何判定）：38 项参数的「它是什么 / 调大 / 调小 / 配置键」（11 项手写 + 9 类声音 × 3 项模板生成）、4 个分组说明、5 个观察分区说明、**60 个状态字段说明**（含内部字段路径）、状态码中文映射表、`devBParamTimingText()`（何时生效由参数自己的 `immediate` 决定，不靠文案猜）、`devBGlossValue()` / `devBReasonText()` / `devBSoundTypeText()` / `devBYesNo()`。
- 值的中文化范围（**宁可保留可对照的原代码，也不猜**）：已导出联合类型的枚举一律显示「中文（原代码）」——对局阶段、阵营、视线状态、冲刺状态与风险模式、Human AI 状态（PATROL/INVESTIGATE/CHASE/CAPTURE/SEARCH/CHECK_HIDE）、DeepSeek AI 状态（10 个）、锁门决策、威胁来源、威胁等级（NONE/CAUTION/HIGH）、9 类声音；**自由文本的原因类字段保留英文原代码**（没有导出联合类型，逐值翻译有猜错风险），只在悬浮说明里给中文解释，并在「已知限制」里写明这一取舍。
- 无数据状态通俗化（`DevBObserver.ts` 只改显示字符串，仍是纯只读函数）：`不适用` / `当前无目标` / `暂不可观测` / `无` 全部改写为具体中文——`当前没有追逐目标`、`当前没有目标房间`、`当前没有要搜索的房间`、`当前没有目标门`、`当前没有选中的米堆`、`当前没有在吃的米堆`、`当前不需要逃跑`、`当前没有听到任何声音`、`当前没有声音可以分析`、`还没有看到过对方`、`当前没有路线`、`当前不需要冷却`、`当前没有正在进行的冲刺`、`面板暂时看不到（控制器内部计时 stuckMs，未对外暴露）`、`还没有选择阵营`、`当前没有键盘控制目标`。字段标签三处改为中文优先：`Last Seen` → `最后一次看到（Last Seen）`、`CHECK_HIDE` → `藏身检查（CHECK_HIDE）`、`SAFE_WAIT 原因 / 剩余` → `安全等待原因 / 剩余（SAFE_WAIT）`。
- 面板改动（`DevBPanel.ts` / `style.css`）：参数行新增两行短说明（`它是什么：…`、`调大：…；调小：…`），原来的生效行改为 `何时生效：改完立刻生效…` 或 `何时生效：只影响改动之后新产生的声音事件 —— 已经在场的事件保留生成时的范围/强度/寿命`（27 项声音参数用琥珀色 + `data-timing="new-events"` 特别标明）；每个分组标题旁加 `｜短说明`；每个观察分区标题下加 `｜短说明`；**60 条状态行的解释放在悬浮说明里**（`title` 含「字段 xxx」+ 中文解释，标签加虚线与 `cursor: help`），避免 60 行又把面板撑长；面板顶部加一行使用说明；新增 `紧凑模式（隐藏说明）` 开关，只切换根节点 `data-compact`、由 CSS 收起说明，**不新增不删除节点**；`⚠` 符号改为中文破折号，避免字体缺字。
- 新增/更新测试 11 项（461 → **472**）：新增 `tests/dev-b-help-text.test.mjs`（8 项）——38 项参数逐一有非空、简短、带 `GAME_CONFIG` 配置键的中文说明；「何时生效」随 `immediate` 走且 27 项声音参数必须标「只影响新事件」；悬浮说明同时含中文与真实配置键；分组/分区说明覆盖全部标题；**两种数据状态**（AI 运行/未运行）下 60 个状态字段都有说明且带内部字段名；没有数据时不得只显示裸哨兵值（`不适用 / 当前无目标 / 暂不可观测 / NONE`）；状态码映射与源码联合类型**逐值一致**且未收录代码保留原样；9 类声音都有中文名。`tests/dev-b-panel-dom.test.mjs` 追加 3 项——每行都有「它是什么/调大调小/何时生效」与 27 项新事件标记；5 个分区说明与 58 个字段的悬浮说明齐全；**紧凑模式反复切换 20 次零增删**（节点数与监听器数与切换前完全相同）。同步更新 `tests/dev-b-visualization.test.mjs` 中随文案变化的断言（新标签、通俗化措辞、新增「中文（原代码）」断言）。
- 最终检查：`npm test` **472/472 项通过**（失败 0 / 已取消 0 / 已跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 tsc）退出码 0（仅既有 >500 kB chunk 警告，本次 JS 约 838.33 kB / gzip 约 223.32 kB、CSS 13.28 kB）；`git diff --check` 退出码 0；`src/config/gameConfig.ts` 与 `docs/GAME_BALANCE_CONFIG.md` 零差异。
- 真实浏览器复核（本机 Chrome `--headless=new` + CDP，脚本写 `%TEMP%`、用完删除；**为避开原子替换与 Vite watcher 冲突，先停掉本项目 dev server 再改文件，验证前重启同一个服务器**，端口仍是 5173）：控制台 **0 错误**；面板结构仍是 **4 分组 / 38 参数 / 5 分区 / 5 个可视化开关**，说明模式 **507** 个 DOM 节点；38 个「它是什么」、38 个「调大…调小…」、27 项 `new-events` + 11 项 `immediate` 全部就位；58 个状态字段全部有 `title` 与 `data-hint`；参数悬浮说明 38/38 含「配置键 GAME_CONFIG」；真实点击「紧凑模式」后 `data-compact=true`、`getComputedStyle` 确认说明为 `display:none`、文档高 6 978 → 4 904 px、**节点数仍为 507**；随后 16 次切换 + 9 秒刷新，节点数保持 507 不变；窄窗口 420×560：面板宽 400 完全在视口内、无横向溢出、可滚到底且最后一条限制可命中、`DEV ▾` 与入口均命中自身、38 项参数齐全；**截图逐张目视核对**（说明模式顶部 / 参数区 / 紧凑模式 / 窄窗口），中文换行完整、无重叠、无豆腐块。浏览器侧只报 DOM 计数、`getComputedStyle` 与命中测试结果，**未编造 FPS 或耗时**。
- 保留的边界：不改 `GAME_CONFIG` 正式平衡值、不改玩法规则、不新增 AI 状态、不改任何已有控件与可视化开关行为；观察仍是只读纯函数（不触发额外寻路）；DEV-A、双阵营冻结、READY 独立计时、JSON V3、抓捕与两套 AI 行为无回归；`.trae/` 与 `.dsh-meow/` 未读取、未暂存、未修改。
- 下一步建议：请用户按 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §10 一并复测（第 12 项结构回归 + 第 13 项易用性回归）；统一验收通过并经**单独授权**后再建立 Git 检查点。

## 2026-09-26｜DEV-B 最终人工验收与 Git 归档

- **完成范围**：实时 AI 状态观察、38 项仅内存参数调试、场景可视化、中文说明与紧凑面板；不改正式 `GAME_CONFIG`，不写入地图 JSON V3。
- **浏览器人工验收：6/6 通过。**

| 验收项目 | 结果 |
|---|---|
| 界面不重复；中文说明与紧凑模式 | 通过 |
| 实时状态与场景可视化；参数真实生效 | 通过 |
| 参数恢复与生命周期；布局及旧功能 | 通过 |

- **本轮实际验证**：

| 检查 | 结果 |
|---|---|
| `npm test` | 472 项全部通过 |
| `npx tsc --noEmit` | 通过 |
| `npm run build` | 通过；JS 838.33 kB（gzip 223.33 kB），包含非阻断的 Vite chunk 体积提示 |
| `git diff --check` | 通过 |

- **文档整理**：交接文档更新为 DEV-B 当前验收与归档状态；DEV-B 设计文档保留参数、机制、测试和限制细节；长期规范只修正 DEV-A / DEV-B 设计文档定位，不写入动态进度。既有 DEV-B 各轮日志保留原样，本条作为最终状态补记。
- **Git**：归档提交标题为 `feat: complete dev-b runtime ai debugging tools`；本条随该归档提交保存。提交 SHA 与远端同步状态按 Git 查询结果报告；不创建 Tag。
- **未完成与授权**：DEV-B 后续扩展需另行授权；S7C-1B 及后续藏身玩法未因此获批。正式视觉/听觉仍不包含家具遮挡，视觉系统仍无视锥角。

## 2026-09-26 +08:00｜S7C-1B 一次性完整实施：藏身、Human 玩家 Q 扇形搜查与抓捕、DeepSeek Q 锁门冷却（待用户浏览器统一验收）

- 任务与授权：用户当轮给出 **S7C-1B 完整授权**，把该子阶段改为「DeepSeek 娘藏身 vs Human 玩家主动搜查与抓捕」，要求一次性交付全部功能、自行安排内部编码顺序并在完成后集中报告一次；重大架构冲突才暂停。**未 commit、未 push、未创建 Tag**（未获归档授权）。
- 起始核实（前置条件 1、8）：`main`、`HEAD == origin/main == 9b048fb`（`docs: consolidate project logs and stage documentation`），工作区仅未跟踪 `.trae/`、`.dsh-meow/`，无 `.git/MERGE_HEAD` 等残留、无 stash；`src/` 中**不存在任何** `HideSystem` / `CONCEALED` / Human Q 搜查实现，因此没有既有 S7C-1B 成果可复用或覆盖。基线 `npm test` 472/472、退出码 0。
- 纯逻辑层（全部可单测、无 DOM / Three.js）：新增 `src/systems/HideSystem.ts`（`OUTSIDE ⇄ CONCEALED`；E 点按立即切换，**取消原方案的 400 ms ENTERING 计时**；每条拒绝路径 `NOT_PLAYING` / `WRONG_FACTION` / `NOT_PLAYER_CONTROLLED` / `ALREADY_CONCEALED` / `STUNNED` / `SPRINT_ACTIVE` / `CAPTURE_IN_PROGRESS` / `NO_HIDE_SPOT` / `POSITION_ILLEGAL`；退出原因 `PLAYER_E` / `SEARCHED` / `ROUND_RESET` / `ROUND_FINISHED` / `MAP_APPLIED`；Human 碰撞圆重叠时拒绝退出且**保持藏身**；`occupancyOf()` 仅供 DEV/测试）；`src/systems/HumanSearchSkill.ts`（Human Q 判定核心：释放瞬间半径 1.5 / 张角 120° 只判一次，藏身目标瞄**绑定家具的可接近表面**而不是家具中心或藏身者实时坐标，被墙/非 OPEN 门叶挡住即 `BLOCKED`，与按键、冷却、特效完全分离，供未来 S7C-2 的 Human AI 复用）；`src/systems/HideInteractionArbitration.ts`（E 键唯一仲裁：扫雷 > 门 > 藏身 > 进食；藏身中只输出 `HIDE_EXIT`）；`src/systems/SkillCooldown.ts` + `src/systems/SkillGates.ts`（两个 Q 的冷却与门禁；`resolveQSkill()` 保证一个按键只映射一个技能；`lockArmsPlayerCooldown()` 规定只有 `LOCKED` 才消耗冷却）。
- 正式数值（写入 `GAME_CONFIG` 并同步 `docs/GAME_BALANCE_CONFIG.md`）：`humanSearch.range = 1.5`、`halfAngleDeg = 60`（张角 120°）、`cooldownMs = 12_000`；`door.playerLockCooldownMs = 20_000`。**藏身本身没有新增任何可调数值**（进入是点按即切换，也没有独立的 Human 距离门槛），交互区域复用 DEV-A 已批准的地图创作数据。扇形特效的淡入/停留/淡出（120 / 140 / 260 ms）是表现层常量，留在 `src/three/HideSearchView.ts`，不进 `GAME_CONFIG`。
- 接线（`src/three/ThreeGame.ts`）：`E` 走唯一仲裁后执行门 / 进入藏身 / 退出藏身；`Q` 按 `resolveQSkill()` 分流为 DeepSeek 锁门（成功才起 20 秒冷却）与 Human 扇形搜查（有效释放即起 12 秒冷却，未命中同样消耗）；藏身期间**位移强制为 0**（与 STUNNED 同构）、`Space` 冲刺被拦、`rice.interrupt()` 且不累计进食、门与锁门被拒并给出通俗提示；进入藏身时把既有抓捕进度归零。视觉上藏身期间隐藏角色可视体（**根节点不动**，碰撞与抓捕锚点不变，最省事的 V3 风格表现）。
- 感知与抓捕联动：`PerceptionSystem.VisionSystem` 新增 `setConcealed()` 与 `VisionStatus = 'CONCEALED'`（**单向抑制**：藏身者不可见且不再刷新其 `lastSeen`，另一方视线保持原逻辑，原记录仍按既有生命周期自然过期）；常规抓捕资格在藏身期间直接判为 `false`（既有 `advancePlaying` 会把进度归零，不新增第二套抓捕规则）；`GameStateSystem.forceCapture()` 复用同一条结算路径实现「Q 命中即立即抓捕成功」，未新建胜负系统。Human AI 输入里**没有**任何占用信息，两套 AI 都没有新增藏身行为。
- 地图编辑与生命周期：新增 `src/three/map/MapApplicationPrecheck.ts`（只读预检：两个角色站位 + 正在使用的藏身出口在新地图上仍可站立、藏身点仍存在），`SceneEditor.applyEdits()` 在 `session.apply()` **之前**调用 `onPrecheck`，失败即拒绝应用并保留旧地图与旧藏身状态；`rebuildApartment()` 只在**地图内容真的变化**时安全清空藏身（关闭/放弃草稿重建同一张图不会把人从柜子里请出来）；重开、返回阵营页、局终、暂停与地图应用分别清理藏身、两个冷却与扇形特效。
- DEV 与日志：DEV 面板新增 `Hide / 藏身` 分类（藏身状态、藏身点、真实进入位置＝退出位置、当前位置的检查码与最近匹配点、最近拒绝/退出原因、本局进入/退出/拒绝次数、视觉与抓捕影响、两个 Q 的冷却与最近命中结果、玩家可见提示）；普通 HUD 新增 `.skill-hud`（只显示当前控制方自己的状态与冷却，**不含对手藏身信息**）；`AILogCollector` 新增独立 `hideEvents` 时间线（`formatVersion` 由 `1.1` 升为 `1.2`），人工控制 DeepSeek 时同样可导出。
- 与批准规则的逐条对应：E 点按立即藏身且无 400 ms / 无独立 Human 距离门槛（`captureProgressMs === 0` 仍在）；进入不传送、记录真实位置并沿用为退出位置；Human 碰撞圆重叠时拒绝退出、非重叠时即便身处抓捕圈也允许退出；藏身中禁移动/冲刺/进食/锁门与门交互；普通视觉与常规抓捕无效、退出立即恢复且无额外免疫；Q 释放只判一次、淡入淡出不重复命中；空家具/扇形外/墙后/关闭门后不误抓；DeepSeek Q 成功才起冷却、失败不消耗。
- 自动化测试 472 → **518**（新增 46 项，7 个新文件）：`tests/hide-system.test.mjs`（8 项：进入成功与事件、8 条拒绝路径不改变状态、重复进入、退出与 Human 重叠拒绝、非重叠放行、退出原因区分、`occupancyOf`、`reset` 清空）、`tests/hide-interaction-arbitration.test.mjs`（6 项：扫雷优先、藏身中只退出、门优先含距离相等、门不优先时藏身先于进食、回落到进食/无操作、全组合确定性）、`tests/human-search-skill.test.mjs`（8 项：数值来自 `GAME_CONFIG`、藏身目标瞄家具表面且忽略实时坐标、家具中心在扇形内也不隔墙命中、未藏身命中、半径边界含入、张角边界含入与对称、缺目标/缺点/缺家具、表现层与判定共用 `rotation.y = -heading` 约定）、`tests/skill-cooldown.test.mjs`（7 项：冷却生命周期、**只随传入 delta 推进**（源码断言不自带时钟）、`reset`、Q 技能归属唯一、两个门禁文案、只有 `LOCKED` 消耗冷却）、`tests/hide-map-precheck.test.mjs`（6 项：正式地图通过、角色非法、藏身点缺失、藏身出口无法站立、**预检只读**、无藏身者时只查两个角色）、`tests/hide-integration.test.mjs`（5 项：藏身期间 `CONCEALED` 且不刷新 `lastSeen`、退出立即恢复、藏身时抓捕资格 `false` 且进度归零、`forceCapture` 只在 PLAYING 生效且走同一结算、**源码断言两个 AI 控制器都不含 `HideSystem`/`occupancyOf`/`isConcealed`、DeepSeek 状态机没有新增藏身状态、`CHECK_HIDE` 仍是保留接口**）、`tests/hide-search-view.test.mjs`（6 项：扇形参数等于已批准数值、快照位置与朝向、淡入淡出曲线、**连续 25 次释放几何体与材质对象不变、场景对象数不增长**、命中反馈自行消失、`reset` 与幂等 `dispose`）。同步更新 3 处既有断言：DEV 分类清单新增 `hide`、`visionStatus` 联合类型新增 `CONCEALED` 的中文映射、AI JSON `formatVersion` 升为 `1.2`——均为与新行为保持同步，未削弱任何断言、未删除任何测试。
- 门禁（本轮实测）：`npm test` **518/518 通过**（失败 0 / 已取消 0 / 已跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 tsc）退出码 0（仅既有 >500 kB chunk 警告，JS 858.91 kB / gzip 229.54 kB、CSS 13.68 kB）；`git diff --check` 退出码 0；`src/config/gameConfig.ts` 只新增两个已批准数值、无既有数值变化。
- 真实浏览器复核（本机 Chrome `--headless=new` + CDP，脚本写 `%TEMP%`、用完删除，复用已在运行的 5173 dev server）：控制台 **0 错误**（仅既知 `/favicon.ico` 404）。**DeepSeek 侧闭环**：从玄关出生点用真实按键走图（先按 E 打开玄关→客厅的门，`door-message` 显示「门已打开」，再穿门洞到客厅纸箱）→ DEV 面板 `藏身检查` 读到 **`LEGAL / hide_living_carton`** → 点按 E → **`藏身中（hide_living_carton）`**、真实进入位置 `(7.0, 3.9)`、本局**进入 1 / 退出 0 / 拒绝 0**；此时 `Human 看到的 DeepSeek：CONCEALED`、常规抓捕**不累计**；按住 W 700 ms 后坐标**完全不变**、`Space` 后冲刺状态仍 `NORMAL`、`Q` 给出「藏身中不能锁门；按 E 退出藏身」；再次点按 E → 回到 `普通`、退出原因 **`PLAYER_E`**、视觉恢复、计数 **1/1/0**。**Human 侧**：临时控制 Human 后按 Q，冷却立刻读到 **11.5 秒**、释放/命中 **1/0**、结果为「目标不在扇形半径内」（距离 16.66、偏差 19.6°），HUD 同步显示「人类：Q 扇形搜查（半径 1.5、张角 120°）｜Q：冷却中 11.5 秒」。**搜查命中的完整链路**：重新藏身后等 Human AI 走近并接管，走到纸箱南侧朝家具按 Q → 结果 **`搜出藏身目标｜瞄点 (7.9, 3.4)｜距离 0.29`**、计数 **2/1**、藏身状态回到 `普通`、退出原因 **`SEARCHED`**、结算界面显示 **「人类获胜／原因：抓捕完成」**（对局 01:02）。另截图目视核对技能 HUD 与 DEV `Hide / 藏身` 分类：中文单行无重叠、无缺字。浏览器侧只报 DOM 文本、命中测试与坐标读数，**未编造 FPS 或耗时**。
- 已知限制：①藏身音效未新增（既不新增 `SoundType`，藏身期间也不产生新声音）；②Human AI 的 `CHECK_HIDE`、DeepSeek AI 自主藏身与地图随机化**未实现**（属 S7C-2 / 2b / 3，未授权）；③扇形不穿墙、不穿关闭/上锁的门，但**家具不作为视觉/搜查遮挡**（沿用既有感知规则）；④进入藏身后普通 `Last Seen` 记录不再刷新，但要等既有 8 秒生命周期自然过期；⑤视觉表现只隐藏角色可视体，没有正式的「进柜子」动画或家具拆件。
- Git 与下一步：本轮共 **16 个修改 + 14 个新增 = 30 个文件**（含本日志与 `docs/GAME_BALANCE_CONFIG.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEEPSEEK_HANDOFF.md` 的状态同步）；未 commit / push / tag，未读取或暂存 `.trae/`、`.dsh-meow/`。**请用户按本文件与设计文档列出的验收点集中做一次浏览器人工验收**；通过并经**单独授权**后再建立 Git 检查点（届时须重跑门禁并复核暂存清单）。S7C-2 / 2b / 3 仍未授权。

## 2026-09-26｜S7C-1B 最终人工验收与 Git 归档

- 阶段与日期：S7C-1B 藏身与主动搜捕，2026-09-26。
- 完成内容：用户确认藏身、Human 玩家搜查与抓捕、DeepSeek 玩家锁门及状态回归均符合本轮批准范围；不包含 AI 自主藏身或自主搜查。
- 自动化测试与人工验收：

| 检查项目 | 结果 |
|---|---|
| `npm test` | 518 项全部通过 |
| `npm run build` | 通过；含 `tsc --noEmit`，有非阻断的 Vite 体积提示 |
| `git diff --check` | 通过 |
| 浏览器人工验收 | 6 项全部通过 |

- 人工验收项目：DeepSeek 点按 E 藏身、藏身状态与安全退出、Human Q 手动抓捕、Human Q 搜查家具、DeepSeek Q 锁门、状态及旧功能回归。
- Git 检查点：本记录与 S7C-1B 实现随本次 `feat: complete s7c-1b hiding and manual search` 提交归档并推送至 `origin/main`；完整提交编号以最终 Git 查询为准。不创建 Tag。
- 已知限制与下一项任务：DeepSeek AI 自主藏身、安全判断及自主现身归入 S7C-2b；Human AI 自主搜查归入 S7C-2；地图随机化归入 S7C-3。以上后续阶段均未获授权，不因本次归档自动开始。

## 2026-09-26｜S7C-2 Human AI 米痕循迹与家具搜查（一次性完整实现）

- 任务名称：S7C-2 Human AI 亲自发现米痕、规则型循迹、公开家具怀疑与自主 `CHECK_HIDE` 搜查。用户已一次性批准完整方案，并要求「自行安排内部编码顺序、不逐模块请示，只有重大冲突才停下」，完成后集中报告并**等待一次集中式浏览器人工验收**。
- 当前开发阶段：S7C-2 **已实现、待用户人工验收**；未 commit / push / tag，**Gate 未建立**。开始前核对 Git 基线：`HEAD == origin/main == db8dfe6`（S7C-1B 归档），工作区仅未跟踪 `.trae/`、`.dsh-meow/`，无合并 / 变基残留。
- 实际完成内容（按用户简报逐条）：
  - **米痕三层数据分离**：新增 `src/systems/RiceTraceClues.ts`（纯逻辑）。图层 A＝世界中全部有效米痕；图层 B＝`selectVisibleTraces()` 用**现有正式视觉几何**（`PerceptionGeometry.inspectVision`：视距 + 墙体 + 非 OPEN 门叶）过滤出的「真正看得见」；图层 C＝`RiceTraceClueMemory` 的**有限线索快照**。只有 C 进入决策；`validUntil = createdAt + 实体自身 lifetimeMs`，**记忆寿命绝不长于原实体**，过期即从推断中消失。家具不参与视觉遮挡，因此这里也不做家具遮挡、未改全局视觉规则。
  - **规则型循迹与方向推断**：新增 `src/systems/HumanTraceTracking.ts`（纯逻辑，无机器学习、无随机数）。状态码 `NO_CLUE / SINGLE_TRACE / CHAIN / TRACE_JUMP / CHAIN_CONTRADICTORY` 与置信度 `NONE / LOW / MEDIUM / HIGH` 全部可解释；单粒米只给「低」且只去调查附近；更早米痕跳跃过远降为 `TRACE_JUMP`；朝向与路径相差超过 90° 判矛盾并降级。**修正了一处轴向不一致**：米痕实体的 `heading` 用 `atan2(dx, dz)`、搜查扇形用 `atan2(dz, dx)`，模块内用 `traceHeadingToDirectionRad()`（`θ = π/2 − heading`）显式换算，否则一条直线路径会被误判成「方向矛盾」。
  - **公开家具候选与反作弊排序**：新增 `src/systems/HideSearchCandidates.ts`（纯逻辑）。候选只来自公开藏身点 / 公开家具（位置 / 朝向 / 尺寸）/ Last Seen / 亲自发现的米痕 / 实际收到的声音 / 自己的搜查失败历史；**输入结构里没有占用信息**，因此「某件家具真的有人」不可能提高它的排序。评分＝自身距离 1 + 锚点距离 2 + 终止加分 6 + 方向对齐 4 + Last Seen 3 + 声音 2，同分比距离、再比稳定 ID，完全确定。「痕迹在家具附近终止」直接复用 DEV-A 已批准的 `pointInHideRegion` 公开交互区域判定。另加 `gateHideSearchByClues()`：**一粒米不足以锁定家具**——`SINGLE_TRACE` 必须再有一条独立公开线索（Last Seen 或实际听到的声音）落进某件家具的公开交互区域才允许正式搜查，`CHAIN_CONTRADICTORY` 直接拒绝。
  - **Human 合法搜查站位**：新增 `src/systems/HumanHideSearchStance.ts`（纯逻辑）。复用 `rectSurfacePoint` / `localToWorld` / `REGION_NAV_SNAP_LIMIT`，但判定是 Human 自己的：真实角色圆碰撞 + 真实导航格（吸附 ≤ 0.45）与 A* 可达 + 与**家具可搜查表面**（不是中心）距离 ≤ 1.5 + 前方 120° 扇形 + 墙与非 OPEN 门叶不遮挡；旋转家具使用真实旋转轮廓。站位间距 0.3，按周长每 0.4（＝寻路格边长）采样，最多跑 4 次 A*。
  - **公开几何核心抽取**：`src/systems/HumanSearchSkill.ts` 新增 `evaluateHumanSearchGeometry()`（距离 / 张角 / 遮挡）与状态码，`evaluateHumanSearch()` 改为走同一条核心，**玩家 Q 与 AI 搜查共用同一套几何**，不存在两份实现；玩家 Q 的瞬时命中、12 秒冷却与扇形特效未改动。
  - **`HumanAIController` 增量扩展**（未重建状态机）：公开优先级＝① 当前真实目视目标（并立即中止搜查）② 新 Last Seen ③ 新**强危险声音**（复用现有 `isHumanPursuitSound`：FOOTSTEP / SPRINT / FALL / FORCE_BREAK，可立即中止搜查，但不打断 SEARCH 与 Last Seen 调查）④ 新发现且仍有效的米痕 ⑤ 普通声音与旧调查任务 ⑥ 家具搜查与既有有限搜索 ⑦ 巡逻。`CHECK_HIDE` 成为真实状态：`TRAVEL → DWELL（900 ms、AI 不移动、只按 `faceHeadingRad` 保持朝向）→ DONE`，停留满后**只请求一次**正式判定并等回执。上限：每轮最多 1 件家具、同家具搜空后 6 秒冷却、同一次调查最多 `searchRoomCount`（3）件、搜查动作共享既有 `searchMaxMs`（15 秒）预算，**同一批米痕签名只触发一次**（不通过重启同一轮绕过上限）。有限搜索联动：`SEARCH` 到达的搜索房间若有公开藏身点则该轮可转去检查，搜空后回到同一次搜索的剩余房间、**不会在同一轮连查第二件**。结束路径：`NO_CLUE / NO_CANDIDATE / ALL_CANDIDATES_COOLED / NO_LEGAL_STANCE / CANDIDATES_UNREACHABLE / ROUND_BUDGET_USED / CLUE_TOO_WEAK / TARGET_VISIBLE / DANGER_SOUND / CHECK_TIMEOUT / NO_ROUTE / MANUAL_CONTROL / MAP_REBUILT / CHECK_DONE`，最终都回到既有 SEARCH / PATROL。生命周期：`reset()` 全清；`resumeAfterManualControl()` 中止半途搜查；`rebindMap()` 作废旧家具候选并在真正换图时清空线索；冻结 / 暂停期间不调用 `update()`，因此停留、冷却与线索有效期都不推进。
  - **正式搜查结算的分层接缝**：`ThreeGame.runHumanAiHideCheck()` 只在「到达合法站位 + 朝向正确 + 满 900 ms 停留」后才读取权威占用；`concealed && 真实藏身家具 === 正在检查的家具` 时用 S7C-1B 的 `evaluateHumanSearch()` 判定，命中即 `releaseHide('SEARCHED')` + `GameStateSystem.forceCapture()`（同一条结算与同一套胜负 / UI）。回执给 AI 的**只有一个布尔值**（`onCheckHideResult(spotId, hit)`，arity = 2）；搜空不改藏身状态、不泄露坐标；开发者真值只写 DEV 字段，**不写玩家可见的 `hideNotice`**。Human AI 的搜查**不继承**玩家 Q 的 12 秒冷却。
  - **DEV-B 只读观察 + DEV 可视化 + AI JSON**：新增 `DevBHumanHideSearch`，把 `clue*`（AI 已知）/ `inference*`、`candidate*`（AI 推断）/ 其余（开发者真值）三段明确分开；`human-ai` 分区新增 17 条观察项（线索数量与过期、推断方向与依据、怀疑家具与公开排序、搜查站位 / 表面、停留进度、本轮与本次调查已检查数量、失败记忆与剩余冷却、最近结果、放弃原因、次数统计、信息归属说明与 DEV 图例）。DEV 新增可视化开关 `clues`（绿＝AI 已知米痕线索、青＝AI 推断方向与锚点、洋红＝AI 推断的怀疑家具），绘制对象只创建一次且排在声音标记之前，既有「最后 N 个子对象＝声音标记」断言仍成立。AI JSON 新增独立 `humanSearchEvents` 时间线，`formatVersion` 由 `1.2` 升为 **`1.3`**（`hideEvents` 与旧字段全部保留），事件只在真实变化时写入，不逐帧刷屏。
  - **内部技术阈值集中定义**：新增 `src/systems/HumanSearchTuning.ts`，只放实现细节、不放玩法平衡值，每一条都由现有源码真实数值推导并写明依据，`S7C2_INTERNAL_THRESHOLDS` 汇总；另修正 `src/three/map/HideInteractionRegion.ts` 顶部「尚未接入玩法」的过期注释（改为说明 S7C-1B / S7C-2 的实际用法），**未改动任何几何实现**。
- 新增的正式数值（仅两项，其余全部复用既有值）：`GAME_CONFIG.humanAI.hideCheckFailureCooldownMs = 6,000 ms`、`GAME_CONFIG.humanAI.hideCheckMaxPerRound = 1`。推导向内部阈值（不进 `GAME_CONFIG`）：米痕链连接距离 `traceStepDistance × 6 = 3.9 u`、`TRACE_CHAIN_MAX_CLUES = 8`、`TRACE_DIRECTION_CONTRADICTION_DEG = 90`、`TRACE_CHAIN_HIGH_CONFIDENCE_LENGTH = 3`、`CLUE_MEMORY_MAX = 160`、`STANCE_SURFACE_STEP = navCellSize = 0.4 u`、`STANCE_STAND_OFF = 0.3 u`、`STANCE_MAX_PATH_PROBES = 4`、`CANDIDATE_TRY_LIMIT = searchRoomCount = 3` 与 6 个公开评分权重。
- 自动化测试 518 → **565**（新增 47 项，6 个新文件 + DEV-B 可视化新增 1 项）：`tests/rice-trace-clues.test.mjs`（7 项：视距内外与边界、墙 / CLOSED / LOCKED 阻挡与 OPEN 放行、过期米痕不进图层 B 也不成线索、快照与寿命不延长、容量上限与签名稳定、排序确定、**源码断言适配接口无对手坐标**）、`tests/human-trace-tracking.test.mjs`（9 项：无线索、单粒米低置信、轴向换算、连续链方向、连接距离含边界、跳跃降级、矛盾降级与 90° 边界、最近 8 粒上限、确定性与八方位中文）、`tests/hide-search-candidates.test.mjs`（7 项：确定性与排序不变量、冷却 / 已查 / 家具缺失排除、**公开评分可逐项复算**、方向对齐与 Last Seen / 声音加分、痕迹中断形成多候选、线索门槛四个码、源码无占用读取）、`tests/human-hide-search-stance.test.mjs`（5 项：**8 个藏身点在真实地图上全部有合法站位**且逐项满足五项要求、站位间距边界、旋转家具真实轮廓、采样确定性与步长、四种拒绝码与探测上限）、`tests/human-search-tuning.test.mjs`（4 项：已批准玩法值未被改动、推导边界（含线索容量覆盖理论上界）、阈值清单完整、模块只引用不复制）、`tests/human-ai-check-hide.test.mjs`（14 项真实地图控制器集成：两粒米产生公开怀疑并进入 `CHECK_HIDE`、单粒米只调查附近且给出 `CLUE_TOO_WEAK`、**满 900 ms 才请求一次且不重复请求**、搜空记录 6 秒冷却、**同一批线索不能重启同一轮 + 新线索可以换家具**、同一次调查最多 3 件、目视立即中止、强危险声中止而普通声音不打断、搜查中新米痕只记忆不重规划、搜索房间里有藏身点时转入检查并在搜空后回到剩余房间、人工接管 / 换图 / 重开全部清理、冻结帧（`deltaMs = 0`）不推进且控制器无内部时钟、**候选顺序与「谁真的藏在哪」无关**、AI 侧结果只有搜中 / 搜空）。另有 `tests/dev-b-visualization.test.mjs` 新增 1 项线索 / 推断 / 怀疑家具图层的绘制与开关。
- 同步的既有断言（均为与新行为保持同步，**未削弱任何断言、未删除任何测试**）：`tests/hide-integration.test.mjs` 中「`CHECK_HIDE` 仍是保留接口」改为「已是真实状态，但 `HumanAIInput` / `HumanAICommand` / `HumanAIMapSnapshot` / `HideSearchCandidateInput` 四个接口都不得出现占用或隐藏坐标字段」；`tests/ai-log-collector.test.mjs` 的 `formatVersion` 由 `1.2` 升为 `1.3`；`tests/dev-b-visualization.test.mjs` 的可视化开关清单新增 `clues`；`tests/dev-b-help-text.test.mjs` 与 `tests/dev-b-panel-dom.test.mjs` 的观察夹具补上新的 `hideSearch` 字段。
- 变异验证：临时把「900 ms 停留」与「线索强度门槛」改回缺陷版本，`tests/human-ai-check-hide.test.mjs` 各有一项确实失败，复原后全绿——证明新断言不是「从不失败的测试」。
- 门禁（本轮实测）：`npm test` **565/565 通过**（失败 0 / 取消 0 / 跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 tsc）退出码 0（仅既有 >500 kB 提示，JS 898.20 kB / gzip 241.55 kB、CSS 13.68 kB）；`git diff --check` 退出码 0。
- 真实浏览器复核（本机 Chrome `--headless=new` + CDP，脚本与临时 profile 写在 `%TEMP%`、用完删除，复用 `http://127.0.0.1:5173/`——本轮该 dev server 由我启动，仅此一个）：控制台除既知 `/favicon.ico` 404 外 **0 错误**；可进入 PLAYING；DEV-B 面板 **5 个分区 74 条观察项、7 个可视化开关**（含新增 `clues` 及其完整中文标签）；新增的 S7C-2 字段在开局全部显示通俗的「没有数据」文案（如「AI 还没有亲自看到任何米痕」「当前没有在执行搜查（NONE）」）；DEV `Hide / 藏身` 分类的 `AI 已知：米痕线索 / AI 推断 / AI 怀疑家具 / 藏身搜查阶段 / 最近一次搜查结果 / 放弃搜查原因 / 开发者真值` 全部正常渲染；Human AI 仍按既有逻辑 `巡逻（PATROL） → 追逐（CHASE，VISION_TARGET） → 抓捕（CAPTURE，CAPTURE_RANGE）` 正常运行，未出现异常或卡死。**局限（如实记录）**：脚本控制的 DeepSeek 没能在浏览器里复现「吃到米 → 留下米痕 → AI 亲自看见 → 产生家具怀疑」的完整链路——全部门初始 CLOSED，脚本需要手动点按 E 开门，4 次尝试都在约 6 秒内被抓捕（属玩法过程限制，不是实现缺陷）。该链路由上面 14 项真实地图控制器集成测试与 33 项纯逻辑测试覆盖，**仍需用户人工验收**；本轮不把自动化复核宣称为人工验收，也未编造 FPS 或耗时。
- 已知限制：① 家具仍不参与视觉与搜查遮挡（沿用既有全局规则，未擅自增加家具体积遮挡）；② `Last Seen` 仍按 8 秒自然过期；③ 线索记忆是每局内存数据，不跨局保留；④ Human AI 的候选排序只保证「只用公开线索、可复算、确定」，不是最优搜索策略，也没有跨局学习；⑤ DeepSeek AI 自主藏身与地图随机化仍未实现。
- 下一步建议：**请用户按设计文档 §4.1 的链路与 DEV-B 的「AI 已知 / AI 推断 / 开发者真值」三段对照做一次集中浏览器人工验收**；通过并经**单独授权**后再按归档定式建立 Git 检查点（届时须重跑门禁、复核暂存清单、确认 `HEAD == origin/main`）。S7C-2b 与 S7C-3 未获授权，不因本轮自动开始。
- Git commit 信息：**本轮未提交**（按用户要求「验收前不 commit、push 或 tag」）；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。

## 2026-09-26｜S7C-2 修复轮：基于真实 AI 日志与 Codex 二次审计的一次性精准修复（待用户集中人工复验）

- 任务名称：S7C-2 Human AI 循迹与家具搜查的**一次性集中修复**——修复真实日志暴露的「有效米痕没有被重新评估」「Last Seen 同房间搜索覆盖缺口」「TRACE 搜空后的调查生命周期」「规划站位与正式搜查瞄点不一致」，并补齐可见反馈、结构化日志、真实游戏层桥接测试与浏览器复核。用户要求不重新规划 S7C-2、不拆成多个需反复审批的修复轮次，**完成后等待用户再次集中人工验收，本轮不 commit / push / tag**。
- 起始核对（前置条件 1）：`main`，`HEAD == origin/main == db8dfe6`（S7C-1B 归档）；工作区为上一轮 22 修改 + 11 新增（全部为未提交的 S7C-2 成果），无 `.git/MERGE_HEAD` 等残留、无 stash；`.trae/`、`.dsh-meow/` 未跟踪且全程未读取、未暂存、未修改。
- **① 有效米痕被延后后必须重新评估**（真实日志：米痕已被记住，却因为当帧被追逐 / 正式搜查占用而永不重评）：`considerTraceClue()` 改为 `considerPublicClues()` + `actOnPublicClues()`，触发条件不再依赖「本帧是否发现新米痕」，而是「是否存在**已知但没有用于发起过任务**的公开线索」（新增 `actedTraceIds` 集合，用「整集替换」保证规模被 `CLUE_MEMORY_MAX` 约束）。新增待处理批次公开摘要 `pendingClueCount / pendingClueValidUntilMs / pendingClueDeferReason / pendingClueDeferCount / pendingClueReevalCount` 与原因码 `HumanClueDeferReason`（`CHECK_HIDE / TARGET_VISIBLE / LAST_SEEN / DANGER_SOUND / TRACE_INVESTIGATION`），**有效期始终取自原米痕实体的 `createdAt + lifetimeMs`，进队列不续期**；全部过期时给出 `CLUE_EXPIRED` 并记事件。重评完全复用既有 `gateHideSearchByClues()`、候选排序与合法站位规划，不新建第二套判断；已处理的同一批线索不再重复触发调查或导航。
- **② Last Seen「最后目击房间」覆盖缺口**（真实日志：次卧失去视线后，AI 只搜相邻房间，从不考虑次卧自己的藏身家具）：新增公开门槛 `gateLastSeenRoomSearch()`（Last Seen 仍有效 + 坐标落在真实房间内 + 该房间确有公开藏身点），在既有相邻房间有限搜索**之前**先考虑同房间候选；同房间 ≠ 必定搜查，仍需候选门槛、合法站位与可达性。**每轮仍最多正式检查 1 件家具**：同房间那一次与随后的相邻房间搜索共用同一轮配额（`beginSearch(input, continueRound = true)` 不重开新一轮），因此两条分支不能绕过次数上限。新增来源码 `LAST_SEEN_ROOM` 与转移原因 `LAST_SEEN_ROOM_HIDE_SUSPECT`；搜空后回到既有相邻房间有限搜索。
- **③ TRACE 搜空后的调查生命周期**：新增 `finishCheckHideAction()` —— 一次搜查结束后清掉本次动作的相位 / 目标家具 / 站位 / 停留 / 回执等待 / 有限搜索房间队列，并记录 `checkHideInvestigationEndReason`。**刻意保留本次调查**（`investigationSource` 与调查级件数 / 时间预算）：真正调用 `endInvestigation()` 会把用户批准的「同一次调查最多 3 件家具」上限一起清零，等于用一串新米痕绕过上限——因此按 Codex 要求的「结束**或**更新」选择「更新」，并在源码注释里写明理由。计数语义同时改为：`checkHideRoundAttempts`（本轮已经**开始**的尝试，配额守卫，防中断后无谓重跑 A*）与 `checkHideRoundChecks`（本轮**正式执行**的搜查，在 900 ms 停留满、发出正式请求时才消耗）；`checkHideInvestigationChecks` 同样只在正式执行时消耗。
- **④ 统一规划站位与正式搜查瞄点**：正式判定不再用「离当前位置最近的表面点」重算，而是使用规划时保存的 `stance.surfacePoint`（新增 `noteCheckHideResolution()` 单向登记「计划瞄点 / 最终判定点 / 距离 / 张角偏差」）；执行前用新增 `pointOnRectSurface()`（`src/three/map/RotatedRect.ts`，唯一旋转几何来源）复核该点仍属于**当前已应用地图**的目标家具，家具被移动 / 旋转 / 删除时调用 `cancelStaleCheckHide()` **取消而不记搜空、不进 6 秒冷却**，并把本轮配额还回来合法重规划。判定核心仍是 `evaluateHumanSearchGeometry()`（玩家 Q 与 AI 共用），1.5 u / 120° / 墙门遮挡一项都未放宽，玩家 Q 的「最近表面点」选择与瞬时抓捕未改动。
- **⑤ AI 正式搜查的可见反馈**（纯表现）：`HideSearchView` 新增独立的 AI 扇形 + 家具轮廓（暖橙 `0xffab5c`，与玩家 Q 薄荷色扇形、命中琥珀色、DEV-B 绿 / 青 / 洋红三层都不同），AI 处于 `CHECK_HIDE.DWELL` 时点亮，离开时给一次中性收尾脉冲；Human 角色在停留期间走既有 `INTERACT` 动作。**不参与命中判定、不触碰玩家 Q 的 12 秒冷却、只画 AI 自己公开的目标家具**，因此不会泄露远处的真实位置或占用状态；900 ms 停留与「正式请求只发一次」不变。
- **⑥ 结构化 DEV-B 与 AI 日志**：`DevBHumanHideSearch` 新增 20 余项公开字段（待处理线索数量与剩余有效期及延后原因、Last Seen 公开坐标 / 房间 / 年龄 / 有效性 / 同房间门槛结论、被排除的候选原因、本轮开始 / 已执行 / 本次调查计数、收尾方式、打断搜查的真实声音类型 / 可听强度 / 剩余寿命 / 是否新事件、计划瞄点与最终判定点及差值、权威层判定码）。DEV `human-ai` 分类新增 8 条属性；AI JSON `humanSearchEvents` 的每个事件新增可选结构化 `data`（状态 / 前一状态 / 调查来源 / Last Seen 公开信息 / 待处理线索 / 候选与排序 / 站位与瞄点 / 结果 / 打断声音 / 计数），`formatVersion` 由 `1.3` 升为 **`1.4`**（`hideEvents` 与 `humanSearchEvents` 旧字段全部保留）。**AI 侧刻意只收公开安全字段**：权威层细粒度原因（例如「这件家具里确实有人但扇形被门挡住」）只进 `ThreeGame` 的 DEV 字段，回执给 AI 的仍然只有 `hit: boolean`（`onCheckHideResult` arity 仍为 2）。
- **⑦ 真实游戏层桥接测试**：把两段过去直接写在 `ThreeGame` 里的接线抽成可测模块 `src/systems/HumanHideSearchResolution.ts`——`createHumanAiMapSnapshot()`（公开世界快照的唯一构造点，三条几何接缝必须真的接线）与 `resolveHumanAiHideCheck()`（正式判定的权威层：先复核计划仍属于当前地图，再算公开几何，最后才读权威占用）。测试因此能用**同一段真实源码**驱动真实地图 / `CollisionWorld` / `PerceptionGeometry` / `HideSystem`。
- 修改文件（本轮新增于上一轮之上）：新增 `src/systems/HumanHideSearchResolution.ts`、`tests/human-hide-search-resolution.test.mjs`、`tests/human-ai-search-lifecycle.test.mjs`、`tests/hide-search-view-ai.test.mjs`；修改 `src/systems/HumanAIController.ts`、`src/systems/HideSearchCandidates.ts`、`src/three/map/RotatedRect.ts`、`src/three/HideSearchView.ts`、`src/three/ThreeGame.ts`、`src/systems/AILogCollector.ts`、`src/systems/DevBObserver.ts`、`src/systems/DevBHelpText.ts`、`docs/AGENT_LOG.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AI_HUMAN_STATE_TREE.md`、`docs/AI_STATE_OVERVIEW.md`、`docs/GAME_BALANCE_CONFIG.md`，并同步 5 个既有测试（`ai-log-collector` 1.4、`human-ai-check-hide` 计数语义与两条新分支、`dev-b-help-text` / `dev-b-panel-dom` / `dev-b-visualization` 夹具与两个新原因码表）。
- 新增正式数值：**无**。`GAME_CONFIG` 与所有已验收平衡值零改动；本轮只改判定流程、计数语义、表现层与日志字段。
- 自动化测试 565 → **587**（新增 22 项）：`human-hide-search-resolution.test.mjs`（8 项：三条几何接缝真的生效且与视觉同源、控制器整份保留快照且真实地图上线索数 > 0、**正式判定用计划瞄点（含「计划点 ≠ 最近表面点」的构造样本）**、空家具 / 他人家具不读真实藏身点、开门前后遮挡变化与 `OUT_OF_RANGE` / `OUTSIDE_FAN` / `STANCE_LOST`、旋转或删除家具 → `PLAN_STALE` 取消、旋转足迹的表面点复核、源码不含 `HideSystem`）、`human-ai-search-lifecycle.test.mjs`（10 项：次卧床米痕链指向 `hide_second_bed`、**延后批次带自己的有效期并被重评且不刷屏**、重新目视后批次不丢、Last Seen 调查不被更早的米痕批次抢占、米痕与 Last Seen 分别过期后不再形成旧怀疑、危险声打断并记录真实声音明细、**TRACE 搜空后动作收尾但保留调查预算**、命中走正式回执、反复中断不产生重复搜查 / 事件、延后机制只用公开线索状态）、`hide-search-view-ai.test.mjs`（3 项：AI 反馈只在停留期间点亮且与玩家 Q 完全独立、收尾脉冲会衰减并清理、停留驱动既有 `INTERACT` 且表现层不含冷却 / 判定调用）。`human-ai-check-hide.test.mjs` 由 14 项变为 15 项（拆出「同房间优先」与「无同房间藏身点时退回相邻搜索」两条）。
- 同步的既有断言（均为与新行为保持同步，**未削弱任何断言、未删除任何测试**）：`human-ai-check-hide` 中「开始前往即算本轮已检查」改为「开始只消耗尝试配额，正式执行才消耗执行配额」，并新增 `checkHideAttemptedSpotId`、`checkHideInvestigationEndReason`、同房间门槛码断言；`ai-log-collector` 的 `formatVersion` 由 `1.3` 升为 `1.4`；三个 DEV-B 夹具补上新增字段；`dev-b-help-text` 的「状态码中文映射与源码联合类型一致」清单新增 `checkHidePhase / checkHideSource / checkHideResult / clueDeferReason / lastSeenRoomGate` 五个表。
- 变异验证（4 次，逐一复原）：① 把「重评不再依赖本帧新米痕」改回缺陷版本 → `human-ai-search-lifecycle` 的延后批次重评测试失败；② 禁用同房间分支 → 5 项失败（两条同房间 / fallback、Last Seen 不被抢占、Last Seen 过期、旋转家具计划失效）；③ 正式判定改用最近表面点 → `human-hide-search-resolution` 的瞄点一致性与几何（半径 / 张角）两项失败；④ 去掉 TRACE 搜空的动作收尾 → `human-ai-search-lifecycle` 的生命周期测试失败。复原后全绿——证明新断言确实能抓住被修复的缺陷。
- 门禁（本轮实测）：`npm test` **587/587 通过**（失败 0 / 取消 0 / 跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 tsc）退出码 0（仅既有 >500 kB 提示，JS 924.60 kB / gzip 248.34 kB、CSS 13.68 kB）；`git diff --check` 退出码 0。
- 真实浏览器复核（本机 Chrome `--headless=new` + CDP，脚本与临时 profile 在 `%TEMP%`，复用已在运行的 `http://127.0.0.1:5173/`）：控制台 1 条既有库告警（`THREE.Clock` 弃用提示，非本轮引入）、**0 页面异常**；可进入「对局中」；DEV 面板 `human-ai/hide-*` 8 条新属性与 DEV-B 8 条新观察项全部渲染正常中文；`clues` 可视化开关正常。**关键复现（真实对局）**：脚本用真实按键把 DeepSeek 娘从玄关走到客厅纸箱并点按 E **成功藏身**（DEV `hide/hide-state = 藏身中（hide_living_carton）`）→ Human AI 失去视线后产生 Last Seen（`(7.20, 3.77)`，房间 `living`）→ **`HUMAN_LAST_SEEN_ROOM` 事件门槛为 `OK`：「最后目击房间 living 里有公开藏身点：hide_living_carton」** → 来源为 `LAST_SEEN_ROOM` → `TRAVEL → DWELL（900 ms）` → 正式判定 **`HIT_CONCEALED`**，且「计划瞄点 = 最终判定点 = (7.5, 3.4)」、站位与朝向均成立、权威层确实读取了真实藏身点；本轮计数显示 `本轮已开始 1 / 已正式执行 1（上限 1）/ 本次调查 1`。导出的 AI JSON `formatVersion = 1.4`、`humanSearchEvents = 9`（含 `HUMAN_LAST_SEEN_ROOM / HUMAN_HIDE_SUSPECT / HUMAN_HIDE_SEARCH_TRAVEL / START / DWELL`）、`hideEvents = 1`，8/9 事件带结构化 `data`。另用 DEV「冻结双阵营」把 DWELL 定住并截图，确认场景里出现 AI 搜查的**橙色扇形与家具轮廓**（截图见汇报）。复核期间临时用 DEV-B 内存覆盖了 `movement.humanAiMultiplier = 0.2` 与 `capture.radius = 0.2`（**只在内存生效、不改正式配置**），以便在脚本可控的时间内观察这段链路；结束即恢复页面。**未编造 FPS 或耗时。**
- 浏览器复核期间发现的过期文案（已顺手更正，属文档/帮助文本同步）：DEV-B 的 Human AI 状态中文把 `CHECK_HIDE` 写成「检查藏身（预留未实现）」，S7C-2 起它已是真实运行状态，改为「检查藏身家具（S7C-2 起为真实运行状态）」。
- 文档同步更正：`docs/GAME_BALANCE_CONFIG.md` 原文把 `STANCE_MAX_PATH_PROBES` 写成 4，现行源码是 **8**（注释写明「与 `searchRoomCount` 同量级再放宽到 8」），已按源码更正；上一条 `AGENT_LOG` 记录与设计文档旧文中的「4」「最多跑 4 次 A*」同为过期数字，本文件按「只追加、不回改」保持不变，以本条为最新事实。
- 已知限制与仍未证实的运行时风险：① 家具仍不参与视觉与搜查遮挡；② `Last Seen` 仍按 8 秒自然过期、线索记忆仍是每局内存数据；③ 候选排序只保证「只用公开线索、可复算、确定」，不是最优策略；④ 同房间分支与相邻房间分支共用同一轮配额，因此**同一次调查里最多只会因同房间线索多搜 1 件**（这是遵守「每轮最多 1 件」的结果，不是缺陷）；⑤ 正式几何的 `OUT_OF_RANGE / OUTSIDE_FAN` 在正常执行路径里几乎不可达（规划已保证 0.3 u 站位间距），它们仍是分层防御代码；⑥ 本轮浏览器脚本未复现「吃米 → 留痕 → 亲自看见米痕」的纯米痕链（门初始 CLOSED、脚本需手动开门），该链路由真实地图控制器集成测试覆盖。
- 下一步建议：**请用户做一次集中浏览器人工复验**（复验清单见本轮汇报），通过并经**单独授权**后再按归档定式建立 Git 检查点。S7C-2b 与 S7C-3 未获授权，不因本轮自动开始。
- Git commit 信息：**本轮未提交**；未 force push、未创建 Tag；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。

## 2026-09-26｜S7C-2 第二轮修复：Human 玩家 Q 家具交互 + Human AI 正式站位与结算（待用户集中人工复验）

- 任务名称：在既有 S7C-2 成果上一次性完成用户本轮批准的 A–E 修复——**A** Human 玩家 Q 改为「进入家具交互区域 → 唯一家具白色呼吸高亮 → Q 搜查」；**B** 统一 Human AI 导航终点与正式判定站位；**C** 修复 `STANCE_LOST` 等非法执行结果被误记为普通 `MISS`；**D** 修正「公开几何验证」先于「权威占用查询」的顺序；**E** 补齐真实游戏执行链测试、浏览器复核与中文文档。用户要求不重新规划 S7C-2、不拆成多个需反复审批的轮次，**完成后等待一次集中人工验收；本轮不 commit / push / tag**。
- 起始核对（前置条件 1）：`main`；`HEAD == origin/main == db8dfe6e9549fe36c8a8d764bdb3e6a10cd81e07`（S7C-1B 归档）；工作区为上一轮 24 修改 + 15 新增（全部未提交的 S7C-2 成果），`.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` 全部不存在、无 stash；`.trae/`、`.dsh-meow/` 未跟踪且全程未读取、未暂存、未修改。
- **A 玩家 Q 的两种互斥用途**：新增 `src/systems/HideTargetResolution.ts` 作为**公开家具交互目标的唯一解析函数**（`resolveHideInteractionTarget()`：真实交互区域 + 真实碰撞可站立 + 家具表面无墙门遮挡 + 真实导航格；按藏身点数组顺序取「到锚点距离最小」，确定性、不按占用排序、不读占用），并新增 `resolvePlayerQPlan()` 落实用户批准的输入优先级「① 12 秒冷却中 → 直接拒绝（不搜查、不抓捕、不产生新冷却）② 可用且有按键当帧重新解析出的合法家具目标 → 只搜查这件家具 ③ 否则 → 原有普通扇形角色抓捕」。DeepSeek 玩家按 E 藏身与 Human 玩家按 Q 搜查**共用同一套公开解析**（`nearestHideCandidate()` 改为调用它，行为逐字不变），但**不共享**阵营状态、技能消耗或占用信息。`ThreeGame.useSkillQ()` 的 Human 分支改为按 `resolvePlayerQPlan()` 分流，`performFurnitureSearch()` 使用新增的 `resolveHumanFurnitureSearch()`。
- **A 家具搜查的权威判定顺序**（`resolveHumanFurnitureSearch()`）：① 当帧有唯一高亮家具 → ② 该藏身点与家具仍属于当前已应用地图 → ③ 玩家确实位于合法交互区域 → ④ 与家具之间没有墙或非 OPEN 门叶（公开遮挡复核，绝不隔墙搜查）→ ⑤ 全部通过才**惰性读取一次**权威占用（`readOccupancy` 回调）。玩家**不需要面向家具**、家具也不必落在任何 120° 扇形内：该路径刻意不调用普通扇形的距离 / 张角几何（测试以源码断言 + 「家具中心既超 1.5 又落在 120° 之外仍然命中」的行为断言双重把守）。命中即 `releaseHide('SEARCHED')` + `GameStateSystem.forceCapture()`（复用 S7C-1B 结算）；合法搜空进入既有 12 秒冷却（有效释放时先行 `arm()`，与旧行为一致）；`NOT_LEGAL / PLAN_STALE / NO_TARGET` 回退到普通扇形抓捕。
- **A 白色呼吸高亮**（纯表现）：`HideSearchView` 新增独立的白色描边网格 `HIDE_PLAYER_TARGET_COLOR = 0xffffff`，只在「玩家站在某件公开藏身家具的合法交互区域内」时由 `ThreeGame.syncPlayerFurnitureTarget()` 每帧同步；呼吸周期 1,400 ms、透明度 0.25–0.8；Q 冷却中压到恒定 0.14 并停止呼吸，HUD 明确写「冷却中 X 秒（家具描边变暗，暂时不能按）」，绝不给「Q 可用」的误导。区域成员成立但站位不合法（例如隔墙、站不住、无导航格）时**不亮高亮**。离开区域、切换阵营、暂停、结算、地图应用、重开与局终都在同一处清理（`reset()` 亦清）。该网格与 Human AI 的暖橙搜查反馈是两套独立网格与独立状态，互不覆盖；高亮只读公开数据，**不读、不推断、不暴露任何家具占用**。
- **B 统一导航终点与正式站位**：真实日志的根因是「A* 吸附网格点」与「正式判定用的原始 `stancePoint`」是两个不同的中心——控制器按吸附点判到站，权威层按原始点判站位，两者最多相差 `REGION_NAV_SNAP_LIMIT`（0.45 u）。现在：导航网格点**仍只作寻路节点**；到达导航终点后 AI 进入新增的**最终接近**阶段（`finalApproach()`），在真实 `CollisionWorld` 下继续合法走向原始 `stancePoint`（不穿墙 / 不穿家具 / 不穿关闭的门，不重跑 A*，不会瞬移）；「能否进入 `DWELL`」改由**与权威层逐字相同**的谓词 `evaluateHideStance()`（新增于 `HumanHideSearchResolution.ts`，容差仍是既有 `humanAI.waypointTolerance + collision.contactEpsilon`）判定，**未放宽任何容差或判定距离**。卡住时沿用既有 `stuckRepathMs` / `stuckProgressEpsilon` 做有界收尾（`CHECK_HIDE_STANCE_UNREACHABLE`），且**不退还**本轮家具配额，因此不存在无限重规划。
- **C 类型化解析与计数**：`HumanHideCheckCode` 新增 `HEADING_LOST`；`PLAN_STALE / STANCE_LOST / HEADING_LOST / OUT_OF_RANGE / OUTSIDE_FAN / BLOCKED` 全部定义为**未完成合法检查**（导出常量 `HUMAN_HIDE_CHECK_INCOMPLETE_CODES`），`executable = false`、`cancelKind = 'INCOMPLETE'`，**不记搜空、不进 6 秒家具冷却、不写公开失败记忆**；只有 `MISS_EMPTY` / `HIT_CONCEALED` 才 `countsAsFormalCheck = true`。计数语义随之修正：`checkHideRoundChecks` / `checkHideInvestigationChecks` **不再在 REQUEST 时提前消耗**，改由游戏层回执（`noteCheckHideResolution({ countsAsFormalCheck })`）在真正完成时消耗；新增 `cancelIncompleteCheckHide()`（保留尝试配额）与有界的 `cancelStaleCheckHide()`（地图变化才退还配额，上限 `STANCE_MAX_STALE_CANCELS = 2`，超过后同样不退还）。
- **D 权威占用查询顺序**：`resolveHumanAiHideCheck()` 的输入由 `concealed / concealedSpotId` 改为**惰性** `readOccupancy()`；顺序固定为「计划仍属于当前地图 → 站位 → 朝向 → 1.5 u / 120° / 墙门遮挡 → 才读一次权威占用」。公开几何任何一条不成立时**权威占用查询次数为零**（测试用计数器直接断言 0）。
- **E 真实游戏执行链测试**：新增 `tests/human-ai-walk.mjs`（按 `ThreeGame.updatePlaying()` 同口径推进：AI 出方向 → 真实 `CollisionWorld.move()` 位移 → 门 / 解锁指令交给真实 `DoorSystem`），修正 `tests/human-ai-check-hide.test.mjs`、`tests/human-ai-search-lifecycle.test.mjs`、`tests/human-hide-search-resolution.test.mjs` 的走图与判定接缝（**不再靠瞬移到吸附点冒充「真实导航」**），并新增四个测试文件（见下）。
- **② 浏览器复核期间发现并修复的日志缺口**：家具搜查命中会在同一帧 `forceCapture()` 结束对局，而 `updatePlaying()` 之后不再运行，导致该帧产生的 `REQUEST / RESOLVE / HIT` 与 `HIDE_EXIT` 事件**永远不会写进 AI JSON**（上一轮真实日志里就出现过「有 DWELL 却没有结算码」的断点）。现于 `match.result` 置位处补一次 `recordHideEvents()` + `recordHumanSearchEvents()` 冲写；修复后同一场景导出的 JSON 含完整 12 条事件链。
- 新增文件：`src/systems/HideTargetResolution.ts`、`tests/hide-target-resolution.test.mjs`、`tests/human-furniture-search.test.mjs`、`tests/human-ai-stance-approach.test.mjs`、`tests/hide-search-view-player-target.test.mjs`、`tests/human-ai-walk.mjs`、`docs/verification/S7C-2-r2/browser-check.mjs`（可复用的真实浏览器复核脚本）与本次复核产物目录 `docs/verification/S7C-2-r2/`。修改文件：`src/systems/HumanHideSearchResolution.ts`、`src/systems/HumanAIController.ts`、`src/systems/HumanSearchTuning.ts`、`src/systems/AILogCollector.ts`、`src/systems/DevBObserver.ts`、`src/systems/DevBHelpText.ts`、`src/three/HideSearchView.ts`、`src/three/ThreeGame.ts`、`docs/AGENT_LOG.md`（本条）、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/AI_HUMAN_STATE_TREE.md`、`docs/AI_STATE_OVERVIEW.md`、`docs/GAME_BALANCE_CONFIG.md`，并同步 6 个既有测试（`human-ai-check-hide`、`human-ai-search-lifecycle`、`human-hide-search-resolution`、`ai-log-collector`、`hide-search-view-ai`、`dev-b-help-text` / `dev-b-panel-dom` / `dev-b-visualization` 夹具）。
- 新增正式数值：**无**。`src/config/gameConfig.ts` 仍为上一轮的 5 insertions / 0 deletions（`hideCheckFailureCooldownMs = 6,000`、`hideCheckMaxPerRound = 1`）；本轮新增的唯一阈值是内部技术常量 `STANCE_MAX_STALE_CANCELS = 2`（写明推导，进 `S7C2_INTERNAL_THRESHOLDS`，不进 `GAME_CONFIG`）。
- 自动化测试 587 → **613**（新增 26 项）：`tests/hide-target-resolution.test.mjs`（5 项：合法目标与「区域内但不合法」的真实样本、确定性与源码无占用读取、**构造重叠区域时仍然只有一个目标**、Q 输入优先级三分支互斥）、`tests/human-furniture-search.test.mjs`（10 项：唯一家具与 Q 提示、**背对家具 / 家具中心超出 1.5 且落在 120° 之外仍然命中**、墙或关闭的门阻隔时拒绝且不读占用、重叠区域只搜唯一合法家具、高亮阶段不读占用、藏身目标命中、合法搜空消耗 12 秒冷却与冷却中拒绝、无家具目标回退普通扇形（未命中同样消耗冷却）、家具移动 / 消失后拒绝、DeepSeek E 藏身与两个 Q 技能不回归）、`tests/human-ai-stance-approach.test.mjs`（7 项真实走图：**真实 0.313 u 错位下「只到吸附点」不算到站且必须继续最终接近**、次卧床真实走图 → DWELL → REQUEST（只一次）→ `HIT_CONCEALED` → 抓捕、合法搜空 → 6 秒冷却、DWELL 期间零漂移且保持朝向、**未完成检查取消且不记搜空 / 不进冷却 / 不退配额且不重开搜查**、计划失效退还有界、DEV-B 观察确实暴露三处中心与「是否计入正式检查」）、`tests/hide-search-view-player-target.test.mjs`（3 项：白色呼吸透明度真的变化且不超上限、冷却中恒定压暗不呼吸、与 AI 反馈互不覆盖并可重置）、`tests/ai-log-collector.test.mjs` 新增 1 项（`playerSearchEvents` 独立时间线、重开清空、与 `humanSearchEvents` 互不污染）。
- 同步的既有断言（均为与新行为保持同步，**未削弱任何断言、未删除任何测试**）：判定层输入由 `concealed / concealedSpotId` 改为 `readOccupancy()` 回调；`STANCE_LOST / BLOCKED / OUT_OF_RANGE / OUTSIDE_FAN` 的 `executable` 由 `true` 改为 `false`；朝向反转由 `STANCE_LOST` 改为 `HEADING_LOST`；「空家具不读真实藏身点」改为「公开几何成立后正好读一次、几何失败时零次」；计数断言改为「REQUEST 时为 0，回执后才为 1」；`human-ai-check-hide` 的走图辅助改为真实位移；`ai-log-collector` 的 `formatVersion` 由 `1.4` 升为 **`1.5`**（只新增 `playerSearchEvents`，`events / hideEvents / humanSearchEvents` 的字段与语义完全不变）；`hide-search-view-ai` 的子网格数由 4 改为 5；三个 DEV-B 夹具补上导航终点 / 偏差 / 计数等新字段。
- 变异验证（5 次，逐一复原）：① 把「必须站到原始站位」改回「到导航吸附点即算到站」→ 7 项失败；② 让未完成检查重新 `executable` → 2 项失败；③ 把权威占用读取放回公开几何之前 → 1 项失败（`occupancyReads === 0` 断言）；④ 把「真正完成的正式检查」计数搬回 REQUEST → 4 项失败；⑤ 让玩家家具搜查改成「瞄家具中心 + 1.5 u 距离门槛」→ 4 项失败。复原后全绿。
- 门禁（本轮实测）：`npm test` **613/613 通过**（失败 0 / 取消 0 / 跳过 0，退出码 0）；`npx tsc --noEmit` 退出码 0；`npm run build`（含 tsc）退出码 0（仅既有 >500 kB chunk 警告，JS 942.50 kB / gzip 252.78 kB、CSS 13.68 kB）；`git diff --check` 退出码 0。
- **真实浏览器复核（本轮核心证据，本机 Chrome `--headless=new` + CDP，脚本 `docs/verification/S7C-2-r2/browser-check.mjs`，复用已在运行的 `http://127.0.0.1:5173/`）**：控制台只有既有的 `THREE.Clock` 弃用告警与既知 `/favicon.ico` 404，**0 页面异常**。**① 次卧床（用户此前三次失败的真实场景）通过**：脚本用真实按键把 DeepSeek 娘从玄关经书房走到次卧（两个门都用 E 真实开启），站在 `hide_second_bed` 的公开参数置为合法位置（DEV `hide/hide-candidate = LEGAL / hide_second_bed`）后点按 E 藏身（`藏身中（hide_second_bed）`）；让 Human AI 真的看见过我之后失去视线 → **`HUMAN_LAST_SEEN_ROOM` 门槛 `OK`：最后目击房间 second_bedroom 里有公开藏身点** → 来源 `LAST_SEEN_ROOM` → `HUMAN_HIDE_SEARCH_TRAVEL`（站位 −14.35, 9.78；表面 −14.05, 9.83）→ `DWELL`（**到达规划站位偏差 0.234**）→ `HUMAN_HIDE_SEARCH_REQUEST`（**只一次**）→ `HUMAN_HIDE_SEARCH_RESOLVE = HIT_CONCEALED`（计划瞄点 = 最终判定点 = (−14.1, 9.8)，距离 0.53、偏差 −1.1°，站位成立、朝向成立、权威层读取真实藏身点：是、计入正式检查：是）→ `HUMAN_HIDE_SEARCH_HIT` → `CHECK_HIDE → CAPTURE`，对局 00:41 结束（人类获胜）。**关键对照**：该次 `navGoal = (−14.6, 9.6)` 与规划站位相距 **0.308 u > waypointTolerance 0.25**，正是旧实现会判 `STANCE_LOST` 的错位；新实现用 5 帧最终接近把偏差收到 0.2336 后合法进入 `DWELL` 并通过判定。导出的 AI JSON `formatVersion = 1.5`、`humanSearchEvents = 12`（含 TRAVEL / START / DWELL / REQUEST / RESOLVE / HIT 全链）、`hideEvents = 1`。**② Human 玩家 Q 家具交互通过**：控制人类走进储物间纸箱的合法交互区域 → HUD「人类：Q 搜查「储物间纸箱」（站在交互区域内即可，不必面向家具）｜Q：可用」、DEV 高亮 `FURNITURE（hide_storage_carton）`、区域合法性 `LEGAL`；**转身背对家具**（仍留在区域内）后按 Q → `MISS_EMPTY｜家具是空的（搜空）｜权威占用读取：是｜家具搜查 1 次`、提示「家具搜查完成：「储物间纸箱」没有人，Q 进入 12 秒冷却」、HUD 变为「冷却中 11.2 秒（家具描边变暗，暂时不能按）」；冷却中再按 Q 被拒绝（「搜查冷却中：剩 10.6 秒」）且搜查次数仍为 1。截图（`player-q-target.png` / `player-q-after.png`）目视确认家具出现**白色呼吸描边**、冷却后描边明显变暗。导出的 AI JSON `playerSearchEvents = 1`（`PLAYER_Q_FURNITURE_MISS`，含目标类型 / 合法性 / 冷却 / 是否读占用）。复核期间只用 DEV-B **内存**覆盖 `movement.humanAiMultiplier = 0.45` 与 `capture.radius = 0.05`（不改正式配置）；**未编造 FPS 或耗时**。
- **本轮明确 BLOCKED / 未复现**：① 「玩家 Q 从藏有 DeepSeek 娘的家具里搜出对方」在浏览器里**无法复现**——本局只有人工控制的 DeepSeek 娘会藏身（AI 自主藏身属未授权的 S7C-2b），玩家无法在同一局同时控制两个阵营，因此该分支只有真实地图自动化证据（`human-furniture-search` 命中项 + `human-ai-stance-approach` 的 `HIT_CONCEALED` 结算链）。② 「两个交互区域重叠」在**真实地图上不存在**（8 个区域两两不重叠，已用 0.1 网格全图扫描确认），因此重叠行为用「真实几何 + 移动家具构造的重叠」验证，**不是真实地图上的复现**。③ 本轮未复现「吃米 → 留痕 → AI 亲自看见米痕」的纯米痕链（与上一轮同因：门初始 CLOSED、脚本需手动开门，且该链路由真实地图控制器集成测试覆盖）。
- 已知限制：① 家具仍不参与视觉与搜查遮挡；② `Last Seen` 仍按 8 秒自然过期；③ 候选排序只保证「只用公开线索、可复算、确定」，不是最优策略；④ 正式几何的 `OUT_OF_RANGE / OUTSIDE_FAN` 在正常执行路径里几乎不可达（规划已保证 0.3 u 站位间距），它们仍是分层防御代码；⑤ 玩家 Q 的家具高亮只表示「可以交互」，与家具里有没有人无关（这是设计意图，不是缺陷）；⑥ `docs/verification/S7C-2-r2/` 下是本轮复核产物（脚本 / JSON / 控制台日志 / 截图），**未 commit**，用户可按需保留或删除。
- 下一步建议：**请用户按本轮汇报里的集中验收清单做一次浏览器人工验收**（A 次卧床 Last Seen 同房间自主搜查；B 米痕被打断后线索恢复；C 真实 `TRAVEL → DWELL → REQUEST(once) → RESOLVE → HIT|MISS` 与「计划瞄点＝最终判定点」；D 搜空 + 6 秒冷却；E 玩家 Q 家具交互与白色呼吸高亮；F 旧功能与生命周期回归）；通过并经**单独授权**后再按归档定式建立 Git 检查点（届时须重跑门禁、复核暂存清单、确认 `HEAD == origin/main`）。S7C-2b 与 S7C-3 未获授权，不因本轮自动开始。
- Git commit 信息：**本轮未 commit、未 push、未创建 Tag**；未 force push；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。

---

## S7C-2 第三轮修复轮：Human 玩家 Q 改为「暴露目标优先，其次指向家具」（2026-09-26）

- 任务名称：在既有 S7C-2 成果上一次性完成用户本轮批准的最小增量修复——Human 玩家 Q 从「交互区域内家具绝对优先」改为「**暴露目标优先，其次指向家具**」；只改**玩家 Q** 的目标解析、白色高亮与对应提示，不重新实施 S7C-2、不重写 Human AI 搜查 / 米痕 / Last Seen、不动 E 藏身交互与已有的 AI `STANCE_LOST` 修复。用户要求：**本轮只做一轮完整实施 + 一轮自动化验证 + 一轮用户人工验收准备**，验收前不 commit / push / tag。
- 用户本轮批准的规则（现行唯一优先级，`resolvePlayerQPlan()` 单点定义）：① Q 在 12 秒冷却中 → 直接拒绝；② Q 可用且当帧存在**合法暴露目标**（**未藏身**的 DeepSeek 娘位于 1.5 世界单位、120° 扇形内，且无墙 / 非 OPEN 门叶遮挡）→ 执行**原有普通扇形抓捕**，即使玩家同时站在某件家具的合法交互区域内并正对着它，也**不得**改为家具搜查；③ 否则若当帧存在**合法 + 被指向**的家具 → 本次 Q 只搜查这一件家具（该分支不做 1.5 u / 120° 判定，也**不对隐藏者本人**做任何距离 / 扇形 / 视线二次判定）；④ 都没有 → 原有普通扇形空挥。四种有效释放都消耗同一份 12 秒冷却。
- **A 无副作用的暴露目标预检测**：`src/systems/HumanSearchSkill.ts` 新增 `probeExposedFanTarget()`——直接调用**正式的** `evaluateHumanSearch()`，因此「预检测说能抓到」与「真正执行抓到」是同一帧同一套几何，不存在第二套规则；它不显示特效、不消耗冷却、不写日志、不释放藏身、不产生抓捕事件。**藏身目标即使几何命中也不算暴露目标**（`available = false`），所以藏身处只能通过「指向它所在家具 + 按 Q」被搜出，S7C-1B 的语义不被抢走。
- **B 家具指向条件并入同一条解析流程**：`src/systems/HideTargetResolution.ts` 的 `resolveHideInteractionTarget()` 新增可选 `pointing`（`headingRad` + `halfAngleDeg`）与 `pointsAtFurniture()`：只比较**角度**（玩家朝向 vs 家具**可接近表面点**方向，复用 `furnitureApproachSurfacePoint()`），**不做距离判定、不做遮挡判定、不参与命中几何**；容差**直接复用已批准的普通扇形半角**（`GAME_CONFIG.humanSearch.halfAngleDeg`，±60°），**本轮不新增任何正式数值**（`GAME_CONFIG` 零改动，`src/config/gameConfig.ts` 仍是 5 insertions / 0 deletions）。结果新增 `pointedLegalTarget`（「合法 + 被指向」），`legalTarget` 语义保持不变；**不传 `pointing` 时不做任何朝向过滤**，因此 DeepSeek 玩家按 E 藏身的行为与 S7C-1B 逐字相同。
- **C 高亮、提示与技能同源**：`ThreeGame.syncPlayerFurnitureTarget()` 与 `useSkillQ()` 都只读**同一次** `playerQTargetResolution()` 的 `pointedLegalTarget`（测试以源码断言禁止退回 `legalTarget`）；当帧存在合法暴露目标时家具**仍画出但压暗、不呼吸**、HUD 回落为普通扇形文案——**绝不给出「可以搜家具」的误导性提示**；冷却中同样不给「Q 可用」暗示。HUD 文案相应改为「Q 搜查「家具名」（面向家具即可，不必精确瞄准）」。
- **D DEV 与 AI JSON**：`hide/hide-search-target` 增列「合法 / 指向 / 指向偏差 / 暴露目标优先 / 最近一次 Q 的原因」；`playerSearchEvents` 新增 `reason`（`COOLDOWN / EXPOSED_TARGET / FURNITURE / NO_TARGET`）、`pointed`、`pointingDeltaDeg`、`exposedTargetAvailable / exposedCode / exposedDistance / exposedAngleDeltaDeg / exposedBlocked`，并让**普通扇形分支也开始记录事件**（`PLAYER_Q_FAN_HIT` / `PLAYER_Q_FAN_MISS`），`formatVersion` 仍为 **1.5**（只扩字段、不换结构）。
- 修改文件：`src/systems/HideTargetResolution.ts`、`src/systems/HumanSearchSkill.ts`、`src/three/ThreeGame.ts`、`src/systems/AILogCollector.ts`；新增测试 `tests/player-q-priority.test.mjs`（9 项，逐条覆盖用户简报 §四 的 1–9 项）；同步既有测试 `tests/hide-target-resolution.test.mjs`、`tests/human-furniture-search.test.mjs`（属**同步**新语义，未削弱断言、未删除测试）；文档同步 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（新增 §4.7，并修正 §4.6.1 中已被取代的两行）、`docs/AI_HUMAN_STATE_TREE.md`、`docs/AI_STATE_OVERVIEW.md`、`docs/DEEPSEEK_HANDOFF.md`；本轮浏览器产物在 `docs/verification/S7C-2-r3/`。

### 自动化测试与浏览器复核（本轮实测）

| 项目 | 结果 |
|---|---|
| `npm test` | **622 / 622 通过**（基线 613 + 新增 9；失败 0 / 取消 0 / 跳过 0，退出码 0） |
| `npx tsc --noEmit` | 退出码 0 |
| `npm run build` | 退出码 0（仅既有 >500 kB chunk 提示；JS 945.67 kB / gzip 253.60 kB、CSS 13.68 kB） |
| `git diff --check` | 退出码 0（仅既有的 LF→CRLF 提示） |
| 变异验证 | 6 次，每次都确认对应用例确实失败后复原：① 家具分支改回优先 → 4 项失败；② 去掉指向过滤 → 5 项失败；③ 藏身目标也算暴露目标 → 1 项失败；④ 高亮退回 `legalTarget` → 1 项失败；⑤ 高亮可用不再排除暴露目标优先 → 1 项失败；⑥ HUD 不再排除暴露目标优先 → 1 项失败 |
| 浏览器复核 · 主卧床（`playerQBed`） | **PASS**：真实走图（三扇门用 E 开启）到床边 `LEGAL` → **背对**床 `高亮 NONE（合法 否｜指向 否）`、按 Q **家具搜查 0 次**（普通扇形未命中、冷却已起）→ 冷却结束后**面向**床 `高亮 FURNITURE（hide_main_bed｜合法 是｜指向 是 45.0°）`、HUD「Q 搜查「主卧床」（面向家具即可，不必精确瞄准）」+ 白色呼吸描边 → 按 Q `MISS_EMPTY`（家具 `main_bed`、瞄点 (−11.9,−5.2)、权威占用读取：是、1 次）→ 12 秒冷却 + 描边压暗 → 冷却中再按被拒绝（`搜查冷却中：剩 10.5 秒`，次数仍为 1、无新日志事件） |
| 浏览器复核 · 储物间纸箱（`playerQ`） | **PASS**：同规则第二样本（`指向 29.4°`）；`playerSearchEvents = PLAYER_Q_FAN_MISS + PLAYER_Q_FURNITURE_MISS`，控制台只有既有告警，0 页面异常 |
| 浏览器复核 · 暴露目标优先（`playerQBedWait`） | **BLOCKED（不得记为 PASS）**：4 次真实尝试都未能摆出「玩家在区域内指向家具 + 未藏身的 AI 同时落在普通扇形里」的同一帧——① 在客厅纸箱区域等 AI 自己走进来（AI 全程在西侧，最近 12.9 u，01:52 AI 吃米获胜）；② 追赶到次卧床（直线走图器卡在门框角落，02:24 结束）；③ 用真实 `FOOTSTEP`（17 u）诱导 + AI 减速到 40 px/s（AI 始终 12.9–25 u）；④ 在主卧床区域等 AI 巡视（AI 最近 6.6 u 后转去 `rice_10` / `rice_11`，01:57、02:20 结束）。该分支由真实地图自动化测试 `tests/player-q-priority.test.mjs` §四.1 覆盖 |

- 复核期间只用 DEV-B **内存**覆盖 `capture.radius = 0.05`（必要时 `movement.playerSpeed`、`vision.range` 用于诱导尝试），**不改正式配置**；未编造任何 FPS 或耗时。
- 已知限制：① 「玩家 Q 搜出藏在家具里的 DeepSeek 娘」在浏览器里仍无法复现（两阵营不能同时被控制，AI 自主藏身属未授权的 S7C-2b），只有真实地图自动化证据；② 指向容差复用已批准的扇形半角，因此「算指向」的通路是 ±60°，长条家具从端头指向时容差体感可能偏紧——需要用户在人工验收时判断是否需要调整（本轮不擅自新增数值）；③ 暴露目标预检测每帧多跑一次纯几何（`evaluateHumanSearch`），没有引入第二套规则或额外状态。
- 下一步建议：**请用户按本轮汇报里的验收清单做一次浏览器人工验收**（A 背对家具不搜、B 面向家具出现白色呼吸高亮并可搜空、C 「有暴露目标时 Q 抓人而不是搜家具」请手动确认、D 12 秒冷却与冷却中拒绝、E 旧功能回归：Human AI 搜查 / E 藏身 / DeepSeek Q 锁门 / DEV 编辑器与 DEV-B）；通过并经**单独授权**后再按归档定式建立 Git 检查点。S7C-2b 与 S7C-3 未获授权，不因本轮自动开始。
- Git commit 信息：**本轮未 commit、未 push、未创建 Tag**；未 force push；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。`docs/verification/S7C-2-r3/` 下是本轮复核产物（脚本 / 两场景 AI JSON 与控制台日志 / 8 张截图 / README），**未 commit**，用户可按需保留或删除。

## S7C-2 第四轮修复轮：白色家具轮廓「看不见」的可见性修复（2026-09-26）

- 任务名称：用户对第三轮成果做人工验收，六项结果为「1 追逐时 Q 优先抓人 PASS / 2 背对家具不误搜 PASS / 3 面向家具正常搜查 **FAIL** / 4 藏身家具能够被搜出 PASS / 5 Human AI 次卧床回归 PASS / 6 其他机制回归 PASS」，补充「玩法实际上都可以，唯一观察到的问题是**没有白色轮廓呼吸**」。用户明确：**不得因为第 3 项 FAIL 就擅自重写已通过的玩家 Q 家具搜查逻辑**；本轮唯一目标是把 White 呼吸轮廓做成**清晰可见**，并在离开条件时立即消失；不新增玩法参数、不改 `GAME_CONFIG`、不改 Human AI 站位 / 900 ms 停留 / 类型化结算。
- **根因（只读定位 + 可复现证据）**：
  - ① 主因：`src/three/HideSearchView.ts` 的表现层根节点 `root` 被 `show()`（**普通扇形释放**）搬到玩家释放点并带上朝向，而挂在根节点下的玩家高亮 / AI 扇形 / AI 轮廓 / 命中反馈传进去的都是**世界坐标** → 被二次平移。真实 `three` + 真实 `HideSearchView` 的 Node 探针实测：在 (-11.4,-5) 按过一次 Q 之后，`hide_main_bed` 中心 (-13,10) 的高亮世界坐标变成 **(-25.43, 0.23, -13.49)**（期望 (-13, 0.225, 10)），偏差约 28 世界单位，已经落在公寓之外——所以 DEV 行还显示「高亮 FURNITURE｜合法 是｜指向 是」、HUD 还显示「Q：可用」，但屏幕上什么都没有。
  - ② 次因：旧高亮是 `BoxGeometry` + `wireframe` 的**三角形线框盒**（面内还有对角线），且 `scale.y = height` 让顶面与家具顶面**完全共面**产生深度冲突；线条只有 1 px、对比也不足。
- **修复（`src/three/HideSearchView.ts`，纯表现层）**：① 根节点恒为单位变换，扇形自己携带 `position` 与 `Ry(朝向)·Rx(−90°)` 四元数（世界矩阵与旧实现逐值相同，矩阵对比最大误差 `2.2e-16`）；② 白色高亮改为**真实家具棱线轮廓**——`EdgesGeometry(单位立方体)` 的 12 条棱（24 顶点）+ `LineBasicMaterial`，与家具网格同中心、同朝向、三轴各外扩 `HIDE_PLAYER_TARGET_MARGIN = 0.08` 贴合外缘（不是家具中心悬浮的圆圈，也不涂白家具本体）；③ 呼吸透明度区间 0.25–0.8 → **0.35–1.0**（周期仍 1,400 ms、冷却仍压到 0.14）；④ 几何与材质只创建一次并长期复用，每帧只改 `scale / position / rotation / opacity`，切家具 / 重开 / 换图只清可见性与透明度。
- 修改文件：`src/three/HideSearchView.ts`（唯一生产代码改动）；测试 `tests/hide-search-view-player-target.test.mjs`（+2 项：世界坐标回归、棱线轮廓与几何复用/单实例）、`tests/hide-search-view-ai.test.mjs`（+1 项：AI 轮廓世界坐标）、`tests/hide-search-view.test.mjs`（扇形放置断言由 `root` 同步到 `fan` + 世界朝向，属**同步**、未削弱）；文档 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（新增 §4.8，并修正 §4.6.1 的描边描述）、`docs/DEEPSEEK_HANDOFF.md`、本文件；浏览器产物在 `docs/verification/S7C-2-r4/`。**`docs/verification/S7C-2-r4/browser-check.mjs` 里的“before/after”对照是把根节点位移缺陷临时改回去后跑的，跑完立刻用 `%TEMP%` 备份还原，文件哈希与修复后完全一致（`D541D41B…`），未留下任何变异残留。**

### 自动化测试与浏览器复核（本轮实测）

| 项目 | 结果 |
|---|---|
| `npm test` | **625 / 625 通过**（基线 622 + 新增 3；失败 0 / 取消 0 / 跳过 0，退出码 0） |
| `npx tsc --noEmit` | 退出码 0 |
| `npm run build` | 退出码 0（仅既有 >500 kB chunk 提示；JS 947.26 kB / gzip 254.15 kB、CSS 13.68 kB） |
| `git diff --check` | 退出码 0（仅既有的 LF→CRLF 提示） |
| 浏览器复核 · 主卧床（修复后） | **PASS**：脚本按「真实走图到床边 `LEGAL` → 背对按一次 Q（旧缺陷正是在这一步搬走根节点）→ 等 12 秒冷却 → 面向床」复现整条链路；同一相机下 14 帧采样，轮廓区（184×116 px、176 个轮廓像素）平均亮度 **185.9 → 245.4**（振幅 59.5，每个相位都远高于底色 116），按 Q 进入冷却后降到 **163.9**（明显更暗） |
| 浏览器复核 · 储物间纸箱（修复后） | **PASS**：同一脚本第二个家具（81×50 px、88 个轮廓像素），平均亮度 **162.6 → 243.0**（振幅 80.4），冷却中 **129.5** |
| 浏览器复核 · 对照组（把根节点位移缺陷临时改回去） | **FAIL（这就是用户看到的现象）**：DEV 仍显示「高亮 FURNITURE（hide_main_bed｜合法 是｜指向 是 45.0°）」、HUD 仍显示「Q：可用」，但 14 帧里**呼吸轮廓像素 = 0**，屏幕上看不到任何白色轮廓；证据 `before-bed-no-outline-facing.png` |
| 留证 | `after-bed-zoom-breath-min/max/cooldown.png`、`after-carton-zoom-*.png`（6 倍放大裁剪，肉眼可对比呼吸相位与冷却压暗）、`after-*-summary.json`（全部采样数值）、`before-bed-no-outline-facing.png`、`after-*-log.txt`（控制台只有既有 `THREE.Clock` 告警与 favicon 404，0 页面异常） |

- 复核期间只用 DEV-B **内存**覆盖 `capture.radius = 0.05` 与 `movement.playerSpeed = 30`（避免脚本走图被抓、避免 AI 在测量期间吃满米结束对局），**不改正式配置**；未编造任何 FPS 或耗时。
- 已知限制与 BLOCKED：① 「背对家具 → 无轮廓」**没有**做像素级对照——背对靠真实走位转身，相机随之平移，同一相机像素差无法成立；该状态以 DEV 读数（`高亮 NONE（合法 否｜指向 否）`）+ 真实地图自动化测试为证据。② 「玩家指向家具 + 未藏身暴露目标同帧」仍 **BLOCKED**（原因见第三轮条目），本轮未触及该分支。③ 本轮只改 Human **玩家** Q 的白色高亮；Human AI 的暖橙轮廓保持原颜色 / 透明度 / 触发时机，只随根节点修复回到正确位置。
- 下一步建议：请用户只做**一项视觉复验**——走到主卧床（或储物间纸箱）旁边，先背对再面向家具，观察白色呼吸轮廓是否出现、呼吸是否肉眼可见、按 Q 后是否立刻变暗；通过并经**单独授权**后再按归档定式建立 Git 检查点。S7C-2b 与 S7C-3 未获授权。
- Git commit 信息：**本轮未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。`docs/verification/S7C-2-r4/` 是本轮复核产物（脚本 / 前后对照截图 / 采样 JSON / 日志 / README），**未 commit**。

## 2026-09-27 · S7C-2：DeepSeek 娘家具与米堆的指向型白色轮廓（待人工验收）

- 完成内容：人工控制 DeepSeek 娘时，以实际世界 XZ 移动保留最后视觉朝向；只读复用正式 E 仲裁和最近未完成米堆，形成唯一的家具、米堆或无目标。家具沿用公开表面点的 ±60° 视觉指向；米堆使用 ±45° 纯视觉指向及既有 1.0 世界单位进食范围。门、藏身退出等 E 高优先级状态不显示误导性轮廓；背对家具仍可照旧按 E 藏身。轮廓复用已修复世界坐标的白色棱线、呼吸材质和单份几何；米堆尺寸随现有进食表现缩小。HUD 与 DEV 读取同一份本帧视觉目标。不修改 E 优先级、吃米判定、`GAME_CONFIG` 数值或 Human Q／Human AI 逻辑。
- 自动化回归：新增视觉目标与表现测试，覆盖朝向、唯一目标、重叠优先级、停步保向、呼吸变化、尺寸跟随、目标切换及清理；既有 Human Q 和 Human AI 搜查测试随完整测试一并回归。最终实测结果见下表。

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | 642 / 642 通过，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；仅既有的大于 500 kB 资源提示 |
| `git diff --check` | 通过，退出码 0；仅已有换行符提示 |
| 独立浏览器实测 | 客厅纸箱面向时为家具目标；背对后目标消失但 E 藏身、E 退出均成功。`rice_03` 面向时为米堆目标，按住 E 后实际进食进度增至 1.1 / 5.0 秒；无页面异常。截图留在仓库外的本次会话可视化目录。 |

- 已知限制与下一步：真实浏览器尚未逐一完成床、不同朝向衣柜、重叠区域、米堆耗尽、地图热应用的视觉验收；这些场景等待用户集中复核，不用单元测试冒充浏览器证据。第四轮 Human 白色轮廓也仍待用户明确视觉复验。本轮及整个 S7C-2 均不据此宣告 Gate 通过；S7C-2b、S7C-3 未开始。
- Git 检查点：本轮未提交、未推送、未创建 Tag；保留现有 S7C-2 未提交成果与用户数值修改，未触碰受保护资料目录。待人工验收后另行取得归档授权。

## 2026-09-27 · S7C-2：集中验收结果与文档归档预审

- 阶段与日期：S7C-2，2026-09-27。
- 完成内容：同步正式搜查规则、玩家 Q 抓捕与家具搜查优先级、DP 娘家具及米堆指向轮廓规则、视觉常量说明和当前阶段状态。第三轮当时的轮廓验收失败继续保留；第四轮修复后，用户确认最终视觉验收通过。
- 自动化测试与人工验收：

| 检查项目 | 结果 |
|---|---|
| `npm test` | 642 / 642 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 首次受限运行在 Vite 临时配置文件写入时报 EPERM；依项目构建规范获得项目目录写入后，原命令通过，退出码 0。存在 Vite 大于 500 kB 的非阻断提示；JS 952.15 kB（gzip 255.27 kB），CSS 13.68 kB。 |
| `git diff --check` | 通过，退出码 0。 |
| 第三轮浏览器验收 | 追逐时优先抓人、背对不误搜、藏身家具搜出、Human AI 次卧床回归、其他机制回归通过；面向家具时白色轮廓当轮未通过，已由后续修复及最终验收覆盖。 |
| 集中视觉人工验收 | Human 白色轮廓、DP 娘家具轮廓、DP 娘米堆轮廓、交互重叠仲裁、生命周期：5 项全部由用户确认通过。 |

- Git 检查点：本轮只整理和核对文档；没有 commit、push 或 tag。代码、测试及验证证据均保持未提交状态，等待用户另行授权归档。
- 已知限制与下一项任务：S7C-2 的功能及集中人工验收通过，但 Git 归档尚未授权，故不记为已完成归档。S7C-2b（DeepSeek AI 自主藏身）与 S7C-3（出生点和门状态随机化）尚未授权、未开始；没有获准的新开发任务。

## 2026-09-27 · S7C-2 正式归档 + Codex Windows 客户端权限故障诊断记录

- 任务名称：《谁吃了我的米》S7C-2 归档事实确认与 Codex Windows 桌面客户端权限故障归档。当前阶段：S7C-2 已按前置条件 10 完成 Gate（验收 + 日志 + commit + push）；S7C-2b 与 S7C-3 仍未授权。
- 本轮性质与边界：**纯文档轮**。只追加本日志并在 `docs/DEEPSEEK_HANDOFF.md` 记录未解决环境问题；不改任何生产代码 / 测试 / `vite.config.ts` / `GAME_CONFIG` / `docs/GAME_BALANCE_CONFIG.md`，不改 `.codex/config.toml`，不读取或改动 `.trae/`、`.dsh-meow/`，不修改 Windows ACL 或 Git 全局配置，不运行新的权限测试，不执行 `git add` / `commit` / `push` / `reset` / `clean` / `stash`。
- S7C-2 归档事实（本轮本人实测，只读）：`git rev-parse HEAD` 与 `git rev-parse origin/main` 均为 `f24304797ecff97be7d9f43efb9f4ffaa0621f8d`，`git rev-list --left-right --count origin/main...HEAD` = `0 0`；提交标题 `feat: complete s7c-2 hide search and visual targets`，`git show --stat` 为 **67 个文件、+11 635 / −170**，与用户给出的已确认事实 1、2 一致。`.git/MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` 全部不存在。
- 本轮实测的 Git 网络状态（只读命令，不是新的权限测试）：`git ls-remote origin refs/heads/main` 失败，报 `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e) - 安全程序包没有可用的凭证`，退出码 1。**失败的是当前 DSH 执行环境的 Git HTTPS 读取，与下述 Codex 沙箱账户的结论是两件独立的事，不得混为一谈。** 本轮未尝试任何 `http.sslBackend` 切换或凭证修复。
- Codex「帮我批准」模式（受限沙箱）**用户已确认的事实**（来源为用户的当次诊断报告，本轮未复测）：
  1. 使用 Windows 独立沙箱账户。
  2. `workspace-write` 能正常读写项目普通文件。
  3. 原先的离线沙箱无法访问 `github.com:443`；创建项目专用档案 `who-ate-my-rice-git` 后，联网沙箱启动成功。
  4. 网络 TLS：Git for Windows 系统配置默认使用 Schannel；受限联网沙箱下出现 `SEC_E_NO_CREDENTIALS (0x8009030e)`；临时以 `git -c http.sslBackend=openssl ls-remote origin refs/heads/main` 读取成功。因此 **OpenSSL 是当前已经实际验证过的 HTTPS 读取解决方式，但它只是命令行级临时覆盖，不是持久修复**。
  5. Git 元数据权限：项目配置已声明当前仓库 `.git` 可写，但执行 `git config --local http.sslBackend openssl` 时创建 `.git/config.lock` 失败并报 `Permission denied`。`.git` 内存在两组未解析 SID 的 DENY ACE，而已检查的当前 `CodexSandboxOnline` 身份与其令牌组均不匹配。
- **当前无法确定底层拒绝的根因**（本轮结论，不得写成已确定）：拒绝究竟来自 Windows ACL、沙箱文件系统规则，还是其他限制，现有证据不足以判定。`.git` 下 DENY ACE 的 SID 未解析且与已核对身份不匹配，只说明「已检查的身份不是这些 ACE 的命中者」，**不等于** ACL 已被排除，也不等于沙箱规则就是原因。本轮不再做任何新的权限探测。
- Codex「完全访问权限」模式（**用户已确认的事实**）：以 `bilibili` Windows 用户身份运行；GitHub `ls-remote` 与 `git fetch` 已成功。**但 Codex 自身的自动 commit / push 尚未在该模式下单独测试**，因此该模式不能记为已验证可完成归档。
- 相关项目配置：`.codex/config.toml`（本轮**未修改**）。它声明 `default_permissions = "who-ate-my-rice-git"`、`approval_policy = "on-request"`、项目专用档案在项目路径上 `.` 与 `.git` 为 `write`、`.codex` 为 `read`、`.trae` 与 `.dsh-meow` 为 `deny`、网络 `github.com` 为 `allow`。**该配置尚未使受限沙箱具备完整自动归档能力**（`git config --local` 写 `.git/config.lock` 仍被拒），因此不能把「配置里写了 `write`」当作权限已修复的证据。
- 暂定解决方案（**工作流选择，不是缺陷修复**）：保留项目专用沙箱用于日常开发；正式归档时优先评估客户端的「单条 Git 命令审批」能力。若当前客户端不支持，则在用户明确授权具体归档任务后，**暂时**使用完全访问模式做精确暂存、提交与正常推送，完成后恢复受限模式。**这只是暂定工作流，不得宣称 Git 权限问题已修复**，也不得在未获用户当次授权时使用完全访问模式提交。
- 本轮实际执行的检查：`git rev-parse` / `git rev-list --left-right --count` / `git log --oneline -3` / `git show --stat --oneline` / `git status --porcelain` / `.git` 残留文件探测 / `git check-ignore`，全部为只读。**未运行 `npm test`、`npx tsc --noEmit`、`npm run build`**：本轮源码与测试零改动，属纯文档轮，按前置条件 7 说明未运行游戏测试的原因；`npm test` 基线仍为本工作区最近记录的 642 / 642。
- 工作区实际状态（本轮核对）：`git status --porcelain` 42 条，全部为未跟踪条目——`?? .codex/`、`?? .dsh-meow/`、`?? .trae/`，以及 `docs/verification/S7C-2-r2/`、`r3/`、`r4/` 下 38 个复核产物（截图 / AI JSON / 控制台日志）。`docs/verification/S7C-2-r2/r4` 的部分 README 与脚本已随 `f243047` 归档，其余重复截图与导出的 AI JSON 仍留在工作区未提交。`.codex/` **既未被 Git 跟踪，也不在 `.gitignore` 中**（`git check-ignore -v .codex` 无输出），因此它会长期出现在未跟踪清单里；本轮未修改 `.gitignore`，也未暂存它。
- 已知限制与未验证：① 受限沙箱的根因未定；② 完全访问模式下的自动 commit / push 未测试；③ `.git/config.lock` 的拒绝来源未定（ACL / 沙箱规则 / 其他）；④ 本轮未复测任何权限命令，也没有验证 `http.sslBackend` 的持久化方案；⑤ 本轮未做浏览器验证（无游戏代码改动）。
- 下一步：S7C-2b 的技术设计与任务拆分（本轮已启动，见 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 与交接文档）；**不实现功能代码、不改 `GAME_CONFIG`、不改已验收的 S7C-2 机制、不提前实现 S7C-3**。归档相关结论保持「暂定工作流」措辞，等用户另行授权。
- Git 检查点：本轮**未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash；未读取、暂存或修改 `.trae/`、`.dsh-meow/`。

## 2026-09-27 · S7C-2b：DeepSeek 娘 AI 自主藏身、逃跑与人类威胁适应（已实现，待人工验收）

- 阶段与日期：S7C-2b（2026-09-27）。**用户本轮明确授权按一个完整阶段开发**（「不要再拆成需要我逐个批准的小阶段」），并直接给出建议参数与内部实现顺序；同时规定**本轮先不做 Git 提交 / 推送 / Tag**，等人工验收通过后再单独申请归档授权。因此本阶段当前状态＝**已实现、待用户浏览器人工验收、未提交**，**不是 Gate = PASS**。
- 完成内容（按用户给的 H1→H5 内部顺序，未逐切片请示）：
  1. **公开候选层** `src/systems/DeepSeekHideCandidates.ts`（新）：`createDeepSeekHideMapSnapshot()` 是 AI 可见的公开藏身点快照的**唯一构造点**（照 `createHumanAiMapSnapshot()` 先例，只含公开地图数据 + 地图代次）；`selectHideSpot()` 用 `navigation.freeCellsWithin()` 枚举区域内真实空闲导航格心 → 逐条 `checkHideRegionPosition()` 复核（区域成员 + 真实可站立 + 家具可接近表面无遮挡 + 导航格吸附）→ 取离唯一锚点最近的合法格心作 AI 站位 → A* 可达性 → 公开评分。**AI 只在真实格心上落脚**，因此 A* 终点就是可行走点，不需要 S7C-2 那种容差走位。
  2. **走位**：控制器顶层新增 `HIDE` 状态 + `DeepSeekHidePhase = NONE / TRAVEL / CONCEALED / EXIT`（照 `HumanCheckHidePhase` 同构，不拆新顶层状态）；复用 `followPath`，卡路处理有界（`maxStuckRepathsPerTarget` 内换路，超限放弃该点回 `EVADE`）。
  3. **权威进入** `src/systems/DeepSeekHideResolution.ts`（新）：`resolveDeepSeekAiHideEntry()` 用**本帧真实位置**复核「计划仍属当前地图 → 确实走到规划站位 → 通过完整几何合法性」，三条全过才允许进入；`HideSystem.enterAsAI()` 再复核状态机条件与**一次性令牌**（`issueAiEntryToken()`；令牌一被消费立刻作废，重放得到 `TOKEN_REPLAY`）。玩家 `enter()` 语义一字未改（AI 走它仍得到 `NOT_PLAYER_CONTROLLED`）。进入后与玩家 E 同一套后果：中断进食、抓捕进度归零、位移/冲刺/进食/锁门封锁、`VisionSystem.setConcealed`、抓捕资格 false。
  4. **退出**：`hideMinConcealMs` + 威胁解除（不可见且新鲜威胁已在安全间距外）+ 「仍有可达且不穿过威胁抓捕半径的米堆路线」+ `hideRecheckMs` 重查；出口**物理**安全由游戏层用 `humanBlocksHideExit()` 裁决（玩家 E 与 AI 退出**共用同一条公式**），被挡住时回执 `HUMAN_BLOCKING` 并退回藏身，绝不卡在 `EXIT`；退出后回到既有 `RECOVER`。
  5. **循环抑制 / DEV / 日志**：同点再进冷却、失败记忆、近期藏身点惩罚、`hideMaxConsecutive`（真实米进度增长才重置）、「无可达米堆不进入藏身」、地图代次变化即作废旧计划、同一中止原因只记一条事件；DEV `Hide` 分类新增 8 行 AI 字段（相位 / 目标点 / 公开理由 / 逐点公开评分 / 循环抑制 / 退出闸门 / 权威计数 / 最近权威进入明细）；`AILogCollector` `formatVersion` 1.5 → **1.6**，`hideEvents` 时间线新增 `HIDE_AI_REQUEST / ENTERED / REJECTED / EXIT_REQUEST / EXITED / ABORT / SPOT_BLOCKED`。
- 复用与新增参数：直接复用 `HideSystem`、`checkHideRegionPosition` + `interactionRegion`、`NavigationSystem`（只新增只读 `freeCellsWithin()`）、`CollisionWorld`、`PerceptionSystem`、`GameStateSystem`、`AILogCollector`、DEV 面板；`src/config/gameConfig.ts` 只新增用户批准的 `deepseekAI.hideThreatDistance`(3.5) / `hideMinConcealMs`(2500) / `hideRecheckMs`(500) / `hideReenterCooldownMs`(8000) / `hideCandidateFailCooldownMs`(6000) / `hideRecentSpotCount`(3) / `hideRecentSpotPenalty`(5) / `hideMaxConsecutive`(2) / `hideMaxConcealMs`(0)，退出安全间距复用 `escapeMinSeparation`(3)、威胁无关的路线检查复用有效抓捕半径，**没有调整任何既有数值**，也没有动 `interactionRegion`(2.0/1.6·55°/1.2)、`humanSearch`(1.5/120°/12s)、`hideCheckFailureCooldownMs`(6000)、`hideCheckMaxPerRound`(1)、`lastSeenMs`(8000)、`traceLifetimeMs`(15000)。
- **两处实现澄清（已在设计文档 §4.10.14 写明，未新增参数）**：① 藏身候选评分改成「到达时间」货币（−路线长度 + 遮挡奖励 − 路线威胁风险 − 朝威胁跑惩罚 − 近期惩罚），因为「离威胁更远」是逃跑房间的货币，用它排序会把 AI 送到 15 世界单位外（实测首选 `hide_storage_carton` 路线 14.89，改后首选 0.40 处的 `hide_living_carton`）；② 「值得藏身」只用既有那一条判据——藏身路线必须短于当前逃跑路线（没有可行逃跑路线时直接允许）。实现期间曾临时加过「藏身路线不得超过 `hideThreatDistance`」的绝对门槛，实测在真实公寓里会把「被追进卧室后钻进床底」这类正常情形一并否掉（候选路线 13.5–35.3 世界单位），**该门槛已移除**。
- 新增文件：`src/systems/DeepSeekHideCandidates.ts`、`src/systems/DeepSeekHideResolution.ts`、`tests/deepseek-ai-walk.mjs`、`tests/deepseek-hide-candidates.test.mjs`、`tests/deepseek-hide-integration.test.mjs`、`tests/deepseek-hide-lifecycle.test.mjs`、`tests/deepseek-hide-loop-guard.test.mjs`、`docs/verification/S7C-2b/`（复核脚本 + 日志 + 快照 + 4 张截图 + 导出 AI JSON + README）。修改文件：`src/systems/DeepSeekAIController.ts`、`src/systems/HideSystem.ts`、`src/systems/NavigationSystem.ts`、`src/systems/AILogCollector.ts`、`src/three/ThreeGame.ts`、`src/config/gameConfig.ts`、`docs/GAME_BALANCE_CONFIG.md`、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`docs/DEEPSEEK_HANDOFF.md`、`tests/hide-integration.test.mjs`、`tests/ai-log-collector.test.mjs`、本条日志。删除文件：无。依赖变化：无。`.trae/`、`.dsh-meow/`、`.codex/` 未读取、未暂存、未修改。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **670 / 670 通过**，退出码 0（基线 642 + 新增 28 项：候选层 9、集成 4、生命周期 8、循环抑制 7） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；JS **979.79 kB**（gzip 262.80 kB）、CSS 13.68 kB；仍有 Vite >500 kB 非阻断提示（基线 952.15 kB / 255.27 kB） |
| `git diff --check` | 通过，退出码 0（仅既有换行符提示） |
| 变异验证（4 次） | ① 把「区域内的合法格心」改成直接用锚点 → `deepseek-hide-candidates` 的「8 个藏身点都有真实导航格心候选」用例失败；② 取消同点再进冷却 → `deepseek-hide-loop-guard` 的「下一次藏身必须换一个点」失败；③ 把占用真值字段塞进 `DeepSeekAIInput` → `hide-integration` 的源码级反作弊守卫失败；④ 令 `humanBlocksHideExit()` 恒返回 false → `deepseek-hide-integration` 与 `deepseek-hide-lifecycle` 的出口用例共 2 项失败。四次均确认失败后**原样复原**，复原后 670/670 再次全绿。 |
| 浏览器真实复核 | `docs/verification/S7C-2b/`（本机 Chrome headless + CDP，真实按键 + 真实碰撞追逐）：追逐 24.8 秒时 AI 自主进入 `HIDE` 并藏入 `hide_living_carton`（权威层回执 `ENTERED`，真实位置 `(7.07, 3.38)` 通过完整合法性复核）；藏身期间 `hide-state` = 藏身中、`hide-capture` = 不累计、HUD 显示「AI 已自主藏身：hide_living_carton（Human 搜查仍可把它搜出来）」；拉开距离后 **2.586 秒**（≥ `hideMinConcealMs` 2500）自主退出并回到 `EAT`，退出闸门读数 `THREAT_CLEARED`；`hide-ai-loopguard` 显示 `hide_living_carton:8000(REENTER_COOLDOWN)`；AI JSON `formatVersion` **1.6**，`hideEvents` 含 `HIDE_AI_REQUEST / HIDE_AI_ENTERED / HIDE_AI_EXIT_REQUEST / HIDE_AI_EXITED`；控制台**无异常**（唯一 404 是浏览器自动请求 `/favicon.ico`，与本轮无关） |
| 未在浏览器覆盖的场景（BLOCKED，不得记 PASS） | Human AI（而非玩家）把藏身中的 DP 搜出来的完整链路、反复逼近拉开多次的抖动表现、暂停 / 重开 / 返回阵营页的状态清理、地图热应用后丢弃失效藏身点：这四项由 `tests/human-ai-check-hide.test.mjs`、`tests/deepseek-hide-loop-guard.test.mjs`、`tests/deepseek-hide-lifecycle.test.mjs`、`tests/hide-integration.test.mjs` 与既有 `dev-freeze` 用例覆盖，**浏览器侧留给本轮人工验收** |

- 已知限制与下一步：① 本阶段**尚未人工验收、未提交**，不得在任何文档里写成 Gate = PASS；② 上述四项浏览器未覆盖场景需人工验收；③ DEV-B 的 38 项运行时白名单**没有**加入 `hide*`（避免扩大已验收 DEV-B 的范围，本轮未授权）；④ 藏身音效与「被发现后反制」按设计刻意不做；⑤ 长时间贴着藏身家具时「看不见 Human 就不退出」是设计选择（退出条件 2），Human 直接搜查家具即可结束对局。
- 下一步建议：请用户按集中验收清单实机复验（追近时 DP 主动跑向家具、进入后可视体隐藏且抓捕不累计、Human 搜查仍能搜出、拉开距离后自主出来、反复逼近不抖动、暂停 / 重开 / 地图热应用状态干净、不影响 S7C-2 已验收功能）；通过并另行授权后再走 commit / push。
- 环境记录（本轮实测，供后续轮次参考）：当前 DSH 沙箱**禁止子进程捕获式 spawn**，`npm test`（Node 测试运行器逐文件 spawn）与 `npm run build`（esbuild service spawn）都会 `EPERM`；本轮分别改用 `node --test --test-isolation=none` 与一次客户端提权重试完成**同一命令**的实跑；`npm run dev`（Vite）同样需要提权才能起，已留在 `http://127.0.0.1:5173/` 供人工验收复用。另：在项目根目录新建/改写文件会使 Vite 文件监听抛 `EBUSY` 并让 dev server 退出（本轮踩到一次），复核脚本的临时文件因此放在 `%TEMP%`。
- Git 检查点：本轮**未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash；未读取、暂存或修改 `.trae/`、`.dsh-meow/`、`.codex/`。

---

## 2026-09-27 · S7C-2b 正式归档（用户集中浏览器人工验收 8/8 PASS）

- 阶段与日期：S7C-2b（2026-09-27）。任务性质＝**已完成阶段的最终归档，不是新一轮开发**。用户本轮明确授权：完成最终文档更新、完整自动化回归、精确暂存、创建一个本地提交、正常推送 `origin/main`，并核实 GitHub 实时远端；门禁全部通过即一次性执行完毕，不逐步重新申请业务授权。**不进入 S7C-3；不新增玩法；不调整已验收参数。**
- 用户正式确认的人工验收（**用户实机结果，不得改写为 DPH 自己完成的浏览器测试**）：**8/8 PASS** —— ① DeepSeek NPC 自主寻找家具；② 隐藏与普通抓捕阻断；③ Human 玩家搜出 NPC；④ NPC 自主退出并恢复行动；⑤ 反复逼近与拉开无原地进出抖动；⑥ 暂停 / 重开 / 返回菜单的状态清理；⑦ 地图热应用后旧计划正确作废；⑧ 玩家白色轮廓、Human Q、Human AI 搜查、玩家 E、门锁与 DEV 等旧功能回归。DPH 此前未在浏览器覆盖的三项（Human AI 搜出藏身者全链路、反复逼近抖动、暂停 / 重开 / 地图热应用清理）继续按自动化覆盖如实记录，**未虚报为已实测**。
- 归档前核对（本轮实测，只读）：分支 `main`，暂存区为空；12 个已跟踪文件被修改 + 7 个新文件 + 未跟踪的 `docs/verification/S7C-2b/`，全部属于 S7C-2b；`git diff src/config/gameConfig.ts` **只新增 9 行**，与用户批准值逐项一致（`hideThreatDistance` 3.5 / `hideMinConcealMs` 2_500 / `hideRecheckMs` 500 / `hideReenterCooldownMs` 8_000 / `hideCandidateFailCooldownMs` 6_000 / `hideRecentSpotCount` 3 / `hideRecentSpotPenalty` 5 / `hideMaxConsecutive` 2 / `hideMaxConcealMs` 0）；`src/systems/HumanHideSearchResolution.ts`、`src/systems/HumanAIController.ts`、`src/systems/HumanSearchSkill.ts`、`src/systems/HumanSearchTuning.ts`、`src/three/HideSearchView.ts` **零改动**（S7C-2 已验收机制未被修改）；`AILogCollector` 的 `formatVersion` 为 **1.6**；`.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` 全部不存在；对全部改动与新增源码扫描 `MUTATION|XXX|FIXME|TEMP_|console.log(` **无命中**，无测试期残留。
- 文档更新（本轮）：`docs/DEEPSEEK_HANDOFF.md`（S7C-2b 状态改为「8/8 PASS + 已归档」、运行架构新增第 14 条与受保护清单新增 S7C-2b 条目、阶段进度表新增 S7C-2b 行并改写「下一项」、§16 重写、Codex 与 DSH 的权限结论显式分离）、`docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（§4.10 标题与状态、§4.10.9 参数已写入、§4.10.14 实现与验收结果、§4.10.12 指向实际执行的 8 项清单、§6 第 1 行结案、§7 路线状态、§8.4 末尾补记）、`docs/GAME_BALANCE_CONFIG.md`（S7C-2b 段新增阶段状态与「九个数值未调整」的核对方式）、本条日志。**`AGENT_LOG.md` 只追加，未回改任何历史条目。**
- 验证材料（`docs/verification/S7C-2b/`）：纳入 `README.md`、`browser-check.mjs`、`browser-check-summary.json`、`browser-check-log.txt`、`chase-timeline.json`、`concealed-snapshot.json`、`after-exit-snapshot.json` 与 4 张关键截图（进入前 / 追逐后 / 藏身中 / 退出后）；**未纳入** 234 kB 的 `s7c2b-ai-json.json` 与临时进度文件 `browser-check-progress.txt`，二者**原地保留、未删除**。`docs/verification/S7C-2-r2/`、`r3/`、`r4/` 全部未改动。
- 自动化门禁（归档轮实测）：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **670 / 670 通过**，退出码 0（fail 0） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；`dist/assets/index-DsDQo4NM.js` 979,785 B（979.79 kB）、`index-C42TrByy.css` 13,677 B（13.68 kB）；本地 zlib level 9 重新压缩实测 gzip **261.75 kB**（上一轮 Vite 自报 262.80 kB，差异来自压缩实现与等级）；仍有 Vite >500 kB 非阻断提示 |
| `git diff --check` | 通过，退出码 0（仅既有 LF→CRLF 提示） |

- Git 检查点：本轮以用户 2026-09-27 的明确授权**创建一个归档提交并正常推送**，提交标题 `feat: add autonomous deepseek npc hiding`；本地 HEAD 与远端 `origin/main` 的实际 SHA 一律以 `git log -1` / `git ls-remote origin refs/heads/main` 现场查询，**不在本文写死会自我过期的 SHA**。未创建 Tag（用户未要求）、未 force push、未 reset / clean / stash、未改写历史。
- 已知限制与下一项任务：① S7C-2b 的九个参数与「值得藏身」判据已冻结，任何改动需用户单独批准；② **S7C-3（出生点与门状态随机化）未授权、未开始**，开工前须逐项确认 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §5 / §6；③ DEV-A 的 JSON 导入器与进入 / 退出锚点拆分仍未决定；④ DEV-B 的 38 项运行时白名单未加入 `hide*`；⑤ 藏身音效与「被发现后反制」按设计刻意不做；⑥ 长期待办：S7B-2 偶发原地停留、正式 GLB 待机（S10）、Human AI 自动解锁 8,750 ms（S16）、矮窗口下的编辑器布局。
- 环境记录（本轮实测）：当前沙箱在普通模式下禁止子进程创建，`npm test` 与 `npm run build` 需要一次命令级提权重试（本会话已多次记录同一限制）；本轮归档的**全部门禁只用 1 次提权**完成。人工验收用的 dev server（我起的后台作业）已在归档开始时停止，避免文件监听在批量改文档时抛 `EBUSY`。`.trae/`、`.dsh-meow/`、`.codex/` 未读取、未暂存、未修改。

---

## 2026-09-27 · Windows 沙箱与最小权限长期规则维护

- 本轮仅维护项目文档：`AGENTS.md` 新增「Windows 沙箱兼容性与最小权限工作流」，区分已验证的 DSH 命名管道 `stdio=pipe` 限制与 Codex 独立的 Git 元数据 / TLS 问题；统一日常最小权限、正式门禁、集中审批、临时脚本、命令级 OpenSSL 和 Git 归档边界。
- `docs/DEEPSEEK_HANDOFF.md` 仅增加该章节索引；既有故障细节与 S7C-2 / S7C-2b 验收历史均未回改。本轮不开发游戏功能，不执行 `npm test`、`npx tsc --noEmit` 或 `npm run build`；不修改权限、TLS 或 Git 配置，不清理验证材料，不 commit / push / tag。文档待用户确认后再另行归档。

---

## 2026-09-27 · S7C-3 出生点与门初态随机化（待用户人工验收）

- 阶段与日期：S7C-3，2026-09-27。用户一次性授权完整实施，并确认 18 扇门在 `OPEN / CLOSED` 间随机、初始无 `LOCKED`；双方不同房间且至少相距 10 世界单位；普通新局和重开换种子，开发模式固定种子可复现。未授权本轮提交、推送或创建 Tag。
- 完成内容：新增 `MatchRandom` 的本局同种子生成、真实碰撞与导航校验、有界重试及经验证的安全回退。出生候选来自当前已应用地图的可站立导航格；校验双方、5 份米、各房间及当前已应用的 8 个藏身锚点。`DoorSystem` 保存本局初态，重开时连同双方位置、米堆和 AI 状态重新生成；不改地图常量、玩家技能或 AI 决策。DEV 面板可设置下局固定种子并查看出生、18 扇门、校验与失败原因；AI JSON 导出附本局种子及布局元数据。原地图出生标记改称参考点。
- 自动化测试与浏览器复核：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | 679 / 679 通过，退出码 0；其中 200 个种子逐一校验布局、米堆、房间和藏身锚点可达。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；JS 986.13 kB、CSS 13.68 kB，Vite 大于 500 kB 提示不阻断。 |
| `git diff --check` | 通过，退出码 0；只有 LF→CRLF 提示。 |
| 本地浏览器复核 | 固定种子 `123456` 重开后出生与 18 扇门初态不变；清空固定种子后重开得到新种子及不同布局。Human 主控时 DeepSeek AI 在随机布局中完成 5/5 米；DeepSeek 主控时 Human AI 巡逻、追逐并抓捕。 |
| 尚待用户集中人工验收 | 连续多局开局手感、玩家亲自开关门与走位、藏身及搜查、场景热应用后的新局路线；本轮浏览器复核未逐项覆盖，不记为人工 PASS。 |

- Git 检查点：本轮保留全部既有未跟踪验证资料及受保护目录；未暂存、未 commit、未 push、未创建 Tag。S7C-3 只记「已实现、待集中人工验收」，整个 S7C 不标记完成。
- 已知限制与下一项任务：初始只在 `OPEN / CLOSED` 中抽取，不生成 `LOCKED`；普通关门仍由现有玩家与 AI 开门规则处理。用户验收通过并单独授权归档前，不进入下一阶段。

---

## 2026-09-27 · S7C-3 集中人工验收与正式归档

- 阶段与日期：S7C-3，2026-09-27。用户已明确授权对已验收的出生点及门初态随机化建立正式 Git 检查点；此前实施轮记录原样保留。
- 本次完成内容：核对 `MatchRandom`、`DoorSystem`、本局种子、重开、DEV 与 AI JSON 接线，确认 18 扇门只随机 `OPEN / CLOSED`，双方不同房间且相距至少 10 世界单位，200 个种子均通过真实碰撞与导航可达校验；重抽耗尽时只使用经同样验证的安全回退。同步本次人工验收状态，并记录场景编辑器布局持久化为后续独立 DEV 增强，不在本阶段实现。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | 679 / 679 通过，退出码 0；包含 200 个种子的可达性测试。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；JS 986.13 kB、CSS 13.68 kB；Vite 大资源提示不阻断。 |
| `git diff --check` | 通过，退出码 0；仅 LF→CRLF 提示。 |
| 用户集中浏览器人工验收 | **8 / 8 通过**：随机出生点、随机门状态、通行与追逃、固定种子复现、DeepSeek 自主藏身、Human 玩家与 AI 搜查、暂停／重开／新局、地图热应用及旧功能。此项为用户实机确认，不冒充本轮代理重新执行的浏览器测试。 |

- Git 检查点：本轮授权的正式提交说明为 `feat: randomize match spawns and initial door states`；完整提交编号及远端同步结果必须以 `git log -1` 与实时远端查询核实，不在提交前预填。没有创建 Tag，也没有改写已推送历史。此前长期规范文档已在既有 `docs: establish Windows sandbox and minimal permission workflow` 提交中，`AGENTS.md` 本轮无未提交改动，故不与 S7C-3 混交。
- 已知限制与下一项任务：场景编辑器布局持久化尚未实现，属于独立 DEV 增强，不阻断 S7C-3。S7B 与 S7C 大阶段的后续工作仍须单独授权；本轮归档后不自动开始下一阶段。

---

## 2026-09-27 · DEV 场景编辑器 V2：布局保存 / 恢复 / JSON 导入（已实现，待用户集中人工验收）

- 任务性质与日期：独立 DEV 工具轮（不计入 S7C），2026-09-27。用户**一次性授权**「场景编辑器布局保存与恢复」作为一个完整独立任务实施，不拆分为需要逐个审批的子阶段；**本阶段只授权开发，不授权 Git 提交、推送或 Tag**，等待用户集中人工验收后再归档。
- 用户授权的范围（原话要点）：「玩家在 DEV 场景编辑器中调整家具位置、旋转和交互区域后，可以保留修改。重开对局不恢复默认家具布局；刷新或重新打开网页后，可加载已保存的自定义布局。」并逐条要求：应用布局后当前浏览器会话内重开对局 / 返回阵营菜单 / 开新局都必须保留；新增「保存布局」（localStorage，显示保存成功、失败与是否存在未保存修改）；刷新或重开后自动检查本地存档，**通过版本和完整地图校验后恢复**，无记录则用原始默认地图；新增「导入 JSON」兼容当前 V3 导出格式并严格校验结构、稳定 ID、房间边界、家具重叠、门、出生点、藏身交互区域与导航合法性，**校验失败时不得破坏当前地图**；保留导出并保证**导入导出往返一致**；新增带确认的「恢复默认地图」，**不得静默删除已有本地保存和导出的 JSON 备份**；增加清晰的当前布局状态（默认 / 自定义 / 未保存 / 已保存 / 导入失败）。
- **保存范围**（用户明确划定）：家具坐标、旋转、现有可编辑属性、关联藏身点及交互区域等**地图创作数据**；**禁止**把当前局随机出生结果、18 扇门的随机初态、角色当前位置、AI 路径、当前大米进度、技能冷却或对局时间写入地图布局存档。S7C-3 继续以当前合法地图为基础，每局独立随机出生点和初始门状态。
- 完成内容：
  1. 新增 `src/three/map/MapLayoutStore.ts`（纯逻辑，可直接在 Node 里测）：key `who-ate-my-rice/scene-editor-layout`；信封 `{format:'who-ate-my-rice/scene-layout', layoutVersion:1, savedAt, document}`，其中 `document` 就是既有 V3 导出文档；导入同时接受**裸 V3 文档**与**完整信封**。
  2. 校验只有一条权威链路：结构、稳定 ID、只读字段（家具 `roomId`、藏身点 `roomId`/`kind`/`label`/`furnitureId`）与「是否同一张地图」（`rooms`/`doors`/`spawns`/`riceCandidates` 必须与授权地图逐字段一致）由 `parseLayoutDocument()` 负责；房间边界、家具重叠（真实 SAT）、门洞、米点、出生点、锚点可站立与可接近、区域合法性与采样、连通性**直接复用 `validateEditedMap()`**，没有第二套校验代码。
  3. 五态判定（`layoutStatus()` / `layoutStateLabel()`）：`DEFAULT`＝授权地图且无存档；`CUSTOM`＝自定义且从未保存；`SAVED`＝与存档逐字段一致；`UNSAVED`＝已有存档但当前布局与它不同；`IMPORT_FAILED`＝最近一次导入或恢复失败（优先显示）。`layoutSignature()` 只覆盖可编辑字段并做 4 位小数归一，避免浮点尾差与 `appliedEditCount` 干扰判定。
  4. `MapEditModel` 新增 `replaceSource()`（换源后已应用数据与草稿一起跟随、旧草稿不残留）与 `spotDraftToAnchor()`（编辑器与存档共用同一个锚点转换）；`SceneEditor` 新增保存 / 导入 / 恢复默认三条链路，全部复用 `commitLayoutSource()`：先跑 S7C-1B 地图预检，再换源，再走既有 `rebuildApartment()` 重建碰撞 / 导航 / 两套 AI 绑定。
  5. 面板在既有工具栏内追加「保存布局 / 导入 JSON / 恢复默认地图」与隐藏的 `input[type=file]`（不新增覆盖入口的绝对定位元素）；工具栏下方新增 `.scene-editor-layout` 状态行（`data-layout-state` / `data-layout-unsaved`）；DEV 面板编辑器状态块新增「布局状态 / 本地布局存档 / 未保存修改 / 最近导入·恢复失败」四行。
  6. `ThreeGame` 开机先读本地存档，**全部校验通过才**用它 `buildApartment(..., {furniture, hideSpots})`；失败或没有存档即回落到授权地图并把原因留给 DEV 面板（不白屏）。`resetRound()` 不重建公寓、不重置 `mapFurniture` / `hideSpots`，因此会话内重开 / 返回阵营 / 开新局都保留已应用布局（测试用源码不变量守住）。
  7. 保存的是**已应用**布局：有未应用草稿时先拒绝并提示「先点应用编辑」；`writeSavedLayout()` 只在 `setItem` 真正成功后报成功。「恢复默认地图」只换地图，不删除本地存档与已导出的 JSON。
- 新增文件：`src/three/map/MapLayoutStore.ts`、`tests/scene-editor-layout.test.mjs`、`docs/verification/DEV_SCENE_EDITOR_V2/`（`browser-check.mjs` + 日志 + 摘要 + 9 张关键截图 + `README.md`）。修改文件：`src/three/map/MapEditModel.ts`、`src/three/SceneEditor.ts`、`src/three/SceneEditorPanel.ts`、`src/three/ThreeGame.ts`、`src/style.css`、`docs/DEV_SCENE_EDITOR_DESIGN.md`（新增 §11 与文件顶部 V2 状态行）、`docs/DEEPSEEK_HANDOFF.md`、本条日志。**未改**：`src/config/gameConfig.ts`（零新参数）、S7C-3 的 `MatchRandom` / `DoorSystem` 随机化、S7C-1B / S7C-2 / S7C-2b 的任何已验收机制、`apartmentMap.ts` 的授权地图数据。依赖变化：无。`.trae/`、`.dsh-meow/`、`.codex/` 未读取、未暂存、未修改。
- 自动化测试与浏览器复核（本轮实测）：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **700 / 700 通过**，退出码 0（基线 679 + 新增 21 项，全部在 `tests/scene-editor-layout.test.mjs`） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；JS **1,001.11 kB**（gzip 269.61 kB）、CSS 14.10 kB；仍有 Vite >500 kB 非阻断提示 |
| `git diff --check` | 通过，退出码 0（仅既有 LF→CRLF 提示；过程中修掉 `docs/DEV_SCENE_EDITOR_DESIGN.md` 一处新增文件末尾空行） |
| 浏览器真实复核 | `docs/verification/DEV_SCENE_EDITOR_V2/`：默认 → 应用（`CUSTOM`）→ 保存（`SAVED`，localStorage v1 / `sofaWidth` 1.4 / `savedAt`）→ **刷新后自动恢复（宽度 1.4）** → 非法 JSON（`IMPORT_FAILED`，地图不变）→ 来自另一张地图的文档（`IMPORT_FAILED`：房间 / 门 / 出生点 / 米点不一致）→ 合法 V3 导入（`UNSAVED`，1.6）→ 恢复默认（确认框 1 次，宽度回授权值 2.2，**本地存档保留**）→ **Esc「重新开始」后仍保留自定义 1.55** → 清掉存档刷新回 `DEFAULT`；控制台无异常（仅既有 `THREE.Clock` 弃用告警与 `/favicon.ico` 404） |
| 未覆盖 / 待人工验收 | 不同浏览器与无痕模式的隔离、`localStorage` 被浏览器策略禁用时的真实表现、极矮窗口下面板新增按钮的可达性、导入超大 / 畸形文件；这些交给用户集中人工验收，不记为已通过 |

- 已知限制与下一项任务：① 存档只在浏览器本地，清理站点数据即丢失（回落默认地图，不白屏）；本轮刻意不做「删除本地存档」按钮。② 导入只接受**同一张地图**的布局，不能用来换地图或改门 / 出生点 / 米点。③「恢复默认地图」仍要过地图预检（有角色正好站在授权家具位置时会被拒绝并给出原因）。④ 无版本迁移：`layoutVersion` 或 `formatVersion` 不匹配即视为无可用存档。⑤ 待用户按 `docs/DEV_SCENE_EDITOR_DESIGN.md` §11.10 的 9 条浏览器清单做集中人工验收；验收通过并另行授权后才建立 Git 检查点。
- Git 检查点：本轮**未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash；只删除了本轮自己迭代过程中产生的 3 张重复截图（用户既有未跟踪验证材料一律保留）。
- 环境记录（本轮实测）：① 会话后期用户把当前沙箱切到 `danger-full-access` 并关闭审批提示，因此门禁与浏览器复核不再逐次审批；此前 `workspace-write` 下 `npm test` / `npm run build` / 无头 Chrome 各需一次命令级审批。② **受限 shell 在 `workspace-write` 下能创建 / 写入工作区文件，但删除被拒**（`Remove-Item` 报 `Access to the path ... is denied`；同一条命令提权后删除成功）——「写文件」与「删文件」不是同一类权限，归档轮清理材料时要注意。③ 浏览器复核脚本踩到两处**工程性**陷阱并已修好：编辑器只能在 `PLAYING` 打开（重开后要先等 READY 结束），以及面板关闭时会保留上一次渲染的 DOM（读状态前必须确认面板可见，否则会把"打开失败"误读成旧状态）。

---

## 2026-09-27 · DEV 场景编辑器 V2 集中人工验收与正式归档

- 阶段与日期：独立 DEV 工具轮（不计入 S7C），2026-09-27。用户已明确授权对已验收的「场景编辑器布局保存与恢复」建立正式 Git 检查点，授权的提交说明为 `feat: add persistent scene editor layouts and JSON import`。本次只做最终归档，不开发新功能、不创建 Tag；此前实施轮记录原样保留，历史条目不改写。
- 用户集中浏览器人工验收：**9 / 9 PASS** —— ① 应用编辑；② 保存布局；③ 刷新后恢复；④ JSON 导出与导入；⑤ 错误文件保护；⑥ 恢复默认地图；⑦ 重开与返回菜单；⑧ S7C-3 随机化及旧功能回归；⑨ 存档丢失安全回退。用户确认全部通过，本轮无待修复的已知问题。**该结果为用户实机确认，不得改写为代理自己完成的浏览器测试**；代理侧浏览器证据（`docs/verification/DEV_SCENE_EDITOR_V2/`）与用户人工验收是两条独立证据，覆盖范围不同。
- 本次完成内容：核对 `src/three/map/MapLayoutStore.ts`（存档信封与 key、结构 / 稳定 ID / 只读字段 /「是否同一张地图」四项本地核对，几何与玩法校验**复用 `validateEditedMap()`**）、`SceneEditor` 保存 / 导入 / 恢复默认三条链路共用的 `commitLayoutSource()`（先 S7C-1B 地图预检 → 换源 → 既有 `rebuildApartment()`）、`ThreeGame` 开机「全部校验通过才 `buildApartment(..., {furniture, hideSpots})`」与 `resetRound()` 不重建公寓、面板工具栏内三个新按钮与 `.scene-editor-layout` 状态行；确认 `src/config/gameConfig.ts` 零新增参数、`apartmentMap.ts` 授权地图数据与 S7C-3 的 `MatchRandom` / `DoorSystem` 随机化一字未改，S7C-1B / S7C-2 / S7C-2b 已验收机制未被触碰。
- 自动化门禁（归档轮在本轮最终工作树上重新执行）：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **700 / 700 通过**，退出码 0（基线 679 + 新增 21 项，全部在 `tests/scene-editor-layout.test.mjs`） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；JS **1,001.11 kB**（gzip 269.61 kB）、CSS 14.10 kB、`index.html` 0.41 kB；仍有 Vite >500 kB 非阻断提示 |
| `git diff --check` | 通过，退出码 0（仅既有 LF→CRLF 提示） |

- 本轮纳入提交的验证材料（长期复核价值）：`docs/verification/DEV_SCENE_EDITOR_V2/` 的 `README.md`、`browser-check.mjs`（可复现脚本）、`browser-check-log.txt`、`browser-check-summary.json` 与 9 张关键状态截图（默认 / 应用并保存 / 刷新恢复 / 非法 JSON / 另一张地图 / 合法导入 / 恢复默认 / 重开后保留 / 清档回落），每张对应一条验收状态；**未纳入**重复截图、临时调试文件或大型导出数据。
- 本地保留、未纳入提交的材料：`docs/verification/S7C-2-r2|r3|r4|S7C-2b` 等目录中既有的未跟踪复核产物（截图、导出的 AI JSON、控制台日志）一律原地保留，未删除、未修改；`.trae/`、`.dsh-meow/`、`.codex/` 未读取、未修改、未暂存、未提交。
- Git 检查点：提交前 `git -c http.sslBackend=openssl ls-remote origin refs/heads/main` 与本地 `HEAD` 均为 `420d8a6`（`git rev-list --left-right --count origin/main...HEAD` = 0 / 0），确认远端无新增提交；只暂存本轮核实过的源码、测试、设计文档、最终日志与精选验证材料，**未使用 `git add -A` / `git add .`**，未 force push、未 reset / clean / stash、未改写已推送历史、未创建 Tag。**完整提交编号与推送结果以 `git log -1` 与实时远端查询核实，不在提交前预填。**
- 已知限制与下一项任务：① 存档只在**浏览器本地**，清理站点数据即丢失（回落到默认地图，不白屏），本轮刻意不做「删除本地存档」按钮；② 导入只接受**同一张地图**的布局，不能用来换地图或改门 / 出生点 / 米点；③「恢复默认地图」仍要过地图预检（有角色正好站在授权家具位置时会给出原因并拒绝）；④ 无版本迁移，`layoutVersion` 或 `formatVersion` 不匹配即视为无可用存档。S7C-2b 与 S7C-3 均已归档；DEV 场景编辑器后续扩展与 S7B / S7C 的后续工作仍须单独授权，本轮归档后**不自动开始下一阶段**。

---

## 2026-09-27 · S7B 整体 Gate 核验与用户最终验收

- 阶段与日期：S7B 整体收尾，2026-09-27。用户现已正式确认 S7B 全部获批功能整体验收通过，允许结束此前未封版的 S7B 阶段；本轮仅核对历史证据并同步当前状态，不开发功能，不创建提交、推送或 Tag。
- 完成内容：核对 S7B-1 自主找米与进食、S7B-2 威胁感知／逃跑／恢复及静止 Human 好奇与安全通行、S7B-3A 条件式逃脱关门、S7B-3B 主动锁门与冲刺协调的验收和历史记录。S7B-1 至 3B 均已有自动化测试记录、用户专项人工验收记录及 Git 检查点；相关检查点均可在当前 `origin/main` 历史中找到。用户本次的整体验收补齐了 S7B 总 Gate 的最终人工确认。
- 历史门禁与归档证据（以下为日志/Git 历史记录，不是本轮重新运行）：

| 阶段 | 已记录的测试与人工验收 | Git 归档证据 |
|---|---|---|
| S7B-1 | `npm test` 172/172；用户确认 6 项找米、进食、门、控制及生命周期验收通过。 | `7061b33` WIP 检查点，位于已推送的 `origin/main` 历史。 |
| S7B-2 | 多轮记录包括 `npm test` 204/204、265/265；用户确认逃跑、恢复、静止对峙及安全通行专项通过。 | `4f40bb0`、`9da38c0` 等 WIP 检查点，位于已推送的 `origin/main` 历史。 |
| S7B-3A | `npm test` 270/270；用户确认条件关门场景 5/5 通过。 | `ca18f61` WIP 检查点，位于已推送的 `origin/main` 历史。 |
| S7B-3B | 收尾记录 `npm test` 333/333、构建及差异检查通过；用户确认防振荡等浏览器验收通过。 | `6a92c5d` 正式功能检查点，位于已推送的 `origin/main` 历史。 |

- 本次核验：当前分支为 `main`；本地 `HEAD` 与本地 `origin/main` 指向同一提交，且实时 `git ls-remote origin refs/heads/main` 返回同一完整 SHA。通过 `git merge-base --is-ancestor` 确认 `7061b33`、`4f40bb0`、`ca18f61` 与 `6a92c5d` 均属于远端 `main` 历史。S7B-2 的后续 WIP 检查点 `9da38c0` 也出现在 `origin/main` 提交历史中。未改写任何旧日志或历史验收结果。
- 阶段结论：**S7B overall = Gate PASS**（各获批子阶段的测试、日志、用户验收与已推送检查点均有历史证据；本次用户明确确认整体验收）。本轮未重新运行自动化测试或构建，因此不将历史测试数字冒充本轮实测。
- 已知限制与下一项任务：S7B-2 偶发原地停留仍保留为后续 AI 优化项；S7B-3B 缺少侧向证据修复后的完整实机 AI JSON，仍应在后续日志复核；这些遗留事项不推翻本次已确认的阶段 Gate，也不表示潜在 Bug 已清零。S7D 仍需进行完整对局稳定性验证；本轮不启动 S7D 或其他功能开发。

---

## 2026-09-27 · DEV-B 本地预设：运行时调试参数持久化（已实现，待用户集中人工验收）

- 任务性质与日期：独立 DEV 工具轮（不计入 S7C / S7D），2026-09-27。用户**一次性授权**「DEV-B 运行时调试数值的常驻保存」，并明确「不涉及蓝色声音圆圈、任何可视化效果或游戏玩法调整」；**本轮不授权 commit、push 或 Tag**，等集中人工验收后再单独归档。开工前已确认工作区存在 S7D / S7B 整体 Gate 的未提交文档改动（非本轮产生），故只在其后追加本条、并且只修改 DEV-B 相关段落。
- 用户授权范围（原话要点）：保留全部 38 项参数能力与各自含义 / 范围 / 生效时机；新增「保存调试参数」写入带版本号的**独立存档键**（不与场景编辑器 V2 的地图存档混用）；重开对局、返回阵营后开新局、刷新网页都恢复已保存参数，且**即使没有打开调试面板也按明确的 DEV 专用恢复规则生效**；面板显示「未保存修改 / 已保存 / 正式默认值」，保存失败不得虚报；「恢复默认」不得悄悄删除已保存预设，删除要走**独立操作 + 确认**；读取存档严格校验版本、白名单、类型、范围与非有限值，损坏或版本不符不得白屏，必须安全回退正式默认值并显示原因；恢复必须复用 `DevBRuntimeBinding` 的正式生效路径（含改抓捕范围后清除旧抓捕进度的副作用），不直接改 `GAME_CONFIG`、不绕过原绑定；保存与恢复**仅在开发环境启用**，生产构建不读取也不应用。
- 完成内容：
  1. 新增 `src/systems/DevBParamStore.ts`（纯逻辑，可直接在 Node 里测）：key `who-ate-my-rice/dev-b-runtime-params`；信封 `{format:'who-ate-my-rice/dev-b-params', version:1, savedAt, params}`；严格校验（信封 / 版本 / 参数白名单 / 类型 / 有限性 / 范围 / 非空）并给出失败码；读、写（**写入后回读一致才报成功**）、删除；三态判定与 `savedAt` 显示；`browserDevBStorage()` 与生产隔离入口 `devBPersistenceStorage(devEnvironment)`。
  2. 新增 `src/systems/DevBParamPersistence.ts`：把本地预设接到内存覆盖层。应用**只**经 `RuntimeDebugOverrides.restore()`，因此 `DevBRuntimeBinding` 的既有副作用（`capture.radius` 变化 → 立即清空抓捕累计进度 + 同步抓捕圈）照常触发，没有第二套应用逻辑。
  3. `src/three/DevBPanel.ts`：参数区内新增 `.dev-b-storage` 行——三态状态行（`data-storage-state` / `data-storage-error`）与「保存调试参数 / 加载已保存预设 / 删除本地预设（需确认）」三个按钮，节点只在构造时创建一次；未启用持久化时整行 `hidden`；参数区标题改为「覆盖仅本页内存，可另存为本地预设」；确认逻辑不放面板。
  4. `src/three/DevBDebug.ts`：接入持久化与 `confirm`（缺省用浏览器 `confirm`；**拿不到确认实现时默认拒绝删除**，绝不静默删除），删除前必确认；三个按钮的中文结果写进顶部提示条；「恢复正式默认值」的提示明确写出本地预设保留。
  5. `src/three/ThreeGame.ts`：构造 `DevBParamPersistence`，`storage` 由 `devBPersistenceStorage(import.meta.env.DEV)` 决定（生产构建恒为 `null`）；`devBBinding.start()` 之后立即按预设恢复（刷新即生效）；`resetRound()` 改为「先 `resetForNewRound()` 清本局覆盖，再 `applySaved('新局开始')`」，因此重开 / 返回阵营后开新局仍保留已保存的调试参数。
  6. `src/style.css`：`.dev-b-storage*` 三态配色（已保存绿 / 未保存修改琥珀 / 不可用红）。
- **未改**：`src/config/gameConfig.ts`（零新增参数）、`RuntimeDebugOverrides` 的白名单与 typed getter、`DevBRuntimeBinding` 的绑定与副作用、`DevBObserver` / `DevBView` / `DevBHelpText`、S7C-1B / S7C-2 / S7C-2b / S7C-3 的任何已验收机制、场景编辑器 V2 的地图存档逻辑与键名。依赖变化：无。`.trae/`、`.dsh-meow/`、`.codex/` 未读取、未修改、未暂存。
- 新增与扩展测试：`tests/dev-b-param-persistence.test.mjs`（19 项：保存→读取往返；刷新（新覆盖层 + 同一 storage）恢复；重开（`resetForNewRound()` 后再应用）恢复；恢复正式值**不删预设**且可再加载；三态文案；12 类非法 / 损坏存档（非 JSON / 非对象 / format 不符 / 版本不符 / 缺 params / params 非对象 / 空 params / 未知参数 / 非数字 / 越界 / 空文本）；损坏存档安全回落并给出原因；保存失败不虚报（写入抛错与回读不一致）；删除成功与失败；空覆盖不生成预设；**恢复预设时走真实 `DevBRuntimeBinding`（清空旧抓捕进度 + 同步抓捕圈到新半径）**；38 项白名单全部可保存并原样恢复；生产隔离（`devBPersistenceStorage(false)` 为 null、storage 为 null 时全部入口安全失败）；与场景编辑器 V2 存档键互不干扰；无 `localStorage` 时返回 null；源码不变量（DEV 门控、`resetRound` 先清后恢复、面板三按钮、确认逻辑只在编排层）。`tests/dev-b-panel-dom.test.mjs` 追加 6 项（三个按钮各一个且状态随覆盖值变化 `BASE → UNSAVED → SAVED`；「恢复正式默认值」不删预设且可再加载；删除**必须先确认**，取消不动预设、确认才删且不动内存覆盖值；损坏预设在面板上显示原因并回落；该行不随刷新增长节点与监听器；未启用持久化时整行隐藏）。
- 自动化门禁（本轮在最终工作树上实测）：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **725 / 725 通过**，退出码 0（基线 700 + 新增 25 项） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；JS **1,010.66 kB**（gzip 272.79 kB）、CSS 14.57 kB、`index.html` 0.41 kB；仍有 Vite >500 kB 非阻断提示 |
| `git diff --check` | 通过，退出码 0（仅既有 LF→CRLF 提示） |

- 浏览器真实复核（`docs/verification/DEV-B-PARAMS/`，本机 Chrome headless + CDP，脚本 + 日志 + 结构化摘要 + 8 张关键截图）：`FOOTSTEP 有效传播范围` 17 → 13（状态「未保存修改」）→「保存调试参数」（`SAVED`，`localStorage` `version 1` / FOOTSTEP 13）→ **F5 刷新后仍为 13** → **Esc「重新开始」后仍为 13** → 「恢复正式默认值」回到 **17**（状态「正式默认值」，**本地预设保留**）→ 「加载已保存预设」回到 **13** → 「删除本地预设（需确认）」确认框 1 次、键已删除而内存覆盖值仍为 13 → 场景编辑器 V2 地图存档键哨兵**原样保留**；控制台无异常（仅既有 `THREE.Clock` 弃用告警 3 条，脚本单独计数）。
- 本轮脚本侧踩到的两个坑（产品行为正确，脚本已修好后才跑通）：① `.dev-b-launcher` 的点击是**切换**——面板已经开着时再点一次会把它关掉，之后所有读数都变空；② `.dev-b-panel` 由 `.dev-b-body` 内部滚动，长面板下按钮 / 参数行的 `getBoundingClientRect()` 会落在视口之外，点击、命中测试与截图前必须先 `scrollIntoView`。
- 已知限制与下一项任务：① 本地预设只存在**当前浏览器**，清理站点数据即丢失（开机回落到正式默认值并显示原因，不白屏）；② 无版本迁移，`version` 不匹配即视为不可用；③ 未覆盖（不得记 PASS）：不同浏览器 / 无痕模式隔离、浏览器策略禁用 `localStorage` 的真实表现、配额写满、超大畸形存档、极矮窗口下新增按钮的可达性。**待用户按 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §12.7 的 10 条清单做集中人工验收**；验收通过并另行授权后才建立 Git 检查点。S7D 与 S7B 整体 Gate 的未提交工作**不得与本轮改动混在一起**提交。
- Git 检查点：本轮**未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash。工作区中 `docs/AGENT_LOG.md` 与 `docs/DEEPSEEK_HANDOFF.md` 原本就带有 S7D / S7B 整体 Gate 的未提交改动，本次只在文件末尾追加本条目，并只修改 DEV-B 相关段落。

---

## 2026-09-27 · 玩家声音探测可视化停用与代码归档（已实现，待用户集中人工验收）

- 任务性质与日期：独立专项任务（不计入 S7C / S7D），2026-09-27。用户**一次性授权**「停用玩家端的声音探测可视化，包括声音范围圈和彩色动态声纹。保留相关实现，未来能够低成本恢复」，并明确「AI 内部听觉、声音事件和现有 PerceptionSystem 判定暂时保留，不允许破坏 Human AI、DeepSeek AI 的既有行为」；**本轮不授权 commit、push 或 Tag**。
- 开工前核实的冲突（已停下向用户确认）：工作区 `src/three/SoundVisualView.ts`、`src/three/ThreeGame.ts`、`tests/sound-visual.test.mjs` 存在**非本代理产生**的未提交改动（写入时间 22:21，晚于 DEV-B 轮 21:44；本会话记录与 DSH 全部会话存档里都没有对应的工具调用）。用户确认「是我刚才调整声音圈时留下的」，并要求**保留当前工作区版本作为停用前快照、不得回退或覆盖**。因此本轮快照＝工作区版本（含该改动），`SoundVisualView.ts` **一字未动**。
- 审计结论（A / B / C 分离）：A＝仅服务玩家声音探测的显示（`SoundVisualView` 的距离分带、四个同心范围面、三条彩色声纹；`ThreeGame` 的 5 处接线；`GAME_CONFIG.perception.soundVisual` 视觉数值）；B＝AI 真实听觉与声音事件（`SoundEventSystem` / `PerceptionGeometry` / `heardBy` / `analyzeBy` / Human AI 循声调查 / DeepSeek 威胁感知）；C＝DEV-B 的声音调试与参数持久化（`DevBView` 自己的声音标记，不走 `SoundVisualView`）。**本轮只停用 A**。
- 实际停用位置（`src/three/ThreeGame.ts`）：新增模块级 `const PLAYER_SOUND_VISUAL_ENABLED: boolean = false;`，用它守住实例化与两处逐帧 `update`；字段改为 `SoundVisualView | null = null`，销毁改为空安全 `?.dispose()`。**没有**注释大段代码、**没有**删除共享声音系统实现；`updatePerceptionHud()` 里 `heard` / `probe` 的计算与喂给 DEV 面板的部分保持原样。
- 归档：新增 `archive/features/player-sound-visual/`——`SoundVisualView.ts`（停用前快照，SHA-256 `5FDD0F1E2253C00D6762E9DB10854FE9208C821BC451170DEDBB3E2E7BB6032D`，与 `src/three/SoundVisualView.ts` 逐字节一致）、`README.md`（原有功能与文件位置、游戏接线位置、关联配置及依赖、本次为什么停用、将来恢复步骤、恢复时需运行的回归测试、已知限制）、`visual-config.md`（`soundVisual` 全组数值与模块内视觉常量）、`wiring-and-tests.md`（接线逐行对照与测试归属表）。`archive/` 不在 `tsconfig.json` 的 `include` 内，快照不参与编译。
- 文档同步：`docs/GAME_BALANCE_CONFIG.md` 的 `soundVisual` 表后新增「当前状态」注记（数值一个都没改，只服务于已停用的表现层；`hudMidStrength` / `hudHighStrength` 在停用前就已无读取方）；`AGENTS.md`「视觉表现与玩法逻辑分离」两条就地补注停用状态与「不显示是预期行为、不要当 Bug 修」；`docs/DEEPSEEK_HANDOFF.md` §9 新增停用条目。`GAME_CONFIG` 数值、`tests/sound-visual.test.mjs`、`apartmentMap.ts` 未改动。
- 自动化门禁（本轮在最终工作树上实测）：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | **727 / 727 通过**，退出码 0（DEV-B 轮基线 725 + 用户 22:21 新增的 2 项声音圈测试） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；JS **1,008.19 kB**（gzip 272.00 kB）、CSS 14.57 kB；停用前同树为 1,011.62 kB（gzip 273.22 kB） |
| `git diff --check` | 通过，退出码 0（仅既有 LF→CRLF 提示） |
| 打包产物静态核对 | 停用前打包内含的 `SoundVisualView` 专属标识（`travelDurationMs` 2 / `ringThickness` 4 / `edgePadding` 2 / `angleLength` 2 / `waveGroup` 7 / `waveMaterials` 3 / `showDebugRings` 3 / `visualRadius` 3）在停用后**全部为 0**，说明构建期已把该表现层移出产物 |

- 浏览器真实复核（`docs/verification/PLAYER-SOUND-VISUAL-DISABLE/`，本机 Chrome headless + CDP，固定 `?matchSeed=20260927`；脚本 + 两轮日志 + 结构化摘要 + 截图）。为做同场景对照，「停用前」一轮把常量**临时**置 `true`、跑完**立即还原**，文件 SHA-256 已核对回原值（脚本输出 `hash matches original: True`）；两轮脚本各自先向开发服务器取一次 `ThreeGame.ts`，日志记录了服务器实际在发哪一版（after 轮＝`false`、before 轮＝`true`）。
  - **范围圈（决定性证据）**：同一固定种子下，声音圈专属色 `0xb5d8e5`（±14）像素：静止首帧 **13,515 → 359**；静止 6 帧 **13,515–13,729 → 359–555**；临时控制 Human 后 **13,499 → 359**；移动后首帧 **36,448 → 564**；移动 6 帧 **35,930–36,618 → 550–673**。差值 25～60 倍，停用后剩余几百像素是场景地板色。截图对照 `before/after-01-idle`、`before/after-03-possess`：停用前同屏可见半径 18 的大圈与角色身上 2.5 的近圈，停用后两条都消失，而同画面里的 DEV AI 安全路径粉线**照旧存在**。
  - **彩色声纹（本轮未拿到决定性前后对照，不得记为已实测）**：停用后侧是确定的（对象根本不实例化、截图无任何弧线、打包产物无该代码）；「停用前有彩色声纹」这一侧本轮**未覆盖**——脚本成功点到「临时控制 Human」并让 Human 走了一段（面板显示「当前控制对象：Human」），但该种子下 Human 距观察者太远，采样窗口内没有出现可听声音事件。颜色计数也不能当判据：声纹是半透明混合色，「贴近纯色」的容差测不到它，日志里的「蓝色声纹像素」（辅助值）两轮区间重叠（停用前 3,114–4,798，停用后 2,128–3,861），其中含场景本身就有蓝色元素。这一项目前只由源码与 `tests/sound-visual.test.mjs` 支持（`waveGroup.visible === true`、按 NEAR/MID/FAR 换色、同心带内扩散），**请在人工验收时肉眼确认**。
  - 两轮控制台异常均为**无**（仅既有 `THREE.Clock` 弃用告警 1 条）；所有 burst 采样帧都落在「对局中」，未把结算后的空画面当证据。
- 已知限制与下一项任务：① 声纹的停用前对照缺一轮（见上）；② 浏览器证据来自开发服务器，正式构建侧只有「产物不再包含该表现层」的静态核对，没有在生产构建里跑完整对局；③ 未覆盖不同浏览器 / 无痕模式 / 极窄或超宽窗口；④ 恢复该表现层属于**功能变更**，须另行获得用户授权并重走人工验收；⑤ 下一项任务＝等用户按本轮材料做集中人工验收，通过并另行授权后才建立 Git 检查点。
- Git 检查点：本轮**未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash；未读取 / 修改 / 暂存 `.trae/`、`.dsh-meow/`、`.codex/`；既有未跟踪验证材料未清理。工作区另有 S7D / S7B 整体 Gate 与 DEV-B 常驻功能的未提交改动，与本轮互不覆盖。

---

## 2026-09-27 · 玩家声音探测可视化停用：用户集中人工验收 3/3 PASS 与正式归档

- 用户集中人工验收：**3 / 3 PASS**——① 声音探测完全消失；② 双方 AI 与原有玩法正常；③ DEV 工具与代码归档无误。该结论为**用户人工确认**，与本代理的浏览器复核（`docs/verification/PLAYER-SOUND-VISUAL-DISABLE/`）是两条独立证据，覆盖范围不同，不得互相改写。
- 本轮归档范围（用户授权：本任务单次正式提交 + 正常推送；**不创建 Tag、不推进新阶段**）：仅「玩家声音探测停用 + 其确认过的停用前快照」——`archive/features/player-sound-visual/` 的四个归档文件、`src/three/ThreeGame.ts` 的停用接线、用户确认的 `src/three/SoundVisualView.ts` 与 `tests/sound-visual.test.mjs` 声音圈快照、`docs/verification/PLAYER-SOUND-VISUAL-DISABLE/` 的精选验证材料、`docs/GAME_BALANCE_CONFIG.md` 中仅关于本次停用的状态注记、`AGENTS.md` 的长期停用保护规则、`docs/DEEPSEEK_HANDOFF.md` 与本日志。
- 隔离情况（混合文件按实际差异精确暂存，**未整文件暂存**）：`src/three/ThreeGame.ts`、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md` 三个文件里同时存在 **DEV-B 参数持久化**与 **S7B overall Gate** 的未提交改动，本轮只暂存属于本任务的差异。**DEV-B 持久化（`src/systems/DevBParamStore.ts`、`src/systems/DevBParamPersistence.ts`、`src/three/DevBPanel.ts`、`src/three/DevBDebug.ts`、`src/style.css`、`tests/dev-b-panel-dom.test.mjs`、`tests/dev-b-param-persistence.test.mjs`、`docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`、`docs/verification/DEV-B-PARAMS/`）与 S7B Gate / S7D 的文档改动一律不进本次提交**，原样留在工作区。提交的 `ThreeGame.ts` 只含停用接线，**不含** DEV-B 持久化的构造、`resetRound()` 恢复与面板接线。
- 三条边界在文档中保持明确区分：① **玩家端声音可视化已停用**（范围圈与彩色声纹都不再显示）；② **AI 内部听觉与声音事件照常运行**（`SoundEventSystem` / `PerceptionSystem` / 两套 AI 未改）；③ **DEV-B 的独立声音事件调试未停用**（`DevBView` 自己绘制、不经 `SoundVisualView`）；④ 原可视化代码已完整保存在 `archive/features/player-sound-visual/`，未来可恢复（把常量 `PLAYER_SOUND_VISUAL_ENABLED` 改回 `true` 即可）。
- 本轮门禁（在最终工作树上重跑，真实输出）：`npm test` **727 / 727 通过**（退出码 0）、`npx tsc --noEmit` 退出码 0、`npm run build` 退出码 0、`git diff --check` 退出码 0；构建产物中 `SoundVisualView` 的专属标识仍为 **0**（打包期已把停用表现层移出产物）。开发完成时的 727/727 是当时基线，本条为本次归档轮的重跑结果。
- 已知限制（保留，不因验收通过而删除）：停用前的彩色声纹**缺少完整的浏览器前后对照**（当轮采样窗口内 Human 距离观察者太远，没有可听声音事件；声纹是半透明混合色，颜色计数不可作判据）；正式生产构建侧只做了「打包产物不再包含该表现层」的**静态核对**，未在生产构建里跑完整对局。用户人工验收已覆盖「声音探测完全消失」，但**人工验收不写成代理实测**，代理实测也不改写人工验收结论。
- Git 检查点：本轮建立正式归档提交（提交说明 `refactor: disable and archive player sound visualization`）；推送按用户本次授权执行，**实际推送结果以 `git ls-remote origin refs/heads/main` 现场查询为准**，本日志不预填 SHA、不创建 Tag。

---

## 2026-09-27 · DEV-B 本地预设：用户集中验收与独立归档

- 阶段与日期：DEV-B 运行时调试参数持久化，2026-09-27。用户确认集中浏览器人工验收 **10/10 通过**，授权本轮单独提交并正常推送；原 DEV-B 的 38 项运行时覆盖能力和正式 `GAME_CONFIG` 数值保持不变。
- 完成内容：独立 `localStorage` 预设支持保存、手动加载、确认后删除；刷新、重开及返回阵营后开新局时恢复。保存值通过既有 `RuntimeDebugOverrides.restore()` 与 `DevBRuntimeBinding` 生效；损坏或不兼容存档安全回退并显示原因。预设仅在开发构建读取和应用，与场景编辑器 V2 的布局存档使用不同键，互不影响。详细参数与历史实现见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §12 及本日志此前的实施记录。
- 自动化测试与人工验收：

| 检查项目 | 本次结果 |
|---|---|
| `npm test` | **727 / 727 通过**，退出码 0；此前实施轮的 725/725 是当时基线。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；Vite 大于 500 kB 的资源提示不阻断。 |
| `git diff --check` | 通过，退出码 0；仅有既有 LF→CRLF 提示。 |
| 用户集中浏览器人工验收 | **10 / 10 通过**：预设入口、参数修改与保存、刷新恢复、重开与阵营重选、恢复正式值、重新加载、确认删除、DEV-B 原功能及场景编辑器存档独立。 |

- Git 检查点：本次授权的独立提交说明为 `feat: persist DEV-B runtime debug presets`；完整 SHA 与推送结果以提交后 Git 及实时远端查询为准，不预填尚未发生的结果。S7B overall Gate 与 S7D 的未提交内容不得混入本次归档。
- 已知限制与下一项任务：本地预设不跨浏览器或设备同步；清理站点数据后预设消失。不同浏览器／无痕、浏览器禁用本地存储、配额写满、超大畸形存档及极矮窗口按钮可达性仍未全部做真实浏览器覆盖，不将 10/10 人工验收扩写为这些边界已验证。本次归档后不自动开始其他开发任务。

---

## 2026-09-27｜S7D：双阵营完整 Alpha 开发与整局验证（**已实现，待用户集中人工验收**）

- 阶段与授权：S7D。用户**一次性授权完整实施 S7D、单阶段交付、一次集中人工验收**；**本次不授权 commit、push 或 Tag**，开发完成后停止等待集中人工验收，不自动进入 S8。范围：玩家选 Human 时 DeepSeek AI 自主找米 / 进食 / 逃跑 / 冲刺 / 关门 / 锁门 / 藏身；玩家选 DeepSeek 娘时 Human AI 自主巡逻 / 调查 / 追逐 / 搜索 / 开门或解锁 / 检查藏身家具；两种阵营都要能从阵营选择推进到结算、重开与返回菜单。**优先整合和修复已有机制，不新增未经授权的玩法。**
- 开工前核实（实测）：分支 `main`，HEAD = `b2df4e6ae6497c0d3cfb876e9a14ef253b4c9bc8`（`docs: finalize S7B overall gate`），远端 `refs/heads/main` 与 HEAD 相同，`git rev-list --left-right --count origin/main...HEAD` = `0 0`，无合并 / 变基在进行，暂存区为空；未提交修改只有 `src/three/ThreeGame.ts` 的 **1 行空白差异**，与用户给出的开工信息一致。
- 那条空行差异的真实来源（用户点名要求核实）：`git diff --ignore-blank-lines b2df4e6 -- src/three/ThreeGame.ts` 为空 ⇒ 只有空行不同；`893296a` 的该文件没有这个空行，而 `9aafd2e:src/three/ThreeGame.ts` 的 blob = `42f19eb97b09caf1e861752e90923ddd8023b5e9`（与该轮归档笔记记录的暂存 blob 完全一致）、`c65333c` 与 `b2df4e6` 都是 `abd0ac93`（= 前者 + DEV-B 持久化接线），工作区是 `31d9404c`（= `abd0ac93` 少这一个空行，173,795 字节、LF 3,133）。**结论：它是上一轮「玩家声音可视化停用」精确暂存时替换文本自带的空行，不是 DEV-B 轮或 S7B Gate 造成的，功能零影响。按用户要求不重置、不删除、不混入本阶段。**
- 整局验证方法（两条独立证据腿，互不改写）：① `tests/s7d-match-sim.mjs` 无头逻辑仿真——用**同一批生产系统**（CollisionWorld / NavigationSystem / DoorSystem / HumanDoorSkill / PerceptionGeometry / SoundEventSystem / VisionSystem / RiceTraceSystem / HideSystem / HumanStillness / SprintSystem / RiceField / GameStateSystem / AILogCollector / 两套 AI，以及权威的 `resolveDeepSeekAiHideEntry`、`humanBlocksHideExit`、`createHumanAiMapSnapshot`、`resolveHumanAiHideCheck`）在 Node 里重放 `updatePlaying()` 的玩法与 AI 通路；它是**逻辑仿真，不是浏览器实机、也不是真人试玩**。② `docs/verification/S7D/browser-check.mjs` 真实 Chrome（headless + CDP）整局，走真实 DOM 与真实 DEV 面板导出。仿真器为可复现把 AI 掷骰改成种子派生流（正式游戏是 `Math.random`），因此**同一 `matchSeed` 的两条腿轨迹不保证一致**。
- 审计发现并修复 **4 处可复现的整局阻断**，根因是同一类问题——「这个 Human 是不是威胁 / 是不是挡住了路」在 `DeepSeekAIController` 不同位置用了互不一致的判据（`dangerRouteRadius` 3.0 / `stationaryPassageBlockRadius` 1.5 / `visionEvadeDistance` 5.0）：
  - **A：SAFE_WAIT 在最后一堆米前无限等待。** 复现 `analyze-match.mjs 20292603 HUMAN idle`。最后一堆米 `rice_13 (-6.2,7.1)`、站桩 Human `(-3.40,10.00)`：米距 Human 4.03 u、A* 路线最近只到 1.60 u——`updateSafeWait()` 按 3.0 判「路线仍危险」而一直等待，静止通行闸门按 1.5 判「没人挡路」而拒绝出手，只剩一堆米也无处可换。修复前 **600 秒未结算、4/5 米、最长 559,850 ms 没进食**；修复（`tryStartPassage()` 在 `SAFE_WAIT` 时改用 SAFE_WAIT 自己的危险半径）后 **74.3 秒结算、5/5 米**。
  - **B：MOVE_TO_RICE → EVADE → RECOVER 整局循环。** 复现 `analyze-match.mjs 20292603 HUMAN idle - 4`。米堆落在 AI 的「看见 Human 就逃」距离（5.0）以内时，AI 每次靠近都必然被判 HIGH 威胁，永远吃不到；而静止通行闸门判断「米堆是否靠近 Human」只用了 3.0（4.03 > 3.0）⇒ 判定没挡路。修复前种子 `20292603` 的 24 条 AI 随机流里 **5 条 600 秒不结算**；修复（`humanNearRice` 取 `dangerRouteRadius` 与 `visionEvadeDistance` 中更大者）后 **24/24 结算、中位 45.9 秒、0 异常**。
  - **C：藏身后「只要看得见 Human 就不退出」。** 复现 `diagnose-hide-lock.mjs`（种子 `20300522` + `pursue`：Human 在 8.38 u 外、威胁只有 CAUTION/VISION，仍连续 **570 秒**拒绝退出）。藏身期间 AI 自己的视觉不被遮蔽，而 `evaluateHideExit()` 的第一条是「可见即不出」，与 `assessThreat()` 只在 5 u 内才判 HIGH 不一致。修复：可见 Human 只有在**同时**落在 `visionEvadeDistance` 内时才继续拒绝退出。
  - **D：危险距离内 Human 长时间静止也永不退出。** 复现 `robustness-sweep.mjs 12 20260927`：该布局 Human 出生点距 AI 会选的藏身家具只有 **3.03 u**，AI 藏进去后 Human 全程不动（stillMs 涨到 578 秒），修复 C 之后仍然一直藏着。修复：危险距离内再加一个**公开**出口——若这个可见 Human 已被 `HumanStillness` 公开地判定为长时间真的静止（门槛用既有的 `curiosityStillMs`，正是 S7B-2 授权「绕过静止 Human 去吃饭」的同一条门槛），允许退出；Human 一动或只是短暂停下仍然继续藏着。修复前 **2/12 结算**，修复后 **12/12 结算、中位 56.1 秒、0 异常**。
- 边界守门：**本轮没有修改任何 `GAME_CONFIG` 数值**（`src/config/gameConfig.ts` 无改动）；没有恢复玩家声音可视化；没有改动 DEV-B 38 项参数 / 本地预设、场景编辑器 V2 存档、S7C-3 随机化、双阵营冻结与 READY 独立计时；「没有抓捕圈外的安全路线就拒绝放行」的安全边界未放宽，AI 没有抓捕免疫，也没有瞬移或读取隐藏实时坐标。**唯一被改写的既有测试**：`tests/deepseek-curiosity-priority.test.mjs` 的「rice proximity never authorizes an unsafe route or a distant unrelated Human」——它原先用 `dangerRouteRadius + 1`（4.0 u）代表「远处无关的 Human」，而修复 B 正是让 3～5 u 也算「挡住了这堆米」；已把该处改为 `visionEvadeDistance + 1`（6.0 u）并保留其真正的安全断言（无安全路线时拒绝放行），属**有证据的语义修订，需用户在验收时确认**。
- 整局遥测（复用既有 `AILogCollector`，不新建第二套时钟 / 事件来源）：新增 `matchSummary`，AI JSON `formatVersion` **1.6 → 1.7**（v1.6 字段语义不变）：随机种子 / 玩家阵营 / 阶段 / 胜负与原因 / 时长 / 完成米数、门开·关·锁·解锁·强破与冲刺 / 摔倒 / 藏身进入·退出·拒绝 / Human AI 搜查开始·搜中·搜空 / 强制抓捕的 **O(1) 计数**、S7B-3A 关门与 S7B-3B 锁门的**逐条实机证据**（各上限 50）、AI 卡路与异常状态 `LOCAL_LOOP` / `NO_ROUTE_TO_RICE` / `SAFE_WAIT_THREAT_PERSISTS` / `HIDE_LONG_CONCEALMENT`（折叠成「首次时间 + 持续时长」，上限 100）。
- 整局验证结果：

| 检查项目 | 本次实际结果 |
|---|---|
| `npm test` | **743 / 743 通过**，退出码 0（727 基线 + 新增整局回归 7 项 + 整局摘要 9 项；其中 1 项既有边界用例按上文做了有证据的修订） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0 |
| `git diff --check` | 通过，退出码 0 |
| 自动化批量（无头逻辑仿真，30 局） | 严格同组合 A/B：**修复前 28/30 结算、2 局 600 秒未结算、2 条异常 → 修复后 30/30 结算、0 条异常**；AI 藏身计数由 1 进 0 出变为 1 进 1 出（无反复进出） |
| 稳健性扫描（6 种子 × 12 条 AI 随机流） | **72 / 72 结算，0 异常**（修复前：`20260927` 2/12、`20292603` 19/24） |
| 真实浏览器整局（4 局） | **4 / 4 正确结算**：Human 阵营 2 局（DeepSeek 娘 5/5 米胜，37.8 秒与 46.0 秒，其中 46.0 秒那局是修复用的固定种子 `20292603`，修复前曾在浏览器里 180 秒未结算）、DeepSeek 阵营 2 局（人类抓捕胜，7.1 秒与 12.3 秒） |
| 浏览器重开 / 返回菜单 | 4/4 都验证了「再来一局 → 回到 READY → 再次进入正式对局」与「Esc → 暂停面板 → 返回阵营选择 → 阵营菜单可见」 |
| 浏览器 AI JSON 导出 | 4/4 都从 DEV 面板**真实导出**一份 `formatVersion 1.7` 的 AI JSON，`matchSummary` 的胜负 / 原因 / 完成米数 / 种子 / 阵营与结算面板一致，异常记录均为 0 |
| 与既有阶段的回归 | 藏身生命周期 / 循环抑制 / 搜查等 **75/75** 通过；SAFE_WAIT / 静止安全通行 / 好奇优先级全部通过；玩家声音可视化仍停用；未读取 / 修改 / 暂存 `.trae/`、`.dsh-meow/`、`.codex/` 与既有未跟踪验证材料 |
| 用户集中人工验收 | **尚未进行**（本轮以「开发完成后停止、等待用户集中人工验收」收尾） |

- 本轮文件：新增 `tests/s7d-match-sim.mjs`（整局仿真器）、`tests/s7d-full-match.test.mjs`（整局回归 7 项）、`tests/ai-log-match-summary.test.mjs`（整局摘要 9 项）、`docs/S7D_ALPHA_FULL_MATCH_DESIGN.md`、`docs/verification/S7D/`（`README.md` + `run-match-batch.mjs` + `analyze-match.mjs` + `diagnose-safewait.mjs` + `diagnose-hide-lock.mjs` + `robustness-sweep.mjs` + `browser-check.mjs` + `probe-dom.mjs` + `smoke-sim.mjs` + `baseline/` `after/` `after-baseline-combos/` `browser/` 四组证据）；修改 `src/systems/DeepSeekAIController.ts`（`tryStartPassage()` 与 `evaluateHideExit()` 两处判据）、`src/systems/AILogCollector.ts`（`matchSummary`）、`src/three/ThreeGame.ts`（遥测接线与藏身快照字段）、`tests/ai-log-collector.test.mjs`（格式版本 1.6→1.7）、`tests/deepseek-curiosity-priority.test.mjs`（上文那处边界修订）、`docs/DEEPSEEK_HANDOFF.md`、本日志。删除文件：无。依赖变化：无。`src/config/gameConfig.ts` 与 `src/three/SoundVisualView.ts` 无改动。
- Git 检查点：**本轮未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash / amend / rebase。工作区保留本轮全部改动，另有开工前就存在的 `src/three/ThreeGame.ts` 单空行差异（见上，按用户要求原样保留、未暂存）。
- 已知限制与下一项任务：① 真实浏览器同种子不复现仿真轨迹（AI 掷骰是 `Math.random`，`?matchSeed=` 只固定布局）；② S7B-2「偶发原地停留」已修掉 4 个可复现的整局版本，但不能证明清零，仍留后续优化项；③ `deepseekAi` 的 `hideMaxConcealMs` 仍为 **0（不限制）**，本轮未改数值，而是收窄了「什么才算仍然有威胁」的判据（72/72 结算，无需硬兜底）；④ 正式 GLB 角色 / IDLE 动画未导入；⑤ Human AI 自动解锁 8,750 ms 留待 S16。**下一步：等用户集中人工验收；未获授权前不 commit / push / Tag，也不进入 S8。**

---

## 2026-09-28｜S7D 最终集中验收与正式归档

- 阶段与日期：S7D 双阵营完整 Alpha 开发与整局验证，2026-09-28。用户已授权本轮独立提交并正常推送；不创建 Tag，不进入 S8。
- 完成内容：沿用前一条实施记录的四处整局阻断修复、AI JSON `matchSummary` 和完整对局验证。本轮不改源码、`GAME_CONFIG` 或玩家声音可视化；开工前已有的 `src/three/ThreeGame.ts` 单空行差异原样保留，不纳入 S7D 提交。
- 自动化测试与人工验收：

| 证据类别 | 结果与边界 |
|---|---|
| 本轮 `npm test` | **743 / 743 通过**，退出码 0。 |
| 本轮 `npx tsc --noEmit` | 通过，退出码 0。 |
| 本轮 `npm run build` | 通过，退出码 0；Vite 大于 500 kB 的提示不阻断。 |
| 本轮 `git diff --check` | 通过，退出码 0；仅有 LF→CRLF 提示。 |
| 既有无头逻辑仿真 | 同组合 30/30 结算；6 个种子 × 12 条 AI 随机流 72/72 结算。它们不是浏览器实机或真人试玩。 |
| 既有真实浏览器脚本 | 4/4 整局结算并验证重开与返回菜单；玩家侧由脚本控制，不是真人试玩。 |
| 用户最终集中人工验收 | 静止通行修订、藏身退出修订、Human 阵营完整对局、DeepSeek 娘阵营完整对局、生命周期及复现、DEV 与声音显示回归，六组均 **PASS**。 |
| 用户真人试玩 | Human 玩家 **30 局**、DeepSeek 娘玩家 **30 局**，合计 **60 局**，无阻断整局完成的问题。此为用户亲自确认，不写成代理测试。 |

- Git 检查点：提交说明 `feat: complete S7D dual-faction alpha`。本条记录用户授权和本轮已完成的检查；完整 SHA、推送与远端一致性以实际 Git 核验为准，不预填尚未发生的结果。
- 已知限制与下一项任务：S7B 遗留的偶发原地停留仍列为观察项，不宣称绝对根除。用户操控 DeepSeek 娘时感觉 Human AI 抓捕速度比自己操控 Human 更快；**仅为未测量的平衡体感**，不预设原因、不改任何已验收数值。固定 `matchSeed` 只复现布局、不固定正式游戏 AI 掷骰。S8 未授权，本轮完成后停止。

---

## 2026-10-02｜Alpha 表现优化：工作区实施与验证

- 阶段与日期：用户授权的 Alpha Polish 专项，实施及检查跨 2026-10-01～2026-10-02；不是 S8 开工，尚未通过本专项用户集中人工验收。
- 完成内容：以暖木、米白和布艺统一住宅外观，增加家具局部生活细节、木门把手、米袋与程序化低多边形角色。相机只做平移跟随平滑；正式 HUD 增加米数、阵营、时间、冷却环、READY 和进度反馈，简化交互提示与菜单。地图调试文字改为 DEV 展开或编辑器打开时显示。详细文件职责与取舍见 `docs/ALPHA_POLISH.md`。
- 保护范围：未改 `GAME_CONFIG`、AI 控制器、输入与碰撞求解、正式进食/抓捕/门锁规则、随机布局或存档格式。未恢复玩家声音可视化。原有 `ThreeGame.ts` 一行空行差异及既有未跟踪验证材料保留；未读取或修改受保护资料目录。
- 自动化测试与浏览器复核：

| 检查项目 | 实际结果与证据边界 |
|---|---|
| `npm test` | 750/750 通过，退出码 0；原 743 项加 7 项表现回归，最终 HUD 提示调整后已重新执行。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；74 个模块，JS 1,024.39 kB；大于 500 kB 分块提示非阻断。 |
| `git diff --check` | 通过，退出码 0；仅有 LF/CRLF 信息。 |
| 参考游戏 | 已进入简单难度并操作暂停/潜行，未完成整局，不宣称验证其全部手感。未复制素材或代码。 |
| 实际浏览器 | 已看到新版菜单、角色/家具、双阵营 HUD、Q 冷却和暂停；打开并关闭 DEV-B，打开场景编辑器并选择床，无编辑或存档操作；重开能回到 READY。DP 一局曾自然结算为 Human 胜（约 9 秒），主要是被动观察，不等于完整交互覆盖。 |
| 浏览器未覆盖 | Human 对局观察到米进度推进，但未取得最终结算证据；持续移动、长按 E 完整吃米、指定家具藏身/退出、冲刺和门锁的专项实机覆盖不足，记为待复核，不用单元测试冒充通过。运行页面计时推进极慢，未修改游戏逻辑或数值加速。 |
| 用户集中人工验收 | 尚未进行。浏览器操作与自动化结果不替代用户验收。 |

- 浏览器预设说明：DEV-B 显示用户既存的两项声音范围覆盖，本轮未改动或保存该预设，未将其回写正式配置。截图中的 DEV-B 独立调试线不属于已停用的玩家声音探测表现。
- Git 检查点：本轮没有暂存、commit、push 或 Tag；工作区成果等待用户验收及独立归档授权。
- 已知限制与下一项任务：角色仍是程序化占位美术；门保持立即同步真实状态，不做可能与碰撞失配的缓动；大型家具遮挡与低性能设备阴影开销需实机复验。既有偶发 AI 停留及 Human 抓捕速度体感未改。下一步仅为补齐集中人工验收，不自动进入新阶段。

## 2026-10-02｜整体视觉与 UI 重设计：等待用户验收

- 完成内容：比较两种构图后采用住宅沙盘与侧边任务栏；重构阵营菜单、双阵营 HUD、READY、暂停与结算的 DOM 和布局。游戏镜头纵向范围增加 40%，角色表现子节点宽度乘 1.35、高度乘 1.65，墙体视觉高度乘 0.72；原碰撞、地图平面尺寸、玩法配置、AI 与胜负规则不变。配色采用暖灰、米白、暖木与灰绿。细节见 `docs/ALPHA_POLISH.md`。
- 测试与验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | 755/755 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；74 模块，JS 1,027.09 kB；既有分块体积警告非阻断。 |
| 浏览器复核 | 两阵营菜单、READY、HUD、Human Q 冷却、暂停、返回菜单及重新开始正常显示。DP 被动观察局自然触发抓捕结算，取得截图；不是主动完整操作覆盖。 |
| 尚未充分验证 | 持续移动、长按吃米、指定家具藏身与门锁全流程、Human 整局结算；需集中人工复验，不以逻辑测试冒充实机通过。 |
| 用户验收 | 待进行，不更新阶段 Gate。 |

- Git 检查点：没有暂存、commit、push 或 Tag。既有工作区改动、验证材料和个人资料保留。
- 已知限制与下一项任务：角色仍是程序化占位美术；正式视图关闭 DEV-B 辅助线，展开 DEV/DEV-B 后仍可查看。未修改用户预设，未恢复玩家声音表现。截图保存在外部成果目录；前后图并非同种子像素差分。下一步为用户人工验收，不启动 S8。

## 2026-10-02｜人物建筑体块与住宅外围：视觉专项

- 完成内容：重新观察参考场景后，分别增大角色头部、躯干、四肢及鞋的体块；墙体表现高 1.95、厚 0.324，新增墙帽与固定门框，增厚门叶、床垫、沙发和柜架。新增纯背景住宅步道、道路、路缘、标线、树池、灌木、路灯和生活设施。最后微调镜头，未再次重做 UI。
- 测试与验收：

| 检查 | 本轮结果 |
|---|---|
| `npm test` | 757/757 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；75 模块，既有 500 kB 分块提示非阻断。 |
| `git diff --check` | 通过，退出码 0。 |
| 浏览器 | 已实际查看参考与本游戏，全图、外围及人物与门墙家具比例已截图；编辑器打开/关闭未操作存档。没有把视觉检查写为完整玩法回归。 |
| 用户人工验收 | 等待确认。 |

- Git 检查点：没有暂存、commit、push 或 Tag；此前未提交成果与资料保留。
- 已知限制与下一项任务：新增结构均为表现 Mesh，不是可通行外围地图；厚墙和大角色可能增加局部视觉遮挡，需用户实机验收。不改 GAME_CONFIG、逻辑碰撞尺寸、导航、AI、移动、抓捕或胜负。下一步仅为本轮视觉人工验收。

## 2026-10-02｜角色移动动画与转向表现：待人工验收

- 完成内容：在既有程序化 Q 版角色表现中，为身体、头、双臂和双腿加入独立视觉关节。移动时双腿交替迈步、双臂反向摆动，躯干轻微移重心并低幅起伏；冲刺增加步频与摆幅，保留前倾；停止后平滑收回待机姿势。依据 Gameplay 已完成的世界 XZ 位移设置目标朝向，视觉以帧时间和最短角差追赶，不延迟真实移动。Human、DeepSeek 玩家及 AI 沿用同一 `CharacterActionView` 接口。
- 自动化测试与人工验收：

| 检查项目 | 本轮结果 |
|---|---|
| `npm test` | 最终重跑 761/761 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；75 模块，既有大于 500 kB 分块提示非阻断。 |
| 定向动画测试 | 16/16 通过，覆盖对侧手腿摆动、待机回正、冲刺幅度、90°/180°/±π 转向、快速连续变向和 Gameplay 根变换不变。 |
| 浏览器检查 | Chrome 实际加载菜单、Human 对局与角色画面，无新控制台错误；当前浏览器控制仅能发送瞬时按键，不能稳定保持 WASD，因此未完成持续移动与转身的真实浏览器观测，需用户集中人工验收。 |
| 用户人工验收 | 待进行；不更新阶段 Gate。 |

- Git 检查点：未暂存、提交、推送或创建 Tag。既有未提交 Alpha 表现、UI、场景及验证资料原样保留。
- 已知限制与下一项任务：程序化人偶仍是正式模型导入前的占位表现。实际 W/A/S/D 持续移动、连转与冲刺在浏览器中需要手动观察，未用单元测试替代实机证据。`GAME_CONFIG`、碰撞、移动速度、导航、AI 决策及 S7D 规则未修改。

## 2026-10-02｜厚墙门洞与四边外围修复：待人工验收

- 完成内容：用真实 Three.js 实体投影测试复现门扇在开启约 5° 时与固定门框相交。统一视觉门框与门扇的开口、铰链和摆动余量，使门扇及五金在完整摆角内不进入门框或厚墙；真实门状态、碰撞盒及开锁规则不变。外围补齐地图后侧、左侧道路、路缘、铺装与少量绿化设施，四边道路以接缝连接而非重叠共面，保持室内住宅为主体。技术说明见 `docs/ALPHA_POLISH.md`。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| 门几何回归 | 实际门 Mesh、门框、墙和墙帽：18 扇门各取 0° 至 90° 每 5° 的姿态，均未检出实体相交；修改前第一扇门在 5° 稳定失败。 |
| 外围回归 | 上、下、左、右四边道路及路缘均存在，并保持纯视觉、不可选中。 |
| `npm test` | 763/763 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；76 模块，既有大于 500 kB 分块提示非阻断。 |
| 浏览器复核 | 菜单全图确认四边道路与北侧绿化；同一真实门 Mesh 的独立临时预览检查关闭、45°、90°并保存截图。45° 是几何中途姿态，不是正式游戏新增的开门动画。浏览器控制未完成多扇门连续 E 开关与角色实走，须用户手动复验。 |
| 用户人工验收 | 待确认；不更新阶段 Gate。 |

- Git 检查点：未暂存、commit、push 或创建 Tag；此前未提交的场景、角色动画、UI 和用户验证资料均保留。
- 已知限制与下一项任务：正式门状态仍即时切换，门的实际开关手感与角色经过门洞须用户浏览器验收。本轮不修改 `GAME_CONFIG`、S7D AI、导航、实际移动速度、抓捕范围或胜负条件。

## 2026-10-02｜外围街区构图重设计：待人工验收

- 完成内容：根据用户指出的「四边马路包围住宅」问题，只重做 `ResidentialExterior.ts` 的纯视觉场景。以贯穿主街、偏置支路与短服务巷取代四边道路框；新增邻居公寓、联排住宅和低矮街角商店三个背景建筑，以及聚集在路口与入口的停车棚、汽车、自行车、树木和街道设施。远景地面与场景底色衔接，避免绿色底板边缘。主住宅地图、角色、UI 与正式玩法未改。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| 外围定向测试 | 17/17 通过；确认非对称路网、背景建筑、纯视觉与资源回收。 |
| `npm test` | 763/763 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；76 模块，既有大于 500 kB 提示非阻断。 |
| `git diff --check` | 通过，退出码 0；LF/CRLF 提示非阻断。 |
| 浏览器检查 | 使用真实 Three.js 场景拍摄完整街区全景，并检查游戏菜单中的实际局部画面；未将全景视觉检查写作双阵营完整试玩。 |
| 用户人工验收 | 待确认。 |

- Git 检查点：未暂存、提交、推送或创建 Tag；此前未提交的视觉表现与用户资料均保留。
- 已知限制与下一项任务：外围建筑不可进入，也不参与碰撞、导航、AI 或开门；低细节模型仅承担构图。需要用户查看全景并人工确认视觉方向；本轮不改 `GAME_CONFIG`、S7D AI、移动速度或胜负条件。

## 2026-10-03｜外围街区续作与全景复核：待人工验收

- 完成内容：延长主街及支路，补充支路另一侧的第四栋邻居住宅、入口和院墙绿篱；修正街角商店朝向，使门窗面向道路。服务巷与支路按边缘拼接。真实浏览器已检查全景和正式游戏菜单，截图保留在本轮交付中；临时构图检查页已删除。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| `npm test` | 763/763 通过，退出码 0；含外围不进入玩法区域、不可选中及资源回收检查。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；76 模块，既有大于 500 kB 提示非阻断。 |
| `git diff --check` | 通过，退出码 0。 |
| 浏览器 | 真实 Three.js 场景全景与游戏菜单画面已复核；全景使用单独检查镜头，正式相机参数未改。 |
| 用户人工验收 | 待确认；不更新阶段 Gate。 |

- Git 检查点：未暂存、commit、push 或创建 Tag；既有未提交成果和验证资料保留。
- 已知限制与下一项任务：外围是不可进入的低细节背景；本轮未重跑双阵营完整浏览器对局，不将视觉截图当作完整玩法验收。主住宅地图、`GAME_CONFIG`、碰撞、导航、AI、移动速度及胜负规则未改。下一步仅为用户街区构图验收。

## 2026-10-03｜外围街区几何与正式相机裁切修复：待人工验收

- 完成内容：按用户要求暂停美术扩展，先复现再修复。正式相机原观察距离为 22 单位，扩展后的道路与右侧楼体跨越近裁切面，形成斜切、梯形缺口；顶点绕序、正尺度检查未发现自定义几何错误。同时修正道路高度差、人行道接缝、地基覆盖不足、部分支撑物悬空和停车棚跨路问题。道路与路口使用共边矩形，支撑按地表落地；相机仅沿视轴退后并适配深度范围，不改变正交构图、移动朝向或玩法。详细复核入口见 `docs/verification/EXTERIOR_GEOMETRY/README.md`。
- 验证缺口更正：此前独立全景使用较远镜头，未覆盖正式相机近裁切问题。本轮保留历史记录，以真实正式相机偏移复现，并新增回归防止再发生。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| 新增定向回归 | 9/9 通过；修复前道路高度、接缝和落地测试失败，正式相机也能稳定复现近裁切问题。 |
| `npm test` | 772/772 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；77 模块，既有大于 500 kB 提示非阻断。 |
| `git diff --check` | 通过，退出码 0；LF/CRLF 提示非阻断。 |
| 浏览器检查 | 无菜单遮挡的真实地图检查页：全景、四边、四角与建筑近景均已检查并保存截图；正式游戏进入对局及开关编辑器后正常渲染，未应用或保存地图。不将这些检查写成完整玩法试玩。 |
| 用户人工验收 | 待确认，不更新阶段 Gate。 |

- Git 检查点：未暂存、commit、push 或创建 Tag；既有未提交的 UI、角色、门表现和用户验证材料均保留。
- 已知限制与下一项任务：外围仍为低细节、不可进入的视觉背景；本轮没有新增背景建筑，也没有用隐藏 Mesh、关闭深度测试或遮挡物掩盖缺陷。未修改主住宅玩法几何、`GAME_CONFIG`、碰撞、导航、S7D AI、移动、UI 布局或胜负条件。等待用户几何修复验收。

## 2026-10-03｜外围街区完整性修复：待人工验收

- 完成内容：核实左上长条是独立生成的 `west-boundary-wall`，并非路缘、住宅墙或相机裁切。它和 `north-garden-wall` 都没有完整院落归属，已从外围生成逻辑移除。原来围着物件各铺一小块地面，导致大量底板暴露；现在按路界建立连续地块、人行道和路缘。北侧既有两栋楼及阳台后移到道路外，右侧绿篱落地。没有增加背景建筑或装饰，没有隐藏错误物件。
- 自动化测试与人工验收：

| 检查项目 | 本轮实际结果 |
|---|---|
| 复现与完整性回归 | 修复前裸底覆盖和孤墙归属两项失败；修复后新增 5 项回归通过，包含矩形精确分区、路网连通、重复实体、异常变换、长条归属及建筑道路分离检查。 |
| `npm test` | 777/777 通过，退出码 0。 |
| `npx tsc --noEmit` | 通过，退出码 0。 |
| `npm run build` | 通过，退出码 0；既有大于 500 kB 提示非阻断。 |
| `git diff --check` | 通过，退出码 0；LF/CRLF 提示非阻断。 |
| 浏览器复核 | 当前 Debug 全景及上、右、下、左、四角逐一检查，正式菜单截图已保存；未进行双阵营完整玩法重验。 |
| 用户人工验收 | 待确认，不更新 Gate。 |

- Git 检查点：未暂存、提交、推送或创建 Tag；此前所有未提交成果和验证材料保留。
- 已知限制与下一项任务：检查覆盖范围内未再发现孤墙、地块裂缝或异常变换；外围仍较空旷、低细节，本轮不增加美术内容。未修改主住宅、玩法、配置、碰撞、导航、AI、UI 或角色；仅等待本轮完整性人工验收。

---

## 2026-10-03｜住宅东翼扩建与外围街区加密：待人工验收

- 阶段与日期：用户当次任务「扩大真正可游玩的住宅 + 提高外围街区建筑密度」，实施于 2026-10-03。不是 S8 开工；**未通过用户集中人工验收**，**未进行 Git 归档**。
- 完成内容：
  - **主住宅东翼扩建**（`src/three/map/apartmentMap.ts`）：在**不改动原有 12 个房间任何坐标**的前提下新增 6 个空间——北阳台 `north_balcony [9,18]×[-15,-12]`（回收原先被墙封死、不可达的空洞）、南走廊 `south_hall [12,15]×[5,15]`、东走廊 `east_hall [15,18]×[0,15]`、客房 `guest_room [18,24]×[-15,-4]`、家政间 `utility [18,24]×[-4,3]`、车库 `garage [18,24]×[3,15]`。房间 12 → 18（主要空间 10 → 15）、门 18 → **31**、家具 20 → **32**、`MAP_WIDTH` 36 → **48**（X `-24…24`，Z 不变）。
  - **为什么是 48 而不是 46**：`CollisionWorld.canOccupyStaticXZ()` 与 `NavigationSystem.point()` 的世界盒**永远关于原点对称**（只接受 halfWidth / halfDepth，没有中心偏移参数）。外部顾问 Codex 的只读审查指出了这一点：若按 46 宽实现，东翼会落到盒外，`x = 23` 的两扇横向门在真实碰撞与导航里根本不可通过。东翼东端因此取 `x = 24` 正好贴住盒边；西侧多出的 `x ∈ [-24,-18]` 是外墙之外的**不可达余量**。`MatchRandom.spawnCandidates()` 的每个候选都必须通过 `roomAt(x,z) === room.id`，所以盒外余量不会产生出生点（已核对源码，不是推测）。
  - **拓扑**：新增 3 条环路（共 6 条）——东南大环 `玄关→南走廊→东走廊→餐厅→玄关`、东翼环 `东走廊→家政间→客房→北阳台→储物间→东走廊`、北侧环 `客厅→厨房→北阳台→阳台→客厅`。东翼与老宅有四个互相独立的接合点，每个新空间至少两扇门；「屏蔽任意单扇门后 18 个区域仍全连通」（2-边连通、无桥）由 `tests/apartment-map.test.mjs` 强制。
  - **Gameplay 重新分布**：新增 12 件家具（两条 3 单位宽走廊里的边柜贴单侧墙，留出的通道仍宽于两个角色直径；车库里的一辆车把空间分成西侧车道与东侧通道）。米点总数**保持 14**（`GAME_CONFIG.rice.candidateCount` 未改），新翼 3 个米点是**从原本各有 2 个的客厅 / 餐厅 / 厨房各匀出来的一个**，不是新增候选。**藏身点保持 8 个不变**，ID / 锚点 / `facing` / DEV-A 交互区域参数一个都没改，新翼家具全部是普通家具。
  - **外围街区加密**（`src/three/ResidentialExterior.ts`）：在不新增任何 `parcel` / `road-` 矩形、不新增 `walk-` slab、不使用 `rotation` 的前提下，新增 **8 栋沿街住宅**（主街西侧 3 栋共墙连体、街对面 3 栋含 1 栋 16 宽低层公寓、服务巷北侧 2 栋补在既有两栋之间）、4 段院墙 + 5 段绿篱、4 棵行道树、2 盏路灯，合计新增 125 个 mesh（exterior children 196 → 321），形成连续沿街街区而不是孤立房屋。
- 自动化测试与人工验收：

| 检查项 | 本轮实际结果 |
|---|---|
| `npm test` | **777 / 777 通过**，退出码 0（未新增或删除用例） |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；77 个模块，JS 1,042.00 kB；既有 >500 kB 分块提示非阻断 |
| `git diff --check` | 通过，退出码 0；仅 LF/CRLF 提示，不是失败 |
| 东翼导航可达性 | 由既有 `tests/match-random.test.mjs` 的「200 seeds 全部出生点 / 米点 / 房间 / 藏身锚点真实导航可达」覆盖，扩建后仍通过；**未另造第二套判据** |
| 用户集中人工验收 | **尚未进行**；本轮以「完成后停止、等待人工验收」收尾 |

- 被改写的既有测试（均属**地图设计变更**的必然同步，不是为了让测试变绿而放宽断言）：
  - `tests/apartment-map.test.mjs`：主要空间 10 → 15、房间 12 → 18、`MAP_WIDTH` 36 → 48（并注明世界盒必须原点对称）。
  - `tests/hide-spot.test.mjs`：`FURNITURE.length` 20 → 32（藏身点仍断言 8 个，未改）。
  - `tests/scene-editor.test.mjs`：可编辑对象 28 → 40、家具 20 → 32、房间 12 → 18、门 18 → 31。另有三处坐标场景因扩建调整：`dining_table` 由 `(13.2, 3.5)` 改为 `(13.2, 3.2)`（新 `door_dining_south_hall` 在 x = 13.5，3.5 会把该门洞堵成不可达，**实测**拒绝码 `ROOM_UNREACHABLE@door_dining_south_hall`）；「堵死房间以验证连通性规则」的场景由储物间改为**车库**（储物间扩建后有了第三扇门，两件家具已堵不死；车库仍是两扇门，**实测**能稳定触发 `ROOM_UNREACHABLE`）。
  - `tests/s7d-full-match.test.mjs`：「玩家藏身后被 Human AI 搜出」的种子由 `20276765` 改为 `20284684`。原因是门数 18 → 31 会改变 `createMatchSetup()` 在抽米之前的随机数消耗，**同一 `matchSeed` 不再复现扩建前布局**（扩建的预期兼容性变化）。本轮另扫描 18 个种子核对：**18/18 都能正常结算**（无超时），其中 **8 个仍走通完整「藏身 → 公开线索 → 正式家具搜查 → 搜中」链路**，因此不是玩法退化，只是该种子的场景漂移。
- 已知限制与下一项任务：
  - **外围未实现的部分**（用户清单中属「可以增加」的可选项）：车棚 / 独立车库 / 停车位、第二家小店前脸、东侧支路排屋、内侧第二排、可玩住宅后院围篱。既有停车棚、汽车、自行车、街角商店仍保留。
  - **菜单全景取景尚未核实**：`homeFrustum()` 只接收 `MAP_DEPTH`，菜单高度 `max(mapDepth + 10, 52 / aspect)` 恒保证横向 ≥ 52 世界单位，理论上 48 宽可容纳，但在 aspect ∈ (1.3, 1.51) 附近可能裁掉最东侧。本轮要求先在浏览器实测再决定是否改取景公式，**不做猜测性改动**。
  - **DEV 场景编辑器本地存档**：旧存档会因房间 / 门 / 家具数量与稳定 ID 不一致而被拒绝并回落授权地图（既有行为），本机 localStorage 里的旧布局需重新保存。
  - 新增 3 个米点后，一局至少抽到 1 个新翼米点的概率约 77%，平均取米距离变长；**本轮未改任何 `GAME_CONFIG` 数值**，是否需要 Balance Pass 留待用户后续单独决定。
  - `GAME_CONFIG` / AI 控制器 / 输入 / 碰撞求解 / 导航 / 门系统 / 米堆规则 / 胜负条件 / 玩家声音可视化停用状态：**全部未改**。
  - 本轮同时更新了 `docs/MAP_SPEC.md`（外轮廓、18 个区域表、6 条环路、家具、米点分布、藏身点不变说明）、`docs/DEEPSEEK_HANDOFF.md`、`docs/DEV_SCENE_EDITOR_DESIGN.md`、`docs/GAME_BALANCE_CONFIG.md`。
- Git 检查点：**未暂存、未 commit、未 push、未创建 Tag**；未 force push、未 reset / clean / stash / amend / rebase。开工前工作区已有的未提交 Alpha 表现轮改动与未跟踪验证材料原样保留。

---

## 2026-10-04｜浏览器复核与菜单取景修复（承接东翼扩建轮）

- 承接上一条「住宅东翼扩建与外围街区加密」。本条只记录**真实浏览器复核结果**，以及由它复现出的一个缺陷及其修复。
- 浏览器复核（Tabbit Browser，复用已在运行的 `http://127.0.0.1:5173/`；逐张证据、自建复核页与全部命令见 `docs/verification/EAST_WING_EXPANSION/README.md`）：
  - **两局真实对局都打到结算**：Human 玩家（seed 20268846）→ DeepSeek 娘 `RICE_COMPLETED` 00:46；DeepSeek 娘玩家（seed 8）→ 人类 `CAPTURED` 00:27。玩家一侧由脚本**真实保持按键**（`keyboard.down … up`，1500 ms 请求 / 1503–1528 ms 实际）驱动，**不是真人试玩**；两局 `matchSummary.anomalies` 均为空。
  - **环境限制（影响口径）**：本机 Tabbit 为软件渲染，帧率与像素数强相关（1920×1080 ≈ 2 fps），而 `GAME_CONFIG.match.maxFrameDeltaMs = 50` 会把低帧率直接换算成游戏时间变慢（3 秒 READY 曾耗掉 59.9 秒真实时间），因此两局实际跑在 640×480 / 800×600。
  - **AI 进入新房间（只列实际观察，不外推）**：DeepSeek AI 观察到进入 `east_hall`、`garage`（并在车库吃完 `rice_07`）；Human AI 的路径目标经过 `south_hall → east_hall → garage`，并**在车库内完成抓捕**（最后目标点 (18.6, 6.3) 落在车库范围内）。`guest_room` / `utility` / `north_balcony` 本轮**未观察到进入**（该种子未激活对应米点，AI 没有去的理由）；**未观察 ≠ 进不去**。
  - **8 向 + 建筑近景巡检全部 OK**：未出现异常三角面 / 道路破面 / 孤立长条 Mesh / 残缺地块 / 悬空物件 / 建筑压到道路。该判定基于约 1066×600 的缩略预览，属「未看到」而不是「逐三角形证明无缺陷」。
  - **控制台**：无 pageerror / console.error / requestfailed；除既有 `THREE.Clock` 弃用告警外，多出一条**既有表现轮遗留**的告警 `THREE.WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead.`（`ThreeGame` 设了 `shadowMap.type = PCFSoftShadowMap`，当前 three 版本已移除该类型并静默回落到 `PCFShadowMap`）。**本轮未改动，仅记录。**
- **由复核复现并修复的缺陷：faction-select 菜单全景会裁掉新东翼。**
  - 现象与判据：用与 `ThreeGame` 同一条 FACTION_SELECT 相机路径的标记探针实测，16:9（1920×1080）下东翼最东北角 `(24, −15)` 落在右视锥面之外 **0.55 视图单位（1920px 下约 15px）**；1280×1024（aspect 1.25）下明显可见被切；本机原生 2032×982（aspect 2.0692）不裁。普通菜单截图肉眼分辨不出这 15px，因此判据取自标记探针与解析值。
  - 根因：等距正交镜头的水平轴是 `u = (x − z)/√2`，决定整张平面图能否进画的是地图的**对角跨度** `(48 + 30)/(2√2) ≈ 27.6`（中心两侧各 27.6），而原 `homeFrustum()` 的 `52 / aspect` 只保证宽度 ≥ 52 世界单位；菜单取景中心偏右（`center = .62`），右半只有 `0.38 × width` 可用 → 需要 `height ≥ 27.6 / 0.38 / aspect ≈ 40.8`（16:9），原来只有 40。
  - 修复：`homeFrustum()` 新增**可选**第 5 参数 `mapWidth`（缺省 0 = 旧行为，既有四参数调用与断言完全不变），菜单高度改为 `max(mapDepth + 10, 对角跨度 / min(center, 1 − center) / aspect, 52 / max(aspect, .5))`；`ThreeGame.resize` 传入 `MAP_WIDTH`。
  - 回归：`tests/alpha-presentation.test.mjs` 新增两项断言，锁定「传入 `MAP_WIDTH` 后菜单左右两侧都必须覆盖对角跨度」，并保留四参数调用的 `top − bottom === 40` 断言。
- 自动化测试与人工验收：

| 检查项 | 本条实测结果 |
|---|---|
| `npm test` | **777 / 777 通过**，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；77 个模块，JS 1,042.09 kB；既有 >500 kB 分块提示非阻断 |
| `git diff --check` | 通过，退出码 0 |
| 真实浏览器 | 见上；证据目录 `docs/verification/EAST_WING_EXPANSION/`（38 张 PNG + 自建复核页 `rooms.html` / `menu-crop.html` + 驱动脚本 + README） |
| 用户集中人工验收 | **尚未进行** |

- 已知限制与下一项任务：① **菜单取景修复后尚未重新截图复核**（现有裁切探针图为修复前的 `30-menu-crop-*`），需在下一轮浏览器复核中确认 16:9 与 4:3 不再裁切；② `guest_room` / `utility` / `north_balcony` 缺少 AI 进入的直接观察（已备好 seed 5 的补跑方案但未执行）；③ 软件渲染导致高分辨率真实对局不可用；④ 未改任何 `GAME_CONFIG` 数值；**未 commit / push / Tag**。

## 2026-10-04｜Gameplay 住宅「区域级放大」与外围建筑 parcel 约束：待人工验收

- 任务名称：按用户的方向修正，把整个 Gameplay 住宅的**空间尺度**放大（而不是继续增加房间），并修掉外围住宅的穿模。当前阶段：地图专项轮，**不是 S8**；未 commit / push / Tag。
- 用户边界（原话要点）：「我要的是：**保持住宅现有区域结构和功能关系，同时把整个 Gameplay 住宅的空间尺度放大**……房间更宽、走廊更宽/更长、家具之间距离更大、门之间距离更大、角色活动空间更大、追逐空间更舒展，而不是单纯增加很多小房间」；「**具体倍率不要机械统一，根据住宅平面重新排布**」；「不要简单所有坐标 ×1.5」；「**家具不要跟着房间同比放大**……房间扩大后通过家具间距、留白、动线、局部组合填充空间」；「重点增加的是『每个区域内部的 Gameplay 空间』」；「不要出现一个房间同一面墙挤着多扇门 / 门紧贴家具 / 门紧贴墙角」；「重新检查 31 扇门是否仍然必要……**可以提出精简建议，但不要擅自改变核心拓扑**，最终报告告诉我」；「不要继续增加外围建筑数量……建立明确的 Building Parcel / Footprint 约束」；「不要修改 Gameplay 平衡数值：移动速度、冲刺速度、抓捕距离、AI 感知距离、技能 CD、AI 判据、S7D 逻辑」；「内部完成方案后直接实施，不需要停下来问我」；「本轮不要 commit / push / Tag。完成后停止等待人工验收」。
- 实施方法（拓扑逐条保全）：把由 `ROOMS` 边界唯一化得到的旧网格线逐条映射到一组新网格线，每个房间仍由**同一组网格线下标区间**定义，因此房间类型、邻接关系、31 扇门的配对、6 条环路与东翼结构是**构造上保证**不变，而不是「改了以后测试还没发现」。这与「所有坐标 ×1.5」的 uniform scale 有本质区别。
- 地图规模与面积：`MAP_WIDTH 48 → 56`、`MAP_DEPTH 30 → 38`，平面**重新以原点为中心**（旧图 X `-18…24` 中心是 `+3`，世界盒却是 `-24…24`，西侧多出 `x ∈ [-24,-18]` 一段被外墙封死、不可达的余量，本轮收回；世界盒仍必须关于原点对称，因为 `CollisionWorld` / `NavigationSystem` 只接受 halfWidth / halfDepth）。房间总面积 `1143 → 1950`（×1.71）；18 个区域的面积倍率区间 `1.47–1.87`，主客厅 `12×15 → 16×20.5`(×1.82)、主卧 `9×10 → 12×14`(×1.87)、厨房 ×1.80、储物间 ×1.78 在上档，阳台 ×1.47、北阳台 ×1.56、次卧/书房/南走廊 ×1.60、东走廊 ×1.64、玄关 ×1.65、车库 ×1.61 在下档。用「区域级」而非「统一倍率」是刻意为之：只把两端**只服务附属空间与走廊端点**的分带各收 0.5，把总面积倍率从 1.78 压到 1.71，同时把倍率区间从 `1.71–1.87` 拉成 `1.47–1.87`。
- 家具：**一件都没有放大**（仍是同一套人物比例的白模），只补了 8 件普通家具，32 → 40 件。新增 `main_nightstand` / `main_dresser`（主卧）、`closet_shelf`（衣帽间）、`storage_rack`（储物间）、`bath_toilet`（卫生间）、`second_desk`（次卧）、`entry_shoe_rack`（玄关）、`guest_desk`（客房），全部**不绑定藏身点**、全部避开门的接近点、全部留在场景编辑器白模合法范围内（宽/深 0.2–4、高 0.1–1.6）。多出来的面积因此全部变成可活动空间与家具间距。
- 门：**31 扇门全部保留、ID 与配对一个未改**。门中心仍由 `makeDoor()` 取共享边中点，所以房间一放大门距自然拉开、门也不贴墙角：门洞恒为 `1.2`；最窄共享边是 `balcony↔kitchen` 与 `storage↔dining` 的 `2.5`（门叶两侧各剩 `0.65` 墙垛）；同墙最近门对是阳台东墙的中心距 `2.75` / 门洞间净墙段 `1.55`；其余同墙门对中心距 `4.00–10.25`，没有任何两扇门洞相邻。
- 米点 / 出生点 / 藏身点：米点仍 **14 个**、房间归属一个未改（只跟着放大的房间重新落到合理位置）；藏身点仍 **8 个**，ID / kind / 绑定家具 / DEV-A 交互区域参数（2.0 / 1.6·55° / 1.2）一个未改，锚点跟着各自家具搬家并按同一 `atan2` 公式重算 `facing`（实测：主床 `(-22.90, -7.65)`/0.6877、次床 `(-22.90, 11.40)`/0.6660、主卧衣柜 `(-25.15, -9.50)`/-2.6099、衣帽间 `(-9.20, -10.70)`/1.1072、书房书柜 `(-8.70, 17.35)`/0.9828、储物货架 `(18.60, -5.00)`/-0.8379、客厅纸箱 `(-5.40, -8.60)`/-1.5708、储物纸箱 `(17.75, -12.50)`/3.1416；距最近门段 3.00–10.66、距最近米点 2.68–8.11，全部满足 ≥2.0 / ≥1.2）。参考出生点：DeepSeek 玄关 `(7, 11)` 不变；Human 厨房 `(12.5, -6.5) → (12.5, -3.5)`——放大后 entry↔kitchen 的参考间距从 `14.7` 涨到 `18.3`，超过了 `perception.sounds.FOOTSTEP.range`(17)，默认这一对会互相听不到脚步声，南移后回到 `15.5`（仍 > `matchRandom.minSpawnDistance` 10）。
- 顺带修掉一个真实缺陷：新平面里 `door_hall_bathroom`(z=3.75) 与 `door_dining_east_hall` 落在分带中段，使 `buildWalls()` 生成了一段 **0.15 长的墙垛**；`MapBuilder` 渲染墙时按「短轴」放大 `HOME_COMPOSITION.wallThicknessScale`(1.8)，而 0.15 < 墙厚 0.18，于是被放大的是**墙长**而不是墙厚，向门洞内溢出 0.06，门框立柱与墙穿模（`tests/door-visual-clearance.test.mjs` 报 `door_hall_bathroom frame jamb-left overlaps wall_015`）。修法：`buildWalls()` 生成后**合并同一中心线上首尾相接的墙段**，从源头消除退化短垛；墙的实际位置不变，墙段数 129 → 55。
- 外围街区（用户第 7、8 节）：`src/three/ResidentialExterior.ts` 重写为显式 **Parcel / Footprint 模型**——新增 `FootprintRect` / `BuildingUnit` / `BuildingGroup` / `ResidentialLayout` / `describeResidentialLayout()` / `assertResidentialLayout()`，以及 `MIN_BUILDING_GAP = 4`、`PARCEL_SETBACK = 1.6`、`PLINTH_MARGIN`、`ROOF_OVERHANG`、`RESERVED_SURFACE_PATTERN`、`GREENERY_PATTERN`。联排住宅改为**共享整段基座 + 明确分户墙**（不再是多个扩大的基座互相穿插），所有坐标改为**从住宅 bbox 推导**（不再写死绝对值），建筑数量**没有增加**（3 个联排组 + 4 栋独立 = 12 栋）。
- 外围自动检查（`tests/residential-exterior-geometry.test.mjs`，10 → 15 项）：新增「建筑 body/roof/plinth 必须完全落在自己的地块内并留真实 setback」「地块之间互不重叠」「建筑 footprint 不压道路/人行道/路缘/停车/绿化/可玩住宅」「同排单元共分户墙、非相邻单元与不同建筑在 body/roof/plinth 三类包络上都满足最小净距」「整块街区会随住宅 bbox 变化重建（对 1.5 倍放大的房间也跑一遍规则）」四组真实断言；既有的地块铺满、道路单一连通、所有 mesh `rotation === 0`、无重复包围盒、站立物落地、`-plinth` 不压道路、`*wall` 必须成院等检查全部保留。
- 相机与编辑器边界：`homeFrustum()` 的菜单高度公式已在上一条目修好并按 `MAP_WIDTH` 覆盖整图对角跨度，本轮 `MAP_WIDTH 56 / MAP_DEPTH 38` 的对角跨度 `33.23` 在 16:9 / 16:10 / 4:3 / 5:4 下都被左右两侧覆盖（由 `tests/alpha-presentation.test.mjs` 的断言锁定为 `homeFrustum(16/9, true, 14, 38, 56)`）；场景编辑器的导航格心与校验网格全部由 `MAP_WIDTH` / `MAP_DEPTH` 推导，可编辑对象 40 → 48，**没有改编辑器行为、拒绝码或存档格式**。**`GAME_CONFIG` 一个数值都没有改**（`viewHeight` 保持 14、`playViewScale` 保持 1.3）。
- 只读顾问 Codex：按用户要求让 Codex 只读审查「放大后的区域比例是否合理、是否破坏拓扑、外围建筑是否重叠」。它**独立核算**确认「新旧房间的 36 组几何共享边关系完全相同、31 门配对不变、没有任何共享边 ≤1.2、所有共享边都比旧图变长」。**已采纳**：总面积倍率 1.78 → 1.71、各区域倍率去机械化、外围改用 parcel + 最小间距模型并新增跨建筑重叠检查。**未采纳并记录**：① 三扇门可精简（`balcony↔kitchen`、`storage↔dining` 首选，`dining↔south_hall` 次选）——属于拓扑修改，按用户「不要擅自改变核心拓扑」保留全部 31 扇；② Gameplay 相机 `viewHeight` 14 → 15.0——可见范围会影响玩家决策，按「发现现有数值不适合先记录、不擅自调」只记录。
- 自动化测试与人工验收：

| 检查项 | 本条实测结果 |
|---|---|
| `npm test` | **782 / 782 通过**，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0（既有 >500 kB 分块提示非阻断） |
| `git diff --check` | 通过，退出码 0 |
| 一次性探针（跑完即删） | 真实 `CollisionWorld` / `NavigationSystem` / `DoorSystem` 上 `ALL CHECKS PASS`：18 房间互不重叠、31 门墙洞恒 1.2 且中心与两侧接近点可站立、屏蔽任意单门后仍全图可达、40 件家具全部在房内且不重叠、0.3 网格 BFS 覆盖全部房间/14 米点/2 出生点/31 门与 62 接近点、8 个藏身锚点全部满足门距 ≥2 与米距 ≥1.2 且 `facing` 反算一致 |
| 整局种子扫描（逻辑仿真，非实机） | 31 个种子（Human AI 主动抓捕、玩家挂机）里 **28 个结算、3 个**（`20263151` / `20292603` / `20261234`）在 150 秒帧数上限内仍停在 `PLAYING`；`tests/s7d-full-match.test.mjs` 因此把原用的 `20292603` 换成本轮确实结算的 `20260411`（约 39 秒） |
| 真实浏览器（DPH 自测，非人工验收） | 证据目录 `docs/verification/MAP_SCALE_UP/`：9 张 PNG（放大前/后平面图、整图全景、住宅全景、客厅/主卧/走廊/东走廊近景、外围街区近景）+ 自建复核页 `view.html` / `plan.html` + 驱动脚本 + README |
| 用户集中人工验收 | **尚未进行** |

- Git 检查点：**未 commit / push / Tag**；按用户要求完成后停止，等待人工验收。
- 顺带发现（**不是缺陷，但会改变藏身玩法难度，需要用户评估**）：房间放大约 1.7 倍而家具尺寸没变，家具与墙之间不再形成放大前那种「站得住、却被墙隔在家具表面之外」的几何。把 0.02 步长的格点扫过全部 8 个藏身交互区域（约 5 万个「可站立且在区域内」的点）后，**没有任何一点**会得到 `SURFACE_BLOCKED` 或 `NOT_NAVIGABLE`；全图扫描只在车库 `(27.0–27.4, 4.9)`（家政间|车库 隔墙与 `garage_workbench` 之间）与客房 `(27.1–27.4, -18.5)`（`guest_wardrobe` 与外墙之间）两处找到这类窄缝，而它们都不是藏身区域。因此这两个拒绝码现在只能靠测试里**人工搬动一件家具**才能构造（`tests/hide-interaction-region.test.mjs` 沿用该文件既有的「搬家具改样本」写法重建，四条断言 `insideRegion / standable / legal / code` 一字未改；`tests/human-ai-stance-approach.test.mjs` 的首条用例也从主卧床改成同样真实、仍然错位超过 `waypointTolerance` 的次卧床（实测吸附偏差 0.313 → 0.349），断言本身未改）。**本轮没有因此改动任何藏身参数**。
- 已知限制与下一项任务：① 外围街区「连续感」与放大后的追逐手感**都需要用户人工跑图确认**，自动化只能保证几何不重叠、不压道路、连通与可达；② 三个种子在 150 秒上限内不结算，是「地图变大但平衡数值一个未改」的观测量，是否需要 Balance Pass 由用户决定；③ 藏身判定在放大后变得更宽松（`SURFACE_BLOCKED` / `NOT_NAVIGABLE` 在授权地图上已不可达），同样需要用户评估；④ Codex 早已提醒 `east_hall`(4×18.5) 纵横比 4.6:1 仍偏长，可能形成较强的直线追逐轴，本轮未改；⑤ Codex 建议的门数精简与 `viewHeight` 调整都只记录、未采纳；⑥ 旧场景编辑器本地存档会因「是否同一张地图」核对失败而被明确拒绝并安全回退，这是预期行为；⑦ 导航格数随世界盒从 `48×30` 增到 `56×38`（约 +48%），本轮未做 A* 性能基准。

### 2026-10-04 — 外围建筑间距与社区篮球场（待用户验收）

- 完成内容：核实住宅世界盒由 `apartmentMap.ts` 的 `MAP_WIDTH / MAP_DEPTH` 控制，18 个房间由 `ROOMS` 的边界坐标定义。房间面积合计 1950，相对上一轮 1143 为约 1.706 倍；不存在 1.71 倍运行时缩放开关。本轮未修改这些地图数据。
- 外围调整：原连排建筑屋顶零间距贴合，改为主体间距 2.4、屋顶净距 1.6；调整北侧建筑位置，仍保留 12 栋背景建筑。延长的院墙设置入口，避免单根过长墙条。没有将投影重叠直接认定为实体穿插。
- 篮球场：新增独立 `CommunityCourtView`，在西北侧设置 24×13 的低饱和球场，包含场线、双篮架、围网、长椅、灯具、花箱及衔接既有人行道的入口。全部属于背景表现，不注册碰撞、导航、房间或交互。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 784/784 通过，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留既有大于 500 kB 分块提示 |
| `git diff --check` | 通过；仅有既有 LF/CRLF 提示 |
| 浏览器自检 | 已查看全景、左侧、左上球场、建筑近景及真实正式菜单；截图留在外部视觉工作区，不冒充用户验收 |
| 用户人工验收 | 待确认 |

- 技术记录：首次全量测试暴露旧测试按根节点直接子物件统计几何的假设；改为遍历真实层级后，球场分组也纳入相机裁切和资源释放检查，完整复跑通过。新增相邻建筑实际 Mesh 不穿插、球场与道路/建筑/玩法区域隔离及入口连接测试。
- Git 检查点：未暂存、未 commit、未 push、未创建 Tag；保留之前地图扩建及视觉/UI 未提交成果。本轮未修改 `GAME_CONFIG`、核心地图、S7D AI、碰撞或导航。
- 已知限制与下一项任务：正式菜单只能看到球场的一部分，完整构图使用外围复核页；球场是不可交互的背景，不包含篮球玩法。等待用户检查建筑间距与球场构图，不据此宣称之前的地图扩建整体验收通过。

### 2026-10-05 — 紧凑交互提示与阵营卡直接进入（待用户验收）

- 完成内容：在既有雨后蓝 UI 工作副本上，将世界交互提示（World Prompt）的键帽从 35px 缩为 22px，减少留白并隐藏次级说明，保留 E 键、短文字、淡入缩放及按压反馈。交互目标继续使用既有 E 仲裁，不改变玩法优先级。阵营卡改为原生按钮，直接调用 `chooseFaction()`，移除 Radio 与二次确认；悬浮上移 6px、放大至 1.02，并增加错位柔和投影和箭头过渡，保留减少动画偏好支持。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 791/791 通过，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；既有大于 500 kB 分块提示 |
| `git diff --check` | 通过，退出码 0；既有 LF/CRLF 提示 |
| 浏览器自检 | 已查看无确认按钮的阵营页、真实 Hover 变换和 DeepSeek 对局中紧凑的“E 躲藏”；截图保存在外部视觉工作区 |
| 用户人工验收 | 待确认，不将浏览器自检替代人工验收 |

- Git 检查点：未暂存、未提交、未推送、未创建 Tag。保留既有 UI 工作与阴影诊断页；本轮没有修改环境、地图、`GAME_CONFIG` 或 AI。
- 已知限制与下一项任务：等待用户检查提示大小与双阵营卡手感；未逐一拍摄所有 E 文案和快速按压动画，不宣称完成整局玩法回归。此前异常阴影尚未定位，本轮未继续处理。

### 2026-10-05 — 修复返回阵营选择时菜单未显示

- 根因与修复：阵营菜单改为按钮后，`returnToFactionSelect()` 仍通过非空断言访问已删除的 Radio 输入框；查询返回 `null` 后抛错，后续显示菜单的代码没有执行。删除过期的 Radio 状态赋值，保留菜单显示与原有重置流程。
- 验证：新增回归断言，确认返回流程不再查询 Radio 并会显示按钮菜单。`npm test` 792/792 通过；`npx tsc --noEmit`、`npm run build`、`git diff --check` 均通过。浏览器实际执行“开始对局 → Esc 暂停 → 返回阵营选择”，阵营选项立即出现，无需刷新。
- Git 检查点：未暂存、未提交、未推送、未创建 Tag。本轮仅修改返回菜单相关代码、回归测试及本条日志；保留其他未提交成果。

### 2026-10-05 — Human 玩家门锁破解改为 PulseLock（待用户验收）

- 完成内容：Human 在 ACTIVE 锁门旁按 E 打开紧凑的三锁芯时机面板；脉冲进入目标框时再点按 E 完成当前锁芯。失手仅重置当前脉冲，已完成锁芯在退出、重进后保留。三芯完成后调用 `DoorSystem.disableLock()`，锁门变为 CLOSED，仍需正常开门。面板期间 Human 位移锁定、世界及 DeepSeek AI 继续运行；Esc / × 可退出。Human AI 保留自己的耗时/概率解锁，不读取玩家面板状态。正式运行链路已移除 4×4 扫雷棋盘、翻格与插旗代码；旧扫雷纯逻辑文件及专属测试删除，旧配置数值原样保留但不再参与玩家解锁。
- 新增可调项：`GAME_CONFIG.pulseLock.timing` 管理三个锁芯、轨道单程 1,400ms、目标宽度 0.20、三个归一化目标中心及 240ms 反馈。均为本轮新增项；门锁、AI、抓捕、速度等既有平衡值未调整。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 785/785 通过，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留既有大于 500 kB 分块提示 |
| `git diff --check` | 通过，退出码 0；仅有 LF/CRLF 提示 |
| 浏览器自检 | 在真实 `ThreeGame` 对局循环中设置已锁门：E 面板开启、世界时间推进、失手、完成一芯、× 退出重进、三芯后权威解除锁均核实；截图保存在系统临时目录 |
| 用户人工验收 | 待试玩确认，浏览器自检不代替用户验收 |

- Git 检查点：未暂存、未提交、未推送、未创建 Tag；既有未提交 UI 与验证材料保留。
- 已知限制与下一项任务：浏览器自检采用临时锁门场景，尚需用户在自然追逐中确认 2～5 秒手感、面板位置与按键反馈。旧扫雷配置值仅因本轮“不改变已验收数值”要求保留，后续是否清理需单独决定；不据此宣布本专项 Gate 通过。

### 2026-10-05 — 正式 UI 工业信息风重构（待用户验收）

- 完成内容：统一石墨黑、冷白、蓝青和警示黄视觉变量，重构非对称阵营菜单、双阵营 HUD、直线冷却条、紧凑 E 提示、PulseLock、暂停和结算表现。阵营卡以原生按钮直接进入对局，悬停使用上浮、错位阴影和遮罩色块。菜单与报告模板独立为 `GameUiLayout`，旧 `rain-ui.css` 保留但不再载入。未修改环境、地图、AI、正式配置或 PulseLock 核心判定。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 790 项中 788 通过、2 失败，退出码 1 |
| 定向 UI / HUD / PulseLock 测试 | 11/11 通过，退出码 0 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留大于 500 kB 分块提示 |
| `git diff --check` | 通过，退出码 0；有 LF/CRLF 提示 |
| 浏览器自检 | 已检查菜单悬停、双阵营进入、真实 HUD、暂停和返回菜单；较小窗口的两张阵营卡均在视口内 |
| 组件样例 | E 提示、PulseLock、WIN / LOSE 使用正式组件与固定数据截图，不作为自然对局证据 |
| 用户人工验收 | 待统一验收 |

- Git 检查点：本轮未暂存、未提交、未推送、未创建 Tag，保留其他既有修改及验证材料。
- 已知限制与下一项任务：`human-ai.test.mjs` 仍期待 0.92，而当前配置为 0.52；`s7d-full-match.test.mjs` 报 Human AI 未发起正式家具搜查。两项测试不载入本轮 UI，不擅改配置或 AI 以通过门禁。自然对局的全部 E 操作、PulseLock 成败及完整胜负流程尚待用户复验；不宣布完整门禁或阶段 Gate 通过。详细复核说明见 `docs/verification/INDUSTRIAL_UI/README.md`。

### 2026-10-05 — UI 第二轮层叠与阵营识别校正（待用户验收）

- 完成内容：保留现有功能接线，以局部裁切底板、错位后板、大编号和双色强调替换平整网页卡片观感；两阵营卡悬停向左上移动并显露后板。HUD 改为分段小底板，E 提示保持小尺寸，PulseLock 改为暖白而不修改时机判定。环境、地图、角色、配置与 AI 均未改动。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 788/790，退出码 1；仍为前条记录的两个 AI 用例失败 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留大于 500 kB 提示 |
| 浏览器 | 真实菜单及双阵营 Hover 已复核；E、PulseLock 为正式组件固定样例，不代表自然玩法验收 |

- Git 检查点：未暂存、未提交、未推送、未创建 Tag。
- 已知限制与下一项任务：等待用户确认第二轮视觉；已有 AI 测试失败未越界处理，不宣布 Gate 通过。

### 2026-10-06 — 用户指定 UI Sheet 正式素材接入（待人工验收）

- 完成内容：逐张审查 `public/ui/` 六张原始 Sheet；仅从原图裁出 15 张不带动态文字的面板、HUD、按钮、锁芯轨道及纸纹图片，原图保留不变。`src/sheet-ui.css` 以九宫格切片和局部底片接入现有菜单、阵营卡、双阵营 HUD、世界 E 提示、PulseLock、暂停与结算；动态米数、时间、技能、脉冲和胜负数据继续由既有系统实时驱动。素材来源、用途与裁切脚本见 `public/ui/README.md`。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| `npm test` | 789/791 通过，退出码 1；仍为 Human AI 当前配置 0.52 与旧测试期望 0.92 不符，以及 S7D 整局搜查用例未发起正式搜查 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留既有大于 500 kB 分块提示 |
| `git diff --check` | 通过，退出码 0；仅有现有 LF/CRLF 提示 |
| 真实浏览器 | 阵营选择、双阵营 HUD、Q/Space 槽、暂停、返回菜单及自然结算已查看并截图 |
| 独立组件页 | 紧凑 E 提示、正式 `PulseLockView` 与独立 `PulseLockSystem` 的三轨道已查看；不冒充自然对局的门边解锁 |
| 用户人工验收 | 待确认 |

- Git 检查点：未暂存、未提交、未推送、未创建 Tag；原有其他任务改动和用户配置均保留。
- 已知限制与下一项任务：自然对局中的 E 提示与 Human 玩家到锁门旁打开 PulseLock 尚未获得本轮完整浏览器证据；两项 AI 自动化失败不属于 UI 素材改动，未为通过门禁而修改玩法。等待用户检查实际画面，不提前宣称 Gate 通过。

### 2026-10-07 — UI Sheet 素材集成修正（待用户复验）

- 用户反馈：首次素材接入人工验收为 FAIL；派生 PNG 的不透明 Sheet 底色形成矩形白边，技能槽与 E 提示像贴图，五格米饭由 CSS 椭圆绘制。
- 完成内容：保留六张用户原始 Sheet，修正可复现提取脚本，为 15 张派生视觉裁片制作透明异形边角，并降低 HUD 浅色纸底的不透明度；从 Sheet C 提取独立透明米饭碗，五格进度用同一碗图的灰度与透明度显示已吃状态。CSS 使用原裁片九宫格端部并调整小型 E 提示、技能槽和米进度的轮廓；米数、时间、技能 CD 与交互文字仍由现有 DOM 实时更新。未修改玩法、配置、AI、地图或 PulseLock 判定。

| 检查项目 | 本轮实际结果 |
| --- | --- |
| 素材校验 | 15 张非纸纹派生图均为 RGBA，透明外角通过检查；米饭碗中心不透明 |
| 定向 UI / 交互 / PulseLock 测试 | 16/16 通过，退出码 0 |
| `npm test` | 789/791 通过，退出码 1；仍为当前 0.52 与旧用例 0.92 不符、S7D 整局搜查未触发两项非 UI 失败 |
| `npx tsc --noEmit` | 通过，退出码 0 |
| `npm run build` | 通过，退出码 0；保留大于 500 kB 分块警告 |
| `git diff --check` | 通过，退出码 0；仅有 LF/CRLF 提示 |
| 真实浏览器 | DeepSeek / Human HUD、E 躲藏与离开、E 吃米、E 开门与关门、0/5 到 1/5 米饭均在真实对局观察并截图 |
| PulseLock 外观 | 正式 `PulseLockView` 独立组件页已截图；自然对局到锁门旁尚未取得截图，不冒充完成 |
| 用户人工验收 | 本次修正待复验；此前 FAIL 保留 |

- Git 检查点：未暂存、未提交、未推送、未创建 Tag；原有未提交任务、用户配置与六张原 Sheet 均保留。
- 已知限制与下一项任务：自然对局 PulseLock 视觉尚需用户或后续浏览器复验；两项非 UI 自动化失败未在本轮越界处理。等待用户集中复验，不据此宣布 Gate 通过。

### 2026-10-09 — DeepSeek 鲸鱼女仆角色资源替换（待集中人工验收）

- 完成内容：新建独立 DeepSeekMaidModel 纯视觉几何模块，复用 HomeAvatar 动作关节；玩家与 NPC 共用鲸鱼女仆形象。用户确认源合集截断后明确授权补画，分别保存 normal / win / lose 三张 RGBA PNG；源文件保留。首页接正常立绘，DeepSeek 结算图依据实际 winner 切换。Human 模型与玩法参数保持本轮开工状态。
- 自动化检查：npm test 793/795；两项既有 AI 用例失败（速度配置 0.52 与期望 0.92 不符、家具搜查未发起）。TypeScript、构建、diff 检查通过；未宣称全门禁 PASS。
- 浏览器检查：实际页面菜单三种窗口、键盘移动/转向/冲刺、Human 对局 NPC、合法床边按 E 藏身及退出已检查；正侧背/等距模型使用相同模型的浏览器检查场景。结算四种阵营组合为注入状态测试，未冒充自然完整对局。截图、脚本和素材 Alpha 结果见 docs/verification/DEEPSEEK_MAID/README.md。
- Git 检查点：未暂存、未 commit、未 push、未创建 Tag。
- 已知限制与下一项任务：程序化低多边形模型为参考造型近似，未达到离线雕刻模型的发丝/布褶精度；补画非无损裁切，等待用户集中视觉与动作验收。既有两项 AI 测试问题保留。

### 2026-10-09 — DeepSeek 娘圆润头型专项修正（待人工验收）

- 完成内容：在既有 `DeepSeekMaidModel` 中将面部与发帽主体由方盒结构换为可调顶点的低多边形椭球；脸颊略鼓、下巴收窄，五官贴合曲面；刘海与长发改用带弯曲和尖端的分束几何。女仆、鲸鱼元素及原有关节表现接口保留。Human 模型、角色物理根节点、玩法与配置未改。
- 浏览器证据：实际 Three.js 模型正面、侧面、45° 及正式游戏镜头截图位于 `docs/verification/DEEPSEEK_MAID/rounded-head/`。三视角均使用同一模型实现，不是概念图。
- 检查结果：模型相关测试 20/20；`npm test` 793/795，既有两项 AI 失败仍为速度配置 0.52 与旧断言 0.92 不符、家具搜查未发起；`npx tsc --noEmit`、`npm run build`、`git diff --check` 通过。
- Git 与后续：未暂存、提交、推送或创建 Tag；等待用户实际画面验收，不声明阶段 Gate 通过。

### 2026-10-09 — DeepSeek 娘 18,500 面 GLB 第三阶段游戏接入（待用户验收）

- 完成内容：将第二阶段独立中面数 GLB 按原哈希复制到 `public/assets/characters/deepseek/`；在 DeepSeek 玩家与 NPC 的共同视觉链路使用 `GLTFLoader`，成功后隐藏程序化形象，失败时保留原形象。统一缩放并使脚底落地；无骨骼 GLB 仅跟随整体移动和转向。未改 Human、物理、AI、地图或 GAME_CONFIG。

| 检查项目 | 实际结果 |
| --- | --- |
| GLB | 18,500 三角面、1 网格、1 材质、3 张内嵌 2048² PNG；11,916,012 字节；无骨骼动画 |
| 浏览器 | 双阵营进入、玩家与 NPC 加载、WASD/Space、DeepSeek Q 锁门、Human Q 搜查空挥、E 进食/开门/藏身与退出、故障回退均已核对；脚本与截图见 `docs/verification/DEEPSEEK_GLB_STAGE3/README.md` |
| 性能样本 | 相同种子与视角，GLB / 回退版约 650 / 862 Draw Call，46,252 / 22,948 场景三角面；无头 Chrome 约 144 / 141 FPS，不能替代目标设备长测 |
| `npm test` | 794/796；仍是此前两项 Human AI 测试失败 |
| `npx tsc --noEmit` / `npm run build` / `git diff --check` | 均通过 |
| 用户人工验收 | 待确认 |

- Git 检查点：未暂存、提交、推送或创建 Tag；保留工作区原有其他改动。
- 遗留：GLB 是单一静态网格，无骨骼和行走动画；GPU 显存无法可靠测量，远景角色五官很小。等待用户检查实际浏览器画面与性能，不据此宣布阶段 Gate 通过。

### 2026-10-09 — DeepSeek 第四阶段比例调整与绑定测试

- 视觉 GLB 放大20%，玩家/NPC共用，脚底贴地。修改 AlphaPresentation.ts 与对应模型测试；未改玩法、Human、AI、地图或 GAME_CONFIG。
- 第三阶段 GLB SHA-256 保持 E32AC3CCC3253487EE7C026AD7887D1D7B0BEE0C9088F48CCE25637E1F2F7528。游戏仍使用静态版及程序化回退。
- Blender MCP 创建独立 stage4_rig 测试工程，23骨骼草案；骨骼位置及裙摆/长发串权重未通过，归一化不能修复，停止动画制作和绑定版导出。六个动作均未完成，不能声明第四阶段通过。
- 浏览器复测 failures=[]；比例、玩家/NPC、移动/冲刺、吃米/藏身/门/Q与加载失败回退证据见 docs/verification/DEEPSEEK_STAGE4。第三阶段验证脚本刷新了其原目录的截图/JSON，本次结果另复制到阶段四目录。
- npm test 794/796，仍为已有 human-ai 与 s7d-full-match 两项失败；tsc、build、diff --check通过，build有包体警告。无commit/push/tag，待用户比例验收及手工关节/权重修复。

### 2026-10-10 — DeepSeek第四阶段七动作与游戏接入（待人工验收）

- 用户明确降低蒙皮验收要求并授权动画和网页接入。本轮基于local_skin_v2/04_local_skin_review.blend，保留25骨骼与现有权重，另存stage4_animated_20261010/02_animation_review.blend，导出deepseek_animated_v2.glb；旧工程、v1、第三阶段静态GLB均保留。
- 完成Idle、Walk、Run、Eat、HideEnter、HideIdle、HideExit，玩家/NPC共用独立骨架克隆与AnimationMixer。真实EATING上升沿播放Eat一次，躲藏三段依真实CONCEALED切换；CrossFade、固定Root和120%比例保留。加载失败回退静态/程序化，Mixer异常回退静态。未改GAME_CONFIG、Human形象、AI决策、地图或胜负逻辑，保护文件哈希一致。

| 检查 | 实际结果 |
| --- | --- |
| 资产 | 18,500三角面、9,152源顶点/20,992导出顶点、25骨骼、7动作、1材质、3张2048²PNG、12,491,164字节 |
| 独立Three.js | 七动作各25个采样时刻检查全部顶点为有限数值，贴图正常加载；已查看截图 |
| 实际Chrome | WASD/Space、吃米单次触发、躲藏三段、门/Q、NPC自然Walk/Eat、暂停及故障回退通过；详见docs/verification/DEEPSEEK_ANIMATION_STAGE4 |
| 性能样本 | 动画/静态同种子同开局各约144FPS、650 Draw Call、46,252场景三角面；短时无头测试，不代表低配长测 |
| npm test | 799/801；既有human-ai.test.mjs:174与s7d-full-match.test.mjs:58失败保留。之后仅更新Hide资源/URL，最终v2定向15/15 |
| TypeScript / 构建 / diff --check | 最终v2通过；构建仍有大包警告，diff检查退出码0 |
| 人工验收 | 待确认，未宣称阶段Gate通过 |

- 已知限制：Eat只小幅抬手并低头，手未贴嘴；大幅抬手因袖口拉伸被拒绝。Hide为浅蹲；原游戏立即隐藏角色，因此HideEnter/HideIdle在正式游戏不可见，完整片段在独立预览检查。发尾/裙摆/袖口局部瑕疵和轻微滑步保留。
- Git检查点：未暂存、commit、push或Tag，未清理既有工作区改动。下一步集中验收动作观感，不能将本轮视为完整蒙皮修复通过。

### 2026-10-10 — DeepSeek 头发次级运动 v5（待人工验收）

- 用户已确认 v4 的 Idle/Walk/Run 身体动作满意。本轮保留全部身体轨道、Walk=1.5、Run=1.8、120%视觉比例，新增六发骨实时阻尼弹簧；复用五根原发骨，补一根后发尾骨，局部渐变分配后发权重。独立副本与报告：asset_work/stage4_animated_20261010/hair_v5/REPORT_HAIR_V5.md。
- 发骨在 Mixer 和视觉朝向之后更新，恢复前帧偏移以防累积；修复 GLTFLoader 去除骨名中点号导致侧发骨未匹配的问题。v5→v4动画→第三阶段静态回退已实测。玩家与NPC真实网格顶点均受影响，起停、转向有延迟衰减。
- GLB 18,500三角面、26骨骼、7动作、12,496,972字节；所有原v4动作轨道、几何位置、法线、UV逐字节相同。无移动、AI、配置、UI或地图改动。
- 浏览器错误0；六发骨update短时均值0.0233ms，Draw Call 689、场景三角面47,004均未增加；实际画布录像和连续帧在上述目录，部分放大测试镜头不等同默认镜头。
- 自动测试：头发专项3/3；全量802/804，仍为human-ai.test.mjs:174和s7d-full-match.test.mjs:58两项既有失败；独立tsc、build、diff检查通过。
- 已知限制：未进行布料或头发碰撞模拟，发尾/裙摆/尾巴轻微穿插允许保留；本轮待人工验收，不声明阶段Gate通过。未暂存、commit、push或Tag。

### 2026-10-10 — 现代暖色住宅家具与躲藏点 V1（待人工验收）

- 在现有 18 区域地图上将家具从 40 增至 64 件、藏身点从 8 增至 13 个；新增 5 个点位于客厅沙发、餐厅收纳架、次卧衣柜、客房书架和车库储物柜。家具数据集中于 apartmentMap.ts，视觉细节在 AlphaPresentation.ts；没有修改房间/门结构、AI 决策、GAME_CONFIG、角色动画或游戏平衡。
- 组合几何体表现布艺、木质收纳、灯具、植物、纸箱与轮胎；单家具装饰网格合并后，五个同机位视图 Draw Call 均下降，三角面因细节增加。截图、性能表与真实游戏验证见 docs/verification/RESIDENTIAL_FURNITURE_V1/REPORT.md。

| 检查 | 实际结果 |
| --- | --- |
| 地图/编辑器 | 64 家具、13 藏身点，validateEditedMap 零错误；新增沙发移动带动锚点并正确导出 |
| 真实浏览器 | 两阵营 PLAYING、GLB HTTP 200、脚本错误零；五个新增点逐个 E 进入/退出 5/5，双方出生点到各锚点均有导航路径 |
| 性能样本 | 无头 Chrome 1366×768：DeepSeek 约 534 Draw Call / 48,464 三角面 / 144 FPS；Human 约 649 / 32,652 / 144 FPS；无同条件改动前 FPS 基线 |
| npm test | 803/805；仅既有 human-ai.test.mjs:174 与 s7d-full-match.test.mjs:58 两项失败 |
| TypeScript / 构建 / diff --check | 通过；构建仍有包体警告 |
| 人工验收 | 待确认，未宣称阶段 Gate 通过 |

- 遗留：浏览器脚本用合法锚点定位验证 E 交互，全程手动走图、长时追逐与低配设备 FPS 待人工试玩。编辑器当前无删除家具操作；缺失稳定 ID 的旧布局会拒绝导入。未暂存、commit、push或Tag；保留其他既有工作区改动。

### 2026-10-10 — 全地图家具覆盖检查与补充 V3（待人工验收）

- 逐个审计现有 18 区域的面积、家具种类与占地、真实玩家半径下的静态可通行采样、躲藏点及实际等距视角。最终在书房、玄关、主卧、衣帽间、卫生间、阳台新增 17 件家具，64→81 件；保留 13 个 HideSpot。主走廊保持 0 家具用于通行。完整区域表、六区域同机位与真实游戏截图见 docs/verification/RESIDENTIAL_FURNITURE_V3/REPORT.md。

| 检查 | 实际结果 |
| --- | --- |
| 地图/导航 | 最终地图编辑校验零错误；双方原始出生点到 13/13 藏身锚点有路径；未改门墙、米点或出生点 |
| 浏览器 | 两阵营 PLAYING，GLB 两次 HTTP 200，脚本错误零；DeepSeek 玩家沙发 E 进/出通过，Human 阵营 NPC 2.5 秒移动约 3.94 世界单位 |
| 同镜头整图性能 | Draw Call 813→872，三角面 13,018→14,910；真实游戏短时样本 DeepSeek 593 / 51,868 / 137 FPS，Human 686 / 34,604 / 144 FPS，前后游戏 FPS 非严格同机位 |
| npm test | 803/805；仍仅既有 human-ai.test.mjs:174 与 s7d-full-match.test.mjs:58 两项失败 |
| TypeScript / 构建 / diff --check | 通过；构建保留既有包体警告 |
| 人工验收 | 待确认，未宣布阶段 Gate 通过 |

- 未修改 GAME_CONFIG、AI 决策、地图结构、角色资产/动画或已有藏身点。低配长时间性能和两阵营完整追逐局仍待人工试玩。保留工作区其他改动；未暂存、commit、push 或创建 Tag。


### 2026-10-10 — 场景定点优化 V4（待人工验收）

- 五区域：两个可躲纸箱、组合汽车/工具推车、两个固定关闭外门、卫浴组合与摆放。家具82、藏身点15。
- Chrome两阵营正常，纸箱E进出、五区W移动通过；双方至15藏身点路径存在。整图924 draw call / 16578三角面，短时144 FPS。
- 相关51/51通过；全套原805中803通过，仍仅既有human-ai:174、s7d-full-match:58失败。新增外门测试单独通过。TypeScript、构建、diff --check通过，保留包体与换行提示。
- 详见 docs/verification/SCENE_V4/REPORT.md。未改角色、配置数值或AI；未提交Git。长时追逐、手动走图及用户截图位置对应待验收。

### 2026-10-10 — DEV 场景布局持久化修复（待人工验收）

- 查明旧保存仅写浏览器localStorage；V4新增家具/藏身点造成Chrome旧81/13布局 `ID_MISMATCH`，开局回退源码。已备份Chrome原始存档与当前地图TS，并合法合并用户15处手动排布到82/15项目布局。
- 家具和藏身锚点权威数据改为 `src/three/map/sceneLayout.json`；DEV「保存布局」经本地Vite接口校验并写文件、备份旧文件、用SHA-256拒绝过期提交。旧浏览器存档保留但不自动覆盖项目。
- 测试副本实际完成移动→拒绝未应用保存→应用→保存→刷新→重启服务器→无关CSS HMR→旧localStorage隔离；保存结果持续。409和400均不覆盖布局。正式服务器接口响应正常。
- 相关63/63、全套804/806（仍仅既有两项失败）、TypeScript/构建/diff --check通过。详情见 `docs/verification/SCENE_LAYOUT_PERSISTENCE/REPORT.md`。未提交、push、Tag，等待人工验收。

### 2026-10-11 — 客厅电视与基础家电补充（待人工验收）

- 以sceneLayout.json为权威数据，备份后仅调整客厅原电视柜，并新增茶几、立式空调、饮水机；原沙发摆放和全部15个HideSpot保持不变。客厅10→13件、全图82→85件。电视柜含薄屏、支架、门板及机顶盒，家电具备格栅/水桶/龙头等辨识细节。
- 两阵营真实键盘完成客厅三段绕行，NPC正常移动；地图校验、角色碰撞沿导航路线行走通过。浏览器零脚本错误。同机位Draw Call 712→724、三角面55,212→56,500，2秒冻结帧率样本约142–144FPS。
- npm test 806/808，仅既有human-ai.test.mjs:174和s7d-full-match.test.mjs:58失败；TypeScript/构建/diff检查通过。没有改GAME_CONFIG、AI、角色或地图结构。
- 截图、备份、数据与限制见docs/verification/LIVING_ROOM_V5/REPORT.md。电视面向沙发，默认镜头看到背板。短时验证不替代低配长时追逐验收。未提交、push或Tag。

### 2026-10-11 — 车库水泥地与车库用品补充（待人工验收）

- 仅车库与卷帘门外连接路面的局部地坪：内部改暖浅灰混凝土、少量分缝和停车角标；门外4.3宽车道连续接到道路边缘，局部分开铺面和路缘石，主道路与关闭卷帘门碰撞不变。
- 修正车库工作台误用长凳模型、货架改金属收纳架、推车补工具箱与滚轮；新增箱堆和清洁用品。车库6→8件，全图85→87件；仅移动车库内三件家具，汽车、所有其他房间家具和15个HideSpot保持不变。权威数据仍为sceneLayout.json。
- 两阵营真实键盘绕车路线通过；Human NPC追逐、DeepSeek NPC撤离正常；车库储物柜E进出通过。新增普通箱堆不新增藏身规则，AI普通视线仍沿用墙门规则。浏览器错误0。
- 同机位Draw Call增加17，渲染三角面增加1376；两阵营短时FPS均144。npm test 808/810，仅既有human-ai:174和s7d-full-match:58失败；定向24/24、TypeScript/构建/diff检查通过。
- 截图、备份、测试和限制见docs/verification/GARAGE_CONCRETE_V1/REPORT.md。未改角色、AI、GAME_CONFIG、UI或地图主结构；未提交、push或Tag。等待人工验收，长时整局和低配设备未测试。

### 2026-10-11 — HideSpot 提示与四向等距镜头（待人工验收）

- 基于实际15个藏身锚点新增淡青蓝半透明圆环；接近时高亮，Human 可见禁用提示但不能 E 藏身，DeepSeek 原有 E 藏身与退出规则不变。环仅作表现，不加入碰撞或编辑器拾取。
- Z/C 每次旋转等距镜头90°，约400ms平滑过渡，X 恢复默认；保留相机高度、距离与跟随，玩法移动仍使用当前镜头方向。DEV 编辑器继续使用同一相机与既有射线拾取/地面拖动。
- Chrome 自动化实测两阵营提示与 E、DeepSeek 四视角及 Human 旋转后 W 屏幕向上移动、DEV 四视角餐桌拾取/拖动/保存调用；保存请求在测试中模拟，原 sceneLayout.json 字节未变，刷新后原家具坐标未变。11张实际浏览器截图保存在 `docs/verification/HIDE_CAMERA_ORBIT/`，浏览器脚本错误0。
- `npm test` 808/811；失败为当前工作区的 `human-ai.test.mjs:174`、`s7d-full-match.test.mjs:58`、`scene-editor.test.mjs:321` 断言，本轮未改对应 AI/布局规则。`npx tsc --noEmit`、`npm run build`、`git diff --check` 通过。未提交、推送或创建 Tag，等待人工验收。

### 2026-10-11 — 全地图柜架统一与家政间洗衣区（待人工验收）

- 扫描87件家具，其中28件柜架/台柜/衣柜；15件按3书架、5货架、1餐边柜、6收纳柜重建视觉，旧彩色薄片正面分支移除。实体层板、厚书、纸箱、工具箱、柜门/抽屉和把手采用顶点色合批，每件1个装饰Mesh。其余13件相关家具保留；全部现存shelf/bookcase ID覆盖。
- 家政间复用utility_counter原0.7×3占地，加入两台滚筒家电、凹槽水槽、水龙头、洗衣液、毛巾；原洗衣篮处补拖把/扫帚/清洁桶。没有新增家具实例、碰撞或HideSpot。所有原布局对象继续从sceneLayout.json加载，代码已保存，刷新生效。
- Chrome实际四向柜架前后截图32张、其他实例审计11张、家政四向前后8张与两阵营交互2张。5个柜架HideSpot E进出、家政纸箱E进出、两阵营中央WASD短段通行通过；种子5自然激活rice_05，DeepSeek按E产生进食进度，Human不能吃米。浏览器错误0。反向镜头部分受原有墙体正常遮挡，未隐藏墙体。
- 任务期间检测到外部布局保存变化，未覆盖；家政开发及验证期间sceneLayout.json逐字节一致。角色、AI、GAME_CONFIG、UI和玩法规则未改。同机位柜架样本Draw Call减少14，新增可见三角面约2588–3288；未执行低配长时性能验收。

| 检查 | 结果 |
|---|---|
| 模型与表现定向 | 20/20 |
| npm test | 793/813，20失败；当前布局锚点、旧断言及AI整局相关，详见报告 |
| 独立TypeScript / build / git diff --check | 通过 |
| 用户人工验收 | 等待 |

- 代码、逐项清单、截图边界和失败分布见docs/verification/STORAGE_VISUAL/REPORT.md，对照页为同目录review.html；家政证据见docs/verification/UTILITY_LAUNDRY/。没有修改测试来迁就失败，也没有为通过测试覆盖手工布局。未commit、push或Tag；完整套件FAIL，专项未标记Gate通过，等待人工验收。

### 2026-10-11 — 切剖墙体长条/三角投影修复（待人工验收）

- Chrome固定机位逐项隔离确认：客房wall_026与家政间外侧wall_029及其独立visual-wall-cap为长条/大面积尖角暗区来源。单独恢复对应墙体和盖条即可复现；normalBias、bias和正面阴影实验不能消除主体长墙影。不是坏三角剖分，而是展示用长墙实体的硬边投影。
- MapBuilder中仅调整切剖墙体/盖条castShadow=false，receiveShadow保持true。共享分支覆盖同类墙体；灯光、阴影分辨率、角色/家具/门框投影、地图和玩法未改；未隐藏墙体。场景存档逐字节未变。
- 三个区域、四方向、同机位前后24张真实浏览器截图及单墙复现证据见docs/verification/SHADOW_CORRECTION/review.html与REPORT.md。修复后角色与家具接地影仍可见，浏览器错误0，固定像素检查通过。

| 检查 | 结果 |
|---|---|
| 新阴影回归、Alpha表现、外围几何 | 36/36通过 |
| npm test | 796/814，18失败；与本轮首测失败清单一致，布局/HideSpot/AI整局相关，详见报告 |
| 独立TypeScript / build / git diff --check | 通过 |
| 用户人工验收 | 等待 |

- 使用diagnosing-bugs逐项隔离与ponytail最小修改原则。新增真实构建回归测试和验证脚本；未清理未知文件、未访问项目私人目录。没有commit、push、Tag，未标记Gate通过。本轮仅修阴影，后续等用户验收，不继续修改其他系统。

### 2026-10-11 — 有顶室内日光硬影与接地柔影分离（待人工验收）

- 用户澄清住宅有屋顶，只是游戏剖切展示；室内应无阳光硬影，但保留角色/家具脚下轻微接地影，两个阳台按露天处理。本条更正上一轮仅关闭墙体投影的处理，不改写旧记录。
- 新增InteriorShadowView，复用ROOMS判断覆盖；室内对象不投射/接收日光硬影，外边界墙/盖条恢复向室外投影。保持暖色光照、全局Shadow Map和露天日光影，不新增可见屋顶或全房暗罩。软接地影使用64²代码生成RGBA纹理、最大透明度10%，家具跟随编辑器变换、角色跟随位置并在躲藏时隐藏；不参与拾取、碰撞或存档。
- 源码限InteriorShadowView、MapBuilder与ThreeGame接线，更新上一轮新增阴影测试。地图JSON逐字节一致；没有修改GAME_CONFIG、AI、玩法、角色模型、UI或玩家声音表现。
- Chrome真实前后截图42张及柔影局部开/关、双阵营实玩、躲藏截图在docs/verification/COVERED_INTERIOR/；review.html支持三个问题区域和两个阳台的四向对照。室内家具日光caster/receiver和室内门leaf caster为0，全局阴影仍开启；洗衣组合脚边545个地面像素受到轻微柔影影响。
- 两阵营移动与旋转后输入、DeepSeek Space冲刺、E躲藏后柔影隐藏/退出恢复、Human不能E躲藏通过。编辑器柜体移动/旋转预览和丢弃重建通过，旧柔影已释放、新柔影没有重复；未调用真实存档写入。最终浏览器错误0。

| 检查 | 结果 |
|---|---|
| 阴影/Alpha/外围几何/相机深度定向 | 44/44通过 |
| npm test最终重跑 | 800/818通过，18失败；与上一轮失败清单一致，见专项报告 |
| 独立TypeScript / build / git diff --check | 通过 |
| 用户人工验收 | 等待 |

- 已知限制：轻量接地影是足迹近似，不是逐腿物理环境遮蔽；未做低端设备长时性能压测。外侧自然建筑影按用户确认方案保留。实现与测试中的临时失败、具体失败清单及参数位置见专项REPORT.md；未修改测试迁就失败。
- 使用ponytail最小依赖原则，复用Three.js DataTexture与现有房间/生命周期。不读取私人项目目录，不清理未知文件，未commit、push、Tag，未标记Gate通过；完成后等待人工验收。

### 2026-10-11 — 次卧客房兼学习区视觉补齐（待人工验收）

- 保留全部旧家具、藏身锚点、门和米点排布；次卧衣柜改双开木门与立体把手，普通 `second_cabinet` 改朝室内的开放矮书柜。既有 `second_desk` 补齐桌腿、抽屉、台灯、书本与文件盒；床头增加小灯和书，床下增加无碰撞薄地毯。
- `sceneLayout.json` 只新增 `second_study_chair` 一条191字节记录。内存去掉新增记录后的SHA256与上一轮快照A4BA6763B5B6698478A20C07B2E00EF9DB7B8995C5D723704B924990DF7414EE相同，证明没有重排或覆盖原存档；浏览器重载后新椅子存在。
- 复用现有材质顶点色与每家具一个detail Mesh批处理，新增独立次卧表现模块。未改其他房间、AI、GAME_CONFIG、动画、UI、碰撞规则或玩法。

| 检查 | 结果 |
|---|---|
| 次卧/储物/Alpha定向测试 | 22/22通过 |
| npm test | 802/820通过，18项失败，与上一轮清单一致 |
| 独立TypeScript / build / git diff --check | 通过；已有chunk/CRLF提示 |
| Chrome真实浏览器 | 双阵营四向WASD、DeepSeek衣柜E进入/退出、两扇门E、米点权限检查通过；pageerror 0 |
| 人工验收 | 等待 |

- 四向同机位前后截图、双阵营衣柜/米点实玩截图、复现脚本和报告在 `docs/verification/SECOND_BEDROOM/`，对照入口 `review.html`。默认机位仍有原墙体遮挡靠墙桌子的情况，反向机位可完整观察；未改变墙体来美化截图，未做低端设备长时性能测试。
- 18项失败沿用上一轮藏身配置/站位、Human速度断言、旋转布局、S7D整局fallback和编辑器断言问题，详见专项报告；没有修改这些测试迁就结果。
- 未commit、push、Tag，未标记Gate通过；完成后停止，等待人工验收。

### 2026-10-11 — 厨房靠墙料理台 / 洗菜台优化（待人工验收）

- 将 `kitchen_counter` 白色占位长条与原 `kitchen_island` 柜体移到西侧墙边，接成连续石材操作台；保留稳定ID，历史island对象不再是中岛。补齐水槽/水龙头、门/抽屉/踢脚、电磁炉/锅、烟机、吊柜、电饭煲/热水壶、砧板和碗。冰箱补齐门缝/把手；冰箱、原餐车和垃圾桶均整理到墙边。
- 正式JSON只调整5个厨房对象；非厨房家具、全部HideSpot和家具数量与本轮开工快照严格相同，未覆盖此前人工改动。厨房原本无HideSpot；未改门、米点、房间、AI、配置、角色、UI或玩法。
- 新增KitchenFurnitureVisual，复用Alpha现有每家具一个detail Mesh批处理，未增加依赖或光源。初次边界测试发现把手超出2.5mm，已修复并完整重跑，不放宽测试。

| 检查 | 结果 |
|---|---|
| 厨房/次卧/储物/Alpha定向 | 25/25通过 |
| npm test最终重跑 | 803/823通过，20失败，退出码1 |
| 独立TypeScript / build / git diff --check | 通过；已有大chunk警告 |
| Chrome真实浏览器 | 双阵营四向WASD、五门E切换、rice_06权限通过；编辑器选择/移动/旋转预览/丢弃重建/导出通过，pageerror 0 |
| 人工验收 | 等待 |

- 相较上轮多出的human-hide-search-resolution:326/366两项，已用测试进程JSON加载隔离在本轮开工布局上复现（6/8，同样两项失败），不是厨房改动引入；没有修改书房或测试迁就。其余18项沿用既有失败。初次完整测试有已修正把手失败21项，最终20项。
- 同机位四向前后截图和双阵营实玩截图在 `docs/verification/KITCHEN/`，完整范围、存档哈希、测试限制见REPORT.md，review.html用于对照。反向机位保留墙体遮挡，未测试真实保存覆盖或低端设备长时性能。
- 未commit、push、Tag，未标记Gate通过；完成后停止，等待人工验收。

### 2026-10-11 — 储物间普通长方体替换同款货架（待人工验收）

- 根据用户补充截图确认简略长方体实际为普通家具 `storage_rack`，不是旁边绑定 `hide_storage_shelf` 的 `storage_shelf`；纠正前一轮只读回复的对象误认。
- 使用ponytail最小改动，将storage_rack加入既有STORAGE_VISUAL_ROLES的rack类别，复用同款三层开放货架、立柱、纸箱与收纳盒。无新模型系统、无依赖；原位置、占地、碰撞代理、旋转、编辑器和HideSpot均不变。
- 修改StorageFurnitureVisual.ts一处映射，更新storage-furniture-visual测试的目标数16及同款断言；未修改玩法测试迁就失败。场景JSON前后SHA256均为69AAE7FC75D0F4A153703AA484F2BA0F86AEF42C61AAB4303D9A302C64F09261。

| 检查 | 结果 |
|---|---|
| 储物表现定向 | 2/2通过 |
| npm test | 803/823通过，20项失败，与厨房轮清单一致 |
| 独立TypeScript / build / git diff --check | 通过；已有大chunk警告 |
| Chrome真实浏览器 | 四向截图，实际视觉存在、占位代理不可见、原躲藏点保留；pageerror 0，无存档写入 |
| 人工验收 | 等待 |

- 真实截图与复现脚本位于docs/verification/STORAGE_RACK/。本轮未重新实玩躲藏或跑长期性能测试；只替换视觉，原交互绑定未动。不读取私人目录、不清理文件、未commit/push/Tag，等待人工验收。

### 2026-10-11 — 阳台休闲、绿植与晾晒生活区（待人工验收）

- 在普通阳台沿边角新增圆茶几、休闲椅、花架、长花槽、折叠晾衣架（含毛巾及收纳篮）、高盆栽6项，保留中央通路；北阳台未改。
- 新增BalconyFurnitureVisual，复用既有顶点色合批与场景编辑器，修正叶簇索引以保持每件一个视觉Mesh；AlphaPresentation只增加新实例接线。
- 6项写入实际sceneLayout.json。与开工快照逐项比对，原家具和HideSpot全部不变；未改墙、门、米点、AI、GAME_CONFIG、动画或碰撞规则。

| 检查 | 结果 |
|---|---|
| 定向视觉回归 | 22/22通过 |
| npm test | 805/825通过，20项失败与上轮清单一致；新增2项通过 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF警告 |
| Chrome实际场景 | 四向前后截图；双阵营四向移动、三门E、rice_01权限及NPC短时移动通过，无pageerror和磁盘存档写入 |
| DEV编辑器 | 选择、移动/旋转预览、丢弃重建及导出通过，未覆盖保存 |
| 人工验收 | 等待 |

- 详细范围、JSON哈希、已知失败及截图见docs/verification/BALCONY/REPORT.md和review.html；反向视角保留原墙体遮挡，未验证整场AI、低端设备长时性能或服务进程重启。
- 未commit/push/Tag，未标记Gate通过，未改其他未提交成果。完成后停止等待人工验收。

### 2026-10-11 — 北阳台生活收纳区优化（待人工验收）

- 普通占位柜north_balcony_rack原位改为防潮储物柜，具有底座、双柜门、门缝、把手、抽屉及分层；尺寸/朝向/碰撞代理不变。
- 仅沿北阳台北墙新增窄晾衣架（毛巾及篮子）、双层花架（两盆植物、洒水壶）、高盆栽3项，写入正式sceneLayout.json。原有所有家具与HideSpot条目逐项一致；D19–D22、墙、其他房间、AI、GAME_CONFIG、动画和玩法未改。
- 复用现有阳台视觉与合批，未引入依赖或修改场景编辑器逻辑。

| 检查 | 结果 |
|---|---|
| 定向视觉测试 | 22/22通过 |
| npm test | 807/827通过；20项失败与上轮同名清单一致，新增2项通过 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF警告 |
| Chrome真实浏览器 | 四向前后截图；双阵营四向WASD、四门E、NPC局部移动、DeepSeek纸箱E进入/退出及Human禁用权限通过；pageerror 0 |
| DEV及数据保护 | 柜体移动/旋转预览、丢弃重建及导出通过，重新载入保留新增项，验证未写磁盘存档 |
| 人工验收 | 等待 |

- 详细文件清单、哈希、截图及限制见docs/verification/NORTH_BALCONY/REPORT.md与review.html。保留原墙体遮挡，未验证整场AI、服务重启或低端设备长时性能。
- 未读取私人目录或清理未知文件；未commit/push/Tag，未标记Gate通过，完成后停止等待人工验收。

### 2026-10-11 — 主卧睡眠/梳妆/收纳区完善（待人工验收）

- main_dresser原位优化为带柜脚、分层台面和把手的四抽斗柜；main_wardrobe仅增加真实双门结构、门缝、把手与底座，原尺寸/碰撞/躲藏绑定不变。
- 只在主卧JSON追加梳妆台（含镜子/小瓶）、梳妆凳、床尾凳3项；床附属薄地毯、床头柜附属台灯/书本。不新增灯光；保留现有绿植/椅子/门/米点。与开工快照比较，全部旧家具和HideSpot数据完全一致。
- 新增MainBedroomVisual，复用既有合批、编辑器和存档机制，未改其他房间、AI、GAME_CONFIG、角色动画或玩法。

| 检查 | 结果 |
|---|---|
| 主卧/次卧/Alpha视觉定向 | 最终22/22通过；初次衣柜门面2mm超界已修正 |
| npm test | 809/829通过，20项失败与北阳台轮同名清单一致，新增2项通过 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk和LF/CRLF警告 |
| Chrome实际场景 | 四向同机位前后；双阵营四向WASD、两门E、床/衣柜藏身与退出及Human禁用、rice_09权限通过，pageerror 0 |
| DEV/存档保护 | 梳妆台移动/旋转预览、丢弃重建/导出通过；重新载入保留新增项，验证未写磁盘存档 |
| 人工验收 | 等待 |

- 文件清单、JSON哈希、截图及限制详见docs/verification/MAIN_BEDROOM/REPORT.md和review.html。镜片为实体蓝灰材质，没有实时反射；未验证整场AI、服务重启或低端设备长时性能。
- 未读取私人目录或清理未知文件，未commit/push/Tag，未标记Gate通过；完成后停止等待人工验收。

### 2026-10-11 — 玄关鞋帽收纳与换鞋区优化（待人工验收）

- 左墙新增长条鞋柜、换鞋凳，入户门旁新增全身镜，三项写入实际sceneLayout.json；全部旧家具、HideSpot与开工快照一致。原鞋架/换鞋凳仅补充结构，衣帽架补充外套/背包，增加按既有外门推导的无碰撞地垫。
- 新增EntryFurnitureVisual，复用顶点色合批及编辑器；不改门、墙、出生点、其他房间、AI、GAME_CONFIG、动画或玩法。固定关闭外门保持原样。

| 检查 | 结果 |
|---|---|
| 玄关/Alpha定向测试 | 20/20通过；新增家具门洞退让及镜高问题已修正，完整布局校验通过 |
| npm test | 810/831通过，21项失败：20项与主卧轮同名，另1项为开工前已移动的次卧椅子与旧测试坐标断言不一致，未回退人工排布或修改测试 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF警告 |
| Chrome实际场景 | 四向前后截图；双阵营出生点/入户门附近四向WASD、四内门E、NPC局部移动通过，pageerror 0 |
| DEV/数据保护 | 新柜体移动/旋转预览、丢弃重建、导出及重新载入通过；地垫随重建保留，未写磁盘存档 |
| 人工验收 | 等待 |

- 详细范围、文件、哈希、测试失败与截图见docs/verification/ENTRY/REPORT.md和review.html。镜子无实时反射，未验证长时整场AI、服务进程重启或低端设备性能。
- 使用ponytail复用现有模块，无新增依赖；未读取私人目录、清理文件或覆盖其他未提交成果，未commit/push/Tag，未标记Gate通过，停止等待人工验收。

### 2026-10-11 — 卫生间洗漱/如厕/洗浴区域完善（待人工验收）

- 原五件卫浴家具位置、尺寸、朝向、碰撞及拾取代理不变，补齐洗手台镜柜/双门/洗漱用品、马桶卷纸/刷具、浴缸半幅透明挡水屏/毛巾杆/地漏，以及开放毛巾柜与篮内毛巾。
- 新增BathroomFurnitureVisual，复用合批和编辑器本地坐标；只为卫生间补横纵瓷砖缝。无新增布局ID或坐标，sceneLayout.json与开工快照逐字节一致，附属视觉由项目源码持久生成。

| 检查 | 结果 |
|---|---|
| 卫生间/储物/Alpha视觉定向 | 最终22/22通过；初次毛巾柜门面超界已收回原占地 |
| npm test | 最终812/833通过，21项失败名称与玄关轮完全一致，无新增失败；未修改现有测试迁就模型 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF提示 |
| Chrome实际场景 | 四向同机位前后；双阵营四向WASD、D12/D13真实E开闭及穿门、rice_11权限通过，pageerror 0 |
| DEV/数据保护 | 浴缸移动/旋转预览、丢弃重建及玻璃恢复通过；重载保留外观/布局，未写磁盘存档 |
| 人工验收 | 等待 |

- 详细范围、文件、哈希、现存失败及真实截图见docs/verification/BATHROOM/REPORT.md和review.html。镜子无实时反射，保留原墙体遮挡，未验证长时整场AI、低端设备性能或服务进程重启。
- 使用ponytail复用现有流程，无新增依赖；未改门/墙/米点/HideSpot/AI/GAME_CONFIG/角色/玩法，未读取私人目录或清理文件，未commit/push/Tag，未标记Gate通过，停止等待人工验收。

### 2026-10-12 — 南走廊/东走廊开放家庭健身区（待人工验收）

- 用户明确授权方案C改造：开放x16,z7…19共墙，删除唯一依附门D24。原wall_023仅截去z7…12.4、保留餐厅侧z4.35…7；原wall_024的z13.6…19移除。其余门/墙几何保持，D23、D25、D26、D31编号不变。墙渲染、碰撞与导航共享更新后的权威墙列表。
- 保留18个区域ID/边界，南/东走廊改显示名为健身区两子区，以开放连接替代可锁门；只在实际sceneLayout.json新增跑步机、单车、哑铃架、长凳、镜子、毛巾架、饮水机7项。两张无碰撞瑜伽垫附属长凳。所有103件旧家具、15个HideSpot、米点、出生点与开工备份一致。
- 新增HomeGymVisual并复用合批/编辑器/存档；仅接齐共墙移除后的地板缝。截图发现长凳共面闪纹后修正坐垫/底座几何层次。未改AI、GAME_CONFIG、角色、UI、躲藏或玩法数值。

| 检查 | 结果 |
|---|---|
| 定向地图/器械/Alpha | 最终28/28通过；3项新增健身区测试通过 |
| npm test | 最终815/836通过；21项失败与卫生间轮同名清单完全一致，无新增失败 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF提示 |
| Chrome实际游戏 | 四向同机位前后、正反1920×1080概览；双阵营四向真实WASD横穿共墙/绕行跑步机、NPC局部移动与碰撞有效；Human NPC实测跨过原共墙，pageerror 0 |
| DEV/持久化 | 四向真实鼠标选择/拖动后丢弃、旋转应用/恢复通过；实际保存/刷新、正常重启本项目Vite后7件器械/无D24/无共墙仍正确 |
| 数据保护 | 原JSON与map源码TEMP备份保留；所有旧家具/HideSpot与不相关墙/门/区域边界/米点/出生点自动比较一致；既有保存接口新增自动bak保留 |
| 人工验收 | 等待 |

- 清单、路径、备份哈希、测试限制与截图见docs/verification/HOME_GYM/REPORT.md与review.html。镜子无实时反射；瑜伽垫不是独立编辑项；保留原区域归属/跨子区拖放限制。旧31门布局导入不会静默迁移；删除一门改变同种子的随机初态。未验证长时整场AI和低端设备性能。
- 使用ponytail复用已有流程，无新依赖；未读取私人目录、清理未知文件或覆盖其他未提交工作。未commit/push/Tag，不标记Gate通过，停止等待人工验收。

### 2026-10-12 — 场景米袋视觉优化（待人工验收）

- 原圆柱/光滑球顶米袋改为鼓腹、有纵向褶皱和内壁的开口袋体，补翻折袋口、袋底及轻微程序化布纹；84粒低面数真实3D米用InstancedMesh绘制，进度改变时才更新矩阵。
- 沿用既有riceVisualMetrics与配置，米堆/袋身随真实进度下降，米粒减少但不压扁；吃完仍保留空袋，重置恢复满袋。未改地图/布局、AI、GAME_CONFIG、RiceSystem/RiceField、交互时长/范围、HUD或ThreeGame接线。新增资源随View正确释放。

| 检查 | 结果 |
|---|---|
| 米袋定向测试 | 5/5通过（原4项+新增1项结构/实例/状态/释放检查） |
| npm test | 816/837通过，21项失败名称与健身区轮一致，无新增失败 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF提示 |
| Chrome真实浏览器 | rice_11四向同机位前后/近景、半满/空袋表现；重新开局真实长按E进食至完成1/5，pageerror 0 |
| 人工验收 | 等待 |

- 修改src/three/RiceView.ts、tests/rice-view.test.mjs，追加docs/ALPHA_POLISH.md说明和docs/verification/RICE_SACK验证资料。满/半/空状态样张为冻结场景View预览；playing-eat/playing-empty为真实进食，不混淆证据。
- 使用ponytail直接复用原View，无新增依赖或外部美术文件。未验证Human完整对局或低端性能，未读取私人目录、清理文件或覆盖其他工作；未commit/push/Tag，不标记Gate通过，停止等待人工验收。

### 2026-10-12 — 用户AI米袋OBJ优化并接入GLB（待人工验收）

- 原incoming-assets/rice-bag六个文件保留不改：50000三角面OBJ、MTL、四张4K PBR图。使用项目已装Three.js离线减面/法线/UV处理，基色压至1024JPEG并内嵌；输出public/assets/props/rice-bag/rice-bag.glb，11998三角面、12395 UV顶点、632704字节。布料使用非金属/粗糙材质，未携带低强度金属图/弱法线与4K粗糙图。
- RiceBagModel缓存一次加载与贴图，米点独立实例资源；RiceView异步替换满袋、失败回退、清理销毁后迟到实例，并应用原室内阴影策略。满袋等比匹配原占地；源模型没有独立米粒/空袋动画，消耗沿原高度比例变化，完成切至已有程序化空袋。该静态模型局限如实保留，不宣称布料/米粒模拟。
- 未改米点、布局、AI、GAME_CONFIG、进食系统/距离/时长、ThreeGame、HUD或其他玩法。Blender未连接，未操作用户Blender场景，未生成新美术。

| 检查 | 结果 |
|---|---|
| 米袋定向 | 7/7通过，新增2项GLB自包含/规格及模型状态/阴影/销毁回归 |
| npm test | 818/839通过，21项失败与上一轮同名，无新增失败 |
| 独立TypeScript / build / git diff --check | 通过；既有大chunk及LF/CRLF提示 |
| Chrome实际浏览器 | 五米袋共用一次请求；四向模型/近景、Human加载、真实E进食至1/5、阻断模型请求回退通过，pageerror 0 |
| 人工验收 | 等待 |

- 修改RiceView，新增RiceBagModel、离线prepare-rice-bag脚本、GLB及2项测试；追加ALPHA_POLISH说明，验证资料在docs/verification/RICE_BAG_GLB/。半满/空袋样张仅驱动冻结View，playing-eat/playing-empty才是真实E进食证据。
- 使用ponytail复用已有加载/回退，未增加依赖。未验证Human NPC全局进食整局或低端性能；原始文件、未知文件及其他未提交工作保留，不读取私人目录，未commit/push/Tag，完成后停止等待验收。

### 2026-10-12 — S13 音频制作前开发快照提交前审查（等待确认）

- 用户要求整理当前开发成果上传GitHub，但明确要求commit/push前报告并等待确认。本轮仅检查与文档更新，无源码、配置、资源或布局修改，无暂存/提交/推送/Tag。
- 分支main，origin地址正确；检查时HEAD、本地origin/main与远端main均为历史基线532c2bb59bd7045cea7d95bf6f8a740f5dcdcbd6，无进行中的合并/变基/cherry-pick，暂存区为空。
- 现有真实浏览器DEV编辑器显示SAVED、草稿UNCHANGED、未保存修改否、项目文件已加载；磁盘sceneLayout.json含110件家具/15个HideSpot，SHA256为9d53920224997dc3b8d2caeea56b0b647f9abaeca9d137d17756f8d78b9dc1d8，与GET保存接口revision一致。未触发保存、恢复默认或刷新，已关闭检查面板。

| 检查 | 结果 |
|---|---|
| npm test | 818/839通过，21项失败，退出1；失败名称与上一轮米袋记录一致，未改测试迁就归档 |
| 动画/头发/米袋/PulseLock/健身区定向 | 18/18通过 |
| 独立TypeScript / build / git diff --check | 退出码均0；既有大chunk与LF/CRLF提示 |
| 静态资源 | 27个源码引用均存在；角色GLB无外部URI、动画版7动作；当前资源均尚待纳入Git |
| 敏感模式检查 | 常见GitHub/OpenAI/AWS密钥及私钥头扫描未命中；并非完备安全或资产再分发授权审计 |
| 浏览器人工范围 | 仅确认实时编辑器保存状态，未重测整局/全面交互，不以测试替代人工验收 |

- 更新HANDOFF当前快照审查摘要，新增docs/PRE_S13_SNAPSHOT_REVIEW.md逐文件清单：144个候选路径（含两项既有删除），约76.35MiB。保留v6当前动画、v5回退、静态回退及测试依赖v2；排除未引用v1/v3/v4。全部未跟踪verification材料、17份布局bak、incoming-assets原输入、私人目录、构建缓存与未知文件均不暂存、不删除。
- 明确风险：Human AI实际倍率0.52，旧注释/文档/测试仍0.92，本轮不擅改；快照包含既有PulseLock/门锁惩罚/地图变更，并非纯视觉。历史日志中的本机验证材料不上传，GitHub部分证据链接将不可用。资产公开/再分发授权待用户确认。
- Git检查点：尚未创建，等待用户确认后才能精确暂存、commit、普通push；建议提交说明feat: complete gameplay visuals and prepare for audio production。不标记Gate通过，不提前开发S13。

### 2026-10-12 — S13 前 Human AI 配置与21项测试专项修复（待人工验收）

- 完成内容：先完整复现818/839、21项失败。碰撞测试与整局仿真复用生产rectColliders，修复忽略家具旋转的错误环境；更新独立可编辑facing、相对旋转、事务回滚、家具重叠和持久化夹具。原整局搜查种子仍保留藏身及结算检查，补两局严格搜查命中回归，不改AI、玩法或时限。
- 配置调查：Git仅有2026-09-23已提交0.92，0.52是未提交修改，最迟2026-10-05日志已观察，无法追溯精确编辑时间或原始原因。用户本轮明确确认保留0.52及hide_storage_shelf的60°半角；只同步注释、数值文档和测试预期，不改任何GAME_CONFIG数值。

| 自动化测试与人工验收 | 实际结果 |
|---|---|
| npm test | 修复前818/839；修复后839/839，失败/skip/取消均0，退出0 |
| npx tsc --noEmit / npm run build / git diff --check | 均退出0；既有大chunk与LF/CRLF提示保留 |
| 真实浏览器 | 双阵营进入READY/PLAYING、暂停与返回正常；Human对局中DeepSeek AI吃完5份米，01:00结算；Human AI实时巡逻路径推进 |
| 布局保护 | 编辑器SAVED、UNCHANGED、未保存修改否；110件家具、15个锚点；sceneLayout.json哈希与修复前一致，未试写或恢复默认 |
| 尚待实机复验 | 完整逃跑、门/PulseLock成败、藏身进出、编辑器实际写回；不得把逻辑仿真写成真人验收 |

- Git检查点：本轮未暂存、commit、push或Tag；没有reset/clean或未知文件清理。未访问私人配置目录。既有未提交成果保留。Public已获用户接受，资产授权并非本轮完备审计。
- 已知限制与下一项任务：测试全绿不代表阶段Gate通过；等待集中人工验收，再重新整理S13前快照清单并获得提交授权，不启动音频开发。详细21项错误、根因、处理及文件清单见docs/PRE_S13_TEST_REPAIR.md，真实截图在docs/verification/PRE_S13_TEST_REPAIR/。

- 同轮补充实机证据：DeepSeek阵营固定种子20260927，Human AI自主寻路接近并于01:04抓捕结算；真实截图deepseek-human-ai-captured.jpg。没有修改AI参数或决策，实机随机流与无头仿真不同，不要求耗时一致。其余未复验交互限制保持不变。

### 2026-10-12 — S13前专项修复人工验收确认与最终快照复核（待提交授权）

- 完成内容：用户明确确认门、PulseLock成功和失败、躲藏进入和退出、保存后刷新恢复四项全部通过；此为用户实机验收，不冒充代理本轮重新操作。只读复核权威布局仍110件家具、15个HideSpot，SHA256与专项修复前一致，且与GET保存接口revision一致。未写回、恢复默认或修改任何场景数据。

| 自动化测试与人工验收 | 结果 |
|---|---|
| 专项修复门禁 | 用户认可839/839、独立TypeScript/build通过；本轮纯文档/Git审查，未重复运行游戏测试或构建 |
| 门、PulseLock成败、藏身进出、DEV保存刷新 | 用户全部确认通过 |
| git diff --check | 本轮通过，退出0；既有换行提示不影响结果 |
| 远端与暂存区 | main与远端main一致，无新增远端提交；暂存区为空 |
| 公开上传复查 | 最终150路径文本的常见密钥/私钥/凭据URL模式未命中；非完备安全或授权审计 |

- 更新PRE_S13_SNAPSHOT_REVIEW与HANDOFF：旧144路径增加专项修复报告、DEV-B说明及四份测试，共150候选路径，含两项既有删除，约76.5MiB；全部已修改跟踪文件均有清单归属，最大单文件约11.92MiB。临时验证材料、布局bak、原始工作输入、历史动画中间版、缓存和私人目录继续排除，不清理任何文件。
- 公开风险：AGENT_LOG、DEEPSEEK_HANDOFF、MAP_SPEC含既有本机目录/用户名路径；全部美术资产公开再分发授权仍缺少完备凭据。用户要求仓库Public，本次GitHub API复核被403限流，未宣称重新核验可见性成功；Git远端查询正常。需在新的提交授权中确认资产公开边界。
- Git检查点：本轮未暂存、commit、push或Tag；等待对更新后的150路径与公开风险发出新的授权。拟提交说明为feat: save pre-S13 gameplay and visual snapshot。不标记新阶段Gate通过，不启动S13音频开发。

### 2026-10-12 — S13前快照最终公开发布审查（因来源许可缺口停止提交）

- 用户确认150项清单、Public及条件提交授权；只有素材具备明确公开分发依据才执行。逐项复核150路径无重复，148现存文件及两项既有删除吻合，已修改跟踪文件无清单外遗漏。未改变任何游戏功能、Human AI 0.52或权威地图排布。
- 检查GLB内嵌JSON：四份角色模型仅有Blender导出器信息，内含texture_pbr_20250901系列贴图，无明确许可字段；米袋注明由用户OBJ优化，未见原生成平台/贴图来源许可。未将导出工具、用户提供或AI加工记录当作再分发凭据。
- 发现19个具体资产及23个Sheet派生组件来源/许可依据待确认，名单与继承关系写入PRE_S13_SNAPSHOT_REVIEW末节；两份旧WebP有项目内原创生成README，程序化模型有源码依据。原始文件未删除、替换或擅自排除。

| 检查 | 结果 |
|---|---|
| 敏感模式 | 150路径文本的常见密钥、私钥及凭据URL模式未命中，非完备审计 |
| 隐私路径 | AGENT_LOG、DEEPSEEK_HANDOFF、MAP_SPEC含本机路径，待用户决定保留或授权脱敏；未改历史 |
| 自动化门禁 | 保留用户认可839/839及TypeScript/build通过基线；纯文档审查不重跑游戏测试；本轮diff检查通过 |
| 布局与远端 | 权威布局哈希不变，main与远端main一致；暂存区为空 |

- Git检查点：授权条件尚不满足，按用户要求停止提交；未暂存、commit、push或Tag。预定提交说明为feat: complete pre-S13 gameplay and visual milestone，未创建提交。更新审查报告与HANDOFF；私人目录、缓存、未知文件和原始工作资产未访问或清理。不进入S13，等待素材来源/许可及路径隐私决策。

### 2026-10-12 — 用户素材来源确认与公开文档准备（等待最后确认）

- 用户确认DeepSeek角色为Tripo AI生成，经Blender优化、骨骼绑定与动画制作；米袋、参考图、立绘、UI Sheet及派生组件为自行制作或AI生成/编辑，未直接使用第三方网站下载的未经授权资源。新增ASSET_PROVENANCE逐类记录，不为未知平台填写名称，不把用户声明冒充独立许可认证。
- 使用research技能核对Tripo官方协议与说明：付费/免费权利不同；生成时套餐、日期、渠道与补充许可尚待确认，未找到后来升级追溯授权旧免费输出的明确说明。未知平台资产明确标记条款未核实。来源已确认不等于全部平台许可已核验通过。
- 用户本轮明确授权隐私脱敏，因此仅替换本日志两处历史本机路径为`.`、`dist/`，不更改事件或测试事实；HANDOFF与MAP_SPEC各一处外部资料路径保留相对名称并注明未纳入仓库，不虚构仓库位置。更新快照审查及HANDOFF的当前准备状态。

| 检查 | 结果 |
|---|---|
| 清单 | 原150项保持，另增用户要求的来源文档，共151候选路径；149现存文件、2项既有删除，无重复/清单外已修改跟踪文件 |
| 敏感与体积 | 常见密钥/私钥/凭据URL模式未命中；候选文本未检出盘符绝对路径；约76.51MiB，最大11.92MiB，无50MB以上单文件 |
| 游戏测试 | 本轮纯文档未重跑npm test、TypeScript或build，保留已认可839/839及既有通过基线 |
| diff与布局 | git diff --check通过；权威布局哈希不变，未修改代码、素材、地图、AI或GAME_CONFIG |

- Git检查点：暂存区为空，未commit、push或Tag；本轮用户明确要求等最后确认。原始工作资产、未知文件和私人目录未读取或清理。下一步补充Tripo生成时许可条件及需要核验的其他平台信息，不自动进入S13。

### 2026-10-12 — 腾讯混元3D免费网页来源与协议状态最终更正

- 用户最终确认DeepSeek娘模型来自`https://3d.hunyuan.tencent.com/`官方网页免费版，不是Tripo，也不是腾讯云API。记录实际流程：混元3D网页免费生成 → 用户在Blender优化、绑定骨骼并制作动画 → 导出GLB → Three.js接入。
- 用户声明其他资产来源仍按此前记录：自行制作或AI生成、编辑和加工，没有直接使用未经授权的第三方网站下载资源。
- 核查官方网页页脚提供的《腾讯混元3D服务协议》链接（腾讯规则中心文档`202501080004`）。官方正文异步接口返回“没有数据”，本轮无法核实协议内容、免费版生成物商业使用权、内嵌贴图公开分发权或生成时适用的历史版本。没有使用腾讯云/其他腾讯产品协议或混元3D开源模型许可证替代网页服务协议。
- 更新ASSET_PROVENANCE、PRE_S13_SNAPSHOT_REVIEW与DEEPSEEK_HANDOFF；Tripo早先记录依追加式日志规则保留，由本条明确纠正。模型GLB及其内嵌PBR贴图授权均标记待确认。原151项清单不变，无代码、资产、地图或GAME_CONFIG修改。
- 本轮文档核对，未重跑测试/TypeScript/build，保留839/839既有认可基线；`git diff --check`通过。未暂存、commit、push或Tag。

### 2026-10-12 — 更正DeepSeek模型来源为腾讯混元3D免费版

- 用户更正前条来源声明：DeepSeek娘3D模型实际由腾讯混元3D免费版在线服务生成，不是Tripo Studio或API。记录制作流程：腾讯混元3D免费在线生成 → Blender优化、骨骼绑定与动画 → 导出GLB → Three.js接入。
- 更新`docs/ASSET_PROVENANCE.md`、`docs/PRE_S13_SNAPSHOT_REVIEW.md`与本交接文档。历史日志此前写Tripo的条目保留以符合追加式日志规则，由本条明确更正，不再作为当前来源依据。
- 官方在线资产页提示用户知悉《腾讯混元3D服务协议》，但本次无法取得该免费在线服务实际展示的协议正文/版本。另查到的腾讯云混元生3D服务条款指向大模型API服务条款；该API条款中生成内容归属文字不足以证明免费在线网页生成资产可商业使用或在Public仓库公开再分发。不引用混元3D开源模型许可证作为在线服务许可依据。
- 商业使用与公开再分发条件明确记为“待确认”。无代码、素材、地图、GAME_CONFIG修改。保留839/839已认可基线，本轮仅文档，未重跑测试或构建；`git diff --check`通过。未暂存、commit、push或Tag。

### S13 音频与反馈最终验证与修复 — 2026-10-12

#### 完成内容

- 在已有42个原创合成Ogg和音频表现接线上完成验证。修复音乐延迟解码叠加、reset短音残留、延迟解码突破并发限制、暂停中解码导致循环无法重启；源节点结束后断开连接。
- 补齐首次倒计时音，继续按钮在用户手势内恢复后播放；完成米停止咀嚼，移除空门操作气泡和NPC全局门提示；世界反馈受实际视线、隐藏及屏幕边界约束；减少动态偏好禁用新增提示的缩放和位移动画。
- Chrome154.0.8037.100、Edge151.0.4129.86分别使用独立受控实例导航到`http://127.0.0.1:5173/`并确认游戏标题；双阵营实际输入与受控场景夹具记录原生播放节点及非零输出波形。没有用请求成功冒充播放或用浏览器自动化冒充主观试听。
- 完整事件/42资产表、混音参数、截图、JSON及夹具边界见`docs/verification/S13_AUDIO_REPORT.md`；交接文档已同步。本轮没有重生成或覆盖音频素材。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| npm test | 846/846，失败0、跳过0；初轮842，本轮新增4项竞态/生命周期回归 |
| npx tsc --noEmit / npm run build / git diff --check | 分别退出0；build保留现有大chunk警告 |
| Chrome / Edge | 42音频解码、播放节点；双阵营移动、门、PulseLock、躲藏、搜查、摔倒、胜负等接线已验证；详细区分真实输入与受控状态夹具 |
| 生命周期/设置 | 五路音量、静音、刷新持久化、暂停/恢复、四次受控重开、快速音乐切换通过 |
| 故障与边界 | HTML音频解码失败缓存、拒绝自动播放仍可PLAYING，无pageerror；距离/墙遮挡与隐藏权限正确，声音表现圈保持关闭 |
| 人工听感/OS失焦/性能 | 待用户；Headless切页未产生真实失焦，注入blur/focus接线通过；不报告硬件FPS通过 |

#### Git 检查点

- main沿用已归档S13前快照，本轮索引为空，未commit、push或Tag；没有建立新阶段Git检查点或声明Gate PASS。
- config、map、systems、角色动作文件对HEAD无差异，原人工排布未写回；未知文件和私人目录未读取或清理。

#### 已知限制与下一项任务

- 42个声音为简化原创合成版本，咀嚼/机械音辨识度、混音遮蔽与音乐听感由用户集中试听。暂停期间Hover静音；error资源可播放但当前无专属业务入口。
- 等待用户试听、真实后台切换、自然连续对局及性能验收，不自动提交或进入后续阶段。

- 本轮末次真实键盘验证发现五路音量滑块被游戏全局方向键preventDefault阻断；在`AudioSettingsView`的input范围内阻止Arrow/Home/End/Space向游戏冒泡，保留原生控件行为，不改全局输入逻辑。随后重新执行完整门禁，并在两浏览器通过真实键盘调节31%与复选框静音回归；声音设置截图一并保存。

### S13 音效暂时停播（2026-10-12）

- 按用户要求，在`ThreeGame.playWorld`统一停播普通/冲刺脚步与开门/关门音效；保留原始音频，等待参考素材。锁门、解锁等其他音效及AI声音感知事件保持不变。
- 自动化检查：`npm test`846/846通过，独立TypeScript、build及`git diff --check`通过；build仍提示已有大体积chunk。本轮未重新执行浏览器试听，等待用户参考音频。
- 未暂存、commit、push或创建Tag；未修改地图、GAME_CONFIG或玩法。

### S13 吃米反馈文案微调（2026-10-12）

- 将`ThreeGame.ts`吃米时的浮动反馈文字由“米粒”改为“我吃”，保留原触发、样式和玩法。
- `npm test`846/846通过，独立TypeScript、build及`git diff --check`通过；保留已有chunk体积警告。本轮未重新进行浏览器验收，未commit、push或创建Tag。

### S13 补充：音效暂停、ESC设置与启动界面（2026-10-12）

#### 完成内容

- 统一停用普通/冲刺脚步、冲刺启动、开关门5种可听音效，保留文件与接口及AI真实声音事件。音频清单标记等待用户参考素材；其他音效不变。
- 复用GameAudio/AudioSettingsView，将五路音量、百分比、总静音、恢复默认与保存接入ESC设置子页；ESC先返回暂停菜单，再恢复游戏。保留暂停挂起音频策略。
- Chrome实际打开并核对参考小游戏，观察加载阶段、菜单主操作层级、集中设置及菜单切换；只借鉴交互层级。新增原创暖白蓝青加载页，显示真实三维处理项与图片/首批音频准备状态，不伪报百分比；支持超时、重试入口及安全进入菜单。
- 没有修改GAME_CONFIG、AI、地图、110件家具/15HideSpot、正式v6、动画或头发动态，没有写回编辑器排布。详细设计与证据归`docs/verification/S13_AUDIO_REPORT.md`最新补充节。

#### 自动化测试与验收

| 检查 | 结果 |
|---|---|
| npm test | 848/848，失败0、跳过0；新增2项音频回归 |
| 独立TypeScript / build / diff检查 | 通过；保留已有chunk体积警告 |
| Chrome154 / Edge151 | 明确URL127.0.0.1:5173；双阵营原生键鼠设置、ESC层级、静音/恢复默认/刷新通过 |
| 实际音频节点 | 5种停用音无节点或循环；保留音效解码RMS非零，各路真实GainNode随滑块更新 |
| 生命周期/资源故障 | 重开返回仅菜单音乐；GLB404、Ogg返回HTML与慢模型超时均安全进入，pageerror 0 |
| 人工试玩/试听 | 待用户统一验收；受控节点检查不替代人耳听感、自然整局或硬件FPS |

#### Git检查点、已知限制与下一项任务

- 本轮未暂存、commit、push或创建Tag，不将S13标为Gate PASS。
- 设置暂停时不播放预览音，增益实时更新并在恢复时生效。参考网站Hover精确参数、完整进入/退出动画与演示视频未独立核验，不声称复制。
- 下一步由用户集中检查启动、双阵营ESC及保留音效听感；暂不启动无关开发。

### S13暂停/结算装饰简化回归修正（2026-10-12）

- 关闭重复角饰时遗漏Sheet填充底色和边框留白，导致结算底板透明、内容贴边。已在 `src/s13-ui.css` 显式恢复暖白底色、34px留白和按钮文字对比，保留无重复贴图的按钮及面板。
- Chrome实际URL `http://127.0.0.1:5173/` 验证受控胜利、失败、暂停画面，胜利画面检查960/1366/1920px窗口，等待立绘解码后留图；不是自然整局验收。本轮未重复Edge验证。
- 自动化：`npm test` 848/848，独立TypeScript、生产构建及差异空白检查通过；既存的大chunk警告保留。
- Git检查点：未暂存、commit、push或Tag。等待用户视觉验收，不改变阶段Gate。

### 全游戏UI家居便签更新（2026-10-12）

#### 完成内容

- 用户授权更新全游戏UI、保留两张阵营选择卡。本轮以暖白、柔和蓝绿、圆角和轻阴影统一加载/HUD/技能/交互/进度/暂停/声音设置/PulseLock/结算，并润色首页标题底板与操作说明。样式集中于`src/game-ui.css`，复用现有DOM与状态，不新增UI依赖、不改素材。
- 修正ESC首按钮蓝框：原主动聚焦首按钮，改为聚焦面板；Tab键仍显示具体按钮焦点。未修改玩法、AI、GAME_CONFIG、地图、模型或动画。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| npm test | 848/848，失败0、跳过0 |
| 独立TypeScript / build / diff检查 | 通过；既存chunk体积警告保留 |
| Chrome154 / Edge151 | URL127.0.0.1:5173；双阵营实际菜单/ESC/设置/返回操作，初始无按钮蓝框、Tab焦点可见、滑块值生效，pageerror 0 |
| 窗口适配 | 1366×768与960×640结算截图、未横向溢出 |
| 人工视觉验收 | 待用户；结算/PulseLock截图使用受控内存状态，不冒充自然整局 |

#### Git检查点、已知限制与下一项任务

- 未暂存、commit、push或创建Tag，不改变阶段Gate。详细范围、证据和限制见`docs/verification/UI_REFRESH_REPORT.md`。
- 既有S13与其他未提交工作全部保留。下一步用户统一验收新UI及既有音频，不自动进入新阶段。

### 紧凑HUD与首页重排（2026-10-12）

#### 完成内容

- 按用户反馈，仅在`src/game-ui.css`把目标面板压成两行310×75px信息条，保留身份、时间、米饭数量与进度，隐藏重复目标与常驻教学说明。
- 首页重新排为顶部横向刊头、中央并列且顶边对齐的双阵营卡、底部操作栏；去掉标题大底板，声音设置收起时改小入口。只调整卡片外层位置/容器宽度和纵向错位，不改卡内立绘、美术、文案或按钮行为。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| npm test | 848/848，失败0、跳过0 |
| 独立TypeScript / build / diff检查 | 通过，保留既有大chunk警告 |
| Chrome154 / Edge151 | 明确URL127.0.0.1:5173，双阵营进入/ESC/返回及首页设置展开收起通过，浏览器异常0 |
| 适配与视野 | 960/1366窗口HUD高75px；960/1366/1920首页两卡在屏内且顶边一致 |
| 人工视觉验收 | 待用户；截图与检查记录在`docs/verification/ui-compact/` |

#### Git检查点、已知限制与下一项任务

- 未暂存、commit、push或创建Tag；未更改玩法、地图、AI、GAME_CONFIG、模型或动画。保留所有既有工作区内容。
- 浏览器测试不代替用户视觉偏好和自然整局验收。下一步用户集中确认新版排版，不自动进入新阶段。

### 阵营选择页制作信息与免责声明（2026-10-12）

#### 完成内容

- 新增底部半透明深灰信息栏、用户指定声明、真实package.json版本、制作信息入口及细红线/短粗条；预留首页底部空间，避免覆盖卡片和操作提示。
- 原生dialog展示指定制作信息、开发者云扎与GitHub链接；无编造联系方式、无同意勾选。支持按钮和ESC关闭、焦点约束及关闭后恢复入口焦点，仅局部隔离按键，不修改游戏暂停代码。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| npm test | 849/849，失败0、跳过0；新增1项组件回归 |
| 独立TypeScript / build / diff检查 | 通过，保留既存大chunk警告 |
| Chrome154 / Edge151 | 明确URL127.0.0.1:5173，实际入口/关闭/ESC/焦点恢复及双阵营进入、暂停继续、返回通过；异常0 |
| 适配 | 1920×1080、1366×768、960×640、640×720，无底栏遮挡卡片/操作提示或横向溢出 |
| 人工视觉验收 | 待用户；证据在`docs/verification/menu-credits/` |

#### Git检查点、已知限制与下一项任务

- 未暂存、commit、push或创建Tag，未修改模型、地图、AI、音频、GAME_CONFIG或玩法。既有未提交成果保留。
- 详细结果见`docs/verification/MENU_CREDITS_REPORT.md`；窄窗口声明自然换行，浏览器检查不冒充人工视觉或法律授权结论。下一步用户集中验收。

### 移除阵营页CONTROL提示（2026-10-12）

- 完成内容：删除`GameUiLayout.ts`首页操作提示HTML，既有阵营按钮测试增加“不含CONTROL提示”的断言；对局按键提示与制作信息底栏不变。
- 验证：`npm test`849/849，失败/跳过0；独立TypeScript、build及`git diff --check`通过，既有chunk警告保留。Chrome明确URL127.0.0.1:5173，检查提示元素不存在、两张卡片与免责声明仍在。
- Git检查点：未暂存、commit、push或创建Tag。无新增已知问题，等待用户视觉确认，不改变阶段Gate。

### 免责声明页脚去底板（2026-10-12）

- 完成内容：仅调整`src/game-ui.css`，去掉免责声明独立矩形底色，改为透明文字层、无框文字入口及圆形向下图标；红色斜切短条移至左下，保留细分隔线。场景底部连续渐暗辅助浅色文字阅读，不形成独立黑框；文案、版本及弹窗功能不变。
- 检查：`npm test`849/849，独立TypeScript/build/diff检查通过，既有chunk警告保留。Chrome明确URL127.0.0.1:5173，1366×768/960×640验证底栏背景透明、无卡片遮挡/横向溢出、弹窗打开和ESC关闭正常。截图在`docs/verification/menu-credits/unframed/`；本轮未重复Edge检查。
- Git检查点：未暂存、commit、push或Tag。等待用户确认视觉效果，不改变阶段Gate。

### 删除页脚红色四边形（2026-10-12）

- 完成：删除`src/game-ui.css`的`.menu-credits::after`红色装饰规则，声明、细分隔线和右侧入口不变。
- 验证：849/849测试、独立TypeScript/build/diff检查通过，保留已有chunk警告；Chrome明确URL127.0.0.1:5173，确认伪元素content为none且页脚仍在。本轮未重复Edge或整局试玩。
- Git检查点：未暂存、commit、push或Tag；无其他功能改动，等待用户视觉确认。

### S13 补充五项音效（2026-10-13）

#### 完成内容

- 在既有 S13 音频入口恢复普通脚步、冲刺脚步、冲刺启动、开门、关门五项；只重新生成对应五个原创 Ogg，其余 37 个音频 SHA-256 均保持不变。小森平网站与本机 Sonniss 素材仅供参考，没有复制录音到项目。
- Chrome 复测发现暂停时未结束的短音可能在恢复后续播；暂停现在停止短音，保留既有循环音乐处理。未修改 AI 感知、地图、玩法数值或角色动画。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| `npm test` | 850/850，失败 0、跳过 0 |
| 独立 TypeScript / build / `git diff --check` | 均通过；构建仍有既存大 chunk 警告 |
| Chrome 受控双阵营 | 确认 127.0.0.1:5173 游戏标题与 PLAYING；两阵营脚步和 E 键开关门、DeepSeek 冲刺均实际触发并解码，RMS 非零；停止移动无后续玩家脚步；暂停短音清零，重开无旧声残留；页面异常 0 |
| Edge 与人工试听 | 本轮未验证，待用户集中试听与自然游玩验收 |

#### Git 检查点、已知限制与下一项任务

- 未暂存、commit、push或创建 Tag；S13 尚未达到 Gate PASS。素材来源与逐项证据见 `docs/ASSET_PROVENANCE.md`、`docs/verification/S13_AUDIO_REPORT.md`。
- 受控浏览器通过播放节点与非零波形验证，不代表音量与音色已通过人耳验收。下一步由用户试听五项新声音。

### 撤回五项脚步、冲刺及开关门音效（2026-10-13）

#### 完成内容

- 用户试听后认为上一轮制作的五个声音均不合适，决定删除；已移除 `step.ogg`、`sprintStep.ogg`、`sprintStart.ogg`、`doorOpen.ogg`、`doorClose.ogg`。对应事件 ID 保留但播放入口静音，生成脚本不再生成这些文件。其余 37 个 Ogg 保留，合计 399664 字节。
- 不改角色移动、冲刺、门状态、AI 感知或其他音效；上一轮修正的暂停短音清理保留。五个删除的文件当时未被 Git 追踪，不能从当前 Git 历史恢复；若将来需要须重新制作或从另有的备份恢复。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| `npm test` | 850/850，失败 0、跳过 0；新增断言覆盖禁用事件无资源请求与播放节点 |
| `npx tsc --noEmit` / `npm run build` / `git diff --check` | 均通过；构建仍有既存大 chunk 警告 |
| 浏览器与主观试听 | 本轮未重新实机试玩或试听；此前 Chrome 对五项的播放验证是撤回前历史结果 |

#### Git 检查点、已知限制与下一项任务

- 未暂存、commit、push 或创建 Tag；既有未提交改动和未知文件保留。下一步待用户提供认可的参考音频后，再按授权制作替代版本。

### 全项目结构审计与数值平衡准备（2026-10-14）

#### 完成内容

- 按用户授权使用 `codebase-design` 与 `ponytail-audit` 审计当前工作树，只维护文档。扫描106个源码／数据文件、107个测试／辅助文件、3个脚本及根构建配置；没有实施重构、格式化、代码删除或数值调整。
- 新增 `docs/CODEBASE_BALANCE_AUDIT.md`：结构概览、15项审计发现、分批实施建议、226项 GAME_CONFIG 叶子字段目录、170项有效玩法／技术／结构字段的空白调整表，另列3项进食模式入口。包含单位、读取位置、增减影响、关联风险、测试家族及38项DEV覆盖映射；目录与源码字段逐项核对无遗漏／重复。
- Human AI倍率保持0.52；确认development进食5秒/份且build不自动切换、DEV-B预设刷新／新局恢复、14项未见运行读取配置、PulseLock固定3芯及米份数关联固定UI文案。数值索引仅更正有证据的说明；交接文档增加审计入口，不变更阶段Gate。
- 发现需决策的听觉契约冲突：DEV元数据／旧设计称range仅影响新事件，现有运行代码和测试要求即时影响存量事件。只读探针复现16u处同一FOOTSTEP在range17时可听、改5后不可听，事件仍为原一条。强度与寿命确实在生成时取值；本轮仅记录，不擅自选择语义或修改代码／测试。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| `npm test` | 本轮重新运行850/850，失败0、跳过0 |
| `npx tsc --noEmit` | 本轮重新运行，退出0 |
| `npm run build` | 未重新运行；本轮只审计及修改Markdown，没有游戏代码开发 |
| 参数／文档核对 | 226项定义完整，无遗漏／重复／未知项；173行填写表的拟调整值、目的、结果三列全部留空；源码链接存在且行号有效 |
| 工作树保护 | 开始与结束对216个源码／数据／测试／脚本文件做SHA-256对照，变化0、新增0；GAME_CONFIG及权威布局无本轮改动；`git diff --check`通过 |
| 浏览器／性能／胜率 | 本轮未执行，不将历史实机结果或单元测试冒充真人平衡验收 |

#### Git 检查点、已知限制与下一项任务

- 未暂存、commit、push或Tag，没有修改源码、测试、素材或人工排布，未读取私人配置。已有未提交内容和未知文件均保留；临时扫描工具放系统Temp，没有加入项目。
- 未发现运行时导入环，发现1处类型依赖环；静态扫描不等于所有行为已被证明。用户下一步选择报告中的整理项，或填写平衡调整表；听觉range语义冲突需先选择目标行为。本轮不据建议自动开工。

### 三档难度与正式30秒进食／DeepSeek AI锁门防困 — 2026-10-14（Codex）

#### 完成内容

- 用户明确授权三档难度及正式进食调整后，新增类型安全难度模块与首页radio组，仅覆盖对手AI的6个Human／5个DeepSeek字段；EASY读取基础配置，Human倍率0.52保留。AI逐局只读快照，不重写感知或决策状态机。
- 正式进食改production30000ms，默认模式同时切production，显式开发测试5000ms保留；400ms准备、中断累计、5份胜利和玩家速度／技能保持不变。
- 新局锁定难度、暂停只读、重开沿用、返回可重选及安全本地偏好；DEV-B预设保留但不自动应用，显式调试覆盖优先并有标记，新局恢复难度基准。DEV解锁／配额展示与导出AI日志核对有效配置。
- 首轮浏览器发现旧通用label样式覆盖难度卡并与阵营卡相交，限定新选择器后修复；仅调整必要卡片可用高度，阵营卡内部美术及其他界面未重设计。
- 额外固定种子20260927的Human追逐脚本复现NORMAL浴室自锁：AI把自己与室内米锁在两扇门内，吃完后NO_REACHABLE_RICE；597秒测试预算内2/5未结算。旧锁门检查仅要求至少一份剩余米可达，解除两把锁的单变量隔离探针恢复5/5，确认不是配置失效。
- 用户追加明确授权后，仅加强 `evaluateEscapeLock`：基于全部当前门状态＋拟锁门模拟，所有尚未完成米点均须合法可达；部分不可达拒绝并清pending，已完成米不参与。保留合理自动锁门，不改手动门锁、Human强破、PulseLock、数值或地图。
- 诊断遵循diagnosing-bugs的确定性复现与回归环：先新增3项回归，修复前实际3/3失败；最小修复后通过。未将旧失败伪装成通过，也未删除／跳过测试。ponytail用于约束最小配置／生命周期接入。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| 调整前真实基线 | 850/850；早期839项不是本轮基线 |
| 难度首次全量 | 849/850，旧60000ms预期按已批准30秒更新；新增难度覆盖后870/870 |
| 追加自锁回归 | 修复前3项失败，修复后正常；旧长跑“至少一份”断言加强为全部可达 |
| 最终 `npm test` | 874/874，失败0、取消0、跳过0 |
| `npx tsc --noEmit` | 最终独立执行，退出0 |
| `npm run build` | 最终退出0；保留Vite大分包建议告警，未为本轮扩展打包重构 |
| `git diff --check` | 通过，CRLF提示不属于空白错误 |
| Chrome154／Edge151 | 确认127.0.0.1:5173及页面标题；各6组合原生移动／暂停／重开／返回／刷新及受控50ms加速整局结算通过，未处理页面异常0；1920／1366／960宽度布局无相交／多余滚动 |
| 正式进食浏览器 | Chrome真实RAF＋原生E，在实际米点附近测试：6000ms20%、15000ms50%、松键保留、恢复累计30000ms才完成一份，此时未结算 |
| 原自锁种子修复后 | EASY193100ms／NORMAL225400ms／HARD206550ms，全部5/5；NORMAL保留1次合理锁门 |
| 其他房间可达性 | 3档×3种子共9局全结算，每次实际锁门后核验全部剩余米路，8次锁门覆盖玄关／主卧／浴室／餐厅／客厅 |
| 困难Human路线 | 4个额外固定种子均通过门和家具路线抓捕，未记录有AI移动指令却完全不动的卡住帧 |
| 保护与边界 | 地图JSON／apartmentMap与本轮前SHA256相同，110件家具／15HideSpot未改；v6模型Git对象与HEAD一致；未改资产／动画／音频／依赖，未访问私人配置或清理未知文件 |
| 真人／胜率／硬件FPS | 未执行；受控加速回放不是自然时长真人整局，不能声明胜率平衡或硬件性能验收完成 |

#### Git 检查点、已知限制与下一项任务

- 未暂存、commit、push或Tag，既有未提交S13／UI工作、未知截图和场景备份保留；开发服务复用已有5173监听，未终止其他进程。阶段未标记Gate=PASS。
- 当前规则与完整档位见 `docs/DIFFICULTY_DESIGN.md`；截图、六组合表、锁门问题的修复前证据／修复后配对和修改清单见 `docs/verification/DIFFICULTY_REPORT.md`。数值索引与DEV-B旧恢复规则已加当前说明，审计报告保留历史证据仅提示后续变更。
- 下一步交用户集中试玩两阵营三档、30秒进食、暂停／重开及浴室锁门通路。初始实验难度未做胜率平衡；S13主观试听待验收不因本轮自动完成。

- 本轮收尾补记：最终截图复核发现小窗口阵营卡底部说明遮住卡名，已只修正卡片可用高度；Chrome／Edge三尺寸补增卡内名称与说明无相交断言并通过，截图已更新，新增 `difficulty/layout-results.json`。随后重新运行全量874/874、独立TypeScript、生产构建和diff检查均通过；没有改变阵营卡内部设计或新增玩法，Git归档仍未执行。

### 阵营选择页响应式布局修复 — 2026-10-14（Codex）

#### 完成内容

- 按本轮授权先修复布局，不再以原生缩放为开工前置；未重试不能可靠核验URL的原浏览器控制宿主。独立Playwright明确导航已有127.0.0.1:5173服务并核对游戏标题后操作。
- 修改前Chrome960×450复现难度顶部291px、卡片底部377px，相交86px且菜单scrollHeight只有450px；断言实际失败。根因是多份CSS中的绝对位置、视口高度和固定底栏互相覆盖，内部说明与立绘也脱离正常排布。
- 新增唯一菜单样式入口，整理四份旧CSS的菜单规则，保留共享HUD／ESC／PulseLock成员；标题、卡片、难度和制作信息回到正常流，Grid／Flex重排，窄窗口单列、短窗口滚动。保留原角色图片、卡片配色、文案和背景资源，无新依赖或!important堆叠。
- 卡内身份／立绘／说明各自占位；同一个AudioSettingsView在首页标题栏和原暂停overlay之间挂载，不新增音量状态。新增4项结构／样式归属／滚动／接线回归测试。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| `npm test` | 878/878，失败0、取消0、跳过0 |
| `npx tsc --noEmit` | 独立执行通过 |
| `npm run build` | 通过；既有大于500kB分包建议告警保留 |
| 相关菜单测试 | 单独重跑9/9，失败／跳过0 |
| `git diff --check` | 通过，CRLF转换提示不属于空白错误 |
| Chrome154／Edge151 | 各13种CSS视口全部通过，共26组；区域盒／卡内分区／无横向溢出／自然滚动，52次双阵营进入、ESC暂停及返回，三档键鼠、制作信息ESC与关闭、声音设置展开／原生键盘滑块／恢复默认／收起及刷新难度偏好通过；页面未处理异常0 |
| 保护核对 | 对任务开始226项SHA-256核对，仅7个预期既有源码／样式变化；配置、AI、地图、正式v6、动画和依赖未改，既有未提交工作保留；日志旧前缀不变 |
| 原生缩放／真人视觉 | 未完成，90%、100%、110%、125%、150%、175%、200%交用户在真实桌面浏览器人工验收；CSS视口不冒充原生缩放，软件GPU不用于硬件FPS结论 |

#### Git 检查点、已知限制与下一项任务

- 未暂存、commit、push或Tag，未更新阶段Gate=PASS；未清理未知文件、场景备份或私人目录。复用已有5173监听，无重复服务或终止其他进程。
- 根因、实际截图、逐条件盒数据与文件清单见 `docs/verification/MENU_RESPONSIVE_REPORT.md` 及 `docs/verification/menu-responsive/`。首次并行负载造成浏览器12秒等待超时，放宽探针等待预算后复测；修正探针误读暂停后隐藏HUD与装饰伪元素的判断，不改游戏计时或断言掩盖问题。
- 最窄已验证320 CSS px；极矮窗口需竖向滚动，不保证所有内容一屏显示。下一步只交用户集中检查页面视觉及原生缩放；三档平衡、自然整局与S13试听等既有待验收状态不变。

- 收尾补测：Chrome／Edge再次完成双阵营暂停→继续→暂停→返回，未处理JS异常0，但控制台各有2条既有favicon404；软件Edge还记录2条MeshDepthMaterial着色器验证错误。新建默认Edge，明确核验相同URL与RTX4060／Direct3D11后双阵营复测，仅有favicon404，没有着色器错误。原始日志完整保留，未将控制台描述为零错误，未更改资产或渲染设置；不能据一次硬件复测声称软件后端已修复。收尾独立TypeScript与生产build再次通过。

### 已验收成果公开归档 — 2026-10-14（Codex）

#### 完成内容与人工验收

- 用户最终确认S13主观试听、三档难度真人平衡体验及原生浏览器缩放人工验收通过，明确授权普通commit与push至origin/main；不创建Tag／Release或启动新功能。
- 发布保留42个事件接口、37个实际原创Ogg（399664字节），五项脚步／冲刺／开关门声音继续禁用；正式30秒／份、5份米、EASY Human倍率0.52及已验收档位不变。地图与正式v6无差异，不新增旧GLB。
- 精确审查126个路径：20个源码／样式、14个测试／夹具、1个生成脚本、37个Ogg、13份文档、41张报告引用截图。无真实密钥／Token／本机文件绝对路径，无新增大于5MiB文件；原始诊断JSON、探针、私人目录、未知素材及场景备份保留本机，不纳入暂存。

#### 自动化测试与发布门禁

| 检查 | 结果 |
|---|---|
| `npm test` | 本次重新运行878/878，失败0、取消0、跳过0 |
| `npx tsc --noEmit` | 本次独立执行通过 |
| `npm run build` | 本次执行通过，既有大chunk建议告警保留 |
| `git diff --check` | 通过 |
| 用户人工验收 | S13试听、三档真人体验、原生缩放三项由用户明确确认，不以代理视口检查代替 |

#### Git 检查点与限制

- 归档标题：`feat: complete S13 audio, difficulty modes and responsive UI`。提交前实际远端main与指定上一快照一致；精确暂存及cached检查后执行普通提交／推送，最终SHA和同步状态以Git现场查询及执行回报为准，本条随该标题的提交归档，不写死当前SHA。
- 公开范围及逐文件清单见 `docs/verification/S13_RELEASE_REVIEW.md`；三个现有验收报告已补用户最终确认。favicon缺失、软件Edge着色器日志（硬件复测未复现）等既有非阻断限制保留，没有新建胜率／FPS统计或补写角色制作历史。下一步仅由用户另行指定，不自动开工。

### 第一轮工程整理：审计、安全重构与冗余排查 — 2026-10-15（Codex）

#### 完成内容

- 按用户授权完成全仓范围审计及低风险实际整理，不删除或移动文件。提取Human搜查DEV只读投影到独立模块，复用原UI模块的按钮组成、3处时钟格式及坐标文案；清理13项未使用项、23条后加载同选择器覆盖的CSS声明。
- ThreeGame由3573行降为3475行；src代码文件108→109、总行28267→28285（净增18），新增清理逻辑与回归测试，不以转移代码冒充全项目减行。未修改两套AI控制器、数值、地图、v6、动画或音频规则。
- 先复现反馈定时器/监听未清理和安全线条缺少dispose，再修复并补4项回归；整实例销毁停止DEV-B订阅，调用已有地图释放接口，清理米点/代理/阴影及DOM，重复销毁安全。编辑器beforeunload改稳定处理器并注销，未保存提醒和保存逻辑不变。
- 222项候选台账逐项记录路径/字节/追踪/引用/动态可能/用户资产与风险：A类3个零字节占位，B类173个待核实文件，C类43个保留文件和3个私人目录。全部未删除；没有把动态Ogg、回退模型、归档声音圈、场景备份或历史证据直接当垃圾。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 开工基线 | 重新运行npm test 878/878、独立TypeScript和生产build通过 |
| 最终npm test | 885/885，失败/取消/跳过0，新增7项行为/生命周期回归 |
| npx tsc --noEmit | 独立执行通过；额外noUnused诊断15→2，保留未改AI中的hideMap/input，额外命令退出1，不冒充全诊断通过 |
| npm run build | 通过；117模块，既有大于500kB chunk建议告警保留 |
| git diff --check | 通过；新增文本另检查，不用暂存获得检查结果 |
| 投影等价性 | 2种固定种子×3难度×500帧，共3000次与原HEAD投影结果深比较一致 |
| Chrome154/Edge151 | 明确导航127.0.0.1:5173并核对标题；每浏览器6种阵营×难度组合进入/移动/暂停/声音设置/返回，5种CSS视口无相交/横向溢出；暂停/设置与胜负结算选定computed style前后相同；HARD重开保持难度，制作信息原生ESC关闭 |
| 生命周期 | 浏览器销毁后DEV-B订阅1→0、安全线2→0、米点映射5→0、地图/canvas/menu脱离；编辑器自身beforeunload监听1→0，干净/未保存/恢复提醒语义相同，未动Vite监听 |
| DEV-B保护 | 仅独立新上下文保存测试预设0.61，刷新基础0.52，显式恢复0.61；没有读取/写入用户真实预设或保存场景POST |
| 哈希保护 | 107项文件前后相同，包括全部public、配置/难度、权威地图、DEV持久化、AI、v6/动画/头发及音频；不存在非dist文件删除；日志旧前缀保留 |
| 未执行的人工检查 | 未重做原生90%～200%缩放、自然全局吃米/PulseLock/藏身/主观试听/硬件FPS/长期堆快照；视口与受控权威结算检查不冒充自然试玩 |

#### Git 检查点、已知限制与下一项任务

- 开工main与真实远端main一致，上一公开快照已同步，提交标题为 `feat: complete S13 audio, difficulty modes and responsive UI`；当前状态仍通过Git现场查询。本轮未暂存、commit、push、Tag或改变阶段Gate。
- 报告、逐文件候选、完整哈希及真实截图见 `docs/verification/CODEBASE_CLEANUP_REPORT.md` 与新增 `docs/verification/codebase-cleanup/`。既有274项未跟踪状态条目原样保留，没有清理未知材料、备份或访问私人目录。
- 发布风险：本机6个被Git忽略的旧GLB仍被Vite复制进dist（约74.38MB）；Git忽略不等于构建排除，后续公开部署前须单独审查，不能删除原模型解决。大型模块、剩余CSS级联、类型回环及声音range元数据争议均列待确认，未扩大范围修复。
- 下一步停止，等待用户审核第二轮删除/整理范围；默认仅推荐3个已有实际内容目录下的.gitkeep，B/C均不自动批准删除。

### 工程整理S2：生产构建资源审计与安全瘦身 — 2026-10-15（Codex）

#### 完成内容

- 修改前先执行真实生产构建并保存90文件/117,535,171字节的完整清单及哈希；保留第一轮14个跟踪改动和279项未跟踪状态条目，不读取私人目录、不清理未知文件。
- 审查当前Vite public复制及模型/音频/图像动态入口，确认v1～v4无当前运行模型分支，v5与standalone仍是明确失败回退。只接入apply=build/writeBundle插件，精确unlink四个dist生成副本，校验项目dist及父目录realpath，拒绝输出重定向；不删除public原件、不改加载器或DEV功能。
- 最终dist为67,570,763字节、86文件，减少49,964,408字节/42.51%；剩余文件名/哈希完全相同，JS/CSS/图像/37音频不变。没有宣称正常首屏网络减少49.96MB或构建/帧率加速。
- 第一轮173项B只读复核逐文件留证：95项有隔离副本/离线加工引用，10项高置信未参与当前正式运行，68项需手工动态验证。全部未删除或生产排除；3个A类.gitkeep、43个C类文件及3私人目录继续保护，第一轮报告未改。

#### 自动化测试与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 开工npm test | 885/885，失败/取消/跳过0，约57.81秒 |
| 最终npm test | 890/890，失败/取消/跳过0，约67.81秒；新增5项精确名单/原件及未来资源保留/幂等/目录边界回归 |
| npx tsc --noEmit | 最终独立执行通过 |
| npm run build | 原基线及修改后多次通过，117模块；既有大于500kB chunk建议告警保留 |
| git diff --check | 通过；本轮新增文本另行检查，没有通过暂存运行检查 |
| Chrome154/Edge151 | 明确page.goto并核对URL/标题；开发5173、生产预览4173，每环境各6组合，共24组合进入/移动/模型材质/动画头发/实际音频节点/ESC设置/暂停恢复及三尺寸布局通过；正常请求失败/HTTP错误/console error/pageerror均0 |
| DEV编辑器 | 两浏览器开发环境打开、125行、选择及小草稿预览/放弃、导出、拒绝未应用保存、GET revision、关闭恢复通过；未写真实场景文件，生产按既有规则隐藏场景编辑器入口 |
| 生产回退 | Chrome/Edge各注入v6→HTML、v6+v5→HTML，实际加载v5的7动画或standalone静态模型；响应哈希一致，无未处理异常或v1～v4请求 |
| 原件及第一轮保护 | 337项开工保护哈希、第一轮107项、173项B复核哈希均一致；43项C文件存在/大小一致；日志开工前缀保留，未读取三个私人目录 |
| 未执行项目 | 主观试听/真人自然整局、原生浏览器缩放、完整拖拽及真实保存POST、旧探针/旧副本执行、网络压缩传输量/硬件FPS/长期内存不以本轮自动化冒充通过 |

#### Git 检查点、风险与下一项任务

- main与真实远端main仍在上一公开快照，现场Git查询核验；本轮无add、commit、push或Tag，不修改阶段Gate或自动进入第三轮。
- 完整体积/前30资源/逐文件清单与哈希、173项复核、浏览器网络及截图见 `docs/verification/PRODUCTION_ASSET_OPTIMIZATION_REPORT.md` 和新增 `docs/verification/production-assets/`。
- 公开部署门禁仍在：v5/static约24.41MB需维持当前回退，但既有来源记录只授权正式v6；不得把本机瘦身dist直接认定可公开上传。旧URL在预览可能返回200 HTML，不等于GLB仍在；开发原件Range请求206/glTF正常。
- 保留既有开发服务5173（PID9828），本轮预览4173（PID9200）供人工验收，不终止其他进程。下一步等待用户验收；第三轮仅建议另行批准回退部署边界及离线UI生产排除评估，不自动删除任何候选。

### 最终工程整理与收尾 — 2026-10-15（Codex）

#### 完成内容

- 用户授权集中收尾，不创建新的整理阶段。复核S1/S2及真实工作区，保留15项既有跟踪差异与未知材料；没有继续改动源码、测试、构建配置或资产，仅新增最终报告/精选证据及候选提交清单，更新必要交接。
- 173项B最终逐项分类为105项有明确用途关系、10项高置信未参与当前运行、58项动态条件不确定保留。新增证据为8个历史截图页两浏览器只读可用，以及2项显式旧存档夹具关系；未执行可能写盘/写存档的旧探针，全部候选未删，46项C继续保护。
- 生产dist仍86文件/67,570,763字节，和S2产物路径/哈希完全相同；S1后原117,535,171字节累计减少42.51%。v1～v4只排除生成副本，原件全部保留；v5/static仍是条件回退，不伪称仅DEV或无用。

#### 自动化测试与浏览器验收

| 检查 | 实际结果 |
|---|---|
| npm test | 本轮重新运行890/890，失败/跳过/取消0，约61.18秒 |
| TypeScript / build / diff | 独立类型检查、生产构建及收尾diff检查通过；既有大chunk告警保留；未跟踪候选文本另检，无暂存 |
| 保护哈希 | 本轮517项、S1的107项、S2的337项均相同；日志原完整字节前缀不变，正式地图/配置/v6/音频及S1/S2报告未改 |
| Chrome154/Edge151 | 明确URL/标题，开发5173与预览4173各6组合共24组合，通过实际参数/移动/地图模型/动画头发/音频节点/暂停设置/三CSS视口/制作信息/销毁；正常请求失败、HTTP错误、console error和pageerror均0 |
| 生产失败回退 | 两浏览器各v6失败→v5七动画、v6/v5失败→static，实际响应哈希一致，无未处理异常 |
| DEV真实保存 | 仅临时隔离5183复制项目与81个公开资源，原保存插件两浏览器实际POST200/备份/revision/刷新恢复通过，110家具/15HideSpot，正式地图未写 |
| 保存验证边界 | 临时探针一次字段断言错误、两次runner配置依赖自动重启导致请求取消/断开，均未改产品代码或掩盖；最终只关闭临时配置模块监听，源码HMR保留。标准配置保存后自动重启稳定性未完整验收 |
| 未重做 | 原生缩放、真人自然整局/试听、长期内存/硬件FPS、58项旧探针执行；不以短流程/单测冒充 |

#### Git检查点、风险及停止

- main、HEAD及真实远端main仍为上一公开快照，现场查询核实；暂存区为空，未add、commit、push、Tag，不更新阶段Gate。本轮未删除/移动原资源、读取私人目录或清理未知文件。
- 最终报告为 `docs/verification/FINAL_ENGINEERING_REPORT.md`，证据及精确候选提交清单在 `docs/verification/final-engineering/`。工程整理有条件通过（标准配置保存后重启链路待验收）；公开部署暂不允许（dist中v5/static约24.41MB授权未覆盖）。
- 现有v6原创公开授权不扩大至旧版。解除发布阻断需准确文件授权证据或用户明确批准替代回退部署策略；不虚构许可、不继续衍生新阶段。隔离服务已正常关闭，现有5173/4173不动；本轮完成后停止等待人工验收。

### 阵营选择卡片Hover重复播放修复 — 2026-10-15（Codex）

#### 完成内容

- 实际复现卡内数字/标题/说明切换触发4次播放调用及4个原生音频节点；pointerover冒泡且relatedTarget仍在卡内，监听单一、DOM稳定，箭头为卡内span无独立音效。
- 仅在ThreeGame原Hover委托处理器加入relatedTarget同按钮包含检查，内部切换静默，真正离开重进可再次播放；不改冷却、音频素材、卡片外观/布局/动画或点击选择。
- 新增3项真实处理器回归，修复前2失败/1通过，修复后3/3通过；临时浏览器探针仅在Temp及响应内观测，不将调试注入写入源码。

#### 自动化与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 相关 / 全量测试 | 17/17；npm test 893/893，失败/跳过/取消0，约57.30秒 |
| TypeScript / build / diff | 独立类型检查、生产build、diff及新增文本检查通过；保留既有大chunk告警及Node类型擦除实验性提示 |
| Chrome154 / Edge151 | 明确5173 URL/标题；1366×900、800×600，两卡各10秒内部跨数字/标题/图片/文字/箭头移动额外播放0；首次进入/重进各实际播放1次，四次跨卡切换4次，双阵营箭头点击/返回正常，pageerror0 |
| 保护 | 对照上一轮517项保护，仅本次授权的ThreeGame变化，其余516项不变；旧日志完整字节前缀保留，无资产/场景/私人目录操作 |

#### Git、限制与停止

- 已有S1/S2和收尾改动原样保留；本轮未暂存、commit、push或Tag，不改变阶段Gate、不创建新工程整理阶段。
- 报告及调用/浏览器证据见 `docs/verification/UI_HOVER_FIX_REPORT.md` 与 `docs/verification/ui-hover/`。原生节点验证不冒充主观听感；此前公开模型授权及标准保存重启条件仍保留。本轮完成后停止等待用户检查。

### 最终一次性工程收尾执行 — 2026-10-15（Codex）

#### 完成内容

- 用户正式批准生产v6→程序化兜底及排除v5/static生成副本，开发链和原件保留；本轮不新增整理阶段。DeepSeekGlbModel的PROD分支与构建六项精确名单同步，含动画运行失败的staticOnly入口；v6正常外观/动画/头发不变。
- 真实生产故障注入发现动画初始化失败重复释放模型两次；补回归先复现，再按是否挂avatar区分释放所有权，清除部分动画/头发初始化引用，最终资源释放1次。不修改模型文件或游戏规则。
- 新增5项模型生产/开发边界及3项初始化清理测试，更新原过滤名单断言；相关18/18通过，无删测/弱化。只改3处实现文件及1个既有测试，不动AI、平衡、地图、音频、UI、Hover或候选文件。

#### 自动化与浏览器验收

| 检查 | 实际结果 |
|---|---|
| npm test | 开工既有893项，中间898/898，最终901/901；失败/跳过/取消0，约60.25秒 |
| TypeScript / build / diff | 最终独立类型检查、生产构建、跟踪及新增文本diff检查通过，117模块；原大chunk和Node类型擦除实验性提示保留 |
| dist | 86文件/67,570,842→84文件/43,157,676字节；82静态/CSS输出哈希相同，JS/HTML随授权改动变化。六旧GLB名称/原件SHA匹配0，生产JS旧URL0；所有原GLB哈希不变 |
| Chrome154 / Edge151正常 | 开发5173与生产4173共24组合，双阵营/三难度/v6材质动画头发/移动/暂停设置/布局/DEV选择草稿导出/销毁通过；正常请求失败/HTTP错误/console error/pageerror均0 |
| 生产故障 / 开发回退 | 两浏览器两阵营×加载HTML/动画初始化/动画运行时失败共12组程序化兜底可移动，旧模型请求0、v6每页1次；初始化资源释放1次。开发另4次v5七动画/static回退通过，原哈希一致 |
| 标准DEV保存闭环 | 临时副本原npm dev命令、默认bundled配置、完整监听；两浏览器POST200/备份/revision、自动服务重启、自动浏览器重连/加载计数增加、手动刷新、完整停启服务后读取同一布局通过。未POST正式地图，临时5183已正常Ctrl+C停止 |
| Hover / 保护 | 生产两浏览器两尺寸、两卡各10秒内部移动追加播放0，进入/重进各1次，切换点击正常；518项保护514不变、4项授权改动，173B/46C继续保护，日志旧前缀保留 |

#### Git、授权边界及停止

- 最终报告§1和 `docs/verification/final-engineering/closeout/` 记录完整清单/哈希/浏览器及标准保存证据，首次报告旧结论作为历史快照保留。工程技术无条件通过、生产技术构建通过，保存缺口已关闭；不等于人工验收或归档Gate=PASS。
- 旧GLB公开分发阻断通过不分发解除；米袋、部分立绘/UI及派生输入平台未提供，相关平台条款仍未核实，不能宣称全素材授权通过，没有引入新第三方素材或虚构许可。
- 技术上建议准备Git审查，实际提交仍待用户最终核对许可/清单并单独授权；本轮未add、commit、push或Tag，未读取私人目录、清理未知文件或删除原件。原5173/4173服务保留，不创建后续整理阶段；到此停止等待人工验收。

### 阵营选择页右侧声音/难度设置 — 2026-10-15（Codex）

#### 完成内容

- 用户授权首页两个方形入口：右侧声音设置/当前难度，保留两卡原尺寸、图片、内部排版和页面背景。原底部难度无占位；宽屏左展开，窄屏正常流，低高度面板滚动不覆盖免责声明。复用单一AudioSettingsView和DifficultyView，不改音频播放、AI、平衡、地图或玩法。
- 新增首页轻量展示控制类，互斥展开、外部点击/ESC关闭、键盘焦点及完整注销；重复点击已选难度也关闭。修正短窗口面板/底栏相交和新按钮减少动态效果规则优先级，不扩大工程整理范围。

#### 自动化与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 测试/类型/构建/diff | 相关15/15，全量908/908，失败/取消/跳过0；独立TypeScript、生产build及diff检查通过，原大chunk提示保留 |
| Chrome154/Edge151 | 明确goto5173/4173并核对标题；开发六视口两卡内容/几何严格不变，两浏览器共12阵营×难度组合、五路音量实际GainNode/静音/刷新保存/默认值、ESC共享组件和重开返回通过 |
| 面板/Hover | 生产另八视口，无卡片或底栏相交/横向溢出，正常滚动；两浏览器两按钮各10秒内部移动仅一次play及实际音频节点，离开重进再一次，点击选择和键盘正常 |
| 保护/缺口 | 开工343项哈希337不变、6项授权源码/测试变化；原日志字节前缀保留。原生缩放及最终视觉由用户验收，未冒充主观试听；预览保留既有favicon.ico404，无新增游戏资源错误/pageerror |

#### Git、交接与停止

- 报告 `docs/verification/MENU_SETTINGS_REPORT.md`、精选截图及浏览器证据已保存；交接只新增本次当前状态。源码已有S1/S2/收尾工作原样保留，没有删除资源、访问私人目录或新增依赖。
- 未暂存、commit、push或Tag，不更新Gate、不启动其他功能或整理阶段；开发5173/预览4173供用户查看，本轮到此停止等待UI检查。

### 最终一次性工程收尾复验 — 2026-10-15（Codex）

#### 完成内容

- 用户再次授权最终收尾；先核对确认原生产隔离和保存恢复已实现，本轮只做完整复验，无新增源码/测试/配置/资产改动，不重写既有成果或启动新阶段。
- 生产使用v6，加载/动画初始化/运行失败时程序化兜底，生产代码不请求旧资源；开发v5/standalone链保留。实际dist六旧模型名称/原件SHA匹配0、生产旧URL0，所有原件未删未改。

#### 自动化与浏览器验收

| 检查 | 实际结果 |
|---|---|
| npm test / 类型 / 构建 / diff | 908/908，失败/取消/跳过0，约88.15秒；独立TypeScript、生产build、diff通过，既有大chunk提示保留 |
| dist / 保护 | 84文件、43,163,759字节，本轮构建前后相同；522/522保护哈希不变，173B及46C全保留，旧日志字节前缀不变 |
| Chrome154/Edge151 | 明确项目5173/4173 URL/标题；双阵营三难度共24正常组合、12生产故障、4开发回退通过，正常v6响应哈希/动画/头发/移动/暂停设置正常，无旧模型生产请求 |
| Hover | 两浏览器两尺寸两卡各10秒内部跨图/字/箭头移动新增播放0，首次进入与离开重进各1个实际音频节点，跨卡及点击正常 |
| 标准DEV保存恢复 | 全新5183副本原Vite配置及默认加载器/完整监听；两浏览器实际POST/备份→自动重启→自动重连重载→刷新→正常停止/启动→同一revision读取通过，正式地图未写，临时服务已关闭 |

#### 交接、授权风险与停止

- 更新最终报告最新复验节、交接摘要和 `docs/verification/final-engineering/recheck/` 证据，旧实现和历史记录保留；本轮不增加工程阶段，不删除候选或未知文件，不访问私人目录。
- 工程技术及技术发布验收通过，但米袋/部分立绘/UI及派生输入具体平台许可仍未全部核实，不能据技术通过宣称全资产公开授权通过；不虚构许可或平台。
- HEAD不变、暂存区为空；未add/commit/push/Tag。原正式开发/预览进程复用并保留，停止于用户最终验收，不自动继续任何优化或发布。

### S17–S19兼容性、性能与RC准备 — 2026-10-15（Codex）

#### 完成内容

- 用户明确授权一次性执行并补充正式版DEV隔离。开工保护既有S1/S2、最终收尾和首页设置改动；仅修复生产DEV对象/监听/预设读取/日志和地图调试生成，以及真实失焦时对局继续推进的问题。保留开发工具和编辑器保存，READY使用原独立时间源，正式暂停需明确继续。
- 无消费者时停止逐帧调试分析，原AI和真实音频照常更新；诊断关闭后事件队列仍正常消费。生产保存插件不提供POST端点，隔离实际请求404。未更改玩法、AI、数值、地图、角色/动画、音频或UI设计，没有新依赖或资产压缩。

#### 自动化测试与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 门禁 | 开工908/908，最终914/914，失败/取消/跳过0；独立TypeScript、生产build、diff和新增文本检查通过；既有大chunk提示保留 |
| 开发/生产 | Chrome154/Edge151明确URL/标题，5173/4173共24阵营难度组合；12生产模型故障及4开发旧回退、实际动画/头发/移动/暂停/设置通过 |
| 情景回归 | 两浏览器实际按键躲藏、进食开始/中断保留/恢复、门开关锁及PulseLock失败/成功通过；PulseLock锁门状态是标准API测试夹具，不计自然对局 |
| 自然时长 | NORMAL两阵营各两浏览器共4局，无加速/传送/改进度或判胜；Human主控两局DeepSeek AI约177秒5/5自然获胜，DeepSeek主控两局约46秒被正常抓捕；重开/返回通过，不冒充真人胜率统计 |
| DEV/资源 | 生产七DEV对象/存档读取/调试标签和编辑锚点为0，正式15个藏身提示保留；隔离标准Vite两浏览器POST/备份/自动重连重载/刷新/正常停启恢复通过，正式地图未写 |
| Hover/焦点/视口 | 两浏览器两尺寸两卡各10秒内部无额外音频节点；5种CSS视口无横溢，真实失焦READY冻结/PLAYING暂停及Fullscreen API通过；原生缩放未能可靠改变实际比例，未虚报通过 |
| 性能/保护 | RTX4060下1080p短时rAF约144FPS、首屏transfer约16.17MB；dist84文件/42,987,210字节，82静态/CSS产物不变；522开工哈希516不变，6项授权既有实现/测试变化，未删除文件、原日志字节前缀保留 |

#### Git检查点、限制与停止

- 报告 `docs/verification/S17_S19_RC_REPORT.md`、精选截图/JSON证据及README、交接已更新；两项新测试文件补6项回归。未add/commit/push/Tag/Release，不写阶段Gate=PASS，不开启S20或新增整理计划。
- 原生缩放、F11/对局中全屏、低配/长时间性能及集中主观体验待人工；S14教学/S15连续十局/S16三十局统计完整证据未核实，不补造历史。v6用户原创授权保留，米袋/部分立绘/UI平台条款未全核实，技术RC不等于全素材获准公开部署。
- 没有访问私人目录、删除候选/原件或清理未知文件；本轮临时5183/5184服务正常关闭，原5173/4173保留。完成可安全执行部分后停止，等待用户统一验收及后续单独Git授权。

### 暂停难度说明精简与Human AI速度回调 — 2026-10-15（Codex）

#### 完成内容

- 用户要求移除暂停页倍率/DEV说明，并反馈普通追捕偏强、困难过快。本轮仅将Human AI普通0.78→0.64、困难0.95→0.76，简单0.52及所有其他AI参数不变；不降低玩家能力、不修改30秒/5份或玩法。两阵营暂停只显示难度名称，DEV-B核查接口和持久化原样保留。
- 保留用户已修改的镜头viewHeight=8及全部未提交工程成果；没有改地图、模型、动画、音频、AI决策或UI布局。同步难度设计和数值索引，旧报告档位保留为历史，最新记录明确覆盖当前值。

#### 自动化与人工验收

| 检查 | 结果 |
|---|---|
| 自动化 | 全量915/915，失败/跳过/取消0，约70.26秒；独立TypeScript、生产构建通过，diff和保护检查完成；既有大chunk提示保留 |
| 回归 | 新增真实暂停赋值表达式的双阵营/三档/DEV覆盖短文本检查，仅更新两项获准倍率预期；先观察失败再修复，未删除或放宽测试 |
| 浏览器 | 独立Chrome154/Edge151明确生产4173 URL/标题，12阵营难度组合、实际配置和AI位移上界、暂停短文本、重开保留/返回/刷新偏好专项验证；结果及精选截图见难度报告最新节 |
| 人工 | 新速度的追捕压力和主观难度梯度待用户试玩；有限回归不等于双方胜率已平衡，未重新宣称整局/统计试玩通过 |

#### Git检查点与限制

- 只更新2处实现、1个测试及必要文档/证据，旧日志字节前缀保留；正式预览复用原4173服务并重建，玩家当前页面需刷新后使用新产物。
- 未add/commit/push/Tag，不改变阶段Gate，不访问私人目录、不清理未知文件；完成后停止等待用户试玩反馈。

### 生活投掷物与2秒倒地眩晕 — 2026-10-15（Codex）

#### 完成内容

- 用户批准完整实现及补充规则。18个可玩区域各2件生活物，8花瓶/18盒子/10盆；原创程序化造型和独立初始布局JSON，不修改原家具、地图或资产。F拾取、左键按住瞄准/面向实际落点/松开锁定投掷、右键取消，双方玩家通用。
- 花瓶/盒子出手后一次性消耗，盆落地禁拾500ms后可回收；单一状态权威和连续保守扫掠阻挡墙、动态门及旋转家具，移动目标可躲避，隐藏人物与投掷者免于本次碰撞。命中2000ms倒地眩晕，复用动作层，暂停冻结、重开恢复，不新增NPC投掷策略、AI感知或其他胜负规则。
- 原GAME_CONFIG除新增throwables块完全保持开工字节，简单0.52/普通0.64/困难0.76、镜头8、30秒/5份和旧技能不变。新眩晕禁止动作/交互/抓捕，进食保留进度并重准备；原冲刺摔倒计时独立，不缩短既有眩晕。

#### 自动化测试与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 门禁 | 开工915/915，最终931/931，失败/取消/跳过0；新增16项回归，独立TypeScript、生产build、diff通过；既有大chunk提示保留 |
| 回归修复 | 首轮930项中既有深度修正调用顺序检查失败，通过把新表现同步移至深度修正之前解决，原测试不改；后补朝向/倒地恢复后全量931项通过 |
| Chrome/Edge | 明确4173 URL/标题，双阵营实际F/鼠标三物件、四向镜头朝向/取消、暂停冻结、实际走近回收盆、NPC命中不动及恢复、玩家受击控制门控、重开/返回/刷新/销毁通过；另两浏览器12阵营难度组合仍通过 |
| 真实进食 | 两浏览器按住E产生真实进度后受击，进度冻结保留、咀嚼循环停止，恢复后重准备再增长；无米进度/胜负写入 |
| DEV保存 | 标准Vite5183隔离副本两浏览器真实保存/备份→自动重启重连→刷新→正常停启恢复通过，110家具/15HideSpot/36物件及独立JSON未丢；正式地图未写，临时服务正常关闭 |
| 保护 | 337项开工哈希332不变，仅5项授权既有实现变化，缺失0，原日志前缀完整；新物件不引入外部素材/依赖，六旧模型仍排除生产包、原件全部保留 |

#### Git检查点、限制与停止

- 新增系统/View/布局/测试及必要报告、操作、参数与来源记录；正式4173复用原服务并更新构建，用户需刷新新局。未add/commit/push/Tag，不建立阶段Gate，不访问私人目录、删除候选或清理未知文件。
- 浏览器命中使用明确合法场景夹具，玩家受击由domain API发射敌方测试物并冻结发射者，仅用于检查2秒控制门控，不声称NPC自动投掷或自然完整对局。CSS视口/短时性能与原生缩放、低配长测分开；循环盆和连砸压制需用户试玩，不宣称统计平衡。
- 完整规则、截图、参数、测试证据及剩余风险见 `docs/verification/THROWABLES_REPORT.md`。本轮完成后停止，等待用户统一试玩及后续单独授权。

### 生活投掷物同轮最终复核补记 — 2026-10-15（Codex）

#### 完成与验证

- 最后接线复核发现射弹原先在本帧角色移动前扫掠，移动目标存在一帧位置错位风险。眩晕/冷却仍在帧首计时，射弹移至双方完成碰撞移动之后、进食和抓捕之前；只修正本轮新增接线，不改变旧移动或AI决策。新增时序回归先失败后通过。
- 最终新增17项，全量932/932，失败/取消/跳过0，约57.55秒；独立TypeScript与生产构建通过，Git差异检查及保护检查通过。上条931项为追加最终时序测试前的真实中间结果，历史记录保留不回改。
- Chrome154/Edge151再次完整通过双阵营实际拾取/瞄准/投掷/回收/受击、进食中断重准备与四组CSS视口；暂停探针改为确认PAUSED再松鼠标，排除脚本早于帧处理的竞态，持有和冻结断言不放宽。隔离DEV更新本轮最终源码后再次完整停启读取成功，正式地图哈希仍不变。
- 最终dist84文件、43,004,824字节；337项保护中332不变、仅5项获准实现变化、缺失0，旧配置字节/原日志前缀/模型/音频/地图/AI保留。最终截图与JSON证据见 `docs/verification/throwables/`，报告记录性能短测与人工验收边界。

#### Git与限制

- 暂存区空，未commit/push/Tag，正式5173/4173服务保留，隔离测试服务停止。新玩法密度、瞄准手感、连续盆压制、原生缩放及长时间低配性能仍待用户集中试玩；不自动开始下一项开发。

### 暂停提示精简 — 2026-10-15（Codex）

- 用户要求移除“饭还热着，准备好了就继续。”；仅修改ThreeGame暂停摘要的一处字符串为“游戏已暂停。”，其他布局、设置、难度及玩法不变。遵循ponytail最小改动原则，不新增组件或依赖。
- 全量932/932，失败/取消/跳过0；独立TypeScript、生产构建、git diff检查通过，既有大chunk警告保留。Chrome/Edge新受控实例明确打开并核验生产4173 URL及标题，实际进入对局按ESC，摘要严格等于新文案。
- 正式预览产物已更新；更新交接并仅追加本条日志，未暂存/commit/push/Tag，不推进阶段Gate。用户刷新页面后查看即可。

### Human恢复、投掷物编辑与3秒眩晕 — 2026-10-15（Codex）

#### 完成内容

- 用户在Human试作交付前要求恢复旧版；AlphaPresentation与试作前文件逐字节一致，仅撤销本轮自行新建的HumanHomeModel及其专属测试，原始模型/资源和此前成果不动。试作中934项通过是中间状态，不将未验收外观写成正式成果。
- 原场景编辑器接入投掷物选择、复用拾取拖动/高亮/聚焦、X/Z输入和独立草稿/应用/保存；项目仍读写throwableLayout.json，不移动110件家具或15个HideSpot。DEV接口版本冲突拒绝、备份及原子替换，编辑预览不复活本局已消耗物件。
- 轨迹改米白虚线并刷新线段距离；用户批准命中眩晕3000ms，重复命中刷新不累加，原冲刺摔倒时长及其他参数不动。

#### 测试与验收

| 检查 | 结果 |
|---|---|
| 自动化 | 最终937/937，失败/取消/跳过0，约71.29秒；新增5项编辑回归，更新获准3秒精确时长断言；独立TypeScript、生产构建及diff通过，既有大chunk警告保留 |
| Chrome/Edge | 生产4173明确页面身份，双阵营原Human、虚线与3000ms实际配置、拾取/投掷/盆回收/受击/暂停/重开通过；沿用合法夹具，不冒充自然完整对局 |
| 保存恢复 | 标准5183隔离副本两浏览器原生拖动、数字输入、应用、POST200、备份、HMR刷新、手动刷新和完整停服启动读取通过；冲突POST409未覆盖，正式两个JSON未写 |
| 保护 | 比较324项既有源码/测试/资源，仅8项授权实现/测试变化，缺失0；Human恢复、旧日志字节前缀保留，除眩晕外旧GAME_CONFIG字节一致，地图/AI/难度/v6/音频不动 |

#### Git与限制

- 更新交接、数值索引、README和专用验收报告/证据；未暂存、commit、push或Tag，不创建阶段或推进Gate，临时服务器停止，原5173/4173保留。
- 正式预览已重建，刷新新局查看；道具位置编辑须用开发5173，按独立应用/保存操作。用户仍需确认摆放、虚线可读性与3秒压制手感；不宣称胜率重新平衡。详情见 `docs/verification/THROWABLE_EDITOR_REPORT.md`。

### 道具通用保存刷新回退修复 — 2026-10-15（Codex）

#### 完成内容

- 依diagnosing-bugs建立真实红色反馈：隔离Chrome把道具-6.40改为-6.39，通用“应用编辑 / 保存布局”后刷新仍-6.40。根因是通用方法和顶部保存读数只处理家具，前轮专用按钮验收未覆盖该常见入口；不是用户坐标被代理重置。
- 最小接通通用应用、放弃、保存和状态汇总。联合保存先核对两个文件版本/候选数据，备份后逐文件原子替换，专用与联合入口共享锁；冲突和校验拒绝不落盘，IO失败不虚报成功。两布局仍分文件，不新增玩法或修改数值。保存提示区分5173刷新与4173重新构建。

#### 验证

| 项目 | 实际结果 |
|---|---|
| 回归 | 新增编排层4项先全部失败，修复后全部通过；包含原编辑器的相关37/37通过，最后相关9/9再次通过 |
| 全量 | 修前936/937，修后940/941；唯一失败均为difficulty.test.mjs:263，NORMAL/20276765固定路线最终PLAYING而非FINISHED。未删改原断言，不修改用户地图或AI解决本轮范围外失败 |
| 类型/构建 | 独立TypeScript与生产构建通过，diff检查通过，既有大chunk警告保留 |
| Chrome/Edge | 标准5183隔离副本通用应用/保存/刷新原复现链绿；家具+道具同时应用/保存、状态准确、409冲突和400非法道具均不写文件、完整停服启动恢复通过；4173生产实际进入/暂停检查通过 |
| 保护 | 正式sceneLayout及throwableLayout与本轮开工哈希一致，用户新增家具排布保留；玩法配置、AI、难度、角色及音频不改；旧日志字节前缀保留 |

#### Git与后续

- 更新README、交接及既有报告，证据在 `docs/verification/prop-save-fix/`；未暂存、commit、push或Tag，未开新阶段。
- 临时服务正常停止，原5173/4173保留，正式预览已重建。未真正写入文件的旧道具草稿没有可核实坐标，不擅自猜测恢复；用户需重新调整一次，之后可统一用上方按钮保存。旧固定路线失败另列已知问题，本轮到此停止。

### 用户MP3不锈钢盆命中音 — 2026-10-15（Codex）

#### 完成内容

- 按用户指示将“钢管 落地.MP3”原字节复制为basinHit.mp3（26381字节），不改原文件或原37个Ogg。最小增加真实命中回调和一个音频事件，只在盆命中角色时播放一次，其他物件或落空/墙阻挡不触发。
- 沿用现有世界音衰减/遮挡、SFX/Master/静音、缓存及暂停重开清理，不改AI感知或玩法；原命中提示固定2秒改读现有配置显示3秒。用户手持位置0.60/0.55、两个布局JSON、模型、难度和GAME_CONFIG不动。

#### 测试与试听

| 检查 | 结果 |
|---|---|
| 回归 | 新增真实命中类型/单次/负例回调及SFX静音/暂停/重置两项通过；相关28/29，旧点位距离断言失败保留 |
| 全量 | 941/943，失败2，跳过/取消0；difficulty.test.mjs:263既有固定路线失败，throwables.test.mjs:35当前throw_closet_1不满足旧初始1.8距离断言。未删除、跳过或放宽断言，不改用户摆放迎合测试 |
| 门禁 | 独立TypeScript、生产build、git diff通过，既有大chunk告警保留 |
| Chrome/Edge | 明确4173 URL/标题，两阵营原生鼠标投掷：盆命中一次真实MP3节点、其他物品命中/盆落空无金属声、静音/暂停清理通过；解码波形非零，不能代替用户主观试听 |

#### Git及限制

- 用户来源文件及公开分发许可不推断为原创，来源文档标记待核验；本轮仅本地接入。未暂存、commit、push或Tag，未创建阶段或推进Gate。正式4173已重建，刷新后可试听；音频报告及basin-hit证据记录实际验证。

### DeepSeek娘被抓失败音NOPE — 2026-10-16（Codex）

#### 完成内容

- 按用户指示原字节接入NOPE.mp3为deepseekCaughtDefeat.mp3；仅DeepSeek主控CAPTURED失败替换通用失败音，一次结算一次，不叠加defeat。Human失败及双方胜利、抓捕动作声、盆命中音和五项停用不变；复用UI/Master音量及清理，无AI听觉或玩法变更。

#### 自动化与浏览器

| 检查 | 结果 |
|---|---|
| 回归 | 音频13/13，新增结果四组合/100帧单次及静音/暂停/重置2项通过 |
| 全量 | 943/945、失败2、跳过/取消0；既有difficulty.test.mjs:263固定路线结算及throwables.test.mjs:35初始距离断言保留，未改AI/用户布局或放宽断言 |
| 门禁 | 独立TypeScript、生产build、diff通过；既有大chunk警告保留 |
| 浏览器 | Chrome/Edge明确4173 URL/标题，各4种真实结算夹具：正确音效只启动一次、非零解码、返回清理、资源/页面无新增异常；不是自然整局或人耳试听 |
| 保护 | 329项既有文件仅3个获准实现/测试文件变化，无缺失；38旧音频、配置/AI/模型/布局/手持位置不变，历史日志前缀保留 |

#### Git与限制

- 更新S13报告、来源记录与交接，证据在 `docs/verification/deepseek-caught-audio/`；4173已重建，刷新可试听。未暂存、commit、push或Tag，不创建阶段或推进Gate。
- 用户来源文件未改，公开分发/商业许可待核验，音量主观效果待用户试听；不宣称全量测试或全部素材授权通过。本轮完成停止。

### 固定路线结算及道具点位回归修正 — 2026-10-16（Codex）

#### 完成内容

- 两项原测试稳定复现0/2。轨迹与对照显示NORMAL/20276765是持续守点迫使AI避让，不是锁门不可达；游戏无对局时限。固定路线改为180秒真实追逐后沿合法寻路/碰撞撤离，保留12000帧预算、锁门逐米可达与最终FINISHED，新增DeepSeek胜必须5/5及RICE_COMPLETED断言。未修改AI或强迫胜利。
- 道具旧1.8初始留白/现房间永久两件假设与编辑保存规则不一致，用户已合法移动及跨区摆放。测试改查实际保存契约、36件及原稳定ID、所属房间和碰撞，新增3项边界/重叠/跨区回归；没有修改点位、保存阈值或玩法。

#### 验证

| 检查 | 结果 |
|---|---|
| 定向 | 修后2/2；道具/编辑保存相关30/30 |
| 固定路线 | 三档×三种子9组合结算，9次锁门可达检查通过；7局DeepSeek5/5、2局Human提前抓捕，不冒称全AI胜利 |
| 全量 | 948/948，失败/跳过/取消0，约63.07秒 |
| 类型/构建/diff | 全部通过，既有大chunk告警保留 |
| 保护 | 仅两个测试文件变化；所有运行源码、数值、布局、模型及39音频不变，无文件缺失，旧日志字节前缀保留 |
| 浏览器 | 本轮未重跑；仅测试/文档变化，Node真系统仿真不等于浏览器或真人验收 |

#### Git及限制

- 新增 `docs/verification/TEST_CONTRACT_FIX_REPORT.md` 和定向证据，更新交接；未暂存/commit/push/Tag，不创建阶段或推进Gate。
- 本轮是测试前提修正，不是AI行为修复；原连续守点场景仍可能长时间不结算，不能承诺无对局时限游戏在固定时间必结束。用户点位/自由摆放保留，素材授权及主观平衡仍按既有待验收项管理。完成后停止。

### 正式预览玩法同步与Z/C镜头快捷键隔离 — 2026-10-16（Codex）

#### 完成内容

- 用户要求当前玩法同步正式版、Z/C不进入正式版。只给ThreeGame原镜头输入块添加DEV编译边界，配套X恢复也只留开发版；正常镜头跟随、相对移动、用户镜头参数不改。README说明开发/正式区别，未重构相机。
- 新增生产常量折叠回归先红后绿，标准build同步当前投掷、3000ms眩晕、盆命中音、NOPE及已保存道具位置到本地4173；不是公开站点发布。

#### 验证

| 检查 | 结果 |
|---|---|
| 自动化 | 全量949/949、失败/跳过/取消0；生产工具5/5 |
| TypeScript/build/diff | 全部通过，既有大chunk告警保留 |
| Chrome/Edge | 开发/生产双阵营8会话：原生Z/C/X正式无效、DEV有效，实际移动、暂停/恢复及资源正常；另生产盆真实投掷音4会话通过，不冒充人耳试听或自然整局 |
| 保护/同步 | 运行实现前快照330项（已含新增回归），仅ThreeGame变化，无丢失；配置/AI/布局/模型/39音频及手持位置不变，39音频生产字节匹配，八会话36道具位置匹配当前JSON |

#### Git及限制

- 更新交接、README及同步报告，AGENT_LOG仅追加；证据在 `docs/verification/production-preview-sync/`。原5173/4173保留，4173刷新加载新包；未暂存/commit/push/Tag，不创建阶段或推进Gate。
- 本轮仅本地正式预览同步，未上传站点；用户提供音频公开分发许可待核验，主观试听仍由用户确认。完成后停止。

### S19候选快照提交前审查 — 2026-10-16（Codex）

#### 完成内容

- 按用户授权审查完整待提交差异，36个跟踪修改及1220个非私人未跟踪文件逐项分类；不读三个私人目录内容、不修改玩法或清理未知文件。输出193路径建议清单、2个新增MP3待许可项、1066个排除文件明细及38个既有素材证据缺口。
- 使用HEAD只读归档构造隔离候选运行副本，验证所需新增模块/测试/脚本完整；待许可MP3仅供本地验证，没有漏交文件后假称完整。未改变两个布局、数值、AI、素材或版本号。

#### 验证

| 检查 | 结果 |
|---|---|
| 工作区全量 | 949/949，失败/跳过/取消0；约52.57秒 |
| 隔离候选全量 | 949/949，失败/跳过/取消0；约58.27秒 |
| TypeScript/build | 工作区和隔离副本均通过，既有大chunk告警保留 |
| diff/空白 | git diff --check通过，另122份未跟踪候选文本no-index检查无问题 |
| 保护 | 330项运行源码/测试/资产哈希不变，无丢失；历史日志字节前缀保留 |
| 生产包 | 86文件/43049716字节，六旧GLB与URL及Z/C/X快捷键缺席；原件保留 |
| 安全扫描 | 明显凭据模式未命中；34份含本机路径的未跟踪材料排除，30精选截图联系表复核，不声称普遍无敏感信息或全素材授权通过 |
| 浏览器 | 本轮没有重跑自然整局/试听/线上部署，保留此前验证的明确边界 |

#### Git与结论

- 远端main与本地审查基线一致，无进行中的合并/变基；暂存区为空。未执行add、commit、push或Tag，不更新Gate，不创建新的工程阶段。
- 技术门禁与候选运行完整性通过，完整公开快照仍待素材公开许可、用户最终验收及后续Git授权。本轮仅新增5份审查交付、更新交接及追加日志；具体路径见 `docs/verification/S19_SNAPSHOT_REVIEW.md`，完成后停止。

### S19本地快照归档检查与推送边界 — 2026-10-16（Codex）

#### 完成内容

- 用户明确批准按一次性归档提示词执行精确暂存、正常本地提交；公开许可不齐则完成本地快照但不push，不创建Tag。复核193项清单及2段本地接入MP3，共195个具体路径；不漏运行依赖、不改玩法、不删除素材或未知文件。
- 远端main复核未出现新提交，开工暂存区为空、无合并/变基。两MP3及38项既有素材仍缺公开分发证据，故本轮选择完整本地归档、不执行公开推送，不将用户本地使用授权写成素材版权证明。

#### 自动化与人工验收

| 检查 | 结果 |
|---|---|
| 全量 | 949/949，失败/跳过/取消0，约56.75秒 |
| 独立TypeScript/build/diff | 全部通过；既有500kB大chunk告警保留 |
| 保护与排除 | 330项运行源码/测试/资产哈希不变；1066项排除材料原样保留，三个私人目录未读取 |
| 生产包 | 86文件/43049716字节，六旧GLB及其URL与Z/C/X快捷键缺席；本地原始GLB和39音频不变 |
| 浏览器 | 本轮为Git归档，未重跑浏览器或主观试听，既有证据不扩展为新人工验收 |

#### Git检查点与限制

- 本次归档标题为 `feat: integrate S19 gameplay and production isolation`，精确暂存清单为193建议路径加2段本地MP3；Git实际结果及完整提交编号见本轮回报与 `git log`，不在文档写死当前SHA。
- 公开分发证据不齐，按授权策略不push、不创建Tag或Release、不部署站点，不标记Gate=PASS。仅更新必要交接并追加本条；候选文件及私人资料全部保留，完成归档后停止，不启动新工程阶段。

### 素材来源补充及S19公开归档核对 — 2026-10-16（Codex）

#### 完成内容

- 用户补充38项既有素材为GPT生成且可公开使用，随后更正两MP3为updream语音生成，项目仅用于非商业学习。来源账本与README分别记录实际平台和AI生成说明；不将用户声明写成独立生成过程鉴定，不新设开源许可。
- 独立未登录Chrome实际打开updream官网页脚知识产权声明及用户协议，核对生成输出权利和标识义务；结合用户公开使用声明解除本次来源未明确阻断。保留历史审查CSV/报告和旧日志原文，不以非商业用途免除第三方权利责任。

#### 检查与Git边界

- 本轮仅四份文档更新和Git归档，无源码/测试/布局/音频/模型变化；不重复运行游戏测试、TypeScript或构建，沿用紧邻归档轮949/949及类型/build通过结果，本轮另检查diff、暂存清单及保护文件哈希。没有新增浏览器游戏或人工验收。
- S19本地历史提交 `9e76e908fa89c57a92bdff404d3c5bb27c8c8df7` 已包含195路径；本轮以 `docs: record AI asset provenance for S19 publication` 记录来源补充，正常新提交，不amend历史。仅暂存README、来源账本、交接和本条日志，按先前授权复核远端后普通推送main；实际Git结果以回报和Git查询为准。
- 不创建Tag或Release、不部署网站、不标记新Gate、不改玩法或访问私人目录；1066项本机材料及旧GLB原件继续保护。特定输入/音色/模型及第三方品牌权利仍不作无条件保证，完成后停止。

### S19候选版里程碑 v1.0.0-rc1 — 2026-10-16（Codex）

#### 完成内容

- 用户确认按阶段总表将当前版本发布为带已知限制的S19候选试玩版，授权附注Tag和GitHub预发布Release。package及lock根版本同步1.0.0-rc1，首页沿用package读取；新增里程碑表、候选版说明及README入口，不更改玩法、素材、依赖或原始文档。
- GitHub现有登录凭据仅在内存用于权限核对和获授权Release操作，不读私人配置、不输出凭据、不创建Token；预检仓库匹配、具有push权限、同名Release不存在。使用正常提交/推送，不amend，不补打历史Tag。

#### 自动化与人工验收

| 检查 | 结果 |
|---|---|
| 全量 | 949/949，失败/跳过/取消0，约55.20秒 |
| 类型/build/diff | 独立TypeScript及生产构建通过，diff无错误；既有大chunk提示保留 |
| 保护 | 330项运行源码/测试/资产哈希不变；package/lock除根版本外结构与依赖树一致 |
| Chrome/Edge | 独立新实例明确4173 URL/页面身份，首页均显示v1.0.0-rc1，无pageerror；不是重新跑自然整局/主观试听 |

#### Git里程碑与下一步

- 本次提交标题 `chore: prepare S19 v1.0.0-rc1 milestone`；附注Tag及预发布Release名称为v1.0.0-rc1，实际提交落点/创建结果/远端同步以本轮回报和Git查询为准，不标记为v1.0.0正式上线。
- 用户选择GitHub Pages，但只批准本轮先制定完整部署方案，未批准实际部署或修改Pages设置。归档后仅只读核对base/资源/构建/工作流需要，保留S14/S15/S16及低配/长测等已知限制，不补造历史Gate证据；1066项本机材料及私人目录继续保护。

### S19里程碑发布结果与GitHub Pages部署前方案 — 2026-10-16（Codex）

#### 已完成结果

- S19版本归档正常提交落点 `870c69050cf80ff83aa79531e7d9f2590a8834d5`；附注Tag v1.0.0-rc1对象为 `b7194124e0c328ff59882642392e17c60f39ee28`，main与Tag已正常推送，远端剥离Tag与归档提交一致。未移动历史Tag或创建v1.0.0。
- 实际创建并再次读取同名GitHub Release，prerelease=true、draft=false，附件0；URL为 https://github.com/yunzha-bot/who-ate-my-rice/releases/tag/v1.0.0-rc1 。用户接受的是带已知限制的候选试玩版，不是所有历史验收无条件通过或游戏网站上线。

#### Pages只读审查与方案

- 用户选GitHub Pages，并要求先出完整方案、未经明确批准不部署或修改设置。依research技能并行核对官方GitHub/Vite及实际源码，仅新增方案文档；主任务复核并补充安装devDependencies、最小权限与configure-pages位置等执行风险。
- 独立Chrome/Edge加载当前dist的严格本地 `/who-ate-my-rice/` 子路径，HTML200/标题正确，但JS/CSS到根/assets请求404，菜单未挂载；这是当前路径不兼容的诊断实证，不是实施后测试失败，也不是实际Pages线上验收。临时只读服务已正常关闭，原4173/5173保留。
- 仅GET核对公开仓库/main/Actions enabled=true，Pages GET404；未写Pages设置、创建workflow或触发部署。当前dist86文件/43049720字节，无测试/私人/备份等非预期材料、仅正式v6及米袋，旧模型与Z/C/X生产分支缺席。
- 完整改动候选、生产限定dist上传、门禁/12会话子路径验证、HTTPS及线上验证、版本不移动/回滚和风险见 `docs/verification/GITHUB_PAGES_DEPLOYMENT_PLAN.md`。本方案及本条交接日志补充仅保留本地待用户审阅，不为制定方案额外提交/推送，不实施源码/配置/设置改动，不自动进入S20。

### S19 GitHub Pages适配与本地验收 — 2026-10-16（Codex）

#### 完成内容

- 用户批准本地修复/手动工作流准备，不批准推送、Pages设置或触发部署。按ponytail/diagnosing-bugs最小修改4个代码/配置文件的base/模型/立绘URL；研究技能仅委派网络及存储只读审查，主任务复核。音频与CSS已支持base，不改素材、布局、玩法、难度或DEV隔离。
- 新增9项回归、只读产物门禁和固定官方Action SHA的手动Pages工作流，仅dist上传、不自动启用Pages；完成大陆真实无代理验收计划。根正式预览重新build，36个投掷物位置与保存JSON一致、36模型可见，不直接读取用户旧标签页或归咎为确定的缓存原因。

#### 自动化与浏览器验收

| 检查 | 实际结果 |
|---|---|
| 基线/最终全量 | 949/949 → 958/958，失败/取消/跳过0；最后一轮约101.18秒，含并行浏览器负载 |
| 类型/构建/diff | 独立tsc、默认根构建、隔离Pages生产构建、产物与diff检查通过；既有chunk警告保留 |
| 保护 | 开工339项中333项不变，6项授权代码/说明变化；6本地旧GLB和全部玩法/地图/音频不变，日志原字节前缀保持 |
| Pages产物 | 86文件/43,050,301字节；83public原字节，正式v6/米袋两GLB，旧模型同内容副本0，无私人/测试/备份/DEV或ZCX；复建清单一致 |
| Chrome/Edge | 各6诊断＋6原包组合，严格子路径、实际配置、移动投掷、暂停设置重开、5视口、两卡各10秒Hover、模型/动画兜底完成；最终原包Network失败/pageerror均0，39音频全解码 |
| 开发环境 | 原5173/4173保留；两浏览器DEV编辑器打开/关闭正常，无保存POST，未改正式数据 |

#### Git与已知限制

- 未暂存、commit、push或触发线上工作流；远端main及原rc1剥离Tag仍为历史落点870c69050cf80ff83aa79531e7d9f2590a8834d5，原Tag/Release不动，不创建rc2/v1.0.0、不更新新阶段Gate。
- 诊断及较早一次Edge原包曾记录v6 ERR_ABORTED但模型动画就绪，保留而不以最终复验零失败抹除；完全禁止localStorage getter时的既有启动失败已故障注入确认，本轮仅审查不越界改ThreeGame。公网HTTPS、实际Linux Actions、大陆三运营商无代理和原生缩放未验，不冒充通过；素材权利边界沿用账本。
- 详见 `docs/verification/GITHUB_PAGES_LOCAL_ACCEPTANCE_REPORT.md`、`GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md`及`pages-local/`真实清单/截图。临时服务关闭，停止等待用户第二次验收与独立上线授权，不扩展新阶段。

### S19-P首次RC部署准入 — 2026-10-16（Codex）

#### 完成内容与授权

- 用户批准第二次验收，允许最小getter修复、门禁后精确commit/push和首次手动Pages RC部署，不创建新Tag/Release、不代表S20验收完成。ThreeGame只为音频存储参数添加try/catch；声音系统、玩法、UI、AI、地图、36道具点位及全部素材不改。
- 新增5项真实字段初始化回归，先复现getter SecurityError（4通过1失败），修复后5/5；手动工作流增加approved_sha防止触发时main变化，不启用push部署。旧原始v6取消和存储失败记录保留，新证据放s19-p，不覆写pages-local。

#### 测试与本地验收

| 检查 | 结果 |
|---|---|
| 全量 | 963/963，失败/取消/跳过0，最终约84.95秒 |
| 类型/构建/diff | 独立tsc、根路径及隔离Pages生产构建、产物和diff检查通过，保留大chunk提示 |
| 保护 | 原339项集合332不变，仅授权5代码/配置及README/方案变化；本轮日志开工前缀保持 |
| 存储浏览器 | Chrome/Edge正常、getItem拒绝、setItem拒绝、getter SecurityError共8项全部启动/选择成功 |
| 功能浏览器 | 各6诊断＋6原包组合、39音频、v6/动画、投掷/暂停设置/重开/布局/Hover/DEV与ZCX隔离完成；Edge原包保留1次v6取消观察，pageerror0 |
| Pages产物 | 86文件/43,050,329字节；83public原字节、仅正式v6与米袋，无旧GLB/私人/测试/备份/DEV材料 |

#### Git、部署与限制

- 本条只记录实际完成的本地准入；Git推送、Actions及公网结果完成后另追加，不预填成功。精确提交清单和结果见S19_P_RC_DEPLOYMENT_REPORT.md。原Tag/Release及5173/4173服务不动，不清理任何未知文件。
- 已用现有凭据只读核对repo admin/push/workflow权限、Actions启用、Pages尚无站点；不创建新Token。大陆三运营商无代理、自然对局平衡和原生缩放等不冒充完成；素材权利边界沿用账本。

### S19-P首次RC提交、部署与公网检查结果 — 2026-10-16（Codex）

#### Git与部署事实

- 经用户明确授权、全部本地门禁后，精确审查/暂存36文件，正常提交并推送`e9f361fce9dd5f392e2165ec2cf0b5f1148ed108`，标题`fix: prepare S19-P RC Pages deployment and safe storage startup`；HEAD、origin/main和远端一致。无强推、amend、旧模型/私人/备份清理或未知进程终止。
- 原rc1附注Tag对象b7194124e0c328ff59882642392e17c60f39ee28及剥离落点870c69050cf80ff83aa79531e7d9f2590a8834d5不动，原Release ID414708471内容指纹复核不变。未创建rc2、v1.0.0、新Tag或新Release。
- Pages首次创建为workflow来源、HTTPS启用，手动调度一次并传approved_sha；Actions运行38897897043（https://github.com/yunzha-bot/who-ate-my-rice/actions/runs/38897897043）来源为上述提交，build/deploy和整体success，实际RC网址 https://yunzha-bot.github.io/who-ate-my-rice/ 。新版dispatch成功返回200，临时工具旧204断言经官方契约和GET纠正，仅核对原运行，没有二次调度或绕过门禁。

#### 公网验收与停止条件

| 项目 | 实际结果 |
|---|---|
| Chrome/Edge | 各6原包UI＋6内存观察夹具组合；两模型HTTP200/v6动画就绪，39音频全解码，移动投掷/暂停设置/DEV-ZCX隔离正常 |
| Network/控制台 | 本次会话v6取消0、pageerror0，游戏资源记录无404；只读CDP确认根favicon.ico 404，保留不修线上 |
| CI产物独立核验 | 下载完整artifact超时：The operation was aborted due to timeout；未取得zip，公网逐文件SHA比对未执行，不能宣称完整验收通过 |
| 大陆无代理 | 未实际覆盖三运营商，当前出口/代理未独立核实，不把可访问当作大陆无代理通过 |

- 按用户规则停止后续发布操作，不重跑部署、不追加push、不修改Pages/线上内容或加载策略。公网浏览器检查原与下载并行启动，收集已启动只读结果和控制台分类，未用其替代归档比对。失败后本条/报告/交接及公网证据留本地，不执行新的Git归档。
- 详见S19_P_RC_DEPLOYMENT_REPORT.md及s19-p公网证据。首次RC网页已部署，但完整公网验收保留，不标记S20或正式v1.0.0，不进入任何新阶段。原5173/4173和模型/地图/36道具/音频均保持，等待用户对只读产物核验的下一步决定。

### S19-P原始CI Artifact与公网文件SHA-256只读补验 — 2026-10-16（Codex）

#### 完成内容

- 用户仅批准验证及本地记录；锁定Run38897897043/run_attempt1与提交`e9f361fce9dd5f392e2165ec2cf0b5f1148ed108`。原github-pages Artifact12044274455未过期，完整下载40,299,469字节，SHA-256`c21a3c56c507e681e0aab75ccebf928a72264ef281ad79e03ac8bbb6bf514e08`匹配GitHub digest，ZIP CRC/TAR路径与普通文件检查通过。
- 本轮单连接实测慢速后仅停止自己的核验下载进程、保留部分文件；第二次以4个严格206/Content-Range分段取得同一原始归档，没有重新构建或部署。临时Python探针显式UTF-8修正路径解码后完成检查，不改原归档或游戏文件。
- 实际85个公开文件、43,050,329字节；公网逐项解码后实体长度与SHA-256全部一致。含v6/米袋两个GLB、全部39音频及所有其他公开文件；82项public内容同时匹配指定提交Git blob。未以本地Windows或新Linux构建冒充原始CI。

#### 验证结果

| 检查 | 实际结果 |
|---|---|
| 原始归档完整性 | GitHub digest、总长度、ZIP CRC及TAR边界通过 |
| 公网逐项一致性 | 85/85，失败文件0、未核验文件0；路径集合独立复核通过 |
| HTTP内容编码 | 8项实际gzip按解码后内容哈希；临时回环gzip/Brotli自检通过，不混淆传输Content-Length |
| 保护与版本 | 336项开工保护哈希、日志原前缀、main、原rc1 Tag/Release及Run attempt均不变；索引为空 |
| 游戏测试/TypeScript/build | 本轮未重跑；仅只读网络与文档核验，用户禁止重建，不冒称上一轮963项为本轮结果 |
| 文档与证据 | 追加S19-P报告§6、同步精简交接、保存7份JSON证据；文档diff及证据检查通过 |

#### Git检查点与限制

- 本轮未暂存、commit、push、修改Pages/线上内容、触发Actions或创建Tag/Release；历史部署落点不变。原5173/4173监听进程和全部本地备份保留，未访问私人目录或清理未知文件。
- 原始CI Artifact与公网哈希核验真正闭合；旧超时/v6取消记录不回改。maps/.gitkeep原本不上传，根favicon.ico是浏览器附带请求且仍404；没有借排除项跳过实际产物。
- 大陆三运营商无代理与既有素材/人工验收限制保留，不将哈希匹配当作S20或v1.0.0通过。证据见S19_P_RC_DEPLOYMENT_REPORT.md及s19-p/hash-verification/，只保留本地，任务完成后停止等待用户审查。

### S19-P本地收尾与S20 Web上线准入准备 — 2026-10-16（Codex）

#### 完成内容

- 用户只批准收尾记录/方案，未批准提交、推送、重建发布、重新部署、正式Tag/Release或S20 PASS。复核原ZIP digest/CRC及85项TAR哈希，与原7份JSON和报告第6节逐一对应，85/85历史公网记录一致；保留原记录网络时点，未冒称本轮重新公网测试。新增S19_P_CLOSEOUT_EVIDENCE.json归档文件指纹，原始证据不改。
- 用户明确允许使用《完整制作阶段.docx》的S19～S22目标/Gate/里程碑，不推断与(5)全文一致。新增S20_WEB_RELEASE_READINESS_REPORT.md及其他电脑/真实无代理/至少一局自然对局空表；S21不同网络3～5局与三运营商扩大计划单列，不增加为S20原定硬门槛。
- 制定保留e9f…RC的最小正式版本提交、同源CI/公网验收后v1.0.0 Tag/Release及回滚方案。说明现有package构建版本为rc1、Tag不能改网页显示，main/approved_sha门禁与原Artifact有效期限制。未实施版本/工作流/源码修改。

#### 检查与Git状态

| 项目 | 实际结果 |
|---|---|
| 原包及历史证据对应 | 同一Run38897897043/Artifact12044274455；ZIP40,299,469字节、85文件43,050,329字节，全部复核通过 |
| 原证据保护 | 7份JSON及第6节原内容保持，文件指纹归档；日志原前缀保护 |
| 文档检查 | git diff --check、链接/表格结构及保护文件检查；不重跑游戏测试、tsc或build，本轮源码不改 |
| 自动化/浏览器边界 | 963/963及Chrome/Edge公网记录是上一轮证据；其他电脑、真实无代理及自然一局尚待人工填写 |
| Git归档 | 仅本地文件整理，未暂存/commit/push/Tag；历史e9f…、原rc1与线上RC不动 |

#### 已知限制与下一步

- S19-P技术一致性闭合，本地收尾归档完成；新文档未Git归档，不标新Gate。S20材料准备完成、未PASS，S21未启动。favicon404/历史v6取消仍非阻断观察，不改源码或线上内容。
- 等待用户回填最小人工表、选择版本方案和批准精确正式操作；不自动进行发布、S21扩大测试或S22维护。原5173/4173、模型/地图/音频/道具及私人/备份文件保持。

### S20外部慢网与Edge输入阻断只读诊断 — 2026-10-16（Codex）

#### 完成内容

- 按用户要求立即暂停v1.0.0准备，S20保持BLOCKED、S21未启动。锁定历史e9f361fce9dd5f392e2165ec2cf0b5f1148ed108原RC，HTTPS页面与JS哈希匹配原CI，不重建或改线上。新增S20_EXTERNAL_BLOCKERS_DIAGNOSIS.md及9份原字节浏览器证据/索引，仅本地待审。
- Chrome/Edge受控慢网复现v6请求约101秒、约29秒已进入PLAYING，先显示临时程序化角色，下载后正式v6和动画正常。确认20秒UI提前放行、8秒音频竞速提前结束图片等待及入局缺少角色就绪关联；不把受控限速当大陆运营商直连，不把人为abort当自然取消。
- 独立Edge实体键盘178/178控制采样帧有位移；用户原Edge有Global Speed，开启时键盘失效并出现0.7/0.8浮层，用户关闭后确认恢复，确定该会话扩展冲突。未采到原扩展具体拦截阶段，不虚称已完成任意插件兼容。手动原JSON空自动化数组汇总字段错误单独注明，原件不改。

#### 验证结果

| 检查 | 实际结果 |
|---|---|
| 定向现有测试 | focus、camera-controls、collision-world、production-model-policy共48/48，失败/跳过/取消0 |
| 浏览器 | Chrome154/Edge151普通与受控慢网；独立Edge实体键盘、原Edge用户扩展开关对照分别记录 |
| 保护与证据 | 336项开工哈希不变，日志原前缀保持，9份证据原字节匹配；文档diff及新报告空白检查通过 |
| 全量npm test/tsc/build | 未执行，本轮只读诊断/文档、源码不改；不冒称历史963项为本轮门禁 |
| Git及本地服务 | HEAD/本地origin/main/远端main仍为历史RC，索引为空；原5173/4173进程保留 |

#### Git检查点、限制与下一步

- 未改源码、测试、玩法、地图、36道具、模型/音频或私人目录，未add/commit/push/Tag/Release/重新部署；原S19-P85/85是产物一致性事实，不能替代S20体验Gate。
- 已提交最小加载门禁/真实就绪/失败兜底修复提案及回归、真实外部无代理复验要求，尚未实施。键盘临时关闭扩展可用，但慢网阻断未解除；缺原外部设备HAR和实际大陆线路测量。诊断完成后停止，等待用户批准，不启动新阶段或正式发布。

### S20加载门禁第一轮本地最小修复 — 2026-10-16（Codex）

#### 完成内容

- 用户仅批准本地加载状态/界面/入局门禁及必要测试。新增StartupReadiness连接StartupView、CharacterActionView和ThreeGame；明确下载/解析/初始化/正式ready/failed/主动simplified。20秒改为提示而非自动放行，8秒可选音频不再结束图片等待。真实失败有手动reload重试，主动简化作废角色加载代次并释放迟到克隆，不意外换回。
- 不改输入系统、玩法/平衡、AI、碰撞、地图/36道具点位、模型或音频。原生产v6/程序化及DEV旧模型链保留，GLTFLoader仍用原loadAsync请求方式，仅观察实例parse边界。新增本地验收报告S20_LOADING_GATE_FIX_REPORT.md及s20-loading-fix原始JSON/截图/产物清单。

#### 自动化与本地浏览器结果

| 检查 | 实际结果 |
|---|---|
| 回归红绿 | 原StartupView两个真实时序断言0/2→2/2；最终加载/模型/释放定向18/18 |
| 全量npm test | 973/973，失败/取消/跳过0，既有断言保留 |
| TypeScript/构建 | 独立tsc、根路径build、隔离Pages production build及原产物门禁通过；保留大chunk警告 |
| 双浏览器功能 | Chrome154/Edge151共20独立最终会话；根/子路径双阵营三难度24组合，实际AI配置/30秒/3秒、36道具坐标及39音频解码核对正常 |
| 真实限速下载 | Chrome99.855秒、Edge99.886秒；约34秒仍downloading/inert且代码入局被拒，约104秒正式ready后才可进入菜单，既有倒计时后正常入局和移动 |
| 失败/恢复 | 网络失败、请求取消、动画初始化失败、手动reload恢复、下载中明确简化与迟到真实parse不换回、首屏图片延迟和可选音频失败均验证 |
| 严格Network | Chrome根/Pages正常矩阵的零取消断言因v6 ERR_ABORTED失败，原JSON/非零退出保留；完整解码字节、正式模型动画与功能通过分开记录，不虚报所有浏览器检查全绿 |
| 保护 | 336项开工跟踪哈希中328项不变、8项授权文件变化，新增2项代码/测试；日志原字节前缀保持、文档diff检查通过 |

#### Git检查点、已知限制与停止

- 根dist86文件/43,053,550字节，Pages86文件/43,054,068字节；按现工作流不上传零字节.gitkeep则普通公开文件85项。两包只有v6/米袋，无旧GLB、源码、测试或私人/备份文件。dist不提交。
- 未add/commit/push/重新部署/Tag/Release；HEAD、远端main及rc1保持原RC历史落点。原5173/4173后续连接/监听检查不可用，本轮未停止或擅自重启它们；自有临时根/严格子路径服务完成后关闭。
- 大陆无代理线路与实际下载速度未解决；本轮受控限速不是运营商直连验收，v6取消标记原因也未闭合。公网RC保持原样、S20继续BLOCKED、S21未启动；完成后停止，等待人工本地审查与下一次精确Git/RC/外部复验授权。

### 玩家反馈轮：最小操作教学与开发日志补齐 — 2026-10-17（DeepSeek Harness）

#### 用户批准范围

- 只做两件事：**最小操作教学**（独立说明层，可关闭、可从暂停菜单重看；不修改阵营卡片，不延长或改动 READY 计时，不展示内部倍率、世界单位与 AI 隐藏信息；先核对真实按键，删除含义不明的教学文案）与**开发日志补齐**（复用现有机制，记录投掷命中双方、门的强破/解锁结果与时间、AI 绕行决策、抓捕时状态；**绕行决策与门实际打开必须分别记录**；仅用于开发调试，不新增生产版 DEV 入口）。
- 明确不动：吃米保持 30 秒；不改速度、技能冷却、AI 决策、地图与道具位置；不新增 Human 技能。

#### 完成内容

- 新增独立说明层 `src/three/ControlsHelpView.ts`（纯 DOM 表现层，不读玩法状态、不暂停、不推进任何计时；`controlsHelpMarkup()` 为纯函数，便于无 DOM 环境下核对文案）+ `src/game-ui.css` 样式（`z-index:160`，在暂停面板之上、开局层之下）。
- 入口：暂停菜单新增「操作说明」按钮（`populateRoundActions` 的可选 `help` 参数；未接线时不生成该按钮，原有按钮顺序与数量不变）；每浏览器**首次开局自动出现一次**（常量 `CONTROLS_HELP_AUTO_OPEN`，键 `who-ate-my-rice/controls-help-seen-v1`，localStorage 不可用时静默跳过、不阻断开局）；Esc 优先关闭说明层；暂停、恢复、重开、返回阵营选择时隐藏。
- 文案按源码核对的真实按键编写：Human＝WASD 移动 / Space 开门与强行破锁 / E 开关门与拧锁芯 / Q 搜查（家具或前方区域）/ F 拾取 / 按住左键瞄准·松开投掷 / 右键取消 / 贴住即可抓捕 / Esc；DeepSeek＝WASD / E 吃米·藏身·开关门 / Space 冲刺（结束时若已吃掉三成米会摔倒）/ Q 上锁 / F / 左键·右键 / Esc。玩家可读文字中**不含任何阿拉伯数字、倍率、世界单位与 AI 决策词**。
- 删除含义不明文案：技能 HUD 的「面向白色轮廓家具按 Q 搜查」「Q 搜查白色轮廓家具」与含半径／张角的 `title` 改为「对着家具按 Q 搜查」「Q 搜查面前的家具」与「对面前的家具或前方区域生效」；`AlphaHudView` 的「Q 抓捕」改为「靠近即可抓捕；Q 搜查前方或面前的家具」。均只改文案，判定逻辑未动。
- 日志格式 v1.7 → v1.8（只增字段，v1.7 语义不变）：`counts.throwHitsHuman / throwHitsDeepseek`；`doorAccessEvidence`（结果码 + 触发方 + **上锁到被打开的毫秒数**，上限 50）；`humanRouteEvidence`（`lockDecision` / `decisionReason` / `targetDoorId`，上限 200，**与门实际结果分开**）；`captureEvidence`（结算瞬间的 stun / concealed / sprint / 抓捕圈进度与抓捕路径，一局最多 1 条）。三类证据在新局清空；结算证据在结果置位当帧冲写，避免局终断尾。
- 接线：投掷命中循环里 `recordThrowHit`；`applyDoorResult` 统一推导门动作方并同时计数与留证；`updatePlaying` 中 `lockDecision`/`decisionReason` 变化时 `recordHumanRoute`；三处 `forceCapture` 分别标注 `Q_FAN` / `FURNITURE_CHECK`。

#### 自动化结果

| 检查 | 实际结果 |
|---|---|
| 新增定向测试 | `tests/controls-help.test.mjs` 5 项、`tests/ai-log-evidence.test.mjs` 7 项，合计 12/12 通过 |
| 既有相关测试 | `ai-log-collector`、`ai-log-match-summary`、`cleanup-projection` 全通过（版本号与 counts 期望已同步为 1.8） |
| 全量 npm test | **985/985 通过**，失败/取消/跳过 0（官方 `npm test`，与 `npm run build` 合并在一次门禁内执行） |
| TypeScript | `tsc --noEmit` 退出码 0 |
| 生产构建 | `npm run build` 退出码 0，保留既有「chunk > 500 kB」警告 |
| diff 检查 | `git diff --check` 退出码 0 |
| 人工验收 | **未执行**，等待用户浏览器验收（见下） |

#### 人工验收待办（用户执行）

1. 首次进局时说明层自动出现（每个浏览器仅一次），点「知道了」或 Esc 可关闭，且 READY 倒计时与入局节奏不受影响。
2. 暂停 →「操作说明」可再次打开；恢复、重开、返回阵营选择后不再残留。
3. 两个阵营各看一遍：Human 不应出现「吃米/冲刺」，DeepSeek 不应出现「强破/搜查」；画面无任何内部数值。
4. 开发构建导出一局 AI JSON：确认 `doorAccessEvidence` 与 `humanRouteEvidence` 分别有内容、`captureEvidence` 只有一条，`counts.throwHits*` 随投掷命中增长。

#### Git 检查点、已知限制与停止

- **未 add / commit / push / Tag / Release / 部署**。开工前工作区已存在上一轮未提交改动（`src/main.ts`、`src/s13-ui.css`、`src/three/CharacterActionView.ts`、`src/three/DeepSeekGlbModel.ts`、`src/three/StartupView.ts`、两个模型测试与若干 docs），本轮未触碰、未清理。
- 本轮涉及文件：新增 `src/three/ControlsHelpView.ts`、`tests/controls-help.test.mjs`、`tests/ai-log-evidence.test.mjs`；修改 `src/three/ThreeGame.ts`、`src/three/GameUiLayout.ts`、`src/three/AlphaHudView.ts`、`src/systems/AILogCollector.ts`、`src/game-ui.css`、`tests/ai-log-collector.test.mjs`、`tests/ai-log-match-summary.test.mjs`、本日志与本交接。
- 已知限制：项目无 DOM 库，说明层的测试只覆盖「文案/数据/菜单组合」，**渲染与点击需浏览器验收**；日志只在 DEV 构建生成；`doorAccessEvidence` 与 `humanRouteEvidence` 各自有上限，超限后不再追加（导出里以条目数体现）。
- 下一步：等待上述 4 项人工验收。验收通过后再讨论是否用新证据推进 D/E 两条反馈的数值或 AI 条件调整；本轮不宣布任何平衡结论。

### 2026-10-17 首次教学阅读门禁与投掷说明修复

#### 完成内容

- 根据用户截图和授权修复说明层显示期间后台继续对局的问题。ThreeGame在既有帧派发处阻止说明可见时的READY/PLAYING推进，不修改3秒准备时长或GameStateSystem；关闭说明后才继续倒计时。Esc只关闭说明，关闭当帧不推进或切换暂停；阅读期间清理缓存按键。
- 暂停中重看说明、关闭后均保持暂停。补充投掷命中眩晕3秒、不锈钢盆可再次拾取和其他物品投出不可回收的规则文案。使用ponytail最小改动方式复用现有状态与说明层，没有新增计时系统或依赖。

#### 测试与人工验收

| 检查 | 结果 |
|---|---|
| 定向回归 | controls-help共8/8；新增3项执行真实帧派发，覆盖停留20秒不耗READY、关闭后完整倒计时、Esc不穿透及暂停保持 |
| 全量npm test | 988/988，失败/跳过/取消0 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0；125模块，既有大chunk警告保留 |
| 差异 | git diff --check通过 |
| 浏览器 | 当前宿主无可控制标签，未完成真实渲染/点击；等待用户本地复验，不冒充自动化已覆盖 |

#### Git检查点与限制

- 仅修改ThreeGame.ts、ControlsHelpView.ts、controls-help.test.mjs及本交接/追加日志，保留全部已有未提交改动；未修改平衡、AI、地图、素材或输入系统。未暂存、提交、推送、部署、Tag或Release，不更新阶段Gate。
- 已有首次说明存储标记原样保留，不清用户存储。可暂停重看；首次门禁在未看过说明的浏览器环境验收。此次构建更新了本地dist，腾讯云已部署RC没有改变。

### 2026-10-17 简单Human追捕体验最小试调

#### 完成内容

- 用户要求先处理DP娘难追，未实施捕捉网。按ponytail最小改动及diagnosing-bugs对照方法核对真实AI冲刺入口，将最终变更限制为Human主控/EASY对手AI的approachSprintDistance：6→4.5世界单位。新值在GAME_CONFIG.difficulty.easyDeepseekSprint统一管理，难度类型仅新增该允许字段，普通/困难和其他参数保持。
- 不改DeepSeekAIController算法、双方实际速度、冲刺持续/冷却/风险规则、AI听觉、门锁、地图、道具、素材或玩家能力。更新平衡目录及难度说明；现有未提交教学/日志/加载修复全部保留。
- 原候选同时降低近距safeSprintDistance至3.5，定向先红后绿，但首轮全量990/991：20276765追捕后合法退避场景在12000帧预算内HIDE未结算。原配置对照149550ms抓捕结算；单独降低近距仍未结算，单独修改逼近阈值149900ms结算。因此撤回近距变化，原整局预算和断言保留，不修改躲藏系统、不宣称已证明永久软锁。
- 新测试隔离逼近入口时最初仍混入近距入口；随后用真实高风险进度及先进入逃跑再逼近的输入序列隔离，未修改生产算法以迁就测试。中间失败不计为最终通过。

#### 验证

| 检查 | 结果 |
|---|---|
| 实际AI逃跑回归 | 31/31，含3项新测试：近距保留、近距/声音正常、逼近阈值分档生效 |
| 档位/存储/有效值定向 | 3/3；仅批准对手字段变化，玩家与其他配置保持 |
| 最终npm test | 991/991；失败/取消/跳过0，原整局不变量通过 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 最终生产构建 | npm run build退出0，125模块，既有大chunk警告保留 |
| 差异 | git diff --check通过 |
| 浏览器/真人 | 本轮未执行Chrome/Edge真实试玩，不能宣称追捕体验已解决或胜率平衡 |

#### Git与限制

- 未暂存、提交、推送、部署、Tag或Release，不改变S20 Gate；腾讯云RC及GitHub部署不变。修改文件为gameConfig.ts、difficultyConfig.ts、deepseek-evade.test.mjs、difficulty.test.mjs、GAME_BALANCE_CONFIG.md、DIFFICULTY_DESIGN.md、交接及本追加日志。
- 仅推迟逼近入口；5单位内仍可能由近距入口冲刺，强声音和出口受阻也可触发，因此不是全局降速。请刷新5173并新开Human简单局试玩；若仍难追，先根据真实追逐记录再决定下一项，不自动扩大调整。

### 2026-10-17 简单DP AI步行与冲刺降速10%本地试调

#### 完成内容

- 用户试玩认为仍快，明确批准仅Human简单难度对手DP AI速度降低10%，保留上一轮冲刺时机覆盖。新增GAME_CONFIG.deepseekAI.movementSpeedMultiplier=1及difficulty.easyDeepseekSprint.movementSpeedMultiplier=0.9；难度类型允许此字段，其他档位默认1。
- 在ThreeGame实际位移速度点按deepseekAiEnabled乘AI倍率，步行/冲刺均生效；人工DP与DEV临时接管不受影响。默认步行3.45、冲刺5.52世界单位/秒，Human4.14不变，不改持续时间、冷却、风险或抓捕规则。按ponytail最小接入原则复用控制状态与难度快照，不新增系统。
- 同步s7d-match-sim实际速度公式，避免仿真仍跑旧速度；新增回归执行真实ThreeGame速度表达式，核对两阵营/三档/手动与AI/步行与冲刺。不改地图、素材、道具、门锁、输入或AI决策算法，平衡目录和难度文档同步。

#### 验证与验收

| 检查 | 结果 |
|---|---|
| 定向速度与档位保护 | 2/2通过 |
| 全量npm test | 992/992；失败/跳过/取消0，原整局及锁门不变量通过，未调整预算 |
| 独立tsc | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0；125模块，既有大chunk警告保留 |
| git diff --check | 通过 |
| 浏览器真人 | 本轮未执行，待用户刷新5173并新开Human简单局体验，不冒充手感或胜率通过 |

#### Git检查点与限制

- 涉及gameConfig.ts、difficultyConfig.ts、ThreeGame.ts、s7d-match-sim.mjs、difficulty.test.mjs、GAME_BALANCE_CONFIG.md、DIFFICULTY_DESIGN.md及交接/追加日志；保留全部先前未提交改动。未暂存、commit、push、部署、Tag或Release，不改变线上RC或阶段Gate。
- 仅简单对手AI降速；其他难度不变，冲刺时仍可能比Human快。此次是待试玩初值，不承诺追捕问题已解决，不添加捕捉网或继续改其他玩法。

### 2026-10-17 简单速度人工确认与DP AI三档梯度

#### 完成内容

- 用户反馈简单速度“可以”，记录为该项追捕手感人工确认，不扩大为完整游戏或阶段Gate验收。用户继续授权按简单速度调整普通/困难；本轮设置Human主控对手DP AI倍率简单0.90、普通0.95、困难1.00，困难不额外加速。
- 普通0.95统一定义在GAME_CONFIG.difficulty.normalDeepseekMovementMultiplier并进入现有难度快照。按ponytail最小改动原则复用上一轮步行/冲刺位移接线，不重写移动系统；玩家DP及Human、技能时长/冷却/风险、其他AI参数、地图、音频、道具不变。保留简单approachSprintDistance=4.5。
- 更新真实移动表达式与六组合档位保护回归，以及平衡/难度说明；保留全部此前未提交改动。

#### 验证与人工验收

| 检查 | 结果 |
|---|---|
| 定向真实速度/配置保护 | 2/2；双阵营三档、AI与人工控制、步行冲刺 |
| npm test | 992/992，失败/跳过/取消0；既有整局回归通过 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块；既有大chunk警告保留 |
| git diff --check | 通过 |
| 人工 | 简单由用户明确确认；普通/困难本轮未浏览器试玩，待用户新开局验收 |

#### Git检查点与限制

- 本轮修改gameConfig.ts、difficultyConfig.ts、difficulty.test.mjs、GAME_BALANCE_CONFIG.md、DIFFICULTY_DESIGN.md、交接及本追加日志；未暂存/commit/push/部署/Tag/Release，线上RC不变，不更新阶段Gate。
- 5173原服务仍监听，刷新、返回阵营选择、选择普通或困难并新开Human局验证；不宣称统计胜率平衡，不继续添加技能或其他优化。

### 2026-10-17 正式进食每份20秒本地试调

#### 完成内容

- 用户明确批准30→20秒；仅将RICE_MAX_PROGRESS_MS.production改为20000，模式仍production，开发5000保留。两阵营/三档共用，五份胜利、400ms准备、移动/松键中断和累计恢复不变。按ponytail最小改动原则，不重写进食、AI估时或HUD；真实接线均读取米状态最大进度。
- 五份纯进度从150秒变100秒；连续一份至少20.4秒，风险比例仍30%，对应总累计进食30秒，不冒充实际对局耗时。保留所有速度/冲刺/门锁/地图/道具/素材改动边界，不扩展技能。
- 六组合回归先按新时长执行0/6失败（真实30000不等于20000），修改配置后6/6通过；同步五份总量100000、五秒进度比例1/4、完成前1ms边界及理论最短进食准备总量102000，不删除断言。

#### 验证与历史夹具说明

| 检查 | 结果 |
|---|---|
| 六组合20秒进食 | 6/6，准备、中断、恢复、未完成不结算和5/5胜利 |
| 进食/状态/冲刺定向 | 31/31 |
| 最终npm test | 992/992，失败/取消/跳过0 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块，既有大chunk警告保留 |
| git diff --check | 通过 |
| 浏览器 | 本轮未执行真实20秒进食试玩，等待用户新开局，不冒充自动测试为真人验收 |

- 初次全量991/992：bathroom固定种子追捕夹具的胜负由DP改为Human，正常抓捕结算并非计时或路径卡死。定向复核确认20秒六组合整局通过，但该历史追逐轨迹要求DP吃完五份。仿真新增显式riceMaxProgressMs夹具参数，该历史用例固定30000并保持原全部胜利/米数断言；正式游戏没有该覆盖入口。20秒仍由六组合production整局和原九组合追捕后退避可达性/结算回归覆盖，预算不变。

#### Git检查点与限制

- 修改gameConfig.ts、difficulty.test.mjs、game-state.test.mjs、rice-field.test.mjs、sprint.test.mjs、s7d-full-match.test.mjs注释、s7d-match-sim.mjs历史夹具参数、平衡/难度文档及交接/本追加日志。保留全部既有未提交工作，不清用户文件。
- 未暂存、commit、push、部署、Tag或Release；5173原服务仍监听，本地dist已构建，线上RC不变。待用户刷新/新开局确认节奏及双方体验，不标记S20通过。

### 2026-10-17 Human AI强破1秒准备与可见反馈

#### 完成内容

- 用户明确确认20秒进食时间可以，记录为该项体验认可，不扩大为阶段Gate。用户随后要求解决锁门收益低，按此前提出的AI强破约1秒前摇方案进行本地实现。
- 核对实际链路确认AI原先立即调用玩家共用HumanDoorSkill.use，成功后正常进入30秒冷却；没有把即时开门误称无冷却。新增GAME_CONFIG.humanAI.aiForceBreakWindupMs=1000，通过HumanDoorSkill.tryAiForceBreak仅约束AI请求，连续满1秒才执行原强破，玩家use保持即时。按ponytail最小改动原则复用技能及AI合法交互命令，不改路由选择、普通开锁或PulseLock。
- 准备期间门保持LOCKED，冷却不消耗；换门、无合法请求、失距、眩晕/人工接管取消准备，暂停不推进，reset清空。AI沿用零方向站门前，INTERACT动作标记增加准备条件；Human可见或DP近处可合法交互此门时，门位置显示一次“正在强行破锁…”，不显示远处隐藏AI位置。没有增加音频或修改素材。
- 无头仿真同步AI执行入口，保留玩家即时强破路径；平衡目录及难度规范补充配置与行为说明。其他既有改动均保留。

#### 验证

| 检查 | 结果 |
|---|---|
| 门技能/AI定向 | 26/26，新增2项覆盖999ms门不打开、1000ms开门并消耗30秒CD、暂停冻结、取消/换门/门已打开/重开清理及玩家即时强破 |
| 全量npm test | 994/994，失败/跳过/取消0，原整局和门锁可达性回归通过 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块，既有chunk警告保留 |
| git diff --check | 通过 |
| 浏览器 | 本轮未执行实机点击/INTERACT动画和提示验收，需用户在本地复验，不冒充单元测试已覆盖 |

#### Git检查点与限制

- 修改gameConfig.ts、HumanDoorSkill.ts、ThreeGame.ts、s7d-match-sim.mjs、human-door-skill.test.mjs、GAME_BALANCE_CONFIG.md、DIFFICULTY_DESIGN.md及交接/本追加日志。没有修改地图、道具、速度、20秒进食、抓捕、输入或声音系统。
- 未暂存、commit、push、部署、Tag或Release；5173原服务保留，线上RC不变。此调整保证AI强破前的准备窗口，不保证所有锁门都阻挡AI，绕行仍是合法策略。待用户新开DP对局确认收益，不自动继续其他技能开发。

### 2026-10-17 Human常驻Space强破技能卡修复

#### 完成内容

- 用户截图确认Human右下角只有E和Q，授权补齐Space强破提醒。原AlphaHudView用this.sprint.hidden=!dp隐藏Human卡，且AlphaHudFrame无强破冷却字段；本轮复用原Space卡位和cooldown渲染，按阵营切换冲刺/强破。
- ThreeGame传入既有HumanDoorSkill的真实cooldownRemainingMs和cooldownMs；Human显示“Space强破·就绪/剩余秒数”及进度，DP继续读取冲刺状态，不把DP的眩晕/冲刺文案串到Human。不新增计时器、CSS、依赖或技能规则，按ponytail原则最小接入，保留此前HUD文案及其他已有工作。

#### 验证

| 检查 | 结果 |
|---|---|
| 定向HUD | 修复前2失败/3通过，修复后5/5；覆盖Human常驻、真实剩余秒数向上取整、进度、就绪和切回DP |
| npm test | 995/995，失败/跳过/取消0 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块；既有大chunk警告保留 |
| git diff --check | 通过 |
| 浏览器 | 本轮未执行实机渲染/交互，待用户刷新5173后检查Human卡位、冷却和阵营切换，不以DOM替身冒充真实画面验收 |

#### Git检查点与限制

- 本轮仅修改AlphaHudView.ts、ThreeGame.ts、alpha-hud.test.mjs及交接/本追加日志。技能数值、破门逻辑、地图、素材、声音和CSS布局不动；未暂存、commit、push、部署、Tag或Release，线上RC保持，不推进阶段Gate。
- 本地开发服务原监听5173保留。玩家请使用真正锁门强破验证冷却；Space免费打开普通关门不消耗强破冷却，卡片仍就绪属于既有正确规则。

### 2026-10-17 Human E搜查与门交互优先级接入

#### 完成内容

- 用户要求Human Q搜查迁至E，并明确接受门交互优先。Human Q预留但不触发搜查或陷阱；E消费一次，PulseLock面板已开则只操作锁芯，附近门则只开关/解锁（即使受阻也不再搜查），其他情况执行原家具/扇形搜查。DP输入和Human Space不变，未实现捕捉网。
- 按ponytail原则复用原搜查执行器、目标判定与12秒冷却，不重构输入系统。useSkillQ/resolvePlayerQPlan及日志字段保留兼容名并注明历史含义；Human E调用原执行器，Human Q不调用。HUD卡、角色附近E提示、操作说明和DEV可见文案同步，防止门旁家具提示覆盖门动作，PulseLock中不显示搜查提示。
- 更新平衡说明中的当前按键，无玩法数值变化；保留全部此前未提交修改。

#### 验证

| 检查 | 结果 |
|---|---|
| 输入/HUD/教学/原搜查优先级定向 | 26/26，含4项新回归执行真实handleDoorInteractions：E一次、Q预留、门/锁芯/受阻不双触发、眩晕拒绝、DP Q原动作 |
| 最终npm test | 999/999，失败/跳过/取消0 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块，既有chunk警告保留 |
| git diff --check | 通过 |
| 浏览器 | 本轮未执行真实键鼠/布局验收，用户需刷新本地新开局；不以夹具测试冒充实机 |

- 新测试最初正则误截方法返回类型，造成4项handleDoorInteractions不存在的TypeError；修正为匹配完整方法后定向和全量重新执行通过。此为测试夹具错误，不当成游戏Bug或忽略失败。

#### Git检查点与限制

- 本轮修改ThreeGame.ts、AlphaHudView.ts、ControlsHelpView.ts、controls-help.test.mjs、alpha-hud.test.mjs、GAME_BALANCE_CONFIG.md、交接/本追加日志，新增human-e-priority.test.mjs。未修改技能数值、AI、地图、素材、声音或InputManager。
- 5173原服务保留；未暂存/commit/push/部署/Tag/Release，线上RC不变，不改变阶段Gate。后续捕捉网仍须单独授权，Q预留不代表技能已实现。

### 2026-10-17 Human头顶E搜查提示范围修复

#### 完成内容

- 用户截图反馈Human在空地仍显示头顶E搜查。真实currentInteractionPrompt回归复现无条件Human fallback生成提示；按最小诊断/ponytail原则复用playerQTargetResolution的pointedLegalTarget，限定为合法且被指向家具，并排除暴露目标扇形优先情形，不借机调整输入或玩法。
- 没有目标立即返回null，离开家具不保留旧提示；合法家具可显示就绪/冷却，门提示仍优先。右下角常驻技能冷却、E扇形空挥及抓捕判定、DP提示、Q预留规则均保持，不新增计时器或CSS。

#### 验证

| 检查 | 结果 |
|---|---|
| 定向真实提示/输入回归 | 修复前4通过1失败，修复后5/5；空地/非法目标不提示、合法目标提示、离开清除、冷却及门优先 |
| npm test | 1000/1000，失败/跳过/取消0 |
| 独立TypeScript | npx tsc --noEmit退出0 |
| 生产构建 | npm run build退出0，125模块，既有大chunk警告保留 |
| git diff --check | 通过 |
| 浏览器 | 本轮未执行真实渲染/操作验收，待用户本地刷新检查，不冒充回归夹具为真人试玩 |

#### Git检查点与限制

- 仅修改ThreeGame.ts、human-e-priority.test.mjs及交接/本追加日志；保留全部已有改动。5173原服务保留，未暂存/commit/push/部署/Tag/Release，线上RC不变，不推进阶段Gate。
- 搜查本身仍能在空地释放并按原规则消耗冷却，本次只去除误导性的常驻头顶提示；右下角技能卡继续帮助玩家知道可用按键。

### 2026-10-17 Human Q捕捉网本地实现，待人工验收

#### 完成内容

- 用户“行，开始吧”批准新增Human捕捉网。采用ponytail技能复用现有Three.js、CollisionWorld、投掷、HUD和动作入口，不新增依赖、通用技能框架或在线统计系统。
- Q鼠标选点，左键布置，右键/Esc取消；第一次Esc取消、下一次Esc暂停。2单位范围、600ms原地布置、1秒启动、1.2秒定身、成功放置才起20秒CD、25秒存在且一张，不覆盖旧网。
- 地图物理校验禁止墙/关闭门/家具/角色重叠，保护米点、真实随机出生和藏身退出；藏身扇形用原半径的包围圆保守禁放。网非实体、不修改导航；DP冲刺也经连续扫掠触网，在原CollisionWorld路径内截停，不倒地、不直接判胜，Human仍需原规则接近抓捕。
- DP投掷拆网按墙/角色/网的首碰撞决定，待启动网也能拆；不改变盆回收、其他道具消耗或砸人音效条件。网定身与原投掷眩晕取剩余max，不相加；整段控制结束后网免疫2秒，不取消原投掷规则。
- Human AI仅用当前真实可见目标和已有路线方向提案，每500ms检查，复用同一个放置/冷却/物理校验；没有AI投掷、隐藏位置读取或预测规划。原AI模块及难度参数未改。
- 新Q技能卡与E搜查/Space强破并存，教学说明已同步；暂停/说明/DEV冻结不推进计时，未成功选点/布置取消不耗CD，已部署网冻结，重开/返回阵营清空。实际地图变化移除旧网但不返CD，dispose清理事件/DOM/几何材质。不改20秒进食、速度档位、门技能数值、InputManager、地图/36件道具布局、模型或音频。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 捕捉网定向 | 新增13项通过；状态计时/取消/冷却/扫掠/隐藏与墙遮挡/控制免疫/公平AI提案/三类拆网回收/真实move与禁放入口/四相机鼠标与持有道具隔离/清理 |
| HUD、说明、E输入 | 增加独立Q卡、Esc取消再暂停、布置占用E及定身禁用交互；旧Human E/DP Q分工保持。最初两项教学断言仍预留Q与伪按键“小心网”不匹配，已更新授权分工，并将避网规则移到正文而非伪按键 |
| npm test | 最终1016/1016，失败/取消/跳过0（此前1000基线、首轮新功能1014也通过，最终再含Esc和控制阻断两项） |
| npx tsc --noEmit | 最终退出0；首轮View材质泛型过宽报错，收紧类型后重新检查通过，未绕过TS |
| npm run build | 退出0，127模块；保留既有chunk>500kB警告 |
| git diff --check | 通过；新文件另查行尾空白 |
| Chrome/Edge真实交互 | 未执行：浏览器连接清单只有无标签页的MCP Apps；不将EventTarget/Three.js夹具或HTTP200当成实际浏览器验收 |

#### Git检查点

- 实际文件清单见docs/CAPTURE_NET_DESIGN.md末节，共16项；其中既有未提交文件只叠加本轮范围，不清理旧工作。新增文件为CaptureNetSystem、CaptureNetView、capture-net测试及设计文档。
- 未暂存、commit、push、部署、Tag或Release；原main/线上RC保持，不改写历史或S20 Gate，不自动进入S21。原5173服务保留。

#### 已知限制与下一项任务

- 刷新5173按设计文档人工验收：Q选点/取消、布置和网视觉、暂停/重开、冲刺触网、投掷拆网/盆回收、Human AI布网和两阵营三难度。HUD四卡布局及网材质可见性未做真实画面验收。
- AI只是基于可见目标和当前路线方向布网，不预测或专门绕网；是否有效和平衡待试玩，不能从自动测试推断胜率。等待用户人工反馈，不提交或部署。

### 2026-10-17 去除Human右下角重复E搜查卡

#### 完成内容

- 用户截图指出E搜查已合并进左侧E交互，要求去掉独立卡。按ponytail最小修改，仅AlphaHudView将原alpha-q卡在Human阵营设为hidden，DP仍显示Q锁门，冷却文案仅为DP更新；使用现有hidden样式，不改CSS或输入/搜查冷却逻辑。
- Human保留E交互（门优先、无门时搜查）/Q捕捉网/Space强破；不动技能效果、数值、AI、地图、道具、模型和音频。同步捕捉网人工验收清单为三卡，既有未提交工作保留。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| HUD定向 | 修改断言后先复现4通过3失败，修改显示逻辑后7/7通过；覆盖Human就绪/冷却始终隐藏、左侧交互保留、Q网/Space不受影响、切回DP恢复锁门卡与冷却 |
| npm test | 1017/1017，失败/取消/跳过0 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，127模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 浏览器画面 | 本轮未执行；刷新5173确认Human仅E交互/Q网/Space三卡及DP锁门卡保留，不以DOM夹具代替实机 |

#### Git检查点、限制与下一步

- 本轮修改src/three/AlphaHudView.ts、tests/alpha-hud.test.mjs、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志，共5项。未暂存/commit/push/部署/Tag/Release，线上RC和阶段Gate不变。
- 没有改变实际E搜查及其冷却；只是去除重复的独立卡。等待用户刷新后的画面确认，不自动实施其他UI或玩法调整。

### 2026-10-17 捕捉网禁锢3秒、DP隐藏地面网及扩大布置距离

#### 完成内容

- 用户授权将Human Q捕捉网禁锢改为3秒、DP视角隐藏陷阱、布置范围大一点。复用现有配置/表现层，rootMs从1200改3000，placeRange从2试调为3世界单位（距离增加50%），网本体触发半径0.55不变。
- CaptureNetView新增信息观察者回调，ThreeGame传selectedFaction是否Human；Human能看到待启动/已启动地面网，DP均不可见，选点预览/范围/选点文案也按观察者隐藏。DEV临时输入接管不会改变可见性。踩中后两阵营仍看到DP身上束缚网，触发/投掷拆网/碰撞权威保持原路径。
- 教学取消“避开可见地面网”的过时提示；数值索引、捕捉网设计和当前交接同步，既有历史不回改。

#### 自动化测试与人工验收

| 检查 | 结果 |
|---|---|
| 定向捕捉网/操作说明 | 22/22；覆盖3000ms到期、范围3与3.01边界/2.5可放、3秒后外部控制和免疫、真实移动截停、DP隐藏待启动/启动网但网仍真实存在、切回Human显示、踩中后束缚效果 |
| npm test | 1017/1017，失败/取消/跳过0；约51.8秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，127模块；既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| Chrome/Edge实际画面和试玩 | 本轮未执行；待确认DP无地面网、触发后3秒束缚及Human扩大范围的手感，不能用夹具替代 |

#### Git检查点

- 本轮9项：src/config/gameConfig.ts、src/three/CaptureNetView.ts、src/three/ThreeGame.ts、src/three/ControlsHelpView.ts、tests/capture-net.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。保留各文件已有未提交改动。
- 未暂存、commit、push、部署、Tag或Release；线上RC与S20 BLOCKED保持，原5173服务PID45208继续运行，无清理备份或私人目录。

#### 已知限制与下一项任务

- 布置距离3为本轮“大一点”的本地试调；AI原行进方向提案距离1.4保持。DP隐藏地面网会降低其主动瞄准拆网的信息，投掷真实命中仍能拆除。两阵营平衡尚待试玩，不宣称验收完成。
- 刷新5173分别开Human/DP局，确认放置圈、地面隐藏、触网效果/恢复及暂停冻结，再按用户反馈决定下一步。

### 2026-10-17 捕捉网禁锢由3秒改为5秒

#### 完成内容

- 用户明确要求5秒。仅调整GAME_CONFIG.captureNet.rootMs为5000毫秒，同步已有测试的4999+1到期边界、外部控制免疫及真实移动/视图断言。布置范围3、DP隐藏地面网和其他技能数值保持原实现。
- 修改6项：src/config/gameConfig.ts、tests/capture-net.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。保留已有工作。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| npm test | 1017/1017，失败/取消/跳过0，约51.1秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，127模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 实际浏览器试玩 | 未执行；刷新5173验收5秒禁锢及暂停冻结 |

#### Git检查点、已知限制与下一步

- 未暂存、commit、push、部署、Tag或Release，线上RC及S20 BLOCKED不变。
- 5秒为用户本轮指定值，实战抓捕手感尚待人工验收；不据自动化通过宣布平衡完成。

### 2026-10-17 四张永久捕捉网及双阵营Q剩余名额圆标

#### 完成内容

- 用户授权捕捉网上限4张和Q右上角圆标，明确DP锁门保持3扇上限；随后指定网永久留场、仅取消自动到期且保留DP投掷拆网。新增GAME_CONFIG.captureNet.maxActiveNets=4，移除lifetimeMs；冷却20秒、启动1秒、禁锢5秒、范围3及AI既有策略参数保持。
- CaptureNetSystem由单网改为同一权威nets数组，待启动占名额，成功布置扣格、取消失败不扣格，四张满后禁止第五张；触发或拆除只移除对应网，重开/地图应用仍清空。网之间不重叠；触网扫掠选最先合法接触网，已有控制/免疫期间不消耗其余网。
- CaptureNetView复用固定4个网视图，全部按原信息观察者规则隐藏；ThrowableSystem对全部网比较弹道首接触，仍遵守更近墙/角色优先，销毁仅一张，不改变盆回收/原投掷眩晕与音效。
- AlphaHudFrame从真实系统提供剩余名额。Human Q显示4→3→2→1→0，DP Q显示3→2→1→0；触发/拆网/解锁/强破释放名额后恢复。圆标用现有卡片的CSS伪元素，零为灰色，数量独立于每帧冷却文字；增加余量aria-label/title。处理既有伪元素mask及响应式padding优先级，避免数字被挖空或遮挡文字。
- 教学、数值表、捕捉网设计和交接同步；原单网/25秒日志保留作为历史。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 全量npm test | 1020/1020，失败/取消/跳过0，约50.6秒 |
| 最后定向回归 | 32/32（捕捉网15、HUD8、操作说明9）；在最后教学文字/CSS修正后执行 |
| 容量和永久性 | 通过真实20秒CD逐次布置4张，推进一小时仍在，第五张失败；踩中释放一格、可补回；重开回4格 |
| 多网物理和表现 | 反序数组仍先触近网，仅消耗一张；投掷先拆近网，其他网保留；四网Human可见/DP隐藏，束缚效果保留；原控制免疫/取消/输入隔离回归通过 |
| HUD | Human4→0→恢复，DP3→0→恢复，冷却文本不吞掉圆标、切换阵营不重建DOM |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 最后CSS/教学修正后退出0，127模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| Chrome/Edge真实交互 | 未执行；圆标视觉及实战铺网/拆网/破锁仍需人工验收，不将EventTarget夹具当作真实浏览器 |

#### Git检查点

- 本轮14项：src/config/gameConfig.ts、src/systems/CaptureNetSystem.ts、src/systems/ThrowableSystem.ts、src/three/CaptureNetView.ts、src/three/ThreeGame.ts、src/three/AlphaHudView.ts、src/three/ControlsHelpView.ts、src/game-ui.css、tests/capture-net.test.mjs、tests/alpha-hud.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。已有未提交工作保留。
- 未暂存/commit/push/部署/Tag/Release，线上RC和S20 BLOCKED保持，不启动S21。

#### 已知限制与下一步

- 圆标表示剩余同时存在名额，并非本局总次数或技能充能；仍每成功放置后等待原20秒CD。永久仅指本局无自动过期，重开/换地图仍清空。
- 刷新5173确认Human圆标和四网永久存在、触发/投掷拆网后恢复名额、DP锁门圆标跟随锁数变化；所有实战平衡待人工试玩。

### 2026-10-17 不锈钢盆三次投掷耐久

#### 完成内容

- 用户要求不锈钢盆最多投掷3次，之后损坏不可用。新增GAME_CONFIG.throwables.basinMaxThrows=3，每件盆以remainingThrows独立记录，成功出手扣一次，取消瞄准、无效目标、无法行动、冷却拒绝均不扣。投空/撞墙/砸人/拆网均消耗一次。
- 第3次仍按原路径完成飞行、命中眩晕/回调音效或拆网；结束后复用USED状态隐藏、禁止拾取。前两次仍500ms落地禁拾；换人回收和场景应用不重置，重开恢复3次。未修改地图36件物品、盆模型或花瓶/盒子一次性规则。
- 拾取/持有文字显示盆剩余投掷次数，教学说明最多三次；数值表、投掷专项报告、捕捉网拆网说明和交接同步。按ponytail复用现有计数/USED路径，不新建损坏系统或表现资产。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 定向投掷/捕捉网/操作说明 | 47/47；覆盖两阵营交换回收、三次投空/撞墙/命中/拆网、最后一投仍有效且不能回收、独立耐久、应用布局不修复/重开恢复、失败/取消不扣、暂停冻结和持有次数提示 |
| npm test | 1022/1022，失败/取消/跳过0，约52.6秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，127模块；保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| 浏览器实机 | 未执行；待刷新5173验收三次投掷/耐久文字/最后损坏与新局恢复，不将夹具当实机 |

#### Git检查点

- 修改11项：src/config/gameConfig.ts、src/systems/ThrowableSystem.ts、src/three/ThrowableView.ts、src/three/ControlsHelpView.ts、tests/throwables.test.mjs、tests/controls-help.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/CAPTURE_NET_DESIGN.md、docs/verification/THROWABLES_REPORT.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。保留全部既有未提交内容。
- 未暂存/commit/push/部署/Tag/Release，线上RC和S20 BLOCKED保持；原5173 PID45208继续运行。

#### 已知限制与下一步

- 损坏复用USED后从画面移除，没有新增碎片模型/破裂动画；最后一投仍能播放原命中音效。耐久只在本局记录，不写入场景文件。
- 刷新5173，用同一盆投三次并回收，确认前两次可再拾、第3次结束后消失且不能拾取、换人不补充、重开恢复，再收集手感反馈。

### 2026-10-17 普通/困难双方AI顺路拾取和误差投掷

#### 完成内容

- 用户明确要求普通/困难两方AI都能拿投掷物砸人、准头较差。新增AIThrowableController，两方复用同一策略，通过原ThrowableSystem.pickup/throw/advanceFlights裁决。简单档不启用；不修改主AI追逃/寻路/门锁/藏身/吃米、速度、36件道具位置或玩家技能数值。
- 参数统一放GAME_CONFIG.throwableAI：拾取扫描300ms、目标距离1.5～5.5；普通前摇900ms/成功后额外间隔6500ms/误差半径1.25，困难650ms/5000ms/0.9。原800ms出手冷却仍由权威投掷系统检查，AI额外间隔仅限制决策。
- AI顺路拾原1.2单位可达无遮挡道具，不新增找道具寻路。向当前真实视野可见且未藏身/禁锢/眩晕的对手瞄准，起手固定当时位置加均匀圆盘随机偏差，后续不跟踪或预判。丢视野/越界/受控/接管取消瞄准，重新看到要重新前摇；实际命中仍由飞行/墙/角色扫掠决定，不人为保证命中或漏判。
- ThreeGame在两方移动完成且刷新当前视野后调用投掷策略，再统一处理飞行/命中。主AI忙于门/搜查/吃米/藏身/冲刺/布网时不叠加投掷，受控目标不被补投；共用原玩法时钟，暂停/说明/冻结不推进。接管/地图应用取消准备，新局重置；可见AI起手显示“准备投掷…”，原持有模型和朝向接入，不添加瞄准线或暴露目标点。
- throwActors.canAct去掉人工控制身份限制，保留动作物理门禁；鼠标/F输入仍只选择原controlledFaction。AI执行权使用既有shouldRunHumanAI/shouldRunDeepSeekAI和动作互斥条件，没有新增生产DEV入口。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 新定向tests/ai-throwable.test.mjs | 10/10；双阵营/两档/三类道具真实拾取与飞行命中、前摇到期、固定快照不追踪、误差分布边界、简单/控制/隐藏/眩晕/禁用保护、丢视野/墙/距离取消、玩法时钟/长间隔及真实ThreeGame投掷接线 |
| npm test | 1032/1032，失败/取消/跳过0，约50.5秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；既有chunk>500kB警告保留 |
| git diff --check | 通过；新增文件另检查行尾空白 |
| Chrome/Edge真人或实际浏览器试玩 | 未执行；普通/困难两个阵营的自然拾取频率、警告可读性、走位躲避、准头和压迫感待人工验收 |

#### Git检查点

- 本轮9项：新增src/systems/AIThrowableController.ts、tests/ai-throwable.test.mjs；修改src/config/gameConfig.ts、src/three/ThreeGame.ts、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。保留各文件已有未提交工作及全部验证/私人材料。
- 未暂存/commit/push/部署/Tag/Release；线上RC和S20 BLOCKED保持，未进入S21。原5173服务PID45208继续运行。

#### 已知限制与下一步

- 仅顺路拾取，AI不会为了道具改道跨房间搜寻；实际投掷频率受原路线、附近道具、当前视野和更高优先级动作影响，不保证每局都有相同投掷次数。
- 独立随机源运行时Math.random，可注入固定源做定向验证；不声称固定出生种子可重放所有投掷随机数。偏差参数不是固定命中率，未做真人胜率统计。
- 旧无头整局仿真未集成本轮AI投掷；其原有回归通过不能当作这轮自然完整对局验证。刷新5173选择普通/困难、两阵营分别试玩；观察AI拾取持有、起手提示、走位躲避，回归隐藏/受控不追投、暂停冻结、盆3次耐久以及简单未启用。

### 2026-10-17 三档投掷准头与Human AI布网/中网后追捕节奏

#### 完成内容

- 用户要求投掷准头随难度上升、Human AI按难度布网，简单少布且慢点靠近、困难多布；另明确确认简单也要投掷但准头很差。新增C.throwableAI.EASY配置1300ms前摇/9000ms成功后间隔/1.8单位误差半径；普通900/6500/1.25、困难650/5000/0.9保持，AIThrowableController移除旧简单禁用条件。
- 新增C.captureNetAI三档主动布网预算1/2/4张、提案间隔5000/1500/500ms、看到DP中网后的靠近等待1200/500/0ms。旧captureNet.aiCheckMs移除，ThreeGame提案与反应等待都读取现有throwables.nowMs，不新增玩法时钟或技能冷却。
- 主AI原有空闲合法分支调用tryHumanAiNet，只使用当前可见目标/自己的原行进方向，仍经CaptureNetSystem/CollisionWorld完整校验。未到提案间隔、预算满、CD未好、目标不可见/仍中网时不再布网。AI预算限制主动新放，不修改已有网、玩家Human上限或场上4张总上限。
- humanNetReactionWaiting仅在Human AI真正目视中网DP时起一次反应等待；等待阶段不执行Human AI动作并将实际移动方向置零，连续看见不重复起算。失去可见中网状态或手动接管后不继续限制，暂停/说明/冻结不推进，新局清空状态。基础速度、AI寻路、抓捕半径/350ms连续抓捕判定不改，已在原抓捕圈内不增加免抓保护。
- 同步难度设计、数值配置索引、捕捉网说明和当前交接，保留旧日志及全部既有工作。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 定向AI投掷/捕捉网 | 31/31；投掷覆盖三档两方三类道具、误差梯度/前摇/间隔、真实弹道和门禁；捕捉网新增真实宿主1/2/4预算/玩家4格、5s/1.5s/0.5s提案边界、目视根状态1.2s/0.5s/0等待、实际Human方向表达式及暂停/接管边界 |
| npm test | 1038/1038，失败/取消/跳过0，约49.9秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| Chrome/Edge实际浏览器/自然对局 | 未执行；三档两方准头、Human布网数量和中网后靠近节奏待人工验收 |

#### Git检查点

- 本轮10项：src/config/gameConfig.ts、src/systems/AIThrowableController.ts、src/three/ThreeGame.ts、tests/ai-throwable.test.mjs、tests/capture-net.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志；部分原为未跟踪或已有改动，均保留。
- 未暂存/commit/push/部署/Tag/Release，不修改线上RC或S20 BLOCKED，不进入S21。

#### 已知限制与下一步

- 难度“准头上升”通过缩小误差圆和缩短前摇实现，不保证某一局/某一发困难必然更准，不声称固定命中率或胜率。简单/普通的中网等待只减慢AI靠近，不改变原抓捕规则，也不赋予已贴身玩家免抓时间。
- AI布网数量为预算上限，实际还受视野/路线方向/禁放点和原20秒CD限制，不能保证每局铺满。较低难度接手已有更多网时不删除，只停止继续新放。
- 刷新5173分别测试两方三档：简单也会捡物和投掷但易躲、普通居中、困难更准；DP主控检查Human布网数量和中网后反应；回归玩家4网、5秒禁锢、永久留场、盆3次耐久、暂停/重开。旧无头整局仿真未集成网/投掷，不将其通过当本轮自然完整对局验证。

### 2026-10-17 修复AI边追边投的过期落点，困难准头和距离试调

#### 完成内容与根因

- 用户反馈困难AI投掷只出一个模型身位。按diagnosing-bugs建立真实控制器/投掷系统回归：起手目标x=3，困难Human前摇650ms内按3.1464单位/秒追赶、DP按3.8333单位/秒前进，出手时Human x=2.04516、DP x=5.4916667、真实间距3.4465067；旧落点仍x=2.3636039，计划只飞0.3184439。无墙且未执行飞行命中，排除墙裁剪/落地提前终止；物理射程一直是6，并非只允许一身位。
- 对照静止发射者时同样随机误差计划飞2.3636；只有前摇期间前进的发射者会逼近旧落点。新增collapse回归先运行失败（0.3184<2），修复后通过。此前测试虽移动过目标，却未包含发射者追赶移动，漏掉了这个真实调用链路。
- AIThrowableController前摇期间保留原快照，出手时依据当前仍真正可见的目标刷新一次落点，保留起手同一份随机误差。继续不使用隐藏坐标、速度预判或投出后追踪；失去视野/越界/受控仍取消。修复共用AI路径，不改变玩家投掷、弹道/碰撞或输入。
- 困难C.throwableAI.HARD.aimErrorRadius从0.9调0.55，并新增HARD.maxTargetDistance=6；简单/普通误差和5.5目标门槛不变。困难仍受原玩家物理射程6和首接触裁决，不穿墙或强制命中。前摇/出手间隔、盆3次耐久/命中音效、AI布网/追捕反应和地图不改。
- 同一个原复现场景修复后计划飞3.0575979，落点相对当前目标误差0.3889087；不再落在发射者脚边。数值索引/难度文档/交接同步，旧历史保留。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 原症状回归 | node --experimental-strip-types --test --test-name-pattern 'collapse a clear' tests/ai-throwable.test.mjs；先失败，修复后1/1通过；内联同场景探针亦复验3.0576计划距离 |
| 定向AI投掷与基础投掷 | 37/37；新增困难两阵营5.9可投/6.01拒绝及物理6上限，更新为前摇不追踪/出手刷新一次/飞行不追踪；原取消/视野/眩晕/三次耐久等保护通过 |
| npm test | 1040/1040，失败/取消/跳过0，约60.1秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块，保留既有chunk>500kB警告 |
| git diff --check | 通过；未添加生产日志或持久诊断探针 |
| 真实Chrome/Edge试玩 | 未执行；用户刷新5173复验困难双方边追/边逃投掷距离与准头，不将固定夹具当真人对局 |

#### Git检查点

- 本轮7项：src/config/gameConfig.ts、src/systems/AIThrowableController.ts、tests/ai-throwable.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。其余既有改动/备份保留，未读取私人目录。
- 未暂存/commit/push/部署/Tag/Release，线上RC和S20 BLOCKED保持，未进入S21。

#### 已知限制与下一步

- 这是对已复现“追赶时向旧世界落点出手”的修复和困难误差/距离试调；附近真实墙/家具仍可让投掷合法提前落地。刷新后若仍仅飞一个身位，需要区分是否受墙/家具真实截挡，不宣称消除了所有短投来源。
- 不预测玩家后续速度，弹体飞出后固定落点，运动玩家仍可躲避；不承诺困难命中率。原回归探针仅在命令行执行，无需删除用户材料或关闭5173服务。

### 2026-10-17 困难AI缩小误差并加入用户批准的有限走位预判

#### 完成内容

- 用户要求困难更准；经明确选择“缩小误差，并加入有限走位预判”，本轮授权扩大到困难的短时预判。HARD.aimErrorRadius从0.55改0.25，新增GAME_CONFIG.throwableAI.HARD.leadTimeMs=600（毫秒）、maxLeadDistance=2.4（世界单位）。简单/普通参数和不预判逻辑保持。
- AIThrowableController记录前摇开始时真正可见的目标位置和原玩法时间，出手时用准备期间可见位置变化估计平均速度，预测时长不超过配置及弹体实际飞行时间，预测位移分量最多2.4，再叠加起手同一份随机误差。只在HARD出手那一帧使用，不读取玩家输入、未来路径或墙后位置；原丢视野/受控/接管取消会同时丢弃运动估计。
- 仍共用6单位物理射程与墙/角色首接触，不强制命中；前摇650ms、额外投掷间隔5000ms保留。出手后落点固定，不会跟随玩家新变向。地图、速度、网、音效与盆3次耐久均保持。
- 数值表/难度设计/交接同步，旧“不预判”历史日志不回改；当前仅困难按本轮授权例外。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 直线跑动反馈回路 | 修改前真实飞行无法命中直线逃跑夹具，新增用例先失败；修复后可拦截同场景，玩家出手后拐弯能躲，飞行终点不变 |
| tests/ai-throwable.test.mjs | 17/17；新增困难有限预判/直线命中与变向躲避、两阵营三档2.4位移上限和困难独享、丢视野后清空估计/重新准备；既有三类道具/准头梯度/射程/暂停/动作门禁回归通过 |
| npm test | 1043/1043，失败/取消/跳过0，约63.1秒 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge真实试玩 | 未执行；困难两方的实际准头/走位躲避/压迫感待刷新5173验收，不把控制夹具当自然对局 |

#### Git检查点

- 本轮7项：src/config/gameConfig.ts、src/systems/AIThrowableController.ts、tests/ai-throwable.test.mjs、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志；保留既有未提交工作及备份。
- 未暂存/commit/push/部署/Tag/Release，线上RC与S20 BLOCKED保持，未进入S21。

#### 已知限制与下一步

- 采用前摇内连续可见位置的平均变化，不是完美速度测量；玩家中途拐弯/加速能让预测失效。接近最大射程且向外远离时，原6单位射程仍可能无法拦截，绝不通过额外射程或必中判定补偿。
- 预判位移上限2.4不含另叠加的随机误差0.25；最终落点仍过原物理射程/墙裁剪。不承诺特定命中率或真人平衡。
- 刷新5173用Human/DP各试困难：直线走动更容易被拦截，出手后变向仍可躲；回归简单/普通未增加预判、暂停/隐藏取消及盆耐久，再按用户反馈微调。

### 2026-10-17 Human搜查从E独立迁移至V

#### 完成内容

- 用户提出E连按易误放搜查，最初选择C，实施中明确改成V；最终以V为准。移除Human E无门时的搜查回落，E仍开关门/锁芯，V独立走原useSkillQ兼容执行器，原12秒冷却、家具/扇形判定、AI搜查、Q捕捉网、Space强破及DP按键保持。
- PulseLock开启/刚打开、眩晕及捕捉网瞄准/布置时消费V但不执行，避免解除状态后补放。V可在普通门附近独立搜查，不需要远离门；DP的V不触发搜查。
- 复用原HUD卡显示V搜查真实冷却，不显示锁门数量圆标；Human Q网及DP Q锁门数量保留。头顶合法家具搜查提示按键/按住反馈改V，空地不显示；教学及DEV文案同步。最终没有修改DEV Z/C/X视角分支或InputManager，不调整任何平衡值。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 分流/HUD/教学/生产工具定向 | 29/29；E重复20次不搜查，V单次释放、C不搜查、门旁V、PulseLock/眩晕/布网互斥、阻塞V不延迟释放、DP及生产视角隔离保持 |
| npm test | 1044/1044，失败/取消/跳过0，约60秒；完整输出在系统临时目录rice-human-v-search-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；保留既有chunk>500kB警告 |
| git diff --check | 通过；保留既有LF/CRLF提示，不转换无关文件 |
| Chrome/Edge真实键鼠/布局 | 未执行；测试使用方法VM与DOM替身，不代表浏览器验收 |

#### Git检查点

- 本轮文件：src/three/ThreeGame.ts、src/three/AlphaHudView.ts、src/three/InteractionPrompt.ts、src/three/ControlsHelpView.ts、src/game-ui.css；tests/human-e-priority.test.mjs、tests/alpha-hud.test.mjs、tests/controls-help.test.mjs；docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- 只修改本轮按键与提示相关内容，保留所有既有未提交工作和备份；索引空，HEAD/origin/main及只读ls-remote main仍为历史RC部署提交e9f361fce9dd5f392e2165ec2cf0b5f1148ed108。未暂存/commit/push/部署/Tag/Release，S20 BLOCKED与线上RC不变。

#### 已知限制与下一步

- 5173原服务PID45208仍运行，未终止进程。请刷新后Human连续按E开关门，确认不消耗搜查；V测试家具/前方搜查与原冷却；Q布网、Space强破及DP原按键回归。Human右下角现在有独立V卡（不是重复E卡），真实屏幕排版待确认。
- 本轮没有发布，线上RC仍是旧版本；不自动进入下个功能或正式发布。

### 2026-10-17 Human家具搜查并入E，V仅前方扇形抓捕

#### 完成内容

- 用户要求分开家具搜查与人物前方扇形，并明确“家具并到E，V是前方扇形抓捕”。Human E维持PulseLock/门优先，无门才重新解析当前合法且被指向家具；无目标/家具执行失效不耗冷却、绝不回退扇形。V只传扇形目标，不选家具；玩家扇形在隐藏者藏身时传null，避免扫家具搜出隐藏者。AI仍走原独立搜查，不改共享几何函数。
- 复用原useSkillQ兼容执行器及resolvePlayerQPlan，以调用方明确用途传互斥目标；E合法搜中/搜空、V命中/空挥共用原12秒SkillCooldown，不新增计时或数值。E/V同帧先E，家具成功后同一冷却阻止V二次释放。Q捕捉网、Space强破、DP按键及DEV视角工具保持。
- 家具白色可用高亮、E提示不再受暴露目标压制；门旁仍优先显示E门提示，空地不常驻家具提示。V卡改“扇形抓捕”，教学/DEV文案和数值规则索引同步明确共用冷却；没有另加E技能卡。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 定向输入/执行器、HUD、教学、原计划兼容 | 36/36；真实方法VM验证E空地不耗、E家具不被暴露目标改道、失效不回退、V不选家具、E/V共用冷却及同时按互斥；真实扇形函数验证隐藏者不读家具目标、暴露者距离/角度/墙遮挡保持 |
| 初次定向夹具 | 34/36：原DP夹具无附近门导致实际锁门入口未调用、扇形命中夹具缺feedback.show；补齐测试依赖后36/36，不为夹具改变生产规则 |
| npm test | 1047/1047，失败/取消/跳过0，约61.5秒；完整输出位于系统临时目录rice-e-furniture-v-fan-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块，保留既有chunk>500kB警告 |
| git diff --check | 通过；未转换无关文件行尾 |
| Chrome/Edge真实键鼠/布局 | 未执行，方法VM/DOM替身并非浏览器或真人验收；刷新5173人工确认 |

#### Git检查点

- 本轮修改：src/three/ThreeGame.ts、src/three/AlphaHudView.ts、src/three/ControlsHelpView.ts；tests/human-e-priority.test.mjs、tests/alpha-hud.test.mjs、tests/controls-help.test.mjs、tests/player-q-priority.test.mjs；docs/GAME_BALANCE_CONFIG.md、docs/S7C_HIDE_RANDOMIZATION_DESIGN.md、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- 索引空；开工HEAD/origin/main及远端只读ls-remote一致，原历史RC部署提交保持。未暂存/commit/push/部署/Tag/Release；保留全部既有未提交工作和备份，未读取私人目录，S20 BLOCKED不变。

#### 已知限制与下一步

- 两功能虽分键，仍共用12秒冷却；这是本轮保留原平衡的实现，不代表已授权独立冷却。E仅合法家具才释放，V空挥照常耗冷却；普通贴身自动抓捕不变。
- 刷新5173，依次测空地/门旁/家具旁E，面向家具且前方有暴露DP时E只搜家具、V只抓角色，DP藏身时V无效但E可搜出；查看E家具提示、V卡、共用冷却、Q网及两阵营回归。5173原进程45208保持；线上仍旧RC，未发布。

### 2026-10-17 V扇形特效随Human移动（仅表现）

#### 完成内容

- 用户澄清希望扇形跟随Human移动，才实施本轮。根因为HideSearchView.show仅在释放时设置世界坐标，后续advance仅推进透明度，没有玩家移动后的位置接线；并非碰撞、输入或抓捕失败。
- HideSearchView.followPlayer只在剩余特效时长大于零时更新玩家扇形位置，ThreeGame在碰撞解析后的移动结束处调用。扇形朝向继续保留施法快照，原120ms淡入/140ms停留/260ms淡出不重启，网格和几何复用。
- 根节点仍保持单位变换，家具白色高亮、命中反馈及AI扇形/轮廓世界坐标不被平移。真实V抓捕只在释放瞬间算一次，不新增逐帧命中、移动扫人或冷却刷新；E/V分工、12秒共用冷却、AI、Q网/Space、地图/音频/数值保持。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 原问题回归 | 真实ThreeGame移动后帧接线片段+真实Three.js网格，修复前失败：Human X从2到3，扇形仍为2；修复后随多次XZ移动，其他世界对象不动 |
| 定向表现/玩家技能回归 | 16/16；释放计数仅1，朝向/几何不变、总520ms自然消失，结束/reset不复活；既有E/V互斥、隐藏者/墙/距离判定保持 |
| npm test | 1048/1048，失败/取消/跳过0，约62.6秒；完整输出在系统临时目录rice-v-fan-follow-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；保留既有chunk>500kB警告 |
| git diff --check | 通过，未加生产探针/日志或新依赖 |
| Chrome/Edge画面 | 未执行；真实Three.js夹具不等于浏览器画面验收，待刷新5173人工确认 |

#### Git检查点

- 本轮6项：src/three/HideSearchView.ts、src/three/ThreeGame.ts、tests/hide-search-view-player-target.test.mjs、docs/S7C_HIDE_RANDOMIZATION_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志；保留原未提交工作与备份。
- HEAD/origin/main与远端只读ls-remote一致，索引为空，无合并/变基状态；未暂存/commit/push/部署/Tag/Release，原线上RC及S20 BLOCKED保持。

#### 已知限制与下一步

- 本轮只跟随位置，不随走位重新转向，朝向仍是按V时方向；跟随特效不是持续有效抓捕区域。若要持续命中或改变朝向判定，需要另行授权玩法调整。
- 原5173服务PID45208复用未终止。刷新后Human边移动边按V看短暂扇形随位置移动，家具描边不跟着走，E家具/Q网/Space仍正常；不自动发布。

### 2026-10-17 Human技能卡文案按用户图片统一

#### 完成内容

- 用户提供技能文案图片并授权调整。Human E说明改「开门 · 搜查」（标题仍交互），V名称保持「扇形抓捕」，Q改「布设捕捉网」，Space改「强行破门」。Human技能名称/状态用换行与pre-line双行显示，就绪为「技能就绪」，冷却仍读原剩余时间并显示「冷却 Ns」。没有照搬图片二乘二布局，不改现有卡片顺序或尺寸规则。
- 布网中/满额等实际状态覆盖就绪提示，Q网数量圆标和DP锁门圆标保留；冷却条仍读原权威数据。DP保持原单行名称/就绪/冲刺状态文案。操作说明同步Q/Space技能名称，原详细规则保留。
- 未修改ThreeGame输入/判定、E家具/V扇形分工、共用冷却、网/破门功能或GAME_CONFIG；未新增依赖与表现计时器。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| HUD/教学定向 | 17/17；核对Human三技能完整名称/技能就绪、真实冷却、布网状态/容量圆标，DP切回保持原文案 |
| npm test | 1048/1048，失败/取消/跳过0，约62.4秒；完整输出在系统临时目录rice-human-skill-copy-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；保留既有chunk>500kB警告 |
| git diff --check | 通过；既有行尾提示不涉及无关格式改写 |
| Chrome/Edge排版 | 未执行；DOM替身只验证文案/状态，不等于真实排版验收 |

#### Git检查点

- 本轮7项：src/three/AlphaHudView.ts、src/three/ControlsHelpView.ts、src/game-ui.css、tests/alpha-hud.test.mjs、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md和本追加日志。
- 基线HEAD/origin/main与远端只读ls-remote一致，索引空，无合并/变基；未暂存/commit/push/部署/Tag/Release。保留已有工作和备份，S20 BLOCKED与线上RC不变。

#### 已知限制与下一步

- 仅Human文案与双行显示调整，不改变布局。较长Q/Space名称的实际屏幕排版仍待刷新5173人工确认，同时看冷却、满网圆标及DP切回；5173原服务PID45208复用未停止，不自动发布。

### 2026-10-17 Human技能卡两列轻量便签排版

#### 完成内容

- 用户截图反馈上一版双行文字视觉粗重，授权范围按当前外观优化理解，本轮只修改game-ui.css的Human选择器。沿用原DOM与文本，用两列等宽Grid、最大400px和窄屏边距形成右下角紧凑四卡，不再横排占据大段场景。
- 四卡统一最小高度/内边距、16px圆角及轻阴影；技能卡display:block使first-line能单独显示14px/650名称，状态沿用11px/400淡色。Q圆标固定右上10px，保留右侧空间；冷却条减为2px低透明度。技能逻辑、文案、数量/冷却权威及DP样式不改。
- 没有新建UI组件/图标依赖，没有改模型、地图、AI、输入或玩法数值；不宣称截图已经验收。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| npm test | 1048/1048，失败/取消/跳过0，约61.6秒；系统临时目录rice-human-skill-layout-tests.log保留完整输出 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，128模块；既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 浏览器连接检查 | cua.getState只返回无标签页MCP Apps，未提供可操作Chrome/Edge；未完成真实截图/计算布局验收，不以自动化通过代替美观验收 |

#### Git检查点

- 本轮4项：src/game-ui.css、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志；保留所有已有改动和备份。
- HEAD/origin/main及远端只读ls-remote一致，索引为空，无合并/变基状态；未暂存/commit/push/部署/Tag/Release，线上RC及S20 BLOCKED保持。

#### 已知限制与下一步

- 视觉效果待刷新5173人工确认：两列宽度、高度、标题/状态层级、Q圆标与长名称、暂停/布网提示及DP原布局。尤其低分辨率场景可能需要按实际反馈微调，不预先宣称无遮挡。
- 5173原服务PID45208保持运行，未停止任何未知进程；不自动发布。

### 2026-10-17 纠正误解：恢复横排，仅精简Human技能措辞

#### 完成内容

- 用户澄清“文案，不是卡片排列”，经询问明确选择改文字措辞而非字号/行距。先仅撤回本代理上一轮添加的两列Grid及卡片尺寸/内边距/字重/圆标/冷却条覆盖，恢复原横排和原CSS，不覆盖其他历史改动。
- Human HUD名称精简为E交互（副文案开门·搜查）、V抓捕、Q布网、Space破门；状态“技能就绪”改“就绪”，冷却表达为“冷却 N 秒”。名称/状态仍双行，DP原文案和状态保留。Q title保留捕捉网全称，V title和操作说明保留扇形及原详细规则，布网中/满额提示不变。
- 没有修改按键、技能判定、共用冷却、AI、输入、地图、模型、音频或玩法数值；不将上轮布局误改当作用户验收通过。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| HUD定向 | 8/8，核对简称/就绪/中文冷却秒数/网状态及容量圆标，DP切回保持 |
| 最终npm test | 1048/1048，失败/取消/跳过0，约48.9秒；系统临时目录rice-concise-skill-copy-tests.log |
| npx tsc --noEmit | 文案最终改动后独立执行退出0 |
| npm run build | 最终改动后退出0，128模块，保留既有chunk警告 |
| git diff --check | 通过 |
| 真人浏览器画面 | 未执行，刷新5173确认原横排及新措辞；不冒充画面验收 |

#### Git检查点

- 本轮6项：src/game-ui.css（仅撤回误加样式）、src/three/AlphaHudView.ts、tests/alpha-hud.test.mjs、docs/CAPTURE_NET_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- HEAD/origin/main与远端只读ls-remote一致，索引空，无合并/变基；未暂存/commit/push/部署/Tag/Release，保留既有工作和备份，线上RC及S20 BLOCKED不变。

#### 已知限制与下一步

- 原横排及原字号字重已恢复；本轮是精简措辞，不是另一轮排版设计。若需要保持参考图的长名称，应按用户进一步指示调整，不能再擅改布局。
- 请刷新5173检查E交互/V抓捕/Q布网/Space破门、就绪/冷却中文秒数及网容量状态，不自动发布。

### 2026-10-18 仅困难夜间盲追：双向视觉限制与对手不渲染

#### 完成内容

- 用户提出夜晚场景、玩家任一阵营画面不显示对手，并批准“双方向都受限制”；随后特别强调简单/普通不改。本轮困难才启用冷蓝夜景和对手根节点渲染隐藏，玩家近距离也不会重新显示对手。AI不是完全失明：两阵营Vision视距上限首轮试调3世界单位，声音/米痕及Last Seen沿用原规则，不新增透视信息。
- 新增GAME_CONFIG.difficulty.hardNightVisionRange=3（单位/用途/默认值注释齐全），VisionSystem接收动态上限，取原运行时视距与夜间上限min；默认调用保留无限额外上限，简单/普通不变，DEV调大基础视距也不能越过夜间上限。不改保存的DEV预设或全局基础11。
- HardNightView复用原半球光/方向光，保留日间背景/色彩/强度，困难换月光补光，菜单/简单/普通精确恢复；不改材质贴图/地图或灯光阴影相机。夜间只在渲染前设置角色visible，随后接地影、手持物更新使用同一显示门禁；实际物理角色、碰撞、抓捕/冷却/canAct、HideSystem不变。
- 手持道具采用独立renderVisible，不复用玩法hidden；敌方手持物不显示，已投出的道具和地面36件道具仍显示。Human观察者看不到隐藏DP身上网的轮廓，DP自身中网效果保留；网实体/定身和地面网阵营规则不改。隐藏Human时也抑制其AI搜查扇形/轮廓，保留真实搜查。世界坐标反馈保留自身位置警告，不用远处浮字钉住隐藏对手。
- 正式信息观察者仍selectedFaction，临时DEV输入接管不改变观察者；DEV场景编辑器恢复原白天/角色显示以保护作者流程，离开再切回夜间，不取消对局或修改AI感知数据。难度说明提示夜间规则，完整方案及待人工清单在docs/HARD_NIGHT_MODE_DESIGN.md。
- 此前针对“眼前藏身”的0.8秒断视线提案未获单独批准，未搭车实施；本轮没有改AI藏身决策、速度、技能数值、地图/36物点或模型/音频文件。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 夜间/感知/网/投掷定向 | 62/62；新增夜间6项，覆盖两阵营三档、身体/GLB根/接地影、持有/飞行道具、身体网、原光色恢复、菜单/DEV编辑、真实Vision接线/墙/Last Seen过期、自己警告保留与敌方定位浮字拦截 |
| npm test | 1054/1054，失败/取消/跳过0，约60.8秒；系统临时目录rice-hard-night-tests.log保存完整输出 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块；保留既有chunk>500kB警告 |
| git diff --check | 通过；未添加生产诊断探针或外部依赖 |
| Chrome/Edge画面/自然夜间完整对局 | 未执行；真实Three.js/方法VM验证不是浏览器实机或玩家平衡验收，必须刷新5173人工补验 |

#### Git检查点

- 本轮14项：src/config/gameConfig.ts、src/config/difficultyConfig.ts、src/systems/PerceptionSystem.ts、src/three/ThreeGame.ts、src/three/HardNightView.ts、src/three/ThrowableView.ts、src/three/CaptureNetView.ts、src/three/HideSearchView.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- HEAD/origin/main与只读远端main核对一致，索引为空，无合并/变基；未暂存/commit/push/部署/Tag/Release，保护既有工作/备份，未读取私人目录；线上RC及S20 BLOCKED保持。

#### 已知限制与下一步

- 当前定义是玩家画面永远不渲染对手、AI可在最多3单位内真正目视；它是双方受限制，并非两者完全相同的感知能力。声音/米痕仍可驱动AI行动，不能把远处仍有寻路行为直接判为透视；需核对Last Seen/听觉线索。
- 原无头整局测试仍是原玩法仿真，不能冒充本轮夜景/不渲染条件下的真人平衡数据。原v6加载/兜底状态未改，困难看不见对手是有意显示规则，不应误认成模型丢失。
- 5173原服务PID45208复用；两方各自然试一局困难，评价亮度、声音可读性、投掷/网/抓捕可玩性，再切简单/普通确认白天及对手恢复。浏览器实机未验证，不承诺特定胜率；不自动发布或进入S21。

### 2026-10-18 困难视野显形修正：看见对手时显示模型

#### 完成内容

- 用户明确“Human看到了AI DP时要显示其身影”，纠正上一轮把屏幕隐藏理解为永久隐身的实现。根因不是Vision没发现目标，而是HardNightView按主控阵营一律关闭对手根节点，完全未读取当前视觉结果。
- 新增ThreeGame.opponentVisible，只读取selectedFaction当前Vision.visible，不使用Last Seen。HardNightView、手持道具renderVisible、身体网、AI检查表现和世界反馈接入同一当前可见性；近距无遮挡显形，超距或墙门遮挡隐藏，重新目视立即恢复。真实家具藏身继续优先，不会因为靠近而绕过。
- 夜间灯光和3单位视觉上限保持，不改AI状态、速度/能力、碰撞、抓捕、输入、地图/36物点/模型/音频文件；简单/普通继续原白天和显示规则。难度描述改“视野内才显示对手”，设计/数值/交接同步；旧永久隐身日志作为历史保留，不回改。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 新增显形反馈回路 | 真实Vision+真实渲染接线：修复前近距无遮挡、Vision已visible但模型false，新增用例失败；修复后两阵营均完成显形/超距隐藏/墙挡隐藏/重获视野显形，Last Seen不留模型，真实藏身不破坏 |
| 夜间定向 | 7/7；既有简单/普通恢复、影子/手持物/身体网及AI显示门禁回归保持 |
| npm test | 1055/1055，失败/取消/跳过0，约61.4秒；系统临时目录rice-night-visibility-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块，保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| 真人Chrome/Edge画面 | 未执行；刷新5173进困难局，靠近/隔墙/拉远/重新接近验证。夹具不是浏览器画面或平衡验收 |

#### Git检查点

- 本轮9项：src/three/HardNightView.ts、src/three/ThreeGame.ts、src/config/difficultyConfig.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- HEAD/origin/main与远端只读核对一致，索引空、无合并/变基；未暂存/commit/push/部署/Tag/Release，原工作/备份及线上RC保留，S20仍BLOCKED。

#### 已知限制与下一步

- 当前Vision沿用原系统的范围与墙门遮挡，不新增“只看角色面前某个角度”的视锥；本轮只修显形与感知脱节，未调整3单位范围。若要改朝向视锥或视距，另按用户要求确认。
- 刷新5173，两方分别确认当前视野内模型/手持物/影子同步显示、失去视野同步隐藏、家具藏身仍隐藏；简单/普通不变，夜间亮度与真人平衡仍待验收。不自动发布。

### 2026-10-18 困难显形规则B：无遮挡不限距离

#### 完成内容

- 用户明确选择B：取消玩家画面距离限制，只有墙门遮挡或真正藏身隐藏对手。原opponentVisible读取3单位AI Vision，导致远处无遮挡仍隐藏；改为先检查真正藏身，再复用PerceptionGeometry.inspectVision(..., Infinity)判断遮挡。未改AI Vision、Last Seen、夜景、简单/普通或技能/数值。
- 既有模型根节点、手持物、接地影、身体网及AI检查表现继续读取同一显示门禁。GAME_CONFIG只修正注释，原值3保持且明确仅限制AI；同步夜间设计、数值索引和难度文档，交接顶端说明旧记录已被替代。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 先红后绿回归 | 修改真实接线测试后，旧实现于4单位无遮挡显示断言失败；修复后两阵营在4/10/50单位显示，AI仍不可见；墙挡、关闭/上锁门隐藏、开门恢复、真正藏身优先均通过 |
| 夜间定向 | 7/7；持有物、身体网、影子、简单/普通及菜单恢复、AI原范围/Last Seen等回归保持 |
| npm test | 1055/1055，失败/取消/跳过0，约61.5秒；原始输出位于系统临时目录rice-night-unlimited-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块，原chunk>500kB警告保留 |
| git diff --check | 通过 |
| Chrome/Edge实际画面 | 未执行；需用户刷新5173，对比无遮挡远近、墙门遮挡/开门、藏身退出时模型/手持物/影子同步 |

#### Git检查点

- 本轮8项：src/three/ThreeGame.ts、src/config/gameConfig.ts（仅注释）、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- 开工核对main、HEAD/origin/main及只读远端一致；无合并/变基/挑选残留，索引空。未暂存/commit/push/部署/Tag/Release，保留已有工作区/私人目录/备份与线上RC，S20仍BLOCKED。

#### 已知限制与下一步

- 不限距离指屏幕显形门禁，不移动相机，也不让屏幕外角色强行出现在画面中；任一玩家阵营规则相同，但AI仍受原3单位感知上限，不等于给AI无限视距。真实藏身继续隐藏，不新增朝向视锥。
- 原5173服务PID45208未停止；真实浏览器及自然整局平衡待人工验收，不自动进入后续阶段。

### 2026-10-18 困难画面对手可见距离上限改为10单位

#### 完成内容

- 用户最新明确“仍隐藏，10单位是可见距离上限”，取代上一轮B不限距离规则。GAME_CONFIG.difficulty新增hardNightRenderRange=10（世界单位，默认10），ThreeGame.opponentVisible使用此值调用既有PerceptionGeometry距离/墙门检测。恰好10单位仍显示，超过即隐藏；真实藏身优先，返回合法范围同步恢复模型、手持物和阴影。
- 未实现仅建议过的0.3秒淡出；AI的hardNightVisionRange=3、Last Seen、夜景、简单/普通以及玩法/地图/道具/音频不变。按最小改动技能复用原显示接线，未新增视野系统。同步设计/数值索引/难度文档和交接，保留旧日志。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 定向先红后绿 | 配置接入前真实显示接线在10.001单位仍显示，断言失败；接入后两阵营4/9.999/10可见、10.001/50隐藏、返回10恢复；模型/影子/手持物门禁一致，墙门/藏身及AI范围回归通过 |
| 夜间定向 | 7/7 |
| npm test | 1055/1055，失败/取消/跳过0，约60.4秒；原始输出系统临时目录rice-night-range10-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块；保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge实际画面 | 未执行；待刷新5173人工验收，不以测试夹具替代画面/平衡验收 |

#### Git检查点

- 本轮8项：src/config/gameConfig.ts、src/three/ThreeGame.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- main的HEAD/origin/main及只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，保留已有改动、备份、私人目录及线上RC，S20继续BLOCKED。

#### 已知限制与下一步

- 当前仍为立即显示/隐藏；用户未批准的淡出不实施。距离门禁不是朝向视锥；显示10与AI感知3独立，不自动把AI视距提高到10。
- 原5173服务PID45208复用。请两阵营困难局测试拉远/靠近、墙门/藏身以及手持物/阴影同步，再回简单/普通确认不变；未自动发布。

### 2026-10-18 困难两方AI视觉与画面同步10单位

#### 完成内容

- 只读诊断已确认原画面10、AI3导致无遮挡距离2.9/3.1交替时Human在CHASE/INVESTIGATE之间切换。用户批准修正，并明确不仅选DP娘，选Human也须同步。
- 最小运行改动仅`GAME_CONFIG.difficulty.hardNightVisionRange: 3 → 10`及注释。既有共享Vision初始化自动同时作用两方：选DP时Human AI收到visibleTarget，选Human时DP AI收到visibleHuman。画面上限10保持，原墙门/真正藏身/Last Seen和普通/简单、AI决策/逃跑阈值/速度不动；没有把“看见Human”改为“任意距离强制逃跑”。
- 回归扩展真实接线和真实两方控制器；按最小改动技能复用现有系统，不新增第二套感知。同步夜间设计、数值索引、难度文档与交接，旧日志保持。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 先红后绿 | 旧配置在3.1单位两方视觉接线断言失败；改后2.9/3.1/4/9.999/10均持续目击，10.001断开；Human真实控制器保持CHASE后转INVESTIGATE，DP真实控制器持续收到VISION威胁后转非目击信息 |
| 夜间定向 | 8/8，范围/遮挡/藏身/Last Seen过期、两方显示及手持物/阴影等回归通过；简单/普通10.5单位仍可见，困难10.5不可见 |
| npm test | 1056/1056，失败/取消/跳过0，约60.0秒；原始输出系统临时目录rice-night-both-ai10-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 真人Chrome/Edge画面及自然对局 | 未执行；不能以夹具证明全部原地停顿原因均消失，碰撞/搜查/布网等原行为仍可能合理停步 |

#### Git检查点

- 本轮7项：src/config/gameConfig.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。ThreeGame及两方AI控制器源码未改，只复用原接线。
- main的HEAD/origin/main及只读远端一致，索引空，无合并/变基/挑选残留。未暂存/commit/push/部署/Tag/Release；保留已有工作区/备份和线上RC，S20继续BLOCKED，原5173服务PID45208复用。

#### 已知限制与下一步

- AI实际视距仍为原运行时视距与10单位上限的min，DEV显式低视距覆盖不会被回写；默认11故正式困难为10。原墙门遮挡及真正藏身继续断目击，Last Seen仍可支持有限调查，不等于立即停止所有移动。
- 请刷新5173，两种主控阵营各试困难：Human在无遮挡3至10单位保持追逐，DP同距离能识别人类威胁但仍按原危险程度决定动作；隔墙/藏身后不得透视，简单/普通不变。仍停步时需实际AI日志/位置继续区分，不擅自提高速度或取消其他合法行为。

### 2026-10-18 困难双方视距由10试调为5单位

#### 完成内容

- 用户要求“换成5单位”，沿用上一轮双方对齐范围：`GAME_CONFIG.difficulty.hardNightVisionRange`、`hardNightRenderRange`均由10改5及注释。选DP时Human AI、选Human时DP AI和玩家显示同步；其他玩法/速度/威胁阈值、简单/普通、墙门遮挡/真正藏身/Last Seen保持，不加淡出。
- 按最小改动技能只调集中配置，更新既有夜间回归及设计/数值索引/难度文档。旧10单位日志不回改，交接顶部说明当前5单位。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 夜间定向 | 8/8，两方4/4.999/5可见，5.001/10/50隐藏、返5恢复；真实Human AI范围内CHASE、超距INVESTIGATE，DP AI范围内VISION、超距停止目击；遮挡/藏身/手持物/阴影等回归保持 |
| npm test | 1056/1056，失败/取消/跳过0，约60.1秒；系统临时目录rice-night-both-range5-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块，保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge实机 | 未执行；刷新5173，两种主控阵营各试困难5单位显隐与AI反应，不以夹具代替真人手感验收 |

#### Git检查点

- 本轮7项：src/config/gameConfig.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。ThreeGame与两方AI算法未改。
- main的HEAD/origin/main及只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，原工作区/备份、5173服务PID45208与线上RC保留，S20继续BLOCKED。

#### 已知限制与下一步

- 显隐仍即时，5单位处没有新增迟滞或淡出。超距后AI可按原记忆/听觉继续调查，不代表完全停步；DEV显式低视距覆盖仍受原优先规则管理。待用户验证两方实际手感，不自动进入下阶段或发布。

### 2026-10-18 困难人物延迟1秒消失（仅表现）

#### 完成内容

- 用户要求“延迟1秒消失”，新增`GAME_CONFIG.difficulty.hardNightHideDelayMs=1000`（毫秒，默认1000）。HardNightView保留曾看见对手的显示余时：超距或墙门遮挡后1秒再隐藏；重新看见立即显示并重置余时，从未看见不显示；真正家具藏身立即清空并隐藏。
- ThreeGame保留opponentVisible为即时几何/距离结果，新增opponentRendered读取延迟表现结果；根模型/接地影/手持物/身体网同步，世界浮字/AI搜查表现仍依即时目击抑制。AI双方5单位Vision/Last Seen、真实藏身/碰撞/抓捕/速度/技能、简单/普通及地图/音频不变。
- 渲染前仅传既有gameplayMs；暂停、DEV冻结、说明层不扣显示余时，不接READY计时。resetRound、正式观察者变更、退出困难/进入编辑器清空，避免跨局残留。没有新增setTimeout或渐变材质，没有把显示延迟反馈给AI。依据最小改动技能复用现有表现模块。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 先红后绿 | 新真实接线用例在旧实现失去视线当帧模型false处失败；修复后两阵营超距/墙挡999ms仍显示、1000ms隐藏，反复失去视线不重新延长，重获视线重置，AI即时visible为false |
| 夜间定向 | 9/9；模型/影子/手持门禁一致，身体网使用同一表现结果；暂停/说明层/DEV冻结不扣时、换观察者/重开清零、真实藏身立即隐藏、简单/普通恢复等通过 |
| npm test | 1057/1057，失败/取消/跳过0，约63.5秒；系统临时目录rice-night-delay1s-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，129模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 真人Chrome/Edge观感 | 未执行；需刷新5173两种主控困难局检查1秒保留/重获视线/真正藏身及附件同步，不能以夹具代替画面验收 |

#### Git检查点

- 本轮9项：src/config/gameConfig.ts、src/three/HardNightView.ts、src/three/ThreeGame.ts、tests/hard-night.test.mjs、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。
- main的HEAD/origin/main及只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，已有工作区/私人目录/备份与线上RC保持，S20继续BLOCKED，5173原服务PID45208复用。

#### 已知限制与下一步

- 按用户要求为1秒后消失，不是渐隐；宽限中保留真实模型当前动作/位置，可能在越过5单位或转入遮挡后多看见1秒，不是冻结在最后目击位置。AI不因此获得新的视觉信息，世界反馈也不延长；真正藏身不暴露位置。
- 暂停期间宽限随游戏时间冻结，恢复后继续。请本地验收两方实际观感，保留范围5与AI参数，不自动发布或进入后续阶段。

### 2026-10-18 困难区域灯光与实体墙壁开关（本地待人工验收）

#### 完成内容

- 用户明确批准方案后实施，上一轮因Windows浏览器URL识别安全机制停止而中断，本轮继续完成回归与门禁。新增RoomLightSystem与RoomLightView，依据权威18区域/墙段/静态碰撞派生墙面安装和可站立接近点，新增墙上实体面板、暖色局部点光/地面提亮和L提示，不移动既有家具、门、米点、出生点或36件投掷物。
- 默认每局全关，仅困难启用。玩家靠近本区开关按L切换，真实行动/距离/遮挡门禁，Ctrl/Alt/Meta组合键、输入框不误触；同一开关玩家/AI共用3秒间隔，随既有游戏时间推进，暂停/说明层/DEV冻结不推进，新局重置。
- 亮区**目标**不受距离限制；观察者处于亮区不代表能看见远处暗区目标。VisionSystem分别计算两方几何/距离结果，玩家显示复用目标范围；墙/关闭门/真正藏身仍遮挡。暗区沿用5单位和玩家1秒显示保留；AI不继承玩家显示延迟，原Last Seen/声音/米痕保持。简单/普通不使用亮区扩展或显示开关。
- 两方AI使用同一近距开关入口，导航后位移仍走既有CollisionWorld：Human巡逻/调查就近开灯，追逐时不绕去开灯但经过开关可即时操作；DP仅真实看到Human威胁才尝试本区关灯，进食/门/藏身/冲刺优先，不能为关灯更靠近追捕者或进入安全距离。不增加全图灯光规划或隐藏目标坐标读取。
- L原属DEV IJKL右移，保留InputManager默认行为，只在附近开关捕获该次L至松键，其他方向键不受影响。正式Z/C/X隔离代码未变；原测试一度因变量名lightKeyCaptured包含KeyC字样误报，改名lightOwnsL后通过，未修改或放宽隔离测试。
- 可调参数集中于GAME_CONFIG.roomLights：interactionRange=1.5世界单位、toggleCooldownMs=3000毫秒、aiDetourRange=4世界单位、aiSafeDistance=2.5世界单位；同步数值索引、夜间/难度文档、新灯光设计、交接及操作说明。按最小改动技能复用原导航、碰撞、输入与视觉接缝，无新依赖/美术下载。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 新灯光定向 | 7/7：18真实墙面安装/可站立/从双方出生点导航可达；操作/遮挡/共享冷却/重置；真实Vision初始化/玩家显示，亮区20单位可见而墙挡/藏身仍隐藏、简单普通不扩展；真实AI辅助方法+CollisionWorld实际走近才切换；实体/点光/提示/释放；L与DEV方向隔离 |
| 原夜间定向 | 9/9，5单位边界、1秒延迟、模型/附件/阴影同步与两方AI接线保持 |
| 正式DEV隔离定向 | 5/5；Z/C/X和DEV构造器仍仅开发构建 |
| 最终npm test | 1064/1064，失败/取消/跳过0，约58.7秒；原始输出系统临时目录rice-room-lights-final-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，131模块；保留既有chunk>500kB警告 |
| git diff --check | 通过，已修正新增CSS末尾空行 |
| Chrome/Edge实际渲染/自然整局 | 未完成：上轮Windows操作因无法可靠识别Chrome当前URL被安全机制停止，本轮浏览器连接库存只有无标签MCP Apps；未绕过限制，未以夹具/HTTP200替代视觉验收 |

#### Git检查点

- 本轮15项：src/config/gameConfig.ts、src/systems/RoomLightSystem.ts、src/systems/PerceptionSystem.ts、src/three/RoomLightView.ts、src/three/ThreeGame.ts、src/three/InputManager.ts、src/three/ControlsHelpView.ts、src/game-ui.css、tests/room-lights.test.mjs、docs/ROOM_LIGHTS_DESIGN.md、docs/HARD_NIGHT_MODE_DESIGN.md、docs/GAME_BALANCE_CONFIG.md、docs/DIFFICULTY_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。此前全部未提交变更保留，不作为本轮新增改动重复申报。
- main的HEAD/origin/main及只读远端核对一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，线上RC保持，S20继续BLOCKED，5173原服务PID45208复用，未停止未知进程或清理备份/私人目录。

#### 已知限制与下一步

- 点光不新增阴影以控制性能，可能对邻区有少量视觉补光；不会改变邻区灯光状态或越过几何/藏身门禁。18个开关的实际画面可读性、暖光亮度、低配置帧率及两方AI自然整局仍需人工验收。
- 开关位置不随DEV家具拖动自动迁移；后续把家具堵在开关前会被真实碰撞/遮挡阻止，AI不会穿物操作。没有新增自动重新布置地图或远程救场逻辑。
- 请刷新5173选困难，找墙面白色小开关，靠近出现L开灯/关灯与区域名；分别确认亮暗/双方视野、墙门/藏身限制、冷却/暂停/新局、简单普通不变。完成后等待用户验收，不自动发布或进入S21。

### 2026-10-18 区域开灯恢复白天照明、墙壁开关外形修正

#### 完成内容

- 用户提供实机截图，明确原开关像抽象黄块、亮区应像原白天。本轮只改视觉，不改RoomLightSystem、开关位置/距离/冷却、输入、AI决策或视觉感知参数。沿用最小改动技能：保留原灯光及材质，在独立表现模块接入局部白天照明。
- RoomLightView面板改圆角底座、内凹暗槽、白色塑料翘板、两处螺钉和小型指示灯；开关切换只改变翘板角度和小指示灯，不再整块变黄，原L提示/交互保持。
- 移除18个点光及黄色地面覆盖层，新增RoomDaylightView：从原半球光/方向光捕获白天颜色×强度，按权威房间XZ边界对受光材质逐片元替换对应照明。原夜间灯光不修改，亮区得到原白天光照，暗区保持夜色；方向光原阴影采样继续，原材质色/贴图及GLB不改。
- 复用Three.js安装版本原ShaderChunk，保留并串接材质旧onBeforeCompile/customProgramCacheKey，统一uniform控制灯状态，无逐次切灯编译或新增阴影贴图。包含批量/实例/蒙皮后世界坐标，逐帧识别异步GLB/DEV新材质，释放时恢复存活材质原钩子。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 灯光定向 | 8/8，原18点可达/操作/双方感知/AI/DEV L保持；新增白色受光翘板/底座凹槽螺钉、无点光/地面薄膜、原白天uniform颜色/强度精确一致、暗区灯光/原材质不变、迟到材质/释放恢复回归 |
| npm test | 1065/1065，失败/取消/跳过0，约73.2秒；系统临时目录rice-room-daylight-full-tests.log；与软件WebGL检查并行执行，耗时不能与前轮直接比较 |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，133模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 独立Chrome/Edge WebGL对照 | 两浏览器亮区采样均为[233,184,117,255]，与原白天同点一致；暗区[84,84,75,255]，与原夜间同点一致，无运行/着色器错误。GPU程序数保持1，切换只更新uniform |
| 独立实际游戏渲染 | Chrome/Edge均模型ready、必需资源ready、18开关存在，无运行/着色器错误；暂停受控场景定位厨房并开灯，截图已生成，Chrome实际截图已人工视觉检查，亮区墙/地/家具/DP恢复明亮，邻区夜色，开关为立体翘板 |
| 自然完整对局/玩家硬件性能 | 未执行；软件WebGL和受控定位不能冒充真人键鼠试玩或硬件帧率验收 |

#### Git检查点

- 本轮7项：src/three/RoomDaylightView.ts（新增）、src/three/RoomLightView.ts、src/three/ThreeGame.ts（只传入原灯光引用）、tests/room-lights.test.mjs、docs/ROOM_LIGHTS_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。既有大量未提交改动保留，不重复归为本轮新增。
- main的HEAD/origin/main及只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，未改模型/音频/地图/道具文件，原5173服务PID45208和线上RC保留，S20继续BLOCKED。

#### 已知限制与下一步

- 独立浏览器使用运行时自带Playwright创建新无账号上下文与软件WebGL，仅访问127.0.0.1。为读取实际游戏状态，测试仅在该上下文本地main.ts响应末尾附加测试引用，未写入生产源码或日常浏览器，不绕过此前Windows窗口URL识别限制。初次测试等待失败是main.ts带Vite时间戳、拦截未命中；页面已正常到菜单且无错误。修正测试URL匹配后两浏览器全部通过，未改启动/模型策略来掩盖测试失败。
- 原始证据在系统临时目录：rice-room-daylight-browser-results.json、rice-{chrome,msedge}-{day,night,lit,actual-kitchen}.png，脚本rice-room-daylight-check.mjs。厨房受控实际场景截图不是自然游玩记录。
- 灯光按区域边界切换而非物理门缝扩散，角色跨边界时表面可分别处于亮暗区域；原1秒模型显隐逻辑不变。请刷新5173确认日常浏览器中的开关外形/房间白天观感及帧率，用户自然验收前不发布。

### 2026-10-18 DEV墙壁开关位置编辑（本地待用户验收）

#### 完成内容

- 用户要求灯位可在开发工具调整，按墙壁开关实现，不添加点光源或改变区域光照边界。沿用ponytail最小改动技能，在现有SceneEditor扩展区增加18区选择、聚焦、X/Z/安装高度输入和场景鼠标拖动。自动吸附同区域真实墙面及朝向，数量/所属区域不可改，编辑期间显示开关但不推进灯光玩法。
- 预览/已应用/项目已保存分开：预览不改RoomLightSystem，应用更新同一玩家/AI交互点及接近点，不重置开关状态或冷却；关闭/放弃清未应用草稿，重开保留已应用位置。原道具拾取目标与开关合并登记，未覆盖已有36道具编辑。
- 新增roomLightLayout.json初始[]，保持原18个派生点不挪动；支持独立保存及总应用/保存。校验有限值、区域/墙面/高度、站立与双方导航可达；本地DEV接口固定路径、同源、SHA-256防旧版本覆盖、共享保存锁、写前备份/临时文件替换。总保存预先校验相关版本，文件系统写入异常如实报告可能部分写入，不冒充跨文件事务。生产不开放保存接口，不保存每局灯状态/AI/技能计时。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 新定向 | 5/5：原18点不变、真实墙面吸附/高度/非法字段/阻挡/可达；草稿/应用/放弃与AI/交互位置；保存失败/旧版本/缺确认；总应用/保存；两种实际保存处理函数在临时目录落盘、备份、409/403/400、刷新解析恢复 |
| 最终npm test | 1070/1070，失败/取消/跳过0，约63秒；系统临时目录rice-light-editor-complete-tests.log |
| 独立tsc / 生产构建 / diff | 均通过，136模块，既有chunk>500kB警告保留 |
| 独立Chrome/Edge | 实际游戏资源ready，18开关+36道具共54扩展拾取目标，真实鼠标拖动/输入高度、独立及总应用、退出丢弃、保存响应和刷新恢复、改后近距操作通过，无运行异常。浏览器保存/刷新使用仅隔离会话响应夹具；实际写文件与备份验证在临时目录，不改项目灯位 |
| 真人自然对局 | 未执行；待用户实际操作验收，不以受控流程声明阶段PASS |

#### Git检查点

- 本轮14项：新增src/three/RoomLightEditor.ts、src/three/map/RoomLightLayout.ts、src/three/map/roomLightLayout.json、tests/room-light-editor.test.mjs；修改src/systems/RoomLightSystem.ts、src/three/RoomLightView.ts、src/three/SceneEditor.ts、src/three/ThreeGame.ts、vite.config.ts、tests/pages-deployment.test.mjs及docs/ROOM_LIGHTS_DESIGN.md、docs/DEV_SCENE_EDITOR_DESIGN.md、docs/DEEPSEEK_HANDOFF.md、本日志。仅因新增DEV插件同步既有清单并断言apply=serve，未放松生产隔离。
- main的HEAD/origin/main/只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/部署/Tag/Release，全部既有未提交内容、备份/私人目录与线上RC保留，S20仍BLOCKED。检查时5173已无监听，启动npm run dev（新PID9732），没有停止原或未知进程。

#### 已知限制与下一步

- 测试证据：系统临时目录rice-light-editor-browser-results.json、rice-light-editor-{chrome,msedge}.png、rice-light-editor-browser.mjs。软件WebGL初次预览断言早于下一渲染帧失败，改为等待真实mesh更新后Chrome/Edge通过；未改玩法来迎合测试。
- 灯位只能在本区域真实墙面调整，不能跨区域或用家具挡住接近点；安装高度上限读取墙体定义。文件保存后4173/线上需要另行构建与授权发布，本轮不发布。后续用户报告属性面板挤压，另按下一条修复，不据先前受控通过否认截图问题。

### 2026-10-18 DEV属性坐标区被挤成细条、无法滚动修复（本地待用户验收）

#### 完成内容

- 用户截图反馈底部坐标只能露出细缝，无法下拉。按diagnosing-bugs技能建立真实编辑器DOM/CSS夹具并先红：762×484视口，属性区16px、外层426px/内容811px、overflow:hidden；坐标不是只读或锁定，而是flex收缩及外层裁切叠加。沿用ponytail技能最小修复，没有另建编辑器或修改玩法。
- style.css改为整块面板可滚动，直接子区不压缩，属性区自然高度，列表保留有限高度与自身滚动；关闭标题栏sticky，输入列允许收缩且盒宽不溢出。原场景编辑、DEV/DEV-B入口、灯位/道具位置与保存数据不变。
- 新增scripts/verify-scene-editor-panel.mjs，复用实际SceneEditorPanel/ThrowableEditor/RoomLightEditor和真实CSS，独立无账号Chrome/Edge，不访问用户浏览器或改写项目布局；不引入新依赖，允许PLAYWRIGHT_MODULE指定现有Playwright。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 原始复现 | 脚本在旧样式明确失败：detailHeight16，坐标区不足120px；日志系统临时目录rice-editor-panel-before.log |
| Chrome/Edge布局回归 | 12/12：两浏览器×762×484/1280×720/1920×1080×灯位区展开/收起；属性区328px，输入实际可编辑/Tab触发坐标回调，命中检测无祖先裁切，保存按钮滚动可达，面板不越视口且输入不横向溢出，无运行异常；rice-editor-panel-after.log |
| npm test | 最终1070/1070，失败/取消/跳过0，约83.4秒；rice-editor-panel-full-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，136模块，既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| 用户日常浏览器/自然对局 | 未代替用户验收，待刷新5173确认屏幕缩放、滚轮及坐标区操作；本修复不涉及玩法 |

#### Git检查点

- 本轮5项：src/style.css、新增scripts/verify-scene-editor-panel.mjs、docs/DEV_SCENE_EDITOR_DESIGN.md（§14）、docs/DEEPSEEK_HANDOFF.md及本追加日志。前一灯位扩展14项另见上一条，既有未提交文件均保留。
- main的HEAD/origin/main未变化，索引空；未暂存/commit/push/Tag/Release/部署，未停止5173或未知进程，保留4173/线上RC、全部备份/私人目录，S20 BLOCKED不变。

#### 已知限制与下一步

- 小窗口需要滚动整个右侧面板，物体列表仍有自己的滚动条；没有把固定窗口强行放大到屏幕之外。默认布局宽度及游戏HUD不变。夹具检验真实布局/点击，不执行真实保存或宣称自然整局通过。
- 请刷新127.0.0.1:5173进入场景编辑，选对象后把鼠标放在面板内向下滚动，确认X/Z/高度等字段和按钮可完整访问。灯位编辑同样保留，未授权发布。

### 2026-10-18 全部墙壁开关安装高度下降至0.7（本地待画面验收）

#### 完成内容

- 用户要求所有开关下降到0.7。按ponytail最小改动技能，仅更新现有roomLightLayout.json：从当前权威地图/碰撞生成既有18处位置并保存高度Y=0.7的覆盖项。逐项只读比对确认X/Z、墙面朝向、接近点均与修改前相同，未修改生成器/表现层/AI或灯光规则。
- 新增对应数据与真实Three.js节点回归，验证完整18区、合法墙面/可达、实际节点初建及sync后高度0.7、DEV模型读取0.7。高度属于既有地图位置字段，不新增玩法配置键。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 定向先红后绿 | 初版[]在18区覆盖断言0≠18处失败；更新后room-light-editor 6/6通过，实际节点及编辑器读数均0.7 |
| 坐标保护 | 18/18原X/Z、朝向、接近点完全相同；安装高度校验通过 |
| npm test | 1071/1071，失败/取消/跳过0，约55秒；系统临时目录rice-switch-07-full-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，136模块；既有chunk>500kB警告保留 |
| git diff --check | 通过 |
| Chrome/Edge实际画面 | 本轮未执行，待用户刷新5173确认高度与遮挡观感；不以模型节点断言冒充实机截图 |

#### Git检查点

- 本轮5项：src/three/map/roomLightLayout.json、tests/room-light-editor.test.mjs、docs/ROOM_LIGHTS_DESIGN.md、docs/DEEPSEEK_HANDOFF.md及本追加日志。现有未提交改动全部保留。
- main的HEAD/origin/main/只读远端一致，索引空，无合并/变基/挑选残留。未暂存/commit/push/Tag/Release/部署，保留私人目录、备份与线上RC；复用5173服务PID9732，无进程终止，S20仍BLOCKED。

#### 已知限制与下一步

- 这是全部18个现有区域开关的安装中心高度，非亮度/照明范围调整；仍可在DEV工具中单独修改并保存。刷新5173检查，线上及已有4173预览不宣称已更新，不自动发布。

### 2026-10-18 开放健身两分区共用照明（本地待用户验收）

#### 完成内容

- 用户确认无墙明暗切线问题并批准把两片健身区合为一个区域。按已说明的照明合并范围实施，沿用ponytail最小改动技能，复用地图OPEN_ROOM_CONNECTIONS，不重构18个地图ID/导航；south_hall与east_hall共用一组灯状态及3秒冷却，当前17灯组、18个可编辑实体开关。两个原开关均保留，位置与0.7高度不动，正式L提示统一「家庭健身区」。
- RoomLightSystem的同组判断成为灯状态/冷却/开关候选唯一入口。RoomDaylightView原有isOn读取自动让两片矩形同时亮，不改着色器，不用外接大矩形误照L形缺口或邻房。旧共边内部归入同灯区以消除精确边界处视距断层，外墙/共边端点仍排除。
- 同组玩家/AI按实体距离选择就近开关，AI路径可跨原共边而非强制同一旧roomId；仍保留近距/遮挡/行动资格/任务优先级/DP真实目击和安全路线门禁，移动仍走CollisionWorld。两方亮区感知同步，墙门/真正藏身、暗区5单位/玩家1秒显示保留、简单普通与其他玩法不改。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 先红后绿 | 旧实现一侧开灯另一侧isOn=false，材质uniform为[1,0]，新增回归失败；修复后[1,1]且共用冷却、原中线无暗视距缝，邻房/L形缺口/外端点不扩亮 |
| 定向 | 27/27（灯光12、灯位编辑6、夜间9），覆盖双方Vision/藏身、两方真实AI辅助方法+受控跨边界路径+实际CollisionWorld移动、同组近距/遮挡、共享冷却与重开、原夜间/编辑保护 |
| npm test | 最终1075/1075，失败/取消/跳过0，约63.4秒；系统临时目录rice-gym-merge-final-tests.log |
| npx tsc --noEmit | 独立执行退出0 |
| npm run build | 退出0，136模块，保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge WebGL | 独立无账号软件WebGL夹具，任一开关开灯后左/中/右RGBA为[233,184,117,255]，与原白天相同；邻房[85,84,75,255]与原夜间相同，无运行/着色器错误；真实灯光/夜间系统及实际GPU着色器，非自然对局截图 |
| 用户日常浏览器/完整对局 | 未代替用户验收，待刷新5173确认整片健身区同步开关及原门墙/藏身规则 |

#### Git检查点

- 本轮8项：src/systems/RoomLightSystem.ts、src/three/RoomLightView.ts、src/three/ThreeGame.ts（仅同灯区路径检查）、tests/room-lights.test.mjs、docs/ROOM_LIGHTS_DESIGN.md、docs/GAME_BALANCE_CONFIG.md（只同步共用冷却口径，数值未改）、docs/DEEPSEEK_HANDOFF.md及本追加日志。原地图/灯位JSON/模型/音频/全部既有改动不变。
- main的HEAD/origin/main/只读远端一致，索引空，无合并/变基/挑选残留；未暂存/commit/push/Tag/Release/部署，保留备份/私人目录与线上RC，复用5173服务PID9732，无进程终止，S20仍BLOCKED。

#### 已知限制与下一步

- 合并的是照明/同组交互范围，不删除地图ID，不重排家具/门/米点/道具。DEV列表仍区分两段便于选择安装位置。当前开放连接只有这一对，不自动把打开的门当作同灯区；未来若添加开放连接链，应在灯组入口改为连通分量，不在本轮预建系统。
- DP仍会拒绝更靠近追捕者或不安全的导航路线；初始完整导航夹具因此未切灯，改用明确安全跨边界路径锁定本轮接线并保留真实碰撞测试，没有改避险策略迎合测试。真实地图18个开关可达性原回归保留，不声称任何情况下AI必去切灯。
- 原始GPU证据系统临时目录rice-gym-light-browser-results.json、rice-gym-light-check.mjs；本轮不公开部署、不进入下一阶段。请本地困难局分别用两个开关，检查整片同亮同暗、邻房不跟随。

### 2026-10-18 工程交付整理与Git归档授权

#### 完成内容

- 用户明确批准“先整理工程，然后推送Git”。按已说明的ponytail最小改动原则，不搬动源码目录、不更改玩法或既有素材；将历轮已批准实现、必要新模块/测试/静态灯位数据、设计和报告整理为87个文件的精确白名单，见docs/PROJECT_DELIVERY_2026-10-18.md。
- 暂存清单第一次独立导出暴露CRLF兼容问题：本机/索引LF、Windows core.autocrlf=true导出CRLF，五处测试源码提取/工作流断言因此失败，去除换行差异后内容完全相同。按diagnosing-bugs流程缩小到五个文件（本机40/40、导出36项中5处失败，其中一个文件级失败导致其内部测试未注册）后，仅在五处测试读文本时规范化CRLF，不改游戏源码或放宽行为断言；最终结果另列。
- 历史S19-P八份JSON纳入版本控制；其中七份原始证据与收尾索引的字节数/SHA-256逐项一致。新增窄范围.gitattributes -text，防止Windows换行转换破坏证据。原证据保持不变，不重新断言历史公网当前状态。
- 私人目录不读取/修改/暂存；incoming-assets、自动备份、既有未跟踪截图/诊断/验证材料均留在原处，dist/node_modules不提交，不改.gitignore。未新增运行模型/图片/音频。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
|---|---|
| 工作区npm test | 初次1075/1075；五处换行兼容修正后最终1075/1075，失败/取消/跳过0，约76.2秒；系统临时目录rice-delivery-final-worktree-tests.log |
| 独立npx tsc --noEmit | 退出0 |
| npm run build | 退出0，136模块，保留既有chunk>500kB警告 |
| 暂存清单独立导出 | 最终1075/1075，失败/取消/跳过0，约81.5秒；独立tsc、根路径与Pages构建退出0；系统临时目录rice-delivery-final-export-tests.log。复用现有依赖，不声称npm ci；最终仅同步三份交付文档结果，源码/测试不变 |
| 严格Pages子路径审核 | PASS，86个产物文件/43,102,437字节，v6与米袋GLB字节/哈希保持，未混入DEV、备份、私有/旧模型资源 |
| Git差异与凭据模式扫描 | 精确87项清单、无未暂存受跟踪变更、历史7/7哈希、diff检查通过；87项扫描无凭据模式命中，不等价于完整安全审计 |
| 浏览器自然完整对局 | 本轮未重跑，不将源码归档当成外部设备验收 |

#### Git检查点

- 归档起点HEAD/origin/main/只读远端一致，main，索引空，无合并/变基/挑选残留；用户授权正常暂存/commit/push，不授权改写历史、Tag/Release或网站部署。
- 本条随本轮工程归档提交，实际提交编号和远端同步以git log/ls-remote及本轮交付回复为准。只精确暂存白名单，不使用git add .或git add -A。

#### 已知限制与下一步

- 当前线上腾讯云RC不随本轮Git归档宣称更新；现有GitHub Pages工作流仅支持手动workflow_dispatch，不由push触发。S20仍BLOCKED，S21不启动，既有Tag/Release保持不动。
- 历史报告中的其他本地截图/临时证据并未整体发布，新克隆不保证这些本地链接存在。下一步需另行批准生产构建更新与真实外部设备复验，不代表v1.0.0发布。

### 2026-10-18 移动浏览器横屏适配：本地完成，待真机验收

#### 完成内容

- 用户批准按建议一次性完成本地手机适配。本轮复用原InputManager→LocalControl→玩法系统：摇杆移动、长按E交互/吃米、Human V抓捕/Q布网/Space破门、DP Q锁门/Space冲刺、F拾取、困难L开关，以及取消/暂停/结算/重开/返回；未调整任何玩法参数或AI。
- 触屏技能按钮读取原HUD帧的冷却与容量（网四张、锁门三扇）；投掷按住按钮拖向屏幕目标、松手投出，按手指编号隔离；布网触摸预览、绿色可放、松手经原系统确认。pointercancel/意外丢失捕获不误投、不消耗布网冷却；混合键盘和触屏同键不产生第二次按下。
- 新增手机CSS，处理横屏菜单/技能/说明/暂停/结算/锁芯布局、刘海安全区和动态高度；DEV工具条仍可达。竖屏遮罩后READY保留时间、PLAYING进入原暂停，旋回横屏需主动继续；后台/失焦/尺寸变化/换局释放触控输入。
- 粗指针设备绘制像素比上限1.35、阴影贴图1024，桌面原2/2048不变；未替换v6、地图、美术或音频，未新增依赖，原加载就绪门禁保持。
- 修改清单：index.html；src/main.ts、game-ui.css、新增mobile-ui.css；src/three/InputManager.ts、AlphaHudView.ts、ThreeGame.ts、ThrowableView.ts、CaptureNetView.ts、ControlsHelpView.ts、PulseLockView.ts；五个相关Node测试、新增scripts/verify-mobile-controls.mjs；新增移动设计/验收文档并更新HANDOFF，本日志仅末尾追加。

#### 自动化测试与人工验收

| 检查 | 实际结果 |
| --- | --- |
| 定向回归 | 最终80/80；新增/扩展触控方向/按键边沿、多指所有权、取消/捕获丢失、容量/冷却、READY竖屏及PLAYING暂停，原键鼠回归保留 |
| 全量npm test | 最终1079/1079，失败/取消/跳过0，约149.5秒；系统临时目录rice-mobile-final-tests.log |
| 独立npx tsc --noEmit | 退出0 |
| 根路径及Pages生产构建 | 均退出0，137模块；原chunk>500kB警告保留；最终dist为根路径 |
| 严格Pages/产物检查 | 86文件、43,119,633字节；仅允许正式资产，正式GLB原字节保持；根路径JS未发现测试页面/实例/探针字符串 |
| Chrome/Edge手机模拟操作 | 两个尺寸667×375/844×390×两阵营共8/8：真实WebGL/v6就绪、触控移动/拾取/多指瞄准投掷/取消、网放置与名额、门/家具/扇形/破门/锁芯、吃米/藏身/冲刺/锁门、困难灯光、暂停/旋转/结算/重开/返回，页面运行异常0 |
| 定稿手机布局/桌面 | 手机布局8/8，按钮在视口内且高度至少44px；桌面PLAYING下触屏UI隐藏、原技能HUD可见，D按下/松开输入正确，Chrome/Edge2/2 |
| git diff --check | 退出0，仅既有LF/CRLF提示；未改配置/AI/碰撞/地图/public的Git比对退出0 |
| Android/iPhone/微信真机 | 未执行，需用户与朋友真实设备验收；没有将Chromium尺寸模拟声称为Safari或微信测试 |

浏览器仅使用独立本地拦截页面/会话；合法场景位置及权威结算为测试设置，不是自然整局或AI平衡证明。CDP同时移动/瞄准验证与逐根手指释放的Node回归分开记录。原始图片及复核目录见MOBILE_BROWSER_SUPPORT.md，临时证据不自动纳入Git。

#### Git检查点

- 开工main，HEAD/origin/main/只读远端一致，索引空，无合并/变基/挑选残留。用户既有未跟踪验证材料和私人目录保留。
- 本轮未暂存、commit、push、Tag、Release或部署；没有改写历史或更新公网RC。代码与生产构建供用户审查，尚未建立移动端Git检查点。

#### 已知限制与下一步

- 当前只确认本地实现、自动化及独立Chrome/Edge模拟；Android/iPhone实际性能、Safari/WebKit、微信内置浏览器、刘海/浏览器底栏、触感和切后台声音恢复需要真机确认。未安装额外浏览器引擎或依赖。
- 原Vite PID9732保持。一次启动因5173已占用而严格退出，核实原进程后复用，没有切端口或停止其他进程。
- 下一步等待用户审查后决定RC更新与手机外部试玩；S20继续BLOCKED，S21不启动，现有正式发布边界保持。

#### 同轮交付前权限隔离收尾（以本条为最终门禁结果）

- 最后复核发现手机取消入口原先可能让DP看到Human AI的布网状态，且取消自己的投掷时连带中止对方布网。本轮修复HUD显示与ThreeGame执行的两处阵营门禁：DP只取消自己的投掷，Human才允许取消自身布网/锁芯；AI策略和布网规则不改。
- 新增真实宿主cancelTouchAction回归，DP取消前后Human CaptureNetSystem完整快照一致；HUD回归断言DP不显示对方PLACING、Human仍可取消自身AIMING。定向最终81/81。
- 交付前重新执行全量npm test：1080/1080，失败/取消/跳过0，约52.6秒，覆盖本条权限修复；系统临时目录rice-mobile-final-tests.log已更新。独立tsc通过，Pages及根路径生产构建重新通过（137模块），严格Pages86文件/43,119,718字节，最后保留根路径dist。既有chunk警告仍在。
- 上方1079项及旧产物字节数为权限收尾前真实检查结果；最终基线以本条及HANDOFF/移动适配文档为准。浏览器受控流程8/8、定稿布局8/8、桌面2/2的验收范围不变，真机仍待验收。本轮继续未暂存/提交/推送/部署/Tag/Release，S20保持BLOCKED。

### 2026-10-18 DeepSeek 藏身提示去重与措辞调整

- 截图显示进入藏身时较长的技能通知与持续进度状态条上下紧贴，且重复说明退出操作。本轮进入成功时清空旧技能通知，只保留状态条“藏身中 · 按 E 离开”；退出后提示改为“已离开藏身，可以继续行动”。未改藏身规则、玩法计时或其他技能文案。
- 新增HUD回归并更新旧提示断言；最终定向/全量、TypeScript、根路径构建及 `git diff --check` 结果以本条交付报告为准。文档追加记录；未暂存、提交、推送、Tag、Release或部署，S20仍BLOCKED。
