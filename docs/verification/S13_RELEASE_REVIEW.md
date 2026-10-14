# 已验收成果公开发布审查 — 2026-10-14

## 用户确认与边界

用户确认S13主观试听、三档难度真人平衡体验、原生浏览器缩放人工验收通过，授权普通commit和push到origin/main。发布标题：

`feat: complete S13 audio, difficulty modes and responsive UI`

本次只保存已验收快照，不启动新功能，不创建Tag／Release，不强推或改写历史。具体SHA、推送结果和本地／远端一致性以本次执行回报及Git现场查询核对，文档不写死“当前SHA”。阶段Gate仍按AGENTS定义核验完整归档链，不把授权等同于已推送。

## 复核结果

- 发布前分支main，HEAD与实际远端main均为用户指定的上一公开快照；没有合并、变基或cherry-pick状态。提交／推送前再次读取远端，变化则停止。
- `npm test`重新执行878/878，失败0、取消0、跳过0；独立TypeScript、生产build和diff检查通过。保留既有大于500kB的chunk建议告警，不为发布改玩法。
- GAME_CONFIG仅含已批准的production30000ms及正式模式变更；development5000ms保留。EASY Human倍率0.52、5份米目标及已验收档位不变。地图／家具JSON无差异。
- 正式v6仍由上一快照追踪，本机Git对象与HEAD对象相同；本次没有新GLB，不加入旧版／测试版模型。现有米袋与正式角色资产不变。
- 音频为42个事件ID、37个实际原创Ogg，合计399664字节；五个已弃用事件继续禁用且无文件。生成脚本仅生成37个原创音频，未重生成或纳入第三方参考录音。
- 候选文本扫描没有真实密钥、Token、私人配置或本机文件绝对路径；扫描将HTTP地址与Arrow/Home/End键名从误报中区分，未因字符串名包含token就声称泄密。此次新增素材只有上述原创音频和验收游戏截图，原素材来源声明保持不变。
- 精确清单共126个路径，包含20个源码／样式、14个测试／夹具、1个生成脚本、37个Ogg、13份文档及41张报告引用截图；没有新增大于5MiB文件。文件清单与暂存清单逐项比较，暂存后执行cached check／stat／name-status。

## 排除且保留本机

私人目录 `.trae/`、`.dsh-meow/`、`.codex/`、个人配置、`incoming-assets/`原始素材、旧版GLB、场景JSON备份、dist／缓存、其他历史房间截图、未选中的截图、临时日志与所有本轮原始诊断JSON／浏览器探针均不进入本次暂存；不删除、不移动、不清理或改ignore。报告中原始JSON路径仅指本机证据，公开仓库不承诺提供这些临时文件。已有公开追踪文件不通过ignore伪装移除。

## 已知非阻断限制

favicon404、软件Edge的阴影着色器日志（默认RTX4060／Direct3D11双阵营复测未复现）、现有大chunk告警继续如实记录；未作统计胜率和新增硬件FPS测量。用户体验验收不等于所有潜在问题清零。未发现本次新增的明确素材分发障碍；素材权利依据用户声明与原创生成脚本，不擅自扩大通用授权。

## 精确提交清单

以下逐个文件路径传给Git，不使用目录通配暂存或 `git add .`／`git add -A`。

```text
docs/AGENT_LOG.md
docs/ASSET_PROVENANCE.md
docs/CODEBASE_BALANCE_AUDIT.md
docs/DEEPSEEK_HANDOFF.md
docs/DEV_B_RUNTIME_DEBUG_DESIGN.md
docs/DIFFICULTY_DESIGN.md
docs/GAME_BALANCE_CONFIG.md
docs/verification/DIFFICULTY_REPORT.md
docs/verification/MENU_CREDITS_REPORT.md
docs/verification/MENU_RESPONSIVE_REPORT.md
docs/verification/S13_AUDIO_REPORT.md
docs/verification/S13_RELEASE_REVIEW.md
docs/verification/UI_REFRESH_REPORT.md
docs/verification/difficulty/chrome-deepseek-hard-pause.png
docs/verification/difficulty/chrome-deepseek-hard-result.png
docs/verification/difficulty/chrome-live-rice-half.png
docs/verification/difficulty/chrome-menu-1366.png
docs/verification/difficulty/chrome-menu-1920.png
docs/verification/difficulty/chrome-menu-960.png
docs/verification/difficulty/edge-human-hard-pause.png
docs/verification/difficulty/edge-human-hard-result.png
docs/verification/difficulty/edge-menu-1366.png
docs/verification/menu-responsive/before-chrome-960x450.png
docs/verification/menu-responsive/chrome-110-css-viewport-bottom.png
docs/verification/menu-responsive/chrome-110-css-viewport-top.png
docs/verification/menu-responsive/chrome-150-css-viewport-bottom.png
docs/verification/menu-responsive/chrome-150-css-viewport-top.png
docs/verification/menu-responsive/chrome-200-css-viewport-bottom.png
docs/verification/menu-responsive/chrome-200-css-viewport-top.png
docs/verification/menu-responsive/chrome-short-top.png
docs/verification/menu-responsive/edge-110-css-viewport-bottom.png
docs/verification/menu-responsive/edge-110-css-viewport-top.png
docs/verification/menu-responsive/edge-150-css-viewport-bottom.png
docs/verification/menu-responsive/edge-150-css-viewport-top.png
docs/verification/menu-responsive/edge-200-css-viewport-bottom.png
docs/verification/menu-responsive/edge-200-css-viewport-top.png
docs/verification/s13/chrome-deepseek.png
docs/verification/s13/chrome-human.png
docs/verification/s13/chrome-pause-no-sheet-decor.png
docs/verification/s13/chrome-result-corrected-win-1366.png
docs/verification/s13/chrome-result-no-sheet-decor.png
docs/verification/s13/chrome-startup-broken.png
docs/verification/s13/chrome-startup-normal.png
docs/verification/s13/chrome-victory.png
docs/verification/s13/edge-deepseek.png
docs/verification/s13/edge-human.png
docs/verification/s13/edge-victory.png
docs/verification/ui-refresh/chrome-DEEPSEEK-hud.png
docs/verification/ui-refresh/chrome-DEEPSEEK-pause.png
docs/verification/ui-refresh/chrome-DEEPSEEK-result-960.png
docs/verification/ui-refresh/chrome-DEEPSEEK-settings.png
docs/verification/ui-refresh/chrome-HUMAN-hud.png
docs/verification/ui-refresh/chrome-menu.png
docs/verification/ui-refresh/chrome-pulselock.png
public/assets/audio/back.ogg
public/assets/audio/capture.ogg
public/assets/audio/caught.ogg
public/assets/audio/chase.ogg
public/assets/audio/click.ogg
public/assets/audio/confirm.ogg
public/assets/audio/countdown.ogg
public/assets/audio/countdownLast.ogg
public/assets/audio/defeat.ogg
public/assets/audio/doorFail.ogg
public/assets/audio/doorLock.ogg
public/assets/audio/doorUnlock.ogg
public/assets/audio/eatComplete.ogg
public/assets/audio/eatInterrupt.ogg
public/assets/audio/eatLoop.ogg
public/assets/audio/eatStart.ogg
public/assets/audio/error.ogg
public/assets/audio/fall.ogg
public/assets/audio/game.ogg
public/assets/audio/hideEnter.ogg
public/assets/audio/hideExit.ogg
public/assets/audio/hover.ogg
public/assets/audio/menu.ogg
public/assets/audio/pulseCorrect.ogg
public/assets/audio/pulseInput.ogg
public/assets/audio/pulseSuccess.ogg
public/assets/audio/pulseWrong.ogg
public/assets/audio/recover.ogg
public/assets/audio/restart.ogg
public/assets/audio/room.ogg
public/assets/audio/search.ogg
public/assets/audio/skill.ogg
public/assets/audio/skillReady.ogg
public/assets/audio/skillUnavailable.ogg
public/assets/audio/start.ogg
public/assets/audio/stun.ogg
public/assets/audio/victory.ogg
scripts/generate-s13-audio.mjs
src/config/difficultyConfig.ts
src/config/gameConfig.ts
src/faction-menu.css
src/game-ui.css
src/industrial-ui.css
src/main.ts
src/s13-ui.css
src/style.css
src/systems/AILogCollector.ts
src/systems/DeepSeekAIController.ts
src/systems/HumanAIController.ts
src/systems/RuntimeDebugOverrides.ts
src/three/AudioSettingsView.ts
src/three/DifficultyView.ts
src/three/GameAudio.ts
src/three/GameFeedback.ts
src/three/GameUiLayout.ts
src/three/MenuCreditsView.ts
src/three/StartupView.ts
src/three/ThreeGame.ts
tests/deepseek-ai.test.mjs
tests/deepseek-door-lock-decision.test.mjs
tests/deepseek-door-lock-longrun.test.mjs
tests/dev-b-param-persistence.test.mjs
tests/difficulty.test.mjs
tests/faction-card-ui.test.mjs
tests/game-audio.test.mjs
tests/game-state.test.mjs
tests/menu-credits.test.mjs
tests/menu-responsive.test.mjs
tests/rice-field.test.mjs
tests/s7d-full-match.test.mjs
tests/s7d-match-sim.mjs
tests/sprint.test.mjs
```
