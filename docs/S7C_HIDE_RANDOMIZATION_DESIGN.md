# S7C 藏身与随机化设计（S7C-0 阶段衔接审计 + 设计）

本文件是 S7C 的**设计与实施计划**，对应 S7C-0（阶段衔接审计与藏身系统设计）。本阶段**只新增/更新设计文档**，不改任何生产代码、不改 `GAME_CONFIG`、不 commit / push / tag。

- 审计时间：**首轮 2026-09-25 21:53 +08:00**；**补充轮 2026-09-25 22:03 +08:00**（按用户补充要求重做「真实地图与家具数据」审计，并把 S7C-1 拆为 S7C-1A / S7C-1B，见 §1.10 与 §3）。
- 补充轮的明确边界（用户原话）：保持现有地图总体结构和已验收的 AI 行为不变；暂不制作正式家具美术；**不开发 Human AI 检查或随机布局**；不调整 `GAME_CONFIG`；**先提交藏身点清单、布局建议和最小实施计划，等待确认后再改生产代码**。因此本文的 §4（S7C-2）、§5（S7C-3）只是**后续规划**，本轮不实施。
- 审计基线：`main` @ `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`（`feat: complete s7b-3b proactive door locking`），`git status -sb` 仅 `?? .dsh-meow/`、`?? .trae/`，无 `.git/MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` 残留。
- 本次重跑的验证：`npm test` 333/333 PASS（fail 0 / skipped 0，退出码 0）；`npx tsc --noEmit` 退出码 0。未跑 `npm run build`（会重写可重建的 `dist/`，本阶段无构建产物改动需求）。

> **后续更新（2026-09-25 22:2x｜S7C-1A 已获用户批准并落地）**：用户批准了 **S7C-1A 藏身点白模与地图配置**，指定「表 3.1 的 6 个锚点 + 2 个纸箱（`living_carton`、`storage_carton`）= 8 个藏身点」，并要求「这两个纸箱位置必须再次通过真实地图导航和碰撞检查」。本轮只改地图数据、`DEBUG_MAP` 调试标记与测试（`src/three/map/apartmentMap.ts`、`src/three/map/MapBuilder.ts`、`tests/hide-spot.test.mjs`），**未接入任何玩法**：没有 `HideSystem`、没有进入/退出键、没有改感知/抓捕/冲刺/进食、没有地图随机化、没有动 `GAME_CONFIG`。落地结果与被修正的一处坐标为 §3.2 / §3.4；本文 **§1 的源码行号是 S7C-0 审计时的快照**，1A 落地后可能已偏移。

---

## 1. 现状审计（以当前源码为准）

### 1.1 地图与藏身点数据（**S7C-0 审计时快照**；1A 落地后的现状见 §3.4 与 `docs/MAP_SPEC.md`）

| 事实 | 位置 |
|---|---|
| 藏身点只有 5 个占位 `MapPoint`（`id / roomId / x / z`），**没有**锚点、类型、朝向、占用、检查时长等任何字段 | `src/three/map/apartmentMap.ts:200-206` |
| 5 个点的坐标**恰好等于**对应家具碰撞矩形的中心 | `main_wardrobe`(167)、`closet_wardrobe`(168)、`storage_shelf`(165)、`second_bed`(171)、`study_bookshelf`(174)，同文件 `FURNITURE` |
| 藏身点只在 `DEBUG_MAP` 下画一个 `H0X` 精灵标记，没有玩法 | `src/three/map/MapBuilder.ts:63-64` |
| `MAP_SPEC.md` 明确记录「HideSpot 占位 5 处……不实现进入/退出/检查」 | `docs/MAP_SPEC.md:45` |

**关键实测（本次只读脚本，用真实 `CollisionWorld` + `NavigationSystem` + 玩家圆半径 0.23 / 身高 0.7）**：5 个藏身点的坐标**都不可站立**（家具碰撞矩形中心），最近的合法站位在 0.50–1.30 世界单位外；其中 `hide_main_wardrobe` 最近的「-X 侧」空隙是一条**导航网格进不去**的窄缝（该格 `nav.findPath` 对两个出生点都返回 `null`），可用锚点在 +X 侧。

| 藏身点 | 点坐标 | 家具矩形(W×D×H) | 可站立锚点（实测候选） | 与家具中心距离 | A* 路径节点数 |
|---|---|---:|---:|---:|---|
| `hide_main_wardrobe` | (-16.10, -7.80) | 0.60×2.10×1.15 | (-15.55, -7.80)（+X 侧） | 0.55 | 73 / 70（Human/DeepSeek） |
| `hide_second_bed` | (-13.00, 10.00) | 2.10×2.20×0.45 | (-14.30, 10.00)（-X 侧） | 1.30 | 74 / 57 |
| `hide_study_bookshelf` | (-0.10, 12.10) | 0.60×2.10×1.10 | (-0.65, 12.10)（-X 侧） | 0.55 | 54 / 22 |
| `hide_storage_shelf` | (17.35, -7.50) | 0.50×2.50×1.00 | (16.85, -7.50)（-X 侧） | 0.50 | 18 / 48 |
| `hide_closet` | (-4.10, -7.60) | 0.55×2.40×1.10 | (-3.55, -7.60)（+X 侧） | 0.55 | 59 / 56 |

结论：**「藏身点」当前只是一个家具中心坐标，不是一个可交互实体**。S7C-1 必须先补「锚点/类型/家具关联」数据，否则玩家无法站到点上，也会出现「站在家具外就能被正常抓捕」的语义矛盾。

### 1.2 角色、动作与表现层

- `CharacterAction` 只有 `IDLE / WALK / RUN / EAT / STARTLED / FALL / STUN / INTERACT / CAPTURE / CURIOUS_PEEK / CURIOUS_LOOK`，**没有藏身动作**（`src/systems/CharacterAction.ts:2-5`）。
- `CharacterActionView.paint()` 里有明确注释：**不移动、不缩放角色根节点**，因为根节点同时是碰撞与 Capture Zone 的锚点（`src/three/CharacterActionView.ts:101-110`）。
- `CaptureZoneView` 是挂在 **Human 根节点**下的子对象（`src/three/ThreeGame.ts:134`），因此「移动根节点」会连带移动抓捕圈。

### 1.3 交互系统（可复用）

- 统一交互仲裁在 `ThreeGame.handleDoorInteractions()`（`src/three/ThreeGame.ts:669-711`）：`E` 先判扫雷面板 → 再判最近门；`Q` 为锁门；`Space` 在 `511-528` 处理冲刺与 Human 强破。
- 最近门判定 `nearestInteractableDoor()`（`759-762`，复用 `DoorSystem.nearest` + `canInteractWithDoorXZ` 防隔墙）；进食范围 `C.rice.interactionRange / U = 1.0` 世界单位（`597-612`）。
- **可复用点**：藏身交互应当并入同一个 `E` 仲裁链，而不是新开第二套交互系统（符合「不新增第二套交互系统」）。

### 1.4 感知系统（视线 / 遮挡 / 声音 / Last Seen）

- 视线：`PerceptionGeometry.inspectVision`（`src/systems/PerceptionSystem.ts:77-93`）——超出 `visionRange=11` 判 `OUT_OF_RANGE`，命中墙体判 `BLOCKED`，命中任何**非 OPEN 门叶**判 `BLOCKED`。
- `VisionSystem.update/get`（`269-290`）只做 **一次 human↔deepseek 的全局 LOS**，两个阵营共享同一个 `status/blocker`，`lastSeen` 只在可见帧刷新，失视超过 `lastSeenMs=8000` 清空。
- 声音：`crossings()`（`56-75`）按墙/开/关/锁门计数，`soundFactor()`（`99-106`）用 `wallSoundFactor 0.28`、`closedDoorSoundFactor 0.45`、`lockedDoorSoundFactor 0.35`、开门口 1.0；`heardBy` 以 `minimumAudibleStrength 0.015` 过滤。
- **没有任何「角色被隐藏」的概念**：感知系统只知道几何与门状态。因此「藏身不可见」必须在感知层/输入层表达，而不是在 AI 里临时判空。

### 1.5 Human AI 的 `CHECK_HIDE`

- `HumanAIState` 联合类型里有 `'CHECK_HIDE'`，且**全项目只有这一处出现**（`src/systems/HumanAIController.ts:10`，注释「stays reserved until S7C」）；没有赋值、没有转移、没有输入字段、没有 DEV 字段。
- 文档一致承认它是空接口：`docs/AI_HUMAN_STATE_TREE.md:11,17,52,90`、`docs/AI_STATE_OVERVIEW.md:9,12`、`docs/DEEPSEEK_HANDOFF.md:40,63`。
- Human AI 的合法线索目前只有：当前目视（`visibleTarget`）、`lastSeen`、可听声音（`heard`）、有限搜索（`SEARCH` 及其 `searchRadius/searchRoomCount/searchDwellMs/searchMaxMs`）。**没有任何「怀疑某藏身点」的字段**——S7C-2 不得给它加透视字段。

### 1.6 与 EVADE / Sprint / STUNNED / CAPTURE 的接点

| 系统 | 现状 | 藏身必须考虑的点 |
|---|---|---|
| Sprint | `tryStart` 仅在 `NORMAL` 且冷却为 0 时成功（`SprintSystem.ts:40-56`）；`movementDirection` 在 `STUNNED` 时恒返回 0（`85-89`） | 藏身中应禁止起冲刺；`STUNNED` 中禁止进藏身点 |
| 抓捕 | `isCaptureEligibleXZ` = 在 `captureRadius 0.70` 内且**视线未被子系统阻挡**（`CaptureZone.ts:17-24` + `ThreeGame.ts:627-632`） | 藏身锚点在**开阔的地面**上，现有规则会照常抓捕藏身者 → 必须显式门控「藏身中不进入 Capture 判定」 |
| 胜负 | `GameStateSystem.advancePlaying` 用 `captureEligible` 累积 `captureMs 350`（`GameStateSystem.ts:46-63`） | 门控落在 `captureEligible` 之前即可，不改胜负规则 |
| 进食 | `RiceSystem.tick` 的 `active` 依赖 `sprint.state === 'NORMAL'` 且零位移（`ThreeGame.ts:605-612`）；中断用 `rice.interrupt()` | 进入藏身点应 `interrupt()`，隐藏期间不可进食 |
| 米痕/脚步 | `traces.recordMovement(player)`（`539`）、`emitMovementSound()`（`947-954`） | 隐藏期间不移动 → 天然不产生；仍建议显式断言 |

### 1.7 门 / 导航 / 碰撞

- `DoorSystem` 的初始状态来自 `DoorNode.initialState`（构造 `38`、`reset()` `122`），当前 `makeDoor` **恒为 `'CLOSED'`**（`apartmentMap.ts:68,76`）；`PerceptionSystem` 在拿不到运行时状态时也回退到该常量（`63`、`84`）。→ **门状态随机化不能改这个常量**，必须给 `DoorSystem` 一个运行时初始状态入口。
- 导航把普通 `CLOSED` 门视为可通行（代价 +3），`LOCKED` 门在未传 `lockedDoorCost` 时为不可通行（`NavigationSystem.ts:57-63,133-140`）；移动最终仍走 `CollisionWorld`（分轴 + 角落滑动）。
- 藏身锚点若落在 `CLOSED` 门后仍可被 A* 到达（有代价），但**若某局随机化把房间隔成只有 `LOCKED` 才能通过的孤岛，锚点就会不可达** → S7C-3 的校验必须覆盖藏身锚点。

### 1.8 DEV 面板与 AI JSON（可复用结构）

- DEV 分类是数据驱动的 `DebugCategory[]`（`ThreeGame.ts:1073-1214`），现有 `human-ai / deepseek-ai / threat-escape / door-escape / sprint / door-lock / safe-wait / curiosity-passage / animation`，面板本身通用（`DebugDetailsPanel.ts`）。新增 `hide` 分类只是加一段数组。
- AI JSON 采集器按「快照 diff + 显式事件」工作（`AILogCollector.ts:92-120,142-198`），导出内容为 `formatVersion / exportedAt / matchDurationMs / config.deepseekAI / events`（`222-232`）。**日志只覆盖 DeepSeek AI**；若要记录藏身事件，需要在 `diffSnapshot` 里加显式事件数组（与 `doorEscapeEvents/doorLockEvents` 同构），并在导出里加 `matchSeed` 之类的场次字段。

### 1.9 S7B 阶段衔接判定

- `AGENTS.md`：S7B-1 ～ 3B-4 均已通过人工验收，**「整个 S7B 仍未完成」**，下一阶段 S7C 需另行授权（本次已授权 S7C-0）。
- 逐项分类（本次源码+文档核对结论）：
  1. **已验收完成**：S1–S6、S7A、S7B-1、S7B-2（含静止 Human 好奇/安全通行专项）、S7B-3A、S7B-3B（3B-0b～3B-4）。
  2. **不影响进入 S7C 的后续优化**：S7B-2 偶发原地停留（`AGENTS.md`、`DEEPSEEK_HANDOFF.md:129`、`AI_STATE_OVERVIEW.md:62` 三处都明确写「不阻断、留作后续 AI 优化项」）；正式 GLB 待机资源（S10）；Human AI 自动解锁 8,750 ms（S16）；「修复后实机 AI JSON」缺失（只影响 3B 的实机复核口径，不阻断新阶段）。
  3. **必须先解决的阻断问题**：**未发现**。本次重跑 333/333 + `tsc --noEmit` 通过；S7B 没有未闭合的 Gate，也没有已知的阻断 Bug。
- 唯一需要在 S7C 开工前确认的是**范围问题**（见第 6 节第 1 条）：S7C-1 只做「DeepSeek **玩家**藏身」，而 S7C-2 的「Human **玩家**检查藏身点」在玩家选 DeepSeek 时没有目标对象——需要用户先决定 DeepSeek AI 主动藏身是否纳入 S7C。

### 1.10 家具与箱体清单（第二轮补充实测，2026-09-25）

真实 `FURNITURE` 共 **18 件**（`apartmentMap.ts:157-176`），全部 `fullyInRoom = true`、全部构成静态碰撞（角色圆无法站进其 AABB）。按「床 / 柜架 / 桌台」分类如下（`hideMark` = 是否已有藏身标记）：

| 物体 ID | 类别 | 房间 | 尺寸 W×D×H | 藏身标记 |
|---|---|---|---|---|
| `main_bed` | **BED** | main_bedroom 主卧 | 2.1×2.3×0.45 | 无（建议新增） |
| `second_bed` | **BED** | second_bedroom 次卧 | 2.1×2.2×0.45 | `hide_second_bed` |
| `main_wardrobe` | 衣柜 | main_bedroom 主卧 | 0.6×2.1×1.15 | `hide_main_wardrobe` |
| `closet_wardrobe` | 衣柜 | closet 衣帽间 | 0.55×2.4×1.1 | `hide_closet` |
| `study_bookshelf` | 书柜 | study 书房 | 0.6×2.1×1.1 | `hide_study_bookshelf` |
| `storage_shelf` | 货架 | storage 储物间 | 0.5×2.5×1.0 | `hide_storage_shelf` |
| `second_cabinet` | 边柜 | second_bedroom 次卧 | 0.6×1.4×1.0 | 无（可作备选） |
| `living_tv_cabinet` | 电视柜 | living 客厅 | 1.5×0.6×0.65 | 无（太矮、靠墙） |
| `kitchen_fridge` | 冰箱 | kitchen 厨房 | 0.8×0.8×1.2 | 无 |
| `living_sofa` / `living_coffee_table` / `dining_table` / `kitchen_counter` / `kitchen_island` / `bath_sink` / `bath_tub` / `study_desk` / `entry_bench` | 桌台/卫浴/坐具 | 各房间 | 见源码 | 无（不适合藏身） |

结论：
1. **不存在任何纸箱/木箱类物体**（用户判断正确）；衣柜有 2 件、床有 2 件、柜架另有 3 件。
2. **已有藏身标记 5 个**（`HIDE_SPOTS`，全部落在衣柜/书柜/货架/次卧床的中心）；**但没有任何交互接口**：全项目只有 `MapBuilder.ts:63-64` 在 `DEBUG_MAP` 下读它画精灵，没有任何系统、按键或状态读取。
3. `main_bed`（主卧床）是**当前没有被标记的床**，符合用户「优先复用已有床」的诉求，建议本次补上。
4. 「床底」的物理限制（实测）：床碰撞体是 **0.45 高的实心 AABB**（`canOccupyStaticXZ` 会阻挡），而角色高 **0.7**、圆半径 0.23 → **既不能站进床内，也不能真的钻到床下**。真正的「钻床底」需要把床碰撞从「实心盒」改成「床框 + 空洞」，这属于地图/碰撞改动，需另行批准（见第 6 节第 20 条）。**默认方案：床边锚点 + 只在表现层把角色画到床沿/床下阴影处，判定完全不变。**

---

## 2. S7C 总体设计

### 2.1 红线（沿用既有约定，不新增冲突规则）

1. **不传送**：藏身不得通过瞬移实现；玩家的 Gameplay 位置始终由 `CollisionWorld` 决定的合法点。
2. **不删碰撞**：不得为了「站进柜子」而移除/缩小家具 AABB，也不得让 `NavigationSystem` 或 `CollisionWorld` 出现新的可穿透格。
3. **不透视**：Human AI 与 Human 玩家都不得读取「藏身者所在点」或任何隐藏实时位置；只能通过当前目视、Last Seen、合法声音与有限搜索获得线索。
4. **不新增第二套系统**：交互并入 `handleDoorInteractions` 的 `E` 仲裁；感知只扩展现有 `VisionSystem`；导航继续用 `NavigationSystem`；占用状态集中在一个新的纯逻辑 `HideSystem`。
5. **表现与判定分离**：视觉表现可以「把角色画进家具」，但判定、碰撞、抓捕、胜负不得被表现层改动；角色**根节点不得移动**（`CharacterActionView.ts:101-110`）。
6. **不凭空定平衡数值**：所有新增参数先列建议值，等用户确认后再写入 `GAME_CONFIG` 与 `docs/GAME_BALANCE_CONFIG.md`。
7. **不改已验收的 S7B-3B 行为**：门、锁、冲刺、感知、SAFE_WAIT、好奇/通行的既有条件一律不动。

### 2.2 数据模型（S7C-1 第一步）

把 `HIDE_SPOTS` 从占位点扩展为有语义的藏身点（保持向后兼容：现有 `x/z` 语义不变，仍用于调试标记与房间归属校验）：

```ts
export interface HideSpot extends MapPoint {
  kind: 'WARDROBE' | 'BED' | 'SHELF' | 'CARTON'; // 表现与音效分支，不影响判定
  furnitureId: string;                   // 关联 FURNITURE 条目，仅供校验/表现
  facing: number;                        // 锚点指向家具中心的方位角（表现用）
  label: string;                         // 仅用于 DEBUG_MAP 调试标记的显示名
}
```

**S7C-1A 落地修正（2026-09-25）**：原草案另设 `anchor: Point`，但 `MapPoint` 已经带 `x/z`，而家具中心可由 `furnitureId` 反查 `FURNITURE` 得到——同时存 `x/z`（家具中心）与 `anchor` 会让同一份「位置」有两个副本，属于本项目已记录的「不要在两处维护同一份真相」问题。因此落地为：**`HideSpot.x/z` 就是唯一合法锚点（进入 = 退出）**，`anchor` 字段不再单列；`label` 为调试显示名（中文）；`enterSound` 待第 12 条音效议题确认后再加。`facing = atan2(furniture.z - spot.z, furniture.x - spot.x)`，由 `tests/hide-spot.test.mjs` 反算校验。

锚点候选见表 3.1（第二轮实测，已按上表结构落地）；`anchor` 必须由**自动校验**保证：可站立（`canOccupyStaticXZ`，且距家具 AABB ≥ 0.05）、距最近门段 ≥ 2.0、距最近米点 ≥ 1.2、且落在可用导航格附近（`|anchor − 最近可用格心| ≤ 0.45`，供 Human AI 与未来的 AI 藏身寻路使用）。

### 2.3 新增 `HideSystem`（纯逻辑，可单测）

```ts
export type HideSpotOccupancy = { spotId: string; faction: Faction } | null;

export class HideSystem {
  enter(id, faction, conditions): HideEnterResult;   // 合法性检查 + 占用写入
  exit(reason: HideExitReason): HideExitResult;      // 玩家主动 / 移动 / 被检查发现 / 局终 / 重开
  advance(deltaMs): HideEvent[];                     // 进入/退出/检查进度，事件驱动
  occupancyOf(id): Faction | null;                   // 只给 DEV/测试；AI 输入不得包含
  isHidden(faction): boolean;
  reset(): void;
  // 检查（S7C-2 用）
  beginCheck(id, faction, phase): HideCheckResult;
  cancelCheck(reason): void;
}
```

- 事件谱系建议：`HIDE_ENTER / HIDE_EXIT / HIDE_CHECK_START / HIDE_CHECK_RESULT / HIDE_FLUSHED`，便于与既有 `DOOR_*` 事件同样接入 DEV 与（可选）AI JSON。
- 该类的输入**只包含几何与自身状态**，禁止接收对手实时坐标。

### 2.4 接入点清单（S7C-1）

| 接入点 | 位置 | 改动性质 |
|---|---|---|
| `E` 键仲裁 | `ThreeGame.handleDoorInteractions()`（`669-711`） | 在门/扫雷之后、进食之前插入「藏身点」分支，明确优先级 |
| 移动限制 | `ThreeGame` 帧循环（`534-538` 冲刺位移、`590-594` 人类位移） | 藏身中 DeepSeek 位移强制为 0（与 `STUNNED` 同构，不新增物理特性） |
| 抓捕门控 | `ThreeGame.ts:629-632` | `captureZoneActive = ... && !hide.isHidden('DEEPSEEK')` |
| 感知抑制 | `VisionSystem`（新增 `setConcealed(faction, boolean)` 或等价入口） | 单一真源：被隐藏阵营的 `visible=false`、`status='CONCEALED'`，`lastSeen` 不再刷新；AI 与 HUD 读同一个值 |
| 冲刺门控 | `SprintSystem.tryStart` 的调用点（`ThreeGame.ts:507-513`） | 藏身中不起冲刺（不修改 `SprintSystem` 内部规则） |
| 进食中断 | `ThreeGame.ts:605-612` | 进入时 `rice.interrupt()` |
| 表现 | 新增 `HideSpotView`（`src/three/`）+ 锚点标记 | 只画表现；占用**不得**在正式对局中向对手暴露 |
| DEV | `ThreeGame.updateDebugDetailsPanel` 新增 `hide` 分类 | 只加数组段 |
| 日志（可选） | `AILogCollector` 新增显式事件数组字段 | 与 `doorEscapeEvents` 同构 |

### 2.5 表现方案（三选一，待确认）

- **V1（推荐）**：保持 `this.player` 根节点不动（碰撞/CaptureZone 锚定不变），新增一个**表现子层**承载角色可视方块；隐藏时把子层平移/缩小到家具内部，并换成藏身姿势。语义 = 「视觉上进了柜子，判定上仍在锚点」。
- **V2（最保守）**：根节点不动、不位移，隐藏时改为低透明度 + 蹲伏姿势 + DEV 标注；视觉上仍在家具外侧。
- **V3（最省事）**：隐藏时 `this.player.visible = false`，仅 HUD/DEV 显示状态；退出恢复。

三者都不触碰碰撞、抓捕与胜负；差别只在观感与改动量。**需用户在 S7C-1 开工前选定一种。**

---

## 3. S7C-1：玩家基础藏身交互（按用户补充要求拆为 S7C-1A / S7C-1B）

> 本节已按 2026-09-25 补充要求重写：**先交清单/布局建议/最小实施计划，等用户确认后才改生产代码**。本轮（S7C-0）不写玩法代码、不做正式家具美术、不开发 Human AI 检查、不做随机布局、不动 `GAME_CONFIG`。

### 3.1 藏身点清单（表 3.1，全部基于真实地图数据与实测）

选址规则：优先复用已有床 → 再复用衣柜/书柜/货架 → 只在缺箱体时才考虑白模新增。锚点全部满足：可站立、距家具 AABB ≥ 0.05、距最近门段 ≥ 2.0、距最近米点 ≥ 1.2、落在可用导航格附近（≤ 0.45）。

| # | 物体 ID | 类型 | 房间 | 进入位置 = 退出位置（锚点） | 距家具中心 | 距最近门 | 距最近米 | 两出生点 A* 节点数 |
|---|---|---|---|---|---|---|---|---|
| 1 | `main_bed` | BED 床 | main_bedroom 主卧 | (-14.40, -6.15) | 1.81 | 6.40 | 2.17 | 72 / 69 |
| 2 | `second_bed` | BED 床 | second_bedroom 次卧 | (-14.40, 8.90) | 1.78 | 4.14 | 3.67 | 71 / 54 |
| 3 | `main_wardrobe` | WARDROBE 衣柜 | main_bedroom 主卧 | (-16.65, -6.60) | 1.32 | 8.65 | 2.23 | 73 / 70 |
| 4 | `closet_wardrobe` | WARDROBE 衣柜 | closet 衣帽间 | (-3.57, -8.80) | 1.31 | 4.77 | 4.54 | 62 / 59 |
| 5 | `study_bookshelf` | SHELF 书柜 | study 书房 | (-0.80, 11.05) | 1.26 | 2.36 | 6.69 | 52 / 20 |
| 6 | `storage_shelf` | SHELF 货架 | storage 储物间 | (16.80, -8.75) | 1.37 | 2.18 | 5.49 | 19 / 51 |
| 7（备选） | `second_cabinet` | SHELF 边柜 | second_bedroom 次卧 | (-15.60, 6.00) | 0.92 | 2.77 | 2.67 | 70 / 55 |
| 8–10（可选，需批准） | 新增 `living_carton` / `storage_carton` / `entry_carton` | CARTON 纸箱 | living / storage / entry | 见 §3.2 | — | — | — | — |

> **落地状态（2026-09-25，S7C-1A）**：第 1–6 行**已按本表原值写入源码，六个坐标一个都没改**；第 7 行 `second_cabinet` 用户决定**暂不添加**；第 8–10 行的四个纸箱候选中**只采纳 `living_carton` + `storage_carton`**（`entry_carton` / `study_carton` 不做），其中 `storage_carton` 的 z 由 -2.6 修正为 **-4.8**（原因与实测证据见 §3.2）。合计 **8 个藏身点**。最终数据以 `src/three/map/apartmentMap.ts` 的 `HIDE_SPOTS` 为准；完整锚点 + 余量表见 `docs/MAP_SPEC.md`。

选点过程中被**排除**的方案（均有实测原因）：
- `hide_main_wardrobe` 原占位点 (-16.10, -7.80) 与它正前方的旧锚点 (-15.55, -7.80)：距米点 `rice_09`(-15.1, -8.2) 仅 **0.60 u**，落在进食范围（`rice.interactionRange/U = 1.0`）内 → 会与「按住 E 进食」抢占同一个键，故改到衣柜北侧锚点 (-16.65, -6.60)（距最近米 2.23 u）。
- 衣柜西侧紧贴墙的那条缝（宽约 0.05 u）：**导航网格进不去**（0.4 的格子放不下），即使 `canOccupyStaticXZ` 放行也不能作为 AI 可达点 → 一律排除。
- `storage_shelf` 的东侧（+X）：货架距东墙仅 0.5 u，**没有**合法站位；只能用西侧。
- `living_tv_cabinet`（高 0.65、贴墙）与 `kitchen_fridge`（贴墙、厨房通道紧）不适合做藏身点。

### 3.2 缺失箱体的最简白模方案（**已落地 2 个**）

- 实测结论：**不需要为衣柜做新白模**（已有 2 件衣柜 + 2 件床 + 3 件柜架可用）；**只缺纸箱**。
- 最简实现：**不新增任何 Three.js 代码**，只往 `FURNITURE` 加一行数据，例如
  `furnishing('living_carton', 7.9, 3.9, 0.9, 0.9, 0.75)`。
  `MapBuilder.addObstacle`（`MapBuilder.ts:46-56`）会自动用 `BoxGeometry` 画白模、加入静态碰撞，并在 `DEBUG_MAP` 下勾出轮廓；再往 `HIDE_SPOTS` 加一条对应藏身点即可。**无正式美术、无新模型、无新着色器。**
- 已离线校验的 4 个候选位置（在真实 `CollisionWorld` + `NavigationSystem` 上把纸箱当作额外障碍后重算）；判定标准与 `tests/apartment-map.test.mjs` 的不变量一致（10+2 房间可达、14 个米点可站立且可达、两出生点可站立、18 扇门及门前后 1 个角色直径处可站立、Human 出生点到所有房间 A* 可达）：

| 候选 ID | 房间 | 坐标 | W×D×H | 不变量结果 |
|---|---|---|---|---|
| `living_carton` | living 客厅 | (7.9, 3.9) | 0.9×0.9×0.75 | **全部保持**（已采纳，坐标未改） |
| `storage_carton` | storage 储物间 | (15.7, **-4.8**) | 0.9×0.9×0.75 | **全部保持**（已采纳，z 由 -2.6 修正） |
| `entry_carton` | entry 玄关 | (3.0, 11.6) | 0.9×0.9×0.75 | **全部保持**（本轮不做） |
| `study_carton` | study 书房 | (-6.8, 13.6) | 0.9×0.9×0.75 | **全部保持**（本轮不做） |

- **用户指定的 `storage_carton (15.7, -2.6)` 复核失败（实测证据）**：该点距米点 `rice_08 (16.1, -3.3)` 中心仅 **0.81 u**，纸箱 AABB 到 `rice_08` 的距离只有 **0.250 u**，而 `tests/apartment-map.test.mjs` 的 `free()` 用 `PLAYER_DIAMETER / 2 = 0.2667` 判定 → `rice_08` 被判定为**被纸箱压住**（`rice blocked rice_08`）。按「两个纸箱位置必须再次通过真实地图导航和碰撞检查」的要求，保留用户指定的 x=15.7（仍贴储物间西墙）而把 z 北移到 **-4.8**：距 `rice_08` 中心 **1.55 u**、纸箱与米点标记间距 ≥ 0.72 u，且不压任何门、门前后点、米点，不改变储物间可通行性（见 §8.1 的连通性测试）。
- 建议只加 **`living_carton`（公共区）+ `storage_carton`（米点房）** 两个；也可按用户意见取 0 个（只用现有家具 6 点）或 3 个。

### 3.3 每个藏身点的完整规格（用户第 5、6 条要求）

| 字段 | 规格 |
|---|---|
| 物体 ID / 类型 / 房间 | 见表 3.1（`furnitureId` 与 `FURNITURE` 一一对应） |
| 进入位置 | `anchor`，玩家必须站在锚点 **≤ `hide.anchorTolerance`（建议 0.3）** 内并静止 `enterMs`（建议 400 ms）；**进入不改变角色位置（零传送）** |
| 退出位置 | 同一个 `anchor`；由于进入时位置没变，退出也不需要移动（避免「退出被家具挤住」的问题） |
| 交互距离 | 到 `anchor` 的距离 ≤ `hide.interactionRange`（建议 1.0，待确认）——注意是**到锚点**，不是到家具中心，因此 1.26–1.81 的 stand-off 不影响交互 |
| 占用状态 | `HideSystem` 每点最多 1 名占用者，**只有 DeepSeek 可占用**；Human 只「检查」不占用；占用状态仅 DEV/日志可见，**不做世界内可视化**（否则会向对手泄露） |
| 导航避障 | 藏身点**不新增碰撞体、不新增导航障碍**（完全复用现有家具碰撞）；锚点必须 `canOccupyStaticXZ` 且距可用导航格心 ≤ 0.45。唯一例外：S7C-1A 新增的 2 个纸箱本身是静态障碍，已通过 §3.2 的既有地图不变量与 §8.1 的连通性校验 |
| 合法接近/检查 | 锚点均可被两个出生点 A* 到达（表 3.1 末列非空）；距最近门段 ≥ 2.0 u，不与 `E` 开门/锁门占位冲突；距最近米点 ≥ 1.2 u，不与进食抢占；不落在墙内（`fullyInRoom` 家具旁的开阔地面） |
| 不阻断通道 | 复用现有家具 ⇒ 不新增任何阻挡；新增纸箱已用与 `tests/apartment-map.test.mjs` 等价的不变量 + `tests/hide-spot.test.mjs` 的连通性对比校验（§3.2 / §8.1） |

### 3.4 S7C-1A：藏身点白模与地图配置 —— **已实现，用户浏览器人工验收 PASS（2026-09-26），尚未建立 Git 检查点**

- **目标**：把「可藏身的位置」变成地图里真实存在、可校验的数据；**不接入任何玩法**（按键、状态、抓捕都不变）。
- 已交付内容：
  1. `HideSpot` 数据结构（`kind / furnitureId / facing / label`，`x/z` 即唯一锚点）+ **8 条**数据（6 件现有家具 + 2 个新纸箱），见 `src/three/map/apartmentMap.ts`。
  2. 2 条纸箱 `FURNITURE` 数据（`living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`，均 0.9×0.9×0.75）——复用 `MapBuilder.addObstacle` 的白模 + 静态碰撞，**零 Three.js 新代码、无正式美术**。
  3. `DEBUG_MAP` 下的藏身点调试标记改为「中文名 + 藏身点 ID」+「类型 (锚点 x, z)」两行精灵 + 锚点地面小方块（`MapBuilder.markerLines`）。非 DEBUG 时 `hideSpotDebugMarkers(false)` 返回空数组，普通玩家视图拿不到任何藏身点信息。
  4. 新增 `tests/hide-spot.test.mjs`（9 项）：ID/房间/类型/家具绑定/朝向唯一且完整、`facing` 与「锚点→家具中心」一致、锚点在房间内且可站立、距家具 ≥ 0.05、距最近门段 ≥ 2.0、距最近米点 ≥ 1.2、距可用导航格心 ≤ 0.45、两出生点均 A* 可达、纸箱只此两个且不与其他盒子重叠、纸箱不压门/门前后点/米点、加纸箱前后的可达格连通性、以及「非 DEBUG 不产生标记」。
- 涉及文件：`src/three/map/apartmentMap.ts`、`src/three/map/MapBuilder.ts`、`tests/hide-spot.test.mjs`（新）、`docs/MAP_SPEC.md`、本文件、`docs/AGENT_LOG.md`。
- **未改动**（逐条核对）：门/锁/冲刺/米堆/抓捕/感知的任何规则与数值、两套 AI 决策、`GAME_CONFIG`；除 `MapBuilder` 的调试标记外，没有任何系统读取藏身点数据。
- 自动化结果（2026-09-25）：`npm test` **342/342 PASS**（基线 333 + 新增 9）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0。
- 浏览器人工验收（**2026-09-26 用户确认 PASS**）：`DEBUG_MAP` 下能看到 8 处「中文名 + ID + 类型 + 坐标」标记与 8 个锚点地面方块；8 个锚点都在家具旁的开阔地、不贴墙、不压门、不压米点；新增纸箱可见且不挡路、不挡门。用户本轮五项结果中的第 4、5 项即对应本节（「八个藏身点的列表选择和遮挡点聚焦」「两个纸箱通行、家具编辑后的碰撞同步」）。**尚未建立 Git 检查点。**
- **遗留观察与用户决定（2026-09-25 决策定案，用户已确认 ①–④）**：
  - **实测事实（保留）**：`hide_main_wardrobe (-16.65, -6.60)` 与 `hide_closet (-3.57, -8.80)` 的锚点在角色圆（半径 0.23）之外只剩 **0.030 / 0.025 u** 余量（其余 6 个为 0.070–0.220）；`living_carton (7.9, 3.9)` 距客厅东墙与南墙各 **0.56 u**，其东侧与南侧各剩一条约 **0.10 u** 宽的角色圆心通道（可挤过但很窄；该角落无米点、无门）。
  - **① 接受 `storage_carton` 由 z = -2.6 改到 z = -4.8**：原位置纸箱 AABB 到米点 `rice_08 (16.1, -3.3)` 只有 **0.250**（< `PLAYER_DIAMETER/2` = 0.2667），被真实地图测试判定压住该米点；修正有明确测试依据，且不影响通路（证据见 §3.2 / §8.1）。
  - **② 两个衣柜锚点先不改**（用户理由原话）：「虽然余量偏小，但 1B 是『靠近锚点即可交互』，并不是要求角色圆心必须精确踩在点上。先浏览器走一遍，真觉得别扭再微调，避免为了理论余量来回改坐标。」
  - **③ `living_carton` 先保持现位置**（用户理由原话）：「它虽然靠角落比较紧，但当前测试显示不挡门、不挡米、不破坏连通性。先看实机视觉效果再决定要不要贴到更里面。」
  - **④ `hide_closet` 暂时不改名**（用户理由原话）：「这个 ID 已经存在过，稳定 ID 比命名整齐更重要。」
  - **备选值（未采纳，仅备查）**：衣柜锚点 `(-16.60, -6.40)` / `(-3.40, -8.80)`；`living_carton` 平移到墙角 `(8.46, 4.46)`。如浏览器实机观感确有别扭，再由用户单独提出一轮坐标微调，本轮不主动改；任何坐标改动都必须重跑 `tests/hide-spot.test.mjs`、`tests/apartment-map.test.mjs` 与全量 `npm test`。

### 3.5 S7C-1B：玩家基础藏身交互

- **前置（尚未满足）**：**S7C-1B 未获授权**。开工前需用户对第 6 节第 3–14 行的建议值逐条确认（进入耗时、与 Human 的安全距离、交互距离、表现方案 V1/V2/V3、是否新增 `HIDE_ENTER/EXIT` 事件与 DEV `Hide` 分类）。**这些建议值已写在文档里，不代表已经实施或验收通过**——不得因为「已有建议值」或「此前生成过开发提示词」就当作已获批准而开工；1B 参数集中列为待用户单独确认。床底的表现与感知规则见下方第 8 条。
- **目标**：固定地图上跑通「进入/退出藏身点、占用、移动限制、视觉反馈」的最小闭环（玩家主控 DeepSeek 时可用）。
- 交付内容：
  1. `src/systems/HideSystem.ts`（纯逻辑：占用、进入前置条件、退出原因、事件）。
  2. `GAME_CONFIG.hide` 新参数（**数值待用户确认后**再写，见第 6 节）。
  3. `ThreeGame` 接入：`E` 仲裁、移动限制、抓捕门控、`rice.interrupt()`、冲刺门控、重开清理。
  4. `VisionSystem` 隐藏感知入口（不新增系统）。
  5. `src/three/HideSpotView.ts`（表现层）+ 表现方案 V1/V2/V3 之一。
  6. DEV 面板新增 `Hide / 藏身` 分类（当前点、锚点距离、进入进度、占用、最近拒绝原因、事件计数）。
  7. （可选，推荐）AI JSON 显式事件 `HIDE_ENTER / HIDE_EXIT`。
  8. **床底的表现与感知规则（用户点名要在 1B 明确）**：`main_bed` / `second_bed` 在 1B 里只能表现为「床边蹲伏 + 被床体遮挡的视觉处理」，感知上**不得因为「贴着床边」就自动不可见**——可见性必须仍由 `HideSystem` 的隐藏状态（`CONCEALED`）单一驱动。**本阶段（1A）没有改床的实心碰撞，1B 也不得改**；如果确实需要「钻到床下」的真实遮挡，须先提交「床框 + 空洞碰撞」专项设计（列明对碰撞、导航网格、抓捕视线三项的影响与回归测试），等用户单独批准后再实现。
- 涉及文件：`src/systems/HideSystem.ts`(新)、`src/systems/PerceptionSystem.ts`、`src/three/ThreeGame.ts`、`src/three/HideSpotView.ts`(新)、`src/config/gameConfig.ts`、`tests/hide-system.test.mjs`(新)、`docs/GAME_BALANCE_CONFIG.md`。
- 不应改动：S7B-3A/3B 条件关门与锁门、S7B-2 威胁/逃跑/好奇/通行、Human AI 决策、门与锁的全部规则、米堆与进食、冲刺数值、抓捕半径与 350 ms、感知距离与遮挡系数。
- 自动化测试（预计 ≥ 10 项）：`enter` 的每条拒绝路径（超距、已被占、Human 过近、抓捕进度 > 0、STUNNED、非 PLAYING）；进入后 `isHidden` 为真且占用唯一；隐藏中 `visible=false`、`captureEligible=false`、位移为 0、不能起冲刺；退出原因分类正确；`reset()` 清空占用与事件；同一藏身点不能双人占用；DEV 事件计数与事件数组逐一相等。
- 浏览器人工验收步骤（草案，供用户确认）：
  1. 选 DeepSeek → 走到主卧衣柜锚点 (-16.65, -6.60) → 按 `E` → 站定 400 ms 后进入；DEV `Hide` 分类显示 `spotId / 进入进度 / 占用=自己`。
  2. 进入后按 WASD 无位移；`Sprint` 无法启动；`Capture 进度` 保持 0。
  3. 人类 AI 不追来；DEV 中 `humanVisible=false`（隐藏期间），`Last Seen` 不刷新。
  4. 按 `E` 退出 → 立即可移动/进食/被抓；人类 AI 恢复正常追击。
  5. 在 Human 距自己 < 1.5 时尝试进入 → 被拒绝且 DEV 显示原因。
  6. 已占用的点再按 `E` → 被拒绝；`STUNNED` 中按 `E` → 被拒绝。
  7. 进入前正在进食 → 进食被中断、进度保留（复用既有中断语义）。
  8. 在 S7C-1A 落地的 **8 个锚点**旁各试一次（2 床 `hide_main_bed (-14.40,-6.15)` / `hide_second_bed (-14.40,8.90)`、2 衣柜 `hide_main_wardrobe (-16.65,-6.60)` / `hide_closet (-3.57,-8.80)`、2 柜架 `hide_study_bookshelf (-0.80,11.05)` / `hide_storage_shelf (16.80,-8.75)`、2 纸箱 `hide_living_carton (7.00,3.60)` / `hide_storage_carton (16.60,-4.80)`），确认锚点位置手感一致、不会被家具或墙挤住；**两张床额外确认**：角色不会穿进床体、「床底」只做表现、贴床边本身不会让人隐形。
  9. Esc 暂停/重开、返回阵营选择后占用清空，无残留状态。


## 4. S7C-2：Human 检查藏身点与 Human AI 的 `CHECK_HIDE`

> **本轮（S7C-0 补充轮）不实施**——用户明确「不开发 Human AI 检查」；本节仅作后续规划，等 S7C-1B 验收后再单独授权。

**目标**：给藏身玩法加上对称的反制，且线索完全来自既有感知。

- 交付内容：
  1. **Human 玩家检查**：靠近藏身点按住 `E`（与藏身同一仲裁链）→ 进度条 `checkMs`；完成时若有人 → 强制其退出（`HIDE_FLUSHED`）；空点 → 无变化。检查可被移动/暂停中断。
  2. **Human AI `CHECK_HIDE`**：真正接入 `HumanAIState`，触发源只允许三类合法线索：
     - **目击进入**：AI 在藏身者进入的瞬间确实看得见它（复用现有可见性判定），把该 `spotId` 记入一个**有寿命的记忆**（复用 `perception.lastSeenMs` 语义）；
     - **有限搜索**：`SEARCH` 到达的搜索房间内若有藏身点，最多检查 `checkHideMaxPerSearch` 处；
     - **藏身相关声音**：听到进入/退出/检查声音后，转入 `INVESTIGATE` 并在到达后检查。
     **禁止**把 `HideSystem.occupancyOf()` 传给 AI；AI 输入只提供「几何上附近的藏身点 id」与「自己目击过的 id」。
  3. 被检查命中：藏身者被强制退出（`HIDE_FLUSHED`），随后交由既有 CHASE/CAPTURE 规则处理；是否附加眩晕/额外信息见第 6 节。
  4. DEV：`human-ai` 分类新增 `check-hide` 字段（目标点、进度、触发来源）；可选 AI JSON 事件。
- 涉及系统/文件：`src/systems/HumanAIController.ts`、`src/systems/HideSystem.ts`、`src/three/ThreeGame.ts`、`src/three/DebugDetailsPanel.ts`(若需)、`tests/human-ai.test.mjs`、`tests/hide-system.test.mjs`、`docs/AI_HUMAN_STATE_TREE.md`、`docs/AI_STATE_OVERVIEW.md`。
- 不应改动：Human AI 的巡逻/调查/追逐/搜索/门决策主体、抓捕与胜负、感知距离与遮挡、DeepSeek AI 的找米/逃跑/关门/锁门。
- 自动化测试（预计 ≥ 12 项）：三条触发源各自可进入 `CHECK_HIDE` 并正确结束；无线索时**不会**检查（防透视回归）；`occupancyOf` 不出现在 AI 输入结构里（类型/结构断言）；每次搜索检查次数上限；命中时强制退出且位置不变；空检查不产生状态变化；检查期间 AI 不移动；`SEARCH` 结束后回到 PATROL；DEV/AI 事件计数一致。
- 人工验收：选 Human → 在实验室般场景中观察 AI 分别因「目击进入 / 搜索 / 听到声音」来查柜子；DeepSeek 提前离开则检查落空；玩家自己检查命中时能立刻进入抓捕。

## 5. S7C-3：出生点与局部门状态随机化（含随机种子复现）

> **本轮（S7C-0 补充轮）不实施**——用户明确「不做随机布局」；本节仅作后续规划，须另行授权后再动 `DoorSystem` 与出生点。

**目标**：每局不再固定「DeepSeek 出生=玄关、Human 出生=厨房、18 门全 CLOSED」。

- 交付内容：
  1. `src/systems/MatchRandom.ts`：确定性种子 RNG（如 mulberry32）+ 种子来源（`Date.now()` 或 DEV/URL 指定值）。
  2. **门初始状态随机**：允许 `{OPEN, CLOSED}` 组合；**不得改** `DoorNode.initialState` 常量，改为 `DoorSystem` 接受运行时初始状态（构造参数或 `applyInitialStates()`），并且 `PerceptionSystem` 仍以运行时 `DoorSystem.doors` 为准。
  3. **出生点随机**：候选出生点集合 + 约束（两者可站立、不同房间、间距 ≥ 阈值、互相可达、且所有 Active Rice 从 DeepSeek 出生点可达、所有房间从 Human 出生点可达）。
  4. **校验器（纯逻辑，可单测）**：每局生成后跑一次连通性/可达性/安全校验；不通过则有界重抽（例如最多 20 次），仍失败则回退到当前 `SPAWNS` 默认值。
  5. 随机源统一：`selectRiceCandidates(random)` 也接同一个种子（当前 `ThreeGame.ts:281` 用的是默认 `Math.random`）。
  6. DEV 面板新增 `match-setup` 字段（seed、两个出生点、门初始状态摘要、校验结果）；AI JSON 导出新增 `matchSeed` 与初始设置摘要（便于复现问题）。
- 涉及系统/文件：`src/systems/MatchRandom.ts`(新)、`src/three/map/apartmentMap.ts`（出生点候选集/默认值）、`src/systems/DoorSystem.ts`（运行时初始状态入口）、`src/three/ThreeGame.ts`（局初始化与 reset）、`src/three/map/MapBuilder.ts`（调试标记改为运行时出生点或明确标注为「参考出生点」）、`tests/match-random.test.mjs`(新)、`tests/door-system.test.mjs`、`tests/apartment-map.test.mjs`、`docs/GAME_BALANCE_CONFIG.md`、`docs/MAP_SPEC.md`。
- 不应改动：门玩法规则与冷却、锁位上限、地图几何/家具/米点坐标、AI 决策。
- 自动化测试（预计 ≥ 8 项）：同种子 100% 复现（门状态 / 出生点 / 米堆集合全等）；不同种子产生差异；200 个种子全部通过连通性、出生点可站立、不同房间、间距、米堆可达、藏身锚点可达校验；校验失败时回退默认值；`DoorSystem.reset()` 回到**本局**初始状态而不是常量；`PerceptionSystem` 与运行时门状态一致（关门口阻挡视线）。
- 人工验收：同一 seed 连续重开两次，DEV 显示的出生点/门状态/米堆完全一致；换 seed 后明显不同；随机化后仍能从两个出生点跑到所有房间且无卡死。

### 5.1 顺序是否调整？

用户给定的顺序是 1 → 2 → 3。本次审计**没有发现必须打乱顺序的证据**：

- S7C-3 只影响「局初始化」，不改藏身点的几何与判定；藏身锚点可达性只要在 S7C-3 的校验器里加上即可。
- 反过来若先做 S7C-3，会把 `DoorSystem`/出生点的初始化改动提前引入，S7C-1/2 的测试反而要依赖未稳定的初始状态。

**建议保持 1 → 2 → 3**，只在 S7C-3 里额外加「藏身锚点可达」这一条校验。唯一可能需要插入的是第 6 节第 1 条（DeepSeek AI 藏身）；若纳入，建议作为 **S7C-2b**（在 S7C-2 之后、S7C-3 之前），因为它是 AI 行为，依赖 S7C-2 的检查机制与被发现后的处理。

---

## 6. 需要用户确认的机制与参数（**本阶段未写入任何数值**）

> **状态（2026-09-25 决策定案轮）**：第 2 行已由 S7C-1A 落地；第 19–21 行已定案。**第 3–14 行属于 S7C-1B，仍为待用户单独确认的建议值，批准前不生效**——表中存在建议值不等于已实施或已验收。第 1 行属 S7C-2b、第 15–18 行属 S7C-3，均未授权。

| # | 议题 | 建议方案 | 备选 / 影响 |
|---|---|---|---|
| 1 | DeepSeek **AI** 主动藏身是否纳入 S7C？ | 纳入，作为 S7C-2b：仅在 EVADE 且藏身点就在逃跑路线上、且无有效目视时考虑 | 不纳入 → 玩家选 Human 时藏身玩法不可见（S7C-2 的玩家检查没有对象） |
| 2 | 藏身点数据扩展（anchor/kind/furnitureId/朝向） | 按**表 3.1** 的 6 个锚点（+1 备选）落地，并加自动校验（可站立、导航格可用、距门 ≥ 2.0、距米 ≥ 1.2） | 「床底」按第 20 条处理；真正钻床需改床碰撞 |
| 3 | 交互键与优先级 | 继续用 `E`；优先级：扫雷面板 > 门 > 藏身点 > 进食 | 也可给藏身单独键（如 `Q`），但会与锁门冲突 |
| 4 | 进入/退出耗时 | 站定 `400 ms`（复用 `rice.prepareMs`），移动即取消；退出立即生效 | 更长进入时间会削弱藏身 |
| 5 | 进入前置安全条件 | `captureProgressMs === 0` 且与 Human 距离 ≥ `1.5`（复用 `doorEscapeMinHumanDistance`） | 也可另设独立参数（如 1.0 / 2.0），需用户拍板 |
| 6 | 交互距离（**按到锚点的距离判定**） | `1.0`（复用 `rice.interactionRange`）+ 锚点容差 `0.3` | 或 `1.3`（复用 `door.interactionRange`） |
| 7 | 隐藏期间限制 | 禁止移动/冲刺/进食/发脚步声/留米痕；不可被普通抓捕 | 是否允许「探头观察」新动作 → 建议不做，避免新增动作接口 |
| 8 | 隐藏中是否完全免疫抓捕 | 建议：完全不计入 Capture 判定 | 备选：贴身仍可抓捕（藏身价值大减） |
| 9 | 被发现（check 命中）后果 | 强制退出、位置不变、无眩晕、无额外惩罚 | 可加 `stunMs`（建议 0，避免新平衡杠杆） |
| 10 | Human **玩家**检查参数 | 按住 `E`，耗时 `900 ms`（复用 `humanAI.searchDwellMs`），移动/受击中断 | 更长＝藏身更强 |
| 11 | Human **AI** 检查参数 | 耗时 `900 ms`；每次 `SEARCH` 最多 1 处；单点冷却 `6,000 ms`；目击记忆 `8,000 ms`（复用 `perception.lastSeenMs`） | 更长/更多 → AI 更强；建议先按此保守值 |
| 12 | 藏身音效 | 建议新增 `HIDE_ENTER / HIDE_EXIT` 声音事件（range/strength 待定），或先复用 `DOOR_OPEN / DOOR_CLOSE` | 复用可零新增参数，但语义不准 |
| 13 | 表现方案 | V1（视觉进柜、根节点不动） | V2 最保守；V3 最省事 |
| 14 | 是否记录到 AI JSON / DEV | 建议：DEV 新增 `Hide` 分类；AI JSON 加 `HIDE_*` 事件与 `matchSeed` | 也可只做 DEV |
| 15 | 门初始状态随机范围 | 建议默认**关闭随机**（保持现状全 CLOSED），DEV 开关启用；或允许 `{OPEN,CLOSED}` 但限制被随机为 OPEN 的门数上限 | 全随机可能明显改变追逐手感，需人工重新验收 |
| 16 | 出生点随机约束 | 候选集 + 不同房间 + 间距 ≥ `10` 世界单位 + 双向可达 + 米堆可达 | 间距过小＝开局即遭遇 |
| 17 | 种子来源与复现 | `Date.now()` 为默认；DEV/URL 可指定；DEV 与 AI JSON 展示 seed | 无 seed 无法复现问题 |
| 18 | 随机化对既有验收的影响 | S7C-3 完成后需重新人工验收「开局手感/追逐节奏」 | 需求确认：是否接受重新验收 |
| 19 | 是否新增纸箱白模 | **已确认：加 2 个**（`living_carton (7.9, 3.9)` + `storage_carton (15.7, -4.8)`），只加数据、零新代码 | 用户指定 `storage_carton` 原为 (15.7, -2.6)，因压住 `rice_08` 被复核否决，z 修正为 -4.8（§3.2） |
| 20 | 「床底」语义 | **已确认：床边锚点 + 仅表现层**（判定与碰撞完全不变）；1A 只登记两张床与其床边锚点，**不改床的实心碰撞** | 真正钻床需把床碰撞改成「床框 + 空洞」，须另提专项设计单独批准 |
| 21 | 本轮是否只做 1A | **已确认：只做 1A**（数据/白模/校验，不接入玩法），浏览器验收后再批 1B | 1B 仍未授权 |

---

## 7. 推荐首先开发的最小闭环及验收方法

**推荐先做 S7C-1A（藏身点白模与地图配置，不接入玩法），验收后再批 S7C-1B（玩家基础藏身交互）**。理由：1A 只动地图数据与校验测试，完全不碰按键、状态、抓捕与 AI，风险最低；1B 依赖 1A 的锚点数据；之后再考虑 S7C-2 / S7C-2b / S7C-3。

- **S7C-1A 数据与校验**（**已按本行执行完成**）：`HideSpot` 扩展（kind/furnitureId/facing，`x/z` 即锚点）+ 表 3.1 的 6 条数据（`second_cabinet` 未采纳）+ 2 个纸箱白模数据 + 锚点/不变量自动校验测试。**未接入玩法**（与 S7B-3B 的 3B-0/3B-0b「接口与决策分离」做法一致）。
- **S7C-1B 逻辑与判定**：`HideSystem` + `E` 仲裁 + 移动/冲刺/进食/抓捕门控 + `VisionSystem` 隐藏入口 + `HideSpotView`（V1/V2/V3 之一）+ DEV `Hide` 分类。
- S7C-2 / 2b / 3：**本轮明确不做**（用户已写明：暂不开发 Human AI 检查或随机布局）。

**验收方法（自动化）**：`npm test`（基线 333，只增不减）+ `npx tsc --noEmit`（或 `npm run build`）+ `git diff --check`；新增测试覆盖 §3.4 / §3.5 的清单。
**验收方法（人工）**：1A 用 §3.4 的调试标记与跑图检查；1B 用 §3.5 的 9 条浏览器步骤，重点确认「隐藏中不可被抓捕」「人类 AI 不再追来且不刷新 Last Seen」「退出后一切恢复正常」三项。

---

## 8. 本次审计执行过的命令与结果（可复核）

| 命令 / 检查 | 结果 |
|---|---|
| `git status -sb` | `## main...origin/main`；仅 `?? .dsh-meow/`、`?? .trae/` |
| `git rev-parse HEAD` | `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5` |
| `git log --oneline -5` | `6a92c5d` → `ca18f61` → `9da38c0` → `4f40bb0` → `7061b33` |
| `.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` | 全部 `False`（无未完成 Git 操作） |
| `npm test` | 333 tests / 333 pass / 0 fail / 0 skipped，退出码 0 |
| `npx tsc --noEmit` | 退出码 0 |
| 第一轮：藏身点锚点实测脚本（`%TEMP%` 临时文件，已删除） | 5 个占位点均不可站立；宽松锚点与 A* 结果见 §1.1 |
| 第二轮：家具清单 + 稳健锚点 + 纸箱不变量脚本（`%TEMP%` 临时文件，已删除） | 18 件家具全部 `fullyInRoom`；**无纸箱**；6+1 个候选锚点全部满足约束（表 3.1）；4 个纸箱候选**全部保持既有地图不变量**；无纸箱基线自检同样通过 |
| `docs/*.md` 全文检索 `CHECK_HIDE / 藏身 / HideSpot / 随机` | 与 §1.5 结论一致：仅类型预留 |

### 8.1 S7C-1A 落地轮的复核命令与结果（2026-09-25）

| 命令 / 检查 | 结果 |
|---|---|
| `git status -sb` / `git rev-parse HEAD` | `## main...origin/main`，HEAD 仍为 `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`；本轮**未 commit / push / tag** |
| `npm test` | **342 / 342 PASS**（基线 333 + `tests/hide-spot.test.mjs` 新增 9），fail 0 / skipped 0，退出码 0 |
| `node --experimental-strip-types --test tests/hide-spot.test.mjs` | 9 / 9 PASS |
| `npx tsc --noEmit` | 退出码 0 |
| `npm run build` | 退出码 0（`cmd /c` 复核 `$LASTEXITCODE`；Vite >500 kB 仍为非阻断提示） |
| `git diff --check` | 退出码 0（仅 LF→CRLF 提示，仓库既有行为） |
| 临时复核脚本（仓库根目录 `verify-hide.tmp.mjs`，**用完已删除、未入库**） | ①用户指定的 `storage_carton (15.7, -2.6)` → `rice_08` 严格判定被压住（`strictly free: false`）；②修正后 8 个锚点的「可站立 / 距家具 / 距门 / 距米 / 导航格 / 两出生点 A*」全部通过；③加纸箱前后「仍可站立格」连通性对比只减不裂（无孤立格）；④既有地图不变量（房间/米点/出生点/门前后 1 个角色直径）**ALL HOLD** |

**S7C-0 审计轮本次未做**：未跑 `npm run build`（无构建产物需求）；未启动浏览器开发服务器；未修改任何生产代码或 `GAME_CONFIG`；未 commit / push / tag；未触碰 `.trae/`、`.dsh-meow/`。

### 8.2 S7C-1A 决策定案轮的命令与结果（2026-09-25 22:43 +08:00）

| 命令 / 检查 | 结果 |
|---|---|
| `git status --short` | ` M docs/AGENT_LOG.md`、` M docs/MAP_SPEC.md`、` M src/three/map/MapBuilder.ts`、` M src/three/map/apartmentMap.ts`；`?? .dsh-meow/`、`?? .trae/`、`?? docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`?? tests/hide-spot.test.mjs`——与 S7C-1A 落地轮结束时**完全一致**，本轮未新增任何源码 / 测试改动 |
| `git rev-parse HEAD` / `git rev-list --left-right --count origin/main...HEAD` | `6a92c5ddf9629389bedcd49930e9a29dfb6e50d5`；`0 0` |
| `npm test` | **342 / 342 PASS**（fail 0 / skipped 0，suites 0 / todo 0），退出码 0 |
| `git diff --check` | 退出码 0（仅 LF→CRLF 提示，仓库既有行为）。注意 `docs/S7C_HIDE_RANDOMIZATION_DESIGN.md` 仍是**未跟踪**文件，不在 `git diff` 覆盖范围，故另做全文检索自检 |
| 文档措辞自检（检索「若要更宽松」「若要更干净」「等浏览器验收时决定」） | 规范性正文 **0 命中**；仅有的命中是本轮 §8.2 与 `docs/AGENT_LOG.md` 记录「做过这次自检」时引用的字符串本身（不计入）；四项决定的关键词各命中一次 |
| `npm run build` | **本轮未跑**：纯文档轮，且 `vite build` 会重写被 Git 忽略的 `dist/`；源码未变，§8.1 的构建结果仍然有效 |
