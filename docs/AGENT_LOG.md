# 《谁吃了我的米》Agent 工作日志

> 本文件记录实际完成并验证的工作，不是 `AGENTS.md` 指令文件。后续按日期追加；计划中的功能不写成已完成。

## 项目状态

- 目录：`D:\桌面\dev\who-ate-my-rice`
- 阶段：项目初始化与第一个最小运行工程已完成
- 技术栈：TypeScript、Vite、Phaser；Tiled 暂未接入
- Git：`main`；最新提交 `8a49428ba8dc6843c6dc04fe1384d2ae7e9d2fc1 feat: create first playable prototype`

## 2026-09-19｜最小运行工程

- 在项目根目录建立 Vite + TypeScript + Phaser 工程和规划目录；目前只实现 `GameScene.ts`、`gameConfig.ts`、`main.ts`。
- 页面显示灰色背景、蓝色方块和三面灰墙；WASD/方向键移动，不能穿墙，Esc 暂停与继续，刷新后重置。
- `npm run build` 通过。浏览器实测移动、碰撞、暂停、恢复、刷新均通过，无页面运行时错误。
- 构建有 Phaser 包体积超过 Vite 默认提示阈值的非阻断警告。
- 安装时默认 npm 缓存写入受限，改用项目内 `.npm-cache/` 并将其忽略；测试中修正了碰撞体尺寸和 Esc 监听。

## 2026-09-19｜Git 记录

- 初始化本地仓库与 `main` 分支；`.gitignore` 忽略 `node_modules/`、`dist/`、环境文件、日志及常见临时文件。
- 用户确认后将首次提交说明改为 `feat: create first playable prototype`；改写前后文件树相同，未跟踪 `node_modules/` 或 `dist/`。
- 没有创建远程仓库，也没有 push。

## 尚未实现

大米、人类角色、AI、门、冲刺、音频、正式美术、Tiled 地图和脉冲锁尚未开始。当前版本仅是最小运行工程。

## 启动与后续记录

在项目目录运行 `npm run dev`；使用 `npm run build` 检查编译和构建。后续每阶段追加“日期｜阶段”，记录完成内容、验证结果、问题处理、提交和未完成事项。
