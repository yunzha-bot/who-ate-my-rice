# 项目文档与工程索引

## 长期职责

- 根 `AGENTS.md`：长期协作、安全、架构与阶段门禁规则。
- [DEEPSEEK_HANDOFF.md](DEEPSEEK_HANDOFF.md)：当前状态、授权、待办与已知限制；只保留简要入口。
- [AGENT_LOG.md](AGENT_LOG.md)：只追加的历史记录，不用重写旧事实来整理工程。
- [GAME_BALANCE_CONFIG.md](GAME_BALANCE_CONFIG.md)：正式可调数值与源码对应关系。
- [MOBILE_BROWSER_SUPPORT.md](MOBILE_BROWSER_SUPPORT.md)：手机版支持、输入规则及真机待验项。
- [OPENING_UI_RECONSTRUCTION_PLAN.md](OPENING_UI_RECONSTRUCTION_PLAN.md)：开屏 A～D 的阶段约束及历史检查。
- `releases/`：固定 RC 发布快照；`verification/`：具体阶段测试、截图与交付报告。

## 开发记录统一入口

以后查记录先打开本页，不必逐个目录寻找。这里整合的是索引，不复制、改写或删除原始历史；同一事实仍只有原文一个来源。

| 想查看的内容 | 唯一入口 / 阅读方式 |
| --- | --- |
| 最近做了什么、现在有什么限制 | [当前交接](DEEPSEEK_HANDOFF.md)，从顶部读起 |
| 完整时间线、修改与验收历史 | [开发主日志](AGENT_LOG.md)，最新条目在文件末尾 |
| 某项功能的测试、截图、参数 | 下方专项记录目录；标题是原文标题，不表示该阶段已通过 |
| 固定发布快照 | [RC1](releases/v1.0.0-rc1.md)、[RC2](releases/v1.0.0-rc2.md)，不把main后续更新写成旧Tag内容 |
| 开屏早期设计QA | [根目录design-qa.md](../design-qa.md)，仅是历史专项记录，不是新的主日志 |
| 2026-10-18工程交付 | [历史交付单](PROJECT_DELIVERY_2026-10-18.md)，只代表当时状态 |
| 原始命令输出 | verification各轮目录内的tests.log、build.log等；保留原位置，本地临时输出不追加进主日志，也不批量提交 |

2026-10-24整理时已追踪的专项Markdown共62份，以下全部纳入统一索引；另有27份本地原始.log输出，仅保留作证据，不创建第二份汇总日志。设计文档、素材说明和AI导出的原始文件不冒充开发日志；私人目录不读取、不收集。旧报告中的“未提交/待验收/旧参数”是当时事实，最新状态以交接和主日志后续条目为准。

### 近期专项记录

- [Human失败独立插画与最新腾讯云目录 — 2026-10-24](verification/human-defeat-2026-10-24/README.md)

- [日志统一入口、人类持物位置及最新腾讯云目录 — 2026-10-24](verification/logs-tencent-2026-10-24/README.md)

- [阵营卡片直接开局 — 2026-10-23](verification/faction-card-start-2026-10-23/README.md)
- [Git 归档与部署前检查（2026-10-22）](verification/git-preparation-2026-10-22/README.md)
- [开屏标签再右移与 Human 立绘替换 — 2026-10-22](verification/human-portrait-2026-10-22/README.md)
- [Human开屏立绘亮度微调 — 2026-10-23](verification/human-portrait-exposure-2026-10-23/README.md)
- [Human结算立绘替换 — 2026-10-23](verification/human-report-2026-10-23/README.md)
- [Human 游戏内视觉尺寸调整 — 2026-10-23](verification/human-size-2026-10-23/README.md)
- [Human v2 游戏表现替换 — 2026-10-22](verification/human-v2-integration-2026-10-22/README.md)
- [Esc设置中的键盘自定义 — 2026-10-22](verification/key-bindings-2026-10-22/README.md)
- [开屏桌面宽高比适配 — 2026-10-22](verification/menu-aspect-2026-10-22/README.md)
- [阵营卡片居中 — 2026-10-23](verification/menu-center-2026-10-23/README.md)
- [开屏视差边缘拉伸条修复 — 2026-10-22](verification/menu-edges-2026-10-22/README.md)
- [开屏正常浏览器缩放与腾讯云v2包 — 2026-10-23](verification/menu-native-zoom-2026-10-23/README.md)
- [开屏滚动条配色 — 2026-10-22](verification/menu-scrollbar-2026-10-22/README.md)
- [开屏标签右移与缩放修复 — 2026-10-22](verification/menu-zoom-2026-10-22/README.md)
- [本轮视觉保护口径](verification/menu-zoom-2026-10-22/brand-spec.md)
- [手机版操作手感优化：本地实现与验证](verification/mobile-feel-2026-10-22/README.md)
- [移动端交互白边外扩修正 — 2026-10-22](verification/mobile-ripple-2026-10-22/README.md)
- [手机交互波纹柔化 — 2026-10-22](verification/mobile-ripple-soft-2026-10-22/README.md)
- [开屏阶段 D：最终验证与交付](verification/opening-final-2026-10-22/README.md)
- [RC2 工程归档与腾讯云上传包 — 2026-10-23](verification/rc2-tencent-2026-10-23/README.md)
- [街道背景行人及缓慢车流 — 2026-10-22](verification/street-activity-2026-10-22/README.md)
- [室外街道生活化布景 — 2026-10-22](verification/street-life-2026-10-22/README.md)
- [腾讯云最新版工程整理与上传包 — 2026-10-23](verification/tencent-ready-2026-10-23/README.md)
- [腾讯云根路径构建准备 — 2026-10-22](verification/tencent-root-2026-10-22/README.md)
- [开屏上方辅路与人行道补景 — 2026-10-22](verification/upper-street-2026-10-22/README.md)

### 历史专项记录与计划

- [第一轮工程整理：审计、安全重构与冗余排查](verification/CODEBASE_CLEANUP_REPORT.md)
- [DEV-B 运行时调试参数持久化（本地预设）浏览器复核材料](verification/DEV-B-PARAMS/README.md)
- [DEV 场景编辑器 V2（布局保存 / 恢复 / JSON 导入）浏览器复核材料](verification/DEV_SCENE_EDITOR_V2/README.md)
- [三档难度与正式30秒进食验收记录](verification/DIFFICULTY_REPORT.md)
- [外围几何修复复核（2026-10-03）](verification/EXTERIOR_GEOMETRY/README.md)
- [最终工程整理与收尾验收报告](verification/FINAL_ENGINEERING_REPORT.md)
- [GitHub Pages 正式构建部署方案](verification/GITHUB_PAGES_DEPLOYMENT_PLAN.md)
- [S19 GitHub Pages 适配与本地验收](verification/GITHUB_PAGES_LOCAL_ACCEPTANCE_REPORT.md)
- [GitHub Pages 中国大陆无代理访问验收计划与存储键审查](verification/GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md)
- [区域级放大复核材料（2026-10-04）](verification/MAP_SCALE_UP/README.md)
- [阵营选择页制作信息与免责声明（2026-10-12）](verification/MENU_CREDITS_REPORT.md)
- [阵营选择页响应式布局修复 — 2026-10-14](verification/MENU_RESPONSIVE_REPORT.md)
- [阵营选择页右侧设置区验收 — 2026-10-15](verification/MENU_SETTINGS_REPORT.md)
- [玩家声音探测可视化停用：浏览器复核记录](verification/PLAYER-SOUND-VISUAL-DISABLE/README.md)
- [工程整理 S2：生产构建资源审计与安全瘦身](verification/PRODUCTION_ASSET_OPTIMIZATION_REPORT.md)
- [正式预览玩法同步与镜头快捷键隔离](verification/PRODUCTION_PREVIEW_SYNC_REPORT.md)
- [S13 音频与反馈验证记录](verification/S13_AUDIO_REPORT.md)
- [已验收成果公开发布审查 — 2026-10-14](verification/S13_RELEASE_REVIEW.md)
- [S17–S19 兼容性、性能与候选发布版验收](verification/S17_S19_RC_REPORT.md)
- [S19-P 首次GitHub Pages RC部署记录](verification/S19_P_RC_DEPLOYMENT_REPORT.md)
- [S19候选快照提交前审查](verification/S19_SNAPSHOT_REVIEW.md)
- [S20 外部玩家阻断问题：只读诊断](verification/S20_EXTERNAL_BLOCKERS_DIAGNOSIS.md)
- [S20 加载就绪与入局门禁：本地最小修复验收](verification/S20_LOADING_GATE_FIX_REPORT.md)
- [S20 Web正式上线准入报告](verification/S20_WEB_RELEASE_READINESS_REPORT.md)
- [S7C-2 第二轮修复轮：真实浏览器复核记录（2026-09-26）](verification/S7C-2-r2/README.md)
- [S7C-2 第三轮修复轮：真实浏览器复核证据（2026-09-26）](verification/S7C-2-r3/README.md)
- [S7C-2 第四轮修复轮：白色家具轮廓可见性的浏览器证据（2026-09-26）](verification/S7C-2-r4/README.md)
- [S7C-2b 浏览器复核材料（DeepSeek 娘 AI 自主藏身）](verification/S7C-2b/README.md)
- [S7D 验证证据索引](verification/S7D/README.md)
- [固定路线结算与道具点位回归修正](verification/TEST_CONTRACT_FIX_REPORT.md)
- [生活投掷物实现与验收记录](verification/THROWABLES_REPORT.md)
- [投掷物编辑、虚线与3秒眩晕验收](verification/THROWABLE_EDITOR_REPORT.md)
- [阵营卡片Hover重复播放修复](verification/UI_HOVER_FIX_REPORT.md)
- [全游戏玩家界面更新验收（2026-10-12）](verification/UI_REFRESH_REPORT.md)
- [内部文字标签底板专项修正](verification/opening-labels/README.md)
- [开屏阶段 C：动态验收候选（2026-10-22）](verification/opening-motion/README.md)
- [开屏静态版：证据与素材说明](verification/opening-static/README.md)

## 工程目录

| 目录 | 用途 / 整理边界 |
| --- | --- |
| `src/systems/`、`src/config/` | 玩法权威与配置，不因归档而重构 |
| `src/three/`、`src/*css` | Three.js 表现、输入与 HTML/CSS UI |
| `public/` | 已审核运行资源；旧模型仍按生产过滤规则保留本地 |
| `tests/` | Node 测试；`tests/helpers/`是实际引用的轻量测试夹具 |
| `scripts/` | 构建安全审查、浏览器验收及素材工具；用途不同不视为重复 |
| `archive/` | 历史功能恢复资料，不自动清理 |
| `incoming-assets/`、地图 `.bak` | 用户材料及恢复备份，仅本地保留，不纳入本次提交 |
| `dist/`、`dist-tencent/` | 默认/Pages构建与腾讯云根路径独立构建，不提交 |
| `dist-tencent-delivery/` | 本地旧包备份与腾讯云上传ZIP，不提交；与实际上传目录分开 |
| `node_modules/`、`.npm-cache/` | 依赖与缓存，不提交 |
| `.github/workflows/pages.yml` | 手动 Pages 流程与 approved_sha 门禁，不因 push 自动部署 |

源码、原始素材和历史文档维持原目录。2026-10-23仅将旧dist-tencent完整移入dist-tencent-delivery作为备份，再生成新包；没有删除原始资料。根 `design-qa.md` 是开屏历史 QA，不是第二份当前交接；保留原位置以免破坏旧引用。私人配置目录不读取或整理。

## 最新交付

- [2026-10-24 Human失败插画与最新dist-tencent目录](verification/human-defeat-2026-10-24/README.md)。仅人类失败切新图，原获胜图保留。

- [2026-10-24日志整理与最新dist-tencent目录](verification/logs-tencent-2026-10-24/README.md)。本次按文件夹上传，旧RC2 ZIP不包含此次持物调整；Tag固定不动。

- [v1.0.0-rc2归档与腾讯云上传包](verification/rc2-tencent-2026-10-23/README.md)，[发布记录](releases/v1.0.0-rc2.md)。

- [开屏正常浏览器缩放与腾讯云v2包](verification/menu-native-zoom-2026-10-23/README.md)。
- [腾讯云最新版部署包与工程整理](verification/tencent-ready-2026-10-23/README.md)。
- [手机操作优化报告](verification/mobile-feel-2026-10-22/README.md)。
- [Git整理与部署前审查](verification/git-preparation-2026-10-22/README.md)。

公开提交只保留各报告明确链接的必要截图/JSON。完整中间截图、失败迭代、原始长视频和日志按各目录“归档范围”说明保留本地，不代表 GitHub 中可以访问。没有因减少 git status 而扩大 `.gitignore`。
