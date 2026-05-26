import Link from "next/link";
import { notFound } from "next/navigation";

import { getEditionBySlug } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import { getReaderPrefs } from "@/lib/reader-prefs";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type Search = Promise<{ lang?: string; access?: string }>;

export default async function EditionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { language: readerLanguage, accessLevel } = await getReaderPrefs({
    langParam: sp.lang,
    accessParam: sp.access,
  });

  const data = await getEditionBySlug(slug, {
    readerLanguage,
    accessLevel,
  });
  if (!data) notFound();

  const { edition, pieces } = data;
  const publishDate = edition.publishAt
    ? new Date(edition.publishAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

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
        href="/"
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 2,
          color: "#999",
          textDecoration: "none",
        }}
      >
        ← Situate Editions
      </Link>

      <header style={{ marginTop: 32, marginBottom: 48 }}>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#9b8a6b",
            marginBottom: 14,
          }}
        >
          Issue #{edition.number}
          {publishDate ? <> · {publishDate}</> : null}
        </div>
        <h1
          style={{
            fontWeight: 400,
            fontSize: 48,
            letterSpacing: -1,
            margin: 0,
          }}
        >
          {edition.title}
        </h1>
        {edition.theme ? (
          <p
            style={{
              fontSize: 18,
              color: "#666",
              fontStyle: "italic",
              marginTop: 8,
              marginBottom: 0,
            }}
          >
            {edition.theme}
          </p>
        ) : null}
      </header>

      {edition.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- editorial photo, may be remote
        <img
          src={edition.coverImageUrl}
          alt={`Cover of ${edition.title}`}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            marginBottom: 48,
            borderRadius: 2,
          }}
        />
      ) : null}

      {edition.editorsLetter ? (
        <section style={{ marginBottom: 64 }}>
          <h2
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: "#9b8a6b",
              marginBottom: 14,
              fontWeight: 600,
            }}
          >
            Editor's letter
          </h2>
          <div style={{ fontSize: 18, whiteSpace: "pre-wrap" }}>
            {edition.editorsLetter}
          </div>
        </section>
      ) : null}

      <section>
        <h2
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 2,
            color: "#9b8a6b",
            marginBottom: 24,
            fontWeight: 600,
          }}
        >
          Contents
        </h2>
        {pieces.length === 0 ? (
          <p style={{ color: "#888", fontStyle: "italic" }}>
            No pieces are visible at your access level yet.
          </p>
        ) : (
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
            }}
          >
            {pieces.map(({ submission, firstBlock }, idx) => (
              <li
                key={submission.id}
                style={{
                  borderTop: "1px solid #e8e3d8",
                  padding: "24px 0",
                }}
              >
                <Link
                  href={`/stories/${submission.id}?lang=${readerLanguage}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 1.8,
                      color: "#9b8a6b",
                      marginBottom: 6,
                    }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                    {firstBlock ? (
                      <>
                        {" · "}
                        ({firstBlock.longitude.toFixed(2)},{" "}
                        {firstBlock.latitude.toFixed(2)})
                      </>
                    ) : null}
                  </div>
                  <h3
                    style={{
                      fontWeight: 400,
                      fontSize: 24,
                      letterSpacing: -0.3,
                      margin: "0 0 6px",
                    }}
                  >
                    {submission.title ?? "(untitled)"}
                  </h3>
                  {submission.abstract ? (
                    <p
                      style={{
                        fontSize: 16,
                        color: "#666",
                        margin: 0,
                        fontStyle: "italic",
                      }}
                    >
                      {submission.abstract}
                    </p>
                  ) : null}
                  <div
                    style={{
                      fontFamily: "system-ui, sans-serif",
                      fontSize: 11,
                      color: "#999",
                      marginTop: 10,
                    }}
                  >
                    by {submission.authorId}
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer
        style={{
          marginTop: 80,
          paddingTop: 24,
          borderTop: "1px solid #e8e3d8",
          fontFamily: "system-ui, sans-serif",
          fontSize: 12,
          color: "#999",
          textAlign: "center",
        }}
      >
        Every piece is published under our{" "}
        <Link
          href="/about/constitution"
          style={{ color: "#666", textDecoration: "none" }}
        >
          editorial constitution
        </Link>
        .
      </footer>
    </main>
  );
}
