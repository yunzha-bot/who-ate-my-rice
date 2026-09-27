# 玩家声音探测表现层：ThreeGame 接线与测试记录

本文件记录**停用前**的 `ThreeGame` 接线位置（含 2026-09-27 用户对声音圈的最后一次未提交调整），
以及停用后实际生效的接线隔离方式，供将来恢复时对照。行号为停用前工作区版本。

## 1. 停用前的接线（`src/three/ThreeGame.ts`）

| 位置 | 停用前内容 | 作用 |
|---|---|---|
| 导入（原 L66） | `import { SoundVisualView } from './SoundVisualView';` | 引入表现层类。 |
| 字段（原 L117） | `private soundVisual: SoundVisualView;` | 唯一实例。 |
| 构造（原 L235） | `this.soundVisual = new SoundVisualView(this.scene, import.meta.env.DEV);` | **2026-09-27 用户改动**：第二个参数 `showDebugRings = import.meta.env.DEV`，即范围圈只在 DEV 可见（此前无此参数，范围圈在正式构建里也一直显示）。 |
| 每帧（原 L2347） | `this.soundVisual.update(null, null, false, this.sound.nowMs);` | 尚未选定阵营时隐藏表现层。 |
| 每帧（原 L2354） | `this.soundVisual.update(listener, this.debugPossessionEnabled ? probe : heard, this.match.phase !== 'FINISHED', this.sound.nowMs);` | 正式每帧更新（DEV 接管时使用 `probe`，把重遮挡事件也显示出来）。 |
| 销毁（原 L3119） | `this.soundVisual.dispose();` | 释放几何体与材质并从场景移除。 |

同一函数内**必须保留**的计算（属于 AI 真实听觉与 DEV-B，不属于本次停用范围）：

```ts
const listener = faction === 'HUMAN' ? this.human.position : this.player.position;
const heard = this.sound.heardBy(listener, faction, this.camera, this.perceptionGeometry);
const probe = heard ?? this.sound.analyzeBy(listener, faction, this.camera, this.perceptionGeometry);
...
this.updateDebugDetailsPanel(faction, heard, probe, sight);
```

`heard` / `probe` 同时喂给 DEV `Details` 面板，因此**不能**因为停用表现层而删掉它们。

## 2. 停用后的接线隔离（本次实际改动）

只在 `ThreeGame.ts` 内加入一个模块级常量，并让它同时守住「实例化」与「逐帧更新」：

```ts
// 玩家声音探测表现层（声音范围圈 + 彩色动态声纹）已于 2026-09-27 停用：
// `SoundVisualView` 的实现、测试与 `GAME_CONFIG.perception.soundVisual` 数值全部保留，
// 这里只用这一个常量关掉它的实例化与逐帧更新；恢复时把下面的值改回 `true` 即可。
// 停用前快照、接线记录、配置说明与恢复步骤见 archive/features/player-sound-visual/README.md。
// AI 真实听觉（`PerceptionSystem` / `SoundEventSystem`）与 DEV-B 调试完全不受影响。
const PLAYER_SOUND_VISUAL_ENABLED: boolean = false;
```

```ts
private soundVisual: SoundVisualView | null = null;                 // 字段改为可空

this.soundVisual = PLAYER_SOUND_VISUAL_ENABLED                       // 不再实例化
  ? new SoundVisualView(this.scene, import.meta.env.DEV) : null;

if (PLAYER_SOUND_VISUAL_ENABLED)                                     // 不再逐帧更新
  this.soundVisual?.update(...);

this.soundVisual?.dispose();                                         // 销毁改为空安全
```

这样做的理由：`SoundVisualView` 只被 `ThreeGame`（与测试）引用，因此表现层可以在**唯一的接线点**上被关掉，
而不需要注释大段代码、不需要删除类、也不影响共享的 `PerceptionSystem` / `SoundEventSystem`。
`PLAYER_SOUND_VISUAL_ENABLED` 显式标注为 `boolean`，避免 TypeScript 把 `if` 判定为恒假而引出不可达代码告警。

## 3. 测试记录（`tests/sound-visual.test.mjs`，本轮未改动）

该文件同时覆盖 A / B 两侧，因此**整份保留**、停用后仍全部通过：

| 用例 | 归属 | 说明 |
|---|---|---|
| `sound distance bands use clear thresholds and resist boundary jitter` | A | `soundDistanceBand()` 近/中/远阈值与缓冲。 |
| `world bearing places arcs toward the actual XZ sound source` | A | `soundWorldAngle()` 方位角。 |
| `scene ring follows listener and colored waves fade and disappear` | A | 范围圈跟随、彩色声纹按分带换色与淡出；2026-09-27 用户新增 `assertWaveRingsWithinBand()` 断言。 |
| `animated sound waves remain in the selected concentric band after each update` | A | **2026-09-27 用户新增**：声纹在 NEAR/MID/FAR 同心带内扩散动画，且跟随移动不回到旧圆心。 |
| `debug range rings are hidden by default and only enabled for DEV visualization` | A | **2026-09-27 用户新增**：四条范围圈默认隐藏，仅 `new SoundVisualView(scene, true)` 时可见。 |
| `distant Human footsteps are heard by DeepSeek and reverse listening still works` | B | `SoundEventSystem` 的听觉、同阵营不自听、生命周期。 |
| `development visual keeps a faint blue direction for Human at the distant spawn` | A + B | 先用 `analyzeBy()` 验证重遮挡事件仍可被感知（B），再验证该事件会显示为远档蓝色（A）。 |

停用**不改变**这些用例：它们直接测试 `SoundVisualView` 类本身（不是 `ThreeGame` 的接线），
所以类保留 = 回归覆盖保留。恢复接线时无需改动本测试文件。

## 4. 恢复步骤（与 README 同源）

1. 把 `ThreeGame.ts` 的 `PLAYER_SOUND_VISUAL_ENABLED` 改回 `true`；
2. 确认 `SoundVisualView.ts` 仍是本目录 `SoundVisualView.ts` 的内容（若工作区版本已演进，以工作区为准）；
3. 跑 `npm test` / `npx tsc --noEmit` / `npm run build`；
4. 浏览器确认范围圈与彩色声纹恢复显示（DEV 下范围圈由 `import.meta.env.DEV` 决定）。
