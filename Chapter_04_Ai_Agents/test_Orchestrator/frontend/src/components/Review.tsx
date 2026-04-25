/**
 * Step 3: Review
 * Show fetched issues, missing info flags, allow adding context, then generate.
 */

import { useState, useRef } from 'react'
import { generateTestPlan } from '../api'
import type { FetchState } from '../App'

interface ScreenshotItem {
  name: string
  data: string
  media_type: string
  preview: string
}

interface Props {
  fetchState: FetchState
  setFetchState: (s: FetchState) => void
  onGenerated: (result: object) => void
  onBack: () => void
}

export default function Review({ fetchState, setFetchState, onGenerated, onBack }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [additionalContext, setAdditionalContext] = useState(fetchState.additionalContext || '')
  const [screenshots, setScreenshots] = useState<ScreenshotItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { issues, llmConnectionName, productName, projectKey } = fetchState

  // Compute missing info flags (Rule 2 from gemini.md — client-side preview)
  const flags: string[] = []
  issues.forEach(issue => {
    if (!issue.description?.trim() || issue.description.trim().length < 50) {
      flags.push(`${issue.key}: Description is very short or missing.`)
    }
  })

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        const media_type = file.type as string
        setScreenshots(prev => [...prev, {
          name: file.name,
          data: base64,
          media_type,
          preview: result,
        }])
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeScreenshot(idx: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== idx))
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageItems = Array.from(e.clipboardData?.items || []).filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()
    imageItems.forEach(item => {
      const blob = item.getAsFile()
      if (!blob) return
      const reader = new FileReader()
      reader.onload = ev => {
        const result = ev.target?.result as string
        setScreenshots(prev => [...prev, {
          name: `pasted-${Date.now()}.png`,
          data: result.split(',')[1],
          media_type: blob.type || 'image/png',
          preview: result,
        }])
      }
      reader.readAsDataURL(blob)
    })
  }

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await generateTestPlan({
        llm_connection_name: llmConnectionName,
        issues,
        product_name: productName,
        project_key: projectKey,
        additional_context: additionalContext,
      })
      onGenerated(res.data)
    } catch (e: any) {
      const detail = e.response?.data?.detail
      setError(detail || 'Generation failed. Please try again.')
    }
    setGenerating(false)
  }

  return (
    <div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            {(() => {
              const types = [...new Set(issues.map(i => i.issue_type).filter(Boolean))]
              const label = types.length === 1 ? `${types[0]}s` : 'Items'
              return (
                <>
                  <h2>Review Jira {label} ({issues.length})</h2>
                  <p style={{ marginBottom: 0 }}>{label} that will be used to generate the test plan</p>
                </>
              )
            })()}
          </div>
          <span className="badge badge-info">{projectKey}</span>
        </div>

        {/* Missing info warnings */}
        {flags.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <strong>Quality warnings — add context below to improve results:</strong>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              {flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}

        {/* Issue cards */}
        {issues.map(issue => (
          <div key={issue.key} style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 10,
            background: 'var(--connection-bg)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--accent)' }}>{issue.key}</span>
                <span style={{ marginLeft: 8, fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{issue.summary}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                <span className="badge badge-info">{issue.issue_type}</span>
                <span className="badge badge-warning">{issue.status}</span>
                {issue.priority && <span className="badge" style={{ background: 'var(--bg-stepper)', color: 'var(--text-muted)' }}>{issue.priority}</span>}
                {issue.component && <span className="badge" style={{ background: 'var(--bg-stepper)', color: 'var(--accent)' }}>{issue.component}</span>}
              </div>
            </div>
            {issue.description && (
              <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {issue.description.slice(0, 200)}{issue.description.length > 200 ? '...' : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Additional Context & Screenshots */}
      <div className="card">
        <h2>Additional Context & Screenshots</h2>
        <p>Add context or screenshots to improve test plan quality</p>

        <div className="form-group">
          <label>Focus Areas</label>
          <textarea
            value={additionalContext}
            onChange={e => setAdditionalContext(e.target.value)}
            onPaste={handlePaste}
            style={{ minHeight: 120 }}
          />
        </div>

        <div className="form-group" style={{ marginTop: 16 }} onPaste={handlePaste}>
          <label>Screenshots / Attachments</label>
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: '10px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--connection-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span style={{ fontSize: '1.1rem' }}>📎</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Click to upload screenshots (PNG, JPG, GIF, WebP) &nbsp;·&nbsp; or paste (Ctrl+V)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </div>

          {screenshots.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              {screenshots.map((s, i) => (
                <div key={i} style={{ position: 'relative', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', width: 120 }}>
                  <img src={s.preview} alt={s.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                  <div style={{ padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <button
                    onClick={() => removeScreenshot(i)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, color: '#fff', cursor: 'pointer', fontSize: '0.7rem', lineHeight: '20px', padding: 0 }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <button className="btn-primary full-width" onClick={handleGenerate} disabled={generating}>
        {generating
          ? <><span className="spinner" /> Generating Test Plan with AI...</>
          : '⊙ Generate Test Plan'}
      </button>

      <div className="nav-buttons">
        <button className="btn-secondary" onClick={onBack}>← Back</button>
      </div>
    </div>
  )
}
