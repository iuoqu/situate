# Missing Modules — Comprehensive Inventory v1

Status: captured end of May 2026, after PRs #31-#32 closed the path-B core loop. This is a living TODO covering all known module gaps across pre-writing, mid-writing, post-writing, methodology, production, and long-term writer development.

Updated to include user-raised additions: 架空设定一致性 / 故事活力预测 / 人物-情节冗余压缩.

**Update after METHODOLOGY v1.0**: items P1.1, P1.2, P1.3, P1.4, P1.5, P1.7, P1.8, P1.9, P1.10, P1.12 are **not atoms** — they are parts of the situate.map module. See `situate-map-spec-v1.md` for the consolidated spec and 7-phase implementation TODO. Cross-references retained below for traceability.

**Update after METHODOLOGY v2.0 (Drive and Goal, Aesthetic Neutrality)**: see top of this file's new sections:
- §A — situate.act (new third architectural layer)
- §B — Pending v2.0 audit + post-canonization work

These represent the next two major bodies of work, both blocked on
methodology v2 canonization.

---

## §A — situate.act (NEW: third architectural layer)

The product architecture is **not two layers** (map + at). It is **three**:

| Layer | Operation | Scale | Output |
|---|---|---|---|
| **situate.map** | Network → core (subtraction) | Project | project_map |
| **situate.act** | Core → timeline / segments (director's view) | Project (per-draft revisable) | act_estimates |
| **situate.at** | Timeline point → prose (cultivation) | Scene | draft prose |

The act layer's absence is currently the largest UX gap. A writer in situate.at writes scenes without knowing:
- Is this a short story (≤10k 字) or a long novel (≥150k 字)?
- Is this 3 scenes or 30?
- Is the current scene at the start, middle, or end of the whole?

Without act-level awareness, every scene decision is implicitly an act-level
gamble. If wrong, the writer discovers it after writing 5 scenes and has to
restart.

### A.1 The methodological reframe

situate.act does NOT make users commit to an act structure (which would
violate §3 / §13 — replacing user creative decisions). It is **estimate
maintenance**:

- User declares current best estimate
- Estimate is explicitly "subject to change"
- "我不知道" is always allowed
- AI flags structural consequences of the estimate (e.g., "5-8 万字 + 14 年时间跨度 = 大量时间需要被省略而不是叙述")
- AI never says one shape is better than another
- Estimate can be revised anytime; revision triggers re-survey of completed scenes

### A.2 The four estimate questions

1. **Time span**: 几天 / 几周 / 几个月 / 1-2 年 / 2-5 年 / 10+ 年 / 非线性
2. **Target length**: 短篇 / 中篇 / 短长篇 / 标准长篇 / 长长篇
3. **Segment count**: how many functionally-distinct "段" (NOT "幕" — avoid scaring non-dramaturgy writers). Free-text including "我不知道".
4. **Structural template**: 三幕 / 倒叙 / U形 / 平铺 / 环形 / 多视角 / 单一意识延展 / 自由描述 / 我不知道

### A.3 Triggers

Three entry paths, each with distinct UX:

**Main trigger**: after situate.map completes, before first situate.at session. Standard 4-question wizard.

**Return trigger**: explicit "back to act view" link from any situate.at session. Loads current estimates for revision.

**Deferred-ask trigger**: if user picked "我不知道" initially, after 3 completed drafts AI surfaces a one-time prompt "your scenes are forming a shape — give an estimate now?"

**Late-invocation trigger** (NEW from worked-example simulation): user enters situate.act for the first time AFTER 1+ drafts already exist. This is a common real path — many writers start writing, then realize they want director-view. Late invocation has its own UX:

1. Acknowledgment screen — does NOT blame the user for skipping the layer
   ```
   你已经写了 N 个场景，但还没有做幕结构估计。这意味着场景
   是在没有整本书尺度感的情况下写的。这不是问题——很多作
   者也是这样开始的。但现在做估计会改变你接下来怎么走，做
   完之后我们会回头检查已完成场景在新结构里的位置是否合适。
   ```
2. User goes through standard 4-question wizard
3. **Forced Retroactive Check** (§A.9) — every completed draft gets reviewed against new segment structure

Late invocation is a first-class flow, not edge case.

### A.4 Integration with situate.at

Each situate.at session shows a **structural bird's-eye view** in its sidebar:
- Segments with completed scene markers
- Estimated total scene count
- Current progress (e.g., "1/15-25 scenes")
- "What segment is your next scene in?" prompt

When user revises an act estimate, completed scenes get a "段归属" review — does this still belong to the originally-assigned segment?

### A.5 Compatibility with v2.0 drives

| Drive | situate.act default behavior |
|---|---|
| Purposeful (art) | Full 4-question wizard, AI surfaces consequences |
| Purposeful (commercial) | Full 4-question wizard, AI may add generic genre-based estimates if explicitly requested |
| Entangled | Default to "我不知道" for all 4. Deferred ask after 3 scenes. Don't push estimates. |
| Unknown | Skip entirely. Reconsider after drive type is declared. |

### A.6 New DB columns (per project, revisable)

```sql
ALTER TABLE projects ADD COLUMN act_time_span TEXT;
ALTER TABLE projects ADD COLUMN act_target_length TEXT;
ALTER TABLE projects ADD COLUMN act_segment_count INT;
ALTER TABLE projects ADD COLUMN act_segments JSONB;     -- 段 list + each's description + scene assignments
ALTER TABLE projects ADD COLUMN act_structure_template TEXT;
ALTER TABLE projects ADD COLUMN act_last_updated TIMESTAMPTZ;

ALTER TABLE story_drafts ADD COLUMN act_segment_index INT NULL;
```

### A.7 Implementation TODO

Sized like situate.map spec. Blocked on methodology v2.0 canonization.

- [ ] **A.7.1** Spec authoring: `situate-act-spec-v1.md` modelled on `situate-map-spec-v1.md` (~4h, expanded scope)
- [ ] **A.7.2** DB schema additions (~1h)
- [ ] **A.7.3** Routes `/act/[projectId]/*` and API (~3h)
- [ ] **A.7.4** 4-question wizard UI + AI consequence panel + Commitment Confirmation primitive (§A.10) (~6h, expanded)
- [ ] **A.7.5** Bird's-eye view component reused in `/write/guided` + per-scene segment-function strip (§A.11) (~4h, expanded)
- [ ] **A.7.6** Per-draft segment assignment UI (~2h)
- [ ] **A.7.7** Deferred-ask trigger after 3 completed scenes (~2h)
- [ ] **A.7.8** Estimate revision behavior (AQ2 RESOLVED: preserve old segment assignments; new segment blank; user manually drags any drafts that should move) (~2h)
- [ ] **A.7.9** Late-invocation acknowledgment + forced retroactive check flow (§A.3 / §A.9) (~4h, NEW)
- [ ] **A.7.10** Honest-pacing UX strings: "40-60 会话 / 2-4 年" framing wherever total scenes/length is shown (§A.12) (~1h, NEW)
- [ ] **A.7.11** Hand-test with 蒋某 project worked example (§A.13) (~3h)

Total: ~32h focused work (expanded from 24h after worked-example simulation revealed more required surface). Blocked on §B.0 (methodology canon).

### A.8 Open design questions

- **AQ1 — RESOLVED**: situate.act runs for both art-purposeful and commercial-purposeful. UI adds one line acknowledging genre conventions exist for commercial fiction without listing specific templates.
- **AQ2 — RESOLVED**: preserve old segment assignments on revision.
- **AQ3 — RESOLVED**: No diagnoser for v2.0. User-declared segment assignment is authoritative. AI surfaces distribution facts only. Reconsider in v2.5 if real-user feedback shows segment-function vs scene drift is a felt problem.
- **AQ4 — RESOLVED**: Bundle into single observation. For "unknown"-drive opt-in users at 3rd draft, AI surfaces one combined observation covering both inferred drive + suggested act path. One interruption only.

### A.9 Retroactive Check mechanism (NEW from worked-example)

When situate.act is established or revised AFTER any drafts exist, the
system performs Retroactive Check: every completed draft is reviewed
against the new/revised segment structure.

The check has fixed shape:

1. **Time-window verification**: does the draft's declared time fit within its assigned segment's time window?
2. **Position-within-segment surfacing**: is the draft at the beginning, middle, or end of its segment's time window?
3. **Segment-function comparison**: does the draft fulfill the user-declared function of its assigned segment? (Structural fact-check, NOT creative judgment. Compares prose against user's own declared function — same shape as `character_consistency` diagnoser.)

Each check surfaces one or more of these structural observations. Each
observation comes with **three response options**, never one
recommendation:

- (A) Accept the reframe (e.g., move scene from segment-1 start to segment-1 end)
- (B) Revise the segment function so the existing scene fits
- (C) Rewrite the scene to fit the declared function

User picks. AI accepts.

**Why this is the killer feature**: late invocation forces conscious
review of work already done, but reframes (not blames) it. The writer
discovers structure they didn't have before, applied to work they did
have. This is the central UX promise of the act layer.

### A.10 Commitment Confirmation primitive (NEW)

Pattern: after the user picks a structurally significant value (e.g., time
span = "10+ years"), AI surfaces **what that choice opens up** as a
category-level consequence list, then asks "你接受这个尺度吗？"

Strictly category-level, NEVER specific story content. Example:

Compliant:
```
10+ 年跨度意味着主人公会经历**时间尺度上的转变**：
- 物质层面的变化
- 视角层面的变化
- 周围人物的更换

这些未必都写进书里——但作为可能性被打开了。这是这个尺
度承担的代价：你要构建一个 14 年跨度的可信存在，即使读
者只看到其中 22 个时刻。

你准备好处理这个尺度的 backstage 重量吗？
```

Forbidden (§3.3 violation):
```
她可能会结婚、生孩子、离婚、失业、再就业、搬家、生病、
失去父母——
```

The primitive is shared with situate.map (same pattern applies to: mode
selection, center choice, central question — each can surface category-
level consequences and re-consent).

### A.11 Per-scene segment function visibility (NEW)

Every situate.at session, when entered with `?project=ID` (i.e., from a
project with project_map AND act_estimates), shows in the persistent
header strip:

- Drive type
- Central question (or haunting_image for entangled)
- Current segment + that segment's USER-DECLARED function

Example header (Jiang case, scene #2):
```
蒋某 | 段 1 — 不明白 | 中心问题：她是从哪一刻起明白...
📍 这个场景在段 1。段 1 的功能：让读者在不知情的状态下喜欢上她的工作。
```

The segment function text is **echoed verbatim from what the user wrote
in situate.act step 3**. AI does not rephrase, summarize, or "improve"
this text. Reflection per §6 (Socratic discipline) + §15 invariant 5
(AI never writes to user state).

### A.12 Honest-pacing UX (NEW)

The tool acknowledges scale honestly in UI. Wherever total scenes or
total length is surfaced, accompany it with realistic time framing:

```
总计 22 场景 / 65,000 字
约 40-60 个写作会话 / 2-4 年完成
（每个场景约 45-90 分钟，加间隔思考）
```

Purpose: prevent the writer from being misled by tools that imply
"finish a literary work this evening." The tool serves real book-writing,
which is a multi-year endeavor. Honest pacing UI sets that expectation.

This UX touch is methodology-load-bearing: it makes the tool's value
proposition match reality. Without it, the writer may abandon prematurely
when month 6 of writing yields only 10 of 22 scenes.

### A.13 Worked example: Jiang case (compliant rewrites)

The simulation user produced for the Jiang project surfaced specific
methodology violations. The compliant equivalents are recorded here as
spec source material — future contributors writing situate.act UI strings
should pattern-match these.

**⚠ The original simulation ALSO contained Scale Neutrality violations
that are flagged but NOT yet rewritten below.** The 4 estimate questions
in the simulation had:
- Default radio button selections (● "长河 10+ 年" pre-selected)
- AI reasoning that pushed toward a specific scale ("默认建议是长河，因为你的中心问题指向延时认识")
- Treatment of one scale as the recommended path

Per METHODOLOGY §3 Scale Neutrality (v2.0), all of these are forbidden.
The rewrite must:
- Remove all default selections (all radios start empty)
- Remove all AI reasoning that recommends one scale based on prior choices
- Show structural implications of EACH scale equally — not just the "default"
- Specifically remove phrases like "你的中心问题暗示了至少两端" used to push toward a longer scale

**TODO**: A.13.scale-rewrite — rewrite the 4 estimate question UI strings to be scale-neutral. Source the rewrites against §3 Scale Neutrality. (~2h)

The non-scale violations (§3.1 / §3.3) follow below:

**Q1 time-span alternative descriptions:**

Violating: "极短：整本书发生在 2011.12.20 这一天，'明白'是她当晚回到出租屋时的某个瞬间——她已经隐约知道了，只是不让自己想。"

Compliant: "极短：整本书发生在 24 小时内的范围。这意味着'明白'必须在没有 2014 事件作为催化的情况下发生——明白会更内向、更隐微，且没有外部事件给它命名。"

**Difference**: structural constraint (24 hours / no catalyst / no external naming), NOT specific scene content (returning to apartment / wouldn't let herself think).

**Q3 candidate-scenes list:**

Violating: lists 5 specific candidate scenes (入职第一天 / 加班晚上 / 第一次打电话 / 年会 / 接到任务的早上).

Compliant: lists 3 **functional categories** ("初始状态 / 例行公事 / 早期暗示") and asks the user to instantiate from their materials. AI provides scaffolding, USER provides scene-specific content.

**Scene #1 retroactive check:**

Violating: "场景 #1 让读者认识了一个有不安感的蒋某" — AI is paraphrasing/interpreting prose.

Compliant: quote actual sentences from the prose, present them alongside the user's declared segment function, ask the user to compare: "你写的这段（引用）跟你声明的段 1 功能（引用）——对你自己读起来吻合度如何？"

These patterns instantiate the broader principle "AI gives categories,
user gives specifics" (proposed for methodology v2 §14).

---

## §B — Pending v2.0 audit + post-canonization work

Blocked on user approval of `methodology-v2-draft.md`. Once canonized:

### B.0 Methodology canonization (~1h)
- [ ] **B.0.1** Merge approved §3 extension, §15 invariant 6, §18 into `METHODOLOGY.md` (canonical) — **READY NOW: all open questions resolved**
- [x] **B.0.2** RESOLVED: DQ1 (3 drafts) / DQ2 (Settings button) / DQ3 (Settings only) / DQ4 (Surface once at declaration)
- [x] **B.0.3** RESOLVED: AQ1 (commercial yes) / AQ2 (preserve) / AQ3 (no diagnoser v2.0) / AQ4 (bundle)
- [x] **B.0.4** RESOLVED: name is `situate.act`
- [x] **B.0.5** RESOLVED: §3 extension "Aggregation is not verdict"
- [x] **B.0.6** RESOLVED: §18.10 "Declaration vs Behavior" principle
- [x] **B.0.7** RESOLVED: §18.9 "AI gives categories, user gives specifics" principle
- [x] **B.0.8** RESOLVED: §17 promise extension "Tool promises clarity, not results"

### B.1 L1.1 — vitality readiness-signal refactor (~3h)
The current `vitality` module ranks prose with "vital/borderline/flat" verdicts — methodologically forbidden (§3.4 + §13). After §18 canonized:
- [x] **B.1.1** RESOLVED: Option B — readiness signals report. Keep 5-signal aggregation UI; remove verdict label. Per "Aggregation is not verdict" clarification, the writer reads signal counts as copilot data, not as a quality grade.
- [ ] **B.1.2** Rewrite `computeVitality()` to return signal report without verdict
  - Drop `verdict: "vital" | "borderline" | "flat"` from `VitalityResult`
  - Drop `summary` aesthetic phrasing ("有活力" / "活力不足" / "像小学生日记")
  - Keep `signals[]` structure showing each per-signal status (firing / missing / unavailable)
  - Replace `summary` with neutral fact-string: "5 项就绪信号中，3 项当前 firing" or similar
- [ ] **B.1.3** Rewrite `VitalityBadge` UI:
  - Drop verdict color palette (vital green / flat red)
  - Single neutral panel header: "结构就绪信号" (5/5 firing) or similar
  - Per-signal rows with √/✗/· glyphs and one-line reason
  - No "好/坏" implication anywhere
- [ ] **B.1.4** Drive-aware: under entangled drive, swap signal set
  - Purposeful: K / 因果 / 人物 / 设定 / subtext (current 5)
  - Entangled: K_carrier=image-or-narrator / recurrent_image_strength / haunting_image_presence (the_thing_arrived axes)
- [ ] **B.1.5** Test wording with first internal user — does it read as "tool reports state" not "tool grades me"?

### B.2 L1.2 (post-canon) — frame-aware lay-translator (~5h)
After L1.2 partial cleanup (already done), still need:
- [ ] **B.2.1** Drive-aware framing: lay-translator selects observation copy based on `draft.drive_type` (purposeful-art / purposeful-commercial / entangled)
- [ ] **B.2.2** New observation #12: `serves_central_question` (purposeful only)
- [ ] **B.2.3** New observation #13: `the_thing_arrived` (entangled only)
- [ ] **B.2.4** Audit observation #2 (center of gravity) for entangled framing — "支点" wording assumes purposeful

### B.3 L1.3 main — `/write` entry redesign (~5h)
After §18 canonized:
- [ ] **B.3.1** Add drive type selection as first entry question
- [ ] **B.3.2** Drive type → conditional next step (purposeful-art → 初心三段, commercial → +媒介目标, entangled → 一行字, unknown → skip)
- [ ] **B.3.3** Drive type → routing decision (purposeful-art with network material → /map, others → /write/guided)
- [ ] **B.3.4** Persist `drive_type` to `storyDrafts` on first save

### B.4 L3.2 follow-up — frame-aware system prompts (~2h)
- [ ] **B.4.1** `/api/prompt-suggestions/route.ts`: inject declared frame into prompt instead of hard-coding "literary magazine"
- [ ] **B.4.2** Audit other LLM-calling routes for similar implicit framing

### B.5 Drive detection infrastructure (~5h)
- [ ] **B.5.1** Add `k_carrier` enum field to `stakes_absent` diagnoser output
- [ ] **B.5.2** New cross-draft diagnoser: `recurrent_image`
- [ ] **B.5.3** New endpoint `/api/coach/recurrent` accepting draft_ids[]
- [ ] **B.5.4** New cross-draft analyzer module at `src/lib/coach/cross-draft/`
- [ ] **B.5.5** Drive-detection signal aggregator: combines k_carrier distribution + recurrent_image strength → suggested drive type
- [ ] **B.5.6** Surface gating per §18.3 + §18.10:
  - For "unknown" drive: aggregator runs after 3 drafts, surfaces ONCE
  - For declared drive: aggregator runs only when user clicks Settings "重新检测驱动" button
  - For hybrid project split suggestion: only shown in project Settings, never proactively
- [ ] **B.5.7** Settings UI for manual re-detection button

### B.6 New diagnoser: the_thing_arrived (~6h)
Critical for entangled drive feedback. Hardest prompt engineering of v2.0.
- [ ] **B.6.1** Spec: input = (prose, haunting_image text). Output = 3-tier verdict (arrived / partial / still_inside_writer) + evidence.
- [ ] **B.6.2** System prompt iteration — multiple test passes against Kim Yujeong / Carver corpus
- [ ] **B.6.3** Lay-translator integration as observation #13
- [ ] **B.6.4** Per-draft trigger only when `drive_type = 'entangled'`

### B.7 Canonical-validation extension (~4h)
Current corpus is all literary. Add:
- [ ] **B.7.1** 1 commercial-genre work (thriller / romance / SF)
- [ ] **B.7.2** 1 pure-entangled work (汪曾祺 / Kafka short / Carver) for `the_thing_arrived` validation
- [ ] **B.7.3** Re-validate full bank against expanded corpus with drive_type framing

### B.8 Project schema expansion (~2h)
- [ ] **B.8.1** `projects` table: + drive_type, materials_pile, haunting_image, media_goal
- [ ] **B.8.2** `storyDrafts` table: + drive_type, project_id (nullable), haunting_image (entangled)
- [ ] **B.8.3** Drizzle migration

---



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
