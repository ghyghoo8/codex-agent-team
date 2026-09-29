# Wake 源码审阅：会话资料、证据保真与集成边界

> 版本：Source Review v0.1  
> 日期：2026-09-24  
> 审阅对象：用户上传的 `Wake-main.zip`，不是远端当前 HEAD。  
> 用途：为 `codex-agent-team` 的历史资料、异常恢复和技术选型提供依据；不是 Wake 全量安全审计。  
> 结论性质：源码事实、局部验证、产品适配建议分别标注。  
> 配套：[整体方案与技术栈建议](codex-agent-team-integrated-plan.md)、[原始行号摘录](wake-source-evidence.md)。

## 1. 结论摘要

Wake 最值得借鉴的是 **Adapter → 统一会话视图 → 派生索引 → 多个读取入口** 的分层，而不是整个 GPUI 桌面客户端。上传快照已经提供无界面的索引构建／刷新、CLI 和 MCP，因此上轮“索引主要依赖 GUI 运行”的说法需要收窄。

但它首先是个人会话资料浏览器，不能直接作为我们项目的正式证据库或任务授权服务。尤其需要补足：

1. 搜索覆盖不包含完整工具输出；零结果不能证明没有失败记录。
2. 解析视图有过滤、重组、截断和重新编号；`session key + seq` 不是不可变证据地址。
3. 部分解析诊断没有进入索引写入链；不能用数据库中的零值证明源文件完整。
4. 项目参数是便利过滤，不是角色／任务 ACL；读取会话与读取记忆必须逐次校验授权。
5. 索引中的最大活动时间不等于扫描完整度；搜索和现场读取可能对应不同文件版本。
6. 索引重建、导出、删除和打开宿主都有各自副作用；不能统称“只读、无副作用”。

推荐 **借鉴解析和检索机制，另建窄的来源快照与证据接纳契约**；不默认安装 Wake、不公开其全库 MCP、不重写我们的前端为 GPUI。

## 2. 源码身份与实际工作范围

| 项目 | 实际值／状态 |
|---|---|
| 上传包 | `Wake-main.zip`，2,565,321 字节 |
| 归档条目 | 305 条；其中 215 个普通文件 |
| 解压后普通文件总字节 | 4,592,756 |
| ZIP 注释中的提交标识 | `269c50b466b023a0f38cc14e34105ab27b983dd2` |
| ZIP SHA-256 | `638d9396eb5f24229ea7f6e031071369534fd89557a2c4e16963e1455c19a3fe` |
| 包内版本 | workspace `0.8.1`，Rust edition 2021 |
| 许可证 | MIT，保留原 `LICENSE` 中的版权和许可文本 |
| 来源验证限制 | 包不含 `.git`；提交注释可定位本次快照，不代表独立核验远端、签名或最新版本 |
| 原文件完整性 | 215 个文件重新与 ZIP 逐字节比对，均未改变 |
| 已执行验证 | 14 项原 SQL 行为验证＋6 项静态／样例断言；20 项通过 |
| 未执行 | Rust 编译和原测试套件、Wake GUI、真实 MCP 传输、macOS 深链、用户 Codex App、本项目业务测试 |

本轮没有安装依赖、运行仓库安装／构建脚本、读取用户电脑上的会话或凭据、启动数据库服务、连接模型服务或修改目标仓库。公开网页检索仅用于技术栈建议的现行资料核对。

## 3. 实际架构与调用链

### WK01：可以借核心分层，不必搬桌面端

**源码事实。**根 workspace 包含 `wake-core` 和 `wake`。核心使用 serde/serde_json、rusqlite（bundled SQLite）、walkdir、notify、chrono、zstd 等；桌面 crate 使用 GPUI、gpui_platform 和 gpui-component。`wake-core` 提供 `scan`、`wake-cli`、`wake-mcp` 二进制。核心中仍包含清理、终端和平台代码，不能把“独立于 GUI”夸大成“只包含无副作用纯解析函数”。

**位置：**`Cargo.toml:1–23`；`crates/wake/Cargo.toml:12–23`；`crates/wake-core/Cargo.toml:7–63`。

```text
原生会话目录／可选状态数据库
  → adapters：发现、快速元数据、解析
  → models：SessionMeta / TranscriptMessage / IndexUnit
  → scanner / watcher：索引更新与副本裁决
  → SQLite：sessions / messages / FTS / 用户数据
  → GUI、CLI、MCP：查询与呈现

会话详情：也可以重新读取源文件，而非只读取索引正文。
恢复／清理：另有终端、桌面深链及文件副作用路径。
```

**对本项目。**先保持 TypeScript 业务与页面。若需要复用 Rust，提取窄 Adapter／解析子进程；不用引入 GPUI、桌面打包、删除源记录或远程同步。

### WK02：共享规范化模型有用，但只是视图

**源码事实。**`AgentAdapter` 分开发现和完整解析；`SessionMeta` 使用 Agent、host 和 native id 构造逻辑身份；`ParsedTranscript`、`IndexUnit` 支持消息序号与子会话。不同入口尽量复用解析结果，而不是各自写一套格式理解。

**位置：**`adapters/mod.rs:35–67,78–165`；`models.rs:213–243,246–319,344–399`（本报告中未写完整前缀的 Rust 文件均位于 `crates/wake-core/src/`）。

**对本项目。**采用共享解析契约，但增加不可变 `snapshot_ref`、原始 span 和 `parser_revision`。任务、Attempt、会话、源文件是不同对象；不能把一条 native id 直接转成有效 Attempt。

### WK03：Codex 适配有明确格式依赖，不能当稳定官方接口

**源码事实。**Codex Adapter 检查 `CODEX_HOME` 和默认目录，组合 sessions、archived_sessions 与 `state_5.sqlite`。部分元数据查询使用固定的 `threads` 列。自定义 sessions 目录在某些条件下会提升到父根目录。部分查询错误折叠为缺少结果，父子关系准备查询也有空列表回退。

**位置：**`adapters/codex.rs:31–49,206–298,1203–1258`。`thread_memories` 处还明确记录了 schema 推断与真实数据验证限制，见同文件约 `986–993`。

**对本项目。**首个切片只读取用户明确选择的 Codex JSONL 或导出，不自动扫描整个主目录，不自动提升来源范围。状态数据库是可选补充；表不存在、schema 不支持、权限拒绝、暂时忙碌和确实为空应区分。格式兼容性由本地目标版本 fixtures 和探针证明，而非引用本快照推定。

## 4. 保真、诊断与搜索：最重要的改进依据

### WK04：可读转录不等于原始记录

**源码事实。**Codex 解析逐行读取 JSONL，部分坏行累计 `unknown_lines` 后继续。解析会清理包装文本、折叠继承历史、合并工具调用，选择 response_item 或 fallback 消息，再调用 `assign_seq`。`compacted` 行在该分支被转为固定提示文字。视图的正文上限是 32 KiB，工具输入／输出及 thinking 上限是 16 KiB。

**位置：**`adapters/codex.rs:477–500,601–649,821–905`；`models.rs:679–690`；`adapters/parse_utils.rs:778–787,918–953`。

**含义。**在同一份固定输入和解析器版本下统一 seq 对浏览很有用；但输入变化、解析规则变化或折叠策略变化后，seq 不保证长期指向同一原始内容。部分元上下文被过滤也不能证明其未参与当时执行。

**补强。**证据锚点使用 `来源快照 + 原始字节区间/原始事件定位 + 内容摘要 + 解析器版本`；seq 只作视图辅助。需要完整内容时读取获准原始片段，不要求用户靠多次紧凑分页拼回不可恢复的截断内容。初期不解析加密思考，不将内部思考轨迹设为必需证据。

### WK05：解析诊断在索引写入链未完整传递

**源码事实。**`ParsedSession::derive` 保存 `unknown_line_count`；扫描器把 meta、units、wake_lookups 交给存储，但未传该诊断；`upsert_session` INSERT 将 `unknown_lines` 写成常量 `0`，冲突更新也不更新它。

**位置：**`adapters/mod.rs:548–562` → `scanner.rs:523–546` → `db.rs:3088–3121`。

**局部验证。**直接执行提取的原 DDL／UPSERT，新行 `unknown_lines=0`；先设为 7 再执行同一 UPSERT，仍为 7。原 fixture 中含有 `mystery_row`，原 Adapter 测试有诊断断言，但这不证明数据库链路传播成功。

**边界。**此结论针对这条索引写入链，不声称 Wake 所有直接阅读界面都没有诊断。未知顶层类型、未知嵌套类型、格式错误和明确过滤也不是一个完整计数能覆盖的。

**补强。**把 `ParseReport` 的覆盖、过滤、失败、截断和未知字段贯穿采集→存储→查询→交接；异常值缺失必须为 unknown，不能默认为 0。解析部分成功允许用于探索，但不能被包装成完整任务恢复依据。

### WK06：Codex 工具输出分支没有把失败状态填入 is_error

**源码事实。**构造 `ToolCallView` 时 `is_error: false`；配对 `function_call_output`／`custom_tool_call_output` 时写入 output，但该分支没有从退出码或返回内容更新 `is_error`。

**位置：**`adapters/codex.rs:651–721`。

**含义。**`false` 在这里不能被我们解读为“命令成功／测试通过”。静态检查只确认当前分支的写入行为，没有运行 Rust 解析器，也不替所有 Agent 适配器下相同结论。

**补强。**运行结果用 `succeeded / failed / unknown / not_reported` 等明确状态；原始退出码、工具返回和解释分别保存。自由文本中出现 “passed” 不足以自动验收，后续失败也不能被早先通过记录覆盖。

### WK07：正文全文搜索不是完整执行日志搜索

**源码事实。**`units_from_messages` 只取 Text 类消息正文、工具名、输入 preview；没有加入工具 output。还对 Wake 自身查询调用做排除，减少检索结果反复入库产生的回声。SQLite 使用 FTS5 trigram；少于三个 Unicode 码点的词项走转义后的 LIKE 路径，多词使用 AND。

**位置：**`adapters/mod.rs:499–545`；`db.rs:26–96,2438–2602,3125–3177`。

**局部验证。**提取原 SQL 验证中文三字符、两字符回退、代码子串、引号、百分号和下划线、多词 AND。引号／LIKE 辅助函数在 Python 中按源码重述，不是原 Rust 函数运行证据。

**补强。**查询响应说明 `searched_fields` 和 `coverage`。正文、命令、结果、系统／配置材料按类别分别处理；需要找错误时选择已授权工具结果索引或原始片段检索。首次不默认索引全量敏感输出，也不建立向量库。短词 LIKE 要限定项目、时间或候选数量并有取消／超时限制；耗尽扫描预算应返回不完整，而不是零命中。

### WK08：最新活动时间不是扫描完成时间

**源码事实。**`latest_activity()` 是 `MAX(updated_at)`；MCP 文案由该值形成索引覆盖提示。CLI 已有 `index` 与 `refresh`，不必 GUI 常驻才能一次更新；其默认数据库定位还可能做旧数据库复制迁移。

**位置：**`db.rs:693–700`；`mcp/tools.rs:466–474`；`bin/wake_cli.rs:70–114`。

**局部验证。**增加独立扫描时点元数据不会改变 MAX(updated_at)。本实验只证明两者不是同一量，不能证明全部扫描行为。

**补强。**分别保存最后活动、扫描开始／完成、每个来源的成功或失败、捕获字节边界、解析版本、待处理变化。库里有一条新的会话，不证明其他目录已扫完。手动刷新需要明确“读哪些源、写哪个索引”，不隐藏在查看状态动作里。

## 5. 索引、权限和导出链路

### WK09：扫描锁、格式代次与副本裁决值得借鉴

**源码事实。**扫描器提供首建和增量更新，使用跨进程 IndexLock；SQLite busy_timeout 不能替代“一个逻辑扫描写者”的规则。不同配置的扫描器可能互相把未发现来源当删除。源变化主要用 mtime 与大小做快速判断，副本按优先级、更新时间等裁决，并有解析失败时尝试其他副本的路径。notify 的监听只触发普通索引工作。

**位置：**`db.rs:188–198,373–388`；`scanner.rs:139–199,313–632`；`watcher.rs:114–229`。

**补强。**吸收单写者、索引 schema／解析版本、批量更新和去抖。mtime/size 是性能提示，不作为证据完整性校验；相同逻辑会话的不同内容保留 snapshot 冲突，不覆盖已接纳证据。来源离线或解析失败不直接等于被删除。监听暂缓，确需启用时不触发模型、记忆发布或新角色。

### WK10：Wake 的 project 是便利过滤，不是我们的任务 ACL

**源码事实。**项目参数省略时返回 All；路径可以匹配祖先或多个子项目，名称也可返回多个项目。`get_session` 根据 key 查找，不通过相同 project 过滤。native id 歧义会拒绝并列候选。记忆路径有用户级资料的额外语义。

**位置：**`mcp/tools.rs:93–129,407–450,989–1008,1111–1145`；`services/context.rs:8–56`。

**边界。**这是个人本地资料工具的设计选择，不等于已经发现公网授权漏洞；它没有承诺我们所需的多角色、项目级业务隔离。

**补强。**Team MCP 以当前可信计划解析 ProjectID／source allowlist。列表、搜索、正文、子会话和记忆访问各自校验，不能仅在列表过滤。不得同时给角色直接暴露全库 Wake 工具，又声称全部历史读取受 Team Service 限制。错误响应不泄露未授权项目名称或目录。读取 provider 若使用宽身份，明确代理信任范围，最好在扫描前就减少其可读来源。

### WK11：查询索引与现场打开可能对应不同版本

**源码事实。**详情使用 `TranscriptCache`，缓存键含文件路径、mtime、size 和项目元信息；必要时现场重新解析。子会话还有独立读取路径，避免父文件不变时使用旧子内容。

**位置：**`mcp/tools.rs:25–75,1140–1158`。

**补强。**搜索结果应绑定 snapshot／parser revision；点开命中时不能无提示变成另一版文件。允许提供“查看更新版”，但这是新引用而非覆盖旧证据。相同大小和 mtime 的替换应由内容校验发现，而不能只靠缓存戳。

### WK12：Markdown／JSON 导出和 compact 分页不是原始备份

**源码事实。**Markdown 导出跳过 Meta；JSON 导出是解析后消息集合。compact 还有总量、每消息预算、工具显示数和图片省略；下一页 `next_seq` 指向后续消息，不是当前被截断消息的剩余字节。

**位置：**`services/exporter.rs:91–154,245–395`。

**补强。**导出分别命名为“阅读稿”“选定原始资料包”“恢复证据包”。必须标明裁剪、过滤、脱敏和缺失。恢复包引用原始 span 与摘要，不能把漂亮 Markdown 当作完整原档。片段分页游标绑定 snapshot＋字节位置；过期游标报错，不偷偷跳到 live 文件。

### WK13：只读打开后复制 DB/WAL/SHM 是可读性回退，不是快照保证

**源码事实。**外部 SQLite 优先 readonly 打开；失败后依次复制主库、WAL、SHM 到临时目录，再只读打开复制品；源码不使用 immutable=1。工具还把一些 schema 查询失败归为空集合。

**位置：**`adapters/sqlite_ro.rs:19–71,90–102`。

**补强。**不能把逐文件复制叫做原子一致快照。首版不需要读状态库就不读。必须保留事务一致性时使用适用的 SQLite Backup API 或明确停止后的获准快照；具体 readonly/WAL权限与驱动能力仍需验证。失败即报告 unavailable／inconclusive，不改源库、不无声启用复制回退。[O3]

### WK14：用户状态逻辑分表，不代表物理灾难隔离

**源码事实。**索引、prefs、user_data 等在同一库。普通 rebuild 测试验证保留用户记录；但 `open_or_rebuild` 在打开失败路径挪走主库、移除 sidecar 并建新库，明确提示收藏、置顶和位置配置丢失。

**位置：**`db.rs:26–186,342–370`；`tests/db_roundtrip.rs:96–136`。

**补强。**上轮“索引与用户标记分开保存”只能理解为正常流程下逻辑分离，不能当作独立故障恢复承诺。正式业务证据放 Team Service 的持久层；派生索引可以重建。业务库不得套用“任何打开失败都自动重建”的策略。授权、依赖引用和人工决定不进入可随时清空的索引权威。

## 6. 运行副作用与可参考的工程手法

### WK15：既有 CLI 恢复，也有 macOS 桌面深链

**源码事实。**源码包括 Codex Desktop bundle 标识检查、`codex://threads/<id>` 深链和系统 `open` 调用；返回 ok 取决于 OS 命令退出状态。不是上轮文档评估中仅提到的终端 CLI 恢复。

**位置：**`services/terminal/mod.rs` 的恢复分派；`services/terminal/macos.rs:111–138,572–593`。

**补强。**“已发出打开请求”只能当 UI 导航观察，不能写成“已安全接管／任务已继续”。深链是否对用户当前 App 可用须实测，不把源码 URL 当官方稳定接口。本项目不据此新增执行器、换成 CLI 或恢复 CodexBoard 路线。

### WK16：清理前预览和重验可以借，删除产品功能不借

**源码事实。**清理模块使用文件身份／大小／mtime stamp，对执行前变更和部分链接问题作检查。

**位置：**`cleanup.rs:200–210,291–330`。

**补强。**吸收“预览具体对象→确认→执行前重新验证”的效果约束，用于证据导出、计划修订等操作。但首版不实现删除第三方历史会话，不把删除源日志混进索引清理。文件 stamp 也不替代内容 digest 与业务授权。

### WK17：MCP 入口的只读范围要解释到具体效果

**源码事实。**MCP 为同步、自写 JSON-RPC 实现，工具有只读 annotations；读取已存在索引使用 readonly 连接。CLI 共用工具实现并输出格式化文本。自带 Skill 引导用户在索引缺失或过时时运行 index/refresh；该动作会写本地索引。

**位置：**`mcp/mod.rs:1–48,122–233`；`mcp/tools.rs:116–129`；`bin/wake_cli.rs:70–114`；`skills/wake/SKILL.md:1–42`。

**补强。**复用业务函数和有界输出的思想，不复制一套手写 MCP 协议实现。我们的 Team MCP 使用官方 SDK 与窄授权入口。状态查询默认只返回已有观察；捕获、建索引、导出和宿主导航分别列效果。协议 annotations 不是权限控制，也不证明没有审计写入或初始化副作用。[O7]

## 7. WK18：验证证据与剩余工作

### 7.1 本轮确实执行的测试

运行环境：Linux，Python 3.13.5，SQLite **3.46.1**。没有 rustc/cargo；没有安装工具链或任何仓库依赖。

| 组别 | 数量 | 实际覆盖 |
|---|---:|---|
| 原 SQL 行为验证 | 14 | 从 `db.rs` 提取 DDL 和 UPSERT；FTS5、中文短词、字面量转义、诊断字段、活动时间、外部内容同步、事务回滚、readonly |
| 静态／样例断言 | 6 | 工具输出未进索引、index/refresh 分支、未知行 fixture、工具结果状态分支、可选 project/get by key、上传包 SHA |
| 结果 | 20 / 20 | 只证明各断言所检查的局部行为 |

其中用于生成 MATCH/LIKE 参数的两个小函数是按源码写的 Python 等价表达，不是原 Rust 函数。SQL 用的是 Python 链接的 SQLite，不是 Wake bundled SQLite，因而仍需在目标驱动重跑。

报告与脚本：`review/probes/results.json`、`results.txt`、`offline_sql_and_source_checks.py`。原始提取 SQL 一并保留。

### 7.2 阅读过但没有执行的原测试

`tests/adapter_contracts.rs` 的 Codex 解析和序号一致性；`tests/db_roundtrip.rs` 的检索和普通重建；`tests/scanner_finale.rs` 的重复副本、失败回退与扫描；`tests/cli.rs` 的索引写者和查询路径；`tests/mcp_stdio.rs` 的协议交互。实际读过的窗口在 `review/reads.jsonl`，逐行摘录不是完整测试覆盖清单。

源码测试存在、CI 定义存在，不等于本轮或用户机器上测试通过。上轮 SkillBox 的 20+1 验证也不能计入本轮 Wake 结果。

### 7.3 复用前仍需完成

固定本地 Rust toolchain 与 Cargo.lock；先审查脚本效果，再在隔离 synthetic home 运行相关 core 测试。之后验证目标 macOS、Codex App 实际会话格式、只读 WAL 数据源、有界解析、大文件取消、真实 MCP schema、权限与错误语义。不得拿真实主目录做未授权 smoke scan。

## 8. 使用结论与代码复用边界

| 可直接吸收为设计原则 | 需改造和验证 | 不进入首版 |
|---|---|---|
| Adapter 分层、共享视图、列表与详情分路 | 原始来源定位、诊断传播、失败状态、scope ACL | GPUI 桌面重建 |
| SQLite FTS5、短词回退、字面量转义 | 搜索覆盖、索引与现场一致性 | 全平台 Agent 适配 |
| 单逻辑索引写者、解析格式版本 | 证据持久层与派生索引隔离 | 第三方会话删除 |
| 手动索引／刷新、不靠 LLM 扫描 | 身份与权限窄化、结构化 provider 返回 | 远程同步、自动 resume |
| 效果前预览与重验、有限输出 | 严格字节引用与可恢复导出 | 全库 Bootstrap、默认记忆采集 |

可以在遵守 MIT 文本及依赖许可要求的前提下借用选定代码；这不表示要 fork 并持续同步整个 Wake 产品。若选择直接依赖 core／CLI，需明确版本与维护责任。首个任务恢复试点仍可只用 TypeScript 适配一类已批准的 Codex JSONL。

## 9. 外部资料索引

以下只用于技术说明与建议，不替代附带源码。查阅日期 2026-09-24；网页可能有缓存，未据此锁定所有依赖补丁版本。

- [O1] Node.js 发布线：`https://nodejs.org/en/about/previous-releases`。
- [O2] SQLite FTS5：`https://sqlite.org/fts5.html`；trigram、短词限制、external-content 一致性。
- [O3] SQLite Backup API：`https://sqlite.org/backup.html`；一致快照的官方接口语义。
- [O4] Node.js worker_threads：`https://nodejs.org/docs/latest-v24.x/api/worker_threads.html`。
- [O5] Fastify：`https://fastify.dev/docs/latest/`。
- [O6] better-sqlite3 API：`https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md`。
- [O7] OpenAI MCP server：`https://developers.openai.com/plugins/build/mcp-server`；官方 SDK、工具及授权边界。
- [O8] MCP TypeScript SDK：`https://ts.sdk.modelcontextprotocol.io/`。
- [O9] Vite：`https://vite.dev/guide/`。

**结论：Wake 是优秀的历史资料设计参考；我们需要在其“可找、可读”的能力外，补上“来源固定、诊断保真、权限明确、证据接纳、执行权核对”。**
