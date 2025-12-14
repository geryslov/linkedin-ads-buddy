import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, FileBarChart, Image, Users, Target, Megaphone } from 'lucide-react';
import { useCreativeReporting, TimeFrameOption } from '@/hooks/useCreativeReporting';
import { useAdReporting, TimeFrameOption as AdTimeFrameOption } from '@/hooks/useAdReporting';
import { CreativeReportingTable } from './CreativeReportingTable';
import { AdReportingTable } from './AdReportingTable';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';

interface ReportingSectionProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function ReportingSection({ accessToken, selectedAccount }: ReportingSectionProps) {
  const creativeReporting = useCreativeReporting(accessToken);
  const adReporting = useAdReporting(accessToken);

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');
  const [reportType, setReportType] = useState('ads');

  useEffect(() => {
    if (selectedAccount) {
      if (reportType === 'creatives') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
      } else if (reportType === 'ads') {
        adReporting.fetchAdAnalytics(selectedAccount);
      }
    }
  }, [selectedAccount, reportType]);

  // Re-fetch when time/granularity changes for creatives
  useEffect(() => {
    if (selectedAccount && reportType === 'creatives') {
      creativeReporting.fetchCreativeAnalytics(selectedAccount);
    }
  }, [creativeReporting.dateRange, creativeReporting.timeGranularity]);

  // Re-fetch when time/granularity changes for ads
  useEffect(() => {
    if (selectedAccount && reportType === 'ads') {
      adReporting.fetchAdAnalytics(selectedAccount);
    }
  }, [adReporting.dateRange, adReporting.timeGranularity]);

  const handleCreativeTimeFrameChange = (option: TimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    creativeReporting.setTimeFrame(option);
  };

  const handleAdTimeFrameChange = (option: AdTimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    adReporting.setTimeFrame(option);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      if (reportType === 'creatives') {
        creativeReporting.fetchCreativeAnalytics(selectedAccount);
      } else if (reportType === 'ads') {
        adReporting.fetchAdAnalytics(selectedAccount);
      }
    }
  };

  const isLoading = reportType === 'creatives' ? creativeReporting.isLoading : adReporting.isLoading;

  // Calculate summary metrics for creatives
  const creativeTotals = creativeReporting.aggregatedData.reduce(
    (acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }),
    { impressions: 0, clicks: 0, spent: 0, leads: 0 }
  );

  const creativeAvgCtr = creativeTotals.impressions > 0 
    ? ((creativeTotals.clicks / creativeTotals.impressions) * 100).toFixed(2) 
    : '0.00';

  // Calculate summary metrics for ads
  const adTotals = adReporting.aggregatedData.reduce(
    (acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }),
    { impressions: 0, clicks: 0, spent: 0, leads: 0 }
  );

  const adAvgCtr = adTotals.impressions > 0 
    ? ((adTotals.clicks / adTotals.impressions) * 100).toFixed(2) 
    : '0.00';

  const adAvgCpc = adTotals.clicks > 0 
    ? (adTotals.spent / adTotals.clicks).toFixed(2) 
    : '0.00';

  const adAvgCpm = adTotals.impressions > 0 
    ? ((adTotals.spent / adTotals.impressions) * 1000).toFixed(2) 
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
          <TabsTrigger value="ads" className="gap-2">
            <Megaphone className="h-4 w-4" />
            Ads
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-2">
            <Image className="h-4 w-4" />
            Creatives
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

        {/* Ads Tab */}
        <TabsContent value="ads" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={adReporting.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleAdTimeFrameChange}
                timeGranularity={adReporting.timeGranularity}
                onGranularityChange={adReporting.setTimeGranularity}
                dateRange={adReporting.dateRange}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <MetricCard
              title="Impressions"
              value={adTotals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Clicks"
              value={adTotals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Spent"
              value={`$${adTotals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Leads"
              value={adTotals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="CTR"
              value={`${adAvgCtr}%`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPC"
              value={`$${adAvgCpc}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="CPM"
              value={`$${adAvgCpm}`}
              icon={FileBarChart}
            />
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                Ad Performance
              </CardTitle>
              <CardDescription>
                Performance metrics by ad name with campaign attribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdReportingTable data={adReporting.aggregatedData} isLoading={adReporting.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Creatives Tab */}
        <TabsContent value="creatives" className="space-y-6 mt-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={creativeReporting.timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleCreativeTimeFrameChange}
                timeGranularity={creativeReporting.timeGranularity}
                onGranularityChange={creativeReporting.setTimeGranularity}
                dateRange={creativeReporting.dateRange}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              title="Total Impressions"
              value={creativeTotals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Clicks"
              value={creativeTotals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Spent"
              value={`$${creativeTotals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Leads"
              value={creativeTotals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CTR"
              value={`${creativeAvgCtr}%`}
              icon={FileBarChart}
            />
          </div>

          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Creative Performance
              </CardTitle>
              <CardDescription>
                Aggregated performance data by creative name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreativeReportingTable data={creativeReporting.aggregatedData} isLoading={creativeReporting.isLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
