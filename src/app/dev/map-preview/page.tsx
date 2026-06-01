import { MapPreviewClient } from "./map-preview-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Map Preview — Situate",
  robots: "noindex, nofollow",
};

export default function MapPreviewPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 28px 80px",
        maxWidth: 940,
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
        color: "#1a1a1a",
      }}
    >
      <header style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: 30,
            fontWeight: 400,
            margin: 0,
            letterSpacing: -0.4,
          }}
        >
          situate.map — dev preview
        </h1>
        <p
          style={{
            color: "#666",
            fontSize: 14,
            marginTop: 8,
            lineHeight: 1.55,
            maxWidth: 680,
          }}
        >
          Two-step: paste source material → receive angle questions → answer
          each → synthesize. Tests whether the 归纳 algorithm converges, which
          branch it takes, and what writer-facing message it produces. Requires
          a logged-in Supabase session.
        </p>
      </header>
      <MapPreviewClient />
    </main>
  );
}
