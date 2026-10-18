# S20 外部玩家阻断问题：只读诊断

日期：2026-10-16。状态：**S20 BLOCKED，暂停 v1.0.0 正式发布准备；S21 未启动。**

范围仅为复现、源码审查、独立浏览器会话探针与本地报告。未修改游戏源码、测试、玩法、配置、地图、36件道具、模型或音频；未构建、暂存、提交、推送、部署或创建/移动 Tag、Release。

## 1. 结论与证据级别

| 问题 | 结论 | 尚未证明的内容 |
|---|---|---|
| 慢网出现非正式角色/图片不完整 | 已复现加载门禁提前放行：20秒整体超时可在 v6 下载中进入对局；8秒音频预算又能提前结束菜单图片等待 | 未获取发生问题的外部电脑原始 HAR，不能断言该设备每次都是临时占位而不是真失败；不能把受控限速当作大陆直连测量 |
| 原 Edge WASD/方向键失效 | 用户对照确认与 Global Speed 扩展冲突：开启时失效，关闭后恢复；独立 Edge 实体键盘可移动 | 原失败配置未注入探针，具体拦截函数、事件传播阶段、held 内容及全部按键被影响的机制未直接采样 |
| v6 请求取消/解析或动画失败 | 本轮正常和慢网有效样本最终 HTTP200、模型及动画就绪，未见自然 v6 取消、解析或动画初始化异常 | 历史 ERR_ABORTED 保留，不能因本轮未见就宣称历史原因已查清；人工注入失败只是对照 |

键盘冲突不意味着 Edge 普遍不能运行游戏，也不意味着游戏已完成所有扩展兼容。关闭扩展是定位实验和临时绕行，不是已交付的源码修复。两个问题独立，键盘恢复不解除慢网阻断。

## 2. 锁定版本与复现方式

- 线上 RC：`https://yunzha-bot.github.io/who-ate-my-rice/`；历史部署提交 `e9f361fce9dd5f392e2165ec2cf0b5f1148ed108`，Run `38897897043`。
- 实际 HTTPS 读取 `index.html` 和 `assets/index-Ca4juWGy.js`，与此前下载的同一原始 CI 文件 SHA-256 一致。见 [来源核对](s20-diagnosis/live-source-identity.json)。本轮没有再次声称重做85项全量哈希；原 S19-P 的85/85结论仍是原时点事实，不等于体验验收。
- Chrome `154.0.8037.100`、Edge `151.0.4129.86`；新建独立 Playwright 上下文，显式 `page.goto()` 同一 HTTPS URL 后核对页面身份；不复用用户日常标签或读取浏览器私人配置。
- 临时探针通过 CDP 原包构造函数断点取得现有 ThreeGame 实例引用，浏览器内存内包装实际方法并调用原实现、返回原结果；不替换脚本响应，不改随机种子、位置、阶段或碰撞，不传送、不强制结算。自动化按键与实体键盘样本分别标记。
- 冷缓存使用新上下文并禁用浏览器缓存。受控慢网：延迟180ms，下行150000字节/秒（约1.2Mbps）、上行60000字节/秒。**这不是已验证的中国大陆运营商无代理出口。**
- 原探针保留在 `%TEMP%/rice-s20-diagnose.cjs`；原始结果在 `%TEMP%/rice-s20-diagnosis-ua8B4l/`。关键9份原始 JSON 按原字节复制到 [证据目录](s20-diagnosis/)，[证据索引](s20-diagnosis/evidence-index.json)记录长度、哈希、原件匹配及人工反馈来源。

实际已运行的红信号复现命令：`node "$env:TEMP/rice-s20-diagnose.cjs" edge slow --trace`。该诊断以 `playingBeforeFormalModelReady=true` 返回非零，表示捕获到提前放行，不是测试被跳过或游戏代码已修好。Chrome 相同受控条件复现。

## 3. 慢网根因与时间线

### 3.1 实际测量

以下页面时间均以导航起点为零；资源耗时是请求本身的 ResourceTiming.duration，并非把两种计时起点混用。文件大小采用十进制字节，不混淆网络编码与解码后内容。

| 条件/原始记录 | v6请求耗时 | DP菜单立绘耗时 | 加载层移除 | 进入PLAYING | 当时角色 |
|---|---:|---:|---:|---:|---|
| Chrome普通冷缓存 `chrome-normal-headless-trace.json` | 3.694秒 | 2.646秒 | 6.770秒 | 10.648秒 | 正式v6＋动画 |
| Edge普通冷缓存 Human `edge-normal-headless-trace-human.json` | 3.697秒 | 2.460秒 | 7.005秒 | 10.744秒 | 正式v6＋动画 |
| Chrome受控慢网 `chrome-slow-headless-trace.json` | 101.339秒 | 37.498秒 | 25.701秒 | 29.464秒 | 临时程序化角色，v6仍在下载 |
| Edge受控慢网 `edge-slow-headless-trace.json` | 101.269秒 | 38.329秒 | 25.528秒 | 29.499秒 | 临时程序化角色，v6仍在下载 |
| Edge只延迟v6请求35秒 `edge-delayed-model-headless.json` | 37.414秒 | 1.008秒 | 24.131秒 | 27.802秒 | 临时程序化角色 |
| Edge只延迟实际立绘35秒 `edge-delayed-portrait-headless.json` | 1.839秒 | 35.420秒 | 11.687秒 | 15.466秒 | v6已就绪，但立绘未完成 |

- v6路径：`assets/characters/deepseek/deepseek_animated_v6_hair.glb`。解码实体12,496,972字节；实测gzip编码body11,661,393字节。CDP encodedBytes还含协议开销，不冒充磁盘文件大小。
- 菜单DP立绘：`assets/ui/portraits/deepseek-normal.png`，实体2,130,874字节。慢网入局时 `complete=false`；即使渐进解码已有 `naturalWidth=1024`，也不能声称下载完成。
- 慢网两浏览器最终约105秒导航时点观察到 `external=DeepSeekGLB`、`animation=true`，没有 pageerror 或自然v6失败。首屏的程序化角色在这些样本中是**等待中的临时占位**，不是失败后永久兜底。
- 另以 `edge-model-failure-headless.json` 主动 abort v6 做真正失败对照，记录 `net::ERR_FAILED` 和 `DeepSeek visual unavailable; falling back`，最终无外部模型；这是人为故障注入，不能记为真实用户自然请求取消。
- 一次早期 `edge-delayed-image-headless.json` 延迟了未被页面使用的旧图片路径，不构成有效图片延迟实验；未纳入上述结论，原临时结果未删除。后续正确延迟实际 `deepseek-normal.png` 的样本才是有效证据。

### 3.2 第一处异常及源码路径

1. `src/three/StartupView.ts` 构造函数的20,000ms分支直接 `finish(true)`，不要求 DefaultLoadingManager pending归零或角色动画初始化完成。解除 `container.inert`，随后移除遮罩；文字“已启用安全回退”不等于加载器已经失败或真正选定兜底。
2. 同文件 `prepared()` 对音频与图片的 `Promise.all` 和音频AbortSignal做 `Promise.race`。8,000ms信号即使只剩图片未完成，也会让整体准备结束、`setupDone=true`。所以仅加大20秒无法修复8秒提前结束图片等待的问题。
3. `src/three/CharacterActionView.ts` 构造函数立即创建 HomeAvatar 并 `void this.loadVisual()`；异步下载、外部模型挂载、DeepSeekAnimation初始化没有明确就绪结果连接启动门禁。
4. `src/main.ts` 分别实例化 StartupView 和 ThreeGame，再启动 prepared；`src/three/ThreeGame.ts` 的 `chooseFaction()` 只检查对局阶段，不检查正式角色/确认降级是否就绪。
5. `src/three/DeepSeekGlbModel.ts` 的生产加载链只请求v6，校验骨骼和必需动画，失败抛出由表现层保留程序化角色。8秒仅用于音频请求；20秒只结束UI等待，**并不取消GLB请求**。这与本轮HTTP200晚完成后正常切换v6相符。

因此，确定的代码问题是“资源真实状态与启动/入局门禁脱节”；12.5MB模型和2.13MB图片放大低速网络等待。大陆GitHub Pages线路的具体瓶颈、丢包/解析失败率仍需真实外部网络证据，不能凭受控限速推断运营商原因。

## 4. Edge输入：分层事实与人工对照

### 4.1 原用户会话

用户报告计时器持续、WASD和四方向键无效，点击场景无改善；A/D显示黑色0.7/0.8数字。随后提供扩展列表截图，明确包含 Global Speed，最后确认：**“关闭扩展后就恢复了”。** 这是同一原浏览器的人工对照，足以确认本次故障与该扩展启用状态相关，不是单凭“装了扩展”归因。

[Global Speed官方项目](https://github.com/polywock/globalSpeed)说明支持视频/音频倍速和可自定义媒体快捷键；黑色数值与速度调节吻合。截图和人工反馈没有给出扩展配置导出或事件拦截调用栈，故不宣称已直接观察到其特定 capture/stopPropagation 实现，也不把0.7当作游戏AI速度倍率。

### 4.2 独立 Edge实体键盘：完整移动链

用户在新独立 Edge窗口实体操作并确认“可以移动”。[原始记录](s20-diagnosis/edge-normal-headed-trace-manual.json)捕获WASD及全部四方向键，178个采样控制移动帧均有实际位移（178/178）；此样本没有自动化游戏按键。`isTrusted=true`只作记录字段，不单独拿它证明真人输入。

首个实测 KeyD 帧：

| 链路 | 观察 |
|---|---|
| window事件/held | KeyD已进入held；焦点存在，页面未hidden |
| localDirection | `(1,0)` |
| cameraRelative / LocalControl | `(0.7071,-0.7071)`正确分配给DEEPSEEK；selected与controlled一致 |
| 阶段/阻断状态 | PLAYING；非藏身、非眩晕、无PulseLock阻断；Sprint NORMAL |
| movementDirection | 输入与输出方向一致，速度非零 |
| CollisionWorld.move | dx `0.0187029746`、dz `-0.0187029746` |
| 角色X/Z | `(11.8,-8.8)` → `(11.818703,-8.818703)` |
| 外观同步 | 外部GLB世界坐标跟随角色锚点；后续Walk动画正常 |

原始手动试验JSON的顶层 `noMovement=true` 是临时汇总器对空自动化keys数组调用 `every` 的错误判据，**不是游戏无位移结论**。原件不回改；证据索引明确标记该字段无效并按原始178帧计算。手动试验起初未操作时自然被抓，用户随后重开再移动，不能误将先前FINISHED时间段当作输入故障。

### 4.3 三种故障类型如何区分

| 类型 | 判别事实 | 本轮情况 |
|---|---|---|
| 键盘未进入游戏输入链 | 实体操作存在，但游戏window/held没有对应记录 | 原失败配置没探针；扩展开启/关闭对照支持输入入口冲突，具体丢失层不能冒称已直接采到 |
| 收到按键但状态禁止 | held非空、localDirection非零，但阶段/藏身/眩晕等阻断 | 独立实体样本和正常/慢网自动样本未复现错误阻断；失焦按既有规则暂停是预期 |
| 计算位移但位置或外观不变 | direction、dx/dz非零，检查碰撞前后及GLB世界坐标 | 实体178帧都发生合法位置变化，外观跟随；无该类故障证据 |

Chrome/Edge正常与慢网自动控制样本的WASD及ArrowUp均移动，额外Human样本也验证实际主控映射。它们排除所测环境的普遍移动链故障，**不代替原浏览器实体对照**。没有证据支持当前重写InputManager、碰撞或AI。网页也不能保证绕过扩展更早的事件拦截，是否有安全兼容改进需单独验证，不能承诺加capture或preventDefault即可解决所有扩展。

## 5. 最小修复提案（未实施，等待批准）

### 必须处理的加载体验

- `StartupView.ts`：分离可选音频预算和关键图片/角色就绪，音频8秒超时不得结束图片等待；20秒只转成真实“仍在加载/较慢”状态，不无条件冒称安全回退完成。不单纯扩大超时。
- `CharacterActionView.ts`（必要时 `DeepSeekGlbModel.ts`）：提供下载中、模型挂载/动画初始化就绪、明确失败且程序化兜底可用的只读状态或Promise。以实际解析/初始化结果判定，不以LoadingManager请求完成替代动画ready。保留既有生产仅v6/程序化兜底和DEV旧链。
- `main.ts` / `ThreeGame.ts`：最小连接启动状态和入局检查。推荐允许查看菜单但未就绪时不能误入正式对局；真实失败时明确说明并允许重试/确认使用现有程序化兜底。具体提示与是否主动选择降级需用户批准，不静默改UI流程。
- 进度只显示真实字节或阶段；若无法可靠取得总长，不伪造百分比。失败和重试需要有限可取消流程，不无限自动重试，不关闭兜底。
- 本轮不建议凭此立即压缩/替换模型、迁移地图、改音频系统或更换部署平台。若真实大陆线路持续不能承载该资源，需要用户另行决定托管/CDN，但不把换平台当作当前已批准操作。

### 输入冲突

- 临时措施：在该游戏站点避免Global Speed相关快捷键/站点注入，或只在游玩时关闭扩展；不要求卸载、重置浏览器、关闭其他扩展。
- 暂不修改移动/键位或抢占全页面按键。若用户仍希望代码兼容，先在独立安装该扩展的测试配置中复现实际拦截，再评估有界的焦点/事件监听调整及菜单可访问性；不得承诺任意扩展均可兼容。

### 批准修复后回归与重新部署准入

1. 先建立真实ready链回归：音频拒绝/超时但图片未完成；GLB慢于20秒；请求200但解析失败；动画初始化失败；明确兜底；晚完成/重试/释放；双阵营入局门禁。不删除或弱化已有断言。
2. Chrome/Edge冷缓存正常及受控慢网，记录下载/解析/动画时间、图片完成状态和READY/PLAYING；下载中不再误报完整模型或失败，真实失败仍可安全兜底，生产无旧GLB请求。
3. 原失效Edge实体键盘对照复验，记录扩展及站点快捷键状态；正常输入、失焦暂停/恢复、菜单、方向键和投掷不回归。自动化键盘不冒充真人复验。
4. 全量 `npm test`、独立 `npx tsc --noEmit`、根路径和Pages生产构建、产物/保护哈希/diff检查；再向用户申请精确提交/推送/新RC部署授权。
5. 部署后以新SHA/Run/Artifact重新核验，不复用旧85/85；真实外部电脑无代理冷缓存访问、双浏览器操作、至少一局自然完整结算及刷新/重开。记录城市级地点、运营商、加载耗时/状态和脱敏日志，不索取账号等私人数据。
6. 外部体验和资源加载通过、用户批准正式发布操作之前，S20继续BLOCKED，原RC保留；不自动进入S21或创建v1.0.0。

## 6. 本轮检查与边界

- 定向现有测试：`node --experimental-strip-types --test tests/browser-focus.test.mjs tests/camera-controls.test.mjs tests/collision-world.test.mjs tests/production-model-policy.test.mjs`，**48/48通过，失败/跳过/取消0**。没有新增或改写测试。
- 本轮未重跑全量npm test、TypeScript或build：仅只读诊断/文档，源码不改，不重建/扰动既有4173预览；不把历史963测试称作本轮全量结果。
- 实际完成核对：开工336项源文件/测试/脚本/配置/资源哈希全部不变、AGENT_LOG原字节前缀保持，9份复制证据与临时原件逐字节一致。`git diff --check`通过；新报告另查行尾空白通过。main的HEAD、origin/main及只读ls-remote均仍为上述历史RC提交，暂存区为空；5173/4173仍由原进程43996/38588监听。
- 只有报告、证据复制、交接与追加日志变动；开工已有未提交文档、未跟踪验证资料及备份保护。浏览器探针只存在本轮独立会话，未写入生产包；未操作日常浏览器设置，扩展对照由用户自行完成。
- 当前不足：无发生问题外部设备的HAR/Console/GLB失败栈；没有证明大陆运营商无代理实测；没有对原扩展拦截阶段采样。favicon404、Three.js弃用警告及历史v6取消分开保留，不冒称是两项问题根因。

本次诊断完成后停止。下一步只能在用户批准后实施上述最小加载修复，不能把本报告建议当成实现或发布授权。
