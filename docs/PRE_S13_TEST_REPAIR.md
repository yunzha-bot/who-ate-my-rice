# S13 前 Human AI 配置与测试专项修复（2026-10-12）

## 范围与结论

保留当前模型、UI、地图、110 件家具、15 个 HideSpot、人工排布及全部玩法数值。
本轮没有修改 AI 运行逻辑，唯一源码修改是 `gameConfig.ts` 的倍率注释；其余为测试环境、夹具和文档修正。
原 21 项失败已全部恢复，完整测试由 **818/839** 变为 **839/839**，没有删除、跳过测试或扩大时限。
尚待用户人工验收；不执行暂存、commit、push、Tag，不进入 S13。

## 0.92 → 0.52 的证据与影响

- `git log --all -G 'movementSpeedMultiplier|0\.52' -- src/config/gameConfig.ts` 只找到 2026-09-23 的 `725fdca`（S7A Human AI），其中数值为 0.92。当前已提交基线也为 0.92。
- 0.52 属当前未提交工作。日志首次明确记录不一致的位置为 `AGENT_LOG.md` 的 2026-10-05「正式 UI 工业信息风重构」。无法从 Git 确定未提交编辑的准确时间、作者或原始动机；不能把文件时间或猜测当设计批准。
- 本轮向用户说明证据后，用户明确回复「确认保留 0.52，并同步预期」；另确认 `hide_storage_shelf` 当前 60° 半角。以本次确认作为当前值的依据，而不是倒推历史动机。
- 实际运行：`ThreeGame.ts` 使用 `RuntimeDebugOverrides.humanAIMovementMultiplier`，其默认值来自 `GAME_CONFIG.humanAI.movementSpeedMultiplier`；`humanAiMovementSpeed()` 执行乘法。DEV-B 可临时覆盖运行参数，不会回写正式配置。不是两份正式速度定义。
- Human 基础速度为 230 × 1.08 = 248.4 像素/秒；AI 在 0.52 下为 **129.168 像素/秒（2.1528 世界单位/秒）**，0.92 时为 228.528 像素/秒。相对旧 AI 速度降低约 43.48%，相对 Human 基础速度降低 48%。手动 Human 不受影响。
- 速度改变会延长巡逻、追逐、到达搜查站位的耗时，但没有改变导航拓扑、抓捕范围或连续抓捕时长。普通 DeepSeek 速度为 230 像素/秒，直线持续逃跑时 Human AI 无法仅靠速度追上，仍可能借路线、门、停留等条件抓捕。
- 当前完整仿真能验证巡逻、追逐、抓捕、搜查与双方结算链路；不能据少数固定种子推导真人双方胜率。本轮未做胜率平衡评估，也未更改平衡数值。

## 原 21 项失败逐项记录

下列路径与行号为**修复前**测试定义位置；修改后行号可能移动。错误信息保留关键实际值；完整原始输出保存在系统临时目录 `rice-ai-audit-before.txt`。

| # | 原位置与测试名称 | 原报错 / 根因 | 处理与结果 |
|---|---|---|---|
| 1 | `tests/hide-interaction-region.test.mjs:70` every hide spot carries exactly the approved DEV-A interaction region | storage shelf halfAngleDeg 60 ≠ 55；旧配置断言 | 用户确认 60°，仅更新独立固定基线；PASS |
| 2 | 同文件 `:85` the region centre follows the bound furniture and never a stored coordinate | hide_main_bed，axis 与 facing+π 不相等；编辑器支持独立 facing | 按中心→锚点验证轴，额外断言改变 facing 不改变交互几何；半角仍严格检查；PASS |
| 3 | 同文件 `:194` the interaction aims at the exposed furniture surface, not the centre | NOT_STANDABLE ≠ LEGAL；测试忽略家具旋转 | 使用生产 `rectColliders` 的 AABB+OBB；PASS |
| 4 | `tests/hide-spot.test.mjs:80` facing points from every anchor towards its bound furniture centre | hide_main_bed，朝向假定过时 | 验证全部 facing 有限且逐项导出无损；真实扇形轴另由 #2 严格验证；PASS |
| 5 | 同文件 `:88` every anchor sits inside its room and leaves the real actor circle standing room | hide_main_wardrobe anchor must be standable；错误 AABB | 真实旋转碰撞 + `distanceToRect`，保留房间、站立与 0.05 间隙断言；PASS |
| 6 | 同文件 `:123` every anchor is reachable from both faction spawns through the shared navigation grid | hide_closet snaps 0.62 to a cell；错误 AABB | 真实旋转碰撞，保留 ≤0.45 及双出生点可达断言；PASS |
| 7 | `tests/human-ai.test.mjs:174` AI movement uses a separate 0.92 multiplier; manual Human keeps its original speed | 0.52 ≠ 0.92 | 用户确认后同步 0.52 和精确速度 2.1528；手动速度断言保留；PASS |
| 8 | `tests/human-hide-search-resolution.test.mjs:326` a stale plan (moved or rotated furniture) cancels instead of scoring a miss | HIT_CONCEALED ≠ PLAN_STALE；书架已为 π/2，测试再设 π/2 无变化 | 相对原角度再转 90°，保留取消且不读占用的严格检查；PASS |
| 9 | 同文件 `:366` a rotated footprint still accepts a surface point that really is on it | 旧瞄点 true ≠ false；同上 | 相对旋转 90°，旧点失效 / 新表面点合法检查保留；PASS |
| 10 | `tests/human-hide-search-stance.test.mjs:49` every authored hide spot has a legal search stance on the real map | hide_main_wardrobe 站位不得与家具足迹重叠，true ≠ false | 使用真实旋转碰撞构造导航；PASS |
| 11 | `tests/rotated-furniture.test.mjs:69` a rotated piece keeps every corner inside its own room or is rejected | a rejected rotation rolls back，180 ≠ 0 | 保存初始角度后严格验证回滚；越界必须拒绝仍保留；PASS |
| 12 | `tests/s7d-full-match.test.mjs:20` 玩家选 Human 时 DeepSeek AI 能独立吃完 5/5 米并结算 | Safe match fallback invalid: no reachable spawn pair；仿真错误 AABB | 仿真复用生产旋转碰撞；全部原种子结算断言保留；PASS |
| 13 | 同文件 `:31` SAFE_WAIT 不会在最后一堆米前无限等待（S7D 修复的整局阻断） | 同 #12 | 原种子、120 秒上界保留；PASS |
| 14 | 同文件 `:43` 玩家选 DeepSeek 娘时 Human AI 能自己完成巡逻、追逐与抓捕结算 | 同 #12 | 原三种子、150 秒仿真上限、抓捕胜利断言保留；PASS |
| 15 | 同文件 `:58` 玩家藏进家具后 Human AI 能靠公开线索把它搜出来并结算 | 初始同 #12；修正碰撞后暴露 Human AI 没有发起正式家具搜查 | 旧种子 20284684 藏身一次，19.3 秒退出藏身后被抓（搜查 0 次）；保留旧局藏身 / 结算断言，再加 20292603、20261234 两局严格验证搜查开始及搜中，分别 59.25/51.5 秒；PASS |
| 16 | 同文件 `:73` 整局里不应出现长时间「有移动指令但零位移」的卡墙 | 同 #12 | 原三策略、卡墙 <40 帧断言保留；PASS |
| 17 | 同文件 `:85` 同一随机种子与同一策略复现出同一整局结果 | 同 #12 | 原种子及帧数 / 胜者 / 米数确定性检查保留；PASS |
| 18 | 同文件 `:95` 结算用的整局遥测口径与 AI JSON 摘要一致 | 同 #12 | 原遥测一致性断言保留；PASS |
| 19 | `tests/scene-editor.test.mjs:321` overlapping furniture is rejected | OVERLAPS_FURNITURE 未出现；旧 (0,-3) 现在没有家具 | 将纸箱放到实际沙发中心，严格验证重叠拒绝及 apply 失败；PASS |
| 20 | 同文件 `:385` export carries the documented fields, only applied data, and never mutates the source map | 主卧锚点实际 (-23.026786,-7.322385) ≠ 旧 (-22.9,-7.65) | 无关餐桌事务前后锚点须完全一致，导出结构 / 非法回滚断言保留；PASS |
| 21 | `tests/second-bedroom-visual.test.mjs:38` new chair is persisted beside the existing desk, leaving rice, hide and main aisle clear | 椅子实际 (-25.207663,13.328355) ≠ 旧 (-19,17.65) | 检查磁盘 JSON 持久化、原尺寸、与桌实际距离 0–1、所有原通行点及主走道；PASS |

分类：11 项涉及碰撞环境（#3/5/6/10/12–18，#15 同时有分支夹具问题），其余 10 项为配置或布局/朝向/角度夹具过期。未发现需要修改生产玩法的 Bug。
测试没有被删除或 skip，未放宽距离、时限、抓捕或搜查关键阈值，没有伪造占用或 AI 结果。

## 自动化门禁

| 项目 | 修复前 | 修复后 |
|---|---|---|
| `npm test` | 818/839；21 失败；退出 1 | 839/839；失败/跳过/取消均 0；退出 0 |
| `npx tsc --noEmit` | 本轮修复前未重跑 | 退出 0 |
| `npm run build` | 本轮修复前未重跑 | 退出 0；既有大 chunk 提示 |
| `git diff --check` | 无新增错误 | 退出 0；既有 LF/CRLF 提示 |

完整输出：系统临时目录 `rice-ai-audit-before.txt`、`rice-ai-audit-focused-after.txt`、`rice-ai-audit-s7d-rotated.txt`、`rice-ai-audit-final.txt`。
定向碰撞修正前后复现和独立种子扫描仅是 Node 无头逻辑仿真，不是实机胜率或真人验收。

## 浏览器与数据保护

- 复用真实 `http://127.0.0.1:5173/`，两张阵营卡均可进入 READY → PLAYING，HUD、暂停、返回阵营选择正常。
- Human 对局观察到 DeepSeek AI 自主推进米饭 5→3→2→1→0，并在 01:00 以五份米完成结算；真实截图 `verification/PRE_S13_TEST_REPAIR/human-deepseek-ai-finished.jpg`。
- Human 玩家短按移动后出现附近 E 躲藏提示；不把提示出现当作成功躲藏。Human AI 在 DeepSeek 对局显示 PATROL、真实路径节点推进。
- 补充固定种子 20260927 的真实浏览器对局：DeepSeek 站立不操作，Human AI 自动完成抓捕，界面显示「人类获胜 · 抓捕完成」与01:04；截图 `verification/PRE_S13_TEST_REPAIR/deepseek-human-ai-captured.jpg`。AI随机决策不是仿真的确定性随机流，实机耗时不要求等于仿真。
- 编辑器读取显示家具 110、藏身锚点 15、布局 SAVED、草稿 UNCHANGED、未保存修改否。未应用编辑、未恢复默认、未覆盖存档。
- 布局文件 SHA256：`9D53920224997DC3B8D2CAEEA56B0B647F9ABAECA9D137D17756F8D78B9DC1D8`，修复前后一致。
- **未完成实机复验**：完整逃跑行为、门开关/解锁、藏身进出、PulseLock 成败及编辑器实际写回保存。相关自动测试全绿不替代这些人工操作。为避免写回引起角度往返/格式变化，本轮不对当前人工布局执行试写。
- 未访问私人目录，未清理未知文件，未暂存或提交。当前快照清单需要在人工验收后重新审查，本报告不是新 commit / push 授权。

## 本轮修改文件

- 源码：`src/config/gameConfig.ts`（只更正注释，不改任何值）。
- 测试：`tests/hide-interaction-region.test.mjs`、`tests/hide-spot.test.mjs`、`tests/human-ai.test.mjs`、`tests/human-hide-search-resolution.test.mjs`、`tests/human-hide-search-stance.test.mjs`、`tests/rotated-furniture.test.mjs`、`tests/s7d-full-match.test.mjs`、`tests/s7d-match-sim.mjs`、`tests/scene-editor.test.mjs`、`tests/second-bedroom-visual.test.mjs`。
- 文档：本报告、`docs/GAME_BALANCE_CONFIG.md`、`docs/AI_HUMAN_STATE_TREE.md`、`docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`、`docs/DEEPSEEK_HANDOFF.md`、`docs/PRE_S13_SNAPSHOT_REVIEW.md`；日志在 `docs/AGENT_LOG.md` 末尾追加，不改历史。
- 验证截图：`docs/verification/PRE_S13_TEST_REPAIR/`，后续快照默认仍按验证材料审查，不自动加入旧 144 路径清单。

使用 diagnosing-bugs 的复现→假设→单项验证流程与 ponytail 的最小改动原则：复用生产碰撞构造，不增加新测试框架或改写玩法系统。
