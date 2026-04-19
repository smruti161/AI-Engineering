# SOP: Jira Fetch
## Goal
Fetch Jira user stories/requirements via the Atlassian REST API v3.

## Inputs
- Connection: name, url, email, api_token
- Query: project_key, jira_ids (optional), sprint_version (optional)

## Steps
1. Authenticate using HTTP Basic Auth (Base64 email:api_token)
2. Call `GET /rest/api/3/myself` to verify credentials
3. If `jira_ids` provided: fetch each by `GET /rest/api/3/issue/{key}`
4. Otherwise: query `GET /rest/api/3/search?jql=project=KEY AND statusCategory!=Done`
5. Parse ADF (Atlassian Document Format) from description and customfield_10014 (acceptance criteria)
6. Return normalized list of issue dicts matching the Core Data Object schema in gemini.md

## Edge Cases
- ADF is nested JSON — use recursive `_extract_adf_text()` in jira_client.py
- customfield_10014 varies by Jira instance — if null, flag as missing info
- Rate limit: Jira Cloud allows ~50 req/10s — max_results defaults to 50

## Tools
- `tools/jira_client.py`: `test_connection()`, `get_issues()`, `get_issue_by_id()`, `get_issues_by_ids()`
