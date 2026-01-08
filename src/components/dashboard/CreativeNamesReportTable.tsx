import { useState, useMemo, Fragment } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, Search, X, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { CreativeNameData } from '@/hooks/useCreativeNamesReport';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import {
  PerformanceFilters,
  MetricFilter,
  applyMetricFilters,
  applyCampaignTypeFilter,
} from './PerformanceFilters';

interface CreativeNamesReportTableProps {
  data: CreativeNameData[];
  isLoading: boolean;
}

interface GroupedCreative {
  creativeName: string;
  campaigns: CreativeNameData[];
  campaignType: string;
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
  const [campaignTypeFilter, setCampaignTypeFilter] = useState<string>('all');
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([]);
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.creativeName.toLowerCase().includes(query) ||
        item.campaignName.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (creativeTypeFilter !== 'all') {
      result = result.filter(item => item.type === creativeTypeFilter);
    }

    result = applyCampaignTypeFilter(result, campaignTypeFilter);

    return result;
  }, [data, searchQuery, statusFilter, creativeTypeFilter, campaignTypeFilter]);

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
        campaignType: campaigns[0]?.campaignType || 'UNKNOWN',
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

  const filteredGroupedData = useMemo(() => {
    return applyMetricFilters(groupedData, metricFilters);
  }, [groupedData, metricFilters]);

  const sortedData = useMemo(() => {
    return [...filteredGroupedData].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });
  }, [filteredGroupedData, sortKey, sortOrder]);

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
    setCampaignTypeFilter('all');
    setMetricFilters([]);
  };

  const hasActiveFilters = searchQuery.trim() || statusFilter !== 'all' || creativeTypeFilter !== 'all' || campaignTypeFilter !== 'all' || metricFilters.length > 0;

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

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortOrder === 'desc' ? (
      <ArrowDown className="h-3 w-3 text-primary shrink-0" />
    ) : (
      <ArrowUp className="h-3 w-3 text-primary shrink-0" />
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
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search creative or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={creativeTypeFilter} onValueChange={setCreativeTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <Layers className="h-4 w-4 mr-2 shrink-0" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {CREATIVE_TYPE_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
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
            Clear
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {sortedData.length} creatives • {filteredData.length} campaign entries
      </div>

      {/* Table Container */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            {/* Header */}
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="w-10 p-3"></th>
                <th 
                  className="text-left p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[250px]"
                  onClick={() => handleSort('creativeName')}
                >
                  <div className="flex items-center gap-1">
                    Creative Name
                    <SortIcon columnKey="creativeName" />
                  </div>
                </th>
                <th className="text-left p-3 font-semibold min-w-[100px]">Type</th>
                <th className="text-left p-3 font-semibold min-w-[140px]">Campaign</th>
                <th className="text-left p-3 font-semibold min-w-[90px]">Status</th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[100px]"
                  onClick={() => handleSort('impressions')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Impr.
                    <SortIcon columnKey="impressions" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[80px]"
                  onClick={() => handleSort('clicks')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Clicks
                    <SortIcon columnKey="clicks" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[90px]"
                  onClick={() => handleSort('spent')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Spent
                    <SortIcon columnKey="spent" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[70px]"
                  onClick={() => handleSort('leads')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Leads
                    <SortIcon columnKey="leads" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[70px]"
                  onClick={() => handleSort('ctr')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CTR
                    <SortIcon columnKey="ctr" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[70px]"
                  onClick={() => handleSort('cpc')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPC
                    <SortIcon columnKey="cpc" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[70px]"
                  onClick={() => handleSort('cpm')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPM
                    <SortIcon columnKey="cpm" />
                  </div>
                </th>
                <th 
                  className="text-right p-3 font-semibold cursor-pointer hover:bg-muted/60 transition-colors min-w-[70px]"
                  onClick={() => handleSort('costPerLead')}
                >
                  <div className="flex items-center justify-end gap-1">
                    CPL
                    <SortIcon columnKey="costPerLead" />
                  </div>
                </th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-border/50">
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-muted-foreground">
                    No creatives match your filters
                  </td>
                </tr>
              ) : (
                sortedData.map((group) => {
                  const isExpanded = expandedCreatives.has(group.creativeName);
                  const hasMultipleCampaigns = group.campaigns.length > 1;
                  
                  return (
                    <Fragment key={group.creativeName}>
                      {/* Parent Row */}
                      <tr 
                        className={`hover:bg-muted/30 transition-colors ${hasMultipleCampaigns ? 'cursor-pointer' : ''}`}
                        onClick={() => hasMultipleCampaigns && toggleExpanded(group.creativeName)}
                      >
                        <td className="p-3 text-center">
                          {hasMultipleCampaigns && (
                            isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground mx-auto" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
                            )
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium truncate max-w-[300px]" title={group.creativeName}>
                              {group.creativeName}
                            </span>
                            {hasMultipleCampaigns && (
                              <span className="text-xs text-muted-foreground">
                                {group.campaigns.length} campaigns
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <CreativeTypeBadge type={group.type} />
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {hasMultipleCampaigns ? (
                            <span className="text-xs italic">Multiple</span>
                          ) : (
                            <span className="truncate block max-w-[180px]" title={group.campaigns[0]?.campaignName}>
                              {group.campaigns[0]?.campaignName}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {!hasMultipleCampaigns && group.campaigns[0] && (
                            <Badge variant="outline" className={`text-xs ${STATUS_COLORS[group.campaigns[0].status] || 'bg-muted'}`}>
                              {group.campaigns[0].status}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums font-medium">{group.impressions.toLocaleString()}</td>
                        <td className="p-3 text-right tabular-nums font-medium">{group.clicks.toLocaleString()}</td>
                        <td className="p-3 text-right tabular-nums font-medium">${group.spent.toFixed(2)}</td>
                        <td className="p-3 text-right tabular-nums font-medium">{group.leads}</td>
                        <td className="p-3 text-right tabular-nums font-medium">{group.ctr.toFixed(2)}%</td>
                        <td className="p-3 text-right tabular-nums font-medium">${group.cpc.toFixed(2)}</td>
                        <td className="p-3 text-right tabular-nums font-medium">${group.cpm.toFixed(2)}</td>
                        <td className="p-3 text-right tabular-nums font-medium">
                          {group.costPerLead > 0 ? `$${group.costPerLead.toFixed(2)}` : '-'}
                        </td>
                      </tr>

                      {/* Expanded Campaign Rows */}
                      {isExpanded && group.campaigns.map((campaign, idx) => (
                        <tr 
                          key={`${group.creativeName}-campaign-${idx}`}
                          className="bg-primary/[0.02] border-l-2 border-l-primary/40"
                        >
                          <td className="p-3"></td>
                          <td className="p-3 pl-8" colSpan={3}>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">↳</span>
                              <span className="truncate max-w-[350px]" title={campaign.campaignName}>
                                {campaign.campaignName}
                              </span>
                              <Badge variant="outline" className={`text-xs shrink-0 ${STATUS_COLORS[campaign.status] || 'bg-muted'}`}>
                                {campaign.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{campaign.impressions.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{campaign.clicks.toLocaleString()}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">${campaign.spent.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{campaign.leads}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">{campaign.ctr.toFixed(2)}%</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">${campaign.cpc.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">${campaign.cpm.toFixed(2)}</td>
                          <td className="p-3 text-right tabular-nums text-muted-foreground">
                            {campaign.costPerLead > 0 ? `$${campaign.costPerLead.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {/* Footer Totals */}
            <tfoot className="bg-muted/50 border-t-2 border-border font-semibold">
              <tr>
                <td className="p-3"></td>
                <td className="p-3">Totals</td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3"></td>
                <td className="p-3 text-right tabular-nums">{totals.impressions.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums">{totals.clicks.toLocaleString()}</td>
                <td className="p-3 text-right tabular-nums">${totals.spent.toFixed(2)}</td>
                <td className="p-3 text-right tabular-nums">{totals.leads}</td>
                <td className="p-3 text-right tabular-nums">{totalCtr.toFixed(2)}%</td>
                <td className="p-3 text-right tabular-nums">${totalCpc.toFixed(2)}</td>
                <td className="p-3 text-right tabular-nums">${totalCpm.toFixed(2)}</td>
                <td className="p-3 text-right tabular-nums">
                  {totalCostPerLead > 0 ? `$${totalCostPerLead.toFixed(2)}` : '-'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
