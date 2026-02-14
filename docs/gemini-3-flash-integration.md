# Gemini 3 Flash — Integration Reference (Feb 2026)

## Model Info
- **Model ID:** `gemini-3-flash-preview`
- **Status:** Public Preview (released Dec 17, 2025)
- **Knowledge cutoff:** January 2025
- **Context window:** 1,048,576 tokens (1M)
- **Max output tokens:** 65,536

## API Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=YOUR_API_KEY
```

Auth: `?key=YOUR_API_KEY` query param, or `x-goog-api-key` header.

## Pricing (per 1M tokens)
- **Input:** ~$0.50 (same tier as 2.5 Flash)
- **Output:** ~$3.00
- **Cached input:** ~$0.05

## Supported Parameters (generationConfig)
Gemini 3 Flash is NOT a reasoning model — it supports standard sampling parameters:
- ✅ **temperature** (0.0–2.0, default 1.0): We use 0.1 for deterministic steering
- ✅ **maxOutputTokens**: We use 6000 for ctx
- ✅ **topP** (0.0–1.0, default 0.95)
- ✅ **topK** (default 64)
- ✅ **responseMimeType**: `"application/json"` for structured JSON output
- ✅ **stopSequences**: array of stop strings
- ✅ **frequencyPenalty**, **presencePenalty**

### Gemini 3-Specific Features
- **thinking_level**: `minimal`, `low`, `medium`, `high` — controls internal reasoning depth
- **media_resolution**: `low`, `medium`, `high`, `ultra high` — controls vision token usage
- **Thought signatures**: Improved multi-turn function calling reliability

## Request Format
```json
{
  "systemInstruction": {
    "parts": [{"text": "You are a code search planner. Output only valid JSON."}]
  },
  "contents": [
    {"role": "user", "parts": [{"text": "How does authentication work?"}]}
  ],
  "generationConfig": {
    "temperature": 0.1,
    "maxOutputTokens": 6000,
    "responseMimeType": "application/json"
  }
}
```

### Key Fields
- **systemInstruction**: System prompt (NOT as a message role — separate top-level field)
- **contents**: Array of message objects with `role` ("user" or "model") and `parts`
- **generationConfig.temperature**: 0.1 for ctx (near-deterministic)
- **generationConfig.maxOutputTokens**: 6000 for ctx
- **generationConfig.responseMimeType**: `"application/json"` for JSON mode

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

### Reading the response
- **Text:** `response.candidates[0].content.parts[0].text`
- **Tokens:** `response.usageMetadata.totalTokenCount`

## Full curl Example
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

## What to change in ctx
- **File:** `src/steering/llm.ts`
- **Endpoint:** Already correct: `gemini-3-flash-preview`
- **Add to request body:** `generationConfig: { temperature: 0.1, maxOutputTokens: 6000 }`
- API format is the same as before — just add the generationConfig
