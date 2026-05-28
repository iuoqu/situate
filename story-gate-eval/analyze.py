"""核心分析器。优先走 Vercel route（推荐），本地不持有 ANTHROPIC_API_KEY 也能跑。

调用方式：
- **远端 HTTP 模式（推荐）**：设置 ANALYZER_URL（base URL，例如
  https://situate.vercel.app）+ ANALYZER_TOKEN（对应 Vercel 上的
  DIAGNOSTIC_INTERNAL_TOKEN）。本端不需要 ANTHROPIC_API_KEY。

- **直连 SDK 模式（离线沙盒）**：设置 ANTHROPIC_API_KEY，绕过 Vercel
  直连 Anthropic。仅在 ANALYZER_URL 未配置时启用；提示词使用本地
  RUBRIC 副本（下方），TS 端才是权威版本。
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Literal

from _http import base_url, post_json

# SDK 沙盒模式默认模型。判断吃力时可换 "claude-opus-4-7"。
SANDBOX_MODEL = "claude-sonnet-4-6"
SANDBOX_MAX_TOKENS = 4096

Mode = Literal["full", "partial"]

# ─────────────────────────────────────────────────────────────────────────
# Python 沙盒模式用的 RUBRIC 副本。权威版本在
# src/lib/skeleton-diagnostic/rubric.ts。这两份**应保持同步**——在
# revise_rubric.py 里 apply 修改时，两边都要改。
# ─────────────────────────────────────────────────────────────────────────

RUBRIC_FULL = """\
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

RUBRIC_PARTIAL = """\
你是一个叙事结构观察器。给你的是一段**未完成的草稿**，不是已经发表的作品。
你的工作不是判它是不是"故事"——草稿没写完，本来就不是。你的工作是**报告你现在看到什么**。

骨架五元（同完整版）：
- S0（均衡态）：现在有没有给出一个可识别的"起点状态"？
- D（扰动）：起点之外，是否已经出现了能驱动转变的东西（不协调、揭露、抗拒、命运启动）？
- T（轨迹）：D 是否开始拉出一条因果路径？
- S1（新均衡）：转变是否已经落地？
- K（利害）：是否有某个意识承担分量？

报告规则：
1. 只报告**你确实从文本里看到**的东西。如果 T 还没起，就说 not_yet。**绝不补编**作者还没写出来的部分。
2. 每个轴给状态：present | hinted | not_yet。confidence 0.0-1.0。
3. confidence 不应虚高。20% 草稿就该读出"S0 ✓ / D not_yet"，不应该硬猜"应该是 D 已经潜伏在 S0 里"。
4. 不输出 is_story 的最终判定（草稿没结束，没法判）。
5. 输出引擎倾向是允许的，但要标"tentative"且 weight ≤ 0.5。
6. 诊断子里只跑 causal_spine 和 economy（the_turn/flat_subtext 需要看到结尾才能判）。

只输出这一个 JSON：
{
 "title_or_first_line":"",
 "skeleton_status":{
   "S0":{"status":"present|hinted|not_yet","note":""},
   "D" :{"status":"present|hinted|not_yet","note":""},
   "T" :{"status":"present|hinted|not_yet","note":""},
   "S1":{"status":"present|hinted|not_yet","note":""},
   "K" :{"status":"present|hinted|not_yet","note":""}
 },
 "progress_estimate": 0.0,
 "tentative_engines":[{"engine":"","weight":0.0,"why":""}],
 "diagnostics":[{"id":"causal_spine","finding":"","severity":"ok|note|warn|error"},
                {"id":"economy","finding":"","severity":"ok|note|warn|error"}],
 "next_axis_hint":"S0|D|T|S1|K|none",
 "observation_summary":""
}
"""


_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.MULTILINE)


def _strip_fences(text: str) -> str:
    return _FENCE_RE.sub("", text).strip()


def _sdk_analyze(text: str, mode: Mode, api_key: str) -> dict[str, Any]:
    import anthropic  # lazy — HTTP-mode users don't need this dep

    client = anthropic.Anthropic(api_key=api_key)
    rubric = RUBRIC_PARTIAL if mode == "partial" else RUBRIC_FULL

    raw = ""
    for attempt in range(2):
        try:
            resp = client.messages.create(
                model=SANDBOX_MODEL,
                max_tokens=SANDBOX_MAX_TOKENS,
                system=rubric,
                messages=[{"role": "user", "content": text}],
            )
            raw = "".join(b.text for b in resp.content if b.type == "text")
            return json.loads(_strip_fences(raw))
        except json.JSONDecodeError:
            if attempt == 1:
                return {"error": "JSON parse failed after retry", "raw": raw}
        except anthropic.APIError as e:
            return {"error": f"API error: {type(e).__name__}: {e}", "raw": raw}

    return {"error": "unknown failure", "raw": raw}


def analyze(text: str, mode: Mode = "full") -> dict[str, Any]:
    """分析一段散文，返回结构化 JSON。

    路由优先级：ANALYZER_URL > ANTHROPIC_API_KEY > 错误。
    """
    if base_url():
        return post_json("/api/diagnose", {"text": text, "mode": mode})

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        return _sdk_analyze(text, mode, api_key)

    return {"error": "Neither ANALYZER_URL nor ANTHROPIC_API_KEY set", "raw": ""}


if __name__ == "__main__":
    import sys
    mode: Mode = "partial" if "--partial" in sys.argv else "full"
    text = sys.stdin.read()
    print(json.dumps(analyze(text, mode), ensure_ascii=False, indent=2))
