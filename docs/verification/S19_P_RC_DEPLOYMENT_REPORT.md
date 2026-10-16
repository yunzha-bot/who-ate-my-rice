# S19-P 首次GitHub Pages RC部署记录

日期：2026-10-16。仅首次RC测试版；不创建rc2/v1.0.0 Tag或Release，不代表S20验收完成。

## 1. 授权与提交前准入

用户批准第二次验收，允许修复localStorage getter故障，通过全部门禁后正常提交/推送已审核适配文件、设置Pages Source为GitHub Actions并手动部署该批准提交。异常停止，不强推、不自动重跑失败部署、不改变模型加载策略。

本报告创建时已完成本地准入；Git、Actions及公网结果在实际执行后追加，不预填成功。原`v1.0.0-rc1`仍指向历史里程碑870c69050cf80ff83aa79531e7d9f2590a8834d5，附注Tag对象b7194124e0c328ff59882642392e17c60f39ee28，Release ID414708471；不移动或修改。

## 2. 最小修复与测试

- 仅将ThreeGame创建GameAudio时的存储获取包入try/catch，getter不可用时传null。GameAudio源码、声音节点/播放/音量规则、玩法、UI、所有模型/地图/音频和36件投掷物布局不变。
- 新增`tests/audio-storage-startup.test.mjs`，提取并执行ThreeGame真实字段初始化表达式，覆盖正常存储、getter SecurityError、getItem拒绝、setItem拒绝及无存储共5项。先得到4通过/1失败，修复后5/5；真实Chrome/Edge各4种存储环境均能启动/选择，共8项通过。
- Node VM的直接全局typeof会抑制该getter异常，因此测试使用普通对象作用域保留真实异常语义；没有把错误的绿色测试当作修复证据。浏览器检验覆盖实际ThreeGame构造流程。
- 手动工作流增加必填approved_sha，并要求github.sha与之相等，避免main变化时部署未审核提交。原手动触发、生产限定、仅dist上传、最小权限和configure-pages enablement:false保持。

| 本轮重新执行 | 结果 |
|---|---|
| 全量npm test | 963/963；失败/取消/跳过0，最终约84.95秒 |
| 独立TypeScript | 通过 |
| 根路径生产构建 | 通过；保留4173根预览，未写入Pages base |
| 隔离Pages生产构建 | 通过；86文件、43,050,329字节，正式v6/米袋两个GLB；83public原字节 |
| 产物与diff | 只读门禁和diff通过；既有大chunk警告保留，不隐藏 |
| 哈希保护 | 原339项集合332项不变，7项为授权的5代码/配置及README/方案；地图、AI、平衡、声音、模型和投掷物点位不变 |
| 日志保护 | 本轮开工日志字节前缀保持，后续只追加 |
| Chrome/Edge本地回归 | 各6诊断组合＋6原包组合；v6/动画、投掷、暂停、设置、重开、DEV/ZCX隔离、布局/Hover和39音频完成 |
| 既有服务 | 原5173/4173及其监听进程保持；DEV编辑器只打开/关闭，无正式保存POST |

完整证据见 [本轮本地结果](s19-p/local-results.json)、[本地产物清单](s19-p/pages-dist-manifest.json)、[保护检查](s19-p/protection.json)。本轮根预览JS为index-DZaDEaTZ.js，Pages JS为index-Ca4juWGy.js；构建目录及临时浏览器使用隔离位置。

本地未注入轮Chrome网络失败0、Edge记录1次v6 ERR_ABORTED，模型/动画实际就绪、39音频均成功解码、pageerror均0。诊断及故障注入的取消/预设失败分别记录，不称为零异常，不为追求零日志修改加载策略。原 [pages-local证据](pages-local/browser-results.json) 与修复前存储失败记录完整保留。

## 3. 待提交边界

精确清单见 [本轮提交文件](S19_P_SUBMISSION_FILES.txt)，包括已验收Pages适配、此次最小修复、对应测试、手动工作流、说明及明确命名的验收证据。不使用git add .或-A，不提交dist、原GLB、私人配置、场景备份、incoming-assets或其他既有未跟踪验收目录。

只读GitHub预检确认main仍为原里程碑、现有登录具有admin/push/workflow权限，Actions启用、Pages GET404；未创建新Token。原Release已再次GET核对且不会使用Release写接口。

## 4. 部署与公网验证方法

门禁通过并复核远端后，正常提交、推送main。首次Pages仅配置build_type=workflow，不设仓库根目录为legacy发布源；手动工作流提交approved_sha并核对run.head_sha、build/deploy两job和同一artifact。原Tag/Release不动，不启用push自动部署。[GitHub Pages官方REST接口](https://docs.github.com/en/rest/pages/pages?apiVersion=2026-03-10)、[手动工作流接口](https://docs.github.com/en/rest/actions/workflows?apiVersion=2026-03-10#create-a-workflow-dispatch-event)。

公网一致性以GitHub Actions实际artifact为准：Linux检出的文本换行和Windows本地产物可能不同，不能强行要求跨平台JS哈希相同。下载同一成功run的github-pages artifact，核对来源提交/清单、模型及39音频，再逐项比较实际HTTPS字节与该artifact，不以HTTP200代替内容一致。

Chrome/Edge分别检查真实HTTPS菜单、双阵营三难度、暂停/设置/投掷、v6与动画/米袋、39音频、DEV/ZCX隔离和Network。内存诊断探针与未改动的公网原包分开，探针不上传。不将场景夹具或强制结算称作自然对局/胜率平衡。

大陆三运营商无代理计划仍按 [既定计划](GITHUB_PAGES_MAINLAND_ACCESS_PLAN.md) 留待真实测试；当前受控环境的运营商、地理出口及代理状态未独立核实，任何可达结果都不能填写为大陆无代理验收。素材权利边界沿用来源账本，本次部署授权不是通用第三方权利保证。

## 5. 实际执行结果

待Git推送、Actions和首次公网检查完成后按实际结果追加。若权限、工作流、产物或公网关键检查失败，停止后续发布操作，仅记录失败与所需人工决定，不自动修复线上内容或创建新发布版本。
