/**
 * Step 2: Fetch Issues
 * Enter product name, project key, Jira IDs or sprint, then fetch.
 */

import { useState, useEffect } from 'react'
import { getConnections, getLLMConnections, fetchIssues } from '../api'
import type { FetchState } from '../App'

interface Props {
  fetchState: FetchState
  setFetchState: (s: FetchState) => void
  onNext: () => void
  onBack: () => void
}

export default function FetchIssues({ fetchState, setFetchState, onNext, onBack }: Props) {
  const [connections, setConnections] = useState<any[]>([])
  const [llmConnections, setLlmConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    connectionName: fetchState.connectionName,
    llmConnectionName: fetchState.llmConnectionName,
    productName: fetchState.productName,
    projectKey: fetchState.projectKey,
    jiraIdsRaw: '',        // comma-separated Jira IDs
    sprintVersion: '',
    additionalContext: fetchState.additionalContext,
  })

  useEffect(() => {
    Promise.all([getConnections(), getLLMConnections()]).then(([j, l]) => {
      setConnections(j.data.connections || [])
      setLlmConnections(l.data.connections || [])
      // Auto-select first connection if none chosen
      if (!form.connectionName && j.data.connections?.length) {
        setForm(f => ({ ...f, connectionName: j.data.connections[0].name }))
      }
      if (!form.llmConnectionName && l.data.connections?.length) {
        setForm(f => ({ ...f, llmConnectionName: l.data.connections[0].name }))
      }
    })
  }, [])

  async function handleFetch() {
    if (!form.connectionName || !form.projectKey) {
      setError('Please select a Jira connection and enter a Project Key.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const jiraIds = form.jiraIdsRaw
        ? form.jiraIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
        : []

      const res = await fetchIssues({
        connection_name: form.connectionName,
        product_name: form.productName,
        project_key: form.projectKey,
        jira_ids: jiraIds,
        sprint_version: form.sprintVersion || undefined,
        additional_context: form.additionalContext || undefined,
      })

      if (!res.data.success) {
        setError(res.data.error || 'Failed to fetch issues.')
        setLoading(false)
        return
      }

      const issues = res.data.issues || []
      if (issues.length === 0) {
        setError('No open issues found for the given project/sprint. Try different criteria.')
        setLoading(false)
        return
      }

      setFetchState({
        connectionName: form.connectionName,
        llmConnectionName: form.llmConnectionName,
        productName: form.productName,
        projectKey: form.projectKey,
        issues,
        additionalContext: form.additionalContext,
      })
      onNext()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Fetch failed. Check your connection and project key.')
    }
    setLoading(false)
  }

  const selectedConn = connections.find(c => c.name === form.connectionName)

  return (
    <div>
      <div className="card">
        <h2>Fetch Jira Requirements</h2>
        <p>Enter project details to fetch user stories and requirements</p>

        {selectedConn && (
          <div className="connected-banner">
            <span>Connected to: <strong>{selectedConn.name}</strong> ({selectedConn.url})</span>
            <button className="btn-outline" onClick={onBack}>Change</button>
          </div>
        )}

        <div className="form-row two-col">
          <div className="form-group">
            <label>Jira Connection<span>*</span></label>
            <select value={form.connectionName}
              onChange={e => setForm({ ...form, connectionName: e.target.value })}>
              <option value="">Select connection...</option>
              {connections.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>LLM Connection<span>*</span></label>
            <select value={form.llmConnectionName}
              onChange={e => setForm({ ...form, llmConnectionName: e.target.value })}>
              <option value="">Select LLM...</option>
              {llmConnections.map(c => <option key={c.name} value={c.name}>{c.name} ({c.provider})</option>)}
            </select>
          </div>
        </div>

        <div className="form-row two-col">
          <div className="form-group">
            <label>Product Name</label>
            <input placeholder="e.g., Project Advantage" value={form.productName}
              onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Project Key<span>*</span></label>
            <input placeholder="e.g., SCI" value={form.projectKey}
              onChange={e => setForm({ ...form, projectKey: e.target.value.toUpperCase() })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Specific Jira IDs (Optional)</label>
            <input placeholder="e.g., SCI-123, SCI-124 — leave empty to fetch all open issues"
              value={form.jiraIdsRaw}
              onChange={e => setForm({ ...form, jiraIdsRaw: e.target.value })} />
            <span className="hint">Comma-separated. If provided, only these issues are fetched.</span>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Sprint / Fix Version (Optional)</label>
            <input placeholder="e.g., Sprint 15 — leave empty for all open issues"
              value={form.sprintVersion}
              onChange={e => setForm({ ...form, sprintVersion: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Additional Context (Optional)</label>
            <textarea placeholder="Any additional information about the product, testing goals, or constraints..."
              value={form.additionalContext}
              onChange={e => setForm({ ...form, additionalContext: e.target.value })} />
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn-primary full-width" onClick={handleFetch}
          disabled={loading || !form.connectionName || !form.projectKey || !form.llmConnectionName}>
          {loading
            ? <><span className="spinner" /> Fetching Issues...</>
            : '↓ Fetch Jira Issues'}
        </button>
      </div>

      <div className="nav-buttons">
        <button className="btn-secondary" onClick={onBack}>← Back to Setup</button>
      </div>
    </div>
  )
}
