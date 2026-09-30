# Runner

未来执行进程负责在受控工作区内执行已授权任务并回传事件。目前仅有 `npm run runner:check` readiness 检查，打印 `NOT_CONFIGURED` 并以退出码 1 结束。

目前未接入 Strands、模型 Provider、IPC 或容器。实施约束见 [开发指引](../docs/development-guide.md)。
