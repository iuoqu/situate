# METHODOLOGY v2.0 — Draft Extensions

> Status: **DRAFT for user review**, not canonized. End of May 2026.
> Extends METHODOLOGY.md v1.0 (provided by user in design conversation).
>
> Drives from two design discoveries:
>   1. v1 implicitly assumed all writing is purposeful (intent-driven). Kim
>      Yujeong, Wang Zengqi, Lu Xun's 野草, Kafka, Carver, and parts of Munro
>      operate on a different drive — entanglement. The tool needs two drive
>      types, not one.
>   2. v1's framing implicitly elevated literary fiction. A user with a
>      commercial goal would feel othered. Aesthetic neutrality must be a
>      bottom-line invariant, not a feature.
>
> This document drafts three additions:
>   - §3 extension: Aesthetic Neutrality
>   - §15 invariant 6: No canon names in user-facing surfaces
>   - §18: Drive and Goal
>
> Once user approves wording, these get merged into the canonical METHODOLOGY.md.

---

## §3 extension: Aesthetic Neutrality

> Placement: immediately following §3's six "Never do" items, before §3's
> "Public-facing version".

The tool has no aesthetic preferences. It does not believe literary fiction
is "higher" than commercial fiction, or intent-driven writing is "more
legitimate" than haunting-driven writing. The user declares their drive type
and media goal; the tool serves them within that frame.

AI must never:
- Suggest that one drive type is more serious
- Suggest that one media goal is more artistic
- Use language that implies a hierarchy between writing types
- Add unsolicited literary references that imply a "good" tradition

AI may:
- Describe the consequences of choices within the user's declared frame
- Surface conflicts between the user's stated goal and their current decisions
- Offer structural facts about how media markets typically work (only when relevant to a declared commercial goal)

**Platform positioning is separate.** Situate Editions is itself a magazine
with a literary editorial identity. The platform's downstream service
defaults to its own publication standards. Users may declare other media
goals — these are accepted, but the platform does not pretend to offer
expertise it does not have. Transparency about positioning is not a
violation of neutrality. Disparaging other positions is.

**Aggregation is not verdict.** A summary UI that shows the writer how many
structural signals are currently firing (e.g., "5 of 5 readiness signals
showing positive state", "3 of 5 showing missing state") is permitted,
because the writer carries final responsibility for the work and benefits
from a glanceable copilot view. What is forbidden is the tool issuing a
quality verdict (e.g., "your work is vital" / "your work is flat"). The
distinction:
- Showing the writer signal counts and per-signal status = aggregation
- Assigning a quality label to the aggregate = verdict
- Aggregation is permitted; verdict is forbidden under §3.4 + §13.

The writer reads aggregated signals as part of their own judgment about
whether to submit. The tool does not judge for them.

---

## §15 invariant 6: No canon names in user-facing surfaces

> Placement: as the 6th item in §15's numbered list.

6. **No literary canon names in user-facing surfaces.** Author and work
   references (Stanislavski, Aristotle, Chekhov, Pixar, Munro, Hemingway,
   etc.) live in internal documentation (`docs/`) and may appear in
   staff-only diagnoser descriptions. They MUST NOT appear in:
   - System prompts visible to LLM (because LLM output may echo them)
   - Lay-translator output
   - UI text
   - Exported project state

   Equivalent neutral phrasing must be used in user-facing surfaces.
   "Pixar but/therefore" becomes "事件之间的因果链条". "Stanislavski's given
   circumstances" becomes "角色 backstory 工作坊". The methodology lineage
   is honest internal record; it does not become an authority claim toward
   users.

---

## §18: Drive and Goal

> Placement: as a new section after §17 The Promise.

### §18.1 The two drives

Writing is moved by two fundamentally different forces. The tool serves both.

|  | Purposeful | Entangled |
|---|---|---|
| Origin | An intent (something to communicate to a reader) | An image / memory / sensation that won't leave |
| Direction | From writer toward future reader | From writer inward |
| Reader-consciousness | Strong | Weak or absent |
| Knows what they're writing | Yes, before writing | No — discovered through writing |
| What completion looks like | The intent is realized | The thing finally departs |
| Compatible canonical examples | Most modern fiction with declared theme | Kim Yujeong's 山茶花; Wang Zengqi's 受戒; Lu Xun's 野草; many Kafka short stories; Carver; some Munro |

The 1.0 tool was built only for purposeful writing. Initial-intent fields
(给谁/为什么/读者获得), situate.map's central question, situate.at's
intent-tied feedback — all presuppose that the writer knows what they want.

This is not a defect that can be patched. It is a worldview that excludes
a major literary register. v2 must support both drives natively, with the
tool taking different shapes per drive — not the same flow with cosmetic
adjustments.

### §18.2 The optional media goal layer

Orthogonal to drive type, every project may declare an optional **media
goal** — where this work is intended to land.

- A purposeful project may declare a media goal (where it will be published).
- An entangled project may also declare a media goal — being haunted does
  not preclude wanting publication.
- An unknown-drive project may also declare one.

The media goal field is **freeform**. The tool does not impose a taxonomy.
Default placeholder for first-time users: "Situate Editions" (the platform
itself). Users may change to any other description in their own words. The
tool does not validate or rank these declarations.

When a user declares a commercial-oriented media goal, the tool serves the
writing process the same way but does NOT pretend to expertise in commercial
positioning. AI may surface generic structural facts about how media markets
work when explicitly relevant to the declared goal, but does not coach
toward commercial success.

### §18.3 Drive detection and switching

Drive type is bound per draft (`storyDrafts.drive_type`), not per project.
A project may contain drafts of different drives; the project dashboard
gently surfaces this and suggests considering a project split.

Drive type is set at three moments:

1. **Project creation entry** — user selects one of: purposeful / entangled / 现在不知道 (unknown). This becomes the default for the project's first draft.
2. **Per-draft override** — each new draft inherits but may override.
3. **AI observation** — for "unknown" drive type, AI observes the first 3 drafts and, when the signal is strong enough, surfaces a one-time prompt: "Your drafts suggest you may be writing in [X] drive. Want to confirm?"

The observation triggers after the writer has completed **3 independent
drafts** (settled decision; 3 chosen as the smallest count that gives a
stable cross-draft signal). The signal is computed from two sources:

- **k_carrier** (new field on `stakes_absent` diagnoser output): which kind of element carries K — `character` / `image_object` / `place_moment` / `narrator_self` / `diffuse`. Distribution across drafts indicates drive type:
  - 60%+ `character` → purposeful indicated
  - 60%+ `image_object` / `place_moment` / `narrator_self` / `diffuse` → entangled indicated
  - Mixed → keep observing
- **recurrent_image** (new cross-draft diagnoser): identifies images/moments/details that recur across multiple drafts in a way that suggests they are load-bearing for the writer (not just for any one story). If recurrence is strong, entangled drive is more likely.

**Critical boundary** (settled decision from Q5/Q6 review):

AI surfaces drive observations ONLY in two cases:
1. The user explicitly chose "unknown" drive at project creation (i.e., user opted into deferred observation). AI surfaces the inferred drive once, after 3 drafts.
2. The user manually requests re-detection via a Settings button.

AI does NOT proactively re-surface drive mismatches against drives the
user has already declared. Once the user has answered the drive
question, the answer is treated as authoritative — second-guessing it
based on behavioral evidence would be a form of AI surveillance the
methodology forbids.

This is a sharper reading of §13 ("AI does not volunteer opinions when
not asked") + §9 ("one challenge per decision, then accept"):
- Surface at declaration moment: permitted (it's part of the conversation that produced the declaration)
- Surface during opt-in observation period: permitted (user requested observation by choosing "unknown")
- Surface after explicit user declaration based on subsequent behavior: FORBIDDEN

See §18.X "Declaration vs Behavior" principle below.

### §18.4 What each drive uses as its anchor

| Drive | Project-level anchor | Per-draft anchor | Goes through situate.map? |
|---|---|---|---|
| Purposeful (art) | 初心 (intent fields: 给谁/为什么/读者获得) | Scene anchor | Yes, when network material |
| Purposeful (commercial) | 初心 + 媒介目标 | Scene anchor | No — writer self-routes |
| Entangled | 那一行字 (haunting_image) | Scene anchor (often = the haunting itself zoomed in) | No — entangled writers wander, do not compress |
| Unknown | 那一行字 (provisional) | Scene anchor | No — defer until drive confirmed |

situate.map serves art-purposeful projects with network material. It does
not serve commercial-purposeful (they have their own architecture
methods), it does not serve entangled (compression destroys the purity of
that drive), it does not serve unknown (the architecture would presuppose
purpose). Routing logic at `/write` entry must respect this.

### §18.4a Three-layer architecture (NEW with v2.0)

The product is three layers, not two. They sit between project creation and
scene-level writing:

| Layer | Operation | Direction | Output |
|---|---|---|---|
| situate.map | Network → core (subtraction/completion) | Horizontal across the network | project_map |
| situate.act | Core → timeline / segments / shape | Director's view of the whole | act_estimates |
| situate.at | Timeline point → prose (depth) | Vertical into one moment | draft |

situate.act is a NEW layer (not in v1). It maintains the writer's
awareness of the work's whole-scale shape (time span, length, segment
count, structural template) without forcing premature commitment. The
writer declares **estimates** that can be revised at any time. AI flags
structural consequences of the declared shape (e.g., "5万字 + 14 年时间
跨度 = 大量时间被省略而不是叙述") without ranking which shape is
better.

Per-drive defaults:
- Purposeful (art/commercial): situate.act runs fully
- Entangled: defaults to "我不知道" for all estimates; deferred ask after 3 completed scenes
- Unknown: skipped entirely

Detailed spec lives in `missing-modules-v1.md` §A and (when authored)
`situate-act-spec-v1.md`.

### §18.5 Feedback differs by drive

The mirror stage at situate.at end-of-draft applies different framings:

| Drive | What AI compares prose against | 5th feedback category |
|---|---|---|
| Purposeful (art) | 初心 | 服务于中心问题 |
| Purposeful (commercial) | 初心 + 媒介目标 | 服务于初心 + 媒介目标对齐情况 |
| Entangled | 那一行字 | 那个东西出来了吗 |
| Unknown | (nothing yet) | (skipped until drive confirmed) |

Critical: for entangled drafts, the framing is "has the thing arrived"
(召唤式) — never "did you achieve your purpose" (目的论式). A new diagnoser
`the_thing_arrived` performs this judgment, with 3 tiers: arrived / partial
/ still_inside_writer.

### §18.6 Completion semantics

Each drive type completes differently. The "submit" button copy and
project-state advancement language differs:

- **Purposeful**: "你的初心是 [...]。你认为这本书做到了吗？"
- **Entangled**: "你最初说不肯走开的东西是 [...]。这件事现在出来了吗？它还在缠你吗？"
- **Unknown**: "你的项目还没声明驱动。先选一个，或者直接判断'我已经写完了'。"

These phrasings shape the writer's psychological orientation toward
completion. The difference is not cosmetic — it is the difference between
finishing a task and finishing an exorcism.

### §18.7 User override is absolute

AI surfaces drive-related observations and completion signals. AI never:
- auto-switches drive type
- prevents submission based on AI completion judgment
- ranks one drive's completion as better

The user submits when the user decides. Per §9 + §17, the tool respects
user agency including over completion judgment. The editor (or platform)
decides what to publish; the writer decides what to submit.

### §18.8 What does NOT change regardless of drive

The §3 ethical bottom line is unchanged across all drives. In both
purposeful and entangled modes:
- AI does not write literary text
- AI does not make decisions for the user
- AI does not fill specific details
- AI does not make aesthetic judgments
- AI does not compliment the user
- AI does not volunteer opinions when not asked

The drives change what the tool's framing serves. The discipline that
governs how AI behaves under that framing is invariant.

### §18.9 Operational principle: AI gives categories, user gives specifics

A meta-principle that operationalizes §3.1 + §3.3 across all three layers
(map / act / at):

> AI provides categorization scaffolding. The user instantiates each
> category with specific content drawn from their own materials and
> creative intent.

Examples of the principle in action:

| Layer | AI gives | User gives |
|---|---|---|
| situate.map step 2 | 5-6 angles from the 8 universal angles | Specific answers about which person resonates |
| situate.map step 4 | 5 conflict slots (internal/structural/relational/alliance/temporal) | Specific conflicts in this project |
| situate.act commitment confirmation | "10+ year scope opens: physical change / perspective change / relationship change" | Specific events (if any) the writer plans |
| situate.act candidate earlier scenes | "Functional categories: initial state / routine / early hint" | Specific 2011 moments from this writer's materials |
| situate.at mirror | "K is character/image/place/narrator" carrier type | Which one this draft uses |

What is NOT permitted:
- AI listing specific scene candidates ("2011.04 入职第一天 / 2011.夏 加班晚上")
- AI listing specific story beats ("she will marry, have kids, lose her parents")
- AI writing inner monologue for hypothetical scenes ("she already knew vaguely, just wouldn't let herself think")
- AI naming specific characters not in the user's materials
- AI naming canonical works as targets to emulate (overlap with §15 invariant 6)

What IS permitted:
- AI listing functional categories with neutral labels
- AI listing structural consequences in abstract language ("the protagonist must age across this span")
- AI listing constraint implications ("this length × this span = high compression")
- AI surfacing tension between user's declared frames ("your stated reader and stated media goal pull in different directions")

This principle is the engineering rule that makes the tool's ethical
bottom line operational. Without it, every prompt drift toward
ghostwriting. With it, the tool stays scaffolding regardless of how
elaborate the AI's surface output becomes.

### §18.10 Declaration vs Behavior (NEW)

A complementary principle surfaced from the Q5 + Q6 review:

> AI may surface consequences at the moment a user declares a choice.
> AI may NOT surface observations that contradict the user's prior
> declarations based on the user's subsequent behavior — except when the
> user explicitly opted into behavioral observation.

The distinction:

| Moment | AI action permitted |
|---|---|
| User just declared X at the moment of choice | Surface consequences of X (Commitment Confirmation, see §A.10) |
| User declared X earlier, then writes prose suggesting Y | NO — do not second-guess. Trust the declaration. |
| User declared "unknown" / "I don't know" | YES — user opted into observation. Surface inferred answer once after sufficient signal. |
| User manually clicks "re-detect" in Settings | YES — user explicitly requested re-analysis. |

Why this matters: the alternative (AI quietly comparing prose against
prior declarations and resurfacing "I think you're wrong about X") is a
form of surveillance over the writer's mind. It frames AI as a corrective
authority over the writer's self-knowledge. This violates the tool's
position as scaffolding/copilot rather than judge/coach.

The writer is the authority on their own work and intentions. AI's role
is to provide structural facts that support the writer's own judgment,
not to monitor whether the writer is "really" what they declared.

Practical consequence for situate.act late invocation: the retroactive
check (§A.9) compares scene against user's OWN declared segment function
— not against an AI-inferred function. AI never says "I think segment 1
should really be about X" when user declared Y. The scaffolding is
always user-declared.

Practical consequence for hybrid projects: the "consider splitting"
suggestion (Q6) is NOT proactively surfaced. It only appears in project
Settings when the user goes to look at it. Same logic — user declared
the drives per draft; AI doesn't override that with "I think you should
reorganize."

---

## Effect on existing methodology sections

If §3 extension + §15 invariant 6 + §18 are approved as drafted, the
following existing sections need follow-up edits:

- **§10 (Project Map)**: Re-scope to "art-purposeful projects only".
  Other drives have different project-level anchors (haunting_image,
  intent + media goal, none).
- **§11 (Two Crafts)**: Note that the architecture craft (situate.map)
  serves only art-purposeful drive; the cultivation craft (situate.at)
  serves all four drive types.
- **§13 (Forbidden)**: Add: "AI suggests one drive type is more serious or
  one media goal is more artistic."
- **§14 (Permitted)**: Add:
  - "AI surfaces drive-related observations as one-time prompts after sufficient signal accumulation."
  - "AI may surface category-level scaffolding (functional categories, constraint implications, frame tensions) that the user instantiates with material-specific content. See §18.9."
- **§17 (The Promise)**: Add a second promise alongside "I wrote every word":
  - **The tool promises clarity, not results.** It does not promise a publishable book, a sold book, a prize-winning book, or even a finished book. It promises that at every point in the process, the writer knows what they're doing and why. This is the only promise the tool can honestly make.

---

## Open questions still requiring decision

Resolved decisions (locked, kept here for historical traceability):

- **DQ1 — RESOLVED**: 3 independent drafts (chosen over 2 drafts / 5 drafts / prose word-count threshold). Cross-draft signal is more stable than within-draft. 3 is the smallest count that gives reliable signal. Threshold can be tuned later.
- **(Q-Vitality) — RESOLVED**: Option B — vitality keeps aggregation UI (5-signal readiness report) but removes the verdict label (vital / borderline / flat). Rationale: aggregation is a copilot view, not a verdict. The writer carries final responsibility; a glanceable summary serves the writer's judgment. See §3 extension "Aggregation is not verdict".
- **(Q-Naming) — RESOLVED**: `situate.act`. Confirmed naming for the third architectural layer (between map and at). Will also serve as a teaching/curriculum component.
- **(Q-SegmentRevision) — RESOLVED**: Option A — preserve old segment assignments when user revises segment count. New segments are blank; user manually drags any drafts that should move. Lowest user-surprise; doesn't force re-review.

Newly resolved decisions (locked):

- **DQ2 — RESOLVED**: AI does NOT proactively re-surface drive mismatches against declared drives. After initial observation (only for opt-in "unknown" drive type users), further re-detection only via user-clicked Settings button. Encoded in §18.3 (critical boundary) and §18.10 (Declaration vs Behavior principle).
- **DQ3 — RESOLVED**: Hybrid project "consider splitting" suggestion is NOT proactively surfaced. Only visible when user enters project Settings. AI never overrides user's per-draft drive declarations with reorganization advice.
- **DQ4 — RESOLVED**: Yes, surface once as Socratic question when user declares 初心 + 媒介目标 with apparent tension. This fires at declaration moment (permitted) — not from subsequent behavior. See §18.10 distinction.
- **AQ1 — RESOLVED**: situate.act runs for both art-purposeful and commercial-purposeful. UI text adds one line: "If you write genre fiction, you may already be familiar with the structural conventions for your genre. You can use them to fill in the 4 estimates" — but NO specific genre templates listed (no thriller-3-act / romance-5-beat etc., as that would imply AI expertise the tool does not claim).

Final two resolved decisions (locked):

- **AQ3 — RESOLVED**: No diagnoser for v2.0. Segment assignment is user-declared. AI only surfaces distribution facts ("段 3 is empty" / "段 1 has 5 scenes, you said 4-5"). A `scene_belongs_to_segment` diagnoser may be added in v2.5 if user feedback shows segment-function-vs-scene drift is a real felt problem.
- **AQ4 — RESOLVED**: Bundle into single observation. At the moment when "unknown"-drive opt-in users hit 3 completed drafts, AI surfaces one combined observation covering both: inferred drive type + suggested act estimate path. Single interruption.

**All open methodology v2 questions resolved as of this point.** Document
is ready for canonization. See `missing-modules-v1.md` §B.0 for
canonization TODO.

---

## See also

- METHODOLOGY.md v1.0 (provided by user, not in repo)
- `methodology-v1.md` — diagnoser bank methodology (separate doc, kept)
- `situate-map-spec-v1.md` — currently scoped to art-purposeful; needs §18-driven revision
- `missing-modules-v1.md` — inventory items now reorganized under §18
- Aesthetic Neutrality audit (in conversation, end of May 2026)

---

*End of methodology-v2-draft.md. Awaiting user review and canonization.*
