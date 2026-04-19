# Setup Guide — Test Planner Agent

Follow these steps in order before running the agent.

---

## Step 1: Install Python

1. Download Python 3.11+ from: https://www.python.org/downloads/
2. During install, check **"Add Python to PATH"**
3. Verify: open a terminal and run:
   ```
   python --version
   ```

---

## Step 2: Install Node.js (for the React frontend)

1. Download Node.js 20+ LTS from: https://nodejs.org/
2. Verify:
   ```
   node --version
   npm --version
   ```

---

## Step 3: Install Python dependencies

Open a terminal in the `Chapter_04_Ai_Agents/` folder and run:

```bash
pip install fastapi "uvicorn[standard]" pydantic python-dotenv requests anthropic groq markdown fpdf2
```

> **PDF quality:** For better PDF output, also install `weasyprint`:
> ```bash
> pip install weasyprint
> ```
> (requires GTK on Windows — see https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#windows)

---

## Step 4: Install React frontend dependencies

```bash
cd frontend
npm install
```

---

## Step 5: Configure your API keys

Copy `.env.template` to `.env`:
```bash
copy .env.template .env
```

Edit `.env` and add your keys:
```
ANTHROPIC_API_KEY=sk-ant-...          # if using Claude
GROQ_API_KEY=gsk_...                  # if using GROQ
GROK_API_KEY=xai-...                  # if using Grok/xAI
OLLAMA_BASE_URL=http://localhost:11434 # if using Ollama locally
```

> **Note:** You do NOT need all keys — only the one for the LLM provider you will use.
> Jira credentials are entered directly in the UI — no need to add them to `.env`.

---

## Step 6: Run the application

### Terminal 1 — Start the backend:
```bash
cd Chapter_04_Ai_Agents
"C:\Users\SmrutiranjanMaharana\AppData\Local\Programs\Python\Python314\python.exe" -m uvicorn backend.main:app --reload --port 8000
```

### Terminal 2 — Start the frontend:
```bash
cd Chapter_04_Ai_Agents\frontend
npm run dev
```

### Open in browser:
```
http://localhost:5173
```

Backend API docs (Swagger):
```
http://localhost:8000/docs
```

---

## How to use the agent

1. **Setup tab** — Add a Jira connection (enter URL, email, API token) + click "Test Connection"
2. **Setup tab** — Add an LLM connection (choose provider, enter model + API key) + click "Test Connection"
3. **Fetch Issues tab** — Enter your Project Key (e.g. `VWOAPP`) or specific Jira IDs (e.g. `VWOAPP-123`)
4. **Review tab** — Review fetched issues, add context if needed, click "Generate Test Plan"
5. **Test Plan tab** — View the generated plan, download as `.md` or `.pdf`

---

## Jira API Token

Generate your Jira API token here:
https://id.atlassian.com/manage-profile/security/api-tokens
