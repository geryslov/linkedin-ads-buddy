import { useEffect, useRef, useState } from 'react';
import { useAccountHealthCheck } from '@/hooks/useAccountHealthCheck';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles, Send, Loader2, RefreshCw, AlertTriangle,
  CheckCircle2, Activity, DollarSign, Zap, TrendingDown,
  ShieldCheck, ShieldAlert, Shield,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface AccountHealthCheckProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function AccountHealthCheck({ accessToken, selectedAccount }: AccountHealthCheckProps) {
  const {
    healthData, isLoadingData, dataError,
    runHealthCheck, askFollowUp,
    messages, isLoading, error, toolEvents, toolLabels, cancel,
  } = useAccountHealthCheck(accessToken);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAccount && accessToken) {
      runHealthCheck(selectedAccount);
    }
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, toolEvents]);

  const handleRefresh = () => {
    if (selectedAccount) runHealthCheck(selectedAccount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput('');
    askFollowUp(q);
  };

  const followUpQuestions = [
    'Which campaigns should I pause?',
    'How can I reduce CPL this week?',
    'What budget changes do you recommend?',
    'Analyze my audience targeting',
    'Compare lead gen vs engagement campaigns',
  ];

  // Summary cards from health data
  const summaryCards = [];
  if (healthData) {
    const fatigue = healthData.creativeFatigue?.creatives || [];
    const fatiguedCount = fatigue.filter((c: any) => c.status === 'fatigued').length;
    const warningCount = fatigue.filter((c: any) => c.status === 'warning').length;

    const pacing = healthData.budgetPacing;
    const leadGen = healthData.leadGenOverview?.summary;

    summaryCards.push(
      {
        label: 'Creative Health',
        value: fatiguedCount === 0 && warningCount === 0 ? 'Healthy' : `${fatiguedCount + warningCount} issues`,
        icon: fatiguedCount > 0 ? ShieldAlert : warningCount > 0 ? Shield : ShieldCheck,
        color: fatiguedCount > 0 ? 'text-red-600' : warningCount > 0 ? 'text-amber-600' : 'text-green-600',
        bgColor: fatiguedCount > 0 ? 'bg-red-500/7' : warningCount > 0 ? 'bg-amber-500/7' : 'bg-green-500/7',
        sub: fatiguedCount > 0 ? `${fatiguedCount} fatigued` : warningCount > 0 ? `${warningCount} warning` : 'All clear',
      },
      {
        label: 'Budget Pacing',
        value: pacing?.spentThisMonth != null ? `$${Math.round(pacing.spentThisMonth).toLocaleString()}` : '—',
        icon: DollarSign,
        color: 'text-primary',
        bgColor: 'bg-primary/7',
        sub: pacing?.daysRemaining != null ? `${pacing.daysRemaining} days left` : undefined,
      },
    );

    if (leadGen) {
      summaryCards.push(
        {
          label: 'Leads (30d)',
          value: leadGen.totalLeads?.toLocaleString() || '0',
          icon: Zap,
          color: 'text-primary',
          bgColor: 'bg-primary/7',
          sub: leadGen.avgCpl > 0 ? `$${leadGen.avgCpl.toFixed(2)} CPL` : undefined,
        },
        {
          label: 'CPL Trend',
          value: leadGen.cpl7d > 0 ? `$${leadGen.cpl7d.toFixed(2)}` : '—',
          icon: leadGen.cpl7d > leadGen.cpl30d * 1.1 ? TrendingDown : Activity,
          color: leadGen.cpl7d > leadGen.cpl30d * 1.1 ? 'text-red-600' : 'text-green-600',
          bgColor: leadGen.cpl7d > leadGen.cpl30d * 1.1 ? 'bg-red-500/7' : 'bg-green-500/7',
          sub: '7d average',
        },
      );
    }
  }

  // Loading
  if (isLoadingData && !healthData) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3 pb-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4.5 w-4.5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm">Running account health check...</p>
            <p className="text-xs text-muted-foreground">Fetching budget pacing, creative fatigue, performance data, lead gen overview</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  // Error
  if (dataError && !healthData) {
    return (
      <div className="border border-destructive/20 rounded-lg p-8 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="font-medium text-destructive mb-1">Health check failed</p>
        <p className="text-sm text-muted-foreground mb-4">{dataError}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      {summaryCards.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, color, bgColor, sub }) => (
            <div key={label} className="border border-border/60 rounded-lg px-3.5 py-3 bg-card shadow-sm flex items-start gap-3">
              <div className={cn('p-1.5 rounded-md border border-border/20 mt-0.5 shrink-0', bgColor)}>
                <Icon className={cn('h-3.5 w-3.5', color)} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
                <p className={cn('text-lg font-bold tabular-nums mt-1 leading-none', color)}>{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis Panel */}
      <div className={cn(
        'border rounded-xl bg-card shadow-sm overflow-hidden transition-all duration-300',
        isLoading ? 'border-primary/40 shadow-[0_0_0_1px_hsl(221_83%_53%_/_0.08)]' : 'border-primary/20',
      )}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary/10 bg-primary/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className={cn('h-6 w-6 rounded-md flex items-center justify-center transition-colors', isLoading ? 'bg-primary/20' : 'bg-primary/10')}>
              <Sparkles className={cn('h-3.5 w-3.5 text-primary', isLoading && 'animate-pulse')} />
            </div>
            <span className="text-sm font-semibold">AI Health Diagnosis</span>
            {isLoading && (
              <div className="flex gap-0.5 items-center ml-0.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1 w-1 rounded-full bg-primary/50 animate-bounce"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoadingData} className="h-7 text-xs">
            <RefreshCw className={cn('h-3 w-3 mr-1', isLoadingData && 'animate-spin')} /> Re-check
          </Button>
        </div>

        {isLoading && (
          <div className="h-0.5 bg-primary/10 overflow-hidden">
            <div className="h-full bg-primary/40 animate-pulse w-full" />
          </div>
        )}

        <div className="relative">
          <div ref={scrollRef} className="h-[500px] overflow-y-auto scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
            <div className="px-5 py-4 space-y-5">
              {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-3">
                    <Activity className="h-4.5 w-4.5 text-primary/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">Health check results will appear here</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Budget pacing, creative fatigue, CPL trends — all in one diagnosis</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex flex-col gap-0'}>
                  {msg.role === 'user' ? (
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[75%] shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="rounded-2xl rounded-tl-sm bg-muted/30 border border-border/40 px-4 py-3.5">
                      <div className="prose prose-sm dark:prose-invert max-w-none
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1.5
                        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                        [&_li]:text-[13px] [&_p]:text-[13px] [&_p]:leading-relaxed
                        [&_strong]:text-foreground
                        [&_table]:text-xs [&_th]:py-1.5 [&_td]:py-1.5 [&_th]:px-2 [&_td]:px-2
                        [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-border/50 [&_td]:border-border/50
                        [&_th]:bg-muted/40 [&_th]:font-semibold
                        [&_ul]:space-y-0.5 [&_ol]:space-y-0.5
                      ">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {toolEvents.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {toolEvents.map(evt => (
                    <div key={evt.id} className={cn(
                      'inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border w-fit transition-all duration-300',
                      evt.status === 'running' ? 'bg-primary/5 border-primary/25 text-primary'
                        : evt.status === 'error' ? 'bg-destructive/5 border-destructive/20 text-destructive/70 opacity-60'
                        : 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400 opacity-70',
                    )}>
                      {evt.status === 'running' ? <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        : evt.status === 'error' ? <AlertTriangle className="h-3 w-3 shrink-0" />
                        : <CheckCircle2 className="h-3 w-3 shrink-0" />}
                      {toolLabels[evt.tool] ?? evt.tool.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}

              {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
                <div className="rounded-2xl rounded-tl-sm bg-muted/20 border border-border/30 px-4 py-3">
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
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>

        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Follow-up</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpQuestions.map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground
                    hover:bg-primary/5 hover:border-primary/30 hover:text-foreground transition-all duration-150 cursor-pointer">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mb-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t border-border/40 bg-muted/5">
          <Input value={input} onChange={e => setInput(e.target.value)}
            placeholder="Ask about your account health, campaigns, budget, or creatives..."
            disabled={isLoading || isLoadingData} className="flex-1 h-9 text-sm" />
          {isLoading ? (
            <Button type="button" size="icon" variant="ghost" onClick={cancel} className="h-9 w-9 text-muted-foreground hover:text-destructive">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!input.trim()} className="h-9 w-9">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
