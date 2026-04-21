/**
 * Step 1: Setup
 * Manage Jira connections and LLM connections.
 * Both have "Test Connection" buttons.
 */

import { useState, useEffect } from 'react'
import {
  getConnections, saveConnection, testJiraConnection, deleteConnection,
  getLLMConnections, saveLLMConnection, testLLMConnection, deleteLLMConnection,
  getFalconModels,
} from '../api'

interface Props {
  onNext: () => void
}

const PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)', modelPlaceholder: 'claude-sonnet-4-6' },
  { value: 'groq', label: 'GROQ', modelPlaceholder: 'llama-3.3-70b-versatile' },
  { value: 'grok', label: 'Grok (xAI)', modelPlaceholder: 'grok-3-mini' },
  { value: 'ollama', label: 'Ollama (Local)', modelPlaceholder: 'llama3.2' },
  { value: 'falcon', label: 'Falcon AI (Planview)', modelPlaceholder: 'claude-sonnet-4-20250514' },
]

const FALCON_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
]

export default function Setup({ onNext }: Props) {
  // Jira connections state
  const [connections, setConnections] = useState<any[]>([])
  const [showJiraForm, setShowJiraForm] = useState(false)
  const [jiraForm, setJiraForm] = useState({ name: '', url: '', email: '', api_token: '', source_type: 'jira' })
  const [jiraTesting, setJiraTesting] = useState(false)
  const [jiraTestResult, setJiraTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [jiraSaving, setJiraSaving] = useState(false)
  const [expandedJira, setExpandedJira] = useState<string | null>(null)

  const [editingJira, setEditingJira] = useState<any | null>(null)

  // LLM connections state
  const [llmConnections, setLlmConnections] = useState<any[]>([])
  const [showLlmForm, setShowLlmForm] = useState(false)
  const [llmForm, setLlmForm] = useState({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [llmSaving, setLlmSaving] = useState(false)
  const [expandedLLM, setExpandedLLM] = useState<string | null>(null)
  const [editingLLM, setEditingLLM] = useState<any | null>(null)
  const [falconModels, setFalconModels] = useState<string[]>(FALCON_MODELS)
  const [falconLoading, setFalconLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [jRes, lRes] = await Promise.all([getConnections(), getLLMConnections()])
    setConnections(jRes.data.connections || [])
    setLlmConnections(lRes.data.connections || [])
  }

  // ── Jira ────────────────────────────────────────────────────────────────────

  async function handleTestJira() {
    setJiraTesting(true)
    setJiraTestResult(null)
    try {
      const res = await testJiraConnection(jiraForm)
      if (res.data.success) {
        setJiraTestResult({ success: true, message: `Connected as ${res.data.user} (${res.data.email})` })
      } else {
        setJiraTestResult({ success: false, message: res.data.error })
      }
    } catch (e: any) {
      setJiraTestResult({ success: false, message: e.response?.data?.detail || 'Connection failed.' })
    }
    setJiraTesting(false)
  }

  async function handleSaveJira() {
    setJiraSaving(true)
    await saveConnection(jiraForm)
    setShowJiraForm(false)
    setEditingJira(null)
    setJiraForm({ name: '', url: '', email: '', api_token: '', source_type: 'jira' })
    setJiraTestResult(null)
    await loadAll()
    setJiraSaving(false)
  }

  async function handleDeleteJira(name: string) {
    await deleteConnection(name)
    loadAll()
  }

  // ── LLM ─────────────────────────────────────────────────────────────────────

  async function handleTestLLM() {
    setLlmTesting(true)
    setLlmTestResult(null)
    try {
      const res = await testLLMConnection(llmForm)
      if (res.data.success) {
        setLlmTestResult({ success: true, message: `Connected — model: ${res.data.model}` })
      } else {
        setLlmTestResult({ success: false, message: res.data.error })
      }
    } catch (e: any) {
      setLlmTestResult({ success: false, message: e.response?.data?.detail || 'Connection failed.' })
    }
    setLlmTesting(false)
  }

  async function handleSaveLLM() {
    setLlmSaving(true)
    await saveLLMConnection(llmForm)
    setShowLlmForm(false)
    setEditingLLM(null)
    setLlmForm({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
    setLlmTestResult(null)
    await loadAll()
    setLlmSaving(false)
  }

  async function handleDeleteLLM(name: string) {
    await deleteLLMConnection(name)
    loadAll()
  }

  async function handleLoadFalconModels() {
    if (!llmForm.api_key) return
    setFalconLoading(true)
    try {
      const res = await getFalconModels({ api_key: llmForm.api_key, base_url: llmForm.base_url || undefined })
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
  const canProceed = connections.length > 0 && llmConnections.length > 0

  return (
    <div>
      {/* ── Jira Connections ── */}
      <div className="card">
        <h2>Jira Connection</h2>
        <p>Connect to your Jira instance to fetch requirements</p>

        {connections.map(c => (
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
                  <button className="btn-outline" onClick={() => {
                    setJiraForm({ name: c.name, url: c.url, email: c.email, api_token: '', source_type: c.source_type })
                    setEditingJira(c)
                    setShowJiraForm(true)
                    setExpandedJira(null)
                  }}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDeleteJira(c.name)}>Remove Connection</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!showJiraForm ? (
          <button className="btn-outline" onClick={() => setShowJiraForm(true)}>
            + Add New Connection
          </button>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Connection Name<span>*</span></label>
                <input placeholder="e.g., My Jira" value={jiraForm.name}
                  onChange={e => setJiraForm({ ...jiraForm, name: e.target.value })} />
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
                <label>Jira Email<span>*</span></label>
                <input type="email" placeholder="your-email@company.com" value={jiraForm.email}
                  onChange={e => setJiraForm({ ...jiraForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>API Token{!editingJira && <span>*</span>}</label>
                <input type="password" placeholder={editingJira ? 'Leave blank to keep existing token' : 'Your Jira API token'} value={jiraForm.api_token}
                  onChange={e => setJiraForm({ ...jiraForm, api_token: e.target.value })} />
                {editingJira
                  ? <span className="hint">Leave blank to keep the existing API token unchanged.</span>
                  : <span className="hint">Generate at: id.atlassian.com/manage-profile/security/api-tokens</span>
                }
              </div>
            </div>

            {jiraTestResult && (
              <div className={`alert ${jiraTestResult.success ? 'alert-success' : 'alert-error'}`}>
                {jiraTestResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-outline" onClick={handleTestJira} disabled={jiraTesting || !jiraForm.url || !jiraForm.email || !jiraForm.api_token}>
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

      {/* ── LLM Connections ── */}
      <div className="card">
        <h2>LLM Connection</h2>
        <p>Configure the AI model to generate your test plans</p>

        {llmConnections.map(c => (
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
                  <button className="btn-outline" onClick={() => {
                    setLlmForm({ name: c.name, provider: c.provider, model: c.model, api_key: '', base_url: c.base_url || '' })
                    setEditingLLM(c)
                    setShowLlmForm(true)
                    setExpandedLLM(null)
                  }}>Edit</button>
                  <button className="btn-danger" onClick={() => handleDeleteLLM(c.name)}>Remove Connection</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {!showLlmForm ? (
          <button className="btn-outline" onClick={() => setShowLlmForm(true)}>
            + Add LLM Connection
          </button>
        ) : (
          <div style={{ marginTop: 16 }}>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Connection Name<span>*</span></label>
                <input placeholder="e.g., My Claude" value={llmForm.name}
                  onChange={e => setLlmForm({ ...llmForm, name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Provider<span>*</span></label>
                <select value={llmForm.provider}
                  onChange={e => {
                    const p = e.target.value
                    setLlmForm({ ...llmForm, provider: p, model: p === 'falcon' ? FALCON_MODELS[0] : '' })
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
                    <select style={{ flex: 1 }} value={llmForm.model}
                      onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}>
                      {falconModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button type="button" className="btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
                      onClick={handleLoadFalconModels}
                      disabled={!llmForm.api_key || falconLoading}>
                      {falconLoading ? '...' : 'Load Models'}
                    </button>
                  </div>
                ) : (
                  <input placeholder={providerMeta?.modelPlaceholder || 'model name'}
                    value={llmForm.model}
                    onChange={e => setLlmForm({ ...llmForm, model: e.target.value })} />
                )}
              </div>
              {llmForm.provider === 'ollama' ? (
                <div className="form-group">
                  <label>Ollama Base URL</label>
                  <input placeholder="http://localhost:11434"
                    value={llmForm.base_url}
                    onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })} />
                </div>
              ) : (
                <div className="form-group">
                  <label>API Key{!editingLLM && <span>*</span>}</label>
                  <input type="password" placeholder={editingLLM ? 'Leave blank to keep existing key' : 'Your API key'}
                    value={llmForm.api_key}
                    onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })} />
                  {editingLLM && <span className="hint">Leave blank to keep the existing API key unchanged.</span>}
                </div>
              )}
            </div>
            {llmTestResult && (
              <div className={`alert ${llmTestResult.success ? 'alert-success' : 'alert-error'}`}>
                {llmTestResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button className="btn-outline" onClick={handleTestLLM} disabled={llmTesting || !llmForm.model}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={onNext} disabled={!canProceed}>
          Continue to Fetch Issues →
        </button>
      </div>
      {!canProceed && (
        <p style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
          Add at least one Jira connection and one LLM connection to continue.
        </p>
      )}
    </div>
  )
}
