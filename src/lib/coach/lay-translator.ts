/**
 * Lay-language translation layer for the bank's output.
 *
 * Bank's technical fields (K_present, causal_implicit, projection_confidence,
 * etc.) → friend-asking observations the writer can act on.
 *
 * Shared by /write/guided's mirror stage and template-editor's inline
 * AI button and review's user-facing AI button.
 */

export interface PreviewCellResult {
  judgment: unknown;
  classified: "positive" | "negative" | "ambiguous" | null;
  error?: string;
}

export interface PreviewDiagnoserResult {
  id: string;
  display_name: string;
  status: string;
  description: string;
  by_provider: Record<string, PreviewCellResult>;
}

export interface PreviewResponse {
  results: Record<string, PreviewDiagnoserResult>;
  providers_run: string[];
  diagnoser_ids: string[];
  skipped_diagnoser_ids?: string[];
  intent_used: string | null;
}

export interface LayObservation {
  /** working = ✓ / missing = ✗ / consider = ○ / projection = ⚠ */
  kind: "working" | "missing" | "consider" | "projection";
  text: string;
}

export function translateBankToLay(
  response: PreviewResponse,
): LayObservation[] {
  const out: LayObservation[] = [];

  const intent = response.results.inferred_intent;
  const stakes = response.results.stakes_absent;
  const causal = response.results.causal_spine;
  const economy = response.results.economy;
  const center = response.results.center_consensus;
  const realization = response.results.intent_realization;
  const charConsistency = response.results.character_consistency;
  const placeArc = response.results.place_arc;
  const theTurn = response.results.the_turn;

  // 1. K presence (stakes_absent)
  if (stakes) {
    const verdicts = collectVerdicts(stakes);
    const presentCount = verdicts.filter((v) => v === "K_present").length;
    const implicitCount = verdicts.filter((v) => v === "K_implicit").length;
    const absentCount = verdicts.filter((v) => v === "K_absent").length;
    const total = verdicts.length;
    if (total > 0) {
      if (presentCount === total) {
        out.push({
          kind: "working",
          text: `你说到的人，读者感觉到 ta 真的在场，事情真的压在 ta 身上。${total}/${total} 个 AI 读者都看到了。`,
        });
      } else if (presentCount > implicitCount + absentCount) {
        out.push({
          kind: "working",
          text: `读者多数看到 ta 在承担这件事，但不是所有人都完全感觉到（${presentCount}/${total}）。`,
        });
      } else if (implicitCount >= total / 2) {
        out.push({
          kind: "consider",
          text: `你说到的人在场，但读者感觉 ta 还没有真正"承受"这件事——更像是个旁观者。这是你想要的吗？`,
        });
      } else if (absentCount >= total / 2) {
        out.push({
          kind: "missing",
          text: `读者读完，没感觉到任何人在承受这件事——文本读起来像在叙述外部事件，而不是在某个意识内部。这是这一段的结构事实。`,
        });
      }
    }
  }

  // 2. Center of gravity
  if (center) {
    const cell = Object.values(center.by_provider)[0];
    if (cell && !cell.error) {
      const j = (cell.judgment ?? {}) as {
        joint_consensus?: { is_strong: boolean; quote: string };
      };
      if (j.joint_consensus?.is_strong && j.joint_consensus.quote) {
        out.push({
          kind: "working",
          text: `你这段最重的一句话，AI 读到的是：「${j.joint_consensus.quote.trim()}」——这是你这段的"支点"。`,
        });
      }
    }
  } else if (intent) {
    const centers = collectField(intent, "center_of_gravity");
    if (centers.length > 0) {
      const counts = new Map<string, number>();
      for (const c of centers) {
        const key = c.slice(0, 12).replace(/[^一-龥a-zA-Z0-9]/g, "");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] >= 2) {
        const fullQuote = centers.find(
          (c) => c.slice(0, 12).replace(/[^一-龥a-zA-Z0-9]/g, "") === top[0],
        );
        if (fullQuote) {
          out.push({
            kind: "working",
            text: `你这段最重的一句话，多数读者读到的是：「${fullQuote}」`,
          });
        }
      } else {
        out.push({
          kind: "consider",
          text: `AI 读者们对"这段最重的一句"看法不一——这可能意味着你这段没有单一支点（rich emotional terrain，可以是优点），也可能意味着想强调的还没立出来。`,
        });
      }
    }
  }

  // 3. Pattern break
  if (intent) {
    const breaks = collectField(intent, "pattern_break").filter(
      (b) => b && b !== "无明显断裂",
    );
    if (breaks.length > 0) {
      out.push({
        kind: "consider",
        text: `AI 注意到你这段里有一处跟周围不太一样的地方——${breaks[0].slice(0, 80)}。这是你想强调的吗？`,
      });
    }
  }

  // 4. Subtext pattern
  if (intent) {
    const subtexts = collectField(intent, "subtext_pattern");
    if (subtexts.length >= 2) {
      out.push({
        kind: "consider",
        text: `AI 读到你在用一种 pattern：${subtexts[0].slice(0, 100)}。是有意的吗？`,
      });
    }
  }

  // 5. Causal
  if (causal) {
    const verdicts = collectVerdicts(causal);
    const absentCount = verdicts.filter((v) => v === "causal_absent").length;
    const total = verdicts.length;
    if (total > 0 && absentCount >= total / 2) {
      out.push({
        kind: "missing",
        text: `读者读到的事件之间没有"因此"——只是"然后再然后"。事件可被重排而不影响整体——这是这段的结构事实。`,
      });
    }
  }

  // 6. Economy slack
  if (economy) {
    const slacks = collectField(economy, "slack");
    if (slacks.length >= 2) {
      out.push({
        kind: "consider",
        text: `AI 标出了一些没承担明确作用的细节：${slacks[0].slice(0, 100)}。它们是有意的留白，还是可以承担更多？`,
      });
    }
  }

  // 7. L3 projection
  if (intent) {
    const projections = Object.values(intent.by_provider)
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return {
          backstory:
            typeof j.speculative_backstory === "string"
              ? j.speculative_backstory.trim()
              : "",
          conf:
            typeof j.projection_confidence === "number"
              ? j.projection_confidence
              : 0,
        };
      })
      .filter((p) => p.backstory && p.conf > 0.5);
    if (projections.length >= 2) {
      out.push({
        kind: "projection",
        text: `AI 在文本之外补了一些 backstory：${projections[0].backstory.slice(0, 100)}。这是 AI 的猜测，不是你写的。如果你的故事和它一致——说明你的暗示成立。如果不一致——你的细节误导了暗示，可以调。`,
      });
    }
  }

  // 8. Intent realization
  if (realization) {
    const verdicts = collectVerdicts(realization);
    const partialCount = verdicts.filter((v) => v === "intent_partial").length;
    const unimpCount = verdicts.filter(
      (v) => v === "intent_unimplemented",
    ).length;
    if (partialCount + unimpCount >= verdicts.length / 2) {
      const cell = Object.values(realization.by_provider).find((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return (
          typeof j.unrealized === "string" && j.unrealized.trim().length > 0
        );
      });
      if (cell) {
        const j = (cell.judgment ?? {}) as Record<string, unknown>;
        const unrealized =
          typeof j.unrealized === "string" ? j.unrealized.trim() : "";
        out.push({
          kind: "missing",
          text: `你前面填了你想做什么。AI 比较了一下，prose 里这部分还没出来：${unrealized.slice(0, 120)}`,
        });
      }
    }
  }

  // 9. Character consistency
  if (charConsistency) {
    const verdicts = collectVerdicts(charConsistency);
    const driftCount = verdicts.filter(
      (v) => v === "character_consistency_absent",
    ).length;
    if (driftCount >= verdicts.length / 2) {
      const drifts = collectField(charConsistency, "drift_examples");
      if (drifts.length > 0) {
        out.push({
          kind: "missing",
          text: `你定的角色 backstory 跟 prose 里角色的行为有冲突——${drifts[0].slice(0, 120)}`,
        });
      }
    } else if (verdicts.some((v) => v === "character_consistency_present")) {
      out.push({
        kind: "working",
        text: `你的角色 backstory 落实到 prose 里了——角色的动作 / 选择 / 对话能回溯到你定的背景。`,
      });
    }
  }

  // 10. Place arc
  if (placeArc) {
    const cells = Object.values(placeArc.by_provider);
    const arcTypes = cells
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.arc_type === "string" ? j.arc_type : "";
      })
      .filter(Boolean);
    const relTypes = cells
      .map((c) => {
        const j = (c?.judgment ?? {}) as Record<string, unknown>;
        return typeof j.relation_to_character === "string"
          ? j.relation_to_character
          : "";
      })
      .filter(Boolean);
    const arcAbsent = arcTypes.filter((a) => a === "absent").length;
    const arcStatic = arcTypes.filter((a) => a === "static").length;
    if (arcAbsent >= arcTypes.length / 2) {
      out.push({
        kind: "consider",
        text: `这段里地点是 backdrop，不参与叙事变化。这是有意的吗？还是你想让地点也跟着事件被标记？`,
      });
    } else if (arcStatic >= arcTypes.length / 2) {
      out.push({
        kind: "consider",
        text: `地点是静态的，人物在变——地点作为"不动的见证者"。确认这是你想要的结构。`,
      });
    } else if (
      relTypes.filter((r) => r === "contrast").length >= relTypes.length / 2
    ) {
      out.push({
        kind: "working",
        text: `你的地点弧光跟人物弧光是**反向**的——结构事实：两条变化轨迹相向。`,
      });
    }
  }

  // 11. The turn (closure)
  if (theTurn) {
    const verdicts = collectVerdicts(theTurn);
    const presentCount = verdicts.filter((v) => v === "turn_present").length;
    const absentCount = verdicts.filter((v) => v === "turn_absent").length;
    const total = verdicts.length;
    if (total > 0) {
      if (presentCount >= total / 2) {
        const cell = Object.values(theTurn.by_provider).find((c) => {
          const j = (c?.judgment ?? {}) as Record<string, unknown>;
          return (
            typeof j.turn_location === "string" &&
            j.turn_location.trim().length > 0 &&
            j.turn_location.trim() !== "无"
          );
        });
        const location = cell
          ? ((cell.judgment as Record<string, unknown>).turn_location as string)
          : "";
        out.push({
          kind: "working",
          text: location
            ? `你的结尾完成了"转"——读完后回头看开头，意义变了。落点在：「${location.trim().slice(0, 80)}」`
            : `你的结尾完成了"转"——读完后回头看开头，意义变了。`,
        });
      } else if (absentCount >= total / 2) {
        out.push({
          kind: "missing",
          text: `结尾是 summary 或停笔，没让前文意义重排——读完后开头那句话还是原来那个意思。这是这段结尾的结构事实。`,
        });
      } else {
        out.push({
          kind: "consider",
          text: `结尾的转有痕迹但未完成。读者要做大部分功才能让"转"落地——你想要的就是这种含蓄的指向，还是想让它更落得下来？`,
        });
      }
    }
  }

  if (out.length === 0) {
    out.push({
      kind: "working",
      text: "AI 没读出突出的支点，也没读出明显的结构问题。当前这段在结构层面没有强信号——继续写，或回头看你想突出什么。",
    });
  }

  return out;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function collectVerdicts(result: PreviewDiagnoserResult): string[] {
  return Object.values(result.by_provider)
    .map((c) => {
      const j = (c?.judgment ?? {}) as Record<string, unknown>;
      return typeof j.verdict === "string" ? j.verdict : "";
    })
    .filter(Boolean);
}

function collectField(
  result: PreviewDiagnoserResult,
  field: string,
): string[] {
  return Object.values(result.by_provider)
    .map((c) => {
      const j = (c?.judgment ?? {}) as Record<string, unknown>;
      return typeof j[field] === "string" ? (j[field] as string).trim() : "";
    })
    .filter(Boolean);
}
