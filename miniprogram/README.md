# Miniprogram

这里现在只保留当前正式微信小游戏主链路，旧的小程序页面式原型已经移到归档目录，避免和现役入口混在一起。

结构说明：

- `game.js` / `game.json`
  当前正式小游戏入口。微信开发者工具切到 `compileType: "game"` 后，会直接走这一套。
- `game/`
  小游戏正式运行壳，包括状态控制、交互分发和画布渲染。
- `shared/`
  小游戏和后续其他端都可复用的数独核心逻辑。
- `utils/`
  微信端存档等工具层。
- `assets/`
  微信端实际使用的图片素材。

旧页面版原型归档位置：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/archive/legacy/miniprogram-page-prototype`

当前推荐的微信开发者工具导入入口不是这个子目录本身，而是仓库根目录：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo`

原因是根目录的 `project.config.json` 已经把 `miniprogram/` 设为正式导入目标，这样更方便和网页端、测试文件一起维护。
