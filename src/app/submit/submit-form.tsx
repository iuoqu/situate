"use client";

import mapboxgl from "mapbox-gl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { submitFromForm, type SubmitFormPayload } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import type {
  AiUsageLabel,
  AuthorRelationship,
  ConsentStatus,
  StoryType,
  SupportedLanguage,
} from "@/db/schema";
import { t } from "@/lib/i18n";

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
  locale,
  constitutionSignature,
}: {
  locale: SupportedLanguage;
  constitutionSignature: string;
}) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // F7 metadata
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [authorEmail, setAuthorEmail] = useState("");
  const [authorPenName, setAuthorPenName] = useState("");

  // F1 scenes
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [relocationTest, setRelocationTest] = useState("");

  // F2
  const [relationship, setRelationship] = useState<AuthorRelationship>("lived_there");
  const [relationshipDuration, setRelationshipDuration] = useState("");
  const [affinityConfidential, setAffinityConfidential] = useState(false);
  const [affinityConfidentialReason, setAffinityConfidentialReason] = useState("");

  // F3
  const [storyType, setStoryType] = useState<StoryType>("fiction");

  // F4
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

  const totalWords = scenes.reduce((sum, s) => sum + countWordsClient(s.content), 0);
  const relocationWords = countWordsClient(relocationTest);
  const showField4 = storyType === "based_on_reality";
  const showRiskExplanation = sensitivityWarnings.length > 0;

  // Localised option lists — re-derived per render so locale changes
  // (rare in practice, but possible) propagate immediately.
  const RELATIONSHIPS: { value: AuthorRelationship; label: string }[] = [
    { value: "born_there", label: t(locale, "submit.rel_born_there") },
    { value: "lived_there", label: t(locale, "submit.rel_lived_there") },
    { value: "worked_there", label: t(locale, "submit.rel_worked_there") },
    { value: "researched", label: t(locale, "submit.rel_researched") },
    { value: "passing_through", label: t(locale, "submit.rel_passing_through") },
    { value: "never_been", label: t(locale, "submit.rel_never_been") },
  ];
  const RISK_OPTIONS: { value: string; label: string }[] = [
    { value: "recently_deceased", label: t(locale, "submit.risk_recently_deceased") },
    { value: "recent_disaster", label: t(locale, "submit.risk_recent_disaster") },
    { value: "ongoing_conflict", label: t(locale, "submit.risk_ongoing_conflict") },
    { value: "strong_local_reaction", label: t(locale, "submit.risk_strong_local_reaction") },
  ];
  const AI_USAGE_OPTIONS: { value: AiUsageLabel; label: string; help: string }[] = [
    { value: "human_written", label: t(locale, "submit.ai_human_written"), help: t(locale, "submit.ai_human_written_desc") },
    { value: "human_written_ai_translated", label: t(locale, "submit.ai_translated"), help: t(locale, "submit.ai_translated_desc") },
    { value: "ai_assisted", label: t(locale, "submit.ai_assisted"), help: t(locale, "submit.ai_assisted_desc") },
    { value: "ai_created", label: t(locale, "submit.ai_created"), help: t(locale, "submit.ai_created_desc") },
  ];

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
      setError(t(locale, "submit.err_no_pins"));
      return;
    }
    if (totalWords < 800 || totalWords > 2500) {
      setError(t(locale, "submit.err_word_count", { count: totalWords }));
      return;
    }
    if (relocationWords < 50) {
      setError(t(locale, "submit.err_relocation_too_short", { count: relocationWords }));
      return;
    }
    if (!legalAttestation) {
      setError(t(locale, "submit.err_attestation_required"));
      return;
    }

    const payload: SubmitFormPayload = {
      title: title.trim(),
      abstract: abstract.trim() || null,
      wordCount: totalWords,
      language,
      authorEmail: authorEmail.trim(),
      authorPenName: authorPenName.trim() || null,
      authorId: authorEmail.trim(),
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
      consentStatus:
        storyType === "based_on_reality" && hasRealPeople
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
      // Server-side error messages are English (developer-oriented). UX-
      // critical errors are caught client-side above and localised.
      setError(err instanceof Error ? err.message : "Submission failed.");
      setSubmitting(false);
    }
  }

  // Render the F7 attestation text with the {constitution_link} placeholder
  // replaced by an anchor tag, preserving any locale-specific surround.
  const attestationTemplate = t(locale, "submit.attestation_text");
  const constitutionLinkLabel = t(locale, "submit.attestation_constitution_link", {
    signature: constitutionSignature,
  });
  const attestationParts = attestationTemplate.split("{constitution_link}");

  return (
    <main style={mainStyle}>
      <LangSwitch current={locale} />

      <header style={{ marginBottom: 40 }}>
        <h1 style={h1Style}>{t(locale, "submit.page_title")}</h1>
        <p style={leadStyle}>{t(locale, "submit.lead")}</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 36 }}>
        {/* ─── Your story ─── */}
        <Section
          title={t(locale, "submit.section_your_story_title")}
          hint={t(locale, "submit.section_your_story_hint")}
        >
          <Field label={t(locale, "submit.field_title")}>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
              maxLength={200}
            />
          </Field>
          <Field label={t(locale, "submit.field_abstract")}>
            <input
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              style={inputStyle}
              maxLength={300}
            />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Field label={t(locale, "submit.field_source_language")}>
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
            <Field label={t(locale, "submit.field_email")}>
              <input
                required
                type="email"
                value={authorEmail}
                onChange={(e) => setAuthorEmail(e.target.value)}
                style={inputStyle}
                placeholder={t(locale, "submit.email_placeholder")}
              />
            </Field>
          </div>
          <Field
            label={t(locale, "submit.field_pen_name")}
            hint={t(locale, "submit.field_pen_name_hint")}
          >
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
          title={t(locale, "submit.section_f1_title")}
          hint={t(locale, "submit.section_f1_hint")}
        >
          <div style={{ position: "relative", width: "100%", height: 400, borderRadius: 4, overflow: "hidden", border: "1px solid #e8e3d8" }}>
            <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />
            <div style={{ position: "absolute", top: 12, right: 12, padding: "6px 10px", background: "rgba(255,255,255,.92)", borderRadius: 3, fontFamily: "system-ui", fontSize: 11, color: "#555" }}>
              {t(locale, "submit.pins_indicator", { current: scenes.length })}
            </div>
          </div>

          {scenes.length === 0 ? (
            <p style={mutedStyle}>{t(locale, "submit.pins_empty")}</p>
          ) : (
            <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              {scenes.map((scene, idx) => (
                <li key={scene.id} style={{ border: "1px solid #e8e3d8", padding: 16, borderRadius: 4, background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                    <strong style={{ fontFamily: "system-ui", fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#9b8a6b" }}>
                      {t(locale, "submit.scene_label", {
                        ordinal: String(idx + 1).padStart(2, "0"),
                        lon: scene.longitude.toFixed(4),
                        lat: scene.latitude.toFixed(4),
                      })}
                    </strong>
                    <button type="button" onClick={() => deleteScene(scene.id)} style={smallButtonStyle}>
                      {t(locale, "submit.scene_remove")}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12 }}>
                    <textarea
                      required
                      value={scene.content}
                      onChange={(e) => updateScene(scene.id, { content: e.target.value })}
                      style={{ ...inputStyle, minHeight: 120, fontFamily: 'Georgia, "Times New Roman", serif', lineHeight: 1.6 }}
                      placeholder={t(locale, "submit.scene_content_placeholder")}
                    />
                    <div>
                      <label style={smallLabelStyle}>
                        {t(locale, "submit.scene_event_date")}
                      </label>
                      <input
                        type="datetime-local"
                        value={scene.eventDate}
                        onChange={(e) => updateScene(scene.id, { eventDate: e.target.value })}
                        style={inputStyle}
                      />
                      <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>
                        {t(locale, "submit.scene_word_count", { count: countWordsClient(scene.content) })}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            {t(locale, "submit.total_words_line", { count: totalWords })}
          </div>

          <Field
            label={t(locale, "submit.field_relocation_test")}
            hint={t(locale, "submit.field_relocation_test_hint", { count: relocationWords })}
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
        <Section
          title={t(locale, "submit.section_f2_title")}
          hint={t(locale, "submit.section_f2_hint")}
        >
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
            <Field label={t(locale, "submit.field_duration")}>
              <input
                value={relationshipDuration}
                onChange={(e) => setRelationshipDuration(e.target.value)}
                style={inputStyle}
                placeholder={t(locale, "submit.duration_placeholder")}
              />
            </Field>
          )}
          <Field hint={t(locale, "submit.confidentiality_hint")}>
            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={affinityConfidential}
                onChange={(e) => setAffinityConfidential(e.target.checked)}
              />
              <span>{t(locale, "submit.confidentiality_checkbox")}</span>
            </label>
            {affinityConfidential && (
              <input
                value={affinityConfidentialReason}
                onChange={(e) => setAffinityConfidentialReason(e.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
                placeholder={t(locale, "submit.confidentiality_reason_placeholder")}
              />
            )}
          </Field>
        </Section>

        {/* ─── F3: story type ─── */}
        <Section title={t(locale, "submit.section_f3_title")}>
          <Field>
            <label style={radioRowStyle}>
              <input
                type="radio"
                name="storyType"
                checked={storyType === "fiction"}
                onChange={() => setStoryType("fiction")}
              />
              <span>
                <strong>{t(locale, "submit.story_type_fiction")}</strong>{" "}
                {t(locale, "submit.story_type_fiction_desc")}
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
                <strong>{t(locale, "submit.story_type_reality")}</strong>{" "}
                {t(locale, "submit.story_type_reality_desc")}
              </span>
            </label>
          </Field>
        </Section>

        {/* ─── F4: real people consent (conditional) ─── */}
        {showField4 && (
          <Section
            title={t(locale, "submit.section_f4_title")}
            hint={t(locale, "submit.section_f4_hint")}
          >
            <Field>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={hasRealPeople}
                  onChange={(e) => setHasRealPeople(e.target.checked)}
                />
                <span>{t(locale, "submit.f4_has_real_people")}</span>
              </label>
            </Field>
            {hasRealPeople && (
              <>
                <Field label={t(locale, "submit.field_consent_status")}>
                  <select
                    value={consentStatus}
                    onChange={(e) => setConsentStatus(e.target.value as ConsentStatus)}
                    style={inputStyle}
                  >
                    <option value="explicit">{t(locale, "submit.consent_explicit")}</option>
                    <option value="deceased">{t(locale, "submit.consent_deceased")}</option>
                    <option value="public_figure">{t(locale, "submit.consent_public_figure")}</option>
                    <option value="transformed">{t(locale, "submit.consent_transformed")}</option>
                    <option value="no_consent">{t(locale, "submit.consent_no_consent")}</option>
                  </select>
                </Field>
                <Field
                  label={t(locale, "submit.field_consent_explanation")}
                  hint={t(locale, "submit.field_consent_explanation_hint")}
                >
                  <textarea
                    value={consentExplanation}
                    onChange={(e) => setConsentExplanation(e.target.value)}
                    style={{ ...inputStyle, minHeight: 80 }}
                  />
                </Field>
                <Field
                  label={t(locale, "submit.field_real_persons_list")}
                  hint={t(locale, "submit.field_real_persons_list_hint")}
                >
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
          title={t(locale, "submit.section_f5_title")}
          hint={t(locale, "submit.section_f5_hint")}
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
                  <strong>{opt.label}</strong>{" "}
                  <span style={{ color: "#666" }}>{opt.help}</span>
                </span>
              </label>
            ))}
          </Field>
          <Field label={t(locale, "submit.field_ai_notes")}>
            <textarea
              value={aiNotes}
              onChange={(e) => setAiNotes(e.target.value)}
              style={{ ...inputStyle, minHeight: 60 }}
              placeholder={t(locale, "submit.ai_notes_placeholder")}
            />
          </Field>
        </Section>

        {/* ─── F6: known harm risks ─── */}
        <Section
          title={t(locale, "submit.section_f6_title")}
          hint={t(locale, "submit.section_f6_hint")}
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
              <span>{t(locale, "submit.risk_satire")}</span>
            </label>
          </Field>
          {showRiskExplanation && (
            <Field
              label={t(locale, "submit.field_risks_explanation")}
              hint={t(locale, "submit.field_risks_explanation_hint")}
            >
              <textarea
                value={risksExplanation}
                onChange={(e) => setRisksExplanation(e.target.value)}
                style={{ ...inputStyle, minHeight: 100 }}
              />
            </Field>
          )}
        </Section>

        {/* ─── F7: legal attestation ─── */}
        <Section
          title={t(locale, "submit.section_f7_title")}
          hint={t(locale, "submit.section_f7_hint")}
        >
          <label style={checkboxRowStyle}>
            <input
              type="checkbox"
              checked={legalAttestation}
              onChange={(e) => setLegalAttestation(e.target.checked)}
            />
            <span>
              {attestationParts[0]}
              <a
                href="/about/constitution"
                target="_blank"
                style={{ color: "#1a1a1a", textDecoration: "underline" }}
              >
                {constitutionLinkLabel}
              </a>
              {attestationParts[1]}
            </span>
          </label>
        </Section>

        {error && (
          <div
            role="alert"
            style={{
              padding: 14,
              background: "#fce9e9",
              border: "1px solid #dc2626",
              borderRadius: 4,
              color: "#7f1d1d",
              fontSize: 14,
            }}
          >
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
          {submitting
            ? t(locale, "submit.button_submit_loading")
            : t(locale, "submit.button_submit")}
        </button>
      </form>
    </main>
  );
}

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
