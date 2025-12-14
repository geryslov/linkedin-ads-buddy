import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdAnalytics {
  creativeUrn: string;
  adName: string;
  campaignUrn: string;
  status: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export interface AggregatedAdData {
  name: string;
  campaignUrn: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useAdReporting(accessToken: string | null) {
  const [adAnalytics, setAdAnalytics] = useState<AdAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('ALL');
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

  const fetchAdAnalytics = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    
    try {
      console.log('Fetching ad analytics with params:', { accountId, dateRange, timeGranularity });
      
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_ad_analytics', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity,
          }
        }
      });

      if (error) throw error;
      
      console.log('Ad analytics response:', data);
      
      // Map API response to AdAnalytics interface
      const analyticsData: AdAnalytics[] = (data.elements || []).map((el: any) => ({
        creativeUrn: el.creativeUrn || '',
        adName: el.adName || `Ad ${el.creativeUrn?.split(':').pop() || 'Unknown'}`,
        campaignUrn: el.campaignUrn || '',
        status: el.status || 'UNKNOWN',
        impressions: el.impressions || 0,
        clicks: el.clicks || 0,
        spent: parseFloat(el.costInLocalCurrency || '0'),
        leads: el.leads || 0,
        ctr: parseFloat(el.ctr || '0'),
        cpc: parseFloat(el.cpc || '0'),
        cpm: parseFloat(el.cpm || '0'),
      }));
      
      setAdAnalytics(analyticsData);
    } catch (error: any) {
      console.error('Fetch ad analytics error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch ad analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, toast]);

  // Aggregate data by ad name
  const aggregatedData = useMemo((): AggregatedAdData[] => {
    return adAnalytics.map((item) => ({
      name: item.adName,
      campaignUrn: item.campaignUrn,
      impressions: item.impressions,
      clicks: item.clicks,
      spent: item.spent,
      leads: item.leads,
      ctr: item.ctr,
      cpc: item.cpc,
      cpm: item.cpm,
    }));
  }, [adAnalytics]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    adAnalytics,
    aggregatedData,
    isLoading,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchAdAnalytics,
  };
}
