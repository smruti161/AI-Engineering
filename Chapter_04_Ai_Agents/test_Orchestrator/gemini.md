# gemini.md — Project Constitution
# Test Planner Agent

> This file is LAW. Do not modify unless a schema changes, a rule is added, or architecture is modified.

---

## Data Schemas

### Input Schema — Jira Connection
```json
{
  "name": "string",
  "url": "string (e.g. https://yourcompany.atlassian.net)",
  "email": "string",
  "api_token": "string",
  "source_type": "jira | ado"
}
```

### Input Schema — LLM Connection
```json
{
  "name": "string",
  "provider": "claude | groq | grok | ollama",
  "api_key": "string | null (null for Ollama)",
  "model": "string (e.g. claude-sonnet-4-6, llama3, mixtral-8x7b)",
  "base_url": "string | null (required for Ollama, e.g. http://localhost:11434)"
}
```

### Input Schema — Fetch Query
```json
{
  "connection_name": "string",
  "llm_connection_name": "string",
  "product_name": "string",
  "project_key": "string (e.g. VWOAPP)",
  "jira_ids": ["string"] ,
  "sprint_version": "string | null",
  "additional_context": "string | null"
}
```
Note: `jira_ids` allows fetching specific story IDs (e.g. ["VWOAPP-123", "VWOAPP-124"]).
If empty, all open issues for `project_key` are fetched.

### Core Data Object — Jira Issue
```json
{
  "id": "string",
  "key": "string (e.g. VWOAPP-123)",
  "summary": "string",
  "description": "string | null",
  "issue_type": "Story | Bug | Task | Epic",
  "status": "string",
  "acceptance_criteria": "string | null",
  "priority": "string | null"
}
```

### Output Schema — Test Plan Response
```json
{
  "metadata": {
    "jira_project": "string",
    "product_name": "string",
    "generated_at": "ISO8601 timestamp",
    "issues_count": "integer",
    "missing_info_flags": ["string"]
  },
  "test_plan_markdown": "string",
  "export_paths": {
    "markdown": ".tmp/test_plan_{project_key}_{timestamp}.md",
    "pdf": ".tmp/test_plan_{project_key}_{timestamp}.pdf"
  }
}
```

### History Record Schema
```json
{
  "id": "string (uuid)",
  "created_at": "ISO8601 timestamp",
  "project_key": "string",
  "product_name": "string",
  "issues_count": "integer",
  "markdown_path": "string",
  "pdf_path": "string"
}
```

---

## Behavioral Rules

### Rule 1 — Strict Template Mode
The LLM MUST generate test plans using exactly the sections defined in `test_plan_templates/test_plan.md`.
No sections may be added or removed. If data is missing, output `[NEEDS INFO: <description>]`.

### Rule 2 — Ask Before Assuming
Before generating, perform a pre-check on Jira issues:
- If `acceptance_criteria` is null or empty → flag as missing
- If `description` is null or < 50 characters → flag as insufficient
- Present flags to the user in Step 3 (Review) before they trigger generation
- User may add context in the "Additional Context & Notes" field to address flags

### Rule 3 — Deterministic Tools
All Python scripts in `tools/` must be deterministic and independently testable.
No LLM calls inside `jira_client.py` or `pdf_exporter.py`. Only `llm_client.py` calls the LLM.

### Rule 4 — Connections via UI (on-the-fly)
Both Jira and LLM connections are configured via the UI — no pre-configuration required.
Every connection form MUST include a **"Test Connection"** button that validates credentials before saving.
API tokens and secrets from `.env` are used as fallback defaults only.

### Rule 5 — .tmp/ is Ephemeral
All intermediate files and exported test plans go to `.tmp/`.
Cloud/permanent delivery is not in scope for v1 (local only).

### Rule 6 — Prompt Caching (Claude only)
When provider is `claude`, use `cache_control: {"type": "ephemeral"}` on the system prompt
and test plan template to reduce latency and cost on repeated generations.
Other providers do not support caching — skip silently.

### Rule 7 — Multi-LLM Provider Support
`llm_client.py` MUST support: `claude`, `groq`, `grok`, `ollama`.
Each provider has its own API format. A provider factory pattern routes to the correct implementation.
The LLM prompt logic (system prompt, user message) is identical across all providers.

---

## Architectural Invariants

1. The FastAPI backend is the only layer that calls `tools/`. React never calls Jira or LLM directly.
2. Both Jira and LLM connections are stored in-memory (app state) for v1. No database.
3. The test plan template is loaded once at startup and cached. It does not change at runtime.
4. The React frontend communicates with the backend exclusively via `/api/*` endpoints.
5. History is stored as a JSON file in `.tmp/history.json` for v1.
6. "Test Connection" endpoints exist for both Jira (`POST /api/connections/test`) and LLM (`POST /api/llm-connections/test`).
7. Data source type `ado` (Azure DevOps) is architected but returns `{"status": "coming_soon"}` in v1.

---

## Maintenance Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-12 | Initial constitution created | Project kickoff |
| 2026-04-12 | Added LLM connection schema, multi-provider rule, on-the-fly connection rule, ADO placeholder | User clarification: multi-LLM + test connection button |
