# S19 GitHub Pages 适配与本地验收

日期：2026-10-16。范围：经用户批准的最小路径修复、手动工作流准备和本地验收；不是新的工程整理阶段，也不是上线记录。

后续记录：用户已批准S19-P第二次验收及有条件首次RC部署；localStorage getter问题已获准最小修复。本报告和`pages-local/`保留原时点全部结果（包括v6取消及修复前存储失败），后续结果另见 [S19-P报告](S19_P_RC_DEPLOYMENT_REPORT.md)，不回改原始证据。

## 1. 结论与授权边界

**根路径与 Pages 子路径的生产构建、自动化门禁及本地双浏览器功能验收通过；保留特殊存储策略和请求取消观察项。未部署，不代表公网或中国大陆直连已经通过。**

- 未暂存、commit、push、触发 Actions、修改 Pages 设置或创建/修改 Tag、Release。`v1.0.0-rc1` 仍是原有里程碑，不把此次本地适配冒充原 Tag 内容或 v1.0.0 正式版。
- 已保存的玩法、难度、地图、家具/投掷物位置、音频和模型字节不变。仅修改 Vite base 和三个模块的资源地址；CSS、ThreeGame、AI、输入、声音播放和编辑器源码未改。
- 5173 开发服务器及4173根路径正式预览均保留，原监听进程未终止。Pages包在临时隔离副本生成，严格子路径临时服务已正常关闭。
- 预计网站地址仍是 `https://yunzha-bot.github.io/who-ate-my-rice/`，不是已经部署的访问承诺。等待用户第二次验收和独立 Git/上线授权。

## 2. 实际根因与最小修改

原构建 HTML 在项目子目录下仍引用根 `/assets/`；GLTFLoader和innerHTML里的普通字符串不会因改base自动重写。音频已正确使用BASE_URL，Vite导入的CSS也会自行改写，因此没有重写CSS、添加布局补丁或新增资产框架。

| 文件 | 实际改动 |
|---|---|
| `vite.config.ts` | 配置改为现有defineConfig回调；仅 `command === 'build' && PAGES_DEPLOYMENT === 'true'` 使用 `/who-ate-my-rice/`，默认根路径和5173严格端口不变，原三个插件不变 |
| `src/three/DeepSeekGlbModel.ts` | 三个既有模型URL加BASE_URL；正式v6→程序化、开发v6→v5→standalone决策不变 |
| `src/three/RiceBagModel.ts` | 米袋URL加同一base，缓存、克隆和释放不变 |
| `src/three/GameUiLayout.ts` | 四个立绘URL加base，markup、卡片布局、菜单/结算事件不变 |
| `tests/pages-deployment.test.mjs`（新增） | 9项路径、配置、菜单资源及发布产物/工作流回归；既有949项测试未删改 |
| `scripts/verify-pages-build.mjs`（新增） | 只读产物门禁与逐文件大小/SHA-256清单；不删除任何源文件 |
| `.github/workflows/pages.yml`（新增） | 手动main生产构建、门禁、仅dist上传和部署定义；本轮只保存本地，不执行 |
| `README.md` | 根路径与Pages构建区别、隔离目录及工作流授权边界 |
| `docs/verification/GITHUB_PAGES_DEPLOYMENT_PLAN.md` | 保留原计划语境，补充本次本地实施授权及本报告入口 |
| 本报告、`GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md`、`pages-local/` | 实际结果、无代理计划、存储审查、清单与截图证据 |
| `docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md` | 精简当前状态、末尾追加真实结果；不更新新阶段Gate |

模型/UI模块保留Node直接导入时的根路径兜底，避免Vite专属env破坏既有测试。构建器可能保留共享base常量与模板拼接，门禁没有错误地要求压缩代码必须包含一个完整URL字面量；真实URL由模块测试和浏览器Network交叉确认。

新增路径测试先复现3项失败（配置、GLB、立绘），音频项原本通过；修复后相关16项通过，最终新增9项及完整958项通过。早期浏览器脚本的过宽DOM选择器、已选radio的自动化check不发送点击及故障注入锚点问题均在临时探针内修正，没有为脚本错误改游戏。

## 3. 自动化门禁与保护

| 检查 | 实际结果 |
|---|---|
| 修改前 `npm test` | 949/949，失败/取消/跳过0，约50.01秒 |
| 最终 `npm test` | 958/958，失败/取消/跳过0，约101.18秒；同时有浏览器负载，不作为性能对比 |
| `npx tsc --noEmit` | 单独执行通过，不仅依赖build内置检查 |
| 根路径 `npm run build` | 通过，123模块；保留既有大于500kB的chunk警告，未隐藏或改门槛 |
| 隔离Pages `npm run build` | 显式production/PAGES_DEPLOYMENT=true，通过；复建后全部86文件的大小/哈希一致 |
| 产物门禁 | 通过；83项Git追踪public文件与源文件逐字节一致，加HTML/JS/CSS共86项 |
| 工作区diff | `git diff --check`通过；新增文本另做no-index空白检查，不暂存 |
| 开工339项哈希 | 333项不变；仅3个授权资源地址模块、Vite配置、README、原计划文档共6项变化 |
| 玩法/素材保护 | 配置、两AI、30秒/5份米、布局JSON、输入、所有CSS、音频、v6/米袋和6个本地旧GLB均不变 |
| 历史日志 | 开工日志字节前缀哈希保持；只在末尾追加本轮结果 |
| Git边界 | 索引为空；main/原Tag远端未变化；未操作私人目录及既有排除材料 |

339项是本轮实际覆盖的哈希集合，**不是声称所有私人文件都被读取或哈希**。未读取`.trae/`、`.dsh-meow/`、`.codex/`内容，不清理既有备份/素材/验收材料。

## 4. 实际生产文件清单与大小

完整86项相对路径、字节数和SHA-256见 [实际Pages产物清单](pages-local/pages-dist-manifest.json)。该清单文件本身SHA-256为 `6c261b68b8c7dc8c0a04ad6f2cd4ce2aa6d5214e300abfd2ad6bb20ce66b6a56`。这是本地已验产物身份，不是已上传artifact或线上文件清单。

| 产物 | 文件数 | 磁盘字节 |
|---|---:|---:|
| 任务开始时根路径dist | 86 | 43,049,720 |
| 修复后根路径dist | 86 | 43,049,783 |
| 修复后Pages dist | 86 | 43,050,301 |
| 两个GLB | 2 | 13,129,676 |
| PNG | 36 | 27,973,361 |
| WebP | 2 | 289,472 |
| SVG | 1 | 1,816 |
| Ogg | 37 | 399,664 |
| MP3 | 2 | 43,906 |
| JS | 1 | 1,138,247 |
| CSS | 1 | 70,123 |
| HTML | 1 | 437 |
| 原有公开素材说明README | 2 | 3,599 |
| maps/.gitkeep | 1 | 0 |

Pages约43.05 MB（十进制），不是实际首屏网络流量。构建器估算gzip约JS314.46kB/CSS14.08kB/HTML0.30kB，也不等于所有图片、模型和真实公网传输量。此轮不优化或删除任何素材。

- 生产入口：`assets/index-tevtnZEp.js`、`assets/index-C7hbd21C.css`；根预览入口仍为根路径，不能拿Pages包覆盖其正在使用的dist。
- 两个模型仅为正式v6（12,496,972字节）和米袋（632,704字节）。v1–v5、standalone的文件名及同内容哈希副本均0；原本地六个GLB保留且哈希不变。生产代码无旧模型URL、DEV端点及KeyZ/KeyC/KeyX。
- public的83项在根路径和Pages构建中逐字节相同；仅HTML/JS/CSS因base变更不同。39个音频未变，五项停用事件仍停用。
- 没有测试源码、工作流源码、私人配置、incoming-assets、地图备份、临时探针、source map、符号/硬链接等非预期材料。文本产物未发现Token、凭据或本机绝对路径；此检查不构成对未来新增素材的自动授权。
- 两个README为此前已公开的素材映射/来源说明，不是验收截图、测试脚本或私人材料；保留不改。官方上传action设置include-hidden-files=false，会略去唯一零字节`maps/.gitkeep`，因此**计划上传85个实际文件、字节总数不变**；工作流尚未运行，不能将该预计数量写成已部署结果。

门禁只接受Git追踪public清单和本次HTML入口的JS/CSS，校验每项存在、原字节、模型集合、路径、DEV引用和链接风险；失败即不上传。未来新素材仍需Git差异和来源审查，不能仅靠“已追踪”认定授权。

## 5. 严格子路径浏览器结果

使用独立Chrome154.0.8037.100、Edge151.0.4129.86无头真实浏览器实例，明确page.goto到临时端口的 `/who-ate-my-rice/`，核对完整URL、端口和标题。没有控制用户日常标签页或复用无法核验URL的页面。

静态服务只挂载该子路径；根`/assets/`、`/ui/`和缺失模型返回404，不提供HTML fallback伪装缺失资源。诊断用内存探针和磁盘原包分开测试，探针未写进src/dist。

| 检查 | Chrome | Edge |
|---|---|---|
| 双阵营×三难度诊断会话 | 6/6，通过实际运行配置核对 | 6/6，同左 |
| 另外未注入探针的原包会话 | 6/6，进入/暂停/设置/返回正常 | 6/6，同左 |
| DeepSeek玩家的Human倍率 | EASY .52 / NORMAL .64 / HARD .76 | 相同 |
| Human玩家的DeepSeek警戒距离 | EASY5 / NORMAL6 / HARD7；Human基线仍.52 | 相同 |
| 进食/目标/投掷物 | 每个米点30000ms、5点；36物件、3秒眩晕配置；点位一致 | 相同 |
| 原生键鼠移动、F拾取、左键瞄准/投掷 | 6组合执行；米白虚线、盆落地可复用 | 相同 |
| 暂停/设置/恢复/重开/返回 | 当前难度正确，重开保留；未修改玩法 | 相同 |
| 正式DEV隔离 | sceneEditor/devBPersistence均null；入口0，Z/C/X不旋转镜头 | 相同 |
| v6/动画/米袋与立绘 | 子路径加载、实际mixer存在；正常模型不换外观 | 相同 |
| 模拟v6请求失败 | 程序化角色可继续游戏，不请求旧GLB | 相同 |
| 模拟动画构造失败 | 程序化兜底，保留生产边界 | 相同 |
| 39音频解码 | 37 Ogg＋2 MP3全部非零AudioBuffer | 相同 |
| WIN/LOSE立绘 | 夹具触发原结算，win/lose图片子路径实际decode成功 | 相同 |
| 两卡Hover | 各内部连续移动10秒只一次；离开再进再一次 | 相同 |
| 方形设置Hover | SVG/文字子元素切换不重复 | 相同 |
| localStorage | 难度/音量刷新保留；无关哨兵及DEV预设不改，生产未读取DEV键 | 相同 |
| 原5173/4173 | 两浏览器均可访问；DEV编辑器实际打开/关闭，无保存POST | 相同 |

投掷验证为浏览器内存中设置合法隔离位置的场景夹具；不修改布局文件。结算立绘验证是夹具，不是自然吃完5份米的整局证据。12组合验证不代表12局自然完局、主观听感或统计平衡已重验；本轮不更改这些规则。

### 5.1 布局、滚动与请求边界

两个浏览器分别测试1920×1080、1707×864、1366×768、960×540、800×600，共10个视口。实际矩形核对标题在卡片前、设置区与卡片分离、底栏在卡片后；无横向溢出，难度面板未越出左右边界，底栏可滚动到达，免责声明能点击/ESC关闭。没有使用CSS zoom或统一scale；这些**不是原生90%～200%浏览器缩放验收**。

最终独立未注入探针的补充轮，两浏览器均实际完成6组合及刷新，资源HTTP失败0、requestfailed0、pageerror0；39音频全解码，正常请求均位于base下。请求URL与产物路径按大小写核对，无大小写不匹配。

**取消记录不删除：** 多轮诊断探针/刷新以及一次较早的Edge未注入轮出现v6 `net::ERR_ABORTED`，对应HTTP200，模型及动画实际就绪；根预览与另一次流式服务探针未复现，最终两浏览器未注入复验均0。不能据此宣称根因已彻底证明为探针或从未发生，也不能将这些记录写成404。作为线上复核观察项保留，不擅自改GLTFLoader/重试策略。故障注入v6失败的`ERR_FAILED`是预设测试条件，与正常网络数据分开。

截图：[Chrome首页](pages-local/chrome-menu.png)、[Edge首页](pages-local/edge-menu.png)、[Chrome暂停](pages-local/chrome-DEEPSEEK-pause.png)、[Edge暂停](pages-local/edge-HUMAN-pause.png)、[加载失败兜底](pages-local/chrome-load-fallback.png)、[动画失败兜底](pages-local/edge-animation-fallback.png)。完整分类记录见 [浏览器证据](pages-local/browser-results.json)。

## 6. 投掷物正式预览疑问

用户本轮询问4173未见道具。实际检查新实例加载`index-CaFW0uhI.js`，36个物件均GROUND、36个模型可见且挂在场景中，enabled=true；每件id/kind/X/Z与当前`throwableLayout.json`逐项一致，实际截图可见花瓶/小盒子。详见 [运行状态](pages-local/root-4173-props.json) 和 [4173实景](pages-local/root-4173-props.png)。

正式预览读取磁盘dist，不会实时同步5173内存编辑；保存JSON后要重新build，已打开的页面也需刷新/重新开局。本轮已完成该根路径构建，没有改道具点位或以重启未知进程代替同步。没有直接读取用户旧标签页，因此不把“旧页面缓存”写成已经证实的唯一原因。

## 7. localStorage与中国大陆无代理计划

详见 [完整存储审查及网络验收计划](GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md)。正式读写键仅项目命名空间下的difficulty-v1/audio-v1；DEV-B和旧布局键不进入生产持久化接线。没有泛用volume/settings键，没有localStorage.clear；本轮没有迁移、清空或修改用户存档。

GitHub账户不同Pages路径共享同一origin，路径不是存储安全隔离。未审查同账户其他仓库，不能保证别人没有复制相同前缀；也不声称本地5173/4173设置会自动迁到线上HTTPS。

实际故障注入见 [存储结果](pages-local/storage-faults.json)：Chrome/Edge的getItem拒绝、setItem拒绝均能启动/选择；**getter直接抛SecurityError时，两者现有ThreeGame音频参数求值导致启动失败**。这不是路径回归或键冲突。本轮仅存储审查且用户要求保持声音逻辑，未越界改ThreeGame；若要覆盖彻底禁用站点存储的环境，需批准这处最小安全获取修复，或者明确接受该兼容限制。

大陆计划保留真实电信/联通/移动×Chrome/Edge、至少两台电脑、冷/热缓存、不同时间及自然对局的空白记录；要确认系统/浏览器/路由上游无代理，记录DNS环境而不擅改DNS、hosts或TLS。本轮未上线，未在中国大陆三运营商执行该计划，不以本地HTTP、代理出口或远程搜索结果替代。

## 8. 工作流与待授权的上线流程

工作流仅workflow_dispatch，默认确认false；检查本仓库main及确认true，checkout固定github.sha。安装`npm ci --include=dev`，只在build步骤设置NODE_ENV=production及PAGES_DEPLOYMENT=true，防止安装时漏掉开发构建依赖。测试、独立tsc、build、diff和产物门禁后仅上传`./dist`。

官方action已核对远端Tag对应SHA及该SHA的action.yml，固定40位SHA：

| Action | 版本 | 固定SHA |
|---|---|---|
| checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| setup-node | v7.1.0 | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| upload-pages-artifact | v5.0.0 | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| configure-pages | v6.0.0 | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| deploy-pages | v5.0.1 | `368f82528645a54fb793d4d04e342629a3f51346` |

build只有contents:read；deploy依赖已验build，只有pages:write/id-token:write，github-pages环境；configure-pages设置enablement:false，不自动启用站点。配置base_path必须匹配`/who-ate-my-rice`后才部署同一artifact。没有PAT、新秘密、gh-pages分支或自动push/Release触发。

本地回归核对工作流契约、固定SHA及官方输入；**没有运行GitHub Actions，也未在远端验证Linux干净npm ci、Pages权限、环境保护或部署输出**。不将本地脚本通过当作CI已执行。[官方Pages自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[固定上传Action定义](https://github.com/actions/upload-pages-artifact/blob/fc324d3547104276b827a68afc52ff2a11cc49c9/action.yml)。

下一次仅在用户明确授权后：复核远端和待提交文件 → 精确暂存/正常提交推送适配快照 → 由批准的设置启用Pages Actions → 手动触发批准的main SHA → 检查实际HTTPS、资源及大陆访问。原rc1路径不适合作为网站回滚包；不移动其Tag，不预建rc2/v1.0.0。

## 9. 剩余风险与停止状态

1. 公网HTTPS、Linux真实Actions、Pages权限、跨运营商无代理访问均待上线授权后实测；当前没有网站上线结论。
2. 彻底禁止localStorage getter的现有启动失败需决定修复或接受兼容限制；不把普通存储读写回落成功夸大到所有策略。
3. 保留v6取消记录，线上观察HTTP、实际字节/模型动画及是否复现，不掩盖失败样本；最终原包本地复验两浏览器干净不等于全国网络保证。
4. 现有大chunk、原生缩放/全屏/低配长测、历史QA/统计平衡等边界沿用，不为这次路径修复补造验收。
5. 素材来源沿用最新ASSET_PROVENANCE和用户声明；本轮没有取得额外平台/音色/第三方品牌授权，也不将AI生成和非商用变成全面法律保证。

本地可安全工作到此结束，未进入新阶段。等待用户第二次验收；没有Git/上线授权时不自动执行下一步。
