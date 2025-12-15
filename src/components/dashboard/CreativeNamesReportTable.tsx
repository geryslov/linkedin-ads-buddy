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
import { ArrowUp, ArrowDown, Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import { GroupedCreativeData, CampaignCreativeData } from '@/hooks/useCreativeNamesReport';

interface CreativeNamesReportTableProps {
  data: GroupedCreativeData[];
  isLoading: boolean;
}

type SortKey = 'creativeName' | 'totalImpressions' | 'totalClicks' | 'totalSpent' | 'totalLeads' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
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
  const [sortKey, setSortKey] = useState<SortKey>('totalImpressions');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const toggleRow = (creativeName: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(creativeName)) {
        next.delete(creativeName);
      } else {
        next.add(creativeName);
      }
      return next;
    });
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.creativeName.toLowerCase().includes(query) ||
        item.campaigns.some(c => c.campaignName.toLowerCase().includes(query))
      );
    }

    // Apply status filter at campaign level
    if (statusFilter !== 'all') {
      result = result
        .map(group => ({
          ...group,
          campaigns: group.campaigns.filter(c => c.status === statusFilter)
        }))
        .filter(group => group.campaigns.length > 0);
    }

    return result;
  }, [data, searchQuery, statusFilter]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      
      if (sortKey === 'creativeName') {
        aVal = a.creativeName;
        bVal = b.creativeName;
      } else if (sortKey === 'totalImpressions') {
        aVal = a.totalImpressions;
        bVal = b.totalImpressions;
      } else if (sortKey === 'totalClicks') {
        aVal = a.totalClicks;
        bVal = b.totalClicks;
      } else if (sortKey === 'totalSpent') {
        aVal = a.totalSpent;
        bVal = b.totalSpent;
      } else if (sortKey === 'totalLeads') {
        aVal = a.totalLeads;
        bVal = b.totalLeads;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }
      
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });
  }, [filteredData, sortKey, sortOrder]);

  // Recalculate totals based on filtered data
  const totals = useMemo(() => {
    return filteredData.reduce((acc, group) => ({
      impressions: acc.impressions + group.totalImpressions,
      clicks: acc.clicks + group.totalClicks,
      spent: acc.spent + group.totalSpent,
      leads: acc.leads + group.totalLeads,
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

  const expandAll = () => {
    setExpandedRows(new Set(sortedData.map(g => g.creativeName)));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all';
  const totalCreatives = data.reduce((sum, g) => sum + g.campaigns.length, 0);
  const filteredCreatives = filteredData.reduce((sum, g) => sum + g.campaigns.length, 0);

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

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredData.length} creative groups ({filteredCreatives} of {totalCreatives} creatives)
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[40px]"></TableHead>
              <SortableHeader label="Creative Name" sortKeyVal="creativeName" className="min-w-[200px]" />
              <TableHead className="whitespace-nowrap">Campaigns</TableHead>
              <SortableHeader label="Impressions" sortKeyVal="totalImpressions" />
              <SortableHeader label="Clicks" sortKeyVal="totalClicks" />
              <SortableHeader label="Spent" sortKeyVal="totalSpent" />
              <SortableHeader label="Leads" sortKeyVal="totalLeads" />
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
                {sortedData.map((group) => {
                  const isExpanded = expandedRows.has(group.creativeName);
                  return (
                    <>
                      {/* Parent Row - Creative Name with Aggregated Metrics */}
                      <TableRow 
                        key={group.creativeName} 
                        className="hover:bg-muted/20 cursor-pointer font-medium"
                        onClick={() => toggleRow(group.creativeName)}
                      >
                        <TableCell className="w-[40px] px-2">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-semibold max-w-[300px] truncate" title={group.creativeName}>
                          {group.creativeName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {group.campaigns.length} campaign{group.campaigns.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{group.totalImpressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.totalClicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">${group.totalSpent.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.totalLeads}</TableCell>
                        <TableCell className="text-right tabular-nums">{group.ctr.toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums">${group.cpc.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">${group.cpm.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {group.costPerLead > 0 ? `$${group.costPerLead.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                      
                      {/* Child Rows - Individual Campaign Metrics */}
                      {isExpanded && group.campaigns.map((campaign, idx) => (
                        <TableRow 
                          key={`${group.creativeName}-${campaign.creativeId}-${idx}`} 
                          className="bg-muted/10 hover:bg-muted/20"
                        >
                          <TableCell className="w-[40px]"></TableCell>
                          <TableCell className="pl-8 text-muted-foreground">
                            <span className="text-muted-foreground/60 mr-2">↳</span>
                            {campaign.campaignName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_COLORS[campaign.status] || 'bg-muted'}>
                              {campaign.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">${campaign.spent.toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.leads}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{campaign.ctr.toFixed(2)}%</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">${campaign.cpc.toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">${campaign.cpm.toFixed(2)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {campaign.costPerLead > 0 ? `$${campaign.costPerLead.toFixed(2)}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
                  <TableCell></TableCell>
                  <TableCell>Totals</TableCell>
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
