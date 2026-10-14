# 三档难度与正式30秒进食

2026-10-14，用户明确批准实现，并在最终发布轮确认三档真人平衡体验通过。数值保持已验收档位；没有统计胜率实测，不据主观体验通过宣称双方胜率相等。正式归档见验收报告的最新发布说明。

## 唯一调整入口

- 基础配置：`src/config/gameConfig.ts` 的 `GAME_CONFIG`。EASY直接继承完整AI基础值，不复制三份完整配置。
- 档位覆盖：`src/config/difficultyConfig.ts` 的 `DIFFICULTY_OVERRIDES`，类型只允许下面6＋5个字段。未列出的AI、玩家、门、听觉、地图等参数不随难度变化。
- `resolveAiDifficulty(level, playerFaction)` 在新局建立只读快照。玩家选DeepSeek时只覆盖Human AI，选Human时只覆盖DeepSeek AI；不是给玩家角色减速或缩短技能。
- 数值单位：`Ms`为毫秒，距离为世界单位，概率／倍率无量纲，计数为房间／家具件数。

### 玩家选择DeepSeek娘：Human AI

| 字段（相对于GAME_CONFIG.humanAI） | EASY | NORMAL | HARD |
|---|---:|---:|---:|
| movementSpeedMultiplier | 0.52 | 0.78 | 0.95 |
| aiUnlockDurationMs | 8750 | 7500 | 6500 |
| aiUnlockSuccessChance | 0.70 | 0.80 | 0.90 |
| searchMaxMs | 15000 | 18000 | 22000 |
| searchRoomCount | 3 | 4 | 5 |
| hideCheckMaxPerRound | 1 | 2 | 3 |

Human基础行走4.14 u/s，因此上述AI行走约为2.1528／3.2292／3.9330 u/s。DeepSeek玩家步行仍为230/60≈3.8333 u/s。困难Human约快2.6%，并不意味着必胜。寻路预计行程也使用同一个有效速度。

调查、家具候选尝试及正式检查共用原有有限预算／公开线索规则，不新增透视、额外搜查半径或绕过碰撞。强破技能冷却未变，表内仅是AI自主破解的时长及成功率。

### 玩家选择Human：DeepSeek AI

| 字段（相对于GAME_CONFIG.deepseekAI） | EASY | NORMAL | HARD |
|---|---:|---:|---:|
| visionEvadeDistance | 5 | 6 | 7 |
| soundEvadeStrength | 0.09 | 0.075 | 0.06 |
| escapeMinSeparation | 3 | 3.5 | 4 |
| escapeReplanMs | 700 | 600 | 500 |
| hideThreatDistance | 3.5 | 4 | 4.5 |

三档均满足 `hideThreatDistance < visionEvadeDistance`。`visionEvadeDistance`是已经通过现有遮挡／视野检测后，对可见目标的逃跑判断距离，不是扩大感知真值范围。声音阈值作用于现有有效听觉结果；逃跑仅保留八向估计，仍不读取墙后Human隐藏坐标。更高难度没有改变DeepSeek AI速度、冲刺风险或技能。

## 自动锁门的共同安全保护（本轮追加授权）

压力回归复现DeepSeek AI在浴室把自己和一份米锁在室内，吃完后不能到达门外剩余米点。用户明确追加批准修复，三档共用同一规则：仅在自动锁门前，以当前全部门状态加上拟锁门的禁止通行集合，调用现有NavigationSystem／CollisionWorld路径；所有尚未完成米点必须仍可达，任一不可达即取消本次自动锁门。已完成米点不参与，不要求米点处于同一房间。

保留原本逃跑路线、侧向证据、距离、技能冷却及锁数检查。全不可达沿用 `ALL_RICE_UNREACHABLE`，部分不可达新增 `REMAINING_RICE_UNREACHABLE`，取消后清本次pending且不反复尝试；所有目标可达的合理锁门仍会执行。仅自动锁门准入有此安全补充，不改玩家手动锁门、Human强破或PulseLock，不新增可调参数、传送、作弊开门或跳过米点。

## 正式进食

`RICE_MAX_PROGRESS_MS.production = 30000`，`RICE_TIMING_MODE = 'production'`，所以Vite开发入口和生产构建都实际读取 `GAME_CONFIG.rice.maxProgressMs = 30000`。所有难度均5份，每份30秒进度。

原有开始／中断后恢复的400ms准备、松键／移动中断、累计进度与5/5胜利判定不变。连续吃一份从按住E起至少30.4秒玩法时间，中断后须重新准备400ms，但不清零已吃进度。没有新增对局时限。

`development = 5000`保留供显式测试。旧S7D轨迹回归显式使用5秒夹具，维持其既有150秒仿真预算；新的难度整局回归使用真正的production30秒，不能把旧夹具当成正式运行值验证。

## 生命周期、设置与DEV-B

1. 首页原生radio组选择难度，鼠标、Tab／方向键／空格可操作。首次或损坏偏好回落EASY；本地存储键 `who-ate-my-rice-difficulty-v1`，存取失败不阻止游戏。
2. 点击阵营卡时锁定难度；暂停设置不提供难度修改入口，ESC仅显示当前档位及DEV覆盖提示。
3. 重新开始沿用当前档位；返回阵营选择后可以重新选择。开发模式切换主控阵营保留档位，并按新的对手应用同档AI快照，不重开对局。
4. 新局先清本局DEV覆盖，再设置难度基准。原DEV-B预设只读保留，不会刷新或新局自动应用；已有用户预设不删除、不迁移、不改写。
5. 手动加载预设或调参仍属于显式DEV行为，优先于本局难度。暂停页显示覆盖项数及Human实际倍率，DEV-B原面板可核对各有效值。重新开始再次恢复难度基准，预设文件／存储仍保留。
6. 调试解锁进度／调查配额读取本局AI快照；导出AI日志记录两侧实际AI快照、难度和DEV有效Human倍率，避免只记录EASY基础值造成误解。AI日志格式既有字段保留，新增字段为可选信息。

## 验证与人工验收边界

详见 [验收记录](verification/DIFFICULTY_REPORT.md)。回归覆盖实际破解边界、追丢搜查数／超时、视听逃跑阈值、藏身距离闸门、逃跑重算间隔、进食准备／中断／完成以及六组合整局。

固定随机种子用于对照，不是新玩法规则。浏览器受控固定步长加速整局与真人自然试玩应分别记录；有限种子不能证明所有地图路线都不发生抖动，更不能宣称胜率已平衡。后续应人工试玩普通／困难的追逐、逃跑和搜查压力，再另行批准调值。
