"""核心分析器。两种调用模式：

- 远端 HTTP 模式（推荐）：设置 ANALYZER_URL（例如 http://localhost:3000/api/diagnose
  或 https://situate.vercel.app/api/diagnose），可选 ANALYZER_TOKEN 走 bearer-token。
  这种模式下 RUBRIC 由远端 TS 服务托管，本地不持有 ANTHROPIC_API_KEY。

- 直连 Anthropic SDK 模式（兼容）：设置 ANTHROPIC_API_KEY，本地直接调 API。
  仅作为离线沙盒，RUBRIC 内嵌在本文件下方。
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Literal
from urllib import error as urllib_error
from urllib import request as urllib_request

# 直连 Anthropic 时使用的模型。判断吃力时可换 "claude-opus-4-7"。
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 4096
HTTP_TIMEOUT = 60.0

Mode = Literal["full", "partial"]

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

# Partial-draft 模式：观察口气而不是裁判口气；明确允许 D/T/S1 缺位且不补编。
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


def _http_analyze(url: str, text: str, mode: Mode, token: str | None) -> dict[str, Any]:
    body = json.dumps({"text": text, "mode": mode}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib_request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib_request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
    except urllib_error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}", "raw": e.read().decode("utf-8", "replace")}
    except urllib_error.URLError as e:
        return {"error": f"URL error: {e.reason}", "raw": ""}

    try:
        return json.loads(_strip_fences(raw))
    except json.JSONDecodeError:
        return {"error": "remote returned non-JSON", "raw": raw}


def _sdk_analyze(text: str, mode: Mode, api_key: str) -> dict[str, Any]:
    import anthropic  # imported lazily so HTTP mode users don't need the SDK

    client = anthropic.Anthropic(api_key=api_key)
    rubric = RUBRIC_PARTIAL if mode == "partial" else RUBRIC_FULL

    raw = ""
    for attempt in range(2):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
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

    mode="full"     完整稿——门神判定 + 失败类型
    mode="partial"  草稿——观察 S0/D/T/S1/K 各轴当前状态，不下最终判决

    路由：ANALYZER_URL 设了走 HTTP，否则 ANTHROPIC_API_KEY 走 SDK，都没则返回 error。
    """
    url = os.environ.get("ANALYZER_URL")
    if url:
        return _http_analyze(url, text, mode, os.environ.get("ANALYZER_TOKEN"))

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if api_key:
        return _sdk_analyze(text, mode, api_key)

    return {"error": "Neither ANALYZER_URL nor ANTHROPIC_API_KEY set", "raw": ""}


if __name__ == "__main__":
    import sys
    mode: Mode = "partial" if "--partial" in sys.argv else "full"
    text = sys.stdin.read()
    print(json.dumps(analyze(text, mode), ensure_ascii=False, indent=2))
