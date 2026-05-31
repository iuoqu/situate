import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts, type DraftSection } from "@/db/schema";
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

  // Find the most recent in-progress draft. If there is one, surface a
  // "Continue your draft" panel above the three-card chooser so the
  // author doesn't accidentally spawn a parallel ghost draft. We exclude
  // `ready` so a draft explicitly marked "ready to submit" doesn't
  // ambush the author with a resume prompt — they probably came back to
  // start something new.
  const [lastDraft] = await db
    .select()
    .from(storyDrafts)
    .where(
      and(
        eq(storyDrafts.userId, user.id),
        inArray(storyDrafts.stage, ["editing", "disclosure", "structured"]),
      ),
    )
    .orderBy(desc(storyDrafts.updatedAt))
    .limit(1);

  const lastDraftWordCount = lastDraft
    ? ((Array.isArray(lastDraft.sections)
        ? (lastDraft.sections as DraftSection[])
        : []) as DraftSection[]).reduce(
        (acc, s) => acc + countWords(s?.content ?? ""),
        0,
      )
    : 0;

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

      {lastDraft && (
        <section style={resumePanelStyle} aria-label="Continue your draft">
          <div style={resumeMainStyle}>
            <p style={resumeKickerStyle}>You have a draft in progress</p>
            <h2 style={resumeTitleStyle}>
              {lastDraft.title?.trim() || "Untitled story"}
            </h2>
            <p style={resumeMetaStyle}>
              {lastDraftWordCount} words · edited{" "}
              {formatAgo(lastDraft.updatedAt)}
            </p>
          </div>
          <Link
            href={`/write/template/${lastDraft.id}`}
            style={resumeButtonStyle}
          >
            Continue →
          </Link>
        </section>
      )}

      {lastDraft && (
        <p style={startFreshHintStyle}>
          Or start something new:
        </p>
      )}

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
            {/* Tradition selector lives inside <details> so the default
                flow stays one-click; advanced authors who want to write
                under the Pearls (遗珠) tradition opt in deliberately. */}
            <details style={advancedDetailsStyle}>
              <summary style={advancedSummaryStyle}>
                Advanced: pick a tradition
              </summary>
              <div style={advancedBodyStyle}>
                <label style={radioRowStyle}>
                  <input
                    type="radio"
                    name="traditionProfileId"
                    value="flash_situate_anchored"
                    defaultChecked
                  />
                  <span>
                    <strong>Situate Spine · anchored</strong> — the default.
                    Five sections, Section 1 carries a real coordinate.
                  </span>
                </label>
                <label style={radioRowStyle}>
                  <input
                    type="radio"
                    name="traditionProfileId"
                    value="flash_situate_pearls"
                  />
                  <span>
                    <strong>Situate Spine · Pearls (遗珠)</strong> — for
                    work whose merit is independent of place anchoring.
                    Sections are deletable; coordinate is optional.{" "}
                    <em>
                      Editor discretion decides whether your piece actually
                      enters the Pearls section at publication time.
                    </em>
                  </span>
                </label>
              </div>
            </details>
            <button type="submit" style={primaryButtonStyle}>
              Start a guided draft →
            </button>
          </form>
        </li>

        <li style={cardStyle}>
          <div style={cardKickerStyle}>内测版 · Free</div>
          <h2 style={cardTitleStyle}>🪞 Guided write</h2>
          <p style={cardBodyStyle}>
            For when you have a story in your head but don&rsquo;t know how
            to start writing it. A 6-stage conversation: anchor → specifics →
            free write → AI reads back what it sees → finish. AI works as a
            mirror, not a ghostwriter.
          </p>
          <p style={cardComingSoonStyle}>
            内测版 — feedback welcome. Designed for writers who want
            structural feedback before submitting.
          </p>
          <Link href="/write/guided" style={secondaryButtonStyle}>
            Try guided write →
          </Link>
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
        All three paths land in the same editorial review. Pieces
        submitted to Situate Editions are considered for the Prize and
        the anthology under our editorial criteria. The writing tools
        themselves do not impose these criteria — they help you write
        clearly, regardless of where you intend to publish.
      </p>

      <p style={dashboardLinkStyle}>
        <Link href="/my" style={inlineLinkStyle}>
          See all your drafts &amp; submissions →
        </Link>
      </p>
    </main>
  );
}

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed
    .split(/\s+/)
    .filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

function formatAgo(ts: Date | null): string {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
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
const resumePanelStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "center",
  marginBottom: 18,
  padding: 18,
  background: "#fef3c7",
  border: "1px solid #d97706",
  borderRadius: 3,
};
const resumeMainStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};
const resumeKickerStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#92400e",
};
const resumeTitleStyle: React.CSSProperties = {
  margin: "4px 0",
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 20,
  fontWeight: 400,
  color: "#1a1a1a",
};
const resumeMetaStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#7c2d12",
};
const resumeButtonStyle: React.CSSProperties = {
  padding: "10px 18px",
  background: "#1a1a1a",
  color: "white",
  textDecoration: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: 0.3,
  flexShrink: 0,
};
const startFreshHintStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 12,
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "#888",
};
const dashboardLinkStyle: React.CSSProperties = {
  marginTop: 22,
  textAlign: "center",
  fontSize: 13,
};
const inlineLinkStyle: React.CSSProperties = {
  color: "#1a1a1a",
  textDecoration: "underline",
};
const advancedDetailsStyle: React.CSSProperties = {
  marginBottom: 12,
  fontSize: 13,
};
const advancedSummaryStyle: React.CSSProperties = {
  cursor: "pointer",
  color: "#666",
  fontSize: 12,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  marginBottom: 8,
};
const advancedBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "10px 0 4px",
};
const radioRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13,
  lineHeight: 1.55,
  color: "#444",
};
