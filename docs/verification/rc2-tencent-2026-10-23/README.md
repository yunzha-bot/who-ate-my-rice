# RC2 工程归档与腾讯云上传包 — 2026-10-23

## 范围与整理

用户批准归档现有改进、正常commit/push与v1.0.0-rc2 Tag。归档前本地HEAD、origin/main和远端main均为历史检查点a3ea62f6b55c0602a5f6135408f65fb12a0af590；无合并/变基/挑选进行中，索引为空。RC1 Tag解引用仍为870c69050cf80ff83aa79531e7d9f2590a8834d5，Release ID414708471保留。

目录职责不变：src源码、public运行资源、tests回归、scripts验证、docs文档/证据、incoming-assets候选材料。没有为整洁搬动/删除源码、原图或备份。仅将旧dist-tencent完整移入本地dist-tencent-delivery/previous-before-rc2-20261023-215240，再重建。版本与lockfile同步rc2，修正1.35注释，同步README/交接/索引/素材记录，日志只追加。

归档包含既有手机操作/波纹、默认键位不变的自定义设置、街道视觉、Human v2与新立绘、正常缩放、双卡居中/直接开局。[审核文件清单](reviewed-files.json)。只提交相关报告明确引用的必要截图/JSON及本轮代表证据，不批量加入整个验证目录。

未提交：私人目录（未读取内容）、incoming-assets中的Blender工程/候选素材、地图*.bak、无法确认用途的旧验证材料、未引用中间截图/原始录屏、依赖缓存及dist/、dist-tencent/、dist-tencent-delivery/与ZIP。均本地保留未删除。两个Tencent目录的忽略规则属此前部署准备，不扩大忽略原始材料。

## 本轮实际结果

| 项目 | 结果 |
| --- | --- |
| npm test | 1126/1126，失败/取消/跳过0，66.16秒 |
| 独立tsc / 默认build | 退出0；143模块 |
| Tencent build | `npm run build -- --base=/ --outDir dist-tencent`，退出0；143模块 |
| npm audit --audit-level=high | 0漏洞 |
| git diff --check | 退出0；LF/CRLF提示保留 |
| 生产根路径 | 102文件HTTP200且字节相同，缺失URL404；Chrome154.0.8037.100/Edge151.0.4129.86各双阵营READY/教学/PLAYING/暂停返回，各16音频解码，错误0 |
| 手机/桌面 | 两浏览器667×375/844×390×两阵营及桌面键鼠共10项通过；触摸含多指、投掷/取消、技能、暂停、旋转、结果、重开及返回 |
| 键位设置 | Chrome/Edge冲突/取消/持久化/重置、双阵营真实技能、HUD及教学通过 |
| 窗口/缩放 | 22组宽高比/边界/居中；14组25/50/100/125/150/200/300%等效缩放，28条双阵营流程通过，错误0 |
| 包与安全 | 精确public清单/哈希，无开发地址/Pages子路径/意外私密配置；六旧模型只过滤构建副本；ZIP102项SHA256一致 |

既有chunk>500kB提示未隐藏。等效缩放是CSS视口+DPR，不冒充工具栏实测；触摸模拟不是手机真机/Safari/微信。素材来源仍依原始记录管理，依赖审计/密钥扫描不等价于版权审核。

### 本轮实际证据

- [Chrome生产开屏](production/chrome-production-menu.png)、[Edge生产开屏](production/msedge-production-menu.png)
- [Human入口](production/chrome-production-HUMAN.png)、[DeepSeek入口](production/chrome-production-DEEPSEEK.png)
- [生产浏览器结果](production/results.json)、[102文件清单/哈希](artifact.json)
- [手机/桌面结果](mobile/results.json)、[浮动摇杆](mobile/chrome-667-HUMAN-floating-stick.png)、[多指投掷](mobile/chrome-844-DEEPSEEK-aim-multitouch.png)
- [键位结果](keyboard/results.json)、[按键设置](keyboard/chrome-settings.png)
- [22组窗口结果](layout/results.json)、[1366×768](layout/chrome-1366x768-4.png)
- [等效缩放/28条流程](zoom/results.json)、[125%](zoom/chrome-125-menu.png)、[200%](zoom/chrome-200-menu.png)
- [Human结算截图](../human-report-2026-10-23/chrome-HUMAN-HUMAN.png)来自紧接本轮之前的专项检查，不冒充本轮新对局；生产新PNG哈希已重新确认。

## 腾讯云上传

- 目录：`D:\桌面\dev\who-ate-my-rice\dist-tencent`，base=`/`；102文件，48,317,553字节（约46.08MiB）。
- 资源：3 GLB、37 Ogg、2 MP3、38 PNG、15 WebP及JS/CSS/其他批准文件，地图配置随JS打包。
- 入口：assets/index-ByygXgFc.js（约1.23MB）、assets/index-D9WnF5S0.css（约87kB）；页面版本rc2已确认。
- ZIP：`D:\桌面\dev\who-ate-my-rice\dist-tencent-delivery\upload-tencent-v1.0.0-rc2-2026-10-23.zip`，45,161,202字节（约43.07MiB）。SHA256：`f29e9672a92b5c7c1b9fbcb57ff6382e65c20a9e862f9db1c579adde6b27403c`。

上传dist-tencent**内部全部内容**或解压ZIP至站点根层，直接出现index.html、assets/、maps/、ui/。不要套dist-tencent文件夹，不上传工程源码。旧ZIP保留，但不可用旧zoom-v2包代替此次rc2。

上传后验证HTTPS/域名根路径、JS/CSS/GLB/音频MIME和404、手机横屏、缓存与网络音频限制。本轮未登录腾讯云或修改云配置；Pages工作流及approved_sha门禁不改，也不触发。

## Git与线上

按明确文件路径暂存并复核，不使用add .或-A，不强推/改历史。执行后的完整提交SHA、远端与Tag结果另追加或写本地回执。既有Pages最近成功工作流38897897043，构建提交e9f361fce9dd5f392e2165ec2cf0b5f1148ed108（只读API查询）；不代表腾讯云上线或本次新部署。
