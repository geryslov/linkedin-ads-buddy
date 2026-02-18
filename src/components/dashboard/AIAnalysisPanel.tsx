import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { Send, Loader2, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AIAnalysisPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: unknown;
  reportType?: string;
}

export function AIAnalysisPanel({ open, onOpenChange, data, reportType = 'creative_performance' }: AIAnalysisPanelProps) {
  const { messages, isLoading, error, ask, cancel, clearHistory } = useAIAnalysis();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    ask(q, data, reportType);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Ask AI about your Creative Data
          </DialogTitle>
          <DialogDescription>
            Ask any question about your creative performance — trends, recommendations, anomalies, etc.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[50vh] pr-3" ref={scrollRef}>
          <div className="space-y-4 py-2">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <p>Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {['Which creative has the worst CPL trend?', 'What should I pause?', 'Summarize top performers'].map(q => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t border-border">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your creative data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="icon" onClick={clearHistory} title="Clear history">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
