# 2026-10-18 工程整理与 Git 交付清单

## 范围与目录职责

用户批准整理工程并正常提交、推送 Git。本轮不搬动源码目录，不清理用户资料，不新增玩法；将此前已获授权的本地实现、必要回归测试和设计文档归入同一个可构建的源码检查点。

| 位置 | 职责 |
|---|---|
| src/config/ | 统一可调玩法参数与难度配置 |
| src/systems/ | 玩法状态、感知、技能、AI辅助逻辑 |
| src/three/ | Three.js表现、输入接线、界面与DEV编辑器 |
| src/three/map/ | 权威地图与已应用的静态布局数据 |
| public/ | 既有运行资源；本轮无新增图片、模型或音频 |
| tests/、scripts/ | 自动回归与独立验证脚本 |
| docs/ | 当前交接、设计、配置索引和追加式历史 |
| dist/ | 构建生成物，仍不提交；不代表本轮已部署 |

归档覆盖：加载就绪与显式降级门禁、操作说明与开发日志、已批准的速度/进食/破门试调、捕捉网与数量提示、投掷耐久与分难度AI、Human交互/扇形抓捕按键和HUD、困难夜间可见性、区域灯光与DEV灯位编辑及面板滚动修复。开放健身两片地图区域共用照明，地图/导航ID不合并。

## 本轮验证与证据边界

- 工作区全量 npm test：最终1075/1075，通过，失败/取消/跳过均为零，约76.2秒。
- 独立 npx tsc --noEmit、npm run build：退出码零；136模块，保留既有chunk大于500kB警告。
- 暂存清单干净导出副本：最终1075/1075，通过，约81.5秒；独立tsc、根路径与Pages生产构建均退出零。严格子路径审核通过，86个产物文件、43,102,437字节，正式v6及米袋两个GLB无变化。依赖复用本机现有node_modules，不声称重新执行npm ci。
- 首次Windows干净导出因core.autocrlf=true变成CRLF，暴露五处测试读取源码/工作流时写死LF。仅在tests/character-fallback-cleanup、game-audio、pages-deployment、room-light-editor、startup-readiness的对应读取处规范化换行；两种换行全量复跑均通过，不修改游戏代码或放宽原有断言。最终只同步本清单/交接/追加日志的验证结果，不改变已验证的源码或测试。
- git diff --check及精确暂存核对通过；87个候选文件的凭据模式扫描未发现命中，不等价于完整安全审计。
- 本轮不重新执行浏览器自然完整对局；过去受控Chrome/Edge检查与玩家人工反馈各按原日志保留，自动测试不替代真实外部设备验收。

附带保存八份S19-P原始JSON证据，其中七份文件的字节数和SHA-256与原收尾索引逐项一致。这些证明历史提交及历史CI产物的核对，不证明本次源码已部署。窄范围.gitattributes将其设为-text，防止Windows自动换行破坏历史哈希。

历史报告引用的其他本地截图、HAR、临时脚本和原始压缩包未整体纳入此次提交；这些链接不应被理解为新克隆中必然存在的公开证据。本轮未重新下载历史公网资源。

## 保留在本地、不提交的材料

- .trae/、.dsh-meow/、.codex/：不读取内容、不修改、不暂存。
- incoming-assets/、既有未跟踪截图/探针/原始验证输出、自动备份.bak：不删除、不搬动。
- dist/、node_modules/、临时日志与个人配置：不提交；不修改.gitignore来隐藏杂项。
- 本轮无新增运行素材；既有模型原文件、音频与36件道具布局不因整理而改动。

## 精确提交清单（87个文件）

以下是相对项目根目录的白名单，禁止以整目录批量暂存替代：

```text
.gitattributes
docs/AGENT_LOG.md
docs/CAPTURE_NET_DESIGN.md
docs/DEEPSEEK_HANDOFF.md
docs/DEV_SCENE_EDITOR_DESIGN.md
docs/DIFFICULTY_DESIGN.md
docs/GAME_BALANCE_CONFIG.md
docs/HARD_NIGHT_MODE_DESIGN.md
docs/MILESTONES.md
docs/PROJECT_DELIVERY_2026-10-18.md
docs/ROOM_LIGHTS_DESIGN.md
docs/S7C_HIDE_RANDOMIZATION_DESIGN.md
docs/verification/S19_P_RC_DEPLOYMENT_REPORT.md
docs/verification/S20_EXTERNAL_BLOCKERS_DIAGNOSIS.md
docs/verification/S20_LOADING_GATE_FIX_REPORT.md
docs/verification/S20_WEB_RELEASE_READINESS_REPORT.md
docs/verification/THROWABLES_REPORT.md
docs/verification/s19-p/S19_P_CLOSEOUT_EVIDENCE.json
docs/verification/s19-p/hash-verification/ci-pages-manifest.json
docs/verification/s19-p/hash-verification/content-decoding-check.json
docs/verification/s19-p/hash-verification/final-state-check.json
docs/verification/s19-p/hash-verification/public-files.json
docs/verification/s19-p/hash-verification/ranged-download.json
docs/verification/s19-p/hash-verification/source-chain.json
docs/verification/s19-p/hash-verification/verification-summary.json
scripts/verify-scene-editor-panel.mjs
src/config/difficultyConfig.ts
src/config/gameConfig.ts
src/game-ui.css
src/main.ts
src/s13-ui.css
src/style.css
src/systems/AILogCollector.ts
src/systems/AIThrowableController.ts
src/systems/CaptureNetSystem.ts
src/systems/HumanDoorSkill.ts
src/systems/PerceptionSystem.ts
src/systems/RoomLightSystem.ts
src/systems/ThrowableSystem.ts
src/three/AlphaHudView.ts
src/three/CaptureNetView.ts
src/three/CharacterActionView.ts
src/three/ControlsHelpView.ts
src/three/DeepSeekGlbModel.ts
src/three/GameUiLayout.ts
src/three/HardNightView.ts
src/three/HideSearchView.ts
src/three/InputManager.ts
src/three/InteractionPrompt.ts
src/three/RoomDaylightView.ts
src/three/RoomLightEditor.ts
src/three/RoomLightView.ts
src/three/SceneEditor.ts
src/three/StartupReadiness.ts
src/three/StartupView.ts
src/three/ThreeGame.ts
src/three/ThrowableView.ts
src/three/map/RoomLightLayout.ts
src/three/map/roomLightLayout.json
tests/ai-log-collector.test.mjs
tests/ai-log-evidence.test.mjs
tests/ai-log-match-summary.test.mjs
tests/ai-throwable.test.mjs
tests/alpha-hud.test.mjs
tests/capture-net.test.mjs
tests/character-fallback-cleanup.test.mjs
tests/controls-help.test.mjs
tests/deepseek-evade.test.mjs
tests/difficulty.test.mjs
tests/game-audio.test.mjs
tests/game-state.test.mjs
tests/hard-night.test.mjs
tests/hide-search-view-player-target.test.mjs
tests/human-door-skill.test.mjs
tests/human-e-priority.test.mjs
tests/pages-deployment.test.mjs
tests/player-q-priority.test.mjs
tests/production-model-policy.test.mjs
tests/rice-field.test.mjs
tests/room-light-editor.test.mjs
tests/room-lights.test.mjs
tests/s7d-full-match.test.mjs
tests/s7d-match-sim.mjs
tests/sprint.test.mjs
tests/startup-readiness.test.mjs
tests/throwables.test.mjs
vite.config.ts
```

## Git与发布状态口径

整理开始时核对的历史基线为e9f361fce9dd5f392e2165ec2cf0b5f1148ed108，分支main；索引原为空，无合并/变基/挑选残留。最终提交编号及远端是否同步以git log -1、git ls-remote origin refs/heads/main和本轮交付回复为准，不在此复制会过期的“当前SHA”。

用户仅授权此次正常commit/push；不创建或移动Tag，不创建Release，不重新部署GitHub Pages或腾讯云。已核对现有Pages工作流仅workflow_dispatch，推送不触发该工作流。腾讯云线上RC不因Git源码归档而宣称已更新；若后续存在另行配置的第三方Git自动部署，也须在其控制台单独核实。

S20继续BLOCKED，S21不启动。下一步是用户复核此检查点后，另行批准将对应生产构建更新为腾讯云RC并进行外部设备复验；不是v1.0.0正式发布。
