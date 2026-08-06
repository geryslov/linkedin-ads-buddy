import { useState, useMemo, Fragment } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X, ChevronRight, ChevronDown, Layers, List } from 'lucide-react';
import { CreativeNameData } from '@/hooks/useCreativeNamesReport';
import { CreativeTypeBadge } from './CreativeTypeBadge';
import { CreativeThumbnail } from './CreativeThumbnail';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import { cn } from '@/lib/utils';
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
  imageUrl?: string;
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

const STATUS_TONE: Record<string, { tone: 'success' | 'warning' | 'info' | 'neutral'; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  PAUSED: { tone: 'warning', label: 'Paused' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
  DRAFT: { tone: 'info', label: 'Draft' },
  PENDING_REVIEW: { tone: 'info', label: 'Pending Review' },
};

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_TONE[status];
  return s
    ? <StatusPill tone={s.tone} label={s.label} />
    : <StatusPill tone="neutral" label={status} />;
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
        imageUrl: campaigns[0]?.imageUrl,
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

  const SortHeader = ({ label, columnKey, align }: { label: string; columnKey: SortKey; align?: 'right' }) => (
    <button
      onClick={() => handleSort(columnKey)}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {label}
      {sortKey === columnKey ? (
        sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <WidgetCard title="Creative names report">
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
      <WidgetCard noPadding title="Creative names report">
        <EmptyState
          icon={List}
          title="No creative data"
          description="No creative data available. Try adjusting the time frame."
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      noPadding
      title="Creative names report"
      subtitle={`${sortedData.length} creatives · ${filteredData.length} campaign entries`}
      toolbar={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search creative or campaign…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[220px] pl-8 text-sm"
            />
          </div>

          <Select value={creativeTypeFilter} onValueChange={setCreativeTypeFilter}>
            <SelectTrigger className="h-8 w-[150px] text-sm bg-card border-border">
              <Layers className="h-3.5 w-3.5 mr-2 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CREATIVE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-sm bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
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

      <Table className="min-w-[1200px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead className="w-10"></TableHead>
            <TableHead className="w-[70px] text-center">Preview</TableHead>
            <TableHead className="min-w-[250px]"><SortHeader label="Creative Name" columnKey="creativeName" /></TableHead>
            <TableHead className="min-w-[100px]">Type</TableHead>
            <TableHead className="min-w-[140px]">Campaign</TableHead>
            <TableHead className="min-w-[90px]">Status</TableHead>
            <TableHead className="text-right"><SortHeader label="Impr." columnKey="impressions" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Clicks" columnKey="clicks" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Spent" columnKey="spent" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Leads" columnKey="leads" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CTR" columnKey="ctr" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPC" columnKey="cpc" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPM" columnKey="cpm" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPL" columnKey="costPerLead" align="right" /></TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={14} className="text-center py-10 text-muted-foreground">
                No creatives match your filters
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((group) => {
              const isExpanded = expandedCreatives.has(group.creativeName);
              const hasMultipleCampaigns = group.campaigns.length > 1;

              return (
                <Fragment key={group.creativeName}>
                  {/* Parent Row */}
                  <TableRow
                    className={cn(
                      'border-border hover:bg-secondary/30 [&>td]:py-2.5',
                      hasMultipleCampaigns && 'cursor-pointer'
                    )}
                    onClick={() => hasMultipleCampaigns && toggleExpanded(group.creativeName)}
                  >
                    <TableCell className="text-center">
                      {hasMultipleCampaigns && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground mx-auto" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground mx-auto" />
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <CreativeThumbnail imageUrl={group.imageUrl} creativeName={group.creativeName} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium break-words">{group.creativeName}</span>
                        {hasMultipleCampaigns && (
                          <span className="text-xs text-muted-foreground">
                            {group.campaigns.length} campaigns
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CreativeTypeBadge type={group.type} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {hasMultipleCampaigns ? (
                        <span className="text-xs italic">Multiple</span>
                      ) : (
                        <span className="break-words">{group.campaigns[0]?.campaignName}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {!hasMultipleCampaigns && group.campaigns[0] && (
                        <StatusBadge status={group.campaigns[0].status} />
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-right font-medium">{group.impressions.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">{group.clicks.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">${group.spent.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">{group.leads}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">{group.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">${group.cpc.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">${group.cpm.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums text-right font-medium">
                      {group.costPerLead > 0 ? `$${group.costPerLead.toFixed(2)}` : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                  </TableRow>

                  {/* Expanded Campaign Rows */}
                  {isExpanded && group.campaigns.map((campaign, idx) => (
                    <TableRow
                      key={`${group.creativeName}-campaign-${idx}`}
                      className="border-border bg-primary/[0.02] border-l-2 border-l-primary/40 hover:bg-primary/[0.04] [&>td]:py-2.5"
                    >
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="pl-8" colSpan={3}>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground shrink-0">↳</span>
                          <span className="break-words">{campaign.campaignName}</span>
                          <StatusBadge status={campaign.status} />
                        </div>
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">{campaign.impressions.toLocaleString()}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">{campaign.clicks.toLocaleString()}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">${campaign.spent.toFixed(2)}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">{campaign.leads}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">{campaign.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">${campaign.cpc.toFixed(2)}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">${campaign.cpm.toFixed(2)}</TableCell>
                      <TableCell className="tabular-nums text-right text-muted-foreground">
                        {campaign.costPerLead > 0 ? `$${campaign.costPerLead.toFixed(2)}` : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })
          )}
        </TableBody>

        {/* Footer Totals */}
        <TableFooter>
          <TableRow className="hover:bg-transparent font-semibold [&>td]:py-2.5">
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell>Totals</TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell></TableCell>
            <TableCell className="tabular-nums text-right">{totals.impressions.toLocaleString()}</TableCell>
            <TableCell className="tabular-nums text-right">{totals.clicks.toLocaleString()}</TableCell>
            <TableCell className="tabular-nums text-right">${totals.spent.toFixed(2)}</TableCell>
            <TableCell className="tabular-nums text-right">{totals.leads}</TableCell>
            <TableCell className="tabular-nums text-right">{totalCtr.toFixed(2)}%</TableCell>
            <TableCell className="tabular-nums text-right">${totalCpc.toFixed(2)}</TableCell>
            <TableCell className="tabular-nums text-right">${totalCpm.toFixed(2)}</TableCell>
            <TableCell className="tabular-nums text-right">
              {totalCostPerLead > 0 ? `$${totalCostPerLead.toFixed(2)}` : '—'}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </WidgetCard>
  );
}
