# S13 前开发快照提交前审查

日期：2026-10-12。功能验收通过，不是发布版或新的阶段Gate。最初151项候选清单及授权审查记录保留为审查过程；最新公开模型范围和验证结果以文末“正式v6公开版模型确认”为准；此前方案B记录保留为历史审查结果。

> 最终验收更新（同日）：用户认可专项修复与839/839测试，并明确确认门、PulseLock成功/失败、躲藏进入/退出、DEV保存后刷新恢复全部通过。以下21项失败名称仅保留为修复前证据。仓库按用户要求保持Public；素材再分发授权仍未核验完备。清单已由144扩展至150路径，必须获得新的提交授权后才精确暂存与提交；不创建Tag。

## 分支与远端

- 分支 main；origin 为 https://github.com/yunzha-bot/who-ate-my-rice.git。
- 本轮检查时 HEAD、origin/main 与 git ls-remote origin refs/heads/main 均为历史基线 532c2bb59bd7045cea7d95bf6f8a740f5dcdcbd6。未发现合并、变基或 cherry-pick 进行中，暂存区为空。
- 未 fetch、合并、重置或覆盖任何工作；真正提交前必须再次检查远端，远端变化则停止。

## 场景持久化

- 真实现有浏览器打开 DEV 场景编辑器：布局 SAVED、已保存、项目文件已加载、未保存修改：否、草稿 UNCHANGED、已应用编辑 0。
- 最终只读复核磁盘 src/three/map/sceneLayout.json 为 110 件家具、15 个 HideSpot。
- SHA256：9d53920224997dc3b8d2caeea56b0b647f9abaeca9d137d17756f8d78b9dc1d8，与 GET /__dev/scene-layout 返回 revision 一致。
- 用户已完成真实保存后刷新恢复验收。本次代理只读取磁盘及保存接口，不触发写回、恢复默认或旧布局导入；哈希与修复前一致。该 JSON 必须纳入快照。

## 检查结果

| 检查 | 结果 |
|---|---|
| npm test | 专项修复后839/839通过，失败/跳过/取消均0，退出码0；用户已认可 |
| 修复前 npm test | 818/839通过、21项失败，退出码1；历史结果，不是当前基线 |
| npx tsc --noEmit | 通过，退出码 0 |
| npm run build | 通过，退出码 0；JS 1,263.27 kB，既有大 chunk 警告 |
| git diff --check | 通过，退出码 0；既有 LF/CRLF 提示 |
| 源码静态资源引用 | 27 个唯一图片/GLB路径均存在，无缺失 |
| GLB | 所检角色 GLB 无外部 URI，动画版各 7 个动作，静态版无动画 |
| 用户人工验收 | 门、PulseLock成功/失败、躲藏进入/退出、DEV保存后刷新恢复全部通过；由用户实机确认 |
| 本轮检查范围 | 纯文档与归档审查，无游戏代码/布局改动；引用已认可的专项修复门禁，不重复运行测试与构建；重新执行diff检查 |

原21项失败的逐项根因与处理见 `PRE_S13_TEST_REPAIR.md`；不删除、跳过测试或修改玩法数值来迁就归档。

### 修复前失败清单（历史证据，现已修复）

- every hide spot carries exactly the approved DEV-A interaction region
- the region centre follows the bound furniture and never a stored coordinate
- the interaction aims at the exposed furniture surface, not the centre
- facing points from every anchor towards its bound furniture centre
- every anchor sits inside its room and leaves the real actor circle standing room
- every anchor is reachable from both faction spawns through the shared navigation grid
- AI movement uses a separate 0.92 multiplier; manual Human keeps its original speed
- a stale plan (moved or rotated furniture) cancels instead of scoring a miss
- a rotated footprint still accepts a surface point that really is on it
- every authored hide spot has a legal search stance on the real map
- a rotated piece keeps every corner inside its own room or is rejected
- 玩家选 Human 时 DeepSeek AI 能独立吃完 5/5 米并结算
- SAFE_WAIT 不会在最后一堆米前无限等待（S7D 修复的整局阻断）
- 玩家选 DeepSeek 娘时 Human AI 能自己完成巡逻、追逐与抓捕结算
- 玩家藏进家具后 Human AI 能靠公开线索把它搜出来并结算
- 整局里不应出现长时间「有移动指令但零位移」的卡墙
- 同一随机种子与同一策略复现出同一整局结果
- 结算用的整局遥测口径与 AI JSON 摘要一致
- overlapping furniture is rejected
- export carries the documented fields, only applied data, and never mutates the source map
- new chair is persisted beside the existing desk, leaving rice, hide and main aisle clear

## 资产与敏感内容检查

- 150个候选路径的现存文件合计约76.5 MiB，含两项删除；最终字节数随文档更新略有变化。
- 角色保留当前 v6_hair、上一版回退 v5_hair_ready、静态回退 standalone，以及自动化测试仍直接读取的 v2。最大单文件约 11.92 MiB；没有候选文件达到 50/100 MB。
- 米袋 GLB 632,704 字节；三张正式透明立绘、Human 立绘、六张 UI Sheet、派生 PNG/SVG 与两份处理脚本均保留。
- v1/v3/v4 为未被当前运行源码或测试引用的历史动画中间版，拟排除、不删除。
- 对最终150路径中的文本文件重新做常见GitHub/OpenAI/AWS密钥、私钥头及带凭据URL模式扫描，未命中；不等于完备安全审计。未访问私人配置目录。
- 3个候选文本文件含本机绝对路径，公开后会暴露开发目录/用户名等信息；未自动删改历史记录。素材说明仅证明部分资源为用户提供或AI生成，不是全部角色GLB、动画、立绘、UI Sheet和米袋的公开再分发授权凭据。Public意味着他人可下载资源；请在提交授权中确认这些资产可公开再分发，或指出应排除的资产（排除运行依赖需另行处理，不擅自破坏运行）。
- 用户已接受并要求保持Public。本次GitHub API复核返回403 rate limit exceeded，未据此宣称重新核验成功；Git远端读取正常。
- Human AI movementSpeedMultiplier=0.52及货架60°已获用户明确确认，过时注释、文档与测试预期已同步；未改玩法数值。
- 快照包含此前已经存在的 PulseLock 替换、DeepSeek 门锁惩罚与地图改造，不只是视觉代码。旧 MinesweeperLockSystem 和旧测试的删除属于现有工作区，正式引用已移除。
- 原始 OBJ/PBR 输入保留本机 incoming-assets；处理脚本重新生成米袋需要该本机输入，正常运行与 npm test 不依赖此目录。

## 拟提交文件清单

以下为逐文件允许清单。未经用户确认不暂存；确认后逐文件 git add -- <path>，禁止 git add . / git add -A。提交前再次核对 cached 清单和资产哈希。

- 保留/新增/修改：`AGENTS.md`
- 保留/新增/修改：`docs/AGENT_LOG.md`
- 保留/新增/修改：`docs/AI_HUMAN_STATE_TREE.md`
- 保留/新增/修改：`docs/ALPHA_POLISH.md`
- 保留/新增/修改：`docs/DEEPSEEK_HANDOFF.md`
- 保留/新增/修改：`docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`
- 保留/新增/修改：`docs/DEV_SCENE_EDITOR_DESIGN.md`
- 保留/新增/修改：`docs/GAME_BALANCE_CONFIG.md`
- 保留/新增/修改：`docs/MAP_SPEC.md`
- 保留/新增/修改：`.gitignore`（仅放行正式v6，逐路径排除六个旧版GLB）
- 新增：`public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`
- 新增：`README.md`
- 保留/新增/修改：`public/assets/props/rice-bag/rice-bag.glb`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-lose.png`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-model-reference.png`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-normal.png`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-portrait-sheet.png`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-rice-v1.webp`
- 保留/新增/修改：`public/assets/ui/portraits/deepseek-win.png`
- 保留/新增/修改：`public/assets/ui/portraits/human-guardian-v1.webp`
- 保留/新增/修改：`public/assets/ui/portraits/README.md`
- 保留/新增/修改：`public/ui/components/blue-strip.png`
- 保留/新增/修改：`public/ui/components/button-endcap.png`
- 保留/新增/修改：`public/ui/components/button-shell-stretch.png`
- 保留/新增/修改：`public/ui/components/button-shell.png`
- 保留/新增/修改：`public/ui/components/dark-label.png`
- 保留/新增/修改：`public/ui/components/header-strip.png`
- 保留/新增/修改：`public/ui/faction-name-gradient-clean.png`
- 保留/新增/修改：`public/ui/faction-name-gradient-clean.svg`
- 保留/新增/修改：`public/ui/faction-name-gradient.png`
- 保留/新增/修改：`public/ui/hud/faction-warm.png`
- 保留/新增/修改：`public/ui/hud/interaction-shell.png`
- 保留/新增/修改：`public/ui/hud/rice-bowl.png`
- 保留/新增/修改：`public/ui/hud/rice-shell.png`
- 保留/新增/修改：`public/ui/hud/skill-blue.png`
- 保留/新增/修改：`public/ui/hud/skill-warm.png`
- 保留/新增/修改：`public/ui/hud/timer-shell.png`
- 保留/新增/修改：`public/ui/panels/compact-dots-upper.png`
- 保留/新增/修改：`public/ui/panels/compact-shell-stretch.png`
- 保留/新增/修改：`public/ui/panels/compact-shell.png`
- 保留/新增/修改：`public/ui/panels/main-dots-left.png`
- 保留/新增/修改：`public/ui/panels/main-dots-right.png`
- 保留/新增/修改：`public/ui/panels/main-shell-stretch.png`
- 保留/新增/修改：`public/ui/panels/main-shell.png`
- 保留/新增/修改：`public/ui/pulselock/track-shell.png`
- 保留/新增/修改：`public/ui/README.md`
- 保留/新增/修改：`public/ui/screens/result-accent.png`
- 保留/新增/修改：`public/ui/sheet-a-pulselock.png`
- 保留/新增/修改：`public/ui/sheet-b-panels.png`
- 保留/新增/修改：`public/ui/sheet-c-hud.png`
- 保留/新增/修改：`public/ui/sheet-d-menu-result.png`
- 保留/新增/修改：`public/ui/sheet-e-textures.png`
- 保留/新增/修改：`public/ui/sheet-f-modern-textures.png`
- 保留/新增/修改：`public/ui/textures/paper.png`
- 保留/新增/修改：`scripts/extract-ui-sheets.py`
- 保留/新增/修改：`scripts/prepare-rice-bag.mjs`
- 保留/新增/修改：`src/config/gameConfig.ts`
- 保留/新增/修改：`src/industrial-ui.css`
- 保留/新增/修改：`src/main.ts`
- 保留/新增/修改：`src/rain-ui.css`
- 保留/新增/修改：`src/sheet-ui.css`
- 保留/新增/修改：`src/style.css`
- 保留/新增/修改：`src/systems/DeepSeekAIController.ts`
- 保留/新增/修改：`src/systems/DeepSeekDoorLockPenalty.ts`
- 保留/新增/修改：`src/systems/HideInteractionArbitration.ts`
- 删除：`src/systems/MinesweeperLockSystem.ts`
- 保留/新增/修改：`src/systems/PulseLockSystem.ts`
- 保留/新增/修改：`src/three/AlphaHudView.ts`
- 保留/新增/修改：`src/three/AlphaPresentation.ts`
- 保留/新增/修改：`src/three/BalconyFurnitureVisual.ts`
- 保留/新增/修改：`src/three/BathroomFurnitureVisual.ts`
- 保留/新增/修改：`src/three/CameraRelativeMovement.ts`
- 保留/新增/修改：`src/three/CharacterActionView.ts`
- 保留/新增/修改：`src/three/DeepSeekAnimation.ts`
- 保留/新增/修改：`src/three/DeepSeekGlbModel.ts`
- 保留/新增/修改：`src/three/DeepSeekHairMotion.ts`
- 保留/新增/修改：`src/three/DeepSeekMaidModel.ts`
- 保留/新增/修改：`src/three/DoorView.ts`
- 保留/新增/修改：`src/three/EntryFurnitureVisual.ts`
- 保留/新增/修改：`src/three/GameUiLayout.ts`
- 保留/新增/修改：`src/three/HomeGymVisual.ts`
- 保留/新增/修改：`src/three/InteractionPrompt.ts`
- 保留/新增/修改：`src/three/InteriorShadowView.ts`
- 保留/新增/修改：`src/three/KitchenFurnitureVisual.ts`
- 保留/新增/修改：`src/three/LaundryFurnitureVisual.ts`
- 保留/新增/修改：`src/three/MainBedroomVisual.ts`
- 保留/新增/修改：`src/three/map/apartmentMap.ts`
- 保留/新增/修改：`src/three/map/ClosedExteriorDoors.ts`
- 保留/新增/修改：`src/three/map/GarageGround.ts`
- 保留/新增/修改：`src/three/map/MapBuilder.ts`
- 保留/新增/修改：`src/three/map/MapLayoutStore.ts`
- 保留/新增/修改：`src/three/map/sceneLayout.json`
- 保留/新增/修改：`src/three/PulseLockView.ts`
- 保留/新增/修改：`src/three/ResidentialExterior.ts`
- 保留/新增/修改：`src/three/RiceBagModel.ts`
- 保留/新增/修改：`src/three/RiceView.ts`
- 保留/新增/修改：`src/three/SceneEditor.ts`
- 保留/新增/修改：`src/three/SceneEditorPanel.ts`
- 保留/新增/修改：`src/three/SecondBedroomVisual.ts`
- 保留/新增/修改：`src/three/StorageFurnitureVisual.ts`
- 保留/新增/修改：`src/three/ThreeGame.ts`
- 保留/新增/修改：`tests/alpha-hud.test.mjs`
- 保留/新增/修改：`tests/alpha-presentation.test.mjs`
- 保留/新增/修改：`tests/apartment-map.test.mjs`
- 保留/新增/修改：`tests/balance-config.test.mjs`
- 保留/新增/修改：`tests/balcony-visual.test.mjs`
- 保留/新增/修改：`tests/bathroom-visual.test.mjs`
- 保留/新增/修改：`tests/cutaway-wall-shadow.test.mjs`
- 保留/新增/修改：`tests/deepseek-animation.test.mjs`
- 保留/新增/修改：`tests/deepseek-door-lock-integration.test.mjs`
- 保留/新增/修改：`tests/deepseek-door-lock-penalty.test.mjs`
- 保留/新增/修改：`tests/deepseek-hair.test.mjs`
- 保留/新增/修改：`tests/deepseek-hide-loop-guard.test.mjs`
- 保留/新增/修改：`tests/deepseek-maid-model.test.mjs`
- 保留/新增/修改：`tests/deepseek-visual-target.test.mjs`
- 保留/新增/修改：`tests/entry-visual.test.mjs`
- 保留/新增/修改：`tests/faction-card-ui.test.mjs`
- 保留/新增/修改：`tests/garage-concrete.test.mjs`
- 保留/新增/修改：`tests/hide-interaction-arbitration.test.mjs`
- 保留/新增/修改：`tests/hide-interaction-region.test.mjs`
- 保留/新增/修改：`tests/hide-spot.test.mjs`
- 保留/新增/修改：`tests/hide-target-resolution.test.mjs`
- 保留/新增/修改：`tests/home-gym.test.mjs`
- 保留/新增/修改：`tests/human-door-skill.test.mjs`
- 保留/新增/修改：`tests/human-ai.test.mjs`
- 保留/新增/修改：`tests/human-furniture-search.test.mjs`
- 保留/新增/修改：`tests/human-hide-search-stance.test.mjs`
- 保留/新增/修改：`tests/human-hide-search-resolution.test.mjs`
- 保留/新增/修改：`tests/interaction-prompt.test.mjs`
- 保留/新增/修改：`tests/kitchen-visual.test.mjs`
- 保留/新增/修改：`tests/living-room.test.mjs`
- 保留/新增/修改：`tests/main-bedroom-visual.test.mjs`
- 删除：`tests/minesweeper-lock.test.mjs`
- 保留/新增/修改：`tests/north-balcony-visual.test.mjs`
- 保留/新增/修改：`tests/pulse-lock.test.mjs`
- 保留/新增/修改：`tests/residential-exterior-geometry.test.mjs`
- 保留/新增/修改：`tests/rice-bag-model.test.mjs`
- 保留/新增/修改：`tests/rice-view.test.mjs`
- 保留/新增/修改：`tests/rotated-furniture.test.mjs`
- 保留/新增/修改：`tests/scene-editor-layout.test.mjs`
- 保留/新增/修改：`tests/s7d-full-match.test.mjs`
- 保留/新增/修改：`tests/s7d-match-sim.mjs`
- 保留/新增/修改：`tests/scene-editor.test.mjs`
- 保留/新增/修改：`tests/scene-v4.test.mjs`
- 保留/新增/修改：`tests/second-bedroom-visual.test.mjs`
- 保留/新增/修改：`tests/storage-furniture-visual.test.mjs`
- 保留/新增/修改：`vite.config.ts`
- 新增：`docs/PRE_S13_SNAPSHOT_REVIEW.md`（本报告）
- 新增：`docs/PRE_S13_TEST_REPAIR.md`
- 新增：`docs/ASSET_PROVENANCE.md`（本轮用户要求新增，待最终提交确认）

原151项清单按方案B剔除4个角色GLB，再纳入README与精确`.gitignore`更新，此前清单为149个路径操作（147个现存文件、2项既有删除）；本轮仅新增正式v6这一资产路径，现为150个路径操作（148个现存文件、2项既有删除）。动画回归测试仍在原清单中，本轮更新其正式模型预期。新增验证截图与探针仍排除；最终暂存清单须与此列表逐项相符。

## 排除清单

旧版GLB不暂存、不上传；文件保留在本机，并以精确路径加入忽略规则，不忽略整个角色目录。正式v6已移入上方拟提交清单。

- `.codex/`、`.dsh-meow/`、`.trae/`：私人目录，未读取。
- `docs/verification/` 下所有当前未跟踪文件：截图、临时页面/浏览器脚本、探针、日志、AI JSON 及随附本机验证报告，一律保留本机。原已跟踪验证材料不删除。日志中的这些本地证据链接可能无法在 GitHub 打开。
- `src/three/map/sceneLayout.json.*.bak`：17 份本机布局备份，不提交。
- `incoming-assets/`：用户原始米袋 OBJ/MTL/4K PBR 输入，保留本机，不是运行依赖。
- `public/assets/characters/deepseek/deepseek_animated_v1.glb`
- `public/assets/characters/deepseek/deepseek_animated_v3.glb`
- `public/assets/characters/deepseek/deepseek_animated_v4.glb`
- `public/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb`
- `public/assets/characters/deepseek/deepseek_animated_v2.glb`
- `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb`
- `dist/`、`node_modules/`、缓存、临时测试输出及个人配置。工作区外 Blender 工程未读取、未纳入。
- 其他不在上方候选清单中的未知文件不自动纳入。

## 提交方案与授权

提交说明：`feat: publish pre-S13 gameplay snapshot without private character models`。
用户已明确批准方案B及条件发布：仅在无模型隔离验证和最终暂存审查通过后，提交并普通push至`origin/main`。四个GLB授权仍待确认，但已明确排除；其它资源按用户确认的来源声明管理。提交前再次复核远端与暂存清单，不force push、不Tag。S13音频开发尚未开始。

## 前轮公开发布审查记录（来源更正前的历史记录）

逐项核对150条路径：无重复；148个现存文件及2项已记录删除一致；没有清单外的已修改跟踪文件。暂存区为空，main与远端main仍一致。Human AI保持0.52，布局SHA256不变。本轮仅审查与文档更新，不重跑已获认可的839/839测试基线。

### 方案B前的来源与公开再分发核对（历史记录）

本节记录方案B确认前的审查状态，不代表当前发布阻断。用户随后确认除混元3D角色模型外的项目资产为自制或AI生成/编辑加工，未直接使用未经授权的第三方下载资源；四个混元3D GLB依下文最新方案排除。

以下不是认定侵权或认定第三方所有，而是无法仅凭当前仓库记录确认其来源与公开许可：

| 文件（相对项目根目录） | 已有证据与缺口 |
|---|---|
| `public/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb` | 原角色模型及PBR贴图的来源/许可未见明确记录；GLB只标注Blender导出器，没有copyright或许可字段 |
| `public/assets/characters/deepseek/deepseek_animated_v2.glb` | 在原模型上绑定/制作动作；模型与内嵌贴图的来源许可仍需确认 |
| `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb` | 同上，头发处理不消除原资产授权依赖 |
| `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb` | 当前运行版本，同上；四个GLB均内嵌texture_pbr_20250901系列基色/法线/金属粗糙贴图，无外部URI不等于已获再分发许可 |
| `public/assets/props/rice-bag/rice-bag.glb` | 用户提供AI建模OBJ/PBR后优化导出；缺少生成服务、使用账户/套餐及模型和输入贴图的授权说明，压缩与减面不产生原资产许可 |
| `public/assets/ui/portraits/deepseek-model-reference.png` | 用户提供造型参考；未见原图来源与公开分发依据 |
| `public/assets/ui/portraits/deepseek-portrait-sheet.png` | 用户提供合集；未见原图来源与公开分发依据 |
| `public/assets/ui/portraits/deepseek-normal.png`、`deepseek-win.png`、`deepseek-lose.png`（同目录） | 有裁切/授权补画记录；仍依赖原合集的来源与许可，不将实施授权误认为原图再分发许可 |
| `public/ui/sheet-a-pulselock.png`、`sheet-b-panels.png`、`sheet-c-hud.png`、`sheet-d-menu-result.png`、`sheet-e-textures.png`、`sheet-f-modern-textures.png` | 记录为用户确认的正式素材，但未记载自制声明或第三方来源/许可 |
| `public/ui/faction-name-gradient.png` | 用户提供原始名称底板；未见来源/许可 |
| `public/ui/faction-name-gradient-clean.png`、`public/ui/faction-name-gradient-clean.svg` | 有清理/重绘记录；仍参照原底板，需要确认原设计可使用并公开分发 |

以上19个文件存在来源或继承来源待确认；另有清单中的23个组件文件位于`public/ui/components/`、`hud/`、`panels/`、`pulselock/`、`screens/`、`textures/`，均由上述Sheet裁切/处理，授权结论随源Sheet，不重复认定为独立自制资产。

`public/assets/ui/portraits/deepseek-rice-v1.webp`与`human-guardian-v1.webp`已有README明确记载为项目内imagegen原创输出，未发现外部下载来源；程序化家具、角色与接地纹理等有项目源码生成依据。本轮不把有来源缺口的文件归入此类，不对未确认的生成平台或第三方条款作推定。

### 敏感信息与本机路径

- 150路径文本的常见GitHub/OpenAI/AWS密钥、私钥头与带凭据URL模式扫描未命中；不保证排除一切秘密。私人目录未读取、未暂存。
- `docs/AGENT_LOG.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/MAP_SPEC.md`含既有本机绝对路径，例如学校资料/Blender工作目录与桌面项目目录，属于公开隐私信息而非运行依赖。等待用户确认保留还是另行授权仅脱敏这些路径；不改写历史日志或擅自删除。
- 没有清单文件达到50MB；最大约11.92MiB。临时截图、原始工作输入、备份与未知文件仍排除。
- 本轮无游戏代码、配置、素材或地图修改。`git diff --check`通过；没有可报告的新Commit Hash或已提交文件数，远端没有因本轮发生变化。

## 用户补充来源后的复核

- 用户后续更正前述来源信息：DeepSeek角色来自腾讯混元3D免费版在线服务，不是Tripo；流程为在线生成、Blender优化与骨骼动画、GLB导出、Three.js接入。其余相关素材为用户自制或AI生成/编辑，未直接使用未经授权的第三方下载资源。更正不表示服务许可已核验。
- 腾讯混元3D官方网页将《腾讯混元3D服务协议》链接至腾讯规则中心；本次官方正文接口返回“没有数据”，未能核对协议条款或生成时适用版本。核查只以此网页协议为依据，没有用其他腾讯产品/API协议或开源模型GitHub许可证替代。该模型及内嵌PBR贴图免费输出后的商业使用、Public仓库公开下载和再分发条件均待确认。
- AGENT_LOG、DEEPSEEK_HANDOFF、MAP_SPEC中4处本机路径已按用户本轮明确授权脱敏：仓库内改用`.`、`dist/`，项目外参考图/工作副本只保留资料相对名称并注明不在仓库，不伪造仓库文件位置；日志仅这两处路径替换，不改历史事件或测试结果。
- 150项旧清单另加本轮要求的来源文档，共151路径。保留839/839及独立TypeScript/build通过基线；本轮纯文档，不重跑游戏测试或构建，执行diff及敏感/体积复查。暂不暂存、commit、push或Tag。

## 方案B确认前的151项范围（历史记录）

清单共151条：149个现存文件及2项已删除路径。基于用户对自制/AI生成来源的明确确认，当前可纳入公开审查的范围为**149个现存文件中的145项**：项目源码、测试、文档、配置、项目程序化生成内容，以及用户确认自行制作/生成/编辑加工的米袋、立绘、参考图和UI素材。此为按用户来源声明划分的候选公开范围，不代表对未知AI平台条款逐个平台出具独立法律意见。

以下4个角色GLB及其内嵌纹理当前不列入可确认公开范围，须待腾讯混元3D官方网页免费服务协议的授权条件核实：

- `public/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb`
- `public/assets/characters/deepseek/deepseek_animated_v2.glb`
- `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb`
- `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`

以上资产互有模型/动画依赖，且内嵌PBR纹理；未确认前若公开上传会一并暴露相关模型与纹理。若必须保持网页可运行，需要先取得官方网页协议授权依据或由用户决定如何处理这一依赖，代理不自动删除/替换。23项由用户Sheet派生的UI裁片留在145项候选范围内，来源沿用用户对原Sheet的确认；不是独立来源。

## 方案B公开快照验证结果与暂停点

- `npm ci`：临时副本安装通过；npm audit报告1项传递依赖`source-map-js`高危告警（版本范围1.0.0–1.2.1，有修复建议）。本轮未更新依赖，需单独安排依赖审计/升级。
- `npm test -- --test-reporter=dot`：原工作区839/839通过；不含4个模型的独立临时公开副本839/839通过，0失败、0跳过。
- `npx tsc --noEmit`：原工作区与临时公开副本均通过。
- `npm run build`：原工作区与临时公开副本均通过；有既有约1.26 MB JS chunk提示。临时副本构建目录中未生成四个角色GLB。
- 公开副本HTTP检查：入口返回200；缺失模型URL被Vite SPA fallback映射为index.html（不是GLB）。Node测试走公开副本分支并验证程序化DeepSeek外观与失败后不重复重试。
- 浏览器门禁未完成：Computer Use宿主因无法有足够把握确认Windows浏览器当前URL而主动终止交互。本轮没有实际点击两个阵营并在浏览器内确认模型回退与游玩，不能把静态测试/HTTP结果表述为该人工验收通过。
- 原工作区`git diff --check`退出0。因为浏览器验收属于用户明确设置的提交前条件，当前未暂存、未commit、未push、未创建Tag；待完成缺失的双阵营真实浏览器验收后再继续。
- 最终清单文本扫描107个文件，常见凭据/私钥模式与Windows盘符绝对路径模式均未命中（有限模式扫描，不是完整安全审计）。147个现存公开文件合计30,835,152字节，最大单文件2,914,858字节，无单文件超过50MB；四个本机角色模型不计入。
- `git ls-files`确认四个GLB均未被索引追踪；搜索`git rev-list --objects --all`（包括本地已知分支与现存标签）未发现相应对象名，当前远端main及已列出的历史标签未发现这些资产。无需且未改写Git历史。
- 复核时工作分支仍为`main`、与`origin/main`一致，暂存区为空；公开仓库没有因本轮产生新commit或push。最终149项清单由原151项删去四个GLB并加入README与`.gitignore`构成。

## 2026-10-12 正式v6公开版模型确认

用户最终确认正式 `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb` 为本人自制原创资产，授权将该模型、动画及内嵌贴图公开上传本人GitHub仓库。本条替代此前针对正式v6的来源归类和排除决定，不扩大授权范围到旧模型。

- 只纳入正式v6；静态版及v1–v5共六个旧GLB继续排除。正式文件原样保留，SHA-256：`b74025c238bb884bdd0d05e2ef9ab6061916dad1512549207fef6f8ee3cfb026`，12,496,972字节。
- 18,500三角面、20,992顶点、26骨骼；7段动画：Idle、Walk、Run、Eat、HideEnter、HideIdle、HideExit。材质为DeepSeek_Midpoly_PBR，基色/法线/金属粗糙三张贴图内嵌，无外部URI。
- 正常运行首选v6；玩家及NPC继续共用CharacterActionView、DeepSeekAnimation和DeepSeekHairMotion。加载失败时保留现有回退逻辑。
- 本轮更新忽略规则、README、来源文档、动画资产回归测试及本报告；交接文档仅增加当前正式路径与运行状态。AGENT_LOG保持不变。
- 全新隔离副本仅复制已追踪项目文件及本报告的明确允许清单；角色目录及生产构建产物都仅含正式v6，没有六个旧GLB或本机私人目录。`npm ci`通过；未改变依赖或锁文件。
- 原工作区与隔离副本分别执行全量`npm test`：均839/839、0失败、0跳过；两处独立TypeScript与build均通过。定向动画/头发测试8/8通过。`git diff --check`通过；两份未跟踪审查文档另检查行尾空白，无问题。
- 真实Chrome明确导航到隔离构建预览`http://127.0.0.1:4173/`及本机`http://127.0.0.1:5173/`，页面标题均为《谁吃了我的米》。两个环境分别进入DeepSeek与Human阵营，四次响应的v6均为200、GLB类型、12,496,972字节且SHA-256一致；正常加载没有请求旧GLB，也没有回退告警。
- 浏览器场景实测：玩家和NPC均使用18,500面/26骨骼/7动作的SkinnedMesh，PBR贴图均解码为2048×2048，头发版本标记2。四个场景的骨骼姿态与头发骨骼姿态采样均发生变化。隔离版DeepSeek键盘移动与Human局DeepSeek NPC自主移动均有实际位移。
- 隔离版截图：`isolated-public-deepseek-game.png`、`isolated-public-human-game.png`；另保存两个角色实际场景近景。Human NPC近景使用克隆相机取景，仅额外渲染当前真实场景，不移动角色、不修改正式相机或任何地图数据。本机截图及浏览器响应/姿态记录也保留在系统临时验证目录，不纳入快照。
- 在隔离浏览器中将v6请求临时响应为404：加载器尝试旧版回退时收到HTML并安全捕获解析失败，随后显示程序化角色；没有未处理异常或重复请求，游戏可进入。该模拟仅影响该浏览器请求，未改动模型文件。
- 正常浏览器无未处理脚本异常及网络传输失败；仍有既有Three.js Clock/PCFSoftShadowMap兼容提示，以及`favicon.ico`404。安装有1项高危audit告警、构建有既有大chunk提示，本轮未处理这些范围外问题。
- 正式GLB已按精确路径加入Git索引，暂存区仅此1项；六个旧GLB仍逐路径忽略。本轮没有commit/push/Tag；远端main仍为此前基线，S13前快照尚未发布。其余拟提交清单保持待最终授权状态。
- AGENT_LOG、sceneLayout.json及GAME_CONFIG文件哈希与本轮开始时一致；未记录或补写建模过程/历史。本轮等待用户确认后再commit/push，不创建Tag。
