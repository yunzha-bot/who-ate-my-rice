# 工程整理 S2：生产构建资源审计与安全瘦身

日期：2026-10-15（Asia/Shanghai）。工程整理编号S2不是游戏原有开发阶段S2，不改变阶段进度。本轮完成审计、最小构建修改与验证，等待人工验收；未add、commit、push、Tag，不进入第三轮。

## 1. 执行摘要与八项答复

| 问题 | 实际结果 |
|---|---|
| dist原本多大，现在多大？ | 117,535,171→67,570,763字节；117.54→67.57MB（十进制），112.09→64.44MiB；90→86文件；减少49,964,408字节，42.51% |
| 哪些旧GLB不再进入最终生产构建？ | 精确的v1、v2、v3、v4；v5与standalone有真实回退引用，继续保留 |
| 本地原始资源有删除吗？ | 没有，仅移除4份dist生成副本。337项开工保护文件、第一轮107项保护文件哈希全部相同 |
| DEV编辑器正常吗？ | Chrome/Edge开发环境真实验证打开、125行对象、选择/草稿修改与放弃、导出、拒绝未应用草稿保存、GET版本及关闭恢复；没有有效保存POST |
| 双阵营/三难度通过吗？ | Chrome/Edge×开发/生产×两阵营×三档，共24组合启动/移动/模型动画/音频节点/暂停设置通过 |
| 173项B类多少可确认未使用？ | 10项高置信未参与当前正式运行（6个零字节占位、4个历史UI）；不是“全仓无用途/可以删除”。95项有副本/加工用途，68项待手工动态验证，无法归类0 |
| 未验证风险？ | 旧v5/static公开许可仍未扩大授权；未运行旧探针/旧副本、未实际保存地图、未真人试听/自然整局/原生缩放/FPS测量 |
| 建议第三轮吗？ | 人工验收后可单独批准“回退模型公开部署边界＋离线UI生产排除评估”；不自动进入，不建议立即大重构或批删B/C |

使用ponytail限定最小接线：Vite原生hook＋Node标准库，没有新依赖、运行加载器改动、目录迁移或原资产删除。

## 2. 开工状态与基线

- 现场main、HEAD、本地origin/main及真实远端main一致，历史发布提交为 `e891b8a5dee76a7deb2ea9dc6f847bb16c3977da`；无合并/变基/cherry-pick标记。本轮没有Git写操作。
- 开工已有14个跟踪文件改动、279项默认Git未跟踪状态条目，属于第一轮与历史材料；目录状态项不是文件数。全部保护，不清理未知文件，不读取私人目录。
- 已读AGENTS、实际日志 `docs/AGENT_LOG.md`、HANDOFF、第一轮报告、完整Vite配置及package/build脚本。修改任何项目文件前先执行原生产构建并成功，记录90文件及SHA-256；另重新执行开工全量885/885，不沿用旧轮结果冒充本轮执行。
- [修改前90文件清单/哈希](production-assets/before-dist-manifest.json)、[修改后86文件清单/哈希](production-assets/after-dist-manifest.json)、[差异](production-assets/comparison.json)。体积按磁盘文件字节求和，不是Windows簇占用或网络压缩传输量。

### 类型及占比

models全部是GLB，GLTF为0；images含PNG/WebP/SVG；audio全部Ogg；视频0。其余3项为两份public说明README及maps/.gitkeep。

| 类型 | 原数量 | 原字节 | 占原dist | 新数量 | 新字节 |
|---|---:|---:|---:|---:|---:|
| models | 8 | 87,507,068 | 74.45% | 4 | 37,542,660 |
| images | 39 | 28,264,649 | 24.05% | 39 | 28,264,649 |
| audio | 37 | 399,664 | 0.34% | 37 | 399,664 |
| video | 0 | 0 | 0.00% | 0 | 0 |
| code | 3 | 1,360,191 | 1.16% | 3 | 1,360,191 |
| other | 3 | 3,599 | 0.00% | 3 | 3,599 |

只减4个GLB；图像28,264,649字节及37音频399,664字节不变。其余86个文件名和哈希全部一致，新增/变更产物均为0。

### 原构建最大的30项

| 排名 | 完整构建相对路径 | 字节 | 原dist占比 |
|---|---|---:|---:|
| 1 | `dist/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb` | 12,496,972 | 10.63% |
| 2 | `dist/assets/characters/deepseek/deepseek_animated_v6_hair.glb` | 12,496,972 | 10.63% |
| 3 | `dist/assets/characters/deepseek/deepseek_animated_v1.glb` | 12,491,168 | 10.63% |
| 4 | `dist/assets/characters/deepseek/deepseek_animated_v2.glb` | 12,491,164 | 10.63% |
| 5 | `dist/assets/characters/deepseek/deepseek_animated_v3.glb` | 12,491,164 | 10.63% |
| 6 | `dist/assets/characters/deepseek/deepseek_animated_v4.glb` | 12,490,912 | 10.63% |
| 7 | `dist/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb` | 11,916,012 | 10.14% |
| 8 | `dist/ui/sheet-f-modern-textures.png` | 2,914,858 | 2.48% |
| 9 | `dist/ui/sheet-b-panels.png` | 2,441,087 | 2.08% |
| 10 | `dist/ui/sheet-e-textures.png` | 2,404,049 | 2.05% |
| 11 | `dist/ui/sheet-a-pulselock.png` | 2,395,390 | 2.04% |
| 12 | `dist/ui/sheet-d-menu-result.png` | 2,360,797 | 2.01% |
| 13 | `dist/assets/ui/portraits/deepseek-win.png` | 2,229,626 | 1.90% |
| 14 | `dist/ui/sheet-c-hud.png` | 2,200,339 | 1.87% |
| 15 | `dist/assets/ui/portraits/deepseek-portrait-sheet.png` | 2,190,023 | 1.86% |
| 16 | `dist/assets/ui/portraits/deepseek-normal.png` | 2,130,874 | 1.81% |
| 17 | `dist/assets/ui/portraits/deepseek-model-reference.png` | 2,055,779 | 1.75% |
| 18 | `dist/assets/ui/portraits/deepseek-lose.png` | 1,849,977 | 1.57% |
| 19 | `dist/ui/faction-name-gradient.png` | 1,668,139 | 1.42% |
| 20 | `dist/assets/index-BxxTESvh.js` | 1,292,515 | 1.10% |
| 21 | `dist/assets/props/rice-bag/rice-bag.glb` | 632,704 | 0.54% |
| 22 | `dist/ui/faction-name-gradient-clean.png` | 313,221 | 0.27% |
| 23 | `dist/assets/ui/portraits/deepseek-rice-v1.webp` | 213,776 | 0.18% |
| 24 | `dist/ui/panels/main-shell.png` | 154,709 | 0.13% |
| 25 | `dist/ui/panels/main-shell-stretch.png` | 153,565 | 0.13% |
| 26 | `dist/assets/ui/portraits/human-guardian-v1.webp` | 75,696 | 0.06% |
| 27 | `dist/assets/audio/menu.ogg` | 67,497 | 0.06% |
| 28 | `dist/assets/index-CRuMYSHT.css` | 67,271 | 0.06% |
| 29 | `dist/assets/audio/game.ogg` | 66,253 | 0.06% |
| 30 | `dist/ui/panels/compact-shell.png` | 57,863 | 0.05% |

## 3. Vite复制机制及资源来源

依据已安装Vite 6.4.3本地源码，不只依赖静态import判断：

- `node_modules/vite/dist/node/chunks/dep-Dm0c1Wj2.js:46391–46421` 的prepareOutDir在bundle.write前运行；copyPublicDir默认true，copyDir(publicDir,outDir)不读取.gitignore。因此本机6个Git忽略旧GLB原本都会复制进dist。
- `src/assets`实际不存在。GLB/图片/Ogg使用public URL，不以二进制静态import打包；package.json?raw等源码导入进入JS，不是复制同名文件。
- DeepSeekGlbModel首选v6，失败依次v5→standalone；CharacterActionView动画失败也能请求static。DEV编辑器没有另一套旧版本选择/加载地址，沿用同一世界表现。
- RiceBagModel固定米袋URL，五点共享缓存。GLB内嵌贴图没有外部URI，不能当散落可删纹理。
- GameAudio的 `assets/audio/${cue}.ogg` 是真实动态路径；42事件中37文件、5项停用接口均原样保留。StartupView仅准备少量Ogg及菜单img；不能因没有静态import就判为无用。
- 六份已加载CSS、GameUiLayout与正式立绘路径保留；extract-ui-sheets.py读取源图并生成中间图/stretch组件，这些离线用途不是正式页面首屏请求，但也不是无用文件。
- 地图及家具/HideSpot由apartmentMap和sceneLayout驱动。原scene-layout-save只在开发服务提供GET/POST，不复制模型；本轮没有修改该插件。
- package build仍为 `tsc --noEmit && vite build`，没有其他package后置复制流程。唯一新增输出处理是精确writeBundle过滤，最终manifest证明没有后续复制将四文件带回来。

[全部87项public资源的分类、用途、置信度与正常网络命中](production-assets/asset-catalog.json)：S2分类A64（运行依赖，含条件回退）、B15（离线/开发说明及加工）、C7（历史候选）、D1（预留用途）。这些类别不同于第一轮删除台账；本轮只实施4个历史GLB排除，其他83项复制原样保留。

## 4. 旧GLB专项审计

完整路径相对项目根。以下8个GLB基线均进入dist，均无二进制静态import。URL常量交给异步GLTFLoader是运行加载引用，而非静态打包。

| 完整资源路径 | 字节 | S2分类 | 引用/用途证据 | 浏览器证据 | 最终生产输出 |
|---|---:|---|---|---|---|
| `public/assets/characters/deepseek/deepseek_animated_v1.glb` | 12,491,168 | C | 未被当前模型加载器、DEV选择器或测试引用的历史版本；仅排除生产副本 | 正常未请求 | 仅排除dist副本 |
| `public/assets/characters/deepseek/deepseek_animated_v2.glb` | 12,491,164 | C | 未被当前模型加载器、DEV选择器或测试引用的历史版本；仅排除生产副本 | 正常未请求 | 仅排除dist副本 |
| `public/assets/characters/deepseek/deepseek_animated_v3.glb` | 12,491,164 | C | 未被当前模型加载器、DEV选择器或测试引用的历史版本；仅排除生产副本 | 正常未请求 | 仅排除dist副本 |
| `public/assets/characters/deepseek/deepseek_animated_v4.glb` | 12,490,912 | C | 未被当前模型加载器、DEV选择器或测试引用的历史版本；仅排除生产副本 | 正常未请求 | 仅排除dist副本 |
| `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb` | 12,496,972 | A | 明确加载失败回退路径；保留现有行为，旧资源公开分发仍需另核 | 正常未请求；故障注入已加载 | 保留 |
| `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb` | 12,496,972 | A | 正式首选角色与7段动画 | 正常实际加载 | 保留 |
| `public/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb` | 11,916,012 | A | 明确加载失败回退路径；保留现有行为，旧资源公开分发仍需另核 | 正常未请求；故障注入已加载 | 保留 |
| `public/assets/props/rice-bag/rice-bag.glb` | 632,704 | A | RiceBagModel运行URL，五个米点共享 | 正常实际加载 | 保留 |

- v1～v4为高置信历史C类：扫描当前src、根测试、脚本、HTML/JSON/Vite及模型分支，无当前运行加载分支；过滤清单/回归夹具对名字的引用不是运行读取。DEV无版本选择器；24正常对局及4次故障回退均不请求。无需部署，精确排除生成副本。
- v5/static为条件运行必需A类，**不是仅DEV**：正常v6成功不请求；在Chrome/Edge生产环境模拟v6返回HTML，实际回退v5（7动画）；同时模拟v5失败，实际回退standalone静态模型。因此本轮不删除/排除它们，不改原回退规则。
- v6/米袋为正式必需A类：两阵营均实际渲染v6，SkinnedMesh、材质、AnimationMixer及6个头发关节时间推进；网络响应哈希与正式文件一致。
- “需要部署”与“有分发许可”分开：ASSET_PROVENANCE仍明确正式v6授权不扩大到旧版本。保留v5/static是保护回退，不是批准公开分发。剩余两旧GLB仍是本机dist公开发布前的审查门禁。

## 5. 最小实现及修改文件

| 文件 | 修改目的 |
|---|---|
| `vite.config.ts` | 新增import及plugin接线；sceneLayoutSave、server、默认端口原样 |
| `scripts/production-assets.mjs`（新增） | apply=build、enforce=post、writeBundle精确过滤4个生成副本 |
| `tests/production-assets.test.mjs`（新增） | 5项名单/保留/幂等/输出边界/重定向安全回归 |
| 本报告、HANDOFF、AGENT_LOG | 报告、必要交接及末尾追加 |
| `docs/verification/production-assets/`（新增） | manifest、引用/哈希/浏览器证据和精选截图，不改历史材料 |

精确名单（相对dist）：

```text
assets/characters/deepseek/deepseek_animated_v1.glb
assets/characters/deepseek/deepseek_animated_v2.glb
assets/characters/deepseek/deepseek_animated_v3.glb
assets/characters/deepseek/deepseek_animated_v4.glb
```

不使用通配、publicDir=false或目录递归删除；先正常复制，再unlink四份**生成副本**，不减少复制I/O，也不宣称构建加速。默认只支持项目dist，自定义outDir报错；实际dist和角色父目录realpath校验拒绝符号链接/junction重定向。其他错误向上传递使构建失败，ENOENT允许（全新公开仓库可能本来没有旧文件）。v5/v6/static、未来v7、其他资产保留。

没有修改src、模型、地图、音频、难度、UI、DEV功能、依赖或.gitignore；第一轮已修改源码本轮也完全不动。若需人工回退，只撤销Vite新增的import/plugin接线，再正常build，不需要reset/clean/删除public或撤销第一轮重构。本轮无测试回归，未回滚。

## 6. 173项B类只读复核

从第一轮报告实际读取173路径，检查元数据/哈希及TS/JS/CSS/HTML/JSON/配置/离线脚本/测试/DEV引用。保守图考虑静态与字面动态import、re-export、CSS url、HTML src/href、new URL(import.meta.url)，并人工补核动态资源表与Python加工。不是任意JS执行的完备证明。

| 结论 | 数量 | 证据及保留原因 |
|---|---:|---|
| 有明确使用关系 | 95 | 90项旧隔离副本内部入口/构建/类型/JSON依赖，5项离线UI加工；不冒充本轮运行了旧副本 |
| 高置信未参与当前正式运行 | 10 | 6个零字节占位、4个历史UI；有替代/未加载及正常网络零命中证据，但保留目录/历史用途，不等于可删除 |
| 需要动态验证 | 68 | 66个手工探针/验收脚本及2个旧存档夹具，可能改存档/场景，不擅自运行 |
| 无法归类 | 0 | 不表示68项动态候选已验证 |

173项均不在当前根运行/测试静态入口图，但9项public文件被复制（8个UI+maps/.gitkeep），当前24组合均未请求；其余164项原本就不进dist，删除这些探针不能缩小当前生产包。本轮9项仍原样复制，全173项未删。

根项目3个A类.gitkeep暂留；第一轮46项C类继续保护（43文件及3个未访问私人目录）。18份场景备份不删除/恢复。[完整引用、文档证据及哈希](production-assets/b-audit.json)；附录逐项摘要。第一轮C类保护不妨碍本轮授权排除其原件对应的dist副本，原件完全保留。

## 7. 自动化与保护结果

| 检查 | 实际结果 |
|---|---|
| 开工原构建 | 117模块，90文件，117,535,171字节，通过 |
| 开工npm test | 885/885，失败/取消/跳过0，约57.81秒 |
| 最终npm test | **890/890**，失败/取消/跳过0，约67.81秒；新增5项，无删测/跳过/放宽 |
| npx tsc --noEmit | 最终独立执行通过；根tsconfig仍检查src，构建插件另由Vite实际加载和测试验证 |
| 最终npm run build | 117模块，86文件，67,570,763字节，通过；多次重建结果相同 |
| git diff --check | 通过，新增文本也单独检查，不通过暂存获得检查结果 |
| 开工337项保护 | 全部SHA-256相同，含第一轮源码/测试、public、配置、地图、模型、音频及持久化 |
| 第一轮107项 | 继续全部相同，第一轮报告原文件哈希不变 |
| 173项B | 首次只读复核至结束哈希相同 |
| 43个C文件/3私人目录 | 文件存在及大小一致，涵盖在337/107的另有哈希证明；私人目录不读/遍历 |
| AGENT_LOG | 收尾追加后核对开工全部字节前缀不变 |
| Git | 无add/commit/push/Tag，第一轮和未知工作保留 |

[逐文件保护证据](production-assets/protected-files.json)。保留已有大于500kB chunk告警，不调警告阈值掩盖；JS1,292,515字节、CSS67,271字节及HTML哈希完全不变。

## 8. 开发及生产真实浏览器

开发复用 `http://127.0.0.1:5173/`（PID9828）；生产启动 `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`，实际 `http://127.0.0.1:4173/`（PID9200）。默认开发端口不改，无自动换端口或终止原开发进程。

独立Playwright调用page.goto并核对URL/端口/标题“谁吃了我的米”；Chrome154.0.8037.100、Edge151.0.4129.86。未重试无法核验URL的原宿主。测试仅在响应内插入实例引用，源码/磁盘bundle没有调试全局。

| 实测 | Chrome开发 | Chrome生产 | Edge开发 | Edge生产 |
|---|---|---|---|---|
| 两阵营×三档 | 6/6 | 6/6 | 6/6 | 6/6 |
| v6/米袋/地图/材质 | 通过 | 通过 | 通过 | 通过 |
| 动画/头发 | Mixer及头发时间推进；DP玩家移动为Walk | 同左 | 同左 | 同左 |
| 音频 | AudioContext running及原生BufferSource.start调用，非只看HTTP | 同左 | 同左 | 同左 |
| 暂停/设置 | 计时冻结/恢复；Master键盘到0且实际Gain=0，恢复默认及返回 | 同左 | 同左 | 同左 |
| 布局/制作信息 | 1455×818、800×450、480×640无区域相交/横溢；弹窗打开/ESC关闭 | 同左 | 同左 | 同左 |
| DEV编辑器 | 125行、选择/草稿/放弃/导出、未应用保存拒绝、GET revision及关闭 | 场景编辑器入口按原规则隐藏 | 同开发左列 | 同生产左列 |
| 正常网络/异常 | 请求失败0、HTTP错误0、console error0、pageerror0 | 同左 | 同左 | 同左 |

[24组合与网络证据](production-assets/browser.json)含实际0.52/0.78/0.95、5/6/7警戒、30,000ms及5份米、动画时间、播放节点、请求/状态及GLB响应哈希。Human局中DeepSeek NPC同样是正式v6。

额外4次生产回退（两浏览器×v5/static）将v6或v6+v5响应模拟为HTML，不改文件：实际加载预期回退、无pageerror、不请求v1～v4、不无限重试。[回退记录](production-assets/fallback.json)。

排除URL的Range负例：开发206且有glTF魔数，生产SPA预览200但内容为HTML。**200不等于GLB存在**，这不是正常页面新增404；正常游戏不请求排除URL。[资源探针](production-assets/resource-probes.json)。

### 磁盘与网络不可混用

减少49.96MB部署目录，不是玩家首屏少下载49.96MB。旧v1～v4本来不由正常游戏请求，JS/CSS和实际v6/米袋/Ogg相同。未测HTTP压缩/CDN/真实传输量/启动速度，不宣称加载加速42.51%。

### 真实截图

- Chrome生产：[DeepSeek](production-assets/chrome-production-DEEPSEEK.png) / [Human](production-assets/chrome-production-HUMAN.png)。
- Edge生产：[DeepSeek](production-assets/edge-production-DEEPSEEK.png) / [Human](production-assets/edge-production-HUMAN.png)。
- 开发：[Chrome](production-assets/chrome-dev-DEEPSEEK.png) / [Edge](production-assets/edge-dev-DEEPSEEK.png)。

## 9. 未解决风险与边界

1. **公开部署门禁未解除**：本机dist仍含约24.41MB的v5/static，现有授权仅覆盖正式v6。不能据瘦身完成直接公开上传整份dist，需先确认授权或另行批准回退部署策略。
2. 插件只支持默认dist；自定义outDir主动失败，未来自定义Rollup输出/复制插件需重审。不负责删除历史线上文件或第三方部署目录。
3. 未执行66个旧探针、两旧存档夹具或完整旧隔离副本；9项B类public仍复制，其他离线源图/未知资源也保留。静态无当前引用不等于永久无用。
4. 未有效保存POST真实地图，以免改人工排布/生成备份；验证了界面、草稿/放弃/导出、拒绝未应用保存及revision读取。正式写盘和完整拖拽仍可人工确认，不伪称已写盘验收。
5. 音频节点不能替代主观试听；未真人完整对局/胜率、原生90%～200%缩放、硬件FPS、OS失焦/长期内存测试。本轮无游戏源码/有效CSS改动，相关自动化与哈希保持。
6. 原大chunk/历史favicon/软件GPU问题不顺带修复；本轮正常控制台未复现，不代表历史潜在问题全部消除。
7. 本机preview保留供验收；没有公开部署、Git快照或Release。

## 10. 第三轮建议及停止

先由用户验收开发与4173生产预览。若新授权第三轮，优先处理v5/static公开部署边界，再评估离线UI源图/中间图的生产排除，不立即批删173项、移旧模型、关闭public复制或重写ThreeGame/AI/CSS。

本轮到此停止，等待人工验收，不自动进入第三轮。

## 附录：173项逐文件复核摘要

“明确使用”指副本/加工的引用关系，不表示本轮执行旧副本；“高置信未参与”只限定当前正式运行，不构成删除批准。完整直接引用/文档列表和哈希见b-audit.json，本表最多列2个直接来源。

| 完整项目相对路径 | 字节 | Git追踪 | 本轮分类/使用范围 | 引用及证据 | 原本在dist |
|---|---:|---|---|---|---|
| `docs/verification/BALCONY/review.html` | 1,220 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/BATHROOM/review.html` | 967 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/COVERED_INTERIOR/review.html` | 1,908 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/DEEPSEEK_ANIMATION_STAGE4/preview.html` | 3,100 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/DEV_SCENE_EDITOR_V2/browser-check.mjs` | 20,871 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/DEV-B-PARAMS/browser-check.mjs` | 19,572 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/cfg-deepseek.js` | 205 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/cfg-human.js` | 169 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/export.js` | 3,211 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/menu-crop.html` | 4,245 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p01-probe.js` | 735 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p02-shotshape.js` | 515 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p03-viewport.js` | 717 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p04-sweep.js` | 1,584 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p05-shotdiag.js` | 1,272 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p06-clickdiag.js` | 1,781 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p07-sweep.js` | 2,192 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p08-retry.js` | 1,564 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p09-rooms.js` | 2,132 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p10-menucrop.js` | 1,402 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p11-realmenu.js` | 2,068 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p12-start-human.js` | 4,755 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p13-fps.js` | 671 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p14-fps-size.js` | 971 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p16-devdom.js` | 1,063 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p17-panelcost.js` | 1,881 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/p19-console.js` | 472 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/poll.js` | 3,880 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/poll2.js` | 4,589 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/poll3.js` | 4,471 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/rooms.html` | 3,616 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/scan-rice.mjs` | 1,565 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/start-deepseek.js` | 6,611 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EAST_WING_EXPANSION/start.js` | 5,868 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/ENTRY/review.html` | 1,018 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EXTERIOR_GEOMETRY/review.html` | 3,073 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/EXTERIOR_SHADOW/review.html` | 2,880 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/HOME_GYM/review.html` | 1,553 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/INDUSTRIAL_UI/preview.html` | 973 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/KITCHEN/review.html` | 980 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/MAIN_BEDROOM/review.html` | 1,311 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/MAP_SCALE_UP/p01-views.js` | 2,108 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/MAP_SCALE_UP/p02-plans.js` | 1,458 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/MAP_SCALE_UP/plan.html` | 11,146 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/MAP_SCALE_UP/view.html` | 3,658 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/NORTH_BALCONY/review.html` | 997 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/PLAYER-SOUND-VISUAL-DISABLE/browser-check.mjs` | 16,667 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/RESIDENTIAL_FURNITURE_V1/view.html` | 3,864 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/RESIDENTIAL_FURNITURE_V3/audit.mjs` | 2,443 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/RESIDENTIAL_FURNITURE_V3/view.html` | 4,615 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7C-2-r2/browser-check.mjs` | 19,120 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7C-2-r3/browser-check.mjs` | 22,882 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7C-2-r4/browser-check.mjs` | 28,799 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7C-2b/browser-check.mjs` | 18,488 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/analyze-match.mjs` | 2,849 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/browser-check.mjs` | 16,516 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/diagnose-hide-lock.mjs` | 2,285 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/diagnose-safewait.mjs` | 3,506 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/probe-dom.mjs` | 3,147 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/robustness-sweep.mjs` | 2,067 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/run-match-batch.mjs` | 7,714 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/S7D/smoke-sim.mjs` | 1,289 | 是 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/backup.html` | 588 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/index.html` | 306 | 否 | 明确使用中（仅历史隔离副本） | 隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/legacy-seed.html` | 281 | 否 | 需要动态验证（隔离副本备用夹具） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/legacy.json` | 63,189 | 否 | 需要动态验证（隔离副本备用夹具） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/package.json` | 434 | 否 | 明确使用中（仅历史隔离副本） | 隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/config/gameConfig.ts` | 17,204 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/AILogCollector.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/controllers/.gitkeep` | 0 | 否 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/industrial-ui.css` | 27,810 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts` | 284 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/index.html`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/rain-ui.css` | 16,805 | 否 | 高置信未参与当前运行（历史UI） | 不在当前入口/测试图；旧CSS未载入，旧UI当前引用使用其他正式文件；需结合网络记录 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/sheet-ui.css` | 6,612 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/style.css` | 29,958 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/.gitkeep` | 0 | 否 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/AILogCollector.ts` | 27,839 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/CharacterAction.ts` | 1,087 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekAnimation.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts` | 129,355 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AISafetyPathView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekDoorLockPenalty.ts` | 1,237 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts` | 14,893 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideResolution.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideResolution.ts` | 6,586 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekVisualTarget.ts` | 2,714 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBHelpText.ts` | 24,702 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBObserver.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBPanel.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBObserver.ts` | 25,626 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBPanel.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBParamPersistence.ts` | 6,517 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBPanel.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBParamStore.ts` | 10,770 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBParamPersistence.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBRuntimeBinding.ts` | 2,934 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevFreezeSystem.ts` | 6,884 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DoorSystem.ts` | 6,592 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/GameStateSystem.ts` | 2,918 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevFreezeSystem.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideInteractionArbitration.ts` | 1,986 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekVisualTarget.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/InteractionPrompt.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts` | 12,766 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSystem.ts` | 11,950 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideTargetResolution.ts` | 11,792 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekVisualTarget.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts` | 89,461 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBRuntimeBinding.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchResolution.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanDoorSkill.ts` | 1,410 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchResolution.ts` | 20,528 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchStance.ts` | 8,105 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanSearchSkill.ts` | 9,902 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchResolution.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchStance.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanSearchTuning.ts` | 8,716 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanStillness.ts` | 863 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanTraceTracking.ts` | 7,454 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/MatchRandom.ts` | 7,439 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/NavigationSystem.ts` | 10,963 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/PerceptionSystem.ts` | 14,509 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/PulseLockSystem.ts` | 4,551 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/PulseLockView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceField.ts` | 1,947 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceSystem.ts` | 2,105 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceField.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RiceView.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceTraceClues.ts` | 6,126 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RuntimeDebugOverrides.ts` | 11,943 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBHelpText.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SkillCooldown.ts` | 1,118 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SkillGates.ts` | 1,755 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideTargetResolution.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SprintSystem.ts` | 3,685 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSystem.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AISafetyPathView.ts` | 2,872 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaHudView.ts` | 8,119 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaPresentation.ts` | 24,144 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaHudView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CameraRelativeMovement.ts` | 993 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CaptureZone.ts` | 3,037 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts` | 9,978 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CollisionWorld.ts` | 11,803 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/MatchRandom.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CommunityCourtView.ts` | 7,285 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ResidentialExterior.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DebugDetailsPanel.ts` | 18,456 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekAnimation.ts` | 3,638 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekGlbModel.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekGlbModel.ts` | 2,985 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaPresentation.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekHairMotion.ts` | 7,000 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekMaidModel.ts` | 9,052 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaPresentation.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts` | 7,176 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBPanel.ts` | 24,139 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBView.ts` | 12,963 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DoorView.ts` | 5,829 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DoorVisualGeometry.ts` | 985 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DoorView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapBuilder.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/GameUiLayout.ts` | 3,523 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/HideSearchView.ts` | 19,320 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/InputManager.ts` | 2,251 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/InteractionPrompt.ts` | 1,730 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaHudView.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/LocalControl.ts` | 2,616 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSystem.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/apartmentMap.ts` | 19,653 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/ClosedExteriorDoors.ts` | 2,326 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapBuilder.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/HideInteractionRegion.ts` | 15,533 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideResolution.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapApplicationPrecheck.ts` | 3,321 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapBuilder.ts` | 12,208 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorView.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapEditModel.ts` | 43,691 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapApplicationPrecheck.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapLayoutStore.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapLayoutStore.ts` | 20,172 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorPanel.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/RotatedRect.ts` | 11,196 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts`、`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchResolution.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/sceneLayout.json` | 20,805 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/apartmentMap.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/PulseLockView.ts` | 3,211 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ResidentialExterior.ts` | 30,186 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapBuilder.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RiceTraceView.ts` | 1,412 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RiceView.ts` | 3,515 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RoundShortcuts.ts` | 612 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneCameraDepth.ts` | 1,501 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts` | 24,064 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorPanel.ts` | 23,510 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorView.ts` | 19,455 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SoundVisualView.ts` | 7,148 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts` | 179,015 | 否 | 明确使用中（仅历史隔离副本） | 引用：`docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts`。隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/types/.gitkeep` | 0 | 否 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/tsconfig.json` | 338 | 否 | 明确使用中（仅历史隔离副本） | 隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/vite.config.ts` | 2,917 | 否 | 明确使用中（仅历史隔离副本） | 隔离副本index/main/Vite/config依赖图可达，不属于正式生产入口 | 否 |
| `docs/verification/SECOND_BEDROOM/review.html` | 1,254 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/SHADOW_CORRECTION/review.html` | 1,468 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `docs/verification/STORAGE_VISUAL/review.html` | 1,861 | 否 | 需要动态验证（手工验收/探针） | 根构建不收录；可能由人或旧脚本单独执行，不安全自动运行可能改存档的脚本 | 否 |
| `public/assets/ui/portraits/deepseek-rice-v1.webp` | 213,776 | 是 | 高置信未参与当前运行（历史UI） | 不在当前入口/测试图；旧CSS未载入，旧UI当前引用使用其他正式文件；需结合网络记录 | 是，仍保留 |
| `public/maps/.gitkeep` | 0 | 是 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 是，仍保留 |
| `public/ui/components/blue-strip.png` | 13,316 | 是 | 明确使用中（离线UI加工） | extract-ui-sheets.py的CROPS输出；main/compact/button原图还用于生成stretch组件 | 是，仍保留 |
| `public/ui/components/button-shell.png` | 35,693 | 是 | 明确使用中（离线UI加工） | extract-ui-sheets.py的CROPS输出；main/compact/button原图还用于生成stretch组件 | 是，仍保留 |
| `public/ui/components/header-strip.png` | 39,726 | 是 | 明确使用中（离线UI加工） | extract-ui-sheets.py的CROPS输出；main/compact/button原图还用于生成stretch组件 | 是，仍保留 |
| `public/ui/faction-name-gradient-clean.svg` | 1,816 | 是 | 高置信未参与当前运行（历史UI） | 不在当前入口/测试图；旧CSS未载入，旧UI当前引用使用其他正式文件；需结合网络记录 | 是，仍保留 |
| `public/ui/faction-name-gradient.png` | 1,668,139 | 是 | 高置信未参与当前运行（历史UI） | 不在当前入口/测试图；旧CSS未载入，旧UI当前引用使用其他正式文件；需结合网络记录 | 是，仍保留 |
| `public/ui/panels/compact-shell.png` | 57,863 | 是 | 明确使用中（离线UI加工） | extract-ui-sheets.py的CROPS输出；main/compact/button原图还用于生成stretch组件 | 是，仍保留 |
| `public/ui/panels/main-shell.png` | 154,709 | 是 | 明确使用中（离线UI加工） | extract-ui-sheets.py的CROPS输出；main/compact/button原图还用于生成stretch组件 | 是，仍保留 |
| `src/controllers/.gitkeep` | 0 | 是 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 否 |
| `src/types/.gitkeep` | 0 | 是 | 高置信未参与当前运行（目录占位） | 0字节，不是运行资源；保留空目录的Git用途不等于代码运行用途 | 否 |
