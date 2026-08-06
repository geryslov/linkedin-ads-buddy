import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X, Layers, Images } from 'lucide-react';
import { CreativeData } from '@/hooks/useCreativeReporting';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { CreativeThumbnail } from './CreativeThumbnail';
import { WidgetCard, EmptyState } from './widgets';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PerformanceFilters,
  MetricFilter,
  applyMetricFilters,
  applyCampaignTypeFilter,
} from './PerformanceFilters';

interface CreativeReportingTableProps {
  data: CreativeData[];
  isLoading: boolean;
}

type SortKey = 'creativeName' | 'campaignName' | 'type' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'lgfCompletionRate' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
type SortOrder = 'asc' | 'desc';
type FilterType = 'all' | 'with_spend' | 'with_impressions' | 'with_clicks' | 'with_leads';

const CREATIVE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'SPONSORED_CONTENT', label: 'Sponsored Content' },
  { value: 'SPONSORED_UPDATE', label: 'Sponsored Update' },
  { value: 'TEXT_AD', label: 'Text Ad' },
  { value: 'VIDEO_AD', label: 'Video Ad' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'CAROUSEL_AD', label: 'Carousel Ad' },
  { value: 'CAROUSEL', label: 'Carousel' },
  { value: 'SPOTLIGHT_AD', label: 'Spotlight Ad' },
  { value: 'FOLLOWER_AD', label: 'Follower Ad' },
  { value: 'JOBS_AD', label: 'Jobs Ad' },
];

export function CreativeReportingTable({ data, isLoading }: CreativeReportingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [creativeTypeFilter, setCreativeTypeFilter] = useState<string>('all');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>('all');
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.creativeName.toLowerCase().includes(query) ||
        item.campaignName.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      );
    }

    // Apply metric filter
    switch (filterType) {
      case 'with_spend':
        result = result.filter(item => item.spent > 0);
        break;
      case 'with_impressions':
        result = result.filter(item => item.impressions > 0);
        break;
      case 'with_clicks':
        result = result.filter(item => item.clicks > 0);
        break;
      case 'with_leads':
        result = result.filter(item => item.leads > 0);
        break;
    }

    // Apply creative type filter
    if (creativeTypeFilter !== 'all') {
      result = result.filter(item => item.type === creativeTypeFilter);
    }

    // Apply campaign type filter
    result = applyCampaignTypeFilter(result, campaignTypeFilter);

    // Apply performance metric filters
    result = applyMetricFilters(result, metricFilters);

    return result;
  }, [data, searchQuery, filterType, creativeTypeFilter, campaignTypeFilter, metricFilters]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const modifier = sortOrder === 'asc' ? 1 : -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });
  }, [filteredData, sortKey, sortOrder]);

  const totals = useMemo(() =>
    filteredData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
        lgfFormOpens: acc.lgfFormOpens + item.lgfFormOpens,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0, lgfFormOpens: 0 }
    ),
    [filteredData]
  );

  const totalCtr = totals.impressions > 0
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2)
    : '0.00';

  const totalCpc = totals.clicks > 0
    ? (totals.spent / totals.clicks).toFixed(2)
    : '0.00';

  const totalCpm = totals.impressions > 0
    ? ((totals.spent / totals.impressions) * 1000).toFixed(2)
    : '0.00';

  const totalLgfRate = totals.lgfFormOpens > 0
    ? ((totals.leads / totals.lgfFormOpens) * 100).toFixed(1)
    : '-';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setCreativeTypeFilter('all');
    setCampaignTypeFilter('all');
    setMetricFilters([]);
  };

  const hasActiveFilters = searchQuery.trim() !== '' || filterType !== 'all' || creativeTypeFilter !== 'all' || campaignTypeFilter !== 'all' || metricFilters.length > 0;

  const SortHeader = ({ label, sortKeyName, align }: { label: string; sortKeyName: SortKey; align?: 'right' }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {label}
      {sortKey === sortKeyName ? (
        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <WidgetCard title="Creative performance">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </WidgetCard>
    );
  }

  if (data.length === 0) {
    return (
      <WidgetCard noPadding title="Creative performance">
        <EmptyState
          icon={Images}
          title="No creative data"
          description="No creative data available for the selected time period."
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      noPadding
      title="Creative performance"
      subtitle={`${filteredData.length} of ${data.length} creatives`}
      toolbar={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search creatives…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[220px] pl-8 text-sm"
            />
          </div>
          <Select value={creativeTypeFilter} onValueChange={setCreativeTypeFilter}>
            <SelectTrigger className="h-8 w-[170px] text-sm bg-card border-border">
              <Layers className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Creative Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CREATIVE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
            <SelectTrigger className="h-8 w-[160px] text-sm bg-card border-border">
              <Filter className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Filter by" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">All Metrics</SelectItem>
              <SelectItem value="with_spend">With Spend</SelectItem>
              <SelectItem value="with_impressions">With Impressions</SelectItem>
              <SelectItem value="with_clicks">With Clicks</SelectItem>
              <SelectItem value="with_leads">With Leads</SelectItem>
            </SelectContent>
          </Select>
        </>
      }
    >
      {/* Secondary filter row */}
      <div className="px-5 pb-3 flex flex-wrap items-center gap-2">
        <PerformanceFilters
          campaignType={campaignTypeFilter}
          onCampaignTypeChange={setCampaignTypeFilter}
          metricFilters={metricFilters}
          onMetricFiltersChange={setMetricFilters}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1 text-xs">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      <Table className="min-w-[1000px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead className="w-[50px]"></TableHead>
            <TableHead><SortHeader label="Creative Name" sortKeyName="creativeName" /></TableHead>
            <TableHead><SortHeader label="Campaign" sortKeyName="campaignName" /></TableHead>
            <TableHead><SortHeader label="Type" sortKeyName="type" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Impressions" sortKeyName="impressions" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Clicks" sortKeyName="clicks" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Spent" sortKeyName="spent" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Leads" sortKeyName="leads" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="LGF Rate" sortKeyName="lgfCompletionRate" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CTR" sortKeyName="ctr" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPC" sortKeyName="cpc" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPM" sortKeyName="cpm" align="right" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                No creatives match your filters
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row, index) => (
              <TableRow key={`${row.creativeId}-${index}`} className="border-border hover:bg-secondary/30 [&>td]:py-2.5">
                <TableCell>
                  <CreativeThumbnail imageUrl={row.imageUrl} creativeName={row.creativeName} />
                </TableCell>
                <TableCell className="font-medium min-w-[150px]">
                  <span className="break-words">{row.creativeName}</span>
                </TableCell>
                <TableCell className="min-w-[120px] text-muted-foreground">
                  <span className="break-words">{row.campaignName || <span className="text-muted-foreground/50">—</span>}</span>
                </TableCell>
                <TableCell>
                  <CreativeTypeBadge type={row.type} />
                </TableCell>
                <TableCell className="tabular-nums text-right">{row.impressions.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums text-right">{row.clicks.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums text-right">${row.spent.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums text-right">{row.leads.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums text-right">
                  {row.lgfCompletionRate > 0 ? `${row.lgfCompletionRate.toFixed(1)}%` : <span className="text-muted-foreground/50">—</span>}
                </TableCell>
                <TableCell className="tabular-nums text-right">{row.ctr.toFixed(2)}%</TableCell>
                <TableCell className="tabular-nums text-right">${row.cpc.toFixed(2)}</TableCell>
                <TableCell className="tabular-nums text-right">${row.cpm.toFixed(2)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {sortedData.length > 0 && (
          <TableFooter>
            <TableRow className="hover:bg-transparent font-semibold [&>td]:py-2.5">
              <TableCell></TableCell>
              <TableCell>Total ({filteredData.length} creatives)</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
              <TableCell className="tabular-nums text-right">{totals.impressions.toLocaleString()}</TableCell>
              <TableCell className="tabular-nums text-right">{totals.clicks.toLocaleString()}</TableCell>
              <TableCell className="tabular-nums text-right">${totals.spent.toFixed(2)}</TableCell>
              <TableCell className="tabular-nums text-right">{totals.leads.toLocaleString()}</TableCell>
              <TableCell className="tabular-nums text-right">{totalLgfRate === '-' ? '—' : `${totalLgfRate}%`}</TableCell>
              <TableCell className="tabular-nums text-right">{totalCtr}%</TableCell>
              <TableCell className="tabular-nums text-right">${totalCpc}</TableCell>
              <TableCell className="tabular-nums text-right">${totalCpm}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </WidgetCard>
  );
}
