/**
 * Step 2: Fetch Issues
 * Enter product name, Jira IDs, then fetch.
 * Project key is auto-derived from the first Jira ID (e.g. SCI-123 → SCI).
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

function deriveProjectKey(jiraIdsRaw: string): string {
  const first = jiraIdsRaw.split(',')[0].trim()
  return first ? first.replace(/-\d+$/, '').toUpperCase() : ''
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
    jiraIdsRaw: '',
  })

  useEffect(() => {
    Promise.all([getConnections(), getLLMConnections()]).then(([j, l]) => {
      setConnections(j.data.connections || [])
      setLlmConnections(l.data.connections || [])
      if (!form.connectionName && j.data.connections?.length) {
        setForm(f => ({ ...f, connectionName: j.data.connections[0].name }))
      }
      if (!form.llmConnectionName && l.data.connections?.length) {
        setForm(f => ({ ...f, llmConnectionName: l.data.connections[0].name }))
      }
    })
  }, [])

  async function handleFetch() {
    if (!form.connectionName) {
      setError('Please select a Jira connection.')
      return
    }
    if (!form.jiraIdsRaw.trim()) {
      setError('Enter at least one Jira ID (e.g. SCI-123).')
      return
    }
    const projectKey = deriveProjectKey(form.jiraIdsRaw)
    setLoading(true)
    setError('')
    try {
      const jiraIds = form.jiraIdsRaw.split(',').map(s => s.trim()).filter(Boolean)

      const res = await fetchIssues({
        connection_name: form.connectionName,
        product_name: form.productName,
        project_key: projectKey,
        jira_ids: jiraIds,
      })

      if (!res.data.success) {
        setError(res.data.error || 'Failed to fetch issues.')
        setLoading(false)
        return
      }

      const issues = res.data.issues || []
      if (issues.length === 0) {
        setError('No issues found for the given Jira IDs.')
        setLoading(false)
        return
      }

      setFetchState({
        connectionName: form.connectionName,
        llmConnectionName: form.llmConnectionName,
        productName: form.productName,
        projectKey,
        issues,
        additionalContext: '',
      })
      onNext()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Fetch failed. Check your connection and Jira IDs.')
    }
    setLoading(false)
  }

  const selectedConn = connections.find(c => c.name === form.connectionName)

  return (
    <div>
      <div className="card">
        <h2>Fetch Jira Requirements</h2>
        <p>Enter your Jira IDs to fetch issues and generate a test plan</p>

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

        <div className="form-row">
          <div className="form-group">
            <label>Product Name</label>
            <input placeholder="e.g., Project Advantage" value={form.productName}
              onChange={e => setForm({ ...form, productName: e.target.value })} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Specific Jira IDs<span>*</span></label>
            <input placeholder="e.g., SCI-123, SCI-124"
              value={form.jiraIdsRaw}
              onChange={e => setForm({ ...form, jiraIdsRaw: e.target.value })} />
            <span className="hint">Comma-separated. Project key is auto-detected from the IDs.</span>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button className="btn-primary full-width" onClick={handleFetch}
          disabled={loading || !form.connectionName || !form.llmConnectionName || !form.jiraIdsRaw.trim()}>
          {loading
            ? <><span className="spinner" /> Fetching Issues...</>
            : '↓ Fetch Jira Issues'}
        </button>
      </div>

    </div>
  )
}