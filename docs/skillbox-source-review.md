# SkillBox 源码审阅与方案影响报告

> 版本：Source Review v0.1；日期：2026-09-21。  
> 依据：用户上传的 `skillbox-main.zip`；不以网页 main 的后来变化替代这份材料。  
> 状态：**关键调用链已静态审阅，20 项纯模块行为探针通过，1 项静态断言通过；不是完整安全审计、数据库集成验证或 Codex App 联调认证。**  
> 未修改原源码、用户仓库或宿主配置，未安装依赖，未运行原安装脚本、外部服务或外部模型。

## 1. 快照与审阅范围

| 项目 | 记录 |
|---|---|
| 用户指定项目 | `kitze/skillbox` |
| ZIP 内根目录 | `skillbox-main/` |
| ZIP 注释中的提交标识 | `cda64ad3310abe690c6d497352791da4cfeb9a0a` |
| ZIP SHA-256 | `e96e281ccacb4a377b96b4d45849992a17ddc191eb9e6169c6cd9fa9c446cc92` |
| 解压文件数 | 105（不计目录） |
| Git 工作树/远端 HEAD | 压缩包不含 `.git`；未读取远端、未独立用 Git tree 核验注释标识 |
| 运行环境 | Node v22.16.0 / Linux；未安装 Bun |

ZIP 注释作为这次快照的提交标签，不作为来源签名或“远端当前 main”证明；归档哈希和逐文件清单用于本地重验。本轮只审阅与资产、访问、交付、提案和就绪有关的代码，不声称逐行审阅全部 UI、构建依赖、所有文件或第三方 SDK。

原计划 v0.2 的“源码未取得”已经被本次材料补齐；但用户目标 `codex-agent-team` 当前实现仍未提供/核对，不能直接确定它的代码改动位置和迁移 SQL。

## 2. 源码定位索引

下列行号均指解压后的原始文件，不是网页渲染行号。`reference/skillbox-main.zip` 保留原包；`source-manifest.json` 保存完整文件指纹。

| 编号 | 核验主题 | 原始代码位置 |
|---|---|---|
| SB01 | 版本存储与并发发布 | `src/server/schema.ts:11–62；src/server/library.ts:491–653；src/server/app.ts:373–392` |
| SB02 | 完整包验证，不只验证正文 | `src/server/library.ts:49–99、528–537；cli/package.mjs:5–55；src/shared.ts:27–33` |
| SB03 | Bundle 不是传递依赖锁文件 | `src/server/bundles.ts:9–43；src/server/library.ts:192–211、387–424；tests/library.test.ts:86–186` |
| SB04 | 客户端身份与可变 Profile | `src/server/auth.ts:16–68；src/server/access.ts:21–58；src/server/library.ts:192–206、628–632；src/server/app.ts:642–650` |
| SB05 | 稳定资源地址不是稳定内容 | `src/skill-manifest.ts:52–77；src/server/skill-resources.ts:15–55、103–140；tests/library.test.ts:507–519、616–619` |
| SB06 | 存储兼容与原生兼容是两套检查 | `src/server/library.ts:100–190；src/skill-manifest.ts:91–258；src/server/skill-resources.ts:60–100；src/server/mcp.ts:54–155、339–377` |
| SB07 | 提案、审核、发布与恢复 | `src/server/access.ts:84–195；src/server/library.ts:491–653；tests/library.test.ts:1465–1526` |
| SB08 | 精确下载与可变缓存防护 | `cli/skillbox.mjs:290–312；cli/package.mjs:57–90；tests/package.test.ts:27–47` |
| SB09 | 固定提交的 GitHub 导入 | `src/server/github-import.ts:36–78、142–201、204–419；src/server/app.ts:193–267；src/skill-import-safety.ts:1–23` |
| SB10 | 读取也会登记事件，使用仍是自报 | `src/server/library.ts:213–231、298–299、426–450、453–477；src/server/mcp.ts:209–273；src/server/auth.ts:114–125` |
| SB11 | Executor 检查有实际远程调用 | `src/server/executor.ts:40–46、193–275；src/server/app.ts:558–594；src/client/executor-settings.tsx:20–34、197–202` |
| SB12 | Bootstrap 与安装副作用 | `bootstrap/SKILL.md:1–24；scripts/install-client.py:13–97；src/server/mcp.ts:156–336` |
| SB13 | 推荐的可见回退与再校验 | `src/server/recommendations.ts:122–169、320–431；src/server/library.ts:301–370；tests/recommendations.test.ts:91–175` |
| SB14 | 单所有者资产库不是我们的任务服务 | `SECURITY.md:1–12；src/server/auth.ts:23–24、50–65；src/server/schema.ts:11–118；src/server/db.ts:1–9；package.json:1–52` |
| SB15 | 源码、测试定义和运行结果分级 | `tests/library.test.ts:1–84、86–186、456–650、1392–1598；tests/package.test.ts:1–47；compose.test.yml:1–26；scripts/test-isolated.sh:1–5` |

## 3. 发现与设计影响

### SB01：版本存储与并发发布

**源码事实：**skills 保存当前指针，revisions 保存新 UUID、完整 files、metadata、checksum 和来源。publish 在 PostgreSQL 事务中取得全库图 advisory lock，再比对 expectedRevision；恢复旧内容再次调用 publish，而不是改写旧 revision。

**位置：**`src/server/schema.ts:11–62；src/server/library.ts:491–653；src/server/app.ts:373–392`。

**对本项目的建议：**引用精确版本并保留历史；借鉴 CAS 与事务语义，不照搬 PostgreSQL 全图锁或迁移到参考项目技术栈。这里的不可变是已读应用路径的行为，不是数据库管理员也无法修改的存储保证。

### SB02：完整包验证，不只验证正文

**源码事实：**SkillFile 保存 path/content(base64)/sha256/size/executable；校验原始字节、大小、编码、路径冲突和必需 SKILL.md。包 checksum 是按 en-US 路径排序的 [path,sha256,executable] 数组 JSON 的 SHA-256。发布路径限制 400 文件、单文件 2,000,000 字节、总量 8,000,000 字节。

**位置：**`src/server/library.ts:49–99、528–537；cli/package.mjs:5–55；src/shared.ts:27–33`。

**对本项目的建议：**外部 checksum 的算法格式必须原样识别；自有清单另存算法版本，不能重算另一种摘要却说兼容。完整性、来源可信、许可、脚本可执行授权分开。限制数值仅用于该 Provider 适配，不自动成为整个产品限制。

### SB03：Bundle 不是传递依赖锁文件

**源码事实：**展开器返回根和嵌套 Bundle 及叶子 ID，去重；strict 写路径拒绝环/缺失，非 strict 读取可跳过不可用分支。load 某个历史 Bundle 时只换回根的 members，其他节点、子版本及授权仍使用当前状态。测试还明确检查旧 Bundle 不能恢复已撤销的子项读取。

**位置：**`src/server/bundles.ts:9–43；src/server/library.ts:192–211、387–424；tests/library.test.ts:86–186`。

**对本项目的建议：**计划应记录选中的精确叶子版本及必要组合依据，不仅是 Bundle revision。必要依赖缺失不得把 Provider 返回的子集当成完整锁定。权限随当前政策收缩，旧锁不赋予历史读取特权。

### SB04：客户端身份与可变 Profile

**源码事实：**每次 HTTP/MCP 请求认证时用 active client token 的哈希联接当前 Profile；真实权限来自 Profile，不是客户端表里旧 role 标签。Profile 版本做保存冲突检查；新建资产在允许 create 且非 allSkills 的情况下会加入创建者 Profile 的授权集合。

**位置：**`src/server/auth.ts:16–68；src/server/access.ts:21–58；src/server/library.ts:192–206、628–632；src/server/app.ts:642–650`。

**对本项目的建议：**RoleProfile、外部访问 Profile、任务授权不是同一对象。记录真实 principal 引用，不能只绑定角色名；MVP 使用最小只读身份、关闭 create/update/delete/propose，避免引入创建后自动授权扩张。不承诺撤销能中止已经进入处理的读取。

### SB05：稳定资源地址不是稳定内容

**源码事实：**原生 skill://skillbox/<UUID>/<name>/<path> 地址不含 revision 且拒绝 query/hash；resources/read 每次通过 activeRevision 取当前、未禁用且未归档的叶子内容。测试明确断言发布后 URI 不变而资源 digest 改变。

**位置：**`src/skill-manifest.ts:52–77；src/server/skill-resources.ts:15–55、103–140；tests/library.test.ts:507–519、616–619`。

**对本项目的建议：**不能用 URI 当作内容锁。当前版本展示可用原生地址；要恢复 R1，选用支持精确 revision 的工具/HTTP/包接口。manifest 与逐文件读取之间如发生更新，必须发现 digest 漂移；不自动接受新内容。

### SB06：存储兼容与原生兼容是两套检查

**源码事实：**传统发布元数据解析容忍部分旧 frontmatter；原生 manifest 审核要求严格 UTF-8/YAML、name、description 等，存在兼容报告而不修复正文。原生列表按 25 个存储候选分页，兼容过滤后某页可无返回项但仍有 nextCursor。代码按协议路径暴露 skills/list、skills/get 并给出 private/zero-TTL 提示。

**位置：**`src/server/library.ts:100–190；src/skill-manifest.ts:91–258；src/server/skill-resources.ts:60–100；src/server/mcp.ts:54–155、339–377`。

**对本项目的建议：**包可读不等于宿主原生可加载。兼容报告只对应这份源码实现的格式，不证明用户 Codex App 支持该协议。分页以 nextCursor 终止，不以 items 为空终止；新协议接入不是首版前提。

### SB07：提案、审核、发布与恢复

**源码事实：**propose 需要权限与当前基线，仅存 pending；禁止改变 kind/members/disabled/archived/replacement 五类控制字段。reviewProposal 需要 admin、锁定提案行，在同一外层事务调用 publish 校验基线，再写 reviewed/publishedRevision；旧基线或重复审核返回冲突。

**位置：**`src/server/access.ts:84–195；src/server/library.ts:491–653；tests/library.test.ts:1465–1526`。

**对本项目的建议：**借鉴同事务提交与 CAS。提案仍可改变正文、脚本及其他元数据，五字段保护不代表只改无害文字。首版通过仓库评审即可；以后接入时分别授权提案、发布和任务采用，Agent 不得取得 admin。

### SB08：精确下载与可变缓存防护

**源码事实：**fetch 可传 id@revision 并校验响应身份；缓存按 base URL 与 token 的哈希分区。materialize 验证完整包，在同一 root 暂存，设置 0600/0700 文件模式；已有同名目录不当可信缓存复用，而返回新验证副本。没有运行下载脚本或安装运行库。

**位置：**`cli/skillbox.mjs:290–312；cli/package.mjs:57–90；tests/package.test.ts:27–47`。

**对本项目的建议：**API 与内部引用必须强制 revision，因为 CLI 不带 revision 也会成功下载当前版。`load`/`readFile` 返回文本时使用 UTF-8 解码；`readFile` 仅检查 NUL/长度而非严格 UTF-8，返回哈希仍指原字节。需要逐字节验证时取得原始 base64 包，不能把文本重新编码结果默认为原文件（`src/server/library.ts:426–477`）。缓存目录不是宿主安装位置。复用时保留 LICENSE；对 macOS、父目录符号链接、并发和崩溃恢复仍需实测。

### SB09：固定提交的 GitHub 导入

**源码事实：**仅接受公开 GitHub 白名单地址，解析到完整提交；拒绝截断树、符号链接、子模块、LFS 和不合范围内容，按 Git blob SHA-1 与长度验证下载，再算 SHA-256。发布要求 commit-pinned tree URL，重新下载并检查目标 id/expectedRevision。预览不是服务端保存的一条审批凭据。

**位置：**`src/server/github-import.ts:36–78、142–201、204–419；src/server/app.ts:193–267；src/skill-import-safety.ts:1–23`。

**对本项目的建议：**借鉴来源固定、逐文件验证和失败关闭。预览可能联网，启发式秘密检查不保证无秘密。未来自有导入还应让批准绑定完整清单摘要、选择与过滤规则版本；首版不为此构建导入平台。

### SB10：读取也会登记事件，使用仍是自报

**源码事实：**search/load/read_file/包获取等路径会写 events；部分工具仍有 readOnlyHint。report_skill_use 明确是自报 applied/succeeded/failed，只验证可读取的 revision 后写事件。harness/model/task/purpose 来自客户端字段或请求头，不是宿主认证信息。

**位置：**`src/server/library.ts:213–231、298–299、426–450、453–477；src/server/mcp.ts:209–273；src/server/auth.ts:114–125`。

**对本项目的建议：**区分 read_with_audit、外发内容、创建草稿和业务写入，不把“读取”说成零持久化。Event 做审计，Attempt 使用身份和独立证据；使用次数/自报成功不驱动 done。reader 仍拥有 recommend_skills/report_skill_use；关闭资产写权限不等于关闭所有额外调用，需在所选工具面另外限定。

### SB11：Executor 检查有实际远程调用

**源码事实：**authenticated 只是 tokens/bearer 是否存在。读取 integrations 时可以刷新 OAuth、连接远端 MCP，并调用 execute 工具执行固定的 connections.list 查询，结果缓存 60 秒并按 integration 聚合健康状态。设置页在已配置身份时会于加载阶段发起该请求。

**位置：**`src/server/executor.ts:40–46、193–275；src/server/app.ts:558–594；src/client/executor-settings.tsx:20–34、197–202`。

**对本项目的建议：**不能将 GET 或打开页面一概视为被动观察。我们的界面默认读已有证据，主动检查另列效果；不复制外部 Executor、OAuth 凭据托管和全局健康聚合来冒充当前角色就绪。它不是执行上传 Skill 脚本，但确实是远端工具调用。

### SB12：Bootstrap 与安装副作用

**源码事实：**Bootstrap 要求每次任务先遍历授权索引，并在无 MCP 时建议 CLI 路径。安装脚本先下载 CLI、写全局 .agents Skill 与凭据、修改 .codex/其他宿主配置，再协商 MCP 与读取目录。末尾要求工具数 4 或 5；当前基本 reader 为 5，writer/upsert 为 6，propose-only 增至 7。

**位置：**`bootstrap/SKILL.md:1–24；scripts/install-client.py:13–97；src/server/mcp.ts:156–336`。

**对本项目的建议：**不要自动运行原安装脚本或继承全库检索/备用通道。数量断言与部分权限组合存在静态不匹配，失败发生在若干落盘之后；未运行安装器，不能把这一点描述为已做真实安装失败测试。未来验证按必需工具名、schema 与拒绝行为，不按固定总数。

### SB13：推荐的可见回退与再校验

**源码事实：**推荐有可选外部模型 Provider，会发送 task 与已授权 active leaf 描述；缓存绑定 catalog/任务，异步计算后重新取目录。限流/超时/配置失败时返回 method=search、fallbackReason、noMatch=null，区别于语义无匹配。代码 Provider 范围比 SECURITY 文本列举更广，不能只按说明配置。

**位置：**`src/server/recommendations.ts:122–169、320–431；src/server/library.ts:301–370；tests/recommendations.test.ts:91–175`。

**对本项目的建议：**可借鉴变化后再校验和不伪造无匹配；不复制自动推荐作为任务依赖选择。搜索回退不是换执行模型，但是否允许仍需明确；首版不开推荐、不给额外模型服务发送任务。

### SB14：单所有者资产库不是我们的任务服务

**源码事实：**仓库为 Bun/Hono/Drizzle/PostgreSQL 方向，主状态是 skills/revisions/profiles/clients/proposals/events；管理员 Token 或有效 UI 会话得到 owner 权限。没有从这些对象证明我们的 Mission/Assignment/Attempt、人类验收或 Codex 执行权控制。

**位置：**`SECURITY.md:1–12；src/server/auth.ts:23–24、50–65；src/server/schema.ts:11–118；src/server/db.ts:1–9；package.json:1–52`。

**对本项目的建议：**只取资产生命周期模式或将其作为可选 Provider。不能为了源码可用就替换 Team Service、自建任务权限，或把单所有者 Profile 当作独立租户。

### SB15：源码、测试定义和运行结果分级

**源码事实：**项目有真实数据库/HTTP/MCP 集成测试定义，也有纯模块测试；原套件需 Bun、依赖和 PostgreSQL。当前环境 Node v22.16.0、无 Bun，未安装依赖、未启动数据库；仅执行已审查纯模块的自建离线探针。

**位置：**`tests/library.test.ts:1–84、86–186、456–650、1392–1598；tests/package.test.ts:1–47；compose.test.yml:1–26；scripts/test-isolated.sh:1–5`。

**对本项目的建议：**20 个行为探针与 1 个静态断言均通过，只证明这些检查；原完整测试、事务竞争、协议联调、macOS 和 Codex 宿主为 NOT_RUN。

## 4. 必须区分的读取语义

| 入口（本快照） | 精确历史版本 | 内容范围 / 特别语义 | 建议用途 |
|---|---|---|---|
| MCP `load_skill({id, revision})` | 支持；revision 可省略，所以适配层必须强制 | 正文、清单、来源；参考链接与 Bundle composition 仍可能是当前解析 | 指定 revision 的工作指引；不要自动采用返回的新参考 |
| MCP `read_skill_file({id, revision, path})` | 支持且参数必需 | 160,000 字节上限；含 NUL 视为二进制，不在该路径返回 | 固定 revision 文本配套文件 |
| HTTP `GET /api/skills/:id?revision=R` | 支持 | 对应 load | 窄内容适配器 |
| HTTP `GET /api/skills/:id/bundle?revision=R` | 支持 | 返回 JSON `skillbox/v1` 完整包，不是展开全部子 Skill 的组合 ZIP | 固定内容包取得与本地验证 |
| CLI `fetch id@R` | 支持；不写 @R 会取当前 | 下载、校验并落盘；返回绝对目录，不注册宿主插件 | 已授权文件取得，不自动安装 |
| `skills/list` / `skills/get` + `resources/read` | 原生 URI 无 revision 参数，读当前 active revision | 原生 manifest、digest、兼容过滤；当前 Profile 与生命周期生效 | 发现/当前版展示；严格历史恢复不能只依赖此路 |
| `skill://<UUID>` 正文引用解析 | 稳定资产身份，不是内容版本 | resolve 返回当前 revision；不授予访问 | 提出依赖候选；获准后固定目标版本 |

本节是源内接口描述，不是当前 Codex App 的原生功能列表，也不认证该仓库所称协议版本的外部标准状态。适配采用哪条路径是显式选择，不能失败后静默改走另一路。

## 5. 离线验证结果

运行方式：自建 harness 导入未改动的 `cli/package.mjs`、`src/server/bundles.ts`、`src/skill-import-safety.ts`。Node 使用实验性类型擦除读取两个无外部依赖的 TypeScript 模块；所有生成文件都在隔离临时目录，结束后清理。未执行示例 shell 脚本。

**20 项行为探针 PASS；1 项静态断言 PASS。**P21 不是运行安装器，也不是实际启动 MCP 服务。

| ID | 检查 | 类型 | 结果 |
|---|---|---|---|
| P01 | valid complete package verifies | 原模块行为 | PASS |
| P02 | tampered payload rejected | 原模块行为 | PASS |
| P03 | size mismatch rejected | 原模块行为 | PASS |
| P04 | parent traversal rejected | 原模块行为 | PASS |
| P05 | absolute/backslash/colon paths rejected | 原模块行为 | PASS |
| P06 | case-insensitive path collision rejected | 原模块行为 | PASS |
| P07 | Unicode normalization collision rejected | 原模块行为 | PASS |
| P08 | file/directory path collision rejected | 原模块行为 | PASS |
| P09 | missing SKILL.md rejected | 原模块行为 | PASS |
| P10 | changed executable mode breaks prior package checksum | 原模块行为 | PASS |
| P11 | binary bytes survive verified materialization | 原模块行为 | PASS |
| P12 | mutable cache copy is not reused | 原模块行为 | PASS |
| P13 | direct symlink cache root rejected | 原模块行为 | PASS |
| P14 | file modes preserved without running scripts | 原模块行为 | PASS |
| P15 | Bundle helper returns Bundle IDs and deduplicated leaves | 原模块行为 | PASS |
| P16 | strict Bundle expansion rejects cycle | 原模块行为 | PASS |
| P17 | strict rejects missing member; non-strict skips it | 原模块行为 | PASS |
| P18 | disabled branch suspends inherited grant without deleting independent grant | 原模块行为 | PASS |
| P19 | nested archived member excluded; directly named archived root still traversed | 原模块行为 | PASS |
| P20 | import path exclusion and secret heuristic | 原模块行为 | PASS |
| P21 | installer count assumption excludes writer/proposer advertised tool sets | 源码静态断言 | PASS |

复现文件：`verification/offline-probes.mjs`、`verification/offline-probes.json`、`verification/offline-probes.stderr`。stderr 中的类型擦除实验性提示不表示原项目采用 Node 作为正式服务运行环境。

```bash
# 先在隔离位置解压 reference/skillbox-main.zip，按实际路径设置。
# 只运行本包中已审阅的离线 harness，不运行 install-client.py 或整套服务。
SKILLBOX_SOURCE_ROOT=/absolute/path/to/skillbox-main \
  node --experimental-strip-types verification/offline-probes.mjs
```

| 尚未执行 | 为什么不能用本次 PASS 代替 |
|---|---|
| Bun 原测试套件、构建和类型检查 | 本机无 Bun/项目依赖，未安装；不能声称 CI 通过 |
| PostgreSQL CAS、提案事务与并发图编辑 | 需要真实临时数据库；目前只有代码与测试定义证据 |
| HTTP/MCP 身份撤销和 2026 协议 | 尚未运行服务/SDK 集成；纯 Bundle 模块测试不覆盖认证 |
| 真实 GitHub 下载/预览发布 | 没有联网调用；URL、Git blob 校验路径仅静态审阅 |
| macOS 缓存路径/权限/文件系统竞态 | 离线探针运行在 Linux，不能推广为所有 OS 验证 |
| Codex App Skill 加载、工具暴露、硬只读和控制权 | 用户宿主未接入，必须本地探针 |
| 多租户与整个安全面 | 本项目本身是单所有者；没有做完整威胁建模或依赖审计 |

## 6. v0.2 的 SR01–SR12 如何关闭

“已读”只关闭缺少源码这个任务，不表示所有运行验收已经完成。

| 任务 | 本轮覆盖 | 剩余 |
|---|---|---|
| SR01 revision / 恢复 | SB01 静态调用链 | 真实库历史/恢复测试 |
| SR02 CAS / 并发 | SB01、SB07 及测试定义 | 数据库竞争及失败注入 |
| SR03 Bundle / Profile | SB03、SB04；P15–P19 部分模块实测 | 历史根+子版本变更+ACL 联调 |
| SR04 发现与授权 | SB04–SB06；已读 API/MCP/资源路径的共用认证入口与工具内检查 | 真实 MCP/HTTP 越权与撤销 |
| SR05 提案发布 | SB07 及 stale/重复审核断言 | 原事务测试 |
| SR06 版本读取一致性 | SB05、SB06、读取语义表 | 多次读取中途更新；宿主 digest 处理 |
| SR07 包与落盘 | SB02、SB08；P01–P14 | macOS、并发、崩溃、父目录/权限边界 |
| SR08 导入 | SB09；P20 仅覆盖过滤 helper | 真实/模拟 GitHub 响应和批准清单绑定 |
| SR09 安装/Bootstrap | SB12；P21 静态不匹配 | 不默认安装；采用前重做受控配置方案 |
| SR10 撤销/缓存 | SB03–SB06、SB08、SB13 | 真实鉴权变化、离线政策和恢复 |
| SR11 推荐/统计效果 | SB10、SB11、SB13 | 只有选入后才做外部服务和数据授权测试 |
| SR12 测试有效性 | SB15，20+1 明确分级 | 原套件与用户项目、宿主测试 |

## 7. 结论与边界

保留“小能力模块、唯一任务业务权威、SkillBox 可选”的方向。最重要的增量不是增加一个 Registry，而是明确：

- 资产 ID、当前指针、不可变内容版本与本次计划锁是不同对象。
- 当前访问范围允许收缩，但不能通过 Profile/Bundle 变化自动扩大当前任务计划。
- 读取、审计记录、文件下载、配置安装、远程探针、业务执行和人类验收有不同效果。
- SkillBox 的版本、包、提案模式可借鉴；其 Bootstrap、安装脚本、推荐和 Executor 接入不自动采纳。
- 原生资源协议支持以目标宿主实测为准；源码里提供接口不等于 App 已支持。

对应主方案：`role-capability-readiness-design-v0.3.md`。本报告不改变用户已确认的范围，也不构成在本机安装/部署 SkillBox 的授权。
