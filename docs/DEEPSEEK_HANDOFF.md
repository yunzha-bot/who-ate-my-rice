# DeepSeek Harness 项目交接

本文件是**当前开发状态与交接信息的唯一主要入口**：当前阶段、待办事项、授权状态、当前测试基线、近期问题与下一步计划都在这里。长期规则在 `AGENTS.md`；按时间追加的历史开发日志（每轮完成情况、测试结果、用户验收、BUG 记录、Git 归档信息）在 `docs/AGENT_LOG.md`（**历史细节以日志为准，本文件只保留当前状态摘要**）；数值索引在 `docs/GAME_BALANCE_CONFIG.md`；阶段专有参数、技术决策与验收要求见对应阶段设计文档。不要将本快照当作替代这些资料的唯一来源。

## 1. 项目概况

### 2026-10-16 S19本地快照归档（公开推送暂缓）

- 用户明确授权一次性完成精确暂存及正常本地提交；仅在公开分发证据齐备且远端无变化时推送，不创建Tag或Release。本轮复核仍缺两段MP3及38项既有素材的公开分发证据，因此采用完整本地提交策略，不执行push，不把本地归档当作阶段Gate或公开部署通过。
- 精确范围为 [193路径审查清单](verification/S19_RECOMMENDED_FILES.txt) 加 `public/assets/audio/basinHit.mp3`、`public/assets/audio/deepseekCaughtDefeat.mp3`，共195路径；两音频获准纳入本地快照但许可状态不变。1066项排除材料及私人目录保留，开发/正式共用源码，不提交dist或旧GLB。
- 本轮重新运行949/949（失败/跳过/取消0）、独立TypeScript、生产build及diff检查通过；330项保护哈希不变，dist86文件/43049716字节，六旧GLB及Z/C/X生产快捷键均缺席。只更新本交接和追加日志，不修改源码、玩法或素材；未重跑浏览器人工验收。
- 本地归档提交标题为 `feat: integrate S19 gameplay and production isolation`；真实提交落点及远端状态以Git查询和本轮回报为准。待核验素材的精确路径见 [许可清单](verification/S19_PENDING_MATERIALS.csv)，补齐证据后才能公开推送；历史审查中的未授权文字为当轮事实，不覆盖本次Git操作授权。

### 2026-10-16 S19候选快照提交前审查（等待许可及Git授权）

- 本轮只审查并新增清单/报告，不改玩法。远端main经ls-remote核对与本地审查基线一致，无新提交；暂存区为空，无合并/变基状态，未add/commit/push/Tag。
- 36个跟踪修改＋1220个非私人未跟踪文件逐项归类。最终建议193路径（含5份本轮审查交付），两个运行必需MP3因公开许可待核验单列；1066项本机材料排除且保留，三个私人目录未枚举/读取。另38项既有已跟踪米袋/部分立绘/UI保留原声明但平台许可证据待补，不认定违法或擅删。
- 工作区949/949、独立TypeScript/build/diff通过；HEAD只读归档＋候选运行输入在隔离副本也949/949及类型/build通过，两个MP3只供本地验证。330项代码/资产哈希不变；dist86文件/43049716字节，六旧GLB及Z/C/X生产快捷键缺席。没有重测自然浏览器对局或虚报人工验收。
- 详见 [提交前审查](verification/S19_SNAPSHOT_REVIEW.md)及其中精确清单。公开快照暂缓：先补音频及既有素材证据、确认S19人工验收和本清单，再取得普通Git提交/推送授权。Tag仍未授权，不推进Gate，不创建新阶段。

### 2026-10-16 正式预览同步及Z/C镜头隔离

- 按用户要求重新构建当前玩法到4173，Z/C旋转及配套X恢复仅在DEV5173处理，生产包三键字符串/操作分支均消除；正常镜头跟随、移动和用户视距不改。
- 949/949、生产工具5/5、独立TypeScript/build/diff通过。Chrome/Edge开发/生产双阵营8会话原生按键/移动/暂停正常，正式版视角不变、DEV仍可切换；另生产盆命中音4会话通过。八会话36道具位置匹配当前JSON，39音频dist哈希匹配原件；配置/AI/布局/模型/手持位置未改。
- 4173刷新使用新包 `index-BKlcUlW_.js`；未上传线上平台、未暂存/commit/push/Tag，不推进Gate，素材许可待核验。详情见 [同步报告](verification/PRODUCTION_PREVIEW_SYNC_REPORT.md)。

### 2026-10-16 两项旧回归前提修正（全量恢复通过）

- 复现确认：持续追逐守点不保证无时限对局十分钟内结束，不是锁门切断路径；道具旧1.8距离/现房间永久两件断言与当前合法编辑保存契约不符。仅改两个测试文件，不改AI策略、难度、玩法或用户布局。
- 固定路线保留12000帧、所有新增锁的剩余米点可达及最终结算要求；180秒施压后脚本Human沿真实寻路/碰撞离开，三档×三种子9组合全部结算。NORMAL/20276765为5/5；两组合Human提前抓捕获胜，不冒称全部AI胜利。道具按真实保存规则检查，保留36件及原稳定ID，新增3项非法边界/跨区回归。
- 最终948/948、定向2/2、道具编辑相关30/30，独立TypeScript/build/diff通过；源码/资产/两个布局哈希不变。仅测试/文档变化，本轮未重跑浏览器，不宣称自然整局或平衡验收；连续追逐仍可合法长时间不结束。详情见 [修正报告](verification/TEST_CONTRACT_FIX_REPORT.md)。
- AGENT_LOG仅追加，未暂存/commit/push/Tag，不推进Gate。下方943/945为音频轮历史快照，不再代表当前全量结果。

### 2026-10-16 DeepSeek娘被抓失败音（待试听）

- 用户NOPE.mp3原字节接入 `deepseekCaughtDefeat.mp3`，仅DeepSeek主控CAPTURED失败结算替换通用defeat，阶段切换播放一次；Human失败、胜利、抓捕动作声及此前盆命中音不改。44事件/37Ogg+2MP3，五项停用保留。
- 音频13/13、全量943/945，两个已知失败仍为AI固定路线结算及当前throw_closet_1旧初始距离断言；独立TypeScript/build/diff通过。Chrome/Edge生产4173四种结果各一次真实节点、解码和返回清理通过，使用结算内存夹具，不代表自然整局或主观试听。329项保护快照除3个获准实现/测试文件外均不变。
- 4173已重建，刷新试听；来源许可待核验，未暂存/commit/push/Tag，不推进Gate。详情及截图见 [音频报告最新节](verification/S13_AUDIO_REPORT.md)。

### 2026-10-15 用户MP3盆命中音（待试听）

- 用户“钢管 落地.MP3”原字节接入 `public/assets/audio/basinHit.mp3`，仅不锈钢盆真实命中角色触发世界音，落空/落地/撞墙及其他物件不触发；复用SFX/静音/距离遮挡/暂停清理，不改AI听觉。原37个Ogg及五项停用状态不变，用户自调手持0.60/0.55保留。
- Chrome/Edge生产4173双阵营实际解码、非零波形、单次播放节点、负例/静音/暂停通过；音效新增2回归通过，全量941/943，2失败为已有AI固定路线结算及当前布局不满足初始1.8点位距离断言。未改布局或放宽旧断言，TypeScript/build/diff通过，正式预览已更新。
- 来源按用户提供记录，公开再分发许可待确认，不推断原创或平台授权。验证见 [音频报告最新节](verification/S13_AUDIO_REPORT.md)；未暂存/commit/push/Tag，等待用户试听，不推进Gate。

### 2026-10-15 道具通用保存刷新回退修复

- 用户报告应用/保存后刷新回原位。隔离浏览器复现通用按钮忽略道具、顶部误显示已保存；已接通通用应用/放弃/保存及汇总状态。保留专用道具按钮，两文件仍独立，联合请求版本预检/共享保存锁/备份；正式布局无测试写入，用户已保存的家具调整保留。
- 新回归4项先失败后通过，相关37/37；本轮修前全量936/937，修后940/941，唯一相同旧失败为difficulty.test.mjs:263 NORMAL/20276765结算不达FINISHED，不改AI/地图掩盖。独立TypeScript/build/diff通过；Chrome/Edge原按钮链及联合修改/刷新/完整停启读取通过。
- 正式4173已重新构建，后续DEV保存新位置仍需重建才能同步正式预览。未落盘旧草稿无法自动恢复，需用户重新调整。报告与证据见 [保存Bug复验](verification/THROWABLE_EDITOR_REPORT.md)；未暂存/commit/push/Tag，不推进Gate。

### 2026-10-15 Human恢复及投掷物编辑（待用户验收）

- 按用户新要求取消Human试作，旧角色表现文件逐字节恢复；只撤销本轮自行新建的试作源码/测试，不删原模型或用户资产。现有投掷朝向、倒地、暂停简短文案保留。
- DEV5173原场景编辑器新增道具选择/拖动/XZ、独立应用和“保存道具位置”，权威数据仍为throwableLayout.json，不混写家具文件；非法位置和版本冲突拒绝，自动备份。轨迹改米白虚线，眩晕明确批准为3000ms，其他数值不变。
- 全量937/937、独立TypeScript/build/diff通过；Chrome154/Edge151生产双阵营及隔离5183真实拖动/输入/保存/HMR刷新/完整停启读取通过。正式两个布局JSON及资产未改，未暂存/commit/push/Tag。说明和截图见 [道具编辑验收](verification/THROWABLE_EDITOR_REPORT.md)；停止等待用户摆放及手感反馈，不推进Gate。

- 2026-10-15 暂停提示按用户要求简化为“游戏已暂停。”，不改其他文案、布局或行为。全量932/932、独立TypeScript/build通过，Chrome/Edge生产4173实际暂停文本核对通过；未Git归档。

### 2026-10-15 生活投掷物（已实现，待用户试玩）

- 按用户完整提示词及补充规则：18个可玩区域各2件，共8花瓶/18盒子/10盆；F近距拾取，左键按住瞄准并面向真实落点、松开投掷，右键取消。花瓶/盒子实际投出后一次性消耗，盆落地500ms后可回收；双阵营玩家都可使用，NPC可受击但不新增自动投掷策略。
- 新眩晕2000ms复用FALL/STUN，阻止玩家/NPC移动、进食、抓捕和技能/门操作，进食保留进度、恢复重准备；暂停冻结时间，重开复位。物件/状态单一权威，连续保守XZ扫掠遵守动态门及旋转家具，不做越墙抛掷/碎片物理或新胜负规则。
- 开工915/915，最终932/932（失败/跳过/取消0），独立TypeScript/build/diff通过；新增17项回归，包括先移动角色再扫掠射弹的实际接线时序。Chrome154/Edge151生产4173双阵营投掷/四向朝向/取消/消耗/盆实际走近回收、NPC及玩家受击禁用/恢复、真实进食中断重准备、重开/刷新/销毁通过；命中及玩家受击用明确场景夹具，不冒充自然整局。另12难度组合仍通过。
- 独立权威点位 `src/three/map/throwableLayout.json` 不改原家具表；标准5183隔离DEV保存/自动重启重连/刷新/完整停启后，110家具/15HideSpot/36物件及独立JSON保留，正式地图未写。337项开工哈希332不变，仅5项获准实现变化，旧参数除新增块逐字节保留，模型/音频/AI/难度原件不变。
- 参数入口 `GAME_CONFIG.throwables`，操作和证据见 [投掷物报告](verification/THROWABLES_REPORT.md)。连砸与回收盆压制可能影响平衡，待人工试玩；旧S17–S19快照不是此新玩法的胜率结论。正式预览已重建，未暂存/commit/push/Tag，不更新Gate；本轮完成后停止。

### 2026-10-15 暂停难度显示及追捕速度回调（待用户手感验收）

- 用户反馈普通追捕偏强、困难过快；本轮仅把Human AI普通/困难移动倍率0.78/0.95改为0.64/0.76，简单0.52不变。Human主控的DeepSeek AI、其他追捕/破解/搜查参数及玩家速度/技能、30秒/5份、地图/资产均保留；用户自调镜头viewHeight=8原样保留。
- 暂停菜单只显示“当前难度：简单／普通／困难”，不展示倍率、对手AI或DEV-B预设信息；开发工具仍可核查实际值。全量915/915、独立TypeScript/build通过，正式4173已更新；Chrome/Edge两阵营三档实际配置及暂停/重开/刷新专项证据见 [难度验收最新记录](verification/DIFFICULTY_REPORT.md)。新速度尚待用户试玩，不宣称统计平衡。
- 本轮仅2处实现和1个测试文件，以及必要设计/索引/报告/交接/追加日志。既有S1/S2/S17–S19成果保护，旧验收是历史快照；未暂存/commit/push/Tag，不推进阶段Gate。

### 2026-10-15 S17–S19兼容/性能/RC准备（待集中人工验收，未归档）

- 用户授权一次性执行及生产DEV隔离；没有进入S20、发布站点、创建新整理阶段或调整版本号。最小修复生产DEV对象/存档读取/监听/调试标签生成、无消费者调试分析、失焦自动暂停与READY冻结；DEV编辑器和已冻结会话保留原行为，回到窗口不自动恢复。
- 最终914/914（失败/取消/跳过0）、独立TypeScript/build/diff通过。522项开工哈希516不变，仅6项获准既有实现/测试改变；GAME_CONFIG、AI、难度、地图110家具/15HideSpot、v6/动画/头发、37音频不变，五项声音继续停用，旧日志前缀保留。
- Chrome154/Edge151开发5173/生产4173共24组合、12生产故障、4开发旧模型回退、8次卡内10秒Hover通过；正常/兜底、暂停/设置、实际按键吃米中断恢复/躲藏/门/PulseLock检查通过。NORMAL两阵营各两浏览器共4局真实时间自然结算，不冒充真人QA或统计胜率。标准5183隔离副本真实保存/自动重启重连/刷新/完整停启读取通过，5184生产POST404，正式地图未写。
- dist84文件/42,987,210字节，六旧GLB及旧URL均0，原件保留；其余82静态/CSS产物哈希不变。RTX4060的1080p短时rAF约144FPS、首屏本机transfer约16.17MB；前后负载不严格一致，不声称固定倍数提升或低配达标。
- 原生90%～200%缩放、F11/对局中全屏、低配硬件/长测及最终主观体验仍待人工确认；S14教学/S15十局QA/S16三十局统计证据未核实，不补写Gate。v6按用户原创授权，米袋/部分立绘/UI平台许可仍未全核实，技术RC通过不等于允许直接公开部署。
- 详见 [S17–S19验收报告](verification/S17_S19_RC_REPORT.md) 与 `verification/s17-s19/`。未暂存/commit/push/Tag/Release，不更新阶段Gate；临时服务关闭，原5173/4173保留，停止等待用户集中验收。

### 2026-10-15 最终工程收尾复验（技术通过，等待最终人工验收）

- 用户再次授权收尾；核对确认生产v6→程序化、开发旧回退链和精确过滤已落实，本轮未发现新Bug，源码/测试/配置/资产修改0，不开启新阶段，保护此前首页设置布局。
- 重新运行908/908（失败/取消/跳过0）、独立TypeScript/build/diff通过；522/522保护哈希不变，173B/46C不删，原日志前缀保留。dist84文件/43,163,759字节；六旧模型名称/哈希匹配0、生产旧URL0，本轮构建前后相同。
- Chrome154/Edge151开发5173/生产4173共24正常组合、12生产故障、4开发回退及两尺寸两卡各10秒Hover通过；标准Vite全新5183副本两浏览器真实保存/自动重启/重连/刷新/完整停启恢复通过，正式布局未写，临时服务已关闭。
- 工程技术验收通过、技术发布验收通过；米袋/部分立绘/UI等未提供平台的许可证据仍未全核实，不声称全素材授权通过。详见 [最终报告最新复验](verification/FINAL_ENGINEERING_REPORT.md)及 `verification/final-engineering/recheck/`。未暂存/commit/push/Tag，不更新Gate；到此停止等待用户最终验收。

### 2026-10-15 阵营选择页右侧设置区（待用户UI验收，非新工程阶段）

- 首页声音/难度改为右侧90px方形按钮；宽屏向左展开，小窗口正常流/紧凑布局，底部难度占位移除。保留原两卡尺寸、素材、内部排版；复用现有声音组件和难度状态，不改音频、AI、数值或玩法。
- Chrome154/Edge151开发六视口逐项核对卡片几何/内容不变、各六阵营难度组合实际配置；五路声音/静音/刷新保存、ESC共享设置、两个按钮各10秒Hover节点验证通过。生产预览另八视口/两阵营进入通过；低高度面板内部滚动不挡底栏。
- 相关15/15、全量908/908、独立TypeScript/build/diff通过；343项开工哈希337不变，仅6项授权既有源码/测试变化。报告及截图见 [首页设置验收](verification/MENU_SETTINGS_REPORT.md)。原生浏览器缩放和最终位置审美仍交用户确认；既有favicon404/大chunk提示保留。
- 原S1/S2/收尾成果及日志前缀保护，未暂存/commit/push/Tag，不推进Gate或新阶段；完成后停止。

### 2026-10-15 最终一次性工程收尾执行（技术通过，待人工验收/归档）

- 经用户明确授权，生产仅首选v6，加载/动画失败使用现有程序化兜底；生产加载器与精确过滤名单同步，六旧GLB均无dist名称/哈希匹配、生产JS无旧URL，开发仍保留v6→v5→standalone。所有GLB原件、玩法/地图/AI/音频/UI不动。初始化失败重复释放2次已最小修复为1次，清理部分初始化引用。
- 标准Vite隔离副本使用原npm dev命令、默认配置加载器及完整监听，Chrome/Edge保存POST/备份→服务自动重启→浏览器自动重连/重载→手动刷新→Ctrl+C停止/重新启动→再次读取全部通过；正式布局未写，临时服务关闭，原5173/4173保留。此前工程有条件通过的保存缺口已关闭，不改正式Vite/编辑器。
- 最终901/901（失败/跳过/取消0）、独立TypeScript/build/diff通过。开发/生产24组合、生产12组故障兜底、开发4组回退、生产Hover两尺寸各卡10秒均通过。最终dist84文件/43,157,676字节；518开工哈希仅4项授权实现/测试改动，514项不变，173B/46C不删除。
- 工程技术范围无条件通过，生产技术构建通过；不等于人工验收/Git Gate或全素材授权通过。旧GLB分发阻断已通过不分发解除，米袋/部分立绘/UI及派生输入的具体AI平台条款仍未核实，不推断平台。详情及最终清单见 [最终工程报告§1](verification/FINAL_ENGINEERING_REPORT.md)，原§2～§10为历史快照。
- 本轮仅3处实现文件、1项既有过滤测试、2个新增回归文件及必要报告/证据；未add/commit/push/Tag，不新增整理阶段。技术上建议进入提交审查，仍须最终核对素材许可与文件清单、用户另行授权；完成后停止。

### 2026-10-15 阵营卡Hover重复播放修复（普通Bug，不新增阶段）

- 确认容器pointerover对子元素切换冒泡，旧处理器无relatedTarget边界检查；仅在ThreeGame原委托处理器过滤同一button内移动，箭头仍为原span，无独立音效。视觉/素材/点击/冷却与S1/S2成果不变。
- 原生短复现4次实际音频节点→1次；Chrome154/Edge151在1366×900及800×600，两卡各持续10秒跨图片/标题/文字/箭头移动额外播放0，离开重进及两卡切换各1次，双阵营箭头点击与返回正常。
- 新增3项回归，相关17/17、全量893/893（失败/跳过/取消0）、独立TypeScript/build/diff通过。详见 [Hover修复报告](verification/UI_HOVER_FIX_REPORT.md)。未暂存/commit/push/Tag，不解除下述工程/公开部署条件；完成后停止。

### 2026-10-15 最终工程整理与收尾（待人工验收，不新增整理阶段）

- 保留S1/S2全部源码与构建成果，本轮不改源码、测试、配置、地图、模型、音频或UI，仅新增最终报告/证据并同步交接、追加日志。工程整理有条件通过；公开部署暂不允许，两结论独立。
- 本轮重新运行890/890（失败/跳过/取消0）、独立TypeScript和生产build通过；最终dist仍86文件/67,570,763字节，与S2全部路径/哈希一致。517项本轮保护、S1的107项及S2的337项均不变。
- Chrome154/Edge151在开发5173及预览4173共24组合启动/移动/模型动画头发/音频节点/暂停设置/布局及销毁通过；4次失败回退确认v5/static仍有用途。隔离5183的原保存插件实际POST/备份/刷新在两浏览器通过，正式地图未写；临时配置模块监听被关闭以避开runner保存触发的重启噪声，标准配置保存后重启恢复仍未完整验收，故工程有条件通过。
- 173项候选最终105项有明确用途关系、10项高置信未参与当前运行、58项执行条件不确定默认保留；全体未删，46项C保护。详情与精确候选提交路径见 [最终工程报告](verification/FINAL_ENGINEERING_REPORT.md)，不把清单当暂存授权。
- v5/static共24,412,984字节仍在本机dist，用户公开授权只覆盖v6，不得直接部署整份产物；需准确文件授权证据或明确批准替代回退部署策略。未add/commit/push/Tag，不更新Gate，不延续下文S2历史建议为新阶段；完成本轮后停止等待人工验收。

### 2026-10-15 工程整理S2：生产资源审计与安全瘦身（待人工验收）

- 在第一轮14个既有跟踪改动及未知材料上继续工作，全部保护。只新增精确构建过滤插件及5项测试，Vite接线不改sceneLayoutSave/默认开发端口；v1～v4仅移除dist生成副本，public原件、v6、v5/static回退及全部运行源码/资产不动。
- dist为117,535,171→67,570,763字节、90→86文件，减少42.51%；其余86文件哈希完全相同，不冒充首屏网络下载节省。337项开工保护文件及第一轮107项均一致，第一轮报告原样保留。
- 本轮开工885/885、最终890/890（失败/取消/跳过0），独立TypeScript/build/diff通过。Chrome154/Edge151在开发5173及生产预览4173各6组合共24组合通过；另4次生产模型失败回退证明v5/static仍有用途。DEV真实草稿/放弃/导出/未应用保存拒绝与revision读取通过，未POST实际保存地图。
- 173项只读复核：95项有历史副本/离线加工依赖，10项高置信未参与当前正式运行，68项需手工动态验证；全体未删，3个A类.gitkeep及46项C类继续保护。完整体积、哈希、逐文件审计、网络及截图见 [生产资源报告](verification/PRODUCTION_ASSET_OPTIMIZATION_REPORT.md)。
- 发布风险仍在：本机dist保留约24.41MB的v5/static回退，既有来源声明只授权v6，不能直接公开部署整份dist。预览为http://127.0.0.1:4173/，开发仍5173；原生缩放/主观试听/自然整局/正式写盘未重做。未add/commit/push/Tag，不更新Gate、不进入第三轮，等待用户验收与后续授权。

### 2026-10-15 第一轮工程整理（待用户审阅，未归档）

- 已完成全仓范围扫描及低风险实际整理：DEV只读投影移出ThreeGame，暂停/结算按钮和3处时间格式复用，清理13项未使用项及23条被完全覆盖的CSS声明。ThreeGame 3573→3475行；补齐清理逻辑后src总行数净增18，不声称全项目减行。
- 修复反馈timer/animation监听、安全路线视图、DEV-B订阅、整实例地图/米点/DOM释放及编辑器beforeunload注销；不改正常保存/恢复、AI或玩法。Chrome154/Edge151六组合、5种CSS视口、暂停/设置/重开/制作信息、销毁及隔离DEV-B保存刷新通过，选定computed style前后一致；原生缩放/自然整局未重做。
- 本轮基线878/878，最终885/885（失败/取消/跳过0），独立TypeScript、生产build及diff检查通过；可选noUnused诊断仍有2项在未改AI中，既有大chunk告警保留。107项保护文件哈希不变，包含配置、权威布局、v6、音频及持久化模块。
- [工程整理报告](verification/CODEBASE_CLEANUP_REPORT.md)登记222项审计台账：A类3个占位文件、B类173个待核实文件、C类43个保留文件及3个私人目录，全部未删；第二轮仅优先考虑报告列出的3个零字节.gitkeep，仍待用户批准。新发现发布风险：本机6个被Git忽略的旧GLB仍会复制到dist，不应未经审查整份部署。
- 已核实上一公开快照在远端main；本轮未暂存、commit、push或Tag，不更新阶段Gate。没有清理未知文件、访问私人目录或修改受保护资产；下一步停止等待用户审核第二轮实际范围。

### 2026-10-14 已验收成果正式公开归档

- 用户最终确认S13主观试听、三档难度真人平衡体验、原生浏览器缩放人工验收通过，并明确授权本次普通commit和push到origin/main；不创建Tag或Release，不进入新功能开发。
- 提交范围为S13／ESC设置、难度与30秒正式进食、DeepSeek AI锁门防困、菜单响应式及相关测试／文档／精选截图。42个事件接口、37个实际原创Ogg，五项脚步／冲刺／开关门声音继续禁用；EASY Human倍率0.52、5份米目标、地图及正式v6原样保留。
- 本次重新运行全量878/878（失败／跳过0）、独立TypeScript、生产build与diff检查通过，既有大chunk告警保留。公开审查清单和排除边界见 [发布审查](verification/S13_RELEASE_REVIEW.md)；原始JSON／探针／未知素材／场景备份及私人目录不纳入。
- Git发布标题为 `feat: complete S13 audio, difficulty modes and responsive UI`；具体检查点与同步状态以 `git log -1`、`git ls-remote origin refs/heads/main` 及发布回报核对，不在文档写死当前SHA。下面各轮待验收、未归档文字为当时快照，不覆盖本次用户最终确认。
- 已知非阻断限制仍保留：favicon缺失、软件Edge曾有阴影着色器日志（默认硬件Edge复测未复现）、未作统计胜率或新增FPS测量。试听／体验通过不等于消除全部潜在问题。

### 2026-10-14 阵营页响应式修复（实现轮记录，最终验收见上）

- 已复现960×450下难度覆盖卡片86px且无法有效滚动；移除四份旧CSS的菜单覆盖，新增 `src/faction-menu.css` 作为唯一入口。标题→卡片→难度→底栏改正常流，卡内身份／立绘／说明分区；窄窗口单列、短窗口可滚动，保留素材、配色和原文案。
- 复用现有声音设置：首页挂标题栏并参与布局，暂停仍挂原overlay。没有改难度、30秒进食、AI、地图、角色、音频或游戏内HUD／ESC／PulseLock设计；226项任务前哈希对照仅7个预期既有源码／样式变化。
- 独立受控Chrome154／Edge151确认127.0.0.1:5173与标题后，各13种CSS视口全部通过、52次双阵营进入／暂停／返回及难度／制作信息／声音设置交互通过。**视口变化不是原生浏览器缩放**，原生90%～200%仍交人工验证，未重试受限原浏览器宿主。
- 本轮全量878/878（失败／跳过0）、独立TypeScript、build及diff检查通过，既有大chunk警告保留。截图、根因、修改清单和边界见 [响应式验收报告](verification/MENU_RESPONSIVE_REPORT.md)。未Git暂存／提交／推送／Tag，不改变阶段Gate状态。
- 控制台额外核对：现有favicon404未处理；软件Edge有阴影着色器日志，默认RTX4060／Direct3D11新实例双阵营复测未复现，未改渲染器或资产。详情与原始日志在报告，不宣称所有控制台零错误。

### 2026-10-14 三档难度、正式30秒进食及AI锁门防困（实现轮记录，最终验收见上）

- 用户明确授权的EASY／NORMAL／HARD已接入，仅覆盖对手AI的6＋5个指定字段；EASY基础Human倍率仍0.52。所有档位实际使用production30000ms/份＋原400ms准备，5份胜利规则和玩家技能不变。档位锁定新局、重开沿用、首页可重选，偏好损坏安全回落EASY；ESC显示当前档位。
- DEV-B预设原样保留，但不再刷新／新局自动应用，须显式加载；本局调试覆盖优先于难度并显示标记。新局清覆盖回到难度基准；调试展示与AI日志记录本局有效AI配置。
- 压力回归复现NORMAL的浴室双门自锁；经用户追加批准，只加强DeepSeek AI自动锁门前的安全检查，当前所有门锁＋拟锁门后全部未完成米点均须有合法路径，保留合理锁门。原种子三档5/5结算；额外9局核验8次锁门，覆盖5个房间，未切断剩余米路。
- 最新全量门禁874/874（失败／跳过0）、独立TypeScript、build、diff检查通过。Chrome154与Edge151在明确URL下各6组合键鼠／生命周期及受控加速整局结算通过；Chrome原生按住E实测20%／50%／30000ms完成。自动化与受控回放不等于真人整局／胜率验收，S13主观试听状态不变。
- 设计与调整入口见 [难度说明](DIFFICULTY_DESIGN.md)，参数、六组合、真实截图、锁门复现／修复及文件清单见 [验收报告](verification/DIFFICULTY_REPORT.md)。地图、110件家具、15个HideSpot、正式v6与动画未改。未暂存、提交、推送或Tag，未更新阶段Gate=PASS；下一步仅交用户集中试玩与平衡验收。

### 2026-10-14 代码结构审计与数值准备（调整前文档快照）

- 已完成当前工作树的结构／复杂度审计，未重构或调整数值。报告含15项审计发现、226项 GAME_CONFIG 读取目录及170项可填写的有效玩法／技术／结构字段，另列3个进食模式入口，见 [审计与填写表](CODEBASE_BALANCE_AUDIT.md)。用户尚未选择实施范围，不能据此启动重构或平衡修改。
- 审计时的状态：Human AI 0.52；进食development5秒／份；38项DEV-B保存预设刷新／新局恢复。上述进食与自动恢复已由后续授权的难度任务更改，见上节；14项配置未见读取、PulseLock芯数固定3等其他审计发现不据此自动修复。
- 需决策的已复现冲突：9项声音range的DEV元数据／说明写“只影响新事件”，实际代码和现有测试均要求即时影响存量事件；强度／寿命才取生成快照。报告A15按真实行为记录，未更改源码或替用户选择目标语义。
- 本轮重新运行 `npm test` 850/850（失败／跳过0）、独立TypeScript通过；纯文档轮未重跑build或浏览器／胜率测试。源码、测试、脚本和布局内容保持不变，未Git归档；S13试听与其他既有待验收状态不变。

### S13 音频与反馈实现记录（2026-10-13，最终验收见上）

- 2026-10-13 用户试听后撤回普通脚步、冲刺脚步、冲刺启动、开门和关门五个新音效：对应 Ogg 已删除，播放入口禁用，生成脚本不再生成。保留事件接口供以后替换；其余 37 个音频与 AI 声音感知不变。此前 Chrome 播放验证是撤回前的历史结果，不代表当前仍播放。本轮未归档 Git。

- 页脚最新微调：按用户要求删除左下红色四边形伪元素，仅保留声明、入口和细线；Chrome检查及849/849、TypeScript/build/diff通过，未Git归档。

- 免责声明页脚按新参考去掉独立黑色矩形底板，改透明叠字、无框入口、左下红色短条与细分隔线；场景底部使用连续渐暗辅助阅读，弹窗/文案不变。Chrome1366/960检查与849/849门禁通过，未归档。

- 按用户要求移除阵营页底部CONTROL操作提示，保留对局内按键提示、阵营卡及制作信息底栏；Chrome实际页面检查通过，849/849、独立TypeScript/build/diff检查通过。未Git归档。

- 阵营页新增底部制作信息/免责声明栏和原生模态弹窗，版本读取package.json（v0.1.0）；Chrome/Edge四种尺寸、按钮/ESC关闭、双阵营进入与原暂停流程通过。最新门禁849/849、独立TypeScript/build/diff检查通过，等待视觉验收，见[制作信息验收](verification/MENU_CREDITS_REPORT.md)。未Git归档。

- UI后续调整：常驻HUD压缩为310×75px两行信息条；首页采用顶部刊头、中央顶边对齐双卡、底部说明，声音设置收起时为小入口。卡内设计不变；Chrome/Edge双阵营与960/1366/1920首页检查通过，848/848门禁通过，详见UI更新报告末节。等待用户视觉验收。

- 最新UI更新：除两张阵营选择卡外，玩家界面统一为暖白蓝绿“家居便签”风格；ESC初次打开聚焦面板，不再自动高亮继续按钮，Tab焦点保留。Chrome/Edge双阵营、1366/960窗口检查及848/848门禁通过，待用户视觉验收；细节见[UI更新报告](verification/UI_REFRESH_REPORT.md)。未修改地图、玩法或正式资产，未Git归档。

- 暂停/结算移除重复角饰后，已修正透明底板与留白丢失的问题；暖白底板、结算立绘与按钮文字恢复。Chrome受控胜负/暂停截图和960/1366/1920px适配证据见验收报告；等待用户视觉验收。

- 脚步、冲刺启动及开关门五个音频事件现已禁用且无对应文件；锁门、解锁及 AI 声音感知不变。
- 最新补充：声音设置已接入ESC暂停菜单，五路0–100%滑块/静音/恢复默认/持久化及ESC逐级返回；新增真实资源阶段加载页、超时与安全降级。Chrome/Edge双阵营原生键鼠、实际GainNode与播放节点、刷新、重开及加载故障验证通过，截图/证据见报告最新补充节。吃米浮动文字为“我吃”。
- 当前保留 42 个音频事件 ID、37 个原创合成 Ogg、统一音量设置、音乐与环境音切换及轻量反馈；此前 Chrome154 与 Edge151 的独立受控浏览器双阵营验证为历史结果。完整事件表、资产对应、截图和限制见 [S13音频验收报告](verification/S13_AUDIO_REPORT.md)。
- 修复异步音乐叠加、重开短音残留、解码后并发上限、暂停期间循环解码取消、首次倒计时漏音、继续操作漏音、完成米咀嚼残留、墙后NPC反馈泄露和减少动态偏好；真实键盘验收另发现并修复声音滑块被全局方向键拦截的问题。没有修改GAME_CONFIG、AI、地图、模型或动画。
- 最新门禁850/850（失败/跳过0），独立TypeScript、build及`git diff --check`通过。849/849、848/848、846/846、初轮842/842与S13前839/839为历史基线。音频返回HTML和自动播放拒绝均安全降级；受控重开与返回无额外循环残留。
- 主观听感、真实OS失焦/后台恢复、自然多局试玩与硬件FPS仍待用户验收。Headless切页未产生真实失焦，已另行验证注入blur/focus的实际接线；暂停期间Hover静音，error资源没有专属业务入口。不得写成完整人工验收通过。
- 本轮未暂存、commit、push或Tag，S13未达到归档Gate。下一步仅集中人工试听/试玩；下方S13前提交审查与方案B说明为历史状态，不覆盖本节和当前正式v6记录。

### 当前正式角色资源（2026-10-12）

- DeepSeek玩家与NPC首选 `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`，共用现有骨骼动画与头发动态；程序化角色用于加载失败回退。正式v6纳入公开快照，旧版本留在本机。下方方案B模型排除记录为此前状态。
- 本机与全新公开副本浏览器实测两阵营均加载正式v6，模型响应哈希一致、动画与头发动态有效；S13前正式v6公开快照已归档，提交与远端状态用Git现场查询。本轮不修改模型。

### 2026-10-12 提交前专项修复（人工验收通过，待提交授权）

- 已复现原21项失败，修复过时的碰撞测试环境与布局夹具；`npm test` 现为 **839/839**，无失败/跳过；独立 TypeScript、build、`git diff --check` 均退出0。以下818/839等为历史审查结果，不是当前门禁。
- 用户本轮明确确认保留 Human AI 倍率 **0.52** 与 `hide_storage_shelf` 半角 **60°**；未改任何玩法数值，只同步注释、文档与测试。S7A 的0.92为历史批准值，不再是当前配置。
- 110件家具、15个HideSpot及权威布局文件哈希不变。真实浏览器双阵营进入正常，Human局中DeepSeek AI吃完5份米并结算；DeepSeek固定种子局Human AI于01:04完成抓捕。用户现已明确确认门、PulseLock成功/失败、躲藏进入/退出、DEV保存后刷新恢复全部通过；最终只读核对磁盘哈希与保存接口revision一致。
- 逐项失败根因、修改清单和验证限制见 [专项修复报告](PRE_S13_TEST_REPAIR.md)。专项修复测试基线为839/839。当前公开快照按方案B准备：4个混元3D GLB本机保留但不发布，授权未确认；其余资源按用户已确认来源声明管理。详见 [快照审查](PRE_S13_SNAPSHOT_REVIEW.md)。

- 方案B前的公开审查曾把4个混元3D模型许可待确认列为阻断；用户已决定将该4个GLB及内嵌贴图从公开清单排除。其它资产依用户来源确认管理；不把旧审查状态当作当前范围。

- 来源记录：DeepSeek模型由腾讯混元3D官方网页免费版生成，之后Blender优化、骨骼绑定与动画、导出GLB并接入Three.js。其网页协议仍无法核实免费输出与内嵌贴图的公开再分发条件；该模型因此排除于本次Public快照。核查见`ASSET_PROVENANCE.md`，未使用其它腾讯产品协议或开源许可证替代。

- 2026-10-12公开快照方案B：用户授权先发布代码和可公开项目资源，暂不发布4个混元3D角色GLB及内嵌贴图。四文件未在当前索引或`origin/main`历史中发现；本机文件原位保留，并以精确路径加入`.gitignore`。公开副本`npm ci`、839/839测试、TypeScript和build通过；但真实浏览器双阵营缺模型游玩验收未完成，Computer Use宿主因无法确认浏览器URL而中止。根据条件授权，暂不暂存、commit或push；后续继续完成人工/浏览器验收，再按149项清单复核。

### 2026-10-12 S13 前开发快照审查

- 用户要求将当前玩法、角色/动画、UI、家具与地图成果整理上传；本轮先完成文件与门禁审查，**必须再次获得用户确认后才 commit / push**，不创建 Tag。S13 音频与反馈尚未开始，不因快照审查标记新阶段 Gate 通过。
- 当前真实 DEV 编辑器显示 SAVED、草稿 UNCHANGED、未保存修改：否；权威 `src/three/map/sceneLayout.json` 含110件家具、15个藏身点，磁盘 SHA256 与保存接口 revision 一致。本轮未写回或恢复任何布局。
- 本轮实测 `npm test` **818/839，21项失败**；动画/头发/米袋/PulseLock/健身区定向18/18，独立TypeScript、build、diff检查通过。21项失败名称与上一轮米袋记录一致，不代表已修复；以下旧章节的全绿数字仅为历史轮次基线。
- 运行角色现为 `deepseek_animated_v6_hair.glb`，回退v5与静态模型，测试还读取v2；米袋已接入用户模型优化后的自包含GLB。旧动画、截图和调试文件按清单保留本机不上传。
- 该次快照审查发现Human AI 0.52与旧0.92说明冲突；已由上方专项修复及用户确认处理。快照仍不是正式发布验收。
- 完整拟提交/排除清单、失败名称、资产体积与边界见 [S13前快照审查](PRE_S13_SNAPSHOT_REVIEW.md)。原有未提交成果保留，待用户确认是否按当前状态归档。

《谁吃了我的米》是双阵营单机追逐游戏：DeepSeek 娘尝试吃完每局随机激活的 5 份米；Human 通过抓捕赢得对局。玩家可选择任一阵营。现有玩法包括门、冲刺、米堆、抓捕、双向感知及两套按阵营启用的 AI。

- 主工程：Web / Three.js 3D 灰盒 Alpha，面向桌面 Chrome / Edge。
- 技术：Vite、TypeScript、Three.js、原生 HTML / CSS；Phaser 不属于运行时技术栈。
- 启动：`npm install`（仅新环境需要），`npm run dev`——根目录 `vite.config.ts` 固定 `host 127.0.0.1` / `port 5173` / `strictPort: true`，端口被占用时直接报错退出而不是静默换端口；网址固定 `http://127.0.0.1:5173/`（用 IP，不要用 `localhost`）。
- 检查：`npm test`、`npx tsc --noEmit`、`npm run build`、`git diff --check`。**2026-10-04「区域级放大」轮（当前工作区）的实测基线为 `npm test` 782/782、`npx tsc --noEmit` 退出码 0、`npm run build` 退出码 0、`git diff --check` 退出码 0。** 上一轮（东翼扩建）的基线与更早的 S7D 开发轮基线（743/743）分别记录、不互相冒充。
- 正式设计的大米时长为 60 秒；当前开发配置从 `GAME_CONFIG` 的开发/正式模式选择，当前开发测试值为 5 秒。发布前须切回正式值并重新验收。

根目录的主要结构：

| 路径 | 职责 |
|---|---|
| `src/main.ts` | 查找 `#app`，载入 CSS 并创建 `ThreeGame`。 |
| `src/three/` | 场景、主循环、相机、输入接线、碰撞、Door/Rice/View、DEV 面板。 |
| `src/three/map/` | 公寓地图数据和场景构建。 |
| `src/systems/` | AI 控制器及 Rice、Door、Navigation、Perception、Sprint、Match 等玩法系统。 |
| `src/config/gameConfig.ts` | 唯一游戏可调数值来源 `GAME_CONFIG`。 |
| `tests/` | Node 内建测试运行器的逻辑、集成及回归测试。 |
| `docs/` | 阶段历史、地图和数值规格、AI 状态树、交接材料。 |
| `public/` | 浏览器静态资源。 |

## 2. Git 与资料边界

本次归档快照的 Git 边界：当前目录是指定 Web 主仓库，分支 `main`，远端为 `origin`。HEAD、远端同步状态及最近提交均以 `git status`、`git log -1`、`git rev-list --left-right --count origin/main...HEAD` 查询，不在此写当前 SHA。DEV-B、S7C-1B、S7C-2 与 S7C-2b 均已通过各自的人工验收；S7C-2b 的归档提交标题为 `feat: add autonomous deepseek npc hiding`。阶段历史与旧检查点见 `docs/AGENT_LOG.md`。`.trae/` 与 `.dsh-meow/` 是用户资料，必须保留，不得读取、暂存或提交。

本文件当前状态更新于 2026-09-27。**S7C-2 已完成阶段 Gate（集中浏览器人工验收通过 + 日志记录 + commit + push 成功）**，提交范围为 67 个文件；当前分支、HEAD 和远端状态一律以 `git log -1` / `git ls-remote origin refs/heads/main` 查询，不在此写死 SHA。**S7C-2b（DeepSeek AI 自主藏身）已由用户完成集中浏览器人工验收 8/8 PASS 并归档；S7C-3（出生点与门初态随机化）用户集中人工验收 8/8 通过，已随检查点 `420d8a6` 归档；DEV 场景编辑器 V2（布局保存 / 恢复 / JSON 导入）用户集中人工验收 9/9 PASS，已随归档提交进入 `main`——完整 SHA 一律用 `git log -1` 现场查询。** `.trae/` 与 `.dsh-meow/` 是用户资料，必须保留，不得读取、暂存或提交。

`dist/` 是可再生成的构建产物，`node_modules/` 是安装目录；二者不提交。不要把导出的临时 AI JSON 日志、密钥、个人配置或本机专属配置加入仓库。不要手工改写 `.git/` 历史。并行的 UE 工程不属于此 Web 仓库任务，不得由本次交接触碰。

**全项目通用开发规则与执行规范**（`AGENTS.md` 的长期规则章节，含 Git 基线与工作区保护、开发阶段授权、测试与人工验收、开发环境、已验收功能保护、Git 归档与提交报告、文档维护，以及「阶段专属开工要求不保存在 `AGENTS.md`；开始任一阶段前须先读该阶段设计文档并逐项确认其中的待批准项」这一规定）已整节收录在 `AGENTS.md`，**本文件不重复复制整套规则**，只在此引用；两者冲突时以 `AGENTS.md` 为准。

当前状态：S7B 已整体通过阶段 Gate；S7C 已批准子阶段均已归档；S7D 已通过用户最终集中验收，本轮获准正式 Git 归档（以实际远端核验为准）。DEV-A、DEV-B 与 DEV 场景编辑器 V2 均已通过各自验收并归档。Human AI `CHECK_HIDE` 与 DeepSeek AI 自主藏身都已是真实运行状态；S8 尚未授权。

当前未归档专项：Human 玩家手动破解锁门改为三锁芯 PulseLock 时机面板；核心逻辑、UI 与自动化回归已实现，等待用户浏览器人工试玩验收。Human AI 仍使用自己的计时解锁流程，旧扫雷 UI 不再接入正式游戏。本项尚未获得 commit / push 授权。

2026-10-10 DeepSeek 第四阶段按用户放宽局部蒙皮要求的新授权，已制作七个动作并将 `deepseek_animated_v2.glb` 接入玩家/NPC；保留120%比例、第三阶段静态GLB和程序化回退。18,500三角面、25骨骼、7动作。真实Chrome状态/回退检查通过，完整测试799/801（仍是两项既有Human AI失败），最终v2定向15/15、TypeScript与构建通过。**Eat抬手偏低、Hide为浅蹲，袖口/发尾瑕疵保留；游戏躲藏时HideEnter/HideIdle随角色隐藏，只在独立预览完整可见。等待人工验收，未提交、推送或标记Gate通过。** 详见[第四阶段动画验证](verification/DEEPSEEK_ANIMATION_STAGE4/README.md)。第三阶段静态资产与此前证据保留。

2026-10-06 用户选定的六张正式 UI Sheet 首次接入后，用户人工验收为 **FAIL**：不透明矩形裁片外露、技能与 E 提示白底过重，米进度像椭圆。2026-10-07 已完成素材集成修正，原 Sheet 保留；派生裁片加入透明异形边角，HUD 纸底按组件降低不透明度，五格米饭改用 Sheet C 原有碗图标，动态数据继续由 DOM / TypeScript 提供。提取规则与映射见 [素材说明](../public/ui/README.md)。本轮 `npm test` 789/791（仍是两项现存非 UI 失败），定向 UI 回归 16/16，TypeScript、构建和 `git diff --check` 通过。真实对局已截图双阵营 HUD、E 藏身/离开、吃米、开/关门及米进度 0/5→1/5；PulseLock 仅在正式组件独立复核页验证外观，**尚无自然对局截图**。修正等待用户复验；未提交、未推送，不标记 Gate 通过。

## 3. 实际运行架构

### 2026-10-12 当前增量：家庭健身区（待人工验收，未归档）

用户明确授权南走廊/东走廊开放改造。保留 `south_hall` / `east_hall` 区域ID与边界，移除共同边 `x=16,z=7…19` 及其D24；其余30门保持位置与原D编号，区域图以开放连接替代该门。新增7件普通器械家具与2张附属无碰撞瑜伽垫，原103件家具、15个HideSpot、米点与出生点均与开工备份一致。真实Chrome双阵营四向通行/器械绕行、NPC局部追逃、编辑器四向鼠标拖动、旋转、实际保存、刷新与服务重启检查通过。完整测试815/836、21项失败与卫生间轮同名；独立TypeScript、构建通过。具体范围、截图与限制见 [家庭健身区验证](verification/HOME_GYM/REPORT.md)。不代表人工验收或Gate通过；不进入下一阶段。

### 当前专项：Gameplay 住宅「区域级放大」+ 外围建筑 parcel 约束（待集中人工验收）

最新增量（2026-10-04）：上一轮把可玩区域做成了「加房间」，用户指出方向偏差——要的是**保持区域结构与功能关系，把整个 Gameplay 住宅的空间尺度放大**（房间更宽、走廊更宽、家具间距与门距更大、追逐更舒展），而不是继续加小房间。本轮据此重排整张平面：**房间数（18）、房间连接关系、31 扇门的配对、6 条环路、东翼结构全部不变**，做法是把由 `ROOMS` 边界唯一化得到的旧网格线逐条映射到新网格线，每个房间仍由同一组网格线下标区间定义，因此拓扑是**构造上保证**不变。尺寸：`MAP_WIDTH 48 → 56`、`MAP_DEPTH 30 → 38`，平面重新以原点为中心（收回旧图西侧 `x ∈ [-24,-18]` 那段被墙封死的不可达余量）；房间总面积 `1143 → 1950`（×1.71），各区域倍率区间 `1.47–1.87`，主客厅 / 主卧 / 厨房 / 储物间在上档，阳台 / 北阳台 / 走廊 / 玄关 / 车库在下档。**家具一件都没有放大**（仍是同一套人物比例），只补了 8 件普通家具（32 → 40），因此多出来的面积全部是可活动空间。藏身点仍是 8 个（锚点随家具搬家，ID / 类型 / 绑定 / DEV-A 区域参数未改），米点仍是 14 个且房间归属不变。外围街区改成显式的 **Parcel / Footprint 模型**（`MIN_BUILDING_GAP` / `PARCEL_SETBACK` / `describeResidentialLayout()` / `assertResidentialLayout()`），联排住宅改为共享整段基座与分户墙、所有坐标改为从住宅 bbox 推导，并新增「地块包含 + 地块不重叠 + 建筑不压道路/人行道/路缘/停车/绿化/住宅 + 同排共墙 / 不同建筑最小净距」的自动检查。**`GAME_CONFIG`、AI 决策、S7D 判据、技能 CD、胜负条件、玩家声音可视化状态均未改动。** 只读顾问 Codex 独立核算确认拓扑未被破坏，并给出三扇「可删」的门与相机 `viewHeight` 建议——两者都**只记录、未采纳**，留给用户拍板。**已知兼容性变化**：世界盒与导航格变化使同一 `matchSeed` 不再复现上一轮的出生与门初态；整局种子扫描发现 31 个种子里有 3 个在 150 秒上限内不再结算（放大后路程变长的观测量，非缺陷）。范围、限制与门密度分析见 `docs/MAP_SPEC.md`；未进行 Git 归档。

上一轮（2026-10-03 东翼扩建与外围街区加密）记录保留如下，其结论现已被本轮的网格重排取代：在不改动原有 12 个房间任何坐标的前提下向东加一整翼（房间 12 → 18、门 18 → 31、`MAP_WIDTH` 36 → 48），外围按「道路 → 人行道 → 地块 → 建筑 → 小院/停车」加密。范围与限制见 `docs/MAP_SPEC.md`。

### 当前专项：Alpha 表现优化（待集中人工验收）

最新增量（2026-10-03）：保留大头宽肩角色、程序化迈步和平滑转向，以及厚墙门洞修复；外围由四边道路框改为贯穿主街、偏置支路和服务巷，配四栋低对比背景建筑及局部生活设施。最新完整门禁实跑 763/763 自动化、TypeScript 与构建通过，真实 Three.js 全景及游戏菜单截图已取得。街区构图、多扇门连续交互和角色移动仍待用户人工验收。详细范围与限制见 `docs/ALPHA_POLISH.md`；未进行 Git 归档。

2026-10-02 在暖色住宅表现基础上完成整体构图与正式 UI 重设计：放宽镜头、降低墙体表现高度、放大角色表现子节点，重构菜单、阵营差异 HUD、READY、暂停与结算。最新实跑 755/755 测试、独立 TypeScript 和构建通过。未修改 `GAME_CONFIG` 或 S7D AI，玩家声音表现仍停用，未提交或推送。浏览器复核不替代用户验收；长按交互与 Human 完整结算尚未充分覆盖，不能标记专项 Gate 通过。具体尺度、证据边界和验收清单见 [ALPHA_POLISH.md](ALPHA_POLISH.md)，历史结果见日志末尾。本轮不进入 S8。

1. `src/main.ts` 创建 `ThreeGame`。`src/three/ThreeGame.ts` 初始化 Three.js Scene / Renderer / OrthographicCamera、白模地图、角色、门和米视图，负责每帧调度及 HTML HUD。
2. `ThreeGame` 将玩家正式阵营、临时输入目标、AI 输入、碰撞移动和状态结果接到各系统。AI 仅在相应正式玩家阵营时运行；暂停、结算、另一角色的开发临时接管期间不夺取控制。
3. `src/systems/HumanAIController.ts` 实现 Human 的巡逻、调查、追逐、抓捕、搜索及门决策；**`CHECK_HIDE` 已在 S7C-2 接入为真实状态**。玩家侧藏身与 Human 玩家 Q 搜查已在 S7C-1B 实现并验收。
4. `src/systems/DeepSeekAIController.ts` 实现 DeepSeek 找米、进食意图、威胁回避、好奇和安全通行、SAFE_WAIT 及本次条件关门。它只接收当前系统提供的视觉、声音、Last Seen 和独立 Human 静止信息，不应增加隔墙读取 Human 实时位置的逻辑。
5. `src/systems/NavigationSystem.ts` 提供共用 XZ 网格 A*，查询 `DoorState`、静态碰撞和可选避让区。最终角色移动仍走 `CollisionWorld`，禁止由 AI 瞬移或绕过实体碰撞。
6. `src/systems/DoorSystem.ts` 是门状态唯一来源，支持真实 `OPEN / CLOSED / LOCKED` 状态、toggle、DeepSeek 锁门、Human 解锁/强破与 reset。`ThreeGame.applyDoorResult()` 将门状态同步至 `DoorView`、动态碰撞及门声音。
7. `src/systems/PerceptionSystem.ts` 提供 SoundEvent、距离/墙门遮挡听觉、Vision/LOS、Last Seen、RiceTrace。`HumanStillness.ts` 单独按 Human 实际移动维护静止时长与事件 ID，遮挡不会停止其计时。
8. `src/systems/RiceField.ts` 与 `RiceSystem.ts` 持有大米进度、准备和进食规则；两个阵营的 AI 都不能私建第二套进食计时或直接判胜。`GameStateSystem.ts` 按既有 5/5 米完成及 Human 连续有效抓捕规则裁决胜负；`SprintSystem.ts` 持有冲刺、摔倒和眩晕规则。
9. `src/config/gameConfig.ts` 导出 `GAME_CONFIG`；所有可调玩法参数由此定义，改动时同步 `docs/GAME_BALANCE_CONFIG.md`。地图坐标和状态枚举仍属于相应地图/系统。
10. `src/three/DebugDetailsPanel.ts` 和 `ThreeGame.ts` 展示可收纳 UE Details 风格 DEV 面板。`src/systems/AILogCollector.ts` 以状态快照差异和显式事件记录 AI JSON；面板提供当前局导出。
11. **DEV-B 实时 AI 调试工具**（开发环境专用，接入 DEV 面板，不替换场景编辑器）：`src/systems/RuntimeDebugOverrides.ts`（仅内存的参数覆盖层，38 项白名单）、`src/systems/DevBRuntimeBinding.ts`（半径变化清空抓捕进度、新局清覆盖、有效速度）、`src/systems/DevBParamStore.ts` + `src/systems/DevBParamPersistence.ts`（2026-09-27 持久化轮新增：本地预设的存档格式 / 严格校验 / 三态，以及只经 `RuntimeDebugOverrides.restore()` 的应用路径）、`src/systems/DevBObserver.ts`（只读状态整理）、`src/three/DevBView.ts`（抓捕圈 / 视觉距离圆 / 真实视线 / AI 路径 / 声音事件）、`src/three/DevBPanel.ts` + `src/three/DevBDebug.ts`（面板与编排）。感知与两套 AI 通过可选 `SoundTuning` / `OcclusionTuning` / `VisionTuning` / `setRuntimeTuning()` 读取有效值；正式 `GAME_CONFIG` 始终只读。
12. **S7C-1B 藏身与 Q 技能**（用户浏览器人工验收 6/6 通过，已归档）：`src/systems/HideSystem.ts`（纯逻辑藏身状态机：E 点按立即切换、每条拒绝路径、退出原因与事件）、`src/systems/HumanSearchSkill.ts`（Human Q 扇形判定核心，与按键、冷却、特效分离）、`src/systems/HideInteractionArbitration.ts`（E 键唯一仲裁；当前工作副本为 PulseLock > 门 > 藏身 > 进食）、`src/systems/SkillCooldown.ts` + `src/systems/SkillGates.ts`（两个 Q 的冷却与门禁）、`src/three/HideSearchView.ts`（扇形特效与命中家具临时高亮，几何体只创建一次）、`src/three/map/MapApplicationPrecheck.ts`（地图应用前只读预检）。`ThreeGame` 负责接线：`VisionSystem.setConcealed()`、抓捕资格门控、`GameStateSystem.forceCapture()`（复用同一条抓捕结算）、藏身期间位移/冲刺/进食/锁门封锁、普通 HUD 技能提示与 DEV `Hide / 藏身` 分类。
13. **S7C-2：Human AI 搜查与玩家交互提示**（功能实现及集中人工验收通过，已随检查点 `f243047` 归档推送）：Human AI 仅以公开线索搜查家具；Human 玩家 Q 优先抓捕暴露目标，否则只搜查指向的一件家具；DP 娘白色轮廓提示 E 仲裁下唯一可用家具或米堆。非法站位、朝向和过期计划不计为搜空；公开几何通过后才读取权威占用。逐轮细节见阶段设计文档与 docs/AGENT_LOG.md。
14. **S7C-2b：DeepSeek AI 自主藏身**（用户集中浏览器人工验收 8/8 PASS，已归档）：`src/systems/DeepSeekHideCandidates.ts`（公开候选层：区域内的真实空闲导航格心 + A* + 公开评分）、`src/systems/DeepSeekHideResolution.ts`（权威进入层与出口物理判据，玩家 E 与 AI 退出共用同一条公式）、`HideSystem.enterAsAI()` + 游戏层每帧签发的一次性令牌、`DeepSeekAIController` 的 `HIDE` 状态 + `DeepSeekHidePhase`、`NavigationSystem.freeCellsWithin()`（只读）、DEV `Hide` 分类 8 行 AI 字段与 AI JSON `formatVersion` **1.6**。AI 只读公开信息，不读藏身点占用、不读 Human 实时位置、不引用玩家专用的白色轮廓与按键仲裁。

15. **S7D：整局遥测与整局回归**（2026-09-27）：`AILogCollector` 新增 `matchSummary`（`formatVersion` **1.7**）——随机种子 / 玩家阵营 / 阶段 / 胜负与原因 / 时长 / 完成米数、门开·关·锁·解锁·强破与冲刺 / 摔倒 / 藏身 / 搜查 / 强制抓捕的**有界计数**、S7B-3A 与 S7B-3B 的逐条门操作证据（各上限 50）、AI 卡路与异常状态（`LOCAL_LOOP` / `NO_ROUTE_TO_RICE` / `SAFE_WAIT_THREAT_PERSISTS` / `HIDE_LONG_CONCEALMENT`，折叠成「首次时间 + 持续时长」，上限 100）。`ThreeGame` 只在既有事件点上同步计数，**不新建第二套时钟或事件来源**。整局回归测试见 `tests/s7d-full-match.test.mjs`，无头整局仿真器见 `tests/s7d-match-sim.mjs`（**逻辑仿真，不是实机**），批量与浏览器证据见 `docs/verification/S7D/`。

## 4. 阶段进度

| 阶段 | 当前记录 |
|---|---|
| S0 | `AGENTS.md` / 历史日志没有独立 S0 Gate 记录；不推断其验收。 |
| S1 / S2 / S3 / S4 / S4.5 / S5 | 均已完成：S1 最小运行工程 `v0.0.1`、S2 一房一米 `v0.0.2`、S3 最小完整对局 `v0.0.3`（Gate = PASS）、S4 追逐原型 `v0.0.4`（Gate = PASS）、S4.5 Three.js 3D 技术迁移 `v0.0.5-tech3d`（Gate = PASS）、S5 完整 3D 灰盒地图 `v0.1.0-alpha`（Gate = PASS）；细节见 `docs/AGENT_LOG.md` 与 `docs/MAP_SPEC.md`。 |
| S6A–S6D / S6 Alpha | 已完成并封版（S6 里程碑 `v0.2.0-alpha` 以实际推送结果为准）；S6D 声音、Vision、Last Seen、米痕和控制观察者切换经过验收。 |
| S7A | Human AI、共享角色动作接口、高级决策和可收纳 DEV 面板已通过 Gate。历史验收接受0.92倍率与8,750 ms自动解锁；2026-10-12用户另确认当前倍率0.52，解锁耗时不变，S16仍待授权复评。 |
| S7B-1 | DeepSeek 自主选米、寻路、开普通门、吃完五份米；用户确认人工验收 PASS。 |
| S7B-2 | 威胁感知、逃跑、脱险恢复及静止 Human 好奇/安全通行专项通过用户人工验收。偶发原地停留仍是优化待办。 |
| S7B-3A | 主动关门（条件式逃脱关门）：用户 5/5 浏览器人工验收 PASS。 |
| S7B-3B | 主动锁门与逃脱策略：3B-0b 接口、3B-1 决策核心（含「关门遮挡视线」冲突修复 = 关门侧向证据）、Sprint 30 秒冷却与冲刺期间门交互协调、3B-2 防振荡（用户 5/5 人工验收 PASS）、3B-3 定向回归、3B-4 DEV / 日志 / 文档收尾——**全部完成并已并入检查点 `6a92c5d`**。 |
| S7B overall | **已完成，阶段 Gate = PASS**：用户已确认全部获批功能整体验收；S7B-1、S7B-2（含静止 Human 好奇／安全通行专项）、S7B-3A、S7B-3B 均有对应日志、测试记录与已推送 Git 检查点。S7D 已完成整局稳定性验证，但偶发原地停留仍保留观察，不代表潜在问题已全部清零。 |
| S7C-1A | 藏身点白模与地图配置：8 条 `HideSpot` 数据 + 2 个纸箱 `FURNITURE`，**未接入任何玩法**。**用户浏览器人工验收 PASS（2026-09-26）、阶段 Gate = PASS**，已并入稳定检查点 `3191bec` 并推送 `origin/main`。 |
| DEV 场景热编辑器 V1 + 双阵营调试冻结 | 独立 DEV 工具轮（不计入 S7C）：`DevFreezeSystem`、`MapEditModel`、`SceneEditorView / SceneEditorPanel / SceneEditor`。**用户浏览器人工验收 PASS（2026-09-26，五项）、阶段 Gate = PASS**，已并入稳定检查点 `3191bec` 并推送 `origin/main`。 |
| DEV-A 第一轮 | 藏身交互区域的数据与几何基础：8 条 `HideSpot.interactionRegion`（床与纸箱圆形 2.0 / 1.2，衣柜与柜架扇形 1.6·55°）、圆形／扇形精确几何、合法位置检查（真实 `CollisionWorld` + 真实 `NavigationSystem` + 瞄准家具可接近表面）、离散采样预览接口、`SceneEditor` 字段透传、13 项新测试、`docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`。**用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，随检查点 `d4462e9` 建立（实际 SHA 以 `git log -1` 查询）。 |
| DEV-A 第二轮 + DEV-A-FIX-1 | 区域编辑器：可编辑区域半径／扇形半角（`REGION_AUTHORING_LIMITS` 半径 0.5–3、半角 10–150°）、家具移动或旋转时锚点跟随、区域类校验拒绝码、JSON 导出升为 **V2**、DEV 面板「交互区域预览」开关 + 按 `code` 着色的离散采样点与图例（精确轮廓与离散采样分开呈现）；以及**流畅拖动**（延迟校验窗口 `beginDeferredValidation` + 释放时校验一次、预览对象长期复用）。**用户浏览器人工验收：第二轮区域编辑／预览／校验／JSON V2 及旧功能回归全部通过；FIX-1 流畅拖动 5/5 PASS；阶段 Gate = PASS**，随本轮提交建立检查点。**阶段 Gate = PASS**，随本轮提交建立检查点。 |
| DEV-A-FIX-2 | 家具任意角度旋转与 JSON **V3** 导出：`Rect.rotation` + `RotatedRect.ts` 统一旋转几何（约定同 `THREE.Object3D.rotation.y`）、`CollisionWorld` 的 `OrientedObstacle` 真实旋转碰撞（包围 AABB 仅粗筛、轴对齐路径数学逐字未改）、`rotationQuarter`→`rotationDeg`（0°–359.9°）与可关闭的 15° 吸附（默认关闭、不进 JSON）、房间边界改为四角点均在房间内、家具重叠改为真实 SAT、门洞改为与膨胀门叶真实重叠、关联锚点与 `facing` 同步旋转、编辑器/导航/遮挡全部改用真实旋转轮廓。**用户浏览器人工验收 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，随本轮提交建立检查点。**DEV-A 已批准范围至此全部完成**；未完成的 DEV-A 相关项只有 JSON 导入器（刻意未开发）与进入/退出锚点拆分（未决定）。 |
| DEV-B（实时 AI 调试工具） | 已完成批准范围并经用户浏览器人工验收 6/6 通过。最终验证：`npm test` 472/472、`npx tsc --noEmit` 通过、`npm run build` 通过、`git diff --check` 通过。38 项临时参数仅在内存中生效，正式 `GAME_CONFIG` 不变；完整功能、限制与测试清单见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`，历史见 `docs/AGENT_LOG.md`。|
| DEV-B 本地预设（运行时调试参数持久化） | 独立 DEV 工具轮：`DevBParamStore.ts` + `DevBParamPersistence.ts` + 面板三个按钮与三态状态行。**用户集中人工验收 10/10 通过**；本次归档前复测 `npm test` **727/727**、TypeScript、构建及差异检查通过。仅开发构建读取独立本地预设，刷新与新局可恢复；恢复正式值不删除预设。Git 归档结果以提交与远端记录为准；规则见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §12，浏览器复核见 `docs/verification/DEV-B-PARAMS/`。 |
| S7C-1B | 玩家基础藏身交互 + Human 玩家 Q 扇形搜查/手动抓捕 + DeepSeek 玩家 Q 锁门冷却：**浏览器人工验收 6/6 通过，并由提交 `db8dfe6` 归档**。数值来源：`GAME_CONFIG.humanSearch`（半径 1.5、半角 60°＝张角 120°、冷却 12 秒）与 `GAME_CONFIG.door.playerLockCooldownMs`（20 秒，只有 `lock()` 返回 `LOCKED` 才开始计时）。未新增藏身音效；未实现 Human AI 的 `CHECK_HIDE`、DeepSeek AI 自主藏身与地图随机化。 |
| S7C-2 | **已实现并完成 Gate = PASS**：Human AI 公开线索循迹与家具搜查、Human 玩家 Q 暴露目标优先和单件家具搜查、DP 娘家具与米堆唯一指向轮廓。非法站位、朝向或过期计划与合法搜空分开；只有公开几何通过后才读取权威占用。用户已确认集中人工验收通过；Git 归档已建立并推送（67 个文件）。详细规则及各轮历史见 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §4 与 `docs/AGENT_LOG.md`。本轮实测自动化测试 642 项通过，TypeScript、构建及差异检查通过。 |
| S7C-2b | **已完成集中浏览器人工验收 8/8 PASS 并归档**：DeepSeek AI 自主候选选点、真实导航格心走位、一次性令牌 + 真实位置复核的权威进入、按公开条件的自主退出，以及同点冷却 / 失败记忆 / 近期点惩罚 / 连续上限等循环抑制。用户要求人工验收与 DPH 的浏览器复核分别如实记录，不得互相改写。规则见 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` §4.10（实现结果 §4.10.14）。本轮归档轮实测自动化测试 670 项通过，TypeScript、构建及差异检查通过。 |
| S7C-3 | **已完成，阶段 Gate = PASS（用户集中人工验收 8/8 + 日志 + commit + push）**：随机出生、随机门态、追逃通行、固定种子、AI 藏身与搜查、生命周期、地图热应用及旧功能；§5 / §6 第 15–18 项的取舍已确认。随检查点 `420d8a6`（`feat: randomize match spawns and initial door states`）归档并推送。 |
| S7C 后续 | S7C-1B、S7C-2、S7C-2b 与 S7C-3 均已归档。下一阶段尚未获得开发授权。 |
| DEV 场景编辑器 V2（布局持久化） | 独立 DEV 工具轮（不计入 S7C，2026-09-27 用户一次性授权）：`MapLayoutStore.ts` + 编辑器三条入口 + 开机恢复。**用户集中浏览器人工验收 9/9 PASS，阶段 Gate = PASS**，随归档提交进入 `main`。归档轮实测 700/700、tsc 0、build 0（JS 1,001.11 kB）、`git diff --check` 0；规则见 `docs/DEV_SCENE_EDITOR_DESIGN.md` §11，证据见 `docs/verification/DEV_SCENE_EDITOR_V2/`。 |
| S7D 双阵营完整 Alpha 开发与整局验证 | **用户最终集中验收通过，正式归档以本轮 Git 推送核验为准**：四处可复现整局阻断已修复；同组合无头逻辑仿真 30/30 结算，稳健性扫描 72/72 结算，真实浏览器脚本 4/4 结算。用户另以 Human 玩家及 DeepSeek 娘玩家各真人试玩 30 局，共 **60 局，无阻断整局完成的问题**；静止通行、藏身退出、双阵营完整对局、生命周期及复现、DEV 与声音显示回归均确认通过。四种证据分别记录，互不替代。本轮不改 `GAME_CONFIG`；Human AI 抓捕速度的玩家体感差异仅作非阻断观察，S7B 偶发原地停留仍保留观察。设计、证据与限制见 `docs/S7D_ALPHA_FULL_MATCH_DESIGN.md`。 |

历史细节与各轮测试结果以 `docs/AGENT_LOG.md` 为准。S7B overall 的 Gate 状态依据本次用户整体验收及历史归档核验；此结论不表示所有潜在 AI 问题已清零。

## 5. DeepSeek AI 当前行为

### 状态及优先级

实际状态来自 `DeepSeekAIState`：

`SEEK_RICE / MOVE_TO_RICE / EAT / RESELECT / EVADE / RECOVER / SAFE_WAIT / HIDE / CURIOUS_APPROACH / CURIOUS_OBSERVE / CURIOUS_PASSAGE`（S7C-2b 新增 `HIDE`，它带 `DeepSeekHidePhase = NONE / TRAVEL / CONCEALED / EXIT` 相位）。

状态机每帧先吸收 Human 静止变化、门状态和感知；真实移动、追捕型危险声音、眩晕、已有抓捕进度或安全距离被突破可打断好奇/通行。获准且仍安全的静止试探会将普通视觉/非追捕声音降为 caution，避免旧逃跑优先级无条件抢占。明确高威胁会进入 `EVADE`；`SAFE_WAIT` 有独立重查及紧急危险退出；逃跑满足安全距离和观察条件后进入可移动的 `RECOVER`，继而回到找米。其余时候选米、移动、调用既有进食更新。

### 找米、进食和威胁

- 玩家正式控制 Human 时 DeepSeek AI 才运行；玩家正式控制 DeepSeek、DEV 临时控制 DeepSeek 或调试移动接管时不抢输入。
- 对未完成 Active Rice 按共享 A* 路程换算移动时间，再加剩余进度及 0.4 秒准备时间评分；目标不可达或卡路时重选。普通 CLOSED 门可使用已有交互开启，LOCKED 门阻挡路径。
- EAT 仅提交现有米系统意图，进度持久保留、中断、米痕声音和胜负仍由对应系统决定。五份 Active Rice 完成才触发 DeepSeek 胜利。
- 直接目视 Human 时用当前坐标及既定视距评估威胁；听声按现有距离、事件强度和遮挡，普通门操作声不等同追捕型声音；Last Seen 只在配置有效窗口内作为记忆。声音方向只投影到八方向，不以声事件坐标当隐藏实时目标。
- Human 静止由 `HumanStillness` 维护，不依赖 DeepSeek 持续视线。合格静止事件的好奇判定只抽一次；好奇接近、观察及通行路线必须满足抓捕圈外半径。真实移动、逼近、冲刺、抓捕危险可立即取消。
- `SAFE_WAIT` 对重复危险米堆入口实施有限等待和路线复查；不得回到周期性无条件冲门。静止 Human 附近有可行安全路线时，复用观察及避让规划；没有安全路就继续等待。

### S7C-2b AI 自主藏身（已验收并归档）

`HIDE` 与 `EVADE` / `RECOVER` 并列，**不重写逃跑评分**：只有在已知威胁点距离 ≤ `hideThreatDistance`(3.5)、威胁等级 HIGH、连续藏身未达上限、且「藏身路线短于当前逃跑路线」时才进入 `TRAVEL`。AI 只在**真实导航格心**上落脚（该格心必须仍落在藏身点的精确交互区域内），因此 A* 终点本身就是可行走点。进入必须由游戏层签发的一次性令牌 + `resolveDeepSeekAiHideEntry()` 用本帧真实位置复核；退出首先要过最短藏身时长、威胁解除与「仍有可达米堆路线」，再由游戏层用 `humanBlocksHideExit()` 判出口物理安全。AI 只读公开信息：不读藏身点占用、不读 Human 实时位置、不引用玩家专用的白色轮廓或按键仲裁。

### S7B-3A 条件关门

关门只在 `EVADE` 的逃跑决策中检查，不返回远门。控制器跟踪 DeepSeek 穿过 OPEN 门叶的实际侧向变化，并只在 1,800 ms 窗口内评估近门。需要：当前目视确认 Human 位于门另一侧；Human 距离不少于 1.5 世界单位；门可交互且未被角色占据；门后 A* 路线存在且屏蔽该门；Human 到逃跑目标的当前路径确实使用该门。通过检查后发出一次关闭命令，ThreeGame 重新检查距离、交互和门叶占用，再调用 `DoorSystem.toggle(id, 'DEEPSEEK')` 并同步视图、碰撞和声音。关闭结果和失败均触发每门 5,000 ms 冷却，Human 重开后 AI 不会马上原地振荡。没有可信当前视线时 Human 方位显示未知并跳过。该功能没有新增主动锁门。

实际可调参数在 `GAME_CONFIG.deepseekAI`：

| 变量 | 当前值 | 单位 | 用途 |
|---|---:|---|---|
| `doorEscapeMinHumanDistance` | 1.5 | 世界单位 | 关门时与可见 Human 的最低距离。 |
| `doorEscapeCrossingWindowMs` | 1,800 | 毫秒 | 实际通过门后可评估的期限。 |
| `doorEscapeCooldownMs` | 5,000 | 毫秒 | 关门成功或失败后，同门重试冷却。 |

DEV 分类显示候选门、距离、通过标记、Human 是否在另一侧（未知时不透视）、关后逃生路线、决策/收益依据、最近结果、跳过原因和冷却。AI JSON 事件为 `DOOR_ESCAPE_EVALUATE`、`DOOR_ESCAPE_CLOSE`、`DOOR_ESCAPE_SKIP`、`DOOR_ESCAPE_FAILED`；相同理由不逐帧重复加入事件。

用户提供的人工验收 5/5：正常追逐穿门关门后继续逃跑；Human 同侧跳过；Human 过近跳过；关门会封唯一退路时放弃；Human 重新开门后不原地振荡。它是本次交接采用的已确认历史结果，不是本次代理重新执行的浏览器交互结果。

## 6. S7B-3B 主动锁门与逃脱策略（已完成）

用户验收与归档记录见 §4 和 `docs/AGENT_LOG.md`。锁门、侧向证据、冲刺协调、防振荡及测试细节见 `docs/S7B3B_DOOR_LOCK_DESIGN.md`；后续修改须保留 §7 的回归边界。

## 7. 必须避免的回归

- 静止 Human 附近的米堆不能恢复成“只因看见就逃跑”；已符合安全条件的好奇/安全通行不能被普通视觉警戒无故覆盖。
- SAFE_WAIT 不能每隔约 3 秒重复冲门；不安全的目标和路线须等待或换可行米堆。
- 所有获准的安全观察与通行路径需保持在真实抓捕半径和余量之外；AI 不获得抓捕免疫。
- EVADE 关门不得在危险距离停下、封死自己唯一退路、跑回远门或对同门反复开关。
- 声音和 Last Seen 只能提供已有系统授予的信息；墙后不能读取 Human 实时位置。
- 玩家主控、临时控制、暂停和重开不能被 AI 抢占或遗留冷却/路径状态。
- 动画表现单向读取玩法结果；不能反向改变速度、碰撞、进食、抓捕或 AI 决策。
- 保留手动调过的 `GAME_CONFIG` 参数；不要为了新功能改已验收的 Rice、Sprint、Capture、S6 或 S7A 数值。

## 8. 开发及验收流程

1. 先读 `AGENTS.md`、`docs/AGENT_LOG.md` 最近相关记录、`docs/GAME_BALANCE_CONFIG.md` 及当前系统接口。检查分支、status、已有提交；保留用户未提交资料。
2. 运行开发预览：`npm run dev`（根目录 `vite.config.ts` 固定 `http://127.0.0.1:5173/`，端口被占用时直接报错而不是换端口），人工测试后导出 DEV 面板工具栏中的本局 AI JSON。导出文件是诊断产物，默认不入库。
3. S7B 控制器与相关回归重点：`tests/deepseek-ai.test.mjs`、`tests/deepseek-evade.test.mjs`、`tests/deepseek-curiosity.test.mjs`、`tests/deepseek-curiosity-priority.test.mjs`、`tests/deepseek-passage.test.mjs`、`tests/deepseek-safe-wait.test.mjs`、`tests/deepseek-safety-regression.test.mjs`、`tests/deepseek-door-escape.test.mjs`、`tests/door-system.test.mjs`、`tests/navigation.test.mjs`、`tests/capture-zone.test.mjs`、`tests/ai-log-collector.test.mjs`。
4. 游戏代码改动运行 `npm test`、`npm run build`、`git diff --check`。构建遵守 `AGENTS.md` 的 Vite/EPERM 规则；不以提高警告阈值掩盖失败，不提交 `dist/`。
5. 自动测试不替代人工 Gate。人工通过后按用户指令更新阶段；通常只暂存任务范围内文件，提交前复核 staged 清单，不强推、不重写历史、不删除 `.trae/`。

## 9. 已知事项与未完成问题

- S7B-2 偶发原地停留保留为后续 AI 优化项，不阻断其已通过 Gate。
- 正式 GLB 角色及 IDLE 特殊待机片段未导入；无动画片段时白模保持普通 IDLE，动画视觉验收后续处理。
- Human AI 自动解锁耗时 8,750 ms 按用户决定留作 S16 平衡复评。
- **S7B-3B 的实机日志缺口**：用户验收已通过，但缺少侧向证据修复后的完整 AI JSON；锁门频率等仍应由新日志复核。
- DEV-B 原批准范围的历史基线为 472/472；本地预设实施轮为 725/725。本次归档前复测 **727/727**，TypeScript、构建及差异检查通过；用户已确认本地预设 **10/10** 人工验收。各次结果所属轮次见 `docs/AGENT_LOG.md`。
- 第三轮浏览器脚本里的 BLOCKED 项只描述当轮尝试；其后的集中人工验收已由用户确认通过。具体当轮证据与最终验收结果分别见 docs/verification/S7C-2-r3/、阶段设计文档 §4.7–§4.9 和 docs/AGENT_LOG.md。
- **S7C-2b 的浏览器复核只用脚本驱动玩家追逐**（`docs/verification/S7C-2b/`）：进入 / 藏身 / 自主退出 / 同点冷却 / 日志事件都已实跑观察到；「Human AI 把藏身中的 DP 搜出来」「反复逼近拉开的抖动」「暂停 / 重开 / 地图热应用的状态清理」这三类**没有由 DPH 在浏览器里覆盖**，它们由 `tests/deepseek-hide-loop-guard.test.mjs`、`tests/deepseek-hide-lifecycle.test.mjs`、`tests/human-ai-check-hide.test.mjs` 与既有 `dev-freeze` / `hide-integration` 用例覆盖。这三项已由**用户集中人工验收（8/8 PASS，含搜出 NPC、无抖动、状态清理）**覆盖；**人工验收不得被改写为 DPH 自己完成的浏览器测试**。
- 第四轮为 Human 家具轮廓修复留下了像素证据；当轮测量值与限制保留在历史日志。用户随后确认 Human 白色轮廓以及 DP 娘家具、米堆、目标重叠和生命周期验收通过。
- S7C-2 逐轮浏览器脚本与证据位于 `docs/verification/S7C-2-r2/`、`r3/`、`r4/`。`f243047` 只纳入了各目录的 `README.md` / `browser-check.mjs` 与部分关键截图；**其余 38 个复核产物（重复截图、导出的 AI JSON、控制台日志）仍留在工作区未跟踪**，按「不删除、不修改已有浏览器验证材料」保留原地，本轮未改动它们。
- **Codex Windows 桌面客户端权限问题（未解决的环境问题）**：受限「帮我批准」沙箱使用独立 Windows 沙箱账户，`workspace-write` 读写项目普通文件正常，但写 `.git` 元数据失败——`git config --local http.sslBackend openssl` 创建 `.git/config.lock` 被拒绝（`Permission denied`）。`.git` 内有两组未解析 SID 的 DENY ACE，但与已核对的当前沙箱身份及其令牌组均不匹配。**底层拒绝来自 Windows ACL、沙箱文件系统规则还是其他限制，目前无法确定，不得当作已定根因。** 联网沙箱下 Schannel 报 `SEC_E_NO_CREDENTIALS (0x8009030e)`，临时用 `git -c http.sslBackend=openssl ls-remote` 可成功读取（命令行级临时覆盖，**不是持久修复**）。完全访问模式（`bilibili` 用户身份）下 `ls-remote` / `fetch` 成功，但该模式的自动 commit / push **尚未单独测试**。暂定工作流：日常开发保留项目专用沙箱，归档时优先评估客户端单条 Git 命令审批，其次才在用户当次明确授权下临时使用完全访问模式并事后恢复。**该工作流是暂定方案，Git 权限问题未修复。** 另注：当前 DSH 执行环境自身的 `git ls-remote` 也报同一个 Schannel 错误，那是本机 Git TLS 凭证状态，与 Codex 沙箱账户的结论是两件独立的事。同一仓库在 DSH `workspace-write` 下 `git add` / `git commit` 正常（exit 0），只有 `git push` 需要一次命令级提权——**不得把 Codex 侧的 `.git/config.lock` / DENY ACE 结论套到 DSH 上**。长期协作规则统一见 `AGENTS.md`「Windows 沙箱兼容性与最小权限工作流」，本节只保留现有环境问题摘要。
- **玩家声音探测表现层已停用（2026-09-27，用户集中人工验收 3/3 PASS；随本次归档提交进入 `main`）**：玩家端的「声音范围圈」与「彩色动态声纹」在正式对局与 DEV 对局中都不再显示。停用方式是 `src/three/ThreeGame.ts` 的表现层接线隔离——`PLAYER_SOUND_VISUAL_ENABLED = false` 一个常量同时关掉实例化与逐帧更新；`SoundVisualView` 实现、`tests/sound-visual.test.mjs` 与 `GAME_CONFIG.perception.soundVisual` 数值**全部保留**，恢复只需把该常量改回 `true`。停用前的表现层快照（含用户 2026-09-27 对声音圈的最后一次未提交调整）保存在 `archive/features/player-sound-visual/`，其 `README.md` 记录原有功能、接线位置、关联配置、停用原因、恢复步骤与回归测试。**AI 真实听觉 / 声音事件 / `PerceptionSystem`、DEV-B、场景编辑器 V2、S7C-3 随机化均未受影响**；浏览器证据见 `docs/verification/PLAYER-SOUND-VISUAL-DISABLE/`。**已知限制**：停用前的彩色声纹缺少完整浏览器前后对照，正式构建侧只做了打包产物静态核对。
- **S7D 整局验证与四处判据统一（已通过用户集中验收）**：四个可复现整局阻断及其判据修复见 `docs/S7D_ALPHA_FULL_MATCH_DESIGN.md` §4；用户确认静止通行、藏身退出及双阵营完整对局行为。`GAME_CONFIG` 数值未改，静止安全通行仍须存在抓捕圈外的安全路线。整局遥测 `matchSummary` 使用 AI JSON `formatVersion` **1.7**。**后续观察**：S7B 偶发原地停留不能宣称绝对根除；Human AI 抓捕速度相较玩家操控 Human 偏快仅为玩家体感，原因未查明，本轮不调数值。`src/three/ThreeGame.ts` 开工前单空行差异按用户要求保留，不纳入 S7D 提交。
- 当前状态：**S7B 已完成阶段 Gate**；S7C 已批准子阶段均已归档；**S7D 用户最终集中验收通过，本轮获准正式归档**，Git Gate 以实际提交、推送和远端核验结果为准。S8 尚未授权；详见 `docs/AGENT_LOG.md` 与本文件阶段表。

## 10. DEV 场景热编辑器 V1 与双阵营调试冻结（已验收并归档）；V2 布局持久化（已验收 9/9 并归档）

独立 DEV 工具，不接入藏身玩法；验收与检查点见 docs/DEV_SCENE_EDITOR_DESIGN.md 和 docs/AGENT_LOG.md。长期保护点：READY 计时与 PLAYING 冻结时间分离；手动冻结与场景编辑冻结可叠加；编辑仅在应用时重建碰撞、导航和门状态；拒绝操作须有可见反馈，DEV 入口不得被覆盖。

**V2（2026-09-27 用户一次性授权）＝ 布局保存 / 恢复 / JSON 导入**：`src/three/map/MapLayoutStore.ts`（localStorage 信封 + 结构·稳定 ID·只读字段校验，几何与玩法校验复用 `validateEditedMap()`）、`SceneEditor` 的保存 / 导入 / 恢复默认三条链路（都先跑 S7C-1B 地图预检再走既有重建）、面板新增「保存布局 / 导入 JSON / 恢复默认地图」与布局状态行（`data-layout-state`）、`ThreeGame` 开机恢复本地存档（失败即回落到授权地图并保留原因）。存档只含家具与藏身锚点等**地图创作数据**，每局随机出生点与门初态仍由 S7C-3 现场掷出。**用户集中浏览器人工验收 9/9 PASS（2026-09-27），已随归档提交进入 `main`**；细节见 `docs/DEV_SCENE_EDITOR_DESIGN.md` §11 与 `docs/verification/DEV_SCENE_EDITOR_V2/`。

## 11. S7C-1A 藏身点地图数据与 S7C-1B 藏身玩法（均已验收并归档）

地图含 8 个 HideSpot 和 2 个纸箱，每个藏身点仍只有一个 `HideSpot.x/z` 锚点（进入＝退出），家具通过稳定 ID 关联。DEV-A 区域（圆形／扇形精确交互区域）属于地图创作数据，S7C-1B 起**已正式作为藏身合法性判定**接入玩法，S7C-2 又把它作为「公开交互区域」用于 Human AI 的家具怀疑（仍然只读公开成员判定，不读占用）。**S7C-1B 已实现并归档**：E 点按立即藏身/退出、藏身期间禁止移动/冲刺/进食/锁门与门交互、普通视觉与常规抓捕对藏身者无效、Human 玩家 Q 扇形搜查（1.5 / 120° / 12 秒）命中藏身家具即搜出并立即抓捕、DeepSeek 玩家 Q 锁门 20 秒冷却、DEV `Hide / 藏身` 分类与 AI JSON `hideEvents`。**S7C-2 已实现、集中人工验收通过并完成归档推送（阶段 Gate = PASS）**：Human AI 亲自发现米痕 → 公开家具怀疑 → 合法站位 → 900 ms 停留 → 正式搜查结算。**S7C-2b 已实现、通过集中人工验收并归档**（DeepSeek AI 自主藏身 / 走位 / 退出与循环抑制）；**地图随机化（S7C-3）已通过用户集中人工验收 8/8 并随检查点 `420d8a6` 归档**。地图和阶段方案见 docs/MAP_SPEC.md、docs/S7C_HIDE_RANDOMIZATION_DESIGN.md；区域与编辑器细节见 docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md。

## 12. 待批准提案与专属开工要求（S7C-2b、S7C-3 与编辑器 V2 均已归档；DEV-A、DEV-B 已完成各自批准范围）

> 本节列出尚待批准的阶段开工要求；文档存在不代表获得授权。DEV-A 与 DEV-B 已完成各自批准范围，任何后续扩展仍需单独授权。
>
> DEV-A 与 DEV-B 的**先后顺序属于当前规划，不是不可改变的强制技术依赖**。
>
> **S7C-3 已通过用户集中人工验收 8/8 并随检查点 `420d8a6` 归档；DEV 场景编辑器 V2 已通过验收 9/9 并随归档提交进入 `main`**；DEV-A / DEV-B 和 DEV 场景编辑器的后续扩展仍未授权。S7C-2 与 **S7C-2b** 均已通过各自的人工验收并归档（S7C-2b 见 §16）。

### DEV-A：藏身交互区域与编辑器（已完成批准范围）

- 已完成：交互区域数据与几何、编辑器区域调整和校验、流畅家具拖动、任意角度旋转碰撞及 JSON V3；未接入正式藏身玩法。
- 未完成/未授权：JSON 导入器作为**编辑器 V2 的一部分已实现并通过用户人工验收**（2026-09-27，接受 V3 文档与本地存档信封，严格校验后走与「应用编辑」同一条重建链路）；是否拆分进入/退出锚点尚未决定。S7C-3 已通过人工验收并归档（Human AI `CHECK_HIDE` 与 DeepSeek AI 自主藏身已分别由 S7C-2 / S7C-2b 实现）。
- 实现、参数与验收历史见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md` 和 `docs/AGENT_LOG.md`。

### DEV-B：运行时 AI 调试工具（原批准范围与本地预设轮均已通过用户人工验收）

- 功能：只读状态观察、38 项白名单临时参数、场景可视化、中文说明与紧凑面板；临时值只存于内存，不写正式 `GAME_CONFIG` 或地图 JSON V3，并支持两种恢复。
- 人工验收：原批准范围 6/6 通过。归档验证：`npm test` 472/472、`npx tsc --noEmit` 通过、`npm run build` 通过、`git diff --check` 通过。
- **本地预设（2026-09-27，用户人工验收 10/10 通过）**：新增「保存调试参数 / 加载已保存预设 / 删除本地预设（需确认）」与三态显示（正式默认值 / 已保存 / 未保存修改），已保存参数在刷新、重开、返回阵营后开新局时恢复；存档键 `who-ate-my-rice/dev-b-runtime-params`（与场景编辑器 V2 地图存档键**完全独立**），读取严格校验版本 / 白名单 / 类型 / 范围 / 有限性，损坏或版本不符时**安全回退正式默认值并显示原因**；恢复复用 `DevBRuntimeBinding` 的正式生效路径（含改抓捕半径清空旧抓捕进度）；**仅开发构建**读取与应用，「恢复正式默认值」不删除本地预设。规则与人工验收清单见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §12，浏览器证据见 `docs/verification/DEV-B-PARAMS/`。
- 参数、生效时机、已知限制、测试和人工验收细节见 `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md`；历史步骤见 `docs/AGENT_LOG.md`。正式视觉/听觉仍不使用家具遮挡，视觉规则没有视锥角。

**其他阶段的专属开工要求位置**：S7C-3 → `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`（§4 已完成的 S7C-2、**§4.10 S7C-2b 技术设计与实现结果（已实现、已验收归档）**、§5 S7C-3、§6 未决参数）；DEV 场景热编辑器（已完成 V1，后续扩展）→ `docs/DEV_SCENE_EDITOR_DESIGN.md`；**DEV-B 本地预设（用户人工验收已通过）→ `docs/DEV_B_RUNTIME_DEBUG_DESIGN.md` §12**。

## 13. 当前受保护功能清单（已通过 Gate，改动时不得破坏）

> 承接原 `AGENTS.md` 前置条件 9 的具体清单；通用要求见 `AGENTS.md`「全项目通用开发规则与执行规范」的前置条件 9。凡涉及地图、导航、AI 或 DEV 工具的改动都必须保护下列功能；该清单随每个通过 Gate 的阶段扩展。

- S7B-3B 主动锁门和冲刺逻辑（门锁链路、Sprint 30 秒冷却与冲刺期间门交互）；
- S7C-1A 八个藏身点和两个纸箱（**现状不变：单一 anchor**）；
- DEV 场景编辑器 V1（**已验收，不得修改其行为**）；
- `MANUAL_DEV_FREEZE` 和 `SCENE_EDITOR` 双冻结原因；
- READY 阶段独立计时；
- 现有 DEV 调控台及其全部按钮；
- 场景编辑后的碰撞及导航重建流程（`dispose → buildApartment → 新 CollisionWorld + NavigationSystem → rebindNavigation → syncAllDoors`）；
- **DEV-A 第一轮**的区域数据与几何/合法性接口（`HideSpot.interactionRegion` 的已批准参数 2.0 / 1.6·55° / 1.2、`HideInteractionRegion.ts` 的精确几何、瞄准家具可接近表面、离散采样语义——不得擅自改动参数，也不得把离散采样呈现为精确面积）；
- **DEV-A 第二轮 + DEV-A-FIX-1**：区域半径／半角编辑与 `REGION_AUTHORING_LIMITS` 边界、家具移动或旋转时的锚点跟随、JSON **V2** 导出格式、精确轮廓与离散采样分离的 DEV 呈现，以及**拖动延迟校验窗口**（`beginDeferredValidation` / `endDeferredValidation`——不得改回「每帧全量校验」，也不得让任何位置绕过 `apply()` 的正式校验）。
- **DEV-A-FIX-2**：`RotatedRect.ts` 的统一旋转几何与旋转约定（同 `THREE.Object3D.rotation.y`）、`CollisionWorld` 的 `OrientedObstacle` 真实旋转碰撞（**包围 AABB 只能作粗筛，不得当作碰撞形状**）、`rotationDeg` 任意角度与可关闭的 15° 吸附（默认关闭、不进 JSON）、四角点房间边界校验、关联锚点与 `facing` 同步旋转、JSON **V3** 导出格式（`rotationDeg`/`rotationRad`/`collisionShape`/`boundingAabb`/`boundingAabbRole`）。**注意：`MAP_EXPORT_VERSION` 现为 3，V2 的 `collisionAabb` 与 `rotationQuarter` 已作废**——不要在阅读旧文档或旧日志后按 V2 字段名理解当前格式。
- **S7C-1B 藏身与两个 Q 技能**（2026-09-26 由 `db8dfe6` 归档，此前该节尚未补入）：E 点按藏身 / 退出（无 `ENTERING` 计时、无独立 Human 距离门槛）、藏身期间禁止移动 / 冲刺 / 进食 / 锁门与门交互、隐藏者单向不可见且常规抓捕不累计、Human 玩家 Q 扇形搜查（半径 1.5、张角 120°、12 秒冷却，未命中也消耗）命中绑定家具的可接近表面即搜出并立即抓捕、DeepSeek 玩家 Q 锁门只有成功才起 20 秒冷却、地图应用前预检失败即拒绝并保留旧地图与旧藏身状态、DEV `Hide / 藏身` 分类与 AI JSON `hideEvents`。**不得改动**：扇形半径 / 张角 / 冷却、藏身合法性判定（`checkHideRegionPosition` 的精确交互区域 + 真实碰撞可站立 + 家具表面无遮挡 + 落在导航格）、进入 / 退出语义与「单一 anchor」。
- **S7C-2b DeepSeek AI 自主藏身**（2026-09-27 归档，用户集中浏览器人工验收 8/8 PASS）：公开候选层 `DeepSeekHideCandidates.ts`（`createDeepSeekHideMapSnapshot()` 是 AI 可见公开快照的唯一构造点；AI 只在**真实导航格心**上藏身）、权威层 `DeepSeekHideResolution.ts`（`resolveDeepSeekAiHideEntry()` 顺序固定为「计划仍属当前地图 → 确实走到规划站位 → 完整几何合法性」；`humanBlocksHideExit()` 是玩家 E 与 AI 退出共用的出口公式）、`HideSystem.enterAsAI()` + 游戏层每帧签发的一次性令牌（重放必须被拒）、控制器 `HIDE` 状态 + `DeepSeekHidePhase = NONE / TRAVEL / CONCEALED / EXIT`、`deepseekAI.hide*` 九个已批准参数、DEV `Hide` 分类 8 行 AI 字段、AI JSON `formatVersion` 1.6 的 `HIDE_AI_*` 事件。**不得改动**：AI 只读公开信息（不得读 `occupancyOf()` 或 Human 实时位置）、不得把玩家专用的白色指向轮廓与按键仲裁搬进 NPC 决策、九个 `hide*` 数值、一次性令牌机制、S7C-2 的 Human AI 搜查规则。
- **DEV 场景编辑器 V2 布局持久化**（2026-09-27 归档，用户集中浏览器人工验收 9/9 PASS）：本地存档 key `who-ate-my-rice/scene-editor-layout`（信封 `format = 'who-ate-my-rice/scene-layout'` + `layoutVersion: 1`，`document` 即 V3 导出文档）、`parseLayoutDocument()` 的结构 / 稳定 ID / 只读字段 /「是否同一张地图」四项核对、几何与玩法校验**复用 `validateEditedMap()`**（不得另建第二套校验）、五态 `DEFAULT / CUSTOM / SAVED / UNSAVED / IMPORT_FAILED`、`SceneEditor` 的保存 / 导入 / 恢复默认三条链路与共用的 `commitLayoutSource()`（先 S7C-1B 地图预检 → 换源 → 既有 `rebuildApartment()`）、`ThreeGame` 开机「全部校验通过才 `buildApartment(..., { furniture, hideSpots })`」、面板工具栏内三个新按钮与 `.scene-editor-layout` 状态行。**不得改动**：存档只含**地图创作数据**（禁止写入本局随机出生点 / 18 扇门随机初态 / 角色位置 / AI 路径 / 米进度 / 技能冷却 / 对局时间）、`resetRound()` 不重建公寓且不重置 `mapFurniture` / `hideSpots`（会话内重开 / 返回阵营 / 开新局保留已应用布局）、「恢复默认地图」不得删除本地存档与已导出的 JSON、保存失败不得虚报成功、导入只接受同一张地图，以及 V1 的入口位置（新按钮必须在既有工具栏内，禁止绝对定位覆盖层）。

- **S7D 的四处判据统一 + 整局遥测**（用户集中验收通过，归档状态以 Git 远端核验为准）：静止通行闸门「是否挡住了米堆」的判据在 `SAFE_WAIT` 时与 SAFE_WAIT 用同一个 `dangerRouteRadius`，并把「米堆落在 `visionEvadeDistance` 内」也算作挡住；藏身退出闸门只在可见 Human 处于 `visionEvadeDistance` 内、且未被 `HumanStillness` 判为长时间真静止时才拒绝退出。**不得改动**：`GAME_CONFIG` 里的任何数值（本轮一处未改）、「没有抓捕圈外的安全路线就拒绝放行」的安全边界、`humanBlocksHideExit` 的出口物理判据、一次性藏身令牌、`AILogCollector` 的三个时间线上限（2000 / 500 / 500）与新增 `matchSummary` 的上限（50 / 50 / 100）。

两条长期禁令：**新增按钮不得覆盖原 DEV 入口**（入口必须作为 `DebugDetailsPanel.topRow` 的 flex 项，禁止再引入绝对定位覆盖层）；**不得将 READY 计时误接到 PLAYING 冻结时间源**（`readyDelta` 与 `gameplayDelta` 是两个不同的时间缝）。

## 14. 当前灰盒与玩法状态（摘要）

> 承接原 `AGENTS.md` 的同名小节。房间尺寸、门洞、六条环路、家具与出生点坐标见 `docs/MAP_SPEC.md`。

- 住宅 / 公寓式 3D 灰盒地图已完成；旧九宫格布局已废弃。**2026-10-03 东翼扩建**后地图包含 **15 个主要空间 + 阳台、衣帽间、北阳台 3 个附属空间 = 18 个功能区**（原 10 + 2 = 12），并保留 **6 条追逐环路**（原 3 条：新增东南大环、东翼环、北侧环）。世界盒由 `36 × 30` 扩为 `48 × 30`（X `-24…24`，Z `-15…15`）。
- 14 个 `RiceCandidate` 每局无重复随机激活 5 个 Active Rice；每份大米拥有独立持久进度，完成 5 / 5 后 DeepSeek 娘获胜。
- **31 个 `DoorNode`** 已升级为正式 Door System（扩建前 18）；8 个 `HideSpot` 已登记为地图数据（含 2 个新增纸箱 `living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`）——**东翼扩建没有增加藏身点**，仍是用户批准过的 8 个，新翼家具都是普通家具，`DEBUG_MAP` 下可查看标记；正式藏身玩法已实现并通过 S7C-1B 验收归档。Human AI 的 `CHECK_HIDE` 与米痕循迹已由 S7C-2 实现、通过集中人工验收并归档推送；DeepSeek AI 自主藏身已由 **S7C-2b** 实现、通过集中人工验收并归档；S7C-3 出生与门初态随机化已通过用户 8/8 人工验收并随检查点 `420d8a6` 归档。
- DEV 工具（仅开发环境显示入口）：场景热编辑器 V1 + 双阵营调试冻结（`MANUAL_DEV_FREEZE` / `SCENE_EDITOR`）；V2 布局保存 / 恢复 / JSON 导入已通过用户集中人工验收 9/9 并归档；生产构建不出现入口与编辑器数据。
- 角色移动保留 Camera-Relative Movement、玩家相机跟随、XZ Circle Footprint、分轴碰撞与 Wall Sliding。
- 单份大米正式设计时长 60 秒；当前开发测试值 5 秒（发布前必须切回 60 秒并重新验收）。

## 15. 当前核心玩法规则索引

交接时遵守的核心边界：AI 只使用系统授予的感知信息，不读取被遮挡对手的实时位置；AI、玩家与动画表现共用既有系统，不绕过碰撞、进食、抓捕或胜负判定。正式玩法数值以 src/config/gameConfig.ts 为唯一来源，参数索引见 docs/GAME_BALANCE_CONFIG.md。

Human/DeepSeek 控制、门锁、声音与视野、米痕、好奇安全通行等详细规则见 AGENTS.md 和对应状态树/阶段设计文档；本交接文件只维护当前状态、授权、已知待办和回归边界。

## 16. S7C-2b 技术设计与实现状态（**已实现，用户集中浏览器人工验收 8/8 PASS，已归档**）

> 完整设计、接口草案、参数清单与验收计划在 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` **§4.10**（实现结果见 **§4.10.14**）。按前置条件 10，阶段 Gate 需要「验收 + 日志 + commit + push」全部完成：用户 2026-09-27 完成集中浏览器人工验收 **8/8 PASS** 并授权本轮归档，验收结果、日志与归档提交均已落地；当前远端同步状态一律以 `git ls-remote origin refs/heads/main` 查询。

- 目标（S7C-2b 一句话）：让 **AI 控制的 DeepSeek 娘**在既有找米主线上，能按**合法公开信息**发现人类威胁、在追逐中选择逃跑或前往**合法家具藏身区域**、满足条件后进入藏身、再按有限状态条件自主退出，且不会原地反复进出、在多个藏身点之间无限循环或目标失效后卡住。
- 复用（不新建第二套系统）：`HideSystem`（占用与状态）、`checkHideRegionPosition` + `HideSpot.interactionRegion`（藏身合法性）、`NavigationSystem`（A*，新增只读的 `freeCellsWithin()`）、`CollisionWorld`（最终位移）、`PerceptionSystem`（Vision / Sound / Last Seen）、`GameStateSystem`（抓捕与胜负）、`AILogCollector` + DEV 面板、`tests/ai-walk` 式真实走图驱动（新增 DeepSeek 版）。
- 新增：`src/systems/DeepSeekHideCandidates.ts`（公开候选层，纯逻辑）、`src/systems/DeepSeekHideResolution.ts`（权威进入层 + 出口物理判据）、`HideSystem.enterAsAI()` + 一次性令牌、控制器 `HIDE` 状态 + `DeepSeekHidePhase`、`deepseekAI.hide*` 九个已批准参数、DEV `Hide` 分类 8 行 AI 字段、AI JSON `formatVersion` **1.6** 与 `HIDE_AI_*` 事件。
- 关键红线（已按源码级断言把守，见 `tests/hide-integration.test.mjs` 与 `tests/deepseek-hide-candidates.test.mjs`）：**玩家专用的指向型白色轮廓（`DeepSeekVisualTarget` / `HideSearchView`）与按键仲裁不得进入 NPC 决策**；AI 只读公开信息，不读 `occupancyOf()`、不读 Human 实时位置；**未改动**已验收的 S7C-2 机制、Human AI 搜查规则、两个 Q 技能参数与 DEV-A 区域几何。
- 用户集中人工验收（2026-09-27）：**8/8 PASS** —— ① DeepSeek NPC 自主寻找家具；② 隐藏与普通抓捕阻断；③ Human 玩家搜出 NPC；④ NPC 自主退出并恢复行动；⑤ 反复逼近与拉开，无原地进出抖动；⑥ 暂停 / 重开 / 返回菜单的状态清理；⑦ 地图热应用后旧计划正确作废；⑧ 玩家白色轮廓、Human Q、Human AI 搜查、玩家 E、门锁与 DEV 等旧功能回归。**这 8 项是用户实机确认的结果，不得改写为 DPH 自己完成的浏览器测试。**
- 本轮归档轮实测：`npm test` **670/670**、`npx tsc --noEmit` 0、`npm run build` 0（JS 979.79 kB / gzip 262.80 kB、CSS 13.68 kB）、`git diff --check` 0；实现轮的浏览器真实复核（`docs/verification/S7C-2b/`）观察到 AI 自主藏入 `hide_living_carton` 并在 2.586 秒后自主退出。
- 未决 / 未做：S7C-3 已通过用户集中人工验收 8/8 并随检查点 `420d8a6` 归档；**场景编辑器 V2（布局保存 / 恢复 / JSON 导入）已实现，用户集中人工验收 9/9 PASS，随归档提交进入 `main`**；DEV-B 的 38 项运行时白名单未加入 `hide*`；藏身音效与「被发现后反制」按设计刻意不做。S7C-2b 的参数在实现中**未做任何数值调整**（§4.10.9 的建议值原样落地），唯一的设计澄清是候选评分货币与「值得藏身」判据，已在 §4.10.14 说明。

## DeepSeek 第四阶段当前状态（2026-10-09）

GLB视觉比例已增20%，玩家和NPC共用，静态GLB内容与第三阶段一致。浏览器交互复测通过；证据在 docs/verification/DEEPSEEK_STAGE4。绑定测试未通过：23骨骼草案的定位和长发/裙摆权重需修复，未制作六个动画或导出绑定GLB。完整报告及工作副本位于项目外 `asset_work/stage4_rig`（工作资料，未纳入仓库；此为外部资料内的相对路径）。当前待人工验收比例，第四阶段整体未完成。npm test 794/796（既有两项AI失败），tsc/build/diff检查通过；未提交Git。

### 后续更新：2026-10-10 头发动态候选

上方为10月9日历史状态。用户现已验收v4的Idle/Walk/Run身体动作。当前游戏引用v5头发GLB（18,500三角面、26骨骼），身体动画轨道及播放倍率保持v4；六根发骨由Three.js实时阻尼弹簧驱动，v4动画与第三阶段静态模型保留回退。头发动态待人工验收，未宣称第四阶段整体通过。报告/录像/测试材料位于 asset_work/stage4_animated_20261010/hair_v5。测试802/804，仍有两项既有AI用例失败，tsc/build/diff通过；没有Git提交。
