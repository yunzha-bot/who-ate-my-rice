# 《谁吃了我的米》Agent 工作日志

> 本文件记录实际完成并验证的工作，不是 `AGENTS.md` 指令文件。后续按日期追加；计划中的功能不写成已完成。

## 项目状态

- 目录：`D:\桌面\dev\who-ate-my-rice`
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
- Gate 验收结果：S2 最终状态：PASS；全部 Gate 通过。
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
- S3 Gate 验收结果：待人工验收，未判定 PASS；核心“双方各赢一局、结算后重开再打一局”尚待确认。因此未提交、未推送、未创建 `v0.0.3`。
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
- S3 Gate 验收结果：PASS；用户已人工验收原 60 秒 S3 闭环全部通过，本次仅通过配置调整开发测试时长，自动化回归通过。
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
- 测试结果：`npm test` 30 项全部通过，含原有 Rice/GameState/Sprint 回归及 3D 碰撞、屏幕方向、阵营切换、相机目标、FACTION_SELECT、R/M 重开与状态清理测试。`npm run build` 通过，包含 TypeScript 检查；移除 Phaser 后重新运行两项检查仍通过。用户人工确认 3D 场景、相机与屏幕方向、双阵营控制、碰撞、进食、冲刺风险、抓捕、暂停、双向胜负、R/M 重开及连续第二局全部正常；S4.5 人工验收 PASS。
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
- Gate：PASS；用户已完成浏览器人工验收并确认通过。
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
- 当前开发阶段：S6B Gate = PASS，人工验收 = PASS；本次不进入 S6C。
- 本次目标：完成 Door System、锁门玩法、门碰撞与抓捕阻挡、暂停输入安全和角色圆形碰撞的阶段收尾，并记录构建环境事件。
- Door System：将 18 个 `DoorNode` 正式升级为 Door System，支持 `OPEN / CLOSED / LOCKED`。Human 与 DeepSeek 都能正常开关未锁门；Door Leaf 围绕 Door Hinge 转动；OPEN Door 可通行，CLOSED / LOCKED Door 产生动态碰撞并阻断 Capture 判定。
- 门比例调整：门改为更短的住宅单扇门，门洞同步收窄，左右墙体同步收口；门与墙体高度均增加，门墙比例调整为更接近住宅灰盒尺度。
- Lock：DeepSeek 可锁住 CLOSED Door，OPEN Door 不可直接 Lock；Human 当前不能通过普通 Door Interaction 打开 LOCKED Door，反制留到 S6C。Lock Core 与 Door Leaf 分离。`MAX_ACTIVE_LOCKS = 3`，第 4 个 Active Lock 会被拒绝，不替换已有锁。
- Pause / Input：Esc 统一进入 Pause Menu，提供 Continue、Restart、Return to Faction Select 和开发调试用 Switch Controlled Faction。`selectedFaction` 与 `controlledFaction` 保持分离；裸 R / M / Tab 由 `development.directHotkeysEnabled = false` 默认关闭，避免正常对局误触。
- Player Collision：原角色逻辑碰撞为 Box / AABB footprint，在 W+A、W+D、A+S、S+D 斜向移动经过墙角、门框和家具边角时，会因轻微角点接触出现卡脚或粘住。最终改为角色 XZ Circle Footprint，环境 Wall / Furniture / Door 保持 AABB，组合使用 Circle-vs-AABB、Axis-Separated Collision Resolution 与 Wall Sliding；Sprint 同样使用 Circle Collider。用户人工确认卡脚问题明显改善并通过验收。
- 回归结果：Door 开关与锁定、门碰撞、门阻断抓捕、锁数量限制、门口角色防夹、Sprint 防穿门、暂停菜单、阵营切换、Rice、Capture、Sprint、重开与地图连通均通过自动测试和人工验收。
- Build Environment Incident：S6B 正式收尾时，`npm test` 93 / 93 PASS，`git diff --check` PASS；第一次 `npm run build` 因 `EPERM: operation not permitted` 失败，涉及路径 `D:\桌面\dev\who-ate-my-rice\dist`。确认 `dist/` 是 Vite 纯构建产物、未被 Git 跟踪且已由 `.gitignore` 忽略；删除后仍曾无法重新创建。排查期间未修改游戏源码或 Windows ACL，未使用管理员提权、`takeown`、`icacls` 或 `taskkill /F`。
- 构建环境处理：发现明确指向本项目的 Vite dev server：`node.exe`，PID 24900，端口 5173；以非强制方式正常停止。随后项目根目录临时目录创建 PASS、删除 PASS，确认当前执行环境具备项目根目录写入权限；再次执行 `npm run build` PASS。
- 构建事件结论：无法 100% 证明本次 EPERM 一定由 Vite dev server 文件占用直接导致，但停止当前项目 Vite 开发服务器后，项目根目录写入测试与 Vite production build 均恢复正常。后续正式 build / 阶段收尾前，应优先确认当前项目 dev / preview server 已正常停止。
- 新增文件：`src/systems/DoorSystem.ts`、`src/three/DoorView.ts`、`src/three/RoundShortcuts.ts`、`tests/door-system.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`package.json`、`src/config/gameConfig.ts`、`src/style.css`、`src/systems/GameStateSystem.ts`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`、`tests/apartment-map.test.mjs`、`tests/camera-controls.test.mjs`、`tests/collision-world.test.mjs`。
- 删除文件：无。
- 依赖变化：无新增或删除依赖；仅扩展现有测试脚本。
- 测试结果：最终 `npm test` 93 项全部通过；`npm run build` 通过并包含 TypeScript 检查；`git diff --check` 通过。用户人工确认 S6B Gate 与体验 Gate 均为 PASS。
- 已知问题 / Build Notes：Vite production build 的主 JS chunk 约 570.87 kB，仍高于 500 kB 提示线；这是已知非阻断构建提示，本阶段不调整 `chunkSizeWarningLimit`，留待后续浏览器兼容 / 性能优化阶段处理。当前开发大米仍为 5 秒，正式设计值为 60 秒，发布前必须恢复并复测。
- 下一步建议：完成本次 commit 和 push 后，可以等待用户单独授权进入 S6C —— Human 反制 / PulseLock；本次不开始 S6C，也不创建新 Tag，当前 milestone 仍为 `v0.1.0-alpha`。
- Git commit 信息：计划 `feat: add door locking gameplay`；实际提交与推送结果以最终汇报为准。

## 2026-09-22 01:28 +08:00｜S6C Human 反制 / PulseLock 正式完成

- 任务名称：S6C —— Human 反制 / PulseLock 正式收尾。
- 当前开发阶段：S6C Gate = PASS，人工验收 = PASS；本次不进入 S6D。
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

- 任务名称：S6C —— Human 反制 / Minesweeper Lock Counterplay。当前阶段 S6C Gate = PASS，用户人工验收 = PASS；下一阶段为 S6D —— 双向信息系统，尚未开始。
- 本次目标：以最终扫雷反制规则取代前述 Hold E PulseLock 原型，完成验收后的文档、自动验证和 Git 收尾；历史日志保留，旧原型规则不再适用于当前版本。
- 实际完成内容：Human 对 LOCKED Door 按 E 打开 4×4、3 雷扫雷；长按或连点 E 不再推进解锁。× / Esc 退出后，同一 Lock Core 的盘面本局保留；扫雷期间世界继续运行，Human 不能移动，Capture Zone 仍可工作。扫雷成功使 Core `ACTIVE → DISABLED`、Door `LOCKED → CLOSED` 并释放 Lock Slot；Human 需再次 E 开门。踩雷失败时门仍 LOCKED，对局不结束。
- Human Space：普通 CLOSED Door 立即 OPEN，不触发或受强破 CD 限制；LOCKED Door 则立即强破 Core 并 OPEN，进入 30 秒 Force Break CD。CD 内锁门不能再强破，但仍可 E 扫雷，普通门仍可 Space 免费打开；扫雷成功不触发强破 CD。DISABLED Core 本局不能再次 Lock。门交互范围扩大至 1.3 世界单位，并选最近的可达门，不可隔墙操作。
- 回归与验收：DeepSeek Space Sprint、Capture、Door Collision、Circle Collider、Esc Pause Menu 均无阻断回归；用户确认 S6C 人工 Gate PASS。正式大米仍设计为 60 秒，当前开发测试值仍为 5 秒，发布前需恢复并复测。
- 新增文件：`src/systems/HumanDoorSkill.ts`、`src/systems/MinesweeperLockSystem.ts`、`tests/human-door-skill.test.mjs`、`tests/minesweeper-lock.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`package.json`、`src/config/gameConfig.ts`、`src/style.css`、`src/systems/DoorSystem.ts`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`。
- 删除文件：已由最终扫雷实现替代的 `src/systems/PulseLockSystem.ts`、`tests/pulse-lock.test.mjs`。
- 依赖变化：无新增依赖；测试脚本改为运行扫雷和 Human 门技能测试。
- 测试结果：`npm run build` PASS（含 TypeScript 检查）；`npm test` 115 / 115 PASS；`git diff --check` PASS。首次构建因清理 `dist/assets/.gitkeep` 遇到 EPERM；确认 `dist/` 是被 Git 忽略且未跟踪的纯构建产物，无明确属于本项目的 Vite/npm 进程，安全清理后让 Vite 重建，构建通过。未修改 ACL、源码或 Vite 配置来绕过该问题。
- 已知问题：主 JS bundle 约 581.22 kB 的 Vite >500 kB 提示仍为非阻断警告；无法确定此前 EPERM 的唯一成因。仓库不存在 `docs/SHARED_GAMEPLAY_SPEC.md`，按要求未新建。
- 下一步建议：完成本次 commit / push 后等待用户另行授权 S6D，不创建 Tag、不提前开始下一阶段。
- Git commit 信息：计划 `feat: complete human lock counterplay`；实际提交及推送结果以最终汇报为准。

## 2026-09-23 11:26 +08:00｜S6D / S6 游戏玩法 Alpha 正式封版

- 任务名称：S6D 双向信息系统及 S6 游戏玩法 Alpha 收尾；当前开发阶段：S6D Gate = PASS，S6A～S6D 人工 Gate 均已通过，下一阶段为 S7A Human AI（本次不开始）。
- 本次目标：核对已实现规则、统一数值配置和六项浏览器人工验收结果，通过自动验证后完成文档与 Git 里程碑收尾。
- 实际完成内容：S6D 已接入双向 SoundEvent、距离衰减与墙/门遮挡、相机相对声音方向和远蓝/中黄/近红场景声波；Vision 区分 VISIBLE、BLOCKED 与 OUT_OF_RANGE，Last Seen 与当前可见状态独立。鼠标点角色仅改变开发临时 WASD 输入目标；Esc 开发菜单切换正式主控，并同步镜头与信息观察者，不重开对局。
- 米痕最终规则：DeepSeek 实际进食进度增长后开启或刷新 5 秒脚印生成窗口；窗口内移动按步距生成脚印，静止不生成。每个脚印从生成起独立保留 15 秒，末段平滑淡出；窗口结束不删除既有脚印。Human 正式观察者可见，暂停冻结计时，Restart / 新局清空。
- 人工验收：用户于本次任务明确确认 S6D 六项浏览器人工验收全部 PASS：声音可视化、声音遮挡、鼠标临时控制、Esc 正式主控切换、米痕脚印、Vision / Last Seen。S6D Gate = PASS；S6A、S6B、S6C 的人工 PASS 已在前述日志记录。
- 数值配置：现有可调玩法值集中在 `src/config/gameConfig.ts`，运行系统经 `GAME_CONFIG` 读取；`docs/GAME_BALANCE_CONFIG.md` 记录实际值、单位与影响。正式每份米 60 秒，开发测试仍为 5 秒，发布前须恢复并复测。目前未实现对局倒计时，不将其记作已完成。
- 新增文件：`docs/GAME_BALANCE_CONFIG.md`、`tests/balance-config.test.mjs`（相对上次 WIP 检查点）。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md` 及当前 S6D／数值配置相关源码与测试；删除文件：无；依赖变化：无。
- 测试结果：本次 `npm test` 141/141 PASS，`npm run build` PASS（含 TypeScript 检查），`git diff --check` PASS。构建前未发现明确属于本项目的 Vite/npm 进程；未修改 ACL、Vite 配置或游戏平衡。
- 已知非阻断问题：Vite 主 JS chunk 约 599.97 kB，超过 500 kB 提示线；开发米仍为 5 秒，正式发布前需切回 60 秒。没有对局倒计时功能。未发现本次封版自动检查阻断问题。
- Git：已有 S6D WIP 安全检查点 `3a29926`（`wip: preserve s6d information systems`）；本次正式封版 commit、main 推送及 `v0.2.0-alpha` Tag 结果以实际执行和最终汇报为准，不预填尚未产生的 hash。

## 2026-09-23 15:14 +08:00｜S7A WIP 安全检查点

- 任务名称：保存 S7A Human AI 与角色动作接口工作进度。
- 当前开发阶段：S7A 开发中；角色动作接口专项人工验收 PASS，整个 S7A 尚未正式验收或标记完成。
- 本次目标：通过自动验证后，将当前 S7A 相关代码、配置、测试及文档保存为 WIP 检查点。
- 实际完成内容：保留 Human AI 巡逻、调查、追逐、导航和门处理实现；保留独立角色动作接口、DEV 双角色动作状态与切换原因显示，以及动作参数说明。用户确认角色动作接口专项人工验收 PASS；该结果不代表整个 S7A Gate 通过。
- 新增文件：`src/systems/CharacterAction.ts`、`src/systems/HumanAIController.ts`、`src/systems/NavigationSystem.ts`、`src/three/CharacterActionView.ts`、`tests/character-action.test.mjs`、`tests/human-ai.test.mjs`、`tests/navigation.test.mjs`。
- 修改文件：`AGENTS.md`、`docs/GAME_BALANCE_CONFIG.md`、`src/config/gameConfig.ts`、`src/style.css`、`src/three/CollisionWorld.ts`、`src/three/ThreeGame.ts`；本条为追加日志。
- 删除文件：无。依赖变化：无。密钥、`dist/`、`node_modules/` 和 `.env` 未加入版本控制。
- 测试结果：`npm test` 153/153 PASS；`npm run build` PASS；`git diff --check` PASS。构建有已知 Vite 612.95 kB（超过 500 kB）非阻断提示。
- 已知问题：整个 S7A 尚未完成正式人工验收；Human AI 完整体验仍待验收。
- 下一步建议：等待 S7A 后续人工验收与阶段 Gate；本检查点不代表阶段封版。
- Git commit 信息：`wip: preserve s7a human ai and action interface`；hash 与推送结果以本次执行汇报为准。

## 2026-09-23 15:33 +08:00｜S6～S7A 文档状态同步

- 任务名称：同步 S6 与 S7A 项目进度、动作接口长期规则和参数索引。
- 当前阶段：S7A Human AI 进行中。角色动作接口专项人工验收 PASS；整个 S7A 尚未正式验收或完成。
- 本次目标：核对正式 Tag、最近 WIP 检查点、Human AI 实际实现与统一数值文档，并同步项目长期状态。
- S6 状态：S6A～S6D 及 S6 已完成。仓库 Tag 查询确认 `v0.2.0-alpha` 存在；本次只读远程 Tag 查询返回对象 `fff6f8a29223bce3c5b780a9a39738fa54ca1ca2`。未发现 `docs/SHARED_GAMEPLAY_SPEC.md`，未新建该文件。
- S7A 实现进度：Human AI 已有 `PATROL / INVESTIGATE / CHASE / CAPTURE` 状态；读取现有声音、Vision / Last Seen，使用房间级声音调查和 XZ A* 导航，普通 CLOSED Door 可沿路径开启，锁门不可通行；抓捕由既有 Capture / Match 规则结算。已接入暂停/准备阶段停更、开发控制接管和重开重置。Human AI 完整浏览器行为尚待人工验收，S7A 不记为完成。
- 动作接口：用户确认专项人工验收 PASS。玩家与 AI 共用 `IDLE / WALK / RUN / EAT / STARTLED / FALL / STUN / INTERACT / CAPTURE` 接口；DEV HUD 可观察双方动作与切换原因。正式角色及动作资源尚未导入；GLB / AnimationMixer 仅有预留接口，尚无正式动画片段。
- 配置核对：`docs/GAME_BALANCE_CONFIG.md` 中 Human AI 参数及 `C.characterAnimation.fallPoseMs = 220 ms`、`transitionMs = 120 ms`、`stunColor = 0xff7777` 与 `src/config/gameConfig.ts` 一致；未发现需要改数值表的差异。
- WIP 检查点：`2205b32de17385edb684fa24928d5d976b6dd42f`（`wip: preserve s7a human ai and action interface`），此前执行结果为 push 成功；提交时自动测试 153/153 PASS、build PASS、`git diff --check` PASS。本次远程 Tag 查询成功，但远程 `main` 实时查询因无法连接 GitHub 失败；本地 `main` 与 `origin/main` 跟踪指针均指向该提交。
- 本次文档修改：更新 `AGENTS.md` 的阶段状态和角色动作长期规则；本条追加于日志末尾。未修改游戏代码、参数或共享规范。
- 测试：本次仅文档维护，未重跑游戏自动测试；`git diff --check` PASS。
- 下一步：进行 Human AI 基础行为人工验收；之后再按 Gate 结果决定 S7A 状态。
- Git：不 commit、不 push、不创建 Tag。

## 2026-09-23 16:24 +08:00｜S7A-1 Human AI 基础行为验收

- 任务名称：S7A-1 Human AI 基础行为收尾。
- 当前阶段：S7A-0 角色动作接口专项与 S7A-1 Human AI 基础行为均通过；整个 S7A 尚未完成，CURRENT = S7A-2 Human AI 高级决策。
- 本次目标：记录用户确认的 S7A-1 浏览器人工验收并保存实际自动验证结果。
- 人工 Gate：用户确认巡逻、循声调查、视觉追逐、追丢后搜索、普通门与拐角寻路正常；玩家控制 Human 时 AI 不抢控制，S7A-1 = PASS。此前 S7A-0 动作接口专项人工 PASS 见前序记录。
- 实际完成内容：巡逻覆盖所有主要房间；最后目击调查优先于声音调查；网格路径增加沿边圆形碰撞采样，防止窄墙角斜穿；路径节点长时间没有接近进度时避开该节点重新寻路。普通关门使用既有开门接口，锁门绕行；DEV HUD 显示路径节点、状态切换原因及路径事件。
- 配置：新增 `C.humanAI.stuckProgressEpsilon = 0.05` 世界单位，并已同步 `docs/GAME_BALANCE_CONFIG.md`；未调整既有玩法平衡值。
- 测试结果：`npm test` 159/159 PASS；`npm run build` PASS（含 TypeScript 检查）；`git diff --check` PASS。构建前已正常停止本项目 Vite 预览。Vite 615.80 kB 主包超过 500 kB 的提示为已知非阻断警告。
- 新增文件：无。修改文件：Human AI、寻路、ThreeGame DEV HUD、Human AI / Navigation 测试、`src/config/gameConfig.ts`、`docs/GAME_BALANCE_CONFIG.md`、`AGENTS.md` 与本日志。删除文件：无。依赖变化：无。
- 已有检查点：本工作基于 `2205b32`（`wip: preserve s7a human ai and action interface`）；本次阶段提交 hash 与 push 结果以 Git 实际执行为准。
- 下一步：进入 S7A-2 Human AI 高级决策的计划与开发；本次不开始 S7A-2。

## 2026-09-23 17:40 +08:00｜S7A-2 开发调试面板专项验收

- 任务名称：记录可收纳调试面板专项人工验收。
- 当前阶段：S7A Human AI 进行中；本次仅调试面板专项 PASS，整个 S7A 尚未完成。
- 本次目标：记录用户确认的调试面板验收，并核对 Human AI 平衡参数的复验状态。
- 实际完成内容：用户确认原左上、左下、右上调试窗口已整合为默认收起、可展开/收纳的统一面板；原有实时调试信息与游戏操作均保留。验收状态同步记录于 `AGENTS.md`，此处保留本次专项的具体结果。
- 平衡参数核对：`GAME_CONFIG.humanAI.movementSpeedMultiplier = 0.92`（AI 专用倍率，约比 Human 基础速度低 8%）；`aiUnlockDurationMs = 8,750 ms`（原 5,000 ms 的 1.75 倍）。用户尚未确认这两项调整的最终手感复验，故仍为待验收，未将整个 S7A 标记完成。
- 游戏功能代码及数值：本次未修改。新增文件：无；修改文件：`AGENTS.md`、本日志。删除文件：无。依赖变化：无。
- 测试结果：本次为文档维护，未运行游戏测试；`git diff --check` 待本次收尾检查。
- 已知问题：Human AI 移速与自动解锁耗时需等待最终手感复验。
- 下一步建议：等待用户复验上述两项平衡调整；在整个 S7A Gate 通过前不进入 S7B。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-23 18:00 +08:00｜S7A Human AI 正式封版

- 任务名称：修复构建环境阻断并完成 S7A 阶段收尾。当前开发阶段：S7A Gate = PASS；下一阶段 S7B DeepSeek AI，本次不开始。
- 本次目标：确认 S7A 人工验收、构建与数值文档一致性，再提交现有 S7A 工作。
- 人工验收：用户最终确认 S7A-0 角色动作接口、S7A-1 基础 Human AI、S7A-2 高级决策及可收纳调试面板均 PASS。先前“平衡待最终手感复验”记录保留为当时状态；现接受 AI 移动倍率 0.92 与单次自动解锁 8,750 毫秒。解锁速度留到 S16 平衡阶段继续调整，不阻断本次 Gate。
- 实际完成内容：保留已有 Human AI 巡逻、循声调查、视觉追逐、有限搜索、锁门绕行/模拟破解/强破、暂停及开发控制接管、调试 HUD 与动作接口；本次未修改玩法或平衡值。`src/config/gameConfig.ts` 与 `docs/GAME_BALANCE_CONFIG.md` 的 AI 参数已核对一致。
- 构建问题：`public/assets/.gitkeep` 是被 Git 跟踪的零字节占位文件，Vite 会把它复制到 `dist/assets/.gitkeep`；没有源码或运行依赖，现已移除。先前该路径 EPERM 的已验证原因是当前 Codex 受限执行对仓库路径没有写入权限：原始 `npm run build` 在具备该目录写入权限的执行环境下成功。未发现只读属性，也未确认有项目进程占用；不据此认定一般 Windows 文件锁已被完全排除。保留原始 TypeScript + Vite 构建命令，未改 Vite 输出目录、npm 脚本或系统 ACL。
- 验证：移除占位文件后连续 3 次 `npm run build` PASS（均执行 TypeScript 检查与生产构建）；`npm test` 165/165 PASS；开发服务 `127.0.0.1:5174` 在构建后仍返回 HTTP 200；`dist/assets/.gitkeep` 未再生成。故意设置不存在的 Node 预加载模块时，`npm run build` 返回退出码 1，确认失败不会被伪报成功。`git diff --check` 以本次最终检查结果为准。
- 新增文件：无。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`，并纳入此前未提交的 S7A 配置文档、Human AI、寻路、调试面板及测试修改。删除文件：无用途的 `public/assets/.gitkeep`。依赖变化：无。
- 已知非阻断问题：Vite 主 JS chunk 约 624.28 kB，高于 500 kB 提示线；当前 Codex 若再次以无仓库写入权限的受限执行构建，仍可能在其他 `dist` 文件遇到 EPERM，需按项目写入边界处理；一般 Windows 文件占用风险未被证明为零。S16 待办：复评 Human AI 自动解锁速度。
- Git commit 信息：计划 `feat: complete s7a human ai`，实际 hash 与推送结果以本次 Git 执行和最终汇报为准；本阶段不创建 Tag。
