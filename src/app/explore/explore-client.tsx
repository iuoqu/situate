"use client";

import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNarrativeBlocksInBoundingBox,
  type ReaderAccessLevel,
  type ViewportBlock,
} from "@/app/actions";
import type { SupportedLanguage } from "@/db/schema";
import { renderTranslation } from "@/lib/rendering";

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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const latestRequestId = useRef(0);

  const [language, setLanguage] = useState<SupportedLanguage>("en");
  const [accessLevel, setAccessLevel] = useState<ReaderAccessLevel>("free");
  const [blocks, setBlocks] = useState<ViewportBlock[]>([]);
  const [selected, setSelected] = useState<ViewportBlock | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
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
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [139.7006, 35.6745], // Tokyo, between Shibuya and Shinjuku
      zoom: 12,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
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
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([block.longitude, block.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [blocks]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

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
        </aside>
      )}
    </div>
  );
}
