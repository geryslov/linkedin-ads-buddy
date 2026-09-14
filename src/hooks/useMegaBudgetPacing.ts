import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { BudgetInput } from './useBudgetPacing';

export interface AccountPacingSummary {
  accountId: string;
  budget: number;
  spent: number;
  currency: string;
  googleBudget: number;
  googleSpent: number;
  googleLinked?: boolean;
  googleAccountName?: string | null;
  additionalBudget: number;
  additionalSpent: number;
  totalBudget: number;
  totalSpent: number;
  totalPacingPercent: number;
  totalPacingStatus: 'on_track' | 'underspend' | 'overspend';
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

  const saveBudget = useCallback(async (accountId: string, input: BudgetInput | number, currency: string = 'USD') => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const payload: BudgetInput = typeof input === 'number' ? { amount: input, currency } : { currency, ...input };

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'save_account_budget',
          accessToken,
          params: { accountId, month, ...payload },
        },
      });

      if (fnError || result?.error) {
        console.error('Budget save error:', fnError || result?.error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Budget save error:', err);
      return false;
    }
  }, [accessToken]);

  const aggregates = useMemo(() => {
    const withBudget = data.filter(d => d.budget > 0);
    const totalBudget = data.reduce((s, d) => s + d.budget, 0);
    const totalSpent = data.reduce((s, d) => s + d.spent, 0);
    const googleBudget = data.reduce((s, d) => s + (d.googleBudget || 0), 0);
    const googleSpent = data.reduce((s, d) => s + (d.googleSpent || 0), 0);
    const additionalBudget = data.reduce((s, d) => s + (d.additionalBudget || 0), 0);
    const additionalSpent = data.reduce((s, d) => s + (d.additionalSpent || 0), 0);
    const allBudget = totalBudget + googleBudget + additionalBudget;
    const allSpent = totalSpent + googleSpent + additionalSpent;
    const onTrack = withBudget.filter(d => d.pacingStatus === 'on_track').length;
    const over = withBudget.filter(d => d.pacingStatus === 'overspend').length;
    const under = withBudget.filter(d => d.pacingStatus === 'underspend').length;
    const noBudget = data.filter(d => d.budget === 0).length;

    const daysInMonth = data[0]?.daysInMonth || 30;
    const currentDay = daysInMonth - (data[0]?.daysRemaining || 0);
    const pacingFor = (budget: number, spent: number) => {
      if (budget <= 0) return 0;
      const idealSpent = (budget / daysInMonth) * currentDay;
      return idealSpent > 0 ? (spent / idealSpent) * 100 : 0;
    };

    return {
      totalBudget, totalSpent,
      googleBudget, googleSpent,
      additionalBudget, additionalSpent,
      allBudget, allSpent,
      overallPacing: pacingFor(totalBudget, totalSpent),
      allPacing: pacingFor(allBudget, allSpent),
      onTrack, over, under, noBudget,
    };
  }, [data]);

  return { data, isLoading, error, fetchAll, saveBudget, aggregates };
}
