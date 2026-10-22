# 内部文字标签底板专项修正

归档说明：仓库保留本报告、reference.png、四张 compare-*.png 和最终 static-1920x1080.png；其余原始截图与日志留本地。后续同步见 [Git 报告](../git-preparation-2026-10-22/README.md)，下方“未提交”为实现当轮历史。

2026-10-22。只修两组名字/身份及两条口号；不是大卡重构。预览 http://127.0.0.1:5173/ 。未进入C、未提交/推送/部署。

## 截图与对比

- `static-1920x1080.png`：最终Chrome真实截图，CSS1920×1080、密度1、默认100%缩放；`msedge-static-1920x1080.png`为Edge。
- 四组：`compare-deepseek.png`、`compare-human.png`、`compare-rice.png`、`compare-guard.png`。每组左参考/右实际，分别是DeepSeek娘与干饭人、Human与屋主人、就吃亿口！、大米保卫战！。
- 局部图使用与参考相同的1768×890真实页面、相同裁切区域，双方等比放大3倍；没有手工拉伸或旋转实现来凑对比。1920全屏另行保留。
- `before-*.png`和`iteration-1-*.png`是本轮改前/首轮，未当作最终截图。

## 实现与文件清单

- 运行时仅改 `src/opening-menu.css` 的标签规则，旧纯色矩形移除；DOM标记、事件及所有其他源码未改。透明纸底通过伪元素渲染，pointer-events:none，无新动画/依赖。
- `--label-paper` / `--label-paper-inset` / `--label-paper-x` / `--label-paper-y` / `--label-paper-angle`控制底板，文字和标签容器的字号、位置、倾角单独控制。
- 新 `tests/opening-labels.test.mjs` 3项保护透明资产/真实DOM/遮挡；新 `scripts/compare-opening-labels.mjs` 做范围保护和4组图；既有 `scripts/verify-opening-static.mjs`仅增加证据目录参数、CSS图解码和保护矩形采样。
- 文档：本README、计划§8、HANDOFF、AGENT_LOG追加和根design-qa.md。本轮没有修改GameUiLayout、ThreeGame、main、mobile-ui、原图或场景。

## 透明素材与最终提示词集

内置ImageGen，按用户图二局部生成无文字纸底；不是整卡裁图。以下是最终提示词约束整理。原始输出保留，仅新纸底裁透明留白/缩放/编码，没有处理角色。目录为 `public/assets/ui/menu/labels/`，合计302,102字节。

| 文件 | 尺寸 | 提示词核心 |
| --- | --- | --- |
| name-deepseek.webp | 1100×236 | 较规整近白象牙色手裁纸，微小不对称缺口、细纤维、轻薄蓝灰下缘；无字/人物/卡片/场景/胶带/折角 |
| name-human.webp | 1100×393 | 较短暖白名字纸，左中浅缺口、右边细小自然撕口、极浅暖影；新鲜薄纸而非旧纸厚板 |
| role-deepseek.webp | 640×200 | 深青蓝#34778a纸带，细纸纹、左浅缺口、右不规则刷口；非圆角按钮或燕尾旗，无文字 |
| role-human.webp | 600×200 | 暖金黄#e3b65d身份纸带，小幅不均匀边和右端缺口；不做棕色旧纸/塑料，页面降低底板不透明度 |
| slogan-deepseek.webp | 1000×221 | 新鲜暖米白薄纸，左端较明显浅撕口，右端少量缺口，长边微起伏，细纤维和极浅接触影；无字/装饰/背景 |
| slogan-human.webp | 1000×211 | 独立暖白口号纸，左右不对称、右端小斜缺口，薄纸无厚重挤出/斜面；无字/人物/卡片/胶带 |

## 检查与限制

- 14项原资源/主流程源码的任务前后摘要一致；两验收比例下LOGO/大卡/人物/开始/设置/页脚矩形差小于0.1像素，见protected-files.json、protection-results.json。
- Chrome/Edge各六尺寸，CSS纸图实际解码后截图；原声音/难度/制作信息、双阵营选择→开始→READY/教学→PLAYING→暂停→返回通过，无运行/HTTP错误。
- 定向13/13，全量1085/1085，独立tsc/build/diff通过；保留原chunk>500kB警告。手机真机/Safari/微信/自然对局/硬件FPS未重验。
- 构建前dist备份为 `C:/Users/bilibili/AppData/Local/Temp/rice-before-labels-37869f53ac7144b7b922922e74a317fc/dist`，现dist仅本地候选。
- 仍有差异：精确纸边缺口、纹理、刷口和字形不是逐像素复制；自检确认不再是纯色矩形近似，不宣称完全还原或90%，等待用户看四组局部验收。
