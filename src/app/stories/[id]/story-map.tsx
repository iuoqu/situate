"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

import type { SupportedLanguage } from "@/db/schema";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (typeof window !== "undefined" && MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Map our internal locale codes to Mapbox Standard's basemap language IDs.
const MAPBOX_LANG: Record<SupportedLanguage, string> = {
  en: "en",
  zh_CN: "zh-Hans",
  zh_TW: "zh-Hant",
  ja: "ja",
  ko: "ko",
};

export interface MapPoint {
  blockId: string;
  longitude: number;
  latitude: number;
  ordinal: number;
}

const SECONDS_PER_PIN = 4;
const PITCH = 55;
const NEAR_ZOOM = 16;

/**
 * Atmospheric map at the top of /stories/[id]. Uses Mapbox Standard's 3D
 * buildings + terrain + day lighting to evoke the place, then on load
 * runs a cinematic flyTo tour through each pin in narrative order, ending
 * on a tilted overview that frames the whole route. A "Skip" button drops
 * straight to the overview; a "Replay" button restarts the tour.
 *
 * Numbered pins double as in-page anchors — clicking pin 02 smooth-scrolls
 * to <article id="block-2">.
 */
export function StoryMap({
  points,
  readerLanguage,
}: {
  points: MapPoint[];
  readerLanguage: SupportedLanguage;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const tourCancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const [tourPhase, setTourPhase] = useState<"idle" | "running" | "done">(
    "idle",
  );

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || points.length === 0) return;

    const sorted = [...points].sort((a, b) => a.ordinal - b.ordinal);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: [sorted[0].longitude, sorted[0].latitude],
      zoom: NEAR_ZOOM,
      pitch: PITCH,
      bearing: 0,
      interactive: false,
      attributionControl: false,
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    mapRef.current = map;

    map.on("style.load", () => {
      // Localize basemap labels to the reader's language.
      try {
        map.setConfigProperty(
          "basemap",
          "language",
          MAPBOX_LANG[readerLanguage] ?? "en",
        );
        // Standard's lighting preset; "dusk" gives long shadows that
        // emphasize the 3D buildings.
        map.setConfigProperty("basemap", "lightPreset", "dusk");
      } catch (_err) {
        // Older SDK / network blip — non-fatal, default lighting is fine.
      }

      // Route line between pins, dashed.
      if (sorted.length > 1) {
        map.addSource("story-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: sorted.map((p) => [p.longitude, p.latitude]),
            },
          },
        });
        map.addLayer({
          id: "story-route-line",
          type: "line",
          source: "story-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#ffffff",
            "line-width": 2,
            "line-dasharray": [2, 2],
            "line-opacity": 0.85,
          },
        });
      }

      // Numbered pins.
      for (const point of sorted) {
        const el = document.createElement("a");
        el.href = `#block-${point.ordinal}`;
        el.style.cssText = [
          "width:26px",
          "height:26px",
          "border-radius:50%",
          "background:#1a1a1a",
          "border:2px solid white",
          "color:white",
          "font-family:system-ui, sans-serif",
          "font-size:12px",
          "font-weight:700",
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "box-shadow:0 2px 8px rgba(0,0,0,.4)",
          "cursor:pointer",
          "text-decoration:none",
        ].join(";");
        el.textContent = String(point.ordinal).padStart(2, "0");
        el.addEventListener("click", (e) => {
          const target = document.getElementById(`block-${point.ordinal}`);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        new mapboxgl.Marker({ element: el })
          .setLngLat([point.longitude, point.latitude])
          .addTo(map);
      }

      // Kick off the cinematic tour after a brief pause to let the
      // initial frame breathe.
      setTimeout(() => runTour(map, sorted), 900);
    });

    async function runTour(m: mapboxgl.Map, pts: MapPoint[]) {
      tourCancelRef.current = { cancelled: false };
      const cancel = tourCancelRef.current;
      setTourPhase("running");

      for (let i = 0; i < pts.length; i++) {
        if (cancel.cancelled) return;
        const p = pts[i];
        // Compute bearing toward the next pin so the camera "faces forward"
        // through the route; on the final pin, hold the last bearing.
        const next = pts[i + 1] ?? p;
        const bearing = computeBearing(p, next);

        m.flyTo({
          center: [p.longitude, p.latitude],
          zoom: NEAR_ZOOM,
          pitch: PITCH,
          bearing,
          speed: 0.7,
          curve: 1.5,
          essential: true,
        });
        await wait(SECONDS_PER_PIN * 1000);
      }

      if (cancel.cancelled) return;
      settle(m, pts);
      setTourPhase("done");
    }

    return () => {
      tourCancelRef.current.cancelled = true;
      map.remove();
      mapRef.current = null;
    };
  }, [points, readerLanguage]);

  function settle(m: mapboxgl.Map, pts: MapPoint[]) {
    if (pts.length === 1) {
      m.flyTo({
        center: [pts[0].longitude, pts[0].latitude],
        zoom: 14,
        pitch: 35,
        bearing: 0,
        speed: 1.0,
      });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds();
    for (const p of pts) bounds.extend([p.longitude, p.latitude]);
    m.fitBounds(bounds, {
      padding: 80,
      pitch: 35,
      bearing: 0,
      duration: 2500,
    });
  }

  function skip() {
    if (!mapRef.current) return;
    tourCancelRef.current.cancelled = true;
    settle(mapRef.current, [...points].sort((a, b) => a.ordinal - b.ordinal));
    setTourPhase("done");
  }

  function replay() {
    if (!mapRef.current) return;
    const sorted = [...points].sort((a, b) => a.ordinal - b.ordinal);
    mapRef.current.flyTo({
      center: [sorted[0].longitude, sorted[0].latitude],
      zoom: NEAR_ZOOM,
      pitch: PITCH,
      bearing: 0,
      speed: 1.2,
    });
    setTimeout(() => {
      if (mapRef.current) {
        // re-trigger by toggling phase; the useEffect won't rerun since
        // points/readerLanguage haven't changed, so kick a manual tour.
        manualTour(mapRef.current, sorted);
      }
    }, 700);
  }

  async function manualTour(m: mapboxgl.Map, pts: MapPoint[]) {
    tourCancelRef.current = { cancelled: false };
    const cancel = tourCancelRef.current;
    setTourPhase("running");
    for (let i = 0; i < pts.length; i++) {
      if (cancel.cancelled) return;
      const p = pts[i];
      const next = pts[i + 1] ?? p;
      m.flyTo({
        center: [p.longitude, p.latitude],
        zoom: NEAR_ZOOM,
        pitch: PITCH,
        bearing: computeBearing(p, next),
        speed: 0.7,
        curve: 1.5,
        essential: true,
      });
      await wait(SECONDS_PER_PIN * 1000);
    }
    if (cancel.cancelled) return;
    settle(m, pts);
    setTourPhase("done");
  }

  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{
          padding: 24,
          background: "#f3eee0",
          borderRadius: 4,
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#7a6f55",
          marginBottom: 40,
        }}
      >
        Map preview disabled — NEXT_PUBLIC_MAPBOX_TOKEN is not set in this
        environment.
      </div>
    );
  }
  if (points.length === 0) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 400,
        marginBottom: 48,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #e8e3d8",
        boxShadow: "0 6px 24px rgba(0,0,0,0.08)",
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {tourPhase === "running" ? (
        <button
          onClick={skip}
          style={controlButtonStyle({ position: "top-right" })}
          aria-label="Skip the map intro"
        >
          Skip
        </button>
      ) : null}
      {tourPhase === "done" && points.length > 1 ? (
        <button
          onClick={replay}
          style={controlButtonStyle({ position: "top-right" })}
          aria-label="Replay the map tour"
        >
          ↻ Replay
        </button>
      ) : null}
    </div>
  );
}

function controlButtonStyle({
  position,
}: {
  position: "top-right";
}): React.CSSProperties {
  return {
    position: "absolute",
    top: 14,
    right: 14,
    padding: "6px 12px",
    background: "rgba(255,255,255,0.92)",
    color: "#1a1a1a",
    border: "none",
    borderRadius: 3,
    fontFamily: "system-ui, sans-serif",
    fontSize: 11,
    letterSpacing: 0.4,
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
    backdropFilter: "blur(6px)",
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Initial bearing from point `a` to point `b` (great-circle approximation,
// good enough at city scale where Mapbox draws its 3D camera anyway).
function computeBearing(a: MapPoint, b: MapPoint): number {
  if (a.longitude === b.longitude && a.latitude === b.latitude) return 0;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const λ1 = toRad(a.longitude);
  const λ2 = toRad(b.longitude);
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
