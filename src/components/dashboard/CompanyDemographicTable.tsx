import { useState, useMemo, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Building2, ExternalLink, Globe, AlertCircle, CheckCircle, ChevronRight, ChevronDown, ChevronLeft, Target, Megaphone, Loader2, Heart, MessageCircle, Sparkles, Share2, Settings2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CompanyDemographicItem, ObjectiveBreakdownItem, CampaignBreakdownItem } from '@/hooks/useCompanyDemographic';

interface CompanyDemographicTableProps {
  data: CompanyDemographicItem[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  totalCompanies?: number | null;
  loadedCount?: number;
  onExpandObjective?: (entityUrn: string, objective: string, campaignIds: string[], campaignNames: Record<string, string>) => void;
  campaignBreakdownCache?: Map<string, CampaignBreakdownItem[]>;
  loadingObjectives?: Set<string>;
  onExpandCompany?: (entityUrn: string) => void;
  objectiveBreakdownCache?: Map<string, ObjectiveBreakdownItem[]>;
  isLoadingObjectiveBreakdowns?: boolean;
  selectedUrns?: Set<string>;
  onSelectionChange?: (urns: Set<string>) => void;
}

type SortField = 'entityName' | 'impressions' | 'clicks' | 'landingPageClicks' | 'spent' | 'leads' | 'engagements' | 'ctr' | 'cpc' | 'cpm' | 'enrichmentStatus';
type SortDirection = 'asc' | 'desc';
type ColumnKey = 'website' | 'impressions' | 'clicks' | 'landingPageClicks' | 'spent' | 'leads' | 'engagements' | 'ctr' | 'cpc' | 'cpm';

const ALL_COLUMNS: { key: ColumnKey; label: string; sortField: SortField }[] = [
  { key: 'website', label: 'Website', sortField: 'enrichmentStatus' },
  { key: 'impressions', label: 'Impressions', sortField: 'impressions' },
  { key: 'clicks', label: 'Clicks', sortField: 'clicks' },
  { key: 'landingPageClicks', label: 'LP Clicks', sortField: 'landingPageClicks' },
  { key: 'spent', label: 'Spent', sortField: 'spent' },
  { key: 'leads', label: 'Leads', sortField: 'leads' },
  { key: 'engagements', label: 'Engagements', sortField: 'engagements' },
  { key: 'ctr', label: 'CTR', sortField: 'ctr' },
  { key: 'cpc', label: 'CPC', sortField: 'cpc' },
  { key: 'cpm', label: 'CPM', sortField: 'cpm' },
];

const OBJECTIVE_LABELS: Record<string, string> = {
  LEAD_GENERATION: 'Lead Generation',
  ENGAGEMENT: 'Engagement',
  BRAND_AWARENESS: 'Brand Awareness',
  WEBSITE_VISITS: 'Website Visits',
  VIDEO_VIEWS: 'Video Views',
  JOB_APPLICANTS: 'Job Applicants',
  WEBSITE_CONVERSIONS: 'Website Conversions',
};

const OBJECTIVE_COLORS: Record<string, string> = {
  LEAD_GENERATION: 'bg-green-500',
  ENGAGEMENT: 'bg-orange-500',
  BRAND_AWARENESS: 'bg-purple-500',
  WEBSITE_VISITS: 'bg-blue-500',
  VIDEO_VIEWS: 'bg-pink-500',
  JOB_APPLICANTS: 'bg-teal-500',
  WEBSITE_CONVERSIONS: 'bg-cyan-500',
};

function formatObjective(objective: string): string {
  return OBJECTIVE_LABELS[objective] || objective.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface EngagementBreakdownProps {
  engagements: number;
  likes: number;
  comments: number;
  reactions: number;
  shares: number;
  className?: string;
}

function EngagementBreakdownPopover({ engagements, likes, comments, reactions, shares, className = '' }: EngagementBreakdownProps) {
  const maxVal = Math.max(likes, comments, reactions, shares, 1);
  const items = [
    { label: 'Likes', value: likes, icon: Heart, color: 'bg-rose-500' },
    { label: 'Comments', value: comments, icon: MessageCircle, color: 'bg-sky-500' },
    { label: 'Reactions', value: reactions, icon: Sparkles, color: 'bg-amber-500' },
    { label: 'Shares', value: shares, icon: Share2, color: 'bg-emerald-500' },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`tabular-nums hover:text-primary cursor-pointer transition-colors inline-flex items-center gap-1.5 ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {engagements.toLocaleString()}
          <ChevronDown className="h-3 w-3 opacity-40" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end" side="bottom">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Engagement Breakdown</p>
        <div className="space-y-2.5">
          {items.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  {label}
                </span>
                <span className="tabular-nums font-medium">{value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${(value / maxVal) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CompanyDemographicTable({ data, isLoading, isLoadingMore, totalCompanies, loadedCount, onExpandObjective, campaignBreakdownCache, loadingObjectives, onExpandCompany, objectiveBreakdownCache, isLoadingObjectiveBreakdowns, selectedUrns: selectedUrnsProp, onSelectionChange }: CompanyDemographicTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());
  const [enrichmentFilter, setEnrichmentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selectedUrns = selectedUrnsProp ?? internalSelected;
  const setSelectedUrns = (next: Set<string>) => {
    setInternalSelected(next);
    onSelectionChange?.(next);
  };
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    new Set(['website', 'impressions', 'clicks', 'landingPageClicks', 'spent', 'leads', 'engagements', 'ctr', 'cpc', 'cpm'])
  );

  const isColumnVisible = (key: ColumnKey) => visibleColumns.has(key);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // keep at least 1 column
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelected = (urn: string) => {
    const next = new Set(selectedUrns);
    if (next.has(urn)) next.delete(urn); else next.add(urn);
    setSelectedUrns(next);
  };

  // The dynamic colSpan for expanded/empty rows: selection + Company + visible columns count
  const dynamicColSpan = 2 + visibleColumns.size;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleCompany = (entityUrn: string) => {
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(entityUrn)) {
        next.delete(entityUrn);
        setExpandedObjectives(prevObj => {
          const nextObj = new Set(prevObj);
          for (const key of prevObj) {
            if (key.startsWith(entityUrn + '::')) nextObj.delete(key);
          }
          return nextObj;
        });
      } else {
        next.add(entityUrn);
        // Trigger lazy load of objective breakdowns
        onExpandCompany?.(entityUrn);
      }
      return next;
    });
  };

  const toggleObjective = (companyUrn: string, objective: string, breakdown?: ObjectiveBreakdownItem) => {
    const key = `${companyUrn}::${objective}`;
    setExpandedObjectives(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (breakdown?.campaignIds && breakdown.campaignIds.length > 0 && !campaignBreakdownCache?.has(key)) {
          onExpandObjective?.(companyUrn, objective, breakdown.campaignIds, breakdown.campaignNames || {});
        }
      }
      return next;
    });
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;
    if (enrichmentFilter !== 'all') {
      filtered = filtered.filter(item => item.enrichmentStatus === enrichmentFilter);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.entityName.toLowerCase().includes(query) ||
        (item.website && item.website.toLowerCase().includes(query))
      );
    }
    return [...filtered].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }, [data, searchQuery, sortField, sortDirection, enrichmentFilter]);

  // Reset to page 1 when filters or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection, enrichmentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / rowsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredAndSortedData.slice(start, start + rowsPerPage);
  }, [filteredAndSortedData, currentPage, rowsPerPage]);

  const totals = useMemo(() => {
    return filteredAndSortedData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        landingPageClicks: acc.landingPageClicks + item.landingPageClicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
        engagements: acc.engagements + item.engagements,
        likes: acc.likes + item.likes,
        comments: acc.comments + item.comments,
        reactions: acc.reactions + item.reactions,
        shares: acc.shares + item.shares,
      }),
      { impressions: 0, clicks: 0, landingPageClicks: 0, spent: 0, leads: 0, engagements: 0, likes: 0, comments: 0, reactions: 0, shares: 0 }
    );
  }, [filteredAndSortedData]);

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spent / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0;

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50" onClick={() => handleSort(field)}>
      {children}
      {sortField === field ? (
        sortDirection === 'asc'
          ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
          : <ArrowDown className="ml-1 h-3 w-3 text-primary" />
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
      )}
    </Button>
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { dot: string; label: string; className: string }> = {
      resolved:   { dot: 'bg-green-500',          label: 'Resolved',   className: 'bg-green-500/10 text-green-700 border-green-200' },
      fallback:   { dot: 'bg-amber-400',           label: 'Fallback',   className: 'bg-amber-500/10 text-amber-700 border-amber-200' },
      unresolved: { dot: 'bg-muted-foreground',    label: 'Unresolved', className: 'bg-muted text-muted-foreground border-border' },
    };
    const s = config[status] ?? config.unresolved;
    return (
      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border', s.className)}>
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', s.dot)} />
        {s.label}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 overflow-hidden">
        {/* Fake header */}
        <div className="bg-muted/40 px-4 py-2.5 flex gap-4 border-b border-border/50">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-24 ml-auto" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        {/* Fake rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/30 last:border-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20 ml-auto" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar: search, enrichment filter, column toggle, count */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search companies or websites..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={enrichmentFilter} onValueChange={setEnrichmentFilter}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="fallback">Fallback</SelectItem>
            <SelectItem value="unresolved">Unresolved</SelectItem>
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <Settings2 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-3" align="end">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Toggle Columns</p>
            <div className="space-y-1.5">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 py-0.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={visibleColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <span className="text-sm text-muted-foreground ml-auto">
          {filteredAndSortedData.length} companies
          {isLoadingMore && totalCompanies ? ` (loading… ${loadedCount || 0} of ~${totalCompanies})` : ''}
        </span>
      </div>

      {/* Progressive loading progress bar */}
      {isLoadingMore && totalCompanies && totalCompanies > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Loading companies: {loadedCount || 0} of ~{totalCompanies}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.min(((loadedCount || 0) / totalCompanies) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border/50 overflow-x-auto">
        <Table className="w-full">
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50 border-b-2 border-border">
              <TableHead className="min-w-[200px] max-w-[280px]"><SortButton field="entityName">Company</SortButton></TableHead>
              {isColumnVisible('website') && <TableHead className="max-w-[200px]"><SortButton field="enrichmentStatus">Website</SortButton></TableHead>}
              {isColumnVisible('impressions') && <TableHead className="text-right"><SortButton field="impressions">Impressions</SortButton></TableHead>}
              {isColumnVisible('clicks') && <TableHead className="text-right"><SortButton field="clicks">Clicks</SortButton></TableHead>}
              {isColumnVisible('landingPageClicks') && <TableHead className="text-right"><SortButton field="landingPageClicks">LP Clicks</SortButton></TableHead>}
              {isColumnVisible('spent') && <TableHead className="text-right"><SortButton field="spent">Spent</SortButton></TableHead>}
              {isColumnVisible('leads') && <TableHead className="text-right"><SortButton field="leads">Leads</SortButton></TableHead>}
              {isColumnVisible('engagements') && <TableHead className="text-right"><SortButton field="engagements">Engagements</SortButton></TableHead>}
              {isColumnVisible('ctr') && <TableHead className="text-right"><SortButton field="ctr">CTR</SortButton></TableHead>}
              {isColumnVisible('cpc') && <TableHead className="text-right"><SortButton field="cpc">CPC</SortButton></TableHead>}
              {isColumnVisible('cpm') && <TableHead className="text-right"><SortButton field="cpm">CPM</SortButton></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={dynamicColSpan} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 opacity-50" />
                    <span>No company demographic data available</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, index) => {
                const isCompanyExpanded = expandedCompanies.has(item.entityUrn);
                // Use inline breakdown if available, otherwise check lazy-loaded cache
                const inlineBreakdown = item.objectiveBreakdown && item.objectiveBreakdown.length > 0 ? item.objectiveBreakdown : null;
                const cachedBreakdown = objectiveBreakdownCache?.get(item.entityUrn);
                const effectiveBreakdown = inlineBreakdown || (cachedBreakdown && cachedBreakdown.length > 0 ? cachedBreakdown : null);
                const hasBreakdown = !!effectiveBreakdown;
                // All companies are expandable (lazy loading will fetch breakdowns)
                const isExpandable = true;
                const isLoadingThisCompany = isCompanyExpanded && !hasBreakdown && isLoadingObjectiveBreakdowns;

                return (
                  <>
                    <TableRow
                      key={item.entityUrn || index}
                      className={cn('transition-colors duration-150 cursor-pointer', isCompanyExpanded ? 'bg-primary/[0.05] hover:bg-primary/[0.07]' : 'hover:bg-muted/30')}
                      onClick={() => toggleCompany(item.entityUrn)}
                    >
                      <TableCell className="font-medium min-w-[200px] max-w-[280px]">
                        <div className="flex items-center gap-2">
                          {isLoadingThisCompany ? (
                            <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
                          ) : isCompanyExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate max-w-[200px]">{item.entityName}</span>
                            </TooltipTrigger>
                            <TooltipContent side="top"><p>{item.entityName}</p></TooltipContent>
                          </Tooltip>
                          {item.linkedInUrl && (
                            <a href={item.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      {isColumnVisible('website') && (
                        <TableCell className="max-w-[200px]">
                          {item.website ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a href={item.website.startsWith('http') ? item.website : `https://${item.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline text-sm" onClick={(e) => e.stopPropagation()}>
                                  <Globe className={cn(
                                    "h-3 w-3 flex-shrink-0",
                                    item.enrichmentStatus === 'resolved' ? "text-green-500" : "text-amber-500"
                                  )} />
                                  <span className="truncate text-primary">{item.website.replace(/^https?:\/\//, '')}</span>
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                {item.enrichmentStatus === 'resolved' ? '✓ Verified website' : '~ Partial match'}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            getStatusBadge(item.enrichmentStatus)
                          )}
                        </TableCell>
                      )}
                      {isColumnVisible('impressions') && <TableCell className="text-right tabular-nums">{item.impressions.toLocaleString()}</TableCell>}
                      {isColumnVisible('clicks') && <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>}
                      {isColumnVisible('landingPageClicks') && <TableCell className="text-right tabular-nums">{item.landingPageClicks.toLocaleString()}</TableCell>}
                      {isColumnVisible('spent') && <TableCell className="text-right tabular-nums">${item.spent.toFixed(2)}</TableCell>}
                      {isColumnVisible('leads') && <TableCell className="text-right tabular-nums">{item.leads.toLocaleString()}</TableCell>}
                      {isColumnVisible('engagements') && (
                        <TableCell className="text-right">
                          <EngagementBreakdownPopover
                            engagements={item.engagements}
                            likes={item.likes}
                            comments={item.comments}
                            reactions={item.reactions}
                            shares={item.shares}
                          />
                        </TableCell>
                      )}
                      {isColumnVisible('ctr') && <TableCell className="text-right tabular-nums">{item.ctr.toFixed(2)}%</TableCell>}
                      {isColumnVisible('cpc') && <TableCell className="text-right tabular-nums">${item.cpc.toFixed(2)}</TableCell>}
                      {isColumnVisible('cpm') && <TableCell className="text-right tabular-nums">${item.cpm.toFixed(2)}</TableCell>}
                    </TableRow>

                    {/* Loading state for objective breakdowns */}
                    {isLoadingThisCompany && (
                      <TableRow key={`${item.entityUrn}-obj-loading`} className="bg-primary/[0.04] border-l-2 border-l-primary/30">
                        <TableCell colSpan={dynamicColSpan} className="pl-10">
                          <div className="flex items-center gap-2 py-2">
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Loading objective breakdown...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* No breakdown available */}
                    {isCompanyExpanded && !hasBreakdown && !isLoadingThisCompany && (
                      <TableRow key={`${item.entityUrn}-obj-empty`} className="bg-primary/[0.04] border-l-2 border-l-primary/30">
                        <TableCell colSpan={dynamicColSpan} className="pl-10">
                          <span className="text-xs text-muted-foreground">No objective breakdown available for this company</span>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Objective breakdown rows (Level 2) */}
                    {isCompanyExpanded && hasBreakdown && effectiveBreakdown!.map((breakdown, bIdx) => {
                      const objKey = `${item.entityUrn}::${breakdown.objective}`;
                      const isObjExpanded = expandedObjectives.has(objKey);
                      const hasCampaignIds = breakdown.campaignIds && breakdown.campaignIds.length > 0;
                      const isLoadingCampaigns = loadingObjectives?.has(objKey) || false;
                      const cachedCampaigns = campaignBreakdownCache?.get(objKey);
                      const hasCachedCampaigns = cachedCampaigns && cachedCampaigns.length > 0;
                      const objectiveColor = OBJECTIVE_COLORS[breakdown.objective] || 'bg-muted-foreground';

                      // How many columns the "label" cell spans: Company + (website if visible)
                      const labelColSpan = 1 + (isColumnVisible('website') ? 1 : 0);

                      return (
                        <>
                          <TableRow
                            key={`${item.entityUrn}-obj-${bIdx}`}
                            className={cn('transition-colors duration-150 border-l-2 border-l-primary/40', hasCampaignIds ? 'cursor-pointer' : '', isObjExpanded ? 'bg-primary/[0.07] hover:bg-primary/[0.09]' : 'bg-primary/[0.03] hover:bg-primary/[0.06]')}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasCampaignIds) toggleObjective(item.entityUrn, breakdown.objective, breakdown);
                            }}
                          >
                            <TableCell colSpan={labelColSpan} className="pl-10">
                              <div className="flex items-center gap-2">
                                {hasCampaignIds ? (
                                  isLoadingCampaigns ? (
                                    <Loader2 className="h-3.5 w-3.5 text-primary/60 flex-shrink-0 animate-spin" />
                                  ) : isObjExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                                  )
                                ) : (
                                  <Target className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                                )}
                                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${objectiveColor}`} />
                                <span className="text-sm text-muted-foreground">{formatObjective(breakdown.objective)}</span>
                                {hasCampaignIds && (
                                  <span className="text-xs text-muted-foreground/50">({breakdown.campaignIds!.length} campaigns)</span>
                                )}
                              </div>
                            </TableCell>
                            {isColumnVisible('impressions') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.impressions.toLocaleString()}</TableCell>}
                            {isColumnVisible('clicks') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.clicks.toLocaleString()}</TableCell>}
                            {isColumnVisible('landingPageClicks') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.landingPageClicks.toLocaleString()}</TableCell>}
                            {isColumnVisible('spent') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.spent.toFixed(2)}</TableCell>}
                            {isColumnVisible('leads') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.leads.toLocaleString()}</TableCell>}
                            {isColumnVisible('engagements') && (
                              <TableCell className="text-right text-sm text-muted-foreground">
                                <EngagementBreakdownPopover
                                  engagements={breakdown.engagements}
                                  likes={breakdown.likes}
                                  comments={breakdown.comments}
                                  reactions={breakdown.reactions}
                                  shares={breakdown.shares}
                                  className="text-sm text-muted-foreground"
                                />
                              </TableCell>
                            )}
                            {isColumnVisible('ctr') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.ctr.toFixed(2)}%</TableCell>}
                            {isColumnVisible('cpc') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.cpc.toFixed(2)}</TableCell>}
                            {isColumnVisible('cpm') && <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.cpm.toFixed(2)}</TableCell>}
                          </TableRow>

                          {/* Campaign breakdown rows - lazy loaded (Level 3) */}
                          {isObjExpanded && isLoadingCampaigns && (
                            <TableRow key={`${objKey}-loading`} className="bg-muted/[0.03] border-l-4 border-l-primary/15">
                              <TableCell colSpan={dynamicColSpan} className="pl-16">
                                <div className="flex items-center gap-2 py-2">
                                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">Loading campaign breakdown...</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}

                          {isObjExpanded && hasCachedCampaigns && cachedCampaigns!.map((camp, cIdx) => (
                            <TableRow
                              key={`${objKey}-camp-${cIdx}`}
                              className="transition-colors duration-150 bg-muted/20 hover:bg-muted/30 border-l-4 border-l-border"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TableCell colSpan={labelColSpan} className="pl-16">
                                <div className="flex items-center gap-2">
                                  <Megaphone className="h-3 w-3 text-primary/30 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground break-words">{camp.campaignName}</span>
                                </div>
                              </TableCell>
                              {isColumnVisible('impressions') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.impressions.toLocaleString()}</TableCell>}
                              {isColumnVisible('clicks') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.clicks.toLocaleString()}</TableCell>}
                              {isColumnVisible('landingPageClicks') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.landingPageClicks.toLocaleString()}</TableCell>}
                              {isColumnVisible('spent') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.spent.toFixed(2)}</TableCell>}
                              {isColumnVisible('leads') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.leads.toLocaleString()}</TableCell>}
                              {isColumnVisible('engagements') && (
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  <EngagementBreakdownPopover
                                    engagements={camp.engagements}
                                    likes={camp.likes}
                                    comments={camp.comments}
                                    reactions={camp.reactions}
                                    shares={camp.shares}
                                    className="text-xs text-muted-foreground"
                                  />
                                </TableCell>
                              )}
                              {isColumnVisible('ctr') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.ctr.toFixed(2)}%</TableCell>}
                              {isColumnVisible('cpc') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.cpc.toFixed(2)}</TableCell>}
                              {isColumnVisible('cpm') && <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.cpm.toFixed(2)}</TableCell>}
                            </TableRow>
                          ))}

                          {isObjExpanded && !isLoadingCampaigns && cachedCampaigns && cachedCampaigns.length === 0 && (
                            <TableRow key={`${objKey}-empty`} className="bg-muted/[0.03] border-l-4 border-l-primary/15">
                              <TableCell colSpan={dynamicColSpan} className="pl-16">
                                <span className="text-xs text-muted-foreground/60">No campaign-level data for this company</span>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </>
                );
              })
            )}
          </TableBody>
          {filteredAndSortedData.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/60 font-semibold border-t-2 border-border">
                <TableCell>Total ({filteredAndSortedData.length} companies)</TableCell>
                {isColumnVisible('website') && <TableCell></TableCell>}
                {isColumnVisible('impressions') && <TableCell className="text-right tabular-nums">{totals.impressions.toLocaleString()}</TableCell>}
                {isColumnVisible('clicks') && <TableCell className="text-right tabular-nums">{totals.clicks.toLocaleString()}</TableCell>}
                {isColumnVisible('landingPageClicks') && <TableCell className="text-right tabular-nums">{totals.landingPageClicks.toLocaleString()}</TableCell>}
                {isColumnVisible('spent') && <TableCell className="text-right tabular-nums">${totals.spent.toFixed(2)}</TableCell>}
                {isColumnVisible('leads') && <TableCell className="text-right tabular-nums">{totals.leads.toLocaleString()}</TableCell>}
                {isColumnVisible('engagements') && (
                  <TableCell className="text-right">
                    <EngagementBreakdownPopover
                      engagements={totals.engagements}
                      likes={totals.likes}
                      comments={totals.comments}
                      reactions={totals.reactions}
                      shares={totals.shares}
                      className="font-semibold"
                    />
                  </TableCell>
                )}
                {isColumnVisible('ctr') && <TableCell className="text-right tabular-nums">{totalCtr.toFixed(2)}%</TableCell>}
                {isColumnVisible('cpc') && <TableCell className="text-right tabular-nums">${totalCpc.toFixed(2)}</TableCell>}
                {isColumnVisible('cpm') && <TableCell className="text-right tabular-nums">${totalCpm.toFixed(2)}</TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Pagination controls */}
      {filteredAndSortedData.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
            <Select value={String(rowsPerPage)} onValueChange={(v) => { setRowsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground tabular-nums">
              {Math.min((currentPage - 1) * rowsPerPage + 1, filteredAndSortedData.length)}&ndash;{Math.min(currentPage * rowsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
