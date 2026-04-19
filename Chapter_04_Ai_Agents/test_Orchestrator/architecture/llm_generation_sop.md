# SOP: LLM Test Plan Generation
## Goal
Generate a structured test plan from Jira issues using the configured LLM provider.

## Supported Providers
| Provider | API Style | Auth | Notes |
|----------|-----------|------|-------|
| claude | Anthropic SDK | api_key | Supports prompt caching |
| groq | groq SDK | api_key | Fast inference |
| grok | OpenAI-compatible REST | api_key | xAI API |
| ollama | Local REST | none | Requires running Ollama server |

## Steps
1. Load test plan template from `test_plan_templates/test_plan.md` (cached at startup)
2. Run `check_missing_info()` — flag issues with no acceptance criteria or short descriptions
3. Build system prompt with strict template enforcement instructions
4. Build user message with all Jira issue details + additional context
5. Call the provider-specific generate function
6. Return `{"success": True, "test_plan": "markdown string"}`

## Prompt Rules (Rule 1 + Rule 2 from gemini.md)
- System prompt instructs LLM to follow template exactly
- Missing info → output `[NEEDS INFO: <description>]` not invented content
- Temperature: 0.3 for consistency
- Max tokens: 4096

## Prompt Caching (Claude only)
Apply `cache_control: {"type": "ephemeral"}` to system prompt block.
This caches the large system prompt + template for 5 minutes, reducing cost on repeated generations.

## Tools
- `tools/llm_client.py`: `test_llm_connection()`, `check_missing_info()`, `generate_test_plan()`
