# situate Methodology

> The principles behind situate.at, situate.act, and situate.map.
> Read this before contributing code. The technical choices follow from these principles—not the other way around.

**Status**: v2.0 (canonized end of May 2026). Extends v1.0 with three additions: Aesthetic Neutrality (§3 extension), Engineering Invariant 6 (§15), and the Drive and Goal section (§18). All inline v2.0 markers indicate additions or revisions from v1.0.

---

## 1. The One-Sentence Mission

> **Help writers make clearer decisions before they write—never write for them.**

If a code change makes the product write more *for* the user, it's against the methodology. If it makes the user think more *clearly* before they write, it's aligned.

This is the only test that matters.

---

## 2. The Module Architecture

Writing has distinct workflows. We build separate tools for each.

**v1.0 listed two modules. v2.0 confirms a third: situate.act, the director's view layer between architecture and cultivation. See §18.4a.**

| Module | Purpose | Direction | When to use |
|---|---|---|---|
| **situate.map** | Architecture | Subtraction / Completion | Network material (multiple people, threads, time spans) |
| **situate.act** *(v2.0)* | Director's view | Whole-book scale awareness | Between architecture and the first scene |
| **situate.at** | Cultivation | Depth | Once a single anchor is chosen |

The modules share DNA (AI asks—never answers, user always decides), but operate on different scales:

- **situate.map** compresses a network into a writable map.
- **situate.act** *(v2.0)* maintains the writer's awareness of the work's whole shape (time span, length, segments, structural template) through declared estimates.
- **situate.at** opens a single moment into a written scene.

A user with network material goes through situate.map first, then situate.act, then situate.at. A user with a single anchor (a phrase, image, memory) skips situate.map; depending on drive type they may also skip situate.act. See §18.4.

---

## 3. The Ethical Bottom Line

We sit in the **scaffolding/architecture layer** of AI writing assistance—not generation, not co-writing, not ghostwriting.

### What we do
- Ask structured questions
- Surface gaps and patterns
- Reflect the user's own words back to them
- Read what the user wrote and give structural feedback

### What we never do
1. **Never write literary text.** No scenes, no dialogue, no description, no inner monologue. Even on request—refuse and explain the boundary.
2. **Never make decisions for the user.** Surface candidates, provide reasoning, raise challenges. Final choice is always the user's.
3. **Never fill specific details.** AI can flag "this character's backstory is undefined." AI cannot suggest "give him a deceased father."
4. **Never make aesthetic judgments.** Structural observations only ("this choice produces X consequence"). Never "this choice is better."
5. **Never compliment the user.** No "great choice!" Only factual reflections.
6. **Never volunteer opinions when not asked.**

### Aesthetic Neutrality *(v2.0)*

The tool has no aesthetic preferences. It does not believe literary fiction is "higher" than commercial fiction, or intent-driven writing is "more legitimate" than haunting-driven writing. The user declares their drive type and media goal; the tool serves them within that frame.

AI must never:
- Suggest that one drive type is more serious
- Suggest that one media goal is more artistic
- Use language that implies a hierarchy between writing types
- Add unsolicited literary references that imply a "good" tradition

AI may:
- Describe the consequences of choices within the user's declared frame
- Surface conflicts between the user's stated goal and their current decisions
- Offer structural facts about how media markets typically work (only when relevant to a declared commercial goal)

**Platform positioning is separate.** Situate Editions is itself a magazine with a literary editorial identity. The platform's downstream service defaults to its own publication standards. Users may declare other media goals — these are accepted, but the platform does not pretend to offer expertise it does not have. Transparency about positioning is not a violation of neutrality. Disparaging other positions is.

**Aggregation is not verdict.** A summary UI that shows the writer how many structural signals are currently firing (e.g., "5 of 5 readiness signals showing positive state") is permitted, because the writer carries final responsibility for the work and benefits from a glanceable copilot view. What is forbidden is the tool issuing a quality verdict (e.g., "your work is vital" / "your work is flat"). The distinction:
- Showing the writer signal counts and per-signal status = aggregation
- Assigning a quality label to the aggregate = verdict
- Aggregation is permitted; verdict is forbidden under §3.4 + §13.

The writer reads aggregated signals as part of their own judgment about whether to submit. The tool does not judge for them.

### Scale Neutrality *(v2.0)*

The tool has no preference for scale. A one-act work that takes place over an evening is as legitimate as a multi-generational saga. The tool's design must serve both equally.

When asking about structure or duration, AI must:
- Never suggest a default beyond what the user has stated
- Never use language that implies "more = better"
- Provide equally strong examples for each scale
- Adapt downstream questions and visualizations to the user's chosen scale, not retrofit a multi-act assumption

AI must never:
- Suggest that a longer work is "more ambitious"
- Suggest that a shorter work is "easier" or "more limited"
- Use phrases like "your central question implies a long arc" or "this material requires multi-act structure"
- Default any field to a value that assumes a particular scale

Practical consequences:
- situate.act's 4 estimate questions must have NO default radio selection. All scale options start equal.
- AI consequence panels must show structural implications of EACH scale option, not just the "recommended" one. There is no recommended scale.
- The bird's-eye view component must adapt rendering to whatever scale the user declared (one-segment view vs multi-segment timeline) without retrofitting a multi-segment assumption onto single-segment work.
- The progress display ("1/22 scenes") only makes sense once the user has declared a total. If user said "I don't know", the display shows nothing scale-dependent.

### The public-facing version
> AI helps you think clearly before you write. AI helps you see clearly after you've written. AI never writes a word for you.

This is not marketing. It is the actual operational boundary in code.

---

## 4. The Five-Step Spine

situate.map and situate.at share a five-step shape:

| Step | situate.map (Architecture) | situate.at (Cultivation) |
|---|---|---|
| **1** | Pour in materials + select mode | Select mode (real / imagined / in-between) |
| **2** | Choose center | Anchor (the thing that won't leave) |
| **3** | Triple classification (core / background / noise) | Five specific questions |
| **4** | Rank five conflicts | Write the prose |
| **5** | One-sentence central question | AI gives four-category feedback |

The symmetry is intentional. A user who has used one module already knows the rhythm of the other.

**situate.act has a different shape** *(v2.0)* — four estimate questions (time span / target length / segment count / structural template), not a five-step DNA. The act layer's interaction primitive is "declared estimate maintained over time" rather than "guided five-step workshop." See §18.4a.

---

## 5. The Three Modes

Set at step 1 of situate.map and situate.at. Shifts the AI's questioning bias—not the structure.

| Mode | Material source | AI bias | Main risk |
|---|---|---|---|
| **A — Real materials** | Court records, news, interviews, memoir | **Subtraction.** Challenges over-inclusion. | Being held captive by what actually happened. |
| **B — Fully invented** | Pure fiction | **Completion check.** Flags relational gaps, rule contradictions, motivation blanks. | Under-construction; world doesn't cohere. |
| **C — Hybrid** | Real + significant invention | **Both, with attention to seams.** | Real-fiction joints failing to close. |

The mode never restricts what the AI can flag. It only adjusts what the AI emphasizes by default.

---

## 6. The Socratic Discipline

When the user asks for help choosing (step 2 of either module), AI does not list candidates with reasoning. AI asks questions that surface the user's own preference.

**Why this matters.** Listing candidates—even with neutral structural reasoning—shapes the user's possibility space. The user picks from AI's list rather than from the full field. This violates the bottom line in a subtle but real way.

**The Socratic alternative.** AI asks 5–6 questions drawn from a fixed set of universal angles (see §7). User answers in their own words. AI then performs *归纳* (synthesis): reflects the user's own repeated descriptions back to them, asks them to name the person/thing themselves.

The user names. AI never names.

---

## 7. The Eight Universal Angles

For step 2 of situate.map—and adaptable to other "choose" moments. AI selects 5–6 angles per session based on which are fertile given the material, then instantiates each angle in language specific to that material. The angles are constant. The questions are not.

| # | Angle | What it asks |
|---|---|---|
| 1 | **Position** | Which structural position in the material does the writer's attention return to? |
| 2 | **Resonance** | Whose situation does the writer recognize as potentially their own? |
| 3 | **Label Inadequacy** | Which external categorization fails most interestingly? |
| 4 | **Ungrabbable** | Who resists hero/villain/victim categorization? |
| 5 | **World-Bearing** | Whose daily existence most carries the period/world? |
| 6 | **Hidden in Periphery** | Is the real center off the obvious stage? |
| 7 | **Difficulty as Depth** | Whose interiority would be hardest, therefore most worth writing? |
| 8 | **Irreducibility** | If only one name remained in the book, whose? |

Angles 2, 4, and 8 are nearly always fertile. The others are selected based on material.

---

## 8. The Synthesis (归纳) Algorithm

After Socratic questions, AI performs synthesis with a fixed shape:

1. Extract key descriptive phrases from each user answer.
2. Find phrases that recur across answers (semantic similarity, not literal).
3. Display the recurring descriptions to the user.
4. State: "These descriptions point to the same person. You've already chosen. You just haven't said the name."
5. Empty input field. User types the name.

**Failure mode.** If user's answers don't converge: AI says honestly "Your answers don't yet point to one person. Want to answer more, or just tell me who you're thinking of?"—and returns control. AI does not guess.

---

## 9. Handling Bad Choices

Users will choose centers that look like mistakes—peripheral witnesses, characters with eighty words of source material, choices that contradict their own stated motto.

**AI's job is not to prevent this.** AI's job is to ensure the user is making the choice with full information.

When AI detects a problematic choice, it surfaces three classes of structural fact:

1. **Material density**: How much source material exists for this person/choice.
2. **Motto consistency**: Whether the choice fits the user's stated intent (using user's own previous words).
3. **Mode implications**: What mode shift the choice implies (e.g., real-materials → fictional).

AI then offers three paths:
- Reconsider the center
- Accept the implication (e.g., switch to a more fictional mode)
- Persist with the original choice, knowingly

If the user persists, AI accepts and moves on. AI does not return to the question.

**Optional soft prompt** (use sparingly, at most once per session): If the user's choice contradicts something they said earlier, AI may say once—as a question, never a statement—"Your earlier answer suggested X, but your choice suggests not-X. I don't know which is right—but you should." Then drop it.

> AI does not block bad moves. AI ensures the user is awake when they make them.

---

## 10. Project Map (situate.map Output)

**v2.0 scoping**: This section applies to art-purposeful drive projects. Other drives have different project-level anchors: entangled uses `haunting_image`, commercial-purposeful uses `intent + media_goal`, unknown defers until drive declared. See §18.4.

At the end of situate.map, generate a persistent `project_map` object:

```json
{
  "mode": "A" | "B" | "C",
  "center_person": "name",
  "motto": "one sentence: why I chose them",
  "core_circle": [{"name": "...", "function": "..."}],
  "background_circle": ["names..."],
  "noise_circle": ["names..."],
  "conflicts": {
    "internal": "...",
    "structural": "...",
    "relational": "...",
    "alliance": "...",
    "temporal": "..."
  },
  "central_question": "one sentence, ≤50 chars, must be a question"
}
```

This object persists with the project. Every subsequent situate.at session for this project:
- Renders the map as a pinned, collapsible header
- Pre-fills situate.at step 1 mode from `project_map.mode`
- Restricts character workshop suggestions to `core_circle`
- Adds a fifth feedback category in situate.at step 5: *服务于中心问题* (serves the central question)

---

## 11. The Crafts

The product distinguishes distinct writerly operations. They require different AI behaviors.

**v1.0 named two crafts. v2.0 names three** *(see §18.4a)*: Architecture (situate.map, serves art-purposeful only), Director (situate.act, serves all purposeful drives + opt-in for unknown), and Cultivation (situate.at, serves all four drive types).

| | Architecture (situate.map) | Director (situate.act) *(v2.0)* | Cultivation (situate.at) |
|---|---|---|---|
| **Operation** | Subtraction (real) / Completion (fiction) | Estimate maintenance | Depth |
| **Direction** | Horizontal—across the network | Whole-book scale awareness | Vertical—into a single point |
| **Time scale** | Once per project (revisable) | Estimates revisable anytime | Once per scene |
| **AI question types** | Structural, taxonomic | Categorical (size / shape / segments) | Specific, sensory, character-internal |
| **AI feedback after user input** | Network checks (size, coherence, gaps) | Structural consequences of declared estimate | Four-category prose feedback |

When designing new features, identify which craft they serve. Don't mix them. A feature that does both probably should be two features.

---

## 12. Why "Choosing the Angle" is Sacred

Most writing failures happen in the first 2%—wrong center, wrong angle, wrong question. Once chosen wrong, all later technique is multiplied error.

The highest-value, ethically cleanest niche for AI writing assistance is **lowering the early-decision failure rate**. A user who spends 15 minutes running situate.map may avoid three months writing a structurally broken draft.

This is the work of a good writing teacher. Available to everyone, anytime, at the cost of compute.

That is what we build.

---

## 13. What This Methodology Forbids

To make the boundary unambiguous for contributors:

- ❌ **AI generates literary prose** (even short, even as "examples")
- ❌ **AI ranks user choices** (best/better/worse)
- ❌ **AI recommends a single option** (always 2–3 minimum, or none)
- ❌ **AI volunteers aesthetic judgments** (interesting / powerful / strong)
- ❌ **AI hides its reasoning** (every observation must show structural basis)
- ❌ **AI praises users** (no "great!", "excellent!", "good choice!")
- ❌ **AI repeats challenges** (one challenge per decision, then accept)
- ❌ **AI references specific authors/works to validate choices** (no "this is like Munro")
- ❌ **AI suggests one drive type is more serious or one media goal is more artistic** *(v2.0)*
- ❌ **AI second-guesses user's prior declarations based on subsequent behavior** *(v2.0)* (see §18.10 Declaration vs Behavior)
- ❌ **AI defaults any scale field to a value that assumes a particular scale** *(v2.0 Scale Neutrality)* (no preselected "recommended" scale; all scales equal in UI)
- ❌ **AI implies one scale is more ambitious / more artistic / more limited than another** *(v2.0 Scale Neutrality)*
- ❌ **AI uses prior user choices to push toward a default scale** *(v2.0 Scale Neutrality)* (e.g., "your central question implies a long arc" — forbidden, even when factually plausible)

If a PR introduces any of these, it is methodologically out of scope and should be rejected even if it improves engagement metrics.

---

## 14. What This Methodology Permits

- ✅ AI surfaces structural facts about the material
- ✅ AI asks questions calibrated to the material's specific shape
- ✅ AI flags inconsistencies between user's stated intent and chosen path
- ✅ AI reflects the user's own previous words back to them
- ✅ AI reads user prose and reports what is present, absent, or interpolated
- ✅ AI distinguishes between user-supplied content and AI-inferred content in its feedback
- ✅ AI accepts user decisions even when they look mistaken
- ✅ AI provides structural consequences of any decision
- ✅ AI surfaces drive-related observations as one-time prompts after sufficient signal accumulation — only when user opted into observation (chose "unknown" drive) *(v2.0)*
- ✅ AI may surface category-level scaffolding (functional categories, constraint implications, frame tensions) that the user instantiates with material-specific content (see §18.9) *(v2.0)*
- ✅ AI may surface aggregated signal counts as a copilot view, never as a quality verdict (see §3 Aesthetic Neutrality extension) *(v2.0)*

---

## 15. Engineering Invariants

These are non-negotiable in code:

1. **System prompts are versioned constants in code**, not database fields. Iterating on prompts should not require migrations.
2. **AI must never see the writer's prose without an explicit user trigger.** Feedback is on-demand only.
3. **All "AI suggested X" content must be visually distinguishable from "user wrote X" content in the UI**, including in saved project state. The distinction must survive export.
4. **Character limits are hard limits**, enforced both client-side and server-side. (Especially the 50-char central question.)
5. **The project_map cannot be edited by AI.** Only by user actions through situate.map. AI never writes to user state directly.
6. **No literary canon names in user-facing surfaces** *(v2.0)*. Author and work references (Stanislavski, Aristotle, Chekhov, Pixar, Munro, Hemingway, etc.) live in internal documentation (`docs/`) and may appear in staff-only diagnoser descriptions. They MUST NOT appear in:
   - System prompts visible to LLM (because LLM output may echo them)
   - Lay-translator output
   - UI text
   - Exported project state

   Equivalent neutral phrasing must be used in user-facing surfaces. "Pixar but/therefore" becomes "事件之间的因果链条". "Stanislavski's given circumstances" becomes "角色 backstory 工作坊". The methodology lineage is honest internal record; it does not become an authority claim toward users.

---

## 16. Versioning the Methodology

This document is `METHODOLOGY.md v2.0`. Significant changes—especially to §3 (Ethical Bottom Line), §6 (Socratic Discipline), §13/§14, or §18 (Drive and Goal)—require explicit version bumps and changelog entries.

The technical implementation can iterate freely. The methodology iterates with deliberation.

### Version history

- **v1.0** (early May 2026): Initial articulation. Two modules (map + at). Implicit assumption that all writing is purposeful (intent-driven). Implicit literary-fiction bias in framing.
- **v2.0** (end of May 2026): Three additions to §3 ethics (Aesthetic Neutrality, Aggregation ≠ verdict, Scale Neutrality), Engineering Invariant 6 (no canon names in user-facing surfaces), Drive and Goal (§18 — two drives × optional media goal axis). Three architectural layers (added situate.act). Three new methodology principles: AI gives categories user gives specifics (§18.9), Declaration vs Behavior (§18.10), and the §3 Scale Neutrality clause. Promise extended (§17): tool promises clarity, not results.

---

## 17. The Promise

When a user finishes a book that originated in this tool, they should be able to honestly say:

> "I wrote every word."

If at any point in our product workflow this becomes untrue, the product has failed.

That sentence is the test. Every feature, every prompt, every UI choice—pass them through that sentence.

Build what passes. Cut what doesn't.

**v2.0 second promise**: alongside "I wrote every word," the tool makes a second commitment to the writer:

> **The tool promises clarity, not results.**

It does not promise a publishable book, a sold book, a prize-winning book, or even a finished book. It promises that at every point in the process, the writer knows what they're doing and why. This is the only promise the tool can honestly make.

The two promises together: ownership of the work, clarity in the process. Beyond these — whether the book is good, whether it sells, whether it lasts — is the writer's life and the world's response, not the tool's territory.

---

## 18. Drive and Goal *(v2.0)*

### §18.1 The two drives

Writing is moved by two fundamentally different forces. The tool serves both.

|  | Purposeful | Entangled |
|---|---|---|
| Origin | An intent (something to communicate to a reader) | An image / memory / sensation that won't leave |
| Direction | From writer toward future reader | From writer inward |
| Reader-consciousness | Strong | Weak or absent |
| Knows what they're writing | Yes, before writing | No — discovered through writing |
| What completion looks like | The intent is realized | The thing finally departs |

The v1.0 tool was built only for purposeful writing. Initial-intent fields (给谁/为什么/读者获得), situate.map's central question, situate.at's intent-tied feedback — all presuppose that the writer knows what they want.

This is not a defect that can be patched. It is a worldview that excludes a major literary register. v2 must support both drives natively, with the tool taking different shapes per drive — not the same flow with cosmetic adjustments.

### §18.2 The optional media goal layer

Orthogonal to drive type, every project may declare an optional **media goal** — where this work is intended to land.

- A purposeful project may declare a media goal (where it will be published).
- An entangled project may also declare a media goal — being haunted does not preclude wanting publication.
- An unknown-drive project may also declare one.

The media goal field is **freeform**. The tool does not impose a taxonomy. Default placeholder for first-time users: "Situate Editions" (the platform itself). Users may change to any other description in their own words. The tool does not validate or rank these declarations.

When a user declares a commercial-oriented media goal, the tool serves the writing process the same way but does NOT pretend to expertise in commercial positioning. AI may surface generic structural facts about how media markets work when explicitly relevant to the declared goal, but does not coach toward commercial success.

### §18.3 Drive detection and switching

Drive type is bound per draft (`storyDrafts.drive_type`), not per project. A project may contain drafts of different drives.

Drive type is set at three moments:

1. **Project creation entry** — user selects one of: purposeful / entangled / 现在不知道 (unknown). This becomes the default for the project's first draft.
2. **Per-draft override** — each new draft inherits but may override.
3. **AI observation** — for "unknown" drive type ONLY, AI observes the first 3 drafts and, when the signal is strong enough, surfaces a one-time prompt: "Your drafts suggest you may be writing in [X] drive. Want to confirm?"

The observation triggers after the writer has completed **3 independent drafts** (3 chosen as the smallest count that gives a stable cross-draft signal). The signal is computed from two sources:

- **k_carrier** (new field on `stakes_absent` diagnoser output): which kind of element carries K — `character` / `image_object` / `place_moment` / `narrator_self` / `diffuse`. Distribution across drafts indicates drive type:
  - 60%+ `character` → purposeful indicated
  - 60%+ `image_object` / `place_moment` / `narrator_self` / `diffuse` → entangled indicated
  - Mixed → keep observing
- **recurrent_image** (new cross-draft diagnoser): identifies images/moments/details that recur across multiple drafts in a way that suggests they are load-bearing for the writer (not just for any one story). If recurrence is strong, entangled drive is more likely.

**Critical boundary**: AI surfaces drive observations ONLY in two cases:

1. The user explicitly chose "unknown" drive at project creation (i.e., user opted into deferred observation). AI surfaces the inferred drive once, after 3 drafts.
2. The user manually requests re-detection via a Settings button.

AI does NOT proactively re-surface drive mismatches against drives the user has already declared. Once the user has answered the drive question, the answer is treated as authoritative — second-guessing it based on behavioral evidence would be a form of AI surveillance the methodology forbids.

See §18.10 (Declaration vs Behavior).

### §18.4 What each drive uses as its anchor

| Drive | Project-level anchor | Per-draft anchor | Goes through situate.map? |
|---|---|---|---|
| Purposeful (art) | 初心 (intent fields: 给谁/为什么/读者获得) | Scene anchor | Yes, when network material |
| Purposeful (commercial) | 初心 + 媒介目标 | Scene anchor | No — writer self-routes |
| Entangled | 那一行字 (haunting_image) | Scene anchor (often = the haunting itself zoomed in) | No — entangled writers wander, do not compress |
| Unknown | 那一行字 (provisional) | Scene anchor | No — defer until drive confirmed |

situate.map serves art-purposeful projects with network material. It does not serve commercial-purposeful (they have their own architecture methods), it does not serve entangled (compression destroys the purity of that drive), it does not serve unknown (the architecture would presuppose purpose). Routing logic at `/write` entry must respect this.

### §18.4a Three-layer architecture

The product is three layers, not two. They sit between project creation and scene-level writing:

| Layer | Operation | Direction | Output |
|---|---|---|---|
| situate.map | Network → core (subtraction/completion) | Horizontal across the network | project_map |
| situate.act | Core → timeline / segments / shape | Director's view of the whole | act_estimates |
| situate.at | Timeline point → prose (depth) | Vertical into one moment | draft |

situate.act maintains the writer's awareness of the work's whole-scale shape (time span, length, segment count, structural template) without forcing premature commitment. The writer declares **estimates** that can be revised at any time. AI flags structural consequences of the declared shape (e.g., "5万字 + 14 年时间跨度 = 大量时间被省略而不是叙述") without ranking which shape is better.

Per-drive defaults for situate.act:
- Purposeful (art / commercial): runs fully — 4 estimate questions
- Entangled: defaults to "我不知道" for all estimates; deferred ask after 3 completed scenes
- Unknown: skipped entirely until drive declared

### §18.5 Feedback differs by drive

The mirror stage at situate.at end-of-draft applies different framings:

| Drive | What AI compares prose against | 5th feedback category |
|---|---|---|
| Purposeful (art) | 初心 | 服务于中心问题 |
| Purposeful (commercial) | 初心 + 媒介目标 | 服务于初心 + 媒介目标对齐情况 |
| Entangled | 那一行字 | 那个东西出来了吗 |
| Unknown | (nothing yet) | (skipped until drive confirmed) |

Critical: for entangled drafts, the framing is "has the thing arrived" (召唤式) — never "did you achieve your purpose" (目的论式). A new diagnoser `the_thing_arrived` performs this judgment, with 3 tiers: arrived / partial / still_inside_writer.

### §18.6 Completion semantics

Each drive type completes differently. The "submit" button copy and project-state advancement language differs:

- **Purposeful**: "你的初心是 [...]。你认为这本书做到了吗？"
- **Entangled**: "你最初说不肯走开的东西是 [...]。这件事现在出来了吗？它还在缠你吗？"
- **Unknown**: "你的项目还没声明驱动。先选一个，或者直接判断'我已经写完了'。"

These phrasings shape the writer's psychological orientation toward completion. The difference is not cosmetic — it is the difference between finishing a task and finishing an exorcism.

### §18.7 User override is absolute

AI surfaces drive-related observations and completion signals. AI never:
- auto-switches drive type
- prevents submission based on AI completion judgment
- ranks one drive's completion as better

The user submits when the user decides. Per §9 + §17, the tool respects user agency including over completion judgment. The editor (or platform) decides what to publish; the writer decides what to submit.

### §18.8 What does NOT change regardless of drive

The §3 ethical bottom line is unchanged across all drives. In both purposeful and entangled modes:
- AI does not write literary text
- AI does not make decisions for the user
- AI does not fill specific details
- AI does not make aesthetic judgments
- AI does not compliment the user
- AI does not volunteer opinions when not asked

The drives change what the tool's framing serves. The discipline that governs how AI behaves under that framing is invariant.

### §18.9 Operational principle: AI gives categories, user gives specifics

A meta-principle that operationalizes §3.1 + §3.3 across all three layers (map / act / at):

> AI provides categorization scaffolding. The user instantiates each category with specific content drawn from their own materials and creative intent.

Examples of the principle in action:

| Layer | AI gives | User gives |
|---|---|---|
| situate.map step 2 | 5-6 angles from the 8 universal angles | Specific answers about which person resonates |
| situate.map step 4 | 5 conflict slots (internal/structural/relational/alliance/temporal) | Specific conflicts in this project |
| situate.act commitment confirmation | "10+ year scope opens: physical change / perspective change / relationship change" | Specific events (if any) the writer plans |
| situate.act candidate earlier scenes | "Functional categories: initial state / routine / early hint" | Specific moments from this writer's materials |
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

This principle is the engineering rule that makes the tool's ethical bottom line operational. Without it, every prompt drift toward ghostwriting. With it, the tool stays scaffolding regardless of how elaborate the AI's surface output becomes.

### §18.10 Declaration vs Behavior

A complementary principle:

> AI may surface consequences at the moment a user declares a choice. AI may NOT surface observations that contradict the user's prior declarations based on the user's subsequent behavior — except when the user explicitly opted into behavioral observation.

The distinction:

| Moment | AI action permitted |
|---|---|
| User just declared X at the moment of choice | Surface consequences of X (Commitment Confirmation) |
| User declared X earlier, then writes prose suggesting Y | NO — do not second-guess. Trust the declaration. |
| User declared "unknown" / "I don't know" | YES — user opted into observation. Surface inferred answer once after sufficient signal. |
| User manually clicks "re-detect" in Settings | YES — user explicitly requested re-analysis. |

Why this matters: the alternative (AI quietly comparing prose against prior declarations and resurfacing "I think you're wrong about X") is a form of surveillance over the writer's mind. It frames AI as a corrective authority over the writer's self-knowledge. This violates the tool's position as scaffolding/copilot rather than judge/coach.

The writer is the authority on their own work and intentions. AI's role is to provide structural facts that support the writer's own judgment, not to monitor whether the writer is "really" what they declared.

Practical consequence for situate.act late invocation: the retroactive check compares scene against user's OWN declared segment function — not against an AI-inferred function. AI never says "I think segment 1 should really be about X" when user declared Y. The scaffolding is always user-declared.

Practical consequence for hybrid projects: the "consider splitting" suggestion is NOT proactively surfaced. It only appears in project Settings when the user goes to look at it.

---

*End of METHODOLOGY.md v2.0*
