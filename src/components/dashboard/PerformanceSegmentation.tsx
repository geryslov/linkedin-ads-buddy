import { useEffect, useState, useMemo } from 'react';
import { usePerformanceSegmentation, type FlatRow } from '@/hooks/usePerformanceSegmentation';
import type { SegmentNode, ScorecardItem } from '@/lib/segmentationAggregator';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  RefreshCw, ChevronDown, ChevronRight, Layers, AlertTriangle,
  TrendingUp, TrendingDown, Table2, TreePine, Calendar, Star,
} from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ─── Maritime color tokens (scoped to this component) ────────────────────────
const C = {
  ink: '#08151f', ink2: '#0d2030', panel: '#10283b', panel2: '#143049',
  line: '#1f4763', line2: '#2b5b7d',
  fog: '#cfe3ef', mute: '#7fa6bf', dim: '#5b829c',
  gold: '#e9b949', gold2: '#f5d27e',
  cyan: '#41c8d6', teal: '#2fa6a0',
  pass: '#4fd08a', passBg: '#10362a', passLine: '#1f5a41',
  miss: '#ef6a5e', missBg: '#3a1714', missLine: '#6e2a23',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt$(v: number | null) { return v != null ? `$${v.toFixed(2)}` : '—'; }
function fmtPct(v: number | null) { return v != null ? `${(v * 100).toFixed(1)}%` : '—'; }
function fmtNum(v: number) { return v.toLocaleString('en-US'); }
function money(v: number) { return '$' + Math.round(v).toLocaleString(); }
function fmtMetricVal(key: string, v: number | null): string {
  if (v == null) return '—';
  if (key === 'ctr' || key === 'eng_rate') return `${(v * 100).toFixed(1)}%`;
  if (key === 'cpl') return '$' + Math.round(v).toLocaleString();
  return `$${v.toFixed(2)}`;
}

function LegendDot({ color }: { color: string }) {
  return <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: color }} />;
}

function BenchBadge({ flag }: { flag: 'PASS' | 'MISS' | 'PAUSE' | null }) {
  if (!flag) return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-mono"
      style={{ background: '#13283a', color: C.mute, border: `1px solid ${C.line}` }}>
      no benchmark
    </span>
  );
  const cfg = {
    PASS: { bg: C.passBg, color: C.pass, border: C.passLine, label: 'PASS' },
    MISS: { bg: C.missBg, color: C.miss, border: C.missLine, label: 'MISS' },
    PAUSE: { bg: C.missBg, color: '#f59e0b', border: '#6e4a00', label: 'PAUSE' },
  };
  const c = cfg[flag];
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-mono font-semibold"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  );
}

function DeltaBadge({ delta }: { delta: { absolute: number; pct: number | null; isBetter: boolean } | null }) {
  if (!delta || delta.pct == null) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold"
      style={{ color: delta.isBetter ? C.pass : C.miss }}>
      {delta.isBetter ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
    </span>
  );
}

function ScorecardCard({ item }: { item: ScorecardItem }) {
  const isCpl = item.label.includes('CPL');
  const flagColor = item.flag === 'PASS' ? C.pass : item.flag === 'MISS' || item.flag === 'PAUSE' ? C.miss : C.dim;
  return (
    <div className="rounded-xl p-4" style={{ background: `linear-gradient(135deg, ${C.panel} 0%, ${C.ink2} 100%)`, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.2em]" style={{ color: C.dim }}>{item.label}</span>
        <BenchBadge flag={item.flag} />
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: flagColor }}>
        {item.currentValue != null ? isCpl ? '$' + Math.round(item.currentValue) : fmtPct(item.currentValue) : '—'}
      </div>
      {item.baselineValue != null && (
        <div className="text-[10px] font-mono mt-1" style={{ color: C.dim }}>
          baseline: {isCpl ? '$' + Math.round(item.baselineValue) : fmtPct(item.baselineValue)}
        </div>
      )}
    </div>
  );
}

function PodRow({ node, headlineKey }: { node: SegmentNode; headlineKey: string }) {
  const dotColor = node.benchmarkFlag === 'PASS' ? C.pass : node.benchmarkFlag === 'MISS' ? C.miss : C.dim;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <LegendDot color={dotColor} />
      <span className="text-[13px] font-medium flex-1 min-w-0 truncate" style={{ color: C.fog }}>{node.label}</span>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <div className="text-[8px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>{node.headline.name}</div>
          <div className="text-[14px] font-mono font-semibold" style={{ color: C.fog }}>{fmtMetricVal(headlineKey, node.headline.value)}</div>
        </div>
        <div className="text-right">
          <div className="text-[8px] font-mono uppercase tracking-widest" style={{ color: C.dim }}>Spend</div>
          <div className="text-[14px] font-mono font-semibold" style={{ color: C.mute }}>{money(node.metrics.spend)}</div>
        </div>
        {node.benchmarkFlag && <BenchBadge flag={node.benchmarkFlag} />}
      </div>
    </div>
  );
}

function ActivityCard({ node, rank, isBest, showBaseline }: { node: SegmentNode; rank: number; isBest: boolean; showBaseline: boolean }) {
  const [open, setOpen] = useState(false);
  const headlineKey = node.headline.lowerIsBetter ? node.headline.name.toLowerCase() : 'ctr';
  const flatPods = useMemo(() => {
    const result: SegmentNode[] = [];
    for (const adType of node.children) {
      for (const seg of adType.children) {
        if (seg.metrics.spend > 0) result.push(seg);
      }
    }
    return result.sort((a, b) => {
      if (a.headline.value == null) return 1;
      if (b.headline.value == null) return -1;
      return node.headline.lowerIsBetter ? a.headline.value - b.headline.value : b.headline.value - a.headline.value;
    });
  }, [node]);

  return (
    <div className="rounded-xl" style={{ background: C.ink2, border: `1px solid ${isBest ? C.gold : C.line}`, boxShadow: isBest ? '0 0 0 1px rgba(233,185,73,0.25)' : undefined }}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] w-5" style={{ color: isBest ? C.gold : C.dim }}>{String(rank).padStart(2, '0')}</span>
          <span className="text-[15px] font-semibold flex-1" style={{ color: C.fog }}>
            {node.label}
            {isBest && <Star className="inline h-3.5 w-3.5 ml-1.5 -mt-0.5" style={{ color: C.gold }} />}
          </span>
          {flatPods.length > 0 && (
            <button onClick={() => setOpen(!open)} className="font-mono text-[10.5px] px-2.5 py-1 rounded-lg cursor-pointer"
              style={{ color: C.mute, border: `1px solid ${C.line}` }}>
              {flatPods.length} audiences {open ? '▴' : '▾'}
            </button>
          )}
        </div>
        <div className="flex items-end gap-5 mt-3 flex-wrap">
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: C.dim }}>{node.headline.name} · avg</div>
            <div className="text-[19px] font-mono font-semibold" style={{ color: C.fog }}>{fmtMetricVal(headlineKey, node.headline.value)}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: C.dim }}>CTR</div>
            <div className="text-[15px] font-mono" style={{ color: C.mute }}>{fmtPct(node.metrics.ctr)}</div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.16em]" style={{ color: C.dim }}>Spend</div>
            <div className="text-[15px] font-mono" style={{ color: C.mute }}>{money(node.metrics.spend)}</div>
          </div>
          <BenchBadge flag={node.benchmarkFlag} />
          {showBaseline && node.headlineDelta && <DeltaBadge delta={node.headlineDelta} />}
        </div>
      </div>
      {open && flatPods.length > 0 && (
        <div className="px-4 pb-4 pt-3 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-1" style={{ color: C.teal }}>
            By audience — {node.headline.lowerIsBetter ? 'lowest' : 'highest'} {node.headline.name} first
          </div>
          {flatPods.map(pod => <PodRow key={pod.key} node={pod} headlineKey={headlineKey} />)}
        </div>
      )}
    </div>
  );
}

function ObjectiveSection({ node, showBaseline }: { node: SegmentNode; showBaseline: boolean }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="ml-1.5" style={{ borderLeft: `2px solid ${C.line2}` }}>
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg -ml-[2px] cursor-pointer"
        style={{ borderLeft: `2px solid ${C.cyan}`, background: C.panel2 }}>
        <span className="text-[13px]" style={{ color: C.dim }}>{collapsed ? '▸' : '▾'}</span>
        <span className="text-[18px] font-semibold" style={{ color: C.fog }}>{node.label}</span>
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase px-2 py-0.5 rounded-full font-semibold"
          style={{ background: C.cyan, color: C.ink }}>{node.headline.name}</span>
        <span className="ml-auto font-mono text-[12.5px]" style={{ color: C.mute }}>
          {money(node.metrics.spend)} · {node.children.length} plays
        </span>
      </button>
      {!collapsed && (
        <div className="ml-4 pl-3.5 flex flex-col gap-2.5 py-2" style={{ borderLeft: `1px dashed ${C.line}` }}>
          {node.children.map((act, i) => (
            <ActivityCard key={act.key} node={act} rank={i + 1} isBest={i === 0 && act.headline.value != null} showBaseline={showBaseline} />
          ))}
        </div>
      )}
    </div>
  );
}

function BusinessLineCard({ node, showBaseline }: { node: SegmentNode; showBaseline: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(180deg, ${C.panel} 0%, ${C.ink2} 100%)`, border: `1px solid ${C.line}`, boxShadow: '0 18px 50px -22px rgba(0,0,0,.8)' }}>
      <div className="flex items-baseline justify-between px-6 py-5" style={{ borderBottom: `1px solid ${C.line}`, background: 'linear-gradient(90deg, rgba(233,185,73,0.08), transparent)' }}>
        <h2 className="text-[27px] font-semibold" style={{ color: C.fog }}>{node.label}</h2>
        <span className="font-mono text-[15px]" style={{ color: C.gold2 }}>{money(node.metrics.spend)}</span>
      </div>
      <div className="p-4 space-y-4">
        {node.children.map(obj => <ObjectiveSection key={obj.key} node={obj} showBaseline={showBaseline} />)}
      </div>
    </div>
  );
}

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
    <div className="rounded-xl overflow-hidden" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]" style={{ color: C.fog }}>
          <thead><tr style={{ background: C.panel2, borderBottom: `1px solid ${C.line}` }}>
            {cols.map(c => (
              <th key={c.key} onClick={() => toggleSort(c.key)}
                className={cn('px-3 py-2.5 font-mono font-semibold cursor-pointer whitespace-nowrap select-none text-[9px] uppercase tracking-[0.15em]',
                  c.align === 'right' ? 'text-right' : 'text-left')}
                style={{ color: sortKey === c.key ? C.cyan : C.dim }}>
                {c.label}{sortKey === c.key && (sortDir === 'desc' ? ' ↓' : ' ↑')}
              </th>
            ))}
          </tr></thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.line}20`, background: i % 2 === 0 ? 'transparent' : `${C.panel2}30` }}>
                <td className="px-3 py-2 max-w-[220px] truncate font-medium" title={row.campaignName}>{row.campaignName}</td>
                <td className="px-3 py-2" style={{ color: C.mute }}>{row.parsed.business_line}</td>
                <td className="px-3 py-2" style={{ color: C.mute }}>{row.parsed.objective}</td>
                <td className="px-3 py-2">{row.parsed.activity_type}</td>
                <td className="px-3 py-2" style={{ color: C.mute }}>{row.parsed.segment}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmt$(row.metrics.spend)}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: C.mute }}>{fmtNum(row.metrics.impressions)}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: C.mute }}>{fmtNum(row.metrics.clicks)}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{fmtNum(row.metrics.leads)}</td>
                <td className="px-3 py-2 text-right font-mono">{fmtPct(row.derived.ctr)}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: C.mute }}>{fmt$(row.derived.cpc)}</td>
                <td className="px-3 py-2 text-right font-mono" style={{ color: C.mute }}>{fmt$(row.derived.cpl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

  if (!selectedAccount) return <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl" style={{ background: C.ink, color: C.mute }}><Layers className="h-10 w-10 mb-3" style={{ color: C.dim }} /><p className="text-sm">Select an ad account</p></div>;

  if (isLoading && tree.length === 0) return (
    <div className="space-y-5 rounded-2xl p-8" style={{ background: C.ink }}>
      <div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: C.panel }}><Layers className="h-5 w-5 animate-pulse" style={{ color: C.cyan }} /></div><div><p className="font-semibold text-sm" style={{ color: C.fog }}>Loading...</p><p className="text-xs" style={{ color: C.dim }}>Parsing campaign names</p></div></div>
      <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: C.panel }} />)}</div>
    </div>
  );

  if (error && tree.length === 0) return (
    <div className="rounded-2xl p-10 text-center" style={{ background: C.ink, border: `1px solid ${C.missLine}` }}>
      <AlertTriangle className="h-8 w-8 mx-auto mb-3" style={{ color: C.miss }} />
      <p className="font-semibold mb-1" style={{ color: C.miss }}>Failed to load</p>
      <p className="text-sm mb-4" style={{ color: C.mute }}>{error}</p>
      <Button variant="outline" size="sm" onClick={handleRefresh}><RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry</Button>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden -mx-6 -mt-2" style={{ background: C.ink }}>
      {/* Header */}
      <div className="px-7 pt-10 pb-6" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-[12px] font-mono tracking-[0.32em] uppercase mb-3" style={{ color: C.gold }}>Paid Media · Segmentation</div>
        <h1 className="text-[clamp(28px,4vw,48px)] font-bold leading-none tracking-tight" style={{ color: C.fog }}>
          The Performance <span className="italic" style={{ color: C.cyan }}>Funnel</span>
        </h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed" style={{ color: C.mute }}>
          Every dollar traced from business line → objective → play → audience. Click a play to expand its audience breakdown.
        </p>
        <div className="flex gap-7 mt-6 flex-wrap">
          {[{ label: 'Total Spend', value: money(totals.spend) }, ...tree.map(n => ({ label: n.label, value: money(n.metrics.spend) })), { label: 'Window', value: `${startDate} → ${endDate}` }, { label: 'Ad Sets', value: String(totals.adSets) }].map(m => (
            <div key={m.label} className="font-mono"><div className="text-[22px] font-semibold" style={{ color: C.fog }}>{m.value}</div><div className="text-[11px] tracking-[0.2em] uppercase" style={{ color: C.dim }}>{m.label}</div></div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-6 flex-wrap">
          <div className="flex items-center gap-4 font-mono text-[11.5px]" style={{ color: C.mute }}>
            {[{ c: C.pass, t: 'beats benchmark' }, { c: C.miss, t: 'misses benchmark' }].map(l => (
              <span key={l.t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
                <LegendDot color={l.c} />{l.t}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ border: `1px solid ${C.line}`, background: C.panel }}>
              <Star className="h-3 w-3" style={{ color: C.gold }} /> best play
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[11px]" style={{ background: C.panel, border: `1px solid ${C.line}`, color: C.fog }}>
              <Calendar className="h-3.5 w-3.5" style={{ color: C.dim }} />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none outline-none w-[100px]" style={{ color: C.fog }} />
              <span style={{ color: C.dim }}>—</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none outline-none w-[100px]" style={{ color: C.fog }} />
            </div>
            <button onClick={handleRefresh} disabled={isLoading} className="px-3 py-1.5 rounded-lg font-mono text-[11px] cursor-pointer" style={{ background: C.cyan, color: C.ink, fontWeight: 600 }}>
              {isLoading ? 'Loading...' : 'Apply'}
            </button>
            {hasBaseline && (
              <label className="flex items-center gap-2 cursor-pointer"><Switch checked={compareBaseline} onCheckedChange={setCompareBaseline} className="h-4 w-7" /><span className="text-[11px] font-mono" style={{ color: C.mute }}>vs baseline</span></label>
            )}
            <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
              <button onClick={() => setViewMode('tree')} className="px-3 py-1.5 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer" style={{ background: viewMode === 'tree' ? C.panel2 : 'transparent', color: viewMode === 'tree' ? C.fog : C.dim }}><TreePine className="h-3 w-3" />Funnel</button>
              <button onClick={() => setViewMode('flat')} className="px-3 py-1.5 text-[11px] font-mono flex items-center gap-1.5 cursor-pointer" style={{ background: viewMode === 'flat' ? C.panel2 : 'transparent', color: viewMode === 'flat' ? C.fog : C.dim, borderLeft: `1px solid ${C.line}` }}><Table2 className="h-3 w-3" />Table</button>
            </div>
          </div>
        </div>
        {!hasConfig && tree.length > 0 && (
          <div className="mt-3 text-[11px] font-mono px-3 py-1.5 rounded-lg inline-flex" style={{ background: C.panel, color: C.dim, border: `1px dashed ${C.line}` }}>Generic parser — no custom config</div>
        )}
      </div>

      {scorecard.length > 0 && <div className="px-7 py-5"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{scorecard.map(item => <ScorecardCard key={item.label} item={item} />)}</div></div>}

      <div className="px-7 pb-10">
        {viewMode === 'tree' ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {tree.map(bl => <BusinessLineCard key={bl.key} node={bl} showBaseline={compareBaseline && hasBaseline} />)}
          </div>
        ) : <FlatTable rows={flatRows} />}
      </div>

      <div className="px-7 py-4 font-mono text-[12px] leading-relaxed" style={{ borderTop: `1px solid ${C.line}`, color: C.dim }}>
        Source: LinkedIn Ads · {startDate} → {endDate}.
        {compareBaseline && hasBaseline && ` Benchmark: ${baselinePeriod?.replace('..', ' – ')}.`}
        {' '}Lead Gen→CPL · Engagement→CTR · Website Visits→CPC · Video/Brand→CPV.
      </div>
    </div>
  );
}
