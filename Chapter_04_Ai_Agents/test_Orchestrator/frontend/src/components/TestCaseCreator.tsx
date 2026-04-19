/**
 * Test Case Creator
 * 3-step wizard: Fetch Issues → Review → Generated Test Cases
 * Self-contained module — uses saved connections but manages its own state.
 */

import { useState, useEffect } from 'react'
import {
  getConnections, getLLMConnections, fetchIssues, generateTestCases,
} from '../api'
import axios from 'axios'

type TCStep = 1 | 2 | 3

interface Issue {
  key: string; summary: string; description: string
  issue_type: string; status: string; priority: string; component: string
}

interface TableSection {
  heading: string
  headers: string[]
  rows: string[][]
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function parseMarkdownTables(markdown: string): TableSection[] {
  const sections: TableSection[] = []
  const lines = markdown.split('\n')
  let currentHeading = ''
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.startsWith('#')) {
      currentHeading = line.replace(/^#+\s*/, '').trim()
      i++
      continue
    }
    if (line.startsWith('|') && i + 1 < lines.length && /^\|[-\s|:]+\|/.test(lines[i + 1].trim())) {
      const headers = line.split('|').slice(1, -1).map(h => h.trim())
      i += 2
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().split('|').slice(1, -1).map(c => c.trim())
        if (cells.length > 0) rows.push(cells)
        i++
      }
      if (rows.length > 0) sections.push({ heading: currentHeading, headers, rows })
      continue
    }
    i++
  }
  return sections
}

function escape(v: string) {
  return `"${(v || '').replace(/"/g, '""')}"`
}

function toZephyrCSV(headers: string[], rows: string[][]): string {
  const stepIdx = headers.findIndex(h => /step-by-step.*step$|^test script.*step$/i.test(h) || /^test.?step$/i.test(h))
  const expectedIdx = headers.findIndex(h => /expected.?result/i.test(h))

  const outHeaders = [...headers]

  const expandedRows: string[][] = []

  for (const row of rows) {
    const stepsRaw = stepIdx !== -1 ? (row[stepIdx] || '') : ''
    // Split on " / " separator that the LLM uses
    const steps = stepsRaw
      .split(/\s*\/\s*/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim()) // strip "1. " prefix
      .filter(Boolean)

    if (steps.length === 0) {
      expandedRows.push(row)
      continue
    }

    steps.forEach((stepText, idx) => {
      const isFirst = idx === 0
      const isLast = idx === steps.length - 1
      const newRow = row.map((cell, ci) => {
        if (ci === stepIdx) return stepText
        // Expected Result only on last step row
        if (ci === expectedIdx) return isLast ? cell : ''
        // All metadata only on the first step row; subsequent rows are blank
        return isFirst ? cell : ''
      })
      expandedRows.push(newRow)
    })
  }

  return [outHeaders, ...expandedRows].map(row => row.map(escape).join(',')).join('\r\n')
}

function deriveProjectKey(jiraIdsRaw: string): string {
  const first = jiraIdsRaw.split(',')[0].trim()
  return first ? first.replace(/-\d+$/, '').toUpperCase() : ''
}

export default function TestCaseCreator() {
  const [step, setStep] = useState<TCStep>(1)

  // Step 1 state
  const [jiraConns, setJiraConns] = useState<any[]>([])
  const [llmConns, setLlmConns] = useState<any[]>([])
  const [form, setForm] = useState({
    connectionName: '',
    llmConnectionName: '',
    productName: '',
    jiraIdsRaw: '',
  })
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])

  // Step 2 state
  const [additionalContext, setAdditionalContext] = useState('')
  const [dumpUsed, setDumpUsed] = useState('')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')

  // Step 3 state
  const [result, setResult] = useState<any>(null)
  const [tables, setTables] = useState<TableSection[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    Promise.all([getConnections(), getLLMConnections()]).then(([j, l]) => {
      const jc = j.data.connections || []
      const lc = l.data.connections || []
      setJiraConns(jc)
      setLlmConns(lc)
      if (jc.length) setForm(f => ({ ...f, connectionName: jc[0].name }))
      if (lc.length) setForm(f => ({ ...f, llmConnectionName: lc[0].name }))
    })
  }, [])

  // ── Step 1: Fetch Issues ─────────────────────────────────────────────────

  async function handleFetch() {
    if (!form.connectionName) {
      setFetchError('Select a Jira connection.')
      return
    }
    if (!form.jiraIdsRaw.trim()) {
      setFetchError('Enter at least one Jira ID (e.g. SCI-123).')
      return
    }
    const projectKey = deriveProjectKey(form.jiraIdsRaw)
    setFetchLoading(true)
    setFetchError('')
    try {
      const jiraIds = form.jiraIdsRaw.split(',').map(s => s.trim()).filter(Boolean)
      const res = await fetchIssues({
        connection_name: form.connectionName,
        product_name: form.productName,
        project_key: projectKey,
        jira_ids: jiraIds,
      })
      if (!res.data.success) { setFetchError(res.data.error || 'Failed to fetch.'); return }
      const fetched = res.data.issues || []
      if (!fetched.length) { setFetchError('No issues found for the given Jira IDs.'); return }
      setIssues(fetched)
      setStep(2)
    } catch (e: any) {
      setFetchError(e.response?.data?.detail || 'Fetch failed. Check connection and Jira IDs.')
    } finally { setFetchLoading(false) }
  }

  // ── Step 2: Generate ─────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!form.llmConnectionName) { setGenerateError('Select an LLM connection.'); return }
    if (!dumpUsed.trim()) { setGenerateError('Dump Used is required.'); return }
    setGenerateLoading(true)
    setGenerateError('')
    try {
      const images = await Promise.all(
        screenshots.map(file => new Promise<{ data: string; media_type: string }>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            const [header, data] = dataUrl.split(',')
            const media_type = header.match(/:(.*?);/)?.[1] || 'image/png'
            resolve({ data, media_type })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        }))
      )

      const res = await generateTestCases({
        llm_connection_name: form.llmConnectionName,
        issues,
        product_name: form.productName,
        project_key: deriveProjectKey(form.jiraIdsRaw),
        additional_context: additionalContext,
        dump_used: dumpUsed.trim(),
        images: images.length > 0 ? images : undefined,
      })
      setResult(res.data)

      const parsed = parseMarkdownTables(res.data.test_cases || '')
      setTables(parsed)
      const allKeys = new Set<string>()
      parsed.forEach((sec, si) => sec.rows.forEach((_, ri) => allKeys.add(`${si}-${ri}`)))
      setSelected(allKeys)

      setStep(3)
    } catch (e: any) {
      setGenerateError(e.response?.data?.detail || 'Generation failed. Try again.')
    } finally { setGenerateLoading(false) }
  }

  function handleScreenshotAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setScreenshots(prev => [...prev, ...files])
    e.target.value = ''
  }

  function handleScreenshotRemove(index: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }

  // ── Step 3: Selection helpers ─────────────────────────────────────────────

  function toggleRow(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleSection(si: number, rows: string[][]) {
    const keys = rows.map((_, ri) => `${si}-${ri}`)
    const allSelected = keys.every(k => selected.has(k))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
  }

  function toggleAll() {
    const allKeys: string[] = []
    tables.forEach((sec, si) => sec.rows.forEach((_, ri) => allKeys.push(`${si}-${ri}`)))
    const allSelected = allKeys.every(k => selected.has(k))
    setSelected(allSelected ? new Set() : new Set(allKeys))
  }

  // ── Step 3: Download .md ─────────────────────────────────────────────────

  async function handleDownloadMd() {
    if (!result?.export_paths) return
    setDownloading(true)
    const jiraIds = form.jiraIdsRaw.split(',').map(s => s.trim()).filter(Boolean).join('_')
    const exportName = `test_cases_${jiraIds}.md`
    try {
      const path = result.export_paths.markdown
      const API_BASE = 'http://localhost:8000'
      const res = await axios.get(`${API_BASE}/api/test-cases/download`, {
        params: { path },
        responseType: 'blob',
      })
      downloadBlob(res.data, exportName)
    } catch {
      const blob = new Blob([result.test_cases || ''], { type: 'text/markdown' })
      downloadBlob(blob, exportName)
    } finally { setDownloading(false) }
  }

  // ── Step 3: Export selected rows as CSV ──────────────────────────────────

  function handleExportCSV() {
    if (!tables.length) return
    const headers = tables[0].headers
    const selectedRows: string[][] = []
    tables.forEach((sec, si) => {
      sec.rows.forEach((row, ri) => {
        if (selected.has(`${si}-${ri}`)) selectedRows.push(row)
      })
    })
    if (!selectedRows.length) return
    const csv = toZephyrCSV(headers, selectedRows)
    downloadBlob(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }),
      `test_cases_${form.jiraIdsRaw.split(',').map((s: string) => s.trim()).filter(Boolean).join('_')}.csv`
    )
  }

  function handleRestart() {
    setStep(1)
    setIssues([])
    setResult(null)
    setTables([])
    setSelected(new Set())
    setAdditionalContext('')
    setDumpUsed('')
    setScreenshots([])
    setFetchError('')
    setGenerateError('')
  }

  const totalRows = tables.reduce((acc, sec) => acc + sec.rows.length, 0)
  const selectedCount = selected.size

  const tcSteps = ['1. Fetch Issues', '2. Review & Generate', '3. Test Cases']

  return (
    <div>
      {/* Stepper */}
      <nav className="stepper">
        {tcSteps.map((label, i) => {
          const num = (i + 1) as TCStep
          return (
            <div key={num}
              className={`step ${step === num ? 'active' : ''} ${step > num ? 'done' : ''}`}
              onClick={() => step > num && setStep(num)}>
              {label}
            </div>
          )
        })}
      </nav>

      {/* ── Step 1: Fetch Issues ── */}
      {step === 1 && (
        <div>
          <div className="card">
            <h2>Fetch Jira Issues</h2>
            <p>Select your connections and specify which Jira issues to create test cases for</p>

            <div className="form-row two-col">
              <div className="form-group">
                <label>Jira Connection<span>*</span></label>
                <select value={form.connectionName}
                  onChange={e => setForm({ ...form, connectionName: e.target.value })}>
                  <option value="">Select connection...</option>
                  {jiraConns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>LLM Connection<span>*</span></label>
                <select value={form.llmConnectionName}
                  onChange={e => setForm({ ...form, llmConnectionName: e.target.value })}>
                  <option value="">Select LLM...</option>
                  {llmConns.map(c => <option key={c.name} value={c.name}>{c.name} ({c.provider})</option>)}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Product Name</label>
                <input placeholder="e.g., Project Advantage"
                  value={form.productName}
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

            {fetchError && <div className="alert alert-error">{fetchError}</div>}

            <button className="btn-primary full-width" onClick={handleFetch}
              disabled={fetchLoading || !form.connectionName || !form.llmConnectionName || !form.jiraIdsRaw.trim()}>
              {fetchLoading
                ? <><span className="spinner" /> Fetching Issues...</>
                : '↓ Fetch Jira Issues'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review & Generate ── */}
      {step === 2 && (
        <div>
          <div className="card">
            <h2>Review Issues</h2>
            <p>Review the fetched issues — the AI will generate all possible test cases per issue</p>

            {/* Quality flags */}
            {issues.some(i => (i.description || '').length < 50) && (
              <div className="alert alert-warning" style={{ marginBottom: 16 }}>
                <strong>Quality Warnings:</strong>
                <ul style={{ margin: '6px 0 0 16px', fontSize: '0.82rem' }}>
                  {issues.filter(i => (i.description || '').length < 50).map(i => (
                    <li key={i.key + '-desc'}>{i.key}: Description is very short</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issue cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {issues.map(issue => (
                <div key={issue.key} style={{
                  border: '1px solid var(--border)', borderRadius: 8,
                  padding: '12px 14px', background: 'var(--connection-bg)'
                }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span className="badge badge-info">{issue.key}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-heading)' }}>{issue.summary}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>{issue.issue_type}</span>
                    <span>·</span>
                    <span>{issue.status}</span>
                    <span>·</span>
                    <span style={{ color: issue.priority === 'High' ? '#ef4444' : issue.priority === 'Medium' ? '#f59e0b' : 'var(--text-muted)' }}>
                      {issue.priority}
                    </span>
                    {issue.component && <><span>·</span><span style={{ color: 'var(--accent)' }}>{issue.component}</span></>}
                  </div>
                  {issue.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                      {issue.description.slice(0, 120)}{issue.description.length > 120 ? '...' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Dump Used — mandatory */}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label>Dump Used<span>*</span></label>
              <input
                placeholder=""
                value={dumpUsed}
                onChange={e => setDumpUsed(e.target.value)}
                style={{ borderColor: !dumpUsed.trim() ? 'var(--error, #ef4444)' : undefined }}
              />
              <span className="hint">The database dump / build used for this test run. Added as a column in every generated test case.</span>
            </div>

            {/* Additional context + screenshots */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 16, background: 'var(--connection-bg)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)', marginBottom: 12 }}>
                Additional Context &amp; Screenshots <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem' }}>(Optional)</span>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '0.8rem' }}>Testing Notes / Focus Areas</label>
                <textarea
                  placeholder="e.g., Focus on edge cases for the export flow. Test with large datasets (10k+ rows). Verify PowerPoint format compatibility. Check with expired sessions."
                  value={additionalContext}
                  onChange={e => setAdditionalContext(e.target.value)}
                  style={{ minHeight: 100 }}
                />
                <span className="hint">Describe testing goals, known issues, scope constraints, or specific scenarios to cover.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.8rem' }}>Screenshots / Attachments</label>
                <span className="hint" style={{ display: 'block', marginBottom: 8 }}>
                  Attach screenshots of the UI, designs, or error states. Vision-capable models (e.g. Claude) will analyze them to generate richer test cases.
                </span>

                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                  padding: '7px 14px', borderRadius: 6, border: '1px dashed var(--border)',
                  fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-card)',
                  transition: 'border-color 0.2s',
                }}>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleScreenshotAdd} />
                  + Add Screenshots
                </label>

                {screenshots.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                    {screenshots.map((file, idx) => (
                      <div key={idx} style={{
                        position: 'relative', width: 80, height: 80, borderRadius: 6,
                        overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-card)',
                      }}>
                        <img src={URL.createObjectURL(file)} alt={file.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button onClick={() => handleScreenshotRemove(idx)} style={{
                          position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                          borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.6)',
                          color: '#fff', fontSize: 11, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }} title="Remove">×</button>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, padding: '2px 4px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{file.name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {generateError && <div className="alert alert-error">{generateError}</div>}

            <button className="btn-primary full-width" onClick={handleGenerate} disabled={generateLoading || !dumpUsed.trim()}>
              {generateLoading
                ? <><span className="spinner" /> Generating Test Cases...</>
                : `✦ Generate Test Cases for ${issues.length} issue${issues.length !== 1 ? 's' : ''}${screenshots.length > 0 ? ` + ${screenshots.length} screenshot${screenshots.length !== 1 ? 's' : ''}` : ''}`}
            </button>
          </div>

          <div className="nav-buttons">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Test Cases Result ── */}
      {step === 3 && result && (
        <div>
          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, marginBottom: 16,
            padding: '12px 16px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 10,
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="badge badge-success">Generated</span>
              {form.productName && (
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                  {form.productName}
                </span>
              )}
              <span className="badge badge-info">{deriveProjectKey(form.jiraIdsRaw)}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedCount} of {totalRows} test cases selected
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" onClick={handleDownloadMd} disabled={downloading}>
                {downloading ? 'Downloading...' : '⬇ Download .md'}
              </button>
              <button
                className="btn-primary"
                onClick={handleExportCSV}
                disabled={selectedCount === 0}
                title={selectedCount === 0 ? 'Select at least one test case' : `Export ${selectedCount} selected test cases as CSV`}>
                ⬇ Export CSV ({selectedCount})
              </button>
            </div>
          </div>

          {/* Test case tables with checkboxes */}
          <div className="card" style={{ padding: '20px 24px' }}>
            {/* Global select-all */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <input
                type="checkbox"
                id="select-all"
                checked={totalRows > 0 && selectedCount === totalRows}
                ref={el => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < totalRows }}
                onChange={toggleAll}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="select-all" style={{ fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-heading)' }}>
                Select All Test Cases
              </label>
            </div>

            {tables.map((sec, si) => {
              const sectionKeys = sec.rows.map((_, ri) => `${si}-${ri}`)
              const allChecked = sectionKeys.every(k => selected.has(k))
              const someChecked = sectionKeys.some(k => selected.has(k))

              return (
                <div key={si} style={{ marginBottom: 28 }}>
                  {/* Section heading with select-all for this section */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      id={`sec-${si}`}
                      checked={allChecked}
                      ref={el => { if (el) el.indeterminate = !allChecked && someChecked }}
                      onChange={() => toggleSection(si, sec.rows)}
                      style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <label htmlFor={`sec-${si}`} style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)', cursor: 'pointer' }}>
                      {sec.heading}
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ({sectionKeys.filter(k => selected.has(k)).length}/{sec.rows.length} selected)
                    </span>
                  </div>

                  {/* Table */}
                  <div className="markdown-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 36, textAlign: 'center' }}></th>
                          {sec.headers.map((h, hi) => <th key={hi}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((row, ri) => {
                          const key = `${si}-${ri}`
                          const isChecked = selected.has(key)
                          return (
                            <tr key={ri} style={{ background: isChecked ? 'var(--bg-stepper)' : undefined }}
                              onClick={() => toggleRow(key)}>
                              <td style={{ textAlign: 'center', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRow(key)}
                                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                                />
                              </td>
                              {row.map((cell, ci) => (
                                <td key={ci}>{cell}</td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="nav-buttons" style={{ marginTop: 16 }}>
            <button className="btn-secondary" onClick={() => setStep(2)}>← Back to Review</button>
            <button className="btn-primary" onClick={handleRestart}>Start Over</button>
          </div>
        </div>
      )}
    </div>
  )
}
