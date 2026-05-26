"use client";

import mapboxgl from "mapbox-gl";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNarrativeBlocksInBoundingBox,
  type ReaderAccessLevel,
  type ViewportBlock,
} from "@/app/actions";
import type { SupportedLanguage } from "@/db/schema";
import {
  ACCESS_COOKIE,
  isSupportedAccess,
  isSupportedLang,
  LANG_COOKIE,
  writeReaderPrefAccess,
  writeReaderPrefLang,
} from "@/lib/reader-prefs";
import { renderTranslation } from "@/lib/rendering";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[.$?*|{}()[\]\\\/+^]/g, "\\$&") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Public Mapbox token. Safe to expose to the browser when restricted to
// allowed URLs in the Mapbox dashboard. Set in `.env` (local) or in your
// hosting provider's environment variables (Vercel etc.).
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Editorial-leaning default. Swap in a custom Mapbox Studio style URL
// (`mapbox://styles/<account>/<style-id>`) once the brand visual is set.
const MAP_STYLE = "mapbox://styles/mapbox/light-v11";

const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "zh_CN", label: "简体中文" },
  { value: "zh_TW", label: "繁體中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const ACCESS_LEVELS: { value: ReaderAccessLevel; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "metered", label: "Free + metered" },
  { value: "premium", label: "Premium (incl. human translations)" },
];

const TIER_BADGE: Record<ViewportBlock["accessTier"], string> = {
  free: "#16a34a",
  metered: "#ca8a04",
  premium: "#9333ea",
};

export function ExploreClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const latestRequestId = useRef(0);

  const [language, setLanguageState] = useState<SupportedLanguage>("en");
  const [accessLevel, setAccessLevelState] = useState<ReaderAccessLevel>("free");

  // Hydrate preferences from cookies on mount. We default to 'en' / 'free'
  // for the SSR render to avoid a hydration mismatch, then upgrade.
  useEffect(() => {
    const c = readCookie(LANG_COOKIE);
    if (isSupportedLang(c)) setLanguageState(c);
    const a = readCookie(ACCESS_COOKIE);
    if (isSupportedAccess(a)) setAccessLevelState(a);
  }, []);

  function setLanguage(next: SupportedLanguage) {
    writeReaderPrefLang(next);
    setLanguageState(next);
  }
  function setAccessLevel(next: ReaderAccessLevel) {
    writeReaderPrefAccess(next);
    setAccessLevelState(next);
  }
  const [blocks, setBlocks] = useState<ViewportBlock[]>([]);
  const [selected, setSelected] = useState<ViewportBlock | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return; // mapbox-gl can return null before the map sizes itself
    const requestId = ++latestRequestId.current;
    setLoading(true);
    try {
      const result = await getNarrativeBlocksInBoundingBox(
        {
          minLong: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLong: bounds.getEast(),
          maxLat: bounds.getNorth(),
        },
        { readerLanguage: language, accessLevel },
      );
      // Discard stale responses if the user kept panning.
      if (requestId === latestRequestId.current) {
        setBlocks(result);
      }
    } catch (err) {
      console.error("viewport query failed:", err);
    } finally {
      if (requestId === latestRequestId.current) setLoading(false);
    }
  }, [language, accessLevel]);

  // Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      console.error(
        "NEXT_PUBLIC_MAPBOX_TOKEN is not set. Get a public token at https://account.mapbox.com/access-tokens/ and add it to .env or your hosting provider's environment variables.",
      );
      return;
    }
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [139.7006, 35.6745], // Tokyo, between Shibuya and Shinjuku
      zoom: 12,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
    mapRef.current = map;
    // Bounds are available immediately after construction; firing refresh
    // here means pins surface even if the base-map tiles are slow or
    // unreachable, instead of waiting for the 'load' event that never
    // arrives on a flaky network.
    void refresh();
    map.on("load", () => void refresh());
    map.on("moveend", () => void refresh());
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // refresh is intentionally excluded — re-creating the map on every
    // language/access change is wasteful; we wire that via a separate effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when reader settings (language / accessLevel) change.
  // Don't gate on map.loaded() — a failed/slow base-map style would leave
  // loaded() === false forever and language switches would silently no-op.
  useEffect(() => {
    if (mapRef.current) {
      setSelected(null); // close the open story so it doesn't show stale content
      void refresh();
    }
  }, [refresh]);

  // Sync markers to the current block list.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const block of blocks) {
      const el = document.createElement("div");
      el.style.cssText = [
        "width:14px",
        "height:14px",
        "border-radius:50%",
        `background:${TIER_BADGE[block.accessTier]}`,
        "border:2px solid white",
        "cursor:pointer",
        "box-shadow:0 1px 4px rgba(0,0,0,.25)",
      ].join(";");
      el.title = `${block.method.replace("_", " ")} · ${block.language}`;
      el.addEventListener("click", () => setSelected(block));
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([block.longitude, block.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [blocks]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, background: "#fafaf7" }} />

      {!MAPBOX_TOKEN && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(250,250,247,.96)",
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 440,
              padding: 28,
              background: "white",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontFamily: 'Georgia, "Times New Roman", serif',
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 10 }}>Mapbox token missing</div>
            <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
              Set <code style={{ background: "#f3f3ef", padding: "1px 5px", fontFamily: "monospace" }}>NEXT_PUBLIC_MAPBOX_TOKEN</code> in
              your <code style={{ background: "#f3f3ef", padding: "1px 5px", fontFamily: "monospace" }}>.env</code> file
              (local) or in your hosting provider&apos;s environment variables.
              Get a public token at{" "}
              <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noreferrer">
                account.mapbox.com/access-tokens
              </a>
              .
            </div>
          </div>
        </div>
      )}


      {/* Reader controls */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          background: "white",
          padding: "12px 14px",
          borderRadius: 6,
          boxShadow: "0 2px 10px rgba(0,0,0,.12)",
          fontSize: 13,
          minWidth: 230,
        }}
      >
        <div
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontWeight: 400,
            fontSize: 18,
            letterSpacing: -0.3,
            marginBottom: 4,
          }}
        >
          Situate Editions
        </div>
        <div style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
          {loading ? "loading…" : `${blocks.length} pin(s) in view`}
        </div>

        <label
          style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 2 }}
        >
          Reader language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
          style={{
            width: "100%",
            padding: "4px 6px",
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <label
          style={{ display: "block", fontSize: 11, color: "#888", marginBottom: 2 }}
        >
          Access tier
        </label>
        <select
          value={accessLevel}
          onChange={(e) => setAccessLevel(e.target.value as ReaderAccessLevel)}
          style={{ width: "100%", padding: "4px 6px", fontSize: 13 }}
        >
          {ACCESS_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <div style={{ marginTop: 10, fontSize: 11, color: "#888" }}>
          Pin color = tier ·
          <span style={{ color: TIER_BADGE.free, marginLeft: 4 }}>● free</span>
          <span style={{ color: TIER_BADGE.metered, marginLeft: 6 }}>● metered</span>
          <span style={{ color: TIER_BADGE.premium, marginLeft: 6 }}>● premium</span>
        </div>
      </div>

      {/* Story panel */}
      {selected && (
        <aside
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 420,
            background: "white",
            padding: "28px 28px 40px",
            overflowY: "auto",
            boxShadow: "-6px 0 18px rgba(0,0,0,.08)",
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          <button
            onClick={() => setSelected(null)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 12,
              right: 14,
              border: "none",
              background: "transparent",
              fontSize: 22,
              cursor: "pointer",
              color: "#888",
              fontFamily: "system-ui",
            }}
          >
            ×
          </button>
          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: TIER_BADGE[selected.accessTier],
              fontFamily: "system-ui",
              fontWeight: 600,
            }}
          >
            {selected.method.replace("_", " ")} · {selected.language} ·{" "}
            {selected.accessTier}
          </div>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              marginTop: 14,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderTranslation(selected.content, selected.annotations)}
          </p>
          <div
            style={{
              fontSize: 11,
              color: "#999",
              fontFamily: "system-ui",
              marginTop: 18,
              borderTop: "1px solid #eee",
              paddingTop: 10,
            }}
          >
            {selected.eventDate ? (
              <div>
                {new Date(selected.eventDate).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
            ) : null}
            <div>
              ({selected.longitude.toFixed(4)}, {selected.latitude.toFixed(4)})
            </div>
            {selected.editionId ? (
              <div>edition {selected.editionId.slice(0, 8)}…</div>
            ) : (
              <div>evergreen</div>
            )}
          </div>
          <Link
            href={`/stories/${selected.submissionId}?lang=${language}`}
            style={{
              display: "inline-block",
              marginTop: 24,
              padding: "9px 14px",
              background: "#1a1a1a",
              color: "white",
              textDecoration: "none",
              borderRadius: 3,
              fontFamily: "system-ui",
              fontSize: 12,
              letterSpacing: 0.4,
            }}
          >
            Read full piece →
          </Link>
        </aside>
      )}
    </div>
  );
}
