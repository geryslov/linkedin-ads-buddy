import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DailySpend {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface BudgetPacingData {
  period: {
    start: string;
    end: string;
    month: string;
  };
  budget: {
    amount: number;
    currency: string;
    isSet: boolean;
  };
  spending: {
    total: number;
    daily: DailySpend[];
    avgDaily: number;
    projected: number;
  };
  pacing: {
    status: 'on_track' | 'underspend' | 'overspend';
    percent: number;
    idealSpentToDate: number;
    daysElapsed: number;
    daysRemaining: number;
    daysInMonth: number;
  };
  performance: {
    impressions: number;
    clicks: number;
    leads: number;
    ctr: number;
    cpl: number;
  };
  trends: {
    last7DaysSpend: number;
    prev7DaysSpend: number;
    spendTrendPercent: number;
  };
  recommendations: string[];
}

export function useBudgetPacing(accessToken: string | null) {
  const [data, setData] = useState<BudgetPacingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBudgetPacing = useCallback(async (accountId: string, dateRange?: { start: string; end: string }) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_budget_pacing',
          accessToken,
          params: { accountId, dateRange }
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

      setData(result);
    } catch (err) {
      setError('Failed to fetch budget pacing data');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const saveBudget = useCallback(async (accountId: string, amount: number, currency: string = 'USD') => {
    const now = new Date();
    // Format as YYYY-MM-01 for date column compatibility
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No authenticated user');
        return false;
      }

      const { error: upsertError } = await supabase
        .from('account_budgets')
        .upsert({
          account_id: accountId,
          budget_amount: amount,
          currency,
          month,
          user_id: user.id,
        }, {
          onConflict: 'user_id,account_id,month'
        });

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

  return {
    data,
    isLoading,
    error,
    fetchBudgetPacing,
    saveBudget,
  };
}
