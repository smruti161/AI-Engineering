# 🔌 How to Use the Falcon AI API

Falcon AI exposes a powerful, OpenAI-compatible REST API that lets you interact with the platform programmatically — from automating workflows to integrating AI into your own scripts, notebooks, and applications.

> 💡 **Why use the API?** The Falcon AI API is perfect for automation, batch processing, building internal tools, or integrating AI responses into pipelines outside the chat interface.

---

## What You'll Need

- ✅ A Falcon AI account (`falconai.planview-prod.io`)
- ✅ A personal API key (generated in Settings)
- ✅ Python 3.8+ (for the code examples below)
- ✅ The `requests` library (or the `openai` SDK)

---

## Step 1 — Generate Your API Key

Your API key is a secret token that authenticates your requests to Falcon AI.

1. Log in to `falconai.planview-prod.io`
2. Click your profile avatar in the top-right corner
3. Select **Settings** from the dropdown menu
4. Navigate to the **Account** tab
5. Scroll down to the **API Keys** section
6. Click ➕ **Create new secret key**
7. Give your key a descriptive name (e.g., `my-python-script` or `data-pipeline`)
8. Click **Create** — your key will appear **once only**
9. Copy and store it immediately in a secure location (e.g., a `.env` file or a password manager)

> ⚠️ **Important:** Your API key is shown only once at creation time. If you lose it, you'll need to revoke it and generate a new one. Never commit API keys to source control.

---

## Step 2 — Understand the Base URL and Authentication

All Falcon AI API requests use:

- **Base URL:** `https://falconai.planview-prod.io`
- **Authentication:** Bearer token — include your API key in the `Authorization` header

Every request must include this header:

```
Authorization: Bearer YOUR_API_KEY_HERE
```

---

## Step 3 — Set Up Your Python Environment

Install the required packages:

```bash
pip install requests openai python-dotenv
```

Store your API key securely in a `.env` file at your project root:

```env
# .env
FALCON_API_KEY=your_api_key_here
FALCON_BASE_URL=https://falconai.planview-prod.io
```

Then load it in Python:

```python
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("FALCON_API_KEY")
BASE_URL = os.getenv("FALCON_BASE_URL", "https://falconai.planview-prod.io")
```

---

## Step 4 — Make Your First API Call

### 🔍 List Available Models

**Endpoint:** `GET /api/models`

```python
import requests

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

response = requests.get(f"{BASE_URL}/api/models", headers=headers)
models = response.json()

for model in models.get("data", []):
    print(f"- {model['id']}")
```

**Example output:**

```
- claude-sonnet-4-20250514
- claude-opus-4-20250514
- claude-haiku-4-5-20251001
```

---

## Step 5 — Send a Chat Completion Request

**Endpoint:** `POST /api/chat/completions`

### Option A — Using `requests` (plain HTTP)

```python
import requests
import json

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

payload = {
    "model": "claude-sonnet-4-20250514",
    "messages": [
        {
            "role": "user",
            "content": "Summarize the key benefits of Agile project management in 3 bullet points."
        }
    ]
}

response = requests.post(
    f"{BASE_URL}/api/chat/completions",
    headers=headers,
    json=payload
)

result = response.json()
print(result["choices"][0]["message"]["content"])
```

### Option B — Using the `openai` SDK ✅ Recommended

```python
from openai import OpenAI

client = OpenAI(
    api_key=API_KEY,
    base_url=f"{BASE_URL}/api"
)

completion = client.chat.completions.create(
    model="claude-sonnet-4-20250514",
    messages=[
        {
            "role": "user",
            "content": "Summarize the key benefits of Agile project management in 3 bullet points."
        }
    ]
)

print(completion.choices[0].message.content)
```

> ✅ **Pro tip:** Option B (the `openai` SDK) is recommended. It handles retries, streaming, and response parsing automatically.

---

## Step 6 — Multi-Turn Conversations

The API is **stateless** — there is no built-in memory between calls. Pass the full message history in each request to simulate a conversation.

```python
from openai import OpenAI

client = OpenAI(
    api_key=API_KEY,
    base_url=f"{BASE_URL}/api"
)

conversation_history = [
    {
        "role": "system",
        "content": "You are a helpful assistant specializing in Planview products."
    }
]

def chat(user_message: str) -> str:
    """Send a message and maintain conversation context."""
    conversation_history.append({
        "role": "user",
        "content": user_message
    })

    response = client.chat.completions.create(
        model="claude-sonnet-4-20250514",
        messages=conversation_history
    )

    assistant_reply = response.choices[0].message.content

    conversation_history.append({
        "role": "assistant",
        "content": assistant_reply
    })

    return assistant_reply


# Example multi-turn exchange
print(chat("What is Planview Portfolios?"))
print(chat("How does it differ from Planview Projectplace?"))
print(chat("Which one is better suited for enterprise PMOs?"))
```

---

## Step 7 — Streaming Responses

For long responses, streaming lets you display text as it's generated.

```python
from openai import OpenAI

client = OpenAI(
    api_key=API_KEY,
    base_url=f"{BASE_URL}/api"
)

stream = client.chat.completions.create(
    model="claude-sonnet-4-20250514",
    messages=[
        {
            "role": "user",
            "content": "Write a short project status update for a delayed software release."
        }
    ],
    stream=True
)

for chunk in stream:
    delta = chunk.choices[0].delta
    if delta.content:
        print(delta.content, end="", flush=True)

print()  # Newline at the end
```

---

## Common API Endpoints Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/models` | GET | List all available models |
| `/api/chat/completions` | POST | Send a chat message and get a response |
| `/api/v1/models` | GET | FalconAI-compatible model list |
| `/api/v1/chat/completions` | POST | FalconAI-compatible chat completions |

📖 **Full docs:** [docs.openwebui.com/reference/api-endpoints](https://docs.openwebui.com/reference/api-endpoints)

---

## Request & Response Structure

### Chat Completion Request Body

```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user",   "content": "Your question or prompt here." }
  ],
  "temperature": 0.7,
  "max_tokens": 1024,
  "stream": false
}
```

### Chat Completion Response Structure

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1749000000,
  "model": "claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The assistant's reply appears here."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 128,
    "total_tokens": 170
  }
}
```

---

## Reusable Helper Class

Drop this into any project for a clean, reusable client:

```python
import os
import requests
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()


class FalconAIClient:
    """A simple client for the Falcon AI API."""

    def __init__(self):
        self.api_key = os.getenv("FALCON_API_KEY")
        self.base_url = os.getenv("FALCON_BASE_URL", "https://falconai.planview-prod.io")
        self.client = OpenAI(
            api_key=self.api_key,
            base_url=f"{self.base_url}/api"
        )

    def list_models(self) -> list[str]:
        """Return a list of available model IDs."""
        headers = {"Authorization": f"Bearer {self.api_key}"}
        response = requests.get(f"{self.base_url}/api/models", headers=headers)
        response.raise_for_status()
        return [m["id"] for m in response.json().get("data", [])]

    def ask(
        self,
        prompt: str,
        model: str = "claude-sonnet-4-20250514",
        system: str = "You are a helpful assistant.",
        temperature: float = 0.7
    ) -> str:
        """Send a single prompt and return the response text."""
        completion = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt}
            ],
            temperature=temperature
        )
        return completion.choices[0].message.content


# Usage example
if __name__ == "__main__":
    falcon = FalconAIClient()

    print("Available models:")
    for model in falcon.list_models():
        print(f"  - {model}")

    print("\n--- Response ---")
    answer = falcon.ask(
        prompt="What are the top 3 features of Falcon AI?",
        system="You are a Planview internal product expert."
    )
    print(answer)
```

---

## Troubleshooting

| Error | Likely Cause | Fix |
|---|---|---|
| `401 Unauthorized` | API key missing or invalid | Check your `Authorization` header and verify the key in Settings |
| `404 Not Found` | Wrong endpoint path | Double-check the URL — ensure `/api/` prefix is included |
| `403 Forbidden` | Key revoked or insufficient permissions | Regenerate your API key in Settings > Account |
| `422 Unprocessable Entity` | Bad request body (e.g., wrong model name) | Check the `model` field matches an available model ID |
| `429 Too Many Requests` | Rate limit hit | Add retry logic with exponential backoff |
| `Connection Error` | VPN or network issue | Ensure you're on the Planview network or VPN |

---

## 💡 Tips & Best Practices

- Store keys in `.env` files — never hardcode them in scripts or commit them to Git
- Use the `openai` SDK rather than raw `requests` for cleaner code and built-in retry handling
- Set a **system message** to give the model context about its role — this significantly improves response quality
- Use `temperature=0.0` for factual, deterministic tasks (summarization, classification) and higher values for creative tasks
- Pass the **full message history** for multi-turn workflows — the API is stateless by design
- Revoke unused keys in Settings to keep your account secure

---

*Falcon AI · Planview · Built on Open WebUI · Claude 4.x · Last updated April 2026*
