import { useEffect, useState, useMemo } from 'react';
import { usePerformanceSegmentation, type FlatRow } from '@/hooks/usePerformanceSegmentation';
import type { SegmentNode, ScorecardItem } from '@/lib/segmentationAggregator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  RefreshCw, ChevronDown, ChevronRight, Layers, AlertTriangle,
  CheckCircle2, XCircle, PauseCircle, TrendingUp, TrendingDown,
  ArrowUp, ArrowDown, Table2, Network, Calendar, DollarSign,
  MousePointerClick, Target, Eye, Activity, Filter,
} from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Midnight Indigo theming (scoped to this page only) ──────────────────────
// Locally overrides design tokens so the rest of the app keeps its light theme.
const indigoTheme: React.CSSProperties = {
  // Surfaces
  ['--si-bg' as any]: '#0a0a1a',
  ['--si-panel' as any]: '#101028',
  ['--si-panel-2' as any]: '#141432',
  ['--si-elevated' as any]: '#1a1a3d',
  ['--si-border' as any]: 'rgba(120,120,200,0.14)',
  ['--si-border-strong' as any]: 'rgba(140,140,220,0.28)',
  // Text
  ['--si-text' as any]: '#e7e7f5',
  ['--si-text-dim' as any]: '#9a9ac0',
  ['--si-text-mute' as any]: '#62628a',
  // Accent
  ['--si-accent' as any]: '#6366f1',
  ['--si-accent-soft' as any]: 'rgba(99,102,241,0.14)',
  ['--si-accent-ring' as any]: 'rgba(99,102,241,0.4)',
  // Status
  ['--si-good' as any]: '#34d399',
  ['--si-bad' as any]: '#f87171',
  ['--si-warn' as any]: '#fbbf24',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  color: 'var(--si-text)',
};

const displayFont = { fontFamily: "'Space Grotesk', system-ui, sans-serif" } as const;

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

// ─── Depth hue accents for hierarchy levels ──────────────────────────────────
const DEPTH_HUE = ['#6366f1', '#8b5cf6', '#d946ef', '#f59e0b', '#34d399'];

// ─── Scorecard tile (compact, sidebar-friendly) ──────────────────────────────

function ScorecardTile({ item }: { item: ScorecardItem }) {
  const cfg = {
    PASS:  { icon: CheckCircle2, color: 'var(--si-good)', label: 'PASS' },
    MISS:  { icon: XCircle,      color: 'var(--si-bad)',  label: 'MISS' },
    PAUSE: { icon: PauseCircle,  color: 'var(--si-warn)', label: 'PAUSE' },
    'N/A': { icon: AlertTriangle,color: 'var(--si-text-mute)', label: 'N/A' },
  }[item.flag];
  const Icon = cfg.icon;
  const isCpl = item.label.includes('CPL');
  const target = isCpl ? 50 : 0.07;
  const progress = item.currentValue != null
    ? Math.min(100, isCpl ? (target / Math.max(item.currentValue, 0.01)) * 100 : (item.currentValue / target) * 100)
    : 0;

  return (
    <div
      className="rounded-xl p-3 transition-all"
      style={{
        background: 'var(--si-panel-2)',
        border: '1px solid var(--si-border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--si-text-dim)' }}>
          {item.label}
        </p>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
          style={{ color: cfg.color, background: 'rgba(255,255,255,0.04)' }}>
          <Icon className="h-2.5 w-2.5" /> {cfg.label}
        </span>
      </div>
      <p className="text-xl font-bold tabular-nums leading-none" style={{ ...displayFont, color: cfg.color }}>
        {item.currentValue != null
          ? isCpl ? fmt$(item.currentValue) : fmtPct(item.currentValue)
          : '—'}
      </p>
      <div className="mt-2.5 h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress}%`, background: cfg.color, opacity: 0.85 }} />
      </div>
      <p className="text-[9px] mt-1.5" style={{ color: 'var(--si-text-mute)' }}>Target {item.target}</p>
    </div>
  );
}

// ─── Delta pill ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: { absolute: number; pct: number | null; isBetter: boolean } | null }) {
  if (!delta || delta.pct == null) return null;
  const color = delta.isBetter ? 'var(--si-good)' : 'var(--si-bad)';
  const Icon = delta.isBetter ? TrendingUp : TrendingDown;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}>
      <Icon className="h-3 w-3" />{delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
    </span>
  );
}

function BenchmarkBadge({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return null;
  const color = flag === 'PASS' ? 'var(--si-good)' : flag === 'MISS' ? 'var(--si-bad)' : 'var(--si-warn)';
  return (
    <span className="inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded-md"
      style={{ color, background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}40` }}>
      {flag}
    </span>
  );
}

// ─── Tree row ────────────────────────────────────────────────────────────────

function TreeNode({ node, depth, showBaseline, maxSpend }: { node: SegmentNode; depth: number; showBaseline: boolean; maxSpend: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const spendPct = maxSpend > 0 ? (node.metrics.spend / maxSpend) * 100 : 0;
  const hue = DEPTH_HUE[depth] || '#6366f1';

  return (
    <>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={cn(
          'group w-full flex items-center gap-2 text-left relative transition-colors',
          hasChildren ? 'cursor-pointer' : 'cursor-default',
        )}
        style={{
          paddingLeft: `${16 + depth * 22}px`,
          paddingRight: '16px',
          paddingTop: '9px',
          paddingBottom: '9px',
          borderBottom: '1px solid var(--si-border)',
          borderLeft: `3px solid ${hue}`,
          background: depth === 0 ? 'rgba(99,102,241,0.04)' : 'transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = depth === 0 ? 'rgba(99,102,241,0.04)' : 'transparent'; }}
      >
        <div className="absolute inset-y-0 left-0 pointer-events-none"
          style={{ width: `${spendPct}%`, background: `linear-gradient(90deg, ${hue}1a 0%, transparent 100%)` }} />

        <span className="relative z-10 w-4 shrink-0">
          {hasChildren ? (
            expanded
              ? <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--si-text-dim)' }} />
              : <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--si-text-dim)' }} />
          ) : null}
        </span>

        <span className={cn(
          'relative z-10 flex-1 min-w-0 truncate',
          depth === 0 ? 'text-sm font-bold' : depth === 1 ? 'text-[13px] font-semibold' : 'text-[13px]',
        )} style={depth <= 1 ? displayFont : undefined}>
          {node.label}
        </span>

        <span className="relative z-10 text-[9px] font-mono px-1.5 py-0.5 rounded-md shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--si-text-dim)' }}>
          {node.adSetCount}
        </span>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <span className="text-[11px] tabular-nums w-[72px] text-right font-semibold" style={{ color: 'var(--si-text)' }}>
            {fmtCompact(node.metrics.spend)}
          </span>
          <div className="w-px h-3" style={{ background: 'var(--si-border)' }} />
          <span className="text-[11px] tabular-nums w-[100px] text-right font-bold" style={{ color: 'var(--si-text)' }}>
            <span className="text-[9px] font-medium mr-1" style={{ color: 'var(--si-text-mute)' }}>{node.headline.name}</span>
            {fmtMetricVal(node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr', node.headline.value)}
          </span>
          <span className="text-[11px] tabular-nums w-[68px] text-right" style={{ color: 'var(--si-text-dim)' }}>
            <span className="text-[9px] mr-0.5">CTR</span>
            {fmtPct(node.metrics.ctr)}
          </span>
          <div className="w-14 flex justify-end"><BenchmarkBadge flag={node.benchmarkFlag} /></div>
          {showBaseline && (
            <div className="w-[72px] flex justify-end"><DeltaBadge delta={node.headlineDelta} /></div>
          )}
        </div>
      </button>

      {expanded && hasChildren && node.children.map(child => (
        <TreeNode key={child.key} node={child} depth={depth + 1} showBaseline={showBaseline} maxSpend={maxSpend} />
      ))}
    </>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl p-3"
      style={{ background: 'var(--si-panel-2)', border: '1px solid var(--si-border)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3" style={{ color: accent || 'var(--si-accent)' }} />
        <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--si-text-mute)' }}>
          {label}
        </span>
      </div>
      <p className="text-lg font-bold tabular-nums leading-none" style={{ ...displayFont, color: 'var(--si-text)' }}>
        {value}
      </p>
    </div>
  );
}

// ─── Flat table ──────────────────────────────────────────────────────────────

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
      ? <ArrowDown className="h-3 w-3 inline" style={{ color: 'var(--si-accent)' }} />
      : <ArrowUp className="h-3 w-3 inline" style={{ color: 'var(--si-accent)' }} />;
  };

  const cols = [
    { key: 'campaignName', label: 'Campaign' },
    { key: 'business_line', label: 'BL' },
    { key: 'objective', label: 'Objective' },
    { key: 'activity_type', label: 'Activity' },
    { key: 'ad_type', label: 'Ad Type' },
    { key: 'segment', label: 'Segment' },
    { key: 'spend', label: 'Spend', align: 'text-right' },
    { key: 'impressions', label: 'Impr.', align: 'text-right' },
    { key: 'clicks', label: 'Clicks', align: 'text-right' },
    { key: 'leads', label: 'Leads', align: 'text-right' },
    { key: 'ctr', label: 'CTR', align: 'text-right' },
    { key: 'cpc', label: 'CPC', align: 'text-right' },
    { key: 'cpl', label: 'CPL', align: 'text-right' },
  ];

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--si-panel)', border: '1px solid var(--si-border)' }}>
      <div className="overflow-x-auto" style={{ maxHeight: 700 }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--si-panel-2)', borderBottom: '1px solid var(--si-border-strong)' }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  className={cn('px-2.5 py-2.5 font-semibold cursor-pointer whitespace-nowrap select-none transition-colors',
                    c.align || 'text-left')}
                  style={{ color: sortKey === c.key ? 'var(--si-accent)' : 'var(--si-text-dim)' }}>
                  {c.label} <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--si-border)' }}>
                <td className="px-2.5 py-2 max-w-[260px] truncate font-medium" title={row.campaignName} style={{ color: 'var(--si-text)' }}>{row.campaignName}</td>
                <td className="px-2.5 py-2">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                    style={{ background: 'var(--si-accent-soft)', color: 'var(--si-accent)', border: '1px solid var(--si-accent-ring)' }}>
                    {row.parsed.business_line}
                  </span>
                </td>
                <td className="px-2.5 py-2" style={{ color: 'var(--si-text-dim)' }}>{row.parsed.objective}</td>
                <td className="px-2.5 py-2" style={{ color: 'var(--si-text)' }}>{row.parsed.activity_type}</td>
                <td className="px-2.5 py-2" style={{ color: 'var(--si-text-dim)' }}>{row.parsed.ad_type}</td>
                <td className="px-2.5 py-2" style={{ color: 'var(--si-text-dim)' }}>{row.parsed.segment}</td>
                <td className="px-2.5 py-2 tabular-nums text-right font-semibold" style={{ color: 'var(--si-text)' }}>{fmt$(row.metrics.spend)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right" style={{ color: 'var(--si-text-dim)' }}>{fmtNum(row.metrics.impressions)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right" style={{ color: 'var(--si-text-dim)' }}>{fmtNum(row.metrics.clicks)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right font-semibold" style={{ color: 'var(--si-text)' }}>{fmtNum(row.metrics.leads)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right" style={{ color: 'var(--si-text)' }}>{fmtPct(row.derived.ctr)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right" style={{ color: 'var(--si-text-dim)' }}>{fmt$(row.derived.cpc)}</td>
                <td className="px-2.5 py-2 tabular-nums text-right" style={{ color: 'var(--si-text-dim)' }}>{fmt$(row.derived.cpl)}</td>
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

  const maxSpend = useMemo(() => tree.reduce((m, n) => Math.max(m, n.metrics.spend), 0), [tree]);

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

  useEffect(() => {
    if (selectedAccount && accessToken) fetchReport(selectedAccount, startDate, endDate);
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => { if (selectedAccount) fetchReport(selectedAccount, startDate, endDate); };

  if (!selectedAccount) {
    return (
      <div style={indigoTheme} className="rounded-2xl p-16 text-center"
        css-bg="var(--si-bg)">
        <div style={{ background: 'var(--si-bg)' }} className="rounded-2xl p-16">
          <Layers className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--si-text-mute)' }} />
          <p style={{ color: 'var(--si-text-dim)' }}>Select an ad account to view segmentation</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ ...indigoTheme, background: 'var(--si-bg)' }}
      className="rounded-2xl -m-6 p-6 min-h-[calc(100vh-64px)]"
    >
      {/* ── Header bar ──────────────────────────────────────────── */}
      <header
        className="rounded-2xl p-5 mb-5 flex items-center justify-between gap-4 flex-wrap"
        style={{
          background: 'linear-gradient(135deg, #141432 0%, #1a1a3d 100%)',
          border: '1px solid var(--si-border-strong)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--si-accent-soft)', border: '1px solid var(--si-accent-ring)' }}>
            <Network className="h-5 w-5" style={{ color: 'var(--si-accent)' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight" style={displayFont}>Performance Segmentation</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--si-text-dim)' }}>
              Hierarchy of business line → objective → activity → ad type → segment
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--si-border)' }}>
            <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--si-text-dim)' }} />
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-6 text-xs bg-transparent border-none outline-none w-[120px]"
              style={{ color: 'var(--si-text)', colorScheme: 'dark' }} />
            <span className="text-xs" style={{ color: 'var(--si-text-mute)' }}>→</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-6 text-xs bg-transparent border-none outline-none w-[120px]"
              style={{ color: 'var(--si-text)', colorScheme: 'dark' }} />
          </div>
          <button onClick={handleRefresh} disabled={isLoading}
            className="h-9 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}>
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /> Apply
          </button>
        </div>
      </header>

      {/* ── Loading / Error states ─────────────────────────────── */}
      {isLoading && tree.length === 0 ? (
        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-3 space-y-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" style={{ background: 'var(--si-panel-2)' }} />
            ))}
          </div>
          <div className="col-span-12 lg:col-span-9">
            <Skeleton className="h-[600px] rounded-2xl" style={{ background: 'var(--si-panel-2)' }} />
          </div>
        </div>
      ) : error && tree.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--si-panel)', border: '1px solid rgba(248,113,113,0.3)' }}>
          <AlertTriangle className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--si-bad)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--si-bad)' }}>Failed to load segmentation data</p>
          <p className="text-sm mb-4" style={{ color: 'var(--si-text-dim)' }}>{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      ) : (
        // ── Sidebar layout ─────────────────────────────────────
        <div className="grid grid-cols-12 gap-5">
          {/* ── Left rail / Sidebar ───────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 space-y-4">
            {/* KPI tiles */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] px-1" style={{ color: 'var(--si-text-mute)' }}>
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <StatTile icon={DollarSign} label="Spend" value={fmtCompact(totals.spend)} />
                <StatTile icon={Target} label="Leads" value={fmtNum(totals.leads)} accent="var(--si-good)" />
                <StatTile icon={Eye} label="Impr." value={fmtNum(totals.impressions)} />
                <StatTile icon={MousePointerClick} label="Clicks" value={fmtNum(totals.clicks)} />
              </div>
              <div className="rounded-xl p-3"
                style={{ background: 'var(--si-panel-2)', border: '1px solid var(--si-border)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Layers className="h-3 w-3" style={{ color: 'var(--si-accent)' }} />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--si-text-mute)' }}>Ad Sets</span>
                </div>
                <p className="text-2xl font-bold tabular-nums leading-none" style={{ ...displayFont, color: 'var(--si-text)' }}>
                  {totals.adSets}
                </p>
              </div>
            </div>

            {/* Scorecard */}
            {scorecard.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] px-1 flex items-center gap-1.5" style={{ color: 'var(--si-text-mute)' }}>
                  <Activity className="h-3 w-3" /> Benchmarks
                </h3>
                <div className="space-y-2">
                  {scorecard.map(item => <ScorecardTile key={item.label} item={item} />)}
                </div>
              </div>
            )}

            {/* Options */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.16em] px-1 flex items-center gap-1.5" style={{ color: 'var(--si-text-mute)' }}>
                <Filter className="h-3 w-3" /> Options
              </h3>
              <div className="rounded-xl p-3 space-y-3"
                style={{ background: 'var(--si-panel-2)', border: '1px solid var(--si-border)' }}>
                {hasBaseline && (
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[11px]" style={{ color: 'var(--si-text-dim)' }}>
                      vs Baseline
                      {baselinePeriod && (
                        <span className="block text-[9px] mt-0.5" style={{ color: 'var(--si-text-mute)' }}>
                          {baselinePeriod.replace('..', ' – ')}
                        </span>
                      )}
                    </span>
                    <Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} />
                  </label>
                )}
                {!hasConfig && tree.length > 0 && (
                  <div className="text-[10px] px-2 py-1.5 rounded-md text-center"
                    style={{ color: 'var(--si-text-mute)', background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--si-border)' }}>
                    Using generic parser
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* ── Main content ───────────────────────────────────── */}
          <section className="col-span-12 lg:col-span-9">
            {/* View toggle + breadcrumb legend */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--si-text-mute)' }}>
                {['Business', 'Objective', 'Activity', 'Ad Type', 'Segment'].map((label, i) => (
                  <span key={label} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRight className="h-2.5 w-2.5" style={{ color: 'var(--si-text-mute)' }} />}
                    <span className="px-2 py-1 rounded-md"
                      style={{ background: 'rgba(255,255,255,0.03)', borderLeft: `2px solid ${DEPTH_HUE[i]}` }}>
                      {label}
                    </span>
                  </span>
                ))}
              </div>

              <div className="flex items-center rounded-xl overflow-hidden"
                style={{ background: 'var(--si-panel-2)', border: '1px solid var(--si-border)' }}>
                <button onClick={() => setViewMode('tree')}
                  className={cn('h-9 px-4 text-xs inline-flex items-center gap-1.5 transition-all')}
                  style={{
                    background: viewMode === 'tree' ? 'var(--si-accent-soft)' : 'transparent',
                    color: viewMode === 'tree' ? 'var(--si-accent)' : 'var(--si-text-dim)',
                    fontWeight: viewMode === 'tree' ? 600 : 400,
                  }}>
                  <Network className="h-3 w-3" /> Tree
                </button>
                <button onClick={() => setViewMode('flat')}
                  className={cn('h-9 px-4 text-xs inline-flex items-center gap-1.5 transition-all')}
                  style={{
                    background: viewMode === 'flat' ? 'var(--si-accent-soft)' : 'transparent',
                    color: viewMode === 'flat' ? 'var(--si-accent)' : 'var(--si-text-dim)',
                    borderLeft: '1px solid var(--si-border)',
                    fontWeight: viewMode === 'flat' ? 600 : 400,
                  }}>
                  <Table2 className="h-3 w-3" /> Table
                </button>
              </div>
            </div>

            {viewMode === 'tree' ? (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--si-panel)', border: '1px solid var(--si-border)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ background: 'var(--si-panel-2)', borderBottom: '1px solid var(--si-border-strong)',
                    color: 'var(--si-text-mute)', paddingLeft: 60 }}>
                  <span className="flex-1">Segment</span>
                  <span className="w-7 text-right">N</span>
                  <span className="w-[72px] text-right">Spend</span>
                  <span className="w-px" />
                  <span className="w-[100px] text-right">Headline</span>
                  <span className="w-[68px] text-right">CTR</span>
                  <span className="w-14 text-right">Flag</span>
                  {compareBaseline && hasBaseline && <span className="w-[72px] text-right">Δ Base</span>}
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: 700 }}>
                  {tree.map(node => (
                    <TreeNode key={node.key} node={node} depth={0}
                      showBaseline={compareBaseline && hasBaseline} maxSpend={maxSpend} />
                  ))}
                </div>
              </div>
            ) : (
              <FlatTable rows={flatRows} />
            )}

            {compareBaseline && hasBaseline && (
              <p className="text-[10px] text-center mt-3 font-mono" style={{ color: 'var(--si-text-mute)' }}>
                Benchmark: {baselinePeriod?.replace('..', ' – ') || 'frozen baseline'} · Range: {startDate} → {endDate}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
