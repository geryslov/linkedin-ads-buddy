import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, FileBarChart, Users, Target, Building2, PieChart, Globe, Megaphone, FolderTree, List } from 'lucide-react';
import { useCompanyIntelligence, LookbackWindow } from '@/hooks/useCompanyIntelligence';
import { useDemographicReporting, TimeFrameOption as DemoTimeFrameOption, TimeGranularity, DemographicPivot, DEMOGRAPHIC_PIVOT_OPTIONS } from '@/hooks/useDemographicReporting';
import { useCompanyDemographic, TimeFrameOption as CompanyDemoTimeFrameOption } from '@/hooks/useCompanyDemographic';
import { useCreativeReporting, TimeFrameOption as CreativeTimeFrameOption } from '@/hooks/useCreativeReporting';
import { useAccountStructure } from '@/hooks/useAccountStructure';
import { CompanyIntelligenceTable } from './CompanyIntelligenceTable';
import { DemographicTable } from './DemographicTable';
import { CompanyDemographicTable } from './CompanyDemographicTable';
import { CreativeReportingTable } from './CreativeReportingTable';
import { CreativeNameListTable } from './CreativeNameListTable';
import { AccountStructureTable } from './AccountStructureTable';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';

interface ReportingSectionProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function ReportingSection({ accessToken, selectedAccount }: ReportingSectionProps) {
  const companyIntelligence = useCompanyIntelligence(accessToken);
  const demographicReporting = useDemographicReporting(accessToken);
  const companyDemographic = useCompanyDemographic(accessToken);
  const creativeReporting = useCreativeReporting(accessToken);
  const accountStructure = useAccountStructure(accessToken);

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');
  const [reportType, setReportType] = useState('creatives');

  useEffect(() => {
    if (selectedAccount) {
      if (reportType === 'creatives' || reportType === 'creative_names') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
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

  const handleRefresh = () => {
    if (selectedAccount) {
      if (reportType === 'creatives') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
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
          <TabsTrigger value="campaigns" className="gap-2" disabled>
            <Target className="h-4 w-4" />
            Campaigns
            <span className="text-xs text-muted-foreground">(Soon)</span>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                Creative Names List
              </CardTitle>
              <CardDescription>
                A searchable list of all creative names in your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeNameListTable data={creativeReporting.creativeData} isLoading={creativeReporting.isLoading} />
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
