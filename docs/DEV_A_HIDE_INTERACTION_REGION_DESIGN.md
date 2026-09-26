# DEV-A 藏身交互区域设计（第一轮数据/几何基础 + 第二轮编辑器与拖动修复）

> **状态（2026-09-26）**：DEV-A **第一轮**（区域数据 + 纯几何 + 合法位置检查基础接口）、**第二轮**（编辑器编辑区域半径/半角、家具移动或旋转时锚点跟随、区域校验、JSON **V2** 导出、DEV 可视化）、**DEV-A-FIX-1**（拖动流畅度）、**DEV-A-FIX-2**（家具任意角度旋转、JSON **V3**）**均已完成、已通过用户浏览器人工验收并随各自提交建立检查点**（实际 SHA 一律以 `git log -1` 查询）。归档时自动化基线：`npm test` **420/420**、`npm run build` 退出码 0、`git diff --check` 退出码 0。**DEV-A 已批准范围至此全部完成**；仍未完成的 DEV-A 相关项：JSON 导入器刻意未开发、进入/退出锚点是否拆分仍未决定。
> **第一轮当时的硬边界（用户原话范围，历史）**：暂不接入场景编辑器 UI；暂不实现家具移动后锚点自动同步；暂不升级 JSON 导出；不得实现 `HideSystem`、按键藏身、Human `CHECK_HIDE` 或随机化；不得修改正式 `GAME_CONFIG`；不得覆盖已经验收的编辑器功能。
> **仍未实现（不属 DEV-A 批准范围）**：`HideSystem`、按键藏身、Human `CHECK_HIDE`、地图随机化、JSON 导入器、进入/退出锚点拆分；**DEV-B 未授权**（授权状态见 `docs/DEEPSEEK_HANDOFF.md`）。

---

## 1. 本轮回答的设计问题（DEV-A 开工前 8 问的前半）

| # | 问题（`docs/DEEPSEEK_HANDOFF.md` §12 原文） | 本轮结论 |
|---|---|---|
| 1 | 哪些家具使用圆形交互范围 | `main_bed` / `second_bed`（半径 2.0）、`living_carton` / `storage_carton`（半径 1.2）——即 BED 与 CARTON |
| 2 | 哪些家具使用朝向入口的扇形范围 | `main_wardrobe` / `closet_wardrobe` / `study_bookshelf` / `storage_shelf`（半径 1.6、半角 55°）——即 WARDROBE 与 SHELF |
| 3 | 圆形及扇形的实际几何判定 | §3：精确连续成员判定，边界含入，扇形角度差环绕到 `(-π, π]` |
| 4 | 家具旋转后区域如何跟随 | 区域中心恒为**家具中心**；扇形轴恒为**家具中心 → 现有锚点**的方向，不另存家具朝向。DEV-A-FIX-2 起家具可绕自身中心以任意角度旋转（中心不变），家具旋转时**关联锚点与 `facing` 同步旋转**（`rotateAnchorAroundFurniture`，任意角度），区域随家具中心与锚点自动跟随 |
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
| `src/three/SceneEditor.ts` | 第一轮：`draftSpotsToAnchors()` 透传 `interactionRegion`（类型完整性）。**第二轮已改为从草稿携带区域**（区域可编辑，见 §7.1） |
| `tests/hide-interaction-region.test.mjs` | **新增** 13 项测试（见表下清单） |
| `docs/DEV_A_HIDE_INTERACTION_REGION_DESIGN.md` | **新增**本文件 |
| `docs/DEEPSEEK_HANDOFF.md` / `docs/AGENT_LOG.md` | 状态与日志同步 |

未改动：`GAME_CONFIG`（`src/config/gameConfig.ts`）、任何 AI / 感知 / 抓捕 / 冲刺 / 米堆 / 门逻辑、`MapEditModel` 的可编辑字段与校验、`MapBuilder` 的 DEBUG 标记、既有测试文件（一个断言都没改）。

验证结果：`npm test` **383/383 PASS**（基线 370 + 本轮新增 13）；`npm run build`（含 `tsc --noEmit`）退出码 **0**；`git diff --check` 退出码 **0**。人工验收：**用户浏览器人工回归 5/5 PASS（2026-09-26）**——DEV-A 第一轮的阶段 Gate = PASS，随提交 `feat: complete dev-a hide region geometry foundation` 建立检查点（实际 SHA 以 `git log -1` 查询）。

新增测试覆盖：批准参数逐条对齐（含 kind→形状映射）；区域中心来自家具、轴与 `facing` 的一致性；8 个锚点都在自己区域内；圆形边界的精确含入；扇形两侧半角边界 + ±π 接缝（含「未环绕时必然失败」的断言）；四分之一转不变 / 家具平移 / 锚点四个象限的轴推导；8 个锚点逐个验证「瞄准中心会被家具自身挡住、瞄准表面可通过且 `LEGAL`」；隔墙误判拒绝（`SURFACE_BLOCKED`）与不可站立越界点；8 个区域各自存在合法位置、合法位置都在本房间内且能从锚点 A* 到达；采样预览的 `discrete` 标记、内部一致性、步长依赖与非法步长抛错；缺省门状态等价于「每扇门都处于 `initialState`」；数据校验的 7 种非法输入；场景编辑器锚点与区域的透传（含 `interactionRegion` 为只读字段）与「移动锚点后区域不变」。

---

## 7. 第二轮接入清单与后续修复轮（2026-09-26 更新）

### 7.1 第二轮接入清单（**已全部实现并通过人工验收**）

1. **场景编辑器编辑区域**：半径、半角、朝向（Q7）。编辑器需要为 `HideSpotDraft` 增加区域字段或单独的区域编辑面板，并决定半径/半角的合法范围与拒绝码（**不要**复用 `maxAnchorFurnitureGap`）。
2. **校验与导出**（Q8）：`MapEditModel.validateEditedMap()` 接入 `validateHideRegionData()` + `checkHideRegionPosition()`（例如「区域内至少存在一个合法位置」「锚点仍是合法位置」）；`HideSpotExport` 增加 `interactionRegion`（含度/弧度单位）并决定 `MAP_EXPORT_VERSION` 是否升版。
3. **DEV 可视化**：用 `hideRegionGeometry()` 画精确的圆环/扇形轮廓（连续几何），用 `sampleHideRegion()` 的 `samples` 画**离散**采样点并按 `code` 着色——两者必须在 UI 上明确区分，不能让采样点看起来像区域边界。
4. **家具移动后锚点/区域同步**：**已在第二轮实现、并在 FIX-2 扩展到任意角度**——家具移动或旋转时关联锚点与 `facing` 跟随（`rotateAnchorAroundFurniture`），不静默改写已批准锚点以外的数据。
5. **进入 / 退出锚点是否拆分**：仍**未决定**，继续保持单一 anchor；任何拆分都属于未来单独批准的改动。
6. 现有接口可直接复用（不需要改签名）：`hideRegionSetup` / `hideRegionGeometry` / `pointInHideRegion` / `furnitureApproachSurfacePoint` / `hideRegionSurfaceClear` / `checkHideRegionPosition` / `sampleHideRegion` / `validateHideRegionData`，常量 `REGION_NAV_SNAP_LIMIT`(0.45)、`DEFAULT_REGION_SAMPLE_STEP`(0.3)、`REGION_EPSILON`。

**第二轮实际落地（2026-09-26，已验收）**：

- 数据：`HideSpotDraft` 携带 `interactionRegion`（`draftSpotsToAnchors` 直接使用草稿区域，不再按 ID 反查）。
- 可编辑字段与边界：`interactionRegion.radius`、`interactionRegion.halfAngleDeg`；`REGION_AUTHORING_LIMITS = { minRadius: 0.5, maxRadius: 3, radiusStep: 0.05, minHalfAngleDeg: 10, maxHalfAngleDeg: 150, halfAngleStepDeg: 1 }`（**仍不进 `GAME_CONFIG`**）。拒绝码：`INVALID_REGION_RADIUS` / `INVALID_REGION_ANGLE`（字段级）、`RADIUS_OUT_OF_AUTHORING_RANGE` / `HALF_ANGLE_OUT_OF_AUTHORING_RANGE`（数据校验级）、`ANCHOR_OUTSIDE_REGION` / `ANCHOR_REGION_ILLEGAL` / `NO_LEGAL_REGION_SAMPLE`（地图校验级）。圆形藏身点不显示半角输入；字段输入带 `min`/`max`。
- 预览：`MapEditSession.regionPreview(targetId, includeSamples, step)` 返回 `{ geometry, sampling, sampleStep }`；`regionPreview(id, false)` 只给精确轮廓（拖动路径），`true` 才做离散采样。面板提供「交互区域预览」开关，采样点按 `code` 着色 + 图例（精确轮廓与离散采样明确分开呈现）。
- 导出：`MAP_EXPORT_VERSION = 2`，`HideSpotExport.interactionRegion` 带 `units`（半径 world-unit、半角 degree），**只导出已应用数据**。
- 性能：`checkHideRegionPosition` / `sampleHideRegion` 新增 `isReachable` 快速路径，复用连通性洪水填充结果，避免每个采样点各跑一次 A*。

### 7.2 DEV-A-FIX-1：拖动流畅度（**已实现并 5/5 人工验收 PASS**）

- **根因**：`SceneEditor.onFrame()` 每帧读取 `session.draftStatus`，该 getter 会执行完整地图校验（新建 `CollisionWorld` + `NavigationSystem` + 3 格连通性洪水填充 + 区域采样）；拖动时草稿每帧变化使 revision 缓存必然失效 → **每帧一次完整校验**（实测 236–435 ms/次，卡顿主因）。次因是 `SceneEditorView.setRegionPreview()` 每次调用都销毁并重建轮廓线与采样实例（实测 0.0177 ms/次，次要项）。
- **修复**：`MapEditSession` 增加**延迟校验窗口**——`beginDeferredValidation()` / `endDeferredValidation()` / `validationDeferred`，窗口内 `draftStatus` 返回新状态 `'DRAGGING'`（O(1)，不触发校验），另加只读计数 `validationRuns`（仅缓存未命中时 +1）用于回归断言。`SceneEditorView` 新增 `onDragStart` 钩子；`SceneEditor.beginDrag()` 在 pointerdown 开窗，`commitDrag()`（pointerup）关窗并**校验一次**；`close` / `discardDraft` / `applyEdits` / `dispose` / `MapEditSession.resetAll()` 兜底关窗。预览对象改为长期存活：轮廓线原地改写 position 缓冲 + 重算包围球；采样 `InstancedMesh` 按 `code` 复用、数量未变只重写矩阵；**拖动期间仅隐藏采样点**（不重采样），释放时立即重绘。
- **不变式**：拖动期间仍然实时更新家具 mesh、关联锚点与精确轮廓（不靠隐藏 UI 掩盖）；`apply()` 仍全量复验、`commitDrag()` 仍释放时校验并回滚（非法位置无法进入地图）；校验函数本身与编辑器数据语义未改。
- **实测（Node，模型/视图层毫秒，不是浏览器 FPS）**：120 次 pointermove 触发的完整校验 **119 → 1 次**；每次拖动移动的编辑器开销中位 **0.011 ms**；释放时区域重采样约 **19 ms**（每次释放 1 次）；轮廓 A/B（真实 three API + 真实 `SceneEditorView`，400 次/组）**0.0177 → 0.0111 ms**（中位）。
- **测试**：`tests/scene-editor.test.mjs` 追加 6 项拖动回归（逐帧读取零校验、释放恰好一次、非法拖动仍拒绝并可回滚、拖动中家具/锚点/区域同步且无采样、硬重置关窗、延迟拖动后 V2 导出只含已应用数据）。

### 7.3 DEV-A-FIX-2：家具任意角度旋转（**已实现、已通过用户浏览器人工验收 5/5、已归档**）

用户批准的 FIX-2 设计（2026-09-26）：家具支持 0°–359.9° 任意数字角度；可关闭的 15° 吸附、默认关闭；围绕自身中心旋转；旋转后的完整轮廓必须留在原所属房间；关联锚点与 `facing` 同步旋转；JSON 导出升级 V3 并保留 V2 原有字段语义。

**统一旋转几何**（新增 `src/three/map/RotatedRect.ts`）：局部/世界坐标换算、四角点、轴对齐包围盒（`rectBoundingAabb`，四分之一转取精确值）、角色圆与旋转矩形（`circleIntersectsRect`）、线段与旋转矩形（`segmentIntersectsRect`）、家具间真实重叠（SAT，`rectsOverlap`）、点到旋转矩形距离（`distanceToRect`）、方形（Chebyshev）膨胀判定（`pointInsideInflatedRect`，与地图测试同口径）、表面瞄准点（`rectSurfacePoint`）与绕点旋转（`rotatePointAround`），另有角度归一化/吸附助手。**旋转约定与 `THREE.Object3D.rotation.y` 一致**，因此 0/90/180/270 的数值与行为与改动前完全相同。

**碰撞与导航**：`Rect` 增加可选 `rotation`（弧度，缺省 0 = 轴对齐）；`CollisionWorld` 新增第二种碰撞体 `OrientedObstacle`（真实旋转足迹 + 仅作粗筛的包围 AABB），`canOccupyStaticXZ`、`isLineBlockedXZ`、`move` 的分轴滑动与角落切线全部支持它；轴对齐路径的数学保持逐字不变（避免回归）。`MapBuilder` 生成网格时应用同一角度，并按真实角点绘制调试轮廓（不再用会画错形状的 `BoxHelper`）；旋转家具**不注册**为 AABB 实体，其包围盒只进粗筛。`ThreeGame` 在初始构建与热重建两处把 `orientedObstacles` 一并交给 `CollisionWorld`，`NavigationSystem` 继续只复用 `canOccupyStaticXZ`（无第二套逻辑），AI 因此能绕行。

**地图校验与感知**：`MapEditModel` 的房间边界改为「四角点均在房间内」、家具重叠改为真实 SAT、门洞改为与「膨胀后的门叶矩形」真实重叠、米点/出生点/门前点沿用方形膨胀、锚点距离改用点到旋转矩形距离、`roomOfRect` 与碰撞世界构建改用 `rectColliders()`（自动分流 Box3 / OrientedObstacle）。`HideInteractionRegion` 的表面瞄准点与遮挡判定改为旋转几何（单测与第二轮测试均通过）。LOS 相关（抓捕资格、门交互、米堆交互）走 `CollisionWorld.isLineBlockedXZ`，因此自动使用真实旋转形状。

**编辑器**：家具可编辑字段由 `rotationQuarter`（0/1/2/3）改为 **`rotationDeg`**（任意角度，输入即归一化到 [0, 360)，`min/max=0/359.9`；非法值 `INVALID_VALUE`；超范围草稿 `INVALID_ROTATION`）；工具栏新增「旋转吸附 15°」复选项（默认关闭，仅影响输入值、不进 JSON）；`syncMeshPreview` 按真实角度旋转网格。FIX-1 的延迟校验窗口、释放时校验、非法回滚、草稿取消、恢复初始值、DEV 冻结与区域采样预览全部保留，`validationRuns` 断言证明旋转编辑仍然「每次修订只校验一次」。

**JSON V3**（`MAP_EXPORT_VERSION = 3`）：每件家具记录 `position`（足迹中心）、`size`（创作尺寸）、`rotationDeg` 与 `rotationRad`（真实角度）、`collisionShape: 'ROTATED_RECT'`，并把轴对齐边界改名为 `boundingAabb` 且附 `boundingAabbRole: 'broad-phase-approximation'`——**V2 的 `collisionAabb` 字段被移除**，避免包围盒冒充碰撞形状；只导出已应用数据；**未开发 JSON 导入器**。藏身点导出保持 V2 语义（`anchor` / `facing` / `interactionRegion` + `units`）。

**测试与结果**：新增 `tests/rotated-rect.test.mjs`（8 项纯几何）、`tests/rotated-furniture.test.mjs`（12 项：真实重叠、房间边界、门洞、LOS/抓捕、导航绕行、藏身区域与遮挡、编辑器事务与吸附、V3 导出），并在 `tests/collision-world.test.mjs` 追加 5 项旋转碰撞（含「90° 等价于旧交换盒」「碰撞形状是真实旋转矩形而非包围盒」「大位移不穿透」「绕转角滑动不穿模」）；`tests/scene-editor.test.mjs`、`tests/hide-interaction-region.test.mjs` 相应迁移到新字段/新格式。归档轮实跑：**`npm test` 420/420 PASS、`npm run build` 退出码 0、`git diff --check` 退出码 0**。

**人工验收与归档（2026-09-26）**：用户浏览器人工验收 **5/5 PASS**——①任意角度输入及 15° 吸附；②旋转后的真实碰撞与 AI 导航；③关联锚点与藏身区域同步、非法旋转拒绝；④取消、应用与 JSON V3 导出；⑤原有流畅拖动等功能回归。本轮随提交 `feat: complete dev-a arbitrary furniture rotation` 建立检查点（实际 SHA 以 `git log -1` 查询）。

**仍需注意**：`HideSpot.x/z` 仍是唯一 anchor（未拆分进入/退出点）；**JSON 导入器刻意未开发**（不属 DEV-A 批准范围）；`HideSystem`、按键藏身、Human `CHECK_HIDE`、出生点随机化、DEV-B 均未实现、未授权；`GAME_CONFIG` 未改。

---

## 8. 第一轮明确未实现（当时禁止项，逐条核对；2026-09-26 历史快照）

> 本节是第一轮结束时的状态快照。其中**场景编辑器 UI、`MapEditModel` 的区域可编辑字段与拒绝码、JSON 导出升级、家具移动后的锚点同步已在 DEV-A 第二轮实现并验收**（见 §7.1）；其余各项仍未实现。

- 没有 `HideSystem`、没有藏身进入/退出按键、没有移动限制、没有抓捕门控、没有 `VisionSystem` 隐藏入口、没有 `HideSpotView`。
- 没有 Human `CHECK_HIDE`、没有 AI 藏身、没有地图随机化。
- 没有改 `GAME_CONFIG`、没有改 `docs/GAME_BALANCE_CONFIG.md`、没有改任何已验收数值。
- 没有接场景编辑器 UI、没有改 `MapEditModel` 的可编辑字段与拒绝码、没有升级 JSON 导出、没有改 `MapBuilder` 的 DEBUG 标记、没有做家具移动后的锚点同步。**（前四项已在第二轮实现并验收）**
- 8 个藏身点的稳定 ID、家具绑定、唯一锚点语义**全部不变**。
