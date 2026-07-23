import { useEffect, useState, useMemo } from 'react';
import { usePerformanceSegmentation, type FlatRow } from '@/hooks/usePerformanceSegmentation';
import type { SegmentNode, ScorecardItem } from '@/lib/segmentationAggregator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from './widgets';
import { cn } from '@/lib/utils';
import {
  RefreshCw, ChevronDown, ChevronRight, Layers, AlertTriangle,
  TrendingUp, TrendingDown, Table2, TreePine, Calendar, Star,
  DollarSign, Eye, MousePointerClick, Target,
} from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(v: number | null) { return v != null ? `$${v.toFixed(2)}` : '—'; }
function fmtPct(v: number | null) { return v != null ? `${(v * 100).toFixed(1)}%` : '—'; }
function fmtNum(v: number) { return v.toLocaleString('en-US'); }
function money(v: number) { return '$' + Math.round(v).toLocaleString(); }
function fmtCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtMetricVal(key: string, v: number | null): string {
  if (v == null) return '—';
  if (key === 'ctr' || key === 'eng_rate') return `${(v * 100).toFixed(1)}%`;
  if (key === 'cpl') return '$' + Math.round(v).toLocaleString();
  return `$${v.toFixed(2)}`;
}

// ─── Benchmark pill — StatusPill with semantic tones ─────────────────────────

const BENCH_TONE = {
  PASS: 'success',
  MISS: 'danger',
  PAUSE: 'warning',
} as const;

function BenchBadge({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return <StatusPill tone="neutral" label="No benchmark" />;
  return <StatusPill tone={BENCH_TONE[flag]} label={flag} />;
}

// ─── Delta Badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: { absolute: number; pct: number | null; isBetter: boolean } | null }) {
  if (!delta || delta.pct == null) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md',
      delta.isBetter ? 'text-success bg-success/10' : 'text-destructive bg-destructive/10',
    )}>
      {delta.isBetter ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
    </span>
  );
}

// ─── Scorecard Card ──────────────────────────────────────────────────────────

function ScorecardCard({ item }: { item: ScorecardItem }) {
  const isCpl = item.label.includes('CPL');
  const flagCfg = {
    PASS:  { color: 'text-success', ring: 'ring-success/20', bar: 'bg-success' },
    MISS:  { color: 'text-destructive', ring: 'ring-destructive/20', bar: 'bg-destructive' },
    PAUSE: { color: 'text-warning', ring: 'ring-warning/20', bar: 'bg-warning' },
    'N/A': { color: 'text-muted-foreground', ring: 'ring-border', bar: 'bg-muted-foreground/30' },
  };
  const cfg = flagCfg[item.flag];
  let progress = 0;
  if (item.currentValue != null) {
    const target = isCpl ? 50 : 0.07;
    progress = isCpl ? Math.min(100, (target / Math.max(item.currentValue, 0.01)) * 100) : Math.min(100, (item.currentValue / target) * 100);
  }

  return (
    <div className={cn('border border-border/70 rounded-xl bg-card overflow-hidden ring-1', cfg.ring)} style={{ boxShadow: 'var(--shadow-sm)' }}>
      <div className={cn('h-1 w-full', cfg.bar, item.flag === 'N/A' ? 'opacity-30' : 'opacity-60')} />
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{item.label}</span>
          <BenchBadge flag={item.flag === 'N/A' ? null : item.flag} />
        </div>
        <p className={cn('text-2xl font-bold tabular-nums', cfg.color)}>
          {item.currentValue != null ? isCpl ? '$' + Math.round(item.currentValue) : fmtPct(item.currentValue) : '—'}
        </p>
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', cfg.bar)} style={{ width: `${progress}%`, opacity: 0.7 }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 tabular-nums">
            Target: {item.label.includes('CTR') ? '≥ 7%' : item.label.includes('Boosts') ? '≥ 4%' : '≤ $50'}
            {item.baselineValue != null && <span className="ml-2">Baseline: {isCpl ? '$' + Math.round(item.baselineValue) : fmtPct(item.baselineValue)}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Pod Row (audience/segment inside activity) ──────────────────────────────

function PodRow({ node, headlineKey }: { node: SegmentNode; headlineKey: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-secondary/40 border border-border/40 hover:bg-secondary/60 transition-colors">
      <span className={cn('w-2 h-2 rounded-full shrink-0',
        node.benchmarkFlag === 'PASS' ? 'bg-success' : node.benchmarkFlag === 'MISS' ? 'bg-destructive' : 'bg-muted-foreground/40',
      )} />
      <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{node.label}</span>
      <div className="flex items-center gap-4 shrink-0 tabular-nums">
        <div className="text-right">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">{node.headline.name}</div>
          <div className="text-sm font-bold">{fmtMetricVal(headlineKey, node.headline.value)}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Spend</div>
          <div className="text-sm text-muted-foreground">{money(node.metrics.spend)}</div>
        </div>
        {node.benchmarkFlag && <BenchBadge flag={node.benchmarkFlag} />}
      </div>
    </div>
  );
}

// ─── Activity Card ───────────────────────────────────────────────────────────

function ActivityCard({ node, rank, isBest, showBaseline }: { node: SegmentNode; rank: number; isBest: boolean; showBaseline: boolean }) {
  const [open, setOpen] = useState(false);
  const headlineKey = node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr';
  const flatPods = useMemo(() => {
    const result: SegmentNode[] = [];
    for (const adType of node.children) for (const seg of adType.children) if (seg.metrics.spend > 0) result.push(seg);
    return result.sort((a, b) => {
      if (a.headline.value == null) return 1; if (b.headline.value == null) return -1;
      return node.headline.lowerIsBetter ? a.headline.value - b.headline.value : b.headline.value - a.headline.value;
    });
  }, [node]);

  return (
    <div
      className={cn('rounded-xl border bg-card transition-all', isBest ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border/60')}
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className={cn('text-[11px] tabular-nums w-5 font-mono', isBest ? 'text-primary font-bold' : 'text-muted-foreground')}>
            {String(rank).padStart(2, '0')}
          </span>
          <span className="text-[15px] font-semibold flex-1 truncate">
            {node.label}
            {isBest && <Star className="inline h-3.5 w-3.5 ml-1.5 -mt-0.5 text-primary" />}
          </span>
          {flatPods.length > 0 && (
            <button onClick={() => setOpen(!open)}
              className="text-[10.5px] px-2.5 py-1 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer">
              {flatPods.length} audiences {open ? '▴' : '▾'}
            </button>
          )}
        </div>
        <div className="flex items-end gap-5 mt-3 flex-wrap">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">{node.headline.name} · avg</div>
            <div className="text-xl font-bold tabular-nums">{fmtMetricVal(headlineKey, node.headline.value)}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">CTR</div>
            <div className="text-[15px] tabular-nums text-muted-foreground">{fmtPct(node.metrics.ctr)}</div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/60">Spend</div>
            <div className="text-[15px] tabular-nums text-muted-foreground">{money(node.metrics.spend)}</div>
          </div>
          <BenchBadge flag={node.benchmarkFlag} />
          {showBaseline && node.headlineDelta && <DeltaBadge delta={node.headlineDelta} />}
        </div>
      </div>
      {open && flatPods.length > 0 && (
        <div className="px-4 pb-4 pt-3 border-t border-border/40 flex flex-col gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
            By audience — {node.headline.lowerIsBetter ? 'lowest' : 'highest'} {node.headline.name} first
          </p>
          {flatPods.map(pod => <PodRow key={pod.key} node={pod} headlineKey={headlineKey} />)}
        </div>
      )}
    </div>
  );
}

// ─── Objective Section ───────────────────────────────────────────────────────

function ObjectiveSection({ node, showBaseline }: { node: SegmentNode; showBaseline: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="border-l-2 border-border/40 ml-1.5">
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg -ml-[2px] border-l-2 border-l-primary bg-secondary/40 hover:bg-secondary/60 transition-colors cursor-pointer">
        <span className="text-[13px] text-muted-foreground">{collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</span>
        <span className="text-base font-semibold">{node.label}</span>
        <StatusPill tone="info" label={node.headline.name} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {money(node.metrics.spend)} · {node.children.length} plays
        </span>
      </button>
      {!collapsed && (
        <div className="ml-4 pl-3.5 border-l border-dashed border-border/40 flex flex-col gap-2.5 py-2">
          {node.children.map((act, i) => (
            <ActivityCard key={act.key} node={act} rank={i + 1} isBest={i === 0 && act.headline.value != null} showBaseline={showBaseline} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Business Line Card ──────────────────────────────────────────────────────

function BusinessLineCard({ node, showBaseline }: { node: SegmentNode; showBaseline: boolean }) {
  return (
    <WidgetCard
      noPadding
      title={<span className="text-lg font-bold">{node.label}</span>}
      toolbar={<span className="text-base font-semibold text-primary tabular-nums">{money(node.metrics.spend)}</span>}
    >
      <div className="p-4 pt-2 space-y-4">
        {node.children.map(obj => <ObjectiveSection key={obj.key} node={obj} showBaseline={showBaseline} />)}
      </div>
    </WidgetCard>
  );
}

// ─── Summary Strip ───────────────────────────────────────────────────────────

function SummaryStrip({ totals }: { totals: { spend: number; impressions: number; clicks: number; leads: number; adSets: number } }) {
  const items = [
    { label: 'Total Spend', value: fmtCompact(totals.spend), icon: DollarSign },
    { label: 'Impressions', value: fmtNum(totals.impressions), icon: Eye },
    { label: 'Clicks', value: fmtNum(totals.clicks), icon: MousePointerClick },
    { label: 'Leads', value: fmtNum(totals.leads), icon: Target },
    { label: 'Ad Sets', value: String(totals.adSets), icon: Layers },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-card border border-border/70" style={{ boxShadow: 'var(--shadow-xs)' }}>
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
      if (sortKey in a.parsed) { av = (a.parsed as any)[sortKey]; bv = (b.parsed as any)[sortKey]; return (av || '').localeCompare(bv || '') * (sortDir === 'asc' ? 1 : -1); }
      av = (a.derived as any)[sortKey] ?? (a.metrics as any)[sortKey] ?? -Infinity;
      bv = (b.derived as any)[sortKey] ?? (b.metrics as any)[sortKey] ?? -Infinity;
      return (av - bv) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [rows, sortKey, sortDir]);
  const toggleSort = (key: string) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('desc'); } };
  const cols = [
    { key: 'campaignName', label: 'Campaign' }, { key: 'business_line', label: 'BL' },
    { key: 'objective', label: 'Objective' }, { key: 'activity_type', label: 'Activity' },
    { key: 'segment', label: 'Segment' }, { key: 'spend', label: 'Spend', align: 'right' as const },
    { key: 'impressions', label: 'Impr.', align: 'right' as const }, { key: 'clicks', label: 'Clicks', align: 'right' as const },
    { key: 'leads', label: 'Leads', align: 'right' as const }, { key: 'ctr', label: 'CTR', align: 'right' as const },
    { key: 'cpc', label: 'CPC', align: 'right' as const }, { key: 'cpl', label: 'CPL', align: 'right' as const },
  ];
  return (
    <WidgetCard noPadding>
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            {cols.map(c => (
              <TableHead key={c.key} className={cn('h-9 px-2.5', c.align === 'right' && 'text-right')}>
                <button
                  onClick={() => toggleSort(c.key)}
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.08em] text-[10px]',
                    sortKey === c.key && 'text-primary',
                  )}
                >
                  {c.label}{sortKey === c.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => (
            <TableRow key={i} className="[&>td]:px-2.5 [&>td]:py-2">
              <TableCell className="max-w-[220px] truncate font-medium" title={row.campaignName}>{row.campaignName}</TableCell>
              <TableCell><Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-semibold">{row.parsed.business_line}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{row.parsed.objective}</TableCell>
              <TableCell>{row.parsed.activity_type}</TableCell>
              <TableCell className="text-muted-foreground">{row.parsed.segment}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmt$(row.metrics.spend)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(row.metrics.impressions)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(row.metrics.clicks)}</TableCell>
              <TableCell className="text-right tabular-nums font-semibold">{fmtNum(row.metrics.leads)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtPct(row.derived.ctr)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmt$(row.derived.cpc)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{fmt$(row.derived.cpl)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function PerformanceSegmentation({ accessToken, selectedAccount }: Props) {
  const { tree, flatRows, scorecard, isLoading, error, compareBaseline, setCompareBaseline, hasBaseline, hasConfig, baselinePeriod, fetchReport } = usePerformanceSegmentation(accessToken);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const totals = useMemo(() => {
    const t = { spend: 0, impressions: 0, clicks: 0, leads: 0, adSets: flatRows.length };
    for (const r of flatRows) { t.spend += r.metrics.spend; t.impressions += r.metrics.impressions; t.clicks += r.metrics.clicks; t.leads += r.metrics.leads; }
    return t;
  }, [flatRows]);

  useEffect(() => { if (selectedAccount && accessToken) fetchReport(selectedAccount, startDate, endDate); }, [selectedAccount, accessToken]); // eslint-disable-line
  const handleRefresh = () => { if (selectedAccount) fetchReport(selectedAccount, startDate, endDate); };

  if (!selectedAccount) return (
    <WidgetCard noPadding>
      <EmptyState
        icon={Layers}
        title="No account selected"
        description="Select an ad account to view segmentation."
      />
    </WidgetCard>
  );

  if (isLoading && tree.length === 0) return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pb-1">
        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center"><Layers className="h-5 w-5 text-primary animate-pulse" /></div>
        <div><p className="font-semibold text-sm">Loading segmentation data...</p><p className="text-xs text-muted-foreground">Parsing campaign names and building hierarchy</p></div>
      </div>
      <div className="grid grid-cols-5 gap-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" style={{ animationDelay: `${i * 60}ms` }} />)}</div>
      <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );

  if (error && tree.length === 0) return (
    <WidgetCard noPadding>
      <EmptyState
        icon={AlertTriangle}
        title="Failed to load segmentation data"
        description={error}
        action={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        }
      />
    </WidgetCard>
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card rounded-lg px-2.5 py-1.5 border border-border/70">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-6 text-xs bg-transparent border-none outline-none w-[110px] tabular-nums" />
            <span className="text-[10px] text-muted-foreground/50">—</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-6 text-xs bg-transparent border-none outline-none w-[110px] tabular-nums" />
          </div>
          <Button variant="default" size="sm" onClick={handleRefresh} disabled={isLoading} className="h-8 text-xs gap-1.5 rounded-lg">
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /> Apply
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {hasBaseline && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} className="h-4 w-7" />
              <span className="text-[11px] text-muted-foreground">vs Baseline{baselinePeriod ? ` (${baselinePeriod.replace('..', ' – ')})` : ''}</span>
            </label>
          )}
          {!hasConfig && tree.length > 0 && <StatusPill tone="neutral" label="Generic parser" />}
          <SegmentedControl
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'tree', label: <span className="inline-flex items-center gap-1.5"><TreePine className="h-3 w-3" /> Funnel</span> },
              { value: 'flat', label: <span className="inline-flex items-center gap-1.5"><Table2 className="h-3 w-3" /> Table</span> },
            ]}
          />
        </div>
      </div>

      {/* Summary */}
      {flatRows.length > 0 && <SummaryStrip totals={totals} />}

      {/* Scorecard */}
      {scorecard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {scorecard.map(item => <ScorecardCard key={item.label} item={item} />)}
        </div>
      )}

      {/* Content */}
      {viewMode === 'tree' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {tree.map(bl => <BusinessLineCard key={bl.key} node={bl} showBaseline={compareBaseline && hasBaseline} />)}
        </div>
      ) : <FlatTable rows={flatRows} />}

      {/* Footer */}
      {compareBaseline && hasBaseline && (
        <p className="text-[10px] text-muted-foreground/60 text-center tabular-nums">
          Benchmark: {baselinePeriod?.replace('..', ' – ')} · Range: {startDate} to {endDate}
        </p>
      )}
    </div>
  );
}
