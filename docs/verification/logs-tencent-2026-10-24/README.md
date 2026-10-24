# 日志统一入口与腾讯云目录更新 — 2026-10-24

## 本轮完成

用户确认Human持物位置调整可用，要求更新日志、统一分散记录入口、整理dist-tencent并推送GitHub。本轮基线main/HEAD/origin/main/远端一致（归档前历史点f769bb5be5e1e4952964fde43d8c4906a4cd4949），索引为空，无合并/变基；唯一已有源码修改是用户调整的ThrowableView。

- 保留用户数值：Human持物前距0.40/高度0.70世界单位；DeepSeek为0.60/0.55。只格式化用户新增段落，未再次改值；不改拾取范围、投掷起点/轨迹/碰撞/冷却或模型尺寸。tests/throwables补双阵营四朝向及系统状态不变检查。
- **统一阅读入口：[docs/README.md](../../README.md)**。汇总整理前已追踪的62份专项Markdown、主日志/交接/发布/历史QA阅读路线，明确27份本地原始.log只是命令输出。旧日志原文保留，不拼接为另一份重复历史，不移动证据破坏链接。
- docs/AGENT_LOG.md只追加本轮；HANDOFF保持当前简要状态，根README改为最新目录交付入口。旧发布记录、候选素材、场景.bak及无法确认用途的其他未跟踪材料保留，私人目录不读取/暂存。

## 本轮实际验证

| 检查 | 结果 |
| --- | --- |
| 持物定向测试 | 25/25，含新双阵营四方向验证 |
| npm test | 1127/1127，失败/取消/跳过0，66.26秒 |
| 独立tsc / 默认build / Tencent build | 均退出0，143模块 |
| npm audit --audit-level=high | 0漏洞 |
| 生产根路径 | Chrome154/Edge151各双阵营READY/教学/PLAYING/暂停返回、各16音频解码，102文件HTTP/字节核对，缺失URL404；无页面/必需资源错误 |
| 持物实际浏览器 | Chrome/Edge各Human和DeepSeek，共4组；通过原F拾取路径实测Human距离≈.40、高度.70，DeepSeek≈.60/.55，返回菜单通过，错误0 |

实际浏览器持物夹具只安排真实盒子在当前角色脚边，再按F拾取；不是自然跑完整局，也不是仅用截图估算距离。首轮此探针因5173服务停止连接失败，核对端口后启动本项目Vite，重跑通过；生产静态服务独立运行且通过。未隐藏失败或跳过测试。既有chunk>500kB和LF/CRLF提示保留；原生手机真机、云域名/缓存/MIME未在本轮验证。

### 本轮真实证据

- [Human持物Chrome](held/chrome-HUMAN.png)、[Human持物Edge](held/msedge-HUMAN.png)
- [DeepSeek保持原位置](held/chrome-DEEPSEEK.png)、[持物实测JSON](held/results.json)
- [Chrome生产开屏](production/chrome-production-menu.png)、[Edge生产开屏](production/msedge-production-menu.png)
- [Human生产入口](production/chrome-production-HUMAN.png)、[DeepSeek生产入口](production/chrome-production-DEEPSEEK.png)
- [生产浏览器检查](production/results.json)、[102文件路径/大小/SHA256](artifact.json)

## 直接上传的文件夹

`D:\桌面\dev\who-ate-my-rice\dist-tencent`

- 命令：`npm run build -- --base=/ --outDir dist-tencent`；base=/，102文件，共48,317,598字节。
- 入口资源：assets/index-SSy6slQe.js、assets/index-D9WnF5S0.css；包含最新Human持物调整，图片/音频/GLB逐字节审核，无开发地址/Pages子路径/意外配置。
- 原目录完整备份到本地dist-tencent-delivery/previous-before-human-hold-20261024-133705。没有删除原文件或覆盖旧ZIP，本次按用户实际上传方式交付文件夹，不再生成新的ZIP。
- 上传后网站根目录应直接看到index.html、assets/、maps/、ui/；若腾讯云保留外层dist-tencent，站点文档根目录需指向该文件夹内部，不能以/dist-tencent/子路径作为本包默认入口。

构建目录及备份继续被Git忽略，不把dist或私密配置推到GitHub。Git仅提交本轮源码、测试、文档与必要新证据。版本标识仍是RC2，但这是Tag之后的main修正，原v1.0.0-rc2快照和旧ZIP不含此调整，不移动Tag或创建新Tag/Release。

## Git与待办

本轮已获正常提交/推送授权，按明确路径审核和暂存；执行后的实际提交/远端核对另记回执，不提前声称成功。源码与目录准备不代表腾讯云已上线。本轮不触发Pages，不登录或改腾讯云配置；用户上传文件夹后仍需核验线上缓存及两阵营流程。

### 实际归档回执

2026-10-24正常提交并推送`35f1b0ad52bde1ce1f30f5f64261480b4cb37a5f`成功（17文件，fix: archive Human held prop tuning and unify project records），已核对origin/main一致。后续仅追加本回执文档；新dist-tencent源码对应此提交，目录内102文件/48,317,598字节清单不变。原Tag保留，不将新目录声称为原RC2 Tag快照。

构建目录继续本地保留，不纳入Git；原始日志、未知材料和未引用中间证据不提交或删除。最新main/远端落点通过Git查询，不在本文硬编码会自我过期的“当前SHA”。本地最终文件夹回执在dist-tencent-delivery/folder-receipt-2026-10-24.json。
