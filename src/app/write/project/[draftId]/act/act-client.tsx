"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ActData, MapData } from "@/db/schema";

interface Props {
  draftId: string;
  mapData: object;
  initialActData: object;
}

type TimeSpan = NonNullable<ActData["time_shape"]>["span"];
type Acts = NonNullable<ActData["time_shape"]>["acts"];
type PlaceType = NonNullable<ActData["place_shape"]>["type"];

const TIME_SPANS: Array<{ value: TimeSpan; label: string; sub: string }> = [
  { value: "moment_day", label: "一个时刻或一天", sub: "高强度压缩，单一场景或短序列" },
  { value: "season",     label: "一个季节 / 几周",   sub: "中等跨度，2–4 个焦点场景" },
  { value: "years",      label: "几年",             sub: "多章节，需要时间跳跃" },
  { value: "decades",    label: "十年以上",          sub: "史诗跨度，需要强锚点" },
  { value: "unknown",    label: "现在还不确定",       sub: "跳过，之后再定" },
];

const ACT_SHAPES: Array<{ value: Acts; label: string; sub: string }> = [
  { value: "one",     label: "单一运动",    sub: "一次性从起点抵达终点，不分幕" },
  { value: "multi",   label: "多幕结构",    sub: "有节奏性的转折点，分成 2–3 幕" },
  { value: "unknown", label: "现在还不确定", sub: "" },
];

const PLACE_TYPES: Array<{ value: PlaceType; label: string; sub: string }> = [
  { value: "one",     label: "单一地点",     sub: "始终在同一个空间里" },
  { value: "several", label: "几个地点",     sub: "在有限的几个地点之间移动" },
  { value: "route",   label: "路线 / 迁移",  sub: "位移本身是结构的一部分" },
  { value: "unknown", label: "现在还不确定", sub: "" },
];

// Structural consequence notes generated based on choices
function getCommitmentNote(span: TimeSpan, acts: Acts): string {
  if (span === "moment_day" && acts === "one") {
    return "高度压缩的单一事件：每个细节都承担叙事重量，冗余场景会让张力泄气。";
  }
  if (span === "moment_day" && acts === "multi") {
    return "短时间跨度内的多幕转折：转折必须来自内部（认知/情感），不能靠时间自然流动。";
  }
  if (span === "season" && acts === "one") {
    return "中等跨度单一弧线：需要一个支撑全程的核心动作或问题，避免散漫。";
  }
  if (span === "season" && acts === "multi") {
    return "最常见的短篇/中篇结构：三个焦点场景之间的变化要清晰可见。";
  }
  if (span === "years" && acts === "multi") {
    return "多年多幕：每幕需要自己的小完整性，时间跳跃要有视觉锚点。";
  }
  if (span === "decades") {
    return "史诗跨度：需要反复出现的意象或场景作为跨时间的结构线索。";
  }
  return "";
}

export function ActClient({ draftId, mapData, initialActData }: Props) {
  const router = useRouter();
  const map = mapData as MapData;
  const centerCard = map.center_card;

  const init = initialActData as ActData;
  const [phase, setPhase] = useState<NonNullable<ActData["phase"]>>(
    init.phase ?? "time"
  );

  // Time shape state
  const [timeSpan, setTimeSpan] = useState<TimeSpan | null>(init.time_shape?.span ?? null);
  const [acts, setActs] = useState<Acts | null>(init.time_shape?.acts ?? null);

  // Place shape state
  const [placeType, setPlaceType] = useState<PlaceType | null>(init.place_shape?.type ?? null);
  const [placeCoords, setPlaceCoords] = useState<Array<{ name: string; notes?: string }>>(
    init.place_shape?.coordinates ?? []
  );
  const [newPlaceName, setNewPlaceName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveActData(patch: Partial<ActData>) {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`/api/write/project/${draftId}/act`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actData: patch }),
      });
      if (!resp.ok) throw new Error(`Save failed: ${resp.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function commitTimeShape() {
    if (!timeSpan || !acts) return;
    const note = getCommitmentNote(timeSpan, acts);
    const timeShape: ActData["time_shape"] = { span: timeSpan, acts, commitment_note: note };
    void saveActData({ phase: "place", time_shape: timeShape });
    setPhase("place");
  }

  function commitPlaceShape() {
    if (!placeType) return;
    const coords = placeType === "one" || placeType === "unknown"
      ? placeCoords.slice(0, 1)
      : placeCoords;
    const placeShape: ActData["place_shape"] = { type: placeType, coordinates: coords };
    void saveActData({ phase: "complete", place_shape: placeShape });
    setPhase("complete");
  }

  function addPlace() {
    const name = newPlaceName.trim();
    if (!name) return;
    setPlaceCoords((prev) => [...prev, { name }]);
    setNewPlaceName("");
  }

  function removePlace(i: number) {
    setPlaceCoords((prev) => prev.filter((_, idx) => idx !== i));
  }

  function goToWrite() {
    router.push(`/write/template/${draftId}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main style={mainStyle}>
      {/* Center card summary at top */}
      {centerCard && (
        <div style={centerCardStyle}>
          <div style={centerCardLabelStyle}>中心</div>
          <div style={centerCardNameStyle}>{centerCard.center}</div>
          {centerCard.core_question && (
            <div style={centerCardQStyle}>↳ {centerCard.core_question}</div>
          )}
        </div>
      )}

      <header style={headerStyle}>
        <p style={kickerStyle}>Path B · 第二步</p>
        <h1 style={h1Style}>结构</h1>
        <p style={leadStyle}>
          你的故事在时间和空间里是什么形状？这两个决定会影响之后所有场景的安排。
        </p>
      </header>

      {/* ── Phase: time ───────────────────────────────────────────────────── */}
      {phase === "time" && (
        <>
          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>时间跨度</h2>
            <div style={optionGroupStyle}>
              {TIME_SPANS.map((opt) => (
                <label key={opt.value} style={{
                  ...optionStyle,
                  ...(timeSpan === opt.value ? optionSelectedStyle : {}),
                }}>
                  <input
                    type="radio"
                    name="time_span"
                    value={opt.value}
                    checked={timeSpan === opt.value}
                    onChange={() => setTimeSpan(opt.value)}
                    style={{ margin: 0 }}
                  />
                  <div>
                    <div style={optionLabelStyle}>{opt.label}</div>
                    {opt.sub && <div style={optionSubStyle}>{opt.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>叙事运动</h2>
            <div style={optionGroupStyle}>
              {ACT_SHAPES.map((opt) => (
                <label key={opt.value} style={{
                  ...optionStyle,
                  ...(acts === opt.value ? optionSelectedStyle : {}),
                }}>
                  <input
                    type="radio"
                    name="acts"
                    value={opt.value}
                    checked={acts === opt.value}
                    onChange={() => setActs(opt.value)}
                    style={{ margin: 0 }}
                  />
                  <div>
                    <div style={optionLabelStyle}>{opt.label}</div>
                    {opt.sub && <div style={optionSubStyle}>{opt.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Preview commitment note */}
          {timeSpan && acts && timeSpan !== "unknown" && acts !== "unknown" && (
            <div style={noteBoxStyle}>
              <span style={noteLabelStyle}>结构含义 </span>
              {getCommitmentNote(timeSpan, acts)}
            </div>
          )}

          {error && <p style={errorStyle}>{error}</p>}

          <button
            onClick={commitTimeShape}
            disabled={!timeSpan || !acts || saving}
            style={{ ...buttonStyle, opacity: timeSpan && acts ? 1 : 0.4 }}
          >
            {saving ? "保存中…" : "继续 →"}
          </button>
        </>
      )}

      {/* ── Phase: place ──────────────────────────────────────────────────── */}
      {phase === "place" && (
        <>
          {/* Show time shape summary */}
          {init.time_shape && (
            <div style={summaryChipStyle}>
              已确定：
              {TIME_SPANS.find(t => t.value === timeSpan)?.label}
              {" · "}
              {ACT_SHAPES.find(a => a.value === acts)?.label}
            </div>
          )}

          <section style={sectionStyle}>
            <h2 style={sectionTitleStyle}>地点结构</h2>
            <div style={optionGroupStyle}>
              {PLACE_TYPES.map((opt) => (
                <label key={opt.value} style={{
                  ...optionStyle,
                  ...(placeType === opt.value ? optionSelectedStyle : {}),
                }}>
                  <input
                    type="radio"
                    name="place_type"
                    value={opt.value}
                    checked={placeType === opt.value}
                    onChange={() => setPlaceType(opt.value)}
                    style={{ margin: 0 }}
                  />
                  <div>
                    <div style={optionLabelStyle}>{opt.label}</div>
                    {opt.sub && <div style={optionSubStyle}>{opt.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {placeType && placeType !== "unknown" && (
            <section style={sectionStyle}>
              <h2 style={sectionTitleStyle}>
                {placeType === "one" ? "地点" : "地点列表"}
              </h2>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  value={newPlaceName}
                  onChange={(e) => setNewPlaceName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPlace()}
                  placeholder={placeType === "one" ? "地点名称" : "添加地点…"}
                  style={inputStyle}
                />
                <button onClick={addPlace} style={addButtonStyle}>添加</button>
              </div>
              {placeCoords.length > 0 && (
                <ul style={placeListStyle}>
                  {placeCoords.map((p, i) => (
                    <li key={i} style={placeItemStyle}>
                      <span>{p.name}</span>
                      <button
                        onClick={() => removePlace(i)}
                        style={removeButtonStyle}
                      >×</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {error && <p style={errorStyle}>{error}</p>}

          <button
            onClick={commitPlaceShape}
            disabled={!placeType || saving}
            style={{ ...buttonStyle, opacity: placeType ? 1 : 0.4 }}
          >
            {saving ? "保存中…" : "完成结构 →"}
          </button>
        </>
      )}

      {/* ── Phase: complete ───────────────────────────────────────────────── */}
      {phase === "complete" && (
        <div style={{ marginTop: 8 }}>
          <div style={completeBoxStyle}>
            <h2 style={completeHeadStyle}>结构已确定</h2>
            <div style={completeSummaryStyle}>
              {timeSpan && <div>时间：{TIME_SPANS.find(t => t.value === timeSpan)?.label}</div>}
              {acts && <div>运动：{ACT_SHAPES.find(a => a.value === acts)?.label}</div>}
              {placeType && <div>地点：{PLACE_TYPES.find(p => p.value === placeType)?.label}</div>}
              {placeCoords.length > 0 && (
                <div>具体地点：{placeCoords.map(p => p.name).join("、")}</div>
              )}
            </div>
            {getCommitmentNote(timeSpan ?? "unknown", acts ?? "unknown") && (
              <div style={noteBoxStyle}>
                <span style={noteLabelStyle}>结构含义 </span>
                {getCommitmentNote(timeSpan ?? "unknown", acts ?? "unknown")}
              </div>
            )}
          </div>

          <button onClick={goToWrite} style={buttonStyle}>
            开始写作 →
          </button>
        </div>
      )}
    </main>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const mainStyle: React.CSSProperties = {
  maxWidth: 620,
  margin: "0 auto",
  padding: "48px 28px 120px",
  fontFamily: "system-ui, sans-serif",
  color: "#1a1a1a",
};

const centerCardStyle: React.CSSProperties = {
  background: "#1a1a1a",
  color: "white",
  borderRadius: 4,
  padding: "16px 20px",
  marginBottom: 36,
};
const centerCardLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "#888",
  marginBottom: 6,
};
const centerCardNameStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 20,
  lineHeight: 1.35,
};
const centerCardQStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#aaa",
  marginTop: 6,
  lineHeight: 1.45,
};

const headerStyle: React.CSSProperties = { marginBottom: 36 };
const kickerStyle: React.CSSProperties = {
  fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9b8a6b", margin: 0,
};
const h1Style: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 32, fontWeight: 400, letterSpacing: -0.5, margin: "8px 0 0",
};
const leadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 15, color: "#555", lineHeight: 1.6, marginTop: 10,
};
const sectionStyle: React.CSSProperties = { marginBottom: 32 };
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 18, fontWeight: 400, margin: "0 0 14px",
};
const optionGroupStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 8,
};
const optionStyle: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 12,
  padding: "12px 16px", border: "1px solid #e8e3d8", borderRadius: 3,
  cursor: "pointer",
};
const optionSelectedStyle: React.CSSProperties = {
  border: "1px solid #1a1a1a", background: "#fafaf8",
};
const optionLabelStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.4 };
const optionSubStyle: React.CSSProperties = {
  fontSize: 12, color: "#888", marginTop: 2,
};
const noteBoxStyle: React.CSSProperties = {
  background: "#f5f2eb", borderLeft: "3px solid #c8b88a",
  padding: "12px 16px", borderRadius: "0 3px 3px 0",
  fontSize: 13, color: "#444", lineHeight: 1.6,
  marginBottom: 20,
};
const noteLabelStyle: React.CSSProperties = {
  fontWeight: 600, color: "#8a7450",
};
const summaryChipStyle: React.CSSProperties = {
  background: "#f0ede6", borderRadius: 3, padding: "8px 14px",
  fontSize: 13, color: "#666", marginBottom: 24,
};
const inputStyle: React.CSSProperties = {
  flex: 1, padding: "9px 12px", border: "1px solid #d0c8b8",
  borderRadius: 3, fontSize: 14, fontFamily: "system-ui, sans-serif",
};
const addButtonStyle: React.CSSProperties = {
  padding: "9px 16px", background: "#1a1a1a", color: "white",
  border: "none", borderRadius: 3, fontSize: 13, cursor: "pointer",
};
const placeListStyle: React.CSSProperties = {
  listStyle: "none", margin: 0, padding: 0,
  display: "flex", flexDirection: "column", gap: 6,
};
const placeItemStyle: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "8px 12px", background: "#f5f2eb", borderRadius: 3, fontSize: 14,
};
const removeButtonStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 16, color: "#888", lineHeight: 1,
};
const buttonStyle: React.CSSProperties = {
  marginTop: 8, padding: "13px 24px", background: "#1a1a1a", color: "white",
  border: "none", borderRadius: 3, fontSize: 15, letterSpacing: 0.4,
  cursor: "pointer", width: "100%",
};
const errorStyle: React.CSSProperties = {
  color: "#b91c1c", fontSize: 13, marginBottom: 12,
};
const completeBoxStyle: React.CSSProperties = {
  border: "1px solid #e8e3d8", borderRadius: 4, padding: "24px",
  marginBottom: 24,
};
const completeHeadStyle: React.CSSProperties = {
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 20, fontWeight: 400, margin: "0 0 14px",
};
const completeSummaryStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 14, color: "#444", marginBottom: 16,
};
