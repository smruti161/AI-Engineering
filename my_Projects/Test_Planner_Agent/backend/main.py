"""
backend/main.py
Layer 2 — Navigation layer.
FastAPI app. Routes between React frontend and tools/ layer.
All business logic lives in tools/. This file only routes and validates.
"""

import json
import sys
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Add parent directory to path so tools/ can be imported
sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.jira_client import JiraConnection, test_connection, get_issues, get_issues_by_ids
from tools.llm_client import LLMConnection, test_llm_connection
from tools.test_plan_generator import run as generate_test_plan

app = FastAPI(title="Test Planner Agent", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMP_DIR = Path(__file__).parent.parent / ".tmp"
TMP_DIR.mkdir(parents=True, exist_ok=True)

HISTORY_FILE = TMP_DIR / "history.json"
JIRA_CONN_FILE = TMP_DIR / "jira_connections.json"
LLM_CONN_FILE = TMP_DIR / "llm_connections.json"

_last_result: Optional[dict] = None


# ── Persistent connection storage ─────────────────────────────────────────────

def _load_jira_connections() -> dict[str, dict]:
    if JIRA_CONN_FILE.exists():
        return json.loads(JIRA_CONN_FILE.read_text(encoding="utf-8"))
    return {}

def _save_jira_connections(data: dict):
    JIRA_CONN_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def _load_llm_connections() -> dict[str, dict]:
    if LLM_CONN_FILE.exists():
        return json.loads(LLM_CONN_FILE.read_text(encoding="utf-8"))
    return {}

def _save_llm_connections(data: dict):
    LLM_CONN_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _load_history() -> list[dict]:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    return []


def _save_history(record: dict):
    history = _load_history()
    history.insert(0, record)
    HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")


# ── Pydantic Request/Response Models ─────────────────────────────────────────

class JiraConnectionRequest(BaseModel):
    name: str
    url: str
    email: str
    api_token: str
    source_type: str = "jira"


class LLMConnectionRequest(BaseModel):
    name: str
    provider: str           # claude | groq | grok | ollama
    api_key: Optional[str] = None
    model: str = ""
    base_url: Optional[str] = None


class FetchIssuesRequest(BaseModel):
    connection_name: str
    product_name: str
    project_key: str
    jira_ids: list[str] = []
    sprint_version: Optional[str] = None
    additional_context: Optional[str] = None


class GenerateRequest(BaseModel):
    llm_connection_name: str
    issues: list[dict]
    product_name: str
    project_key: str
    additional_context: str = ""


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# ── Jira Connections ──────────────────────────────────────────────────────────

@app.get("/api/connections")
def list_connections():
    conns = _load_jira_connections()
    return {
        "connections": [
            {"name": v["name"], "url": v["url"], "email": v["email"], "source_type": v.get("source_type", "jira")}
            for v in conns.values()
        ]
    }


@app.post("/api/connections")
def save_connection(req: JiraConnectionRequest):
    conns = _load_jira_connections()
    conns[req.name] = req.model_dump()
    _save_jira_connections(conns)
    return {"success": True, "message": f"Connection '{req.name}' saved."}


@app.post("/api/connections/test")
def test_jira_connection(req: JiraConnectionRequest):
    if req.source_type == "ado":
        return {"success": False, "error": "Azure DevOps integration is coming soon."}
    conn = JiraConnection(
        name=req.name, url=req.url, email=req.email, api_token=req.api_token
    )
    return test_connection(conn)


@app.delete("/api/connections/{name}")
def delete_connection(name: str):
    conns = _load_jira_connections()
    if name not in conns:
        raise HTTPException(status_code=404, detail=f"Connection '{name}' not found.")
    del conns[name]
    _save_jira_connections(conns)
    return {"success": True}


# ── LLM Connections ───────────────────────────────────────────────────────────

@app.get("/api/llm-connections")
def list_llm_connections():
    conns = _load_llm_connections()
    return {
        "connections": [
            {"name": v["name"], "provider": v["provider"], "model": v["model"]}
            for v in conns.values()
        ]
    }


@app.post("/api/llm-connections")
def save_llm_connection(req: LLMConnectionRequest):
    conns = _load_llm_connections()
    conns[req.name] = req.model_dump()
    _save_llm_connections(conns)
    return {"success": True, "message": f"LLM connection '{req.name}' saved."}


@app.post("/api/llm-connections/test")
def test_llm_connection_endpoint(req: LLMConnectionRequest):
    conn = LLMConnection(
        name=req.name,
        provider=req.provider,
        api_key=req.api_key,
        model=req.model,
        base_url=req.base_url,
    )
    return test_llm_connection(conn)


@app.delete("/api/llm-connections/{name}")
def delete_llm_connection(name: str):
    conns = _load_llm_connections()
    if name not in conns:
        raise HTTPException(status_code=404, detail=f"LLM connection '{name}' not found.")
    del conns[name]
    _save_llm_connections(conns)
    return {"success": True}


# ── Fetch Issues ──────────────────────────────────────────────────────────────

@app.post("/api/issues/fetch")
def fetch_issues(req: FetchIssuesRequest):
    jira_conns = _load_jira_connections()
    if req.connection_name not in jira_conns:
        raise HTTPException(status_code=404, detail=f"Jira connection '{req.connection_name}' not found.")

    saved = jira_conns[req.connection_name]
    if saved.get("source_type") == "ado":
        return {"success": False, "error": "Azure DevOps integration is coming soon."}

    conn = JiraConnection(
        name=saved["name"],
        url=saved["url"],
        email=saved["email"],
        api_token=saved["api_token"],
    )

    if req.jira_ids:
        return get_issues_by_ids(conn, req.jira_ids)

    return get_issues(conn, req.project_key, req.sprint_version)


# ── Test Plan Generation ──────────────────────────────────────────────────────

@app.post("/api/test-plan/generate")
def generate(req: GenerateRequest):
    global _last_result

    llm_conns = _load_llm_connections()
    if req.llm_connection_name not in llm_conns:
        raise HTTPException(status_code=404, detail=f"LLM connection '{req.llm_connection_name}' not found.")

    saved_llm = llm_conns[req.llm_connection_name]
    llm_conn = LLMConnection(
        name=saved_llm["name"],
        provider=saved_llm["provider"],
        api_key=saved_llm.get("api_key"),
        model=saved_llm["model"],
        base_url=saved_llm.get("base_url"),
    )

    result = generate_test_plan(
        llm_conn=llm_conn,
        issues=req.issues,
        product_name=req.product_name,
        project_key=req.project_key,
        additional_context=req.additional_context,
    )

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Generation failed."))

    _last_result = result

    # Save to history
    _save_history({
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "project_key": req.project_key,
        "product_name": req.product_name,
        "issues_count": len(req.issues),
        "issue_keys": [i.get("key", "") for i in req.issues],
        "markdown_path": result["export_paths"]["markdown"],
        "doc_path": result["export_paths"]["doc"],
    })

    return result


# ── Export Endpoints ──────────────────────────────────────────────────────────

@app.get("/api/test-plan/export/markdown")
def export_markdown():
    if not _last_result:
        raise HTTPException(status_code=404, detail="No test plan generated yet.")
    path = Path(_last_result["export_paths"]["markdown"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Markdown file not found.")
    return FileResponse(str(path), media_type="text/markdown", filename=path.name)


@app.get("/api/test-plan/export/doc")
def export_doc():
    if not _last_result:
        raise HTTPException(status_code=404, detail="No test plan generated yet.")
    path = Path(_last_result["export_paths"]["doc"])
    if not path.exists():
        raise HTTPException(status_code=404, detail="Word document not found.")
    return FileResponse(
        str(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=path.name,
    )


# ── History Download Endpoints ────────────────────────────────────────────────

def _resolve_file(stored_path: str) -> Path | None:
    """
    Try the stored path first. If not found, fall back to TMP_DIR / filename.
    Returns a Path that exists, or None.
    """
    p = Path(stored_path)
    if p.exists():
        return p
    fallback = TMP_DIR / p.name
    if fallback.exists():
        return fallback
    return None


@app.get("/api/history/{record_id}/download/markdown")
def download_history_markdown(record_id: str):
    history = _load_history()
    record = next((h for h in history if h["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="History record not found.")
    path = _resolve_file(record.get("markdown_path", ""))
    if not path:
        raise HTTPException(status_code=404, detail="Markdown file not found on disk.")
    return FileResponse(str(path), media_type="text/markdown", filename=path.name)


@app.get("/api/history/{record_id}/download/doc")
def download_history_doc(record_id: str):
    from tools.doc_exporter import export_to_doc
    history = _load_history()
    record = next((h for h in history if h["id"] == record_id), None)
    if not record:
        raise HTTPException(status_code=404, detail="History record not found.")

    # Try stored doc_path first (with fallback resolution)
    doc_path_str = record.get("doc_path", "")
    if doc_path_str:
        path = _resolve_file(doc_path_str)
        if path:
            return FileResponse(
                str(path),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                filename=path.name,
            )

    # No docx found — generate it on-the-fly from the markdown file
    md_path = _resolve_file(record.get("markdown_path", ""))
    if not md_path:
        raise HTTPException(status_code=404, detail="Neither .docx nor .md source file found on disk.")

    md_text = md_path.read_text(encoding="utf-8")
    stem = md_path.stem  # e.g. test_plan_SCI_20260412_061719
    parts = stem.split("_")
    # Extract project_key and timestamp from filename
    project_key = parts[2] if len(parts) > 2 else "PLAN"
    timestamp = "_".join(parts[3:]) if len(parts) > 3 else "000000_000000"
    doc_path = export_to_doc(md_text, project_key, timestamp)

    # Update history record with generated doc_path for future downloads
    history = _load_history()
    for h in history:
        if h["id"] == record_id:
            h["doc_path"] = str(doc_path)
            break
    HISTORY_FILE.write_text(json.dumps(history, indent=2), encoding="utf-8")

    return FileResponse(
        str(doc_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=doc_path.name,
    )


# ── History ───────────────────────────────────────────────────────────────────

@app.get("/api/history")
def get_history():
    return {"history": _load_history()}


@app.delete("/api/history/{record_id}")
def delete_history_record(record_id: str):
    history = _load_history()
    updated = [h for h in history if h["id"] != record_id]
    if len(updated) == len(history):
        raise HTTPException(status_code=404, detail="History record not found.")
    HISTORY_FILE.write_text(json.dumps(updated, indent=2), encoding="utf-8")
    return {"success": True}


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="localhost", port=8000, reload=True)
