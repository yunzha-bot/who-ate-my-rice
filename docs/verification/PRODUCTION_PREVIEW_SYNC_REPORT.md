# 正式预览玩法同步与镜头快捷键隔离

2026-10-16。用户要求把当前更新玩法同步正式版，并移除正式版Z/C视角切换。本轮同步到本地生产预览4173，不代表公开部署或Git归档。

## 修改

- `src/three/ThreeGame.ts`：仅在 `import.meta.env.DEV` 中处理Z/C旋转及配套X恢复默认镜头。保持原cameraEnabled、镜头跟随、camera-relative移动、镜头偏移/缩放及编辑器行为不变。生产构建实际消除了这三个键的操作分支，不是仅隐藏提示。
- `tests/production-tools.test.mjs`：新增开发/生产常量折叠回归，修前因生产KeyZ仍存在而失败，修后通过。断言生产无KeyZ/KeyC/KeyX及对应turn/restore调用，开发保留，同时保留镜头更新和玩家跟随。
- `README.md`：说明该组快捷键只属于开发版5173。另更新本报告、交接及追加日志，不修改玩法数值或资产。

## 同步内容与保护

重新执行标准生产构建，最新运行脚本为 `index-BKlcUlW_.js`，CSS仍为 `index-CrqVpTD3.css`。当前投掷玩法、3000ms眩晕、盆命中音、DeepSeek被抓NOPE以及用户已保存的道具布局沿用当前源码/素材，不重新制作或重复接入。

330项文件快照在新增失败回归之后、运行实现修改之前取得；对照只有ThreeGame.ts变化，无文件缺失。配置、难度、AI、两个布局JSON、模型、手持位置及所有39音频原件均未改。39个音频在dist中的字节哈希与public原件逐个一致；八个浏览器会话中的36个道具位置均与当前JSON一致。

## 验证

| 检查 | 结果 |
|---|---|
| 生产工具专项 | 5/5；新增镜头隔离回归先红后绿 |
| 全量 `npm test` | 949/949，失败/跳过/取消0，约64.56秒 |
| 独立TypeScript | 通过 |
| `npm run build` | 通过；原大chunk告警保留 |
| `git diff --check` | 通过 |
| 实际生产包 | KeyZ/KeyC/KeyX字符串均不存在，39音频逐个同步 |
| Chrome/Edge × 开发/生产 × 双阵营 | 8会话均通过；明确goto并核对5173/4173 URL及标题，原生Z/C/X在正式版无效、开发版有效，移动、暂停/恢复正常，正式DEV入口缺席，页面/资源异常0 |
| 最新生产盆命中音 | Chrome/Edge双阵营共4次场景检查：真实鼠标投掷命中一次MP3节点、盒子/花瓶命中及盆落空不触发金属声、静音/暂停清理通过 |

盆命中检查使用合法位置的明确内存夹具，不冒充自然整局；自动播放节点与解码不等于人耳试听。此次没有重新宣称难度胜率或原生缩放验收。

证据：[汇总](production-preview-sync/verification.json)、[镜头检查](production-preview-sync/camera-browser.json)、[命中音检查](production-preview-sync/basin-browser.json)、[Chrome正式版](production-preview-sync/chrome-DEEPSEEK-production.png)、[Edge正式版](production-preview-sync/edge-HUMAN-production.png)。

原5173/4173服务保留，刷新4173加载新包；若页面仍持有旧标签页代码，使用Ctrl+F5重新加载。未暂存/commit/push/Tag，未创建阶段或推进Gate，未上传线上站点。新增用户音频的公开分发许可仍按来源记录待核验。
