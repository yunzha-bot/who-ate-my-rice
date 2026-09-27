# S7C-2b 浏览器复核材料（DeepSeek 娘 AI 自主藏身）

本目录是 S7C-2b 实现轮新增的真实浏览器复核材料。**它不改动 `docs/verification/S7C-2-r2|r3|r4/` 的任何既有产物**（那三份原地保留）。

## 怎么跑

前置：`npm run dev` 已经在 `http://127.0.0.1:5173/` 运行（端口固定，不漂移）。

```bash
node --experimental-strip-types docs/verification/S7C-2b/browser-check.mjs docs/verification/S7C-2b
```

脚本用本机 Chrome `--headless=new` + CDP 驱动**真实按键与真实碰撞移动**：

1. 选 **HUMAN** 阵营（此时 DeepSeek AI 才运行），展开 DEV 面板与 DEV-B 面板；
2. 只用 DEV-B 的**仅内存**覆盖层调三个值（不写回 `GAME_CONFIG`）：`movement.playerSpeed = 60`（DP 变慢）、`movement.humanSpeedMultiplier = 6`（Human 追得上）、`capture.radius = 0.2`（避免人工追逐误触发抓捕提前结束对局）；
3. **不猜相机相对按键映射**：先按 700 ms 的 W / D 实测世界位移，解出基向量，再用它把「朝目标的世界方向」换算成按键；
4. 追逐：直线贪心 + 连续卡住时左右交替侧向绕行 + 按 E 开门（第一版只有直线贪心，会在墙上卡死 100 秒，见下方结论里的说明）；
5. 观察到藏身后**拉开距离**，等 AI 自主退出；
6. 导出本局 AI JSON，检查 `formatVersion` 与 `hideEvents` 事件词汇。

## 最近一次实跑结论（2026-09-27）

- 追逐 24.8 秒时 AI 从 `MOVE_TO_RICE` 切到 `HIDE`；`hide-ai-phase` = `CONCEALED（HIDE）｜hide_living_carton｜(7.0, 3.6)｜路线 6.46`；
- 权威进入层回执：`ENTERED｜真实位置通过完整合法性复核（7.07,3.38）`；
- 藏身期间 `hide/hide-state` = `藏身中（hide_living_carton）`、`hide/hide-capture` = 不累计、HUD 显示「AI 已自主藏身：hide_living_carton（Human 搜查仍可把它搜出来）」；
- 拉开距离后 AI **自己出来**：`hide-ai-exit-gate` = `THREAT_CLEARED｜最近退出 威胁解除且仍有可达米堆`，`dpMode` 回到 `EAT`；
- 循环抑制生效：`hide-ai-loopguard` = `hide_living_carton:8000(REENTER_COOLDOWN)`，`连续 1 / 2`；
- AI JSON：`formatVersion 1.6`，`hideEvents` = `HIDE_AI_REQUEST / HIDE_AI_ENTERED / HIDE_AI_EXIT_REQUEST / HIDE_AI_EXITED`（外加上层状态机的 `HIDE_ENTER / HIDE_EXIT`）；进入与退出相隔 2.586 秒，与 `hideMinConcealMs = 2500` 一致；
- 控制台**无异常**；唯一的 404 是浏览器自动请求 `/favicon.ico`（`index.html` 没有引用任何图标），与本次改动无关。

## 产物

| 文件 | 内容 |
|---|---|
| `browser-check.mjs` | 可重跑的复核脚本（本目录的唯一代码） |
| `browser-check-log.txt` / `browser-check-summary.json` | 本次实跑的完整日志与结论摘要 |
| `browser-check-progress.txt` | 追逐阶段之前的中间日志 |
| `chase-timeline.json` | 追逐期间每步的距离 / AI 相位 / DP 威胁读数 |
| `concealed-snapshot.json` / `after-exit-snapshot.json` | 藏身瞬间与自主退出后的 DEV 字段快照 |
| `00-before-chase.png` … `03-after-exit.png` | 四个阶段截图（`02-concealed.png` 的 HUD 直接显示 AI 自主藏身提示） |
| `s7c2b-ai-json.json` | 本局导出的 AI JSON（含 `hideEvents` 时间线） |

## 本目录**没有**覆盖的场景（不得当成 PASS）

- Human AI（而非玩家）把藏身中的 DP 搜出来的完整浏览器链路：本目录只在脚本里驱动玩家追逐，Human AI 搜查链由 `tests/human-ai-check-hide.test.mjs` / `tests/human-hide-search-resolution.test.mjs` 覆盖；
- 反复逼近 / 拉开多次后的抖动表现、暂停 / 重开 / 返回阵营页的状态清理、地图热应用后丢弃失效藏身点：由 `tests/deepseek-hide-loop-guard.test.mjs`、`tests/deepseek-hide-lifecycle.test.mjs` 与既有的 `hide-integration` / `dev-freeze` 用例覆盖，浏览器侧留给人工验收。
