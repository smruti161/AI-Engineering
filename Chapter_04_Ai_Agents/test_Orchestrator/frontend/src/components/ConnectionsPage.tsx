/**
 * ConnectionsPage — Standalone connection manager accessible from the sidebar.
 * Manage Jira and LLM connections independently of any workflow.
 */

import { useState, useEffect } from 'react'
import {
  getConnections, saveConnection, testJiraConnection, deleteConnection,
  getLLMConnections, saveLLMConnection, testLLMConnection, deleteLLMConnection,
  getFalconModels,
} from '../api'

const PROVIDERS = [
  { value: 'claude',  label: 'Claude (Anthropic)', modelPlaceholder: 'claude-sonnet-4-6' },
  { value: 'groq',   label: 'GROQ',                modelPlaceholder: 'llama-3.3-70b-versatile' },
  { value: 'grok',   label: 'Grok (xAI)',          modelPlaceholder: 'grok-3-mini' },
  { value: 'ollama', label: 'Ollama (Local)',       modelPlaceholder: 'llama3.2' },
  { value: 'falcon', label: 'Falcon AI (Planview)',  modelPlaceholder: 'claude-sonnet-4-20250514' },
]


interface Props { onConnectionsReady?: () => void }

export default function ConnectionsPage({ onConnectionsReady }: Props = {}) {
  // ── Jira state ────────────────────────────────────────────────────────────
  const [jiraConns, setJiraConns]         = useState<any[]>([])
  const [showJiraForm, setShowJiraForm]   = useState(false)
  const [editingJira, setEditingJira]     = useState<any | null>(null)
  const [expandedJira, setExpandedJira]   = useState<string | null>(null)
  const [jiraForm, setJiraForm]           = useState({ name: '', url: '', email: '', api_token: '', source_type: 'jira' })
  const [jiraTesting, setJiraTesting]     = useState(false)
  const [jiraTestResult, setJiraTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [jiraSaving, setJiraSaving]       = useState(false)

  // ── LLM state ─────────────────────────────────────────────────────────────
  const [llmConns, setLlmConns]           = useState<any[]>([])
  const [showLlmForm, setShowLlmForm]     = useState(false)
  const [editingLLM, setEditingLLM]       = useState<any | null>(null)
  const [expandedLLM, setExpandedLLM]     = useState<string | null>(null)
  const [llmForm, setLlmForm]             = useState({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
  const [llmTesting, setLlmTesting]       = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [llmSaving, setLlmSaving]         = useState(false)
  const [falconModels, setFalconModels]   = useState<string[]>([])
  const [falconLoading, setFalconLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [j, l] = await Promise.all([getConnections(), getLLMConnections()])
    const jc = j.data.connections || []
    const lc = l.data.connections || []
    setJiraConns(jc)
    setLlmConns(lc)
    if (jc.length > 0 && lc.length > 0) onConnectionsReady?.()
  }

  // ── Jira handlers ─────────────────────────────────────────────────────────

  async function handleTestJira() {
    setJiraTesting(true); setJiraTestResult(null)
    try {
      const res = await testJiraConnection(jiraForm)
      setJiraTestResult(res.data.success
        ? { success: true,  message: `Connected as ${res.data.user} (${res.data.email})` }
        : { success: false, message: res.data.error })
    } catch (e: any) {
      setJiraTestResult({ success: false, message: e.response?.data?.detail || 'Connection failed.' })
    }
    setJiraTesting(false)
  }

  async function handleSaveJira() {
    setJiraSaving(true)
    await saveConnection(jiraForm)
    setShowJiraForm(false); setEditingJira(null)
    setJiraForm({ name: '', url: '', email: '', api_token: '', source_type: 'jira' })
    setJiraTestResult(null)
    await loadAll()
    setJiraSaving(false)
  }

  async function handleDeleteJira(name: string) {
    if (!window.confirm(`Remove Jira connection "${name}"?`)) return
    await deleteConnection(name); loadAll()
  }

  function startEditJira(c: any) {
    setJiraForm({ name: c.name, url: c.url, email: c.email, api_token: '', source_type: c.source_type })
    setEditingJira(c); setShowJiraForm(true); setExpandedJira(null); setJiraTestResult(null)
  }

  // ── LLM handlers ──────────────────────────────────────────────────────────

  async function handleTestLLM() {
    setLlmTesting(true); setLlmTestResult(null)
    try {
      const res = await testLLMConnection(llmForm)
      setLlmTestResult(res.data.success
        ? { success: true,  message: `Connected — model: ${res.data.model}` }
        : { success: false, message: res.data.error })
    } catch (e: any) {
      setLlmTestResult({ success: false, message: e.response?.data?.detail || 'Connection failed.' })
    }
    setLlmTesting(false)
  }

  async function handleSaveLLM() {
    setLlmSaving(true)
    await saveLLMConnection(llmForm)
    setShowLlmForm(false); setEditingLLM(null)
    setLlmForm({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
    setLlmTestResult(null)
    await loadAll()
    setLlmSaving(false)
  }

  async function handleDeleteLLM(name: string) {
    if (!window.confirm(`Remove LLM connection "${name}"?`)) return
    await deleteLLMConnection(name); loadAll()
  }

  function startEditLLM(c: any) {
    setLlmForm({ name: c.name, provider: c.provider, model: c.model, api_key: '', base_url: c.base_url || '' })
    setEditingLLM(c); setShowLlmForm(true); setExpandedLLM(null); setLlmTestResult(null)
    setFalconModels([])
  }

  async function handleLoadFalconModels() {
    setFalconLoading(true)
    try {
      const res = await getFalconModels({
        api_key: llmForm.api_key || undefined,
        base_url: llmForm.base_url || undefined,
        connection_name: editingLLM?.name || undefined,
      })
      if (res.data.success && res.data.models.length > 0) {
        setFalconModels(res.data.models)
        setLlmForm(f => ({ ...f, model: res.data.models[0] }))
      } else {
        setLlmTestResult({ success: false, message: res.data.error || 'Could not fetch models.' })
      }
    } catch (e: any) {
      setLlmTestResult({ success: false, message: e.response?.data?.detail || 'Failed to fetch models.' })
    }
    setFalconLoading(false)
  }

  const providerMeta = PROVIDERS.find(p => p.value === llmForm.provider)

  return (
    <div>
      {/* ── Jira Connections ─────────────────────────────────────────── */}
      <div className="card">
        <h2>Jira Connections</h2>
        <p>Connect to your Jira instance to fetch requirements for any tool</p>

        {jiraConns.length === 0 && !showJiraForm && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No Jira connections yet. Add one below.
          </div>
        )}

        {jiraConns.map(c => (
          <div className="connection-card" key={c.name}>
            <div className="connection-row"
              onClick={() => setExpandedJira(expandedJira === c.name ? null : c.name)}
              style={{ cursor: 'pointer' }}>
              <div className="connection-info">
                <span className="connection-name">{c.name}</span>
                <span className="connection-detail">{c.url} · {c.email}</span>
              </div>
              <div className="connection-actions">
                <span className={`badge ${c.source_type === 'ado' ? 'badge-warning' : 'badge-success'}`}>
                  {c.source_type === 'ado' ? 'Coming Soon' : 'Connected'}
                </span>
                <span className="chevron">{expandedJira === c.name ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedJira === c.name && (
              <div className="connection-details">
                <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{c.name}</span></div>
                <div className="detail-row"><span className="detail-label">URL</span><span className="detail-value">{c.url}</span></div>
                <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{c.email}</span></div>
                <div className="detail-row"><span className="detail-label">API Token</span><span className="detail-value masked">{'●'.repeat(20)}</span></div>
                <div className="detail-row"><span className="detail-label">Source</span><span className="detail-value">{c.source_type}</span></div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn-outline" onClick={() => startEditJira(c)}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDeleteJira(c.name)}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!showJiraForm ? (
          <button className="btn-outline" style={{ marginTop: 8 }} onClick={() => { setShowJiraForm(true); setEditingJira(null) }}>
            + Add Jira Connection
          </button>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)', marginBottom: 12 }}>
              {editingJira ? `Edit: ${editingJira.name}` : 'New Jira Connection'}
            </div>

            <div className="form-row two-col">
              <div className="form-group">
                <label>Connection Name<span>*</span></label>
                <input placeholder="e.g., My Jira" value={jiraForm.name}
                  onChange={e => setJiraForm({ ...jiraForm, name: e.target.value })}
                  disabled={!!editingJira} />
              </div>
              <div className="form-group">
                <label>Source Type</label>
                <select value={jiraForm.source_type}
                  onChange={e => setJiraForm({ ...jiraForm, source_type: e.target.value })}>
                  <option value="jira">Jira (Atlassian)</option>
                  <option value="ado">Azure DevOps (Coming Soon)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Jira URL<span>*</span></label>
                <input placeholder="https://yourcompany.atlassian.net" value={jiraForm.url}
                  onChange={e => setJiraForm({ ...jiraForm, url: e.target.value })} />
              </div>
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Email<span>*</span></label>
                <input type="email" placeholder="your-email@company.com" value={jiraForm.email}
                  onChange={e => setJiraForm({ ...jiraForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>API Token{!editingJira && <span>*</span>}</label>
                <input type="password"
                  placeholder={editingJira ? 'Leave blank to keep existing token' : 'Your Jira API token'}
                  value={jiraForm.api_token}
                  onChange={e => setJiraForm({ ...jiraForm, api_token: e.target.value })} />
                <span className="hint">
                  {editingJira
                    ? 'Leave blank to keep the existing token unchanged.'
                    : 'Generate at: id.atlassian.com/manage-profile/security/api-tokens'}
                </span>
              </div>
            </div>

            {jiraTestResult && (
              <div className={`alert ${jiraTestResult.success ? 'alert-success' : 'alert-error'}`}>
                {jiraTestResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={handleTestJira}
                disabled={jiraTesting || !jiraForm.url || !jiraForm.email || !jiraForm.api_token}>
                {jiraTesting ? <><span className="spinner spinner-blue" /> Testing...</> : 'Test Connection'}
              </button>
              <button className="btn-primary" onClick={handleSaveJira}
                disabled={jiraSaving || !jiraForm.name || !jiraForm.url || !jiraForm.email || (!editingJira && !jiraForm.api_token)}>
                {jiraSaving ? 'Saving...' : editingJira ? 'Update Connection' : 'Save Connection'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowJiraForm(false); setEditingJira(null); setJiraTestResult(null) }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── LLM Connections ──────────────────────────────────────────── */}
      <div className="card">
        <h2>LLM Connections</h2>
        <p>Configure AI models used for generation across all tools</p>

        {llmConns.length === 0 && !showLlmForm && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No LLM connections yet. Add one below.
          </div>
        )}

        {llmConns.map(c => (
          <div className="connection-card" key={c.name}>
            <div className="connection-row"
              onClick={() => setExpandedLLM(expandedLLM === c.name ? null : c.name)}
              style={{ cursor: 'pointer' }}>
              <div className="connection-info">
                <span className="connection-name">{c.name}</span>
                <span className="connection-detail">{c.provider} · {c.model}</span>
              </div>
              <div className="connection-actions">
                <span className="badge badge-success">Connected</span>
                <span className="chevron">{expandedLLM === c.name ? '▲' : '▼'}</span>
              </div>
            </div>
            {expandedLLM === c.name && (
              <div className="connection-details">
                <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{c.name}</span></div>
                <div className="detail-row"><span className="detail-label">Provider</span><span className="detail-value">{c.provider}</span></div>
                <div className="detail-row"><span className="detail-label">Model</span><span className="detail-value">{c.model}</span></div>
                <div className="detail-row"><span className="detail-label">API Key</span><span className="detail-value masked">{'●'.repeat(20)}</span></div>
                {c.base_url && <div className="detail-row"><span className="detail-label">Base URL</span><span className="detail-value">{c.base_url}</span></div>}
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn-outline" onClick={() => startEditLLM(c)}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDeleteLLM(c.name)}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!showLlmForm ? (
          <button className="btn-outline" style={{ marginTop: 8 }} onClick={() => { setShowLlmForm(true); setEditingLLM(null); setFalconModels([]) }}>
            + Add LLM Connection
          </button>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)', marginBottom: 12 }}>
              {editingLLM ? `Edit: ${editingLLM.name}` : 'New LLM Connection'}
            </div>

            <div className="form-row two-col">
              <div className="form-group">
                <label>Connection Name<span>*</span></label>
                <input placeholder="e.g., My Claude" value={llmForm.name}
                  onChange={e => setLlmForm({ ...llmForm, name: e.target.value })}
                  disabled={!!editingLLM} />
              </div>
              <div className="form-group">
                <label>Provider<span>*</span></label>
                <select value={llmForm.provider}
                  onChange={e => {
                    const p = e.target.value
                    setFalconModels([])
                    setLlmForm({ ...llmForm, provider: p, model: '' })
                  }}>
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Model<span>*</span></label>
                {llmForm.provider === 'falcon' ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {falconModels.length > 0 ? (
                      <select style={{ flex: 1 }} value={llmForm.model}
                        onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}>
                        {llmForm.model && !falconModels.includes(llmForm.model) && (
                          <option value={llmForm.model}>{llmForm.model}</option>
                        )}
                        {falconModels.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input
                        style={{ flex: 1 }}
                        value={llmForm.model}
                        readOnly={!!editingLLM}
                        placeholder="Click 'Load Models' to fetch available models"
                        onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}
                      />
                    )}
                    <button type="button" className="btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                      onClick={handleLoadFalconModels}
                      disabled={(!llmForm.api_key && !editingLLM) || falconLoading}
                      title={(!llmForm.api_key && !editingLLM) ? 'Enter your API key first' : 'Fetch available models from Falcon'}>
                      {falconLoading ? <><span className="spinner spinner-blue" /> Loading...</> : '↻ Load Models'}
                    </button>
                  </div>
                ) : (
                  <input placeholder={providerMeta?.modelPlaceholder || 'model name'} value={llmForm.model}
                    onChange={e => setLlmForm({ ...llmForm, model: e.target.value })} />
                )}
              </div>
              {llmForm.provider !== 'ollama' ? (
                <div className="form-group">
                  <label>API Key{!editingLLM && <span>*</span>}</label>
                  <input type="password"
                    placeholder={editingLLM ? 'Leave blank to keep existing key' : 'Your API key'}
                    value={llmForm.api_key}
                    onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })} />
                  {editingLLM && <span className="hint">Leave blank to keep the existing key unchanged.</span>}
                </div>
              ) : (
                <div className="form-group">
                  <label>Ollama Base URL</label>
                  <input placeholder="http://localhost:11434" value={llmForm.base_url}
                    onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })} />
                </div>
              )}
            </div>

            {llmTestResult && (
              <div className={`alert ${llmTestResult.success ? 'alert-success' : 'alert-error'}`}>
                {llmTestResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-outline" onClick={handleTestLLM}
                disabled={llmTesting || !llmForm.model}>
                {llmTesting ? <><span className="spinner spinner-blue" /> Testing...</> : 'Test Connection'}
              </button>
              <button className="btn-primary" onClick={handleSaveLLM}
                disabled={llmSaving || !llmForm.name || !llmForm.model}>
                {llmSaving ? 'Saving...' : editingLLM ? 'Update Connection' : 'Save Connection'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowLlmForm(false); setEditingLLM(null); setLlmTestResult(null) }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
