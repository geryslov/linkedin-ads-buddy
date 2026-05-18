import { useState, useCallback, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolEvent {
  id: string;
  tool: string;
  status: 'running' | 'done' | 'error';
  timestamp: number;
}

interface AskOptions {
  mode?: 'agentic';
  accountId?: string;
  accessToken?: string;
}

const ANALYZE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-data`;

const TOOL_LABELS: Record<string, string> = {
  get_creative_performance:  'Fetching creative performance',
  get_creative_fatigue:      'Checking fatigue signals',
  get_campaign_analytics:    'Fetching campaign analytics',
  get_demographic_breakdown: 'Fetching demographic data',
  get_budget_pacing:         'Checking budget pacing',
};

export function useAIAnalysis() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(async (
    question: string,
    data: unknown,
    reportType = 'creative_performance',
    options: AskOptions = {},
  ) => {
    setError(null);
    setIsLoading(true);
    setToolEvents([]);

    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantSoFar = '';

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      const text = assistantSoFar;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: text } : m));
        }
        return [...prev, { role: 'assistant', content: text }];
      });
    };

    try {
      const body: Record<string, unknown> = { question, data, reportType };
      if (options.mode === 'agentic' && options.accountId && options.accessToken) {
        body.mode = 'agentic';
        body.accountId = options.accountId;
        body.accessToken = options.accessToken;
      }

      const resp = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({ error: 'Request failed' }));
        setError(errBody.error || `Error ${resp.status}`);
        setMessages(prev => prev.filter(m => m !== userMsg));
        setIsLoading(false);
        return;
      }

      if (!resp.body) throw new Error('No response body');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);

            // Standard text delta
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) { upsert(content); continue; }

            // Tool-call event: { type: "tool_call", tool: "...", id: "..." }
            if (parsed.type === 'tool_call') {
              const event: ToolEvent = {
                id:        parsed.id || parsed.tool,
                tool:      parsed.tool,
                status:    'running',
                timestamp: Date.now(),
              };
              setToolEvents(prev => {
                const exists = prev.find(e => e.id === event.id);
                return exists ? prev : [...prev, event];
              });
              continue;
            }

            // Tool-result event: { type: "tool_result", tool: "...", id: "...", done: true, error?: true }
            if (parsed.type === 'tool_result') {
              setToolEvents(prev =>
                prev.map(e =>
                  e.id === (parsed.id || parsed.tool)
                    ? { ...e, status: parsed.error ? 'error' : 'done' }
                    : e
                )
              );
              continue;
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        for (let raw of buffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch { /* ignore */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to get AI response');
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    setToolEvents([]);
  }, []);

  return { messages, isLoading, error, toolEvents, toolLabels: TOOL_LABELS, ask, cancel, clearHistory };
}
