# Wake 源码证据摘录

> 来自用户上传 `Wake-main.zip`。保留路径和原始行号；不是本项目实现。
> ZIP 注释：`269c50b466b023a0f38cc14e34105ab27b983dd2`。ZIP SHA-256：`638d9396eb5f24229ea7f6e031071369534fd89557a2c4e16963e1455c19a3fe`。
> 以下是为结论选择的局部窗口，判断上下文时仍应读取原文件。源码 MIT 许可及版权见包内 LICENSE。

## WK01 分层与实际技术栈

### `Cargo.toml:1–23`

```text
0001 | [workspace]
0002 | resolver = "2"
0003 | members = ["crates/wake-core", "crates/wake"]
0004 | 
0005 | [workspace.package]
0006 | version = "0.8.1"
0007 | edition = "2021"
0008 | license = "MIT"
0009 | 
0010 | [workspace.dependencies]
0011 | anyhow = "1"
0012 | serde = { version = "1", features = ["derive"] }
0013 | serde_json = "1"
0014 | rusqlite = { version = "0.32", features = ["bundled"] }
0015 | dirs = "5"
0016 | walkdir = "2"
0017 | notify = "7"
0018 | chrono = { version = "0.4", features = ["serde"] }
0019 | zstd = "0.13"
0020 | semver = "1"
0021 | reqwest = { package = "zed-reqwest", version = "0.12.15-zed", default-features = false, features = ["blocking", "json", "rustls-tls-native-roots"] }
0022 | base64 = "0.22"
0023 | image = { version = "0.25", default-features = false, features = ["png", "jpeg", "gif", "webp", "bmp", "tiff"] }
```

### `crates/wake/Cargo.toml:12–23`

```text
0012 | [dependencies]
0013 | wake-core = { path = "../wake-core" }
0014 | anyhow.workspace = true
0015 | serde.workspace = true
0016 | serde_json.workspace = true
0017 | gpui = { git = "https://github.com/zed-industries/zed" }
0018 | gpui_platform = { git = "https://github.com/zed-industries/zed", features = ["font-kit", "x11", "wayland", "runtime_shaders"] }
0019 | gpui-component = { git = "https://github.com/longbridge/gpui-component", rev = "fd3bc2bbb8a2c4dfe268c1475682476ada54cd0c", features = ["tree-sitter-languages"] }
0020 | futures = "0.3"
0021 | chrono.workspace = true
0022 | dirs.workspace = true
0023 | semver.workspace = true
```

### `crates/wake-core/Cargo.toml:7–18`

```text
0007 | [dependencies]
0008 | anyhow.workspace = true
0009 | serde.workspace = true
0010 | serde_json.workspace = true
0011 | rusqlite.workspace = true
0012 | dirs.workspace = true
0013 | walkdir.workspace = true
0014 | notify.workspace = true
0015 | chrono.workspace = true
0016 | zstd.workspace = true
0017 | base64.workspace = true
0018 | sha2 = "0.10"
```

### `crates/wake-core/Cargo.toml:51–63`

```text
0051 | [[bin]]
0052 | name = "scan"
0053 | path = "src/bin/scan.rs"
0054 | 
0055 | # 只读 MCP server(stdio),随 Wake 一起打包、与主程序并排;见 src/mcp/
0056 | [[bin]]
0057 | name = "wake-mcp"
0058 | path = "src/bin/wake_mcp.rs"
0059 | 
0060 | # 会话查询 CLI(只读),随 Wake 一起打包、与主程序并排;解析层见 src/cli.rs
0061 | [[bin]]
0062 | name = "wake-cli"
0063 | path = "src/bin/wake_cli.rs"
```

## WK02 统一模型与来源身份

### `crates/wake-core/src/adapters/mod.rs:35–67`

```text
0035 | /// agent 数据源适配器。列表扫描与详情解析共用同一核心解析器,
0036 | /// 保证 FTS 的 seq 与详情页消息序号一致(搜索跳转依赖)。
0037 | pub trait AgentAdapter: Send + Sync {
0038 |     fn agent(&self) -> AgentId;
0039 |     /// 实例服务的远程 host;空 = 本地。只有 remote::RemoteAdapter 覆写。
0040 |     /// scanner 的同家同 ID 去重按 (host, agent, native_id) 分域——两台机器
0041 |     /// 各自续跑过的同 UUID 会话是两条会话,不能按 mtime 互吞
0042 |     fn host(&self) -> &str {
0043 |         ""
0044 |     }
0045 |     /// 本机是否有这家的数据。由 data_roots 派生,**不要覆写**——它必须与
0046 |     /// 面板逐路径的 exists() 同一判据,手写版本(is_dir/is_file)与之打架
0047 |     /// 正是 2026-08-24 数轮 review 反复修的源头之一
0048 |     fn detect(&self) -> bool {
0049 |         self.data_roots().iter().any(|p| p.exists())
0050 |     }
0051 |     /// 枚举全部会话文件。契约是"枚举必须廉价、绝不做全量解析":多数家纯 stat,
0052 |     /// SQLite 型跑元数据查询,dsh 读有界首行(子代理标志只存在于文件头)。
0053 |     /// 故障就地降级为空列表,不外溢炸掉整轮扫描。
0054 |     fn list_session_files(&self) -> Result<Vec<SessionFileRef>>;
0055 |     /// watcher 事件路径 → 本 adapter 的会话文件引用;None = 非会话文件
0056 |     /// (边车、子代理转录等)。默认:非空 .jsonl,stem 即 native_id。
0057 |     /// 各家的路径布局知识收敛在此,watcher 不再硬编码任何 agent 特例。
0058 |     fn file_ref(&self, path: &Path) -> Option<SessionFileRef> {
0059 |         parse_utils::default_file_ref(self.agent(), path)
0060 |     }
0061 |     /// 快路径:不解析文件直接给出 meta(Codex 走 state DB)。None = 无快路径
0062 |     fn quick_meta(
0063 |         &self,
0064 |         _refs: &[SessionFileRef],
0065 |     ) -> Option<std::collections::HashMap<String, SessionMeta>> {
0066 |         None
0067 |     }
```

### `crates/wake-core/src/models.rs:213–243`

```text
0213 | pub struct SessionMeta {
0214 |     /// 全局唯一键: 本地 `{agent}:{native_id}`,远程 `{agent}:{host}:{native_id}`。
0215 |     /// agent 恒为首段(scanner 的易主检测按 `split(':').next()` 取 agent);
0216 |     /// host 段只由 adapters::remote 的装饰器在解析出口插入,adapter 本体
0217 |     /// 永远生产本地格式
0218 |     pub key: String,
0219 |     /// 原生会话 id(resume 用;不含 host 段)
0220 |     pub id: String,
0221 |     /// 远程 host 名(Settings 里配置的 SSH 目标);空 = 本地会话。
0222 |     /// 只由 RemoteAdapter 装饰器填充,各家 adapter 构造时一律留空
0223 |     #[serde(default)]
0224 |     pub host: String,
0225 |     pub agent: AgentId,
0226 |     pub title: String,
0227 |     pub project_path: String,
0228 |     pub project_name: String,
0229 |     pub file_path: String,
0230 |     /// epoch ms
0231 |     pub created_at: i64,
0232 |     pub updated_at: i64,
0233 |     pub message_count: i64,
0234 |     pub size_bytes: i64,
0235 |     pub git_branch: Option<String>,
0236 |     pub model: Option<String>,
0237 |     pub tokens_used: Option<i64>,
0238 |     pub archived: bool,
0239 |     pub source: Option<String>,
0240 |     // app 自有状态(user_data 表)
0241 |     pub favorite: bool,
0242 |     pub pinned: bool,
0243 | }
```

### `crates/wake-core/src/models.rs:344–399`

```text
0344 | pub struct ParsedTranscript {
0345 |     pub meta: SessionMeta,
0346 |     pub mainline: Vec<TranscriptMessage>,
0347 |     pub sidechains: Vec<SidechainInfo>,
0348 |     pub unknown_line_count: u32,
0349 | }
0350 | 
0351 | /// FTS 索引单元(从解析后消息派生,seq 与详情页一致)
0352 | #[derive(Debug, Clone)]
0353 | pub struct IndexUnit {
0354 |     pub seq: i64,
0355 |     pub sidechain_id: Option<String>,
0356 |     pub role: Role,
0357 |     pub timestamp: Option<i64>,
0358 |     pub text: String,
0359 | }
0360 | 
0361 | #[derive(Debug, Clone)]
0362 | pub struct SessionFileRef {
0363 |     pub agent: AgentId,
0364 |     pub native_id: String,
0365 |     pub file_path: String,
0366 |     pub mtime_ms: i64,
0367 |     pub size: i64,
0368 | }
0369 | 
0370 | impl SessionFileRef {
0371 |     /// 从库内 meta 重建(打开详情/导出等 UI 入口共用)。SQLite 型会话的
0372 |     /// file_path 是虚拟路径(`<db>#<id>`),stat 失败时回退库内时间与大小。
0373 |     pub fn from_meta(meta: &SessionMeta) -> Self {
0374 |         let stat = std::fs::metadata(&meta.file_path).ok();
0375 |         Self {
0376 |             agent: meta.agent,
0377 |             native_id: meta.id.clone(),
0378 |             file_path: meta.file_path.clone(),
0379 |             mtime_ms: stat
0380 |                 .as_ref()
0381 |                 .and_then(|m| m.modified().ok())
0382 |                 .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
0383 |                 .map(|d| d.as_millis() as i64)
0384 |                 .unwrap_or(meta.updated_at),
0385 |             size: stat.map(|m| m.len() as i64).unwrap_or(meta.size_bytes),
0386 |         }
0387 |     }
0388 | }
0389 | 
0390 | #[derive(Debug, Clone)]
0391 | pub struct ParsedSession {
0392 |     pub meta: SessionMeta,
0393 |     pub units: Vec<IndexUnit>,
0394 |     pub unknown_line_count: u32,
0395 |     /// agent 在这个会话里查 Wake 的每一次调用(MCP 的 wake_* 工具、shell 里的
0396 |     /// wake-cli / wake-mcp),落 wake_lookups 表。与 units 同一处派生
0397 |     /// (`ParsedSession::derive`):自指回声过滤把这些调用从索引里跳过了,不记就没有仪表
0398 |     pub wake_lookups: Vec<WakeLookup>,
0399 | }
```

## WK03 Codex 来源与 schema 依赖

### `crates/wake-core/src/adapters/codex.rs:31–49`

```text
0031 | impl CodexAdapter {
0032 |     pub fn new() -> Self {
0033 |         // codex 认 CODEX_HOME(kooky 的 CodexUsageMonitor 同样处理)。
0034 |         // 采信前探真会话目录而不是只看根目录在不在——后者会让 CODEX_HOME
0035 |         // 指向空目录的机器整家会话凭空消失(与 opencode 探库文件同一规则)
0036 |         let root = super::env_dir("CODEX_HOME")
0037 |             .filter(|p| p.join("sessions").is_dir() || p.join("archived_sessions").is_dir())
0038 |             .unwrap_or_else(|| super::home_dir().unwrap_or_default().join(".codex"));
0039 |         Self {
0040 |             sessions_dir: root.join("sessions"),
0041 |             archived_dir: root.join("archived_sessions"),
0042 |             state_db: root.join("state_5.sqlite"),
0043 |             scan_sessions: true,
0044 |             scan_archived: true,
0045 |             links_cache: MtimeCache::new(),
0046 |             home: Some(root),
0047 |             memories: super::MemoryCache::new(),
0048 |             thread_memories: MtimeCache::new(),
0049 |         }
```

### `crates/wake-core/src/adapters/codex.rs:206–270`

```text
0206 | pub(crate) fn normalize_custom_root(dir: PathBuf) -> PathBuf {
0207 |     let name = dir.file_name().and_then(|n| n.to_str());
0208 |     let looks_data_dir =
0209 |         is_rollout_store(&dir) || matches!(name, Some("sessions") | Some("archived_sessions"));
0210 |     if looks_data_dir {
0211 |         if let Some(parent) = dir.parent() {
0212 |             // home 证据必须独立于被选目录自身:目录名恰为 sessions 时,
0213 |             // parent/sessions 就是它自己,不能算证据
0214 |             let sibling = match name {
0215 |                 Some("sessions") => parent.join("archived_sessions").is_dir(),
0216 |                 Some("archived_sessions") => parent.join("sessions").is_dir(),
0217 |                 _ => parent.join("sessions").is_dir() || parent.join("archived_sessions").is_dir(),
0218 |             };
0219 |             if parent.join("state_5.sqlite").is_file() || sibling {
0220 |                 return parent.to_path_buf();
0221 |             }
0222 |         }
0223 |     }
0224 |     dir
0225 | }
0226 | 
0227 | #[derive(Debug)]
0228 | struct ThreadRow {
0229 |     id: String,
0230 |     rollout_path: String,
0231 |     cwd: String,
0232 |     title: String,
0233 |     name: Option<String>,
0234 |     tokens_used: Option<i64>,
0235 |     archived: bool,
0236 |     git_branch: Option<String>,
0237 |     model: Option<String>,
0238 |     source: Option<String>,
0239 |     created_at_ms: Option<i64>,
0240 |     updated_at_ms: Option<i64>,
0241 | }
0242 | 
0243 | /// 只读读取 Codex state DB(三级梯度统一走 sqlite_ro,绝不写、绝不 immutable=1)
0244 | fn read_threads(state_db: &Path) -> Option<Vec<ThreadRow>> {
0245 |     let query = |conn: &Connection| -> rusqlite::Result<Vec<ThreadRow>> {
0246 |         let mut stmt = conn.prepare(
0247 |             "SELECT id, rollout_path, cwd, title, name, tokens_used, archived,
0248 |                     git_branch, model, source, created_at_ms, updated_at_ms
0249 |              FROM threads",
0250 |         )?;
0251 |         let rows = stmt.query_map([], |r| {
0252 |             Ok(ThreadRow {
0253 |                 id: r.get(0)?,
0254 |                 rollout_path: r.get(1)?,
0255 |                 cwd: r.get(2)?,
0256 |                 title: r.get(3)?,
0257 |                 name: r.get(4)?,
0258 |                 tokens_used: r.get(5)?,
0259 |                 archived: r.get::<_, i64>(6)? == 1,
0260 |                 git_branch: r.get(7)?,
0261 |                 model: r.get(8)?,
0262 |                 source: r.get(9)?,
0263 |                 created_at_ms: r.get(10)?,
0264 |                 updated_at_ms: r.get(11)?,
0265 |             })
0266 |         })?;
0267 |         rows.collect()
0268 |     };
0269 |     let ro = open_sqlite_ro(state_db, "codex")?;
0270 |     query(&ro.conn).ok()
```

### `crates/wake-core/src/adapters/codex.rs:281–298`

```text
0281 | fn read_spawn_edges(state_db: &Path) -> Option<HashMap<String, String>> {
0282 |     if !state_db.is_file() {
0283 |         return Some(HashMap::new());
0284 |     }
0285 |     let ro = open_sqlite_ro(state_db, "codex")?;
0286 |     // 缺表时 prepare 就失败(no such table)——那是老库,不是读不出来
0287 |     let Ok(mut stmt) = ro
0288 |         .conn
0289 |         .prepare("SELECT child_thread_id, parent_thread_id FROM thread_spawn_edges")
0290 |     else {
0291 |         return Some(HashMap::new());
0292 |     };
0293 |     let rows = stmt
0294 |         .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
0295 |         .ok()?;
0296 |     // 逐行 Err(列类型变了、读到一半 SQLITE_BUSY)不能 flatten 掉:少几条边
0297 |     // 与"这几条边被删了"在下游无法区分,同样会解挂那几条子会话
0298 |     rows.collect::<rusqlite::Result<HashMap<_, _>>>().ok()
```

## WK04 解析变换、截断与来源定位

### `crates/wake-core/src/adapters/codex.rs:477–500`

```text
0477 |     let mut created_at: i64 = 0;
0478 |     let mut updated_at: i64 = 0;
0479 |     let mut unknown_lines: u32 = 0;
0480 |     let mut saw_session_meta = false;
0481 |     let mut spawn: Option<SpawnMeta> = None;
0482 |     // 子线程自己的历史从哪个 ordinal 开始(首行 session_meta 里的权威值)
0483 |     let mut history_start: Option<i64> = None;
0484 |     // 子线程里"父线程历史到此为止"的下标(messages / event_fallback 各一)
0485 |     let mut inherited: Option<(usize, usize)> = None;
0486 | 
0487 |     for line in reader.lines() {
0488 |         let Ok(line) = line else {
0489 |             unknown_lines += 1;
0490 |             continue;
0491 |         };
0492 |         if line.trim().is_empty() {
0493 |             continue;
0494 |         }
0495 |         let row: Value = match serde_json::from_str(&line) {
0496 |             Ok(v) => v,
0497 |             Err(_) => {
0498 |                 unknown_lines += 1;
0499 |                 continue;
0500 |             }
```

### `crates/wake-core/src/adapters/codex.rs:821–855`

```text
0821 |             "compacted" => {
0822 |                 messages.push(mk_msg(
0823 |                     Role::System,
0824 |                     MessageKind::CompactSummary,
0825 |                     "── Context compacted ──",
0826 |                     ts,
0827 |                 ));
0828 |             }
0829 |             // 子线程每收一次派活就有一行,内容只有 {"trigger_turn":true}
0830 |             "world_state" | "inter_agent_communication_metadata" => {}
0831 |             _ => unknown_lines += 1,
0832 |         }
0833 |     }
0834 | 
0835 |     // fork 段先折叠再判 has_real:折完只剩一条 Meta 的子线程要走得到
0836 |     // event_msg 回退,与普通会话同一条路。回退流只截断、**不留标记**——
0837 |     // 它一非空就会在 has_real 为假时被选中,一条标记足以把子线程自己的
0838 |     // response_item 整条流挤掉(只跑了工具、还没出正文的子代理正是这形态)
0839 |     if let Some((cut, cut_fallback)) = inherited {
0840 |         collapse_inherited(&mut messages, cut);
0841 |         event_fallback.drain(..cut_fallback.min(event_fallback.len()));
0842 |     }
0843 | 
0844 |     // response_item 完全缺席的会话退回 event_msg 流
0845 |     let has_real = messages
0846 |         .iter()
0847 |         .any(|m| m.kind == MessageKind::Text && (!m.text.is_empty() || !m.images.is_empty()));
0848 |     let mut final_messages = if has_real {
0849 |         messages
0850 |     } else if !event_fallback.is_empty() {
0851 |         event_fallback
0852 |     } else {
0853 |         messages
0854 |     };
0855 |     assign_seq(&mut final_messages);
```

### `crates/wake-core/src/models.rs:679–690`

```text
0679 | /// 搜索 snippet 高亮哨兵(UI 层替换为高亮样式)
0680 | pub const HL_OPEN: char = '\u{e000}';
0681 | pub const HL_CLOSE: char = '\u{e001}';
0682 | 
0683 | /// 单条消息正文入库/传输上限
0684 | pub const MAX_MSG_TEXT: usize = 32 * 1024;
0685 | /// 单张图片的 base64 文本上限（约 12 MiB 原始图片）。
0686 | pub const MAX_IMAGE_B64: usize = 16 * 1024 * 1024;
0687 | /// 本地引用图片的读取上限，与内联图片解码后的量级保持一致。
0688 | pub const MAX_IMAGE_BYTES: u64 = 12 * 1024 * 1024;
0689 | /// tool 输入/输出、thinking 上限
0690 | pub const MAX_TOOL_IO: usize = 16 * 1024;
```

## WK05 解析诊断在索引链路丢失

### `crates/wake-core/src/adapters/mod.rs:548–562`

```text
0548 | impl ParsedSession {
0549 |     /// 十八家 parse_session 的唯一出口:解析层只产 meta + messages,入库派生
0550 |     /// (FTS 单元、Wake 调用记录)全在这里——再加派生字段不用碰任何 adapter
0551 |     pub(crate) fn derive(
0552 |         meta: SessionMeta,
0553 |         messages: &[TranscriptMessage],
0554 |         unknown_line_count: u32,
0555 |     ) -> Self {
0556 |         Self {
0557 |             units: units_from_messages(messages),
0558 |             wake_lookups: wake_lookups_from_messages(messages),
0559 |             meta,
0560 |             unknown_line_count,
0561 |         }
0562 |     }
```

### `crates/wake-core/src/scanner.rs:523–546`

```text
0523 |         match item.adapter.parse_session(&item.r) {
0524 |             Ok(parsed) => {
0525 |                 // quick/parsed 合并策略属各 adapter(默认 parsed 为准 quick 补缺,
0526 |                 // Codex 覆写 title/key 优先级),scanner 不再内嵌任何 agent 特例
0527 |                 let meta = match &item.quick {
0528 |                     Some(q) => item.adapter.merge_quick_meta(parsed.meta, q),
0529 |                     None => parsed.meta,
0530 |                 };
0531 |                 // 合并可能改写 key(codex 的 state thread-id):改名后的 key
0532 |                 // 也要受墓碑约束,否则改名副本绕过上面的枚举过滤
0533 |                 if store.is_key_tombstoned(&meta.key) {
0534 |                     progress.done += 1;
0535 |                     continue;
0536 |                 }
0537 |                 // 全量写入也走事务内副本裁决:扫描快照里的旧副本不得覆盖
0538 |                 // watcher 并发间隙写入的更新副本(启动扫描与手动刷新期间
0539 |                 // watcher 都活着,2026-08-24 Codex review P1)
0540 |                 match store.write_session_guarded(
0541 |                     &meta,
0542 |                     item.r.mtime_ms,
0543 |                     &parsed.units,
0544 |                     &parsed.wake_lookups,
0545 |                     &rank_of(adapters, meta.agent),
0546 |                     None,
```

### `crates/wake-core/src/db.rs:3088–3121`

```text
3088 |     tx.execute(
3089 |         "INSERT INTO sessions(key, agent_id, native_id, title, project_path, project_name,
3090 |            git_branch, created_at, updated_at, message_count, tokens_used, model, source,
3091 |            archived, file_path, file_size, file_mtime, unknown_lines, host)
3092 |          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,0,?18)
3093 |          ON CONFLICT(key) DO UPDATE SET
3094 |            title=excluded.title, project_path=excluded.project_path,
3095 |            project_name=excluded.project_name, git_branch=excluded.git_branch,
3096 |            created_at=excluded.created_at, updated_at=excluded.updated_at,
3097 |            message_count=excluded.message_count, tokens_used=excluded.tokens_used,
3098 |            model=excluded.model, source=excluded.source, archived=excluded.archived,
3099 |            file_path=excluded.file_path, file_size=excluded.file_size,
3100 |            file_mtime=excluded.file_mtime, host=excluded.host",
3101 |         params![
3102 |             m.key,
3103 |             m.agent.as_str(),
3104 |             m.id,
3105 |             m.title,
3106 |             m.project_path,
3107 |             m.project_name,
3108 |             m.git_branch,
3109 |             m.created_at,
3110 |             m.updated_at,
3111 |             m.message_count,
3112 |             m.tokens_used,
3113 |             m.model,
3114 |             m.source,
3115 |             m.archived as i64,
3116 |             m.file_path,
3117 |             m.size_bytes,
3118 |             file_mtime,
3119 |             m.host,
3120 |         ],
3121 |     )?;
```

## WK06 工具结果不等于成功状态

### `crates/wake-core/src/adapters/codex.rs:651–721`

```text
0651 |                     "function_call" | "custom_tool_call" | "local_shell_call" => {
0652 |                         let call_id = payload
0653 |                             .get("call_id")
0654 |                             .or_else(|| payload.get("id"))
0655 |                             .and_then(|v| v.as_str())
0656 |                             .unwrap_or("")
0657 |                             .to_string();
0658 |                         let name = payload
0659 |                             .get("name")
0660 |                             .and_then(|v| v.as_str())
0661 |                             .unwrap_or("exec")
0662 |                             .to_string();
0663 |                         let raw_input = payload
0664 |                             .get("arguments")
0665 |                             .and_then(|v| v.as_str())
0666 |                             .or_else(|| payload.get("input").and_then(|v| v.as_str()))
0667 |                             .map(String::from)
0668 |                             .unwrap_or_else(|| {
0669 |                                 payload
0670 |                                     .get("action")
0671 |                                     .map(|a| serde_json::to_string(a).unwrap_or_default())
0672 |                                     .unwrap_or_default()
0673 |                             });
0674 |                         let preview_source: Value = serde_json::from_str(&raw_input)
0675 |                             .unwrap_or(Value::String(raw_input.clone()));
0676 |                         let call = ToolCallView {
0677 |                             id: call_id.clone(),
0678 |                             name,
0679 |                             input_preview: make_preview(&preview_source),
0680 |                             input: if raw_input.is_empty() {
0681 |                                 None
0682 |                             } else {
0683 |                                 Some(clip(&raw_input, MAX_TOOL_IO).0)
0684 |                             },
0685 |                             output: None,
0686 |                             is_error: false,
0687 |                             sidechain_ref: None,
0688 |                         };
0689 |                         // 末条消息落在 fork 段里(下标 < cut)时必须另起宿主:
0690 |                         // collapse_inherited 会把那段整段 splice 掉,挂上去的
0691 |                         // 工具调用与其输出会跟着消失
0692 |                         let last_is_inherited =
0693 |                             inherited.is_some_and(|(cut, _)| messages.len() <= cut);
0694 |                         let need_host = last_is_inherited
0695 |                             || !matches!(
0696 |                                 messages.last(),
0697 |                                 Some(m) if m.role == Role::Assistant && m.kind == MessageKind::Text
0698 |                             );
0699 |                         if need_host {
0700 |                             messages.push(mk_msg(Role::Assistant, MessageKind::Text, "", ts));
0701 |                         }
0702 |                         let mi = messages.len() - 1;
0703 |                         let host = &mut messages[mi];
0704 |                         host.tool_calls.push(call);
0705 |                         if !call_id.is_empty() {
0706 |                             tool_index.insert(call_id, (mi, host.tool_calls.len() - 1));
0707 |                         }
0708 |                     }
0709 |                     "function_call_output" | "custom_tool_call_output" => {
0710 |                         let call_id = payload
0711 |                             .get("call_id")
0712 |                             .and_then(|v| v.as_str())
0713 |                             .unwrap_or("");
0714 |                         if let Some(&(mi, ti)) = tool_index.get(call_id) {
0715 |                             let output = payload.get("output").unwrap_or(&Value::Null);
0716 |                             let content = output.get("content").unwrap_or(output);
0717 |                             let parsed = tool_result_parts(content, decode_images);
0718 |                             let message = &mut messages[mi];
0719 |                             message.tool_calls[ti].output = Some(clip(&parsed.text, MAX_TOOL_IO).0);
0720 |                             append_images_to_message_end(message, parsed.images);
0721 |                         }
```

## WK07 全文索引覆盖与查询分路

### `crates/wake-core/src/adapters/mod.rs:499–524`

```text
0499 | fn units_from_messages(messages: &[TranscriptMessage]) -> Vec<IndexUnit> {
0500 |     messages
0501 |         .iter()
0502 |         .filter(|m| m.kind == MessageKind::Text)
0503 |         .filter_map(|m| {
0504 |             let mut parts = vec![m.text.clone()];
0505 |             for tc in &m.tool_calls {
0506 |                 if wake_lookup_kind(tc).is_some() {
0507 |                     continue;
0508 |                 }
0509 |                 parts.push(format!("{} {}", tc.name, tc.input_preview));
0510 |             }
0511 |             let text = parse_utils::clip(&parts.join("\n"), MAX_MSG_TEXT).0;
0512 |             if text.trim().is_empty() {
0513 |                 None
0514 |             } else {
0515 |                 Some(IndexUnit {
0516 |                     seq: m.seq,
0517 |                     sidechain_id: None,
0518 |                     role: m.role,
0519 |                     timestamp: m.timestamp,
0520 |                     text,
0521 |                 })
0522 |             }
0523 |         })
0524 |         .collect()
```

### `crates/wake-core/src/db.rs:26–96`

```text
0026 | const DDL: &str = r#"
0027 | CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT);
0028 | 
0029 | CREATE TABLE IF NOT EXISTS sessions (
0030 |   key            TEXT PRIMARY KEY,
0031 |   agent_id       TEXT NOT NULL,
0032 |   native_id      TEXT NOT NULL,
0033 |   title          TEXT NOT NULL DEFAULT '',
0034 |   project_path   TEXT NOT NULL DEFAULT '',
0035 |   project_name   TEXT NOT NULL DEFAULT '',
0036 |   git_branch     TEXT,
0037 |   created_at     INTEGER DEFAULT 0,
0038 |   updated_at     INTEGER DEFAULT 0,
0039 |   message_count  INTEGER DEFAULT 0,
0040 |   tokens_used    INTEGER,
0041 |   model          TEXT,
0042 |   source         TEXT,
0043 |   archived       INTEGER DEFAULT 0,
0044 |   file_path      TEXT NOT NULL UNIQUE,
0045 |   file_size      INTEGER DEFAULT 0,
0046 |   file_mtime     INTEGER DEFAULT 0,
0047 |   unknown_lines  INTEGER DEFAULT 0,
0048 |   parent_key     TEXT NOT NULL DEFAULT '',
0049 |   host           TEXT NOT NULL DEFAULT ''
0050 | );
0051 | CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
0052 | CREATE INDEX IF NOT EXISTS idx_sessions_agent   ON sessions(agent_id, updated_at DESC);
0053 | CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path, updated_at DESC);
0054 | 
0055 | CREATE TABLE IF NOT EXISTS messages (
0056 |   id           INTEGER PRIMARY KEY,
0057 |   session_key  TEXT NOT NULL,
0058 |   sidechain_id TEXT,
0059 |   seq          INTEGER NOT NULL,
0060 |   role         TEXT, ts INTEGER,
0061 |   text         TEXT NOT NULL
0062 | );
0063 | CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_key);
0064 | 
0065 | CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
0066 |   text,
0067 |   content='messages', content_rowid='id',
0068 |   tokenize="trigram case_sensitive 0"
0069 | );
0070 | 
0071 | CREATE TABLE IF NOT EXISTS user_data (
0072 |   session_key TEXT PRIMARY KEY,
0073 |   favorite    INTEGER DEFAULT 0,
0074 |   pinned      INTEGER DEFAULT 0,
0075 |   updated_at  INTEGER
0076 | );
0077 | 
0078 | CREATE TABLE IF NOT EXISTS tombstones (
0079 |   file_path  TEXT PRIMARY KEY,
0080 |   key        TEXT,
0081 |   deleted_at INTEGER
0082 | );
0083 | 
0084 | CREATE TABLE IF NOT EXISTS custom_roots (
0085 |   agent    TEXT NOT NULL,
0086 |   path     TEXT NOT NULL,
0087 |   added_at INTEGER,
0088 |   PRIMARY KEY (agent, path)
0089 | );
0090 | 
0091 | CREATE TABLE IF NOT EXISTS removed_defaults (
0092 |   agent      TEXT PRIMARY KEY,
0093 |   removed_at INTEGER
0094 | );
0095 | 
0096 | CREATE TABLE IF NOT EXISTS removed_default_roots (
```

### `crates/wake-core/src/db.rs:3125–3177`

```text
3125 | fn escape_like(s: &str) -> String {
3126 |     s.replace('\\', "\\\\")
3127 |         .replace('%', "\\%")
3128 |         .replace('_', "\\_")
3129 | }
3130 | 
3131 | /// 搜索串按空白切成词项(会话搜索与记忆搜索同一套分词)
3132 | fn fts_terms(q: &str) -> Vec<&str> {
3133 |     q.split_whitespace().filter(|s| !s.is_empty()).collect()
3134 | }
3135 | 
3136 | /// 有词项短于 3 码点就走 LIKE 子串扫描——trigram 分词对更短的词无能为力
3137 | fn needs_like_fallback(segs: &[&str]) -> bool {
3138 |     segs.iter().any(|s| s.chars().count() < 3)
3139 | }
3140 | 
3141 | /// FTS5 的 MATCH 表达式:每个词项加引号(内部引号翻倍)、AND 连接。三张 FTS 表共用,
3142 | /// 转义规则只此一处
3143 | fn fts_match_expr(segs: &[&str]) -> String {
3144 |     segs.iter()
3145 |         .map(|s| format!("\"{}\"", s.replace('"', "\"\"")))
3146 |         .collect::<Vec<_>>()
3147 |         .join(" AND ")
3148 | }
3149 | 
3150 | /// LIKE 降级路径的 WHERE:每个词项对每一列各一个 `LIKE ? ESCAPE '\'`(列之间 OR、
3151 | /// 词项之间 AND),参数由 `like_args` 按同一顺序给。正文、标题、记忆三条降级路径共用
3152 | fn like_where(cols: &[&str], terms: usize) -> String {
3153 |     let per_term = cols
3154 |         .iter()
3155 |         .map(|c| format!("{c} LIKE ? ESCAPE '\\'"))
3156 |         .collect::<Vec<_>>()
3157 |         .join(" OR ");
3158 |     let per_term = if cols.len() > 1 {
3159 |         format!("({per_term})")
3160 |     } else {
3161 |         per_term
3162 |     };
3163 |     std::iter::repeat_n(per_term, terms)
3164 |         .collect::<Vec<_>>()
3165 |         .join(" AND ")
3166 | }
3167 | 
3168 | /// `like_where` 的参数:每个词项转义成 `%term%`,每列一份
3169 | fn like_args(segs: &[&str], cols: usize) -> Vec<Box<dyn rusqlite::ToSql>> {
3170 |     segs.iter()
3171 |         .flat_map(|s| {
3172 |             let pat = format!("%{}%", escape_like(s));
3173 |             std::iter::repeat_n(pat, cols)
3174 |         })
3175 |         .map(|pat| Box::new(pat) as Box<dyn rusqlite::ToSql>)
3176 |         .collect()
3177 | }
```

## WK08 新鲜度与无界面刷新

### `crates/wake-core/src/db.rs:693–700`

```text
0693 |     /// 索引覆盖到的最新会话活动时间(epoch ms;空库 None)。wake-mcp 把它随
0694 |     /// 每次工具返回带给 agent,让对方知道索引有多新——GUI 没跑时 watcher 不在,
0695 |     /// 搜索/列表只反映到这个时刻(读会话是现场解析,不受影响)
0696 |     pub fn latest_activity(&self) -> Result<Option<i64>> {
0697 |         let conn = self.read.lock().unwrap();
0698 |         let latest: Option<i64> =
0699 |             conn.query_row("SELECT MAX(updated_at) FROM sessions", [], |r| r.get(0))?;
0700 |         Ok(latest.filter(|t| *t > 0))
```

### `crates/wake-core/src/mcp/tools.rs:466–474`

```text
0466 | fn index_note(store: &Store) -> String {
0467 |     match store.latest_activity() {
0468 |         Ok(Some(t)) => format!(
0469 |             "Index covers activity up to {} (local time); Wake keeps it fresh while it is running.",
0470 |             fmt_time(Some(t))
0471 |         ),
0472 |         Ok(None) => "The index is empty — launch Wake to build it.".to_string(),
0473 |         Err(e) => format!("Index freshness unknown: {e:#}"),
0474 |     }
```

### `crates/wake-core/src/bin/wake_cli.rs:70–114`

```text
0070 | /// db 路径只在真要用库时求值:`path_or_default` 落到 default_db_path 时有副
0071 | /// 作用(首次会把旧 vibex 库拷过来),--help / --version 不该碰用户的文件系统
0072 | fn db_path(db: &Option<PathBuf>) -> PathBuf {
0073 |     db::path_or_default(db.as_deref())
0074 | }
0075 | 
0076 | fn run(db: &Option<PathBuf>, tool: &str, args: &serde_json::Value) -> ExitCode {
0077 |     // 只读打开 + 按库配置建 roster,与 wake-mcp 同一条(不变量 8⑥);库不存在
0078 |     // 或太老由 open_read_only 给出 "launch Wake once"
0079 |     let (store, adapters) = match mcp::open_index(&db_path(db)) {
0080 |         Ok(x) => x,
0081 |         Err(e) => return write(refuse(e)),
0082 |     };
0083 |     let cache = tools::TranscriptCache::default();
0084 |     write(cli::report(tools::invoke(
0085 |         &store, &adapters, &cache, tool, args,
0086 |     )))
0087 | }
0088 | 
0089 | /// 建一次索引,然后说一句人话。建不建、凭什么敢建全在 `scanner::build_index`,
0090 | /// 这里只剩措辞。场景是"装了 Wake 但从没启动过":skill 让 agent 跑这一条自救
0091 | fn index(path: &Path) -> Report {
0092 |     match scanner::build_index(path, progress_events()) {
0093 |         Ok(Outcome::Done(tally)) => cli::report(Ok(format!(
0094 |             "Indexed {tally} into {}.\n\
0095 |              Launch Wake to keep it current — it watches the agents' files while it runs. \
0096 |              With the app closed, `wake-cli refresh` brings the index up to date.",
0097 |             path.display()
0098 |         ))),
0099 |         Ok(Outcome::Skipped(skip)) => skipped(path, skip),
0100 |         Ok(Outcome::Busy(holder)) => cli::report(Ok(busy_text(&holder))),
0101 |         Err(e) => cli::report(Err(e.into())),
0102 |     }
0103 | }
0104 | 
0105 | /// 增量刷一轮已有的索引,然后说一句人话。刷不刷、凭什么敢刷全在 `scanner::refresh_index`
0106 | fn refresh(path: &Path) -> Report {
0107 |     match scanner::refresh_index(path, progress_events()) {
0108 |         Ok(Outcome::Done(tally)) => cli::report(Ok(format!(
0109 |             "Refreshed the index at {}: {tally}.",
0110 |             path.display()
0111 |         ))),
0112 |         Ok(Outcome::Skipped(skip)) => skipped(path, skip),
0113 |         Ok(Outcome::Busy(holder)) => cli::report(Ok(busy_text(&holder))),
0114 |         Err(e) => cli::report(Err(e.into())),
```

## WK09 扫描写者与副本裁决

### `crates/wake-core/src/db.rs:373–388`

```text
0373 | /// 索引库的**跨进程**写者锁。`scanner::SCAN_GATE` 只管一个进程里的两条扫描串行,
0374 | /// 这把锁管进程之间:GUI 与 `wake-cli refresh` / `wake-cli index` / scan bin 都是写者,
0375 | /// 同一时刻只能有一个——两个进程各建一份 roster,launchd 与 Dock 起的 GUI 看到的 env
0376 | /// 未必相同(CODEX_HOME / XDG_DATA_HOME / WAKE_HOME 各解各的根),删除检测会把对方收进来
0377 | /// 的会话当"磁盘已删"清掉、下一轮再由对方加回,每十分钟互删一次;靠 busy_timeout 排队
0378 | /// 解决不了这个,只能不并发。
0379 | ///
0380 | /// 形态:`<db>.lock` 旁路文件上的文件锁(unix flock / Windows LockFileEx,std 的
0381 | /// `File::try_lock`),路径按库的**真实路径**派生——`--db` 给到符号链接别名也得撞上同一把。
0382 | /// **GUI 另持一把 `<db>.lock.app`**:别人拿不到主锁时探这把锁,拿不到就是有个活着的 GUI——
0383 | /// 锁随进程生死,不会残留,"持有者是不是 GUI"这条决定 GUI 等不等、CLI 怎么措辞的判据
0384 | /// 只认它。持有者自述(`"wake-cli refresh 4242"`)另写在 `<db>.lock.holder`,**只用来点名**:
0385 | /// 它写在拿到锁之后,拿到与写完之间读到的是上一任的残留,拿它做判断就会把新起的 GUI 误
0386 | /// 劝退;也不写进锁文件——Windows 的文件锁是强制锁,别的句柄读不到被锁的内容(三条都是
0387 | /// 2026-09-23 Codex review)。
0388 | /// **谁写库谁持有,且持有期必须盖住读写 `Store` 的整个生命期**:GUI 从启动持到退出
```

### `crates/wake-core/src/scanner.rs:139–199`

```text
0139 | pub fn build_index(path: &Path, events: &dyn ScanEvents) -> Result<Outcome> {
0140 |     if path.exists() {
0141 |         return Ok(Outcome::Skipped(Skip::Exists));
0142 |     }
0143 |     let _lock = match IndexLock::try_acquire(path, "wake-cli index")? {
0144 |         Ownership::Ours(lock) => lock,
0145 |         Ownership::Held(holder) => return Ok(Outcome::Busy(holder)),
0146 |     };
0147 |     // 锁外那一眼可能过时:GUI 刚建完库又退出了
0148 |     if path.exists() {
0149 |         return Ok(Outcome::Skipped(Skip::Exists));
0150 |     }
0151 |     let staging = Staging::new(path);
0152 |     let tally = {
0153 |         let store = Arc::new(Store::open(&staging.0)?);
0154 |         scan_with(&store, events, true)?
0155 |     }; // 关掉最后一个连接即 checkpoint,-wal/-shm 消失,临时库自成一体
0156 |     match std::fs::hard_link(&staging.0, path) {
0157 |         Ok(()) => {}
0158 |         // 有人抢先了(不认锁的老版本 GUI 首扫)。他的库归他,退让
0159 |         Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
0160 |             return Ok(Outcome::Skipped(Skip::Exists))
0161 |         }
0162 |         // 个别文件系统不给硬链接:退回 rename,但只在目标确实还空着时
0163 |         Err(_) if !path.exists() => std::fs::rename(&staging.0, path)?,
0164 |         Err(_) => return Ok(Outcome::Skipped(Skip::Exists)),
0165 |     }
0166 |     for suffix in ["-wal", "-shm"] {
0167 |         let _ = std::fs::remove_file(format!("{}{suffix}", path.display()));
0168 |     }
0169 |     Ok(Outcome::Done(tally))
0170 | }
0171 | 
0172 | /// 增量刷新一份**已有**的索引(`wake-cli refresh`):给"app 不开、靠 MCP / CLI 用 Wake"
0173 | /// 的人用 launch agent / systemd timer 定时跑(issue #43)。做的正是 GUI 启动与 ⌘R
0174 | /// 那一轮——增量 `run_scan`,收尾同步记忆,升级后的 FTS 回填旗子照常生效——只少远程
0175 | /// rsync(要 ssh,留给 GUI 的同步线程)。
0176 | ///
0177 | /// **只在 Wake 没运行时干活**:`IndexLock` 拿不到就 `Busy` 退让。GUI 开着时它的 watcher
0178 | /// 本来就在保鲜,再跑一轮不只是多余——两个进程各建一份 roster,看到的 env 未必相同,
0179 | /// 删除检测会互删对方收进来的会话(理由在 `IndexLock` 的注释),锁把这类并发整个排除。
0180 | /// `Store::open` 会顺手迁移 schema,与 GUI 首开同一条路:刷新的目的就是让库跟上二进制;
0181 | /// 反过来(库比二进制新)认不出来,docs 让定时任务指向 app 包内那份 wake-cli
0182 | pub fn refresh_index(path: &Path, events: &dyn ScanEvents) -> Result<Outcome> {
0183 |     if !path.is_file() {
0184 |         return Ok(Outcome::Skipped(Skip::Missing));
0185 |     }
0186 |     // 开写之前先只读认一眼:`--db` 指错到别家 SQLite 时 `Store::open` 会改它的 journal_mode、
0187 |     // 建 Wake 的表,而别家数据只读是铁律(Codex review 2026-09-23)
0188 |     if !crate::db::is_wake_index(path) {
0189 |         return Ok(Outcome::Skipped(Skip::NotAnIndex));
0190 |     }
0191 |     let _lock = match IndexLock::try_acquire(path, "wake-cli refresh")? {
0192 |         Ownership::Ours(lock) => lock,
0193 |         Ownership::Held(holder) => return Ok(Outcome::Busy(holder)),
0194 |     };
0195 |     let store = Arc::new(Store::open(path)?);
0196 |     if mirrors_elsewhere(&store)? {
0197 |         return Ok(Outcome::Skipped(Skip::MirrorsElsewhere));
0198 |     }
0199 |     Ok(Outcome::Done(scan_with(&store, events, false)?))
```

### `crates/wake-core/src/scanner.rs:523–565`

```text
0523 |         match item.adapter.parse_session(&item.r) {
0524 |             Ok(parsed) => {
0525 |                 // quick/parsed 合并策略属各 adapter(默认 parsed 为准 quick 补缺,
0526 |                 // Codex 覆写 title/key 优先级),scanner 不再内嵌任何 agent 特例
0527 |                 let meta = match &item.quick {
0528 |                     Some(q) => item.adapter.merge_quick_meta(parsed.meta, q),
0529 |                     None => parsed.meta,
0530 |                 };
0531 |                 // 合并可能改写 key(codex 的 state thread-id):改名后的 key
0532 |                 // 也要受墓碑约束,否则改名副本绕过上面的枚举过滤
0533 |                 if store.is_key_tombstoned(&meta.key) {
0534 |                     progress.done += 1;
0535 |                     continue;
0536 |                 }
0537 |                 // 全量写入也走事务内副本裁决:扫描快照里的旧副本不得覆盖
0538 |                 // watcher 并发间隙写入的更新副本(启动扫描与手动刷新期间
0539 |                 // watcher 都活着,2026-08-24 Codex review P1)
0540 |                 match store.write_session_guarded(
0541 |                     &meta,
0542 |                     item.r.mtime_ms,
0543 |                     &parsed.units,
0544 |                     &parsed.wake_lookups,
0545 |                     &rank_of(adapters, meta.agent),
0546 |                     None,
0547 |                 ) {
0548 |                     Ok(written) => item_written = written,
0549 |                     Err(e) => eprintln!("[scanner] write failed {}: {e}", item.r.file_path),
0550 |                 }
0551 |             }
0552 |             Err(e) => {
0553 |                 eprintln!("[scanner] parse failed {}: {e}", item.r.file_path);
0554 |                 // 胜者副本坏了不等于会话消失:按裁决顺位回退到下一份有效副本。
0555 |                 // 回退实例自己的 quick 合并不能省——codex 的 state key(thread id)
0556 |                 // 可与文件 native id 不同,绕过 merge 会丢手工标题、还可能留下
0557 |                 // 双 key 两行(2026-08-24 Codex review)
0558 |                 for (fb_ix, fb) in &item.fallbacks {
0559 |                     let fb_adapter = &adapters[*fb_ix];
0560 |                     match fb_adapter.parse_session(fb) {
0561 |                         Ok(parsed) => {
0562 |                             let quick = fb_adapter.quick_meta(std::slice::from_ref(fb));
0563 |                             let meta = match quick.as_ref().and_then(|m| m.get(&fb.file_path)) {
0564 |                                 Some(q) => fb_adapter.merge_quick_meta(parsed.meta, q),
0565 |                                 None => parsed.meta,
```

## WK10 读取面的过滤不是任务 ACL

### `crates/wake-core/src/mcp/tools.rs:93–129`

```text
0093 | pub const SEARCH: &str = "wake_search";
0094 | pub const LIST_SESSIONS: &str = "wake_list_sessions";
0095 | pub const GET_SESSION: &str = "wake_get_session";
0096 | pub const LIST_PROJECTS: &str = "wake_list_projects";
0097 | pub const LIST_MEMORIES: &str = "wake_list_memories";
0098 | /// 工具名的清单:自指回声过滤与 wake_lookups 记账(`adapters::wake_lookup_kind`)与
0099 | /// definitions 的稳定性测试都读它,加一家改这里与 `definitions()` 两处即可
0100 | pub const NAMES: [&str; 5] = [
0101 |     SEARCH,
0102 |     LIST_SESSIONS,
0103 |     GET_SESSION,
0104 |     LIST_PROJECTS,
0105 |     LIST_MEMORIES,
0106 | ];
0107 | 
0108 | const MAX_SEARCH_SESSIONS: i64 = 30;
0109 | const MAX_LIST_SESSIONS: i64 = 100;
0110 | const MAX_LIST_MEMORIES: i64 = 100;
0111 | /// wake_search 末尾附带的记忆命中数
0112 | const MEMORY_HITS_IN_SEARCH: i64 = 5;
0113 | const MAX_LIST_PROJECTS: i64 = 200;
0114 | const SNIPPETS_PER_SESSION: usize = 3;
0115 | 
0116 | fn read_only_annotations() -> Value {
0117 |     json!({
0118 |         "readOnlyHint": true,
0119 |         "destructiveHint": false,
0120 |         "idempotentHint": true,
0121 |         "openWorldHint": false,
0122 |     })
0123 | }
0124 | 
0125 | fn project_param() -> Value {
0126 |     json!({
0127 |         "type": "string",
0128 |         "description": "Scope to one project. Pass an absolute path — your current working directory is ideal: Wake matches the enclosing indexed project, or every project below a parent directory — or a project name. Omit to cover all projects.",
0129 |     })
```

### `crates/wake-core/src/mcp/tools.rs:407–450`

```text
0407 | fn project_arg(ctx: &ToolContext, args: &Value) -> Result<ProjectScope, ToolError> {
0408 |     let Some(arg) = text_arg(args, "project")? else {
0409 |         return Ok(ProjectScope::All);
0410 |     };
0411 |     // 含归档:搜索覆盖归档会话,只剩归档会话的项目不能在这一步被挡掉
0412 |     let projects = ctx.store.list_projects(true)?;
0413 |     let paths = resolve_project_paths(arg, &projects);
0414 |     if !paths.is_empty() {
0415 |         return Ok(ProjectScope::Paths(paths));
0416 |     }
0417 |     let mut text = format!("No indexed project matches `{arg}`.\n\n");
0418 |     if projects.is_empty() {
0419 |         text.push_str("The index has no projects yet.");
0420 |     } else {
0421 |         text.push_str("Known projects (most recently active first):\n");
0422 |         for p in projects.iter().filter(|p| !p.path.is_empty()).take(15) {
0423 |             text.push_str(&format!(
0424 |                 "- {} — {} · {} session{}\n",
0425 |                 p.path,
0426 |                 p.name,
0427 |                 p.session_count,
0428 |                 plural(p.session_count)
0429 |             ));
0430 |         }
0431 |         text.push_str("\nPass one of these paths (or the project name), or omit `project` to cover everything.");
0432 |     }
0433 |     Ok(ProjectScope::NoMatch(text))
0434 | }
0435 | 
0436 | /// 记忆面的 project 解包:没匹配上索引里的项目**不早退**——用户级记忆对每个项目都
0437 | /// 成立,筛选串按原样传下去(项目级本来就一份都不会匹配、用户级照列),提示文本
0438 | /// 另外带回给调用方决定怎么说
0439 | fn memory_project_scope(
0440 |     ctx: &ToolContext,
0441 |     args: &Value,
0442 | ) -> Result<(Option<Vec<String>>, Option<String>), ToolError> {
0443 |     Ok(match project_arg(ctx, args)? {
0444 |         ProjectScope::All => (None, None),
0445 |         ProjectScope::Paths(p) => (Some(p), None),
0446 |         ProjectScope::NoMatch(text) => {
0447 |             let arg = text_arg(args, "project")?.unwrap_or_default().to_string();
0448 |             (Some(vec![arg]), Some(text))
0449 |         }
0450 |     })
```

### `crates/wake-core/src/services/context.rs:8–56`

```text
0008 | /// 把 agent 给的 project 参数解析成索引里的项目路径集合(交给
0009 | /// `SessionFilter::project_paths` / `SearchFilter::project_paths`)。
0010 | ///
0011 | /// 绝对路径三级:①完全相等;②该路径是某项目路径的后代(agent 的 cwd 在
0012 | /// 子目录里)→ 取最长的那个祖先;③项目路径是该路径的后代(monorepo 根、或
0013 | /// `~/Github` 这类上层目录)→ 并集。边界判定用 `path_owns`,`wake-old` 不算
0014 | /// `wake` 的后代。非绝对路径按项目名匹配(大小写不敏感;`project_name` 就是
0015 | /// 各 adapter 经 `project_name_of` 取的路径尾段,不必再自己切一遍)。
0016 | /// 返回空 = 没匹配上,调用方据此报"未知项目",**不要退化成不过滤**。
0017 | pub fn resolve_project_paths(arg: &str, projects: &[ProjectInfo]) -> Vec<String> {
0018 |     let arg = crate::adapters::expand_tilde(arg.trim());
0019 |     let wanted = strip_trailing_sep(&arg);
0020 |     if wanted.is_empty() {
0021 |         return Vec::new();
0022 |     }
0023 |     if looks_like_path(wanted) {
0024 |         if let Some(p) = projects
0025 |             .iter()
0026 |             .find(|p| strip_trailing_sep(&p.path) == wanted)
0027 |         {
0028 |             return vec![p.path.clone()];
0029 |         }
0030 |         let mut best: Option<&ProjectInfo> = None;
0031 |         for p in projects.iter().filter(|p| !p.path.is_empty()) {
0032 |             if path_owns(&p.path, wanted) && best.is_none_or(|b| p.path.len() > b.path.len()) {
0033 |                 best = Some(p);
0034 |             }
0035 |         }
0036 |         if let Some(b) = best {
0037 |             return vec![b.path.clone()];
0038 |         }
0039 |         let mut inside: Vec<String> = projects
0040 |             .iter()
0041 |             .filter(|p| !p.path.is_empty() && path_owns(wanted, &p.path))
0042 |             .map(|p| p.path.clone())
0043 |             .collect();
0044 |         inside.sort();
0045 |         inside.dedup();
0046 |         return inside;
0047 |     }
0048 |     let lower = wanted.to_lowercase();
0049 |     let mut matched: Vec<String> = projects
0050 |         .iter()
0051 |         .filter(|p| !p.path.is_empty() && p.name.to_lowercase() == lower)
0052 |         .map(|p| p.path.clone())
0053 |         .collect();
0054 |     matched.sort();
0055 |     matched.dedup();
0056 |     matched
```

### `crates/wake-core/src/mcp/tools.rs:989–1008`

```text
0989 | fn find_session(store: &Store, key: &str) -> Result<Result<SessionMeta, String>, ToolError> {
0990 |     if let Some(meta) = store.get_session(key)? {
0991 |         return Ok(Ok(meta));
0992 |     }
0993 |     // 兜底:对方只拿到原生 id(resume 用的那个),按列反查;同 UUID 跨 host 会多于一条
0994 |     let candidates = store.find_by_native_id(key)?;
0995 |     Ok(match candidates.as_slice() {
0996 |         [one] => Ok(one.clone()),
0997 |         [] => Err(format!(
0998 |             "No session with key `{key}`. Keys look like `claude-code:<id>` (or `<agent>:<host>:<id>` for remote hosts); get one from wake_search or wake_list_sessions."
0999 |         )),
1000 |         many => Err(format!(
1001 |             "`{key}` is ambiguous — {} sessions share that id:\n{}",
1002 |             many.len(),
1003 |             many.iter()
1004 |                 .map(|s| format!("- `{}` ({}{})", s.key, s.agent.display_name(), if s.host.is_empty() { String::new() } else { format!(" @{}", s.host) }))
1005 |                 .collect::<Vec<_>>()
1006 |                 .join("\n")
1007 |         )),
1008 |     })
```

### `crates/wake-core/src/mcp/tools.rs:1111–1145`

```text
1111 | fn get_session(ctx: &ToolContext, args: &Value) -> ToolResult {
1112 |     let raw_key = text_arg(args, "key")?
1113 |         .ok_or_else(|| ToolError::InvalidParams("`key` is required".into()))?;
1114 |     // 记忆引用走另一条读法;不另开工具,agent 拿到什么引用都交给同一个入口
1115 |     let (key, ref_seq) = match WakeRef::parse(raw_key) {
1116 |         WakeRef::Memory { key } => return get_memory(ctx, &key, args),
1117 |         WakeRef::Session { key, seq } => (key, seq),
1118 |     };
1119 |     let from_seq = int_arg(args, "from_seq", ref_seq.unwrap_or(0), 0, i64::MAX)?;
1120 |     let opts = CompactOptions {
1121 |         from_seq,
1122 |         max_messages: int_arg(args, "max_messages", 60, 1, 200)? as usize,
1123 |         max_chars: int_arg(args, "max_chars", 20_000, 200, 100_000)? as usize,
1124 |         max_message_chars: int_arg(args, "max_message_chars", 4_000, 100, 50_000)? as usize,
1125 |         include_tools: bool_arg(args, "include_tools", false)?,
1126 |         include_thinking: bool_arg(args, "include_thinking", false)?,
1127 |     };
1128 |     let subagent = text_arg(args, "subagent")?;
1129 |     let meta = match find_session(ctx.store, &key)? {
1130 |         Ok(m) => m,
1131 |         Err(text) => return Err(ToolError::Failed(text)),
1132 |     };
1133 |     let adapter = adapter_for(ctx.adapters, meta.agent, &meta.file_path).ok_or_else(|| {
1134 |         ToolError::Failed(format!(
1135 |             "No adapter can read `{}` ({}) — its data location may be disabled in Wake's settings.",
1136 |             meta.key,
1137 |             meta.agent.display_name()
1138 |         ))
1139 |     })?;
1140 |     let transcript = ctx.cache.get_or_parse(adapter, &meta).map_err(|e| {
1141 |         ToolError::Failed(format!(
1142 |             "Could not read the transcript of `{}` from {}: {e:#}",
1143 |             meta.key, meta.file_path
1144 |         ))
1145 |     })?;
```

## WK11 搜索索引与现场读取不是同一快照

### `crates/wake-core/src/mcp/tools.rs:25–75`

```text
0025 | }
0026 | 
0027 | /// 单槽转录缓存:分页读同一会话时不必每页整文件重解析(默认 20k 字符一页,
0028 | /// 大会话几十页)。源文件或索引中的项目归属变化即失效;server 进程随客户端
0029 | /// 会话长驻,连续翻页总是同一文件。项目归属可由边车更新,不必修改正文。
0030 | #[derive(Default)]
0031 | pub struct TranscriptCache(Mutex<Option<CachedTranscript>>);
0032 | 
0033 | struct CachedTranscript {
0034 |     path: String,
0035 |     mtime: i64,
0036 |     size: i64,
0037 |     indexed_project: String,
0038 |     transcript: Arc<ParsedTranscript>,
0039 | }
0040 | 
0041 | impl TranscriptCache {
0042 |     fn get_or_parse(
0043 |         &self,
0044 |         adapter: &dyn AgentAdapter,
0045 |         meta: &SessionMeta,
0046 |     ) -> anyhow::Result<Arc<ParsedTranscript>> {
0047 |         let r = SessionFileRef::from_meta(meta);
0048 |         // SQLite 型会话的 `<db>#<id>` 虚拟路径 stat 不到,from_meta 退回索引里的
0049 |         // 时间——源库变了、Wake 没重扫时键不会变。改用库文件与 -wal 的 mtime
0050 |         // 作戳(sqlite_ro 行缓存同款判据),源库一写就失效
0051 |         let stamp = if std::path::Path::new(&r.file_path).exists() {
0052 |             r.mtime_ms
0053 |         } else {
0054 |             let db = crate::adapters::sqlite_ro::strip_virtual_path(&r.file_path);
0055 |             crate::adapters::sqlite_ro::db_cache_stamp(std::path::Path::new(db))
0056 |         };
0057 |         if let Some(cached) = self.0.lock().unwrap().as_ref() {
0058 |             if cached.path == r.file_path
0059 |                 && cached.mtime == stamp
0060 |                 && cached.size == r.size
0061 |                 && cached.indexed_project == meta.project_path
0062 |             {
0063 |                 return Ok(cached.transcript.clone());
0064 |             }
0065 |         }
0066 |         let t = Arc::new(adapter.parse_transcript(&r)?);
0067 |         *self.0.lock().unwrap() = Some(CachedTranscript {
0068 |             path: r.file_path,
0069 |             mtime: stamp,
0070 |             size: r.size,
0071 |             indexed_project: meta.project_path.clone(),
0072 |             transcript: t.clone(),
0073 |         });
0074 |         Ok(t)
0075 |     }
```

### `crates/wake-core/src/mcp/tools.rs:1140–1158`

```text
1140 |     let transcript = ctx.cache.get_or_parse(adapter, &meta).map_err(|e| {
1141 |         ToolError::Failed(format!(
1142 |             "Could not read the transcript of `{}` from {}: {e:#}",
1143 |             meta.key, meta.file_path
1144 |         ))
1145 |     })?;
1146 |     let live = &transcript.meta;
1147 |     let title = if live.title.is_empty() {
1148 |         UNTITLED
1149 |     } else {
1150 |         &live.title
1151 |     };
1152 |     // 子代理转录按 id 现场解析,不进 TranscriptCache:子代理还在跑时它的文件独立于
1153 |     // 主文件增长,拿主文件的戳当键会一直吐旧内容;文件通常远小于主线,一页一解析。
1154 |     // 先读文件、再查缓存里的清单:清单来自缓存的主转录,主文件没变时看不见刚出现的
1155 |     // 子代理(Codex review 2026-09-14),读得到就算存在,边车信息缺就只报 id
1156 |     let sidechain = match subagent {
1157 |         None => None,
1158 |         Some("*") => return Ok(subagent_listing(title, &meta, &transcript.sidechains)),
```

## WK12 导出和紧凑分页的保真边界

### `crates/wake-core/src/services/exporter.rs:108–154`

```text
0108 |     for m in messages {
0109 |         if m.kind == MessageKind::Meta {
0110 |             continue;
0111 |         }
0112 |         render_message(m, &mut out);
0113 |     }
0114 |     for (sc, msgs) in sidechains {
0115 |         if msgs.is_empty() {
0116 |             continue;
0117 |         }
0118 |         let label = sc.label();
0119 |         out.push_str(&format!(
0120 |             "---\n\n## ⑂ Subagent: {}\n\n",
0121 |             if label.is_empty() { &sc.id } else { &label }
0122 |         ));
0123 |         for m in msgs {
0124 |             if m.kind == MessageKind::Meta {
0125 |                 continue;
0126 |             }
0127 |             render_message(m, &mut out);
0128 |         }
0129 |     }
0130 |     out
0131 | }
0132 | 
0133 | pub fn to_json(
0134 |     meta: &SessionMeta,
0135 |     messages: &[TranscriptMessage],
0136 |     sidechains: &[(SidechainInfo, Vec<TranscriptMessage>)],
0137 | ) -> String {
0138 |     let sc_json: Vec<serde_json::Value> = sidechains
0139 |         .iter()
0140 |         .map(|(sc, msgs)| {
0141 |             serde_json::json!({
0142 |                 "id": sc.id, "agentType": sc.agent_type, "description": sc.description,
0143 |                 "messages": msgs,
0144 |             })
0145 |         })
0146 |         .collect();
0147 |     serde_json::to_string_pretty(&serde_json::json!({
0148 |         "exportedAt": chrono::Utc::now().to_rfc3339(),
0149 |         "exportedBy": "wake",
0150 |         "session": meta,
0151 |         "messages": messages,
0152 |         "sidechains": sc_json,
0153 |     }))
0154 |     .unwrap_or_default()
```

### `crates/wake-core/src/services/exporter.rs:245–287`

```text
0245 |     pub skipped_meta: usize,
0246 |     /// 本页首/末条消息的 seq(rendered = 0 时 None)
0247 |     pub seq_range: Option<(i64, i64)>,
0248 | }
0249 | 
0250 | /// 一条消息最多列出多少条工具调用(pi 系把一整轮助手回复合并成一条,里面可能
0251 | /// 有上百次调用);超出的只报条数
0252 | const MAX_TOOL_LINES: usize = 40;
0253 | 
0254 | /// 省 token 的转录渲染:只出 user/assistant 正文,工具调用折成一行,Meta(注入
0255 | /// 上下文)跳过并计数,CompactSummary 保留为引用块,图片略去;按 seq 分页。
0256 | /// `max_message_chars` 是**整条消息**的预算:正文、thinking、工具行与工具
0257 | /// 输入输出共用一份——分页对本页首条消息不查总量(保证前进),单条消息自身
0258 | /// 必须有界,否则一轮上百次工具调用能撑爆对方上下文
0259 | /// 与 `to_markdown`(全量导出)并存,seq 编号同源(`TranscriptMessage::seq`),
0260 | /// 搜索命中的 `wake://session/<key>#<seq>` 引用直接对得上这里的 `[seq N]`
0261 | pub fn render_compact(messages: &[TranscriptMessage], o: &CompactOptions) -> CompactPage {
0262 |     let mut text = String::new();
0263 |     let mut rendered = 0usize;
0264 |     let mut skipped_meta = 0usize;
0265 |     let mut chars = 0usize;
0266 |     let mut next_seq = None;
0267 |     let mut first_seq = None;
0268 |     let mut last_seq = None;
0269 |     for m in messages.iter().filter(|m| m.seq >= o.from_seq) {
0270 |         if m.kind == MessageKind::Meta {
0271 |             skipped_meta += 1;
0272 |             continue;
0273 |         }
0274 |         let block = compact_block(m, o);
0275 |         let block_chars = block.chars().count();
0276 |         if rendered > 0 && (rendered >= o.max_messages || chars + block_chars > o.max_chars) {
0277 |             next_seq = Some(m.seq);
0278 |             break;
0279 |         }
0280 |         text.push_str(&block);
0281 |         chars += block_chars;
0282 |         rendered += 1;
0283 |         first_seq.get_or_insert(m.seq);
0284 |         last_seq = Some(m.seq);
0285 |     }
0286 |     CompactPage {
0287 |         text,
```

### `crates/wake-core/src/services/exporter.rs:338–375`

```text
0338 |     for tc in &m.tool_calls {
0339 |         // input_preview 由 parse_utils::make_preview 生产,已折行并封顶 200 字符
0340 |         let status = if tc.is_error { " ✗" } else { "" };
0341 |         let line = format!("- 🔧 {}{status}: {}\n", tc.name, tc.input_preview);
0342 |         let line_chars = line.chars().count();
0343 |         // 首条工具行无论如何给出(读者要知道这条消息动过工具),之后按预算
0344 |         if shown >= MAX_TOOL_LINES || (shown > 0 && line_chars > budget) {
0345 |             break;
0346 |         }
0347 |         out.push_str(&line);
0348 |         budget = budget.saturating_sub(line_chars);
0349 |         shown += 1;
0350 |         if o.include_tools && budget > 0 {
0351 |             if let Some(input) = tc.input.as_deref().filter(|s| !s.trim().is_empty()) {
0352 |                 out.push_str(&format!(
0353 |                     "  input:\n  ```\n{}\n  ```\n",
0354 |                     indent(&spend(input, &mut budget))
0355 |                 ));
0356 |             }
0357 |             if let Some(output) = tc.output.as_deref().filter(|s| !s.trim().is_empty()) {
0358 |                 out.push_str(&format!(
0359 |                     "  output:\n  ```\n{}\n  ```\n",
0360 |                     indent(&spend(output, &mut budget))
0361 |                 ));
0362 |             }
0363 |         }
0364 |     }
0365 |     let hidden = m.tool_calls.len() - shown;
0366 |     if hidden > 0 {
0367 |         out.push_str(&format!(
0368 |             "- … {hidden} more tool call{} not shown\n",
0369 |             if hidden == 1 { "" } else { "s" }
0370 |         ));
0371 |     }
0372 |     if !m.tool_calls.is_empty() {
0373 |         out.push('\n');
0374 |     }
0375 |     out
```

## WK13 外部 SQLite 的只读复制回退

### `crates/wake-core/src/adapters/sqlite_ro.rs:19–59`

```text
0019 | /// 只读读取别家 SQLite,与 codex.rs 同一约定:readonly 直开(探测查询验证可用)
0020 | /// → copy 三件套到临时目录 → 放弃。绝不写、绝不 immutable=1(WAL 并发写下不安全)。
0021 | pub fn open_sqlite_ro(db: &Path, tag: &str) -> Option<SqliteRo> {
0022 |     if !db.is_file() {
0023 |         return None;
0024 |     }
0025 |     if let Ok(conn) = Connection::open_with_flags(db, OpenFlags::SQLITE_OPEN_READ_ONLY) {
0026 |         let probe: rusqlite::Result<i64> =
0027 |             conn.query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0));
0028 |         if probe.is_ok() {
0029 |             return Some(SqliteRo { conn, _tmp: None });
0030 |         }
0031 |     }
0032 |     // 目录名带库路径的哈希:同一 tag 的两个实例(Hermes 多档案、Codex 默认 + 自定义根、
0033 |     // 多 host 镜像)并发走到这里时不能共用一个目录,否则互相覆盖 db.sqlite、先退出的
0034 |     // 一方 remove_dir_all 把另一方的连接从脚下抽走(2026-09-22 review)
0035 |     let path_hash = {
0036 |         use std::hash::{Hash as _, Hasher as _};
0037 |         let mut h = std::collections::hash_map::DefaultHasher::new();
0038 |         db.hash(&mut h);
0039 |         h.finish()
0040 |     };
0041 |     let tmp = std::env::temp_dir().join(format!(
0042 |         "wake-{tag}-{}-{path_hash:016x}",
0043 |         std::process::id()
0044 |     ));
0045 |     fs::create_dir_all(&tmp).ok()?;
0046 |     let guard = TempDirGuard(tmp.clone());
0047 |     let db_copy = tmp.join("db.sqlite");
0048 |     fs::copy(db, &db_copy).ok()?;
0049 |     for suffix in ["-wal", "-shm"] {
0050 |         let src = PathBuf::from(format!("{}{suffix}", db.display()));
0051 |         if src.is_file() {
0052 |             let _ = fs::copy(&src, tmp.join(format!("db.sqlite{suffix}")));
0053 |         }
0054 |     }
0055 |     let conn = Connection::open_with_flags(&db_copy, OpenFlags::SQLITE_OPEN_READ_ONLY).ok()?;
0056 |     Some(SqliteRo {
0057 |         conn,
0058 |         _tmp: Some(guard),
0059 |     })
```

### `crates/wake-core/src/adapters/sqlite_ro.rs:62–71`

```text
0062 | /// 某张表现有的列名;表不存在或读不出给空集。逐版 ALTER 的别家库靠它做列级
0063 | /// 降级——缺列给默认值,老库不得整家消失(ZCode 按库 mtime 缓存探测结果;
0064 | /// Hermes 的 `HermesSchema` 是同一件事的 OnceLock 版)
0065 | pub fn table_columns(conn: &Connection, table: &str) -> HashSet<String> {
0066 |     let Ok(mut stmt) = conn.prepare(&format!("PRAGMA table_info({table})")) else {
0067 |         return HashSet::new();
0068 |     };
0069 |     stmt.query_map([], |r| r.get::<_, String>(1))
0070 |         .map(|rows| rows.flatten().collect())
0071 |         .unwrap_or_default()
```

### `crates/wake-core/src/adapters/sqlite_ro.rs:90–102`

```text
0090 | /// 行缓存的失效戳:主库与 `-wal` 的 mtime 取新者。WAL 库的新写入往往只落
0091 | /// `-wal`(写端尚未 checkpoint;远程 rsync 镜像更是永远没人 checkpoint 主库),
0092 | /// 只看主库 mtime 会让缓存抱着旧快照不放、新会话直到重启才出现。
0093 | pub fn db_cache_stamp(db: &Path) -> i64 {
0094 |     let stamp = |p: &Path| {
0095 |         std::fs::metadata(p)
0096 |             .map(|m| super::parse_utils::mtime_ms(&m))
0097 |             .unwrap_or(0)
0098 |     };
0099 |     let mut wal = db.as_os_str().to_owned();
0100 |     wal.push("-wal");
0101 |     stamp(db).max(stamp(Path::new(&wal)))
0102 | }
```

## WK14 重建索引与用户状态恢复边界

### `crates/wake-core/src/db.rs:342–370`

```text
0342 | /// 打开索引库;打不开就把它连同 WAL/SHM 一起挪到 `.corrupt` 旁路再建一个空的。
0343 | /// 索引本来就能从磁盘全量重扫恢复,重建的真实损失只有 user_data(收藏/置顶)
0344 | /// 与 location 配置——而它远好过 GUI 无提示秒退。
0345 | /// 返回的 `Some(_)` 是给用户看的说明文案。
0346 | pub fn open_or_rebuild(path: &Path) -> Result<(Store, Option<String>)> {
0347 |     let first = match Store::open(path) {
0348 |         Ok(store) => return Ok((store, None)),
0349 |         Err(e) => e,
0350 |     };
0351 |     // 挪走的是**真实文件**:默认路径是符号链接时链接留着、新库仍沿链接建在目标处,GUI 手里
0352 |     // `IndexLock` 锁的正是目标旁那把;挪链接本身会让锁留在旧目标旁、新库无人看管
0353 |     // (Codex review 2026-09-23)。重开仍走原路径,`Store.path` 与远程镜像目录不变。
0354 |     // 三件套一起挪:留下 WAL 或 SHM 任何一个,新库都会接着读旧日志
0355 |     let real = canonical(path);
0356 |     let backup = std::path::PathBuf::from(format!("{}.corrupt", real.display()));
0357 |     let _ = std::fs::remove_file(&backup);
0358 |     let _ = std::fs::rename(&real, &backup);
0359 |     for suffix in ["-wal", "-shm"] {
0360 |         let _ = std::fs::remove_file(format!("{}{suffix}", real.display()));
0361 |     }
0362 |     let store = Store::open(path).with_context(|| format!("rebuild failed after: {first}"))?;
0363 |     Ok((
0364 |         store,
0365 |         Some(format!(
0366 |             "Index was damaged and has been rebuilt — stars, pins and location \
0367 |              settings are gone. The old file is kept at {}",
0368 |             backup.display()
0369 |         )),
0370 |     ))
```

### `crates/wake-core/src/db.rs:96–154`

```text
0096 | CREATE TABLE IF NOT EXISTS removed_default_roots (
0097 |   agent      TEXT NOT NULL,
0098 |   path       TEXT NOT NULL,
0099 |   removed_at INTEGER,
0100 |   PRIMARY KEY (agent, path)
0101 | );
0102 | 
0103 | -- 应用级 UI 偏好。与 schema_meta 同形但语义不同:schema_meta 是索引
0104 | -- 自身的迁移状态,迁移代码可随意增删;prefs 是用户数据(user_data 同类,
0105 | -- 只是不挂在会话上),勿合并两表
0106 | CREATE TABLE IF NOT EXISTS prefs (
0107 |   key   TEXT PRIMARY KEY,
0108 |   value TEXT NOT NULL
0109 | );
0110 | 
0111 | CREATE TABLE IF NOT EXISTS disabled_locations (
0112 |   agent       TEXT NOT NULL,
0113 |   path        TEXT NOT NULL,
0114 |   disabled_at INTEGER,
0115 |   PRIMARY KEY (agent, path)
0116 | );
0117 | 
0118 | CREATE TABLE IF NOT EXISTS remote_hosts (
0119 |   name            TEXT PRIMARY KEY,
0120 |   enabled         INTEGER DEFAULT 1,
0121 |   added_at        INTEGER,
0122 |   last_sync_at    INTEGER,
0123 |   last_sync_error TEXT
0124 | );
0125 | 
0126 | -- 标题的全文索引。独立一张表而不挂在 messages 上:标题不是转录消息、没有 seq
0127 | -- 可对,塞成假消息会破坏 seq 契约。key 不索引、只用来回查/删除
0128 | CREATE VIRTUAL TABLE IF NOT EXISTS titles_fts USING fts5(
0129 |   key UNINDEXED,
0130 |   title,
0131 |   tokenize="trigram case_sensitive 0"
0132 | );
0133 | 
0134 | -- agent 自己写下的记忆(Claude Code auto-memory、Codex memories)的只读镜像:
0135 | -- 扫描收尾按 (agent, host) 整组替换(2026-09-17)。正文一并入库(小 Markdown),
0136 | -- 搜索走 memories_fts(rowid = memories.id,删改按 rowid 定位——FTS 表里
0137 | -- UNINDEXED 列的 WHERE 是整表扫描,正文列在里面扫不起);阅读时文件型先读
0138 | -- 磁盘、读不到再用这份。project_path 多半为空,读时按 session_key 连 sessions 解析
0139 | CREATE TABLE IF NOT EXISTS memories (
0140 |   id           INTEGER PRIMARY KEY,
0141 |   key          TEXT NOT NULL UNIQUE,
0142 |   agent_id     TEXT NOT NULL,
0143 |   host         TEXT NOT NULL DEFAULT '',
0144 |   scope        TEXT NOT NULL,
0145 |   project_path TEXT NOT NULL DEFAULT '',
0146 |   project_name TEXT NOT NULL DEFAULT '',
0147 |   session_key  TEXT NOT NULL DEFAULT '',
0148 |   path         TEXT NOT NULL,
0149 |   title        TEXT NOT NULL DEFAULT '',
0150 |   updated_at   INTEGER DEFAULT 0,
0151 |   size_bytes   INTEGER DEFAULT 0,
0152 |   source       TEXT NOT NULL DEFAULT '',
0153 |   body         TEXT NOT NULL DEFAULT ''
0154 | );
```

## WK15 恢复入口包括桌面深链，但不是运行回执

### `crates/wake-core/src/services/terminal/macos.rs:111–138`

```text
0111 |     /// display 名不足以认 app 的变体按 bundle id 验明正身(Info.plist 里
0112 |     /// bundle id 是明文 ASCII,XML/二进制两种 plist 都直接搜得到):
0113 |     /// ChatGPT.app 只有 Codex 版(com.openai.codex)才注册 codex:// scheme,
0114 |     /// 旧版 ChatGPT 同名不同物;Claude.app 同理防重名壳。一次性探测
0115 |     /// (installed_terminals 进程内缓存),读几 KB plist 无感。
0116 |     fn bundle_marker_ok(&self, app: &Path) -> bool {
0117 |         let marker: &[u8] = match self {
0118 |             TerminalApp::ClaudeDesktop => b"com.anthropic.claudefordesktop",
0119 |             TerminalApp::CodexDesktop => b"com.openai.codex",
0120 |             _ => return true,
0121 |         };
0122 |         std::fs::read(app.join("Contents/Info.plist"))
0123 |             .map(|data| data.windows(marker.len()).any(|w| w == marker))
0124 |             .unwrap_or(false)
0125 |     }
0126 | 
0127 |     fn is_installed(&self) -> bool {
0128 |         self.resolved_app_path().is_some()
0129 |     }
0130 | }
0131 | 
0132 | /// 深链类目标整锅接管 resume(不经 agent CLI)。新增非 shell 目标在此
0133 | /// 声明,mod.rs 的 resume_session_in 无需加旁路。
0134 | pub(super) fn deep_link_resume(meta: &SessionMeta, term: TerminalApp) -> Option<ResumeOutcome> {
0135 |     match term {
0136 |         TerminalApp::Kooky => Some(launch_kooky(meta)),
0137 |         TerminalApp::ClaudeDesktop => Some(launch_claude_desktop(meta)),
0138 |         TerminalApp::CodexDesktop => Some(launch_desktop_id(&meta.id, "codex://threads/", term)),
```

### `crates/wake-core/src/services/terminal/macos.rs:572–593`

```text
0572 | fn launch_desktop_id(id: &str, prefix: &str, term: TerminalApp) -> ResumeOutcome {
0573 |     if !is_uuid(id) {
0574 |         return ResumeOutcome {
0575 |             ok: false,
0576 |             command: String::new(),
0577 |             error: Some(format!(
0578 |                 "{} can only open sessions with a UUID id (got `{id}`)",
0579 |                 term.display_name(),
0580 |             )),
0581 |         };
0582 |     }
0583 |     let url = format!("{prefix}{id}");
0584 |     let ok = Command::new("open")
0585 |         .arg(&url)
0586 |         .output()
0587 |         .map(|o| o.status.success())
0588 |         .unwrap_or(false);
0589 |     ResumeOutcome {
0590 |         ok,
0591 |         command: url,
0592 |         error: (!ok).then(|| format!("Couldn't open {}", term.display_name())),
0593 |     }
```

## WK16 借鉴效果前重新核验，不引入删除功能

### `crates/wake-core/src/cleanup.rs:200–210`

```text
0200 | #[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
0201 | pub struct FileStamp {
0202 |     pub path: PathBuf,
0203 |     pub bytes: u64,
0204 |     pub logical_bytes: u64,
0205 |     pub modified: u64,
0206 |     pub identity: (u64, u64),
0207 |     /// Upper half of Windows' 128-bit file ID (needed on ReFS).
0208 |     #[serde(default)]
0209 |     pub identity_high: u64,
0210 |     pub directory: bool,
```

### `crates/wake-core/src/cleanup.rs:291–330`

```text
0291 | pub fn review(
0292 |     store: &Store,
0293 |     adapters: &[Box<dyn AgentAdapter>],
0294 |     chosen: Vec<CleanupCandidate>,
0295 |     cancel: &AtomicBool,
0296 |     mut progress: impl FnMut(usize),
0297 | ) -> Option<CleanupReview> {
0298 |     let mut result = CleanupReview::default();
0299 |     for (i, candidate) in chosen.into_iter().enumerate() {
0300 |         if cancel.load(Ordering::Relaxed) {
0301 |             return None;
0302 |         }
0303 |         match revalidate(store, adapters, &candidate) {
0304 |             Ok(()) => result.ready.push(candidate),
0305 |             Err(error) => result.skipped.push(UnavailableSession {
0306 |                 session: candidate.root,
0307 |                 sessions: candidate.sessions,
0308 |                 reason: error.to_string(),
0309 |             }),
0310 |         }
0311 |         progress(i + 1);
0312 |     }
0313 |     (!cancel.load(Ordering::Relaxed)).then_some(result)
0314 | }
0315 | 
0316 | fn stamp(path: &Path) -> Result<FileStamp> {
0317 |     #[cfg(windows)]
0318 |     let crate::services::windows_fs::FileSnapshot {
0319 |         metadata: m,
0320 |         bytes,
0321 |         identity,
0322 |         identity_high,
0323 |     } = crate::services::windows_fs::snapshot(path)?;
0324 |     #[cfg(not(windows))]
0325 |     let m = std::fs::symlink_metadata(path)?;
0326 |     ensure!(
0327 |         !m.file_type().is_symlink(),
0328 |         "Symbolic links are not supported"
0329 |     );
0330 |     ensure!(m.is_file() || m.is_dir(), "Not a regular file or directory");
```

## WK17 MCP 自定义协议与客户端约定

### `crates/wake-core/src/mcp/mod.rs:1–48`

```text
0001 | //! wake-mcp:把 Wake 的索引以 MCP(stdio 传输、JSON-RPC 2.0)**只读**暴露给别的
0002 | //! coding agent(Claude Code / Codex / Cursor …)。目标是"换一个 agent 不用重新
0003 | //! 解释自己做到哪了":对方按项目列最近会话、全文搜、读一段转录,全部来自本机
0004 | //! 索引与磁盘上的会话文件,零 LLM、零网络、不写库。
0005 | //!
0006 | //! 协议层手写而不引 rmcp:wake-core 全同步、没有 tokio,server 端真正要实现的
0007 | //! 只有 initialize / notifications/initialized / ping / tools/list / tools/call
0008 | //! 五个方法。消息按行分隔(stdio 传输规范:一行一条 JSON,不含裸换行),
0009 | //! stdout 只写协议,日志一律 stderr。需要 resources / prompts / sampling
0010 | //! 全家桶时再考虑换库。
0011 | //!
0012 | //! 索引库经 `Store::open_read_only` 打开——旁路进程绝不 `open_or_rebuild`,
0013 | //! 也不扫描;新鲜度靠 GUI 常驻的 watcher,每个工具返回都带"索引覆盖到的最新
0014 | //! 活动时间"。读会话是现场解析磁盘文件,不受索引新旧影响。
0015 | 
0016 | pub mod tools;
0017 | 
0018 | use std::io::{BufRead, Write};
0019 | use std::path::{Path, PathBuf};
0020 | use std::sync::Arc;
0021 | 
0022 | use serde_json::{json, Value};
0023 | 
0024 | use crate::adapters::AgentAdapter;
0025 | use crate::db::Store;
0026 | use crate::models::AgentId;
0027 | 
0028 | /// 本方声明的协议版本(客户端请求的版本在 SUPPORTED 内就回显它,否则回这个)
0029 | pub const PROTOCOL_VERSION: &str = "2025-06-18";
0030 | /// 已知且工具子集完全兼容的版本
0031 | const SUPPORTED: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
0032 | pub const SERVER_NAME: &str = "wake";
0033 | pub const SERVER_VERSION: &str = env!("CARGO_PKG_VERSION");
0034 | 
0035 | /// 随 initialize 下发给客户端的使用说明(LLM 会读)。重点是"什么时候该用":
0036 | /// 模型对陌生工具默认不碰,问"最近在做什么"会去翻 git log——要点明会话记录里
0037 | /// 有而 git 里没有的东西(讨论、决策、试过的路、停在哪)
0038 | const INSTRUCTIONS: &str = "Wake indexes every coding-agent session on this machine \
0039 | (Claude Code, Codex, Cursor, Gemini CLI, OpenCode and more) and exposes them read-only. \
0040 | Use these tools whenever the user refers to earlier conversations or sessions with any AI \
0041 | coding agent: what was discussed, decided or tried, why something was done a certain way, \
0042 | where previous work stopped, or whether an error was seen before. Git history and the \
0043 | working tree do not contain that; Wake does. Start with wake_list_sessions (pass the \
0044 | current working directory as `project`) or wake_search, then read the relevant transcript \
0045 | with wake_get_session; wake_list_projects shows which projects have history. \
0046 | wake_list_memories lists the notes agents keep for themselves about a project (Claude \
0047 | Code and ZCode auto-memory, Codex memories); read one by passing its wake://memory/… \
0048 | reference to wake_get_session. Nothing here can modify a session or a memory file.";
```

### `skills/wake/SKILL.md:1–42`

```text
0001 | ---
0002 | name: wake
0003 | description: Search and read past coding-agent sessions on this machine. Use when the user refers to earlier conversations, decisions, why something was done, where work stopped, or whether an error was seen before.
0004 | ---
0005 | 
0006 | # Wake — past coding-agent sessions
0007 | 
0008 | Wake indexes every coding-agent session on this machine — Claude Code, Codex, Cursor,
0009 | Gemini CLI, OpenCode and a dozen more — and `wake-cli` reads that index from a shell.
0010 | 
0011 | Reach for it whenever the answer lives in an earlier conversation rather than in the
0012 | code: what was discussed, what was decided and why, where previous work stopped, which
0013 | approaches were already tried and rejected, whether an error has been seen before. Git
0014 | history and the working tree do not hold any of that.
0015 | 
0016 | Everything below is read-only. Nothing here can modify or delete a session.
0017 | 
0018 | ## Finding the binary
0019 | 
0020 | ```bash
0021 | command -v wake-cli || ls /Applications/Wake.app/Contents/MacOS/wake-cli
0022 | ```
0023 | 
0024 | Use whichever resolves. On Linux it is on `PATH` after a deb install, or at
0025 | `~/.local/bin/wake-cli` from the tarball; on Windows it sits next to `Wake.exe`.
0026 | 
0027 | Two things can be missing, and they need different answers:
0028 | 
0029 | - **No binary.** Say so — the user needs [Wake](https://github.com/iAmCorey/Wake).
0030 |   Do not try to install it yourself.
0031 | - **No index** (`no Wake index at … — launch Wake once to build it`). Wake is
0032 |   installed but has never run. Run `wake-cli index` once; it builds the index in a
0033 |   few seconds without opening the app, then retry your query.
0034 | 
0035 | If the freshness line at the end of a listing is well behind and Wake is not running,
0036 | `wake-cli refresh` updates the index in a few seconds; it does nothing while Wake has its
0037 | window open or is still scanning. Retry the query afterwards.
0038 | 
0039 | ## Commands
0040 | 
0041 | Always scope to the current repository with `--project "$PWD"` unless the user clearly
0042 | means "everywhere". Without it, every project on the machine is in scope.
```

## WK18 原测试定义与许可

### `crates/wake-core/tests/adapter_contracts.rs:500–555`

```text
0500 | fn codex_parse_contract() {
0501 |     setup();
0502 |     let adapter = CodexAdapter::new();
0503 |     // file_ref 是公开 API:rollout-<ts>-<uuid>.jsonl 应剥出 uuid 作 native_id
0504 |     let path = fixture("codex/sessions/2026/08/02/rollout-2026-08-02T09-15-00-22222222-aaaa-bbbb-cccc-000000000002.jsonl");
0505 |     let r = adapter.file_ref(&path).expect("codex file_ref");
0506 |     assert_eq!(r.native_id, "22222222-aaaa-bbbb-cccc-000000000002");
0507 | 
0508 |     let s = adapter.parse_session(&r).expect("codex parse_session");
0509 |     let t = adapter
0510 |         .parse_transcript(&r)
0511 |         .expect("codex parse_transcript");
0512 | 
0513 |     // 标题取首条真实用户消息(environment_context 注入行归 Meta 被跳过)
0514 |     assert_eq!(s.meta.title, "扫码登录报错,帮我查一下 useEffect() 依赖数组");
0515 |     assert_eq!(s.meta.key, "codex:22222222-aaaa-bbbb-cccc-000000000002");
0516 |     assert_eq!(s.meta.project_path, "/Users/tester/Github/wakefx");
0517 |     assert_eq!(s.meta.source.as_deref(), Some("CLI")); // originator codex_cli_rs
0518 |     assert_eq!(s.meta.model.as_deref(), Some("gpt-5.2-codex"));
0519 |     assert_eq!(s.meta.git_branch.as_deref(), Some("feat/qr"));
0520 |     assert_eq!(s.meta.tokens_used, Some(4321));
0521 |     assert_eq!(s.meta.message_count, 3);
0522 |     assert!(!s.meta.archived);
0523 |     assert_eq!(s.meta.created_at, ms("2026-08-02T09:15:00Z"));
0524 |     assert_eq!(s.meta.updated_at, ms("2026-08-02T09:15:21Z"));
0525 |     assert_eq!(s.unknown_line_count, 1);
0526 | 
0527 |     assert_eq!(
0528 |         roles_kinds(&t.mainline),
0529 |         vec![
0530 |             (Role::User, MessageKind::Meta), // <environment_context> 注入
0531 |             (Role::User, MessageKind::Text),
0532 |             (Role::Assistant, MessageKind::Text), // reasoning 宿主 + tool call
0533 |             (Role::Assistant, MessageKind::Text),
0534 |             (Role::System, MessageKind::CompactSummary),
0535 |         ]
0536 |     );
0537 | 
0538 |     // reasoning 只留明文 summary,encrypted_content 必须丢弃
0539 |     let host = &t.mainline[2];
0540 |     let thinking = host.thinking.as_deref().expect("reasoning summary");
0541 |     assert!(thinking.contains("先全局搜 useEffect"));
0542 |     assert!(!thinking.contains("OPAQUE-CIPHERTEXT"));
0543 |     assert_eq!(host.tool_calls.len(), 1);
0544 |     assert_eq!(host.tool_calls[0].name, "shell");
0545 |     assert!(host.tool_calls[0]
0546 |         .output
0547 |         .as_deref()
0548 |         .unwrap_or_default()
0549 |         .contains("QrScanner"));
0550 | 
0551 |     // 空文本的 reasoning 宿主凭 tool call 进入 units
0552 |     assert_eq!(
0553 |         s.units.iter().map(|u| u.seq).collect::<Vec<_>>(),
0554 |         vec![1, 2, 3]
0555 |     );
```

### `crates/wake-core/tests/db_roundtrip.rs:52–77`

```text
0052 | fn search_roundtrip_hits_correct_seq() {
0053 |     let (_dir, store) = temp_store();
0054 |     let m = meta("claude-code:s1", "测试会话");
0055 |     let units = vec![
0056 |         unit(0, Role::User, "请帮我实现二维码扫描"),
0057 |         unit(3, Role::Assistant, "好的,用 useEffect( 挂载扫描器"),
0058 |     ];
0059 |     store.write_session(&m, m.updated_at, &units).unwrap();
0060 | 
0061 |     // 中文 trigram
0062 |     let (hits, degraded) = store.search("二维码", &[], None, 10).unwrap();
0063 |     assert!(!degraded, "3 码点应走 FTS 不降级");
0064 |     assert_eq!(hits.len(), 1);
0065 |     assert_eq!(hits[0].session.key, "claude-code:s1");
0066 |     assert_eq!(hits[0].seq, 0, "命中 seq 必须等于写入时的消息 seq");
0067 | 
0068 |     // 代码子串
0069 |     let (hits, _) = store.search("useEffect(", &[], None, 10).unwrap();
0070 |     assert_eq!(hits.len(), 1);
0071 |     assert_eq!(hits[0].seq, 3);
0072 | 
0073 |     // <3 码点降级 LIKE
0074 |     let (hits, degraded) = store.search("好的", &[], None, 10).unwrap();
0075 |     assert!(degraded, "2 码点应降级");
0076 |     assert_eq!(hits.len(), 1);
0077 | }
```

### `crates/wake-core/tests/db_roundtrip.rs:96–136`

```text
0096 | fn user_data_survives_rebuild() {
0097 |     let (_dir, store) = temp_store();
0098 |     let m = meta("claude-code:s3", "收藏的会话");
0099 |     store.write_session(&m, m.updated_at, &[]).unwrap();
0100 |     store
0101 |         .set_user_data("claude-code:s3", Some(true), Some(true))
0102 |         .unwrap();
0103 | 
0104 |     let removed = meta("claude-code:removed", "已删除的会话");
0105 |     store
0106 |         .write_session(&removed, removed.updated_at, &[])
0107 |         .unwrap();
0108 |     store.remove_session("claude-code:removed", true).unwrap();
0109 |     store.add_custom_root("codex", "/tmp/codex-copy").unwrap();
0110 |     store.add_removed_default("gemini").unwrap();
0111 |     store
0112 |         .set_location_enabled("codex", "/tmp/codex-copy/sessions", false)
0113 |         .unwrap();
0114 | 
0115 |     // 重建索引只动可派生表；用户选择与防复活墓碑都必须保留。
0116 |     store.rebuild_all().unwrap();
0117 |     assert!(store.is_key_tombstoned("claude-code:removed"));
0118 |     assert_eq!(
0119 |         store.list_custom_roots().unwrap(),
0120 |         vec![("codex".to_string(), "/tmp/codex-copy".to_string())]
0121 |     );
0122 |     assert_eq!(
0123 |         store.list_removed_defaults().unwrap(),
0124 |         vec!["gemini".to_string()]
0125 |     );
0126 |     assert_eq!(
0127 |         store.list_disabled_locations().unwrap(),
0128 |         vec![("codex".to_string(), "/tmp/codex-copy/sessions".to_string())]
0129 |     );
0130 | 
0131 |     // session 被扫描器重新写回后，独立 user_data 重新合并进结果。
0132 |     store.write_session(&m, m.updated_at, &[]).unwrap();
0133 |     let got = store.get_session("claude-code:s3").unwrap().unwrap();
0134 |     assert!(got.favorite, "重建后收藏丢失 = user_data 未独立");
0135 |     assert!(got.pinned, "重建后置顶丢失 = user_data 未独立");
0136 | }
```

### `LICENSE:1–21`

```text
0001 | MIT License
0002 | 
0003 | Copyright (c) 2026 Corey Chiu
0004 | 
0005 | Permission is hereby granted, free of charge, to any person obtaining a copy
0006 | of this software and associated documentation files (the "Software"), to deal
0007 | in the Software without restriction, including without limitation the rights
0008 | to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
0009 | copies of the Software, and to permit persons to whom the Software is
0010 | furnished to do so, subject to the following conditions:
0011 | 
0012 | The above copyright notice and this permission notice shall be included in all
0013 | copies or substantial portions of the Software.
0014 | 
0015 | THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
0016 | IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
0017 | FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
0018 | AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
0019 | LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
0020 | OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
0021 | SOFTWARE.
```
