import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, FileBarChart, Image, Users, Target } from 'lucide-react';
import { useCreativeReporting, TimeFrameOption } from '@/hooks/useCreativeReporting';
import { CreativeReportingTable } from './CreativeReportingTable';
import { TimeFrameSelector } from './TimeFrameSelector';
import { MetricCard } from './MetricCard';

interface ReportingSectionProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

export function ReportingSection({ accessToken, selectedAccount }: ReportingSectionProps) {
  const {
    aggregatedData,
    isLoading,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchCreativeAnalytics,
  } = useCreativeReporting(accessToken);

  const [selectedTimeFrame, setSelectedTimeFrame] = useState('30d');
  const [reportType, setReportType] = useState('creatives');

  useEffect(() => {
    if (selectedAccount) {
      fetchCreativeAnalytics(selectedAccount);
    }
  }, [selectedAccount, dateRange, timeGranularity, fetchCreativeAnalytics]);

  const handleTimeFrameChange = (option: TimeFrameOption) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchCreativeAnalytics(selectedAccount);
    }
  };

  // Calculate summary metrics
  const totals = aggregatedData.reduce(
    (acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }),
    { impressions: 0, clicks: 0, spent: 0, leads: 0 }
  );

  const avgCtr = totals.impressions > 0 
    ? ((totals.clicks / totals.impressions) * 100).toFixed(2) 
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

        <TabsContent value="creatives" className="space-y-6 mt-6">
          {/* Time Frame Selector */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardContent className="pt-4">
              <TimeFrameSelector
                timeFrameOptions={timeFrameOptions}
                selectedTimeFrame={selectedTimeFrame}
                onTimeFrameChange={handleTimeFrameChange}
                timeGranularity={timeGranularity}
                onGranularityChange={setTimeGranularity}
                dateRange={dateRange}
              />
            </CardContent>
          </Card>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricCard
              title="Total Impressions"
              value={totals.impressions.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Clicks"
              value={totals.clicks.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Spent"
              value={`$${totals.spent.toFixed(2)}`}
              icon={FileBarChart}
            />
            <MetricCard
              title="Total Leads"
              value={totals.leads.toLocaleString()}
              icon={FileBarChart}
            />
            <MetricCard
              title="Avg CTR"
              value={`${avgCtr}%`}
              icon={FileBarChart}
            />
          </div>

          {/* Data Table */}
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
              <CreativeReportingTable data={aggregatedData} isLoading={isLoading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
