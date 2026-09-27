# S7D 验证证据索引

本目录保存 S7D（双阵营完整 Alpha 与整局验证）的**可复现验证材料**。设计与结论见
`docs/S7D_ALPHA_FULL_MATCH_DESIGN.md`；history 见 `docs/AGENT_LOG.md`。

## 证据腿一：无头逻辑仿真（自动化批量）

| 文件 | 作用 |
|---|---|
| `../../../tests/s7d-match-sim.mjs` | 整局仿真器：用同一批生产系统在 Node 里重放 `ThreeGame.updatePlaying()` 的玩法 / AI 通路（含权威藏身进入 / 退出与家具搜查判定）。**逻辑仿真，不是实机。** |
| `run-match-batch.mjs` | 批量跑整局并输出 `match-batch.json`。用法：`node --experimental-strip-types docs/verification/S7D/run-match-batch.mjs <每组合局数> <种子基数> <输出目录> [core\|baseline]` |
| `smoke-sim.mjs` | 最小冒烟（2 组合 × 2 种子），改仿真器后先跑它。 |
| `analyze-match.mjs` | 单局逐事件时间线：`… analyze-match.mjs <seed> <HUMAN\|DEEPSEEK> <policy> [过滤词]` |
| `diagnose-safewait.mjs` | 阻断 A 的数值证据（两个半径与路线最近接近距离）。 |
| `diagnose-hide-lock.mjs` | 阻断 B 的数值证据（藏身时长与退出闸门码）。 |

产物：`baseline/`（修复前 30 局）、`after/`（修复后 30 局，core 组合）、
`after-baseline-combos/`（修复后 **同组合** 30 局，用于严格 A/B）。

## 证据腿二：真实浏览器整局

| 文件 | 作用 |
|---|---|
| `browser-check.mjs` | 真实 Chrome（`--headless=new` + CDP）整局：选阵营 → 站桩对局 → 结算 → 再来一局 → Esc → 返回阵营选择，并从 DEV 面板真实导出本局 AI JSON。用法：`node --experimental-strip-types docs/verification/S7D/browser-check.mjs <输出目录> [只跑某个用例 id 片段]` |
| `probe-dom.mjs` | 只读 DOM 探针：确认脚本依赖的选择器在真实页面里存在（DEV 属性行按需渲染这一发现来自它）。 |

产物：`browser/browser-check-summary.json`（逐局结构化结果 + 真实导出的 `matchSummary`）、
`browser/browser-check-log.txt`（运行日志）、`browser/*.png`（各阶段截图）。

## 口径与限制（引用时必须一并保留）

- 无头仿真是**逻辑层整局**：无渲染、无 DOM、固定 50 ms 帧步长；它不是浏览器实机，也不是真人试玩。
- 仿真器为了可复现把两套 AI 的随机抽签改成种子派生（正式游戏是 `Math.random`），
  因此**同一 `matchSeed` 在仿真与浏览器里的整局轨迹不会相同**：`?matchSeed=` 只复现布局。
- 浏览器腿的玩家一侧是**脚本站桩**，不是真人试玩。
- 用户集中人工验收的结果与以上两条脚本证据**分别记录，互不改写**。
