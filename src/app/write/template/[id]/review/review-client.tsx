"use client";

import mapboxgl from "mapbox-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Review & Submit — the Slice-1 minimum AssemblyView.
 *
 * Three things on one page:
 *
 *   1. The assembled draft: 5 sections stitched into continuous prose,
 *      shown the way it'll appear after editorial. Read-only — to edit,
 *      use the "Back to editing" link, which preserves autosaved state.
 *
 *   2. A single map picker. One pin for the whole story. (Slice-4 will
 *      replace this with the per-section MultiLocationPicker; the submit
 *      handoff already supports per-section coords falling back to the
 *      global one.)
 *
 *   3. The submission-form gating fields: relocation-test prose (≥50
 *      words — same rule as /submit), pen name (defaults to email
 *      local-part), legal attestation checkbox.
 *
 * Posts to /api/drafts/[id]/submit. On success, server returns
 * {redirectTo} pointing at /submit/thanks/[submissionId] — the existing
 * thank-you page covers the post-submit landing for now; Slice 3 will
 * replace it with /my/submissions/[id].
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

interface SectionView {
  index: number;
  section_id: string;
  content: string;
  label: string;
}

interface Props {
  draftId: string;
  title: string;
  sections: SectionView[];
  authorEmail: string;
}

export function ReviewAndSubmit({
  draftId,
  title,
  sections,
  authorEmail,
}: Props) {
  const router = useRouter();
  const [lng, setLng] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [relocationTest, setRelocationTest] = useState("");
  const [authorPenName, setAuthorPenName] = useState(
    authorEmail.split("@")[0] ?? "",
  );
  const [attestation, setAttestation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Word counts — Latin + CJK characters, same rule as the editor.
  const sectionWordCounts = useMemo(
    () => sections.map((s) => countWords(s.content)),
    [sections],
  );
  const totalWords = sectionWordCounts.reduce((a, b) => a + b, 0);
  const relocationWords = useMemo(
    () => countWords(relocationTest),
    [relocationTest],
  );

  // Gates: identical envelope to /submit so editorial logic doesn't
  // diverge between paths.
  const wordsInRange = totalWords >= 800 && totalWords <= 2500;
  const relocationOk = relocationWords >= 50;
  const hasCoord = lng !== null && lat !== null;
  const canSubmit =
    wordsInRange &&
    relocationOk &&
    hasCoord &&
    attestation &&
    authorPenName.trim().length > 0 &&
    !submitting;

  // Init the map once. Click drops/moves the pin.
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
      setLng(e.lngLat.lng);
      setLat(e.lngLat.lat);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Reconcile single marker.
  useEffect(() => {
    if (!mapRef.current) return;
    if (lng === null || lat === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:24px;height:24px;border-radius:50%;background:#1a1a1a;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:grab";
      markerRef.current = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
      markerRef.current.on("dragend", () => {
        const m = markerRef.current!.getLngLat();
        setLng(m.lng);
        setLat(m.lat);
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [lng, lat]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          longitude: lng,
          latitude: lat,
          relocationTest: relocationTest.trim(),
          legalAttestation: attestation,
          authorPenName: authorPenName.trim(),
        }),
      });
      const data = (await res.json()) as
        | { submissionId: string; redirectTo: string }
        | { error: string };
      if ("error" in data) {
        setError(data.error);
        setSubmitting(false);
        return;
      }
      // Surface the AI-editor latency briefly via the in-flight state,
      // then jump to the thanks page (which already shows the AI report).
      router.push(data.redirectTo);
    } catch {
      setError("Network error — please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <Link href={`/write/template/${draftId}`} style={backLinkStyle}>
          ← Back to editing
        </Link>
        <p style={kickerStyle}>Review &amp; submit</p>
        <h1 style={h1Style}>{title || "Untitled story"}</h1>
        <p style={metaStyle}>
          {totalWords} words ·{" "}
          {wordsInRange ? (
            <span style={okStyle}>within range</span>
          ) : totalWords < 800 ? (
            <span style={errStyle}>need at least 800 words</span>
          ) : (
            <span style={errStyle}>over 2,500 — trim before submitting</span>
          )}
        </p>
      </header>

      <section style={previewStyle} aria-label="Assembled draft">
        {sections.map((s, idx) => (
          <article key={s.section_id} style={sectionPreviewStyle}>
            <header style={sectionPreviewHeaderStyle}>
              <span style={sectionOrdinalStyle}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span style={sectionLabelStyle}>{s.label}</span>
              <span style={sectionWordsStyle}>
                {sectionWordCounts[idx]} words
              </span>
            </header>
            {s.content.trim() ? (
              <div style={proseStyle}>
                {s.content.split(/\n+/).map((para, i) => (
                  <p key={i} style={paraStyle}>
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p style={emptySectionStyle}>(empty)</p>
            )}
          </article>
        ))}
      </section>

      <section style={panelStyle} aria-label="Submission details">
        <h2 style={panelTitleStyle}>Where does this story live?</h2>
        <p style={panelLeadStyle}>
          Click the map to drop a pin. In Slice 4 you&rsquo;ll be able
          to set a different pin per section; for now one coordinate
          anchors the whole story.
        </p>
        <div ref={mapContainer} style={mapStyle} />
        {lng !== null && lat !== null && (
          <p style={coordStyle}>
            <strong>{lat.toFixed(4)}, {lng.toFixed(4)}</strong>
          </p>
        )}

        <Label>
          Why this place, in this story?
          <Hint>
            At least 50 words. The editorial heuristic{" "}
            <em>could this story be set somewhere else?</em> reads this
            field first.
          </Hint>
          <textarea
            value={relocationTest}
            onChange={(e) => setRelocationTest(e.target.value)}
            rows={4}
            style={textareaStyle}
            disabled={submitting}
            placeholder="What about this place made this story possible? Not a summary of the place — what about it shows up in the prose."
          />
          <Counter
            current={relocationWords}
            min={50}
            label={`${relocationWords} words`}
          />
        </Label>

        <Label>
          Pen name
          <Hint>
            How your byline will read. Defaults to the local part of
            your email; change to anything.
          </Hint>
          <input
            type="text"
            value={authorPenName}
            onChange={(e) => setAuthorPenName(e.target.value)}
            maxLength={80}
            style={inputStyle}
            disabled={submitting}
          />
        </Label>

        <label style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={attestation}
            onChange={(e) => setAttestation(e.target.checked)}
            disabled={submitting}
          />
          <span style={checkboxLabelStyle}>
            I attest this story is mine to submit. If it references real
            people or places, I&rsquo;ve thought carefully about the
            disclosures (P5–P7 of the constitution); the editor will
            ask if anything is unclear.
          </span>
        </label>

        {error && (
          <div role="alert" style={errorBoxStyle}>
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          style={canSubmit ? primaryButtonStyle : primaryButtonDisabledStyle}
        >
          {submitting
            ? "Submitting — AI editor reviewing…"
            : "Submit for editorial review →"}
        </button>

        {!canSubmit && !submitting && (
          <p style={hintStyle}>
            {!wordsInRange
              ? "Word count out of the 800–2,500 range."
              : !hasCoord
                ? "Drop a pin on the map first."
                : !relocationOk
                  ? "Relocation test needs at least 50 words."
                  : !attestation
                    ? "Tick the attestation to continue."
                    : "Fill in your pen name."}
          </p>
        )}
      </section>
    </main>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed
    .split(/\s+/)
    .filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={labelStyle}>{children}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <span style={hintBlockStyle}>{children}</span>;
}
function Counter({
  current,
  min,
  label,
}: {
  current: number;
  min: number;
  label: string;
}) {
  return (
    <span style={current >= min ? counterOkStyle : counterPendingStyle}>
      {label}
      {current < min ? ` · need ${min - current} more` : " ✓"}
    </span>
  );
}

// ── styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "60px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const backLinkStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 0.5,
  color: "#666",
  textDecoration: "none",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: "8px 0 0",
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 38,
  fontWeight: 400,
  letterSpacing: -0.6,
  margin: "8px 0 8px",
};
const metaStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#888",
  margin: 0,
};
const okStyle: React.CSSProperties = { color: "#3a6b3a" };
const errStyle: React.CSSProperties = { color: "#7f1d1d" };
const previewStyle: React.CSSProperties = {
  marginTop: 30,
  marginBottom: 40,
  padding: 24,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
};
const sectionPreviewStyle: React.CSSProperties = {
  marginBottom: 28,
};
const sectionPreviewHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 10,
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: "1px dashed #e8e3d8",
};
const sectionOrdinalStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 14,
  color: "#9b8a6b",
};
const sectionLabelStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  color: "#1a1a1a",
  flex: 1,
};
const sectionWordsStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.4,
  color: "#888",
  fontVariantNumeric: "tabular-nums",
};
const proseStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const paraStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  lineHeight: 1.75,
  color: "#1a1a1a",
};
const emptySectionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontStyle: "italic",
  color: "#aaa",
};
const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  padding: 24,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
};
const panelTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 24,
  fontWeight: 400,
  margin: 0,
};
const panelLeadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#555",
  lineHeight: 1.6,
};
const mapStyle: React.CSSProperties = {
  height: 320,
  borderRadius: 3,
  overflow: "hidden",
  border: "1px solid #d4cfc2",
};
const coordStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#666",
  fontVariantNumeric: "tabular-nums",
};
const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: "#666",
};
const hintBlockStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#888",
  textTransform: "none",
  letterSpacing: 0,
  lineHeight: 1.55,
};
const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  lineHeight: 1.7,
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
  resize: "vertical",
  minHeight: 110,
};
const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontFamily: "inherit",
  fontSize: 14,
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
};
const counterOkStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.3,
  color: "#3a6b3a",
};
const counterPendingStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.3,
  color: "#9b8a6b",
};
const checkboxRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
};
const checkboxLabelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#444",
  lineHeight: 1.55,
};
const primaryButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "14px 22px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};
const primaryButtonDisabledStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#c5beac",
  cursor: "not-allowed",
};
const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#9b8a6b",
};
const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: "#fce9e9",
  border: "1px solid #dc2626",
  borderRadius: 3,
  color: "#7f1d1d",
  fontSize: 13,
};
