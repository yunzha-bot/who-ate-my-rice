# DEV 场景热编辑器 V1 + 双阵营调试冻结（设计文档）

> 状态：**已实现，用户浏览器人工验收 PASS（2026-09-26，五项：入口可点 / READY 倒计时与双方行动 / 手动冻结·恢复与编辑器自动冻结 / 8 个藏身点列表选择与遮挡点聚焦 / 2 个纸箱通行与家具编辑后碰撞同步）、阶段 Gate = PASS**。已并入稳定检查点 `3191bec843606ae4bab01d6932cff0ac87955101`（`feat: complete s7c-1a hide spots and dev scene editor v1`，24 个文件，+3976/−71）并推送 `origin/main`（`HEAD == origin/main`，未创建 Tag）。本轮为独立 DEV 工具任务，**不接入任何藏身玩法**：没有 `HideSystem`、没有进入 / 退出藏身键、没有 `VisionSystem` 改动、没有 Human `CHECK_HIDE`、没有地图随机化、没有改 `GAME_CONFIG`、没有进入 S7C-1B。
>
> **V2 布局持久化（2026-09-27 用户一次性授权）：已实现，用户集中浏览器人工验收 9/9 PASS（2026-09-27），见下文 §11。** V1 的行为（入口位置、面板结构、家具编辑与拖拽、冻结语义）均未改动。

## 1. 目标与边界

两个可独立使用、也能正确协同的 DEV 功能：

- **A. 场景热编辑器**：右上角「场景编辑」入口；点击家具 / 纸箱 / 藏身锚点即可选中；改位置、朝向、合法白模尺寸与锚点 `facing`；支持对象列表选择、参数输入、校验、差异预览与 JSON 导出。
- **B. 双阵营调试冻结**：DEV 调控台新增「冻结双阵营 / 恢复双阵营」按钮；冻结期间两个阵营都不再行动，DEV 面板与编辑器仍可操作。

明确不做（本轮）：正式的家具美术、Human AI 检查、随机布局、撤销 / 重做（需要较大架构调整）、直接把编辑结果写回 `apartmentMap.ts`、UE 导入脚本。

## 2. 冻结架构

### 2.1 单一时间缝

`DevFreezeSystem.gameplayDelta(phase, deltaMs)` 是**唯一**的冻结实现点：

| 条件 | 返回 |
|---|---|
| 任一冻结原因存在 | `0` |
| `phase !== 'PLAYING'`（READY / PAUSED / FINISHED / FACTION_SELECT） | `0` |
| 正常运行 | `deltaMs` |

`ThreeGame.tick()` 只做 `if (gameplayMs > 0) this.updatePlaying(gameplayMs)`。因此**所有**以 `dt` 推进的计时（米堆、抓捕、冲刺与 30 秒冷却、门技能冷却、Human 静止、声音、米痕、Last Seen、AI 状态机、`mineFailureRemainingMs`、对局时间）同时冻结，而 `clock.getDelta()` 仍然每帧被读取，所以**恢复后不会累积一大段 delta**。项目内已核查：全部玩法时间都来自 `dt`，源码中只有两处墙钟（`AILogCollector` 的导出时间戳、日志文件名），与冻结无关。

冻结**不是**暂停：暂停是 `GamePhase = 'PAUSED'`（Esc 菜单），冻结是 DEV 状态机，两者正交。冻结期间 `input.clear()` 每帧执行：按键缓冲不会在恢复后重放；角色位置 / 朝向、米堆进度、门与锁芯、技能冷却全部保持。

### 2.2 冻结原因（可叠加）

| 原因 | 触发 | 解除 |
|---|---|---|
| `MANUAL_DEV_FREEZE` | DEV 面板「冻结双阵营」 | 「恢复双阵营」 |
| `SCENE_EDITOR` | 打开场景编辑（自动冻结） | 关闭场景编辑 |

- 只有**所有**原因都解除才回到 `RUNNING`；关闭编辑器不会无条件 `frozen = false`（先手动冻结、再开编辑、再关编辑 ⇒ 仍然冻结）。
- 编辑期间点「恢复双阵营」⇒ **拒绝**并提示 `SCENE_EDITOR_ACTIVE：场景编辑器开着，先关闭场景编辑再恢复双阵营`，DEV 工具栏状态栏直接显示该原因。
- 冻结 / 恢复只在 `PLAYING` 可用；FINISHED 的对局不会被冻结按钮复活；`resetRound()`（重开 / 返回阵营选择）清空全部原因、事件与计数。

### 2.3 DEV 事件（不允许每帧刷屏）

`DEV_FREEZE_ON`、`DEV_FREEZE_OFF`、`SCENE_EDITOR_OPEN`、`SCENE_EDITOR_CLOSE`（`DevFreezeSystem`）与 `SCENE_OBJECT_EDIT_APPLY`、`SCENE_OBJECT_EDIT_REJECT`（`MapEditSession`）。事件只在**状态真正变化**时写入（测试用 600 帧空转验证计数不变），历史保留最近 40 条。

冻结期间 `updatePlaying` 整体不执行，因此 `AILogCollector` 不记录任何帧：普通对局 AI JSON 不会出现由调试冻结造成的“卡路 / 追逐失败 / 计时异常”。DEV 分类也不把冻结写成 AI 的 `NO_MOVEMENT`。

## 3. 数据与校验（`src/three/map/MapEditModel.ts`）

三层数据严格分离：

1. **原始地图数据**：`apartmentMap.ts` 的 `FURNITURE` / `HIDE_SPOTS`（本轮**从未被修改**，有测试断言深比较）。
2. **内存草稿**：`MapEditSession` 的 draft（拖动、输入只改草稿，可视化只是预览）。
3. **已应用数据**：`apply()` 通过全部校验后提交的 committed 数据，是碰撞 / 导航重建与 JSON 导出的唯一来源。

可编辑对象 48 个：40 件家具（含 `living_carton` / `storage_carton` 纸箱）+ 8 个藏身锚点。**只读**：`id`、`editKind`、`kind`、`roomId`、`furnitureId`、`label`。不可编辑：承重墙、门、米堆、出生点、房间拓扑（不在可编辑对象列表里）。

> 2026-10-03 东翼扩建把家具从 20 件加到 32 件（房间 12 → 18、门 18 → 31），可编辑对象由 28 个变为 40 个。编辑器行为、拒绝码与存档格式都没有改变；`MapEditSession` 始终从授权地图数据构建列表，因此新增家具自动进入可编辑集合。
>
> 2026-10-04 区域级放大把世界盒从 `48×30` 改为 `56×38`、家具从 32 件加到 40 件（房间仍 18、门仍 31），可编辑对象由 40 个变为 **48 个**。同样没有改编辑器行为、拒绝码或存档格式。编辑器内部的导航格心与校验网格全部由 `MAP_WIDTH` / `MAP_DEPTH` 推导，所以世界盒变化不需要另写常量；旧存档会因「是否同一张地图」核对失败而**明确拒绝并安全回退到授权地图**，这是预期行为。

家具可编辑字段：`x`、`z`、`rotationQuarter`（只支持 0/90/180/270°）、`width`、`depth`、`height`；锚点可编辑：`x`、`z`、`facing`。

### 3.1 校验规则与拒绝码

| 拒绝码 | 规则 |
|---|---|
| `ROOM_BOUNDARY` | 家具 AABB 必须留在其所属房间内（留 0.01 余量）；锚点必须留在所属房间内 |
| `SIZE_OUT_OF_RANGE` | 宽 / 深 0.2–4.0，高 0.1–1.6 |
| `NOT_QUARTER_TURN` | 家具朝向只接受 90° 整数倍（AABB 碰撞模型的要求） |
| `BLOCKS_DOOR` | 不得覆盖门段（含门叶厚度 + 角色半径），也不得堵住门前 ± 1 个角色直径的通道 |
| `COVERS_RICE` | 不得压住任何米点（判定与 `tests/apartment-map.test.mjs` 的 `free()` 一致） |
| `SPAWN_BLOCKED` | 不得压住任一出生点 |
| `ROOM_UNREACHABLE` | 0.3 网格洪水填充（从 DeepSeek 出生点）后：每个房间仍有可达内部、所有米点 / 出生点 / 门与门前点仍可站立且可达 |
| `ANCHOR_INSIDE_OBSTACLE` | 锚点必须能被真实 `CollisionWorld.canOccupyStaticXZ` 站住，距任何墙 / 家具盒 ≥ 0.05，且不落进所属家具内部 |
| `ANCHOR_DETACHED` | 锚点距所属家具 AABB ≤ 0.9（超过即视为与家具脱离） |
| `OVERLAPS_FURNITURE` | 任意两件家具的碰撞盒不得重叠 |
| `INVALID_VALUE` / `READ_ONLY_FIELD` / `NOT_FOUND` | 字段级保护（NaN、只读字段、未知 ID） |

**拒绝即回滚**：`apply()` 失败时草稿整体回滚到上一次合法状态并记录 `SCENE_OBJECT_EDIT_REJECT`，已应用地图绝不被污染；拖动被拒绝时只回滚该对象。

编辑器常量（`EDIT_LIMITS`）刻意**不放进 `GAME_CONFIG`**：它们是灰盒地图的创作约束，不是可调玩法数值（有测试断言 `GAME_CONFIG` 不含 `sceneEditor` / `hide`）。

## 4. 热编辑后的碰撞与导航同步

“拖动预览 → 校验 → 提交时安全重建”：

1. 拖动 / 输入只写草稿；可视 mesh 按草稿做预览（位置、缩放、90° 旋转；锚点移动 gizmo）。
2. 点「应用编辑」→ `MapEditSession.apply()` 全量校验（对原始地图校验耗时实测约 27 ms）。
3. 通过后 `ThreeGame.rebuildApartment()`：
   - `ApartmentBuild.dispose()` 移除并释放旧的地板 / 墙 / 家具 / 标记 / 锚点 gizmo；
   - 用**已应用数据**重新 `buildApartment()`（`FURNITURE` / `HIDE_SPOTS` 不再从模块常量读取，而是用传入的已编辑列表；`DEBUG_MAP` 的藏身点精灵也随之跟随）；
   - 新建 `CollisionWorld`（静态盒来自新 mesh 的 `Box3`）与 `NavigationSystem`；
   - `humanAI.rebindNavigation()` / `deepseekAI.rebindNavigation()` 换网格、清空缓存路径、置 `lastNavigationReason = 'MAP_REBUILT'`（不重置 AI 的其他状态）；
   - `syncAllDoors()` 把门的动态碰撞盒重新登记到新世界。
4. 非法编辑：`apply()` 拒绝并回滚 + 重建（恢复上一个合法状态）；拖动非法时同样回滚并着色为红色。
5. 关闭编辑器：草稿整体丢弃、网格恢复到已应用地图（“不保留非法编辑预览”），已应用的合法内存编辑继续有效。

## 5. 编辑模式交互（`SceneEditorView` / `SceneEditorPanel` / `SceneEditor`）

- 入口：页面右上角「场景编辑」按钮，仅在 `import.meta.env.DEV && GAME_CONFIG.development.factionSwitchEnabled` 时出现（`sceneEditorEnabled()`，有测试）。
- 打开：自动冻结（`SCENE_EDITOR`）；画布光标变为十字；普通移动 / 冲刺 / 门 / 进食输入都不再驱动游戏（`updatePlaying` 不执行）；鼠标本来就未被锁定，因此直接用于场景选择。
- 选择：真实 `THREE.Raycaster` 打家具 mesh / 锚点 gizmo；锚点另有一个 `opacity: 0` 但可拾取的圆柱体命中体，**被墙、家具或文字标签遮挡的锚点也能从右侧列表选中**（列表含全部 20 + 8 项，可搜索 ID / 类型 / 房间）。
- 定位标记：地面圆环 + 中心点 + 竖直定位线，选中时放大高亮；「锚点标记」开关可整体显隐；列表双击 / 「聚焦镜头」按钮把镜头移到该对象（编辑器内支持滚轮缩放与右键 / 中键拖动平移，退出编辑器自动复位）。
- 属性面板：数值输入（x/z/尺寸/facing）+ 朝向下拉（0/90/180/270°）；显示稳定 ID、房间、`furnitureId`、只读提示；「恢复初始值」；差异预览（`field from → to`）；最近拒绝原因；草稿合法性（`UNCHANGED / VALID / INVALID`）。
- 生产构建不显示入口按钮，也不展示任何编辑器数据。

## 6. JSON 导出

`exportJson()` 只导出**已应用**数据（未应用草稿与被拒绝的编辑不会出现）：

```jsonc
{
  "format": "who-ate-my-rice/apartment-map",
  "formatVersion": 1,
  "units": { "length": "world-unit", "angle": "radian", "rotation": "degree",
             "groundPlane": "XZ", "up": "Y" },
  "map": { "width": 36, "depth": 30 },
  "appliedEditCount": 0,
  "rooms": [ { "id": "living", "name": "客厅", "bounds": { ... } } ],
  "doors": [ { "id": "door_living_dining", "position": {...}, "width": 1.2,
               "rotationRad": 1.5707963267948966, "connects": ["living", "dining"] } ],
  "spawns": [ { "id": "deepseek_spawn", "roomId": "entry", "x": 6.2, "z": 9.7 } ],
  "riceCandidates": [ { "id": "rice_01", "roomId": "balcony", "x": 6.8, "z": -13.1 } ],
  "furniture": [ { "id": "main_bed", "kind": "furniture", "roomId": "main_bedroom",
                   "position": { "x": -13, "z": -5 }, "rotationDeg": 0,
                   "size": { "width": 2.1, "depth": 2.3, "height": 0.45 },
                   "collisionAabb": { "width": 2.1, "depth": 2.3 } } ],
  "hideSpots": [ { "id": "hide_main_bed", "kind": "BED", "roomId": "main_bedroom",
                   "furnitureId": "main_bed", "label": "主卧床",
                   "anchor": { "x": -14.4, "z": -6.15 },
                   "facing": 0.6877, "facingDeg": 39.4 } ]
}
```

- `rotationDeg` 是创作值，`collisionAabb` 是实际参与 AABB 碰撞的地面尺寸（90°/270° 时宽深互换），未来 UE 导入可直接按角度旋转静态网格。
- `rooms` / `doors` / `spawns` / `riceCandidates` 只作稳定空间参考，本轮不可编辑。
- 导出通过浏览器下载 `who-ate-my-rice-map-<时间戳>.json`；**不写回 `apartmentMap.ts`**。

## 7. 测试

| 文件 | 项数 | 覆盖 |
|---|---|---|
| `tests/dev-freeze.test.mjs` | 13 | 初始状态；只在 PLAYING 可冻结 / 恢复；原因叠加与“先手动再编辑”的关闭保护；编辑期间拒绝恢复；FINISHED 不被复活；重开清空；`gameplayDelta` 表格；**用真实系统（`GameStateSystem` / `SprintSystem` / `RiceField` / `HumanDoorSkill` + `DoorSystem`）搭的帧循环 harness**：冻结时对局时间 / 抓捕进度 / 米进度 / 冲刺状态与冷却 / 破锁冷却 / 门状态 / 结算全部不变，恢复后只前进一个 `dt` 且不跳跃；**`readyDelta` 永不被冻结门控 + READY→PLAYING 回归（含用 `gameplayDelta` 复现“永远卡在 READY”的反例）** |
| `tests/scene-editor.test.mjs` | 15 | 28 个对象与只读字段；原始地图零拒绝；合法移动后真实碰撞与导航同步（新位置不可站、导航不再给出该格）；合法缩放后旧位置恢复可走；90° 旋转的 AABB 互换；字段级保护；拒绝回滚不污染已应用地图；门 / 米 / 出生点 / 连通性 / 锚点四条规则各自触发；重叠拒绝；恢复初始值；导出字段与只应用数据；原始模块数据未被改；DEV 开关与常量位置；**拒绝必须产出含当前 phase 的可见原因文字** |

另更新 `tests/debug-details-panel.test.mjs`（新增 `dev-freeze` 分类）。

## 8. 已知限制与后续优化建议

- **家具朝向只支持 90° 整数倍**：自由旋转需要 OBB 碰撞与导航重建，属于架构级改动，本轮不做（面板已明确提示）。
- **拖动中不做逐帧校验**（一次全量校验约 27 ms），拖动结束才校验并着色；数量级更大的地图需要增量校验。
- **尺寸 / 朝向的预览用缩放 + 90° 旋转近似**，真正的几何重建只发生在「应用编辑」。
- **无撤销 / 重做**：仅提供单对象恢复初始值与整体放弃草稿（用户已同意需要大改时先汇报）。
- **编辑只能在 PLAYING 打开**（要冻结双阵营）；FACTION_SELECT 下的纯地图编辑未支持。
- **已应用编辑只存在于内存**，重开 / 刷新会回到 `apartmentMap.ts` 的原始数据；要固化需人工按导出的 JSON 改源码（这是刻意的：不提供浏览器直接改源码）。
- **镜头**：编辑器提供聚焦 / 缩放 / 平移，但仍是固定偏移的等距相机，没有完全自由的轨道相机。
- 后续可做：撤销栈、按房间筛选与吸附网格、把导出 JSON 变成正式的 `map.json` 数据源（与 S7C-3 随机化一起考虑）、UE 导入脚本（本轮明确不做）。
- **（2026-09-25 修复轮记录）窗口很矮时的布局密度**：实测 762×484 视口（面板可用高 428）下对象列表与属性区会互相挤压，属性区只剩约 58px、需要内部滚动才能点到输入框；桌面常规高度（1440×900）下列表 / 数值输入 / 朝向下拉 / 应用按钮 / 搜索框 / 锚点开关 / 状态块全部可直接命中。后续可考虑按视口高度折叠状态块或把属性区改成两栏。

## 9. 浏览器人工验收步骤（G 节）

> **本节步骤已于 2026-09-26 由用户全部验收 PASS**（五项结果见文件顶部状态行），下列步骤保留为**回归复核清单**：后续任何触及 DEV 面板、冻结、场景编辑器或地图热重建的改动，都应重新走一遍关键条目（0、3、4、9、10）。

0. **（2026-09-25 FAIL 修复后新增）** 打开页面并选阵营：右上角应同时看到 `DEV ▾` 与它左侧的「场景编辑」按钮，两者不重叠；点 `DEV ▾` 必须能展开 DEV 面板，面板里能看到原有全部按钮与「冻结双阵营」+ `RUNNING`。若在**还没进入对局**时点「场景编辑」，应看到「场景编辑需要先进入对局（当前 READY）」提示，而不是按钮毫无反应。
1. `npm run dev` → 打开 `http://127.0.0.1:5173/`（根目录 `vite.config.ts` 固定 host / port / `strictPort`）。
2. 选阵营并进入对局；展开右上角 DEV 面板，确认工具栏出现「冻结双阵营」与 `RUNNING`。
3. 点「冻结双阵营」→ 按钮变「恢复双阵营」、状态变 `FROZEN｜MANUAL_DEV_FREEZE`；观察对局时间与米堆进度不再变化；按 WASD / IJKL 角色都不动；Esc 仍能打开暂停菜单；再点一次恢复，确认角色从原状态继续、没有瞬移或计时跳跃。
4. 点右上角「场景编辑」→ 右侧编辑器打开、`FROZEN｜SCENE_EDITOR`；此时点 DEV 面板的「恢复双阵营」应被拒绝并提示需要先退出场景编辑。
5. 列表里点 `living_carton`（或直接点场景里的纸箱）→ 高亮出现；用滑块 / 输入框改 X/Z，观察场景实时预览与「未应用改动」提示；点「应用编辑」确认预览被固化、无报错。
6. 故意把某件家具拖出房间 / 塞进门洞 / 压到米点 → 应被拒绝、显示红色与具体原因，场景回到上一个合法状态。
7. 点「锚点标记」开关确认 8 个锚点 gizmo 显隐；列表里选一个被家具 / 标签挡住的锚点（如 `hide_main_wardrobe`）→ 高亮 + 「聚焦镜头」应能定位；改 `facing` 并应用。
8. 点「导出地图 JSON」，确认文件含 `format / formatVersion / units / map / rooms / doors / spawns / riceCandidates / furniture（含 rotationDeg、collisionAabb）/ hideSpots（含 anchor、facing、facingDeg）`。
9. 关闭场景编辑（×）：编辑器数据消失、镜头复位、若之前没有手动冻结则双方恢复行动；若之前手动冻结过则**仍然冻结**，需要再点「恢复双阵营」。
10. Esc → 重新开始：确认冻结状态、编辑器状态与缩放都被清空，DEV 面板回到 `RUNNING`。

## 9.5 修复记录（2026-09-25 浏览器验收 FAIL）

用户浏览器验收 FAIL：原 DEV 调控台「消失」、右上角只剩「场景编辑」、点击无反应、找不到「冻结双阵营」、玩家与 AI 都不能行动。三个阻断问题与修复：

| 故障 | 真正原因 | 修复 |
| --- | --- | --- |
| DEV 调控台与其中按钮「消失」 | 入口写成绝对定位 `.dev-launcher (top:10 right:10 z-index:6)`，与 `.debug-panel (top:10 right:10 z-index:4)` 的 `DEV ▾` 开关完全重叠（实测 62px vs 68px，`elementFromPoint` 返回 `scene-editor-launch`），唯一的展开开关被盖住且点不到；面板与原有按钮其实都在 | `DebugDetailsPanel.topRow` 新增 `.debug-top-row` 行，入口按钮 `prepend` 进该行成为 flex 项，删除 `.dev-launcher` 规则 |
| 点「场景编辑」没有反应 | 对局卡在 READY（见下条），`openSceneEditor` 因 `NOT_PLAYING` 被拒，而拒绝原因只写进未打开的面板 | 新增纯函数 `sceneEditorRefusalNotice(phase, rejection)` + `.scene-editor-notice`（同排提示，8 秒自动隐藏），拒绝必须可见 |
| 玩家与 AI 都不能行动 | `tick()` 的 READY 分支被误喂 `gameplayDelta`（`phase !== 'PLAYING'` 时恒为 0）→ `advanceReady(0)` 永不推进 → 永远到不了 PLAYING | 新增 `DevFreezeSystem.readyDelta(deltaMs)`：READY 是阶段计时器、不受冻结门控；`tick()` 的 READY 分支改用它，PLAYING 仍用 `gameplayDelta` |

同轮顺带修复：DEV 工具栏「冻结双阵营」按钮与状态文字合成 `.details-freeze-row` 一行、工具栏状态里的拒绝原因加「最近拒绝：」前缀、`.scene-editor-detail`（`flex:1 1 auto; min-height:0`）与 `.scene-editor-list`（`flex:0 1 auto; min-height:72px`）的收缩使矮窗口可内部滚动、三个编辑器模块的 import 补 `.ts` 扩展名、`style.css` 两行二次编码中文注释改为 ASCII。

新增回归测试：`readyDelta` 永不被门控、**READY→PLAYING 回归（含用 `gameplayDelta` 复现卡死的反例）**、拒绝原因文字必须可见。

## 10. 相关文件

- 新增：`src/systems/DevFreezeSystem.ts`、`src/three/map/MapEditModel.ts`、`src/three/SceneEditorView.ts`、`src/three/SceneEditorPanel.ts`、`src/three/SceneEditor.ts`、`tests/dev-freeze.test.mjs`、`tests/scene-editor.test.mjs`、本文件。
- 修改：`src/three/ThreeGame.ts`、`src/three/DebugDetailsPanel.ts`、`src/three/map/MapBuilder.ts`、`src/three/map/apartmentMap.ts`（`hideSpotDebugMarkers` 增加可选锚点列表参数）、`src/systems/HumanAIController.ts`、`src/systems/DeepSeekAIController.ts`、`src/style.css`、`tests/debug-details-panel.test.mjs`、`docs/MAP_SPEC.md`、`docs/AGENT_LOG.md`。
- **未改**：`src/config/gameConfig.ts`（无任何新数值）、门 / 锁 / 冲刺 / 米堆 / 抓捕 / 感知规则、`VisionSystem`、Human AI 决策、S7B-3A/3B 的关门锁门逻辑。

---

## 11. V2：布局保存、恢复与 JSON 导入（2026-09-27 一次性授权，**已实现，用户集中浏览器人工验收 9/9 PASS，已归档**）

### 11.1 用户授权的范围（原话要点）

「玩家在 DEV 场景编辑器中调整家具位置、旋转和交互区域后，可以保留修改。重开对局不恢复默认家具布局；刷新或重新打开网页后，可加载已保存的自定义布局。」——因此本轮做了七件事：① 应用布局后当前会话内重开 / 返回阵营 / 开新局都保留；② `localStorage` 保存 + 保存成功 / 失败 / 未保存状态；③ 刷新后经版本与完整校验自动恢复，无记录则用默认地图；④「导入 JSON」兼容 V3 导出格式且严格校验；⑤ 保留导出并保证往返一致；⑥「恢复默认地图」带确认、**不得静默删除已有本地保存与导出备份**；⑦ 清晰的布局状态（默认 / 自定义 / 未保存 / 已保存 / 导入失败）。

**保存范围**：家具（位置 / 旋转 / 白模尺寸）与藏身锚点（位置 / facing / 交互区域）。**绝不写入**：每局随机出生结果、18 扇门的随机初态、角色位置、AI 路径、米进度、技能冷却与对局时间。S7C-3 仍以当前合法地图为基础、每局独立随机。

### 11.2 存档结构与 key

`localStorage` key：`who-ate-my-rice/scene-editor-layout`；信封 `{ format: 'who-ate-my-rice/scene-layout', layoutVersion: 1, savedAt, document }`，其中 `document` 就是 §6 的 V3 导出文档（`formatVersion = 3`）。导入同时接受**裸 V3 文档**（导出的 `.json`）与**完整信封**（本地存档文件）。

### 11.3 校验：一条权威链路

| 层 | 内容 | 代码 |
|---|---|---|
| 结构 | `format` / `formatVersion` / 六个数组 / 所有位置·旋转·尺寸·锚点·facing·区域半径为有限数值；扇形必须有半角 | `parseLayoutDocument()` |
| 稳定 ID | 家具与藏身点的 ID 集合必须与当前地图完全一致（缺失 / 多余 / 重复都拒绝） | 同上 |
| 只读字段 | 家具 `roomId`（由几何推导）、藏身点 `roomId` / `kind` / `label` / `furnitureId` 不得被改写；`rooms` / `doors` / `spawns` / `riceCandidates` 必须与授权地图逐字段一致（来自另一张地图或另一版本的文档一律拒绝） | 同上 |
| 几何与玩法 | 房间边界、家具重叠（真实 SAT）、门洞、米点、出生点、藏身锚点可站立与可接近、区域合法性与采样、连通性 —— **直接复用 `validateEditedMap()`** | `layoutRejections()` → `validateEditedMap()` |

任何一层失败都只返回原因码与文字，**当前地图、碰撞、导航、AI 与藏身状态一字不动**；失败原因同时写进面板状态块与 DEV 读数。

### 11.4 五态与「未保存修改」

| 状态 | 判定 | 含义 |
|---|---|---|
| `DEFAULT` | 当前布局＝授权地图，且没有本地存档 | 默认布局 |
| `CUSTOM` | 当前布局是自定义的，且从未保存 | 自定义布局（尚未保存） |
| `SAVED` | 存在本地存档，且当前布局与它逐字段一致 | 已保存 |
| `UNSAVED` | 存在本地存档，但当前布局与它不同 | 未保存修改（与存档不同） |
| `IMPORT_FAILED` | 最近一次导入 / 恢复失败（优先显示） | 导入失败 |

`layoutSignature()` 只对可编辑部分（家具位置 / 旋转 / 尺寸 + 锚点 / facing / 区域）做 4 位小数的稳定摘要，因此状态判定不会受浮点尾差或 `appliedEditCount` 影响。

### 11.5 界面（不新增覆盖入口的按钮）

在既有工具栏内追加三个按钮（`flex-wrap` 行内，不引入绝对定位覆盖层）：**保存布局**、**导入 JSON**（隐藏的 `<input type="file" accept=".json,application/json">`）、**恢复默认地图**（`window.confirm` 先确认）。工具栏下方新增一行 `.scene-editor-layout`，带 `data-layout-state` / `data-layout-unsaved`，浏览器复核与人工验收可直接读取。DEV 面板的编辑器状态块同步新增「布局状态 / 本地布局存档 / 未保存修改 / 最近导入·恢复失败」四行。

- 保存的是**已应用**布局；有未应用草稿时先拒绝并提示「先点应用编辑」，绝不把半成品写进存档。
- `writeSavedLayout()` 只在 `setItem` 真正成功后返回成功；`localStorage` 不可用或被拒时如实报失败，不虚报。
- 「恢复默认地图」只把地图换回授权数据，**不删除**本地存档，也不动已导出的 JSON 文件。

### 11.6 生效路径

- **开机**：先读本地存档 → 结构 / ID / 只读 / 几何全部通过才用 `buildApartment(..., { furniture, hideSpots })` 建成公寓；失败或没有存档则用授权地图，失败原因留给 DEV 面板（**不会白屏**）。
- **刷新**：走同一条开机路径，因此刷新前最后一次成功保存的布局会被自动恢复。
- **重开 / 返回阵营 / 开新局**：`resetRound()` 不重建公寓、不重置 `mapFurniture` / `hideSpots`，只重掷 S7C-3 的出生点与门初态，因此已应用布局（含未保存的）继续有效；`tests/scene-editor-layout.test.mjs` 用源码不变量守住这一点。
- **导入 / 恢复默认**：走与「应用编辑」同一条安全链路 —— 先跑 S7C-1B 地图预检（两个角色站位 + 藏身出口可站立），再 `replaceSource()` 换源，再 `rebuildApartment()` 重建碰撞 / 导航 / 两套 AI 绑定。预检或校验失败时旧地图与旧藏身状态原样保留。

### 11.7 测试

| 文件 | 项数 | 覆盖 |
|---|---|---|
| `tests/scene-editor-layout.test.mjs` | 21 | 保存→读取往返；导出文档可直接导入（往返一致）；信封可导入；`localStorage` 不可用 / 写入被拒不虚报；损坏存档（非 JSON / 缺信封 / 版本不符 / 格式不符）；结构非法（缺数组、非有限数值、缺半角）；稳定 ID 缺失 / 重复 / 多余；只读字段（房间·类型·名称·关联家具·家具 roomId）不可改写；来自另一张地图的文档被拒（房间 / 门 / 出生点 / 米点四种，含少一项）；几何合法性**复用 `validateEditedMap`**（越界 / 重叠 → `LAYOUT_REJECTED`，并与直接调用校验器的结论逐条相等）；藏身区域越界被拒；导入后地图源只替换家具与锚点、保留授权参考；S7C-3 随机化仍以当前合法地图为基础且换种子即不同、同种子可复现、存档里没有 `doorStates` / `seed`；重开与关闭编辑器不重建 / 不重置地图（源码不变量）；编辑器确实接上三条入口（源码级守卫）；换源后草稿不残留；五态判定；签名对每个可编辑字段敏感；解析不改写传入对象与授权模块数据；无 `localStorage` 时 `browserLayoutStorage()` 返回 null |

### 11.8 浏览器复核

`docs/verification/DEV_SCENE_EDITOR_V2/`（脚本 + 日志 + 结构化摘要 + 9 张关键截图）：默认 → 应用（CUSTOM）→ 保存（SAVED）→ **刷新后恢复 1.4** → 非法 JSON（IMPORT_FAILED，地图不变）→ 另一张地图的文档（IMPORT_FAILED）→ 合法导入（UNSAVED，1.6）→ 恢复默认（确认 1 次，回 2.2，**存档保留**）→ **「重新开始」后仍保留自定义 1.55** → 清掉存档刷新回 `DEFAULT`。控制台无异常（仅既有 `THREE.Clock` 弃用告警与 `/favicon.ico` 404）。

### 11.9 已知限制

- 存档只在**浏览器本地**：不同浏览器 / 无痕 / 换机器不会同步；清理浏览器数据会丢失，此时回落到默认地图（不白屏）。**刻意不做**「删除本地存档」按钮（用户本轮只批准五个入口；恢复默认不删除存档，要清除需清浏览器数据）。
- 导入只接受**同一张地图的布局**：`rooms` / `doors` / `spawns` / `riceCandidates` 与当前授权地图不一致时一律拒绝，因此不能靠导入换地图或改门 / 出生点 / 米点。
- 「恢复默认地图」仍要过地图预检：若此刻有角色正好站在授权家具的位置上，会被拒绝并给出原因（与「应用编辑」行为一致）。
- 存档里 `document` 含只读空间参考字段（房间 / 门 / 出生点 / 米点），它们只是兼容性核对用的快照，**不写回运行时**；每局随机出生点与门初态仍由 S7C-3 现场掷出。
- 无版本迁移：`layoutVersion` 或 `formatVersion` 不匹配即视为无可用存档并回落到默认地图。

### 11.10 人工验收清单（浏览器）

0. `npm run dev` → `http://127.0.0.1:5173/`（首次先清一次站点数据可得到干净基线）。
1. 选阵营进入对局 → 打开 DEV ▾ → 点「场景编辑」→ 面板下方状态行显示 `DEFAULT｜默认布局｜未保存修改：否｜存档：无`。
2. 选一件家具改个数值 → 「应用编辑」→ 状态变为 `CUSTOM（尚未保存）`、未保存修改=是。
3. 点「保存布局」→ 状态变为 `SAVED`，状态行出现存档时间。
4. **刷新页面（F5）** → 重新选阵营进入对局 → 打开场景编辑：状态仍为 `SAVED`，刚才的数值还在。
5. 点「导出地图 JSON」得到一个文件；再「导入 JSON」选这个文件 → 状态变为 `未保存修改（与本地存档不同）`（若文件就是存档内容则仍为 `SAVED`）。
6. 手工把导出的 JSON 改坏（删一个括号）再导入 → 状态显示 `导入失败` 与 `NOT_JSON` 原因，**当前地图没有任何变化**。
7. 点「恢复默认地图」→ 弹出确认框 → 确认后家具回到默认数值；`localStorage` 里的存档仍在（状态为 `未保存修改（与本地存档不同）`）。
8. 关掉场景编辑 → Esc → 「重新开始」→ 再进编辑器：布局与存档状态保持不变。
9. 打开浏览器开发者工具清掉本站 `localStorage` → 刷新 → 回到默认布局且能正常进对局（不得白屏）。

### 11.11 用户集中人工验收结果（2026-09-27，9/9 PASS）

用户按 §11.10 的 9 条清单完成集中浏览器人工验收，**9 / 9 PASS**：① 应用编辑；② 保存布局；③ 刷新后恢复；④ JSON 导出与导入；⑤ 错误文件保护；⑥ 恢复默认地图；⑦ 重开与返回菜单；⑧ S7C-3 随机化及旧功能回归；⑨ 存档丢失安全回退。用户确认全部通过，本轮无待修复的已知问题。

**该结果由用户实机确认，不得改写为代理自己完成的浏览器测试。** 代理侧证据见 §11.8 与 `docs/verification/DEV_SCENE_EDITOR_V2/`，两条证据各自独立、覆盖范围不同：代理侧覆盖脚本可自动化的状态流转，用户侧覆盖真实手感、连续多局与旧功能回归。归档轮在本轮最终工作树上重新执行的门禁实测数字见 `docs/AGENT_LOG.md` 同日归档条目。
