# Test Orchestrator

An AI-powered QA automation tool that fetches Jira requirements and generates professional test plans and Zephyr Scale-compatible test cases using multiple LLM providers.

---

## Overview

Test Orchestrator is a full-stack web application with a React/TypeScript frontend and a Python FastAPI backend. It connects to Jira, pulls issue details, and uses an LLM (Claude, Groq, Grok, Ollama, or Falcon) to generate structured test plans and detailed test cases — ready for import into Zephyr Scale.

---

## Architecture

```
Layer 1: React Frontend (Port 5173)
         ↓  Axios HTTP
Layer 2: FastAPI Backend (Port 8000)
         ↓  Python function calls
Layer 3: Tools (Business Logic)
         ├─ jira_client.py       — Jira REST API v3
         ├─ llm_client.py        — Multi-provider LLM abstraction
         ├─ test_plan_generator.py
         ├─ test_case_generator.py
         ├─ pdf_exporter.py
         └─ doc_exporter.py
         ↓
Persistent Storage: .tmp/
         ├─ history.json
         ├─ jira_connections.json
         ├─ llm_connections.json
         ├─ *.md  (generated files)
         └─ *.docx (generated files)
```

---

## Features

### Test Planner
- Fetch Jira issues by specific ticket IDs (e.g., `SCI-123, SCI-124`)
- Project key is auto-detected from the first Jira ID
- Review fetched issues with quality warnings (short/missing descriptions)
- Add testing notes and upload screenshots for richer context
- Generate a comprehensive test plan in markdown format
- Export as `.md` or `.docx`

### Test Case Creator
- Same Jira fetch flow with a dedicated test-case-focused prompt
- Mandatory **Dump Used** field — recorded as a column in every generated test case
- Upload screenshots for vision-based test case generation (Claude only)
- Output rendered as interactive markdown tables
- Per-row checkboxes with select-all for choosing which test cases to export
- Export selected test cases as **Zephyr Scale CSV** (one row per step, ready to import)
- Export full output as `.md`
- File names include the Jira ticket numbers (e.g., `test_cases_SCI-123_SCI-124.csv`)

### Connections Manager
- Save, test, and delete Jira connections (URL + email + API token)
- Save, test, and delete LLM connections (provider + model + API key)
- Connections persist across sessions in `.tmp/` JSON files

### History
- View all past generations with timestamps
- Download any previous output as `.md` or `.docx`
- Delete a record — removes the history entry **and** the generated files from disk

---

## Supported LLM Providers

| Provider | Notes |
|----------|-------|
| **Claude** (Anthropic) | Recommended. Supports image/screenshot input. Uses prompt caching for efficiency. `max_tokens: 16000` |
| **Groq** | Fast inference via Groq SDK |
| **Grok** | xAI API (raw HTTP) |
| **Ollama** | Local models via Ollama server |
| **Falcon** | Falcon AI API (raw HTTP) |

Default models are pre-configured per provider and can be overridden when saving a connection.

---

## Project Structure

```
test_Orchestrator/
├── backend/
│   └── main.py                  # FastAPI app, all routes and Pydantic models
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FetchIssues.tsx      # Step 1: Fetch issues from Jira
│   │   │   ├── Review.tsx           # Step 2: Review issues + context + screenshots
│   │   │   ├── TestPlan.tsx         # Step 3: Display & export test plan
│   │   │   ├── TestCaseCreator.tsx  # Full test case wizard (3 steps)
│   │   │   ├── History.tsx          # Past generation history
│   │   │   └── ConnectionsPage.tsx  # Manage Jira & LLM connections
│   │   ├── App.tsx                  # Main shell, routing, theme toggle
│   │   ├── api.ts                   # All Axios API calls
│   │   └── App.css                  # Global styles
│   ├── package.json
│   └── vite.config.ts               # Dev server + proxy to port 8000
├── tools/
│   ├── jira_client.py           # Jira REST API v3 client
│   ├── llm_client.py            # Multi-provider LLM abstraction
│   ├── test_plan_generator.py   # Test plan generation pipeline
│   ├── test_case_generator.py   # Test case generation pipeline
│   ├── pdf_exporter.py          # Markdown → .md / PDF export
│   └── doc_exporter.py          # Markdown → .docx export
├── test_plan_templates/
│   └── test_plan.md             # System prompt template for test plans
├── .tmp/                        # Runtime data (auto-created, gitignore this)
├── requirements.txt
├── start.bat                    # One-click Windows startup
└── .env.template                # Environment variable reference
```

> The test case template lives one level up:
> `Chapter_04_Ai_Agents/test_case_templates/test_case_format.md`

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Jira account with API token ([generate here](https://id.atlassian.com/manage-profile/security/api-tokens))
- At least one LLM provider API key

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

### 3. Configure environment (optional)

Copy `.env.template` to `.env` and fill in your keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
GROK_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434
APP_HOST=localhost
APP_PORT=8000
```

API keys can also be entered directly in the UI when saving an LLM connection.

### 4. Start the application

**Option A — Windows one-click:**
```
start.bat
```

**Option B — Manual:**
```bash
# Terminal 1 — Backend
cd backend
uvicorn main:app --reload --port 8000

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
3. Add an **LLM connection** (select provider, enter API key and model) and click **Test**
4. Save both connections

### Generate a Test Plan

1. Go to **Test Planner**
2. **Step 1 — Fetch Issues:** Select your Jira and LLM connections, enter the product name and Jira ticket IDs (comma-separated)
3. **Step 2 — Review:** Inspect the fetched issues, add testing notes or screenshots if needed
4. **Step 3 — Generate:** View the generated test plan and download as `.md` or `.docx`

### Generate Test Cases

1. Go to **Test Case Creator**
2. **Step 1 — Fetch Issues:** Same as above; also enter the mandatory **Dump Used** field (e.g., the build or DB snapshot used)
3. **Step 2 — Review:** Review issues, add context or screenshots
4. **Step 3 — Generate:** View tables, select rows with checkboxes, export as **Zephyr Scale CSV** or `.md`

### Importing CSV into Zephyr Scale

The exported CSV is formatted for direct Zephyr Scale import:
- One row per test step
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

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/issues/fetch` | Fetch Jira issues by IDs |

### Test Plan

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test-plan/generate` | Generate a test plan |
| GET | `/api/test-plan/export/markdown` | Download latest test plan `.md` |
| GET | `/api/test-plan/export/doc` | Download latest test plan `.docx` |

### Test Cases

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/test-cases/generate` | Generate test cases |
| GET | `/api/test-cases/export/markdown` | Download latest test cases `.md` |
| GET | `/api/test-cases/export/doc` | Download latest test cases `.docx` |

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
| Precondition | System/data state required before execution |
| Test Script (Step-by-Step) - Step | Numbered steps separated by ` / ` |
| Test Script (Step-by-Step) - Test Data | Input values or data sets |
| Test Script (Step-by-Step) - Expected Result | Verifiable outcome |
| Test Type | `Positive` / `Negative` / `Edge Case` / `Boundary` |
| Priority | `High` / `Medium` / `Low` |
| Dump Used | DB dump / build reference entered by tester |

---

## Jira Fields Fetched

For each issue, the following fields are extracted:

- `key` — Ticket ID (e.g., SCI-123)
- `summary` — Issue title
- `description` — Full ADF text extracted to plain text
- `issue_type` — Story / Bug / Task etc.
- `status` — Current workflow status
- `priority` — Priority level
- `component` — Jira component(s) assigned to the issue

---

## Templates

### Test Plan Template
**Location:** `test_plan_templates/test_plan.md`

Covers 20 testing areas: Functional, Data Validation, Error Handling, Performance, Security, Integration, Compatibility, Load, Regression, Edge Cases, Concurrency, Usability, CI/CD, Backup/Recovery, Internationalization, Rate Limiting, and more.

### Test Case Template
**Location:** `../test_case_templates/test_case_format.md`

Defines the Senior QA Engineer role, Zephyr Scale output format, field definitions, constraints (positive + negative + edge cases, no duplication, only Jira sources), and a pre-generation checklist.

---

## Notes

- The `.tmp/` directory is created automatically on first run. It contains all connections, history, and generated files — **do not delete it** while the app is running.
- When a history record is deleted, the associated `.md` and `.docx` files are also permanently removed.
- Claude is the only provider that supports screenshot/image input for vision-based test case generation.
- Project key is auto-derived from Jira IDs — no manual entry required (e.g., `SCI-123` → project key `SCI`).
