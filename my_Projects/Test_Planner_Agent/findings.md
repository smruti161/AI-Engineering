# findings.md — Research & Discoveries
# Test Planner Agent

> Updated continuously. Discoveries here prevent repeated mistakes.

---

## Jira REST API v3

### Authentication
- Method: HTTP Basic Auth using email + API token (Base64 encoded)
- Header: `Authorization: Basic <base64(email:api_token)>`
- Token generation: https://id.atlassian.com/manage-profile/security/api-tokens

### Key Endpoints
- `GET /rest/api/3/project/{projectKey}` — verify project exists
- `GET /rest/api/3/search?jql=project={KEY}` — fetch issues by project
- `GET /rest/api/3/search?jql=project={KEY} AND sprint="{name}"` — filter by sprint
- `GET /rest/api/3/issue/{issueKey}` — fetch single issue by ID/key

### JQL for Acceptance Criteria
- Acceptance criteria is often stored in a custom field: `customfield_10014` (varies by instance)
- Also stored in the `description` field as an ADF (Atlassian Document Format) object
- ADF must be parsed to extract plain text (nested `content` arrays)

### Response Shape (Issue)
```json
{
  "id": "10001",
  "key": "PROJ-1",
  "fields": {
    "summary": "...",
    "description": { "type": "doc", "content": [...] },
    "issuetype": { "name": "Story" },
    "status": { "name": "In Progress" },
    "priority": { "name": "High" },
    "customfield_10016": "story points"
  }
}
```

### ADF Parser
Need to recursively extract text from Atlassian Document Format:
```python
def extract_text_from_adf(adf_node):
    if adf_node is None:
        return ""
    if adf_node.get("type") == "text":
        return adf_node.get("text", "")
    return " ".join(extract_text_from_adf(child) 
                    for child in adf_node.get("content", []))
```

---

## Claude API (Anthropic SDK)

### Prompt Caching
- Use `cache_control: {"type": "ephemeral"}` on system prompt blocks
- Cache the test plan template (large static text) as a cached user message
- Reduces latency on repeated generations for the same project
- Cache TTL: 5 minutes (ephemeral)

### Model
- Use `claude-sonnet-4-6` for cost/quality balance
- Max tokens for test plan generation: 4096

---

## PDF Export

### Library Options
- `weasyprint`: Best HTML→PDF, requires system dependencies (GTK on Windows = complex)
- `fpdf2`: Pure Python, simpler, but limited markdown support
- `markdown + xhtml2pdf`: Convert MD → HTML → PDF, good balance
- **Recommended**: `markdown` + `weasyprint` OR use `reportlab` as fallback

### Simplest Approach for Windows
Use `markdown` library to convert MD → HTML, then `weasyprint` for HTML → PDF.
If weasyprint install fails on Windows, fall back to `fpdf2` with plain text.

---

## FastAPI + React CORS

- FastAPI must add CORS middleware for React dev server (localhost:5173)
- Use `fastapi.middleware.cors.CORSMiddleware`

---

## React + Vite Setup

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install axios react-markdown
```
