import { useEffect, useState, useMemo } from 'react';
import { usePerformanceSegmentation, type FlatRow } from '@/hooks/usePerformanceSegmentation';
import type { SegmentNode, ScorecardItem } from '@/lib/segmentationAggregator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  RefreshCw, ChevronDown, ChevronRight, Layers, AlertTriangle,
  ArrowUp, ArrowDown, Table2, Network, Calendar, Crown,
} from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Windward Funnel theme (scoped to this page) ─────────────────────────────
const funnelTheme: React.CSSProperties = {
  ['--ink' as any]: '#08151f',
  ['--ink2' as any]: '#0d2030',
  ['--panel' as any]: '#10283b',
  ['--panel2' as any]: '#143049',
  ['--line' as any]: '#1f4763',
  ['--line2' as any]: '#2b5b7d',
  ['--fog' as any]: '#cfe3ef',
  ['--mute' as any]: '#7fa6bf',
  ['--dim' as any]: '#5b829c',
  ['--gold' as any]: '#e9b949',
  ['--gold2' as any]: '#f5d27e',
  ['--cyan' as any]: '#41c8d6',
  ['--teal' as any]: '#2fa6a0',
  ['--pass' as any]: '#4fd08a',
  ['--passbg' as any]: '#10362a',
  ['--miss' as any]: '#ef6a5e',
  ['--missbg' as any]: '#3a1714',
  color: 'var(--fog)',
  fontFamily: "'Archivo', system-ui, sans-serif",
  lineHeight: 1.45,
};

const serifFont = { fontFamily: "'Fraunces', serif" } as const;
const monoFont = { fontFamily: "'Spline Sans Mono', monospace" } as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt$(v: number | null) { return v != null ? `$${v.toFixed(2)}` : '—'; }
function fmtPct(v: number | null) { return v != null ? `${(v * 100).toFixed(2)}%` : '—'; }
function fmtNum(v: number) { return v.toLocaleString('en-US'); }
function fmtCompact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}
function fmtMetricVal(key: string, v: number | null): string {
  if (v == null) return '—';
  if (key === 'ctr' || key === 'eng_rate') return `${(v * 100).toFixed(2)}%`;
  return `$${v.toFixed(2)}`;
}

// ─── Bench pill ──────────────────────────────────────────────────────────────
function BenchPill({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return null;
  const cls =
    flag === 'PASS'  ? { bg: 'var(--passbg)', fg: 'var(--pass)', bd: '#1f5a41', text: 'beats' } :
    flag === 'MISS'  ? { bg: 'var(--missbg)', fg: 'var(--miss)', bd: '#6e2a23', text: 'misses' } :
                       { bg: '#3a2614', fg: 'var(--gold)', bd: '#5a3c1a', text: 'pause' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
      style={{ ...monoFont, fontSize: 10.5, background: cls.bg, color: cls.fg, border: `1px solid ${cls.bd}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cls.fg }} /> {cls.text}
    </span>
  );
}

// ─── Activity card (level 2+ leaf-ish row) ───────────────────────────────────
function ActivityCard({
  node, rank, isWinner, depth,
}: { node: SegmentNode; rank: number; isWinner: boolean; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div
      className="relative rounded-xl transition-colors"
      style={{
        background: 'var(--ink2)',
        border: isWinner ? '1px solid var(--gold)' : '1px solid var(--line)',
        boxShadow: isWinner ? '0 0 0 1px rgba(233,185,73,.25)' : 'none',
        padding: '13px 15px',
      }}
    >
      <div className="flex items-center gap-2.5">
        <span style={{ ...monoFont, fontSize: 11, color: isWinner ? 'var(--gold)' : 'var(--dim)', width: 22 }}>
          {String(rank).padStart(2, '0')}
        </span>
        <span className="font-semibold text-[15px]" style={{ color: 'var(--fog)' }}>
          {node.label}
        </span>
        {isWinner && <Crown className="h-3.5 w-3.5" style={{ color: 'var(--gold)' }} />}
        <span className="ml-auto flex items-center gap-2">
          {hasChildren && (
            <button onClick={() => setOpen(o => !o)}
              className="px-2.5 py-1 rounded-md transition-colors"
              style={{
                ...monoFont, fontSize: 10.5,
                color: open ? 'var(--cyan)' : 'var(--mute)',
                border: `1px solid ${open ? 'var(--cyan)' : 'var(--line)'}`,
              }}>
              {open ? '— close' : `+ ${node.children.length} segment${node.children.length > 1 ? 's' : ''}`}
            </button>
          )}
        </span>
      </div>

      {/* Metrics row */}
      <div className="flex gap-6 items-end mt-3 flex-wrap">
        <Metric label={node.headline.name} value={fmtMetricVal(node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr', node.headline.value)} best={isWinner} />
        <Metric label={node.secondary.name} value={fmtMetricVal(node.secondary.name.toLowerCase(), node.secondary.value)} muted />
        <Metric label="Spend" value={fmtCompact(node.metrics.spend)} />
        <Metric label="Impr" value={fmtNum(node.metrics.impressions)} muted />
        <Metric label="Clicks" value={fmtNum(node.metrics.clicks)} muted />
        {node.metrics.leads > 0 && <Metric label="Leads" value={fmtNum(node.metrics.leads)} best={node.metrics.leads > 0} />}
        <div className="ml-auto"><BenchPill flag={node.benchmarkFlag} /></div>
      </div>

      {/* Nested children (audiences / segments / ad types) */}
      {open && hasChildren && (
        <div className="mt-3 pt-3 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--line)' }}>
          <div style={{ ...monoFont, fontSize: 10, letterSpacing: '.2em', color: 'var(--teal)', textTransform: 'uppercase' }}>
            {depth === 2 ? 'Audiences' : depth === 3 ? 'Segments' : 'Breakdown'} · {node.children.length}
          </div>
          {node.children.map((child, i) => (
            <SegmentPod key={child.key} node={child} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, best, muted }: { label: string; value: string; best?: boolean; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span style={{ ...monoFont, fontSize: 9.5, letterSpacing: '.16em', color: 'var(--dim)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{
        ...monoFont,
        fontSize: muted ? 15 : 19,
        fontWeight: 600,
        color: best ? 'var(--gold2)' : muted ? 'var(--mute)' : 'var(--fog)',
      }}>{value}</span>
    </div>
  );
}

// ─── Pod (audience / nested segment) ─────────────────────────────────────────
function SegmentPod({ node, rank }: { node: SegmentNode; rank: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const dotColor = node.benchmarkFlag === 'PASS' ? 'var(--pass)' : node.benchmarkFlag === 'MISS' ? 'var(--miss)' : 'var(--dim)';

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
          hasChildren ? 'cursor-pointer hover:bg-[#16395266]' : 'cursor-default')}
      >
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span style={{ ...monoFont, fontSize: 11, color: 'var(--gold2)', width: 18, textAlign: 'center', fontWeight: 600 }}>
          {String(rank).padStart(2, '0')}
        </span>
        <span className="text-[13px] font-medium truncate" style={{ color: 'var(--fog)' }}>{node.label}</span>
        <div className="ml-auto flex items-center gap-4">
          <PodMetric label={node.headline.name}
            value={fmtMetricVal(node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr', node.headline.value)}
            best={node.benchmarkFlag === 'PASS'} />
          <PodMetric label="Spend" value={fmtCompact(node.metrics.spend)} />
          <span style={{ ...monoFont, fontSize: 9.5, padding: '3px 7px', borderRadius: 6,
            background: node.benchmarkFlag === 'PASS' ? 'var(--passbg)' : node.benchmarkFlag === 'MISS' ? 'var(--missbg)' : 'transparent',
            color: dotColor }}>
            {node.benchmarkFlag || '—'}
          </span>
          {hasChildren && (
            <ChevronRight className="h-3 w-3 transition-transform"
              style={{ color: 'var(--dim)', transform: open ? 'rotate(90deg)' : 'none' }} />
          )}
        </div>
      </button>
      {open && hasChildren && (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <div style={{ ...monoFont, fontSize: 9, letterSpacing: '.18em', color: 'var(--gold)', textTransform: 'uppercase', margin: '3px 0' }}>
            Breakdown
          </div>
          {node.children.map((c, i) => (
            <div key={c.key} className="flex items-center gap-3 px-3 py-2 rounded-md"
              style={{ background: 'var(--ink2)', border: '1px solid var(--line)' }}>
              <span style={{ ...monoFont, fontSize: 11, color: 'var(--gold2)', fontWeight: 600 }}>{i + 1}</span>
              <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--fog)' }}>{c.label}</span>
              <span style={{ ...monoFont, fontSize: 13, fontWeight: 600, color: 'var(--cyan)' }}>
                {fmtMetricVal(c.headline.lowerIsBetter ? c.headline.name.toLowerCase() : 'ctr', c.headline.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PodMetric({ label, value, best }: { label: string; value: string; best?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span style={{ ...monoFont, fontSize: 8.5, letterSpacing: '.12em', color: 'var(--dim)', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ ...monoFont, fontSize: 14, fontWeight: 600, color: best ? 'var(--gold2)' : 'var(--fog)' }}>{value}</span>
    </div>
  );
}

// ─── Objective section ───────────────────────────────────────────────────────
function ObjectiveSection({ node }: { node: SegmentNode }) {
  const [collapsed, setCollapsed] = useState(false);
  // Winner: best activity by headline metric
  const activities = node.children;
  let winnerKey: string | null = null;
  if (activities.length > 0) {
    const sorted = [...activities].sort((a, b) => {
      const av = a.headline.value ?? (a.headline.lowerIsBetter ? Infinity : -Infinity);
      const bv = b.headline.value ?? (b.headline.lowerIsBetter ? Infinity : -Infinity);
      return a.headline.lowerIsBetter ? av - bv : bv - av;
    });
    winnerKey = sorted[0]?.key ?? null;
  }

  return (
    <div className="mt-3.5 mx-1.5" style={{ borderLeft: '2px solid var(--line2)' }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-[#16395280]"
        style={{
          marginLeft: -2,
          borderLeft: '2px solid var(--cyan)',
          background: 'var(--panel2)',
        }}
      >
        <span style={{ ...serifFont, fontSize: 18, fontWeight: 600, letterSpacing: '.01em', color: 'var(--fog)' }}>
          {node.label}
        </span>
        <span style={{
          ...monoFont, fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
          color: 'var(--ink)', background: 'var(--cyan)', padding: '3px 9px', borderRadius: 20, fontWeight: 600,
        }}>
          {node.headline.name}
        </span>
        <span className="ml-auto" style={{ ...monoFont, fontSize: 12.5, color: 'var(--mute)' }}>
          {fmtCompact(node.metrics.spend)} · {activities.length} {activities.length === 1 ? 'play' : 'plays'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform"
          style={{ color: 'var(--dim)', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
      </button>

      {!collapsed && (
        <div className="mt-2 ml-4 pl-3.5 flex flex-col gap-2.5" style={{ borderLeft: '1px dashed var(--line)' }}>
          {activities.map((act, i) => (
            <ActivityCard key={act.key} node={act} rank={i + 1} isWinner={act.key === winnerKey} depth={2} />
          ))}
          {activities.length === 0 && (
            <div className="text-center py-6" style={{ ...monoFont, fontSize: 11, color: 'var(--dim)' }}>
              No activity data
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Business line panel ─────────────────────────────────────────────────────
function BusinessLinePanel({ node }: { node: SegmentNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, var(--panel) 0%, var(--ink2) 100%)',
        border: '1px solid var(--line)',
        boxShadow: '0 18px 50px -22px rgba(0,0,0,.8)',
      }}
    >
      <div className="flex items-baseline justify-between px-6 py-5"
        style={{ borderBottom: '1px solid var(--line)', background: 'linear-gradient(90deg, rgba(233,185,73,.08), transparent)' }}>
        <h2 style={{ ...serifFont, fontSize: 27, fontWeight: 600, margin: 0, letterSpacing: '-.01em', color: 'var(--fog)' }}>
          {node.label}
        </h2>
        <span style={{ ...monoFont, fontSize: 15, color: 'var(--gold2)' }}>
          {fmtCompact(node.metrics.spend)}
        </span>
      </div>
      <div className="px-4 pb-5 pt-2.5">
        {node.children.map(obj => <ObjectiveSection key={obj.key} node={obj} />)}
        {node.children.length === 0 && (
          <div className="text-center py-8" style={{ ...monoFont, fontSize: 12, color: 'var(--dim)' }}>
            No objectives in this business line
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flat table fallback ─────────────────────────────────────────────────────
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
  const SortIcon = ({ col }: { col: string }) => sortKey !== col ? null :
    sortDir === 'desc'
      ? <ArrowDown className="h-3 w-3 inline" style={{ color: 'var(--cyan)' }} />
      : <ArrowUp className="h-3 w-3 inline" style={{ color: 'var(--cyan)' }} />;

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
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--panel)', border: '1px solid var(--line)',
        boxShadow: '0 18px 50px -22px rgba(0,0,0,.8)' }}>
      <div className="overflow-x-auto" style={{ maxHeight: 720 }}>
        <table className="w-full text-[11.5px]" style={monoFont}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--panel2)', borderBottom: '1px solid var(--line2)' }}>
              {cols.map(c => (
                <th key={c.key} onClick={() => toggleSort(c.key)}
                  className={cn('px-3 py-3 cursor-pointer whitespace-nowrap select-none uppercase',
                    c.align || 'text-left')}
                  style={{
                    fontSize: 10, letterSpacing: '.14em',
                    color: sortKey === c.key ? 'var(--cyan)' : 'var(--dim)',
                  }}>
                  {c.label} <SortIcon col={c.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                <td className="px-3 py-2 max-w-[260px] truncate" title={row.campaignName} style={{ color: 'var(--fog)' }}>{row.campaignName}</td>
                <td className="px-3 py-2">
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'rgba(65,200,214,0.12)', color: 'var(--cyan)', border: '1px solid rgba(65,200,214,0.3)' }}>
                    {row.parsed.business_line}
                  </span>
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--mute)' }}>{row.parsed.objective}</td>
                <td className="px-3 py-2" style={{ color: 'var(--fog)' }}>{row.parsed.activity_type}</td>
                <td className="px-3 py-2" style={{ color: 'var(--mute)' }}>{row.parsed.ad_type}</td>
                <td className="px-3 py-2" style={{ color: 'var(--mute)' }}>{row.parsed.segment}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--gold2)' }}>{fmt$(row.metrics.spend)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--mute)' }}>{fmtNum(row.metrics.impressions)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--mute)' }}>{fmtNum(row.metrics.clicks)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--fog)' }}>{fmtNum(row.metrics.leads)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--fog)' }}>{fmtPct(row.derived.ctr)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--mute)' }}>{fmt$(row.derived.cpc)}</td>
                <td className="px-3 py-2 text-right" style={{ color: 'var(--mute)' }}>{fmt$(row.derived.cpl)}</td>
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

  const [viewMode, setViewMode] = useState<'funnel' | 'flat'>('funnel');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  const passRate = useMemo(() => {
    if (!scorecard.length) return null;
    const valid = scorecard.filter(s => s.flag !== 'N/A');
    if (!valid.length) return null;
    return (valid.filter(s => s.flag === 'PASS').length / valid.length) * 100;
  }, [scorecard]);

  useEffect(() => {
    if (selectedAccount && accessToken) fetchReport(selectedAccount, startDate, endDate);
  }, [selectedAccount, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => { if (selectedAccount) fetchReport(selectedAccount, startDate, endDate); };

  // Outer wrapper — replicates the funnel background
  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        ...funnelTheme,
        background: `
          radial-gradient(1200px 600px at 15% -10%, #163149 0%, transparent 55%),
          radial-gradient(1000px 700px at 110% 10%, #122a3f 0%, transparent 50%),
          var(--ink)
        `,
        margin: '-1.5rem',
        padding: '1.5rem',
        minHeight: 'calc(100vh - 64px)',
        position: 'relative',
      }}
    >
      {/* Faint grid overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.04, zIndex: 0,
          backgroundImage:
            'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />
      <div className="relative" style={{ zIndex: 1, maxWidth: 1320, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  );

  if (!selectedAccount) {
    return (
      <Shell>
        <div className="text-center py-24">
          <Layers className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--dim)' }} />
          <p style={{ color: 'var(--mute)' }}>Select an ad account to view segmentation</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="pt-8 pb-6 mb-6" style={{ borderBottom: '1px solid var(--line)' }}>
        <div style={{ ...monoFont, fontSize: 12, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 14 }}>
          Paid Media · Segmentation Funnel
        </div>
        <h1 style={{
          ...serifFont, fontWeight: 900, fontSize: 'clamp(34px, 5vw, 60px)',
          lineHeight: 0.98, margin: 0, letterSpacing: '-.015em', color: 'var(--fog)',
        }}>
          The Performance <em style={{ fontStyle: 'italic', color: 'var(--cyan)' }}>Funnel</em>
        </h1>
        <p style={{ marginTop: 16, maxWidth: 760, color: 'var(--mute)', fontSize: 15 }}>
          Every dollar traced from business line → objective → the plays that serve it → audiences → segments.
          Each node carries its objective metric, its benchmark, and the best result achieved.
        </p>

        {/* Meta strip */}
        <div className="flex flex-wrap gap-8 mt-6">
          {[
            { label: 'Spend', value: fmtCompact(totals.spend) },
            { label: 'Impressions', value: fmtNum(totals.impressions) },
            { label: 'Clicks', value: fmtNum(totals.clicks) },
            { label: 'Leads', value: fmtNum(totals.leads) },
            { label: 'Ad Sets', value: String(totals.adSets) },
            ...(passRate != null ? [{ label: 'Bench Pass', value: `${passRate.toFixed(0)}%` }] : []),
          ].map(m => (
            <div key={m.label} style={monoFont}>
              <b style={{ display: 'block', fontSize: 22, color: 'var(--fog)', fontWeight: 600 }}>{m.value}</b>
              <span style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--dim)' }}>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Legend + controls */}
        <div className="flex items-center justify-between flex-wrap gap-4 mt-6">
          <div className="flex flex-wrap items-center gap-3" style={{ ...monoFont, fontSize: 11.5, color: 'var(--mute)' }}>
            <Chip><Dot color="var(--pass)" /> beats benchmark</Chip>
            <Chip><Dot color="var(--miss)" /> misses benchmark</Chip>
            <Chip><Dot color="var(--dim)" /> no benchmark</Chip>
            <Chip><Crown className="h-3 w-3" style={{ color: 'var(--gold)' }} /> best play in objective</Chip>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--mute)' }} />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="h-6 text-xs bg-transparent border-none outline-none w-[120px]"
                style={{ color: 'var(--fog)', colorScheme: 'dark', ...monoFont }} />
              <span style={{ color: 'var(--dim)' }}>→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="h-6 text-xs bg-transparent border-none outline-none w-[120px]"
                style={{ color: 'var(--fog)', colorScheme: 'dark', ...monoFont }} />
            </div>
            <button onClick={handleRefresh} disabled={isLoading}
              className="h-9 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all disabled:opacity-50"
              style={{
                background: 'var(--gold)', color: 'var(--ink)',
                ...monoFont, letterSpacing: '.08em', textTransform: 'uppercase',
              }}>
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} /> Apply
            </button>
            {hasBaseline && (
              <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl"
                style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} />
                <span style={{ ...monoFont, fontSize: 10.5, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                  vs Baseline
                </span>
              </label>
            )}
            <div className="flex items-center rounded-xl overflow-hidden"
              style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              {([['funnel', Network, 'Funnel'], ['flat', Table2, 'Table']] as const).map(([mode, Icon, label]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className="h-9 px-4 inline-flex items-center gap-1.5 transition-all"
                  style={{
                    background: viewMode === mode ? 'var(--panel2)' : 'transparent',
                    color: viewMode === mode ? 'var(--cyan)' : 'var(--mute)',
                    ...monoFont, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.1em',
                  }}>
                  <Icon className="h-3 w-3" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────── */}
      {isLoading && tree.length === 0 ? (
        <div className="grid lg:grid-cols-2 gap-7">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-[420px] rounded-2xl" style={{ background: 'var(--panel)' }} />
          ))}
        </div>
      ) : error && tree.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: 'var(--panel)', border: '1px solid var(--miss)' }}>
          <AlertTriangle className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--miss)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--miss)' }}>Failed to load segmentation data</p>
          <p className="text-sm mb-4" style={{ color: 'var(--mute)' }}>{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
          </Button>
        </div>
      ) : viewMode === 'funnel' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
          {tree.map(line => <BusinessLinePanel key={line.key} node={line} />)}
          {tree.length === 0 && !hasConfig && (
            <div className="col-span-full rounded-2xl p-12 text-center"
              style={{ background: 'var(--panel)', border: '1px dashed var(--line)' }}>
              <p style={{ ...monoFont, fontSize: 12, color: 'var(--mute)' }}>
                No segmentation data parsed for this account yet.
              </p>
            </div>
          )}
        </div>
      ) : (
        <FlatTable rows={flatRows} />
      )}

      {/* Footer */}
      <div className="mt-12 pt-5" style={{ ...monoFont, fontSize: 12, color: 'var(--dim)', borderTop: '1px solid var(--line)', lineHeight: 1.7 }}>
        Range: {startDate} → {endDate}
        {compareBaseline && hasBaseline && baselinePeriod && (
          <span className="ml-4">· Benchmark: {baselinePeriod.replace('..', ' – ')}</span>
        )}
        {!hasConfig && tree.length > 0 && (
          <span className="ml-4">· Using generic parser (no custom config for this account)</span>
        )}
      </div>
    </Shell>
  );
}

// Small primitives for legend chips
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
      style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
      {children}
    </span>
  );
}
function Dot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full" style={{ background: color }} />;
}
