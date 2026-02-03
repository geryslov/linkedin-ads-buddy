import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, RefreshCw, Save } from 'lucide-react';
import { useBudgetPacing, BudgetPacingData } from '@/hooks/useBudgetPacing';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface BudgetPacingDashboardProps {
  accessToken: string | null;
  selectedAccount: string | null;
}

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
      toast({ title: 'Budget saved', description: `Monthly budget set to $${amount.toLocaleString()}` });
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

  const pacingColor = data?.pacing?.status === 'on_track' ? 'text-green-600' :
                      data?.pacing?.status === 'underspend' ? 'text-yellow-600' : 'text-red-600';

  const pacingIcon = data?.pacing?.status === 'on_track' ? <CheckCircle className="h-5 w-5" /> :
                     data?.pacing?.status === 'underspend' ? <TrendingDown className="h-5 w-5" /> :
                     <AlertTriangle className="h-5 w-5" />;

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

  return (
    <div className="space-y-6">
      {/* Budget Input & Pacing Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Monthly Budget
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="budget" className="sr-only">Budget</Label>
                <Input
                  id="budget"
                  type="number"
                  placeholder="Enter monthly budget"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveBudget} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            {data?.budget?.isSet && (
              <div className="text-sm text-muted-foreground">
                Budget for {data.period.month}: ${data.budget.amount.toLocaleString()} {data.budget.currency}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pacing Status</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.budget?.isSet ? (
              <div className="space-y-3">
                <div className={`flex items-center gap-2 text-lg font-semibold ${pacingColor}`}>
                  {pacingIcon}
                  {data.pacing.status === 'on_track' && 'On Track'}
                  {data.pacing.status === 'underspend' && 'Underspending'}
                  {data.pacing.status === 'overspend' && 'Overspending'}
                  <span className="text-sm font-normal">({data.pacing.percent.toFixed(0)}% of pace)</span>
                </div>
                <Progress value={Math.min(data.pacing.percent, 150)} className="h-2" />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Spent to date:</span>
                    <span className="ml-2 font-medium">${data.spending.total.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Ideal pace:</span>
                    <span className="ml-2 font-medium">${data.pacing.idealSpentToDate.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Set a budget to see pacing status</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Spent</div>
            <div className="text-2xl font-bold">${data?.spending?.total?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Avg Daily</div>
            <div className="text-2xl font-bold">${data?.spending?.avgDaily?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Projected</div>
            <div className="text-2xl font-bold">${data?.spending?.projected?.toFixed(0) || '0'}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Days Left</div>
            <div className="text-2xl font-bold">{data?.pacing?.daysRemaining || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Total Leads</div>
            <div className="text-2xl font-bold">{data?.performance?.leads || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">CPL</div>
            <div className="text-2xl font-bold">${data?.performance?.cpl?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Spend Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Daily Spend vs Budget Pace
          </CardTitle>
          <CardDescription>
            Cumulative spend compared to ideal budget pacing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number, name: string) => [
                    `$${value.toFixed(2)}`,
                    name === 'cumulative' ? 'Actual Spend' : name === 'idealPace' ? 'Ideal Pace' : 'Daily'
                  ]}
                />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                {data?.budget?.isSet && (
                  <Line type="monotone" dataKey="idealPace" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" dot={false} />
                )}
                <Line type="monotone" dataKey="spend" stroke="hsl(var(--chart-2))" strokeWidth={1} dot={false} opacity={0.5} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No spend data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary">-</span>
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 7-Day Trend */}
      {data?.trends && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">7-Day Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground text-sm">Last 7 days:</span>
                <span className="ml-2 font-medium">${data.trends.last7DaysSpend.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-sm">Previous 7 days:</span>
                <span className="ml-2 font-medium">${data.trends.prev7DaysSpend.toFixed(2)}</span>
              </div>
              <div className={`flex items-center gap-1 ${data.trends.spendTrendPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.trends.spendTrendPercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(data.trends.spendTrendPercent).toFixed(0)}%
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
