/**
 * Step 1: Setup
 * Manage Jira connections and LLM connections.
 * Both have "Test Connection" buttons.
 */

import { useState, useEffect } from 'react'
import {
  getConnections, saveConnection, testJiraConnection, deleteConnection,
  getLLMConnections, saveLLMConnection, testLLMConnection, deleteLLMConnection,
} from '../api'

interface Props {
  onNext: () => void
}

const PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)', modelPlaceholder: 'claude-sonnet-4-6' },
  { value: 'groq', label: 'GROQ', modelPlaceholder: 'llama-3.3-70b-versatile' },
  { value: 'grok', label: 'Grok (xAI)', modelPlaceholder: 'grok-3-mini' },
  { value: 'ollama', label: 'Ollama (Local)', modelPlaceholder: 'llama3.2' },
  { value: 'falcon', label: 'Falcon AI', modelPlaceholder: 'tiiuae/falcon-40b-instruct' },
]

export default function Setup({ onNext }: Props) {
  // Jira connections state
  const [connections, setConnections] = useState<any[]>([])
  const [showJiraForm, setShowJiraForm] = useState(false)
  const [jiraForm, setJiraForm] = useState({ name: '', url: '', email: '', api_token: '', source_type: 'jira' })
  const [jiraTesting, setJiraTesting] = useState(false)
  const [jiraTestResult, setJiraTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [jiraSaving, setJiraSaving] = useState(false)

  // LLM connections state
  const [llmConnections, setLlmConnections] = useState<any[]>([])
  const [showLlmForm, setShowLlmForm] = useState(false)
  const [llmForm, setLlmForm] = useState({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
  const [llmTesting, setLlmTesting] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [llmSaving, setLlmSaving] = useState(false)

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
    setLlmForm({ name: '', provider: 'claude', api_key: '', model: '', base_url: '' })
    setLlmTestResult(null)
    await loadAll()
    setLlmSaving(false)
  }

  async function handleDeleteLLM(name: string) {
    await deleteLLMConnection(name)
    loadAll()
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
          <div className="connection-row" key={c.name}>
            <div className="connection-info">
              <span className="connection-name">{c.name}</span>
              <span className="connection-detail">{c.url} · {c.email}</span>
            </div>
            <div className="connection-actions">
              <span className={`badge ${c.source_type === 'ado' ? 'badge-warning' : 'badge-success'}`}>
                {c.source_type === 'ado' ? 'Coming Soon' : 'Connected'}
              </span>
              <button className="btn-danger" onClick={() => handleDeleteJira(c.name)}>Remove</button>
            </div>
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
                <label>API Token<span>*</span></label>
                <input type="password" placeholder="Your Jira API token" value={jiraForm.api_token}
                  onChange={e => setJiraForm({ ...jiraForm, api_token: e.target.value })} />
                <span className="hint">Generate at: id.atlassian.com/manage-profile/security/api-tokens</span>
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
                disabled={jiraSaving || !jiraForm.name || !jiraForm.url || !jiraForm.email || !jiraForm.api_token}>
                {jiraSaving ? 'Saving...' : 'Save Connection'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowJiraForm(false); setJiraTestResult(null) }}>
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
          <div className="connection-row" key={c.name}>
            <div className="connection-info">
              <span className="connection-name">{c.name}</span>
              <span className="connection-detail">{c.provider} · {c.model}</span>
            </div>
            <div className="connection-actions">
              <span className="badge badge-success">Connected</span>
              <button className="btn-danger" onClick={() => handleDeleteLLM(c.name)}>Remove</button>
            </div>
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
                  onChange={e => setLlmForm({ ...llmForm, provider: e.target.value, model: '' })}>
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Model<span>*</span></label>
                <input placeholder={providerMeta?.modelPlaceholder || 'model name'}
                  value={llmForm.model}
                  onChange={e => setLlmForm({ ...llmForm, model: e.target.value })} />
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
                  <label>API Key<span>*</span></label>
                  <input type="password" placeholder="Your API key"
                    value={llmForm.api_key}
                    onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })} />
                </div>
              )}
            </div>
            {llmForm.provider === 'falcon' && (
              <div className="form-row">
                <div className="form-group">
                  <label>Falcon Base URL <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(optional — leave blank for ai71.ai)</span></label>
                  <input placeholder="https://api.ai71.ai/v1  or  your internal Falcon endpoint"
                    value={llmForm.base_url}
                    onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })} />
                </div>
              </div>
            )}
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
                {llmSaving ? 'Saving...' : 'Save Connection'}
              </button>
              <button className="btn-secondary" onClick={() => { setShowLlmForm(false); setLlmTestResult(null) }}>
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
