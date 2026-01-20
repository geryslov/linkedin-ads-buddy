import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileBarChart, Users, Target, PieChart, Globe, List, Download, Grid3X3, Settings, CheckCircle2, XCircle, Loader2, ClipboardList, Search, Pencil } from 'lucide-react';
import { useDemographicReporting, TimeFrameOption as DemoTimeFrameOption, TimeGranularity, DemographicPivot, DEMOGRAPHIC_PIVOT_OPTIONS } from '@/hooks/useDemographicReporting';
import { useCompanyDemographic, TimeFrameOption as CompanyDemoTimeFrameOption } from '@/hooks/useCompanyDemographic';
import { useCreativeNamesReport, TimeFrameOption as CreativeNamesTimeFrameOption } from '@/hooks/useCreativeNamesReport';
import { useCampaignReporting, TimeFrameOption as CampaignTimeFrameOption } from '@/hooks/useCampaignReporting';
import { useJobSeniorityMatrix, TimeFrameOption as MatrixTimeFrameOption } from '@/hooks/useJobSeniorityMatrix';
import { useLeadGenFormsReport, TimeFrameOption as LeadGenTimeFrameOption } from '@/hooks/useLeadGenFormsReport';
import { DemographicTable } from './DemographicTable';
import { CompanyDemographicTable } from './CompanyDemographicTable';
import { CreativeNamesReportTable } from './CreativeNamesReportTable';
import { CampaignReportingTable } from './CampaignReportingTable';
import { JobSeniorityMatrix } from './JobSeniorityMatrix';
import { JobFunctionTitlesDrawer } from './JobFunctionTitlesDrawer';
import { LeadGenFormsTable } from './LeadGenFormsTable';
import { CampaignMultiSelect } from './CampaignMultiSelect';
import { JobTitleSearch } from './JobTitleSearch';
import { SkillSearch } from './SkillSearch';
import { CampaignTargetingEditor } from './CampaignTargetingEditor';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';
import { useToast } from '@/hooks/use-toast';
import { 
  exportToCSV, 
  creativeNamesReportColumns, 
  demographicReportColumns, 
  companyDemographicColumns,
  jobSeniorityMatrixColumns
} from '@/lib/exportUtils';
import { supabase } from '@/integrations/supabase/client';

interface ReportingSectionProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function ReportingSection({ accessToken, selectedAccount }: ReportingSectionProps) {
  const demographicReporting = useDemographicReporting(accessToken);
  const companyDemographic = useCompanyDemographic(accessToken);
  const creativeNamesReport = useCreativeNamesReport(accessToken);
  const campaignReporting = useCampaignReporting(accessToken);
  const jobSeniorityMatrix = useJobSeniorityMatrix(accessToken);
  const leadGenForms = useLeadGenFormsReport(accessToken);
  const { toast } = useToast();

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('last_7_days');
  const [reportType, setReportType] = useState('campaigns');
  
  // Titles API status
  const [titlesApiStatus, setTitlesApiStatus] = useState<'unknown' | 'enabled' | 'disabled'>('unknown');
  const [titlesApiTesting, setTitlesApiTesting] = useState(false);
  const [titlesApiMessage, setTitlesApiMessage] = useState<string | null>(null);

  const handleExportCSV = () => {
    let data: Record<string, any>[] = [];
    let filename = '';
    let columns: { key: string; label: string }[] = [];

    switch (reportType) {
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
        data = companyDemographic.companyData.filter(item => 
          item.impressions > 0 || item.clicks > 0 || item.spent > 0 || item.leads > 0
        );
        filename = 'company_demographic';
        columns = companyDemographicColumns;
        break;
      case 'job_seniority':
        if (jobSeniorityMatrix.matrixData) {
          data = Array.from(jobSeniorityMatrix.matrixData.cells.values());
          filename = 'job_seniority_matrix';
          columns = jobSeniorityMatrixColumns;
        }
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
      if (reportType === 'creative_names') {
        creativeNamesReport.fetchCreativeNamesReport(selectedAccount);
      } else if (reportType === 'campaigns') {
        campaignReporting.fetchCampaignReport(selectedAccount);
        campaignReporting.fetchDailySpendData(selectedAccount);
      } else if (reportType === 'demographics') {
        demographicReporting.fetchDemographicAnalytics(selectedAccount);
        // Also fetch campaigns for the filter if not already loaded
        if (campaignReporting.campaignData.length === 0) {
          campaignReporting.fetchCampaignReport(selectedAccount);
        }
      } else if (reportType === 'company_demo') {
        companyDemographic.fetchCompanyDemographic(selectedAccount);
        // Also fetch campaigns for the filter if not already loaded
        if (campaignReporting.campaignData.length === 0) {
          campaignReporting.fetchCampaignReport(selectedAccount);
        }
      } else if (reportType === 'job_seniority') {
        jobSeniorityMatrix.fetchMatrix(selectedAccount);
        // Also fetch campaigns for the filter if not already loaded
        if (campaignReporting.campaignData.length === 0) {
          campaignReporting.fetchCampaignReport(selectedAccount);
        }
      } else if (reportType === 'lead_gen_forms') {
        leadGenForms.fetchLeadGenForms(selectedAccount);
        // Also fetch campaigns for the filter if not already loaded
        if (campaignReporting.campaignData.length === 0) {
          campaignReporting.fetchCampaignReport(selectedAccount);
        }
      }
    }
  }, [selectedAccount, reportType]);

  // Re-fetch when time/granularity/pivot/campaigns changes for demographics
  useEffect(() => {
    if (selectedAccount && reportType === 'demographics') {
      demographicReporting.fetchDemographicAnalytics(selectedAccount);
    }
  }, [demographicReporting.dateRange, demographicReporting.timeGranularity, demographicReporting.pivot, demographicReporting.selectedCampaignIds]);

  // Re-fetch when time/granularity/campaigns changes for company demographics
  useEffect(() => {
    if (selectedAccount && reportType === 'company_demo') {
      companyDemographic.fetchCompanyDemographic(selectedAccount);
    }
  }, [companyDemographic.dateRange, companyDemographic.timeGranularity, companyDemographic.selectedCampaignIds]);

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

  // Re-fetch when time or campaigns change for job x seniority matrix
  useEffect(() => {
    if (selectedAccount && reportType === 'job_seniority') {
      jobSeniorityMatrix.fetchMatrix(selectedAccount);
    }
  }, [jobSeniorityMatrix.dateRange, jobSeniorityMatrix.selectedCampaignIds]);

  // Re-fetch when time or campaigns change for lead gen forms
  useEffect(() => {
    if (selectedAccount && reportType === 'lead_gen_forms') {
      leadGenForms.fetchLeadGenForms(selectedAccount);
    }
  }, [leadGenForms.dateRange, leadGenForms.selectedCampaignIds]);

  const handleDemoTimeFrameChange = (option: DemoTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    demographicReporting.setTimeFrame(option);
  };

  const handleCompanyDemoTimeFrameChange = (option: CompanyDemoTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    companyDemographic.setTimeFrame(option);
  };

  const handleCreativeNamesTimeFrameChange = (option: CreativeNamesTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    creativeNamesReport.setTimeFrame(option);
  };

  const handleCampaignTimeFrameChange = (option: CampaignTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    campaignReporting.setTimeFrame(option);
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

  const handleMatrixTimeFrameChange = (option: MatrixTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    jobSeniorityMatrix.setTimeFrame(option);
  };

  const handleMatrixCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    jobSeniorityMatrix.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      if (reportType === 'creative_names') {
        creativeNamesReport.fetchCreativeNamesReport(selectedAccount);
      } else if (reportType === 'campaigns') {
        campaignReporting.fetchCampaignReport(selectedAccount);
      } else if (reportType === 'demographics') {
        demographicReporting.fetchDemographicAnalytics(selectedAccount);
      } else if (reportType === 'company_demo') {
        companyDemographic.fetchCompanyDemographic(selectedAccount);
      } else if (reportType === 'job_seniority') {
        jobSeniorityMatrix.fetchMatrix(selectedAccount);
      } else if (reportType === 'lead_gen_forms') {
        leadGenForms.fetchLeadGenForms(selectedAccount);
      }
    }
  };

  const handleTestTitlesApi = async () => {
    if (!accessToken) {
      toast({ title: 'No access token', description: 'Please connect to LinkedIn first.', variant: 'destructive' });
      return;
    }
    
    setTitlesApiTesting(true);
    setTitlesApiMessage(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { action: 'test_titles_api', accessToken }
      });
      
      if (error) {
        setTitlesApiStatus('disabled');
        setTitlesApiMessage(`Error: ${error.message}`);
      } else if (data.titlesApiEnabled) {
        setTitlesApiStatus('enabled');
        setTitlesApiMessage(data.message);
      } else {
        setTitlesApiStatus('disabled');
        setTitlesApiMessage(data.message);
      }
    } catch (err) {
      setTitlesApiStatus('disabled');
      setTitlesApiMessage(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTitlesApiTesting(false);
    }
  };

  const isLoading = 
    reportType === 'creative_names' ? creativeNamesReport.isLoading :
    reportType === 'campaigns' ? campaignReporting.isLoading :
    reportType === 'demographics' ? demographicReporting.isLoading : 
    reportType === 'company_demo' ? companyDemographic.isLoading :
    reportType === 'job_seniority' ? jobSeniorityMatrix.isLoading :
    reportType === 'lead_gen_forms' ? leadGenForms.isLoading : false;

  const handleLeadGenTimeFrameChange = (option: LeadGenTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    leadGenForms.setTimeFrame(option);
  };

  const handleLeadGenCustomDate = (start: Date, end: Date) => {
    setSelectedTimeFrame('custom');
    leadGenForms.setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

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
            disabled={isLoading}
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
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="creative_names" className="gap-2">
            <List className="h-4 w-4" />
            Creative Names
          </TabsTrigger>
          <TabsTrigger value="demographics" className="gap-2">
            <PieChart className="h-4 w-4" />
            Demographics
          </TabsTrigger>
          <TabsTrigger value="company_demo" className="gap-2">
            <Globe className="h-4 w-4" />
            Company Demographic
          </TabsTrigger>
          <TabsTrigger value="job_seniority" className="gap-2">
            <Grid3X3 className="h-4 w-4" />
            Job × Seniority
          </TabsTrigger>
          <TabsTrigger value="lead_gen_forms" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Lead Gen Forms
          </TabsTrigger>
          <TabsTrigger value="targeting_tools" className="gap-2">
            <Search className="h-4 w-4" />
            Targeting Tools
          </TabsTrigger>
          <TabsTrigger value="campaign_editor" className="gap-2">
            <Pencil className="h-4 w-4" />
            Campaign Editor
          </TabsTrigger>
          <TabsTrigger value="audiences" className="gap-2" disabled>
            <Users className="h-4 w-4" />
            Audiences
            <span className="text-xs text-muted-foreground">(Soon)</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

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

          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-4">
            <MetricCard title="Impressions" value={campaignReporting.totals.impressions.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Clicks" value={campaignReporting.totals.clicks.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Spent" value={`$${campaignReporting.totals.spent.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="Leads" value={campaignReporting.totals.leads.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="CTR" value={`${campaignReporting.totals.impressions > 0 ? ((campaignReporting.totals.clicks / campaignReporting.totals.impressions) * 100).toFixed(2) : '0.00'}%`} icon={FileBarChart} />
            <MetricCard title="CPC" value={`$${campaignReporting.totals.clicks > 0 ? (campaignReporting.totals.spent / campaignReporting.totals.clicks).toFixed(2) : '0.00'}`} icon={FileBarChart} />
            <MetricCard title="CPM" value={`$${campaignReporting.totals.impressions > 0 ? ((campaignReporting.totals.spent / campaignReporting.totals.impressions) * 1000).toFixed(2) : '0.00'}`} icon={FileBarChart} />
            <MetricCard title="CPL" value={`$${campaignReporting.totals.leads > 0 ? (campaignReporting.totals.spent / campaignReporting.totals.leads).toFixed(2) : '0.00'}`} icon={FileBarChart} />
            <MetricCard title="Avg Daily (2d)" value={`$${campaignReporting.dailySpendAverages.avgLast2Days.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="Avg Daily (7d)" value={`$${campaignReporting.dailySpendAverages.avgLast7Days.toFixed(2)}`} icon={FileBarChart} />
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

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4 space-y-4">
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
              <CampaignMultiSelect
                campaigns={campaignReporting.campaignData}
                selectedCampaignIds={demographicReporting.selectedCampaignIds}
                onSelectionChange={demographicReporting.setSelectedCampaignIds}
                isLoading={campaignReporting.isLoading}
              />
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
            <CardContent className="pt-4 space-y-4">
              <TimeFrameSelector
                timeFrameOptions={companyDemographic.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCompanyDemoTimeFrameChange}
                timeGranularity={companyDemographic.timeGranularity as TimeGranularity}
                onGranularityChange={(g: TimeGranularity) => companyDemographic.setTimeGranularity(g as any)}
                dateRange={companyDemographic.dateRange}
                onCustomDateChange={handleCompanyDemoCustomDate}
              />
              <div className="border-t pt-4">
                <CampaignMultiSelect
                  campaigns={campaignReporting.campaignData}
                  selectedCampaignIds={companyDemographic.selectedCampaignIds}
                  onSelectionChange={companyDemographic.setSelectedCampaignIds}
                  isLoading={campaignReporting.isLoading}
                />
              </div>
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

        {/* Job x Seniority Matrix Tab */}
        <TabsContent value="job_seniority" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4 space-y-4">
              <TimeFrameSelector
                timeFrameOptions={jobSeniorityMatrix.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleMatrixTimeFrameChange}
                timeGranularity="ALL"
                onGranularityChange={() => {}}
                dateRange={jobSeniorityMatrix.dateRange}
                onCustomDateChange={handleMatrixCustomDate}
              />
              <div className="border-t pt-4">
                <CampaignMultiSelect
                  campaigns={campaignReporting.campaignData}
                  selectedCampaignIds={jobSeniorityMatrix.selectedCampaignIds}
                  onSelectionChange={jobSeniorityMatrix.setSelectedCampaignIds}
                  isLoading={campaignReporting.isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard title="Impressions" value={jobSeniorityMatrix.totals.impressions.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Clicks" value={jobSeniorityMatrix.totals.clicks.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Spent" value={`$${jobSeniorityMatrix.totals.spent.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="Leads" value={jobSeniorityMatrix.totals.leads.toLocaleString()} icon={FileBarChart} />
          </div>

          {jobSeniorityMatrix.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive"><strong>Note:</strong> {jobSeniorityMatrix.error}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-primary" />
                Job Function × Seniority Matrix
              </CardTitle>
              <CardDescription>
                Heatmap showing performance across job functions and seniority levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <JobSeniorityMatrix
                matrixData={jobSeniorityMatrix.matrixData}
                isLoading={jobSeniorityMatrix.isLoading}
                selectedMetric={jobSeniorityMatrix.selectedMetric}
                onMetricChange={jobSeniorityMatrix.setSelectedMetric}
                onFunctionClick={(urn, label) => {
                  if (selectedAccount) {
                    jobSeniorityMatrix.fetchTitleDrilldown(selectedAccount, urn, label);
                  }
                }}
              />
            </CardContent>
          </Card>

          {/* Job Function Titles Drawer */}
          <JobFunctionTitlesDrawer
            open={!!jobSeniorityMatrix.expandedFunction}
            onClose={jobSeniorityMatrix.closeTitleDrilldown}
            data={jobSeniorityMatrix.titleData}
            isLoading={jobSeniorityMatrix.isTitleLoading}
            error={jobSeniorityMatrix.titleError}
          />
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

        {/* Lead Gen Forms Tab */}
        <TabsContent value="lead_gen_forms" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <TimeFrameSelector
                    timeFrameOptions={leadGenForms.timeFrameOptions}
                    selectedTimeFrame={selectedTimeFrame}
                    onTimeFrameChange={handleLeadGenTimeFrameChange}
                    timeGranularity="ALL"
                    onGranularityChange={() => {}}
                    dateRange={leadGenForms.dateRange}
                    onCustomDateChange={handleLeadGenCustomDate}
                  />
                </div>
                <div className="w-full md:w-80">
                  <CampaignMultiSelect
                    campaigns={campaignReporting.campaignData}
                    selectedCampaignIds={leadGenForms.selectedCampaignIds}
                    onSelectionChange={leadGenForms.setSelectedCampaignIds}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard title="Forms" value={leadGenForms.formsData.length.toString()} icon={ClipboardList} />
            <MetricCard title="Leads" value={leadGenForms.totals.leads.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Form Opens" value={leadGenForms.totals.formOpens.toLocaleString()} icon={FileBarChart} />
            <MetricCard title="Spent" value={`$${leadGenForms.totals.spent.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="CPL" value={`$${leadGenForms.totals.cpl.toFixed(2)}`} icon={FileBarChart} />
            <MetricCard title="LGF Rate" value={`${leadGenForms.totals.lgfRate.toFixed(1)}%`} icon={FileBarChart} />
            <MetricCard title="CTR" value={`${leadGenForms.totals.ctr.toFixed(2)}%`} icon={FileBarChart} />
            <MetricCard title="CPC" value={`$${leadGenForms.totals.cpc.toFixed(2)}`} icon={FileBarChart} />
          </div>

          {leadGenForms.error && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-4">
                <p className="text-sm text-destructive"><strong>Note:</strong> {leadGenForms.error}</p>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Lead Gen Form Performance
              </CardTitle>
              <CardDescription>
                Performance by lead gen form with connected creatives breakdown. Click a row to expand.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LeadGenFormsTable data={leadGenForms.formsData} isLoading={leadGenForms.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Targeting Tools Tab */}
        <TabsContent value="targeting_tools" className="space-y-6 mt-6">
          <div className="space-y-2 mb-6">
            <h3 className="text-lg font-semibold">Targeting Discovery Tools</h3>
            <p className="text-sm text-muted-foreground">
              Search and verify LinkedIn targeting entities for your ad campaigns
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <JobTitleSearch accessToken={accessToken} selectedAccount={selectedAccount} />
            <SkillSearch accessToken={accessToken} selectedAccount={selectedAccount} />
          </div>
        </TabsContent>

        {/* Campaign Editor Tab */}
        <TabsContent value="campaign_editor" className="space-y-6 mt-6">
          <CampaignTargetingEditor
            accessToken={accessToken}
            selectedAccount={selectedAccount}
            campaigns={campaignReporting.campaignData.map(c => ({
              id: c.campaignId,
              name: c.campaignName,
              status: c.status,
            }))}
            onRefreshCampaigns={() => {
              if (selectedAccount) {
                campaignReporting.fetchCampaignReport(selectedAccount);
              }
            }}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                API Settings
              </CardTitle>
              <CardDescription>
                Test API access and configure feature flags
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Titles API Test */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">LinkedIn Titles API</h4>
                    <p className="text-sm text-muted-foreground">
                      Test access to the Standardized Titles API for resolving job title IDs
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {titlesApiStatus === 'enabled' && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        Enabled
                      </span>
                    )}
                    {titlesApiStatus === 'disabled' && (
                      <span className="flex items-center gap-1 text-sm text-destructive">
                        <XCircle className="h-4 w-4" />
                        Disabled (Using fallback)
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestTitlesApi}
                      disabled={titlesApiTesting || !accessToken}
                    >
                      {titlesApiTesting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test API Access'
                      )}
                    </Button>
                  </div>
                </div>
                
                {titlesApiMessage && (
                  <div className={`text-sm p-3 rounded-md ${
                    titlesApiStatus === 'enabled' 
                      ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {titlesApiMessage}
                  </div>
                )}
                
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Endpoint:</strong> GET https://api.linkedin.com/v2/standardizedTitles</p>
                  <p><strong>Query params:</strong> q=criteria, name=Engineer</p>
                  <p><strong>Headers:</strong> X-Restli-Protocol-Version: 2.0.0, LinkedIn-Version: 202511</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
