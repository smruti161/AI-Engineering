"""
tools/llm_client.py
Layer 3 — Multi-provider LLM client.
Supports: claude, groq, grok, ollama, falcon.
Prompt logic is identical across all providers.
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import re

ANTI_HALLUCINATION_PATH = Path(__file__).parent.parent.parent / "anti_haluination_rules" / "anti_hallucination.md"

def _get_anti_hallucination_rules() -> str:
    if not ANTI_HALLUCINATION_PATH.exists():
        return ""
    return ANTI_HALLUCINATION_PATH.read_text(encoding="utf-8")


@dataclass
class LLMConnection:
    name: str
    provider: str          # "claude" | "groq" | "grok" | "ollama" | "falcon"
    api_key: Optional[str]
    model: str
    base_url: Optional[str] = None  # required for ollama

    # Sensible model defaults per provider
    DEFAULT_MODELS = {
        "claude": "claude-sonnet-4-6",
        "groq": "llama-3.3-70b-versatile",
        "grok": "grok-3-mini",
        "ollama": "llama3.2",
        "falcon": "claude-sonnet-4-20250514",
    }

    def __post_init__(self):
        if not self.model:
            self.model = self.DEFAULT_MODELS.get(self.provider, "")


def test_llm_connection(conn: LLMConnection) -> dict:
    """
    Test LLM provider connection with a minimal ping.
    Returns {"success": True, "model": ...} or {"success": False, "error": ...}
    """
    try:
        if conn.provider == "claude":
            return _test_claude(conn)
        elif conn.provider == "groq":
            return _test_groq(conn)
        elif conn.provider == "grok":
            return _test_grok(conn)
        elif conn.provider == "ollama":
            return _test_ollama(conn)
        elif conn.provider == "falcon":
            return _test_falcon(conn)
        else:
            return {"success": False, "error": f"Unknown provider: {conn.provider}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def check_missing_info(issues: list[dict]) -> list[str]:
    """
    Pre-check Jira issues for missing critical information.
    Returns a list of warning strings to show the user before generation.
    Implements Rule 2 (Ask Before Assuming) from gemini.md.
    """
    flags = []
    for issue in issues:
        key = issue.get("key", "?")
        desc = issue.get("description", "") or ""
        if len(desc.strip()) < 50:
            flags.append(f"{key}: Description is very short or missing. More detail will produce better test cases.")
    return flags


def generate_test_plan(
    conn: LLMConnection,
    issues: list[dict],
    template: str,
    additional_context: str = "",
) -> dict:
    """
    Generate a test plan from Jira issues using the provided template.
    Returns {"success": True, "test_plan": "markdown string"} or {"success": False, "error": ...}
    """
    system_prompt = _build_system_prompt(template)
    user_message = _build_user_message(issues, additional_context)

    try:
        if conn.provider == "claude":
            return _generate_claude(conn, system_prompt, user_message, template)
        elif conn.provider == "groq":
            return _generate_groq(conn, system_prompt, user_message)
        elif conn.provider == "grok":
            return _generate_grok(conn, system_prompt, user_message)
        elif conn.provider == "ollama":
            return _generate_ollama(conn, system_prompt, user_message)
        elif conn.provider == "falcon":
            return _generate_falcon(conn, system_prompt, user_message, timeout=120)
        else:
            return {"success": False, "error": f"Unknown provider: {conn.provider}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── System & User Prompt Builders ────────────────────────────────────────────

def _build_system_prompt(template: str) -> str:
    anti_hallucination = _get_anti_hallucination_rules()
    ah_prefix = f"{anti_hallucination}\n\n---\n\n" if anti_hallucination else ""
    return f"""{ah_prefix}You are a senior QA engineer specializing in software testing.

Your task is to generate a comprehensive test plan based on Jira requirements provided by the user.

STRICT RULES:
1. You MUST follow the exact structure of the test plan template provided below.
2. Every section heading in the template MUST appear in your output — no exceptions.
3. Do NOT add sections that are not in the template.
4. Use [NEEDS INFO: <reason>] ONLY when information is genuinely not present anywhere in the user message. Never use it for data that is clearly provided (issue key, summary, status, type, component).
5. Fill in all sections with specific, actionable content derived from the Jira requirements.

DELIVERABLES TABLE (Section 2) — STRICT RULES:
- Output exactly one row per Jira issue provided in the user message — no more, no fewer.
- Each row must use the actual values from the issue: Issue Type, Key, Summary, Status, Component.
- If component is not set, write "Not Specified". Do NOT write [NEEDS INFO] for any of these columns.

TEST STRATEGIES (Section 5) — STRICT RULES:
- Determine the appropriate testing types and number of subsections from the requirements.
- Do NOT limit to exactly 2 strategies. Add as many numbered subsections (5.1, 5.2, 5.3 …) as the ticket content warrants.
- Common types to consider based on content: Functional, Integration, UI/UX, Regression, Performance, Security, Accessibility, Negative/Error path.
- Each subsection must contain specific, concrete bullet points derived from the actual requirements — not generic placeholders.

TEST PLAN TEMPLATE:
---
{template}
---

Generate the test plan now based on the Jira requirements the user provides."""


def _build_user_message(issues: list[dict], additional_context: str = "") -> str:
    lines = ["Here are the Jira requirements to generate the test plan from:\n"]

    for issue in issues:
        lines.append(f"## {issue['key']}: {issue['summary']}")
        lines.append(f"**Type:** {issue.get('issue_type', 'N/A')}")
        lines.append(f"**Status:** {issue.get('status', 'N/A')}")
        lines.append(f"**Priority:** {issue.get('priority', 'N/A')}")
        component = (issue.get("component") or "").strip()
        lines.append(f"**Component:** {component or 'Not Specified'}")

        desc = issue.get("description", "").strip()
        lines.append(f"\n**Description:**\n{desc if desc else 'Not provided.'}")
        lines.append("")

    if additional_context.strip():
        lines.append(f"\n## Additional Context from Tester:\n{additional_context.strip()}")

    lines.append("\nPlease generate a complete test plan following the template structure exactly.")
    return "\n".join(lines)


# ── Claude Provider ───────────────────────────────────────────────────────────

def _test_claude(conn: LLMConnection) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=conn.api_key)
    resp = client.messages.create(
        model=conn.model,
        max_tokens=10,
        messages=[{"role": "user", "content": "ping"}],
    )
    return {"success": True, "model": conn.model, "provider": "claude"}


def _generate_claude(
    conn: LLMConnection,
    system_prompt: str,
    user_message: str,
    template: str,
    images: list[dict] | None = None,
) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=conn.api_key)

    # Build content blocks — text first, then optional images for vision
    user_content: list[dict] = [{"type": "text", "text": user_message}]
    if images:
        for img in images:
            data = img.get("data")
            media_type = img.get("media_type")
            if not data or not isinstance(data, str) or not media_type:
                continue
            user_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": data,
                },
            })

    resp = client.messages.create(
        model=conn.model,
        max_tokens=8000,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    return {"success": True, "test_plan": resp.content[0].text}


# ── GROQ Provider ─────────────────────────────────────────────────────────────

def _test_groq(conn: LLMConnection) -> dict:
    from groq import Groq
    client = Groq(api_key=conn.api_key)
    client.chat.completions.create(
        model=conn.model,
        messages=[{"role": "user", "content": "ping"}],
        max_tokens=5,
    )
    return {"success": True, "model": conn.model, "provider": "groq"}


def _generate_groq(conn: LLMConnection, system_prompt: str, user_message: str) -> dict:
    from groq import Groq
    client = Groq(api_key=conn.api_key)
    resp = client.chat.completions.create(
        model=conn.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4096,
        temperature=0.3,
    )
    return {"success": True, "test_plan": resp.choices[0].message.content}


# ── Grok (xAI) Provider ───────────────────────────────────────────────────────

def _test_grok(conn: LLMConnection) -> dict:
    import requests as req
    base = conn.base_url or "https://api.x.ai/v1"
    resp = req.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {conn.api_key}", "Content-Type": "application/json"},
        json={"model": conn.model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5},
        timeout=10,
    )
    if resp.status_code == 200:
        return {"success": True, "model": conn.model, "provider": "grok"}
    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


def _generate_grok(conn: LLMConnection, system_prompt: str, user_message: str) -> dict:
    import requests as req
    base = conn.base_url or "https://api.x.ai/v1"
    resp = req.post(
        f"{base}/chat/completions",
        headers={"Authorization": f"Bearer {conn.api_key}", "Content-Type": "application/json"},
        json={
            "model": conn.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 4096,
            "temperature": 0.3,
        },
        timeout=90,
    )
    if resp.status_code == 200:
        return {"success": True, "test_plan": resp.json()["choices"][0]["message"]["content"]}
    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


# ── Ollama (local) Provider ───────────────────────────────────────────────────

def _test_ollama(conn: LLMConnection) -> dict:
    import requests as req
    base = conn.base_url or "http://localhost:11434"
    try:
        resp = req.get(f"{base}/api/tags", timeout=5)
        if resp.status_code == 200:
            models = [m["name"] for m in resp.json().get("models", [])]
            if conn.model not in models and not any(conn.model in m for m in models):
                return {
                    "success": False,
                    "error": f"Model '{conn.model}' not found in Ollama. Available: {', '.join(models[:5])}",
                }
            return {"success": True, "model": conn.model, "provider": "ollama"}
        return {"success": False, "error": f"Ollama not reachable at {base}"}
    except Exception as e:
        return {"success": False, "error": f"Cannot reach Ollama at {base}: {e}"}


def _generate_ollama(conn: LLMConnection, system_prompt: str, user_message: str) -> dict:
    import requests as req
    base = conn.base_url or "http://localhost:11434"
    resp = req.post(
        f"{base}/api/chat",
        json={
            "model": conn.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 4096},
        },
        timeout=300,
    )
    if resp.status_code == 200:
        return {"success": True, "test_plan": resp.json()["message"]["content"]}
    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


# ── Falcon AI Provider ────────────────────────────────────────────────────────

def _test_falcon(conn: LLMConnection) -> dict:
    import requests as req
    base = (conn.base_url or "https://falconai.planview-prod.io/api").rstrip("/")
    resp = req.post(
        f"{base}/chat/completions",
        headers={
            "Authorization": f"Bearer {conn.api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": conn.model,
            "messages": [{"role": "user", "content": "ping"}],
            "max_tokens": 5,
        },
        timeout=15,
    )
    if resp.status_code == 200:
        return {"success": True, "model": conn.model, "provider": "falcon"}
    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}


def _generate_falcon(conn: LLMConnection, system_prompt: str, user_message: str, timeout: int = 300) -> dict:
    import requests as req
    base = (conn.base_url or "https://falconai.planview-prod.io/api").rstrip("/")
    headers = {
        "Authorization": f"Bearer {conn.api_key}",
        "Content-Type": "application/json",
    }
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    # Some Falcon models run a RAG/search loop before generating text.
    # We handle up to 3 tool-call rounds by returning empty results so the
    # model falls back to the information already in the conversation.
    import time as _time

    for _ in range(3):
        # Retry up to 2 times on 504 (gateway timeout — transient server overload)
        resp = None
        for attempt in range(3):
            resp = req.post(
                f"{base}/chat/completions",
                headers=headers,
                json={
                    "model": conn.model,
                    "messages": messages,
                    "max_tokens": 8000,
                    "temperature": 0.3,
                },
                timeout=timeout,
            )
            if resp.status_code != 504:
                break
            if attempt < 2:
                print(f"[falcon] 504 on attempt {attempt + 1}, retrying in 5s…")
                _time.sleep(5)

        if resp.status_code != 200:
            # Return a clean message instead of raw HTML gateway error pages
            if "<html" in resp.text.lower() or resp.status_code in (502, 503, 504):
                return {"success": False, "error": f"Falcon gateway error (HTTP {resp.status_code}). The model is overloaded or the ticket content is too large. Try splitting into smaller tickets or retry in a moment."}
            return {"success": False, "error": f"Falcon error (HTTP {resp.status_code}): {resp.text[:300]}"}

        data = resp.json()
        choice = data.get("choices", [{}])[0]
        message = choice.get("message", {})
        content = message.get("content")
        finish_reason = choice.get("finish_reason", "unknown")

        if finish_reason != "tool_calls":
            break

        # Respond to every tool call with an empty result and continue the loop
        tool_calls = message.get("tool_calls", [])
        messages.append({
            "role": "assistant",
            "content": None,
            "tool_calls": tool_calls,
        })
        for tc in tool_calls:
            messages.append({
                "role": "tool",
                "tool_call_id": tc.get("id", ""),
                "content": "No additional information found. Use only the Jira ticket details provided.",
            })

    if not content:
        return {"success": False, "error": f"Falcon returned empty content (finish_reason: {finish_reason}). Try a different model."}
    return {"success": True, "test_plan": content}

# NOTE: Callers should catch requests.exceptions.ReadTimeout and surface a friendly message.
