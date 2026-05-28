"""核心分析器：调用 Anthropic Messages API，返回结构化 JSON。"""
from __future__ import annotations

import json
import os
import re
from typing import Any

import anthropic

# 判断吃力时可换 "claude-opus-4-7"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096

RUBRIC = """\
你是一个叙事结构分析器。给你一段散文（任意长度、传统、语言），判断它是不是"故事"：
抽取骨架 → 套传统中立门神 → 识别实现引擎 → 跑诊断子。只输出一个 JSON 对象，前后无说明。

核心不变量：故事 = 从均衡态(S0)经扰动(D)沿因果轨迹(T)到达被改变的均衡态(S1)，
且对某意识有分量(K)。状态两维度：situation（处境）与 understanding（认知）；任一改变即算转变。

门神三谓词：
- transformed：S1 在 situation 或 understanding 上有意义地不同于 S0。
- causal：T 把 D 因果地连到 S1（有因果脊柱，非联想漂移）。
- stakes_bound：K 非空且绑定到某意识（角色或读者）。
失败类型：非transformed→"描摹"；transformed但非causal→"随笔"；
transformed且causal但非stakes_bound→"说明"；三条全满足→"故事"。

极重要·传统中立：绝不要求"冲突"或"主角欲望"。扰动可以是欲望受阻(冲突)、不协调元素
(重新框定)、隐藏真相浮现(揭示)、被启动的命运(必然性)。许多伟大故事（尤其文学/契诃夫式）
转变的是 understanding 而非 situation、且无"要克服的阻碍"，用西方冲突结构去卡会误判。

实现引擎（识别哪个，可多个带权重）：conflict（目标vs阻碍/追求-升级/situation）、
recontextualize（不协调元素/重新框定的转/understanding）、revelation（真相浮现/揭开/understanding）、
inevitability（命运启动/坠落/situation）。

诊断子（仅过门后跑）：causal_spine（因果脊柱强度，是"因此"还是"然后"）、
the_turn（结尾是重新框定/决定性收束，还是只在总结主题）、economy（有无不挣位置的材料）、
flat_subtext（言不由衷处是否同时透出表层与真实意图，还是拍平）。

流程：先逐项抽 S0/D/T/S1/K 并说明 → 逐条评三谓词 → 门神结论 → 识别引擎 → 跑诊断子。
边界/拿不准的诚实标低 confidence，不要硬给结论。

只输出这一个 JSON：
{
 "title_or_first_line":"",
 "skeleton":{"S0":"","D":"","T":"","S1":"","K":"","transformation_dimension":"situation|understanding|both"},
 "gate":{"transformed":{"verdict":true,"why":""},"causal":{"verdict":true,"why":""},
         "stakes_bound":{"verdict":true,"why":""},"is_story":true,
         "if_not_story_type":"描摹|随笔|说明|null","confidence":0.0,"borderline_note":""},
 "engines":[{"engine":"","weight":0.0,"why":""}],
 "diagnostics":[{"id":"causal_spine","finding":"","severity":"ok|note|warn|error"},
                {"id":"the_turn","finding":"","severity":"ok|note|warn|error"},
                {"id":"economy","finding":"","severity":"ok|note|warn|error"},
                {"id":"flat_subtext","finding":"","severity":"ok|note|warn|error"}],
 "one_line_verdict":""
}
"""

_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


def _strip_fences(text: str) -> str:
    return _FENCE_RE.sub("", text).strip()


def _extract_text(message: anthropic.types.Message) -> str:
    parts: list[str] = []
    for block in message.content:
        if block.type == "text":
            parts.append(block.text)
    return "".join(parts)


def _call_model(client: anthropic.Anthropic, text: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=RUBRIC,
        messages=[{"role": "user", "content": text}],
    )
    return _extract_text(response)


def analyze(text: str) -> dict[str, Any]:
    """分析一段散文，返回门神判定的结构化 JSON。

    解析失败会重试一次；仍失败则返回 {"error": ..., "raw": ...}。
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"error": "ANTHROPIC_API_KEY not set", "raw": ""}

    client = anthropic.Anthropic(api_key=api_key)

    raw = ""
    for attempt in range(2):
        try:
            raw = _call_model(client, text)
            return json.loads(_strip_fences(raw))
        except json.JSONDecodeError:
            if attempt == 1:
                return {"error": "JSON parse failed after retry", "raw": raw}
        except anthropic.APIError as e:
            return {"error": f"API error: {type(e).__name__}: {e}", "raw": raw}

    return {"error": "unknown failure", "raw": raw}


if __name__ == "__main__":
    import sys
    text = sys.stdin.read()
    print(json.dumps(analyze(text), ensure_ascii=False, indent=2))
