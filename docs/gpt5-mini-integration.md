# GPT-5 Mini — Integration Reference (Feb 2026)

## Model Info
- **Model ID:** `gpt-5-mini`
- **Snapshot:** `gpt-5-mini-2025-08-07`
- **Status:** Stable (released Aug 7, 2025)
- **Knowledge cutoff:** May 31, 2024
- **Context window:** 400,000 tokens
- **Max output tokens:** 128,000

## ⚠️ CRITICAL: GPT-5 is a Reasoning Model

GPT-5 series (including mini) are reasoning models like o1/o3. They have major API differences:

### Unsupported Parameters (API REJECTS these)
- ❌ `temperature` — fixed internally, cannot be set (only default 1 accepted)
- ❌ `top_p` — not supported
- ❌ `logprobs` — not supported
- ❌ `logit_bias` — not supported
- ❌ `frequency_penalty` — not supported
- ❌ `presence_penalty` — not supported
- ❌ `stop` sequences — not supported
- ❌ `max_tokens` — not supported (use `max_output_tokens` in Responses API, or `max_completion_tokens` in Chat Completions)

### Supported Parameters
- ✅ `reasoning.effort` — `none`, `low`, `medium`, `high` (controls reasoning depth)
- ✅ `max_output_tokens` — max tokens to generate
- ✅ `instructions` — system-level instructions (replaces system message)
- ✅ `text.format.type` — `"text"` or `"json_object"` for structured output

## API — Use Responses API (NOT Chat Completions)

OpenAI recommends the Responses API (`v1/responses`) for GPT-5 models. It provides:
- Better intelligence (passes chain-of-thought between turns)
- Fewer reasoning tokens, higher cache hits, lower latency
- Native support for tools, previous_response_id chaining

### Endpoint
```
POST https://api.openai.com/v1/responses
```

Auth: `Authorization: Bearer YOUR_API_KEY` header.

## Pricing (per 1M tokens)
| | Input | Cached Input | Output |
|---|-------|-------------|--------|
| **GPT-5 mini** | **$0.25** | **$0.025** | **$2.00** |
| GPT-5 | $1.25 | — | — |
| GPT-5 nano | $0.05 | — | — |

## Request Format (Responses API)
```json
{
  "model": "gpt-5-mini",
  "instructions": "You are a code search strategy planner. Output only valid JSON.",
  "input": "How does authentication work?",
  "max_output_tokens": 6000,
  "reasoning": {
    "effort": "low"
  },
  "text": {
    "format": {
      "type": "json_object"
    }
  }
}
```

### Key Fields
- **model**: `"gpt-5-mini"`
- **instructions**: System-level instructions (replaces `messages[0].role="system"`)
- **input**: User message string, OR array of message objects `[{"role": "user", "content": "..."}]`
- **max_output_tokens**: Max tokens to generate. We use 6000 for ctx.
- **reasoning.effort**: `"low"` for fast/cheap steering, `"medium"` for complex queries
- **text.format.type**: `"json_object"` for structured JSON output, `"text"` for plain text
- **previous_response_id**: Chain multi-turn conversations by passing previous response ID

### NO temperature, top_p, or other sampling params!

## Response Format
```json
{
  "id": "resp_...",
  "object": "response",
  "model": "gpt-5-mini-2025-08-07",
  "status": "completed",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "...generated text..."
        }
      ]
    }
  ],
  "output_text": "...generated text (convenience field)...",
  "usage": {
    "input_tokens": 42,
    "output_tokens": 150,
    "output_tokens_details": {
      "reasoning_tokens": 30
    },
    "total_tokens": 192
  }
}
```

### Reading the response
- **Quick access:** `response.output_text` — the full text output as a single string
- **Detailed:** `response.output[0].content[0].text` — from the output array
- **Tokens:** `response.usage.input_tokens`, `response.usage.output_tokens`

## Full curl Example
```bash
curl -X POST https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CTX_OPENAI_KEY" \
  -d '{
    "model": "gpt-5-mini",
    "instructions": "You are a code search planner. Output only valid JSON.",
    "input": "How does authentication work?",
    "max_output_tokens": 6000,
    "reasoning": {"effort": "low"},
    "text": {"format": {"type": "json_object"}}
  }'
```

## What to change in ctx

**File:** `src/steering/llm.ts` — OpenAI provider needs full rewrite:

1. **Endpoint:** `https://api.openai.com/v1/chat/completions` → `https://api.openai.com/v1/responses`
2. **Request body:** Complete restructure:
   - `messages` array → `instructions` (system) + `input` (user)
   - Remove `temperature` entirely (API rejects it)
   - Remove `max_completion_tokens` → use `max_output_tokens: 6000`
   - Add `reasoning: { effort: "low" }`
   - For JSON output: add `text: { format: { type: "json_object" } }`
3. **Response parsing:** 
   - `data.choices[0].message.content` → `data.output_text` (or `data.output[0].content[0].text`)
4. **Test updates:** Mock the new request/response format
