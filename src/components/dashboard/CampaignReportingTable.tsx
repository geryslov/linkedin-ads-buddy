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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  X,
  Filter,
} from 'lucide-react';
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

interface CampaignReportingTableProps {
  data: CampaignData[];
  isLoading?: boolean;
}

type SortField = 'campaignName' | 'status' | 'objectiveType' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'costPerLead';
type SortDirection = 'asc' | 'desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'DRAFT', label: 'Draft' },
];

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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      ACTIVE: 'default',
      PAUSED: 'secondary',
      ARCHIVED: 'outline',
      DRAFT: 'outline',
    };

    return (
      <Badge
        variant={variants[status] || 'secondary'}
        className={status === 'ACTIVE' ? 'bg-success text-success-foreground' : ''}
      >
        {status}
      </Badge>
    );
  };

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No campaign data available for the selected time period.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchTerm('')}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <PerformanceFilters
          campaignType={campaignTypeFilter}
          onCampaignTypeChange={setCampaignTypeFilter}
          metricFilters={metricFilters}
          onMetricFiltersChange={setMetricFilters}
        />

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-3 w-3" />
            Clear All
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedData.length} of {data.length} campaigns
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="min-w-[200px]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('campaignName')} className="gap-1 -ml-2">
                  Campaign Name {getSortIcon('campaignName')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="gap-1 -ml-2">
                  Status {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => handleSort('objectiveType')} className="gap-1 -ml-2">
                  Objective {getSortIcon('objectiveType')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('impressions')} className="gap-1">
                  Impressions {getSortIcon('impressions')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('clicks')} className="gap-1">
                  Clicks {getSortIcon('clicks')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('spent')} className="gap-1">
                  Spent {getSortIcon('spent')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('leads')} className="gap-1">
                  Leads {getSortIcon('leads')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('ctr')} className="gap-1">
                  CTR {getSortIcon('ctr')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('cpc')} className="gap-1">
                  CPC {getSortIcon('cpc')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('cpm')} className="gap-1">
                  CPM {getSortIcon('cpm')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleSort('costPerLead')} className="gap-1">
                  CPL {getSortIcon('costPerLead')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                  No campaigns match the selected filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((campaign) => (
                <TableRow key={campaign.campaignId} className="hover:bg-muted/20">
                  <TableCell className="font-medium max-w-[300px]">
                    <div className="truncate" title={campaign.campaignName}>
                      {campaign.campaignName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {campaign.campaignId}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {formatObjectiveType(campaign.objectiveType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {campaign.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {campaign.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${campaign.spent.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {campaign.leads.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {campaign.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    ${campaign.cpc.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${campaign.cpm.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${campaign.costPerLead.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
