# Falcon AI (Planview) Integration Guide

This document lists every code change needed to connect the Test Orchestrator to
Planview's internal Falcon AI gateway (`https://falconai.planview-prod.io/api`).

Apply these changes to the old/clean code in order.

---

## 1. `tools/llm_client.py`

### 1a. Change default Falcon model

Find the `DEFAULT_MODELS` dict inside `LLMConnection` and replace the `falcon` entry:

```python
# BEFORE
"falcon": "tiiuae/falcon-40b-instruct",

# AFTER
"falcon": "claude-sonnet-4-20250514",
```

### 1b. Change Falcon base URL in `_test_falcon()`

```python
# BEFORE
base = (conn.base_url or "https://api.ai71.ai/v1").rstrip("/")

# AFTER
base = (conn.base_url or "https://falconai.planview-prod.io/api").rstrip("/")
```

### 1c. Change Falcon base URL in `_generate_falcon()`

Same one-line change, same pattern — there are two occurrences (one in `_test_falcon`, one in `_generate_falcon`):

```python
# BEFORE
base = (conn.base_url or "https://api.ai71.ai/v1").rstrip("/")

# AFTER
base = (conn.base_url or "https://falconai.planview-prod.io/api").rstrip("/")
```

### 1d. Reduce timeout in `_generate_falcon()` and `_generate_grok()`

Planview's API gateway has a ~60 s hard timeout. Keeping requests short avoids 504 errors:

```python
# BEFORE
timeout=120,

# AFTER
timeout=90,
```

> Apply this to both `_generate_grok` and `_generate_falcon`.

---

## 2. `backend/main.py`

### 2a. Add `FalconModelsRequest` model and `/api/llm-connections/falcon-models` endpoint

Insert this block **after** the `save_llm_connection` route and **before** the `test_llm_connection_endpoint` route:

```python
class FalconModelsRequest(BaseModel):
    api_key: str
    base_url: Optional[str] = None


@app.post("/api/llm-connections/falcon-models")
def get_falcon_models(req: FalconModelsRequest):
    import requests as req_lib
    base = (req.base_url or "https://falconai.planview-prod.io/api").rstrip("/")
    try:
        resp = req_lib.get(
            f"{base}/models",
            headers={"Authorization": f"Bearer {req.api_key}"},
            timeout=10,
        )
        if resp.status_code == 200:
            models = [m["id"] for m in resp.json().get("data", [])]
            return {"success": True, "models": models}
        return {"success": False, "error": f"HTTP {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 3. `frontend/src/api.ts`

### 3a. Add `timeout` to the axios instance

```typescript
// BEFORE
const API = axios.create({ baseURL: '/api' })

// AFTER
const API = axios.create({ baseURL: '/api', timeout: 300000 })
```

### 3b. Add `getFalconModels` export

Add this after `deleteLLMConnection`:

```typescript
export const getFalconModels = (data: { api_key: string; base_url?: string }) =>
  API.post('/llm-connections/falcon-models', data)
```

---

## 4. `frontend/vite.config.ts`

Add proxy timeouts so long LLM calls don't time out at the Vite dev server level:

```typescript
// BEFORE
'/api': {
  target: 'http://localhost:8000',
  changeOrigin: true,
},

// AFTER
'/api': {
  target: 'http://localhost:8000',
  changeOrigin: true,
  proxyTimeout: 300000,
  timeout: 300000,
},
```

---

## 5. `frontend/src/components/ConnectionsPage.tsx`

### 5a. Import `getFalconModels`

```typescript
// BEFORE
import {
  getConnections, saveConnection, testJiraConnection, deleteConnection,
  getLLMConnections, saveLLMConnection, testLLMConnection, deleteLLMConnection,
} from '../api'

// AFTER
import {
  getConnections, saveConnection, testJiraConnection, deleteConnection,
  getLLMConnections, saveLLMConnection, testLLMConnection, deleteLLMConnection,
  getFalconModels,
} from '../api'
```

### 5b. Update `PROVIDERS` array — change Falcon label and placeholder

```typescript
// BEFORE
{ value: 'falcon', label: 'Falcon AI',            modelPlaceholder: 'tiiuae/falcon-40b-instruct' },

// AFTER
{ value: 'falcon', label: 'Falcon AI (Planview)',  modelPlaceholder: 'claude-sonnet-4-20250514' },
```

### 5c. Add `FALCON_MODELS` constant (fallback list before "Load Models" is clicked)

Add this right after the `PROVIDERS` array:

```typescript
const FALCON_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
]
```

### 5d. Add state for Falcon model list and loading flag

Inside the component, alongside the other LLM state declarations:

```typescript
const [falconModels, setFalconModels]   = useState<string[]>(FALCON_MODELS)
const [falconLoading, setFalconLoading] = useState(false)
```

### 5e. Add `handleLoadFalconModels` function

Add this inside the component, before the `return`:

```typescript
async function handleLoadFalconModels() {
  if (!llmForm.api_key) return
  setFalconLoading(true)
  try {
    const res = await getFalconModels({ api_key: llmForm.api_key, base_url: llmForm.base_url || undefined })
    if (res.data.success && res.data.models.length > 0) {
      setFalconModels(res.data.models)
      setLlmForm(f => ({ ...f, model: res.data.models[0] }))
    } else {
      setLlmTestResult({ success: false, message: res.data.error || 'Could not fetch models.' })
    }
  } catch (e: any) {
    setLlmTestResult({ success: false, message: e.response?.data?.detail || 'Failed to fetch models.' })
  }
  setFalconLoading(false)
}
```

### 5f. Pre-set model when Falcon is selected as provider

Find the Provider `<select>` onChange and replace:

```typescript
// BEFORE
onChange={e => setLlmForm({ ...llmForm, provider: e.target.value, model: '' })}>

// AFTER
onChange={e => {
  const p = e.target.value
  setLlmForm({ ...llmForm, provider: p, model: p === 'falcon' ? FALCON_MODELS[0] : '' })
}}>
```

### 5g. Replace Model text input with a dropdown + "Load Models" button for Falcon

Find the Model `<input>` and replace the entire `<div className="form-group">` block for model with:

```tsx
<div className="form-group">
  <label>Model<span>*</span></label>
  {llmForm.provider === 'falcon' ? (
    <div style={{ display: 'flex', gap: 6 }}>
      <select style={{ flex: 1 }} value={llmForm.model}
        onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}>
        {falconModels.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <button type="button" className="btn-outline" style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}
        onClick={handleLoadFalconModels}
        disabled={!llmForm.api_key || falconLoading}>
        {falconLoading ? '...' : 'Load Models'}
      </button>
    </div>
  ) : (
    <input placeholder={providerMeta?.modelPlaceholder || 'model name'} value={llmForm.model}
      onChange={e => setLlmForm({ ...llmForm, model: e.target.value })} />
  )}
</div>
```

### 5h. Remove the Falcon Base URL optional field

Delete this entire block from the JSX (it appeared below the model/api-key row):

```tsx
{llmForm.provider === 'falcon' && (
  <div className="form-row">
    <div className="form-group">
      <label>Falcon Base URL <span style={{ fontWeight: 'normal', color: 'var(--text-muted)' }}>(optional)</span></label>
      <input placeholder="https://api.ai71.ai/v1  or  your internal Falcon endpoint"
        value={llmForm.base_url}
        onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })} />
    </div>
  </div>
)}
```

---

## 6. `frontend/src/components/Setup.tsx`

Apply the **exact same changes as steps 5a–5h** above to `Setup.tsx`.  
The component structure is identical — the same imports, state, handler, and JSX blocks need updating.

---

## Summary of changed files

| File | What changed |
|------|-------------|
| `tools/llm_client.py` | Falcon base URL → Planview endpoint; default model → `claude-sonnet-4-20250514`; timeout 120→90 |
| `backend/main.py` | Added `FalconModelsRequest` + `POST /api/llm-connections/falcon-models` endpoint |
| `frontend/src/api.ts` | Added `timeout: 300000`; added `getFalconModels` export |
| `frontend/vite.config.ts` | Added `proxyTimeout: 300000` and `timeout: 300000` to `/api` proxy |
| `frontend/src/components/ConnectionsPage.tsx` | Falcon dropdown with Load Models button; removed Base URL field |
| `frontend/src/components/Setup.tsx` | Same as ConnectionsPage.tsx |

---

## How to use after changes

1. Start the backend: `uvicorn main:app --reload` (from `backend/`)
2. Start the frontend: `npm run dev` (from `frontend/`)
3. Go to **Connections → LLM Connections → Add**
4. Select provider **Falcon AI (Planview)**
5. Paste your Planview API key
6. Click **Load Models** to fetch available models from the gateway
7. Select a model and click **Test Connection** — should show "Connected successfully"
