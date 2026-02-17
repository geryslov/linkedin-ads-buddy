

# Switch to Anthropic Claude API

## Overview
Store the provided Anthropic API key as a secure backend secret and update the `analyze-data` edge function to call Claude instead of the Lovable AI gateway. No frontend changes needed.

## Steps

### 1. Store `ANTHROPIC_API_KEY` as a backend secret
- Securely save the provided API key so the edge function can access it

### 2. Update `supabase/functions/analyze-data/index.ts`
- Read `ANTHROPIC_API_KEY` instead of `LOVABLE_API_KEY`
- Call `https://api.anthropic.com/v1/messages` with model `claude-sonnet-4-20250514`
- Enable Anthropic streaming (`stream: true`)
- Parse Anthropic's SSE format (`content_block_delta` events with `text_delta`) and re-emit as OpenAI-compatible SSE format (`data: {"choices":[{"delta":{"content":"..."}}]}`) so the existing frontend works unchanged
- Keep the same system prompt and CORS handling
- Handle Anthropic-specific errors (401 invalid key, 429 rate limit, etc.)

### No other files change
The existing `useAIAnalysis.ts` hook and `AIAnalysisPanel.tsx` component already parse OpenAI-compatible SSE, so they work as-is with the translated stream.

## Technical Details

### Anthropic API call structure
```text
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
  model: claude-sonnet-4-20250514
  system: (LinkedIn Ads analyst prompt)
  messages: [{ role: "user", content: question + data }]
  max_tokens: 4096
  stream: true
```

### SSE translation (server-side)
Anthropic sends events like:
```text
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}
```

The edge function reads these and re-emits:
```text
data: {"choices":[{"delta":{"content":"Hello"}}]}
```

This keeps the frontend completely unchanged.

