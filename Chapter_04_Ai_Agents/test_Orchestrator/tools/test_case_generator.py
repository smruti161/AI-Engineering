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

TEMPLATE_PATH = Path(__file__).parent.parent.parent / "test_case_templates" / "test_case_format.md"

def _get_template() -> str:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Test cases template not found at: {TEMPLATE_PATH}")
    return TEMPLATE_PATH.read_text(encoding="utf-8")


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
    template = _get_template()
    missing_info = check_missing_info(issues)

    system_prompt = f"""{template}

---

STRICT RULES:
1. You MUST follow the exact structure and output format defined in the template above.
2. Output ONLY a Zephyr Scale-compatible markdown table for each issue. No preamble, no explanation outside the tables.
3. Format: one table per issue, preceded only by the issue heading (e.g. `## SCI-123: Issue Summary`).
4. **Test Case ID**: Format `TC_[ISSUE_KEY]_001` (e.g. TC_SCI-123_001). Increment per issue.
5. **Name**: Must always start with "Verify...". Describes WHAT is being tested — do NOT use labels like "Happy Path", "Negative Case", etc.
6. **Objective**: Brief statement of the test goal — must NOT start with "Verify".
7. **Test Script (Step-by-Step) - Step**: Write as `1. action / 2. action / 3. action` — use ` / ` as separator. NOT line breaks or HTML tags.
8. **COMPLETENESS IS MANDATORY**: You MUST generate EVERY possible test case. Do NOT stop early. Do NOT summarize or skip cases. If content is getting long, shorten individual cell text but NEVER omit a test case row.
9. **Dump Used**: Add a final column `Dump Used` to every table. Populate every row with the dump value provided in the metadata. If no dump is specified, write `Not Specified`.
10. Do NOT include `Status` or `Labels / Component` columns — they are not required.

The output table MUST use these EXACT column names in order:
| Test Case ID | Name | Objective | Precondition | Test Script (Step-by-Step) - Step | Test Script (Step-by-Step) - Test Data | Test Script (Step-by-Step) - Expected Result | Test Type | Priority | Dump Used |

Generate test cases now based on the Jira requirements the user provides."""

    lines = [f"# Generate Test Cases\n\n**Product:** {product_name}\n**Project:** {project_key}\n**Dump Used:** {dump_used.strip() or 'Not Specified'}\n"]
    for issue in issues:
        lines.append(f"\n## [{issue['key']}] {issue['summary']}")
        component = (issue.get("component") or "").strip()
        lines.append(f"**Type:** {issue.get('issue_type', 'N/A')} | **Priority:** {issue.get('priority', 'N/A')} | **Component:** {component or 'Not Specified'}")
        desc = (issue.get("description") or "").strip()
        lines.append(f"\n**Description:**\n{desc or '[NEEDS INFO: No description provided]'}")
    if additional_context.strip():
        lines.append(f"\n## Additional Context from Tester\n{additional_context.strip()}")
    if images:
        lines.append(f"\n## Screenshots\n{len(images)} screenshot(s) attached — analyze them for UI behavior, field validations, and flows.")
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
            result = lc._generate_falcon(llm_conn, system_prompt, user_message)
        else:
            return {"success": False, "error": f"Unknown provider: {llm_conn.provider}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

    if not result.get("success"):
        return result

    markdown = result["test_plan"]
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_key = project_key.replace("/", "_").replace(" ", "_")

    md_path = export_to_markdown(markdown, safe_key, timestamp)
    doc_path = export_to_doc(markdown, safe_key, timestamp)

    return {
        "success": True,
        "test_cases": markdown,
        "missing_info": missing_info,
        "export_paths": {
            "markdown": str(md_path),
            "doc": str(doc_path),
        },
    }
