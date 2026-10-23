# 开屏上方辅路与人行道补景 — 2026-10-22

## 修改范围

用户圈出开屏LOGO与设置栏之间的空旷背景。本轮先用实际菜单相机将截图区域对应到主屋后侧辅路/人行道（1280×1186下，屏幕700/210约对应世界X=-19.90、Z=-24.30），再在原StreetLifeView内补景；不是移动UI或改变相机。

- 一处小型候车点：轻量遮棚、长椅、站牌/路线板、“米巷站”标识、两组花箱绿植。
- 辅路虚线及靠边停靠标记，保持道路与路口畅通。
- 新增40个基本形体，复用原形状/材质批次，Node几何场景仍为19个静态实例批次、共190形体；另增加一张小型站名Canvas纹理。
- 位置相对原住宅布局和实际铺地高度计算，所有候车设施在原walk-north上，标线在原road-service内，不改地图JSON、碰撞、导航、AI、玩法数值、声音、角色、开屏布局、镜头、现有4路人/2辆行驶车或其路线。
- 仅视觉布景，不新增公交车、停靠流程或可交互站台；无新循环/监听器/依赖。

## 本轮真实浏览器证据

全部为真实菜单镜头，未使用专用近景镜头代替开屏验收。固定prefers-reduced-motion以获得可比较的静态前后基线；没有将这些静态图当作动态验收。

| 尺寸 | Chrome修改前 / 后 | Edge修改前 / 后 |
| --- | --- | --- |
| 1280×1186，接近用户截图比例 | [前](before/chrome-1280x1186.png) / [后](after/chrome-1280x1186.png) | [前](before/msedge-1280x1186.png) / [后](after/msedge-1280x1186.png) |
| 1920×1080 | [前](before/chrome-1920x1080.png) / [后](after/chrome-1920x1080.png) | [前](before/msedge-1920x1080.png) / [后](after/msedge-1920x1080.png) |
| 1366×768 | [前](before/chrome-1366x768.png) / [后](after/chrome-1366x768.png) | [前](before/msedge-1366x768.png) / [后](after/msedge-1366x768.png) |

[Chrome局部原生截图](after/chrome-upper-detail.png)、[Edge局部原生截图](after/msedge-upper-detail.png)：直接由浏览器screenshot clip截取，不是生成图或重新绘制。

[after/results.json](after/results.json)及每尺寸JSON记录投影区域与5个UI矩形。Chrome/Edge三尺寸均通过：LOGO、两卡片、设置栏、开始按钮与本轮before基线**位置及宽高完全相同**。1280下新增候车组投影约X642–804、Y144–282，确认位于用户指出的上方背景，而非画外。1920下约X1192–1377、Y28–186；1366下约X848–980、Y20–132。

## 实际检查结果

| 项目 | 本轮最终结果 |
| --- | --- |
| 外景/动态/静态布景定向 | 25/25，含新增1项候车组/路面标记边界与接地测试 |
| npm test | 1116/1116，失败/取消/跳过0，约64.67秒 |
| npx tsc --noEmit | 通过 |
| npm run build | 通过，142模块；保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge | 三尺寸共6组UI矩形与真实投影检查通过，无pageerror；各自在1366下验证两阵营开局至PLAYING、暂停、返回菜单，合计4条流程通过 |
| 几何保护 | 候车设施全部在原人行道内、不埋地；花箱接地；道路标记全部在原辅路内部、仅高出路面少量；既有动态路线与17项外景几何检查通过 |

## 本轮文件与状态

- 修改`src/three/StreetLifeView.ts`：增加上述静态辅路布景。
- 修改`tests/street-life.test.mjs`：新增边界、接地及道路标线测试，未降低原断言。
- 新增`scripts/verify-upper-street.mjs`与本目录证据；脚本通过PLAYWRIGHT_MODULE复用已有浏览器工具。UPPER_STREET_BEFORE仅用于修改前基线，复验使用默认after模式，勿覆盖before资料。
- 同步`docs/DEEPSEEK_HANDOFF.md`并在`docs/AGENT_LOG.md`末尾追加结果。

未暂存/提交/推送/Tag/Release/部署，不记Git Gate PASS；此前未提交改动与验证材料保留。默认dist已重建，dist-tencent未重建。

本轮为定点背景补景，未重新做动态录屏/真机FPS/操作系统后台验收；上一轮的对应限制仍保留。背景距离远且受原菜单虚化影响，站牌小字不会像前景UI一样清晰，此为背景层级设计，不为增强字样而移动LOGO/设置或放大镜头。待用户刷新确认密度与位置观感。
