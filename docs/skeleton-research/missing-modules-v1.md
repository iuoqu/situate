# Missing Modules — Comprehensive Inventory v1

Status: captured end of May 2026, after PRs #31-#32 closed the path-B core loop. This is a living TODO covering all known module gaps across pre-writing, mid-writing, post-writing, methodology, production, and long-term writer development.

Updated to include user-raised additions: 架空设定一致性 / 故事活力预测 / 人物-情节冗余压缩.

**Update after METHODOLOGY v1.0**: items P1.1, P1.2, P1.3, P1.4, P1.5, P1.7, P1.8, P1.9, P1.10, P1.12 are **not atoms** — they are parts of the situate.map module. See `situate-map-spec-v1.md` for the consolidated spec and 7-phase implementation TODO. Cross-references retained below for traceability.

---

## Pre-writing (写之前)

### From situate.map spec

- **P1.1 网络材料 triage** — 给作者复杂网络材料，AI 提议核心/背景/噪音三分类。User 拖拽确认。覆盖"有大量材料不知道怎么下手"用户类型。  
  工作量 ~4h. 优先级 P0.

- **P1.2 五类冲突识别 + dramaturgy red flags** — 内在 / 结构 / 关系 / 同盟 / 时间 5 槽。AI 检查空槽、语义重复、材料里有但没填的冲突。  
  工作量 ~3h. 优先级 P1.

- **P1.3 中心问题压缩（50 字 + 3 indicators）** — 强制 discipline，逼作者用一句话回答"我在写什么"。Live indicators: 是问句 / 非 yes-no / 同时具体且普遍。AI 给 deep challenge。  
  工作量 ~2h. 优先级 P1.

- **P1.4 项目级状态（project_map persistence）** — 当前只有 draft，无 project 层。需要 schema 改动让一个 project 容纳多 draft，project_map 作为顶层 metadata。  
  工作量 ~6h（含 migration）. 优先级 P2.

- **P1.5 网络 vs 单点 入口决策** — `/write` 入口加第 4 选项，分流到 guided 配置或 situate.map。可以根据 anchor 字数自动建议。  
  工作量 ~1h. 优先级 P1.

- **P1.6 跨模块 mode 继承** — project_map.mode → guided.mode 自动 prefill。  
  工作量 ~1h. 优先级 P2.

- **P1.7 Filtered character workshop** — character_interview 只对 project_map.core_circle 里的角色 trigger，背景人物不问。  
  工作量 ~2h. 优先级 P2.

- **P1.8 第 5 类 mirror 反馈：服务中心问题** — guided / template 的 mirror 阶段，如果 project_map 存在，加一条 "这一段是否服务你定的中心问题"。  
  工作量 ~2h. 优先级 P2.

- **P1.9 Pinned project_map header** — 整个 situate.at flow 里 project_map 作为可折叠 header 永远在视线里。  
  工作量 ~2h. 优先级 P2.

### Newly raised (架空 / 质量预测 / 压缩)

- **P1.10 架空设定一致性诊断（world_coherence）** — 多人物宇宙的检查：人物关系矛盾 / 权力 dynamic 不一致 / 缺失连接 / 规则违反 / 时空 impossibilities。**为虚构 / 半架空 mode 服务**。  
  工作量 ~4h (new analytical diagnoser).  
  Schema: 列出检测到的矛盾 + 缺失 + 优化建议（结构性，不写文学）.  
  优先级 P1.

- **P1.11 故事活力预测（vitality / 阅读味道）** — pre-writing 阶段问："这会是一个好故事吗？会不会味同嚼蜡？" Aggregates 信号：K 是否会变 / 因果是否成立 / 人物是否扁平 / 设定是否泛化 / subtext 层是否存在。  
  工作量 ~3h（meta-diagnoser，调用其他 diagnoser 后聚合）.  
  Output: ✓ 有活力 / ◐ 边缘 / ✗ 可能像小学生日记。附原因。  
  优先级 P0.

- **P1.12 人物 / 情节冗余检测（structural_compression）** — 多人物重叠功能 / 情节线不服务中心问题 / 重复 device / 可合并可砍掉的部分。给作者**做减法的具体建议**。  
  工作量 ~4h.  
  Output: 哪些人物功能重叠 + 哪些情节线没贡献 + 具体合并方案.  
  优先级 P1.

---

## During-writing (写的过程中)

- **P2.1 开头脚手架（first-line workshop）** — 5-6 种开头风格 menu（动作 / 画面 / 陈述 / 对话 / 反问 / 倒叙）+ AI 基于 anchor 出每种 2-3 候选 + 大师范例。  
  工作量 ~3h. 优先级 P0.

- **P2.2 "我卡住了" socratic 按钮** — editor 每节加，AI 根据当前 section 已写内容 + 后续骨架提 3 个具体问题（不写句子，问问题）。  
  工作量 ~3h. 优先级 P1.

- **P2.3 Per-section inline AI** — 当前 inline AI 只跑全文，per-section 让作者写完第 2 节就能看到反馈。  
  工作量 ~3h. 优先级 P1.

- **P2.4 收尾脚手架（last-line workshop）** — 结尾 device menu（image / 反讽 / open / cyclic / decisive）+ 大师范例。  
  工作量 ~3h. 优先级 P2.

---

## Post-writing (写完之后)

- **P3.1 可行 revision 建议** — 现在 mirror 给 observation，不给方向。加一层"基于这个 observation，可以试 X 或 Y"。  
  工作量 ~4h. 优先级 P0.

- **P3.2 Rewrite 候选方案对比** — 给一段，AI 出 3 个不同方向的改法（不写整段，给方向 + 1 句话示例），作者选。  
  工作量 ~4h. 优先级 P2.

- **P3.3 跟既发表作品对比** — "这段读起来像 X 类的作品，跟 Y 作家某篇有相似处" — 给 craft 锚点。需要 corpus.  
  工作量 ~6h. 优先级 P2.

---

## 方法论 (methodology axis 补完)

- **P4.1 the_turn diagnoser** — transformational-v0 框架早就承诺要建。结尾是 recontextualize / 决定性收束 vs 只总结主题。  
  工作量 ~2h. 优先级 P0. **方法论欠债**.

- **P4.2 POV 诊断** — 第一/三人称 / 近 vs 远距离 / 可信叙述者 vs 不可信。Detect 视角摇摆。  
  工作量 ~2h. 优先级 P0.

- **P4.3 时态结构诊断** — 全过去 / 全现在 / 交替使用。Detect 时态错位。中文有"了"的位置，英文有 had vs did。  
  工作量 ~2h. 优先级 P1.

- **P4.4 时间结构诊断** — 线性 / 倒叙 / 多线交织 / 嵌套。识别用了哪种 + 是否成立。  
  工作量 ~3h. 优先级 P1.

- **P4.5 声音 / register 诊断** — 口语 / 书面 / 方言 / 学院腔。Detect register 不一致.  
  工作量 ~2h. 优先级 P2.

- **P4.6 conflict typology 翻译** — 4 引擎 backend axis → 作者面对的 5 类冲突清单（跟 P1.2 配合）。  
  工作量 ~1h. 优先级 P1.

---

## Production (产品化最后阶段)

- **P5.1 标题工作坊** — AI 根据全文出 5-10 个候选标题 + 简短说明每个 angle。  
  工作量 ~2h. 优先级 P1.

- **P5.2 长度调整指引** — 哪节扩 / 哪节缩 / 哪节可以删整段。基于 economy + structure 分析.  
  工作量 ~3h. 优先级 P1.

- **P5.3 版本管理 / revision history** — 草稿历次版本 diff 查看. 写作者写改对照.  
  工作量 ~6h（含 DB schema）. 优先级 P2.

---

## 长期 (writer development)

- **P6.1 跨稿件模式识别** — 这作者总是 K_implicit, 建议练 K_present specific 练习.  
  工作量 ~6h. 优先级 P3.

- **P6.2 阅读推荐** — 基于你写的判断你该读什么. 需要 corpus + tagging.  
  工作量 ~12h. 优先级 P3.

- **P6.3 craft 文章库 / 教程** — 集成既有写作传统教学材料.  
  工作量 ~varies. 优先级 P3.

- **P6.4 个人 craft 进步追踪** — 你的 K_present 命中率从 60% 升到 85% 之类.  
  工作量 ~4h（需要历史数据积累）. 优先级 P3.

---

## 路径维度（不是模块，是 UX）

- **U.1 三条路径不串** — /write/guided 写完去 review，OK。但 template 用户没法导入 guided 的 anchor / drill。需要打通.  
  工作量 ~2h. 优先级 P2.

- **U.2 多语言** — 全部 prompt 是中文，但 prose 可以是任意语言. 是否给非中文作者出英文版 prompt？  
  工作量 ~10h (per 语言). 优先级 P3.

- **U.3 移动端 responsive** — guided / template 在手机上可用性? Spec phase 7 提到拖拽要 tap fallback.  
  工作量 ~6h. 优先级 P2.

---

## 优先级总结表

### P0（真痛 + 方法论欠债 + 高 leverage）
- P1.1 网络材料 triage
- P1.11 故事活力预测
- P2.1 开头脚手架
- P3.1 可行 revision 建议
- P4.1 the_turn diagnoser
- P4.2 POV 诊断

### P1（重要补完）
- P1.2 五类冲突识别
- P1.3 中心问题压缩
- P1.5 网络 vs 单点入口
- P1.10 架空设定一致性
- P1.12 人物 / 情节冗余检测
- P2.2 "我卡住了" socratic
- P2.3 Per-section inline AI
- P4.3 时态结构
- P4.4 时间结构
- P4.6 conflict typology 翻译
- P5.1 标题工作坊
- P5.2 长度调整指引

### P2 - P3
其余的都是 nice-to-have / 长期项

---

## 三类用户类型与对应模块映射

| 用户类型 | 当前覆盖 | 缺的 |
|---|---|---|
| 已经知道要写什么 | template path | P3.1 revision 建议 |
| 有一个 anchor / 单点 | guided path | P2.1 开头脚手架 / P3.1 |
| **有网络材料 / 架空宇宙** | **无** | **P1.1 triage + P1.2 冲突 + P1.10 架空 + P1.12 压缩 + P1.4 project** |

第三类是真正 "需要新 path" 的，其他两类是 "现有 path 缺关键 piece"。

---

## 跟既有方法论文档的关系

- `transformational-v0.md` — P4.1 the_turn 是这文里早就承诺要建的
- `methodology-v1.md` — 这里列的所有 P0/P1 都会丰富方法论本身
- `canonical-validation-v1.md` — P4 系列建好之后可以用四语言 canon 跑一遍验证
- `long-form-handling.md` — P1.10 / P1.12 是长文专用补充

---

## See also

- `transformational-v0.md` — original framework spec
- `methodology-v1.md` — current state
- `next-steps-after-pdr.md` — older planning (mostly obsolete)
- `canonical-validation-v1.md` — multi-language validation
- `long-form-handling.md` — long-form architecture
