# 腾讯云最新版工程整理与上传包 — 2026-10-23

后续版本提示：本页记录缩放优化前的包，原ZIP与哈希仍保留有效。最新正常缩放版本请使用 [zoom-v2交付](../menu-native-zoom-2026-10-23/README.md)，不要将本页旧ZIP当作最新包。

本轮仅完成安全整理、最新生产构建、本地验证和交付；没有上传、部署或触发Pages。构建包含当前工作区尚未提交的改动，不将Git HEAD当作全部新功能的快照；版本标识仍为v1.0.0-rc1。

## 上传哪个文件

- 文件夹：`D:\桌面\dev\who-ate-my-rice\dist-tencent`，上传其内部全部内容。
- ZIP：`D:\桌面\dev\who-ate-my-rice\dist-tencent-delivery\upload-tencent-2026-10-23.zip`，43,071,853字节，约41.08MiB。
- ZIP SHA256：`691e14f29a614375530ad00d90e032411d464144ad1d2626fdc764865d69c454`。101个文件逐一解压读取并核对SHA256，与构建清单一致。

网站根目录必须直接是：

```text
index.html
assets/
maps/
ui/
```

控制台若接收ZIP，选择上述upload包；若要求目录，选择dist-tencent。不要上传工程根、旧备份、src、node_modules、docs、incoming-assets、Git或私人配置。不要把dist-tencent文件夹再套进网站根。index.html与带哈希的JS/CSS需一并更新；上传后再确认线上页面、模型、音频、MIME和缓存。

## 工程整理前后

| 目录 | 本轮处理 |
| --- | --- |
| src、public、tests、scripts | 原结构保留；新增scripts/verify-tencent-build.mjs作根路径产物安全审查，不改游戏源码 |
| docs、archive、incoming-assets、地图备份、历史验证 | 保留全部资料，不移动未知用途文件；更新文档职责与部署入口 |
| 原dist | 101项文件SHA256前后完全相同 |
| 昨日dist-tencent | 完整移动至dist-tencent-delivery/previous-2026-10-23-160909，可恢复旧包 |
| 新dist-tencent | 独立重新构建，禁止混入旧哈希JS/CSS；没有沿用昨天包 |
| dist-tencent-delivery | 新建本地产物/备份目录，精确加入gitignore防止误提交；包含旧包与本轮upload ZIP |

根目录design-qa.md及历史文档保留，避免破坏旧引用；没有批量删除或源码重构。私人目录未读取、修改或暂存。

本轮文字修改：README.md、docs/README.md、docs/DEEPSEEK_HANDOFF.md、docs/AGENT_LOG.md（仅追加）、.gitignore；新增本报告、产物清单和浏览器证据。Git索引为空，已有源码/测试/素材与验证材料的本地变更全部保留，本轮不提交Git。

## 构建与资源审查

```sh
npm run build -- --base=/ --outDir dist-tencent
node scripts/verify-tencent-build.mjs
```

base=`/`，101文件、46,166,103字节，约44.03MiB。[完整路径、大小及SHA256](artifact.json)。资源包括：

- assets/index-BVkaCghB.js、assets/index-DAuUbteC.css和index.html。
- 三个GLB：DeepSeek v6、Human v2、米袋；旧六个DeepSeek模型仍只在本机原public保留，不进入构建。
- 37 Ogg + 2 MP3，37 PNG + 15 WebP + 1 SVG；含原样米白卫衣新立绘。
- 地图/家具/投掷物/灯位JSON由原模块打入JS，maps/ui占位及原说明按既有公开清单保留。

审查以Git追踪public清单加两项明确审核的新Human资源为允许范围，不自动放行其他未追踪文件。所有静态文件与原public逐字节一致，没有意外文件、软链接、硬链接、源码/缓存/私人目录、环境文件或源码映射。JS/CSS未发现Pages子路径、开发服务器/DEV接口、旧模型引用或高置信度Token/私钥/本机私人路径特征；没有改Pages工作流或原Vite/package配置。

## 本轮实际检查

| 项目 | 结果 |
| --- | --- |
| npm test | 1125/1125，失败/取消/跳过0；约56.71秒，本轮重新执行 |
| 独立npx tsc --noEmit | 退出0 |
| 腾讯云生产构建 | 退出0，143模块；既有chunk大于500kB警告保留 |
| 产物/ZIP | 101项允许清单及public哈希通过；ZIP101项字节核对通过 |
| Chrome/Edge真实生产页面 | 1920×1080；各双阵营点卡直接开局、教学/PLAYING、暂停返回通过；各16项实际请求音频解码通过；pageerror/必需资源404为空 |
| HTTP | 101个产物逐个HTTP200并与磁盘字节相同；缺失URL返回404 |
| 其他检查 | npm audit --audit-level=high：0漏洞；git diff --check退出0，仅既有LF/CRLF提示；Pages/Vite/package配置差异为空 |

浏览器通过临时本地静态服务器验证dist-tencent，服务器随后自行关闭；没有操作腾讯云或线上域名。首次ZIP校验时PowerShell默认JSON解析不支持无扩展名统计的空键，改用-AsHashtable成功完成相同逐项校验，未重建/覆盖ZIP或跳过检查。

证据：[Chrome开屏](browser/chrome-production-menu.png)、[Edge开屏](browser/msedge-production-menu.png)、[DeepSeek实局](browser/chrome-production-DEEPSEEK.png)、[Human实局](browser/chrome-production-HUMAN.png)、[双浏览器实际结果](browser/results.json)。复验使用既有verify-pages-preview.mjs，但显式设置PREVIEW_ROOT=dist-tencent、PREVIEW_BASE=/；工具名称不代表触发Pages。

## 未解决项与交付边界

尚未验证腾讯云线上HTTPS、域名、MIME、缓存、访问权限和手机真机；本地通过不能代替线上检查。大JS包首次加载开销仍在。当前工作区改动未建立新Git检查点，旧RC Tag/Release不变。没有新增玩法、美术或部署设置。

按ponytail技能复用原构建与静态浏览器工具，仅新增所需根路径审查，没有引入依赖或重构游戏。下一步由用户手动上传本轮ZIP或dist-tencent内部全部文件。
