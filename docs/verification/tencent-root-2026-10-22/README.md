# 腾讯云根路径构建准备 — 2026-10-22

本次仅生成并本地验证独立 `dist-tencent/`。不上传、不部署、不触发 GitHub Pages，不提交或推送 Git。原 `dist/` 与历史材料保留。实际构建、资源清单及浏览器结果在本目录记录。

## 配置检查与最小修正

- 原 `vite.config.ts` 默认 base 为 `/`；只有构建时 `PAGES_DEPLOYMENT=true` 才采用 `/who-ate-my-rice/`。CLI `--base=/` 明确覆盖，未修改 Vite 配置、package 脚本、index.html 或 Pages 工作流。
- 原 `dist/index.html` 两个入口带 Pages 子路径，本轮另建目录，不改写它。原 dist 的99项文件SHA256前后逐项相同，见 [原始摘要](original-dist.json) 与 artifact.json 的核验说明。
- 首次推荐命令确实失败：production-assets 插件只允许 dist。最小修正 `scripts/production-assets.mjs`：仅允许项目内 `dist` 和 `dist-tencent`，保留真实路径/重定向检查、六项历史模型构建副本过滤；没有删除 public 原始模型。不能任意输出到 src/public/其他工程。
- `tests/production-assets.test.mjs` 增加独立目录原件保护和两种符号链接/重定向回归；`.gitignore` 仅增加根 `/dist-tencent/`，避免产物误入库。
- `scripts/verify-pages-preview.mjs` 复用静态服务/浏览器验证，允许显式根路径和输出目录；默认 Pages 行为不变。补全部99文件HTTP字节检查、真实PLAYING断言，并修正缺失文件时先发200导致重复响应头的问题。未向游戏加测试全局或改游戏入口。

## 构建与资源

实际成功命令：

```powershell
npm run build -- --base=/ --outDir dist-tencent
```

输出：`D:\桌面\dev\who-ate-my-rice\dist-tencent`，base **`/`**。99文件、44,305,670字节，约42.25MiB（44.31MB十进制）。文件路径、大小、SHA256及旧dist保护结果见 [artifact.json](artifact.json)。

| 资源 | 实际产物 |
| --- | --- |
| HTML | index.html |
| JS | assets/index-BuhIr99p.js，1,211,786字节 |
| CSS | assets/index-B8AblkHA.css，82,301字节 |
| 角色GLB | assets/characters/deepseek/deepseek_animated_v6_hair.glb，12,496,972字节 |
| 米袋GLB | assets/props/rice-bag/rice-bag.glb，632,704字节 |
| 音频 | 37 Ogg + 2 MP3，共39项 |
| 图片 | 36 PNG + 15 WebP + 1 SVG，原立绘/纸张/菜单资源不替换 |
| 地图 | apartmentMap.ts、sceneLayout.json、throwableLayout.json、roomLightLayout.json 通过原导入打进JS，不需要另上传src地图文件 |

原public中其他配套文件按既有构建保留，包括ui说明和maps占位；没有为本轮清理原有资产。全部审核public文件（扣既有历史模型排除项）与产物逐项哈希相同，产物无意外多余文件。入口均为 `/assets/...`，JS/CSS未出现 Pages 子路径、localhost/127.0.0.1开发资源地址、Vite客户端、src入口或DEV保存接口。

## 实际验证

| 项目 | 本轮结果 |
| --- | --- |
| npm test | 1100/1100，失败/取消/跳过0；不是沿用上一轮1097 |
| 生产资产/Pages定向 | 17/17，其中资产过滤8项，原Pages9项仍通过 |
| npx tsc --noEmit | 退出0，独立执行 |
| 腾讯云生产构建 | 退出0，138模块；保留既有chunk>500kB警告 |
| 根路径静态资源 | 全部99项逐个HTTP200，响应字节与磁盘一致；缺失URL返回404，不用HTML回退伪装成功 |
| Chrome / Edge | 真实安装版无头浏览器，1920×1080，双阵营选择→READY/教学→PLAYING→暂停→返回通过；各16项实际请求音频解码，无pageerror或必需资源404 |
| 原dist保护 | 99文件哈希/数量不变，Pages配置和工作流未改 |
| Git差异检查 | 退出0，仅保留LF→CRLF提示；无暂存/提交/推送 |

根路径最终浏览器记录：[browser-final/results.json](browser-final/results.json)。实拍：[Chrome开屏](browser-final/chrome-production-menu.png)、[Edge开屏](browser-final/msedge-production-menu.png)、[DeepSeek入局](browser-final/chrome-production-DEEPSEEK.png)、[Human入局](browser-final/msedge-production-HUMAN.png)。历史Pages产物只做本地兼容复核，没有运行线上工作流。

复验浏览器：设置本机可用PLAYWRIGHT_MODULE，PREVIEW_ROOT=dist-tencent、PREVIEW_BASE=/、PREVIEW_ARTIFACT_DIR为新证据目录，运行 `node scripts/verify-pages-preview.mjs`。临时静态服务器只绑定127.0.0.1随机空闲端口，验证结束自行关闭，不占用/停止现有5173开发服务。完整原始日志留本地，不当作已提交材料。

## 手动上传说明

上传 **dist-tencent目录里面的全部内容**，不是工程根目录，不是原dist，不仅是assets。网站根目录结构应为：

```text
网站根/
  index.html
  assets/
  ui/
  maps/
```

如果腾讯云控制台要求“选择部署文件夹”，选择dist-tencent；若要求压缩包，压缩包解压根层应直接出现index.html及上述子目录，不再套一层dist-tencent。不要上传src、node_modules、docs、私人配置或Git文件。

## 限制与交付边界

本机根路径加载通过不等于腾讯云线上已验证；未登录腾讯云、未上传、未改域名/CDN/缓存/鉴权或网站配置，也未触发Pages。实际网站HTTPS、MIME、缓存及访问权限需上传后检查。保留大包警告和此前真机/系统后台等未验项，不将浏览器无头验证冒充真机或音响听感。无新增玩法、角色、HUD、音频规则改动。

本轮改动仅构建/验证工具、对应测试、忽略独立产物及交付/交接/追加日志；均留本地待用户决定是否归档，不使用上一轮Git推送授权。本次任务到此停止，等待用户手动上传。
