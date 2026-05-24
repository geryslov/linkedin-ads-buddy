import { useEffect, useRef, useState } from 'react';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { Button } from '@/components/ui/button';
import {
  Sparkles, X, Send, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, Maximize2, Minimize2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface AgenticChatDrawerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const QUICK_PROMPTS = [
  'How is my account performing this week?',
  'Which creatives are fatigued?',
  'What is my budget pacing status?',
  'Which audiences convert best?',
  'Give me a quick account health check',
];

export function AgenticChatDrawer({ accessToken, selectedAccount }: AgenticChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const ai = useAIAnalysis();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ai.messages, ai.toolEvents]);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || !accessToken || !selectedAccount) return;
    setInput('');
    ai.ask(q, null, 'creative_analysis', {
      mode: 'agentic',
      accountId: selectedAccount,
      accessToken,
    });
  };

  const handleQuickPrompt = (q: string) => {
    if (!accessToken || !selectedAccount) return;
    ai.ask(q, null, 'creative_analysis', {
      mode: 'agentic',
      accountId: selectedAccount,
      accessToken,
    });
  };

  // Floating trigger button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
        title="AI Campaign Advisor (⌘K)"
      >
        <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        'fixed z-50 bg-card border border-border/80 rounded-xl shadow-2xl flex flex-col transition-all duration-300',
        isExpanded
          ? 'bottom-4 right-4 top-4 w-[520px]'
          : 'bottom-6 right-6 w-[420px] h-[560px]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-primary/[0.03] rounded-t-xl shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn('h-6 w-6 rounded-md flex items-center justify-center', ai.isLoading ? 'bg-primary/20' : 'bg-primary/10')}>
            <Sparkles className={cn('h-3.5 w-3.5 text-primary', ai.isLoading && 'animate-pulse')} />
          </div>
          <div>
            <span className="text-sm font-semibold">AI Advisor</span>
            <span className="text-[10px] text-muted-foreground ml-2">⌘K</span>
          </div>
          {ai.isLoading && (
            <div className="flex gap-0.5 items-center ml-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="h-1 w-1 rounded-full bg-primary/50 animate-bounce"
                  style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Streaming bar */}
      {ai.isLoading && (
        <div className="h-0.5 bg-primary/10 overflow-hidden shrink-0">
          <div className="h-full bg-primary/40 animate-pulse w-full" />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth min-h-0" style={{ scrollbarWidth: 'thin' }}>
        <div className="px-4 py-3 space-y-4">
          {ai.messages.length === 0 && !ai.isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-10 w-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-3">
                <Sparkles className="h-4.5 w-4.5 text-primary/60" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">AI Campaign Advisor</p>
              <p className="text-xs text-muted-foreground mb-4">Ask anything about your LinkedIn Ads account</p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-[320px]">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => handleQuickPrompt(q)}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground
                      hover:bg-primary/5 hover:border-primary/30 hover:text-foreground transition-all duration-150 cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ai.messages.map((msg, i) => (
            <div key={i}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 text-[13px] max-w-[80%] shadow-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl rounded-tl-sm bg-muted/30 border border-border/40 px-3.5 py-3">
                  <div className="prose prose-sm dark:prose-invert max-w-none
                    [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                    [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-1.5
                    [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1
                    [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                    [&_li]:text-[12px] [&_p]:text-[12px] [&_p]:leading-relaxed
                    [&_strong]:text-foreground
                    [&_table]:text-[11px] [&_th]:py-1 [&_td]:py-1 [&_th]:px-1.5 [&_td]:px-1.5
                    [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border/50 [&_td]:border-border/50
                    [&_th]:bg-muted/40 [&_th]:font-semibold
                    [&_code]:text-[11px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded
                    [&_ul]:space-y-0.5 [&_ol]:space-y-0.5
                  ">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Tool events */}
          {ai.toolEvents.length > 0 && (
            <div className="flex flex-col gap-1">
              {ai.toolEvents.map(evt => (
                <div
                  key={evt.id}
                  className={cn(
                    'inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border w-fit transition-all duration-300',
                    evt.status === 'running'
                      ? 'bg-primary/5 border-primary/25 text-primary'
                      : evt.status === 'error'
                      ? 'bg-destructive/5 border-destructive/20 text-destructive/70 opacity-60'
                      : 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400 opacity-70',
                  )}
                >
                  {evt.status === 'running' ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" />
                  ) : evt.status === 'error' ? (
                    <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                  )}
                  {ai.toolLabels[evt.tool] ?? evt.tool.replace(/_/g, ' ')}
                </div>
              ))}
            </div>
          )}

          {ai.isLoading && (ai.messages.length === 0 || ai.messages[ai.messages.length - 1]?.role !== 'assistant') && (
            <div className="rounded-2xl rounded-tl-sm bg-muted/20 border border-border/30 px-3.5 py-2.5">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Error */}
      {ai.error && (
        <div className="mx-3 mb-2 text-[11px] text-destructive bg-destructive/10 rounded-md px-2.5 py-1.5 flex items-center gap-1.5 shrink-0">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {ai.error}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2.5 border-t border-border/40 bg-muted/5 rounded-b-xl shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={selectedAccount ? 'Ask about your campaigns...' : 'Select an account first'}
          disabled={ai.isLoading || !selectedAccount}
          className="flex-1 h-8 text-[13px] bg-transparent border border-border/60 rounded-md px-2.5 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
          autoFocus
        />
        {ai.isLoading ? (
          <Button type="button" size="icon" variant="ghost" onClick={ai.cancel} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() || !selectedAccount} className="h-8 w-8">
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </form>
    </div>
  );
}
