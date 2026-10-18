# S19-P 首次GitHub Pages RC部署记录

日期：2026-10-16。仅首次RC测试版；不创建rc2/v1.0.0 Tag或Release，不代表S20验收完成。

## 1. 授权与提交前准入

用户批准第二次验收，允许修复localStorage getter故障，通过全部门禁后正常提交/推送已审核适配文件、设置Pages Source为GitHub Actions并手动部署该批准提交。异常停止，不强推、不自动重跑失败部署、不改变模型加载策略。

本报告创建时已完成本地准入；Git、Actions及公网结果在实际执行后追加，不预填成功。原`v1.0.0-rc1`仍指向历史里程碑870c69050cf80ff83aa79531e7d9f2590a8834d5，附注Tag对象b7194124e0c328ff59882642392e17c60f39ee28，Release ID414708471；不移动或修改。

## 2. 最小修复与测试

- 仅将ThreeGame创建GameAudio时的存储获取包入try/catch，getter不可用时传null。GameAudio源码、声音节点/播放/音量规则、玩法、UI、所有模型/地图/音频和36件投掷物布局不变。
- 新增`tests/audio-storage-startup.test.mjs`，提取并执行ThreeGame真实字段初始化表达式，覆盖正常存储、getter SecurityError、getItem拒绝、setItem拒绝及无存储共5项。先得到4通过/1失败，修复后5/5；真实Chrome/Edge各4种存储环境均能启动/选择，共8项通过。
- Node VM的直接全局typeof会抑制该getter异常，因此测试使用普通对象作用域保留真实异常语义；没有把错误的绿色测试当作修复证据。浏览器检验覆盖实际ThreeGame构造流程。
- 手动工作流增加必填approved_sha，并要求github.sha与之相等，避免main变化时部署未审核提交。原手动触发、生产限定、仅dist上传、最小权限和configure-pages enablement:false保持。

| 本轮重新执行 | 结果 |
|---|---|
| 全量npm test | 963/963；失败/取消/跳过0，最终约84.95秒 |
| 独立TypeScript | 通过 |
| 根路径生产构建 | 通过；保留4173根预览，未写入Pages base |
| 隔离Pages生产构建 | 通过；86文件、43,050,329字节，正式v6/米袋两个GLB；83public原字节 |
| 产物与diff | 只读门禁和diff通过；既有大chunk警告保留，不隐藏 |
| 哈希保护 | 原339项集合332项不变，7项为授权的5代码/配置及README/方案；地图、AI、平衡、声音、模型和投掷物点位不变 |
| 日志保护 | 本轮开工日志字节前缀保持，后续只追加 |
| Chrome/Edge本地回归 | 各6诊断组合＋6原包组合；v6/动画、投掷、暂停、设置、重开、DEV/ZCX隔离、布局/Hover和39音频完成 |
| 既有服务 | 原5173/4173及其监听进程保持；DEV编辑器只打开/关闭，无正式保存POST |

完整证据见 [本轮本地结果](s19-p/local-results.json)、[本地产物清单](s19-p/pages-dist-manifest.json)、[保护检查](s19-p/protection.json)。本轮根预览JS为index-DZaDEaTZ.js，Pages JS为index-Ca4juWGy.js；构建目录及临时浏览器使用隔离位置。

本地未注入轮Chrome网络失败0、Edge记录1次v6 ERR_ABORTED，模型/动画实际就绪、39音频均成功解码、pageerror均0。诊断及故障注入的取消/预设失败分别记录，不称为零异常，不为追求零日志修改加载策略。原 [pages-local证据](pages-local/browser-results.json) 与修复前存储失败记录完整保留。

## 3. 待提交边界

精确清单见 [本轮提交文件](S19_P_SUBMISSION_FILES.txt)，包括已验收Pages适配、此次最小修复、对应测试、手动工作流、说明及明确命名的验收证据。不使用git add .或-A，不提交dist、原GLB、私人配置、场景备份、incoming-assets或其他既有未跟踪验收目录。

只读GitHub预检确认main仍为原里程碑、现有登录具有admin/push/workflow权限，Actions启用、Pages GET404；未创建新Token。原Release已再次GET核对且不会使用Release写接口。

## 4. 部署与公网验证方法

门禁通过并复核远端后，正常提交、推送main。首次Pages仅配置build_type=workflow，不设仓库根目录为legacy发布源；手动工作流提交approved_sha并核对run.head_sha、build/deploy两job和同一artifact。原Tag/Release不动，不启用push自动部署。[GitHub Pages官方REST接口](https://docs.github.com/en/rest/pages/pages?apiVersion=2026-03-10)、[手动工作流接口](https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10#create-a-workflow-dispatch-event)。

公网一致性以GitHub Actions实际artifact为准：Linux检出的文本换行和Windows本地产物可能不同，不能强行要求跨平台JS哈希相同。下载同一成功run的github-pages artifact，核对来源提交/清单、模型及39音频，再逐项比较实际HTTPS字节与该artifact，不以HTTP200代替内容一致。

Chrome/Edge分别检查真实HTTPS菜单、双阵营三难度、暂停/设置/投掷、v6与动画/米袋、39音频、DEV/ZCX隔离和Network。内存诊断探针与未改动的公网原包分开，探针不上传。不将场景夹具或强制结算称作自然对局/胜率平衡。

大陆三运营商无代理计划仍按 [既定计划](GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md) 留待真实测试；当前受控环境的运营商、地理出口及代理状态未独立核实，任何可达结果都不能填写为大陆无代理验收。素材权利边界沿用来源账本，本次部署授权不是通用第三方权利保证。

## 5. 实际执行结果

### 5.1 Git与首次部署：已成功

- 精确审查、暂存并提交36个文件；提交标题`fix: prepare S19-P RC Pages deployment and safe storage startup`。
- 生产代码提交：`e9f361fce9dd5f392e2165ec2cf0b5f1148ed108`，已正常推送main；本地HEAD、origin/main及远端查询一致。没有强推、amend、清理或带Tag推送。
- 原`v1.0.0-rc1`附注对象/剥离提交保持不变；原Release用GET及内容指纹复核，ID414708471不变，没有创建rc2/v1.0.0或任何新Release。
- Pages由不存在的站点创建为`build_type=workflow`，HTTPS enforced=true，未使用legacy仓库根目录/源码发布源。手动调度一次，输入approved_sha为上述提交；无push自动部署。
- [Actions运行38897897043](https://github.com/yunzha-bot/who-ate-my-rice/actions/runs/38897897043)：event=workflow_dispatch，head_sha精确匹配上述提交，最终completed/success，build及deploy两个job均success。
- RC实际网址：[谁吃了我的米 RC测试版](https://yunzha-bot.github.io/who-ate-my-rice/)。这是首次RC网页部署，不是正式v1.0.0，不标记S20通过。

临时调度工具曾按旧API契约期待204；实际2026-03-10版返回200（含run ID/URL），已核对官方契约并通过GET找到唯一匹配此次时间/提交的运行。没有因工具断言重新触发，没有修改工作流或绕过任何CI步骤；手动调度总数仍为1。[官方成功响应定义](https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10#create-a-workflow-dispatch-event)

### 5.2 已执行的公网浏览器检查

在独立Chrome154、Edge151中明确导航实际HTTPS URL并核对标题。两浏览器各运行6个未注入的原包菜单/暂停/设置组合，再各运行6个只在浏览器内存中暴露观察对象的交互夹具；没有修改服务器文件。

| 公网项目 | Chrome | Edge |
|---|---|---|
| HTTPS、CSS、JS、立绘及子路径 | 实际加载；JS index-Ca4juWGy.js | 相同 |
| v6、骨骼动画、米袋 | 两GLB HTTP200；观察到实际v6外部模型和动画控制器 | 相同 |
| 双阵营×三难度 | 6/6原包UI＋6/6诊断配置/原生操作 | 相同 |
| 难度与规则 | Human .52/.64/.76，Human玩家对手警戒5/6/7；每米30000ms/5米、36道具、眩晕3000ms | 相同 |
| 移动、F拾取、鼠标瞄准/投掷 | 原生键鼠执行；仅在内存设置合法夹具，不写布局 | 相同 |
| 暂停、恢复、设置 | 正常；当前难度与选择一致 | 相同 |
| 39项音频 | 全部HTTP加载并解码得到非零AudioBuffer | 相同 |
| DEV/ZCX | DEV入口0，实例null，无DEV端点/旧模型请求，Z/C/X不旋转镜头 | 相同 |
| 本次v6取消 | 已记录会话中requestfailed0、pageerror0 | 相同 |

本次公网未复现取消不表示已“修好”该问题；旧记录仍保留、加载策略没有更改。原包会话出现泛化控制台404，随后**只读CDP分类确认根目录`https://yunzha-bot.github.io/favicon.ico`为404**；游戏资源记录无404。favicon是既有可选资源缺口，未为此擅自改线上内容，不宣称控制台完全无错误。详见 [公网浏览器原始结果](s19-p/public-browser.json) 和 [控制台只读分类](s19-p/public-console.json)。

截图：[Chrome公网首页](s19-p/chrome-public-menu.png)、[Edge公网首页](s19-p/edge-public-menu.png)、[Chrome公网暂停](s19-p/chrome-public-DEEPSEEK-pause.png)、[Edge公网暂停](s19-p/edge-public-HUMAN-pause.png)。首页截图等待入场过渡结束后另行只读拍摄，不把过渡中的透明画面当作布局故障。

### 5.3 停止原因：CI产物下载超时，完整公网验收保留

成功部署后，使用现有GitHub凭据下载同一run的Pages artifact进行本地逐文件核对，传输阶段报：

`The operation was aborted due to timeout`

未取得完整zip，未生成CI实际归档清单，随后85项预计公开文件的逐项字节/SHA-256比较**没有执行**。CI自身生产产物门禁及上传/deploy步骤成功，但不把这等同于代理已独立下载、核对全部公网文件。Actions部署来源SHA已核实，公网JS文件名与本地Pages入口一致；仍不足以冒充全部字节一致性证明。

已按用户要求停止所有后续发布操作：**不重试部署、不新增推送、不修改Pages/线上内容、不改加载策略、不创建Tag/Release**。超时不等于游戏无法打开；浏览器检查与产物下载原已并行启动，收集已启动的只读结果及控制台分类，不以其替代失败的归档核验。本节、最新交接/追加日志与公网证据仅保留本地，未在停止后另行push。

**结论：首次RC部署成功，公网主要功能实测通过；完整公网发布验收尚未通过。** 剩余必需证据是同一CI artifact与公网文件的全量字节/哈希核对；favicon404作为非核心已知缺口记录。若用户授权继续，只需恢复只读核验，无需重新部署。大陆电信/联通/移动无代理计划仍未实测，当前出口/代理状态未核实，不能将本次可达填写为大陆无代理通过。

完整执行摘要见 [部署结果](s19-p/deployment-result.json)。所有原始模型、场景备份、私人目录、既有1066项排除材料以及原5173/4173服务保持；源码没有部署后修改。

## 6. 同一次CI Artifact与公网SHA-256只读补验 — 2026-10-16

### 6.1 范围与来源锁定

用户仅授权剩余只读验证和本地记录。本次没有重建、重新发布、修改Pages设置、触发/重跑Actions、暂存、commit、push、Tag或Release操作。第5.3节的历史下载超时与较早v6取消记录完整保留；以下新证据只补齐原始产物与公网内容一致性，不回改历史事实。

- 固定 [Run 38897897043](https://github.com/yunzha-bot/who-ate-my-rice/actions/runs/38897897043)，run_attempt=1，completed/success，来源提交`e9f361fce9dd5f392e2165ec2cf0b5f1148ed108`。
- 原始`github-pages` Artifact ID：`12044274455`，未过期；创建于`2026-10-16T12:05:50Z`，到期时间`2026-10-23T12:05:48Z`。artifact.workflow_run的ID和head_sha均与指定运行一致。
- 同一来源的github-pages deployment ID为`7118498976`、状态success；站点仍为 [现有RC](https://yunzha-bot.github.io/who-ate-my-rice/)。核验前后远端main、原rc1 Tag/Release、Run attempt及artifact digest未变。
- [来源链证据](s19-p/hash-verification/source-chain.json)、[最终只读状态核对](s19-p/hash-verification/final-state-check.json)。仅使用现有凭据进行GitHub GET，不创建Token，不将凭据或临时签名下载URL写入证据。

### 6.2 原始归档下载与完整性

本轮首次单连接实测约40–45 KB/s，主动停止**本轮自己的核验下载进程**并保留部分文件；没有终止未知进程或5173/4173。第二次尝试对同一Artifact使用4个互不重叠的HTTP Range分段，单次请求超时上限660秒，每段均为206且Content-Range严格对应所请求范围。预设最多3次归档尝试，第二次成功后未再重试。分段耗时约9分29秒，没有重新生成任何构建。

| 原始CI归档检查 | 实际结果 |
|---|---|
| 下载ZIP长度 | 40,299,469字节，与GitHub artifact.size_in_bytes一致 |
| ZIP SHA-256 | `c21a3c56c507e681e0aab75ccebf928a72264ef281ad79e03ac8bbb6bf514e08`，与GitHub artifact.digest完全一致 |
| ZIP内容及CRC | 仅`artifact.tar`；所有成员CRC通过 |
| TAR边界 | 只允许普通文件/目录，检查重复路径、越界路径和链接；通过 |
| 实际公开文件 | 85个；解包文件总计43,050,329字节 |
| public来源复核 | 82个公开public文件逐字节匹配指定提交的Git blob；另有实际CI生成的HTML/JS/CSS各1个 |
| 生产边界 | 仅v6与米袋两个GLB；39项音频；无旧GLB、DEV端点/ZCX调试引用、源码测试/私人文件 |

解包探针最初遇到Windows默认文本编码误读含中文的临时状态路径；显式按UTF-8读取后复核通过。这是本地核验工具问题，不是CI归档损坏；原ZIP未改写，没有以本地或重生成的Linux构建替代。

原ZIP、分段、解包文件及临时校验脚本留在系统临时目录；原ZIP位置为`%TEMP%/rice-s19p-hashes-7X544l/ci-pages-attempt-2.zip`，解包目录为同级`original-ci-files/`。没有删除此前失败的部分下载或本地备份。[有限下载尝试记录](s19-p/hash-verification/ranged-download.json)、[完整实际文件清单与SHA-256](s19-p/hash-verification/ci-pages-manifest.json)。

### 6.3 逐项公网字节核验：85/85通过

按原始TAR的完整文件清单逐一GET正式HTTPS子路径，禁用重定向并要求HTTP200，核对响应实体内容长度与SHA-256。每个实际归档文件均有对应结果，没有从清单跳过任何游戏资源；独立汇总再次检查路径集合、数量、每项状态/长度/哈希一致。

| 文件分类 | 数量 | 实体内容字节 | 哈希匹配 |
|---|---:|---:|---:|
| Ogg / MP3 | 37 / 2 | 443,570 | 39/39 |
| GLB | 2 | 13,129,676 | 2/2 |
| PNG / WebP / SVG | 36 / 2 / 1 | 28,264,649 | 39/39 |
| HTML / JS / CSS | 1 / 1 / 1 | 1,208,835 | 3/3 |
| 已公开的资源README | 2 | 3,599 | 2/2 |
| **全部** | **85** | **43,050,329** | **85/85** |

8个响应实际带`Content-Encoding: gzip`，包括HTML、JS、CSS及两个GLB；使用Node fetch自动内容解码后的实体字节计算哈希，不把Content-Length当作文件大小。例如JS传输Content-Length为315,655，解码文件为1,138,275字节；v6分别为11,661,393与12,496,972字节，两者解码后均与CI原文件匹配。另用临时回环HTTP服务器分别验证gzip与Brotli解码得到原始样本，验证后关闭该临时服务器，未影响现有服务；不将该样本自检说成线上实际使用了Brotli。

- `maps/.gitkeep`原本被上传步骤排除，实际TAR中不存在；不属于未核对文件。历史旧GLB同样未进入原始CI产物，而非本轮从逐项核验中剔除。
- 浏览器自动请求的根`favicon.ico`不在原始产物清单内，沿用第5.2节404记录，不作为85项失败，也未修改线上修复它。
- **失败文件：无；未核验归档文件：0。** 公网逐项核验窗口为`2026-10-16T13:12:11.290Z`至`13:12:24.221Z`；这是该时间窗口的内容一致性证据，不是所有地区/未来时间的可用性保证。

证据：[每项公网状态/长度/哈希及内容编码](s19-p/hash-verification/public-files.json)、[内容解码自检](s19-p/hash-verification/content-decoding-check.json)、[最终核验摘要](s19-p/hash-verification/verification-summary.json)。

### 6.4 结论与保留事项

**同一次CI Artifact与公网全部文件的SHA-256核验真正闭合。** 现在具备指定提交→指定Run/Artifact→完整归档digest/CRC→85项实际文件→85项公网实体字节/哈希的一致性证据，第5.3节的这一必需缺口已由本节补齐。

本轮仅新增核验证据、追加本报告/日志并同步精简交接，没有修改游戏源码/测试/素材/部署工作流，336项开工保护文件哈希及历史日志前缀不变。未重跑npm test、TypeScript或构建：本次为只读网络与文档核验，且用户明确禁止重新构建；不将上一轮963/963写成本轮重新运行结果。执行文档`git diff --check`及证据完整性检查。

大陆电信/联通/移动无代理实测仍未完成，favicon404仍保留，素材授权边界和历史其他人工验收限制不因哈希匹配自动消失。此次不宣布S20或正式v1.0.0通过，不产生新Git检查点。报告、交接、日志和新增JSON均只留本地，完成后停止等待用户审查。

## 7. S19-P本地收尾归档与S20准入准备 — 2026-10-16

用户批准收尾/准入材料整理，明确仍不批准Git提交推送、重新部署、正式Tag/Release或S20 PASS。本轮重新读取已下载的原始CI ZIP，digest/CRC及全部85项TAR文件哈希再次通过；逐一对应第6节、public-files.json、manifest、来源链和摘要，85项记录均对应HTTP200、相同实体长度/SHA，失败0。未重新构建或重跑公网GET，不将原网络时间窗口写成本轮新实测。

原第6节及7份原始JSON不改，新增[本地收尾指纹索引](s19-p/S19_P_CLOSEOUT_EVIDENCE.json)记录它们的SHA、原始归档身份和复核范围；第6节指纹按UTF-8/LF文本从该标题到下一同级标题前的内容计算。文件归档仅在工作区，不等于commit/push，S19-P技术证据闭合不代替未获准的Git归档。

用户明确确认可使用《完整制作阶段.docx》的S19～S22相关Gate，不推断与(5)全文一致。已准备[S20 Web正式上线准入报告](S20_WEB_RELEASE_READINESS_REPORT.md)：S20最小其他电脑/无代理/至少一局自然对局表，S21不同网络3～5局单列；v1.0.0版本显示、Tag、Release及现有main工作流约束下的回滚方案待批准。原e9f…提交/RC及rc1 Tag/Release保留，不改源码、版本、观察项或线上内容。文档差异与保护检查通过后停止等待用户审查，S20未PASS、S21未启动。
