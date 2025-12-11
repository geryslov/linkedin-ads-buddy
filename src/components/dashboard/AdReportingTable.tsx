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
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { AggregatedAdData } from '@/hooks/useAdReporting';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AdReportingTableProps {
  data: AggregatedAdData[];
  isLoading: boolean;
}

type SortKey = 'name' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr';
type SortOrder = 'asc' | 'desc';

type FilterType = 'all' | 'with_spend' | 'with_impressions' | 'with_clicks' | 'with_leads';

export function AdReportingTable({ data, isLoading }: AdReportingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('spent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');

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
        item.name.toLowerCase().includes(query)
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

    return result;
  }, [data, searchQuery, filterType]);

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
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    ),
    [filteredData]
  );

  const totalCtr = totals.impressions > 0 
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2) 
    : '0.00';

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || filterType !== 'all';

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
        No ad data available for the selected time period
      </div>
    );
  }

  const SortableHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => {
    const isActive = sortKey === sortKeyName;
    return (
      <TableHead 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
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
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by ad name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ads</SelectItem>
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
        Showing {filteredData.length} of {data.length} ads
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <SortableHeader label="Ad Name" sortKeyName="name" />
              <SortableHeader label="Impressions" sortKeyName="impressions" />
              <SortableHeader label="Clicks" sortKeyName="clicks" />
              <SortableHeader label="Spent" sortKeyName="spent" />
              <SortableHeader label="Leads" sortKeyName="leads" />
              <SortableHeader label="CTR" sortKeyName="ctr" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No ads match your filters
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortedData.map((row, index) => (
                  <TableRow key={index} className="hover:bg-muted/20">
                    <TableCell className="font-medium max-w-[300px] truncate" title={row.name}>
                      {row.name}
                    </TableCell>
                    <TableCell>{row.impressions.toLocaleString()}</TableCell>
                    <TableCell>{row.clicks.toLocaleString()}</TableCell>
                    <TableCell>${row.spent.toFixed(2)}</TableCell>
                    <TableCell>{row.leads.toLocaleString()}</TableCell>
                    <TableCell>{row.ctr.toFixed(2)}%</TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell>Total ({filteredData.length} ads)</TableCell>
                  <TableCell>{totals.impressions.toLocaleString()}</TableCell>
                  <TableCell>{totals.clicks.toLocaleString()}</TableCell>
                  <TableCell>${totals.spent.toFixed(2)}</TableCell>
                  <TableCell>{totals.leads.toLocaleString()}</TableCell>
                  <TableCell>{totalCtr}%</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
