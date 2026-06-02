import { useEffect, useState, useMemo } from 'react';
import { usePerformanceSegmentation } from '@/hooks/usePerformanceSegmentation';
import type { SegmentNode, ScorecardItem, FlatRow } from '@/lib/segmentationAggregator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  RefreshCw, ChevronDown, ChevronRight, Layers, AlertTriangle,
  CheckCircle2, XCircle, PauseCircle, TrendingUp, TrendingDown,
  ArrowUp, ArrowDown, Table2, TreePine, Calendar, DollarSign,
  BarChart3, MousePointerClick, Target, Eye, Zap,
} from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(v: number | null) { return v != null ? `$${v.toFixed(2)}` : '—'; }
function fmtPct(v: number | null) { return v != null ? `${(v * 100).toFixed(2)}%` : '—'; }
function fmtNum(v: number) { return v.toLocaleString('en-US'); }
function fmtCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtMetricVal(key: string, v: number | null): string {
  if (v == null) return '—';
  if (key === 'ctr' || key === 'eng_rate') return `${(v * 100).toFixed(2)}%`;
  return `$${v.toFixed(2)}`;
}

// ─── Depth colors for tree hierarchy ─────────────────────────────────────────

const DEPTH_COLORS = [
  'border-l-blue-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-emerald-500',
  'border-l-rose-400',
];
const DEPTH_BG = [
  'bg-blue-500/[0.03]',
  'bg-violet-500/[0.02]',
  '',
  '',
  '',
];

// ─── Scorecard Card ──────────────────────────────────────────────────────────

function ScorecardCard({ item }: { item: ScorecardItem }) {
  const flagConfig = {
    PASS:  { icon: CheckCircle2, color: 'text-green-600', ring: 'ring-green-500/20', bar: 'bg-green-500', label: 'PASS' },
    MISS:  { icon: XCircle,      color: 'text-red-500',   ring: 'ring-red-500/20',   bar: 'bg-red-500',   label: 'MISS' },
    PAUSE: { icon: PauseCircle,  color: 'text-amber-600', ring: 'ring-amber-500/20', bar: 'bg-amber-500', label: 'PAUSE' },
    'N/A': { icon: AlertTriangle,color: 'text-muted-foreground', ring: 'ring-border', bar: 'bg-muted-foreground/30', label: 'N/A' },
  };
  const cfg = flagConfig[item.flag];
  const Icon = cfg.icon;

  // Progress bar: show how close to target (for CTR: value/target, for CPL: target/value inverted)
  const isCpl = item.label.includes('CPL');
  let progress = 0;
  if (item.currentValue != null) {
    const target = isCpl ? 50 : 0.07; // default targets
    if (isCpl) {
      progress = Math.min(100, (target / Math.max(item.currentValue, 0.01)) * 100);
    } else {
      progress = Math.min(100, (item.currentValue / target) * 100);
    }
  }

  return (
    <div className={cn(
      'relative overflow-hidden border rounded-xl bg-card shadow-sm transition-all duration-200 hover:shadow-md',
      `ring-1 ${cfg.ring}`,
    )}>
      {/* Top accent bar */}
      <div className={cn('h-1 w-full', cfg.bar, item.flag === 'N/A' ? 'opacity-30' : 'opacity-60')} />
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{item.label}</p>
          <div className={cn('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color,
            item.flag === 'PASS' ? 'bg-green-500/10' : item.flag === 'MISS' ? 'bg-red-500/10' : item.flag === 'PAUSE' ? 'bg-amber-500/10' : 'bg-muted/30',
          )}>
            <Icon className="h-3 w-3" />
            {cfg.label}
          </div>
        </div>
        <p className={cn('text-2xl font-bold tabular-nums leading-none', cfg.color)}>
          {item.currentValue != null
            ? isCpl ? fmt$(item.currentValue) : fmtPct(item.currentValue)
            : '—'}
        </p>
        {/* Bullet-style progress bar */}
        <div className="mt-3 relative">
          <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
              style={{ width: `${progress}%`, opacity: 0.7 }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Target: {item.target}
            {item.baselineValue != null && (
              <span className="ml-2">Baseline: {isCpl ? fmt$(item.baselineValue) : fmtPct(item.baselineValue)}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Delta Badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: { absolute: number; pct: number | null; isBetter: boolean } | null }) {
  if (!delta || delta.pct == null) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md',
      delta.isBetter ? 'text-green-700 bg-green-500/10' : 'text-red-600 bg-red-500/10'
    )}>
      {delta.isBetter ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
    </span>
  );
}

// ─── Benchmark Flag Badge ────────────────────────────────────────────────────

function BenchmarkBadge({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return null;
  const cfg = {
    PASS:  { label: 'PASS',  cls: 'bg-green-500/15 text-green-700 border-green-500/30' },
    MISS:  { label: 'MISS',  cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
    PAUSE: { label: 'PAUSE', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  };
  const c = cfg[flag];
  return <Badge variant="outline" className={cn('text-[9px] font-bold px-1.5 py-0 h-[18px] rounded-md', c.cls)}>{c.label}</Badge>;
}

// ─── Tree Node ───────────────────────────────────────────────────────────────

function TreeNode({ node, depth, showBaseline, maxSpend }: { node: SegmentNode; depth: number; showBaseline: boolean; maxSpend: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const spendPct = maxSpend > 0 ? (node.metrics.spend / maxSpend) * 100 : 0;

  return (
    <>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'group w-full flex items-center gap-2 text-left transition-all duration-150 relative',
          'border-b border-border/20 border-l-[3px]',
          DEPTH_COLORS[depth] || 'border-l-slate-300',
          DEPTH_BG[depth],
          hasChildren ? 'cursor-pointer' : 'cursor-default',
          'hover:bg-accent/50',
        )}
        style={{ paddingLeft: `${16 + depth * 24}px`, paddingRight: '16px', paddingTop: '10px', paddingBottom: '10px' }}
      >
        {/* Spend bar background */}
        <div
          className="absolute inset-y-0 left-0 bg-primary/[0.04] transition-all duration-500 pointer-events-none"
          style={{ width: `${spendPct}%` }}
        />

        {/* Chevron */}
        <span className="relative z-10 w-4 shrink-0 flex items-center justify-center">
          {hasChildren ? (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : null}
        </span>

        {/* Label + Count */}
        <span className={cn(
          'relative z-10 flex-1 min-w-0 truncate',
          depth === 0 ? 'text-sm font-bold' : depth === 1 ? 'text-[13px] font-semibold' : 'text-[13px]',
        )}>
          {node.label}
        </span>

        <Badge variant="secondary" className="relative z-10 text-[9px] px-1.5 py-0 h-[18px] shrink-0 font-mono bg-muted/60">
          {node.adSetCount}
        </Badge>

        {/* Metrics cluster */}
        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <span className="text-[11px] tabular-nums text-muted-foreground w-[72px] text-right font-medium">
            {fmtCompact(node.metrics.spend)}
          </span>

          <div className="w-[1px] h-4 bg-border/40" />

          <span className={cn(
            'text-[11px] tabular-nums w-[90px] text-right font-bold',
            node.headline.lowerIsBetter
              ? (node.headline.value != null && node.headline.value <= 50 ? 'text-green-600' : node.headline.value != null && node.headline.value > 100 ? 'text-red-500' : 'text-foreground')
              : 'text-foreground',
          )}>
            <span className="text-[9px] font-medium text-muted-foreground mr-1">{node.headline.name}</span>
            {fmtMetricVal(node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr', node.headline.value)}
          </span>

          <span className="text-[11px] tabular-nums text-muted-foreground w-[70px] text-right">
            <span className="text-[9px] mr-0.5">CTR</span>
            {fmtPct(node.metrics.ctr)}
          </span>

          <div className="w-16 flex justify-end">
            <BenchmarkBadge flag={node.benchmarkFlag} />
          </div>

          {showBaseline && (
            <div className="w-[72px] flex justify-end">
              <DeltaBadge delta={node.headlineDelta} />
            </div>
          )}
        </div>
      </button>

      {expanded && hasChildren && (
        <div className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {node.children.map(child => (
            <TreeNode key={child.key} node={child} depth={depth + 1} showBaseline={showBaseline} maxSpend={maxSpend} />
          ))}
        </div>
      )}
    </>
  );
}

// ─── Summary Strip ──────────────────────────────────────────────────────────

function SummaryStrip({ flatRows }: { flatRows: FlatRow[] }) {
  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, leads: 0, adSets: flatRows.length };
    for (const r of flatRows) {
      t.spend += r.metrics.spend;
      t.impressions += r.metrics.impressions;
      t.clicks += r.metrics.clicks;
      t.leads += r.metrics.leads;
    }
    return t;
  }, [flatRows]);

  const items = [
    { label: 'Total Spend', value: fmtCompact(totals.spend), icon: DollarSign },
    { label: 'Impressions', value: fmtNum(totals.impressions), icon: Eye },
    { label: 'Clicks', value: fmtNum(totals.clicks), icon: MousePointerClick },
    { label: 'Leads', value: fmtNum(totals.leads), icon: Target },
    { label: 'Ad Sets', value: totals.adSets.toString(), icon: Layers },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40">
          <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/70 leading-none">{label}</p>
            <p className="text-sm font-bold tabular-nums mt-0.5 leading-none">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Flat Table ──────────────────────────────────────────────────────────────

function FlatTable({ rows }: { rows: FlatRow[] }) {
  const [sortKey, setSortKey] = useState('spend');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey in a.parsed) {
        av = (a.parsed as any)[sortKey]; bv = (b.parsed as any)[sortKey];
        return (av || '').localeCompare(bv || '') * (sortDir === 'asc' ? 1 : -1);
      }
      av = (a.derived as any)[sortKey] ?? (a.metrics as any)[sortKey] ?? -Infinity;
      bv = (b.derived as any)[sortKey] ?? (b.metrics as any)[sortKey] ?? -Infinity;
      return (av - bv) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return null;
    return sortDir === 'desc'
      ? <ArrowDown className="h-3 w-3 inline text-primary" />
      : <ArrowUp className="h-3 w-3 inline text-primary" />;
  };

  const cols = [
    { key: 'campaignName', label: 'Campaign', w: 'min-w-[200px]' },
    { key: 'business_line', label: 'BL', w: 'w-20' },
    { key: 'objective', label: 'Objective', w: 'w-28' },
    { key: 'activity_type', label: 'Activity', w: 'w-36' },
    { key: 'ad_type', label: 'Ad Type', w: 'w-24' },
    { key: 'segment', label: 'Segment', w: 'w-32' },
    { key: 'spend', label: 'Spend', w: 'w-20', align: 'text-right' },
    { key: 'impressions', label: 'Impr.', w: 'w-20', align: 'text-right' },
    { key: 'clicks', label: 'Clicks', w: 'w-16', align: 'text-right' },
    { key: 'leads', label: 'Leads', w: 'w-14', align: 'text-right' },
    { key: 'ctr', label: 'CTR', w: 'w-16', align: 'text-right' },
    { key: 'cpc', label: 'CPC', w: 'w-16', align: 'text-right' },
    { key: 'cpl', label: 'CPL', w: 'w-16', align: 'text-right' },
    { key: 'cpe', label: 'CPE', w: 'w-16', align: 'text-right' },
  ];

  return (
    <div className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border bg-muted/60 backdrop-blur-sm">
              {cols.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  className={cn(
                    'px-2.5 py-2.5 font-semibold cursor-pointer hover:bg-muted/80 transition-colors whitespace-nowrap select-none',
                    c.align || 'text-left', c.w,
                    sortKey === c.key && 'text-primary',
                  )}>
                  {c.label} <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className={cn(
                'border-b border-border/20 transition-colors hover:bg-primary/[0.03]',
                i % 2 === 0 ? '' : 'bg-muted/[0.015]',
              )}>
                <td className="px-2.5 py-2 max-w-[260px] truncate font-medium" title={row.campaignName}>{row.campaignName}</td>
                <td className="px-2.5 py-2">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[16px] font-semibold">
                    {row.parsed.business_line}
                  </Badge>
                </td>
                <td className="px-2.5 py-2 text-muted-foreground">{row.parsed.objective}</td>
                <td className="px-2.5 py-2">{row.parsed.activity_type}</td>
                <td className="px-2.5 py-2 text-muted-foreground">{row.parsed.ad_type}</td>
                <td className="px-2.5 py-2 text-muted-foreground">{row.parsed.segment}</td>
                <td className="px-2.5 py-2 tabular-nums text-right font-semibold">{fmt$(row.metrics.spend)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right text-muted-foreground">{fmtNum(row.metrics.impressions)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right text-muted-foreground">{fmtNum(row.metrics.clicks)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right font-semibold">{fmtNum(row.metrics.leads)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right">{fmtPct(row.derived.ctr)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right text-muted-foreground">{fmt$(row.derived.cpc)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right text-muted-foreground">{fmt$(row.derived.cpl)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right text-muted-foreground">{fmt$(row.derived.cpe)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function PerformanceSegmentation({ accessToken, selectedAccount }: Props) {
  const {
    tree, flatRows, scorecard,
    isLoading, error,
    compareBaseline, setCompareBaseline,
    hasBaseline, hasConfig, baselinePeriod,
    fetchReport,
  } = usePerformanceSegmentation(accessToken);

  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Max spend for proportional bars in tree
  const maxSpend = useMemo(() => {
    return tree.reduce((max, n) => Math.max(max, n.metrics.spend), 0);
  }, [tree]);

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchReport(selectedAccount, startDate, endDate);
    }
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (selectedAccount) fetchReport(selectedAccount, startDate, endDate);
  };

  if (!selectedAccount) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Layers className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Select an ad account to view segmentation</p>
      </div>
    );
  }

  if (isLoading && tree.length === 0) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3 pb-1">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Layers className="h-4.5 w-4.5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm">Loading segmentation data...</p>
            <p className="text-xs text-muted-foreground">Parsing campaign names and building hierarchy</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" style={{ animationDelay: `${i * 60}ms` }} />)}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error && tree.length === 0) {
    return (
      <div className="border border-destructive/20 rounded-xl p-10 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="font-semibold text-destructive mb-1">Failed to load segmentation data</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Controls bar ───────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-1 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5 border border-border/40">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-6 text-xs bg-transparent border-none outline-none w-[110px]" />
            <span className="text-[10px] text-muted-foreground/50">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-6 text-xs bg-transparent border-none outline-none w-[110px]" />
          </div>
          <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading} className="h-8 text-xs gap-1.5 rounded-lg">
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /> Apply
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {hasBaseline && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} className="h-4 w-7" />
              <span className="text-[11px] text-muted-foreground">
                vs Baseline{baselinePeriod ? ` (${baselinePeriod.replace('..', ' – ')})` : ''}
              </span>
            </label>
          )}
          {!hasConfig && tree.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground/70 border-dashed">
              Generic parser
            </Badge>
          )}
          <div className="flex items-center rounded-lg border border-border/60 overflow-hidden bg-muted/20">
            <button onClick={() => setViewMode('tree')}
              className={cn(
                'h-8 px-3.5 text-xs flex items-center gap-1.5 transition-all duration-150',
                viewMode === 'tree' ? 'bg-card text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}>
              <TreePine className="h-3 w-3" /> Tree
            </button>
            <button onClick={() => setViewMode('flat')}
              className={cn(
                'h-8 px-3.5 text-xs flex items-center gap-1.5 transition-all duration-150 border-l border-border/40',
                viewMode === 'flat' ? 'bg-card text-foreground font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}>
              <Table2 className="h-3 w-3" /> Table
            </button>
          </div>
        </div>
      </div>

      {/* ── Summary Strip ──────────────────────────────────────── */}
      {flatRows.length > 0 && <SummaryStrip flatRows={flatRows} />}

      {/* ── Benchmark Scorecard ─────────────────────────────────── */}
      {scorecard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {scorecard.map(item => <ScorecardCard key={item.label} item={item} />)}
        </div>
      )}

      {/* ── Tree / Table View ──────────────────────────────────── */}
      {viewMode === 'tree' ? (
        <div className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden">
          {/* Tree header */}
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {['BL', 'Objective', 'Activity', 'Ad Type', 'Segment'].map((label, i) => (
                  <span key={label} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />}
                    <span className={cn(
                      'px-1.5 py-0.5 rounded',
                      `border-l-2 ${DEPTH_COLORS[i]}`,
                    )}>
                      {label}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{flatRows.length} ad sets</span>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/30 bg-muted/15 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60"
            style={{ paddingLeft: '60px' }}>
            <span className="flex-1" />
            <span className="w-[18px]" />
            <span className="w-[72px] text-right">Spend</span>
            <span className="w-[1px]" />
            <span className="w-[90px] text-right">Metric</span>
            <span className="w-[70px] text-right">CTR</span>
            <span className="w-16 text-right">Target</span>
            {compareBaseline && hasBaseline && <span className="w-[72px] text-right">vs Base</span>}
          </div>

          {/* Tree content */}
          <div className="max-h-[700px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--border)) transparent' }}>
            {tree.map(node => (
              <TreeNode key={node.key} node={node} depth={0} showBaseline={compareBaseline && hasBaseline} maxSpend={maxSpend} />
            ))}
          </div>
        </div>
      ) : (
        <FlatTable rows={flatRows} />
      )}

      {/* ── Baseline footer ────────────────────────────────────── */}
      {compareBaseline && hasBaseline && (
        <p className="text-[10px] text-muted-foreground/60 text-center font-mono">
          Benchmark: {baselinePeriod?.replace('..', ' – ') || 'frozen baseline'} · Range: {startDate} to {endDate}
        </p>
      )}
    </div>
  );
}
