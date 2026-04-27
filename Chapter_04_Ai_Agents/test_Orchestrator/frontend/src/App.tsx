import { useState, useEffect } from 'react'
import FetchIssues from './components/FetchIssues'
import Review from './components/Review'
import TestPlan from './components/TestPlan'
import TestCaseCreator from './components/TestCaseCreator'
import ConnectionsPage from './components/ConnectionsPage'
import { getConnections, getLLMConnections } from './api'
import './App.css'

export type Step = 1 | 2 | 3
type Module = 'test-planner' | 'test-cases' | 'gherkin' | 'connections'

export interface Issue {
  id: string; key: string; summary: string; description: string
  issue_type: string; status: string; priority: string; component: string
}

export interface FetchState {
  connectionName: string; llmConnectionName: string
  productName: string; projectKey: string; issues: Issue[]; additionalContext: string
  coverage?: string
  epics?: Issue[]
  childrenMap?: Record<string, Issue[]>
}

const NAV_ITEMS: { id: Module; label: string; desc: string; icon: React.ReactNode; available: boolean }[] = [
  {
    id: 'test-planner',
    label: 'Test Planner',
    desc: 'Generate test plans from user stories',
    available: true,
    icon: <span style={{ fontSize: '1.1rem' }}>📋</span>,
  },
  {
    id: 'test-cases',
    label: 'Test Case Generator',
    desc: 'Create detailed test cases',
    available: true,
    icon: <span style={{ fontSize: '1.1rem' }}>🧪</span>,
  },
  {
    id: 'gherkin',
    label: 'Gherkin Converter',
    desc: 'Convert to Selenium / Gherkin',
    available: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
      </svg>
    ),
  },
]

export default function App() {
  const [activeModule, setActiveModule]   = useState<Module>('test-planner')
  const [step, setStep]                   = useState<Step>(1)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [fetchState, setFetchState]       = useState<FetchState>({
    connectionName: '', llmConnectionName: '', productName: '', projectKey: '', issues: [], additionalContext: '',
  })
  const [testPlanResult, setTestPlanResult] = useState<object | null>(null)

  // Connection guard
  const [hasJira, setHasJira]   = useState<boolean | null>(null)  // null = loading
  const [hasLLM,  setHasLLM]   = useState<boolean | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Re-check connections whenever the user navigates back from the Connections page
  useEffect(() => {
    checkConnections()
  }, [activeModule])

  async function checkConnections() {
    try {
      const [j, l] = await Promise.all([getConnections(), getLLMConnections()])
      setHasJira((j.data.connections || []).length > 0)
      setHasLLM((l.data.connections || []).length > 0)
    } catch {
      setHasJira(false); setHasLLM(false)
    }
  }

  const steps    = ['1. 📥 Fetch Issues', '2. 🔍 Review', '3. 📄 Test Plan']
  const activeNav = NAV_ITEMS.find(n => n.id === activeModule) ?? {
    label: 'Connections', desc: 'Manage Jira & LLM connections', icon: null,
  }

  const connectionsReady = hasJira && hasLLM
  const needsConnections = activeModule !== 'connections' && activeModule !== 'gherkin' && !connectionsReady

  return (
    <div className="app-shell">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🤖</span>
          </div>
          <div>
            <div className="sidebar-title">TestingBuddy AI</div>
          </div>
        </div>

        <div className="sidebar-section-label">🛠️ Tools</div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const locked = !item.available || (item.available && !connectionsReady && item.id !== 'connections')
            return (
              <button
                key={item.id}
                className={`sidebar-nav-item ${activeModule === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
                onClick={() => !locked && setActiveModule(item.id)}
                title={!item.available ? 'Coming Soon' : !connectionsReady ? 'Configure connections first' : item.desc}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-text">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-desc">{item.desc}</span>
                </span>
                {!item.available
                  ? <span className="soon-badge">Soon</span>
                  : (!connectionsReady && <span className="soon-badge" style={{ background: '#fee2e2', color: '#991b1b' }}>Setup</span>)
                }
              </button>
            )
          })}
        </nav>

        {/* Settings */}
        <div className="sidebar-section-label" style={{ marginTop: 8 }}>⚙️ Settings</div>
        <div style={{ padding: '0 8px' }}>
          <button
            className={`sidebar-nav-item ${activeModule === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveModule('connections')}
          >
            <span className="nav-icon" style={{ fontSize: '1.1rem' }}>🔗</span>
            <span className="nav-text">
              <span className="nav-label">Connections</span>
              <span className="nav-desc">Manage Jira & LLM connections</span>
            </span>
            {/* Pulse dot when no connections configured */}
            {!connectionsReady && hasJira !== null && (
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#ef4444', flexShrink: 0,
                boxShadow: '0 0 0 2px rgba(239,68,68,0.3)',
              }} />
            )}
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="theme-picker-label">🎨 Theme</div>
          <div className="theme-swatches">
            {[
              { id: 'dark',   emoji: '🌙',  label: 'Dark',   color: '#334155' },
              { id: 'light',  emoji: '☀️',  label: 'Light',  color: '#e2e8f0' },
              { id: 'ocean',  emoji: '🌊',  label: 'Ocean',  color: '#0ea5e9' },
              { id: 'forest', emoji: '🌲',  label: 'Forest', color: '#16a34a' },
              { id: 'sunset', emoji: '🌅',  label: 'Sunset', color: '#9333ea' },
            ].map(t => (
              <button
                key={t.id}
                className={`theme-swatch ${theme === t.id ? 'active' : ''}`}
                style={{ background: t.color }}
                title={t.label}
                onClick={() => setTheme(t.id)}
              >
                <span>{t.emoji}</span>
              </button>
            ))}
          </div>
          {theme !== 'light' && (
            <div className="sidebar-credit">© Smrutiranjan Maharana</div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="main-content">

        <header className="content-header">
          <div>
            <h1 className="content-title">{activeNav.label}</h1>
            <p className="content-subtitle">{activeNav.desc}</p>
          </div>
        </header>

        <div className="content-area">

          {/* ── No-connections guard (shown for all tool modules when not configured) ── */}
          {needsConnections && hasJira !== null && (
            <div className="coming-soon-card">
              <div className="coming-soon-icon" style={{ background: '#fff7ed' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.8" width="28" height="28">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <h2>🔌 Connections Required</h2>
              <p>
                {!hasJira && !hasLLM
                  ? 'No Jira or LLM connections configured yet.'
                  : !hasJira
                  ? 'No Jira connection configured yet.'
                  : 'No LLM connection configured yet.'}
              </p>
              <p className="coming-soon-note">
                Set up your connections once and use them across all tools — Test Planner, Test Case Generator, and more.
              </p>
              <button className="btn-primary" style={{ marginTop: 8 }}
                onClick={() => setActiveModule('connections')}>
                🔗 Go to Connections →
              </button>
            </div>
          )}

          {/* ── Test Planner ── */}
          {activeModule === 'test-planner' && connectionsReady && (
            <>
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
              <main>
                {step === 1 && (
                  <FetchIssues
                    fetchState={fetchState}
                    setFetchState={setFetchState}
                    onNext={() => setStep(2)}
                    onBack={() => setActiveModule('connections')}
                    backLabel="← Manage Connections"
                  />
                )}
                {step === 2 && (
                  <Review
                    fetchState={fetchState}
                    setFetchState={setFetchState}
                    onGenerated={(result) => { setTestPlanResult(result); setStep(3) }}
                    onBack={() => setStep(1)}
                  />
                )}
                {step === 3 && (
                  <TestPlan
                    result={testPlanResult}
                    coverage={fetchState.coverage}
                    onBack={() => setStep(2)}
                    onRestart={() => { setStep(1); setTestPlanResult(null) }}
                  />
                )}
              </main>
            </>
          )}

          {/* ── Test Case Creator ── */}
          {activeModule === 'test-cases' && connectionsReady && <TestCaseCreator />}

          {/* ── Connections ── */}
          {activeModule === 'connections' && (
            <ConnectionsPage onConnectionsReady={() => {
              checkConnections()
            }} />
          )}

          {/* ── Coming Soon ── */}
          {activeModule !== 'test-planner' && activeModule !== 'test-cases'
            && activeModule !== 'connections' && !needsConnections && (
            <div className="coming-soon-card">
              <div className="coming-soon-icon">{activeNav.icon}</div>
              <h2>{activeNav.label}</h2>
              <p>{activeNav.desc}</p>
              <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '5px 12px' }}>Coming Soon</span>
              <p className="coming-soon-note">🚧 This module is under development and will be available in a future release.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
