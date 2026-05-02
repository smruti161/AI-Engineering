"""
tools/test_case_generator.py
Layer 3 — Generate detailed test cases from Jira issues using an LLM.
Mirrors the structure of test_plan_generator.py but uses a test-case-specific prompt.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from tools.llm_client import LLMConnection, check_missing_info
import tools.llm_client as lc
from tools.pdf_exporter import export_to_markdown
from tools.doc_exporter import export_to_doc

TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "test_cases_template.md"
ANTI_HALLUCINATION_PATH = Path(__file__).parent.parent / "rules" / "anti_hallucination.md"

def _get_template() -> str:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Test cases template not found at: {TEMPLATE_PATH}")
    return TEMPLATE_PATH.read_text(encoding="utf-8")

def _get_anti_hallucination_rules() -> str:
    if not ANTI_HALLUCINATION_PATH.exists():
        return ""
    return ANTI_HALLUCINATION_PATH.read_text(encoding="utf-8")


def run(
    llm_conn: LLMConnection,
    issues: list[dict],
    product_name: str,
    project_key: str,
    additional_context: str = "",
    dump_used: str = "",
    images: Optional[list[dict]] = None,
) -> dict:
    """
    Generate detailed test cases for a list of Jira issues.

    images: list of {"data": "<base64>", "media_type": "image/png"} dicts (optional, Claude only)

    Returns:
    {
        "success": True/False,
        "test_cases": "markdown string",
        "missing_info": [...],
        "export_paths": {"markdown": "...", "doc": "..."},
        "error": "..." (only on failure)
    }
    """
    try:
        return _run(llm_conn, issues, product_name, project_key, additional_context, dump_used, images)
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {e}"}


def _run(
    llm_conn: LLMConnection,
    issues: list[dict],
    product_name: str,
    project_key: str,
    additional_context: str = "",
    dump_used: str = "",
    images: Optional[list[dict]] = None,
) -> dict:
    template = _get_template()
    anti_hallucination = _get_anti_hallucination_rules()
    missing_info = check_missing_info(issues)

    if images:
        images = [img for img in images if img.get("data") and isinstance(img["data"], str)]
        if not images:
            images = None

    has_images = bool(images)
    has_context = bool(additional_context.strip())

    ah_prefix = f"{anti_hallucination}\n\n---\n\n" if anti_hallucination else ""
    system_prompt = f"""{ah_prefix}{template}

---

## INTERNAL REASONING (do NOT output this — think silently before writing)

Before writing a single table row, mentally complete these steps:

1. For each Jira issue read every sentence of the description and extract:
   - All stated functional behaviours and business rules
   - Preconditions, user roles, and data dependencies
   - Explicit and implied success / failure conditions
   - Edge cases and boundary values

2. If additional context is provided by the tester, absorb all focus areas, known issues, and scope constraints into your scenario list.

3. If screenshots are attached, examine every pixel of each image:
   - Every form field, button, dropdown, modal, and table visible on screen
   - Field labels, required markers, input types, and validation hints
   - Navigation paths, breadcrumbs, and workflow steps
   - Error messages, success toasts, and loading states
   - Any data shown in grids or lists that implies acceptance criteria
   Screenshots are first-class requirements — a visible UI element must produce at least one test case.

4. Compile one complete ordered list of test scenarios per issue before writing.

## OUTPUT RULES (STRICT — nothing else in the response)

1. Output ONLY Zephyr Scale-compatible markdown tables. No preamble, no analysis, no explanation, no code fences.
2. One table per issue, preceded by the issue heading only (e.g. `## SCI-123: Issue Summary`).
3. Every scenario from your internal list MUST become a table row — do NOT skip or summarise.
4. **Test Case ID**: Format `TC_[ISSUE_KEY]_001`, incrementing per row within each issue.
5. **Name**: Always starts with "Verify...". States WHAT is tested.
6. **Objective**: Brief test goal. Must NOT start with "Verify".
6a. **Precondition**: Use numbered format `1. condition / 2. condition / 3. condition` — space-slash-space separator. Never write preconditions as a single plain sentence.
7. **Test Script (Step-by-Step) - Step**: `1. action / 2. action / 3. action` — space-slash-space separator, no line breaks.
8. **Test Script (Step-by-Step) - Test Data**: Same numbered format `1. data / 2. data / 3. data`. Use `N/A` for steps with no data. Entry count MUST equal step count.
9. **Test Script (Step-by-Step) - Expected Result**: Same numbered format `1. result / 2. result / 3. result`. Entry count MUST equal step count.
10. **COMPLETENESS IS MANDATORY**: shorten individual cells if needed but NEVER omit a row.
10a. **NO HTML TAGS**: Never use `<br>`, `<b>`, `<i>`, or any HTML inside table cells. Use plain text only.
11. **Dump Used**: last column — use the dump value from the request metadata, or `Not Specified`.
12. Do NOT include `Status` or `Labels / Component` columns.

The table MUST use these EXACT column names in order:
| Test Case ID | Name | Objective | Precondition | Test Script (Step-by-Step) - Step | Test Script (Step-by-Step) - Test Data | Test Script (Step-by-Step) - Expected Result | Test Type | Priority | Dump Used |

Generate the tables now."""

    # Cap description length to keep the prompt within Falcon's processing limit.
    # Very long descriptions (>3000 chars) cause 504 gateway timeouts.
    MAX_DESC_CHARS = 3000

    lines = [f"# Test Case Generation Request\n\n**Product:** {product_name}\n**Project:** {project_key}\n**Dump Used:** {dump_used.strip() or 'Not Specified'}\n"]
    for issue in issues:
        lines.append(f"\n## [{issue['key']}] {issue['summary']}")
        component = (issue.get("component") or "").strip()
        lines.append(f"**Type:** {issue.get('issue_type', 'N/A')} | **Priority:** {issue.get('priority', 'N/A')} | **Component:** {component or 'Not Specified'}")
        desc = (issue.get("description") or "").strip()
        if len(desc) > MAX_DESC_CHARS:
            desc = desc[:MAX_DESC_CHARS] + "\n\n[Description truncated to fit model limits. Core requirements above are complete.]"
        lines.append(f"\n**Description:**\n{desc or '[NEEDS INFO: No description provided]'}")
    if has_context:
        lines.append(f"\n## Additional Context from Tester\n{additional_context.strip()}")
    if has_images:
        lines.append(
            f"\n## Attached Screenshots ({len(images)})\n"
            "Examine each screenshot carefully — treat every visible element, field, validation rule, "
            "error state, and flow as a concrete test requirement."
        )
    user_message = "\n".join(lines)

    # Dispatch to the correct provider
    try:
        if llm_conn.provider == "claude":
            result = lc._generate_claude(llm_conn, system_prompt, user_message, template, images=images)
        elif llm_conn.provider == "groq":
            result = lc._generate_groq(llm_conn, system_prompt, user_message)
        elif llm_conn.provider == "grok":
            result = lc._generate_grok(llm_conn, system_prompt, user_message)
        elif llm_conn.provider == "ollama":
            result = lc._generate_ollama(llm_conn, system_prompt, user_message)
        elif llm_conn.provider == "falcon":
            result = lc._generate_falcon(llm_conn, system_prompt, user_message, timeout=300)
        else:
            return {"success": False, "error": f"Unknown provider: {llm_conn.provider}"}
    except Exception as e:
        import requests as _req
        if isinstance(e, _req.exceptions.ReadTimeout):
            return {"success": False, "error": "Falcon timed out generating test cases. Try with a single Jira ticket or retry — the model may be under load."}
        return {"success": False, "error": str(e)}

    if not result.get("success"):
        return result

    markdown = result.get("test_plan") or ""
    if not markdown.strip():
        return {"success": False, "error": "LLM returned an empty response. Try reducing the number of issues or adding more context."}

    # Strip HTML line-break tags the LLM occasionally injects into table cells
    import re
    markdown = re.sub(r'\s*<br\s*/?>\s*', ' ', markdown, flags=re.IGNORECASE).strip()

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_key = project_key.replace("/", "_").replace(" ", "_")

    md_path = export_to_markdown(markdown, safe_key, timestamp)

    return {
        "success": True,
        "test_cases": markdown,
        "missing_info": missing_info,
        "export_paths": {
            "markdown": str(md_path),
            "doc": str(md_path.with_suffix(".docx")),  # generated on first download
        },
    }
