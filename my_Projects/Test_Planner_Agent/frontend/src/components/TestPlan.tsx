import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { exportMarkdown, exportDoc } from '../api'
import './TestPlan.css'

interface Props {
  result: any
  onBack: () => void
  onRestart: () => void
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function TestPlan({ result, onBack, onRestart }: Props) {
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
  const baseName = `test_plan_${metadata.jira_project}_${dateStr}`

  async function handleDownloadMd() {
    const res = await exportMarkdown()
    downloadBlob(new Blob([res.data], { type: 'text/markdown' }), `${baseName}.md`)
  }

  async function handleDownloadDoc() {
    const res = await exportDoc()
    downloadBlob(
      new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
      `${baseName}.docx`
    )
  }

  return (
    <div>
      {/* Meta bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-success">Generated</span>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <strong>{metadata.product_name || metadata.jira_project}</strong>
              &nbsp;·&nbsp;{metadata.issues_count} issue{metadata.issues_count !== 1 ? 's' : ''}
              &nbsp;·&nbsp;{new Date(metadata.generated_at).toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-outline" onClick={handleDownloadMd}>⬇ Download .md</button>
            <button className="btn-outline" onClick={handleDownloadDoc}>⬇ Download .docx</button>
            <button className="btn-secondary" onClick={onRestart}>Start Over</button>
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
      </div>

      <div className="card test-plan-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{test_plan_markdown}</ReactMarkdown>
      </div>

      <div className="nav-buttons">
        <button className="btn-secondary" onClick={onBack}>← Back to Review</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={handleDownloadMd}>⬇ .md</button>
          <button className="btn-outline" onClick={handleDownloadDoc}>⬇ .docx</button>
        </div>
      </div>
    </div>
  )
}
