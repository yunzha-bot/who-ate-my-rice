# 开屏阶段 C：动态验收候选（2026-10-22）

归档范围：明确链接的图片/JSON及后续 D 录像入库，其余四角图、原始录像与日志仅本地保留。下方状态为 C 当轮历史，不代表最新 Git 状态。

阶段 B 静态视觉已获用户验收；本轮按最新授权一次完成全部 C，不逐项请求批准。当前为本地动态验收候选，不代表用户已验收 C 或 Git Gate PASS。没有提交、推送、Tag、发布或部署。

## 实际浏览器证据

- C 的原始14秒录像留本地，避免重复入库；公开复核请看 [阶段 D 新录制的14秒录像](../opening-final-2026-10-22/opening-motion-14s.webm)。两次录制不是同一份证据，无音轨，测试光标不属于正式源码。
- [动态全景](all-motion.png)、[全部动态关闭](motion-off-1920x1080.png)、中心及四角 PNG 位于本目录，另有 Edge 对应版本。
- [Chrome 动态与生命周期](motion-results.json)、[Edge 动态与生命周期](msedge-motion-results.json)、[90 秒持续运行记录](motion-soak-90s-results.json)。90 秒记录形成于最后的补边容器拆分前；最终版另有两浏览器复测，不能混称同一构建连续运行时长。
- [真实录屏元数据](recording.json)、[无录屏硬件 A/B](hardware-performance.json)、[原图/左右分层静止对照](leaf-proof.json)。叶层对照是隔离层测试，不冒充完整页面截图。
- [Chrome 六尺寸和原功能回归](regression/browser-results.json)、[Edge 六尺寸和原功能回归](regression/msedge-browser-results.json)。覆盖 1920×1080、1768×890、1600×900、1366×768、960×450、390×844；不是手机真机或完整触屏玩法验收。

## 完成的四类效果

1. **视差**：复用原 OrthographicCamera，在相机屏幕平面从固定基准计算绝对平移。真实场景总位移上限 12px，左右叶层 16px；主 UI 不参与视差。正交相机下场景各建筑统一平移，不另外挪动中景建筑或改透视/基础观察方向。
2. **树叶**：原始单张合成图未改。沿透明中央分成左右两组，并不是逐片叶子；各自不同周期/相位，两种正弦缓慢叠加。独立容器合成视差和微风，运动时启用外侧补边，避免素材硬边。
3. **米粒**：一个 Canvas 2D、固定 14 个槽位，离屏复用。小型略尖米粒，优先在安静走廊生成，并避让 LOGO、脸部、文字、设置和开始按钮。多轮 Chrome/Edge 采样可见约 10～14 粒，最终两浏览器采样为 11～13 粒，没有白色大圆点、光晕或拖尾。
4. **交互**：原生卡片按钮轻抬/微缩，选择时短促回弹及蓝/黄主题轮廓，另一卡轻微降权；原黄色开始按钮轻抬、按压、回弹，禁用逻辑保持。纸张/人物的原始倾斜与比例未改。

全部装饰不接收鼠标事件。没有新建无限 rAF；ThreeGame 原循环调用独立 View。开局成功后先停止/恢复开屏表现，再走原 READY/教学/正式镜头；返回菜单复用原实例。页面不可见及 reduced-motion 停用表现，dispose 移除事件/装饰层。

## 参数与一键关闭

唯一运行时参数入口：`src/three/MenuAtmosphereView.ts` 顶部 `MENU_MOTION`。这都是视觉参数，不修改 `GAME_CONFIG`。

| 配置 | 当前值 / 含义 |
| --- | --- |
| `enabled` | `false` 一键关闭全部动态，显示原始静态树叶与页面；`true` 恢复 |
| `parallax.enabled` / `foliage.enabled` / `rice.enabled` / `interaction.enabled` | 四项独立开关 |
| `parallax.sceneMaxPx` / `foliageMaxPx` | 12 / 16，径向上限，四角不超限 |
| `parallax.smoothingAt60Fps` | 0.06，按真实帧增量换算；不是每帧固定加 0.06 |
| `foliage.angleDeg` / `driftPx` / `periodsSec` | ±1.1° / 3px / 6.4、7.7 秒，另有缓慢包络 |
| `rice.count` / `minLifeSec` / `maxLifeSec` | 固定池 14 / 生命周期 6～10 秒 |
| `rice.minLengthPx` / `maxLengthPx` | 3～6.5px，宽度约长度的三分之一 |
| `interaction.durationMs` / `pressMs` / `selectionMs` | 230 / 90 / 340ms |
| `interaction.cardLiftPx` / `cardScale` / `selectionScale` | 5px / 1.015 / 1.025 |
| `interaction.buttonLiftPx` / `buttonScale` / `pressScale` | 3px / 1.012 / 0.985 |

样式只消费 View 写入的 CSS 变量；CSS 微调位置为 `src/opening-menu.css` 末尾的开屏交互区。不存在新的玩家设置面板或生产调试全局变量。

## 验证结果与解释

- 新增 7 项定向逻辑测试：指针归一化、30/60/120fps 插值一致、投影方向/位移上限、重复应用不漂移、回中不超调、两组叶层范围/错相、循环/池/门禁接线。连同相关菜单/标签测试共 15 项通过。
- 全量 `npm test`：1092/1092，独立 `npx tsc --noEmit`、`npm run build`、`git diff --check` 已执行；保留原大 chunk 警告。最终门禁以本轮 AGENT_LOG 的实际结束记录为准。
- 两浏览器真实鼠标中心/四角：场景约 ±8.49px / 轴，合成径向 ≤12px；主 UI 矩形相对 B 基线不变，相机方向不变。按住角落不会累计漂移，离开与失焦回中。两侧微风在无指针输入时仍动，且不同相位。
- 卡片实测缩放 1.015，平移 5px；按钮按下缩放小于 1。两阵营选中→开始→READY/首次教学→PLAYING→暂停→返回均通过；声音五路/静音、三档难度、互斥面板、Esc/焦点、制作信息仍可用。
- 正式游戏里开屏计时停止，鼠标移动不污染投影/观察方向；重复派发旧开始按钮点击不会重开。比较镜头时保留既有景深适配沿相机 Z 后退的行为，不错误地把原始位置变化当作视差泄漏。
- 持续运行没有粒子池、菜单节点、事件监听器或 Three.js geometry/texture 的持续增长。单独视图 dispose 后 pointerout 监听从 1 回到 0，装饰层移除。
- 最终硬件 A/B（未录屏）实测：本机静态约 106～118fps、动态约 111～114fps，短时波动不证明动态能提升性能；原循环新增 View 调用 p95 约 0.2ms。最终录屏时运行约57fps，视频编码为25fps；不能据编码帧率推断运行帧率，也不保证低配设备同样表现。
- `baseline.json` 对 18 项原资产/主流程文件校验 SHA-256：原双立绘、LOGO、大卡、纸底、按钮等未改，GameUiLayout / 正式数值 / 基础相机模块未改。

## 已知限制

- 树叶是两组复用合成图，不是真正的逐叶或骨骼动画。正交场景不会因距离产生透视式多层相对运动，层次来自真实场景与前景组的不同位移。
- 分层的 GPU 透明合成不与原单图逐字节一致；内部可见像素有极小色阶舍入，较宽比例的视口最外侧一像素还可能有采样差异，具体数值见 leaf-proof.json。全部动态关闭时直接显示原图，不用分层替代原静态版。
- 无头浏览器切换标签仍报告页面可见；后台停更/恢复的分支使用隔离测试页模拟 `hidden` 与 `visibilitychange` 验证，不冒充真实最小化、系统休眠或锁屏测试。reduced-motion 使用真实浏览器媒体模拟验证。
- 尚未进行用户动态人工验收、低配硬件长时测试、手机真机、Safari/微信完整测试。90 秒与短时帧率不是数小时稳定性保证。

## 本轮文件与恢复

- 新增运行时：`src/three/MenuAtmosphereView.ts`。
- 修改运行时：`src/three/ThreeGame.ts`（仅实例/帧增量/开屏生命周期接线）、`src/opening-menu.css`（独立装饰/条件交互规则）。
- 新增 `tests/menu-atmosphere.test.mjs`；更新 `tests/menu-responsive.test.mjs`，将阶段 B 的“禁止任何动画”改为“默认布局保护 + 可关闭/减少动态的开屏动画”。没有移除布局/人物保护断言。
- 新增 `scripts/verify-opening-motion.mjs`、`scripts/record-opening-motion.mjs` 和本证据目录。沿用既有静态回归脚本，无新增运行依赖；FFmpeg/Winldd 仅是验证用 Playwright 缓存工具，不写入 package.json。
- 同步 `docs/OPENING_UI_RECONSTRUCTION_PLAN.md`、`docs/DEEPSEEK_HANDOFF.md`，只追加 `docs/AGENT_LOG.md`；AGENTS.md 不改。
- 改动前 `ThreeGame.ts`、首页 CSS、原 dist 已复制到 `C:/Users/bilibili/AppData/Local/Temp/rice-before-menu-motion-7083d2c1b9e04c5db7983924274a5c02/`。旧阶段 B 原素材和独立分支保留；没有重置、清理或改写历史。本地 dist 是构建结果，不代表部署。

## 复验入口

先复用 `http://127.0.0.1:5173/`。使用本机已配置的 `PLAYWRIGHT_MODULE` 运行：

```text
node scripts/verify-opening-motion.mjs
node scripts/verify-opening-motion.mjs --leaf-proof  (另需 SHARP_MODULE)
node scripts/verify-opening-motion.mjs --performance
node scripts/record-opening-motion.mjs
```

`OPENING_CHANNEL=msedge` 可复验 Edge；`MOTION_SOAK_MS` 控制持续运行观察时长（默认 90000ms）。所有观察句柄、配置切换、相机/录屏采样仅在隔离浏览器页注入，不加入生产入口。
