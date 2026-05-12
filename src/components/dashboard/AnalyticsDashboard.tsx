import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { MetricCard } from './MetricCard';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye, MousePointerClick, DollarSign, Target, TrendingUp, TrendingDown,
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

const COLORS = {
  impressions: '#2563eb',
  clicks: '#7c3aed',
  spent: '#059669',
  leads: '#d97706',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
          <span className="tabular-nums font-semibold">
            {p.dataKey === 'spent' || p.dataKey === 'cpc' || p.dataKey === 'cpm' || p.dataKey === 'cpl'
              ? `$${Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : p.dataKey === 'ctr'
                ? `${Number(p.value).toFixed(2)}%`
                : Number(p.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

export function AnalyticsDashboard({ accessToken, selectedAccount }: AnalyticsDashboardProps) {
  const [dailyData, setDailyData] = useState<DayMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState(30);

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-secondary" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl bg-secondary" />
        <Skeleton className="h-72 rounded-xl bg-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setPeriod(opt.days)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              period === opt.days
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

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

      {/* Daily impressions + clicks area chart */}
      {chartData.length > 0 && (
        <div className="border border-border/70 rounded-lg p-5 bg-card shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Daily Impressions & Clicks
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradImpressions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.impressions} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.impressions} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.clicks} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={COLORS.clicks} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis
                yAxisId="impressions"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <YAxis
                yAxisId="clicks"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                yAxisId="impressions"
                type="monotone"
                dataKey="impressions"
                stroke={COLORS.impressions}
                fill="url(#gradImpressions)"
                strokeWidth={2}
              />
              <Area
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                stroke={COLORS.clicks}
                fill="url(#gradClicks)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily spend + leads bar chart */}
      {chartData.length > 0 && (
        <div className="border border-border/70 rounded-lg p-5 bg-card shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Daily Spend & Leads
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                interval={Math.max(0, Math.floor(chartData.length / 8))}
              />
              <YAxis
                yAxisId="spent"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <YAxis
                yAxisId="leads"
                orientation="right"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar yAxisId="spent" dataKey="spent" fill={COLORS.spent} radius={[3, 3, 0, 0]} opacity={0.85} />
              <Bar yAxisId="leads" dataKey="leads" fill={COLORS.leads} radius={[3, 3, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Efficiency metrics: CTR + CPC over time */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-border/70 rounded-lg p-5 bg-card shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              CTR Trend
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCtr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.impressions} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.impressions} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval={Math.max(0, Math.floor(chartData.length / 6))}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ctr"
                  stroke={COLORS.impressions}
                  fill="url(#gradCtr)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border border-border/70 rounded-lg p-5 bg-card shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              CPC Trend
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCpc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.spent} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={COLORS.spent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  interval={Math.max(0, Math.floor(chartData.length / 6))}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cpc"
                  stroke={COLORS.spent}
                  fill="url(#gradCpc)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {chartData.length === 0 && !isLoading && (
        <div className="border border-border/70 rounded-lg p-8 bg-card shadow-sm text-center">
          <p className="text-muted-foreground">
            No analytics data available for the selected period. Try a longer date range or check that campaigns are active.
          </p>
        </div>
      )}
    </div>
  );
}
