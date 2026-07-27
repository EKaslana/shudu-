# 数独小游戏 · 4×4

一个单文件 HTML 4×4 数独小游戏（迷你数独），可直接作为静态站点部署。

## 规则

- 棋盘为 4 行 × 4 列，共 16 格，分为 4 个 2×2 小宫
- 每行、每列、每个 2×2 小宫内，1–4 各出现一次

## 本地打开

```bash
python3 -m http.server 4317 --bind 127.0.0.1
```

然后访问 `http://127.0.0.1:4317/index.html`。

## 部署

### Render（静态站点）

仓库根目录已包含 `render.yaml`。在 [Render](https://render.com) 选择 "New" → "Blueprint"，连接到本仓库即可自动部署。

也可以直接选择 "Static Site"：

- Build Command: `echo "Static site ready"`
- Publish Directory: `.`

### GitHub Pages

1. 把整个目录推到 GitHub 仓库
2. 在仓库 Settings → Pages 中选择部署分支（一般为 `main`）和根目录 `/`
3. 等几分钟后访问 `https://<用户名>.github.io/<仓库名>/`

## 难度

| 难度 | 空格数 |
| ---- | ------ |
| 简单 | 5 / 16 |
| 普通 | 8 / 16 |
| 困难 | 11 / 16 |

错误上限 5 次，超过则本局失败。

## 功能

新局、重置、暂停、提示、清除、撤销、标记（候选数）、存档、读档、手机版切换、键盘操作（1–4 输入，方向键移动，P 暂停，Backspace/Delete 清除）。
