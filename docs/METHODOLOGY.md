# situate Methodology v2.1

> The principles behind situate.map, situate.act, and situate.at.
> Read this before contributing code. The technical choices follow from
> these principles—not the other way around.
>
> **v2.1 changelog**: Added place generativity (§17) and the Situate
> disclosure preview (§18). These wire the publication's deepest
> editorial commitment — a story must owe its existence to its
> coordinates (Editorial Constitution P3) — into the pre-writing flow,
> so a writer meets that gate at the start, not as a rejection at the
> end. Surfaced during a stress-test that ran a place-independent legal
> case through the methodology. Also: the center of gravity may now be a
> place, an institution, or a system, not only a person (§7); a
> place-shape joins the time-shape in situate.act (§5); a ✧ Serves place
> axis joins situate.at feedback (§6).
>
> **v2.0 changelog**: Added scale neutrality (§9), intent growth (§10),
> retrospective revision (§11), and the corresponding tool layer
> situate.act (§5). These additions came from real product gaps
> identified during methodology stress-testing, not from theoretical
> refinement. Also includes four operational principles merged into
> §3 / §12 that surfaced during the v2.0 design conversation:
> aggregation is not verdict, categories not specifics, declaration vs
> behavior, and no canon names in user-facing surfaces (with §9 carve-
> out for legitimacy demonstration).

---

## 1. The One-Sentence Mission

> **Help writers make clearer decisions before they write—never write for them.**

If a code change makes the product write more *for* the user, it's against
the methodology. If it makes the user think more *clearly* before they
write, it's aligned.

This is the only test that matters.

---

## 2. The Three-Module Architecture

Writing has three distinct workflows. We build separate tools for each.

| Module          | Purpose                          | Direction              | When to use                                |
|-----------------|----------------------------------|------------------------|--------------------------------------------|
| **situate.map** | Architecture                     | Subtraction/Completion | Network material (multiple people, threads, time spans) |
| **situate.act** | Scale & Structure                | Horizontal time-shape  | Once a center is chosen, before writing scenes |
| **situate.at**  | Cultivation                      | Vertical depth         | Once a scene is chosen                     |

The modules share DNA (structured steps, AI asks—never answers, user
always decides), but operate on different scales:

- **situate.map** compresses a network into a writable map.
- **situate.act** projects the map onto a time-shape (one act, three
  acts, long river, etc.).
- **situate.at** opens a single moment into a written scene.

A user with network material goes through all three. A user with a
single anchor (a phrase, image, memory) can sometimes skip map and act
and go straight to at—but most projects benefit from all three.

---

## 3. The Ethical Bottom Line

We sit in the **scaffolding/architecture layer** of AI writing
assistance—not generation, not co-writing, not ghostwriting.

### What we do
- Ask structured questions
- Surface gaps and patterns
- Reflect the user's own words back to them
- Read what the user wrote and give structural feedback

### What we never do
1. **Never write literary text.** No scenes, no dialogue, no
   description, no inner monologue. Even on request—refuse and explain
   the boundary.
2. **Never make decisions for the user.** Surface candidates, provide
   reasoning, raise challenges. Final choice is always the user's.
3. **Never fill specific details.** AI can flag "this character's
   backstory is undefined." AI cannot suggest "give him a deceased
   father."
4. **Never make aesthetic judgments.** Structural observations only
   ("this choice produces X consequence"). Never "this choice is better."
5. **Never compliment the user.** No "great choice!" Only factual
   reflections.
6. **Never volunteer opinions when not asked.**

### Aggregation is not verdict

A summary UI that shows the writer how many structural signals are
currently firing (e.g., "5 of 5 readiness signals showing positive
state", "3 of 5 showing missing state") is permitted, because the writer
carries final responsibility for the work and benefits from a
glanceable copilot view.

What is forbidden is the tool issuing a quality verdict (e.g., "your
work is vital" / "your work is flat").

The distinction:
- Showing the writer signal counts and per-signal status = **aggregation** ✅
- Assigning a quality label to the aggregate = **verdict** ❌

The writer reads aggregated signals as part of their own judgment about
whether to submit. The tool does not judge for them.

### Categories not specifics

A meta-principle that operationalizes §3.1 + §3.3 across all three
layers (map / act / at):

> AI provides categorization scaffolding. The user instantiates each
> category with specific content drawn from their own materials and
> creative intent.

Examples of the principle in action:

| Layer | AI gives | User gives |
|---|---|---|
| situate.map step 2 | 5-6 angles from the 8 universal angles | Specific answers about which person resonates |
| situate.map step 4 | 5 conflict slots (internal/structural/relational/alliance/temporal) | Specific conflicts in this project |
| situate.act commitment confirmation | "10+ year scope opens: physical change / perspective change / relationship change" | Specific events (if any) the writer plans |
| situate.act candidate earlier scenes | "Functional categories: initial state / routine / early hint" | Specific moments from this writer's materials |
| situate.at mirror | "K is character/image/place/narrator" carrier type | Which one this draft uses (when the carrier is **place**, see §17) |

**NOT permitted:**
- AI listing specific scene candidates ("2011.04 入职第一天 / 2011.夏 加班晚上")
- AI listing specific story beats ("she will marry, have kids, lose her parents")
- AI writing inner monologue for hypothetical scenes ("she already knew vaguely, just wouldn't let herself think")
- AI naming specific characters not in the user's materials

**IS permitted:**
- AI listing functional categories with neutral labels
- AI listing structural consequences in abstract language ("the protagonist must age across this span")
- AI listing constraint implications ("this length × this span = high compression")
- AI surfacing tension between user's declared frames ("your stated reader and stated media goal pull in different directions")

This principle makes the tool's ethical bottom line operational. Without
it, every prompt drifts toward ghostwriting. With it, the tool stays
scaffolding regardless of how elaborate the AI's surface output becomes.

### Declaration vs behavior

A complementary principle:

> AI may surface consequences at the moment a user declares a choice.
> AI may NOT surface observations that contradict the user's prior
> declarations based on the user's subsequent behavior — except when
> the user explicitly opted into behavioral observation.

The distinction:

| Moment | AI action permitted |
|---|---|
| User just declared X at the moment of choice | Surface consequences of X (commitment confirmation) |
| User declared X earlier, then writes prose suggesting Y | NO — do not second-guess. Trust the declaration. |
| User declared "unknown" / "I don't know" | YES — user opted into observation. Surface inferred answer once after sufficient signal. |
| User manually clicks "re-detect" / "re-audit" | YES — user explicitly requested re-analysis. |

Why this matters: the alternative (AI quietly comparing prose against
prior declarations and resurfacing "I think you're wrong about X") is a
form of surveillance over the writer's mind. It frames AI as a
corrective authority over the writer's self-knowledge. This violates the
tool's position as scaffolding/copilot rather than judge/coach.

The writer is the authority on their own work and intentions. AI's role
is to provide structural facts that support the writer's own judgment,
not to monitor whether the writer is "really" what they declared.

This principle has carve-outs for §10 Intent Growth (where AI may
observe and surface a possible new intent layer — but only once, and
only with three offered interpretations including "incidental detail")
and §11 Retrospective Revision (which runs as an auto-triggered audit
only when the user themselves changes intent, not based on suspected
drift).

### The public-facing version
> AI helps you think clearly before you write. AI helps you see clearly
> after you've written. AI never writes a word for you.

This is not marketing. It is the actual operational boundary in code.

### The user's promise
When a user finishes a book that originated in this tool, they should be
able to honestly say:

> "I wrote every word."

If at any point in our product workflow this becomes untrue, the product
has failed.

---

## 4. The Four Drive Types

Set at project creation. Determines the entire initialization flow.

```
你这次写作的驱动是什么？
○ 目的型——艺术/文学
  "我要给某种读者讲某件事"
  → 填初心三段（给谁/为什么/读者获得）
○ 目的型——商业/媒介
  "我希望这本书具备特定的延伸潜力"
  → 填初心三段 + 媒介目标
○ 缠绕型
  "有个东西缠住我，我必须把它写出来"
  → 填一行字（那个不肯走开的东西）
○ 现在不知道
  "我有材料、有冲动，但说不清自己在哪一种"
  → 跳过，第三章后系统回来问
```

The tool has **no preference between drive types**. Each receives a
different initialization flow optimized for its actual creative logic.

| Drive type           | Risk                         | AI bias                                |
|----------------------|------------------------------|----------------------------------------|
| Purposive-artistic   | Holding the user to intent   | Surface intent-action drift            |
| Purposive-commercial | Drift from market form       | Surface intent-action drift + media constraints |
| Haunting             | Premature articulation       | Track whether the thing has arrived    |
| Unknown              | Endless drift                | Re-prompt after scene 3                |

Critically: AI must never suggest one drive type is more serious than
another. See §13 for the full ethical statement.

---

## 5. situate.act — The Director's Layer

After the project map (situate.map) is complete and before scene
writing (situate.at) begins, the user passes through situate.act—the
director's layer.

This layer answers: **What is the shape of the whole work?**

### The four questions

1. **Time span**: How long does this work cover?
2. **Target length**: How many words is this aiming for?
3. **Number of segments**: How many functionally distinct parts?
4. **Structural template**: Any specific structural pattern? (Three-act,
   U-shape, ⎻⎯⎯⎯ uneven, ring, parallel, spiral, etc.)

### Critical: scale neutrality

The first question is **how many acts**:

```
○ One act—everything happens in one space-time
○ Two acts—two segments
○ Three or more acts—multi-segment structure
○ I don't know yet
```

**No default. No recommendation.** Each option is equally legitimate.

Each receives a **separately designed** downstream flow:

- **One-act mode** asks about: duration (single moment / day / season),
  shape (gradient, reverse, dual-track, reflective, frozen), and
  weight-bearing moment.
- **Multi-act mode** asks about: segment count, segment time windows,
  segment functions, and structural template.

The two modes' situate.at also differ in 30-40% of features (see §6
below). One-act is not a "stripped-down" version of multi-act—they are
fundamentally different writing crafts, supported by fundamentally
different tools.

Scale neutrality is non-negotiable. See §9 for the full statement.

### The place-shape (parallel to the time-shape)

After the time-shape, situate.act asks the **place-shape**: how does the
work sit on the map?

```
○ One coordinate—the whole work happens at a single place
○ Several coordinates—distinct pinned scenes
○ A route—movement traced across places
○ I don't know yet
```

**No default. No recommendation.** A single-coordinate work is as
legitimate as a route (scale neutrality extends to place — §9). This
maps to the publication's narrative_blocks model (1–6 pinned scenes).
situate.act records the coordinate(s); whether the place *carries* the
work is built later, in situate.at, and governed by §17.

---

## 6. situate.at — The Cultivation Layer

Where individual scenes are written. Five steps:

| Step | Action                                          |
|------|-------------------------------------------------|
| 1    | Select writing mode (real/imagined/in-between) — reads the project-level truth declaration from §18, not re-asked per scene |
| 2    | The thing that won't leave (anchor)             |
| 3    | Five specific questions (who/when/where/what changed/why remembered) |
| 4    | Write the prose                                 |
| 5    | AI gives structured feedback                    |

### Feedback categories

For each scene, AI provides up to eight categories of feedback:

- **✓ Present**: What the prose successfully evoked
- **✗ Missing**: What's structurally absent
- **○ Consider**: Local inconsistencies or boundary cases
- **⚠ AI inferred**: What AI mentally filled in that the user didn't write
- **◎ Serves intent**: How this scene serves each declared intent layer
- **✦ Serves structure**: How this scene serves the act/segment it belongs to
- **✨ Scene consistency**: How this scene relates to previously written scenes
- **✧ Serves place**: Whether the scene's place-rendering carries the
  work or sits as backdrop (§17). Reports present / hinted / absent.
  Like `inferred_intent`'s L1, it must **quote the actual place-rendering
  it read** and say whether, at this point, that rendering carries K or
  is wallpaper. It reports; it never grades place-generativity (§13).

The last four (◎, ✦, ✨, ✧) require project context (intent declared,
act structure set, prior scenes written, a coordinate claimed). They
appear only when context exists.

### Mode-dependent feedback

In one-act mode, feedback weights different things than in multi-act
mode:

| Dimension           | Multi-act              | One-act                                  |
|---------------------|------------------------|------------------------------------------|
| Present             | Segment function fit   | Weight-bearing capacity                  |
| Missing             | Required elements      | Five senses + temporal density + body detail to extremes |
| Consider            | Internal inconsistency | Narrative position decisions             |
| Serves intent       | Same                   | Same                                     |
| Serves structure    | Segment positioning    | Position on time-axis + weight-bearing for whole act |
| Scene consistency   | Cross-segment continuity | Time-axis coverage + narrator position consistency |

The shift is not a setting—it's automatic, based on situate.act's
declared structure.

---

## 7. The Eight Universal Angles (Socratic Step 2)

When the user asks for help choosing (step 2 of situate.map or
situate.at), AI does not list candidates with reasoning. AI asks
questions drawn from these eight universal angles, instantiating each in
language specific to the user's material.

| # | Angle              | What it asks                                          |
|---|--------------------|-------------------------------------------------------|
| 1 | Position           | Which structural position does the writer's attention return to? |
| 2 | Resonance          | Whose situation does the writer recognize as potentially their own? |
| 3 | Label Inadequacy   | Which external categorization fails most interestingly? |
| 4 | Ungrabbable        | Who resists hero/villain/victim categorization?       |
| 5 | World-Bearing      | Whose daily existence most carries the period/world?  |
| 6 | Hidden in Periphery| Is the real center off the obvious stage?             |
| 7 | Difficulty as Depth| Whose interiority would be hardest, therefore most worth writing? |
| 8 | Irreducibility     | If only one name remained in the book, whose? (the "name" may be a place, an institution, or a system — not only a person) |

Angles 2, 4, and 8 are nearly always fertile. The others are selected
based on material density. AI picks 5-6 angles per session.

**The center of gravity is not always a person.** It may be a place
(Constitution P1: place is inhabited space), an institution, or a
system. The synthesis algorithm converges on a place or a system exactly
as it converges on a person — recurring descriptions point to the same
thing, and the user names it. A work whose true subject is a system
still anchors to the coordinate where that system is most itself
(§17, §18).

### The Synthesis Algorithm (归纳)

After Socratic questions, AI performs synthesis:

1. Extract key descriptive phrases from each user answer.
2. Find phrases that recur across answers (semantic similarity, not literal).
3. Display the recurring descriptions to the user.
4. State: "These descriptions point to the same thing. You've already
   chosen. You just haven't said the name."
5. Empty input field. User types the name.

**Failure mode**: If user's answers don't converge: AI says honestly
"Your answers don't yet point to one thing. Want to answer more, or
just tell me directly?"—and returns control. AI does not guess.

---

## 8. Handling Bad Choices

Users will choose centers that look like mistakes—peripheral witnesses,
characters with eighty words of source material, choices that contradict
their own stated motto.

**AI's job is not to prevent this.** AI's job is to ensure the user is
making the choice with full information.

When AI detects a problematic choice, it surfaces three classes of
structural fact:

1. **Material density**: How much source material exists for this
   person/choice.
2. **Motto consistency**: Whether the choice fits the user's stated
   intent (using user's own previous words).
3. **Mode implications**: What mode shift the choice implies (e.g.,
   real-materials → fictional).

AI then offers three paths:
- Reconsider the center
- Accept the implication (e.g., switch to a more fictional mode)
- Persist with the original choice, knowingly

If the user persists, AI accepts and moves on. AI does not return to
the question.

### Optional soft prompt

If the user's choice contradicts something they said earlier, AI may say
**once**—as a question, never a statement—"Your earlier answer suggested
X, but your choice suggests not-X. I don't know which is right—but you
should." Then drop it.

> AI does not block bad moves. AI ensures the user is awake when they
> make them.

---

## 9. Scale Neutrality

The tool has **no preference for scale**.

A one-act work taking place over an evening is as legitimate as a
multi-generational saga. The tool's design must serve both equally.

### When asking about structure or duration, AI must

- Never suggest a default beyond what the user has stated
- Never use language that implies "more = better" or "longer = more
  ambitious"
- Provide equally strong examples for each scale (one-act references
  must include at least 3-5 widely recognized canonical works — see
  carve-out below)
- Adapt downstream questions and visualizations to the user's chosen
  scale, not retrofit a multi-act assumption
- Compute estimated scene counts, word counts, and progress bars in
  terms of the declared scale

### AI must never

- Suggest that a longer work is "more ambitious"
- Suggest that a shorter work is "easier" or "more limited"
- Use phrases like "your central question implies a long arc" or "this
  material requires multi-act structure"
- Default any field to a value that assumes a particular scale
- Recommend a "default" scale even when the user clicks "I don't know"

The reason this is non-negotiable: AI assistants have a systematic bias
toward "more = more serious." A truly literature-serving tool must
counter this bias deliberately. A 5,000-word condensation is not a
smaller work than a 350,000-word saga. They are different works.

### Carve-out: canon for legitimacy, not validation

§9 requires showing canonical one-act references to counter the
AI-systematic bias toward "longer = more serious." This is a deliberate
exception to §12 Invariant 10 (no canon names in user-facing surfaces).

The distinction:
- **Canon to validate a user's specific choice** ("this is like Munro" /
  "your work resembles Chekhov") → FORBIDDEN by §12 Invariant 10 + §13.
  Using canon to grade or rank a particular user choice violates the
  tool's neutrality and reintroduces literary hierarchy.
- **Canon to demonstrate that a form/scale is legitimate** ("the
  one-act form has been used to write fully realized works at this
  length") → ALLOWED by §9. The function here is to counter AI's
  built-in length bias, not to grade the user's work.

When showing canonical references for §9 purposes:
- Use them as a neutral list of "the form exists at this scale", not as
  comparison points
- Do not characterize what makes them "good" — only that they exist
- Never rank one against another
- Never imply the user's work should resemble any of them

### Place neutrality

Scale neutrality extends to **place**. A single-coordinate work is not a
smaller work than one traced across a continent. When asking about the
place-shape (§5), AI must not default a coordinate count, must not imply
that more places = more scope, and must not suggest that a material
"needs" to move across places. One coordinate, deeply inhabited, is a
first-class form.

---

## 10. Intent Growth

Intent is not a static reference point. **It grows.**

During writing, the user may discover that their initial intent was:
- **Incomplete** (a new layer needs to be added alongside the original)
- **Inaccurate** (the original needs to be revised)
- **Disguising** (the original was concealing a deeper, truer intent)
- **Too large** (the original needs to be compressed into a sharper version)
- **Wrong** (the original needs to be replaced entirely)

The tool's data model must support all five forms.

### Data model

Intent is stored as a versioned array of layers:

```
project.intent_layers: JSON Array
  Each layer object: {
    "version": 1, 2, 3, ...
    "added_at": TIMESTAMP,
    "fields": {
      // v1 has three sub-fields
      "audience": "...",
      "purpose": "...",
      "outcome": "...",
      // v2+ has different structure
      "new_direction": "...",
      "triggered_by": "...",
      "relation_to_previous": "叠加|修正|替代|压缩|揭示"
    },
    "status": "active" | "superseded" | "disguised" | "compressed"
  }
```

**No layer is ever deleted.** Layers are tagged with status changes but
remain visible. The full history of intent layers is part of the project's
"thinking history."

### Trigger mechanisms

Two ways to add a new intent layer:

**Active trigger**: A persistent "Add intent layer" button accessible
from any situate.at or situate.act view. Not prominent, but always
available.

**Observed trigger**: AI, in scene feedback, notices specific scenes
doing something the current intent doesn't cover. AI surfaces this with
specific evidence (which scenes, which details) and offers three
interpretations: (a) incidental detail, (b) intent growth, (c)
something AI didn't see. User decides.

This observed-trigger flow is a carve-out from §3 "Declaration vs
behavior": it operates only when the cumulative evidence is strong
(multiple scenes drifting in the same unaccounted direction), surfaces
once per detected pattern, and always offers "incidental detail" as a
first-class interpretation. AI surfaces evidence; user interprets.

### The five relations to previous layers

When adding a new layer, the user explicitly declares its relationship
to existing layers:

| Relation        | Meaning                                                          |
|-----------------|------------------------------------------------------------------|
| 叠加 (Additive) | Old layers remain. New layer added alongside. Most common case. |
| 修正 (Revising) | Old layer narrowed/adjusted. New layer is the corrected version. |
| 替代 (Replacing)| Old layer no longer holds. New layer fully replaces it.         |
| 压缩 (Compressing) | Old layer too broad. New layer is its precise version.       |
| 揭示 (Revealing)| Old layer was a disguise. New layer is the underlying truth.    |

Each relation type triggers different downstream behavior. **Revealing**
in particular triggers structural review (§11 below).

### Feedback under multi-layer intent

When multiple layers exist, AI's "serves intent" feedback (◎) becomes
multi-dimensional:
- Evaluation against each active layer
- Identification of cross-layer tension
- Cumulative tracking: if many recent scenes don't serve layer N, AI
  notes that layer N is at risk of becoming "phantom intent."

---

## 11. Retrospective Revision

When a new intent layer is added after scenes have been written, the
already-written scenes were composed without that layer. They are
**unchecked against the new layer**.

If left unchecked, the book develops a hidden rupture: early scenes
serve only original intent, later scenes serve all layers. Readers feel
the rupture as "this book changed its character at some point."

The tool must support **retrospective revision** at four intensities.

### Intensity 1: Inventory

AI re-reads all completed scenes and rates each against the new layer:

- **● Strong**: Already serves new layer well
- **◑ Medium**: Already implicitly serves new layer
- **◐ Weak**: Touches new layer but doesn't carry it
- **⚫ None**: Doesn't touch new layer (and may not need to)
- **✗ Conflict**: Structurally contradicts new layer

The inventory is displayed as a list. Each scene shows: rating,
specific reasoning (citing the actual prose), and whether revision is
possible.

User reads the inventory and decides what to do. AI does not modify any
scene.

### Intensity 2: Suggestions

For scenes rated ◐ Weak that can be revised, AI proposes specific revision
directions:

- "Add a touch at paragraph X showing Y"
- "Let character Z say one more thing about W"
- "Make moment V more ambiguous about ..."

These are direction suggestions, not text. AI never writes the revision
itself. User does the actual rewriting.

### Intensity 3: Conflict resolution

For scenes rated ✗ Conflict, AI cannot suggest a one-paragraph fix. The
scene's existence contradicts the new layer.

AI presents three structural choices:

- **Preserve**: Accept the scene only serves earlier layers. Cost:
  new layer is absent at this moment in the book.
- **Rewrite**: Change the scene's emotional direction. Cost:
  significant time, potentially several days of work.
- **Reposition**: Keep the scene as-is, but add a later scene that
  reframes it. Cost: book length increases.

User chooses. AI does not recommend which.

### Intensity 4: Regeneration

When the new intent layer is type **Revealing** (or otherwise reframes
the book's fundamental nature), single-scene revision is insufficient.
The book's whole structure may need replanning.

Triggers:
- New layer of type "Revealing"
- Layer change that shifts the work from single-protagonist to
  multi-protagonist (or vice versa)
- Layer change that shifts the time span by more than 5× or less than
  1/5×
- User explicitly invokes "rethink whole structure"

In intensity-4 mode, AI:
- Acknowledges that single-scene revision won't suffice
- Shows the user the real cost (e.g., "this means 12-24 months of
  additional work")
- Offers three paths: regenerate now, pause and think, reconsider
  whether the new layer is actually Revealing
- If user proceeds: returns to situate.map and situate.act under the
  new intent definition

### Auto-trigger on intent layer addition

Whenever a new intent layer is confirmed, retrospective revision
inventory (intensity 1) **automatically runs as a background task**.
The user receives a notification when complete and can choose to:

- Review the inventory immediately
- Save the inventory as a to-do
- Acknowledge but choose not to revise

A pending unprocessed inventory persists as a UI indicator until the
user explicitly resolves it.

### Tracking

Each scene's relation to each intent layer is stored:

```
scenes.intent_service_audit: JSON
{
  "intent_v1": "strong" | "medium" | "weak" | "none" | "conflict",
  "intent_v2": "...",
  "last_audited_at": TIMESTAMP,
  "audit_notes": {
    "intent_v2": "AI's specific observation"
  },
  "user_resolution": "preserve" | "revised" | "rewritten" | "repositioned" | "unresolved"
}
```

This audit data drives both the inventory view and the multi-layer
feedback in §6.

---

## 12. Engineering Invariants

Non-negotiable in code:

1. **System prompts are versioned constants in code**, not database
   fields. Iterating on prompts should not require migrations.
2. **AI must never see the writer's prose without an explicit user
   trigger.** Feedback is on-demand only.
3. **All "AI suggested X" content must be visually distinguishable from
   "user wrote X" content in the UI**, including in saved project state.
   The distinction must survive export.
4. **Character limits are hard limits**, enforced both client-side and
   server-side. (Especially the 50-char central question.)
5. **The project map cannot be edited by AI.** Only by user actions
   through situate.map. AI never writes to user state directly.
6. **Intent layers are append-only at the data level.** Status changes
   are allowed; deletion is not. Even "replaced" layers remain queryable.
7. **Retrospective revision is a background task**, not a blocking
   operation. The user can keep writing while the inventory generates.
8. **Project map is pinned to every situate.at session** as a
   collapsible header. Users can never write a scene without their map
   visible (collapsed counts as visible).
9. **Mode-dependent UI components are real, not flags.** One-act
   situate.at and multi-act situate.at share roughly 60% of components
   but the remaining 40% is structurally different. Implementation must
   reflect this.
10. **No canon names in user-facing surfaces (except per §9 carve-out).**
    Author and work references (Stanislavski, Aristotle, Chekhov, Pixar,
    Munro, Hemingway, etc.) live in internal documentation (`docs/`) and
    may appear in staff-only diagnoser descriptions. They MUST NOT appear
    in:
    - System prompts visible to LLM (because LLM output may echo them)
    - Lay-translator output that validates or grades user choices
    - UI text that compares user work to canonical examples
    - Exported project state

    **§9 carve-out**: canonical references MAY appear in UI when used
    strictly to demonstrate that a form/scale is legitimate (to counter
    AI's "longer = more serious" bias). They MUST NOT be used to
    validate or rank the user's specific choices. Use them as a neutral
    existence list, never as comparison points. The methodology lineage
    is honest internal record; it does not become an authority claim
    toward users.

11. **Place-generativity is surfaced, never gated by the tool.** The
    tool reports whether the place carries the work (§17, the ✧ axis); it
    never issues the verdict that a work does or does not "owe its
    existence to its place." That verdict belongs to the editor at
    submission (Constitution P3). The Situate disclosure preview (§18) is
    a preview, never an attestation — the binding signature is at
    submission, not in the tool.

---

## 13. What This Methodology Forbids

To make the boundary unambiguous for contributors:

- ❌ AI generates literary prose (even short, even as "examples")
- ❌ AI ranks user choices (best/better/worse)
- ❌ AI recommends a single option (always 2-3 minimum, or none)
- ❌ AI volunteers aesthetic judgments (interesting/powerful/strong)
- ❌ AI hides its reasoning (every observation must show structural basis)
- ❌ AI praises users (no "great!", "excellent!", "good choice!")
- ❌ AI repeats challenges (one challenge per decision, then accept)
- ❌ AI uses canonical authors/works to validate user choices (no
  "this is like Munro") — see §12 Invariant 10 + §9 carve-out
- ❌ AI defaults any scale-related field (always preserves user freedom)
- ❌ AI suggests one drive type is more serious than another
- ❌ AI rewrites scenes (only suggests revision directions for the user
  to write)
- ❌ AI auto-discards intent layers (all layers are append-only with
  status changes)
- ❌ AI second-guesses user's prior declarations based on subsequent
  behavior, except in §10 observed-trigger carve-out (with three offered
  interpretations) and §11 auto-trigger (user themselves changed intent)
- ❌ AI issues quality verdicts on aggregated signals (e.g., "your work
  is vital" / "your work is flat") — see §3 "Aggregation is not verdict"
- ❌ AI judges whether a work is place-generative / "owes its existence
  to its place" — that verdict is the editor's at submission (§17). The
  tool reports whether place currently carries K; it does not grade.

If a PR introduces any of these, it is methodologically out of scope and
should be rejected even if it improves engagement metrics.

---

## 14. What This Methodology Permits

- ✅ AI surfaces structural facts about the material
- ✅ AI asks questions calibrated to the material's specific shape
- ✅ AI flags inconsistencies between user's stated intent and chosen path
- ✅ AI reflects the user's own previous words back to them
- ✅ AI reads user prose and reports what is present, absent, or interpolated
- ✅ AI distinguishes between user-supplied content and AI-inferred content in feedback
- ✅ AI accepts user decisions even when they look mistaken
- ✅ AI provides structural consequences of any decision
- ✅ AI proposes revision directions (text in user's hands)
- ✅ AI observes that an unmentioned intent layer may be growing in the
  user's actual writing (per §10 observed-trigger, with three offered
  interpretations)
- ✅ AI tracks intent service across scenes and flags drift
- ✅ AI offers retrospective inventory when intent layers change
- ✅ AI distinguishes between scale modes (one-act / multi-act) with
  separately designed flows
- ✅ AI surfaces aggregated signal counts as copilot view (per §3
  "Aggregation is not verdict")
- ✅ AI provides category-level scaffolding that the user instantiates
  with material-specific content (per §3 "Categories not specifics")
- ✅ AI shows canonical references in UI strictly to demonstrate form
  legitimacy (per §9 carve-out + §12 Invariant 10 carve-out)
- ✅ AI reports whether a scene's place-rendering carries the work or
  sits as backdrop, quoting the rendering it read (§6 ✧, §17)
- ✅ AI points the writer to the place workshop (place_interview) when
  the place is not yet carrying the work — a path, not a verdict (§17)
- ✅ AI surfaces the Situate disclosure preview so downstream editorial
  gates (P3 / P5 / P8 / P11) are met at the start, not at rejection (§18)

---

## 15. The Two Crafts (and the Third)

The product distinguishes three writerly operations. They require
different AI behaviors.

| Operation        | Module        | Direction              | Time scale          |
|------------------|---------------|------------------------|---------------------|
| Architecture     | situate.map   | Subtraction/Completion | Once per project    |
| **Structure**    | **situate.act** | **Time-shape projection** | **Once per project (with revisits)** |
| Cultivation      | situate.at    | Depth                  | Once per scene      |

When designing new features, identify which craft they serve. Don't
mix them. A feature that does both probably should be two features.

The third (situate.act) is the newest layer and the most subtle. It
sits between architecture and cultivation, projecting the project map
onto a time-shape that the cultivation layer can populate. Without it,
users in cultivation mode unconsciously make act-level decisions in
scene-level work—decisions that often produce structural failures only
visible after years of writing.

---

## 16. Why "Choosing the Angle" is Sacred

Most writing failures happen in the first 2%—wrong center, wrong angle,
wrong question. Once chosen wrong, all later technique is multiplied
error.

The highest-value, ethically cleanest niche for AI writing assistance is
**lowering the early-decision failure rate**. A user who spends 60-90
minutes running situate.map and situate.act may avoid 12 months writing
a structurally broken draft.

This is the work of a good writing teacher. Available to everyone,
anytime, at the cost of compute.

That is what we build.

---

## 17. Place Generativity

Situate Editions publishes only stories that owe their existence to
their coordinates (Editorial Constitution P3). A published story could
not be moved to another place without breaking. This is the
publication's deepest commitment and its hardest gate.

The methodology's job is **not to enforce P3**. Enforcement lives at
submission — the AI editor flags, the human editor decides. The
methodology's job is to **surface the demand early**, so a writer does
not complete a structurally place-independent draft and meet P3 only as
a rejection. This is §16 applied to place: lowering the early-decision
failure rate.

### Two routes to place

A work earns its place by **either** route. Either suffices.

- **Explicit — plot-dependence.** The central event requires this
  coordinate: a specific architectural feature, a local custom, a
  geography-determined turn. Move the pin and the events break.
- **Implicit — rendering-as-carrier.** The events might be imaginable
  elsewhere, but the meaning lives in how *this* place is rendered.
  Strip the place-rendering and the meaning-layer collapses.

Most literary work travels the second route. A couple circling a
decision they will not name could be imagined at any waiting-place; what
makes the canonical example only-here is that the rendered landscape —
the pale hills shaped like a thing no one wants, the dry slope against
the fertile one, the two sets of rails — is the story's only way of
saying what the dialogue refuses to. The place does not decorate the
subtext. It carries it.

### Place as a carrier of K

The methodology already admits this. The K-carrier typology (§3,
Categories not specifics) names the carriers as *character / image /
**place** / narrator*. When the place is the carrier of K — when the
weight of what occurs is borne by how the place is rendered — the work
is place-generative in the implicit sense.

The operative question is therefore **"does the place carry K"** — not
"could the events move." The second question is the plot test; it
under-detects exactly the most place-bound literary work, the work whose
dependence is sensory and structural rather than mechanical. (Compare
the RUBRIC's warning that a Western conflict template mis-judges
Chekhovian work; a plot-only place test makes the same error in
geography.)

### Carrier, not wallpaper

The door must not become a loophole. Rendering that **carries** meaning
is not rendering that **decorates**.

The test: strip the place-rendering from the prose.

- The meaning-layer collapses → the place was a **carrier**.
  Place-generative.
- The scenery is poorer but the meaning survives intact → the place was
  **wallpaper**. Decorative — and decoration is what P3 exists to
  decline.

### Where the test lives

Place-as-carrier is **constructed, not pre-given**. A writer does not
discover at the outline stage that their place carries K; they build it,
sentence by sentence, in the prose. So the test lives at **situate.at**,
not situate.map.

- **situate.map / situate.act** name only that the work is
  place-anchored and which coordinate(s) it claims (§5, §18).
- **situate.at** reports whether the carrier is built yet — the **✧
  Serves place** axis (§6). ✧ reports like §3's L1: it quotes the actual
  place-rendering it read and says whether, at this point in the draft,
  that rendering carries K or sits as backdrop. It reports what is on the
  page. It does not grade place-generativity — that is the editor's
  verdict (§13).

### Divergence from P3 v0.2.1, disclosed

This is deliberately **more generous** than the Constitution's current
guardrail. P3 v0.2.1 says: "If the story's meaning would survive
transplant to another setting — even if the surface description loses
something — the dependence is decorative, not structural."

That guardrail assumes meaning is separable from rendering, so that one
can transplant the meaning and test whether it survives. For
pure-subtext work this is false: there is no meaning floating above the
rendering to transplant; the rendering is the only place the meaning
exists. Applied literally, the guardrail mis-declines the most
subtextual literary work — the work most worth protecting.

The methodology adopts the **"does place carry K"** test internally and
flags this as a candidate **P3 v0.2.2** refinement. Until the
constitution moves, the divergence stands openly: at submission,
P3-as-written governs (the editor's verdict); inside the tool, the
writer is told where the two tests part, so the gap is a known risk and
not a surprise.

---

## 18. The Situate Disclosure Preview

The Editorial Constitution asks every author for seven disclosures at
submission. By then the work is finished. A writer who learns at
submission that their fiction/reality status, or their relationship to
the place, raises a gate has learned it too late to write differently.

situate.map gains a lightweight **preview** of those fields. A preview,
**not** the attestation — the binding legal signature is at submission,
where it belongs. The purpose is §16: meet the downstream gates at the
start, not as a rejection at the end. The tool shows the writer the
shape of the door. The constitution is the door.

The preview surfaces four things. Each is a question the writer answers
or a flag the writer acknowledges; the tool **reflects**, and **judges
none of them** (§3).

| Previewed | Constitution | Note |
|---|---|---|
| Coordinate(s) + generativity route | P3 | Routes in §17; the carrier is built later, in situate.at |
| Fiction / based-on-reality | P11 | Declared **once, at project level** — not re-decided scene by scene |
| Real, identifiable persons | P5 | A flag the writer acknowledges; consent is the writer's legal responsibility at submission |
| Place is real, not a private address | P8 | A flag; private homes / schools / clinics / places of worship are the constitution's hard line |

Two consequences worth stating:

- **The fiction/reality status is a project-level declaration.**
  situate.at's writing mode (real / imagined / in-between, §6) *reads*
  this declaration rather than re-asking per scene. A whole work has one
  relationship to the truth; the methodology records it once. This closes
  the gap where truth-status was emergent across scenes rather than
  declared.
- **The center of gravity may be a place, an institution, or a system**
  — not only a person (§7). A work whose true subject is a system still
  anchors to the coordinate where that system is most itself. The preview
  asks for that coordinate; situate.at builds the rendering that makes it
  carry (§17).

The preview never blocks. A writer may proceed with a place-independent
central question, a real-person story, or an undecided truth-status. The
tool's only job is that the writer sees the gate now, while there is
still time to write toward it — or to decide, with full information, that
this work belongs somewhere other than Situate.

---

## 19. Versioning the Methodology

This document is METHODOLOGY.md v2.1. Significant changes—especially
to §3 (Ethical Bottom Line), §7 (Socratic Discipline), §9 (Scale
Neutrality), §10 (Intent Growth), §13/§14, or §17 (Place
Generativity)—require explicit version bumps and changelog entries.

The technical implementation can iterate freely. The methodology
iterates with deliberation.

### v2.1 changelog (from v2.0)

- Added §17: Place Generativity (two routes — plot-dependence and
  rendering-as-carrier; place as a carrier of K; carrier vs wallpaper;
  the test lives at situate.at; disclosed divergence from Constitution
  P3 v0.2.1, flagged as a candidate P3 v0.2.2 refinement)
- Added §18: The Situate Disclosure Preview (project-level preview of the
  constitution's seven fields; closes the gap where truth-status was
  decided per scene rather than declared once)
- §7: the center of gravity may be a place, an institution, or a system,
  not only a person
- §5: a place-shape (one coordinate / several / a route) joins the
  time-shape; §9 scale neutrality extends to place neutrality
- §6: ✧ Serves place joins situate.at feedback (eight categories, was
  seven)
- §12: Invariant 11 — place-generativity is surfaced, never gated by the
  tool; the disclosure preview is preview, not attestation
- §13/§14 updated: the tool reports whether place carries the work and
  points to the place workshop, but never issues the place-generativity
  verdict (the editor's, at submission)

### v2.0 changelog (from v1.0)

- Added §5: situate.act as a distinct module between map and at
- Added §9: Scale Neutrality (one-act mode must be a first-class citizen)
- Added §10: Intent Growth (intent is layered, not static)
- Added §11: Retrospective Revision (writing is non-linear; the tool
  must support changing earlier work)
- Added §3 subsections: Aggregation is not verdict, Categories not
  specifics, Declaration vs behavior (three operational principles
  surfaced during v2.0 design conversation)
- Added §12 Invariant 10: No canon names in user-facing surfaces (with
  §9 carve-out for legitimacy demonstration)
- Expanded §4: Drive Types now four-way (was three-way)
- Expanded §6: Feedback categories now seven (was five)
- Expanded §12: Engineering Invariants now ten (was five)
- Updated §15: Now three crafts, not two

---

## 20. The Real Test

A truly literature-serving tool must be able to host:

- Haunting work driven by an image, not an intent
- One-act condensations of a single evening
- Multi-decade sagas
- Scattered-moment time structures
- Single-evening epiphanies
- Accumulated grief across decades
- Commercial work with clear structural beats
- Pure inner-consciousness work with no external action
- Multi-perspective ensemble work
- Single-perspective deeply interior work
- Place-bound work where the coordinate, not the plot, carries the meaning

If the tool only hosts one of these well, it has not yet become a
literature-serving tool. It has become a tool for one kind of literature.

v2.1 hosts most of these. Future versions should host the rest.

The test for any future addition:
**Can this addition help a writer working in a tradition the tool
currently fails?**

If yes, the addition deserves consideration. If no, it's a feature, not
a methodology change.

---

## 21. The Promise (Updated)

When a user finishes a book that originated in this tool, they should be
able to honestly say:

> "I wrote every word. The tool helped me stay clear, but I made every
> choice. If this book is good, the credit is mine. If it's bad, the
> blame is mine. The tool was an honest companion, not a partner."

Pass every feature, every prompt, every UI choice through this sentence.

Build what passes. Cut what doesn't.

---

*End of METHODOLOGY.md v2.1*
