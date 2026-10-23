# Human 游戏内视觉尺寸调整 — 2026-10-23

用户反馈游戏内Human太小。本轮仅把新Human GLB视觉等比放大25%，不改开屏立绘、相机、模型文件、角色代理、碰撞、移动、抓捕范围或其他玩法数值。

## 修改

- `src/three/AlphaPresentation.ts`：增加纯表现常量`HUMAN_GLB_SIZE = 1.25`，在原`HomeAvatar.useExternalVisual`统一适配入口使用。玩家和AI共用；保留原父缩放抵消及脚底定位，不缩放actor。
- 原运行时静止高度约1.495725，调整后约1.869656（与DeepSeek约1.8711接近）。原GLB文件本身高1.507275不等于适配后的旧运行时高度；本轮没有修改GLB字节或重新建模。
- `tests/human-glb.test.mjs`：先用实际GLB建立25%放大断言并观察失败，再修复。继续验证原始宽高比例、走跑鞋底、FALL/STUN恢复、reset保留尺寸、actor几何/缩放和资源生命周期。
- `scripts/verify-human-v2.mjs`：实际测量世界高度及脚底，支持`HUMAN_EXPECT_HEIGHT`验证值，增加双阵营READY截图；原主流程和加载失败回退检查不变。
- 更新HANDOFF，AGENT_LOG只追加；保留所有既有资源/源码改动/验证资料，无新运行依赖。

## 实际验证

| 检查 | 本轮最终结果 |
| --- | --- |
| Human/表现定向 | 23/23；最初预期放大断言失败，实施后通过 |
| npm test | 1125/1125，失败/取消/跳过0，约62.69秒 |
| npx tsc --noEmit | 通过 |
| npm run build | 通过，143模块；原>500kB chunk警告保留 |
| git diff --check | 通过，原LF/CRLF提示保留 |
| Chrome/Edge真实浏览器 | 各双阵营共4条：READY冻结、PLAYING、Human真实键盘移动/AI步态、暂停继续/重开/返回；同一模型UUID、单实例、一次请求、actor缩放[1,1,1]通过，无pageerror |
| 实测尺寸与接地 | 两浏览器/两阵营READY高度均1.869656216，脚底y约5.96e-9（浮点误差），通过1e-5阈值 |
| 资源失败回退 | 两浏览器模拟Human404，原加载门禁及显式简化入口通过，无脚本异常 |

浏览器初次验证把原文件高度误当运行时旧高度，预期设为1.88409375而实测1.869656216，断言失败；根据原运行时适配公式改正验证输入为1.86965625后重新完整通过，没有修改模型/放宽阈值来掩盖失败。根目录与`verified/`为中间失败运行，只以`final/`为本轮最终证据。

## 真实截图与复现

- [Chrome游戏内实景](final/chrome-HUMAN-playing.png)、[原生280×280局部](final/chrome-human-detail.png)、[Human玩家READY](final/chrome-HUMAN-ready.png)、[DeepSeek阵营中Human AI](final/chrome-DEEPSEEK-playing.png)。
- [Edge游戏内实景](final/msedge-HUMAN-playing.png)、[原生局部](final/msedge-human-detail.png)、[READY](final/msedge-HUMAN-ready.png)、[Human AI](final/msedge-DEEPSEEK-playing.png)。
- [完整浏览器测量/结果](final/results.json)。视口1600×900，原相机构图与角色正常移动，没有为截图放大镜头或瞬移；局部图是实际渲染的裁取，不是放大处理。
- 使用现有Playwright环境变量`PLAYWRIGHT_MODULE`，设置`HUMAN_ARTIFACT_DIR`到新目录、`HUMAN_EXPECT_HEIGHT=1.86965625`后运行`node scripts/verify-human-v2.mjs`；复用127.0.0.1:5173服务，不使用用户浏览器配置。

无已知阻断问题，25%大小仍待用户观感确认；碰撞体不随美术扩大，模型轮廓可超出原碰撞圆，此为视觉与玩法分离的边界。没有重新验收真机/低端FPS或新骨骼动画。旧简化模型保持原大小。

默认dist已重建，dist-tencent未更新。没有暂存、提交、推送、Tag/Release或部署，不记录Git Gate PASS。下一步刷新游戏并重新开局确认大小，不自动扩大到玩法调整。
