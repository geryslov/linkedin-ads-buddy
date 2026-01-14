import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export interface AccountSpend {
  accountId: string;
  accountName: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  leads: number;
}

export interface UseMultiAccountSpendReturn {
  accountSpends: AccountSpend[];
  isLoading: boolean;
  error: string | null;
  fetchAllAccountSpends: (accounts: Array<{ id: string; name: string; currency?: string }>, month?: Date) => Promise<void>;
  totals: {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
  };
}

export function useMultiAccountSpend(accessToken: string | null): UseMultiAccountSpendReturn {
  const [accountSpends, setAccountSpends] = useState<AccountSpend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAllAccountSpends = useCallback(async (
    accounts: Array<{ id: string; name: string; currency?: string }>,
    month?: Date
  ) => {
    if (!accessToken || accounts.length === 0) {
      setAccountSpends([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const targetMonth = month || new Date();
      const startDate = format(startOfMonth(targetMonth), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(targetMonth), 'yyyy-MM-dd');

      console.log('[useMultiAccountSpend] Fetching spend for', accounts.length, 'accounts');
      console.log('[useMultiAccountSpend] Date range:', startDate, 'to', endDate);

      // Fetch spend for all accounts in parallel
      const spendPromises = accounts.map(async (account) => {
        try {
          const { data, error: apiError } = await supabase.functions.invoke('linkedin-api', {
            body: {
              action: 'get_analytics',
              accessToken,
              params: {
                accountId: account.id,
                startDate,
                endDate,
              },
            },
          });

          if (apiError) {
            console.error(`[useMultiAccountSpend] Error for account ${account.id}:`, apiError);
            return {
              accountId: account.id,
              accountName: account.name,
              spend: 0,
              currency: account.currency || 'USD',
              impressions: 0,
              clicks: 0,
              leads: 0,
            };
          }

          // Handle both single analytics object and array of elements
          let totalSpend = 0;
          let totalImpressions = 0;
          let totalClicks = 0;
          let totalLeads = 0;

          if (data?.elements && Array.isArray(data.elements)) {
            data.elements.forEach((el: any) => {
              totalSpend += parseFloat(el.costInLocalCurrency || '0');
              totalImpressions += el.impressions || 0;
              totalClicks += el.clicks || 0;
              totalLeads += (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0);
            });
          } else if (data) {
            totalSpend = parseFloat(data.costInLocalCurrency || '0');
            totalImpressions = data.impressions || 0;
            totalClicks = data.clicks || 0;
            totalLeads = (data.oneClickLeads || 0) + (data.externalWebsiteConversions || 0);
          }

          return {
            accountId: account.id,
            accountName: account.name,
            spend: totalSpend,
            currency: account.currency || 'USD',
            impressions: totalImpressions,
            clicks: totalClicks,
            leads: totalLeads,
          };
        } catch (err) {
          console.error(`[useMultiAccountSpend] Exception for account ${account.id}:`, err);
          return {
            accountId: account.id,
            accountName: account.name,
            spend: 0,
            currency: account.currency || 'USD',
            impressions: 0,
            clicks: 0,
            leads: 0,
          };
        }
      });

      const results = await Promise.all(spendPromises);
      setAccountSpends(results);
      console.log('[useMultiAccountSpend] Fetched spend for all accounts:', results);
    } catch (err: any) {
      console.error('[useMultiAccountSpend] Error:', err);
      setError(err.message || 'Failed to fetch account spends');
      toast({
        title: 'Error',
        description: 'Failed to fetch account spend data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, toast]);

  const totals = accountSpends.reduce(
    (acc, spend) => ({
      spend: acc.spend + spend.spend,
      impressions: acc.impressions + spend.impressions,
      clicks: acc.clicks + spend.clicks,
      leads: acc.leads + spend.leads,
    }),
    { spend: 0, impressions: 0, clicks: 0, leads: 0 }
  );

  return {
    accountSpends,
    isLoading,
    error,
    fetchAllAccountSpends,
    totals,
  };
}
