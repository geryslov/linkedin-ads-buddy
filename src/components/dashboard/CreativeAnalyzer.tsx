import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreativeAnalyzer } from '@/hooks/useCreativeAnalyzer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sparkles, Send, Loader2, RefreshCw, AlertTriangle, TrendingDown,
  TrendingUp, CheckCircle2, ChevronDown, ChevronRight,
  BarChart3, Eye, MousePointerClick, DollarSign, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import type { CreativePerformanceRow } from '@/hooks/useCreativePerformanceReport';
import type { CreativeFatigueItem } from '@/hooks/useCreativeFatigue';

interface CreativeAnalyzerProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

type StatusGroup = 'fatigued' | 'warning' | 'healthy' | 'no_data';

const STATUS_CONFIG = {
  fatigued: { color: '#ef4444', bg: 'bg-red-500/8', border: 'border-red-500/30', text: 'text-red-600', label: 'Fatigued', accent: 'bg-red-500' },
  warning:  { color: '#f59e0b', bg: 'bg-amber-500/8', border: 'border-amber-500/30', text: 'text-amber-600', label: 'Warning', accent: 'bg-amber-500' },
  healthy:  { color: '#22c55e', bg: 'bg-green-500/8', border: 'border-green-500/30', text: 'text-green-600', label: 'Healthy', accent: 'bg-green-500' },
  no_data:  { color: '#94a3b8', bg: 'bg-slate-500/8', border: 'border-slate-500/30', text: 'text-slate-500', label: 'No Data', accent: 'bg-slate-400' },
} as const;

/** Tiny inline sparkline (48x18px) showing CTR trend across 4 periods */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={48} height={18}>
      <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#spark-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendBadge({ value, invert }: { value: number; invert?: boolean }) {
  const isPos = invert ? value < 0 : value > 0;
  const isNeg = invert ? value > 0 : value < 0;
  const abs = Math.abs(value);
  if (abs < 1) return <span className="text-[11px] text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
      isPos ? 'text-green-600' : isNeg ? 'text-red-500' : 'text-muted-foreground'
    }`}>
      {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {abs.toFixed(0)}%
    </span>
  );
}

/** Horizontal fatigue meter */
function FatigueMeter({ fatigued, warning, healthy, total }: { fatigued: number; warning: number; healthy: number; total: number }) {
  if (total === 0) return null;
  const pF = (fatigued / total) * 100;
  const pW = (warning / total) * 100;
  const pH = (healthy / total) * 100;
  return (
    <div className="flex items-center gap-3 w-full">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden flex">
        {pF > 0 && <div className="bg-red-500 transition-all duration-500" style={{ width: `${pF}%` }} />}
        {pW > 0 && <div className="bg-amber-400 transition-all duration-500" style={{ width: `${pW}%` }} />}
        {pH > 0 && <div className="bg-green-500 transition-all duration-500" style={{ width: `${pH}%` }} />}
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground shrink-0">
        {fatigued > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{fatigued}</span>}
        {warning > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{warning}</span>}
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{healthy}</span>
      </div>
    </div>
  );
}

function CreativeGroupSection({
  status, creatives, fatigueMap, defaultOpen,
}: {
  status: StatusGroup;
  creatives: CreativePerformanceRow[];
  fatigueMap: Map<string, CreativeFatigueItem>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const config = STATUS_CONFIG[status];
  if (creatives.length === 0) return null;
  const sorted = [...creatives].sort((a, b) => b.last7d.spent - a.last7d.spent);

  return (
    <div className={`relative rounded-lg overflow-hidden border ${config.border} transition-colors`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between pl-5 pr-4 py-3 hover:bg-muted/20 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          {status === 'fatigued' && <TrendingDown className="h-4 w-4 text-red-500" />}
          {status === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
          {status === 'healthy' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          <span className="text-sm font-semibold">{config.label}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.border} ${config.text}`}>
            {creatives.length}
          </Badge>
        </div>
        {open
          ? <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
        }
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border/40">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow className="bg-muted/15 [&>th]:py-2 [&>th]:text-[10px] [&>th]:uppercase [&>th]:tracking-wider [&>th]:font-semibold [&>th]:text-muted-foreground">
                <TableHead className="pl-5 w-[240px]">Creative</TableHead>
                <TableHead className="w-[180px]">Campaign</TableHead>
                <TableHead className="text-right w-[80px]">Impr</TableHead>
                <TableHead className="text-right w-[64px]">Clicks</TableHead>
                <TableHead className="text-right w-[64px]">CTR</TableHead>
                <TableHead className="text-center w-[56px]">Trend</TableHead>
                <TableHead className="text-center w-[56px]">Spark</TableHead>
                <TableHead className="text-right w-[72px]">Spend</TableHead>
                <TableHead className="text-center w-[64px]">Delivery</TableHead>
                {status !== 'healthy' && <TableHead className="w-[200px]">Signal</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c, idx) => {
                const fatigue = fatigueMap.get(c.creativeName);
                const ctrChange = c.last30d.ctr > 0
                  ? ((c.last7d.ctr - c.last30d.ctr) / c.last30d.ctr) * 100 : 0;
                const deliveryChange = c.last30d.impressions > 0
                  ? ((c.last7d.impressions * (30 / 7)) - c.last30d.impressions) / c.last30d.impressions * 100 : 0;
                const campaignNames = c.campaigns.map((camp: any) => camp.campaignName);
                const sparkData = [c.lastMonth.ctr, c.last30d.ctr, c.last14d.ctr, c.last7d.ctr];
                return (
                  <TableRow key={idx} className="hover:bg-muted/10 [&>td]:py-2.5 [&>td]:text-xs group">
                    <TableCell className="pl-5 font-medium">
                      <div className="max-w-[230px]">
                        <span className="block truncate text-foreground" title={c.creativeName}>{c.creativeName}</span>
                        <span className="block text-[10px] text-muted-foreground mt-0.5">
                          {c.type !== 'UNKNOWN' ? c.type.replace(/_/g, ' ').toLowerCase() : ''}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[170px]">
                        {campaignNames.slice(0, 2).map((name: string, ci: number) => (
                          <span key={ci} className="block truncate text-muted-foreground text-[11px]" title={name}>{name}</span>
                        ))}
                        {campaignNames.length > 2 && (
                          <span className="text-[10px] text-muted-foreground/60">+{campaignNames.length - 2} more</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.last7d.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{c.last7d.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{c.last7d.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-center"><TrendBadge value={ctrChange} /></TableCell>
                    <TableCell className="text-center"><Sparkline data={sparkData} color={config.color} /></TableCell>
                    <TableCell className="text-right tabular-nums font-medium">${c.last7d.spent.toFixed(0)}</TableCell>
                    <TableCell className="text-center"><TrendBadge value={deliveryChange} /></TableCell>
                    {status !== 'healthy' && (
                      <TableCell>
                        {fatigue?.signals && fatigue.signals.length > 0 ? (
                          <span className="text-[10px] text-muted-foreground leading-tight block max-w-[190px] truncate" title={fatigue.signals.join('; ')}>
                            {fatigue.signals[0]}
                          </span>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </TableCell>
                    )}
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

/** Charts panel shown inside AI Analysis — CTR comparison + spend distribution */
function AnalysisCharts({ rows }: { rows: CreativePerformanceRow[] }) {
  const [open, setOpen] = useState(true);

  const ctrData = useMemo(() =>
    [...rows]
      .filter(r => r.last7d.impressions >= 100 || r.last30d.impressions >= 100)
      .sort((a, b) => b.last7d.ctr - a.last7d.ctr)
      .slice(0, 10)
      .map(r => ({
        name: r.creativeName.length > 24 ? r.creativeName.slice(0, 23) + '…' : r.creativeName,
        '7d': +r.last7d.ctr.toFixed(2),
        '30d': +r.last30d.ctr.toFixed(2),
      }))
      .reverse(),
    [rows]
  );

  const spendData = useMemo(() =>
    [...rows]
      .filter(r => r.last7d.spent > 0)
      .sort((a, b) => b.last7d.spent - a.last7d.spent)
      .slice(0, 8)
      .map(r => ({
        name: r.creativeName.length > 24 ? r.creativeName.slice(0, 23) + '…' : r.creativeName,
        spend: +r.last7d.spent.toFixed(0),
        impressions: r.last7d.impressions,
      }))
      .reverse(),
    [rows]
  );

  if (ctrData.length === 0 && spendData.length === 0) return null;

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '6px',
    fontSize: '11px',
    padding: '6px 10px',
  };

  const tickStyle = { fontSize: 9, fill: 'hsl(var(--muted-foreground))' };

  return (
    <div className="border-b border-primary/10">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs hover:bg-muted/10 transition-colors cursor-pointer group"
      >
        <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
          <BarChart3 className="h-3 w-3" />
          Data Visualization
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', !open && '-rotate-90')} />
      </button>

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 px-5 pb-5">
          {/* CTR comparison */}
          {ctrData.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                CTR — 7d vs 30d baseline
              </p>
              <ResponsiveContainer width="100%" height={Math.max(160, ctrData.length * 26)}>
                <BarChart data={ctrData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis
                    type="number"
                    tickFormatter={v => `${v}%`}
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, name: string) => [`${v}%`, name]}
                    cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.4 }}
                  />
                  <Bar dataKey="30d" name="30d CTR" fill="hsl(var(--muted-foreground))" fillOpacity={0.2} radius={[0, 3, 3, 0]} barSize={7} />
                  <Bar dataKey="7d" name="7d CTR" fill="hsl(221 83% 53%)" fillOpacity={0.85} radius={[0, 3, 3, 0]} barSize={7} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[9px] text-muted-foreground/50 mt-1 text-right">
                blue = 7d · grey = 30d baseline
              </p>
            </div>
          )}

          {/* Spend distribution */}
          {spendData.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Spend Distribution — Last 7 Days
              </p>
              <ResponsiveContainer width="100%" height={Math.max(160, spendData.length * 26)}>
                <BarChart data={spendData} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis
                    type="number"
                    tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`}
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={tickStyle}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, 'Spend']}
                    cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.4 }}
                  />
                  <Bar dataKey="spend" name="Spend" radius={[0, 3, 3, 0]} barSize={7}>
                    {spendData.map((_, i) => (
                      <Cell key={i} fill={`hsl(221 83% ${Math.max(32, 62 - i * 4)}%)`} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Three bouncing dots — streaming indicator */
function TypingDots() {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
            style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">Claude is analyzing...</span>
    </div>
  );
}

export function CreativeAnalyzer({ accessToken, selectedAccount }: CreativeAnalyzerProps) {
  const {
    analysisData, isLoadingData, dataError,
    fetchAndAnalyze, askFollowUp,
    messages, isLoading, error, cancel, clearHistory,
    toolEvents, toolLabels,
  } = useCreativeAnalyzer(accessToken);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (selectedAccount && accessToken && !hasRun) {
      setHasRun(true);
      fetchAndAnalyze(selectedAccount);
    }
  }, [selectedAccount, accessToken, hasRun, fetchAndAnalyze]);

  // Smooth scroll to bottom whenever messages update (including streaming)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    'Which creatives should I pause?',
    'What headline patterns drive the best CTR?',
    'Which ads are being throttled?',
    'Suggest new creative variations',
    'Compare performance by campaign',
  ];

  // Group creatives by fatigue status
  const { groups, fatigueMap } = useMemo(() => {
    if (!analysisData) return {
      groups: { fatigued: [], warning: [], healthy: [], no_data: [] } as Record<StatusGroup, CreativePerformanceRow[]>,
      fatigueMap: new Map<string, CreativeFatigueItem>(),
    };
    const fm = new Map<string, CreativeFatigueItem>();
    for (const f of analysisData.fatigueItems) fm.set(f.creativeName, f);
    const g: Record<StatusGroup, CreativePerformanceRow[]> = { fatigued: [], warning: [], healthy: [], no_data: [] };
    for (const row of analysisData.performanceRows) {
      const fatigue = fm.get(row.creativeName);
      if (!fatigue) {
        (row.last7d.impressions > 0 ? g.healthy : g.no_data).push(row);
      } else {
        (g[fatigue.status as StatusGroup] || g.healthy).push(row);
      }
    }
    return { groups: g, fatigueMap: fm };
  }, [analysisData]);

  // Loading skeleton
  if (isLoadingData && !analysisData) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3 pb-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm">Analyzing your creatives...</p>
            <p className="text-xs text-muted-foreground">Fetching performance data across 4 time periods + fatigue signals</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-lg" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  // Error state
  if (dataError && !analysisData) {
    return (
      <div className="border border-destructive/20 rounded-lg p-8 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="font-medium text-destructive mb-1">Failed to load creative data</p>
        <p className="text-sm text-muted-foreground mb-4">{dataError}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Analysis
        </Button>
      </div>
    );
  }

  const s = analysisData?.summary;

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Creatives', value: s.totalCreatives, sub: `${s.activeCreatives} active`, icon: BarChart3 },
            { label: 'Impressions (7d)', value: s.totalImpressions7d.toLocaleString(), icon: Eye },
            { label: 'Avg CTR (7d)', value: `${s.avgCtr7d.toFixed(2)}%`, icon: MousePointerClick },
            { label: 'Spend (7d)', value: `$${s.totalSpend7d.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
            { label: 'Issues Found', value: s.fatigued + s.warning, sub: s.fatigued + s.warning === 0 ? 'All clear' : `${s.fatigued} critical`, icon: Zap },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="border border-border/60 rounded-lg px-3.5 py-3 bg-card shadow-sm flex items-start gap-3">
              <div className="p-1.5 rounded-md bg-primary/7 border border-primary/10 mt-0.5 shrink-0">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
                <p className="text-lg font-bold tabular-nums mt-1 leading-none">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fatigue health meter */}
      {s && (s.fatigued > 0 || s.warning > 0 || s.healthy > 0) && (
        <div className="px-1">
          <FatigueMeter fatigued={s.fatigued} warning={s.warning} healthy={s.healthy} total={s.fatigued + s.warning + s.healthy} />
        </div>
      )}

      {/* Grouped creative tables */}
      {analysisData && (
        <div className="space-y-3">
          <CreativeGroupSection status="fatigued" creatives={groups.fatigued} fatigueMap={fatigueMap} defaultOpen={true} />
          <CreativeGroupSection status="warning" creatives={groups.warning} fatigueMap={fatigueMap} defaultOpen={true} />
          <CreativeGroupSection status="healthy" creatives={groups.healthy} fatigueMap={fatigueMap} defaultOpen={false} />
        </div>
      )}

      {/* ── AI Analysis ────────────────────────────────────────── */}
      <div className={cn(
        'border rounded-xl bg-card shadow-sm overflow-hidden transition-all duration-300',
        isLoading ? 'border-primary/40 shadow-[0_0_0_1px_hsl(221_83%_53%_/_0.08)]' : 'border-primary/20',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary/10 bg-primary/[0.03]">
          <div className="flex items-center gap-2.5">
            <div className={cn('h-6 w-6 rounded-md flex items-center justify-center transition-colors', isLoading ? 'bg-primary/20' : 'bg-primary/10')}>
              <Sparkles className={cn('h-3.5 w-3.5 text-primary', isLoading && 'animate-pulse')} />
            </div>
            <span className="text-sm font-semibold">AI Analysis</span>
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
            <RefreshCw className={cn('h-3 w-3 mr-1', isLoadingData && 'animate-spin')} />
            Re-analyze
          </Button>
        </div>

        {/* Streaming progress bar */}
        {isLoading && (
          <div className="h-0.5 bg-primary/10 overflow-hidden">
            <div className="h-full bg-primary/40 animate-pulse w-full" />
          </div>
        )}

        {/* Charts section — visible once data loads */}
        {analysisData && analysisData.performanceRows.length > 0 && (
          <AnalysisCharts rows={analysisData.performanceRows} />
        )}

        {/* Message scroll area */}
        <div className="relative">
          <div
            ref={scrollRef}
            className="h-[500px] overflow-y-auto scroll-smooth"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}
          >
            <div className="px-5 py-4 space-y-5">
              {messages.length === 0 && !isLoading && (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="h-10 w-10 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center mb-3">
                    <Sparkles className="h-4.5 w-4.5 text-primary/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">Analysis will appear here once data loads</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Ask anything about your creatives below</p>
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
                        [&_code]:text-[12px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded
                        [&_ul]:space-y-0.5 [&_ol]:space-y-0.5
                        [&_hr]:border-border/40
                      ">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Tool-call status badges (agentic mode) */}
              {toolEvents.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {toolEvents.map(evt => (
                    <div
                      key={evt.id}
                      className={cn(
                        'inline-flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-full border w-fit transition-all duration-300',
                        evt.status === 'running'
                          ? 'bg-primary/5 border-primary/25 text-primary'
                          : evt.status === 'error'
                          ? 'bg-destructive/5 border-destructive/20 text-destructive/70 opacity-60'
                          : 'bg-green-500/5 border-green-500/20 text-green-600 dark:text-green-400 opacity-70',
                      )}
                    >
                      {evt.status === 'running' ? (
                        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      ) : evt.status === 'error' ? (
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      )}
                      {toolLabels[evt.tool] ?? evt.tool.replace(/_/g, ' ')}
                    </div>
                  ))}
                </div>
              )}

              {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
                <div className="rounded-2xl rounded-tl-sm bg-muted/20 border border-border/30 px-4 py-3">
                  <TypingDots />
                </div>
              )}

              <div ref={endRef} />
            </div>
          </div>

          {/* Bottom gradient fade */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        </div>

        {/* Quick follow-up pills */}
        {messages.length > 0 && !isLoading && (
          <div className="px-5 py-3 border-t border-border/40 bg-muted/10">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Follow-up</p>
            <div className="flex flex-wrap gap-1.5">
              {followUpQuestions.map(q => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 text-muted-foreground
                    hover:bg-primary/5 hover:border-primary/30 hover:text-foreground transition-all duration-150 cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mx-5 mb-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3 border-t border-border/40 bg-muted/5">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your creatives — fatigue, patterns, what to do next..."
            disabled={isLoading || isLoadingData}
            className="flex-1 h-9 text-sm"
          />
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
