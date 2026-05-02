"""
tools/jira_client.py
Layer 3 — Deterministic Jira REST API v3 client.
No LLM calls. Only fetches and parses Jira data.
"""

import base64
import requests
from typing import Optional
from dataclasses import dataclass


@dataclass
class JiraConnection:
    name: str
    url: str
    email: str
    api_token: str

    @property
    def auth_header(self) -> str:
        token = base64.b64encode(f"{self.email}:{self.api_token}".encode()).decode()
        return f"Basic {token}"

    @property
    def headers(self) -> dict:
        return {
            "Authorization": self.auth_header,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    @property
    def base_url(self) -> str:
        return self.url.rstrip("/")


def test_connection(conn: JiraConnection) -> dict:
    """
    Verify Jira credentials by calling /rest/api/3/myself.
    Returns {"success": True, "user": ...} or {"success": False, "error": ...}
    """
    try:
        resp = requests.get(
            f"{conn.base_url}/rest/api/3/myself",
            headers=conn.headers,
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "success": True,
                "user": data.get("displayName", ""),
                "email": data.get("emailAddress", ""),
                "account_id": data.get("accountId", ""),
            }
        return {
            "success": False,
            "error": f"HTTP {resp.status_code}: {resp.text[:200]}",
        }
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot reach Jira URL. Check the URL and your network."}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Connection timed out."}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_issues(
    conn: JiraConnection,
    project_key: str,
    sprint_version: Optional[str] = None,
    max_results: int = 50,
) -> dict:
    """
    Fetch open issues for a project, optionally filtered by sprint or fix version.
    Returns {"success": True, "issues": [...]} or {"success": False, "error": ...}
    """
    try:
        jql = f'project = "{project_key}" AND statusCategory != Done ORDER BY created DESC'
        if sprint_version:
            jql = (
                f'project = "{project_key}" AND sprint = "{sprint_version}" '
                f'AND statusCategory != Done ORDER BY created DESC'
            )

        resp = requests.get(
            f"{conn.base_url}/rest/api/3/search",
            headers=conn.headers,
            params={
                "jql": jql,
                "maxResults": max_results,
                "fields": "summary,description,issuetype,status,priority,customfield_10014,customfield_10016",
            },
            timeout=15,
        )

        if resp.status_code == 200:
            data = resp.json()
            issues = [_parse_issue(i) for i in data.get("issues", [])]
            return {"success": True, "issues": issues, "total": data.get("total", 0)}

        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot reach Jira. Check URL and network."}
    except Exception as e:
        return {"success": False, "error": str(e)}


BASIC_FIELDS = "summary,description,issuetype,status,priority,components,subtasks"


def get_issue_by_id(conn: JiraConnection, issue_key: str) -> dict:
    """
    Fetch a single Jira issue by its key (e.g. VWOAPP-123).
    Returns {"success": True, "issue": {...}, "_raw": {...}} or {"success": False, "error": ...}
    """
    try:
        resp = requests.get(
            f"{conn.base_url}/rest/api/3/issue/{issue_key}",
            headers=conn.headers,
            params={"fields": BASIC_FIELDS},
            timeout=10,
        )
        if resp.status_code == 200:
            raw = resp.json()
            return {"success": True, "issue": _parse_issue(raw), "_raw": raw}
        if resp.status_code == 404:
            return {"success": False, "error": f"Issue '{issue_key}' not found."}
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _search_jql(conn: JiraConnection, jql: str, max_results: int = 100) -> list[dict]:
    """Run a JQL search. Returns parsed issues or [] on failure."""
    try:
        resp = requests.get(
            f"{conn.base_url}/rest/api/3/search",
            headers=conn.headers,
            params={"jql": jql, "maxResults": max_results, "fields": BASIC_FIELDS},
            timeout=15,
        )
        if resp.status_code == 200:
            issues = resp.json().get("issues", [])
            return [_parse_issue(i) for i in issues]
        # Log only non-trivial errors (not JQL syntax errors which are expected for some strategies)
        if resp.status_code not in (400, 404):
            print(f"[jira] JQL HTTP {resp.status_code}: {resp.text[:120]}")
    except Exception as e:
        print(f"[jira] JQL exception: {e}")
    return []


def get_child_issues(conn: JiraConnection, parent_key: str, raw_issue: dict) -> list[dict]:
    """
    Fetch all child work items for an Epic using all available strategies.
    All strategies run and results are accumulated (deduped by key).

    Strategies:
    0. Jira Software Agile API  /rest/agile/1.0/epic/{key}/issue
    1. subtasks array embedded in the already-fetched issue JSON
    2. JQL: parent = KEY                       (next-gen / team-managed)
    3. JQL: "Epic Link" = KEY                  (classic company-managed)
    4. JQL: cf[10014] = KEY                    (Epic Link by field ID)
    5. JQL: issue in childIssuesOf(KEY)        (Jira Cloud built-in function)
    6. JQL: "Epic Link" = "KEY" (quoted value) (fallback variant)
    """
    children: list[dict] = []
    seen: set[str] = set()

    def _add(issues: list[dict]):
        added = 0
        for i in issues:
            if i["key"] not in seen:
                children.append(i)
                seen.add(i["key"])
                added += 1
        return added

    # Strategy 0 — Jira Software Agile API
    try:
        resp = requests.get(
            f"{conn.base_url}/rest/agile/1.0/epic/{parent_key}/issue",
            headers=conn.headers,
            params={"maxResults": 100, "fields": BASIC_FIELDS},
            timeout=15,
        )
        if resp.status_code == 200:
            added = _add([_parse_issue(i) for i in resp.json().get("issues", [])])
            print(f"[jira] Strategy 0 (Agile API): {added} children")
        else:
            print(f"[jira] Strategy 0 (Agile API): HTTP {resp.status_code} — {resp.text[:120]}")
    except Exception as e:
        print(f"[jira] Strategy 0 (Agile API) exception: {e}")

    # Strategy 1 — subtasks embedded in the raw issue JSON
    subtask_added = 0
    for sub in raw_issue.get("fields", {}).get("subtasks", []):
        sub_key = sub.get("key", "")
        if sub_key and sub_key not in seen:
            r = get_issue_by_id(conn, sub_key)
            if r["success"]:
                children.append(r["issue"])
                seen.add(sub_key)
                subtask_added += 1
    if subtask_added:
        print(f"[jira] Strategy 1 (subtasks): {subtask_added} children")

    # Strategies 2–6 — JQL variants (all run, results accumulated)
    jql_strategies = [
        f'parent = {parent_key} ORDER BY created ASC',
        f'"Epic Link" = {parent_key} ORDER BY created ASC',
        f'cf[10014] = {parent_key} ORDER BY created ASC',
        f'issue in childIssuesOf("{parent_key}") ORDER BY created ASC',
        f'"Epic Link" = "{parent_key}" ORDER BY created ASC',
    ]
    for idx, jql in enumerate(jql_strategies, start=2):
        hits = _search_jql(conn, jql)
        added = _add(hits)
        if added:
            print(f"[jira] Strategy {idx} JQL added {added}: {jql!r}")

    print(f"[jira] get_child_issues({parent_key}): {len(children)} total unique children")
    return children


def get_issues_by_ids(conn: JiraConnection, issue_keys: list[str]) -> dict:
    """
    Fetch multiple Jira issues by their keys.
    For every Epic fetched, child work items are automatically appended.
    Returns:
      {"success": True, "issues": [...all flat], "epics": [...epics only],
       "children_map": {"EPIC-KEY": [...children]}, "errors": [...]}
    Children have an extra "parent_key" field set to their Epic's key.
    """
    issues: list[dict] = []
    errors: list[dict] = []
    seen_keys: set[str] = set()
    epics: list[dict] = []
    children_map: dict[str, list[dict]] = {}

    for key in issue_keys:
        result = get_issue_by_id(conn, key.strip())
        if result["success"]:
            issue = result["issue"]
            raw = result.get("_raw", {})
            if issue["key"] not in seen_keys:
                issues.append(issue)
                seen_keys.add(issue["key"])
            # Fetch children for Epics
            if issue.get("issue_type", "").lower() == "epic":
                epics.append(issue)
                print(f"[jira_client] Fetching children for Epic {issue['key']}")
                epic_children: list[dict] = []
                for child in get_child_issues(conn, issue["key"], raw):
                    if child["key"] not in seen_keys:
                        child_with_parent = {**child, "parent_key": issue["key"]}
                        issues.append(child_with_parent)
                        epic_children.append(child_with_parent)
                        seen_keys.add(child["key"])
                children_map[issue["key"]] = epic_children
        else:
            errors.append({"key": key, "error": result["error"]})
    return {
        "success": True,
        "issues": issues,
        "epics": epics,
        "children_map": children_map,
        "errors": errors,
    }


def _parse_issue(raw: dict) -> dict:
    """
    Parse a raw Jira issue API response into a clean dict matching the gemini.md schema.
    Handles Atlassian Document Format (ADF) for description and acceptance criteria.
    """
    fields = raw.get("fields", {})
    return {
        "id": raw.get("id", ""),
        "key": raw.get("key", ""),
        "summary": fields.get("summary", ""),
        "description": _extract_adf_text(fields.get("description")),
        "issue_type": fields.get("issuetype", {}).get("name", ""),
        "status": fields.get("status", {}).get("name", ""),
        "priority": fields.get("priority", {}).get("name", "") if fields.get("priority") else "",
        "component": ", ".join(c.get("name", "") for c in fields.get("components", [])),
    }


def _extract_adf_text(node) -> str:
    """
    Recursively extract plain text from an Atlassian Document Format (ADF) node.
    ADF is a nested JSON structure used by Jira Cloud for rich text fields.
    """
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, dict):
        if node.get("type") == "text":
            return node.get("text", "")
        parts = []
        for child in node.get("content", []):
            text = _extract_adf_text(child)
            if text:
                parts.append(text)
        return "\n".join(parts) if parts else ""
    return ""
