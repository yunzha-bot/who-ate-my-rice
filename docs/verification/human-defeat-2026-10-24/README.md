# Human失败独立插画与腾讯云目录 — 2026-10-24

## 完成内容与文件

用户明确指定新图替换人类失败结算，授权正常Git提交/推送及准备腾讯云目录。基线main/HEAD/origin/main/远端一致，历史点fb747ad2c2b57c85ec76db1db75e476036ddabbf；无已修改追踪文件、空索引，无合并/变基。

- 新增public/assets/ui/portraits/human-report-lose-v1.png：用户原PNG，1536×1024 RGBA，2373138字节，SHA256 `7046faeab56c6bcd34e9e71bd51cf17da1648af39cfd4da91d5d4f6f9d2ad88c`。原样复制，不覆盖旧图或改原件。
- src/three/GameUiLayout.ts：HUMAN_LOSE资源入口；既有updateResultPortrait按赢家切换Human胜/负图及宽高，原Human获胜图和DeepSeek两图保留。重复结算可恢复正确图，不新建胜负状态或改玩法。
- tests/faction-card-ui.test.mjs：原PNG哈希/尺寸/透明通道及失败→获胜反复切换、DeepSeek保护检查。
- scripts/verify-human-results.mjs：实际双浏览器结算回归；scripts/verify-tencent-build.mjs显式审核新资源和产物新图引用。
- 根README、docs/README统一索引、HANDOFF、素材来源同步，AGENT_LOG只追加，本目录保存必要新证据。没有更改开屏、模型、持物值、布局或CSS；沿用原失败灰度/opacity .65，不额外去色原PNG；触屏仍按原规则隐藏装饰图。

## 本轮实际检查

| 项目 | 结果 |
| --- | --- |
| 定向 | 17/17，插画/结算与Pages base合同 |
| npm test | 1128/1128，失败/取消/跳过0，63.50秒 |
| 独立tsc / 默认build / Tencent build | 均退出0，143模块；保留chunk>500kB提示 |
| npm audit --audit-level=high | 0漏洞 |
| Chrome154 / Edge151结算 | 各5条，共10条：Human失败→获胜→再失败，DeepSeek失败/获胜；新图加载/尺寸/contain、原图恢复及返回菜单通过，错误0 |
| 生产根路径 | 103文件HTTP/字节核对，缺失URL404；两浏览器各双阵营READY/教学/PLAYING/暂停返回，各16音频解码通过，错误0 |

结算验证通过测试页调用现有match.forceCapture / advancePlaying触发，不冒充自然打完整局。已查看本轮Chrome Human失败实际截图；手机真机、腾讯云域名/CDN缓存/MIME不在本轮已验证范围。

### 真实截图与清单

- [Chrome人类失败新图](browser/chrome-HUMAN-lose.png)、[Edge人类失败新图](browser/msedge-HUMAN-lose.png)
- [人类获胜图保留](browser/chrome-HUMAN-win.png)、[DeepSeek失败图保留](browser/chrome-DEEPSEEK-lose.png)、[DeepSeek获胜图保留](browser/chrome-DEEPSEEK-win.png)
- [10条切图/返回记录](browser/results.json)
- [Chrome生产开屏](production/chrome-production-menu.png)、[Edge生产开屏](production/msedge-production-menu.png)、[生产检查结果](production/results.json)
- [103文件路径/大小/SHA256](artifact.json)

## 腾讯云上传目录

`D:\桌面\dev\who-ate-my-rice\dist-tencent`

- `npm run build -- --base=/ --outDir dist-tencent`，base=/；103文件共50,691,036字节，含新失败PNG（与输入哈希完全一致）。
- JS：assets/index-C6SvuAHU.js，1,234,576字节；CSS：assets/index-D9WnF5S0.css，86,995字节。原图片/GLB/音频保留，地图随JS打包；无错误Pages子路径或开发地址。
- 原目录完整保留于dist-tencent-delivery/previous-before-human-defeat-20261024-153302，未删除旧包。本轮仍交付文件夹，不生成新ZIP，不移动旧Tag/Release。
- 上传此文件夹或内部内容时，站点根层需直接对应index.html、assets/、maps/、ui/；若保留外层文件夹，请将站点文档根目录指向其内部。旧ZIP和旧Tag不包含本次失败图，不能当作此轮最新包。

源码/文档/必要证据正常推送GitHub，dist-tencent及备份仍被Git忽略；不公开私人配置/候选原件/场景备份/未知材料。用户手动上传腾讯云后，再核验缓存和实际两阵营流程。此轮未登录云平台、未触发Pages或自动部署；Git实际提交/远端结果在回执补记。
