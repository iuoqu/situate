import Link from "next/link";

import { getEditionBySlug } from "@/app/actions";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { getReaderPrefs } from "@/lib/reader-prefs";

/**
 * Landing page.
 *
 * v1 (closed-beta posture):
 *   - Hero: literary manifesto headline + product-description subtitle.
 *   - Primary CTA: read Issue No. 01. Public; no auth required.
 *   - Secondary CTA: jump to waitlist (writers, invite-only).
 *   - 3-piece preview of the current issue.
 *   - Editor's letter (signed by the founding editor).
 *   - Constitution pointer block.
 *   - Waitlist form.
 *   - Footer with the standard links.
 *
 * Reference brand vibe: Granta, The Drift — serif typography, ivory, sparse
 * gutters, restrained palette. The map / place dimension is implicit in the
 * editorial; the visual hook lives at /explore.
 */

export const dynamic = "force-dynamic";

const CURRENT_ISSUE_SLUG = "issue-1-after-midnight";

// TODO: replace before public launch. Used in the editor's signature.
const FOUNDING_EDITOR_NAME = "[YOUR NAME]";

export default async function LandingPage() {
  const { language } = await getReaderPrefs({});
  const data = await getEditionBySlug(CURRENT_ISSUE_SLUG, {
    readerLanguage: language,
  });
  const issue = data?.edition ?? null;
  const previewPieces = (data?.pieces ?? []).slice(0, 3);

  return (
    <main style={pageStyle}>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={heroSectionStyle}>
        <p style={kickerStyle}>Situate Editions</p>
        <h1 style={heroHeadlineStyle}>
          Fiction that owes its existence to where it&rsquo;s set.
        </h1>
        <p style={heroSubtitleStyle}>
          World flash fiction in five languages, anchored to coordinates.
          Every story we publish would break if you moved the pin.
        </p>
        <div style={ctaRowStyle}>
          <Link
            href={`/editions/${CURRENT_ISSUE_SLUG}`}
            style={primaryCtaStyle}
          >
            {issue
              ? `Read Issue No. 01 — ${issue.title}`
              : "Read the current issue"}
          </Link>
          <a href="#waitlist" style={secondaryCtaStyle}>
            Request an invite to write
          </a>
        </div>
        <p style={ctaSubnoteStyle}>
          Reading is free for everyone. Writing is currently in invite-only beta.
        </p>
      </section>

      <Divider />

      {/* ── Current issue ──────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-labelledby="current-issue-heading">
        <SectionHeader
          eyebrow={
            issue
              ? `Issue No. 0${issue.number} · Out now`
              : "Current issue · Out now"
          }
        />
        <h2 id="current-issue-heading" style={sectionHeadingStyle}>
          {issue?.title ?? "After Midnight"}
        </h2>
        {issue?.theme && (
          <p style={editorialLeadStyle}>{issue.theme}</p>
        )}
        {previewPieces.length > 0 ? (
          <ul style={pieceListStyle}>
            {previewPieces.map(({ submission, firstBlock }, idx) => (
              <li key={submission.id} style={pieceItemStyle}>
                <Link
                  href={`/stories/${submission.id}`}
                  style={pieceLinkStyle}
                >
                  <div style={pieceOrdinalStyle}>
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <div style={pieceBodyStyle}>
                    <div style={pieceTitleStyle}>{submission.title}</div>
                    {submission.abstract && (
                      <p style={pieceAbstractStyle}>{submission.abstract}</p>
                    )}
                    {firstBlock?.content && (
                      <p style={pieceFirstLineStyle}>
                        &ldquo;{trimToFirstSentence(firstBlock.content)}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p style={mutedStyle}>
            The issue is being prepared for publication. Check back shortly.
          </p>
        )}
        <Link href={`/editions/${CURRENT_ISSUE_SLUG}`} style={inlineLinkStyle}>
          Read the full issue →
        </Link>
      </section>

      <Divider />

      {/* ── Editor's letter ────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-labelledby="letter-heading">
        <SectionHeader eyebrow="Editor’s letter" />
        <h2 id="letter-heading" style={sectionHeadingStyle}>
          Why this magazine exists.
        </h2>
        <div style={letterStyle}>
          <p>
            This is a magazine for fiction that could only happen where it
            happens. Not stories that use a place as backdrop. Not stories
            that could float to any city with a river and a café and still
            work. We publish work that breaks if you move the pin.
          </p>
          <p>
            Every piece is anchored to coordinates. Reader holds the story;
            reader walks the route on the map. Our hope is that if you read
            enough of us, the world starts to look less like categories of
            people and more like specific people in specific corners of
            specific places. That&rsquo;s our entire premise.
          </p>
          <p>
            We hold ourselves to thirteen principles, plain language, posted
            in full. The first one we mean most: a real place is not a
            setting; it is somewhere people are. The story must know it is
            not alone there.
          </p>
          <p>
            Issue No. 01, <em>After Midnight</em>, is live. Three pieces,
            three coordinates. If you want to write for us, we&rsquo;re
            growing the list of invited writers slowly and deliberately —
            the form is below.
          </p>
          <p style={signatureStyle}>
            — {FOUNDING_EDITOR_NAME}, Founding Editor
          </p>
        </div>
      </section>

      <Divider />

      {/* ── How we edit ────────────────────────────────────────────────── */}
      <section style={sectionStyle} aria-labelledby="how-we-edit-heading">
        <SectionHeader eyebrow="How we edit" />
        <h2 id="how-we-edit-heading" style={sectionHeadingStyle}>
          A constitution, not a content policy.
        </h2>
        <p style={editorialLeadStyle}>
          Thirteen principles — published in full, citable by code, used to
          decide what we accept and reject. We disclose, we don&rsquo;t
          delegate. AI assists; humans decide. Place is generative, not
          decorative. Real people require consent or restraint. Mass
          suffering is never material for satire.
        </p>
        <Link href="/about/constitution" style={inlineLinkStyle}>
          Read the thirteen principles →
        </Link>
      </section>

      <Divider />

      {/* ── Waitlist ───────────────────────────────────────────────────── */}
      <section
        id="waitlist"
        style={sectionStyle}
        aria-labelledby="waitlist-heading"
      >
        <SectionHeader eyebrow="Request an invite to write" />
        <h2 id="waitlist-heading" style={sectionHeadingStyle}>
          Closed beta. Slow growth, on purpose.
        </h2>
        <p style={editorialLeadStyle}>
          We&rsquo;re inviting writers a handful at a time so we can read
          everything carefully. Drop your email and, if you like, a sentence
          or two about a place you want to write. We read every request and
          reply when we have room.
        </p>
        <WaitlistForm />
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={footerStyle}>
        <div style={footerColumnsStyle}>
          <div>
            <p style={footerColumnTitleStyle}>Read</p>
            <Link href="/explore" style={footerLinkStyle}>
              The map
            </Link>
            <Link
              href={`/editions/${CURRENT_ISSUE_SLUG}`}
              style={footerLinkStyle}
            >
              Issue No. 01
            </Link>
          </div>
          <div>
            <p style={footerColumnTitleStyle}>About</p>
            <Link href="/about/constitution" style={footerLinkStyle}>
              The constitution
            </Link>
            <a href="#waitlist" style={footerLinkStyle}>
              Write for us
            </a>
          </div>
          <div>
            <p style={footerColumnTitleStyle}>Account</p>
            <Link href="/auth/login" style={footerLinkStyle}>
              Sign in
            </Link>
          </div>
        </div>
        <p style={footerColophonStyle}>
          Situate Editions · situate.at
        </p>
      </footer>
    </main>
  );
}

function Divider() {
  return <hr style={dividerStyle} aria-hidden />;
}

function SectionHeader({ eyebrow }: { eyebrow: string }) {
  return <p style={eyebrowStyle}>{eyebrow}</p>;
}

/**
 * Pull the first sentence of a paragraph for the issue-preview pull-quote.
 * Falls back to the first 140 chars if no sentence-end punctuation is
 * found in the first ~240 chars (a rough cap on how much we'd want to
 * surface).
 */
function trimToFirstSentence(text: string): string {
  const trimmed = text.trim();
  const window = trimmed.slice(0, 240);
  const sentenceEnd = window.search(/[.!?。！？](?=\s|$)/);
  if (sentenceEnd > 0 && sentenceEnd < 200) {
    return trimmed.slice(0, sentenceEnd + 1);
  }
  if (trimmed.length <= 140) return trimmed;
  return trimmed.slice(0, 140).trimEnd() + "…";
}

// ── Styles ───────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "80px 28px 120px",
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: "#1a1a1a",
  lineHeight: 1.65,
};

const heroSectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  marginBottom: 56,
};

const kickerStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
};

const heroHeadlineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 52,
  fontWeight: 400,
  letterSpacing: -1,
  lineHeight: 1.1,
};

const heroSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 19,
  color: "#555",
  lineHeight: 1.55,
  maxWidth: 580,
};

const ctaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 6,
};

const primaryCtaStyle: React.CSSProperties = {
  padding: "13px 22px",
  background: "#1a1a1a",
  color: "white",
  textDecoration: "none",
  borderRadius: 3,
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  letterSpacing: 0.4,
};

const secondaryCtaStyle: React.CSSProperties = {
  padding: "13px 22px",
  background: "white",
  color: "#1a1a1a",
  textDecoration: "none",
  borderRadius: 3,
  border: "1px solid #c8c2b3",
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  letterSpacing: 0.4,
};

const ctaSubnoteStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 12,
  color: "#888",
  fontFamily: "system-ui, sans-serif",
};

const dividerStyle: React.CSSProperties = {
  border: 0,
  borderTop: "1px solid #e8e3d8",
  margin: "56px 0",
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const eyebrowStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#9b8a6b",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  fontWeight: 400,
  letterSpacing: -0.4,
  lineHeight: 1.2,
};

const editorialLeadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  color: "#444",
  lineHeight: 1.65,
};

const pieceListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "8px 0 0",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const pieceItemStyle: React.CSSProperties = {
  margin: 0,
};

const pieceLinkStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
  alignItems: "flex-start",
  padding: 16,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  textDecoration: "none",
  color: "inherit",
};

const pieceOrdinalStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18,
  color: "#9b8a6b",
  letterSpacing: -0.4,
  paddingTop: 2,
  minWidth: 30,
};

const pieceBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
};

const pieceTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 400,
  letterSpacing: -0.2,
};

const pieceAbstractStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#666",
  lineHeight: 1.55,
};

const pieceFirstLineStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 15,
  color: "#333",
  fontStyle: "italic",
  lineHeight: 1.55,
};

const letterStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  fontSize: 17,
  color: "#333",
  lineHeight: 1.7,
};

const signatureStyle: React.CSSProperties = {
  margin: "16px 0 0",
  fontStyle: "italic",
  color: "#666",
};

const inlineLinkStyle: React.CSSProperties = {
  alignSelf: "flex-start",
  marginTop: 4,
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  letterSpacing: 0.4,
  color: "#1a1a1a",
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#888",
  fontStyle: "italic",
};

const footerStyle: React.CSSProperties = {
  marginTop: 80,
  paddingTop: 28,
  borderTop: "1px solid #e8e3d8",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const footerColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 24,
};

const footerColumnTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
};

const footerLinkStyle: React.CSSProperties = {
  display: "block",
  padding: "4px 0",
  fontFamily: "system-ui, sans-serif",
  fontSize: 13,
  color: "#555",
  textDecoration: "none",
};

const footerColophonStyle: React.CSSProperties = {
  margin: "20px 0 0",
  fontFamily: "system-ui, sans-serif",
  fontSize: 11,
  letterSpacing: 1,
  color: "#aaa",
};
