import { useState, useEffect } from 'react'
import Setup from './components/Setup'
import FetchIssues from './components/FetchIssues'
import Review from './components/Review'
import TestPlan from './components/TestPlan'
import History from './components/History'
import './App.css'

export type Step = 1 | 2 | 3 | 4

export interface Issue {
  id: string; key: string; summary: string; description: string
  issue_type: string; status: string; priority: string; acceptance_criteria: string
}

export interface FetchState {
  connectionName: string; llmConnectionName: string
  productName: string; projectKey: string; issues: Issue[]; additionalContext: string
}

export default function App() {
  const [step, setStep] = useState<Step>(1)
  const [showHistory, setShowHistory] = useState(false)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')
  const [fetchState, setFetchState] = useState<FetchState>({
    connectionName: '', llmConnectionName: '', productName: '', projectKey: '', issues: [], additionalContext: '',
  })
  const [testPlanResult, setTestPlanResult] = useState<object | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const steps = ['1. Setup', '2. Fetch Issues', '3. Review', '4. Test Plan']

  if (showHistory) return <History onBack={() => setShowHistory(false)} />

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="app-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" />
              <line x1="12" y1="3" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="21" />
              <line x1="3" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="21" y2="12" />
            </svg>
          </div>
          <div>
            <h1>Test Planner Agent</h1>
            <p>Generate comprehensive test plans from Jira requirements using AI</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Dark mode toggle */}
          <button className="btn-theme-toggle" onClick={() => setDark(d => !d)} title={dark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {dark ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <button className="btn-history" onClick={() => setShowHistory(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            View History
          </button>
        </div>
      </header>

      <nav className="stepper">
        {steps.map((label, i) => {
          const num = (i + 1) as Step
          return (
            <div key={num}
              className={`step ${step === num ? 'active' : ''} ${step > num ? 'done' : ''}`}
              onClick={() => step > num && setStep(num)}>
              {label}
            </div>
          )
        })}
      </nav>

      <main className="app-content">
        {step === 1 && <Setup onNext={() => setStep(2)} />}
        {step === 2 && <FetchIssues fetchState={fetchState} setFetchState={setFetchState} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
        {step === 3 && <Review fetchState={fetchState} setFetchState={setFetchState} onGenerated={(result) => { setTestPlanResult(result); setStep(4) }} onBack={() => setStep(2)} />}
        {step === 4 && <TestPlan result={testPlanResult} onBack={() => setStep(3)} onRestart={() => { setStep(1); setTestPlanResult(null) }} />}
      </main>
    </div>
  )
}
