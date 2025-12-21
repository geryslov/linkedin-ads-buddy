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
import { ArrowUp, ArrowDown, Search, X, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { CreativeNameData } from '@/hooks/useCreativeNamesReport';
import { CreativeTypeBadge } from './CreativeTypeBadge';

interface CreativeNamesReportTableProps {
  data: CreativeNameData[];
  isLoading: boolean;
}

interface GroupedCreative {
  creativeName: string;
  campaigns: CreativeNameData[];
  type: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerLead: number;
}

type SortKey = 'creativeName' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
type SortOrder = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
];

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
  const [creativeTypeFilter, setCreativeTypeFilter] = useState<string>('all');
  const [expandedCreatives, setExpandedCreatives] = useState<Set<string>>(new Set());

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const toggleExpanded = (creativeName: string) => {
    setExpandedCreatives(prev => {
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
        item.campaignName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Apply creative type filter
    if (creativeTypeFilter !== 'all') {
      result = result.filter(item => item.type === creativeTypeFilter);
    }

    return result;
  }, [data, searchQuery, statusFilter, creativeTypeFilter]);

  // Group by creative name and aggregate metrics
  const groupedData = useMemo(() => {
    const groups = new Map<string, CreativeNameData[]>();
    
    filteredData.forEach(item => {
      const existing = groups.get(item.creativeName) || [];
      existing.push(item);
      groups.set(item.creativeName, existing);
    });

    const aggregated: GroupedCreative[] = [];
    groups.forEach((campaigns, creativeName) => {
      const impressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
      const clicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
      const spent = campaigns.reduce((sum, c) => sum + c.spent, 0);
      const leads = campaigns.reduce((sum, c) => sum + c.leads, 0);
      
      aggregated.push({
        creativeName,
        campaigns,
        type: campaigns[0]?.type || 'UNKNOWN',
        impressions,
        clicks,
        spent,
        leads,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spent / clicks : 0,
        cpm: impressions > 0 ? (spent / impressions) * 1000 : 0,
        costPerLead: leads > 0 ? spent / leads : 0,
      });
    });

    return aggregated;
  }, [filteredData]);

  const sortedData = useMemo(() => {
    return [...groupedData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });
  }, [groupedData, sortKey, sortOrder]);

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
    setCreativeTypeFilter('all');
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || creativeTypeFilter !== 'all';

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
        
        <Select value={creativeTypeFilter} onValueChange={setCreativeTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <Layers className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CREATIVE_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
        Showing {sortedData.length} creatives across {filteredData.length} campaign entries
      </div>

      {/* Table */}
      <div className="rounded-md border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-8"></TableHead>
              <SortableHeader label="Creative Name" sortKeyVal="creativeName" className="min-w-[200px]" />
              <TableHead className="font-semibold text-foreground">Type</TableHead>
              <TableHead className="min-w-[150px] font-semibold text-foreground">Campaign</TableHead>
              <TableHead className="font-semibold text-foreground">Status</TableHead>
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
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  No creatives match your filters
                </TableCell>
              </TableRow>
            ) : (
              <>
                {sortedData.map((group) => {
                  const isExpanded = expandedCreatives.has(group.creativeName);
                  const hasMultipleCampaigns = group.campaigns.length > 1;
                  
                  return (
                    <>
                      {/* Parent Row - Creative Name with Aggregated Metrics */}
                      <TableRow 
                        key={group.creativeName} 
                        className={`hover:bg-muted/20 ${hasMultipleCampaigns ? 'cursor-pointer' : ''}`}
                        onClick={() => hasMultipleCampaigns && toggleExpanded(group.creativeName)}
                      >
                        <TableCell className="w-8 px-2">
                          {hasMultipleCampaigns && (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[300px] truncate" title={group.creativeName}>
                          {group.creativeName}
                          {hasMultipleCampaigns && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({group.campaigns.length} campaigns)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CreativeTypeBadge type={group.type} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {hasMultipleCampaigns ? (
                            <span className="text-xs">Multiple</span>
                          ) : (
                            <span className="max-w-[200px] truncate block" title={group.campaigns[0]?.campaignName}>
                              {group.campaigns[0]?.campaignName}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!hasMultipleCampaigns && group.campaigns[0] && (
                            <Badge variant="outline" className={STATUS_COLORS[group.campaigns[0].status] || 'bg-muted'}>
                              {group.campaigns[0].status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{group.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{group.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">${group.spent.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{group.leads}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{group.ctr.toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">${group.cpc.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">${group.cpm.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {group.costPerLead > 0 ? `$${group.costPerLead.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>

                      {/* Child Rows - Individual Campaign Metrics */}
                      {isExpanded && group.campaigns.map((campaign, idx) => (
                        <TableRow 
                          key={`${group.creativeName}-${campaign.campaignName}-${idx}`}
                          className="bg-muted/10 hover:bg-muted/20"
                        >
                          <TableCell className="w-8"></TableCell>
                          <TableCell className="pl-8 text-muted-foreground text-sm">
                            └
                          </TableCell>
                          <TableCell></TableCell>
                          <TableCell className="max-w-[200px] truncate" title={campaign.campaignName}>
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
                <TableRow className="bg-muted/50 font-semibold border-t-2 border-border">
                  <TableCell></TableCell>
                  <TableCell>Totals</TableCell>
                  <TableCell></TableCell>
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
