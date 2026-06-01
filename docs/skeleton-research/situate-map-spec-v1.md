# situate.map Spec v1

> The architecture module. Spec for the half of the product that doesn't exist yet.
> Status: spec only — zero code in repo at time of writing (end of May 2026).
> Drives from **METHODOLOGY.md v2.0** (canonical at `docs/METHODOLOGY.md`). Every section here cites the methodology section that authorizes it.
>
> **v2.0 Scope correction**: situate.map serves **art-purposeful drive only**. Per §18.4:
> - Purposeful (commercial): writers self-route, use intent + media_goal, skip situate.map
> - Entangled: writers wander; compression destroys the purity of that drive — skip situate.map
> - Unknown: defer until drive declared
>
> The `/write` entry routing logic must respect this. Network material alone does not route to situate.map — only `(network material) AND (drive = purposeful-art)`.

---

## 1. What this is

situate.map is the **architecture** module: takes network material (multiple
people, threads, time spans) and compresses it into a writable map. Output
is a `project_map` JSON object that persists across all subsequent writing
sessions for the same project.

**v2.0 architecture context** (§18.4a): the product is three layers, not two.

| Layer | Operation | Once per | Currently exists? | Output |
|---|---|---|---|---|
| **situate.map** | Network → core (subtraction/completion) | Project | **No** | `project_map` |
| **situate.act** | Core → timeline / segments (director's view) | Project (revisable) | **No** | `act_estimates` |
| **situate.at** | Timeline point → prose (cultivation) | Scene | Yes (`/write/guided` + 2 others) | `storyDrafts` row |

situate.map and situate.at share a 5-step DNA per METHODOLOGY §4. situate.act has a different shape (4 estimate questions) per §18.4a.

The TODO doc `missing-modules-v1.md` lists P1.1, P1.2, P1.3, P1.4, P1.5,
P1.7, P1.8, P1.9, P1.10, P1.12 as atoms. **They are not atoms.** They are
the parts of this one module. This spec consolidates them.

---

## 2. Methodology boundary (what map must obey)

Every implementation decision passes the §1 test: "make the user think more
clearly before they write, never write for them."

Specifically map must NOT (METHODOLOGY §13 v2.0):
- generate literary prose (no "example scene", no sample passage)
- rank user choices (no "this center is better")
- recommend a single option (always 2-3 minimum, or none)
- volunteer aesthetic judgments
- praise users
- repeat challenges (one challenge per decision, then accept)
- reference specific authors/works to validate choices in user-facing surfaces (§15 invariant 6)
- suggest one drive type / media goal is more serious or artistic (v2.0)
- second-guess user's prior declarations based on subsequent behavior (v2.0 §18.10)
- default any scale field to a value that assumes a particular scale (v2.0 §3 Scale Neutrality)
- use prior user choices to push toward a default scale (Scale Neutrality)

map MUST (METHODOLOGY §14):
- surface structural facts about the material
- ask questions calibrated to the material's shape
- flag inconsistencies between user's stated intent and chosen path
- reflect user's own previous words back to them
- distinguish AI-inferred content from user-supplied content (visually, in UI and exports — §15 invariant 3)
- accept user decisions even when they look mistaken
- give categories, not specifics (v2.0 §18.9) — AI provides scaffolding (categories, structural consequences), user instantiates with material-specific content

The Socratic discipline (§6) is the spine of step 2: AI asks questions
drawn from §7's 8 universal angles. AI **never** lists candidate centers
with reasoning — that shapes possibility space. The synthesis algorithm
(§8) reflects the user's own repeated words back. User names. AI never names.

### Aesthetic, scale, and aggregation neutrality (v2.0)

The map module operates within METHODOLOGY §3 Aesthetic Neutrality and Scale
Neutrality:

- **No scale defaults**: when surfacing the consequences of `core_circle.size` or material density, AI does NOT compare against a typical baseline ("most stories work with 3-4 in core"). AI reports count + structural cost (each core character requires depth = more backstory work to maintain) and asks the user to confirm scope. AI does not provide a comparison number.
- **No literary canon names** in any user-facing UI text or LLM-visible prompt (§15 invariant 6). Equivalent neutral phrasing where lineage was used in v1 spec drafts.
- **Aggregation views are permitted** but not as verdict — surfacing "5 angles selected, 4 produced converging answers" is a structural fact, not a quality score.

---

## 3. User journey at a glance

```
/write
  │
  ▼
[v2.0] Drive type selection (purposeful / entangled / unknown)
  │
  ├── purposeful → declare 初心 (+ 媒介目标 if commercial)
  │     │
  │     ▼
  │   "You have network material?"
  │     │
  │     ├── Yes + art-purposeful → /map/new
  │     │     │
  │     │     ▼
  │     │   5-step wizard (10-25 min)
  │     │     │
  │     │     ▼
  │     │   project_map persisted → /map/[projectId]
  │     │     │
  │     │     ▼
  │     │   [v2.0] situate.act estimate wizard (4 questions, ~10 min)
  │     │     │
  │     │     ▼
  │     │   [Write a scene] → /write/guided?project=ID
  │     │
  │     └── No / commercial → /write/guided (anchor-only)
  │
  ├── entangled → declare 那一行字 → /write/guided (skip both map and act)
  │
  └── unknown → /write/guided (skip both; AI asks driver after 3 drafts)
```

Each subsequent scene for an art-purposeful project with `project_map` reuses the map (per §10):
- map shown as pinned, collapsible header
- mode prefilled (per scene, user can override)
- character_interview filtered to `core_circle`
- mirror gains "服务于中心问题" feedback (5th category)

If the project also has `act_estimates` (per situate-act spec), each scene additionally shows:
- current segment label + user-declared segment function (verbatim echo, no AI paraphrase — §A.11)
- progress against estimated total (e.g., "1/22 scenes")

---

## 4. The five steps (detail)

Per METHODOLOGY §4 the five-step shape is shared with situate.at. Map
instantiates each step in the architecture register.

### Step 1: Pour materials + select mode

**UI**: large textarea + file paste area (PDF / TXT / DOCX paste), 3-mode
radio at top.

**Modes** (METHODOLOGY §5):
- **A — Real materials**: court records, news, interview transcripts, memoir. AI biases toward subtraction.
- **B — Fully invented**: pure fiction. AI biases toward completion check (gaps, contradictions).
- **C — Hybrid**: real + significant invention. AI watches the seams.

**No AI action in this step.** User pours, user selects. Materials go into
`projectMapSessions.materials_text` (staging row). Mode goes into
`projectMapSessions.mode`.

**Output state**: `{ materials: string, mode: "A"|"B"|"C" }`

### Step 2: Choose center

The most delicate step. Per METHODOLOGY §6 + §7 + §8.

**(a) Angle selection (server-side, single AI call)**

AI sees the materials + mode, picks 5-6 angles from the fixed 8 (§7). Output
is which angles + per-angle one-line rationale. **Angles 2 (Resonance), 4
(Ungrabbable), 8 (Irreducibility) are nearly always picked** — they're
listed as evergreen in §7.

The 8 angles are versioned constants in code (§15 invariant 1):

| # | id | label (UI shown) | what it asks |
|---|---|---|---|
| 1 | position | 结构位置 | Which structural position does the writer's attention return to? |
| 2 | resonance | 自我认同 | Whose situation does the writer recognize as potentially their own? |
| 3 | label_inadequacy | 标签失灵 | Which external categorization fails most interestingly? |
| 4 | ungrabbable | 不可归类 | Who resists hero/villain/victim categorization? |
| 5 | world_bearing | 世界载体 | Whose daily existence most carries the period/world? |
| 6 | hidden_periphery | 隐于边缘 | Is the real center off the obvious stage? |
| 7 | difficulty_depth | 难度即深度 | Whose interiority would be hardest, therefore most worth writing? |
| 8 | irreducibility | 不可化约 | If only one name remained in the book, whose? |

**(b) Question generation (server-side, single AI call)**

Given the selected angles + materials, AI generates 5-6 specific questions
in language drawn from the materials. **NOT generic — instantiated for this
specific material.** Example: angle 7 (difficulty_depth) applied to a
Godfather-universe corpus might produce "在你写的这家人里，谁的内心
对你最难写——既因为他/她总在沉默，也因为他/她说出口的话都不像真心
说的？" rather than the bare angle text.

**(c) User answers**

5-6 textareas (one per question). User answers in their own words. **No
hints, no examples, no autosuggest.** Empty answers are allowed — user can
skip ones that don't speak to them.

**(d) Synthesis (server-side, single AI call) — §8 algorithm**

Fixed shape:
1. Extract key descriptive phrases from each user answer.
2. Find phrases that recur (semantic similarity, not literal).
3. Display recurring descriptions to user.
4. State: "These descriptions point to the same person. You've already
   chosen. You just haven't said the name."
5. Empty input. User types the name.

**Failure mode** (per §8): if answers don't converge, AI says: "Your answers
don't yet point to one person. Want to answer more, or just tell me who
you're thinking of?" AI does **not** guess.

**Output state** after step 2:
```
{
  selected_angles: ["resonance", "ungrabbable", "difficulty_depth", "irreducibility", "world_bearing"],
  questions: [...],
  answers: [...],
  recurring_phrases: [...],
  center_person: "Michael",
  motto: "" // filled at the start of step 3 or end of step 2
}
```

### Step 3: Triple classification (core / background / noise)

Per METHODOLOGY §4 + missing-modules-v1 P1.1.

**UI**: drag-and-drop UI with 3 columns (core / background / noise). All
named entities AI detected in materials shown as draggable chips with a
"none" preselection (no auto-assignment — that would be AI ranking).
Tap fallback for mobile (drag → tap chip → tap target column).

**AI action**: detect named entities only. **Never** propose initial
assignment. AI surfaces structural facts when user finishes:
- "core_circle has N entries. Each requires depth — N entries means N backstories to maintain across the project. Is this the scope you intend?" (NO baseline comparison — Scale Neutrality §3)
- "X appears in 80% of material but is in background" (density vs assignment fact)
- "Y has 40 words of material but is in core_circle" (density signal, §9 — let user decide if intentional)

Surfacing is one-time per session. After user persists, AI accepts (§9).

**v2.0 Scale Neutrality compliance**: AI does NOT say "most stories work with 3-4" or any baseline. AI reports counts and consequences; the user judges what scope is appropriate.

**Output state**:
```
core_circle:       [{name, function}, ...]
background_circle: [name, ...]
noise_circle:      [name, ...]
```

### Step 4: Rank 5 conflicts

Per METHODOLOGY §4 + missing-modules-v1 P1.2.

**The 5 conflict slots** (versioned constants):
| id | label |
|---|---|
| internal | 内在冲突 |
| structural | 结构冲突 |
| relational | 关系冲突 |
| alliance | 同盟冲突 |
| temporal | 时间冲突 |

**UI**: 5 labeled slots. User fills each in one sentence.

**AI action** after user fills:
- empty-slot flag (which slots are still blank)
- semantic-overlap flag (if two slots say the same thing)
- material-evidence flag ("your materials describe X conflict but no slot mentions it")
- dramaturgy red flags (per missing-modules-v1 P1.2: e.g., "all 5 conflicts point in the same direction")

**No AI fill.** AI flags only. User decides.

**Output state**: `conflicts: { internal, structural, relational, alliance, temporal }` — each ≤200 chars.

### Step 5: Central question

Per METHODOLOGY §4 + missing-modules-v1 P1.3.

**UI**: single textarea, hard cap 50 chars (§15 invariant 4 — enforced
client AND server). Live indicators:
- ✓/✗ Is a question (ends with `？` or `?`)
- ✓/✗ Not yes/no (does not start with "是不是/能否/会不会/是否/will/can/does/is")
- ✓/✗ Both specific and universal (heuristic: contains both a proper noun/concrete noun AND an abstract noun — AI-evaluated, single fast call)

**AI deep challenge** (one challenge only, per §13 — then accept):
- "Your earlier answers emphasized X. This question is about Y. They might be the same — but you should check."

If user proceeds: accept and persist.

**Output state**: `central_question: string` (≤50 chars).

---

## 5. The project_map schema

Per METHODOLOGY §10:

```ts
type ProjectMap = {
  id: string;             // uuid
  projectId: string;      // fk
  mode: "A" | "B" | "C";
  center_person: string;
  motto: string;          // one sentence: why I chose them; ≤200 chars
  core_circle: { name: string; function: string }[];
  background_circle: string[];
  noise_circle: string[];
  conflicts: {
    internal: string;
    structural: string;
    relational: string;
    alliance: string;
    temporal: string;
  };
  central_question: string; // ≤50 chars, ends with ? or ？, not yes/no
  selected_angles: string[]; // for replay / re-evaluation
  version: number;        // incremented on every user edit
  createdAt: Date;
  updatedAt: Date;
};
```

Constraints enforced server-side (§15 invariant 4):
- `central_question.length ≤ 50`
- `central_question` ends with `?` or `？`
- `motto.length ≤ 200`
- `core_circle.length ≥ 1`

**Engineering invariant** (§15 invariant 5): only user actions through the
`/map/[id]/edit` UI can update this row. No AI-triggered writes. No write
flow can mutate it.

---

## 6. Integration with situate.at

Per METHODOLOGY §10, four touchpoints — and **only** these four:

### a. Pinned header

`/write/guided?project=ID` and `/write/template?project=ID` load the map
and render `<PinnedProjectMap map={...} collapsible />` at top. Always
visible, always collapsible.

### b. Mode prefill

guided step 1's mode is `useState(map?.mode ?? "real")`. User can change
per scene — mode is "questioning bias" (§5), not restriction.

### c. character_interview filter

Currently `character_interview` runs on any focal character. With map:
```ts
function shouldOfferCharacterInterview(target: string): boolean {
  if (!projectMap) return true;
  return projectMap.core_circle.some((c) => c.name === target);
}
```
Background / noise circle characters don't get Stanislavski-depth workshop.

### d. 5th feedback category — "服务于中心问题"

A new axis diagnoser `serves_central_question` joins the bank:
- `requires_intent: true` (central_question is the intent)
- 3-tier verdict: `serves_present` / `serves_implicit` / `serves_absent`
- Only runs when a project_map exists
- Adds a 12th observation in `lay-translator.ts`

---

## 7. New components and routes

### Routes
```
src/app/map/
├── page.tsx                       projects index + "new project" CTA
├── new/
│   └── page.tsx                   step 1 entry
├── [projectId]/
│   ├── page.tsx                   project overview (map + drafts list)
│   ├── edit/
│   │   └── page.tsx               user re-edit (no AI mutation)
│   └── wizard/
│       └── page.tsx               resumable 5-step wizard
└── map-client.tsx                 5-step state machine
└── actions.ts                     server actions
```

### API
```
src/app/api/map/
├── angles/select/route.ts         POST { materials, mode } → { selected_angles[] }
├── socratic/questions/route.ts    POST { materials, angles[] } → { questions[] }
├── synthesis/route.ts             POST { questions[], answers[] } → { recurring_phrases[], shape: "converged" | "scattered" }
├── conflicts/identify/route.ts    POST { materials, center, conflicts } → { empty_slots, overlaps, material_evidence_missing }
├── central-question/validate/route.ts   POST { text, materials, center } → { is_question, is_not_yesno, specific_and_universal }
└── finalize/route.ts              POST { wizard_state } → persist projectMap → { projectId }
```

### Lib
```
src/lib/coach/map/
├── types.ts                       ProjectMap, Mode, Angle, Conflict types
├── angles.ts                      8 universal angles constants
├── angle-selector.ts              focusedCall: pick 5-6 angles
├── socratic.ts                    focusedCall: generate questions
├── synthesis.ts                   §8 algorithm (LLM + regex assist)
├── conflict-typology.ts           focusedCall: flag empty / overlap / missing
└── central-question.ts            focusedCall: 3 live indicators
```

### New diagnosers (registry entries)
```
src/lib/coach/diagnosers/
├── world_coherence.ts             ← mode B/C: relational contradictions, rule violations
├── structural_compression.ts      ← redundancy: overlapping characters, parallel plot lines
└── serves_central_question.ts     ← per §10: 12th observation
```

These join the existing bank registry. They participate in normal bank
flow (provider fanout, lay-translator translation). Only
`serves_central_question` requires_intent: true.

### Components
```
src/components/map/
├── PinnedProjectMap.tsx           used by /write/guided
├── ModeSelector.tsx
├── MaterialsPour.tsx
├── SocraticQuestion.tsx
├── SynthesisResult.tsx
├── TripleClassifier.tsx           drag/drop + tap fallback
├── ConflictRanker.tsx             5 slots
└── CentralQuestionInput.tsx       live indicators
```

---

## 8. DB schema

```sql
-- New table: projects
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- New table: project_maps (1:1 with projects)
CREATE TABLE project_maps (
  project_id UUID PRIMARY KEY REFERENCES projects(id),
  mode CHAR(1) NOT NULL CHECK (mode IN ('A','B','C')),
  center_person TEXT NOT NULL,
  motto TEXT NOT NULL CHECK (length(motto) <= 200),
  core_circle JSONB NOT NULL,
  background_circle JSONB NOT NULL DEFAULT '[]',
  noise_circle JSONB NOT NULL DEFAULT '[]',
  conflicts JSONB NOT NULL,
  central_question TEXT NOT NULL CHECK (length(central_question) <= 50),
  selected_angles JSONB NOT NULL DEFAULT '[]',
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- New table: project_map_sessions (wizard staging)
CREATE TABLE project_map_sessions (
  project_id UUID PRIMARY KEY REFERENCES projects(id),
  step INT NOT NULL CHECK (step BETWEEN 1 AND 5),
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add column to existing storyDrafts
ALTER TABLE story_drafts
  ADD COLUMN project_id UUID REFERENCES projects(id),
  ADD COLUMN project_map_version INT;
```

`project_id` is nullable on `storyDrafts` — anchor-only drafts (today's
flow) don't belong to a project.

`project_map_version` lets a draft remember which map version it was
written against (per §6 of our integration: surface a banner when the
draft's recorded version < current map version).

---

## 9. Failure modes (anticipated)

| Failure | Handling |
|---|---|
| User abandons map mid-wizard | `project_map_sessions` persists step+state; resume on return |
| AI fails to find recurring phrases in step 2 synthesis | Honest message + return control (§8 failure mode) — do not guess |
| User's center is a 40-word-material character | Surface density fact once (§9). User can persist; AI accepts |
| User skips conflicts entirely | Allow. Empty slots flagged once. User can persist with empties |
| User pastes 50,000 chars of materials | Server cap at ~30k chars; show truncation warning |
| Materials contain prompt injection | Treat as text only; never execute instructions; surface to user if suspicious |
| User edits map after writing 3 drafts | Bump `version`. Drafts show banner: "Map updated since this draft was written" |
| User deletes project | drafts unlink (`project_id = null`); drafts preserved; map deleted |

---

## 10. Engineering invariants (§15) — application

| Invariant | This module's compliance |
|---|---|
| 1. Prompts are versioned constants in code | All system prompts under `src/lib/coach/map/*.ts` |
| 2. AI must never see writer prose without explicit trigger | N/A here (map handles materials, not prose). But applies to future scene-write integration |
| 3. AI-inferred content visually distinguishable | Recurring phrases, structural facts shown in distinct UI block with "AI" badge; persists to project_map.selected_angles |
| 4. Character limits are hard limits | Server validates `central_question ≤ 50`, `motto ≤ 200` |
| 5. project_map cannot be edited by AI | No AI-callable mutation path. All writes via `/api/map/finalize` and `/map/[id]/edit` user actions |
| 6. No canon names in user-facing surfaces (v2.0) | System prompts and UI text use neutral phrasing. "8 angles" instead of "8 Lukács-style angles". Lineage stays in `docs/` and code comments only. |

---

## 11. Implementation TODO

Phase ordering reflects dependency. Each chunk is sized for one or two
working sessions.

### Phase 0: DB + types foundation (~3h)
- [ ] **0.1** Add `projects`, `project_maps`, `project_map_sessions` tables to `src/db/schema.ts`
- [ ] **0.2** Add `project_id`, `project_map_version` columns to `story_drafts`
- [ ] **0.3** Drizzle migration; verify on local Supabase
- [ ] **0.4** Define `src/lib/coach/map/types.ts` (ProjectMap, Angle, Conflict)
- [ ] **0.5** Define 8 angles constant in `src/lib/coach/map/angles.ts`

### Phase 1: API + lib backbone (~6h)
- [ ] **1.1** `angle-selector.ts` — focusedCall picking 5-6 of 8
- [ ] **1.2** `socratic.ts` — focusedCall generating per-angle questions
- [ ] **1.3** `synthesis.ts` — §8 algorithm (LLM phrase extraction + recurrence check)
- [ ] **1.4** `conflict-typology.ts` — empty/overlap/missing flags
- [ ] **1.5** `central-question.ts` — 3 live indicators
- [ ] **1.6** API routes wrapping each lib function
- [ ] **1.7** `/api/map/finalize` writes projectMap row, returns id

### Phase 2: Wizard UI (~10h)
- [ ] **2.1** `/map/new` + `map-client.tsx` 5-step state machine
- [ ] **2.2** `MaterialsPour` + `ModeSelector` (step 1)
- [ ] **2.3** `SocraticQuestion` + `SynthesisResult` (step 2)
- [ ] **2.4** `TripleClassifier` (step 3 — drag/drop, tap fallback)
- [ ] **2.5** `ConflictRanker` (step 4 — 5 slots + AI flag panel)
- [ ] **2.6** `CentralQuestionInput` (step 5 — live indicators + char count)
- [ ] **2.7** Resumable wizard (read `project_map_sessions`, restore step+state)
- [ ] **2.8** Step navigation (back / forward / skip)

### Phase 3: Project dashboard + entry (~4h)
- [ ] **3.1** `/map` index page (list user's projects)
- [ ] **3.2** `/map/[projectId]` overview (collapsible map + drafts list + "Write a scene" CTA)
- [ ] **3.3** `/map/[projectId]/edit` (user-only re-edit, bumps version)
- [ ] **3.4** Update `/write/page.tsx`: add "have network material?" pre-question or 4th card

### Phase 4: Integration into write (~5h)
- [ ] **4.1** `PinnedProjectMap` component
- [ ] **4.2** `/write/guided?project=ID` loads map, passes to client
- [ ] **4.3** Mode prefill + map header rendering in guided-client
- [ ] **4.4** `character_interview` filter: only core_circle
- [ ] **4.5** `/write/template?project=ID` same wiring
- [ ] **4.6** `storyDrafts.project_map_version` bookkeeping on save
- [ ] **4.7** Banner: "Map updated since this draft was written"

### Phase 5: New diagnosers (~6h)
- [ ] **5.1** `serves_central_question` — 3-tier axis, requires_intent
- [ ] **5.2** `world_coherence` — mode B/C analytical diagnoser
- [ ] **5.3** `structural_compression` — redundancy analyzer
- [ ] **5.4** Register all 3 in `DIAGNOSERS` registry
- [ ] **5.5** Add `serves_central_question` lay observation (12th in lay-translator)
- [ ] **5.6** Wire into guided's `bank` diagnoser_ids when project context present

### Phase 6: Validation (~4h)
- [ ] **6.1** Hand-test with a real network-material project (e.g., a real family-history corpus)
- [ ] **6.2** Verify §13 forbiddens: no candidate lists, no rankings, no AI prose, no praise, no drive/scale hierarchy
- [ ] **6.3** Verify §15 invariants: prompts constants, char caps enforced, AI cannot mutate map, AI-inferred content visually distinct, no canon names in user-facing surfaces
- [ ] **6.4** Verify §18.9 compliance: every AI surface gives categories or structural consequences, never specific scene content / specific characters / specific plot beats
- [ ] **6.5** Verify §18.10 compliance: no second-guessing of user's declared drive
- [ ] **6.6** Verify Scale Neutrality: no defaults pre-selected, no baseline comparisons ("most stories work with 3-4")
- [ ] **6.7** Contrast pairs for `serves_central_question` (2-3 pairs minimum)
- [ ] **6.8** Smoke test: map → act → guided → mirror, end-to-end with project_map + act_estimates context
- [ ] **6.9** Drive-routing test: verify entangled / commercial / unknown drives bypass map correctly

### Phase 7: methodology audit of existing code (~4h, parallel) — SUPERSEDED

This phase is now §B of `missing-modules-v1.md`. Refer there for the
v2.0 audit work (vitality / lay-translator / the_turn / `/write` entry
redesign). Some items already partially completed in pre-canonization
audit commits (see `f0bf01c`).

### Phase 3.5 — situate.act gating (NEW v2.0)

Between Phase 3 (project dashboard) and Phase 4 (integration into write),
the project dashboard must hand off to situate.act for art-purposeful
projects:

- [ ] **3.5.1** `/map/[projectId]` overview page adds CTA: "Set act estimates →" → `/act/[projectId]` (per situate-act-spec)
- [ ] **3.5.2** `[Write a scene]` CTA on overview page is enabled only when both `project_map` AND `act_estimates` exist; otherwise prompts user to set act estimates first
- [ ] **3.5.3** Per-drive routing: only art-purposeful projects see this gate. Other drives go straight to write.

### Total
~42h focused work for situate.map proper. situate.act (~32h per §A.7)
and §B post-canon audit work (~30h aggregate) tracked separately.

---

## 12. Open questions

These need a decision before Phase 1:

- **Q1**: Mode B (fully invented) — does step 1 require any materials at all, or can it be a blank pour ("describe your world")? Methodology §5 doesn't say. Recommend: optional materials, encouraged ≥500 chars.
- **Q2**: Step 2 synthesis — what if user answers 6 questions but 5 of the recurring phrases point at character A and 1 at character B? "Mostly converged" — what's the threshold? Recommend: ≥4/6 fingerprint match = converged; else scattered.
- **Q3**: Editing a map breaks downstream drafts' character workshops if a core_circle character is removed. Recommend: warning at edit time, never auto-mutation.
- **Q4**: Anchor-only drafts that later want a map — UX to "promote" anchor-only → project. Recommend: out of scope for v1; user re-enters via /map/new.
- **Q5**: Multi-user / collaborative projects? Recommend: out of scope for v1.

---

## 13. See also

- `methodology-v1.md` — current diagnoser bank methodology
- `missing-modules-v1.md` — the TODO inventory this spec consolidates
- `transformational-v0.md` — underlying framework
- `canonical-validation-v1.md` — validation harness (applies to new diagnosers)
- `long-form-handling.md` — long-form architecture (overlaps with §9 failure modes)
- `METHODOLOGY.md` v2.0 (canonical at `/docs/METHODOLOGY.md`) — drives every section here

---

## Appendix: v2.0 audit summary

This spec was originally written against METHODOLOGY v1.0. After v2.0
canonization, this audit pass added:

| § | Change |
|---|---|
| Header | Bumped to v2.0; scoped to art-purposeful drive only |
| §1 | Updated architecture table to three layers (added situate.act) |
| §2 | Added v2.0 forbiddens (drive/scale hierarchy, declaration second-guessing, scale defaults); added §18.9 §18.10 Scale Neutrality compliance subsection |
| §3 | User journey now starts with drive selection. Routing differs per drive. Mentions situate.act handoff. |
| §3 Step 3 | Removed "most stories work with 3-4" baseline language (Scale Neutrality violation). AI reports counts + consequences without baselines. |
| §10 | Added Engineering Invariant 6 (no canon names in user-facing surfaces) |
| §11 Phase 3.5 | New phase for situate.act gating |
| §11 Phase 6 | Validation now includes §18.9 / §18.10 / Scale Neutrality / drive routing checks |
| §11 Phase 7 | SUPERSEDED by `missing-modules-v1.md` §B |

The spec is now methodology-v2-compliant. Implementation can proceed against this spec without further audit-back-checking against v1.0.

---

*End of situate-map-spec-v1.md (v2.0-audited)*
