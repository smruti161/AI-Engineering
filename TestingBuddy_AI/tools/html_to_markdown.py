"""
tools/html_to_markdown.py
Convert contentEditable HTML (produced by ReactMarkdown + user edits) back to
GitHub-flavoured markdown so the existing _build_docx can render it correctly.
"""

import re


def html_to_markdown(html: str) -> str:
    html = html.replace("\r\n", "\n").replace("\r", "\n")

    # Tables — convert before other replacements touch their content
    html = re.sub(
        r"<table\b[^>]*>.*?</table>",
        _convert_table,
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # Horizontal rules
    html = re.sub(r"<hr\s*/?>", "\n\n---\n\n", html, flags=re.IGNORECASE)

    # Headings h1–h6
    for level in range(6, 0, -1):
        def _h(m, lv=level):
            return "\n\n" + "#" * lv + " " + _inline(m.group(1)) + "\n\n"
        html = re.sub(
            rf"<h{level}\b[^>]*>(.*?)</h{level}>",
            _h,
            html,
            flags=re.DOTALL | re.IGNORECASE,
        )

    # List items
    html = re.sub(
        r"<li\b[^>]*>(.*?)</li>",
        lambda m: "- " + _inline(m.group(1)) + "\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    html = re.sub(r"</?[uo]l\b[^>]*>", "\n", html, flags=re.IGNORECASE)

    # Paragraphs
    html = re.sub(
        r"<p\b[^>]*>(.*?)</p>",
        lambda m: _inline(m.group(1)) + "\n\n",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )

    # Divs / spans — unwrap
    html = re.sub(r"<div\b[^>]*>", "\n", html, flags=re.IGNORECASE)
    html = re.sub(r"</div>", "\n", html, flags=re.IGNORECASE)

    # Line breaks
    html = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)

    # Inline formatting
    html = _apply_inline(html)

    # Strip any remaining tags
    html = re.sub(r"<[^>]+>", "", html)

    # HTML entities
    html = _decode_entities(html)

    # Collapse 3+ blank lines → 2
    html = re.sub(r"\n{3,}", "\n\n", html)

    return html.strip()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _inline(text: str) -> str:
    """Process inline elements inside a block (table cell, heading, list item)."""
    # Collapse <p> wrappers to plain text — prevents double-newlines inside <li>
    text = re.sub(r"<p\b[^>]*>(.*?)</p>", lambda m: m.group(1) + " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = _apply_inline(text)
    text = re.sub(r"<[^>]+>", "", text)
    text = _decode_entities(text)
    return text.strip()


def _apply_inline(text: str) -> str:
    """Replace bold / italic / code HTML with markdown equivalents."""
    text = re.sub(r"<strong\b[^>]*>(.*?)</strong>", r"**\1**", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<b\b[^>]*>(.*?)</b>", r"**\1**", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<em\b[^>]*>(.*?)</em>", r"*\1*", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<i\b[^>]*>(.*?)</i>", r"*\1*", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<code\b[^>]*>(.*?)</code>", r"`\1`", text, flags=re.DOTALL | re.IGNORECASE)
    return text


def _convert_table(m: re.Match) -> str:
    table_html = m.group(0)
    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", table_html, re.DOTALL | re.IGNORECASE)
    if not rows:
        return ""
    md_rows: list[str] = []
    for i, row in enumerate(rows):
        cells = re.findall(r"<t[dh]\b[^>]*>(.*?)</t[dh]>", row, re.DOTALL | re.IGNORECASE)
        cells = [_inline(c).replace("|", "\\|") for c in cells]
        if not cells:
            continue
        md_rows.append("| " + " | ".join(cells) + " |")
        if i == 0:
            md_rows.append("|" + " --- |" * len(cells))
    return "\n\n" + "\n".join(md_rows) + "\n\n"


def _decode_entities(text: str) -> str:
    return (
        text.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&nbsp;", " ")
            .replace("&#39;", "'")
            .replace("&quot;", '"')
            .replace("&apos;", "'")
    )
