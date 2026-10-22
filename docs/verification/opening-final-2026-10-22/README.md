# 开屏阶段 D：最终验证与交付

归档范围：明确 Markdown 链接的截图、JSON 与一段录像纳入仓库；其他失败迭代、原始日志、通配符截图留本地。本报告为 D 当轮历史，后续 Git 状态见 [归档报告](../git-preparation-2026-10-22/README.md)。

日期：2026-10-22。项目：`D:/桌面/dev/who-ate-my-rice`。本轮只验证阶段 B/C 现有成果，不重新设计、不改玩法或原图、不提交/推送/部署。

## G. 最终结论：附条件通过

静态布局、四类动态、两个阵营开局/继续/重开/返回及正式门禁均可用；四项工程门禁通过。**不是无保留“通过”**：真实桌面后台隐藏尚未证实，另外硬件分层像素探针有一项非阻断失败，见 F。没有把本地技术验收写成项目 Git Gate PASS。

## A. 本轮真实浏览器证据

全部截图来自本轮安装版浏览器的 Playwright 无头会话，不使用旧图冒充。Chrome `154.0.8037.100`，Edge `151.0.4129.86`；独立新上下文，DPR=1、`visualViewport.scale=1`，1920×1080 等为页面视口像素，不包含浏览器外壳。真实安装浏览器引擎不等于人工操作有头窗口，后者限制在 F 说明。

| 路径（相对此目录） | 浏览器 / 尺寸 | 实际验证内容 |
| --- | --- | --- |
| [chrome-static-1920x1080.png](chrome-static-1920x1080.png) | Chrome / 1920×1080 | 总开关关闭的静态全景 |
| [msedge-static-1920x1080.png](msedge-static-1920x1080.png) | Edge / 1920×1080 | 同条件静态全景 |
| `chrome-static-1768x890.png`、`chrome-static-1600x900.png`、`chrome-static-1366x768.png` | Chrome / 文件名尺寸 | 同页面缩放、元素边界、原立绘等比显示 |
| 对应 `msedge-static-*.png` | Edge / 相同四种尺寸 | 同上；两浏览器矩形相同 |
| [reference-left-current-right-1768x890.png](reference-left-current-right-1768x890.png) | 左参考 / 右 Chrome | 原始尺寸并排，无拉伸，来自 `opening-static/reference.png` 与本轮截图 |
| `center.png`、`top-left.png`、`top-right.png`、`bottom-left.png`、`bottom-right.png` | Chrome / 1920×1080 | 真实鼠标中心、四角；隔离视差，UI 固定 |
| 对应 `msedge-center.png`、`msedge-top-*.png`、`msedge-bottom-*.png` | Edge / 1920×1080 | 同上 |
| [opening-motion-14s.webm](opening-motion-14s.webm) | Chrome / 1920×1080 / 14秒 | 本轮连续真实录屏：鼠标扫动、左右枝叶、米粒、双卡选择、按钮按压；不是截图拼接 |
| [recording.json](recording.json) | Chrome / RTX 4060 D3D11 | 录屏操作时间点、GPU、帧采样及编码记录；录屏光标是测试页标记，无音轨 |
| `chrome-selected-DEEPSEEK.png`、`chrome-selected-HUMAN.png` | Chrome / 1920×1080 | 两种阵营持续选中状态，鼠标已离开卡片 |
| 对应 `msedge-selected-*.png` | Edge / 1920×1080 | 同上 |
| `chrome-DEEPSEEK-ready.png`、`chrome-DEEPSEEK-playing.png`、`chrome-DEEPSEEK-paused.png`、`chrome-DEEPSEEK-restarted.png`、`chrome-DEEPSEEK-returned.png` | Chrome / 1920×1080 | 首次教学/READY、WASD 后、暂停、重开、回菜单 |
| 同组 `chrome-HUMAN-*.png`、`msedge-DEEPSEEK-*.png`、`msedge-HUMAN-*.png` | 对应浏览器 / 1920×1080 | 两阵营 × 两浏览器完整流程证据 |
| `chrome-audio-settings.png`、`msedge-audio-settings.png` | Chrome / Edge / 1920×1080 | 真实音量/静音面板 |
| `chrome-dynamic-*.png`、`msedge-dynamic-*.png` | 两浏览器 / 四种桌面尺寸 | 动态开启、鼠标位于右上时的窗口调整检查 |
| `all-motion.png`、`msedge-all-motion.png` | 两浏览器 / 1920×1080 | 四类效果开启时的全景 |

完整操作断言：[Chrome](chrome-final-results.json)、[Edge](msedge-final-results.json)；动态/生命周期：[Chrome](motion-results.json)、[Edge](msedge-motion-results.json)。以上均是本轮新运行文件。`baseline.json` 仅为复制的历史保护基线，不是本轮实拍证据。最初 `chrome-failed-results.json` / `chrome-failure.png` 保留为台架诊断：CSS 合法的 `scale:none` 被新脚本误判为非 1，修正脚本后两浏览器重跑通过，没有因此修改页面。

## B. 静态与参考图差异

实际参考为 `docs/verification/opening-static/reference.png`，1768×890；同尺寸并排与本轮 1920/1366 截图均已打开检查。**不计算或宣称某个还原百分比**。

| 元素 | 本轮观察 / 与参考仍存在的差异 |
| --- | --- |
| 标题 | 保留深墨标题、金黄“米”、英文副标题及纸条构图。重建素材的笔刷细节、米粒和纸边不等于原参考逐像素复制；本轮没有再改标题。 |
| 原角色 | 实际加载 `deepseek-normal.png`（1024×1536）与 `human-guardian-v1.webp`（768×1152），`object-fit:contain`；SHA-256 与阶段 C/原图一致，没有替换、拉伸或裁出新角色。参考剪影边界与当前 DOM 图框不可直接等同；姿态由原立绘决定。 |
| 蓝黄卡片 | 蓝左黄右、原倾斜方向、人物突破边缘均保留。水彩纹理、纸张缺口及米桶/盾牌等重建装饰不完全相同；没有因 D 而重新布置。 |
| 文字标签 | DOM 字形、字距与参考绘制字不完全相同；四组纸条的局部缺口、口号笔迹和留白并非原图复制。这是已验收静态方案差异，不在 D 擅改。 |
| 开始按钮 | 黄色手绘底、居中位置及箭头保留；箭头字形、底图刷口与参考不同。未选阵营时有现有“先选择你的阵营”提示，参考没有该行。 |
| 设置栏 | 右上横向胶囊及声音/难度功能保留。原生 DOM 图标、分隔线、下拉箭头与参考有细节差异；不遮角色或标题。 |
| 背景 | 保留实时 Three.js 原场景，建筑/道路实际排布、相机涵盖范围与参考画不是同一张背景；当前更清楚地看到原篮球场、房间等。没有为追相似度换背景。 |
| 比例与页脚 | 1920×1080 比参考更高，按钮和人物间的垂直留白不同；页脚保留完整原免责声明，文字更密且小，不等同参考短文案。 |

1920×1080 的实际 DOM 矩形如下，含图片透明留白，不冒充不透明绘制边界：

| 元素 | x / y / 宽 / 高（px） |
| --- | --- |
| LOGO | 49.91 / 41.03 / 777.59 / 313.63 |
| DeepSeek 卡片 | 410.88 / 340.19 / 608.45 / 513 |
| Human 卡片 | 1086.52 / 350.98 / 553.16 / 513 |
| 开始按钮 | 729.59 / 881.27 / 460.80 / 140.39 |
| 设置栏 | 1464.97 / 34.55 / 428.16 / 66 |

[protection-and-layout.json](protection-and-layout.json) 对四种桌面尺寸逐项比较阶段 B 既有矩形，位置/宽高差全部为 0；Chrome 与 Edge 对应矩形相同。25 项来源摘要中，运行时代码、原立绘和美术未变化；只有两条验收脚本因支持独立输出目录而改变。正常全景与四角未观察到明显露白、异常裁切、遮脸或永久 UI 位移。

## C. 本轮修改文件

**没有修改游戏运行时源码、CSS、原始素材或现有单元测试。** 未发现需要在本轮修复的运行时阻断缺陷；按最小改动原则不做美化重构。

| 文件 | 原因 |
| --- | --- |
| 新增 `scripts/verify-opening-final.mjs` | 四桌面尺寸、100% 视口、键盘/快速选择、设置、独立开关、离窗、原生最小化尝试、双阵营 WASD/继续/重开/返回取证 |
| 新增 `scripts/summarize-opening-final.mjs` | 保护摘要、B 几何回归比较、参考与实拍等尺寸拼排 |
| 修改 `scripts/verify-opening-motion.mjs` | 仅增加 `OPENING_ARTIFACT_DIR` 输出目录参数；不覆盖 C 证据，原断言和阈值不变 |
| 修改 `scripts/record-opening-motion.mjs` | 同上，并修正控制台实际输出路径；录制实现不变 |
| 新增本目录 | 本轮 PNG、真实视频、JSON、命令日志与报告；不删除既有证据 |
| 更新 `docs/DEEPSEEK_HANDOFF.md`、`docs/OPENING_UI_RECONSTRUCTION_PLAN.md` | 精简当前 D 状态和报告链接，不改写 B/C 历史 |
| 追加 `docs/AGENT_LOG.md` | 只在末尾写入本轮事实；`AGENTS.md` 未改 |

工作区还保留开工前 B/C 与其他既有改动，不能把 `git diff` 全部算成本轮 D 修改。

## D. 实际动态参数与关闭方法

唯一参数入口：`src/three/MenuAtmosphereView.ts` 顶部 `MENU_MOTION`，本轮未调整这些数值。

| 配置 | 当前值 / 单位 |
| --- | --- |
| `enabled` | `true`；改为 `false` 一键关闭全部开屏动态，直接显示原静态图 |
| `parallax.enabled`、`foliage.enabled`、`rice.enabled`、`interaction.enabled` | 四项独立开关；单关 wind 时仍可有前景视差，不是关闭整个叶层 |
| `parallax.sceneMaxPx` / `foliageMaxPx` | 12 / 16px，径向上限，核心 UI 为 0px |
| `parallax.smoothingAt60Fps` | 0.06，按 delta time 换算插值，不逐帧累加相机位置 |
| `foliage.angleDeg` / `driftPx` / `periodsSec` | ±1.1° / 横向3px、纵向系数0.6 / 6.4与7.7秒，带慢包络和错相 |
| `rice.count` / `minLifeSec` / `maxLifeSec` | 固定池14 / 6～10秒 |
| `rice.minLengthPx` / `maxLengthPx` | 3～6.5px；细尖米粒，不是圆点 |
| `interaction.durationMs` / `pressMs` / `selectionMs` | 230 / 90 / 340ms |
| `cardLiftPx` / `cardScale` / `selectionScale` | 5px / 1.015 / 1.025 |
| `buttonLiftPx` / `buttonScale` / `pressScale` | 3px / 1.012 / 0.985 |

交互样式在 `src/opening-menu.css` 末尾，用独立 translate/scale 不覆盖原纸片角度；卡片按住的 `.995` 为该 CSS 现有值。参数中的交互尺寸/时长在 View 构造时写成 CSS 变量，修改它们后刷新页面。米粒池数量同样在构造时建立；不要仅在调试页热改 `count` 就期望重建池。

ThreeGame 原循环更新 View，没有新增无限 rAF。进入正式流程停用，返回复用，dispose 移除装饰和监听。`prefers-reduced-motion: reduce` 在真实媒体模拟下停用动态，原静态内容仍完整；不是仅以源码字符串作证明。

## E. 实际检查结果

四条完整工程命令及输出见 [gates.json](gates.json)、`tests.log`、`types.log`、`build.log`、`diff.log`。均为本轮重新执行，不沿用 C 的测试数字。

| 检查 | 结果 |
| --- | --- |
| `npm test` | 1092/1092，失败/取消/跳过 0 |
| `npx tsc --noEmit` | 退出 0 |
| `npm run build` | 退出 0，138 modules；保留原 chunk >500kB 警告，未降低限额或隐藏警告 |
| `git diff --check` | 退出 0；有原工作区 LF→CRLF 提示，不是空白错误 |
| Chrome / Edge 四种桌面尺寸 | 1920×1080、1768×890、1600×900、1366×768 全部检查；主要控件均在视口、无横向溢出，原图 contain |
| 中心/四角视差 | 两浏览器均通过，四角约±8.49px/轴、径向不超过12px；UI矩形/相机朝向不变，持续停留不累计漂移；真实鼠标离窗后回中 |
| 树叶 / 米粒 | 两组树叶在无鼠标输入时仍错相运动；Chrome可见采样11～14粒、Edge11～13粒，池始终14；视频可复核，不以截图冒充动态 |
| 卡片 / 按钮 | hover 实测卡片 1.015 / -5px；按压缩小；12次交替真实点击后仅一阵营选中，离开后 scale:none，无永久偏移；按钮在外松开不误开局 |
| 四项独立开关 / 总开关 / reduced-motion | 总关恢复原图；视差/风分别关闭，米粒及交互标记关闭；低动态时钟停止、canvas隐藏，恢复后重启 |
| 设置 | 五路音量存在，主音量37%与静音真实写入，简单/普通/困难逐档选择可用，互斥面板正常 |
| 两阵营 × 两浏览器 | 原生 Space/Enter 仅选择；真实 Start→READY→教学（每浏览器首次）→PLAYING→WASD位置确实变化→暂停→继续→暂停→重新开始→READY→PLAYING→暂停→返回菜单通过 |
| 加载门禁 / 重复开始 | 未就绪权威夹具拒绝开始；正常就绪可开局；旧按钮重复点击不能重开。观察句柄只在隔离页注入，生产入口未加调试全局 |
| 生命周期 / 90秒观察 | 当前最终运行时代码 Chrome 连续90秒：菜单节点133、文档节点1440、监听187、geometry1165、texture15、米粒14前后一致；GC后JS堆约30.08→30.15MB，短时结果不证明数小时绝无泄漏 |
| Edge稳定性 / dispose | 本轮Edge10秒观察与完整双阵营往返通过；dispose 后 pointerout 监听减少1，动态装饰移除 |
| 录屏性能 | 本机 RTX4060 硬件加速，录制期间实采约55fps；编码25fps不是运行帧率。不保证低配/全设备60fps；View调用抽样p95约0.1ms，非整帧耗时 |
| 浏览器异常 | 两套最终流程与动态主验收的资源/console/pageerror为空 |

## F. 未解决问题与限制（不隐瞒失败项）

1. **真实后台隐藏未验证**：两浏览器都尝试 CDP 最小化窗口，但无头上下文的 `document.hidden` 仍为 false，因此 `nativeBackground.verified=false`。不能把浏览器暂停绘制或脚本模拟当作实际隐藏。动态主脚本的 `visibilitychange` 分支仍用隔离页模拟验证停止/恢复，逻辑通过；有头窗口实际切后台/最小化/锁屏/系统休眠仍需人工补验。本轮不改操作系统或终止用户浏览器来绕过限制。
2. **额外硬件树叶像素探针有1项失败**：`OPENING_USE_GPU=1 node scripts/verify-opening-motion.mjs --leaf-proof` 退出1，阈值保持2/255。1920内部最大2；1768内部一个通道（1548,816）为3/255，外沿最大24/255。详见 [leaf-hardware-observation.json](leaf-hardware-observation.json) 与 `leaf-original-*.png` / `leaf-split-*.png`。这是隔离原合成图与两张裁分副本的GPU透明/边缘采样差异，不是正常页面截图整体差异；不能声称逐像素相同。正常全景无明显露白/错位，master-off直接显示原单图。没有为造通过放宽阈值、删断言或改已验收素材；定为非阻断差异。
3. 树叶实际是左右两组复用合成素材，不是独立每片叶子；正交场景建筑统一屏幕平移，非透视镜头中逐栋建筑不同深度运动。两者是 C 的既有设计限制，D未扩大实现。
4. 原 chunk >500kB 警告仍在；没有以验收为由拆包或重构游戏。未做手机工程、Safari/微信、低配硬件长时/数小时/跨操作系统验收。声音设置状态已测，录屏无音轨，不能据此宣称音响听感验收。
5. 需要人工补验的唯一核心环境项是普通有头 Chrome/Edge 真实切后台与恢复。完成该项并决定接受上述像素采样差异后，可将技术结论更新为“通过”；Git Gate仍需另外获得提交/推送授权。本轮停止在本地交付，不自动发布网站。

## 复验入口

复用 `http://127.0.0.1:5173/`，配置本机 `PLAYWRIGHT_MODULE`（与对照工具所需 `SHARP_MODULE`）后：

```text
OPENING_ARTIFACT_DIR=<新的证据目录>
node scripts/verify-opening-final.mjs
OPENING_CHANNEL=msedge node scripts/verify-opening-final.mjs
OPENING_USE_GPU=1 MOTION_SOAK_MS=90000 node scripts/verify-opening-motion.mjs
OPENING_CHANNEL=msedge OPENING_USE_GPU=1 node scripts/verify-opening-motion.mjs
node scripts/record-opening-motion.mjs
node scripts/summarize-opening-final.mjs
```

以上是环境变量语义示意；PowerShell 用 `$env:变量='值'`，不直接照搬 shell 前缀。动态主脚本需要新目录中提供历史 `baseline.json`；它只用作保护对照。报告生成工具读取历史 B/C 基线，不将历史截图列成本轮实拍。

Git：仍在 `codex/opening-static-reference`；未暂存/commit/push/Tag/Release/部署。开工前没有合并/变基/挑拣状态，索引为空；复用本项目PID30400服务，未终止任何服务，未读取私人目录内容。现有阶段 B/C 的恢复材料与旧验证目录全部保留。
