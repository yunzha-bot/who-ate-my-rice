# 玩家声音探测表现层（已停用，代码归档）

**状态：已停用（2026-09-27；用户集中人工验收 3/3 PASS，随归档提交进入 `main`）。**
本目录是**停用前的玩家声音探测表现层快照**，保留实现以便将来低成本恢复。
停用只影响玩家端的声音可视化，**不影响 AI 真实听觉与 DEV-B 调试**。

| 项目 | 内容 |
|---|---|
| 停用对象 | 玩家端「声音范围圈」+「彩色动态声纹」两项可视化 |
| 停用日期 | 2026-09-27 |
| 停用方式 | 表现层接线隔离：`ThreeGame.ts` 的 `PLAYER_SOUND_VISUAL_ENABLED = false`（一个常量同时关闭实例化与逐帧更新） |
| 快照来源 | 停用前的工作区版本（含用户 2026-09-27 22:21 对声音圈的最后一次未提交调整） |
| 快照校验 | `SoundVisualView.ts` SHA-256 `5FDD0F1E2253C00D6762E9DB10854FE9208C821BC451170DEDBB3E2E7BB6032D`，与 `src/three/SoundVisualView.ts` 逐字节一致 |
| 浏览器证据 | `docs/verification/PLAYER-SOUND-VISUAL-DISABLE/`（停用前 / 停用后各一次真实浏览器采样） |

## 1. 原有功能及文件位置

原来在正式对局中，玩家会看到两类声音可视化（来源：`GAME_CONFIG.perception.soundVisual` 的注释把它记为
`S6D debug hearing display`）：

1. **声音范围圈**：以当前观察者（玩家阵营角色）为圆心的四个同心面——
   - 半径 `radius = 18` 的整圆淡填充（不透明度 0.055）；
   - `nearMax = 2.5` 处的近程圈（0.58）；
   - `midMax = 6.5` 处的中程圈（0.36）；
   - 半径 `radius` 处的最外圈 `rangeRing`（0.75）。颜色固定 `0xb5d8e5`。
2. **彩色动态声纹**：听到声音时，在圆心朝向声源的方向上显示三条彩色弧线（远 `0x54aaff` / 中 `0xffd45f` /
   近 `0xff635b`），亮度随 `audibleStrength`、临近过期时按 `waveFadeMs` 淡出；距离分带带 0.3 的
   切换缓冲（`bandHysteresis`）。
   - 用户 2026-09-27 的最后一版改动把三条声纹改为在 NEAR / MID / FAR **同心带内向外扩散**的动画
     （`SOUND_WAVE_LAYOUT` / `soundWaveBandRadii()` / `updateWaveRingRadius()`），并把四条范围圈改成
     **默认隐藏、只有 DEV 可视化才显示**（构造参数 `showDebugRings`）。

文件位置：

| 文件 | 职责 |
|---|---|
| `src/three/SoundVisualView.ts` | 全部表现层实现（本目录 `SoundVisualView.ts` 即其停用前快照）。 |
| `src/three/ThreeGame.ts` | 唯一接线点（见下面第 2 节）。 |
| `tests/sound-visual.test.mjs` | 表现层与相关听觉的测试（本轮**未改动**，见下面第 6 节）。 |
| `src/config/gameConfig.ts` | `GAME_CONFIG.perception.soundVisual` 全部视觉数值（见 `visual-config.md`）。 |

## 2. 涉及的游戏接线位置

停用前的接线（`src/three/ThreeGame.ts`，行号为停用前版本）：

- 导入：`import { SoundVisualView } from './SoundVisualView';`（L66）
- 字段：`private soundVisual: SoundVisualView;`（L117）
- 构造：`this.soundVisual = new SoundVisualView(this.scene, import.meta.env.DEV);`（L235，
  第二个参数是用户 2026-09-27 加入的 `showDebugRings`）
- 每帧：`updatePerceptionHud()` 内的两处 `this.soundVisual.update(...)`（L2347 未选阵营时隐藏；
  L2354 正式更新，DEV 临时接管时用 `probe` 把重遮挡事件也显示出来）
- 销毁：`this.soundVisual.dispose();`（L3119）

停用后：以上五处全部由 `PLAYER_SOUND_VISUAL_ENABLED`（`false`）守住的空安全调用取代；
逐行对照、必须保留的 `heard` / `probe` 计算以及理由见 `wiring-and-tests.md`。

## 3. 关联配置及依赖

- 视觉数值：`GAME_CONFIG.perception.soundVisual`（`radius` / `nearMax` / `midMax` / `bandHysteresis` /
  `colors` / `waveFullStrength` / `waveFadeMs` / `hudMidStrength` / `hudHighStrength`）。
  **本次一个数值都没有改**；逐键单位与用途见 `visual-config.md`。
- 依赖：只有 `three`（`Group` / `Mesh` / `RingGeometry` / `MeshBasicMaterial`）与
  `GAME_CONFIG`、`HeardSound` 类型、`Point` 类型。**没有新增依赖**。
- 输入数据：`SoundEventSystem.heardBy()` / `analyzeBy()` 的既有结果（事件位置、`audibleStrength`、
  `remainingMs`）。表现层只读这些结果，**不参与**任何听觉或 AI 判定。
- 与 DEV-B 的关系：DEV-B 的「声音事件」可视化在 `src/three/DevBView.ts` 内独立实现，
  **不经过** `SoundVisualView`；本次停用对 DEV-B 无影响。

## 4. 本次为什么停用

本次停用是用户明确授权的独立任务。用户给出的口径是：

> 本次授权停用玩家端的声音探测可视化，包括声音范围圈和彩色动态声纹。保留相关实现，未来能够低成本恢复。
> 注意：AI 内部听觉、声音事件和现有 PerceptionSystem 判定暂时保留，不允许破坏 Human AI、DeepSeek AI 的既有行为。

用户**没有说明**玩法、平衡或美术层面的原因，本文件不臆测动机。可以核实的既有事实只有两条：

1. `GAME_CONFIG` 自己的注释把这套显示记为 `S6D debug hearing display`，即它原本是调试期加入的听觉显示；
2. 用户 2026-09-27 的最后一版未提交改动已经先把四条范围圈改成「只在 DEV 显示」，彩色声纹仍在正式对局中显示。

本次停用后，正式对局与 DEV 对局都不再创建该表现层对象。

## 5. 将来恢复需要执行的步骤

1. `src/three/ThreeGame.ts`：把 `const PLAYER_SOUND_VISUAL_ENABLED: boolean = false;` 改回 `true`。
   （接线代码全部保留，无需重新编写。）
2. 核对 `src/three/SoundVisualView.ts` 与工作区期望版本一致；若工作区版本已演进，以工作区为准，
   本目录快照只作参照。如需回退到停用前那一版，可用本目录文件覆盖回去（文件内 `import` 路径与原文件相同，
   覆盖后无需改动导入）。
3. 跑第 6 节的回归测试与门禁（`npm test`、`npx tsc --noEmit`、`npm run build`、`git diff --check`）。
4. 浏览器确认：DEV 下应重新看到四条范围圈，听到声音时重新看到彩色声纹。
   注意 `showDebugRings` 仍由 `import.meta.env.DEV` 决定——**正式构建里范围圈依旧不显示**，
   若希望正式构建也显示范围圈，需要把该参数显式改成 `true`（这是用户的原始设计，不是本次停用引入的）。
5. `docs/GAME_BALANCE_CONFIG.md` 中 `soundVisual` 各行的「当前仅供已停用的表现层使用」注记需要一并撤回。
6. 恢复属于**功能变更**，须按项目规则单独获得用户授权后再做，并重新走一遍人工验收。

## 6. 未来恢复时需运行的回归测试

- `tests/sound-visual.test.mjs`（7 项，本轮未改动、停用后仍全部通过）：
  距离分带阈值与缓冲；方位角；范围圈跟随与彩色声纹换色淡出；声纹在同心带内的扩散动画；
  范围圈默认隐藏 / DEV 才显示；DeepSeek 听到远处 Human 脚步；DEV 下远处的远程蓝色方向提示。
  其中前 5 项针对本表现层，恢复后应逐项通过。
- 感知与 AI 侧（`tests/` 下 `perception` / `human-ai-*` / `deepseek-*` 各套件）：
  确认恢复表现层没有反向影响 `SoundEventSystem`、Human AI 循声调查、DeepSeek AI 威胁感知。
- 门禁四连：`npm test`、`npx tsc --noEmit`、`npm run build`、`git diff --check`。
- 人工验收建议：DEV 与正式构建各开一局，确认「范围圈只在 DEV 显示」这一既有设计未被改坏，
  并确认彩色声纹的远近颜色与淡出符合预期。

## 7. 本目录文件清单

| 文件 | 内容 |
|---|---|
| `README.md` | 本文件：功能、接线、配置、停用原因、恢复步骤、回归测试。 |
| `SoundVisualView.ts` | 停用前的表现层实现快照（逐字节一致，含用户 2026-09-27 改动）。 |
| `visual-config.md` | `GAME_CONFIG.perception.soundVisual` 全部视觉数值与模块内视觉常量的说明。 |
| `wiring-and-tests.md` | `ThreeGame.ts` 接线逐行对照（停用前 / 停用后）与测试归属表。 |

## 8. 停用后的已知限制（不得当作已通过项）

- 本目录里的 `SoundVisualView.ts` **不在构建与类型检查范围内**（`tsconfig.json` 只 `include: ["src"]`），
  它是一份快照，不参与编译；恢复时必须复制回 `src/three/`。
- 停用由源码常量控制：已构建的旧 `dist/` 产物不会自动改变，需要重新 `npm run build`。
- 本轮浏览器证据来自 **Vite 开发服务器**（`http://127.0.0.1:5173/`）的停用前后对比；
  正式构建侧的证据是「打包产物里不再包含表现层代码」的静态核对，不是在生产构建里跑完整对局。
- 未覆盖：无痕 / 不同浏览器下的表现、超宽或极窄窗口下的观感。这些交用户人工验收，不记为已通过。
