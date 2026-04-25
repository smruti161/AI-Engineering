"""
tools/test_plan_generator.py
Layer 3 — Orchestrator.
Loads template → checks missing info → calls LLM → validates output → returns test plan.
"""

from pathlib import Path
from datetime import datetime, timezone

from tools.llm_client import LLMConnection, check_missing_info, generate_test_plan
from tools.pdf_exporter import export_to_markdown
from tools.doc_exporter import export_to_doc

TEMPLATE_PATH = Path(__file__).parent.parent / "test_plan_templates" / "test_plan.md"


def get_template() -> str:
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Test plan template not found at: {TEMPLATE_PATH}")
    return TEMPLATE_PATH.read_text(encoding="utf-8")


def run(
    llm_conn: LLMConnection,
    issues: list[dict],
    product_name: str,
    project_key: str,
    additional_context: str = "",
    child_issues: list[dict] | None = None,
) -> dict:
    """
    Full orchestration:
    1. Load template
    2. Check for missing info (Rule 2)
    3. Generate test plan via LLM
    4. Validate all template sections are present
    5. Export to .tmp/ as MD and PDF
    6. Return result matching the Output Schema from gemini.md

    Returns:
    {
        "success": True/False,
        "metadata": { ... },
        "test_plan_markdown": "...",
        "export_paths": { "markdown": "...", "pdf": "..." },
        "error": "..." (only on failure)
    }
    """
    template = get_template()
    missing_flags = check_missing_info(issues)

    result = generate_test_plan(
        conn=llm_conn,
        issues=issues,
        template=template,
        additional_context=additional_context,
    )

    if not result["success"]:
        return {"success": False, "error": result["error"]}

    test_plan_md = result["test_plan"]

    # Replace the Deliverables section with child items when provided
    if child_issues:
        test_plan_md = _inject_deliverables(test_plan_md, child_issues)

    # Validate all required sections are present
    section_warnings = _validate_sections(template, test_plan_md)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_key = project_key.replace("/", "_").replace(" ", "_")

    md_path = export_to_markdown(test_plan_md, safe_key, timestamp)
    # .docx is generated on first download to avoid blocking the response

    return {
        "success": True,
        "metadata": {
            "jira_project": project_key,
            "product_name": product_name,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "issues_count": len(issues),
            "issue_keys": [i.get("key", "") for i in issues],
            "missing_info_flags": missing_flags,
            "section_warnings": section_warnings,
        },
        "test_plan_markdown": test_plan_md,
        "export_paths": {
            "markdown": str(md_path),
            "doc": str(md_path.with_suffix(".docx")),
        },
    }


def _inject_deliverables(test_plan_md: str, child_issues: list[dict]) -> str:
    """
    Replace the LLM-generated Deliverables table with a table built from child_issues.
    Finds the section between '## ...Deliverables' and the next section boundary.
    """
    import re

    rows = "\n".join(
        "| {} | {} | **{}** | {} | {} |".format(
            i.get("issue_type", ""),
            i.get("key", ""),
            i.get("summary", "").replace("|", "-"),
            i.get("status", ""),
            i.get("component", "") or "Not Specified",
        )
        for i in child_issues
    )
    new_table = (
        "| Issue Type | Key | Summary | Status | Components |\n"
        "|---|---|---|---|---|\n"
        + rows
    )

    # Use a callable so \n is a real newline, not a literal backslash-n
    pattern = r"(##\s+\d*\.?\s*Deliverables[^\n]*\n)(.*?)((?:\n---|\n##\s))"
    def _replacer(m):
        return m.group(1) + "\n" + new_table + "\n" + m.group(3)

    updated = re.sub(pattern, _replacer, test_plan_md, flags=re.DOTALL | re.IGNORECASE)

    if updated == test_plan_md:
        print("[test_plan_generator] Deliverables section not found for injection; skipping.")
    return updated


def _validate_sections(template: str, generated: str) -> list[str]:
    """
    Check that all ## headings from the template appear in the generated output.
    Returns a list of missing section names (empty if all present).
    """
    import re
    template_sections = re.findall(r"^##\s+(.+)$", template, re.MULTILINE)
    generated_lower = generated.lower()
    missing = []
    for section in template_sections:
        if section.lower() not in generated_lower:
            missing.append(section)
    return missing
