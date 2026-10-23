# 开屏标签再右移与 Human 立绘替换 — 2026-10-22

本轮为既有设计的局部延伸（Extension）：沿用已确认的纸张标签、卡片、字体、颜色和动态，不重新设计或实施新的浏览器缩放方案。等待用户视觉确认，不记 Git Gate PASS。

## 完成内容

- 两张卡片的名称/身份组和口号统一再右移卡宽的2个百分点：DeepSeek名称组14.5%→16.5%、口号10%→12%；Human名称组13%→15%、口号9%→11%。1920视口分别约12.2px和11.1px。字体、纸底、倾斜、层级不改。
- 开屏 Human 使用用户提供的透明PNG原图，1024×1536、1436403字节；无AI重绘、裁剪、压缩或改色。源图/public/dist的SHA256一致：`b82ade694981139231ed879c251b18080788d359841328ca1f6705099606da5e`。
- 新图保存为 `public/assets/ui/portraits/human-hoodie-v1.png`，使用BASE_URL适配路径。旧 `human-guardian-v1.webp` 保留，结算页仍使用旧图；游戏内Human GLB和动作未修改。
- 仅Human图片显示框调整为卡宽85%、高118%、top -10%、right -3%，object-fit:contain等比显示，头脚完整。首次right -10%导致390宽下透明图片框产生横向溢出，已收回并重测。

## 本轮真实证据

| 路径 | 内容 |
| --- | --- |
| [final/static-1920x1080.png](final/static-1920x1080.png) | Chrome最终开屏，1920×1080 |
| [edge-recheck/msedge-static-1920x1080.png](edge-recheck/msedge-static-1920x1080.png) | Edge最终开屏，1920×1080 |
| `final/static-*.png`、`edge-recheck/msedge-static-*.png` | 两浏览器各1768×890、1600×900、1366×768、960×450、390×844及1920截图 |
| [final/browser-results.json](final/browser-results.json)、[edge-recheck/msedge-browser-results.json](edge-recheck/msedge-browser-results.json) | 真实图片加载/等比/无横溢出、设置与正式开局流程 |
| [zoom/results.json](zoom/results.json)、`zoom/*.png` | Chrome/Edge各25/100/125/150/200/250/300%的等效CSS视口+DPR检查，14组通过 |
| [test-results.txt](test-results.txt) | 本轮最后一次完整npm test输出 |

沿用本地5173服务，使用独立无头Chrome/Edge，无用户浏览器配置写入。与上一轮flow-chrome矩形对比：六尺寸LOGO、主卡片、开始按钮、设置栏、页脚及DeepSeek立绘均不变。新Human为原图正常身材而非旧Q版，视觉宽度更窄，这是用户指定替换素材的差异。

根目录第一轮 `static-*.png` 是中间态，不作为最终证据；`final/`为最终Chrome。Edge首次与多浏览器并行截图时超时，单独重跑在`edge-recheck/`全部通过，不放宽测试或隐藏超时。

## 测试结果

| 检查 | 实际结果 |
| --- | --- |
| npm test | 1124/1124，失败/取消/跳过0，191.30秒 |
| npx tsc --noEmit | 通过，退出0 |
| npm run build | 通过，143模块；保留已有>500kB chunk警告 |
| git diff --check | 通过，退出0；已有LF/CRLF提示保留 |
| Chrome/Edge | 各六尺寸通过；图片加载/contain/横向溢出检查通过，HTTP及pageerror均0 |
| 主流程 | 两浏览器各双阵营：选择→开始→教学（适用时）/PLAYING→暂停→返回选择通过；五音量、静音、三难度、ESC焦点及制作信息通过 |
| 等效缩放回归 | 14组通过，每组音量/难度/制作信息操作通过，未操作真实工具栏缩放 |

## 文件、限制与交付状态

- 修改源码：`src/opening-menu.css`、`src/three/GameUiLayout.ts`。
- 修改测试：`tests/faction-card-ui.test.mjs`、`tests/opening-labels.test.mjs`、`tests/pages-deployment.test.mjs`。新增原图字节哈希/尺寸和右移保护，保留结算页旧图及Pages子路径断言。
- 新增原图及本目录证据；更新HANDOFF、阶段计划§12，AGENT_LOG只追加。没有移动/删除旧文件，未触碰其他已有修改和私人目录。
- 无已知阻断问题；标签位置/新Human大小仍待用户视觉确认。未实测原生工具栏缩放或手机真机，不宣称本轮完成全动态/长期性能复验。
- 默认dist已重建并包含原图；dist-tencent未重建。没有暂存、提交、推送、Tag/Release或部署。下一步刷新本地页面验看，不自动归档或部署。
