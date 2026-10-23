# 开屏滚动条配色 — 2026-10-22

用户圈出右侧浏览器默认白灰滚动条并要求替换。仅在`src/opening-menu.css`为阵营页、设置下拉面板与制作信息弹窗设置`scrollbar-width: thin`及`scrollbar-color: #b58a49 #dfc38d33`，使用暖金棕滑块、低透明暖色轨道；不隐藏滚动功能，不改菜单布局和玩法。

本轮真实Chrome/Edge在1280×900检查计算样式：thin、rgb(181,138,73)/rgba(223,195,141,0.2)。实际可视900px、内容909px，滚动至底部成功，截图：[Chrome](chrome-scrolled.png)、[Edge](msedge-scrolled.png)。这是本轮本地浏览器截图，非线上部署证据。

本轮npm test 1102/1102，失败/跳过/取消0；独立tsc、build、git diff --check通过，保留chunk>500kB警告。没有提交、推送或部署。默认dist已更新，dist-tencent未重建。
