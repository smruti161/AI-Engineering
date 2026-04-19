# SOP: Test Plan Output & Export
## Goal
Validate the generated test plan, save it to .tmp/, and make it available for download.

## Steps
1. Receive markdown string from LLM generation step
2. Validate: check all `## Section` headings from template are present in output
3. Export to `.tmp/test_plan_{project_key}_{timestamp}.md`
4. Export to `.tmp/test_plan_{project_key}_{timestamp}.pdf`
   - Primary: weasyprint (markdown → HTML → PDF)
   - Fallback: fpdf2 (plain text PDF)
5. Save history record to `.tmp/history.json`
6. Return export paths + metadata to frontend

## PDF Export Strategy
- Install: `pip install markdown weasyprint`
- If weasyprint unavailable (Windows GTK deps): `pip install fpdf2`
- fpdf2 strips markdown syntax and renders plain text with basic heading formatting

## Tools
- `tools/pdf_exporter.py`: `export_to_markdown()`, `export_to_pdf()`
- `tools/test_plan_generator.py`: `run()` (full orchestration), `_validate_sections()`
