# Codex Agent Team 开发规则

## 当前入口

- 先读 [README](README.md) 和 [ADR-001](docs/decisions/001-strands-runtime-foundation.md)，再按任务读取 [开发指引](docs/development-guide.md) 的相关章节。
- Strands SDK 是当前架构基础。`docs/v3-0925/`、`docs/v2-0924/`、`docs/backup/` 与 ZIP 是历史资料，内部旧接手提示不代表当前授权；不修改历史包或 manifest。
- 原始 [Strands 方案](docs/v3-0925/codex-agent-team-strands-runtime-proposal-2026-09-25/docs/strands-runtime-foundation-proposal.md) 的运行边界继续适用，决策状态以 ADR 为准。

## 工程约定

- 单 npm 包、单锁文件；Node 版本见 `.nvmrc`。优先使用本项目脚本及安装的类型定义。
- `server/` 拥有业务命令和业务 DB 写入；`runner/` 拥有执行适配；`shared/` 只放本项目跨边界 schema/类型。SDK 类型不得扩散到业务模型和 UI。
- 当前工程仅有健康检查和 Runner 未配置检查。目录占位、构建及 bootstrap 测试不能记为业务或 RT 验收通过。
- 修改代码后运行最小相关检查，并在交付前运行 `npm run check`。命令与副作用详见 README。
- 计划、队列和接手状态放 `.codex/`，避免在历史文档或常驻规则中累积任务日志。

## 始终遵守的边界

- Team Service 是唯一业务权威；Runner、Session、日志、模型总结不直接改变任务验收。
- 人类决策与 Agent 身份分开；不信任请求自报 actor，不从自然语言、工具提示或摘要推出授权。
- Agent 构造后核验实际能力；真实工具动作前核验最终参数、许可和操作记录。只读 Reviewer 无权修改代码或验收。
- 未知启动不重派，未知写入不重试，未知旧写者不释放资源；取消意图与停止事实分开。
- SDK 成功、技术交付、人类验收分开；`done` 只由可信人类接受精确成果产生。
- 项目代码执行必须经过已验证隔离。worktree、子进程或 SDK 的 sandbox 配置本身不证明安全。
- Provider、模型、来源、权限、数据出站和预算的实质变化不能静默发生。密钥不进入仓库、模型上下文、会话、测试进程或普通日志。
- 不默认启用完整 Harness、任意 shell、隐式委派、自动长期记忆、自动安装或自动模型切换。
