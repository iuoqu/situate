"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

if (typeof window !== "undefined" && MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export interface MapPoint {
  blockId: string;
  longitude: number;
  latitude: number;
  ordinal: number; // 1-indexed, matches the rendered "01 / 02 / …" in the page
}

/**
 * Small, non-interactive map at the top of /stories/[id] showing where each
 * block in the piece is anchored, with a dashed line connecting them in
 * narrative order. Numbered pins double as in-page anchors (click → scroll
 * to the matching block).
 */
export function StoryMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN || points.length === 0) return;

    const center: [number, number] =
      points.length === 1
        ? [points[0].longitude, points[0].latitude]
        : averageCenter(points);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom: 12,
      interactive: false, // small inline map; full map lives at /explore
      attributionControl: false,
    });
    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    map.on("load", () => {
      if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const p of points) bounds.extend([p.longitude, p.latitude]);
        map.fitBounds(bounds, { padding: 48, animate: false });

        const sorted = [...points].sort((a, b) => a.ordinal - b.ordinal);
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
            "line-color": "#1a1a1a",
            "line-width": 1.2,
            "line-dasharray": [2, 2],
            "line-opacity": 0.55,
          },
        });
      }

      for (const point of points) {
        const el = document.createElement("a");
        el.href = `#block-${point.ordinal}`;
        el.style.cssText = [
          "width:22px",
          "height:22px",
          "border-radius:50%",
          "background:#1a1a1a",
          "border:2px solid white",
          "color:white",
          "font-family:system-ui, sans-serif",
          "font-size:11px",
          "font-weight:600",
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "box-shadow:0 1px 4px rgba(0,0,0,.25)",
          "cursor:pointer",
          "text-decoration:none",
        ].join(";");
        el.textContent = String(point.ordinal).padStart(2, "0");
        el.addEventListener("click", (e) => {
          // Smooth-scroll behaviour without leaving a "#…" in the URL
          // permanently; let the default anchor jump happen as a fallback.
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
    });

    return () => map.remove();
  }, [points]);

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
      ref={containerRef}
      aria-label="Map of every block in this piece"
      style={{
        width: "100%",
        height: 260,
        marginBottom: 40,
        borderRadius: 4,
        overflow: "hidden",
        border: "1px solid #e8e3d8",
      }}
    />
  );
}

function averageCenter(points: MapPoint[]): [number, number] {
  let sumLon = 0;
  let sumLat = 0;
  for (const p of points) {
    sumLon += p.longitude;
    sumLat += p.latitude;
  }
  return [sumLon / points.length, sumLat / points.length];
}
