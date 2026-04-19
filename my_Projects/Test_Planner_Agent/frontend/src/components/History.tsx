import { useState, useEffect } from 'react'
import { getHistory, downloadHistoryMarkdown, downloadHistoryDoc, deleteHistoryRecord } from '../api'

interface Props { onBack: () => void }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function History({ onBack }: Props) {
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    getHistory().then(res => setHistory(res.data.history || [])).finally(() => setLoading(false))
  }, [])

  async function handleDownloadMd(record: any) {
    setDownloading(`${record.id}-md`)
    try {
      const res = await downloadHistoryMarkdown(record.id)
      downloadBlob(new Blob([res.data], { type: 'text/markdown' }),
        `test_plan_${record.project_key}_${record.created_at.slice(0,10)}.md`)
    } finally { setDownloading(null) }
  }

  async function handleDelete(record: any) {
    if (!window.confirm(`Delete test plan for ${record.project_key}? This removes the history entry only — generated files are kept.`))
      return
    setDeleting(record.id)
    try {
      await deleteHistoryRecord(record.id)
      setHistory(h => h.filter(r => r.id !== record.id))
    } finally { setDeleting(null) }
  }

  async function handleDownloadDoc(record: any) {
    setDownloading(`${record.id}-doc`)
    try {
      const res = await downloadHistoryDoc(record.id)
      downloadBlob(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        `test_plan_${record.project_key}_${record.created_at.slice(0,10)}.docx`
      )
    } finally { setDownloading(null) }
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="app-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
              <line x1="12" y1="3" x2="12" y2="7"/>
            </svg>
          </div>
          <div>
            <h1>Test Plan History</h1>
            <p>Previously generated test plans — click to download</p>
          </div>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Back to Agent</button>
      </header>

      <div className="card">
        {loading && <p style={{ color: 'var(--text-muted)' }}>Loading history...</p>}
        {!loading && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📋</div>
            <p>No test plans generated yet.</p>
          </div>
        )}
        {history.map(h => (
          <div key={h.id} style={{
            border: '1px solid var(--border)', borderRadius: 10,
            padding: '14px 18px', marginBottom: 12, background: 'var(--connection-bg)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  {h.product_name && h.product_name !== h.project_key && (
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-heading)' }}>{h.product_name}</span>
                  )}
                  <span className="badge badge-info">{h.project_key}</span>
                </div>
                {h.issue_keys?.length > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginBottom: 4, fontWeight: 500 }}>
                    {h.issue_keys.join(', ')}
                  </div>
                )}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {h.issues_count} issue{h.issues_count !== 1 ? 's' : ''} · {new Date(h.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn-outline" onClick={() => handleDownloadMd(h)}
                  disabled={!!downloading || !!deleting}>
                  {downloading === `${h.id}-md` ? 'Downloading...' : '⬇ .md'}
                </button>
                <button className="btn-outline" onClick={() => handleDownloadDoc(h)}
                  disabled={!!downloading || !!deleting}>
                  {downloading === `${h.id}-doc` ? 'Downloading...' : '⬇ .docx'}
                </button>
                <button className="btn-danger" onClick={() => handleDelete(h)}
                  disabled={!!deleting || !!downloading}
                  title="Delete this history record">
                  {deleting === h.id ? '...' : '🗑'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
