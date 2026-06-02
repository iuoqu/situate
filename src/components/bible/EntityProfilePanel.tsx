"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { EntityProfile } from "@/db/schema";

/**
 * EntityProfilePanel — Path B character / place profile (档案) editor.
 *
 * Writes a rich, free-form profile into `entities.attributes` (typed as
 * EntityProfile). Unlike the entity row's name/type/alias form, this is
 * for everything the writer *knows* about a person or place — not just
 * what appears in the work (§2c of path-b-design.md).
 *
 * Persistence: debounced PATCH to the existing
 * /api/drafts/[id]/bible/entities/[entityId] endpoint, which already
 * accepts an `attributes` jsonb object. No new route needed.
 *
 * Place entities reuse the same fields with place-appropriate labels.
 */

const FUNCTION_ROLES: Array<{ value: string; label: string; sub: string }> = [
  { value: "witness",    label: "见证者", sub: "看得最清楚的那个" },
  { value: "contrast",   label: "对照者", sub: "体现中心所不是的那个" },
  { value: "challenger", label: "挑战者", sub: "质疑中心处境或选择的那个" },
  { value: "bearer",     label: "承载者", sub: "日常存在本身就携带这个时代的那个" },
];

interface FieldDef {
  key: keyof EntityProfile;
  label: string;
  placeholder: string;
  rows: number;
}

function fieldsFor(isPlace: boolean): FieldDef[] {
  if (isPlace) {
    return [
      { key: "biography", label: "历史 / 背景",
        placeholder: "在作品发生的时间之前，这个地方经历了什么？自由填写。", rows: 4 },
      { key: "personality", label: "氛围 / 特征",
        placeholder: "有没有反复出现的细节、声音、气味、让你印象深刻的东西？", rows: 3 },
      { key: "author_relation", label: "你和这个地方的关系",
        placeholder: "你是怎么知道这个地方的？了解多少？有没有知道但不打算写的？", rows: 3 },
      { key: "hardest_part", label: "最难写准确的是什么",
        placeholder: "这个地方最难写对的是哪一点？", rows: 2 },
    ];
  }
  return [
    { key: "biography", label: "生平 / 背景",
      placeholder: "在作品发生的时间之前，这个人经历了什么？可以很长，也可以只有几句话。", rows: 4 },
    { key: "personality", label: "性格 / 行为方式",
      placeholder: "有没有某种反复出现的模式、习惯、或让你印象深刻的细节？", rows: 3 },
    { key: "author_relation", label: "作者和这个人的关系",
      placeholder: "你是怎么认识这个人的？了解多少？有没有你知道但不打算写进去的事？", rows: 3 },
    { key: "hardest_part", label: "最难写准确的是什么",
      placeholder: "这个人最难写准的是哪一点？", rows: 2 },
  ];
}

interface Props {
  draftId: string;
  entityId: string;
  entityType: string;
  initial: EntityProfile;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const DEBOUNCE_MS = 700;

export function EntityProfilePanel({
  draftId,
  entityId,
  entityType,
  initial,
}: Props) {
  const isPlace = /place|地点|场所|location/i.test(entityType);
  const [profile, setProfile] = useState<EntityProfile>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const timerRef = useRef<number | null>(null);
  const firstRenderRef = useRef(true);

  const flush = useCallback(
    async (next: EntityProfile) => {
      setSaveState("saving");
      try {
        const res = await fetch(
          `/api/drafts/${draftId}/bible/entities/${entityId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attributes: next }),
          },
        );
        if (!res.ok) throw new Error("save failed");
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 2000);
      } catch {
        setSaveState("error");
      }
    },
    [draftId, entityId],
  );

  // Debounced autosave whenever profile changes (skip initial mount).
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => flush(profile), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [profile, flush]);

  function setField(key: keyof EntityProfile, value: string) {
    setProfile((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div style={panelStyle}>
      {/* Function role chips — only meaningful for people, but harmless for places */}
      {!isPlace && (
        <div style={fieldStyle}>
          <span style={fieldLabelStyle}>在作品里承担什么</span>
          <div style={roleChipsStyle}>
            {FUNCTION_ROLES.map((r) => {
              const active = profile.function_role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  title={r.sub}
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      function_role: active ? undefined : r.value,
                    }))
                  }
                  style={{
                    ...roleChipStyle,
                    ...(active ? roleChipActiveStyle : {}),
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {fieldsFor(isPlace).map((f) => (
        <div key={f.key} style={fieldStyle}>
          <span style={fieldLabelStyle}>{f.label}</span>
          <textarea
            value={(profile[f.key] as string) ?? ""}
            onChange={(e) => setField(f.key, e.target.value)}
            placeholder={f.placeholder}
            rows={f.rows}
            style={textareaStyle}
          />
        </div>
      ))}

      {/* Arc — start / end state (§2d) */}
      <div style={fieldStyle}>
        <span style={fieldLabelStyle}>弧光</span>
        <div style={arcRowStyle}>
          <textarea
            value={profile.arc_start ?? ""}
            onChange={(e) => setField("arc_start", e.target.value)}
            placeholder="开头的状态"
            rows={2}
            style={{ ...textareaStyle, flex: 1 }}
          />
          <span style={arcArrowStyle}>→</span>
          <textarea
            value={profile.arc_end ?? ""}
            onChange={(e) => setField("arc_end", e.target.value)}
            placeholder={"结尾的状态（“没有变化”也是合法答案）"}
            rows={2}
            style={{ ...textareaStyle, flex: 1 }}
          />
        </div>
        {arcNote(profile) && <p style={arcNoteStyle}>{arcNote(profile)}</p>}
      </div>

      <div style={statusRowStyle}>
        <span style={statusTextStyle}>
          {saveState === "saving" && "保存中…"}
          {saveState === "saved" && "已保存"}
          {saveState === "error" && "保存失败"}
          {saveState === "idle" && "有什么写什么，随时可补充。"}
        </span>
      </div>
    </div>
  );
}

// Structural reflection of the arc shape — reflects, doesn't judge (§2d).
function arcNote(p: EntityProfile): string | null {
  const start = p.arc_start?.trim();
  const end = p.arc_end?.trim();
  if (!start || !end) return null;
  if (start === end) {
    return "开头和结尾状态相同——状态没有解决。这是一种完整的弧光形状，作品的力量可以来自拒绝解决。";
  }
  return null;
}

// ── styles ────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  marginTop: 8,
  padding: "10px 12px",
  background: "#fbfaf6",
  border: "1px solid #e8e3d8",
  borderRadius: 3,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 0.5,
  color: "#9b8a6b",
  fontWeight: 600,
};
const textareaStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12.5,
  lineHeight: 1.55,
  border: "1px solid #e0d9c8",
  borderRadius: 3,
  background: "white",
  color: "#1a1a1a",
  fontFamily: "inherit",
  resize: "vertical",
};
const roleChipsStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};
const roleChipStyle: React.CSSProperties = {
  padding: "4px 10px",
  fontSize: 12,
  border: "1px solid #d4cfc2",
  borderRadius: 12,
  background: "white",
  color: "#555",
  cursor: "pointer",
  fontFamily: "inherit",
};
const roleChipActiveStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: "white",
  border: "1px solid #1a1a1a",
};
const arcRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};
const arcArrowStyle: React.CSSProperties = {
  color: "#9b8a6b",
  fontSize: 14,
  flexShrink: 0,
};
const arcNoteStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: 11,
  color: "#7a6a4a",
  lineHeight: 1.5,
  background: "#f3efe4",
  borderLeft: "2px solid #c8b88a",
  padding: "6px 8px",
  borderRadius: "0 2px 2px 0",
};
const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};
const statusTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#aaa",
  fontStyle: "italic",
};
