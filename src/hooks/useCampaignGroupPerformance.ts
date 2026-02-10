import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CampaignGroupPerformanceItem {
  campaignGroupId: string;
  campaignGroupName: string;
  status: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  avgCpc: number;
  cpl: number;
}

export interface CampaignGroupPerformanceData {
  period: {
    start: string;
    end: string;
  };
  totals: {
    impressions: number;
    clicks: number;
    spent: number;
    leads: number;
  };
  campaignGroups: CampaignGroupPerformanceItem[];
}

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCampaignGroupPerformance(accessToken: string | null) {
  const [data, setData] = useState<CampaignGroupPerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { start: formatDate(start), end: formatDate(now) };
  });

  const timeFrameOptions: TimeFrameOption[] = useMemo(() => [
    { label: 'Last 7 Days', value: 'last_7_days', startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 14 Days', value: 'last_14_days', startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 30 Days', value: 'last_30_days', startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 60 Days', value: 'last_60_days', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), endDate: new Date() },
    { label: 'Last 90 Days', value: 'last_90_days', startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), endDate: new Date() },
  ], []);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setDateRange({
      start: formatDate(option.startDate),
      end: formatDate(option.endDate),
    });
  }, []);

  const fetchCampaignGroupPerformance = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('linkedin-api', {
        body: {
          action: 'get_campaign_group_performance',
          accessToken,
          params: { accountId, dateRange }
        }
      });

      if (fnError) {
        setError(fnError.message || 'Failed to fetch campaign group performance');
        return;
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      setData(result);
    } catch (err) {
      setError('Failed to fetch campaign group performance');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange]);

  const totals = useMemo(() => {
    if (!data) return { impressions: 0, clicks: 0, spent: 0, leads: 0 };
    return data.totals;
  }, [data]);

  return {
    data,
    isLoading,
    error,
    fetchCampaignGroupPerformance,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    totals,
    campaignGroups: data?.campaignGroups || [],
  };
}
