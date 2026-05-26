import Link from "next/link";

import { getActivePrinciples } from "@/app/actions";
import { LangSwitch } from "@/components/lang-switch";
import type { SupportedLanguage } from "@/db/schema";
import { getReaderPrefs } from "@/lib/reader-prefs";

// The page is a runtime read of editorial_principles, so don't try to
// prerender it at build time (which would need DATABASE_URL in the build
// environment).
export const dynamic = "force-dynamic";

// Preamble + signature live in code (not in the DB) because the prose
// surrounding the numbered principles changes less often than the
// principles themselves and benefits from sitting next to the page that
// renders it.
const PREAMBLE: Partial<Record<SupportedLanguage, string[]>> = {
  en: [
    "Situate Editions publishes flash fiction anchored to real places. Each story lives at the coordinates where it could only have happened. Because a map is a kind of claim — it says, this happened here, to people who could have been you — we have written down what we believe and how we decide.",
    "What follows is version 0.1 of our editorial constitution. Every declined submission cites a principle by code (P1 through P10); every published story has implicitly passed all of them. We chose to write our rules in public, rather than rely on a single editor's taste, because we work across five languages and no one editor can hold the line in all of them.",
    "We expect to be wrong about something here. We commit to updating in public when we are.",
  ],
  zh_CN: [
    "Situate Editions 发表锚定在真实地点上的微型小说。每篇作品都生活在它本应发生的坐标处。地图本身就是一种主张——它说,这件事曾在这里发生,发生在那些本可以是你的人身上——所以我们把我们的信念和判断标准写下来。",
    "以下是本编辑宪法的 v0.1 版本。每一篇被退回的稿件都引用一条具体原则(P1 至 P10);每一篇被发表的作品都已默认通过了它们全部。我们选择把规则公开写下来,而不是依赖某一位主编的品味——因为我们跨五个语种工作,没有任何一个编辑能在五种语言里同时守住底线。",
    "我们预期此处会有错。出错时我们承诺公开更新。",
  ],
};

const HEADINGS: Partial<Record<SupportedLanguage, { title: string; effective: string; signature: string }>> = {
  en: {
    title: "Editorial Constitution",
    effective: "Effective on publication of Issue #1",
    signature: "Signed by the founding editor, on behalf of Situate Editions.",
  },
  zh_CN: {
    title: "编辑宪法",
    effective: "第 1 期发刊之日生效",
    signature: "由创始编辑代表 Situate Editions 签署。",
  },
};

type ConstitutionSearchParams = Promise<{ lang?: string }>;

function pickI18n<T>(
  bag: Partial<Record<SupportedLanguage, T>>,
  lang: SupportedLanguage,
): { value: T; fellBackToEnglish: boolean } {
  const direct = bag[lang];
  if (direct !== undefined) return { value: direct, fellBackToEnglish: false };
  const en = bag.en;
  if (en === undefined) {
    throw new Error("missing English fallback for translated content");
  }
  return { value: en, fellBackToEnglish: true };
}

export default async function ConstitutionPage({
  searchParams,
}: {
  searchParams: ConstitutionSearchParams;
}) {
  const params = await searchParams;
  const { language: lang } = await getReaderPrefs({ langParam: params.lang });
  const principles = await getActivePrinciples();
  const preamble = pickI18n(PREAMBLE, lang).value;
  const headings = pickI18n(HEADINGS, lang).value;

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "80px 28px 120px",
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: "#1a1a1a",
        lineHeight: 1.7,
      }}
    >
      <LangSwitch current={lang} />

      <header style={{ marginBottom: 56 }}>
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
        <h1
          style={{
            fontWeight: 400,
            fontSize: 44,
            letterSpacing: -1,
            marginTop: 18,
            marginBottom: 12,
          }}
        >
          {headings.title}
        </h1>
        <div
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            color: "#888",
            letterSpacing: 0.4,
          }}
        >
          Version 0.1 · {headings.effective}
        </div>
      </header>

      <section style={{ fontSize: 19, marginBottom: 72 }}>
        {preamble.map((p, i) => (
          <p key={i} style={{ marginBottom: 16 }}>
            {p}
          </p>
        ))}
      </section>

      <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {principles.map((p) => {
          const titleResult = pickI18n(p.titleI18n, lang);
          const bodyResult = pickI18n(p.bodyI18n, lang);
          return (
            <li
              key={p.id}
              id={p.code}
              style={{ marginBottom: 56, scrollMarginTop: 80 }}
            >
              <div
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11,
                  color: "#9b8a6b",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                {p.code} · {p.version}
                {titleResult.fellBackToEnglish || bodyResult.fellBackToEnglish ? (
                  <span style={{ color: "#bbb", marginLeft: 10 }}>
                    (translation pending)
                  </span>
                ) : null}
              </div>
              <h2
                style={{
                  fontWeight: 400,
                  fontSize: 26,
                  letterSpacing: -0.3,
                  margin: "0 0 14px",
                }}
              >
                {titleResult.value}
              </h2>
              <p style={{ fontSize: 17, margin: 0 }}>{bodyResult.value}</p>
              {p.examples.length > 0 ? (
                <div style={{ marginTop: 18 }}>
                  {p.examples.map((ex, i) => (
                    <div
                      key={i}
                      style={{
                        borderLeft: `3px solid ${
                          ex.kind === "accepted" ? "#16a34a" : "#dc2626"
                        }`,
                        paddingLeft: 14,
                        marginBottom: 10,
                        color: "#444",
                        fontSize: 15,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "system-ui, sans-serif",
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          color:
                            ex.kind === "accepted" ? "#16a34a" : "#dc2626",
                          fontWeight: 600,
                          marginRight: 8,
                        }}
                      >
                        {ex.kind}
                      </span>
                      {ex.text}
                    </div>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <footer
        style={{
          marginTop: 80,
          paddingTop: 28,
          borderTop: "1px solid #e8e3d8",
          fontStyle: "italic",
          color: "#666",
          fontSize: 15,
        }}
      >
        {headings.signature}
      </footer>
    </main>
  );
}

