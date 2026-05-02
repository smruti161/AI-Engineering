/**
 * Test Case Creator
 * 3-step wizard: Fetch Issues → Review → Generated Test Cases
 * Self-contained module — uses saved connections but manages its own state.
 */

import { useState, useEffect, useRef } from 'react'
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

// Resize + compress an image File to max 1280 px on the longest side, JPEG 0.85 quality.
// Returns { data: base64, media_type } ready for the backend.
function compressImage(file: File): Promise<{ data: string; media_type: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      try {
        URL.revokeObjectURL(objectUrl)

        let { width, height } = img
        if (!width || !height) {
          reject(new Error(`Image "${file.name}" has invalid dimensions (${width}×${height})`))
          return
        }

        const MAX = 1280
        if (width > MAX || height > MAX) {
          if (width >= height) { height = Math.round((height * MAX) / width); width = MAX }
          else { width = Math.round((width * MAX) / height); height = MAX }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable — cannot compress image'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const base64 = dataUrl.split(',')[1]
        if (!base64) {
          reject(new Error(`Failed to encode "${file.name}" as JPEG`))
          return
        }
        resolve({ data: base64, media_type: 'image/jpeg' })
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Could not load image "${file.name}" — unsupported format?`))
    }

    img.src = objectUrl
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function parseMarkdownTables(markdown: string): TableSection[] {
  const sections: TableSection[] = []
  // Strip wrapping code-fence lines (``` or ```markdown etc.) so accidental fences don't hide tables
  const lines = markdown
    .split('\n')
    .filter(l => !/^```/.test(l.trim()))
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

// Convert "1. item / 2. item / 3. item" to "item\nitem\nitem" for multi-line cell display in Excel
function expandToLines(v: string): string {
  if (!v) return v
  // Numbered list format: "1. cond / 2. cond"
  if (/^\d+\.\s/.test(v.trim())) {
    return v.split(/\s+\/\s+/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).join('\n')
  }
  return v
}

// For Precondition: split on " / " regardless of numbering, so each condition is on its own line
function expandPrecondition(v: string): string {
  if (!v) return v
  if (/^\d+\.\s/.test(v.trim())) {
    return v.split(/\s+\/\s+/).map(s => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).join('\n')
  }
  // Plain text with ". " separator — split into lines
  return v.split(/\.\s+/).map(s => s.trim()).filter(Boolean).map(s => s.endsWith('.') ? s : s + '.').join('\n').replace(/\.\n/g, '\n').replace(/\.$/, '')
}

function toZephyrCSV(headers: string[], rows: string[][]): string {
  const stepIdx = headers.findIndex(h => /step-by-step.*step$|^test script.*step$/i.test(h) || /^test.?step$/i.test(h))
  const expectedIdx = headers.findIndex(h => /expected.?result/i.test(h))
  const testDataIdx = headers.findIndex(h => /test.?data/i.test(h))
  const preconditionIdx = headers.findIndex(h => /precondition/i.test(h))

  const outHeaders = [...headers]

  const expandedRows: string[][] = []

  for (const row of rows) {
    const stepsRaw = stepIdx !== -1 ? (row[stepIdx] || '') : ''
    const steps = stepsRaw
      .split(/\s+\/\s+/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)

    if (steps.length === 0) {
      expandedRows.push(row.map((cell, ci) => {
        if (ci === preconditionIdx) return expandPrecondition(cell)
        return cell
      }))
      continue
    }

    const expectedRaw = expectedIdx !== -1 ? (row[expectedIdx] || '') : ''
    const expectedParts = expectedRaw
      .split(/\s+\/\s+/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)

    const testDataRaw = testDataIdx !== -1 ? (row[testDataIdx] || '') : ''
    const testDataParts = testDataRaw
      .split(/\s+\/\s+/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean)

    steps.forEach((stepText, idx) => {
      const isFirst = idx === 0
      const newRow = row.map((cell, ci) => {
        if (ci === stepIdx) return stepText
        if (ci === expectedIdx) {
          if (expectedParts.length > 1) return expectedParts[idx] ?? ''
          // single expected result — repeat on every step row
          return expectedParts[0] ?? (isFirst ? cell : '')
        }
        if (ci === testDataIdx) {
          if (testDataParts.length > 1) return testDataParts[idx] ?? ''
          // single test data value (e.g. "N/A") — repeat on every step row
          return testDataParts[0] ?? (isFirst ? cell : '')
        }
        // Precondition: expand to multiline on first step row only
        if (ci === preconditionIdx) return isFirst ? expandPrecondition(cell) : ''
        return isFirst ? cell : ''
      })
      expandedRows.push(newRow)
    })
  }

  return [outHeaders, ...expandedRows].map(row => row.map(escape).join(',')).join('\r\n')
}

// ── Edit-mode helpers ────────────────────────────────────────────────────────

function isNumberedList(value: string): boolean {
  return /^\d+\.\s/.test(value.trim()) && /\s+\/\s+/.test(value)
}

// "1. step one / 2. step two" → "step one\nstep two"
function toEditDisplay(value: string): string {
  if (!isNumberedList(value)) return value
  return value
    .split(/\s+\/\s+/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .join('\n')
}

// "step one\nstep two\nnew step" → "1. step one / 2. step two / 3. new step"
function fromEditLines(display: string, wasNumbered: boolean): string {
  const lines = display.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return ''
  if (!wasNumbered && lines.length === 1) return lines[0]
  return lines.map((l, i) => `${i + 1}. ${l}`).join(' / ')
}

// ── Read-only cell renderer: splits "1. a / 2. b" into numbered lines ────────
// originalValue: display-format original (lines joined by \n) — used to highlight new lines in green
// onLineClick: when provided (edit mode), each line is clickable; receives (lineIndex, caretOffset)
function renderCell(
  value: string,
  originalValue?: string,
  onLineClick?: (li: number, caretOffset?: number) => void,
): React.ReactNode {
  function captureClick(e: React.MouseEvent, li: number) {
    e.stopPropagation()
    onLineClick!(li, -1)
  }

  if (!isNumberedList(value)) {
    const isEdited = originalValue !== undefined && value !== originalValue
    return (
      <span
        style={{
          background: isEdited ? 'rgba(34,197,94,0.12)' : undefined,
          color: isEdited ? '#15803d' : undefined,
          borderRadius: isEdited ? 3 : undefined,
          padding: isEdited ? '0 2px' : undefined,
          cursor: onLineClick ? 'text' : undefined,
        }}
        onClick={onLineClick ? e => captureClick(e, 0) : undefined}
      >
        {value}
      </span>
    )
  }

  const lines = value
    .split(/\s+\/\s+/)
    .map(s => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)

  const originalSet = originalValue
    ? new Set(originalValue.split('\n').map(l => l.trim()).filter(Boolean))
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.map((line, i) => {
        const isNew = originalSet !== null && !originalSet.has(line)
        return (
          <div
            key={i}
            style={{
              display: 'flex', gap: 4,
              cursor: onLineClick ? 'text' : 'default',
              background: isNew ? 'rgba(34,197,94,0.12)' : undefined,
              borderRadius: isNew ? 3 : undefined,
              padding: isNew ? '0 2px' : undefined,
            }}
            onClick={onLineClick ? e => captureClick(e, i) : undefined}
          >
            <span style={{ color: isNew ? '#15803d' : 'var(--text-muted)', minWidth: 16, flexShrink: 0, fontSize: '0.78rem' }}>
              {i + 1}.
            </span>
            <span style={{ color: isNew ? '#15803d' : undefined }}>{line}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Line-by-line editor with green highlight for new/changed lines ────────────
// focusLine:   which line index to focus on mount
// focusCursor: character offset to place the cursor (-1 = end of line)
function LineEditor({
  value,
  originalValue,
  isNumbered = true,
  onChange,
  onCommit,
  focusLine = 0,
  focusCursor = -1,
}: {
  value: string
  originalValue: string
  isNumbered?: boolean
  onChange: (v: string) => void
  onCommit: () => void
  focusLine?: number
  focusCursor?: number
}) {
  const historyRef = useRef<string[]>([])
  const valueRef = useRef(value)
  const linesRef = useRef<string[]>([])
  // Set true before any programmatic focus() to prevent onBlur → onCommit
  const skipBlurRef = useRef(false)

  const originalSet = new Set(
    originalValue.split('\n').map(l => l.trim()).filter(Boolean)
  )
  const lines = value.split('\n')
  linesRef.current = lines

  // Focus the correct textarea and place cursor where the user clicked
  useEffect(() => {
    const inputs = document.querySelectorAll<HTMLTextAreaElement>('.line-editor-input')
    const target = inputs[focusLine]
    if (!target) return
    skipBlurRef.current = true
    target.focus()
    skipBlurRef.current = false
    const end = target.value.length
    const pos = focusCursor >= 0 ? Math.min(focusCursor, end) : end
    target.setSelectionRange(pos, pos)
  }, []) // intentionally runs only on mount

  function pushHistory(prev: string) {
    historyRef.current.push(prev)
    if (historyRef.current.length > 100) historyRef.current.shift()
  }

  function moveFocus(targetIdx: number) {
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLTextAreaElement>('.line-editor-input')
      const next = inputs[targetIdx]
      if (!next) return
      skipBlurRef.current = true
      next.focus()
      skipBlurRef.current = false
    }, 0)
  }

  function updateLine(i: number, text: string) {
    const current = linesRef.current
    pushHistory(valueRef.current)
    const next = [...current]
    next[i] = text
    const newVal = next.join('\n')
    valueRef.current = newVal
    linesRef.current = next
    onChange(newVal)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      e.stopPropagation()
      const prev = historyRef.current.pop()
      if (prev !== undefined) {
        valueRef.current = prev
        linesRef.current = prev.split('\n')
        onChange(prev)
      }
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      const current = linesRef.current
      pushHistory(valueRef.current)
      const next = [...current]
      // Shift+Enter at the very start of line 1 → insert a blank line BEFORE it
      const insertAt = (e.shiftKey && i === 0 && (e.currentTarget.selectionStart ?? 1) === 0)
        ? 0
        : i + 1
      next.splice(insertAt, 0, '')
      const newVal = next.join('\n')
      valueRef.current = newVal
      linesRef.current = next
      onChange(newVal)
      moveFocus(insertAt)
    }
    if (e.key === 'Backspace' && linesRef.current[i] === '' && linesRef.current.length > 1) {
      e.preventDefault()
      e.stopPropagation()
      const current = linesRef.current
      pushHistory(valueRef.current)
      const next = current.filter((_, idx) => idx !== i)
      const newVal = next.join('\n')
      valueRef.current = newVal
      linesRef.current = next
      onChange(newVal)
      moveFocus(Math.max(0, i - 1))
    }
    if (e.key === 'Tab' || e.key === 'Escape') {
      e.preventDefault()
      onCommit()
    }
  }

  const showNumbers = isNumbered || lines.length > 1

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        width: '100%',
        borderRadius: 4,
        boxShadow: '0 0 0 2px var(--accent)',
        padding: '3px 4px',
        boxSizing: 'border-box',
      }}
    >
      {lines.map((line, i) => {
        const isNew = line.trim() !== '' && !originalSet.has(line.trim())
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: i < lines.length - 1 ? 2 : 0 }}>
            {showNumbers && (
              <span style={{ color: isNew ? '#15803d' : 'var(--text-muted)', minWidth: 16, fontSize: '0.78rem', flexShrink: 0, paddingTop: 2 }}>
                {i + 1}.
              </span>
            )}
            <textarea
              className="line-editor-input"
              value={line}
              rows={1}
              onChange={e => {
                updateLine(i, e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = e.target.scrollHeight + 'px'
              }}
              onKeyDown={e => handleKeyDown(i, e)}
              onBlur={() => {
                if (skipBlurRef.current) return
                setTimeout(() => {
                  if (skipBlurRef.current) return
                  const active = document.activeElement
                  if (active && (active as HTMLElement).classList.contains('line-editor-input')) return
                  onCommit()
                }, 0)
              }}
              ref={el => {
                if (!el) return
                el.style.height = 'auto'
                el.style.height = el.scrollHeight + 'px'
              }}
              style={{
                flex: 1,
                border: 'none',
                background: isNew ? 'rgba(34,197,94,0.12)' : 'transparent',
                color: isNew ? '#15803d' : 'var(--text)',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                padding: '0 2px',
                outline: 'none',
                lineHeight: 1.5,
                resize: 'none',
                overflow: 'hidden',
                display: 'block',
                width: '100%',
                boxSizing: 'border-box',
                wordBreak: 'break-word',
              }}
            />
          </div>
        )
      })}
    </div>
  )
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
  const [coverage, setCoverage] = useState('')
  const [screenshots, setScreenshots] = useState<File[]>([])
  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [progressMsg, setProgressMsg] = useState('')
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Step 3 state
  const [result, setResult] = useState<any>(null)
  const [tables, setTables] = useState<TableSection[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [downloading, setDownloading] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editingCell, setEditingCell] = useState<{ si: number; ri: number; ci: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editIsNumbered, setEditIsNumbered] = useState(false)
  const [originalEditValue, setOriginalEditValue] = useState('')
  const [editFocusLine, setEditFocusLine] = useState(0)
  const [editCursorOffset, setEditCursorOffset] = useState(-1)
  // maps "si-ri-ci" → display-format value before any edits; used to keep green after commit
  const [originalCells, setOriginalCells] = useState<Record<string, string>>({})
  // column widths set by drag-resize; index = column index (excluding checkbox col)
  const [colWidths, setColWidths] = useState<number[]>([])
  const resizingRef = useRef<{ ci: number; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    Promise.all([getConnections(), getLLMConnections()]).then(([j, l]) => {
      const jc = j.data.connections || []
      const lc = l.data.connections || []
      setJiraConns(jc)
      setLlmConns(lc)
      const savedLlm = localStorage.getItem('tc_llm_connection')
      const savedJira = localStorage.getItem('tc_jira_connection')
      if (jc.length) {
        const match = savedJira && jc.find((c: any) => c.name === savedJira)
        setForm(f => ({ ...f, connectionName: match ? savedJira! : jc[0].name }))
      }
      if (lc.length) {
        const match = savedLlm && lc.find((c: any) => c.name === savedLlm)
        setForm(f => ({ ...f, llmConnectionName: match ? savedLlm! : lc[0].name }))
      }
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
      // Exclude auto-fetched child issues (they have a parent_key); keep only what the user explicitly requested
      const fetched = (res.data.issues || []).filter((i: any) => !i.parent_key)
      if (!fetched.length) { setFetchError('No issues found for the given Jira IDs.'); return }
      setIssues(fetched)
      setCoverage(jiraIds.join(', ').toUpperCase())
      setStep(2)
    } catch (e: any) {
      setFetchError(e.response?.data?.detail || 'Fetch failed. Check connection and Jira IDs.')
    } finally { setFetchLoading(false) }
  }

  // ── Step 2: Generate ─────────────────────────────────────────────────────

  const PROGRESS_MSGS = [
    '🔍 Analyzing Jira tickets...',
    '🗺️ Planning test scenarios...',
    '✍️ Writing test cases...',
    '✨ Formatting output...',
    '🎯 Almost done...',
  ]

  async function handleGenerate() {
    if (!form.llmConnectionName) { setGenerateError('Select an LLM connection.'); return }
    if (!dumpUsed.trim()) { setGenerateError('Dump Used is required.'); return }
    setGenerateLoading(true)
    setGenerateError('')
    setProgressMsg(PROGRESS_MSGS[0])
    let msgIdx = 0
    progressTimer.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MSGS.length
      setProgressMsg(PROGRESS_MSGS[msgIdx])
    }, 4000)
    try {
      const images = screenshots.length > 0
        ? await Promise.all(screenshots.map(compressImage))
        : []

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
      setEditMode(false)
      setEditingCell(null)
      setOriginalCells({})
      setShowSuccess(true)

      const parsed = parseMarkdownTables(res.data.test_cases || '')
      const enriched = parsed.map(sec => ({
        ...sec,
        headers: [...sec.headers, 'Coverage (Issues)'],
        rows: sec.rows.map(row => [...row, coverage.toUpperCase()]),
      }))
      setTables(enriched)
      const allKeys = new Set<string>()
      enriched.forEach((sec, si) => sec.rows.forEach((_, ri) => allKeys.add(`${si}-${ri}`)))
      setSelected(allKeys)

      setStep(3)
    } catch (e: any) {
      const detail = e.response?.data?.detail
      const msg = typeof detail === 'string' ? detail
        : Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ')
        : e.message || 'Generation failed. Check backend logs and try again.'
      setGenerateError(msg)
    } finally {
      if (progressTimer.current) clearInterval(progressTimer.current)
      setGenerateLoading(false)
      setProgressMsg('')
    }
  }

  function handleScreenshotAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setScreenshots(prev => [...prev, ...files])
    e.target.value = ''
  }

  function handleScreenshotRemove(index: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== index))
  }

  function handlePaste(e: React.ClipboardEvent) {
    const imageItems = Array.from(e.clipboardData?.items || []).filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()
    imageItems.forEach(item => {
      const blob = item.getAsFile()
      if (!blob) return
      const file = new File([blob], `pasted-${Date.now()}.png`, { type: blob.type || 'image/png' })
      setScreenshots(prev => [...prev, file])
    })
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

  function handleCellEdit(si: number, ri: number, ci: number, value: string) {
    setTables(prev => prev.map((sec, s) => s !== si ? sec : {
      ...sec,
      rows: sec.rows.map((row, r) => r !== ri ? row : row.map((cell, c) => c !== ci ? cell : value)),
    }))
  }

  function startEditing(si: number, ri: number, ci: number, focusLine = 0, caretOffset = -1, e?: React.MouseEvent) {
    e?.stopPropagation()
    const currentValue = tables[si].rows[ri][ci]
    const numbered = isNumberedList(currentValue)
    const displayValue = toEditDisplay(currentValue)
    setEditIsNumbered(numbered)
    setEditValue(displayValue)
    setOriginalEditValue(displayValue)
    setEditingCell({ si, ri, ci })
    setEditFocusLine(focusLine)
    setEditCursorOffset(caretOffset)
    // Persist the pre-edit original only once per cell per generation
    const cellKey = `${si}-${ri}-${ci}`
    setOriginalCells(prev => cellKey in prev ? prev : { ...prev, [cellKey]: displayValue })
  }

  function commitEdit() {
    if (!editingCell) return
    const { si, ri, ci } = editingCell
    handleCellEdit(si, ri, ci, fromEditLines(editValue, editIsNumbered))
    setEditingCell(null)
    setEditValue('')
    setEditIsNumbered(false)
  }

  function handleRestart() {
    setStep(1)
    setIssues([])
    setResult(null)
    setTables([])
    setSelected(new Set())
    setAdditionalContext('')
    setDumpUsed('')
    setCoverage('')
    setScreenshots([])
    setFetchError('')
    setGenerateError('')
    setEditMode(false)
    setEditingCell(null)
    setEditValue('')
    setEditIsNumbered(false)
    setOriginalCells({})
    setColWidths([])
    setShowSuccess(false)
  }

  function startResize(e: React.MouseEvent, ci: number) {
    e.preventDefault()
    e.stopPropagation()
    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLElement
    const startWidth = th ? th.getBoundingClientRect().width : 120

    // Snapshot all current column widths from the DOM so auto-sized columns
    // don't snap back when we start forcing explicit widths
    const table = th?.closest('table')
    if (table) {
      const allThs = Array.from(table.querySelectorAll('thead th')) as HTMLElement[]
      const snapWidths = allThs.map(el => el.getBoundingClientRect().width)
      // skip index 0 (checkbox column), map to data-column indices
      setColWidths(snapWidths.slice(1))
    }

    resizingRef.current = { ci, startX: e.clientX, startWidth }

    const onMouseMove = (mv: MouseEvent) => {
      if (!resizingRef.current) return
      const newWidth = Math.max(60, resizingRef.current.startWidth + (mv.clientX - resizingRef.current.startX))
      setColWidths(prev => {
        const next = [...prev]
        next[resizingRef.current!.ci] = newWidth
        return next
      })
    }
    const onMouseUp = () => {
      resizingRef.current = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function deleteSelected() {
    setTables(prev =>
      prev.map((sec, si) => ({
        ...sec,
        rows: sec.rows.filter((_, ri) => !selected.has(`${si}-${ri}`)),
      })).filter(sec => sec.rows.length > 0)
    )
    setSelected(new Set())
    setOriginalCells({})
    setEditingCell(null)
  }

  const totalRows = tables.reduce((acc, sec) => acc + sec.rows.length, 0)
  const selectedCount = selected.size

  const tcSteps = ['1. 📥 Fetch Issues', '2. 🔍 Review & Generate', '3. ✅ Test Cases']

  return (
    <div className="tc-module">
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
            <h2>📥 Fetch Jira Issues</h2>
            <p>Select your connections and specify which Jira issues to create test cases for</p>

            <div className="form-row two-col">
              <div className="form-group">
                <label>Jira Connection<span>*</span></label>
                <select value={form.connectionName}
                  onChange={e => {
                    localStorage.setItem('tc_jira_connection', e.target.value)
                    setForm({ ...form, connectionName: e.target.value })
                  }}>
                  <option value="">Select connection...</option>
                  {jiraConns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>LLM Connection<span>*</span></label>
                <select value={form.llmConnectionName}
                  onChange={e => {
                    localStorage.setItem('tc_llm_connection', e.target.value)
                    setForm({ ...form, llmConnectionName: e.target.value })
                  }}>
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
                : '📥 Fetch Jira Issues'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review & Generate ── */}
      {step === 2 && (
        <div>
          <div className="card">
            <h2>🔍 Review Issues</h2>
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

            {/* Coverage — auto-filled from fetched IDs, editable */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Coverage (Issues)</label>
              <input value={coverage} onChange={e => setCoverage(e.target.value.toUpperCase())} />
              <span className="hint">Auto-filled from the Jira IDs you entered. Edit to specify a different ticket or leave as-is.</span>
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
                  value={additionalContext}
                  onChange={e => setAdditionalContext(e.target.value)}
                  onPaste={handlePaste}
                  style={{ minHeight: 100 }}
                />
                <span className="hint">Describe testing goals, known issues, scope constraints, or specific scenarios to cover.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }} onPaste={handlePaste}>
                <label style={{ fontSize: '0.8rem' }}>Screenshots / Attachments</label>
                <span className="hint" style={{ display: 'block', marginBottom: 8 }}>
                  Attach screenshots of the UI, designs, or error states. Vision-capable models (e.g. Claude) will analyze them to generate richer test cases.
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '7px 14px', borderRadius: 6, border: '1px dashed var(--border)',
                    fontSize: '0.82rem', color: 'var(--text-muted)', background: 'var(--bg-card)',
                    transition: 'border-color 0.2s',
                  }}>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleScreenshotAdd} />
                    + Add Screenshots
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>or paste an image (Ctrl+V)</span>
                </div>

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
                ? <><span className="spinner" /> {progressMsg}</>
                : `🚀 Generate Test Cases for ${issues.length} issue${issues.length !== 1 ? 's' : ''}${screenshots.length > 0 ? ` + ${screenshots.length} screenshot${screenshots.length !== 1 ? 's' : ''}` : ''}`}
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
              {form.jiraIdsRaw.split(',').map(s => s.trim()).filter(Boolean).map(id => (
                <span key={id} className="badge badge-info">{id}</span>
              ))}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedCount} of {totalRows} test cases selected
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn-outline"
                  onClick={() => { setEditMode(e => !e); setEditingCell(null) }}
                  style={editMode ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
                >
                  {editMode ? '✅ Done Editing' : '✏️ Edit'}
                </button>

                {editMode && selectedCount > 0 && (
                  <button
                    className="btn-danger"
                    onClick={deleteSelected}
                    title={`Delete ${selectedCount} selected test case${selectedCount !== 1 ? 's' : ''}`}
                    style={{ padding: '7px 14px', fontSize: '0.82rem' }}
                  >
                    🗑️ Delete ({selectedCount})
                  </button>
                )}

                <button
                  className="btn-primary"
                  onClick={handleExportCSV}
                  disabled={editMode || selectedCount === 0}
                  style={editMode ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                  title={selectedCount === 0 && !editMode ? 'Select at least one test case' : undefined}>
                  📤 Export CSV ({selectedCount})
                </button>
              </div>
              {editMode && (
                <span style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  ⚠ Click ✓ Done Editing to save before exporting
                </span>
              )}
            </div>
          </div>

          {showSuccess && (
            <div className="alert-success-banner" style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.35)',
              color: '#15803d', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style={{ flexShrink: 0 }}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              🎉 Test cases generated successfully! Review below, select the ones you need, then export to CSV.
            </div>
          )}

          {/* Test case tables with checkboxes */}
          <div className="card" style={{ padding: '20px 24px', position: 'relative' }}>
            {/* Read-only banner — hidden in edit mode */}
            {!editMode && (
              <div style={{
                position: 'absolute', top: 12, right: 16,
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: '0.72rem', color: 'var(--text-muted)',
                background: 'var(--bg-stepper)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '2px 10px', userSelect: 'none',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Read Only — click ✎ Edit to modify
              </div>
            )}
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
                          <th style={{ width: 36, textAlign: 'center', flexShrink: 0 }}></th>
                          {sec.headers.map((h, hi) => (
                            <th key={hi}
                              style={{
                                position: 'relative',
                                width: colWidths[hi] || undefined,
                                minWidth: colWidths[hi] || 80,
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {h}
                              {/* Drag-resize handle */}
                              <span
                                onMouseDown={e => startResize(e, hi)}
                                style={{
                                  position: 'absolute', right: 0, top: 0, bottom: 0,
                                  width: 6, cursor: 'col-resize', zIndex: 2,
                                  background: 'transparent',
                                  borderRight: '2px solid transparent',
                                  transition: 'border-color 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.borderRightColor = 'var(--accent)')}
                                onMouseLeave={e => (e.currentTarget.style.borderRightColor = 'transparent')}
                                title="Drag to resize column"
                              />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sec.rows.map((row, ri) => {
                          const key = `${si}-${ri}`
                          const isChecked = selected.has(key)
                          return (
                            <tr key={ri}
                              style={{ background: isChecked ? 'var(--bg-stepper)' : undefined }}
                              onClick={() => !editMode && toggleRow(key)}>
                              <td style={{ textAlign: 'center', cursor: 'pointer' }} onClick={e => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleRow(key)}
                                  style={{ width: 15, height: 15, cursor: 'pointer' }}
                                />
                              </td>
                              {row.map((cell, ci) => {
                                const isActive = editMode && editingCell?.si === si && editingCell?.ri === ri && editingCell?.ci === ci
                                const cellKey = `${si}-${ri}-${ci}`
                                return (
                                  <td key={ci}
                                    style={{
                                      cursor: editMode ? 'text' : 'default',
                                      verticalAlign: 'top',
                                      width: colWidths[ci] || undefined,
                                      minWidth: colWidths[ci] || 80,
                                    }}
                                    title={!editMode ? 'Click ✎ Edit to modify' : undefined}
                                    onClick={editMode && !isActive ? e => startEditing(si, ri, ci, 0, -1, e) : undefined}>
                                    {isActive ? (
                                      <LineEditor
                                        value={editValue}
                                        originalValue={originalEditValue}
                                        isNumbered={editIsNumbered}
                                        onChange={setEditValue}
                                        onCommit={commitEdit}
                                        focusLine={editFocusLine}
                                        focusCursor={editCursorOffset}
                                      />
                                    ) : renderCell(
                                        cell,
                                        originalCells[cellKey],
                                        editMode ? (li, offset) => startEditing(si, ri, ci, li, offset ?? -1) : undefined,
                                      )}
                                  </td>
                                )
                              })}
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
            <button className="btn-primary" onClick={handleRestart}>🔄 Start Over</button>
          </div>
        </div>
      )}
    </div>
  )
}
