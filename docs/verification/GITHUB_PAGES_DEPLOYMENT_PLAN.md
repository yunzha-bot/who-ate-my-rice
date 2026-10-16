# GitHub Pages 正式构建部署方案

日期：2026-10-16。仓库：`yunzha-bot/who-ate-my-rice`。

后续授权说明：用户已批准本地路径适配、手动工作流准备和本地验收，但未批准推送、Pages设置或触发部署。下文保留制定方案时的基线与计划语境；实施结果、真实缺口和下一次授权边界见 [本地验收报告](GITHUB_PAGES_LOCAL_ACCEPTANCE_REPORT.md)。旧Tag与Release保持不变，不把本地适配记为线上发布。

第二次授权：用户随后批准S19-P最小存储修复、全量门禁后正常commit/push及GitHub Pages首次手动RC测试版部署，明确不创建新Tag/Release、不代表S20完成。实际执行及公网结果以 [S19-P报告](S19_P_RC_DEPLOYMENT_REPORT.md) 为准，下文原方案保留历史语境。

## 1. 结论与授权边界

**适合采用 GitHub Pages 静态托管，但现有根路径构建不能直接视为已兼容项目子路径。** 首次上线前必须修复运行时资源路径，并对同一生产包执行子路径浏览器回归。不是另开工程整理阶段，不调整玩法、难度、地图、角色或 UI。

- S19 使用已建立的 `v1.0.0-rc1` Tag 和[同名预发布 Release](https://github.com/yunzha-bot/who-ate-my-rice/releases/tag/v1.0.0-rc1)；Tag 历史落点为 `870c69050cf80ff83aa79531e7d9f2590a8834d5`，Release 实查 prerelease=true、draft=false、附件 0，不移动或重写该 Tag。
- 计划访问地址为 `https://yunzha-bot.github.io/who-ate-my-rice/`。这是项目站点的预期地址，**不表示 Pages 已启用、网站已部署或已经验收**。
- 用户本轮只授权部署前审查和方案；没有批准部署实现、Pages 设置、Actions 部署触发或正式 `v1.0.0`。
- 本文只新增方案，不修改运行源码、构建配置或工作流，不调用 Pages 写接口，不上传部署产物。

GitHub Pages 是静态发布方式；项目所用Vite 6的官方文档针对项目站点要求仓库子路径base，并明确本地preview不是生产服务器。正式站点只发布构建后的文件，不公开DEV服务器。[Vite 6静态部署](https://v6.vite.dev/guide/static-deploy#github-pages)

## 2. 实际基线与静态审查

本轮里程碑检查由主任务重新执行：949/949 测试通过，独立 TypeScript、标准生产构建和差异检查通过，330 项保护文件哈希不变。计划审查实际确认 Node 为 `v24.19.0`，包版本为 `1.0.0-rc1`，`build` 仍是 `tsc --noEmit && vite build`，项目使用 Vite 6 系列而非官网当前新主版本。部署不升级依赖或更换打包器。

实查 dist 为 **86 个文件 / 43,049,720 字节**，约 43.05 MB（十进制）或 41.06 MiB。此数值是磁盘文件大小，不是公网压缩传输量、首屏流量或线上性能证明。

主任务另以当前 dist 做了**只读真实浏览器子路径诊断**：独立 Chrome、Edge 明确打开临时本地严格挂载的 `/who-ate-my-rice/`，HTML 为 200、标题正确，但随后 `/assets/index-CrqVpTD3.css` 和 `/assets/index-CA627rfX.js` 被请求到域名根目录而 404，菜单版本元素未挂载。这是当前根路径构建的预期诊断失败，不是已实施修复后的回归失败，更不是 GitHub Pages 线上验收；构建和源码都未为该诊断修改。它直接证明“页面 HTML 200”不足以判断游戏能玩。

主任务只读 API 实查仓库公开、默认分支 main、Actions enabled=true；Pages GET 返回 404，即本轮没有可读取的已配置 Pages 站点。此返回不替代权限判断或交互测试。尚未做 Pages 写入、工作流触发或网站部署。

| 位置 | 实际证据 | 对 Pages 的影响与处理 |
|---|---|---|
| `vite.config.ts` | 当前 `defineConfig` 没有 `base`，保留 5173 / strictPort | 默认为根路径；增加仅 Pages 构建启用的 `/who-ate-my-rice/`，开发和原根路径预览不改 |
| `src/main.ts`、`index.html` | 一个 HTML 入口；按顺序导入 style、industrial-ui、sheet-ui、s13-ui、game-ui、faction-menu 六份 CSS | 没有必须部署的业务服务端；保持样式顺序和 HTML 入口，Vite 会改写入口资源 |
| `src/three/DeepSeekGlbModel.ts:6–8` | v6、v5、standalone 三个 URL 都以 `/assets/` 开头，直接传入 GLTFLoader | 普通 JS 字符串不会因设置 base 自动修好；使用构建 base 生成 public URL，开发回退链不变，生产仍只请求 v6、失败程序化兜底 |
| `src/three/RiceBagModel.ts:4` | 米袋 URL 为 `/assets/props/rice-bag/rice-bag.glb` | 必须同样接入 base；不修改模型内容、缓存或实例释放 |
| `src/three/GameUiLayout.ts:28–33` | 四个 UI_PORTRAITS 为根路径；被 innerHTML 和结算换图使用 | 必须让这些运行时 img 路径带 base，不替换立绘、不改排版 |
| `src/sheet-ui.css`、`src/faction-menu.css:104` | 多处 `url('/ui/...')`，由 main.ts 导入进 Vite | CSS URL 属于 Vite 可处理资产；先检查带 base 的构建结果，不机械重写全部 CSS，不追加布局补丁 |
| `src/three/GameAudio.ts:132`、`src/three/StartupView.ts:67` | 已用 `import.meta.env.BASE_URL` 拼接音频 URL | 不重复改造；必须以实际网络与解码验证音频从子路径加载 |
| `vite.config.ts` DEV 保存插件 | 两插件 `apply: 'serve'`，注册 `/__dev/scene-layout`、`/__dev/throwable-layout` | 保留本地编辑保存；线上不提供保存服务，不把这些端点改成正式 API |
| `src/three/ThreeGame.ts:661–671` | Z/C/X 消费和镜头操作整段位于 `import.meta.env.DEV` | 生产构建保持删除，不能改用运行时隐藏按钮冒充隔离 |
| `scripts/production-assets.mjs` | build/post 精确过滤 v1–v4、v5、standalone 六个旧 GLB，仅允许项目 dist | 原样复用，必须走标准构建；不能直接上传 public 绕过过滤 |
| 工作流 | `git ls-files '.github/*'` 无已有跟踪工作流 | 新增一个专用手动部署工作流；当前不创建或触发 |

Vite对HTML、CSS和import资产的base改写，与运行时拼接字符串是两回事；动态public URL应使用 `import.meta.env.BASE_URL`。public的文件会原样复制到构建输出，这也是必须审查dist而不能只检查源码import的原因。[Vite 6构建公共路径](https://v6.vite.dev/guide/build#public-base-path)、[Vite 6 public资源](https://v6.vite.dev/guide/assets#the-public-directory)

本次静态扫描未发现必须上线的路由服务、远程账户后端或生产保存接口。游戏页面和对局切换在同一 HTML 内完成，因此暂不新增 SPA 重定向、Service Worker、自定义域名或新的依赖。

## 3. 最小拟修改文件

以下均是**下一次明确批准后的实施清单**，本轮没有实施。

| 文件 | 最小改动与必要性 |
|---|---|
| `vite.config.ts` | 仅在 Pages 生产构建标志启用时使用 `/who-ate-my-rice/`；默认 DEV/根路径行为保持，保留保存插件和过滤插件 |
| `src/three/DeepSeekGlbModel.ts` | 为现有三个资源地址添加正确 base；不改变正式/开发回退决策 |
| `src/three/RiceBagModel.ts` | 修正米袋运行时 public URL |
| `src/three/GameUiLayout.ts` | 修正四个立绘 URL，保持 markup、布局和菜单事件不变 |
| `.github/workflows/pages.yml`（新增） | 手动生产构建、门禁、仅上传 dist、Pages 部署；不监听任意 main push 或 Release 自动发布 |
| `tests/pages-deployment.test.mjs`（新增，建议名称） | 回归根路径与项目子路径、生产环境/产物边界；复用 Node/esbuild 等已有工具 |
| 直接加载上述模块的既有测试（仅确有必要） | 原测试使用 Node 直接 import；直接顶层访问 Vite 专有 env 会抛错。应保留纯函数可测性或复用已有 Vite 环境替换方式，增加 BASE_URL 夹具，不能删除或弱化断言 |
| `README.md`、本方案、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md` | 记录真实部署步骤、构建提交及验收结果；日志只追加 |

不预先新增通用资产框架；需要几处明确 URL 修改就用几处，不重构角色加载器。`GameAudio.ts`、`StartupView.ts`、`ThreeGame.ts`、CSS、模型和音频资产默认不改；若真实构建/浏览器证据发现直接相关问题，再限定在部署路径修复，并记录原因。`GAME_CONFIG`、AI 和用户布局全部保护。

特别注意：`tests/cleanup-projection.test.mjs` 直接导入 `GameUiLayout.ts`；`tests/production-model-policy.test.mjs` 当前仅替换 `import.meta.env.PROD`。新增 base 接入必须兼顾这些真实测试入口，不能因为网页运行了就让 Node 测试失效，也不能通过跳过测试解决。

## 4. 工作流及发布来源策略

采用 GitHub Actions Pages，不新增 gh-pages 分支，不提交 dist。初次只允许 `workflow_dispatch`，用户在 Actions 中手动触发；不配置 push main、push Tag 或 release published 自动部署。工作流的执行上下文限制为 main，并 checkout 该次触发的明确 `github.sha`，把完整 SHA 写入任务摘要，不能在门禁后临时拉取浮动 main 覆盖已测内容。

**Tag 与部署快照分开记录：** `v1.0.0-rc1` 是已经固定的 S19 源码里程碑；它尚无 Pages 路径适配。批准后新增最小部署适配提交，首次应部署这个经过验证、位于该 Tag 之后的 main 提交，不宣称部署内容逐字节等于原 Tag。不得移动旧 Tag；若用户坚持只部署原 Tag，必须先说明其路径缺口，不能忽略路径直接发布。为了让网页与里程碑一一对应，可以在用户同意版本策略后将适配版另记为 `v1.0.0-rc2`，但本方案没有授权创建该版本。未来 v1.0.0 只在上线验收获得相应授权后另行建立。

建议一个工作流中 build/deploy 分 job：

1. build：`contents: read`；固定 Node 24（与当前本地实测主版本一致），`npm ci`，执行 `npm test`、独立 `npx tsc --noEmit`、`npm run build` 和 diff 检查。
2. Pages base仅由受控构建标志启用，例如 `PAGES_DEPLOYMENT=true`；保留标准build脚本。只对构建命令保证production / `NODE_ENV=production`，不运行 `npm run dev`，不传 `--mode development`。安装阶段不能因全局NODE_ENV=production而省略Vite/TypeScript等devDependencies；采用明确的 `npm ci --include=dev` 或保持安装阶段未设置该变量。
3. 审查实际 dist 清单、旧模型名称及哈希、禁止路径/文件类型、生产 DEV 入口及 Z/C/X 字符串/接线。失败立即退出，不执行 upload/deploy。
4. build使用官方Pages上传action，上传路径明确为 **`./dist`**，绝不 `.`、public、src、tests或完整仓库目录。
5. deploy：`needs: build`，最小部署权限 `pages: write`、`id-token: write`，环境 `github-pages`；将需要Pages权限的官方configure-pages步骤放在这个job，并保持 `enablement: false`，仅在用户批准后另行启用的站点上读取配置。不将它塞进只有contents: read的build job，也不偷偷自动启用站点。部署同一构建artifact、不二次构建，展示action输出网址。[configure-pages官方输入](https://github.com/actions/configure-pages/blob/main/action.yml)
6. concurrency 使用单个 pages 组，建议不取消已经开始的部署，避免并行版本互相覆盖；未来自动触发策略必须另有用户批准。

官方要求部署权限、环境以及 build/deploy 依赖；Pages artifact 不得包含符号链接或硬链接。实施时从官方 action 仓库核对兼容版本并固定提交 SHA，不从旧示例猜版本，不要求用户创建额外个人 Token。[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

工作流创建并推送、Pages Source 改为 GitHub Actions、配置部署环境及触发首次部署，都是下一次批准的执行范围；本轮没有做。若 GitHub 账号权限/组织策略限制，集中列出用户必须点击的界面，不绕过权限或修改私人凭据。

## 5. 批准后一次完成的执行流程

### A. 本地修复与门禁

1. 复查分支、远端 main、工作区、保护哈希；保护私人目录及 1066 项排除材料，不枚举或上传它们。
2. 按上表最小修改路径与工作流；先复现子路径错误并补回归，再修复。
3. 重新运行四项完整检查；以实际数量报告，不固定声称永远 949 项。
4. 在隔离副本生成 Pages 专用 dist，避免覆盖用户正在看的根路径预览；保留正式地图、音频、模型原件。默认开发 5173 不改，不停止未知进程。
5. 审核 dist 含且仅含公开生产产物。确认六个旧 GLB 及非预期同内容副本缺席、正式 v6 和米袋存在；39 个音频原字节保留、五项停用事件仍停用。检查没有测试、私人文件、布局备份、临时脚本、凭据、源映射等非预期公开材料。

### B. 子路径受控浏览器验证

用独立 Chrome 和 Edge，明确 `page.goto()` 到隔离静态服务的 `/who-ate-my-rice/`，先核对 URL/端口/标题。服务只挂载该子路径，并令根 `/assets/`、`/ui/` 请求失败，避免 Vite 宽松 fallback 掩盖错误。不要用页面 CSS zoom 代替原生缩放。

每个浏览器验证双阵营 × 三难度，共 12 个进入/操作会话；检查真实配置仍为现有值、正式 30 秒/5 份规则不变，正常移动、投掷、暂停/恢复、声音设置、重开/返回。此矩阵不冒充 12 局自然完局或统计平衡。

同时验证：

- 首页和结算立绘、CSS 装饰、v6 正常加载/动画、米袋、Ogg/MP3 解码，生产请求全部带仓库 base，无新增 404、错误 MIME 或 pageerror。
- 模拟 v6 加载失败及动画初始化失败仍进入程序化兜底，不请求 v5/standalone；故障注入和自然游玩分别报告。
- Z/C/X 按键无镜头调试行为，DEV 入口不存在，无 DEV 存档静默应用或保存请求；开发版仍可本地使用，但绝不上传。
- 两卡与设置按钮真实边界 Hover，一次进入只响一次；代表视口 1920×1080、1707×864、1366×768，较窄/较矮可滚动，无难度面板裁切。
- 刷新 `/who-ate-my-rice/` 正常；当前没有业务子路由，不新增全站 404 重定向来吞资源缺失。
- 子路径是新的 origin/path 使用场景，设置保留按浏览器实际 localStorage 行为验证；不许宣传可恢复正在进行的对局。

浏览器不可用或某项无法可靠验证，保留缺口，不用 HTTP 200 或单测冒充。

### C. 经批准发布和线上检查

本地验收通过且已取得明确 Git/部署授权后，精确暂存新适配文件，正常提交推送 main；远端若有新提交停止处理，不 merge/rebase/强推。随后启用 Pages Actions Source，手动触发该批准的 main 快照部署。

工作流成功后验证 action 返回的实际 HTTPS 地址，不只看任务绿色：两浏览器重新检查模型、音频、六组合、设置、DEV 隔离与 Network；检查资源内容类型、HTTPS/混合内容、页面刷新，保存最终截图、资源清单与完整部署 SHA。再由用户在另一电脑/网络实际游玩，确认访问性能和最终手感。线上可访问不自动等于 S20 全量验收完成，更不自动创建 v1.0.0。

GitHub 的 github.io 站点支持 HTTPS，部署后仍须检查是否有 HTTP 资源或异常请求；网站内容公开可访问，不能靠仓库私有来隐藏上传的材料。[GitHub Pages HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

## 6. 风险、限制与回滚

| 风险 | 处理方式与停止条件 |
|---|---|
| 只设置 base，运行时 GLB/img 仍请求域名根目录 | 必修；同时修正上述 JS 字符串并用严格子路径静态服务验证 |
| production 构建误用 development，DEV/快捷键复活 | 工作流固定生产并检查产物及真实按键；出现即停止发布 |
| public 自动复制非公开材料或旧模型 | 只上传审核过的 dist，沿用精确过滤；新发现未知资源默认停止核验，不擅删原件 |
| Linux 大小写与 Windows 差异 | CI 在 Linux 从干净检出 npm ci/build；检查真实 URL 对应大小写与文件，不靠本机通过推断 |
| 单测使用 Node 与 Vite env 差异 | 保持现有测试语义，补环境夹具或兼容入口，不跳过/放宽测试 |
| main 后续变动悄悄上线 | 默认手动触发，记录该次 checkout SHA；不自动部署所有 push |
| 网络、大模型/图片加载慢 | 当前磁盘 43.05 MB 不等于首屏流量；上线后实测冷/热缓存和另一网络，保留既有低配/长测限制，不为追求数字临时改资产 |
| 缓存保留旧页面或旧资产 | 通过构建哈希及刷新复查；不加入尚无必要的 Service Worker 或刷新循环 |
| 素材权利边界 | 沿用最新 ASSET_PROVENANCE 与用户声明；AI 生成/非商用不是第三方输入权利的通用免责，不虚构新授权或法律保证 |
| Pages 配额/权限及可用性 | 发布容量目前远小于 1 GB；仍须监测 Actions/站点限制，不能保证任意流量或地区可达 |

Pages 官方发布站点上限 1 GB、部署超时 10 分钟、每月软带宽限额 100 GB；自定义 Actions 不受“每小时 10 次构建”软限制，不代表所有其他限制取消。当前 43 MB 包体满足容量量级，但不是部署成功证明。[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

回滚优先保持 Git 历史：保留首个通过的生产 artifact、清单、部署 SHA；新版失败不要继续覆盖。可用且未过期的已验证 artifact 经过批准重新部署，或在 main 用正常 revert/修复提交恢复**上一份已验证的 Pages 兼容版本**后重新门禁和部署；不能把尚不支持子路径的原 rc1 直接当作网页回滚包。回滚不移动 Tag、不强推、不清理本地资产。首次上线若没有可回退版本，则停止再次部署并报告，必要时经批准撤下站点。

## 7. 本轮交付与下一次批准范围

本轮只有静态审查、官方资料研究、当前包只读子路径失败诊断和此方案；未实施上述改动、未创建工作流、未修改 Pages 设置、未部署、未开展公网/子路径完整试玩，不能填写为已通过。

已有 S19 预发布及本轮 949/949 门禁事实保留；独立教学、连续 QA、统计平衡、低配/长时间性能、部分原生缩放与全屏等已知限制继续保留，不补造历史验收。授权来源记录采用最新账本，不把历史报告中的旧待确认结论改写为当时已知。

下一次一次性批准可明确为：实施本方案最小路径修复和工作流，完成本地及隔离子路径验证，检查通过后精确提交推送、启用 Pages Actions 并手动部署正式构建、完成线上可执行检查。是否建立 v1.0.0 正式 Tag/Release 仍需线上验收后的独立明确授权。本方案本身不构成该执行授权。
