# Human结算立绘替换 — 2026-10-23

## 修改

- `public/assets/ui/portraits/human-report-hoodie-v1.png`：原样复制用户图一，1312×1199 RGBA，2,150,193字节。SHA256 `e3cd1ff062348ca132c0da4d54bb0c0b2cb7e8c812ae7937d0b04b89372b5ad8`，生产dist副本一致；未生成、重画、调色或覆盖旧图。
- `src/three/GameUiLayout.ts`：UI_PORTRAITS.HUMAN指向新图，结算img宽高声明匹配原图；沿用object-fit:contain及现有结算区域。
- `tests/faction-card-ui.test.mjs`：新增原图哈希/尺寸/透明通道/结算引用测试，明确旧资源仍存在。
- `scripts/verify-tencent-build.mjs`：将新图加入显式审核资源列表；仅语法检查通过，本轮未重建或审核旧Tencent包。
- 更新HANDOFF及追加AGENT_LOG、本目录证据；不改开屏、3D模型、玩法、结算按钮和DeepSeek结算图。

## 实际检查

| 项目 | 本轮结果 |
| --- | --- |
| npm test | 1126/1126，失败/取消/跳过0，63.44秒 |
| 独立tsc / 默认生产构建 / git diff --check | 退出0；143模块，既有chunk>500kB及LF/CRLF警告保留 |
| Chrome / Edge | 共6组：Human主控Human胜、Human主控DeepSeek胜、DeepSeek主控Human胜；新图加载尺寸/contain、WIN/LOSE、原DeepSeek落败图及返回菜单通过，页面/HTTP错误0 |

结算由测试页暴露的game实例调用原match.forceCapture / advancePlaying触发，实际UI渲染截图，不是模拟图片或自然完成完整对局。Human主控负局沿用同一Human图的原有灰度规则，未新开发胜负插画切换；触屏仍按原规则隐藏结算装饰，本轮未验手机真机。

- [Chrome Human获胜](chrome-HUMAN-HUMAN.png)
- [Edge Human获胜](msedge-HUMAN-HUMAN.png)
- [Human主控负局](chrome-HUMAN-DEEPSEEK.png)
- [DeepSeek结算不变](chrome-DEEPSEEK-HUMAN.png)
- [6组浏览器记录](results.json)

已查看本轮Chrome人类获胜截图；待用户观感验收。未暂存/commit/push/Tag/部署；默认dist更新，dist-tencent与旧ZIP未更新，上线前须重新生成。
