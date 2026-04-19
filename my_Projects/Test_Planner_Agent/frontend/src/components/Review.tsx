/**
 * Step 3: Review
 * Show fetched issues, missing info flags, allow adding context, then generate.
 */

import { useState } from 'react'
import { generateTestPlan } from '../api'
import type { FetchState } from '../App'

interface Props {
  fetchState: FetchState
  setFetchState: (s: FetchState) => void
  onGenerated: (result: object) => void
  onBack: () => void
}

export default function Review({ fetchState, setFetchState, onGenerated, onBack }: Props) {
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const { issues, llmConnectionName, productName, projectKey, additionalContext } = fetchState

  // Compute missing info flags (Rule 2 from gemini.md — client-side preview)
  const flags: string[] = []
  issues.forEach(issue => {
    if (!issue.acceptance_criteria?.trim()) {
      flags.push(`${issue.key}: No acceptance criteria found.`)
    }
    if (!issue.description?.trim() || issue.description.trim().length < 50) {
      flags.push(`${issue.key}: Description is very short or missing.`)
    }
  })

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
            <h2>Review Jira Issues ({issues.length})</h2>
            <p style={{ marginBottom: 0 }}>Issues that will be used to generate the test plan</p>
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
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span className="badge badge-info">{issue.issue_type}</span>
                <span className="badge badge-warning">{issue.status}</span>
                {issue.priority && <span className="badge" style={{ background: 'var(--bg-stepper)', color: 'var(--text-muted)' }}>{issue.priority}</span>}
              </div>
            </div>
            {issue.description && (
              <p style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {issue.description.slice(0, 200)}{issue.description.length > 200 ? '...' : ''}
              </p>
            )}
            {issue.acceptance_criteria && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--connected-text)' }}>AC: </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {issue.acceptance_criteria.slice(0, 150)}{issue.acceptance_criteria.length > 150 ? '...' : ''}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Additional context */}
      <div className="card">
        <h2>Additional Context & Notes</h2>
        <p>Add context to address warnings above or guide the test plan generation</p>
        <div className="form-group">
          <textarea
            placeholder="Add any additional context about the testing approach, special requirements, constraints, team structure, or specific areas of focus..."
            value={additionalContext}
            onChange={e => setFetchState({ ...fetchState, additionalContext: e.target.value })}
            style={{ minHeight: 120 }}
          />
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
