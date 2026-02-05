import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertTriangle, AlertCircle, CheckCircle, TrendingDown, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useCreativeFatigue, CreativeFatigueItem } from '@/hooks/useCreativeFatigue';
import { TimeFrameSelector } from './TimeFrameSelector';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type ObjectiveFilter = 'all' | 'LEAD_GENERATION' | 'ENGAGEMENT';

const OBJECTIVE_OPTIONS: { value: ObjectiveFilter; label: string; focusMetric: string }[] = [
  { value: 'all', label: 'All Objectives', focusMetric: 'CTR & CPL' },
  { value: 'LEAD_GENERATION', label: 'Lead Generation', focusMetric: 'CPL' },
  { value: 'ENGAGEMENT', label: 'Engagement', focusMetric: 'CTR' },
];

interface CreativeFatigueDetectorProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

interface CreativeRowProps {
  creative: CreativeFatigueItem;
  objectiveFilter: ObjectiveFilter;
}

function StatusBadge({ status }: { status: 'healthy' | 'warning' | 'fatigued' }) {
  if (status === 'fatigued') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Fatigued
      </Badge>
    );
  }
  if (status === 'warning') {
    return (
      <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        <AlertCircle className="h-3 w-3" />
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
      <CheckCircle className="h-3 w-3" />
      Healthy
    </Badge>
  );
}

function TrendIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const color = isPositive ? 'text-green-600' : value === 0 ? 'text-muted-foreground' : 'text-red-600';
  const Icon = value >= 0 ? TrendingUp : TrendingDown;

  return (
    <span className={`flex items-center gap-1 ${color}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function CreativeRow({ creative, objectiveFilter }: CreativeRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const showCpl = objectiveFilter === 'all' || objectiveFilter === 'LEAD_GENERATION';
  const showCtr = objectiveFilter === 'all' || objectiveFilter === 'ENGAGEMENT';
  const colSpan = 6 + (showCtr ? 2 : 0) + (showCpl ? 2 : 0);

  // Determine which chart to show based on objective
  const chartMetric = objectiveFilter === 'LEAD_GENERATION' ? 'cpl' : 'ctr';
  const chartLabel = objectiveFilter === 'LEAD_GENERATION' ? 'CPL' : 'CTR';
  const chartFormatter = objectiveFilter === 'LEAD_GENERATION' 
    ? (value: number) => [`$${value.toFixed(2)}`, 'CPL']
    : (value: number) => [`${value.toFixed(2)}%`, 'CTR'];

  return (
    <>
      <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="w-10">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="w-24">
          <StatusBadge status={creative.status} />
        </TableCell>
        <TableCell className="font-medium truncate max-w-[200px]" title={creative.creativeName}>
          {creative.creativeName}
        </TableCell>
        <TableCell className="text-right">{creative.metrics.totalImpressions.toLocaleString()}</TableCell>
        <TableCell className="text-right">${creative.metrics.totalSpend.toFixed(2)}</TableCell>
        <TableCell className="text-right">{creative.metrics.totalLeads}</TableCell>
        {showCtr && (
          <>
            <TableCell className="text-right">{creative.metrics.avgCtr.toFixed(2)}%</TableCell>
            <TableCell className="text-right">
              <TrendIndicator value={creative.metrics.ctrTrend} />
            </TableCell>
          </>
        )}
        {showCpl && (
          <>
            <TableCell className="text-right">
              {creative.metrics.totalLeads > 0 ? `$${creative.metrics.avgCpl.toFixed(2)}` : '-'}
            </TableCell>
            <TableCell className="text-right">
              {creative.metrics.totalLeads > 0 ? <TrendIndicator value={creative.metrics.cplTrend} inverted /> : '-'}
            </TableCell>
          </>
        )}
      </TableRow>
      {isOpen && (
        <TableRow>
          <TableCell colSpan={colSpan} className="p-0">
            <div className="bg-muted/30 p-4 space-y-4">
              {/* Signals */}
              {creative.signals.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Fatigue Signals</h4>
                  <ul className="space-y-1">
                    {creative.signals.map((signal, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-destructive" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              <div className="p-3 bg-background rounded-md border">
                <p className="text-sm"><strong>Recommendation:</strong> {creative.recommendation}</p>
              </div>

              {/* Trend Chart - show CPL for lead gen, CTR for engagement */}
              {creative.dailyData.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">{chartLabel} Trend (Last 30 Days)</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={creative.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        formatter={chartFormatter}
                      />
                      <Line type="monotone" dataKey={chartMetric} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function CreativeFatigueDetector({ accessToken, selectedAccount }: CreativeFatigueDetectorProps) {
  const [objectiveFilter, setObjectiveFilter] = useState<ObjectiveFilter>('all');
  
  const {
    data,
    isLoading,
    error,
    fetchCreativeFatigue,
    dateRange,
    setDateRange,
  } = useCreativeFatigue(accessToken);

  // Filter creatives by objective
  const filteredCreatives = useMemo(() => {
    if (!data?.creatives) return [];
    if (objectiveFilter === 'all') return data.creatives;
    return data.creatives.filter(c => c.objectiveType === objectiveFilter);
  }, [data?.creatives, objectiveFilter]);

  // Compute summary from filtered creatives
  const filteredSummary = useMemo(() => {
    return {
      total: filteredCreatives.length,
      fatigued: filteredCreatives.filter(c => c.status === 'fatigued').length,
      warning: filteredCreatives.filter(c => c.status === 'warning').length,
      healthy: filteredCreatives.filter(c => c.status === 'healthy').length,
    };
  }, [filteredCreatives]);

  useEffect(() => {
    if (selectedAccount) {
      fetchCreativeFatigue(selectedAccount);
    }
  }, [selectedAccount, fetchCreativeFatigue]);

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchCreativeFatigue(selectedAccount);
    }
  };

  const timeFrameOptions = [
    { label: 'Last 14 Days', value: 'last_14_days', startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 30 Days', value: 'last_30_days', startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 60 Days', value: 'last_60_days', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), endDate: new Date() },
  ];

  const handleTimeFrameChange = (option: typeof timeFrameOptions[0]) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate),
    });
  };

  const showCpl = objectiveFilter === 'all' || objectiveFilter === 'LEAD_GENERATION';
  const showCtr = objectiveFilter === 'all' || objectiveFilter === 'ENGAGEMENT';
  const focusMetricLabel = OBJECTIVE_OPTIONS.find(o => o.value === objectiveFilter)?.focusMetric || 'CTR & CPL';

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <TimeFrameSelector
                timeFrameOptions={timeFrameOptions}
                selectedTimeFrame="last_30_days"
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
              <Select value={objectiveFilter} onValueChange={(v) => setObjectiveFilter(v as ObjectiveFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Objective" />
                </SelectTrigger>
                <SelectContent>
                  {OBJECTIVE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {objectiveFilter !== 'all' && (
                <Badge variant="secondary" className="text-xs">
                  Focus: {focusMetricLabel}
                </Badge>
              )}
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Analyzed</div>
            <div className="text-2xl font-bold">{filteredSummary.total}</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="pt-4">
            <div className="text-xs text-destructive">Fatigued</div>
            <div className="text-2xl font-bold text-destructive">{filteredSummary.fatigued}</div>
          </CardContent>
        </Card>
        <Card className="bg-secondary border-secondary">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Warning</div>
            <div className="text-2xl font-bold">{filteredSummary.warning}</div>
          </CardContent>
        </Card>
        <Card className="bg-accent border-accent">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Healthy</div>
            <div className="text-2xl font-bold">{filteredSummary.healthy}</div>
          </CardContent>
        </Card>
      </div>

      {/* Creatives Table */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Creative Fatigue Analysis
          </CardTitle>
          <CardDescription>
            Creatives showing declining performance over time. Click a row to see details and trends.
            {objectiveFilter !== 'all' && ` Filtered by ${OBJECTIVE_OPTIONS.find(o => o.value === objectiveFilter)?.label}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredCreatives.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead>Creative</TableHead>
                    <TableHead className="text-right">Impressions</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    {showCtr && (
                      <>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">CTR Trend</TableHead>
                      </>
                    )}
                    {showCpl && (
                      <>
                        <TableHead className="text-right">CPL</TableHead>
                        <TableHead className="text-right">CPL Trend</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreatives.map((creative) => (
                    <CreativeRow key={creative.creativeId} creative={creative} objectiveFilter={objectiveFilter} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>No creatives with sufficient data to analyze.</p>
              <p className="text-sm mt-2">Creatives need at least {data?.thresholds?.minImpressions || 1000} impressions to be included.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thresholds Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <h4 className="text-sm font-medium mb-2">Detection Thresholds</h4>
          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium">CTR Decline:</span> {data?.thresholds?.ctrDeclineThreshold || 20}%
            </div>
            <div>
              <span className="font-medium">CPL Increase:</span> {data?.thresholds?.cplIncreaseThreshold || 30}%
            </div>
            <div>
              <span className="font-medium">Min Impressions:</span> {data?.thresholds?.minImpressions?.toLocaleString() || '1,000'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
