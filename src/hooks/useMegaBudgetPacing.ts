import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AccountPacingSummary {
  accountId: string;
  budget: number;
  spent: number;
  currency: string;
  pacingPercent: number;
  pacingStatus: 'on_track' | 'underspend' | 'overspend';
  daysRemaining: number;
  daysInMonth: number;
  projected: number;
  avgDaily: number;
  avgDaily3d: number;
  projected3d: number;
  last3Days: Array<{ date: string; spend: number }>;
}

export function useMegaBudgetPacing(accessToken: string | null) {
  const [data, setData] = useState<AccountPacingSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async (accountIds: string[]) => {
    if (!accessToken || accountIds.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_budget_pacing_summary',
          accessToken,
          params: { accountIds }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch budget pacing');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError('Failed to fetch budget pacing data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const saveBudget = useCallback(async (accountId: string, amount: number, currency: string = 'USD') => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error: upsertError } = await supabase
        .from('account_budgets')
        .upsert({
          account_id: accountId,
          budget_amount: amount,
          currency,
          month,
          user_id: user.id,
        }, { onConflict: 'user_id,account_id,month' });

      if (upsertError) {
        console.error('Budget save error:', upsertError);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Budget save error:', err);
      return false;
    }
  }, []);

  const aggregates = useMemo(() => {
    const withBudget = data.filter(d => d.budget > 0);
    const totalBudget = data.reduce((s, d) => s + d.budget, 0);
    const totalSpent = data.reduce((s, d) => s + d.spent, 0);
    const onTrack = withBudget.filter(d => d.pacingStatus === 'on_track').length;
    const over = withBudget.filter(d => d.pacingStatus === 'overspend').length;
    const under = withBudget.filter(d => d.pacingStatus === 'underspend').length;
    const noBudget = data.filter(d => d.budget === 0).length;

    let overallPacing = 0;
    if (totalBudget > 0) {
      const daysInMonth = data[0]?.daysInMonth || 30;
      const currentDay = daysInMonth - (data[0]?.daysRemaining || 0);
      const idealSpent = (totalBudget / daysInMonth) * currentDay;
      overallPacing = idealSpent > 0 ? (totalSpent / idealSpent) * 100 : 0;
    }

    return { totalBudget, totalSpent, overallPacing, onTrack, over, under, noBudget };
  }, [data]);

  return { data, isLoading, error, fetchAll, saveBudget, aggregates };
}
