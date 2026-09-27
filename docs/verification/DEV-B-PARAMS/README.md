# DEV-B 运行时调试参数持久化（本地预设）浏览器复核材料

- 复核日期：2026-09-27
- 脚本：`browser-check.mjs`（本机 Chrome `--headless=new` + CDP 直连；真实 DOM 点击、
  真实 `input` change 事件、`Page.reload` 刷新、真实 Esc →「重新开始」、CDP 自动接受确认框）
- 用法：`node --experimental-strip-types browser-check.mjs docs/verification/DEV-B-PARAMS`
  （先确保 `http://127.0.0.1:5173/` 已在运行）
- 实测环境：Windows 10 + Chrome headless，本机 DSH 沙箱（会话为 `danger-full-access`）

## 实测结果（本轮最终一次运行）

| 步骤 | 覆盖的要求 | 实测结果 |
|---|---|---|
| 1 | 干净基线 | 清掉本地预设后刷新重开：`FOOTSTEP 有效传播范围`＝**17**（正式基准），状态 `BASE｜正式默认值`，`localStorage` 无 DEV-B 键 |
| 2 | 改值后显示未保存修改 | 把 FOOTSTEP 17 → **13**：行内显示「已覆盖：13.0 世界单位（正式基准 17）」，状态行 `UNSAVED｜未保存修改` |
| 3 | 保存调试参数 | 点「保存调试参数」→ `SAVED｜已保存`，提示「已保存 1 项调试参数到本地预设」，`localStorage` 键 `who-ate-my-rice/dev-b-runtime-params`（`version 1` / FOOTSTEP 13 / `savedAt`） |
| 4 | **刷新后恢复** | `Page.reload` → 重新进入对局 → FOOTSTEP＝**13**，状态 `SAVED` |
| 5 | **正常重开后恢复** | Esc →「重新开始」→ 等到「对局中」→ FOOTSTEP＝**13**（未被重置回 17），状态 `SAVED` |
| 6 | 恢复正式参数＝17，预设保留 | 点「恢复正式默认值」→ FOOTSTEP＝**17**，状态 `BASE｜正式默认值`，提示明确写着「本地预设保留，可点『加载已保存预设』恢复」，`localStorage` 键**仍在** |
| 7 | 重新加载已保存预设 | 点「加载已保存预设」→ FOOTSTEP＝**13**，状态 `SAVED`，提示「已恢复本地预设的 1 项覆盖」 |
| 8 | 场景编辑器 V2 地图存档不受影响 | 预置哨兵值写在地图存档键上，走完全部 DEV-B 流程后**原样保留**；两个键名不同（`…/dev-b-runtime-params` vs `…/scene-editor-layout`） |
| 9 | 删除本地预设必须经确认 | 点「删除本地预设（需确认）」→ **确认框 1 次** → `localStorage` 键已删除；当前内存覆盖值仍为 13（状态回到 `UNSAVED`），提示写明「内存中的当前覆盖值保持不变」 |

- 控制台：**无异常**。仅有 3 条既有的 `THREE.Clock` 弃用告警（非本轮引入，脚本单独计数）
  与浏览器自动请求 `/favicon.ico` 的 404（`index.html` 无 icon，既有现象）。

## 文件

| 文件 | 内容 |
|---|---|
| `browser-check.mjs` | 可复现的复核脚本（命中测试后点击、`scrollIntoView` 定位长面板、确认框自动接受） |
| `browser-check-log.txt` | 本次运行的完整控制台输出 |
| `browser-check-summary.json` | 每个步骤的结构化结果 + 确认框文本 + 控制台异常 |
| `01-baseline.png` | 基线：FOOTSTEP＝17、状态「正式默认值」、无本地预设 |
| `02-unsaved.png` | 改成 13 后：状态「未保存修改」 |
| `03-saved.png` | 保存后：状态「已保存」+ 提示文案 |
| `04-after-reload.png` | **刷新后恢复 13**（红字已覆盖 + 状态已保存） |
| `05-after-restart.png` | **重开后仍为 13** |
| `06-restored-formal.png` | 恢复正式默认值：17 + 提示「本地预设保留」 |
| `07-loaded-preset.png` | 加载已保存预设：回到 13、状态「已保存」 |
| `08-delete-confirm.png` | 删除预设后：键已删除、内存覆盖值仍为 13 |

> 截图按**拍摄顺序**编号；第 8 步「场景编辑器地图存档不受影响」是键值比对，不产生截图。

## 复现要点（本轮实际踩到的两处脚本问题）

1. `.dev-b-launcher` 的点击是**切换**：面板已经打开时再点一次会把它关掉，之后的读数全为空。
   复核脚本改成「先查 `panel.hidden`，已打开就不再点」。
2. `.dev-b-panel` 有 `max-height` 且由 `.dev-b-body` 内部滚动：参数行与底部按钮的
   `getBoundingClientRect()` 可能在视口之外，命中测试与截图都会拿到错误位置。
   点击 / 取值前先 `scrollIntoView({ block: 'center' })`。
3. DEV 面板必须先展开（`.debug-toggle`）才会出现 `[data-property=…]` 与 DEV-B 入口；
   `match-phase` 是**中文本地化文案**（「对局中」），不要拿英文枚举比较。
4. 面板关闭时会保留上一次渲染的 DOM：**读状态前必须确认 `.dev-b-panel` 未隐藏**，
   否则会把「关闭」误读成旧状态。
