# Gemini 3 Flash — Integration Reference (Feb 2026)

## Model Info
- **Model ID:** `gemini-3-flash-preview`
- **Status:** Public Preview (released Dec 17, 2025)
- **Knowledge cutoff:** January 2025
- **Context window:** 1,048,576 tokens (1M)
- **Max output tokens:** 65,536

## API Endpoint
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent
```

Auth: `?key=YOUR_API_KEY` query param, or `x-goog-api-key` header.

## Pricing (per 1M tokens)
- **Input:** ~$0.50 (same tier as 2.5 Flash)
- **Output:** ~$3.00
- **Cached input:** ~$0.05

## generationConfig Parameters
```json
{
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 6000,
    "topP": 0.95,
    "topK": 64,
    "responseMimeType": "application/json",
    "stopSequences": ["STOP"],
    "frequencyPenalty": 0.0,
    "presencePenalty": 0.0,
    "seed": 12345
  }
}
```

### Key Parameters
- **temperature** (0.0–2.0, default 1.0): Lower = more deterministic. We use 0.1 for ctx steering.
- **maxOutputTokens**: Max tokens to generate. We use 6000 for ctx.
- **topP** (0.0–1.0, default 0.95): Nucleus sampling.
- **topK** (default 64): Top-K sampling.
- **responseMimeType**: Set to `"application/json"` for structured JSON output.

### Gemini 3-Specific Features
- **thinking_level**: `minimal`, `low`, `medium`, `high` — controls internal reasoning depth
- **media_resolution**: `low`, `medium`, `high`, `ultra high` — controls vision token usage
- **Thought signatures**: Improved multi-turn function calling reliability
- **Streaming function calling**: Partial arg streaming

## System Instructions
Gemini uses `systemInstruction` at the top level (NOT as a message role):
```json
{
  "systemInstruction": {
    "parts": [{"text": "You are a code search planner."}]
  },
  "contents": [
    {"role": "user", "parts": [{"text": "How does auth work?"}]}
  ],
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 6000
  }
}
```

## Full Request Example
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=$CTX_GEMINI_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "systemInstruction": {"parts": [{"text": "You are a code search planner."}]},
    "contents": [{"role": "user", "parts": [{"text": "How does authentication work?"}]}],
    "generationConfig": {
      "temperature": 0.1,
      "maxOutputTokens": 6000,
      "responseMimeType": "application/json"
    }
  }'
```

## Response Format
```json
{
  "candidates": [{
    "content": {
      "parts": [{"text": "...generated text..."}],
      "role": "model"
    },
    "finishReason": "STOP"
  }],
  "usageMetadata": {
    "promptTokenCount": 42,
    "candidatesTokenCount": 150,
    "totalTokenCount": 192
  }
}
```

## Key Differences from Gemini 2.0 Flash
- Near-Pro level reasoning at Flash cost
- 1M context (same as 2.0)
- thinking_level replaces thinking_budget
- Better agentic workflows, multi-turn function calling
- Same REST API format — just swap model name
