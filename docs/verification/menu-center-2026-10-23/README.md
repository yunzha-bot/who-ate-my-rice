# 阵营卡片居中 — 2026-10-23

按用户要求仅取消桌面双卡组的右偏。`src/opening-menu.css` 中 `--menu-content-left` 的中间计算从 `calc(50% - 34.32rem)` 改为 `calc(50% - 38.4rem)`，与76.8rem组宽的一半对应；1920宽时左移65.28 CSS px。卡片大小、间距、内部文字/立绘、纵向位置、标题、设置、动态与点卡开局逻辑不变。窄屏原有单列居中和触屏规则保留。

## 本轮验证

| 检查 | 实际结果 |
| --- | --- |
| npm test | 1125/1125，失败/取消/跳过0，92.24秒 |
| npx tsc --noEmit | 退出0 |
| npm run build | 退出0，143模块；既有大于500kB chunk警告保留 |
| git diff --check | 退出0；既有LF/CRLF提示保留 |
| Chrome / Edge实际无头浏览器 | 22组窗口，横向中心误差<1px、卡片/人物比例与无横向溢出通过；设置和每组双阵营点击入口通过；页面/HTTP错误0 |

复用 `scripts/verify-menu-aspect.mjs`，新增双卡组/单列中心断言。窗口包括1920×1080、1768×890、1366×768、1266×1195、1000×1000、2560×1080、1280/1279边界、640×900、455×768及resize返回。原生浏览器工具栏缩放未在本轮操作；本轮入口检查不冒充完整教学/正式对局回归。

- [Chrome 1920×1080](chrome-1920x1080-1.png)
- [Edge 1920×1080](msedge-1920x1080-12.png)
- [Chrome 1366×768](chrome-1366x768-4.png)
- [窄窗单列](chrome-1266x1195-3.png)
- [全部22组几何与错误记录](results.json)

本轮修改：opening-menu.css、verify-menu-aspect.mjs、HANDOFF、追加AGENT_LOG与本目录证据。默认dist已更新；现有dist-tencent及zoom-v2 ZIP仍为此次居中之前的版本，保留未覆盖，上线前须重新生成。未暂存/commit/push/Tag/部署，待用户观感验收。
