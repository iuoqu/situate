import Link from "next/link";
import { notFound } from "next/navigation";

import { getSubmissionForReader } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import { getReaderPrefs } from "@/lib/reader-prefs";
import { renderTranslation } from "@/lib/rendering";

import { StoryMap } from "./story-map";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  original: "Original",
  ai: "AI translation",
  ai_post_edited: "AI translation, edited",
  human: "Human translation",
};

const TIER_COLOR: Record<string, string> = {
  free: "#16a34a",
  metered: "#ca8a04",
  premium: "#9333ea",
};

type Params = Promise<{ id: string }>;
type Search = Promise<{ lang?: string; access?: string }>;

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { language: readerLanguage, accessLevel } = await getReaderPrefs({
    langParam: sp.lang,
    accessParam: sp.access,
  });

  const detail = await getSubmissionForReader(id, {
    readerLanguage,
    accessLevel,
  });
  if (!detail) notFound();

  const { submission, edition, blocks } = detail;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "72px 28px 120px",
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: "#1a1a1a",
        lineHeight: 1.7,
      }}
    >
      <LangSwitch current={readerLanguage} />
      <Link
        href="/explore"
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#999",
          textDecoration: "none",
        }}
      >
        ← back to the map
      </Link>

      {edition ? (
        <div style={{ marginTop: 28 }}>
          <Link
            href={`/editions/${edition.slug}`}
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#9b8a6b",
              textDecoration: "none",
            }}
          >
            Issue #{edition.number} · {edition.title}
          </Link>
        </div>
      ) : null}

      <h1
        style={{
          fontWeight: 400,
          fontSize: 38,
          letterSpacing: -0.5,
          marginTop: edition ? 8 : 32,
          marginBottom: 10,
        }}
      >
        {submission.title ?? "(untitled)"}
      </h1>

      {submission.abstract ? (
        <p
          style={{
            fontSize: 17,
            color: "#555",
            fontStyle: "italic",
            marginTop: 0,
            marginBottom: 18,
          }}
        >
          {submission.abstract}
        </p>
      ) : null}

      <div
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#888",
          letterSpacing: 0.3,
          marginTop: 8,
        }}
      >
        by{" "}
        <strong style={{ color: "#333", fontWeight: 600 }}>
          {submission.authorId}
        </strong>
        {submission.authorAffiliations.length > 0 ? (
          <> · {submission.authorAffiliations.join(", ")}</>
        ) : null}
        {" · "}source: {submission.sourceLanguage}
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e8e3d8",
          margin: "40px 0",
        }}
      />

      {/* The sticky-context wrapper holds the map + every block.
         The map sticks to the top of the viewport while the prose
         scrolls past underneath it; sticky releases as soon as the
         last block exits, so the footer renders cleanly below. */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "sticky",
            top: 16,
            zIndex: 5,
            marginBottom: 40,
            // Match page background so sticky behaviour reads as
            // intentional (no text bleeding through).
            background: "#fafaf7",
            paddingTop: 4,
            paddingBottom: 8,
          }}
        >
          <StoryMap
            readerLanguage={readerLanguage}
            points={blocks.map((b, idx) => ({
              blockId: b.blockId,
              longitude: b.longitude,
              latitude: b.latitude,
              ordinal: idx + 1,
            }))}
          />
        </div>

        {blocks.length === 0 ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            This piece has no readable blocks at your access level. Try a higher
            access tier, or come back when more translations are published.
          </p>
        ) : null}

        {blocks.map((block, idx) => (
          <article
            key={block.blockId}
            style={{
              marginBottom: 56,
              // Reserve enough space above an anchored block for the
              // sticky map, so clicking pin 02 lands at the top of
              // block 2 rather than under the map.
              scrollMarginTop: "calc(min(360px, 42vh) + 32px)",
            }}
            id={`block-${idx + 1}`}
          >
          <header style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: 1.8,
                color: "#999",
              }}
            >
              {String(idx + 1).padStart(2, "0")}
              {block.eventDate ? (
                <>
                  {" · "}
                  {new Date(block.eventDate).toLocaleString(undefined, {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </>
              ) : null}
              {" · "}
              <span style={{ color: TIER_COLOR[block.accessTier] ?? "#999" }}>
                {METHOD_LABEL[block.method] ?? block.method} ({block.language})
              </span>
            </div>
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 11,
                color: "#bbb",
                marginTop: 4,
              }}
            >
              ({block.longitude.toFixed(4)}, {block.latitude.toFixed(4)})
            </div>
          </header>
          <div style={{ fontSize: 19, whiteSpace: "pre-wrap" }}>
            {renderTranslation(block.content, block.annotations)}
          </div>
        </article>
      ))}
      </div>

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e8e3d8",
          margin: "60px 0 28px",
        }}
      />

      <footer
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#999",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>
          Translation policy:{" "}
          <Link
            href="/about/constitution#P7"
            style={{ color: "#666", textDecoration: "none" }}
          >
            P7
          </Link>
          {" · "}
          AI disclosure:{" "}
          <Link
            href="/about/constitution#P8"
            style={{ color: "#666", textDecoration: "none" }}
          >
            P8
          </Link>
        </span>
        <span>Report this story (coming soon)</span>
      </footer>
    </main>
  );
}
