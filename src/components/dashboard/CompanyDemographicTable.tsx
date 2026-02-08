import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Search, Building2, ExternalLink, Globe, AlertCircle, CheckCircle, ChevronRight, ChevronDown, Target, Megaphone, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CompanyDemographicItem, ObjectiveBreakdownItem, CampaignBreakdownItem } from '@/hooks/useCompanyDemographic';

interface CompanyDemographicTableProps {
  data: CompanyDemographicItem[];
  isLoading: boolean;
  onExpandObjective?: (entityUrn: string, objective: string, campaignIds: string[], campaignNames: Record<string, string>) => void;
  campaignBreakdownCache?: Map<string, CampaignBreakdownItem[]>;
  loadingObjectives?: Set<string>;
}

type SortField = 'entityName' | 'impressions' | 'clicks' | 'spent' | 'leads' | 'ctr' | 'cpc' | 'cpm' | 'enrichmentStatus';
type SortDirection = 'asc' | 'desc';

const OBJECTIVE_LABELS: Record<string, string> = {
  LEAD_GENERATION: 'Lead Generation',
  ENGAGEMENT: 'Engagement',
  BRAND_AWARENESS: 'Brand Awareness',
  WEBSITE_VISITS: 'Website Visits',
  VIDEO_VIEWS: 'Video Views',
  JOB_APPLICANTS: 'Job Applicants',
  WEBSITE_CONVERSIONS: 'Website Conversions',
};

function formatObjective(objective: string): string {
  return OBJECTIVE_LABELS[objective] || objective.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CompanyDemographicTable({ data, isLoading, onExpandObjective, campaignBreakdownCache, loadingObjectives }: CompanyDemographicTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('impressions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedObjectives, setExpandedObjectives] = useState<Set<string>>(new Set());

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
        // Trigger lazy load if we have campaign IDs and no cached data
        if (breakdown?.campaignIds && breakdown.campaignIds.length > 0 && !campaignBreakdownCache?.has(key)) {
          onExpandObjective?.(companyUrn, objective, breakdown.campaignIds, breakdown.campaignNames || {});
        }
      }
      return next;
    });
  };

  const filteredAndSortedData = useMemo(() => {
    let filtered = data;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = data.filter(item =>
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
  }, [data, searchQuery, sortField, sortDirection]);

  const totals = useMemo(() => {
    return filteredAndSortedData.reduce(
      (acc, item) => ({
        impressions: acc.impressions + item.impressions,
        clicks: acc.clicks + item.clicks,
        spent: acc.spent + item.spent,
        leads: acc.leads + item.leads,
      }),
      { impressions: 0, clicks: 0, spent: 0, leads: 0 }
    );
  }, [filteredAndSortedData]);

  const totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const totalCpc = totals.clicks > 0 ? totals.spent / totals.clicks : 0;
  const totalCpm = totals.impressions > 0 ? (totals.spent / totals.impressions) * 1000 : 0;

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-muted/50" onClick={() => handleSort(field)}>
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600 gap-1"><CheckCircle className="h-3 w-3" />Resolved</Badge>;
      case 'fallback':
        return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 gap-1"><Globe className="h-3 w-3" />Fallback</Badge>;
      default:
        return <Badge variant="secondary" className="bg-muted text-muted-foreground gap-1"><AlertCircle className="h-3 w-3" />Unresolved</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search companies or websites..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <span className="text-sm text-muted-foreground">{filteredAndSortedData.length} companies</span>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[200px]"><SortButton field="entityName">Company</SortButton></TableHead>
              <TableHead className="w-[180px]"><SortButton field="enrichmentStatus">Website</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="impressions">Impressions</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="clicks">Clicks</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="spent">Spent</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="leads">Leads</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="ctr">CTR</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="cpc">CPC</SortButton></TableHead>
              <TableHead className="text-right"><SortButton field="cpm">CPM</SortButton></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-8 w-8 opacity-50" />
                    <span>No company demographic data available</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedData.map((item, index) => {
                const isCompanyExpanded = expandedCompanies.has(item.entityUrn);
                const hasBreakdown = item.objectiveBreakdown && item.objectiveBreakdown.length > 0;
                
                return (
                  <>
                    <TableRow 
                      key={item.entityUrn || index} 
                      className={`hover:bg-muted/20 ${hasBreakdown ? 'cursor-pointer' : ''} ${isCompanyExpanded ? 'bg-muted/10' : ''}`}
                      onClick={() => hasBreakdown && toggleCompany(item.entityUrn)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {hasBreakdown ? (
                            isCompanyExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="truncate max-w-[160px]" title={item.entityName}>{item.entityName}</span>
                          {item.linkedInUrl && (
                            <a href={item.linkedInUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80" onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.website ? (
                          <a href={item.website.startsWith('http') ? item.website : `https://${item.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-sm" onClick={(e) => e.stopPropagation()}>
                            <Globe className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[120px]">{item.website.replace(/^https?:\/\//, '')}</span>
                          </a>
                        ) : (
                          getStatusBadge(item.enrichmentStatus)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{item.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">${item.spent.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.leads.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right tabular-nums">${item.cpc.toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">${item.cpm.toFixed(2)}</TableCell>
                    </TableRow>

                    {isCompanyExpanded && hasBreakdown && item.objectiveBreakdown!.map((breakdown, bIdx) => {
                      const objKey = `${item.entityUrn}::${breakdown.objective}`;
                      const isObjExpanded = expandedObjectives.has(objKey);
                      const hasCampaignIds = breakdown.campaignIds && breakdown.campaignIds.length > 0;
                      const isLoadingCampaigns = loadingObjectives?.has(objKey) || false;
                      const cachedCampaigns = campaignBreakdownCache?.get(objKey);
                      const hasCachedCampaigns = cachedCampaigns && cachedCampaigns.length > 0;
                      
                      return (
                        <>
                          <TableRow 
                            key={`${item.entityUrn}-obj-${bIdx}`} 
                            className={`bg-muted/5 hover:bg-muted/15 border-l-2 border-l-primary/20 ${hasCampaignIds ? 'cursor-pointer' : ''} ${isObjExpanded ? 'bg-muted/10' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasCampaignIds) toggleObjective(item.entityUrn, breakdown.objective, breakdown);
                            }}
                          >
                            <TableCell colSpan={2} className="pl-10">
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
                                <span className="text-sm text-muted-foreground">{formatObjective(breakdown.objective)}</span>
                                {hasCampaignIds && (
                                  <span className="text-xs text-muted-foreground/50">({breakdown.campaignIds!.length} campaigns)</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.spent.toFixed(2)}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.leads.toLocaleString()}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{breakdown.ctr.toFixed(2)}%</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.cpc.toFixed(2)}</TableCell>
                            <TableCell className="text-right tabular-nums text-sm text-muted-foreground">${breakdown.cpm.toFixed(2)}</TableCell>
                          </TableRow>

                          {/* Campaign breakdown rows - lazy loaded */}
                          {isObjExpanded && isLoadingCampaigns && (
                            <TableRow key={`${objKey}-loading`} className="bg-muted/[0.02] border-l-4 border-l-primary/10">
                              <TableCell colSpan={9} className="pl-16">
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
                              className="bg-muted/[0.02] hover:bg-muted/10 border-l-4 border-l-primary/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TableCell colSpan={2} className="pl-16">
                                <div className="flex items-center gap-2">
                                  <Megaphone className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={camp.campaignName}>{camp.campaignName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.impressions.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.clicks.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.spent.toFixed(2)}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.leads.toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{camp.ctr.toFixed(2)}%</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.cpc.toFixed(2)}</TableCell>
                              <TableCell className="text-right tabular-nums text-xs text-muted-foreground">${camp.cpm.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}

                          {isObjExpanded && !isLoadingCampaigns && cachedCampaigns && cachedCampaigns.length === 0 && (
                            <TableRow key={`${objKey}-empty`} className="bg-muted/[0.02] border-l-4 border-l-primary/10">
                              <TableCell colSpan={9} className="pl-16">
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
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total ({filteredAndSortedData.length} companies)</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right tabular-nums">{totals.impressions.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.clicks.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">${totals.spent.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">{totals.leads.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums">{totalCtr.toFixed(2)}%</TableCell>
                <TableCell className="text-right tabular-nums">${totalCpc.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">${totalCpm.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
