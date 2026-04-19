# task_plan.md — BLAST Phase Checklist
# Test Planner Agent

---

## Protocol 0 — Initialization
- [x] Create `gemini.md` (Project Constitution)
- [x] Create `task_plan.md` (this file)
- [x] Create `findings.md`
- [x] Create `progress.md`
- [x] Create `.env` template

## Phase 1 — B (Blueprint) ✅ COMPLETE
- [x] Ask 5 Discovery Questions (North Star, Integrations, Source of Truth, Payload, Rules)
- [x] Define JSON Data Schema in `gemini.md`
- [x] Confirm UI framework: React + FastAPI
- [x] Confirm delivery: Display in UI + Export MD/PDF
- [x] Confirm behavioral rules: Strict template + Ask before assuming

## Phase 2 — L (Link)
- [ ] Build `tools/jira_client.py` with `test_connection()` method
- [ ] Verify Jira API connection with real credentials
- [ ] Build `tools/llm_client.py` with basic Claude ping
- [ ] Verify Claude API responds correctly

## Phase 3 — A (Architect)
### Layer 1 — Architecture SOPs
- [ ] Write `architecture/jira_fetch_sop.md`
- [ ] Write `architecture/llm_generation_sop.md`
- [ ] Write `architecture/test_plan_output_sop.md`

### Layer 3 — Tools
- [ ] Complete `tools/jira_client.py` (full: test_connection, get_issues, get_issue_by_id)
- [ ] Complete `tools/llm_client.py` (full: check_missing_info, generate_test_plan)
- [ ] Build `tools/test_plan_generator.py` (orchestrator)
- [ ] Build `tools/pdf_exporter.py` (markdown → PDF)

### Layer 2 — Navigation (FastAPI)
- [ ] `POST /api/connections` — save Jira connection
- [ ] `GET /api/connections` — list saved connections
- [ ] `POST /api/issues/fetch` — fetch Jira issues
- [ ] `POST /api/test-plan/generate` — generate via LLM
- [ ] `GET /api/test-plan/export/markdown` — download .md
- [ ] `GET /api/test-plan/export/pdf` — download .pdf
- [ ] `GET /api/history` — view previously generated plans

## Phase 4 — S (Stylize)
### React Frontend
- [ ] Project setup (Vite + React + TypeScript)
- [ ] Step 1: `Setup.tsx` — Jira connection form + saved connections dropdown
- [ ] Step 2: `FetchIssues.tsx` — product name, project key, sprint, context
- [ ] Step 3: `Review.tsx` — issue cards, missing info flags, additional notes
- [ ] Step 4: `TestPlan.tsx` — rendered markdown + export buttons + View History

## Phase 5 — T (Trigger)
- [ ] End-to-end test: Jira → Issues → Generate → Export
- [ ] Verify all template sections appear in output
- [ ] Verify MD and PDF export work
- [ ] Final documentation update in `gemini.md`
