# S7C-2 第三轮修复轮：真实浏览器复核证据（2026-09-26）

本目录是「Human 玩家 Q 改为**暴露目标优先，其次指向家具**」这一轮的真实验证产物。
脚本用本机 Chrome `--headless=new` + CDP 直连真实的 `http://127.0.0.1:5173/`（已在运行的
Vite 开发服务器），全部操作都是**真实按键输入 + 真实碰撞移动 + 真实游戏循环**，
读数来自 DEV 面板与 DEV-B 面板的公开字段，以及游戏自己导出的 AI JSON。

```
node --experimental-strip-types browser-check.mjs <playerQ|playerQBed|playerQBedWait> <outDir>
```

## 场景与结果

| 场景 | 内容 | 结果 |
|---|---|---|
| `playerQ` | 控制 Human 真实走图到**储物间纸箱**的合法交互区域 → 背对纸箱 → 面向纸箱 → 各按一次 Q | **PASS** |
| `playerQBed` | 同上，但走到**主卧床**区域（`door_living_kitchen(9,-6)` → `door_living_hall(-3,1)` → `door_hall_master(-8,-1.5)`，三扇门都用 E 真实开启） | **PASS** |
| `playerQBedWait` | 只在主卧床区域等 DeepSeek AI 按自己的状态机巡视进来，专测「暴露目标优先」的那一帧 | **BLOCKED**（4 次尝试，见下） |

## 通过的关键读数（本轮实测）

**主卧床（`playerQBed-console.txt`）**

- 到达床边：`hide/hide-search-region = LEGAL｜合法交互位置｜区域内候选 1 件`。
- **背对床**：`高亮 NONE（无｜家具 无｜合法 否｜指向 否｜暴露目标优先 否）`，HUD 回落为
  `人类：Q 扇形搜查（半径 1.5、张角 120°）｜Q：可用`；按 Q → `家具搜查 0 次 / 命中 0 次`，
  提示 `搜查未命中：目标不在扇形半径内`，Q 进入 12 秒冷却。
- 等 12 秒冷却结束 → **面向床**：`高亮 FURNITURE（hide_main_bed｜家具 main_bed｜合法 是｜指向 是 45.0°｜暴露目标优先 否）`，
  HUD `人类：Q 搜查「主卧床」（面向家具即可，不必精确瞄准）｜Q：可用`，白色呼吸描边可见
  （`playerQBed-player-q-facing.png`）。
- 按 Q：`MISS_EMPTY｜家具是空的（搜空）｜家具 main_bed｜瞄点 (-11.9, -5.2)｜权威占用读取：是｜家具搜查 1 次`，
  提示 `家具搜查完成：「主卧床」没有人，Q 进入 12 秒冷却`。
- 冷却中再按：`搜查冷却中：剩 10.5 秒`，家具搜查次数仍为 **1**、AI JSON 无新事件。
- AI JSON：`formatVersion 1.5`、`playerSearchEvents` 2 条（`PLAYER_Q_FAN_MISS` reason `NO_TARGET`；
  `PLAYER_Q_FURNITURE_MISS` `pointed: true`、`pointingDeltaDeg: 45.0`、`authoritativeRead: true`）。

**储物间纸箱（`playerQ-console.txt`）**：同一套规则的第二个样本——背对 → `高亮 NONE`、
按 Q `家具搜查 0 次`；面向 → `高亮 FURNITURE（hide_storage_carton｜合法 是｜指向 是 29.4°）`、
HUD `Q 搜查「储物间纸箱」`；按 Q → `MISS_EMPTY`（瞄点 (16.1,-5.3)、权威占用读取：是、1 次）；
冷却中再按 → `搜查冷却中：剩 10.6 秒`。

两个场景的浏览器控制台都只有既有的 `THREE.Clock` 弃用告警与已知的 `/favicon.ico` 404，**0 页面异常**。
复核期间只通过 DEV-B **内存覆盖** `capture.radius = 0.05`（避免脚本走图时被普通抓捕提前结束对局），
不改正式 `GAME_CONFIG`，结束后该局即弃。

## BLOCKED：未能在浏览器里摆出的那一帧

用户本轮的重点场景是「**玩家贴近床并面向逃跑中的 DP 娘，Q 正常抓人**」。要复现它需要同一帧里
**同时**满足三件事：玩家站在家具的合法交互区域内、朝向指向该家具、且**未藏身**的 DeepSeek 娘
落在 1.5 u / 120° 的普通扇形里。本轮做了 4 次真实尝试，全部留档（`playerQFan-console.txt`、
`playerQWait-console.txt`、两次 `playerQBedWait-console.txt`）：

1. **在客厅纸箱区域等 AI 自己走进来**：AI 的米堆路线全程停在地图西侧，最近 12.9 u，
   从未进入纸箱区域；对局 01:52 由 AI 吃米获胜结束。
2. **追赶到次卧床（把她「赶」过去）**：脚本的直线走图器在门框角落反复卡住
   （日志中 `卡在 (9.32,-2.32)`、`卡在 (-2.66,-7.45)` 等），且对局 02:24 结束。
3. **用真实脚步声诱导**：`FOOTSTEP` 半径 17 u，同时把 AI 减速到 40 px/s 并让它的视觉几乎失效
   （`vision.range = 1`），在客厅纸箱区域内来回走动 60 轮；AI 始终停在 12.9–25 u 的西侧。
4. **在主卧床区域等 AI 巡视进来**（两轮，AI 减速到 30 px/s）：AI 最近只到床边 **6.6 u**，
   随后转去衣帽间 `rice_10` / 卫生间 `rice_11` 吃米；两局分别在 01:57、02:20 由 AI 获胜结束。

结论：**该分支只能在自动化测试里覆盖**（`tests/player-q-priority.test.mjs` §四.1 用**真实地图**的
次卧床交互区域 + 真实 120°/1.5 u 扇形几何断言「有暴露目标时抓人、不搜床」），
**不得记为浏览器 PASS**；请用户在人工验收时用自己的双手确认这一条。

## 文件清单

| 文件 | 说明 |
|---|---|
| `browser-check.mjs` | 复核脚本（三个场景、真实按键、真实走图、AI JSON 导出） |
| `playerQ-console.txt` / `playerQ-ai-json.json` / `playerQ-*.png` | 储物间纸箱场景：日志 / AI JSON / 4 张截图 |
| `playerQBed-console.txt` / `playerQBed-ai-json.json` / `playerQBed-*.png` | 主卧床场景：日志 / AI JSON / 4 张截图 |
| `playerQBedWait-console.txt` / `playerQBedWait-ai-json.json` | 主卧床等待 AI 的尝试（最后一次，结果 BLOCKED） |
| `playerQFan-console.txt` / `playerQFan-ai-json.json` | 尝试 1（客厅纸箱等待，BLOCKED） |
| `playerQWait-console.txt` / `playerQWait-ai-json.json` | 尝试 3（脚步声诱导，BLOCKED） |
