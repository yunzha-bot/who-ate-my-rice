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

### 3.4 S7C-1A：藏身点白模与地图配置 —— **已实现，用户浏览器人工验收 PASS（2026-09-26）、阶段 Gate = PASS，已并入稳定检查点 `3191bec` 并推送 `origin/main`**

- **目标**：把「可藏身的位置」变成地图里真实存在、可校验的数据；**不接入任何玩法**（按键、状态、抓捕都不变）。
- 已交付内容：
  1. `HideSpot` 数据结构（`kind / furnitureId / facing / label`，`x/z` 即唯一锚点）+ **8 条**数据（6 件现有家具 + 2 个新纸箱），见 `src/three/map/apartmentMap.ts`。
  2. 2 条纸箱 `FURNITURE` 数据（`living_carton (7.9, 3.9)`、`storage_carton (15.7, -4.8)`，均 0.9×0.9×0.75）——复用 `MapBuilder.addObstacle` 的白模 + 静态碰撞，**零 Three.js 新代码、无正式美术**。
  3. `DEBUG_MAP` 下的藏身点调试标记改为「中文名 + 藏身点 ID」+「类型 (锚点 x, z)」两行精灵 + 锚点地面小方块（`MapBuilder.markerLines`）。非 DEBUG 时 `hideSpotDebugMarkers(false)` 返回空数组，普通玩家视图拿不到任何藏身点信息。
  4. 新增 `tests/hide-spot.test.mjs`（9 项）：ID/房间/类型/家具绑定/朝向唯一且完整、`facing` 与「锚点→家具中心」一致、锚点在房间内且可站立、距家具 ≥ 0.05、距最近门段 ≥ 2.0、距最近米点 ≥ 1.2、距可用导航格心 ≤ 0.45、两出生点均 A* 可达、纸箱只此两个且不与其他盒子重叠、纸箱不压门/门前后点/米点、加纸箱前后的可达格连通性、以及「非 DEBUG 不产生标记」。
- 涉及文件：`src/three/map/apartmentMap.ts`、`src/three/map/MapBuilder.ts`、`tests/hide-spot.test.mjs`（新）、`docs/MAP_SPEC.md`、本文件、`docs/AGENT_LOG.md`。
- **未改动**（逐条核对）：门/锁/冲刺/米堆/抓捕/感知的任何规则与数值、两套 AI 决策、`GAME_CONFIG`；除 `MapBuilder` 的调试标记外，没有任何系统读取藏身点数据。
- 自动化结果（2026-09-25）：`npm test` **342/342 PASS**（基线 333 + 新增 9）；`npm run build`（含 `tsc --noEmit`）退出码 0；`git diff --check` 退出码 0。
- 浏览器人工验收（**2026-09-26 用户确认 PASS**）：`DEBUG_MAP` 下能看到 8 处「中文名 + ID + 类型 + 坐标」标记与 8 个锚点地面方块；8 个锚点都在家具旁的开阔地、不贴墙、不压门、不压米点；新增纸箱可见且不挡路、不挡门。用户本轮五项结果中的第 4、5 项即对应本节（「八个藏身点的列表选择和遮挡点聚焦」「两个纸箱通行、家具编辑后的碰撞同步」）。**阶段 Gate = PASS，已并入稳定检查点 `3191bec`（`feat: complete s7c-1a hide spots and dev scene editor v1`，24 个文件，+3976/−71）并推送 `origin/main`。**
- **遗留观察与用户决定（2026-09-25 决策定案，用户已确认 ①–④）**：
  - **实测事实（保留）**：`hide_main_wardrobe (-16.65, -6.60)` 与 `hide_closet (-3.57, -8.80)` 的锚点在角色圆（半径 0.23）之外只剩 **0.030 / 0.025 u** 余量（其余 6 个为 0.070–0.220）；`living_carton (7.9, 3.9)` 距客厅东墙与南墙各 **0.56 u**，其东侧与南侧各剩一条约 **0.10 u** 宽的角色圆心通道（可挤过但很窄；该角落无米点、无门）。
  - **① 接受 `storage_carton` 由 z = -2.6 改到 z = -4.8**：原位置纸箱 AABB 到米点 `rice_08 (16.1, -3.3)` 只有 **0.250**（< `PLAYER_DIAMETER/2` = 0.2667），被真实地图测试判定压住该米点；修正有明确测试依据，且不影响通路（证据见 §3.2 / §8.1）。
  - **② 两个衣柜锚点先不改**（用户理由原话）：「虽然余量偏小，但 1B 是『靠近锚点即可交互』，并不是要求角色圆心必须精确踩在点上。先浏览器走一遍，真觉得别扭再微调，避免为了理论余量来回改坐标。」
  - **③ `living_carton` 先保持现位置**（用户理由原话）：「它虽然靠角落比较紧，但当前测试显示不挡门、不挡米、不破坏连通性。先看实机视觉效果再决定要不要贴到更里面。」
  - **④ `hide_closet` 暂时不改名**（用户理由原话）：「这个 ID 已经存在过，稳定 ID 比命名整齐更重要。」
  - **备选值（未采纳，仅备查）**：衣柜锚点 `(-16.60, -6.40)` / `(-3.40, -8.80)`；`living_carton` 平移到墙角 `(8.46, 4.46)`。如浏览器实机观感确有别扭，再由用户单独提出一轮坐标微调，本轮不主动改；任何坐标改动都必须重跑 `tests/hide-spot.test.mjs`、`tests/apartment-map.test.mjs` 与全量 `npm test`。

### 3.5 S7C-1B：玩家基础藏身交互

- **实现与验收状态（2026-09-26：用户浏览器人工验收 6/6 通过，并随本轮提交归档）**：S7C-1B 按用户当轮批准完成「DeepSeek 娘藏身 vs Human 玩家主动搜查与抓捕」：
  1. **取消原方案的 ENTERING 长按计时**——E 为按下边沿触发，立即完成合法性检查与 `OUTSIDE ⇄ CONCEALED` 切换，没有 400 ms 进入耗时。
  2. **没有新增独立的 Human 距离门槛**：进入前置只要求 `captureProgressMs === 0`、非冲刺/眩晕、由人工控制 DeepSeek，且当前真实站位落在某个藏身点的**精确交互区域**内（复用 `checkHideRegionPosition`：区域成员 + 真实碰撞可站立 + 家具可接近表面无遮挡 + 落在真实导航格上）。
  3. **交互距离不再是「到 anchor ≤ 1.0」**（第 6 节第 6 行）：判定改用 DEV-A 已落地的 `HideSpot.interactionRegion` 精确区域；**单一 anchor 语义不变**（进入 = 退出），仍不拆分成两个点。
  4. **Human 玩家 Q**：半径 1.5、张角 120°（半角 60°）、12 秒冷却（`GAME_CONFIG.humanSearch`，未命中同样消耗冷却）。释放瞬间只判定一次，藏身目标必须命中其绑定家具的**可接近表面**且不被墙/非 OPEN 门叶挡住；命中即 `GameStateSystem.forceCapture()` 立即抓捕成功。判定核心 `evaluateHumanSearch()`（`src/systems/HumanSearchSkill.ts`）与按键、冷却、Three.js 特效分离，供未来 S7C-2 的 Human AI 复用——**本轮不实现 AI 的 CHECK_HIDE 决策或寻路**。
  5. **DeepSeek 玩家 Q 锁门**：只有 `DoorSystem.lock()` 返回 `LOCKED` 才开始 20 秒冷却（`GAME_CONFIG.door.playerLockCooldownMs`），失败不消耗；AI 锁门走 `lockDoorFromCommand`，**不读**该冷却。
  6. **表现**：藏身时隐藏角色可视体（根节点不动，碰撞与抓捕锚点不变，判定与表现分离），另有 `HideSearchView` 扇形特效与命中家具的临时高亮；**未新增藏身音效**（既不新增 `SoundType`，也不在藏身期间产生新声音）。
  7. **DEV / 日志**：DEV 新增 `Hide / 藏身` 分类（状态、藏身点、真实进入位置、当前区域检查码、最近拒绝/退出原因、本局次数、视觉与抓捕影响、两个 Q 的冷却与最近命中）；AI JSON 新增独立 `hideEvents` 时间线（`formatVersion` 升为 `1.2`），人工控制 DeepSeek 时同样可导出。
  8. **地图应用预检**：编辑器在 `session.apply()` 之前先验证「两个角色站位 + 藏身出口」在新地图上仍可站立，失败则拒绝应用并保留旧地图与旧藏身状态。
 9. **Human AI 的 `CHECK_HIDE` 与米痕循迹**：已由 S7C-2 一次性完整实现（见 §4），`CHECK_HIDE` 不再是预留接口。
- **历史前置（已被 S7C-1B 授权取代）**：原说明为「**S7C-1B 未获授权**」，开工前需用户对第 6 节第 3–14 行的建议值逐条确认（进入耗时、与 Human 的安全距离、交互距离、表现方案 V1/V2/V3、是否新增 `HIDE_ENTER/EXIT` 事件与 DEV `Hide` 分类）。**该逐条确认已被 2026-09-26 的 S7C-1B 完整授权与本节的实现状态取代**；第 3–14 行的逐项去向见第 6 节状态说明。另：DEV-A 的圆形／扇形藏身交互区域已在 DEV-A 第一轮按用户指定参数落地为地图创作数据（`HideSpot.interactionRegion`，见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`），**本轮正式接入玩法**（作为藏身合法性判定）；**是否把进入锚点与退出锚点拆成两个独立点，留到未来单独决定**（DEV-A 的专属开工要求见 `docs/DEEPSEEK_HANDOFF.md`「待批准提案与专属开工要求」节）。床底的表现与感知规则见下方第 8 条。
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


## 4. S7C-2：Human AI 米痕循迹与家具搜查（`CHECK_HIDE`）

> **状态（2026-09-26）：用户已一次性批准完整方案，本轮已实现，等待用户集中做一次浏览器人工验收；尚未 commit / push / tag，Gate 未建立。**
>
> **实现红线（全部遵守）**：不新增第二套交互 / 感知 / 导航系统；`CHECK_HIDE` 只使用公开线索；不读取 `HideSystem.occupancyOf()`、真实藏身点 ID、隐藏时实时坐标或占用状态；不新增米痕实体或永久脚印系统；不改 Human 玩家 Q 的 1.5 / 120° / 12 秒，也不改 DeepSeek 玩家 Q 的 20 秒锁门冷却；不改已验收的巡逻 / 调查 / 追逐 / 抓捕 / 门决策 / DeepSeek AI；不新增藏身音效。

### 4.1 交付内容（按用户 2026-09-26 简报逐条）

1. **米痕感知适配与三层数据分离**（`src/systems/RiceTraceClues.ts`，新增，纯逻辑）
   - 图层 A＝世界中全部有效米痕；图层 B＝`selectVisibleTraces()` 用**现有正式视觉几何**（`PerceptionGeometry.inspectVision`：视觉距离 + 墙体 + 非 OPEN 门叶）过滤出的「真正看得见」；图层 C＝`RiceTraceClueMemory` 保存的**有限线索快照**。
   - **只有 C 进入循迹决策**。线索快照只含 `traceId / position / heading / createdAt / discoveredAt / validUntil`，其中 `validUntil = createdAt + 实体自己的 lifetimeMs`，**记忆寿命绝不长于原实体**，过期即失效并从推断中消失。
   - 家具目前不参与正式视觉遮挡，因此这里也**不做**家具遮挡，也没有修改全局视觉规则。
   - 结构上不存在对手坐标：`TracePerceptionInput` 只有「观察者自己的位置 + 世界米痕 + 视觉几何」，无 `player` / `opponent` / `occupancy` 字段（`tests/rice-trace-clues.test.mjs` 做源码级断言）。
2. **规则型循迹与方向推断**（`src/systems/HumanTraceTracking.ts`，新增，纯逻辑）
   - 用真实 `createdAt` 定新旧、用真实空间连续性连接相邻脚印、再用脚印自带朝向修正方向；**无机器学习、无随机数**，同输入同输出。
   - 状态码 `NO_CLUE / SINGLE_TRACE / CHAIN / TRACE_JUMP / CHAIN_CONTRADICTORY` 与置信度 `NONE / LOW / MEDIUM / HIGH` 全部可解释：单粒米只给「低」并只说「只能调查附近」；更早的米痕跳跃过远降为 `TRACE_JUMP`；朝向与路径相差超过 90° 判 `CHAIN_CONTRADICTORY` 并降为「低」。
   - **轴向换算**：米痕实体的 `heading` 用 `atan2(dx, dz)`，搜查扇形用 `atan2(dz, dx)`，模块内用 `traceHeadingToDirectionRad()` 显式换算（`θ = π/2 − heading`），否则一条直线路径会被误判成「方向矛盾」。
3. **公开家具候选与反作弊排序**（`src/systems/HideSearchCandidates.ts`，新增，纯逻辑）
   - 候选只来自：当前已应用地图的公开藏身点 ID 与绑定家具（位置 / 朝向 / 尺寸）、已知 Last Seen、自己发现的米痕、实际收到的声音、自己的搜查失败历史。**输入结构里没有占用信息**，所以「某件家具真的有人」不可能提高它的排序。
   - 排序＝`−1×距 AI 距离 −2×距线索锚点距离 + 终止加分 + 方向对齐加分 + Last Seen 加分 + 声音加分`，同分比距离、再比稳定 ID，完全确定。
   - 「痕迹在家具附近终止」直接复用 DEV-A 已批准的 `pointInHideRegion` 公开交互区域判定，不新建第二套「附近」规则。
   - `gateHideSearchByClues()`：**一粒米不足以锁定家具**——`SINGLE_TRACE` 必须再有一条独立公开线索（Last Seen 或实际听到的声音）落进某件家具的公开交互区域才允许正式搜查；`CHAIN_CONTRADICTORY` 直接拒绝。
4. **Human 搜查站位规划**（`src/systems/HumanHideSearchStance.ts`，新增，纯逻辑）
   - 复用 `rectSurfacePoint` / `localToWorld` / `REGION_NAV_SNAP_LIMIT`，但判定是 Human 自己的：① 角色圆碰撞合法；② 落在真实导航格上（吸附 ≤ 0.45）且 A* 可达；③ 与**家具可搜查表面**（不是家具中心）的距离 ≤ 1.5；④ 朝向落在前方 120° 扇形内；⑤ 墙与非 OPEN 门叶不遮挡这条交互线。旋转家具使用真实旋转轮廓。
   - 站位间距 `STANCE_STAND_OFF = 0.3`，按周长每 0.4（＝寻路格边长）采样候选，按直线距离从近到远最多跑 4 次 A*。
5. **正式搜查的公开几何核心**（`src/systems/HumanSearchSkill.ts`，扩展）
   - 抽出 `evaluateHumanSearchGeometry()`（距离 / 张角 / 遮挡）与状态码；`evaluateHumanSearch()` 改为走同一条核心，**玩家 Q 与 AI 搜查共用同一套几何**，不存在两份实现。玩家 Q 的瞬时命中、12 秒冷却与扇形特效**未改动**。
6. **`HumanAIController` 增量扩展**（不重建状态机）
   - 公开优先级：① 当前真实目视目标（并立即中止搜查）② 新 Last Seen ③ 新**强危险声音**（复用现有 `isHumanPursuitSound` 分类，可立即中止搜查）④ 新发现且仍有效的米痕 ⑤ 普通声音与旧调查 ⑥ 家具搜查与既有有限搜索 ⑦ 巡逻。
   - `CHECK_HIDE` 成为真实状态：`TRAVEL → DWELL（900 ms，AI 不移动，只由 `faceHeadingRad` 保持朝向）→ DONE`，停留满之后**只请求一次**正式判定，等外部回执。
   - 计数上限：每轮最多正式检查 **1** 件家具（`hideCheckMaxPerRound`）；同一件家具搜空后 **6 秒**（`hideCheckFailureCooldownMs`）内不再检查；同一次调查最多检查 `searchRoomCount`（3）件，且整次调查的搜查动作共享既有的 `searchMaxMs`（15 秒）预算；**同一批米痕的签名只能触发一次**（防止反复重启同一轮）。
   - 有限搜索联动：`SEARCH` 到达的搜索房间里若有公开藏身点，这一轮可以转去检查它；搜空后回到同一次搜索的剩余房间，**不会在同一轮连查第二件**。
   - 明确的结束路径：`NO_CLUE / NO_CANDIDATE / ALL_CANDIDATES_COOLED / NO_LEGAL_STANCE / CANDIDATES_UNREACHABLE / ROUND_BUDGET_USED / CLUE_TOO_WEAK / TARGET_VISIBLE / DANGER_SOUND / CHECK_TIMEOUT / NO_ROUTE / MANUAL_CONTROL / MAP_REBUILT / CHECK_DONE`，最终都回到既有 `SEARCH` / `PATROL`。
   - 生命周期：`reset()` 清空线索、推断、候选、失败冷却与计数；`resumeAfterManualControl()` 中止半途搜查；`rebindMap()` 换地图后作废旧家具候选并在真正换图时清空线索；冻结 / 暂停期间 `update()` 不被调用，因此停留、冷却与线索有效期都不推进。
7. **正式搜查结算的分层接缝**（`ThreeGame.runHumanAiHideCheck()`）
   - 只有在「到达合法站位 + 朝向正确 + 900 ms 停留」之后才读取权威占用：`concealed && 真实藏身家具 === 正在检查的家具` 时，用 S7C-1B 的 `evaluateHumanSearch()` 判定，命中即 `releaseHide('SEARCHED')` + `GameStateSystem.forceCapture()`（同一条结算路径）。
   - 回执给 AI 的**只有一个布尔值**（`onCheckHideResult(spotId, hit)`，函数 arity 为 2）；搜空不修改藏身状态、不泄露真实坐标；开发者真值只显示在 DEV 面板。
   - Human AI 的搜查**不继承**玩家 Q 的 12 秒冷却。
8. **DEV-B 只读观察 + DEV 可视化 + AI JSON**
   - `DevBHumanHideSearch` 明确分三段：`clue*`＝AI 已知、`inference*` / `candidate*`＝AI 推断、其余为开发者真值；`human-ai` 分区新增 17 条观察项（线索数量与过期、推断方向与依据、怀疑家具与公开排序、搜查站位 / 表面、停留进度、本轮与本次调查已检查数量、失败记忆与剩余冷却、最近结果、放弃原因、次数统计、信息归属说明与 DEV 图例）。
   - DEV 新增可视化开关 `clues`：绿＝AI 已知米痕线索、青＝AI 推断方向与锚点、洋红＝AI 推断的怀疑家具；绘制对象只创建一次，且排在声音标记之前（既有「最后 N 个子对象＝声音标记」的断言仍成立）。
   - AI JSON 新增独立 `humanSearchEvents` 时间线，`formatVersion` 升为 **1.3**（`HIDE_*` 事件与旧字段全部保留）；事件只在真实变化时写入，不逐帧刷屏。
   - 普通 Human HUD **不显示**隐藏者真实位置、真实藏身家具或占用数据：人类 AI 的搜查结果只写 DEV 字段，绝不写玩家可见的 `hideNotice`。
9. **内部技术阈值集中定义**（`src/systems/HumanSearchTuning.ts`，新增）
   - 只放实现细节、不放玩法平衡值；每一条都由现有源码真实数值推导并在注释里写明依据，`S7C2_INTERNAL_THRESHOLDS` 汇总供报告与复核。

### 4.2 实际新增 / 修改的数值（全部来自用户本轮批准或从既有值推导）

| 来源 | 项 | 值 | 说明 |
|---|---|---:|---|
| 用户批准 | `humanAI.hideCheckFailureCooldownMs` | 6,000 ms | 同一家具搜空后的再次检查冷却 |
| 用户批准 | `humanAI.hideCheckMaxPerRound` | 1 件 | 每轮最多正式检查的家具数 |
| 用户批准（复用） | `humanSearch.range` / `halfAngleDeg` | 1.5 u / 60° | 与玩家 Q 完全相同的扇形 |
| 用户批准（复用） | `humanAI.searchDwellMs` | 900 ms | 正式搜查停留 |
| 用户批准（复用） | `perception.lastSeenMs` / `traceLifetimeMs` | 8,000 / 15,000 ms | 未改动 |
| 推导 | `TRACE_LINK_DISTANCE` | 3.9 u | `traceStepDistance 0.65 × 6`，小于 `searchRadius` 的三分之一 |
| 推导 | `TRACE_CHAIN_MAX_CLUES` / `TRACE_DIRECTION_CONTRADICTION_DEG` | 8 条 / 90° | 推断只用最近 8 粒；超过直角判矛盾 |
| 推导 | `CLUE_MEMORY_MAX` | 160 条 | 覆盖 15 秒寿命内极速移动的理论最大脚印数（约 142） |
| 推导 | `STANCE_SURFACE_STEP` / `STANCE_STAND_OFF` / `STANCE_MAX_PATH_PROBES` | 0.4 u / 0.3 u / **8 次** | 采样步长复用寻路格；间距大于角色半径且小于 1.2 最小区域半径；A* 调用上限（现行源码为 8；早期草稿写的 4 已在 2026-09-26 修复轮按源码更正） |
| 推导 | `CANDIDATE_TRY_LIMIT` 与 6 个评分权重 | 3 与 1/2/6/4/3/2 | 候选尝试数复用 `searchRoomCount`；权重见模块注释 |

### 4.3 未实现 / 已知限制（本轮明确不做）

- **不做** DeepSeek AI 自主藏身（S7C-2b）、地图出生点与门状态随机化（S7C-3）、JSON 导入器、正式家具开门 / 掀箱动画、新增藏身音效、永久脚印系统。
- 家具仍不参与视觉与搜查遮挡（沿用既有全局规则）；`Last Seen` 仍按 8 秒自然过期。
- Human AI 的候选排序只保证「只用公开线索、可复算、确定」；它不是最优搜索策略，也没有跨局学习。

### 4.4 自动化与浏览器复核（2026-09-26 本轮实测）

- `npm test` **565 / 565 PASS**（基线 518 + 新增 47：`rice-trace-clues` 7、`human-trace-tracking` 9、`hide-search-candidates` 7、`human-hide-search-stance` 5、`human-search-tuning` 4、`human-ai-check-hide` 14，以及 DEV-B 可视化新增 1）；`npx tsc --noEmit` 退出码 0；`npm run build` 退出码 0（JS 898.20 kB / gzip 241.55 kB、CSS 13.68 kB，仅既知 >500 kB 提示）；`git diff --check` 退出码 0。
- 变异验证：临时把「900 ms 停留」与「线索强度门槛」改回缺陷版本，对应用例确实失败，复原后全绿。
- 真实浏览器复核（本机 Chrome headless + CDP，复用 `http://127.0.0.1:5173/`）：控制台除既知 favicon 404 外 0 错误；可进入 PLAYING；DEV-B 面板 5 个分区 74 条观察项、7 个可视化开关（含新增 `clues`）；新增的 S7C-2 字段在开局全部显示通俗的「没有数据」文案；DEV `Hide / 藏身` 分类的 S7C-2 字段与「开发者真值」字段都正常渲染；Human AI 仍按既有逻辑 `PATROL → CHASE → CAPTURE` 正常运行。**浏览器里未能脚本化复现「吃到米 → 留下米痕 → AI 亲自看见 → 产生家具怀疑」的完整链路**：脚本控制的 DeepSeek 在全部门初始关闭时需要手动开门，4 次尝试都在约 6 秒内被抓捕，属于玩法过程限制而非实现缺陷；该链路由上面 14 项真实地图控制器集成测试与 33 项纯逻辑测试覆盖，仍需用户人工验收。

## 4.5 S7C-2 修复轮（2026-09-26，基于真实 AI 日志与 Codex 二次审计，**待用户集中人工复验**）

> 本轮不重新规划 S7C-2，也不新增任何正式数值（`GAME_CONFIG` 与已验收平衡值零改动）；只修复真实日志暴露的判定与执行问题、补齐真实游戏层桥接测试、可见反馈与结构化日志。用户要求一次性交付、验收前不 commit / push / tag。

### 4.5.1 修复的问题与现行行为

| # | 真实日志暴露的问题 | 现行行为（修复后） |
|---|---|---|
| 1 | 米痕已被记住，但当帧被追逐 / 正式搜查占用时，该批线索**永不重评**（`considerTraceClue()` 依赖「本帧是否发现新米痕」） | `considerPublicClues()` + `actOnPublicClues()`：触发条件是「存在已知但尚未用于发起任务的公开线索」（`actedTraceIds` 整集替换，规模受 `CLUE_MEMORY_MAX` 约束）。被高优先级状态延后的批次以公开摘要保留数量与**原实体有效期**（`createdAt + lifetimeMs`，进队列不续期）；目标不再可见、无紧急危险、不处于 `CHECK_HIDE` 时重评；全部过期给 `CLUE_EXPIRED`。已处理的同一批线索不再重复触发任务或导航 |
| 2 | 有限 SEARCH 刻意排除 Last Seen 所在房间，**从不考虑最后目击房间自己的藏身家具** | 新增公开门槛 `gateLastSeenRoomSearch()`（Last Seen 有效 + 落在真实房间内 + 该房间确有公开藏身点），在相邻房间搜索**之前**先考虑同房间候选；不成立时按原规则退回。来源码 `LAST_SEEN_ROOM`、转移原因 `LAST_SEEN_ROOM_HIDE_SUSPECT`。**每轮仍最多正式检查 1 件家具**：同房间与相邻房间共用同一轮配额（`beginSearch(input, continueRound = true)`），两条分支不能绕过上限 |
| 3 | TRACE 来源搜空后只转 `PATROL`，没有完整收尾，留下僵尸调查状态 | 新增 `finishCheckHideAction()`：清相位 / 目标家具 / 站位 / 停留 / 回执等待 / 有限搜索房间队列，并记 `checkHideInvestigationEndReason`。**刻意保留本次调查**（否则「同一次调查最多 3 件」会被一串新米痕绕过）；计数语义拆为 `checkHideRoundAttempts`（已开始的尝试，配额守卫）与 `checkHideRoundChecks` / `checkHideInvestigationChecks`（**正式执行**才消耗） |
| 4 | 规划保存的表面点与正式判定重新计算的「最近表面点」不一致，家具边角 / 旋转家具旁会出现「计划合法却判定 MISS」 | 正式判定改用规划保存的 `stance.surfacePoint`（`noteCheckHideResolution()` 单向登记计划瞄点与最终判定点）；执行前用 `pointOnRectSurface()` 复核该点仍属于**当前已应用地图**的目标家具，家具被移动 / 旋转 / 删除时 `cancelStaleCheckHide()` 取消（不记搜空、不进冷却、配额归还）并合法重规划。1.5 u / 120° / 墙门遮挡一项未放宽，玩家 Q 未改动 |
| 5 | 玩家分不清「在附近调查」与「真的在检查某件家具」 | `HideSearchView` 新增独立的 AI 扇形 + 家具轮廓（暖橙），`CHECK_HIDE.DWELL` 期间点亮、离开时中性收尾脉冲；Human 角色走既有 `INTERACT` 动作。**纯表现**：不参与判定、不触发玩家 Q 冷却、只画 AI 自己公开的目标家具 |
| 6 | 日志缺少判断失败所需的状态信息 | `DevBHumanHideSearch` 新增 20 余项公开字段；DEV `human-ai` 新增 8 条属性；AI JSON `humanSearchEvents` 每个事件新增结构化 `data`（状态 / 前一状态 / 调查来源 / Last Seen 公开信息 / 待处理线索 / 候选与排序 / 站位与瞄点 / 结果 / 打断声音 / 计数），`formatVersion` 升为 **1.4** |

### 4.5.2 分层与反作弊边界（修复轮加强）

- 两段过去直接写在 `ThreeGame` 里的接线抽成 `src/systems/HumanHideSearchResolution.ts`：`createHumanAiMapSnapshot()` 是公开世界快照的**唯一构造点**（三条几何接缝必须真的接线，缺省即拒绝），`resolveHumanAiHideCheck()` 是正式判定的**权威层**（先复核计划仍属于当前地图 → 再算公开几何 → 最后才读权威占用）。
- 回执给 AI 的仍然只有 `hit: boolean`（`onCheckHideResult` arity = 2）；权威层的细粒度原因（例如「这件家具里确实有人但扇形被门挡住」）只进 `ThreeGame` 的 DEV 字段，**不进入 AI 控制器字段、不进入玩家可见 `hideNotice`**。
- AI 侧的结构化日志只收公开安全字段；延后与重评机制只使用公开线索记忆与其公开有效期，不读占用、不读隐藏坐标、不新建第二套脚印系统。

### 4.5.3 自动化与浏览器复核（本轮实测）

- `npm test` **587 / 587 PASS**（基线 565 + 新增 22：`human-hide-search-resolution` 8、`human-ai-search-lifecycle` 10、`hide-search-view-ai` 3，以及 `human-ai-check-hide` 拆分新增 1）；`npx tsc --noEmit` 0；`npm run build` 0（JS 924.60 kB / gzip 248.34 kB、CSS 13.68 kB）；`git diff --check` 0。
- 变异验证 4 次（每次都确认对应用例确实失败后复原）：关闭延后重评 / 禁用同房间分支 / 正式判定改用最近表面点 / 去掉搜空收尾，分别命中 1、5、2、1 项测试。
- 真实浏览器复核：脚本用真实按键让 DeepSeek 娘在客厅纸箱成功藏身 → Human AI 失去视线产生 Last Seen（`living`）→ **`HUMAN_LAST_SEEN_ROOM` 门槛 `OK`** → 来源 `LAST_SEEN_ROOM` → `TRAVEL → DWELL(900 ms)` → 正式判定 `HIT_CONCEALED`（计划瞄点 = 最终判定点），本轮计数 `1 / 1（上限 1）/ 1`；导出的 AI JSON `formatVersion = 1.4`。复核期间用 DEV-B 内存覆盖降低 AI 移速与抓捕圈以便观察（不改正式配置）。

## 4.6 S7C-2 第二轮修复轮（2026-09-26，Human 玩家 Q 家具交互 + Human AI 正式站位与结算，**待用户集中人工复验**）

> 本轮不重新规划 S7C-2、不新增任何正式数值（`GAME_CONFIG` 与已验收平衡值零改动）；只修用户本轮批准的 A–E 五项：玩家 Q 的家具交互规则、Human AI 导航终点与正式站位统一、类型化解析与计数、公开几何先于权威占用、以及真实执行链测试 / 浏览器复核 / 文档。验收前不 commit / push / tag。

### 4.6.1 Human 玩家 Q 的两种互斥用途（现行规则）

| 情形 | 行为 |
|---|---|
| 玩家站在某件公开藏身家具的**合法交互区域内** | 该家具出现**白色呼吸描边**（本条自 §4.7 起被取代：现在还需要「玩家朝向对着该家具」且「当帧没有合法暴露目标」；描边的**几何与透明度区间**又由 §4.8 更新为「真实家具棱线轮廓 + 0.35–1.0」，见 §4.7.1 / §4.8.2） |
| 在该区域内按 Q（且 Q 可用） | 本次 Q **只搜查这件家具**：① 当帧唯一「合法 + 被指向」家具 → ② 该藏身点与家具仍属于当前已应用地图 → ③ 玩家确实位于合法交互区域 → ④ 与家具之间没有墙或非 OPEN 门叶 → ⑤ 上述全部通过才**惰性读取一次**权威占用。命中即 `releaseHide('SEARCHED')` + `forceCapture()`；合法搜空进入既有 12 秒冷却 |
| Q 在 12 秒冷却中 | 直接拒绝：不搜查、不抓捕、**不产生新的冷却**；仍显示家具但描边压暗到 0.14 且不呼吸，HUD 写「冷却中 X 秒（家具描边变暗，暂时不能按）」 |
| 不在任何家具交互区域内（或没有「合法 + 被指向」的家具） | 沿用原有普通扇形角色抓捕（半径 1.5、张角 120°、墙门遮挡、瞬时抓捕、薄荷色扇形特效；命中与否都消耗同一份冷却）；**当帧存在合法暴露目标时也走这一支，且优先于家具搜查**（§4.7.1） |
| 区域成员成立但站位不合法（隔墙 / 站不住 / 无导航格） | **不亮高亮**、不作为家具目标；按 Q 回退普通扇形 |

- 公开目标解析的唯一实现是 `src/systems/HideTargetResolution.ts` 的 `resolveHideInteractionTarget()`：真实交互区域 + 真实碰撞可站立 + 家具表面无墙门遮挡 + 真实导航格；按藏身点数组顺序取「到锚点距离最小」（严格 `<`，距离相同保留先出现者），**只用公开数据、确定性、不按占用排序**。DeepSeek 玩家按 E 藏身与 Human 玩家按 Q 搜查共用它，但**不共享**阵营状态、技能消耗或占用信息。**Human 玩家 Q 一侧另传 `pointing`（§4.7.1）；DeepSeek 玩家 E 不传，因此 E 的藏身选择仍然不需要面向家具。**
- 输入优先级由 `resolvePlayerQPlan()` 单点定义（**§4.7 起为 `REJECT_COOLDOWN / FAN(EXPOSED_TARGET) / FURNITURE / FAN(NO_TARGET)` 四分支**）；`ThreeGame.useSkillQ()` 的 Human 分支只按它的结果分流，且目标来自**按键当帧**重新解析，绝不复用上一帧的高亮。
- `HideSearchView.setPlayerTarget()` 与 Human AI 的暖橙搜查反馈是两套独立网格与独立状态；高亮只表示「这件家具现在可以交互」，**与里面有没有人无关**，也不读、不推断、不暴露占用。

### 4.6.2 Human AI 的导航终点与正式站位（本次修复的核心）

| # | 真实日志暴露的问题 | 现行行为（修复后） |
|---|---|---|
| 1 | 规划给出原始 `stancePoint`，A* 吸附到导航网格点，控制器**按吸附点判到站**，权威层**按原始点判站位**——两个中心最多差 `REGION_NAV_SNAP_LIMIT`（0.45 u），于是「DWELL 满 900 ms → REQUEST → STANCE_LOST」反复出现 | 导航网格点**仍只作寻路节点**；到达导航终点后进入新增的**最终接近**（`HumanAIController.finalApproach()`），在真实 `CollisionWorld` 下继续合法走向原始 `stancePoint`（不穿墙 / 不穿家具 / 不穿关闭的门，不重跑 A*，不瞬移）。「能否进入 `DWELL`」改由 `resolveHumanAiHideCheck` 同款谓词 `evaluateHideStance()` 判定，容差仍是既有 `humanAI.waypointTolerance + collision.contactEpsilon`，**未放宽任何容差**。卡住时沿用既有 `stuckRepathMs` / `stuckProgressEpsilon` 有界收尾（`CHECK_HIDE_STANCE_UNREACHABLE`），且**不退还**本轮家具配额 |
| 2 | `STANCE_LOST` / `PLAN_STALE` / `OUT_OF_RANGE` / `OUTSIDE_FAN` / `BLOCKED` 被当作普通 `MISS` 记进公开失败记忆与 6 秒冷却 | `HumanHideCheckCode` 新增 `HEADING_LOST`；以上六码统一为**未完成合法检查**（导出常量 `HUMAN_HIDE_CHECK_INCOMPLETE_CODES`），`executable = false`、`cancelKind = 'INCOMPLETE'`：不记搜空、不进 6 秒冷却、不写公开失败记忆；只有 `MISS_EMPTY` / `HIT_CONCEALED` 才 `countsAsFormalCheck = true` |
| 3 | 「真正完成的正式检查」计数在发出 REQUEST 时就消耗，等于把未完成的检查算成正式检查 | 计数改由游戏层回执消耗（`noteCheckHideResolution({ countsAsFormalCheck })`）；REQUEST 只记 `checkHideRequestCount`（每动作只允许 1 次）。新增 `cancelIncompleteCheckHide()`（保留尝试配额，防反复取消绕过「每轮最多 1 件」）与有界的 `cancelStaleCheckHide()`（只有地图变化才退还配额，上限 `STANCE_MAX_STALE_CANCELS = 2`） |
| 4 | 权威占用在公开几何之前就被读取（先判断「这件家具里是不是藏着对方」再看几何） | `resolveHumanAiHideCheck()` 的输入改为惰性 `readOccupancy()`，顺序固定为「计划仍属于当前地图 → 站位 → 朝向 → 1.5 u / 120° / 墙门遮挡 → 才读一次权威占用」；公开几何任何一条不成立时**权威占用查询次数为零** |
| 5 | 家具搜查命中会在同一帧结束对局，导致该帧的 REQUEST / RESOLVE / HIT 与 `HIDE_EXIT` 永远不写进 AI JSON | `match.result` 置位处补一次 `recordHideEvents()` + `recordHumanSearchEvents()` 冲写；修复后同一场景的 JSON 含完整 12 条事件链 |

### 4.6.3 测试与浏览器复核（本轮实测）

- `npm test` **613 / 613 PASS**（基线 587 + 新增 26：`hide-target-resolution` 5、`human-furniture-search` 10、`human-ai-stance-approach` 7、`hide-search-view-player-target` 3、`ai-log-collector` 1）；`npx tsc --noEmit` 0；`npm run build` 0（JS 942.50 kB / gzip 252.78 kB、CSS 13.68 kB）；`git diff --check` 0。
- 走图测试器械：新增 `tests/human-ai-walk.mjs`，按 `ThreeGame.updatePlaying()` 同口径推进（AI 出方向 → 真实 `CollisionWorld.move()` 位移 → 门 / 解锁指令交给真实 `DoorSystem`），因此「走完一次搜查」不再靠瞬移到吸附点冒充真实导航。
- 变异验证 5 次（每次都确认对应用例确实失败后复原）：① 「到导航吸附点即算到站」→ 7 项失败；② 未完成检查重新 `executable` → 2 项失败；③ 权威占用读取放回公开几何之前 → 1 项失败（`occupancyReads === 0`）；④ 正式检查计数搬回 REQUEST → 4 项失败；⑤ 玩家家具搜查改成「瞄家具中心 + 1.5 u 距离门槛」→ 4 项失败。
- **真实浏览器复核（次卧床，用户此前三次失败的场景）**：DeepSeek 玩家真实走图（玄关 → 书房 → 次卧，两个门用 E 真实开启）→ 在 `hide_second_bed` 合法位置藏身 → Human AI 失去视线产生 Last Seen（房间 `second_bedroom`）→ `HUMAN_LAST_SEEN_ROOM` 门槛 `OK` → `LAST_SEEN_ROOM` → `TRAVEL → DWELL（到达规划站位偏差 0.234）→ REQUEST（只一次）→ HIT_CONCEALED`（计划瞄点 = 最终判定点 = (−14.1, 9.8)，距离 0.53、偏差 −1.1°，站位 / 朝向均成立，权威层读取真实藏身点、计入正式检查）→ `CAPTURE`，对局 00:41 结束。该次 `navGoal = (−14.6, 9.6)` 与规划站位相距 **0.308 u > waypointTolerance 0.25**，正是旧实现会判 `STANCE_LOST` 的错位。**玩家 Q 家具交互**：进入储物间纸箱的合法交互区域 → 白色呼吸描边 + 「Q 搜查「储物间纸箱」」→ 转身背对后按 Q 仍搜空成功（`MISS_EMPTY`、权威占用读取：是）→ 12 秒冷却且描边压暗 → 冷却中再按被拒绝。证据见 `docs/verification/S7C-2-r2/`。
- **明确 BLOCKED（不得记为 PASS）**：① 「玩家 Q 从藏有 DeepSeek 娘的家具里搜出对方」无法在浏览器复现（本局只有人工控制的 DeepSeek 娘会藏身，玩家不能同时控制两个阵营；AI 自主藏身属未授权的 S7C-2b），只有真实地图自动化证据；② 「两个交互区域重叠」在真实地图上不存在（8 个区域两两不重叠，0.1 网格全图扫描确认），重叠行为用「真实几何 + 移动家具构造的重叠」验证。

## 4.7 S7C-2 第三轮修复轮（2026-09-26，Human 玩家 Q 改为「暴露目标优先，其次指向家具」，**待用户集中人工复验**）

> 起因（用户本轮简报原话要点）：Human 玩家在追逐暴露的 DeepSeek 娘时**可能路过某件家具的交互区域**，上一版「附近有家具就优先搜查」会抢占本来要用的普通扇形抓捕。本轮只做最小增量修复：改 Human **玩家** Q 的目标解析、白色高亮与对应提示；**不重新实施 S7C-2**、不重写 Human AI 搜查 / 米痕 / Last Seen，**不新增任何正式数值**（`GAME_CONFIG` 零改动），验收前不 commit / push / tag。

### 4.7.1 Human 玩家 Q 的输入优先级（现行唯一规则）

| 顺序 | 条件 | 行为 |
|---|---|---|
| ① | Q 在 12 秒冷却中 | 直接拒绝：不搜查、不抓捕、不产生新冷却 |
| ② | Q 可用，且**当帧存在合法暴露目标**（**未藏身**的 DeepSeek 娘位于 1.5 世界单位、120° 扇形内，且无墙 / 非 OPEN 门叶遮挡） | 执行**原有普通扇形角色抓捕**。即使玩家同时站在某件家具的合法交互区域内、并正对着它，也**不得**转为家具搜查 |
| ③ | 没有暴露目标，且当帧存在**合法 + 被指向**的家具 | 本次 Q **只搜查这一件家具**：当帧唯一目标 → 仍在当前地图 → 合法交互区域 → 无墙门遮挡 → 才惰性读取一次权威占用。命中即 `releaseHide('SEARCHED')` + `forceCapture()`；搜空也消耗同一份 12 秒冷却 |
| ④ | 都没有 | 原有普通扇形空挥，同样消耗冷却 |

- **指向条件**：`pointsAtFurniture()` 只比较**角度**——玩家朝向 vs「家具可接近表面点」方向（`furnitureApproachSurfacePoint()`，与 AI 站位、家具搜查同一个公开几何助手），容差**直接复用已批准的普通扇形半角** `GAME_CONFIG.humanSearch.halfAngleDeg`（±60°），**不新增数值**。它只用于**选中家具**，不做距离判定、不做遮挡判定、不参与命中几何；家具搜查本身仍然不做 1.5 u / 120° 判定（`resolveHumanFurnitureSearch()` 的输入里没有任何朝向 / 距离 / 张角参数，测试以源码断言把守）。
- **暴露目标预检测**：`HumanSearchSkill.probeExposedFanTarget()` 直接调用**正式的** `evaluateHumanSearch()`，因此「预检测说能抓到」与「真正执行抓到」用的是同一帧同一套几何；它**绝对无副作用**（不显示特效、不消耗冷却、不写日志、不释放藏身、不产生抓捕事件）。**藏身目标即使几何命中也不算暴露目标**（`available = false`），因此它不会抢占家具搜查——藏身者只能通过「指向它所在家具 + 按 Q」被搜出。
- **高亮与提示同源**：白色呼吸描边、HUD 文案与 Q 的实际目标全部来自**同一次** `playerQTargetResolution()` 结果里的 `pointedLegalTarget`（高亮与技能层都禁止退回 `legalTarget`，测试以源码断言把守）。当帧存在合法暴露目标时，家具**仍画出但压暗、不呼吸**，HUD 改回普通扇形文案——**绝不给出「可以搜家具」的误导性提示**。冷却中同样不给「Q 可用」暗示。
- **DEV 与日志**：`hide/hide-search-target` 增列「合法 / 指向 / 指向偏差 / 暴露目标优先」；AI JSON 的 `playerSearchEvents`（`formatVersion` 仍为 **1.5**，只扩字段不换结构）新增：`reason`（`COOLDOWN / EXPOSED_TARGET / FURNITURE / NO_TARGET`）、`pointed`、`pointingDeltaDeg`、`exposedTargetAvailable / exposedCode / exposedDistance / exposedAngleDeltaDeg / exposedBlocked`；普通扇形分支现在也记 `PLAYER_Q_FAN_HIT` / `PLAYER_Q_FAN_MISS`（此前只有家具分支有事件），因此「这一按抓了人还是搜了家具」在日志里是可直接核对的一行。
- **未改动**：Human AI 的正式搜查链（公开线索 → 导航 → 合法站位 → 900 ms 停留 → 权威结算）、E 藏身交互、普通扇形抓捕的 1.5 / 120° / 墙门遮挡、DeepSeek 玩家 Q 锁门、S7C-1B 与两轮既有修复。

### 4.7.2 测试与浏览器复核（本轮实测）

- `npm test` **622 / 622 PASS**（基线 613 + 新增 9：`tests/player-q-priority.test.mjs` 逐条覆盖用户简报 §四 的 1–9 项；`hide-target-resolution` 与 `human-furniture-search` 同步到新语义，属于**同步**而非削弱）；`npx tsc --noEmit` 0；`npm run build` 0（JS 945.67 kB / gzip 253.60 kB、CSS 13.68 kB）；`git diff --check` 0。
- 变异验证 6 次（每次确认对应用例确实失败后复原）：① 把家具分支改回优先于暴露目标 → 4 项失败；② 去掉指向过滤（`pointed` 恒真）→ 5 项失败；③ 把藏身目标也算作「暴露目标」→ 1 项失败；④ 高亮退回 `legalTarget`（不再要求指向）→ 1 项失败；⑤ 高亮「可用」不再排除暴露目标优先 → 1 项失败；⑥ HUD 不再排除暴露目标优先 → 1 项失败。
- **真实浏览器复核（`docs/verification/S7C-2-r3/`，本机 Chrome headless + CDP）**：
  - **主卧床（用户本轮点名的场景）通过**：控制 Human 从厨房经 `door_living_kitchen(9,-6)` → `door_hall_living(-3,1)` → `door_hall_master(-8,-1.5)` 真实走到床边（DEV `hide/hide-search-region = LEGAL`）；**背对床** → `高亮 NONE（合法 否｜指向 否）`、HUD 回落到普通扇形文案、按 Q **家具搜查 0 次**（普通扇形未命中，冷却已起）；等 12 秒后**面向床** → `高亮 FURNITURE（hide_main_bed｜合法 是｜指向 是 45.0°）`、HUD「人类：Q 搜查「主卧床」（面向家具即可，不必精确瞄准）｜Q：可用」、白色呼吸描边可见（截图 `playerQBed-player-q-facing.png`）→ 按 Q 得到 `MISS_EMPTY`（家具 `main_bed`、瞄点 (−11.9,−5.2)、**权威占用读取：是**、家具搜查 1 次）→ 12 秒冷却 + 描边压暗 → 冷却中再按被拒绝（`搜查冷却中：剩 10.5 秒`，搜查次数仍为 1、AI JSON 无新事件）。
  - **储物间纸箱（同一套规则的第二个样本）通过**：同一脚本 `playerQ` 场景复现「背对不搜 / 面向只搜这一件 / 12 秒冷却 / 冷却中拒绝」，`pointingDeltaDeg = 29.4°`、`playerSearchEvents` 两条（`PLAYER_Q_FAN_MISS` + `PLAYER_Q_FURNITURE_MISS`）。
  - 复核期间只用 DEV-B **内存覆盖** `capture.radius = 0.05`（避免脚本走图时被普通抓捕提前结束对局）；不改正式配置、结束即弃。
  - **明确 BLOCKED（不得记为 PASS）**：**「玩家在区域内指向家具、同时有一个暴露的 DeepSeek 娘落在普通扇形里 → Q 抓人而不是搜家具」这一帧未能在真实浏览器里摆出。** 本轮共尝试 4 次真实复现，证据与原因全部留档：① 在客厅纸箱区域等 AI 自己走进交互区域（AI 的米堆路线全程停在西侧，最近 12.9 u，对局 01:52 由 AI 吃米获胜结束）；② 追赶到次卧床（脚本的直线走图器在门框角落反复卡住，且对局 02:24 结束）；③ 用真实 `FOOTSTEP`（半径 17 u）脚步声诱导 + 把 AI 减速到 40 px/s（AI 始终停留在西侧 12.9–25 u，从未靠近）；④ 在主卧床区域等 AI 巡视进来（两轮分别等了约 2 分钟，AI 最近只到 6.6 u 并转去衣帽间 `rice_10` / 卫生间 `rice_11` 吃米，对局分别在 01:57、02:20 由 AI 获胜结束）。该分支在**真实地图 + 真实扇形几何 + 真实交互区域**的自动化测试（`tests/player-q-priority.test.mjs` §四.1）里覆盖，并由用户人工验收确认。
  - 另需说明：真实地图上「玩家 Q 搜出藏在家具里的 DeepSeek 娘」仍然**只能**在人工控制 DeepSeek 娘藏身的局面里出现，而本场景两个阵营只由一方控制；该分支继续由真实地图自动化测试覆盖（与第二轮同因）。

## 4.8 S7C-2 第四轮修复轮（2026-09-26，白色家具轮廓「看不见」的可见性修复，**待用户视觉复验**）

> 起因（用户本轮人工验收结果原话）：六项里只有第 3 项「面向家具正常搜查」是 **FAIL**，并补充「玩法实际上都可以，唯一观察到的问题是**没有白色轮廓呼吸**」。用户明确要求：**不得因为第 3 项 FAIL 就擅自重写已经正常的玩家 Q 家具搜查逻辑**；本轮唯一目标是让「Q 可用 + 无合法暴露目标 + 玩家在合法交互区域内且正指向该家具」时，屏幕上出现**清晰可见的白色呼吸式家具外轮廓**，并在离开条件时立即消失；不新增玩法参数、不改 `GAME_CONFIG` 任何数值、不改 Human AI 的站位 / 900 ms 停留 / 类型化结算。

### 4.8.1 根因（只读定位 + 可复现证据）

| # | 根因 | 证据 |
|---|---|---|
| ①（主因） | `HideSearchView` 的根节点 `root` 被 `show()`（**普通扇形释放**）搬到玩家释放点并带上朝向（`root.position.set(origin.x, 0, origin.z)` + `root.rotation.y = …`），而挂在它下面的玩家高亮 / AI 扇形 / AI 轮廓 / 命中反馈传进来的都是**世界坐标** → 这些对象被**二次平移**。 | 真实 `three` + 真实 `HideSearchView` 探针（`node --experimental-strip-types`）：在 (-11.4,-5) 按过一次 Q 之后，`hide_main_bed` 中心 (-13,10) 的轮廓世界坐标变成 **(-25.43, 0.23, -13.49)**（期望 (-13, 0.225, 10)），偏差约 28 世界单位——已经跑到公寓之外；同时 DEV 行仍然显示「高亮 FURNITURE…合法 是｜指向 是」。 |
| ②（次因） | 旧实现画的是 `BoxGeometry` + `wireframe` 的**三角形线框盒**（每个面还带对角线），而且 `scale.y = height` 让顶面与家具顶面**完全共面**，产生深度冲突。 | 真机像素统计：修复前在正确位置也从未出现过「呼吸峰值接近纯白」的像素；修复后同一位置出现 116–176 个（床）/ 88 个（纸箱）这样的像素。 |
| ③（可见性余量） | 呼吸透明度下限 0.25 在浅灰地面上对比偏弱。 | 修复后统计：呼吸最暗相位轮廓区平均亮度 162.6–185.9（底色约 116），最亮 243–245，振幅 59.5–80.4。 |

### 4.8.2 修复内容（`src/three/HideSearchView.ts`，纯表现层）

1. **根节点恒为单位变换**：扇形自己携带位移与朝向——`fan.position` 取释放点、`fan.quaternion = Ry(headingRadToMeshRotationY(朝向)) · Rx(−90°)`，与旧实现的**世界矩阵逐值相同**（矩阵对比最大误差 `2.2e-16`，测试对 3×3 旋转元素逐一断言），但不再污染同级的世界坐标对象。AI 扇形 / AI 轮廓 / 命中反馈因此一并回到正确位置（同一个根因）。
2. **白色高亮改为真实家具棱线轮廓**：`EdgesGeometry(单位立方体)` 的 12 条棱（24 个顶点）+ `LineBasicMaterial`，用**与家具网格相同的中心 / 朝向**、三轴各外扩 `HIDE_PLAYER_TARGET_MARGIN = 0.08` 的缩放贴合家具外缘。既不是「家具中心悬浮的白色圆圈」，也不涂白家具本体、不遮挡家具材质。
3. **呼吸透明度区间 0.25–0.8 → 0.35–1.0**（周期仍 1,400 ms），冷却期仍压到 `0.14`，「可交互 / 冷却中」一眼可分。全部是**表现层常量**，不新增玩法数值、`GAME_CONFIG` 零改动。
4. **无每帧分配**：几何与材质构造时创建一次并长期复用，每帧只改 `scale / position / rotation / opacity`（测试断言连续 120 帧后 `geometry.uuid` 与 `material.uuid` 不变），切家具 / 重开 / 换图只清理可见性与透明度，场景里始终只有一个白色高亮对象。

### 4.8.3 测试与浏览器复核（本轮实测）

- `npm test` **625 / 625 PASS**（基线 622 + 新增 3：`tests/hide-search-view-player-target.test.mjs` 新增「Q 释放之后高亮仍在世界坐标上」与「棱线轮廓 + 几何复用 + 单实例」两项，`tests/hide-search-view-ai.test.mjs` 新增「AI 轮廓同样落在真实家具世界坐标上」）；`npx tsc --noEmit` 0；`npm run build` 0（JS 947.26 kB / gzip 254.15 kB、CSS 13.68 kB）；`git diff --check` 0。
- `tests/hide-search-view.test.mjs` 的「扇形放置」断言由 `root.position/rotation` 同步到 `fan.position` + 世界朝向（**同步**：世界矩阵已被证明与旧实现等价，断言强度未降低、测试未删除）。
- **真实浏览器复核（`docs/verification/S7C-2-r4/`，本机 Chrome headless + CDP，脚本 `browser-check.mjs`）**：同一脚本先按「走图 → 背对按一次 Q（旧缺陷正是在这一步搬走根节点）→ 等 12 秒冷却 → 面向家具」复现整条链路，再**在同一相机、同一站位**下每 ≈250 ms 截一帧共 14 帧，在 Node 里解码 PNG，用「呼吸峰值接近纯白 + 明暗振幅 ≥40 + 中性」筛出轮廓像素并统计：

| 场景 | 轮廓像素 | 屏幕区域 | 呼吸最暗 → 最亮（轮廓区平均亮度） | 冷却中 | 判定 |
|---|---|---|---|---|---|
| 主卧床（修复后） | 176 | 184×116 px | 185.9 → 245.4（振幅 59.5） | 163.9（明显更暗） | **PASS** |
| 储物间纸箱（修复后） | 88 | 81×50 px | 162.6 → 243.0（振幅 80.4） | 129.5（明显更暗） | **PASS** |
| 主卧床（**把根节点位移缺陷临时改回去**的对照） | **0** | — | — | — | **FAIL**（DEV 仍显示「高亮 FURNITURE｜合法 是｜指向 是」、HUD 仍显示「Q：可用」，但屏幕上没有任何呼吸轮廓） |

  - 留证：`after-bed-zoom-breath-min/max/cooldown.png`、`after-carton-zoom-*.png`（6 倍放大裁剪，肉眼可直接对比呼吸相位与冷却压暗）、`after-*-summary.json`（全部采样数值）、`before-bed-no-outline-facing.png`（对照组「有提示、无轮廓」的整帧）、`after-*-log.txt`（含控制台）。
  - 复核期间只用 DEV-B **内存覆盖** `capture.radius = 0.05` 与 `movement.playerSpeed = 30`（避免脚本走图被抓、避免 AI 在测量期间吃满米结束对局）；不改正式配置、结束即弃。
  - 控制台只有既有的 `THREE.Clock` 弃用告警与 favicon 404，0 页面异常。

### 4.8.4 本轮局限（不得写成 PASS）

- 「背对家具 → 无轮廓」**没有**做像素级对照：背对是靠真实走位转身，相机随之平移，整屏都会变化，用同一相机像素差无法成立。该状态仍以 DEV 读数（`高亮 NONE（合法 否｜指向 否）`）+ 真实地图自动化测试为证据（§4.7.2 已留档）。
- 「玩家指向家具 + 未藏身暴露目标同帧」仍然 BLOCKED（原因与 4 次尝试见 §4.7.2），本轮未触及该分支的判定逻辑。
- 修复只覆盖 Human **玩家** Q 的白色高亮；Human AI 的暖橙轮廓保持原实现（只随根节点修复回到正确位置，其颜色 / 透明度 / 触发时机未改）。

## 4.9 S7C-2 最终规则与集中人工验收（2026-09-27）

本节补记 S7C-2 后续集中验收，不改写 §4.6–§4.8 的逐轮历史。第三轮面向家具时缺少可见白色轮廓的失败记录仍保留；第四轮修复了轮廓可见性。用户随后确认最终集中人工验收全部通过，当前工作区源码已实现，Git 归档仍待单独授权。

### Human 玩家 Q：抓捕与单件家具搜查

1. Q 可用时，先按原规则检查未藏身的 DeepSeek 娘：距离不超过 `GAME_CONFIG.humanSearch.range`（1.5 世界单位）、在 120° 扇形内且未被墙或非 OPEN 门遮挡；若命中则执行普通抓捕。
2. 没有合法暴露目标时，只有当 Human 位于一件家具的公开合法交互区域内并面向该家具，才可用 Q 搜查该唯一家具。此家具分支不再对家具或隐藏者套用普通抓捕扇形，也不读取隐藏者位置。
3. 其余可用 Q 输入执行普通扇形空挥。有效 Q 的命中与未命中均进入既有 12 秒冷却；冷却中拒绝新输入。白色轮廓和提示只指向与当帧 Q 目标一致的家具。

### DP 娘：指向反馈与 E 交互

人工控制 DP 娘只保留最近一次有效世界 XZ 移动朝向；停步不改变朝向。面向合法家具时显示单一白色轮廓，家具视觉半角复用 `GAME_CONFIG.humanSearch.halfAngleDeg`（±60°）；面向 RiceField 当前最近未完成目标且处于合法进食范围内时显示米堆轮廓，纯视觉半角为 `DEEPSEEK_RICE_VISUAL_HALF_ANGLE_DEG`（±45°）。家具与米堆同时满足几何时，先遵守既有 E 仲裁，再显示唯一可执行目标。门或退出藏身拥有 E 时不显示其他目标。

E 的玩法判定未因指向提示改变：扫雷面板开启时 E 归扫雷；藏身中 E 只用于退出；否则在门与米堆同时存在时，距离不大于米堆距离的门优先，其后依次是合法藏身和进食。面向要求仅影响轮廓，不是家具藏身条件。进食仍要求在 1.0 世界单位范围内静止并持续按住 E；白色轮廓不改进食速度、米痕或胜负规则。轮廓只读公开家具 / RiceView 表现数据，不读取家具占用或 AI 私有状态。

### Human AI 正式搜查边界

Human AI 只依据公开米痕、Last Seen、声音和有限搜索生成家具候选，导航至合法站位、朝向家具表面并停留 900 ms 后才申请正式判定。`PLAN_STALE`、`STANCE_LOST`、`HEADING_LOST` 及其他非法几何拒绝不算搜空、不触发同家具 6 秒失败冷却，也不消耗正式检查额度；只有几何合法的 `MISS_EMPTY` 会记录搜空和冷却。公开几何通过后才惰性读取指定家具的权威占用；AI 不可提前读取真实藏身家具。

米痕寿命为 15 秒、Last Seen 为 8 秒；延后线索与最后目击房间优先搜索规则继续有效。家具轮廓与 Human AI 暖橙色搜查反馈使用独立表现状态；本次玩家白色轮廓不会影响 Human AI 决策。

### 用户集中人工验收与本轮自动检查

| 验收项目 | 用户确认结果 |
|---|---|
| 第三轮：追逐时 Q 优先抓人 | 通过 |
| 第三轮：背对家具不误搜 | 通过 |
| 第三轮：面向家具时的白色轮廓 | 当轮未通过；第四轮修复后由用户复验通过 |
| 第三轮：家具内藏身者被搜出 | 通过 |
| 第三轮：Human AI 次卧床回归 | 通过 |
| 第三轮：其他机制回归 | 通过 |
| 集中视觉验收：Human 白色家具轮廓 | 通过 |
| 集中视觉验收：DP 娘家具轮廓 | 通过 |
| 集中视觉验收：DP 娘米堆轮廓 | 通过 |
| 集中视觉验收：家具 / 米堆交互重叠仲裁 | 通过 |
| 集中视觉验收：目标生命周期 | 通过 |

第三轮曾有一项视觉验收失败（面向家具时没有可见轮廓），该结果保留在历史记录；第四轮修复后，用户确认 Human 白色轮廓通过。自动化检查及构建以 `docs/AGENT_LOG.md` 本轮追加记录为准；详细逐轮证据见既有 `docs/verification/S7C-2-r2/`、`r3/`、`r4/` 产物。本节不代表 Git 提交或推送已经完成。

## 4.10 S7C-2b：AI 自主藏身、逃跑与人类威胁适应（**技术设计与任务拆分；未授权、未开始、无功能代码**）

> **状态（2026-09-27）**：本节**只是设计与任务拆分**，由用户在本轮明确要求「启动 S7C-2b 开发规划」，**不构成开工授权**。本轮没有落任何功能代码、没有改 `GAME_CONFIG`、没有改 S7C-2 已验收机制。按前置条件 2，开工前须由用户逐项批准 §4.10.9 的参数与 §4.10.10 的任务切片，并先确认 §4.10.2 的信息边界。
>
> **S7C-3（随机地图）不属于本节**，不得提前实现。

### 4.10.1 目标与最小可交付定义

让 **AI 控制的 DeepSeek 娘**在既有找米主线上具备：

1. 正常状态下继续执行现有寻找大米任务（**不改** GAME_CONFIG、不改选米评分与 `DropSeek` 主流程）；
2. 根据**合法可感知信息**发现人类威胁（复用现有 `assessThreat` 的 Vision / Sound / Last Seen 与 8 方向声音投影）；
3. 受到追逐时选择逃跑，**或**前往一个**合法**的家具藏身位置（AI 手里只有一个空手逃跑目标选择器 `selectEscapeGoal`）；
4. 到达藏身位置并满足**正式交互条件**后进入藏身状态（复用 `HideSystem` + `checkHideRegionPosition`，不新建第二套合法性判定）；
5. 依据**已批准的公开信息与有限状态条件**决定何时退出藏身；
6. **避免**原地反复进出、在多个藏身点之间无限循环、以及目标失效后卡住；
7. 与现有 Human AI 搜查规则**一致**，不读取玩家/人类才有权知道的隐藏信息。

一句话的「最小可交付版本」：**AI 在一次真实追逐中能躲进一件合法家具、停留一段时间、在威胁解除后自己出来继续吃米，且全程可被 DEV 面板与 AI JSON 复核。**

### 4.10.2 信息边界（必须先确认，决定整个设计是否成立）

**AI 可以读取（全部是公开或自身信息）**

| 信息 | 来源 |
|---|---|
| 自己真实位置 / 朝向 / 移动与卡路状态 | `DeepSeekAIInput.deepseek` + 现有 `trackPathProgress` |
| 当前真实目视的 Human 坐标 | `visibleHuman`（仅当前可见帧） |
| Human 当前连续静止时长与事件 ID | `humanStillMs` / `humanStillEventId`（仅可见帧） |
| 已听到的 Human 声音（含 8 方向投影） | `heardHuman` / `heardHumanDanger` |
| Human 的 Last Seen（8,000 ms 内） | `lastSeenHuman` |
| 门状态、米堆状态与进度、剩余锁位、抓捕进度、冲刺/眩晕状态 | 现有输入字段 |
| **当前已应用地图**的**公开**藏身点数据（id / 锚点 / `interactionRegion` / 绑定家具 id 与矩形） | 新增 `hideSpots` / `furniture` 字段，与 `HideSearchCandidates` 读的是同一份公开数据 |
| 自己是否在藏身、藏在哪个点、已藏多久、每点冷却与失败记忆 | `HideSystem` 的**自有**状态 + 控制器内部计数 |

**AI 绝对不能读取**

- **对手（Human/Human AI）的实时位置**，尤其是墙后、关门后的位置；关门外只能靠 `lastSeenHuman` / 声音 / 自己的几何推断（与现有「不透视」红线一致）。
- **`HideSystem.occupancyOf()`** 或任何「某个藏身点里有没有人」的信息；AI 侧输入结构里**不允许出现** `occupancy` / `concealedSpotId`（照 `tests/rice-trace-clues.test.mjs` 的做法用**源码级断言**把守）。
- Human AI 的私有决策状态（它怀疑哪件家具、它的候选排序、它是否正在来查自己）。
- **玩家专用的指向型白色轮廓**：`src/systems/DeepSeekVisualTarget.ts` 与 `HideSearchView` 的白色高亮，是「人工控制 DP 娘时的视觉提示」，**必须保持只读表现层**，不得被 NPC 决策系统引用或复制成「AI 的藏身点高亮」。同理不得把 `resolvePlayerQPlan` / `HideInteractionArbitration` 的**按键仲裁**搬进 AI 决策。
- Human 玩家的技能冷却、隐藏者真实坐标、以及任何只在 DEV 面板出现的「开发者真值」。

### 4.10.3 可复用系统（不新建第二套）

| 能力 | 复用对象 | 说明 |
|---|---|---|
| 藏身占用与状态机 | `src/systems/HideSystem.ts` | 唯一占用真相。**但现有 `enter()` 按设计拒绝非人工控制（`NOT_PLAYER_CONTROLLED`），必须新增一个受明确令牌保护的 AI 入口**，不能放宽玩家入口的校验。 |
| 藏身几何合法性 | `checkHideRegionPosition()` + `HideSpot.interactionRegion`（`src/three/map/HideInteractionRegion.ts`） | 区域成员（精确几何）+ 真实可站立 + 家具可接近表面无遮挡 + 真实导航格。禁止在 AI 侧重写一份。 |
| 寻路 | `NavigationSystem.findPath` / `nearestFree` | 仍只是「节点」；最终位移一律走 `CollisionWorld`，AI 不得瞬移（含藏身站位）。 |
| 感知 | `PerceptionSystem`（Vision / Sound / Last Seen / 米痕） | 不新增感知通道；声音仍只投影 8 方向。 |
| 抓捕与胜负 | `GameStateSystem.advancePlaying` / `forceCapture`、`isCaptureEligibleXZ` | 不新增胜负与抓捕规则；藏身只把资格门控为 false（现有写法见 `ThreeGame.ts` 的 `captureZoneActive`）。 |
| 威胁评估与逃跑 | `DeepSeekAIController.assessThreat` / `updateSafety` / `selectEscapeGoal` | 藏身作为逃跑策略的一个**并列选项**接入，不重写逃跑评分。 |
| 循环抑制先例 | `escapeVisitMemoryMs` / `escapeRecentVisitCount` / `escapeGoalHoldMs` / `escapeSwitchScoreMargin` / `stuckRepathMs` | 已有「近期访问惩罚 + 目标保持 + 切目标阈值 + 卡路重算」，藏身的选择与退出沿用同一套纪律，不新造第二套振荡抑制。 |
| DEV / 日志 | `DebugDetailsPanel` 的 `hide` 分类、`AILogCollector` 的 `hideEvents` 时间线 | 只加字段与事件种类，不新建第二套日志。 |
| 测试器械 | `tests/human-ai-walk.mjs` 的真实走图驱动 | 按 `ThreeGame.updatePlaying()` 同口径推进；S7C-2b 需要它的 DeepSeek 版。 |

### 4.10.4 需要新增的状态、转换与事件

**状态**：新增 `HIDE`，并**沿用 Human AI `CHECK_HIDE` 的相位写法**（单一状态 + 相位），避免把「走位 / 藏身 / 退出」拆成三个新的顶层状态：

```ts
export type DeepSeekAIState = ... | 'HIDE';
export type DeepSeekHidePhase = 'NONE' | 'TRAVEL' | 'CONCEALED' | 'EXIT';
```

理由：S7C-2 已经用 `HumanCheckHidePhase = 'NONE' | 'TRAVEL' | 'DWELL' | 'DONE'` 的写法把「一个状态 + 相位」跑通并验收，S7C-2b 沿用同构写法可以少一套状态、DEV 面板与日志也能对称。

**转换（新增部分，其余转移不变）**

| 从 | 到 | 条件（全部公开） |
|---|---|---|
| `EVADE` | `HIDE`（TRAVEL） | `selectHideSpot()` 返回合法候选 **且** 候选评分优于当前空手逃跑目标 |
| `EVADE` | `EVADE`（原逻辑） | 无合法候选 / 候选全在冷却 / 候选评分不占优 |
| `HIDE`(TRAVEL) | `HIDE`(CONCEALED) | 真实站位落在候选点的到达容差内 → 向游戏层发 `hideRequest` → 游戏层校验通过并回执 `ENTERED` |
| `HIDE`(TRAVEL) | `EVADE` | 真实危险（抓捕进度 > 0 / 眩晕 / 强危险声 / 安全距离失守）或候选失效（地图重建、家具移动） |
| `HIDE`(CONCEALED) | `HIDE`(EXIT) | 满足 §4.10.6 的退出条件（最短藏身时间 + 威胁解除 + 出口安全 + 有可达米路线 + 冷却） |
| `HIDE`(EXIT) | `RECOVER` | 游戏层回执 `EXITED` |
| `HIDE`(EXIT) | `CONCEALED` | 回执 `HUMAN_BLOCKING` / 出口不安全 → 退回藏身并按重查间隔重试 |

**事件**（写进现有 `hideEvents` 时间线与 DEV，不新建数组）：`HIDE_AI_REQUEST`（请求进入，带 spotId 与公开理由）、`HIDE_AI_ENTERED`、`HIDE_AI_REJECTED`（带拒绝码）、`HIDE_AI_EXIT_REQUEST`、`HIDE_AI_EXITED`（带退出原因）、`HIDE_AI_ABORT`（走位中止，带原因）、`HIDE_AI_SPOT_BLOCKED`（该点加入失败记忆）。事件只在真实变化时写入，不逐帧刷屏（沿用 S7C-2 纪律）。

### 4.10.5 导航与家具站位的合法性保证

**结论（必须先说清）**：藏身点的**锚点本身不保证在导航格上**——已验收的 `hide_main_wardrobe (-16.65, -6.60)` 距衣柜中心 1.33 u、区域半径 1.60 u，而「贴衣柜窄面 (−0.30) + `STANCE_STAND_OFF 0.3` = 衣柜中心 +0.60」这类点落在**家具 AABB 内部**，不可站立。因此 AI **不能**用「朝家具中心走」这种几何最终接近（那是 Human AI 站在家具外侧、有 1.5 u 扇形时才成立的技巧）。

**AI 的合法藏身位置集合** =

1. 落在该藏身点 `interactionRegion` 的**精确几何**内（`pointInHideRegion`）；
2. 该点**本身可站立**（`CollisionWorld.canOccupyStaticXZ`）。这一步顺带排除「家具内部」与「墙里」；
3. `navigation.nearestFree(point, doorStates)` 返回的格心距该点 **≤ `REGION_NAV_SNAP_LIMIT`(0.45)** —— 与既有 `checkHideRegionPosition` 同一条判定；
4. 从当前位置 **A\* 可达**；
5. 交互线（该点 → `furnitureApproachSurfacePoint`）无墙、无其他家具、无非 OPEN 门叶遮挡。

**关键简化（降低风险与测试成本）**：AI **只在「格心」上藏身**，也就是把候选点直接取成 `nearestFree` 返回的导航格心（再验证它仍在区域内）。这样 A* 终点就是真实可行走点，**完全不需要 `HumanAIController.finalApproach()` 那种容差走位**，也不会出现 S7C-2 修复过的「网格点与原始点最多差 0.45 u → 反复 STANCE_LOST」。代价是 AI 的站位精度被网格（0.4 u）量化，对「藏身」语义无影响。

**进入条件（游戏层权威校验，AI 不能自证）**：AI 只发「请求进入 spot X」，真正的 `enterAsAI()` 由游戏层用**本帧真实位置**复核第 1–5 条后才写入占用；任何一条不成立就回执拒绝码，AI 加失败记忆并回到 `EVADE`。这条**与 S7C-1B 的玩家 E 路径共用同一个几何内核**，区别只有两点：AI 不需要按键、AI 不需要「面向家具」（`resolvePlayerQPlan` 的 `pointed` 只服务玩家高亮，与 AI 无关）。

### 4.10.6 退出条件与「不卡住、不振荡、不无限循环」的具体机制

**退出条件（全部成立才退出；任一条不成立就留在藏身状态，并按 `hideRecheckMs` 重查）**

1. 已藏身时长 ≥ `hideMinConcealMs` —— 防止「一进就出」。
2. **威胁解除**：当前没有 `visibleHuman`；而且下列任一成立：
   - 无已知威胁点（`threatEstimate === null`），或
   - 到已知威胁点的距离 ≥ `hideExitSafeDistance`（建议复用已批准的 `escapeMinSeparation`(3.0) 语义，**不新增第二个语义相同的参数**），或
   - 已知威胁信息已过期（Last Seen 超过 `lastSeenAlertMs`(2,500) / 声音事件已失效）。
3. **出口安全**：真实出口点（= 同一锚点区域内的 AI 站位）能容纳角色，且 **Human 角色圆不与它重叠**。注意 `HideSystem.exit({humanOverlap})` 已经提供这条判据，但当前 `ThreeGame.exitHide()` 只在玩家 E 路径计算它；AI 退出路径必须**显式传入**，不能依赖默认值。
4. **还有事可做**：存在一份未完成米堆，且从出口出发的 A* 路线不穿过已知威胁的抓捕半径。**没有可达米堆就不进入藏身**（进入前就要检查），这样「藏到天荒地老」在功能上不会发生。
5. 距上次退出 ≥ `hideReenterCooldownMs`（见下）。

**不振荡 / 不无限循环（逐条对应任务要求 6）**

| 风险 | 机制 | 取值归属 |
|---|---|---|
| 原地反复进出同一藏身点 | `hideMinConcealMs`（最短藏身）+ `hideReenterCooldownMs`（同点再次进入冷却）。两者都是**时间窗**，不是概率 | 待批准 |
| 在两个藏身点之间来回 | 复用现有「近期访问惩罚」纪律：记录最近藏身点（spotId + 时间 + 进入时与已知威胁的距离），`hideRecentSpotCount` / `hideRecentSpotPenalty`；并且**切换藏身点要超过 `escapeSwitchScoreMargin` 才允许**（沿用既有阈值纪律） | 待批准（可复用既有惩罚语义） |
| 候选永远选不出来（无限重选） | 每帧/每次评估失败都写「失败记忆」（点 + 时间 + 原因），`hideCandidateFailCooldownMs` 内不再选它；全部候选都在冷却 → 明确回落到原 `EVADE` 空手逃跑，并记 `HIDE_AI_ABORT: ALL_CANDIDATES_COOLED` | 待批准 |
| 走位卡住 / 目标失效 | 复用 `stuckRepathMs`(800) + `stuckProgressEpsilon`(0.05) + `maxStuckRepathsPerTarget`(2)：走位阶段卡路即放弃该点（有界），**不退款**到「无限重试」 | 复用现有值 |
| 地图变化后拿旧计划硬走 | 新增 AI 侧 `rebindMap()`；游戏层地图重建时同样调用（已有 `humanAI.rebindMap` 的同款接缝）。家具被移动/旋转/删除 → 立即作废候选并回 `EVADE` | 新增接口 |
| Human AI 正好守在门口 | 退出条件 3 与 4 会拦住；不新增「透视知道它在门口」的通道，只按**可观察到的重叠与路线**判断 | — |
| 被搜出 | `SEARCHED` 强制退出 + `forceCapture`（S7C-2 已实现），AI **不会**从藏身状态里「复活」——本阶段不新增「被发现后逃生」机制 | 已实现 |

### 4.10.7 需要新增的接口（草案，供审查；不是最终签名）

```ts
// ① HideSystem：只在「AI 自主藏身」这一条路径上开放的入口。
//    现有的 enter() 语义（拒绝非人工控制）保持不变。
enterAsAI(context: {
  phase: GamePhase;               // 必须 PLAYING
  faction: 'DEEPSEEK';
  position: Point;                // 本帧真实站位
  spotId: string;
  spotCode: string;               // checkHideRegionPosition 的 code
  spotLegal: boolean;
  captureProgressMs: number;
  sprintState: SprintState;
  /** 由游戏层签发的、本帧有效的一次性令牌；防止控制器绕过权威校验。 */
  requestToken: number;
}): HideEnterResult;              // 拒绝码沿用 HideRejectCode（去掉 NOT_PLAYER_CONTROLLED 的语义分支）

// ② 单一地图快照构造点（照 createHumanAiMapSnapshot() 的先例）。
//    只有它知道真实地图；AI 控制器保持纯逻辑、可在 Node 里直接测。
export function createDeepSeekHideMapSnapshot(input: {
  hideSpots: readonly HideSpot[];
  furniture: readonly Rect[];
}): DeepSeekHideMapSnapshot;      // { spots: { id, anchor, region, furnitureId, furnitureRect }[] }

// ③ 纯逻辑候选筛选（新模块，例如 src/systems/DeepSeekHideCandidates.ts）。
export function selectHideSpot(input: DeepSeekHideCandidateInput): DeepSeekHideCandidateResult;
//    输入只有公开几何 + AI 自身状态；输出 { spotId, stancePoint, pathNodes, score, reason } | { code, reason }
//    结构上不存在 occupancy / humanPosition 以外的对手真值字段（源码级断言把守）。

// ④ DeepSeekAIController 的输入/输出增量（全部可选，缺省 = 该能力不存在）
interface DeepSeekAIInput {
  hideSpots?: readonly DeepSeekHideSpotSnapshot[];   // 公开数据
  hideMapRevision?: number;                          // 地图代次，变化即作废计划
  // ...其余不变
}
interface DeepSeekAICommand {
  // ...其余不变
  hideSpotId?: string | null;        // 请求进入（游戏层权威校验）
  hideRequestToken?: number | null;  // 一次性令牌
  hideExitRequest?: boolean;         // 请求退出（游戏层复核 Human 重叠与出口安全）
}
onHideResult(spotId: string, result: string): void;  // 回执只给布尔级结果 + 拒绝码
```

### 4.10.8 DEV 面板、日志与浏览器测试能力

- **DEV 面板**：在现有 `hide` 分类内**新增若干行**（不新增分类、不动 `DebugTopRow`、不覆盖 DEV 入口）：AI 藏身相位、目标藏身点与站位、公开理由、请求 / 进入 / 拒绝 / 退出计数、最近拒绝码、最近退出原因、已藏身时长、同点冷却剩余、失败记忆条数、候选评分与循环抑制原因。字段必须与玩家侧字段**显式区分**（沿用 S7C-2 的「AI 已知 / AI 推断 / 开发者真值」三段纪律）。
- **AI JSON**：`hideEvents` 时间线新增 §4.10.4 的事件种类；`formatVersion` 由 **1.5 → 1.6**。既有 `events` / `hideEvents` / `humanSearchEvents` / `playerSearchEvents` 的字段与语义**不得改动**。
- **浏览器测试能力**：沿用现有 `docs/verification/S7C-2-rN/browser-check.mjs`（本机 Chrome headless + CDP）与 `tests/*-walk.mjs` 的真实走图驱动。**本轮不新增验证材料**，S7C-2 的现有产物原地保留（见交接文档 §9）。

### 4.10.9 需要用户批准的参数（**全部尚未写入 `GAME_CONFIG`**）

> 下面只列**建议值**与理由，用于让用户逐项拍板；**在用户批准前不得写进 `src/config/gameConfig.ts`，也不得同步进 `docs/GAME_BALANCE_CONFIG.md`**。凡已有同义参数一律**复用**，不新增第二个语义相同的旋钮。

| # | 参数（建议命名） | 建议值 | 单位 | 用途 / 理由 |
|---|---|---:|---|---|
| 1 | `hideThreatDistance` | 3.5 | 世界单位 | 进入 HIDE 评估的目视威胁距离；介于现有 `riskySprintDistance`(2.2) 与 `visionEvadeDistance`(5) 之间，只在「已经贴近」时才考虑藏身 |
| 2 | `hideMinConcealMs` | 2,500 | 毫秒 | 最短藏身时间，防「一进就出」 |
| 3 | `hideRecheckMs` | 500 | 毫秒 | 藏身中的退出条件重查间隔，避免逐帧 A* |
| 4 | `hideExitSafeDistance` | 复用 `escapeMinSeparation`(3.0) | 世界单位 | **不新增参数**，避免两个含义相同的安全距离 |
| 5 | `hideExitRouteCheck` | 开 | 布尔 | 退出前检查「出口 → 未完成米堆」路线不穿过威胁抓捕半径 |
| 6 | `hideReenterCooldownMs` | 8,000 | 毫秒 | 同一点退出后的再次进入冷却（防原地振荡） |
| 7 | `hideCandidateFailCooldownMs` | 6,000 | 毫秒 | 一次走位失败 / 被拒绝后该点的冷却（与 Human AI 的 `hideCheckFailureCooldownMs` 数值一致，便于对称复核） |
| 8 | `hideRecentSpotCount` / `hideRecentSpotPenalty` | 3 / 复用 `escapeRecentVisitPenalty`(5) | 个 / 无量纲 | 近期藏身点记忆与惩罚（防两点间往返） |
| 9 | `hideMaxConsecutive` | 2 | 次 | 连续藏身次数上限：超过后必须先完成一次进食或安全米路线才允许再藏（**这是「不用最大藏身时长也能防无限藏」的手段**） |
| 10 | `hideMaxConcealMs` | `0`（= 不限制） | 毫秒 | 可选同步上限。**建议默认 0 并在参数注释里写明「0 = 不限制」**：因为任务书要求「避免无法结束的行为」，而真正兜底的是第 4/9 条（无可达米堆不进入、连续藏身上限），不是时间上限 |

**不新增的参数**：藏身区域几何（`interactionRegion` 2.0 / 1.6·55° / 1.2）**一个字都不改**；`humanSearch`(1.5 / 120° / 12,000) 与 Human AI 的 `hideCheckFailureCooldownMs`(6,000) / `hideCheckMaxPerRound`(1) **一个字都不改**；`perception.lastSeenMs`(8,000) / `traceLifetimeMs`(15,000) 不改。

### 4.10.10 任务切片（可独立开发、独立验证）

| 切片 | 交付 | 依赖 | 独立验收（自动化） |
|---|---|---|---|
| **H1（推荐先做）** | 威胁驱动的藏身**合法性与候选选择**：`DeepSeekHideCandidates` 纯逻辑 + `createDeepSeekHideMapSnapshot` + 控制器只在 `EVADE` 内评估候选并记录「会选哪个点」，**不动 `HideSystem`、不进入藏身、不改移动** | 无（只读公开地图 + 现有威胁评估） | 真实地图上每个藏身点都存在至少一个「在区域内 + 可站立 + 格心吸附 ≤0.45 + A* 可达」的候选；无合法候选时必须落回原 `EVADE`；候选确定性与无占用字段的源码级断言 |
| **H2** | 走位到候选点：`HIDE`(TRAVEL) 相位 + 复用 `followPath` + 卡路有界放弃 | H1 | 走图驱动：AI 从追逐点真实走到候选点；中途真实危险立即中止并回到 `EVADE`；卡路时在 `maxStuckRepathsPerTarget` 内换点或放弃 |
| **H3** | 进入藏身：`HideSystem.enterAsAI()` + 游戏层权威校验 + 令牌 + `player.visible` / `VisionSystem.setConcealed` / 抓捕门控 / 进食中断 / 冲刺与移动封锁对 AI 同样生效 | H2 | 真实 `CollisionWorld` 下逐条拒绝路径（站位不合法 / 表面被挡 / 无导航格 / 非 PLAYING / 抓捕进度 > 0 / 眩晕）；进入后 Human 侧 `CONCEALED`、抓捕资格 false、位移 0；令牌重放必须被拒绝 |
| **H4** | 退出条件与回执：`HIDE`(EXIT) 相位 + 复用 `HideSystem.exit({ humanOverlap })` + `recover` 回到既有 `RECOVER` | H3 | 逐条：最短藏身未到不退出；威胁未解除不退出；Human 压在出口不退出（`HUMAN_BLOCKING`）且退回藏身；无可达米堆不退出；满足全部条件后退出并回到 `RECOVER` |
| **H5** | 循环抑制 + DEV 字段 + AI JSON 事件 + `formatVersion` 1.6 + 文档 | H4 | 同点冷却、失败记忆、近期藏身点惩罚、`hideMaxConsecutive` 各有用例；连续模拟长时间不得出现「无限进出」或「原地不动」；日志事件不逐帧刷屏 |

**依赖关系**：H1 → H2 → H3 → H4 → H5（严格顺序）。H1 与 H2 之间可以并行做测试器械（`tests/deepseek-ai-walk.mjs`），但 H3 必须在 H2 的走位真实可跑之后才能验证。

### 4.10.11 主要风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| **与 Human AI 搜查的耦合** | Human AI 每轮最多正式检查 1 件家具、同家具 6 秒冷却、同一次调查最多 3 件、总预算 15 秒。若 AI 藏身大幅改变局面，这些**已批准**的上限会改变藏身的实际收益 | 明确不动这四个上限；H3/H4 的验收里必须包含「Human AI 搜查链仍然成立」的回归；若要调上限，属**另一次独立的用户批准** |
| **不透视被顺手破坏** | 退出条件 3/4 很容易写成「知道 Human 就在门口」 | 只允许用「Human 角色圆与出口是否重叠」这一条**几何**判据（本身就要求已知位置，且只有真实可见/最近目击才允许使用）；源码级断言禁止 `occupancy` 字段 |
| **玩家路径被改坏** | `HideSystem` 是玩家 E 与 AI 共用的唯一状态 | `enter()` 保持原样，AI 只能走 `enterAsAI()`；`tests/hide-integration.test.mjs` 等既有玩家用例必须全绿 |
| **AI 偶发原地停留（既有待办）** | S7B-2 的已知问题 | 藏身不得引入第二条「原地不动」的路径：`HIDE` 的每个相位都必须有**有界**的推进或放弃条件，DEV 必须能区分 `noMovementReason` |
| **「关卡结束不了」** | 藏身导致对局无法推进 | 第 4 条（无可达米堆不进入）+ 第 9 条（连续藏身上限）兜底；另外 Human AI 的搜查链本身会主动来找 |
| **发现即被抓** | 藏身被搜出＝立即抓捕，AI 没有反制 | **本阶段刻意的设计结果**，不新增反制；需在验收说明里写清「藏身不是安全区」 |
| **测试器械缺失** | 现有 `human-ai-walk.mjs` 只驱动 Human | H2 起需要等价的 DeepSeek 走图驱动；H1 先做纯逻辑用例，把风险前置 |

### 4.10.12 自动化测试与人工验收计划

**自动化（预计新增 20–30 项，只增不减）**

1. `tests/deepseek-hide-candidates.test.mjs`（纯逻辑）：区域成员 / 可站立 / 格心吸附 / A* 可达四条拒绝路径；无合法候选回落；确定性与稳定 ID 排序；**源码级断言**输入结构无 `occupancy` / `concealedSpotId` / `player` 字段。
2. `tests/deepseek-hide-integration.test.mjs`（真实地图）：8 个藏身点各自至少一个真实合法候选；候选点不在家具 AABB 内；从两个出生点均可达。
3. `tests/deepseek-hide-lifecycle.test.mjs`（真实 `HideSystem` + 走图驱动）：`EVADE → HIDE(TRAVEL) → CONCEALED → EXIT → RECOVER` 全链路；令牌重放被拒；`HUMAN_BLOCKING` 退回藏身。
4. `tests/deepseek-hide-loop-guard.test.mjs`：同点冷却、失败记忆、近期藏身点惩罚、`hideMaxConsecutive`；长时间连续模拟的进出次数上限断言。
5. 回归：`human-ai-check-hide` / `human-ai-search-lifecycle` / `hide-integration` / `hide-target-resolution` / `deepseek-evade` / `deepseek-ai` / `navigation` / `apartment-map` 全部保持通过（**不得删改用例，只允许随语义同步**）。
6. 变异验证：至少 4 次（把「格心吸附」放宽、关掉同点冷却、允许读取占用、去掉出口安全判据），每次都确认对应用例确实失败后复原。

**人工验收（浏览器，草案；建议 5 项）**

1. 选 Human 阵营（AI 控制 DeepSeek 娘）→ 追到 DeepSeek 娘附近 → 观察它是否**真的走向某件家具**而不是只会直线逃跑；DEV 面板 `Hide` 分类显示 AI 藏身相位、目标藏身点、公开理由。
2. 进入藏身后：角色可视体消失、**普通抓捕进度停止累计**、Human AI 若来搜查仍能按既有 900 ms 流程把它搜出并抓捕（证明藏身不是无敌区）。
3. 走近藏身家具后假装离开 / 拉开距离 → 观察 DeepSeek 娘是否在合理时间内**自己出来**并回到吃米；DEV 显示退出原因。
4. 反复靠近 / 拉开 2–3 次 → 观察**不出现原地进出抖动**，DEV 显示同点冷却与失败记忆在起作用。
5. 让它藏身期间继续吃米 / 结束对局 / 重开 / 暂停 → 状态、冷却、缓存路径必须干净清理，无残留。

### 4.10.13 与 S7C-3 的边界

S7C-3（出生点与门初始状态随机化）**不在本轮**，不得提前实现：不新增 `MatchRandom`、不改 `DoorSystem` 的初始状态入口、不动 `SPAWNS`、不接入种子。S7C-2b 的候选与走位逻辑**不得假设固定出生点或固定门状态**，但也不需要为随机化预留第二套接口——`rebindMap()` / `hideMapRevision` 已经足够覆盖「地图变了就作废旧计划」。

---

## 5. S7C-3：出生点与局部门状态随机化（含随机种子复现）

> **本轮（S7C-0 补充轮）不实施**——用户明确「不做随机布局」；本节仅作后续规划，须另行授权后再动 `DoorSystem` 与出生点。

**阶段专属边界（2026-09-26 记录，承接原 `AGENTS.md` 前置条件 6）**：在明确这些接口（场景编辑器导出的 JSON 是否成为正式地图数据源、格式版本、稳定 ID、家具与锚点关系、坐标与旋转单位、导入校验、随机种子与可复现性、导航连通性检查、与原有地图数据的迁移方式）之前，**不得新建第二套相互冲突的地图数据真相**。本条接口决策**只约束 S7C-2 / S7C-2b / S7C-3 这三个未授权阶段**，不是其他阶段的通用前置条件。

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

> **状态（2026-09-26 S7C-2 实施后更新）**：第 2 行已由 S7C-1A 落地并随 `3191bec` 通过阶段 Gate；第 19–21 行已定案。**第 3–14 行由 S7C-1B 完整授权取代并已实现、验收、归档**（去向见原说明保留在下方）。**第 11 行「Human AI 检查参数」（900 ms 停留 / 每次 SEARCH 最多 1 处 / 单点冷却 6,000 ms / 目击记忆复用 `lastSeenMs`）已由 S7C-2 按用户批准实现**（见 §4）：停留复用 `humanAI.searchDwellMs`、每轮 1 件家具、同家具 6 秒失败冷却；**目击进入记忆**改由「亲自看见的米痕线索 + Last Seen」承担，没有单独新增藏身目击记忆。第 1 行属 S7C-2b、第 15–18 行属 S7C-3，仍**未授权**。DEV-A 的圆形／扇形藏身交互区域已正式接入玩法；是否拆分进入／退出锚点仍留到未来单独决定。
>
> 第 3–14 行的 S7C-1B 去向：第 3 行＝批准并实现（E 键；扫雷 > 门 > 藏身 > 进食；藏身中 E 专用于退出）；第 4 行＝**取消**（点按立即切换）；第 5 行＝批准但**去掉独立 Human 距离门槛**；第 6 行＝改为按 DEV-A 的精确交互区域判定；第 7 行＝实现（禁止移动/冲刺/进食/门与锁门）；第 8 行＝实现（藏身中完全不累计抓捕）；第 9 行＝由「搜查命中」承担（命中即立即抓捕，不附加眩晕）；第 10 行＝改为 **Human 玩家 Q 扇形搜查**（1.5 / 120° / 12 秒冷却）；第 11 行＝见上；第 12 行＝未新增藏身音效；第 13 行＝采用隐藏角色可视体的表现（根节点不动）；第 14 行＝实现（DEV `Hide / 藏身` 分类 + AI JSON `hideEvents`，S7C-2 再增 `humanSearchEvents`）。

| # | 议题 | 建议方案 | 备选 / 影响 |
|---|---|---|---|
| 1 | DeepSeek **AI** 主动藏身是否纳入 S7C？ | 纳入，作为 S7C-2b：仅在 EVADE 且藏身点就在逃跑路线上、且无有效目视时考虑 | 不纳入 → 玩家选 Human 时藏身玩法不可见（S7C-2 的玩家检查没有对象）。**2026-09-27 更新：已按本轮用户要求完成 S7C-2b 技术设计与任务拆分（§4.10）；建议值改为「威胁驱动的合法候选选择」，比本行的早期描述更完整；仍未授权、无功能代码。** |
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

**历史路线建议：先完成 S7C-1A（藏身点白模与地图配置），再实施 S7C-1B（玩家基础藏身交互）**。S7C-1A、S7C-1B 均已验收归档；**S7C-2 已实现、集中人工验收通过并完成归档推送（阶段 Gate = PASS）**；S7C-2b 已有技术设计与任务拆分（§4.10）但**未授权**；S7C-3 仍未授权。

- **S7C-1A 数据与校验**（**已按本行执行完成**）：`HideSpot` 扩展（kind/furnitureId/facing，`x/z` 即锚点）+ 表 3.1 的 6 条数据（`second_cabinet` 未采纳）+ 2 个纸箱白模数据 + 锚点/不变量自动校验测试。**未接入玩法**（与 S7B-3B 的 3B-0/3B-0b「接口与决策分离」做法一致）。
- **S7C-1B 逻辑与判定**（已完成）：`HideSystem` + `E` 仲裁 + 移动/冲刺/进食/抓捕门控 + `VisionSystem` 隐藏入口 + `HideSearchView` + DEV `Hide` 分类。
- **S7C-2 Human AI 循迹与家具搜查**（已实现并通过集中人工验收，Git 归档待单独授权）：见 §4；公开线索 → 公开家具怀疑 → 合法站位 → 900 ms 停留 → 正式搜查结算。
- S7C-2b / 3：不属于已实现范围，且尚未授权。S7C-2b 保留 DeepSeek AI 自主藏身、安全判断及自主现身；S7C-3 保留出生点与门状态随机化。

**验收方法（自动化）**：`npm test`（基线 518，只增不减）+ `npx tsc --noEmit`（或 `npm run build`）+ `git diff --check`；新增测试覆盖 §3.4 / §3.5 / §4 的清单。
**验收方法（人工）**：1A 用 §3.4 的调试标记与跑图检查；1B 用 §3.5 的 9 条浏览器步骤；S7C-2 用 §4.1 的链路 + DEV-B 的「AI 已知 / AI 推断 / 开发者真值」三段对照。

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
| `docs/*.md` 全文检索 `CHECK_HIDE / 藏身 / HideSpot / 随机` | 与 §1.5 当时的源码审计结论一致；该记录为历史基线，不代表 S7C-1B 完成后的当前实现状态 |

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

### 8.3 文档同步轮（2026-09-26）

> 本节各项阶段状态是该轮记录，不代表当前状态；DEV-B 后续已通过用户验收并归档，当前状态见 `docs/DEEPSEEK_HANDOFF.md` 第 12 节。

本轮为**纯文档同步轮**：把 S7C-1A 与 DEV 场景热编辑器 V1 的阶段 Gate 与 Git 归档状态更新到当前稳定检查点，并记录两项未决设计约束。**不开发任何功能、不改任何生产代码 / 测试 / `GAME_CONFIG`。**

| 命令 / 检查 | 结果 |
|---|---|
| `git rev-parse HEAD` / `git rev-parse origin/main` | 两者均为 `3191bec843606ae4bab01d6932cff0ac87955101`（`feat: complete s7c-1a hide spots and dev scene editor v1`） |
| `git rev-list --left-right --count origin/main...HEAD` | `0 0`（与远端双向同步） |
| `.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` | 全部不存在（无未完成的合并 / 变基） |
| `git status --porcelain` | 仅本轮允许的文档改动（`M AGENTS.md`、`M docs/DEEPSEEK_HANDOFF.md`、`M docs/S7C_HIDE_RANDOMIZATION_DESIGN.md`、`M docs/DEV_SCENE_EDITOR_DESIGN.md`、`M docs/AGENT_LOG.md`）与未跟踪的 `.trae/`、`.dsh-meow/`；**`src/`、`tests/`、`vite.config.ts` 无改动**（一旦出现即视为意外并立即停止） |
| `git diff --check` | 退出码 0 |
| `npm test` / `npm run build` | **本轮未跑**：纯文档轮、源码未变，按 `AGENTS.md`「纯文档或纯 Git 任务按适用性检查并说明未运行游戏测试的原因」执行；上一轮源码基线仍为 `npm test` 370/370 PASS、`npm run build`（含 `tsc --noEmit`）退出码 0 |
| `git tag` | 仍为历史 7 个（`v0.0.1`、`v0.0.2`、`v0.0.3`、`v0.0.4`、`v0.0.5-tech3d`、`v0.1.0-alpha`、`v0.2.0-alpha`）；本轮**未创建 Tag** |

本轮结论：

1. S7C-1A 的 Gate 状态由「尚未建立 Git 检查点」更正为「**阶段 Gate = PASS，已并入 `3191bec`**」（§3.4）。
2. S7C-1B 第 6 节第 3–14 行**仍待用户逐项批准**（§3.5、§6），建议值不等于授权。
3. **DEV-A 的圆形／扇形藏身交互区域**：**已在 DEV-A 第一/第二轮实现并通过用户浏览器人工验收**（属 DEV 工具线，只提供几何、校验与编辑器，**未接入任何玩法判定**）；现有**单一 anchor** 数据（`HideSpot.x/z` 即唯一进入点 = 退出点）继续有效、语义不变；是否拆分「进入锚点」与「退出锚点」留到未来单独决定（DEV-A 的专属开工要求见 `docs/DEEPSEEK_HANDOFF.md`「待批准提案与专属开工要求」节）。
4. **DEV-B 的设计约束**：必须把 `GAME_CONFIG` 原始值、本局 DEV 覆盖值、运行时实际生效值三层显式分开，**不得把调试预设直接写回正式平衡配置**（该约束已在 DEV-B 实现中落地；DEV-B 尚未人工验收、尚未 Gate。其专属开工要求见 `docs/DEEPSEEK_HANDOFF.md`「待批准提案与专属开工要求」节）。
5. **S7B 整体与 S7C 整体均仍未完成**；S7C-2 / 2b / 3 均未授权；DEV-A 的后续扩展（JSON 导入器、进入/退出锚点拆分）与 DEV-B 的后续扩展同样未授权（DEV-A 已批准范围已完成、DEV-B 已批准范围已实现待验收，状态见 `docs/DEEPSEEK_HANDOFF.md`）。

> **补记（2026-09-26，DEV-A 第一轮之后）**：上面第 3 条的「圆形／扇形藏身交互区域尚未批准」**已被 DEV-A 第一轮取代**——该区域现为已落地、**不接入玩法**的地图创作数据（`HideSpot.interactionRegion`，见 `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md`）；仍然成立的部分是「现有单一 anchor 数据继续有效、语义不变，是否拆分进入／退出锚点留到未来单独决定」。本节列表保持为**当轮（文档同步轮）结论**，不改写历史。

### 8.4 S7C-2b 设计轮与 Codex 权限归档轮的命令与结果（2026-09-27）

> 本轮为**纯文档轮 + 只读源码审查**：交付 §4.10（S7C-2b 技术设计与任务拆分）、Codex 权限诊断归档与交接状态同步。**未开发任何功能代码、未改 `GAME_CONFIG`、未改 S7C-2 已验收机制、未删改既有浏览器验证材料、未 commit / push / tag。**

| 命令 / 检查 | 结果 |
|---|---|
| `git rev-parse HEAD` / `git rev-parse origin/main` | 两者均为 `f24304797ecff97be7d9f43efb9f4ffaa0621f8d` |
| `git rev-list --left-right --count origin/main...HEAD` | `0 0`（与远端双向同步；S7C-2 已归档） |
| `git log --oneline -3` | `f243047 feat: complete s7c-2 hide search and visual targets` → `db8dfe6 feat: complete s7c-1b hiding and manual search` → `9b048fb docs: consolidate project logs and stage documentation` |
| `git show --stat --oneline f243047` | **67 个文件、+11 635 / −170**，与用户确认的 S7C-2 归档事实一致 |
| `.git/{MERGE_HEAD,REBASE_HEAD,CHERRY_PICK_HEAD,rebase-merge,rebase-apply}` | 全部不存在 |
| `git status --porcelain` | 42 条，**全部为未跟踪**：`?? .codex/`、`?? .dsh-meow/`、`?? .trae/` + `docs/verification/S7C-2-r2|r3|r4/` 下 38 个复核产物（未删改） |
| `git check-ignore -v .codex` | **无输出**（`.codex/` 未被忽略也未被跟踪；本轮未改 `.gitignore`，未暂存它） |
| `git ls-remote origin refs/heads/main` | **失败**：`schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e)`，退出码 1。这是**当前 DSH 执行环境**的 Git HTTPS 读取问题，与 Codex 沙箱账户的结论相互独立；本轮**未**做任何凭证或 `http.sslBackend` 尝试（不运行新的权限测试） |
| 只读源码审查范围 | `DeepSeekAIController`（状态、`assessThreat`、`updateSafety`、`selectEscapeGoal`、`followPath`、`reset` / `resumeAfterManualControl` / `rebindNavigation`）、`HideSystem`、`HideInteractionRegion`（`checkHideRegionPosition` / `REGION_NAV_SNAP_LIMIT`）、`NavigationSystem`、`HumanAIController` 的 `CHECK_HIDE` 相位、`HumanHideSearchStance`、`ThreeGame` 的接入点与 DEV 分类、`AILogCollector`（`formatVersion 1.5`）、`tests/human-ai-walk.mjs` |
| `npm test` / `npx tsc --noEmit` / `npm run build` | **本轮未跑**：纯文档轮 + 只读审查，`src/` 与 `tests/` 零改动（`git status --porcelain` 中不出现 `src/`、`tests/`、`vite.config.ts`）；`npm test` 基线仍为本工作区最近记录的 **642 / 642** |
| `git diff --check` | 退出码 0（仅已有 LF→CRLF 提示） |

本轮关键设计结论（细节见 §4.10）：

1. **AI 的合法藏身位置必须落在真实导航格上**：藏身点锚点本身不保证在导航格上，且「朝家具中心的几何接近点」会落在家具 AABB 内。因此 AI 只在「`nearestFree` 返回的格心、且仍在精确区域内」的位置藏身——A* 终点即真实可行走点，不需要 `finalApproach()` 式的容差走位。
2. **`HideSystem.enter()` 必须保持原样**：它按设计拒绝非人工控制（`NOT_PLAYER_CONTROLLED`）。AI 只能走新增的、受一次性令牌保护的 `enterAsAI()`，玩家 E 路径不变。
3. **玩家专用的指向型白色轮廓（`DeepSeekVisualTarget` / `HideSearchView`）不得移植进 NPC 决策**；AI 侧的按键仲裁与白色高亮都不参与藏身决策。
4. **「不卡住」的兜底不是最大藏身时长**，而是「无可达米堆就不进入藏身」+「连续藏身上限」+「最短藏身时间」+「同点再次进入冷却」；`hideMaxConcealMs` 建议默认 0（不限制）。
5. **新增候选数据只能有一个构造点**：照 `createHumanAiMapSnapshot()` 的先例建 `createDeepSeekHideMapSnapshot()`，AI 控制器保持纯逻辑、可在 Node 里直接测。

本轮结论：

- S7C-2b **只有设计，未授权、未开始、无功能代码**；§4.10.9 的参数与 §4.10.10 的切片都必须由用户逐项批准后才能开工。
- S7C-3 未被触及，不得提前实现。
- 本文件 §6 第 1 行的早期描述已按 §4.10 更新，仍标注未授权。
