# 素材来源与公开分发核对

## 2026-10-24 Human失败插画

- `public/assets/ui/portraits/human-report-lose-v1.png`：用户提供PNG原样复制，1536×1024 RGBA，2,373,138字节；SHA256 `7046faeab56c6bcd34e9e71bd51cf17da1648af39cfd4da91d5d4f6f9d2ad88c`。
- 用户指定替换人类失败结算并授权正常Git推送/准备腾讯云上线目录。未重绘、去背景、压缩或调色；仅显示时沿用原失败页灰度淡化样式，人类获胜图及其他立绘不变。来源只确认用户提供，不猜测平台或通用版权授权。

## 2026-10-23 RC2资源补充

- `assets/characters/human/human_v2.glb`：本项目Blender候选r03导出的运行副本，基于用户四视图制作；无骨骼/动画/外部贴图，运行时以刚性分组表现。只公开经用户此次归档授权的运行GLB，候选blend/参考原件保留本地，不修改其他角色资产来源。
- `assets/ui/portraits/human-hoodie-v1.png`：用户提供米白卫衣少年原PNG，1024×1536，SHA256 b82ade694981139231ed879c251b18080788d359841328ca1f6705099606da5e；开屏显示brightness(.92)，原文件不改。
- `assets/ui/portraits/human-report-hoodie-v1.png`：用户提供双人结算图原PNG，1312×1199，SHA256 e3cd1ff062348ca132c0da4d54bb0c0b2cb7e8c812ae7937d0b04b89372b5ad8；原样用于Human结算，旧图保留。
- 两张新PNG来源仅确认用户提供，不臆测生成平台或第三方许可。本次用户明确批准Git公开归档及准备腾讯云包；该操作授权不等于独立版权证明，不扩大发布通用许可证。既有音频等历史待核验项仍按下文记录保留，不伪称本轮完成版权审核。

记录起始日期：2026-10-12。用途：公开仓库素材来源与发布边界；最新声明优先于下文对应的历史待核验状态。

## 2026-10-16 用户来源补充与本次公开快照

- 用户确认此前审查清单中的38项米袋、部分立绘、UI原图及派生素材为GPT生成，并确认可公开使用；两段MP3随后明确更正为用户在updream进行语音生成。具体40个路径见 `docs/verification/S19_PENDING_MATERIALS.csv`，该CSV保留提交前的历史审查状态，不再代表本次来源声明未提供。
- `public/assets/audio/basinHit.mp3` 和 `public/assets/audio/deepseekCaughtDefeat.mp3`按updream生成音频记录，不登记为GPT输出、ChatGPT语音对话录音或项目确定性合成Ogg。下文原字节、用途和SHA-256记录不变。
- 用户明确本项目不商用，仅供学习；结合此前普通提交/推送授权，本次将来源补充作为上述40项纳入GitHub学习项目快照的依据。不新增通用开源许可证，也不擅自授予访客素材的商业使用或再分发权利。
- 2026-10-16以独立未登录浏览器读取 [updream官网](https://www.updream.cn/) 页脚「知识产权及用户合规声明」及 [用户协议](https://www.bilibili.com/blackboard/era/B0KhhuGsCWR5A926.html)（2026-04-29生效）：平台不主张生成输出的所有权，用户须保证使用合规及相关标识完整。未用第三方转载代替官方条款。
- GPT生成内容的一般权利边界参考 [OpenAI使用条款](https://openai.com/policies/terms-of-use/)；不将输出权利分配理解成第三方素材、输入内容或品牌授权，也不把非商业学习用途理解成普遍免责。
- 本轮核实的是用户来源/公开使用声明及平台公开说明，不是对历史生成任务、具体模型/音色、输入授权或全部法定标识的独立鉴定。素材原文件和元数据未修改；如出现具体第三方权利或模型特定限制，应按相应证据处理。本次来源待确认阻断解除，不等于所有权利风险归零或游戏网站已经部署。

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

## 生活投掷物（2026-10-15）

花瓶、小盒子、不锈钢盆由 `src/three/ThrowableView.ts` 的项目源码以Three.js基础几何/LatheGeometry和材质直接生成，未引入外部模型、贴图、音频或下载资源。初始点位在 `src/three/map/throwableLayout.json`；本轮不更改既有资产或扩大其授权结论。

## 用户提供的不锈钢盆命中音（2026-10-15）

- 项目文件：`public/assets/audio/basinHit.mp3`，26381字节；用户提供原名“钢管 落地.MP3”，按用户指示用于不锈钢盆砸中角色。原字节复制，未重新合成或修改输入文件。
- SHA-256：`b04405c3f3c9d4546a2d60003879c278d99ae48fcca8c4f2b93433112fdff79d`。
- 来源仅确认“用户提供”，未提供录制者、来源网站或许可证明，不登记为项目原创，不猜测素材平台。用户授权本轮本地游戏接入；公开再分发及商业使用许可尚未核实，后续公开提交/部署审查需单独确认，不能沿用原37个原创合成Ogg的来源结论。

## 用户提供的DeepSeek娘被抓失败音（2026-10-16）

- 项目文件：`public/assets/audio/deepseekCaughtDefeat.mp3`，17525字节；用户提供原名 `NOPE.mp3`，指定用于DeepSeek娘主控被抓后的失败结算。原字节复制，未修改输入文件。
- SHA-256：`3754fcec7a41785ad41d71decd84ce487257df18973f16e7ac2a13119b34c447`。
- 来源仅确认用户提供；作者、来源平台、公开再分发及商业使用许可尚未核实，不登记为原创，不因本地接入授权推定公开部署权限。后续提交或公开部署前需核验许可。
