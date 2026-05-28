import Link from "next/link";
import { redirect } from "next/navigation";

import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Write · Situate Editions",
  description:
    "Three ways to write for Situate: voice (premium), guided template (free), or the open form.",
};

export const dynamic = "force-dynamic";

/**
 * /write — the EntryChoice landing for writers.
 *
 * Closed-beta gated. Lists the three writing paths:
 *   - 🎤 Speak it (Premium, voice) — placeholder route for now.
 *   - ⌨️ Write it (Free, recommended) — opens a fresh template draft and
 *     redirects to /write/template/[draftId].
 *   - 📝 Quick form (Free, advanced) — the existing /submit form.
 *
 * Creating a draft happens via a tiny server action that calls our own
 * POST /api/drafts so the "Write it" button flow is one click.
 */

export default async function WritePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?reason=auth_required&next=/write");

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 36 }}>
        <p style={kickerStyle}>Write for Situate</p>
        <h1 style={h1Style}>Three ways in.</h1>
        <p style={leadStyle}>
          Pick a path. Every path ends at the same editorial pipeline —
          you choose how to get there.
        </p>
      </header>

      <ol style={listStyle}>
        <li style={cardStyle}>
          <div style={cardKickerStyle}>Recommended · Free</div>
          <h2 style={cardTitleStyle}>⌨️ Write it</h2>
          <p style={cardBodyStyle}>
            A five-section guided path — arrival, inhabitants, incident,
            aftermath, closing image. The shape most Situate stories
            take. Auto-saves while you write.
          </p>
          <form action="/api/write/start-template" method="post" style={{ margin: 0 }}>
            <input type="hidden" name="templateId" value={DEFAULT_TEMPLATE_ID} />
            <button type="submit" style={primaryButtonStyle}>
              Start a guided draft →
            </button>
          </form>
        </li>

        <li style={cardStyleMuted}>
          <div style={cardKickerStyle}>Premium · $10/mo</div>
          <h2 style={cardTitleStyle}>🎤 Speak it</h2>
          <p style={cardBodyStyle}>
            Talk for five to ten minutes about a place you know. AI
            transcribes and structures into a draft you can edit. The
            fastest path from a place in your head to a publishable
            piece.
          </p>
          <p style={cardComingSoonStyle}>
            Coming this season. Get on the list — we&rsquo;re finishing
            the voice pipeline.
          </p>
        </li>

        <li style={cardStyle}>
          <div style={cardKickerStyle}>Advanced · Free</div>
          <h2 style={cardTitleStyle}>📝 Quick form</h2>
          <p style={cardBodyStyle}>
            The full submission form. Drop pins on a map, write scenes
            directly into each, fill in the disclosures. Best when you
            already know what you&rsquo;re writing.
          </p>
          <Link href="/submit" style={secondaryButtonStyle}>
            Open the form →
          </Link>
        </li>
      </ol>

      <p style={footerNoteStyle}>
        All three paths land in the same editorial review. Free or paid,
        all writers are eligible for the Prize and the anthology — only
        the writing tools differ.
      </p>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "70px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const kickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 44,
  fontWeight: 400,
  letterSpacing: -0.8,
  margin: "10px 0 0",
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 17,
  color: "#555",
  lineHeight: 1.65,
  marginTop: 12,
  maxWidth: 540,
};
const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const cardStyle: React.CSSProperties = {
  padding: 24,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const cardStyleMuted: React.CSSProperties = {
  ...cardStyle,
  background: "#fbfaf6",
};
const cardKickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
};
const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 26,
  fontWeight: 400,
  letterSpacing: -0.4,
  margin: 0,
};
const cardBodyStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16,
  color: "#555",
  lineHeight: 1.6,
  margin: 0,
};
const cardComingSoonStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#888",
  fontStyle: "italic",
};
const primaryButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "12px 18px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
};
const secondaryButtonStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  padding: "12px 18px",
  background: "white",
  color: "#1a1a1a",
  border: "1px solid #1a1a1a",
  borderRadius: 3,
  fontFamily: "system-ui",
  fontSize: 14,
  letterSpacing: 0.4,
  cursor: "pointer",
  textDecoration: "none",
};
const footerNoteStyle: React.CSSProperties = {
  marginTop: 40,
  padding: 18,
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
};
