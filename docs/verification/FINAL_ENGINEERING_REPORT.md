# 最终工程整理与收尾验收报告

日期：2026-10-15（Asia/Shanghai）。本轮为S1、S2后的集中收尾，不创建新的整理阶段。没有暂存、commit、push或Tag，等待人工验收；下述技术结论不等于项目归档Gate=PASS。

## 1. 最终一次性收尾执行结果（2026-10-15，最新结论）

### 本次最终复验（含已完成的首页设置区改动）

用户再次授权一次性工程收尾；先核对发现所批准的生产隔离和保存恢复实现已经存在，因此本轮只复验、保存新证据及同步文档。未发现新源码Bug，**本轮源码/测试/配置/素材修改0**，不重复重构或开启新阶段。以下为最新结论；后面的901项和43,157,676字节为前次历史快照。

| 当前验收项目 | 本轮重新执行结果 |
|---|---|
| 工程验收 | **通过，工程技术范围无遗留条件。** 标准Vite隔离保存及完整服务重启恢复复验成功；仍等待用户最终验收，不冒充Git Gate=PASS |
| 技术发布验收 | **通过。** 正常生产运行、v6及故障兜底、构建过滤、资源请求均通过；不等于全部素材的公开授权核验完成 |
| 两个指定旧GLB | v5与standalone生产副本及非预期哈希副本均为0；原v1～v4排除继续保留，六旧模型名/哈希均无dist匹配，生产JS旧URL为0 |
| 正式/开发模型链 | 生产正常使用v6；加载返回HTML/动画初始化/运行时失败均回退现有程序化角色；开发实际仍回退v5七动画或standalone |
| DEV保存 | Chrome、Edge两浏览器实际保存POST/备份→服务自动重启→浏览器自动重连/自动重载→手动刷新→正常停止/启动服务→读取同一revision全部通过，正式地图未写 |
| 自动化门禁 | **908/908**，失败/取消/跳过0，约88.15秒；独立TypeScript、生产build、diff与新增文本检查通过，无改测或弱化断言 |
| 最终dist | **84文件，43,163,759字节**（43.16MB / 41.16MiB）；本轮构建前后相同，82静态/CSS输出哈希相同。与前次历史大小的差异来自其后已完成的首页设置UI，不是模型内容变更 |
| 保护 | **522/522文件哈希不变**，包含S1/S2及后续UI成果、模型原件、音频、地图、玩法配置和173项B/46项C保留范围；旧日志字节前缀不变，候选删除0，私人目录未访问 |
| Git | HEAD不变、暂存区为空，未add/commit/push/Tag；完整工作区差异包含此前已存在的实现，不将其误报为本轮新增 |
| 剩余公开授权 | **未全部核实，仍须补充下表所列来源/平台许可依据。** 旧GLB专项阻断已通过生产不分发解除，无本轮复现的技术发布阻断 |

本轮正式开发/预览分别复用已核实属于本项目的5173/4173进程（npm启动尝试因严格端口占用正常拒绝，未改端口或终止原进程），新受控页面明确goto和核对URL/标题后才操作。

#### 真实浏览器复验

- Chrome154/Edge151，在 `http://127.0.0.1:5173/` 与 `http://127.0.0.1:4173/` 各双阵营×三难度，共24组合；正常v6响应SHA与本机一致，模型渲染、动画时间、头发动态、实际移动、30秒/5份、110家具/15HideSpot、暂停/声音设置/恢复及返回首页通过。只调整临时浏览器探针以适配已完成的新难度入口，没有回改首页布局。
- 生产12组故障为两浏览器×两阵营×加载HTML/动画初始化异常/动画运行异常：均出现可移动的既有程序化角色，每页v6请求1次，旧模型请求0，无无限重试、白屏或未处理异常；初始化失败geometry释放仍为1次。正常与故障页面的游戏资源HTTP错误、请求失败及pageerror为0；本次受控正常页面console error为0，保留既有favicon在其他访问方式中出现404的已知记录，不据本轮采样宣称永久消失。
- 开发4次故障仍实际回退v5七动画或standalone，响应哈希与原件一致；没有把旧GLB加入生产包，也未复制这些原件到测试部署。
- 生产1366×900、800×600，两浏览器两卡各持续10秒跨数字/标题/立绘/说明/箭头移动：首次进入1次实际音频节点，内部新增0，离开重进1次；跨卡切换及双阵营箭头点击通过。未靠冷却掩盖问题。
- 开发另检查1920×1080、1707×864、1366×768、800×450、480×640布局、制作信息及DEV选择/草稿/放弃/导出。生产DEV入口按原规则不可用；不把CSS视口测试冒充原生浏览器缩放、主观音效或自然整局人工验收。

#### 标准Vite隔离保存闭环

创建全新临时副本，仅复制当前源码、原 `vite.config.ts`、81项非旧模型资源，依赖junction及npm启动shim复用；六旧GLB及私人目录不复制。运行 **`npm run dev -- --port 5183 --strictPort`**，默认bundled配置加载器，完整文件监听；隔离与正式Vite配置SHA相同，未修改/关闭保存、恢复或监听机制。

两浏览器通过真实编辑器将隔离 `gym_treadmill.x` 从13.05分别保存为13.06、13.07；POST200、备份哈希正确，原服务日志实际出现sceneLayout变更→重启。手动刷新前，加载计数各增加1并重新收到WebSocket connected；随后刷新读取110家具/15HideSpot和保存位置。正常Ctrl+C停止、确认5183端口释放，再用相同命令启动，两浏览器均读到13.07及同一revision `845f0e863babb9539d64a6e4230ef5d88b2f13a3b66cb03e135055146437be67`。全部写盘仅在隔离副本；正式布局及备份哈希保持不变。复验结束临时服务再次正常关闭，正式5173/4173保留。

#### 发布边界、文件与证据

精确排除 `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb` 与 `deepseek_midpoly_18500_standalone.glb` 的dist副本；生产加载器与过滤名单一致。本机原件全部保留，v6仍为 `b74025c238bb884bdd0d05e2ef9ab6061916dad1512549207fef6f8ee3cfb026`。当前两个生产GLB为v6和米袋，共13,129,676字节；39图片28,264,649字节、37音频399,664字节、3代码1,366,171字节、3其他3,599字节，均为磁盘体积，不冒充网络压缩传输量。

授权仍按 `docs/ASSET_PROVENANCE.md` 的既有用户声明管理，不新增许可结论：

| 仍待核实的资源 | 剩余问题/最小人工补充 |
|---|---|
| `public/assets/props/rice-bag/rice-bag.glb` | 自制/AI输入声明已有；尚缺实际输入平台及适用的公开再分发条款依据 |
| `public/assets/ui/portraits/deepseek-model-reference.png`、`deepseek-portrait-sheet.png`及normal/win/lose派生PNG | 既有自制/AI加工声明保留；生成或补画平台未明确的部分，不猜测平台或其许可 |
| `public/ui/sheet-a-pulselock.png`至`sheet-f-modern-textures.png`、相关组件/纹理、faction-name-gradient系列 | 需对应自制/生成来源与平台许可依据，派生文件继承原始输入边界；不把改名或裁切当成新增授权 |

以上是**证据缺口**，不是已经确认侵权；技术验收不替代授权判断。v6依用户原创与公开授权保留；旧模型原有授权不明不再通过本生产包分发。完整公开授权结论仍未解除，是否提交/部署须由用户最终核对并另行授权。本轮不扩大许可调查或新增工程任务。

本轮修改仅本报告、`docs/DEEPSEEK_HANDOFF.md`、`docs/AGENT_LOG.md`（追加）和精选验证证据。完整证据：[检查摘要](final-engineering/recheck/checks.json)、[24正常组合](final-engineering/recheck/normal-browser.json)、[12生产故障](final-engineering/recheck/production-faults.json)、[开发回退](final-engineering/recheck/development-fallback.json)、[卡片Hover](final-engineering/recheck/production-hover.json)、[真实保存](final-engineering/recheck/standard-save.json)、[完整重启恢复](final-engineering/recheck/standard-restart.json)、[dist清单](final-engineering/recheck/final-dist.json)、[保护哈希](final-engineering/recheck/protected-files.json)。未删除173项候选，未开展其他整理；到此停止等待最终人工验收。

### 前次实现与验收记录（历史：901项、43,157,676字节）

用户明确批准：生产仅使用v6，加载/关键动画初始化失败时程序化兜底；开发保留v6→v5→standalone链；精确排除两个额外旧GLB生成副本，所有原件不动。按此完成实现及验证，没有新建整理阶段。

| 最终问题 | 结论 |
|---|---|
| 工程整理是否无条件通过？ | **是，就本轮工程技术范围通过。** 标准配置DEV保存恢复缺口已关闭；不等于人工最终验收或Git归档Gate=PASS |
| 技术生产构建是否通过？ | **通过。** 独立类型检查、生产构建及浏览器正常/故障路径通过 |
| 两个旧模型是否彻底排除？ | **是。** v5/static及v1～v4均无产物路径/哈希匹配，生产JS不含旧模型URL，实际正常/故障请求均未命中 |
| DEV保存恢复是否成功？ | **成功。** 两浏览器标准Vite保存→自动重启→自动重连/刷新→手动刷新→完整停止/启动服务→读取布局通过 |
| 全量测试 | **901/901**，失败/跳过/取消0；新增8项，无删测/弱化断言 |
| 最终dist | **43,157,676字节，84文件**（43.16MB / 41.16MiB） |
| 剩余授权/部署事项 | 旧GLB分发阻断通过不分发解除；米袋、部分立绘/UI与派生输入的具体AI平台条款仍未核实，不能宣称全量素材授权通过。无已复现的技术部署阻断 |
| 是否建议Git提交？ | 技术上建议准备提交；须核对最终文件清单与剩余素材许可缺口后，由用户另行授权。本轮未add/commit/push/Tag |

### 最小实现与回归证据

- `src/three/DeepSeekGlbModel.ts`：Vite生产常量分支阻止v6失败后进入旧模型链，`staticOnly`在生产亦不请求standalone；错误交给原表现层程序化兜底。开发分支保持原链。生产JS编译后旧URL字符串均被移除。
- `scripts/production-assets.mjs`：精确名单由4项扩为6项，仅移除dist生成副本；v6、米袋及其他资源保留，不改默认开发配置、输出边界或原件。
- `src/three/CharacterActionView.ts`：故障注入实证动画初始化失败曾重复释放模型两次。按模型是否已挂avatar区分释放所有权，同时清理部分初始化的动画/头发引用；不改正常动画/模型内容。修复前2项生命周期回归失败，修复后每份geometry/material仅释放1次。
- 更新 `tests/production-assets.test.mjs` 名单预期；新增 `tests/production-model-policy.test.mjs` 5项、`tests/character-fallback-cleanup.test.mjs` 3项。相关18/18通过，全量由开工893→中间898→最终901。
- 修改的既有保护文件仅上述3实现文件与1个过滤测试；本轮518项开工哈希中514项原样、4项均为授权修改。全部GLB、37音频、配置、地图/布局、AI、UI和Hover修复内容不变，173项B及46项C候选保留，私人目录未访问。

证据均在 [本次收尾证据目录](final-engineering/closeout/checks.json)：[24组合/正常资源](final-engineering/closeout/normal-browser.json)、[12组生产故障](final-engineering/closeout/production-faults.json)、[4组开发回退](final-engineering/closeout/development-fallback.json)、[生产Hover](final-engineering/closeout/production-hover.json)、[完整dist清单](final-engineering/closeout/final-dist.json)、[保护哈希](final-engineering/closeout/protected-files.json)。

Chrome154/Edge151开发5173及生产4173各6组合：两阵营三难度、正常v6响应哈希/材质/骨骼/7动画及6头发关节、移动、暂停/设置、三CSS视口、编辑器选择/草稿放弃/导出及销毁通过；正常HTTP错误/请求失败/console error/pageerror全部0。生产12组故障覆盖两浏览器×两阵营×v6返回HTML/动画构造抛错/运行时动画抛错，均实际显示可移动的原程序化角色；每页面v6只请求1次，旧模型请求0，未处理异常0；预期故障warn完整保留。开发4次故障仍实际回退v5七动画或standalone，响应哈希与本机原件一致。

生产Hover在1366×900及800×600，两浏览器两卡各持续10秒跨图片/标题/说明/箭头移动额外播放0；首次进入/重进各1次原生节点，跨卡切换及点击正常。没有重新评估主观音色、自然整局平衡、原生缩放或长期FPS/内存，不将这些列为新整理任务。

### 标准DEV保存缺口已关闭

隔离副本复制当前源码/原配置与81个非旧GLB资源，本地依赖通过junction复用，npm的.bin启动器复制到隔离副本；无正式地图写入、私人目录或六旧GLB复制。使用原始 `npm run dev -- --port 5183 --strictPort`（默认bundled配置加载器、完整文件监听），没有configLoader=runner或configFile=false，也没有关闭任何恢复机制。临时端口显式指定，正式默认5173不变。

Chrome/Edge原生编辑gym_treadmill草稿并应用/保存，POST200、备份内容/revision正确。服务实际因sceneLayout变更自动重启；自动页面加载计数各增加1，WebSocket再次connected，**在手动刷新前**已恢复服务与浏览器连接。随后手动刷新仍恢复110家具/15HideSpot及保存坐标；正常Ctrl+C停止隔离服务、确认端口释放，再以相同npm命令启动，两浏览器均读取同一保存revision。最终测试副本x=13.10，仅属于隔离数据，正式x及其全部布局不动。

完整 [保存/自动恢复](final-engineering/closeout/standard-save.json)、[整服务重启后读取](final-engineering/closeout/standard-restart.json)。正式布局前后SHA始终 `9d53920224997dc3b8d2caeea56b0b647f9abaeca9d137d17756f8d78b9dc1d8`，最终临时服务已正常关闭，正式5173/4173继续保留。最初临时探针错要求full-reload帧，实际Vite重启使用断线ping/重载；改为加载计数及connected帧验证后通过，不是修改产品来迎合测试。未发现需要修改正式Vite/编辑器的回归。

### 最终体积、检查与授权边界

开工（含已修复Hover的构建）86文件/67,570,842字节→84文件/43,157,676字节，减少24,413,166字节；其中24,412,984字节来自两旧GLB，余量为JS/HTML正常构建变化。82个静态/CSS文件哈希完全相同；最终2个GLB共13,129,676字节、39图片28,264,649字节、37音频399,664字节、3代码1,360,088字节、3其他3,599字节。按磁盘字节统计，不冒充网络压缩传输量。完整产物扫描六旧模型名称及原件SHA均零匹配，不只是检查两个默认路径。

最终独立 `npx tsc --noEmit`、`npm run build`、`git diff --check`及新增文本检查通过。117模块，保留大chunk及Node类型擦除实验性警告；全量901项约60.25秒。日志旧字节前缀保留、暂存区为空、HEAD未变；未清理未知文件或候选，没有新增依赖。

**技术通过不等于全素材已取得公开分发授权。** v6依用户原创及公开授权记录保留；六旧GLB虽有未扩大的历史授权边界，但已不生产分发，因此不再构成本次包的旧GLB专项阻断。以下原有来源声明仍不是平台条款核验结果：

| 资源范围 | 尚未核实内容 |
|---|---|
| `public/assets/props/rice-bag/rice-bag.glb` | 具体AI输入平台未提供，平台特定公开分发条款未核实 |
| `public/assets/ui/portraits/deepseek-model-reference.png`、`deepseek-portrait-sheet.png`及normal/win/lose派生图 | 用户自制/AI加工声明已记录；未提供的生成/补画平台及其特定条款不推断 |
| `public/ui/sheet-a`至`sheet-f`对应PNG、组件派生资源及faction-name-gradient系列 | 自制/AI加工来源声明保留；平台特定条件仍未逐项核实，派生文件不能凭改名获得独立许可 |

没有新引入第三方资产，不虚构平台、许可证或权利证明；详细来源仍见 `docs/ASSET_PROVENANCE.md`。建议技术成果进入Git审查，但完整公开素材结论仍需用户提供缺失来源/许可依据并最终决定，不自动推送或部署。

**下文§2～§10保留首次收尾的历史审计快照**：890项、67.57MB、有条件通过及旧GLB发布阻断均是当时结果；最新结论以上方“本次最终复验”和recheck证据为准，closeout保留前次实现证据，不据旧建议开启新阶段。

## 2. S1、S2及本轮成果

| 范围 | 已完成成果 | 边界 |
|---|---|---|
| S1 | ThreeGame 3573→3475行，提取只读DEV投影、复用按钮/时钟；清理13项未使用项、23条无效CSS声明；修复反馈定时器/监听、编辑器beforeunload、调试视图及整实例释放 | src总行数净增18，不声称全仓减行；没有重写AI或UI；878→885项测试 |
| S2 | 精确构建过滤v1～v4的dist副本；输出90→86文件，减少42.51%；新增5项输出边界/保留/重定向测试 | public原件不删；v5/static真实回退不动；885→890项测试 |
| 最终收尾 | 重跑890项门禁；24种真实浏览器环境组合、4次模型失败回退、两浏览器隔离真实保存/备份/刷新、8个历史截图页只读验证；173项逐文件最终分类 | 不删除候选，不再拆模块/整理CSS，不新增阶段；授权缺口和未覆盖项如实保留 |

前两轮详细实现与历史结果仍以 [S1报告](CODEBASE_CLEANUP_REPORT.md)、[S2报告](PRODUCTION_ASSET_OPTIMIZATION_REPORT.md) 为准，本轮未改写这两个报告。

## 3. 生产构建体积及完整清单

磁盘文件字节求和，MB按十进制；不等于网络压缩传输量、首屏下载量或Windows分配簇大小。

| 类型 | S1后/S2前数量与字节 | S2后/最终数量与字节 |
|---|---:|---:|
| GLB | 8 / 87,507,068 | 4 / 37,542,660 |
| 图片PNG/WebP/SVG | 39 / 28,264,649 | 39 / 28,264,649 |
| Ogg音频 | 37 / 399,664 | 37 / 399,664 |
| JS/CSS/HTML | 3 / 1,360,191 | 3 / 1,360,191 |
| 其他说明/占位 | 3 / 3,599 | 3 / 3,599 |
| GLTF/视频 | 0 / 0 | 0 / 0 |
| **合计** | **90 / 117,535,171** | **86 / 67,570,763** |

最终67.57MB（64.44MiB）；累计减少49,964,408字节（42.51%），本轮相对S2再减少0字节。最终86文件路径、大小、SHA-256与本轮开工/S2产物完全相同，JS/CSS无变化。完整清单与哈希见 [dist-final.json](final-engineering/dist-final.json)，前30大文件及原90文件清单见S2报告和其证据目录。

Vite仍复制public，再由既有 `productionAssetFilter` 在writeBundle精确移除四个生成副本。不是关闭public、迁移资源或减少复制I/O。默认outDir边界和realpath防重定向的5项回归继续通过；自定义输出目录仍按S2设计拒绝，不暗中扩大插件能力。

## 4. 模型来源、依赖与发布边界

以下路径前缀均为 `public/assets/characters/deepseek/`，不以文件名相似、面数相同或Blender加工推定来源和授权相同。

| 文件 | 字节 | 正式/DEV用途 | 最终dist | 公开依据与处理 |
|---|---:|---|---|---|
| `deepseek_animated_v1.glb` | 12,491,168 | 当前加载器/DEV无运行版本分支 | 排除 | 历史授权未扩大；保留本机原件 |
| `deepseek_animated_v2.glb` | 12,491,164 | 同上 | 排除 | 同上 |
| `deepseek_animated_v3.glb` | 12,491,164 | 同上 | 排除 | 同上 |
| `deepseek_animated_v4.glb` | 12,490,912 | 同上 | 排除 | 同上 |
| `deepseek_animated_v5_hair_ready.glb` | 12,496,972 | v6加载/骨骼动画校验失败的真实回退，非DEV专用 | 保留 | **未获针对该文件的公开授权，发布阻断** |
| `deepseek_midpoly_18500_standalone.glb` | 11,916,012 | 动画版本失败及动画运行异常的静态回退，非DEV专用 | 保留 | **未获针对该文件的公开授权，发布阻断** |
| `deepseek_animated_v6_hair.glb` | 12,496,972 | 两阵营正式首选；7动画、材质及6个头发动态关节 | 保留 | 用户确认原创并授权模型/动画/内嵌贴图公开，既有声明不扩大至旧版 |

米袋 `public/assets/props/rice-bag/rice-bag.glb`（632,704字节）亦为正式依赖；按既有用户自制/AI输入来源声明管理。其他立绘/UI/米袋具体平台未提供的条款仍未单独核实，本轮不虚构平台、通用资产许可证或新增授权结论。37个音频仍是源码合成原创，42事件中五个脚步/冲刺/开关门接口继续停用，无对应文件。

实际依赖证据：`src/three/DeepSeekGlbModel.ts` 的v6→v5→static加载分支，以及 `src/three/CharacterActionView.ts` 的 `loadVisual(true)`。正常24组合只请求v6；Chrome/Edge生产故障注入v6返回HTML时各加载v5的7动画，v6/v5均返回HTML时各加载static，网格真实渲染且无未处理异常，响应SHA与本地相同。见 [回退记录](final-engineering/fallback.json)。没有把HTTP 200 HTML误认为有效GLB。

| 文件 | SHA-256 |
|---|---|
| v6 | `b74025c238bb884bdd0d05e2ef9ab6061916dad1512549207fef6f8ee3cfb026` |
| v5 | `d4e67fff652aa42508311ab18422d33727c15e1b700f2daf0a6255f8651e5277` |
| standalone | `e32ac3ccc3253487ee7c026ad7887d1d7b0bee0c9088f48cce25637e1f2f7528` |

Git现场核验：角色目录只有正式v6被追踪；v5/static均被忽略，`git log --all -- <这两个路径>` 无历史提交。**Git忽略不等于Vite部署排除**，不能据此解除dist发布门禁。本轮不改素材来源历史，不用其他产品协议或开源模型许可证替代实际资产授权。

解除阻断的最小人工证据：针对上述准确v5/static文件及其内嵌贴图，提供所有权/公开再分发授权依据；或者明确批准不含它们的生产回退策略并另行验证。未获该决定前不修改加载器、不排除仍在用的回退、不删除或改名原件，也不自动衍生开发阶段。

## 5. 173项B候选最终分类

逐项保留完整路径、大小、Git追踪状态、SHA、S2分类、最终分类、引用证据、检查方式和副作用行号，见 [完整173项台账](final-engineering/candidates-final.json)。这是用途分类，不是删除或公开授权清单。

| 最终分类 | 数量 | 结论 |
|---|---:|---|
| 有明确使用/保留关系 | 105 | 原95项：90个旧隔离副本内部依赖及5个离线加工资源；新增8个历史截图证据页、2个显式关联旧存档夹具。后两类不冒充正式运行依赖 |
| 高置信未参与当前正式运行 | 10 | 原清单不变；6个零字节占位、4个历史UI，仍可能有归档/目录用途，仅列建议不删除 |
| 用途/执行条件需进一步动态确认，默认保留 | 58 | 旧探针/验收脚本；并非“未使用”。部分要求注入page、会写存档/输出或依赖历史服务，不在正式origin盲目运行 |
| **合计** | **173** | **本轮删除0，未分类0；58项不确定性没有被包装成验证通过** |

8个无脚本截图页为BALCONY、BATHROOM、ENTRY、HOME_GYM、KITCHEN、MAIN_BEDROOM、NORTH_BALCONY、SECOND_BEDROOM各自的 `review.html`。两浏览器关闭JS、只允许明确同源URL请求，标题和全部91张图片均解码成功；这是历史证据仍可读取，不是重新验收这些家具。见 [16次只读访问](final-engineering/galleries.json)。

两项夹具为 `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/legacy-seed.html` 和同目录 `legacy.json`：前者显式fetch后者并写旧localStorage键，JSON可解析，因此有保留依据；本轮未执行播种，不恢复旧布局。

58项按目录分布：EAST_WING_EXPANSION 28、S7D 8、MAP_SCALE_UP 4、RESIDENTIAL_FURNITURE_V3 2，另16目录各1项（完整路径在台账）。例如 `SCENE_LAYOUT_PERSISTENCE/backup.html` 明确POST到历史5174服务；未启动该服务、未运行该页面。静态扫描只记录可能副作用及行号，不声称证明任意脚本安全或完整动态依赖。

### 10项仅供人工判断的删除建议（实际全部保留）

| 完整项目相对路径 | 字节 | 删除风险/证据 |
|---|---:|---|
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/controllers/.gitkeep` | 0 | 低，但可能保留历史目录结构 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/.gitkeep` | 0 | 同上 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/types/.gitkeep` | 0 | 同上 |
| `src/controllers/.gitkeep` | 0 | 低，非运行资源；仍有目录保留语义 |
| `src/types/.gitkeep` | 0 | 同上 |
| `public/maps/.gitkeep` | 0 | 低，被Vite复制但无运行请求；保留规则尚未另获删除授权 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/rain-ui.css` | 16,805 | 中，未加载但属于旧副本历史外观 |
| `public/assets/ui/portraits/deepseek-rice-v1.webp` | 213,776 | 中，当前正式立绘另有路径；用户历史资产 |
| `public/ui/faction-name-gradient-clean.svg` | 1,816 | 中，当前使用PNG而非SVG；潜在加工/备份用途 |
| `public/ui/faction-name-gradient.png` | 1,668,139 | 中，正式使用clean派生图，原图仍有来源/加工意义 |

原A类3个 `.gitkeep` 继续保留。C类46项（43文件＋3私人目录）继续保护；不读取/遍历私人目录，不删除原始素材、主场景17份备份及其他历史备份。没有为了“候选清零”变更Git忽略规则。

## 6. 全量回归与保护结果

| 检查 | 本轮实际执行结果 |
|---|---|
| `npm test` | **890/890通过**，失败/跳过/取消0，约61.18秒；未新增/删除/弱化测试 |
| `npx tsc --noEmit` | 独立执行通过，退出0 |
| `npm run build` | 通过，117模块，退出0；既有超过500kB chunk建议告警保留 |
| `git diff --check` | 收尾执行通过；拟提交未跟踪文本亦逐文件无暂存检查 |
| 本轮517项文件 | 全部SHA-256相同，涵盖src/tests/scripts/public、B/C文件、原报告及关键配置 |
| S1保护107项 / S2保护337项 | 两组均逐项复核哈希相同，不只对照数量 |
| 日志与未知工作 | 原日志完整字节前缀保持；已有15个跟踪差异及未知文件保留，无非dist原件删除 |
| 平衡/地图/角色/音频 | EASY Human 0.52、NORMAL/HARD参数、30秒/份、5份米、110家具/15HideSpot、正式v6/动画/头发及音频规则不变；五项音效仍停用 |

详见 [保护哈希](final-engineering/protection-final.json) 与 [执行统计/探针限制](final-engineering/checks.json)。S1原可选noUnused诊断的两项AI变量及大模块/CSS债务没有顺手改动；正式TypeScript门禁通过不等于额外诊断全部清零。

## 7. 真实浏览器、DEV及隔离保存

独立受控Playwright启动实际Chrome154.0.8037.100及Edge151.0.4129.86，不使用无法核验URL的原宿主；每次page.goto、核对URL/端口和标题“谁吃了我的米”。仅在响应内插入观测实例引用，未改磁盘源码/bundle。

| 实测项目 | Chrome开发5173 | Chrome生产预览4173 | Edge开发5173 | Edge生产预览4173 |
|---|---|---|---|---|
| 双阵营×三档，实际生效参数、进入/移动/返回 | 6/6 | 6/6 | 6/6 | 6/6 |
| v6响应哈希、材质/骨骼、地图、动画及头发推进 | 通过 | 通过 | 通过 | 通过 |
| 音频 | AudioContext running及原生BufferSource.start调用 | 同左 | 同左 | 同左 |
| ESC暂停/恢复、Master归零实际Gain归零/恢复默认 | 通过 | 通过 | 通过 | 通过 |
| 1455×818、800×450、480×640 CSS视口、制作信息ESC | 无区域相交/横向溢出，交互通过 | 同左 | 同左 | 同左 |
| DEV打开125对象、选择/草稿放弃/导出/未应用保存拒绝/GET revision | 通过，未对正式数据POST | 入口按既有规则隐藏 | 通过，未对正式数据POST | 入口按既有规则隐藏 |
| dispose两次 | DEV订阅/米点/安全线0，canvas脱离、音频上下文清理 | 同左 | 同左 | 同左 |
| 正常资源请求失败/HTTP错误/console error/pageerror | 0/0/0/0 | 0/0/0/0 | 0/0/0/0 |

开发复用 `http://127.0.0.1:5173/`、预览复用 `http://127.0.0.1:4173/`，未重复启动或终止原进程。见 [完整24组合/网络记录](final-engineering/browser.json)，[Chrome生产DeepSeek截图](final-engineering/chrome-production-DEEPSEEK.png)、[Human截图](final-engineering/chrome-production-HUMAN.png)、[Edge生产DeepSeek截图](final-engineering/edge-production-DEEPSEEK.png)、[Human截图](final-engineering/edge-production-HUMAN.png)。

### 真正保存POST只在临时隔离副本执行

- 明确地址 `http://127.0.0.1:5183/`，监听127.0.0.1:5183且strictPort；复制当前src/必要配置与81个公开项目资源，不复制六个旧GLB、原场景备份、私人目录或用户真实浏览器存储。
- 两浏览器原生点击编辑器：选择gym_treadmill、x各加0.01→应用编辑→保存布局。实际POST200、revision与磁盘SHA相同，生成备份且内容与上一版本相同；刷新后改选Human并打开编辑器，x依次恢复13.06/13.07，仍110家具/15HideSpot。
- 正式布局保存前后均为 `9d53920224997dc3b8d2caeea56b0b647f9abaeca9d137d17756f8d78b9dc1d8`，正式目录没有新增备份或数据写入。临时服务已正常关闭，临时副本保留，不清理未知文件。
- 首次临时探针错用 `position.x` 而实际布局/草稿字段为 `x`，修正探针，不改产品代码。随后runner加载配置时把sceneLayout纳入配置依赖，保存触发Vite自动重启，出现被取消/断开的模块请求；没有隐瞒这两次检查失败。
- 最终临时服务器先读取**复制的真实配置与原保存插件**，仅关闭临时配置模块图的自动监听，源码HMR仍启用；Chrome/Edge实际保存/备份/刷新均通过且请求失败0。标准配置保存后自动重启的完整稳定性仍未覆盖，**因此工程结论为有条件通过**，不将该验证等同于正式5173写盘验收。没有为避免测试噪声更改正式Vite或编辑器。

见 [隔离保存记录](final-engineering/isolated-editor.json)、[Chrome截图](final-engineering/chrome-isolated-editor-save.png)、[Edge截图](final-engineering/edge-isolated-editor-save.png)。Vite安装源码的handleHMRUpdate确实在configFileDependencies命中时重启服务器；本轮不擅自调整受保护的配置/保存行为。

## 8. 最终修改清单与Git准备

### 本轮新增/更新

- 新增 `docs/verification/FINAL_ENGINEERING_REPORT.md`。
- 新增 `docs/verification/final-engineering/`：14份精选浏览器/哈希/构建/候选证据，另附精确候选提交清单 `git-review-files.json`。不收录临时工作副本、Temp探针、原始模型或旧验证目录。
- 更新 `docs/DEEPSEEK_HANDOFF.md` 当前收尾状态；只在 `docs/AGENT_LOG.md` 末尾追加实际结果。
- **新增源码、资产、测试修改均为0。** 本轮没有证据要求进一步改动现有实现。

### S1/S2既有差异，全部原样保留

跟踪源码/样式：`src/s13-ui.css`、`src/systems/AILogCollector.ts`、`src/three/AISafetyPathView.ts`、`CollisionWorld.ts`、`DevBPanel.ts`、`GameFeedback.ts`、`GameUiLayout.ts`、`SceneEditor.ts`、`SceneEditorPanel.ts`、`SceneEditorView.ts`、`ThreeGame.ts`、`src/three/map/MapEditModel.ts`；构建接线 `vite.config.ts`；两份交接/日志。

必要新增：`src/three/DevBHumanHideObservation.ts`、`scripts/production-assets.mjs`、`tests/cleanup-projection.test.mjs`、`tests/view-cleanup.test.mjs`、`tests/production-assets.test.mjs`，两份S1/S2报告及其精选证据目录。完整具体路径见 [候选提交清单](final-engineering/git-review-files.json)，这只是供人工审查的准备文件，不是暂存/提交授权。

最终跟踪差异仍为15文件（本轮只继续追加两份文档）；新文件需独立纳入审查，`git diff --stat`不包含未跟踪文件，不能把15当成未来提交总数。正式v6已追踪且未变，不重新添加旧GLB。

精确候选清单共70路径（15个既有跟踪改动＋55个新增文件），尚无任何暂存。35个新增文本逐项执行无索引空文件对比的whitespace检查，均无诊断；候选文本常见Token/私钥模式扫描命中0，不将模式扫描等同于完备安全或授权证明。

明确排除候选提交：dist、所有旧GLB、incoming-assets、私人目录、场景备份、临时副本/探针和未批准历史验证材料。未读取私人文件来做敏感扫描，没有为了减少Git状态条目修改忽略规则。

现场main与本地origin/main、真实远端main一致于上一公开发布；无合并/变基/cherry-pick状态，暂存区始终为空。用户未授权本轮Git写操作，故没有add、commit、push或Tag，也没有stash、reset、clean、历史改写。

## 9. 剩余风险与未覆盖项

| 级别 | 问题 | 处置/最小人工条件 |
|---|---|---|
| 高，公开发布阻断 | v5/static在dist但无对应公开授权依据 | 保留原件和回退，不上传整份dist；需准确文件授权证据或明确批准替代部署策略 |
| 中，工程验收条件 | 标准配置保存触发Vite重启的全链路稳定性未完整验证 | 隔离原保存插件已通过；需人工核验标准启动配置的保存/重连，不在正式地图上试写 |
| 低，保守保留 | 58项旧探针执行条件/潜在副作用尚未验证 | 默认保留，不执行历史写盘/存档操作，不据此判死代码 |
| 低，已有工程债务 | 大chunk、两项额外noUnused诊断、历史CSS叠层/大模块 | 不扩展本轮；正式测试/构建通过，未声称彻底消除全部技术债 |
| 未重做 | 原生浏览器缩放、真人自然整局、主观试听、长期内存/硬件FPS、标准配置真实保存后的服务重启 | CSS视口不冒充原生缩放；播放节点不冒充听感；受控短流程不冒充整局或长期压测 |

## 10. 收尾与停止

所有可安全执行的集中检查及报告已完成；保留S1/S2成果，不再派生新的整理阶段。工程有条件通过与公开部署暂不允许分别判断，外部授权问题不通过技术处理伪装解决。交付后停止，等待人工验收和明确授权，不擅自暂存、提交、推送或部署。
