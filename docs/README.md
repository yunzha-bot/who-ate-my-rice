# 项目文档与工程索引

## 长期职责

- 根 `AGENTS.md`：长期协作、安全、架构与阶段门禁规则。
- [DEEPSEEK_HANDOFF.md](DEEPSEEK_HANDOFF.md)：当前状态、授权、待办与已知限制；只保留简要入口。
- [AGENT_LOG.md](AGENT_LOG.md)：只追加的历史记录，不用重写旧事实来整理工程。
- [GAME_BALANCE_CONFIG.md](GAME_BALANCE_CONFIG.md)：正式可调数值与源码对应关系。
- [MOBILE_BROWSER_SUPPORT.md](MOBILE_BROWSER_SUPPORT.md)：手机版支持、输入规则及真机待验项。
- [OPENING_UI_RECONSTRUCTION_PLAN.md](OPENING_UI_RECONSTRUCTION_PLAN.md)：开屏 A～D 的阶段约束及历史检查。
- `releases/`：固定 RC 发布快照；`verification/`：具体阶段测试、截图与交付报告。

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

- [v1.0.0-rc2归档与腾讯云上传包](verification/rc2-tencent-2026-10-23/README.md)，[发布记录](releases/v1.0.0-rc2.md)。

- [开屏正常浏览器缩放与腾讯云v2包](verification/menu-native-zoom-2026-10-23/README.md)。
- [腾讯云最新版部署包与工程整理](verification/tencent-ready-2026-10-23/README.md)。
- [手机操作优化报告](verification/mobile-feel-2026-10-22/README.md)。
- [Git整理与部署前审查](verification/git-preparation-2026-10-22/README.md)。

公开提交只保留各报告明确链接的必要截图/JSON。完整中间截图、失败迭代、原始长视频和日志按各目录“归档范围”说明保留本地，不代表 GitHub 中可以访问。没有因减少 git status 而扩大 `.gitignore`。
