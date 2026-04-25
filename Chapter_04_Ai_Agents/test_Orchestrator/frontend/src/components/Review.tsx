/**
 * Step 3: Review
 * Show fetched issues, missing info flags, allow adding context, then generate.
 */

import React, { useState, useRef } from 'react'
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

  const { issues, llmConnectionName, productName, projectKey, epics = [], childrenMap = {} } = fetchState

  // Determine which issues to display in the review table:
  // - All epics that were fetched
  // - Any non-epic issues that are NOT children of a fetched epic (standalone items)
  const childKeys = new Set(Object.values(childrenMap).flat().map(c => c.key))
  const epicKeys = new Set(epics.map(e => e.key))
  const standaloneIssues = issues.filter(i => !epicKeys.has(i.key) && !childKeys.has(i.key))
  const reviewIssues = [...epics, ...standaloneIssues]

  // Track which epics are expanded to show children inline
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())

  function toggleEpic(key: string) {
    setExpandedEpics(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
      const allChildren = Object.values(childrenMap).flat()
      const res = await generateTestPlan({
        llm_connection_name: llmConnectionName,
        issues: reviewIssues,
        child_issues: allChildren.length > 0 ? allChildren : undefined,
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
            <h2>Review Jira Items ({reviewIssues.length})</h2>
            <p style={{ marginBottom: 0 }}>
              Items that will be used to generate the test plan
              {Object.keys(childrenMap).length > 0 && (
                <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: '0.8rem' }}>
                  · {issues.length - reviewIssues.length} child work items fetched (expandable below)
                </span>
              )}
            </p>
          </div>
          <span className="badge badge-info">{projectKey}</span>
        </div>

        {/* Issue table — epics + standalone items, children expand inline */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-stepper)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)' }}>Key</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)' }}>Summary</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)' }}>Type</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)' }}>Status</th>
              <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border)' }}>Child Items</th>
            </tr>
          </thead>
          <tbody>
            {reviewIssues.map((issue, idx) => {
              const children = childrenMap[issue.key] || []
              const isExpanded = expandedEpics.has(issue.key)
              return (
                <React.Fragment key={issue.key}>
                  <tr style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--connection-bg)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{issue.key}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>{issue.summary}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      <span className="badge badge-info">{issue.issue_type}</span>
                    </td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>{issue.status}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                      {children.length > 0 ? (
                        <button
                          onClick={() => toggleEpic(issue.key)}
                          style={{
                            background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                            padding: '2px 8px', cursor: 'pointer', fontSize: '0.78rem',
                            color: 'var(--accent)', whiteSpace: 'nowrap',
                          }}
                        >
                          {isExpanded ? '▲' : '▼'} {children.length} item{children.length !== 1 ? 's' : ''}
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                  {isExpanded && children.map(child => (
                    <tr key={child.key} style={{ background: 'var(--connection-bg)' }}>
                      <td style={{ padding: '6px 12px 6px 28px', color: 'var(--accent)', fontSize: '0.8rem', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>↳</span>{child.key}
                      </td>
                      <td style={{ padding: '6px 12px', color: 'var(--text-muted)', fontSize: '0.8rem', borderBottom: '1px solid var(--border)' }}>{child.summary}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>{child.issue_type}</span>
                      </td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{child.status}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }} />
                    </tr>
                  ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
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
