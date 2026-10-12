# 正式 UI Sheet 与组件映射

原始六张 `sheet-*.png` 是用户选定的正式素材，保留原样。运行 `scripts/extract-ui-sheets.py` 可按原图像素坐标重新提取组件：对不规则外沿制作透明蒙版，对 HUD 浅纸底保留半透明，对米饭碗单独抠出透明图标。没有重新生成视觉素材。所有实时文字、米数、计时、技能冷却、PulseLock 光点与结果仍由 HTML / TypeScript 绘制。

| 原始 Sheet | 裁出组件 | 实际 UI 用途 |
| --- | --- | --- |
| `sheet-a-pulselock.png`（画面内容为通用 UI） | `components/button-shell.png`、`header-strip.png`、`dark-label.png`、`blue-strip.png` | 暂停/结算按钮、阵营标题、左上角色标签、阵营箭头与提示 |
| `sheet-b-panels.png` | `panels/main-shell.png`、`compact-shell.png` | 菜单标题与阵营卡的九宫格外壳、暂停/结算、PulseLock 小面板 |
| `sheet-c-hud.png` | `hud/faction-warm.png`、`rice-shell.png`、`rice-bowl.png`、`timer-shell.png`、`skill-blue.png`、`skill-warm.png`、`interaction-shell.png` | Human 阵营标识、五个真正的米饭碗、米进度、时间、Q/Space/E 技能区、角色旁小型 E 提示 |
| `sheet-d-menu-result.png`（画面内容含 PulseLock） | `pulselock/track-shell.png` | 三条动态锁芯轨道下方的视觉底片；判定与脉冲仍为实时元素 |
| `sheet-e-textures.png`（画面内容含菜单/结算） | `screens/result-accent.png` | 阵营卡错位底板及结算局部斜切色片 |
| `sheet-f-modern-textures.png` | `textures/paper.png` | 菜单说明与结算数据区的轻微纸张材质 |

裁片通过 `src/sheet-ui.css` 接入现有组件。边角透明度直接来自提取后的 PNG；可伸缩外壳使用 `border-image-slice` 保持端部比例，CSS 只负责裁切轮廓与布局。米饭碗来自 Sheet C 左上 HUD 示例的图标，五格的完成状态由同一个透明图标的灰度和透明度改变，数字仍是实时 DOM 文本。`src/industrial-ui.css` 仍保留布局与状态选择器，`src/sheet-ui.css` 只叠加本套外观。独立复核页 `docs/verification/INDUSTRIAL_UI/preview.html` 使用同一外观层，但其 HUD 与结算数字是标明的样例，不等于自然对局证据。
