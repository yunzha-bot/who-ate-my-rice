# S7C-2 第二轮修复轮：真实浏览器复核记录（2026-09-26）

本目录是**本轮真实浏览器复核的原始存证**，不是新的阶段记录。阶段的当前状态与授权一律以
`docs/DEEPSEEK_HANDOFF.md` 为准，历史以 `docs/AGENT_LOG.md` 为准。

> 复核口径：本机 Chrome `--headless=new` + CDP 直连，复用已在运行的 `http://127.0.0.1:5173/`
> （`vite.config.ts` 固定 127.0.0.1:5173、`strictPort`）。脚本通过 `Runtime.evaluate` 读状态、
> `Input.dispatchKeyEvent` 发真实按键、`Page.captureScreenshot` 截图；走图使用**真实游戏坐标读数闭环**
> （DEV-B 的 `movement/Human 位置` / `movement/DeepSeek 位置`），并真的按 E 开门。
> 只报告读到的 DOM 文本、坐标与事件，**没有编造任何 FPS 或耗时**。

## 1. 复现命令

```powershell
# 先确认开发服务器已在 http://127.0.0.1:5173/ 运行
node docs\verification\S7C-2-r2\browser-check.mjs bedAi   docs\verification\S7C-2-r2
node docs\verification\S7C-2-r2\browser-check.mjs playerQ docs\verification\S7C-2-r2
```

脚本会自动启动本机 Chrome（独立 `--user-data-dir`）、选择阵营、展开 DEV / DEV-B 面板、用 DEV-B **内存**
覆盖把 `movement.humanAiMultiplier` 调到 0.45、`capture.radius` 调到 0.05（**只为让脚本可控，不改正式
`GAME_CONFIG`**），然后导出 AI JSON 并落盘。脚本结束时关闭自己启动的 Chrome；**不触碰**用户自己的
Chrome 进程与已在运行的开发服务器。

## 2. 场景 A：次卧床（用户此前三次失败的真实场景）——通过

`bedAi-console.txt` / `bedAi-ai-json.json` / `bed-ai-hidden.png` / `bed-ai-hit.png` / `bed-ai-finished.png`

| 步骤 | 实测读数 |
|---|---|
| DeepSeek 玩家真实走图：玄关 →（`door_study_entry` 按 E，`other/door-message` = 门已打开）→ 书房 →（`door_bedroom2_study` 按 E）→ 次卧 | `movement/DeepSeek 位置` 到达 `(-14.7, 9.5)`；`hide/hide-candidate = LEGAL / hide_second_bed` |
| 点按 E 藏身 | `hide/hide-state = 藏身中（hide_second_bed）`；`hideEvents = [{ HIDE_ENTER, hide_second_bed }]` |
| Human AI 失去视线后的公开门槛 | `human-ai/hide-last-seen-room-gate = OK：最后目击房间 second_bedroom 里有公开藏身点：hide_second_bed` |
| 搜查阶段 | `human-ai/hide-check-phase = DWELL / LAST_SEEN_ROOM｜目标 hide_second_bed`（时长 0.5 s 采样，事件序列见下） |
| 权威判定（开发者真值） | `HIT_CONCEALED｜搜出藏身目标｜计划瞄点 (-14.1, 9.8)｜最终判定点 (-14.1, 9.8)｜距离 0.53｜偏差 -1.1°｜站位成立（偏差 0.234）｜朝向成立｜权威层读取真实藏身点：是｜计入正式检查：是` |
| 计数 | `human-ai/hide-check-round = 1 / 1（上限 1）　1（上限 3）` |
| 结果 / 对局 | `hide-check-result = HIT（hide_second_bed）`；`人类获胜`，对局 00:41 结束 |

AI JSON（`formatVersion = 1.5`，`humanSearchEvents = 12`，`hideEvents = 1`）的事件链：

```
 33928ms HUMAN_AI_STATE        PATROL → CHASE（VISION_TARGET）
 35064ms HUMAN_AI_STATE        CHASE → INVESTIGATE（LOST_SIGHT）
 40614ms HUMAN_LAST_SEEN_ROOM  OK：最后目击房间 second_bedroom 里有公开藏身点：hide_second_bed
 40614ms HUMAN_HIDE_SUSPECT    hide_second_bed
 40614ms HUMAN_HIDE_SEARCH_TRAVEL  hide_second_bed（来源 LAST_SEEN_ROOM）｜站位 -14.35, 9.78｜表面 -14.05, 9.83｜路径 2 节点
 40614ms HUMAN_AI_STATE        INVESTIGATE → CHECK_HIDE（LAST_SEEN_ROOM_HIDE_SUSPECT）
 40850ms HUMAN_HIDE_SEARCH_START   hide_second_bed｜停留 0.9 秒
 40850ms HUMAN_HIDE_SEARCH_DWELL   hide_second_bed｜到达规划站位（偏差 0.234），开始 900 ms 停留
 41730ms HUMAN_HIDE_SEARCH_REQUEST hide_second_bed｜到站 + 朝向正确 + 满 900 ms 停留，发出一次正式搜查请求（只发一次）
 41730ms HUMAN_HIDE_SEARCH_RESOLVE HIT：搜出藏身目标
 41730ms HUMAN_HIDE_SEARCH_HIT     hide_second_bed
 41730ms HUMAN_AI_STATE        CHECK_HIDE → CAPTURE（CHECK_HIDE_HIT）
```

`RESOLVE` 事件的结构化 `data`（节选，证明三处中心与计数都可从日志回答）：

```json
{"state":"CHECK_HIDE","source":"LAST_SEEN_ROOM","roomId":"second_bedroom",
 "stancePoint":{"x":-14.346,"z":9.778},
 "plannedSurfacePoint":{"x":-14.05,"z":9.826},
 "navGoal":{"x":-14.6,"z":9.6},
 "stanceDistance":0.23355,"requestPosition":{"x":-14.578,"z":9.750},
 "approachSteps":5,"requestCount":1,"staleCancels":0,"countsAsFormalCheck":true}
```

**本轮修复的直接对照**：该次 `navGoal (-14.6, 9.6)` 与规划站位 `(-14.35, 9.78)` 相距
`hypot(0.25, 0.18) ≈ 0.308 u`，**大于** `humanAI.waypointTolerance = 0.25`。旧实现按「到达导航吸附点」
即进入 `DWELL`，角色停在吸附点附近就会在正式判定里被判 `STANCE_LOST`；新实现用 5 帧最终接近把偏差
收到 `0.2336`（≤ 0.25 + contactEpsilon）后才进入 `DWELL`，判定通过并完成抓捕。

## 3. 场景 B：Human 玩家 Q 家具交互——通过

`playerQ-console.txt` / `playerQ-ai-json.json` / `player-q-target.png` / `player-q-backwards.png` / `player-q-after.png`

| 步骤 | 实测读数 |
|---|---|
| 人类玩家走到储物间纸箱旁（`door_kitchen_storage` 按 E 开门） | `movement/Human 位置 = (16.16, -5.54)` |
| 进入合法交互区域 | `hide/hide-search-region = LEGAL｜合法交互位置｜区域内候选 1 件`；`hide/hide-search-target = 高亮 FURNITURE（hide_storage_carton｜家具 storage_carton）` |
| HUD 提示 | `人类：Q 搜查「储物间纸箱」（站在交互区域内即可，不必面向家具）｜Q：可用` |
| 转身背对家具（仍在区域内） | 高亮与提示保持不变（`高亮 FURNITURE`），截图 `player-q-backwards.png` |
| 按 Q | `hide/hide-search-furniture = MISS_EMPTY｜家具是空的（搜空）｜家具 storage_carton｜瞄点 (15.3, -5.3)｜权威占用读取：是｜家具搜查 1 次 / 命中 0 次`；提示「家具搜查完成：「储物间纸箱」没有人，Q 进入 12 秒冷却」 |
| 冷却状态 | `hide/hide-search = 11.2 秒 / MISS_EMPTY`；HUD「人类：Q 搜查「储物间纸箱」｜冷却中 11.2 秒（家具描边变暗，暂时不能按）」（截图 `player-q-after.png` 可见描边明显变暗） |
| 冷却中再按 Q | 提示「搜查冷却中：剩 10.6 秒」，`家具搜查` 计数仍为 **1**（没有产生第二次搜查） |

AI JSON：`playerSearchEvents = 1`，类型 `PLAYER_Q_FURNITURE_MISS`，`data` 含
`targetKind=FURNITURE / legal=true / legalCode=LEGAL / authoritativeRead=true / cooldownReady=false`。

## 4. 控制台

两个场景的控制台都只有：

```
[debug] [vite] connecting... / [vite] connected...
[warning] THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.
[log:error] Failed to load resource: the server responded with a status of 404 (Not Found)   ← /favicon.ico
```

**0 页面异常、0 未捕获错误**；`THREE.Clock` 是既有库告警（非本轮引入）。

## 5. 明确 BLOCKED（不得记为 PASS）

1. **「玩家 Q 从藏有 DeepSeek 娘的家具里搜出对方」**：浏览器里无法构造——同一局里只有**人工控制**的
   DeepSeek 娘会藏身（AI 自主藏身属未授权的 S7C-2b），而玩家不能同时控制两个阵营。该分支只有真实地图
   自动化证据：`tests/human-furniture-search.test.mjs`（合法搜查命中）与
   `tests/human-ai-stance-approach.test.mjs`（`HIT_CONCEALED` 走完整结算接缝）。
2. **「两个交互区域重叠」**：真实地图上不存在——8 个交互区域两两不重叠（0.1 世界单位网格全图扫描结果为 0
   个重叠格点）。重叠行为用「真实几何 + 移动家具 / 锚点构造的重叠」验证
   （`tests/hide-target-resolution.test.mjs`、`tests/human-furniture-search.test.mjs`），**不是真实地图上的复现**。
3. **「吃米 → 留痕 → AI 亲自看见米痕」的纯米痕链**：与上一轮同因（全部门初始 CLOSED、脚本需手动开门），
   该链路由真实地图控制器集成测试覆盖（`tests/human-ai-check-hide.test.mjs`、
   `tests/human-ai-search-lifecycle.test.mjs`）。
