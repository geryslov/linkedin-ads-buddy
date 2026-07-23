import { useEffect, useRef, useState, useMemo } from 'react';
import {
  useWeeklyReport,
  WeeklyCreativeRow,
  DemoEntry,
  WeekMetrics,
} from '@/hooks/useWeeklyReport';
import { useAIAnalysis } from '@/hooks/useAIAnalysis';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WidgetCard, EmptyState, StatusPill, SegmentedControl } from './widgets';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ImageIcon,
  ArrowUp,
  ArrowDown,
  DollarSign,
  Eye,
  MousePointer,
  Users,
  BarChart2,
  ClipboardList,
  Filter,
  Sparkles,
  Copy,
  Check,
  Loader2,
  Send,
  Share2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { LineChart, Line } from 'recharts';
import { GenerateClientReportDialog } from './GenerateClientReportDialog';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmt$0(v: number) {
  if (v === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}
function fmt$2(v: number) {
  if (v === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtNum(v: number) {
  if (v === 0) return '—';
  return v.toLocaleString('en-US');
}
function fmtPct(v: number) {
  if (v === 0) return '—';
  return `${v.toFixed(2)}%`;
}
function fmtCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}
function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (s.getFullYear() !== e.getFullYear()) {
    return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  if (s.getMonth() === e.getMonth()) {
    return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
}

// ── Theme extraction from creative name ────────────────────────────────────────
// Pattern: img_theme_... or doc_theme_... or message_theme_...
function extractTheme(creativeName: string): string {
  const lower = creativeName.toLowerCase();
  const match = lower.match(/^(?:img|doc|message)_([^_]+(?:_[^_]+)*?)_/);
  if (match) {
    // Take everything between the first _ and the next segment boundary
    // But only the first word/phrase chunk
    const parts = creativeName.split('_');
    if (parts.length >= 3) {
      const prefix = parts[0].toLowerCase();
      if (['img', 'doc', 'message'].includes(prefix)) {
        return parts[1];
      }
    }
  }
  // Fallback: try simple split
  const parts = creativeName.split('_');
  if (parts.length >= 3) {
    const prefix = parts[0].toLowerCase();
    if (['img', 'doc', 'message'].includes(prefix)) {
      return parts[1];
    }
  }
  return 'Other';
}

// ── Creative/campaign status pill ──────────────────────────────────────────────
const STATUS_TONE: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  DRAFT: 'info',
};

function statusPill(status?: string) {
  if (!status) return null;
  return (
    <StatusPill
      tone={STATUS_TONE[status] ?? 'neutral'}
      label={status.charAt(0) + status.slice(1).toLowerCase()}
    />
  );
}

// ── WoW change indicator ───────────────────────────────────────────────────────
function ChangeIndicator({ pct, lowerIsBetter = false }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground text-xs">—</span>;
  const absVal = Math.abs(pct);
  if (absVal < 0.5) {
    return (
      <span className="flex items-center gap-0.5 text-muted-foreground text-xs tabular-nums">
        <Minus className="h-2.5 w-2.5 shrink-0" />~0%
      </span>
    );
  }
  const isPositive = pct > 0;
  const isGood = lowerIsBetter ? !isPositive : isPositive;
  const sign = isPositive ? '+' : '';
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      'flex items-center gap-0.5 text-xs font-medium tabular-nums whitespace-nowrap',
      isGood ? 'text-success' : 'text-destructive'
    )}>
      <Icon className="h-3 w-3 shrink-0" />
      {sign}{absVal.toFixed(1)}%
    </span>
  );
}

// ── Inline sparkline — chart slot 1 ───────────────────────────────────────────
function Sparkline({ data }: { data: { date: string; spent: number }[] }) {
  if (!data || data.length < 2) {
    return <div className="w-[80px] h-[28px] rounded bg-muted/40" />;
  }
  return (
    <LineChart width={80} height={28} data={data}>
      <Line type="monotone" dataKey="spent" stroke="hsl(var(--chart-1))" strokeWidth={1.5} dot={false} isAnimationActive={false} />
    </LineChart>
  );
}

// ── KPI summary card ───────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, pct, lowerIsBetter = false, icon: Icon,
}: {
  label: string; value: string; sub?: string; pct: number | null; lowerIsBetter?: boolean;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl border border-border/70 bg-card" style={{ boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        {label}
      </div>
      <div className="text-xl font-bold tabular-nums text-foreground leading-none">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground tabular-nums">{sub}</div>}
      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-muted-foreground">WoW</span>
        <ChangeIndicator pct={pct} lowerIsBetter={lowerIsBetter} />
      </div>
    </div>
  );
}

// ── Sortable table hook ────────────────────────────────────────────────────────
type SortDir = 'asc' | 'desc';

function useSortableTable<T extends Record<string, any>>(rows: T[], defaultKey: string) {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === 'string') return (av as string).localeCompare(bv as string) * (sortDir === 'asc' ? 1 : -1);
      return ((av as number) - (bv as number)) * (sortDir === 'asc' ? 1 : -1);
    });
  }, [rows, sortKey, sortDir]);

  function SortHeader({ col, label, align }: { col: string; label: string; align?: 'right' }) {
    return (
      <button
        onClick={() => handleSort(col)}
        className={cn(
          'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors',
          align === 'right' && 'flex-row-reverse',
          sortKey === col && 'text-foreground',
        )}
      >
        {label}
        {sortKey === col && (
          sortDir === 'desc'
            ? <ArrowDown className="h-3 w-3 text-primary shrink-0" />
            : <ArrowUp className="h-3 w-3 text-primary shrink-0" />
        )}
      </button>
    );
  }

  return { sorted, handleSort, SortHeader };
}

// ── Demographic bar chart ──────────────────────────────────────────────────────
function DemoChart({ title, data, icon: Icon }: { title: string; data: DemoEntry[]; icon: React.ElementType }) {
  const top10 = data.slice(0, 10);
  const maxImpr = Math.max(...top10.map(d => d.impressions), 1);

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4" style={{ boxShadow: 'var(--shadow-xs)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h4>
      </div>
      {top10.length === 0 ? (
        <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">No data</div>
      ) : (
        <div className="space-y-2">
          {top10.map((entry) => {
            const label = entry.name
              .replace(/^urn:li:[^:]+:/i, '')
              .replace(/_/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase())
              .substring(0, 28);
            return (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="text-[11px] text-muted-foreground w-28 truncate shrink-0" title={entry.name}>
                  {label}
                </div>
                <div className="flex-1 bg-muted/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(entry.impressions / maxImpr) * 100}%`, background: 'hsl(var(--chart-1))' }}
                  />
                </div>
                <div className="text-[11px] tabular-nums text-muted-foreground w-12 text-right shrink-0">
                  {fmtCompact(entry.impressions)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Metrics row helper ─────────────────────────────────────────────────────────
const METRIC_COLS = [
  { key: '_spent', label: 'Spent', format: (v: number) => fmt$0(v) },
  { key: '_impr', label: 'Impr.', format: (v: number) => fmtNum(v) },
  { key: '_clicks', label: 'Clicks', format: (v: number) => fmtNum(v) },
  { key: '_leads', label: 'Leads', format: (v: number) => fmtNum(v) },
  { key: '_ctr', label: 'CTR', format: (v: number) => fmtPct(v) },
  { key: '_cpl', label: 'CPL', format: (v: number) => fmt$2(v) },
] as const;

function flattenMetrics(m: WeekMetrics) {
  return {
    _spent: m.spent,
    _impr: m.impressions,
    _clicks: m.clicks,
    _leads: m.leads,
    _ctr: m.ctr,
    _cpl: m.cpl,
  };
}

// ── Generic metrics table ─────────────────────────────────────────────────────
function GenericMetricsTable<T extends Record<string, any>>({
  rows, nameKey, nameLabel, emptyMessage, renderName, defaultSort = '_spent', showWoW = true,
}: {
  rows: T[];
  nameKey: string;
  nameLabel: string;
  emptyMessage: string;
  renderName?: (row: T) => React.ReactNode;
  defaultSort?: string;
  showWoW?: boolean;
}) {
  const { sorted, SortHeader } = useSortableTable(rows, defaultSort);

  if (rows.length === 0) {
    return <EmptyState icon={BarChart2} title="Nothing to show" description={emptyMessage} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent bg-secondary/40">
          <TableHead className="min-w-[200px]"><SortHeader col={nameKey} label={nameLabel} /></TableHead>
          {METRIC_COLS.map(col => (
            <TableHead key={col.key} className="text-right">
              <SortHeader col={col.key} label={col.label} align="right" />
            </TableHead>
          ))}
          {showWoW && (
            <>
              <TableHead className="text-right">%Spent WoW</TableHead>
              <TableHead className="text-right">%CPL WoW</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row, idx) => (
          <TableRow key={row[nameKey] || idx} className="[&>td]:py-2.5">
            <TableCell className="max-w-[280px]">
              {renderName ? renderName(row) : (
                <span className="font-medium text-xs break-words">{row[nameKey]}</span>
              )}
            </TableCell>
            {METRIC_COLS.map(col => (
              <TableCell key={col.key} className="text-right text-xs tabular-nums">
                {col.format(row[col.key] as number)}
              </TableCell>
            ))}
            {showWoW && (
              <>
                <TableCell className="text-right">
                  <div className="flex justify-end"><ChangeIndicator pct={row.pctSpentChange} lowerIsBetter /></div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end"><ChangeIndicator pct={row.pctCplChange} lowerIsBetter /></div>
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Creative table (with thumbnail + sparkline) ───────────────────────────────
function CreativeTable({ rows }: { rows: WeeklyCreativeRow[] }) {
  const flat = useMemo(() =>
    rows.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [rows]);
  const { sorted, SortHeader } = useSortableTable(flat, '_spent');

  if (rows.length === 0) {
    return <EmptyState icon={ImageIcon} title="Nothing to show" description="No creative data for this week" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent bg-secondary/40">
          <TableHead className="w-[52px]" />
          <TableHead className="min-w-[180px]"><SortHeader col="creativeName" label="Creative" /></TableHead>
          {METRIC_COLS.map(col => (
            <TableHead key={col.key} className="text-right">
              <SortHeader col={col.key} label={col.label} align="right" />
            </TableHead>
          ))}
          <TableHead className="text-right">%Spent WoW</TableHead>
          <TableHead className="text-right">%CPL WoW</TableHead>
          <TableHead className="text-center w-[90px]">Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map(row => (
          <TableRow key={row.creativeName} className="[&>td]:py-2.5">
            <TableCell>
              <div className="h-8 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {row.imageUrl ? (
                  <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                )}
              </div>
            </TableCell>
            <TableCell className="max-w-[220px]">
              <div className="font-medium text-xs line-clamp-2 break-words">{row.creativeName}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] text-muted-foreground">{row.type.replace(/_/g, ' ')}</span>
                {statusPill(row.status)}
              </div>
            </TableCell>
            {METRIC_COLS.map(col => (
              <TableCell key={col.key} className="text-right text-xs tabular-nums">
                {col.format(row[col.key] as number)}
              </TableCell>
            ))}
            <TableCell className="text-right">
              <div className="flex justify-end"><ChangeIndicator pct={row.pctSpentChange} lowerIsBetter /></div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end"><ChangeIndicator pct={row.pctCplChange} lowerIsBetter /></div>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-center">
                <Sparkline data={row.trend} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function WeeklyReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="space-y-2">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    </div>
  );
}

// ── Objective filter type ──────────────────────────────────────────────────────
type ObjectiveFilter = 'all' | 'leadgen' | 'others';

// ── Breakdown dimension ────────────────────────────────────────────────────────
type Breakdown = 'creative' | 'campaign' | 'campaignGroup' | 'creativeType' | 'theme' | 'leadform';

// ── Main component ─────────────────────────────────────────────────────────────
export function WeeklyReport({ accessToken, selectedAccount }: Props) {
  const { data, isLoading, error, fetchReport } = useWeeklyReport(accessToken);
  const aiAnalysis = useAIAnalysis();
  const [objectiveFilter, setObjectiveFilter] = useState<ObjectiveFilter>('all');
  const [breakdown, setBreakdown] = useState<Breakdown>('creative');
  const [copied, setCopied] = useState(false);
  const [digestInput, setDigestInput] = useState('');
  const [publishOpen, setPublishOpen] = useState(false);
  const digestEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedAccount) fetchReport(selectedAccount);
  }, [selectedAccount, fetchReport]);

  // Build a campaignId → objectiveType lookup from byCampaign
  const campaignObjectiveMap = useMemo(() => {
    if (!data) return new Map<string, string>();
    const map = new Map<string, string>();
    for (const c of data.byCampaign) {
      map.set(c.campaignId, c.objectiveType || 'UNKNOWN');
    }
    return map;
  }, [data]);

  // Filter helpers
  const matchesObjective = (objectiveType: string): boolean => {
    if (objectiveFilter === 'all') return true;
    const isLeadGen = objectiveType === 'LEAD_GENERATION';
    return objectiveFilter === 'leadgen' ? isLeadGen : !isLeadGen;
  };

  // Filtered data
  const filteredCreatives = useMemo(() => {
    if (!data) return [];
    if (objectiveFilter === 'all') return data.byCreative;
    return data.byCreative.filter(c => {
      const obj = campaignObjectiveMap.get(c.campaignId) || 'UNKNOWN';
      return matchesObjective(obj);
    });
  }, [data, objectiveFilter, campaignObjectiveMap]);

  const filteredCampaigns = useMemo(() => {
    if (!data) return [];
    if (objectiveFilter === 'all') return data.byCampaign;
    return data.byCampaign.filter(c => matchesObjective(c.objectiveType));
  }, [data, objectiveFilter]);

  const filteredCampaignGroups = useMemo(() => {
    if (!data) return data?.byCampaignGroup || [];
    // Campaign groups don't have objective directly, so we keep all when filter is 'all'
    // For leadgen/others, aggregate from campaigns belonging to each group
    if (objectiveFilter === 'all') return data.byCampaignGroup;
    // Build group metrics from filtered campaigns
    const groupMap = new Map<string, { thisW: { impressions: number; clicks: number; spent: number; leads: number }; lastW: { impressions: number; clicks: number; spent: number; leads: number }; name: string }>();
    for (const c of filteredCampaigns) {
      if (!c.campaignGroupId) continue;
      const existing = groupMap.get(c.campaignGroupId);
      if (!existing) {
        const grp = data.byCampaignGroup.find(g => g.campaignGroupId === c.campaignGroupId);
        groupMap.set(c.campaignGroupId, {
          name: grp?.campaignGroupName || `Group ${c.campaignGroupId}`,
          thisW: { impressions: c.thisWeek.impressions, clicks: c.thisWeek.clicks, spent: c.thisWeek.spent, leads: c.thisWeek.leads },
          lastW: { impressions: c.lastWeek.impressions, clicks: c.lastWeek.clicks, spent: c.lastWeek.spent, leads: c.lastWeek.leads },
        });
      } else {
        existing.thisW.impressions += c.thisWeek.impressions;
        existing.thisW.clicks += c.thisWeek.clicks;
        existing.thisW.spent += c.thisWeek.spent;
        existing.thisW.leads += c.thisWeek.leads;
        existing.lastW.impressions += c.lastWeek.impressions;
        existing.lastW.clicks += c.lastWeek.clicks;
        existing.lastW.spent += c.lastWeek.spent;
        existing.lastW.leads += c.lastWeek.leads;
      }
    }
    return [...groupMap.entries()].map(([id, g]) => {
      const thisM = { ...g.thisW, ctr: g.thisW.impressions > 0 ? (g.thisW.clicks / g.thisW.impressions) * 100 : 0, cpl: g.thisW.leads > 0 ? g.thisW.spent / g.thisW.leads : 0 };
      const lastM = { ...g.lastW, ctr: g.lastW.impressions > 0 ? (g.lastW.clicks / g.lastW.impressions) * 100 : 0, cpl: g.lastW.leads > 0 ? g.lastW.spent / g.lastW.leads : 0 };
      return {
        campaignGroupId: id,
        campaignGroupName: g.name,
        thisWeek: thisM,
        lastWeek: lastM,
        pctSpentChange: g.lastW.spent > 0 ? ((g.thisW.spent - g.lastW.spent) / g.lastW.spent) * 100 : null,
        pctCplChange: lastM.cpl > 0 ? ((thisM.cpl - lastM.cpl) / lastM.cpl) * 100 : null,
      };
    }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);
  }, [data, objectiveFilter, filteredCampaigns]);

  // Creative type aggregation (from filtered creatives)
  const byCreativeType = useMemo(() => {
    const typeMap = new Map<string, { thisW: { impressions: number; clicks: number; spent: number; leads: number }; lastW: { impressions: number; clicks: number; spent: number; leads: number } }>();
    for (const c of filteredCreatives) {
      const type = c.type.replace(/_/g, ' ') || 'Unknown';
      const existing = typeMap.get(type);
      if (!existing) {
        typeMap.set(type, {
          thisW: { impressions: c.thisWeek.impressions, clicks: c.thisWeek.clicks, spent: c.thisWeek.spent, leads: c.thisWeek.leads },
          lastW: { impressions: c.lastWeek.impressions, clicks: c.lastWeek.clicks, spent: c.lastWeek.spent, leads: c.lastWeek.leads },
        });
      } else {
        existing.thisW.impressions += c.thisWeek.impressions;
        existing.thisW.clicks += c.thisWeek.clicks;
        existing.thisW.spent += c.thisWeek.spent;
        existing.thisW.leads += c.thisWeek.leads;
        existing.lastW.impressions += c.lastWeek.impressions;
        existing.lastW.clicks += c.lastWeek.clicks;
        existing.lastW.spent += c.lastWeek.spent;
        existing.lastW.leads += c.lastWeek.leads;
      }
    }
    return [...typeMap.entries()].map(([type, g]) => {
      const thisM = { ...g.thisW, ctr: g.thisW.impressions > 0 ? (g.thisW.clicks / g.thisW.impressions) * 100 : 0, cpl: g.thisW.leads > 0 ? g.thisW.spent / g.thisW.leads : 0 };
      const lastM = { ...g.lastW, ctr: g.lastW.impressions > 0 ? (g.lastW.clicks / g.lastW.impressions) * 100 : 0, cpl: g.lastW.leads > 0 ? g.lastW.spent / g.lastW.leads : 0 };
      return {
        creativeType: type,
        thisWeek: thisM,
        lastWeek: lastM,
        pctSpentChange: g.lastW.spent > 0 ? ((g.thisW.spent - g.lastW.spent) / g.lastW.spent) * 100 : null,
        pctCplChange: lastM.cpl > 0 ? ((thisM.cpl - lastM.cpl) / lastM.cpl) * 100 : null,
        ...{ _spent: thisM.spent, _impr: thisM.impressions, _clicks: thisM.clicks, _leads: thisM.leads, _ctr: thisM.ctr, _cpl: thisM.cpl },
      };
    }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);
  }, [filteredCreatives]);

  // Theme aggregation (from filtered creatives)
  const byTheme = useMemo(() => {
    const themeMap = new Map<string, { thisW: { impressions: number; clicks: number; spent: number; leads: number }; lastW: { impressions: number; clicks: number; spent: number; leads: number } }>();
    for (const c of filteredCreatives) {
      const theme = extractTheme(c.creativeName);
      const existing = themeMap.get(theme);
      if (!existing) {
        themeMap.set(theme, {
          thisW: { impressions: c.thisWeek.impressions, clicks: c.thisWeek.clicks, spent: c.thisWeek.spent, leads: c.thisWeek.leads },
          lastW: { impressions: c.lastWeek.impressions, clicks: c.lastWeek.clicks, spent: c.lastWeek.spent, leads: c.lastWeek.leads },
        });
      } else {
        existing.thisW.impressions += c.thisWeek.impressions;
        existing.thisW.clicks += c.thisWeek.clicks;
        existing.thisW.spent += c.thisWeek.spent;
        existing.thisW.leads += c.thisWeek.leads;
        existing.lastW.impressions += c.lastWeek.impressions;
        existing.lastW.clicks += c.lastWeek.clicks;
        existing.lastW.spent += c.lastWeek.spent;
        existing.lastW.leads += c.lastWeek.leads;
      }
    }
    return [...themeMap.entries()].map(([theme, g]) => {
      const thisM = { ...g.thisW, ctr: g.thisW.impressions > 0 ? (g.thisW.clicks / g.thisW.impressions) * 100 : 0, cpl: g.thisW.leads > 0 ? g.thisW.spent / g.thisW.leads : 0 };
      const lastM = { ...g.lastW, ctr: g.lastW.impressions > 0 ? (g.lastW.clicks / g.lastW.impressions) * 100 : 0, cpl: g.lastW.leads > 0 ? g.lastW.spent / g.lastW.leads : 0 };
      return {
        theme,
        thisWeek: thisM,
        lastWeek: lastM,
        pctSpentChange: g.lastW.spent > 0 ? ((g.thisW.spent - g.lastW.spent) / g.lastW.spent) * 100 : null,
        pctCplChange: lastM.cpl > 0 ? ((thisM.cpl - lastM.cpl) / lastM.cpl) * 100 : null,
        ...{ _spent: thisM.spent, _impr: thisM.impressions, _clicks: thisM.clicks, _leads: thisM.leads, _ctr: thisM.ctr, _cpl: thisM.cpl },
      };
    }).sort((a, b) => b.thisWeek.spent - a.thisWeek.spent);
  }, [filteredCreatives]);

  // Flatten for campaign/group/form tables
  const flatCampaigns = useMemo(() =>
    filteredCampaigns.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [filteredCampaigns]);

  const flatCampaignGroups = useMemo(() =>
    filteredCampaignGroups.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [filteredCampaignGroups]);

  const flatLeadForms = useMemo(() =>
    (data?.byLeadForm ?? []).map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [data]);

  if (!selectedAccount) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={BarChart2}
          title="No account selected"
          description="Select an ad account to view the weekly report."
        />
      </WidgetCard>
    );
  }

  if (isLoading) return <WeeklyReportSkeleton />;

  if (error) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={RefreshCw}
          title="Failed to load weekly report"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={() => selectedAccount && fetchReport(selectedAccount)}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry
            </Button>
          }
        />
      </WidgetCard>
    );
  }

  if (!data) return null;

  const { summary, weekRange, byLeadForm, demographics } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Week of {formatWeekRange(weekRange.thisWeek.start, weekRange.thisWeek.end)}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            vs. {formatWeekRange(weekRange.lastWeek.start, weekRange.lastWeek.end)}
            <span className="ml-2 text-muted-foreground/60">(Sun–Sat)</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Objective filter */}
          <Select value={objectiveFilter} onValueChange={(v) => setObjectiveFilter(v as ObjectiveFilter)}>
            <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border">
              <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Objectives</SelectItem>
              <SelectItem value="leadgen">Lead Generation</SelectItem>
              <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectedAccount && fetchReport(selectedAccount)}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setPublishOpen(true)}
            disabled={!data || !selectedAccount}
            className="gap-1.5"
          >
            <Share2 className="h-3.5 w-3.5" />
            Publish for client
          </Button>
        </div>
      </div>

      {data && selectedAccount && (
        <GenerateClientReportDialog
          open={publishOpen}
          onOpenChange={setPublishOpen}
          data={data}
          accountId={selectedAccount}
        />
      )}

      {/* KPI summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Spent"
          value={fmt$0(summary.thisWeek.spent)}
          sub={`vs. ${fmt$0(summary.lastWeek.spent)}`}
          pct={summary.pctSpentChange}
          lowerIsBetter
          icon={DollarSign}
        />
        <KpiCard
          label="Impressions"
          value={fmtNum(summary.thisWeek.impressions)}
          sub={`vs. ${fmtNum(summary.lastWeek.impressions)}`}
          pct={summary.pctImpressionsChange}
          icon={Eye}
        />
        <KpiCard
          label="Clicks"
          value={fmtNum(summary.thisWeek.clicks)}
          sub={`vs. ${fmtNum(summary.lastWeek.clicks)}`}
          pct={summary.pctClicksChange}
          icon={MousePointer}
        />
        <KpiCard
          label="Leads"
          value={fmtNum(summary.thisWeek.leads)}
          sub={`vs. ${fmtNum(summary.lastWeek.leads)}`}
          pct={summary.pctLeadsChange}
          icon={Users}
        />
        <KpiCard
          label="CTR"
          value={fmtPct(summary.thisWeek.ctr)}
          sub={`vs. ${fmtPct(summary.lastWeek.ctr)}`}
          pct={summary.pctCtrChange}
          icon={BarChart2}
        />
        <KpiCard
          label="CPL"
          value={fmt$2(summary.thisWeek.cpl)}
          sub={`vs. ${fmt$2(summary.lastWeek.cpl)}`}
          pct={summary.pctCplChange}
          lowerIsBetter
          icon={DollarSign}
        />
      </div>

      {/* Performance breakdown */}
      <WidgetCard
        noPadding
        title="Performance breakdown"
        subtitle="This week vs. last, by dimension"
      >
        <div className="px-5 pb-3">
          <SegmentedControl
            size="sm"
            value={breakdown}
            onChange={setBreakdown}
            className="flex-wrap"
            options={[
              { value: 'creative', label: <>Creative <span className="opacity-60">{filteredCreatives.length}</span></> },
              { value: 'campaign', label: <>Campaign <span className="opacity-60">{filteredCampaigns.length}</span></> },
              { value: 'campaignGroup', label: <>Group <span className="opacity-60">{filteredCampaignGroups.length}</span></> },
              { value: 'creativeType', label: <>Type <span className="opacity-60">{byCreativeType.length}</span></> },
              { value: 'theme', label: <>Theme <span className="opacity-60">{byTheme.length}</span></> },
              { value: 'leadform', label: <>Lead Form <span className="opacity-60">{byLeadForm.length}</span></> },
            ]}
          />
        </div>

        {breakdown === 'creative' && <CreativeTable rows={filteredCreatives} />}

        {breakdown === 'campaign' && (
          <GenericMetricsTable
            rows={flatCampaigns}
            nameKey="campaignName"
            nameLabel="Campaign"
            emptyMessage="No campaign data for this week"
            renderName={(row) => (
              <div>
                <div className="font-medium text-xs break-words">{row.campaignName}</div>
                <div className="mt-1">{statusPill(row.status)}</div>
              </div>
            )}
          />
        )}

        {breakdown === 'campaignGroup' && (
          <GenericMetricsTable
            rows={flatCampaignGroups}
            nameKey="campaignGroupName"
            nameLabel="Campaign Group"
            emptyMessage="No campaign group data for this week"
          />
        )}

        {breakdown === 'creativeType' && (
          <GenericMetricsTable
            rows={byCreativeType}
            nameKey="creativeType"
            nameLabel="Creative Type"
            emptyMessage="No creative type data"
          />
        )}

        {breakdown === 'theme' && (
          <GenericMetricsTable
            rows={byTheme}
            nameKey="theme"
            nameLabel="Theme"
            emptyMessage="No theme data (creative names need img_/doc_/message_ prefix)"
          />
        )}

        {breakdown === 'leadform' && (
          <GenericMetricsTable
            rows={flatLeadForms}
            nameKey="formName"
            nameLabel="Lead Form"
            emptyMessage="No lead form data available"
          />
        )}
      </WidgetCard>

      {/* Demographics */}
      <WidgetCard
        title="Audience Demographics"
        subtitle="This week · top 10 by impressions"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DemoChart title="Job Title" data={demographics.jobTitle} icon={Users} />
          <DemoChart title="Seniority" data={demographics.seniority} icon={BarChart2} />
          <DemoChart title="Industry" data={demographics.industry} icon={ClipboardList} />
          <DemoChart title="Company Size" data={demographics.companySize} icon={Users} />
        </div>
      </WidgetCard>

      {/* ── AI Weekly Digest ──────────────────────────────────────── */}
      <WidgetCard
        noPadding
        className={cn('transition-colors duration-300', aiAnalysis.isLoading && 'border-primary/40')}
        title={
          <span className="flex items-center gap-2.5">
            <span className={cn('h-6 w-6 rounded-md flex items-center justify-center transition-colors', aiAnalysis.isLoading ? 'bg-primary/20' : 'bg-primary/10')}>
              <Sparkles className={cn('h-3.5 w-3.5 text-primary', aiAnalysis.isLoading && 'animate-pulse')} />
            </span>
            AI Client Digest
            {aiAnalysis.isLoading && (
              <span className="flex gap-0.5 items-center">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-1 w-1 rounded-full bg-primary/50 animate-bounce"
                    style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
                ))}
              </span>
            )}
          </span>
        }
        toolbar={
          <>
            {/* Copy button — visible when there's assistant text */}
            {aiAnalysis.messages.some(m => m.role === 'assistant') && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  const text = aiAnalysis.messages.filter(m => m.role === 'assistant').pop()?.content || '';
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={aiAnalysis.isLoading}
              onClick={() => {
                aiAnalysis.clearHistory();
                const digestPayload = {
                  weekRange,
                  summary,
                  topCreatives: filteredCreatives.slice(0, 10).map(c => ({
                    name: c.creativeName, status: c.status,
                    thisWeek: { spent: c.thisWeek.spent, impressions: c.thisWeek.impressions, clicks: c.thisWeek.clicks, leads: c.thisWeek.leads, ctr: +c.thisWeek.ctr.toFixed(2), cpl: +c.thisWeek.cpl.toFixed(2) },
                    lastWeek: { spent: c.lastWeek.spent, impressions: c.lastWeek.impressions, clicks: c.lastWeek.clicks, leads: c.lastWeek.leads, ctr: +c.lastWeek.ctr.toFixed(2), cpl: +c.lastWeek.cpl.toFixed(2) },
                    pctSpentChange: c.pctSpentChange, pctCplChange: c.pctCplChange,
                  })),
                  topCampaigns: filteredCampaigns.slice(0, 8).map(c => ({
                    name: c.campaignName, status: c.status, objective: c.objectiveType,
                    thisWeek: { spent: c.thisWeek.spent, leads: c.thisWeek.leads, ctr: +c.thisWeek.ctr.toFixed(2), cpl: +c.thisWeek.cpl.toFixed(2) },
                    pctSpentChange: c.pctSpentChange, pctCplChange: c.pctCplChange,
                  })),
                  leadForms: byLeadForm.slice(0, 5).map(f => ({
                    name: f.formName,
                    thisWeek: { leads: f.thisWeek.leads, cpl: +f.thisWeek.cpl.toFixed(2), spent: f.thisWeek.spent },
                    pctCplChange: f.pctCplChange,
                  })),
                  topDemographics: {
                    jobTitles: demographics.jobTitle.slice(0, 5).map(d => d.name.replace(/^urn:li:[^:]+:/i, '')),
                    seniorities: demographics.seniority.slice(0, 3).map(d => d.name.replace(/^urn:li:[^:]+:/i, '')),
                  },
                };
                aiAnalysis.ask(
                  'Write a client-ready weekly performance digest I can paste into email or Slack.',
                  digestPayload,
                  'weekly_digest',
                );
              }}
            >
              <Sparkles className="h-3 w-3" />
              {aiAnalysis.messages.length > 0 ? 'Regenerate' : 'Generate Digest'}
            </Button>
          </>
        }
      >
        {/* Streaming progress */}
        {aiAnalysis.isLoading && (
          <div className="h-0.5 bg-primary/10 overflow-hidden">
            <div className="h-full bg-primary/40 animate-pulse w-full" />
          </div>
        )}

        {/* Messages */}
        <div className="max-h-[500px] overflow-y-auto scroll-smooth border-t border-border/60" style={{ scrollbarWidth: 'thin' }}>
          <div className="px-5 py-4 space-y-4">
            {aiAnalysis.messages.length === 0 && !aiAnalysis.isLoading && (
              <EmptyState
                icon={Sparkles}
                title='Click "Generate Digest" to create a client-ready summary'
                description="AI writes a narrative you can paste into email or Slack"
                className="py-12"
              />
            )}

            {aiAnalysis.messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[75%]" style={{ boxShadow: 'var(--shadow-xs)' }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-tl-sm bg-secondary/40 border border-border/40 px-4 py-3.5">
                    <div className="prose prose-sm dark:prose-invert max-w-none
                      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                      [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2
                      [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1.5
                      [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
                      [&_li]:text-[13px] [&_p]:text-[13px] [&_p]:leading-relaxed
                      [&_strong]:text-foreground
                      [&_ul]:space-y-0.5 [&_ol]:space-y-0.5
                    ">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {aiAnalysis.isLoading && aiAnalysis.messages.length === 0 && (
              <div className="rounded-2xl rounded-tl-sm bg-secondary/30 border border-border/30 px-4 py-3">
                <div className="flex gap-1 items-center h-4">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/50 animate-bounce"
                      style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={digestEndRef} />
          </div>
        </div>

        {/* Follow-up input */}
        {aiAnalysis.messages.length > 0 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = digestInput.trim();
              if (!q) return;
              setDigestInput('');
              aiAnalysis.ask(q, { weekRange, summary }, 'weekly_digest');
            }}
            className="flex gap-2 px-4 py-3 border-t border-border/40"
          >
            <input
              value={digestInput}
              onChange={e => setDigestInput(e.target.value)}
              placeholder="Ask for a different tone, add details, or adjust the digest..."
              disabled={aiAnalysis.isLoading}
              className="flex-1 h-9 text-sm bg-transparent border border-border/60 rounded-md px-3 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            {aiAnalysis.isLoading ? (
              <Button type="button" size="icon" variant="ghost" onClick={aiAnalysis.cancel} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!digestInput.trim()} className="h-9 w-9">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
        )}
      </WidgetCard>
    </div>
  );
}
