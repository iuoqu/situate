"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * StoryBibleSidebar — manual-fill UI for the Story Bible (Milestone B.2).
 *
 * Sits in the editor's right rail. Renders the current bible state for
 * a draft (entities + relationships) and provides inline add / edit /
 * delete forms. No AI extraction yet — the AI-coach skeleton window
 * adds that in B.3 by inserting via the same POST endpoints.
 *
 * Scope intentionally narrow:
 *   - entities — name + type + optional aliases + real-person flag
 *   - relationships — entity A → kind → entity B + optional notes
 *
 * Out of scope here (future slices):
 *   - per-language renderings UI (B.6 translation)
 *   - postures / elisions / story_units annotations (B.4 / B.5)
 *   - AI extraction proposals as confirmable chips (B.3)
 *
 * The component is intentionally chatty (one fetch per mutation) for
 * Year-1 audience size. If it becomes a hot spot we'll batch.
 */

interface Entity {
  id: string;
  draftId: string;
  canonicalName: string;
  entityType: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  isRealPerson: boolean | null;
  consentStatus: string | null;
}

interface Relationship {
  id: string;
  draftId: string;
  entityA: string;
  entityB: string;
  kind: string;
  registerOverrides: Record<string, unknown>;
  notes: string | null;
}

// Suggested entity types — open value space; authors can type anything,
// but the chips give them sensible defaults that match common tradition
// vocabularies.
const ENTITY_TYPE_SUGGESTIONS = [
  "person",
  "place",
  "organisation",
  "object",
  "concept",
];

// Suggested relationship kinds — same logic. Tradition registry will
// eventually supply per-tradition lists; for now we ship a generic set.
const RELATIONSHIP_KIND_SUGGESTIONS = [
  "mentor_of",
  "child_of",
  "spouse_of",
  "sibling_of",
  "friend_of",
  "rival_of",
  "stranger_to",
  "lives_at",
  "works_at",
  "owns",
];

export function StoryBibleSidebar({ draftId }: { draftId: string }) {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state — minimal, inline. A heavier expand-to-modal flow is
  // overkill for the manual stage; B.3 swaps this for AI-proposed
  // chips anyway.
  const [showEntityForm, setShowEntityForm] = useState(false);
  const [showRelationshipForm, setShowRelationshipForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [eRes, rRes] = await Promise.all([
        fetch(`/api/drafts/${draftId}/bible/entities`),
        fetch(`/api/drafts/${draftId}/bible/relationships`),
      ]);
      if (!eRes.ok || !rRes.ok) {
        throw new Error("Couldn't load bible");
      }
      const eData = (await eRes.json()) as { entities: Entity[] };
      const rData = (await rRes.json()) as { relationships: Relationship[] };
      setEntities(eData.entities);
      setRelationships(rData.relationships);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const entityById = new Map(entities.map((e) => [e.id, e]));

  return (
    <aside style={sidebarStyle} aria-label="Story Bible">
      <header style={headerStyle}>
        <h2 style={titleStyle}>📖 Story Bible</h2>
        <p style={subtitleStyle}>
          Who and what is in this story. Fill in as you write — the
          translator and coach read from here.
        </p>
      </header>

      {error && (
        <div role="alert" style={errorStyle}>
          {error}
        </div>
      )}

      <section>
        <h3 style={sectionTitleStyle}>
          👤 Entities <span style={countStyle}>({entities.length})</span>
        </h3>
        {loading ? (
          <p style={mutedStyle}>Loading…</p>
        ) : entities.length === 0 ? (
          <p style={mutedStyle}>
            No entities yet. People, places, key objects — anything
            with a name worth keeping straight.
          </p>
        ) : (
          <ul style={listStyle}>
            {entities.map((e) => (
              <EntityRow
                key={e.id}
                entity={e}
                onChange={refresh}
                draftId={draftId}
              />
            ))}
          </ul>
        )}
        {showEntityForm ? (
          <NewEntityForm
            draftId={draftId}
            onDone={() => {
              setShowEntityForm(false);
              void refresh();
            }}
            onCancel={() => setShowEntityForm(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowEntityForm(true)}
            style={addButtonStyle}
          >
            + Add entity
          </button>
        )}
      </section>

      <section>
        <h3 style={sectionTitleStyle}>
          🔗 Relationships{" "}
          <span style={countStyle}>({relationships.length})</span>
        </h3>
        {loading ? (
          <p style={mutedStyle}>Loading…</p>
        ) : entities.length < 2 ? (
          <p style={mutedStyle}>
            Add at least two entities before connecting them.
          </p>
        ) : relationships.length === 0 ? (
          <p style={mutedStyle}>
            No relationships yet. Connect entities so the translator
            knows the register (mentor / spouse / rival affect how
            people address each other in target languages).
          </p>
        ) : (
          <ul style={listStyle}>
            {relationships.map((r) => (
              <RelationshipRow
                key={r.id}
                relationship={r}
                entityById={entityById}
                draftId={draftId}
                onChange={refresh}
              />
            ))}
          </ul>
        )}
        {entities.length >= 2 &&
          (showRelationshipForm ? (
            <NewRelationshipForm
              draftId={draftId}
              entities={entities}
              onDone={() => {
                setShowRelationshipForm(false);
                void refresh();
              }}
              onCancel={() => setShowRelationshipForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowRelationshipForm(true)}
              style={addButtonStyle}
            >
              + Add relationship
            </button>
          ))}
      </section>

      <footer style={footerStyle}>
        Postures, story-unit annotations, and AI-proposed extraction
        land in later slices.
      </footer>
    </aside>
  );
}

// ── Entity row + new form ─────────────────────────────────────────────────

function EntityRow({
  entity,
  onChange,
  draftId,
}: {
  entity: Entity;
  onChange: () => void;
  draftId: string;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li style={rowStyle}>
        <EditEntityForm
          draftId={draftId}
          entity={entity}
          onDone={() => {
            setEditing(false);
            onChange();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li style={rowStyle}>
      <div style={rowMainStyle}>
        <span style={rowNameStyle}>{entity.canonicalName}</span>
        <span style={rowTypeStyle}>{entity.entityType}</span>
        {entity.isRealPerson === true && (
          <span style={realPersonChipStyle}>real person</span>
        )}
      </div>
      {entity.aliases.length > 0 && (
        <div style={aliasesStyle}>
          a.k.a. {entity.aliases.join(", ")}
        </div>
      )}
      <div style={rowActionsStyle}>
        <button
          type="button"
          onClick={() => setEditing(true)}
          style={inlineActionStyle}
        >
          edit
        </button>
        <button
          type="button"
          onClick={async () => {
            if (
              !window.confirm(
                `Delete "${entity.canonicalName}"? Relationships involving this entity will also be removed.`,
              )
            )
              return;
            await fetch(
              `/api/drafts/${draftId}/bible/entities/${entity.id}`,
              { method: "DELETE" },
            );
            onChange();
          }}
          style={dangerInlineStyle}
        >
          delete
        </button>
      </div>
    </li>
  );
}

function NewEntityForm({
  draftId,
  onDone,
  onCancel,
}: {
  draftId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <EntityFormBase
      draftId={draftId}
      initial={null}
      onDone={onDone}
      onCancel={onCancel}
      submitLabel="Add"
    />
  );
}

function EditEntityForm({
  draftId,
  entity,
  onDone,
  onCancel,
}: {
  draftId: string;
  entity: Entity;
  onDone: () => void;
  onCancel: () => void;
}) {
  return (
    <EntityFormBase
      draftId={draftId}
      initial={entity}
      onDone={onDone}
      onCancel={onCancel}
      submitLabel="Save"
    />
  );
}

function EntityFormBase({
  draftId,
  initial,
  onDone,
  onCancel,
  submitLabel,
}: {
  draftId: string;
  initial: Entity | null;
  onDone: () => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [canonicalName, setCanonicalName] = useState(
    initial?.canonicalName ?? "",
  );
  const [entityType, setEntityType] = useState(initial?.entityType ?? "person");
  const [aliasesText, setAliasesText] = useState(
    initial?.aliases?.join(", ") ?? "",
  );
  const [isRealPerson, setIsRealPerson] = useState<boolean | null>(
    initial?.isRealPerson ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    const payload = {
      canonicalName: canonicalName.trim(),
      entityType: entityType.trim(),
      aliases: aliasesText
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean),
      isRealPerson,
    };
    try {
      const url = initial
        ? `/api/drafts/${draftId}/bible/entities/${initial.id}`
        : `/api/drafts/${draftId}/bible/entities`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "save failed");
      }
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <input
        type="text"
        placeholder="Name (e.g. 老王, the kopitiam)"
        value={canonicalName}
        onChange={(e) => setCanonicalName(e.target.value)}
        required
        style={inputStyle}
        autoFocus
      />
      <select
        value={entityType}
        onChange={(e) => setEntityType(e.target.value)}
        style={inputStyle}
      >
        {ENTITY_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Other names (comma-separated)"
        value={aliasesText}
        onChange={(e) => setAliasesText(e.target.value)}
        style={inputStyle}
      />
      <label style={checkboxRowStyle}>
        <input
          type="checkbox"
          checked={isRealPerson === true}
          onChange={(e) =>
            setIsRealPerson(e.target.checked ? true : null)
          }
        />
        <span style={checkboxLabelStyle}>
          Real, identifiable person. (Triggers the P5 disclosure flow
          at submit time.)
        </span>
      </label>
      {err && (
        <div role="alert" style={formErrorStyle}>
          {err}
        </div>
      )}
      <div style={formActionsStyle}>
        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {submitting ? "Saving…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={secondaryButtonStyle}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Relationship row + new form ───────────────────────────────────────────

function RelationshipRow({
  relationship,
  entityById,
  draftId,
  onChange,
}: {
  relationship: Relationship;
  entityById: Map<string, Entity>;
  draftId: string;
  onChange: () => void;
}) {
  const a = entityById.get(relationship.entityA);
  const b = entityById.get(relationship.entityB);
  return (
    <li style={rowStyle}>
      <div style={rowMainStyle}>
        <span style={rowNameStyle}>{a?.canonicalName ?? "?"}</span>
        <span style={kindArrowStyle}>→ {relationship.kind} →</span>
        <span style={rowNameStyle}>{b?.canonicalName ?? "?"}</span>
      </div>
      {relationship.notes && (
        <div style={aliasesStyle}>{relationship.notes}</div>
      )}
      <div style={rowActionsStyle}>
        <button
          type="button"
          onClick={async () => {
            if (
              !window.confirm(
                `Remove relationship "${a?.canonicalName} → ${relationship.kind} → ${b?.canonicalName}"?`,
              )
            )
              return;
            await fetch(
              `/api/drafts/${draftId}/bible/relationships/${relationship.id}`,
              { method: "DELETE" },
            );
            onChange();
          }}
          style={dangerInlineStyle}
        >
          delete
        </button>
      </div>
    </li>
  );
}

function NewRelationshipForm({
  draftId,
  entities,
  onDone,
  onCancel,
}: {
  draftId: string;
  entities: Entity[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [entityA, setEntityA] = useState(entities[0]?.id ?? "");
  const [entityB, setEntityB] = useState(entities[1]?.id ?? "");
  const [kind, setKind] = useState("mentor_of");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (entityA === entityB) {
      setErr("Pick two different entities.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/bible/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityA,
          entityB,
          kind: kind.trim(),
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "save failed");
      }
      onDone();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} style={formStyle}>
      <select
        value={entityA}
        onChange={(e) => setEntityA(e.target.value)}
        style={inputStyle}
      >
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.canonicalName}
          </option>
        ))}
      </select>
      <input
        type="text"
        list="kind-suggestions"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
        placeholder="Kind (e.g. mentor_of)"
        style={inputStyle}
        required
      />
      <datalist id="kind-suggestions">
        {RELATIONSHIP_KIND_SUGGESTIONS.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <select
        value={entityB}
        onChange={(e) => setEntityB(e.target.value)}
        style={inputStyle}
      >
        {entities.map((e) => (
          <option key={e.id} value={e.id}>
            {e.canonicalName}
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={inputStyle}
      />
      {err && (
        <div role="alert" style={formErrorStyle}>
          {err}
        </div>
      )}
      <div style={formActionsStyle}>
        <button type="submit" disabled={submitting} style={primaryButtonStyle}>
          {submitting ? "Saving…" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={secondaryButtonStyle}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const sidebarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: 18,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  color: "#1a1a1a",
};
const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18,
  fontWeight: 400,
  color: "#1a1a1a",
};
const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#888",
  lineHeight: 1.5,
};
const sectionTitleStyle: React.CSSProperties = {
  margin: "10px 0 8px",
  fontFamily: "system-ui",
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
  fontWeight: 600,
};
const countStyle: React.CSSProperties = {
  color: "#aaa",
  fontWeight: 400,
};
const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 10px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};
const rowStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};
const rowMainStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "baseline",
  flexWrap: "wrap",
};
const rowNameStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  color: "#1a1a1a",
};
const rowTypeStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
};
const realPersonChipStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 8,
  background: "#fef3c7",
  border: "1px solid #d97706",
  color: "#7c2d12",
  letterSpacing: 0.3,
};
const aliasesStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#888",
  fontStyle: "italic",
};
const kindArrowStyle: React.CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, monospace",
  fontSize: 11,
  color: "#9b8a6b",
};
const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 2,
};
const inlineActionStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#666",
  fontSize: 11,
  letterSpacing: 0.3,
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  fontFamily: "inherit",
};
const dangerInlineStyle: React.CSSProperties = {
  ...inlineActionStyle,
  color: "#7f1d1d",
};
const addButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 12px",
  background: "white",
  color: "#1a1a1a",
  border: "1px dashed #d4cfc2",
  borderRadius: 3,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
const mutedStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 12,
  color: "#888",
  fontStyle: "italic",
  lineHeight: 1.55,
};
const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
};
const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 13,
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
  fontFamily: "inherit",
};
const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "flex-start",
};
const checkboxLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#555",
  lineHeight: 1.5,
};
const formActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 2,
};
const primaryButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
const secondaryButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "white",
  color: "#666",
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};
const formErrorStyle: React.CSSProperties = {
  padding: 6,
  background: "#fce9e9",
  border: "1px solid #fca5a5",
  borderRadius: 3,
  color: "#7f1d1d",
  fontSize: 11,
};
const errorStyle: React.CSSProperties = {
  padding: 8,
  background: "#fce9e9",
  border: "1px solid #fca5a5",
  borderRadius: 3,
  color: "#7f1d1d",
  fontSize: 12,
};
const footerStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 10,
  borderTop: "1px dashed #e8e3d8",
  fontSize: 11,
  color: "#aaa",
  fontStyle: "italic",
  lineHeight: 1.5,
};
