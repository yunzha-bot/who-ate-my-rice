# Human v2 游戏表现替换 — 2026-10-22

用户确认候选后授权替换旧 Human；本轮已在本地接入玩家和 AI 共用的角色表现层，等待用户游戏内观感确认。不创建骨骼、不改玩法，不提交、推送或部署。

## 实现与保护范围

- 将候选 `incoming-assets/human-v2/r03/human_static.glb` 原样复制为 `public/assets/characters/human/human_v2.glb`，398148字节；候选、public及本轮dist副本SHA256一致。
- `HumanGlbModel.ts` 一次下载、独立克隆实例，按共享材质集合释放资源；使用Vite BASE_URL，支持根路径和仓库子路径。
- `CharacterActionView` 对Human接线；沿用HomeAvatar的朝向、实际位移驱动步态与动作状态。新模型无骨骼，按现有解剖分组建立刚性肩/髋枢轴，提供走/跑摆臂迈步、交互抬臂、原摔倒姿态；旋转鞋底及摔倒表现做接地修正。不是制作新的骨骼动画或改变移动规则。
- GLTFLoader会移除节点名中的句点，初次定向发现Arm.L匹配失败，已使用Three.js原生sanitizeNodeName匹配，不修改原GLB。测试保留实际模型解析覆盖。
- 相消原HomeAvatar非等比父缩放，再按旧Human表现的实际高度等比适配；新模型不做呼吸拉伸。角色代理的位置、几何体、缩放、碰撞与控制仍由原游戏负责。
- 原程序化Human保留作回退。资源失败需通过原加载界面明确选择简化模式；简化同时作用于两阵营，迟到下载不再替换。READY、教学、难度、HUD、开屏原立绘/布局和游戏数值不改。

## 本轮文件

| 文件 | 本轮内容 |
| --- | --- |
| public/assets/characters/human/human_v2.glb | 新运行时模型副本；未覆盖候选工程 |
| src/three/HumanGlbModel.ts | 新加载、资源释放及刚性分组姿态 |
| src/three/AlphaPresentation.ts | 等比适配Human、复用步态、接地/复位/释放；DeepSeek保持原接线 |
| src/three/CharacterActionView.ts | Human异步加载及销毁/简化竞态保护 |
| src/three/ThreeGame.ts | 仅补Human的显式简化入口；其他差异是本轮前已有修改，保留 |
| scripts/verify-pages-build.mjs | 严格产物白名单加入Human并要求打包引用，未改工作流或审核门禁 |
| tests/pages-deployment.test.mjs | BASE_URL与完整产物白名单回归 |
| tests/human-glb.test.mjs | 新模型原样性、缓存/释放、比例/步态/接地、异步取消与失败重试 |
| scripts/verify-human-v2.mjs | 真浏览器玩家/AI、READY/暂停/重开/返回、加载失败回退检查 |
| docs/DEEPSEEK_HANDOFF.md、docs/AGENT_LOG.md、候选README及本目录 | 当前交接、追加日志与本轮证据；不改历史日志 |

没有删除文件；原已有其他源码、文档、未跟踪验证资料和私人目录未清理、未暂存。

## 实际测试

| 检查 | 本轮最终结果 |
| --- | --- |
| Human定向 | 5/5；含实际GLB解析、共享资源释放一次、walk/run鞋底接地、FALL/STUN/恢复接地与不改变代理 |
| npm test | 1121/1121，失败/跳过/取消0，最终约62.32秒；不是沿用前轮1116 |
| npx tsc --noEmit | 通过 |
| npm run build | 通过，143模块；保留既有大于500kB的chunk警告 |
| git diff --check | 通过；既有LF/CRLF提示保留 |
| Chrome / Edge开发页面 | 两浏览器各双阵营，共4条READY→PLAYING→暂停→继续→重开→返回；玩家真实键盘移动、Human AI步态、暂停冻结、模型UUID复用/单实例、一次下载通过，pageerror 0 |
| 加载失败 | 两浏览器各模拟Human404；保持加载门禁，明确选择简化后进入菜单、旧模型可见，无pageerror |
| 根路径生产预览 | 两浏览器各双阵营开局/返回；100文件HTTP字节核对、16项音频各自解码通过，无资源错误；模型进入dist且与候选字节一致 |
| Pages | 单元测试验证根/子路径URL及严格白名单；本轮未运行Pages构建、工作流或部署 |

## 实际浏览器证据

最终开发验证见 [verified/results.json](verified/results.json)，Chrome 154.0.8037.100、Edge 151.0.4129.86，视口1600×900，加载失败页面1366×768：

- [Chrome Human玩家实景](verified/chrome-HUMAN-playing.png)、[原生局部截图](verified/chrome-human-detail.png)、[DeepSeek阵营实景](verified/chrome-DEEPSEEK-playing.png)、[返回菜单](verified/chrome-returned-menu.png)。
- [Edge Human玩家实景](verified/msedge-HUMAN-playing.png)、[原生局部截图](verified/msedge-human-detail.png)、[DeepSeek阵营实景](verified/msedge-DEEPSEEK-playing.png)、[返回菜单](verified/msedge-returned-menu.png)。
- 根路径生产1920×1080：[Chrome Human](production/chrome-production-HUMAN.png)、[Edge Human](production/msedge-production-HUMAN.png)、[实际生产验证记录](production/results.json)。未调整相机、缩放或瞬移角色来获取这些画面；原生局部图仅从实际画面截取。
- 根目录及final子目录保留此前本轮复验截图；包含故障回退的最终完整操作以verified为准。静态截图不能单独证明动画，动态结论依据真实键盘、逐时姿态/位置与暂停冻结断言，不以静态图冒充录屏。

## 限制与下一步

- 仍是刚性分组程序化动作，没有骨骼/蒙皮或正式动画片段。未另开发投掷专用动作；沿用原玩法与朝向。
- 新头发和衣服沿用用户确认的候选，不改其造型；复杂近景、逐动作美术质量与低端/手机真机FPS仍待用户体验。未把本轮扩展成模型重绘、全面动画制作或性能工程。
- 默认dist已重建；旧dist-tencent未更新，不能把它当作本轮新模型部署包。没有触发Pages、上传腾讯云或线上资源替换。
- 工作区保留原改动，暂存区为空；没有commit/push/tag，未记录Gate PASS。刷新本地页面即可检查新Human，后续骨骼/动画另行授权。
