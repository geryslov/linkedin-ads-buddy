import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileBarChart, Users, Target, Building2, PieChart, Globe, Megaphone, FolderTree, List, Download } from 'lucide-react';
import { useCompanyIntelligence, LookbackWindow } from '@/hooks/useCompanyIntelligence';
import { useDemographicReporting, TimeFrameOption as DemoTimeFrameOption, TimeGranularity, DemographicPivot, DEMOGRAPHIC_PIVOT_OPTIONS } from '@/hooks/useDemographicReporting';
import { useCompanyDemographic, TimeFrameOption as CompanyDemoTimeFrameOption } from '@/hooks/useCompanyDemographic';
import { useCreativeReporting, TimeFrameOption as CreativeTimeFrameOption } from '@/hooks/useCreativeReporting';
import { useCreativeNamesReport, TimeFrameOption as CreativeNamesTimeFrameOption } from '@/hooks/useCreativeNamesReport';
import { useCampaignReporting, TimeFrameOption as CampaignTimeFrameOption } from '@/hooks/useCampaignReporting';
import { useAccountStructure } from '@/hooks/useAccountStructure';
import { CompanyIntelligenceTable } from './CompanyIntelligenceTable';
import { DemographicTable } from './DemographicTable';
import { CompanyDemographicTable } from './CompanyDemographicTable';
import { CreativeReportingTable } from './CreativeReportingTable';
import { CreativeNamesReportTable } from './CreativeNamesReportTable';
import { CampaignReportingTable } from './CampaignReportingTable';
import { AccountStructureTable } from './AccountStructureTable';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';
import { useToast } from '@/hooks/use-toast';
import { 
  exportToCSV, 
  creativeReportColumns, 
  creativeNamesReportColumns, 
  demographicReportColumns, 
  companyDemographicColumns, 
  companyIntelligenceColumns 
} from '@/lib/exportUtils';

interface ReportingSectionProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function ReportingSection({ accessToken, selectedAccount }: ReportingSectionProps) {
  const companyIntelligence = useCompanyIntelligence(accessToken);
  const demographicReporting = useDemographicReporting(accessToken);
  const companyDemographic = useCompanyDemographic(accessToken);
  const creativeReporting = useCreativeReporting(accessToken);
  const creativeNamesReport = useCreativeNamesReport(accessToken);
  const campaignReporting = useCampaignReporting(accessToken);
  const accountStructure = useAccountStructure(accessToken);
  const { toast } = useToast();

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('this_year');
  const [reportType, setReportType] = useState('creatives');

  const handleExportCSV = () => {
    let data: Record<string, any>[] = [];
    let filename = '';
    let columns: { key: string; label: string }[] = [];

    switch (reportType) {
      case 'creatives':
        data = creativeReporting.creativeData;
        filename = 'creative_performance';
        columns = creativeReportColumns;
        break;
      case 'creative_names':
        data = creativeNamesReport.creativeData;
        filename = 'creative_names_report';
        columns = creativeNamesReportColumns;
        break;
      case 'demographics':
        data = demographicReporting.demographicData;
        filename = `demographic_${demographicReporting.pivot.toLowerCase()}`;
        columns = demographicReportColumns;
        break;
      case 'company_demo':
        // Filter to only include companies with at least one non-zero metric
        data = companyDemographic.companyData.filter(item => 
          item.impressions > 0 || item.clicks > 0 || item.spent > 0 || item.leads > 0
        );
        filename = 'company_demographic';
        columns = companyDemographicColumns;
        break;
      case 'companies':
        data = companyIntelligence.companyData;
        filename = 'company_intelligence';
        columns = companyIntelligenceColumns;
        break;
      default:
        toast({
          title: 'Export not available',
          description: 'This report type does not support CSV export yet.',
          variant: 'destructive',
        });
        return;
    }

    if (data.length === 0) {
      toast({
        title: 'No data to export',
        description: 'Please load some data first before exporting.',
        variant: 'destructive',
      });
      return;
    }

    exportToCSV(data, filename, columns);
    toast({
      title: 'Export successful',
      description: `${data.length} rows exported to ${filename}.csv`,
    });
  };

  useEffect(() => {
    if (selectedAccount) {
      if (reportType === 'creatives') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
      } else if (reportType === 'creative_names') {
        creativeNamesReport.fetchCreativeNamesReport(selectedAccount);
      } else if (reportType === 'campaigns') {
        campaignReporting.fetchCampaignReport(selectedAccount);
      } else if (reportType === 'companies') {
        companyIntelligence.fetchCompanyIntelligence(selectedAccount);
      } else if (reportType === 'demographics') {
        demographicReporting.fetchDemographicAnalytics(selectedAccount);
      } else if (reportType === 'company_demo') {
        companyDemographic.fetchCompanyDemographic(selectedAccount);
      } else if (reportType === 'account_structure') {
        accountStructure.fetchAccountStructure(selectedAccount);
      }
    }
  }, [selectedAccount, reportType]);

  // Re-fetch when lookback window changes for companies
  useEffect(() => {
    if (selectedAccount && reportType === 'companies') {
      companyIntelligence.fetchCompanyIntelligence(selectedAccount);
    }
  }, [companyIntelligence.lookbackWindow]);

  // Re-fetch when time/granularity/pivot changes for demographics
  useEffect(() => {
    if (selectedAccount && reportType === 'demographics') {
      demographicReporting.fetchDemographicAnalytics(selectedAccount);
    }
  }, [demographicReporting.dateRange, demographicReporting.timeGranularity, demographicReporting.pivot]);

  // Re-fetch when time/granularity changes for company demographics
  useEffect(() => {
    if (selectedAccount && reportType === 'company_demo') {
      companyDemographic.fetchCompanyDemographic(selectedAccount);
    }
  }, [companyDemographic.dateRange, companyDemographic.timeGranularity]);

  // Re-fetch when time/granularity changes for creatives
  useEffect(() => {
    if (selectedAccount && reportType === 'creatives') {
      creativeReporting.fetchCreativeAnalytics(selectedAccount);
    }
  }, [creativeReporting.dateRange, creativeReporting.timeGranularity]);

  // Re-fetch when time/granularity changes for creative names report
  useEffect(() => {
    if (selectedAccount && reportType === 'creative_names') {
      creativeNamesReport.fetchCreativeNamesReport(selectedAccount);
    }
  }, [creativeNamesReport.dateRange, creativeNamesReport.timeGranularity]);

  // Re-fetch when time/granularity changes for campaigns
  useEffect(() => {
    if (selectedAccount && reportType === 'campaigns') {
      campaignReporting.fetchCampaignReport(selectedAccount);
    }
  }, [campaignReporting.dateRange, campaignReporting.timeGranularity]);

  const handleDemoTimeFrameChange = (option: DemoTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    demographicReporting.setTimeFrame(option);
  };

  const handleCompanyDemoTimeFrameChange = (option: CompanyDemoTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    companyDemographic.setTimeFrame(option);
  };

  const handleCreativeTimeFrameChange = (option: CreativeTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    creativeReporting.setTimeFrame(option);
  };

  const handleCreativeNamesTimeFrameChange = (option: CreativeNamesTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    creativeNamesReport.setTimeFrame(option);
  };

  const handleCampaignTimeFrameChange = (option: CampaignTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    campaignReporting.setTimeFrame(option);
  };

  // Custom date range handlers
  const handleCreativeCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    creativeReporting.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleCreativeNamesCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    creativeNamesReport.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleCampaignCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    campaignReporting.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleDemoCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    demographicReporting.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleCompanyDemoCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    companyDemographic.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      if (reportType === 'creatives') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
      } else if (reportType === 'creative_names') {
        creativeNamesReport.fetchCreativeNamesReport(selectedAccount);
      } else if (reportType === 'campaigns') {
        campaignReporting.fetchCampaignReport(selectedAccount);
      } else if (reportType === 'companies') {
        companyIntelligence.fetchCompanyIntelligence(selectedAccount);
      } else if (reportType === 'demographics') {
        demographicReporting.fetchDemographicAnalytics(selectedAccount);
      } else if (reportType === 'company_demo') {
        companyDemographic.fetchCompanyDemographic(selectedAccount);
      } else if (reportType === 'account_structure') {
        accountStructure.fetchAccountStructure(selectedAccount);
      }
    }
  };

  const isLoading = 
    reportType === 'creatives' ? creativeReporting.isLoading :
    reportType === 'creative_names' ? creativeNamesReport.isLoading :
    reportType === 'campaigns' ? campaignReporting.isLoading :
    reportType === 'companies' ? companyIntelligence.isLoading : 
    reportType === 'demographics' ? demographicReporting.isLoading : 
    reportType === 'company_demo' ? companyDemographic.isLoading : 
    reportType === 'account_structure' ? accountStructure.isLoading : false;

  // Calculate creative totals
  const creativeTotals = creativeReporting.totals;
  const creativeAvgCtr = creativeTotals.impressions > 0 
    ? ((creativeTotals.clicks / creativeTotals.impressions) * 100).toFixed(2) 
    : '0.00';
  const creativeAvgCpc = creativeTotals.clicks > 0 
    ? (creativeTotals.spent / creativeTotals.clicks).toFixed(2) 
    : '0.00';
  const creativeAvgCpm = creativeTotals.impressions > 0 
    ? ((creativeTotals.spent / creativeTotals.impressions) * 1000).toFixed(2) 
    : '0.00';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-muted-foreground">
            Analyze your ad performance across different dimensions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={isLoading || reportType === 'account_structure'}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="creatives" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Creatives
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="h-4 w-4" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="demographics" className="gap-2">
            <PieChart className="h-4 w-4" />
            Demographics
          </TabsTrigger>
          <TabsTrigger value="company_demo" className="gap-2">
            <Globe className="h-4 w-4" />
            New Company Demographic
          </TabsTrigger>
          <TabsTrigger value="creative_names" className="gap-2">
            <List className="h-4 w-4" />
            Creative Names
          </TabsTrigger>
          <TabsTrigger value="account_structure" className="gap-2">
            <FolderTree className="h-4 w-4" />
            Account Structure
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-2" disabled>
            <Users className="h-4 w-4" />
            Audiences
            <span className="text-xs text-muted-foreground">(Soon)</span>
          </TabsTrigger>
        </TabsList>

        {/* Creatives Tab */}
        <TabsContent value="creatives" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={creativeReporting.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCreativeTimeFrameChange}
                timeGranularity={creativeReporting.timeGranularity as TimeGranularity}
                onGranularityChange={(g: TimeGranularity) => creativeReporting.setTimeGranularity(g as any)}
                dateRange={creativeReporting.dateRange}
                onCustomDateChange={handleCreativeCustomDate}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard
              title="Impressions"
              value={creativeTotals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Clicks"
              value={creativeTotals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Spent"
              value={`$${creativeTotals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={creativeTotals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="CTR"
              value={`${creativeAvgCtr}%`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPC"
              value={`$${creativeAvgCpc}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPM"
              value={`$${creativeAvgCpm}`}
              icon={FileBarChart}
            />
          </div>

          {creativeReporting.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  <strong>Note:</strong> {creativeReporting.error}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Creative Performance
              </CardTitle>
              <CardDescription>
                Performance metrics by creative name with campaign attribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeReportingTable data={creativeReporting.creativeData} isLoading={creativeReporting.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creative Names Tab */}
        <TabsContent value="creative_names" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={creativeNamesReport.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCreativeNamesTimeFrameChange}
                timeGranularity={creativeNamesReport.timeGranularity as TimeGranularity}
                onGranularityChange={(g: TimeGranularity) => creativeNamesReport.setTimeGranularity(g as any)}
                dateRange={creativeNamesReport.dateRange}
                onCustomDateChange={handleCreativeNamesCustomDate}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard
              title="Impressions"
              value={creativeNamesReport.totals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Clicks"
              value={creativeNamesReport.totals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Spent"
              value={`$${creativeNamesReport.totals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={creativeNamesReport.totals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="CTR"
              value={`${creativeNamesReport.totals.impressions > 0 ? ((creativeNamesReport.totals.clicks / creativeNamesReport.totals.impressions) * 100).toFixed(2) : '0.00'}%`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPC"
              value={`$${creativeNamesReport.totals.clicks > 0 ? (creativeNamesReport.totals.spent / creativeNamesReport.totals.clicks).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPL"
              value={`$${creativeNamesReport.totals.leads > 0 ? (creativeNamesReport.totals.spent / creativeNamesReport.totals.leads).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
          </div>

          {creativeNamesReport.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  <strong>Note:</strong> {creativeNamesReport.error}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                Creative Names Report
              </CardTitle>
              <CardDescription>
                All creatives with performance metrics, status filtering, and time frame selection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeNamesReportTable data={creativeNamesReport.creativeData} isLoading={creativeNamesReport.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Time Period:</span>
                  <Select 
                    value={companyIntelligence.lookbackWindow} 
                    onValueChange={(v) => companyIntelligence.setLookbackWindow(v as LookbackWindow)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LAST_7_DAYS">Last 7 Days</SelectItem>
                      <SelectItem value="LAST_30_DAYS">Last 30 Days</SelectItem>
                      <SelectItem value="LAST_60_DAYS">Last 60 Days</SelectItem>
                      <SelectItem value="LAST_90_DAYS">Last 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard
              title="Paid Impressions"
              value={companyIntelligence.totals.paidImpressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Paid Clicks"
              value={companyIntelligence.totals.paidClicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={companyIntelligence.totals.paidLeads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Paid Engagements"
              value={companyIntelligence.totals.paidEngagements.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Organic Impressions"
              value={companyIntelligence.totals.organicImpressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Organic Engagements"
              value={companyIntelligence.totals.organicEngagements.toLocaleString()}
              icon={FileBarChart}
            />
          </div>

          {companyIntelligence.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  <strong>Note:</strong> {companyIntelligence.error}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  The Company Intelligence API requires special provisioning from LinkedIn. 
                  Please submit a request through the LinkedIn Developer Portal if you need access.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Engagement
              </CardTitle>
              <CardDescription>
                Company-level engagement data showing which companies have interacted with your ads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyIntelligenceTable 
                data={companyIntelligence.companyData} 
                isLoading={companyIntelligence.isLoading} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Pivot By:</span>
                  <Select 
                    value={demographicReporting.pivot} 
                    onValueChange={(v) => demographicReporting.setPivot(v as DemographicPivot)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEMOGRAPHIC_PIVOT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TimeFrameSelector
                  timeFrameOptions={demographicReporting.timeFrameOptions}
                  selectedTimeFrame={selectedTimeFrame}
                  onTimeFrameChange={handleDemoTimeFrameChange}
                  timeGranularity={demographicReporting.timeGranularity as TimeGranularity}
                  onGranularityChange={(g: TimeGranularity) => demographicReporting.setTimeGranularity(g as any)}
                  dateRange={demographicReporting.dateRange}
                  onCustomDateChange={handleDemoCustomDate}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard
              title="Impressions"
              value={demographicReporting.totals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Clicks"
              value={demographicReporting.totals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Spent"
              value={`$${demographicReporting.totals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={demographicReporting.totals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CTR"
              value={`${demographicReporting.totals.impressions > 0 ? ((demographicReporting.totals.clicks / demographicReporting.totals.impressions) * 100).toFixed(2) : '0.00'}%`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CPC"
              value={`$${demographicReporting.totals.clicks > 0 ? (demographicReporting.totals.spent / demographicReporting.totals.clicks).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CPM"
              value={`$${demographicReporting.totals.impressions > 0 ? ((demographicReporting.totals.spent / demographicReporting.totals.impressions) * 1000).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
          </div>

          {demographicReporting.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  <strong>Note:</strong> {demographicReporting.error}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  The MEMBER_COMPANY demographic pivot may require additional permissions or may not be available for all accounts.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Demographic Analytics
              </CardTitle>
              <CardDescription>
                Ad performance breakdown by {DEMOGRAPHIC_PIVOT_OPTIONS.find(o => o.value === demographicReporting.pivot)?.label || 'demographic'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DemographicTable 
                data={demographicReporting.demographicData} 
                isLoading={demographicReporting.isLoading}
                pivot={demographicReporting.pivot}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Company Demographic Tab */}
        <TabsContent value="company_demo" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={companyDemographic.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCompanyDemoTimeFrameChange}
                timeGranularity={companyDemographic.timeGranularity as TimeGranularity}
                onGranularityChange={(g: TimeGranularity) => companyDemographic.setTimeGranularity(g as any)}
                dateRange={companyDemographic.dateRange}
                onCustomDateChange={handleCompanyDemoCustomDate}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard
              title="Impressions"
              value={companyDemographic.totals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Clicks"
              value={companyDemographic.totals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Spent"
              value={`$${companyDemographic.totals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={companyDemographic.totals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CTR"
              value={`${companyDemographic.totals.impressions > 0 ? ((companyDemographic.totals.clicks / companyDemographic.totals.impressions) * 100).toFixed(2) : '0.00'}%`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CPC"
              value={`$${companyDemographic.totals.clicks > 0 ? (companyDemographic.totals.spent / companyDemographic.totals.clicks).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CPM"
              value={`$${companyDemographic.totals.impressions > 0 ? ((companyDemographic.totals.spent / companyDemographic.totals.impressions) * 1000).toFixed(2) : '0.00'}`}
              icon={FileBarChart}
            />
          </div>

          {companyDemographic.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive">
                  <strong>Note:</strong> {companyDemographic.error}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Company Demographic with Website Enrichment
              </CardTitle>
              <CardDescription>
                Company-level ad performance with enriched website URLs from LinkedIn organization data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyDemographicTable 
                data={companyDemographic.companyData} 
                isLoading={companyDemographic.isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coming Soon Tabs */}
        <TabsContent value="campaigns" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Campaign Reports Coming Soon</h3>
              <p className="text-muted-foreground">
                Campaign-level analytics and performance tracking will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Structure Tab */}
        <TabsContent value="account_structure" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5 text-primary" />
                Account Hierarchy
              </CardTitle>
              <CardDescription>
                View your complete account structure: Campaign Groups → Campaigns → Creatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accountStructure.error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                  <p className="text-sm text-destructive">{accountStructure.error}</p>
                </div>
              )}
              <AccountStructureTable 
                data={accountStructure.structure} 
                isLoading={accountStructure.isLoading} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={campaignReporting.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCampaignTimeFrameChange}
                timeGranularity={campaignReporting.timeGranularity as TimeGranularity}
                onGranularityChange={(g: TimeGranularity) => campaignReporting.setTimeGranularity(g as any)}
                dateRange={campaignReporting.dateRange}
                onCustomDateChange={handleCampaignCustomDate}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard title="Impressions" value={campaignReporting.totals.impressions.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Clicks" value={campaignReporting.totals.clicks.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Spent" value={`$${campaignReporting.totals.spent.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="Leads" value={campaignReporting.totals.leads.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="CTR" value={`${campaignReporting.totals.impressions > 0 ? ((campaignReporting.totals.clicks / campaignReporting.totals.impressions) * 100).toFixed(2) : '0.00'}%`} icon={FileBarChart} />
            <MetricCard title="CPC" value={`$${campaignReporting.totals.clicks > 0 ? (campaignReporting.totals.spent / campaignReporting.totals.clicks).toFixed(2) : '0.00'}`} icon={FileBarChart} />
            <MetricCard title="CPM" value={`$${campaignReporting.totals.impressions > 0 ? ((campaignReporting.totals.spent / campaignReporting.totals.impressions) * 1000).toFixed(2) : '0.00'}`} icon={FileBarChart} />
          </div>

          {campaignReporting.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive"><strong>Note:</strong> {campaignReporting.error}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Campaign Performance
              </CardTitle>
              <CardDescription>
                Performance metrics by campaign with objective type and status filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignReportingTable data={campaignReporting.campaignData} isLoading={campaignReporting.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audiences" className="mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Audience Reports Coming Soon</h3>
              <p className="text-muted-foreground">
                Audience insights and segment analysis will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
