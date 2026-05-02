# TestingBuddy AI

An AI-powered QA automation tool that fetches Jira requirements and generates professional **test plans** and **Zephyr Scale-compatible test cases** using multiple LLM providers.

---

## Overview

TestingBuddy AI is a full-stack web application with a **React / TypeScript** frontend and a **Python FastAPI** backend. It connects to Jira, pulls issue details, and uses an LLM (Falcon AI, Claude, Groq, Grok, or Ollama) to generate structured test plans and detailed test cases — ready for import into Zephyr Scale.

All generations are governed by **anti-hallucination rules** — the LLM only uses information explicitly provided in the Jira ticket. No invented behavior, no assumed defaults.

---

## Architecture

```
┌─────────────────────────────────────┐
│  React Frontend        Port 5173    │
│  (Vite + TypeScript)                │
└────────────────┬────────────────────┘
                 │ Axios HTTP
┌────────────────▼────────────────────┐
│  FastAPI Backend       Port 8000    │
│  backend/main.py                    │
└────────────────┬────────────────────┘
                 │ Python calls
┌────────────────▼────────────────────┐
│  Tools Layer   (tools/)             │
│  ├── jira_client.py                 │
│  ├── llm_client.py                  │
│  ├── test_plan_generator.py         │
│  ├── test_case_generator.py         │
│  ├── doc_exporter.py                │
│  ├── html_to_markdown.py            │
│  └── pdf_exporter.py                │
└─────────────────────────────────────┘
```

---

## Project Structure

```
TestingBuddy_AI/
├── backend/
│   └── main.py                    # FastAPI app — all routes and Pydantic models
├── frontend/
│   ├── public/
│   │   └── bg.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── TestCaseCreator.tsx # 3-step test case wizard with line editor
│   │   │   ├── TestPlan.tsx        # Test plan viewer with inline table editor
│   │   │   ├── Review.tsx          # Epic / child issue review step
│   │   │   ├── FetchIssues.tsx     # Jira issue fetch step
│   │   │   ├── ConnectionsPage.tsx # Manage Jira & LLM connections
│   │   │   └── History.tsx         # Past generation history
│   │   ├── App.tsx                 # Shell, routing, theme switcher
│   │   ├── App.css                 # Global styles + theme variables
│   │   ├── api.ts                  # Axios API client
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts             # Dev server + proxy to port 8000 (5 min timeout)
├── tools/
│   ├── jira_client.py             # Jira REST API v3 — epics + child discovery
│   ├── llm_client.py              # Multi-provider LLM abstraction
│   ├── test_plan_generator.py     # Test plan pipeline
│   ├── test_case_generator.py     # Test case pipeline
│   ├── doc_exporter.py            # Markdown → .docx (styled tables + headers)
│   ├── html_to_markdown.py        # Edited HTML → Markdown → DOCX pipeline
│   └── pdf_exporter.py            # Markdown → .md export
├── templates/
│   ├── test_plan.md               # Loaded at runtime — defines test plan structure
│   └── test_cases_template.md     # Loaded at runtime — defines test case columns
├── rules/
│   └── anti_hallucination.md      # Prepended to every LLM system prompt
├── .tmp/                          # Runtime data — auto-created (gitignored)
│   ├── jira_connections.json
│   ├── llm_connections.json
│   ├── history.json
│   └── *.md / *.docx              # Generated outputs
├── .gitignore
├── requirements.txt
└── start.bat                      # Windows one-click startup
```

---

## Features

### Test Planner
- Fetch Jira epics by ticket ID — child issues auto-discovered and shown as expandable rows
- Add testing notes and upload screenshots for richer context
- Generate a comprehensive markdown test plan
- Inline table editing — read-only by default; click **✎ Edit** to modify
- Download as **`.docx`** with styled tables, headers, and proper column widths
- File names include Jira ticket reference (e.g. `test_plan_MIL-5941_2026-04-25.docx`)

### Test Case Generator
- Same Jira fetch flow with a test-case-focused prompt
- Mandatory **Dump Used** field — recorded as a column in every generated test case
- Upload screenshots for vision-based generation (Claude only)
- Output as interactive tables — read-only by default with lock badge
- **Line-by-line cell editor**: each step/precondition/result displayed and edited per line
  - Enter — insert new numbered line below
  - Backspace on empty line — delete line
  - Ctrl+Z — full undo across typing and structural changes
  - New/changed lines highlighted in **green** during editing and after save
- **Drag-resize columns** — hover column header edge and drag
- **Delete selected rows** — in edit mode, select rows and use 🗑️ Delete
- Export selected test cases as **Zephyr Scale CSV** (one row per step, import-ready)
- Per-row and section-level checkboxes for targeted export

### Connections Manager
- Save, test, and delete Jira connections (URL + email + API token)
- Save, test, and delete LLM connections (provider + model + API key)
- Falcon AI: **Load Models** fetches available models dynamically from the gateway
- Connections persist across sessions via `.tmp/` JSON files

### History
- View all past generations with timestamps
- Download any previous output as `.md` or `.docx`
- Delete a record — removes history entry and generated files from disk

### Themes
Five built-in themes: Dark · Light · Ocean · Forest · Sunset

---

## Supported LLM Providers

| Provider | Notes |
|---|---|
| **Falcon AI (Planview)** | Planview's internal LLM gateway. OpenAI-compatible. Dynamic model loading. 300 s timeout with auto-retry. |
| **Claude** (Anthropic) | Supports screenshot/image input for vision-based generation. |
| **Groq** | Fast inference via Groq SDK. |
| **Grok** | xAI API. |
| **Ollama** | Local models via Ollama server. |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.10+ |
| Node.js | 18+ |
| Jira account | API token required ([generate here](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| LLM API key | Falcon AI / Anthropic / Groq / xAI / Ollama |

---

## Setup & Installation

### 1. Install backend dependencies

```bash
cd TestingBuddy_AI
pip install -r requirements.txt
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Start the application

**Windows — one click:**
```
start.bat
```

**Manual (any OS):**
```bash
# Terminal 1 — Backend
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## First-Time Configuration

1. Click **Connections** in the sidebar
2. Add a **Jira connection** — enter URL, email, and API token → click **Test Connection**
3. Add an **LLM connection** — select provider, enter API key → click **Load Models** (Falcon AI) → select model → click **Test Connection**
4. Save both — they persist across sessions automatically

---

## Usage

### Generate a Test Plan

1. **Test Planner → Step 1:** Select connections, enter product name and Epic Jira ID(s)
2. **Step 2 — Review:** Expand epics to see child issues; add notes or screenshots
3. **Step 3 — Test Plan:** Read-only view. Click **✎ Edit** to modify inline, **✓ Done Editing** to save, then **⬇ Download .docx**

### Generate Test Cases

1. **Test Case Generator → Step 1:** Select connections, enter Jira IDs and **Dump Used**
2. **Step 2 — Review:** Review issues; add context or screenshots
3. **Step 3 — Test Cases:** Read-only table view. Click **✎ Edit** → click any cell to edit line-by-line. Click **✓ Done Editing**, select rows, then **📤 Export CSV**

### Importing CSV into Zephyr Scale

The exported CSV is formatted for direct Zephyr Scale import:
- One row per test step
- Steps, Test Data, and Expected Results split into individual rows (aligned per step)
- Column names match Zephyr Scale field names exactly
- Test Case ID only populated on the first step row per test case

---

## Test Case Output Format

| Column | Description |
|---|---|
| Test Case ID | `TC_[ISSUE_KEY]_001` (e.g. `TC_MIL-6077_001`) |
| Name | One-line title — starts with "Verify…" |
| Objective | Brief goal — does not start with "Verify" |
| Precondition | Numbered: `1. condition / 2. condition` |
| Test Script - Step | Numbered steps separated by ` / ` |
| Test Script - Test Data | Input values per step, separated by ` / ` |
| Test Script - Expected Result | Verifiable outcome per step, separated by ` / ` |
| Test Type | `Positive` / `Negative` / `Edge Case` / `Boundary` |
| Priority | `High` / `Medium` / `Low` |
| Dump Used | DB dump / build reference entered by the tester |
| Coverage (Issues) | Jira ID(s) covered by this test case |

---

## API Reference

### Jira Connections
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/connections` | List saved Jira connections |
| POST | `/api/connections` | Save a new connection |
| POST | `/api/connections/test` | Test a connection |
| DELETE | `/api/connections/{name}` | Delete a connection |

### LLM Connections
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/llm-connections` | List saved LLM connections |
| POST | `/api/llm-connections` | Save a new connection |
| POST | `/api/llm-connections/test` | Test a connection |
| DELETE | `/api/llm-connections/{name}` | Delete a connection |
| POST | `/api/llm-connections/falcon-models` | Fetch available Falcon AI models |

### Issues
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/issues/fetch` | Fetch Jira issues by IDs |

### Test Plan
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/test-plan/generate` | Generate a test plan |
| GET | `/api/test-plan/export/markdown` | Download latest `.md` |
| GET | `/api/test-plan/export/doc` | Download latest `.docx` |
| POST | `/api/test-plan/export/doc-from-html` | Convert edited HTML to `.docx` |

### Test Cases
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/test-cases/generate` | Generate test cases |
| GET | `/api/test-cases/download` | Download a generated file by path |

### History
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/history` | List all generation records |
| GET | `/api/history/{id}/download/markdown` | Download historical `.md` |
| GET | `/api/history/{id}/download/doc` | Download historical `.docx` |
| DELETE | `/api/history/{id}` | Delete record and associated files |

Full interactive docs at **http://localhost:8000/docs** when the backend is running.

---

## Anti-Hallucination Rules

Every generation is prefixed with strict rules from `rules/anti_hallucination.md`:

- The LLM may **only** use information explicitly present in the Jira ticket
- It must **never** invent features, APIs, UI elements, or behaviors not mentioned in the ticket
- Missing information is flagged as `Not Specified` — never assumed
- All assertions must be traceable to the provided input

---

## Notes

- The `.tmp/` directory is created automatically on first run. It stores all connections, history, and generated files — do not delete it while the app is running.
- Claude is the only provider that supports screenshot/image input.
- The Vite dev proxy has a 5-minute timeout to accommodate long LLM generation calls.
- Falcon AI descriptions longer than 3000 characters are automatically truncated to avoid gateway timeouts.
- Your last selected connections are saved in `localStorage` and restored automatically.

---

## License

Internal tool — Planview Engineering.
