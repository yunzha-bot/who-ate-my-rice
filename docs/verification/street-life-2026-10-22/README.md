# 室外街道生活化布景 — 2026-10-22

## 范围与实际实现

用户在询问室外太空后明确要求改善。本轮按静态生活化布景实施，不增加行人 AI、行驶车辆或室外玩法。

- 街角便利店：条纹雨棚、店名招牌、橱窗层架、两组果蔬箱、带纸箱的配送手推车、入口盆栽；中间门口留空。
- 停车区：在既有车棚旁增加两辆低多边形汽车、停车划线、局部铺地和充电设施，不占行车道。
- 住宅门前：门牌、挂墙信箱、门垫、盆栽；邻里公告牌、指路牌及井盖补充街道细节。
- 复用原建筑位置、色调、场景照明与相机。开屏排版、角色、输入、HUD、地图 JSON、碰撞/导航/AI/玩法数值未更改。

新增150个基本形体按形状和颜色合并为19个 InstancedMesh（实例化网格），共享3种几何体和材质；另用小型Canvas纹理绘制门牌/招牌。不增加动画循环、监听器或依赖。配置/坐标在StreetLifeView内部，属于视觉实现常量，不是玩法参数。

## 真实浏览器证据

全部为本轮本地5173页面生成，Chrome/Edge，1600×900。`*-inspection`为同一真实Three.js场景的**专用检查镜头**，不是正常菜单或正式游戏镜头；脚本临时停帧、隐藏UI并调整观察点，不修改运行时相机源码。

| 内容 | Chrome | Edge |
| --- | --- | --- |
| 原开屏构图 | [开屏](chrome-opening.png) | [开屏](msedge-opening.png) |
| 小店细节 | [实景检查](chrome-shop-inspection.png) | [实景检查](msedge-shop-inspection.png) |
| 停车区 | [实景检查](chrome-parking-inspection.png) | [实景检查](msedge-parking-inspection.png) |
| 住宅门前 | [实景检查](chrome-homes-inspection.png) | [实景检查](msedge-homes-inspection.png) |
| DeepSeek开局 | [正式游戏镜头](chrome-DEEPSEEK-playing.png) | [正式游戏镜头](msedge-DEEPSEEK-playing.png) |
| Human开局 | [正式游戏镜头](chrome-HUMAN-playing.png) | [正式游戏镜头](msedge-HUMAN-playing.png) |

修改前实景保留在[before目录](before/)。[实际结果](results.json)包含各浏览器双阵营PLAYING/返回菜单断言与pageerror；检查脚本为`scripts/verify-street-life.mjs`。脚本仅在隔离浏览器请求中暴露game实例，未给正式代码加入调试全局变量。

浏览器检查中修正了招牌被雨棚遮住、盆栽落入绿篱的问题。正常开屏的角色卡片仍会遮挡部分室外区域，未为了展示布景移动已验收UI或扩大正式镜头。

## 本轮实际检查

| 项目 | 最终结果 |
| --- | --- |
| 外景/表现/资源释放定向测试 | 38/38，含新增3项街道布景测试 |
| npm test | 1111/1111，失败/取消/跳过0，约80.36秒 |
| npx tsc --noEmit | 通过 |
| npm run build | 通过，141模块；保留既有chunk大于500kB警告 |
| git diff --check | 通过；Git的LF→CRLF提示不是差异错误 |
| Chrome/Edge | 各两阵营开局→PLAYING→输入→Esc→返回菜单，合计4条流程通过，无pageerror |
| 几何与保护 | 新物件在主屋外；入口不堵塞、汽车在停车地块、盆栽接触真实支撑且不进绿篱，保留旧17项外景几何检查 |

首次全量1110通过/1失败：旧地图清理按每个Mesh释放geometry，新共享资源导致重复dispose。已最小修正MapBuilder为按唯一资源释放，并释放InstancedMesh的实例缓冲；测试改为验证每份唯一几何体释放一次和每个实例网格释放，保留原raycast/家具索引/场景移除断言。修复后完整重跑1111通过，未跳过失败项。

渲染器采样：本轮Chrome约1246 calls/143956 triangles、Edge约1245/131958，均1174 geometries/24 textures。修改前Chrome记录1214 calls/138774 triangles/1162 geometries/15 textures。动态帧/视锥剔除不同，**不能据此宣称FPS提升或等同的严格性能A/B**。通过实例化控制新增绘制成本，但未做真机/低端设备帧率验收。

## 本轮文件与交付状态

- 新增`src/three/StreetLifeView.ts`：静态布景构建与实例化。
- 修改`src/three/ResidentialExterior.ts`：单点接入，盆栽支撑查询加入既有建筑基座。
- 修改`src/three/map/MapBuilder.ts`：相关共享资源去重释放及实例缓冲清理。
- 新增`tests/street-life.test.mjs`；修改`tests/alpha-presentation.test.mjs`资源释放断言。
- 新增`scripts/verify-street-life.mjs`及本目录证据；同步HANDOFF、追加AGENT_LOG。

既有其他未提交改动、历史证据、备份和私人目录保留；未暂存、提交、推送、Tag、Release或部署，不记Git Gate PASS。默认dist已重建，dist-tencent未重建。本轮仍待用户对布景密度与风格的实际视觉确认；静态物件不等同于已经加入动态街道人流。
