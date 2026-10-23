# 移动端交互白边外扩修正 — 2026-10-22

用户反馈：白边像闪白或内收，要求从交互按钮外沿向外扩散。

## 定位与修复

真实Chrome逐帧复现旧实现：350ms不透明度0.377，650ms仅0.063；新版Chrome的缩放方向原本向外，但消失过早。新增检查要求650ms仍可见，修复前实际失败。旧测试只核对动画名称/时长，不能证明视觉轨迹正确。

用户后续明确标注仅参考方向、12px范围太大，最终收为5px。`src/three/AlphaHudView.ts`集中参数`MOBILE_CONTROLS.rippleSpreadPx=5`；`src/mobile-ui.css`以负inset从-1px到-6px外扩5px，代替含长度除法的scale计算，减少移动浏览器兼容风险（未实测旧手机内核，不将其认定为唯一根因）；圆角同步从13px扩到18px，描边固定2px。前55%保持较高不透明度，85%淡出，末尾留空档，周期仍1050ms。可交互状态显式允许外框溢出；低动态模式保留静态外框。

保留按钮位置、尺寸、HUD主题、交互判定和所有玩法数值，只调整集中视觉参数中的波纹范围。

## 可复验的浏览器证据

`scripts/verify-mobile-ripple.mjs`加载真实AlphaHudView与当前完整样式，在Chrome/Edge触屏视口844×390中暂停真实CSS动画并设置采样时间；这是隔离HUD样例，不冒充正式对局截图。检查外框宽高单调增长、扩散中仍可见、不可交互后消失、reduced-motion关闭动画。

| 时间 | 外框宽×高 | left/top | 不透明度 |
| --- | --- | --- | --- |
| 0ms | 65×49px | -1px | 0.95 |
| 350ms | 68.91×52.91px | -2.96px | 0.859 |
| 650ms | 72.28×56.28px | -4.64px | 0.616 |
| 900ms | 75×59px | -6px | 0 |

两个浏览器结果一致；按钮自身一直65×49px。原始数据见[results.json](results.json)。

- Chrome采样：[0ms](chrome-0ms.png)、[350ms](chrome-350ms.png)、[650ms](chrome-650ms.png)。
- Edge采样：[0ms](msedge-0ms.png)、[350ms](msedge-350ms.png)、[650ms](msedge-650ms.png)。
- 完整游戏回归使用既有`verify-mobile-controls.mjs`，Chrome/Edge各两手机尺寸×双阵营以及桌面回归全部通过，输出在`game-regression/results.json`。这批跨系统回归开始于12px候选，最终5px版另以上述定时采样复验；不将旧候选截图冒充最终5px图。

复验：设置PLAYWRIGHT_MODULE为本机Playwright模块URL，运行`node scripts/verify-mobile-ripple.mjs`；MOBILE_ARTIFACT_DIR可指定新目录，避免覆盖已有证据。

## 自动化与限制

本轮全量npm test 1100/1100，失败/取消/跳过0；独立tsc、生产构建、diff检查通过，保留既有chunk大于500kB警告。Chrome/Edge为桌面浏览器触屏模拟，Android/iOS/微信真机观感仍需用户确认。

没有提交、推送、上传或部署。dist由本轮构建生成；dist-tencent仍为历史包，若要上传修正需另行重建。
