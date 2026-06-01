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
  ArrowUp, ArrowDown, Table2, TreePine, Calendar,
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

function fmtMetric(key: string, v: number | null): string {
  if (v == null) return '—';
  if (key === 'ctr' || key === 'eng_rate') return `${(v * 100).toFixed(2)}%`;
  return `$${v.toFixed(2)}`;
}

// ─── Scorecard Card ──────────────────────────────────────────────────────────

function ScorecardCard({ item }: { item: ScorecardItem }) {
  const flagConfig = {
    PASS: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-500/8 border-green-500/25', label: 'PASS' },
    MISS: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/8 border-red-500/25', label: 'MISS' },
    PAUSE: { icon: PauseCircle, color: 'text-amber-600', bg: 'bg-amber-500/8 border-amber-500/25', label: 'PAUSE' },
    'N/A': { icon: AlertTriangle, color: 'text-muted-foreground', bg: 'bg-muted/30 border-border/60', label: 'N/A' },
  };
  const cfg = flagConfig[item.flag];
  const Icon = cfg.icon;

  return (
    <div className={cn('border rounded-lg px-4 py-3 flex items-center gap-3', cfg.bg)}>
      <Icon className={cn('h-5 w-5 shrink-0', cfg.color)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
        <p className="text-lg font-bold tabular-nums mt-0.5">
          {item.currentValue != null
            ? item.label.includes('CPL') ? fmt$(item.currentValue) : fmtPct(item.currentValue)
            : '—'}
        </p>
        {item.baselineValue != null && (
          <p className="text-[10px] text-muted-foreground">
            Baseline: {item.label.includes('CPL') ? fmt$(item.baselineValue) : fmtPct(item.baselineValue)}
          </p>
        )}
      </div>
      <Badge variant="outline" className={cn('text-[10px] shrink-0', cfg.color)}>{cfg.label}</Badge>
    </div>
  );
}

// ─── Delta Badge ─────────────────────────────────────────────────────────────

function DeltaBadge({ delta, metricKey }: { delta: { absolute: number; pct: number | null; isBetter: boolean } | null; metricKey: string }) {
  if (!delta || delta.pct == null) return null;
  const Icon = delta.isBetter ? TrendingUp : TrendingDown;
  const isRate = metricKey === 'ctr' || metricKey === 'eng_rate';
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums',
      delta.isBetter ? 'text-green-600' : 'text-red-500'
    )}>
      <Icon className="h-3 w-3" />
      {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
    </span>
  );
}

// ─── Benchmark Flag Badge ────────────────────────────────────────────────────

function BenchmarkBadge({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return null;
  const cfg = {
    PASS: { label: '✓ PASS', cls: 'bg-green-500/10 text-green-600 border-green-500/25' },
    MISS: { label: '✗ MISS', cls: 'bg-red-500/10 text-red-500 border-red-500/25' },
    PAUSE: { label: '⚠ PAUSE', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/25' },
  };
  const c = cfg[flag];
  return <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 h-4', c.cls)}>{c.label}</Badge>;
}

// ─── Tree Node ───────────────────────────────────────────────────────────────

function TreeNode({ node, depth, showBaseline }: { node: SegmentNode; depth: number; showBaseline: boolean }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const indent = depth * 20;

  return (
    <>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors border-b border-border/30',
          depth === 0 && 'bg-muted/20 font-semibold',
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : <span className="w-3.5 shrink-0" />}

        <span className={cn('flex-1 min-w-0 truncate text-[13px]', depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : '')}>
          {node.label}
        </span>

        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
          {node.adSetCount}
        </Badge>

        <span className="text-[11px] tabular-nums text-muted-foreground w-20 text-right shrink-0">
          {fmtCompact(node.metrics.spend)}
        </span>

        <span className="text-[11px] tabular-nums font-semibold w-20 text-right shrink-0">
          {node.headline.name}: {fmtMetric(node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr', node.headline.value)}
        </span>

        <span className="text-[11px] tabular-nums text-muted-foreground w-16 text-right shrink-0">
          CTR: {fmtPct(node.metrics.ctr)}
        </span>

        <BenchmarkBadge flag={node.benchmarkFlag} />

        {showBaseline && (
          <span className="w-20 text-right shrink-0">
            <DeltaBadge delta={node.headlineDelta} metricKey={node.headline.name.toLowerCase()} />
          </span>
        )}
      </button>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.key} node={child} depth={depth + 1} showBaseline={showBaseline} />
          ))}
        </div>
      )}
    </>
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
      av = (a.derived as any)[sortKey] ?? -Infinity;
      bv = (b.derived as any)[sortKey] ?? -Infinity;
      return (av - bv) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return null;
    return sortDir === 'desc' ? <ArrowDown className="h-3 w-3 inline" /> : <ArrowUp className="h-3 w-3 inline" />;
  };

  const cols = [
    { key: 'campaignName', label: 'Campaign', isText: true },
    { key: 'business_line', label: 'BL', isText: true },
    { key: 'objective', label: 'Objective', isText: true },
    { key: 'activity_type', label: 'Activity', isText: true },
    { key: 'ad_type', label: 'Ad Type', isText: true },
    { key: 'segment', label: 'Segment', isText: true },
    { key: 'spend', label: 'Spend' },
    { key: 'impressions', label: 'Impr.' },
    { key: 'clicks', label: 'Clicks' },
    { key: 'leads', label: 'Leads' },
    { key: 'ctr', label: 'CTR' },
    { key: 'cpc', label: 'CPC' },
    { key: 'cpl', label: 'CPL' },
    { key: 'cpe', label: 'CPE' },
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b bg-muted/40">
              {cols.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  className="px-2 py-2 text-left font-semibold cursor-pointer hover:bg-muted/60 whitespace-nowrap">
                  {c.label} <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                <td className="px-2 py-1.5 max-w-[200px] truncate font-medium">{row.campaignName}</td>
                <td className="px-2 py-1.5">{row.parsed.business_line}</td>
                <td className="px-2 py-1.5">{row.parsed.objective}</td>
                <td className="px-2 py-1.5">{row.parsed.activity_type}</td>
                <td className="px-2 py-1.5">{row.parsed.ad_type}</td>
                <td className="px-2 py-1.5">{row.parsed.segment}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmt$(row.metrics.spend)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmtNum(row.metrics.impressions)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmtNum(row.metrics.clicks)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmtNum(row.metrics.leads)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmtPct(row.derived.ctr)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmt$(row.derived.cpc)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmt$(row.derived.cpl)}</td>
                <td className="px-2 py-1.5 tabular-nums text-right">{fmt$(row.derived.cpe)}</td>
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
    fetchReport,
  } = usePerformanceSegmentation(accessToken);

  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchReport(selectedAccount, startDate, endDate);
    }
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (selectedAccount) fetchReport(selectedAccount, startDate, endDate);
  };

  if (!selectedAccount) {
    return <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">Select an ad account</div>;
  }

  if (isLoading && tree.length === 0) {
    return (
      <div className="space-y-5 animate-in fade-in-50 duration-300">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Layers className="h-4.5 w-4.5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="font-semibold text-sm">Loading segmentation data...</p>
            <p className="text-xs text-muted-foreground">Parsing campaign names and building hierarchy</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (error && tree.length === 0) {
    return (
      <div className="border border-destructive/20 rounded-lg p-8 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="font-medium text-destructive mb-1">Failed to load segmentation data</p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Header bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-8 text-xs border border-border/60 rounded-md px-2 bg-transparent" />
            <span className="text-xs text-muted-foreground">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-8 text-xs border border-border/60 rounded-md px-2 bg-transparent" />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="h-8 text-xs gap-1.5">
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /> Apply
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} className="h-4 w-7" />
            <span className="text-xs text-muted-foreground">vs Baseline (Mar–May 2026)</span>
          </div>
          <div className="flex items-center border border-border/60 rounded-md overflow-hidden">
            <button onClick={() => setViewMode('tree')}
              className={cn('h-8 px-3 text-xs flex items-center gap-1.5 transition-colors', viewMode === 'tree' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/30')}>
              <TreePine className="h-3 w-3" /> Tree
            </button>
            <button onClick={() => setViewMode('flat')}
              className={cn('h-8 px-3 text-xs flex items-center gap-1.5 transition-colors border-l border-border/60', viewMode === 'flat' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted/30')}>
              <Table2 className="h-3 w-3" /> Table
            </button>
          </div>
        </div>
      </div>

      {/* ── Benchmark Scorecard ─────────────────────────────────── */}
      {scorecard.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {scorecard.map(item => <ScorecardCard key={item.label} item={item} />)}
        </div>
      )}

      {/* ── Tree / Table View ──────────────────────────────────── */}
      {viewMode === 'tree' ? (
        <div className="border border-border/60 rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Business Line → Objective → Activity → Ad Type → Segment
            </h3>
            <span className="text-[10px] text-muted-foreground">{flatRows.length} ad sets parsed</span>
          </div>
          <div className="max-h-[700px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {tree.map(node => (
              <TreeNode key={node.key} node={node} depth={0} showBaseline={compareBaseline} />
            ))}
          </div>
        </div>
      ) : (
        <FlatTable rows={flatRows} />
      )}

      {/* ── Baseline label ─────────────────────────────────────── */}
      {compareBaseline && (
        <p className="text-[10px] text-muted-foreground text-center">
          Benchmark: 1 Mar – 31 May 2026 · Date range: {startDate} to {endDate}
        </p>
      )}
    </div>
  );
}
