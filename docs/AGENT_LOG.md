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

## 2026-09-24｜S7B-3A DeepSeek 逃脱关门归档与 Harness 交接

- 任务名称：归档 S7B-3A 条件式逃脱关门、同步长期规则并创建 DeepSeek Harness 交接快照。分支 `main`；开始时 HEAD / `origin/main` 均为 `9da38c0256f3e65cded4e19d6aa315f3c264a781`，工作区已有 S7B-3A 修改及用户未跟踪 `.trae/` 资料。
- 阶段状态：S7B-3A 已通过用户确认的 5/5 浏览器人工验收；S7B 整体仍未完成；下一项唯一主要任务为 S7B-3B 主动锁门与逃脱策略。本记录不将 S7B 标为完成。
- S7B-3A 规则：仅 EVADE 时考虑刚实际通过、仍在近距离的 OPEN Door。须当前目视确认 Human 位于另一侧、两角色不占用门叶、Human 距离至少 1.5 世界单位、门在 1,800 毫秒通过窗口内，并验证 DeepSeek 关门后仍能沿不经过该门的路径逃离，同时 Human 的当前可达追击路线会使用该门。条件不成立即继续原逃跑；成功通过 `DoorSystem.toggle` 改变真实门状态并同步碰撞、视线与声音。每门 5,000 毫秒重试冷却避免开关振荡。没有新增 AI 锁门行为。
- 用户确认的人工结果：正常追逐时安全穿门关门并继续逃跑、Human 已同侧、Human 距离过近、关门会封堵唯一退路、Human 重新开门后 AI 不原地振荡，以上 5 项均 PASS。该结果为用户提供的人工验收，不是本次重新执行的浏览器验收。
- 调试与日志：DEV Details 新增 `Door Escape / 关门逃脱`，显示候选门/距离、是否通过、Human 另一侧是否可确认、关门后路线、收益依据、最近结果、跳过原因与冷却。AI JSON 日志记录 `DOOR_ESCAPE_EVALUATE`、`DOOR_ESCAPE_CLOSE`、`DOOR_ESCAPE_SKIP`、`DOOR_ESCAPE_FAILED`；相同决策不逐帧重复记录。
- 配置：`GAME_CONFIG.deepseekAI.doorEscapeMinHumanDistance = 1.5` 世界单位，`doorEscapeCrossingWindowMs = 1,800` 毫秒，`doorEscapeCooldownMs = 5,000` 毫秒；均已同步 `docs/GAME_BALANCE_CONFIG.md`。保留用户其他手动配置数值。
- 本次自动验证：`npm test` 270/270 PASS；`npm run build` PASS（含 `tsc --noEmit`）；`git diff --check` PASS。Vite 主 JS bundle 约 704.03 kB，>500 kB 为已知非阻断提示。浏览器地址返回 HTTP 200；本次未重做完整手动交互验收。
- 文件：新增 `docs/DEEPSEEK_HANDOFF.md`、`tests/deepseek-door-escape.test.mjs`；更新 `AGENTS.md`、本日志、`docs/GAME_BALANCE_CONFIG.md`、DeepSeek 控制器、ThreeGame、AILogCollector、DEV Details 类别与既有面板测试。无依赖变更；未纳入 `.trae/`、`dist/`、`node_modules/` 或临时日志。
- 既有待办：S7B-2 偶发原地停留作为后续 AI 优化；正式 GLB 待机资源与视觉验收留待 S10；Human AI 自动解锁时间留待 S16 平衡评估。S7B-3B 尚未开始。
- Git：本日志与交接快照纳入本轮 WIP 检查点；实际提交和推送结果由最终 Git 操作报告确认。不创建 Tag。

## 2026-09-24｜S7B 静止 Human 好奇安全通行定向修复验收

- 任务名称：修复静止 Human 遮挡重见、末份米堆安全进食路线及 SAFE_WAIT 复查问题。当前阶段仍为 S7B；本轮专项人工验收 PASS，不代表 S7B 整体完成。
- 实际修复：按声音事件类别区分追捕危险与普通门操作声；独立静止事件在遮挡期间继续计时，重新目视时不把旧事件 ID 误作当帧 Human 移动；普通可见警戒不会无条件覆盖已获准的静止安全试探，真实移动、逼近、冲刺及抓捕危险仍可中断。
- 米堆路线：分别验证默认 A* 路线、抓捕圈外进食点和安全绕行路径。安全试探可选择合法进食范围内、位于抓捕半径与余量之外的实际位置；默认路线受威胁时可使用现有导航绕行。通道确实被抓捕避让区封死时拒绝通过，不穿墙、不穿锁门。
- SAFE_WAIT：保留同一米堆/入口失败计数和单次抽签；按现有间隔重查路线。存在安全观察路径时只走到观察位置并等待新的有效视野，不使用墙后 Human 实时位置授权通行；路线仍危险时继续等待。修正未激活安全通行却报告 `ACTIVE_SAFE_PASSAGE` 的状态诊断。
- 定向回归：覆盖静止超过 5 秒后重见、事件 ID 变化、无效通行状态、危险默认路线与安全绕行、不可通过的窄通道等待、路线恢复后复查、SAFE_WAIT 安全观察，以及真实公寓 kitchen 的 rice_06 碰撞移动路径。地图模拟轨迹为 `CURIOUS_APPROACH → CURIOUS_OBSERVE → CURIOUS_PASSAGE → EAT`；实际进食位置与 Human 保持在 0.9 世界单位安全边界外。不可通行窄通道连续模拟 30 秒未冲门，安全路线恢复后沿用原静止事件，不重新抽签。
- 人工验收：用户确认本轮 S7B 专项修复 PASS。人工验收状态不自动将整个 S7B 标记为完成。
- 配置与调试：保留用户手动调整的 `GAME_CONFIG` 数值；配置说明与本轮变量一致。保留 UE Details 风格 DEV 面板、AI 安全路径可视化开关和 AI JSON 日志导出。日志诊断包含通行实际激活状态及安全路径数据。
- 测试结果：`npm test` 265/265 PASS；`npm run build` PASS（含 TypeScript 检查）；`git diff --check` PASS。Vite 主 bundle 超过 500 kB 的提示仍为非阻断项。
- 新增文件：`src/three/AISafetyPathView.ts`、`tests/deepseek-safety-regression.test.mjs`。修改文件包括 S7B 控制器、日志采集、DEV 面板及 `ThreeGame`、相关既有 S7B 测试、`GAME_CONFIG` 与配置说明、AI 状态树文档和本文件。依赖变化：无。未纳入日志导出的用户资料 `.trae/`，无 dist、node_modules 或导出的 AI 日志 JSON 纳入版本控制。
- 下一步：按既定 Gate 继续 S7B；本次不创建 Tag，不开始新的阶段。
- Git commit 信息：等待本次 WIP 提交结果。

## 2026-09-24 10:55 +08:00｜S7B-2 最终人工验收补记

- 用户最终确认：S7B-2 逃跑与脱险恢复人工验收 PASS，包含跨房间逃跑、移动警戒恢复与静止对峙处理；IDLE_01～IDLE_05 多待机动作接口专项五项人工验收 PASS。此结果更新前面“等待验收”的当时状态，不改写旧记录。S7B-2 = PASS，NEXT = S7B-3 DeepSeek 主动关门与锁门决策；整个 S7B 尚未完成。
- 剩余待办：偶发原地停留作为后续 AI 优化；正式 GLB 待机片段接入及视觉验收延至 S10；Human AI 自动解锁速度留待 S16 平衡复评。
- 本次检查：`npm test` 204/204 PASS；`npm run build` PASS（含 TypeScript 检查，Vite 654.54 kB bundle 提示非阻断）；`git diff --check` PASS。`GAME_CONFIG` 与 `docs/GAME_BALANCE_CONFIG.md` 的新增待机参数一致。
- Git：本次保存为 `wip: preserve s7b2 escape ai and idle slots`；基础检查点为 `7061b33ae111bd2ea68e324895cf81f1715be63a`。提交 hash 和 push 结果待 Git 操作后报告；不创建 Tag，不开始 S7B-3。

## 2026-09-24 10:54 +08:00｜S7B-2 最终验收与 WIP 安全检查点

- 任务名称：记录 S7B-2 最终人工验收并保存逃跑 AI / 特殊待机接口 WIP。当前阶段：S7B-2 = PASS；NEXT = S7B-3 DeepSeek 主动关门与锁门决策；整个 S7B 尚未完成。
- 人工 Gate：用户确认 S7B-2 逃跑与脱险恢复验收 PASS，涵盖跨房间逃跑、移动警戒恢复及静止对峙路线处理；确认 IDLE_01～IDLE_05 多待机动作接口专项五项人工验收 PASS。偶发原地停留是后续 AI 优化项，不阻塞 S7B-2。
- 本轮核实的待机表现接口：沿用玩家与 AI 共用的 `CharacterActionView` / `AnimationMixer`；连续普通 IDLE 5 秒后从实际已接入的配置片段中抽选，完成后回到普通 IDLE，更高优先级动作打断，暂停冻结计时、重开清零。当前没有正式 GLB 待机动画资源，动画视觉验收延后至 S10；缺资源时白模保持普通 IDLE。
- 配置：`GAME_CONFIG.characterAnimation.specialIdleTriggerMs = 5,000 ms`、`specialIdleRepeatIntervalMs = 15,000 ms`、`specialIdleSlots = IDLE_01..IDLE_05` 已与 `docs/GAME_BALANCE_CONFIG.md` 对齐。未调整玩法平衡值。
- 保留待办：偶发原地停留的后续 AI 优化；S10 正式 GLB 待机动画接入与视觉验收；Human AI 自动解锁速度按既有决定留待 S16 平衡复评。
- 验证：`npm test` 204/204 PASS；`npm run build` PASS（含 TypeScript 检查），Vite 主 bundle 654.54 kB 的 >500 kB 提示为非阻断；`git diff --check` PASS。构建使用项目目录授权执行，未改 ACL 或绕过构建错误。
- 新增文件：`tests/deepseek-evade.test.mjs`（S7B-2 回归测试）。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`docs/GAME_BALANCE_CONFIG.md`、`src/config/gameConfig.ts`、`src/systems/DeepSeekAIController.ts`、`src/three/CharacterActionView.ts`、`src/three/ThreeGame.ts`、`tests/character-action.test.mjs`。删除文件：无。依赖变化：无。
- Git 检查点：基于已存在且 `main` / `origin/main` 同步的 S7B-1 检查点 `7061b33ae111bd2ea68e324895cf81f1715be63a`；本次计划创建 `wip: preserve s7b2 escape ai and idle slots`。本日志随该 WIP 提交保存；实际提交 hash 与推送结果以 Git 回报为准。不创建 Tag，不开始 S7B-3。

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

## 2026-09-23 18:41 +08:00｜S7B-1 DeepSeek AI 人工验收与 WIP 检查点

- 任务名称：记录 S7B-1 自主找米与进食验收并建立 Git WIP 安全检查点。当前阶段：S7B-1 PASS；整个 S7B 未完成，CURRENT = S7B-2 威胁感知与逃跑。
- 本次目标：保存用户确认的六项浏览器验收及本次验证通过的 S7B-1 实现。
- 人工 Gate：用户确认自主找米、连续吃完五份米、普通门开启与锁门绕行、目标及路径显示、暂停与重开、临时接管与玩家控制均 PASS。
- 实际实现：独立 DeepSeek AI 状态机按路径行走时间 + 剩余进食时间 + 既有准备时间选取预计完成总时间最短的未完成米堆；复用共享 NavigationSystem、Circle Collision、DoorSystem 和唯一 RiceField 进食更新，使用原有准备、中断保留、声音/米痕/动作和 5/5 胜利规则。普通 CLOSED Door 可开，LOCKED Door 不穿越；不可达及卡路会重试或换目标。只在 Human 正式主控时运行，暂停、DeepSeek 正式主控及开发临时接管时不抢输入；重开重置 AI。
- 配置：新增 GAME_CONFIG.deepseekAI 五项卡路/重试参数（路径容差 0.25 世界单位、卡路重算 800 ms、最小进度 0.05 世界单位、同目标最多 2 次、重试 1,500 ms），已同步 docs/GAME_BALANCE_CONFIG.md；未调整既有玩法数值。
- 新增文件：src/systems/DeepSeekAIController.ts、tests/deepseek-ai.test.mjs。修改文件：src/three/ThreeGame.ts、src/config/gameConfig.ts、docs/GAME_BALANCE_CONFIG.md、AGENTS.md；本条为末尾追加。删除文件：无。依赖变化：无。
- 测试结果：本次 npm test 172/172 PASS；npm run build PASS（含 tsc --noEmit）；git diff --check PASS。构建有已知 Vite 主包超过 500 kB 的非阻断提示。
- 已知问题：S7B-1 是本阶段通过，不代表整个 S7B 完成；本次不创建 Tag。新 WIP 提交 hash 与 push 结果以 Git 实际执行及最终汇报为准。
- 下一步建议：进入 S7B-2 威胁感知与逃跑前，由用户另行安排；本次不开始下一轮。
- Git commit 信息：wip: preserve s7b1 rice seeking ai（本次执行）。

## 2026-09-24 10:36 +08:00｜S7B-2 验收记录与特殊待机插槽

- 任务名称：记录 S7B-2 人工验收，并为玩家与 AI 共用动作表现层增加 DeepSeek 特殊待机插槽。
- 当前阶段：用户确认 S7B-2 = PASS；NEXT = S7B-3 主动锁门。整个 S7B 尚未完成。偶发原地停留为后续 AI 优化项。本轮特殊待机插槽功能等待人工验收，不表示 S7B-3 已开始。
- 实际完成内容：在既有 `CharacterActionView` / `AnimationMixer` 接口增加 `IDLE_01`～`IDLE_05` 插槽；只从配置名单中已实际接入的片段抽选。连续普通 IDLE 达到 5 秒后可播放，后续播放间隔至少 15 秒；多片段时避免连续重复同一插槽。片段结束恢复普通 IDLE，移动、进食及其他非 IDLE 玩法动作立即中断。动作计时在暂停时随游戏更新冻结，重开清零，不参与 AI 决策、移动或玩法判定。
- 资源状态：正式 GLB / 特殊待机动画目前尚未导入。无可用片段时维持普通白模 IDLE，且不在每帧重试查找缺失资源；此时等待人工验收的是白模回退、DEV 计时及优先级行为，特殊动画视觉需待资源接入后验收。
- 配置：新增 `characterAnimation.specialIdleTriggerMs = 5,000` 毫秒、`specialIdleRepeatIntervalMs = 15,000` 毫秒及 `specialIdleSlots`；已同步 `docs/GAME_BALANCE_CONFIG.md`。均为表现参数，不改变玩法数值。
- 新增文件：无。修改文件：`AGENTS.md`、`docs/AGENT_LOG.md`、`src/config/gameConfig.ts`、`src/three/CharacterActionView.ts`、`src/three/ThreeGame.ts`、`docs/GAME_BALANCE_CONFIG.md`、`tests/character-action.test.mjs`。删除文件：无。依赖变化：无。
- 测试结果：`npm test` 200/200 PASS；`npm run build` PASS（含 TypeScript 检查）；`git diff --check` PASS。构建仍有 Vite 主 bundle 大于 500 kB 的非阻断提示。
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
- 测试结果：`npm test` 280/280 PASS（原 270 + 新增 10）；`npm run build` PASS（`tsc --noEmit` + Vite 构建，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle 约 705 kB，>500 kB 提示仍为非阻断。
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
- 测试结果：`npm test` 291/291 PASS（原 280 + 新增 11）；`npm run build` PASS（`tsc --noEmit` + Vite，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle >500 kB 提示仍为非阻断。
- 已知问题：锁门决策尚需浏览器人工验收；防振荡专项（3B-2）与 DEV 面板（3B-4）未做。
- 下一步建议：浏览器人工验收「正常追逐穿门→关门→锁门、贴脸/同侧/逼近不锁、锁位满/封退路/封米堆放弃、Human 重开不振荡、SAFE_WAIT/好奇/安全通行不受影响」；通过后再进入 3B-2。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-24 22:37 +08:00｜S7B-3B-1 人工验收问题排查（锁门从未触发）

- 任务名称：排查「长期追逐始终未观察到主动锁门」。当前阶段：S7B-3B-1 人工验收问题排查；未开始 3B-2；S7B 整体未完成。
- 用户人工验收输入：7 项 PASS（过近/同侧、逼近、锁位满/锁芯失效、自身路线安全、Human 重开门、原有 AI 回归）；第 1 项「正常关门后锁门」**未观察到成功案例**，不等于实现失败。
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
- 测试结果：`npm test` 298/298 PASS（原 291 + 新增 7）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle >500 kB 提示仍为非阻断。
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
- 测试结果：`npm test` 306/306 PASS（上一轮 298 + 8）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle >500 kB 提示仍为非阻断。
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
- 测试结果：`npm test` 312/312 PASS（上一轮 306 + 6 项：冲刺冷却 5 + 锁门冲刺行为 1）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle >500 kB 提示仍为非阻断。
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
- 测试结果：`npm test` 325/325 PASS（上一轮 312 + 13）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。Vite 主 bundle >500 kB 提示仍为非阻断。
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
- 测试结果：`npm test` 332/332 PASS（上一轮 325 + 7）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。
- 长局口径：本轮为**确定性模拟长局**（约 40 个门遭遇循环 / 600 帧重规划），**不是实机长局验收**，不能替代浏览器实测。
- 已知问题：仍缺一份「修复后」的实机 AI JSON；3B-2 / 3B-3 的浏览器验收由用户完成。
- 下一步建议：确认后可进入 3B-4（DEV / 日志 / 文档收尾）。
- Git commit 信息：未提交；未 push；未创建 Tag。

## 2026-09-25 00:18 +08:00｜S7B-3B-4 DEV / AI 日志 / 文档收尾

- 任务名称：S7B-3B 收尾（DEV 面板、AI JSON 日志、文档同步）。当前阶段：**S7B-3B 代码与人工验收全部完成**；**未建立 Git 检查点**；未开始 S7C；S7B 整体未完成。
- 前提：用户确认 3B-2 浏览器人工验收 5/5 PASS、3B-3 定向回归 332/332（本轮收尾后 333/333）。
- DEV 面板审计（三个分类，只修正确实不准的显示，未重构面板）：
  - `Door Escape / 关门逃脱`：字段与源码一致；评估类字段（候选门、距离、已通过门、Human 在另一侧、关闭后路线、评估依据）只在 EVADE 的关门评估帧更新，故统一加「最近评估」前缀，避免被读成实时值；`放弃关门原因` → `最近放弃关门原因`。
  - `Door Lock / 主动锁门`：字段与源码一致；`最近锁门评估结果` 绑定 `doorLockReason`，而该字段在成功/失败回执时会被执行结果覆盖，故改名为 `最近锁门决策原因（执行成功时显示结果）`。确认没有过期或永不触发的原因码被静态展示（原因码均为实时值）。
  - `Sprint / 冲刺`：状态 / 就绪度、冷却剩余、本次剩余、风险模式、最近开始原因，均与含 30 秒冷却与 `readiness` 的 `SprintSystem` 一致。
- AI JSON 日志审计：`DOOR_ESCAPE_CLOSE / SKIP`、`DOOR_LOCK_PENDING / CANCEL / SKIP / EVALUATE / APPLY / FAILED`、`SPRINT_DECISION` 的命名、去重、时间戳、门 ID 与原因码一致；`doorDecision` 与 `doorLockDecision` 均按签名去重，不逐帧重复。发现并补两处**确实缺失**的信号（见文件改动）。
- 实机日志口径：**本轮用户未提供新的实机 JSON**；工作区与附件目录中唯一日志仍是 `who-ate-my-rice-ai-log-2026-09-24T14-31-10.json`（产生于侧向证据修复之前），因此**未用它冒充新版本数据**；锁门频率、`SPRINT_IN_PROGRESS` 是否归零等仍需新日志复核。
- 修改文件：`src/systems/AILogCollector.ts`（新增 `sprintReadiness` 快照字段 + `SPRINT_READINESS` diff 规则）、`src/systems/DeepSeekAIController.ts`（自关门抑制新增带门 ID 的 `DOOR_ESCAPE_SELF_CLOSED` 事件）、`src/three/ThreeGame.ts`（DEV 标签修正 + 传递 `sprintReadiness`）、`tests/ai-log-collector.test.mjs`（+1 项冷却生命周期日志测试）、`tests/deepseek-door-lock-oscillation.test.mjs`（补自关门事件断言）、`docs/AI_DEEPSEEK_STATE_TREE.md`、`docs/GAME_BALANCE_CONFIG.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/S7B3B_DOOR_LOCK_DESIGN.md`、`docs/AGENT_LOG.md`。新增文件：无。删除文件：无。依赖变化：无。**未改动任何 `GAME_CONFIG` 数值**（`src/config/gameConfig.ts` 的改动仍来自 Sprint 冷却那一轮的 `cooldownMs`）。
- 文档收尾要点：`docs/AI_DEEPSEEK_STATE_TREE.md` 此前**严重滞后**——仍写「好奇/安全通行待验收」，且其重复数值表中 `visionEvadeDistance` 7、`escapeGoalHoldMs` 2,500、`dangerRiceAvoidMs` 8,000、`curiositySafeDistance` 3、`stationaryPassageChance` 0.80、`stationaryPassageSafetyMargin` 0.65、抓捕圈余量「合计 1.35 u」均与源码不符。本轮删除该重复表改为指向 `docs/GAME_BALANCE_CONFIG.md`，并新增「主动关门与主动锁门」章节（关门→pending→锁门状态机、侧向证据与关门后失视处理、自关门防折返、冲刺与门、3 把锁同时上限且不限整局次数）。`AGENTS.md` 的阶段状态**未改**——该文件要求 Gate 通过且 commit + push 成功后才更新，本轮未提交。
- 测试结果：`npm test` 333/333 PASS（3B-3 的 332 + 1）；`npm run build` PASS（含 `tsc --noEmit`，真实退出码 0）；`git diff --check` PASS。
- 已知问题：仍缺一份「修复后」的实机 AI JSON；Git 检查点待用户批准。
- 下一步建议：由用户批准建立 Git 检查点（是否 commit / push 由用户决定）。
- Git commit 信息：本阶段归档为 S7B-3B 稳定检查点 `feat: complete s7b-3b proactive door locking`；实际 commit hash 与 push 结果以本次 Git 执行和最终汇报为准。不创建 Tag。
