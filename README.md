# 谁吃了我的米

《谁吃了我的米》是一款使用 Three.js 制作的双阵营单机追逐游戏。DeepSeek 娘尝试吃完每局激活的 5 份米，Human 通过抓捕赢得对局。

## 本地运行

```sh
npm ci
npm run dev
```

开发服务器地址为 `http://127.0.0.1:5173/`。检查命令：`npm test`、`npx tsc --noEmit`、`npm run build`。

## 公开版角色资源

正式角色为 `public/assets/characters/deepseek/deepseek_animated_v6_hair.glb`，包含骨骼动画及内嵌贴图；用户确认该模型为自制原创资产，并授权公开上传至本仓库。公开版与本机优先使用同一模型及头发动态，加载失败时使用程序化角色回退。旧版和测试模型不包含在公开快照中。

素材来源与发布范围见 [`docs/ASSET_PROVENANCE.md`](docs/ASSET_PROVENANCE.md) 和 [`docs/PRE_S13_SNAPSHOT_REVIEW.md`](docs/PRE_S13_SNAPSHOT_REVIEW.md)。
