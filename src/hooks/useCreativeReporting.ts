import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Creative {
  id: string;
  name: string;
  campaignId: string;
  status: string;
}

export interface CreativeAnalytics {
  creativeId: string;
  creativeName: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  dateRange?: { start: string; end: string };
}

export interface AggregatedCreativeData {
  name: string;
  impressions: number;
  clicks: number;
  spent: number;
  leads: number;
  ctr: number;
  count: number;
}

export type TimeGranularity = 'DAILY' | 'MONTHLY' | 'YEARLY' | 'ALL';

export interface TimeFrameOption {
  label: string;
  value: string;
  startDate: Date;
  endDate: Date;
}

export function useCreativeReporting(accessToken: string | null) {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [creativeAnalytics, setCreativeAnalytics] = useState<CreativeAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [timeGranularity, setTimeGranularity] = useState<TimeGranularity>('DAILY');
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

  const fetchCreatives = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_creatives', 
          accessToken,
          params: { accountId }
        }
      });

      if (error) throw error;
      
      const creativeList = (data.elements || []).map((el: any) => ({
        id: el.id?.toString() || '',
        name: el.name || `Creative ${el.id}`,
        campaignId: el.campaign?.split(':').pop() || '',
        status: el.status || 'UNKNOWN',
      }));
      
      setCreatives(creativeList);
      return creativeList;
    } catch (error: any) {
      console.error('Fetch creatives error:', error);
      return [];
    }
  }, [accessToken]);

  const fetchCreativeAnalytics = useCallback(async (accountId: string) => {
    if (!accessToken || !accountId) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-api', {
        body: { 
          action: 'get_creative_analytics', 
          accessToken,
          params: { 
            accountId, 
            dateRange,
            timeGranularity: timeGranularity === 'ALL' ? 'DAILY' : timeGranularity,
          }
        }
      });

      if (error) throw error;
      
      const analyticsData = (data.elements || []).map((el: any) => {
        const creativeUrn = el.pivotValue || '';
        const creativeId = creativeUrn.split(':').pop() || '';
        const impressions = el.impressions || 0;
        const clicks = el.clicks || 0;
        
        return {
          creativeId,
          creativeName: `Creative ${creativeId}`,
          impressions,
          clicks,
          spent: parseFloat(el.costInLocalCurrency || '0'),
          leads: (el.oneClickLeads || 0) + (el.externalWebsiteConversions || 0),
          ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        };
      });
      
      setCreativeAnalytics(analyticsData);
    } catch (error: any) {
      console.error('Fetch creative analytics error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch creative analytics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, dateRange, timeGranularity, toast]);

  const aggregatedData = useMemo((): AggregatedCreativeData[] => {
    const aggregation = new Map<string, AggregatedCreativeData>();
    
    creativeAnalytics.forEach((item) => {
      const name = item.creativeName;
      const existing = aggregation.get(name);
      
      if (existing) {
        existing.impressions += item.impressions;
        existing.clicks += item.clicks;
        existing.spent += item.spent;
        existing.leads += item.leads;
        existing.count += 1;
      } else {
        aggregation.set(name, {
          name,
          impressions: item.impressions,
          clicks: item.clicks,
          spent: item.spent,
          leads: item.leads,
          ctr: 0,
          count: 1,
        });
      }
    });

    // Calculate CTR after aggregation
    return Array.from(aggregation.values()).map((item) => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
    }));
  }, [creativeAnalytics]);

  const setTimeFrame = useCallback((option: TimeFrameOption) => {
    setDateRange({
      start: option.startDate.toISOString().split('T')[0],
      end: option.endDate.toISOString().split('T')[0],
    });
  }, []);

  return {
    creatives,
    creativeAnalytics,
    aggregatedData,
    isLoading,
    timeGranularity,
    setTimeGranularity,
    dateRange,
    setDateRange,
    timeFrameOptions,
    setTimeFrame,
    fetchCreatives,
    fetchCreativeAnalytics,
  };
}
