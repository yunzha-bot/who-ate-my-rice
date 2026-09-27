# 玩家声音探测表现层：相关视觉配置说明

本文件记录**被停用的玩家声音探测表现层**所依赖的全部视觉配置，供将来恢复时对照。
停用日期：2026-09-27。快照来源：停用前的工作区版本（见同目录 `README.md`）。

## 1. 配置位置与当前值

唯一来源：`src/config/gameConfig.ts` → `GAME_CONFIG.perception.soundVisual`（原文照抄，未改动）：

```ts
  perception: {
    // S6D debug hearing display: XZ world units, with stable near/mid/far bands.
    soundVisual: {
      radius: 18, nearMax: 2.5, midMax: 6.5, bandHysteresis: 0.3,
      colors: { far: 0x54aaff, mid: 0xffd45f, near: 0xff635b },
      // 声波亮度归一化强度及结束淡出时间：无量纲、毫秒。
      waveFullStrength: 0.45,
      waveFadeMs: 420,
      hudMidStrength: 0.25,
      hudHighStrength: 0.55,
    },
```

| 键 | 值 | 单位 / 含义 |
|---|---|---|
| `radius` | 18 | 世界单位。最外层显示圈半径，**不是**所有声音事件的统一听觉范围（每个事件以自己的 `range` 为准）。 |
| `nearMax` | 2.5 | 世界单位。NEAR 与 MID 的分界（近程红/中程黄）。 |
| `midMax` | 6.5 | 世界单位。MID 与 FAR 的分界（中程黄/远程蓝）。 |
| `bandHysteresis` | 0.3 | 世界单位。距离分带切换缓冲，避免边界抖动。 |
| `colors.far / mid / near` | `0x54aaff` / `0xffd45f` / `0xff635b` | 三条彩色声纹（彩色动态声纹）在远/中/近三档使用的颜色。 |
| `waveFullStrength` | 0.45 | 无量纲。声纹亮度归一化的参考强度。 |
| `waveFadeMs` | 420 | 毫秒。声纹临近过期时的淡出时长。 |
| `hudMidStrength` | 0.25 | 无量纲。HUD 文字颜色分界（中）。 |
| `hudHighStrength` | 0.55 | 无量纲。HUD 文字颜色分界（高）。**须保持大于中档值。** |

## 2. 纯表现层内部常量（不在 `GAME_CONFIG` 中）

`src/three/SoundVisualView.ts` 内部另有只影响观感、不参与玩法判定的常量（属于「无需调节的视觉实现常量」，按项目规则可留在模块内）：

```ts
/** Purely visual layout: near/mid/far waves occupy inner/middle/outer thirds. */
export const SOUND_WAVE_LAYOUT = {
  bandCount: 3,
  edgePadding: 0.2,
  ringThickness: 0.16,
  travelDurationMs: 760,
  segments: 28,
  angleStart: -Math.PI / 5,
  angleLength: Math.PI * 2 / 5,
} as const;
```

以及四条范围面的固定不透明度 / 高度（构造函数内）：`surface(0, radius, 0.055, 0.018)`、
`surface(nearMax - 0.075, nearMax, 0.58, 0.04)`、`surface(midMax - 0.07, midMax, 0.36, 0.045)`、
`rangeRing = surface(radius - 0.16, radius, 0.75, 0.05)`，与固定色 `0xb5d8e5`（范围圈颜色，只在此文件出现）。

## 3. 停用后的配置状态（重要）

- **本次停用没有改动 `GAME_CONFIG` 中的任何一个声音传播、距离或 AI 平衡数值**；`soundVisual` 整组数值原样保留（用户明确要求不得修改已验收数值）。
- 停用后，`perception.soundVisual` 整组参数**只服务于已停用的表现层**；其中 `hudMidStrength` / `hudHighStrength` 在停用前的源码里就已经没有任何模块读取（`git grep hudMidStrength` 只命中 `gameConfig.ts` 自身），属于悬空配置。
- 数值索引 `docs/GAME_BALANCE_CONFIG.md` 的对应行已就地补注「当前仅供已停用的玩家声音表现层使用」。
- 恢复时**不需要**修改这些数值，只要恢复接线（见 `README.md` 的恢复步骤）。

## 4. 与 AI 听觉无关

这些配置全部是显示参数：`SoundVisualView.update()` 只读取 `HeardSound` 的既有结果（事件位置、`audibleStrength`、`remainingMs`）来摆放圆圈与声纹，**不参与** `PerceptionSystem` 的距离/墙门遮挡判定、Human AI 调查、DeepSeek AI 威胁感知。停用它们不影响任何 AI 行为。
