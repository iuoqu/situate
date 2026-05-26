"use client";

import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { submitFromForm, type SubmitFormPayload } from "@/app/actions";
import type {
  AiUsageLabel,
  AuthorRelationship,
  ConsentStatus,
  StoryType,
  SupportedLanguage,
} from "@/db/schema";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (typeof window !== "undefined" && MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface Scene {
  id: string;
  longitude: number;
  latitude: number;
  content: string;
  eventDate: string;
}

const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh_CN", label: "简体中文" },
  { value: "zh_TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const RELATIONSHIPS: { value: AuthorRelationship; label: string }[] = [
  { value: "born_there", label: "I was born there" },
  { value: "lived_there", label: "I lived there" },
  { value: "worked_there", label: "I worked there" },
  { value: "researched", label: "I researched this place for this story" },
  { value: "passing_through", label: "I was passing through" },
  { value: "never_been", label: "I have never been there" },
];

const RISK_OPTIONS = [
  { value: "recently_deceased", label: "A real, recently deceased person (≤10 years)" },
  { value: "recent_disaster", label: "A real, recent disaster or tragedy" },
  { value: "ongoing_conflict", label: "An ongoing conflict or trauma" },
  { value: "strong_local_reaction", label: "I know a specific person/community will react strongly" },
];

const AI_USAGE_OPTIONS: { value: AiUsageLabel; label: string; help: string }[] = [
  { value: "human_written", label: "Human-written", help: "No AI used in writing" },
  {
    value: "human_written_ai_translated",
    label: "Human-written, AI-translated",
    help: "I wrote the original; AI handled translation or copy-edits on the language layer",
  },
  {
    value: "ai_assisted",
    label: "AI-assisted",
    help: "AI helped me brainstorm or rewrite parts, but the imagining was mine",
  },
  {
    value: "ai_created",
    label: "AI-created",
    help: "AI authored or substantially revised the prose — flagged for editorial review (P8)",
  },
];

function newScene(longitude: number, latitude: number): Scene {
  return {
    id: crypto.randomUUID(),
    longitude,
    latitude,
    content: "",
    eventDate: "",
  };
}

function countWordsClient(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latinWords = trimmed.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjkChars = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latinWords + cjkChars;
}

export function SubmitForm({
  constitutionSignature,
}: {
  constitutionSignature: string;
}) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // F7
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorPenName, setAuthorPenName] = useState("");

  // F1
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [relocationTest, setRelocationTest] = useState("");

  // F2
  const [relationship, setRelationship] = useState<AuthorRelationship>("lived_there");
  const [relationshipDuration, setRelationshipDuration] = useState("");
  const [affinityConfidential, setAffinityConfidential] = useState(false);
  const [affinityConfidentialReason, setAffinityConfidentialReason] = useState("");

  // F3
  const [storyType, setStoryType] = useState<StoryType>("fiction");

  // F4 (conditional)
  const [hasRealPeople, setHasRealPeople] = useState(false);
  const [consentStatus, setConsentStatus] = useState<ConsentStatus>("explicit");
  const [consentExplanation, setConsentExplanation] = useState("");
  const [realPersonsList, setRealPersonsList] = useState("");

  // F5
  const [aiUsageLabel, setAiUsageLabel] = useState<AiUsageLabel>("human_written");
  const [aiNotes, setAiNotes] = useState("");

  // F6
  const [sensitivityWarnings, setSensitivityWarnings] = useState<string[]>([]);
  const [risksExplanation, setRisksExplanation] = useState("");
  const [satireDisclosure, setSatireDisclosure] = useState(false);

  // F7
  const [legalAttestation, setLegalAttestation] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Computed
  const totalWords = scenes.reduce((sum, s) => sum + countWordsClient(s.content), 0);
  const relocationWords = countWordsClient(relocationTest);
  const showField4 = storyType === "based_on_reality";
  const showRiskExplanation = sensitivityWarnings.length > 0;

  // Initialize the map once.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [0, 20],
      zoom: 1.5,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
    map.on("click", (e) => {
      const scene = newScene(e.lngLat.lng, e.lngLat.lat);
      setScenes((prev) => (prev.length >= 6 ? prev : [...prev, scene]));
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reconcile markers when scenes change.
  useEffect(() => {
    if (!mapRef.current) return;
    const liveIds = new Set(scenes.map((s) => s.id));
    for (const [id, marker] of markersRef.current.entries()) {
      if (!liveIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }
    for (const [idx, scene] of scenes.entries()) {
      if (markersRef.current.has(scene.id)) continue;
      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#1a1a1a;color:white;border:2px solid white;display:flex;align-items:center;justify-content:center;font-family:system-ui;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3)";
      el.textContent = String(idx + 1).padStart(2, "0");
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([scene.longitude, scene.latitude])
        .addTo(mapRef.current);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        setScenes((prev) =>
          prev.map((s) =>
            s.id === scene.id
              ? { ...s, longitude: lngLat.lng, latitude: lngLat.lat }
              : s,
          ),
        );
      });
      markersRef.current.set(scene.id, marker);
    }
    // Update pin labels in case scenes were reordered/removed.
    for (const [idx, scene] of scenes.entries()) {
      const marker = markersRef.current.get(scene.id);
      if (marker) {
        const el = marker.getElement();
        el.textContent = String(idx + 1).padStart(2, "0");
      }
    }
  }, [scenes]);

  function updateScene(id: string, patch: Partial<Scene>) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function deleteScene(id: string) {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }
  function toggleWarning(value: string) {
    setSensitivityWarnings((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (scenes.length === 0) {
      setError("Please drop at least one pin on the map.");
      return;
    }
    if (totalWords < 800 || totalWords > 2500) {
      setError(`Total word count must be between 800 and 2500 (currently ${totalWords}).`);
      return;
    }
    if (relocationWords < 50) {
      setError(`"Why these places, in this order?" must be at least 50 words (currently ${relocationWords}).`);
      return;
    }
    if (!legalAttestation) {
      setError("Please confirm the four attestation checkboxes before submitting.");
      return;
    }

    const payload: SubmitFormPayload = {
      title: title.trim(),
      abstract: abstract.trim() || null,
      wordCount: totalWords,
      language,
      authorEmail: authorEmail.trim(),
      authorPenName: authorPenName.trim() || null,
      authorId: authorEmail.trim(), // until real auth lands, email = identity
      scenes: scenes.map((s, idx) => ({
        longitude: s.longitude,
        latitude: s.latitude,
        eventDate: s.eventDate || null,
        content: s.content,
        ordinal: idx + 1,
      })),
      relocationTest: relocationTest.trim(),
      relationship,
      relationshipDuration: relationshipDuration.trim() || null,
      authorAffiliations: relationshipDuration.trim()
        ? [`${relationship}:${relationshipDuration.trim()}`]
        : [relationship],
      affinityConfidential,
      affinityConfidentialReason: affinityConfidential
        ? affinityConfidentialReason.trim() || null
        : null,
      storyType,
      hasRealPeople: storyType === "based_on_reality" && hasRealPeople,
      consentStatus: storyType === "based_on_reality" && hasRealPeople
        ? consentStatus
        : "not_applicable",
      consentExplanation: consentExplanation.trim() || null,
      realPersonsList: realPersonsList
        .split(/,|\n/)
        .map((s) => s.trim())
        .filter(Boolean),
      aiUsageLabel,
      aiNotes: aiNotes.trim() || null,
      sensitivityWarnings,
      risksExplanation: risksExplanation.trim() || null,
      satireDisclosure,
      legalAttestation,
    };

    setSubmitting(true);
    try {
      const result = await submitFromForm(payload);
      router.push(`/submit/thanks/${result.submissionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 40 }}>
        <h1 style={h1Style}>Submit a piece</h1>
        <p style={leadStyle}>
          We publish flash fiction (800–2500 words) anchored to real places.
          This form runs through an AI editor on submission; you’ll see the
          verdict right after you submit.
        </p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {/* ─── Title / abstract / language / author ─── */}
        <Section title="Your story" hint="The basics — title, language, author identity.">
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              maxLength={200}
            />
          </Field>
          <Field label="One-line abstract (optional)">
            <input
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              style={inputStyle}
              maxLength={300}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label="Source language">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                style={inputStyle}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </Field>
          </div>
          <Field label="Pen name (optional)" hint="If different from your legal name.">
            <input
              value={authorPenName}
              onChange={(e) => setAuthorPenName(e.target.value)}
              style={inputStyle}
              maxLength={120}
            />
          </Field>
        </Section>

        {/* ─── F1: scenes on the map ─── */}
        <Section
          title="F1 — Where does your story happen?"
          hint="Click on the map to drop a pin for each scene. You can drop up to 6. Drag pins to fine-tune their position. Pin order = narrative order."
        >
          <div style={{ position: "relative", width: "100%", height: 400, borderRadius: 4, overflow: "hidden", border: "1px solid #e8e3d8" }}>
            <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", top: 12, right: 12, padding: "6px 10px", background: "rgba(255,255,255,.92)", borderRadius: 3, fontFamily: "system-ui", fontSize: 11, color: "#555" }}>
              {scenes.length}/6 pins
            </div>
          </div>

          {scenes.length === 0 ? (
            <p style={mutedStyle}>No pins yet. Click on the map to place your first scene.</p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              {scenes.map((scene, idx) => (
                <li key={scene.id} style={{ border: "1px solid #e8e3d8", padding: 16, borderRadius: 4, background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <strong style={{ fontFamily: "system-ui", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#9b8a6b" }}>
                      Scene {String(idx + 1).padStart(2, "0")} · ({scene.longitude.toFixed(4)}, {scene.latitude.toFixed(4)})
                    </strong>
                    <button type="button" onClick={() => deleteScene(scene.id)} style={smallButtonStyle}>
                      remove
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>
                    <textarea
                      required
                      value={scene.content}
                      onChange={(e) => updateScene(scene.id, { content: e.target.value })}
                      style={{ ...inputStyle, minHeight: 120, fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6 }}
                      placeholder="What happens at this place? Write the scene here."
                    />
                    <div>
                      <label style={smallLabelStyle}>Event date (optional)</label>
                      <input
                        type="datetime-local"
                        value={scene.eventDate}
                        onChange={(e) => updateScene(scene.id, { eventDate: e.target.value })}
                        style={inputStyle}
                      />
                      <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>
                        {countWordsClient(scene.content)} words
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Total: <strong>{totalWords}</strong> words. Required range 800–2500.
          </div>

          <Field
            label="Why these places, in this order? (the relocation test)"
            hint={`At least 50 words (currently ${relocationWords}). What would break if the route were moved or reshuffled? Cite specific local features — geography, transit, language, ritual — not "the mood of the city."`}
          >
            <textarea
              required
              value={relocationTest}
              onChange={(e) => setRelocationTest(e.target.value)}
              style={{ ...inputStyle, minHeight: 140 }}
            />
          </Field>
        </Section>

        {/* ─── F2: affinity ─── */}
        <Section title="F2 — Your relationship to these places" hint="All six are equally valid — this just tells us your distance.">
          <Field>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value as AuthorRelationship)}
              style={inputStyle}
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          {(relationship === "lived_there" || relationship === "worked_there") && (
            <Field label="Duration / dates">
              <input
                value={relationshipDuration}
                onChange={(e) => setRelationshipDuration(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 2015–2020, or “3 years”"
              />
            </Field>
          )}
          <Field
            hint="If disclosing your relationship to this place could endanger you — exile, dissident writing, ongoing safety concerns — tick the box and we will hold the affinity in confidence and publish a redacted note in its place. (Constitution v0.2 / P4)"
          >
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={affinityConfidential}
                onChange={(e) => setAffinityConfidential(e.target.checked)}
              />
              <span>I request confidentiality for safety reasons.</span>
            </label>
            {affinityConfidential && (
              <input
                value={affinityConfidentialReason}
                onChange={(e) =>
                  setAffinityConfidentialReason(e.target.value)
                }
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder="Brief reason (kept private to editors)"
              />
            )}
          </Field>
        </Section>

        {/* ─── F3: story type ─── */}
        <Section title="F3 — Fiction or based on reality?">
          <Field>
            <label style={radioRowStyle}>
              <input
                type="radio"
                name="storyType"
                checked={storyType === "fiction"}
                onChange={() => setStoryType("fiction")}
              />
              <span>
                <strong>Fiction.</strong> People, events, conflicts are invented or altered enough to be unrecognizable.
              </span>
            </label>
            <label style={radioRowStyle}>
              <input
                type="radio"
                name="storyType"
                checked={storyType === "based_on_reality"}
                onChange={() => setStoryType("based_on_reality")}
              />
              <span>
                <strong>Based on reality.</strong> Real events or real people I witnessed, experienced, or carefully researched.
              </span>
            </label>
          </Field>
        </Section>

        {/* ─── F4: real people consent (conditional) ─── */}
        {showField4 && (
          <Section
            title="F4 — Real people"
            hint="You chose 'based on reality.' Tell us about any identifiable real people in the piece."
          >
            <Field>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={hasRealPeople}
                  onChange={(e) => setHasRealPeople(e.target.checked)}
                />
                <span>This story includes real, identifiable people.</span>
              </label>
            </Field>
            {hasRealPeople && (
              <>
                <Field label="Consent status">
                  <select
                    value={consentStatus}
                    onChange={(e) => setConsentStatus(e.target.value as ConsentStatus)}
                    style={inputStyle}
                  >
                    <option value="explicit">Yes — I have explicit consent</option>
                    <option value="deceased">No consent — the person is deceased</option>
                    <option value="public_figure">No consent — public figure in public conduct</option>
                    <option value="transformed">No consent — sufficiently transformed</option>
                    <option value="no_consent">No consent (none of the above)</option>
                  </select>
                </Field>
                <Field
                  label="Explanation (required if no explicit consent)"
                  hint="Brief — why is depicting this person without consent OK in this piece?"
                >
                  <textarea
                    value={consentExplanation}
                    onChange={(e) => setConsentExplanation(e.target.value)}
                    style={{ ...inputStyle, minHeight: 80 }}
                  />
                </Field>
                <Field label="Who are these people?" hint="Brief description; one per line or comma-separated.">
                  <textarea
                    value={realPersonsList}
                    onChange={(e) => setRealPersonsList(e.target.value)}
                    style={{ ...inputStyle, minHeight: 60 }}
                  />
                </Field>
              </>
            )}
          </Section>
        )}

        {/* ─── F5: AI in composition ─── */}
        <Section
          title="F5 — AI in writing this piece"
          hint="Be honest. AI translation ≠ AI creation. (Translator-side AI is logged separately on every translation row.)"
        >
          <Field>
            {AI_USAGE_OPTIONS.map((opt) => (
              <label key={opt.value} style={radioRowStyle}>
                <input
                  type="radio"
                  name="aiUsage"
                  checked={aiUsageLabel === opt.value}
                  onChange={() => setAiUsageLabel(opt.value)}
                />
                <span>
                  <strong>{opt.label}.</strong> <span style={{ color: "#666" }}>{opt.help}</span>
                </span>
              </label>
            ))}
          </Field>
          <Field label="Notes (optional)">
            <textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 60 }}
              placeholder="e.g. 'Used Claude to draft the opening, rewrote it myself.'"
            />
          </Field>
        </Section>

        {/* ─── F6: known harm risks ─── */}
        <Section
          title="F6 — Known harm risks"
          hint="Heads-up to the editorial team. Disclosing risks doesn't auto-reject — hiding them is what creates problems later."
        >
          <Field>
            {RISK_OPTIONS.map((r) => (
              <label key={r.value} style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={sensitivityWarnings.includes(r.value)}
                  onChange={() => toggleWarning(r.value)}
                />
                <span>{r.label}</span>
              </label>
            ))}
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={satireDisclosure}
                onChange={(e) => setSatireDisclosure(e.target.checked)}
              />
              <span>This piece is satirical.</span>
            </label>
          </Field>
          {showRiskExplanation && (
            <Field label="Explain (≥ 50 words)" hint="Required if you checked any risk above.">
              <textarea
                value={risksExplanation}
                onChange={(e) => setRisksExplanation(e.target.value)}
                style={{ ...inputStyle, minHeight: 100 }}
              />
            </Field>
          )}
        </Section>

        {/* ─── F7: legal attestation ─── */}
        <Section title="F7 — Attestation" hint="Your signature here is a legal statement.">
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={legalAttestation}
              onChange={(e) => setLegalAttestation(e.target.checked)}
            />
            <span>
              I have read and accept the{" "}
              <a href="/about/constitution" target="_blank" style={{ color: "#1a1a1a", textDecoration: "underline" }}>
                editorial constitution ({constitutionSignature})
              </a>
              . The information in this form is true and accurate. I am legally responsible
              for claims about real people. I understand the piece may be removed if legal
              issues arise.
            </span>
          </label>
        </Section>

        {error && (
          <div role="alert" style={{ padding: 14, background: "#fce9e9", border: "1px solid #dc2626", borderRadius: 4, color: "#7f1d1d", fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            alignSelf: "flex-start",
            padding: "14px 24px",
            background: submitting ? "#666" : "#1a1a1a",
            color: "white",
            border: "none",
            borderRadius: 4,
            fontFamily: "system-ui",
            fontSize: 15,
            letterSpacing: 0.4,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "AI editor is reading your piece — about 10 seconds…" : "Submit for editorial review"}
        </button>
      </form>
    </main>
  );
}

// ─── Layout primitives ─────────────────────────────────────────────────────

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <header>
        <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 22, fontWeight: 400, margin: 0, letterSpacing: -0.2 }}>
          {title}
        </h2>
        {hint && <p style={{ ...mutedStyle, marginTop: 4 }}>{hint}</p>}
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      {hint && <div style={{ ...mutedStyle, marginBottom: 6 }}>{hint}</div>}
      {children}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "60px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 40,
  fontWeight: 400,
  letterSpacing: -0.8,
  margin: 0,
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  color: "#555",
  lineHeight: 1.6,
  marginTop: 12,
};
const mutedStyle: React.CSSProperties = { fontSize: 12, color: "#888", lineHeight: 1.5 };
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 1.5,
  color: "#666",
  marginBottom: 6,
};
const smallLabelStyle: React.CSSProperties = { ...labelStyle, fontSize: 10, marginBottom: 4 };
const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "1px solid #c8c2b3",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
};
const radioRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "6px 0",
  fontSize: 14,
  cursor: "pointer",
};
const checkboxRowStyle: React.CSSProperties = { ...radioRowStyle };
const smallButtonStyle: React.CSSProperties = {
  border: "1px solid #c8c2b3",
  background: "white",
  padding: "3px 9px",
  fontSize: 11,
  letterSpacing: 0.4,
  borderRadius: 2,
  cursor: "pointer",
  color: "#666",
};
