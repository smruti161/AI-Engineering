import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { exportDoc, exportDocFromHtml } from '../api'
import './TestPlan.css'

interface Props {
  result: any
  coverage?: string
  onBack: () => void
  onRestart: () => void
}

interface RowOverlay {
  /** top offset in px relative to the editor wrapper */
  rowTop: number
  rowHeight: number
  isLastDataRow: boolean
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function TestPlan({ result, coverage, onBack, onRestart }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [savedHtml, setSavedHtml] = useState<string | null>(null)
  const [editHtml, setEditHtml] = useState<string>('')
  const [rowOverlay, setRowOverlay] = useState<RowOverlay | null>(null)
  const [showSuccess] = useState(true)
  const viewRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const hoveredTrRef = useRef<HTMLTableRowElement | null>(null)

  // ── Row overlay helpers ────────────────────────────────────────────────────

  function updateOverlay(tr: HTMLTableRowElement | null) {
    if (!tr || !wrapRef.current) { setRowOverlay(null); return }
    if (tr.closest('thead')) { setRowOverlay(null); return }

    hoveredTrRef.current = tr
    const tbody = tr.parentElement
    const dataRows = tbody?.querySelectorAll('tr')
    const isLastDataRow = !!dataRows && tr === dataRows[dataRows.length - 1]

    const wrapRect = wrapRef.current.getBoundingClientRect()
    const trRect = tr.getBoundingClientRect()
    setRowOverlay({
      rowTop: trRect.top - wrapRect.top,
      rowHeight: trRect.height,
      isLastDataRow,
    })
  }

  function handleEditorMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    let el = e.target as HTMLElement | null
    while (el && el.tagName !== 'TR') el = el.parentElement
    updateOverlay(el as HTMLTableRowElement | null)
  }

  function handleEditorMouseLeave() {
    setRowOverlay(null)
    hoveredTrRef.current = null
  }

  // ── Row insert / delete ────────────────────────────────────────────────────

  function insertRowBelow() {
    const tr = hoveredTrRef.current
    if (!tr) return
    const newTr = tr.cloneNode(true) as HTMLTableRowElement
    // Give each cell a <br> so the row has visible height and is editable
    newTr.querySelectorAll('td, th').forEach(td => {
      const el = td as HTMLElement
      el.innerHTML = '<br>'
    })
    tr.after(newTr)
    // Place cursor in first cell
    const firstCell = newTr.querySelector('td') as HTMLElement | null
    if (firstCell) {
      firstCell.focus()
      const range = document.createRange()
      range.selectNodeContents(firstCell)
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
    // Re-calc overlay so + stays on the new last row
    setTimeout(() => updateOverlay(newTr), 0)
  }

  function deleteRow() {
    const tr = hoveredTrRef.current
    if (!tr) return
    const tbody = tr.parentElement
    const rows = tbody?.querySelectorAll('tr')
    if (!rows || rows.length <= 1) return // keep at least 1 data row
    const prevTr = tr.previousElementSibling as HTMLTableRowElement | null
    tr.remove()
    hoveredTrRef.current = null
    setRowOverlay(null)
    if (prevTr && prevTr.tagName === 'TR' && !prevTr.closest('thead')) {
      updateOverlay(prevTr)
      hoveredTrRef.current = prevTr
    }
  }

  // ── Edit toggle ────────────────────────────────────────────────────────────

  function toggleEdit() {
    if (isEditing) {
      if (editRef.current) setSavedHtml(editRef.current.innerHTML)
      setIsEditing(false)
      setRowOverlay(null)
    } else {
      const html = savedHtml ?? viewRef.current?.innerHTML ?? ''
      setEditHtml(html)
      setIsEditing(true)
    }
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!result) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>📋</div>
        <h2>No test plan generated yet</h2>
        <p>Complete the previous steps to generate your test plan</p>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={onBack}>← Go Back</button>
      </div>
    )
  }

  const { metadata, test_plan_markdown } = result
  const dateStr = new Date().toISOString().slice(0, 10)
  // Use first issue key (e.g. MIL-5941) so the filename carries the ticket reference
  const ticketRef = metadata.issue_keys?.[0] || metadata.jira_project
  const baseName = `test_plan_${ticketRef}_${dateStr}`

  async function handleDownloadDoc() {
    // If the user has edited the plan, use the live HTML so edits are reflected
    const editedHtml = isEditing
      ? editRef.current?.innerHTML ?? ''
      : savedHtml ?? ''

    if (editedHtml) {
      const res = await exportDocFromHtml({
        html: editedHtml,
        project_key: metadata.jira_project,
        filename: baseName,
      })
      downloadBlob(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        `${baseName}.docx`
      )
    } else {
      // No edits — use the server-cached original
      const res = await exportDoc()
      downloadBlob(
        new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        `${baseName}.docx`
      )
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Meta bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-success">Generated</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <strong>
                {metadata.product_name && metadata.product_name !== metadata.jira_project
                  ? metadata.product_name
                  : metadata.issue_keys?.length
                    ? metadata.issue_keys.join(', ')
                    : metadata.jira_project}
              </strong>
              &nbsp;·&nbsp;{metadata.issues_count} issue{metadata.issues_count !== 1 ? 's' : ''}
              &nbsp;·&nbsp;{new Date(metadata.generated_at).toLocaleString()}
            </span>
            {coverage && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Coverage: <strong style={{ color: 'var(--text)' }}>{coverage}</strong>
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                className="btn-outline"
                onClick={toggleEdit}
                style={isEditing ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
              >
                {isEditing ? '✓ Done Editing' : '✎ Edit'}
              </button>
              <button
                className="btn-outline"
                onClick={isEditing ? undefined : handleDownloadDoc}
                disabled={isEditing}
                style={isEditing ? { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' } : undefined}
              >⬇ Download .docx</button>
            </div>
            {isEditing && (
              <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                ⚠ Click ✓ Done Editing to save before downloading
              </span>
            )}
          </div>
        </div>

        {metadata.section_warnings?.length > 0 && (
          <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
            <strong>Some template sections may be incomplete:</strong>{' '}
            {metadata.section_warnings.join(', ')}
          </div>
        )}

        {metadata.missing_info_flags?.length > 0 && (
          <div className="alert alert-warning" style={{ marginTop: 8, marginBottom: 0 }}>
            <strong>Missing info flagged by AI:</strong>
            <ul style={{ marginTop: 4, paddingLeft: 20 }}>
              {metadata.missing_info_flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}

        {showSuccess && (
          <div style={{
            marginTop: 12, marginBottom: 0, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)',
            color: '#15803d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
            </svg>
            Test plan generated successfully! Review the plan below, edit if needed, then download.
          </div>
        )}
      </div>

      {/* Editor / viewer — wrapped for overlay positioning */}
      <div
        ref={wrapRef}
        style={{ position: 'relative' }}
        onMouseMove={isEditing ? handleEditorMouseMove : undefined}
        onMouseLeave={isEditing ? handleEditorMouseLeave : undefined}
      >
        {isEditing ? (
          <div
            ref={editRef}
            className="card test-plan-body"
            contentEditable
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: editHtml }}
            style={{ outline: '2px solid var(--accent)', cursor: 'text', minHeight: 300 }}
          />
        ) : (
          // ── Read-only view ──────────────────────────────────────────────────
          <div style={{ position: 'relative' }}>
            {/* Read-only badge */}
            <div style={{
              position: 'absolute', top: 16, right: 24, zIndex: 5,
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: '0.72rem', color: 'var(--text-muted)',
              background: 'var(--bg-stepper)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '2px 10px', userSelect: 'none',
              pointerEvents: 'none',
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Read Only — click ✎ Edit to modify
            </div>

            {savedHtml ? (
              <div
                ref={viewRef}
                className="card test-plan-body"
                dangerouslySetInnerHTML={{ __html: savedHtml }}
                style={{ cursor: 'default' }}
              />
            ) : (
              <div ref={viewRef} className="card test-plan-body" style={{ cursor: 'default' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{test_plan_markdown}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Row action overlay — shown only in edit mode on table row hover */}
        {isEditing && rowOverlay && (
          // stopPropagation prevents mouse-over the buttons from firing the
          // wrapper's onMouseMove (which would find no TR and hide the overlay)
          <div
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 20 }}
            onMouseMove={e => e.stopPropagation()}
          >
            {/* Delete (×) — right edge of the hovered row */}
            {/* Delete (×) — right edge of the hovered row */}
            <button
              onMouseDown={e => { e.preventDefault(); deleteRow() }}
              title="Delete this row"
              style={{
                position: 'absolute',
                top: rowOverlay.rowTop + rowOverlay.rowHeight / 2 - 10,
                right: 28,
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: '1px solid #ef4444',
                background: '#fff',
                color: '#ef4444',
                fontSize: '0.75rem',
                lineHeight: '18px',
                textAlign: 'center',
                cursor: 'pointer',
                padding: 0,
                pointerEvents: 'auto',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
              }}
            >×</button>

            {/* Insert (+) — centered below the last data row only */}
            {rowOverlay.isLastDataRow && (
              <button
                onMouseDown={e => { e.preventDefault(); insertRowBelow() }}
                title="Insert row below"
                style={{
                  position: 'absolute',
                  top: rowOverlay.rowTop + rowOverlay.rowHeight - 11,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '1.5px solid var(--accent)',
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: '1rem',
                  lineHeight: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  pointerEvents: 'auto',
                  boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
                }}
              >+</button>
            )}
          </div>
        )}
      </div>

      <div className="nav-buttons">
        <button className="btn-secondary" onClick={onBack}>← Back to Review</button>
        <button className="btn-secondary" onClick={onRestart}>Start Over</button>
      </div>
    </div>
  )
}
