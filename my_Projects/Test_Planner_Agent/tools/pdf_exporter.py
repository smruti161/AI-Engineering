"""
tools/pdf_exporter.py
Layer 3 — Deterministic export tool.
Converts a markdown string to .md and .pdf files in .tmp/.
No LLM calls.
"""

import re
import unicodedata
from pathlib import Path

TMP_DIR = Path(__file__).parent.parent / ".tmp"


def _ensure_tmp():
    TMP_DIR.mkdir(parents=True, exist_ok=True)


def export_to_markdown(content: str, project_key: str, timestamp: str) -> Path:
    """Write test plan markdown to .tmp/ and return the path."""
    _ensure_tmp()
    path = TMP_DIR / f"test_plan_{project_key}_{timestamp}.md"
    path.write_text(content, encoding="utf-8")
    return path


def export_to_pdf(content: str, project_key: str, timestamp: str) -> Path:
    """
    Convert markdown to PDF and save to .tmp/.
    Uses fpdf2 with Unicode support. Falls back to HTML file if all else fails.
    """
    _ensure_tmp()
    pdf_path = TMP_DIR / f"test_plan_{project_key}_{timestamp}.pdf"

    try:
        _export_weasyprint(content, pdf_path)
        return pdf_path
    except ImportError:
        pass
    except Exception:
        pass

    try:
        _export_fpdf2_unicode(content, pdf_path)
        return pdf_path
    except Exception:
        pass

    # Final fallback: save as HTML with .pdf name — user can print-to-PDF from browser
    try:
        import markdown as md_lib
        html_body = md_lib.markdown(content, extensions=["tables", "fenced_code"])
        html = f"""<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{{font-family:Arial,sans-serif;margin:40px;line-height:1.6;color:#222}}
  h1{{color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px}}
  h2{{color:#16213e;border-bottom:1px solid #ccc;padding-bottom:4px}}
  table{{border-collapse:collapse;width:100%;margin:16px 0}}
  th,td{{border:1px solid #ccc;padding:8px 12px;text-align:left}}
  th{{background:#f0f4f8;font-weight:bold}}
</style></head><body>{html_body}</body></html>"""
        # Save as .html alongside the pdf path
        html_path = pdf_path.with_suffix(".html")
        html_path.write_text(html, encoding="utf-8")
        # Write a note in the pdf path
        pdf_path.write_text(
            f"PDF generation failed. Open the HTML file instead:\n{html_path}\n\n"
            "Or install weasyprint: pip install weasyprint\n\n" + content,
            encoding="utf-8",
        )
    except Exception:
        pdf_path.write_text(content, encoding="utf-8")

    return pdf_path


def _export_weasyprint(content: str, output_path: Path):
    import markdown as md_lib
    from weasyprint import HTML

    html_body = md_lib.markdown(content, extensions=["tables", "fenced_code", "toc"])
    html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body{{font-family:Arial,sans-serif;margin:40px;line-height:1.6;color:#222}}
  h1{{color:#1a1a2e;border-bottom:2px solid #1a1a2e;padding-bottom:6px}}
  h2{{color:#16213e;border-bottom:1px solid #ccc;padding-bottom:4px}}
  h3{{color:#0f3460}}
  table{{border-collapse:collapse;width:100%;margin:16px 0}}
  th,td{{border:1px solid #ccc;padding:8px 12px;text-align:left}}
  th{{background:#f0f4f8;font-weight:bold}}
  code{{background:#f4f4f4;padding:2px 5px;border-radius:3px;font-size:.9em}}
</style></head><body>{html_body}</body></html>"""
    HTML(string=html).write_pdf(str(output_path))


def _sanitize(text: str) -> str:
    """Replace Unicode characters that latin-1 fonts cannot handle."""
    replacements = {
        '\u2014': '--',   # em dash
        '\u2013': '-',    # en dash
        '\u2018': "'",    # left single quote
        '\u2019': "'",    # right single quote
        '\u201c': '"',    # left double quote
        '\u201d': '"',    # right double quote
        '\u2022': '*',    # bullet
        '\u2026': '...',  # ellipsis
        '\u00a0': ' ',    # non-breaking space
        '\u2192': '->',   # right arrow
        '\u2190': '<-',   # left arrow
        '\u2713': 'v',    # check mark
        '\u274c': 'x',    # cross mark
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    # Remove any remaining non-latin-1 characters
    return text.encode('latin-1', errors='replace').decode('latin-1')


def _export_fpdf2_unicode(content: str, output_path: Path):
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    for line in content.split("\n"):
        clean_line = _sanitize(line)
        stripped = clean_line.strip()

        if line.startswith("# "):
            pdf.set_font("Helvetica", "B", 16)
            pdf.multi_cell(0, 9, _sanitize(line[2:].strip()))
            pdf.set_font("Helvetica", size=10)
        elif line.startswith("## "):
            pdf.set_font("Helvetica", "B", 13)
            pdf.multi_cell(0, 8, _sanitize(line[3:].strip()))
            pdf.set_font("Helvetica", size=10)
        elif line.startswith("### "):
            pdf.set_font("Helvetica", "B", 11)
            pdf.multi_cell(0, 7, _sanitize(line[4:].strip()))
            pdf.set_font("Helvetica", size=10)
        elif stripped == "":
            pdf.ln(3)
        else:
            # Strip markdown bold/italic/code markers
            clean = re.sub(r'\*\*(.+?)\*\*', r'\1', clean_line)
            clean = re.sub(r'\*(.+?)\*', r'\1', clean)
            clean = re.sub(r'`(.+?)`', r'\1', clean)
            pdf.set_font("Helvetica", size=10)
            pdf.multi_cell(0, 5, clean)

    pdf.output(str(output_path))
