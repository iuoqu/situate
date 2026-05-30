"use client";

import mapboxgl from "mapbox-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Review & Submit — final pre-handoff page (Slice 4 multi-location
 * version).
 *
 * Locations are owned by the editor (per-section pins). This page is
 * pure display + submit:
 *
 *   1. Multi-pin map at the top showing every section with its own
 *      coordinate, numbered 01-05. Sections without their own coord
 *      don't get a marker; they inherit from upstream silently.
 *
 *   2. Assembled prose — each section preview gets a location chip
 *      that says either "📍 Outram, Singapore" (own coord) or
 *      "↑ same as 01" (inherited).
 *
 *   3. Submit panel: relocation-test prose (≥50 words), pen name,
 *      legal attestation. No global pin picker anymore; if Section 1
 *      doesn't have a coord we surface a gate ("Go back and set a
 *      location") and disable submit.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export interface SectionReviewView {
  index: number;
  section_id: string;
  content: string;
  label: string;
  ownLongitude: number | null;
  ownLatitude: number | null;
  resolvedLongitude: number | null;
  resolvedLatitude: number | null;
  resolvedPlaceDescription: string | null;
  hasOwnCoord: boolean;
}

interface TraditionInfo {
  id: string;
  name: string;
  /** Anchored traditions require Section 1 to have its own coordinate
   *  at submit time; Pearls (遗珠) does not. The submit-side validation
   *  in `submitFromDraft` is the source of truth — this just gates the
   *  button so authors don't surprise-fail on the server. */
  placeRequired: boolean;
}

interface Props {
  draftId: string;
  title: string;
  sections: SectionReviewView[];
  authorEmail: string;
  /** True when the viewer is on the STAFF_EMAILS list; gates the
   *  embedded coach diagnostic surface (currently a button that hands
   *  the joined prose off to /dev/coach-preview in a new tab). */
  isStaff: boolean;
  tradition: TraditionInfo;
}

export function ReviewAndSubmit({
  draftId,
  title,
  sections,
  authorEmail,
  isStaff,
  tradition,
}: Props) {
  const router = useRouter();
  const [relocationTest, setRelocationTest] = useState("");
  const [authorPenName, setAuthorPenName] = useState(
    authorEmail.split("@")[0] ?? "",
  );
  const [attestation, setAttestation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const sectionWordCounts = useMemo(
    () => sections.map((s) => countWords(s.content)),
    [sections],
  );
  const totalWords = sectionWordCounts.reduce((a, b) => a + b, 0);
  const relocationWords = useMemo(
    () => countWords(relocationTest),
    [relocationTest],
  );

  // Only sections that own their coord become map markers. Inherited
  // sections share a marker visually with whichever earlier section
  // they inherit from.
  const ownPins = useMemo(
    () => sections.filter((s) => s.hasOwnCoord),
    [sections],
  );

  const section1HasCoord =
    sections[0]?.ownLongitude !== null && sections[0]?.ownLatitude !== null;

  const wordsInRange = totalWords >= 800 && totalWords <= 2500;
  const relocationOk = relocationWords >= 50;
  // Pearls (遗珠) traditions allow submit without a Section 1 coord —
  // the carveout is exactly that the work isn't place-anchored. The
  // server-side validation in submitFromDraft reads the same
  // tradition.placeRequired flag, so this gate stays in sync.
  const placeGateOk = tradition.placeRequired ? section1HasCoord : true;
  const canSubmit =
    wordsInRange &&
    relocationOk &&
    placeGateOk &&
    attestation &&
    authorPenName.trim().length > 0 &&
    !submitting;

  // Initialise the map once.
  useEffect(() => {
    if (!mapContainer.current || mapRef.current || !MAPBOX_TOKEN) return;
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [0, 20],
      zoom: 1.5,
      interactive: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // Reconcile markers from `ownPins`.
  useEffect(() => {
    if (!mapRef.current) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    if (ownPins.length === 0) return;
    const lngs: number[] = [];
    const lats: number[] = [];
    for (const s of ownPins) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:26px;height:26px;border-radius:50%;background:#1a1a1a;color:white;border:2px solid white;display:flex;align-items:center;justify-content:center;font-family:system-ui;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3)";
      el.textContent = String(s.index + 1).padStart(2, "0");
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([s.ownLongitude!, s.ownLatitude!])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
      lngs.push(s.ownLongitude!);
      lats.push(s.ownLatitude!);
    }
    // Auto-fit to the spread of all pins, with a sensible single-pin
    // zoom when there's only one.
    if (ownPins.length === 1) {
      mapRef.current.setCenter([lngs[0], lats[0]]);
      mapRef.current.setZoom(10);
    } else {
      const bounds = new mapboxgl.LngLatBounds(
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      );
      mapRef.current.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 12 });
    }
  }, [ownPins]);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draftId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        <p style={kickerStyle}>
          Review &amp; submit · {tradition.name}
        </p>
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

      <section style={mapPanelStyle} aria-label="Story map">
        <div ref={mapContainer} style={mapStyle} />
        <p style={mapHintStyle}>
          {ownPins.length === 0
            ? tradition.placeRequired
              ? "No section has a location yet. Go back to the editor and drop a pin on Section 1 — Arrival."
              : "No section has a location — this is allowed for Pearls (遗珠). The piece will display off-map at 0°N 0°E."
            : ownPins.length === 1
              ? `1 location set — all sections will be filed under "${ownPins[0].resolvedPlaceDescription ?? formatCoord(ownPins[0].ownLongitude!, ownPins[0].ownLatitude!)}".`
              : `${ownPins.length} sections at distinct locations; the rest inherit.`}
        </p>
      </section>

      <section style={previewStyle} aria-label="Assembled draft">
        {sections.map((s, idx) => {
          const chip = s.hasOwnCoord
            ? {
                kind: "own" as const,
                text:
                  s.resolvedPlaceDescription ??
                  formatCoord(s.ownLongitude!, s.ownLatitude!),
              }
            : s.resolvedLongitude !== null && s.resolvedLatitude !== null
              ? {
                  kind: "inherited" as const,
                  text:
                    s.resolvedPlaceDescription ??
                    formatCoord(s.resolvedLongitude, s.resolvedLatitude),
                }
              : {
                  kind: "missing" as const,
                  text: "no location set",
                };
          return (
            <article key={s.section_id} style={sectionPreviewStyle}>
              <header style={sectionPreviewHeaderStyle}>
                <span style={sectionOrdinalStyle}>
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span style={sectionLabelStyle}>{s.label}</span>
                <span
                  style={
                    chip.kind === "missing"
                      ? chipMissingStyle
                      : chip.kind === "own"
                        ? chipOwnStyle
                        : chipInheritedStyle
                  }
                >
                  {chip.kind === "own"
                    ? "📍"
                    : chip.kind === "inherited"
                      ? "↑"
                      : "⚠"}{" "}
                  {chip.text}
                </span>
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
          );
        })}
      </section>

      {isStaff && (
        <StaffCoachButton sections={sections} title={title} />
      )}

      <section style={panelStyle} aria-label="Submission details">
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
            {!placeGateOk
              ? "Section 1 needs a location — go back to the editor and drop a pin."
              : !wordsInRange
                ? "Word count out of the 800–2,500 range."
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

// ── staff diagnostic hand-off ──────────────────────────────────────────────

/**
 * Staff-only button that joins the draft's section content and hands
 * it to /dev/coach-preview via localStorage. The dev tool then auto-
 * loads it into the textarea on mount.
 *
 * Why this indirection: /dev/coach-preview is the existing coach
 * surface and runs the full focused-diagnoser bank (stakes_absent,
 * causal_spine, inferred_intent's L1/L2/L3, economy, center_consensus).
 * Rather than duplicating that UI here, the staff workflow is "review
 * → click → diagnostic opens in new tab". When the embedded coach
 * graduates from staff-only to author-visible we'll integrate properly.
 */
const COACH_PREVIEW_LOCALSTORAGE_KEY = "coach-preview-pending-prose";

function StaffCoachButton({
  sections,
  title,
}: {
  sections: SectionReviewView[];
  title: string;
}) {
  const handleClick = () => {
    if (typeof window === "undefined") return;
    const labeled = sections
      .filter((s) => (s.content ?? "").trim().length > 0)
      .map((s) => `[${s.label}]\n${s.content.trim()}`)
      .join("\n\n");
    const titlePrefix = title.trim() ? `${title.trim()}\n\n` : "";
    window.localStorage.setItem(
      COACH_PREVIEW_LOCALSTORAGE_KEY,
      titlePrefix + labeled,
    );
    window.open("/dev/coach-preview", "_blank", "noopener,noreferrer");
  };
  return (
    <section
      style={{
        marginTop: 24,
        padding: 16,
        background: "#faf3e1",
        border: "1px dashed #d4b66a",
        borderRadius: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "#8a6d20",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        STAFF · 实验性诊断
      </div>
      <p
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          color: "#5a4810",
          lineHeight: 1.55,
        }}
      >
        把当前草稿（带 section 标签）发送到 /dev/coach-preview
        跑完整 diagnoser bank。新 tab 打开。只有 STAFF_EMAILS 列表里的账号能看到这个按钮。
      </p>
      <button
        onClick={handleClick}
        style={{
          padding: "8px 16px",
          background: "#8a6d20",
          color: "white",
          border: "none",
          borderRadius: 3,
          fontSize: 13,
          letterSpacing: 0.4,
          cursor: "pointer",
        }}
      >
        Run focused diagnoser bank →
      </button>
    </section>
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

function formatCoord(lng: number, lat: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
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
const mapPanelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginBottom: 28,
};
const mapStyle: React.CSSProperties = {
  height: 320,
  borderRadius: 3,
  overflow: "hidden",
  border: "1px solid #d4cfc2",
};
const mapHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#666",
  fontStyle: "italic",
};
const previewStyle: React.CSSProperties = {
  marginBottom: 32,
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
  alignItems: "center",
  gap: 10,
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: "1px dashed #e8e3d8",
  flexWrap: "wrap",
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
  minWidth: 0,
};
const sectionWordsStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.4,
  color: "#888",
  fontVariantNumeric: "tabular-nums",
};
const chipOwnStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 3,
  background: "#f0f9ff",
  border: "1px solid #bae6fd",
  color: "#075985",
  fontSize: 11,
  letterSpacing: 0.2,
};
const chipInheritedStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 3,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  color: "#666",
  fontSize: 11,
  letterSpacing: 0.2,
  fontStyle: "italic",
};
const chipMissingStyle: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 3,
  background: "#fef3c7",
  border: "1px solid #d97706",
  color: "#7c2d12",
  fontSize: 11,
  letterSpacing: 0.2,
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
