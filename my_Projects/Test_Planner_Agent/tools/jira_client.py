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


def get_issue_by_id(conn: JiraConnection, issue_key: str) -> dict:
    """
    Fetch a single Jira issue by its key (e.g. VWOAPP-123).
    Returns {"success": True, "issue": {...}} or {"success": False, "error": ...}
    """
    try:
        resp = requests.get(
            f"{conn.base_url}/rest/api/3/issue/{issue_key}",
            headers=conn.headers,
            params={
                "fields": "summary,description,issuetype,status,priority,customfield_10014,customfield_10016"
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return {"success": True, "issue": _parse_issue(resp.json())}
        if resp.status_code == 404:
            return {"success": False, "error": f"Issue '{issue_key}' not found."}
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}

    except Exception as e:
        return {"success": False, "error": str(e)}


def get_issues_by_ids(conn: JiraConnection, issue_keys: list[str]) -> dict:
    """
    Fetch multiple Jira issues by their keys.
    Returns {"success": True, "issues": [...], "errors": [...]}
    """
    issues = []
    errors = []
    for key in issue_keys:
        result = get_issue_by_id(conn, key.strip())
        if result["success"]:
            issues.append(result["issue"])
        else:
            errors.append({"key": key, "error": result["error"]})
    return {"success": True, "issues": issues, "errors": errors}


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
        # customfield_10014 is the standard Jira field for acceptance criteria
        "acceptance_criteria": _extract_adf_text(fields.get("customfield_10014")),
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
