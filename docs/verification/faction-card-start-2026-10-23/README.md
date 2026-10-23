# 阵营卡片直接开局 — 2026-10-23

用户明确要求移除底部黄色按钮，点击任意阵营卡片直接开局。本轮移除按钮与隐藏提示DOM、专属CSS、按钮动画参数；两张卡片通过原chooseFaction入口启动，保留加载门禁/单次开始/READY/教学/暂停返回。按钮原素材未删除，其余菜单布局未移动。

## 实际验证

- `npm test`：最终1125/1125，失败/取消/跳过0，约52.94秒。首次1124/1125，失败原因为工作区Human缩放已是1.35，旧测试仍要求1.25；保留用户的1.35，仅同步该尺寸预期，接地/比例/动作/碰撞根节点检查均保留。
- `npx tsc --noEmit`、`npm run build`通过。143模块，保留既有chunk大于500kB警告；默认dist更新，dist-tencent未重建。
- Chrome/Edge真实无头浏览器：各六尺寸1920×1080、1768×890、1600×900、1366×768、960×450、390×844，无横向溢出，人物contain、资源正常。两阵营卡片直接开局、加载门禁、READY/教学/PLAYING、暂停返回重选、声音/静音/难度/设置焦点通过，pageerror与HTTP错误为空。
- Chrome首轮并行验证在键盘启动后的PLAYING等待处超时；改用本轮主要要求的真实鼠标点击并单独完整重跑通过。该次超时原因未定，不将其作为通过证据；Chrome键盘完整流程本轮不宣称最终验收。尚未进行手机真机测试。
- `git diff --check`结果见本轮日志；没有Git暂存/提交/推送/部署。

## 本轮证据

- [Chrome 1920×1080](static-1920x1080.png)、[Edge 1920×1080](msedge-static-1920x1080.png)。黄色按钮实际已移除。
- [Chrome 1366×768](static-1366x768.png)、[Edge 1366×768](msedge-static-1366x768.png)。其余各尺寸截图同目录，未使用旧截图。
- [Chrome浏览器结果](browser-results.json)、[Edge浏览器结果](msedge-browser-results.json)。结果中的start=null为按钮不存在。

## 修改文件

- 运行时：`src/three/GameUiLayout.ts`、`src/opening-menu.css`、`src/three/MenuAtmosphereView.ts`。
- 回归：`tests/faction-card-ui.test.mjs`、`tests/helpers/faction-menu.mjs`、`tests/menu-responsive.test.mjs`；`tests/human-glb.test.mjs`仅同步已有1.35尺寸预期。
- 验证脚本同步点卡开局：`verify-opening-static`、`verify-opening-final`、`verify-opening-motion`、`record-opening-motion`、`compare-opening-labels`、`verify-menu-aspect`、`verify-menu-zoom`、`verify-menu-edges`、`verify-mobile-controls`、`verify-human-v2`、`verify-keybindings`、`verify-pages-preview`、`verify-street-activity`、`verify-street-life`、`verify-upper-street`（均为scripts下mjs）。这些脚本已检查语法；本轮实际执行的是verify-opening-static，其余未冒充重跑通过。
- 文档：本报告、DEEPSEEK_HANDOFF、OPENING_UI_RECONSTRUCTION_PLAN及AGENT_LOG追加记录。

下一步：用户刷新本地菜单点击任一阵营验收；无自动部署。
