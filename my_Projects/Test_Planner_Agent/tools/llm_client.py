"""
tools/llm_client.py
Layer 3 — Multi-provider LLM client.
Supports: claude, groq, grok, ollama, falcon.
Prompt logic is identical across all providers.
"""

from dataclasses import dataclass
from typing import Optional
import re


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
        "falcon": "tiiuae/falcon-40b-instruct",
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
        if not issue.get("acceptance_criteria"):
            flags.append(f"{key}: No acceptance criteria found. Add context to improve test plan quality.")
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
            return _generate_falcon(conn, system_prompt, user_message)
        else:
            return {"success": False, "error": f"Unknown provider: {conn.provider}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ── System & User Prompt Builders ────────────────────────────────────────────

def _build_system_prompt(template: str) -> str:
    return f"""You are a senior QA engineer specializing in software testing.

Your task is to generate a comprehensive test plan based on Jira requirements provided by the user.

STRICT RULES:
1. You MUST follow the exact structure of the test plan template provided below.
2. Every section heading in the template MUST appear in your output — no exceptions.
3. Do NOT add sections that are not in the template.
4. If information needed for a section is not available from the Jira stories, output exactly:
   [NEEDS INFO: <describe what specific information is missing>]
5. Fill in all sections with specific, actionable test scenarios derived from the Jira requirements.
6. For test cases, be concrete: include test scenario name, preconditions, steps, and expected result.

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

        desc = issue.get("description", "").strip()
        lines.append(f"\n**Description:**\n{desc if desc else 'Not provided.'}")

        ac = issue.get("acceptance_criteria", "").strip()
        lines.append(f"\n**Acceptance Criteria:**\n{ac if ac else 'Not provided.'}")
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
) -> dict:
    import anthropic
    client = anthropic.Anthropic(api_key=conn.api_key)

    # Prompt caching: cache system prompt + template (Rule 6 from gemini.md)
    resp = client.messages.create(
        model=conn.model,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
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
        timeout=120,
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
    base = (conn.base_url or "https://api.ai71.ai/v1").rstrip("/")
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


def _generate_falcon(conn: LLMConnection, system_prompt: str, user_message: str) -> dict:
    import requests as req
    base = (conn.base_url or "https://api.ai71.ai/v1").rstrip("/")
    resp = req.post(
        f"{base}/chat/completions",
        headers={
            "Authorization": f"Bearer {conn.api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": conn.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
            "max_tokens": 4096,
            "temperature": 0.3,
        },
        timeout=120,
    )
    if resp.status_code == 200:
        return {"success": True, "test_plan": resp.json()["choices"][0]["message"]["content"]}
    return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
