import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        textAlign: "center",
        gap: 16,
      }}
    >
      <h1
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontWeight: 400,
          fontSize: 48,
          letterSpacing: -1,
          margin: 0,
        }}
      >
        Situate Editions
      </h1>
      <p style={{ color: "#666", maxWidth: 520, fontSize: 16, margin: 0 }}>
        World flash fiction, anchored to place. Each story lives at the
        coordinates where it could only have happened.
      </p>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Link
          href="/explore"
          style={{
            padding: "10px 18px",
            background: "#1a1a1a",
            color: "white",
            textDecoration: "none",
            borderRadius: 4,
            fontSize: 14,
            letterSpacing: 0.5,
          }}
        >
          Explore the map →
        </Link>
        <Link
          href="/editions/issue-1-after-midnight"
          style={{
            padding: "10px 18px",
            background: "white",
            color: "#1a1a1a",
            textDecoration: "none",
            borderRadius: 4,
            fontSize: 14,
            letterSpacing: 0.5,
            border: "1px solid #ccc",
          }}
        >
          Read Issue #1
        </Link>
      </div>
      <Link
        href="/about/constitution"
        style={{
          marginTop: 4,
          fontSize: 12,
          color: "#888",
          letterSpacing: 0.4,
        }}
      >
        Read the editorial constitution
      </Link>
    </main>
  );
}
