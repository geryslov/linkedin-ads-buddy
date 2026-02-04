import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  RefreshCw,
  Building2,
  TrendingUp,
  Eye,
  MousePointerClick,
  Users,
  Download,
  AlertTriangle,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { useCompanyEngagementTimeline, CompanyTimeline } from '@/hooks/useCompanyEngagementTimeline';
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

// Inline editing component for company names
function EditableCompanyName({ 
  company, 
  onNameUpdate 
}: { 
  company: CompanyTimeline; 
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

  if (isEditing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          className="h-7 text-sm w-32"
          autoFocus
        />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className={isUnresolved ? 'text-muted-foreground' : ''}>
        {company.companyName}
      </span>
      {isUnresolved && onNameUpdate && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
          onClick={() => setIsEditing(true)}
          title="Edit company name"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

interface CompanyEngagementTimelineProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
];

export function CompanyEngagementTimeline({ accessToken, selectedAccount }: CompanyEngagementTimelineProps) {
  const {
    data,
    isLoading,
    error,
    fetchTimeline,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    selectedCompanies,
    toggleCompanySelection,
    selectAllCompanies,
    clearSelection,
    chartCompanies,
    chartData,
    updateCompanyName,
  } = useCompanyEngagementTimeline(accessToken);
  const { toast } = useToast();
  const [selectedTimeFrame, setSelectedTimeFrame] = useState('last_30_days');
  const [activeMetric, setActiveMetric] = useState<'impressions' | 'clicks' | 'leads'>('impressions');

  useEffect(() => {
    if (selectedAccount && accessToken) {
      fetchTimeline(selectedAccount);
    }
  }, [selectedAccount, accessToken, dateRange.start, dateRange.end]);

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    setSelectedTimeFrame(option.value);
    setTimeFrame(option);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchTimeline(selectedAccount);
    }
  };

  const handleExport = () => {
    if (!data?.topCompanies?.length) return;

    const exportData = data.topCompanies.map(c => ({
      companyName: c.companyName,
      totalImpressions: c.totals.impressions,
      totalClicks: c.totals.clicks,
      totalLeads: c.totals.leads,
      totalSpend: c.totals.spend.toFixed(2),
      ctr: c.totals.ctr.toFixed(2),
    }));

    const columns = [
      { key: 'companyName', label: 'Company' },
      { key: 'totalImpressions', label: 'Impressions' },
      { key: 'totalClicks', label: 'Clicks' },
      { key: 'totalLeads', label: 'Leads' },
      { key: 'totalSpend', label: 'Spend' },
      { key: 'ctr', label: 'CTR (%)' },
    ];

    exportToCSV(exportData, 'company_engagement_timeline', columns);
    toast({ title: 'Export successful', description: `${exportData.length} companies exported` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[400px] w-full" />
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
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Some Company Names Unavailable
          </AlertTitle>
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
            <TimeFrameSelector
              timeFrameOptions={timeFrameOptions}
              selectedTimeFrame={selectedTimeFrame}
              onTimeFrameChange={handleTimeFrameChange}
              timeGranularity="DAILY"
              onGranularityChange={() => {}}
              dateRange={dateRange}
              onCustomDateChange={(start, end) => {
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0],
                });
              }}
            />
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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Companies Reached</div>
            <div className="text-2xl font-bold">{data?.summary?.totalCompanies || 0}</div>
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
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Days in Range</div>
            <div className="text-2xl font-bold">{data?.summary?.daysInRange || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregate Timeline Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Company Engagement (Aggregated)
          </CardTitle>
          <CardDescription>
            Total engagement across all companies over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name === 'totalImpressions' ? 'Impressions' :
                    name === 'totalClicks' ? 'Clicks' :
                    name === 'totalLeads' ? 'Leads' :
                    name === 'companyCount' ? 'Companies' : name
                  ]}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalImpressions"
                  name="Impressions"
                  stroke="hsl(var(--chart-1))"
                  fill="url(#colorImpressions)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="totalClicks"
                  name="Clicks"
                  stroke="hsl(var(--chart-2))"
                  fill="url(#colorClicks)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="companyCount"
                  name="Companies"
                  stroke="hsl(var(--chart-3))"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Selection and Individual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company List */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Select Companies to Compare
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => {
                if (data?.topCompanies) {
                  const topFive = data.topCompanies.slice(0, 5).map(c => c.companyUrn);
                  topFive.forEach(urn => {
                    if (!selectedCompanies.has(urn)) {
                      toggleCompanySelection(urn);
                    }
                  });
                }
              }}>
                Top 5
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {data?.topCompanies?.map((company, idx) => (
              <div
                key={company.companyUrn}
                className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <Checkbox
                  checked={selectedCompanies.has(company.companyUrn)}
                  onCheckedChange={() => toggleCompanySelection(company.companyUrn)}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    <EditableCompanyName company={company} onNameUpdate={updateCompanyName} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {company.totals.impressions.toLocaleString()} imp · {company.totals.clicks} clicks · {company.totals.leads} leads
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Selected Companies Chart */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Company Comparison</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={activeMetric === 'impressions' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetric('impressions')}
              >
                <Eye className="h-3 w-3 mr-1" />
                Impressions
              </Button>
              <Button
                variant={activeMetric === 'clicks' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetric('clicks')}
              >
                <MousePointerClick className="h-3 w-3 mr-1" />
                Clicks
              </Button>
              <Button
                variant={activeMetric === 'leads' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveMetric('leads')}
              >
                <Users className="h-3 w-3 mr-1" />
                Leads
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {chartCompanies.length > 0 && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  {chartCompanies.map((company, idx) => (
                    <Line
                      key={company.companyUrn}
                      type="monotone"
                      dataKey={`${company.companyName}_${activeMetric}`}
                      name={company.companyName}
                      stroke={CHART_COLORS[data?.topCompanies?.findIndex(c => c.companyUrn === company.companyUrn) % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                Select companies from the list to compare their engagement over time
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Company Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Company Engagement Summary
          </CardTitle>
          <CardDescription>
            Top companies by total impressions during the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.topCompanies && data.topCompanies.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead className="min-w-[200px]">Company</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topCompanies.map((company, idx) => (
                    <TableRow key={company.companyUrn}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-medium min-w-[200px]">
                        <EditableCompanyName company={company} onNameUpdate={updateCompanyName} />
                      </TableCell>
                      <TableCell className="text-right">{company.totals.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{company.totals.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium text-primary">{company.totals.leads}</TableCell>
                      <TableCell className="text-right">${company.totals.spend.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{company.totals.ctr.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No company data available for the selected period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
