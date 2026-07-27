# Server

这里收纳网页端运行所需的 Node 服务逻辑。

当前包括：

- `server.js`
  Express 入口，负责静态页面托管和访问统计 API。
- `analytics-store.js`
  SQLite 访问统计存储与聚合逻辑。

根目录的 `package.json` 已把 `npm start` 指向这里，所以日常启动方式不变。
