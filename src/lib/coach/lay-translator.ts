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
          text: `读者多数看到 ta 在承担这件事，但不是所有人都完全感觉到（${presentCount}/${total}）。如果想更清楚，可以多写 ta 的内心动作或反应。`,
        });
      } else if (implicitCount >= total / 2) {
        out.push({
          kind: "consider",
          text: `你说到的人在场，但读者感觉 ta 还没有真正"承受"这件事——好像只是个旁观者。是有意留白吗？还是想让 ta 更明显地在承担？`,
        });
      } else if (absentCount >= total / 2) {
        out.push({
          kind: "missing",
          text: `读者读完，没感觉到任何人在承受这件事——像在看外面的事，不像在 inside someone。如果想让读者跟着一个人感受，可以加 ta 的内心活动或具体反应。`,
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
        text: `读者觉得你的事情之间没有"因此"——只是"然后再然后"。如果想让读者跟随你的故事推进，可以让某些动作明确导致后面的事。`,
      });
    }
  }

  // 6. Economy slack
  if (economy) {
    const slacks = collectField(economy, "slack");
    if (slacks.length >= 2) {
      out.push({
        kind: "consider",
        text: `AI 觉得有些细节没起到作用：${slacks[0].slice(0, 100)}。可以删，也可以加深让它们承重。`,
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
        text: `你这段里地点是 backdrop，不是参与者。如果想让地点有自己的弧光（在不同时刻呈现不同状态），可以试试让事件标记它，或在不同时刻重新观察它。`,
      });
    } else if (arcStatic >= arcTypes.length / 2) {
      out.push({
        kind: "consider",
        text: `你的地点是静态的，人物在变。这是个有效的 device（地点作为"不动的见证者"）——确认是你想要的就好。`,
      });
    } else if (
      relTypes.filter((r) => r === "contrast").length >= relTypes.length / 2
    ) {
      out.push({
        kind: "working",
        text: `你的地点弧光跟人物弧光是**反向**的——这是文学上很有力的张力模式。`,
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
          text: `结尾只是收尾 / 总结，没让前文意义重排。读者读完不会想回头重读开头。如果想让结尾"落"得更重，可以试：让一个具体动作（不可逆的）压住前面所有铺垫，或让结尾揭示一个让前文重新解读的事实。`,
        });
      } else {
        out.push({
          kind: "consider",
          text: `结尾有一丝"转"的痕迹，但还没真正完成。读者要做大部分功——可以让那个落点更具体（一个动作 / 形象 / 决定），而不是指向。`,
        });
      }
    }
  }

  if (out.length === 0) {
    out.push({
      kind: "working",
      text: "AI 没找到明显问题，也没找到特别突出的支点。这是稳定的中性写作——可以接着写，也可以等有具体方向再回来。",
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
