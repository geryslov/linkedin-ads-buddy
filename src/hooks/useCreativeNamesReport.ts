import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CreativeNameData {
  creativeId: string;
  creativeName: string;
  campaignName: string;
  campaignType: string;
  status: string;
  type: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerLead: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCreativeNamesReport(accessToken: string | null) {
  const [creativeData, setCreativeData] = useState<CreativeNameData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('ALL');
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    // Use explicit date string formatting to avoid timezone issues
    const startStr = `${year}-01-01`;
    const endStr = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { start: startStr, end: endStr };
  });

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => {
    const now = new Date();
    
    return [
      {
        label: 'This Year',
        value: 'this_year',
        startDate: new Date(now.getFullYear(), 0, 1),
        endDate: now
      },
      {
        label: 'Last 7 Days',
        value: '7d',
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 14 Days',
        value: '14d',
        startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 30 Days',
        value: '30d',
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 60 Days',
        value: '60d',
        startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 90 Days',
        value: '90d',
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'This Month',
        value: 'this_month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now
      },
      {
        label: 'Last Month',
        value: 'last_month',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0)
      },
      {
        label: 'Last Year',
        value: 'last_year',
        startDate: new Date(now.getFullYear() - 1, 0, 1),
        endDate: new Date(now.getFullYear() - 1, 11, 31)
      },
    ];
  }, []);

  const fetchCreativeNamesReport = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_creative_names_report',
          accessToken,
          params: {
            accountId,
            dateRange,
            timeGranularity
          }
        }
      });

      if (fnError) {
        console.error('Creative names report error:', fnError);
        setError(fnError.message || 'Failed to fetch creative names report');
        return;
      }

      if (data?.error) {
        console.error('API error:', data.error);
        setError(data.error);
        return;
      }

      const elements = data?.elements || [];
      
      const mapped: CreativeNameData[] = elements.map((item: any) => ({
        creativeId: item.creativeId || '',
        creativeName: item.creativeName || `Creative ${item.creativeId}`,
        campaignName: item.campaignName || '-',
        campaignType: item.campaignType || item.objectiveType || 'UNKNOWN',
        status: item.status || 'UNKNOWN',
        type: item.type || '-',
        impressions: item.impressions || 0,
        clicks: item.clicks || 0,
        spent: parseFloat(item.spent) || 0,
        leads: item.leads || 0,
        ctr: parseFloat(item.ctr) || 0,
        cpc: parseFloat(item.cpc) || 0,
        cpm: parseFloat(item.cpm) || 0,
        costPerLead: parseFloat(item.costPerLead) || 0,
      }));

      setCreativeData(mapped);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to fetch creative names report');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity]);

  const totals = useMemo(() => {
    return creativeData.reduce((acc, item) => ({
      impressions: acc.impressions + item.impressions,
      clicks: acc.clicks + item.clicks,
      spent: acc.spent + item.spent,
      leads: acc.leads + item.leads,
    }), { impressions: 0, clicks: 0, spent: 0, leads: 0 });
  }, [creativeData]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    // Format dates explicitly to avoid timezone issues with toISOString()
    const formatDate = (d: Date) => {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate)
    });
  }, []);

  return {
    creativeData,
    isLoading,
    error,
    fetchCreativeNamesReport,
    totals,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
  };
}
