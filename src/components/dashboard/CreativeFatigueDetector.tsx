import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, AlertTriangle, AlertCircle, TrendingDown, TrendingUp, ChevronDown, ChevronRight, SearchX } from 'lucide-react';
import { useCreativeFatigue, CreativeFatigueItem } from '@/hooks/useCreativeFatigue';
import { TimeFrameSelector } from './TimeFrameSelector';
import { WidgetCard, EmptyState, StatusPill } from './widgets';
import { cn } from '@/lib/utils';
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

const STATUS_TONE: Record<'healthy' | 'warning' | 'fatigued', { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  fatigued: { tone: 'danger', label: 'Fatigued' },
  warning: { tone: 'warning', label: 'Warning' },
  healthy: { tone: 'success', label: 'Healthy' },
};

function TrendIndicator({ value, inverted = false }: { value: number; inverted?: boolean }) {
  const isPositive = inverted ? value < 0 : value > 0;
  const color = isPositive ? 'text-success' : value === 0 ? 'text-muted-foreground' : 'text-destructive';
  const Icon = value >= 0 ? TrendingUp : TrendingDown;

  return (
    <span className={`inline-flex items-center justify-end gap-1 tabular-nums ${color}`}>
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
  const s = STATUS_TONE[creative.status];

  // Determine which chart to show based on objective
  const chartMetric = objectiveFilter === 'LEAD_GENERATION' ? 'cpl' : 'ctr';
  const chartLabel = objectiveFilter === 'LEAD_GENERATION' ? 'CPL' : 'CTR';
  const chartFormatter = objectiveFilter === 'LEAD_GENERATION'
    ? (value: number) => [`$${value.toFixed(2)}`, 'CPL']
    : (value: number) => [`${value.toFixed(2)}%`, 'CTR'];

  return (
    <>
      <TableRow className="cursor-pointer [&>td]:py-2.5" onClick={() => setIsOpen(!isOpen)}>
        <TableCell className="w-10">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="w-28">
          <StatusPill tone={s.tone} label={s.label} />
        </TableCell>
        <TableCell className="font-medium min-w-[150px]">
          <span className="break-words">{creative.creativeName}</span>
        </TableCell>
        <TableCell className="text-right tabular-nums">{creative.metrics.totalImpressions.toLocaleString()}</TableCell>
        <TableCell className="text-right tabular-nums">${creative.metrics.totalSpend.toFixed(2)}</TableCell>
        <TableCell className="text-right tabular-nums">{creative.metrics.totalLeads}</TableCell>
        {showCtr && (
          <>
            <TableCell className="text-right tabular-nums">{creative.metrics.avgCtr.toFixed(2)}%</TableCell>
            <TableCell className="text-right">
              <TrendIndicator value={creative.metrics.ctrTrend} />
            </TableCell>
          </>
        )}
        {showCpl && (
          <>
            <TableCell className="text-right tabular-nums">
              {creative.metrics.totalLeads > 0 ? `$${creative.metrics.avgCpl.toFixed(2)}` : <span className="text-muted-foreground/50">—</span>}
            </TableCell>
            <TableCell className="text-right">
              {creative.metrics.totalLeads > 0 ? <TrendIndicator value={creative.metrics.cplTrend} inverted /> : <span className="text-muted-foreground/50">—</span>}
            </TableCell>
          </>
        )}
      </TableRow>
      {isOpen && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            <div className="bg-secondary/30 border-y border-border/60 p-4 space-y-4">
              {/* Signals */}
              {creative.signals.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">Fatigue Signals</h4>
                  <ul className="space-y-1">
                    {creative.signals.map((signal, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              <div className="p-3 bg-card rounded-lg border border-border/70" style={{ boxShadow: 'var(--shadow-xs)' }}>
                <p className="text-sm"><strong>Recommendation:</strong> {creative.recommendation}</p>
              </div>

              {/* Trend Chart - show CPL for lead gen, CTR for engagement */}
              {creative.dailyData.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-2">{chartLabel} Trend (Last 30 Days)</h4>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={creative.dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: 'var(--shadow-md)',
                        }}
                        formatter={chartFormatter}
                      />
                      <Line type="monotone" dataKey={chartMetric} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
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
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <WidgetCard noPadding>
        <EmptyState
          icon={AlertTriangle}
          title="Failed to load fatigue data"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          }
        />
      </WidgetCard>
    );
  }

  const summaryTiles = [
    { label: 'Total Analyzed', value: filteredSummary.total, accent: 'text-foreground', bar: 'bg-primary/60' },
    { label: 'Fatigued', value: filteredSummary.fatigued, accent: 'text-destructive', bar: 'bg-destructive' },
    { label: 'Warning', value: filteredSummary.warning, accent: 'text-warning', bar: 'bg-warning' },
    { label: 'Healthy', value: filteredSummary.healthy, accent: 'text-success', bar: 'bg-success' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {summaryTiles.map(({ label, value, accent, bar }) => (
          <div
            key={label}
            className="relative bg-card border border-border/70 rounded-xl px-4 py-3 overflow-hidden"
            style={{ boxShadow: 'var(--shadow-xs)' }}
          >
            <span className={cn('absolute left-0 top-0 bottom-0 w-1', bar)} />
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums mt-1 leading-none', accent)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Creatives Table */}
      <WidgetCard
        noPadding
        title="Creative Fatigue Analysis"
        subtitle={
          <>
            Creatives showing declining performance over time. Click a row for details and trends.
            {objectiveFilter !== 'all' && ` Focus: ${focusMetricLabel}.`}
          </>
        }
        toolbar={
          <>
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
              <SelectTrigger className="h-8 w-[160px] text-sm bg-card border-border">
                <SelectValue placeholder="Filter by Objective" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {OBJECTIVE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </>
        }
      >
        {filteredCreatives.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-28">Status</TableHead>
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
          <EmptyState
            icon={SearchX}
            title="No creatives to analyze"
            description={`Creatives need at least ${data?.thresholds?.minImpressions?.toLocaleString() || '1,000'} impressions to be included.`}
          />
        )}

        {/* Detection thresholds footer */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 border-t border-border/60 bg-secondary/20 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-[0.08em] text-[10px]">Detection thresholds</span>
          <span>CTR decline <span className="font-medium text-foreground tabular-nums">{data?.thresholds?.ctrDeclineThreshold || 20}%</span></span>
          <span>CPL increase <span className="font-medium text-foreground tabular-nums">{data?.thresholds?.cplIncreaseThreshold || 30}%</span></span>
          <span>Min impressions <span className="font-medium text-foreground tabular-nums">{data?.thresholds?.minImpressions?.toLocaleString() || '1,000'}</span></span>
        </div>
      </WidgetCard>
    </div>
  );
}
