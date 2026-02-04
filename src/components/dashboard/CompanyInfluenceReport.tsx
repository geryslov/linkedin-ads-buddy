import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Building2, TrendingUp, Users, Target, ChevronDown, ChevronRight, Download, Flame, AlertTriangle, Pencil, Check, X } from 'lucide-react';
import { useCompanyInfluence, CompanyInfluenceItem } from '@/hooks/useCompanyInfluence';
import { TimeFrameSelector } from './TimeFrameSelector';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/exportUtils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Helper function to normalize company URN and extract ID
function normalizeCompanyUrn(urn: string): { id: string | null } {
  if (!urn) return { id: null };
  const match = urn.match(/^urn:li:(organization|company|memberCompany):(\d+)$/);
  if (match) return { id: match[2] };
  const numericMatch = urn.match(/:(\d+)$/);
  return { id: numericMatch ? numericMatch[1] : null };
}

interface CompanyInfluenceReportProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  'LEAD_GENERATION': 'Lead Gen',
  'WEBSITE_VISITS': 'Website Visits',
  'BRAND_AWARENESS': 'Brand Awareness',
  'ENGAGEMENT': 'Engagement',
  'VIDEO_VIEWS': 'Video Views',
  'JOB_APPLICANTS': 'Job Applicants',
  'WEBSITE_CONVERSIONS': 'Conversions',
};

function ObjectiveBadge({ objective }: { objective: string }) {
  const label = OBJECTIVE_LABELS[objective] || objective;
  const colors: Record<string, string> = {
    'LEAD_GENERATION': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    'WEBSITE_VISITS': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    'BRAND_AWARENESS': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    'ENGAGEMENT': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    'VIDEO_VIEWS': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  };

  return (
    <Badge variant="secondary" className={`text-xs ${colors[objective] || ''}`}>
      {label}
    </Badge>
  );
}

function EngagementScoreBadge({ score, leads }: { score: number; leads: number }) {
  let tier: 'hot' | 'warm' | 'cold' = 'cold';
  let color = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

  if (leads > 0 && score > 500) {
    tier = 'hot';
    color = 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  } else if (score > 100) {
    tier = 'warm';
    color = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-medium">{score.toLocaleString()}</span>
      {tier === 'hot' && <Flame className="h-4 w-4 text-red-500" />}
    </div>
  );
}

function CompanyRow({ company, isExpanded, onToggle, onNameUpdate }: {
  company: CompanyInfluenceItem;
  isExpanded: boolean;
  onToggle: () => void;
  onNameUpdate?: (orgId: string, name: string) => Promise<{ success: boolean }>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(company.companyName);
  const isUnresolved = company.companyName.startsWith('Company ');

  const handleSave = async () => {
    if (!editName.trim()) return;
    const { id } = normalizeCompanyUrn(company.companyUrn);
    if (id && onNameUpdate) {
      const result = await onNameUpdate(id, editName.trim());
      if (result.success) {
        setIsEditing(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setIsEditing(false);
  };

  return (
    <>
      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={onToggle}>
        <TableCell className="w-10">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="w-48 font-medium" onClick={(e) => isEditing && e.stopPropagation()}>
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-7 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleSave(); }}>
                <Check className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={isUnresolved ? 'text-muted-foreground' : ''} title={company.companyName}>
                {company.companyName}
              </span>
              {isUnresolved && onNameUpdate && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  title="Edit company name"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </TableCell>
        <TableCell className="w-24">
          <EngagementScoreBadge score={company.engagementScore} leads={company.totalLeads} />
        </TableCell>
        <TableCell className="w-28 text-right">{company.totalImpressions.toLocaleString()}</TableCell>
        <TableCell className="w-20 text-right">{company.totalClicks.toLocaleString()}</TableCell>
        <TableCell className="w-16 text-right font-medium text-primary">{company.totalLeads}</TableCell>
        <TableCell className="w-24 text-right">${company.totalSpend.toFixed(2)}</TableCell>
        <TableCell className="w-20 text-right">{company.ctr.toFixed(2)}%</TableCell>
        <TableCell className="w-16 text-center">{company.campaignDepth}</TableCell>
        <TableCell className="w-40">
          <div className="flex flex-wrap gap-1">
            {company.objectiveTypes.slice(0, 2).map(obj => (
              <ObjectiveBadge key={obj} objective={obj} />
            ))}
            {company.objectiveTypes.length > 2 && (
              <Badge variant="outline" className="text-xs">+{company.objectiveTypes.length - 2}</Badge>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={10} className="p-0 bg-muted/30">
            <div className="p-4 ml-8 mr-4 mb-2 rounded-lg">
              <h4 className="text-sm font-medium mb-3">Campaign Breakdown</h4>
              {company.campaignBreakdown.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-48">Campaign</TableHead>
                      <TableHead className="text-xs w-32">Objective</TableHead>
                      <TableHead className="text-xs text-right w-24">Impressions</TableHead>
                      <TableHead className="text-xs text-right w-20">Clicks</TableHead>
                      <TableHead className="text-xs text-right w-16">Leads</TableHead>
                      <TableHead className="text-xs text-right w-24">Spend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.campaignBreakdown.map((campaign, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/50">
                        <TableCell className="text-xs font-medium max-w-[150px] truncate" title={campaign.campaignName}>
                          {campaign.campaignName}
                        </TableCell>
                        <TableCell>
                          <ObjectiveBadge objective={campaign.objective} />
                        </TableCell>
                        <TableCell className="text-xs text-right">{campaign.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right">{campaign.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right font-medium">{campaign.leads}</TableCell>
                        <TableCell className="text-xs text-right">${campaign.spend.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Campaign-level breakdown not available. Account-level analytics aggregated.
                </p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function CompanyInfluenceReport({ accessToken, selectedAccount }: CompanyInfluenceReportProps) {
  const {
    data,
    isLoading,
    error,
    fetchCompanyInfluence,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    expandedCompanies,
    toggleCompanyExpanded,
    objectiveFilter,
    setObjectiveFilter,
    filteredCompanies,
    availableObjectives,
    minImpressions,
    setMinImpressions,
    engagementTiers,
    updateCompanyName,
  } = useCompanyInfluence(accessToken);
  const { toast } = useToast();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('last_30_days');

  // Refetch when account or date range changes
  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchCompanyInfluence(selectedAccount, minImpressions);
    }
  }, [selectedAccount, accessToken, dateRange.start, dateRange.end]);

  const handleApplyFilters = () => {
    if (selectedAccount) {
      fetchCompanyInfluence(selectedAccount, minImpressions);
    }
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchCompanyInfluence(selectedAccount, minImpressions);
    }
  };

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
    // Refetch will be triggered by the useEffect watching dateRange
  };

  const handleExport = () => {
    if (!filteredCompanies.length) return;

    const exportData = filteredCompanies.map(c => ({
      companyName: c.companyName,
      engagementScore: c.engagementScore,
      totalImpressions: c.totalImpressions,
      totalClicks: c.totalClicks,
      totalLeads: c.totalLeads,
      totalSpend: c.totalSpend.toFixed(2),
      ctr: c.ctr.toFixed(2),
      cpl: c.totalLeads > 0 ? c.cpl.toFixed(2) : '',
      campaignDepth: c.campaignDepth,
      objectiveTypes: c.objectiveTypes.join(', '),
    }));

    const columns = [
      { key: 'companyName', label: 'Company' },
      { key: 'engagementScore', label: 'Engagement Score' },
      { key: 'totalImpressions', label: 'Impressions' },
      { key: 'totalClicks', label: 'Clicks' },
      { key: 'totalLeads', label: 'Leads' },
      { key: 'totalSpend', label: 'Spend' },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpl', label: 'CPL' },
      { key: 'campaignDepth', label: 'Campaign Depth' },
      { key: 'objectiveTypes', label: 'Objectives' },
    ];

    exportToCSV(exportData, 'company_influence_report', columns);
    toast({ title: 'Export successful', description: `${exportData.length} companies exported` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-destructive/10 border-destructive/30">
        <CardContent className="pt-4">
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Names Resolution Warning */}
      {data?.metadata?.namesResolutionFailed && (
        <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">Some Company Names Unavailable</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            LinkedIn blocked automatic name resolution. Showing cached names and IDs for unknowns.
            Click the edit icon next to any "Company 12345" to set a name manually.
          </AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <TimeFrameSelector
                timeFrameOptions={timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleTimeFrameChange}
                timeGranularity="ALL"
                onGranularityChange={() => {}}
                dateRange={dateRange}
                onCustomDateChange={(start, end) => {
                  setDateRange({
                    start: start.toISOString().split('T')[0],
                    end: end.toISOString().split('T')[0],
                  });
                }}
              />
              <div className="flex items-center gap-2">
                <Label htmlFor="objective-filter" className="text-sm whitespace-nowrap">Objective:</Label>
                <Select value={objectiveFilter} onValueChange={setObjectiveFilter}>
                  <SelectTrigger id="objective-filter" className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Objectives</SelectItem>
                    {availableObjectives.map(obj => (
                      <SelectItem key={obj} value={obj}>
                        {OBJECTIVE_LABELS[obj] || obj}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="min-impr" className="text-sm whitespace-nowrap">Min Impr:</Label>
                <Input
                  id="min-impr"
                  type="number"
                  value={minImpressions}
                  onChange={(e) => setMinImpressions(parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                <Button variant="secondary" size="sm" onClick={handleApplyFilters}>
                  Apply
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Companies Reached</div>
            <div className="text-2xl font-bold">{data?.summary?.totalCompanies || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Companies Engaged</div>
            <div className="text-2xl font-bold">{data?.summary?.companiesEngaged || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="text-xs text-green-600 dark:text-green-400">Companies Converted</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{data?.summary?.companiesConverted || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Impressions</div>
            <div className="text-2xl font-bold">{(data?.summary?.totalImpressions || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Clicks</div>
            <div className="text-2xl font-bold">{(data?.summary?.totalClicks || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Leads</div>
            <div className="text-2xl font-bold text-primary">{data?.summary?.totalLeads || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Spend</div>
            <div className="text-2xl font-bold">${(data?.summary?.totalSpend || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Accounts Highlight */}
      {engagementTiers.hot.length > 0 && (
        <Card className="bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Hot Accounts ({engagementTiers.hot.length})
            </CardTitle>
            <CardDescription className="text-xs">
              High engagement companies with conversions - prioritize for sales outreach
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {engagementTiers.hot.slice(0, 10).map(company => (
                <Badge key={company.companyUrn} variant="secondary" className="bg-red-100 dark:bg-red-900">
                  {company.companyName} ({company.totalLeads} leads)
                </Badge>
              ))}
              {engagementTiers.hot.length > 10 && (
                <Badge variant="outline">+{engagementTiers.hot.length - 10} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Objective Breakdown */}
      {data?.objectiveBreakdown && data.objectiveBreakdown.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Influence by Objective
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {data.objectiveBreakdown.map(obj => (
                <div key={obj.objective} className="p-3 border rounded-lg">
                  <ObjectiveBadge objective={obj.objective} />
                  <div className="mt-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Companies:</span>
                      <span className="font-medium">{obj.companies}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Influence Details
          </CardTitle>
          <CardDescription>
            Click a row to see campaign-level breakdown. Sorted by engagement score.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCompanies.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table className="table-fixed w-full min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-48">Company</TableHead>
                    <TableHead className="w-24">Score</TableHead>
                    <TableHead className="w-28 text-right">Impressions</TableHead>
                    <TableHead className="w-20 text-right">Clicks</TableHead>
                    <TableHead className="w-16 text-right">Leads</TableHead>
                    <TableHead className="w-24 text-right">Spend</TableHead>
                    <TableHead className="w-20 text-right">CTR</TableHead>
                    <TableHead className="w-16 text-center">Depth</TableHead>
                    <TableHead className="w-40">Objectives</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <CompanyRow
                      key={company.companyUrn}
                      company={company}
                      isExpanded={expandedCompanies.has(company.companyUrn)}
                      onToggle={() => toggleCompanyExpanded(company.companyUrn)}
                      onNameUpdate={updateCompanyName}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No companies found with the current filters.</p>
              <p className="text-sm mt-2">Try adjusting the date range or reducing the minimum impressions threshold.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
