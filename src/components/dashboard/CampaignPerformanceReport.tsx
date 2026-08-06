import { useEffect, useState, useMemo, Fragment } from 'react';
import { useCampaignPerformanceReport, CampaignPerformanceRow, PeriodMetrics } from '@/hooks/useCampaignPerformanceReport';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, ArrowUp, ArrowDown, TrendingUp, TrendingDown, ChevronRight, ChevronDown, Copy, Info, Sparkles, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { WidgetCard, StatusPill } from './widgets';
import { AIAnalysisPanel } from './AIAnalysisPanel';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

type SortKey = 'campaignName' | '7d_spend' | '7d_cpl' | '7d_ctr' | '14d_spend' | '14d_cpl' | '14d_ctr' | '30d_spend' | '30d_cpl' | '30d_ctr' | 'lm_spend' | 'lm_cpl' | 'lm_ctr';

/* Period identity — chart slots 1-4 in fixed order (never cycled). */
const PERIODS = [
  { key: '7d', label: 'Last 7 Days', field: 'last7d' as const, color: 'hsl(var(--chart-1))' },
  { key: '14d', label: 'Last 14 Days', field: 'last14d' as const, color: 'hsl(var(--chart-2))' },
  { key: '30d', label: 'Last 30 Days', field: 'last30d' as const, color: 'hsl(var(--chart-3))' },
  { key: 'lm', label: 'Last Month', field: 'lastMonth' as const, color: 'hsl(var(--chart-4))' },
];

/* Alternating neutral bands separate period groups without fighting the ink palette. */
const PERIOD_BG = ['bg-secondary/25', '', 'bg-secondary/25', ''];
const PERIOD_BORDER = 'border-l border-border/70';

function getMetricValue(row: CampaignPerformanceRow, key: SortKey): number | string {
  if (key === 'campaignName') return row.campaignName;
  const [period, metric] = key.split('_') as [string, string];
  const periodMap: Record<string, keyof CampaignPerformanceRow> = { '7d': 'last7d', '14d': 'last14d', '30d': 'last30d', 'lm': 'lastMonth' };
  const p = row[periodMap[period]] as PeriodMetrics;
  if (metric === 'cpl') return p.cpl;
  if (metric === 'ctr') return p.ctr;
  if (metric === 'spend') return p.spent;
  return 0;
}

function FatigueIndicator({ row }: { row: { last7d: PeriodMetrics; last30d: PeriodMetrics } }) {
  const cpl7 = row.last7d.cpl, cpl30 = row.last30d.cpl;
  const ctr7 = row.last7d.ctr, ctr30 = row.last30d.ctr;
  const cplRising = cpl7 > 0 && cpl30 > 0 && cpl7 > cpl30 * 1.15;
  const ctrDecline = ctr7 > 0 && ctr30 > 0 && ctr7 < ctr30 * 0.85;
  const cplChange = cpl30 > 0 ? ((cpl7 - cpl30) / cpl30 * 100).toFixed(0) : '—';
  const ctrChange = ctr30 > 0 ? ((ctr7 - ctr30) / ctr30 * 100).toFixed(0) : '—';
  if (!cplRising && !ctrDecline) return <StatusPill tone="success" label="OK" />;
  return (
    <TooltipProvider>
      <div className="flex flex-row gap-1 items-center justify-center flex-nowrap">
        {cplRising && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/[0.08] text-destructive text-[10px] font-semibold tabular-nums cursor-help whitespace-nowrap">
                <TrendingUp className="h-3 w-3 shrink-0" />CPL +{cplChange}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs max-w-[220px]">
              <p>CPL 7d: {formatCurrency(cpl7)} vs 30d: {formatCurrency(cpl30)}</p>
              <p className="text-muted-foreground mt-0.5">Threshold: &gt;15% increase</p>
            </TooltipContent>
          </Tooltip>
        )}
        {ctrDecline && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-destructive/[0.08] text-destructive text-[10px] font-semibold tabular-nums cursor-help whitespace-nowrap">
                <TrendingDown className="h-3 w-3 shrink-0" />CTR {ctrChange}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs max-w-[220px]">
              <p>CTR 7d: {ctr7.toFixed(2)}% vs 30d: {ctr30.toFixed(2)}%</p>
              <p className="text-muted-foreground mt-0.5">Threshold: &gt;15% decline</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function formatCurrency(value: number): string {
  if (value === 0) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function MetricCell({ value, format }: { value: number; format: 'currency' | 'percent' }) {
  if (value === 0) return <span className="text-muted-foreground/50">—</span>;
  if (format === 'currency') return <span>{formatCurrency(value)}</span>;
  return <span>{value.toFixed(2)}%</span>;
}

function RowStatusPill({ status }: { status: string }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'neutral';
  const label = status === 'ACTIVE' ? 'Active' : status.charAt(0) + status.slice(1).toLowerCase();
  return <StatusPill tone={tone} label={label} className="text-[10px] px-1.5" />;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success('Copied to clipboard');
  });
}

export function CampaignPerformanceReport({ accessToken, selectedAccount }: Props) {
  const { data, isLoading, error, fetchReport } = useCampaignPerformanceReport(accessToken);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('7d_spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeOnly, setActiveOnly] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  useEffect(() => {
    if (selectedAccount) fetchReport(selectedAccount);
  }, [selectedAccount, fetchReport]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.campaignName.toLowerCase().includes(q));
    }
    if (activeOnly) {
      result = result.filter(r => r.ads.some(ad => ad.adStatus === 'ACTIVE'));
    }
    return result;
  }, [data, search, activeOnly]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = getMetricValue(a, sortKey);
      const bVal = getMetricValue(b, sortKey);
      const mod = sortOrder === 'asc' ? 1 : -1;
      if (typeof aVal === 'string') return (aVal as string).localeCompare(bVal as string) * mod;
      return ((aVal as number) - (bVal as number)) * mod;
    });
  }, [filtered, sortKey, sortOrder]);

  const totals = useMemo(() => {
    const sum = (period: 'last7d' | 'last14d' | 'last30d' | 'lastMonth') => {
      const agg = filtered.reduce((acc, r) => ({
        spent: acc.spent + r[period].spent,
        leads: acc.leads + r[period].leads,
        clicks: acc.clicks + r[period].clicks,
        impressions: acc.impressions + r[period].impressions,
      }), { spent: 0, leads: 0, clicks: 0, impressions: 0 });
      return {
        spend: agg.spent,
        cpl: agg.leads > 0 ? agg.spent / agg.leads : 0,
        ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
      };
    };
    return { last7d: sum('last7d'), last14d: sum('last14d'), last30d: sum('last30d'), lastMonth: sum('lastMonth') };
  }, [filtered]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72" />
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/20 rounded-xl p-8 bg-destructive/5 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortOrder === 'desc'
      ? <ArrowDown className="h-3 w-3 text-primary shrink-0" />
      : <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  };

  const TH_BASE = 'p-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap';

  const subHeader = (prefix: string, label: string, metric: 'spend' | 'cpl' | 'ctr', periodIdx: number) => {
    const key = `${prefix}_${metric}` as SortKey;
    const isFirst = metric === 'spend';
    return (
      <th key={key} className={`text-right ${TH_BASE} cursor-pointer hover:text-foreground transition-colors ${PERIOD_BG[periodIdx]} ${isFirst ? PERIOD_BORDER : ''}`} onClick={() => handleSort(key)}>
        <div className="flex items-center justify-end gap-1">{label}<SortIcon col={key} /></div>
      </th>
    );
  };

  const renderMetricCells = (m: PeriodMetrics, prefix: string, periodIdx: number) => (
    <Fragment key={prefix}>
      <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[periodIdx]} ${PERIOD_BORDER}`}><MetricCell value={m.spent} format="currency" /></td>
      <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[periodIdx]}`}><MetricCell value={m.cpl} format="currency" /></td>
      <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[periodIdx]}`}><MetricCell value={m.ctr} format="percent" /></td>
    </Fragment>
  );

  const COL_COUNT = 3 + PERIODS.length * 3 + 1; // name + status + #ads + periods*3 + trend

  return (
    <>
      <WidgetCard
        noPadding
        title="Campaign Performance"
        subtitle={`${sorted.length} campaign${sorted.length !== 1 ? 's' : ''} across four comparison periods`}
        toolbar={
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-[190px] pl-8 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="active-filter-camp" checked={activeOnly} onCheckedChange={setActiveOnly} />
              <Label htmlFor="active-filter-camp" className="text-xs cursor-pointer text-muted-foreground">Active ads only</Label>
            </div>
            {sorted.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setAiPanelOpen(true)} className="h-8 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </Button>
            )}
          </>
        }
      >
        <div className="flex items-center gap-3 px-5 pb-3 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span><span className="font-medium text-foreground">Trend logic</span> — compares 7d vs 30d: <span className="font-medium">CPL ↑</span> flagged if 7d CPL &gt;15% above 30d · <span className="font-medium">CTR ↓</span> flagged if 7d CTR &gt;15% below 30d. Expand a campaign row to see ad-level breakdowns.</span>
        </div>

        <div className="overflow-x-auto border-t border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-secondary/40">
                <th colSpan={3} />
                {PERIODS.map((p, i) => (
                  <th key={p.key} colSpan={3} className={`text-center ${TH_BASE} ${PERIOD_BG[i]} ${PERIOD_BORDER}`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-[3px]" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </div>
                  </th>
                ))}
                <th />
              </tr>
              <tr className="border-b border-border/60 bg-secondary/40">
                <th className={`text-left ${TH_BASE} min-w-[220px] cursor-pointer hover:text-foreground transition-colors`} onClick={() => handleSort('campaignName')}>
                  <div className="flex items-center gap-1">Campaign <SortIcon col="campaignName" /></div>
                </th>
                <th className={`text-center ${TH_BASE} w-[80px]`}>Status</th>
                <th className={`text-center ${TH_BASE} w-[50px]`}>#Ads</th>
                {PERIODS.map((p, i) => (
                  <Fragment key={p.key}>
                    {subHeader(p.key, 'Spend', 'spend', i)}
                    {subHeader(p.key, 'CPL', 'cpl', i)}
                    {subHeader(p.key, 'CTR', 'ctr', i)}
                  </Fragment>
                ))}
                <th className={`text-center ${TH_BASE} min-w-[120px]`}>Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.length === 0 ? (
                <tr><td colSpan={COL_COUNT} className="text-center py-12 text-muted-foreground">No campaign data available</td></tr>
              ) : (
                sorted.map(row => {
                  const isExpanded = expandedRows.has(row.campaignId);
                  const hasAds = row.ads.length > 0;
                  return (
                    <Fragment key={row.campaignId}>
                      <tr
                        className={`hover:bg-secondary/40 transition-colors ${hasAds ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-primary/[0.03]' : ''}`}
                        onClick={hasAds ? () => toggleExpand(row.campaignId) : undefined}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 group">
                            {hasAds && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <div>
                              <span className="font-medium text-xs break-words line-clamp-2">{row.campaignName}</span>
                              <div className="text-[10px] text-muted-foreground mt-0.5">{row.objectiveType.replace(/_/g, ' ')}</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(row.campaignName); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted ml-auto shrink-0"
                              title="Copy campaign name"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2 text-center"><RowStatusPill status={row.campaignStatus} /></td>
                        <td className="p-2 text-center text-xs text-muted-foreground tabular-nums">{row.adCount}</td>
                        {PERIODS.map((p, i) => renderMetricCells(row[p.field], p.key, i))}
                        <td className="p-2 text-center"><FatigueIndicator row={row} /></td>
                      </tr>
                      {isExpanded && row.ads.map(ad => (
                        <tr key={`${row.campaignId}-${ad.creativeId}`} className="bg-secondary/20">
                          <td className="p-2 pl-8">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">{ad.adName}</span>
                              <RowStatusPill status={ad.adStatus} />
                            </div>
                          </td>
                          <td className="p-2" />
                          <td className="p-2" />
                          {PERIODS.map((p, i) => renderMetricCells(ad[p.field], `${p.key}-${ad.creativeId}`, i))}
                          <td className="p-2 text-center"><FatigueIndicator row={ad} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })
              )}
              {sorted.length > 0 && (
                <tr className="bg-secondary/50 font-semibold border-t-2 border-border">
                  <td className="p-2 text-xs">Totals</td>
                  <td className="p-2" />
                  <td className="p-2" />
                  {PERIODS.map((p, i) => {
                    const t = totals[p.field];
                    return (
                      <Fragment key={`t-${p.key}`}>
                        <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[i]} ${PERIOD_BORDER}`}><MetricCell value={t.spend} format="currency" /></td>
                        <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[i]}`}><MetricCell value={t.cpl} format="currency" /></td>
                        <td className={`p-2 text-right text-xs tabular-nums ${PERIOD_BG[i]}`}><MetricCell value={t.ctr} format="percent" /></td>
                      </Fragment>
                    );
                  })}
                  <td className="p-2" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      <AIAnalysisPanel
        open={aiPanelOpen}
        onOpenChange={setAiPanelOpen}
        data={sorted}
        reportType="campaign_performance"
      />
    </>
  );
}
