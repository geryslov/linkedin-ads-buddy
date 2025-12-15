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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Search, X } from 'lucide-react';
import { CreativeNameData } from '@/hooks/useCreativeNamesReport';

interface CreativeNamesReportTableProps {
  data: CreativeNameData[];
  isLoading: boolean;
}

type SortKey = 'creativeName' | 'campaignName' | 'status' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
type SortOrder = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  PAUSED: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  ARCHIVED: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
  DRAFT: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PENDING_REVIEW: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
};

export function CreativeNamesReportTable({ data, isLoading }: CreativeNamesReportTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('impressions');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

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
        item.campaignName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    return result;
  }, [data, searchQuery, statusFilter]);

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

  const totals = useMemo(() => {
    return filteredData.reduce((acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }), { impressions: 0, clicks: 0, spent: 0, leads: 0 });
  }, [filteredData]);

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spent / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0;
  const totalCostPerLead = totals.leads > 0 ? totals.spent / totals.leads : 0;

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all';

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
      <div className="text-center py-12 text-muted-foreground">
        No creative data available. Try adjusting the time frame.
      </div>
    );
  }

  const SortableHeader = ({ 
    label, 
    sortKeyVal, 
    className = '' 
  }: { 
    label: string; 
    sortKeyVal: SortKey; 
    className?: string; 
  }) => (
    <TableHead
      className={`cursor-pointer hover:bg-muted/50 transition-colors whitespace-nowrap ${className}`}
      onClick={() => handleSort(sortKeyVal)}
    >
      <div className="flex items-center gap-1 font-semibold text-foreground">
        {label}
        {sortKey === sortKeyVal && (
          sortOrder === 'desc' ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUp className="h-3 w-3 text-primary" />
          )
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by creative or campaign name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3 w-3" />
            Clear filters
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
              <SortableHeader label="Creative Name" sortKeyVal="creativeName" className="min-w-[200px]" />
              <SortableHeader label="Campaign" sortKeyVal="campaignName" className="min-w-[150px]" />
              <SortableHeader label="Status" sortKeyVal="status" />
              <SortableHeader label="Impressions" sortKeyVal="impressions" />
              <SortableHeader label="Clicks" sortKeyVal="clicks" />
              <SortableHeader label="Spent" sortKeyVal="spent" />
              <SortableHeader label="Leads" sortKeyVal="leads" />
              <SortableHeader label="CTR" sortKeyVal="ctr" />
              <SortableHeader label="CPC" sortKeyVal="cpc" />
              <SortableHeader label="CPM" sortKeyVal="cpm" />
              <SortableHeader label="CPL" sortKeyVal="costPerLead" />
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
                    <TableCell className="max-w-[200px] truncate" title={row.campaignName}>
                      {row.campaignName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[row.status] || 'bg-muted'}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">${row.spent.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right tabular-nums">${row.cpc.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">${row.cpm.toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.costPerLead > 0 ? `$${row.costPerLead.toFixed(2)}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
                  <TableCell>Totals</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right tabular-nums">{totals.impressions.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.clicks.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">${totals.spent.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{totalCtr.toFixed(2)}%</TableCell>
                  <TableCell className="text-right tabular-nums">${totalCpc.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">${totalCpm.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totalCostPerLead > 0 ? `$${totalCostPerLead.toFixed(2)}` : '-'}
                  </TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
