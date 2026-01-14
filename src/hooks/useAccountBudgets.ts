import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { startOfMonth, format } from 'date-fns';

export interface AccountBudget {
  id: string;
  user_id: string;
  account_id: string;
  month: string;
  budget_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface UseAccountBudgetsReturn {
  budgets: AccountBudget[];
  isLoading: boolean;
  error: string | null;
  fetchBudgets: (month?: Date) => Promise<void>;
  upsertBudget: (accountId: string, budgetAmount: number, month?: Date, currency?: string) => Promise<void>;
  deleteBudget: (accountId: string, month?: Date) => Promise<void>;
  getBudgetForAccount: (accountId: string) => AccountBudget | undefined;
}

export function useAccountBudgets(): UseAccountBudgetsReturn {
  const [budgets, setBudgets] = useState<AccountBudget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const getMonthKey = (date?: Date) => {
    const d = date || new Date();
    return format(startOfMonth(d), 'yyyy-MM-dd');
  };

  const fetchBudgets = useCallback(async (month?: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const monthKey = getMonthKey(month);
      
      const { data, error: fetchError } = await supabase
        .from('account_budgets')
        .select('*')
        .eq('month', monthKey);
      
      if (fetchError) throw fetchError;
      
      setBudgets((data || []) as AccountBudget[]);
    } catch (err: any) {
      console.error('Error fetching budgets:', err);
      setError(err.message || 'Failed to fetch budgets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const upsertBudget = useCallback(async (
    accountId: string, 
    budgetAmount: number, 
    month?: Date,
    currency: string = 'USD'
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // First try getSession, if null try refreshSession
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        const { data: refreshData } = await supabase.auth.refreshSession();
        session = refreshData.session;
      }
      
      if (!session?.user) {
        throw new Error('Not authenticated. Please log in again.');
      }
      
      const monthKey = getMonthKey(month);
      
      const { error: upsertError } = await supabase
        .from('account_budgets')
        .upsert({
          user_id: session.user.id,
          account_id: accountId,
          month: monthKey,
          budget_amount: budgetAmount,
          currency,
        }, {
          onConflict: 'user_id,account_id,month',
        });
      
      if (upsertError) {
        console.error('Upsert error details:', {
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
        });
        throw upsertError;
      }
      
      // Refresh budgets
      await fetchBudgets(month);
      
      toast({
        title: 'Budget Updated',
        description: `Budget set to ${currency} ${budgetAmount.toLocaleString()}`,
      });
    } catch (err: any) {
      console.error('Error upserting budget:', err);
      setError(err.message || 'Failed to save budget');
      toast({
        title: 'Error',
        description: err.message || 'Failed to save budget',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchBudgets, toast]);

  const deleteBudget = useCallback(async (accountId: string, month?: Date) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const monthKey = getMonthKey(month);
      
      const { error: deleteError } = await supabase
        .from('account_budgets')
        .delete()
        .eq('account_id', accountId)
        .eq('month', monthKey);
      
      if (deleteError) throw deleteError;
      
      // Refresh budgets
      await fetchBudgets(month);
      
      toast({
        title: 'Budget Removed',
        description: 'Monthly budget has been removed',
      });
    } catch (err: any) {
      console.error('Error deleting budget:', err);
      setError(err.message || 'Failed to delete budget');
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete budget',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [fetchBudgets, toast]);

  const getBudgetForAccount = useCallback((accountId: string) => {
    return budgets.find(b => b.account_id === accountId);
  }, [budgets]);

  return {
    budgets,
    isLoading,
    error,
    fetchBudgets,
    upsertBudget,
    deleteBudget,
    getBudgetForAccount,
  };
}
