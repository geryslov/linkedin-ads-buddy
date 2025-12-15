import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Creative {
  id: string;
  name: string;
  status: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
  type: string;
  creatives: Creative[];
}

export interface CampaignGroup {
  id: string;
  name: string;
  status: string;
  campaigns: Campaign[];
}

export interface AccountStructure {
  accountId: string;
  accountName: string;
  campaignGroups: CampaignGroup[];
}

export function useAccountStructure(accessToken: string | null) {
  const [structure, setStructure] = useState<AccountStructure | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountStructure = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_account_structure',
          accessToken,
          params: { accountId }
        }
      });

      if (fnError) {
        console.error('Account structure error:', fnError);
        setError(fnError.message || 'Failed to fetch account structure');
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      setStructure(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch account structure');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  return {
    structure,
    isLoading,
    error,
    fetchAccountStructure
  };
}
