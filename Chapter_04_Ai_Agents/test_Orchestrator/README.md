# Test Orchestrator

An AI-powered QA automation tool that fetches Jira requirements and generates professional test plans and Zephyr Scale-compatible test cases using multiple LLM providers.

---

## Overview

Test Orchestrator is a full-stack web application with a React/TypeScript frontend and a Python FastAPI backend. It connects to Jira, pulls issue details, and uses an LLM (Falcon AI, Claude, Groq, Grok, or Ollama) to generate structured test plans and detailed test cases — ready for import into Zephyr Scale.

All generations are governed by **anti-hallucination rules** — the LLM only uses information explicitly provided in the Jira ticket. No invented behavior, no assumed defaults.

---

## Architecture

```
Layer 1: React Frontend (Port 5173)
         ↓  Axios HTTP
Layer 2: FastAPI Backend (Port 8000)
         ↓  Python function calls
Layer 3: Tools (Business Logic)
         ├─ jira_client.py           — Jira REST API v3
         ├─ llm_client.py            — Multi-provider LLM abstraction
         ├─ test_plan_generator.py
         ├─ test_case_generator.py
         ├─ html_to_markdown.py      — HTML → Markdown for edited downloads
         ├─ pdf_exporter.py
         └─ doc_exporter.py
         ↓
Runtime Data: .tmp/
         ├─ history.json
         ├─ jira_connections.json
         ├─ llm_connections.json
         ├─ *.md  (generated files)
         └─ *.docx (generated files)
```

---

## Features

### Test Planner

- Fetch Jira epics by ticket ID — child issues are automatically discovered and shown as expandable rows in the Review step
- Only the parent epic is sent to the LLM; all child issues are auto-injected into the **Deliverables** section of the generated plan
- Add testing notes and upload screenshots for richer context
- Generate a comprehensive test plan in markdown format
- **Read-only by default** — lock badge indicates view mode; click **✎ Edit** to modify
- Inline table editing: hover a table row to reveal **+** (insert row below) and **×** (delete row) buttons
- **Download .docx disabled while editing** — amber warning shown; re-enabled after clicking **✓ Done Editing**
- Full Jira ticket ID shown in the meta bar (e.g., `MIL-5941`, not just `MIL`)
- Green success banner on generation — stays visible until the user navigates away
- Download reflects any edits made before saving (HTML → Markdown → DOCX pipeline)
- File names include the Jira ticket reference (e.g., `test_plan_MIL-5941_2026-04-25.docx`)

### Test Case Creator

- Same Jira fetch flow with a dedicated test-case-focused prompt
- Mandatory **Dump Used** field — recorded as a column in every generated test case
- Upload screenshots for vision-based test case generation (Claude only)
- Output rendered as interactive tables — **read-only by default** with lock badge
- **Line-by-line cell display**: numbered list cells (e.g., Step, Test Data, Expected Result) are shown one line per entry for easy comparison
- **Line-by-line cell editor** (click **✎ Edit** then click any cell or specific line):
  - Each line in its own input — wraps to full width like read mode
  - New / changed lines highlighted in **green** during editing and **retained after saving**
  - Click any specific line to place cursor exactly at the clicked character
  - **Enter / Shift+Enter** — insert new numbered line below; Shift+Enter at start of line 1 inserts above
  - **Backspace** on empty line — deletes that line, focus moves up
  - **Ctrl+Z** — undo across typing, line insertions, and deletions
  - Line numbers auto-adjust on every add or remove
- **Export CSV disabled while editing** — amber warning shown; re-enabled after clicking **✓ Done Editing**
- Per-row checkboxes with select-all / section-select for choosing which test cases to export
- Export selected test cases as **Zephyr Scale CSV** (one row per step, ready to import)
  - Steps, Test Data, and Expected Results are each split per step row
  - Preconditions expanded to multi-line in CSV
- Full Jira ticket IDs shown as individual badges in the toolbar
- Green success banner on generation — stays visible until the user navigates away
- Selected LLM and Jira connection are remembered across page navigation

### Connections Manager

- Save, test, and delete Jira connections (URL + email + API token)
- Save, test, and delete LLM connections (provider + model + API key)
- Falcon AI: dynamic **Load Models** button fetches available models from the gateway
- Connections persist across sessions in `.tmp/` JSON files

### History

- View all past generations with timestamps
- Download any previous output as `.md` or `.docx`
- Delete a record — removes the history entry **and** the generated files from disk

---

## Supported LLM Providers

| Provider | Notes |
|----------|-------|
| ⭐ **Falcon AI (Planview)** | **Recommended.** Planview's internal LLM gateway at `https://falconai.planview-prod.io/api`. OpenAI-compatible API. Dynamic model loading via Load Models button. 300 s timeout with auto-retry on 504. |
| **Claude** (Anthropic) | Supports image/screenshot input. Uses prompt caching. `max_tokens: 8000` |
| **Groq** | Fast inference via Groq SDK |
| **Grok** | xAI API (raw HTTP) |
| **Ollama** | Local models via Ollama server |

Default models are pre-configured per provider and can be overridden when saving a connection.

---

## Anti-Hallucination Rules

Every generation (test plan and test cases) is prefixed with strict verification rules from `anti_haluination_rules/anti_hallucination.md`:

- The LLM may **only** use information explicitly present in the Jira ticket (description, acceptance criteria, comments, subtasks, screenshots)
- It must **never** invent features, APIs, UI elements, or behaviors
- Missing information is flagged as `Not Specified` — never assumed
- All assertions must be traceable to the provided input

---

## Project Structure

```
Chapter_04_Ai_Agents/
├── anti_haluination_rules/
│   └── anti_hallucination.md        # Loaded at runtime — governs all LLM generations
├── test_plan_templates/
│   └── test_plan.md                 # Loaded at runtime — defines test plan structure
└── test_Orchestrator/
    ├── backend/
    │   └── main.py                  # FastAPI app, all routes and Pydantic models
    ├── frontend/
    │   ├── src/
    │   │   ├── components/
    │   │   │   ├── TestCaseCreator.tsx   # Full test case wizard (3 steps) + LineEditor
    │   │   │   ├── TestPlan.tsx          # Test plan viewer + inline table editor
    │   │   │   ├── Review.tsx            # Epic/child hierarchy review step
    │   │   │   ├── FetchIssues.tsx       # Issue fetch step
    │   │   │   ├── ConnectionsPage.tsx   # Manage Jira & LLM connections
    │   │   │   └── History.tsx           # Past generation history
    │   │   ├── App.tsx                   # Main shell, routing, theme toggle
    │   │   ├── api.ts                    # All Axios API calls
    │   │   └── App.css                   # Global styles
    │   ├── package.json
    │   └── vite.config.ts               # Dev server + proxy to port 8000 (timeout: 5 min)
    ├── tools/
    │   ├── jira_client.py           # Jira REST API v3 — epics + child discovery
    │   ├── llm_client.py            # Multi-provider LLM abstraction
    │   ├── test_plan_generator.py   # Test plan pipeline + child Deliverables injection
    │   ├── test_case_generator.py   # Test case pipeline + description truncation
    │   ├── html_to_markdown.py      # Converts edited HTML back to Markdown for DOCX
    │   ├── pdf_exporter.py          # Markdown → .md export
    │   └── doc_exporter.py          # Markdown → .docx export (styled tables + headers)
    ├── .tmp/                        # Runtime data (auto-created)
    ├── requirements.txt
    ├── start.bat                    # One-click Windows startup
    └── .env.template                # Environment variable reference
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Jira account with API token ([generate here](https://id.atlassian.com/manage-profile/security/api-tokens))
- Planview Falcon AI API key (or any other supported LLM provider key)

### 1. Clone & install backend dependencies

```bash
cd test_Orchestrator
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the application

**Option A — Windows one-click:**
```
start.bat
```

**Option B — Manual:**
```bash
# Terminal 1 — Backend
cd "C:\Users\SmrutiranjanMaharana\AI_Engineering\Chapter_04_Ai_Agents\test_Orchestrator"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Usage

### First-time setup

1. Click **Connections** in the sidebar
2. Add a **Jira connection** (URL, email, API token) and click **Test Connection**
3. Add an **LLM connection**:
   - Select provider **Falcon AI (Planview)**
   - Enter your Planview API key
   - Click **Load Models** to fetch available models
   - Select a model and click **Test Connection**
4. Save both connections — they will be remembered for future sessions

### Generate a Test Plan

1. Go to **Test Planner**
2. **Step 1 — Fetch Issues:** Select your Jira and LLM connections, enter the product name and Epic ticket ID(s)
3. **Step 2 — Review:** Inspect the fetched epic(s) — click **▼ N items** to expand child issues. Add testing notes or screenshots if needed
4. **Step 3 — Test Plan:** View the generated plan (read-only). Click **✎ Edit** to modify inline. Click **✓ Done Editing** to save, then **⬇ Download .docx**

### Generate Test Cases

1. Go to **Test Case Creator**
2. **Step 1 — Fetch Issues:** Select connections and enter Jira IDs; enter the mandatory **Dump Used** field
3. **Step 2 — Review:** Review issues, add context or screenshots
4. **Step 3 — Test Cases:** View tables (read-only). Click **✎ Edit** to modify cells line-by-line. Click **✓ Done Editing** to save, then select rows and **⬇ Export CSV**

### Editing Test Cases (Line Editor)

When in edit mode, clicking any cell opens a line-by-line editor:
- **Click a specific line** — cursor placed at exact click position
- **Enter / Shift+Enter** — new numbered line inserted below current line
- **Shift+Enter at position 0 of line 1** — new line inserted before line 1
- **Backspace on an empty line** — removes that line
- **Ctrl+Z** — undo (works across structural changes too)
- **Tab / Esc** — save and close editor
- New and changed lines are shown in **green** both during editing and in the read-only view after saving

### Importing CSV into Zephyr Scale

The exported CSV is formatted for direct Zephyr Scale import:
- One row per test step
- Steps, Test Data, and Expected Results are each split into individual rows (aligned per step)
- Columns match Zephyr Scale field names exactly
- Test Case ID is only populated on the first step row per test case

---

## API Reference

### Jira Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections` | List all saved Jira connections |
| POST | `/api/connections` | Save a new Jira connection |
| POST | `/api/connections/test` | Test a Jira connection |
| DELETE | `/api/connections/{name}` | Delete a Jira connection |

### LLM Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/llm-connections` | List all saved LLM connections |
| POST | `/api/llm-connections` | Save a new LLM connection |
| POST | `/api/llm-connections/test` | Test an LLM connection |
| DELETE | `/api/llm-connections/{name}` | Delete an LLM connection |
| POST | `/api/llm-connections/falcon-models` | Fetch available models from Falcon AI gateway |

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/issues/fetch` | Fetch Jira issues by IDs (returns epics + children map) |

### Test Plan

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test-plan/generate` | Generate a test plan |
| GET | `/api/test-plan/export/markdown` | Download latest test plan `.md` |
| GET | `/api/test-plan/export/doc` | Download latest test plan `.docx` |
| POST | `/api/test-plan/export/doc-from-html` | Convert edited HTML to `.docx` |

### Test Cases

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test-cases/generate` | Generate test cases |
| GET | `/api/test-cases/download` | Download a generated test case file by path |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/history` | List all generation records |
| GET | `/api/history/{id}/download/markdown` | Download historical `.md` |
| GET | `/api/history/{id}/download/doc` | Download historical `.docx` |
| DELETE | `/api/history/{id}` | Delete record and associated files |

---

## Test Case Output Format

Test cases are generated as Zephyr Scale-compatible markdown tables with the following exact columns:

| Column | Description |
|--------|-------------|
| Test Case ID | Format: `TC_[ISSUE_KEY]_001` (e.g., `TC_SCI-123_001`) |
| Name | One-line title — always starts with "Verify..." |
| Objective | Brief test goal — does NOT start with "Verify" |
| Precondition | Numbered format: `1. condition / 2. condition` |
| Test Script (Step-by-Step) - Step | Numbered steps separated by ` / ` |
| Test Script (Step-by-Step) - Test Data | Input values per step, separated by ` / ` |
| Test Script (Step-by-Step) - Expected Result | Verifiable outcome per step, separated by ` / ` |
| Test Type | `Positive` / `Negative` / `Edge Case` / `Boundary` |
| Priority | `High` / `Medium` / `Low` |
| Dump Used | DB dump / build reference entered by tester |

---

## Jira Fields Fetched

For each issue, the following fields are extracted:

- `key` — Ticket ID (e.g., MIL-5941)
- `summary` — Issue title
- `description` — Full ADF text extracted to plain text
- `issue_type` — Epic / Story / Bug / Task etc.
- `status` — Current workflow status
- `priority` — Priority level
- `component` — Jira component(s) assigned to the issue
- `parent_key` — Parent epic key (for child issues)

Child issues under an epic are automatically fetched using 6 discovery strategies (subtasks, epic link, parent field, issue search, Sprint, and fix version).

---

## Templates

### Test Plan Template
**Location:** `test_plan_templates/test_plan.md`

Covers 20 testing areas: Functional, Data Validation, Error Handling, Performance, Security, Integration, Compatibility, Load, Regression, Edge Cases, Concurrency, Usability, CI/CD, Backup/Recovery, Internationalization, Rate Limiting, and more.

### Anti-Hallucination Rules
**Location:** `../anti_haluination_rules/anti_hallucination.md`

Enforces strict source-only reasoning. Prepended to every system prompt for both test plan and test case generation.

---

## Notes

- The `.tmp/` directory is created automatically on first run. It contains all connections, history, and generated files — **do not delete it** while the app is running.
- When a history record is deleted, the associated `.md` and `.docx` files are also permanently removed.
- Claude is the only provider that supports screenshot/image input for vision-based test case generation.
- Project key is auto-derived from Jira IDs — no manual entry required (e.g., `MIL-5941` → project key `MIL`).
- The Vite dev proxy has a 5-minute timeout to accommodate long Falcon AI generation calls.
- Falcon AI descriptions longer than 3000 characters are automatically truncated with a note to avoid gateway timeouts.
- Your last selected LLM and Jira connection are saved in `localStorage` and restored automatically on next visit.
- Generated `.docx` files include styled tables with header shading, proper column widths, and bold headings.
