"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { DriveType, TruthDeclaration } from "@/db/schema";

/**
 * /write/project/new — Phase 0: project setup.
 *
 * Two questions before map begins:
 *   1. Drive type (§4) — why are you writing this?
 *   2. Truth declaration (§18) — real / fiction / blend + flags.
 *
 * Submits to POST /api/write/start-project which creates the draft and
 * redirects to /write/project/[id]/map.
 */

const DRIVE_OPTIONS: Array<{ value: DriveType; label: string; sub: string }> = [
  {
    value: "purposive_art",
    label: "我要给某种读者讲某件事",
    sub: "文学 / 艺术驱动",
  },
  {
    value: "purposive_commercial",
    label: "我希望这个作品具备特定的延伸潜力",
    sub: "商业 / 媒介驱动",
  },
  {
    value: "haunting",
    label: "有个东西缠住我，我必须把它写出来",
    sub: "缠绕型",
  },
  {
    value: "unknown",
    label: "现在不知道",
    sub: "跳过，之后再说",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [driveType, setDriveType] = useState<DriveType | null>(null);
  const [truthStatus, setTruthStatus] = useState<TruthDeclaration["status"]>(null);
  const [hasRealPersons, setHasRealPersons] = useState<boolean | null>(null);
  const [placeIsPublic, setPlaceIsPublic] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = driveType !== null && truthStatus !== null &&
    hasRealPersons !== null && placeIsPublic !== null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch("/api/write/start-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drive_type: driveType,
          truth_status: truthStatus,
          has_real_persons: hasRealPersons,
          place_is_public: placeIsPublic,
        }),
        redirect: "manual",
      });
      if (resp.type === "opaqueredirect" || resp.status === 303 || resp.redirected) {
        router.push(resp.url || "/write");
        return;
      }
      // Follow the redirect ourselves if fetch didn't
      const location = resp.headers.get("location");
      if (location) { router.push(location); return; }
      throw new Error(`Unexpected status ${resp.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <main style={mainStyle}>
      <header style={headerStyle}>
        <p style={kickerStyle}>Path B · 第一步</p>
        <h1 style={h1Style}>在开始之前，两个问题</h1>
        <p style={leadStyle}>
          这两个声明会贯穿整个写作过程。现在说清楚，后面所有的反馈都基于它们。
        </p>
      </header>

      {/* ── Drive type ───────────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>你为什么写这个？</h2>
        <div style={optionGroupStyle}>
          {DRIVE_OPTIONS.map((opt) => (
            <label key={opt.value} style={{
              ...optionStyle,
              ...(driveType === opt.value ? optionSelectedStyle : {}),
            }}>
              <input
                type="radio"
                name="drive_type"
                value={opt.value}
                checked={driveType === opt.value}
                onChange={() => setDriveType(opt.value)}
                style={{ margin: 0 }}
              />
              <div>
                <div style={optionLabelStyle}>{opt.label}</div>
                <div style={optionSubStyle}>{opt.sub}</div>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* ── Truth declaration ────────────────────────────────────────── */}
      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>这个作品和真实的关系</h2>
        <p style={sectionNoteStyle}>
          这个声明是项目级别的，一次性做一次。之后每个场景的写作模式都从这里读。
        </p>
        <div style={optionGroupStyle}>
          {(["real", "fiction", "blend"] as const).map((s) => (
            <label key={s} style={{
              ...optionStyle,
              ...(truthStatus === s ? optionSelectedStyle : {}),
            }}>
              <input type="radio" name="truth_status" value={s}
                checked={truthStatus === s}
                onChange={() => setTruthStatus(s)}
                style={{ margin: 0 }}
              />
              <div style={optionLabelStyle}>
                {s === "real" && "完全基于真实经历和人物"}
                {s === "fiction" && "完全虚构"}
                {s === "blend" && "介于两者之间"}
              </div>
            </label>
          ))}
        </div>

        <div style={flagGroupStyle}>
          <label style={flagRowStyle}>
            <span style={flagLabelStyle}>是否涉及真实可识别的人？</span>
            <div style={flagButtonsStyle}>
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button"
                  onClick={() => setHasRealPersons(v)}
                  style={{
                    ...flagButtonStyle,
                    ...(hasRealPersons === v ? flagButtonActiveStyle : {}),
                  }}>
                  {v ? "是" : "否"}
                </button>
              ))}
            </div>
          </label>
          <label style={flagRowStyle}>
            <span style={flagLabelStyle}>地点是否是真实的公共场所？</span>
            <div style={flagButtonsStyle}>
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button"
                  onClick={() => setPlaceIsPublic(v)}
                  style={{
                    ...flagButtonStyle,
                    ...(placeIsPublic === v ? flagButtonActiveStyle : {}),
                  }}>
                  {v ? "是" : "否"}
                </button>
              ))}
            </div>
          </label>
        </div>
      </section>

      {error && <p style={errorStyle}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        style={{ ...submitButtonStyle, opacity: canSubmit ? 1 : 0.4 }}
      >
        {submitting ? "正在创建…" : "开始找中心 →"}
      </button>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  padding: "64px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};
const headerStyle: React.CSSProperties = { marginBottom: 48 };
const kickerStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9b8a6b", margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 36, fontWeight: 400, letterSpacing: -0.6, margin: "10px 0 0",
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 16, color: "#555", lineHeight: 1.65, marginTop: 12,
};
const sectionStyle: React.CSSProperties = { marginBottom: 40 };
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 20, fontWeight: 400, margin: "0 0 16px",
};
const sectionNoteStyle: React.CSSProperties = {
  fontSize: 13, color: "#777", lineHeight: 1.55, margin: "-8px 0 16px",
};
const optionGroupStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8,
};
const optionStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 12,
  padding: "14px 16px", border: "1px solid #e8e3d8", borderRadius: 3,
  cursor: "pointer",
};
const optionSelectedStyle: React.CSSProperties = {
  border: "1px solid #1a1a1a", background: "#fafaf8",
};
const optionLabelStyle: React.CSSProperties = {
  fontSize: 15, lineHeight: 1.4,
};
const optionSubStyle: React.CSSProperties = {
  fontSize: 12, color: "#888", marginTop: 2,
};
const flagGroupStyle: React.CSSProperties = {
  marginTop: 20, display: "flex", flexDirection: "column", gap: 12,
};
const flagRowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  gap: 16,
};
const flagLabelStyle: React.CSSProperties = { fontSize: 14, color: "#333" };
const flagButtonsStyle: React.CSSProperties = { display: "flex", gap: 8 };
const flagButtonStyle: React.CSSProperties = {
  padding: "6px 18px", border: "1px solid #d0c8b8", borderRadius: 3,
  background: "white", fontSize: 14, cursor: "pointer",
};
const flagButtonActiveStyle: React.CSSProperties = {
  background: "#1a1a1a", color: "white", border: "1px solid #1a1a1a",
};
const submitButtonStyle: React.CSSProperties = {
  marginTop: 8, padding: "14px 24px", background: "#1a1a1a", color: "white",
  border: "none", borderRadius: 3, fontSize: 15, letterSpacing: 0.4,
  cursor: "pointer", width: "100%",
};
const errorStyle: React.CSSProperties = {
  color: "#b91c1c", fontSize: 13, marginBottom: 12,
};
