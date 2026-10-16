# GitHub Pages 中国大陆无代理访问验收计划与存储键审查

日期：2026-10-16。范围：S19 Pages 适配的本地准备与只读审查；本文件不构成线上部署授权。

后续授权与修复见 [S19-P报告](S19_P_RC_DEPLOYMENT_REPORT.md)：用户已批准通过门禁后首次RC部署，getter启动失败已获准修复；下文保留原审查时点与空白大陆实测表。公网可访问不自动填充三运营商无代理结果。

## 1. 当前结论与证据边界

- 预期站点为 `https://yunzha-bot.github.io/who-ate-my-rice/`，**不是已部署或已验证可达的网址**。本轮不以请求预期网址、外部搜索服务或代理出口得到的结果充当中国大陆直连验收。
- 本仓库源码中的正式存储键均有 `who-ate-my-rice` 前缀，未发现 `volume`、`difficulty`、`settings` 等无项目命名空间的正式键。不需要为 Pages 适配迁移已有存储键、清空存档或修改存储格式。
- **同一账户 Pages 项目路径不隔离 localStorage**。本次只能审查本仓库，不能证明该账户其他仓库没有使用相同键，也不能把项目前缀当作安全边界。
- 本轮制定真实网络验收计划，未完成中国大陆电信、联通、移动网络实测；因此不承诺全国、所有运营商或任意时间可访问。
- S19 已固定 `v1.0.0-rc1` 里程碑保持不动；上线后应记录实际部署适配提交与产物，而不是用 Tag 名字代替实际部署身份。

## 2. localStorage 的真实边界

localStorage 属于页面 origin；origin 由协议、主机和端口决定，路径不同不会形成新的 origin。[MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)、[MDN 同源策略](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)

GitHub Pages 项目站点默认使用 `https://<owner>.github.io/<repositoryname>`，同一 owner 的不同项目可以共用主机。因此这里推导出：`/who-ate-my-rice/` 与该账户其他项目路径共享 `https://yunzha-bot.github.io` 的存储空间，不能声称按仓库路径自动隔离。[GitHub Pages 站点类型](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#types-of-github-pages-sites)

| 实际键 | 源码位置 | 用途及读写入口 | 正式版接线 | 审查判断 |
|---|---|---|---|---|
| `who-ate-my-rice-difficulty-v1` | `src/config/difficultyConfig.ts` 的 `DIFFICULTY_STORAGE_KEY`、`readDifficulty`、`saveDifficulty`；`src/three/DifficultyView.ts` | 读取上次难度，菜单选择时写入；非法值/读取失败回落 EASY | 菜单实际使用 | 项目命名空间＋版本后缀；与音量/DEV 键不同，保留 |
| `who-ate-my-rice-audio-v1` | `src/three/GameAudio.ts` 的 `STORAGE_KEY`、构造函数、`save`；`src/three/ThreeGame.ts` 创建 GameAudio | 音量总线及静音 JSON；清洗异常值；改变设置写回自己的键 | 正式游戏实际使用 | 项目命名空间＋版本后缀，保留；不包含账号或凭据 |
| `who-ate-my-rice/dev-b-runtime-params` | `src/systems/DevBParamStore.ts` 的 `DEV_B_STORAGE_KEY`、`browserDevBStorage`、`devBPersistenceStorage` | DEV 白名单参数预设读写/删除及回读校验 | `ThreeGame.ts` 只在 `import.meta.env.DEV` 分支创建持久化对象；`devBPersistenceStorage(false)` 不读取 | 同样有项目命名空间，不是泛用键；正式版不得应用它，原预设不删除 |
| `who-ate-my-rice/scene-editor-layout` | `src/three/map/MapLayoutStore.ts` 的 `LAYOUT_STORAGE_KEY`、`readSavedLayout`、`writeSavedLayout` | 保留的旧浏览器布局信封读写辅助入口及测试 | 当前 SceneEditor 没有调用这些存储入口；只导入纯布局/校验函数，实际布局来自项目 JSON 与 DEV 文件端点 | 不等同于当前场景保存路径；保留兼容代码和历史存档，不排除或迁移 |
| `who-ate-my-rice/scene-editor-layout:probe` | 同模块的 `browserLayoutStorage` | 存储可用性探针，写入后移除 | 当前运行 SceneEditor 未接该入口 | 仅辅助探针，也有前缀；不可当作持久化玩法存档 |

扫描范围包括 `src/`、`tests/` 的 localStorage/sessionStorage 文本、`getItem`/`setItem`/`removeItem` 调用及其常量；没有读取用户浏览器资料、私人目录或同账户其他项目。本仓库未发现 sessionStorage、IndexedDB 或 cookie 的游戏存储接线；各种 Map/Set 的 `.clear()` 不是 `localStorage.clear()`，没有把它们误判为跨项目清理。

实际涉及的是 **4 个持久化键定义＋1 个临时探针派生键**，其中正常正式运行读写的是难度和音量两个键。源码没有无项目前缀的 DEV 存储键；DEV 隔离结论依赖生产门禁和浏览器验证，不能仅因 DEV 键也带前缀而忽略其读取行为。

现有回归证据入口：

- `tests/difficulty.test.mjs`：损坏/不可用难度存储回落及正式规则。
- `tests/game-audio.test.mjs`：音量清洗、设置持久化和恢复默认。
- `tests/dev-b-param-persistence.test.mjs`：独立键、生产不读不应用、损坏预设及不静默覆盖难度。
- `tests/production-tools.test.mjs`：生产工具构造消除及 DEV 保留。
- `tests/scene-editor-layout.test.mjs`：旧布局辅助存储的往返及失败语义，不表示正式版读取旧布局。

### 2.1 跨项目风险与最小处理

1. **键名碰撞：** 当前项目内没有重复键；若其他项目复制同名键仍可能互相覆盖。本轮保留既有键，未来新增同账户项目时检查其命名空间。不为不存在的冲突新增迁移框架。
2. **同源脚本权限：** 前缀只减少意外碰撞，不能阻止同 origin 的其他脚本枚举或删除键；不要向这些键写入秘密。更强隔离需不同 origin，属于未来平台决定，本轮不添加域名或改站点。
3. **整体清理：** 本仓库没有发现调用 `localStorage.clear()`。未来调试/测试只能使用专属键和隔离浏览器，不能清空 `yunzha-bot.github.io` 全部站点数据来“修复”本项目。
4. **部署前后设置：** 5173、4173、本地临时端口与 GitHub HTTPS 不是同 origin，旧本地设置不会自动迁入线上。刷新可记住选项，不代表恢复正在进行的对局；同 origin 下移动路径也不能声称设置天然隔离。
5. **浏览器存储被策略禁止：** MDN 指出访问 localStorage 可能抛 `SecurityError`。难度入口已捕获；审查时 `ThreeGame.ts` 创建音频对象的参数直接求值 localStorage，getter 拒绝发生在音频构造内部捕获之前。这是需主任务核验的特殊环境风险，不是已证明的跨项目冲突或正常 Pages 失败。本审查不改源码；若主任务以故障注入复现后做最小修复，结果写主验收报告。[MDN localStorage 异常](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#exceptions)

### 2.2 本地受控存储验收建议

在新的受控 Chrome/Edge 测试 profile 中验证，绝不操作日常浏览器存档：

- 为无关项目模拟键写入哨兵，切换难度/音量/静音、刷新、恢复默认后哨兵不变。
- 正式版实际保存两个项目键，刷新读回难度和音量；非法值安全回落。
- 预置 DEV-B 与旧地图键，正式版不读取/应用/删除，不改变地图或实际难度。
- 在同一个临时 origin 的两个路径显示本项目及纯测试哨兵页，明确验证路径共享；不要在真正其他仓库写入测试数据。
- 对全局 getter 拒绝、getItem/setItem 拒绝分别验证，区分参数求值与存储方法异常。

本节是测试要求；实际执行状态以主验收报告为准，不在本计划预填“通过”。

## 3. 公共资源与网络依赖审查

`src/main.ts` 导入本地 CSS/模块，`index.html` 无 CDN 脚本；`GameAudio.ts`、`StartupView.ts` 请求项目内音频；`DeepSeekGlbModel.ts` 与 `RiceBagModel.ts` 通过 GLTFLoader 请求项目内模型；`GameUiLayout.ts` 与实际 CSS 使用项目内立绘/UI。扫描未发现在线语音生成、账户后端、广告、统计遥测或必须请求外部 CDN 的运行入口。此次运行时路径适配由主任务处理并通过实际构建/Network 清单核实，不能仅凭静态扫描断言不存在任何间接请求。

`src/three/MenuCreditsView.ts` 的 GitHub 链接是用户点击后另开页面的项目外链，不是游戏启动必须的下载服务；即使该链接暂时不可达，也要与游戏资源失败分别记录。DEV 的 `/__dev/scene-layout` 与 `/__dev/throwable-layout` 是本地保存端点，不应部署到正式 Pages 或作为线上依赖。

现有 `StartupView.ts` 在音频预热约 8 秒后中止等待、整体加载约 20 秒后允许安全降级；大陆慢网可能先进入降级状态。必须记录实际 v6、立绘、米袋、音频成功情况，**不能把“最终能进菜单”当作所有资源都加载成功**。不在本轮为了通过网络指标改资产、超时或玩法。

GitHub 官方列出容量、软带宽及速率限制，这些配额不等于地区连通性保证；遇到 429 等应记录真实状态，不能用刷新循环增加压力。[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

## 4. 中国大陆真实无代理验收范围

仅在用户第二次批准、站点实际部署后执行。先记录实际 Actions 部署 SHA、产物清单摘要、页面版本和 URL；现阶段全部网络结果留空。至少覆盖电信、联通、移动各一个真实接入点，使用不少于两台不同电脑，尽量分布在两个不同城市/地区；每个运营商均测 Chrome 和 Edge。固定宽带或移动热点可以使用，但必须注明实际接入类型，不把换 Wi-Fi 名称当作更换运营商。

| 接入组合 | 设备 | Chrome | Edge | 首轮日期/地点 | 后续复测日期 |
|---|---|---|---|---|---|
| 电信实际网络 | 电脑 A 或 B | 待测 | 待测 |  |  |
| 联通实际网络 | 电脑 A 或 B | 待测 | 待测 |  |  |
| 移动实际网络 | 电脑 A 或 B | 待测 | 待测 |  |  |

这只是覆盖下限；不能据六个组合推导全国可用。由真实测试者执行并确认以下环境信息：

- 测试日期/时间（北京时间）、城市、运营商、宽带/热点类型；不公开家庭地址、完整公网 IP、路由器凭据。
- 系统及浏览器版本、CPU/GPU/内存概况、窗口分辨率和缩放。
- 系统代理、浏览器代理扩展、VPN、TUN、加速器及路由器上游代理均未参与。不能确认路由器/公司网关透明代理的样本标为“环境不确定”，不列为无代理通过。
- 记录实际 DNS 配置类型：自动/运营商 DNS、浏览器安全 DNS 是否启用及提供商。只记录、不擅改 DNS、hosts、TLS 校验或路由；若不同 DNS 环境由测试者自选，分开记录，不能混称统一运营商基线。
- 使用新的专用测试 profile 或专用站点数据上下文；不清理用户日常浏览器所有历史、cookie 或 localStorage。

## 5. 每个组合的执行步骤

1. **首次冷启动：** 在没有该站点 HTTP 缓存的专用 profile 明确输入实际 HTTPS 地址；记录 DNS/连接/TLS/HTML/JS/CSS耗时及错误。冷缓存必须是实际新上下文或明确清除该站点 HTTP 缓存；不要把 DevTools 的禁用缓存与“重新启动后自然缓存行为”混为一谈。
2. **首屏与资源：** 记录从导航到首屏、菜单可操作、v6/动画就绪、立绘和米袋就绪的时间；保存 Network 的状态码、MIME、失败 URL、requestfailed 与控制台错误。区分程序化兜底和正常 v6，不用 HTML 200 或启动层消失代替成功。
3. **音频：** 经真实点击解除自动播放限制后检查菜单音乐、点击/确认、游戏音乐及代表 Ogg/MP3 音效；记录实际请求/解码失败。浏览器自动播放策略与网络失败分开。
4. **完整游玩：** 双阵营分别完成至少一局自然结算，三档均能进入/操作；覆盖移动、投掷、暂停/恢复、设置、重开/返回。难度覆盖不等于胜率平衡；不使用强制结算夹具充当网络真人完整对局。
5. **正式边界：** 无 DEV 入口、Z/C/X 调试镜头无效，无 `/__dev/` 保存请求；页面布局和资源子路径正常。
6. **热缓存与刷新：** 同一 profile 正常刷新、关闭重开，记录缓存来源/实际传输量和设置保留；不要将磁盘 dist 字节数当作网络传输字节数。
7. **多时段复查：** 每个接入点至少三个分开的时段复查（尽量含晚间高峰和另一天），保留失败样本、重试次数及恢复时间；不能只挑最快一次。
8. **故障记录：** 若慢、超时、偶发丢包/断连，区分 DNS、TCP/TLS、HTTP、下载、解码和 WebGL 阶段。没有实测包数与方法就不填写“丢包率”；ICMP 不响应也不能直接等价 HTTPS 不可用。

网络限速/离线故障注入可单列补充，不计入正常无代理样本。禁止为了让样本通过而启用代理、绕过网络限制、修改 hosts 或关闭证书验证；当前本地严格子路径验证只证明路径/功能，不证明公网连通性。

## 6. 空白验收记录

复制本表，为每个浏览器/网络/时段单独填写；只保留必要环境信息，HAR/截图公开前检查 Cookie、请求头、IP 和本机路径等隐私。

| 项目 | 实测记录 |
|---|---|
| 实际 URL / 部署 SHA / 页面版本 / 产物摘要 |  |
| 日期时间 / 地点（城市级）/ 运营商 / 接入类型 |  |
| 设备概况 / 系统 / 浏览器版本 / 视口与缩放 |  |
| 系统、浏览器、路由无代理确认 / DNS 及安全 DNS |  |
| 冷启动首屏 / 菜单可操作 / v6动画 / 米袋时间 |  |
| 立绘、JS、CSS及代表音频状态 / 解码与播放 |  |
| 热启动时间 / 缓存来源 / 实际传输字节 |  |
| 各阶段错误 / 失败 URL / 状态码 / 重试次数 |  |
| 双阵营自然结算 / 三难度进入 / 暂停设置投掷 |  |
| DEV、Z/C/X隔离 / 子路径刷新 / 设置保留 |  |
| 多时段结果 / 卡顿、断连和恢复 / 丢包测法（若有） |  |
| 截图 / 脱敏 Network 或 HAR / 测试者结论 |  |

验收判断：资源和交互必须实际完整，持续无法访问、关键资源失败或未确认无代理环境不能写“通过”；慢但最终完整可用也需记录真实等待及用户可接受性，不能擅自设定一个未批准的性能达标数值。若仅部分运营商/时段可用，报告“覆盖有限/有条件可用”，由用户决定是否上线、提供可用性说明或另选平台，不自动创建新的部署任务。

## 7. 本次交付状态

本文件仅新增网络验收计划和存储键静态审查；未修改任何存储键、源码、地图、浏览器日常数据、DNS 或 Pages 设置，未触发工作流或公开部署，未暂存/提交/推送/创建 Tag 或 Release。源码路径适配、完整测试、实际产物及受控浏览器结果由主任务统一记录；本计划不预填这些结果。
