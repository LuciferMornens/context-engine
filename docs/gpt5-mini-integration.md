# GPT-5 Mini — Integration Reference (Feb 2026)

## Model Info
- **Model ID:** `gpt-5-mini`
- **Snapshot:** `gpt-5-mini-2025-08-07`
- **Status:** Stable (released Aug 7, 2025)
- **Knowledge cutoff:** May 31, 2024
- **Context window:** 400,000 tokens
- **Max output tokens:** 128,000

## API Endpoint
```
https://api.openai.com/v1/chat/completions
```

Auth: `Authorization: Bearer YOUR_API_KEY` header.

## Pricing (per 1M tokens)
| | Input | Cached Input | Output |
|---|-------|-------------|--------|
| GPT-5 | $1.25 | — | — |
| **GPT-5 mini** | **$0.25** | **$0.025** | **$2.00** |
| GPT-5 nano | $0.05 | — | — |

## ⚠️ CRITICAL: max_completion_tokens (NOT max_tokens)

GPT-5 series **does NOT support `max_tokens`**. You MUST use `max_completion_tokens` instead.

Sending `max_tokens` will return:
```
Error: Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.
```

## Request Parameters
```json
{
  "model": "gpt-5-mini",
  "messages": [...],
  "temperature": 0.1,
  "max_completion_tokens": 6000,
  "top_p": 1.0,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0,
  "response_format": {"type": "json_object"},
  "seed": 12345
}
```

### Key Parameters
- **temperature** (0.0–2.0, default 1.0): Lower = more deterministic. We use 0.1 for ctx steering.
- **max_completion_tokens**: Max tokens to generate. Replaces `max_tokens` for GPT-5 series. We use 6000.
- **response_format**: Set `{"type": "json_object"}` for structured JSON output.
- **reasoning**: GPT-5 mini supports reasoning tokens natively.

## Capabilities
- Streaming ✅
- Function calling ✅
- Structured outputs ✅
- Web search tool ✅
- File search tool ✅
- Code interpreter ✅
- MCP ✅
- Fine-tuning ❌
- Distillation ❌

## Full Request Example
```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CTX_OPENAI_KEY" \
  -d '{
    "model": "gpt-5-mini",
    "messages": [
      {"role": "system", "content": "You are a code search planner."},
      {"role": "user", "content": "How does authentication work?"}
    ],
    "temperature": 0.1,
    "max_completion_tokens": 6000,
    "response_format": {"type": "json_object"}
  }'
```

## Response Format
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "gpt-5-mini-2025-08-07",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 150,
    "total_tokens": 192
  }
}
```

## Key Differences from GPT-4o-mini
- `max_tokens` → `max_completion_tokens` (BREAKING CHANGE)
- 400K context (up from 128K)
- 128K max output (up from 16K)
- Reasoning token support (built-in chain-of-thought)
- Better function calling and structured outputs
- Higher cost ($0.25/$2.00 vs $0.15/$0.60 per 1M)
- Same Chat Completions API endpoint and response format
