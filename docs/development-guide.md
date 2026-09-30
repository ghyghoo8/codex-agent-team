# Codex Agent Team 开发指引

> 版本：Development Guide v1.0；更新日期：2026-09-30。  
> 架构方向已采纳，依据 [ADR-001](decisions/001-strands-runtime-foundation.md)。本文规定后续实现路径；只有仓库代码及对应证据能证明功能已完成。  
> 当前工程仅为 bootstrap。R0 尚有依赖/源码与试点选择待完成，RT01–RT32 均未执行。

## 1. 阅读与权威

先读 README 和 ADR，再按当前任务读取本文相关章节及原方案；不要求每次接手扫描全部历史资料。

| 材料 | 当前效力 |
|---|---|
| [ADR-001](decisions/001-strands-runtime-foundation.md) | 确认 Strands 基础，明确旧路线覆盖及本次范围 |
| [Strands 原方案](v3-0925/codex-agent-team-strands-runtime-proposal-2026-09-25/docs/strands-runtime-foundation-proposal.md)，Runtime Proposal v0.1 | §4–19 的职责/安全边界、§20–22 的验证要求；历史“未采纳”状态以 ADR 为准 |
| 本指引 | 实现约定、近端切片、检查入口及待决事项；不能降低原方案硬门槛 |
| [能力专项 v0.3](role-capability-readiness-design-v0.3.md)，§6–10 | 精确版本、能力锁、当前访问权限、静态与实际会话核验；宿主专有部分映射为 Runner 核验 |
| [旧交接指引](codex-agent-team-local-development-handoff.md)，§5、§7–13、§15 | 任务/分工、授权、交接和接管业务原则；旧 Codex 宿主路线不再约束新实现 |
| [旧控制平面指引](backup/codex-team-control-plane-implementation-guide.md)，§7 | 仅继承本文 §4–5 明确列出的 Mission/Task、计划、依赖、认领、幂等与验收规则；不恢复完整旧方案 |
| [旧整合方案](v2-0924/codex-agent-team-integrated-plan.md)，§7–12 | 未来历史资料功能的来源、快照、覆盖限制与接纳契约，非首个 Reviewer 前置 |

最新用户指示优先。ADR 治理采纳和覆盖关系，原方案治理运行边界，本文细化实现。若发现实质冲突，先记录涉及的规则和消费者，处理该局部选择；不能以新队列或新日期覆盖规范。

## 2. 产品范围与首个有效闭环

面向单人需求方、一个本地代码项目、一个活动 Mission。产品组织任务、角色、计划和成果；首版不是通用工作流编辑器，也不是插件市场。

完整目标流程：

```text
需求与验收标准 → 候选计划/分工 → 人类确认精确计划
  → 能力锁和静态预检 → 原子认领 → 构造后实际核验
  → 一个实现者 → 获准验证 → 独立 Reviewer
  → 计划范围内有限修复 → 技术交付/交接 → 人类接受精确成果
```

第一个实际模型切片先做只读 Reviewer：对一个固定代码快照、固定 Skill 和验收要求输出结构化评审，能拒绝越界读取并保存有来源的评审记录。先验证有限工具和证据链，再开放审批写操作和代码执行。

角色目录可以先只包含 Reviewer。Coordinator 首轮由人类给定计划加确定性推进逻辑实现，只有语义规划产生实际价值且调用已获授权时才引入规划 Agent。角色不是常驻线程，消息送达不自动启动接收角色。

暂不开发自动降档、模型路由、后台子 Agent、自动长期记忆、全局 Skill 扫描、任意 shell、云端调度、自动推送/合并/发布。Todos、Dashi、SkillBox、PowerContext、Wake 仅为各自范围内参考或以后选用的适配来源。

## 3. 组件与工程组织

### 3.1 三个执行边界

1. **业务权限**：Team Service 核验可信身份、项目、计划、版本、效果及资源。
2. **可信控制进程**：Runner 管生命周期、会话、Provider 和受控工具包装，不执行项目提供的任意代码。
3. **不受信任代码**：项目测试、脚本、依赖构建进入实际验证的隔离环境，不继承控制连接或模型凭据。

本机 loopback、进程、Git worktree、SDK 的 sandbox 参数分别有用途，但都不能单独证明上述边界成立。

### 3.2 目录职责与依赖方向

| 目录 | 职责 | 首次需要时建立的入口 |
|---|---|---|
| `web/` | 任务、计划预览、审批、运行观察、成果及验收；请求服务端事实 | React/Vite 工作台，不直写 DB |
| `server/commands/` | 唯一业务命令，身份、授权、CAS 和幂等 | create/confirm/claim/submit/accept 等意图处理 |
| `server/runtime/` | 派发意图、当前控制绑定、Runner 管理、事件及对账 | 短事务认领、提交后启动、查询原运行 |
| `server/capabilities/` | 精确能力锁、静态预检、实际核验结果 | 必需项 unknown/stale 不放行 |
| `server/evidence/` | 固定成果、验证、技术交接、接收、人类验收 | 校验输入/产物版本和可访问性 |
| `runner/strands/` | SDK/Provider/Session 适配及版本兼容 | 业务规格到锁定 SDK 的显式映射 |
| `runner/tools/` | 工具描述、最终参数门禁、许可与 LogicalOperation | 最小只读工具及后续受控 fixture 写入 |
| `runner/execution/` | 隔离、工作区、进程树、取消与资源观察 | R2/R3 前主动隔离探针 |
| `shared/` | 本项目 schema、传输类型、原因码 | 第一对真实消费者出现时加入 runtime 协议 |
| `migrations/` | 编号 SQL 迁移，业务 schema 版本 | 首个业务存储切片加入 |
| `roles/`、`skills/` | 固定版本专业定义与配套资料 | R1 的 Reviewer 与一个 Skill |
| `tests/` | 契约、真实存储、SDK、故障与质量行为测试 | 随当前切片加入，隔离 fixture 单独管理 |

依赖方向为 `web → shared`、`server → shared`、`runner → shared`。`runner/strands` 可以依赖 SDK，业务层不能导入 SDK Agent 或 Session 对象。server 不复用 Runner 中的项目执行代码，Runner 不导入业务 DB 写入实现；通过版本化协议沟通。

一个仓库、一个 npm 包、一个锁文件，服务与 Runner 分入口编译。不要为目录列表建立空 service class、泛型 Repository、DI 容器或多后端插件注册表。现有占位目录可以在真实消费者出现时细分。

### 3.3 技术栈与当前安装范围

| 项目 | 基础方向 | 当前工程 |
|---|---|---|
| Node / npm | Node 24；补丁版本锁在 `.nvmrc` | 24.16.0 / npm 11.13.0 |
| TypeScript | strict、ESM、NodeNext | 类型检查及编译工具链 |
| Team Service | Fastify，受保护的本地业务入口 | 仅 GET `/health`；无业务写入接口 |
| 存储 | SQLite + better-sqlite3，参数化 SQL，编号迁移 | 未引入驱动或 DB |
| 执行 | `@strands-agents/sdk`，有限适配 | 未安装 SDK；Runner 检查返回 NOT_CONFIGURED |
| Provider | 单一明确服务、模型与参数 | 未选择，未调用 |
| 工作台 | React + Vite | 仅预留目录，无前端应用 |
| 运行通信 | 服务创建子进程，受保护 IPC | 未实现 |
| 会话 | 锁定 TS SDK 支持的 SessionManager，独立本地存储 | 未验证、未落盘 |
| 隔离 | 经验证的环境，Docker 是候选 | 未选择，未创建 |
| 验证 | bootstrap 用 Node test runner；业务/SDK 可按需要引入 Vitest，UI 闭环用 Playwright | 当前仅 bootstrap 测试 |

具体已安装版本以 `package.json` 和 `package-lock.json` 为准。未来增加 SQLite 原生构建、SDK/Provider、UI 或测试框架时，按切片说明安装与执行效果，不为技术栈表一次装齐全部依赖。

## 4. 业务数据与状态契约

以下为需要实现的项目契约，不是现有 schema/API 清单。首个切片只建立它使用的字段和记录，新增表必须有当前消费者。

### 4.1 业务对象

| 对象 | 必要语义与引用 |
|---|---|
| Project | 项目身份、受控工作区归属；名称/路径相同不证明身份 |
| Task | `kind=mission` 根任务与一层 `kind=work` 子项、项目、parent、version、状态及交付要求 |
| Mission | 根 Task 的产品概念，包含活动计划、控制绑定和候选成果；不另建一套任务状态 |
| Plan | 不可变 revision，Brief/需求来源版本、有限阶段、工作 DAG、角色/运行配置、能力锁、输入/输出、验收、授权和限制 |
| RoleProfile | 版本化职责、非职责、指令、Skill 需求及输出标准 |
| RuntimeProfile | 请求的 Provider/模型/参数/权限；Requested 与实际观察分开 |
| Assignment | 当前角色在工作项/阶段中的 owner/contributor/reviewer 分工，绑定角色版本、输入/输出及获准运行规格 |
| Attempt | 一次获准工作尝试，绑定 task/plan/assignment、认领版本、控制代与可信绑定、精确输入、workspace、授权、运行/证据引用 |
| Evidence | 版本化输入/成果、验证结果、来源、覆盖限制及接纳记录；日志文本不能直接替代 |
| Decision | 可信来源、所见版本、决定范围、理由与时间；人类决定和 Agent 技术决定分开 |
| Handoff / Receipt | 精确交接包及接收结果；接收确认不授予执行权 |

Plan 内 Stage 是有限阶段属性，不先建可编辑流程引擎。角色或 Skill 目录更新不会自动改变在途 Plan。新增人类需求未处理时阻止新派发，明确归类为原范围澄清、重大变更或无需改计划；普通执行日志不撤销计划。

### 4.2 运行对象

| 对象 | 与其他对象的区别 |
|---|---|
| RuntimeInstance | 当前 Runner 身份及代次，不仅是 PID；重启必须重新绑定 |
| Invocation | 一次 SDK invoke/stream；同一 Attempt 可有多个 Invocation |
| SDK Session / Agent | 精确会话/Agent 身份、SDK/序列化/适配版本、单写者、持久化观察；不提供业务权限 |
| ExecutionRequest | 启动、答复批准、取消或查询意图；接收不等于执行完毕 |
| ApprovalRequest | 一次最终具体动作的待决关联；SDK interrupt ID 只是关联 |
| LogicalOperation | 工具逻辑动作、实际尝试、效果类别、资源、最终参数摘要、基线、许可、已发出观察、产物及对账结果 |

### 4.3 分开的状态维度

| 层次 | 状态/字段 | 关键规则 |
|---|---|---|
| Task | backlog / todo / in_progress / in_review / blocked / done / canceled | `done` 绑定可信人类接受的精确成果；canceled 不证明工具停止 |
| Attempt 观察 | prepared / running / succeeded / failed / interrupted / unknown | 不能把 SDK stopReason 直接映射为任务状态 |
| 运行细节 | waiting_approval、cancel_requested、stopReason 原值、限制原因、可恢复性 | 等待审批仍可属于原活动 Attempt，不显示“正在计算” |
| Approval 决策 | pending / approved / rejected / expired / revoked | 批准状态与一次操作的消费/结果分别记录 |
| LogicalOperation | prepared / dispatched / succeeded / failed / unknown | unknown 保留可能已产生副作用；不以超时改为 failed/no-effect |

普通审批回答只有在计划、操作、会话和控制绑定仍有效时延续 Attempt，并新增 Invocation/恢复观察。实质改变模型、角色或写入范围，或已确认终止后的重新执行，创建关联新 Attempt。无法证明崩溃恢复安全时保留 unknown，核对后明确交接，不能伪装无缝恢复。

### 4.4 依赖与成果版本

工作项依赖只连接当前 Mission 的子项并拒绝环。支持两类条件：

- `technical_handoff`：固定产物有要求的验证/评审和有效交接，下游可使用，不必等上游 Task done。
- `human_acceptance`：业务必须确认后才能继续的节点，如需求基线或关键设计。

认领时原子选择满足条件的产物并锁入 Attempt 的精确输入。裸 `in_review`、失败或取消不满足依赖。上游成果修订/交接撤销后，标记受影响直接消费者输入过期，阻止旧证据提交与验收，按影响范围补验证。

最终人类可接受父 Mission 及列出的必需子项成果；服务端在一个短事务中校验全部版本仍有效。豁免/取消/失败子项不被顺手标 done。已验收后的新需求建立后续工作，保留原接受记录。

## 5. Team Service、身份与命令

### 5.1 一个业务入口

UI、HTTP、后续 MCP 调用同一组命令处理器；不得提供任意 `set_status` 绕过计划、认领或验收。下面是意图名，路由及 schema 在首个实现切片确定。

| 意图 | 可信调用者与前置检查 |
|---|---|
| 建 Task / 提交候选 Plan | 人类或明确获准的规划身份；不自动产生执行权 |
| 确认 Plan / 扩大范围 | 人类身份，精确所见版本、参与者、数据、效果及限制 |
| claim_work | 当前控制绑定，有效授权、CAS、依赖、能力、容量和单写者 |
| 登记 Runtime / 事件 / 提交结果 | 绑定的 Runtime/Attempt；拒绝跨任务、旧控制绑定与旧代覆盖 |
| 保存 Review / technical_handoff | 对应 Assignment，固定输入与产物、验证/评审条件 |
| 回答 Approval | 人类身份；具体请求、最终动作、当前版本与有效期 |
| pause / request_cancel / reconcile | 分开保存意图和真实观察，未知时不重派 |
| 接受/退回成果 / 接管 | 人类身份；精确版本，接管原子更换可信绑定及控制代 |

变更命令带 `command_id`、目标及 `expected_version`、相关 plan/attempt/runtime 引用。同键同规范化内容返回原记录；同键不同内容报冲突。幂等记录受相同身份与范围限制，不能通过猜 command_id 读取他人结果。

错误至少区分 `VERSION_CONFLICT / PLAN_CHANGED / DEPENDENCY_UNSATISFIED / CAPACITY_UNAVAILABLE / FORBIDDEN / RUN_UNKNOWN / UNSUPPORTED_RUNTIME`。传输未知与业务拒绝分开；UI 不静默刷新版本并重试写入。

### 5.2 可信身份

业务写接口启用前，确定可信本机人类入口与 Runner 控制身份。HTTP 中的 `actor`、`role_name`、模型文本、project ID 或内容 hash 均不授予权限。

人类决策凭据不提供给 Agent、SDK state 或项目进程。Runner 只获得本次 Attempt 所需控制连接；身份由服务端绑定，不由 Runner 自报。人类接管原子废止旧绑定，旧 Runner 即便知道新 control_generation 也不能重新取得控制。

首版假设可信本机用户，但仍防止其他网页或非授权调用触发人类决定：业务接口需要认证、明确 Origin/Host 策略、受保护会话与 CSRF 防护；不默认开放 CORS。loopback 不是认证。R0 形成具体身份设计，R1 业务入口前用真实拒绝测试核验。当前仅健康接口，不开放决定或启动功能。

### 5.3 数据库与事务

Team Service 唯一写业务 DB。先用有限参数化 SQL，编号迁移；不引入 ORM 或独立 DB worker，除非实际复杂度/延迟需要它们。配置并读回 foreign_keys、WAL、同步与有限 busy timeout；在目标驱动和文件系统验证实际语义。

claim 在一个短写事务内检查 Plan、身份/控制绑定、expected_version、输入依赖、能力与写资源，记录 prepared Attempt/意图，提交后才启动 Runner。事务内不 await SDK、不等待网络、不启动进程、不扫描大量文件。竞争认领只产生一个有效 Attempt，失败不留下半记录。

数据库初始化、迁移失败不接受业务写入，不能删除旧库重建。原生驱动安装与构建是实际执行效果，须纳入实施范围。真实临时 SQLite 测试覆盖 CAS、回滚、并发认领、关闭重开、迁移与备份恢复，mock 不证明事务保证。

业务 metadata 与 Session/日志/产物存储分开。正式文件先进入获准暂存、校验并形成确定产物，再登记 DB；文件与 DB 不是一个事务。失败保留未链接产物并按精确引用对账，不自动清空唯一成果。

## 6. 执行规格、能力锁与启动

### 6.1 固定 ExecutionSpec

Team Service 从有效 Plan/Assignment 派生不可变项目规格，至少绑定：任务/计划/角色版本，授权，SDK/Provider/适配锁，模型与明确参数，工具/中间件，Skill/资料 manifest，输入成果，工作区及基线，隔离/会话策略和累计限制。

它是当前授权的快照，不是新授权权威，不是 Strands 原生参数。`runtime-spec.proposal.v1` 等原方案示例仍是示意，不能透传执行；实现时在 shared 定义项目 schema，并逐项映射已锁 SDK。无法满足的必需字段报 UNSUPPORTED_RUNTIME，不删掉后继续。

### 6.2 CapabilityLock 与两阶段就绪

锁包括资产身份、内容版本/digest、该任务的采用引用、必需性、交付方式，以及实际使用的 references/scripts/templates。固定 SKILL.md 不等于锁住全部配套内容。确切版本不可读时保留缺口，当前 ACL 撤销也要生效；不替换 latest，不自动安装。

1. **静态预检**：配置/能力版本、资料可读、基线、有效授权、旧执行、限制、Provider 支持及隔离选择。
2. **实际构造核验**：最终工具 registry/schema、插件、中间件、顺序策略、实际 Skill 交付、Provider 配置和会话身份；与锁不符则阻塞业务动作。

结果使用 `satisfied / unsatisfied / unknown / stale / not_applicable`。必需项 unknown/stale 不能放行依赖它的动作。主动探针、联网、模型调用及 SDK 初始化的可能副作用必须先纳入范围；静态可读不证明已交付给 Agent。

### 6.3 受控启动顺序

```text
确认 Plan → 静态预检 → 短事务 claim/prepared
  → 提交事务 → 建立 Runner 控制身份/RuntimeInstance
  → 构造 SDK / 核验实际能力与 Session 单写者
  → 最终运行准入 → 指定模型调用 → 受控工具
  → 结果/验证/停止观察 → 固定成果 → 交接/人类验收
```

首轮显式顺序工具执行、一个明确 Provider/模型、有限循环与修正，关闭隐式委派、后台工具、自动长期记忆和动态注册/模型热切换。Sandbox 或插件可能增加工具，不能仅核验传入 tools 数组。

业务认领、Session、工作区分别实施单写者。不同 SDK session ID 仍可能写同一目录；SDK 实例锁不证明跨进程保证。未知旧写者继续占用相关资源，心跳丢失不自动释放。

## 7. 工具、审批与逻辑操作

### 7.1 R1 最小工具面

仅提供选定代码快照的目录/搜索/分段读取、一个固定 Skill/证据读取，以及当前 Assignment 的结构化评审提交。限制输出和文件类型，使用受控资源引用、真实允许根与链接策略，拒绝绝对路径逃逸、符号链接越界和任意环境读取。

Reviewer 对代码/资源只读，但可保存获准的评审记录。它不能调用补丁、shell、安装、启动其他 Agent 或人类验收。后续新增补丁必须核验预期文件版本，不能覆盖用户或其他 Attempt 的变更；测试执行必须在隔离边界内。

### 7.2 最终门禁

```text
模型请求 → 受信代码解析/规范化 → 形成最终动作
  → Team Service 校验当前授权/版本/范围
  → 已覆盖：准备操作许可
  → 未覆盖：保存 ApprovalRequest，SDK 中断，等待可信人类决定
  → 重新核验决定与所有当前绑定
  → 将许可绑定 LogicalOperation
  → 最内侧包装核验真实最终参数 → 真实调用 → 保存结果/对账
```

ApprovalRequest 绑定可信来源、Task/Plan/角色、Attempt/Runtime、逻辑操作 ID、工具及版本、最终参数摘要、资源、代码基线、有效期与 SDK interrupt 关联。摘要不证明身份，批准状态不证明操作发生。

中间件转换必须发生在最终校验之前。校验之后若仍能改变资源/账号/工具实现或效果，边界尚未成立。最终参数与许可不同则拒绝或按明确流程授权重新生成匹配许可，不能沿用旧批准。

权限/关键持久化不可用时阻塞新的相关副作用；模型返回 yes/true、自报批准者或 SDK Confirm 默认解释均不能放行。SDK 的 Guide 只允许原范围内有限参数纠正，拒绝不能转成可重试错误绕过。

### 7.3 幂等与未知结果

中断回调可能重入：同一请求/操作必须查询原记录，不能新建无限批准卡或重复写入。已成功返回确定原结果；未发出可按策略继续；已发出但未知先对账。

数据库中原子绑定许可和 LogicalOperation 不能使外部写入 exactly-once。Provider 重试、模型纠正、工具实际尝试及新 Attempt 分开记录；外围 Hook 可能漏掉内部重试/缓存。不可观察的调用次数保留缺口，不能猜成精确计费/效果记录。

R2 的首个 fixture 写入之前，必须已有关键操作持久化、回调幂等、未知阻塞及对账行为。不能推迟到 R4 再补。

## 8. Runner 通信、会话与故障

### 8.1 IPC 协议

首版由 Team Service 按需创建 Runner 子进程，绑定受保护 IPC；不同时建设运行 HTTP 框架。IPC 不向项目代码/隔离进程暴露。连接本身与服务端 Runtime 绑定共同提供身份，消息自报字段不授予权限。

项目协议包含协议版本、command_id、kind、attempt、control_generation、spec digest；事件包含 RuntimeInstance/代次、序号、来源及观察时间。先实现当前切片的 start/query，answer_approval/request_cancel 按后续消费者加入，不做任意 JSON-RPC/SDK 参数透传。

相同命令查原记录；旧代结果保存为历史或候选材料，不能覆盖当前权威。消费者处理重复、乱序和序号缺口，缺口不触发工具重放。UI 文本流与关键控制记录分开，有界缓冲。

命令已接收、Runner 已注册、工具效果完成和业务成果已接受四者分开。启动发出但响应丢失时查询原实例，无法确认保留 unknown，不另启 Runner。

### 8.2 会话和恢复等级

分别保存循环检查点、SDK Session、业务检查点及代码/进程/外部副作用现场。只支持锁定 SDK 已经证明的能力；实验性 checkpoint 不作为任意崩溃透明恢复保证。

先验证普通结束和 HITL 边界接续。审批继续重验计划、角色、最终参数、控制绑定、Session 及操作状态。不能安全恢复时，在旧执行已处理、成果核对后建立精确 Handoff 和新 Attempt。Session 目录存在不能显示“可恢复”。

跨 SDK/Provider/宿主接续使用精确交接与现场核验，不能直接改写旧会话并声称同一运行。升级重跑工具注册、审批、取消、Session、Provider 输出及回归；不兼容时拒绝恢复或明确新交接。

### 8.3 故障处理表

| 观察 | 应采取的动作 |
|---|---|
| prepared 且能证明未发出启动 | 关闭/修复记录，在当前授权内重新准备 |
| 启动发出、回执未知 | 查询原实例，保留资源，无法核实为 unknown |
| 工具写成功、登记失败 | 按产物 digest、预期文件版本或远端 operation ID 对账；停止新相关写入 |
| 工具超时、远端效果未知 | 不重试写入，保存未知与处理入口 |
| 批准已记录、答复丢失 | 读取同一决定并重验，不重复消费 |
| Session 与业务记录不符 | 核对操作/成果；Session 文本不能覆盖业务事实 |
| 旧控制代迟到 | 保留来源，当前控制方显式复核接纳，不覆盖当前结果 |
| Team Service 控制失联 | 停止新工具效果和新模型循环，在途动作尽力取消并核对 |
| 仅浏览器展示断线 | 显示连接状态，按已批准运行策略继续/暂停；不重复启动或批准 |
| 达到预算/Guide/修复限制 | 保存部分成果及剩余项，等待下一决定，不自动增加上限 |

取消先记录意图并阻止新派发，再传播信号，核对工具/进程/容器/远端操作，分开显示已停止、仍活动、未知。关闭 Runner 不证明它发出的外部任务停止。确认安全后才释放资源。R3 首次运行代码前已有这些基础处理，R4 再系统注入故障验证。

| 情况 | 执行责任与下一动作 | 允许继续的条件 |
|---|---|---|
| 正常 Reviewer | 人类固定计划/快照；capabilities 两阶段核验；runtime 认领/绑定；strands 适配执行；evidence 固定评审成果 | 输入、身份和能力有效，结果核验；人类另行接受精确成果，SDK 成功不直接 done |
| 未知写入 | runner/tools 停新相关效果并提供观察；server/runtime 保留 unknown、资源占用并对账；当前控制方核对精确产物/操作 | 有证据确认原效果及旧写者状态；无法确认继续阻塞，人类决定不代替停止/无效果证据 |
| SDK/Provider/隔离偏差 | 对应实现者记录偏差；capabilities 阻塞；开发者修复映射/配置，范围/成本/数据去向变化由需求方决定 | 必要版本锁/计划更新并重新核验；隔离偏差须重做主动探针，不静默换模型或环境 |

## 9. 隔离、凭据与限制

只读阶段使用固定快照和有界工具，无通用命令执行。R2 写 fixture、R3 补丁/测试前确定真实隔离策略并主动验证越界拒绝。

候选环境应只挂载选定项目/产物；不挂宿主 HOME、SSH、云/Codex 凭据、业务 DB、Runner IPC 或 Docker socket；非特权用户、默认无网络，CPU/内存/磁盘/输出/时间/进程数有界。需要下载依赖时独立声明联网阶段。Docker 只是候选，SDK 接入已有容器不证明容器生命周期或安全配置正确。

测试代码会写文件/联网，命令名白名单不证明脚本安全。Reviewer 验证使用固定只读源快照加独立构建/临时目录，或单独项目副本；评审后再次核验候选成果未被修改。

Provider 密钥只属于可信客户端；控制凭据只属于服务与 Runner 的受保护连接，不能进入模型上下文、工具参数、Skill、Session、日志、导出或项目测试进程。不读取 Codex 私有登录，不默认共享其他服务管理员凭据。

每次真实试点明确发给 Provider 的需求/代码/工具输出范围，缓存与遥测策略，Session/日志保存和清理。SDK 在本机运行不能推导出数据不出站。

预算分层：Invocation 轮次/可观察 token，Attempt 累计 invoke/纠偏/工具尝试/墙钟/审批时限，Plan 角色与评审修复次数，进程资源。具体数值由试点决定，未知操作仍占用对应记录。SDK 软上限不代替累计硬边界；resume/new invoke 不重置项目预算。

## 10. 成果、独立评审、交接与观测

结构化结果至少有完成/部分/失败/未知状态、产物与代码版本、验证命令/输入/结果、失败与跳过项、遗留问题、下一步及实际运行引用。schema 合法只证明结构，不证明内容或测试有效。

Reviewer 使用独立实例与上下文，读取固定候选和验收要求，不继承实现者“已正确”的结论；可用相同模型，但代码权限、输入和 Assignment 必须分开。Reviewer 不自行验收或开始修复。有限窄修复需在有效计划范围内，修后相关证据重新绑定成果版本。

正式交接包包含目标/范围/验收、Plan/授权/能力版本、Git 基线和 dirty/untracked、完成/部分/未做/失败/unknown、代码与验证产物、关键决定、在途效果、下一步/停止条件。Receipt 对精确包版本记录 accepted/needs_clarification/declined；接收内容不授予执行权。

运行事实分 Requested/Resolved/Observed/Verified。记录来源层、SDK/适配版本、真实发出与缓存/转换/重试观察、用量来源及观测缺口。不要把模型自报百分比当进度，不依赖内部推理内容作合规证据。

原始结果与交给模型的脱敏/裁剪视图分开，截断/坏数据/丢事件/unknown 传播到 UI 和交接。业务 DB 保存有界 metadata/引用；Session、日志、证据分开访问与保留。不默认记录完整提示词或上传第三方遥测。

历史资料功能以后按价值加入：先明确 source_ref 范围，分别授权目录发现与正文读取，固定快照/解析覆盖，接纳为业务 Evidence 后再用于接续。不得从一个项目扩大到 CODEX_HOME；索引可重建，正式证据不可随索引清空。此功能不阻塞首个 Strands Reviewer。

## 11. 日常开发与验证

### 11.1 当前命令

在仓库根目录执行，完整效果见 [README](../README.md)：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run check
```

`dev:server` / `start:server` 只启动 loopback 健康服务；`runner:check` 当前返回 NOT_CONFIGURED 和非零退出码。当前无需 `.env`，不提供伪运行密钥模板。

版本敏感 API 先看安装版本类型与相关官方文档，SDK 再核对对应完整源码 SHA。独立研究可并行，合约先固定，共享文件指定一个写入者。不要扫描 node_modules/缓存/日志/大型历史包来代替有针对性的定位。

### 11.2 检查的证明范围

| 证据 | 能证明 | 不能证明 |
|---|---|---|
| 类型检查/编译 | 当前代码和类型可构建 | 模型质量、业务授权、隔离 |
| bootstrap Fastify.inject | 健康服务响应与当前无业务路由 | 任务/审批/Runner 可执行 |
| 真实 SQLite 行为测试 | 被测试事务、CAS、恢复结果 | 外部效果 exactly-once |
| mock Provider/Runner | 本项目特定分支/schema | 实际 SDK 重入、真实 Provider、取消 |
| 锁定 SDK/Provider 契约测试 | 该版本和配置实测行为 | 所有模型/版本相同兼容 |
| 隔离主动探针 | 声明限制中的实测拒绝 | 绝对安全或未测通路 |
| 固定成果的真实测试/评审 | 对应基线的技术交付 | 人类业务接受、推送/部署 |

业务测试按切片覆盖成功、拒绝和实际故障窗口；不为占位目录制造空测试。当前没有 ESLint/Playwright/Vitest 脚本，不写未存在的命令为必过门槛；引入后同步 README/脚本和检查范围。

### 11.3 正式 RT 证据

RT01–RT32 的完整场景与通过条件以原方案 §21 为准。实施时记录测试 ID、代码/输入基线、SDK/Provider/隔离锁、预期和观察、日志/产物精确引用、失败/限制、复核结论。记录于对应 `docs/probes/` 报告，实施队列只链接其证据。

文档核对、骨架测试和模拟结果不得把正式 RT 标成 PASS。硬门槛出现越权、假验收、未知写入重放或泄密时，该运行路线不准入；平均质量或成本分不能抵消。

## 12. 分阶段开发与验收顺序

表中 RT 对应是本指引的实施分组；不改变原方案测试定义。每阶段完成结果和证据写入唯一 [实施队列](../.codex/agent-state/todo.md)，本文保留稳定的验收约定。

| 阶段 | 交付与依赖 | 退出条件/主要 RT |
|---|---|---|
| 初始化 | 本 ADR/指引/README、单包骨架、检查入口；当前已授权范围 | 当前检查通过，运行状态真实；不标 R0 全完成 |
| R0 现状/版本/边界 | 固定 SDK 发布版、npm integrity、源码 SHA、许可、默认行为；逐阶段列 Provider/数据/身份/Session/隔离/fixture 决定与缺口；当前仓库差异 | 版本锁及差异/探针清单完整，本次切片必需输入明确；后续决定到对应阶段再落实，不冒充运行验收 |
| R1 只读 Reviewer | R0 中本阶段必需项；最小 Task/Plan/Assignment/Attempt/证据存储与可信入口；固定 Reviewer/Skill/只读快照、无通用命令、有界读工具、实际能力核验 | RT01/02/04/05/25 及当前适用 RT29；真实评审、位置引用、无代码写入 |
| R2 审批和 fixture 写入 | R1；已验证 fixture 隔离；具体人类批准、最终参数、持久许可/操作、回调幂等和未知阻塞 | RT06–10、有限纠偏 RT21；参数变化/重复消费/重入不能绕过 |
| R3 隔离实现闭环 | R2；单写者、真实隔离探针、取消基础；一个实现者、选定验证、独立评审、有限修复、人类验收 | RT03/11/12/23–26、修复 RT21；真实成果/测试/拒绝/单写证据 |
| R4 故障与接续 | R2/R3 基础控制已存在；系统故障注入、审批重启、未知写入、Session 差异、取消、旧代与升级/交接 | RT13–20/22/27/28/30/32；无重放、状态保真及可人工续办 |
| R5 运行准入与质量比较 | R1–R4 必需硬门槛；事先确定质量标准，相同输入与验收的分离工作副本 | RT31；重复样例记录正确性/回归/干预/不可比条件，决定是否允许默认真实执行 |

R0 可以分为无模型的版本/源码研究和真实试点选择，不为未知 Provider 提前选默认账号。R2 首次写入前已具备未知不重放；R3 前已验证隔离并具备失联/取消基础。R4 是故障覆盖深化，不能成为延后安全行为的理由。

近端顺序：

1. **SDK 基线核对**：锁定可审阅的发布包及源码，核查 Agent 构造/工具注册、权限转换顺序、interrupt 重入、Session 单写、limits/取消/重试/遥测。先获得事实，所有主动初始化效果列入探针。
2. **无模型业务基础**：真实 SQLite 最小命令，可信人类入口，不可变计划和 CAS 认领，prepared 意图、受控引用与失败窗口；不先实现所有对象的 CRUD。
3. **只读 Reviewer 集成**：确定真实 Provider/数据预算后接入一个角色/Skill；构造后核验再调用，保存精确评审证据。

可并行开发无共享写入的 SDK 研究与业务基础，但消费者协议先固定，真实调用依赖相应决策。远端阶段只保留结果与门槛，等输入稳定再拆任务，不提前生成大量空卡片。

## 13. 切片前需要确定的输入

架构基础与当前仓库初始化已由用户确定；下面不是再次确认该决定。到实际效果发生前才需要相应输入。

| 输入 | 最小可评审内容 | 必须明确的时点/当前限制 |
|---|---|---|
| SDK 基线 | 发布版、integrity、完整源码 SHA、许可证、适配/序列化版本、精确锁文件与探针 | R1 构造前；当前未锁 SDK，不宣称源码审计 |
| Provider/模型/参数 | 一个服务/模型、支持字段、客户端版本、凭据提供方式、费用与失败策略 | 真实调用前；无自动账号连接/默认模型回退 |
| 数据与遥测 | 将发送的需求/代码/输出清单、缓存/遥测开关、允许存储内容 | 数据出站前；不自动上传整个项目 |
| 人类/Runner 身份 | 可信本机入口、会话/CSRF/Origin、Runner 绑定、Agent 禁止验收 | 业务决定接口与 R1 前；当前仅健康服务 |
| 会话/日志保留 | 独立路径、访问权限、格式锁、期限、清理及输出覆盖 | 首次会话/日志落盘前；不永久全量保存 |
| 试点与预算 | 固定任务/快照/Skill、验收要求、读工具、invoke/纠偏/墙钟限制 | R1 真实调用前；具体数值不能由框架默认补出 |
| 实际隔离 | 环境/镜像身份、挂载、网络、用户、资源、取消、越界探针和清理 | R2 fixture 写/R3 代码执行前；无宿主任意 shell |
| 恢复等级 | 拟支持并须验证的 HITL/普通结束边界，以及不支持恢复时的明确交接行为 | 承诺 resume 前；不承诺任意崩溃透明恢复 |
| 修复与质量标准 | 限定实现者/Reviewer、修复次数、硬门槛及质量比较要求 | R3/R5 前；不让 Agent 自改范围或自批 done |

缺失只阻止依赖该输入的动作，无模型源码核对和已授权文档/骨架维护可以继续。技术实施者可在已定范围内选内部文件布局、SQL细节与测试结构；业务意义、数据去向、权限或成本的扩大由需求方决定。

## 14. 接手入口与当前可执行性

接手先读取 [项目索引](../.codex/project.md)、[计划](../.codex/agent-state/plan.md) 和 [唯一队列](../.codex/agent-state/todo.md)，再核对分支、dirty、锁文件及当前检查。历史研究不能代替当前代码事实。

```text
以 ADR-001 和 development-guide.md 为入口接手。
先确认队列、当前改动和实际脚本，再读取当前切片涉及的原方案章节。
保留用户改动及历史包。区分已实现、未验证和待决定。
当前 bootstrap 不等于 Strands 已接入；检查 NOT_CONFIGURED 是真实结果。
在有效授权内完成当前切片的实现与最小行为验证，记录精确证据。
遇到必要配置不支持、权限缺失、未知效果或越界要求，阻止相关动作，
保存原因和解除条件；继续独立可做的工作，不静默更换来源或后端。
```

本次准备的终点是较完整开发指引与可检查的仓库骨架。当前尚不足以宣称整个 R1–R5 能持续执行到验收：Provider/数据、身份、SDK/源码/Session、隔离和真实试点仍需在对应节点确定。下一项为 R0 SDK 基线核对及试点输入准备，不自动创建 Goal、后台任务或派发真实 Agent。

## 15. 官方依据与核验范围

2026-09-30 核对了 [Strands TypeScript quickstart](https://strandsagents.com/docs/user-guide/sdk/quickstart/typescript/) 的 Node 22+ 与安装入口。项目具体能力仍需对锁定版本源码和类型验证，滚动网页不证明所选发布版兼容。

骨架参考 [Fastify Server](https://fastify.dev/docs/latest/Reference/Server/)、[TypeScript module](https://www.typescriptlang.org/tsconfig/module.html) 和 [Node 24 test runner](https://nodejs.org/docs/latest-v24.x/api/test.html)，最终以本次安装类型与本地检查为准。初始依赖版本来自 npm registry 读回并写入锁文件。

原方案 §26 的 2026-09-25 来源记录保留当时核验范围；本次没有重新证明其中所有 SDK 默认值、源码或故障保证。后续 R0 报告必须分别注明官方文档事实、源码事实、模拟测试和真实集成结果。
