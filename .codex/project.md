# 项目索引

项目：Codex Agent Team。当前架构基础：Strands TypeScript SDK 的受控执行路线。

## 按需入口

- [README](../README.md)：运行环境、实际命令、初始化状态。
- [ADR-001](../docs/decisions/001-strands-runtime-foundation.md)：架构采纳与旧材料覆盖关系。
- [开发指引](../docs/development-guide.md)：业务与运行契约、职责、R0–R5、待决输入。
- [AGENTS.md](../AGENTS.md)：常驻开发边界。
- [计划](agent-state/plan.md)：当前工作范围与后续依赖。
- [唯一实施队列](agent-state/todo.md)：进度、证据和下一动作。

## 当前工程入口

- `server/app.ts`：健康服务构造；`server/index.ts`：loopback 启动/关闭。
- `runner/check.ts`：NOT_CONFIGURED 检查，尚无 SDK Runner。
- `shared/health.ts`：bootstrap 健康契约。
- `tests/health.test.ts`：初始化行为测试。
- `package.json` / `package-lock.json`：唯一 npm 工程/依赖锁。

业务 DB、IPC、Strands/Provider、前端与隔离执行尚未接入；以当前代码和队列证据为准。历史包不作为当前运行事实，不扫描参考仓库或 Codex 私有会话来补出不存在的状态。
