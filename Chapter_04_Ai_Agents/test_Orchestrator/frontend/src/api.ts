/**
 * api.ts — All backend API calls in one place.
 * React components import from here; they never call axios directly.
 */

import axios from 'axios'

const API = axios.create({ baseURL: '/api', timeout: 300000 })

// ── Jira Connections ─────────────────────────────────────────────────────────

export const getConnections = () => API.get('/connections')

export const saveConnection = (data: {
  name: string; url: string; email: string; api_token: string; source_type?: string
}) => API.post('/connections', data)

export const testJiraConnection = (data: {
  name: string; url: string; email: string; api_token: string; source_type?: string
}) => API.post('/connections/test', data)

export const deleteConnection = (name: string) => API.delete(`/connections/${encodeURIComponent(name)}`)

// ── LLM Connections ──────────────────────────────────────────────────────────

export const getLLMConnections = () => API.get('/llm-connections')

export const saveLLMConnection = (data: {
  name: string; provider: string; api_key?: string; model: string; base_url?: string
}) => API.post('/llm-connections', data)

export const testLLMConnection = (data: {
  name: string; provider: string; api_key?: string; model: string; base_url?: string
}) => API.post('/llm-connections/test', data)

export const deleteLLMConnection = (name: string) => API.delete(`/llm-connections/${encodeURIComponent(name)}`)

export const getFalconModels = (data: { api_key?: string; base_url?: string; connection_name?: string }) =>
  API.post('/llm-connections/falcon-models', data)

// ── Issues ───────────────────────────────────────────────────────────────────

export const fetchIssues = (data: {
  connection_name: string
  product_name: string
  project_key: string
  jira_ids?: string[]
  sprint_version?: string
  additional_context?: string
}) => API.post('/issues/fetch', data)

// ── Test Plan ────────────────────────────────────────────────────────────────

export const generateTestPlan = (data: {
  llm_connection_name: string
  issues: object[]
  product_name: string
  project_key: string
  additional_context?: string
}) => API.post('/test-plan/generate', data)

export const exportMarkdown = () => API.get('/test-plan/export/markdown', { responseType: 'blob' })
export const exportDoc = () => API.get('/test-plan/export/doc', { responseType: 'blob' })

// ── Test Cases ───────────────────────────────────────────────────────────────

export const generateTestCases = (data: {
  llm_connection_name: string
  issues: object[]
  product_name: string
  project_key: string
  additional_context?: string
  dump_used?: string
  images?: { data: string; media_type: string }[]
}) => API.post('/test-cases/generate', data)

export const exportTestCasesMarkdown = () => API.get('/test-cases/export/markdown', { responseType: 'blob' })
export const exportTestCasesDoc = () => API.get('/test-cases/export/doc', { responseType: 'blob' })

// ── History ──────────────────────────────────────────────────────────────────

export const getHistory = () => API.get('/history')
export const downloadHistoryMarkdown = (id: string) => API.get(`/history/${id}/download/markdown`, { responseType: 'blob' })
export const downloadHistoryDoc = (id: string) => API.get(`/history/${id}/download/doc`, { responseType: 'blob' })
export const deleteHistoryRecord = (id: string) => API.delete(`/history/${id}`)
