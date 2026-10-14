# 素材来源与公开分发核对

记录日期：2026-10-12。用途：S13前Public仓库快照准备；本轮等待用户确认后再commit/push。

## 正式DeepSeek角色

用户最终确认：`public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`为本人自制原创资产，授权将模型及其动画、内嵌贴图公开上传到本人GitHub仓库。本条作为该正式文件的当前来源与公开授权声明，替代此前对该文件的来源归类及排除结论。

正式文件SHA-256：`b74025c238bb884bdd0d05e2ef9ab6061916dad1512549207fef6f8ee3cfb026`。18,500三角面、26骨骼、7段动画、3张内嵌PBR贴图；无外部资源URI。运行首选该文件，加载失败才启用回退。

只纳入正式v6。静态版及v1–v5等历史/中间GLB继续排除于本次公开快照，保留本机；不将本次原创及公开授权声明扩大到这些旧文件。

## 其他素材

用户确认米袋、参考图、立绘、UI Sheet及派生素材为自行制作或使用AI工具生成、编辑和加工，没有直接使用第三方网站下载的未经授权资源。未提供的平台不猜测。

| 资产路径（项目相对路径） | 来源与加工记录 | 许可核验状态 |
|---|---|---|
| `public/assets/props/rice-bag/rice-bag.glb` | 用户自制/AI生成输入，项目减面、压缩贴图并导出；具体生成平台未提供 | 用户来源声明已记录；平台特定条款未核实 |
| `public/assets/ui/portraits/deepseek-model-reference.png`、`deepseek-portrait-sheet.png` | 用户自制/AI生成与加工；具体平台未提供 | 用户来源声明已记录；平台特定条款未核实 |
| 同目录 `deepseek-normal.png`、`deepseek-win.png`、`deepseek-lose.png` | 合集裁切及获用户授权的补画；保留原始合集 | 来源随合集；补画具体平台未在本轮另行确认 |
| 同目录 `deepseek-rice-v1.webp`、`human-guardian-v1.webp` | 同目录README记载2026-10-06项目内imagegen原创生成并转WebP | 已有生成记录；不将工具名推定为其他图片的平台 |
| `public/ui/sheet-a-pulselock.png`、`sheet-b-panels.png`、`sheet-c-hud.png`、`sheet-d-menu-result.png`、`sheet-e-textures.png`、`sheet-f-modern-textures.png` | 用户确认自制/AI生成与加工；具体平台未提供 | 用户来源声明已记录；平台特定条款未核实 |
| `public/ui/components/`、`hud/`、`panels/`、`pulselock/`、`screens/`、`textures/`内清单列出的23项 | 原Sheet经` scripts/extract-ui-sheets.py`裁切、透明化及切片 | 继承对应Sheet来源，不虚构独立许可 |
| `public/ui/faction-name-gradient.png`及`faction-name-gradient-clean.png`、`faction-name-gradient-clean.svg` | 用户提供并确认自制/AI加工；clean版本清理/重绘；原图平台未提供 | 用户来源声明已记录；平台特定条款未核实 |
| 项目程序化家具、角色回退、软接地纹理 | 由项目Three.js/Canvas等源码生成 | 有源码制作依据，未发现外部下载资源来源 |

## 发布边界

- 正式v6模型、动画及内嵌贴图依上述用户原创声明和公开上传授权纳入快照。
- 本文不为素材新增通用开源许可证，也不自动授予访客对资产的商业使用、修改或再分发许可。
- 其余资产按已确认的来源声明管理；原始工作输入、旧版模型与私人文件继续按审查清单排除。

## S13 补充音效（2026-10-13）

当前公开的37个Ogg均由项目 `scripts/generate-s13-audio.mjs` 以确定性合成方式原创制作，未采样或混入第三方录音；合计399664字节。生成脚本依赖ffmpeg仅用于重新生成，游戏运行不依赖ffmpeg。本次不重新生成或替换已验收音频。

曾为 `step`、`sprintStep`、`sprintStart`、`doorOpen`、`doorClose` 制作原创合成音效；用户试听后决定弃用，五个 Ogg 已从项目删除，生成脚本也不再生成。当前仅保留其事件接口，不公开这五个文件。没有采样、剪辑或混入第三方录音；小森平网站与本机 Sonniss GDC 素材仅用于听感方向参考，未将其文件放入项目。其余 37 个 S13 音频保留。

参考条款：<https://taira-komori.net/freesounden.html>、<https://sonniss.com/gdc-bundle-license/>。本段只记录本轮五个文件的来源，不扩大至其他素材。
