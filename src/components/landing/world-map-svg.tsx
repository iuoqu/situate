/**
 * WorldMapSvg — a deliberately rough world-map silhouette with
 * pinned coordinates for the current issue.
 *
 * The continent paths are intentionally low-fidelity hand-drawn
 * approximations, NOT cartographically accurate. The brief is "this
 * is a worldwide thing and three specific points on it" — visual
 * gesture, not navigation. Strong cartographic ambition would compete
 * with the actual /explore Mapbox map, which is a different surface.
 *
 * Coordinates are projected with a plain equirectangular projection
 * (lon → x, lat → y) into the viewBox's 360×180 space, then scaled
 * to whatever size the SVG renders at. Equirectangular is wrong for
 * areas / shapes but right for "rough where on Earth" — and it makes
 * the projection arithmetic obvious enough to read in the source.
 */

export interface WorldMapPin {
  longitude: number;
  latitude: number;
  label?: string;
}

interface WorldMapSvgProps {
  pins: WorldMapPin[];
  ariaLabel?: string;
}

// Projection: world → 360×180 SVG units. Long [-180, 180] → x [0, 360].
// Lat [90, -90] (north positive at top) → y [0, 180].
function project(lon: number, lat: number): { x: number; y: number } {
  return {
    x: lon + 180,
    y: 90 - lat,
  };
}

// Hand-rough continent outlines. Drawn from memory at low fidelity so
// the file stays under a few KB. Each <path> is a single closed
// polygon-ish shape per landmass.
const CONTINENT_PATHS = [
  // North America
  "M 50,40 L 100,28 L 130,38 L 138,60 L 122,82 L 108,100 L 90,108 L 80,98 L 70,88 L 58,72 L 52,56 Z",
  // South America
  "M 102,108 L 120,110 L 128,124 L 132,144 L 124,158 L 112,164 L 102,156 L 96,138 L 100,120 Z",
  // Greenland
  "M 138,28 L 156,28 L 160,40 L 152,46 L 142,42 Z",
  // Europe
  "M 174,42 L 196,40 L 208,48 L 204,58 L 188,62 L 178,56 Z",
  // Africa
  "M 178,72 L 204,68 L 220,86 L 222,110 L 210,130 L 196,138 L 184,128 L 174,104 L 172,88 Z",
  // Middle East / Arabia
  "M 210,76 L 226,76 L 232,90 L 226,98 L 216,96 Z",
  // Asia (mainland)
  "M 206,38 L 244,32 L 282,40 L 312,52 L 318,70 L 308,84 L 282,86 L 254,82 L 234,72 L 220,60 L 210,50 Z",
  // India
  "M 246,82 L 260,80 L 264,98 L 256,108 L 250,102 Z",
  // Southeast Asia / Indonesia
  "M 286,98 L 308,98 L 318,108 L 312,116 L 296,114 L 286,108 Z",
  // Australia
  "M 296,128 L 326,126 L 336,140 L 326,150 L 304,148 L 294,140 Z",
];

export function WorldMapSvg({
  pins,
  ariaLabel = "World map highlighting the locations of the current issue.",
}: WorldMapSvgProps) {
  return (
    <svg
      viewBox="0 0 360 180"
      role="img"
      aria-label={ariaLabel}
      style={{
        width: "100%",
        height: "auto",
        display: "block",
      }}
    >
      <defs>
        <pattern
          id="grid-dots"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="10" cy="10" r="0.4" fill="#d8d1bf" />
        </pattern>
      </defs>

      {/* Sparse dotted background — suggests the rest of the world. */}
      <rect x="0" y="0" width="360" height="180" fill="url(#grid-dots)" />

      {/* Continent silhouettes — soft sienna ghost. */}
      {CONTINENT_PATHS.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="#ebe4d3"
          stroke="#c8c2b3"
          strokeWidth="0.4"
        />
      ))}

      {/* The Issue's coordinates as pinned dots. */}
      {pins.map((pin, i) => {
        const { x, y } = project(pin.longitude, pin.latitude);
        return (
          <g key={i}>
            {/* Soft sienna halo */}
            <circle cx={x} cy={y} r="3.2" fill="#9b8a6b" opacity="0.22" />
            {/* Hard pin */}
            <circle
              cx={x}
              cy={y}
              r="1.6"
              fill="#9b8a6b"
              stroke="#1a1a1a"
              strokeWidth="0.4"
            />
          </g>
        );
      })}
    </svg>
  );
}
