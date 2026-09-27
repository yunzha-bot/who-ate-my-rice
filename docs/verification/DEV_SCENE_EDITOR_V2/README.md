# DEV 场景编辑器 V2（布局保存 / 恢复 / JSON 导入）浏览器复核材料

- 复核日期：2026-09-27
- 脚本：`browser-check.mjs`（本机 Chrome `--headless=new` + CDP 直连；真实 DOM 点击、真实
  `<input type="file">` change 事件、`Page.reload` 刷新、CDP 自动接受确认框）
- 用法：`node --experimental-strip-types browser-check.mjs docs/verification/DEV_SCENE_EDITOR_V2`
  （先确保 `http://127.0.0.1:5173/` 已在运行）
- 实测环境：Windows 10 + Chrome headless，本机 DSH 沙箱 `workspace-write`

## 实测结果（本轮最终一次运行）

| 步骤 | 覆盖的需求 | 实测结果 |
|---|---|---|
| 1 | 默认布局状态 | 清掉本地存档后刷新：`DEFAULT｜默认布局｜未保存修改：否｜存档：无`；`living_sofa` 授权宽度 2.2 |
| 2 | 应用后状态 / 保存 | 应用编辑后 `CUSTOM`（未保存=是）；保存后 `SAVED`，`localStorage` 写入 `layoutVersion=1`、`sofaWidth=1.4`、`savedAt=2026-09-27T12:10:50.123Z` |
| 3 | **刷新后自动恢复** | `Page.reload` + 重新进对局 + 打开编辑器：`SAVED`，`living_sofa` 宽度 **1.4** |
| 4 | 非法 JSON 不改变当前地图 | `IMPORT_FAILED`（`NOT_JSON`），宽度仍 1.4 |
| 5 | 来自另一张地图的文档 | `IMPORT_FAILED`（`READ_ONLY_MISMATCH`：房间/门/出生点/米点与当前地图不一致），宽度仍 1.4 |
| 6 | V3 文档导入生效 | `UNSAVED`，宽度变为 1.6（本地存档仍是 1.4） |
| 7 | 恢复默认地图 | 触发确认框 **1 次** 并接受；宽度回到授权值 2.2；**本地存档仍在**（`sofaWidth=1.4`） |
| 8 | 重开保留已应用布局 | 换成自定义 1.55 并保存 → 关闭编辑器 → Esc「重新开始」→ 等到对局中再打开编辑器：`SAVED`，宽度仍 **1.55**，本地存档 1.55 |
| 9 | 存档损坏/缺失的安全回落 | 清掉本地存档后刷新：`DEFAULT`，无白屏，`localStorage` 已清空 |

- 控制台：**无异常**；只有既有的 `THREE.Clock` 弃用告警与浏览器自动请求 `/favicon.ico` 的 404（`index.html` 无 icon，既有现象）。

## 用户侧证据（独立于本目录）

- 用户集中浏览器人工验收（2026-09-27）：**9 / 9 PASS**（应用编辑 / 保存布局 / 刷新后恢复 / JSON 导出与导入 / 错误文件保护 / 恢复默认地图 / 重开与返回菜单 / S7C-3 随机化及旧功能回归 / 存档丢失安全回退）。
- 上表是本目录脚本自动复核的结果，与用户人工验收是**两条独立证据**，覆盖范围不同；两者都不得互相改写为对方完成的测试。

## 文件

| 文件 | 内容 |
|---|---|
| `browser-check.mjs` | 可复现的复核脚本（含 `DataTransfer` 造 File 的导入路径、确认框自动接受、`elementFromPoint` 点击命中校验） |
| `browser-check-log.txt` | 本次运行的完整控制台输出 |
| `browser-check-summary.json` | 每个步骤的结构化结果 + 确认框文本 + 控制台异常 |
| `01-default.png` | 初始默认布局状态行 |
| `02-applied-saved.png` | 应用编辑并保存后（`SAVED`） |
| `03-after-reload.png` | 刷新后自动恢复（宽度 1.4） |
| `04-import-broken.png` | 非法 JSON 导入失败，地图未变 |
| `05-import-wrong-map.png` | 来自另一张地图的文档被拒绝 |
| `06-import-good.png` | 合法 V3 文档导入生效（1.6，未保存） |
| `07-restored-default.png` | 恢复默认地图后（宽度回 2.2，本地存档保留） |
| `08-after-restart.png` | 「重新开始」后仍保留自定义布局 1.55 |
| `09-cleared.png` | 清掉本地存档后刷新回落到默认布局 |

> 脚本迭代过程中早期命名留下的重复截图（`05-import-good.png`、`06-restored-default.png`、
> `07-after-restart.png`）已在本地清理中删除，不作为证据；上表 9 张是保留的最终证据，每张对应一条状态。

## 复现要点

1. 编辑器只能在 `PLAYING` 打开：重开后必须先等 READY 结束（脚本用 `waitPlaying()`）。
2. 面板关闭时会保留上一次渲染的 DOM，**读布局状态前必须确认 `.scene-editor-panel` 未隐藏**，
   否则会把"打开失败"误读成旧状态。
3. 导入是异步的（`file.text()` → 校验 → 换源重建），读取状态前要等至少一帧。
4. 断言同时看 `.scene-editor-layout` 的 `data-layout-state` 与 `data-layout-unsaved`，
   以及 `localStorage` 里的实际内容，三者互相印证。
