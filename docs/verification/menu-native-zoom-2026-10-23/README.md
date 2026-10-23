# 开屏正常浏览器缩放与腾讯云v2包 — 2026-10-23

用户批准整套菜单随浏览器正常缩放，窄窗口重排/滚动。本轮基于已有未提交工作区实施，没有更换素材、修改玩法或重新设计界面。100%保留现有1920×1080构图，放大后不再强行将整套菜单缩回视口。

## 实现与调整位置

`src/opening-menu.css` 是本轮唯一运行时修改。旧变量名 `--menu-vw` 为兼容既有规则保留，但桌面值现在固定为 `1.2rem`，不再由vw/vh计算；标准16px根字号时等于19.2px。卡片内部cqw让文字、纸底和人物保持比例；未添加JS缩放补偿、CSS zoom或根容器scale。

- 双卡区域宽76.8rem≈1228.8px，高32.0625rem=513px；左侧位置用clamp限定在窗口内。1920基准标题、两卡、人物框、设置栏与此前浏览器矩形逐项差异小于1px。
- fine pointer桌面视口1280px及以上双列；1279px及以下单列。蓝卡上限约608.46px，Human宽为蓝卡的10/11，各自保持608.457143/513与553.142857/513宽高比。只有窗口连一张完整卡都放不下时才等比收窄。
- 单列标题和设置分行；479px及以下设置栏内部也分行。留出人物超出纸卡的上下空间，页脚跟随可滚动内容，避免角色脚部被页脚压住。
- 设置/弹层/页脚通过固定rem单位响应正常缩放；coarse pointer保留此前移动端专用vw与紧凑尺寸。背景、树叶、米粒和相机模块未改，继续铺满窗口。

放大后初屏可能无法一次显示所有人物和卡片，这是本轮获批的滚动布局；向下滚动可看到完整角色及第二张卡片。25%正常缩小也会使文字和卡片明显变小，不再维持相同物理大小。

## 真实浏览器证据与结果

使用已安装Chrome 154、Edge 151真实渲染，自动化以CSS视口+DPR模拟浏览器缩放的布局条件，**不是原生工具栏缩放实测**，也不使用CSS zoom。脚本及截图不会当作用户原生工具栏验收替代。

| 检查 | 本轮实际结果 |
| --- | --- |
| 缩放 | 两浏览器各100/125/150/200/300/50/25%，共14组；无横溢出、文字不溢出、人物contain、纸卡/人物框比例稳定；设置和制作信息可操作 |
| 字号 | 以干饭人身份文字为例，100%=19.1663物理等效px，125%=23.9579、150%=28.7495、200%=38.3326；300%窄窗口单卡轻收窄后约55.944。设置CSS字号约16px保持不变，物理字号随倍率放大 |
| 游戏流程 | 14组内两阵营共28条：滚动到卡片→点卡→READY→首次教学（出现时）→PLAYING→暂停→返回并清空选中；100%的Human还验证Enter开局。pageerror/HTTP错误为空 |
| 窗口 | Chrome/Edge共22组：1920×1080、1768×890、1266×1195、1366×768、1000×1000、2560×1080、1280×900、1279×900、640×900、455×768及回到1920；22组比例、边界、设置与两卡开始检查通过 |
| 触屏/桌面回归 | 667×375和844×390，双浏览器双阵营布局8组；桌面键盘/E开关门/鼠标投掷2组，总10项通过。是模拟触屏，不是真机，未重验全部手机手势 |
| Node测试 | 定向17/17；最终npm test 1125/1125，失败/取消/跳过0，约67.16秒 |
| 类型/构建 | 独立npx tsc --noEmit、默认npm run build、独立Tencent根路径构建均退出0，143模块；保留既有chunk大于500kB警告 |
| 生产包 | 101文件HTTP200与磁盘字节一致；Chrome/Edge各双阵营PLAYING/暂停返回、各16项实际音频解码通过，无pageerror/必需资源404 |
| 差异检查 | git diff --check退出0，保留既有LF/CRLF提示；未暂存、提交、推送、Tag或部署 |

截图：[100%](chrome-100-menu.png)、[125%](chrome-125-menu.png)、[150%](chrome-150-menu.png)、[200%初屏](chrome-200-menu.png)、[200%滚动至Human](chrome-200-scrolled-human.png)、[300%滚动至Human](chrome-300-scrolled-human.png)。对应msedge截图同目录。

结果：[缩放14组/28流程](results.json)、[窗口22组](aspects-final/results.json)、[触屏/桌面10项](touch/results.json)、[生产根路径验证](tencent/browser/results.json)。[生产开屏](tencent/browser/chrome-production-menu.png)也是本轮新截图。

复验缩放使用 `scripts/verify-menu-zoom.mjs`，设置PLAYWRIGHT_MODULE、MENU_ZOOM_ARTIFACT_DIR；可选MENU_ZOOM_BASELINE_FILE指向旧browser-results.json以对照1920基准。使用已有本地5173服务，不读用户浏览器配置或持久化偏好。其他原有验证脚本入口不变。

## 最新腾讯云部署包

文件夹：`D:\桌面\dev\who-ate-my-rice\dist-tencent`；base=/，101文件、46,167,333字节。[文件清单与SHA256](tencent/artifact.json)。HTML引用新assets/index-C43BBjrw.css与assets/index-W1vXYFaF.js，模型/音频/地图遵循原构建方式。

上传ZIP：`D:\桌面\dev\who-ate-my-rice\dist-tencent-delivery\upload-tencent-2026-10-23-zoom-v2.zip`，43,072,103字节（约41.08MiB），SHA256：`029edddee2b28bf93c4c7ca97a0980e1ae7e1b78d443e3b40b390919c51443dd`。ZIP内101文件已逐一解压读取并与manifest的SHA256相同。

上传ZIP，或上传dist-tencent内部全部内容，使根层直接有index.html、assets/、maps/、ui/。不要再套一层dist-tencent，也不要上传工程、候选素材和备份。原upload-tencent-2026-10-23.zip仍保留；修改前完整dist-tencent位于dist-tencent-delivery/previous-before-zoom-2026-10-23-185130。

默认dist也已重建。所有构建基于当前含本地变更的工作区，不冒充已经提交到Git。未触发Pages或改动其工作流，不上传腾讯云。

## 本轮文件与限制

- 运行时：src/opening-menu.css。
- 验证：tests/menu-responsive.test.mjs；scripts/verify-menu-zoom.mjs改为正常缩放/滚动/真实双阵营流程，删除对已移除开始按钮的空引用；verify-menu-aspect.mjs补边界尺寸；verify-opening-final.mjs允许已授权的纵向滚动，不再要求所有元素一屏可见。本轮未重跑整套历史D脚本，其语法检查通过。
- 文档：根README、docs/README、DEEPSEEK_HANDOFF、OPENING_UI_RECONSTRUCTION_PLAN、AGENT_LOG追加及本报告；旧Tencent报告加后续版本入口，历史记录及旧证据保留。

原生工具栏缩放、用户实际内置面板和手机真机仍待复核；大倍率需滚动是预期行为。线上HTTPS/MIME/缓存/访问权限尚未验证。Git与Tag继续暂缓，Tag名尚未确定，不记Gate PASS。下一步用户刷新本地页面进行实际缩放验收，再决定Git归档；无自动部署。
