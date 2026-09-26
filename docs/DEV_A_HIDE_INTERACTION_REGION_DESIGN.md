# DEV-A 藏身交互区域设计（第一轮：数据与几何基础）

> **状态（2026-09-26）**：DEV-A **第一轮（区域数据 + 纯几何 + 合法位置检查基础接口）已完成**：`npm test` 383/383、`npm run build` 退出码 0、`git diff --check` 退出码 0；**用户浏览器人工回归 5/5 PASS（2026-09-26）、阶段 Gate = PASS**，并随提交 `feat: complete dev-a hide region geometry foundation` 建立检查点（实际 SHA 以 `git log -1` 查询）。
> **本轮的硬边界（用户原话范围）**：暂不接入场景编辑器 UI；暂不实现家具移动后锚点自动同步；暂不升级 JSON 导出；不得实现 `HideSystem`、按键藏身、Human `CHECK_HIDE` 或随机化；不得修改正式 `GAME_CONFIG`；不得覆盖已经验收的编辑器功能。
> **本文件只记录本轮实际落地的事实与第二轮要接的接口，不代表批准第二轮**。DEV-A 第二轮（编辑器编辑/校验/导出/可视化）与 DEV-B 均**未授权**（授权状态见 `docs/DEEPSEEK_HANDOFF.md`）。

---

## 1. 本轮回答的设计问题（DEV-A 开工前 8 问的前半）

| # | 问题（`docs/DEEPSEEK_HANDOFF.md` §12 原文） | 本轮结论 |
|---|---|---|
| 1 | 哪些家具使用圆形交互范围 | `main_bed` / `second_bed`（半径 2.0）、`living_carton` / `storage_carton`（半径 1.2）——即 BED 与 CARTON |
| 2 | 哪些家具使用朝向入口的扇形范围 | `main_wardrobe` / `closet_wardrobe` / `study_bookshelf` / `storage_shelf`（半径 1.6、半角 55°）——即 WARDROBE 与 SHELF |
| 3 | 圆形及扇形的实际几何判定 | §3：精确连续成员判定，边界含入，扇形角度差环绕到 `(-π, π]` |
| 4 | 家具旋转后区域如何跟随 | 区域中心恒为**家具中心**（编辑器四分之一转只交换 AABB 宽深，中心不动）；扇形轴恒为**家具中心 → 现有锚点**的方向，不另存家具朝向 |
| 5 | 实体碰撞、合法站立区域与交互范围的关系 | §4：交互范围（几何）与合法位置（真实碰撞 + 真实导航 + 无遮挡）**分开两层**，几何内不等于合法 |
| 6 | 进入和退出锚点的独立作用 | **本轮不变**：继续保留单一 anchor（`HideSpot.x/z` 即进入点 = 退出点）；是否拆分仍留待未来单独决定，本轮不拆分、不预留两套字段 |
| 7 | 场景编辑器如何调整半径、角度及朝向 | **第二轮**，本轮未实现（接口见 §7） |
| 8 | 改动如何校验和导出 | **第二轮**，本轮只提供纯数据校验与合法性检查接口（§5、§7） |

---

## 2. 已批准并落地的区域参数（用户本轮任务指定）

数据落在 `src/three/map/apartmentMap.ts` 的 `HideSpot.interactionRegion`，**逐藏身点地图创作数据**，不进 `GAME_CONFIG`（与 `MapEditModel.EDIT_LIMITS` 同类：灰盒创作约束，不是玩法平衡值）。

| 藏身点 | 家具（`furnitureId`） | 形状 | 半径 | 半角 | 家具中心 | 唯一锚点 | 锚点到中心 | 锚点距家具表面 | 锚点距区域边界 |
|---|---|---|---|---|---|---|---|---|---|
| `hide_main_bed` | `main_bed` | CIRCLE | 2.0 | — | (-13.00, -5.00) | (-14.40, -6.15) | 1.812 | 0.350 | 0.188 |
| `hide_second_bed` | `second_bed` | CIRCLE | 2.0 | — | (-13.00, 10.00) | (-14.40, 8.90) | 1.780 | 0.350 | 0.220 |
| `hide_main_wardrobe` | `main_wardrobe` | SECTOR | 1.6 | 55° | (-16.10, -7.80) | (-16.65, -6.60) | 1.320 | 0.292 | 0.280 |
| `hide_closet` | `closet_wardrobe` | SECTOR | 1.6 | 55° | (-4.10, -7.60) | (-3.57, -8.80) | 1.312 | 0.255 | 0.288 |
| `hide_study_bookshelf` | `study_bookshelf` | SECTOR | 1.6 | 55° | (-0.10, 12.10) | (-0.80, 11.05) | 1.262 | 0.400 | 0.338 |
| `hide_storage_shelf` | `storage_shelf` | SECTOR | 1.6 | 55° | (17.35, -7.50) | (16.80, -8.75) | 1.366 | 0.300 | 0.234 |
| `hide_living_carton` | `living_carton` | CIRCLE | 1.2 | — | (7.90, 3.90) | (7.00, 3.60) | 0.949 | 0.450 | 0.251 |
| `hide_storage_carton` | `storage_carton` | CIRCLE | 1.2 | — | (15.70, -4.80) | (16.60, -4.80) | 0.900 | 0.450 | 0.300 |

- **8 个锚点坐标一个都没改**，稳定 ID、家具绑定、`facing`、`label`、`kind` 全部保持原值。
- `validateHideRegionData()` 对本轮 8 条数据返回 **0 个问题**：形状/半径/半角合法，且每个锚点都在自己的区域内（上表末列余量 0.188–0.338）。

---

## 3. 数据模型

```ts
export type HideInteractionShape = 'CIRCLE' | 'SECTOR';

export interface HideInteractionRegion {
  shape: HideInteractionShape;
  radius: number;         // 世界单位，从「所属家具中心」量起
  halfAngleDeg?: number;  // 仅 SECTOR：轴线两侧各多少度
}

export interface HideSpot extends MapPoint {
  kind: HideSpotKind;
  furnitureId: string;
  facing: number;         // 弧度：锚点 → 家具中心（表现用，未改语义）
  label: string;
  interactionRegion: HideInteractionRegion; // 本轮新增
}
```

- **区域中心不单独存储**：由 `furnitureId` 反查 `FURNITURE` 得到家具中心，避免同一份坐标出现第二个副本（沿用 S7C-1A 已确立的「单一权威来源」做法）。
- **扇形轴不单独存储**：`axisAngle = atan2(anchor.z − centre.z, anchor.x − centre.x)`，即由家具中心指向现有锚点；它与既有 `facing` 的关系是 `axisAngle ≈ facing + π`（已有自动化断言，防止两者静默漂移）。
- **家具旋转**：编辑器只支持 0/90/180/270°，`furnitureRect()` 的实现是**交换宽深**，`x/z` 不变 → 区域中心与扇形轴在四分之一转下**不变**；家具整体平移时区域随之平移；锚点被移动时扇形轴按新方向重新推导。

---

## 4. 三层接口（几何 / 合法位置 / 采样预览必须分开）

实现在 `src/three/map/HideInteractionRegion.ts`（纯逻辑，可单测；不引用任何现有系统的运行时状态）。

### 4.1 第一层：精确连续几何

- `pointInHideRegion(geometry, point)`——**精确**成员判定，与墙、家具、门、站立能力**无关**。
- 边界**含入**（容差 `REGION_EPSILON = 1e-9`）：正好落在半径上、正好落在半角边上的点算「在区域内」。实测：`inside(+2.0, 0) = true`、`inside(+2.001, 0) = false`。
- **角度环绕**：扇形用 `wrapToPi(点角 − 轴角)` 后比较 `|差值| ≤ 半角`，因此四个象限与 ±π 接缝行为一致。接缝用例（轴恰好 = π）需要环绕才成立，已有专门测试。
- `hideRegionGeometry(spot, furniture)` 输出 `{ spotId, anchor, centre, region, radius, halfAngleRad, axisAngle }`；`hideRegionAxisAngle(centre, anchor)` 与 `sectorHalfAngleRadians(region)` 为公开的纯函数。

### 4.2 第二层：合法位置检查（复用真实碰撞与真实导航）

`checkHideRegionPosition(setup, point, world, { reachable? })` 按固定顺序给出**首个**失败原因：

| 顺序 | 代码 | 判据 | 复用的既有能力 |
|---|---|---|---|
| 1 | `OUTSIDE_REGION` | 不在区域内 | §4.1 精确几何 |
| 2 | `NOT_STANDABLE` | 角色圆（`GAME_CONFIG.collision.playerRadius`）与身高（`three.actorHeight`）放不下 | **真实** `CollisionWorld.canOccupyStaticXZ` |
| 3 | `SURFACE_BLOCKED` | 「位置 → 家具可接近表面」之间被墙、其他家具或非 OPEN 门叶挡住 | 既有 `crossesRect` + `PerceptionGeometry.inspectVision`（门状态缺省 = 各门 `initialState`） |
| 4 | `NOT_NAVIGABLE` | 附近没有真实导航格（吸附上限 `REGION_NAV_SNAP_LIMIT = 0.45`，与既有锚点不变量一致） | **真实** `NavigationSystem.nearestFree` |
| 5 | `NOT_REACHABLE` | 仅当显式开启 `reachable` 时评估：从唯一锚点 A* 不可达（`reachable` 未开启时为 `null`，不猜测） | **真实** `NavigationSystem.findPath` |

**遮挡瞄准「家具暴露的可接近表面」，不是家具中心**：`furnitureApproachSurfacePoint(rect, from)` 取 `from` 视角下家具 XZ 足迹边界上的最近点（在足迹外侧即普通 clamp，在足迹内侧取主导轴的最近边界，中心点确定性取 +X 侧）。这样做的原因是：**若瞄准中心，8 个锚点全部会被家具自身挡住**（已有断言逐个验证「锚点 → 家具中心」的线段确实穿过家具自己的碰撞盒），而瞄准表面后同一位置 `SURFACE_BLOCKED = false` 且判定为 `LEGAL`。绑定家具**不参与**自己的遮挡集合（`setup.otherFurniture` 只含其他家具），所以家具本身永远不会挡死围绕它的合法位置。

**必须避免的误判（实测证据）**：`hide_storage_carton` 的圆形区域半径 1.2，几何上越过储物间/厨房的墙；坐标 `(14.6, -4.8)` 经 `roomAt()` 确认在**厨房**、且 `canOccupyStaticXZ` 判定**可站立**、导航格也在吸附范围内——只有「到家具表面的路线」被 `wall_038` 挡住，因此判为 `SURFACE_BLOCKED`、`legal = false`。`hide_living_carton` 的圆形区域同样越过客厅/餐厅墙，但越界点连角色圆都放不下（`NOT_STANDABLE`），因此不会产生任何新的合法位置。

### 4.3 第三层：明确离散的采样预览

`sampleHideRegion(setup, world, { step?, reachable? })` 返回 `HideRegionSamplePreview`：

- 结果里带 **`discrete: true`、`method: 'LATTICE'`、`step`**，字段名一律用 `samples` / `legalSamples`；**只有精确成员判定决定哪些格点进入 `samples`**，计数**只是采样格点数**，不是连续区域面积，也不是「区域内所有合法位置」的完整枚举。
- **步长依赖已被测试固定**：同一区域 `step = 0.3` 与 `step = 0.1` 的计数必然不同（例如 `hide_main_bed` 137 → 1257 个格点、56 → 582 个合法格点）。这正是「离散采样不得伪装成连续空间的精确结果」的机械化表达。
- `step ≤ 0` 或 `NaN` 会**抛错**，不会静默退化成别的东西。
- 默认 `DEFAULT_REGION_SAMPLE_STEP = 0.3`，与地图创作网格步长一致。

---

## 5. 与既有「锚点 ↔ 家具」校验的关系（本轮第一项检查结论）

**既有校验使用的是「家具表面距离」，不是「家具中心距离」**，本轮**没有替换**任何一处：

| 既有校验 | 位置 | 度量 | 阈值 |
|---|---|---|---|
| 藏身点不变量 | `tests/hide-spot.test.mjs:48-50`（`gapToRect`）+ `:98-102` | 家具 AABB **表面**距离（足迹内为 0） | ≥ 0.05 |
| 场景编辑器校验 | `src/three/map/MapEditModel.ts:183-187`（`rectDistanceXZ`）+ `:21-23`（`EDIT_LIMITS`）+ `:395-412` | 同上，表面距离 | ≥ 0.05 且 ≤ 0.9（`maxAnchorFurnitureGap`，防「锚点与家具脱离」） |

实测（8 个锚点）：**表面距离 0.255–0.450**（全部落在 [0.05, 0.9] 内，所以 `validateEditedMap()` 对原始地图仍然返回 0 个拒绝，既有测试不变）；**中心距离 0.900–1.812**。

**本轮新增的区域半径 1.2–2.0 是「中心距离」度量，与上表的表面距离是两个不同的量**，二者并存、互不替代：

- 锚点在自己区域内 ⇒ 中心距离 ≤ 半径：8/8 成立（余量 0.188–0.338，见 §2 末列）。
- 既有表面距离阈值继续原样生效（`AGENTS.md` 前置条件 9 的受保护清单里地图数据不得乱改）。
- **未来注意**：不能把 `maxAnchorFurnitureGap = 0.9`（表面）当成区域半径（中心）的上限来套用，也不能反过来；第二轮若要给编辑器加半径/半角输入框，应为其单独定义合法范围并单独记录，而不是复用 `maxAnchorFurnitureGap`。

---

## 6. 本轮实际改动与验证

| 文件 | 改动 |
|---|---|
| `src/three/map/apartmentMap.ts` | 新增 `HideInteractionShape` / `HideInteractionRegion` 类型与 `HideSpot.interactionRegion` 字段；为 8 条藏身点写入 §2 参数（锚点坐标未改） |
| `src/three/map/HideInteractionRegion.ts` | **新增**：几何、表面瞄准、合法位置检查、离散采样预览、纯数据校验 |
| `src/three/SceneEditor.ts` | `draftSpotsToAnchors()` 通过稳定 ID 把 `interactionRegion` 原样透传（类型完整性所需）；区域**不可编辑**，编辑器行为不变 |
| `tests/hide-interaction-region.test.mjs` | **新增** 13 项测试（见表下清单） |
| `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md` | **新增**本文件 |
| `docs/DEEPSEEK_HANDOFF.md` / `docs/AGENT_LOG.md` | 状态与日志同步 |

未改动：`GAME_CONFIG`（`src/config/gameConfig.ts`）、任何 AI / 感知 / 抓捕 / 冲刺 / 米堆 / 门逻辑、`MapEditModel` 的可编辑字段与校验、`MapBuilder` 的 DEBUG 标记、既有测试文件（一个断言都没改）。

验证结果：`npm test` **383/383 PASS**（基线 370 + 本轮新增 13）；`npm run build`（含 `tsc --noEmit`）退出码 **0**；`git diff --check` 退出码 **0**。人工验收：**用户浏览器人工回归 5/5 PASS（2026-09-26）**——DEV-A 第一轮的阶段 Gate = PASS，随提交 `feat: complete dev-a hide region geometry foundation` 建立检查点（实际 SHA 以 `git log -1` 查询）。

新增测试覆盖：批准参数逐条对齐（含 kind→形状映射）；区域中心来自家具、轴与 `facing` 的一致性；8 个锚点都在自己区域内；圆形边界的精确含入；扇形两侧半角边界 + ±π 接缝（含「未环绕时必然失败」的断言）；四分之一转不变 / 家具平移 / 锚点四个象限的轴推导；8 个锚点逐个验证「瞄准中心会被家具自身挡住、瞄准表面可通过且 `LEGAL`」；隔墙误判拒绝（`SURFACE_BLOCKED`）与不可站立越界点；8 个区域各自存在合法位置、合法位置都在本房间内且能从锚点 A* 到达；采样预览的 `discrete` 标记、内部一致性、步长依赖与非法步长抛错；缺省门状态等价于「每扇门都处于 `initialState`」；数据校验的 7 种非法输入；场景编辑器锚点与区域的透传（含 `interactionRegion` 为只读字段）与「移动锚点后区域不变」。

---

## 7. 第二轮需要接入的接口（本轮全部未实现）

1. **场景编辑器编辑区域**：半径、半角、朝向（Q7）。编辑器需要为 `HideSpotDraft` 增加区域字段或单独的区域编辑面板，并决定半径/半角的合法范围与拒绝码（**不要**复用 `maxAnchorFurnitureGap`）。
2. **校验与导出**（Q8）：`MapEditModel.validateEditedMap()` 接入 `validateHideRegionData()` + `checkHideRegionPosition()`（例如「区域内至少存在一个合法位置」「锚点仍是合法位置」）；`HideSpotExport` 增加 `interactionRegion`（含度/弧度单位）并决定 `MAP_EXPORT_VERSION` 是否升版。
3. **DEV 可视化**：用 `hideRegionGeometry()` 画精确的圆环/扇形轮廓（连续几何），用 `sampleHideRegion()` 的 `samples` 画**离散**采样点并按 `code` 着色——两者必须在 UI 上明确区分，不能让采样点看起来像区域边界。
4. **家具移动后锚点/区域同步**：本轮明确未实现（用户禁止）。第二轮若要加，必须先决定「锚点自动跟随」还是「仅提示」，且不得静默移动已批准锚点。
5. **进入 / 退出锚点是否拆分**：仍**未决定**，本轮保持单一 anchor；任何拆分都属于未来单独批准的改动。
6. 现有接口可直接复用（不需要改签名）：`hideRegionSetup` / `hideRegionGeometry` / `pointInHideRegion` / `furnitureApproachSurfacePoint` / `hideRegionSurfaceClear` / `checkHideRegionPosition` / `sampleHideRegion` / `validateHideRegionData`，常量 `REGION_NAV_SNAP_LIMIT`(0.45)、`DEFAULT_REGION_SAMPLE_STEP`(0.3)、`REGION_EPSILON`。

---

## 8. 明确未实现（本轮禁止项，逐条核对）

- 没有 `HideSystem`、没有藏身进入/退出按键、没有移动限制、没有抓捕门控、没有 `VisionSystem` 隐藏入口、没有 `HideSpotView`。
- 没有 Human `CHECK_HIDE`、没有 AI 藏身、没有地图随机化。
- 没有改 `GAME_CONFIG`、没有改 `docs/GAME_BALANCE_CONFIG.md`、没有改任何已验收数值。
- 没有接场景编辑器 UI、没有改 `MapEditModel` 的可编辑字段与拒绝码、没有升级 JSON 导出、没有改 `MapBuilder` 的 DEBUG 标记、没有做家具移动后的锚点同步。
- 8 个藏身点的稳定 ID、家具绑定、唯一锚点语义**全部不变**。
