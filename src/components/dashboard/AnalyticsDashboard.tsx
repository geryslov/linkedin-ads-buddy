import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MetricCard } from './MetricCard';
import { WidgetCard, EmptyState, SegmentedControl } from './widgets';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye, MousePointerClick, DollarSign, Target, BarChart3,
} from 'lucide-react';

interface DayMetrics {
  date: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpl: number;
}

interface AnalyticsDashboardProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

// Validated categorical slots (see --chart-N in index.css) — fixed per metric
const COLORS = {
  impressions: '#2a78d6',
  clicks: '#eb6834',
  spent: '#1baf7a',
  leads: '#eda100',
};

type VolumeMetric = keyof typeof COLORS;

const METRIC_META: Record<VolumeMetric, { label: string; kind: 'count' | 'currency' }> = {
  impressions: { label: 'Impressions', kind: 'count' },
  clicks: { label: 'Clicks', kind: 'count' },
  spent: { label: 'Spend', kind: 'currency' },
  leads: { label: 'Leads', kind: 'count' },
};

function formatValue(key: string, value: number) {
  if (key === 'spent' || key === 'cpc' || key === 'cpm' || key === 'cpl') {
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (key === 'ctr') return `${Number(value).toFixed(2)}%`;
  return Number(value).toLocaleString();
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="tabular-nums font-semibold">{formatValue(p.dataKey, p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { label: '7d', value: 7 },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
];

const axisTick = { fontSize: 11, fill: 'hsl(226 12% 44%)' };

export function AnalyticsDashboard({ accessToken, selectedAccount }: AnalyticsDashboardProps) {
  const [dailyData, setDailyData] = useState<DayMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState(30);
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('impressions');

  const fetchDailyAnalytics = useCallback(async () => {
    if (!accessToken || !selectedAccount) return;
    setIsLoading(true);

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_campaign_report',
          accessToken,
          params: {
            accountId: selectedAccount,
            dateRange: { start: startDate, end: endDate },
            timeGranularity: 'DAILY',
          },
        },
      });

      if (error) throw error;

      const elements = data?.elements || data?.campaigns || [];
      // get_campaign_report returns per-campaign data — aggregate by date
      const dateMap = new Map<string, DayMetrics>();

      for (const el of elements) {
        // Handle both flat response and daily breakdown formats
        const dateStr = el.dateRange
          ? `${el.dateRange.start.year}-${String(el.dateRange.start.month).padStart(2, '0')}-${String(el.dateRange.start.day).padStart(2, '0')}`
          : el.date || '';

        if (!dateStr) continue;

        const existing = dateMap.get(dateStr) || {
          date: dateStr,
          impressions: 0,
          clicks: 0,
          spent: 0,
          leads: 0,
          ctr: 0,
          cpc: 0,
          cpm: 0,
          cpl: 0,
        };

        existing.impressions += el.impressions || 0;
        existing.clicks += el.clicks || 0;
        existing.spent += parseFloat(el.costInLocalCurrency || el.spent || '0');
        existing.leads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0) + (el.leads || 0);
        dateMap.set(dateStr, existing);
      }

      // Compute derived metrics
      const sorted = [...dateMap.values()]
        .map(d => ({
          ...d,
          spent: Math.round(d.spent * 100) / 100,
          ctr: d.impressions > 0 ? Math.round((d.clicks / d.impressions) * 10000) / 100 : 0,
          cpc: d.clicks > 0 ? Math.round((d.spent / d.clicks) * 100) / 100 : 0,
          cpm: d.impressions > 0 ? Math.round((d.spent / d.impressions) * 100000) / 100 : 0,
          cpl: d.leads > 0 ? Math.round((d.spent / d.leads) * 100) / 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setDailyData(sorted);
    } catch (err) {
      console.error('[AnalyticsDashboard] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedAccount, period]);

  useEffect(() => {
    fetchDailyAnalytics();
  }, [fetchDailyAnalytics]);

  // Compute totals and period-over-period change
  const { totals, changes } = useMemo(() => {
    if (dailyData.length === 0) {
      return {
        totals: { impressions: 0, clicks: 0, spent: 0, leads: 0, ctr: 0, cpc: 0 },
        changes: { impressions: 0, clicks: 0, spent: 0, leads: 0 },
      };
    }

    const mid = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, mid);
    const secondHalf = dailyData.slice(mid);

    const sum = (arr: DayMetrics[], key: keyof DayMetrics) =>
      arr.reduce((s, d) => s + (d[key] as number), 0);

    const totalImpressions = sum(dailyData, 'impressions');
    const totalClicks = sum(dailyData, 'clicks');
    const totalSpent = sum(dailyData, 'spent');
    const totalLeads = sum(dailyData, 'leads');

    const pctChange = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : 0;

    return {
      totals: {
        impressions: totalImpressions,
        clicks: totalClicks,
        spent: totalSpent,
        leads: totalLeads,
        ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
        cpc: totalClicks > 0 ? totalSpent / totalClicks : 0,
      },
      changes: {
        impressions: pctChange(sum(secondHalf, 'impressions'), sum(firstHalf, 'impressions')),
        clicks: pctChange(sum(secondHalf, 'clicks'), sum(firstHalf, 'clicks')),
        spent: pctChange(sum(secondHalf, 'spent'), sum(firstHalf, 'spent')),
        leads: pctChange(sum(secondHalf, 'leads'), sum(firstHalf, 'leads')),
      },
    };
  }, [dailyData]);

  const formatChange = (val: number) => {
    if (val === 0) return undefined;
    return `${val > 0 ? '+' : ''}${val}% vs prior half`;
  };

  const changeType = (val: number): 'positive' | 'negative' | 'neutral' =>
    val > 0 ? 'positive' : val < 0 ? 'negative' : 'neutral';

  // Short date labels for chart axis
  const chartData = useMemo(() =>
    dailyData.map(d => ({
      ...d,
      label: d.date.slice(5), // "MM-DD"
    })),
  [dailyData]);

  const volumeColor = COLORS[volumeMetric];
  const volumeMeta = METRIC_META[volumeMetric];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-secondary" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl bg-secondary" />
        <Skeleton className="h-56 rounded-xl bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />

      {/* KPI cards with real period-over-period changes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Impressions"
          value={totals.impressions.toLocaleString()}
          change={formatChange(changes.impressions)}
          changeType={changeType(changes.impressions)}
          icon={Eye}
          delay={0}
        />
        <MetricCard
          title="Clicks"
          value={totals.clicks.toLocaleString()}
          change={formatChange(changes.clicks)}
          changeType={changeType(changes.clicks)}
          icon={MousePointerClick}
          delay={50}
        />
        <MetricCard
          title="Total Spend"
          value={`$${totals.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          change={formatChange(changes.spent)}
          changeType={changeType(-changes.spent)} // lower spend = positive
          icon={DollarSign}
          delay={100}
        />
        <MetricCard
          title="Leads"
          value={totals.leads.toLocaleString()}
          change={formatChange(changes.leads)}
          changeType={changeType(changes.leads)}
          icon={Target}
          delay={150}
        />
      </div>

      {/* Daily volume — one metric at a time, one axis (no dual-axis charts) */}
      {chartData.length > 0 && (
        <WidgetCard
          title="Daily performance"
          subtitle={`${volumeMeta.label} per day over the selected period`}
          toolbar={
            <SegmentedControl
              size="sm"
              value={volumeMetric}
              onChange={setVolumeMetric}
              options={(Object.keys(METRIC_META) as VolumeMetric[]).map(k => ({
                value: k,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />
                    {METRIC_META[k].label}
                  </span>
                ),
              }))}
            />
          }
        >
          <ResponsiveContainer width="100%" height={300}>
            {volumeMetric === 'spent' || volumeMetric === 'leads' ? (
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(226 18% 89% / 0.6)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 8))}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) =>
                    volumeMeta.kind === 'currency'
                      ? `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
                      : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(226 18% 89% / 0.35)' }} />
                <Bar dataKey={volumeMetric} fill={volumeColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            ) : (
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={volumeColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={volumeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(226 18% 89% / 0.6)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 8))}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey={volumeMetric}
                  stroke={volumeColor}
                  fill="url(#gradVolume)"
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </WidgetCard>
      )}

      {/* Efficiency small multiples — CTR and CPC, each on its own axis */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {([
            { key: 'ctr', title: 'CTR trend', color: COLORS.impressions, fmt: (v: number) => `${v}%` },
            { key: 'cpc', title: 'CPC trend', color: COLORS.spent, fmt: (v: number) => `$${v}` },
          ] as const).map(({ key, title, color, fmt }) => (
            <WidgetCard key={key} title={title}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.1} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(226 18% 89% / 0.6)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ ...axisTick, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 6))}
                  />
                  <YAxis
                    tick={{ ...axisTick, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmt}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    fill={`url(#grad-${key})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </WidgetCard>
          ))}
        </div>
      )}

      {chartData.length === 0 && !isLoading && (
        <WidgetCard noPadding>
          <EmptyState
            icon={BarChart3}
            title="No analytics data for this period"
            description="Try a longer date range, or check that campaigns are active on the selected account."
          />
        </WidgetCard>
      )}
    </div>
  );
}
