# Test Planner Agent — Technical Documentation

**Version:** 1.0  
**Date:** April 2026  
**Author:** Smrutiranjan Maharana  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Motivation](#2-problem-statement--motivation)
3. [System Overview](#3-system-overview)
4. [Architecture](#4-architecture)
   - 4.1 [High-Level Architecture Diagram](#41-high-level-architecture-diagram)
   - 4.2 [Layer Breakdown](#42-layer-breakdown)
5. [Tech Stack](#5-tech-stack)
6. [Component Deep-Dive](#6-component-deep-dive)
   - 6.1 [Backend — FastAPI Server](#61-backend--fastapi-server)
   - 6.2 [Jira Client Tool](#62-jira-client-tool)
   - 6.3 [LLM Client Tool](#63-llm-client-tool)
   - 6.4 [Test Plan Generator (Orchestrator)](#64-test-plan-generator-orchestrator)
   - 6.5 [Export Pipeline](#65-export-pipeline)
   - 6.6 [Frontend — React Application](#66-frontend--react-application)
7. [End-to-End Data Flow](#7-end-to-end-data-flow)
8. [API Reference](#8-api-reference)
9. [LLM Integration & Prompt Design](#9-llm-integration--prompt-design)
10. [Test Plan Template](#10-test-plan-template)
11. [Constitutional Rules (Agent Design Principles)](#11-constitutional-rules-agent-design-principles)
12. [File & Directory Structure](#12-file--directory-structure)
13. [Data Storage](#13-data-storage)
14. [Setup & Installation Guide](#14-setup--installation-guide)
15. [Running the Application](#15-running-the-application)
16. [Known Limitations & Future Roadmap](#16-known-limitations--future-roadmap)

---

## 1. Executive Summary

The **Test Planner Agent** is a full-stack, AI-powered web application that automates the generation of comprehensive software test plans from Jira requirements. Instead of manually translating user stories and acceptance criteria into structured test plans — a tedious and time-consuming process — this agent does it automatically in seconds.

A user connects the tool to their Jira project, selects the relevant issues, picks an LLM provider (Claude, GROQ, Grok, or local Ollama), and the system fetches, processes, and generates a professionally structured test plan document. The output is available for download in Markdown, Microsoft Word (.docx), and PDF formats.

**Key benefits:**

- Reduces test planning effort from hours to minutes
- Enforces consistent test plan structure via a strict template
- Flags issues with missing acceptance criteria before generation
- Supports multiple LLM providers (cloud and local)
- Fully exportable documents for sharing

---

## 2. Problem Statement & Motivation

Software QA teams spend a significant portion of their sprint cycle manually creating test plans. This process involves:

1. Reading each Jira story and its acceptance criteria
2. Identifying test scenarios for each requirement
3. Structuring them into a standardized test plan document
4. Reviewing and exporting the document for stakeholder review

This is repetitive, inconsistent across team members, and prone to gaps when requirements are poorly defined. The Test Planner Agent solves this by:

- **Automating** the extraction of requirements from Jira
- **Flagging** incomplete requirements (missing acceptance criteria, vague descriptions) before any AI processing
- **Generating** a consistent, template-driven test plan using an LLM
- **Exporting** the result in ready-to-share document formats

---

## 3. System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Planner Agent                       │
│                                                             │
│   ┌─────────────┐    ┌─────────────┐    ┌───────────────┐  │
│   │   Jira      │    │  FastAPI    │    │  React/Vite   │  │
│   │   Cloud     │◄──►│   Backend  │◄──►│   Frontend    │  │
│   │   REST API  │    │  :8000      │    │   :5173       │  │
│   └─────────────┘    └──────┬──────┘    └───────────────┘  │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │  Python Tools   │                      │
│                    │                 │                      │
│                    │ • jira_client   │                      │
│                    │ • llm_client    │                      │
│                    │ • test_plan_gen │                      │
│                    │ • pdf_exporter  │                      │
│                    │ • doc_exporter  │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│              ┌──────────────┼──────────────┐               │
│              │              │              │                │
│         ┌────▼───┐   ┌──────▼─────┐  ┌────▼────┐          │
│         │ Claude │   │  GROQ/Grok │  │ Ollama  │          │
│         │ (Ant.) │   │  (Cloud)   │  │ (Local) │          │
│         └────────┘   └────────────┘  └─────────┘          │
└─────────────────────────────────────────────────────────────┘
```

The agent acts as a **bridge** between your project management tool (Jira) and a large language model, orchestrating the flow: fetch → validate → generate → export.

---

## 4. Architecture

### 4.1 High-Level Architecture Diagram

```
USER BROWSER
     │
     │  HTTP (port 5173 in dev, proxied to /api)
     ▼
┌──────────────────────────────────────┐
│         React + TypeScript           │
│         (Vite Dev Server)            │
│                                      │
│   [Setup] → [Fetch] → [Review] →    │
│             [Test Plan]              │
└──────────────┬───────────────────────┘
               │  axios /api/* calls
               ▼
┌──────────────────────────────────────┐
│         FastAPI Backend              │
│         (Uvicorn :8000)              │
│                                      │
│   Routes:                            │
│   POST /api/connections              │
│   POST /api/issues/fetch             │
│   POST /api/test-plan/generate       │
│   GET  /api/test-plan/export/...     │
│   GET  /api/history                  │
└──────────┬───────────────────────────┘
           │  Python function calls
           ▼
┌──────────────────────────────────────┐
│         Tools Layer (Pure Python)    │
│                                      │
│  jira_client.py                      │
│  llm_client.py                       │
│  test_plan_generator.py              │
│  pdf_exporter.py                     │
│  doc_exporter.py                     │
└────────┬────────────────┬────────────┘
         │                │
         ▼                ▼
┌────────────────┐  ┌─────────────────┐
│   Jira REST    │  │  LLM Providers  │
│   API v3       │  │                 │
│                │  │  • Anthropic    │
│  /rest/api/3/  │  │    (Claude)     │
│   search       │  │  • GROQ         │
│   issue/{key}  │  │  • Grok (xAI)  │
│   myself       │  │  • Ollama       │
└────────────────┘  └─────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│   .tmp/ (Local File Storage)       │
│                                    │
│   jira_connections.json            │
│   llm_connections.json             │
│   history.json                     │
│   test_plan_*.md                   │
│   test_plan_*.docx                 │
└────────────────────────────────────┘
```

### 4.2 Layer Breakdown

The system is organized into three distinct layers:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Presentation** | React 18 + TypeScript + Vite | 4-step wizard UI, state management, dark/light mode |
| **Application** | FastAPI + Python | REST API routing, connection persistence, request validation |
| **Tools** | Pure Python modules | Jira integration, LLM calls, document generation, export |

This separation ensures:
- **Testability**: Each tool can be tested independently
- **Extensibility**: New LLM providers or export formats can be added without touching other layers
- **Clarity**: Business logic lives exclusively in tools, not in routes or components

---

## 5. Tech Stack

### Backend

| Library | Version | Purpose |
|---------|---------|---------|
| **FastAPI** | 0.111.0+ | REST API framework with auto-generated Swagger docs |
| **Uvicorn** | 0.29.0+ | ASGI server to run FastAPI |
| **Pydantic** | 2.0.0+ | Request/response validation and type safety |
| **Requests** | 2.31.0+ | HTTP client for Jira and Grok API calls |
| **Anthropic SDK** | 0.25.0+ | Official Python client for Claude API |
| **GROQ SDK** | 0.9.0+ | Python client for GROQ LLM API |
| **python-docx** | latest | Microsoft Word (.docx) document generation |
| **fpdf2** | 2.7.9 | Pure Python PDF generation (fallback) |
| **weasyprint** | 61.0 | High-quality HTML → PDF (optional) |
| **Markdown** | 3.6 | Markdown → HTML conversion |
| **python-dotenv** | 1.0.0 | `.env` file loading |

### Frontend

| Library | Version | Purpose |
|---------|---------|---------|
| **React** | 18.3.1 | UI component framework |
| **TypeScript** | 5.2.2 | Type-safe JavaScript |
| **Vite** | 5.3.1 | Fast dev server and build tool |
| **Axios** | 1.7.2 | HTTP client for API calls |
| **react-markdown** | 9.0.1 | Render markdown content in browser |
| **remark-gfm** | 4.0.0 | GitHub-Flavored Markdown support |

### Runtime Environment

| Component | Requirement |
|-----------|------------|
| **Python** | 3.11+ |
| **Node.js** | 20+ LTS |
| **OS** | Windows 10+ (Linux/macOS with minor adjustments) |

---

## 6. Component Deep-Dive

### 6.1 Backend — FastAPI Server

**File:** `backend/main.py`

The FastAPI server acts as a **thin orchestration layer**. It:
- Defines all HTTP route handlers
- Validates incoming requests using Pydantic models
- Reads/writes connection configurations to `.tmp/*.json` files
- Delegates all business logic to the tools layer
- Caches the last generated test plan result in a module-level `_last_result` variable for export endpoints

**Pydantic Request Models:**

```python
class JiraConnectionRequest(BaseModel):
    name: str
    url: str          # e.g., https://mycompany.atlassian.net
    email: str
    api_token: str
    source_type: str  # "jira_cloud"

class LLMConnectionRequest(BaseModel):
    name: str
    provider: str     # "claude" | "groq" | "grok" | "ollama"
    api_key: str
    model: str
    base_url: str     # Used for Ollama

class FetchIssuesRequest(BaseModel):
    connection_name: str
    product_name: str
    project_key: str
    jira_ids: list[str]       # Optional: specific issue keys
    sprint_version: str       # Optional: filter by sprint
    additional_context: str   # Optional: user-provided notes

class GenerateRequest(BaseModel):
    llm_connection_name: str
    issues: list[dict]        # Fetched Jira issues
    product_name: str
    project_key: str
    additional_context: str
```

**Connection Persistence:**

Connections are stored as JSON files in `.tmp/`:
```json
// .tmp/jira_connections.json
[
  {
    "name": "My Jira",
    "url": "https://company.atlassian.net",
    "email": "user@company.com",
    "api_token": "ATATT3xFf...",
    "source_type": "jira_cloud"
  }
]
```

---

### 6.2 Jira Client Tool

**File:** `tools/jira_client.py`

Handles all communication with the Jira Cloud REST API v3. Uses HTTP Basic Auth with Base64-encoded `email:api_token`.

**Key Functions:**

| Function | Description |
|----------|-------------|
| `test_connection(conn)` | Calls `GET /rest/api/3/myself` to validate credentials |
| `get_issues(conn, project_key, jira_ids, sprint)` | Fetches open issues using JQL query |
| `get_issue_by_id(conn, issue_key)` | Fetches a single issue by key (e.g., `SCI-42`) |
| `get_issues_by_ids(conn, ids)` | Batch-fetches multiple issues |
| `_extract_adf_text(node)` | Recursively parses Atlassian Document Format (ADF) to plain text |
| `_parse_issue(issue)` | Normalizes the raw Jira API response to a clean schema |

**JQL Query Used:**
```
project="<KEY>" AND statusCategory!=Done ORDER BY created DESC
```

**ADF Parsing:**

Jira uses Atlassian Document Format (ADF) — a nested JSON structure — for rich text fields. The `_extract_adf_text()` function recursively traverses the ADF tree to extract plain text, handling nodes of type:
- `paragraph`, `heading`, `bulletList`, `orderedList`
- `listItem`, `text`, `hardBreak`, `codeBlock`
- `blockquote`, `table`, `tableRow`, `tableCell`

**Normalized Issue Schema:**
```python
{
    "key": "SCI-42",
    "summary": "User can reset their password",
    "description": "As a user, I want to...",
    "acceptance_criteria": "Given... When... Then...",
    "issue_type": "Story",
    "status": "In Progress",
    "priority": "High"
}
```

**Custom Field for Acceptance Criteria:**

Acceptance criteria in Jira is stored in `customfield_10014`. The client reads both the description and this custom field.

---

### 6.3 LLM Client Tool

**File:** `tools/llm_client.py`

Implements a **factory pattern** to abstract away provider differences. All providers receive the same system prompt and user message; the client routes to the correct provider implementation.

**Supported Providers:**

| Provider | API Type | Authentication | Default Model |
|----------|----------|---------------|--------------|
| **Claude** (Anthropic) | Anthropic SDK | API Key | `claude-sonnet-4-6` |
| **GROQ** | GROQ SDK (OpenAI-compatible) | API Key | `llama-3.3-70b-versatile` |
| **Grok** (xAI) | REST API | API Key | `grok-3-mini` |
| **Ollama** | Local REST API | None (local) | `llama3.2` |
| **Falcon AI** | REST API (OpenAI-compatible) | API Key | `tiiuae/falcon-40b-instruct` |

**Pre-Generation Validation (`check_missing_info`):**

Before calling the LLM, the tool scans all fetched issues for quality issues:
- Issues with **no acceptance criteria** → flagged with `[NEEDS INFO: Missing acceptance criteria]`
- Issues with **descriptions shorter than 50 characters** → flagged with `[NEEDS INFO: Description too short]`

These flags are shown to the user in the Review step so they can add context before generation.

**LLM Call Configuration:**

```python
temperature = 0.3    # Low for deterministic, consistent output
max_tokens  = 4096   # Sufficient for a full test plan
```

**Prompt Caching (Claude Only):**

For the Claude provider, the system prompt is sent with a `cache_control: {"type": "ephemeral"}` marker. This enables Anthropic's prompt caching feature, which:
- Caches the system prompt for 5 minutes
- Reduces latency on repeated calls (same project, iterating)
- Reduces cost for long system prompts

**Factory Routing:**

```python
def generate_test_plan(conn, system_prompt, user_message):
    if conn.provider == "claude":
        return _generate_claude(conn, system_prompt, user_message)
    elif conn.provider == "groq":
        return _generate_groq(conn, system_prompt, user_message)
    elif conn.provider == "grok":
        return _generate_grok(conn, system_prompt, user_message)
    elif conn.provider == "ollama":
        return _generate_ollama(conn, system_prompt, user_message)
```

---

### 6.4 Test Plan Generator (Orchestrator)

**File:** `tools/test_plan_generator.py`

The orchestrator coordinates the complete generation pipeline.

**Pipeline Steps:**

```
1. Load Template
   └── Read test_plan_templates/test_plan.md
   └── Cache at import time (one read per server lifetime)

2. Check Missing Info
   └── llm_client.check_missing_info(issues)
   └── Collect all [NEEDS INFO] flags

3. Build System Prompt
   └── Strict template instructions
   └── Rule 1: Follow template exactly
   └── Missing data → [NEEDS INFO: ...]

4. Build User Message
   └── All issue details (key, summary, desc, AC)
   └── Additional context from user
   └── Product name, project key

5. Call LLM
   └── llm_client.generate_test_plan(conn, system, user)
   └── Returns markdown string

6. Validate Sections
   └── Check all ## headings from template exist in output
   └── Record any missing sections as warnings

7. Export Files
   └── pdf_exporter.export_to_markdown() → .tmp/test_plan_*.md
   └── doc_exporter.export_to_doc() → .tmp/test_plan_*.docx

8. Save History
   └── Append record to .tmp/history.json
   └── Include paths to exported files
```

**Section Validation:**

After generation, the tool checks that every `##` level heading from the template appears in the generated markdown. If any are missing, they are returned as warnings and displayed to the user, but do not block the result.

**Return Schema:**

```python
{
    "success": True,
    "markdown": "<generated test plan>",
    "missing_info": ["SCI-42: Missing AC", ...],
    "missing_sections": ["## Performance Testing", ...],
    "markdown_path": ".tmp/test_plan_SCI_20260412_143022.md",
    "doc_path": ".tmp/test_plan_SCI_20260412_143022.docx"
}
```

---

### 6.5 Export Pipeline

#### PDF Exporter — `tools/pdf_exporter.py`

Exports the generated markdown to PDF using a three-tier fallback:

```
Tier 1: weasyprint (HTML → PDF)
   └── Best quality, supports CSS styling
   └── Requires GTK libraries on Windows
   └── Falls back if import fails
        │
Tier 2: fpdf2 (Pure Python PDF)
   └── No external dependencies
   └── Unicode-aware (handles special characters)
   └── Basic formatting (no images/tables)
        │
Tier 3: HTML file with note
   └── If both fail, generates an .html file
   └── User can print-to-PDF from browser
```

#### Word Exporter — `tools/doc_exporter.py`

Exports the generated markdown to a styled Microsoft Word `.docx` file using `python-docx`.

**Supported Markdown Elements:**

| Markdown | Word Equivalent |
|----------|----------------|
| `# Heading 1` | Heading 1 style |
| `## Heading 2` | Heading 2 style |
| `### Heading 3` | Heading 3 style |
| `- item` | List Bullet style |
| `1. item` | List Number style |
| `> blockquote` | Quote paragraph |
| `**bold**` | Bold run |
| `*italic*` | Italic run |
| `` `code` `` | Monospace run |
| `\|table\|` | Word Table |
| `---` | Page separator |

The exporter processes each line of markdown, detects its type, and applies the corresponding Word styling using python-docx's paragraph and run APIs.

---

### 6.6 Frontend — React Application

**Directory:** `frontend/src/`

The UI is built as a **4-step linear wizard** with backward navigation allowed after step completion.

**Component Tree:**

```
App.tsx                          ← Main router, global state
├── Header                       ← Title, dark/light toggle, History button
├── StepNavigation               ← 4 clickable step indicators
└── StepContent
    ├── Setup.tsx                ← Step 1: Configure connections
    ├── FetchIssues.tsx          ← Step 2: Enter project & fetch
    ├── Review.tsx               ← Step 3: Review issues & flags
    └── TestPlan.tsx             ← Step 4: View & export plan
        └── History.tsx          ← Overlay: previous test plans
```

**Centralized API Client — `frontend/src/api.ts`:**

All API calls go through a single axios instance configured with `baseURL: '/api'`. Components never make raw fetch/axios calls; they import from `api.ts`. This means:
- One place to change the base URL
- Easy to add auth headers later
- Consistent error handling

**Step 1 — Setup:**
- Forms for Jira connection (name, URL, email, API token)
- Forms for LLM connection (name, provider dropdown, model, API key)
- "Test Connection" button for each — calls backend and shows success/failure inline
- Saved connections displayed with delete option
- Cannot advance to Step 2 without at least one saved connection of each type

**Step 2 — Fetch Issues:**
- Dropdown selectors for saved Jira and LLM connections
- Text fields: product name, project key
- Optional: specific Jira IDs (comma-separated), sprint/version filter
- Textarea for additional context to inject into generation
- Fetch button shows loading spinner; error messages displayed inline

**Step 3 — Review:**
- Cards for each fetched issue showing: key, summary, type, status, priority, description preview, acceptance criteria preview
- Quality warning banners for: missing acceptance criteria, short/vague descriptions
- Additional context textarea (pre-filled from Step 2, editable)
- "Generate Test Plan" button triggers LLM generation

**Step 4 — Test Plan:**
- Metadata bar: product name, issue count, timestamp, "Generated" badge
- Rendered markdown using `react-markdown` + `remark-gfm`
- Warning badges for missing sections (if any)
- Missing info flags shown as collapsible list
- Download buttons: `.md` and `.docx`
- "Start Over" resets to Step 1

**History View:**
- Full-page overlay listing all previously generated test plans
- Per-record: product name, project key, Jira keys, issue count, generation timestamp
- Download `.md` or `.docx` for any record
- Delete button removes the history entry (files are retained on disk)

**Theming:**
- Dark / Light mode toggle in header
- CSS variables: `--bg`, `--text`, `--accent`, `--border`, `--card`, etc.
- Theme persisted in `localStorage` across sessions
- Responsive grid layout (two-column forms, single-column on mobile)

---

## 7. End-to-End Data Flow

```
STEP 1: CONFIGURE CONNECTIONS
──────────────────────────────────────────────────────────────────
User enters Jira details → [Test Connection]
  → POST /api/connections/test
  → jira_client.test_connection()
  → GET https://company.atlassian.net/rest/api/3/myself
  → 200 OK → "Connected!" / Error shown inline

User enters LLM details → [Test Connection]
  → POST /api/llm-connections/test
  → llm_client.test_llm_connection()
  → Provider-specific ping (e.g., list models)
  → Success / Error shown inline

[Save] → POST /api/connections (or /api/llm-connections)
  → Written to .tmp/jira_connections.json (or llm_connections.json)


STEP 2: FETCH ISSUES
──────────────────────────────────────────────────────────────────
User selects connections, enters project key "SCI", clicks [Fetch]
  → POST /api/issues/fetch
  → Load Jira connection from .tmp/jira_connections.json
  → jira_client.get_issues(conn, project_key="SCI")
  → GET /rest/api/3/search?jql=project="SCI" AND statusCategory!=Done
  → Parse each issue: _parse_issue() + _extract_adf_text()
  → Return Issue[] to React


STEP 3: REVIEW ISSUES
──────────────────────────────────────────────────────────────────
React renders issue cards from Issue[]
  → Client checks each issue:
      - No acceptance criteria → show warning
      - Description < 50 chars → show warning
  → User reviews, optionally adds context in textarea
  → User clicks [Generate Test Plan]


STEP 4: GENERATE TEST PLAN
──────────────────────────────────────────────────────────────────
  → POST /api/test-plan/generate
  → Load LLM connection from .tmp/llm_connections.json
  → test_plan_generator.run(llm_conn, issues, product_name, ...)

  Inside run():
    a. Load template from test_plan_templates/test_plan.md (cached)
    b. llm_client.check_missing_info(issues) → collect flags
    c. Build system prompt:
         "You are a QA engineer. Follow this template exactly:
          [template content]
          Rule 1: Never deviate from template structure.
          Use [NEEDS INFO: ...] for missing data."
    d. Build user message:
         "Product: Acme App
          Project: SCI
          Issues:
            SCI-1: User Login
            Description: As a user...
            Acceptance Criteria: Given...
          Additional Context: Sprint 4 focus is..."
    e. Call LLM:
         Claude → Anthropic SDK (with prompt cache on system)
         GROQ   → groq.Groq().chat.completions.create()
         Grok   → POST https://api.x.ai/v1/chat/completions
         Ollama → POST http://localhost:11434/api/chat
    f. Receive markdown test plan string
    g. Validate ## sections against template
    h. Export:
         pdf_exporter.export_to_markdown() → .tmp/test_plan_SCI_*.md
         doc_exporter.export_to_doc()      → .tmp/test_plan_SCI_*.docx
    i. Append to .tmp/history.json

  → Return {success, markdown, missing_info, missing_sections, paths}


STEP 5: EXPORT & DOWNLOAD
──────────────────────────────────────────────────────────────────
User clicks [Download .md]
  → GET /api/test-plan/export/markdown
  → FileResponse(.tmp/test_plan_SCI_*.md)
  → Browser downloads file

User clicks [Download .docx]
  → GET /api/test-plan/export/doc
  → FileResponse(.tmp/test_plan_SCI_*.docx)
  → Browser downloads file


STEP 6: HISTORY
──────────────────────────────────────────────────────────────────
User clicks [View History]
  → GET /api/history
  → Read .tmp/history.json
  → Display all records

User clicks [Download .docx] on old record
  → GET /api/history/{id}/download/doc
  → If .docx exists → FileResponse
  → If not → doc_exporter.export_to_doc() from stored .md path
```

---

## 8. API Reference

**Base URL:** `http://localhost:8000/api`  
**Documentation:** `http://localhost:8000/docs` (Swagger UI)

### Connection Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/connections` | Save a Jira connection |
| `POST` | `/connections/test` | Test Jira credentials |
| `GET` | `/connections` | List all saved Jira connections |
| `DELETE` | `/connections/{name}` | Delete a Jira connection |
| `POST` | `/llm-connections` | Save an LLM connection |
| `POST` | `/llm-connections/test` | Test an LLM provider connection |
| `GET` | `/llm-connections` | List all saved LLM connections |
| `DELETE` | `/llm-connections/{name}` | Delete an LLM connection |

### Issues

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/issues/fetch` | Fetch issues from Jira |

### Test Plan

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/test-plan/generate` | Generate test plan via LLM |
| `GET` | `/test-plan/export/markdown` | Download last generated `.md` |
| `GET` | `/test-plan/export/doc` | Download last generated `.docx` |

### History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/history` | List all generated test plans |
| `GET` | `/history/{id}/download/markdown` | Download historical `.md` |
| `GET` | `/history/{id}/download/doc` | Download historical `.docx` |
| `DELETE` | `/history/{id}` | Remove history record |

---

## 9. LLM Integration & Prompt Design

### System Prompt

The system prompt instructs the LLM to act as a senior QA engineer and strictly follow the provided test plan template. Key instructions include:

1. **Template adherence**: Every `##` section in the template must appear in the output, in the same order
2. **No hallucination**: Only document what is in the requirements; use `[NEEDS INFO: reason]` for missing data
3. **Structured output**: Output must be valid Markdown
4. **No extra sections**: Do not add sections not present in the template
5. **Context-aware**: Use additional context provided by the user when relevant

### User Message Structure

```
Product Name: Acme Platform
Project Key: SCI
Additional Context: Sprint 4, focus on authentication flows

--- JIRA ISSUES ---

[SCI-1] User Login
Type: Story | Status: In Progress | Priority: High
Description:
  As a registered user, I want to log in with email and password
  so that I can access my account.
Acceptance Criteria:
  Given a valid email and password
  When I submit the login form
  Then I am redirected to the dashboard
  And a session token is stored

[SCI-2] Password Reset
Type: Story | Status: Open | Priority: Medium
Description: [NEEDS INFO: Description missing]
Acceptance Criteria: [NEEDS INFO: Missing acceptance criteria]
```

### Provider Differences

| Feature | Claude | GROQ | Grok | Ollama | Falcon AI |
|---------|--------|------|------|--------|-----------|
| Prompt Caching | Yes (system prompt, 5 min) | No | No | No | No |
| Temperature | 0.3 | 0.3 | 0.3 | 0.3 | 0.3 |
| Max Tokens | 4096 | 4096 | 4096 | 4096 | 4096 |
| Streaming | No (full response) | No | No | No | No |
| Internet Required | Yes | Yes | Yes | No | Yes (or internal) |
| Cost | Per token | Per token | Per token | Free | Per token |
| Custom Base URL | No | No | Yes | Yes | Yes |

### Prompt Caching Detail (Claude)

```python
messages=[{
    "role": "user",
    "content": [{
        "type": "text",
        "text": system_prompt,
        "cache_control": {"type": "ephemeral"}   # ← Cache this
    }, {
        "type": "text",
        "text": user_message                      # ← Don't cache (changes per request)
    }]
}]
```

This caches the system prompt (which is long and constant) while leaving the user message (which contains different Jira issues each time) uncached.

---

## 10. Test Plan Template

**File:** `test_plan_templates/test_plan.md`

The template defines the mandatory structure of every generated test plan. The generator validates that all `##` section headings are present in the output.

Typical sections in the template include:

```markdown
# Test Plan: [Product Name]

## 1. Introduction
## 2. Scope
## 3. Test Objectives
## 4. Test Items
## 5. Features to Be Tested
## 6. Features Not to Be Tested
## 7. Test Approach
## 8. Entry / Exit Criteria
## 9. Test Cases
## 10. Test Deliverables
## 11. Environmental Needs
## 12. Risks and Contingencies
## 13. Approvals
```

Each section is populated by the LLM based on the Jira requirements. Missing data is marked with `[NEEDS INFO: ...]` rather than fabricated.

---

## 11. Constitutional Rules (Agent Design Principles)

The system was designed with seven explicit rules, documented in `gemini.md`:

| Rule | Name | Description |
|------|------|-------------|
| **1** | Strict Template Mode | The LLM must follow the template exactly — no adding, removing, or reordering sections. Missing data must use `[NEEDS INFO: ...]`. |
| **2** | Ask Before Assuming | Pre-check all issues for missing acceptance criteria or vague descriptions. Show flags to user before LLM generation so they can add context. |
| **3** | Deterministic Tools | All Python tools in `tools/` are pure and testable. Only `llm_client.py` calls an LLM. No side effects in tools. |
| **4** | Connections via UI | Both Jira and LLM connections are configured through the web UI with test-before-save. No hardcoded credentials. |
| **5** | `.tmp/` is Ephemeral | All exports are saved to `.tmp/`. No cloud storage, no database in v1. Generated files are ephemeral. |
| **6** | Prompt Caching (Claude) | Use `cache_control: {"type": "ephemeral"}` on the system prompt when using Claude to reduce cost and latency. |
| **7** | Multi-Provider Abstraction | `llm_client.py` abstracts all provider differences. Changing providers requires zero changes to other code. |

---

## 12. File & Directory Structure

```
Test_Planner_Agent/
│
├── backend/
│   └── main.py                    ← FastAPI application (routes, persistence)
│
├── tools/
│   ├── jira_client.py             ← Jira REST API v3 client + ADF parser
│   ├── llm_client.py              ← Multi-provider LLM client (factory pattern)
│   ├── test_plan_generator.py     ← Pipeline orchestrator
│   ├── pdf_exporter.py            ← Markdown → PDF (3-tier fallback)
│   └── doc_exporter.py            ← Markdown → Word (.docx)
│
├── frontend/
│   ├── src/
│   │   ├── App.tsx                ← Main component, stepper state
│   │   ├── api.ts                 ← Centralized axios client
│   │   ├── App.css                ← Global styles, CSS variables, theming
│   │   └── components/
│   │       ├── Setup.tsx          ← Step 1: Connection configuration
│   │       ├── FetchIssues.tsx    ← Step 2: Project & issue selection
│   │       ├── Review.tsx         ← Step 3: Issue review & quality flags
│   │       ├── TestPlan.tsx       ← Step 4: Plan view & export
│   │       ├── History.tsx        ← History overlay
│   │       └── TestPlan.css       ← Test plan specific styles
│   ├── package.json
│   └── vite.config.ts
│
├── test_plan_templates/
│   └── test_plan.md               ← Master test plan template
│
├── architecture/                  ← Architecture diagrams and notes
├── .tmp/                          ← Runtime: connections, generated files, history
│   ├── jira_connections.json
│   ├── llm_connections.json
│   ├── history.json
│   ├── test_plan_*.md
│   └── test_plan_*.docx
│
├── .env.template                  ← API key template (copy to .env)
├── requirements.txt               ← Python dependencies
├── start.bat                      ← Windows launcher (opens both servers)
├── gemini.md                      ← Constitutional rules & agent design
├── findings.md                    ← Research notes (Jira API, PDF libraries)
├── progress.md                    ← Development progress log
├── task_plan.md                   ← Task breakdown
└── SETUP.md                       ← User installation guide
```

---

## 13. Data Storage

The system uses **file-based storage** in the `.tmp/` directory. There is no database in v1.

### Storage Files

| File | Format | Contents |
|------|--------|---------|
| `.tmp/jira_connections.json` | JSON array | Saved Jira connection configs |
| `.tmp/llm_connections.json` | JSON array | Saved LLM connection configs |
| `.tmp/history.json` | JSON array | History records for generated plans |
| `.tmp/test_plan_<KEY>_<TS>.md` | Markdown | Generated test plan documents |
| `.tmp/test_plan_<KEY>_<TS>.docx` | Word | Generated Word documents |

### History Record Schema

```json
{
    "id": "test_plan_SCI_20260412_143022",
    "created_at": "2026-04-12T14:30:22.000Z",
    "project_key": "SCI",
    "product_name": "Acme Platform",
    "issues_count": 8,
    "issue_keys": ["SCI-1", "SCI-2", "SCI-5"],
    "markdown_path": ".tmp/test_plan_SCI_20260412_143022.md",
    "doc_path": ".tmp/test_plan_SCI_20260412_143022.docx"
}
```

---

## 14. Setup & Installation Guide

### Prerequisites

1. **Python 3.11+** — Download from python.org
2. **Node.js 20+ LTS** — Download from nodejs.org
3. **API Keys** (at least one LLM provider):
   - Anthropic (Claude): `console.anthropic.com`
   - GROQ: `console.groq.com`
   - Grok (xAI): `console.x.ai`
   - Ollama: No key needed, install from `ollama.ai`
4. **Jira Cloud account** with API token:
   - Generate at: `id.atlassian.net/manage-profile/security/api-tokens`

### Step 1: Clone / Download the Project

```bash
cd AI_Engineering/Chapter_04_Ai_Agents/Test_Planner_Agent
```

### Step 2: Configure Environment Variables (Optional)

```bash
# Windows
copy .env.template .env

# Linux/macOS
cp .env.template .env
```

Edit `.env` and add your API keys:

```env
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
GROK_API_KEY=xai-...
OLLAMA_BASE_URL=http://localhost:11434
```

> Note: API keys can also be entered directly in the UI at runtime. The `.env` file is optional.

### Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt

# Additional optional packages:
pip install python-docx     # Word export (usually auto-installed)
pip install weasyprint      # Better PDF quality (optional, needs GTK on Windows)
```

### Step 4: Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

---

## 15. Running the Application

> **Note:** The VS Code integrated terminal runs **PowerShell** on Windows. Use the commands below — not bash-style commands.

### Starting the Servers

You need to open **two separate terminals** in VS Code (click the `+` button in the terminal panel to open a new one).

**Terminal 1 — Start Backend:**
```powershell
cd "C:\Users\SmrutiranjanMaharana\AI_Engineering\Chapter_04_Ai_Agents\test_Orchestrator"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

**Terminal 2 — Start Frontend:**
```powershell
cd "C:\Users\SmrutiranjanMaharana\AI_Engineering\Chapter_04_Ai_Agents\test_Orchestrator\frontend"
npm run dev
```

You should see:
```
VITE ready in ...ms
➜  Local: http://localhost:5173/
```

> If port 5173 is already in use, Vite will automatically pick the next available port (e.g., 5174). Use whichever port it shows.

Then open your browser at: **`http://localhost:5173`**

---

### Stopping the Servers

**Option A — Using the terminal (recommended):**

Click into each terminal window (Backend and Frontend) and press:
```
Ctrl + C
```
This gracefully stops each server.

**Option B — Force stop all servers (PowerShell):**

If the terminals are unresponsive or already closed, run this in a new PowerShell terminal:

```powershell
taskkill /F /IM python.exe /T
taskkill /F /IM node.exe /T
```

> This stops **all** Python and Node.js processes on your machine. Only use this if you have no other Python/Node apps running.

**Option C — Stop by port (PowerShell):**

To stop only the specific ports used by this app:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
```

---

### API Documentation

Interactive Swagger UI available at: **`http://localhost:8000/docs`**

---

### First-Time Workflow

1. Open **`http://localhost:5173`** in your browser
2. **Step 1 (Setup):** Enter your Jira URL, email, and API token → click "Test Connection" → click "Save". Then enter your LLM provider details → click "Test Connection" → click "Save".
3. **Step 2 (Fetch Issues):** Select your saved connections. Enter your Jira project key (e.g., `SCI`). Optionally add specific issue IDs or a sprint name. Click "Fetch Issues".
4. **Step 3 (Review):** Review the fetched issues. Address any quality warnings by adding context in the textarea. Click "Generate Test Plan".
5. **Step 4 (Test Plan):** Your test plan is rendered. Download as `.md` or `.docx`.

---

## 16. Known Limitations & Future Roadmap

### Current Limitations (v1)

| Limitation | Details |
|-----------|---------|
| Local file storage | `.tmp/` is local to the machine running the server; no cloud sync |
| Single user | No authentication; connections visible to all users on same machine |
| Single active test plan | Only the last generated plan can be exported immediately (older plans accessible via History) |
| PDF quality | PDF export on Windows may fall back to basic fpdf2 (weasyprint requires GTK) |
| Max tokens | 4096 token limit may truncate very large projects (>20 issues) |
| Jira custom fields | Acceptance criteria field ID (`customfield_10014`) may differ per Jira instance |

### Potential Future Improvements

| Feature | Description |
|---------|-------------|
| User authentication | Login system for multi-user environments |
| Cloud storage | Store generated plans in S3, Azure Blob, or Google Drive |
| Streaming output | Show test plan being generated token by token |
| Multiple Jira sources | Support Jira Server / Data Center in addition to Cloud |
| Template editor | Allow users to customize the test plan template via the UI |
| LLM comparison | Generate with multiple providers and compare outputs side-by-side |
| Slack / Teams integration | Post generated test plans directly to messaging channels |
| Issue editing | Edit acceptance criteria directly in the Review UI without going back to Jira |
| Incremental updates | Regenerate only changed issues rather than the full plan |

---

*End of Document*

---

**Document prepared for:** Technical review and stakeholder presentation  
**Project location:** `AI_Engineering/Chapter_04_Ai_Agents/Test_Planner_Agent/`  
**API Docs (when running):** `http://localhost:8000/docs`
