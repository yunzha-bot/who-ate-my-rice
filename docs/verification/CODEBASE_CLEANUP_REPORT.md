# 第一轮工程整理：审计、安全重构与冗余排查

日期：2026-10-15（Asia/Shanghai）。本轮已实施低风险代码整理，尚待用户审核；没有删除或移动文件，没有暂存、commit、push、Tag。不是新功能或平衡调整，也不将本轮标为归档 Gate=PASS。

## 1. 基线、范围与总体评价

- 开工现场为 main，HEAD及真实远端main均为历史发布提交 `e891b8a5dee76a7deb2ea9dc6f847bb16c3977da`（`feat: complete S13 audio, difficulty modes and responsive UI`）。该次GitHub快照确已同步；本轮收尾仍未产生新提交。MERGE_HEAD、REBASE_HEAD、CHERRY_PICK_HEAD、rebase-merge、rebase-apply均不存在。
- 开工时没有已跟踪文件差异；存在274项Git默认状态输出中的未跟踪文件/目录，包括私人目录、17份主场景备份、incoming-assets及历史验证材料。目录状态项不等于实际文件数。全部保留，不读三个私人目录的内容；也没有调整忽略规则。
- 已阅读AGENTS、当前HANDOFF、最近相关日志、前次审计及直接相关代码。前次报告里的5秒、DEV-B自动恢复和旧测试数量是历史证据；本轮以当前源码和实际测试为准。
- 代码范围包含src、tests、scripts、根构建配置/锁文件入口及加载中的CSS；资产检查覆盖public的文件元数据、哈希、动态引用，以及原始素材/备份的保留边界。不把node_modules、Git内部文件或私人配置当待整理源码。
- 规则模块的权威来源整体清楚，主要债务是ThreeGame接线和DEV投影集中、历史CSS叠层、生命周期收尾遗漏；不是技术栈或依赖过多。没有新增依赖或格式化工具，没有执行全项目格式化。
- 使用codebase-design限定只读投影接口；ponytail限定复用既有UI模块而非建立框架；ponytail-audit提供删减候选，不把其建议直接当删除授权。确认生命周期问题后，按diagnosing-bugs先复现再验证修复。

## 2. 结构及体积变化

```text
main → StartupView / 制作信息 / 六份已加载CSS
     → ThreeGame（仍持有编排、游戏时钟及真实状态）
        ├─ GameState / Rice / Sprint / Door / Hide / Perception / Navigation
        ├─ 两套AI控制器（本轮未修改）
        ├─ GameUiLayout（增加动作按钮组成及时间格式）
        ├─ DevBHumanHideObservation（新增只读投影，无DOM和AI推进）
        ├─ GameAudio / GameFeedback / HUD / PulseLock / 角色表现
        └─ SceneEditor / DEV-B / 调试视图
```

行数包括空行和注释；源码统计仅TS/CSS，测试统计MJS（包含辅助脚本），不把场景JSON、备份或截图算作代码删减。scripts栏只统计2个JS/MJS；另有未改的Python加工脚本（9,103字节）。

| 范围 | 整理前文件 / 行 / 字节 | 整理后文件 / 行 / 字节 | 行数净变化 |
|---|---:|---:|---:|
| src（101→102 TS；7 CSS） | 108 / 28,267 / 1,367,585 | 109 / 28,285 / 1,366,242 | +18 |
| tests | 109 / 21,098 / 1,057,765 | 111 / 21,217 / 1,064,167 | +119 |
| scripts（JS/MJS） | 2 / 138 / 8,923 | 2 / 138 / 8,923 | 0 |

| 模块 | 整理前：行 / 字节 | 整理后：行 / 字节 | 行数差 |
|---|---:|---:|---:|
| `src/three/ThreeGame.ts` | 3573 / 198196 | 3475 / 191751 | -98 |
| `src/systems/DeepSeekAIController.ts` | 2794 / 129263 | 2794 / 129263 | 0 |
| `src/systems/HumanAIController.ts` | 1838 / 89531 | 1838 / 89531 | 0 |
| `src/three/GameAudio.ts` | 278 / 11491 | 278 / 11491 | 0 |
| `src/three/GameUiLayout.ts` | 58 / 3783 | 84 / 5167 | 26 |
| `src/three/GameFeedback.ts` | 43 / 1991 | 56 / 2229 | 13 |
| `src/three/SceneEditor.ts` | 570 / 23678 | 571 / 23797 | 1 |
| `src/s13-ui.css` | 96 / 5594 | 75 / 4451 | -21 |
| `src/config/difficultyConfig.ts` | 61 / 3254 | 61 / 3254 | 0 |
| `src/systems/GameStateSystem.ts` | 100 / 2918 | 100 / 2918 | 0 |
| `src/three/DevBHumanHideObservation.ts` | 新增 | 93 / 4665 | +93 |

ThreeGame净减98行；移出投影本身是职责转移，不是假称删掉93行功能。src总行数净增18，字节净减1,343；新增资源清理和类型明确化有实际用途，不以行数最少为唯一目标。没有拆分或重写两套AI。

## 3. 已完成的安全整理

| 修改位置 | 证据与实际整理 | 行为边界/验证 |
|---|---|---|
| ThreeGame → 新增DevBHumanHideObservation | 原约90行Human搜查观察投影移到单一只读函数；输入为原AI、同一时间源、原3项权威结果 | 不推进AI/时钟，不增加隐藏真值；2种种子×3难度×500帧共3,000次与HEAD原函数深比较一致；覆盖到PATROL/INVESTIGATE/CHASE/CAPTURE，不声称覆盖所有搜查状态 |
| GameUiLayout / ThreeGame | 7处重复原生按钮搭建共用一个局部工厂；3处同格式时钟共用formatMatchTime；坐标文案复用原pointText | 文案、顺序、单次监听、DEV可见性、设置聚焦与回调不变；新增行为测试+双浏览器暂停/重开/结算 |
| ThreeGame、CollisionWorld、SceneEditor、MapEditModel等 | 清理13项未使用导入、局部变量/参数、只写状态；包括lastChase、furnitureSearchSpotId、lastRiceProgressMs、previewValid等 | 不删音频事件、配置字段或预留功能；可选noUnused诊断15→2，剩余2处在AI中，保留不动 |
| GameFeedback | 一个Map统一记录文本/米粒的回退定时器与animationend处理；clear/dispose和动画完成均注销 | 原950/750ms、3粒及减少动态偏好保留；修复前实际回归3项失败/1项通过，修复后4/4通过 |
| AISafetyPathView | 原更新时几何清理复用为clear；新增dispose并从场景脱离 | 不改调试显示阈值或安全路线；真实Three几何/材质各释放一次、二次dispose安全 |
| SceneEditor | 匿名beforeunload改为稳定处理器，dispose注销 | 条件和提示完全不变；干净不拦截→未保存拦截→恢复不拦截；浏览器销毁后本组件监听1→0（Vite自己的监听不动） |
| ThreeGame.dispose | 幂等保护、先取消RAF、停止DEV-B订阅；调用已有ApartmentBuild.dispose；释放米点、调试线、角色代理、门视图及阴影；移除自身DOM | 只改整实例销毁路径，正常重开继续走原reset；没有泛化递归释放共享GLB纹理 |
| s13-ui.css | 移除23条被后加载相同选择器相同属性无条件覆盖的声明 | 未追加!important；不改媒体查询、阵营菜单、HUD或PulseLock的有效规则；浏览器样式与区域盒前后一致 |
| 少量格式 | collectDevBObservation声明与首句分行；新模块沿用TS/单引号/两空格 | 无批量格式化和依赖变化 |

两个新增测试文件为 `tests/cleanup-projection.test.mjs`（3项）与 `tests/view-cleanup.test.mjs`（4项）。原测试没有删除、跳过或放宽关键断言。为直接用Node运行真实视图回归，GameFeedback参数属性改等价显式字段，AISafetyPathView现有导入补.ts扩展名。

## 4. 重复逻辑、依赖和CSS审计

- 静态相对导入/re-export/字面动态import的保守扫描：102个TS模块、325条边，从main沿含类型边遍历没有孤立TS文件。未发现运行时环；1个含类型边的环为HumanAIController↔HumanHideSearchResolution，返回边是import type，保留。扫描不是完整TS编译器语义或任意运行时字符串求值证明。
- systems中少数依赖three/map纯几何和类型，Perception依赖Three向量/相机。这是已有边界，不为目录“纯净”复制第二套地图或导航。
- 两套AI中的一行XZ distance辅助虽然同形，但复用收益很小；家具box/round包装存在分段/材质/局部坐标差异；地图signature和布局signature覆盖字段不同。本轮不强行合并，也不改AI决策。
- 已加载顺序：style → industrial-ui → sheet-ui → s13-ui → game-ui → faction-menu。rain-ui未加载且明确历史保留。仅精简s13中已证实无效的23条声明；[逐项证据](codebase-cleanup/css-removed.json)含选择器、原值和后续有效来源。
- Chrome/Edge对暂停和声音设置各20项选定computed属性逐选择器前后深比较相同；5种菜单视口的区域盒完全一致。另对胜/负结算在相同DOM上仅切换旧/新s13样式进行差分，不把随机场景像素差当CSS退化。
- 媒体查询、状态选择器、hidden及减少动态的!important不能仅因为重复就删除；仍有历史层叠债务，后续应逐区域用computed style和真实截图证明，不统一重写全部CSS。
- 根tsconfig严格检查src，但不静态检查MJS测试和vite.config.ts；它们分别由npm test和Vite加载验证。额外noUnused检查并非当前正式门禁：剩余 `DeepSeekAIController.ts:288 hideMap` 与 `HumanAIController.ts:980 input` 两项诊断，未改控制器或tsconfig。
- 目前缺少统一自动格式化约定，局部压缩代码仍存在（HomeGymVisual、prepare-rice-bag）；没有足够证据引入新工具或重排作者布局。

## 5. 生命周期与性能证据

| 检查点 | 整理前 | 整理后 |
|---|---|---|
| 反馈clear后的回退timer | 4个仍待执行 | 0，动画监听0 |
| 单个动画结束后的timer | 2个仍保留 | 已结束项注销，另1项正常保留 |
| 整实例dispose后的DEV-B订阅 | 1 | 0 |
| 整实例dispose后的安全线条 | 2 | 0，geometry/material释放 |
| 整实例dispose后的米点映射 | 5 | 0，对象脱离场景 |
| 地图root / canvas / menu | 仍挂载 | 均脱离 |
| 编辑器beforeunload监听 | 组件1个仍注册 | 组件0个；Vite监听保留 |

原始结果见[销毁前后与浏览器记录](codebase-cleanup/after-browser.json)、[编辑器修复前](codebase-cleanup/before-editor.json)、[修复后](codebase-cleanup/after-editor.json)。这些是整实例销毁复现，不声称过去每次重开都泄漏整张地图；原resetRice等已有独立清理。

审计还确认InputManager/SceneEditorView窗口与指针监听已有dispose配对，AlphaHud/DEV面板消息timer已有清理；CharacterActionView/DeepSeekAnimation移除mixer监听，异步模型返回已有disposed保护。GameAudio已有generation/musicSerial、source.onended断连、reset停止短音/循环、dispose关闭AudioContext，本轮全部保留，相关异步/多局回归通过。

未发现setInterval入口或第二条独立游戏RAF循环；没有新增逐帧DOM查找。较大调试详情仍在展开时构建，不擅改采样节奏或缓存规则。StartupView完成时恢复DefaultLoadingManager回调并有超时降级；没有通用卸载接口，main也未接HMR dispose，未来若支持多实例/SPA挂载需另行设计。共享GLB模板、纹理及米袋缓存不是可随意释放的孤立资源；本轮不声称GPU资源已通过长期堆快照证明零泄漏，也未进行FPS基准测量。

## 6. 受保护数据核对

任务前后107项选定保护文件SHA-256相同，包括全部87个public文件、玩法/难度配置、权威地图、DEV持久化/覆盖模块、两套AI、v6加载/动画/头发、音频管理和脚本。不存在非dist文件删除；18个备份的原路径/大小保留，未清理或恢复备份。完整逐文件哈希见[保护清单](codebase-cleanup/protection.json)。

| 关键文件 | 前后相同的SHA-256 |
|---|---|
| `src/config/gameConfig.ts` | `75badb6ff2a1e92e8045c45c82db1459c1cace642e78c6b1c48eb97a9c8a00ae` |
| `src/config/difficultyConfig.ts` | `83ee5aee397476b3762cc578392565808f1a2158a4ac3738a9b1e460b61ebebe` |
| `src/three/map/sceneLayout.json` | `9d53920224997dc3b8d2caeea56b0b647f9abaeca9d137d17756f8d78b9dc1d8` |
| `src/three/map/apartmentMap.ts` | `e7e8f11829e38a382e9b5b4a8a5dc85a6a3390dcdd60b056df2b0143d285a8bb` |
| `src/systems/DevBParamStore.ts` | `71b6f96fa14d3c1581609d4e00c18dc2fcd7d8167b72bdf97d7822cd1d46d6c0` |
| `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb` | `b74025c238bb884bdd0d05e2ef9ab6061916dad1512549207fef6f8ee3cfb026` |

37个Ogg的相对路径排序后按“路径+NUL+SHA256”串联聚合SHA-256为 `bee3cab3c744fac914a82597b1a35b4cf47a32521ebeecfbe1fdad44fa579f94`。42个事件接口、37个实际资源、五项禁播列表全部不变。音频通过 `assets/audio/${cue}.ogg` 动态构造，单纯全文搜索完整文件名会误报全部37个为未引用；已经排除该误判。权威sceneLayout仍110件家具、15个HideSpot；没有重写数据或读取用户真实浏览器的DEV-B预设。

### 需要单独处理的构建发布风险

本机public含6个Git精确忽略的旧GLB（v1/v2/v3/v4/v5及standalone，合计74,377,392字节）。Vite会把public内容复制进dist，**Git ignore不是构建资源白名单**；本轮生成的本机dist也含这些旧资产。不能未经资产审查就把整份本机dist公开部署。此项不影响本次本地重构测试，但属于后续发布风险；不要通过删除原模型解决。本轮仅记录，未改Vite、资产或忽略规则。

## 7. 冗余文件分类与第二轮建议

共登记222项：**A 3个文件，B 173个文件，C 43个文件+3个私人目录**；这不是“确认222个无用文件”。全体未删，且没有认定C类可删除。

| 类别 | 数量 | 判定与处置 |
|---|---:|---|
| A | 3 | 已有实际内容目录内的0字节.gitkeep；低风险占位冗余 |
| B | 173 | 3个预留目录占位、8个无当前运行引用的UI候选、66个历史验证脚本、96个隔离副本文件；依赖或保留需求不明 |
| C | 46项 | 18份备份、6个原始米袋素材、6个旧GLB、源图/历史样式/声音归档及3个私人目录；保留 |

public资源按字节SHA256分组**没有完全相同的重复文件**；相似名称/接近大小不等于重复内容。所有根tests/*.test.mjs由npm脚本执行，辅助仿真由测试导入；没有判定可删除的正式测试文件或运行TS文件。当前dist是可重建输出，不叫“过期文件”，不列第二轮默认删除名单。历史截图/遥测不因未被报告链接就自动变成垃圾。

第二轮优先请求用户批准的具体删除范围只有：

- `docs/.gitkeep`
- `src/systems/.gitkeep`
- `tests/.gitkeep`

这3个文件合计0字节，收益是减少无效占位，不是磁盘空间优化。其余B项必须先核对手工脚本、历史报告和美术再生成需求，尤其不能把含备份的test-copy目录整批清掉。C项默认排除。下方附录逐文件列出字节、追踪状态、引用、动态可能、用户资产判断与风险；私人目录只列顶层，大小/内容均未读取。

## 8. 自动化与受控浏览器验证

| 检查 | 整理前 | 整理后 |
|---|---|---|
| npm test | 878/878，失败/取消/跳过0 | 885/885，失败/取消/跳过0，约58.34秒 |
| npx tsc --noEmit | 独立执行退出0 | 独立执行退出0 |
| npm run build | 退出0，116模块 | 退出0，117模块 |
| git diff --check | 通过 | 通过；CRLF提示不是空白错误 |
| 补充只读投影差分 | 原HEAD函数 | 3,000帧全部相同 |
| 可选noUnused诊断 | 15项，不是正式门禁 | 2项留在未改AI中，退出1，如实保留 |

生产输出CSS 68.20→67.27 kB、JS 1,293.38→1,292.52 kB（gzip 362.48→362.76 kB）；既有大于500kB chunk告警保留，不能据此声称帧率提升。

真实受控浏览器明确page.goto `http://127.0.0.1:5173/`，核对URL、端口及标题“谁吃了我的米”，复用已存在服务。Chrome **154.0.8037.100**、Edge **151.0.4129.86**，独立新上下文，不复用无法核验URL的原浏览器宿主。实例引用只通过Playwright临时响应拦截提供，没有把调试全局写入项目源码。

| 实测项目 | Chrome / Edge结果 |
|---|---|
| 菜单视口 | 各1455×818、1067×600、800×450、480×640、1920×1080；四大区域顺序无相交，无横向溢出，与原盒数据一致；短页自然滚动 |
| 六组合 | 每浏览器DeepSeek/Human×EASY/NORMAL/HARD全部进入；原生W移动、ESC、声音设置键盘滑块、继续、返回 |
| 实际配置 | DeepSeek玩家面对Human倍率0.52/0.78/0.95；Human玩家面对DeepSeek警戒5/6/7；每局5份、maxProgressMs=30000 |
| 角色 | 两阵营对局实例中正式DeepSeek对象有SkinnedMesh；v6文件、加载器、动画、头发模块哈希未变；不把只看请求200当角色验收 |
| 暂停/设置 | Master Home→0、ArrowRight→1、恢复默认、ESC返回/继续；computed style前后相同，原音频行为由既有测试覆盖 |
| 重新开始/结算 | 两阵营HARD重开仍HARD；调用现有forceCapture权威入口仅用于结算界面回归，检查胜/负按钮样式及返回，不冒充自然抓捕整局 |
| 制作信息 | 入口滚动可达，原生dialog打开与ESC关闭正常 |
| DEV-B隔离保存/刷新 | 仅新浏览器上下文保存0.61测试预设；刷新实际基础0.52，没有静默应用；显式恢复0.61，原用户预设不读不改 |
| 编辑器/整实例销毁 | 未保存提醒条件不变；监听/对象/DOM清理及重复dispose通过 |
| JS异常 | 本轮受控页面pageerror为0，主浏览器记录console error为0；不据此否认此前favicon/软件GPU历史日志 |

**边界**：此次是CSS视口而非原生90%～200%缩放；原生缩放上轮经用户验收，本轮未重做全比例人工检查。未再以自然时长吃完5份、逐一门/PulseLock/藏身/声音主观试听或玩家胜率作人工验收；这些由未改模块哈希与全量相关自动化测试回归提供保护，不冒充新人工试玩。没有改保存接口或对真实场景执行保存POST；隔离DEV-B预设测试不等于访问了用户真实预设。没有单独启动生产preview浏览器或重新进行长期FPS/堆快照测试。

### 实际界面截图

同一CSS视口前后对照，随机地图/相机内容可能不同，不作全图像素相等断言：

- [菜单整理前](codebase-cleanup/before-chrome-menu-1455.png) / [整理后](codebase-cleanup/after-chrome-menu-1455.png)（1455×818，底栏在自然滚动下方）。
- [小窗口菜单](codebase-cleanup/after-chrome-menu-800.png)（800×450）。
- [暂停整理前](codebase-cleanup/before-chrome-pause.png) / [整理后](codebase-cleanup/after-chrome-pause.png)。
- [Edge暂停](codebase-cleanup/after-edge-pause.png)；完整菜单与结算差分补证见同目录surfaces.json和menu-full截图。

## 9. 未执行的高风险整理

| 优先级 | 具体位置/证据 | 影响与建议 | 为什么本轮不做 |
|---|---|---|---|
| P1发布前 | public旧GLB会复制到dist | 设计构建发布白名单或无旧资源的隔离构建，保留原件 | 资产发布边界，不与行为等价整理混做；不能删原模型 |
| P2维护 | ThreeGame仍3475行，updatePlaying及大型调试字段适配 | 下一轮只选一个稳定投影/接线面，固定输入输出和浏览器回归 | 整类重写高耦合，单纯拆文件不等于改善 |
| P2维护 | DeepSeekAI2794/HumanAI1838行 | 有明确需求后再提取纯评分/路线估时；保留状态和感知权威 | 用户禁止改行为决策，本轮连两项无用诊断也先保留 |
| P2界面 | 六层有效CSS，部分历史覆盖仍存在 | 按HUD/暂停/PulseLock逐区域生成级联表、截图后合并 | 不对剩余覆盖“一刀切”，不冒险破坏已验收缩放 |
| P2文档语义 | RuntimeDebugOverrides的hearing.range元数据说仅新事件，真实Perception即时读取 | 维持已有实际行为；由用户另行决定是否只修说明 | 前次审计已列争议，不能借清理更改声音规则 |
| P3类型 | HumanAIMapSnapshot类型回环、观察投影保留旧lastSeen断言 | 真正需要公开契约时再迁移类型，不建空层 | 不是运行时循环或本轮复现Bug |
| P3测试 | 若干源码正则契约测试 | 分清禁止功能恢复的契约与实现形状，再逐项改行为测试 | 不删/放宽测试迎合重构 |
| P3生命周期 | StartupView、菜单挂载没有统一根生命周期/HMR卸载入口 | 若以后增加多实例/SPA导航再设计所有权 | 当前main单挂载；无证据需要本轮新增复杂生命周期框架 |
| P3格式 | 紧凑家具/离线脚本、未统一扩展名风格 | 仅在实际编辑时局部整理，工具另评估 | 不全局格式化，不动作者地图 |

## 10. 修改文件与交付状态

既有文件12个：

- `src/s13-ui.css`
- `src/systems/AILogCollector.ts`
- `src/three/AISafetyPathView.ts`
- `src/three/CollisionWorld.ts`
- `src/three/DevBPanel.ts`
- `src/three/GameFeedback.ts`
- `src/three/GameUiLayout.ts`
- `src/three/SceneEditor.ts`
- `src/three/SceneEditorPanel.ts`
- `src/three/SceneEditorView.ts`
- `src/three/ThreeGame.ts`
- `src/three/map/MapEditModel.ts`

新增辅助模块1个、测试2个见§3；文档为本报告、HANDOFF必要摘要及AGENT_LOG末尾追加。本轮证据只新增 `docs/verification/codebase-cleanup/` 中列明的截图/JSON，不修改未知历史材料。报告和交接不改变其他阶段授权/Gate；AGENTS未改。

检查结果交用户审阅，下一步仅等待用户选择第二轮实际范围。A/B/C均不构成删除授权；没有暂存、commit、push或Tag。

## 附录：完整A/B/C文件候选台账

本附录是审计快照；“未见引用”只覆盖本轮允许扫描范围，不是任意脚本/用户工作流程绝不使用的证明。脚本和隔离副本按单文件列出，但不得据此拆散副本或绕过C类保留边界。

### A类逐项清单

| 完整项目相对路径 | 字节 | Git追踪 | 引用证据 | 动态/离线可能 | 用户资产 | 建议 | 删除风险 |
|---|---:|---|---|---|---|---|---|
| `docs/.gitkeep` | 0 | 是 | 0字节；目录已由实际文件持续追踪；构建/测试不读取占位文件 | 否 | 否 | 第二轮可申请删除；仅消除无效目录占位 | 低 |
| `src/systems/.gitkeep` | 0 | 是 | 0字节；目录已由实际文件持续追踪；构建/测试不读取占位文件 | 否 | 否 | 第二轮可申请删除；仅消除无效目录占位 | 低 |
| `tests/.gitkeep` | 0 | 是 | 0字节；目录已由实际文件持续追踪；构建/测试不读取占位文件 | 否 | 否 | 第二轮可申请删除；仅消除无效目录占位 | 低 |

### B类逐项清单

| 完整项目相对路径 | 字节 | Git追踪 | 引用证据 | 动态/离线可能 | 用户资产 | 建议 | 删除风险 |
|---|---:|---|---|---|---|---|---|
| `docs/verification/BALCONY/review.html` | 1220 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/BATHROOM/review.html` | 967 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/COVERED_INTERIOR/review.html` | 1908 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/DEEPSEEK_ANIMATION_STAGE4/preview.html` | 3100 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/DEV_SCENE_EDITOR_V2/browser-check.mjs` | 20871 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/DEV-B-PARAMS/browser-check.mjs` | 19572 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/cfg-deepseek.js` | 205 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/cfg-human.js` | 169 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/export.js` | 3211 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/menu-crop.html` | 4245 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p01-probe.js` | 735 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p02-shotshape.js` | 515 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p03-viewport.js` | 717 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p04-sweep.js` | 1584 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p05-shotdiag.js` | 1272 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p06-clickdiag.js` | 1781 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p07-sweep.js` | 2192 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p08-retry.js` | 1564 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p09-rooms.js` | 2132 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p10-menucrop.js` | 1402 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p11-realmenu.js` | 2068 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p12-start-human.js` | 4755 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p13-fps.js` | 671 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p14-fps-size.js` | 971 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p16-devdom.js` | 1063 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p17-panelcost.js` | 1881 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/p19-console.js` | 472 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/poll.js` | 3880 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/poll2.js` | 4589 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/poll3.js` | 4471 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/rooms.html` | 3616 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/scan-rice.mjs` | 1565 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/start-deepseek.js` | 6611 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EAST_WING_EXPANSION/start.js` | 5868 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/ENTRY/review.html` | 1018 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EXTERIOR_GEOMETRY/review.html` | 3073 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/EXTERIOR_SHADOW/review.html` | 2880 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/HOME_GYM/review.html` | 1553 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/INDUSTRIAL_UI/preview.html` | 973 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/KITCHEN/review.html` | 980 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/MAIN_BEDROOM/review.html` | 1311 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/MAP_SCALE_UP/p01-views.js` | 2108 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/MAP_SCALE_UP/p02-plans.js` | 1458 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/MAP_SCALE_UP/plan.html` | 11146 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/MAP_SCALE_UP/view.html` | 3658 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/NORTH_BALCONY/review.html` | 997 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/PLAYER-SOUND-VISUAL-DISABLE/browser-check.mjs` | 16667 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/RESIDENTIAL_FURNITURE_V1/view.html` | 3864 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/RESIDENTIAL_FURNITURE_V3/audit.mjs` | 2443 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/RESIDENTIAL_FURNITURE_V3/view.html` | 4615 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7C-2-r2/browser-check.mjs` | 19120 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7C-2-r3/browser-check.mjs` | 22882 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7C-2-r4/browser-check.mjs` | 28799 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7C-2b/browser-check.mjs` | 18488 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/analyze-match.mjs` | 2849 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/browser-check.mjs` | 16516 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/diagnose-hide-lock.mjs` | 2285 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/diagnose-safewait.mjs` | 3506 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/probe-dom.mjs` | 3147 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/robustness-sweep.mjs` | 2067 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/run-match-batch.mjs` | 7714 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/S7D/smoke-sim.mjs` | 1289 | 是 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/backup.html` | 588 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/index.html` | 306 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/legacy-seed.html` | 281 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/legacy.json` | 63189 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/package.json` | 434 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/config/gameConfig.ts` | 17204 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/controllers/.gitkeep` | 0 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/industrial-ui.css` | 27810 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/main.ts` | 284 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/rain-ui.css` | 16805 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/sheet-ui.css` | 6612 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/style.css` | 29958 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/.gitkeep` | 0 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/AILogCollector.ts` | 27839 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/CharacterAction.ts` | 1087 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekAIController.ts` | 129355 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekDoorLockPenalty.ts` | 1237 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideCandidates.ts` | 14893 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekHideResolution.ts` | 6586 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DeepSeekVisualTarget.ts` | 2714 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBHelpText.ts` | 24702 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBObserver.ts` | 25626 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBParamPersistence.ts` | 6517 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBParamStore.ts` | 10770 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevBRuntimeBinding.ts` | 2934 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DevFreezeSystem.ts` | 6884 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/DoorSystem.ts` | 6592 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/GameStateSystem.ts` | 2918 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideInteractionArbitration.ts` | 1986 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSearchCandidates.ts` | 12766 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideSystem.ts` | 11950 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HideTargetResolution.ts` | 11792 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanAIController.ts` | 89461 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanDoorSkill.ts` | 1410 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchResolution.ts` | 20528 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanHideSearchStance.ts` | 8105 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanSearchSkill.ts` | 9902 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanSearchTuning.ts` | 8716 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanStillness.ts` | 863 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/HumanTraceTracking.ts` | 7454 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/MatchRandom.ts` | 7439 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/NavigationSystem.ts` | 10963 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/PerceptionSystem.ts` | 14509 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/PulseLockSystem.ts` | 4551 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceField.ts` | 1947 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceSystem.ts` | 2105 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RiceTraceClues.ts` | 6126 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/RuntimeDebugOverrides.ts` | 11943 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SkillCooldown.ts` | 1118 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SkillGates.ts` | 1755 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/systems/SprintSystem.ts` | 3685 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AISafetyPathView.ts` | 2872 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaHudView.ts` | 8119 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/AlphaPresentation.ts` | 24144 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CameraRelativeMovement.ts` | 993 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CaptureZone.ts` | 3037 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CharacterActionView.ts` | 9978 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CollisionWorld.ts` | 11803 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/CommunityCourtView.ts` | 7285 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DebugDetailsPanel.ts` | 18456 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekAnimation.ts` | 3638 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekGlbModel.ts` | 2985 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekHairMotion.ts` | 7000 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DeepSeekMaidModel.ts` | 9052 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBDebug.ts` | 7176 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBPanel.ts` | 24139 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DevBView.ts` | 12963 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DoorView.ts` | 5829 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/DoorVisualGeometry.ts` | 985 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/GameUiLayout.ts` | 3523 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/HideSearchView.ts` | 19320 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/InputManager.ts` | 2251 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/InteractionPrompt.ts` | 1730 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/LocalControl.ts` | 2616 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/apartmentMap.ts` | 19653 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/ClosedExteriorDoors.ts` | 2326 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/HideInteractionRegion.ts` | 15533 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapApplicationPrecheck.ts` | 3321 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapBuilder.ts` | 12208 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapEditModel.ts` | 43691 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/MapLayoutStore.ts` | 20172 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/RotatedRect.ts` | 11196 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/sceneLayout.json` | 20805 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/PulseLockView.ts` | 3211 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ResidentialExterior.ts` | 30186 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RiceTraceView.ts` | 1412 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RiceView.ts` | 3515 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/RoundShortcuts.ts` | 612 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneCameraDepth.ts` | 1501 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditor.ts` | 24064 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorPanel.ts` | 23510 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SceneEditorView.ts` | 19455 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/SoundVisualView.ts` | 7148 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/ThreeGame.ts` | 179015 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/types/.gitkeep` | 0 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/tsconfig.json` | 338 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/vite.config.ts` | 2917 | 否 | 旧场景持久化隔离副本；不在根 src/main.ts 或根测试glob入口 | 是：副本可独立运行/验证 | 可能：用户保留的隔离证据 | 整份副本暂留；先确认是否仍作历史复现，禁止只删其中源码 | 高：破坏完整复现环境 |
| `docs/verification/SECOND_BEDROOM/review.html` | 1254 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/SHADOW_CORRECTION/review.html` | 1468 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `docs/verification/STORAGE_VISUAL/review.html` | 1861 | 否 | 历史验证脚本/探针；不在 src/main.ts 导入图或 npm test 的 tests/*.test.mjs 入口 | 是：人工执行/历史验收脚本 | 可能：历史验证材料 | 保留；逐个核对所属报告及人工复用需求后再决定 | 中 |
| `public/assets/ui/portraits/deepseek-rice-v1.webp` | 213776 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/maps/.gitkeep` | 0 | 是 | 0字节；没有运行模块引用；所在目录为空或预留 | 否 | 否 | 保留，先确认是否还要保留预留目录 | 中：删除后Git不再保留目录 |
| `public/ui/components/blue-strip.png` | 13316 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/components/button-shell.png` | 35693 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/components/header-strip.png` | 39726 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/faction-name-gradient-clean.svg` | 1816 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/faction-name-gradient.png` | 1668139 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/panels/compact-shell.png` | 57863 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `public/ui/panels/main-shell.png` | 154709 | 是 | 未见运行/测试字面路径引用；README/素材审查有记录；派生图输出须对照 scripts/extract-ui-sheets.py | public可通过字符串/手工URL使用 | 是：用户UI素材 | 暂留，先确认历史美术/再生成用途；不把文档引用当运行引用 | 中 |
| `src/controllers/.gitkeep` | 0 | 是 | 0字节；没有运行模块引用；所在目录为空或预留 | 否 | 否 | 保留，先确认是否还要保留预留目录 | 中：删除后Git不再保留目录 |
| `src/types/.gitkeep` | 0 | 是 | 0字节；没有运行模块引用；所在目录为空或预留 | 否 | 否 | 保留，先确认是否还要保留预留目录 | 中：删除后Git不再保留目录 |

### C类逐项清单

| 完整项目相对路径 | 字节 | Git追踪 | 引用证据 | 动态/离线可能 | 用户资产 | 建议 | 删除风险 |
|---|---:|---|---|---|---|---|---|
| `.codex/` | 未读取 | 否 | 只见Git顶层状态；未读取目录内容 | 未检查 | 是：私人配置 | 禁止访问/暂存/删除；不纳入文件字节统计 | 高 |
| `.dsh-meow/` | 未读取 | 否 | 只见Git顶层状态；未读取目录内容 | 未检查 | 是：私人配置 | 禁止访问/暂存/删除；不纳入文件字节统计 | 高 |
| `.trae/` | 未读取 | 否 | 只见Git顶层状态；未读取目录内容 | 未检查 | 是：私人配置 | 禁止访问/暂存/删除；不纳入文件字节统计 | 高 |
| `archive/features/player-sound-visual/README.md` | 8927 | 是 | AGENTS.md指定停用功能归档；SoundVisualView及禁用契约仍保留 | 是：恢复文档/测试 | 是：明确归档 | 保留；不能当死代码删除或启用 | 高 |
| `archive/features/player-sound-visual/SoundVisualView.ts` | 7148 | 是 | AGENTS.md指定停用功能归档；SoundVisualView及禁用契约仍保留 | 是：恢复文档/测试 | 是：明确归档 | 保留；不能当死代码删除或启用 | 高 |
| `archive/features/player-sound-visual/visual-config.md` | 3868 | 是 | AGENTS.md指定停用功能归档；SoundVisualView及禁用契约仍保留 | 是：恢复文档/测试 | 是：明确归档 | 保留；不能当死代码删除或启用 | 高 |
| `archive/features/player-sound-visual/wiring-and-tests.md` | 5671 | 是 | AGENTS.md指定停用功能归档；SoundVisualView及禁用契约仍保留 | 是：恢复文档/测试 | 是：明确归档 | 保留；不能当死代码删除或启用 | 高 |
| `docs/verification/SCENE_LAYOUT_PERSISTENCE/test-copy/src/three/map/sceneLayout.json.2026-10-10T13-44-01-011Z.bak` | 20805 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `incoming-assets/rice-bag/19bdb7546f1457a1fe515737f54bd661.obj` | 3283791 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `incoming-assets/rice-bag/material.mtl` | 245 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `incoming-assets/rice-bag/texture_pbr_20250901_metallic.png` | 2750165 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `incoming-assets/rice-bag/texture_pbr_20250901_normal.png` | 12893805 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `incoming-assets/rice-bag/texture_pbr_20250901_roughness.png` | 4893388 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `incoming-assets/rice-bag/texture_pbr_20250901.png` | 20617856 | 否 | 原始米袋工作资产；只检查元数据；prepare-rice-bag.mjs使用OBJ和主贴图 | 是：离线资产加工 | 是：原始素材 | 保留；不得以未运行时加载为由删除 | 高 |
| `public/assets/characters/deepseek/deepseek_animated_v1.glb` | 12491168 | 否 | 历史版本；快照审查记录；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/characters/deepseek/deepseek_animated_v2.glb` | 12491164 | 否 | 历史版本；快照审查记录；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/characters/deepseek/deepseek_animated_v3.glb` | 12491164 | 否 | 历史版本；快照审查记录；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/characters/deepseek/deepseek_animated_v4.glb` | 12490912 | 否 | 历史版本；快照审查记录；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/characters/deepseek/deepseek_animated_v5_hair_ready.glb` | 12496972 | 否 | DeepSeekGlbModel.ts显式回退路径；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/characters/deepseek/deepseek_midpoly_18500_standalone.glb` | 11916012 | 否 | DeepSeekGlbModel.ts显式回退路径；精确.gitignore排除 | 是：v5/静态回退；其余可手工加载 | 是：旧版角色资产 | 原位保留，不上传/删除；本机dist会复制这些文件，发布前需单独审查 | 高 |
| `public/assets/ui/portraits/deepseek-model-reference.png` | 2055779 | 是 | ASSET_PROVENANCE.md记录的角色参考/立绘源图；没有当前运行入口 | 是：离线制作参考 | 是：原创参考资产 | 保留；仅不用作首屏下载，不等于可删除 | 高 |
| `public/assets/ui/portraits/deepseek-portrait-sheet.png` | 2190023 | 是 | ASSET_PROVENANCE.md记录的角色参考/立绘源图；没有当前运行入口 | 是：离线制作参考 | 是：原创参考资产 | 保留；仅不用作首屏下载，不等于可删除 | 高 |
| `public/ui/sheet-a-pulselock.png` | 2395390 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `public/ui/sheet-b-panels.png` | 2441087 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `public/ui/sheet-c-hud.png` | 2200339 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `public/ui/sheet-d-menu-result.png` | 2360797 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `public/ui/sheet-e-textures.png` | 2404049 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `public/ui/sheet-f-modern-textures.png` | 2914858 | 是 | extract-ui-sheets.py以SHEETS表拼接输入路径；README/来源记录 | 是：离线生成组件 | 是：UI源图 | 保留；不是无引用PNG | 高 |
| `src/rain-ui.css` | 16805 | 是 | main.ts不载入；此前审计明确要求历史保留 | 可手工恢复历史主题 | 是：历史样式成果 | 保留，不重新启用 | 中 |
| `src/three/map/sceneLayout.json.2026-10-11T04-32-44-529Z.bak` | 22927 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T04-33-44-561Z.bak` | 21845 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T04-38-30-844Z.bak` | 21871 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T05-02-16-862Z.bak` | 21929 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T05-05-13-287Z.bak` | 22302 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T05-18-43-933Z.bak` | 22381 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T05-23-56-299Z.bak` | 22825 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T05-34-03-961Z.bak` | 22873 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T10-19-52-802Z.bak` | 22928 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T10-24-19-337Z.bak` | 22928 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T11-48-51-833Z.bak` | 23145 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T11-52-23-423Z.bak` | 23165 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T12-03-47-668Z.bak` | 23150 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T12-05-18-033Z.bak` | 23196 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T12-09-41-638Z.bak` | 23223 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T13-10-10-999Z.bak` | 25606 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
| `src/three/map/sceneLayout.json.2026-10-11T16-17-37-206Z.bak` | 27209 | 否 | 保存版本备份；仅记录路径/字节/追踪状态，未据时间判断失效 | 是：人工恢复 | 是：场景备份 | 长期保留；不在第二轮默认删除范围 | 高 |
