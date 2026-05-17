import { useEffect, useRef, useState } from 'react';
import { useCreativeAnalyzer } from '@/hooks/useCreativeAnalyzer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Send, Loader2, RefreshCw, AlertTriangle, TrendingDown, CheckCircle2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface CreativeAnalyzerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function CreativeAnalyzer({ accessToken, selectedAccount }: CreativeAnalyzerProps) {
  const {
    analysisData, isLoadingData, dataError,
    fetchAndAnalyze, askFollowUp,
    messages, isLoading, error, cancel, clearHistory,
  } = useCreativeAnalyzer(accessToken);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasRun, setHasRun] = useState(false);

  // Auto-fetch on mount when account is selected
  useEffect(() => {
    if (selectedAccount && accessToken && !hasRun) {
      setHasRun(true);
      fetchAndAnalyze(selectedAccount);
    }
  }, [selectedAccount, accessToken, hasRun, fetchAndAnalyze]);

  // Auto-scroll on new messages
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
    askFollowUp(q);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      clearHistory();
      fetchAndAnalyze(selectedAccount);
    }
  };

  const followUpQuestions = [
    'Which creatives should I pause right now?',
    'What headline patterns are driving the best CTR?',
    'Show me the delivery decline — which ads are getting throttled?',
    'What new creative variations should I test next?',
    'Compare performance by campaign — any outliers?',
  ];

  if (isLoadingData && !analysisData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <div>
            <p className="font-medium">Analyzing your creatives...</p>
            <p className="text-sm text-muted-foreground">Fetching performance data and fatigue signals across multiple time frames</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (dataError && !analysisData) {
    return (
      <div className="border border-destructive/30 rounded-lg p-6 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
        <p className="font-medium text-destructive">{dataError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {analysisData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-border/70 rounded-lg p-4 bg-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creatives Analyzed</p>
            <p className="text-2xl font-bold mt-1">{analysisData.summary.totalCreatives}</p>
            <p className="text-xs text-muted-foreground">{analysisData.summary.activeCreatives} active</p>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fatigue Status</p>
            <div className="flex items-center gap-2 mt-1">
              {analysisData.summary.fatigued > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                  {analysisData.summary.fatigued} fatigued
                </Badge>
              )}
              {analysisData.summary.warning > 0 && (
                <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                  {analysisData.summary.warning} warning
                </Badge>
              )}
              {analysisData.summary.fatigued === 0 && analysisData.summary.warning === 0 && (
                <Badge variant="outline" className="text-xs border-green-500/50 text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> All healthy
                </Badge>
              )}
            </div>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">7-Day Spend</p>
            <p className="text-2xl font-bold mt-1">${analysisData.summary.totalSpend7d.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">{analysisData.summary.totalImpressions7d.toLocaleString()} impressions</p>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg CTR (7d)</p>
            <p className="text-2xl font-bold mt-1">{analysisData.summary.avgCtr7d.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* AI Analysis panel — inline, not dialog */}
      <div className="border border-border/70 rounded-lg bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI Creative Analysis</span>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoadingData}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingData ? 'animate-spin' : ''}`} />
            Re-analyze
          </Button>
        </div>

        {/* Messages */}
        <ScrollArea className="max-h-[60vh] px-5 py-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground text-sm py-8">
                <p>Waiting for analysis to complete...</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                {msg.role === 'user' ? (
                  <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm max-w-[85%]">
                    <p>{msg.content}</p>
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing your creatives...
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Follow-up suggestions — show after first analysis completes */}
        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-2">Follow-up questions:</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-xs px-2.5 py-1 rounded-full border border-border hover:bg-muted hover:border-primary/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        {error && (
          <div className="mx-5 mb-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2 px-5 py-3 border-t border-border/50">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your creatives — fatigue, patterns, what to do next..."
            disabled={isLoading || isLoadingData}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
