import { useState, useMemo } from 'react';
import { CampaignData } from '@/hooks/useCampaignReporting';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Target,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  PerformanceFilters,
  MetricFilter,
  applyMetricFilters,
  applyCampaignTypeFilter,
} from './PerformanceFilters';

interface CampaignReportingTableProps {
  data: CampaignData[];
  isLoading?: boolean;
}

type SortField = 'campaignName' | 'status' | 'objectiveType' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'lgfCompletionRate' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
type SortDirection = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
];

const STATUS_TONE: Record<string, { tone: 'success' | 'warning' | 'info' | 'neutral'; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  PAUSED: { tone: 'warning', label: 'Paused' },
  DRAFT: { tone: 'info', label: 'Draft' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
};

export function CampaignReportingTable({ data, isLoading }: CampaignReportingTableProps) {
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [campaignTypeFilter, setCampaignTypeFilter] = useState('all');
  const [metricFilters, setMetricFilters] = useState<MetricFilter[]>([]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Transform data for campaign type filter (use objectiveType as campaignType)
  const dataWithCampaignType = useMemo(() => {
    return data.map(item => ({
      ...item,
      campaignType: item.objectiveType,
    }));
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let filtered = dataWithCampaignType;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.campaignName.toLowerCase().includes(term) ||
        item.campaignId.toLowerCase().includes(term)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    // Apply campaign type filter
    filtered = applyCampaignTypeFilter(filtered, campaignTypeFilter);

    // Apply metric filters
    filtered = applyMetricFilters(filtered, metricFilters);

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [dataWithCampaignType, searchTerm, statusFilter, campaignTypeFilter, metricFilters, sortField, sortDirection]);

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCampaignTypeFilter('all');
    setMetricFilters([]);
  };

  const hasActiveFilters = searchTerm || statusFilter !== 'all' || campaignTypeFilter !== 'all' || metricFilters.length > 0;

  const formatObjectiveType = (type: string) => {
    const typeMap: Record<string, string> = {
      LEAD_GENERATION: 'Lead Generation',
      ENGAGEMENT: 'Engagement',
      BRAND_AWARENESS: 'Brand Awareness',
      WEBSITE_VISITS: 'Website Visits',
      VIDEO_VIEWS: 'Video Views',
      JOB_APPLICANTS: 'Job Applicants',
      WEBSITE_CONVERSIONS: 'Website Conversions',
    };
    return typeMap[type] || type;
  };

  const SortHeader = ({ label, field, align }: { label: string; field: SortField; align?: 'right' }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'inline-flex items-center gap-1 font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-[0.08em] text-[11px]',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {label}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <WidgetCard title="Campaign performance">
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-[360px] w-full" />
        </div>
      </WidgetCard>
    );
  }

  if (data.length === 0) {
    return (
      <WidgetCard noPadding title="Campaign performance">
        <EmptyState
          icon={Target}
          title="No campaign data"
          description="No campaign data available for the selected time period."
        />
      </WidgetCard>
    );
  }

  return (
    <WidgetCard
      noPadding
      title="Campaign performance"
      subtitle={`${filteredAndSortedData.length} of ${data.length} campaigns`}
      toolbar={
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search campaigns…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-[200px] pl-8 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] text-sm bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
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
            Clear All
          </Button>
        )}
      </div>

      <Table className="min-w-[1100px]">
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-secondary/40">
            <TableHead className="min-w-[200px]"><SortHeader label="Campaign" field="campaignName" /></TableHead>
            <TableHead><SortHeader label="Status" field="status" /></TableHead>
            <TableHead><SortHeader label="Objective" field="objectiveType" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Impressions" field="impressions" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Clicks" field="clicks" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Spent" field="spent" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="Leads" field="leads" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CTR" field="ctr" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPC" field="cpc" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPM" field="cpm" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="LGF Rate" field="lgfCompletionRate" align="right" /></TableHead>
            <TableHead className="text-right"><SortHeader label="CPL" field="costPerLead" align="right" /></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                No campaigns match the selected filters
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSortedData.map((campaign) => {
              const s = STATUS_TONE[campaign.status];
              return (
                <TableRow key={campaign.campaignId} className="border-border hover:bg-secondary/30 [&>td]:py-2.5">
                  <TableCell className="font-medium max-w-[380px]">
                    <span className="block break-words">{campaign.campaignName}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      ID: {campaign.campaignId}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s ? <StatusPill tone={s.tone} label={s.label} /> : <StatusPill tone="neutral" label={campaign.status} />}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatObjectiveType(campaign.objectiveType)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-medium">
                    {campaign.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-medium">
                    {campaign.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-medium">
                    ${campaign.spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right font-medium">
                    {campaign.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {campaign.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    ${campaign.cpc.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    ${campaign.cpm.toFixed(2)}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {campaign.lgfCompletionRate > 0 ? `${campaign.lgfCompletionRate.toFixed(1)}%` : <span className="text-muted-foreground/50">—</span>}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    ${campaign.costPerLead.toFixed(2)}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}
