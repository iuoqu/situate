import { hasDevToken } from "./actions";
import { EvalClient } from "./eval-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Skeleton Diagnostic Eval — Situate",
  robots: "noindex, nofollow",
};

export default async function DevEvalPage() {
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
          Skeleton Diagnostic — Eval
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
          Internal dev tooling for iterating the RUBRIC against the 36-specimen
          suite. The token below must match{" "}
          <code style={{ background: "#f3efe6", padding: "1px 5px", borderRadius: 3 }}>
            DIAGNOSTIC_INTERNAL_TOKEN
          </code>{" "}
          on the server (Vercel env). All Claude calls run on the server using
          its <code>ANTHROPIC_API_KEY</code> — your browser only sees the
          aggregated results.
        </p>
      </header>
      <EvalClient initialTokenSet={tokenSet} />
    </main>
  );
}
