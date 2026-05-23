# 数独小游戏

一个数独小游戏，现在以 Node.js 服务运行，既托管前端页面，也提供基于 SQLite 的访问统计 API。

## 本地运行

```bash
npm install
npm start
```

然后访问 `http://127.0.0.1:3000/`。

## 访问统计 API

- `POST /api/track`
  记录一次访问日志。前端会发送 `visitor_id`、`path`、`referrer`、`channel` 等字段，服务端补充真实可见的 `User-Agent` 和 IP。
- `GET /api/stats`
  返回总访问人数 UV、今日访问人数、总浏览次数 PV、最近 7 日趋势和来源渠道聚合结果。

SQLite 数据默认写入 `data/visits.db`，可通过环境变量 `SQLITE_PATH` 覆盖。
