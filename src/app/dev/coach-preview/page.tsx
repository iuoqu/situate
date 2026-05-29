import { hasDevToken } from "../eval/actions";
import { CoachPreviewClient } from "./coach-preview-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coach Preview — Situate",
  robots: "noindex, nofollow",
};

export default async function CoachPreviewPage() {
  const tokenSet = await hasDevToken();
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "32px 28px 80px",
        maxWidth: 1080,
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
          Coach Preview
        </h1>
        <p
          style={{
            color: "#666",
            fontSize: 14,
            marginTop: 8,
            lineHeight: 1.55,
            maxWidth: 720,
          }}
        >
          UX mockup for the 3-tier coach. Paste prose, run all registered
          focused diagnosers across selected providers, see what the coach
          would say. Tiers map to coach actions:{" "}
          <strong>present</strong> = silent, <strong>implicit</strong> = indicate,{" "}
          <strong>absent</strong> = question. Auth shares the dev token cookie
          from{" "}
          <a href="/dev/eval" style={{ color: "#2a5e8a" }}>
            /dev/eval
          </a>
          .
        </p>
      </header>
      <CoachPreviewClient initialTokenSet={tokenSet} />
    </main>
  );
}
