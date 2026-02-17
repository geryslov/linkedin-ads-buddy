

# AI-Powered Q&A for Creative Reports

## Overview
Add an "Ask AI" button to the Creative Reports (Trend) tab that opens a dialog where you can type any question about your creative performance data. The AI analyzes your currently loaded data and streams back an answer in real-time.

No API key needed -- this uses the built-in Lovable AI, which is already configured.

## What You'll Get
- A floating "Ask AI" button in the Creative Reports toolbar
- A dialog with a text input where you type any question (e.g., "Which creative has the worst CPL trend?", "What should I pause?", "Summarize top performers")
- The AI sees all your loaded creative data (spend, CPL, CTR across all time periods, campaign breakdowns, trend flags)
- Streamed markdown response rendered in real-time
- Conversation history within the session so you can ask follow-up questions

## Changes

### 1. New Backend Function: `supabase/functions/analyze-data/index.ts`
- Receives the user's question + serialized creative report data
- Calls the Lovable AI gateway with a LinkedIn Ads analyst system prompt
- Streams the response back via SSE for real-time rendering
- Handles rate limit (429) and payment (402) errors gracefully

### 2. Update `supabase/config.toml`
- Add `[functions.analyze-data]` with `verify_jwt = false`

### 3. New React Hook: `src/hooks/useAIAnalysis.ts`
- Manages streaming state (loading, partial response, error, conversation history)
- Sends question + data to the `analyze-data` edge function
- Parses SSE stream token-by-token and builds the response progressively

### 4. New UI Component: `src/components/dashboard/AIAnalysisPanel.tsx`
- A Dialog triggered by the "Ask AI" button
- Text input for free-form questions
- Streaming markdown response area (using basic markdown rendering)
- Session-based conversation history (Q&A pairs)
- Loading indicator while streaming

### 5. Integration: `src/components/dashboard/CreativePerformanceReport.tsx`
- Add an "Ask AI" button next to the existing filters
- Pass the currently filtered/sorted creative data to the AI panel
- The AI receives all visible rows with their multi-period metrics

## Technical Details

### Data Passed to AI
The creative report data is serialized as JSON context. For each creative, the AI sees:
- Creative name, type, status, campaign count
- Spend, CPL, CTR for all 4 periods (7d, 14d, 30d, Last Month)
- Per-campaign breakdowns
- Trend flags (CPL rising, CTR declining)

### System Prompt
The backend instructs the AI to act as a LinkedIn Ads performance analyst, focusing on:
- Creative performance trends and anomalies
- Cost efficiency analysis (CPL, CPC, CTR)
- Fatigue/trend detection insights
- Actionable optimization recommendations
- Budget reallocation suggestions

### Streaming Flow
```text
User types question in dialog
  --> useAIAnalysis sends { question, data, reportType } to edge function
  --> Edge function calls Lovable AI gateway (streaming)
  --> SSE tokens streamed back to browser
  --> Rendered as markdown in real-time in the dialog
```

