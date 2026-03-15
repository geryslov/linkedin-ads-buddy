import { useEffect, useState, useMemo } from 'react';
import {
  useWeeklyReport,
  WeeklyCreativeRow,
  WeeklyCampaignRow,
  WeeklyFormRow,
  DemoEntry,
  WeekMetrics,
} from '@/hooks/useWeeklyReport';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

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
      isGood ? 'text-green-600' : 'text-red-500'
    )}>
      <Icon className="h-3 w-3 shrink-0" />
      {sign}{absVal.toFixed(1)}%
    </span>
  );
}

// ── Inline sparkline (80×28px, no axes) ───────────────────────────────────────
function Sparkline({ data }: { data: { date: string; spent: number }[] }) {
  if (!data || data.length < 2) {
    return <div className="w-[80px] h-[28px] rounded bg-muted/40" />;
  }
  return (
    <LineChart width={80} height={28} data={data}>
      <Line type="monotone" dataKey="spent" stroke="#2563EB" strokeWidth={1.5} dot={false} isAnimationActive={false} />
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
    <div className="flex flex-col gap-1.5 p-4 rounded-lg border border-border/70 bg-card shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums text-foreground leading-none">{value}</div>
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

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return null;
    return sortDir === 'desc'
      ? <ArrowDown className="h-3 w-3 text-primary shrink-0" />
      : <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  }

  return { sorted, handleSort, SortIcon };
}

// ── Demographic bar chart (inline progress bars) ───────────────────────────────
function DemoChart({ title, data, icon: Icon }: { title: string; data: DemoEntry[]; icon: React.ElementType }) {
  const top10 = data.slice(0, 10);
  const maxImpr = Math.max(...top10.map(d => d.impressions), 1);

  return (
    <div className="rounded-lg border border-border/70 bg-card shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
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
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(entry.impressions / maxImpr) * 100}%` }}
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

// ── Metrics row helper (shared by all 3 tables) ───────────────────────────────
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

// ── Creative table ─────────────────────────────────────────────────────────────
function CreativeTable({ rows }: { rows: WeeklyCreativeRow[] }) {
  const flat = useMemo(() =>
    rows.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [rows]);
  const { sorted, handleSort, SortIcon } = useSortableTable(flat, '_spent');

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No creative data for this week
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="p-2 w-[52px]" />
              <th
                className="text-left p-2 font-semibold text-xs min-w-[180px] cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => handleSort('creativeName')}
              >
                <div className="flex items-center gap-1">Creative <SortIcon col="creativeName" /></div>
              </th>
              {METRIC_COLS.map(col => (
                <th
                  key={col.key}
                  className="text-right p-2 font-semibold text-xs cursor-pointer hover:bg-muted/60 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-end gap-1">{col.label}<SortIcon col={col.key} /></div>
                </th>
              ))}
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%Spent WoW</th>
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%CPL WoW</th>
              <th className="text-center p-2 font-semibold text-xs w-[90px]">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map(row => (
              <tr key={row.creativeName} className="hover:bg-muted/30 transition-colors duration-150">
                <td className="p-2">
                  <div className="h-8 w-14 rounded bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {row.imageUrl ? (
                      <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                    )}
                  </div>
                </td>
                <td className="p-2 max-w-[220px]">
                  <div className="font-medium text-xs line-clamp-2 break-words">{row.creativeName}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {row.type.replace(/_/g, ' ')}
                    {row.status && (
                      <span className={cn(
                        'ml-1.5 font-medium',
                        row.status === 'ACTIVE' ? 'text-green-600' : 'text-muted-foreground'
                      )}>· {row.status}</span>
                    )}
                  </div>
                </td>
                {METRIC_COLS.map(col => (
                  <td key={col.key} className="p-2 text-right text-xs font-mono tabular-nums">
                    {col.format(row[col.key] as number)}
                  </td>
                ))}
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctSpentChange} lowerIsBetter />
                </td>
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctCplChange} lowerIsBetter />
                </td>
                <td className="p-2 flex items-center justify-center">
                  <Sparkline data={row.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Campaign table ─────────────────────────────────────────────────────────────
function CampaignTable({ rows }: { rows: WeeklyCampaignRow[] }) {
  const flat = useMemo(() =>
    rows.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [rows]);
  const { sorted, handleSort, SortIcon } = useSortableTable(flat, '_spent');

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No campaign data for this week
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th
                className="text-left p-2 font-semibold text-xs min-w-[200px] cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => handleSort('campaignName')}
              >
                <div className="flex items-center gap-1">Campaign <SortIcon col="campaignName" /></div>
              </th>
              {METRIC_COLS.map(col => (
                <th
                  key={col.key}
                  className="text-right p-2 font-semibold text-xs cursor-pointer hover:bg-muted/60 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-end gap-1">{col.label}<SortIcon col={col.key} /></div>
                </th>
              ))}
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%Spent WoW</th>
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%CPL WoW</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map(row => (
              <tr key={row.campaignId} className="hover:bg-muted/30 transition-colors duration-150">
                <td className="p-2 max-w-[280px]">
                  <div className="font-medium text-xs break-words">{row.campaignName}</div>
                  <div className={cn(
                    'text-[10px] font-medium mt-0.5',
                    row.status === 'ACTIVE' ? 'text-green-600' : 'text-muted-foreground'
                  )}>{row.status}</div>
                </td>
                {METRIC_COLS.map(col => (
                  <td key={col.key} className="p-2 text-right text-xs font-mono tabular-nums">
                    {col.format(row[col.key] as number)}
                  </td>
                ))}
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctSpentChange} lowerIsBetter />
                </td>
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctCplChange} lowerIsBetter />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Lead form table ────────────────────────────────────────────────────────────
function LeadFormTable({ rows }: { rows: WeeklyFormRow[] }) {
  const flat = useMemo(() =>
    rows.map(r => ({ ...r, ...flattenMetrics(r.thisWeek) })), [rows]);
  const { sorted, handleSort, SortIcon } = useSortableTable(flat, '_leads');

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-1.5 text-muted-foreground text-sm">
        <span>No lead form data available</span>
        <span className="text-xs text-center max-w-xs">
          Lead forms appear when creatives are linked to a LinkedIn Lead Gen Form
        </span>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th
                className="text-left p-2 font-semibold text-xs min-w-[200px] cursor-pointer hover:bg-muted/60 transition-colors"
                onClick={() => handleSort('formName')}
              >
                <div className="flex items-center gap-1">Lead Form <SortIcon col="formName" /></div>
              </th>
              {METRIC_COLS.map(col => (
                <th
                  key={col.key}
                  className="text-right p-2 font-semibold text-xs cursor-pointer hover:bg-muted/60 transition-colors whitespace-nowrap"
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center justify-end gap-1">{col.label}<SortIcon col={col.key} /></div>
                </th>
              ))}
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%Spent WoW</th>
              <th className="text-right p-2 font-semibold text-xs whitespace-nowrap">%CPL WoW</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {sorted.map(row => (
              <tr key={row.formId} className="hover:bg-muted/30 transition-colors duration-150">
                <td className="p-2 max-w-[280px]">
                  <span className="font-medium text-xs break-words">{row.formName}</span>
                </td>
                {METRIC_COLS.map(col => (
                  <td key={col.key} className="p-2 text-right text-xs font-mono tabular-nums">
                    {col.format(row[col.key] as number)}
                  </td>
                ))}
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctSpentChange} lowerIsBetter />
                </td>
                <td className="p-2 text-right">
                  <ChangeIndicator pct={row.pctCplChange} lowerIsBetter />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="space-y-2">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function WeeklyReport({ accessToken, selectedAccount }: Props) {
  const { data, isLoading, error, fetchReport } = useWeeklyReport(accessToken);

  useEffect(() => {
    if (selectedAccount) fetchReport(selectedAccount);
  }, [selectedAccount, fetchReport]);

  if (!selectedAccount) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Select an ad account to view the weekly report
      </div>
    );
  }

  if (isLoading) return <WeeklyReportSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-destructive text-sm">{error}</p>
        <Button variant="outline" size="sm" onClick={() => selectedAccount && fetchReport(selectedAccount)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, weekRange, byCreative, byCampaign, byLeadForm, demographics } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Week of {formatWeekRange(weekRange.thisWeek.start, weekRange.thisWeek.end)}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            vs. {formatWeekRange(weekRange.lastWeek.start, weekRange.lastWeek.end)}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => selectedAccount && fetchReport(selectedAccount)}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

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

      {/* Performance breakdown tabs */}
      <Tabs defaultValue="creative" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="creative" className="text-xs sm:text-sm gap-1.5">
            By Creative
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{byCreative.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="campaign" className="text-xs sm:text-sm gap-1.5">
            By Campaign
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{byCampaign.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="leadform" className="text-xs sm:text-sm gap-1.5">
            By Lead Form
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{byLeadForm.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="creative">
          <CreativeTable rows={byCreative} />
        </TabsContent>
        <TabsContent value="campaign">
          <CampaignTable rows={byCampaign} />
        </TabsContent>
        <TabsContent value="leadform">
          <LeadFormTable rows={byLeadForm} />
        </TabsContent>
      </Tabs>

      {/* Demographics */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Audience Demographics — This Week
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DemoChart title="Job Title" data={demographics.jobTitle} icon={Users} />
          <DemoChart title="Seniority" data={demographics.seniority} icon={BarChart2} />
          <DemoChart title="Industry" data={demographics.industry} icon={ClipboardList} />
          <DemoChart title="Company Size" data={demographics.companySize} icon={Users} />
        </div>
      </div>
    </div>
  );
}
