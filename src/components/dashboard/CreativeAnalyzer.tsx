import { useEffect, useRef, useState } from 'react';
import { useCreativeAnalyzer } from '@/hooks/useCreativeAnalyzer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sparkles, Send, Loader2, RefreshCw, AlertTriangle, TrendingDown,
  TrendingUp, CheckCircle2, ChevronDown, ChevronRight, Minus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { CreativePerformanceRow } from '@/hooks/useCreativePerformanceReport';
import type { CreativeFatigueItem } from '@/hooks/useCreativeFatigue';

interface CreativeAnalyzerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

type StatusGroup = 'fatigued' | 'warning' | 'healthy' | 'no_data';

function TrendIndicator({ value, invert }: { value: number; invert?: boolean }) {
  const isPositive = invert ? value < 0 : value > 0;
  const isNegative = invert ? value > 0 : value < 0;
  if (Math.abs(value) < 1) return <Minus className="h-3 w-3 text-muted-foreground" />;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
      isPositive ? 'text-green-600' : isNegative ? 'text-red-500' : 'text-muted-foreground'
    }`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'fatigued':
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Fatigued</Badge>;
    case 'warning':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">Warning</Badge>;
    case 'healthy':
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/50 text-green-600">Healthy</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0">—</Badge>;
  }
}

function CreativeGroupTable({
  title,
  icon,
  creatives,
  fatigueMap,
  defaultOpen,
}: {
  title: string;
  icon: React.ReactNode;
  creatives: CreativePerformanceRow[];
  fatigueMap: Map<string, CreativeFatigueItem>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (creatives.length === 0) return null;

  return (
    <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">({creatives.length})</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-border/50">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted/20 text-xs">
                <TableHead className="font-semibold">Creative Name</TableHead>
                <TableHead className="font-semibold">Campaign</TableHead>
                <TableHead className="font-semibold text-center">Status</TableHead>
                <TableHead className="font-semibold text-right">Impr (7d)</TableHead>
                <TableHead className="font-semibold text-right">Clicks (7d)</TableHead>
                <TableHead className="font-semibold text-right">CTR (7d)</TableHead>
                <TableHead className="font-semibold text-right">CTR (30d)</TableHead>
                <TableHead className="font-semibold text-center">CTR Trend</TableHead>
                <TableHead className="font-semibold text-right">Spend (7d)</TableHead>
                <TableHead className="font-semibold text-center">Delivery Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creatives.map((c, idx) => {
                const fatigue = fatigueMap.get(c.creativeName);
                const ctrChange = c.last30d.ctr > 0
                  ? ((c.last7d.ctr - c.last30d.ctr) / c.last30d.ctr) * 100
                  : 0;
                const deliveryChange = c.last30d.impressions > 0
                  ? ((c.last7d.impressions * (30 / 7)) - c.last30d.impressions) / c.last30d.impressions * 100
                  : 0;
                const campaignNames = c.campaigns.map((camp: any) => camp.campaignName).join(', ');

                return (
                  <TableRow key={idx} className="hover:bg-muted/20 text-xs">
                    <TableCell className="font-medium max-w-[220px]">
                      <span className="block truncate" title={c.creativeName}>
                        {c.creativeName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <span className="block truncate text-muted-foreground" title={campaignNames}>
                        {campaignNames || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={fatigue?.status || 'healthy'} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.last7d.impressions.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.last7d.clicks.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.last7d.ctr.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {c.last30d.ctr.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center">
                      <TrendIndicator value={ctrChange} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ${c.last7d.spent.toFixed(0)}
                    </TableCell>
                    <TableCell className="text-center">
                      <TrendIndicator value={deliveryChange} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
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

  useEffect(() => {
    if (selectedAccount && accessToken && !hasRun) {
      setHasRun(true);
      fetchAndAnalyze(selectedAccount);
    }
  }, [selectedAccount, accessToken, hasRun, fetchAndAnalyze]);

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
      setHasRun(false);
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

  // Group creatives by fatigue status
  const groupedCreatives = (() => {
    if (!analysisData) return { fatigued: [], warning: [], healthy: [], no_data: [] };

    const fatigueMap = new Map<string, CreativeFatigueItem>();
    for (const f of analysisData.fatigueItems) {
      fatigueMap.set(f.creativeName, f);
    }

    const groups: Record<StatusGroup, CreativePerformanceRow[]> = {
      fatigued: [], warning: [], healthy: [], no_data: [],
    };

    for (const row of analysisData.performanceRows) {
      const fatigue = fatigueMap.get(row.creativeName);
      if (!fatigue) {
        if (row.last7d.impressions > 0) groups.healthy.push(row);
        else groups.no_data.push(row);
      } else {
        groups[fatigue.status as StatusGroup]?.push(row) ?? groups.healthy.push(row);
      }
    }

    return groups;
  })();

  const fatigueMap = new Map<string, CreativeFatigueItem>();
  if (analysisData) {
    for (const f of analysisData.fatigueItems) {
      fatigueMap.set(f.creativeName, f);
    }
  }

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
        <Skeleton className="h-64 rounded-lg" />
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
          <div className="border border-border/70 rounded-lg p-4 bg-card shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Creatives Analyzed</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{analysisData.summary.totalCreatives}</p>
            <p className="text-xs text-muted-foreground">{analysisData.summary.activeCreatives} active</p>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fatigue Status</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {analysisData.summary.fatigued > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  <TrendingDown className="h-3 w-3 mr-0.5" />
                  {analysisData.summary.fatigued} fatigued
                </Badge>
              )}
              {analysisData.summary.warning > 0 && (
                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                  {analysisData.summary.warning} warning
                </Badge>
              )}
              {analysisData.summary.fatigued === 0 && analysisData.summary.warning === 0 && (
                <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600">
                  <CheckCircle2 className="h-3 w-3 mr-0.5" /> All healthy
                </Badge>
              )}
            </div>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">7-Day Spend</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">${analysisData.summary.totalSpend7d.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-muted-foreground">{analysisData.summary.totalImpressions7d.toLocaleString()} impressions</p>
          </div>
          <div className="border border-border/70 rounded-lg p-4 bg-card shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Avg CTR (7d)</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{analysisData.summary.avgCtr7d.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Grouped creative breakdown */}
      {analysisData && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Creative Breakdown by Health Status</h3>

          <CreativeGroupTable
            title="Fatigued — Action Required"
            icon={<TrendingDown className="h-4 w-4 text-red-500" />}
            creatives={groupedCreatives.fatigued}
            fatigueMap={fatigueMap}
            defaultOpen={true}
          />
          <CreativeGroupTable
            title="Warning — Monitor Closely"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
            creatives={groupedCreatives.warning}
            fatigueMap={fatigueMap}
            defaultOpen={true}
          />
          <CreativeGroupTable
            title="Healthy — Performing Well"
            icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
            creatives={groupedCreatives.healthy}
            fatigueMap={fatigueMap}
            defaultOpen={false}
          />
        </div>
      )}

      {/* AI Analysis panel */}
      <div className="border border-border/70 rounded-lg bg-card shadow-sm overflow-hidden">
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

        <ScrollArea className="max-h-[50vh] px-5 py-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.length === 0 && !isLoading && (
              <div className="text-center text-muted-foreground text-sm py-6">
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

        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-3 border-t border-border/50 bg-muted/20">
            <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Follow-up questions</p>
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
