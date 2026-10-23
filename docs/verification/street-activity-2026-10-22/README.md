# 街道背景行人及缓慢车流 — 2026-10-22

## 授权与范围

用户确认上一轮后，明确批准“行人走动＋缓慢车流，仅作背景，不参与碰撞/追逐/感知”。本轮新增独立StreetActivityView，保持原静态街景、开屏UI、镜头、角色资产、HUD、地图JSON、AI、声音与玩法数值不变。

- 4名低多边形路人分散在两侧人行道的4条短路线，缓慢往返，四肢轻摆、端点平滑转身。
- 2辆低多边形车辆沿主路两条相反车道行驶，远离正常画面后在道路远端循环；既有停放车辆不动。
- 不生成交通声、不参与交互拾取/家具索引、碰撞、导航或角色点选，不实现交通AI、路口转向或行人过街。
- 复用ThreeGame现有帧循环；无第二个requestAnimationFrame、监听器、计时器、新依赖或外部模型。
- 仅FACTION_SELECT/PLAYING且页面可见、有焦点、无DEV冻结/编辑器/教学时推进。READY/PAUSED/FINISHED不推进；减少动态模式保持静止。地图重建由原MapBuilder释放旧表现并创建一个新实例；重开/返回不重建这6个对象。

## 真实浏览器证据

Chrome与Edge均使用1600×900新页面验证。隔离浏览器通过拦截本地main.ts请求暴露实例，仅供测试；正式源码没有添加调试全局。

| 内容 | Chrome | Edge |
| --- | --- | --- |
| 正常开屏 | [截图](chrome-opening.png) | [截图](msedge-opening.png) |
| 街道两次实景 | [起始](chrome-street-0.png)、[2.4秒后](chrome-street-2.png) | [起始](msedge-street-0.png)、[2.4秒后](msedge-street-2.png) |
| DeepSeek开局 | [截图](chrome-DEEPSEEK-playing.png) | [截图](msedge-DEEPSEEK-playing.png) |
| Human开局 | [截图](chrome-HUMAN-playing.png) | [截图](msedge-HUMAN-playing.png) |

[Chrome真实运行录屏](chrome-street-motion.webm)：包含加载与12秒连续街道运行，约1.52MB。街道近景使用临时**检查镜头**，隐藏UI，但**保留原ThreeGame帧循环**持续驱动场景；不是改过的正式镜头，也不是静态图动画模拟。

[results.json](results.json)记录双浏览器结果；复验脚本`scripts/verify-street-activity.mjs`，使用环境中已有Playwright（可通过PLAYWRIGHT_MODULE指定入口）。

## 实际测试

| 项目 | 最终结果 |
| --- | --- |
| 动态/静态外景/表现定向 | 42/42（其中动态4项） |
| 最终npm test | 1115/1115，失败/取消/跳过0，约84.59秒 |
| npx tsc --noEmit | 通过 |
| npm run build | 通过，142模块；保留既有chunk>500kB警告 |
| git diff --check | 通过 |
| Chrome/Edge | 六对象实际移动；开屏核心UI矩形不变；双阵营READY静止→PLAYING→输入→暂停静止→继续→重开→返回菜单，合计4条流程通过，原实例UUID及6对象数量不变；无pageerror |
| 减少动态 | 两浏览器emulateMedia实际触发prefers-reduced-motion，保持静止并正常恢复 |
| 几何/生命周期 | 192秒模拟采样：路人不进主屋/建筑/绿篱，脚底不穿地面，车辆保持车道；30/60fps结果相符，大帧间隔上限生效，独立关闭/恢复不补算停用时间，10000次更新对象身份/数量不变，共享资源各释放一次 |

定向首轮发现鞋尖随腿旋转会穿入地面，已按旋转后鞋底最低点补抬升，原“不得穿地面”断言保留。两轮全量均通过，最终结果以上表为准。

## 调整与关闭

源码`src/three/StreetActivityView.ts`顶部STREET_ACTIVITY为纯视觉配置，不属于玩法平衡参数：

- enabled=true：总动态开关；false保持当前背景人物/车静止，不删除静态布景。
- pedestrians/cars=true：两组独立运动开关，各自暂停时不累计时间，恢复不跳位。
- walkSpeed=0.8单位/秒，4人附加0.91/0.97/1.03/1.09倍率，实际0.728/0.776/0.824/0.872。
- carSpeed=2.4单位/秒，两车倍率1/0.92，实际2.4/2.208。
- turnSeconds=0.9秒；maxDeltaMs=80毫秒，长时间后台后不会追赶位移。
- 四肢/身体微动及路线是同模块内视觉实现常量。地图位置读取原住宅布局与道路/人行道网格，不写回地图JSON。

## 本轮文件

- 新增`src/three/StreetActivityView.ts`：纯表现对象、往返/车道运动与生命周期。
- 修改`src/three/map/MapBuilder.ts`：随原地图构建/释放表现实例，不改碰撞、导航或家具数据。
- 修改`src/three/ThreeGame.ts`：现有tick内增加一次带可见性/阶段/冻结门禁的update；其他此前按键设置改动保留。
- 新增`tests/street-activity.test.mjs`、`scripts/verify-street-activity.mjs`和本目录证据。
- 同步`docs/DEEPSEEK_HANDOFF.md`，在`docs/AGENT_LOG.md`末尾追加记录。

## 限制与交付状态

- 真实后台切换未验证：两个无头浏览器切换另一页后仍报告hidden=false/focused=true，脚本如实记录backgroundVerified=false。代码已有门禁，单元测试覆盖active=false暂停，但不以此替代操作系统真实切后台验收。
- 未做低端设备/手机真机FPS或长期GPU内存测试；固定对象与去重释放测试不等同于真机性能保证。
- 无交通规则AI、声音或可碰撞路人，属于刻意限定的背景表现，不应当作新增玩法。
- 用户仍需确认人流密度/车速观感。未暂存/commit/push/Tag/Release/部署，不记Git Gate PASS；原未提交改动与备份保留。默认dist已更新，dist-tencent未重建。
