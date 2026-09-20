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
