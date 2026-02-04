import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RefreshCw,
  Building2,
  Download,
  Flame,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  MousePointerClick,
  Eye,
  DollarSign,
} from 'lucide-react';
import { useCompanyEngagementReport, CompanyEngagementItem } from '@/hooks/useCompanyEngagementReport';
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

interface CompanyEngagementReportProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

function EngagementBadge({ score, leads }: { score: number; leads: number }) {
  if (leads > 0 && score > 500) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        <Flame className="h-3 w-3 mr-1" />
        Hot
      </Badge>
    );
  }
  if (score > 100) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Warm
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
      Cold
    </Badge>
  );
}

export function CompanyEngagementReport({ accessToken, selectedAccount }: CompanyEngagementReportProps) {
  const {
    data,
    isLoading,
    error,
    fetchReport,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    searchQuery,
    setSearchQuery,
    minImpressions,
    setMinImpressions,
    sortField,
    sortDirection,
    handleSort,
    filteredCompanies,
    tierCompanies,
  } = useCompanyEngagementReport(accessToken);
  const { toast } = useToast();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('last_30_days');

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchReport(selectedAccount, minImpressions);
    }
  }, [selectedAccount, accessToken, dateRange.start, dateRange.end]);

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchReport(selectedAccount, minImpressions);
    }
  };

  const handleApplyFilters = () => {
    if (selectedAccount) {
      fetchReport(selectedAccount, minImpressions);
    }
  };

  const handleExport = () => {
    if (!filteredCompanies.length) return;

    const exportData = filteredCompanies.map(c => ({
      companyName: c.companyName,
      engagementScore: c.engagementScore,
      impressions: c.impressions,
      clicks: c.clicks,
      leads: c.leads,
      spend: c.spend.toFixed(2),
      ctr: c.ctr.toFixed(2),
      cpc: c.cpc.toFixed(2),
      cpm: c.cpm.toFixed(2),
      cpl: c.leads > 0 ? c.cpl.toFixed(2) : '',
    }));

    const columns = [
      { key: 'companyName', label: 'Company' },
      { key: 'engagementScore', label: 'Engagement Score' },
      { key: 'impressions', label: 'Impressions' },
      { key: 'clicks', label: 'Clicks' },
      { key: 'leads', label: 'Leads' },
      { key: 'spend', label: 'Spend' },
      { key: 'ctr', label: 'CTR (%)' },
      { key: 'cpc', label: 'CPC' },
      { key: 'cpm', label: 'CPM' },
      { key: 'cpl', label: 'CPL' },
    ];

    exportToCSV(exportData, 'company_engagement_report', columns);
    toast({ title: 'Export successful', description: `${exportData.length} companies exported` });
  };

  const SortButton = ({ field, children }: { field: keyof CompanyEngagementItem; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 px-2 -ml-2"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field ? (
        sortDirection === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
      )}
    </Button>
  );

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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Companies
            </div>
            <div className="text-2xl font-bold">{data?.summary?.totalCompanies || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <MousePointerClick className="h-3 w-3" />
              Engaged
            </div>
            <div className="text-2xl font-bold">{data?.summary?.companiesEngaged || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Users className="h-3 w-3" />
              Converted
            </div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{data?.summary?.companiesConverted || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" />
              Impressions
            </div>
            <div className="text-2xl font-bold">{(data?.summary?.totalImpressions || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Clicks</div>
            <div className="text-2xl font-bold">{(data?.summary?.totalClicks || 0).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Leads</div>
            <div className="text-2xl font-bold text-primary">{data?.summary?.totalLeads || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Spend
            </div>
            <div className="text-2xl font-bold">${(data?.summary?.totalSpend || 0).toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Avg CTR</div>
            <div className="text-2xl font-bold">{(data?.summary?.avgCtr || 0).toFixed(2)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Hot Accounts */}
      {tierCompanies.hot.length > 0 && (
        <Card className="bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Hot Accounts ({tierCompanies.hot.length})
            </CardTitle>
            <CardDescription className="text-xs">
              High engagement companies with conversions - prioritize for sales outreach
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tierCompanies.hot.slice(0, 15).map(company => (
                <Badge key={company.companyUrn} variant="secondary" className="bg-red-100 dark:bg-red-900">
                  {company.companyName} ({company.leads} leads)
                </Badge>
              ))}
              {tierCompanies.hot.length > 15 && (
                <Badge variant="outline">+{tierCompanies.hot.length - 15} more</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Tiers Summary */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="bg-red-50/50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardContent className="pt-4 text-center">
            <Flame className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">{data?.engagementTiers?.hot || 0}</div>
            <div className="text-xs text-muted-foreground">Hot Accounts</div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50/50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{data?.engagementTiers?.warm || 0}</div>
            <div className="text-xs text-muted-foreground">Warm Accounts</div>
          </CardContent>
        </Card>
        <Card className="bg-gray-50/50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-700">
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">{data?.engagementTiers?.cold || 0}</div>
            <div className="text-xs text-muted-foreground">Cold Accounts</div>
          </CardContent>
        </Card>
      </div>

      {/* Company Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Engagement Details
              </CardTitle>
              <CardDescription>
                {filteredCompanies.length} companies sorted by {sortField}
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCompanies.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead className="min-w-[200px]">
                      <SortButton field="companyName">Company</SortButton>
                    </TableHead>
                    <TableHead className="w-24">Tier</TableHead>
                    <TableHead className="w-28 text-right">
                      <SortButton field="engagementScore">Score</SortButton>
                    </TableHead>
                    <TableHead className="w-28 text-right">
                      <SortButton field="impressions">Impressions</SortButton>
                    </TableHead>
                    <TableHead className="w-20 text-right">
                      <SortButton field="clicks">Clicks</SortButton>
                    </TableHead>
                    <TableHead className="w-16 text-right">
                      <SortButton field="leads">Leads</SortButton>
                    </TableHead>
                    <TableHead className="w-24 text-right">
                      <SortButton field="spend">Spend</SortButton>
                    </TableHead>
                    <TableHead className="w-20 text-right">
                      <SortButton field="ctr">CTR</SortButton>
                    </TableHead>
                    <TableHead className="w-20 text-right">
                      <SortButton field="cpc">CPC</SortButton>
                    </TableHead>
                    <TableHead className="w-20 text-right">
                      <SortButton field="cpm">CPM</SortButton>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.slice(0, 100).map((company, idx) => (
                    <TableRow key={company.companyUrn} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">
                        <span className="truncate block max-w-[180px]" title={company.companyName}>
                          {company.companyName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <EngagementBadge score={company.engagementScore} leads={company.leads} />
                      </TableCell>
                      <TableCell className="text-right font-mono">{company.engagementScore.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{company.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{company.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{company.leads}</TableCell>
                      <TableCell className="text-right">${company.spend.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{company.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">${company.cpc.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${company.cpm.toFixed(2)}</TableCell>
                    </TableRow>
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
          {filteredCompanies.length > 100 && (
            <p className="text-sm text-muted-foreground mt-4 text-center">
              Showing first 100 of {filteredCompanies.length} companies. Export to see all.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Metadata */}
      {data?.metadata && (
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>Names resolved: {data.metadata.namesResolved}</span>
              <span>Names unresolved: {data.metadata.namesUnresolved}</span>
              <span>Campaigns analyzed: {data.metadata.totalCampaignsAnalyzed}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
