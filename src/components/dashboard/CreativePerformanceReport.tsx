import { useEffect, useState, useMemo, Fragment } from 'react';
import { useCreativePerformanceReport, CreativePerformanceRow, PeriodMetrics, CampaignBreakdown } from '@/hooks/useCreativePerformanceReport';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, ArrowUp, ArrowDown, TrendingUp, TrendingDown, ChevronRight, ChevronDown, Copy, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

type SortKey = 'creativeName' | '7d_spend' | '7d_cpl' | '7d_ctr' | '14d_spend' | '14d_cpl' | '14d_ctr' | '30d_spend' | '30d_cpl' | '30d_ctr' | 'lm_spend' | 'lm_cpl' | 'lm_ctr';

const PERIODS = [
  { key: '7d', label: 'Last 7 Days', field: 'last7d' as const, color: 'hsl(var(--primary))' },
  { key: '14d', label: 'Last 14 Days', field: 'last14d' as const, color: 'hsl(210 80% 55%)' },
  { key: '30d', label: 'Last 30 Days', field: 'last30d' as const, color: 'hsl(270 60% 55%)' },
  { key: 'lm', label: 'Last Month', field: 'lastMonth' as const, color: 'hsl(30 80% 55%)' },
];

const PERIOD_BG = [
  'bg-primary/5',
  'bg-blue-500/5',
  'bg-purple-500/5',
  'bg-orange-500/5',
];

const PERIOD_HEADER_BG = [
  'bg-primary/15',
  'bg-blue-500/15',
  'bg-purple-500/15',
  'bg-orange-500/15',
];

function getMetricValue(row: CreativePerformanceRow, key: SortKey): number | string {
  if (key === 'creativeName') return row.creativeName;
  const [period, metric] = key.split('_') as [string, string];
  const periodMap: Record<string, keyof CreativePerformanceRow> = { '7d': 'last7d', '14d': 'last14d', '30d': 'last30d', 'lm': 'lastMonth' };
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
  if (!cplRising && !ctrDecline) return <span className="text-xs text-green-600">✓ OK</span>;
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-0.5 items-center">
        {cplRising && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 cursor-help">
                <TrendingUp className="h-3 w-3 mr-0.5" />CPL +{cplChange}%
              </Badge>
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
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 cursor-help">
                <TrendingDown className="h-3 w-3 mr-0.5" />CTR {ctrChange}%
              </Badge>
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
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  if (format === 'currency') return <span>{formatCurrency(value)}</span>;
  return <span>{value.toFixed(2)}%</span>;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <Badge variant={isActive ? 'default' : 'secondary'} className="text-[9px] px-1 py-0">
      {isActive ? 'Active' : status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.success('Copied to clipboard');
  });
}

export function CreativePerformanceReport({ accessToken, selectedAccount }: Props) {
  const { data, isLoading, error, fetchReport } = useCreativePerformanceReport(accessToken);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('7d_spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeOnly, setActiveOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (selectedAccount) fetchReport(selectedAccount);
  }, [selectedAccount, fetchReport]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const toggleExpand = (name: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const adTypes = useMemo(() => {
    const types = new Set(data.map(r => r.type));
    return [...types].sort();
  }, [data]);

  const filtered = useMemo(() => {
    let result = data;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r => r.creativeName.toLowerCase().includes(q));
    }
    if (activeOnly) {
      result = result.filter(r => r.creativeStatus === 'ACTIVE');
    }
    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }
    return result;
  }, [data, search, activeOnly, typeFilter]);

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

  if (error) return <div className="text-center py-12 text-destructive">{error}</div>;

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortOrder === 'desc'
      ? <ArrowDown className="h-3 w-3 text-primary shrink-0" />
      : <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  };

  // Order: Spend, CPL, CTR
  const subHeader = (prefix: string, label: string, metric: 'spend' | 'cpl' | 'ctr', periodIdx: number) => {
    const key = `${prefix}_${metric}` as SortKey;
    return (
      <th key={key} className={`text-right p-2 font-medium text-xs cursor-pointer hover:bg-muted/60 transition-colors whitespace-nowrap ${PERIOD_BG[periodIdx]}`} onClick={() => handleSort(key)}>
        <div className="flex items-center justify-end gap-1">{label}<SortIcon col={key} /></div>
      </th>
    );
  };

  // Render in order: Spend, CPL, CTR
  const renderMetricCells = (m: PeriodMetrics, prefix: string, periodIdx: number) => (
    <Fragment key={prefix}>
      <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[periodIdx]}`}><MetricCell value={m.spent} format="currency" /></td>
      <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[periodIdx]}`}><MetricCell value={m.cpl} format="currency" /></td>
      <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[periodIdx]}`}><MetricCell value={m.ctr} format="percent" /></td>
    </Fragment>
  );

  const COL_COUNT = 2 + PERIODS.length * 3 + 1; // name + #camp + periods*3 + fatigue

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search creatives..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="active-filter" checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label htmlFor="active-filter" className="text-sm cursor-pointer">Active ads only</Label>
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="All ad types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ad types</SelectItem>
            {adTypes.map(t => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAd\b/i, 'Ad')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{sorted.length} creatives</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
                <Info className="h-3.5 w-3.5" />
                Trend Logic
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-semibold mb-1">Performance Trend Detection</p>
              <p>Compares 7-day vs 30-day metrics:</p>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li><span className="font-medium">CPL ↑</span>: 7d CPL is &gt;15% higher than 30d CPL</li>
                <li><span className="font-medium">CTR ↓</span>: 7d CTR is &gt;15% lower than 30d CTR</li>
              </ul>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th colSpan={2} className="bg-muted/30" />
                {PERIODS.map((p, i) => (
                  <th key={p.key} colSpan={3} className={`text-center p-2 font-semibold border-b border-border text-xs uppercase tracking-wider ${PERIOD_HEADER_BG[i]}`}>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </div>
                  </th>
                ))}
                <th className="bg-muted/30" />
              </tr>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left p-2 font-semibold min-w-[200px] cursor-pointer hover:bg-muted/60" onClick={() => handleSort('creativeName')}>
                  <div className="flex items-center gap-1">Creative Name <SortIcon col="creativeName" /></div>
                </th>
                <th className="text-center p-2 font-semibold w-[50px] text-xs">#Camp</th>
                {PERIODS.map((p, i) => (
                  <Fragment key={p.key}>
                    {subHeader(p.key, 'Spend', 'spend', i)}
                    {subHeader(p.key, 'CPL', 'cpl', i)}
                    {subHeader(p.key, 'CTR', 'ctr', i)}
                  </Fragment>
                ))}
                <th className="text-center p-2 font-semibold w-[80px] text-xs">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.length === 0 ? (
                <tr><td colSpan={COL_COUNT} className="text-center py-12 text-muted-foreground">No creative data available</td></tr>
              ) : (
                sorted.map(row => {
                  const isExpanded = expandedRows.has(row.creativeName);
                  const hasMultipleCampaigns = row.campaigns.length > 1;
                  return (
                    <Fragment key={row.creativeName}>
                      <tr
                        className={`hover:bg-muted/30 transition-colors ${hasMultipleCampaigns ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-muted/20' : ''}`}
                        onClick={hasMultipleCampaigns ? () => toggleExpand(row.creativeName) : undefined}
                      >
                        <td className="p-2">
                          <div className="flex items-center gap-1.5 group">
                            {hasMultipleCampaigns && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium text-xs break-words line-clamp-2">{row.creativeName}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(row.creativeName); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                              title="Copy creative name"
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2 text-center text-xs text-muted-foreground">{row.campaignCount}</td>
                        {PERIODS.map((p, i) => renderMetricCells(row[p.field], p.key, i))}
                        <td className="p-2 text-center"><FatigueIndicator row={row} /></td>
                      </tr>
                      {isExpanded && row.campaigns.map(camp => (
                        <tr key={`${row.creativeName}-${camp.campaignName}`} className="bg-muted/10 border-t border-border/30">
                          <td className="p-2 pl-8">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{camp.campaignName}</span>
                              <StatusBadge status={camp.campaignStatus} />
                            </div>
                          </td>
                          <td className="p-2" />
                          {PERIODS.map((p, i) => renderMetricCells(camp[p.field], `${p.key}-${camp.campaignName}`, i))}
                          <td className="p-2 text-center"><FatigueIndicator row={camp} /></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })
              )}
              {sorted.length > 0 && (
                <tr className="bg-muted/50 font-semibold border-t-2 border-border">
                  <td className="p-2 text-xs">Totals</td>
                  <td className="p-2" />
                  {PERIODS.map((p, i) => {
                    const t = totals[p.field];
                    return (
                      <Fragment key={`t-${p.key}`}>
                        <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[i]}`}><MetricCell value={t.spend} format="currency" /></td>
                        <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[i]}`}><MetricCell value={t.cpl} format="currency" /></td>
                        <td className={`p-2 text-right text-xs font-mono ${PERIOD_BG[i]}`}><MetricCell value={t.ctr} format="percent" /></td>
                      </Fragment>
                    );
                  })}
                  <td className="p-2" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
