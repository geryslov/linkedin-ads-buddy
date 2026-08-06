import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard, EmptyState, StatusPill, ChartLegend } from './widgets';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Save, Lightbulb } from 'lucide-react';
import { useBudgetPacing } from '@/hooks/useBudgetPacing';
import { useToast } from '@/hooks/use-toast';
import { formatNumber, formatCurrency, cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface BudgetPacingDashboardProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };

export function BudgetPacingDashboard({ accessToken, selectedAccount }: BudgetPacingDashboardProps) {
  const { data, isLoading, error, fetchBudgetPacing, saveBudget } = useBudgetPacing(accessToken);
  const { toast } = useToast();
  const [budgetInput, setBudgetInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (selectedAccount) {
      fetchBudgetPacing(selectedAccount);
    }
  }, [selectedAccount, fetchBudgetPacing]);

  useEffect(() => {
    if (data?.budget?.amount) {
      setBudgetInput(data.budget.amount.toString());
    }
  }, [data?.budget?.amount]);

  const handleSaveBudget = async () => {
    if (!selectedAccount || !budgetInput) return;

    setIsSaving(true);
    const amount = parseFloat(budgetInput);

    if (isNaN(amount) || amount < 0) {
      toast({
        title: 'Invalid budget',
        description: 'Please enter a valid positive number',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    const success = await saveBudget(selectedAccount, amount);
    if (success) {
      toast({ title: 'Budget saved', description: `Monthly budget set to ${formatCurrency(amount)}` });
      fetchBudgetPacing(selectedAccount);
    } else {
      toast({ title: 'Error', description: 'Failed to save budget', variant: 'destructive' });
    }
    setIsSaving(false);
  };

  const handleRefresh = () => {
    if (selectedAccount) {
      fetchBudgetPacing(selectedAccount);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-xl bg-secondary" />
          <Skeleton className="h-40 w-full rounded-xl bg-secondary" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl bg-secondary" />
      </div>
    );
  }

  if (error) {
    return (
      <WidgetCard noPadding>
        <EmptyState icon={AlertTriangle} title="Couldn't load budget pacing" description={error} />
      </WidgetCard>
    );
  }

  const status = data?.pacing?.status;
  const statusTone = status === 'on_track' ? 'success' : status === 'underspend' ? 'warning' : 'danger';
  const statusColor = status === 'on_track' ? 'text-success' : status === 'underspend' ? 'text-warning' : 'text-destructive';
  const statusIcon = status === 'on_track' ? <CheckCircle className="h-5 w-5" />
    : status === 'underspend' ? <TrendingDown className="h-5 w-5" />
    : <AlertTriangle className="h-5 w-5" />;
  const statusLabel = status === 'on_track' ? 'On track' : status === 'underspend' ? 'Underspending' : 'Overspending';

  // Prepare chart data with cumulative spend
  const chartData = data?.spending?.daily?.map((d, i, arr) => {
    const cumulative = arr.slice(0, i + 1).reduce((sum, item) => sum + item.spend, 0);
    const dayOfMonth = parseInt(d.date.split('-')[2]);
    const idealPace = data.budget.isSet ? (data.budget.amount / data.pacing.daysInMonth) * dayOfMonth : 0;
    return {
      date: d.date.slice(5), // MM-DD format
      spend: d.spend,
      cumulative,
      idealPace,
      leads: d.leads,
    };
  }) || [];

  const metrics = [
    { label: 'Total spent', value: formatCurrency(data?.spending?.total || 0) },
    { label: 'Avg daily', value: formatCurrency(data?.spending?.avgDaily || 0) },
    { label: 'Projected', value: formatCurrency(data?.spending?.projected || 0, 0) },
    { label: 'Days left', value: formatNumber(data?.pacing?.daysRemaining || 0) },
    { label: 'Total leads', value: formatNumber(data?.performance?.leads || 0) },
    { label: 'CPL', value: formatCurrency(data?.performance?.cpl || 0) },
  ];

  return (
    <div className="space-y-6">
      {/* Budget Input & Pacing Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <WidgetCard title={<span className="inline-flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Monthly budget</span>}>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="budget" className="sr-only">Budget</Label>
              <Input
                id="budget"
                type="number"
                placeholder="Enter monthly budget"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="h-9"
              />
            </div>
            <Button onClick={handleSaveBudget} disabled={isSaving} className="h-9">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {data?.budget?.isSet && (
            <p className="text-sm text-muted-foreground mt-3">
              Budget for {data.period.month}: <span className="font-medium text-foreground tabular-nums">{formatCurrency(data.budget.amount)}</span> {data.budget.currency}
            </p>
          )}
        </WidgetCard>

        <WidgetCard title="Pacing status" toolbar={data?.budget?.isSet ? <StatusPill tone={statusTone} label={statusLabel} /> : undefined}>
          {data?.budget?.isSet ? (
            <div className="space-y-3">
              <div className={cn('flex items-center gap-2 text-lg font-semibold', statusColor)}>
                {statusIcon}
                {statusLabel}
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  ({data.pacing.percent.toFixed(0)}% of pace)
                </span>
              </div>
              <Progress value={Math.min(data.pacing.percent, 150)} className="h-2" />
              <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                <div>
                  <span className="text-muted-foreground">Spent to date:</span>
                  <span className="ml-2 font-medium tabular-nums">{formatCurrency(data.spending.total)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ideal pace:</span>
                  <span className="ml-2 font-medium tabular-nums">{formatCurrency(data.pacing.idealSpentToDate)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Set a budget to see pacing status.</p>
          )}
        </WidgetCard>
      </div>

      {/* Key Metrics — clean stat strip */}
      <WidgetCard noPadding>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-border/60">
          {metrics.map((m) => (
            <div key={m.label} className="px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{m.label}</p>
              <p className="text-xl font-bold tabular-nums mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      </WidgetCard>

      {/* Spend Chart — cumulative vs ideal pace (shared axis, a legit comparison) */}
      <WidgetCard
        title={<span className="inline-flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Daily spend vs. budget pace</span>}
        subtitle="Cumulative spend compared to ideal budget pacing"
        toolbar={
          <ChartLegend
            items={[
              { label: 'Actual spend', color: 'hsl(var(--chart-1))' },
              ...(data?.budget?.isSet ? [{ label: 'Ideal pace', color: 'hsl(var(--muted-foreground))' }] : []),
              { label: 'Daily', color: 'hsl(var(--chart-2))' },
            ]}
          />
        }
      >
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
              <YAxis tick={axisTick} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'cumulative' ? 'Actual Spend' : name === 'idealPace' ? 'Ideal Pace' : 'Daily'
                ]}
              />
              <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              {data?.budget?.isSet && (
                <Line type="monotone" dataKey="idealPace" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
              )}
              <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-2))" strokeWidth={1} dot={false} opacity={0.5} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
            No spend data available
          </div>
        )}
      </WidgetCard>

      {/* Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <WidgetCard title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-warning" /> Recommendations</span>}>
          <ul className="space-y-2">
            {data.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </WidgetCard>
      )}

      {/* 7-Day Trend */}
      {data?.trends && (
        <WidgetCard title="7-day trend">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="text-sm">
              <span className="text-muted-foreground">Last 7 days:</span>
              <span className="ml-2 font-medium tabular-nums">{formatCurrency(data.trends.last7DaysSpend)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Previous 7 days:</span>
              <span className="ml-2 font-medium tabular-nums">{formatCurrency(data.trends.prev7DaysSpend)}</span>
            </div>
            <div className={cn('flex items-center gap-1 text-sm font-semibold', data.trends.spendTrendPercent >= 0 ? 'text-success' : 'text-destructive')}>
              {data.trends.spendTrendPercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(data.trends.spendTrendPercent).toFixed(0)}%
            </div>
          </div>
        </WidgetCard>
      )}
    </div>
  );
}
