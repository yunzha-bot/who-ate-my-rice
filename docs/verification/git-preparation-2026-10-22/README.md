# Git 归档与部署前检查（2026-10-22）

## 范围与工程整理

用户授权正常提交、推送 main；不授权部署、Tag、Release 或历史重写。已验收开屏是手机改动的实际依赖，一并归档，不重新设计。

整理前后工程主目录不变：`src/` 运行源码、`public/` 资源、`tests/` 自动化、`scripts/` 验证工具、`docs/` 文档与必要证据、`archive/` 恢复材料、`.github/` 手动部署流程。新增 `docs/README.md` 统一职责索引，修正根 README 的操作、环境、RC 与部署说明；没有移动或删除文件，没有修改 HUD 主题、玩法数值、地图或原立绘。

仅兼容修复开发依赖：Vite 6.4.3 → 锁定安装 6.4.5（声明最低修复版 ^6.4.4）、source-map-js 1.2.1 → 1.2.2。保留原技术栈；本轮重新执行安全审计。

## 保留但不提交

私人目录 `.codex/`、`.trae/`、`.dsh-meow/` 不读取、不暂存；incoming-assets、地图 `.bak`、其他历史未跟踪验证材料完整保留。dist、node_modules、缓存、原始临时模型不加入 Git。各历史报告只提交明确链接的必要证据，其他原始输出仍留本地。

## 验证与提交

执行结果由本目录后续记录及 `gates.json`、浏览器结果、文件审核清单提供。本报告不将历史测试数字冒充本轮结果。原始命令日志留本地，不作为仓库可下载材料。

### 本轮实际结果

| 检查 | 结果 |
| --- | --- |
| npm test | 1097/1097，失败/取消/跳过 0 |
| 相关定向测试 | 75/75，HUD、投掷、教学、开屏与 Pages 回归 |
| 独立 tsc / 默认生产构建 | 退出 0；138 模块，保留 chunk >500 kB 警告 |
| Pages 子路径生产构建 | 退出 0，资源使用 /who-ate-my-rice/ |
| npm audit | 0 漏洞，详见 [审计结果](audit.json) |
| Chrome / Edge 触控及键鼠 | 新一轮 10/10，详见 [结果](browser/results.json)：两尺寸、双阵营、多指/取消/暂停/返回及桌面 E/鼠标 |
| 严格生产子路径浏览器 | 两浏览器双阵营开局/返回通过，每个浏览器解码16项音频，资源与 pageerror 为空，根资源路径返回404，不靠回退掩盖缺失，详见 [结果](pages/results.json) |
| 安全扫描 | 已选文件未发现密钥模式；不读取私人目录。历史日志路径按不可回改约束保留；不是“绝无秘密”的证明 |
| diff 检查 | 退出 0，原有 LF/CRLF 提示不是错误 |

Pages 白名单审查通过：[产物清单](pages-artifact.json)，99 个文件、44,306,332 字节；仅包含本轮构建入口与审核 public，正式 GLB 仍只有原有两项，未将旧模型/备份放进 dist。首次审查曾早于逐项暂存结束，因此拒绝尚未入索引的卡片资源；待清单暂存完成后重新审查通过，没有放宽门禁。

旧交接历史有两条指向仅本地历史材料的链接（DEEPSEEK_ANIMATION_STAGE4/README.md、HOME_GYM/REPORT.md），本轮不凭链接擅自发布这些未经归属审核的材料，清单明确记录；本次新增交付链接均有对应提交文件。

新实拍：[Chrome 生产开屏](pages/chrome-production-menu.png)、[Edge 生产开屏](pages/msedge-production-menu.png)。完整中间截图留本地，历史手机七张关键图仍在原报告。子路径浏览器脚本最初有选择器歧义、返回按钮名称不匹配，已修正验证脚本后重跑通过，未为测试修改游戏。

核查文件清单见 [selected-files.json](selected-files.json)，安全检查见 [security.json](security.json)，最终门禁见 [gates.json](gates.json)。只有清单中的明确路径纳入暂存；未修改原 Tag、Release 或手动 workflow。旧报告中的“未推送”是历史时点，不代表本轮交付结果。

工程目录没有移动、删除项。新增为已验收开屏源码/资源/测试与必要证据，以及本轮文档索引、严格 Pages 预览脚本和验收记录；修改为手机输入、相关测试、README/交接/追加日志及两项开发依赖补丁。细目以清单和本次 Git 提交 diff 为准，未纳入不明历史报告以填补旧本地链接。

## 手动部署入口

- 工作流：GitHub → Actions → Deploy RC to GitHub Pages → Run workflow，选择 main。
- `approved_sha` 必须填本轮最后推送、经用户复核的完整 HEAD；工作流实际 checkout 必须完全相等。不要使用旧 RC Tag SHA 代替最新 main。
- 预期站点：https://yunzha-bot.github.io/who-ate-my-rice/ 。本次不触发工作流，推送不代表线上更新。
- 旧 v1.0.0-rc1 Tag/Release 保留；上次公开可核实的手动部署为 2026-10-16 成功记录，不能据此断言线上已包含本轮功能。
- 本轮站点 GET 返回 HTTP 200，见 [可达性记录](online-status.json)。这不是线上交互验收；最后已知成功工作流的历史提交为 e9f361fce9dd5f392e2165ec2cf0b5f1148ed108，站点仍未被本次更新。

## 已知限制

手机真机 Android / Safari / 微信、系统后台与手感尚待用户验证。开屏 D 的真实后台与 GPU 树叶边缘采样差异保留原报告结论，不改阈值制造通过。构建的大包警告如实保留；本轮不是正式版发布，不改变 S20/S21 授权状态。
