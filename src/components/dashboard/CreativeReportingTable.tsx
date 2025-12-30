import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X, Layers } from 'lucide-react';
import { CreativeData } from '@/hooks/useCreativeReporting';
import { CreativeTypeBadge } from './CreativeTypeBadge';
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No creative data available for the selected time period
      </div>
    );
  }

  const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => {
    const isActive = sortKey === sortKeyName;
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap"
        onClick={() => handleSort(sortKeyName)}
      >
        <div className="flex items-center gap-1">
          {label}
          {isActive ? (
            sortOrder === 'desc' ? <ArrowDown className="h-3 w-3 text-primary" /> : <ArrowUp className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-50" />
          )}
        </div>
      </TableHead>
    );
  };

  return (
    <div className="space-y-4">
      {/* Performance Filters */}
      <PerformanceFilters
        campaignType={campaignTypeFilter}
        onCampaignTypeChange={setCampaignTypeFilter}
        metricFilters={metricFilters}
        onMetricFiltersChange={setMetricFilters}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by creative name, campaign, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={creativeTypeFilter} onValueChange={setCreativeTypeFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Layers className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Creative Type" />
          </SelectTrigger>
          <SelectContent>
            {CREATIVE_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Metrics</SelectItem>
            <SelectItem value="with_spend">With Spend</SelectItem>
            <SelectItem value="with_impressions">With Impressions</SelectItem>
            <SelectItem value="with_clicks">With Clicks</SelectItem>
            <SelectItem value="with_leads">With Leads</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} of {data.length} creatives
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortableHeader label="Creative Name" sortKeyName="creativeName" />
              <SortableHeader label="Campaign" sortKeyName="campaignName" />
              <SortableHeader label="Type" sortKeyName="type" />
              <SortableHeader label="Impressions" sortKeyName="impressions" />
              <SortableHeader label="Clicks" sortKeyName="clicks" />
              <SortableHeader label="Spent" sortKeyName="spent" />
              <SortableHeader label="Leads" sortKeyName="leads" />
              <SortableHeader label="LGF Rate" sortKeyName="lgfCompletionRate" />
              <SortableHeader label="CTR" sortKeyName="ctr" />
              <SortableHeader label="CPC" sortKeyName="cpc" />
              <SortableHeader label="CPM" sortKeyName="cpm" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No creatives match your filters
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortedData.map((row, index) => (
                  <TableRow key={`${row.creativeId}-${index}`} className="hover:bg-muted/20">
                    <TableCell className="font-medium max-w-[300px] truncate" title={row.creativeName}>
                      {row.creativeName}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={row.campaignName}>
                      {row.campaignName || '-'}
                    </TableCell>
                    <TableCell>
                      <CreativeTypeBadge type={row.type} />
                    </TableCell>
                    <TableCell>{row.impressions.toLocaleString()}</TableCell>
                    <TableCell>{row.clicks.toLocaleString()}</TableCell>
                    <TableCell>${row.spent.toFixed(2)}</TableCell>
                    <TableCell>{row.leads.toLocaleString()}</TableCell>
                    <TableCell>{row.lgfCompletionRate > 0 ? `${row.lgfCompletionRate.toFixed(1)}%` : '-'}</TableCell>
                    <TableCell>{row.ctr.toFixed(2)}%</TableCell>
                    <TableCell>${row.cpc.toFixed(2)}</TableCell>
                    <TableCell>${row.cpm.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell>Total ({filteredData.length} creatives)</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell>{totals.impressions.toLocaleString()}</TableCell>
                  <TableCell>{totals.clicks.toLocaleString()}</TableCell>
                  <TableCell>${totals.spent.toFixed(2)}</TableCell>
                  <TableCell>{totals.leads.toLocaleString()}</TableCell>
                  <TableCell>{totalLgfRate === '-' ? '-' : `${totalLgfRate}%`}</TableCell>
                  <TableCell>{totalCtr}%</TableCell>
                  <TableCell>${totalCpc}</TableCell>
                  <TableCell>${totalCpm}</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
