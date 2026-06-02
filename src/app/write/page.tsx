import { and, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { storyDrafts, type DraftSection, type MapData } from "@/db/schema";
import { DEFAULT_TEMPLATE_ID } from "@/lib/templates/registry";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "Write · Situate Editions",
  description:
    "Two ways in: write directly if you know your story, or use the guided path to find your center first.",
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

  // Where does "Continue →" send the writer? The key signal is templateId:
  // once it's set, writing has begun (always for Path A; for Path B after
  // begin-writing assigns the scaffold) so we resume in the editor — the
  // center card banner travels there anyway. Otherwise the draft is still
  // in the guided pre-writing flow: route to act if the center is named,
  // else back to map to keep finding it.
  const mapData =
    lastDraft &&
    typeof lastDraft.mapData === "object" &&
    lastDraft.mapData !== null
      ? (lastDraft.mapData as MapData)
      : null;
  const hasMap = mapData !== null && Object.keys(mapData).length > 0;

  let resumeHref = lastDraft ? `/write/template/${lastDraft.id}` : "/write";
  let inGuidedFlow = false;
  if (lastDraft && !lastDraft.templateId && hasMap) {
    inGuidedFlow = true;
    resumeHref =
      mapData!.phase === "complete"
        ? `/write/project/${lastDraft.id}/act`
        : `/write/project/${lastDraft.id}/map`;
  }

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 40 }}>
        <p style={kickerStyle}>Write for Situate</p>
        <h1 style={h1Style}>你已经知道你在写什么了吗？</h1>
      </header>

      {lastDraft && (
        <section style={resumePanelStyle} aria-label="Continue your draft">
          <div style={resumeMainStyle}>
            <p style={resumeKickerStyle}>
              {inGuidedFlow ? "Guided project in progress" : "Draft in progress"}
            </p>
            <h2 style={resumeTitleStyle}>
              {lastDraft.title?.trim() || "Untitled"}
            </h2>
            <p style={resumeMetaStyle}>
              {lastDraftWordCount > 0 ? `${lastDraftWordCount} words · ` : ""}
              edited {formatAgo(lastDraft.updatedAt)}
            </p>
          </div>
          <Link href={resumeHref} style={resumeButtonStyle}>
            Continue →
          </Link>
        </section>
      )}

      {lastDraft && <p style={startFreshHintStyle}>Or start something new:</p>}

      <div style={twoColStyle}>
        {/* ── Path B: not sure yet ─────────────────────────────────── */}
        <div style={choiceCardPrimaryStyle}>
          <p style={choiceKickerStyle}>还不确定 · Free</p>
          <h2 style={choiceTitleStyle}>帮我找到中心</h2>
          <p style={choiceBodyStyle}>
            你有素材——人物、经历、事件——但不确定在写谁、写什么形状。
            先用几个问题把中心找出来，再动笔。
          </p>
          <p style={choiceStepsStyle}>
            找中心 → 定结构 → 写场景
          </p>
          <Link href="/write/project/new" style={primaryButtonStyle}>
            开始找中心 →
          </Link>
        </div>

        {/* ── Path A: already know ──────────────────────────────────── */}
        <div style={choiceCardStyle}>
          <p style={choiceKickerStyle}>已经想清楚了 · Free</p>
          <h2 style={choiceTitleStyle}>直接写</h2>
          <p style={choiceBodyStyle}>
            你知道在写谁、写什么。五个章节的模板，自动保存。
          </p>
          <form action="/api/write/start-template" method="post" style={{ margin: 0 }}>
            <input type="hidden" name="templateId" value={DEFAULT_TEMPLATE_ID} />
            <details style={advancedDetailsStyle}>
              <summary style={advancedSummaryStyle}>Advanced: pick a tradition</summary>
              <div style={advancedBodyStyle}>
                <label style={radioRowStyle}>
                  <input type="radio" name="traditionProfileId"
                    value="flash_situate_anchored" defaultChecked />
                  <span><strong>Situate Spine · anchored</strong> — default.</span>
                </label>
                <label style={radioRowStyle}>
                  <input type="radio" name="traditionProfileId"
                    value="flash_situate_pearls" />
                  <span>
                    <strong>Situate Spine · Pearls (遗珠)</strong> — sections
                    deletable; coordinate optional.
                  </span>
                </label>
              </div>
            </details>
            <button type="submit" style={secondaryButtonStyle}>
              Start writing →
            </button>
          </form>
        </div>
      </div>

      <p style={footerNoteStyle}>
        Both paths end at the same editorial review. The tools help you
        write clearly — they don&rsquo;t impose editorial criteria.
        {" "}
        <Link href="/submit" style={inlineLinkStyle}>Quick form →</Link>
        {" "}if you already have a finished piece.
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
const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};
const choiceCardPrimaryStyle: React.CSSProperties = {
  padding: 28,
  background: "#1a1a1a",
  color: "white",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const choiceCardStyle: React.CSSProperties = {
  padding: 28,
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};
const choiceKickerStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color: "#9b8a6b",
  margin: 0,
};
const choiceTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 28,
  fontWeight: 400,
  letterSpacing: -0.5,
  margin: 0,
};
const choiceBodyStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15,
  lineHeight: 1.65,
  margin: 0,
  opacity: 0.85,
};
const choiceStepsStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: 0.5,
  color: "#9b8a6b",
  margin: 0,
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
