import { useEffect, useState, useMemo } from 'react';
import { useCreativePerformanceReport, CreativePerformanceRow, PeriodMetrics } from '@/hooks/useCreativePerformanceReport';
import { CreativeThumbnail } from './CreativeThumbnail';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  accessToken: string | null;
  selectedAccount: string | null;
}

type SortKey = 'creativeName' | '7d_cpl' | '7d_ctr' | '7d_spend' | '14d_cpl' | '14d_ctr' | '14d_spend' | '30d_cpl' | '30d_ctr' | '30d_spend' | 'lm_cpl' | 'lm_ctr' | 'lm_spend';

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

function FatigueIndicator({ row }: { row: CreativePerformanceRow }) {
  const cpl7 = row.last7d.cpl;
  const cpl30 = row.last30d.cpl;
  const ctr7 = row.last7d.ctr;
  const ctr30 = row.last30d.ctr;

  // Only show if both periods have data
  const hasCplData = cpl7 > 0 && cpl30 > 0;
  const hasCtrData = ctr7 > 0 && ctr30 > 0;

  const cplRising = hasCplData && cpl7 > cpl30 * 1.15;
  const ctrDecline = hasCtrData && ctr7 < ctr30 * 0.85;

  if (!cplRising && !ctrDecline) return null;

  return (
    <div className="flex gap-1">
      {cplRising && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          <TrendingUp className="h-3 w-3 mr-0.5" />CPL↑
        </Badge>
      )}
      {ctrDecline && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          <TrendingDown className="h-3 w-3 mr-0.5" />CTR↓
        </Badge>
      )}
    </div>
  );
}

function MetricCell({ value, format }: { value: number; format: 'currency' | 'percent' }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  if (format === 'currency') return <span>${value.toFixed(2)}</span>;
  return <span>{value.toFixed(2)}%</span>;
}

function PeriodHeader({ label }: { label: string }) {
  return (
    <th colSpan={3} className="text-center p-2 font-semibold border-b border-border bg-muted/60 text-xs uppercase tracking-wider">
      {label}
    </th>
  );
}

export function CreativePerformanceReport({ accessToken, selectedAccount }: Props) {
  const { data, isLoading, error, fetchReport } = useCreativePerformanceReport(accessToken);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('7d_spend');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (selectedAccount) fetchReport(selectedAccount);
  }, [selectedAccount, fetchReport]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('desc'); }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(r => r.creativeName.toLowerCase().includes(q));
  }, [data, search]);

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
    return <div className="text-center py-12 text-destructive">{error}</div>;
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortOrder === 'desc'
      ? <ArrowDown className="h-3 w-3 text-primary shrink-0" />
      : <ArrowUp className="h-3 w-3 text-primary shrink-0" />;
  };

  const subHeader = (prefix: string, label: string, metric: 'cpl' | 'ctr' | 'spend') => {
    const key = `${prefix}_${metric}` as SortKey;
    return (
      <th
        className="text-right p-2 font-medium text-xs cursor-pointer hover:bg-muted/60 transition-colors whitespace-nowrap"
        onClick={() => handleSort(key)}
      >
        <div className="flex items-center justify-end gap-1">
          {label}
          <SortIcon col={key} />
        </div>
      </th>
    );
  };

  const periods = [
    { key: '7d', label: 'Last 7 Days', field: 'last7d' as const },
    { key: '14d', label: 'Last 14 Days', field: 'last14d' as const },
    { key: '30d', label: 'Last 30 Days', field: 'last30d' as const },
    { key: 'lm', label: 'Last Month', field: 'lastMonth' as const },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search creatives..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-sm text-muted-foreground">{sorted.length} creatives</span>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {/* Period group headers */}
              <tr className="border-b border-border">
                <th colSpan={3} className="bg-muted/30"></th>
                {periods.map(p => <PeriodHeader key={p.key} label={p.label} />)}
                <th className="bg-muted/30"></th>
              </tr>
              {/* Sub headers */}
              <tr className="border-b border-border bg-muted/40">
                <th className="text-center p-2 font-semibold w-[60px]">Preview</th>
                <th
                  className="text-left p-2 font-semibold min-w-[200px] cursor-pointer hover:bg-muted/60"
                  onClick={() => handleSort('creativeName')}
                >
                  <div className="flex items-center gap-1">Creative Name <SortIcon col="creativeName" /></div>
                </th>
                <th className="text-center p-2 font-semibold w-[50px] text-xs">#Camp</th>
                {periods.map(p => (
                  <>{subHeader(p.key, 'CPL', 'cpl')}{subHeader(p.key, 'CTR', 'ctr')}{subHeader(p.key, 'Spend', 'spend')}</>
                ))}
                <th className="text-center p-2 font-semibold w-[80px] text-xs">Fatigue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sorted.length === 0 ? (
                <tr><td colSpan={16} className="text-center py-12 text-muted-foreground">No creative data available</td></tr>
              ) : (
                sorted.map(row => (
                  <tr key={row.creativeName} className="hover:bg-muted/30 transition-colors">
                    <td className="p-2 text-center">
                      <CreativeThumbnail imageUrl={row.imageUrl} creativeName={row.creativeName} size={36} />
                    </td>
                    <td className="p-2">
                      <span className="font-medium text-xs break-words line-clamp-2">{row.creativeName}</span>
                    </td>
                    <td className="p-2 text-center text-xs text-muted-foreground">{row.campaignCount}</td>
                    {periods.map(p => {
                      const m = row[p.field];
                      return (
                        <>
                          <td key={`${p.key}-cpl`} className="p-2 text-right text-xs"><MetricCell value={m.cpl} format="currency" /></td>
                          <td key={`${p.key}-ctr`} className="p-2 text-right text-xs"><MetricCell value={m.ctr} format="percent" /></td>
                          <td key={`${p.key}-spend`} className="p-2 text-right text-xs"><MetricCell value={m.spent} format="currency" /></td>
                        </>
                      );
                    })}
                    <td className="p-2 text-center"><FatigueIndicator row={row} /></td>
                  </tr>
                ))
              )}
              {/* Totals row */}
              {sorted.length > 0 && (
                <tr className="bg-muted/50 font-semibold border-t-2 border-border">
                  <td className="p-2" />
                  <td className="p-2 text-xs">Totals</td>
                  <td className="p-2" />
                  {periods.map(p => {
                    const t = totals[p.field];
                    return (
                      <>
                        <td key={`t-${p.key}-cpl`} className="p-2 text-right text-xs"><MetricCell value={t.cpl} format="currency" /></td>
                        <td key={`t-${p.key}-ctr`} className="p-2 text-right text-xs"><MetricCell value={t.ctr} format="percent" /></td>
                        <td key={`t-${p.key}-spend`} className="p-2 text-right text-xs"><MetricCell value={t.spend} format="currency" /></td>
                      </>
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
