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

## 每次任务的执行顺序

1. 开始前：阅读本文件；阅读 `docs/AGENT_LOG.md` 最近几条记录；检查 `git status` 和当前分支；明确本次目标与验收标准。
2. 开发中：只完成明确要求；不擅加玩法、依赖、框架、重构或阶段外优化；不为未来扩展过度抽象；保持实现简单、可运行、可验证。发现现有实现与任务目标冲突，先说明原因。
3. 验证：按任务适用性尽可能运行 `npm run build`、TypeScript 编译检查、相关功能测试，必要时启动开发服务器进行浏览器验证。`npm run build` 已包含 `tsc --noEmit` 时，可在报告中明确说明，不必重复执行同一检查。未测试的内容不得报告为“已完成验证”。纯文档或纯 Git 任务按适用性验证，并说明未运行游戏测试的原因。
4. 日志：任务完成后，只在 `docs/AGENT_LOG.md` 文件末尾追加记录，不覆盖或改写历史；只写实际完成的工作，不把计划或失败事项写成完成。
5. Git：除非用户明确要求不提交，任务完成且适用测试通过后，检查 `git status`，用 `git add .` 暂存本次应提交文件，创建说明清晰的 commit，并执行 `git push`。暂存前检查是否混入与本次任务无关的变更；如有，先报告并避免误提交。

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

当前下一阶段：S6A —— 正式大米循环；进入仍需用户明确任务。Web 主版本后续继续按 S6A → S6 → S7 → S8 → S9… → 发布的阶段 Gate 推进，不因 UE5.3 预留而跳过或停止 Web 开发。

单份大米正式设计时长为 60 秒。当前开发测试配置临时使用 5 秒，仅为提高频繁测试效率；Beta / Release Candidate 前必须切回 60 秒并重新测试。

当前 S5 地图状态：

- 住宅 / 公寓式 3D 灰盒地图已完成；旧九宫格布局已废弃。
- 地图包含 10 个主要空间与阳台、衣帽间两个附属空间，并保留三条追逐环路。
- 14 个 RiceCandidate 每局无重复随机激活 5 个 Active Rice；18 个 DoorNode、双方 Spawn、5 个 HideSpot Placeholder 与家具碰撞已就位。
- 保留 Camera-Relative Movement、玩家相机跟随，以及轻量分轴碰撞 / Wall Sliding；外凸墙角卡脚已修复。

S6A 仅在后续单独授权后，将当前测试性质大米扩展为“14 候选点 → 每局 5 份 → 每份独立持久进度 → 5 份全完成获胜”的正式循环；本次不实现该阶段内容。

## 当前核心玩法规则摘要

- 可选择 DeepSeek 娘或人类阵营。WASD / 方向键采用 Camera-Relative Movement，所控角色保持在屏幕中央附近；IJKL 暂作另一角色的开发调试控制。
- DeepSeek 娘冲刺不是能量条：有效移动时点击一次技能键，进入固定时长冲刺；开始后不能停下规避风险。全局大米进度低于 30% 时结束安全，达到或超过 30% 时结束必摔，并眩晕约 1 秒。
- 人类抓捕需要约 0.35 秒持续接触。R 在结算后快速重开当前阵营；M 或结算按钮返回阵营选择并清空上一局状态。
- 角色碰撞使用轻量分轴碰撞（Axis-Separated Collision Resolution）：单轴受阻时保留另一轴位移；墙体和家具使用一致的 Wall Sliding，以减少外凸墙角卡脚。

## 阶段状态维护规则

只有正式开发阶段同时满足 Gate 通过、Git commit 完成、成功推送到 GitHub、对应阶段 Tag 创建并成功推送，才允许更新本文件中的项目进度。更新时只将刚完成的阶段加入“已完成”，并将下一阶段设为“当前下一阶段”；不得改写其他长期规则、删除历史阶段信息、跳过阶段或将未通过 Gate 的阶段提前写成已完成。普通小任务和 Bug 修复不触发本文件的阶段状态更新。

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
