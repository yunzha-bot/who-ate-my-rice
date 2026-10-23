# Human开屏立绘亮度微调 — 2026-10-23

用户反馈人类立绘偏曝；仅`src/opening-menu.css`的人类`.faction-portrait`增加`filter: brightness(.92)`，显示RGB亮度降低8%，不是重绘或从原图恢复已丢失的高光信息。保留原PNG与透明度、衣服/肤色原配色关系、布局和其他画面。不影响游戏内模型。

实际Chrome/Edge无头浏览器1920×1080检查：Human计算滤镜brightness(0.92)、DeepSeek为none；临时移除滤镜前后立绘矩形一致；恢复滤镜后Human点卡入口正常，页面/HTTP错误0。before截图是在同一浏览器临时将Human滤镜设为none所得真实画面，不是旧截图；after来自本轮源码。

- [Chrome调整前](chrome-human-before.png) / [调整后](chrome-human-after.png)
- [Chrome完整开屏](chrome-after.png)
- [Edge完整开屏](msedge-after.png)
- [浏览器记录](results.json)

本轮npm test1125/1125，失败/取消/跳过0，66.68秒；独立tsc、生产build、git diff --check退出0。143模块，既有chunk>500kB及LF/CRLF警告保留。已查看Chrome前后实际截图，最终亮度仍待用户审美验收；未重复全套教学/正式对局测试。

修改源码opening-menu.css，更新HANDOFF与追加AGENT_LOG，新增本目录证据；一次性浏览器探针在系统临时目录，不进入工程源码。默认dist更新；Tencent目录及旧ZIP未更新，上线前需重建。未commit/push/Tag/部署。
