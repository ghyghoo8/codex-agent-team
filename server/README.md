# Server

未来控制面负责持久化、命令授权、调度和事件投影。目前只实现 `GET /health`，启动入口固定监听 `127.0.0.1:4310`，返回 bootstrap 状态和 `runtime: NOT_CONFIGURED`。

开发启动：`npm run dev:server`。构建后启动：`npm run start:server`。业务写入、数据库和执行功能尚未实现，后续边界见 [开发指引](../docs/development-guide.md)。
