# Strands 自有执行路线：方案与开发交接包

整理日期：2026-09-25。

## 主文档

阅读 `docs/strands-runtime-foundation-proposal.md`。建议入库到目标项目的同一路径。

这是独立的架构候选与验证方案，不是已批准迁移。核心建议是：以 Strands TypeScript SDK 为自有 Agent 执行内核的首选验证对象，同时保留 Team Service 对任务、计划、授权、认领、证据和人类验收的权威。

主文档含 26 个章节、R0–R5 六个切片与 RT01–RT32 三十二项验收目标。验收状态全部为 NOT_RUN；文档生成和格式检查不等于 SDK 或业务测试通过。

## 原参考材料

`reference/` 保留原文件字节内容，原状态不改变：

- `codex-agent-team-integrated-plan.md`：整体方案，原执行路线和技术方向。
- `role-capability-readiness-design-v0.3.md`：能力锁、Skill 来源和就绪核验。
- `codex-agent-team-local-development-handoff.md`：任务、授权、交接和恢复基线。
- `role-capability-readiness-design-v0.1.md`：已确认能力管理范围的历史依据。

旧文件的相对链接可能指向它们原交接包中的其他材料。本包不重建所有历史附件；主文档第 26 节说明所用材料和公开来源。

## 使用方式与边界

先在本地读取真实仓库、现有设计和授权，再使用主文档第 24 节的只读接手指令。不要仅凭本包安装依赖、调用模型、创建沙箱、修改代码或切换在途任务。正式采纳时以 ADR 标明需要修改的执行边界，不覆盖旧材料原始状态。

本包没有 Strands 源码、依赖锁文件、可运行配置、业务测试结果或任何访问凭据。官方资料经过有限核对但没有统一固定提交，源码和目标运行环境仍待验证。

`manifest.json` 用于检查包内文件完整性；它不证明代码安全、来源身份或设计已经实施。
