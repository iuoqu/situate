import { and, desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  storyDrafts,
  submissions,
  type DraftSection,
  type DraftStage,
  type SubmissionStatus,
} from "@/db/schema";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata = {
  title: "My writing · Situate Editions",
};

export const dynamic = "force-dynamic";

type Tab = "in_progress" | "submitted" | "published" | "trash";

const IN_PROGRESS_STAGES: DraftStage[] = ["editing", "disclosure", "ready", "structured"];
const SUBMITTED_STATUSES: SubmissionStatus[] = [
  "ai_review",
  "human_review",
  "revisions_requested",
  "accepted_pending_publish",
];
const PUBLISHED_STATUSES: SubmissionStatus[] = [
  "published",
  "published_l1",
  "published_l2",
  "published_l3",
];

/**
 * /my — the author's dashboard.
 *
 * Four tabs over two underlying tables:
 *
 *   In progress — story_drafts owned by me whose stage is still in the
 *                 write loop (not submitted, not trashed).
 *   Submitted   — submissions linked to my auth user that are in the
 *                 editorial pipeline (ai_review, human_review,
 *                 revisions_requested, accepted_pending_publish).
 *   Published   — submissions linked to me, status published or
 *                 published_l1/l2/l3.
 *   Trash       — drafts I've soft-deleted, recoverable.
 *
 * The submissions tabs filter by author_user_id (clean FK; set by the
 * submit handoff and backfilled by 0010 from author_email).
 * Pre-handoff /submit-form rows can fall back to author_email match
 * when author_user_id is NULL; we use OR so dashboards work for legacy
 * users mid-migration.
 */

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab =
    tabParam === "submitted" ||
    tabParam === "published" ||
    tabParam === "trash"
      ? tabParam
      : "in_progress";

  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?reason=auth_required&next=/my`);
  }
  const authorEmail = user.email ?? "";

  // We run all four counts on every render so tab labels can show
  // counts. Cheap (single-author queries hitting indexed columns).
  const [inProgressRows, submittedRows, publishedRows, trashRows] =
    await Promise.all([
      db
        .select()
        .from(storyDrafts)
        .where(
          and(
            eq(storyDrafts.userId, user.id),
            inArray(storyDrafts.stage, IN_PROGRESS_STAGES),
          ),
        )
        .orderBy(desc(storyDrafts.updatedAt))
        .limit(100),
      db
        .select()
        .from(submissions)
        .where(
          and(
            or(
              eq(submissions.authorUserId, user.id),
              authorEmail ? eq(submissions.authorEmail, authorEmail) : undefined,
            ),
            inArray(submissions.status, SUBMITTED_STATUSES),
          ),
        )
        .orderBy(desc(submissions.createdAt))
        .limit(100),
      db
        .select()
        .from(submissions)
        .where(
          and(
            or(
              eq(submissions.authorUserId, user.id),
              authorEmail ? eq(submissions.authorEmail, authorEmail) : undefined,
            ),
            inArray(submissions.status, PUBLISHED_STATUSES),
          ),
        )
        .orderBy(desc(submissions.createdAt))
        .limit(100),
      db
        .select()
        .from(storyDrafts)
        .where(
          and(
            eq(storyDrafts.userId, user.id),
            eq(storyDrafts.stage, "trashed"),
          ),
        )
        .orderBy(desc(storyDrafts.updatedAt))
        .limit(100),
    ]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "in_progress", label: "In progress", count: inProgressRows.length },
    { id: "submitted", label: "Submitted", count: submittedRows.length },
    { id: "published", label: "Published", count: publishedRows.length },
    { id: "trash", label: "Trash", count: trashRows.length },
  ];

  return (
    <main style={mainStyle}>
      <header style={{ marginBottom: 28 }}>
        <p style={kickerStyle}>Your account</p>
        <h1 style={h1Style}>My writing</h1>
        <p style={leadStyle}>
          Signed in as <strong>{user.email}</strong>.{" "}
          <Link href="/write" style={inlineLinkStyle}>
            Start a new story →
          </Link>
        </p>
      </header>

      <nav style={tabsStyle} aria-label="Writing tabs">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.id === "in_progress" ? "/my" : `/my?tab=${t.id}`}
            style={t.id === tab ? activeTabStyle : tabStyle}
          >
            {t.label}{" "}
            <span style={tabCountStyle}>({t.count})</span>
          </Link>
        ))}
      </nav>

      {tab === "in_progress" && (
        <DraftList rows={inProgressRows} emptyText="No drafts in progress. Start one." />
      )}
      {tab === "submitted" && (
        <SubmissionList
          rows={submittedRows}
          emptyText="Nothing in editorial review."
          showStatus
        />
      )}
      {tab === "published" && (
        <SubmissionList
          rows={publishedRows}
          emptyText="Nothing published yet."
          showStatus
        />
      )}
      {tab === "trash" && (
        <DraftList
          rows={trashRows}
          emptyText="Trash is empty."
          isTrash
        />
      )}
    </main>
  );
}

// ── components ─────────────────────────────────────────────────────────────

function DraftList({
  rows,
  emptyText,
  isTrash = false,
}: {
  rows: (typeof storyDrafts.$inferSelect)[];
  emptyText: string;
  isTrash?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState text={emptyText} />;
  }
  return (
    <ol style={listStyle}>
      {rows.map((d) => {
        const sections = (
          Array.isArray(d.sections) ? d.sections : []
        ) as DraftSection[];
        const totalWords = sections.reduce(
          (acc, s) => acc + countWords(s?.content ?? ""),
          0,
        );
        const title =
          d.title && d.title.trim().length > 0 ? d.title : "Untitled";
        return (
          <li key={d.id} style={rowStyle}>
            <div style={rowMainStyle}>
              <div style={rowTitleStyle}>{title}</div>
              <div style={rowMetaStyle}>
                <span>{templateLabel(d.templateId)}</span>
                <span>·</span>
                <span>{totalWords} words</span>
                <span>·</span>
                <span>edited {formatAgo(d.updatedAt)}</span>
              </div>
            </div>
            <div style={rowActionsStyle}>
              {isTrash ? (
                <RestoreButton draftId={d.id} />
              ) : (
                <Link
                  href={`/write/template/${d.id}`}
                  style={primaryActionStyle}
                >
                  Continue →
                </Link>
              )}
              {isTrash ? (
                <DeletePermanentButton draftId={d.id} />
              ) : (
                <TrashButton draftId={d.id} />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function SubmissionList({
  rows,
  emptyText,
  showStatus = false,
}: {
  rows: (typeof submissions.$inferSelect)[];
  emptyText: string;
  showStatus?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState text={emptyText} />;
  }
  return (
    <ol style={listStyle}>
      {rows.map((s) => (
        <li key={s.id} style={rowStyle}>
          <div style={rowMainStyle}>
            <div style={rowTitleStyle}>{s.title ?? "Untitled"}</div>
            <div style={rowMetaStyle}>
              {showStatus && (
                <>
                  <span>{humanStatus(s.status)}</span>
                  <span>·</span>
                </>
              )}
              <span>{s.wordCount ?? "?"} words</span>
              <span>·</span>
              <span>submitted {formatAgo(s.createdAt)}</span>
            </div>
          </div>
          <div style={rowActionsStyle}>
            <Link
              href={`/submit/thanks/${s.id}`}
              style={primaryActionStyle}
            >
              View →
            </Link>
          </div>
        </li>
      ))}
    </ol>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={emptyStateStyle}>
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}

function TrashButton({ draftId }: { draftId: string }) {
  return (
    <form action={`/api/drafts/${draftId}/trash`} method="post" style={{ margin: 0 }}>
      <button type="submit" style={secondaryActionStyle}>
        Move to trash
      </button>
    </form>
  );
}
function RestoreButton({ draftId }: { draftId: string }) {
  return (
    <form action={`/api/drafts/${draftId}/restore`} method="post" style={{ margin: 0 }}>
      <button type="submit" style={primaryActionStyle}>
        Restore
      </button>
    </form>
  );
}
function DeletePermanentButton({ draftId }: { draftId: string }) {
  return (
    <form
      action={`/api/drafts/${draftId}/delete-permanent`}
      method="post"
      style={{ margin: 0 }}
      // No confirm() in server-rendered HTML; the API itself requires
      // that the draft already be in trash, which provides one stage
      // of safety.
    >
      <button type="submit" style={dangerActionStyle}>
        Delete forever
      </button>
    </form>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function countWords(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const latin = trimmed
    .split(/\s+/)
    .filter((w) => /[A-Za-zÀ-ÿ]/.test(w)).length;
  const cjk = (trimmed.match(/[一-鿿぀-ヿ가-힯]/g) ?? []).length;
  return latin + cjk;
}

function templateLabel(id: string | null): string {
  if (!id) return "Voice draft";
  if (id === "situate-spine") return "Situate Spine";
  return id;
}

function formatAgo(ts: Date | null): string {
  if (!ts) return "never";
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function humanStatus(s: SubmissionStatus): string {
  switch (s) {
    case "draft": return "Draft";
    case "ai_review": return "AI editorial in progress";
    case "human_review": return "Editor reviewing";
    case "revisions_requested": return "Revisions requested";
    case "accepted_pending_publish": return "Accepted, queued to publish";
    case "published": return "Published";
    case "published_l1": return "Published · L1";
    case "published_l2": return "Published · L2";
    case "published_l3": return "Published · L3";
    case "withdrawn": return "Withdrawn";
  }
}

// ── styles ────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  padding: "60px 28px 120px",
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
  fontSize: 40,
  fontWeight: 400,
  letterSpacing: -0.8,
  margin: "10px 0 8px",
};
const leadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#666",
};
const inlineLinkStyle: React.CSSProperties = {
  color: "#1a1a1a",
  textDecoration: "underline",
};
const tabsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginTop: 28,
  marginBottom: 24,
  borderBottom: "1px solid #e8e3d8",
};
const tabStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  letterSpacing: 0.4,
  color: "#888",
  borderBottom: "2px solid transparent",
  marginBottom: -1,
  textDecoration: "none",
};
const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  color: "#1a1a1a",
  borderBottomColor: "#1a1a1a",
};
const tabCountStyle: React.CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  fontSize: 11,
  color: "#aaa",
};
const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 18,
  padding: "16px 20px",
  background: "white",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
};
const rowMainStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  minWidth: 0,
};
const rowTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18,
  color: "#1a1a1a",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
const rowMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  fontSize: 12,
  color: "#888",
};
const rowActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexShrink: 0,
};
const primaryActionStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "#1a1a1a",
  color: "white",
  border: "none",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
  textDecoration: "none",
  fontFamily: "inherit",
};
const secondaryActionStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "white",
  color: "#666",
  border: "1px solid #d4cfc2",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
  fontFamily: "inherit",
};
const dangerActionStyle: React.CSSProperties = {
  padding: "8px 14px",
  background: "white",
  color: "#7f1d1d",
  border: "1px solid #fca5a5",
  borderRadius: 3,
  fontSize: 13,
  letterSpacing: 0.3,
  cursor: "pointer",
  fontFamily: "inherit",
};
const emptyStateStyle: React.CSSProperties = {
  padding: "60px 20px",
  textAlign: "center",
  color: "#888",
  fontSize: 14,
  background: "#fbfaf6",
  border: "1px dashed #e8e3d8",
  borderRadius: 3,
};
