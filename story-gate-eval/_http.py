"""共享 HTTP 客户端工具：把 Vercel route 那一头的 base URL 解析、bearer
auth、JSON POST 都收在这里，三个脚本（analyze / revise_rubric /
generate_variations）共用。

环境变量约定：
- ANALYZER_URL    base URL，比如 https://situate.vercel.app（推荐）或
                  http://localhost:3000。为向后兼容，如果它已经指向了
                  /api/diagnose，会自动去掉这个后缀。
- ANALYZER_TOKEN  对应 Vercel 上的 DIAGNOSTIC_INTERNAL_TOKEN，三个 endpoint
                  共用这一个 token。
"""
from __future__ import annotations

import json
import os
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

DEFAULT_TIMEOUT = 120.0  # meta endpoints with adaptive thinking can take 30-60s


def base_url() -> str | None:
    """读 ANALYZER_URL，剥掉常见后缀，返回干净的 base URL（不带尾斜杠）。

    None 表示未配置——上层应当报错或走 fallback。
    """
    url = os.environ.get("ANALYZER_URL", "").strip().rstrip("/")
    if not url:
        return None
    # 兼容：旧版本把整个 /api/diagnose URL 写进 ANALYZER_URL
    for suffix in ("/api/diagnose", "/api/revise-rubric", "/api/generate-variation"):
        if url.endswith(suffix):
            return url[: -len(suffix)]
    return url


def post_json(
    path: str, body: dict[str, Any], timeout: float = DEFAULT_TIMEOUT
) -> dict[str, Any]:
    """POST {body} 到 ${ANALYZER_URL}{path}，返回 JSON 字典。失败返回
    {"error": ..., "raw": ...}，绝不抛——上层批处理不应被一个 specimen 崩掉。
    """
    bu = base_url()
    if not bu:
        return {"error": "ANALYZER_URL not set", "raw": ""}

    url = f"{bu}{path}"
    payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    token = os.environ.get("ANALYZER_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib_request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib_request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
    except urllib_error.HTTPError as e:
        return {
            "error": f"HTTP {e.code} {e.reason}",
            "raw": e.read().decode("utf-8", "replace"),
        }
    except urllib_error.URLError as e:
        return {"error": f"URL error: {e.reason}", "raw": ""}
    except TimeoutError:
        return {"error": f"timeout after {timeout}s", "raw": ""}

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": "remote returned non-JSON", "raw": raw}
