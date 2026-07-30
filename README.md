# 数独小游戏

一个数独小游戏，现在以 Node.js 服务运行，既托管前端页面，也提供基于 SQLite 的访问统计 API。

## 当前目录结构

为了避免网页端、微信端、历史副本和过程素材混在一起，当前目录按下面这几层理解最稳：

- 根目录：网页运行核心与服务入口
  - `index.html`、`login.html`、`choose-version.html`、`stats.html`
  - `package.json`、`project.config.json`、`render.yaml`
- `web/`
  - 网页端共用脚本与样式
  - `web/styles/` 放页面样式
  - `web/scripts/` 放页面脚本
- `server/`
  - Node 服务与 SQLite 统计逻辑
- `play/`
  - 现役网页对局页
  - `play/9x9/` 是当前 9x9
  - `play/4x4/` 是当前 4x4
- `miniprogram/`
  - 当前正式微信小游戏入口与共享逻辑
- `assets/`
  - 当前网页运行实际使用的正式素材
- `docs/references/`
  - 过程参考图、出图中间产物，不参与运行
- `archive/`
  - 已退出当前主链路的历史副本

## 本地运行

```bash
npm install
npm start
```

然后访问：

- `http://127.0.0.1:3000/`：登录与游客入口
- `http://127.0.0.1:3000/choose-version`：版本选择
- `http://127.0.0.1:3000/play/9x9`：9x9 数独
- `http://127.0.0.1:3000/play/4x4`：4x4 数独
- `http://127.0.0.1:3000/play/16x16`：16x16 数独
- `http://127.0.0.1:3000/play/25x25`：25x25 数独
- `http://127.0.0.1:3000/stats.html`：独立访问统计页

当前游客流程已可用。小游戏端已经补上真实微信登录骨架：

- 小游戏端点击“微信登录”会先调用 `wx.login`
- 服务端会走 `POST /api/auth/wechat/login`
- 服务端再向微信 `jscode2session` 换取 `openid`
- 当前会在本地保存一份小游戏登录态，用于后续进入首页

如果服务端还没配置微信 AppID 与 Secret，小游戏端会明确提示“先用游客模式体验”，不会伪造登录成功。

## 微信小游戏（进行中）

仓库里当前微信端主链路是：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/project.config.json`
- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/miniprogram/`
- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/miniprogram/shared/sudoku9-engine.js`

当前正式入口已经切到：

- `compileType: "game"`
- `miniprogram/game.js`
- `miniprogram/game.json`

也就是说，微信开发者工具现在会按“小游戏项目”而不是“普通小程序页面项目”来跑。此前的小程序页面式原型仍保留在 `app.*` 与 `pages/*` 下，主要作为迁移参考。
也就是说，微信开发者工具现在会按“小游戏项目”而不是“普通小程序页面项目”来跑。此前的小程序页面式原型已经移到：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/archive/legacy/miniprogram-page-prototype`

本地可先运行：

```bash
npm test
```

它会验证小游戏共享引擎的题目生成、错误计数、提示和存档恢复，以及微信登录最小链路的服务端接口与小游戏端封装。

### 小游戏微信登录本地验证

本地最小验证链路建议按下面顺序：

1. 启动本地服务

```bash
npm start
```

2. 在当前终端或运行环境里补上环境变量

```bash
export WECHAT_MINIAPP_APP_ID="你的小游戏 AppID"
export WECHAT_MINIAPP_APP_SECRET="你的小游戏 AppSecret"
```

3. 微信开发者工具导入仓库根目录，并确保小游戏请求能访问本地服务

当前小游戏端会自动分两种请求目标：

- 在开发者工具内预览时，默认走 `http://127.0.0.1:3000`
- 在真机或非开发者工具环境下，默认走 `https://shudu-node.onrender.com`

这套切换逻辑集中放在：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/miniprogram/utils/runtime-config.js`

如果你之后换成自己的正式服务域名，只需要把这个文件里的 `PRODUCTION_API_BASE_URL` 改掉即可。

如果你在开发者工具里本地调试，需要允许本地域名调试；如果后面切到真机或发布环境，还需要把线上 HTTPS 域名加入小游戏后台的合法请求域名。

4. 在小游戏启动页点击“微信登录”

成功后会直接进入当前水墨首页；如果 AppID / Secret 未配置、`code` 过期、或开发者工具网络设置不通，启动页会直接显示失败原因。

### 导入微信开发者工具

当前建议直接导入仓库根目录：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo`

原因是根目录已经补了：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/project.config.json`
- `miniprogramRoot: "miniprogram/"`

导入后会直接识别小游戏入口：

- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/miniprogram/game.js`
- `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/miniprogram/game.json`

当前把“仓库根目录”作为唯一推荐导入入口。这样能减少重复配置，也更方便和网页端、测试、归档目录一起维护。

## 已归档与参考素材

- 历史独立 4x4 副本已移到：
  - `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/archive/legacy/shudu4-standalone`
- 历史小程序页面式原型已移到：
  - `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/archive/legacy/miniprogram-page-prototype`
- 过程出图与标题实验图已移到：
  - `/Users/xuyiran/.openclaw/workspace/projects/sudoku-web-demo/docs/references/generated-title-images`

这些内容默认不再参与当前网页端与微信端的现役运行路径。

## 访问统计 API

- `POST /api/track`
  记录一次访问日志。前端会发送 `visitor_id`、`game_version`、`path`、`referrer`、`channel` 等字段，服务端补充真实可见的 `User-Agent` 和 IP。
- `GET /api/stats?version=9x9`
  返回 9x9 版本的总访问人数 UV、今日访问人数、总浏览次数 PV、最近 7 日趋势和来源渠道聚合结果。
- `GET /api/stats?version=4x4`
  返回 4x4 版本的总访问人数 UV、今日访问人数、总浏览次数 PV、最近 7 日趋势和来源渠道聚合结果。
- `GET /api/stats?version=16x16`
  返回 16x16 版本的总访问人数 UV、今日访问人数、总浏览次数 PV、最近 7 日趋势和来源渠道聚合结果。
- `GET /api/stats?version=25x25`
  返回 25x25 版本的总访问人数 UV、今日访问人数、总浏览次数 PV、最近 7 日趋势和来源渠道聚合结果。
- `POST /api/auth/wechat/login`
  小游戏端提交 `wx.login` 返回的 `code`，服务端再向微信换取 `openid`，并签发本地 session token。
- `GET /api/auth/me`
  用 `Authorization: Bearer <session_token>` 读取当前小游戏登录态。
- `POST /api/auth/logout`
  注销当前小游戏登录态。

SQLite 数据默认写入 `data/visits.db`，可通过环境变量 `SQLITE_PATH` 覆盖。

## Render 部署提示

Render 不允许把已创建的 static 服务直接改成 Node runtime。`render.yaml` 使用新的 `shudu-node` 服务名创建 Node Web Service；部署成功后的域名通常会变成 `https://shudu-node.onrender.com`，统计页为 `/stats.html`。

当前 `render.yaml` 也已经补了小游戏真实登录所需环境变量模板：

- `WECHAT_MINIAPP_APP_ID`
- `WECHAT_MINIAPP_APP_SECRET`
- `AUTH_SESSION_TTL_DAYS`

推荐上线顺序：

1. 先把 Render 服务部署成功，并确认 `https://shudu-node.onrender.com/api/stats` 可以访问。
2. 再在 Render 后台填入 `WECHAT_MINIAPP_APP_ID` 和 `WECHAT_MINIAPP_APP_SECRET`。
3. 部署完成后，把 `https://shudu-node.onrender.com` 填进微信小游戏后台的合法请求域名。
4. 最后在微信开发者工具或真机上点“微信登录”做联调。

如果你后面拿到了自己的正式后端域名，而不是继续用 Render 默认域名，需要同步改两处：

- `miniprogram/utils/runtime-config.js` 里的 `PRODUCTION_API_BASE_URL`
- 微信小游戏后台里的合法请求域名
