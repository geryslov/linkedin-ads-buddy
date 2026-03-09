import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ConversionDef {
  id: string;
  urn: string;
  name: string;
  type: string;
}

export interface CompanyConversionRow {
  entityUrn: string;
  entityName: string;
  totalConversions: number;
  byConversion: Record<string, number>;
}

export interface ConversionBreakdownData {
  conversions: ConversionDef[];
  companies: CompanyConversionRow[];
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCompanyConversionBreakdown(accessToken: string | null) {
  const [data, setData] = useState<ConversionBreakdownData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const today = new Date();
    return [
      {
        label: 'Last 7 days',
        value: '7d',
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 14 days',
        value: '14d',
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 30 days',
        value: '30d',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'Last 90 days',
        value: '90d',
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: today,
      },
      {
        label: 'This month',
        value: 'this_month',
        startDate: new Date(today.getFullYear(), today.getMonth(), 1),
        endDate: today,
      },
      {
        label: 'Last month',
        value: 'last_month',
        startDate: new Date(today.getFullYear(), today.getMonth() - 1, 1),
        endDate: new Date(today.getFullYear(), today.getMonth(), 0),
      },
      {
        label: 'This quarter',
        value: 'this_quarter',
        startDate: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1),
        endDate: today,
      },
      {
        label: 'This year',
        value: 'this_year',
        startDate: new Date(today.getFullYear(), 0, 1),
        endDate: today,
      },
    ];
  }, []);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  const fetchBreakdown = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    setError(null);

    try {
      console.log('[useCompanyConversionBreakdown] Fetching for account:', accountId, 'dateRange:', dateRange);

      const { data: responseData, error: apiError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_company_conversion_breakdown',
          accessToken,
          params: { accountId, dateRange, maxConversions: 20 },
        },
      });

      if (apiError) throw apiError;

      if (responseData.error) {
        const detail = responseData.details ? ` — ${responseData.details}` : '';
        setError(responseData.error + detail);
        setData(null);
        return;
      }

      setData({
        conversions: responseData.conversions || [],
        companies: responseData.companies || [],
      });
    } catch (err: any) {
      console.error('[useCompanyConversionBreakdown] Error:', err);
      const message = err.message || 'Failed to fetch conversion breakdown';
      setError(message);
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, toast]);

  return {
    data,
    isLoading,
    error,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchBreakdown,
  };
}
