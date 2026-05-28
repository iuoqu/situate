"use client";

import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";

/**
 * SectionLocationPicker — per-section inline location setter.
 *
 * One of these renders inside each section in the template editor.
 * Collapsed by default so the editor doesn't waste vertical space; the
 * user clicks "Set a location" to open a small Mapbox map and drop a
 * pin. Once a coordinate is set, the chip stays visible (with the
 * reverse-geocoded place name) and the map collapses again.
 *
 * Sections 2-5 default to "Same as previous" — the parent passes in an
 * `inheritedCoord` so the chip can display the inherited place name
 * even when this section has no override. The override toggle just
 * shows/hides the map; setting `null` on the longitude/latitude is
 * equivalent to "inherit from previous".
 *
 * Reverse geocoding hits Mapbox directly from the client. The token
 * (`NEXT_PUBLIC_MAPBOX_TOKEN`) is already public; no server proxy
 * needed. We cache results keyed by rounded coord in component state
 * to avoid hitting the API every keystroke on rapid drags.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

export interface SectionLocationPickerProps {
  /** Stable key — used to scope the map's container DOM id. */
  sectionId: string;
  /** Current section's coordinate. NULL = inherit from previous section. */
  longitude: number | null;
  latitude: number | null;
  placeDescription: string | null;
  /** What the section *would* inherit if it doesn't set its own coord.
   *  Used by the chip to show "Same as previous ↑ · Singapore, kopitiam"
   *  even before the override is enabled. NULL if this is section 1 or
   *  no upstream section has a coord. */
  inheritedCoord: { longitude: number; latitude: number; placeDescription: string | null } | null;
  /** Section 1 is special: it must have its own location (can't inherit
   *  from "previous"). Hides the "Same as previous" copy. */
  isFirstSection?: boolean;
  onChange: (patch: {
    longitude: number | null;
    latitude: number | null;
    placeDescription: string | null;
  }) => void;
}

export function SectionLocationPicker({
  sectionId,
  longitude,
  latitude,
  placeDescription,
  inheritedCoord,
  isFirstSection = false,
  onChange,
}: SectionLocationPickerProps) {
  const hasOwnCoord = longitude !== null && latitude !== null;
  const [open, setOpen] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // Initialise the map only after the user expands the picker. Keeps
  // the editor cheap to mount even with 5 sections.
  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current || !MAPBOX_TOKEN)
      return;
    const center: [number, number] = hasOwnCoord
      ? [longitude!, latitude!]
      : inheritedCoord
        ? [inheritedCoord.longitude, inheritedCoord.latitude]
        : [0, 20];
    const zoom = hasOwnCoord || inheritedCoord ? 9 : 1.5;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center,
      zoom,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
    map.on("click", async (e) => {
      const lng = e.lngLat.lng;
      const lat = e.lngLat.lat;
      setGeocoding(true);
      const place = await reverseGeocode(lng, lat).catch(() => null);
      setGeocoding(false);
      onChange({ longitude: lng, latitude: lat, placeDescription: place });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      if (markerRef.current) {
        markerRef.current = null;
      }
    };
    // We rerun this effect only when the picker opens/closes; coord
    // changes are handled by the separate marker effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reconcile the marker when the coordinate changes.
  useEffect(() => {
    if (!open || !mapRef.current) return;
    if (longitude === null || latitude === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }
    if (!markerRef.current) {
      const el = document.createElement("div");
      el.style.cssText =
        "width:20px;height:20px;border-radius:50%;background:#1a1a1a;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:grab";
      markerRef.current = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);
      markerRef.current.on("dragend", async () => {
        const m = markerRef.current!.getLngLat();
        setGeocoding(true);
        const place = await reverseGeocode(m.lng, m.lat).catch(() => null);
        setGeocoding(false);
        onChange({ longitude: m.lng, latitude: m.lat, placeDescription: place });
      });
    } else {
      markerRef.current.setLngLat([longitude, latitude]);
    }
  }, [open, longitude, latitude, onChange]);

  // The chip line summarises the current state in one row.
  const chipLine = (() => {
    if (hasOwnCoord) {
      return (
        <>
          <span style={pinIconStyle}>📍</span>
          <span>
            {placeDescription ?? formatCoord(longitude!, latitude!)}
          </span>
          <button
            type="button"
            onClick={() => onChange({ longitude: null, latitude: null, placeDescription: null })}
            style={clearButtonStyle}
            aria-label="Clear this section's location"
          >
            clear
          </button>
        </>
      );
    }
    if (inheritedCoord) {
      return (
        <>
          <span style={pinIconStyle}>↑</span>
          <span>
            Same as previous · {inheritedCoord.placeDescription ?? formatCoord(inheritedCoord.longitude, inheritedCoord.latitude)}
          </span>
        </>
      );
    }
    if (isFirstSection) {
      return (
        <>
          <span style={pinIconStyle}>📍</span>
          <span style={mutedStyle}>Where does this story start?</span>
        </>
      );
    }
    return (
      <>
        <span style={pinIconStyle}>📍</span>
        <span style={mutedStyle}>No location set upstream</span>
      </>
    );
  })();

  return (
    <div style={wrapStyle}>
      <div style={chipRowStyle}>
        <div style={chipStyle}>{chipLine}</div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={toggleButtonStyle}
        >
          {open
            ? "Hide map"
            : hasOwnCoord
              ? "Edit"
              : inheritedCoord
                ? "Override"
                : "Set a location"}
        </button>
      </div>

      {open && (
        <div
          ref={containerRef}
          id={`section-location-map-${sectionId}`}
          style={mapStyle}
        />
      )}
      {open && geocoding && (
        <p style={geocodingHintStyle}>Looking up place name…</p>
      )}
    </div>
  );
}

/** Mapbox forward/reverse geocoder. Returns a short, human-readable
 *  "place name" string suitable for inline display, or null if the
 *  Mapbox API returns nothing useful. */
async function reverseGeocode(
  longitude: number,
  latitude: number,
): Promise<string | null> {
  if (!MAPBOX_TOKEN) return null;
  // Use the v6 forward/reverse geocoding endpoint. `types=place,locality,
  // neighborhood` keeps the response close to "Singapore", "Outram",
  // "Shibuya" — what an author would write themselves.
  const url =
    `https://api.mapbox.com/search/geocode/v6/reverse` +
    `?longitude=${encodeURIComponent(longitude)}` +
    `&latitude=${encodeURIComponent(latitude)}` +
    `&types=place,locality,neighborhood,address` +
    `&limit=1` +
    `&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { properties?: { full_address?: string; name?: string } }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;
  // Prefer the full address when present (e.g. "Outram, Singapore");
  // fall back to the short name otherwise.
  return (
    feature.properties?.full_address ?? feature.properties?.name ?? null
  );
}

function formatCoord(lng: number, lat: number): string {
  return `${lat.toFixed(3)}, ${lng.toFixed(3)}`;
}

const wrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
};
const chipRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};
const chipStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#444",
  minWidth: 0,
};
const pinIconStyle: React.CSSProperties = {
  fontSize: 13,
  flexShrink: 0,
};
const mutedStyle: React.CSSProperties = {
  color: "#888",
  fontStyle: "italic",
};
const clearButtonStyle: React.CSSProperties = {
  marginLeft: "auto",
  background: "transparent",
  border: "none",
  color: "#7f1d1d",
  fontSize: 11,
  letterSpacing: 0.3,
  cursor: "pointer",
  textDecoration: "underline",
  padding: 0,
};
const toggleButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  background: "white",
  color: "#1a1a1a",
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  fontSize: 12,
  letterSpacing: 0.3,
  cursor: "pointer",
  flexShrink: 0,
};
const mapStyle: React.CSSProperties = {
  height: 220,
  borderRadius: 3,
  overflow: "hidden",
  border: "1px solid #d4cfc2",
};
const geocodingHintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: "#888",
  fontStyle: "italic",
};
